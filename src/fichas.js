// Fichas de aprovação (P2-T9; R18, R17.1–R17.3, errata): versão imutável e cifrada, hash por mensagem,
// aprovação por destinatário e canal com o hash visto pelo aprovador; mudança comercial invalida a aprovação.
import { internationalGate } from "./selections.js";
import { bodyJson, fail, str, oneOf, requireRole, WRITE_ROLES, APPROVER_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, parameters, product } from "./store.js";
import { encryptPii, decryptPii } from "./crypto.js";
import { isSuppressed } from "./operations.js";
import { canHaveFicha, contactTargetFlag } from "./profiles.js";
import { generateSequence, commodityDisplay, SKILL_SHA256, TEMPLATES_VERSION, GENERATOR_VERSION } from "./templates/prospeccao-vendas.js";
import { reviewSequence } from "./review.js";
import { unsubUrl } from "./unsub-token.js";
import { manualTaskStatements } from "./tasks.js";

const ROLES = ["decision_maker", "influencer", "provisional_decision_maker"];
async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const messageHash = (subject, body) => sha256(`${subject ?? ""}\n\n${body}`);
export const approvalHash = (hashes) => sha256(hashes.join(","));

async function fichaRow(env, actor, id) {
  const f = await s(env, "SELECT * FROM fichas WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!f) fail(404, "ficha_not_found", "Ficha não encontrada.");
  return f;
}
async function currentVersion(env, f) {
  return s(env, "SELECT * FROM ficha_versions WHERE ficha_id=? AND version_no=?", f.id, f.current_version).first();
}

// Contexto comum de geração: campanha, produto, perfil, declarações, fuso e destinatários conferidos.
async function context(env, actor, companyId, campaignId, contactIds) {
  const c = await s(env, "SELECT * FROM campaigns WHERE tenant_id=? AND id=?", actor.tenant_id, campaignId).first();
  if (!c) fail(404, "campaign_not_found", "Campanha não encontrada.");
  if (["ended", "paused"].includes(c.status)) fail(409, "campaign_not_available", "Campanha pausada ou encerrada.");
  const p = await product(env, actor.tenant_id, c.product_id);
  if (!p.active || p.identity_status !== "confirmed") fail(422, "product_identity_pending", "Identidade de produto pendente bloqueia a ficha (R10.4).");
  await internationalGate(env, actor.tenant_id, c);
  const company = await s(env, "SELECT * FROM companies WHERE tenant_id=? AND id=?", actor.tenant_id, companyId).first();
  if (!company) fail(404, "company_not_found", "Empresa não encontrada.");
  const openclaw = await s(env, "SELECT retired_in_openclaw FROM openclaw_transfers WHERE tenant_id=? AND company_id=?", actor.tenant_id, companyId).first();
  if (openclaw && !openclaw.retired_in_openclaw) fail(409, "openclaw_active", "Empresa ainda ativa no OpenClaw: registre a retirada antes (R25.3).");
  const profile = await s(
    env,
    "SELECT * FROM buyer_profiles WHERE tenant_id=? AND company_id=? AND product_id IN (SELECT id FROM products WHERE tenant_id=? AND commodity=?) ORDER BY unit_key='' DESC, updated_at DESC LIMIT 1",
    actor.tenant_id, companyId, actor.tenant_id, p.commodity,
  ).first();
  const gate = canHaveFicha(profile);
  if (!gate.ok) fail(422, "ficha_not_allowed", gate.reason);
  const params = await parameters(env, actor.tenant_id);
  const timezone = c.market === "national" ? params["send_timezone:national"] : null;
  if (c.market === "national" && !timezone) fail(422, "timezone_pending", "Fuso do mercado nacional sem valor aprovado (R18.6).");
  if (!env.EAG_POSTAL_ADDRESS) fail(422, "postal_address_missing", "Configure EAG_POSTAL_ADDRESS: o endereço físico vai em todo e-mail (R19.13).");
  if (!Array.isArray(contactIds) || !contactIds.length || contactIds.length > 5) fail(422, "invalid_recipients", "Informe de 1 a 5 destinatários.");
  const recipients = [];
  for (const id of [...new Set(contactIds)]) {
    const ct = await s(env, "SELECT * FROM contacts WHERE tenant_id=? AND id=? AND company_id=?", actor.tenant_id, str(id, "contato", 80), companyId).first();
    if (!ct) fail(422, "invalid_recipients", "Contato não pertence à empresa.");
    if (!ROLES.includes(ct.prospect_role)) fail(422, "recipient_role", "Destinatário precisa ser decisor, decisor provisório ou influenciador (PV8).");
    const [fullName, jobTitle, email, linkedin] = await Promise.all(
      ["full_name", "job_title", "email", "linkedin_url"].map((k) => decryptPii(ct[`${k}_encrypted`], env)),
    );
    if (!email) fail(422, "recipient_without_email", "Destinatário sem e-mail: comece pela ligação Level 0.");
    if (await isSuppressed(env, actor.tenant_id, "email", email)) fail(409, "recipient_suppressed", "Destinatário em supressão (R2.1.2).");
    if (c.market === "international" && !ct.timezone) fail(422, "timezone_pending", "Fuso do destinatário pendente (R18.6).");
    recipients.push({
      contactId: ct.id, role: ct.prospect_role, fullName, jobTitle, sourceLabel: ct.source_label, linkedin: !!linkedin,
      relationshipNote: ct.relationship_note, emailHash: ct.email_hash, timezone: ct.timezone || timezone,
    });
  }
  if (!recipients.some((r) => r.role !== "influencer")) fail(422, "decision_maker_required", "A ficha precisa de um decisor (PV8).");
  const decl = (
    await s(env, "SELECT id,kind,value_bool,text FROM campaign_declarations WHERE campaign_id=? AND status='approved' AND (review_due_at IS NULL OR review_due_at>?) ORDER BY approved_at", c.id, now()).all()
  ).results;
  const declarations = {
    volumeAvailable: decl.find((d) => d.kind === "volume_available")?.value_bool === 1 ? true : null,
    socialProof: decl.find((d) => d.kind === "social_proof")?.text || null,
  };
  const others = (
    await s(env, "SELECT DISTINCT group_name,variant_name,commodity FROM products WHERE tenant_id=? AND commodity<>?", actor.tenant_id, p.commodity).all()
  ).results.map(commodityDisplay);
  return { campaign: c, product: p, company, profile, gate, timezone, recipients, declarations, declarationIds: decl.map((d) => d.id), others: [...new Set(others)] };
}

// Monta a versão: gera, revisa, cifra e calcula os hashes. Edições manuais substituem textos antes da revisão.
async function buildVersion(env, actor, fichaId, versionNo, ctx, edits = []) {
  const versionId = crypto.randomUUID();
  const urls = new Map();
  for (const r of ctx.recipients) urls.set(r.contactId, await unsubUrl(env, versionId, r.contactId));
  const commodity = commodityDisplay(ctx.product);
  const msgs = generateSequence({
    commodity, recipients: ctx.recipients, declarations: ctx.declarations,
    sig: { senderName: env.SENDER_NAME || "Rogério Palhari", postalAddress: env.EAG_POSTAL_ADDRESS },
    unsub: (id) => urls.get(id),
  });
  for (const e of edits) {
    const m = msgs.find((x) => x.contactId === e.contactId && x.channel === e.channel && x.step === e.step);
    if (!m) fail(422, "edit_target_missing", `Passo ${e.step} (${e.channel}) inexistente para o destinatário.`);
    if (e.subject !== undefined) m.subject = e.subject === null ? null : str(e.subject, "assunto", 200);
    m.body = str(e.body, "texto", 5000);
  }
  const review = reviewSequence(msgs, {
    market: ctx.campaign.market, commodity, otherCommodities: ctx.others, declarations: ctx.declarations,
    recipients: ctx.recipients, postalAddress: env.EAG_POSTAL_ADDRESS, unsubUrl: (id) => urls.get(id),
  });
  const snapshot = JSON.stringify({
    companyId: ctx.company.id, campaignId: ctx.campaign.id, campaignVersion: ctx.campaign.version,
    productId: ctx.product.id, commodity: ctx.product.commodity, profileId: ctx.profile?.id ?? null,
    icpStatus: ctx.profile?.icp_status ?? null, fichaNote: ctx.gate.note ?? null, timezone: ctx.timezone,
    declarationIds: ctx.declarationIds,
    recipients: ctx.recipients.map((r) => ({ contactId: r.contactId, role: r.role, emailHash: r.emailHash, timezone: r.timezone, targetFlag: contactTargetFlag(r.jobTitle, r.relationshipNote) })),
    skill: SKILL_SHA256, templates: TEMPLATES_VERSION, generator: GENERATOR_VERSION, edits: edits.length,
  });
  const statements = [
    s(
      env,
      "INSERT INTO ficha_versions(id,ficha_id,version_no,snapshot_enc,snapshot_sha256,pv_report_json,review_ok,skill_sha256,templates_version,generator_version,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      versionId, fichaId, versionNo, await encryptPii(snapshot, env), await sha256(snapshot), JSON.stringify(review.findings),
      review.ok ? 1 : 0, SKILL_SHA256, TEMPLATES_VERSION, GENERATOR_VERSION, actor.id,
    ),
  ];
  for (const m of msgs)
    statements.push(
      s(
        env,
        "INSERT INTO ficha_messages(id,version_id,contact_id,channel,step_no,kind,day_offset,subject_enc,body_enc,message_sha256) VALUES (?,?,?,?,?,?,?,?,?,?)",
        crypto.randomUUID(), versionId, m.contactId, m.channel, m.step, m.kind, m.day,
        m.subject == null ? null : await encryptPii(m.subject, env), await encryptPii(m.body, env), await messageHash(m.subject, m.body),
      ),
    );
  return { versionId, review, statements };
}

export async function createFicha(request, env, actor, rid) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request);
  const companyId = str(i.companyId, "empresa", 80),
    campaignId = str(i.campaignId, "campanha", 80);
  const existing = await s(env, "SELECT id FROM fichas WHERE tenant_id=? AND company_id=? AND campaign_id=?", actor.tenant_id, companyId, campaignId).first();
  if (existing) fail(409, "ficha_exists", "Já existe ficha desta empresa nesta campanha.", { id: existing.id });
  const ctx = await context(env, actor, companyId, campaignId, i.recipients);
  const id = crypto.randomUUID();
  const v = await buildVersion(env, actor, id, 1, ctx);
  await commit(env, [
    s(env, "INSERT INTO fichas(id,tenant_id,company_id,campaign_id,status,created_by) VALUES (?,?,?,?,?,?)", id, actor.tenant_id, companyId, campaignId, "in_approval", actor.id),
    ...v.statements,
    auditStatement(env, actor, rid, "ficha.created", "ficha", id, { version: 1, reviewOk: v.review.ok, recipients: ctx.recipients.length }),
  ]);
  return { id, version: 1, reviewOk: v.review.ok, findings: v.review.findings.filter((x) => !x.ok) };
}

