// Catálogo de fontes das rodadas e verificação ANTES da execução (preflight). Cada fonte declara como entra na rodada:
//   automatic → o Compass consulta sozinho a partir da configuração (com limite de taxa);
//   import    → a pessoa traz um arquivo em formato conhecido (o Compass filtra pela área e converte);
//   assisted  → a pessoa pesquisa e registra a candidata com a fonte (URL), uma a uma.
// Fonte paga nunca roda sem autorização de despesa; país ou segmento sem fonte compatível aparece como limitação
// antes da execução, nunca como suporte completo.
import { ID_RULES } from "../establishment.js";

export const SOURCE_CATALOG = {
  "br-cnpj-ws": {
    label: "Receita Federal (publica.cnpj.ws)", role: "registry", mode: "automatic", countries: ["BR"], cost: "free", rateLimitPerMinute: 3,
    provides: "situação cadastral, CNAE, porte, endereço e município da unidade pelo CNPJ",
    limits: "só consulta CNPJ já conhecido (não busca por nome); 3 consultas por minuto",
  },
  "osm-overpass": {
    label: "OpenStreetMap (Overpass)", role: "discovery", mode: "automatic", countries: "*", cost: "free",
    provides: "estabelecimentos mapeados no raio, por etiquetas configuradas por segmento",
    limits: "cobertura irregular; raramente traz identificador cadastral (candidatas provisórias até conciliar); o servidor público recusa chamadas da Cloudflare, então no painel a consulta sai do navegador",
    needsSegmentRule: "osm",
  },
  "mapa-sipeagro": {
    label: "MAPA SIPEAGRO — estabelecimentos registrados (dados abertos)", role: "discovery", mode: "import", countries: ["BR"], cost: "free",
    provides: "estabelecimentos com registro no MAPA (UF, município, registro, atividade, classificação)",
    limits: "CNPJ mascarado no arquivo público (candidata provisória; a máscara ajuda a conciliar); registro indica atividade, não prova uso nem compra",
    needsSegmentRule: "sipeagro",
    url: "https://dados.agricultura.gov.br/dataset/52a01565-72d6-410e-b21b-64035831a7be",
  },
  casadosdados: {
    label: "Casa dos Dados (pesquisa avançada)", role: "discovery", mode: "automatic", countries: ["BR"], cost: "paid",
    provides: "empresas ativas por CNAE e município, com CNPJ",
    limits: "serviço pago: não roda sem autorização de despesa",
  },
  "abic-certificados": {
    label: "ABIC — torrefadoras com produto certificado (lista pública)", role: "discovery", mode: "automatic", countries: ["BR"], cost: "free",
    provides: "industrializadores de café com produto certificado e o estado da fábrica",
    limits: "só nome e estado da fábrica (sem CNPJ nem município): candidata provisória até a conciliação; só café",
    needsSegmentRule: "abic",
    url: "https://www.abic.com.br/certificacoes/",
  },
  "company-site": {
    label: "Site da própria empresa (CNPJ e canal publicados)", role: "enrichment", mode: "automatic", countries: "*", cost: "free",
    provides: "CNPJ publicado (dígitos verificadores conferidos) e e-mail geral do próprio domínio, com a página como fonte",
    limits: "só páginas públicas (inicial e contato), respeita robots.txt; sem CNPJ publicado a candidata segue provisória",
  },
  "import-file": {
    label: "Importação de arquivo (JSON ou CSV de candidatas)", role: "discovery", mode: "import", countries: "*", cost: "free",
    provides: "candidatas de qualquer origem, com fonte por linha", limits: "a qualidade depende do arquivo; sem fonte por linha, vira indício",
  },
  assisted: {
    label: "Pesquisa assistida (registro manual com fonte)", role: "discovery", mode: "assisted", countries: "*", cost: "free",
    provides: "candidata registrada pela pessoa com URL da fonte", limits: "manual",
  },
};

const covers = (src, country) => src.countries === "*" || src.countries.includes(country);
const LEVEL = { supported: 0, partial: 1, unsupported: 2 };

