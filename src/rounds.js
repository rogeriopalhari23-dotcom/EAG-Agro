// Rodadas de descoberta e qualificação pelo painel (fluxo geral; RODADAS-FLUXO-GERAL).
// Criar e configurar a rodada → ver a área (IBGE) e as limitações ANTES de executar → trazer candidatas (descoberta
// automática, importação ou pesquisa assistida) → executar (cadastro oficial com limite de taxa, conciliação, distância,
// qualificação) → revisar exceções e conferências → decidir em lote (quem, quando e a foto do resultado avaliado) →
// cadastrar no Compass pelas rotas existentes (mesmas regras do cadastro manual).
// Nada aqui faz contato, aprova ficha, libera envio ou consome serviço pago. A triagem de sanções continua no Compass:
// o cadastro em descoberta pode vir antes dela; os avanços que exigem triagem continuam bloqueados pelo próprio Compass.
import { bodyJson, fail, str, oneOf, requireRole, WRITE_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, product, parameters } from "./store.js";
import { normalizeName } from "./geo.js";
import { validateRoundConfig } from "./rodada/config.js";
import { municipalityIndex, resolveOrigin } from "./rodada/distance.js";
import { roundArea, fromIbgeRow, areaBox } from "./rodada/area.js";
import { preflight, SOURCE_CATALOG } from "./rodada/sources/catalog.js";
import { runRound } from "./rodada/batch.js";
import { buildRegistrationBatch } from "./rodada/acceptance.js";
import { brCnpjWs } from "./rodada/sources/br-cnpj-ws.js";
import { osmRoundQuery, osmToCandidates } from "./rodada/sources/osm.js";
import { sipeagroToCandidates } from "./rodada/sources/sipeagro.js";
import { importCandidates, assistedCandidate } from "./rodada/sources/import.js";
import { renderReport } from "./rodada/report.js";
import { operationRecord, describeOperation } from "./provenance.js";

// Fontes automáticas que o Worker consegue executar (o OSM sai pelo navegador; ver sources/osm.js).
const WORKER_FETCHERS = { "br-cnpj-ws": (fetchImpl) => brCnpjWs({ fetchImpl }) };
const BROWSER_SOURCES = ["osm-overpass"];
const CHUNK = 40;
const REF_MAX = 280; // trecho da referência exibido no fechamento

async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const chunks = (list, n = CHUNK) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const parse = (j, d = null) => (j ? JSON.parse(j) : d);

