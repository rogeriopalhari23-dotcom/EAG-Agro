// Decisões rotineiras da pesquisa tomadas pelo Compass dentro da política (autorização delimitada de 2026-10-20):
//   - classificação fiscal automática ("Açúcar — África do Sul"), pergunta só da característica que muda o código;
//   - pesquisa automática nacional e internacional por rotação, com justificativa, sem duplicar o que está em andamento;
//   - política persistente (não pede a mesma decisão por pesquisa); sem política, recusa clara;
//   - mesma empresa encontrada para duas commodities: uma empresa, duas relações com evidências independentes, sem
//     duplicar nem perder histórico; restrições da empresa continuam valendo para qualquer commodity.
// Tudo SIMULADO (lista mensal de teste, Receita fictícia); nenhuma rede real.
import test from "node:test";
import { revokedPolicy } from "./helpers/revoked-policy.mjs";
import { legacyJob } from "./helpers/legacy-job.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { internalCaller } from "../src/worker.js";
import { runJob } from "../src/prospect/engine.js";
import { restrictionsFor } from "../src/restrictions.js";
import { mentionableCharacteristics } from "../src/catalog.js";

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url)));
const CORN = (() => { const c = read("docs/implementation/rodadas/exemplos/milho-gmo-indiara-300km.json"); return { ...c, id: "teste-milho-indiara", sources: c.sources.filter((x) => x.id !== "casadosdados") }; })();
const SOY = { ...read("docs/implementation/rodadas/exemplos/soja-rio-verde-150km.json"), id: "teste-soja-rio-verde" };
// Farelo de soja: commodity sem segmento sugerido; a rodada traz o segmento escolhido (sem regra de busca automática).
const SOYMEAL = { ...CORN, id: "teste-farelo-indiara", commodity: { code: "soy_meal", label: "farelo de soja", productId: "product-16", segments: { feed_mill: { label: "fábrica de ração" } }, nameHints: [], restrictionHints: [] } };
const REG = { "11111111000191": { razao_social: "ALFA NUTRICAO ANIMAL LTDA (FICTICIA)", estabelecimento: { situacao_cadastral: "Ativa", cidade: { nome: "Rio Verde" }, estado: { sigla: "GO" }, tipo: "Matriz" } } };

