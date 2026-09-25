// Lista mensal de compras por país (P3-T5; Plano 3 rev. 2; errata do Plano 3 itens 2, 4, 5, 6, 9 e 10).
//
// Estado verdadeiro em D1 (trade_list_jobs); a fila só leva o id do job. Cada job adquire lease com token
// (fencing) e tudo o que ele grava em D1 é condicionado a esse token no mesmo batch. Resultados vão para
// chaves determinísticas no R2 (mesma entrega duas vezes → mesmo objeto). As transições "todos os pedaços
// terminaram", "todas as chamadas do país terminaram" e "a versão terminou" são derivadas do estado
// (advance), então uma queda em qualquer ponto é retomada pela próxima varredura.
// O ponteiro de país/fonte só avança por CAS monotônico, depois de o objeto completo estar no R2.
import { AdapterError } from "./adapters/errors.js";
import * as mdic from "./adapters/mdic-bulk.js";
import * as comtrade from "./adapters/comtrade.js";
import { createAccumulator } from "./mdic-aggregate.js";
import { bodyJson, fail, requireRole, str } from "./http.js";
import { statement as s, commit, parameters, requireParameter, auditStatement, now as clock } from "./store.js";

const ADMIN = new Set(["admin"]);
const MDIC_BASE = (env) => env.MDIC_BULK_BASE || "https://balanca.economia.gov.br/balanca/bd";
const COMTRADE_BASE = (env) => env.COMTRADE_BASE || "https://comtradeapi.un.org";
export const MERGE_BUCKETS = 4;
const MAX_ATTEMPTS = 6;
const MAX_MDIC_GENERATIONS = 3;
const LEASE_MS = 10 * 60 * 1000;
const REENQUEUE_MS = 15 * 60 * 1000;
const COMTRADE_KINDS = new Set(["comtrade_ref", "comtrade_da", "comtrade_call"]);
const SYSTEM = (tenant) => ({ tenant_id: tenant, id: "system-trade-list", role: "system" });

const addMs = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();
const utcDay = (iso) => iso.slice(0, 10);
const nextUtcDay = (iso) => `${new Date(Date.parse(utcDay(iso)) + 86400000).toISOString().slice(0, 10)}T00:05:00.000Z`;
const spMonthDay = (iso) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { month: `${p.year}-${p.month}`, day: Number(p.day), year: Number(p.year) };
};
export async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function bucketOf(iso3, buckets = MERGE_BUCKETS) {
  let h = 0;
  for (const c of iso3) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % buckets;
}

function r2(env) {
  if (!env.FILES) throw new AdapterError("schema", "R2 (FILES) não configurado: a lista mensal precisa dele.", { code: "r2_missing" });
  return env.FILES;
}
async function putJson(env, key, value) {
  const text = JSON.stringify(value);
  await r2(env).put(key, text, { httpMetadata: { contentType: "application/json" } });
  return { key, sha: await sha256(text) };
}
async function getJson(env, key) {
  const o = await r2(env).get(key);
  if (!o) throw new AdapterError("schema", `Objeto ausente no R2: ${key}.`, { code: "r2_object_missing" });
  return JSON.parse(await o.text());
}

// ---------- parâmetros e versões ----------

async function routineParams(env, tenant) {
  const p = await parameters(env, tenant);
  return {
    classification: requireParameter(p, "agri_classification:international"),
    mdicYears: requireParameter(p, "trade_list_mdic_years:international"),
    comtradeYears: requireParameter(p, "trade_list_comtrade_years:international"),
    callsPerDay: requireParameter(p, "comtrade_calls_per_day:international"),
    retention: requireParameter(p, "trade_list_retention_versions:international"),
    refreshDay: p["country_list_refresh_day:international"] ?? null,
  };
}
const version = (env, id) => s(env, "SELECT * FROM trade_list_versions WHERE id=?", id).first();
const job = (vid, kind, key, payload = {}) => ({ vid, kind, key, payload });
const insertJob = (env, j, guard) =>
  guard
    ? s(env, `INSERT OR IGNORE INTO trade_list_jobs(id,version_id,kind,job_key,payload_json) SELECT ?,?,?,?,? WHERE ${guard.sql}`, crypto.randomUUID(), j.vid, j.kind, j.key, JSON.stringify(j.payload), ...guard.args)
    : s(env, "INSERT OR IGNORE INTO trade_list_jobs(id,version_id,kind,job_key,payload_json) VALUES (?,?,?,?,?)", crypto.randomUUID(), j.vid, j.kind, j.key, JSON.stringify(j.payload));

function statusStmt(env, vid, iso3, source, state, { lastPeriod = null, lines = 0, error = null, at, guard } = {}) {
  const sql = `INSERT INTO trade_list_status(version_id,iso3,source,state,last_period,lines,error,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard ? guard.sql : "1"}
    ON CONFLICT(version_id,iso3,source) DO UPDATE SET state=excluded.state,last_period=excluded.last_period,lines=excluded.lines,error=excluded.error,updated_at=excluded.updated_at`;
  return s(env, sql, vid, iso3, source, state, lastPeriod, lines, error, at, ...(guard?.args ?? []));
}
// CAS monotônico: só avança se a versão nova começou depois da vigente (versão atrasada nunca sobrescreve).
function pointerStmt(env, vid, iso3, source, key, sha, at, guard) {
  const sql = `INSERT INTO trade_list_current(iso3,source,version_id,r2_key,content_sha256,revision,updated_at) SELECT ?,?,?,?,?,1,? WHERE ${guard ? guard.sql : "1"}
    ON CONFLICT(iso3,source) DO UPDATE SET version_id=excluded.version_id,r2_key=excluded.r2_key,content_sha256=excluded.content_sha256,revision=trade_list_current.revision+1,updated_at=excluded.updated_at
    WHERE (SELECT started_at FROM trade_list_versions WHERE id=trade_list_current.version_id) <= (SELECT started_at FROM trade_list_versions WHERE id=excluded.version_id)`;
  return s(env, sql, iso3, source, vid, key, sha, at, ...(guard?.args ?? []));
}

