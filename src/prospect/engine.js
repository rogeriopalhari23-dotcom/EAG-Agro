// Prospecção automática (2026-10-20): perfil comprador versionado, política de pesquisa de rotina e o motor que executa
// a prospecção em segundo plano, com estado persistente, espera por limite de fonte, pausa, cancelamento e retomada.
//
// O motor não reimplementa regras: cada etapa chama as rotas existentes do Compass (rodadas, análise de país, seleção,
// busca de empresas, descoberta, triagem), com a identidade de quem iniciou a prospecção e a procedência declarada
// "automation" + a política vigente como autorização. Assim valem as mesmas validações, bloqueios e auditoria do uso
// manual. Nada aqui faz contato, aprova ficha, ativa campanha, libera canal ou envia mensagem.
import { bodyJson, fail, str, oneOf, number, requireRole, WRITE_ROLES, APPROVER_ROLES } from "../http.js";
import { statement as s, commit, auditStatement, now, product, parameters } from "../store.js";
import { SEGMENT_PRESETS } from "../rodada/segments.js";
import { provenanceHeaders } from "../provenance.js";
import { DEFAULT_PROFILE, POLICY_TEMPLATE, uncoveredLimitations, AMENDMENT } from "./defaults.js";
import { readCompanySite } from "./site.js";
import { commodityLabelOf } from "../catalog-names.js";
import { fetchAbicRoasters } from "../adapters/abic.js";
import { nationalSources, foreignSources, inventory } from "../sources-applicable.js";
import { countryIndicators, requestCountryList } from "../trade-list.js";
const ADMIN_ROLES = new Set(["admin"]);
// Produto com o nome da commodity da lista única do catálogo.
const productL = async (env, tenant, id) => {
  const p = await product(env, tenant, id);
  return { ...p, commodityLabel: await commodityLabelOf(env, tenant, p.commodity) };
};

export const EXECUTOR = "Compass — prospecção automática (segundo plano)";
const LEASE_MS = 90_000;
const BUDGET_MS = 20_000;
const WAIT_LIMIT_MS = 70_000; // limite por minuto das fontes cadastrais: espera e retoma sozinha
const MAX_CYCLES = 80; // execuções do motor por prospecção (evita consulta sem fim)
const MAX_SOURCE_RETRIES = 2;
const SITES_PER_CYCLE = 6; // leitura de sites por ciclo (baixo volume; o resto no ciclo seguinte)
const SIZES = new Set(["micro", "small", "medium", "large", "unknown"]);
const STEP_LABELS = {
  plan: "Segmentos, fontes e configuração",
  discover: "Descoberta de candidatas",
  conciliate: "Conciliação pelo site da empresa (CNPJ e canal publicados)",
  lookup: "Consulta cadastral (Receita), deduplicação e reaproveitamento",
  analysis: "Indicadores oficiais do país",
  select: "Seleção da commodity e autorização da busca (R12.7)",
  authorize: "Busca de empresas no país",
  accept: "Aceite das candidatas com identificação suficiente",
  register: "Triagem de sanções e cadastro em descoberta",
  evidence: "Evidências e canais publicados",
  priority: "Compatibilidade e prioridade",
  report: "Relatório",
};
export const FLOW = {
  national: ["plan", "discover", "conciliate", "lookup", "register", "evidence", "priority", "report"],
  international: ["plan", "analysis", "select", "authorize", "discover", "accept", "register", "evidence", "priority", "report"],
};

const parse = (t, d = null) => { try { return t ? JSON.parse(t) : d; } catch { return d; } };
const addMs = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();
const slug = (x) => String(x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const varietyOf = (p) => (/n[ãa]o[- ]?gmo/i.test(p.variant_name) ? "não GMO" : /\bgmo\b/i.test(p.variant_name) ? "GMO" : undefined);
// Nome da commodity: o mesmo da lista única do catálogo (src/catalog-names.js), guardado na criação da prospecção.
const commodityLabel = (p) => p.commodityLabel ?? p.display_name ?? p.group_name ?? p.commodity;

// ---------------------------------------------------------------- perfil comprador
export async function currentProfile(env, tenant) {
  const row = await s(env, "SELECT * FROM prospect_profiles WHERE tenant_id=? ORDER BY version DESC LIMIT 1", tenant).first();
  return row ? { id: row.id, version: row.version, profile: parse(row.profile_json), reason: row.reason, createdBy: row.created_by, createdAt: row.created_at } : null;
}
async function ensureProfile(env, actor, rid) {
  const cur = await currentProfile(env, actor.tenant_id);
  if (cur) return cur;
  const id = crypto.randomUUID(), at = now();
  await commit(env, [
    s(env, "INSERT INTO prospect_profiles(id,tenant_id,version,profile_json,reason,created_by,created_at) VALUES (?,?,1,?,?,?,?)", id, actor.tenant_id, JSON.stringify(DEFAULT_PROFILE), "Perfil inicial: decisões vigentes do projeto (ICP do método e regras do Compass).", actor.id, at),
    auditStatement(env, actor, rid, "prospect_profile.created", "prospect_profile", id, { version: 1 }),
  ]);
  return currentProfile(env, actor.tenant_id);
}
function validateProfile(p) {
  if (!p || typeof p !== "object") fail(422, "invalid_profile", "Perfil ausente.");
  const order = p.sizes?.order;
  if (!Array.isArray(order) || !order.length || !order.every((x) => SIZES.has(x))) fail(422, "invalid_profile", "Informe a ordem de porte com micro, small, medium, large ou unknown.");
  if (!Array.isArray(p.roles?.priority) || !p.roles.priority.length) fail(422, "invalid_profile", "Informe a prioridade de perfis compradores.");
  if (p.segmentsByCommodity != null && (typeof p.segmentsByCommodity !== "object" || Array.isArray(p.segmentsByCommodity))) fail(422, "invalid_profile", "segmentsByCommodity deve ser um objeto por commodity.");
  for (const m of ["national", "international"]) if (!Array.isArray(p.sources?.[m])) fail(422, "invalid_profile", `Informe as fontes de ${m}.`);
  return p;
}
export async function getProfile(env, actor) {
  const cur = await currentProfile(env, actor.tenant_id);
  const history = (await s(env, "SELECT version,reason,created_by,created_at FROM prospect_profiles WHERE tenant_id=? ORDER BY version DESC LIMIT 20", actor.tenant_id).all()).results;
  return { current: cur ?? { id: null, version: 0, profile: DEFAULT_PROFILE, reason: "Padrão do Compass (ainda não registrado)" }, history, segmentPresets: SEGMENT_PRESETS };
}
export async function saveProfile(request, env, actor, rid) {
  requireRole(actor, APPROVER_ROLES);
  const i = await bodyJson(request);
  const profile = validateProfile(i.profile);
  const reason = str(i.reason, "motivo da alteração", 500);
  const cur = await currentProfile(env, actor.tenant_id);
  if ((cur?.version ?? 0) !== (i.expectedVersion ?? 0)) fail(409, "version_conflict", "O perfil mudou desde a última leitura.");
  const id = crypto.randomUUID(), version = (cur?.version ?? 0) + 1;
  await commit(env, [
    s(env, "INSERT INTO prospect_profiles(id,tenant_id,version,profile_json,reason,created_by,created_at) VALUES (?,?,?,?,?,?,?)", id, actor.tenant_id, version, JSON.stringify(profile), reason, actor.id, now()),
    auditStatement(env, actor, rid, "prospect_profile.version_created", "prospect_profile", id, { version, reason }),
  ]);
  return { id, version };
}

// ---------------------------------------------------------------- política de pesquisa de rotina
export async function currentPolicy(env, tenant) {
  const row = await s(env, "SELECT * FROM research_policies WHERE tenant_id=? ORDER BY version DESC LIMIT 1", tenant).first();
  if (!row || row.revoked_at) return null;
  return { id: row.id, version: row.version, policy: parse(row.policy_json), reference: row.reference, grantedBy: row.granted_by, grantedAt: row.granted_at };
}
export async function getPolicy(env, actor) {
  const history = (await s(env, "SELECT id,version,reference,granted_by,granted_at,revoked_by,revoked_at,revoke_reason FROM research_policies WHERE tenant_id=? ORDER BY version DESC LIMIT 20", actor.tenant_id).all()).results;
  return { current: await currentPolicy(env, actor.tenant_id), template: POLICY_TEMPLATE, history };
}
export async function grantPolicy(request, env, actor, rid) {
  requireRole(actor, APPROVER_ROLES);
  const i = await bodyJson(request);
  if (i.confirm !== true) fail(422, "confirmation_required", "Confirme a concessão da política de pesquisa de rotina.");
  const reference = str(i.reference, "referência da decisão", 400);
  const t = POLICY_TEMPLATE;
  const admin = actor.role === "admin";
  const policy = {
    ...t,
    maxRadiusKm: i.maxRadiusKm != null ? number(i.maxRadiusKm, "raio máximo", 1, 5000) : t.maxRadiusKm,
    markets: i.markets ? i.markets.map((m) => oneOf(m, ["national", "international"], "mercado")) : t.markets,
    paidSources: [],
    // R12.15: o pedido de indicadores fora do ciclo é do Administrador; concedida por gestor, a política não o inclui.
    indicators: admin && t.indicators === true,
    grantedByRole: actor.role,
    covers: [...t.covers, ...(admin && t.indicators ? ["pedido dos indicadores oficiais de país sem lista mensal (R12.15; gratuito, no orçamento diário, um por país por dia)"] : [])],
  };
  if (Array.isArray(i.paidSources) && i.paidSources.length) fail(422, "paid_not_allowed", "Fontes pagas não entram na política de rotina: exigem orçamento autorizado à parte.");
  const last = await s(env, "SELECT MAX(version) v FROM research_policies WHERE tenant_id=?", actor.tenant_id).first();
  const id = crypto.randomUUID(), version = (last?.v ?? 0) + 1, at = now();
  await commit(env, [
    s(env, "INSERT INTO research_policies(id,tenant_id,version,policy_json,reference,granted_by,granted_at) VALUES (?,?,?,?,?,?,?)", id, actor.tenant_id, version, JSON.stringify(policy), reference, actor.id, at),
    auditStatement(env, actor, rid, "research_policy.granted", "research_policy", id, { version, reference, markets: policy.markets, maxRadiusKm: policy.maxRadiusKm }),
  ]);
  return { id, version, grantedAt: at };
}
export async function revokePolicy(request, env, actor, rid) {
  requireRole(actor, APPROVER_ROLES);
  const i = await bodyJson(request);
  const cur = await currentPolicy(env, actor.tenant_id);
  if (!cur) fail(409, "no_policy", "Não há política vigente.");
  const reason = str(i.reason, "motivo", 500);
  await commit(env, [
    s(env, "UPDATE research_policies SET revoked_by=?,revoked_at=?,revoke_reason=? WHERE id=?", actor.id, now(), reason, cur.id),
    auditStatement(env, actor, rid, "research_policy.revoked", "research_policy", cur.id, { version: cur.version, reason }),
  ]);
  return { revoked: cur.id };
}
const policyAuth = (pol) => (pol ? { reference: `Política de pesquisa de rotina v${pol.version} (${pol.id}): ${pol.reference}`, grantedBy: pol.grantedBy, grantedAt: pol.grantedAt.slice(0, 10) } : null);

// ---------------------------------------------------------------- prospecções
function jobView(j, events = []) {
  const state = parse(j.state_json, {});
  const flow = FLOW[j.market];
  return {
    id: j.id, market: j.market, name: j.name, input: parse(j.input_json, {}), status: j.status, step: j.step,
    stepLabel: STEP_LABELS[j.step] ?? j.step, steps: flow.map((k) => ({ key: k, label: STEP_LABELS[k], state: state.steps?.[k] ?? "todo" })),
    roundId: j.round_id, profileId: j.profile_id, policyId: j.policy_id, nextRunAt: j.next_run_at, cycles: j.cycles, error: j.error,
    waitingFor: state.waitingFor ?? null, decision: state.decision ?? null, summary: parse(j.summary_json), refs: state.refs ?? {},
    createdBy: j.created_by, createdAt: j.created_at, updatedAt: j.updated_at, finishedAt: j.finished_at,
    events: events.map((e) => ({ at: e.at, step: e.step, stepLabel: STEP_LABELS[e.step] ?? e.step, outcome: e.outcome, message: e.message, detail: parse(e.detail_json) })),
  };
}
export async function listJobs(env, actor) {
  const rows = (await s(env, "SELECT * FROM prospect_jobs WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50", actor.tenant_id).all()).results;
  return { items: rows.map((j) => jobView(j)) };
}
async function jobOf(env, tenant, id) {
  const j = await s(env, "SELECT * FROM prospect_jobs WHERE tenant_id=? AND id=?", tenant, id).first();
  if (!j) fail(404, "job_not_found", "Prospecção não encontrada.");
  return j;
}
export async function getJob(env, actor, id) {
  const j = await jobOf(env, actor.tenant_id, id);
  const ev = (await s(env, "SELECT * FROM prospect_job_events WHERE job_id=? ORDER BY at, rowid", id).all()).results;
  return jobView(j, ev);
}
const event = (env, jobId, at, step, outcome, message, detail) =>
  s(env, "INSERT INTO prospect_job_events(id,job_id,at,step,outcome,message,detail_json) VALUES (?,?,?,?,?,?,?)", crypto.randomUUID(), jobId, at, step, outcome, String(message).slice(0, 1000), detail ? JSON.stringify(detail).slice(0, 8000) : null);

// POST /api/prospect/jobs — o que a pessoa informa: produto do catálogo, mercado, local e alcance.
export async function createJob(request, env, actor, rid, deps = {}) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request);
  const market = oneOf(i.market, ["national", "international"], "mercado");
  const p = await productL(env, actor.tenant_id, str(i.productId, "produto", 80));
  if (!p.active) fail(422, "product_inactive", "Produto inativo.");
  const input = { productId: p.id, commodity: p.commodity, product: p.variant_name };
  if (market === "national") {
    const l = i.location ?? {};
    input.location = { country: "BR", region: str(l.region, "estado", 2).toUpperCase(), municipality: str(l.municipality, "cidade", 120), ...(l.municipalityCode ? { municipalityCode: String(l.municipalityCode) } : {}) };
    input.radius = { value: number(i.radius?.value, "raio", 1, 5000), unit: oneOf(i.radius?.unit ?? "km", ["km", "mi"], "unidade") };
  } else {
    const iso3 = str(i.location?.iso3, "país", 3).toUpperCase();
    const c = await s(env, "SELECT iso3,iso2,name_pt FROM countries WHERE iso3=?", iso3).first();
    if (!c) fail(422, "country_not_found", "País não encontrado na base de países.");
    input.location = { iso3: c.iso3, iso2: c.iso2, country: c.name_pt };
    if (i.hs6 != null) input.hs6 = [str(i.hs6, "código HS", 6)];
  }
  // Pesquisa igual ainda em andamento (inclusive aguardando dados ou decisão): reaproveita a mesma, sem duplicar.
  const same = (await s(env, "SELECT id,input_json FROM prospect_jobs WHERE tenant_id=? AND market=? AND status IN ('queued','running','waiting','needs_decision','paused')", actor.tenant_id, market).all()).results.find((r) => {
    const x = parse(r.input_json, {});
    return x.productId === input.productId && JSON.stringify(x.location) === JSON.stringify(input.location) && JSON.stringify(x.radius ?? null) === JSON.stringify(input.radius ?? null);
  });
  if (same) return { ...(await getJob(env, actor, same.id)), reused: true };
  const profile = await ensureProfile(env, actor, rid);
  const policy = await currentPolicy(env, actor.tenant_id);
  const where = market === "national" ? `${input.location.municipality}/${input.location.region}, ${input.radius.value} ${input.radius.unit}` : input.location.country;
  const name = `${commodityLabel(p)}${varietyOf(p) ? ` ${varietyOf(p)}` : ""} — ${where}`;
  const id = crypto.randomUUID(), at = now();
  await commit(env, [
    s(env, "INSERT INTO prospect_jobs(id,tenant_id,market,name,input_json,profile_id,policy_id,status,step,state_json,next_run_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued','plan','{}',?,?,?,?)", id, actor.tenant_id, market, name, JSON.stringify(input), profile.id, policy?.id ?? null, at, actor.id, at, at),
    event(env, id, at, "plan", "ok", `Prospecção iniciada (${market === "national" ? "nacional" : "internacional"}): ${name}. Perfil comprador v${profile.version}${policy ? `; política de pesquisa v${policy.version}` : "; sem política de pesquisa vigente"}.`),
    auditStatement(env, actor, rid, "prospect_job.created", "prospect_job", id, { market, productId: p.id, input, profileVersion: profile.version, policyVersion: policy?.version ?? null }),
  ]);
  await enqueue(env, id);
  return getJob(env, actor, id);
}
async function enqueue(env, id, delaySeconds) {
  if (!env.ASYNC_QUEUE) return;
  try {
    await env.ASYNC_QUEUE.send({ type: "prospect_job", jobId: id }, delaySeconds ? { delaySeconds } : undefined);
  } catch (e) {
    // Sem fila, o cron de 5 minutos retoma pelo next_run_at; nada se perde.
    console.error("prospect_enqueue_failed", { id });
  }
}

