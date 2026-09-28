// Mapa commodity (SH4) → atividades que USAM a commodity, para gerar candidatos no exterior (Radar Internacional).
// Proposta "descoberta-v1" (2026-09-27), baseada na NACE Rev.2 (Eurostat) e nas etiquetas do OpenStreetMap.
// É só parâmetro de busca: a pessoa confere e pode editar os códigos antes de rodar; o que foi usado fica registrado
// na busca (P2, P10). Atividade no cadastro é indício de uso, nunca prova de compra ou de importação (P1, R12.10).
//
// processors: consumidoras finais, fábricas e processadoras (prioridade); traders: atacado (grupo separado).
// osm: filtros [chave, valor exato ou /regex/] combinados com OU; nace: classes de 4 dígitos (NN.NN).
export const MAP_VERSION = "descoberta-v1 (proposta de 2026-09-27, NACE Rev.2)";

const P = (label, nace, osm = []) => ({ label, nace, osm });
export const DISCOVERY_MAP = {
  "0901": { commodity: "café", processors: P("torrefação e processamento de café", ["10.83"], [["craft", "coffee_roaster"], ["craft", "roaster"], ["industrial", "coffee"], ["product", /coffee|kaffee|café|koffie/]]), traders: P("atacado de café, chá e cacau", ["46.37"]) },
  "1701": { commodity: "açúcar", processors: P("confeitaria, chocolate, panificação, biscoitos e bebidas", ["10.82", "10.71", "10.72", "11.07", "10.52", "10.89"], [["craft", "confectionery"], ["industrial", "confectionery"], ["product", /sugar|zucker|confection|süßwaren|chocolate|schokolade|candy/]]), traders: P("atacado de açúcar, chocolate e confeitos", ["46.36"]) },
  "1201": { commodity: "soja em grão", processors: P("esmagamento de oleaginosas e ração animal", ["10.41", "10.91"], [["industrial", "oil_mill"], ["product", /soy|soja|oilseed|ölsaat|feed|futter/]]), traders: P("atacado de grãos e ração", ["46.21"]) },
  "2304": { commodity: "farelo de soja", processors: P("ração animal e pet food", ["10.91", "10.92"], [["industrial", "feed"], ["product", /feed|futter|fodder|pet food|tiernahrung/]]), traders: P("atacado de grãos e ração", ["46.21"]) },
  "2303": { commodity: "resíduos de amido/destilaria (DDGS)", processors: P("ração animal", ["10.91"], [["industrial", "feed"], ["product", /feed|futter|fodder/]]), traders: P("atacado de grãos e ração", ["46.21"]) },
  "1005": { commodity: "milho", processors: P("ração, amido, moagem e destilação", ["10.91", "10.62", "10.61", "11.01"], [["industrial", "feed"], ["product", /feed|futter|starch|stärke|maize|mais|corn/]]), traders: P("atacado de grãos e ração", ["46.21"]) },
  "1507": { commodity: "óleo de soja", processors: P("refino de óleos, condimentos e alimentos preparados", ["10.41", "10.84", "10.85", "10.89"], [["industrial", "oil_mill"], ["product", /oil|öl|mayonnaise|sauce|margarine/]]), traders: P("atacado de óleos e gorduras", ["46.33"]) },
  "2207": { commodity: "etanol", processors: P("química, bebidas destiladas, cosméticos e farmacêutica", ["20.14", "11.01", "20.42", "21.20", "20.59"], [["product", /ethanol|alcohol|alkohol|spirit|spirituosen/]]), traders: P("atacado de produtos químicos", ["46.75"]) },
  "0201": { commodity: "carne bovina", processors: P("produtos de carne e refeições prontas", ["10.13", "10.85"], [["industrial", "slaughterhouse"], ["product", /meat|fleisch|wurst|sausage/]]), traders: P("atacado de carnes", ["46.32"]) },
  "0202": { commodity: "carne bovina congelada", processors: P("produtos de carne e refeições prontas", ["10.13", "10.85"], [["product", /meat|fleisch|wurst|sausage/]]), traders: P("atacado de carnes", ["46.32"]) },
  "0207": { commodity: "carne de frango", processors: P("produtos de carne e refeições prontas", ["10.13", "10.85"], [["product", /poultry|geflügel|chicken|hähnchen|meat|fleisch/]]), traders: P("atacado de carnes", ["46.32"]) },
  "0203": { commodity: "carne suína", processors: P("produtos de carne e refeições prontas", ["10.13", "10.85"], [["product", /pork|schwein|meat|fleisch|wurst|sausage/]]), traders: P("atacado de carnes", ["46.32"]) },
  "2009": { commodity: "sucos de frutas", processors: P("bebidas não alcoólicas e sucos", ["11.07", "10.32"], [["product", /juice|saft|beverage|getränk/]]), traders: P("atacado de bebidas", ["46.34"]) },
  "2401": { commodity: "tabaco não manufaturado", processors: P("produtos do fumo", ["12.00"], [["product", /tobacco|tabak|cigar|zigarre/]]), traders: P("atacado de produtos do fumo", ["46.35"]) },
};

// Proposta para as SH6 selecionadas (a primeira SH4 mapeada); nulo quando não há mapeamento (a pessoa informa).
export function proposalFor(hs6List) {
  for (const h of hs6List) {
    const m = DISCOVERY_MAP[String(h).slice(0, 4)];
    if (m) return { hs4: String(h).slice(0, 4), ...m, version: MAP_VERSION };
  }
  return null;
}

// NAF (França) = NACE + letra; classes subdivididas na NAF rév. 2 listadas por extenso.
const NAF_SPLIT = { "10.13": ["10.13A", "10.13B"], "10.71": ["10.71A", "10.71B", "10.71C", "10.71D"], "11.07": ["11.07A", "11.07B"], "10.51": ["10.51A", "10.51B", "10.51C", "10.51D"], "10.61": ["10.61A", "10.61B"], "10.41": ["10.41A", "10.41B"], "10.39": ["10.39A", "10.39B"], "46.32": ["46.32A", "46.32B", "46.32C"] };
export const nafCodes = (nace) => nace.flatMap((c) => NAF_SPLIT[c] ?? [`${c}Z`]);
// SN2007 (Noruega) = NACE + 1 dígito ("0" quando a classe não é subdividida).
export const sn2007Codes = (nace) => nace.map((c) => `${c}0`);

// Faixas de porte (referência: Recomendação UE 2003/361 — micro < 10, pequena < 50, média < 250 pessoas).
export function bandFromEmployees(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return null;
  const x = Number(n);
  return x < 10 ? "micro" : x < 50 ? "small" : x < 250 ? "medium" : "medium_plus";
}
