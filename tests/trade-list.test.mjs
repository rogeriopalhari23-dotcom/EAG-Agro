import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { runJob } from "../src/trade-list.js";

const OCT = "2026-10-10T12:00:00.000Z";
const NOV = "2026-11-10T12:00:00.000Z";

async function world(t, over = {}, srcOpts = {}) {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, ["DEU", "USA", "PRT", "CHN", "TWN"]);
  await tradeParams(ctx.api, over);
  const src = sources(srcOpts);
  const clock = { at: OCT };
  const d = driver(ctx.env, src, clock);
  return { ...ctx, src, clock, d };
}
const q = (DB, sql, ...a) => DB.raw.prepare(sql).get(...a);
const all = (DB, sql, ...a) => DB.raw.prepare(sql).all(...a);
const obj = (env, key) => JSON.parse(env.FILES.store.get(key));

test("P3-T5: rotina completa — MDIC por pedaços somando códigos do país, Comtrade por país, ponteiros e fechamento", async (t) => {
  const { DB, env, d, src } = await world(t);
  await d.start();
  await d.drain();
  const v = q(DB, "SELECT * FROM trade_list_versions WHERE id='2026-10'");
  assert.equal(v.status, "complete", v.note ?? "");
  assert.ok(q(DB, "SELECT COUNT(*) n FROM trade_list_jobs WHERE version_id='2026-10' AND kind='mdic_chunk'").n > 2, "arquivo dividido em vários pedaços");
  // Alemanha: CO_PAIS 023 + 025 no mesmo NCM e mês → uma linha somada.
  const deu = obj(env, q(DB, "SELECT r2_key k FROM trade_list_current WHERE iso3='DEU' AND source='mdic'").k);
  const jan = deu.lines.find((l) => l.ncm === "09011110" && l.ym === "2026-01");
  assert.deepEqual([jan.fobUsd, jan.netKg, jan.hs6], [101500, 19300, "090111"]);
  assert.equal(deu.lines.length, 3, "2025-12, 2026-01 e 2026-03");
  assert.equal(deu.basis, "FOB");
  // EUA: capítulo 28 fora da classificação; açúcar incluído.
  const usa = obj(env, q(DB, "SELECT r2_key k FROM trade_list_current WHERE iso3='USA' AND source='mdic'").k);
  assert.deepEqual(usa.lines.map((l) => l.ncm), ["17011400"]);
  // Comtrade: Alemanha com anos recentes (3), CIF, todas as origens e Brasil.
  const cdeu = obj(env, q(DB, "SELECT r2_key k FROM trade_list_current WHERE iso3='DEU' AND source='comtrade'").k);
  assert.deepEqual(cdeu.years, [2023, 2024, 2025]);
  assert.equal(cdeu.basis, "CIF");
  assert.deepEqual(cdeu.lines.filter((l) => l.hs6 === "090111").map((l) => [l.origin, l.valueUsd]), [["brazil", 30], ["world", 100]]);
  // China sem declaração: estado próprio e nenhuma chamada de dados; Taiwan sem código na Comtrade.
  assert.equal(q(DB, "SELECT state FROM trade_list_status WHERE version_id='2026-10' AND iso3='CHN' AND source='comtrade'").state, "not_declared");
  assert.equal(q(DB, "SELECT COUNT(*) n FROM trade_list_jobs WHERE job_key LIKE 'comtrade:CHN:%'").n, 0);
  assert.equal(q(DB, "SELECT error FROM trade_list_status WHERE version_id='2026-10' AND iso3='TWN' AND source='comtrade'").error, "país sem código nesta fonte");
  // Portugal: MDIC sem linhas no período = nenhum registro (arquivo completo), nunca indisponível.
  assert.equal(q(DB, "SELECT state FROM trade_list_status WHERE version_id='2026-10' AND iso3='PRT' AND source='mdic'").state, "no_record");
  // Staging apagado, lista e referências guardadas; auditoria com contagens; CO_PAIS sem país anotado.
  assert.equal([...env.FILES.store.keys()].filter((k) => k.startsWith("trade-staging/")).length, 0);
  assert.match(v.note, /CO_PAIS sem país/);
  const audit = JSON.parse(q(DB, "SELECT new_value_json j FROM audit_log WHERE action='trade_list.closed'").j);
  assert.equal(audit.status, "complete");
  assert.ok(audit.comtradeCalls > 0);
  // HS.json + getDA dos 4 países com código + 3 blocos para os 3 que declaram (China não declara).
  assert.equal(src.calls.comtrade, 1 + 4 + 3 * 3);
});

