// Lista de países dependente da commodity e do produto (2026-10-21): só destinos com evidência oficial de comércio
// DAQUELE produto com o Brasil, numa regra só para o formulário, a criação da pesquisa e a pesquisa automática.
// Tudo SIMULADO e identificado: lista mensal de teste (MDIC e Comtrade fictícios), R2 em memória; nenhuma rede real.
// Caso "Derivados de soja — Canadá": o Canadá só aparece para a lecitina quando há exportação de lecitina do Brasil ao
// Canadá; soja em grão, farelo e importação do mundo não comprovam.
import test from "node:test";
import { revokedPolicy } from "./helpers/revoked-policy.mjs";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver, AGRI, COMTRADE, rec, MDIC_ROWS } from "./helpers/trade.mjs";

const row = (ncm, pais, v, ym = ["2026", "02"]) => `"${ym[0]}";"${ym[1]}";"${ncm}";"10";"${pais}";"SP";"01";"0817600";${v};${v};${v}`;
const NCM = [
  '"23040010";"10";"230400";"Farelo de soja (simulado)";"Soybean meal"',
  '"29232000";"10";"292320";"Lecitinas (simulado)";"Lecithins"',
  '"15071000";"10";"150710";"Óleo de soja em bruto (simulado)";"Crude soybean oil"',
  '"15079011";"10";"150790";"Óleo de soja refinado (simulado)";"Refined soybean oil"',
  '"15111000";"10";"151110";"Óleo de palma em bruto (simulado)";"Crude palm oil"',
];
// Canadá (CO_PAIS 149): soja em grão e farelo exportados pelo Brasil; lecitina só quando o cenário pede.
// EUA (249): óleo de soja refinado (só a segunda classificação do produto) e açúcar 1701.14 (já no MDIC_ROWS).
function scenario({ lecithinToCanada = false } = {}) {
  const mdic2026 = [...MDIC_ROWS[2026], row("12019000", "149", 300000), row("23040010", "149", 150000), row("15079011", "249", 80000), ...(lecithinToCanada ? [row("29232000", "149", 9000)] : [])];
  // Comtrade do Canadá (124): só importação do MUNDO (parceiro 0) de lecitina, nenhuma de origem Brasil.
  const comtrade = { 124: { years: [2023, 2024, 2025], rows: [rec(124, "292320", 2025, 0, 5000), rec(124, "120190", 2025, 0, 900)] } };
  return sources({ mdicRows: { ...MDIC_ROWS, 2026: mdic2026 }, ncm: NCM, comtrade, hs: ["292320", "230400", "150790"], covered: { comtrade: ["CAN"], mdic: ["CAN"] } });
}

async function world(t, opts = {}) {
  const ctx = setup();
  t.after(() => ctx.close());
  const { api, DB, env } = ctx;
  keepCountries(DB, ["DEU", "USA", "CAN"]);
  await tradeParams(api, { period_default_months: 12, agri_classification: { ...AGRI, chapters: ["01", "02", "09", "12", "15", "17", "23", "29"] } });
  if (opts.noList) return { ...ctx };
  const d = driver(env, scenario(opts), { at: new Date().toISOString() });
  await d.start();
  await d.drain();
  await api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão de teste (fictícia)" });
  return { ...ctx, d };
}
const dest = async (api, body) => {
  const r = await api("/api/prospect/destinations", "POST", body);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
};
const iso = (r) => r.items.map((x) => x.iso3).sort();

