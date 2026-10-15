// Geografia nacional, catálogo de fontes com limitações antes da execução, entradas (automática, importação, assistida),
// conciliação de candidata provisória e adaptação explícita de formatos antigos. Tudo local; arquivos reais só lidos.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateRoundConfig } from "../src/rodada/config.js";
import { municipalityIndex, resolveOrigin } from "../src/rodada/distance.js";
import { roundArea } from "../src/rodada/area.js";
import { parseIbgeSeedSql, parseMunicipalities } from "../src/rodada/municipalities.js";
import { preflight } from "../src/rodada/sources/catalog.js";
import { osmRoundQuery, osmToCandidates } from "../src/rodada/sources/osm.js";
import { sipeagroToCandidates } from "../src/rodada/sources/sipeagro.js";
import { importCandidates, assistedCandidate, parseCsv } from "../src/rodada/sources/import.js";
import { mergeCandidates, idMaskMatches } from "../src/rodada/establishment.js";
import { adaptLegacyCandidatesCsv, adaptLegacyBatch } from "../src/rodada/legacy.js";
import { runRound } from "../src/rodada/batch.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const ex = (n) => JSON.parse(read(`docs/implementation/rodadas/exemplos/${n}.json`));
const cfg = (c) => { const v = validateRoundConfig(c); assert.ok(v.ok, v.errors?.join("; ")); return v.config; };
const IBGE = parseIbgeSeedSql(read("migrations/0008_seed_municipios.sql").toString("utf8"));
const NOW = "2026-10-15T12:00:00.000Z";

test("Geografia: conjunto nacional do IBGE; qualquer município como origem; área cobre o CSV antigo do piloto e mais", () => {
  assert.equal(IBGE.length, 5570);
  assert.ok(IBGE.every((m) => Number.isFinite(m.lat) && Number.isFinite(m.bbox_min_lat)));
  assert.ok(IBGE.some((m) => m.name === "Alta Floresta D'Oeste"), "apóstrofo do SQL desfeito");
  const pilot = cfg(ex("milho-gmo-indiara-300km"));
  const idx = municipalityIndex(IBGE);
  const area = roundArea({ origin: resolveOrigin(pilot, idx), config: pilot, municipalities: IBGE });
  const old = parseMunicipalities(read("docs/implementation/descoberta-milho-indiara/municipios-300km.csv").toString("utf8"), { format: "csv", country: "BR" });
  const codes = new Set(area.municipalities.map((m) => m.code));
  assert.deepEqual(old.filter((m) => !codes.has(String(m.code))).map((m) => m.name), [], "nada do CSV montado à mão fica de fora");
  assert.ok(area.summary.partial > 0 && area.municipalities.length > old.length, "municípios cortados pelo raio entram como parciais");
  assert.ok(area.municipalities.filter((m) => m.coverage === "partial").every((m) => m.review), "parcial pede conferência");
  // Origem em outra região do país, por código IBGE, em milhas.
  const boaVista = IBGE.find((m) => m.name === "Boa Vista" && m.region === "RR");
  const c2 = cfg({ ...pilot, origin: { country: "BR", municipalityCode: boaVista.code }, radius: { value: 100, unit: "mi" } });
  const a2 = roundArea({ origin: resolveOrigin(c2, idx), config: c2, municipalities: IBGE });
  assert.ok(a2.municipalities.every((m) => m.region === "RR" || m.minKm <= 160.9));
  assert.match(a2.criterion, /proporcional: últimos 10% do raio \(de 90 a 100 mi\)/);
});

test("Catálogo e limitações antes da execução: pago bloqueado, país sem fonte e segmento sem regra explícitos", () => {
  const pilot = cfg(ex("milho-gmo-indiara-300km"));
  const p = preflight(pilot, { geography: "national_official", implemented: ["br-cnpj-ws", "osm-overpass"] });
  const item = (a) => p.items.find((x) => x.area === a);
  assert.equal(item("fonte casadosdados").level, "unsupported");
  assert.match(item("fonte casadosdados").message, /pago/);
  assert.equal(item("segmentos × mapa-sipeagro").level, "partial");
  assert.match(item("segmentos × mapa-sipeagro").message, /ethanol/);
  assert.equal(item("cadastro oficial").level, "supported");
  assert.ok(p.requiresAcknowledgement);
  // Despesa autorizada não muda o resto: fontes com limites continuam "parciais", nunca completas.
  const paid = preflight(pilot, { geography: "national_official", authorizedPaid: ["casadosdados"], implemented: ["br-cnpj-ws", "osm-overpass", "casadosdados"] });
  assert.equal(paid.items.find((x) => x.area === "fonte casadosdados").level, "partial");
  assert.notEqual(paid.overall, "supported");
  const de = preflight(cfg(ex("cafe-verde-hamburgo-200km")), { geography: "none" });
  assert.equal(de.overall, "unsupported");
  assert.equal(de.items.find((x) => x.area === "cadastro oficial").level, "unsupported");
  const unknown = preflight(cfg({ ...ex("soja-rio-verde-150km"), sources: [{ id: "fonte-inventada", kind: "discovery" }] }), { geography: "national_official" });
  assert.equal(unknown.items.find((x) => x.area === "fonte fonte-inventada").level, "unsupported");
  assert.equal(unknown.items.find((x) => x.area === "descoberta automática").level, "unsupported");
});