async function roundOf(env, actor, id) {
  const r = await s(env, "SELECT * FROM discovery_rounds WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!r) fail(404, "round_not_found", "Rodada não encontrada.");
  return { ...r, config: JSON.parse(r.config_json) };
}

// Municípios do conjunto oficial (D1) dentro do retângulo do raio, mais os citados pelas candidatas fora dele.
async function municipalitiesFor(env, config, origin, extra = []) {
  if (config.origin.country !== "BR") return [];
  const box = areaBox(origin, config.radius.km);
  const rows = (await s(env, "SELECT * FROM municipalities WHERE bbox_max_lat>=? AND bbox_min_lat<=? AND bbox_max_lon>=? AND bbox_min_lon<=?", box.minLat, box.maxLat, box.minLon, box.maxLon).all()).results;
  const list = rows.map(fromIbgeRow);
  const have = new Set(list.map((m) => `${m.region}|${normalizeName(m.name)}`));
  const missing = [...new Set(extra.filter((x) => x.region && x.name).map((x) => `${String(x.region).toUpperCase()}|${normalizeName(x.name)}`))].filter((k) => !have.has(k));
  for (const group of chunks(missing, 30)) {
    const cond = group.map(() => "(uf=? AND name_normalized=?)").join(" OR ");
    const more = (await s(env, `SELECT * FROM municipalities WHERE ${cond}`, ...group.flatMap((k) => k.split("|"))).all()).results;
    list.push(...more.map(fromIbgeRow));
  }
  return list;
}

// Origem: coordenada da configuração ou município do conjunto oficial (qualquer município brasileiro).
async function originFor(env, config) {
  if (typeof config.origin.lat === "number") return resolveOrigin(config, municipalityIndex([]));
  if (config.origin.country !== "BR") fail(422, "origin_unsupported", `Sem conjunto oficial de municípios para ${config.origin.country}: informe a coordenada da origem.`);
  const o = config.origin;
  const row = o.municipalityCode
    ? await s(env, "SELECT * FROM municipalities WHERE ibge_code=?", Number(o.municipalityCode)).first()
    : await s(env, "SELECT * FROM municipalities WHERE uf=? AND name_normalized=?", String(o.region ?? "").toUpperCase(), normalizeName(o.municipality ?? "")).first();
  if (!row) fail(422, "origin_not_found", "Município de origem não encontrado na base oficial do IBGE (confira nome e UF ou o código IBGE).");
  return resolveOrigin(config, municipalityIndex([fromIbgeRow(row)]));
}

function validated(raw) {
  const v = validateRoundConfig(raw);
  if (!v.ok) fail(422, "invalid_round_config", "Configuração da rodada inválida.", { errors: v.errors });
  return v.config;
}
const preflightFor = (config) =>
  preflight(config, { geography: config.origin.country === "BR" ? "national_official" : "none", implemented: [...Object.keys(WORKER_FETCHERS), ...BROWSER_SOURCES] });

// Triagens de sanções das empresas cadastradas pela rodada (só leitura): última execução por empresa, ocorrências,
// versões das listas usadas e validade pela mesma regra do Compass (sanctions_max_age_hours sobre o download de cada lista).
async function screeningsFor(env, actor, id) {
  const maxAge = (await parameters(env, actor.tenant_id))["sanctions_max_age_hours:global"];
  const rows = (await s(env, "SELECT rr.est_key, rr.company_id, sr.id run_id, sr.status, sr.completed_at, sr.source_versions_json, (SELECT COUNT(*) FROM screening_matches m WHERE m.screening_run_id=sr.id) matches FROM round_registrations rr JOIN screening_runs sr ON sr.id=(SELECT x.id FROM screening_runs x WHERE x.tenant_id=? AND x.company_id=rr.company_id ORDER BY x.initiated_at DESC, x.rowid DESC LIMIT 1) WHERE rr.round_id=?", actor.tenant_id, id).all()).results;
  const out = {};
  for (const r of rows) {
    const versions = Object.values(JSON.parse(r.source_versions_json || "{}"));
    const dl = versions.length ? (await s(env, `SELECT MIN(downloaded_at) oldest FROM sanction_list_versions WHERE id IN (${versions.map(() => "?").join(",")})`, ...versions).first())?.oldest : null;
    const validUntil = dl && typeof maxAge === "number" ? new Date(Date.parse(dl) + maxAge * 3600000).toISOString() : null;
    out[r.est_key] = { companyId: r.company_id, runId: r.run_id, status: r.status, completedAt: r.completed_at, matches: r.matches, lists: versions.length, oldestListDownloadedAt: dl, validUntil, valid: !!validUntil && Date.parse(validUntil) > Date.now() && r.status === "completed" };
  }
  return out;
}

// Conflitos registrados no cadastro do Compass (evidência com validação "conflicting") das empresas cadastradas pela
// rodada: entram no fechamento como conflito de fonte, para o painel e o relatório mostrarem o mesmo que o cadastro.
async function registeredConflicts(env, actor, id) {
  const rows = (await s(env, "SELECT rr.est_key, e.reference, e.source_url FROM round_registrations rr JOIN evidence e ON e.tenant_id=? AND e.company_id=rr.company_id AND e.validation_status='conflicting' WHERE rr.round_id=?", actor.tenant_id, id).all()).results;
  const out = {};
  for (const r of rows) (out[r.est_key] ??= []).push({ field: "registered_evidence", text: `Evidência do cadastro marcada como conflitante: ${String(r.reference).slice(0, REF_MAX)}`, sources: r.source_url ? [r.source_url] : [] });
  return out;
}
const withConflicts = (res, extra) => (res.closure && extra?.length ? { ...res, closure: { ...res.closure, conflicts: [...res.closure.conflicts, ...extra] } } : res);

// Cadastro feito pela rodada, com o rastreio legível: descoberta sem decisão comercial individual × aceite com decisão.
// Cadastros antigos (antes desta regra) mostram só o que foi gravado; nada é inferido para trás.
function registrationView(x) {
  const detail = parse(x.detail_json, {});
  const t = detail.trace ?? {};
  const basis = t.basis ?? (x.mode === "accept" ? "decision_accept" : "discovery_mode");
  const label = t.label ?? (basis === "decision_accept" ? "cadastro por aceite (decisão registrada)" : "cadastro sem decisão comercial individual");
  return {
    est_key: x.est_key, company_id: x.company_id, mode: x.mode, outcome: x.outcome, registered_at: x.registered_at, registered_by: x.registered_by,
    basis, label, decisionId: x.decision_id ?? null, decision: t.decision && typeof t.decision === "object" ? t.decision : null,
    operation: detail.operation ?? null,
    operationText: detail.operation ? describeOperation(detail.operation) : `Operação em ${x.registered_at}; identidade autenticada: ${x.registered_by} (não prova ação humana); canal e executor não registrados (cadastro anterior à regra de rastreabilidade).`,
  };
}

// Anotações complementares da rodada: registro novo, com a data real em que foi gravado; nunca reescrevem o que existe.
async function annotationsOf(env, actor, id) {
  const rows = (await s(env, "SELECT occurred_at, actor_id, request_id, new_value_json FROM audit_log WHERE tenant_id=? AND entity_type='discovery_round' AND entity_id=? AND action='round.annotated' ORDER BY occurred_at", actor.tenant_id, id).all()).results;
  return rows.map((r) => ({ annotatedAt: r.occurred_at, authenticatedIdentity: r.actor_id, requestId: r.request_id, ...parse(r.new_value_json, {}) }));
}

export async function annotateRound(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  await roundOf(env, actor, id);
  const i = await bodyJson(request);
  const text = str(i.text, "texto da anotação", 3000);
  const refersTo = {
    requestIds: Array.isArray(i.refersTo?.requestIds) ? i.refersTo.requestIds.slice(0, 20).map((x) => str(x, "requisição", 80)) : [],
    estKeys: Array.isArray(i.refersTo?.estKeys) ? i.refersTo.estKeys.slice(0, 500).map((x) => str(x, "estabelecimento", 400)) : [],
  };
  // Autorização citada no corpo (o que a anotação documenta) e a operação desta anotação (cabeçalhos) ficam separadas.
  const a = i.authorization ?? null;
  const authorization = a ? { reference: str(a.reference, "referência da autorização", 400, true), grantedBy: str(a.grantedBy, "responsável pela autorização", 160, true), grantedAt: str(a.grantedAt, "data da autorização", 40, true) } : null;
  const at = now();
  const op = operationRecord(actor, at);
  await commit(env, [auditStatement(env, actor, rid, "round.annotated", "discovery_round", id, { kind: str(i.kind, "tipo", 60, true) ?? "complement", text, refersTo, authorization, operation: op })]);
  return { annotatedAt: at, requestId: rid, operation: op };
}

export async function listRounds(env, actor) {
  const rows = (await s(env, "SELECT id,name,status,config_json,config_revision,last_run_at,last_run_json,updated_at FROM discovery_rounds WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 100", actor.tenant_id).all()).results;
  return {
    items: rows.map((r) => {
      const c = JSON.parse(r.config_json);
      return { id: r.id, name: r.name, status: r.status, revision: r.config_revision, commodity: c.commodity?.label ?? c.commodity?.code, variety: c.commodity?.variety ?? null, origin: c.origin, radius: c.radius, lastRunAt: r.last_run_at, lastRun: parse(r.last_run_json), updatedAt: r.updated_at };
    }),
  };
}

export async function createRound(request, env, actor, rid) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request);
  const name = str(i.name, "nome", 120);
  const config = validated(i.config);
  await originFor(env, config);
  const id = crypto.randomUUID(), at = now();
  const pf = preflightFor(config);
  await commit(env, [
    s(env, "INSERT INTO discovery_rounds(id,tenant_id,name,config_json,status,preflight_json,created_by,created_at,updated_at) VALUES (?,?,?,?,'draft',?,?,?,?)", id, actor.tenant_id, name, JSON.stringify(i.config), JSON.stringify(pf), actor.id, at, at),
    auditStatement(env, actor, rid, "round.created", "discovery_round", id, { name, configId: config.id }),
  ]);
  return { id, preflight: pf };
}

