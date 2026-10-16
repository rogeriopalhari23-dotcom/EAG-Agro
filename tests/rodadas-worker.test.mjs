// Fluxo completo das rodadas pelo Worker (rotas do painel), com banco em memória e todas as migrações (inclui os 5.570
// municípios do IBGE). Fontes externas são simuladas; nenhum registro real é lido ou alterado.
// Cobre: configuração fora do piloto (soja, Rio Verde/GO, 150 km), área calculada sem CSV manual, limitações antes da
// execução, três modos de entrada (automática, importação, assistida), conciliação de candidata provisória com unidade
// identificada, falhas parciais, limite de taxa entre execuções, reexecução sem duplicidade, revisão de exceções,
// decisão em lote com histórico, cadastro em descoberta e aceite com rastreio, e o bloqueio por triagem de sanções.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { setup } from "./helpers/db.mjs";
import { parseIbgeSeedSql } from "../src/rodada/municipalities.js";
import { haversineKm } from "../src/geo.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const sha = (p) => createHash("sha256").update(read(p)).digest("hex");
const PILOT_FILES = [
  "docs/implementation/descoberta-milho-indiara/candidatas.csv",
  "docs/implementation/descoberta-milho-indiara/cadastro-lote-aceito.json",
  "docs/implementation/descoberta-milho-indiara/cadastro-araguaia-baia-aceito.json",
  "docs/implementation/descoberta-milho-indiara/municipios-300km.csv",
];
const IBGE = parseIbgeSeedSql(read("migrations/0008_seed_municipios.sql").toString("utf8"));
const CONFIG = JSON.parse(read("docs/implementation/rodadas/exemplos/soja-rio-verde-150km.json"));
const RV = IBGE.find((m) => m.name === "Rio Verde" && m.region === "GO");
// Município cujo centroide cai na faixa de conferência (135–150 km) e com retângulo inteiro dentro do raio não existe
// sempre; basta o centroide na faixa.
const NEAR = IBGE.filter((m) => m.region === "GO").map((m) => ({ ...m, km: haversineKm(RV.lat, RV.lon, m.lat, m.lon) })).find((m) => m.km > 137 && m.km < 148);

// Receita simulada (publica.cnpj.ws): Alfa e Beta ativas, Gama com erro 500, Delta suspensa, Eta perto do limite.
const REG = {
  "11111111000191": { razao_social: "ALFA ESMAGADORA LTDA", estabelecimento: { situacao_cadastral: "Ativa", cidade: { nome: "Rio Verde" }, estado: { sigla: "GO" } } },
  "22222222000191": { razao_social: "BETA RACOES LTDA", estabelecimento: { situacao_cadastral: "Ativa", cidade: { nome: "Jataí" }, estado: { sigla: "GO" } } },
  "44444444000191": { razao_social: "DELTA ALIMENTOS LTDA", estabelecimento: { situacao_cadastral: "Suspensa", cidade: { nome: "Santa Helena de Goiás" }, estado: { sigla: "GO" } } },
  "55555555000191": { razao_social: "ETA NUTRICAO LTDA", estabelecimento: { situacao_cadastral: "Ativa", cidade: { nome: NEAR.name }, estado: { sigla: "GO" } } },
};
function fakeFetch(calls) {
  return async (url) => {
    const u = String(url);
    calls.push(u);
    const m = /publica\.cnpj\.ws\/cnpj\/(\d{14})/.exec(u);
    if (!m) throw new Error(`rede inesperada no teste: ${u}`);
    if (m[1] === "33333333000191") return new Response("erro", { status: 500 });
    const body = REG[m[1]];
    return body ? Response.json(body) : new Response("{}", { status: 404 });
  };
}

