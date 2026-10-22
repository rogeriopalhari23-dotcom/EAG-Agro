// Verificação parametrizada (2026-10-21): para TODAS as commodities autorizadas e classificadas do catálogo, a lista de
// destinos só afirma "nenhum comércio" com consultas válidas que incluíram os códigos do produto, e nunca confunde
// produtos diferentes. Cenários: resposta positiva, ausência válida, cobertura parcial, falha da fonte e simulação
// ausente. Tudo SIMULADO (fontes de teste, R2 em memória), identificado como tal.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver, AGRI, MDIC_ROWS, COMTRADE } from "./helpers/trade.mjs";

const CHAPTERS = ["01", "02", "09", "10", "12", "15", "17", "22", "23", "29"];
// Características do produto respondidas uma vez (as ambiguidades indispensáveis do catálogo).
const ANSWERS = { "classificacao:estado_do_cafe": "cru_nao_descafeinado", "classificacao:trigo_duro": "nao", "classificacao:bruto_ou_refinado": "ambos" };

async function classifiedProducts(api) {
  const out = [];
  for (const p of (await api("/api/catalog")).data.products) {
    if (p.active === 0) continue;
    let r = (await api("/api/prospect/destinations", "POST", { productId: p.id })).data;
    for (const a of r.asks ?? []) await api("/api/prospect/characteristic", "POST", { productId: a.productId, key: a.key, value: ANSWERS[a.key] });
    if (r.asks?.length) r = (await api("/api/prospect/destinations", "POST", { productId: p.id })).data; // aplica a classificação com a resposta
    const codes = (await api(`/api/catalog/${p.id}`)).data.codes.filter((c) => c.status === "confirmed" && c.code_system === "HS").map((c) => c.code);
    if (codes.length) out.push({ id: p.id, name: p.display_name ?? p.variant_name, hs6: codes });
  }
  return out;
}

// Um mundo por cenário: 3 países (DEU, USA, CAN), parâmetros e política; a rotina roda com as fontes do cenário.
async function world(t, scenario) {
  const ctx = setup();
  t.after(() => ctx.close());
  const { api, DB, env } = ctx;
  keepCountries(DB, ["DEU", "USA", "CAN"]);
  await tradeParams(api, { period_default_months: 12, comtrade_calls_per_day: 5000, agri_classification: { ...AGRI, chapters: CHAPTERS } });
  // Primeiro, sem rotina: classificação documental e respostas às características (base sem lista).
  const products = await classifiedProducts(api);
  const src = sources(scenario(products));
  const d = driver(env, src, { at: new Date().toISOString() });
  await d.start();
  await d.drain();
  return { ...ctx, products };
}
const dest = async (api, productId) => (await api("/api/prospect/destinations", "POST", { productId })).data;
const ncm = (p) => `${p.hs6[0]}00`;
const ncmLines = (products) => products.map((p) => `"${ncm(p)}";"10";"${p.hs6[0]}";"${p.name} (simulado)";"${p.name}"`);
const hsAll = (products) => [...new Set(products.flatMap((p) => p.hs6))];

test("todas as commodities classificadas: o catálogo autorizado tem classificação para quase tudo (UCO e CSO ficam com o Administrador)", async (t) => {
  const { products } = await world(t, () => ({}));
  const ids = products.map((p) => p.id);
  assert.ok(ids.length >= 24, `${ids.length} produtos classificados: ${ids.join(", ")}`);
  assert.ok(!ids.includes("product-27") && !ids.includes("product-28"), "UCO e CSO sem código genérico");
});

test("resposta positiva: cada produto aparece pelo próprio código, no país com registro, sem herdar de outro produto", async (t) => {
  // Exportação simulada do Brasil aos EUA de CADA produto, pelo primeiro código do produto.
  const { api, products } = await world(t, (ps) => ({ mdicRows: { ...MDIC_ROWS, 2026: [...MDIC_ROWS[2026], ...ps.map((p) => `"2026";"03";"${ncm(p)}";"10";"249";"SP";"01";"0817600";1000;1000;5000`)] }, ncm: ncmLines(ps), hs: hsAll(ps) }));
  for (const p of products) {
    const r = await dest(api, p.id);
    // Sem fonte de empresas coberta, o destino comprovado fica fora da seleção principal, com o motivo (2026-10-22).
    const gaps = (r.coverageGaps ?? []).filter((x) => x.iso3 === "USA");
    const usa = r.items.find((x) => x.iso3 === "USA") ?? (gaps.length ? { products: gaps.map((x) => ({ productId: x.productId, hs6: x.hs6 })) } : null);
    assert.ok(usa, `${p.name}: EUA com registro (${r.state}: ${r.message})`);
    assert.deepEqual(usa.products.map((x) => x.productId), [p.id], `${p.name}: só o próprio produto fundamenta`);
    assert.ok(usa.products[0].hs6.every((h) => p.hs6.includes(h)), `${p.name}: códigos do próprio produto`);
  }
});