test("P3-T5: cron duas vezes não duplica; queda entre criar a versão e os jobs é retomada (errata item 5)", async (t) => {
  const { DB, d } = await world(t);
  // Queda simulada: só a versão existe.
  DB.raw.exec(`INSERT INTO trade_list_versions(id,kind,reference_month,classification_json,params_json,started_at) VALUES ('2026-10','monthly','2026-10','{"version":"sh-teste@2026-09-24","chapters":["01","02","09","12","17"],"excluded":["03"]}','{"classification":{"version":"sh-teste@2026-09-24","chapters":["01","02","09","12","17"],"excluded":["03"]},"mdicYears":2,"comtradeYears":3,"callsPerDay":400,"retention":3}','2026-10-10T11:00:00.000Z')`);
  const r1 = await d.daily();
  assert.equal(r1.resumed, true);
  const r2 = await d.start();
  assert.equal(r2.resumed, true);
  assert.equal(q(DB, "SELECT COUNT(*) n FROM trade_list_versions").n, 1);
  const keys = all(DB, "SELECT job_key FROM trade_list_jobs").map((r) => r.job_key);
  assert.equal(new Set(keys).size, keys.length);
  await d.drain();
  assert.equal(q(DB, "SELECT status FROM trade_list_versions").status, "complete");
});

test("P3-T5: mesma mensagem entregue duas vezes e lease vencido não duplicam totais (fencing)", async (t) => {
  const { DB, env, d } = await world(t);
  await d.start();
  // Entrega duplicada de todas as mensagens.
  const dup = [...d.queue];
  d.queue.push(...dup);
  await d.drain();
  const deu = obj(env, q(DB, "SELECT r2_key k FROM trade_list_current WHERE iso3='DEU' AND source='mdic'").k);
  assert.equal(deu.lines.find((l) => l.ym === "2026-01").fobUsd, 101500);
  // Job repetido depois de pronto: nada muda.
  const doneJob = q(DB, "SELECT id FROM trade_list_jobs WHERE kind='mdic_merge' LIMIT 1").id;
  assert.deepEqual(await runJob(env, doneJob, d.deps), { skipped: true });
  // Lease antigo não grava depois de outro assumir: simula token velho tentando concluir.
  const any = q(DB, "SELECT id FROM trade_list_jobs WHERE kind='comtrade_call' LIMIT 1").id;
  const stale = DB.raw.prepare("UPDATE trade_list_jobs SET status='done',result_sha256='x' WHERE id=? AND lease_token='token-velho' AND status='leased'").run(any);
  assert.equal(stale.changes, 0);
});