// Cria a versão do mês (ou retoma a existente) com os jobs iniciais. Idempotente: o cron pode repetir.
export async function startMonthlyRun(env, tenant, deps = {}) {
  const at = deps.now?.() ?? clock();
  const params = await routineParams(env, tenant);
  r2(env);
  const { month } = spMonthDay(at);
  const existing = await version(env, month);
  if (existing && existing.status !== "running") return { versionId: month, status: existing.status, resumed: false };
  const stmts = [];
  if (!existing)
    stmts.push(s(env, "INSERT OR IGNORE INTO trade_list_versions(id,kind,reference_month,classification_json,params_json,started_at) VALUES (?,'monthly',?,?,?,?)", month, month, JSON.stringify(params.classification), JSON.stringify(params), at));
  stmts.push(...baseJobs(env, month, params, at).map((j) => insertJob(env, j)));
  const countries = (await s(env, "SELECT iso3,comtrade_code,EXISTS(SELECT 1 FROM country_mdic_codes m WHERE m.iso3=countries.iso3) has_mdic FROM countries").all()).results;
  for (const c of countries) {
    if (!mdicExternal(env))
      stmts.push(
      c.has_mdic
        ? s(env, "INSERT OR IGNORE INTO trade_list_status(version_id,iso3,source,state,updated_at) VALUES (?,?,'mdic','pending',?)", month, c.iso3, at)
        : s(env, "INSERT OR IGNORE INTO trade_list_status(version_id,iso3,source,state,error,updated_at) VALUES (?,?,'mdic','data_unavailable','país sem código nesta fonte',?)", month, c.iso3, at),
    );
    stmts.push(
      c.comtrade_code == null
        ? s(env, "INSERT OR IGNORE INTO trade_list_status(version_id,iso3,source,state,error,updated_at) VALUES (?,?,'comtrade','data_unavailable','país sem código nesta fonte',?)", month, c.iso3, at)
        : s(env, "INSERT OR IGNORE INTO trade_list_status(version_id,iso3,source,state,updated_at) VALUES (?,?,'comtrade','pending',?)", month, c.iso3, at),
    );
  }
  for (let i = 0; i < stmts.length; i += 90) await commit(env, stmts.slice(i, i + 90));
  if (!existing) await commit(env, [auditStatement(env, SYSTEM(tenant), "cron", "trade_list.started", "trade_list_version", month, { countries: countries.length })]);
  await advance(env, month, deps);
  await sweep(env, deps);
  return { versionId: month, status: "running", resumed: !!existing };
}

// MDIC_SOURCE=github: o arquivo do MDIC é lido fora do Worker (scripts/mdic-job.mjs, workflow mensal) porque o servidor
// do MDIC envia a cadeia de certificados incompleta e o fetch do Worker responde 526. O Worker cuida só da Comtrade.
export const mdicExternal = (env) => env.MDIC_SOURCE === "github";

function baseJobs(env, vid, params, at, only) {
  const years = [];
  const { year } = spMonthDay(at);
  for (let i = 0; i < params.mdicYears; i++) years.push(year - i);
  const jobs = [job(vid, "comtrade_ref", "comtrade_ref", {})];
  if (!mdicExternal(env)) jobs.unshift(job(vid, "mdic_ref", "mdic_ref", { years, only: only ?? null }));
  return jobs;
}

// Cron diário: começa a versão do mês a partir do dia configurado (ou retoma a que está rodando) e varre jobs.
export async function daily(env, tenant, deps = {}) {
  const at = deps.now?.() ?? clock();
  const p = await parameters(env, tenant);
  const { month, day } = spMonthDay(at);
  const current = await version(env, month);
  const refreshDay = p["country_list_refresh_day:international"];
  if (current?.status === "running" || (!current && refreshDay != null && day >= refreshDay)) return startMonthlyRun(env, tenant, deps);
  await sweep(env, deps);
  return { versionId: current?.id ?? null, status: current?.status ?? "not_started" };
}

// ---------- fila, lease e orçamento ----------

// Enfileira jobs devidos e recupera leases vencidos. Jobs da Comtrade respeitam o orçamento restante do dia.
export async function sweep(env, deps = {}) {
  const at = deps.now?.() ?? clock();
  await s(env, "UPDATE trade_list_jobs SET status='pending',lease_token=NULL,lease_until=NULL,enqueued_at=NULL WHERE status='leased' AND lease_until<?", at).run();
  const due = (
    await s(
      env,
      `SELECT j.id,j.kind,v.params_json FROM trade_list_jobs j JOIN trade_list_versions v ON v.id=j.version_id
       WHERE j.status='pending' AND v.status='running' AND (j.next_attempt_at IS NULL OR j.next_attempt_at<=?) AND (j.enqueued_at IS NULL OR j.enqueued_at<?)
         AND NOT (j.kind IN ('comtrade_ref','comtrade_da','comtrade_call') AND v.comtrade_blocked IS NOT NULL)
       ORDER BY j.created_at LIMIT 500`,
      at,
      addMs(at, -REENQUEUE_MS),
    ).all()
  ).results;
  if (!due.length) return { enqueued: 0 };
  const used = (await s(env, "SELECT used FROM provider_budget WHERE provider='comtrade' AND day=?", utcDay(at)).first())?.used ?? 0;
  const pick = [];
  let room = null;
  for (const j of due) {
    if (COMTRADE_KINDS.has(j.kind)) {
      if (room === null) room = Math.max(0, JSON.parse(j.params_json).callsPerDay - used);
      if (room <= 0) continue;
      room--;
    }
    pick.push(j.id);
  }
  if (!pick.length) return { enqueued: 0 };
  for (let i = 0; i < pick.length; i += 90) {
    const ids = pick.slice(i, i + 90);
    await s(env, `UPDATE trade_list_jobs SET enqueued_at=? WHERE id IN (${ids.map(() => "?").join(",")})`, at, ...ids).run();
  }
  const send = deps.enqueue ?? ((msgs) => env.ASYNC_QUEUE?.sendBatch(msgs));
  for (let i = 0; i < pick.length; i += 100) await send(pick.slice(i, i + 100).map((id) => ({ body: { type: "trade_job", jobId: id } })));
  return { enqueued: pick.length };
}

