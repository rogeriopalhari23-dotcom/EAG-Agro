// Execução de uma rodada em lote: deduplicação, consulta cadastral (com limite de taxa), conciliação, distância,
// qualificação e separação entre resultado automático e EXCEÇÃO para análise. Sem rede própria: as fontes são funções
// injetadas (fetchers), o relógio também. Falha de uma fonte vira pendência daquele estabelecimento; o lote continua.
import { validateRoundConfig } from "./config.js";
import { municipalityIndex, resolveOrigin, distanceFor } from "./distance.js";
import { mergeCandidates, conciliate, groupByRoot } from "./establishment.js";
import { assess } from "./qualify.js";

// Limite de taxa por fonte (consultas por minuto), com relógio e espera injetáveis.
export function rateLimiter(perMinute, { now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const gap = perMinute ? 60000 / perMinute : 0;
  let next = 0;
  return async () => {
    const t = now();
    if (t < next) await sleep(next - t);
    next = Math.max(t, next) + gap;
  };
}

const fingerprint = (o) => JSON.stringify(o);

// Status do resultado (automático) ou exceção (precisa de análise humana). "Perto do limite" não é exceção: é uma
// CONFERÊNCIA (checks) que acompanha qualquer situação e nunca exclui a unidade sozinha.
function classify(est, d, a, pendingConc, fetchProblem) {
  const reasons = [];
  const checks = d.nearLimit ? ["perto do limite do raio"] : [];
  if (a.restriction.status === "conflict") reasons.push("restrição conflita com a variedade");
  if (pendingConc.some((p) => /Situação cadastral/.test(p))) reasons.push("situação cadastral não ativa");
  if (pendingConc.some((p) => /divergentes|difere/.test(p))) reasons.push("dados divergentes entre fontes");
  if (est.provisional) reasons.push("unidade sem identificador cadastral");
  if (fetchProblem) reasons.push("consulta cadastral pendente");
  if (d.inside === "outside") return { status: "outside", reasons: ["fora do raio"], checks: [] };
  if (a.role === "trader" || a.role === "reseller") return { status: "separated", reasons: [a.role === "trader" ? "trader/originadora" : "revendedora"], exceptionReasons: reasons, checks };
  if (reasons.length) return { status: "exception", reasons, checks };
  if (a.commodityUse.status === "proved" && a.purchase.status === "proved") return { status: "qualified_purchase", reasons: [], checks };
  if (a.commodityUse.status === "proved") return { status: "qualified_use", reasons: [], checks };
  return { status: "discovery", reasons: [], checks };
}

const PRIORITY = { qualified_purchase: 0, qualified_use: 1, exception: 2, discovery: 3, separated: 4, outside: 5 };

// input: { config, municipalities, candidates, fetchers: { [sourceId]: async (est) => record }, state, clock, now }
export async function runRound({ config: raw, municipalities, candidates, fetchers = {}, state = { establishments: {} }, clock = {}, now = new Date().toISOString() }) {
  const v = validateRoundConfig(raw);
  if (!v.ok) return { ok: false, errors: v.errors };
  const config = v.config;
  const index = municipalityIndex(municipalities);
  const origin = resolveOrigin(config, index);
  if (!origin) return { ok: false, errors: ["Origem não encontrada no conjunto de municípios: informe lat/lon ou um município existente."] };
  // Entram as candidatas novas e as já conhecidas da rodada (reexecução não duplica).
  const prev = Object.values(state.establishments ?? {}).map((s) => s.input);
  const ests = mergeCandidates([...prev, ...candidates]);
  const roots = groupByRoot(ests);
  const registrySources = (config.sources ?? []).filter((s) => s.kind === "registry");
  const limiters = new Map(registrySources.map((s) => [s.id, rateLimiter(s.rateLimitPerMinute, clock)]));
  const blocked = new Set(); // fonte que respondeu "limite atingido": não é mais chamada nesta execução
  const next = { establishments: {} };
  const results = [];
  const counters = { created: 0, updated: 0, unchanged: 0 };
  for (const est of ests) {
    const old = state.establishments?.[est.key];
    // Consulta cadastral: só com identificador completo e fonte configurada para o país; reaproveita a anterior válida.
    const src = registrySources.find((s) => !s.countries || s.countries.includes(est.country));
    let registry = old?.registry ?? null, fetchProblem = null;
    // Situação da consulta cadastral desta execução (o resumo conta a partir daqui, nunca do texto das pendências):
    // fetched | cached | deferred (limite interno, HTTP 429 ou fonte bloqueada após 429) | failed | not_found |
    // unavailable (sem fonte ou sem implementação) | not_applicable (sem identificador).
    let lookup = { status: est.provisional ? "not_applicable" : "cached", source: src?.id ?? null };
    const maxAgeMs = (src?.maxAgeDays ?? 30) * 86400000;
    const fresh = registry && Date.parse(now) - Date.parse(registry.fetchedAt) <= maxAgeMs;
    if (!est.provisional && !fresh) {
      if (!src) (fetchProblem = `Fonte cadastral não configurada para ${est.country}.`), (lookup = { status: "unavailable", source: null, cause: "no_source" });
      else if (!fetchers[src.id]) (fetchProblem = `Fonte ${src.id} sem implementação disponível nesta execução.`), (lookup = { status: "unavailable", source: src.id, cause: "no_implementation" });
      else if (blocked.has(src.id)) (fetchProblem = `Consulta a ${src.id} adiada: a fonte limitou as requisições nesta execução (HTTP 429); reexecutar depois.`), (lookup = { status: "deferred", source: src.id, cause: "blocked_after_429" });
      else {
        try {
          await limiters.get(src.id)();
          const rec = await fetchers[src.id](est);
          registry = rec ? { ...rec, source: src.id, fetchedAt: now } : null;
          lookup = { status: rec ? "fetched" : "not_found", source: src.id };
          if (!rec) fetchProblem = `Identificador não encontrado em ${src.id}.`;
        } catch (err) {
          if (err?.code === "rate_budget") (fetchProblem = `Consulta a ${src.id} adiada pelo limite de ${src.rateLimitPerMinute ?? "?"}/min: reexecutar para continuar.`), (lookup = { status: "deferred", source: src.id, cause: "budget" });
          else if (err?.status === 429) {
            blocked.add(src.id);
            fetchProblem = `Consulta a ${src.id} adiada: a fonte respondeu HTTP 429 (limite de requisições); reexecutar depois.`;
            lookup = { status: "deferred", source: src.id, cause: "http_429" };
          } else {
            fetchProblem = `Consulta a ${src.id} falhou (${err?.status ?? err?.code ?? "erro"}): pendente.`;
            lookup = { status: "failed", source: src.id, cause: String(err?.status ?? err?.code ?? "erro") };
          }
        }
      }
    }
    const munName = registry?.municipality ?? est.municipalities[0];
    const muni = index.find({ code: est.hints?.municipalityCode, name: munName, region: registry?.region ?? est.region, country: est.country });
    const d = distanceFor({ origin, unit: est.unit, municipality: muni, config });
    const pendingConc = conciliate(est, registry);
    const a = assess(est, config, { now, registry });
    const c = classify(est, d, a, pendingConc, fetchProblem);
    const siblings = est.root ? (roots.get(est.root) ?? []).filter((k) => k !== est.key) : [];
    const pending = [...pendingConc, ...(fetchProblem ? [fetchProblem] : []), ...(d.pending ? [d.pending] : []), ...a.pending];
    const result = {
      key: est.key, provisional: est.provisional, country: est.country, registrationId: est.registrationId, names: est.names,
      municipality: munName ?? null, registry, distance: d, assessment: a, status: c.status, reasons: c.reasons, checks: c.checks,
      siblings, sizeHint: est.hints?.size ?? registry?.size ?? "unknown", segment: est.hints?.segment ?? null, pending,
      intake: [...new Set(est.sources.map((x) => x.mode).filter(Boolean))], conciliatedFrom: est.conciliatedFrom ?? [], lookup,
    };
    const fp = fingerprint({ input: est, registry: registry && { ...registry, fetchedAt: undefined }, status: result.status, pending });
    counters[!old ? "created" : old.fingerprint === fp ? "unchanged" : "updated"]++;
    next.establishments[est.key] = { input: est, registry, fingerprint: fp, status: result.status };
    results.push(result);
  }
  // Ordem: melhor evidência primeiro; depois prioridades configuradas de porte e segmento; depois distância.
  const sizeRank = (s) => { const i = config.priorities.size.indexOf(s); return i < 0 ? 99 : i; };
  const segRank = (s) => { const i = config.priorities.segments.indexOf(s); return i < 0 ? 99 : i; };
  results.sort((x, y) => PRIORITY[x.status] - PRIORITY[y.status] || sizeRank(x.sizeHint) - sizeRank(y.sizeHint) || segRank(x.segment) - segRank(y.segment) || (x.distance.km ?? 1e9) - (y.distance.km ?? 1e9));
  // Contagem das consultas pela situação estruturada de cada estabelecimento (consistente com as pendências).
  const lookups = Object.fromEntries(["fetched", "cached", "deferred", "failed", "not_found", "unavailable", "not_applicable"].map((k) => [k, results.filter((r) => r.lookup.status === k).length]));
  return { ok: true, config, origin, results, lookups, exceptions: results.filter((r) => r.status === "exception"), review: results.filter((r) => r.status === "exception" || r.checks?.length), counters, state: next };
}