// Nova versão (edição de texto, troca de destinatários ou regeneração após mudança comercial).
// A anterior fica marcada como substituída; aprovações dela são invalidadas; envios não aceitos dela são substituídos.
export async function newVersion(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const f = await fichaRow(env, actor, id),
    i = await bodyJson(request);
  if (i.expectedRowVersion !== f.row_version) fail(409, "edit_conflict", "Ficha alterada por outra pessoa. Recarregue.");
  if (f.status === "discarded") fail(409, "ficha_discarded", "Ficha descartada.");
  const prev = await currentVersion(env, f);
  const prevSnap = JSON.parse(await decryptPii(prev.snapshot_enc, env));
  const contactIds = i.recipients ?? prevSnap.recipients.map((r) => r.contactId);
  const edits = Array.isArray(i.edits)
    ? i.edits.map((e) => ({ contactId: str(e.contactId, "contato", 80), channel: oneOf(e.channel, ["email", "call", "linkedin"], "canal"), step: e.step, subject: e.subject, body: e.body }))
    : [];
  const ctx = await context(env, actor, f.company_id, f.campaign_id, contactIds);
  const v = await buildVersion(env, actor, id, f.current_version + 1, ctx, edits);
  const at = now();
  await commit(env, [
    s(env, "UPDATE fichas SET current_version=current_version+1,status='in_approval',row_version=CASE WHEN row_version=? THEN row_version+1 ELSE -1 END,updated_at=? WHERE id=?", f.row_version, at, id),
    s(env, "UPDATE ficha_versions SET superseded_at=? WHERE id=?", at, prev.id),
    ...v.statements,
    s(env, "UPDATE ficha_approvals SET status='invalidated',invalidated_at=?,invalidated_reason='nova versão da ficha' WHERE version_id=? AND status='approved'", at, prev.id),
    s(env, "UPDATE send_outbox SET status='superseded',updated_at=? WHERE ficha_id=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')", at, id),
    auditStatement(env, actor, rid, "ficha.version_created", "ficha", id, { version: f.current_version + 1, edits: edits.length, reviewOk: v.review.ok }),
  ]);
  return { id, version: f.current_version + 1, reviewOk: v.review.ok, findings: v.review.findings.filter((x) => !x.ok) };
}

