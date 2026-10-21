// Relação de uma empresa já cadastrada com mais um produto (pesquisa de outra commodity ou nova pesquisa da mesma).
// Identidade da empresa e das unidades fica como está; a relação unidade × produto (perfil comprador) e as evidências
// dessa relação são acrescentadas só quando faltam, sem duplicar nem substituir a relação com outra commodity. Ausência
// de evidência para um produto não mexe nas relações comprovadas com outros.
// Supressões, exclusões, pausas e restrições continuam valendo pelo próprio alcance (são aplicadas no contato:
// src/restrictions.js); a nova relação só as informa, nunca as remove nem as contorna.
import { statement as s } from "./store.js";

const norm = (x) => String(x ?? "").trim().toLowerCase();

// dispatch(path, method, body): rotas do Compass com a identidade e a procedência de quem cadastra.
export async function complementCompany(env, tenant, dispatch, { companyId, productId, unit, evidence = [], channels = [], profile, at }) {
  const company = await s(env, "SELECT id,registration_id FROM companies WHERE tenant_id=? AND id=?", tenant, companyId).first();
  if (!company) return { ok: false, reason: "empresa não encontrada" };
  const out = { unit: null, evidence: { added: 0, reused: 0 }, channels: { added: 0, reused: 0 }, profile: "reused", otherProducts: [], restrictions: [] };
  // Unidade: outro estabelecimento da mesma empresa (mesma raiz de CNPJ) entra como unidade, nunca como empresa nova.
  let unitKey = "";
  if (unit?.cnpj && /^\d{14}$/.test(unit.cnpj) && unit.cnpj !== company.registration_id) {
    const u = await s(env, "SELECT id,company_id FROM company_units WHERE tenant_id=? AND cnpj=?", tenant, unit.cnpj).first();
    if (u && u.company_id === companyId) (unitKey = u.id), (out.unit = "reused");
    else if (!u) {
      const id = crypto.randomUUID();
      await s(env, "INSERT INTO company_units(id,tenant_id,company_id,cnpj,unit_role,municipality_name,uf,source_label,source_ref,consulted_at) VALUES (?,?,?,?,'unknown',?,?,?,?,?)", id, tenant, companyId, unit.cnpj, unit.municipality ?? null, unit.uf ?? null, unit.sourceLabel ?? "Rodada de descoberta", unit.sourceRef ?? null, at).run();
      unitKey = id;
      out.unit = "added";
    }
  }
  // Evidências da relação com este produto: a mesma (tipo + referência ou fonte) não se repete.
  const prev = (await s(env, "SELECT evidence_type,reference,source_url FROM evidence WHERE tenant_id=? AND company_id=? AND product_id=?", tenant, companyId, productId).all()).results;
  // Mesma evidência = mesmo tipo, mesma página e mesmo trecho (a data de leitura entre colchetes não conta).
  const core = (x) => norm(String(x ?? "").replace(/\s*\[[^\]]*\]\s*$/, ""));
  for (const ev of evidence) {
    const type = ev.evidenceType ?? ev.type;
    const same = prev.some((p) => p.evidence_type === type && (norm(p.reference) === norm(ev.reference) || (ev.sourceUrl && p.source_url === ev.sourceUrl && core(p.reference) === core(ev.reference))));
    if (same) {
      out.evidence.reused++;
      continue;
    }
    const r = await dispatch(`/api/companies/${companyId}/evidence`, "POST", { ...ev, productId });
    if (r.status < 300) out.evidence.added++;
  }
  for (const ch of channels) {
    const r = await dispatch(`/api/companies/${companyId}/channels`, "POST", ch);
    if (r.status === 409) out.channels.reused++;
    else if (r.status < 300) out.channels.added++;
  }
  // Relação unidade × produto: criada quando falta; a existente (inclusive editada pela pessoa) é preservada.
  const bp = await s(env, "SELECT id FROM buyer_profiles WHERE tenant_id=? AND company_id=? AND unit_key=? AND product_id=?", tenant, companyId, unitKey, productId).first();
  if (!bp && profile) {
    const r = await dispatch(`/api/companies/${companyId}/profiles`, "POST", { ...profile, productId, ...(unitKey ? { unitId: unitKey } : {}) });
    out.profile = r.status < 300 ? "added" : `failed:${r.status}`;
  }
  out.otherProducts = (await s(env, "SELECT DISTINCT product_id FROM buyer_profiles WHERE tenant_id=? AND company_id=? AND product_id<>?", tenant, companyId, productId).all()).results.map((x) => x.product_id);
  out.restrictions = await standingRestrictions(env, tenant, companyId);
  return { ok: true, ...out };
}

// Restrições já vigentes para a empresa (informativas na relação nova; o bloqueio é feito no contato, pelo alcance de cada uma).
export async function standingRestrictions(env, tenant, companyId) {
  const out = [];
  const pauses = (await s(env, "SELECT scope,scope_ref FROM pauses WHERE tenant_id=? AND resumed_at IS NULL AND scope='company' AND scope_ref=?", tenant, companyId).all()).results;
  if (pauses.length) out.push("empresa pausada (vale para qualquer commodity)");
  const sup = (await s(env, "SELECT COUNT(*) n FROM contacts k JOIN suppression_entries se ON se.tenant_id=k.tenant_id AND se.identifier_hash=k.email_hash AND se.channel='email' WHERE k.tenant_id=? AND k.company_id=?", tenant, companyId).first())?.n ?? 0;
  if (sup) out.push(`${sup} contato(s) com e-mail suprimido (oposição ou descadastro; vale para qualquer commodity)`);
  return out;
}