// Reserva atômica de uma chamada no orçamento do dia (UTC). false = orçamento esgotado.
async function reserve(env, provider, at, limit) {
  const day = utcDay(at);
  const [, upd] = await env.DB.batch([
    s(env, "INSERT OR IGNORE INTO provider_budget(provider,day,used) VALUES (?,?,0)", provider, day),
    s(env, "UPDATE provider_budget SET used=used+1 WHERE provider=? AND day=? AND used<?", provider, day, limit),
  ]);
  return upd.meta.changes === 1;
}

const HANDLERS = {
  mdic_ref: mdicRef,
  mdic_chunk: mdicChunk,
  mdic_merge: mdicMerge,
  comtrade_ref: comtradeRef,
  comtrade_da: comtradeDa,
  comtrade_call: comtradeCall,
  consolidate: consolidateComtrade,
};

// Executa um job da fila. Entrega repetida, lease perdido ou versão fechada → nada muda.
export async function runJob(env, jobId, deps = {}) {
  const at = deps.now?.() ?? clock();
  const token = crypto.randomUUID();
  const got = await s(
    env,
    `UPDATE trade_list_jobs SET status='leased',lease_token=?,lease_until=?,attempts=attempts+1
     WHERE id=? AND (status='pending' OR (status='leased' AND lease_until<?)) AND (next_attempt_at IS NULL OR next_attempt_at<=?)`,
    token, addMs(at, LEASE_MS), jobId, at, at,
  ).run();
  if (!got.meta.changes) return { skipped: true };
  const j = await s(env, "SELECT * FROM trade_list_jobs WHERE id=?", jobId).first();
  const v = await version(env, j.version_id);
  const params = JSON.parse(v.params_json);
  const mine = { sql: "EXISTS (SELECT 1 FROM trade_list_jobs WHERE id=? AND status='done' AND lease_token=?)", args: [jobId, token] };
  const done = (resultKey = null, sha = null) =>
    s(env, "UPDATE trade_list_jobs SET status='done',done_at=?,lease_until=NULL,result_r2_key=?,result_sha256=?,error_kind=NULL,error=NULL WHERE id=? AND lease_token=? AND status='leased'", at, resultKey, sha, jobId, token);
  if (v.status !== "running" || (COMTRADE_KINDS.has(j.kind) && v.comtrade_blocked)) {
    await s(env, "UPDATE trade_list_jobs SET status=?,lease_token=NULL,lease_until=NULL,enqueued_at=NULL,attempts=attempts-1 WHERE id=? AND lease_token=?", v.status === "running" ? "pending" : "superseded", jobId, token).run();
    return { skipped: true };
  }
  if (COMTRADE_KINDS.has(j.kind) && !(await reserve(env, "comtrade", at, params.callsPerDay))) {
    // Orçamento esgotado: volta para amanhã sem ocupar a fila (errata item 6).
    await s(env, "UPDATE trade_list_jobs SET status='pending',lease_token=NULL,lease_until=NULL,enqueued_at=NULL,attempts=attempts-1,next_attempt_at=? WHERE id=? AND lease_token=?", nextUtcDay(at), jobId, token).run();
    return { deferred: "budget" };
  }
  const ctx = { env, deps, at, job: j, payload: JSON.parse(j.payload_json), version: v, params, done, mine, fetch: deps.fetch ?? fetch };
  try {
    const stmts = await HANDLERS[j.kind](ctx);
    const res = await env.DB.batch(stmts);
    if (!res[0].meta.changes) return { fenced: true };
  } catch (e) {
    await onError(env, j, v, token, e, at);
  }
  await advance(env, j.version_id, deps);
  await sweep(env, deps);
  return { done: true };
}