// Pausar, retomar, cancelar e seguir sem a busca no mapa: decisão da pessoa, registrada como tal.
export async function controlJob(request, env, actor, rid, id, action) {
  requireRole(actor, WRITE_ROLES);
  const j = await jobOf(env, actor.tenant_id, id);
  const at = now();
  const state = parse(j.state_json, {});
  const done = ["done", "cancelled", "failed"].includes(j.status);
  let status = j.status, next = j.next_run_at, msg;
  if (action === "pause") {
    if (done || j.status === "paused") fail(409, "job_not_running", "A prospecção não está em andamento.");
    (status = "paused"), (next = null), (msg = "Pausada pela pessoa.");
  } else if (action === "resume") {
    if (!["paused", "needs_decision", "waiting"].includes(j.status)) fail(409, "job_not_paused", "Nada a retomar.");
    // Retomar uma decisão pendente refaz a etapa: a política nova (ou a configuração ajustada) é conferida de novo.
    const policy = await currentPolicy(env, actor.tenant_id);
    if (j.status === "needs_decision") delete state.decision;
    await commit(env, [s(env, "UPDATE prospect_jobs SET policy_id=? WHERE id=?", policy?.id ?? j.policy_id, id)]);
    (status = "queued"), (next = at), (msg = "Retomada pela pessoa.");
  } else if (action === "cancel") {
    if (done) fail(409, "job_finished", "A prospecção já terminou.");
    (status = "cancelled"), (next = null), (msg = "Cancelada pela pessoa; o que já foi cadastrado permanece, com rastreio.");
  } else if (action === "skip-browser") {
    if (state.waitingFor !== "browser_osm") fail(409, "not_waiting_browser", "A prospecção não está aguardando a busca no mapa.");
    state.osm = "skipped";
    delete state.waitingFor;
    (status = "queued"), (next = at), (msg = "Seguir sem a busca no mapa (decisão da pessoa).");
  }
  await commit(env, [
    s(env, "UPDATE prospect_jobs SET status=?,next_run_at=?,state_json=?,updated_at=?,finished_at=? WHERE id=?", status, next, JSON.stringify(state), at, status === "cancelled" ? at : j.finished_at, id),
    event(env, id, at, j.step, action === "cancel" ? "skipped" : "decision", msg),
    auditStatement(env, actor, rid, `prospect_job.${action.replace("-", "_")}`, "prospect_job", id, { fromStatus: j.status }),
  ]);
  if (status === "queued") await enqueue(env, id);
  return getJob(env, actor, id);
}

// POST /api/prospect/jobs/:id/act { action } — a pessoa executa a ação concreta indicada na pendência (seleção e
// autorização R12.7, ciência das limitações, aceite das candidatas, pedido dos indicadores ou nova verificação). Cada
// chamada usa a identidade da pessoa e o canal do painel; nada é atribuído à política. Depois, a prospecção retoma.
export async function actOnJob(request, env, actor, rid, id, call) {
  requireRole(actor, WRITE_ROLES);
  const j = await jobOf(env, actor.tenant_id, id);
  const state = parse(j.state_json, {});
  const i = await bodyJson(request);
  const act = state.decision?.action;
  if (j.status !== "needs_decision" || !act || act.id !== i.action) fail(409, "action_not_pending", "Esta ação não está pendente nesta prospecção.");
  const need = { approver: APPROVER_ROLES, admin: ADMIN_ROLES, write: WRITE_ROLES }[act.roles] ?? WRITE_ROLES;
  requireRole(actor, need);
  const input = parse(j.input_json, {});
  const panel = provenanceHeaders({ channel: "panel", executor: `${actor.display_name ?? actor.email ?? actor.id} (ação na prospecção)` });
  const must = (res, what) => {
    if (res.status >= 300) fail(res.status, res.data?.error?.code ?? "action_failed", `${what}: ${res.data?.error?.message ?? `HTTP ${res.status}`}`);
    return res.data;
  };
  let note;
  if (act.id === "select_authorize") {
    if (!state.campaignId) {
      const p = await productL(env, actor.tenant_id, input.productId);
      const sel = must(await call(actor, `/api/country-analyses/${state.analysisId}/selections`, "POST", { items: [{ productId: p.id, label: commodityLabel(p), hs6: state.hs6 }] }, panel), "Seleção recusada");
      state.campaignId = sel.campaigns[0].id;
    }
    if (!state.searchId) {
      const prof = (await s(env, "SELECT profile_json FROM prospect_profiles WHERE id=?", j.profile_id).first())?.profile_json;
      const sizes = (parse(prof, DEFAULT_PROFILE).sizes?.order ?? []).filter((x) => ["small", "medium"].includes(x));
      const a = must(await call(actor, `/api/campaigns/${state.campaignId}/foreign-search`, "POST", { confirm: true, targetSizes: sizes.length ? sizes : ["small", "medium"], note: "Autorizada pela pessoa na prospecção (R12.7)." }, panel), "Busca não autorizada");
      state.searchId = a.id;
    }
    state.refs = { ...(state.refs ?? {}), campaignId: state.campaignId, searchId: state.searchId };
    state.steps = { ...state.steps, select: "done", authorize: "done" };
    note = "Seleção da commodity e autorização da busca registradas pela pessoa (R12.7).";
  } else if (act.id === "accept_candidates") {
    const ids = (act.ids ?? []).slice(0, 500);
    let accepted = 0;
    for (let k = 0; k < ids.length; k += 100) accepted += must(await call(actor, `/api/foreign-searches/${state.searchId}/discovery/accept`, "POST", { ids: ids.slice(k, k + 100) }, panel), "Cadastro recusado").accepted ?? 0;
    note = `${accepted} candidata(s) aceita(s) pela pessoa e cadastrada(s) em descoberta.`;
  } else if (act.id === "ack_limitations") {
    const r = must(await call(actor, `/api/rounds/${j.round_id}`, "GET", undefined, panel), "Rodada");
    must(await call(actor, `/api/rounds/${j.round_id}/preflight-ack`, "POST", { revision: r.revision }, panel), "Ciência recusada");
    note = "Ciência das limitações registrada pela pessoa.";
  } else if (act.id === "request_indicators") {
    const r = await requestCountryList(env, actor.tenant_id, input.location.iso3, { requestedBy: actor.id, reason: `Pedido na prospecção "${j.name}": país sem lista mensal ou com falha`, actor, rid });
    state.indicatorRequests = (state.indicatorRequests ?? 0) + (r.reused ? 0 : 1);
    delete state.indicators;
    note = r.reused ? "Geração dos indicadores já pedida hoje: acompanhando a mesma versão." : "Geração dos indicadores pedida pela pessoa (R12.15).";
  } else if (act.id === "retry") {
    note = "Nova verificação pedida pela pessoa.";
  } else fail(422, "action_not_supported", "Ação sem execução pelo servidor (abra a tela indicada).");
  delete state.decision;
  const at = now();
  const policy = await currentPolicy(env, actor.tenant_id);
  const nextStep = act.id === "select_authorize" ? "discover" : j.step;
  await commit(env, [
    s(env, "UPDATE prospect_jobs SET status='queued',step=?,next_run_at=?,state_json=?,policy_id=?,updated_at=? WHERE id=?", nextStep, at, JSON.stringify(state), policy?.id ?? j.policy_id, at, id),
    event(env, id, at, j.step, "decision", `${note} (${act.label})`),
    auditStatement(env, actor, rid, "prospect_job.action", "prospect_job", id, { action: act.id, step: j.step }),
  ]);
  await enqueue(env, id);
  return getJob(env, actor, id);
}

