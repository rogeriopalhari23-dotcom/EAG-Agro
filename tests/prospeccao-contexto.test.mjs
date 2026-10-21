// Pesquisa restrita ao contexto (país × commodity × segmentos) e indicadores do país resolvidos pelo próprio Compass.
// Tudo SIMULADO: lista mensal (MDIC e Comtrade de teste), registros e mapa; nenhuma rede real.
//   - Álcool industrial × França: só fontes da França e regra de busca do álcool; nada de Alemanha, Noruega ou café.
//   - Café × Alemanha: diretório alemão do café e mapa (torrefação); nada da França nem da Noruega.
//   - Mercado sem cobertura: nenhuma fonte de empresas aparece como coberta.
//   - Milho × França sem lista mensal: o motor pede a geração (R12.15), acompanha, retoma; sem pedido duplicado; para na
//     seleção R12.7 (regra vigente) com ação concreta da pessoa.
//   - Falha da fonte, nova tentativa no dia seguinte, limite diário da fonte e política concedida por gestor.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { simulatedWorld } from "./helpers/simulated-world.mjs";
import { sources, keepCountries, tradeParams, driver, AGRI, rec } from "./helpers/trade.mjs";
import { internalCaller } from "../src/worker.js";
import { runJob } from "../src/prospect/engine.js";
import { foreignSources, nationalSources } from "../src/sources-applicable.js";
import { SEGMENT_PRESETS } from "../src/rodada/segments.js";

const FR_DATA = { 251: { years: [2023, 2024, 2025], rows: [rec(251, "100590", 2025, 0, 500), rec(251, "100590", 2025, 76, 120), rec(251, "220710", 2025, 0, 80)] } };

async function world(t, opts = {}) {
  const ctx = setup();
  const w = simulatedWorld();
  const real = globalThis.fetch;
  const offline = [];
  globalThis.fetch = async (url, init) => (await w.fetch(url, init)) ?? (offline.push(String(url)), Promise.reject(new Error(`rede bloqueada no teste: ${url}`)));
  t.after(() => ((globalThis.fetch = real), ctx.close()));
  const { api, DB, env } = ctx;
  // Relógio único para o motor e para a lista mensal.
  // 08:00 UTC do dia: os ciclos do teste não atravessam a meia-noite (um pedido por país por dia).
  const clock = { t: Date.parse(`${new Date().toISOString().slice(0, 10)}T08:00:00.000Z`) };
  const iso = () => new Date(clock.t).toISOString();
  // Lista mensal do mês só com Alemanha e China; a França volta à tabela de países SEM lista (o caso do print).
  const snap = (tb) => DB.raw.prepare(`SELECT * FROM ${tb}`).all();
  const saved = { countries: snap("countries"), country_mdic_codes: snap("country_mdic_codes") };
  keepCountries(DB, ["DEU", "CHN"]);
  await tradeParams(api, { period_default_months: 12, agri_classification: { ...AGRI, chapters: [...AGRI.chapters, "10", "22"].sort() }, ...(opts.callsPerDay ? { comtrade_calls_per_day: opts.callsPerDay } : {}) });
  const src = sources({ comtrade: FR_DATA, covered: { comtrade: ["FRA"] }, hs: ["100590", "220710"], failData: opts.failFR ? (code) => code === 251 && opts.failFR() : undefined, failStatus: 400 });
  const d = driver(env, src, { get at() { return iso(); } });
  await d.start();
  await d.drain();
  for (const [tb, rows] of Object.entries(saved)) for (const r of rows) DB.raw.prepare(`INSERT OR IGNORE INTO ${tb} (${Object.keys(r).join(",")}) VALUES (${Object.keys(r).map(() => "?").join(",")})`).run(...Object.values(r));
  // Classificação do produto no catálogo (confirmada pelo administrador, com fonte), como no fluxo normal do Catálogo.
  const confirm = async (pid, code) => {
    const p = (await api(`/api/catalog/${pid}`)).data;
    const pending = p.codes.find((c) => c.code === code && c.status === "pending");
    const r = pending
      ? await api(`/api/catalog/${pid}/codes/${pending.id}`, "PATCH", { status: "confirmed", sourceRef: "Teste (fictício)", classificationVersion: "HS2022", expectedRevision: p.revision, reason: "Teste de contexto" })
      : await api(`/api/catalog/${pid}/codes`, "POST", { codeSystem: "HS", code, status: "confirmed", classificationVersion: "HS2022", sourceRef: "Teste (fictício)", expectedRevision: p.revision, reason: "Teste de contexto" });
    assert.ok(r.status < 300, JSON.stringify(r.data));
  };
  const deps = { call: internalCaller(env, "rid-teste"), fetch: globalThis.fetch, now: iso, trade: d.deps };
  const job = async (body) => {
    const id = (await api("/api/prospect/jobs", "POST", body)).data.id;
    DB.raw.prepare("UPDATE prospect_jobs SET next_run_at=? WHERE id=?").run(iso(), id); // relógio do teste
    return id;
  };
  // Ação da pessoa pela rota (reagenda no relógio do teste).
  const act = async (id, action) => {
    const r = await api(`/api/prospect/jobs/${id}/act`, "POST", { action });
    DB.raw.prepare("UPDATE prospect_jobs SET next_run_at=? WHERE id=? AND next_run_at IS NOT NULL").run(iso(), id);
    return r;
  };
  const get = async (id) => (await api(`/api/prospect/jobs/${id}`)).data;
  // Um ciclo do cron: avança o relógio, executa a prospecção e a fila da lista mensal.
  const cycle = async (id, ms = 120_000) => {
    clock.t += ms;
    await runJob(env, id, deps);
    await d.sweep();
    await d.drain();
    return get(id);
  };
  const until = async (id, pred, n = 40, ms) => {
    let j;
    for (let k = 0; k < n; k++) if (pred((j = await cycle(id, ms)))) return j;
    return j;
  };
  const grant = () => api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão de teste (fictícia)" });
  return { ...ctx, d, src, clock, iso, confirm, job, act, get, cycle, until, grant, offline };
}
const texts = (items) => JSON.stringify(items);

