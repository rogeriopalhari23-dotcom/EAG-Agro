// Fluxo geral de rodadas de descoberta e qualificação (2026-10-15). O piloto (milho GMO, Indiara, 300 km) é só uma
// configuração; os testes cobrem outras commodities, estados, raios, unidades de medida, configuração internacional,
// reexecução sem duplicidade e lote com pendências parciais. Nenhum registro real é lido ou alterado: tudo é local.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRoundConfig } from "../src/rodada/config.js";
import { municipalityIndex, resolveOrigin, distanceFor } from "../src/rodada/distance.js";
import { mergeCandidates, establishmentKey } from "../src/rodada/establishment.js";
import { assess } from "../src/rodada/qualify.js";
import { runRound, rateLimiter } from "../src/rodada/batch.js";
import { renderReport } from "../src/rodada/report.js";
import { buildRegistrationBatch } from "../src/rodada/acceptance.js";
import { parseMunicipalities } from "../src/rodada/municipalities.js";

const ex = (n) => JSON.parse(readFileSync(new URL(`../docs/implementation/rodadas/exemplos/${n}.json`, import.meta.url), "utf8"));
const PILOT = ex("milho-gmo-indiara-300km");
const SOY = ex("soja-rio-verde-150km");
const SORGHUM = ex("sorgo-uberlandia-300mi");
const COFFEE_DE = ex("cafe-verde-hamburgo-200km");
const BR_MUN = parseMunicipalities(readFileSync(new URL("../docs/implementation/descoberta-milho-indiara/municipios-300km.csv", import.meta.url), "utf8"), { format: "csv", country: "BR" });
const NOW = "2026-10-15T12:00:00.000Z";

// Município sintético a d km ao norte de uma origem (1° de latitude ≈ 111,195 km com o raio usado em geo.js).
const north = (origin, d, name, extra = {}) => ({ name, code: name, region: "XX", country: extra.country ?? "ZZ", lat: origin.lat + d / 111.19508, lon: origin.lon, ...extra });
const cfg = (over) => ({ ...PILOT, id: "t", origin: { country: "ZZ", lat: 0, lon: 0 }, sources: [], ...over });
const valid = (c) => { const v = validateRoundConfig(c); assert.ok(v.ok, v.errors?.join("; ")); return v.config; };

test("Configuração: piloto e exemplos válidos; perto do limite deriva do raio (sem 270 fixo); erros listados juntos", () => {
  const p = valid(PILOT);
  assert.equal(p.nearLimit.fromKm, 270, "300 km × (1 − 0,1)");
  assert.equal(valid(SOY).nearLimit.fromKm, 135, "margem absoluta de 15 km num raio de 150 km");
  const s = valid(SORGHUM);
  assert.equal(Math.round(s.radius.km * 10) / 10, 482.8, "300 mi convertidas");
  assert.equal(Math.round(s.nearLimit.fromKm * 10) / 10, 458.7);
  assert.equal(valid(COFFEE_DE).origin.country, "DE");
  const bad = validateRoundConfig({ id: "", commodity: {}, origin: { country: "Brasil" }, radius: { value: -1, unit: "léguas" }, sources: "x", locale: {}, compliance: {} });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 7, bad.errors.join(" | "));
  // Nenhum valor do piloto no código da rodada.
  for (const f of ["rodada/config", "rodada/distance", "rodada/establishment", "rodada/qualify", "rodada/batch", "rodada/report", "rodada/acceptance", "rodada/municipalities", "rodada/area", "rodada/sources/catalog", "rodada/sources/osm", "rodada/sources/sipeagro", "rodada/sources/import", "rodada/closure", "rounds"]) {
    const src = readFileSync(new URL(`../src/${f}.js`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /indiara|milho|\b270\b|\b300\b|goi[aá]s/i, `src/${f}.js sem valores do piloto`);
  }
});

