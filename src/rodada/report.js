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
  if (config.nearLimit.criterion) lines.push(`- Critério de proximidade do limite: ${config.nearLimit.criterion}`);
  lines.push(`- Idioma ${config.locale.language}, fuso ${config.locale.timezone}, compliance ${config.compliance.scope}`);
  lines.push(`- Estabelecimentos: ${results.length} (novos ${counters.created}, alterados ${counters.updated}, sem mudança ${counters.unchanged})`, "");
  lines.push("## Resumo", "");
  for (const s of Object.keys(LABEL)) lines.push(`- ${LABEL[s]}: ${by(s).length}`);
  lines.push("", "## Exceções e conferências para análise", "");
  const review = results.filter((r) => r.status === "exception" || r.checks?.length);
  if (!review.length) lines.push("Nenhuma.");
  for (const r of review)
    lines.push(`- **${cell(r.names[0])}** (${cell(r.registrationId ?? "sem identificador")}): ${[...(r.status === "exception" ? r.reasons : []), ...(r.checks ?? []).map((c) => `conferir: ${c}`)].join("; ")}`);
  // Fechamento por estabelecimento (src/rodada/closure.js): verificado × conflito × desconhecido × contato futuro.
  const withClosure = results.filter((r) => r.closure);
  if (withClosure.length) {
    const phase = withClosure[0].closure.publicResearch === "closed" ? "encerrada" : "aberta";
    const name = (r) => `**${cell(r.names[0])}** (${cell(r.registrationId ?? "sem identificador")})`;
    const join = (list) => list.map((x) => cell(x.text)).join("; ");
    lines.push("", "## Verificações concluídas", "");
    for (const r of withClosure) lines.push(`- ${name(r)}: ${join(r.closure.verified) || "nenhuma"}`);
    lines.push("", "## Conflitos de fonte", "");
    const conf = withClosure.filter((r) => r.closure.conflicts.length);
    if (!conf.length) lines.push("Nenhum.");
    for (const r of conf) lines.push(`- ${name(r)}: ${r.closure.conflicts.map((x) => `${cell(x.text)}${x.sources.length ? ` [${x.sources.join(", ")}]` : ""}`).join("; ")}`);
    lines.push("", "## Dados desconhecidos", "");
    for (const r of withClosure) lines.push(`- ${name(r)}: ${r.closure.unknown.map((x) => `${cell(x.text)} (${st(x.level)})`).join("; ") || "nenhum"}`);
    lines.push("", `## Pendências para contato futuro (pesquisa pública ${phase})`, "");
    for (const r of withClosure) lines.push(`- ${name(r)}: ${join(r.closure.contact) || "nenhuma"}`);
  }
  const scr = run.screenings ?? {};
  if (Object.keys(scr).length) {
    lines.push("", "## Triagens de sanções", "");
    for (const r of results) {
      const x = scr[r.key];
      if (!x) continue;
      lines.push(`- **${cell(r.names[0])}**: ${x.status}${x.completedAt ? ` em ${x.completedAt.slice(0, 16).replace("T", " ")} UTC` : ""}; ocorrências ${x.matches}; ${x.lists} listas; válida até ${x.validUntil ? `${x.validUntil.slice(0, 16).replace("T", " ")} UTC` : "não calculado"}${x.valid ? "" : " (VENCIDA ou incompleta: refazer antes de avançar)"}`);
    }
  }
  // Cadastros feitos pela rodada: base (descoberta sem decisão comercial individual × aceite com decisão) e operação.
  const regs = run.registrations ?? [];
  if (regs.length) {
    lines.push("", "## Cadastros e rastreabilidade", "");
    for (const g of regs) {
      const r = results.find((x) => x.key === g.est_key);
      const dec = g.decision ? `; decisão ${g.decision.value} ${g.decision.id ?? g.decisionId ?? "(id não registrado)"} por ${g.decision.decidedBy ?? "?"} em ${g.decision.decidedAt ?? "?"}` : "";
      lines.push(`- **${cell(r?.names?.[0] ?? g.est_key)}** → empresa ${g.company_id ?? "—"} (${g.outcome}): ${cell(g.label)}${dec}. ${cell(g.operationText)}`);
    }
  }
  const notes = run.annotations ?? [];
  if (notes.length) {
    lines.push("", "## Anotações complementares", "");
    for (const n of notes) {
      const refs = n.refersTo?.requestIds?.length ? ` [operações: ${n.refersTo.requestIds.join(", ")}]` : "";
      const auth = n.authorization?.reference ? ` [autorização: ${cell([n.authorization.reference, n.authorization.grantedBy, n.authorization.grantedAt].filter(Boolean).join(", "))}]` : "";
      lines.push(`- ${n.annotatedAt} (${cell(n.kind ?? "complemento")}; registrada por ${cell(n.authenticatedIdentity)}, canal ${cell(n.operation?.channel ?? "não declarado")}, executor ${cell(n.operation?.executor ?? "não declarado")}): ${cell(n.text)}${refs}${auth}`);
    }
  }
  lines.push("", "## Estabelecimentos", "");
  lines.push("| Situação | Estabelecimento | Identificador | Município | Distância | Operação | Uso | Compra de terceiros | Papel | Restrição | Canais | Pendências |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const a = r.assessment;
    const ch = a.channels.map((c) => `${c.type}: ${c.value}${c.verified ? "" : " (não verificado)"}`).join("; ") || "nenhum";
    lines.push(`| ${LABEL[r.status]}${r.checks?.length ? ` (conferir: ${r.checks.join(", ")})` : ""} | ${cell(r.names.join(" / "))} | ${cell(r.registrationId ?? "provisório")} | ${cell(r.municipality)} | ${cell(r.distance.label)} | ${st(a.operation.status)} | ${st(a.commodityUse.status)} | ${st(a.purchase.status)} | ${a.role} | ${a.restriction.status} | ${cell(ch)} | ${cell(r.pending.join("; "))} |`);
  }
  return lines.join("\n") + "\n";
}
