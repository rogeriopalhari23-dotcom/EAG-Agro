// Destinos elegíveis para a pesquisa internacional de uma commodity ou de um produto: só países com evidência oficial de
// comércio DAQUELE produto com o Brasil. Uma regra só para o formulário (Radar Internacional e Prospecção), a criação da
// pesquisa no servidor e a pesquisa automática internacional.
//  - Usa as classificações verificadas do catálogo (todas as subposições do produto, sem limite de "cinco maiores");
//    cada produto vale pelos próprios códigos: soja em grão não comprova farelo nem óleo.
//  - Direção e contraparte conferidas: MDIC = exportações do Brasil para o país; Comtrade = importações declaradas pelo
//    país com origem Brasil. Importação do mundo não entra (src/trade-summary.js só soma a linha de origem Brasil).
//  - Período padrão do Compass; sem evidência nele, o período guardado mais longo das exportações do Brasil (identificado).
//  - Dado do país não prova empresa (R12.10). Conector de empresas é separado: país comprovado fica na lista mesmo sem
//    conector, com a limitação indicada.
// Estados: ready (há destinos), checking (resumos em preparação), none_valid (consulta válida, sem registros),
// none_incomplete (sem destino e cobertura incompleta: produto sem classificação, país sem lista, fonte com falha).
import { statement as s, parameters } from "./store.js";
import { foreignSources } from "./sources-applicable.js";

const parse = (t, d = null) => { try { return t ? JSON.parse(t) : d; } catch { return d; } };
const SOURCE_SHORT = { mdic: "MDIC — exportações do Brasil (FOB)", comtrade: "UN Comtrade — importações declaradas, origem Brasil" };

async function windows(env, tenant) {
  const p = await parameters(env, tenant);
  const months = Number(p["period_default_months:international"]) || 0;
  const longest = Math.min(60, Math.max(12, (Number(p["trade_list_mdic_years:international"]) || 1) * 12));
  return { months, longest: longest > months ? longest : null };
}
const SUMMARY_SQL = "SELECT t.iso3,t.source,t.period_months,t.hs6_json,t.top_json,t.period_from,t.period_to,c.version_id FROM trade_country_summary t JOIN trade_list_current c ON c.iso3=t.iso3 AND c.source=t.source AND c.content_sha256=t.content_sha256 WHERE t.state='purchase_identified' AND (t.source='comtrade' AND t.period_months=0 OR t.source='mdic' AND t.period_months IN (?,?))";
const MISSING_SQL = "SELECT COUNT(*) n FROM trade_list_current c LEFT JOIN trade_country_summary t ON t.content_sha256=c.content_sha256 AND t.period_months=(CASE c.source WHEN 'mdic' THEN ? ELSE 0 END) WHERE t.content_sha256 IS NULL OR t.hs6_json IS NULL";

// Códigos SH6 verificados (confirmados) por produto.
export async function verifiedHs(env, productIds) {
  const out = new Map(productIds.map((id) => [id, new Set()]));
  if (!productIds.length) return out;
  const rows = (await env.DB.prepare(`SELECT product_id,code FROM product_codes WHERE status='confirmed' AND code_system IN ('HS','NCM') AND product_id IN (${productIds.map(() => "?").join(",")})`).bind(...productIds).all()).results;
  for (const r of rows) {
    const h = String(r.code).replace(/\D/g, "").slice(0, 6);
    if (h.length === 6) out.get(r.product_id).add(h);
  }
  return out;
}