export async function updateRoundConfig(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const r = await roundOf(env, actor, id);
  if (r.status === "closed") fail(409, "round_closed", "Rodada encerrada.");
  const i = await bodyJson(request);
  if (i.expectedRevision !== r.config_revision) fail(409, "revision_conflict", "A configuração mudou desde a última leitura; atualize antes de salvar.");
  const config = validated(i.config);
  await originFor(env, config);
  const pf = preflightFor(config);
  // Configuração nova = limitações novas: a ciência anterior deixa de valer.
  await commit(env, [
    s(env, "UPDATE discovery_rounds SET config_json=?,config_revision=config_revision+1,preflight_json=?,preflight_ack_by=NULL,preflight_ack_at=NULL,preflight_ack_revision=NULL,updated_at=? WHERE id=? AND config_revision=?", JSON.stringify(i.config), JSON.stringify(pf), now(), id, r.config_revision),
    auditStatement(env, actor, rid, "round.config_updated", "discovery_round", id, { fromRevision: r.config_revision }),
  ]);
  return { id, revision: r.config_revision + 1, preflight: pf };
}

export async function acknowledgePreflight(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const r = await roundOf(env, actor, id);
  const i = await bodyJson(request);
  if (i.revision !== r.config_revision) fail(409, "revision_conflict", "As limitações mostradas são de outra versão da configuração.");
  const at = now();
  await commit(env, [
    s(env, "UPDATE discovery_rounds SET preflight_ack_by=?,preflight_ack_at=?,preflight_ack_revision=?,status=CASE WHEN status='draft' THEN 'active' ELSE status END,updated_at=? WHERE id=?", actor.id, at, r.config_revision, at, id),
    auditStatement(env, actor, rid, "round.preflight_acknowledged", "discovery_round", id, { revision: r.config_revision, overall: parse(r.preflight_json)?.overall }),
  ]);
  return { acknowledgedAt: at, revision: r.config_revision };
}