// POST /api/prospect/jobs/:id/browser-osm — resposta do OpenStreetMap obtida pelo navegador (o servidor público recusa a
// Cloudflare). Entra pela rota de candidatas da rodada, com canal "panel": foi o navegador que consultou.
export async function browserOsm(request, env, actor, rid, id, call) {
  requireRole(actor, WRITE_ROLES);
  const j = await jobOf(env, actor.tenant_id, id);
  const state = parse(j.state_json, {});
  if (state.waitingFor !== "browser_osm" || !j.round_id) fail(409, "not_waiting_browser", "A prospecção não está aguardando a busca no mapa.");
  const i = await bodyJson(request);
  if (!Array.isArray(i.elements)) fail(422, "invalid_field", "Envie elements da resposta do OpenStreetMap.");
  const res = await call(actor, `/api/rounds/${j.round_id}/candidates`, "POST", { intake: "automatic", source: "osm-overpass", elements: i.elements }, provenanceHeaders({ channel: "panel", executor: "Navegador da pessoa (busca no mapa da prospecção)" }));
  if (res.status >= 300) fail(res.status, res.data?.error?.code ?? "candidates_failed", res.data?.error?.message ?? "Falha ao registrar as candidatas.");
  const at = now();
  state.discovered = (state.discovered ?? 0) + res.data.added;
  if (i.final !== false) {
    state.osm = "browser";
    delete state.waitingFor;
  }
  await commit(env, [
    s(env, "UPDATE prospect_jobs SET status=?,next_run_at=?,state_json=?,updated_at=? WHERE id=?", i.final !== false ? "queued" : j.status, i.final !== false ? at : j.next_run_at, JSON.stringify(state), at, id),
    event(env, id, at, "discover", "ok", `Busca no mapa feita pelo navegador: ${i.elements.length} objetos, ${res.data.added} candidatas novas, ${res.data.duplicates} já existentes.`),
  ]);
  if (i.final !== false) await enqueue(env, id);
  return getJob(env, actor, id);
}

// ---------------------------------------------------------------- execução
// Executa uma prospecção até terminar, precisar esperar (limite de fonte), precisar de decisão ou o tempo do ciclo acabar.
// deps.call(actor, path, method, body, headers): chamada interna às rotas do Compass. deps.fetch: rede (simulável).
export async function runJob(env, jobId, deps = {}) {
  const at0 = deps.now?.() ?? now();
  const token = crypto.randomUUID();
  const lease = await env.DB.prepare(
    "UPDATE prospect_jobs SET lease_until=?, lease_token=?, status=CASE WHEN status='queued' THEN 'running' ELSE status END WHERE id=? AND status IN ('queued','running','waiting') AND (lease_until IS NULL OR lease_until < ?) AND (next_run_at IS NULL OR next_run_at <= ?)",
  ).bind(addMs(at0, LEASE_MS), token, jobId, at0, at0).run();
  if (!lease.meta?.changes) return { skipped: true };
  let j = await s(env, "SELECT * FROM prospect_jobs WHERE id=?", jobId).first();
  const actor = await s(env, "SELECT id,tenant_id,email,display_name,role FROM users WHERE id=? AND status='active'", j.created_by).first();
  const state = parse(j.state_json, {});
  state.steps ??= {};
  const stmts = [];
  const log = (step, outcome, message, detail) => stmts.push(event(env, jobId, deps.now?.() ?? now(), step, outcome, message, detail));
  let status = "running", step = j.step, nextRunAt = null, summary = parse(j.summary_json), error = null;
  if (!actor) {
    log(step, "failed", "A pessoa que iniciou a prospecção não está mais ativa: a execução para.");
    status = "failed";
  } else {
    const policy = await currentPolicy(env, actor.tenant_id);
    const profile = (await s(env, "SELECT * FROM prospect_profiles WHERE id=?", j.profile_id).first()) ?? null;
    const ctx = {
      env, job: j, input: parse(j.input_json, {}), state, policy, profile: profile ? parse(profile.profile_json) : DEFAULT_PROFILE, profileVersion: profile?.version ?? 0,
      fetch: deps.fetch ?? fetch, now: () => deps.now?.() ?? now(), log, actor, deps, amendmentApproved: deps.amendmentApproved ?? AMENDMENT.approved,
      call: (path, method = "GET", body, extra = {}) => deps.call({ ...actor }, path, method, body, { ...provenanceHeaders({ channel: "automation", executor: EXECUTOR, authorization: policyAuth(policy) }), ...extra }),
    };
    const flow = FLOW[j.market];
    const t0 = Date.now();
    try {
      for (;;) {
        if (j.cycles + 1 > MAX_CYCLES) {
          log(step, "pending", "Limite de execuções desta prospecção atingido: para aqui, com o que já foi feito, para não consultar as fontes sem fim.");
          state.steps[step] = "pending";
          step = "report";
        }
        delete state.waitingFor;
        const handler = (j.market === "national" ? NATIONAL : INTERNATIONAL)[step];
        const r = await handler(ctx);
        if (r.decision) {
          state.decision = r.decision;
          state.steps[step] = "decision";
          log(step, "decision", r.decision.message, r.decision.items ? { items: r.decision.items } : undefined);
          status = "needs_decision";
          break;
        }
        if (r.waitFor) {
          if (r.summary) summary = r.summary;
          state.waitingFor = r.waitFor;
          state.steps[step] = "waiting";
          status = "waiting";
          nextRunAt = r.waitMs ? addMs(ctx.now(), r.waitMs) : null;
          break;
        }
        delete state.waitingFor; // a espera terminou: a etapa avançou
        state.steps[step] = r.outcome ?? "done";
        if (r.summary) summary = r.summary;
        if (r.jumpTo) {
          for (const k of flow.slice(flow.indexOf(step) + 1, flow.indexOf(r.jumpTo))) state.steps[k] ??= "skipped";
          step = r.jumpTo;
          continue;
        }
        const idx = flow.indexOf(step);
        if (idx === flow.length - 1) {
          status = "done";
          break;
        }
        step = flow[idx + 1];
        if (Date.now() - t0 > BUDGET_MS) {
          status = "queued";
          nextRunAt = ctx.now();
          break;
        }
      }
    } catch (e) {
      error = String(e?.message ?? e).slice(0, 500);
      log(step, "failed", `Falha inesperada na etapa: ${error}. A prospecção para aqui; o que já foi feito permanece.`);
      state.steps[step] = "failed";
      status = "failed";
    }
  }
  const at = deps.now?.() ?? now();
  // Grava só se o lease ainda é deste ciclo (outra execução concorrente não sobrescreve) e se ninguém pausou/cancelou.
  stmts.push(
    s(env, "UPDATE prospect_jobs SET status=CASE WHEN status IN ('paused','cancelled') THEN status ELSE ? END, step=?, state_json=?, summary_json=?, next_run_at=CASE WHEN status IN ('paused','cancelled') THEN NULL ELSE ? END, lease_until=NULL, lease_token=NULL, cycles=cycles+1, error=?, updated_at=?, finished_at=CASE WHEN ? IN ('done','failed') THEN ? ELSE finished_at END WHERE id=? AND lease_token=?",
      status, step, JSON.stringify(state), summary ? JSON.stringify(summary) : null, nextRunAt, error, at, status, at, jobId, token),
  );
  await commit(env, stmts);
  if (status === "queued") await enqueue(env, jobId);
  else if (status === "waiting" && nextRunAt && env.ASYNC_QUEUE) await enqueue(env, jobId, Math.ceil((Date.parse(nextRunAt) - Date.parse(at)) / 1000));
  return { status, step };
}

// Cron e prévia local: executa as prospecções devidas (poucas por vez).
export async function tick(env, tenant, deps = {}) {
  const at = deps.now?.() ?? now();
  const due = (await s(env, "SELECT id FROM prospect_jobs WHERE tenant_id=? AND status IN ('queued','running','waiting') AND next_run_at IS NOT NULL AND next_run_at<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY next_run_at LIMIT 3", tenant, at, at).all()).results;
  const out = [];
  for (const d of due) out.push(await runJob(env, d.id, deps));
  return out;
}

// ---------------------------------------------------------------- etapas comuns
const ok = (res) => res.status < 300;
const errText = (res) => res.data?.error?.message ?? `HTTP ${res.status}`;
// Códigos SH6 confirmados do produto no catálogo (NCM de 8 dígitos vira o SH6 correspondente). Nada é inventado.
async function confirmedHs(env, productId) {
  const rows = (await s(env, "SELECT code FROM product_codes WHERE product_id=? AND status='confirmed' AND code_system IN ('HS','NCM')", productId).all()).results;
  return [...new Set(rows.map((r) => String(r.code).replace(/\D/g, "").slice(0, 6)).filter((c) => c.length === 6))];
}
// Pedido automático dos indicadores (R12.15: atualização fora do ciclo é do Administrador): só sob política concedida
// por Administrador que inclui esse pedido.
const indicatorsAllowed = (policy) => policy?.policy?.indicators === true && policy?.policy?.grantedByRole === "admin";
// Emenda da prospecção automática (R12.7, ciência e aceite pela política): proposta, não aprovada. Enquanto não for, cada
// um desses passos para numa ação concreta de uma pessoa.
const amendmentOn = (ctx) => ctx.amendmentApproved === true;
const INDICATOR_WAIT = { queued: "indicators_queued", processing: "indicators_processing", waiting_limit: "indicators_limit" };
function needsPolicy(ctx, market) {
  if (!ctx.policy) return { decision: { kind: "authorization", message: "Sem política de pesquisa de rotina vigente: conceda a política (Configurações → Prospecção automática) e retome. Sem ela, a pesquisa segue pelos passos manuais." } };
  if (!ctx.policy.policy.markets.includes(market)) return { decision: { kind: "scope", message: `A política vigente não cobre o mercado ${market === "national" ? "nacional" : "internacional"}.` } };
  return null;
}
const sizeRank = (profile, size) => {
  const order = profile.sizes?.order ?? DEFAULT_PROFILE.sizes.order;
  const i = order.indexOf(size ?? "unknown");
  return i < 0 ? order.length : i;
};

