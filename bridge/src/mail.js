// SMTP e IMAP da Hostinger, com TLS verificado. A mensagem MIME é montada uma vez e a MESMA sequência de bytes vai
// para o SMTP e para a pasta de enviados (prova para a conferência de duplicidade).
import { createHash } from "node:crypto";
import SMTPConnection from "nodemailer/lib/smtp-connection";
import MailComposer from "nodemailer/lib/mail-composer";
import { ImapFlow } from "imapflow";

// Mesmo hash do congelamento da ficha (src/fichas.js, messageHash): assunto + texto (+ HTML).
export const messageHash = (subject, body, html = null) =>
  createHash("sha256").update(html ? `${subject ?? ""}\n\n${body}\n\n--html--\n${html}` : `${subject ?? ""}\n\n${body}`, "utf8").digest("hex");

export async function buildRaw(m) {
  const node = new MailComposer({
    from: { name: m.from.name, address: m.from.address },
    to: m.to,
    replyTo: m.replyTo,
    subject: m.subject,
    text: m.text,
    ...(m.html ? { html: m.html } : {}),
    messageId: m.messageId,
    headers: { "List-Unsubscribe": m.headers["List-Unsubscribe"], "List-Unsubscribe-Post": m.headers["List-Unsubscribe-Post"] },
  }).compile();
  return { raw: await node.build(), envelope: node.getEnvelope() };
}

// Classificação conservadora. Conexão, TLS e login falham antes de qualquer mensagem sair: temporário (não enviado).
// Na fase de envio, só uma resposta explícita do servidor decide; qualquer falha sem resposta é "indeterminado"
// (o servidor pode ter aceitado) e nunca é reenviada sem decisão de Rogério.
export function classifySendError(err) {
  const code = Number(err?.responseCode) || null;
  const text = String(err?.response ?? err?.message ?? "").replace(/\s+/g, " ").slice(0, 160);
  if (!code) return { kind: "indeterminate", code: null, text };
  if (code >= 500) return { kind: "permanent", code, text };
  return { kind: "temporary", code, text };
}

const cb = (fn) => new Promise((resolve, reject) => fn((err, v) => (err ? reject(err) : resolve(v))));

export function smtpClient({ host, port, user, pass, Connection = SMTPConnection }) {
  const secure = Number(port) === 465;
  const options = {
    host, port: Number(port), secure, requireTLS: !secure, connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 60000,
    tls: { rejectUnauthorized: true, servername: host, minVersion: "TLSv1.2" },
  };
  return {
    // Diagnóstico: conecta e autentica, sem enviar nada.
    async check() {
      const conn = new Connection(options);
      conn.on("error", () => {});
      try {
        await cb((done) => conn.connect(done));
        await cb((done) => conn.login({ user, pass }, done));
        return { ok: true };
      } finally {
        try {
          conn.quit();
        } catch {
          conn.close();
        }
      }
    },
    async send(raw, envelope) {
      const conn = new Connection(options);
      conn.on("error", () => {}); // erros chegam pelos callbacks
      try {
        await cb((done) => conn.connect(done));
        await cb((done) => conn.login({ user, pass }, done));
      } catch (err) {
        conn.close();
        const code = Number(err?.responseCode) || null;
        return { kind: "temporary", code, text: String(err?.response ?? err?.message ?? "").slice(0, 160), stop: code === 535 || err?.code === "EAUTH" ? "auth" : null };
      }
      try {
        const info = await cb((done) => conn.send(envelope, raw, done));
        if (info.rejected?.length) return { kind: "permanent", code: null, text: "destinatário recusado" };
        return { kind: "accepted", code: Number(String(info.response ?? "").slice(0, 3)) || 250, text: String(info.response ?? "").slice(0, 160) };
      } catch (err) {
        return classifySendError(err);
      } finally {
        try {
          conn.quit();
        } catch {
          conn.close();
        }
      }
    },
  };
}

export function imapClient({ host, port, user, pass, ImapClass = ImapFlow }) {
  const open = async () => {
    const c = new ImapClass({ host, port: Number(port), secure: true, auth: { user, pass }, logger: false, tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" } });
    // Sem ouvinte, um 'error' emitido (ex.: ECONNRESET no AUTHENTICATE) derruba o processo da ponte (06/10/2026).
    // Os erros já chegam pelas promessas rejeitadas, que o ciclo registra como read_failed.
    c.on("error", () => {});
    await c.connect();
    return c;
  };
  const sentPath = async (c) => (await c.list()).find((b) => b.specialUse === "\\Sent")?.path ?? "INBOX.Sent";
  return {
    // Mensagens novas da INBOX a partir do cursor do Compass.
    // Primeira leitura (cursor nunca iniciado): só marca a posição atual — o histórico da caixa não vai para o Compass.
    // UIDVALIDITY nova (caixa renumerada): lê só as mensagens dos 2 dias anteriores à última leitura registrada.
    async fetchNew(cursor) {
      const c = await open();
      try {
        const lock = await c.getMailboxLock("INBOX");
        try {
          const uidValidity = Number(c.mailbox.uidValidity);
          const top = Number(c.mailbox.uidNext) - 1;
          if (!cursor.uidValidity) return { uidValidity, messages: [], highestUid: top, baseline: true };
          const messages = [];
          if (uidValidity !== cursor.uidValidity) {
            const since = new Date(Date.parse(cursor.updatedAt || new Date().toISOString()) - 2 * 86400000);
            const uids = (await c.search({ since }, { uid: true })) || [];
            if (uids.length) for await (const m of c.fetch(uids, { uid: true, source: true }, { uid: true })) messages.push({ uid: m.uid, raw: m.source });
            messages.sort((a, b) => a.uid - b.uid);
            return { uidValidity, messages, highestUid: top, baseline: true };
          }
          const from = cursor.lastUid;
          if (c.mailbox.exists > 0 && top > from)
            for await (const m of c.fetch(`${from + 1}:*`, { uid: true, source: true }, { uid: true }))
              if (m.uid > from) messages.push({ uid: m.uid, raw: m.source });
          messages.sort((a, b) => a.uid - b.uid);
          return { uidValidity, messages, highestUid: messages.length ? messages[messages.length - 1].uid : from };
        } finally {
          lock.release();
        }
      } finally {
        await c.logout().catch(() => {});
      }
    },
    // Diagnóstico: só o estado da INBOX (sem baixar mensagens).
    async status() {
      const c = await open();
      try {
        const st = await c.status("INBOX", { messages: true, uidValidity: true });
        return { messages: st.messages, uidValidity: Number(st.uidValidity) };
      } finally {
        await c.logout().catch(() => {});
      }
    },
    async appendSent(raw) {
      const c = await open();
      try {
        await c.append(await sentPath(c), raw, ["\\Seen"]);
      } finally {
        await c.logout().catch(() => {});
      }
    },
    async sentHasMessageId(messageId) {
      const c = await open();
      try {
        const lock = await c.getMailboxLock(await sentPath(c));
        try {
          const uids = await c.search({ header: { "message-id": messageId } }, { uid: true });
          return Array.isArray(uids) && uids.length > 0;
        } finally {
          lock.release();
        }
      } finally {
        await c.logout().catch(() => {});
      }
    },
  };
}