// config: normalizada (validateRoundConfig). env: { geography: "national_official" | "file" | "none", authorizedPaid: [] }.
export function preflight(config, { geography = "none", authorizedPaid = [], implemented = [] } = {}) {
  const country = config.origin.country;
  const items = [];
  const add = (area, level, message) => items.push({ area, level, message });
  const configured = (config.sources ?? []).map((s) => ({ ...s, entry: SOURCE_CATALOG[s.id] }));

  // Geografia
  if (geography === "national_official") add("geografia", "supported", `Conjunto nacional oficial de municípios para ${country}: área calculada pela origem e pelo raio.`);
  else if (geography === "file") add("geografia", "partial", "Municípios vindos de arquivo da rodada: a área cobre só o que o arquivo traz.");
  else if (typeof config.origin.lat === "number") add("geografia", "partial", `Sem conjunto de municípios para ${country}: a distância só sai pela coordenada da unidade; sem ela, fica desconhecida.`);
  else add("geografia", "unsupported", `Sem conjunto de municípios para ${country} e origem sem coordenada: a rodada não calcula distâncias.`);
  add("proximidade do limite", "supported", `Critério ${config.nearLimit.criterion}.`);

  // Identificador da unidade
  if (ID_RULES[country]) add("identificador", "supported", `${ID_RULES[country].type}: chave por unidade e raiz da empresa.`);
  else add("identificador", "partial", `Sem regra de identificador para ${country}: o texto informado vira chave, sem raiz de empresa nem validação de formato.`);

  // Fontes configuradas
  for (const s of configured) {
    if (!s.entry) { add(`fonte ${s.id}`, "unsupported", `Fonte "${s.id}" não existe no catálogo: não será usada.`); continue; }
    if (!covers(s.entry, country)) { add(`fonte ${s.id}`, "unsupported", `${s.entry.label} não cobre ${country}.`); continue; }
    if (s.entry.cost === "paid" && !authorizedPaid.includes(s.id)) { add(`fonte ${s.id}`, "unsupported", `${s.entry.label}: ${s.entry.limits}.`); continue; }
    if (s.entry.mode === "automatic" && implemented.length && !implemented.includes(s.id)) { add(`fonte ${s.id}`, "unsupported", `${s.entry.label}: sem implementação disponível neste ambiente.`); continue; }
    add(`fonte ${s.id}`, "partial", `${s.entry.label} (${s.entry.role === "registry" ? "consulta cadastral automática" : MODE_LABEL[s.entry.mode]}): ${s.entry.provides}. Limite: ${s.entry.limits}.`);
    if (s.entry.needsSegmentRule) {
      const segs = Object.entries(config.commodity.segments ?? {});
      const missing = segs.filter(([, v]) => !v?.discovery?.[s.entry.needsSegmentRule]).map(([k]) => k);
      if (!segs.length) add(`segmentos × ${s.id}`, "unsupported", `Nenhum segmento configurado: ${s.entry.label} não sabe o que procurar.`);
      else if (missing.length) add(`segmentos × ${s.id}`, "partial", `Sem regra de descoberta em ${s.entry.label} para: ${missing.join(", ")} (esses segmentos ficam só com importação e pesquisa assistida).`);
      else add(`segmentos × ${s.id}`, "supported", `Todos os segmentos têm regra em ${s.entry.label}.`);
    }
  }

  // Descoberta: há alguma fonte automática ou de importação utilizável?
  const usable = configured.filter((s) => s.entry && covers(s.entry, country) && !(s.entry.cost === "paid" && !authorizedPaid.includes(s.id)));
  const autoDisc = usable.filter((s) => s.entry.role === "discovery" && s.entry.mode === "automatic");
  if (!autoDisc.length) add("descoberta automática", "unsupported", `Nenhuma fonte de descoberta automática utilizável para ${country}: candidatas só por importação de arquivo e pesquisa assistida.`);
  else add("descoberta automática", "partial", `Automática por ${autoDisc.map((s) => s.entry.label).join(", ")}; o resultado é indício e precisa de conciliação.`);
  const registry = usable.filter((s) => s.entry.role === "registry");
  if (!registry.length) add("cadastro oficial", "unsupported", `Sem fonte cadastral para ${country}: situação, endereço e município da unidade ficam pendentes.`);
  else add("cadastro oficial", "supported", `Consulta cadastral por ${registry.map((s) => s.entry.label).join(", ")}.`);

  // Prova e compliance: sempre fora da automação
  add("prova de uso e compra", "partial", "Só fonte própria ou registro oficial comprova; o resto é indício. A busca dessas provas é pesquisa assistida.");
  add("triagem de sanções", "partial", "Feita pelo Compass depois do cadastro em descoberta; avanços que exigem triagem continuam bloqueados até ela existir e estar válida.");

  const worst = items.reduce((m, x) => Math.max(m, LEVEL[x.level]), 0);
  const overall = ["supported", "partial", "unsupported"][worst];
  return { overall, requiresAcknowledgement: overall !== "supported", items };
}

export const MODE_LABEL = { automatic: "descoberta automática", import: "importação", assisted: "pesquisa assistida" };