// ---------------------------------------------------------------- nacional (motor de rodadas)
const NATIONAL = {
  async plan(ctx) {
    const gate = needsPolicy(ctx, "national");
    if (gate) return gate;
    const { input, profile, policy, state } = ctx;
    const radiusKm = input.radius.value * (input.radius.unit === "mi" ? 1.609344 : 1);
    if (radiusKm > policy.policy.maxRadiusKm) return { decision: { kind: "scope", message: `Raio de ${Math.round(radiusKm)} km acima do limite da política (${policy.policy.maxRadiusKm} km): mudança material de escopo, exige decisão.` } };
    const p = await productL(ctx.env, ctx.job.tenant_id, input.productId);
    const segments = profile.segmentsByCommodity?.[p.commodity] ?? SEGMENT_PRESETS[p.commodity] ?? {};
    const allowed = profile.sources?.national ?? [];
    // Fontes aplicáveis aos segmentos desta commodity (src/sources-applicable.js); o perfil pode só restringir.
    const applicable = nationalSources(segments);
    const sources = applicable.config.filter((x) => allowed.includes(x.id));
    if (!state.roundId) {
      const config = {
        id: slug(`prospeccao-${p.commodity}-${input.location.municipality}-${input.radius.value}`),
        commodity: { code: p.commodity, label: commodityLabel(p), productId: p.id, ...(varietyOf(p) ? { variety: varietyOf(p) } : {}), segments, nameHints: [], restrictionHints: varietyOf(p) === "não GMO" ? [] : [] },
        buyer: { roles: profile.roles?.priority ?? ["final_consumer", "processor"], separate: profile.roles?.separate ?? ["reseller", "trader"] },
        origin: input.location,
        radius: { value: input.radius.value, unit: input.radius.unit, method: "haversine" },
        nearLimit: { fraction: 0.1 },
        priorities: { size: (profile.sizes?.order ?? []).filter((x) => SIZES.has(x)), segments: [] },
        sources,
        evidence: { confirming: profile.evidence?.confirming ?? ["own_source", "official_record"] },
        locale: { language: "pt-BR", timezone: "America/Sao_Paulo" },
        compliance: { scope: "br_email_automatic" },
      };
      const res = await ctx.call("/api/rounds", "POST", { name: `Prospecção — ${ctx.job.name}`, config });
      if (!ok(res)) return { decision: { kind: "configuration", message: `A rodada não pôde ser configurada: ${errText(res)}`, items: res.data?.error?.details?.ufs ? [`Estados possíveis: ${res.data.error.details.ufs.join(", ")}`] : undefined } };
      state.roundId = res.data.id;
      state.refs = { ...(state.refs ?? {}), roundId: res.data.id };
      await commit(ctx.env, [s(ctx.env, "UPDATE prospect_jobs SET round_id=? WHERE id=?", res.data.id, ctx.job.id)]);
      ctx.log("plan", "ok", `Segmentos: ${Object.values(segments).map((g) => g.label).join(", ") || "nenhum sugerido"}. Fontes aplicáveis: ${applicable.items.filter((x) => x.status === "available").map((x) => x.label).join("; ") || "nenhuma automática"}.${applicable.items.some((x) => x.status === "pending") ? ` Pendentes: ${applicable.items.filter((x) => x.status === "pending").map((x) => `${x.label} (${x.note})`).join("; ")}.` : ""}`, { segments: Object.keys(segments), sources: sources.map((x) => x.id) });
      if (!Object.keys(segments).length) ctx.log("plan", "pending", `Não há segmentos compradores sugeridos para ${commodityLabel(p)}: a busca automática não tem o que procurar. Ajuste o perfil comprador (segmentos por commodity) ou use importação e pesquisa assistida (recursos complementares).`);
    }
    // Limitações. Com a emenda aprovada, a política cobre as já aceitas (ciência registrada como da política). Sem ela, a
    // regra vigente das rodadas pede a ciência de uma pessoa: para numa ação concreta.
    const r = await ctx.call(`/api/rounds/${state.roundId}`);
    if (!amendmentOn(ctx) && r.data.preflight.requiresAcknowledgement && !r.data.acknowledged)
      return { decision: { kind: "limitations_ack", category: "rule", message: "Antes de executar, a regra vigente das rodadas pede a ciência de uma pessoa sobre as limitações desta configuração. A ciência pela política depende da emenda proposta, ainda não aprovada.", items: (r.data.preflight.items ?? []).filter((x) => x.level !== "supported").map((x) => `${x.area}: ${x.message}`), action: { id: "ack_limitations", label: "Registrar ciência das limitações e continuar", roles: "write" } } };
    const uncovered = uncoveredLimitations(r.data.preflight, policy.policy);
    if (uncovered.length) return { decision: { kind: "limitations", message: "A configuração tem limitações que a política de pesquisa não cobre: exigem ciência da pessoa.", items: uncovered.map((x) => `${x.area}: ${x.message}`) } };
    if (r.data.preflight.requiresAcknowledgement && !r.data.acknowledged) {
      const ack = await ctx.call(`/api/rounds/${state.roundId}/preflight-ack`, "POST", { revision: r.data.revision, policyId: policy.id });
      if (!ok(ack)) return { decision: { kind: "limitations", message: `Ciência pela política recusada: ${errText(ack)}` } };
      ctx.log("plan", "ok", `Limitações conhecidas cobertas pela política de pesquisa v${policy.version} (ciência registrada como da política, não como clique).`);
    }
    return {};
  },
  async discover(ctx) {
    const { state } = ctx;
    const r = await ctx.call(`/api/rounds/${state.roundId}`);
    const ids = (r.data.config.sources ?? []).map((x) => x.id);
    state.coverage ??= {};
    // ABIC (café): lista pública de torrefadoras certificadas, filtrada pelos estados da área da rodada.
    if (ids.includes("abic-certificados") && !state.coverage["abic-certificados"]) {
      try {
        const area = await ctx.call(`/api/rounds/${state.roundId}/area`);
        const ufs = new Set(area.data?.summary?.regions ?? []);
        const all = await fetchAbicRoasters(ctx.fetch);
        const inArea = all.filter((x) => ufs.has(x.uf));
        if (inArea.length) {
          const res = await ctx.call(`/api/rounds/${state.roundId}/candidates`, "POST", { intake: "automatic", source: "abic-certificados", candidates: inArea.map((x) => ({ name: x.name, uf: x.uf, products: x.products })) });
          if (!ok(res)) throw new Error(errText(res));
          state.discovered = (state.discovered ?? 0) + res.data.added;
        }
        state.abicNames = inArea.map((x) => x.name);
        state.coverage["abic-certificados"] = { status: inArea.length ? "ok" : "empty", count: inArea.length, note: `${inArea.length} de ${all.length} torrefadoras certificadas estão nos estados da área (${[...ufs].join(", ")}); a lista traz só nome e estado: município e CNPJ a identificar` };
        ctx.log("discover", inArea.length ? "ok" : "partial", `ABIC (lista pública de torrefadoras certificadas): ${state.coverage["abic-certificados"].note}.`);
      } catch (e) {
        state.coverage["abic-certificados"] = { status: "unavailable", count: 0, note: e.message };
        ctx.log("discover", "pending", `ABIC indisponível: ${e.message}. Fonte pendente; as demais seguem.`);
      }
    }
    const hasOsm = ids.includes("osm-overpass");
    if (!hasOsm) {
      if (!ids.includes("abic-certificados")) ctx.log("discover", "pending", "Nenhuma fonte de descoberta automática aplicável a esta commodity no Brasil. Candidatas por importação ou pesquisa assistida, fora do percurso principal.");
      return { outcome: ids.includes("abic-certificados") ? "partial" : "pending" };
    }
    if (["server", "browser", "skipped"].includes(state.osm)) return {};
    const q = await ctx.call(`/api/rounds/${state.roundId}/osm-query`);
    if (!ok(q)) {
      ctx.log("discover", "failed", `Consulta ao mapa não montada: ${errText(q)}`);
      return { outcome: "pending" };
    }
    let res, status = null;
    try {
      res = await ctx.fetch(q.data.endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "eag-compass-prospeccao (uso pessoal, baixo volume)" }, body: `data=${encodeURIComponent(q.data.query)}`, signal: AbortSignal.timeout?.(60_000) });
      status = res.status;
    } catch (e) {
      status = e?.name === "TimeoutError" ? "timeout" : "rede";
    }
    if (res?.ok) {
      const data = await res.json();
      const els = (data.elements ?? []).map((e) => ({ type: e.type, id: e.id, lat: e.lat, lon: e.lon, center: e.center, tags: e.tags }));
      let added = 0, dup = 0, part = [];
      const flush = async () => {
        if (!part.length) return;
        const x = await ctx.call(`/api/rounds/${state.roundId}/candidates`, "POST", { intake: "automatic", source: "osm-overpass", elements: part });
        if (ok(x)) (added += x.data.added), (dup += x.data.duplicates);
        part = [];
      };
      for (const e of els) {
        if (JSON.stringify(part).length + JSON.stringify(e).length > 45000) await flush();
        part.push(e);
      }
      await flush();
      state.osm = "server";
      state.discovered = (state.discovered ?? 0) + added;
      state.coverage["osm-overpass"] = { status: els.length ? "ok" : "empty", count: els.length, note: els.length ? `${added} candidatas novas` : "nenhum estabelecimento com as etiquetas do segmento nesta consulta (não prova ausência de compradores)" };
      ctx.log("discover", els.length ? "ok" : "partial", els.length ? `Mapa colaborativo (pelo servidor): ${els.length} objetos, ${added} candidatas novas, ${dup} já existentes. Indício: provisórias até a consulta cadastral.` : "Mapa colaborativo: nenhum estabelecimento com as etiquetas do segmento nesta consulta. Isso não prova que não há compradores; as outras fontes seguem.");
      return {};
    }
    // 429/504/rede: tenta de novo poucas vezes; recusa da Cloudflare (521/522/403) não adianta repetir pelo servidor.
    state.osmRetries = (state.osmRetries ?? 0) + 1;
    if ([429, 502, 503, 504, "timeout", "rede"].includes(status) && state.osmRetries <= MAX_SOURCE_RETRIES) {
      ctx.log("discover", "waiting", `Mapa colaborativo indisponível (${status}); nova tentativa automática em 2 minutos (${state.osmRetries}/${MAX_SOURCE_RETRIES}).`);
      return { waitFor: "source_retry", waitMs: 120_000 };
    }
    state.coverage["osm-overpass"] = { status: "unavailable", count: 0, note: `recusou o servidor (${status}); depende do navegador` };
    ctx.log("discover", "pending", `O servidor público do mapa colaborativo recusou o servidor do Compass (${status}). Esta busca depende do navegador: ao abrir a prospecção, o painel faz a consulta e o restante continua no servidor. Também é possível seguir sem ela.`);
    return { waitFor: "browser_osm" };
  },
  async conciliate(ctx) {
    const { state, env } = ctx;
    // Candidatas provisórias com site publicado (vindo do mapa): lê o site e traz o CNPJ publicado, com a página como fonte.
    const rows = (await s(env, "SELECT payload_json FROM round_candidates WHERE round_id=?", state.roundId).all()).results.map((x) => parse(x.payload_json, {}));
    const bySite = new Map();
    for (const c of rows) if (!c.registrationId && c.hints?.website) bySite.set(c.hints.website, c);
    state.sites ??= {};
    const todo = [...bySite.entries()].filter(([w]) => !state.sites[w]);
    if (!bySite.size) {
      ctx.log("conciliate", "skipped", "Nenhuma candidata provisória com site publicado: nada a conciliar pelo site.");
      return { outcome: "skipped" };
    }
    const batch = todo.slice(0, SITES_PER_CYCLE);
    const found = [];
    for (const [website, c] of batch) {
      const r = await readCompanySite(website, ctx.fetch);
      state.sites[website] = { pages: r.pages.length, cnpjs: r.cnpjs, emails: r.emails, pending: r.pending ?? null };
      for (const cnpj of r.cnpjs.slice(0, 3)) found.push({ name: c.name, registrationId: cnpj, website, sourceUrl: r.pages[0] });
    }
    if (found.length) {
      const res = await ctx.call(`/api/rounds/${state.roundId}/candidates`, "POST", { intake: "automatic", source: "company-site", candidates: found });
      if (!ok(res)) ctx.log("conciliate", "failed", `Registro do CNPJ lido no site recusado: ${errText(res)}`);
    }
    const read = batch.filter(([w]) => state.sites[w].cnpjs.length).length;
    ctx.log("conciliate", read ? "ok" : "partial", `Sites lidos: ${batch.length} (CNPJ publicado em ${read}; e-mail geral em ${batch.filter(([w]) => state.sites[w].emails.length).length}). ${batch.filter(([w]) => state.sites[w].pending).map(([w]) => `${new URL(/^https?:/.test(w) ? w : "https://" + w).host}: ${state.sites[w].pending}`).join("; ")}`.trim());
    if (todo.length > batch.length) return { waitFor: "sites", waitMs: 5_000 };
    return { outcome: "done" };
  },
  async lookup(ctx) {
    const { state } = ctx;
    const r = await ctx.call(`/api/rounds/${state.roundId}`);
    if (!r.data.candidates.length) {
      ctx.log("lookup", "skipped", "Sem candidatas: nada a consultar.");
      return { outcome: "skipped" };
    }
    const run = await ctx.call(`/api/rounds/${state.roundId}/run`, "POST", {});
    if (!ok(run)) {
      ctx.log("lookup", "failed", `Execução recusada: ${errText(run)}`);
      return { outcome: "pending" };
    }
    const lk = run.data.lookups ?? {};
    state.lookupRuns = (state.lookupRuns ?? 0) + 1;
    const deferred = run.data.deferred ?? lk.deferred ?? 0;
    ctx.log("lookup", deferred ? "waiting" : "ok", `Execução ${state.lookupRuns}: ${run.data.total} estabelecimentos (novos ${run.data.counters.created}, alterados ${run.data.counters.updated}); consultas feitas ${lk.fetched ?? 0}, reaproveitadas ${lk.cached ?? 0}, adiadas ${deferred}, com falha ${lk.failed ?? 0}.`, { lookups: lk, total: run.data.total, review: run.data.review });
    if (deferred && state.lookupRuns < 40) return { waitFor: "rate_limit", waitMs: WAIT_LIMIT_MS };
    if (deferred) ctx.log("lookup", "pending", `${deferred} consulta(s) ainda adiada(s) depois de ${state.lookupRuns} execuções: ficam como pendência.`);
    return { outcome: lk.failed ? "partial" : "done" };
  },
  async register(ctx) {
    const { state, policy } = ctx;
    if (!policy.policy.autoRegisterDiscovery) {
      ctx.log("register", "pending", "A política não inclui cadastro em descoberta: cadastre pela rodada.");
      return { outcome: "pending" };
    }
    const r = await ctx.call(`/api/rounds/${state.roundId}`);
    if (!r.data.results.length) return { outcome: "skipped" };
    const items = [];
    for (let k = 0; k < 20; k++) {
      const part = await ctx.call(`/api/rounds/${state.roundId}/register`, "POST", { mode: "discovery", productId: ctx.input.productId, screening: !!policy.policy.autoScreening });
      if (!ok(part)) {
        ctx.log("register", "failed", `Cadastro recusado: ${errText(part)}`);
        return { outcome: "pending" };
      }
      items.push(...part.data.items);
      if (!part.data.remaining) break;
    }
    const n = (k) => items.filter((x) => x.outcome === k).length;
    ctx.log("register", n("failed") ? "partial" : "ok", `Cadastro em descoberta: ${n("created")} criada(s), ${n("already_exists")} já existiam (reaproveitadas), ${n("failed")} falha(s). Exceções e conferências ficam na fila de revisão. ${policy.policy.autoScreening ? "Triagem de sanções executada junto." : "Sem triagem automática."} Nenhum contato, ficha ou envio criado.`);
    return { outcome: n("failed") ? "partial" : "done" };
  },
  async evidence(ctx) {
    const { state } = ctx;
    const r = await ctx.call(`/api/rounds/${state.roundId}`);
    const res = r.data.results;
    const proved = res.filter((x) => x.assessment?.commodityUse?.status === "proved").length;
    const purchase = res.filter((x) => x.assessment?.purchase?.status === "proved").length;
    // Canal geral lido no site da empresa (mesmo CNPJ): registrado na empresa cadastrada, com a página como fonte.
    const byCnpj = new Map();
    for (const v of Object.values(state.sites ?? {})) for (const c of v.cnpjs) byCnpj.set(c, v.emails);
    state.channels ??= {};
    let added = 0, without = 0;
    for (const x of res.filter((y) => y.registration?.company_id)) {
      const emails = byCnpj.get(String(x.registrationId ?? "").replace(/\D/g, "")) ?? [];
      if (!emails.length) { without++; continue; }
      for (const e of emails.slice(0, 2)) {
        const k = `${x.registration.company_id}|${e.email}`;
        if (state.channels[k]) continue;
        const c = await ctx.call(`/api/companies/${x.registration.company_id}/channels`, "POST", { email: e.email, sourceUrl: e.url, sourceKind: "company_site" });
        state.channels[k] = ok(c) ? "added" : c.data?.error?.code === "channel_duplicate" ? "exists" : "failed";
        if (ok(c)) added++;
      }
    }
    ctx.log("evidence", without ? "partial" : "ok", `Evidências das fontes: uso da commodity comprovado em ${proved}, compra de terceiros comprovada em ${purchase} de ${res.length} (atividade registrada não comprova consumo). Canal geral publicado no site registrado em ${added} empresa(s); ${without} sem canal encontrado (pendência). Canal registrado não autoriza contato.`);
    return { outcome: without ? "partial" : "done" };
  },
  async priority(ctx) {
    const order = (ctx.profile.sizes?.order ?? []).map((x) => ({ medium: "médias", small: "pequenas", large: "grandes (com canal adequado)", micro: "micro", unknown: "porte desconhecido" })[x] ?? x);
    ctx.log("priority", "ok", `Prioridade pelo perfil comprador v${ctx.profileVersion}: ${order.join(" > ")}; consumidor final e fabricante antes de distribuidor e trader; com evidência de operação antes de só atividade registrada.`);
    return {};
  },
  async report(ctx) {
    const r = await ctx.call(`/api/rounds/${ctx.state.roundId}`);
    const res = r.data.results ?? [];
    const registered = res.filter((x) => x.registration);
    const queue = res.filter((x) => x.needsReview && !x.registration);
    const ranked = registered
      .map((x) => {
        const channel = Object.keys(ctx.state.channels ?? {}).some((k) => k.startsWith(`${x.registration.company_id}|`) && ctx.state.channels[k] !== "failed");
        const size = x.sizeHint ?? "unknown";
        return { name: x.names?.[0], key: x.key, companyId: x.registration.company_id, municipality: x.municipality, distance: x.distance?.label ?? null, km: x.distance?.km ?? null, size, segment: x.segment, status: x.status, operation: x.assessment?.operation?.status, use: x.assessment?.commodityUse?.status, purchase: x.assessment?.purchase?.status, channel, note: size === "large" && !channel ? "grande sem canal adequado: mantida, prioridade baixa" : null, screening: x.screening ? (x.screening.matches ? "ocorrência a revisar" : x.screening.valid ? "sem ocorrência" : "vencida ou incompleta") : "não executada" };
      })
      .sort((a, b) => (a.note ? 1 : 0) - (b.note ? 1 : 0) || sizeRank(ctx.profile, a.size) - sizeRank(ctx.profile, b.size) || (b.operation === "proved") - (a.operation === "proved") || (a.km ?? 1e9) - (b.km ?? 1e9));
    const lk = r.data.lastRun?.lookups ?? {};
    const cov = ctx.state.coverage ?? {};
    if (ctx.state.osm === "browser") cov["osm-overpass"] = { status: "ok", count: null, note: "consultado pelo navegador" };
    if (ctx.state.osm === "skipped") cov["osm-overpass"] = { status: "unavailable", count: 0, note: "não consultado (decisão de seguir sem a busca no mapa)" };
    const sitesRead = Object.values(ctx.state.sites ?? {});
    cov["company-site"] = { status: sitesRead.length ? "ok" : "not_applicable", count: sitesRead.length, note: sitesRead.length ? `${sitesRead.filter((x) => x.cnpjs.length).length} de ${sitesRead.length} sites com CNPJ publicado` : "nenhuma candidata com site publicado" };
    cov["br-cnpj-ws"] = { status: lk.failed ? "partial" : "ok", count: (lk.fetched ?? 0) + (lk.cached ?? 0), note: `consulta só por CNPJ (não busca por nome); adiadas ${lk.deferred ?? 0}, falhas ${lk.failed ?? 0}` };
    const abicSet = new Set((ctx.state.abicNames ?? []).map((n) => n.toUpperCase()));
    const toIdentify = queue.filter((x) => (x.names ?? []).some((n) => abicSet.has(String(n).toUpperCase())));
    const queueRest = queue.filter((x) => !toIdentify.includes(x));
    const partial = Object.values(cov).some((x) => ["unavailable", "partial", "empty"].includes(x.status)) || toIdentify.length > 0 || (lk.deferred ?? 0) > 0;
    const summary = {
      market: "national",
      coverage: cov,
      partial,
      partialNote: partial ? "Pesquisa parcial: há fonte indisponível, sem resultado nesta consulta ou candidatas ainda sem CNPJ e município; o resultado não representa todos os compradores da área." : null,
      toIdentify: toIdentify.slice(0, 200).map((x) => ({ name: x.names?.[0], region: x.region ?? null, reason: "torrefadora certificada (ABIC): município e CNPJ a identificar" })),
      candidates: r.data.candidates.reduce((n, c) => n + c.n, 0),
      establishments: res.length,
      registered: registered.length,
      exceptions: queueRest.length,
      pendingLookups: lk.deferred ?? 0,
      failedLookups: lk.failed ?? 0,
      ranked: ranked.slice(0, 50),
      queue: queueRest.slice(0, 50).map((x) => ({ name: x.names?.[0], key: x.key, reasons: [...(x.reasons ?? []), ...(x.checks ?? [])].slice(0, 4) })),
      notCommercial: "Descoberta não é qualificação comercial: nenhuma empresa foi qualificada, contatada nem liberada para ficha ou envio.",
      nextAction: toIdentify.length && !registered.length ? `Identificar CNPJ e município de ${toIdentify.length} torrefadora(s) certificada(s) nos estados da área; sem CNPJ, nenhuma é cadastrada.` : queue.length ? `Revisar ${queue.length} pendência(s) na rodada (seção Conferir).` : registered.length ? "Qualificar as empresas cadastradas (evidência de compra e canal) antes de qualquer ficha." : "Nenhuma empresa cadastrada: ajustar segmentos ou trazer candidatas por importação ou pesquisa assistida.",
      roundId: ctx.state.roundId,
    };
    ctx.log("report", "ok", `Relatório: ${summary.candidates} candidata(s), ${summary.registered} cadastrada(s) em descoberta, ${summary.exceptions} na fila de exceções. ${summary.nextAction}`);
    return { summary };
  },
};

