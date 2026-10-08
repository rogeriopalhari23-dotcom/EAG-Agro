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
import { splitExtension, normalizePhone, isSuppressingKind, phoneSuppressionStatements, noticeStatements, parseClassification, phoneHashOf } from "./phone-privacy.js";

// D-EXC (opção a): telefones ligados ao contato (no contato, na pessoa de compras vinculada e nas ligações dele), com
// a origem de cada um e se o número também está ligado a terceiros (outras ligações ou outros contatos da empresa).
async function contactPhones(env, tenant, contactId) {
  const c = await s(env, "SELECT company_id,phone_encrypted FROM contacts WHERE tenant_id=? AND id=?", tenant, contactId).first();
  if (!c) return [];
  const [people, tasks, others, otherPeople] = await env.DB.batch([
    s(env, "SELECT phone_encrypted FROM person_candidates WHERE tenant_id=? AND contact_id=? AND phone_encrypted IS NOT NULL", tenant, contactId),
    s(env, "SELECT phone_enc FROM tasks WHERE tenant_id=? AND contact_id=? AND phone_enc IS NOT NULL", tenant, contactId),
    s(env, "SELECT phone_encrypted FROM contacts WHERE tenant_id=? AND company_id=? AND id<>? AND phone_encrypted IS NOT NULL", tenant, c.company_id, contactId),
    s(env, "SELECT phone_encrypted FROM person_candidates WHERE tenant_id=? AND company_id=? AND (contact_id IS NULL OR contact_id<>?) AND phone_encrypted IS NOT NULL", tenant, c.company_id, contactId),
  ]);
  const found = new Map();
  const add = (raw, origin) => {
    const { base, extension } = splitExtension(raw);
    const normalized = normalizePhone(base);
    const key = normalized ?? `raw:${base}`;
    const e = found.get(key) ?? { normalized, origins: new Set(), extension: false };
    e.origins.add(origin);
    if (extension) e.extension = true;
    found.set(key, e);
  };
  if (c.phone_encrypted) add(await decryptPii(c.phone_encrypted, env), "contato");
  for (const r of people.results) add(await decryptPii(r.phone_encrypted, env), "pessoa de compras");
  for (const r of tasks.results) add(await decryptPii(r.phone_enc, env), "ligação do contato");
  const thirdParty = new Set();
  for (const r of [...others.results, ...otherPeople.results]) {
    const n = normalizePhone(splitExtension(await decryptPii(r.phone_encrypted, env)).base);
    if (n) thirdParty.add(n);
  }
  const out = [];
  for (const e of found.values()) {
    const hash = e.normalized ? await phoneHashOf(env, tenant, e.normalized) : null;
    const otherTasks = hash
      ? (await s(env, "SELECT COUNT(*) n FROM tasks WHERE tenant_id=? AND phone_hash=? AND (contact_id IS NULL OR contact_id<>?)", tenant, hash, contactId).first()).n
      : 0;
    out.push({ normalized: e.normalized, hash, origins: [...e.origins], extension: e.extension, linkedToOthers: otherTasks > 0 || (e.normalized != null && thirdParty.has(e.normalized)) });
  }
  return out.map((p) => ({ ...p, companyId: c.company_id }));
}

// Plano de cada telefone na exclusão: suprimir (pessoal ou ramal direto, sem terceiros) ou aviso na empresa.
// Falta de classificação não impede a exclusão: vira aviso "não confirmado", com pendência.
async function phoneErasureStatements(env, actor, rid, contactId, phones, classified) {
  const st = [];
  const counts = { phonesSuppressed: 0, phoneNotices: 0, phonePending: 0, tasksSuspendedByPhone: 0 };
  for (const p of phones) {
    const given = p.normalized ? classified.get(p.normalized) : null;
    const notice = (classification, reason) => {
      st.push(...noticeStatements(env, actor, rid, { companyId: p.companyId, kind: "erasure_shared_phone", classification, sourceKind: given?.sourceKind ?? "not_informed", sourceUrl: given?.sourceUrl ?? null, reason, phoneHash: p.hash }));
      counts.phoneNotices++;
      if (classification === "unconfirmed" || classification === "conflict") counts.phonePending++;
    };
    if (!p.normalized) notice("unconfirmed", "unparseable");
    else if (p.extension) {
      // Ramal atrás do número geral: a base é da empresa e nunca é suprimida.
      if (given?.kind === "extension" || given?.kind === "shared") notice("extension", "classified_extension");
      else if (given && isSuppressingKind(given.kind)) notice("conflict", "classified_extension");
      else notice("unconfirmed", "not_classified");
    } else if (given && isSuppressingKind(given.kind)) {
      if (p.linkedToOthers) notice("conflict", "linked_to_others");
      else {
        const sup = await phoneSuppressionStatements(env, actor, rid, p.hash, "personal_data_deleted", { exceptContactId: contactId, context: { contactId, kind: given.kind } });
        st.push(...sup.statements);
        counts.phonesSuppressed++;
        counts.tasksSuspendedByPhone += sup.suspended;
      }
    } else if (given?.kind === "shared") notice("shared", "classified_shared");
    else if (given?.kind === "extension") notice("extension", "classified_extension");
    else notice("unconfirmed", "not_classified");
  }
  return { st, counts };
}

