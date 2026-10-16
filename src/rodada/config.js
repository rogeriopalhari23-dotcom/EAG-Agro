// Configuração de uma rodada de descoberta e qualificação (fluxo geral; o piloto é só um exemplo de configuração).
// Nada aqui conhece cidade, empresa, commodity ou distância: tudo vem da configuração validada abaixo.
// A validação devolve TODOS os problemas de uma vez (lista), para a rodada não começar meio configurada.

const UNITS = { km: 1, mi: 1.609344 };
const METHODS = new Set(["haversine"]);
const SIZES = new Set(["micro", "small", "medium", "large", "unknown"]);
const STRENGTHS = new Set(["own_source", "official_record", "press", "academic", "directory", "search_summary", "activity_code"]);

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const str = (v) => typeof v === "string" && v.trim().length > 0;

// cfg → { ok, errors: [texto], config: normalizado }
export function validateRoundConfig(cfg) {
  const e = [];
  if (!cfg || typeof cfg !== "object") return { ok: false, errors: ["Configuração ausente."], config: null };
  if (!str(cfg.id)) e.push("id da rodada obrigatório.");
  // Commodity: código, variedade/especificação opcional; regras por segmento e indícios por nome vêm da configuração.
  const c = cfg.commodity ?? {};
  if (!str(c.code)) e.push("commodity.code obrigatório (ex.: corn, soy, coffee).");
  if (c.variety != null && !str(c.variety)) e.push("commodity.variety, se informada, deve ser texto (ex.: GMO).");
  for (const k of ["nameHints", "restrictionHints"]) if (c[k] != null && !Array.isArray(c[k])) e.push(`commodity.${k} deve ser lista.`);
  // Comprador e finalidade de uso.
  const b = cfg.buyer ?? {};
  if (!Array.isArray(b.roles) || !b.roles.length) e.push("buyer.roles obrigatório (ex.: [\"final_consumer\", \"processor\"]).");
  if (b.uses != null && !Array.isArray(b.uses)) e.push("buyer.uses deve ser lista.");
  // Origem: coordenada explícita ou município do conjunto de dados (resolvido pela rodada).
  const o = cfg.origin ?? {};
  if (!str(o.country) || !/^[A-Z]{2}$/.test(o.country)) e.push("origin.country obrigatório (ISO de 2 letras).");
  const hasCoord = isNum(o.lat) && isNum(o.lon);
  if (!hasCoord && !str(o.municipality) && !str(o.municipalityCode)) e.push("origin: informe lat/lon ou o município (nome ou código).");
  if (hasCoord && (Math.abs(o.lat) > 90 || Math.abs(o.lon) > 180)) e.push("origin.lat/lon fora do intervalo.");
  // Raio, unidade e método; proximidade do limite acompanha o raio (fração ou faixa absoluta), nunca um corte fixo.
  const r = cfg.radius ?? {};
  if (!isNum(r.value) || r.value <= 0) e.push("radius.value obrigatório e positivo.");
  const unit = r.unit ?? "km";
  if (!UNITS[unit]) e.push(`radius.unit inválida (${unit}); use km ou mi.`);
  const method = r.method ?? "haversine";
  if (!METHODS.has(method)) e.push(`radius.method não suportado (${method}).`);
  const nl = cfg.nearLimit ?? { fraction: 0.1 };
  if (!(isNum(nl.fraction) && nl.fraction > 0 && nl.fraction < 1) && !(isNum(nl.distance) && nl.distance > 0))
    e.push("nearLimit: informe fraction (0–1) ou distance (na unidade do raio).");
  // Prioridades.
  const p = cfg.priorities ?? {};
  for (const s of p.size ?? []) if (!SIZES.has(s)) e.push(`priorities.size com valor desconhecido: ${s}.`);
  // Fontes e critérios de evidência.
  if (!Array.isArray(cfg.sources)) e.push("sources obrigatório (lista, pode ser vazia).");
  for (const s of cfg.sources ?? []) {
    if (!str(s.id) || !str(s.kind)) e.push("cada fonte precisa de id e kind.");
    if (s.rateLimitPerMinute != null && !(isNum(s.rateLimitPerMinute) && s.rateLimitPerMinute > 0)) e.push(`fonte ${s.id}: rateLimitPerMinute inválido.`);
  }
  const ev = cfg.evidence ?? {};
  const confirming = ev.confirming ?? ["own_source", "official_record"];
  for (const s of confirming) if (!STRENGTHS.has(s)) e.push(`evidence.confirming com força desconhecida: ${s}.`);
  // Idioma, fuso e escopo de compliance.
  const l = cfg.locale ?? {};
  if (!str(l.language)) e.push("locale.language obrigatório.");
  if (!str(l.timezone)) e.push("locale.timezone obrigatório.");
  const comp = cfg.compliance ?? {};
  if (!str(comp.scope)) e.push("compliance.scope obrigatório (ex.: br_email_automatic).");
  if (comp.sanctionsMaxAgeHours != null && !(isNum(comp.sanctionsMaxAgeHours) && comp.sanctionsMaxAgeHours > 0)) e.push("compliance.sanctionsMaxAgeHours inválido.");
  // Fase da pesquisa pública da rodada: encerrada, os desconhecidos viram pendência de contato futuro (sem pedido campo a campo).
  if (cfg.research?.publicPhase != null && !["open", "closed"].includes(cfg.research.publicPhase)) e.push("research.publicPhase: use open ou closed.");
  if (e.length) return { ok: false, errors: e, config: null };
  const factor = UNITS[unit];
  const radiusKm = r.value * factor;
  const nearKm = isNum(nl.fraction) ? radiusKm * nl.fraction : nl.distance * factor;
  return {
    ok: true,
    errors: [],
    config: {
      ...cfg,
      commodity: { nameHints: [], restrictionHints: [], segments: {}, ...c },
      buyer: { uses: [], separate: ["reseller", "trader"], ...b },
      radius: { value: r.value, unit, method, km: radiusKm },
      // Faixa "perto do limite": [raio − margem, raio]. Gera CONFERÊNCIA da localização, nunca exclusão automática.
      // Fora do raio é outra situação ("fora").
      nearLimit: { ...nl, km: nearKm, fromKm: radiusKm - nearKm, effect: "review", criterion: nearLimitCriterion(nl, r.value, unit) },
      priorities: { size: [], segments: [], ...p },
      evidence: { confirming, ...ev },
      compliance: { sanctionsMaxAgeHours: 720, ...comp },
    },
  };
}

// Critério explícito, para relatório e painel: proporcional (fração do raio) ou margem fixa.
function nearLimitCriterion(nl, radius, unit) {
  const fmt = (x) => (Math.round(x * 10) / 10).toLocaleString("pt-BR");
  if (isNum(nl.fraction)) return `proporcional: últimos ${fmt(nl.fraction * 100)}% do raio (de ${fmt(radius * (1 - nl.fraction))} a ${fmt(radius)} ${unit}); gera conferência, não exclusão`;
  return `margem fixa: últimos ${fmt(nl.distance)} ${unit} do raio (de ${fmt(radius - nl.distance)} a ${fmt(radius)} ${unit}); gera conferência, não exclusão`;
}

// Distância na unidade da rodada (para exibir como a configuração pediu).
export const toRoundUnit = (km, config) => km / UNITS[config.radius.unit];
