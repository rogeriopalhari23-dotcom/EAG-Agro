import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver, MDIC_ROWS } from "./helpers/trade.mjs";

const ICP = { userSectors: ["confectionery"], sizeTarget: "medium", region: "Germany", decisionRole: "Purchasing", influencerRole: "Quality" };

// Alemanha com café, açúcar e soja na lista; China sem compra identificada.
async function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, ["DEU", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const rows = { ...MDIC_ROWS, 2026: [...MDIC_ROWS[2026], '"2026";"02";"12019000";"10";"023";"PR";"01";"0917500";;900;400'] };
  const d = driver(ctx.env, sources({ mdicRows: rows }), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  const analysis = (await ctx.api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  return { ...ctx, analysis };
}
const confirmHs = (DB, product, hs6) =>
  DB.raw.prepare("INSERT INTO product_codes(id,product_id,code_system,code,classification_version,status,source_ref) VALUES (?,?,'HS',?,'HS2022','confirmed','https://comtradeapi.un.org/files/v1/app/reference/HS.json')").run(`pc-${product}`, product, hs6);
async function activate(api, id) {
  let c = (await api(`/api/campaigns/${id}`)).data.campaign;
  assert.equal((await api(`/api/campaigns/${id}/icp`, "PUT", { expectedVersion: c.version, icp: ICP })).status, 200);
  c = (await api(`/api/campaigns/${id}`)).data.campaign;
  return api(`/api/campaigns/${id}/activate`, "POST", { expectedVersion: c.version });
}

test("P3-T7: commodity fora da lista do país é recusada no serviço (AT75, R12.14)", async (t) => {
  const { api, analysis } = await world(t);
  const r = await api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-14", label: "Trigo", hs6: ["100199"] }] });
  assert.equal(r.status, 422);
  assert.equal(r.data.error.code, "not_in_country_list");
  const mixed = await api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111", "090112"] }] });
  assert.equal(mixed.data.error.code, "not_in_country_list", "todas as subposições do item precisam estar na lista");
});

test("P3-T7: seleção registrada antes da campanha; campanha com país, idioma, análise e seleção (R12.7, R12.8)", async (t) => {
  const { api, DB, analysis } = await world(t);
  const r = await api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const c = DB.raw.prepare("SELECT * FROM campaigns WHERE id=?").get(r.data.campaigns[0].id);
  assert.deepEqual([c.market, c.country_code, c.language, c.analysis_id, c.selection_id, c.status], ["international", "DE", "en", analysis.id, r.data.selectionId, "draft"]);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM campaigns WHERE analysis_id IS NOT NULL AND selection_id IS NULL").get().n, 0);
  const sel = JSON.parse(DB.raw.prepare("SELECT items_json FROM commodity_selections WHERE id=?").get(r.data.selectionId).items_json);
  assert.deepEqual(sel[0].hs6, ["090111"]);
  assert.ok(DB.raw.prepare("SELECT 1 FROM audit_log WHERE action='commodity_selection.created'").get());
});

test("P3-T7: sem correspondência confirmada exige validação comercial para ativar e gerar ficha (R12.9)", async (t) => {
  const { api, analysis } = await world(t);
  const r = await api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-06", label: "Açúcar", hs6: ["170114"] }] });
  assert.equal(r.data.campaigns[0].needsCommercialValidation, true);
  const id = r.data.campaigns[0].id;
  assert.equal((await activate(api, id)).data.error.code, "commercial_validation_pending");
  const ficha = await api("/api/fichas", "POST", { companyId: "qualquer", campaignId: id, recipients: ["x"] });
  assert.equal(ficha.data.error.code, "commercial_validation_pending");
  const bad = await api("/api/commercial-validations", "POST", { selectionId: r.data.selectionId, productId: "product-06", decision: "approved", reason: "curto" });
  assert.equal(bad.data.error.code, "reason_required");
  const ok = await api("/api/commercial-validations", "POST", { selectionId: r.data.selectionId, productId: "product-06", decision: "approved", reason: "ICUMSA 45 atende o comprador típico alemão" });
  assert.equal(ok.status, 201);
  const c = (await api(`/api/campaigns/${id}`)).data.campaign;
  assert.equal((await api(`/api/campaigns/${id}/activate`, "POST", { expectedVersion: c.version })).status, 200);
});

test("P3-T7: produto com identidade pendente não ativa mesmo validado (errata item 12)", async (t) => {
  const { api, DB, analysis } = await world(t);
  DB.raw.exec("UPDATE products SET identity_status='pending' WHERE id='product-05'");
  const r = await api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  await api("/api/commercial-validations", "POST", { selectionId: r.data.selectionId, productId: "product-05", decision: "approved", reason: "Oferta de café aprovada pelo comercial" });
  const res = await activate(api, r.data.campaigns[0].id);
  assert.equal(res.data.error.code, "product_identity_pending");
});

test("P3-T7: campanha internacional criada fora da seleção não ativa", async (t) => {
  const { api } = await world(t);
  const c = await api("/api/campaigns", "POST", { productId: "product-05", market: "international", name: "Café direto", countryCode: "DE", icp: ICP });
  assert.equal(c.status, 201);
  assert.equal((await api(`/api/campaigns/${c.data.id}/activate`, "POST", { expectedVersion: 1 })).data.error.code, "selection_required");
});

test("P3-T7: terceira commodity ativa no internacional espera; o nacional não conta (R28.17, AT61)", async (t) => {
  const { api, DB, analysis } = await world(t);
  confirmHs(DB, "product-05", "090111");
  confirmHs(DB, "product-06", "170114");
  confirmHs(DB, "product-01", "120190");
  const fresh = (await api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  const r = await api(`/api/country-analyses/${fresh.id}/selections`, "POST", {
    items: [
      { productId: "product-05", label: "Café", hs6: ["090111"] },
      { productId: "product-06", label: "Açúcar", hs6: ["170114"] },
      { productId: "product-01", label: "Soja", hs6: ["120190"] },
    ],
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.ok(r.data.campaigns.every((c) => c.needsCommercialValidation === false));
  // Duas nacionais ativas de outras commodities não entram na conta do internacional.
  for (const [key, value] of [["radius_allowed_km", [5]], ["radius_default_km", 5]])
    assert.equal((await api(`/api/parameters/${key}`, "PUT", { scope: "national", value, reason: "Parâmetro do teste" })).status, 200);
  for (const p of ["product-03", "product-14"]) {
    const n = await api("/api/campaigns", "POST", { productId: p, market: "national", name: `Nacional ${p}`, originCity: "Sertãozinho", originUf: "SP", icp: ICP });
    assert.equal(n.status, 201, JSON.stringify(n.data));
    assert.equal((await api(`/api/campaigns/${n.data.id}/activate`, "POST", { expectedVersion: 1 })).status, 200);
  }
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM campaigns WHERE market='national' AND status='active'").get().n, 2);
  const statuses = [];
  for (const c of r.data.campaigns) {
    await activate(api, c.id);
    statuses.push(DB.raw.prepare("SELECT status FROM campaigns WHERE id=?").get(c.id).status);
  }
  assert.deepEqual(statuses, ["active", "active", "waiting"]);
  void analysis;
});

test("P3-T7: análise sem compra identificada não aceita seleção; só gestores selecionam", async (t) => {
  const { api, DB, env } = await world(t);
  const chn = (await api("/api/country-analyses", "POST", { iso3: "CHN" })).data;
  const r = await api(`/api/country-analyses/${chn.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  assert.equal(r.data.error.code, "no_purchase_identified");
  DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('s','eag-internal','s@example.test','Vendedor','seller_analyst')");
  env.LOCAL_USER_EMAIL = "s@example.test";
  const deu = (await api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  assert.equal((await api(`/api/country-analyses/${deu.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] })).status, 403);
});
