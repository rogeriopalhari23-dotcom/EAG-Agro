import test from "node:test";
import assert from "node:assert/strict";
import { availableYears, fetchImports, loadHsBlocks, redact } from "../src/adapters/comtrade.js";

const BASE = "https://comtrade.exemplo";
const KEY = "segredo-da-chave-123";
// Registro no formato copiado em T6 §8 (preview de 2026-09-23), com parceiros 0 e 76 sintéticos.
const rec = (o = {}) => ({
  typeCode: "C", freqCode: "A", refYear: 2025, reporterCode: 276, flowCode: "M", partnerCode: 0, partner2Code: 0,
  classificationCode: "H6", cmdCode: "090111", customsCode: "C00", motCode: 0, qtyUnitCode: 8, qty: 1000, isQtyEstimated: false,
  netWgt: 1000, isNetWgtEstimated: false, cifvalue: 100, fobvalue: null, primaryValue: 100, ...o,
});
const reply = (data, extra = {}) => async (url, init) => {
  reply.last = { url, init };
  return new Response(JSON.stringify({ elapsedTime: "0.1", count: data.length, data, error: "", ...extra }), { status: 200 });
};
const call = (fetchImpl, o = {}) => fetchImports(BASE, KEY, { comtradeCode: 276, years: [2024, 2025], hs6Block: ["090111", "170114"], ...o }, fetchImpl);

test("P3-T4: normaliza CIF, origem Brasil e preserva zero declarado", async () => {
  const lines = await call(reply([rec(), rec({ partnerCode: 76, cifvalue: 30, primaryValue: 30, netWgt: 0, isNetWgtEstimated: true })]));
  assert.deepEqual(lines[0], { hs6: "090111", year: 2025, origin: "world", valueUsd: 100, basis: "CIF", netKg: 1000, netKgEstimated: false, qty: 1000, qtyUnitCode: 8, qtyEstimated: false });
  assert.equal(lines[1].origin, "brazil");
  assert.equal(lines[1].netKg, 0, "zero declarado não vira ausência");
  assert.equal(lines[1].netKgEstimated, true);
  const noCif = await call(reply([rec({ cifvalue: null, primaryValue: 77 })]));
  assert.equal(noCif[0].basis, "primary");
});

test("P3-T4: chave só no cabeçalho; nunca aparece em URL nem em erro", async () => {
  await call(reply([rec()]));
  assert.ok(!reply.last.url.includes(KEY));
  assert.equal(reply.last.init.headers["Ocp-Apim-Subscription-Key"], KEY);
  const u = new URL(reply.last.url);
  assert.equal(u.searchParams.get("partnerCode"), "0,76");
  assert.equal(u.searchParams.get("period"), "2024,2025");
  assert.equal(u.searchParams.get("customsCode"), "C00");
  for (const status of [401, 403, 429, 500, 400]) {
    const e = await call(async () => new Response(`erro com ${KEY}`, { status })).catch((x) => x);
    assert.ok(!e.message.includes(KEY), String(status));
    assert.ok(!JSON.stringify(e.details).includes(KEY), String(status));
  }
  assert.equal(redact(`https://x/y?a=1&subscription-key=${KEY}&b=2`), "https://x/y?a=1&subscription-key=***&b=2");
});

test("P3-T4: lista no limite é truncated; count divergente é incompleta; sem chave é auth", async () => {
  await assert.rejects(call(reply([rec()], { count: 100000 })), (e) => e.details.code === "truncated");
  await assert.rejects(call(reply([rec()], { count: 2 })), (e) => e.kind === "incomplete");
  await assert.rejects(fetchImports(BASE, "", { comtradeCode: 276, years: [2025], hs6Block: ["090111"] }, reply([])), (e) => e.kind === "auth" && e.details.code === "no_key");
});

test("P3-T4: linha fora do filtro ou desdobrada nunca é somada", async () => {
  for (const bad of [{ reporterCode: 251 }, { flowCode: "X" }, { partnerCode: 32 }, { refYear: 2019 }, { cmdCode: "100199" }, { partner2Code: 76 }, { customsCode: "C01" }, { motCode: 1000 }])
    await assert.rejects(call(reply([rec(bad)])), (e) => e.details.code === "filter_not_applied", JSON.stringify(bad));
  await assert.rejects(call(reply([rec(), rec({ cifvalue: 5 })])), (e) => e.details.code === "ambiguous_totals");
});

test("P3-T4: erros HTTP classificados (401/403 auth, 429 temporário com Retry-After, HTML temporário)", async () => {
  assert.equal((await call(async () => new Response("", { status: 403 })).catch((e) => e)).kind, "auth");
  const r = await call(async () => new Response("", { status: 429, headers: { "retry-after": "3600" } })).catch((e) => e);
  assert.equal(r.kind, "temporary");
  assert.equal(r.details.retryAfter, 3600);
  assert.equal((await call(async () => new Response("<html>", { status: 200 })).catch((e) => e)).kind, "temporary");
});

test("P3-T4: país sem declaração → nenhum ano (a rotina não chama /data)", async () => {
  // Formato conferido em 2026-09-24: { elapsedTime, count, data:[{ period: 2025 (número), reporterCode, freqCode:"A", … }], error }.
  const da = (data) => async () => new Response(JSON.stringify({ count: data.length, data, error: "" }), { status: 200 });
  assert.deepEqual(await availableYears(BASE, 276, da([{ period: 2025, reporterCode: 276 }, { period: 2023, reporterCode: 276 }])), [2023, 2025]);
  assert.deepEqual(await availableYears(BASE, 108, da([])), []);
  await assert.rejects(availableYears(BASE, 276, da([{ period: 2025, reporterCode: 251 }])), (e) => e.details.code === "filter_not_applied");
});

test("P3-T4: blocos de SH6 agrícolas em ordem, só nível 6 e capítulos da classificação", async () => {
  const results = [
    { id: "09", aggrLevel: 2, text: "09 - Coffee" }, { id: "0901", aggrLevel: 4, text: "0901" },
    { id: "090111", aggrLevel: 6, text: "090111 - Coffee; not roasted" }, { id: "170114", aggrLevel: 6, text: "170114 - Cane sugar" },
    { id: "030211", aggrLevel: 6, text: "030211 - Trout" }, { id: "280110", aggrLevel: 6, text: "Chlorine" }, { id: "010121", aggrLevel: 6, text: "Horses" },
  ];
  const r = await loadHsBlocks(BASE, ["01", "09", "17"], async () => new Response(JSON.stringify({ results }), { status: 200 }), 2);
  assert.deepEqual(r.codes, ["010121", "090111", "170114"]);
  assert.deepEqual(r.blocks, [["010121", "090111"], ["170114"]]);
  assert.equal(r.names["090111"], "Coffee; not roasted");
});
