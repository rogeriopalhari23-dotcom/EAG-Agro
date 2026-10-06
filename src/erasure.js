// Exclusão de dados pessoais de um contato (R9.1, R9.1.2, R23.5) e proteção contra restauração do D1.
//
// Alcance: campos do contato; textos congelados das fichas dele (marcador cifrado; identidade e hash mantidos);
// mensagens recebidas DELE (from_hash) no R2 e seus identificadores; tarefas do contato e as abertas pelas mensagens
// dele (vínculo tasks.inbound_id); candidata de pessoa; referência de verificação; a parte dele no cache do aviso
// legal (Impressum) da empresa; endereços em registros de envio (send_log.detail, resolved_reason). O hash do e-mail
// vai para a supressão. Mensagens de OUTROS remetentes na conversa dele não são apagadas: voltam como
// sharedRetained para revisão e, se for o caso, purga individual (purgeInboundContent).
//
// Restauração: cada exclusão grava erasure_ledger no D1 e uma cópia no R2 (erasures/<tenant>/<contato>.json), escrita
// ANTES do D1. Se o D1 voltar a um ponto anterior, o R2 tem exclusões que o D1 não tem: envio e aprovação param
// (erasure_reapply_required) até POST /api/erasures/reapply refazer as purgas.
import { bodyJson, fail, str, requireRole } from "./http.js";
import { statement as s, commit, auditStatement, now } from "./store.js";
import { encryptPii, decryptPii, identifierHash } from "./crypto.js";
import { nameHash, siteOrigin } from "./people.js";