test("Distância: centroide é ESTIMADA; faixa de proximidade acompanha raios menores e maiores; coordenada da unidade decide", () => {
  const o = { lat: 0, lon: 0 };
  const r100 = valid(cfg({ radius: { value: 100, unit: "km" } }));
  const at = (d, unit) => distanceFor({ origin: o, municipality: unit ? null : north(o, d, `m${d}`), unit: unit ? { lat: d / 111.19508, lon: 0 } : null, config: r100 });
  assert.equal(at(85).nearLimit, false);
  const near = at(95);
  assert.equal(near.nearLimit, true);
  assert.equal(near.estimated, true);
  assert.match(near.label, /ESTIMADA/);
  const overByCentroid = at(101);
  assert.equal(overByCentroid.inside, "estimated", "centroide além do raio não afirma fora sem o contorno do município");
  assert.equal(overByCentroid.nearLimit, true);
  const outByUnit = at(101, true);
  assert.equal(outByUnit.inside, "outside");
  assert.equal(outByUnit.estimated, false);
  const r500 = valid(cfg({ radius: { value: 500, unit: "km" } }));
  assert.equal(distanceFor({ origin: o, municipality: north(o, 440, "a"), config: r500 }).nearLimit, false);
  assert.equal(distanceFor({ origin: o, municipality: north(o, 460, "b"), config: r500 }).nearLimit, true);
  // Contorno do município: inteiro dentro → confirmado; inteiro fora → fora.
  const inside = north(o, 50, "c", { bbox_min_lat: 40 / 111.19508, bbox_max_lat: 60 / 111.19508, bbox_min_lon: -0.05, bbox_max_lon: 0.05 });
  assert.equal(distanceFor({ origin: o, municipality: inside, config: r100 }).inside, "confirmed");
  const outside = north(o, 150, "d", { bbox_min_lat: 140 / 111.19508, bbox_max_lat: 160 / 111.19508, bbox_min_lon: -0.05, bbox_max_lon: 0.05 });
  assert.equal(distanceFor({ origin: o, municipality: outside, config: r100 }).inside, "outside");
  assert.equal(distanceFor({ origin: o, config: r100 }).inside, "unknown");
});

test("Piloto como configuração: Abadiânia a 173,8 km (estimada) e origem resolvida pelo conjunto de municípios", () => {
  const p = valid(PILOT);
  const idx = municipalityIndex(BR_MUN);
  const origin = resolveOrigin(p, idx);
  assert.equal(origin.basis, "municipality_centroid");
  const d = distanceFor({ origin, municipality: idx.find({ name: "Abadiânia", region: "GO", country: "BR" }), config: p });
  assert.equal(d.km, 173.8);
  assert.match(d.label, /ESTIMADA/);
  // Outro estado e outra origem, mesmo código.
  const s = valid(SORGHUM);
  const o2 = resolveOrigin(s, idx);
  assert.ok(o2, "Uberlândia/MG resolvida");
  assert.ok(distanceFor({ origin: o2, municipality: idx.find({ name: "Araguari", region: "MG", country: "BR" }), config: s }).km < 60, "Araguari a 51,4 km de Uberlândia");
});

test("Estabelecimentos: dedup por identificador (formatado ou não); filiais separadas e ligadas; sem identificador é provisório", () => {
  const a = { country: "BR", registrationId: "03.306.578/0055-51", name: "Fábrica A", municipality: "X", sources: [{ id: "s1" }] };
  const b = { country: "BR", registrationId: "03306578005551", name: "Fábrica A (diretório)", municipality: "X", sources: [{ id: "s2" }] };
  const c = { country: "BR", registrationId: "03306578000154", name: "Matriz", municipality: "Y" };
  const d = { country: "BR", name: "Sem CNPJ Ltda", municipality: "Z" };
  const m = mergeCandidates([a, b, c, d, a]);
  assert.equal(m.length, 3);
  const f = m.find((x) => x.registrationId === "03306578005551");
  assert.deepEqual(f.sources.map((s) => s.id), ["s1", "s2"], "fontes somadas sem repetir");
  assert.equal(f.names.length, 2);
  assert.equal(establishmentKey(d).provisional, true);
  assert.equal(establishmentKey({ country: "BR", registrationId: "123" }).provisional, true, "CNPJ incompleto não vale como chave");
});

