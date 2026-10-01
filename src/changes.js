// Descarte de empresa e exclusão de dados pessoais (P2-T13; R23.4–R23.6, R9.1).
import { bodyJson, fail, str, requireRole, APPROVER_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, company } from "./store.js";

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

// Exclusão de dados pessoais do contato: src/erasure.js (R9.1, R9.1.2, R23.5).
export { deletePersonalData, PURGED } from "./erasure.js";