test("álcool industrial × França: só fontes da França e regra do álcool; nada de Alemanha, Noruega, café ou fábrica genérica", async (t) => {
  const { api, confirm, grant, job, until, get } = await world(t);
  // Sem código SH confirmado: pendência técnica do catálogo, e nenhum mapa aparece como cobertura.
  let c = (await api("/api/prospect/coverage?market=international&productId=product-11&iso2=FR")).data;
  assert.ok(c.items.some((x) => x.key === "classification" && x.status === "pending"));
  assert.ok(!c.items.some((x) => x.key === "osm"), "sem regra para a commodity, o mapa não é cobertura");
  await confirm("product-11", "220710");
  c = (await api("/api/prospect/coverage?market=international&productId=product-11&iso2=FR")).data;
  const keys = c.items.map((x) => x.key);
  assert.deepEqual(keys.sort(), ["fr_registry", "indicators", "osm"].sort(), texts(c.items));
  assert.doesNotMatch(texts(c.items), /Kaffee|café|torrefa|Noruega|Alemanha|fábricas e torrefações/i);
  const osm = c.items.find((x) => x.key === "osm");
  assert.match(osm.label, /química, bebidas destiladas/);
  assert.match(osm.note, /etiqueta de produto|irregular/);
  assert.match(c.items.find((x) => x.key === "fr_registry").rule, /20\.14/);
  // Mesma regra no planejamento e na execução: o registro da prospecção não cita fontes de outro contexto.
  await grant();
  const id = await job({ market: "international", productId: "product-11", location: { iso3: "FRA" } });
  const j = await until(id, (x) => x.status !== "queued" && x.status !== "running" && x.status !== "waiting");
  const plan = j.events.find((e) => e.step === "plan" && /Fontes aplicáveis/.test(e.message));
  assert.ok(plan, JSON.stringify(j.events.map((e) => e.message)));
  assert.doesNotMatch(plan.message, /Kaffee|Noruega|torrefa|no_registry|de_coffee/i);
  assert.match(plan.message, /Registro oficial da França/);
  assert.notEqual((await get(id)).decision?.kind, "indicators", "lista ausente nunca vira decisão genérica");
});

test("café × Alemanha: diretório do café e mapa de torrefação; França e Noruega não aparecem; mesma regra nas funções puras", async (t) => {
  const { api } = await world(t);
  await (async () => {
    const p = (await api("/api/catalog/product-05")).data;
    await api("/api/catalog/product-05/codes", "POST", { codeSystem: "HS", code: "090111", status: "confirmed", classificationVersion: "HS2022", sourceRef: "Teste (fictício)", expectedRevision: p.revision, reason: "Teste" });
  })();
  const c = (await api("/api/prospect/coverage?market=international&productId=product-05&iso2=DE")).data;
  const keys = c.items.map((x) => x.key);
  assert.ok(keys.includes("de_coffee_assoc") && keys.includes("osm"), texts(c.items));
  assert.ok(!keys.includes("fr_registry") && !keys.includes("no_registry"));
  assert.match(c.items.find((x) => x.key === "osm").label, /torrefação/);
  // Regra única também nas funções puras.
  assert.deepEqual(foreignSources("FR", ["090111"]).map((x) => x.key), ["fr_registry", "osm"]);
  assert.deepEqual(foreignSources("NO", ["220710"]).map((x) => x.key), ["no_registry", "osm"]);
  assert.deepEqual(foreignSources("DE", []).map((x) => x.key), [], "sem classificação: nenhuma cobertura alegada");
});