test("Qualificação: código de atividade e diretório são indício; fonte própria comprova; uso, compra e revenda separados; restrição × variedade", () => {
  const p = valid(PILOT);
  const base = { country: "BR", hints: {} };
  const onlyActivity = assess({ ...base, evidence: [{ kind: "activity_code", strength: "activity_code", quote: "1066-0/00" }] }, p, { now: NOW });
  assert.equal(onlyActivity.commodityUse.status, "indication");
  const dir = assess({ ...base, evidence: [{ kind: "commodity_use", strength: "directory", url: "https://dir.example" }] }, p, { now: NOW });
  assert.equal(dir.commodityUse.status, "indication");
  const own = assess({ ...base, evidence: [{ kind: "commodity_use", strength: "own_source", url: "https://a.example", quote: "usa milho" }] }, p, { now: NOW });
  assert.equal(own.commodityUse.status, "proved");
  assert.equal(own.purchase.status, "none", "processar/usar não prova compra de terceiros");
  assert.equal(own.role, "final_consumer_or_processor");
  assert.equal(own.varietyAcceptance, "not_confirmed");
  const resale = assess({ ...base, evidence: [{ kind: "resale", strength: "own_source", url: "https://r.example" }] }, p, { now: NOW });
  assert.equal(resale.role, "reseller");
  const trader = assess({ ...base, evidence: [{ kind: "trade", strength: "own_source", url: "https://t.example" }] }, p, { now: NOW });
  assert.equal(trader.role, "trader");
  const nonGmo = { ...base, evidence: [{ kind: "restriction", strength: "press", url: "https://n.example", quote: "indústria não transgênica desde 2006" }] };
  assert.equal(assess(nonGmo, p, { now: NOW }).restriction.status, "conflict", "GMO × não transgênico");
  assert.equal(assess(nonGmo, valid(SOY), { now: NOW }).restriction.status, "noted", "soja sem variedade: só anotada");
  const noRule = assess({ ...base, hints: { segment: "pet_food" }, evidence: [] }, p, { now: NOW });
  assert.ok(noRule.pending.some((x) => /Sem regra configurada para o segmento "pet_food"/.test(x)), "segmento sem regra vira pendência explícita");
  assert.ok(onlyActivity.pending.includes("Uso de milho não comprovado."), "pendência usa o rótulo configurado");
  const ch = assess({ ...base, evidence: [{ kind: "channel", strength: "own_source", channelType: "general", value: "(62) 0000-0000", url: "https://a.example/contato" }, { kind: "channel", value: "x@y.z" }] }, p, { now: NOW });
  assert.equal(ch.channels.length, 1, "canal sem fonte descartado");
  assert.ok(ch.pending.includes("Canal de compras publicado não encontrado."));
});

test("Rate limit: 3 por minuto espera 20 s entre consultas (relógio falso)", async () => {
  let t = 0;
  const waits = [];
  const lim = rateLimiter(3, { now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; } });
  await lim(); await lim(); await lim();
  assert.deepEqual(waits, [20000, 20000]);
});

const fakeClock = () => { let t = 0; return { now: () => t, sleep: async (ms) => { t += ms; } }; };
const reg = (status = "Ativa", municipality = "Abadiânia", region = "GO") => ({ legalName: "EMPRESA TESTE S.A.", status, municipality, region, size: "unknown", idType: "CNPJ" });

