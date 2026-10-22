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
    international: ["fr_registry", "no_registry", "de_coffee_assoc", "cl_sag_lenaa", "osm"],
  },
};

// Modelo da política de pesquisa de rotina. Só vale depois de concedida (POST /api/prospect/policy), com responsável,
// data e referência da decisão. A política cobre a pesquisa; contato, fichas, campanhas, canais e envios ficam fora.
export const POLICY_TEMPLATE = {
  // A seleção (R12.7), a ciência das limitações e o aceite internacional pela política dependem da emenda proposta
  // (AMENDMENT): enquanto ela não for aprovada, esses passos pedem a ação de uma pessoa, mesmo com a política vigente.
  covers: [
    "descoberta de candidatas",
    "consulta cadastral",
    "conciliação e deduplicação",
    "triagem de sanções",
    "cadastro em descoberta (sem decisão comercial)",
    "seleção de commodity, mercado, segmentos e fontes (inclusive pesquisa automática por rotação)",
    "seleção da commodity e autorização da busca no exterior (R12.7) para commodity com evidência de mercado",
    "encaminhamento de candidatas com identificador cadastral ou site para descoberta",
    "ciência das limitações já aceitas (limitação nova ou mais grave pede decisão)",
    "classificação fiscal de produto por regra fundamentada em fonte oficial",
    "reaproveitamento de empresas já cadastradas com atividade compatível (relação com o produto não confirmada, sem copiar compra nem decisor de outra commodity)",
  ],
  // Pedido dos indicadores oficiais de um país sem lista (R12.15, fluxo da lista mensal, fontes gratuitas dentro do
  // orçamento diário configurado, um por país por dia). Só entra quando quem concede é Administrador.
  indicators: true,
  // Evidência de mercado num período mais longo, dentro dos dados guardados da lista mensal (até 60 meses), identificado.
  extendEvidencePeriod: true,
  excludes: ["custos novos e ampliação de escopo", "ambiguidade comercial real", "contato de qualquer tipo", "aprovação de fichas", "ativação de campanhas", "liberação de canais", "envio de mensagens", "fontes pagas ou consumo de créditos", "fusão de empresas parecidas"],
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
  // Disponibilidade (src/availability.js): busca real vazia sai da seleção principal por reassessEmptyDays (depois, ou com
  // fonte/regra nova ou empresa compatível, volta); pendência técnica espera retryTechnicalHours na pesquisa automática.
  // Exploração em segundo plano dos mercados a investigar (src/prospect/explore.js): uma pesquisa por vez, no máximo
  // explorationPerDay por dia. Consulta sem estabelecimentos: nova tentativa em reassessEmptyDays (busca com registro ou
  // diretório da atividade) ou reassessPartialDays (só o mapa colaborativo).
  international: { acceptCandidatesWith: ["registry_id", "website"], reassessEmptyDays: 90, reassessPartialDays: 30, retryTechnicalHours: 24, exploration: true, explorationPerDay: 6 },
};

// Emenda da prospecção automática (docs/implementation/EMENDA-PROSPECCAO-AUTOMATICA.md): PROPOSTA, não aprovada.
// Só muda para approved: true por commit depois da aprovação registrada de Rogério Palhari; nenhuma tela ou rota muda isso.
// Autorização delimitada por instrução escrita de Rogério Palhari em 2026-10-20 (pesquisa e organização): seleção de
// commodity, mercado, segmentos e fontes; seleção R12.7 e autorização da busca no exterior; encaminhamento de candidatas
// para descoberta; ciência das limitações já aceitas. NÃO inclui: custos novos, ampliação de escopo, ambiguidade
// comercial, contato, fichas, T11, canais, campanhas ativas, envios nem o plano de consultas fora da Cloudflare (ponte).
export const AMENDMENT = {
  id: "EMENDA-PROSPECCAO-AUTOMATICA",
  approved: true,
  approvedAt: "2026-10-20",
  approvedBy: "Rogério Palhari (instrução escrita, sessão de 2026-10-20)",
  scope: ["seleção de commodity, mercado, segmentos e fontes", "seleção R12.7 e autorização da busca de empresas no exterior", "encaminhamento de candidatas com identificador ou site para descoberta", "ciência de limitações já aceitas pela política"],
  notApproved: ["custos novos", "ampliação de escopo", "ambiguidade comercial", "plano de consultas fora da Cloudflare (ponte)"],
};

const LEVEL = { supported: 0, partial: 1, unsupported: 2 };
// Itens da verificação prévia que a política não cobre (nova limitação ou nível mais grave que o aceito).
export function uncoveredLimitations(preflight, policy) {
  const ok = policy?.acceptedLimitations ?? {};
  return (preflight?.items ?? []).filter((x) => x.level !== "supported" && !(ok[x.area] && LEVEL[x.level] <= LEVEL[ok[x.area]]));
}
