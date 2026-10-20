// Segmentos compradores sugeridos por commodity, com as regras de descoberta já usadas nas configurações de exemplo
// (docs/implementation/rodadas/exemplos). Sugestão não é aplicação: a rodada só recebe o que a pessoa escolher, e uma
// commodity sem segmento sugerido NÃO herda segmentos de outra (ração e milho nunca entram numa rodada de café).
// Um segmento sem regra de uma fonte fica só com importação de arquivo e pesquisa assistida naquela fonte.
export const SEGMENT_PRESETS = {
  corn: {
    feed_mill: { label: "fábrica de ração", discovery: { osm: [["industrial", "feed"], ["product", "~ração|racao|animal feed"]], sipeagro: { activity: ["FABRICANTE"], classification: ["RAÇÃO", "CONCENTRADO", "NÚCLEO", "SUPLEMENTO", "ALIMENTO"] } } },
    cooperative_feed: { label: "cooperativa com fabricação própria" },
    poultry_swine_integration: { label: "integração de aves e suínos", discovery: { osm: [["industrial", "slaughterhouse"]] } },
    feedlot: { label: "confinamento" },
    ethanol: { label: "etanol de milho", discovery: { osm: [["product", "~etanol|ethanol"]] } },
  },
  soy: {
    crusher: { label: "esmagadora", discovery: { osm: [["industrial", "oil_mill"]] } },
    feed_mill: { label: "fábrica de ração", discovery: { osm: [["industrial", "feed"]], sipeagro: { activity: ["FABRICANTE"], classification: ["RAÇÃO", "CONCENTRADO", "NÚCLEO", "SUPLEMENTO", "ALIMENTO"] } } },
  },
  sorghum: {
    feed_mill: { label: "fábrica de ração" },
    ethanol: { label: "etanol de grãos" },
  },
  coffee: {
    roaster: { label: "torrefação", discovery: { osm: [["craft", "coffee_roaster"], ["craft", "roaster"]] } },
  },
};

// Fontes que dependem de regra por segmento: sem regra, a fonte não sabe o que procurar.
export const RULE_SOURCES = { "osm-overpass": "osm", "mapa-sipeagro": "sipeagro" };