test("Lote com pendências parciais: falha 500 e limite 429 não param a rodada; fonte bloqueada não é chamada de novo", async () => {
  const calls = [];
  const fetchers = {
    "br-cnpj-ws": async (est) => {
      calls.push(est.registrationId);
      if (est.registrationId === "11111111000191") throw Object.assign(new Error("x"), { status: 500 });
      if (est.registrationId === "22222222000191") throw Object.assign(new Error("x"), { status: 429 });
      return reg();
    },
  };
  const candidates = [
    { country: "BR", registrationId: "00000000000191", name: "Boa", municipality: "Abadiânia", region: "GO", evidence: [{ kind: "commodity_use", strength: "own_source", url: "https://boa.example", quote: "milho" }] },
    { country: "BR", registrationId: "11111111000191", name: "Erro 500", municipality: "Abadiânia", region: "GO" },
    { country: "BR", registrationId: "22222222000191", name: "Erro 429", municipality: "Abadiânia", region: "GO" },
    { country: "BR", registrationId: "33333333000191", name: "Depois do 429", municipality: "Abadiânia", region: "GO" },
  ];
  const run = await runRound({ config: PILOT, municipalities: BR_MUN, candidates, fetchers, clock: fakeClock(), now: NOW });
  assert.equal(run.ok, true);
  assert.equal(run.results.length, 4);
  assert.ok(!calls.includes("33333333000191"), "depois do 429 a fonte não é chamada");
  const by = (id) => run.results.find((r) => r.registrationId === id);
  assert.equal(by("00000000000191").status, "qualified_use");
  for (const id of ["11111111000191", "22222222000191", "33333333000191"]) {
    assert.equal(by(id).status, "exception");
    assert.ok(by(id).pending.some((p) => /pendente|limite|adiada/.test(p)), id);
  }
  // Situação estruturada: 500 é falha; 429 e as bloqueadas depois dele são adiadas; o resumo conta igual.
  assert.equal(by("11111111000191").lookup.status, "failed");
  assert.deepEqual([by("22222222000191").lookup.cause, by("33333333000191").lookup.cause], ["http_429", "blocked_after_429"]);
  assert.deepEqual({ fetched: run.lookups.fetched, failed: run.lookups.failed, deferred: run.lookups.deferred }, { fetched: 1, failed: 1, deferred: 2 });
});

test("Reexecução sem duplicidade: mesma entrada não cria nada; nova candidata entra; evidência nova atualiza", async () => {
  const fetchers = { "br-cnpj-ws": async () => reg() };
  const c1 = { country: "BR", registrationId: "00000000000191", name: "A", municipality: "Abadiânia", region: "GO" };
  const r1 = await runRound({ config: PILOT, municipalities: BR_MUN, candidates: [c1], fetchers, clock: fakeClock(), now: NOW });
  assert.equal(r1.counters.created, 1);
  const r2 = await runRound({ config: PILOT, municipalities: BR_MUN, candidates: [c1], fetchers, state: r1.state, clock: fakeClock(), now: NOW });
  assert.deepEqual(r2.counters, { created: 0, updated: 0, unchanged: 1 });
  assert.equal(r2.results.length, 1);
  const c2 = { country: "BR", registrationId: "44444444000191", name: "B", municipality: "Abadiânia", region: "GO" };
  const r3 = await runRound({ config: PILOT, municipalities: BR_MUN, candidates: [c1, c2], fetchers, state: r2.state, clock: fakeClock(), now: NOW });
  assert.deepEqual(r3.counters, { created: 1, updated: 0, unchanged: 1 });
  const c1b = { ...c1, evidence: [{ kind: "commodity_use", strength: "own_source", url: "https://a.example", quote: "milho" }] };
  const r4 = await runRound({ config: PILOT, municipalities: BR_MUN, candidates: [c1b], fetchers, state: r3.state, clock: fakeClock(), now: NOW });
  assert.equal(r4.counters.updated, 1);
  assert.equal(r4.results.length, 2, "a anterior continua na rodada");
});

