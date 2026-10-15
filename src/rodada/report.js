// Relatório da rodada: resumo, exceções que pedem análise (só elas em destaque), tabela por estabelecimento e pendências.
// Nada é apresentado como confirmado sem evidência comprovante; distâncias por centroide aparecem como ESTIMADA.
const LABEL = {
  qualified_purchase: "Uso e compra de terceiros comprovados",
  qualified_use: "Uso comprovado; compra de terceiros não comprovada",
  exception: "Exceção: precisa de análise",
  discovery: "Descoberta: evidência insuficiente",
  separated: "Separada: revendedora ou trader",
  outside: "Fora do raio",
};
const st = (s) => ({ proved: "comprovado", indication: "indício", none: "sem evidência" })[s] ?? s;
const cell = (v) => String(v ?? "—").replace(/\|/g, "/").replace(/\n/g, " ");

export function renderReport(run, { title } = {}) {
  const { config, origin, results, counters } = run;
  const by = (s) => results.filter((r) => r.status === s);
  const lines = [];
  lines.push(`# ${title ?? `Rodada ${config.id}`}`, "");
  lines.push(`- Commodity: ${config.commodity.label ?? config.commodity.code}${config.commodity.variety ? ` (${config.commodity.variety})` : ""}`);
  lines.push(`- Origem: ${origin.label}; raio ${config.radius.value} ${config.radius.unit} (${config.radius.method}); perto do limite a partir de ${Math.round(config.nearLimit.fromKm * 10) / 10} km`);
  lines.push(`- Idioma ${config.locale.language}, fuso ${config.locale.timezone}, compliance ${config.compliance.scope}`);
  lines.push(`- Estabelecimentos: ${results.length} (novos ${counters.created}, alterados ${counters.updated}, sem mudança ${counters.unchanged})`, "");
  lines.push("## Resumo", "");
  for (const s of Object.keys(LABEL)) lines.push(`- ${LABEL[s]}: ${by(s).length}`);
  lines.push("", "## Exceções para análise", "");
  if (!by("exception").length) lines.push("Nenhuma.");
  for (const r of by("exception")) lines.push(`- **${cell(r.names[0])}** (${cell(r.registrationId ?? "sem identificador")}): ${r.reasons.join("; ")}`);
  lines.push("", "## Estabelecimentos", "");
  lines.push("| Situação | Estabelecimento | Identificador | Município | Distância | Operação | Uso | Compra de terceiros | Papel | Restrição | Canais | Pendências |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const a = r.assessment;
    const ch = a.channels.map((c) => `${c.type}: ${c.value}${c.verified ? "" : " (não verificado)"}`).join("; ") || "nenhum";
    lines.push(`| ${LABEL[r.status]} | ${cell(r.names.join(" / "))} | ${cell(r.registrationId ?? "provisório")} | ${cell(r.municipality)} | ${cell(r.distance.label)} | ${st(a.operation.status)} | ${st(a.commodityUse.status)} | ${st(a.purchase.status)} | ${a.role} | ${a.restriction.status} | ${cell(ch)} | ${cell(r.pending.join("; "))} |`);
  }
  return lines.join("\n") + "\n";
}
