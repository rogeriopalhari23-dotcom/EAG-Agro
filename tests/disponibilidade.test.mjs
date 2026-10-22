// Disponibilidade da prospecção internacional (2026-10-22, revisão): mercado comprador × capacidade efetiva de encontrar
// empresas. Seleção principal = todo destino com comércio comprovado; empresas identificadas (candidatas reais ou já
// cadastradas compatíveis, inclusive de outra commodity) só ordenam e informam o progresso; "Mercados a investigar" =
// acompanhamento das combinações sem candidata (não pesquisado, consultas sem estabelecimentos com cobertura e qualidade
// registradas, pendência técnica, sem fonte), sem esconder destino da seleção. Exploração em segundo plano com chave
// persistente, desligada por padrão. Mesma regra nos dois sentidos,
// na criação, na pesquisa automática e na exploração em segundo plano. Simulação, falha e cobertura insuficiente nunca
// concluem ausência. Retomada automática dos resumos com lease, cursor e falha registrada.
// Tudo SIMULADO e identificado: lista mensal de teste, R2 em memória, descoberta fictícia; nenhuma rede real.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { simulatedWorld, nearestMunicipality } from "./helpers/simulated-world.mjs";
import { legacyJob } from "./helpers/legacy-job.mjs";
import { internalCaller } from "../src/worker.js";
import { runJob } from "../src/prospect/engine.js";
import { exploreTick } from "../src/prospect/explore.js";
import { recordAssessment, fingerprintOf, EXPLORER_ID } from "../src/availability.js";
import { DEFAULT_PROFILE } from "../src/prospect/defaults.js";
import { summaryCatchUp, catchUpStatus } from "../src/importers.js";
import { destinationsFor, productsOf } from "../src/destinations.js";
import { overpassQuery, parseOverpass } from "../src/adapters/discovery.js";
import { foreignSources } from "../src/sources-applicable.js";

async function world(t) {
  const ctx = setup();
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => { throw new Error(`rede bloqueada no teste: ${url}`); };
  t.after(() => ((globalThis.fetch = real), ctx.close()));
  const { api, DB, env } = ctx;
  keepCountries(DB, ["DEU", "CHN"]);
  await tradeParams(api, { period_default_months: 12 });
  const d = driver(env, sources(), { at: new Date().toISOString() });
  await d.start();
  await d.drain();
  await api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão de teste (fictícia)" });
  return { ...ctx, d };
}
const coffee = async (api) => (await api("/api/prospect/destinations", "POST", { commodity: "coffee" })).data;
const germany = async (api) => (await api("/api/prospect/availability", "POST", { iso2: "DE" })).data;
const job = (id = "job-teste") => ({ id, tenant_id: "eag-internal" });
const INPUT = { productId: "product-05", location: { iso3: "DEU", iso2: "DE", country: "Alemanha" } };
const APPLICABLE = [{ key: "de_coffee_assoc", label: "Kaffeeverband (diretório)" }, { key: "osm", label: "OpenStreetMap — torrefações", note: "cobertura irregular; quase nunca traz identificador cadastral" }];
const ran = (found = { osm: 0, de_coffee_assoc: 0 }, extra = {}) => ({
  searchId: "busca-teste", hs6: ["090111"], existing: { count: 0 }, applicable: APPLICABLE,
  sourceRuns: Object.fromEntries(Object.entries(found).map(([k, n]) => [k, { done: true, found: n }])),
  ...extra,
});
const assess = (env, state, summary = { candidates: 0, registered: 0 }, input = INPUT) => recordAssessment(env, { job: job(), input, state, summary, profile: DEFAULT_PROFILE, policy: null });
const pairOf = (r) => r.items.find((x) => x.iso3 === "DEU")?.products.find((p) => p.productId === "product-05")?.availability;