test("Exceções automáticas: cadastro não ativo, municípios divergentes, perto do limite e sem identificador", async () => {
  const fetchers = {
    "br-cnpj-ws": async (est) =>
      est.registrationId === "55555555000191" ? reg("Suspensa") : est.registrationId === "66666666000191" ? reg("Ativa", "Uberlândia", "MG") : est.registrationId === "99999999000191" ? reg("Ativa", "Doverlândia", "GO") : reg(),
  };
  const candidates = [
    { country: "BR", registrationId: "55555555000191", name: "Suspensa", municipality: "Abadiânia", region: "GO" },
    { country: "BR", registrationId: "66666666000191", name: "Diverge", municipality: "Abadiânia", region: "GO" },
    { country: "BR", registrationId: "99999999000191", name: "Limite", municipality: "Doverlândia", region: "GO" },
    { country: "BR", name: "Sem CNPJ", municipality: "Abadiânia", region: "GO" },
  ];
  const run = await runRound({ config: PILOT, municipalities: BR_MUN, candidates, fetchers, clock: fakeClock(), now: NOW });
  const by = (n) => run.results.find((r) => r.names[0] === n);
  assert.ok(by("Suspensa").reasons.includes("situação cadastral não ativa"));
  assert.ok(by("Diverge").reasons.includes("dados divergentes entre fontes"));
  assert.ok(!by("Diverge").checks.includes("perto do limite do raio"), "Uberlândia a 268,1 km fica antes da faixa [270, 300] do piloto");
  assert.equal(by("Limite").distance.km, 271.8);
  assert.ok(by("Limite").checks.includes("perto do limite do raio"), "Doverlândia a 271,8 km: dentro da faixa derivada do raio");
  assert.notEqual(by("Limite").status, "exception", "perto do limite gera conferência, não exceção nem exclusão");
  assert.ok(run.review.some((r) => r.names[0] === "Limite"), "aparece para conferência");
  assert.ok(by("Sem CNPJ").reasons.includes("unidade sem identificador cadastral"));
  assert.equal(run.exceptions.length, 3);
  assert.equal(run.review.length, 4);
  // A mesma unidade, numa rodada de 500 km, não é exceção de limite.
  const wide = await runRound({ config: { ...PILOT, radius: { value: 500, unit: "km" } }, municipalities: BR_MUN, candidates: [candidates[2]], fetchers, clock: fakeClock(), now: NOW });
  assert.equal(wide.results[0].distance.nearLimit, false);
});

test("Configuração internacional: origem por coordenada, sem fonte cadastral para DE → pendência explícita, nunca adaptação", async () => {
  const hamburg = { lat: 53.5511, lon: 9.9937 };
  const muns = [north(hamburg, 100, "Kiel-sintetico", { country: "DE", region: "SH" }), north(hamburg, 190, "Limite-sintetico", { country: "DE", region: "SH" })];
  const candidates = [
    { country: "DE", registrationId: "HRB 1234", name: "Rösterei A", municipality: "Kiel-sintetico", region: "SH", evidence: [{ kind: "commodity_use", strength: "own_source", url: "https://roaster.example", quote: "green coffee" }] },
    { country: "DE", registrationId: "HRB 5678", name: "Rösterei B", municipality: "Limite-sintetico", region: "SH" },
  ];
  const run = await runRound({ config: COFFEE_DE, municipalities: muns, candidates, clock: fakeClock(), now: NOW });
  assert.equal(run.ok, true);
  assert.equal(run.config.locale.language, "en");
  for (const r of run.results) assert.ok(r.pending.includes("Fonte cadastral não configurada para DE."), r.names[0]);
  const b = run.results.find((r) => r.names[0] === "Rösterei B");
  assert.equal(b.distance.nearLimit, true, "190 km num raio de 200 km com margem de 10%");
  assert.equal(run.results.find((r) => r.names[0] === "Rösterei A").assessment.varietyAcceptance, "not_applicable");
});

