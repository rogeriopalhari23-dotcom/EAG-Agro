// Prospecção automática (2026-10-20): motor em segundo plano, perfil versionado, política de pesquisa de rotina.
// Tudo SIMULADO (tests/helpers/simulated-world.mjs): mapa, sites, Receita e diretório alemão; nenhum dado real, nenhuma rede.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setup } from "./helpers/db.mjs";
import { simulatedWorld, nearestMunicipality } from "./helpers/simulated-world.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { internalCaller } from "../src/worker.js";
import { runJob, tick } from "../src/prospect/engine.js";

async function world(t, opts = {}) {
  const ctx = setup();
  const w = simulatedWorld({ cityAt: nearestMunicipality(ctx.DB), ...opts });
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => (await w.fetch(url, init)) ?? Promise.reject(new Error(`rede bloqueada no teste: ${url}`));
  t.after(() => ((globalThis.fetch = real), ctx.close()));
  // Listas de sanções importadas (fictícias), para a triagem poder concluir.
  for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
    const v = await ctx.api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt: new Date().toISOString() });
    await ctx.api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Nome Sem Relação (fictício)" }] });
    await ctx.api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
  }
  const deps = { call: internalCaller(ctx.env, "rid-teste"), fetch: globalThis.fetch };
  // Avança o relógio da prospecção e "passa um minuto" para o limite por fonte (desloca as chamadas registradas).
  let clock = Date.now();
  const drive = async (id, max = 40) => {
    let last;
    for (let k = 0; k < max; k++) {
      clock += 120_000;
      ctx.DB.raw.prepare("UPDATE round_source_calls SET called_at=datetime(called_at,'-2 minutes')").run();
      ctx.DB.raw.prepare("UPDATE round_source_calls SET called_at=strftime('%Y-%m-%dT%H:%M:%fZ', called_at)").run();
      last = await runJob(ctx.env, id, { ...deps, now: () => new Date(clock).toISOString() });
      const j = (await ctx.api(`/api/prospect/jobs/${id}`)).data;
      if (["done", "failed", "needs_decision", "paused", "cancelled"].includes(j.status) || j.waitingFor === "browser_osm") return j;
    }
    return (await ctx.api(`/api/prospect/jobs/${id}`)).data;
  };
  const grant = (body = {}) => ctx.api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão de teste (fictícia)", ...body });
  return { ...ctx, w, deps, drive, grant };
}
const cafe = { market: "national", productId: "product-05", location: { region: "MG", municipality: "Guaxupé" }, radius: { value: 150, unit: "km" } };

test("sem política, a prospecção para em decisão; concedida, segue sozinha até o relatório e cadastra em descoberta com rastreio", async (t) => {
  const { api, DB, drive, grant } = await world(t);
  const job = (await api("/api/prospect/jobs", "POST", cafe)).data;
  assert.equal(job.name, "Café — Guaxupé/MG, 150 km");
  let j = await drive(job.id);
  assert.equal(j.status, "needs_decision");
  assert.equal(j.decision.kind, "authorization");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM discovery_rounds").get().n, 0, "nada pesquisado sem política");
  assert.equal((await grant()).status, 201);
  await api(`/api/prospect/jobs/${job.id}/resume`, "POST", {});
  j = await drive(job.id);
  assert.equal(j.status, "done", JSON.stringify(j.events.slice(-3)));
  const s = j.summary;
  // 6 torrefações no mapa: 3 com CNPJ publicado no site; 1 site fora do ar, 1 sem CNPJ, 1 sem site → fila de exceções.
  assert.equal(s.registered, 3);
  assert.equal(s.exceptions, 3);
  assert.match(s.notCommercial, /não é qualificação comercial/);
  // Ciência pela política, nunca como de pessoa; procedência "automation" com a política como autorização.
  const round = (await api(`/api/rounds/${j.roundId}`)).data;
  assert.match(round.acknowledged.by, /^policy:/);
  assert.equal(round.config.commodity.productId, "product-05");
  assert.deepEqual(Object.keys(round.config.commodity.segments), ["roaster"], "segmentos do café, sem ração");
  const reg = DB.raw.prepare("SELECT new_value_json FROM audit_log WHERE action='round.registered'").get();
  const op = JSON.parse(reg.new_value_json).operation;
  assert.equal(op.channel, "automation");
  assert.match(op.authorization.reference, /Política de pesquisa de rotina v1/);
  // Canal: só o e-mail geral do próprio domínio (o de pessoa no mesmo site fica de fora).
  const contacts = DB.raw.prepare("SELECT contact_kind, source_kind, source_url FROM contacts").all();
  assert.equal(contacts.length, 3);
  assert.ok(contacts.every((c) => c.contact_kind === "company_channel" && c.source_kind === "company_site" && /previa\.invalid/.test(c.source_url)));
  // Controles comerciais intactos: nada de ficha, envio, campanha ativa ou validação T11.
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM fichas").get().n, 0);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM send_outbox").get().n, 0);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM campaigns WHERE status='active'").get().n, 0);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM compliance_validations").get().n, 0);
  assert.ok(DB.raw.prepare("SELECT COUNT(*) n FROM screening_runs").get().n >= 3, "triagem de sanções feita no cadastro");
  // Etapas e eventos registrados.
  assert.ok(j.events.some((e) => e.step === "lookup" && /consultas feitas/.test(e.message)));
  assert.ok(j.events.some((e) => e.step === "conciliate" && /fora-do-ar/.test(e.message)), "falha do site vira pendência explícita");
});