test("mercado sem cobertura: commodity sem regra em país sem registro; nada aparece como coberto; Brasil sem regra = pendente", async (t) => {
  const { api, confirm } = await world(t);
  await confirm("product-29", "230210"); // Farelo de milho: 2302 sem atividades nem etiquetas mapeadas
  const c = (await api("/api/prospect/coverage?market=international&productId=product-29&iso2=JP")).data;
  assert.deepEqual(c.items.filter((x) => x.key !== "indicators"), [], texts(c.items));
  assert.equal(c.partial, true);
  // Nacional: só o que os segmentos pedem; sorgo tem segmentos sem regra → pendência, sem mapa nem ABIC.
  const n = nationalSources(SEGMENT_PRESETS.sorghum);
  assert.ok(!n.items.some((x) => ["osm-overpass", "abic-certificados", "mapa-sipeagro"].includes(x.key)));
  assert.ok(n.items.some((x) => x.key === "sem-regra" && x.status === "pending"));
  const cafe = nationalSources(SEGMENT_PRESETS.coffee);
  assert.ok(cafe.items.some((x) => x.key === "abic-certificados") && !cafe.items.some((x) => x.key === "mapa-sipeagro"));
  const r = await api("/api/sources/applicable", "POST", { market: "national", segments: SEGMENT_PRESETS.corn });
  assert.ok(r.data.config.some((x) => x.id === "mapa-sipeagro") && r.data.items.find((x) => x.key === "mapa-sipeagro").status === "pending");
});

test("milho × França sem lista mensal: o Compass pede a geração, acompanha e retoma; nenhuma geração duplicada; R12.7 pela política", async (t) => {
  const { api, DB, confirm, grant, job, act, until, cycle, get } = await world(t);
  await confirm("product-03", "100590");
  assert.equal((await grant()).status, 201);
  const pol = (await api("/api/prospect/policy")).data.current;
  assert.equal(pol.policy.indicators, true, "concedida por Administrador: inclui o pedido dos indicadores");
  const cov = (await api("/api/prospect/coverage?market=international&productId=product-03&iso2=FR")).data;
  assert.match(cov.items.find((x) => x.key === "indicators").note, /ainda não gerada; a prospecção pede a geração sozinha/);
  const id = await job({ market: "international", productId: "product-03", location: { iso3: "FRA" } });
  let j = await cycle(id);
  assert.equal(j.status, "waiting");
  assert.ok(["indicators_queued", "indicators_processing"].includes(j.waitingFor), j.waitingFor);
  assert.ok(j.events.some((e) => /ainda não foi gerada/.test(e.message)));
  assert.ok(j.events.some((e) => /pedida pelo fluxo da lista mensal \(R12\.15\)/.test(e.message)));
  // Ciclos repetidos (cron) não geram outra versão.
  j = await until(id, (x) => ["done", "failed", "needs_decision"].includes(x.status), 60, 130_000);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_versions WHERE iso3='FRA'").get().n, 1, "uma geração só");
  assert.match(DB.raw.prepare("SELECT requested_by FROM trade_list_manual_refresh WHERE iso3='FRA'").get().requested_by, /^policy:/);
  assert.ok(j.events.some((e) => /Indicadores oficiais disponíveis/.test(e.message)));
  assert.ok(j.events.some((e) => e.step === "analysis" && e.message.includes("Evidência de mercado (R12.14): Importações declaradas por França (Comtrade, CIF, anual; visão do importador): comércio registrado de SH 100590")));
  // R12.7 pela política (autorização delimitada de 2026-10-20): seleção e autorização registradas como automação.
  assert.equal(j.status, "done", JSON.stringify(j.events.map((e) => e.message).slice(-4)));
  assert.ok(j.events.some((e) => e.step === "select" && /pela política de pesquisa v1 \(R12\.7, autorização delimitada de 2026-10-20\)/.test(e.message)));
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM commodity_selections").get().n, 1, "uma seleção, sem duplicar");
  const sel = DB.raw.prepare("SELECT new_value_json FROM audit_log WHERE action='foreign_search.authorized'").get();
  assert.equal(JSON.parse(sel.new_value_json)._operation.channel, "automation", "autorização registrada como automação sob a política");
  // Fontes da descoberta: só as da França (registro e mapa com a regra do milho).
  assert.ok(!j.events.some((e) => /Kaffee|Noruega|torrefa/i.test(e.message)));
  assert.equal((await api(`/api/prospect/jobs/${id}/act`, "POST", { action: "select_authorize" })).status, 409, "nada pendente para a pessoa");
  void get;
  void act;
});