test("OpenStreetMap: consulta no raio com etiquetas por segmento; resultado provisório e só indício", () => {
  const pilot = cfg(ex("milho-gmo-indiara-300km"));
  const origin = resolveOrigin(pilot, municipalityIndex(IBGE));
  const q = osmRoundQuery(pilot, origin);
  assert.match(q, /nwr\["industrial"="feed"\]\(around:300000,-17\.1852,-49\.9682\)/);
  assert.match(q, /nwr\["product"~"ração\|racao\|animal feed",i\]/);
  assert.equal(osmRoundQuery(cfg({ ...ex("soja-rio-verde-150km"), commodity: { code: "soy", segments: { x: { label: "x" } } } }), origin), null);
  const cands = osmToCandidates({ elements: [
    { type: "way", id: 7, center: { lat: -17, lon: -50 }, tags: { name: "Usina Etanol Teste", product: "ethanol", "addr:city": "Quirinópolis", "addr:state": "GO" } },
    { type: "node", id: 8, tags: { name: "Loja de Ração", shop: "agrarian" } },
  ] }, pilot, { consultedAt: NOW });
  assert.equal(cands.length, 1, "loja (ponto de venda) fica de fora");
  assert.equal(cands[0].hints.segment, "ethanol");
  assert.equal(cands[0].registrationId, undefined);
  assert.equal(cands[0].evidence[0].strength, "directory");
  assert.equal(cands[0].sources[0].mode, "automatic");
});

test("SIPEAGRO: só a área, só ativos, só segmentos com regra; registro agrupado; CNPJ mascarado vira pista de conciliação", () => {
  const pilot = cfg(ex("milho-gmo-indiara-300km"));
  const area = roundArea({ origin: resolveOrigin(pilot, municipalityIndex(IBGE)), config: pilot, municipalities: IBGE });
  const csv = [
    "UF;MUNICIPIO;NUMERO_REGISTRO_ESTABELECIMENTO;STATUS_DO_REGISTRO;CPF_CNPJ;RAZAO_SOCIAL;AREA_ATUACAO;ATIVIDADE;CLASSIFICACAO",
    "GO;Abadiânia;GO1;Ativo;**.***.578/***-**;Araguaia Teste;ALIMENTAÇÃO ANIMAL;FABRICANTE;RAÇÃO",
    "GO;Abadiânia;GO1;Ativo;**.***.578/***-**;Araguaia Teste;ALIMENTAÇÃO ANIMAL;FABRICANTE;NÚCLEO",
    "GO;Abadiânia;GO2;Ativo;***.123.456-**;Produtor PF;ALIMENTAÇÃO ANIMAL;FABRICANTE;RAÇÃO",
    "RS;Porto Alegre;RS1;Ativo;**.***.111/***-**;Longe;ALIMENTAÇÃO ANIMAL;FABRICANTE;RAÇÃO",
  ].join("\n");
  const out = sipeagroToCandidates(csv, { config: pilot, area, sourceUrl: "https://dados.example/sipeagro.csv", consultedAt: NOW });
  assert.equal(out.candidates.length, 1);
  assert.deepEqual(out.skipped, { outsideArea: 1, inactive: 0, noRule: 0, cpf: 1 });
  assert.equal(out.candidates[0].hints.segment, "feed_mill");
  assert.match(out.candidates[0].evidence[0].quote, /RAÇÃO; FABRICANTE NÚCLEO/);
  assert.equal(out.candidates[0].evidence[0].strength, "activity_code", "registro indica atividade, não prova uso");
  assert.throws(() => sipeagroToCandidates("A;B\n1;2", { config: pilot, area, consultedAt: NOW }), /sem as colunas/);
});

test("Conciliação: provisória junta na unidade identificada com mesmo nome e município; máscara divergente ou duas opções não juntam", () => {
  const unit = { country: "BR", registrationId: "03306578005551", name: "Araguaia Teste S.A.", municipality: "Abadiânia", region: "GO" };
  const prov = { country: "BR", name: "ARAGUAIA TESTE SA", municipality: "Abadiania", region: "GO", hints: { idMask: "**.***.578/***-**" }, sources: [{ id: "mapa-sipeagro", mode: "import", ref: "GO1" }] };
  const m = mergeCandidates([unit, prov]);
  assert.equal(m.length, 1);
  assert.equal(m[0].conciliatedFrom.length, 1);
  assert.equal(m[0].hints.idMask, undefined);
  assert.equal(mergeCandidates([unit, { ...prov, hints: { idMask: "**.***.999/***-**" } }]).length, 2, "máscara incompatível não junta");
  const twin = { ...unit, registrationId: "03306578009999" };
  const both = mergeCandidates([unit, twin, { ...prov, hints: {} }]);
  const left = both.find((x) => x.provisional);
  assert.deepEqual(left.hints.conciliationOptions.sort(), ["BR:03306578005551", "BR:03306578009999"]);
  assert.equal(idMaskMatches("BR", "**.***.578/***-**", "03306578005551"), true);
  // Ordem de chegada não muda o resultado (reexecução estável).
  assert.equal(mergeCandidates([prov, unit]).length, 1);
});