// ---------------------------------------------------------------- internacional (análise, seleção, busca, descoberta)
// Evidência de mercado do produto no país, por fonte, sem misturar as séries: importações declaradas pelo destino
// (Comtrade, CIF, anual) e exportações do Brasil para o destino (MDIC, FOB, mensal). Estados distintos: consulta não
// realizada, falha ou limite, sem declaração, resposta válida sem registros para os filtros, evidência positiva, sem
// código na fonte e, só em prévia ou teste, combinação sem simulação configurada (nunca apresentada como ausência real).
const EVIDENCE_TAG = { positive: "comércio registrado", no_record: "sem registros para os filtros", not_declared: "sem declaração no período", unavailable: "falha ou limite da fonte", not_queried: "consulta não realizada", no_source: "país sem código na fonte", no_simulation: "sem simulação configurada" };
function marketEvidence(ctx, a, hs, p, ind) {
  const country = ctx.input.location.country, iso3 = ctx.input.location.iso3;
  const codes = new Set(hs.map(String));
  const rows = (a.rows ?? []).filter((r) => codes.has(String(r.hs6)) || r.catalog?.confirmed?.some((c) => c.productId === p.id));
  const filters = `SH ${[...codes].join(", ")} (${commodityLabel(p)})`;
  const sim = ctx.env.SIMULATED_TRADE ? JSON.parse(ctx.env.SIMULATED_TRADE) : null;
  const stateOf = (src) => {
    const raw = a.sources?.[src] ?? {}, b = ind.bySource?.[src] ?? {};
    const st = raw.state ?? b.state, err = raw.error ?? raw.note ?? b.error;
    if (sim && !(sim[src] ?? []).includes(iso3)) return { state: "no_simulation" };
    if (!st || st === "pending") return { state: "not_queried" };
    if (st === "data_unavailable") return { state: err === "país sem código nesta fonte" ? "no_source" : "unavailable", error: err };
    if (st === "not_declared") return { state: "not_declared", lastPeriod: raw.lastDeclared ?? raw.lastPeriod ?? b.lastPeriod ?? null };
    return { state: "valid" };
  };
  const ctYears = a.sources?.comtrade?.years ?? [];
  const win = a.sources?.mdic?.window;
  const defs = [
    { key: "comtrade", label: `Importações declaradas por ${country} (Comtrade, CIF, anual; visão do importador)`, period: ctYears.length ? `${ctYears[0]}–${ctYears.at(-1)}` : "período não informado", pos: rows.filter((r) => r.comtrade?.years?.some((y) => (y.worldUsd ?? 0) > 0 || (y.brazilUsd ?? 0) > 0)) },
    { key: "mdic", label: `Exportações do Brasil para ${country} (MDIC, FOB, mensal; visão do Brasil)`, period: win ? `${win.from} a ${win.to} (${a.periodMonths} meses)` : "período não informado", pos: rows.filter((r) => r.mdic && (r.mdic.fobUsd > 0 || r.mdic.netKg > 0)) },
  ];
  const items = defs.map((d) => {
    const st = stateOf(d.key);
    const state = st.state === "valid" ? (d.pos.length ? "positive" : "no_record") : st.state === "no_simulation" ? "no_simulation" : d.pos.length ? "positive" : st.state;
    const text = {
      positive: `${d.label}: comércio registrado de ${filters} em ${d.period}.`,
      no_record: `${d.label}: resposta válida sem registros para ${filters} em ${d.period}. Não indica que ${country} não compra a commodity; só que esta fonte, com estes filtros e este período, não registrou.`,
      not_declared: `${d.label}: ${country} não declarou o período à fonte (última declaração: ${st.lastPeriod ?? "data não informada"}). Ausência de declaração não permite concluir que o país não importa.`,
      unavailable: `${d.label}: consulta com falha ou limite (${st.error ?? "sem detalhe"}). Não indica ausência de comércio.`,
      not_queried: `${d.label}: consulta ainda não realizada.`,
      no_source: `${d.label}: o país não tem código nesta fonte.`,
      no_simulation: `${d.label}: combinação sem simulação configurada nesta prévia ou teste; não representa ausência real de comércio.`,
    }[state];
    return { key: d.key, label: d.label, state, tag: EVIDENCE_TAG[state], period: d.period, filters, text, hs6: d.pos.map((r) => String(r.hs6)) };
  });
  return { items, positive: items.filter((x) => x.state === "positive") };
}
const varietyNote = (p) => (varietyOf(p) ? `Dados agregados de ${commodityLabel(p)} não comprovam aceitação ${varietyOf(p) === "GMO" ? "de GMO" : "da variedade não GMO"} nem identificam compradores individuais.` : `Dados agregados não identificam compradores individuais.`);
// Período mais longo ainda válido: o guardado da fonte mensal (anos do MDIC), no máximo 60 meses.
async function maxEvidenceMonths(env, tenant) {
  const p = await parameters(env, tenant);
  return Math.min(60, Math.max(12, (Number(p["trade_list_mdic_years:international"]) || 1) * 12));
}
// Pesquisa parada antes da busca de empresas: resumo do ponto alcançado, com a lacuna como pendência.
function gapSummary(ctx, ev, p, reason) {
  return {
    market: "international", country: ctx.input.location.country, companySearch: "not_started", stageReached: STEP_LABELS.analysis,
    candidates: null, registered: null, exceptions: 1, ranked: [],
    evidence: ev?.items ?? [],
    queue: [{ name: "Evidência de mercado", reasons: [`${reason}; detalhes por fonte em "Evidência de mercado do país"`] }],
    partial: true, partialNote: `Pesquisa interrompida antes da busca de empresas: ${reason}`,
    coverage: Object.fromEntries((ctx.state.applicable ?? []).map((x) => [x.key, { status: "not_applicable", note: "não consultada: a busca de empresas ainda não começou" }])),
    sourceLabels: Object.fromEntries((ctx.state.applicable ?? []).map((x) => [x.key, x.label])),
    notCommercial: `Nenhuma empresa foi buscada, cadastrada, qualificada ou contatada. ${varietyNote(p)}`,
    nextAction: "Aguardando evidência de mercado: o Compass confere de novo todo dia e retoma sozinho quando a lista do país mostrar comércio do produto; também é possível conferir agora.",
    analysisId: ctx.state.analysisId ?? null,
  };
}
const EVIDENCE_RECHECK_MS = 24 * 3600_000;
const waitUntil = (ctx, at) => (at ? Math.min(6 * 3600_000, Math.max(60_000, Date.parse(at) - Date.parse(ctx.now()))) : 60_000);
// País sem lista ou com falha: pede a geração (política de Administrador) ou para numa ação concreta. Uma por país por
// dia (R12.15); depois de 2 pedidos sem sucesso, para como pendência técnica.
async function askIndicators(ctx, ind) {
  const { state, input, env } = ctx;
  if (ind.state === "failed" && ind.triedToday) {
    state.indicators = "waiting_limit";
    ctx.log("analysis", "waiting", `Geração de hoje sem sucesso (${ind.message}); nova tentativa automática amanhã (uma por país por dia, R12.15).`);
    return { waitFor: "indicators_limit", waitMs: waitUntil(ctx, ind.retryAt) };
  }
  if (ind.state === "failed" && (state.indicatorRequests ?? 0) >= 2)
    return { decision: { kind: "indicators_failed", category: "technical", message: `Pendência técnica: a geração dos indicadores de ${input.location.country} falhou ${state.indicatorRequests} vezes (${ind.message}). Não indica ausência de importações.`, action: { id: "request_indicators", label: `Pedir a geração dos indicadores de ${input.location.country} de novo`, roles: "admin" } } };
  if (!indicatorsAllowed(ctx.policy))
    return { decision: { kind: "indicators_request", category: "technical", message: `Pendência técnica: ${ind.state === "failed" ? `a consulta dos indicadores de ${input.location.country} falhou (${ind.message})` : `a lista mensal de ${input.location.country} ainda não foi gerada`}. O pedido fora do ciclo mensal é do Administrador (R12.15); a política vigente não inclui esse pedido.`, action: { id: "request_indicators", label: `Gerar os indicadores de ${input.location.country}`, roles: "admin" } } };
  const r = await requestCountryList(env, ctx.job.tenant_id, input.location.iso3, { requestedBy: `policy:${ctx.policy.id}@v${ctx.policy.version}`, reason: `Prospecção automática "${ctx.job.name}": ${ind.state === "failed" ? "nova tentativa após falha" : "país sem lista mensal"}`, rid: `prospect:${ctx.job.id}`, deps: ctx.deps.trade ?? {} });
  state.indicatorRequests = (state.indicatorRequests ?? 0) + (r.reused ? 0 : 1);
  state.indicators = "queued";
  ctx.log("analysis", "waiting", r.reused ? "Geração dos indicadores já pedida hoje para este país: acompanhando a mesma versão (sem pedido duplicado)." : `Geração dos indicadores de ${input.location.country} pedida pelo fluxo da lista mensal (R12.15), sob a política de pesquisa v${ctx.policy.version} concedida por Administrador. A pesquisa retoma sozinha quando os dados estiverem prontos.`, { versionId: r.versionId });
  return { waitFor: "indicators_queued", waitMs: 30_000 };
}