test("ausência válida: todos os países com resposta que incluiu o produto → \"nenhum destino\" com período e cobertura", async (t) => {
  // MDIC e Comtrade simulados para os 3 países, sem nenhuma linha dos produtos (a Comtrade da Alemanha sem nada).
  const { api, products } = await world(t, (ps) => ({ ncm: ncmLines(ps), hs: hsAll(ps), comtrade: { 276: { years: [2023, 2024, 2025], rows: [] }, 842: { years: [2023, 2024, 2025], rows: [] }, 124: { years: [2023, 2024, 2025], rows: [] } }, covered: { comtrade: ["CAN"], mdic: ["CAN"] } }));
  for (const p of products) {
    const r = await dest(api, p.id);
    if (r.items.length) continue; // produto com linha de fixture padrão (ex.: café na Alemanha em 2025): positivo legítimo
    assert.equal(r.state, "none_valid", `${p.name}: ${r.message} ${JSON.stringify(r.diagnostics?.[0]?.bySource?.mdic?.counts)}`);
    const d = r.diagnostics[0];
    assert.equal(d.bySource.mdic.answered, 3, `${p.name}: MDIC respondeu pelos 3 países com o produto incluído`);
    assert.match(r.message, /MDIC 20\d\d-\d\d a 20\d\d-\d\d, 3 países; Comtrade/);
  }
});

test("cobertura parcial e simulação ausente: país sem resposta simulada nunca vira \"nenhum comércio\"", async (t) => {
  // Canadá sem simulação configurada nas duas fontes (fora da lista "covered").
  const { api, products } = await world(t, (ps) => ({ ncm: ncmLines(ps), hs: hsAll(ps), comtrade: { 124: { years: [], rows: [] } } }));
  for (const p of products) {
    const r = await dest(api, p.id);
    if (r.items.length) continue;
    assert.equal(r.state, "none_incomplete", `${p.name}: ${r.message}`);
    assert.match(r.message, /Cobertura incompleta/);
    const d = r.diagnostics[0];
    assert.ok(d.bySource.mdic.counts.no_simulation >= 1, `${p.name}: Canadá sem simulação no MDIC`);
    assert.match(d.bySource.mdic.text, /sem resposta simulada configurada/);
    assert.doesNotMatch(r.message, /não registram comércio/);
  }
});

test("falha da fonte: Comtrade dos EUA falha → cobertura incompleta para todos os produtos, com a falha contada", async (t) => {
  const { api, products } = await world(t, (ps) => ({ ncm: ncmLines(ps), hs: hsAll(ps), failData: (code) => code === 842, covered: { comtrade: ["CAN"], mdic: ["CAN"] }, comtrade: { 124: { years: [2023, 2024, 2025], rows: [] } } }));
  for (const p of products) {
    const r = await dest(api, p.id);
    if (r.items.length) continue;
    const d = r.diagnostics[0];
    assert.ok(d.bySource.comtrade.counts.failed >= 1, `${p.name}: ${d.bySource.comtrade.text}`);
    assert.equal(r.state, "none_incomplete");
  }
});

test("código fora da consulta: produto cujo SH não entrou no bloco da Comtrade fica como \"consulta sem estes códigos\"", async (t) => {
  // Tabela SH da Comtrade simulada SEM os códigos dos produtos: a Comtrade respondeu, mas não consultou o produto.
  const { api, products } = await world(t, (ps) => ({ ncm: ncmLines(ps), covered: { comtrade: ["CAN"], mdic: ["CAN"] }, comtrade: { 124: { years: [2023, 2024, 2025], rows: [] } } }));
  const oil = products.find((p) => p.id === "product-19");
  assert.ok(oil, "óleo de soja classificado (1507.10 e 1507.90)");
  assert.deepEqual([...oil.hs6].sort(), ["150710", "150790"]);
  const r = await dest(api, oil.id);
  const ct = r.diagnostics[0].bySource.comtrade;
  assert.equal(ct.counts.not_consulted, 3, ct.text);
  assert.match(ct.text, /consulta sem estes códigos/);
  assert.notEqual(r.state, "none_valid", "disponibilidade da fonte não comprova consulta do produto");
  void COMTRADE;
});