test("Importação e pesquisa assistida: aspas, aliases, evidência sem URL vira indício; assistida exige fonte", () => {
  const rows = parseCsv('nome;cnpj;trecho\n"Empresa; com ponto e vírgula";00.000.000/0001-91;"diz ""milho"""');
  assert.equal(rows[0].nome, "Empresa; com ponto e vírgula");
  assert.equal(rows[0].trecho, 'diz "milho"');
  const out = importCandidates("CNPJ,Nome,Municipio,UF,evidence_kind,evidence_strength\n00.000.000/0001-91,Teste,Rio Verde,go,commodity_use,own_source", { format: "csv", country: "BR", consultedAt: NOW, label: "x.csv" });
  assert.equal(out.candidates[0].region, "GO");
  assert.equal(out.candidates[0].evidence[0].strength, "search_summary", "sem URL não comprova");
  assert.equal(out.candidates[0].sources[0].mode, "import");
  assert.deepEqual(importCandidates("{", { format: "json", country: "BR" }).errors.length, 1);
  assert.match(assistedCandidate({ name: "x" }, { country: "BR" }).errors.join(), /Fonte \(URL\) obrigatória/);
  const ok = assistedCandidate({ name: "x", sourceUrl: "https://x.example", evidence: { kind: "purchase", strength: "own_source" } }, { country: "BR", consultedAt: NOW, by: "u1" });
  assert.equal(ok.candidate.sources[0].mode, "assisted");
  assert.equal(ok.candidate.evidence[0].url, "https://x.example");
});

test("Limite de taxa sem espera: consultas além do orçamento ficam adiadas (não falham nem bloqueiam a fonte)", async () => {
  let budget = 1;
  const fetchers = { "br-cnpj-ws": async () => { if (budget-- <= 0) throw Object.assign(new Error("b"), { code: "rate_budget" }); return { status: "Ativa", municipality: "Abadiânia", region: "GO" }; } };
  const c = (id) => ({ country: "BR", registrationId: id, name: id, municipality: "Abadiânia", region: "GO" });
  const run = await runRound({ config: ex("milho-gmo-indiara-300km"), municipalities: IBGE, candidates: [c("00000000000191"), c("11111111000191")], fetchers, clock: { now: () => 0, sleep: async () => {} }, now: NOW });
  const second = run.results.find((x) => x.registrationId === "11111111000191");
  assert.ok(second.pending.some((p) => /adiada pelo limite de 3\/min: reexecutar/.test(p)));
});

test("Formatos antigos: adaptação explícita, sem reescrever o original e sem promover indício a prova", () => {
  const f = "docs/implementation/descoberta-milho-indiara/candidatas.csv";
  const before = createHash("sha256").update(read(f)).digest("hex");
  const list = adaptLegacyCandidatesCsv(read(f).toString("utf8"), { file: f, adaptedAt: NOW });
  assert.ok(list.length > 100);
  assert.ok(list.every((c) => c.evidence.every((e) => !["own_source", "official_record"].includes(e.strength))), "tudo indício até reconfirmar");
  assert.ok(list.every((c) => c.sources[0].ref.startsWith(f)));
  assert.equal(createHash("sha256").update(read(f)).digest("hex"), before);
  assert.throws(() => adaptLegacyCandidatesCsv("a;b\n1;2", { file: "x", adaptedAt: NOW }), /planilha antiga/);
  const old = JSON.parse(read("docs/implementation/descoberta-milho-indiara/cadastro-lote-aceito.json"));
  const copy = JSON.parse(JSON.stringify(old));
  assert.throws(() => adaptLegacyBatch(old, { file: "x", adaptedAt: NOW }), /Informe o produto/);
  const b = adaptLegacyBatch(old, { produto: "Milho GMO", file: "x", adaptedAt: NOW, adaptedBy: "Revisor" });
  assert.ok(b.empresas.every((e) => e.level0 === undefined && e.rastreio.mode === "legacy" && e.rastreio.originalDecision === old.aceite));
  assert.match(b.adaptacao.notes[0], /nível 0 retirada/);
  assert.deepEqual(old, copy, "objeto original intacto");
  assert.throws(() => adaptLegacyBatch({ ...old, produto: "Outro" }, { produto: "Milho GMO", file: "x", adaptedAt: NOW }), /recusada/);
});