const INTERNATIONAL = {
  async plan(ctx) {
    const gate = needsPolicy(ctx, "international");
    if (gate) return gate;
    const { input, env } = ctx;
    const hs = input.hs6?.length ? input.hs6 : await confirmedHs(env, input.productId);
    const list = foreignSources(input.location.iso2, hs).filter((x) => (ctx.profile.sources?.international ?? []).includes(x.key));
    ctx.state.applicable = list;
    ctx.log("plan", "ok", `País: ${input.location.country}. Fontes aplicáveis a este país e a esta commodity: ${list.filter((x) => x.status === "available").map((x) => x.label).join("; ") || "nenhuma"}${list.some((x) => x.status === "pending") ? `; pendentes: ${list.filter((x) => x.status === "pending").map((x) => `${x.label} (${x.note})`).join("; ")}` : ""}.`);
    return {};
  },
  // Indicadores oficiais do país (lista mensal). Sem lista, ou com a fonte do importador falhando, o próprio Compass pede
  // a geração pelo fluxo existente (R12.15), acompanha e retoma; indisponibilidade nunca vira ausência de importações.
  async analysis(ctx) {
    const { state, input, env } = ctx;
    const p = await productL(env, ctx.job.tenant_id, input.productId);
    const hs = input.hs6?.length ? input.hs6 : await confirmedHs(env, p.id);
    if (!hs.length)
      return { decision: { kind: "classification", category: "technical", message: `Pendência técnica do catálogo: ${commodityLabel(p)} ainda não tem código SH confirmado. Sem ele, a lista oficial do país não pode ser cruzada com o produto (R12.14). A confirmação é do Administrador, no Catálogo, com fonte.`, action: { id: "open_catalog", label: "Abrir o produto no Catálogo", roles: "admin", productId: p.id } } };
    const ind = await countryIndicators(env, input.location.iso3, { now: ctx.now });
    // Volta de uma espera por evidência: reavalia com os dados vigentes (a análise igual é reaproveitada, sem duplicar).
    if (state.recheckEvidence) {
      delete state.analysisId;
      delete state.extendedTried;
      delete state.recheckEvidence;
    }
    if (!state.analysisId) {
      if (state.indicators !== ind.state) {
        const say = {
          ready: `Indicadores oficiais disponíveis (dados válidos reaproveitados)${ind.comtradeUnavailable ? `; fonte do importador indisponível: ${ind.comtradeUnavailable}` : ""}.`,
          stale: `Indicadores oficiais disponíveis, mas vencidos: ${ind.message}. Usados com a data indicada.`,
          queued: "Indicadores aguardando geração na lista mensal.",
          processing: "Indicadores em processamento na lista mensal.",
          waiting_limit: `Aguardando limite da fonte: ${ind.message}.`,
          failed: `Falha na consulta dos indicadores: ${ind.message}.`,
          no_source: `Sem fonte de indicadores: ${ind.message}.`,
          not_generated: "A lista mensal deste país ainda não foi gerada.",
        }[ind.state];
        ctx.log("analysis", ["ready", "stale"].includes(ind.state) ? "ok" : ["failed", "no_source"].includes(ind.state) ? "pending" : "waiting", say, { indicators: ind.state, versionId: ind.versionId ?? null });
      }
      state.indicators = ind.state;
      if (INDICATOR_WAIT[ind.state]) return { waitFor: INDICATOR_WAIT[ind.state], waitMs: waitUntil(ctx, ind.retryAt) };
      if (ind.state === "no_source") {
        const reason = `sem fonte de indicadores para ${input.location.country}: ${ind.message}`;
        state.marketGap = { reason, since: state.marketGap?.since ?? ctx.now() };
        state.recheckEvidence = true;
        ctx.log("analysis", "waiting", `Aguardando evidência de mercado: ${reason}.`);
        return { waitFor: "market_evidence", waitMs: 7 * EVIDENCE_RECHECK_MS, summary: gapSummary(ctx, null, p, reason) };
      }
      if (ind.state === "failed" && !ind.retryable)
        return { decision: { kind: "indicators_failed", category: "technical", message: `Pendência técnica: ${ind.message}. Não indica ausência de importações.`, action: { id: "open_trade_list", label: "Abrir a lista mensal", roles: "admin" } } };
      if (ind.state === "not_generated" || ind.state === "failed") return askIndicators(ctx, ind);
      const a = await ctx.call("/api/country-analyses", "POST", { iso3: input.location.iso3 });
      if (!ok(a)) return { decision: { kind: "indicators", category: "technical", message: `Pendência técnica nos indicadores de ${input.location.country}: ${errText(a)}`, action: { id: "retry", label: "Verificar de novo e continuar", roles: "write" } } };
      state.analysisId = a.data.id;
      state.refs = { ...(state.refs ?? {}), analysisId: a.data.id };
    }
    const a = await ctx.call(`/api/country-analyses/${state.analysisId}`);
    const ev = marketEvidence(ctx, a.data, hs, p, ind);
    if (ev.positive.length) {
      state.hs6 = [...new Set(ev.positive.flatMap((x) => x.hs6))].slice(0, 6);
      state.evidence = ev.items;
      delete state.marketGap;
      ctx.log("analysis", "ok", `Evidência de mercado (R12.14): ${ev.positive.map((x) => x.text).join(" ")} ${ev.items.filter((x) => x.state !== "positive").map((x) => x.text).join(" ")} Dado de comércio entre países orienta a escolha, mas não prova que alguma empresa importa do Brasil. ${varietyNote(p)}`.replace(/\s+/g, " ").trim(), { hs6: state.hs6, evidence: ev.items.map((x) => ({ source: x.key, state: x.state, period: x.period })) });
      return {};
    }
    // 1) Fonte com falha ou limite: nova geração pelo fluxo existente (limite diário e tentativas controladas).
    if (ev.items.some((x) => x.state === "unavailable")) {
      delete state.analysisId;
      return askIndicators(ctx, { state: "failed", retryable: true, triedToday: ind.triedToday, retryAt: ind.retryAt, message: ev.items.filter((x) => x.state === "unavailable").map((x) => x.text).join(" ") });
    }
    // 2) Outro período válido: o período guardado mais longo da fonte mensal (exportações do Brasil), uma vez.
    const maxM = await maxEvidenceMonths(env, ctx.job.tenant_id);
    if (ctx.policy?.policy?.extendEvidencePeriod !== false && !state.extendedTried && (a.data.periodMonths ?? 12) < maxM && ev.items.some((x) => x.key === "mdic" && ["no_record"].includes(x.state))) {
      state.extendedTried = true;
      const b = await ctx.call("/api/country-analyses", "POST", { iso3: input.location.iso3, periodMonths: maxM });
      if (ok(b)) {
        state.analysisId = b.data.id;
        if (!state.extendedLogged) ctx.log("analysis", "waiting", `Sem evidência no período padrão (${a.data.periodMonths} meses): conferindo o período guardado mais longo (${maxM} meses) das exportações do Brasil.`);
        state.extendedLogged = true;
        return INTERNATIONAL.analysis(ctx);
      }
    }
    // 3) Lacuna continua: aguarda evidência de mercado (R12.14), com motivo; confere de novo todo dia e retoma sozinho.
    const reason = `nenhuma fonte oficial mostra comércio de ${commodityLabel(p)} com ${input.location.country} no período consultado; a busca de empresas parte só de compra identificada (R12.14)`;
    const fresh = state.marketGap?.reason !== reason;
    state.marketGap = { reason, since: state.marketGap?.since ?? ctx.now() };
    state.evidence = ev.items;
    state.recheckEvidence = true;
    if (fresh) ctx.log("analysis", "waiting", `Aguardando evidência de mercado: ${reason}. ${ev.items.map((x) => x.text).join(" ")}`, { evidence: ev.items.map((x) => ({ source: x.key, state: x.state, period: x.period, filters: x.filters })) });
    return { waitFor: "market_evidence", waitMs: EVIDENCE_RECHECK_MS, summary: gapSummary(ctx, ev, p, reason) };
  },
  async select(ctx) {
    const { state, input } = ctx;
    if (state.campaignId) return {};
    const p = await productL(ctx.env, ctx.job.tenant_id, input.productId);
    // R12.7 vigente: seleção e autorização são de uma pessoa. A política só faria isso com a emenda aprovada.
    if (!amendmentOn(ctx))
      return { decision: { kind: "r12_7", category: "rule", message: `R12.7 (vigente): a seleção de ${commodityLabel(p)} para ${input.location.country} e a autorização da busca de empresas são feitas por uma pessoa (Administrador ou gestor), com autor e data. A emenda que permitiria à política fazê-lo está proposta e não foi aprovada.`, items: [`Indicadores oficiais: compra identificada em ${state.hs6.join(", ")}`], action: { id: "select_authorize", label: `Selecionar ${commodityLabel(p)} e autorizar a busca em ${input.location.country}`, roles: "approver" } } };
    const sel = await ctx.call(`/api/country-analyses/${state.analysisId}/selections`, "POST", { items: [{ productId: p.id, label: commodityLabel(p), hs6: state.hs6 }] });
    if (!ok(sel)) return { decision: { kind: "selection", message: `Seleção recusada: ${errText(sel)}` } };
    state.campaignId = sel.data.campaigns[0].id;
    state.refs = { ...(state.refs ?? {}), campaignId: state.campaignId };
    ctx.log("select", "ok", `Seleção registrada pela política de pesquisa v${ctx.policy.version} (R12.7 com a emenda aprovada). Campanha em rascunho criada pela regra da seleção; nada é ativado.`);
    return {};
  },
  async authorize(ctx) {
    const { state, profile } = ctx;
    if (state.searchId) return {};
    if (!amendmentOn(ctx)) return { decision: { kind: "r12_7", category: "rule", message: "R12.7 (vigente): a autorização da busca de empresas é de uma pessoa.", action: { id: "select_authorize", label: "Autorizar a busca de empresas", roles: "approver" } } };
    const sizes = (profile.sizes?.order ?? []).filter((x) => ["small", "medium"].includes(x));
    const a = await ctx.call(`/api/campaigns/${state.campaignId}/foreign-search`, "POST", { confirm: true, targetSizes: sizes.length ? sizes : ["small", "medium"], note: `Autorizada pela política de pesquisa de rotina v${ctx.policy.version}.` });
    if (!ok(a)) return { decision: { kind: "authorization", message: `Busca de empresas não autorizada: ${errText(a)}${a.status === 403 ? " (a política só vale para quem pode aprovar; peça a um Administrador ou gestor)" : ""}` } };
    state.searchId = a.data.id;
    state.refs = { ...(state.refs ?? {}), searchId: a.data.id };
    ctx.log("authorize", "ok", "Busca de empresas no país aberta pela política (registro com autor, data e análise).");
    return {};
  },
  async discover(ctx) {
    const { state, profile } = ctx;
    const d = await ctx.call(`/api/foreign-searches/${state.searchId}/discovery`);
    const allowed = new Set(profile.sources?.international ?? []);
    const available = (d.data.sources ?? []).filter((x) => x.available && allowed.has(x.key));
    const unsupported = (d.data.sources ?? []).filter((x) => !x.available && allowed.has(x.key)).map((x) => `${x.label ?? x.key}: ${x.note}`);
    state.sourceRuns ??= {};
    if (!available.length) {
      ctx.log("discover", "pending", `Nenhuma fonte gratuita de empresas cobre ${ctx.input.location.country} para esta commodity no Compass${unsupported.length ? ` (pendentes: ${unsupported.join("; ")})` : ""}. Etapa pendente; o restante segue.`);
      return { outcome: "pending" };
    }
    let waiting = false;
    for (const src of available) {
      const st = (state.sourceRuns[src.key] ??= { tries: 0 });
      if (st.done) continue;
      st.tries++;
      const r = await ctx.call(`/api/foreign-searches/${state.searchId}/discover`, "POST", { source: src.key, role: "processor" });
      if (ok(r)) {
        st.done = true;
        ctx.log("discover", "ok", `${src.label ?? src.key}: ${r.data.found ?? 0} empresa(s) encontrada(s) (indício, não prova de compra nem de importação).`);
      } else if (r.data?.error?.code === "source_unavailable" && st.tries <= MAX_SOURCE_RETRIES) {
        waiting = true;
        ctx.log("discover", "waiting", `${src.label ?? src.key} indisponível; nova tentativa automática (${st.tries}/${MAX_SOURCE_RETRIES}).`);
      } else {
        st.done = true;
        st.failed = errText(r);
        ctx.log("discover", "pending", `${src.label ?? src.key}: ${errText(r)}. Fonte pendente; as demais seguem.`);
      }
    }
    if (waiting) return { waitFor: "source_retry", waitMs: 120_000 };
    return { outcome: Object.values(state.sourceRuns).some((x) => x.failed) ? "partial" : "done" };
  },
  async accept(ctx) {
    const { state, policy } = ctx;
    const d = await ctx.call(`/api/foreign-searches/${state.searchId}/discovery`);
    const fresh = [...(d.data.processors ?? []), ...(d.data.traders ?? [])].filter((c) => c.status === "new");
    const rule = new Set(policy.policy.international?.acceptCandidatesWith ?? ["registry_id", "website"]);
    const okC = fresh.filter((c) => (rule.has("registry_id") && (c.registryId ?? c.registry?.id)) || (rule.has("website") && c.website));
    const rest = fresh.filter((c) => !okC.includes(c));
    if (!amendmentOn(ctx) && okC.length)
      return { decision: { kind: "acceptance", category: "rule", message: `Regra vigente da descoberta internacional: nada entra no cadastro sem a pessoa aceitar. ${okC.length} candidata(s) têm identificador cadastral ou site publicado; as demais ficam na fila de exceções.`, items: okC.slice(0, 25).map((c) => `${c.name}${(c.registryId ?? c.registry?.id) ? ` · registro ${(c.registryId ?? c.registry?.id)}` : ""}${c.website ? ` · ${c.website}` : ""}`), action: { id: "accept_candidates", label: `Cadastrar em descoberta as ${okC.length} candidata(s) listada(s)`, roles: "write", ids: okC.map((c) => c.id) } } };
    let accepted = 0;
    const exceptions = rest.map((c) => ({ name: c.name, reason: "sem identificador cadastral nem site publicado: conferir antes de cadastrar" }));
    for (let k = 0; k < okC.length; k += 100) {
      const r = await ctx.call(`/api/foreign-searches/${state.searchId}/discovery/accept`, "POST", { ids: okC.slice(k, k + 100).map((c) => c.id) });
      if (!ok(r)) {
        ctx.log("accept", "failed", `Cadastro recusado: ${errText(r)}`);
        continue;
      }
      accepted += r.data.accepted ?? 0;
      for (const x of r.data.results ?? []) if (!x.ok) exceptions.push({ name: okC.find((c) => c.id === x.id)?.name ?? x.id, reason: x.reason });
    }
    state.exceptions = exceptions;
    ctx.log("accept", exceptions.length ? "partial" : "ok", `${accepted} empresa(s) cadastrada(s) em descoberta (identificador cadastral ou site publicado), ${exceptions.length} na fila de exceções (sem identificação suficiente ou parecida com empresa já cadastrada; nada é fundido sozinho).`);
    return { outcome: exceptions.length ? "partial" : "done" };
  },
  async register(ctx) {
    const { state, policy } = ctx;
    if (!policy.policy.autoScreening) return { outcome: "skipped" };
    const sx = await ctx.call(`/api/foreign-searches/${state.searchId}`);
    const cards = Object.values(sx.data.groups ?? {}).flat();
    let done = 0, failed = 0;
    const reasons = new Set();
    for (const c of cards) {
      const id = c.companyId ?? c.id;
      if (!id) continue;
      const r = await ctx.call(`/api/companies/${id}/screening`, "POST", {});
      if (ok(r)) done++;
      else (failed++, reasons.add(errText(r)));
    }
    ctx.log("register", failed ? "partial" : "ok", `Triagem de sanções: ${done} empresa(s) triada(s)${failed ? `, ${failed} pendente(s): ${[...reasons].join("; ")}` : ""}. O que depende da triagem continua bloqueado até ela existir e estar válida.`);
    return { outcome: failed ? "partial" : "done" };
  },
  async evidence(ctx) {
    const r = await ctx.call(`/api/foreign-searches/${ctx.state.searchId}/people/research`, "POST", {});
    if (ok(r)) ctx.log("evidence", "ok", `Canais e pessoas em fontes permitidas (aviso legal/Impressum quando o site existe): ${r.data.researched ?? 0} empresa(s) pesquisada(s), ${r.data.added ?? 0} registro(s) novo(s) para aceite da pessoa${r.data.remaining ? `; ${r.data.remaining} restante(s)` : ""}. Pessoa encontrada não vira contato sem aceite.`);
    else ctx.log("evidence", "pending", `Pesquisa de canais publicados: ${errText(r)}. Fica como pendência por empresa.`);
    return { outcome: ok(r) ? "done" : "pending" };
  },
  async priority(ctx) {
    return {};
  },
  async report(ctx) {
    if (!ctx.state.searchId) {
      const b = ctx.state.blocked ?? { message: "A busca de empresas não foi aberta." };
      const summary = { market: "international", country: ctx.input.location.country, candidates: 0, registered: 0, exceptions: 0, ranked: [], queue: [], partial: true, partialNote: b.message, coverage: Object.fromEntries((ctx.state.applicable ?? []).map((x) => [x.key, { status: "not_applicable", note: "não consultada: a busca de empresas não foi aberta" }])), sourceLabels: Object.fromEntries((ctx.state.applicable ?? []).map((x) => [x.key, x.label])), notCommercial: "Nenhuma empresa foi buscada, cadastrada, qualificada ou contatada.", nextAction: "Aguardar a evidência de mercado do país; nada foi concluído sobre compradores.", analysisId: ctx.state.analysisId ?? null };
      ctx.log("report", "ok", `Relatório: ${b.message}`);
      return { summary };
    }
    const sx = await ctx.call(`/api/foreign-searches/${ctx.state.searchId}`);
    const groups = sx.data.groups ?? {};
    const cards = Object.values(groups).flat();
    const ranked = cards.map((c) => ({ name: c.name ?? c.legalName, companyId: c.companyId ?? c.id, size: c.size ?? "unknown", status: c.buyerStatusLabel ?? c.buyerStatus ?? "encontrada", ownEvidence: c.ownEvidence ?? 0 })).sort((a, b) => sizeRank(ctx.profile, a.size) - sizeRank(ctx.profile, b.size));
    const d = await ctx.call(`/api/foreign-searches/${ctx.state.searchId}/discovery`);
    const candidates = [...(d.data.processors ?? []), ...(d.data.traders ?? [])].length;
    const summary = {
      market: "international",
      country: ctx.input.location.country,
      candidates,
      registered: cards.length,
      exceptions: (ctx.state.exceptions ?? []).length,
      ranked: ranked.slice(0, 50),
      queue: (ctx.state.exceptions ?? []).slice(0, 50),
      coverage: Object.fromEntries((ctx.state.applicable ?? []).map((x) => { const v = ctx.state.sourceRuns?.[x.key]; return [x.key, v ? (v.failed ? { status: "unavailable", note: v.failed } : { status: "ok", note: x.rule ?? "" }) : { status: x.status === "pending" ? "unavailable" : "not_applicable", note: x.note ?? "" }]; })),
      evidence: ctx.state.evidence ?? [],
      sourceLabels: Object.fromEntries((ctx.state.applicable ?? []).map((x) => [x.key, x.label])),
      partial: (ctx.state.applicable ?? []).some((x) => x.status === "pending") || Object.values(ctx.state.sourceRuns ?? {}).some((v) => v.failed),
      partialNote: "Pesquisa parcial: há fonte pertinente pendente ou indisponível; o resultado não representa todos os compradores do país.",
      notCommercial: "Descoberta não é qualificação comercial nem prova de importação do Brasil: nenhuma empresa foi qualificada, contatada nem liberada para ficha ou envio.",
      nextAction: cards.length ? "Validar a compra de cada empresa (evidência própria) na busca do país antes de qualquer ficha." : "Nenhuma empresa encontrada nas fontes gratuitas cobertas: tente outro país ou pesquisa assistida.",
      searchId: ctx.state.searchId, campaignId: ctx.state.campaignId, analysisId: ctx.state.analysisId,
    };
    ctx.log("report", "ok", `Relatório: ${summary.candidates} candidata(s), ${summary.registered} empresa(s) na busca, ${summary.exceptions} exceção(ões). ${summary.nextAction}`);
    return { summary };
  },
};

