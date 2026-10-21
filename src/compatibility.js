// Empresas já cadastradas com atividade compatível com a commodity pesquisada (reaproveitamento em todo o Compass).
// Antes de procurar só empresas novas, a prospecção considera as já cadastradas cuja atividade registrada indica uso da
// commodity. Compatibilidade é motivo para investigar, NUNCA prova de compra (P1): a relação nova com o produto entra
// como "não confirmada", com o motivo e a fonte, e com situação, evidências e histórico próprios.
// Nada é copiado de outra commodity: nem a confirmação de compra (company_conditions, perfil confirmado), nem o decisor
// ou contato responsável (contact_products). Pausas, supressões e exclusões continuam com o próprio alcance.
import { statement as s, commit, auditStatement, now } from "./store.js";
import { haversineKm } from "./geo.js";
import { icpStatus } from "./profiles.js";
import { standingRestrictions } from "./relations.js";

// Subclasses CNAE 2.3 conferidas, uma a uma, na API de dados do IBGE em 2026-10-21.
export const CNAE_SOURCE = "CNAE 2.3, subclasses conferidas na API de dados do IBGE (servicodados.ibge.gov.br/api/v2/cnae/subclasses) em 2026-10-21";
const CNAE = {
  "1066000": "fabricação de alimentos para animais",
  "1012101": "abate de aves",
  "1012103": "frigorífico - abate de suínos",
  "0151201": "criação de bovinos para corte",
  "0155501": "criação de frangos para corte",
  "0154700": "criação de suínos",
  "1931400": "fabricação de álcool",
  "1041400": "fabricação de óleos vegetais em bruto, exceto óleo de milho",
  "1042200": "fabricação de óleos vegetais refinados, exceto óleo de milho",
  "1081302": "torrefação e moagem de café",
  "1072401": "fabricação de açúcar de cana refinado",
  "1093701": "fabricação de produtos derivados do cacau e de chocolates",
  "1122401": "fabricação de refrigerantes",
  "1122403": "fabricação de refrescos, xaropes e pós para refrescos",
  "1053800": "fabricação de sorvetes e outros gelados comestíveis",
  "1092900": "fabricação de biscoitos e bolachas",
  "1091101": "fabricação de produtos de panificação industrial",
  "1062700": "moagem de trigo e fabricação de derivados",
  "1064300": "fabricação de farinha de milho e derivados, exceto óleos de milho",
  "1065101": "fabricação de amidos e féculas de vegetais",
  "1932200": "fabricação de biocombustíveis, exceto álcool",
  "2061400": "fabricação de sabões e detergentes sintéticos",
  "2063100": "fabricação de cosméticos, produtos de perfumaria e de higiene pessoal",
  // Atacado (trader/distribuidor): compatível, mas sempre separado dos usuários finais.
  "4622200": "comércio atacadista de soja",
  "4623108": "comércio atacadista de matérias-primas agrícolas com fracionamento",
  "4623109": "comércio atacadista de alimentos para animais",
  "4623199": "comércio atacadista de matérias-primas agrícolas não especificadas",
  "4632001": "comércio atacadista de cereais e leguminosas beneficiados",
};
const TRADER_CNAE = new Set(["4622200", "4623108", "4623109", "4623199", "4632001"]);
const FEED = ["1066000", "1012101", "1012103", "0151201", "0155501", "0154700"];
// Uso final por commodity (skill /prospeccao-vendas: buscar quem usa a commodity), com o atacado separado.
const USE = {
  corn: [...FEED, "1931400", "1064300", "1065101", "4623199", "4632001"],
  sorghum: [...FEED, "1931400", "4623199"],
  soy: ["1041400", "1066000", "4622200"],
  soy_meal: [...FEED, "4623109"], canola_meal: [...FEED, "4623109"], cotton_meal: [...FEED, "4623109"],
  ddgs: [...FEED, "4623109"], cgf: [...FEED, "4623109"], cgm: [...FEED, "4623109"], corn_bran: [...FEED, "4623109"],
  sugar: ["1072401", "1093701", "1122401", "1122403", "1053800", "1092900", "1091101", "4623199"],
  coffee: ["1081302"],
  wheat: ["1062700", "4632001"],
  soy_oil: ["1042200", "1932200", "2061400"], palm_oil: ["1042200", "2061400", "2063100"], canola_oil: ["1042200", "1932200"], cotton_oil: ["1042200", "1932200"],
  uco: ["1932200"],
  soy_lecithin: ["1093701", "1092900", "1091101", "2063100"],
  industrial_alcohol: ["2063100"],
};
// Atividade publicada por empresas no exterior (registro oficial ou diretório): termos por uso, em vários idiomas.
const WORDS = {
  feed: /aliments? pour animaux|animal feed|feed ?mill|compound feed|futtermittel|mischfutter|ra[cç][aã]o|alimentos para animales|piensos|10\.91|10\.92/i,
  crusher: /oil ?mill|huilerie|[öo]lm[üu]hle|esmaga|triturad|10\.41/i,
  refinery: /oil refin|raffinerie d.huile|10\.42/i,
  roaster: /coffee roast|torr[ée]faction|kaffeer[öo]st|torrefa|tostador|10\.83/i,
  sugar_user: /confectioner|chocolat|confiserie|s[üu][ßs]waren|soft drink|boissons|getr[äa]nke|beverage|biscuit|bakery|boulangerie|b[äa]ckerei|ice cream|glaces|10\.7[12]|10\.82|11\.07/i,
  ethanol: /ethanol|[ée]thanol|distiller|distill|20\.14/i,
  flour: /flour mill|meunerie|m[üu]hle|moagem de trigo|10\.61/i,
  cosmetics: /cosmetic|cosm[ée]tique|kosmetik|20\.42/i,
  biodiesel: /biodiesel|biofuel|biocarburant|20\.59/i,
  trader: /wholesale|n[ée]goce|grossiste|gro[ßs]handel|trading|atacad|46\.2[1-3]|46\.3[38]/i,
};
const WORD_USE = {
  corn: ["feed", "ethanol"], sorghum: ["feed", "ethanol"], soy: ["crusher", "feed"],
  soy_meal: ["feed"], canola_meal: ["feed"], cotton_meal: ["feed"], ddgs: ["feed"], cgf: ["feed"], cgm: ["feed"], corn_bran: ["feed"],
  sugar: ["sugar_user"], coffee: ["roaster"], wheat: ["flour"],
  soy_oil: ["refinery", "biodiesel"], palm_oil: ["refinery", "cosmetics"], canola_oil: ["refinery", "biodiesel"], cotton_oil: ["refinery"], uco: ["biodiesel"],
  soy_lecithin: ["sugar_user", "cosmetics"], industrial_alcohol: ["cosmetics"],
};
// Commodities de uso só em ração: a relação já registrada com uma delas indica atividade de ração (indício).
const FEED_ONLY = new Set(["soy_meal", "canola_meal", "cotton_meal", "ddgs", "cgf", "cgm", "corn_bran"]);
const FEED_USERS = new Set(["corn", "sorghum", "soy", ...FEED_ONLY]);