export async function getRound(env, actor, id) {
  const r = await roundOf(env, actor, id);
  const v = validateRoundConfig(r.config);
  const ests = (await s(env, "SELECT est_key,status,needs_review,result_json FROM round_establishments WHERE round_id=? ORDER BY needs_review DESC, status", id).all()).results;
  const decisions = (await s(env, "SELECT id,est_key,decision,note,decided_by,decided_at FROM round_decisions WHERE round_id=? AND superseded_at IS NULL", id).all()).results;
  const regs = (await s(env, "SELECT est_key,company_id,mode,outcome,decision_id,registered_by,registered_at,detail_json FROM round_registrations WHERE round_id=?", id).all()).results.map(registrationView);
  const annotations = await annotationsOf(env, actor, id);
  const cands = (await s(env, "SELECT intake,source_id,COUNT(*) n FROM round_candidates WHERE round_id=? GROUP BY intake,source_id", id).all()).results;
  const dec = new Map(decisions.map((d) => [d.est_key, d])), reg = new Map(regs.map((x) => [x.est_key, x]));
  const scr = regs.length ? await screeningsFor(env, actor, id) : {};
  const regConf = regs.length ? await registeredConflicts(env, actor, id) : {};
  return {
    id: r.id, name: r.name, status: r.status, revision: r.config_revision, config: r.config, normalized: v.ok ? { radiusKm: v.config.radius.km, nearLimit: v.config.nearLimit } : null,
    preflight: parse(r.preflight_json), acknowledged: r.preflight_ack_revision === r.config_revision ? { by: r.preflight_ack_by, at: r.preflight_ack_at } : null,
    lastRunAt: r.last_run_at, lastRun: parse(r.last_run_json), candidates: cands,
    sources: Object.fromEntries(Object.entries(SOURCE_CATALOG).map(([k, x]) => [k, { label: x.label, mode: x.mode, cost: x.cost, countries: x.countries }])),
    annotations,
    results: ests.map((e) => ({ ...withConflicts(JSON.parse(e.result_json), regConf[e.est_key]), needsReview: Boolean(e.needs_review), decision: dec.get(e.est_key) ?? null, registration: reg.get(e.est_key) ?? null, screening: scr[e.est_key] ?? null })),
  };
}

export async function getArea(env, actor, id) {
  const r = await roundOf(env, actor, id);
  const config = validated(r.config);
  const origin = await originFor(env, config);
  const area = roundArea({ origin, config, municipalities: await municipalitiesFor(env, config, origin) });
  return { ...area, dataset: config.origin.country === "BR" ? "IBGE — municípios oficiais (migração 0008)" : null };
}

// Consulta OSM para o navegador executar (o servidor público recusa a Cloudflare).
export async function osmQuery(env, actor, id) {
  const r = await roundOf(env, actor, id);
  const config = validated(r.config);
  if (!(config.sources ?? []).some((x) => x.id === "osm-overpass")) fail(422, "source_not_configured", "OpenStreetMap não está entre as fontes desta rodada.");
  const query = osmRoundQuery(config, await originFor(env, config));
  if (!query) fail(422, "no_segment_rule", "Nenhum segmento desta rodada tem etiquetas do OpenStreetMap.");
  return { endpoint: "https://overpass-api.de/api/interpreter", query };
}