async function onError(env, j, v, token, e, at) {
  const kind = e instanceof AdapterError ? e.kind : "bug";
  const code = e?.details?.code ?? null;
  const msg = e instanceof AdapterError ? e.message : "erro interno";
  if (!(e instanceof AdapterError)) console.error("trade_job_bug", { kind: j.kind });
  const guarded = (sql, ...args) => s(env, `${sql} WHERE id=? AND lease_token=?`, ...args, j.id, token);
  if (code === "source_changed" && j.kind === "mdic_chunk") {
    // Arquivo republicado no meio da leitura: todos os pedaços desta geração saem e o ano recomeça (errata item 2).
    const { year, gen } = JSON.parse(j.payload_json);
    const stmts = [
      guarded("UPDATE trade_list_jobs SET status='superseded',lease_until=NULL,error_kind=?,error=?", code, msg),
      s(env, "UPDATE trade_list_jobs SET status='superseded' WHERE version_id=? AND kind='mdic_chunk' AND status IN ('pending','leased','done') AND json_extract(payload_json,'$.year')=? AND json_extract(payload_json,'$.gen')=?", j.version_id, year, gen),
    ];
    if (gen < MAX_MDIC_GENERATIONS) stmts.push(insertJob(env, job(j.version_id, "mdic_ref", `mdic_ref:${year}:g${gen + 1}`, { years: [year], gen: gen + 1, only: JSON.parse(j.payload_json).only ?? null })));
    else stmts.push(s(env, "UPDATE trade_list_versions SET note=COALESCE(note||' ','')||? WHERE id=?", `MDIC ${year} mudou ${gen} vezes durante a leitura.`, j.version_id));
    await env.DB.batch(stmts);
    return;
  }
  const retry = (kind === "temporary" || kind === "incomplete" || kind === "bug") && j.attempts < MAX_ATTEMPTS;
  if (retry) {
    const wait = e?.details?.retryAfter ? e.details.retryAfter * 1000 : Math.min(2 ** j.attempts * 60000, 6 * 3600000);
    await guarded("UPDATE trade_list_jobs SET status='pending',lease_token=NULL,lease_until=NULL,enqueued_at=NULL,next_attempt_at=?,error_kind=?,error=?", addMs(at, wait), kind, msg).run();
    return;
  }
  const stmts = [guarded("UPDATE trade_list_jobs SET status='failed',lease_until=NULL,error_kind=?,error=?", code ?? kind, msg)];
  // Chave recusada ou ausente para a rotina inteira da Comtrade e avisa o admin; o MDIC segue.
  if (kind === "auth" && COMTRADE_KINDS.has(j.kind)) stmts.push(s(env, "UPDATE trade_list_versions SET comtrade_blocked=? WHERE id=? AND comtrade_blocked IS NULL", code === "no_key" ? "no_key" : "auth", j.version_id));
  await env.DB.batch(stmts);
}

// ---------- handlers ----------

async function mdicRef({ env, at, payload, version: v, done, mine, fetch: f }) {
  const validators = {};
  const notes = [];
  for (const y of payload.years) {
    const h = await mdic.headYear(MDIC_BASE(env), y, f);
    if (h) validators[y] = { ...h, gen: payload.gen ?? 1 };
    else notes.push(`MDIC ${y} ainda não publicado.`);
  }
  const stmts = [done()];
  if (!payload.gen) {
    const classification = JSON.parse(v.classification_json);
    const ncm = await mdic.loadNcmTable(MDIC_BASE(env), classification.chapters, f);
    await putJson(env, `trade-ref/${v.id}/ncm.json`, ncm);
  }
  // Atualização manual reaproveita o agregado vigente do país quando o arquivo não mudou (errata item 9).
  let reuse = null;
  if (payload.only && !payload.gen) reuse = await reusableMdic(env, payload.only, validators);
  for (const [y, val] of Object.entries(validators))
    stmts.push(s(env, `UPDATE trade_list_versions SET mdic_validators_json=json_set(mdic_validators_json,'$."${Number(y)}"',json(?)) WHERE id=? AND ${mine.sql}`, JSON.stringify(reuse ? { ...val, reused: reuse.version_id } : val), v.id, ...mine.args));
  if (notes.length) stmts.push(s(env, `UPDATE trade_list_versions SET note=COALESCE(note||' ','')||? WHERE id=? AND ${mine.sql}`, notes.join(" "), v.id, ...mine.args));
  if (reuse)
    stmts.push(statusStmt(env, v.id, payload.only, "mdic", reuse.state, { lastPeriod: reuse.last_period, lines: reuse.lines, error: `MDIC reaproveitado da versão ${reuse.version_id} (arquivo sem mudança).`, at, guard: mine }));
  if (!Object.keys(validators).length)
    stmts.push(s(env, `UPDATE trade_list_status SET state='data_unavailable',error='nenhum ano do MDIC publicado',updated_at=? WHERE version_id=? AND source='mdic' AND state='pending' AND ${mine.sql}`, at, v.id, ...mine.args));
  return stmts;
}

async function reusableMdic(env, iso3, validators) {
  const cur = await s(env, "SELECT c.version_id,v.mdic_validators_json,st.state,st.last_period,st.lines FROM trade_list_current c JOIN trade_list_versions v ON v.id=c.version_id JOIN trade_list_status st ON st.version_id=c.version_id AND st.iso3=c.iso3 AND st.source='mdic' WHERE c.iso3=? AND c.source='mdic'", iso3).first();
  if (!cur) return null;
  const old = JSON.parse(cur.mdic_validators_json);
  const same = Object.keys(validators).length && Object.entries(validators).every(([y, v]) => old[y] && old[y].size === v.size && old[y].etag === v.etag && old[y].lastModified === v.lastModified);
  return same ? cur : null;
}

async function mdicChunk({ env, payload, version: v, done, fetch: f }) {
  const val = JSON.parse(v.mdic_validators_json)[payload.year];
  if (!val || val.gen !== payload.gen) throw new AdapterError("schema", "Geração do arquivo mudou.", { code: "source_changed" });
  const classification = JSON.parse(v.classification_json);
  const r = await mdic.processChunk(MDIC_BASE(env), { ...payload, version: val, agriChapters: classification.chapters }, f);
  const out = await putJson(env, `trade-staging/${v.id}/mdic-chunk/${payload.year}/g${payload.gen}/${payload.n}.json`, r);
  return [done(out.key, out.sha)];
}

