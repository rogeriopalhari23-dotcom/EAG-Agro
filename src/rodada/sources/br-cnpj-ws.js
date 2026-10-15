// Fonte cadastral do Brasil: Receita Federal via publica.cnpj.ws (gratuita; limite de 3 consultas por minuto, aplicado
// pela rodada). Só é usada quando a execução pede rede; nos testes, entra uma função falsa no lugar.
export function brCnpjWs({ fetchImpl = fetch, userAgent = "eag-compass-rodada (uso pessoal, baixo volume)" } = {}) {
  return async (est) => {
    const r = await fetchImpl(`https://publica.cnpj.ws/cnpj/${est.registrationId}`, { headers: { "user-agent": userAgent } });
    if (r.status === 404) return null;
    if (r.status !== 200) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    const j = await r.json();
    const e = j.estabelecimento ?? {};
    return {
      legalName: j.razao_social ?? null,
      tradeName: e.nome_fantasia ?? null,
      status: e.situacao_cadastral ?? null,
      statusDate: e.data_situacao_cadastral ?? null,
      kind: e.tipo ?? null,
      size: { "Micro Empresa": "micro", "Empresa de Pequeno Porte": "small" }[j.porte?.descricao] ?? "unknown",
      activity: e.atividade_principal ? `${e.atividade_principal.subclasse} ${e.atividade_principal.descricao}` : null,
      secondary: (e.atividades_secundarias ?? []).map((x) => `${x.subclasse} ${x.descricao}`),
      municipality: e.cidade?.nome ?? null,
      region: e.estado?.sigla ?? null,
      address: [e.tipo_logradouro, e.logradouro, e.numero, e.complemento, e.bairro].filter(Boolean).join(" "),
      idType: "CNPJ",
      url: `https://publica.cnpj.ws/cnpj/${est.registrationId}`,
    };
  };
}
