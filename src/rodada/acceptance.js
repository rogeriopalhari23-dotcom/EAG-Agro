// Lote para o cadastro (scripts/cadastrar-lote-aceito.mjs), com rastreabilidade por empresa.
//  - mode "discovery": novas candidatas entram como DESCOBERTA, sem decisão comercial individual (fora do raio,
//    separadas e sem identificador ficam de fora; exceções só entram se a decisão em lote as incluir).
//  - mode "accept": só as aceitas na decisão em lote, ligadas à decisão registrada (id, quem e quando decidiu); a operação
//    que cadastra (identidade autenticada, canal, executor e autorização declarados, momento) fica separada da decisão.
// Nunca cria tarefa de ligação, ficha, contato com pessoa nem consome crédito. Indícios não viram evidência comprovada.

const STRENGTH_TO_TYPE = { own_source: "company_document", official_record: "public_nominal_record" };

function evidenceFor(r, config) {
  const out = [];
  const all = [...r.assessment.operation.sources, ...r.assessment.commodityUse.sources, ...r.assessment.purchase.sources];
  for (const e of all) {
    const type = STRENGTH_TO_TYPE[e.strength];
    if (!type || !e.url) continue; // indício (diretório, resumo, código de atividade) fica só no relatório
    out.push({
      category: "business", evidenceType: type, market: config.origin.country === "BR" ? "national" : "international",
      supports: e.kind === "commodity_use" ? ["consumes_as_input"] : [],
      reference: `${e.quote ?? ""} [${e.kind}; ${e.strength}${e.date ? `; ${e.date}` : ""}]`.trim(),
      sourceUrl: e.url, consultedAt: (e.date ?? "").slice(0, 10) || undefined, validationStatus: "pending",
    });
  }
  return [...new Map(out.map((x) => [`${x.sourceUrl}|${x.reference}`, x])).values()];
}

const notConfirmed = (r, config) => [
  r.assessment.purchase.status !== "proved" ? "compra de terceiros NÃO confirmada" : null,
  config.commodity.variety ? `aceitação de ${config.commodity.variety} NÃO confirmada` : null,
  r.distance.estimated ? `distância ${r.distance.label}` : null,
].filter(Boolean).join("; ");

export function buildRegistrationBatch(run, { mode, decisions = {}, decidedBy, decidedAt, productVariant, profileClass = "possible_final_consumer", decisionRecords = {}, operation = null }) {
  if (!productVariant) throw new Error("Informe a variante de produto do catálogo (sem padrão).");
  const { config } = run;
  const eligible = run.results.filter((r) => {
    if (r.provisional || r.status === "outside" || r.status === "separated") return false;
    // Sem consulta cadastral concluída não há cadastro, em nenhum modo (a ciência das limitações não dispensa).
    if (!r.registry) return false;
    if (mode === "discovery") return r.status !== "exception" || decisions[r.key] === "include";
    return decisions[r.key] === "accept";
  });
  // Cadastro que depende de decisão exige quem decidiu: pelo registro da decisão (rodada no Compass) ou informado
  // (linha de comando). Sem nada a cadastrar, não há o que exigir.
  const missing = eligible.filter((r) => (mode === "accept" || decisions[r.key] === "include") && !(decisionRecords[r.key]?.decidedBy ?? decidedBy));
  if (missing.length) throw new Error(`Aceite em lote exige quem decidiu (${missing.map((r) => r.key).join(", ")}).`);
  const empresas = eligible.map((r) => {
    const reg = r.registry ?? {};
    // Rastreio: o cadastro em descoberta NÃO tem decisão comercial individual (basis "discovery_mode"); só o aceite e a
    // inclusão de exceção dependem de decisão, e então o vínculo é com a decisão registrada (id, quem e quando decidiu).
    // A operação (identidade autenticada, canal, executor, autorização e momento) fica separada da decisão.
    const rec = decisionRecords[r.key] ?? null;
    const byDecision = mode === "accept" || decisions[r.key] === "include";
    const trace = {
      roundId: config.id, key: r.key, status: r.status, mode,
      basis: mode === "accept" ? "decision_accept" : byDecision ? "discovery_mode_with_inclusion" : "discovery_mode",
      label: mode === "accept" ? "cadastro por aceite (decisão registrada)" : byDecision ? "cadastro em descoberta com inclusão de exceção (decisão registrada)" : "cadastro sem decisão comercial individual",
      decision: byDecision ? { value: decisions[r.key], id: rec?.id ?? null, decidedBy: rec?.decidedBy ?? decidedBy ?? null, decidedAt: rec?.decidedAt ?? decidedAt ?? null } : null,
      operation: operation ?? null,
      pending: r.pending,
    };
    return {
      chave: r.key,
      rastreio: trace,
      company: {
        legalName: reg.legalName ?? r.names[0],
        tradeName: r.names[0],
        countryCode: r.country,
        registrationId: r.registrationId,
        registrationIdType: reg.idType ?? (r.country === "BR" ? "CNPJ" : "OTHER"),
        sourceLabel: `Rodada ${config.id} (${trace.label}). ${notConfirmed(r, config)}.`,
        sourceUrl: r.assessment.commodityUse.sources.find((e) => e.url)?.url ?? reg.url ?? undefined,
      },
      unit: r.registrationId ? { cnpj: r.registrationId, municipality: reg.municipality ?? r.municipality ?? null, uf: reg.region ?? r.region ?? null, sourceLabel: `Rodada ${config.id}`, sourceRef: reg.url ?? null } : null,
      evidence: evidenceFor(r, config),
      channels: r.assessment.channels.filter((c) => c.verified && /@/.test(c.value ?? "")).map((c) => ({ email: c.value, sourceUrl: c.source, sourceKind: "company_site", label: `Canal publicado (${c.type})` })),
      people: [],
      profile: { profileClass, basis: `Rodada ${config.id}: ${r.status}; ${notConfirmed(r, config)}. Pendências: ${r.pending.join("; ")}` },
    };
  });
  return {
    aceite: mode === "accept" ? `Cadastro por aceite em lote (decisões registradas na rodada ${config.id}); sem autorização de contato.` : `Rodada ${config.id}: cadastro sem decisão comercial individual (modo descoberta); sem contato.`,
    produto: productVariant,
    empresas,
  };
}