async function mdicMerge({ env, at, payload, version: v, done, mine }) {
  const codes = Object.fromEntries((await s(env, "SELECT mdic_code,iso3 FROM country_mdic_codes").all()).results.map((r) => [r.mdic_code, r.iso3]));
  const members = payload.only
    ? [payload.only]
    : (await s(env, "SELECT DISTINCT iso3 FROM country_mdic_codes").all()).results.map((r) => r.iso3).filter((iso) => bucketOf(iso) === payload.bucket);
  const ncm = await getJson(env, `trade-ref/${payload.ncmVersion ?? v.id}/ncm.json`);
  const acc = createAccumulator(codes, members);
  for (const key of payload.chunks) acc.add((await getJson(env, key)).rows);
  const stmts = [done()];
  const meta = { versionId: v.id, ncm, validators: JSON.parse(v.mdic_validators_json), classificationVersion: JSON.parse(v.classification_json).version };
  for (const iso of members) {
    const obj = acc.countryObject(iso, meta);
    const out = await putJson(env, `trade-src/${v.id}/mdic/${iso}.json`, obj);
    stmts.push(statusStmt(env, v.id, iso, "mdic", obj.state, { lastPeriod: obj.lastPeriod, lines: obj.lines.length, at, guard: mine }));
    stmts.push(pointerStmt(env, v.id, iso, "mdic", out.key, out.sha, at, mine));
  }
  if (acc.unknownCodes) stmts.push(s(env, `UPDATE trade_list_versions SET note=COALESCE(note||' ','')||? WHERE id=? AND ${mine.sql}`, `MDIC: ${acc.unknownCodes} agregados com CO_PAIS sem país no cadastro (bloco ${payload.bucket ?? payload.only}).`, v.id, ...mine.args));
  return stmts;
}

async function comtradeRef({ env, version: v, done, fetch: f }) {
  const classification = JSON.parse(v.classification_json);
  const blocks = await comtrade.loadHsBlocks(COMTRADE_BASE(env), classification.chapters, f);
  const out = await putJson(env, `trade-ref/${v.id}/hs6-blocks.json`, blocks);
  return [done(out.key, out.sha)];
}

async function comtradeDa({ env, at, payload, version: v, params, done, mine, fetch: f }) {
  const years = await comtrade.availableYears(COMTRADE_BASE(env), payload.code, f);
  const stmts = [done()];
  if (!years.length) {
    const obj = { iso3: payload.iso3, versionId: v.id, source: "comtrade", state: "not_declared", lastPeriod: null, years: [], lines: [] };
    const out = await putJson(env, `trade-src/${v.id}/comtrade/${payload.iso3}.json`, obj);
    stmts.push(statusStmt(env, v.id, payload.iso3, "comtrade", "not_declared", { at, guard: mine }));
    stmts.push(pointerStmt(env, v.id, payload.iso3, "comtrade", out.key, out.sha, at, mine));
    return stmts;
  }
  const recent = years.slice(-params.comtradeYears);
  const ref = await getJson(env, `trade-ref/${payload.refVersion ?? v.id}/hs6-blocks.json`);
  ref.blocks.forEach((_, b) =>
    stmts.push(insertJob(env, job(v.id, "comtrade_call", `comtrade:${payload.iso3}:${b}`, { iso3: payload.iso3, code: payload.code, years: recent, block: b, refVersion: payload.refVersion ?? v.id }), mine)),
  );
  return stmts;
}

async function comtradeCall({ env, payload, version: v, done, fetch: f }) {
  const ref = await getJson(env, `trade-ref/${payload.refVersion}/hs6-blocks.json`);
  const lines = await comtrade.fetchImports(COMTRADE_BASE(env), env.COMTRADE_KEY, { comtradeCode: payload.code, years: payload.years, hs6Block: ref.blocks[payload.block] }, f);
  const out = await putJson(env, `trade-staging/${v.id}/comtrade/${payload.iso3}/${payload.block}.json`, { years: payload.years, lines });
  return [done(out.key, out.sha)];
}

async function consolidateComtrade({ env, at, payload, version: v, done, mine }) {
  const lines = [];
  let years = [];
  for (const key of payload.parts) {
    const part = await getJson(env, key);
    years = part.years;
    lines.push(...part.lines);
  }
  lines.sort((a, b) => (a.hs6 + a.year + a.origin).localeCompare(b.hs6 + b.year + b.origin));
  const state = lines.some((l) => (l.valueUsd ?? 0) > 0) ? "purchase_identified" : "no_record";
  const lastPeriod = years.length ? String(Math.max(...years)) : null;
  // Descrição oficial das subposições (HS.json da Comtrade) só para as que aparecem na lista do país.
  const ref = await getJson(env, `trade-ref/${v.id}/hs6-blocks.json`).catch(() => ({ names: {} }));
  const names = Object.fromEntries([...new Set(lines.map((l) => l.hs6))].filter((h) => ref.names?.[h]).map((h) => [h, ref.names[h]]));
  const obj = { iso3: payload.iso3, versionId: v.id, source: "comtrade", state, lastPeriod, years, basis: "CIF", view: "importações declaradas pelo país", classification: JSON.parse(v.classification_json).version, names, lines };
  const out = await putJson(env, `trade-src/${v.id}/comtrade/${payload.iso3}.json`, obj);
  return [done(out.key, out.sha), statusStmt(env, v.id, payload.iso3, "comtrade", state, { lastPeriod, lines: lines.length, at, guard: mine }), pointerStmt(env, v.id, payload.iso3, "comtrade", out.key, out.sha, at, mine)];
}

// ---------- transições derivadas do estado ----------

