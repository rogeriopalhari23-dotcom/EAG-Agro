import test from "node:test";
import assert from "node:assert/strict";
import { D1Test, migrations, setup } from "./helpers/db.mjs";
function apply(db, sql) {
  db.raw.exec("BEGIN");
  try {
    db.raw.exec(sql);
    db.raw.exec("COMMIT");
  } catch (e) {
    db.raw.exec("ROLLBACK");
    throw e;
  }
}
test("Migração preserva demanda, campos, scores, contatos e auditoria da 0.3.1", () => {
  const DB = new D1Test();
  try {
    apply(DB, migrations[0]);
    apply(DB, migrations[1]);
    DB.raw.exec(
      `INSERT INTO companies(id,tenant_id,legal_name,country_code,source_label,created_by) VALUES ('legacy','eag-internal','Legado','BR','doc','system-admin'); INSERT INTO demands(id,tenant_id,company_id,commodity,created_by) VALUES ('old-demand','eag-internal','legacy','sugar','system-admin'); INSERT INTO demand_fields(id,tenant_id,demand_id,field_key,field_status,value_json,source_reference,updated_by) VALUES ('field','eag-internal','old-demand','product','confirmed','"Açúcar"','Documento','system-admin'); INSERT INTO scores(id,tenant_id,company_id,demand_id,score_type,score_value,coverage,components_json,formula_version,parameters_json,calculated_by) VALUES ('score','eag-internal','legacy','old-demand','confidence',80,100,'{}','1.3.0','{}','system-admin'); INSERT INTO contacts(id,tenant_id,company_id,full_name_encrypted,source_label,created_by) VALUES ('contact','eag-internal','legacy','ciphertext','doc','system-admin'); INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,request_id) VALUES ('audit','eag-internal','system-admin','admin','legacy','company','legacy','r');`,
    );
    for (const sql of migrations.slice(2)) apply(DB, sql);
    assert.deepEqual(
      { ...DB.raw.prepare("SELECT id,market,commodity FROM demands").get() },
      { id: "old-demand", market: "international", commodity: "sugar" },
    );
    assert.equal(
      DB.raw.prepare("SELECT value_json FROM demand_fields").get().value_json,
      '"Açúcar"',
    );
    assert.equal(
      DB.raw.prepare("SELECT full_name_encrypted FROM contacts").get()
        .full_name_encrypted,
      "ciphertext",
    );
    assert.equal(
      DB.raw.prepare("SELECT formula_version FROM scores").get()
        .formula_version,
      "1.3.0",
    );
    assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM audit_log").get().n, 1);
    assert.equal(DB.raw.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    DB.raw.close();
  }
});
const campaign = (productId = "product-03", extra = {}) => ({
  productId,
  market: "national",
  name: "Campanha de teste",
  originCity: "Ponta Porã",
  originUf: "MS",
  radiusKm: 5,
  icp: {
    userSectors: ["Indústria"],
    sizeTarget: "medium",
    region: "MS",
    decisionRole: "Compras",
    influencerRole: "Técnico",
  },
  ...extra,
});
test("Campanhas: raio permitido, máximo 2 commodities, variantes e mercado separados", async (t) => {
  const x = setup();
  t.after(x.close);
  const { api, DB } = x;
  assert.equal(
    (
      await api(
        "/api/campaigns",
        "POST",
        campaign("product-03", { radiusKm: 150 }),
      )
    ).status,
    422,
  );
  assert.equal(
    (await api("/api/campaigns", "POST", campaign("product-28"))).status,
    422,
  );
  async function activate(p, extra) {
    const c = await api("/api/campaigns", "POST", campaign(p, extra));
    assert.equal(c.status, 201);
    // Plano 3 (R12.8, R12.14): campanha internacional só ativa a partir de seleção registrada na lista do país.
    if (extra?.market === "international")
      DB.raw.exec(`
        INSERT INTO country_analyses(id,tenant_id,iso3,period_months,snapshot_sha256,created_by) VALUES ('an-ca','eag-internal','CAN',12,'h','system-admin');
        INSERT INTO commodity_selections(id,tenant_id,analysis_id,items_json,selected_by) VALUES ('sel-ca','eag-internal','an-ca','[{"campaignId":"${c.data.id}","productId":"${p}","needsCommercialValidation":false}]','system-admin');
        UPDATE campaigns SET analysis_id='an-ca',selection_id='sel-ca' WHERE id='${c.data.id}';`);
    return api(`/api/campaigns/${c.data.id}/activate`, "POST", {
      expectedVersion: 1,
    });
  }
  assert.equal((await activate("product-03")).data.campaign.status, "active");
  assert.equal((await activate("product-01")).data.campaign.status, "active");
  assert.equal((await activate("product-04")).data.campaign.status, "active");
  assert.equal((await activate("product-05")).data.campaign.status, "waiting");
  assert.equal(
    (
      await activate("product-05", {
        market: "international",
        countryCode: "CA",
      })
    ).data.campaign.status,
    "active",
  );
});
test("Campanha: edição concorrente e declarações versionadas", async (t) => {
  const x = setup();
  t.after(x.close);
  const { api, DB } = x;
  const c = await api("/api/campaigns", "POST", campaign()),
    id = c.data.id;
  const path = `/api/campaigns/${id}`;
  assert.equal(
    (await api(path, "PATCH", { expectedVersion: 1, name: "Revisada" })).status,
    200,
  );
  assert.equal(
    (await api(path, "PATCH", { expectedVersion: 1, name: "Perdida" })).status,
    409,
  );
  assert.equal(
    (
      await api(path + "/declarations", "POST", {
        expectedVersion: 2,
        kind: "social_proof",
        text: "Texto aprovado no teste",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await api(path + "/declarations", "POST", {
        expectedVersion: 3,
        kind: "social_proof",
        text: "Nova prova",
        reviewDueAt: "2020-01-01",
      })
    ).status,
    201,
  );
  assert.equal((await api(path)).data.declarations.length, 0);
  assert.equal(
    DB.raw
      .prepare(
        "SELECT COUNT(*) n FROM campaign_declarations WHERE status='revoked'",
      )
      .get().n,
    1,
  );
});