test("falha da fonte do importador: nova tentativa no dia seguinte, sem duplicar no mesmo dia; depois de 2 falhas, pendência técnica com ação", async (t) => {
  const { api, DB, confirm, grant, job, until, clock } = await world(t, { failFR: () => true });
  await confirm("product-03", "100590");
  await grant();
  const id = await job({ market: "international", productId: "product-03", location: { iso3: "FRA" } });
  let j = await until(id, (x) => x.waitingFor === "indicators_limit" || x.status === "needs_decision");
  assert.equal(j.waitingFor, "indicators_limit", JSON.stringify(j.events.map((e) => e.message).slice(-4)));
  assert.ok(j.events.some((e) => /nova tentativa automática amanhã/.test(e.message)));
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_versions WHERE iso3='FRA'").get().n, 1, "no mesmo dia, uma geração só");
  assert.ok(!j.events.some((e) => /nenhum registro|não registram compra/i.test(e.message)), "falha nunca vira ausência de importações");
  // Dia seguinte: segunda geração; falha de novo; no outro dia, para com ação concreta (Administrador).
  j = await until(id, (x) => x.status === "needs_decision", 40, 6 * 3600_000);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_versions WHERE iso3='FRA'").get().n, 2, "uma geração por dia");
  assert.equal(j.decision.kind, "indicators_failed");
  assert.equal(j.decision.category, "technical");
  assert.equal(j.decision.action.id, "request_indicators");
  assert.match(j.decision.message, /Não indica ausência de importações/);
  void clock;
});

test("limite diário da fonte: aguarda o limite (dito como tal) e retoma; política de gestor não pede indicadores: ação do Administrador", async (t) => {
  const { api, DB, env, confirm, job, act, cycle, until, clock } = await world(t, { callsPerDay: 400 });
  await confirm("product-03", "100590");
  // Política concedida por gestor (não Administrador): o pedido fora do ciclo (R12.15) não entra nela.
  DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('u-gerente','eag-internal','gerente@teste.invalid','Gerente (teste)','commercial_manager')");
  env.LOCAL_USER_EMAIL = "gerente@teste.invalid";
  assert.equal((await api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão do gestor (fictícia)" })).status, 201);
  env.LOCAL_USER_EMAIL = "admin@local.eag";
  const id = await job({ market: "international", productId: "product-03", location: { iso3: "FRA" } });
  let j = await until(id, (x) => x.status === "needs_decision");
  assert.equal(j.decision.kind, "indicators_request");
  assert.equal(j.decision.category, "technical");
  assert.match(j.decision.message, /R12\.15/);
  assert.equal(j.decision.action.roles, "admin");
  env.LOCAL_USER_EMAIL = "gerente@teste.invalid";
  assert.equal((await api(`/api/prospect/jobs/${id}/act`, "POST", { action: "request_indicators" })).status, 403, "gestor não pede a geração");
  env.LOCAL_USER_EMAIL = "admin@local.eag";
  // Orçamento da Comtrade esgotado hoje: a geração pedida pelo Administrador aguarda o limite.
  const day = new Date(clock.t).toISOString().slice(0, 10);
  DB.raw.prepare("INSERT OR REPLACE INTO provider_budget(provider,day,used) VALUES ('comtrade',?,400)").run(day);
  const r = await act(id, "request_indicators");
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(DB.raw.prepare("SELECT requested_by FROM trade_list_manual_refresh WHERE iso3='FRA'").get().requested_by, "system-admin", "pedido registrado como da pessoa que clicou");
  j = await cycle(id, 1000);
  assert.equal(j.waitingFor, "indicators_limit", JSON.stringify(j.events.slice(-2)));
  assert.ok(j.events.some((e) => /Aguardando limite da fonte: limite diário de consultas à Comtrade/.test(e.message)));
  // Dia seguinte: a fila retoma, os dados ficam prontos e a pesquisa segue (R12.7 pela política) até o relatório.
  j = await until(id, (x) => ["done", "failed", "needs_decision"].includes(x.status), 60, 6 * 3600_000);
  assert.equal(j.status, "done", JSON.stringify(j.events.map((e) => e.message).slice(-4)));
  assert.ok(j.events.some((e) => e.step === "select" && /pela política/.test(e.message)));
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_versions WHERE iso3='FRA'").get().n, 1);
});