test("Derivados de soja — Canadá (simulado): sem exportação de lecitina ao Canadá, o país não aparece; soja em grão, farelo e importação do mundo não comprovam", async (t) => {
  const { api } = await world(t);
  const r = await dest(api, { commodity: "soy_lecithin" });
  assert.ok(!iso(r).includes("CAN"), JSON.stringify(r.items));
  assert.ok(["none_valid", "none_incomplete"].includes(r.state));
  assert.doesNotMatch(r.message, /não há compradores/);
  // Ausência afirmada só com cobertura identificada: os 3 países com resposta simulada que incluiu o SH 2923.20.
  assert.equal(r.state, "none_valid", r.message);
  assert.match(r.message, /consultas válidas que incluíram o produto .*Lecitina de soja: MDIC 20\d\d-\d\d a 20\d\d-\d\d, 3 países; Comtrade 20\d\d, 3 países/);
  const lec = r.diagnostics.find((x) => x.productId === "product-23");
  assert.deepEqual(lec.hs6, ["292320"]);
  assert.match(lec.bySource.comtrade.direction, /origem Brasil/);
  assert.match(lec.bySource.mdic.direction, /Brasil → país/);
  // Farelo é outro produto: o Canadá entra pelo próprio código do farelo (2304), não pela soja em grão.
  const meal = await dest(api, { commodity: "soy_meal" });
  assert.deepEqual(iso(meal), ["CAN"]);
  assert.match(meal.items[0].line, /MDIC — exportações do Brasil \(FOB\), .*a 2026-0\d/);
  assert.deepEqual(meal.items[0].products[0].hs6, ["230400"]);
  // Óleo de soja: o Canadá (só grão e farelo) não entra; os EUA entram pela segunda classificação (1507.90).
  const oil = await dest(api, { productId: "product-19" });
  assert.deepEqual(iso(oil), ["USA"]);
  assert.match(oil.items[0].evidence[0].text, /SH 150790/);
  // O servidor recusa iniciar a combinação sem evidência; aceita a comprovada.
  const no = await api("/api/prospect/jobs", "POST", { market: "international", productId: "product-23", location: { iso3: "CAN" } });
  assert.equal(no.status, 422);
  assert.equal(no.data.error.code, "destination_not_eligible");
  const yes = await api("/api/prospect/jobs", "POST", { market: "international", productId: "product-16", location: { iso3: "CAN" } });
  assert.equal(yes.status, 201, JSON.stringify(yes.data));
  assert.match(yes.data.input.evidenceAtStart.line, /MDIC/);
});

test("Derivados de soja — Canadá (simulado): com exportação de lecitina do Brasil ao Canadá, o país aparece, com fonte, período e produto que fundamenta", async (t) => {
  const { api } = await world(t, { lecithinToCanada: true });
  const r = await dest(api, { commodity: "soy_lecithin" });
  // Disponibilidade (regra definitiva, 2026-10-22): o destino comprovado fica na seleção principal mesmo sem fonte de
  // empresas e sem empresa identificada; "Mercados a investigar" registra a limitação de cobertura, nunca "sem destino".
  assert.equal(r.state, "ready", r.message);
  const can = r.items.find((x) => x.iso3 === "CAN");
  assert.ok(can, JSON.stringify(r));
  assert.equal(can.basis, "Lecitina de soja");
  assert.deepEqual(can.products[0].hs6, ["292320"]);
  assert.ok(can.evidence.every((e) => e.source === "mdic"), "a importação do mundo declarada pelo Canadá não entra");
  assert.match(can.line, /MDIC — exportações do Brasil/);
  assert.equal(can.connector.available, false);
  assert.match(can.connector.note, /limitação de cobertura/);
  const inv = r.investigate.find((x) => x.iso3 === "CAN");
  assert.equal(inv.status, "no_source");
  assert.match(inv.note, /limitação de cobertura, não ausência de compradores/);
  assert.ok(r.principal.some((x) => x.iso3 === "CAN" && !x.identified), "selecionável sem empresa identificada");
});

test("commodity com vários produtos: o país indica qual produto fundamenta a inclusão; produto específico restringe a lista", async (t) => {
  const { api } = await world(t);
  const sugar = await dest(api, { commodity: "sugar" });
  const usa = sugar.items.find((x) => x.iso3 === "USA");
  assert.ok(usa, JSON.stringify(sugar));
  assert.equal(usa.basis, "VHP", "só o VHP (faixa 1701.14/1701.99) tem 1701.14 exportado aos EUA");
  const icumsa = await dest(api, { productId: "product-06" });
  assert.ok(!iso(icumsa).includes("USA"), "ICUMSA 45 (1701.99) não tem registro nos EUA");
  // Cada consulta recalcula: a escolha seguinte não herda a anterior.
  // Café: nenhuma pergunta (cru/torrado fica para a etapa comercial); todas as subposições do café cruzam a lista.
  const coffee = await dest(api, { productId: "product-05" });
  assert.equal(coffee.asks.length, 0, "seleção de mercado sem característica de lote ou especificação");
  assert.deepEqual(iso(coffee), ["DEU"]);
  assert.deepEqual([...coffee.diagnostics[0].hs6].sort(), ["090111", "090112", "090121", "090122"]);
});