test("Relatório: destaca só exceções, mostra distância ESTIMADA e não afirma o que é indício", async () => {
  const run = await runRound({ config: PILOT, municipalities: BR_MUN, candidates: [{ country: "BR", registrationId: "00000000000191", name: "Fábrica", municipality: "Abadiânia", region: "GO", evidence: [{ kind: "commodity_use", strength: "directory", url: "https://d.example" }] }], fetchers: { "br-cnpj-ws": async () => reg() }, clock: fakeClock(), now: NOW });
  const md = renderReport(run);
  assert.match(md, /ESTIMADA/);
  assert.match(md, /## Exceções e conferências para análise/);
  assert.match(md, /Critério de proximidade do limite: proporcional: últimos 10% do raio \(de 270 a 300 km\); gera conferência, não exclusão/);
  assert.match(md, /\| indício \|/);
  assert.doesNotMatch(md, /\| comprovado \| comprovado \|/);
});

test("Lote: descoberta sem aprovação individual (sem fora, separadas, provisórias ou exceções) e aceite em lote rastreável", async () => {
  const fetchers = { "br-cnpj-ws": async (est) => (est.registrationId === "55555555000191" ? reg("Suspensa") : reg()) };
  const candidates = [
    { country: "BR", registrationId: "00000000000191", name: "Uso", municipality: "Abadiânia", region: "GO", evidence: [{ kind: "commodity_use", strength: "own_source", url: "https://uso.example", quote: "usa milho" }, { kind: "channel", strength: "own_source", channelType: "purchasing", value: "compras@uso.example", url: "https://uso.example/contato" }] },
    { country: "BR", registrationId: "77777777000191", name: "Só cadastro", municipality: "Abadiânia", region: "GO" },
    { country: "BR", registrationId: "88888888000191", name: "Revenda", municipality: "Abadiânia", region: "GO", evidence: [{ kind: "resale", strength: "own_source", url: "https://rev.example" }] },
    { country: "BR", registrationId: "55555555000191", name: "Suspensa", municipality: "Abadiânia", region: "GO" },
    { country: "BR", name: "Sem CNPJ", municipality: "Abadiânia", region: "GO" },
  ];
  const run = await runRound({ config: PILOT, municipalities: BR_MUN, candidates, fetchers, clock: fakeClock(), now: NOW });
  assert.throws(() => buildRegistrationBatch(run, { mode: "discovery" }), /variante de produto/);
  const disc = buildRegistrationBatch(run, { mode: "discovery", productVariant: "Variante X" });
  assert.deepEqual(disc.empresas.map((e) => e.company.tradeName).sort(), ["Só cadastro", "Uso"]);
  for (const e of disc.empresas) {
    assert.equal(e.level0, undefined, "nunca cria ligação");
    assert.deepEqual(e.people, []);
    assert.match(e.company.sourceLabel, /NÃO confirmada/);
  }
  const uso = disc.empresas.find((e) => e.company.tradeName === "Uso");
  assert.equal(uso.evidence.length, 1);
  assert.equal(uso.evidence[0].evidenceType, "company_document");
  assert.deepEqual(uso.channels.map((c) => c.email), ["compras@uso.example"], "só e-mail publicado em fonte própria");
  assert.equal(disc.empresas.find((e) => e.company.tradeName === "Só cadastro").evidence.length, 0, "indício não vira evidência");
  assert.throws(() => buildRegistrationBatch(run, { mode: "accept", productVariant: "Variante X", decisions: {} }), /quem decidiu/);
  const key = run.results.find((r) => r.names[0] === "Uso").key;
  const acc = buildRegistrationBatch(run, { mode: "accept", productVariant: "Variante X", decisions: { [key]: "accept" }, decidedBy: "Revisor", decidedAt: NOW });
  assert.equal(acc.empresas.length, 1);
  assert.deepEqual({ by: acc.empresas[0].rastreio.decidedBy, at: acc.empresas[0].rastreio.decidedAt, round: acc.empresas[0].rastreio.roundId }, { by: "Revisor", at: NOW, round: PILOT.id });
  // Exceção só entra na descoberta com decisão explícita do lote.
  const suspKey = run.results.find((r) => r.names[0] === "Suspensa").key;
  assert.equal(buildRegistrationBatch(run, { mode: "discovery", productVariant: "X", decisions: { [suspKey]: "include" } }).empresas.length, 3);
});
