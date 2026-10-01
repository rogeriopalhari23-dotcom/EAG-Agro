// Teste interno da ponte contra o Compass de produção (2026-09-30): chamadas assinadas com as credenciais da ponte, para
// os cenários que não enviam e-mail. Nunca imprime segredo, corpo de mensagem ou endereço.
// Uso (pelo iniciador, que carrega as credenciais): iniciar-ponte.ps1 -TesteInterno <claim|seguranca>
import { randomUUID } from "node:crypto";
import { compassClient, signature } from "../src/compass.js";

const env = process.env;
const base = env.COMPASS_URL;
const compass = compassClient({ baseUrl: base, hmacKey: env.BRIDGE_HMAC_KEY, accessClientId: env.ACCESS_CLIENT_ID, accessClientSecret: env.ACCESS_CLIENT_SECRET });
const out = (o) => console.log(JSON.stringify({ at: new Date().toISOString(), ...o }));
const modo = process.argv[2];

async function raw(path, { headers = {}, body = "{}", sign = true, key = env.BRIDGE_HMAC_KEY, nonce = randomUUID(), ts = String(Date.now()), bodyForSig = body, access = true } = {}) {
  const h = { "content-type": "application/json", ...headers };
  if (access) Object.assign(h, { "CF-Access-Client-Id": env.ACCESS_CLIENT_ID, "CF-Access-Client-Secret": env.ACCESS_CLIENT_SECRET });
  if (sign) Object.assign(h, { "x-bridge-timestamp": ts, "x-bridge-nonce": nonce, "x-bridge-signature": signature(key, "POST", path, ts, nonce, bodyForSig) });
  const r = await fetch(base + path, { method: "POST", headers: h, body, redirect: "manual" });
  const t = await r.text();
  let code = null;
  try {
    code = JSON.parse(t)?.error?.code ?? "ok";
  } catch {
    code = "resposta do Access (não JSON)";
  }
  return { status: r.status, code };
}

if (modo === "claim") {
  // Pede um passo como a ponte faria (sem enviar nada): mostra só o motivo ou que haveria mensagem.
  const r = await compass.call("/api/bridge/claim");
  out({ cenario: "claim", mensagem: !!r.message, motivo: r.reason ?? null });
  if (r.message) {
    // Não deveria acontecer fora da janela; devolve o passo à fila sem enviar.
    await compass.call("/api/bridge/result", { outboxId: r.message.outboxId, leaseToken: r.message.leaseToken, outcome: "temporary", evidence: "teste interno: reservado sem envio" });
    out({ aviso: "passo reservado e devolvido sem envio" });
  }
} else if (modo === "bloquear") {
  const r = await compass.call("/api/bridge/lockdown", { reason: process.argv[3] || "trava manual do teste interno" });
  out({ cenario: "trava", ...r });
} else if (modo === "seguranca") {
  const nonce = randomUUID(), ts = String(Date.now());
  const a = await raw("/api/bridge/cursor", { nonce, ts });
  const b = await raw("/api/bridge/cursor", { nonce, ts });
  out({ cenario: "chamada válida", ...a });
  out({ cenario: "mesma chamada repetida (mesmo nonce)", ...b });
  out({ cenario: "assinatura com chave errada", ...(await raw("/api/bridge/cursor", { key: "00".repeat(32) })) });
  out({ cenario: "corpo alterado depois de assinado", ...(await raw("/api/bridge/cursor", { body: '{"x":1}', bodyForSig: "{}" })) });
  out({ cenario: "carimbo de tempo de 10 minutos atrás", ...(await raw("/api/bridge/cursor", { ts: String(Date.now() - 600000) })) });
  out({ cenario: "sem assinatura", ...(await raw("/api/bridge/cursor", { sign: false })) });
  out({ cenario: "sem token do Access", ...(await raw("/api/bridge/cursor", { access: false })) });
} else if (modo === "cabecalhos") {
  // Somente leitura (2026-10-01): cabeçalhos técnicos das mensagens da INBOX numa faixa de UIDs, para conferir a
  // classificação de notificações automáticas. Não imprime corpo, assunto nem endereço (só o domínio do remetente).
  const { ImapFlow } = await import("imapflow");
  const faixa = process.argv[3] || "1430:1437";
  const nomes = ["from", "message-id", "in-reply-to", "auto-submitted", "precedence", "list-id", "list-unsubscribe", "feedback-id", "x-auto-response-suppress", "return-path"];
  const c = new ImapFlow({ host: env.IMAP_HOST || "imap.hostinger.com", port: Number(env.IMAP_PORT || 993), secure: true, auth: { user: env.MAILBOX_USER, pass: env.MAILBOX_PASSWORD }, logger: false, tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" } });
  await c.connect();
  const lock = await c.getMailboxLock("INBOX", { readOnly: true });
  try {
    for await (const m of c.fetch(faixa, { uid: true, headers: true }, { uid: true })) {
      const linhas = m.headers.toString("utf8").replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/);
      const h = {};
      for (const l of linhas) {
        const i = l.indexOf(":");
        if (i < 1) continue;
        const k = l.slice(0, i).trim().toLowerCase();
        if (nomes.includes(k) || k.startsWith("x-linkedin")) h[k] = l.slice(i + 1).trim();
      }
      const dominio = (v) => (/@([^>\s]+)/.exec(v || "")?.[1] || null);
      out({
        uid: m.uid,
        fromDomain: dominio(h.from),
        messageIdDomain: dominio(h["message-id"]),
        inReplyTo: !!h["in-reply-to"],
        autoSubmitted: h["auto-submitted"] ?? null,
        precedence: h.precedence ?? null,
        listId: h["list-id"] ? dominio(h["list-id"].replace(/^.*</, "<").replace(/</, "@")) || h["list-id"].slice(0, 60) : null,
        listUnsubscribe: !!h["list-unsubscribe"],
        feedbackId: !!h["feedback-id"],
        returnPathDomain: dominio(h["return-path"]),
        linkedin: Object.fromEntries(Object.entries(h).filter(([k]) => k.startsWith("x-linkedin")).map(([k, v]) => [k, v.slice(0, 40)])),
      });
    }
  } finally {
    lock.release();
    await c.logout();
  }
} else {
  console.log("Modos: claim | seguranca | bloquear | cabecalhos [faixa de UIDs]");
  process.exitCode = 2;
}