// GET /api/contacts/:id/erasure-phones — telefones ligados ao contato, para o Administrador classificar antes da
// exclusão (pessoal, ramal direto, número geral, ramal atrás do geral).
export async function erasurePhones(env, actor, contactId) {
  requireRole(actor, ADMIN);
  const c = await s(env, "SELECT id FROM contacts WHERE tenant_id=? AND id=?", actor.tenant_id, contactId).first();
  if (!c) fail(404, "contact_not_found", "Contato não encontrado.");
  const phones = await contactPhones(env, actor.tenant_id, contactId);
  return { items: phones.map(({ normalized, origins, extension, linkedToOthers }) => ({ phone: normalized, unparseable: !normalized, origins, extension, linkedToOthers })) };
}

export const PURGED = "[conteúdo excluído a pedido do titular]";
const ADMIN = new Set(["admin"]);
const ADDRESS = /[^\s<>"'(),;:[\]]+@[^\s<>"'(),;:[\]]+\.[a-z]{2,}/gi;
// Endereço de e-mail em texto de servidor ou nota (ex.: "550 5.1.1 <x@y.de> unknown") vira "[endereço]".
export const redactAddresses = (t) => (t == null ? t : String(t).replace(ADDRESS, "[endereço]"));
const ledgerKey = (tenant, contactId) => `erasures/${tenant}/${contactId}.json`;
// Descarte de empresa (C1): marcador sem textos pessoais nem motivo, escrito ANTES do D1, para reaplicar após restauração.
const discardKey = (tenant, companyId) => `discards/${tenant}/${companyId}.json`;

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
async function discardsInR2(env, tenant) {
  const out = [];
  let cursor;
  do {
    const page = await env.FILES.list({ prefix: `discards/${tenant}/`, cursor });
    for (const o of page.objects) out.push(o.key.slice(`discards/${tenant}/`.length).replace(/\.json$/, ""));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

export async function erasuresConsistent(env, tenant) {
  if (!env.FILES) return true;
  const [r2, r2Discards] = await Promise.all([ledgerInR2(env, tenant), discardsInR2(env, tenant)]);
  if (!r2.length && !r2Discards.length) return true;
  const d1 = new Set((await s(env, "SELECT contact_id FROM erasure_ledger WHERE tenant_id=?", tenant).all()).results.map((r) => r.contact_id));
  const d1Discards = new Set((await s(env, "SELECT company_id FROM company_discard_ledger WHERE tenant_id=?", tenant).all()).results.map((r) => r.company_id));
  // Descarte iniciado (marcador no R2) e não concluído no D1 também trava envio e aprovação até ser refeito.
  return r2.every((id) => d1.has(id)) && r2Discards.every((id) => d1Discards.has(id));
}

// mode "request": pedido do titular (supressão do e-mail, plano dos telefones, registro próprio de exclusão).
// mode "discard": descarte da empresa (C1): mesma eliminação dos dados pessoais, SEM supressão (descarte não é
// oposição), sem plano de telefone e sem registro individual (o descarte tem o seu).
async function purgeContact(env, actor, rid, contactId, legalBasis, { emailHash: knownHash = null, erasedAt = null, reapply = false, phoneClassification = new Map(), mode = "request" } = {}) {
  const request = mode === "request";
  const tenant = actor.tenant_id;
  const at = now();
  const c = await s(env, "SELECT * FROM contacts WHERE tenant_id=? AND id=?", tenant, contactId).first();
  if (!c && !reapply) fail(404, "contact_not_found", "Contato não encontrado.");
  const hash = c?.email_hash ?? knownHash;
  if (!env.FILES) fail(503, "files_unavailable", "Armazenamento indisponível: a exclusão não pode ser registrada fora do banco (proteção contra restauração).");
  // Telefones lidos antes da purga (depois dela não há mais número a classificar).
  const phonePlan = request ? await phoneErasureStatements(env, actor, rid, contactId, await contactPhones(env, tenant, contactId), phoneClassification) : { st: [], counts: {} };

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
  if (!reapply && request) await env.FILES.put(ledgerKey(tenant, contactId), JSON.stringify({ contactId, emailHash: hash, erasedAt: at, requestId: rid }));
  const stored = own.results.filter((m) => !m.content_purged_at).map((m) => m.r2_key).filter((k) => k && k.startsWith("inbound/"));
  if (stored.length) await env.FILES.delete(stored);

  const marker = await encryptPii(PURGED, env);
  const ph = (a) => a.map(() => "?").join(",");
  const st = [
    s(
      env,
      // No descarte também sai o hash do e-mail: sem supressão, ele não teria finalidade (minimização).
      `UPDATE contacts SET full_name_encrypted=NULL,job_title_encrypted=NULL,email_encrypted=NULL,phone_encrypted=NULL,linkedin_url_encrypted=NULL,relationship_note=NULL,source_url=NULL,source_label=?,updated_at=?${request ? "" : ",email_hash=NULL"} WHERE tenant_id=? AND id=?`,
      request ? `dados excluídos em ${at.slice(0, 10)}` : `dados excluídos no descarte da empresa em ${at.slice(0, 10)}`, at, tenant, contactId,
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
         script=NULL,result_json=NULL,channel_note=NULL,next_action=NULL,phone_hash=NULL,phone_enc=NULL
       WHERE tenant_id=? AND (contact_id=? ${allOwnIds.length ? `OR inbound_id IN (${ph(allOwnIds)})` : ""})`,
      tenant, contactId, ...allOwnIds,
    ),
    s(
      env,
      // Relevância é texto livre sobre a pessoa; o hash do nome é pseudônimo e serviria para reconhecê-la pelo nome
      // (R21.3 veda bloquear por nome). Saem os dois; o hash vira um valor sem relação com o nome (NOT NULL e único).
      // Linha já excluída não é regravada (pedido repetido não muda nada); linha restaurada de backup volta sem a marca.
      "UPDATE person_candidates SET name_encrypted=?,name_hash='purged:'||id,relevance=?,title_encrypted=NULL,email_encrypted=NULL,email_source_url=NULL,phone_encrypted=NULL,phone_source_url=NULL,purchase_note=NULL,purchase_source_url=NULL,source_url='purged',status='dismissed',dismiss_reason='personal_data_deleted' WHERE tenant_id=? AND contact_id=? AND dismiss_reason IS NOT 'personal_data_deleted'",
      marker, PURGED, tenant, contactId,
    ),
    s(env, "UPDATE contact_verifications SET source_reference=NULL WHERE tenant_id=? AND contact_id=?", tenant, contactId),
    ...logs.results.map((l) => s(env, "UPDATE send_log SET detail=? WHERE id=?", redactAddresses(l.detail), l.id)),
    ...resolved.results.map((r) => s(env, "UPDATE send_outbox SET resolved_reason=? WHERE id=?", redactAddresses(r.resolved_reason), r.id)),
  ];
  if (impressum) st.push(s(env, "UPDATE research_cache SET result_json=? WHERE source='impressum' AND external_id=?", impressum.json, impressum.origin));
  if (hash && request)
    st.push(
      s(env, "INSERT OR IGNORE INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,'email','personal_data_deleted','manual',?)", crypto.randomUUID(), tenant, hash, actor.id),
    );
  if (request)
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
  st.push(...phonePlan.st);
  const counts = {
    ...phonePlan.counts,
    replyTasksToReview: pendingReview,
    fichaMessagesPurged: messages.results.length,
    inboundPurged: ownIds.length,
    sendLogRedacted: logs.results.length + resolved.results.length,
    impressumCacheTrimmed: !!impressum,
    suppressed: !!hash && request,
  };
  st.push(auditStatement(env, actor, rid, reapply ? "contact.personal_data_reapplied" : "contact.personal_data_deleted", "contact", contactId, { legalBasis, mode, companyId: c?.company_id ?? null, ...counts, sharedRetained: shared.results.length }));
  await commit(env, st);
  return { id: contactId, deleted: true, ...counts, sharedRetained: shared.results.map((r) => r.id) };
}

export async function deletePersonalData(request, env, actor, rid, contactId) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const legalBasis = str(i.legalBasis, "base legal / pedido", 500);
  // Classificação opcional dos telefones (D-EXC): [{ phone, kind, sourceKind, sourceUrl }]. Sem classificação, o número
  // é tratado como compartilhado não confirmado (aviso com pendência); a exclusão dos demais dados segue.
  const phoneClassification = new Map();
  if (i.phones !== undefined) {
    if (!Array.isArray(i.phones) || i.phones.length > 20) fail(422, "invalid_phones", "Informe a classificação dos telefones como lista (até 20).");
    for (const p of i.phones) {
      const n = normalizePhone(splitExtension(str(p.phone, "telefone", 60)).base);
      if (!n) fail(422, "invalid_identifier", "Use telefone com + e código do país.");
      phoneClassification.set(n, parseClassification(p));
    }
  }
  const r = await purgeContact(env, actor, rid, contactId, legalBasis, { phoneClassification });
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
    s(env, "UPDATE tasks SET script=NULL,result_json=NULL,channel_note=NULL,next_action=NULL,phone_hash=NULL,phone_enc=NULL WHERE tenant_id=? AND inbound_id=?", actor.tenant_id, m.id),
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
  const discarded = new Set((await s(env, "SELECT company_id FROM company_discard_ledger WHERE tenant_id=?", actor.tenant_id).all()).results.map((r) => r.company_id));
  for (const companyId of (await discardsInR2(env, actor.tenant_id)).filter((x) => !discarded.has(x))) {
    const obj = await env.FILES.get(discardKey(actor.tenant_id, companyId));
    const entry = obj ? JSON.parse(await obj.text()) : {};
    const r = await discardCompanyData(env, actor, rid, companyId, { reason: `reaplicação do descarte de ${entry.discardedAt ?? "data não registrada"} após restauração do banco`, discardedAt: entry.discardedAt ?? null, reapply: true });
    done.push({ companyId, ...r });
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

// Descarte de empresa (C1, decisão de Rogério Palhari em 08/10/2026): elimina os dados pessoais da empresa e só então
// marca o descarte. Ordem: marcador no R2 (sem motivo nem textos pessoais) → eliminação de cada contato (mesma rotina da
// exclusão, sem supressão) → eliminação no nível da empresa e marcação do descarte numa única gravação. Se algo falhar no
// meio, a empresa NÃO fica descartada; o marcador no R2 trava envio e aprovação até o descarte ser refeito (repetir o
// pedido ou reaplicar). Fica: empresa, motivo (na auditoria e nas fichas), data, canais gerais da empresa e avisos D-EXC.
export async function discardCompanyData(env, actor, rid, companyId, { reason, discardedAt = null, reapply = false } = {}) {
  const tenant = actor.tenant_id;
  if (!env.FILES) fail(503, "files_unavailable", "Armazenamento indisponível: o descarte não pode ser registrado fora do banco (proteção contra restauração).");
  const c = await s(env, "SELECT id,website,pipeline_status FROM companies WHERE tenant_id=? AND id=?", tenant, companyId).first();
  if (!c) fail(404, "company_not_found", "Empresa não encontrada.");
  const at = now();
  // Descarte já concluído: repetir não muda nada (nem reescreve o marcador nem audita de novo).
  const done = await s(env, "SELECT discarded_at FROM company_discard_ledger WHERE tenant_id=? AND company_id=?", tenant, companyId).first();
  if (done && !reapply) return { id: companyId, status: "inactive", already: true, discardedAt: done.discarded_at, suppressionsCreated: 0 };
  // Descarte interrompido antes: retoma com a data do marcador original.
  const prior = reapply ? null : await env.FILES.get(discardKey(tenant, companyId));
  const when = discardedAt ?? (prior ? JSON.parse(await prior.text()).discardedAt : null) ?? at;
  if (!reapply && !prior) await env.FILES.put(discardKey(tenant, companyId), JSON.stringify({ companyId, discardedAt: when, requestId: rid }));
  // Contatos de pessoas (os canais gerais da empresa ficam: são dado da empresa).
  const people = (await s(env, "SELECT id FROM contacts WHERE tenant_id=? AND company_id=? AND (contact_kind IS NULL OR contact_kind<>'company_channel') AND (full_name_encrypted IS NOT NULL OR email_encrypted IS NOT NULL OR phone_encrypted IS NOT NULL OR job_title_encrypted IS NOT NULL OR linkedin_url_encrypted IS NOT NULL)", tenant, companyId).all()).results;
  let contactsPurged = 0;
  for (const p of people) {
    await purgeContact(env, actor, rid, p.id, "Descarte da empresa (C1)", { mode: "discard", reapply });
    contactsPurged++;
  }
  // Aviso legal em cache: só se nenhuma outra empresa ativa usa o mesmo site (conteúdo compartilhado fica).
  const origin = siteOrigin(c.website);
  let impressumPurged = false, impressumShared = false;
  if (origin) {
    const others = (await s(env, "SELECT id,website FROM companies WHERE tenant_id=? AND id<>? AND pipeline_status<>'inactive' AND website IS NOT NULL", tenant, companyId).all()).results;
    impressumShared = others.some((o) => siteOrigin(o.website) === origin);
    impressumPurged = !impressumShared && !!(await s(env, "SELECT 1 x FROM research_cache WHERE source='impressum' AND external_id=?", origin).first());
  }
  const marker = await encryptPii(PURGED, env);
  const peopleLeft = (await s(env, "SELECT COUNT(*) n FROM person_candidates WHERE tenant_id=? AND company_id=? AND name_hash NOT LIKE 'purged:%'", tenant, companyId).first()).n;
  const r = await commit(env, [
    // Pessoas de compras sem contato (ou ainda não purgadas): mesmos campos da exclusão; terceiros de outras empresas não.
    s(
      env,
      "UPDATE person_candidates SET name_encrypted=?,name_hash='purged:'||id,relevance=?,title_encrypted=NULL,email_encrypted=NULL,email_source_url=NULL,phone_encrypted=NULL,phone_source_url=NULL,purchase_note=NULL,purchase_source_url=NULL,source_url='purged',status='dismissed',dismiss_reason='company_discarded' WHERE tenant_id=? AND company_id=? AND name_hash NOT LIKE 'purged:%'",
      marker, PURGED, tenant, companyId,
    ),
    // Tarefas da empresa: roteiro, canal, próxima ação, telefone, resultado (notas) e histórico de edição.
    s(env, "DELETE FROM task_revisions WHERE tenant_id=? AND task_id IN (SELECT id FROM tasks WHERE tenant_id=? AND company_id=?)", tenant, tenant, companyId),
    s(
      env,
      `UPDATE tasks SET status=CASE WHEN status IN ('open','suspended') THEN 'cancelled' ELSE status END,
         suspended_reason=CASE WHEN status IN ('open','suspended') THEN 'empresa descartada' ELSE suspended_reason END,
         script=NULL,result_json=NULL,channel_note=NULL,next_action=NULL,phone_hash=NULL,phone_enc=NULL,phone_source=NULL
       WHERE tenant_id=? AND company_id=?`,
      tenant, companyId,
    ),
    ...(impressumPurged ? [s(env, "DELETE FROM research_cache WHERE source='impressum' AND external_id=?", origin)] : []),
    s(env, "UPDATE companies SET pipeline_status='inactive',revision=revision+1,updated_at=? WHERE tenant_id=? AND id=?", at, tenant, companyId),
    s(env, "UPDATE send_outbox SET status='cancelled',block_reason='company_discarded',updated_at=? WHERE tenant_id=? AND company_id=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')", at, tenant, companyId),
    s(env, "UPDATE fichas SET status='discarded',status_reason=?,row_version=row_version+1,updated_at=? WHERE tenant_id=? AND company_id=? AND status<>'discarded'", `empresa descartada: ${reason}`, at, tenant, companyId),
    s(
      env,
      "INSERT INTO company_discard_ledger(tenant_id,company_id,discarded_at,request_id,reapplied_at) VALUES (?,?,?,?,?) ON CONFLICT(tenant_id,company_id) DO UPDATE SET reapplied_at=COALESCE(excluded.reapplied_at,company_discard_ledger.reapplied_at)",
      tenant, companyId, when, rid, reapply ? at : null,
    ),
    auditStatement(env, actor, rid, reapply ? "company.discard_reapplied" : "company.discarded", "company", companyId, {
      reason, previousStatus: c.pipeline_status, contactsPurged, peopleWithoutContactPurged: peopleLeft, impressumPurged, impressumShared,
    }),
  ]);
  return { id: companyId, status: "inactive", contactsPurged, peopleWithoutContactPurged: peopleLeft, impressumPurged, impressumShared, suppressionsCreated: 0, results: r.length };
}