export async function getFicha(env, actor, id) {
  const f = await fichaRow(env, actor, id);
  const v = await currentVersion(env, f);
  const [msgs, approvals, outbox] = await env.DB.batch([
    s(env, "SELECT * FROM ficha_messages WHERE version_id=? ORDER BY contact_id,day_offset,step_no", v.id),
    s(env, "SELECT * FROM ficha_approvals WHERE version_id=? ORDER BY approved_at", v.id),
    s(env, "SELECT id,contact_id,channel,step_no,planned_date,status,block_reason,accepted_at FROM send_outbox WHERE ficha_id=? ORDER BY planned_date,step_no", id),
  ]);
  const messages = [];
  for (const m of msgs.results)
    messages.push({
      id: m.id, contactId: m.contact_id, channel: m.channel, step: m.step_no, kind: m.kind, day: m.day_offset,
      subject: await decryptPii(m.subject_enc, env), body: await decryptPii(m.body_enc, env), sha256: m.message_sha256,
    });
  const groups = {};
  for (const m of messages) (groups[`${m.contactId}|${m.channel}`] ||= []).push(m);
  const toApprove = [];
  for (const [key, list] of Object.entries(groups)) {
    const [contactId, channel] = key.split("|");
    toApprove.push({ contactId, channel, messagesSha256: await approvalHash(list.sort((a, b) => a.step - b.step).map((m) => m.sha256)) });
  }
  return {
    ficha: f,
    version: { no: v.version_no, id: v.id, reviewOk: !!v.review_ok, findings: JSON.parse(v.pv_report_json), skill: v.skill_sha256, templates: v.templates_version, generator: v.generator_version, snapshot: JSON.parse(await decryptPii(v.snapshot_enc, env)) },
    messages, approvals: approvals.results, toApprove, outbox: outbox.results,
  };
}

