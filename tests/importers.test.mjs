import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { summarizeMdic, summarizeComtrade } from "../src/trade-summary.js";

// Lista mensal de outubro/2026 gerada pela rotina com as fontes simuladas.
async function listed(t) {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, ["DEU", "USA", "PRT", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const src = sources();
  const d = driver(ctx.env, src, { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  return { ...ctx, src };
}

test("Radar: resumo do MDIC usa a janela da análise e o nome em português da NCM de maior valor", () => {
  const obj = {
    state: "purchase_identified", fileLastPeriod: "2026-03",
    lines: [
      { hs6: "090111", ncm: "09011110", ym: "2026-01", fobUsd: 100, namePt: "Café não torrado" },
      { hs6: "090111", ncm: "09011190", ym: "2026-02", fobUsd: 10, namePt: "Outro café" },
      { hs6: "170114", ncm: "17011400", ym: "2025-03", fobUsd: 999, namePt: "Açúcar" }, // fora da janela de 12 meses
    ],
  };
  const r = summarizeMdic(obj, 12);
  assert.deepEqual([r.periodFrom, r.periodTo, r.state, r.brazilUsd, r.hs6Count], ["2025-04", "2026-03", "purchase_identified", 110, 1]);
  assert.deepEqual(r.top, [{ hs6: "090111", name: "Café não torrado", usd: 110 }]);
  assert.equal(summarizeMdic({ state: "no_record", fileLastPeriod: "2026-03", lines: [] }, 12).state, "no_record");
  assert.equal(summarizeMdic(null, 12).state, "data_unavailable");
});

test("Radar: resumo da Comtrade usa só origem Brasil no último ano declarado; país sem declaração fica explícito", () => {
  const obj = {
    state: "purchase_identified", lastPeriod: "2025", names: { "090111": "Coffee" },
    lines: [
      { hs6: "090111", year: 2025, origin: "world", valueUsd: 100, basis: "CIF" },
      { hs6: "090111", year: 2025, origin: "brazil", valueUsd: 30, basis: "CIF" },
      { hs6: "090111", year: 2024, origin: "brazil", valueUsd: 500, basis: "CIF" },
    ],
  };
  const r = summarizeComtrade(obj);
  assert.deepEqual([r.periodTo, r.brazilUsd, r.basis, r.top[0].name], ["2025", 30, "CIF", "Coffee"], "nunca soma mundo nem outro ano");
  assert.equal(summarizeComtrade({ state: "not_declared", lines: [] }).state, "not_declared");
});

test("Radar: lista básica de países importadores — nome, commodities do Brasil, período e fonte; nenhuma chamada externa", async (t) => {
  const { api, src } = await listed(t);
  const calls = src.calls.log.length;
  // MDIC publicado pelo Worker nesta rotina ainda não tem resumo: aparece como "em preparação", nunca como ausência.
  const before = (await api("/api/radar/importers")).data;
  assert.ok(before.pendingSummaries > 0);
  const deu0 = before.items.find((x) => x.iso3 === "DEU");
  assert.equal(deu0.sources.mdic.state, "summary_pending");
  assert.equal(deu0.sources.comtrade.state, "purchase_identified", "resumo da Comtrade gravado na consolidação");
  // Preenchimento lê só o R2.
  const rb = await api("/api/radar/importers/summaries/rebuild", "POST", {});
  assert.equal(rb.status, 200);
  assert.equal(rb.data.remaining, 0);
  const list = (await api("/api/radar/importers")).data;
  assert.equal(src.calls.log.length, calls, "nenhuma consulta ao MDIC ou à Comtrade para listar");
  assert.match(list.notice, /não prova que alguma empresa/);
  assert.equal(list.pendingSummaries, 0);
  const deu = list.items.find((x) => x.iso3 === "DEU");
  assert.equal(deu.name, "Alemanha");
  assert.equal(deu.purchaseIdentified, true);
  assert.deepEqual(deu.sources.mdic.period, { from: "2025-04", to: "2026-03" });
  assert.equal(deu.sources.mdic.basis, "FOB");
  assert.match(deu.sources.mdic.source, /MDIC/);
  assert.deepEqual(deu.sources.mdic.commodities.map((c) => [c.hs6, c.name, c.usd]), [["090111", "Café não torrado", 108100]]);
  // Comtrade: lado a lado, sem somar; nome em português emprestado do MDIC para o mesmo SH6.
  assert.deepEqual(deu.sources.comtrade.period, { from: "2025", to: "2025" });
  assert.deepEqual(deu.sources.comtrade.commodities.map((c) => [c.hs6, c.name, c.usd]), [["090111", "Café não torrado", 30]]);
  assert.match(deu.sources.comtrade.source, /Comtrade/);
  // Ordem: com compra identificada primeiro, maior valor do MDIC antes; China sem declaração vem por último.
  assert.deepEqual(list.items.map((x) => x.iso3), ["DEU", "USA", "PRT", "CHN"]);
  assert.equal(list.items.at(-1).sources.comtrade.state, "not_declared");
  // Filtro de compra identificada e busca por nome.
  assert.deepEqual((await api("/api/radar/importers?purchase=1")).data.items.map((x) => x.iso3), ["DEU", "USA", "PRT"]);
  assert.deepEqual((await api("/api/radar/importers?q=alem")).data.items.map((x) => x.iso3), ["DEU"]);
  // Resposta não traz nenhum campo de empresa.
  assert.ok(!/company|empresa_id|legal_name/.test(JSON.stringify(list.items)));
});

test("Radar: escolher o país devolve resumo curto e reaproveita a análise já registrada da mesma lista", async (t) => {
  const { api, DB, src } = await listed(t);
  const calls = src.calls.log.length;
  const a = (await api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  assert.equal(a.reused, false);
  assert.equal(a.summary.purchaseIdentified, true);
  assert.deepEqual(a.summary.mdic.period, { from: "2025-04", to: "2026-03" });
  assert.deepEqual(a.summary.mdic.commodities.map((c) => c.hs6), ["090111"]);
  assert.match(a.summary.mdic.source, /MDIC/);
  assert.equal(a.summary.comtrade.period.to, "2025");
  assert.equal(a.summary.comtrade.commodities[0].name, "Café não torrado", "nome em português do MDIC para o mesmo SH6");
  assert.match(a.notice, /não comprova compra por nenhuma empresa/);
  // Mesmo país, mesma lista e mesmo período: nenhuma análise nova, nenhuma consulta externa.
  const again = (await api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  assert.equal(again.id, a.id);
  assert.equal(again.reused, true);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM country_analyses WHERE iso3='DEU'").get().n, 1);
  assert.equal(src.calls.log.length, calls);
  // Outro período é outra análise (registrada à parte).
  const other = (await api("/api/country-analyses", "POST", { iso3: "DEU", periodMonths: 6 })).data;
  assert.notEqual(other.id, a.id);
  assert.equal(other.reused, false);
});
