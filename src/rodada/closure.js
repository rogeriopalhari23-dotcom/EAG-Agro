// Fechamento por estabelecimento (fluxo geral; vale para qualquer commodity, país ou rodada): o que foi verificado,
// conflitos de fonte, dados desconhecidos e o que fica para contato futuro. Calculado só das evidências, do cadastro
// e da distância — nenhuma regra por empresa e nenhum pedido de confirmação campo a campo.
//   - verificado: comprovado por fonte que a configuração aceita como comprovante, ou consulta cadastral feita;
//   - conflito: evidência marcada pela pessoa como conflitante (evidence.conflict) ou papel divergente entre o cadastro
//     oficial e o registro de atividade (regra por país; hoje só a CNAE do Brasil);
//   - desconhecido: campo sem prova (com o nível atual: indício ou sem evidência);
//   - contato futuro: campos que fonte pública normalmente não responde (compra de terceiros, aceitação da variedade,
//     responsável/canal de compras) e, quando a rodada encerra a fase de pesquisa pública
//     (config.research.publicPhase = "closed"), todos os demais desconhecidos.

// Divisões da CNAE (2 primeiros dígitos): indústria de transformação 10–33; comércio 45–47; armazenagem 52.
const BR_ROLE = (activity) => {
  const d = Number(String(activity ?? "").slice(0, 2));
  if (d >= 10 && d <= 33) return "manufacturing";
  if (d >= 45 && d <= 47) return "trade";
  if (d === 52) return "storage";
  return null;
};
const ROLE_LABEL = { manufacturing: "indústria", trade: "comércio", storage: "armazenagem" };
const MANUFACTURING_TEXT = /fabric|indústria|industria|manufactur|produç/i;

// Campos que só o próprio comprador costuma responder: vão para contato futuro mesmo com a pesquisa pública aberta.
const CONTACT_BY_NATURE = new Set(["purchase", "variety_acceptance", "purchasing_channel"]);

export function closureFor({ est, assessment: a, registry, distance: d, config, lookup }) {
  const verified = [], conflicts = [], unknown = [];
  const label = config.commodity.label ?? config.commodity.code;
  const src = (list) => (list ?? []).filter((e) => e.url).map((e) => e.url);
  const dim = (field, text, l) => (l.status === "proved" ? verified.push({ field, text, sources: src(l.sources) }) : unknown.push({ field, text, level: l.status }));

  if (registry) verified.push({ field: "registry", text: `Cadastro oficial consultado: situação ${registry.status ?? "não informada"}${registry.municipality ? `, ${registry.municipality}/${registry.region ?? ""}` : ""}`, sources: registry.url ? [registry.url] : [], at: registry.fetchedAt ?? null });
  else if (!est.provisional) unknown.push({ field: "registry", text: `Cadastro oficial não consultado${lookup?.status ? ` (${lookup.status})` : ""}`, level: "none" });
  dim("operation", "Operação atual", a.operation);
  dim("commodity_use", `Uso de ${label}`, a.commodityUse);
  dim("purchase", "Compra de terceiros", a.purchase);
  if (config.commodity.variety) unknown.push({ field: "variety_acceptance", text: `Aceitação de ${config.commodity.variety}`, level: "none" });
  if (["unknown", "possible_reseller"].includes(a.role)) unknown.push({ field: "role", text: "Papel (consumidora, fabricante, armazenadora ou revendedora)", level: a.role === "possible_reseller" ? "indication" : "none" });
  else verified.push({ field: "role", text: `Papel: ${a.role}`, sources: [] });
  const purchasing = a.channels.filter((c) => c.type === "purchasing" && c.verified);
  if (purchasing.length) verified.push({ field: "purchasing_channel", text: "Canal de compras publicado", sources: purchasing.map((c) => c.source) });
  else unknown.push({ field: "purchasing_channel", text: "Responsável e canal de compras", level: a.channels.length ? "indication" : "none" });
  const size = est.hints?.size ?? registry?.size;
  if (!size || size === "unknown") unknown.push({ field: "size", text: "Porte", level: "none" });
  if (d.estimated) unknown.push({ field: "unit_location", text: `Localização da unidade (distância ${d.label})${d.nearLimit ? "; conferência do limite pendente" : ""}`, level: d.km == null ? "none" : "indication" });
  else verified.push({ field: "unit_location", text: `Localização da unidade: ${d.label}`, sources: [] });
  if (a.restriction.status === "conflict") conflicts.push({ field: "restriction", text: `Restrição conflita com ${config.commodity.variety}`, sources: src(a.restriction.sources) });

  // Conflitos registrados pela pessoa na evidência (ex.: duas fontes que se contradizem).
  for (const e of est.evidence ?? []) if (e.conflict) conflicts.push({ field: e.kind, text: e.quote ?? "Conflito registrado na evidência", sources: e.url ? [e.url] : [] });
  // Papel divergente entre o cadastro oficial e o registro de atividade (Brasil: CNAE principal × fabricante).
  if (est.country === "BR" && registry?.activity) {
    const role = BR_ROLE(registry.activity);
    const saysManufacturing = (est.evidence ?? []).some((e) => e.kind === "activity_code" && MANUFACTURING_TEXT.test(e.quote ?? ""));
    if (saysManufacturing && role && role !== "manufacturing")
      conflicts.push({ field: "role", text: `Atividade principal no cadastro oficial é ${ROLE_LABEL[role]} (${registry.activity}), mas o registro de atividade indica fabricante`, sources: registry.url ? [registry.url] : [] });
  }

  const closed = config.research?.publicPhase === "closed";
  const contact = unknown.filter((u) => closed || CONTACT_BY_NATURE.has(u.field)).map((u) => ({ field: u.field, text: u.text }));
  return { publicResearch: closed ? "closed" : "open", verified, conflicts, unknown, contact };
}