// Entrada de candidatas: { intake: "automatic"|"import"|"assisted", source, ... }.
//  automatic + osm-overpass: { elements } (resposta do Overpass, em partes);
//  import + mapa-sipeagro: { text } (CSV, em partes com cabeçalho); import + import-file: { text, format };
//  assisted: { candidate: { name, sourceUrl, registrationId?, municipality?, region?, segment?, evidence? } }.
export async function addCandidates(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const r = await roundOf(env, actor, id);
  if (r.status === "closed") fail(409, "round_closed", "Rodada encerrada.");
  const config = validated(r.config);
  const i = await bodyJson(request);
  const intake = oneOf(i.intake, ["automatic", "import", "assisted"], "modo de entrada");
  const at = now();
  let candidates = [], errors = [], skipped = null, source;
  if (intake === "automatic") {
    source = oneOf(i.source, ["osm-overpass"], "fonte automática pelo navegador");
    if (!Array.isArray(i.elements)) fail(422, "invalid_field", "Envie elements da resposta do OpenStreetMap.");
    candidates = osmToCandidates({ elements: i.elements }, config, { consultedAt: at });
  } else if (intake === "import") {
    source = oneOf(i.source, ["mapa-sipeagro", "import-file"], "fonte de importação");
    const text = str(i.text, "arquivo", 65000);
    if (source === "mapa-sipeagro") {
      const origin = await originFor(env, config);
      const area = roundArea({ origin, config, municipalities: await municipalitiesFor(env, config, origin) });
      const out = sipeagroToCandidates(text, { config, area, sourceUrl: str(i.sourceUrl, "endereço do arquivo", 500, true) ?? SOURCE_CATALOG["mapa-sipeagro"].url, consultedAt: at });
      candidates = out.candidates;
      skipped = out.skipped;
    } else {
      const out = importCandidates(text, { format: oneOf(i.format, ["json", "csv"], "formato"), country: config.origin.country, consultedAt: at, label: str(i.label, "nome do arquivo", 200, true) ?? "arquivo" });
      candidates = out.candidates;
      errors = out.errors;
    }
  } else {
    source = "assisted";
    const out = assistedCandidate(i.candidate, { country: config.origin.country, consultedAt: at, by: actor.id });
    if (!out.candidate) fail(422, "invalid_candidate", "Candidata inválida.", { errors: out.errors });
    candidates = [out.candidate];
  }
  let added = 0, duplicates = 0;
  const stmts = [];
  for (const c of candidates) {
    // Mesma candidata da mesma fonte não entra duas vezes (o hash ignora a data da consulta).
    const stable = JSON.stringify({ ...c, sources: c.sources.map(({ consultedAt, ...x }) => x), evidence: (c.evidence ?? []).map(({ date, ...x }) => x) });
    const hash = await sha256(`${source}|${stable}`);
    stmts.push(s(env, "INSERT OR IGNORE INTO round_candidates(id,round_id,intake,source_id,payload_json,payload_hash,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)", crypto.randomUUID(), id, intake, source, JSON.stringify(c), hash, actor.id, at));
  }
  for (const group of chunks(stmts)) for (const res of await commit(env, group)) res.meta?.changes ? added++ : duplicates++;
  await commit(env, [
    s(env, "UPDATE discovery_rounds SET updated_at=? WHERE id=?", at, id),
    auditStatement(env, actor, rid, "round.candidates_added", "discovery_round", id, { intake, source, received: candidates.length, added, duplicates, skipped }),
  ]);
  return { intake, source, received: candidates.length, added, duplicates, skipped, errors };
}

// Limite de taxa entre execuções: quantas consultas ainda cabem no último minuto para a fonte.
async function budgetFor(env, sourceId, perMinute, at) {
  if (!perMinute) return Infinity;
  const since = new Date(Date.parse(at) - 60000).toISOString();
  const used = (await s(env, "SELECT COUNT(*) n FROM round_source_calls WHERE source_id=? AND called_at>?", sourceId, since).first()).n;
  return Math.max(0, perMinute - used);
}

