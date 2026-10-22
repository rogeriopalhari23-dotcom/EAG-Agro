// Exploração em segundo plano dos "Mercados a investigar" (2026-10-22): no cron de 5 minutos, dentro da política de
// pesquisa vigente e de limites definidos, inicia pesquisas internacionais em combinações com comércio comprovado e sem
// empresa identificada, para descobrir candidatas nas fontes pertinentes. Uma de cada vez; no máximo explorationPerDay
// por dia (política; padrão 6); progresso e último resultado persistidos; sem política, não faz nada. Usa a identidade de
// automação (sem conta de acesso). Pesquisa que acha candidatas leva a combinação para a seleção principal; consulta sem
// estabelecimentos ou falha volta para "a investigar" com nova tentativa no prazo registrado (src/availability.js).
// Nada de contato, ficha, campanha ativa ou envio: a pesquisa é a mesma do botão, com as mesmas regras.
import { statement as s, now } from "../store.js";
import { availabilityFor, EXPLORER_ID } from "../availability.js";
import { rankPairs } from "./rotation.js";
import { rebuildSummaries } from "../importers.js";
import { DEFAULT_PROFILE } from "./defaults.js";
import { currentPolicy, currentProfile, createJob, explorerActor, noteJob, ensureClassified } from "./engine.js";

export const EXPLORATION = "market_exploration";
const ACTIVE = ["queued", "running", "waiting", "needs_decision", "paused"];
const parse = (t, d = null) => { try { return t ? JSON.parse(t) : d; } catch { return d; } };
export const explorationLimits = (policy) => {
  const i = policy?.policy?.international ?? {};
  return { enabled: i.exploration !== false, perDay: Number(i.explorationPerDay) > 0 ? Number(i.explorationPerDay) : 6 };
};

async function record(env, at, result, error = null) {
  await s(env, "INSERT INTO maintenance_leases(name,last_started_at,last_finished_at,last_result_json,last_error,last_error_at) VALUES (?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET last_finished_at=excluded.last_finished_at,last_result_json=excluded.last_result_json,last_error=excluded.last_error,last_error_at=COALESCE(excluded.last_error_at,maintenance_leases.last_error_at),holder=NULL,lease_until=NULL",
    EXPLORATION, at, at, JSON.stringify(result), error, error ? at : null).run();
}
// Marca barata do que pode mudar a escolha (avaliações, pesquisas, lista de comércio).
async function marker(env, tenant) {
  const a = await s(env, "SELECT COUNT(*) n, MAX(assessed_at) m FROM market_assessments WHERE tenant_id=?", tenant).first();
  const j = await s(env, "SELECT COUNT(*) n, MAX(updated_at) m FROM prospect_jobs WHERE tenant_id=? AND market='international'", tenant).first();
  const v = await s(env, "SELECT COUNT(*) n, MAX(finished_at) f FROM trade_list_versions").first();
  return `${a?.n}|${a?.m}|${j?.n}|${j?.m}|${v?.n}|${v?.f}`;
}