export async function advance(env, vid, deps = {}) {
  const at = deps.now?.() ?? clock();
  const v = await version(env, vid);
  if (!v || v.status !== "running") return;
  const jobs = (await s(env, "SELECT id,kind,job_key,status,payload_json,result_r2_key,error FROM trade_list_jobs WHERE version_id=?", vid).all()).results;
  const by = (kind) => jobs.filter((j) => j.kind === kind);
  const has = (key) => jobs.some((j) => j.job_key === key);
  const stmts = [];
  const refDone = by("mdic_ref").filter((j) => j.status === "done");
  const validators = JSON.parse(v.mdic_validators_json);
  const only = v.kind === "manual" ? v.iso3 : null;
  // Tamanho do pedaço: 8 MiB; MDIC_CHUNK_BYTES só existe para os testes dividirem arquivos pequenos.
  const chunkBytes = Number(env.MDIC_CHUNK_BYTES) || mdic.CHUNK_BYTES;
  const mdicOpen = by("mdic_ref").some((j) => ["pending", "leased"].includes(j.status));
  // 1) Pedaços de cada ano publicado, na geração vigente (sem pedaços se o agregado foi reaproveitado).
  if (refDone.length)
    for (const [year, val] of Object.entries(validators)) {
      if (val.reused) continue;
      for (const r of mdic.chunkRanges(val.size, chunkBytes)) {
        const key = `mdic:${year}:g${val.gen}:${r.n}`;
        if (!has(key)) stmts.push(insertJob(env, job(vid, "mdic_chunk", key, { year: Number(year), gen: val.gen, ...r, only })));
      }
    }
  // 2) Todos os pedaços vigentes prontos → junção por grupo de países (ou só o país da versão manual).
  const current = Object.entries(validators).filter(([, val]) => !val.reused);
  const expected = current.flatMap(([year, val]) => mdic.chunkRanges(val.size, chunkBytes).map((r) => `mdic:${year}:g${val.gen}:${r.n}`));
  const chunkDone = new Map(by("mdic_chunk").filter((j) => j.status === "done").map((j) => [j.job_key, j.result_r2_key]));
  const chunkFailed = by("mdic_chunk").some((j) => j.status === "failed" && expected.includes(j.job_key));
  if (!mdicOpen && refDone.length && expected.length && expected.every((k) => chunkDone.has(k))) {
    const gens = current.map(([y, val]) => `${y}g${val.gen}`).join("-");
    const chunks = expected.map((k) => chunkDone.get(k));
    const buckets = only ? [null] : [...Array(MERGE_BUCKETS).keys()];
    for (const b of buckets) {
      const key = `mdic_merge:${gens}:${b ?? only}`;
      if (!has(key)) stmts.push(insertJob(env, job(vid, "mdic_merge", key, { bucket: b, only, chunks })));
    }
  }
  // Falha definitiva da leitura do MDIC → países pendentes ficam indisponíveis (ponteiro anterior preservado).
  const mdicDead = by("mdic_ref").some((j) => j.status === "failed") || chunkFailed || by("mdic_merge").some((j) => j.status === "failed");
  if (mdicDead)
    stmts.push(s(env, "UPDATE trade_list_status SET state='data_unavailable',error=?,updated_at=? WHERE version_id=? AND source='mdic' AND state='pending'", `MDIC não atualizado em ${v.reference_month}.`, at, vid));
  // 3) Comtrade: disponibilidade por país depois da tabela de SH6.
  const cref = by("comtrade_ref")[0];
  if (cref?.status === "done") {
    const countries = (await s(env, "SELECT iso3,comtrade_code FROM countries WHERE comtrade_code IS NOT NULL" + (only ? " AND iso3=?" : ""), ...(only ? [only] : [])).all()).results;
    for (const c of countries) if (!has(`comtrade_da:${c.iso3}`)) stmts.push(insertJob(env, job(vid, "comtrade_da", `comtrade_da:${c.iso3}`, { iso3: c.iso3, code: c.comtrade_code })));
  }
  // Chave ausente ou recusada vem antes das falhas genéricas: o motivo certo aparece para o admin.
  if (v.comtrade_blocked)
    stmts.push(s(env, "UPDATE trade_list_status SET state='data_unavailable',error=?,updated_at=? WHERE version_id=? AND source='comtrade' AND state='pending'", v.comtrade_blocked === "no_key" ? "Chave da Comtrade não configurada." : "Chave da Comtrade recusada.", at, vid));
  // 4) Todas as chamadas de um país prontas → consolidação; alguma falha → indisponível.
  const calls = new Map();
  for (const j of by("comtrade_call")) {
    const iso = JSON.parse(j.payload_json).iso3;
    (calls.get(iso) || calls.set(iso, []).get(iso)).push(j);
  }
  for (const [iso, list] of calls) {
    if (list.some((j) => j.status === "failed"))
      stmts.push(s(env, "UPDATE trade_list_status SET state='data_unavailable',error=?,updated_at=? WHERE version_id=? AND iso3=? AND source='comtrade' AND state='pending'", `Comtrade não atualizada em ${v.reference_month}.`, at, vid, iso));
    else if (list.every((j) => j.status === "done") && !has(`consolidate:comtrade:${iso}`))
      stmts.push(insertJob(env, job(vid, "consolidate", `consolidate:comtrade:${iso}`, { iso3: iso, parts: list.sort((a, b) => JSON.parse(a.payload_json).block - JSON.parse(b.payload_json).block).map((j) => j.result_r2_key) })));
  }
  const cfailed = [...by("comtrade_ref"), ...by("comtrade_da"), ...by("consolidate")].filter((j) => j.status === "failed");
  for (const j of cfailed) {
    const iso = JSON.parse(j.payload_json).iso3;
    stmts.push(
      iso
        ? s(env, "UPDATE trade_list_status SET state='data_unavailable',error=?,updated_at=? WHERE version_id=? AND iso3=? AND source='comtrade' AND state='pending'", `Comtrade não atualizada em ${v.reference_month}.`, at, vid, iso)
        : s(env, "UPDATE trade_list_status SET state='data_unavailable',error=?,updated_at=? WHERE version_id=? AND source='comtrade' AND state='pending'", `Comtrade não atualizada em ${v.reference_month}.`, at, vid),
    );
  }
  if (stmts.length) {
    for (let i = 0; i < stmts.length; i += 90) await commit(env, stmts.slice(i, i + 90));
    // Só recomeça se criou job novo (atualizações de estado repetidas não podem gerar laço).
    const after = (await s(env, "SELECT COUNT(*) n FROM trade_list_jobs WHERE version_id=?", vid).first()).n;
    if (after > jobs.length) return advance(env, vid, deps);
  }
  // 5) Nada em andamento → fecha a versão.
  const open = jobs.some((j) => ["pending", "leased"].includes(j.status) && !(v.comtrade_blocked && COMTRADE_KINDS.has(j.kind)));
  if (!open) await closeVersion(env, v, at, deps);
}