// GET /api/prospect/coverage — fontes aplicáveis à escolha atual (mesma regra do motor); incompatíveis não aparecem.
const IND_TEXT = { ready: "disponíveis", stale: "disponíveis, vencidos", queued: "aguardando geração", processing: "em processamento", waiting_limit: "aguardando limite da fonte", failed: "falha na consulta", no_source: "sem fonte para o país", not_generated: "lista mensal ainda não gerada" };
export async function coverage(request, env, actor) {
  const u = new URL(request.url).searchParams;
  const market = oneOf(u.get("market"), ["national", "international"], "mercado");
  const p = await productL(env, actor.tenant_id, str(u.get("productId"), "produto", 80));
  const profile = (await currentProfile(env, actor.tenant_id))?.profile ?? DEFAULT_PROFILE;
  const policy = await currentPolicy(env, actor.tenant_id);
  if (market === "national") {
    const segments = profile.segmentsByCommodity?.[p.commodity] ?? SEGMENT_PRESETS[p.commodity] ?? {};
    const items = nationalSources(segments).items.map((x) => ({ ...x, available: x.status === "available" }));
    return { market, commodity: p.commodityLabel, segments: Object.values(segments).map((g) => g.label), items, partial: true, partialNote: "As fontes gratuitas não cobrem todos os compradores; o relatório mostra o que cada fonte trouxe e o que ficou pendente." };
  }
  const iso2 = str(u.get("iso2"), "país", 2).toUpperCase();
  const c = await s(env, "SELECT iso3,iso2,name_pt FROM countries WHERE iso2=?", iso2).first();
  if (!c) fail(422, "country_not_found", "País não encontrado.");
  const hs = await confirmedHs(env, p.id);
  const ind = await countryIndicators(env, c.iso3);
  const auto = indicatorsAllowed(policy);
  const items = [
    { key: "indicators", label: "Indicadores oficiais de compra do país (lista mensal)", status: ["ready", "stale"].includes(ind.state) ? "available" : "pending", note: `${IND_TEXT[ind.state]}${ind.message ? `: ${ind.message}` : ""}${["not_generated", "failed"].includes(ind.state) ? (auto ? "; a prospecção pede a geração sozinha" : "; geração pelo Administrador (R12.15)") : ""}` },
    ...(hs.length ? [] : [{ key: "classification", label: "Classificação do produto no catálogo (código SH)", status: "pending", note: "ainda não confirmada: sem ela, a lista do país não é cruzada com o produto (Administrador, Catálogo)" }]),
    ...foreignSources(c.iso2, hs).filter((x) => (profile.sources?.international ?? []).includes(x.key)),
  ].map((x) => ({ ...x, available: x.status === "available" }));
  return { market, country: c.name_pt, commodity: p.commodityLabel, indicators: ind.state, items, partial: !items.every((x) => x.available), partialNote: "Etapas sem cobertura ficam pendentes no relatório; as demais seguem." };
}

// GET /api/prospect/connectors — inventário completo de conectores (administração), com quando cada um se aplica.
export async function connectors(request, env, actor) {
  requireRole(actor, ADMIN_ROLES);
  return inventory();
}

// POST /api/sources/applicable — a mesma regra para a configuração manual de rodada (segmentos escolhidos pela pessoa) e
// para o Radar Internacional: { market: "national", segments } ou { market: "international", iso2, productId }.
export async function applicableRoute(request, env, actor) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request);
  const market = oneOf(i.market, ["national", "international"], "mercado");
  if (market === "national") {
    const segs = i.segments && typeof i.segments === "object" && !Array.isArray(i.segments) ? i.segments : {};
    if (Object.keys(segs).length > 40) fail(422, "too_many_segments", "Segmentos demais.");
    return nationalSources(segs);
  }
  const p = await productL(env, actor.tenant_id, str(i.productId, "produto", 80));
  return { items: foreignSources(str(i.iso2, "país", 2).toUpperCase(), await confirmedHs(env, p.id)) };
}