async function world(t) {
  const ctx = setup();
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const m = /publica\.cnpj\.ws\/cnpj\/(\d{14})/.exec(String(url));
    if (m) return REG[m[1]] ? Response.json(REG[m[1]]) : new Response("{}", { status: 404 });
    throw new Error(`rede bloqueada no teste: ${url}`);
  };
  t.after(() => ((globalThis.fetch = real), ctx.close()));
  const grant = () => ctx.api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão de teste (fictícia)" });
  return { ...ctx, grant };
}
// Rodada com uma candidata assistida (mesmo CNPJ), executada e cadastrada em descoberta.
async function roundWith(api, config, productId, quote, DB) {
  const r = await api("/api/rounds", "POST", { name: `Teste ${config.id}`, config: { ...config, commodity: { ...config.commodity, productId } } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const base = `/api/rounds/${r.data.id}`;
  const seg = Object.keys(config.commodity.segments)[0];
  const c = await api(`${base}/candidates`, "POST", { intake: "assisted", candidate: { name: "Alfa Nutrição Animal (fictícia)", registrationId: "11.111.111/0001-91", municipality: "Rio Verde", region: "GO", segment: seg, sourceUrl: `https://alfa.previa.invalid/${config.commodity.code}`, evidence: { kind: "commodity_use", strength: "own_source", quote } } });
  assert.ok(c.status < 300, JSON.stringify(c.data));
  const rv = (await api(base)).data;
  await api(`${base}/preflight-ack`, "POST", { revision: rv.revision });
  // Limite de 3 consultas por minuto da Receita: o teste "passa o tempo" entre as rodadas.
  DB?.raw.prepare("UPDATE round_source_calls SET called_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes')").run();
  const run = await api(`${base}/run`, "POST", {});
  assert.ok(run.status < 300, JSON.stringify(run.data));
  const out = (await api(`${base}/register`, "POST", { mode: "discovery", productId })).data;
  if (!out.items?.length) out.debug = { run: run.data.counters, results: (await api(base)).data.results.map((x) => ({ key: x.key, status: x.status, pending: x.pending })) };
  return out;
}

test("mesma empresa para milho e farelo de soja: uma empresa, duas relações, evidências independentes; nova pesquisa não duplica; restrições valem para todas", async (t) => {
  const { api, DB, env } = await world(t);
  const a = await roundWith(api, CORN, "product-03", "fabricamos ração com milho", DB);
  assert.equal(a.items.find((x) => x.key)?.outcome, "created", JSON.stringify(a));
  const companyId = a.items[0].companyId;
  const b = await roundWith(api, SOYMEAL, "product-16", "usamos farelo de soja na ração", DB);
  assert.equal(b.items[0].outcome, "relation_added", JSON.stringify(b));
  assert.equal(b.items[0].companyId, companyId, "a mesma empresa, reaproveitada");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE registration_id='11111111000191'").get().n, 1, "nenhuma empresa duplicada");
  const prof = DB.raw.prepare("SELECT product_id FROM buyer_profiles WHERE company_id=? ORDER BY product_id").all(companyId).map((x) => x.product_id);
  assert.deepEqual(prof, ["product-03", "product-16"], "uma relação por produto; a do milho não foi substituída");
  const ev = (pid) => DB.raw.prepare("SELECT COUNT(*) n FROM evidence WHERE company_id=? AND product_id=?").get(companyId, pid).n;
  const [evCorn, evMeal] = [ev("product-03"), ev("product-16")];
  assert.ok(evCorn >= 1 && evMeal >= 1, "evidências independentes por produto");
  // Nova pesquisa da mesma combinação: complementa sem duplicar (nada novo → já existente).
  const c = await roundWith(api, { ...SOYMEAL, id: "teste-farelo-indiara-2" }, "product-16", "usamos farelo de soja na ração", DB);
  assert.equal(c.items[0].outcome, "already_exists", JSON.stringify({ c, rel: DB.raw.prepare("SELECT detail_json FROM round_registrations WHERE company_id=? ORDER BY registered_at DESC LIMIT 1").get(companyId).detail_json.slice(0, 600), ev: DB.raw.prepare("SELECT evidence_type,reference,source_url,product_id FROM evidence WHERE company_id=?").all(companyId) }));
  assert.equal(ev("product-16"), evMeal, "mesma evidência não se repete");
  assert.equal(ev("product-03"), evCorn, "histórico do milho intacto");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM buyer_profiles WHERE company_id=?").get(companyId).n, 2);
  // Pausa da empresa (ex.: oposição registrada) vale para qualquer commodity: outra commodity não a contorna.
  DB.raw.prepare("INSERT INTO pauses(id,tenant_id,scope,scope_ref,reason,created_by) VALUES ('p-teste','eag-internal','company',?,'Oposição registrada (fictícia)','system-admin')").run(companyId);
  for (const commodity of ["corn", "soy_meal"]) assert.ok((await restrictionsFor(env, "eag-internal", { companyId, commodity })).includes("paused_company"), `pausa vale para ${commodity}`);
  const d = await roundWith(api, { ...CORN, id: "teste-milho-indiara-2" }, "product-03", "fabricamos ração com milho", DB);
  assert.ok(["already_exists", "relation_added"].includes(d.items[0]?.outcome), JSON.stringify(d));
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM pauses WHERE scope_ref=? AND resumed_at IS NULL").get(companyId).n, 1, "a nova pesquisa não retira a pausa");
  const det = JSON.parse(DB.raw.prepare("SELECT detail_json FROM round_registrations WHERE company_id=? ORDER BY registered_at DESC LIMIT 1").get(companyId).detail_json);
  assert.ok(det.relation.restrictions.some((x) => /pausada/.test(x)), "a relação nova informa a restrição vigente");
});

test("pesquisa automática nacional: rotação entre origens configuradas, justificativa, sem duplicar em andamento; dados a atualizar voltam", async (t) => {
  const { api, DB, grant } = await world(t);
  // Sem política vigente (revogada): recusa clara; a revogação prevalece sobre a autorização escrita.
  revokedPolicy(DB);
  assert.equal((await api("/api/prospect/auto", "POST", { market: "national" })).status, 409);
  await grant();
  for (const [cfg, pid] of [[CORN, "product-03"], [SOY, "product-01"], [SOYMEAL, "product-16"]]) assert.equal((await api("/api/rounds", "POST", { name: `Origem ${cfg.id}`, config: { ...cfg, commodity: { ...cfg.commodity, productId: pid } } })).status, 201);
  const a = (await api("/api/prospect/auto", "POST", { market: "national" })).data;
  assert.equal(a.started, true, JSON.stringify(a));
  assert.equal(a.eligible, 2, "farelo de soja sem segmento de busca automática não entra");
  assert.match(a.reason, /origem configurada em rodada .*nunca pesquisada.*Segmentos com busca automática.*Raio \d+ km/);
  assert.ok(a.job.events.some((e) => /Pesquisa automática nacional \(rotação entre 2/.test(e.message)));
  const b = (await api("/api/prospect/auto", "POST", { market: "national" })).data;
  assert.equal(b.started, true);
  assert.notEqual(b.job.id, a.job.id, "rotação: a outra combinação");
  assert.notEqual(b.job.input.productId, a.job.input.productId);
  const c = (await api("/api/prospect/auto", "POST", { market: "national" })).data;
  assert.equal(c.started, false, "as duas em andamento: nada duplicado");
  assert.match(c.note, /não é conclusão de ausência de compradores/);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM prospect_jobs").get().n, 2);
  // A primeira terminou há 40 dias: volta como "dados a atualizar".
  DB.raw.prepare("UPDATE prospect_jobs SET status='done', created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days') WHERE id=?").run(a.job.id);
  const d = (await api("/api/prospect/auto", "POST", { market: "national" })).data;
  assert.equal(d.started, true);
  assert.match(d.reason, /há 4\d dias \(dados a atualizar\)/);
  // Política persistente: nenhuma pesquisa automática pediu decisão de política de novo.
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM research_policies WHERE revoked_at IS NULL").get().n, 1, "uma política vigente (a revogada fica no histórico)");
});

async function tradeWorld(t) {
  const ctx = await world(t);
  const { api, DB, env } = ctx;
  const snap = (tb) => DB.raw.prepare(`SELECT * FROM ${tb}`).all();
  const saved = { countries: snap("countries"), country_mdic_codes: snap("country_mdic_codes") };
  keepCountries(DB, ["DEU", "CHN"]);
  await tradeParams(api, { period_default_months: 12 });
  const d = driver(env, sources(), { at: new Date().toISOString() });
  await d.start();
  await d.drain();
  for (const [tb, rows] of Object.entries(saved)) for (const r of rows) DB.raw.prepare(`INSERT OR IGNORE INTO ${tb} (${Object.keys(r).join(",")}) VALUES (${Object.keys(r).map(() => "?").join(",")})`).run(...Object.values(r));
  return { ...ctx, d };
}

test("pesquisa automática internacional: só país com comércio oficial com o Brasil e fonte de empresas; produto sem classificação fica de fora", async (t) => {
  const { api, grant } = await tradeWorld(t);
  await grant();
  // Classificação fiscal automática sob a política antes de escolher (2026-10-22, a mesma da lista de destinos).
  const r = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
  assert.equal(r.started, true, JSON.stringify(r));
  assert.doesNotMatch(JSON.stringify(r), /não há compradores|sem compradores/);
  assert.equal(r.job.input.location.iso3, "DEU");
  assert.match(r.reason, /Café .*× Alemanha: .*(importações de origem Brasil declaradas por Alemanha \(Comtrade|exportações do Brasil para Alemanha \(MDIC).*SH 090111.*nunca pesquisad[ao].*Fontes de empresas: .*Kaffeeverband/);
  const again = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
  assert.equal(again.started, false, "a mesma combinação em andamento não é duplicada");
});

test("classificação automática: Açúcar ICUMSA 45 — África do Sul classificado sozinho (fonte oficial); VHP usa a faixa documentada sem pergunta de lote; dado de classificação não vira argumento comercial", async (t) => {
  const { api, DB, env, grant, d } = await tradeWorld(t);
  await grant();
  const deps = { call: internalCaller(env, "rid-teste"), fetch: globalThis.fetch, trade: d.deps };
  const job = async (productId) => (await legacyJob(env, { market: "international", productId, location: { iso3: "ZAF" } })).id;
  const get = async (id) => (await api(`/api/prospect/jobs/${id}`)).data;
  const id45 = await job("product-06");
  await runJob(env, id45, deps);
  let j = await get(id45);
  const ev = j.events.find((e) => /Classificação de ICUMSA 45 resolvida automaticamente/.test(e.message));
  assert.ok(ev, JSON.stringify(j.events.map((e) => e.message)));
  assert.match(ev.message, /SH 170199 \/ NCM 1701\.99\.00 — polarização mínima 99,80%.*não é açúcar em bruto/);
  const codes = DB.raw.prepare("SELECT code_system,code,status,source_ref,updated_by FROM product_codes WHERE product_id='product-06' ORDER BY code_system").all();
  assert.deepEqual(codes.map((c) => [c.code_system, c.code, c.status]), [["HS", "170199", "confirmed"], ["NCM", "17019900", "confirmed"]]);
  assert.ok(codes.every((c) => /Res(olução)? Gecex nº 926\/2026/.test(c.source_ref) && c.updated_by === "system-classification"), "fonte oficial e versão; automação, não pessoa");
  const audit = DB.raw.prepare("SELECT actor_id,new_value_json FROM audit_log WHERE action='catalog.code_auto_classified'").get();
  assert.equal(audit.actor_id, "system-classification");
  assert.match(audit.new_value_json, /"channel":"automation"/);
  assert.notEqual(j.status, "needs_decision", "pendência técnica solucionável não para a pesquisa");
  // Reaproveita a classificação verificada: outra pesquisa do mesmo produto não grava de novo.
  const again = await job("product-06");
  await runJob(env, again, deps);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM product_codes WHERE product_id='product-06'").get().n, 2);
  // VHP: a polarização da ficha (99,30–99,60%) cruza o limite de 99,5°: a pesquisa de mercado usa as duas subposições da
  // faixa documentada, sem perguntar a polarização do lote (classificação do lote fica na etapa comercial).
  const idV = await job("product-08");
  await runJob(env, idV, deps);
  j = await get(idV);
  assert.notEqual(j.decision?.kind, "classification_characteristic", JSON.stringify(j.decision));
  assert.deepEqual(DB.raw.prepare("SELECT code FROM product_codes WHERE product_id='product-08' AND code_system='HS' ORDER BY code").all().map((x) => x.code), ["170114", "170199"]);
  const chars = DB.raw.prepare("SELECT * FROM product_characteristics WHERE product_id='product-08'").all();
  assert.ok(chars.some((c) => c.char_key === "classificacao:polarizacao_especificada" && /Ficha técnica interna EAG/.test(c.source_ref)), "fato documental guardado com a fonte");
  assert.equal(mentionableCharacteristics(chars).length, 0, "dado de classificação não vira argumento de mensagem");
  // Sem regra fundamentada (UCO): pendência técnica para o Administrador, sem código genérico.
  const idU = await job("product-27");
  await runJob(env, idU, deps);
  const u = await get(idU);
  assert.equal(u.decision.kind, "classification");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM product_codes WHERE product_id='product-27'").get().n, 0);
});
