// Evidência de mercado antes da busca de empresas (R12.14), em vários países e commodities, com fontes SIMULADAS:
//   importações declaradas pelo destino (Comtrade, CIF, anual) e exportações do Brasil para o destino (MDIC, FOB, mensal),
//   cada uma com estado próprio: consulta não realizada, falha/limite, sem declaração, resposta válida sem registros,
//   evidência positiva e combinação sem simulação configurada (nunca apresentada como ausência real de comércio).
// Inclui "Milho GMO — Egito" (o caso do print) como um caso da tabela, sem exceção fixa para o país.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { simulatedWorld } from "./helpers/simulated-world.mjs";
import { sources, keepCountries, tradeParams, driver, AGRI, rec, MDIC_ROWS } from "./helpers/trade.mjs";
import { internalCaller } from "../src/worker.js";
import { runJob } from "../src/prospect/engine.js";
import { requestCountryList } from "../src/trade-list.js";

// Linha de exportação do MDIC: ano, mês, NCM, país (código MDIC), quilos, FOB em US$.
const mdic = (y, m, ncm, pais, kg, fob) => `"${y}";"${String(m).padStart(2, "0")}";"${ncm}";"10";"${pais}";"PR";"01";"0917500";${kg};${kg};${fob}`;
const NCM = ['"10059010";"10";"100590";"Milho em grão";"Maize"', '"12019000";"10";"120190";"Soja";"Soya beans"'];
// Códigos: Egito 818 (MDIC 240), Japão 392 (MDIC 399), Marrocos 504 (MDIC 474), Vietnã 704 (MDIC 858).
const CASES = [
  {
    name: "Milho GMO — Egito: destino sem declaração e sem exportação do Brasil → aguardando evidência; retoma quando os dados chegam",
    product: "product-03", hs: "100590", iso3: "EGY", code: 818,
    comtrade: { years: [], rows: [] }, // país não declarou nada à Comtrade (configurado assim)
    mdicRows: [],
    covered: { comtrade: ["EGY"], mdic: ["EGY"] },
    expect: { waiting: true, states: { comtrade: "not_declared", mdic: "no_record" } },
    later: { mdicRows: [mdic(2026, 2, "10059010", "240", 900000, 210000)] }, // o Brasil passa a exportar milho ao Egito
  },
  {
    name: "Milho GMO — Egito: sem declaração do destino, mas exportações do Brasil registradas → segue, com origem e direção identificadas",
    product: "product-03", hs: "100590", iso3: "EGY", code: 818,
    comtrade: { years: [], rows: [] },
    mdicRows: [mdic(2026, 2, "10059010", "240", 900000, 210000)],
    covered: { comtrade: ["EGY"], mdic: ["EGY"] },
    expect: { waiting: false, states: { comtrade: "not_declared", mdic: "positive" } },
  },
  {
    name: "Soja — Japão: resposta válida do destino sem registros para os filtros → informa fonte, período e filtros, sem extrapolar",
    product: "product-01", hs: "120190", iso3: "JPN", code: 392,
    comtrade: { years: [2023, 2024, 2025], rows: [rec(392, "090111", 2025, 0, 40)] }, // declarou, mas não soja
    mdicRows: [],
    covered: { comtrade: ["JPN"], mdic: ["JPN"] },
    expect: { waiting: true, states: { comtrade: "no_record", mdic: "no_record" } },
  },
  {
    name: "Milho GMO — Marrocos: exportação do Brasil só fora do período padrão → período ampliado válido (dados guardados) e segue",
    product: "product-03", hs: "100590", iso3: "MAR", code: 504,
    comtrade: { years: [], rows: [] },
    mdicRows: [], mdic2025: [mdic(2025, 1, "10059010", "474", 500000, 120000)],
    covered: { comtrade: ["MAR"], mdic: ["MAR"] },
    expect: { waiting: false, extended: true, states: { comtrade: "not_declared", mdic: "positive" } },
  },
  {
    name: "Café — Marrocos: falha da fonte do importador → nova geração no dia seguinte (aguardando limite), nunca ausência",
    product: "product-05", hs: "090111", iso3: "MAR", code: 504, fail: true,
    comtrade: { years: [2024, 2025], rows: [rec(504, "090111", 2025, 0, 70)] },
    mdicRows: [],
    covered: { comtrade: ["MAR"], mdic: ["MAR"] },
    expect: { limit: true },
  },
  {
    name: "Soja — Vietnã: combinação sem simulação configurada → nunca ausência real de comércio",
    product: "product-01", hs: "120190", iso3: "VNM", code: 704,
    comtrade: null, mdicRows: [], covered: {},
    expect: { waiting: true, states: { comtrade: "no_simulation", mdic: "no_simulation" } },
  },
];

