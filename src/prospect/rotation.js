// Pesquisa automática por rotação (botões "Pesquisa automática nacional" e "internacional"): escolhe uma combinação
// elegível pelo perfil, pelas origens e limites configurados e pela evidência oficial, priorizando a pouco pesquisada
// ou com dados a atualizar. Só escolhe e inicia a pesquisa (dentro da política); nada de contato comercial.
// Falta de dado ou falha de fonte deixa a combinação inelegível agora, nunca vira conclusão sobre compradores.
import { statement as s, parameters } from "../store.js";
import { SEGMENT_PRESETS } from "../rodada/segments.js";
import { foreignSources } from "../sources-applicable.js";
import { commodityLabelOf } from "../catalog-names.js";

const DAY = 86400000;
const STALE_DAYS = 30; // mesmo prazo de validade da consulta cadastral nacional
const ACTIVE = ["queued", "running", "waiting", "needs_decision", "paused"];
const parse = (t, d = null) => { try { return t ? JSON.parse(t) : d; } catch { return d; } };
const norm = (x) => String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// Desempate estável por dia: a rotação muda de um dia para o outro, sem sorteio sem rastro.
const dayHash = (k, day) => [...`${k}|${day}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

async function history(env, tenant, market) {
  const rows = (await s(env, "SELECT status,input_json,created_at FROM prospect_jobs WHERE tenant_id=? AND market=?", tenant, market).all()).results;
  return rows.map((r) => ({ ...r, input: parse(r.input_json, {}) }));
}
function scoreOf(key, jobs, at) {
  const mine = jobs.filter((j) => j.key === key);
  if (mine.some((j) => ACTIVE.includes(j.status))) return null; // em andamento: reaproveitada, não escolhida de novo
  if (!mine.length) return { rank: 0, why: "nunca pesquisada" };
  const last = mine.map((j) => j.created_at).sort().at(-1);
  const days = Math.floor((Date.parse(at) - Date.parse(last)) / DAY);
  return days >= STALE_DAYS ? { rank: 1, why: `última pesquisa há ${days} dias (dados a atualizar)` } : { rank: 2 + mine.length, why: `pesquisada há ${days} dia(s), ${mine.length} vez(es)` };
}
const pickBest = (list, day) => list.sort((a, b) => a.score.rank - b.score.rank || a.tie - b.tie || dayHash(a.key, day) - dayHash(b.key, day))[0] ?? null;

// ---------- nacional: commodity com busca automática × origem configurada para ela ----------
export async function pickNational(env, tenant, { profile, policy, at }) {
  const products = (await s(env, "SELECT * FROM products WHERE tenant_id=? AND active<>0 AND identity_status='confirmed'", tenant).all()).results;
  const byId = new Map(products.map((p) => [p.id, p]));
  const autoSegs = (code) => Object.values(profile.segmentsByCommodity?.[code] ?? SEGMENT_PRESETS[code] ?? {}).filter((g) => g.discovery?.osm || g.discovery?.abic);
  // Origens já configuradas por produto: campanhas nacionais, rodadas e prospecções anteriores.
  const origins = new Map();
  const add = (productId, city, uf, from) => {
    const p = byId.get(productId);
    if (!p || !city || !uf) return;
    const k = `${p.id}|${norm(city)}|${String(uf).toUpperCase()}`;
    if (!origins.has(k)) origins.set(k, { product: p, city, uf: String(uf).toUpperCase(), from });
  };
  for (const c of (await s(env, "SELECT name,product_id,origin_city,origin_uf FROM campaigns WHERE tenant_id=? AND market='national'", tenant).all()).results) add(c.product_id, c.origin_city, c.origin_uf, `campanha "${c.name}"`);
  for (const r of (await s(env, "SELECT name,config_json FROM discovery_rounds WHERE tenant_id=?", tenant).all()).results) {
    const c = parse(r.config_json, {});
    if ((c.origin?.country ?? "BR") === "BR") add(c.commodity?.productId, c.origin?.municipality, c.origin?.region, `rodada "${r.name}"`);
  }
  const jobs = (await history(env, tenant, "national")).map((j) => ({ ...j, key: `${j.input.productId}|${norm(j.input.location?.municipality)}|${j.input.location?.region}` }));
  for (const j of jobs) add(j.input.productId, j.input.location?.municipality, j.input.location?.region, "prospecção anterior");
  const p = await parameters(env, tenant);
  const radius = Math.min(Number(p["radius_default_km:national"]) || 150, policy?.policy?.maxRadiusKm ?? 500);
  const day = at.slice(0, 10);
  const skipped = [];
  const cands = [];
  let busy = 0;
  for (const [key, o] of origins) {
    const segs = autoSegs(o.product.commodity);
    if (!segs.length) { skipped.push(`${o.product.variant_name}: sem segmento com busca automática`); continue; }
    const mun = await s(env, "SELECT ibge_code,name,uf FROM municipalities WHERE uf=? AND lower(name)=lower(?)", o.uf, o.city).first();
    if (!mun) { skipped.push(`${o.city}/${o.uf}: município não encontrado na base oficial`); continue; }
    const score = scoreOf(key, jobs, at);
    if (!score) { busy++; continue; }
    const label = await commodityLabelOf(env, tenant, o.product.commodity);
    cands.push({
      key, score, tie: jobs.filter((j) => j.input.productId === o.product.id).length,
      input: { market: "national", productId: o.product.id, location: { region: mun.uf, municipality: mun.name, municipalityCode: String(mun.ibge_code) }, radius: { value: radius, unit: "km" } },
      reason: `${label} (${o.product.variant_name}) a partir de ${mun.name}/${mun.uf}, origem configurada em ${o.from}: ${score.why}. Segmentos com busca automática: ${segs.map((g) => g.label).join(", ")}. Raio ${radius} km (padrão configurado, dentro do limite da política).`,
    });
  }
  const best = pickBest(cands, day);
  return best ? { ...best, eligible: cands.length } : { none: true, eligible: 0, reasons: busy ? [`as ${busy} combinação(ões) elegível(is) já têm pesquisa em andamento (reaproveitadas, sem duplicar)`, ...skipped] : skipped.length ? skipped : ["nenhuma origem configurada para commodity com busca automática (campanha nacional, rodada ou prospecção anterior)"] };
}

// ---------- internacional: produto classificado × país com comércio oficial com o Brasil e fonte de empresas ----------
export async function pickInternational(env, tenant, { profile, at }) {
  const products = (await s(env, "SELECT * FROM products WHERE tenant_id=? AND active<>0 AND identity_status='confirmed'", tenant).all()).results;
  const codes = (await s(env, "SELECT product_id,code FROM product_codes WHERE status='confirmed' AND code_system IN ('HS','NCM')", ).all()).results;
  const hsOf = new Map();
  for (const c of codes) (hsOf.get(c.product_id) ?? hsOf.set(c.product_id, new Set()).get(c.product_id)).add(String(c.code).replace(/\D/g, "").slice(0, 6));
  // Resumos vigentes por país e fonte (lista mensal): subposições com valor de origem Brasil (Comtrade) ou exportadas pelo Brasil (MDIC).
  const sums = (await s(env, "SELECT t.iso3,t.source,t.top_json,t.period_to FROM trade_country_summary t JOIN trade_list_current c ON c.iso3=t.iso3 AND c.source=t.source AND c.version_id=t.version_id", ).all()).results;
  const countries = new Map((await s(env, "SELECT iso3,iso2,name_pt FROM countries").all()).results.map((c) => [c.iso3, c]));
  const allowed = new Set(profile.sources?.international ?? []);
  const jobs = (await history(env, tenant, "international")).map((j) => ({ ...j, key: `${j.input.productId}|${j.input.location?.iso3}` }));
  const day = at.slice(0, 10);
  const cands = [];
  let unclassified = 0, busy = 0;
  for (const p of products) {
    const hs = [...(hsOf.get(p.id) ?? [])];
    if (!hs.length) { unclassified++; continue; }
    const label = await commodityLabelOf(env, tenant, p.commodity);
    for (const sm of sums) {
      const top = parse(sm.top_json, []).filter((t) => hs.includes(String(t.hs6)) && t.usd > 0);
      if (!top.length) continue;
      const c = countries.get(sm.iso3);
      if (!c?.iso2) continue;
      const srcs = foreignSources(c.iso2, hs).filter((x) => x.status === "available" && allowed.has(x.key));
      if (!srcs.length) continue; // sem fonte de empresas para o país e a commodity: não é escolhida agora
      const key = `${p.id}|${c.iso3}`;
      if (cands.some((x) => x.key === key)) continue;
      const score = scoreOf(key, jobs, at);
      if (!score) { busy++; continue; }
      const what = sm.source === "mdic" ? `exportações do Brasil para ${c.name_pt} (MDIC, FOB, até ${sm.period_to ?? "data não informada"})` : `importações de origem Brasil declaradas por ${c.name_pt} (Comtrade, ${sm.period_to ?? "ano não informado"})`;
      cands.push({
        key, score, tie: jobs.filter((j) => j.input.productId === p.id).length,
        input: { market: "international", productId: p.id, location: { iso3: c.iso3 } },
        reason: `${label} (${p.variant_name}) × ${c.name_pt}: ${what} registram SH ${top.map((t) => t.hs6).join(", ")}; ${score.why}. Fontes de empresas: ${srcs.map((x) => x.label).join("; ")}.`,
      });
    }
  }
  const best = pickBest(cands, day);
  return best ? { ...best, eligible: cands.length } : { none: true, eligible: 0, reasons: [busy ? `as ${busy} combinação(ões) elegível(is) já têm pesquisa em andamento (reaproveitadas, sem duplicar)` : null, unclassified ? `${unclassified} produto(s) ainda sem classificação SH confirmada` : null, "nenhum país com comércio oficial registrado com o Brasil para os produtos classificados e com fonte de empresas coberta"].filter(Boolean) };
}