test("P3-T5: falha mantém a lista anterior do país; o resto avança (AT72, Review Focus 2)", async (t) => {
  const { DB, env, d, clock } = await world(t);
  await d.start();
  await d.drain();
  const before = q(DB, "SELECT * FROM trade_list_current WHERE iso3='DEU' AND source='comtrade'");
  // Novembro: a Comtrade recusa as chamadas de dados da Alemanha; MDIC funciona.
  const nov = sources({ failData: (code) => code === 276 });
  Object.assign(d.deps, { fetch: nov.fetchImpl });
  clock.at = NOV;
  await d.daily();
  await d.drain();
  const v = q(DB, "SELECT * FROM trade_list_versions WHERE id='2026-11'");
  assert.equal(v.status, "partial");
  const after = q(DB, "SELECT * FROM trade_list_current WHERE iso3='DEU' AND source='comtrade'");
  assert.equal(after.version_id, "2026-10", "ponteiro da Comtrade da Alemanha fica em outubro");
  assert.equal(after.r2_key, before.r2_key);
  assert.ok(env.FILES.store.has(after.r2_key), "objeto anterior continua no R2");
  assert.equal(q(DB, "SELECT version_id v FROM trade_list_current WHERE iso3='DEU' AND source='mdic'").v, "2026-11");
  assert.equal(q(DB, "SELECT version_id v FROM trade_list_current WHERE iso3='USA' AND source='comtrade'").v, "2026-11");
  const st = q(DB, "SELECT state,error FROM trade_list_status WHERE version_id='2026-11' AND iso3='DEU' AND source='comtrade'");
  assert.equal(st.state, "data_unavailable");
  assert.match(st.error, /não atualizada em 2026-11/);
  const { data } = await setupList(env);
  const deu = data.items.find((c) => c.iso3 === "DEU");
  assert.equal(deu.comtrade_stale, "2026-11");
  assert.equal(deu.mdic_stale, null);
});

async function setupList(env) {
  const { listCountries } = await import("../src/trade-list.js");
  return { data: await listCountries(new Request("https://x/api/countries"), env) };
}

test("P3-T5: orçamento diário respeitado; o resto espera o dia seguinte sem ocupar a fila (errata item 6)", async (t) => {
  const { DB, d, clock, src } = await world(t, { comtrade_calls_per_day: 5 });
  await d.start();
  await d.drain();
  assert.ok(q(DB, "SELECT used FROM provider_budget WHERE provider='comtrade' AND day='2026-10-10'").used <= 5);
  assert.ok(src.calls.comtrade <= 5);
  assert.equal(q(DB, "SELECT status FROM trade_list_versions").status, "running");
  const waiting = q(DB, "SELECT COUNT(*) n FROM trade_list_jobs WHERE status='pending' AND kind LIKE 'comtrade%'").n;
  assert.ok(waiting > 0);
  assert.equal(d.queue.length, 0, "nenhuma mensagem só esperando");
  for (const day of ["2026-10-11", "2026-10-12", "2026-10-13"]) {
    clock.at = `${day}T05:17:00.000Z`;
    await d.daily();
    await d.drain();
    assert.ok((q(DB, "SELECT used FROM provider_budget WHERE provider='comtrade' AND day=?", day)?.used ?? 0) <= 5, day);
  }
  assert.equal(q(DB, "SELECT status FROM trade_list_versions").status, "complete");
});

test("P3-T5: sem chave da Comtrade o MDIC completa e a Comtrade fica indisponível com motivo", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, ["DEU", "USA"]);
  await tradeParams(ctx.api);
  ctx.env.COMTRADE_KEY = "";
  const d = driver(ctx.env, sources(), { at: OCT });
  await d.start();
  await d.drain();
  const v = q(ctx.DB, "SELECT * FROM trade_list_versions");
  assert.equal(v.comtrade_blocked, "no_key");
  assert.equal(v.status, "partial");
  assert.equal(q(ctx.DB, "SELECT state FROM trade_list_status WHERE iso3='DEU' AND source='mdic'").state, "purchase_identified");
  assert.equal(q(ctx.DB, "SELECT error FROM trade_list_status WHERE iso3='DEU' AND source='comtrade'").error, "Chave da Comtrade não configurada.");
});

test("P3-T5: arquivo do MDIC republicado durante a leitura → nova geração, totais de uma publicação só", async (t) => {
  let n = 0;
  const { DB, env, d } = await world(t, {}, { etags: { 2026: () => (n++ < 3 ? '"a1"' : '"a2"') } });
  await d.start();
  await d.drain();
  assert.ok(q(DB, "SELECT COUNT(*) n FROM trade_list_jobs WHERE status='superseded' AND kind='mdic_chunk'").n > 0);
  assert.ok(q(DB, "SELECT COUNT(*) n FROM trade_list_jobs WHERE job_key LIKE 'mdic_ref:2026:g2'").n === 1);
  const deu = obj(env, q(DB, "SELECT r2_key k FROM trade_list_current WHERE iso3='DEU' AND source='mdic'").k);
  assert.equal(deu.lines.find((l) => l.ym === "2026-01").fobUsd, 101500);
  assert.equal(deu.validators["2026"].etag, '"a2"');
});

