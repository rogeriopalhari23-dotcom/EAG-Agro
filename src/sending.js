// Execução da sequência (P2-T10; R19.1–R19.13, R26.2–R26.3; errata itens 1–3).
// Um envio por execução, por remetente, com lease em D1; pré-envio completo; texto aprovado byte a byte;
// rampa e intervalo compartilhados; indeterminado nunca é reenviado sem resolução humana registrada.
import { fail, requireRole, str, bodyJson, oneOf } from "./http.js";
import { statement as s, parameters, now, commit, auditStatement } from "./store.js";
import { decryptPii } from "./crypto.js";
import { messageHash } from "./fichas.js";
import { restrictionsFor } from "./restrictions.js";
import { unsubUrl } from "./unsub-token.js";
import { smtpTransport } from "./adapters/mailbox.js";
import { localDate, localParts, inWindow, addDays } from "./timezone.js";

const LEASE_MS = 120000;
const SENDER_TZ = "America/Sao_Paulo";
const MAX_TEMP_ATTEMPTS = 3;
const ADMIN = new Set(["admin"]);

const log = (env, outboxId, event, detail, token = null) =>
  s(env, "INSERT INTO send_log(id,outbox_id,event,detail,lease_token) VALUES (?,?,?,?,?)", crypto.randomUUID(), outboxId, event, detail ?? null, token);

// Lease do remetente: garante um único executor por caixa, mesmo com cron sobreposto (Review Focus 3).
async function acquireSender(env, tenant, sender, owner, at) {
  await s(env, "INSERT OR IGNORE INTO sender_state(tenant_id,sender) VALUES (?,?)", tenant, sender).run();
  const until = new Date(Date.parse(at) + LEASE_MS).toISOString();
  const r = await s(
    env,
    "UPDATE sender_state SET lease_owner=?,lease_until=?,lease_token=lease_token+1 WHERE tenant_id=? AND sender=? AND (lease_until IS NULL OR lease_until<?)",
    owner, until, tenant, sender, at,
  ).run();
  if (!r.meta.changes) return null;
  return s(env, "SELECT * FROM sender_state WHERE tenant_id=? AND sender=?", tenant, sender).first();
}
const releaseSender = (env, tenant, sender, owner) =>
  s(env, "UPDATE sender_state SET lease_owner=NULL,lease_until=NULL WHERE tenant_id=? AND sender=? AND lease_owner=?", tenant, sender, owner).run();

// Passos com lease vencido já podem ter sido aceitos pelo SMTP: viram indeterminados, nunca pendentes.
async function expireLeases(env, tenant, at) {
  const rows = (await s(env, "SELECT id,lease_token FROM send_outbox WHERE tenant_id=? AND status='leased' AND lease_until<?", tenant, at).all()).results;
  if (!rows.length) return 0;
  await env.DB.batch(
    rows.flatMap((r) => [
      s(env, "UPDATE send_outbox SET status='indeterminate',block_reason='lease_expired',updated_at=? WHERE id=? AND status='leased' AND lease_token=?", at, r.id, r.lease_token),
      log(env, r.id, "lease_expired", "execução interrompida depois do início do envio", r.lease_token),
    ]),
  );
  return rows.length;
}

// R19.8: ao terminar a sequência anterior do mesmo e-mail, a seguinte sai da espera.
async function releaseWaiting(env, tenant, at) {
  await s(
    env,
    `UPDATE send_outbox SET status='pending',updated_at=? WHERE tenant_id=? AND status='waiting_sequence' AND NOT EXISTS (
       SELECT 1 FROM send_outbox o WHERE o.tenant_id=send_outbox.tenant_id AND o.email_hash=send_outbox.email_hash AND o.ficha_id<>send_outbox.ficha_id
       AND o.status IN ('pending','leased','temp_failed','indeterminate'))`,
    at, tenant,
  ).run();
}

