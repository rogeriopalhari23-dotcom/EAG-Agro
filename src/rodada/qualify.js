// Qualificação de um estabelecimento a partir de evidências com força declarada. Regras gerais:
//  - só fonte própria ou registro oficial (configuráveis em evidence.confirming) COMPROVA; diretório, resumo de busca e
//    código de atividade são INDÍCIO;
//  - uso/processamento, compra de terceiros e revenda são dimensões separadas;
//  - ausência de restrição não é aceitação; restrição que conflita com a variedade configurada é exceção para análise;
//  - falta de regra para a commodity/segmento/país vira pendência explícita, nunca adaptação silenciosa.
// Evidência: { kind, strength, url, date, quote, value?, channelType? }
//   kind ∈ operation | commodity_use | purchase | resale | trade | restriction | channel | activity_code
//   strength ∈ own_source | official_record | press | academic | directory | search_summary | activity_code

const EXPIRED = (date, maxAgeDays, now) => (maxAgeDays && date ? (Date.parse(now) - Date.parse(date)) / 86400000 > maxAgeDays : false);

function level(evs, kind, config, now) {
  const list = evs.filter((e) => e.kind === kind);
  if (!list.length) return { status: "none", sources: [] };
  const confirming = list.filter((e) => config.evidence.confirming.includes(e.strength) && !EXPIRED(e.date, config.evidence.maxAgeDays, now));
  if (confirming.length) return { status: "proved", sources: confirming };
  return { status: "indication", sources: list };
}

// rules: { segments: { [segment]: { useKeywords, activityCodes } }, countries: { [CC]: {...} } } (vêm da configuração)
export function assess(est, config, { now = new Date().toISOString(), registry = null } = {}) {
  const evs = est.evidence ?? [];
  const pending = [];
  const out = {};
  out.operation = level(evs, "operation", config, now);
  if (registry?.status && /^ativ/i.test(registry.status) && out.operation.status === "none") out.operation = { status: "indication", sources: [{ kind: "operation", strength: "official_record", quote: `cadastro: ${registry.status}` }] };
  // Situação cadastral ativa não prova que a unidade opera hoje: só indício.
  out.commodityUse = level(evs, "commodity_use", config, now);
  // Código de atividade nunca comprova uso da commodity.
  if (out.commodityUse.status === "none" && evs.some((e) => e.kind === "activity_code")) out.commodityUse = { status: "indication", sources: evs.filter((e) => e.kind === "activity_code") };
  out.purchase = level(evs, "purchase", config, now);
  out.resale = level(evs, "resale", config, now);
  out.trade = level(evs, "trade", config, now);
  // Papel: consumidor/processador × revendedor × trader. Processar não prova comprar de terceiros.
  out.role =
    out.trade.status === "proved" ? "trader" :
    out.resale.status === "proved" && out.commodityUse.status !== "proved" ? "reseller" :
    out.commodityUse.status === "proved" ? "final_consumer_or_processor" :
    out.resale.status === "indication" ? "possible_reseller" : "unknown";
  // Restrições: conflito com a variedade configurada (ex.: variedade GMO × "não transgênico").
  const restr = evs.filter((e) => e.kind === "restriction");
  const hints = (config.commodity.restrictionHints ?? []).map((h) => new RegExp(h, "i"));
  const conflicting = restr.filter((e) => hints.some((h) => h.test(`${e.value ?? ""} ${e.quote ?? ""}`)));
  out.restriction = conflicting.length
    ? { status: "conflict", scope: conflicting.map((e) => e.scope ?? "não informado"), sources: conflicting }
    : restr.length ? { status: "noted", sources: restr } : { status: "none_found" };
  out.varietyAcceptance = config.commodity.variety ? "not_confirmed" : "not_applicable";
  // Canais: só os publicados em fonte identificável; tipo explícito (compras × geral × vendas). E-mail nunca é deduzido.
  out.channels = evs
    .filter((e) => e.kind === "channel" && e.url)
    .map((e) => ({ type: e.channelType ?? "unknown", value: e.value, source: e.url, date: e.date ?? null, verified: config.evidence.confirming.includes(e.strength) }));
  if (evs.some((e) => e.kind === "channel" && !e.url)) pending.push("Canal sem fonte identificável: descartado.");
  if (!out.channels.some((c) => c.type === "purchasing" && c.verified)) pending.push("Canal de compras publicado não encontrado.");
  // Regras por commodity/segmento/país: ausência gera pendência explícita.
  const seg = est.hints?.segment;
  if (seg && !config.commodity.segments?.[seg]) pending.push(`Sem regra configurada para o segmento "${seg}" e a commodity "${config.commodity.code}".`);
  if (config.countryRules && !config.countryRules[est.country]) pending.push(`Sem regras configuradas para o país ${est.country}.`);
  if (out.operation.status !== "proved") pending.push("Operação atual não comprovada em fonte própria ou oficial.");
  if (out.commodityUse.status !== "proved") pending.push(`Uso de ${config.commodity.label ?? config.commodity.code} não comprovado.`);
  if (out.purchase.status !== "proved") pending.push("Compra de terceiros não comprovada.");
  if (out.restriction.status === "conflict") pending.push(`Restrição conflita com a variedade configurada (${config.commodity.variety}).`);
  if (config.commodity.variety) pending.push(`Aceitação da variedade ${config.commodity.variety} não confirmada.`);
  out.pending = pending;
  return out;
}