export const PURGED = "[conteúdo excluído a pedido do titular]";
const ADMIN = new Set(["admin"]);
const ADDRESS = /[^\s<>"'(),;:[\]]+@[^\s<>"'(),;:[\]]+\.[a-z]{2,}/gi;
// Endereço de e-mail em texto de servidor ou nota (ex.: "550 5.1.1 <x@y.de> unknown") vira "[endereço]".
export const redactAddresses = (t) => (t == null ? t : String(t).replace(ADDRESS, "[endereço]"));
const ledgerKey = (tenant, contactId) => `erasures/${tenant}/${contactId}.json`;

async function ledgerInR2(env, tenant) {
  const out = [];
  let cursor;
  do {
    const page = await env.FILES.list({ prefix: `erasures/${tenant}/`, cursor });
    for (const o of page.objects) out.push(o.key.slice(`erasures/${tenant}/`.length).replace(/\.json$/, ""));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

// Falso se o R2 registra exclusão que o D1 não tem (D1 restaurado para antes dela).
export async function erasuresConsistent(env, tenant) {
  if (!env.FILES) return true;
  const r2 = await ledgerInR2(env, tenant);
  if (!r2.length) return true;
  const d1 = new Set((await s(env, "SELECT contact_id FROM erasure_ledger WHERE tenant_id=?", tenant).all()).results.map((r) => r.contact_id));
  return r2.every((id) => d1.has(id));
}

async function purgeContact(env, actor, rid, contactId, legalBasis, { emailHash: knownHash = null, erasedAt = null, reapply = false } = {}) {
  const tenant = actor.tenant_id;
  const at = now();
  const c = await s(env, "SELECT * FROM contacts WHERE tenant_id=? AND id=?", tenant, contactId).first();
  if (!c && !reapply) fail(404, "contact_not_found", "Contato não encontrado.");
  const hash = c?.email_hash ?? knownHash;
  if (!env.FILES) fail(503, "files_unavailable", "Armazenamento indisponível: a exclusão não pode ser registrada fora do banco (proteção contra restauração).");

  const [messages, own, shared, candidates, logs, resolved, company] = await env.DB.batch([
    s(env, "SELECT m.id,m.subject_enc FROM ficha_messages m JOIN ficha_versions v ON v.id=m.version_id JOIN fichas f ON f.id=v.ficha_id WHERE f.tenant_id=? AND m.contact_id=? AND m.purged_at IS NULL", tenant, contactId),
    s(env, "SELECT id,r2_key,content_purged_at FROM inbound_messages WHERE tenant_id=? AND ? IS NOT NULL AND from_hash=?", tenant, hash, hash),
    s(
      env,
      `SELECT id FROM inbound_messages WHERE tenant_id=? AND content_purged_at IS NULL AND (from_hash IS NULL OR from_hash IS NOT ?)
         AND outbox_id IN (SELECT id FROM send_outbox WHERE tenant_id=? AND contact_id=?)`,
      tenant, hash, tenant, contactId,
    ),
    s(env, "SELECT id,name_hash,email_encrypted,phone_encrypted FROM person_candidates WHERE tenant_id=? AND contact_id=?", tenant, contactId),
    s(env, "SELECT l.id,l.detail FROM send_log l JOIN send_outbox o ON o.id=l.outbox_id WHERE o.tenant_id=? AND o.contact_id=? AND l.detail LIKE '%@%'", tenant, contactId),
    s(env, "SELECT id,resolved_reason FROM send_outbox WHERE tenant_id=? AND contact_id=? AND resolved_reason LIKE '%@%'", tenant, contactId),
    s(env, "SELECT co.id,co.website FROM companies co JOIN contacts ct ON ct.company_id=co.id WHERE ct.tenant_id=? AND ct.id=?", tenant, contactId),
  ]);
  // Todas as mensagens dela alcançam as tarefas (inclusive ligadas à mão depois de uma purga); só as ainda com
  // conteúdo são purgadas de novo.
  const allOwnIds = own.results.map((m) => m.id);
  const ownIds = own.results.filter((m) => !m.content_purged_at).map((m) => m.id);

  // Parte da pessoa no cache do aviso legal da empresa (conteúdo compartilhado): sai só ela; os demais nomes ficam.
  let impressum = null;
  const origin = siteOrigin(company.results[0]?.website);
  if (origin && candidates.results.length) {
    const row = await s(env, "SELECT result_json FROM research_cache WHERE source='impressum' AND external_id=?", origin).first();
    if (row) {
      const payload = JSON.parse(await decryptPii(row.result_json, env));
      const hashes = new Set(candidates.results.map((r) => r.name_hash));
      const emails = new Set(), phones = new Set();
      for (const r of candidates.results) {
        if (r.email_encrypted) emails.add(String(await decryptPii(r.email_encrypted, env)).toLowerCase());
        if (r.phone_encrypted) phones.add(String(await decryptPii(r.phone_encrypted, env)));
      }
      if (c?.phone_encrypted) phones.add(String(await decryptPii(c.phone_encrypted, env)));
      const people = [];
      for (const p of payload.people ?? []) if (!hashes.has(await nameHash(env, tenant, company.results[0].id, p.name))) people.push(p);
      const emailIsHers = payload.email && (emails.has(String(payload.email).toLowerCase()) || (hash && (await identifierHash(env, tenant, "email", payload.email)) === hash));
      const next = { ...payload, people, email: emailIsHers ? null : payload.email, phone: payload.phone && phones.has(String(payload.phone)) ? null : payload.phone };
      if (JSON.stringify(next) !== JSON.stringify(payload)) impressum = { origin, json: await encryptPii(JSON.stringify(next), env) };
    }
  }

  // R2 primeiro: a cópia do registro de exclusão (sem PII) e a remoção do conteúdo recebido. Se o banco falhar depois,
  // o R2 já acusa a exclusão e o envio fica parado até a reaplicação terminar a purga.
  if (!reapply) await env.FILES.put(ledgerKey(tenant, contactId), JSON.stringify({ contactId, emailHash: hash, erasedAt: at, requestId: rid }));
  const stored = own.results.filter((m) => !m.content_purged_at).map((m) => m.r2_key).filter((k) => k && k.startsWith("inbound/"));
  if (stored.length) await env.FILES.delete(stored);

  const marker = await encryptPii(PURGED, env);
  const ph = (a) => a.map(() => "?").join(",");
  const st = [
    s(
      env,
      "UPDATE contacts SET full_name_encrypted=NULL,job_title_encrypted=NULL,email_encrypted=NULL,phone_encrypted=NULL,linkedin_url_encrypted=NULL,relationship_note=NULL,source_url=NULL,source_label=?,updated_at=? WHERE tenant_id=? AND id=?",
      `dados excluídos em ${at.slice(0, 10)}`, at, tenant, contactId,
    ),
    s(env, "UPDATE send_outbox SET status='cancelled',block_reason='personal_data_deleted',updated_at=? WHERE tenant_id=? AND contact_id=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')", at, tenant, contactId),
    ...messages.results.map((m) => s(env, "UPDATE ficha_messages SET subject_enc=?,body_enc=?,body_html_enc=NULL,purged_at=? WHERE id=?", m.subject_enc == null ? null : marker, marker, at, m.id)),
    ...ownIds.map((id) => s(env, "UPDATE inbound_messages SET r2_key='purged',message_id=NULL,in_reply_to=NULL,references_json='[]',content_purged_at=? WHERE id=?", at, id)),
    // Histórico de edição (0033) pode conter o roteiro antigo: sai junto com o roteiro da tarefa.
    s(
      env,
      `DELETE FROM task_revisions WHERE tenant_id=? AND task_id IN (SELECT id FROM tasks WHERE tenant_id=? AND (contact_id=? ${allOwnIds.length ? `OR inbound_id IN (${ph(allOwnIds)})` : ""}))`,
      tenant, tenant, contactId, ...allOwnIds,
    ),
    s(
      env,
      `UPDATE tasks SET status=CASE WHEN status IN ('open','suspended') THEN 'cancelled' ELSE status END,
         suspended_reason=CASE WHEN status IN ('open','suspended') THEN 'dados pessoais excluídos' ELSE suspended_reason END,
         script=NULL,result_json=NULL,channel_note=NULL,next_action=NULL
       WHERE tenant_id=? AND (contact_id=? ${allOwnIds.length ? `OR inbound_id IN (${ph(allOwnIds)})` : ""})`,
      tenant, contactId, ...allOwnIds,
    ),
    s(
      env,
      "UPDATE person_candidates SET name_encrypted=?,title_encrypted=NULL,email_encrypted=NULL,email_source_url=NULL,phone_encrypted=NULL,phone_source_url=NULL,purchase_note=NULL,purchase_source_url=NULL,source_url='purged',status='dismissed',dismiss_reason='personal_data_deleted' WHERE tenant_id=? AND contact_id=?",
      marker, tenant, contactId,
    ),
    s(env, "UPDATE contact_verifications SET source_reference=NULL WHERE tenant_id=? AND contact_id=?", tenant, contactId),
    ...logs.results.map((l) => s(env, "UPDATE send_log SET detail=? WHERE id=?", redactAddresses(l.detail), l.id)),
    ...resolved.results.map((r) => s(env, "UPDATE send_outbox SET resolved_reason=? WHERE id=?", redactAddresses(r.resolved_reason), r.id)),
  ];
  if (impressum) st.push(s(env, "UPDATE research_cache SET result_json=? WHERE source='impressum' AND external_id=?", impressum.json, impressum.origin));
  if (hash)
    st.push(
      s(env, "INSERT OR IGNORE INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,'email','personal_data_deleted','manual',?)", crypto.randomUUID(), tenant, hash, actor.id),
    );
  st.push(
    s(
      env,
      "INSERT INTO erasure_ledger(tenant_id,contact_id,email_hash,erased_at,request_id,reapplied_at) VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id,contact_id) DO UPDATE SET reapplied_at=COALESCE(excluded.reapplied_at,erasure_ledger.reapplied_at)",
      tenant, contactId, hash, reapply ? (erasedAt ?? at) : at, rid, reapply ? at : null,
    ),
  );
  const pendingReview = company.results[0]
    ? (await s(env, `SELECT COUNT(*) n FROM tasks WHERE tenant_id=? AND company_id=? AND inbound_id IS NULL AND kind IN ${REPLY_KINDS}`, tenant, company.results[0].id).first()).n
    : 0;
  const counts = {
    replyTasksToReview: pendingReview,
    fichaMessagesPurged: messages.results.length,
    inboundPurged: ownIds.length,
    sendLogRedacted: logs.results.length + resolved.results.length,
    impressumCacheTrimmed: !!impressum,
    suppressed: !!hash,
  };
  st.push(auditStatement(env, actor, rid, reapply ? "contact.personal_data_reapplied" : "contact.personal_data_deleted", "contact", contactId, { legalBasis, companyId: c?.company_id ?? null, ...counts, sharedRetained: shared.results.length }));
  await commit(env, st);
  return { id: contactId, deleted: true, ...counts, sharedRetained: shared.results.map((r) => r.id) };
}

export async function deletePersonalData(request, env, actor, rid, contactId) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const legalBasis = str(i.legalBasis, "base legal / pedido", 500);
  const r = await purgeContact(env, actor, rid, contactId, legalBasis);
  return {
    ...r,
    note: "Apagado do banco vigente e do R2. Fora do Compass: cópias de recuperação do D1 (Time Travel e exportações), a caixa de e-mail e o diário local da ponte — ver EXCLUSAO-PURGA-PLANO.md. Mensagens de outros remetentes na conversa (sharedRetained) ficam para revisão.",
  };
}

// Purga do conteúdo de UMA mensagem recebida (ex.: resposta de colega que cita a pessoa), por decisão do Administrador.
export async function purgeInboundContent(request, env, actor, rid, inboundId) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 10) fail(422, "reason_required", "Descreva o motivo da purga (mínimo 10 caracteres).");
  const m = await s(env, "SELECT id,r2_key,content_purged_at FROM inbound_messages WHERE tenant_id=? AND id=?", actor.tenant_id, inboundId).first();
  if (!m) fail(404, "inbound_not_found", "Mensagem não encontrada.");
  if (m.content_purged_at) return { id: m.id, purged: true, idempotent: true };
  if (m.r2_key?.startsWith("inbound/")) {
    if (!env.FILES) fail(503, "files_unavailable", "Armazenamento indisponível.");
    await env.FILES.delete(m.r2_key);
  }
  const at = now();
  await commit(env, [
    s(env, "UPDATE inbound_messages SET r2_key='purged',message_id=NULL,in_reply_to=NULL,references_json='[]',content_purged_at=? WHERE id=?", at, m.id),
    s(env, "DELETE FROM task_revisions WHERE tenant_id=? AND task_id IN (SELECT id FROM tasks WHERE tenant_id=? AND inbound_id=?)", actor.tenant_id, actor.tenant_id, m.id),
    s(env, "UPDATE tasks SET script=NULL,result_json=NULL,channel_note=NULL,next_action=NULL WHERE tenant_id=? AND inbound_id=?", actor.tenant_id, m.id),
    auditStatement(env, actor, rid, "inbound.content_purged", "inbound_message", m.id, { reason }),
  ]);
  return { id: m.id, purged: true };
}

