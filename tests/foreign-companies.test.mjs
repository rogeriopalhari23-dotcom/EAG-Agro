import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";

// Campanha internacional de café para a Alemanha nascida de seleção registrada (sem depender da rotina mensal).
function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  ctx.DB.raw.exec(`
    INSERT INTO country_analyses(id,tenant_id,iso3,period_months,snapshot_sha256,created_by) VALUES ('an','eag-internal','DEU',12,'h','system-admin');
    INSERT INTO commodity_selections(id,tenant_id,analysis_id,items_json,selected_by) VALUES ('sel','eag-internal','an','[{"campaignId":"cp-de","productId":"product-05","hs6":["090111"],"needsCommercialValidation":false}]','system-admin');
    INSERT INTO campaigns(id,tenant_id,product_id,market,name,country_code,language,analysis_id,selection_id,created_by) VALUES ('cp-de','eag-internal','product-05','international','Café · Alemanha','DE','en','an','sel','system-admin');
    INSERT INTO campaigns(id,tenant_id,product_id,market,name,country_code,language,created_by) VALUES ('cp-solta','eag-internal','product-05','international','Café solta','DE','en','system-admin');
  `);
  return ctx;
}
const evidence = (DB, id, company, { category = "business", status = "valid", supports } = {}) =>
  DB.raw
    .prepare("INSERT INTO evidence(id,tenant_id,company_id,category,evidence_type,reference,source_url,fact_date,consulted_at,validation_status,metadata_json,created_by) VALUES (?,'eag-internal',?,?,'website','Página de produtos','https://kaffee.example/produtos','2026-09-01','2026-09-24',?,?,'system-admin')")
    .run(id, company, category, status, JSON.stringify(supports ? { supports } : {}));
const create = (api, body = {}) => api("/api/foreign-companies", "POST", { campaignId: "cp-de", legalName: "Kaffee Rösterei GmbH", registrationId: "HRB 12345", registrationIdType: "HRB", sourceLabel: "Site da empresa", ...body });

test("P3-T8: empresa no exterior nasce com as 3 condições pendentes e links de pesquisa montados", async (t) => {
  const { api, DB } = world(t);
  const r = await create(api);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.deepEqual(r.data.conditions.map((c) => [c.condition, c.status]), [["buys_commodity", "pending"], ["consumes_as_input", "pending"], ["imports_from_brazil", "pending"]]);
  assert.equal(DB.raw.prepare("SELECT country_code FROM companies WHERE id=?").get(r.data.id).country_code, "DE");
  assert.ok(r.data.researchLinks.every((l) => l.url.startsWith("https://")));
  // Mesmo registro = mesma empresa.
  const again = await create(api, { legalName: "Kaffee Roesterei" });
  assert.equal(again.data.id, r.data.id);
  assert.equal(again.data.created, false);
});

test("P3-T8: nome parecido sem registro vira pendência, não fusão", async (t) => {
  const { api, DB } = world(t);
  await create(api);
  const r = await create(api, { legalName: "Kaffee Rösterei AG", registrationId: undefined, registrationIdType: undefined });
  assert.equal(r.status, 409);
  assert.equal(r.data.error.code, "possible_duplicate");
  const ok = await create(api, { legalName: "Kaffee Rösterei AG", registrationId: undefined, registrationIdType: undefined, confirmDistinct: true });
  assert.equal(ok.status, 201);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE country_code='DE'").get().n, 2);
});

test("P3-T8: condição só com evidência da empresa, não de mercado, válida e que diga o que sustenta (AT23, R13.4)", async (t) => {
  const { api, DB } = world(t);
  const id = (await create(api)).data.id;
  const other = (await create(api, { legalName: "Outra Kaffee GmbH", registrationId: "HRB 999" })).data.id;
  const put = (evidenceId) => api(`/api/companies/${id}/conditions/product-05/buys_commodity`, "PUT", { status: "confirmed", evidenceId });
  evidence(DB, "ev-market", id, { category: "market", supports: ["buys_commodity"] });
  assert.equal((await put("ev-market")).data.error.code, "market_evidence_not_company");
  evidence(DB, "ev-other", other, { supports: ["buys_commodity"] });
  assert.equal((await put("ev-other")).data.error.code, "evidence_other_company");
  evidence(DB, "ev-nosupport", id);
  assert.equal((await put("ev-nosupport")).data.error.code, "evidence_missing_support");
  evidence(DB, "ev-pending", id, { status: "pending", supports: ["buys_commodity"] });
  assert.equal((await put("ev-pending")).data.error.code, "evidence_not_valid");
  evidence(DB, "ev-ok", id, { supports: ["buys_commodity"] });
  const ok = await put("ev-ok");
  assert.equal(ok.status, 200);
  assert.equal(ok.data.conditions.find((c) => c.condition === "buys_commodity").status, "confirmed");
  // Evidência que sustenta uma condição não confirma outra.
  assert.equal((await api(`/api/companies/${id}/conditions/product-05/imports_from_brazil`, "PUT", { status: "confirmed", evidenceId: "ev-ok" })).data.error.code, "evidence_missing_support");
  assert.equal((await api(`/api/companies/${id}/conditions/product-05/imports_from_brazil`, "PUT", { status: "not_found", note: "curta" })).data.error.code, "note_required");
});

test("P3-T8: busca de empresa só a partir de campanha com seleção (R12.14)", async (t) => {
  const { api } = world(t);
  assert.equal((await create(api, { campaignId: "cp-solta" })).data.error.code, "selection_required");
});

test("P3-T8: porte médio entra no ICP; gigante sai; só gestores definem porte", async (t) => {
  const { api, DB, env } = world(t);
  const id = (await create(api)).data.id;
  await api(`/api/companies/${id}/profiles`, "POST", { productId: "product-05", profileClass: "possible_final_consumer", basis: "Torrefação: café é insumo" });
  const icp = () => DB.raw.prepare("SELECT icp_status FROM buyer_profiles WHERE company_id=?").get(id).icp_status;
  assert.equal(icp(), "pending_size");
  assert.equal((await api(`/api/companies/${id}/size`, "PATCH", { sizeBand: "medium", source: "Relatório anual 2025: 180 funcionários" })).status, 200);
  assert.equal(icp(), "in_icp");
  await api(`/api/companies/${id}/size`, "PATCH", { sizeBand: "giant", source: "Grupo com faturamento acima de 1 bi EUR" });
  assert.equal(icp(), "out_giant");
  DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('s','eag-internal','s@example.test','Vendedor','seller_analyst')");
  env.LOCAL_USER_EMAIL = "s@example.test";
  assert.equal((await api(`/api/companies/${id}/size`, "PATCH", { sizeBand: "medium", source: "x" })).status, 403);
});

test("P3-T8: fuso inválido do contato é recusado (Europe/Berlim)", async (t) => {
  const { api } = world(t);
  const id = (await create(api)).data.id;
  const ct = await api(`/api/companies/${id}/contacts`, "POST", { fullName: "Anna Weber", email: "anna@kaffee.example", prospectRole: "decision_maker", sourceLabel: "site" });
  assert.equal(ct.status, 201, JSON.stringify(ct.data));
  assert.equal((await api(`/api/contacts/${ct.data.id}`, "PATCH", { timezone: "Europe/Berlim" })).data.error.code, "timezone_invalid");
  assert.equal((await api(`/api/contacts/${ct.data.id}`, "PATCH", { timezone: "Europe/Berlin" })).status, 200);
});
