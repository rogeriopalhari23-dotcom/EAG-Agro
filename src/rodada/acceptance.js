// Lote para o cadastro (scripts/cadastrar-lote-aceito.mjs), com rastreabilidade por empresa.
//  - mode "discovery": novas candidatas entram como DESCOBERTA, sem aprovação comercial individual (fora do raio,
//    separadas e sem identificador ficam de fora; exceções só entram se a decisão em lote as incluir).
//  - mode "accept": só as aceitas na decisão em lote, cada uma com quem decidiu, quando e o resultado avaliado.
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

export function buildRegistrationBatch(run, { mode, decisions = {}, decidedBy, decidedAt, productVariant, profileClass = "possible_final_consumer" }) {
  if (!productVariant) throw new Error("Informe a variante de produto do catálogo (sem padrão).");
  if (mode === "accept" && !decidedBy) throw new Error("Aceite em lote exige quem decidiu.");
  const { config } = run;
  const eligible = run.results.filter((r) => {
    if (r.provisional || r.status === "outside" || r.status === "separated") return false;
    if (mode === "discovery") return r.status !== "exception" || decisions[r.key] === "include";
    return decisions[r.key] === "accept";
  });
  const empresas = eligible.map((r) => {
    const reg = r.registry ?? {};
    const trace = { roundId: config.id, key: r.key, status: r.status, mode, decision: mode === "accept" ? "accept" : "discovery", decidedBy: decidedBy ?? null, decidedAt: decidedAt ?? null, pending: r.pending };
    return {
      chave: r.key,
      rastreio: trace,
      company: {
        legalName: reg.legalName ?? r.names[0],
        tradeName: r.names[0],
        countryCode: r.country,
        registrationId: r.registrationId,
        registrationIdType: reg.idType ?? (r.country === "BR" ? "CNPJ" : "OTHER"),
        sourceLabel: `Rodada ${config.id} (${mode === "accept" ? "aceite em lote" : "descoberta, sem aprovação comercial"}). ${notConfirmed(r, config)}.`,
        sourceUrl: r.assessment.commodityUse.sources.find((e) => e.url)?.url ?? reg.url ?? undefined,
      },
      evidence: evidenceFor(r, config),
      channels: r.assessment.channels.filter((c) => c.verified && /@/.test(c.value ?? "")).map((c) => ({ email: c.value, sourceUrl: c.source, sourceKind: "company_site", label: `Canal publicado (${c.type})` })),
      people: [],
      profile: { profileClass, basis: `Rodada ${config.id}: ${r.status}; ${notConfirmed(r, config)}. Pendências: ${r.pending.join("; ")}` },
    };
  });
  return {
    aceite: mode === "accept" ? `Aceite em lote por ${decidedBy} em ${decidedAt} (rodada ${config.id}); sem autorização de contato.` : `Descoberta da rodada ${config.id}: cadastro sem aprovação comercial individual; sem contato.`,
    produto: productVariant,
    empresas,
  };
}
