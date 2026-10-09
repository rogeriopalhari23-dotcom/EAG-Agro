// Cópia interna D5-a (decisão de Rogério, 2026-10-09; contrato de franquia: cópia das comunicações com clientes ao e-mail
// de vendas da EAG). A cópia é uma mensagem separada, criada só quando o passo do prospect é ACEITO pelo SMTP:
//  - destinatário fixo vem do parâmetro email_copy_to:email (só Administrador, com motivo); a ponte confere contra a lista
//    local e não envia a cópia se o endereço divergir;
//  - o conteúdo é o texto aprovado, com o link de descadastro do prospect trocado por um aviso e sem List-Unsubscribe:
//    um clique na caixa de vendas nunca suprime o prospect;
//  - Message-ID determinístico por passo: na recuperação a ponte procura a cópia nos enviados antes de reenviar;
//  - resultado incerto fica "indeterminate" e não volta à fila sem decisão; falha da cópia nunca toca o passo do prospect.
import { statement as s, parameters, now } from "./store.js";
import { decryptPii } from "./crypto.js";
import { approvedMessage } from "./sending.js";
import { unsubUrl } from "./unsub-token.js";
import { redactAddresses } from "./erasure.js";

export const COPY_LEASE_MS = 5 * 60000;
export const COPY_MAX_TEMP_ATTEMPTS = 3;
export const UNSUB_PLACEHOLDER = "[link de descadastro do destinatário omitido na cópia]";
const OUTCOMES = new Set(["accepted", "temporary", "permanent", "indeterminate"]);

export function copyConfig(params) {
  const v = params["email_copy_to:email"];
  return v?.enabled === true && v.address ? { enabled: true, address: v.address, contractRef: v.contractRef } : { enabled: false };
}

export const copyMessageId = (env, outboxId) => `<copia-${outboxId}@${String(env.MAILBOX_USER || "eagagro.com").split("@").pop()}>`;

// Linha de cópia para um passo aceito (vai no mesmo batch do aceite). Sem configuração vigente, nenhuma cópia.
export async function copyOnAccept(env, row, at) {
  const cfg = copyConfig(await parameters(env, row.tenant_id));
  if (!cfg.enabled || row.channel !== "email") return [];
  return [
    s(
      env,
      "INSERT INTO send_copies(outbox_id,tenant_id,to_address,copy_message_id,status,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?) ON CONFLICT(outbox_id) DO NOTHING",
      row.id, row.tenant_id, cfg.address, copyMessageId(env, row.id), at, at,
    ),
  ];
}

const replaceAll = (text, from, to) => (text == null ? text : text.split(from).join(to));

// Cópia montada a partir do texto aprovado do passo (mesmo conteúdo que saiu), sem o link de descadastro do prospect.
export async function buildCopy(env, outbox, copy) {
  const msg = await approvedMessage(env, outbox);
  if (!msg) return null;
  const link = await unsubUrl(env, msg.versionId, outbox.contact_id);
  const to = await decryptPii((await s(env, "SELECT email_encrypted FROM contacts WHERE id=?", outbox.contact_id).first())?.email_encrypted, env);
  const intro = `Cópia interna (contrato de franquia) do e-mail enviado em ${String(outbox.accepted_at).slice(0, 16).replace("T", " ")} UTC a ${to ?? "[destinatário excluído]"} — passo ${outbox.step_no}. O link de descadastro do destinatário foi omitido.`;
  const text = `${intro}\n\n${replaceAll(msg.body, link, UNSUB_PLACEHOLDER)}`;
  const html = msg.html ? `<p>${intro.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>${replaceAll(msg.html, link, UNSUB_PLACEHOLDER)}` : null;
  // Garantia: nenhum vestígio do link do prospect na cópia.
  if (text.includes(link) || (html && html.includes(link))) return null;
  return { subject: `[Cópia] ${msg.subject}`, text, html, copyOf: outbox.message_id, messageId: copy.copy_message_id, to: copy.to_address };
}

async function expireCopyLeases(env, tenant, at) {
  await s(
    env,
    "UPDATE send_copies SET status='indeterminate',evidence='execução interrompida durante o envio da cópia (lease vencido)',lease_until=NULL,updated_at=? WHERE tenant_id=? AND status='leased' AND lease_until<?",
    at, tenant, at,
  ).run();
}