export function compatibleActivity(commodity, { cnaes = [], activityText = "", related = [] }) {
  const reasons = [];
  let trader = false;
  const allowed = new Set(USE[commodity] ?? []);
  for (const c of cnaes.map((x) => String(x ?? "").replace(/\D/g, "")).filter((x) => allowed.has(x))) {
    reasons.push(`CNAE ${c.replace(/^(\d{4})(\d)(\d{2})$/, "$1-$2/$3")} (${CNAE[c]}) registrado na consulta cadastral`);
    if (TRADER_CNAE.has(c)) trader = true;
  }
  for (const w of WORD_USE[commodity] ?? []) if (WORDS[w].test(activityText)) reasons.push(`atividade publicada "${String(activityText).slice(0, 120)}"`);
  if (activityText && WORDS.trader.test(activityText) && reasons.length) trader = true;
  if (FEED_USERS.has(commodity)) for (const r of related.filter((x) => FEED_ONLY.has(x.commodity) && x.commodity !== commodity)) reasons.push(`já relacionada a ${r.label} (uso em ração)`);
  return { compatible: reasons.length > 0, reasons: [...new Set(reasons)], trader };
}

// Empresas já cadastradas compatíveis, no país (internacional) ou dentro do raio (nacional), ainda sem relação com o
// produto. → [{ companyId, name, unitId, km, reasons, trader, restrictions, otherProducts }]
export async function existingCompatible(env, tenant, { product, market, iso2, origin, radiusKm, limit = 200 }) {
  const companies = market === "national"
    ? (await s(env, `SELECT c.id,c.legal_name,c.trade_name,c.pipeline_status,c.exception_status,c.activity_text,u.id unit_id,u.lat,u.lon,u.primary_cnae,u.secondary_cnaes_json,u.size_code,c.size_class
        FROM companies c JOIN company_units u ON u.company_id=c.id AND u.tenant_id=c.tenant_id WHERE c.tenant_id=? AND c.country_code='BR' AND u.lat IS NOT NULL`, tenant).all()).results
    : (await s(env, "SELECT id,legal_name,trade_name,pipeline_status,exception_status,activity_text,NULL unit_id,NULL lat,NULL lon,NULL primary_cnae,'[]' secondary_cnaes_json,NULL size_code,size_class FROM companies WHERE tenant_id=? AND country_code=?", tenant, iso2).all()).results;
  if (!companies.length) return [];
  const related = new Map();
  for (const r of (await s(env, "SELECT b.company_id,b.unit_key,b.product_id,p.commodity,COALESCE(p.display_name,p.variant_name) label FROM buyer_profiles b JOIN products p ON p.id=b.product_id WHERE b.tenant_id=?", tenant).all()).results)
    (related.get(r.company_id) ?? related.set(r.company_id, []).get(r.company_id)).push(r);
  const out = new Map();
  for (const c of companies) {
    const rel = related.get(c.id) ?? [];
    if (rel.some((x) => x.product_id === product.id)) continue; // já relacionada a este produto: a relação existente vale
    if (["blocked", "inactive"].includes(c.pipeline_status)) continue; // bloqueio e inativação têm alcance de empresa
    let km = null;
    if (market === "national") {
      km = haversineKm(origin.lat, origin.lon, c.lat, c.lon);
      if (km > radiusKm) continue;
    }
    let cnaes = [];
    try { cnaes = [c.primary_cnae, ...JSON.parse(c.secondary_cnaes_json ?? "[]").map((x) => x?.code ?? x)]; } catch { cnaes = [c.primary_cnae]; }
    const fit = compatibleActivity(product.commodity, { cnaes, activityText: c.activity_text ?? "", related: rel });
    if (!fit.compatible) continue;
    const prev = out.get(c.id);
    if (prev && (prev.km ?? 1e9) <= (km ?? 1e9)) continue;
    out.set(c.id, { companyId: c.id, name: c.trade_name || c.legal_name, unitId: c.unit_id, km: km == null ? null : Math.round(km), reasons: fit.reasons, trader: fit.trader, sizeCode: c.size_code, sizeBand: c.size_class, otherProducts: [...new Set(rel.map((x) => x.label))] });
  }
  const list = [...out.values()].sort((a, b) => (a.trader ? 1 : 0) - (b.trader ? 1 : 0) || (a.km ?? 0) - (b.km ?? 0)).slice(0, limit);
  for (const x of list) x.restrictions = await standingRestrictions(env, tenant, x.companyId);
  return list;
}

