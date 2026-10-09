// Ponte de e-mail (2026-09-30; docs/implementation/PONTE-EMAIL-PROPOSTA.md). O Worker não alcança SMTP/IMAP da Hostinger
// (IPs da Cloudflare); um processo fora da Cloudflare (bridge/) transporta. A ponte não decide nada: o claim roda o mesmo
// caminho do tick (verificações pré-envio, rampa, intervalo, janela, lease, hash aprovado) e só entrega a mensagem
// congelada; respostas voltam para o processMessage de sempre; sem leitura recente da caixa, nada sai.
// Autenticação: token de serviço do Cloudflare Access (common_name = BRIDGE_ACCESS_CLIENT_ID) emitido pela aplicação do
// Access só de /api/bridge (audiência BRIDGE_ACCESS_AUD, regra Service Auth só para esse token) + assinatura HMAC-SHA256 do
// corpo com carimbo de tempo e nonce de uso único. Só as rotas /api/bridge/* aceitam essa identidade.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { redactAddresses } from "./erasure.js";
import { fail, response } from "./http.js";
import { accessConfig, localAuthAllowed } from "./auth.js";
import { statement as s, now, auditStatement } from "./store.js";
import { reserveForBridge, settleFromBridge, readerHealthy } from "./sending.js";
import { processMessage, recordReaderOk, recordReaderError } from "./inbound.js";
import { messageHash } from "./fichas.js";
import { claimCopy, settleCopy, copyConfig } from "./internal-copy.js";
import { parameters } from "./store.js";

const allowedLocally = (list, address) => Array.isArray(list) && list.some((x) => String(x).trim().toLowerCase() === address);

const MAX_BODY = 8 * 1024 * 1024; // mensagem recebida em base64 (limite de 5 MB por mensagem)
const MAX_MESSAGE = 5 * 1024 * 1024;
const CLOCK_SKEW_MS = 5 * 60000;
const keysets = new Map();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256hex = async (text) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

