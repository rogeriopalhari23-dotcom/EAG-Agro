// Perfil comprador por empresa + unidade + produto e ICP da skill (P2-T6; R14, R15.6, K1, K3).
import { bodyJson, fail, str, oneOf, requireRole, WRITE_ROLES, APPROVER_ROLES } from "./http.js";
import { statement as s, company, commit, auditStatement, now, product } from "./store.js";

export const PROFILE_CLASSES = ["final_consumer_confirmed", "possible_final_consumer", "trader_distributor", "unconfirmed"];
const SMALL_SIZE_CODES = new Set(["01", "03"]); // Receita: 01 Micro, 03 Pequeno porte (K1: médias e média-mais)

// Regra K1/K3 pura. sizeCode vem da fonte (Receita via Casa dos Dados); sizeBand é o porte manual com fonte (exterior).
export function icpStatus({ profileClass, sizeCode = null, sizeBand = null, isGiant = false }) {
  if (profileClass === "trader_distributor") return "out_trader";
  if (isGiant || sizeBand === "giant") return "out_giant";
  if (SMALL_SIZE_CODES.has(sizeCode) || sizeBand === "small") return "out_small";
  if (sizeCode === "05" || sizeBand === "medium" || sizeBand === "medium_plus") return "in_icp";
  return "pending_size";
}

// Quem pode ter ficha (consumida pela ficha, P2-T9). Sempre devolve o motivo.
export function canHaveFicha(p) {
  if (!p) return { ok: false, reason: "Perfil comprador não registrado para esta commodity." };
  switch (p.icp_status) {
    case "in_icp":
      return { ok: true };
    case "out_trader":
      return p.exception_by
        ? { ok: true, note: `Exceção de ${p.exception_by} em ${p.exception_at}: ${p.exception_reason}` }
        : { ok: false, reason: "Trader/distribuidor fica fora da prospecção ativa sem exceção registrada (K3)." };
    case "out_giant":
      return p.relationship_note
        ? { ok: true, note: `Relacionamento prévio registrado por ${p.relationship_by} em ${p.relationship_at}.` }
        : { ok: false, reason: "Gigante do setor só com relacionamento prévio registrado (R14.6)." };
    case "pending_size":
      return p.size_call_goal
        ? { ok: true, note: "Porte desconhecido: qualificar o porte é objetivo da ligação (R14.8)." }
        : { ok: false, reason: "Porte desconhecido: resolva o porte ou registre a qualificação do porte como objetivo da ligação (R14.8)." };
    default:
      return { ok: false, reason: "Fora do ICP — porte (R14.6)." };
  }
}

// R15.6: CEO/diretoria sem relacionamento fica fora do alvo preferencial; operação/RH/logística fora do ICP.
export function contactTargetFlag(jobTitle, relationshipNote) {
  const t = String(jobTitle || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (/\b(rh|recursos humanos|logistica|operac|expedicao|producao)\b/.test(t)) return "out_of_icp_role";
  if (/\b(ceo|presidente|diretor|diretora|diretoria|c-level|socio diretor)\b/.test(t) && !relationshipNote) return "executive_without_relationship";
  return null;
}

async function sizeFor(env, tenant, companyId, unitId) {
  if (unitId) {
    const u = await s(env, "SELECT size_code FROM company_units WHERE tenant_id=? AND id=? AND company_id=?", tenant, unitId, companyId).first();
    if (!u) fail(404, "unit_not_found", "Unidade não encontrada nesta empresa.");
    return u.size_code;
  }
  // Porte é da empresa (Receita registra por CNPJ, repetido nas filiais): usa o valor conhecido mais frequente.
  const row = await s(
    env,
    "SELECT size_code, COUNT(*) n FROM company_units WHERE tenant_id=? AND company_id=? AND size_code IS NOT NULL GROUP BY size_code ORDER BY n DESC LIMIT 1",
    tenant,
    companyId,
  ).first();
  return row?.size_code ?? null;
}

// R14.2: confirmado exige evidência empresarial válida da própria empresa (nunca de mercado) ou confirmação direta.
async function basisOk(env, tenant, companyId, productId, evidenceId) {
  if (evidenceId) {
    const e = await s(env, "SELECT * FROM evidence WHERE tenant_id=? AND id=?", tenant, evidenceId).first();
    if (!e || e.company_id !== companyId) fail(422, "profile_needs_evidence", "A evidência precisa ser desta empresa.");
    if (e.category !== "business" || e.validation_status !== "valid")
      fail(422, "profile_needs_evidence", "Consumidor final confirmado exige evidência empresarial válida; dado de mercado não comprova compra.");
    if (e.product_id && e.product_id !== productId) {
      const [a, b] = await Promise.all([product(env, tenant, e.product_id), product(env, tenant, productId)]);
      if (a.commodity !== b.commodity) fail(422, "profile_needs_evidence", "A evidência é de outra commodity.");
    }
    return;
  }
  const direct = await s(
    env,
    "SELECT v.id FROM contact_verifications v JOIN contacts c ON c.id=v.contact_id WHERE v.tenant_id=? AND c.company_id=? AND v.verification_type='direct_demand' AND v.status='confirmed' LIMIT 1",
    tenant,
    companyId,
  ).first();
  if (!direct)
    fail(422, "profile_needs_evidence", "Consumidor final confirmado exige evidência empresarial válida ou confirmação direta de demanda.");
}

export async function upsertProfile(request, env, actor, rid, companyId) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, companyId),
    i = await bodyJson(request),
    p = await product(env, actor.tenant_id, str(i.productId, "produto", 80));
  const profileClass = oneOf(i.profileClass, PROFILE_CLASSES, "perfil");
  const unitId = str(i.unitId, "unidade", 80, true);
  const basis = str(i.basis, "fundamento", 1000);
  const evidenceId = str(i.evidenceId, "evidência", 80, true);
  if (profileClass === "final_consumer_confirmed") await basisOk(env, actor.tenant_id, companyId, p.id, evidenceId);
  const unitKey = unitId || "";
  const prev = await s(
    env,
    "SELECT * FROM buyer_profiles WHERE tenant_id=? AND company_id=? AND unit_key=? AND product_id=?",
    actor.tenant_id, companyId, unitKey, p.id,
  ).first();
  if (prev && i.expectedRevision !== prev.revision) fail(409, "edit_conflict", "Recarregue o perfil antes de alterar.");
  let isGiant = prev?.is_giant ?? 0;
  if (i.isGiant !== undefined) {
    if (typeof i.isGiant !== "boolean") fail(422, "invalid_field", "Campo inválido: gigante.");
    isGiant = i.isGiant ? 1 : 0;
  }
  const sizeCode = await sizeFor(env, actor.tenant_id, companyId, unitId);
  const status = icpStatus({ profileClass, sizeCode, sizeBand: c.size_band ?? null, isGiant: !!isGiant });
  const id = prev?.id ?? crypto.randomUUID();
  await commit(env, [
    prev
      ? s(
          env,
          "UPDATE buyer_profiles SET profile_class=?,basis=?,evidence_id=?,icp_status=?,is_giant=?,revision=CASE WHEN revision=? THEN revision+1 ELSE -1 END,updated_by=?,updated_at=? WHERE id=?",
          profileClass, basis, evidenceId, status, isGiant, prev.revision, actor.id, now(), id,
        )
      : s(
          env,
          "INSERT INTO buyer_profiles(id,tenant_id,company_id,unit_key,product_id,profile_class,basis,evidence_id,icp_status,is_giant,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          id, actor.tenant_id, companyId, unitKey, p.id, profileClass, basis, evidenceId, status, isGiant, actor.id,
        ),
    auditStatement(env, actor, rid, "profile.saved", "buyer_profile", id, {
      companyId, productId: p.id, unitId, profileClass, icpStatus: status, sizeCode, evidenceId,
    }),
  ]);
  return { id, icpStatus: status, revision: (prev?.revision ?? 0) + 1, ficha: canHaveFicha({ ...(prev || {}), icp_status: status }) };
}