// Depois de restaurar o D1: refaz as exclusões registradas no R2 que o banco não tem. Idempotente.
export async function reapplyErasures(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  await bodyJson(request);
  if (!env.FILES) fail(503, "files_unavailable", "Armazenamento indisponível.");
  const inR2 = await ledgerInR2(env, actor.tenant_id);
  const inD1 = new Set((await s(env, "SELECT contact_id FROM erasure_ledger WHERE tenant_id=?", actor.tenant_id).all()).results.map((r) => r.contact_id));
  const done = [];
  for (const id of inR2.filter((x) => !inD1.has(x))) {
    const obj = await env.FILES.get(ledgerKey(actor.tenant_id, id));
    const entry = obj ? JSON.parse(await obj.text()) : {};
    const r = await purgeContact(env, actor, rid, id, `Reaplicação após restauração do banco (exclusão original em ${entry.erasedAt ?? "data não registrada"})`, { emailHash: entry.emailHash ?? null, erasedAt: entry.erasedAt ?? null, reapply: true });
    done.push({ contactId: id, ...r });
  }
  return { reapplied: done.length, items: done, consistent: await erasuresConsistent(env, actor.tenant_id) };
}

// Tarefas de resposta sem vínculo com a mensagem (anteriores à 0032 e não ligadas pela correção por falta de evidência
// inequívoca). Para cada uma, as mensagens candidatas da mesma empresa no mesmo dia e as ambíguas do dia — sem PII.
const REPLY_KINDS = "('reply_followup','review_ambiguous')";
export async function replyTasksForReview(env, actor) {
  requireRole(actor, ADMIN);
  const rows = (await s(env, `SELECT id,company_id,commodity,kind,due_date,status FROM tasks WHERE tenant_id=? AND inbound_id IS NULL AND kind IN ${REPLY_KINDS} ORDER BY due_date,id`, actor.tenant_id).all()).results;
  const items = [];
  for (const t of rows) {
    const candidates = (
      await s(
        env,
        `SELECT id,classification,correlation,company_id,commodity,received_at FROM inbound_messages WHERE tenant_id=? AND substr(processed_at,1,10)=?
           AND classification IN ('human','auto_reply','unclassified','unsubscribe') AND correlation<>'none' AND (company_id=? OR company_id IS NULL)
         ORDER BY received_at`,
        actor.tenant_id, t.due_date, t.company_id,
      ).all()
    ).results;
    items.push({ task: t, candidates });
  }
  return { items, rule: "Ligação automática só com uma única mensagem da mesma empresa no dia; o resto é decisão manual." };
}