export async function executeRound(request, env, actor, rid, id, deps = {}) {
  requireRole(actor, WRITE_ROLES);
  const r = await roundOf(env, actor, id);
  if (r.status === "closed") fail(409, "round_closed", "Rodada encerrada.");
  const pf = parse(r.preflight_json);
  if (pf?.requiresAcknowledgement && r.preflight_ack_revision !== r.config_revision)
    fail(409, "preflight_not_acknowledged", "Confirme a ciência das limitações desta configuração antes de executar.", { preflight: pf });
  const config = validated(r.config);
  const origin = await originFor(env, config);
  const at = deps.now ?? now();
  const cands = (await s(env, "SELECT payload_json FROM round_candidates WHERE round_id=? ORDER BY created_at, rowid", id).all()).results.map((x) => JSON.parse(x.payload_json));
  const prevRows = (await s(env, "SELECT est_key,state_json FROM round_establishments WHERE round_id=?", id).all()).results;
  const state = { establishments: Object.fromEntries(prevRows.map((x) => [x.est_key, JSON.parse(x.state_json)])) };
  const municipalities = await municipalitiesFor(env, config, origin, cands.map((c) => ({ name: c.municipality, region: c.region })));
  // Fontes automáticas do Worker, com orçamento do minuto (sem espera: o que não couber fica para a próxima execução).
  const fetchImpl = deps.fetch ?? fetch;
  const calls = [];
  const fetchers = {};
  for (const src of config.sources ?? []) {
    const make = WORKER_FETCHERS[src.id];
    if (!make || SOURCE_CATALOG[src.id]?.cost === "paid") continue;
    let budget = await budgetFor(env, src.id, src.rateLimitPerMinute ?? SOURCE_CATALOG[src.id]?.rateLimitPerMinute, at);
    const f = make(fetchImpl);
    fetchers[src.id] = async (est) => {
      if (budget <= 0) throw Object.assign(new Error("budget"), { code: "rate_budget" });
      budget--;
      try {
        const rec = await f(est);
        calls.push({ source: src.id, outcome: rec ? "ok" : "not_found" });
        return rec;
      } catch (e) {
        calls.push({ source: src.id, outcome: `error ${e.status ?? e.code ?? ""}`.trim() });
        throw e;
      }
    };
  }
  const run = await runRound({ config: r.config, municipalities, candidates: cands, fetchers, state, now: at, clock: { now: () => 0, sleep: async () => {} } });
  if (!run.ok) fail(422, "round_failed", "A rodada não pôde ser executada.", { errors: run.errors });
  const keys = new Set(run.results.map((x) => x.key));
  const stmts = [];
  for (const res of run.results) {
    const needs = res.status === "exception" || (res.checks ?? []).length ? 1 : 0;
    stmts.push(s(env, "INSERT INTO round_establishments(round_id,est_key,status,needs_review,state_json,result_json,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(round_id,est_key) DO UPDATE SET status=excluded.status,needs_review=excluded.needs_review,state_json=excluded.state_json,result_json=excluded.result_json,updated_at=excluded.updated_at",
      id, res.key, res.status, needs, JSON.stringify(run.state.establishments[res.key]), JSON.stringify(res), at));
  }
  // Estabelecimento provisório que foi conciliado com uma unidade identificada deixa de existir sozinho.
  for (const k of prevRows.map((x) => x.est_key).filter((k) => !keys.has(k))) stmts.push(s(env, "DELETE FROM round_establishments WHERE round_id=? AND est_key=?", id, k));
  for (const c of calls) stmts.push(s(env, "INSERT INTO round_source_calls(id,round_id,source_id,called_at,outcome) VALUES (?,?,?,?,?)", crypto.randomUUID(), id, c.source, at, c.outcome));
  for (const group of chunks(stmts)) await commit(env, group);
  // Adiadas = limite interno, HTTP 429 ou fonte bloqueada após 429 (situação estruturada de cada estabelecimento).
  const deferred = run.lookups.deferred;
  const summary = { at, counters: run.counters, total: run.results.length, exceptions: run.exceptions.length, review: run.review.length, byStatus: Object.fromEntries([...new Set(run.results.map((x) => x.status))].map((st) => [st, run.results.filter((x) => x.status === st).length])), sourceCalls: calls.length, deferred, lookups: run.lookups };
  await commit(env, [
    s(env, "UPDATE discovery_rounds SET last_run_at=?,last_run_json=?,status=CASE WHEN status='draft' THEN 'active' ELSE status END,updated_at=? WHERE id=?", at, JSON.stringify(summary), at, id),
    auditStatement(env, actor, rid, "round.executed", "discovery_round", id, summary),
  ]);
  return summary;
}

