// Descarte de empresa e exclusão de dados pessoais (P2-T13; R23.4–R23.6, R9.1).
import { bodyJson, fail, str, requireRole, APPROVER_ROLES } from "./http.js";
import { company } from "./store.js";
import { discardCompanyData } from "./erasure.js";

const ADMIN = new Set(["admin"]);

// Descarte mantém histórico e motivo; nada pendente continua (envios, tarefas, fichas). C1 (decisão de 08/10/2026):
// os dados pessoais da empresa são eliminados antes de o descarte ser marcado (src/erasure.js, discardCompanyData).
export async function discardCompany(request, env, actor, rid, companyId) {
  requireRole(actor, APPROVER_ROLES);
  await company(env, actor, companyId);
  const i = await bodyJson(request);
  const reason = str(i.reason, "motivo", 1000);
  if (reason.length < 5) fail(422, "reason_required", "Descreva o motivo do descarte.");
  return discardCompanyData(env, actor, rid, companyId, { reason });
}

// Exclusão de dados pessoais do contato: src/erasure.js (R9.1, R9.1.2, R23.5).
export { deletePersonalData, PURGED } from "./erasure.js";
