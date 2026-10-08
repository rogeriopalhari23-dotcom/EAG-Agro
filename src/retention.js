// G1 (08/10/2026): retenção A1 aprovada por Rogério Palhari e revisão anual registrada. A lista de supressão, os hashes
// do registro de exclusões e os avisos da empresa ficam enquanto houver prospecção no canal; a cada 12 meses uma revisão
// é registrada. Registrar uma revisão NUNCA expira, remove nem libera supressão: a eliminação (G1b) não existe aqui.
import { bodyJson, fail, str, oneOf, requireRole } from "./http.js";
import { statement as s, commit, auditStatement, now } from "./store.js";

const ADMIN = new Set(["admin"]);
const REMIND_DAYS = 30;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const addYear = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y + 1, m - 1, day));
  return t.toISOString().slice(0, 10);
};
const days = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

// Situação da revisão anual de A: vence 12 meses depois da última revisão (ou da decisão, se ainda não houve revisão).
export async function retentionReviewStatus(env, tenant, today = now().slice(0, 10)) {
  const [policy, last] = await Promise.all([
    s(env, "SELECT option_code,decided_on,decided_by FROM retention_policies WHERE tenant_id=? AND item='A' ORDER BY decided_on DESC,recorded_at DESC LIMIT 1", tenant).first(),
    s(env, "SELECT reviewed_on,responsible,decision FROM retention_reviews WHERE tenant_id=? AND item='A' ORDER BY reviewed_on DESC,recorded_at DESC LIMIT 1", tenant).first(),
  ]);
  if (!policy) return { policy: null, due: null, remind: true, overdue: false, reason: "retention_policy_missing" };
  const base = last && last.reviewed_on > policy.decided_on ? last.reviewed_on : policy.decided_on;
  const due = addYear(base);
  const left = days(today, due);
  return { policy: policy.option_code, decidedOn: policy.decided_on, lastReview: last ?? null, due, daysLeft: left, remind: left <= REMIND_DAYS, overdue: left < 0 };
}

export async function retentionOverview(env, actor) {
  const [policies, reviews] = await Promise.all([
    s(env, "SELECT item,option_code,covers,criterion,review,end_action,option_text,decided_by,decided_on FROM retention_policies WHERE tenant_id=? ORDER BY item,decided_on DESC,recorded_at DESC", actor.tenant_id).all(),
    s(env, "SELECT reviewed_on,responsible,decision,basis,recorded_at FROM retention_reviews WHERE tenant_id=? ORDER BY reviewed_on DESC,recorded_at DESC LIMIT 50", actor.tenant_id).all(),
  ]);
  // Vale a decisão mais recente de cada item.
  const current = new Map();
  for (const p of policies.results) if (!current.has(p.item)) current.set(p.item, p);
  return { policies: [...current.values()], reviews: reviews.results, status: await retentionReviewStatus(env, actor.tenant_id) };
}

// POST /api/retention/reviews (Administrador). Só registra; "elimination_to_assess" não apaga nada (G1b não implementado).
export async function addRetentionReview(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const reviewedOn = str(i.reviewedOn, "data da revisão", 10);
  if (!DATE.test(reviewedOn) || Number.isNaN(Date.parse(reviewedOn))) fail(422, "invalid_date", "Data no formato AAAA-MM-DD.");
  if (reviewedOn > now().slice(0, 10)) fail(422, "future_date", "A revisão não pode ter data futura.");
  const responsible = str(i.responsible, "responsável", 200);
  if (responsible.trim().length < 3) fail(422, "responsible_required", "Informe quem fez a revisão.");
  const decision = oneOf(i.decision, ["keep", "elimination_to_assess"], "decisão");
  const basis = str(i.basis, "fundamento", 1000);
  if (basis.trim().length < 10) fail(422, "basis_required", "Descreva o fundamento da revisão.");
  const id = crypto.randomUUID();
  await commit(env, [
    s(env, "INSERT INTO retention_reviews(id,tenant_id,item,reviewed_on,responsible,decision,basis,recorded_by,request_id) VALUES (?,?,'A',?,?,?,?,?,?)", id, actor.tenant_id, reviewedOn, responsible, decision, basis, actor.id, rid),
    auditStatement(env, actor, rid, "retention.reviewed", "retention", id, { item: "A", decision, reviewedOn }),
  ]);
  return {
    id,
    decision,
    note: decision === "elimination_to_assess"
      ? "Registrado. Nada foi removido: a eliminação exige rotina própria (G1b), ainda não implementada, e nova decisão."
      : "Registrado. A lista de supressão continua como está.",
    status: await retentionReviewStatus(env, actor.tenant_id),
  };
}