// products: linhas de products (uma commodity ou um produto). deps.rebuild(env, tenant, { months }) refaz resumos a
// partir dos objetos oficiais já guardados (sem chamada externa). deps.refresh(iso3) pede a atualização de um país com
// dado vencido pelo fluxo existente (R12.15), quando a política permite.
export async function destinationsFor(env, tenant, { products, profile, deps = {} }) {
  const w = await windows(env, tenant);
  const hsOf = await verifiedHs(env, products.map((p) => p.id));
  const classified = products.filter((p) => hsOf.get(p.id).size);
  const unclassified = products.filter((p) => !hsOf.get(p.id).size).map((p) => ({ productId: p.id, name: p.display_name ?? p.variant_name }));
  // Resumos que faltam (ponteiro novo, coluna nova, janela longa): refeitos do R2 antes de decidir.
  let pending = 0;
  for (const m of [w.months, w.longest].filter(Boolean)) {
    let n = (await s(env, MISSING_SQL, m).first())?.n ?? 0;
    if (n && deps.rebuild) {
      await deps.rebuild(env, tenant, { months: m }).catch(() => null);
      n = (await s(env, MISSING_SQL, m).first())?.n ?? 0;
    }
    pending += n;
  }
  const sums = classified.length ? (await s(env, SUMMARY_SQL, w.months, w.longest ?? w.months).all()).results : [];
  const countries = new Map((await s(env, "SELECT iso3,iso2,name_pt,name_en FROM countries WHERE iso2 IS NOT NULL AND iso3<>'BRA'").all()).results.map((c) => [c.iso3, c]));
  // Cobertura: países com lista vigente, vencidos (a rotina mais recente não os atualizou) e em geração ou com falha.
  const cur = (await s(env, "SELECT iso3,source,version_id FROM trade_list_current").all()).results;
  const latest = (await s(env, "SELECT reference_month FROM trade_list_versions WHERE kind='monthly' AND status<>'running' ORDER BY started_at DESC LIMIT 1").first())?.reference_month ?? null;
  const byCountry = new Map();
  for (const c of cur) (byCountry.get(c.iso3) ?? byCountry.set(c.iso3, []).get(c.iso3)).push(c.version_id);
  const stale = new Set([...byCountry.entries()].filter(([, vs]) => latest && vs.every((v) => v < latest && !v.startsWith(latest))).map(([k]) => k));
  const running = (await s(env, "SELECT COUNT(DISTINCT st.iso3) n FROM trade_list_status st JOIN trade_list_versions v ON v.id=st.version_id WHERE v.status='running' AND st.state='pending'").first())?.n ?? 0;
  const failedSources = (await s(env, "SELECT COUNT(DISTINCT st.iso3) n FROM trade_list_status st JOIN trade_list_versions v ON v.id=st.version_id WHERE v.status<>'running' AND st.state='data_unavailable' AND COALESCE(st.error,'')<>'país sem código nesta fonte' AND st.iso3 NOT IN (SELECT iso3 FROM trade_list_current)").first())?.n ?? 0;
  const allowed = new Set(profile?.sources?.international ?? []);
  const out = new Map();
  for (const p of classified) {
    const hs = [...hsOf.get(p.id)];
    const name = p.display_name ?? p.variant_name;
    for (const sm of sums) {
      const c = countries.get(sm.iso3);
      if (!c) continue;
      const all = sm.hs6_json != null ? parse(sm.hs6_json, {}) : Object.fromEntries(parse(sm.top_json, []).map((t) => [String(t.hs6), t.usd]));
      const hit = hs.filter((h) => Number(all[h]) > 0);
      if (!hit.length) continue;
      const extended = sm.source === "mdic" && sm.period_months !== w.months;
      const d = out.get(c.iso3) ?? out.set(c.iso3, { iso3: c.iso3, iso2: c.iso2, name: c.name_pt, nameEn: c.name_en, products: new Map(), evidence: [], stale: stale.has(c.iso3) }).get(c.iso3);
      const pr = d.products.get(p.id) ?? d.products.set(p.id, { productId: p.id, name, hs6: new Set() }).get(p.id);
      hit.forEach((h) => pr.hs6.add(h));
      d.evidence.push({ productId: p.id, product: name, source: sm.source, extended, period: sm.source === "mdic" ? `${sm.period_from ?? "?"} a ${sm.period_to ?? "?"}` : `${sm.period_to ?? "ano não informado"}`, hs6: hit, usd: hit.reduce((n, h) => n + Number(all[h]), 0) });
    }
  }
  const items = [];
  for (const d of out.values()) {
    // Período padrão prevalece; o mais longo só quando o padrão não tem registro do produto naquele país.
    const std = d.evidence.filter((e) => !e.extended);
    const ev = d.evidence.filter((e) => !e.extended || !std.some((x) => x.productId === e.productId));
    const products = [...d.products.values()].filter((x) => ev.some((e) => e.productId === x.productId)).map((x) => ({ productId: x.productId, name: x.name, hs6: [...x.hs6] }));
    const hsAll = products.flatMap((x) => x.hs6);
    const srcs = foreignSources(d.iso2, hsAll).filter((x) => x.status === "available" && allowed.has(x.key));
    const first = ev[0];
    items.push({
      iso2: d.iso2, iso3: d.iso3, name: d.name, nameEn: d.nameEn ?? null, products, stale: d.stale, extended: ev.every((e) => e.extended),
      evidence: ev.map((e) => ({ ...e, text: `${SOURCE_SHORT[e.source]}, ${e.period}${e.extended ? " (período guardado mais longo)" : ""}: SH ${e.hs6.join(", ")} (${e.product})` })),
      line: `${SOURCE_SHORT[first.source]}, ${first.period}${first.extended ? " (período guardado mais longo)" : ""}${ev.length > 1 ? ` e mais ${ev.length - 1} registro(s)` : ""}`,
      basis: products.length === 1 ? products[0].name : products.map((x) => x.name).join(", "),
      connector: srcs.length ? { available: true, labels: srcs.map((x) => x.label) } : { available: false, note: "sem fonte de empresas coberta para este país e esta commodity: limitação de cobertura" },
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  // Dado vencido de destino comprovado: pede a atualização permitida (um por país por dia, dentro do orçamento).
  const refreshed = [];
  if (deps.refresh) for (const x of items.filter((y) => y.stale).slice(0, 3)) if (await deps.refresh(x.iso3).catch(() => null)) refreshed.push(x.iso3);
  const total = countries.size;
  const covered = byCountry.size;
  const coverage = {
    countriesWithData: covered, countriesTotal: total, stale: stale.size, inGeneration: running, failed: failedSources, pendingSummaries: pending,
    period: w.months ? `${w.months} meses (padrão)${w.longest ? `; até ${w.longest} meses guardados para exportações do Brasil` : ""}` : null,
    refreshed,
  };
  const incomplete = !!unclassified.length || covered < total || running > 0 || failedSources > 0 || pending > 0 || !w.months;
  const reasons = [
    unclassified.length ? `${unclassified.map((x) => x.name).join(", ")}: classificação SH ainda não confirmada no catálogo (sem ela, a lista oficial não é cruzada com o produto)` : null,
    !w.months ? "período padrão de análise internacional não aprovado nos parâmetros" : null,
    covered < total ? `${total - covered} país(es) sem lista mensal vigente` : null,
    running ? `${running} país(es) com a lista em geração` : null,
    failedSources ? `${failedSources} país(es) com falha da fonte na última consulta` : null,
    pending ? `${pending} resumo(s) ainda em preparação` : null,
  ].filter(Boolean);
  const state = items.length ? "ready" : pending > 0 || running > 0 ? "checking" : incomplete ? "none_incomplete" : "none_valid";
  return {
    state, items, unclassified, coverage, incomplete, reasons,
    message: state === "ready" ? null
      : state === "checking" ? "Verificando mercados compradores"
      : state === "none_valid" ? "Nenhum destino identificado nos dados disponíveis: as fontes responderam e não há registro de comércio deste produto com o Brasil no período."
      : `Nenhum destino identificado nos dados disponíveis. Cobertura incompleta: ${reasons.join("; ")}. Isso não indica ausência de compradores.`,
    retry: state !== "ready" && state !== "none_valid",
  };
}

// Produtos da escolha: um produto, ou todos os produtos ativos da commodity.
export async function productsOf(env, tenant, { productId, commodity }) {
  if (productId) return (await s(env, "SELECT * FROM products WHERE tenant_id=? AND id=? AND active<>0", tenant, productId).all()).results;
  if (commodity) return (await s(env, "SELECT * FROM products WHERE tenant_id=? AND commodity=? AND active<>0", tenant, commodity).all()).results;
  return [];
}