test("dados ausentes, resumos a refazer, vencidos e falha da fonte: estados distintos, nunca a lista inteira de países", async (t) => {
  // Sem lista mensal: cobertura incompleta, com nova tentativa; nenhum país oferecido.
  {
    const { api } = await world(t, { noList: true });
    await api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão de teste (fictícia)" });
    const r = await dest(api, { commodity: "soy_meal" });
    // Sem armazenamento de arquivos, a rotina não pode rodar: bloqueio com o motivo concreto, nunca lista vazia final.
    assert.equal(r.state, "blocked");
    assert.equal(r.items.length, 0);
    assert.equal(r.retry, true);
    assert.match(r.message, /não podem ser preparados: armazenamento de arquivos \(R2\) não configurado/);
  }
  const { api, DB } = await world(t);
  // Resumos apagados: refeitos do objeto oficial guardado (sem chamada externa) antes de responder.
  DB.raw.prepare("DELETE FROM trade_country_summary").run();
  const r = await dest(api, { commodity: "soy_meal" });
  assert.deepEqual(iso(r), ["CAN"]);
  assert.equal(r.coverage.pendingSummaries, 0);
  // Consulta válida, cobertura completa, sem registro: "nenhum destino", distinto de cobertura incompleta.
  const palm = await dest(api, { productId: "product-22" });
  assert.equal(palm.items.length, 0);
  if (palm.state === "none_valid") assert.equal(palm.retry, false);
  else assert.match(palm.message, /Cobertura incompleta/);
  // Dado vencido de destino comprovado: continua comprovado, marcado, e a atualização é pedida (política de Administrador).
  DB.raw.prepare("INSERT INTO trade_list_versions(id,kind,reference_month,classification_json,params_json,status,started_at) VALUES ('2099-01','monthly','2099-01','{}','{}','complete','2099-01-01T00:00:00Z')").run();
  const st = await dest(api, { commodity: "soy_meal" });
  assert.equal(st.items[0].stale, true);
  assert.ok(st.coverage.stale >= 1);
  assert.deepEqual(st.coverage.refreshed, ["CAN"], "atualização permitida pedida");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_manual_refresh WHERE iso3='CAN'").get().n, 1);
  const again = await dest(api, { commodity: "soy_meal" });
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_manual_refresh WHERE iso3='CAN'").get().n, 1, "sem pedido duplicado no mesmo dia");
  void again;
  // Falha da fonte num país sem lista vigente: entra na cobertura incompleta.
  DB.raw.prepare("DELETE FROM trade_list_current WHERE iso3='DEU'").run();
  DB.raw.prepare("UPDATE trade_list_status SET state='data_unavailable',error='HTTP 503 (simulado)' WHERE iso3='DEU'").run();
  const f = await dest(api, { commodity: "soy_lecithin" });
  assert.ok(f.coverage.failed >= 1, JSON.stringify(f.coverage));
  assert.ok(f.reasons.some((x) => /falha da fonte/.test(x)), JSON.stringify(f.reasons));
  // A atualização pedida (Canadá) está em geração: "Verificando mercados compradores", sem oferecer outros países.
  if (!f.items.length) assert.equal(f.state, "preparing");
});

test("pesquisa automática internacional usa a mesma regra: só combinações comprovadas do próprio produto", async (t) => {
  const { api } = await world(t);
  for (const [id, code] of [["product-16", "230400"]]) {
    const p = (await api(`/api/catalog/${id}`)).data;
    if (!p.codes.some((c) => c.status === "confirmed")) await api(`/api/catalog/${id}/codes`, "POST", { codeSystem: "HS", code, status: "confirmed", classificationVersion: "HS2022", sourceRef: "Teste (fictício)", expectedRevision: p.revision, reason: "Teste" });
  }
  const r = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
  if (r.started) assert.ok(!(r.job.input.productId === "product-23" && r.job.input.location.iso3 === "CAN"), "lecitina × Canadá sem evidência nunca é escolhida");
  const all = JSON.stringify(r);
  assert.doesNotMatch(all, /Lecitina de soja.*× Canadá/);
});
