// Filtro de disponibilidade da prospecção internacional (2026-10-22): uma relação país × produto nos dois sentidos
// (commodity → países; país → commodities), na criação da pesquisa e na pesquisa automática; busca real vazia retirada
// temporariamente (motivo, fontes, data, reavaliação), pendência técnica distinta, simulação sem efeito, empresa já
// cadastrada de outra commodity mantém a combinação, reinclusão por prazo, por fonte/regra nova ou por pedido; retomada
// automática dos resumos com lease, cursor e falha registrada.
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
import { recordAssessment, fingerprintOf } from "../src/availability.js";
import { DEFAULT_PROFILE } from "../src/prospect/defaults.js";
import { summaryCatchUp, catchUpStatus } from "../src/importers.js";
import { destinationsFor, productsOf } from "../src/destinations.js";

async function world(t) {
  const ctx = setup();
  t.after(() => ctx.close());
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
// Pesquisa real concluída: as fontes aplicáveis responderam (found = candidatas de cada uma).
const job = (id = "job-teste") => ({ id, tenant_id: "eag-internal" });
const INPUT = { productId: "product-05", location: { iso3: "DEU", iso2: "DE", country: "Alemanha" } };
const ran = (found = { osm: 0, de_coffee_assoc: 0 }, extra = {}) => ({
  searchId: "busca-teste", hs6: ["090111"], existing: { count: 0 },
  applicable: [{ key: "de_coffee_assoc", label: "Kaffeeverband (diretório)" }, { key: "osm", label: "OpenStreetMap — torrefações" }],
  sourceRuns: Object.fromEntries(Object.entries(found).map(([k, n]) => [k, { done: true, found: n }])),
  ...extra,
});
const assess = (env, state, summary = { candidates: 0, registered: 0 }, at) => recordAssessment(env, { job: job(), input: INPUT, state, summary, profile: DEFAULT_PROFILE, policy: null, ...(at ? { at } : {}) });

test("dois sentidos com a mesma relação: café → Alemanha e Alemanha → café; busca real vazia retira dos dois e da criação", async (t) => {
  const { api, env, DB } = await world(t);
  let r = await coffee(api);
  assert.equal(r.state, "ready", r.message);
  assert.ok(r.items.some((x) => x.iso3 === "DEU"));
  assert.equal(r.items.find((x) => x.iso3 === "DEU").products[0].availability.tag, "não pesquisada");
  let g = await germany(api);
  assert.ok(g.countries.some((c) => c.iso2 === "DE" && c.commodities.some((x) => x.code === "coffee")), JSON.stringify(g.countries));
  assert.ok(g.country.commodities.some((x) => x.code === "coffee"));

  const a = await assess(env, ran());
  assert.equal(a.outcome, "empty");
  assert.match(a.reason, /Busca real concluída sem candidatas: Kaffeeverband \(diretório\) respondeu com 0; OpenStreetMap — torrefações respondeu com 0/);
  r = await coffee(api);
  assert.ok(!r.items.some((x) => x.iso3 === "DEU"), "fora da seleção principal");
  const w = r.withdrawn.find((x) => x.iso3 === "DEU");
  assert.ok(w, "preservada na seção recolhida");
  assert.equal(w.status, "withdrawn");
  assert.deepEqual(w.sources.map((x) => [x.key, x.status, x.found]), [["de_coffee_assoc", "ok", 0], ["osm", "ok", 0]]);
  assert.ok(w.assessedAt && w.reviewAfter > w.assessedAt);
  assert.ok(w.evidence.length, "evidência de comércio preservada");
  assert.equal(r.state, "none_available");
  assert.doesNotMatch(r.message, /não há compradores|ausência de compradores confirmada/);
  g = await germany(api);
  assert.ok(!g.countries.some((c) => c.iso2 === "DE"), "país → commodities: mesma regra");
  assert.equal(g.country.withdrawn[0].productId, "product-05");
  // Criação da pesquisa (formulário e API): recusada com o motivo; país, commodity e evidência continuam no cadastro.
  const c = await api("/api/prospect/jobs", "POST", { market: "international", productId: "product-05", location: { iso3: "DEU" } });
  assert.equal(c.status, 409, JSON.stringify(c.data));
  assert.equal(c.data.error.code, "market_withdrawn");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM countries WHERE iso3='DEU'").get().n, 1);
  // Pesquisa automática: não escolhe a combinação retirada e diz por quê.
  const auto = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
  assert.equal(auto.started, false, JSON.stringify(auto));
  assert.ok(auto.reasons.some((x) => /retirada\(s\) temporariamente por busca real recente sem candidatas/.test(x)), JSON.stringify(auto.reasons));
});

test("empresas encontradas, inclusive já cadastradas para outra commodity, mantêm a combinação disponível", async (t) => {
  const { api, env, DB } = await world(t);
  await assess(env, ran({ osm: 3, de_coffee_assoc: 0 }), { candidates: 3, registered: 2 });
  let r = await coffee(api);
  assert.equal(r.items.find((x) => x.iso3 === "DEU").products[0].availability.tag, "empresas encontradas");
  // Busca vazia, mas há empresa já cadastrada no país com atividade compatível (relacionada a açúcar, outra commodity).
  await assess(env, ran());
  assert.ok(!(await coffee(api)).items.some((x) => x.iso3 === "DEU"));
  const sugar = DB.raw.prepare("SELECT id FROM products WHERE commodity='sugar' LIMIT 1").get().id;
  DB.raw.exec(`INSERT INTO companies(id,tenant_id,legal_name,country_code,activity_text,source_label,created_by) VALUES ('co-de','eag-internal','Röstwerk Nord GmbH (fictícia)','DE','Kaffeerösterei und Süßwaren','Teste (fictício)','system-admin')`);
  DB.raw.prepare("INSERT INTO buyer_profiles(id,tenant_id,company_id,unit_key,product_id,profile_class,basis,icp_status,is_giant,updated_by,updated_at) VALUES ('bp-de','eag-internal','co-de','',?, 'unconfirmed','Teste (fictício)','pending_size',0,'system-admin','2026-10-01T00:00:00Z')").run(sugar);
  r = await coffee(api);
  const de = r.items.find((x) => x.iso3 === "DEU");
  assert.ok(de, "empresa compatível já cadastrada devolve a combinação");
  assert.equal(de.products[0].availability.tag, "empresas já cadastradas");
  assert.match(de.products[0].availability.note, /inclusive de outra commodity/);
});

test("falha, fonte pendente e busca não aberta: pendência técnica, nunca retirada; automática espera o prazo de nova tentativa", async (t) => {
  const { api, env } = await world(t);
  const failed = await assess(env, ran({ de_coffee_assoc: 0 }, { sourceRuns: { de_coffee_assoc: { done: true, found: 0 }, osm: { done: true, failed: "OpenStreetMap: servidor recusou (521)" } } }));
  assert.equal(failed.outcome, "technical");
  assert.match(failed.reason, /Pesquisa incompleta: OpenStreetMap — torrefações: falhou \(OpenStreetMap: servidor recusou \(521\)\)\. Isso não indica ausência de compradores/);
  const r = await coffee(api);
  const de = r.items.find((x) => x.iso3 === "DEU");
  assert.ok(de, "continua na seleção principal");
  assert.equal(de.products[0].availability.tag, "pendência técnica");
  assert.equal(r.withdrawn.length, 0);
  const auto = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
  assert.equal(auto.started, false, "sem repetir a consulta idêntica antes do prazo");
  assert.ok(auto.coverage.waitingRetry.some((x) => /pendência técnica, nova tentativa a partir de/.test(x)), JSON.stringify(auto.coverage));
  // Busca de empresas não aberta (aguardando evidência) e fonte sem cobertura: também técnicas.
  assert.equal((await assess(env, { applicable: [], sourceRuns: {}, marketGap: { reason: "sem comércio no período" } })).outcome, "technical");
  assert.equal((await assess(env, ran({ de_coffee_assoc: 0 }, { applicable: [{ key: "de_coffee_assoc", label: "K" }, { key: "osm", label: "O", status: "pending", note: "sem cobertura" }] }))).outcome, "technical");
});

test("simulação nunca altera a disponibilidade dos mercados reais", async (t) => {
  const { api, env, DB } = await world(t);
  env.SIMULATED_DISCOVERY = "1";
  const a = await assess(env, ran());
  assert.equal(a.origin, "simulated");
  delete env.SIMULATED_DISCOVERY;
  const de = (await coffee(api)).items.find((x) => x.iso3 === "DEU");
  assert.ok(de, "a combinação real continua disponível");
  assert.equal(de.products[0].availability.tag, "não pesquisada");
  assert.equal(DB.raw.prepare("SELECT origin FROM market_assessments").get().origin, "simulated", "registrada como simulada");
  // Avaliação real posterior não encerra a simulada nem é encerrada por ela.
  await assess(env, ran());
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM market_assessments WHERE superseded_at IS NULL").get().n, 2);
});

test("reinclusão: prazo vencido, fonte ou regra nova e pedido de reavaliação, com histórico preservado", async (t) => {
  const { api, env, DB } = await world(t);
  await assess(env, ran());
  assert.ok(!(await coffee(api)).items.some((x) => x.iso3 === "DEU"));
  // Fonte ou regra nova: a impressão das fontes muda.
  DB.raw.prepare("UPDATE market_assessments SET fingerprint=? WHERE superseded_at IS NULL").run(fingerprintOf("DE", ["090111"], { sources: { international: ["osm"] } }));
  let de = (await coffee(api)).items.find((x) => x.iso3 === "DEU");
  assert.equal(de?.products[0].availability.tag, "reavaliação");
  assert.match(de.products[0].availability.note, /mudaram as fontes ou a regra de descoberta/);
  // Prazo vencido.
  DB.raw.prepare("UPDATE market_assessments SET fingerprint=?, review_after='2000-01-01T00:00:00.000Z' WHERE superseded_at IS NULL").run(fingerprintOf("DE", ["090111"], DEFAULT_PROFILE));
  de = (await coffee(api)).items.find((x) => x.iso3 === "DEU");
  assert.match(de?.products[0].availability.note ?? "", /avaliação vencida/);
  // Pedido de reavaliação por pessoa (busca vazia vigente): volta; a avaliação anterior fica no histórico.
  await assess(env, ran());
  assert.ok(!(await coffee(api)).items.some((x) => x.iso3 === "DEU"));
  const rr = await api("/api/prospect/availability/reassess", "POST", { productId: "product-05", iso3: "DEU" });
  assert.equal(rr.status, 200, JSON.stringify(rr.data));
  de = (await coffee(api)).items.find((x) => x.iso3 === "DEU");
  assert.equal(de?.products[0].availability.tag, "não pesquisada");
  const hist = DB.raw.prepare("SELECT outcome,superseded_reason FROM market_assessments ORDER BY assessed_at").all();
  assert.equal(hist.length, 2, "nada apagado");
  assert.deepEqual(hist.map((x) => x.superseded_reason), ["nova avaliação", "reavaliação pedida por pessoa"]);
  assert.ok(DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='market_assessment.reassess_requested'").get().n === 1);
  assert.equal((await api("/api/prospect/availability/reassess", "POST", { productId: "product-05", iso3: "DEU" })).status, 404, "sem avaliação vigente");
});

test("preparação parcial: resumo ausente é preparação, nunca ausência; retomada automática em lotes com lease, cursor e falha registrada", async (t) => {
  const { api, env, DB } = await world(t);
  const p = (await api("/api/catalog/product-05")).data;
  await api("/api/catalog/product-05/codes", "POST", { codeSystem: "HS", code: "090111", status: "confirmed", classificationVersion: "HS2022", sourceRef: "Teste (fictício)", expectedRevision: p.revision, reason: "Teste" });
  DB.raw.exec("DELETE FROM trade_country_summary");
  const products = await productsOf(env, "eag-internal", { commodity: "coffee" });
  const before = await destinationsFor(env, "eag-internal", { products, profile: DEFAULT_PROFILE });
  assert.equal(before.state, "preparing", before.message);
  assert.ok(!["none_valid", "none_incomplete"].includes(before.state));
  assert.ok(before.coverage.pendingSummaries > 0);
  const total = before.coverage.pendingSummaries;
  // Um objeto oficial ausente no R2: falha registrada, os demais seguem.
  const lost = DB.raw.prepare("SELECT r2_key FROM trade_list_current WHERE source='comtrade' AND iso3='CHN'").get()?.r2_key;
  if (lost) env.FILES.store.delete(lost);
  // Duas execuções ao mesmo tempo: só uma pega o lease.
  const [a, b] = await Promise.all([summaryCatchUp(env, "eag-internal", { batch: 1 }), summaryCatchUp(env, "eag-internal", { batch: 1 })]);
  assert.deepEqual([a.state, b.state].sort(), ["busy", "ran"]);
  const first = a.state === "ran" ? a : b;
  assert.ok(first.remaining < total || first.errors.length, "progresso persistido");
  let st = await catchUpStatus(env);
  assert.ok(st.lastFinishedAt && st.remaining != null);
  for (let k = 0; k < 20; k++) {
    const r = await summaryCatchUp(env, "eag-internal", { batch: 2 });
    if (r.state === "idle") break;
  }
  st = await catchUpStatus(env);
  if (lost) assert.match(st.error ?? "", /comtrade\/CHN: objeto não encontrado no R2/, "falha identificada como tal");
  const after = await destinationsFor(env, "eag-internal", { products, profile: DEFAULT_PROFILE });
  assert.ok(after.items.some((x) => x.iso3 === "DEU"), after.message);
  // Sem nada pendente: nenhuma gravação a cada ciclo.
  if (!lost) assert.equal((await summaryCatchUp(env, "eag-internal")).state, "idle");
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
  // Descoberta desta execução é a do mundo simulado do teste; aqui ela vale como execução "real" do motor (sem a marca).
  const j = await drive((await legacyJob(env, { market: "international", productId: "product-05", location: { iso3: "DEU" }, hs6: "090111" })).id);
  assert.equal(j.status, "done", JSON.stringify(j.events.slice(-3)));
  assert.ok(j.summary.assessment, "relatório traz a avaliação");
  assert.ok(j.events.some((e) => e.step === "report" && /^Disponibilidade: /.test(e.message)));
  const row = DB.raw.prepare("SELECT * FROM market_assessments WHERE job_id=?").get(j.id);
  assert.equal(row.outcome, j.summary.assessment.outcome);
  assert.equal(row.origin, "real");
  assert.ok(JSON.parse(row.sources_json).length >= 1);
  // A mesma prévia em modo demonstração marca a execução como simulada.
  env.SIMULATED_DISCOVERY = "1";
  DB.raw.prepare("UPDATE prospect_jobs SET status='done'").run();
  const j2 = await drive((await legacyJob(env, { market: "international", productId: "product-05", location: { iso3: "DEU" }, hs6: "090111" })).id);
  assert.equal(DB.raw.prepare("SELECT origin FROM market_assessments WHERE job_id=?").get(j2.id).origin, "simulated");
  assert.match(j2.events.find((e) => e.step === "report" && /^Disponibilidade/.test(e.message)).message, /execução simulada: registrada, sem efeito sobre os mercados reais/);
});