test("mercado comprovado sem pesquisa: selecionável na seleção principal e acompanhado em \"Mercados a investigar\" (nos dois sentidos), com fundamento e fontes a consultar", async (t) => {
  const { api } = await world(t);
  const r = await coffee(api);
  assert.equal(r.state, "ready", r.message);
  assert.deepEqual(r.principal.map((x) => x.iso3).sort(), r.items.map((x) => x.iso3).sort(), "todo destino comprovado é selecionável");
  const de = r.principal.find((x) => x.iso3 === "DEU");
  assert.ok(de, "evidência de comércio preservada e selecionável");
  assert.equal(de.identified, 0);
  assert.match(de.identifiedNote, /sem empresa identificada ainda/);
  assert.equal(r.identifiedSummary.withCompanies, 0);
  const inv = r.investigate.find((x) => x.iso3 === "DEU");
  assert.equal(inv.status, "not_researched");
  assert.ok(inv.evidence.length && inv.evidence.every((e) => /MDIC|Comtrade/.test(e)));
  assert.deepEqual(inv.sourcesToTry.map((x) => [x.key, x.quality]), [["de_coffee_assoc", "boa"], ["osm", "parcial"]]);
  const g = await germany(api);
  assert.ok(g.countries.some((c) => c.iso2 === "DE" && c.commodities.some((x) => x.code === "coffee" && !x.identified)), "destino → commodities: mesma regra");
  assert.equal(g.country.investigate[0].productId, "product-05");
  // Criação da pesquisa aceita o destino comprovado sem empresa identificada.
  const j = await api("/api/prospect/jobs", "POST", { market: "international", productId: "product-05", location: { iso3: "DEU" } });
  assert.equal(j.status, 201, JSON.stringify(j.data));
});

test("candidatas encontradas: seleção principal nos dois sentidos, \"empresas identificadas\" sem chamar de compradoras", async (t) => {
  const { api, env } = await world(t);
  await assess(env, ran({ osm: 3, de_coffee_assoc: 1 }), { candidates: 4, registered: 3 });
  const r = await coffee(api);
  assert.equal(r.state, "ready");
  const de = r.principal.find((x) => x.iso3 === "DEU");
  assert.equal(r.principal[0].iso3, "DEU", "empresas identificadas primeiro na ordem");
  assert.equal(de.identified, 1);
  assert.equal(de.products[0].availability.tag, "empresas identificadas");
  assert.match(de.products[0].availability.note, /Candidatas, não compradoras confirmadas/);
  const g = await germany(api);
  assert.ok(g.countries.some((c) => c.iso2 === "DE" && c.commodities.some((x) => x.code === "coffee" && x.identified)));
});

test("consulta vazia, falha ou pendência nunca retiram o destino comprador da seleção principal", async (t) => {
  const { api, env } = await world(t);
  await assess(env, ran());
  let r = await coffee(api);
  assert.ok(r.principal.some((x) => x.iso3 === "DEU"), "vazia: continua selecionável");
  assert.equal(pairOf(r).status, "empty");
  assert.ok(r.investigate.some((x) => x.iso3 === "DEU"), "e acompanhada em Mercados a investigar");
  await assess(env, ran({ osm: 0 }, { sourceRuns: { osm: { done: false, error: "timeout" } } }));
  r = await coffee(api);
  assert.ok(r.principal.some((x) => x.iso3 === "DEU"), "falha: continua selecionável");
});

test("empresa já cadastrada de outra commodity com atividade compatível: empresas identificadas mesmo após consultas vazias", async (t) => {
  const { api, env, DB } = await world(t);
  await assess(env, ran());
  assert.equal(pairOf(await coffee(api)).status, "empty");
  const sugar = DB.raw.prepare("SELECT id FROM products WHERE commodity='sugar' LIMIT 1").get().id;
  DB.raw.exec(`INSERT INTO companies(id,tenant_id,legal_name,country_code,activity_text,source_label,created_by) VALUES ('co-de','eag-internal','Röstwerk Nord GmbH (fictícia)','DE','Kaffeerösterei und Süßwaren','Teste (fictício)','system-admin')`);
  DB.raw.prepare("INSERT INTO buyer_profiles(id,tenant_id,company_id,unit_key,product_id,profile_class,basis,icp_status,is_giant,updated_by,updated_at) VALUES ('bp-de','eag-internal','co-de','',?, 'unconfirmed','Teste (fictício)','pending_size',0,'system-admin','2026-10-01T00:00:00Z')").run(sugar);
  const a = pairOf(await coffee(api));
  assert.equal(a.tier, "identified");
  assert.match(a.note, /atividade compatível \(inclusive de outra commodity\)/);
});