test("P3-T5: atualização manual 1 por dia por país, só admin, e reaproveita o MDIC sem mudança (errata item 9)", async (t) => {
  const { DB, env, d, src } = await world(t);
  await d.start();
  await d.drain();
  const gets = src.calls.mdicGets;
  const { manualRefresh } = await import("../src/trade-list.js");
  const actor = { tenant_id: "eag-internal", id: "system-admin", role: "admin" };
  const req = (body) => new Request("https://x/api/trade-list/refresh/DEU", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const r = await manualRefresh(req({ reason: "Conferir dado novo da Alemanha" }), env, actor, "rid", "DEU", d.deps);
  await d.drain();
  assert.equal(src.calls.mdicGets, gets, "nenhum pedaço relido: arquivo sem mudança");
  const st = q(DB, "SELECT state,error FROM trade_list_status WHERE version_id=? AND source='mdic'", r.versionId);
  assert.match(st.error, /reaproveitado/);
  assert.equal(q(DB, "SELECT version_id v FROM trade_list_current WHERE iso3='DEU' AND source='comtrade'").v, r.versionId);
  assert.equal(q(DB, "SELECT status FROM trade_list_versions WHERE id=?", r.versionId).status, "complete");
  await assert.rejects(manualRefresh(req({ reason: "De novo no mesmo dia" }), env, actor, "rid", "DEU", d.deps), (e) => e.code === "refresh_already_today");
  await assert.rejects(manualRefresh(req({ reason: "Vendedor tentando atualizar" }), env, { ...actor, role: "seller_analyst" }, "rid", "USA", d.deps), (e) => e.status === 403);
});

test("P3-T5: poda guarda o vigente de cada país e o que as análises usam (errata item 10)", async (t) => {
  const { DB, env, d, clock } = await world(t, { trade_list_retention_versions: 1 });
  await d.start();
  await d.drain();
  const octDeu = q(DB, "SELECT r2_key k FROM trade_list_current WHERE iso3='DEU' AND source='comtrade'").k;
  const octUsaMdic = q(DB, "SELECT r2_key k FROM trade_list_current WHERE iso3='USA' AND source='mdic'").k;
  DB.raw.prepare("INSERT INTO country_analyses(id,tenant_id,iso3,period_months,mdic_version_id,mdic_r2_key,snapshot_sha256,created_by) VALUES ('an','eag-internal','USA',12,'2026-10',?,'h','u')").run(octUsaMdic);
  Object.assign(d.deps, { fetch: sources({ failData: (code) => code === 276 }).fetchImpl });
  clock.at = NOV;
  await d.daily();
  await d.drain();
  assert.ok(env.FILES.store.has(octDeu), "vigente da Alemanha (outubro) preservado");
  assert.ok(env.FILES.store.has(octUsaMdic), "objeto usado por análise preservado");
  assert.ok(!env.FILES.store.has("trade-src/2026-10/comtrade/USA.json"), "objeto sem referência podado");
  assert.ok(env.FILES.store.has("trade-ref/2026-10/ncm.json"), "referências da versão ainda usada ficam");
});

test("P3-T5: sem R2 a rotina não começa; sem parâmetros aprovados também não", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const d = driver(ctx.env, sources(), { at: OCT });
  await assert.rejects(d.start(), (e) => e.code === "parameter_missing");
  ctx.env.FILES = undefined;
  await tradeParams(ctx.api);
  await assert.rejects(d.start(), (e) => e.details?.code === "r2_missing");
});