export async function signature(keyB64, method, path, ts, nonce, body) {
  // Tolera espaço, quebra de linha e BOM em volta da chave (valor gravado por ferramentas de linha de comando).
  // Chave em hexadecimal (64 caracteres, formato gerado por configurar-chave-compass.ps1) ou base64 (testes).
  const k = String(keyB64).replace(/[\s﻿]/g, "");
  const raw = /^[0-9a-f]{64}$/i.test(k) ? Uint8Array.from(k.match(/../g), (h) => parseInt(h, 16)) : Uint8Array.from(atob(k), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${method}\n${path}\n${ts}\n${nonce}\n${await sha256hex(body)}`)));
}

function equalHex(a, b) {
  if (typeof a !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function verifyServiceToken(request, env) {
  if (localAuthAllowed(request, env)) return;
  const config = accessConfig(env);
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!env.BRIDGE_ACCESS_CLIENT_ID || !env.BRIDGE_ACCESS_AUD) fail(503, "bridge_not_configured", "Ponte de e-mail não configurada.");
  if (!token) fail(401, "bridge_auth_required", "Token de serviço da ponte obrigatório.");
  if (!keysets.has(config.issuer))
    keysets.set(config.issuer, createRemoteJWKSet(new URL(`${config.issuer}/cdn-cgi/access/certs`), { timeoutDuration: 5000, cooldownDuration: 30000 }));
  try {
    const { payload } = await jwtVerify(token, keysets.get(config.issuer), {
      issuer: config.issuer, audience: env.BRIDGE_ACCESS_AUD, algorithms: ["RS256"], requiredClaims: ["exp", "iat", "common_name"], clockTolerance: 5,
    });
    if (payload.common_name !== env.BRIDGE_ACCESS_CLIENT_ID) throw new Error("wrong service token");
  } catch {
    fail(403, "bridge_forbidden", "Token de serviço inválido para a ponte.");
  }
}

// Autentica a chamada e devolve o corpo já lido (a assinatura cobre o corpo exato).
async function authenticate(request, env, path) {
  if (!env.BRIDGE_HMAC_KEY) fail(503, "bridge_not_configured", "Ponte de e-mail não configurada.");
  await verifyServiceToken(request, env);
  const body = await request.text();
  if (body.length > MAX_BODY) fail(413, "payload_too_large", "Corpo grande demais.");
  const ts = request.headers.get("x-bridge-timestamp"),
    nonce = request.headers.get("x-bridge-nonce"),
    sig = request.headers.get("x-bridge-signature");
  if (!ts || !nonce || !sig || !/^[A-Za-z0-9-]{16,80}$/.test(nonce)) fail(401, "bridge_signature_required", "Assinatura da ponte ausente.");
  if (Math.abs(Date.now() - Number(ts)) > CLOCK_SKEW_MS) fail(401, "bridge_clock_skew", "Carimbo de tempo fora da janela.");
  let expected;
  try {
    expected = await signature(env.BRIDGE_HMAC_KEY, request.method, path, ts, nonce, body);
  } catch {
    // Diagnóstico sem o valor: comprimento e tipos de caractere presentes.
    const k = String(env.BRIDGE_HMAC_KEY);
    const kinds = [[/[A-Za-z0-9]/, "alfanum"], [/[+/=]/, "base64"], [/\s/, "espaco"], [/[^\x20-\x7e]/, "nao-ascii"], [/[^A-Za-z0-9+/=\s]/, "outros"]].filter(([r]) => r.test(k)).map(([, n]) => n);
    fail(503, "bridge_not_configured", `Chave da ponte inválida no Compass (BRIDGE_HMAC_KEY; comprimento ${k.length}; ${kinds.join(",")}).`);
  }
  if (!equalHex(sig, expected)) fail(403, "bridge_bad_signature", "Assinatura inválida.");
  const at = now();
  await s(env, "DELETE FROM bridge_nonces WHERE seen_at<?", new Date(Date.now() - 86400000).toISOString()).run();
  const fresh = await s(env, "INSERT INTO bridge_nonces(nonce,seen_at) VALUES (?,?) ON CONFLICT(nonce) DO NOTHING", nonce, at).run();
  if (!fresh.meta.changes) fail(409, "bridge_replay", "Chamada repetida.");
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    fail(400, "invalid_json", "JSON inválido.");
  }
}

const bridgeActor = (tenant) => ({ id: "system-bridge", tenant_id: tenant, role: "system" });
const OUTCOMES = new Set(["accepted", "temporary", "permanent", "indeterminate"]);

export async function handleBridge(request, env, path, rid) {
  if (request.method !== "POST") fail(405, "method_not_allowed", "Método não permitido.");
  const tenant = env.DEFAULT_TENANT_ID;
  const input = await authenticate(request, env, path);
  const actor = bridgeActor(tenant);
  const at = now();

  if (path === "/api/bridge/claim") {
    // D5-a: com a cópia interna ligada, a ponte precisa declarar o endereço na lista local; sem isso nada é reservado
    // (falha fechada: nenhum passo sai sem a cópia exigida pelo contrato).
    const copyCfg = copyConfig(await parameters(env, tenant));
    if (copyCfg.enabled && !allowedLocally(input.copyAllow, copyCfg.address)) return response({ message: null, reason: "copy_target_not_allowed" });
    const next = await reserveForBridge(env, tenant, at);
    if (next.reason) return response({ message: null, reason: next.reason });
    await auditStatement(env, actor, rid, "bridge.claimed", "send_outbox", next.row.id, { leaseToken: next.token }).run();
    return response({
      message: {
        outboxId: next.row.id, leaseToken: next.token, leaseUntil: next.leaseUntil, messageId: next.messageId,
        from: { name: env.SENDER_NAME || "EAG Agro - Brasil", address: env.MAILBOX_USER }, replyTo: env.MAILBOX_USER, to: next.email,
        subject: next.msg.subject, text: next.msg.body, html: next.msg.html, headers: next.headers, sha256: next.row.message_sha256,
      },
    });
  }

  if (path === "/api/bridge/result") {
    const outboxId = String(input.outboxId || ""),
      token = Number(input.leaseToken);
    if (!outboxId || !Number.isInteger(token) || !OUTCOMES.has(input.outcome)) fail(422, "invalid_result", "Resultado inválido.");
    const detail = input.smtp ? redactAddresses(`${input.smtp.code ?? ""} ${String(input.smtp.text ?? "").slice(0, 160)}`.trim()) : input.evidence ? String(input.evidence).slice(0, 200) : null;
    // Integridade: o que saiu tem de ser exatamente o aprovado; divergência para o remetente.
    const row = await s(env, "SELECT message_sha256 FROM send_outbox WHERE tenant_id=? AND id=?", tenant, outboxId).first();
    if (row && input.outcome === "accepted" && input.sentSha256 !== row.message_sha256) {
      await env.DB.batch([
        s(env, "UPDATE sender_state SET stopped_at=?,stopped_reason='ponte enviou conteúdo diferente do aprovado' WHERE tenant_id=? AND stopped_at IS NULL", at, tenant),
        auditStatement(env, actor, rid, "bridge.hash_mismatch", "send_outbox", outboxId, {}),
      ]);
    }
    const r = await settleFromBridge(env, tenant, outboxId, token, { kind: input.outcome, detail }, at);
    await auditStatement(env, actor, rid, "bridge.result", "send_outbox", outboxId, { outcome: input.outcome, status: r.status, recovered: !!r.recovered }).run();
    if (r.status !== 200) fail(r.status, r.code, "Resultado não aplicado.", { current: r.current ?? null });
    return response(r);
  }

  // Cópia interna D5-a: trabalho separado do passo do prospect (src/internal-copy.js). Só sai depois do aceite do passo.
  if (path === "/api/bridge/copy-claim") {
    const copyCfg = copyConfig(await parameters(env, tenant));
    if (copyCfg.enabled && !allowedLocally(input.copyAllow, copyCfg.address)) return response({ copy: null, reason: "copy_target_not_allowed" });
    const next = await claimCopy(env, tenant, at);
    if (next.reason) return response({ copy: null, reason: next.reason });
    await auditStatement(env, actor, rid, "bridge.copy_claimed", "send_copy", next.copy.outboxId, { leaseToken: next.copy.leaseToken }).run();
    return response({ copy: { ...next.copy, from: { name: env.SENDER_NAME || "EAG Agro - Brasil", address: env.MAILBOX_USER }, replyTo: env.MAILBOX_USER } });
  }

  if (path === "/api/bridge/copy-result") {
    const r = await settleCopy(env, tenant, input, at);
    await auditStatement(env, actor, rid, "bridge.copy_result", "send_copy", String(input.outboxId || ""), { outcome: input.outcome ?? null, status: r.status, recovered: !!r.recovered }).run();
    if (r.status !== 200) fail(r.status, r.code, "Resultado da cópia não aplicado.", { current: r.current ?? null });
    return response(r);
  }

  if (path === "/api/bridge/cursor") {
    const mailbox = "INBOX";
    await s(env, "INSERT OR IGNORE INTO inbound_cursor(tenant_id,mailbox,uidvalidity,last_uid) VALUES (?,?,0,0)", tenant, mailbox).run();
    const c = await s(env, "SELECT uidvalidity,last_uid,updated_at FROM inbound_cursor WHERE tenant_id=? AND mailbox=?", tenant, mailbox).first();
    return response({ mailbox, uidValidity: c.uidvalidity, lastUid: c.last_uid, updatedAt: c.updated_at });
  }

  if (path === "/api/bridge/rebase") {
    // Primeira leitura (cursor nunca iniciado) ou caixa renumerada (UIDVALIDITY nova): o cursor passa para a posição atual
    // da caixa ANTES de a ponte registrar as mensagens recentes. Só com UIDVALIDITY diferente da registrada.
    const uidValidity = Number(input.uidValidity),
      top = Number(input.highestUid);
    if (!Number.isInteger(uidValidity) || uidValidity < 1 || !Number.isInteger(top) || top < 0) fail(422, "invalid_rebase", "Posição inválida.");
    await s(env, "INSERT OR IGNORE INTO inbound_cursor(tenant_id,mailbox,uidvalidity,last_uid) VALUES (?,'INBOX',0,0)", tenant).run();
    const r = await s(env, "UPDATE inbound_cursor SET uidvalidity=?,last_uid=?,updated_at=? WHERE tenant_id=? AND mailbox='INBOX' AND uidvalidity<>?", uidValidity, top, at, tenant, uidValidity).run();
    if (!r.meta.changes) fail(409, "rebase_not_needed", "A caixa não foi renumerada.");
    await auditStatement(env, actor, rid, "bridge.cursor_rebased", "mailbox", "INBOX", { uidValidity, top }).run();
    return response({ uidValidity, lastUid: top });
  }

  if (path === "/api/bridge/inbound") {
    const uid = Number(input.uid),
      uidValidity = Number(input.uidValidity);
    if (input.mailbox !== "INBOX" || !Number.isInteger(uid) || uid < 1 || !Number.isInteger(uidValidity) || typeof input.raw !== "string")
      fail(422, "invalid_inbound", "Mensagem inválida.");
    const bytes = Uint8Array.from(atob(input.raw), (ch) => ch.charCodeAt(0));
    if (bytes.length > MAX_MESSAGE) fail(413, "message_too_large", "Mensagem acima de 5 MB.");
    // Mensagem de outra numeração da caixa só entra depois do rebase (evita recomeçar o cursor sem controle).
    const cur = await s(env, "SELECT uidvalidity FROM inbound_cursor WHERE tenant_id=? AND mailbox='INBOX'", tenant).first();
    if (!cur || cur.uidvalidity !== uidValidity) fail(409, "rebase_required", "Numeração da caixa diferente da registrada.");
    const r = await processMessage(env, tenant, { mailbox: "INBOX", uidValidity, uid, bytes }, at);
    await s(env, "UPDATE inbound_cursor SET last_uid=MAX(last_uid,?),updated_at=? WHERE tenant_id=? AND mailbox='INBOX' AND uidvalidity=?", uid, at, tenant, uidValidity).run();
    return response({ uid, duplicate: !!r.duplicate, classification: r.classification ?? null });
  }

  if (path === "/api/bridge/lockdown") {
    // Trava de segurança local (prazo do teste interno, encerramento sem sessão): só DESLIGA o canal de e-mail (volta a
    // "planned"); nunca liga. Tudo o que estava na fila fica parado pelo pré-envio (channel_not_enabled).
    const prev = await s(env, "SELECT state FROM channels WHERE tenant_id=? AND channel='email'", tenant).first();
    await env.DB.batch([
      s(env, "UPDATE channels SET state='planned',evidence_ref=?,changed_by=?,changed_at=? WHERE tenant_id=? AND channel='email' AND state<>'planned'", String(input.reason ?? "trava da ponte").slice(0, 200), actor.id, at, tenant),
      auditStatement(env, actor, rid, "bridge.lockdown", "channel", "email", { from: prev?.state ?? null, reason: String(input.reason ?? "").slice(0, 120) }),
    ]);
    return response({ channel: "email", previous: prev?.state ?? null, state: "planned" });
  }

  if (path === "/api/bridge/read-status") {
    // A ponte informa o fim de um ciclo de leitura. "ok" só vale se o cursor do Compass já chegou ao maior UID lido.
    if (input.ok === true) {
      const c = await s(env, "SELECT uidvalidity,last_uid FROM inbound_cursor WHERE tenant_id=? AND mailbox='INBOX'", tenant).first();
      const highest = Number(input.highestUid ?? 0);
      if (!c || Number(input.uidValidity) !== c.uidvalidity || c.last_uid < highest) fail(409, "cursor_behind", "Há mensagens lidas ainda não registradas no Compass.");
      const was = await readerHealthy(env, tenant, at);
      await recordReaderOk(env, tenant, at, "bridge", String(input.version ?? "").slice(0, 40));
      if (!was) await auditStatement(env, actor, rid, "bridge.reader_ok", "mailbox", "INBOX", {}).run();
      return response({ ok: true });
    }
    await recordReaderError(env, tenant, at, String(input.error ?? "erro sem detalhe").slice(0, 200));
    await auditStatement(env, actor, rid, "bridge.reader_error", "mailbox", "INBOX", { error: String(input.error ?? "").slice(0, 80) }).run();
    return response({ ok: false, sendingSuspended: !(await readerHealthy(env, tenant, at)) });
  }

  fail(404, "not_found", "Rota não encontrada.");
}

// Para os testes e a ponte: o hash que a ponte calcula do que enviou é o mesmo do congelamento da ficha.
export { messageHash };
