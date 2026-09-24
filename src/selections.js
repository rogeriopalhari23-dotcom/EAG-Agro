// Seleção de commodities a partir da lista do país (P3-T7; R12.7–R12.9, R12.14, R28.17; AT61, AT75; errata item 12).
// A checagem de lista mora aqui, no serviço: vale para a tela e para chamadas diretas à API.
import { bodyJson, fail, str, oneOf, requireRole, APPROVER_ROLES } from "./http.js";
import { statement as s, commit, product, auditStatement } from "./store.js";
import { getAnalysis } from "./country-analysis.js";

const ADMIN = new Set(["admin"]);

export async function selectCommodities(request, env, actor, rid, analysisId) {
  requireRole(actor, APPROVER_ROLES);
  const i = await bodyJson(request);
  if (!Array.isArray(i.items) || i.items.length < 1 || i.items.length > 20) fail(422, "invalid_items", "Selecione de 1 a 20 commodities.");
  const a = await getAnalysis(env, actor, analysisId);
  if (!a.reproduced) fail(409, "analysis_not_reproducible", "A lista usada por esta análise não confere mais; gere nova análise.");
  if (![a.sources.comtrade.state, a.sources.mdic.state].includes("purchase_identified"))
    fail(409, "no_purchase_identified", "A análise não tem compra identificada em nenhuma fonte; nada a selecionar.");
  if (!a.country.iso2) fail(422, "country_without_iso2", "País sem código de duas letras oficial: não recebe campanha.");
  const selectable = new Set(a.rows.filter((r) => r.purchaseIdentified).map((r) => r.hs6));
  const items = [];
  const seen = new Set();
  for (const it of i.items) {
    const label = str(it?.label, "nome da commodity", 200);
    if (!Array.isArray(it.hs6) || it.hs6.length < 1 || it.hs6.length > 50) fail(422, "invalid_hs6", "Informe de 1 a 50 subposições SH6 por commodity.");
    for (const h of it.hs6) {
      if (!/^\d{6}$/.test(String(h))) fail(422, "invalid_hs6", "Subposição SH6 tem 6 dígitos.");
      // R12.14 / AT75: só o que está na lista do país com compra identificada.
      if (!selectable.has(String(h))) fail(422, "not_in_country_list", `A subposição ${h} não está na lista do país com compra identificada.`, { hs6: String(h) });
    }
    // Item fora do catálogo exige o produto cadastrado (identidade pendente) antes; a campanha nasce em rascunho.
    const p = await product(env, actor.tenant_id, str(it.productId, "produto (cadastre no catálogo antes, com identidade pendente se for novo)", 80));
    if (!p.active) fail(422, "product_inactive", "Produto inativo.");
    if (seen.has(p.id)) fail(422, "duplicate_product", "O mesmo produto aparece duas vezes.");
    seen.add(p.id);
    const confirmedMatch = a.rows.some((r) => it.hs6.includes(r.hs6) && r.catalog.confirmed.some((c) => c.productId === p.id));
    items.push({
      productId: p.id, label, hs6: it.hs6.map(String), campaignId: crypto.randomUUID(),
      // Validação comercial obrigatória quando o produto não está confirmado ou não corresponde por código confirmado (R12.9).
      needsCommercialValidation: p.identity_status !== "confirmed" || !confirmedMatch,
    });
  }
  const selectionId = crypto.randomUUID();
  const stmts = [
    s(env, "INSERT INTO commodity_selections(id,tenant_id,analysis_id,items_json,selected_by) VALUES (?,?,?,?,?)", selectionId, actor.tenant_id, analysisId, JSON.stringify(items), actor.id),
  ];
  // Seleção antes da campanha (R12.8): cada campanha já nasce com a seleção e a análise.
  for (const it of items)
    stmts.push(
      s(
        env,
        "INSERT INTO campaigns(id,tenant_id,product_id,market,name,country_code,language,analysis_id,selection_id,created_by) VALUES (?,?,?,'international',?,?,?,?,?,?)",
        it.campaignId, actor.tenant_id, it.productId, `${it.label} · ${a.country.name_pt}`, a.country.iso2, a.country.default_language, analysisId, selectionId, actor.id,
      ),
      auditStatement(env, actor, rid, "campaign.created", "campaign", it.campaignId, { market: "international", productId: it.productId, selectionId, hs6: it.hs6 }),
    );
  stmts.push(auditStatement(env, actor, rid, "commodity_selection.created", "commodity_selection", selectionId, { analysisId, iso3: a.country.iso3, items: items.map(({ campaignId, ...x }) => x) }));
  await commit(env, stmts);
  return { selectionId, campaigns: items.map((x) => ({ id: x.campaignId, productId: x.productId, label: x.label, needsCommercialValidation: x.needsCommercialValidation })) };
}

// Decisão comercial sobre commodity fora do catálogo ou sem correspondência confirmada (R12.9). Só admin.
export async function recordValidation(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const sel = await s(env, "SELECT * FROM commodity_selections WHERE tenant_id=? AND id=?", actor.tenant_id, str(i.selectionId, "seleção", 80)).first();
  if (!sel) fail(404, "selection_not_found", "Seleção não encontrada.");
  const productId = str(i.productId, "produto", 80);
  if (!JSON.parse(sel.items_json).some((x) => x.productId === productId)) fail(422, "product_not_in_selection", "Produto fora desta seleção.");
  const decision = oneOf(i.decision, ["approved", "rejected"], "decisão");
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 10) fail(422, "reason_required", "Descreva o motivo (mínimo 10 caracteres).");
  const id = crypto.randomUUID();
  await commit(env, [
    s(env, "INSERT INTO commercial_validations(id,tenant_id,selection_id,product_id,decision,reason,decided_by) VALUES (?,?,?,?,?,?,?)", id, actor.tenant_id, sel.id, productId, decision, reason, actor.id),
    auditStatement(env, actor, rid, "commercial_validation.recorded", "commodity_selection", sel.id, { productId, decision, reason }),
  ]);
  return { id, decision };
}

// Trava comum para campanha internacional: seleção registrada e, quando exigida, validação comercial aprovada.
// Usada na ativação da campanha e na geração de ficha.
export async function internationalGate(env, tenant, campaign) {
  if (campaign.market !== "international") return;
  if (!campaign.selection_id) fail(409, "selection_required", "Campanha internacional só nasce da seleção na lista do país (R12.8, R12.14).");
  const sel = await s(env, "SELECT items_json FROM commodity_selections WHERE tenant_id=? AND id=?", tenant, campaign.selection_id).first();
  const item = sel && JSON.parse(sel.items_json).find((x) => x.campaignId === campaign.id);
  if (!item) fail(409, "selection_required", "Campanha sem item de seleção correspondente.");
  if (item.needsCommercialValidation) {
    const v = await s(env, "SELECT decision FROM commercial_validations WHERE tenant_id=? AND selection_id=? AND product_id=? ORDER BY decided_at DESC,rowid DESC LIMIT 1", tenant, campaign.selection_id, campaign.product_id).first();
    if (v?.decision !== "approved") fail(409, "commercial_validation_pending", "Validação comercial pendente para esta commodity (R12.9).");
  }
}

export async function listSelections(env, actor, analysisId) {
  const rows = (await s(env, "SELECT * FROM commodity_selections WHERE tenant_id=? AND analysis_id=? ORDER BY selected_at DESC", actor.tenant_id, analysisId).all()).results;
  return { items: rows.map((r) => ({ ...r, items: JSON.parse(r.items_json), items_json: undefined })) };
}