async function closeVersion(env, v, at, deps) {
  const counts = (await s(env, "SELECT source,state,COUNT(*) n FROM trade_list_status WHERE version_id=? GROUP BY source,state", v.id).all()).results;
  const pending = counts.filter((c) => c.state === "pending").reduce((t, c) => t + c.n, 0);
  if (pending) {
    // Nada rodando e ainda há país pendente: estado inconsistente vira indisponível, nunca "nenhum registro".
    await s(env, "UPDATE trade_list_status SET state='data_unavailable',error=?,updated_at=? WHERE version_id=? AND state='pending'", `Não atualizado em ${v.reference_month}.`, at, v.id).run();
  }
  const final = (await s(env, "SELECT state,COUNT(*) n FROM trade_list_status WHERE version_id=? GROUP BY state", v.id).all()).results;
  const unavailable = (await s(env, "SELECT COUNT(*) n FROM trade_list_status WHERE version_id=? AND state NOT IN ('purchase_identified','no_record','not_declared') AND COALESCE(error,'')<>'país sem código nesta fonte'", v.id).first()).n;
  const status = unavailable ? "partial" : "complete";
  const calls = (await s(env, "SELECT COUNT(*) n FROM trade_list_jobs WHERE version_id=? AND kind IN ('comtrade_ref','comtrade_da','comtrade_call')", v.id).first()).n;
  const failed = (await s(env, "SELECT COUNT(*) n FROM trade_list_jobs WHERE version_id=? AND status='failed'", v.id).first()).n;
  const upd = await s(env, "UPDATE trade_list_versions SET status=?,finished_at=? WHERE id=? AND status='running'", status, at, v.id).run();
  if (!upd.meta.changes) return;
  const tenant = env.DEFAULT_TENANT_ID || "eag-internal";
  await commit(env, [auditStatement(env, SYSTEM(tenant), "cron", "trade_list.closed", "trade_list_version", v.id, { status, states: Object.fromEntries(final.map((c) => [c.state, c.n])), comtradeCalls: calls, failedJobs: failed })]);
  await deletePrefix(env, `trade-staging/${v.id}/`);
  await prune(env, JSON.parse(v.params_json).retention);
}

async function deletePrefix(env, prefix, keep = new Set()) {
  let cursor;
  do {
    const l = await r2(env).list({ prefix, cursor });
    const keys = l.objects.map((o) => o.key).filter((k) => !keep.has(k));
    if (keys.length) await r2(env).delete(keys);
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
}

// Poda: guarda as N versões mais novas; das antigas, apaga só o que ninguém referencia (errata item 10).
export async function prune(env, retention) {
  const versions = (await s(env, "SELECT id FROM trade_list_versions WHERE status<>'running' ORDER BY started_at DESC").all()).results.map((r) => r.id);
  const old = versions.slice(retention);
  if (!old.length) return { pruned: 0 };
  const refs = new Set(
    (
      await s(
        env,
        "SELECT r2_key k FROM trade_list_current UNION SELECT comtrade_r2_key FROM country_analyses WHERE comtrade_r2_key IS NOT NULL UNION SELECT mdic_r2_key FROM country_analyses WHERE mdic_r2_key IS NOT NULL",
      ).all()
    ).results.map((r) => r.k),
  );
  const refVersions = new Set(
    (await s(env, "SELECT version_id v FROM trade_list_current UNION SELECT comtrade_version_id FROM country_analyses WHERE comtrade_version_id IS NOT NULL UNION SELECT mdic_version_id FROM country_analyses WHERE mdic_version_id IS NOT NULL").all()).results.map((r) => r.v),
  );
  for (const id of old) {
    await deletePrefix(env, `trade-src/${id}/`, refs);
    // Tabelas de referência (NCM e SH6) continuam enquanto algum objeto da versão for referenciado.
    if (!refVersions.has(id)) await deletePrefix(env, `trade-ref/${id}/`);
  }
  return { pruned: old.length };
}

// ---------- rotas ----------

export async function listCountries(request, env) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase().slice(0, 60);
  const rows = (
    await s(
      env,
      `SELECT c.iso3,c.iso2,c.name_pt,c.name_en,c.comtrade_code,c.default_language,
        ct.version_id comtrade_version,sc.state comtrade_state,sc.last_period comtrade_last_period,
        md.version_id mdic_version,sm.state mdic_state,sm.last_period mdic_last_period
       FROM countries c
       LEFT JOIN trade_list_current ct ON ct.iso3=c.iso3 AND ct.source='comtrade'
       LEFT JOIN trade_list_status sc ON sc.version_id=ct.version_id AND sc.iso3=c.iso3 AND sc.source='comtrade'
       LEFT JOIN trade_list_current md ON md.iso3=c.iso3 AND md.source='mdic'
       LEFT JOIN trade_list_status sm ON sm.version_id=md.version_id AND sm.iso3=c.iso3 AND sm.source='mdic'
       ORDER BY c.name_pt`,
    ).all()
  ).results.filter((r) => !q || r.name_pt.toLowerCase().includes(q) || r.name_en.toLowerCase().includes(q) || r.iso3.toLowerCase() === q);
  const latest = await s(env, "SELECT id,reference_month,status,finished_at FROM trade_list_versions WHERE kind='monthly' AND status<>'running' ORDER BY started_at DESC LIMIT 1").first();
  // "não atualizado em <mês>": ponteiro vigente é de versão anterior à última rotina mensal fechada.
  const lastMonth = latest?.reference_month ?? null;
  const stale = (vid) => !!(lastMonth && vid && !vid.startsWith(lastMonth) && vid < lastMonth);
  return {
    latest,
    items: rows.map((r) => ({ ...r, comtrade_stale: stale(r.comtrade_version) ? lastMonth : null, mdic_stale: stale(r.mdic_version) ? lastMonth : null })),
  };
}