export async function exploreTick(env, tenant, { at = now(), deps = {}, idleRecheckMs = 6 * 3600_000, leaseMs = 4 * 60_000 } = {}) {
  const policy = await currentPolicy(env, tenant);
  const actor = await explorerActor(env, tenant);
  if (!policy || !actor) return { state: "no_policy" };
  const lim = explorationLimits(policy);
  if (!lim.enabled) return { state: "disabled" };
  // Uma de cada vez: a exploração anterior ainda em andamento.
  const active = await s(env, `SELECT id FROM prospect_jobs WHERE tenant_id=? AND created_by=? AND status IN (${ACTIVE.map(() => "?").join(",")}) LIMIT 1`, tenant, EXPLORER_ID, ...ACTIVE).first();
  if (active) return { state: "busy", jobId: active.id };
  const day = at.slice(0, 10);
  const today = (await s(env, "SELECT COUNT(*) n FROM prospect_jobs WHERE tenant_id=? AND created_by=? AND created_at>=?", tenant, EXPLORER_ID, `${day}T00:00:00.000Z`).first()).n;
  if (today >= lim.perDay) return { state: "limit", today, perDay: lim.perDay };
  const prev = await s(env, "SELECT last_result_json,last_finished_at,lease_until FROM maintenance_leases WHERE name=?", EXPLORATION).first().catch(() => null);
  const last = parse(prev?.last_result_json, null);
  const mk = await marker(env, tenant);
  if (last?.state === "none" && last.marker === mk && prev?.last_finished_at && Date.parse(at) - Date.parse(prev.last_finished_at) < idleRecheckMs) return { state: "none", cached: true };
  // Exclusão mútua entre ciclos sobrepostos.
  await s(env, "INSERT OR IGNORE INTO maintenance_leases(name) VALUES (?)", EXPLORATION).run();
  const holder = crypto.randomUUID();
  const got = await s(env, "UPDATE maintenance_leases SET holder=?,lease_until=?,last_started_at=? WHERE name=? AND (lease_until IS NULL OR lease_until<?)", holder, new Date(Date.parse(at) + leaseMs).toISOString(), at, EXPLORATION, at).run();
  if (!got.meta?.changes) return { state: "lease_busy" };
  try {
    await ensureClassified(env, tenant, (await s(env, "SELECT * FROM products WHERE tenant_id=? AND active<>0", tenant).all()).results, policy);
    const products = (await s(env, "SELECT * FROM products WHERE tenant_id=? AND active<>0 AND identity_status='confirmed'", tenant).all()).results;
    const profile = (await currentProfile(env, tenant))?.profile ?? DEFAULT_PROFILE;
    const dest = await availabilityFor(env, tenant, { products, profile, deps: { rebuild: (e, t, o) => rebuildSummaries(e, t, { limit: 10, ...o }) }, at });
    const jobsByKey = new Map();
    for (const j of (await s(env, "SELECT input_json,created_at FROM prospect_jobs WHERE tenant_id=? AND market='international'", tenant).all()).results) {
      const i = parse(j.input_json, {});
      const k = `${i.productId}|${i.location?.iso3}`;
      (jobsByKey.get(k) ?? jobsByKey.set(k, []).get(k)).push(j);
    }
    for (const d of dest.items) for (const pr of d.products) pr.availability.sourcesToTry ??= dest.investigate.find((x) => x.iso3 === d.iso3 && x.productId === pr.productId)?.sourcesToTry ?? [];
    // Só mercados a investigar (exploração de mercados novos); as identificadas ficam com a pesquisa automática do botão.
    const list = rankPairs(dest, jobsByKey, at).list.filter((x) => x.pr.availability.tier === "investigate");
    const counts = { toInvestigate: dest.investigate.length, due: list.length, today, perDay: lim.perDay, identified: dest.principal.length, preparing: !!dest.preparing };
    if (!list.length) {
      await record(env, at, { state: "none", ...counts, marker: mk, at });
      return { state: "none", ...counts };
    }
    const best = list[0];
    const job = await createJob(new Request("https://compass.internal/api/prospect/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ market: "international", productId: best.pr.productId, location: { iso3: best.d.iso3 } }) }), env, actor, `explore-${holder}`, deps);
    const label = `${best.pr.name} × ${best.d.name}`;
    if (!job.reused) await noteJob(env, job.id, at, "plan", "ok", `Exploração automática em segundo plano (política de pesquisa v${policy.version}; ${today + 1} de ${lim.perDay} hoje; ${list.length} combinação(ões) a investigar com tentativa devida): ${label} — ${best.why}. Fontes de empresas: ${(best.pr.availability.sourcesToTry ?? []).map((x) => x.label).join("; ") || "—"}. Sem contato comercial.`);
    await record(env, at, { state: "started", jobId: job.id, pair: label, why: best.why, ...counts, today: today + 1, marker: mk, at });
    return { state: "started", jobId: job.id, pair: label, ...counts, today: today + 1 };
  } catch (e) {
    const msg = String(e?.message ?? e).slice(0, 200);
    await record(env, at, { state: "failed", at }, msg).catch(() => null);
    return { state: "failed", error: msg };
  }
}
