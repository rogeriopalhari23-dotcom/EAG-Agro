// Restrições comuns a todo contato, automático ou manual (P2-T13; R22, R21, R1.2, R25.3, R10.4; errata itens 4 e 6).
// Devolve a lista de motivos que impedem o toque; vazia = liberado por estas regras.
import { statement as s } from "./store.js";
import { complianceStatus } from "./scores.js";

export async function restrictionsFor(env, tenant, { companyId, campaignId, commodity, emailHash }) {
  const reasons = [];
  const [pauses, campaign, openclaw, sup] = await env.DB.batch([
    s(
      env,
      `SELECT scope,scope_ref,reason FROM pauses WHERE tenant_id=? AND resumed_at IS NULL AND (
         scope='operation' OR (scope='campaign' AND scope_ref=?) OR (scope='company' AND scope_ref=?) OR (scope='commodity' AND scope_ref=?))`,
      tenant, campaignId ?? "", companyId ?? "", commodity ?? "",
    ),
    s(env, "SELECT c.status,p.active,p.identity_status FROM campaigns c JOIN products p ON p.id=c.product_id WHERE c.tenant_id=? AND c.id=?", tenant, campaignId ?? ""),
    s(env, "SELECT retired_in_openclaw FROM openclaw_transfers WHERE tenant_id=? AND company_id=?", tenant, companyId ?? ""),
    s(env, "SELECT 1 x FROM suppression_entries WHERE tenant_id=? AND identifier_hash=? AND channel='email'", tenant, emailHash ?? ""),
  ]);
  for (const p of pauses.results) reasons.push(`paused_${p.scope}`);
  const c = campaign.results[0];
  if (campaignId && (!c || c.status !== "active")) reasons.push("campaign_not_active");
  if (c && (!c.active || c.identity_status !== "confirmed")) reasons.push("product_identity_pending");
  if (openclaw.results[0] && !openclaw.results[0].retired_in_openclaw) reasons.push("openclaw_active");
  if (emailHash && sup.results.length) reasons.push("suppressed");
  if (companyId) {
    const comp = await complianceStatus(env, tenant, companyId);
    if (comp.status !== "clear") reasons.push(comp.status === "unavailable" ? "compliance_unavailable" : `compliance_${comp.status}`);
  }
  return [...new Set(reasons)];
}