// Próxima cópia para a ponte. Configuração desligada ou endereço diferente do registrado na cópia: nada sai.
export async function claimCopy(env, tenant, at = now()) {
  await expireCopyLeases(env, tenant, at);
  const cfg = copyConfig(await parameters(env, tenant));
  const row = await s(
    env,
    "SELECT * FROM send_copies WHERE tenant_id=? AND status IN ('pending','temp_failed') AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY created_at LIMIT 1",
    tenant, at,
  ).first();
  if (!row) return { reason: "nothing_due" };
  if (!cfg.enabled) return { reason: "copy_disabled" };
  if (cfg.address !== row.to_address) return { reason: "copy_address_changed" };
  const outbox = await s(env, "SELECT * FROM send_outbox WHERE id=?", row.outbox_id).first();
  if (outbox?.status !== "accepted") return { reason: "step_not_accepted" };
  const content = await buildCopy(env, outbox, row);
  if (!content) {
    await s(env, "UPDATE send_copies SET status='permanent_failed',evidence='conteúdo aprovado indisponível ou divergente',updated_at=? WHERE outbox_id=? AND status IN ('pending','temp_failed')", at, row.outbox_id).run();
    return { reason: "content_unavailable" };
  }
  const leaseUntil = new Date(Date.parse(at) + COPY_LEASE_MS).toISOString();
  const took = await s(
    env,
    "UPDATE send_copies SET status='leased',lease_token=lease_token+1,lease_until=?,attempts=attempts+1,updated_at=? WHERE outbox_id=? AND status IN ('pending','temp_failed')",
    leaseUntil, at, row.outbox_id,
  ).run();
  if (!took.meta.changes) return { reason: "busy" };
  const token = (await s(env, "SELECT lease_token FROM send_copies WHERE outbox_id=?", row.outbox_id).first()).lease_token;
  return { copy: { outboxId: row.outbox_id, leaseToken: token, leaseUntil, ...content } };
}

// Resultado da cópia informado pela ponte. Idempotente; nunca altera o passo do prospect.
export async function settleCopy(env, tenant, input, at = now()) {
  const outboxId = String(input.outboxId || ""),
    token = Number(input.leaseToken);
  if (!outboxId || !Number.isInteger(token) || !OUTCOMES.has(input.outcome)) return { status: 422, code: "invalid_result" };
  const row = await s(env, "SELECT * FROM send_copies WHERE tenant_id=? AND outbox_id=?", tenant, outboxId).first();
  if (!row) return { status: 404, code: "copy_not_found" };
  if (row.lease_token !== token) return { status: 409, code: "lease_mismatch" };
  const evidence = input.evidence ? redactAddresses(String(input.evidence)).slice(0, 200) : null;
  const target = { accepted: "accepted", temporary: "temp_failed", permanent: "permanent_failed", indeterminate: "indeterminate" }[input.outcome];
  if (row.status === target) return { status: 200, outcome: input.outcome, idempotent: true };
  // Lease vencido (indeterminado) só fecha como aceito, com a prova da ponte (Message-ID nos enviados).
  if (row.status === "indeterminate" && input.outcome === "accepted") {
    await s(env, "UPDATE send_copies SET status='accepted',accepted_at=?,evidence=?,updated_at=? WHERE outbox_id=? AND status='indeterminate' AND lease_token=?", at, evidence, at, outboxId, token).run();
    return { status: 200, outcome: "accepted", recovered: true };
  }
  if (row.status !== "leased") return { status: 409, code: "not_in_flight", current: row.status };
  const fence = "outbox_id=? AND status='leased' AND lease_token=?";
  if (input.outcome === "accepted")
    await s(env, `UPDATE send_copies SET status='accepted',accepted_at=?,lease_until=NULL,evidence=?,updated_at=? WHERE ${fence}`, at, evidence, at, outboxId, token).run();
  else if (input.outcome === "temporary") {
    const final = row.attempts >= COPY_MAX_TEMP_ATTEMPTS;
    await s(
      env,
      `UPDATE send_copies SET status=?,next_attempt_at=?,lease_until=NULL,evidence=?,updated_at=? WHERE ${fence}`,
      final ? "permanent_failed" : "temp_failed", new Date(Date.parse(at) + 3600000).toISOString(), evidence, at, outboxId, token,
    ).run();
  } else
    await s(env, `UPDATE send_copies SET status=?,lease_until=NULL,evidence=?,updated_at=? WHERE ${fence}`, target, evidence, at, outboxId, token).run();
  return { status: 200, outcome: input.outcome };
}

// Situação das cópias (painel): só contagens e estado por passo; o endereço é o do parâmetro.
export async function copiesFor(env, tenant, outboxIds) {
  if (!outboxIds.length) return new Map();
  const rows = (
    await s(env, `SELECT outbox_id,status,evidence,accepted_at,attempts FROM send_copies WHERE tenant_id=? AND outbox_id IN (${outboxIds.map(() => "?").join(",")})`, tenant, ...outboxIds).all()
  ).results;
  return new Map(rows.map((r) => [r.outbox_id, r]));
}

export async function copyProblems(env, tenant) {
  return (await s(env, "SELECT COUNT(*) n FROM send_copies WHERE tenant_id=? AND status IN ('permanent_failed','indeterminate')", tenant).first())?.n ?? 0;
}