// Relação "a investigar" com o produto (perfil não confirmado), registrada como automação sob a política. Existente é
// preservada. Nenhuma condição de compra, decisor, canal ou contato é copiado de outra commodity.
export async function addRelationsToInvestigate(env, tenant, { product, items, policy, jobId }) {
  const at = now();
  const actor = { tenant_id: tenant, id: "system-prospect", role: "system" };
  const stmts = [];
  for (const x of items) {
    const cls = x.trader ? "trader_distributor" : "unconfirmed";
    const unitKey = x.unitId ?? "";
    stmts.push(
      s(env, "INSERT OR IGNORE INTO buyer_profiles(id,tenant_id,company_id,unit_key,product_id,profile_class,basis,icp_status,is_giant,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,0,?,?)",
        crypto.randomUUID(), tenant, x.companyId, unitKey, product.id, cls,
        `Atividade compatível com ${product.variant_name}: ${x.reasons.join("; ")}. Motivo para investigar, não prova de compra (P1). Fonte: ${CNAE_SOURCE}. Reaproveitada pela prospecção ${jobId} (automação sob a política de pesquisa v${policy?.version ?? "—"}). Compra, decisor e contato deste produto ainda não identificados.`,
        icpStatus({ profileClass: cls, sizeCode: x.sizeCode ?? null, sizeBand: x.sizeBand ?? null }), actor.id, at),
    );
  }
  if (!stmts.length) return 0;
  stmts.push(auditStatement(env, actor, `prospect:${jobId}`, "buyer_profile.compatible_reused", "product", product.id, { companies: items.map((x) => x.companyId).slice(0, 200), channel: "automation", policy: policy ? { id: policy.id, version: policy.version } : null }));
  await commit(env, stmts);
  return items.length;
}
