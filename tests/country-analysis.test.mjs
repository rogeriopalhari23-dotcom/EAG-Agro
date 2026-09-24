import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver, MDIC_ROWS } from "./helpers/trade.mjs";
import { NOTICE } from "../src/country-analysis.js";

// Lista de outubro/2026 gerada pela rotina com as fontes simuladas; Portugal ganha exportações do Brasil.
async function listed(t, params = {}) {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, ["DEU", "USA", "PRT", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12, ...params });
  const rows = { ...MDIC_ROWS, 2026: [...MDIC_ROWS[2026], '"2026";"02";"09011110";"10";"607";"SP";"01";"0817800";500;500;2500'] };
  const d = driver(ctx.env, sources({ mdicRows: rows }), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  return ctx;
}
const byHs = (a, hs6) => a.rows.find((r) => r.hs6 === hs6);

test("P3-T6: análise só com o país, sem nenhuma chamada externa, com a versão usada (AT20, AT71)", async (t) => {
  const { api } = await listed(t);
  const real = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("chamada externa proibida na análise");
  };
  try {
    const r = await api("/api/country-analyses", "POST", { iso3: "DEU" });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.sources.comtrade.versionId, "2026-10");
    assert.equal(r.data.sources.mdic.versionId, "2026-10");
    assert.equal(r.data.notice, NOTICE);
    assert.equal(r.data.reproduced, true);
    const again = await api(`/api/country-analyses/${r.data.id}`);
    assert.equal(again.data.snapshotSha256, r.data.snapshotSha256);
  } finally {
    globalThis.fetch = real;
  }
});

test("P3-T6: parte do Brasil só dentro da Comtrade; MDIC ao lado, sem soma (AT74)", async (t) => {
  const { api } = await listed(t);
  const a = (await api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  const coffee = byHs(a, "090111");
  assert.equal(coffee.comtrade.latest.year, 2025);
  assert.equal(coffee.comtrade.latest.basis, "CIF");
  assert.deepEqual([coffee.comtrade.latest.worldUsd, coffee.comtrade.latest.brazilUsd, coffee.comtrade.latest.brazilShare], [100, 30, 0.3]);
  // MDIC: 101.000 + 500 (023+025, jan) + 1.600 (mar) + 5.000 (dez/2025) no período de 12 meses até 2026-03.
  assert.equal(coffee.mdic.fobUsd, 108100);
  assert.equal(a.sources.mdic.window.to, "2026-03");
  const flat = JSON.stringify(coffee);
  for (const bad of ["108200", "108130", "108000", "70"]) assert.ok(!flat.includes(`:${bad},`) && !flat.includes(`:${bad}}`), bad);
  assert.ok(!Object.keys(coffee).some((k) => /total|sum|soma/i.test(k)));
  // Açúcar: Comtrade de 2024 sem linha de origem Brasil → parte desconhecida, nunca 0% inventado.
  const sugar = byHs(a, "170114");
  assert.equal(sugar.comtrade.latest.brazilShare, null);
  assert.equal(sugar.comtrade.latest.shareNote, "sem linha de origem Brasil");
  assert.equal(sugar.purchaseIdentified, true);
});

test("P3-T6: EUA com Brasil declarado zero → parte 0 (dado declarado), não desconhecida", async (t) => {
  const { api } = await listed(t);
  const a = (await api("/api/country-analyses", "POST", { iso3: "USA" })).data;
  const sugar = byHs(a, "170114");
  assert.equal(sugar.comtrade.latest.brazilShare, 0);
  assert.equal(sugar.mdic.fobUsd, 21000);
});

test("P3-T6: país atrasado mostra 'sem declaração desde' e o MDIC; nunca 'nenhum registro' (AT73, Review Focus 3)", async (t) => {
  const { api } = await listed(t);
  const a = (await api("/api/country-analyses", "POST", { iso3: "PRT" })).data;
  assert.equal(a.sources.comtrade.lagging, "sem declaração do país desde 2023");
  assert.equal(a.sources.comtrade.lastDeclared, "2023");
  assert.deepEqual(a.sources.comtrade.years, [2021, 2022, 2023]);
  assert.equal(byHs(a, "090111").comtrade.latest.year, 2023);
  assert.equal(byHs(a, "090111").mdic.fobUsd, 2500);
  assert.equal(a.sources.mdic.label, "compra identificada");
  assert.ok(!JSON.stringify(a).includes("nenhum registro"));
});

test("P3-T6: país sem declaração à Comtrade tem estado próprio e o MDIC continua (China)", async (t) => {
  const { api } = await listed(t);
  const a = (await api("/api/country-analyses", "POST", { iso3: "CHN" })).data;
  assert.equal(a.sources.comtrade.state, "not_declared");
  assert.equal(a.sources.comtrade.label, "sem declaração do país à fonte");
  assert.equal(a.sources.mdic.state, "no_record");
  assert.equal(a.sources.mdic.label, "nenhum registro no período");
});

test("P3-T6: código pendente do catálogo não comprova correspondência (AT22); confirmado destaca", async (t) => {
  const { api, DB } = await listed(t);
  DB.raw.exec(`
    INSERT INTO product_codes(id,product_id,code_system,code,classification_version,status) VALUES ('pc-cafe','product-06','HS','090111','HS2022','pending');
  `);
  let coffee = byHs((await api("/api/country-analyses", "POST", { iso3: "DEU" })).data, "090111");
  assert.deepEqual(coffee.catalog.confirmed, []);
  assert.equal(coffee.catalog.pending[0].productId, "product-06");
  DB.raw.exec("UPDATE product_codes SET status='confirmed',source_ref='https://comtradeapi.un.org/files/v1/app/reference/HS.json' WHERE id='pc-cafe'");
  coffee = byHs((await api("/api/country-analyses", "POST", { iso3: "DEU" })).data, "090111");
  assert.equal(coffee.catalog.confirmed[0].productId, "product-06");
  assert.deepEqual(coffee.catalog.pending, []);
});

test("P3-T6: análise não toca empresas, evidências, condições nem scores (AT23)", async (t) => {
  const { api, DB } = await listed(t);
  const count = () => ["evidence", "company_conditions", "companies", "demands"].map((tb) => DB.raw.prepare(`SELECT COUNT(*) n FROM ${tb}`).get().n);
  const before = count();
  await api("/api/country-analyses", "POST", { iso3: "DEU" });
  assert.deepEqual(count(), before);
});

test("P3-T6: sem período aprovado exige período explícito; lista ausente não inventa análise", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const r = await ctx.api("/api/country-analyses", "POST", { iso3: "DEU" });
  assert.equal(r.data.error.code, "parameter_missing");
  const r2 = await ctx.api("/api/country-analyses", "POST", { iso3: "DEU", periodMonths: 6 });
  assert.equal(r2.data.error.code, "trade_list_missing");
  assert.equal((await ctx.api("/api/country-analyses", "POST", { iso3: "DEU", periodMonths: 0 })).status, 422);
});
