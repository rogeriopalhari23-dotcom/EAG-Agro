// Descarte de empresa e exclusão de dados pessoais (P2-T13; R23.4–R23.6, R9.1).
import { bodyJson, fail, str, requireRole, APPROVER_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, company } from "./store.js";
import { encryptPii } from "./crypto.js";

export const PURGED = "[conteúdo excluído a pedido do titular]";

const ADMIN = new Set(["admin"]);

// Descarte mantém histórico e motivo; nada pendente continua (envios, tarefas, fichas).
export async function discardCompany(request, env, actor, rid, companyId) {
  requireRole(actor, APPROVER_ROLES);
  const c = await company(env, actor, companyId);
  const i = await bodyJson(request);
  const reason = str(i.reason, "motivo", 1000);
  if (reason.length < 5) fail(422, "reason_required", "Descreva o motivo do descarte.");
  const at = now();
  await commit(env, [
    s(env, "UPDATE companies SET pipeline_status='inactive',revision=revision+1,updated_at=? WHERE tenant_id=? AND id=?", at, actor.tenant_id, companyId),
    s(env, "UPDATE send_outbox SET status='cancelled',block_reason='company_discarded',updated_at=? WHERE tenant_id=? AND company_id=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')", at, actor.tenant_id, companyId),
    s(env, "UPDATE tasks SET status='cancelled',suspended_reason='empresa descartada' WHERE tenant_id=? AND company_id=? AND status IN ('open','suspended')", actor.tenant_id, companyId),
    s(env, "UPDATE fichas SET status='discarded',status_reason=?,row_version=row_version+1,updated_at=? WHERE tenant_id=? AND company_id=? AND status<>'discarded'", `empresa descartada: ${reason}`, at, actor.tenant_id, companyId),
    auditStatement(env, actor, rid, "company.discarded", "company", companyId, { reason, previousStatus: c.pipeline_status }),
  ]);
  return { id: companyId, status: "inactive" };
}

// Exclusão de dados pessoais do contato (R9.1, R23.5): apaga os campos cifrados do contato e também o conteúdo que
// pode citar a pessoa — textos congelados das fichas (trocados por marcador; identidade e hash da mensagem mantidos),
// mensagens recebidas no R2, roteiros e resultados de tarefas, candidata de pessoa e referência de verificação. Mantém
// o hash do e-mail e o grava na supressão (R9.1.2) para não voltar a contatar. Registra só a base legal (sem PII).
export async function deletePersonalData(request, env, actor, rid, contactId) {
  requireRole(actor, ADMIN);
  const c = await s(env, "SELECT * FROM contacts WHERE tenant_id=? AND id=?", actor.tenant_id, contactId).first();
  if (!c) fail(404, "contact_not_found", "Contato não encontrado.");
  const i = await bodyJson(request);
  const legalBasis = str(i.legalBasis, "base legal / pedido", 500);
  const at = now();
  const [messages, inbound] = await env.DB.batch([
    s(env, "SELECT m.id,m.subject_enc FROM ficha_messages m JOIN ficha_versions v ON v.id=m.version_id JOIN fichas f ON f.id=v.ficha_id WHERE f.tenant_id=? AND m.contact_id=? AND m.purged_at IS NULL", actor.tenant_id, contactId),
    s(
      env,
      `SELECT id,r2_key FROM inbound_messages WHERE tenant_id=? AND content_purged_at IS NULL
         AND ((? IS NOT NULL AND from_hash=?) OR outbox_id IN (SELECT id FROM send_outbox WHERE tenant_id=? AND contact_id=?))`,
      actor.tenant_id, c.email_hash, c.email_hash, actor.tenant_id, contactId,
    ),
  ]);
  // O conteúdo no R2 sai antes do registro no banco: se o banco falhar, a repetição do pedido termina a purga.
  const stored = inbound.results.map((m) => m.r2_key).filter((k) => k && k.startsWith("inbound/"));
  if (stored.length) {
    if (!env.FILES) fail(503, "files_unavailable", "Armazenamento de mensagens indisponível: a exclusão não pode ser concluída.");
    await env.FILES.delete(stored);
  }
  const marker = await encryptPii(PURGED, env);
  const statements = [
    s(
      env,
      "UPDATE contacts SET full_name_encrypted=NULL,job_title_encrypted=NULL,email_encrypted=NULL,phone_encrypted=NULL,linkedin_url_encrypted=NULL,relationship_note=NULL,source_url=NULL,updated_at=? WHERE tenant_id=? AND id=?",
      at, actor.tenant_id, contactId,
    ),
    s(env, "UPDATE send_outbox SET status='cancelled',block_reason='personal_data_deleted',updated_at=? WHERE tenant_id=? AND contact_id=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')", at, actor.tenant_id, contactId),
    s(env, "UPDATE tasks SET status='cancelled',suspended_reason='dados pessoais excluídos' WHERE tenant_id=? AND contact_id=? AND status IN ('open','suspended')", actor.tenant_id, contactId),
    s(env, "UPDATE tasks SET script=NULL,result_json=NULL WHERE tenant_id=? AND contact_id=?", actor.tenant_id, contactId),
    ...messages.results.map((m) =>
      s(env, "UPDATE ficha_messages SET subject_enc=?,body_enc=?,body_html_enc=NULL,purged_at=? WHERE id=?", m.subject_enc == null ? null : marker, marker, at, m.id),
    ),
    ...inbound.results.map((m) => s(env, "UPDATE inbound_messages SET r2_key='purged',content_purged_at=? WHERE id=?", at, m.id)),
    s(
      env,
      "UPDATE person_candidates SET name_encrypted=?,title_encrypted=NULL,email_encrypted=NULL,email_source_url=NULL,phone_encrypted=NULL,phone_source_url=NULL,status='dismissed',dismiss_reason='personal_data_deleted' WHERE tenant_id=? AND contact_id=?",
      marker, actor.tenant_id, contactId,
    ),
    s(env, "UPDATE contact_verifications SET source_reference=NULL WHERE tenant_id=? AND contact_id=?", actor.tenant_id, contactId),
  ];
  if (c.email_hash)
    statements.push(
      s(
        env,
        "INSERT OR IGNORE INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,'email','personal_data_deleted','manual',?)",
        crypto.randomUUID(), actor.tenant_id, c.email_hash, actor.id,
      ),
    );
  statements.push(
    auditStatement(env, actor, rid, "contact.personal_data_deleted", "contact", contactId, {
      legalBasis, companyId: c.company_id, fichaMessagesPurged: messages.results.length, inboundPurged: inbound.results.length, suppressed: !!c.email_hash,
    }),
  );
  await commit(env, statements);
  return {
    id: contactId,
    deleted: true,
    fichaMessagesPurged: messages.results.length,
    inboundPurged: inbound.results.length,
    suppressed: !!c.email_hash,
    note: "Dados cifrados e conteúdos apagados do banco vigente e do R2. Cópias de recuperação do D1 (Time Travel) continuam recuperáveis pelo prazo do plano; a caixa de e-mail (Enviados/Entrada) fica fora do Compass.",
  };
}