// Exceção de trader (K3, só gestores), relacionamento com gigante (R14.6) e objetivo de porte (R14.8).
export async function changeProfile(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request);
  const p = await s(env, "SELECT * FROM buyer_profiles WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!p) fail(404, "profile_not_found", "Perfil não encontrado.");
  if (i.expectedRevision !== p.revision) fail(409, "edit_conflict", "Recarregue o perfil antes de alterar.");
  const at = now();
  const sets = [],
    args = [],
    meta = {};
  if (i.exceptionReason !== undefined) {
    requireRole(actor, APPROVER_ROLES);
    if (p.icp_status !== "out_trader") fail(409, "exception_not_applicable", "Exceção vale só para trader/distribuidor.");
    const reason = str(i.exceptionReason, "motivo da exceção", 1000);
    if (reason.length < 10) fail(422, "reason_required", "Descreva o motivo da exceção.");
    sets.push("exception_by=?", "exception_at=?", "exception_reason=?");
    args.push(actor.id, at, reason);
    meta.exception = true;
  }
  if (i.relationshipNote !== undefined) {
    const note = str(i.relationshipNote, "relacionamento prévio", 1000);
    if (note.length < 10) fail(422, "reason_required", "Descreva o relacionamento prévio.");
    sets.push("relationship_note=?", "relationship_by=?", "relationship_at=?");
    args.push(note, actor.id, at);
    meta.relationship = true;
  }
  if (i.sizeCallGoal !== undefined) {
    if (typeof i.sizeCallGoal !== "boolean") fail(422, "invalid_field", "Campo inválido: objetivo de porte.");
    sets.push("size_call_goal=?", "size_call_goal_by=?");
    args.push(i.sizeCallGoal ? 1 : 0, i.sizeCallGoal ? actor.id : null);
    meta.sizeCallGoal = i.sizeCallGoal;
  }
  if (!sets.length) fail(422, "nothing_to_change", "Nada a alterar.");
  await commit(env, [
    s(
      env,
      `UPDATE buyer_profiles SET ${sets.join(",")},revision=CASE WHEN revision=? THEN revision+1 ELSE -1 END,updated_by=?,updated_at=? WHERE id=?`,
      ...args, p.revision, actor.id, at, id,
    ),
    auditStatement(env, actor, rid, "profile.changed", "buyer_profile", id, meta),
  ]);
  const next = await s(env, "SELECT * FROM buyer_profiles WHERE id=?", id).first();
  return { id, revision: next.revision, ficha: canHaveFicha(next) };
}

export async function listProfiles(env, actor, companyId) {
  await company(env, actor, companyId);
  const rows = (
    await s(env, "SELECT * FROM buyer_profiles WHERE tenant_id=? AND company_id=? ORDER BY product_id,unit_key", actor.tenant_id, companyId).all()
  ).results;
  return rows.map((r) => ({ ...r, ficha: canHaveFicha(r) }));
}