test("consulta sem estabelecimentos: cobertura e qualidade registradas, nova tentativa no prazo da qualidade; não conclui ausência; não repete a consulta idêntica", async (t) => {
  const { api, env } = await world(t);
  const a = await assess(env, ran());
  assert.deepEqual([a.outcome, a.quality], ["empty", "complete"]);
  assert.match(a.reason, /Kaffeeverband \(diretório\) \(cobertura registro ou diretório da atividade, qualidade boa\): 0; OpenStreetMap — torrefações \(cobertura parcial \(só o que foi mapeado\), qualidade parcial\): 0/);
  assert.match(a.reason, /comprova só o resultado destas consultas, não ausência de compradores/);
  const days = (Date.parse(a.reviewAfter) - Date.now()) / 86400000;
  assert.ok(days > 89 && days < 91, `busca com registro: 90 dias (${days})`);
  const p = pairOf(await coffee(api));
  assert.deepEqual([p.tier, p.status, p.sameQuery], ["investigate", "empty", true]);
  assert.equal(p.sources[0].coverage, "registro ou diretório da atividade");
  const c = await api("/api/prospect/jobs", "POST", { market: "international", productId: "product-05", location: { iso3: "DEU" } });
  assert.equal(c.data.error?.code, "same_query_recent", JSON.stringify(c.data));
  // Só o mapa colaborativo (qualidade parcial): prazo menor (30 dias).
  const b = await assess(env, ran({ osm: 0 }, { applicable: [APPLICABLE[1]] }));
  assert.equal(b.quality, "partial");
  const d2 = (Date.parse(b.reviewAfter) - Date.now()) / 86400000;
  assert.ok(d2 > 29 && d2 < 31, `só o mapa: 30 dias (${d2})`);
  // Regra do mapa fraca (só etiqueta de produto) fica registrada como tal.
  const weak = await assess(env, ran({ osm: 0 }, { applicable: [{ key: "osm", label: "OpenStreetMap — etanol", note: "regra só pela etiqueta de produto, rara no mapa: cobertura muito irregular" }] }));
  assert.match(weak.reason, /qualidade fraca/);
});

test("falha técnica e simulação nunca concluem nada: pendência com espera crescente; simulada sem efeito", async (t) => {
  const { api, env, DB } = await world(t);
  const f1 = await assess(env, ran({ de_coffee_assoc: 0 }, { sourceRuns: { de_coffee_assoc: { done: true, found: 0 }, osm: { done: true, failed: "OpenStreetMap: servidor recusou (521)" } } }));
  assert.equal(f1.outcome, "technical");
  assert.match(f1.reason, /Isso não indica ausência de compradores/);
  const f2 = await assess(env, ran({}, { sourceRuns: { osm: { done: true, failed: "521" }, de_coffee_assoc: { done: true, failed: "503" } } }));
  const h1 = (Date.parse(f1.reviewAfter) - Date.now()) / 3600000, h2 = (Date.parse(f2.reviewAfter) - Date.now()) / 3600000;
  assert.ok(h1 > 23 && h1 < 25 && h2 > 47 && h2 < 49, `espera crescente (${h1}, ${h2})`);
  const p = pairOf(await coffee(api));
  assert.deepEqual([p.tier, p.status], ["investigate", "technical"]);
  // Simulação: registrada como tal, sem efeito sobre o mercado real.
  DB.raw.exec("DELETE FROM market_assessments");
  env.SIMULATED_DISCOVERY = "1";
  assert.equal((await assess(env, ran(), { candidates: 5, registered: 5 })).origin, "simulated");
  delete env.SIMULATED_DISCOVERY;
  assert.equal(pairOf(await coffee(api)).status, "not_researched");
});

