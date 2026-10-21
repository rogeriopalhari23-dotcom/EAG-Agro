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
// "Commodity (variante)", sem repetir quando o nome da variante já é o da commodity.
const both = (label, variant) => (!variant || variant === label ? variant || label : `${label} (${variant})`);
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

// ---------- internacional: produto classificado × país com comércio oficial com o Brasil ----------
// Evidência de mercado e fonte de empresas são separadas: o país entra pela evidência oficial em QUALQUER subposição do
// produto (todas as subposições com valor de origem Brasil, não só as cinco maiores); a falta de conector de empresas
// para o país e a commodity vira limitação de cobertura listada a cada consulta, nunca esquecimento do mercado nem
// conclusão de que não há compradores.
const SOURCE_TEXT = (sm, c) => sm.source === "mdic" ? `exportações do Brasil para ${c.name_pt} (MDIC, FOB, ${sm.period_from ?? "?"} a ${sm.period_to ?? "data não informada"})` : `importações de origem Brasil declaradas por ${c.name_pt} (Comtrade, ${sm.period_to ?? "ano não informado"})`;
const SUMMARY_SQL = "SELECT t.iso3,t.source,t.top_json,t.hs6_json,t.period_from,t.period_to FROM trade_country_summary t JOIN trade_list_current c ON c.iso3=t.iso3 AND c.source=t.source AND c.content_sha256=t.content_sha256 WHERE t.period_months=(CASE t.source WHEN 'mdic' THEN ? ELSE 0 END) AND t.state='purchase_identified'";

export async function pickInternational(env, tenant, { profile, at }, deps = {}) {
  const products = (await s(env, "SELECT * FROM products WHERE tenant_id=? AND active<>0 AND identity_status='confirmed'", tenant).all()).results;
  const codes = (await s(env, "SELECT product_id,code FROM product_codes WHERE status='confirmed' AND code_system IN ('HS','NCM')").all()).results;
  const hsOf = new Map();
  for (const c of codes) (hsOf.get(c.product_id) ?? hsOf.set(c.product_id, new Set()).get(c.product_id)).add(String(c.code).replace(/D/g, "").slice(0, 6));
  const months = Number((await parameters(env, tenant))["period_default_months:international"]) || 0;
  // Resumos vigentes por país e fonte (lista mensal já publicada). Resumo antigo sem a lista completa de subposições é
  // refeito do objeto oficial guardado no R2 (reaproveitamento, sem chamada externa nem custo).
  let sums = (await s(env, SUMMARY_SQL, months).all()).results;
  // Ponteiro vigente sem resumo (ou com resumo antigo, sem a lista completa): refeito antes de escolher.
  const missing = (await s(env, "SELECT COUNT(*) n FROM trade_list_current c LEFT JOIN trade_country_summary t ON t.content_sha256=c.content_sha256 AND t.period_months=(CASE c.source WHEN 'mdic' THEN ? ELSE 0 END) WHERE t.content_sha256 IS NULL OR t.hs6_json IS NULL", months).first())?.n ?? 0;
  if (missing && deps.rebuild) {
    await deps.rebuild(env, tenant).catch(() => null);
    sums = (await s(env, SUMMARY_SQL, months).all()).results;
  }
  const partialSummaries = new Set(sums.filter((x) => x.hs6_json == null).map((x) => x.iso3));
  const countries = new Map((await s(env, "SELECT iso3,iso2,name_pt FROM countries").all()).results.map((c) => [c.iso3, c]));
  const allowed = new Set(profile.sources?.international ?? []);
  const jobs = (await history(env, tenant, "international")).map((j) => ({ ...j, key: `${j.input.productId}|${j.input.location?.iso3}` }));
  const day = at.slice(0, 10);
  const byKey = new Map();
  let unclassified = 0;
  for (const p of products) {
    const hs = [...(hsOf.get(p.id) ?? [])];
    if (!hs.length) { unclassified++; continue; }
    for (const sm of sums) {
      const c = countries.get(sm.iso3);
      if (!c?.iso2) continue;
      // Todas as subposições do país (ou, enquanto o resumo completo não existe, só as cinco maiores, avisando).
      const all = sm.hs6_json != null ? parse(sm.hs6_json, {}) : Object.fromEntries(parse(sm.top_json, []).map((t) => [String(t.hs6), t.usd]));
      const hit = hs.filter((h) => Number(all[h]) > 0);
      if (!hit.length) continue;
      const key = `${p.id}|${c.iso3}`;
      const e = byKey.get(key) ?? byKey.set(key, { key, p, c, hs, evidence: [] }).get(key);
      e.evidence.push({ source: sm.source, text: SOURCE_TEXT(sm, c), hs6: hit, usd: hit.reduce((n, h) => n + Number(all[h]), 0) });
    }
  }
  const cands = [], gaps = [];
  let busy = 0;
  for (const e of byKey.values()) {
    const label = await commodityLabelOf(env, tenant, e.p.commodity);
    const ev = e.evidence.map((x) => `${x.text} registram SH ${x.hs6.join(", ")}`).join("; ");
    const all = foreignSources(e.c.iso2, e.hs);
    const srcs = all.filter((x) => x.status === "available" && allowed.has(x.key));
    if (!srcs.length) {
      // Mercado com evidência e sem fonte de empresas: limitação de cobertura, mantida à vista.
      const why = all.length ? all.map((x) => `${x.label}: ${x.status === "available" ? "fora das fontes do perfil" : x.note ?? "pendente"}`).join("; ") : "nenhum conector de empresas cobre este país e esta commodity";
      gaps.push({ productId: e.p.id, iso3: e.c.iso3, label: `${both(label, e.p.variant_name)} × ${e.c.name_pt}`, evidence: ev, coverage: why });
      continue;
    }
    const score = scoreOf(e.key, jobs, at);
    if (!score) { busy++; continue; }
    cands.push({
      key: e.key, score, tie: jobs.filter((j) => j.input.productId === e.p.id).length,
      input: { market: "international", productId: e.p.id, location: { iso3: e.c.iso3 } },
      reason: `${both(label, e.p.variant_name)} × ${e.c.name_pt}: ${ev}; ${score.why}. Fontes de empresas: ${srcs.map((x) => x.label).join("; ")}.`,
    });
  }
  const coverage = {
    gaps: gaps.slice(0, 30), gapCount: gaps.length,
    note: gaps.length ? `${gaps.length} mercado(s) com comércio oficial registrado com o Brasil e sem fonte de empresas coberta: limitação de cobertura, não ausência de compradores.` : null,
    partialSummaries: partialSummaries.size ? `Resumo completo de subposições ainda em preparação para ${partialSummaries.size} país(es): neles só as cinco maiores foram consideradas por enquanto.` : null,
  };
  const best = pickBest(cands, day);
  return best ? { ...best, eligible: cands.length, coverage } : { none: true, eligible: 0, coverage, reasons: [busy ? `as ${busy} combinação(ões) elegível(is) já têm pesquisa em andamento (reaproveitadas, sem duplicar)` : null, unclassified ? `${unclassified} produto(s) ainda sem classificação SH confirmada` : null, gaps.length ? coverage.note : null, !byKey.size ? "nenhum país com comércio oficial registrado com o Brasil para os produtos classificados (na lista mensal já publicada)" : null].filter(Boolean) };
}