export async function listVersions(env) {
  const versions = (await s(env, "SELECT id,kind,iso3,reference_month,status,comtrade_blocked,started_at,finished_at,note FROM trade_list_versions ORDER BY started_at DESC LIMIT 24").all()).results;
  const out = [];
  for (const v of versions) {
    const states = (await s(env, "SELECT source,state,COUNT(*) n FROM trade_list_status WHERE version_id=? GROUP BY source,state", v.id).all()).results;
    const jobs = (await s(env, "SELECT status,COUNT(*) n FROM trade_list_jobs WHERE version_id=? GROUP BY status", v.id).all()).results;
    out.push({ ...v, states, jobs: Object.fromEntries(jobs.map((j) => [j.status, j.n])) });
  }
  const budget = await s(env, "SELECT day,used FROM provider_budget WHERE provider='comtrade' ORDER BY day DESC LIMIT 1").first();
  return { items: out, comtradeBudget: budget ?? null };
}

// Atualização manual de um país (R12.15): admin, 1 por dia por país, motivo obrigatório.
export async function manualRefresh(request, env, actor, rid, iso3, deps = {}) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 10) fail(422, "reason_required", "Descreva o motivo (mínimo 10 caracteres).");
  const country = await s(env, "SELECT * FROM countries WHERE iso3=?", String(iso3).toUpperCase()).first();
  if (!country) fail(404, "country_not_found", "País não encontrado.");
  const at = deps.now?.() ?? clock();
  const params = await routineParams(env, actor.tenant_id);
  if (!env.FILES) fail(503, "r2_missing", "Armazenamento R2 não configurado.");
  const { month } = spMonthDay(at);
  const vid = `${month}-manual-${country.iso3}-${crypto.randomUUID().slice(0, 8)}`;
  const stmts = [
    s(env, "INSERT INTO trade_list_versions(id,kind,iso3,reference_month,classification_json,params_json,started_at) VALUES (?,'manual',?,?,?,?,?)", vid, country.iso3, month, JSON.stringify(params.classification), JSON.stringify(params), at),
    s(env, "INSERT INTO trade_list_manual_refresh(iso3,day,version_id,requested_by,reason) VALUES (?,?,?,?,?)", country.iso3, utcDay(at), vid, actor.id, reason),
    ...(mdicExternal(env) ? [] : [s(env, "INSERT INTO trade_list_status(version_id,iso3,source,state,updated_at) VALUES (?,?,'mdic','pending',?)", vid, country.iso3, at)]),
    country.comtrade_code == null
      ? s(env, "INSERT INTO trade_list_status(version_id,iso3,source,state,error,updated_at) VALUES (?,?,'comtrade','data_unavailable','país sem código nesta fonte',?)", vid, country.iso3, at)
      : s(env, "INSERT INTO trade_list_status(version_id,iso3,source,state,updated_at) VALUES (?,?,'comtrade','pending',?)", vid, country.iso3, at),
    ...baseJobs(env, vid, params, at, country.iso3).map((j) => insertJob(env, j)),
    auditStatement(env, actor, rid, "trade_list.manual_refresh", "country", country.iso3, { versionId: vid, reason }),
  ];
  try {
    await env.DB.batch(stmts);
  } catch (e) {
    if (/UNIQUE|PRIMARY/.test(String(e?.message))) fail(409, "refresh_already_today", "Este país já foi atualizado manualmente hoje.");
    throw e;
  }
  await advance(env, vid, deps);
  await sweep(env, deps);
  return { versionId: vid };
}

// Início manual da rotina do mês (T12 passo 5): mesmo código do cron.
export async function runNow(request, env, actor, rid, deps = {}) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 10) fail(422, "reason_required", "Descreva o motivo (mínimo 10 caracteres).");
  if (!env.FILES) fail(503, "r2_missing", "Armazenamento R2 não configurado.");
  const r = await startMonthlyRun(env, actor.tenant_id, deps);
  await commit(env, [auditStatement(env, actor, rid, "trade_list.run_now", "trade_list_version", r.versionId, { reason })]);
  return r;
}

// Retoma a Comtrade depois de a chave ser corrigida: limpa o bloqueio e reabre os jobs que falharam por chave.
export async function resumeVersion(request, env, actor, rid, vid, deps = {}) {
  requireRole(actor, ADMIN);
  await bodyJson(request);
  const v = await version(env, vid);
  if (!v) fail(404, "version_not_found", "Versão não encontrada.");
  if (v.status !== "running") fail(409, "version_closed", "Versão já fechada; use a atualização manual do país.");
  await commit(env, [
    s(env, "UPDATE trade_list_versions SET comtrade_blocked=NULL WHERE id=?", vid),
    s(env, "UPDATE trade_list_jobs SET status='pending',attempts=0,next_attempt_at=NULL,enqueued_at=NULL,error_kind=NULL,error=NULL WHERE version_id=? AND status='failed' AND error_kind IN ('auth','no_key')", vid),
    s(env, "UPDATE trade_list_status SET state='pending',error=NULL WHERE version_id=? AND source='comtrade' AND state='data_unavailable' AND error LIKE 'Chave da Comtrade%'", vid),
    auditStatement(env, actor, rid, "trade_list.resumed", "trade_list_version", vid),
  ]);
  await advance(env, vid, deps);
  await sweep(env, deps);
  return { versionId: vid };
}
