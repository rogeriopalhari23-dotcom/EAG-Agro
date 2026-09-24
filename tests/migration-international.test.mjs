import test from "node:test";
import assert from "node:assert/strict";
import { D1Test, migrations, setup } from "./helpers/db.mjs";

function full() {
  const db = new D1Test();
  for (const sql of migrations) db.raw.exec(sql);
  return db;
}
const throwsSql = (db, sql, re) => assert.throws(() => db.raw.exec(sql), re);
function seed(db) {
  db.raw.exec(`
    INSERT OR IGNORE INTO countries(iso3,iso2,name_pt,name_en,comtrade_code,source_version,loaded_at) VALUES ('DEU','DE','Alemanha','Germany',276,'t','2026-09-24');
    INSERT INTO trade_list_versions(id,kind,reference_month,classification_json,params_json,started_at) VALUES ('2026-10','monthly','2026-10','{}','{}','2026-10-10');
    INSERT INTO companies(id,tenant_id,legal_name,country_code,source_label,created_by) VALUES ('co','eag-internal','Kaffee GmbH','DE','teste','system-admin');
  `);
}

test("P3-T1: condição confirmada exige evidência; não encontrada exige nota (AT23)", () => {
  const db = full();
  seed(db);
  throwsSql(db, "INSERT INTO company_conditions(tenant_id,company_id,product_id,condition,status,updated_by) VALUES ('eag-internal','co','product-06','buys_commodity','confirmed','u')", /CHECK/);
  throwsSql(db, "INSERT INTO company_conditions(tenant_id,company_id,product_id,condition,status,updated_by) VALUES ('eag-internal','co','product-06','buys_commodity','not_found','u')", /CHECK/);
});

test("P3-T1: um ponteiro por país e fonte; job único por versão; 1 atualização manual por dia", () => {
  const db = full();
  seed(db);
  db.raw.exec("INSERT INTO trade_list_current(iso3,source,version_id,r2_key,content_sha256,updated_at) VALUES ('DEU','comtrade','2026-10','k','h','t')");
  throwsSql(db, "INSERT INTO trade_list_current(iso3,source,version_id,r2_key,content_sha256,updated_at) VALUES ('DEU','comtrade','2026-10','k2','h2','t')", /UNIQUE|PRIMARY/);
  db.raw.exec("INSERT INTO trade_list_jobs(id,version_id,kind,job_key) VALUES ('j1','2026-10','mdic_chunk','mdic:2026:g1:0')");
  throwsSql(db, "INSERT INTO trade_list_jobs(id,version_id,kind,job_key) VALUES ('j2','2026-10','mdic_chunk','mdic:2026:g1:0')", /UNIQUE/);
  db.raw.exec("INSERT INTO trade_list_manual_refresh(iso3,day,version_id,requested_by,reason) VALUES ('DEU','2026-10-11','2026-10','u','motivo do teste')");
  throwsSql(db, "INSERT INTO trade_list_manual_refresh(iso3,day,version_id,requested_by,reason) VALUES ('DEU','2026-10-11','2026-10','u','de novo')", /UNIQUE|PRIMARY/);
  // Versão manual precisa do país; mensal não pode ter país.
  throwsSql(db, "INSERT INTO trade_list_versions(id,kind,reference_month,classification_json,params_json,started_at) VALUES ('m','manual','2026-10','{}','{}','t')", /CHECK/);
});

test("P3-T1: código da Comtrade único e código do MDIC com um só país (Review Focus 4)", () => {
  const db = full();
  seed(db);
  throwsSql(db, "INSERT INTO countries(iso3,name_pt,name_en,comtrade_code,source_version,loaded_at) VALUES ('XXX','x','x',276,'t','t')", /UNIQUE/);
  db.raw.exec("INSERT OR IGNORE INTO country_mdic_codes(mdic_code,iso3,name_pt) VALUES ('023','DEU','Alemanha')");
  throwsSql(db, "INSERT INTO country_mdic_codes(mdic_code,iso3,name_pt) VALUES ('023','DEU','Outra')", /UNIQUE|PRIMARY/);
});

test("P3-T1: parâmetros internacionais sem valor semeado; liberar exige evidência", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { data } = await ctx.api("/api/parameters");
  for (const k of ["agri_classification", "trade_list_mdic_years", "trade_list_comtrade_years", "comtrade_calls_per_day", "trade_list_retention_versions", "international_enabled", "period_default_months"])
    assert.equal(data.parameters[`${k}:international`], undefined, k);
  const put = (key, value) => ctx.api(`/api/parameters/${key}`, "PUT", { scope: "international", value, reason: "Decisão registrada no teste" });
  assert.equal((await put("international_enabled", { enabled: true })).data.error.code, "evidence_required");
  assert.equal((await put("agri_classification", { version: "sh-01-24@2026-09-23", chapters: ["01", "03"], excluded: ["03"] })).status, 422);
  assert.equal((await put("agri_classification", { version: "sh-01-24@2026-09-23", chapters: ["1"], excluded: [] })).status, 422);
  assert.equal((await put("agri_classification", { version: "sh-01-24@2026-09-23", chapters: ["01", "02"], excluded: ["03"] })).status, 200);
});