// Decisão em lote: [{ key, decision: accept|include|reject|defer, note? }]. Cada decisão guarda a foto do resultado.
export async function decide(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const r = await roundOf(env, actor, id);
  const i = await bodyJson(request);
  if (!Array.isArray(i.decisions) || !i.decisions.length || i.decisions.length > 200) fail(422, "invalid_field", "Envie de 1 a 200 decisões.");
  const at = now(), stmts = [], outcomes = [];
  for (const d of i.decisions) {
    const key = str(d.key, "estabelecimento", 400);
    const decision = oneOf(d.decision, ["accept", "include", "reject", "defer"], "decisão");
    const row = await s(env, "SELECT status,result_json FROM round_establishments WHERE round_id=? AND est_key=?", id, key).first();
    if (!row) { outcomes.push({ key, ok: false, reason: "estabelecimento não está na rodada" }); continue; }
    const res = JSON.parse(row.result_json);
    if (["accept", "include"].includes(decision) && (res.provisional || ["outside", "separated"].includes(res.status))) {
      outcomes.push({ key, ok: false, reason: res.provisional ? "unidade sem identificador: conciliar antes" : res.status === "outside" ? "fora do raio" : "revendedora ou trader (separada)" });
      continue;
    }
    if (decision === "include" && res.status !== "exception") { outcomes.push({ key, ok: false, reason: "incluir vale só para exceção; use aceitar" }); continue; }
    // Ciência das limitações autoriza EXECUTAR a rodada; não dispensa fonte, identificador nem verificação obrigatória.
    if (["accept", "include"].includes(decision) && !res.registry) {
      outcomes.push({ key, ok: false, reason: `verificação cadastral obrigatória ausente${res.lookup?.status ? ` (${res.lookup.status})` : ""}: a ciência das limitações não dispensa; reexecute quando a fonte responder ou registre por outro fluxo com verificação` });
      continue;
    }
    const snapshot = { status: res.status, reasons: res.reasons, checks: res.checks, pending: res.pending, distance: res.distance?.label, assessment: { operation: res.assessment.operation, commodityUse: res.assessment.commodityUse, purchase: res.assessment.purchase, role: res.assessment.role, restriction: res.assessment.restriction }, intake: res.intake, recordedBy: operationRecord(actor, at) };
    const decId = crypto.randomUUID();
    stmts.push(s(env, "UPDATE round_decisions SET superseded_at=? WHERE round_id=? AND est_key=? AND superseded_at IS NULL", at, id, key));
    stmts.push(s(env, "INSERT INTO round_decisions(id,round_id,est_key,decision,note,evidence_json,decided_by,decided_at) VALUES (?,?,?,?,?,?,?,?)", decId, id, key, decision, str(d.note, "observação", 1000, true), JSON.stringify(snapshot), actor.id, at));
    outcomes.push({ key, ok: true, id: decId });
  }
  stmts.push(auditStatement(env, actor, rid, "round.decided", "discovery_round", id, { recorded: outcomes.filter((x) => x.ok).length, refused: outcomes.filter((x) => !x.ok).length }));
  for (const group of chunks(stmts)) await commit(env, group);
  return { decidedBy: actor.id, decidedAt: at, outcomes };
}