async function world(t, c) {
  const ctx = setup();
  const w = simulatedWorld();
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => (await w.fetch(url, init)) ?? Promise.reject(new Error(`rede bloqueada no teste: ${url}`));
  t.after(() => ((globalThis.fetch = real), ctx.close()));
  const { api, DB, env } = ctx;
  const clock = { t: Date.parse(`${new Date().toISOString().slice(0, 10)}T08:00:00.000Z`) };
  const iso = () => new Date(clock.t).toISOString();
  const snap = (tb) => DB.raw.prepare(`SELECT * FROM ${tb}`).all();
  const saved = { countries: snap("countries"), country_mdic_codes: snap("country_mdic_codes") };
  keepCountries(DB, ["DEU", "CHN"]);
  await tradeParams(api, { period_default_months: 12, agri_classification: { ...AGRI, chapters: [...AGRI.chapters, "10"].sort() } });
  const rows = { 2026: [...MDIC_ROWS[2026], ...c.mdicRows], 2025: [...MDIC_ROWS[2025], ...(c.mdic2025 ?? [])] };
  const make = (mrows) => sources({ comtrade: c.comtrade ? { [c.code]: c.comtrade } : {}, covered: c.covered, hs: ["100590"], ncm: NCM, mdicRows: mrows, ...(c.fail ? { failData: (code) => code === c.code, failStatus: 400 } : {}), etags: { 2026: `"x${mrows[2026].length}"`, 2025: `"y${mrows[2025].length}"` } });
  let src = make(rows);
  let d = driver(env, src, { get at() { return iso(); } });
  await d.start();
  await d.drain();
  for (const [tb, list] of Object.entries(saved)) for (const r of list) DB.raw.prepare(`INSERT OR IGNORE INTO ${tb} (${Object.keys(r).join(",")}) VALUES (${Object.keys(r).map(() => "?").join(",")})`).run(...Object.values(r));
  const p = (await api(`/api/catalog/${c.product}`)).data;
  await api(`/api/catalog/${c.product}/codes`, "POST", { codeSystem: "HS", code: c.hs, status: "confirmed", classificationVersion: "HS2022", sourceRef: "Teste (fictício)", expectedRevision: p.revision, reason: "Teste" });
  assert.equal((await api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão de teste (fictícia)" })).status, 201);
  const deps = () => ({ call: internalCaller(env, "rid-teste"), fetch: globalThis.fetch, now: iso, trade: d.deps });
  const get = async (id) => (await api(`/api/prospect/jobs/${id}`)).data;
  const until = async (id, pred, n = 40, ms = 120_000) => {
    let j;
    for (let k = 0; k < n; k++) {
      clock.t += ms;
      await runJob(env, id, deps());
      await d.sweep();
      await d.drain();
      if (pred((j = await get(id)))) return j;
    }
    return j;
  };
  const start = async () => {
    const r = (await api("/api/prospect/jobs", "POST", { market: "international", productId: c.product, location: { iso3: c.iso3 } })).data;
    DB.raw.prepare("UPDATE prospect_jobs SET next_run_at=? WHERE id=?").run(iso(), r.id);
    return r;
  };
  // Dados novos na fonte (ex.: publicação do MDIC): novo arquivo simulado e nova geração do país no dia seguinte.
  const newData = (later) => {
    src = make({ 2026: [...MDIC_ROWS[2026], ...later.mdicRows], 2025: rows[2025] });
    d = driver(env, src, { get at() { return iso(); } });
  };
  return { ...ctx, clock, iso, until, start, get, newData, tradeDeps: () => d.deps };
}

const settled = (x) => x.waitingFor === "indicators_limit" || x.step === "select" && x.status === "done" || x.status === "needs_decision" || x.waitingFor === "market_evidence" || ["done", "failed"].includes(x.status);
for (const c of CASES) {
  test(c.name, async (t) => {
    const { DB, env, until, start, newData, clock, api, iso, tradeDeps } = await world(t, c);
    const first = await start();
    let j = await until(first.id, settled);
    const evidenceOf = (x) => Object.fromEntries((x.summary?.evidence ?? []).map((e) => [e.key, e.state]));
    if (c.expect.limit) {
      assert.equal(j.waitingFor, "indicators_limit", JSON.stringify(j.events.map((e) => e.message).slice(-3)));
      assert.ok(j.events.some((e) => /nova tentativa automática amanhã/.test(e.message)));
      assert.doesNotMatch(JSON.stringify(j), /sem registros para|não registram compra|outro país/i, "falha nunca vira ausência de comércio");
      return;
    }
    if (c.expect.waiting) {
      // Interrompida antes da busca de empresas: não é "Concluída"; a lacuna é pendência; nada de "escolher outro país".
      assert.equal(j.status, "waiting", JSON.stringify(j.events.map((e) => e.message).slice(-3)));
      assert.equal(j.waitingFor, "market_evidence");
      assert.equal(j.summary.companySearch, "not_started", "busca de candidatas não executada (não é zero encontrado)");
      assert.equal(j.summary.candidates, null);
      assert.ok(j.summary.queue.some((q) => q.name === "Evidência de mercado"), "lacuna nas pendências");
      assert.deepEqual(evidenceOf(j), c.expect.states);
      const all = JSON.stringify(j);
      assert.doesNotMatch(all, /outro país|desde —/i);
      for (const e of j.summary.evidence) {
        assert.match(e.text, e.key === "comtrade" ? /Importações declaradas por .*Comtrade, CIF/ : /Exportações do Brasil para .*MDIC, FOB/, "origem e direção identificadas");
        if (e.state === "no_record") assert.match(e.text, /SH \d{6}.* em .*Não indica que/, "fonte, período e filtros, sem extrapolar");
        if (e.state === "not_declared") assert.match(e.text, /data não informada|última declaração: \d{4}/);
        if (e.state === "no_simulation") assert.match(e.text, /sem simulação configurada.*não representa ausência real/);
      }
      assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM commodity_selections").get().n, 0, "R12.14/R12.7: nada selecionado sem evidência");
      // A mesma pesquisa é reaproveitada (sem duplicar) enquanto aguarda.
      const again = (await api("/api/prospect/jobs", "POST", { market: "international", productId: c.product, location: { iso3: c.iso3 } })).data;
      assert.equal(again.id, first.id);
      assert.equal(again.reused, true);
      assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM prospect_jobs").get().n, 1);
      if (c.later) {
        // Dados chegam: no dia seguinte a lista do país é atualizada e a mesma pesquisa retoma sozinha até a R12.7.
        newData(c.later);
        clock.t += 24 * 3600_000;
        await requestCountryList(env, "eag-internal", c.iso3, { requestedBy: "teste", reason: "Teste: nova publicação do MDIC (fictícia)", deps: tradeDeps() });
        DB.raw.prepare("UPDATE prospect_jobs SET next_run_at=? WHERE id=?").run(iso(), first.id);
        j = await until(first.id, (x) => ["done", "failed", "needs_decision"].includes(x.status), 60, 6 * 3600_000);
        assert.ok(j.events.some((e) => e.step === "select" && /pela política/.test(e.message)), JSON.stringify({ st: j.status, w: j.waitingFor, ev: j.events.map((e) => e.message.slice(0, 160)).slice(-4), cs: DB.raw.prepare("SELECT version_id,source,state,error FROM trade_list_status WHERE iso3=?").all(c.iso3) }));
        assert.ok(j.events.some((e) => /Exportações do Brasil para Egito \(MDIC, FOB, mensal; visão do Brasil\): comércio registrado de SH 100590/.test(e.message)));
        assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM prospect_jobs").get().n, 1, "a mesma pesquisa, sem duplicar");
      }
    } else {
      // Evidência positiva (de qualquer das fontes): segue pela seleção R12.7 da política até o relatório.
      assert.ok(["done", "needs_decision"].includes(j.status), JSON.stringify(j.events.map((e) => e.message).slice(-3)));
      assert.ok(j.events.some((e) => e.step === "select" && /pela política/.test(e.message)), "seleção R12.7 pela política");
      const ev = j.events.find((e) => /Evidência de mercado \(R12\.14\)/.test(e.message));
      assert.ok(ev);
      assert.match(ev.message, /Exportações do Brasil para .*\(MDIC, FOB, mensal; visão do Brasil\): comércio registrado/);
      assert.match(ev.message, /Importações declaradas por .*sem declaração|não declarou/, "a outra série segue identificada à parte");
      assert.match(ev.message, /não comprovam aceitação de GMO nem identificam compradores individuais/);
      if (c.expect.extended) assert.ok(j.events.some((e) => /período guardado mais longo \(24 meses\)/.test(e.message)));
    }
  });
}
