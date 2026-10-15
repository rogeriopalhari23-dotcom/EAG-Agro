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

// Status do resultado (automático) ou exceção (precisa de análise humana).
function classify(est, d, a, pendingConc, fetchProblem) {
  const reasons = [];
  if (a.restriction.status === "conflict") reasons.push("restrição conflita com a variedade");
  if (pendingConc.some((p) => /Situação cadastral/.test(p))) reasons.push("situação cadastral não ativa");
  if (pendingConc.some((p) => /divergentes|difere/.test(p))) reasons.push("dados divergentes entre fontes");
  if (est.provisional) reasons.push("unidade sem identificador cadastral");
  if (d.nearLimit) reasons.push("perto do limite do raio");
  if (fetchProblem) reasons.push("consulta cadastral pendente");
  if (d.inside === "outside") return { status: "outside", reasons: ["fora do raio"] };
  if (a.role === "trader" || a.role === "reseller") return { status: "separated", reasons: [a.role === "trader" ? "trader/originadora" : "revendedora"], exceptionReasons: reasons };
  if (reasons.length) return { status: "exception", reasons };
  if (a.commodityUse.status === "proved" && a.purchase.status === "proved") return { status: "qualified_purchase", reasons: [] };
  if (a.commodityUse.status === "proved") return { status: "qualified_use", reasons: [] };
  return { status: "discovery", reasons: [] };
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
    const maxAgeMs = (src?.maxAgeDays ?? 30) * 86400000;
    const fresh = registry && Date.parse(now) - Date.parse(registry.fetchedAt) <= maxAgeMs;
    if (!est.provisional && !fresh) {
      if (!src) fetchProblem = `Fonte cadastral não configurada para ${est.country}.`;
      else if (!fetchers[src.id]) fetchProblem = `Fonte ${src.id} sem implementação disponível nesta execução.`;
      else if (blocked.has(src.id)) fetchProblem = `Fonte ${src.id} em limite de consulta: tentar depois.`;
      else {
        try {
          await limiters.get(src.id)();
          const rec = await fetchers[src.id](est);
          registry = rec ? { ...rec, source: src.id, fetchedAt: now } : null;
          if (!rec) fetchProblem = `Identificador não encontrado em ${src.id}.`;
        } catch (err) {
          if (err?.status === 429) blocked.add(src.id);
          fetchProblem = `Consulta a ${src.id} falhou (${err?.status ?? err?.code ?? "erro"}): pendente.`;
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
      municipality: munName ?? null, registry, distance: d, assessment: a, status: c.status, reasons: c.reasons,
      siblings, sizeHint: est.hints?.size ?? registry?.size ?? "unknown", segment: est.hints?.segment ?? null, pending,
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
  return { ok: true, config, origin, results, exceptions: results.filter((r) => r.status === "exception"), counters, state: next };
}