test("reinclusão: candidatas encontradas depois levam à seleção principal; regra ou fonte nova libera nova tentativa; pedido de pessoa; mesma consulta de outro produto", async (t) => {
  const { api, env, DB } = await world(t);
  await assess(env, ran());
  DB.raw.prepare("UPDATE market_assessments SET fingerprint='consulta-antiga'").run();
  const p = pairOf(await coffee(api));
  assert.deepEqual([p.status, p.nextAttempt], ["empty", null], "regra ou fonte nova: tentativa devida");
  assert.match(p.note, /Fontes ou regras mudaram/);
  DB.raw.prepare("UPDATE market_assessments SET fingerprint=?").run(fingerprintOf("DE", ["090111"], DEFAULT_PROFILE));
  const rr = await api("/api/prospect/availability/reassess", "POST", { assessmentId: p.assessmentId });
  assert.equal(rr.status, 200, JSON.stringify(rr.data));
  assert.equal(pairOf(await coffee(api)).status, "not_researched");
  // Mesma consulta feita para outro produto do país: resultado compartilhado e identificado.
  await recordAssessment(env, { job: job("irmao"), input: { productId: "product-irmao-teste", location: INPUT.location }, state: ran(), summary: { candidates: 0, registered: 0 }, profile: DEFAULT_PROFILE, policy: null });
  const s2 = pairOf(await coffee(api));
  assert.equal(s2.viaProductId, "product-irmao-teste");
  assert.match(s2.reason, /mesma consulta de empresas já feita na pesquisa de product-irmao-teste/);
  // A exploração acha candidatas: o destino sobe na ordem, com empresas identificadas.
  await assess(env, ran({ osm: 2, de_coffee_assoc: 0 }), { candidates: 2, registered: 2 });
  assert.ok((await coffee(api)).principal.find((x) => x.iso3 === "DEU").identified > 0);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM market_assessments").get().n, 3, "histórico preservado");
});

test("exploração em segundo plano: chave persistente desligada por padrão; política, preparação e telas não a religam; desligada não revoga a política", async (t) => {
  const { api, env, DB } = await world(t);
  const sw = DB.raw.prepare("SELECT enabled FROM automation_switches WHERE name='market_exploration'").get();
  assert.equal(sw.enabled, 0, "a migração grava desligada");
  assert.equal((await exploreTick(env, "eag-internal")).state, "switched_off");
  await api("/api/prospect/policy/prepare", "POST", {});
  await coffee(api);
  await germany(api);
  assert.equal((await exploreTick(env, "eag-internal")).state, "switched_off", "preparação da política e abertura de tela não religam");
  assert.equal(DB.raw.prepare("SELECT enabled FROM automation_switches WHERE name='market_exploration'").get().enabled, 0);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM prospect_jobs WHERE created_by=?").get(EXPLORER_ID).n, 0, "nenhuma pesquisa de exploração");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM maintenance_leases WHERE name='market_exploration'").get().n, 0, "desligada não grava nada");
  assert.equal((await coffee(api)).exploration.enabled, false);
  // Política continua vigente; a pesquisa automática do botão continua.
  assert.ok(DB.raw.prepare("SELECT 1 FROM research_policies WHERE revoked_at IS NULL").get());
  const auto = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
  assert.equal(auto.started, true, JSON.stringify(auto));
});