// Itens do R19.2 por passo. Devolve { ok } ou { skip: motivo } (volta depois) ou { cancel/block: motivo } (definitivo).
export async function preSendCheck(env, row, ctx) {
  const reasons = await restrictionsFor(env, row.tenant_id, {
    companyId: row.company_id, campaignId: ctx.campaignId, commodity: row.commodity, emailHash: row.email_hash,
  });
  if (reasons.includes("suppressed")) return { cancel: "suppressed" }; // 1
  if (reasons.length) return { skip: reasons.join(",") }; // 2, 5, 6, OpenClaw
  const approval = await s(
    env,
    "SELECT a.status,a.version_id,f.current_version,v.version_no,v.superseded_at FROM ficha_approvals a JOIN ficha_versions v ON v.id=a.version_id JOIN fichas f ON f.id=v.ficha_id WHERE a.id=?",
    row.approval_id,
  ).first();
  if (!approval || approval.status !== "approved" || approval.superseded_at || approval.version_no !== approval.current_version)
    return { block: "approval_invalidated" }; // 3
  const contact = await s(env, "SELECT * FROM contacts WHERE id=?", row.contact_id).first();
  if (contact.email_validation !== "valid") return { skip: "email_not_validated" }; // 11
  if (contact.email_validation_expires_at && contact.email_validation_expires_at <= ctx.at) return { skip: "email_validation_expired" };
  const email = await decryptPii(contact.email_encrypted, env);
  if (!email) return { block: "email_missing" };
  const channel = await s(env, "SELECT state FROM channels WHERE tenant_id=? AND channel='email'", row.tenant_id).first(); // 10
  if (!channel || channel.state === "planned") return { skip: "channel_not_enabled" };
  if (channel.state === "internal_test") {
    const allowed = String(env.INTERNAL_TEST_RECIPIENTS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
    if (!allowed.includes(email.toLowerCase())) return { skip: "channel_internal_test_only" };
  }
  // 12: nenhum outro e-mail da sequência ao mesmo endereço no mesmo dia ou no dia civil anterior, no fuso dele.
  const tz = contact.timezone || ctx.nationalTz;
  const today = localDate(ctx.at, tz);
  const recent = (
    await s(env, "SELECT accepted_at FROM send_outbox WHERE tenant_id=? AND email_hash=? AND status='accepted' AND accepted_at>=?", row.tenant_id, row.email_hash, new Date(Date.parse(ctx.at) - 3 * 86400000).toISOString()).all()
  ).results;
  if (recent.some((r) => [today, addDays(today, -1)].includes(localDate(r.accepted_at, tz)))) return { skip: "consecutive_day" };
  if (row.planned_date > today) return { skip: "not_due" };
  return { ok: true, email, tz };
}

// Texto exato aprovado: decifra e confere o hash contra a mensagem e a outbox (R17.2, R19.1, AT25).
async function approvedMessage(env, row) {
  const m = await s(env, "SELECT * FROM ficha_messages WHERE id=?", row.message_row_id).first();
  const subject = await decryptPii(m.subject_enc, env);
  const body = await decryptPii(m.body_enc, env);
  const h = await messageHash(subject, body);
  if (h !== m.message_sha256 || h !== row.message_sha256) return null;
  return { subject, body, versionId: m.version_id };
}

// Uma execução do agendador. deps: { transport, now, owner, random }
export async function tick(env, tenant, deps = {}) {
  const at = deps.now ?? now();
  const sender = env.MAILBOX_USER || "sender";
  const owner = deps.owner ?? crypto.randomUUID();
  const out = { sent: 0, reason: null };
  const state = await acquireSender(env, tenant, sender, owner, at);
  if (!state) return { ...out, reason: "sender_busy" };
  try {
    await expireLeases(env, tenant, at);
    await releaseWaiting(env, tenant, at);
    if (state.stopped_at) return { ...out, reason: "sender_stopped" };
    const p = await parameters(env, tenant);
    const ramp = p["send_daily_ramp:email"],
      interval = p["send_interval_minutes:email"],
      window = p["send_window:national"],
      nationalTz = p["send_timezone:national"];
    if (!Array.isArray(ramp) || !interval || !window || !nationalTz) return { ...out, reason: "parameters_missing" }; // R7.1.1
    const senderDay = localDate(at, SENDER_TZ);
    const sentToday = state.day === senderDay ? state.sent_today : 0;
    const cap = ramp[Math.min(state.ramp_step, ramp.length - 1)];
    if (sentToday >= cap) return { ...out, reason: "daily_cap" }; // 7 (teto do remetente, soma dos mercados)
    if (state.next_send_at && state.next_send_at > at) return { ...out, reason: "interval" };
    const candidates = (
      await s(
        env,
        `SELECT o.*,f.campaign_id FROM send_outbox o JOIN fichas f ON f.id=o.ficha_id
         WHERE o.tenant_id=? AND o.channel='email' AND o.status IN ('pending','temp_failed') AND (o.next_attempt_at IS NULL OR o.next_attempt_at<=?)
         ORDER BY o.planned_date,o.step_no,o.created_at LIMIT 100`,
        tenant, at,
      ).all()
    ).results;
    for (const row of candidates) {
      const check = await preSendCheck(env, row, { at, nationalTz, campaignId: row.campaign_id });
      if (check.cancel || check.block) {
        await env.DB.batch([
          s(env, "UPDATE send_outbox SET status=?,block_reason=?,updated_at=? WHERE id=? AND status IN ('pending','temp_failed')", check.cancel ? "cancelled" : "blocked", check.cancel || check.block, at, row.id),
          log(env, row.id, "blocked", check.cancel || check.block),
        ]);
        continue;
      }
      if (check.skip) {
        await s(env, "UPDATE send_outbox SET block_reason=?,updated_at=? WHERE id=?", check.skip, at, row.id).run();
        continue;
      }
      if (!inWindow(at, check.tz, window)) {
        await s(env, "UPDATE send_outbox SET block_reason='outside_window',updated_at=? WHERE id=?", at, row.id).run();
        continue;
      }
      const msg = await approvedMessage(env, row);
      if (!msg) {
        await env.DB.batch([
          s(env, "UPDATE send_outbox SET status='blocked',block_reason='content_mismatch',updated_at=? WHERE id=?", at, row.id),
          log(env, row.id, "blocked", "conteúdo difere do aprovado"),
        ]);
        continue;
      }
      // Aquisição do passo (UPDATE condicional): outro executor não pega o mesmo passo.
      const messageId = row.message_id || `<ob-${row.id}@${String(env.MAILBOX_USER || "eagagro.com").split("@").pop()}>`;
      const leaseUntil = new Date(Date.parse(at) + LEASE_MS).toISOString();
      const took = await s(
        env,
        "UPDATE send_outbox SET status='leased',lease_owner=?,lease_until=?,lease_token=lease_token+1,attempts=attempts+1,message_id=?,block_reason=NULL,updated_at=? WHERE id=? AND status IN ('pending','temp_failed')",
        owner, leaseUntil, messageId, at, row.id,
      ).run();
      if (!took.meta.changes) continue;
      const token = (await s(env, "SELECT lease_token FROM send_outbox WHERE id=?", row.id).first()).lease_token;
      await log(env, row.id, "leased", null, token).run();
      const listUnsub = await unsubUrl(env, msg.versionId, row.contact_id);
      const result = await (deps.transport ?? smtpTransport(env)).send({
        to: check.email,
        subject: msg.subject,
        text: msg.body,
        headers: {
          "Message-ID": messageId,
          "List-Unsubscribe": `<${listUnsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      await settle(env, row, token, result, at, sentToday, senderDay, interval, deps);
      out.sent = result.kind === "accepted" ? 1 : 0;
      out.reason = result.kind;
      return out; // no máximo um envio por execução
    }
    return { ...out, reason: candidates.length ? "nothing_eligible" : "nothing_due" };
  } finally {
    await releaseSender(env, tenant, sender, owner);
  }
}

async function settle(env, row, token, result, at, sentToday, senderDay, interval, deps) {
  const fence = "id=? AND status='leased' AND lease_token=?";
  const minutes = interval.min + Math.floor((deps.random ?? Math.random)() * (interval.max - interval.min + 1));
  const next = new Date(Date.parse(at) + minutes * 60000).toISOString();
  const sender = env.MAILBOX_USER || "sender";
  if (result.kind === "accepted")
    return env.DB.batch([
      s(env, `UPDATE send_outbox SET status='accepted',accepted_at=?,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE ${fence}`, at, at, row.id, token),
      log(env, row.id, "accepted", null, token),
      s(env, "UPDATE sender_state SET day=?,sent_today=?,next_send_at=?,ramp_started_on=COALESCE(ramp_started_on,?) WHERE tenant_id=? AND sender=?", senderDay, sentToday + 1, next, senderDay, row.tenant_id, sender),
      // Break enviado sem resposta: sugestão de retorno em 6 meses (ou no ciclo do ICP), sem nova sequência automática (R28.11, R17.7).
      ...(row.step_no === 4
        ? [
            s(
              env,
              `INSERT INTO tasks(id,tenant_id,company_id,commodity,contact_id,ficha_id,kind,owner_id,due_date,priority,script)
               SELECT ?,?,?,?,?,f.id,'return_suggested',f.created_by,date(?, '+' || COALESCE((SELECT buying_cycle_days FROM campaign_icp WHERE campaign_id=f.campaign_id),182) || ' days'),0,
                      'Sequência encerrada sem resposta. Avalie nova ficha (a /prospeccao-vendas sugere voltar em 6–12 meses).'
               FROM fichas f WHERE f.id=?`,
              crypto.randomUUID(), row.tenant_id, row.company_id, row.commodity, row.contact_id, at.slice(0, 10), row.ficha_id,
            ),
          ]
        : []),
    ]);
  if (result.kind === "temporary") {
    const final = row.attempts + 1 >= MAX_TEMP_ATTEMPTS;
    return env.DB.batch([
      s(env, `UPDATE send_outbox SET status=?,next_attempt_at=?,block_reason=?,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE ${fence}`, final ? "perm_failed" : "temp_failed", new Date(Date.parse(at) + 3600000).toISOString(), result.detail, at, row.id, token),
      log(env, row.id, final ? "perm_failed" : "temp_failed", result.detail, token),
    ]);
  }
  if (result.kind === "permanent")
    // R19.7: endereço recusado → supressão por bounce e nada mais para ele, sem trocar de canal.
    return env.DB.batch([
      s(env, `UPDATE send_outbox SET status='perm_failed',block_reason=?,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE ${fence}`, result.detail, at, row.id, token),
      log(env, row.id, "perm_failed", result.detail, token),
      s(env, "INSERT INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,'email','hard_bounce','bounce','system-sender') ON CONFLICT(tenant_id,identifier_hash,channel) DO NOTHING", crypto.randomUUID(), row.tenant_id, row.email_hash),
      s(env, "UPDATE send_outbox SET status='cancelled',block_reason='hard_bounce',updated_at=? WHERE tenant_id=? AND email_hash=? AND status IN ('pending','waiting_sequence','temp_failed','blocked')", at, row.tenant_id, row.email_hash),
      s(env, "UPDATE sender_state SET next_send_at=? WHERE tenant_id=? AND sender=?", next, row.tenant_id, sender),
    ]);
  // Indeterminado: fica bloqueado até resolução humana (errata item 2); ocupa o intervalo como se tivesse saído.
  return env.DB.batch([
    s(env, `UPDATE send_outbox SET status='indeterminate',block_reason=?,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE ${fence}`, result.detail, at, row.id, token),
    log(env, row.id, "indeterminate", result.detail, token),
    s(env, "UPDATE sender_state SET day=?,sent_today=?,next_send_at=? WHERE tenant_id=? AND sender=?", senderDay, sentToday + 1, next, row.tenant_id, sender),
  ]);
}

// Resolução humana de um indeterminado (errata item 2): saiu (conferido na caixa) ou não saiu (volta para envio).
export async function resolveIndeterminate(request, env, actor, rid, outboxId) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const outcome = oneOf(i.outcome, ["sent", "not_sent", "cancel"], "resultado");
  const reason = str(i.reason, "evidência", 1000);
  if (reason.length < 10) fail(422, "reason_required", "Registre a evidência (ex.: conferido na pasta Enviados).");
  const row = await s(env, "SELECT * FROM send_outbox WHERE tenant_id=? AND id=?", actor.tenant_id, outboxId).first();
  if (!row) fail(404, "outbox_not_found", "Envio não encontrado.");
  if (row.status !== "indeterminate") fail(409, "not_indeterminate", "Só envio indeterminado é resolvido aqui.");
  const status = { sent: "accepted", not_sent: "pending", cancel: "cancelled" }[outcome];
  const at = now();
  await commit(env, [
    s(env, "UPDATE send_outbox SET status=?,resolved_by=?,resolved_reason=?,accepted_at=?,updated_at=? WHERE id=? AND status='indeterminate'", status, actor.id, reason, outcome === "sent" ? row.updated_at : null, at, outboxId),
    log(env, outboxId, outcome === "sent" ? "resolved_sent" : "resolved_not_sent", reason),
    auditStatement(env, actor, rid, "sending.indeterminate_resolved", "send_outbox", outboxId, { outcome }),
  ]);
  return { id: outboxId, status };
}

// Painel de envios do dia (R19, Envios): degrau, teto, próximo horário, fila e bloqueios. Sem texto das mensagens.
export async function today(env, actor) {
  const p = await parameters(env, actor.tenant_id);
  const sender = env.MAILBOX_USER || "sender";
  const st = (await s(env, "SELECT * FROM sender_state WHERE tenant_id=? AND sender=?", actor.tenant_id, sender).first()) || { ramp_step: 0, sent_today: 0 };
  const ramp = p["send_daily_ramp:email"] || [];
  const day = localDate(now(), SENDER_TZ);
  const queue = (
    await s(env, "SELECT o.id,o.status,o.block_reason,o.planned_date,o.step_no,o.company_id,c.legal_name FROM send_outbox o JOIN companies c ON c.id=o.company_id WHERE o.tenant_id=? AND o.status IN ('pending','temp_failed','blocked','indeterminate','waiting_sequence','leased') ORDER BY o.planned_date,o.step_no LIMIT 200", actor.tenant_id).all()
  ).results;
  const channel = await s(env, "SELECT state FROM channels WHERE tenant_id=? AND channel='email'", actor.tenant_id).first();
  return {
    channel: channel?.state ?? "planned",
    rampStep: st.ramp_step,
    dailyCap: ramp[Math.min(st.ramp_step, Math.max(0, ramp.length - 1))] ?? null,
    sentToday: st.day === day ? st.sent_today : 0,
    nextSendAt: st.next_send_at ?? null,
    stopped: st.stopped_at ? { at: st.stopped_at, reason: st.stopped_reason } : null,
    queue,
  };
}

// Avaliação diária da rampa e parada automática (R19.11, R19.12). deps: { now }
export async function evaluateRamp(env, tenant, deps = {}) {
  const at = deps.now ?? now();
  const sender = env.MAILBOX_USER || "sender";
  const p = await parameters(env, tenant);
  const stopPct = p["send_stop_hard_bounce_pct:email"],
    stepMax = p["send_step_up_max_hard_bounce_pct:email"],
    ramp = p["send_daily_ramp:email"];
  const st = await s(env, "SELECT * FROM sender_state WHERE tenant_id=? AND sender=?", tenant, sender).first();
  if (!st || st.stopped_at || stopPct == null || stepMax == null || !Array.isArray(ramp)) return { changed: false };
  const since = new Date(Date.parse(at) - 7 * 86400000).toISOString();
  const [sent, bounces, alerts] = await env.DB.batch([
    s(env, "SELECT COUNT(*) n FROM send_outbox WHERE tenant_id=? AND status IN ('accepted','perm_failed') AND updated_at>=?", tenant, since),
    s(env, "SELECT (SELECT COUNT(*) FROM send_outbox WHERE tenant_id=? AND status='perm_failed' AND updated_at>=?)+(SELECT COUNT(*) FROM inbound_messages WHERE tenant_id=? AND classification='bounce_hard' AND received_at>=?) n", tenant, since, tenant, since),
    s(env, "SELECT COUNT(*) n FROM inbound_messages WHERE tenant_id=? AND classification='provider_alert' AND received_at>=?", tenant, since),
  ]);
  const total = sent.results[0].n,
    hard = bounces.results[0].n,
    pct = total ? (hard / total) * 100 : 0;
  if ((total && pct >= stopPct) || alerts.results[0].n) {
    const reason = alerts.results[0].n ? "aviso do provedor ou marcação de spam" : `hard bounce de ${pct.toFixed(1)}% na semana`;
    await env.DB.batch([
      s(env, "UPDATE sender_state SET stopped_at=?,stopped_reason=? WHERE tenant_id=? AND sender=?", at, reason, tenant, sender),
      s(env, "INSERT INTO pauses(id,tenant_id,scope,scope_ref,reason,created_by) VALUES (?,?,'operation',NULL,?,'system-sender')", crypto.randomUUID(), tenant, `Parada automática: ${reason}`),
    ]);
    return { changed: true, stopped: reason };
  }
  const base = st.last_step_up_on || st.ramp_started_on;
  if (base && st.ramp_step < ramp.length - 1 && localDate(at, SENDER_TZ) >= addDays(base, 14) && pct < stepMax) {
    await s(env, "UPDATE sender_state SET ramp_step=ramp_step+1,last_step_up_on=? WHERE tenant_id=? AND sender=?", localDate(at, SENDER_TZ), tenant, sender).run();
    return { changed: true, stepUp: st.ramp_step + 1 };
  }
  return { changed: false };
}
