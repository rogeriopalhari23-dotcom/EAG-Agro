// Pessoa responsável por produto (decisor, decisor provisório, influenciador). O papel numa commodity nunca vale para
// outra: o vínculo com cada produto é registrado à parte, por uma pessoa, com fonte. Contato sem vínculo fica como
// "produto não informado" e não conta como decisor de nenhum produto específico. Nada aqui libera contato ou envio.
import { bodyJson, fail, str, oneOf, url, requireRole, WRITE_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, product } from "./store.js";

export const ROLES = ["decision_maker", "influencer", "provisional_decision_maker", "other"];

export function productLinkStatement(env, tenant, { contactId, productId, role, sourceLabel, sourceUrl, by, at }) {
  return s(env, "INSERT OR IGNORE INTO contact_products(tenant_id,contact_id,product_id,role,source_label,source_url,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)", tenant, contactId, productId, role, sourceLabel, sourceUrl ?? null, by, at);
}

// Produto informado no cadastro do contato ou no aceite da pessoa (opcional): confere que é do catálogo do tenant.
export async function productFor(env, tenant, productId) {
  if (productId == null || productId === "") return null;
  return product(env, tenant, str(productId, "produto", 80));
}

// POST /api/contacts/:id/products — a pessoa registra que o contato responde também por este produto, com a fonte.
export async function linkContactProduct(request, env, actor, rid, contactId) {
  requireRole(actor, WRITE_ROLES);
  const c = await s(env, "SELECT id,company_id,contact_kind FROM contacts WHERE tenant_id=? AND id=?", actor.tenant_id, contactId).first();
  if (!c) fail(404, "contact_not_found", "Contato não encontrado.");
  if (c.contact_kind === "company_channel") fail(422, "channel_not_person", "Canal geral da empresa não é pessoa responsável por produto.");
  const i = await bodyJson(request);
  const p = await product(env, actor.tenant_id, str(i.productId, "produto", 80));
  const role = oneOf(i.role, ROLES, "papel para este produto");
  const sourceLabel = str(i.sourceLabel, "fonte do vínculo com o produto", 500);
  const dup = await s(env, "SELECT role FROM contact_products WHERE tenant_id=? AND contact_id=? AND product_id=?", actor.tenant_id, c.id, p.id).first();
  if (dup) fail(409, "contact_product_exists", "Este contato já está vinculado a este produto.", { role: dup.role });
  const at = now();
  await commit(env, [
    productLinkStatement(env, actor.tenant_id, { contactId: c.id, productId: p.id, role, sourceLabel, sourceUrl: url(i.sourceUrl), by: actor.id, at }),
    auditStatement(env, actor, rid, "contact.product_linked", "contact", c.id, { companyId: c.company_id, productId: p.id, role }),
  ]);
  return { contactId: c.id, productId: p.id, role };
}

// → Map(contactId → [{ productId, role, label }])
export async function productLinks(env, tenant, contactIds) {
  const out = new Map();
  for (let k = 0; k < contactIds.length; k += 50) {
    const part = contactIds.slice(k, k + 50);
    if (!part.length) continue;
    const rows = (await env.DB.prepare(`SELECT cp.contact_id,cp.product_id,cp.role,COALESCE(p.display_name,p.variant_name) label FROM contact_products cp JOIN products p ON p.id=cp.product_id WHERE cp.tenant_id=? AND cp.contact_id IN (${part.map(() => "?").join(",")})`).bind(tenant, ...part).all()).results;
    for (const r of rows) (out.get(r.contact_id) ?? out.set(r.contact_id, []).get(r.contact_id)).push({ productId: r.product_id, role: r.role, label: r.label });
  }
  return out;
}