test("limite da Receita (3/min) e 429: espera e retoma sozinha; reexecução e nova prospecção não duplicam", async (t) => {
  const w0 = { receita429: new Set() };
  const ctx = await world(t, w0);
  const { api, DB, drive, grant, w } = ctx;
  await grant();
  // Força 429 na primeira consulta de um CNPJ fictício que o site vai publicar.
  w0.receita429.add(w.cnpjFrom("torrefacao-serra-verde.previa.invalid"));
  const job = (await api("/api/prospect/jobs", "POST", cafe)).data;
  const j = await drive(job.id);
  assert.equal(j.status, "done");
  const waits = j.events.filter((e) => e.step === "lookup" && e.outcome === "waiting");
  assert.ok(waits.length >= 1, "esperou o limite por minuto ou o 429");
  assert.equal(j.summary.registered, 3);
  assert.equal(j.summary.pendingLookups, 0);
  const companies = DB.raw.prepare("SELECT COUNT(*) n FROM companies").get().n;
  // Nova prospecção igual: reaproveita (já existiam), sem empresa duplicada.
  const again = (await api("/api/prospect/jobs", "POST", cafe)).data;
  const j2 = await drive(again.id);
  assert.equal(j2.status, "done");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies").get().n, companies, "sem duplicidade");
  assert.ok(j2.events.some((e) => e.step === "register" && /já existiam/.test(e.message)));
});

