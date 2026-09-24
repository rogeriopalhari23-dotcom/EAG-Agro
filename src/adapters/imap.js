// Cliente IMAP só de leitura sobre cloudflare:sockets (P2-T11), TLS implícito na porta 993 (imap.hostinger.com).
// Comandos: LOGIN, SELECT, UID SEARCH, UID FETCH (BODY.PEEK[]<0.N>, sem marcar como lido), LOGOUT (RFC 9051).
// Desvio registrado da Fase 4 (imapflow): 8 dependências e compatibilidade Node no Worker inteiro para uma leitura simples.
import { AdapterError } from "./errors.js";

export const PARTIAL_BYTES = 262144; // mensagens maiores são lidas até aqui (classificação usa cabeçalho e início do texto)
const quote = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

// Leitor de respostas IMAP sobre um fluxo de bytes: linhas e literais {n}. Exportado para teste.
export function responseReader(chunks) {
  let buf = new Uint8Array(0);
  const it = chunks[Symbol.asyncIterator]();
  const dec = new TextDecoder("latin1");
  async function fill(min) {
    while (buf.length < min) {
      const { value, done } = await it.next();
      if (done) throw new AdapterError("temporary", "IMAP: conexão encerrada no meio da resposta.");
      const merged = new Uint8Array(buf.length + value.length);
      merged.set(buf);
      merged.set(value, buf.length);
      buf = merged;
    }
  }
  async function line() {
    for (;;) {
      const i = buf.indexOf(10);
      if (i >= 0) {
        const l = dec.decode(buf.subarray(0, i)).replace(/\r$/, "");
        buf = buf.subarray(i + 1);
        return l;
      }
      await fill(buf.length + 1);
    }
  }
  async function bytes(n) {
    await fill(n);
    const out = buf.slice(0, n);
    buf = buf.subarray(n);
    return out;
  }
  // Lê até a linha marcada com a etiqueta; devolve linhas não marcadas e literais em ordem.
  async function until(tag) {
    const items = [];
    for (;;) {
      const l = await line();
      if (l.startsWith(`${tag} `)) {
        const status = l.slice(tag.length + 1).split(" ")[0];
        if (status !== "OK") throw new AdapterError(status === "NO" ? "auth" : "invalid_request", `IMAP: ${l.slice(tag.length + 1).slice(0, 120)}`);
        return items;
      }
      const lit = /\{(\d+)\}$/.exec(l);
      if (lit) items.push({ line: l, literal: await bytes(Number(lit[1])) });
      else items.push({ line: l });
    }
  }
  return { line, until };
}

export function parseUidValidity(items) {
  for (const { line } of items) {
    const m = /\[UIDVALIDITY (\d+)\]/i.exec(line);
    if (m) return Number(m[1]);
  }
  throw new AdapterError("schema", "IMAP: SELECT sem UIDVALIDITY.");
}
export function parseSearch(items, fromUid) {
  const uids = [];
  for (const { line } of items) if (/^\* SEARCH\b/i.test(line)) uids.push(...line.split(/\s+/).slice(2).map(Number).filter(Number.isInteger));
  // "UID n:*" devolve a última mensagem mesmo quando n passa do maior UID: filtrar.
  return [...new Set(uids)].filter((u) => u >= fromUid).sort((a, b) => a - b);
}
export function parseFetch(items) {
  const out = [];
  for (const it of items) {
    const m = /^\* \d+ FETCH \(.*UID (\d+)/i.exec(it.line);
    if (m && it.literal) out.push({ uid: Number(m[1]), bytes: it.literal });
  }
  return out;
}

export function imapClient(env) {
  return {
    async fetchNew(mailbox, lastUid, max = 20) {
      if (!env.MAILBOX_USER || !env.MAILBOX_PASSWORD) throw new AdapterError("auth", "IMAP: credenciais da caixa não configuradas.");
      const { connect } = await import("cloudflare:sockets");
      const socket = connect({ hostname: env.IMAP_HOST || "imap.hostinger.com", port: Number(env.IMAP_PORT || 993) }, { secureTransport: "on", allowHalfOpen: false });
      const writer = socket.writable.getWriter();
      const enc = new TextEncoder();
      const reader = responseReader(socket.readable);
      let n = 0;
      const cmd = async (text) => {
        const tag = `A${++n}`;
        await writer.write(enc.encode(`${tag} ${text}\r\n`));
        return reader.until(tag);
      };
      try {
        await reader.line(); // saudação
        await cmd(`LOGIN ${quote(env.MAILBOX_USER)} ${quote(env.MAILBOX_PASSWORD)}`);
        const uidValidity = parseUidValidity(await cmd(`EXAMINE ${quote(mailbox)}`)); // somente leitura
        const uids = parseSearch(await cmd(`UID SEARCH UID ${lastUid + 1}:*`), lastUid + 1).slice(0, max);
        const messages = [];
        for (const uid of uids) messages.push(...parseFetch(await cmd(`UID FETCH ${uid} (UID BODY.PEEK[]<0.${PARTIAL_BYTES}>)`)));
        await cmd("LOGOUT").catch(() => {});
        return { uidValidity, messages };
      } catch (e) {
        if (e instanceof AdapterError) throw e;
        throw new AdapterError("temporary", "IMAP: falha de conexão ou leitura.");
      } finally {
        try {
          await socket.close();
        } catch {}
      }
    },
  };
}