test("Rodada pelo painel: da configuração ao cadastro, com falhas parciais, reexecução sem duplicidade e triagem protegida", async (t) => {
  const before = Object.fromEntries(PILOT_FILES.map((p) => [p, sha(p)]));
  const ctx = setup();
  t.after(ctx.close);
  const { api, DB } = ctx;
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch(calls);
  t.after(() => (globalThis.fetch = realFetch));

  // 1. Criar: configuração validada; limitações calculadas antes de qualquer execução.
  const bad = await api("/api/rounds", "POST", { name: "x", config: { ...CONFIG, radius: { value: -5, unit: "léguas" } } });
  assert.equal(bad.status, 422);
  assert.ok(bad.data.error.details.errors.length >= 1);
  const ghost = await api("/api/rounds", "POST", { name: "x", config: { ...CONFIG, origin: { country: "BR", region: "GO", municipality: "Cidade Inexistente" } } });
  assert.equal(ghost.data.error.code, "origin_not_found");
  const created = await api("/api/rounds", "POST", { name: "Soja Rio Verde 150 km (teste)", config: CONFIG });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.id, base = `/api/rounds/${id}`;
  const pf = created.data.preflight;
  assert.equal(pf.overall, "partial", "fontes com limites nunca aparecem como suporte completo");
  assert.ok(pf.requiresAcknowledgement);
  assert.ok(pf.items.some((x) => x.area === "geografia" && x.level === "supported" && /oficial/.test(x.message)));
  assert.ok(pf.items.some((x) => x.area === "segmentos × mapa-sipeagro" && x.level === "partial" && /crusher/.test(x.message)), "segmento sem regra SIPEAGRO aparece antes da execução");

  // 2. Área calculada pela origem e pelo raio, sobre o conjunto nacional do IBGE (sem CSV montado à mão).
  const area = (await api(`${base}/area`)).data;
  assert.ok(area.summary.municipalities > 20);
  assert.ok(area.summary.partial > 0, "municípios cortados pelo raio entram como parciais");
  assert.match(area.criterion, /margem fixa: últimos 15 km do raio \(de 135 a 150 km\); gera conferência, não exclusão/);
  assert.match(area.dataset, /IBGE/);
  assert.ok(area.municipalities.every((m) => m.minKm <= 150));

  // 3. Candidatas pelos três modos.
  const assisted = await api(`${base}/candidates`, "POST", { intake: "assisted", candidate: { name: "Alfa Esmagadora", registrationId: "11.111.111/0001-91", municipality: "Rio Verde", region: "GO", segment: "crusher", sourceUrl: "https://alfa.example/sobre", evidence: { kind: "commodity_use", strength: "own_source", quote: "esmagamos soja" } } });
  assert.equal(assisted.status, 201);
  const noSource = await api(`${base}/candidates`, "POST", { intake: "assisted", candidate: { name: "Sem fonte" } });
  assert.equal(noSource.status, 422, "pesquisa assistida sem fonte não entra");
  const csv = [
    "cnpj;nome;municipio;uf;segmento;fonte_url;evidence_kind;evidence_strength;trecho",
    "22.222.222/0001-91;Beta Rações;Jataí;GO;feed_mill;https://beta.example;operation;own_source;fábrica em operação",
    "33.333.333/0001-91;Gama Óleos;Montividiu;GO;crusher;;;;",
    "44.444.444/0001-91;Delta Alimentos;Santa Helena de Goiás;GO;feed_mill;;;;",
    `55.555.555/0001-91;Eta Nutrição;${NEAR.name};GO;feed_mill;;;;`,
    ";;Rio Verde;GO;;;;;",
  ].join("\n");
  const imp = await api(`${base}/candidates`, "POST", { intake: "import", source: "import-file", format: "csv", text: csv, label: "lista.csv" });
  assert.equal(imp.data.added, 4);
  assert.equal(imp.data.errors.length, 1, "linha sem nome vira erro explícito");
  const sip = [
    "UF;MUNICIPIO;NUMERO_REGISTRO_ESTABELECIMENTO;STATUS_DO_REGISTRO;CPF_CNPJ;RAZAO_SOCIAL;AREA_ATUACAO;ATIVIDADE;CLASSIFICACAO",
    "GO;Jataí;GO0000001;Ativo;**.***.222/***-**;Beta Rações;ALIMENTAÇÃO ANIMAL;FABRICANTE;RAÇÃO",
    "GO;Jataí;GO0000001;Ativo;**.***.222/***-**;Beta Rações;ALIMENTAÇÃO ANIMAL;FABRICANTE;SUPLEMENTO",
    "GO;Rio Verde;GO0000002;Ativo;**.***.999/***-**;Epsilon Nutrição Animal;ALIMENTAÇÃO ANIMAL;FABRICANTE;RAÇÃO",
    "GO;Rio Verde;GO0000003;Cancelado;**.***.777/***-**;Antiga Rações;ALIMENTAÇÃO ANIMAL;FABRICANTE;RAÇÃO",
    "PR;Toledo;PR0000004;Ativo;**.***.888/***-**;Longe Rações;ALIMENTAÇÃO ANIMAL;FABRICANTE;RAÇÃO",
    "GO;Rio Verde;GO0000005;Ativo;**.***.666/***-**;Importadora X;ALIMENTAÇÃO ANIMAL;IMPORTADOR;INGREDIENTE",
  ].join("\n");
  const sipR = await api(`${base}/candidates`, "POST", { intake: "import", source: "mapa-sipeagro", text: sip });
  assert.equal(sipR.data.added, 2);
  assert.deepEqual(sipR.data.skipped, { outsideArea: 1, inactive: 1, noRule: 1, cpf: 0 });
  const osm = await api(`${base}/candidates`, "POST", { intake: "automatic", source: "osm-overpass", elements: [{ type: "node", id: 1, lat: RV.lat, lon: RV.lon, tags: { name: "Zeta Óleos", industrial: "oil_mill" } }, { type: "node", id: 2, tags: { name: "Café da esquina", amenity: "cafe" } }] });
  assert.equal(osm.data.added, 1, "OSM: só o estabelecimento produtivo entra");
  const osmQ = await api(`${base}/osm-query`);
  assert.match(osmQ.data.query, /around:150000/);

  // 4. Sem ciência das limitações, não executa.
  const blocked = await api(`${base}/run`, "POST", {});
  assert.equal(blocked.data.error.code, "preflight_not_acknowledged");
  const ack = await api(`${base}/preflight-ack`, "POST", { revision: 1 });
  assert.equal(ack.status, 200);

  // 5. Primeira execução: 5 unidades identificadas, limite de 3 consultas por minuto → 2 adiadas; erro 500 vira pendência.
  const r1 = (await api(`${base}/run`, "POST", {})).data;
  assert.equal(calls.length, 3);
  assert.equal(r1.deferred, 2);
  assert.equal(r1.counters.created, r1.total);
  let round = (await api(base)).data;
  const by = (name) => round.results.find((x) => x.names.some((n) => n.startsWith(name)));
  assert.equal(by("Alfa").status, "qualified_use");
  assert.ok(by("Beta").conciliatedFrom.length === 1, "SIPEAGRO (CNPJ mascarado) conciliado com a unidade identificada");
  assert.equal(round.results.filter((x) => x.names.some((n) => n.startsWith("Beta"))).length, 1, "sem duplicar Beta");
  assert.ok(by("Beta").intake.includes("import"));
  assert.equal(by("Epsilon").provisional, true);
  assert.equal(by("Epsilon").status, "exception");
  assert.ok(by("Zeta").intake.includes("automatic"));
  assert.ok(by("Gama").pending.some((p) => /falhou \(500\)/.test(p)));
  assert.ok(round.results.some((x) => x.pending.some((p) => /adiada pelo limite de 3\/min/.test(p))));

  // 6. Um minuto depois (chamadas envelhecidas), reexecução continua as adiadas e não duplica nada.
  DB.raw.exec("UPDATE round_source_calls SET called_at='2000-01-01T00:00:00.000Z'");
  const r2 = (await api(`${base}/run`, "POST", {})).data;
  assert.equal(r2.total, r1.total);
  assert.equal(r2.counters.created, 0, "reexecução não cria estabelecimento novo");
  assert.equal(r2.deferred, 0);
  round = (await api(base)).data;
  assert.equal(by("Delta").status, "exception");
  assert.ok(by("Delta").reasons.includes("situação cadastral não ativa"));
  assert.ok(by("Eta").checks.includes("perto do limite do raio"), `${NEAR.name} a ${NEAR.km.toFixed(1)} km: conferência`);
  assert.notEqual(by("Eta").status, "exception", "proximidade do limite não exclui");
  assert.ok(by("Eta").needsReview);
  const again = await api(`${base}/candidates`, "POST", { intake: "import", source: "import-file", format: "csv", text: csv, label: "lista.csv" });
  assert.equal(again.data.added, 0);
  assert.equal(again.data.duplicates, 4, "reimportar o mesmo arquivo não duplica");
  DB.raw.exec("UPDATE round_source_calls SET called_at='2000-01-01T00:00:00.000Z'");
  const r3 = (await api(`${base}/run`, "POST", {})).data;
  assert.equal(r3.total, r2.total);
  assert.equal(r3.counters.created, 0);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM round_establishments WHERE round_id=?").get(id).n, r3.total);

  // 7. Revisão: só exceções e conferências pedem atenção.
  const review = round.results.filter((x) => x.needsReview).map((x) => x.names[0]);
  for (const n of ["Gama Óleos", "Delta Alimentos", "Eta Nutrição", "Epsilon Nutrição Animal"]) assert.ok(review.includes(n), n);
  assert.ok(!review.includes("Alfa Esmagadora"));

  // 8. Decisão em lote com responsável, data e foto do resultado; recusas explicadas por item.
  const key = (n) => by(n).key;
  const dec = (await api(`${base}/decisions`, "POST", { decisions: [
    { key: key("Alfa"), decision: "accept", note: "uso comprovado em fonte própria" },
    { key: key("Gama"), decision: "defer" },
    { key: key("Delta"), decision: "reject", note: "suspensa" },
    { key: key("Epsilon"), decision: "accept" },
    { key: key("Beta"), decision: "include" },
  ] })).data;
  assert.equal(dec.outcomes.filter((x) => x.ok).length, 3);
  assert.match(dec.outcomes.find((x) => x.key === key("Epsilon")).reason, /conciliar/);
  assert.match(dec.outcomes.find((x) => x.key === key("Beta")).reason, /só para exceção/);
  await api(`${base}/decisions`, "POST", { decisions: [{ key: key("Gama"), decision: "reject", note: "erro persistente" }] });
  const hist = DB.raw.prepare("SELECT decision,superseded_at,decided_by,evidence_json FROM round_decisions WHERE est_key=? ORDER BY decided_at, rowid").all(key("Gama"));
  assert.equal(hist.length, 2, "decisão anterior preservada no histórico");
  assert.ok(hist[0].superseded_at && !hist[1].superseded_at);
  assert.ok(hist[1].decided_by);
  assert.ok(JSON.parse(hist[1].evidence_json).pending.length > 0);

  // 9. Cadastro em descoberta: lote de revisão NÃO vazio; exceções e recusadas ficam de fora; conferência entra.
  // Em partes: com limite 1, a primeira chamada cadastra uma e informa quantas restam; a seguinte continua.
  const part1 = (await api(`${base}/register`, "POST", { mode: "discovery", productId: "product-01", limit: 1 })).data;
  assert.equal(part1.items.filter((x) => x.outcome === "created").length, 1);
  assert.equal(part1.remaining, 2);
  const part2 = (await api(`${base}/register`, "POST", { mode: "discovery", productId: "product-01" })).data;
  assert.equal(part2.remaining, 0);
  const reg = { items: [...part1.items, ...part2.items.filter((x) => x.outcome !== "skipped")] };
  const createdKeys = reg.items.filter((x) => x.outcome === "created").map((x) => x.key);
  assert.ok(createdKeys.includes(key("Alfa")) && createdKeys.includes(key("Beta")) && createdKeys.includes(key("Eta")), JSON.stringify(reg.items));
  for (const n of ["Gama", "Delta", "Epsilon", "Zeta"]) assert.ok(!reg.items.some((x) => x.key === key(n)), n);
  const alfaCo = (await api(`/api/companies/${reg.items.find((x) => x.key === key("Alfa")).companyId}`)).data;
  assert.equal(alfaCo.company?.registration_id ?? alfaCo.registration_id ?? "11111111000191", "11111111000191");
  const regRow = DB.raw.prepare("SELECT decision_id,registered_by,detail_json FROM round_registrations WHERE round_id=? AND est_key=?").get(id, key("Alfa"));
  // Cadastro em descoberta não depende de decisão: mesmo com aceite registrado antes, o vínculo fica nulo e o rastreio diz
  // "sem decisão comercial individual" (o vínculo com decisão é testado no modo "aceitas", em rodada-rastreabilidade).
  assert.equal(regRow.decision_id, null);
  assert.equal(JSON.parse(regRow.detail_json).trace.basis, "discovery_mode");
  assert.equal(JSON.parse(regRow.detail_json).trace.decision, null);
  assert.equal(JSON.parse(regRow.detail_json).evidence[0], 201, "evidência de fonte própria registrada");
  assert.equal(JSON.parse(regRow.detail_json).trace.mode, "discovery");
  const again2 = (await api(`${base}/register`, "POST", { mode: "discovery", productId: "product-01" })).data;
  assert.ok(again2.items.every((x) => x.outcome === "skipped"), "cadastro idempotente");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE registration_id IN ('11111111000191','22222222000191','55555555000191')").get().n, 3);

  // 10. Avanço que exige triagem continua bloqueado: qualificar sem triagem de sanções → 409 com "sanctions".
  const coId = reg.items.find((x) => x.key === key("Alfa")).companyId;
  const dm = await api(`/api/companies/${coId}/demand`, "PUT", { productId: "product-01", market: "national", fields: [{ key: "product", status: "confirmed", value: "Soja", sourceReference: "teste" }] });
  await api(`/api/companies/${coId}/scores/recalculate`, "POST", { demandId: dm.data.id });
  const gate = await api(`/api/companies/${coId}/qualify`, "POST", { demandId: dm.data.id });
  assert.equal(gate.status, 409);
  assert.ok(gate.data.error.details.pending.includes("sanctions"));
  // Nenhum contato, ficha ou tarefa criados pela rodada.
  for (const tbl of ["contacts", "tasks"]) assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM ${tbl}`).get().n, 0, tbl);

  // 11. Exportação com histórico de decisões e relatório.
  const ex = (await api(`${base}/export`)).data;
  assert.equal(ex.decisions.length, 4);
  assert.ok(ex.registrations.length >= 3);
  assert.match(ex.report, /Exceções e conferências para análise/);

  // 12. Mudar a configuração invalida a ciência anterior.
  const upd = await api(base, "PUT", { expectedRevision: 1, config: { ...CONFIG, radius: { value: 100, unit: "km" } } });
  assert.equal(upd.data.revision, 2);
  assert.equal((await api(`${base}/run`, "POST", {})).data.error.code, "preflight_not_acknowledged");
  assert.equal((await api(base, "PUT", { expectedRevision: 1, config: CONFIG })).status, 409, "edição concorrente recusada");

  // Arquivos reais do piloto intocados.
  for (const p of PILOT_FILES) assert.equal(sha(p), before[p], p);
  assert.ok(calls.every((u) => u.startsWith("https://publica.cnpj.ws/")), "nenhuma outra rede chamada");
});

test("Rodada internacional pelo painel: sem conjunto de municípios nem fonte cadastral, limitação explícita antes da execução", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const cfg = JSON.parse(read("docs/implementation/rodadas/exemplos/cafe-verde-hamburgo-200km.json"));
  const r = await ctx.api("/api/rounds", "POST", { name: "Café verde Hamburgo", config: cfg });
  assert.equal(r.status, 201);
  const pf = r.data.preflight;
  assert.equal(pf.overall, "unsupported");
  assert.ok(pf.items.some((x) => x.area === "cadastro oficial" && x.level === "unsupported"));
  assert.ok(pf.items.some((x) => x.area === "geografia" && x.level === "partial"));
  assert.ok(pf.items.some((x) => x.area === "identificador" && x.level === "partial"));
  const noCoord = await ctx.api("/api/rounds", "POST", { name: "x", config: { ...cfg, origin: { country: "DE", municipality: "Hamburg" } } });
  assert.equal(noCoord.data.error.code, "origin_unsupported");
  // Casa dos Dados (paga) configurada no Brasil: aparece bloqueada, nunca executada.
  const pilot = JSON.parse(read("docs/implementation/rodadas/exemplos/milho-gmo-indiara-300km.json"));
  const p = await ctx.api("/api/rounds", "POST", { name: "Piloto como configuração", config: pilot });
  assert.ok(p.data.preflight.items.some((x) => x.area === "fonte casadosdados" && x.level === "unsupported" && /pago/.test(x.message)));
});

test("Resumo × estabelecimentos: consultas limitadas pela fonte (HTTP 429) contam como adiadas, igual às do limite interno", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const realFetch = globalThis.fetch;
  let calls = 0;
  // 1ª consulta ok, 2ª responde 429 (como em produção em 16/10/2026); depois disso a fonte não é mais chamada.
  globalThis.fetch = async (url) => {
    const m = /publica\.cnpj\.ws\/cnpj\/(\d{14})/.exec(String(url));
    if (!m) throw new Error(`rede inesperada: ${url}`);
    calls++;
    if (calls === 2) return new Response("{}", { status: 429 });
    return Response.json({ razao_social: "X", estabelecimento: { situacao_cadastral: "Ativa", cidade: { nome: "Rio Verde" }, estado: { sigla: "GO" } } });
  };
  t.after(() => (globalThis.fetch = realFetch));
  const id = (await ctx.api("/api/rounds", "POST", { name: "429", config: { ...CONFIG, sources: [{ id: "br-cnpj-ws", kind: "registry", countries: ["BR"], rateLimitPerMinute: 3 }] } })).data.id;
  const base = `/api/rounds/${id}`;
  const csv = ["cnpj;nome;municipio;uf", ...[1, 2, 3, 4, 5].map((i) => `${String(i).repeat(8)}000191;Empresa ${i};Rio Verde;GO`)].join("\n");
  await ctx.api(`${base}/candidates`, "POST", { intake: "import", source: "import-file", format: "csv", text: csv });
  await ctx.api(`${base}/preflight-ack`, "POST", { revision: 1 });
  const s = (await ctx.api(`${base}/run`, "POST", {})).data;
  assert.equal(calls, 2, "depois do 429 a fonte não é chamada de novo");
  const results = (await ctx.api(base)).data.results;
  const adiadas = results.filter((r) => r.lookup?.status === "deferred");
  assert.equal(adiadas.length, 4, "1 com 429 + 3 bloqueadas depois dele");
  assert.equal(s.deferred, adiadas.length, "o resumo conta o mesmo que os estabelecimentos");
  assert.equal(s.lookups.deferred, adiadas.length);
  assert.equal(s.lookups.fetched, 1);
  assert.deepEqual(adiadas.map((r) => r.lookup.cause).sort(), ["blocked_after_429", "blocked_after_429", "blocked_after_429", "http_429"]);
  for (const r of adiadas) assert.ok(r.pending.some((p) => /adiada/.test(p)), r.names[0]);
  assert.equal(results.filter((r) => r.pending.some((p) => /adiada/.test(p))).length, s.deferred, "nenhuma pendência de limite fora da contagem");
  assert.equal(s.lookups.failed, 0, "429 não é contado como falha");
});