test("mapa recusa o servidor: aguarda o navegador (dito como tal) ou segue sem; pausa, cancelamento e lease sem duplicar", async (t) => {
  const { api, env, deps, drive, grant } = await world(t, { refuseOsm: true });
  await grant();
  const job = (await api("/api/prospect/jobs", "POST", cafe)).data;
  let j = await drive(job.id);
  assert.equal(j.waitingFor, "browser_osm");
  assert.ok(j.events.some((e) => /depende do navegador/.test(e.message)));
  // O navegador entrega a resposta do mapa; o restante segue no servidor.
  const els = [{ type: "node", id: 9, lat: -21.29, lon: -46.68, tags: { name: "Torrefação Serra Verde (fictícia)", craft: "coffee_roaster", website: "https://torrefacao-serra-verde.previa.invalid" } }];
  const b = await api(`/api/prospect/jobs/${job.id}/browser-osm`, "POST", { elements: els });
  assert.equal(b.status, 200, JSON.stringify(b.data));
  j = await drive(job.id);
  assert.equal(j.status, "done");
  assert.equal(j.summary.registered, 1);
  // Outra prospecção: seguir sem a busca no mapa (decisão da pessoa) termina com pendência, sem inventar resultado.
  const k = (await api("/api/prospect/jobs", "POST", { ...cafe, radius: { value: 100, unit: "km" } })).data;
  j = await drive(k.id);
  assert.equal(j.waitingFor, "browser_osm");
  await api(`/api/prospect/jobs/${k.id}/skip-browser`, "POST", {});
  j = await drive(k.id);
  assert.equal(j.status, "done");
  // Sem o mapa, a ABIC (café) ainda traz as torrefadoras certificadas dos estados da área (MG e SP; a do PR fica fora),
  // provisórias: sem CNPJ, nenhuma é cadastrada; pesquisa marcada como parcial, com a fonte do mapa não consultada.
  assert.equal(j.summary.registered, 0);
  assert.equal(j.summary.candidates, 3);
  assert.equal(j.summary.toIdentify.length, 3);
  assert.ok(!j.summary.toIdentify.some((x) => /PIONEIRO/.test(x.name)));
  assert.equal(j.summary.partial, true);
  assert.equal(j.summary.coverage["osm-overpass"].status, "unavailable");
  assert.equal(j.summary.coverage["abic-certificados"].count, 3);
  // Pausa e cancelamento: o ciclo não executa uma prospecção pausada; cancelada não volta.
  const p = (await api("/api/prospect/jobs", "POST", { ...cafe, radius: { value: 120, unit: "km" } })).data;
  await api(`/api/prospect/jobs/${p.id}/pause`, "POST", {});
  assert.equal((await runJob(env, p.id, deps)).skipped, true);
  await api(`/api/prospect/jobs/${p.id}/cancel`, "POST", {});
  assert.equal((await api(`/api/prospect/jobs/${p.id}`)).data.status, "cancelled");
  assert.equal((await api(`/api/prospect/jobs/${p.id}/resume`, "POST", {})).status, 409);
  // Duas execuções ao mesmo tempo: uma só pega o lease.
  const q = (await api("/api/prospect/jobs", "POST", { ...cafe, radius: { value: 130, unit: "km" } })).data;
  const [r1, r2] = await Promise.all([runJob(env, q.id, deps), runJob(env, q.id, deps)]);
  assert.ok(r1.skipped || r2.skipped, "lease impede execução concorrente");
});

test("escopo: raio acima da política e mercado não coberto pedem decisão; política revogada para antes de pesquisar", async (t) => {
  const { api, drive, grant } = await world(t);
  await grant({ maxRadiusKm: 200, markets: ["national"] });
  let j = await drive((await api("/api/prospect/jobs", "POST", { ...cafe, radius: { value: 300, unit: "km" } })).data.id);
  assert.equal(j.decision.kind, "scope");
  assert.match(j.decision.message, /300 km acima do limite/);
  j = await drive((await api("/api/prospect/jobs", "POST", { market: "international", productId: "product-05", location: { iso3: "DEU" } })).data.id);
  assert.equal(j.decision.kind, "scope");
  await api("/api/prospect/policy/revoke", "POST", { reason: "Teste de revogação" });
  j = await drive((await api("/api/prospect/jobs", "POST", cafe)).data.id);
  assert.equal(j.decision.kind, "authorization");
  assert.equal((await api("/api/prospect/policy", "POST", { confirm: true, reference: "x", paidSources: ["casadosdados"] })).status, 422, "fonte paga nunca entra na política");
});

test("outra commodity e local: milho GMO, Indiara/GO, 100 km — segmentos de ração, variedade do produto, sem herdar café", async (t) => {
  const { api, drive, grant } = await world(t);
  await grant();
  const j = await drive((await api("/api/prospect/jobs", "POST", { market: "national", productId: "product-03", location: { region: "GO", municipality: "Indiara" }, radius: { value: 100, unit: "km" } })).data.id);
  assert.equal(j.status, "done", JSON.stringify(j.events.slice(-3)));
  assert.equal(j.name, "Milho GMO — Indiara/GO, 100 km");
  const round = (await api(`/api/rounds/${j.roundId}`)).data;
  assert.equal(round.config.commodity.variety, "GMO", "variedade vem do produto, não é perguntada");
  assert.ok("feed_mill" in round.config.commodity.segments && !("roaster" in round.config.commodity.segments));
  assert.ok(j.summary.registered >= 1);
  assert.ok(j.summary.ranked.every((x, i, a) => i === 0 || ["medium", "small", "large", "micro", "unknown"].indexOf(a[i - 1].size) <= ["medium", "small", "large", "micro", "unknown"].indexOf(x.size) || a[i - 1].note), "ordem pelo perfil");
});