// Ligação manual decidida pelo Administrador (com motivo), auditada; nunca troca um vínculo existente.
export async function linkTaskToInbound(request, env, actor, rid, taskId) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 10) fail(422, "reason_required", "Descreva a evidência da ligação (mínimo 10 caracteres).");
  const inboundId = str(i.inboundId, "mensagem", 80);
  const t = await s(env, `SELECT id,inbound_id,company_id FROM tasks WHERE tenant_id=? AND id=? AND kind IN ${REPLY_KINDS}`, actor.tenant_id, taskId).first();
  if (!t) fail(404, "task_not_found", "Tarefa de resposta não encontrada.");
  if (t.inbound_id) fail(409, "task_already_linked", "A tarefa já está ligada a uma mensagem.");
  const m = await s(env, "SELECT id FROM inbound_messages WHERE tenant_id=? AND id=?", actor.tenant_id, inboundId).first();
  if (!m) fail(404, "inbound_not_found", "Mensagem não encontrada.");
  await commit(env, [
    s(env, "UPDATE tasks SET inbound_id=? WHERE id=? AND inbound_id IS NULL", m.id, t.id),
    auditStatement(env, actor, rid, "task.inbound_linked", "task", t.id, { inboundId: m.id, manual: true, reason }),
  ]);
  return { id: t.id, inboundId: m.id };
}
