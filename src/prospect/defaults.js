// Perfil comprador padrão e modelo de política de pesquisa de rotina (prospecção automática, 2026-10-20).
// O perfil reflete as decisões vigentes do projeto (ICP do método de prospecção e regras do Compass) e é só o ponto de
// partida: cada alteração vira uma versão nova. Nada aqui fixa commodity, município, raio ou empresa.

export const DEFAULT_PROFILE = {
  // Quem compra: o comprador que usa a commodity vem antes; distribuidor e trader ficam separados, nunca misturados.
  roles: {
    priority: ["final_consumer", "factory", "processor"],
    separate: ["distributor", "reseller", "trader"],
    labels: { final_consumer: "consumidor final", factory: "fabricante", processor: "processador", distributor: "distribuidor", reseller: "revendedor", trader: "trader" },
  },
  // Porte: médias primeiro, depois pequenas; grandes ficam quando houver oportunidade e canal adequado; micro por último.
  sizes: { order: ["medium", "small", "large", "micro", "unknown"], largeRequiresChannel: true },
  // Evidência: só fonte própria da empresa ou registro oficial confirma; o resto é indício.
  evidence: { confirming: ["own_source", "official_record"] },
  // Distinções que a avaliação mantém (regras já implementadas em src/rodada/qualify.js e na descoberta internacional).
  distinctions: [
    "CNAE ou atividade registrada não comprova consumo da commodity.",
    "Processar ou usar a commodity não comprova compra de terceiros.",
    "Ausência de restrição não comprova aceitação de GMO ou da variedade.",
    "Dado de comércio entre países não comprova que uma empresa importa do Brasil.",
  ],
  // Segmentos compradores por commodity: vazio = usa as sugestões do Compass (src/rodada/segments.js). Uma entrada aqui
  // substitui a sugestão daquela commodity.
  segmentsByCommodity: {},
  // Fontes gratuitas que a prospecção pode usar por mercado (as pagas nunca entram sem orçamento autorizado).
  sources: {
    national: ["br-cnpj-ws", "osm-overpass", "abic-certificados"],
    international: ["fr_registry", "no_registry", "de_coffee_assoc", "osm"],
  },
};

// Modelo da política de pesquisa de rotina. Só vale depois de concedida (POST /api/prospect/policy), com responsável,
// data e referência da decisão. A política cobre a pesquisa; contato, fichas, campanhas, canais e envios ficam fora.
export const POLICY_TEMPLATE = {
  // A seleção (R12.7), a ciência das limitações e o aceite internacional pela política dependem da emenda proposta
  // (AMENDMENT): enquanto ela não for aprovada, esses passos pedem a ação de uma pessoa, mesmo com a política vigente.
  covers: ["descoberta de candidatas", "consulta cadastral", "conciliação e deduplicação", "triagem de sanções", "cadastro em descoberta (sem decisão comercial)"],
  // Pedido dos indicadores oficiais de um país sem lista (R12.15, fluxo da lista mensal, fontes gratuitas dentro do
  // orçamento diário configurado, um por país por dia). Só entra quando quem concede é Administrador.
  indicators: true,
  // Evidência de mercado num período mais longo, dentro dos dados guardados da lista mensal (até 60 meses), identificado.
  extendEvidencePeriod: true,
  excludes: ["contato de qualquer tipo", "aprovação de fichas", "ativação de campanhas", "liberação de canais", "envio de mensagens", "fontes pagas ou consumo de créditos", "fusão de empresas parecidas"],
  markets: ["national", "international"],
  paidSources: [],
  maxRadiusKm: 500,
  autoRegisterDiscovery: true,
  autoScreening: true,
  // Limitações já conhecidas e aceitas uma vez (área do item de limitação × nível). Limitação nova ou mais grave que a
  // aceita pede decisão antes de executar.
  acceptedLimitations: {
    identificador: "partial",
    "fonte br-cnpj-ws": "partial",
    "fonte osm-overpass": "partial",
    "segmentos × osm-overpass": "partial",
    "fonte abic-certificados": "partial",
    "segmentos × abic-certificados": "partial",
    "descoberta automática": "partial",
    "prova de uso e compra": "partial",
    "triagem de sanções": "partial",
  },
  international: { acceptCandidatesWith: ["registry_id", "website"] },
};

// Emenda da prospecção automática (docs/implementation/EMENDA-PROSPECCAO-AUTOMATICA.md): PROPOSTA, não aprovada.
// Só muda para approved: true por commit depois da aprovação registrada de Rogério Palhari; nenhuma tela ou rota muda isso.
export const AMENDMENT = { id: "EMENDA-PROSPECCAO-AUTOMATICA", approved: false };

const LEVEL = { supported: 0, partial: 1, unsupported: 2 };
// Itens da verificação prévia que a política não cobre (nova limitação ou nível mais grave que o aceito).
export function uncoveredLimitations(preflight, policy) {
  const ok = policy?.acceptedLimitations ?? {};
  return (preflight?.items ?? []).filter((x) => x.level !== "supported" && !(ok[x.area] && LEVEL[x.level] <= LEVEL[ok[x.area]]));
}