test("perfil versionado: nova versão vale para as próximas prospecções; perfil inválido recusado", async (t) => {
  const { api, drive, grant } = await world(t);
  await grant();
  await drive((await api("/api/prospect/jobs", "POST", cafe)).data.id); // registra o perfil padrão v1
  const cur = (await api("/api/prospect/profile")).data.current;
  assert.equal(cur.version, 1);
  assert.equal((await api("/api/prospect/profile", "POST", { profile: { ...cur.profile, sizes: { order: ["gigante"] } }, reason: "x", expectedVersion: 1 })).status, 422);
  const custom = { ...cur.profile, segmentsByCommodity: { coffee: { soluble: { label: "indústria de café solúvel" } } } };
  assert.equal((await api("/api/prospect/profile", "POST", { profile: custom, reason: "Incluir solúvel (teste)", expectedVersion: 1 })).status, 201);
  const j = await drive((await api("/api/prospect/jobs", "POST", { ...cafe, radius: { value: 140, unit: "km" } })).data.id);
  const round = (await api(`/api/rounds/${j.roundId}`)).data;
  assert.deepEqual(Object.keys(round.config.commodity.segments), ["soluble"]);
  assert.ok(j.events.some((e) => /Perfil comprador v2/.test(e.message)));
  // Segmento sem regra de busca: "busca automática sem suporte" é limitação mais grave que a aceita pela política,
  // então pede ciência da pessoa em vez de seguir em silêncio.
  assert.equal(j.status, "needs_decision");
  assert.equal(j.decision.kind, "limitations");
  assert.ok(j.decision.items.some((x) => /descoberta automática/.test(x)));
});

test("internacional: indicadores → seleção e busca pela política → descoberta com fonte pendente → cadastro → relatório", async (t) => {
  const ctx = await world(t);
  const { api, DB, drive, grant, env } = ctx;
  keepCountries(DB, ["DEU", "CHN"]);
  await tradeParams(api, { period_default_months: 12 });
  const d = driver(env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  await grant();
  const j = await drive((await api("/api/prospect/jobs", "POST", { market: "international", productId: "product-05", location: { iso3: "DEU" }, hs6: "090111" })).data.id);
  assert.equal(j.status, "done", JSON.stringify(j.events.slice(-4)));
  assert.ok(j.events.some((e) => e.step === "analysis" && /não prova que alguma empresa importa do Brasil/.test(e.message)));
  assert.ok(j.events.some((e) => e.step === "discover" && e.outcome === "pending"), "fonte indisponível fica pendente");
  assert.ok(j.events.some((e) => e.step === "discover" && e.outcome === "ok"), "as demais fontes seguem");
  assert.ok(j.summary.registered >= 1);
  assert.ok(j.summary.exceptions >= 1, "sem identificador nem site: fila de exceções");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM campaigns WHERE status='active'").get().n, 0, "campanha nasce em rascunho");
  const auth = DB.raw.prepare("SELECT new_value_json FROM audit_log WHERE action='foreign_search.authorized'").get();
  assert.equal(JSON.parse(auth.new_value_json)._operation.channel, "automation");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE country_code='DE' AND registration_id_type='CNPJ'").get().n, 0, "sem CNPJ no exterior");
  // Sem compra identificada do produto no país: decisão, nunca busca de empresas (R12.14).
  const k = await drive((await api("/api/prospect/jobs", "POST", { market: "international", productId: "product-14", location: { iso3: "CHN" } })).data.id);
  assert.equal(k.status, "needs_decision");
  assert.equal(k.decision.kind, "indicators");
});

test("cron: tick executa as prospecções devidas e ignora as que não venceram", async (t) => {
  const { api, env, deps, grant } = await world(t);
  await grant();
  const job = (await api("/api/prospect/jobs", "POST", cafe)).data;
  const out = await tick(env, "eag-internal", deps);
  assert.ok(out.length >= 1);
  const j = (await api(`/api/prospect/jobs/${job.id}`)).data;
  assert.notEqual(j.status, "queued");
});