test("exploração em segundo plano (chave ligada por decisão registrada): só com política, uma por vez, limite diário, identidade de automação", async (t) => {
  const { api, env, DB } = await world(t);
  DB.raw.prepare("UPDATE automation_switches SET enabled=1,reason='Teste (fictício)',set_by='teste',set_at=? WHERE name='market_exploration'").run(new Date().toISOString());
  const a = await exploreTick(env, "eag-internal");
  assert.equal(a.state, "started", JSON.stringify(a));
  const j = DB.raw.prepare("SELECT id,created_by,status FROM prospect_jobs WHERE id=?").get(a.jobId);
  assert.equal(j.created_by, EXPLORER_ID, "identidade de automação, não uma pessoa");
  const ev = DB.raw.prepare("SELECT message FROM prospect_job_events WHERE job_id=? ORDER BY at").all(a.jobId).map((x) => x.message).join(" | ");
  assert.match(ev, /Exploração automática em segundo plano \(política de pesquisa v1; 1 de 6 hoje/);
  assert.equal((await exploreTick(env, "eag-internal")).state, "busy", "uma de cada vez");
  // O motor executa a pesquisa com a identidade de automação (sem conta de acesso).
  await runJob(env, a.jobId, { call: internalCaller(env, "rid-teste"), fetch: globalThis.fetch });
  const after = (await api(`/api/prospect/jobs/${a.jobId}`)).data;
  assert.ok(!after.events.some((e) => /não está mais ativa/.test(e.message)), JSON.stringify(after.events.slice(-2)));
  // Limite diário pela política.
  DB.raw.prepare("UPDATE prospect_jobs SET status='done'").run();
  const pol = DB.raw.prepare("SELECT id,policy_json FROM research_policies WHERE revoked_at IS NULL").get();
  const pj = JSON.parse(pol.policy_json);
  DB.raw.prepare("UPDATE research_policies SET policy_json=? WHERE id=?").run(JSON.stringify({ ...pj, international: { ...pj.international, explorationPerDay: 1 } }), pol.id);
  assert.equal((await exploreTick(env, "eag-internal")).state, "limit");
  // Status para a tela.
  const st = (await coffee(api)).exploration;
  assert.ok(st && st.last?.state === "started" && st.lastRunAt, JSON.stringify(st));
  // Sem política vigente: nada.
  await api("/api/prospect/policy/revoke", "POST", { reason: "Teste de revogação" });
  assert.equal((await exploreTick(env, "eag-internal")).state, "no_policy");
});

test("pesquisa automática do botão: empresa identificada sem pesquisa própria vem antes de mercado a investigar", async (t) => {
  const { api, DB } = await world(t);
  DB.raw.exec(`INSERT INTO companies(id,tenant_id,legal_name,country_code,activity_text,source_label,created_by) VALUES ('co-de2','eag-internal','Kaffee Werk GmbH (fictícia)','DE','Kaffeerösterei','Teste (fictício)','system-admin')`);
  const r = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
  assert.equal(r.started, true, JSON.stringify(r));
  assert.match(r.reason, /empresas identificadas .* sem pesquisa própria: aproveitar o que existe/);
});

test("Martinica: área do país em qualquer nível do mapa; área inexistente é falha da consulta; registro francês cobre os departamentos ultramarinos", () => {
  const q = overpassQuery("MQ", [["craft", "coffee_roaster"]]);
  assert.ok(!/admin_level/.test(q), q);
  assert.match(q, /area\["ISO3166-1"="MQ"\]->\.a;\.a out count;/);
  assert.throws(() => parseOverpass({ elements: [{ type: "count", id: 0, tags: { areas: "0", total: "0" } }] }), /área do país não foi encontrada.*falha da consulta, não ausência/);
  assert.equal(parseOverpass({ elements: [{ type: "count", id: 0, tags: { areas: "2" } }] }).areaCount, 2);
  for (const iso2 of ["MQ", "GP", "GF", "RE", "YT"]) assert.ok(foreignSources(iso2, ["090111"]).some((x) => x.key === "fr_registry" && x.status === "available"), iso2);
  assert.ok(!foreignSources("BR", ["090111"]).some((x) => x.key === "fr_registry"));
});

test("preparação parcial: resumo ausente é preparação, nunca ausência; retomada em lotes com lease, cursor e falha registrada", async (t) => {
  const { api, env, DB } = await world(t);
  const p = (await api("/api/catalog/product-05")).data;
  await api("/api/catalog/product-05/codes", "POST", { codeSystem: "HS", code: "090111", status: "confirmed", classificationVersion: "HS2022", sourceRef: "Teste (fictício)", expectedRevision: p.revision, reason: "Teste" });
  DB.raw.exec("DELETE FROM trade_country_summary");
  const products = await productsOf(env, "eag-internal", { commodity: "coffee" });
  const before = await destinationsFor(env, "eag-internal", { products, profile: DEFAULT_PROFILE });
  assert.equal(before.state, "preparing", before.message);
  const lost = DB.raw.prepare("SELECT r2_key FROM trade_list_current WHERE source='comtrade' AND iso3='CHN'").get()?.r2_key;
  if (lost) env.FILES.store.delete(lost);
  const [a, b] = await Promise.all([summaryCatchUp(env, "eag-internal", { batch: 1 }), summaryCatchUp(env, "eag-internal", { batch: 1 })]);
  assert.deepEqual([a.state, b.state].sort(), ["busy", "ran"]);
  for (let k = 0; k < 20; k++) if ((await summaryCatchUp(env, "eag-internal", { batch: 2 })).state === "idle") break;
  const st = await catchUpStatus(env);
  if (lost) assert.match(st.error ?? "", /comtrade\/CHN: objeto não encontrado no R2/);
  const after = await destinationsFor(env, "eag-internal", { products, profile: DEFAULT_PROFILE });
  assert.ok(after.items.some((x) => x.iso3 === "DEU"), after.message);
});

test("retomada sem pendência não relê o D1 a cada ciclo; lista nova invalida a verificação guardada", async (t) => {
  const { env, DB } = await world(t);
  for (let k = 0; k < 40; k++) if ((await summaryCatchUp(env, "eag-internal", { batch: 60 })).state === "idle") break;
  assert.equal((await summaryCatchUp(env, "eag-internal")).state, "idle");
  const b = await summaryCatchUp(env, "eag-internal");
  assert.deepEqual([b.state, b.cached], ["idle", true]);
  DB.raw.prepare("UPDATE trade_list_versions SET finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 minute') WHERE rowid=(SELECT MAX(rowid) FROM trade_list_versions)").run();
  assert.equal((await summaryCatchUp(env, "eag-internal")).cached, undefined);
});

test("pela prospecção: o relatório registra a avaliação (execução real × simulada)", async (t) => {
  const ctx = setup();
  const w = simulatedWorld({ cityAt: nearestMunicipality(ctx.DB) });
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => (await w.fetch(url, init)) ?? Promise.reject(new Error(`rede bloqueada no teste: ${url}`));
  t.after(() => ((globalThis.fetch = real), ctx.close()));
  const { api, DB, env } = ctx;
  for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
    const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt: new Date().toISOString() });
    await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Nome Sem Relação (fictício)" }] });
    await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
  }
  keepCountries(DB, ["DEU", "CHN"]);
  await tradeParams(api, { period_default_months: 12 });
  const d = driver(env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  await api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão de teste (fictícia)" });
  const deps = { call: internalCaller(env, "rid-teste"), fetch: globalThis.fetch };
  let clock = Date.now();
  const drive = async (id) => {
    for (let k = 0; k < 40; k++) {
      clock += 120_000;
      await runJob(env, id, { ...deps, now: () => new Date(clock).toISOString() });
      const j = (await api(`/api/prospect/jobs/${id}`)).data;
      if (["done", "failed", "needs_decision", "paused", "cancelled"].includes(j.status)) return j;
    }
    return (await api(`/api/prospect/jobs/${id}`)).data;
  };
  const j = await drive((await legacyJob(env, { market: "international", productId: "product-05", location: { iso3: "DEU" }, hs6: "090111" })).id);
  assert.equal(j.status, "done", JSON.stringify(j.events.slice(-3)));
  assert.ok(j.summary.assessment);
  assert.ok(j.events.some((e) => e.step === "report" && /^Disponibilidade: /.test(e.message)));
  const row = DB.raw.prepare("SELECT * FROM market_assessments WHERE job_id=?").get(j.id);
  assert.equal(row.outcome, j.summary.assessment.outcome);
  assert.equal(row.origin, "real");
  assert.ok(JSON.parse(row.sources_json).every((x) => x.coverage && x.quality), "cobertura e qualidade por fonte");
  env.SIMULATED_DISCOVERY = "1";
  DB.raw.prepare("UPDATE prospect_jobs SET status='done'").run();
  const j2 = await drive((await legacyJob(env, { market: "international", productId: "product-05", location: { iso3: "DEU" }, hs6: "090111" })).id);
  assert.equal(DB.raw.prepare("SELECT origin FROM market_assessments WHERE job_id=?").get(j2.id).origin, "simulated");
  assert.match(j2.events.find((e) => e.step === "report" && /^Disponibilidade/.test(e.message)).message, /execução simulada: registrada, sem efeito sobre os mercados reais/);
});