// Cadastro no Compass a partir da rodada: mode "discovery" (sem aprovação individual) ou "accept" (só as aceitas).
// Usa as rotas existentes (dispatch), com as mesmas regras do cadastro manual. Idempotente por estabelecimento.
export async function registerFromRound(request, env, actor, rid, id, dispatch) {
  requireRole(actor, WRITE_ROLES);
  const r = await roundOf(env, actor, id);
  const i = await bodyJson(request);
  const mode = oneOf(i.mode, ["discovery", "accept"], "modo");
  const p = await product(env, actor.tenant_id, str(i.productId, "produto", 80));
  const rows = (await s(env, "SELECT result_json FROM round_establishments WHERE round_id=?", id).all()).results.map((x) => JSON.parse(x.result_json));
  const decRows = (await s(env, "SELECT id,est_key,decision,decided_by,decided_at FROM round_decisions WHERE round_id=? AND superseded_at IS NULL", id).all()).results;
  const done = new Set((await s(env, "SELECT est_key FROM round_registrations WHERE round_id=? AND outcome IN ('created','already_exists')", id).all()).results.map((x) => x.est_key));
  const decByKey = new Map(decRows.map((d) => [d.est_key, d]));
  // Recusa e adiamento valem também no modo descoberta.
  const blockedByDecision = new Set(decRows.filter((d) => ["reject", "defer"].includes(d.decision)).map((d) => d.est_key));
  const run = { config: validated(r.config), results: rows.filter((x) => !blockedByDecision.has(x.key)) };
  const decisions = Object.fromEntries(decRows.map((d) => [d.est_key, d.decision]));
  const op = operationRecord(actor, now());
  const decisionRecords = Object.fromEntries(decRows.map((d) => [d.est_key, { id: d.id, decidedBy: d.decided_by, decidedAt: d.decided_at }]));
  const batch = buildRegistrationBatch(run, { mode, decisions, decisionRecords, operation: op, productVariant: p.variant_name ?? p.id });
  const only = Array.isArray(i.keys) ? new Set(i.keys) : null;
  // Em partes: cada cadastro usa várias operações no banco; o painel repete a chamada até não restar nada.
  const limit = Number.isInteger(i.limit) && i.limit > 0 && i.limit <= 50 ? i.limit : 25;
  const out = [];
  let processed = 0, remaining = 0;
  for (const e of batch.empresas) {
    if (only && !only.has(e.chave)) continue;
    if (done.has(e.chave)) { out.push({ key: e.chave, outcome: "skipped", reason: "já cadastrada por esta rodada" }); continue; }
    if (processed >= limit) { remaining++; continue; }
    processed++;
    // Vínculo com a decisão só quando o cadastro dependeu dela (aceite ou inclusão de exceção); senão, fica nulo.
    const d = e.rastreio.decision ? decByKey.get(e.chave) : null;
    const c = await dispatch("/api/companies", "POST", e.company);
    let outcome, companyId = c.data?.id ?? null;
    const detail = {};
    if (c.status === 409) { outcome = "already_exists"; companyId = c.data?.error?.details?.id ?? null; }
    else if (c.status !== 201) { outcome = "failed"; detail.error = c.data?.error ?? c.status; }
    else {
      outcome = "created";
      detail.evidence = [];
      for (const ev of e.evidence) detail.evidence.push((await dispatch(`/api/companies/${companyId}/evidence`, "POST", { ...ev, productId: p.id })).status);
      detail.channels = [];
      for (const ch of e.channels) detail.channels.push((await dispatch(`/api/companies/${companyId}/channels`, "POST", ch)).status);
      detail.profile = (await dispatch(`/api/companies/${companyId}/profiles`, "POST", { ...e.profile, productId: p.id })).status;
      if (i.screening === true) detail.screening = (await dispatch(`/api/companies/${companyId}/screening`, "POST", {})).status;
    }
    detail.trace = e.rastreio;
    detail.operation = op;
    await commit(env, [
      s(env, "INSERT INTO round_registrations(round_id,est_key,company_id,mode,decision_id,outcome,detail_json,registered_by,registered_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(round_id,est_key) DO UPDATE SET company_id=excluded.company_id,mode=excluded.mode,decision_id=excluded.decision_id,outcome=excluded.outcome,detail_json=excluded.detail_json,registered_by=excluded.registered_by,registered_at=excluded.registered_at",
        id, e.chave, companyId, mode, d?.id ?? null, outcome, JSON.stringify(detail), actor.id, now()),
    ]);
    out.push({ key: e.chave, outcome, companyId, ...(outcome === "failed" ? { error: detail.error } : {}) });
  }
  await commit(env, [auditStatement(env, actor, rid, "round.registered", "discovery_round", id, { mode, basis: mode === "accept" ? "decision_accept" : "discovery_mode", operation: op, productId: p.id, created: out.filter((x) => x.outcome === "created").length, existing: out.filter((x) => x.outcome === "already_exists").length, failed: out.filter((x) => x.outcome === "failed").length })]);
  return { mode, productId: p.id, items: out, remaining };
}

// Exportação: configuração, resultados, histórico completo de decisões e cadastros; relatório em markdown.
export async function exportRound(env, actor, id) {
  const r = await roundOf(env, actor, id);
  const config = validated(r.config);
  const results = (await s(env, "SELECT result_json FROM round_establishments WHERE round_id=?", id).all()).results.map((x) => JSON.parse(x.result_json));
  const decisions = (await s(env, "SELECT * FROM round_decisions WHERE round_id=? ORDER BY decided_at", id).all()).results.map((d) => ({ ...d, evidence_json: undefined, snapshot: JSON.parse(d.evidence_json) }));
  const registrations = (await s(env, "SELECT * FROM round_registrations WHERE round_id=?", id).all()).results.map((x) => ({ ...x, detail_json: undefined, detail: parse(x.detail_json), view: registrationView(x) }));
  const annotations = await annotationsOf(env, actor, id);
  const origin = await originFor(env, config);
  const counters = parse(r.last_run_json)?.counters ?? { created: 0, updated: 0, unchanged: 0 };
  const screenings = registrations.length ? await screeningsFor(env, actor, id) : {};
  const regConf = registrations.length ? await registeredConflicts(env, actor, id) : {};
  for (let k = 0; k < results.length; k++) results[k] = withConflicts(results[k], regConf[results[k].key]);
  return { round: { id: r.id, name: r.name, revision: r.config_revision, exportedAt: now() }, config: r.config, preflight: parse(r.preflight_json), results, decisions, registrations, screenings, annotations, report: renderReport({ config, origin, results, counters, screenings, registrations: registrations.map((x) => x.view), annotations }, { title: r.name }) };
}