const nextMonday = (at) => {
  const d = new Date(`${at.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (((8 - d.getUTCDay()) % 7) || 7));
  return d.toISOString().slice(0, 10);
};
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Aprovação de um destinatário em um canal da versão corrente (R18.1, R9.2). Idempotente.
export async function approve(request, env, actor, rid, id) {
  requireRole(actor, APPROVER_ROLES);
  const f = await fichaRow(env, actor, id),
    i = await bodyJson(request);
  const v = await currentVersion(env, f);
  if (i.versionNo !== v.version_no) fail(409, "version_changed", "A ficha tem versão mais nova. Revise antes de aprovar.");
  if (!v.review_ok) fail(409, "review_failed", "O revisor PV encontrou violações; corrija antes de aprovar (R17.3).");
  if (["discarded", "deferred"].includes(f.status)) fail(409, "ficha_not_open", "Ficha adiada ou descartada.");
  const contactId = str(i.contactId, "contato", 80),
    channel = oneOf(i.channel, ["email", "call", "linkedin"], "canal");
  const list = (
    await s(env, "SELECT * FROM ficha_messages WHERE version_id=? AND contact_id=? AND channel=? ORDER BY step_no", v.id, contactId, channel).all()
  ).results;
  if (!list.length) fail(422, "nothing_to_approve", "Nada a aprovar para este destinatário neste canal.");
  const agg = await approvalHash(list.map((m) => m.message_sha256));
  if (i.messagesSha256 !== agg) fail(409, "content_changed", "O conteúdo aprovado não confere com o atual. Recarregue a ficha.");
  const campaign = await s(env, "SELECT * FROM campaigns WHERE id=?", f.campaign_id).first();
  if (campaign.status !== "active") fail(409, "campaign_not_active", "Ative a campanha antes de aprovar.");
  if (campaign.market === "international") {
    // Internacional só aprova depois da liberação registrada por Rogério (Plano 3 T12); a ausência do parâmetro não libera.
    const release = (await parameters(env, actor.tenant_id))["international_enabled:international"];
    if (release?.enabled !== true) fail(409, "international_not_enabled", "Fluxo internacional ainda não liberado (validação T12 pendente).");
    await internationalGate(env, actor.tenant_id, campaign);
  }
  const snap = JSON.parse(await decryptPii(v.snapshot_enc, env));
  if (snap.campaignVersion !== campaign.version) fail(409, "campaign_changed", "A campanha mudou depois desta versão: gere nova versão (R22.5).");
  if (channel === "email") {
    const ch = await s(env, "SELECT state FROM channels WHERE tenant_id=? AND channel='email'", actor.tenant_id).first();
    if (!ch || ch.state === "planned") fail(409, "channel_not_ready", "Canal de e-mail ainda planejado: libere o teste interno antes (R26.2).");
  }
  const existing = await s(env, "SELECT * FROM ficha_approvals WHERE version_id=? AND contact_id=? AND channel=?", v.id, contactId, channel).first();
  if (existing?.status === "approved") return { approvalId: existing.id, idempotent: true };
  if (existing) fail(409, "approval_invalidated", "Aprovação invalidada nesta versão: gere nova versão.");
  const at = now();
  const approvalId = crypto.randomUUID();
  const start = i.startDate ? str(i.startDate, "início", 10) : nextMonday(at);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start < at.slice(0, 10)) fail(422, "invalid_start", "Início em data futura (AAAA-MM-DD).");
  const contact = await s(env, "SELECT email_hash FROM contacts WHERE id=?", contactId).first();
  const statements = [
    s(env, "INSERT INTO ficha_approvals(id,version_id,contact_id,channel,messages_sha256,approved_by,approved_at) VALUES (?,?,?,?,?,?,?)", approvalId, v.id, contactId, channel, agg, actor.id, at),
  ];
  if (channel === "email") {
    // Uma sequência ativa por endereço (R19.8): outra ficha em andamento para o mesmo e-mail → espera.
    const busy = await s(
      env,
      "SELECT 1 FROM send_outbox WHERE tenant_id=? AND email_hash=? AND ficha_id<>? AND status IN ('pending','leased','waiting_sequence','temp_failed','indeterminate') LIMIT 1",
      actor.tenant_id, contact.email_hash, id,
    ).first();
    for (const m of list.filter((x) => x.kind === "auto_email"))
      statements.push(
        s(
          env,
          `INSERT INTO send_outbox(id,tenant_id,ficha_id,message_row_id,approval_id,company_id,commodity,contact_id,email_hash,channel,step_no,planned_date,status,message_sha256)
           VALUES (?,?,?,?,?,?,?,?,?,'email',?,?,?,?)
           ON CONFLICT(ficha_id,contact_id,channel,step_no) DO UPDATE SET message_row_id=excluded.message_row_id,approval_id=excluded.approval_id,planned_date=excluded.planned_date,status=excluded.status,block_reason=NULL,message_sha256=excluded.message_sha256,attempts=0,updated_at=excluded.updated_at
           WHERE send_outbox.status='superseded'`,
          crypto.randomUUID(), actor.tenant_id, id, m.id, approvalId, f.company_id, snap.commodity, contactId, contact.email_hash,
          m.step_no, addDays(start, m.day_offset), busy ? "waiting_sequence" : "pending", m.message_sha256,
        ),
      );
  }
  if (channel !== "email") {
    const plain = [];
    // Roteiro tem o nome do contato: vai cifrado para a tarefa (marcado "enc:"), decifrado só na listagem autenticada.
    for (const m of list) plain.push({ ...m, body: `enc:${m.body_enc}` });
    statements.push(
      ...manualTaskStatements(env, { tenant: actor.tenant_id, ficha: f, contactId, commodity: snap.commodity, owner: f.created_by, start, messages: plain, addDays }),
    );
  }
  statements.push(
    auditStatement(env, actor, rid, "ficha.approved", "ficha", id, { version: v.version_no, contactId, channel, messagesSha256: agg, start }),
  );
  await commit(env, statements);
  // Ficha aprovada quando todos os destinatários × canais da versão estão aprovados; o pipeline da empresa não muda (AT39).
  const pending = await s(
    env,
    "SELECT COUNT(*) n FROM (SELECT DISTINCT contact_id,channel FROM ficha_messages WHERE version_id=?) m WHERE NOT EXISTS (SELECT 1 FROM ficha_approvals a WHERE a.version_id=? AND a.contact_id=m.contact_id AND a.channel=m.channel AND a.status='approved')",
    v.id, v.id,
  ).first();
  if (!pending.n) await s(env, "UPDATE fichas SET status='approved',updated_at=? WHERE id=? AND status='in_approval'", at, id).run();
  return { approvalId, start, remaining: pending.n };
}

export async function setStatus(request, env, actor, rid, id, status) {
  requireRole(actor, status === "discarded" ? APPROVER_ROLES : WRITE_ROLES);
  const f = await fichaRow(env, actor, id),
    i = await bodyJson(request);
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 5) fail(422, "reason_required", "Descreva o motivo (R18.2).");
  if (f.status === "discarded") fail(409, "ficha_discarded", "Ficha já descartada.");
  const at = now();
  await commit(env, [
    s(env, "UPDATE fichas SET status=?,status_reason=?,row_version=row_version+1,updated_at=? WHERE id=?", status, reason, at, id),
    s(env, "UPDATE send_outbox SET status='cancelled',block_reason=?,updated_at=? WHERE ficha_id=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')", `ficha ${status === "discarded" ? "descartada" : "adiada"}`, at, id),
    auditStatement(env, actor, rid, `ficha.${status}`, "ficha", id, { reason }),
  ]);
  return { id, status };
}

// Mudança comercial invalida aprovações vigentes e bloqueia envios ainda não aceitos (errata; R22.5).
export function invalidationStatements(env, { campaignId, contactId }, reason) {
  const at = now();
  const scope = campaignId
    ? ["version_id IN (SELECT v.id FROM ficha_versions v JOIN fichas f ON f.id=v.ficha_id WHERE f.campaign_id=? AND v.superseded_at IS NULL)", campaignId]
    : ["contact_id=?", contactId];
  return [
    s(env, `UPDATE ficha_approvals SET status='invalidated',invalidated_at=?,invalidated_reason=? WHERE status='approved' AND ${scope[0]}`, at, reason, scope[1]),
    s(
      env,
      `UPDATE send_outbox SET status='blocked',block_reason='approval_invalidated',updated_at=? WHERE status IN ('pending','waiting_sequence','temp_failed') AND approval_id IN (SELECT id FROM ficha_approvals WHERE status='invalidated' AND invalidated_at=?)`,
      at, at,
    ),
  ];
}
