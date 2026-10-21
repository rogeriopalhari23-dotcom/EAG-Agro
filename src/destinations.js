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

// Cobertura POR PRODUTO, por país e por fonte: só conta como "consultado sem registro" o país cuja resposta da fonte é
// válida E cuja consulta incluiu os códigos do produto (capítulo na classificação da lista; SH no bloco consultado da
// Comtrade). Fonte disponível, disponibilidade de anos ou arquivo acessível não bastam. Na prévia e nos testes
// (env.SIMULATED_TRADE), país sem resposta simulada configurada fica como tal, nunca como ausência de comércio.
// Estados: positive, valid_absent, not_declared, no_code, no_simulation, not_consulted, failed, pending, missing.
const SRC = {
  mdic: { label: "MDIC — exportações do Brasil para o país (FOB, mensal)", direction: "exportações do Brasil (Brasil → país)" },
  comtrade: { label: "UN Comtrade — importações declaradas pelo país (anual)", direction: "importações declaradas pelo país com origem Brasil (país ← Brasil)" },
};
export async function productCoverage(env, { products, hsOf, months, countries }) {
  const sim = parse(env.SIMULATED_TRADE, null);
  const cur = (await s(env, "SELECT iso3,source,version_id,content_sha256 FROM trade_list_current").all()).results;
  const ptr = new Map(cur.map((c) => [`${c.iso3}|${c.source}`, c]));
  const st = (await s(env, "SELECT t.iso3,t.source,t.state,t.hs6_json,t.period_from,t.period_to FROM trade_country_summary t JOIN trade_list_current c ON c.iso3=t.iso3 AND c.source=t.source AND c.content_sha256=t.content_sha256 WHERE t.period_months=(CASE t.source WHEN 'mdic' THEN ? ELSE 0 END)", months).all()).results;
  const sum = new Map(st.map((x) => [`${x.iso3}|${x.source}`, x]));
  // Sem ponteiro: situação mais recente do país na fonte (em geração, falha, sem código).
  const last = new Map();
  for (const r of (await s(env, "SELECT st.iso3,st.source,st.state,st.error,v.status vstatus FROM trade_list_status st JOIN trade_list_versions v ON v.id=st.version_id ORDER BY v.started_at").all()).results) last.set(`${r.iso3}|${r.source}`, r);
  const versions = new Map((await s(env, "SELECT id,kind,classification_json FROM trade_list_versions").all()).results.map((v) => [v.id, v]));
  const chaptersOf = (vid) => new Set(parse(versions.get(vid)?.classification_json, {})?.chapters ?? []);
  // Blocos SH realmente consultados na Comtrade, por versão (referência guardada no R2).
  const latestMonthly = [...versions.values()].filter((v) => v.kind === "monthly").map((v) => v.id).sort().at(-1);
  const blocks = new Map();
  for (const vid of new Set(cur.filter((c) => c.source === "comtrade").map((c) => c.version_id))) {
    let ref = null;
    for (const k of [vid, latestMonthly].filter(Boolean)) {
      const o = env.FILES ? await env.FILES.get(`trade-ref/${k}/hs6-blocks.json`).catch(() => null) : null;
      if (o) { ref = parse(await o.text(), null); break; }
    }
    blocks.set(vid, ref ? new Set(ref.blocks.flat().map(String)) : null);
  }
  const out = [];
  for (const p of products) {
    const hs = [...(hsOf.get(p.id) ?? [])];
    const bySource = {};
    for (const source of ["mdic", "comtrade"]) {
      const n = { positive: 0, valid_absent: 0, not_declared: 0, no_code: 0, no_simulation: 0, not_consulted: 0, failed: 0, pending: 0, missing: 0 };
      const periods = new Map();
      for (const c of countries.values()) {
        const key = `${c.iso3}|${source}`;
        const pt = ptr.get(key);
        let state;
        if (!pt) {
          const l = last.get(key);
          state = !l ? "missing" : l.vstatus === "running" && l.state === "pending" ? "pending" : l.state === "data_unavailable" && l.error === "país sem código nesta fonte" ? "no_code" : l.state === "data_unavailable" ? "failed" : "missing";
        } else if (sim && !(sim[source] ?? []).includes(c.iso3)) state = "no_simulation";
        else if (!hs.some((h) => chaptersOf(pt.version_id).has(h.slice(0, 2)))) state = "not_consulted";
        else if (source === "comtrade" && blocks.get(pt.version_id) && !hs.some((h) => blocks.get(pt.version_id).has(h))) state = "not_consulted";
        else {
          const sm = sum.get(key);
          if (!sm) state = "pending";
          else if (sm.state === "purchase_identified") {
            const all = parse(sm.hs6_json, {});
            state = hs.some((h) => Number(all[h]) > 0) ? "positive" : "valid_absent";
          } else state = { no_record: "valid_absent", not_declared: "not_declared", data_unavailable: "failed" }[sm.state] ?? "pending";
          if (sm && ["positive", "valid_absent"].includes(state)) {
            const per = source === "mdic" ? `${sm.period_from ?? "?"} a ${sm.period_to ?? "?"}` : String(sm.period_to ?? "?");
            periods.set(per, (periods.get(per) ?? 0) + 1);
          }
        }
        n[state]++;
      }
      const total = countries.size;
      const answered = n.positive + n.valid_absent;
      const period = [...periods.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 2).join("; ") || "sem período consultado";
      const complete = source === "mdic"
        ? answered + n.no_code === total
        : n.failed + n.pending + n.missing + n.no_simulation + n.not_consulted === 0;
      bySource[source] = {
        ...SRC[source], counts: n, total, answered, complete, period,
        text: `${SRC[source].label} — ${SRC[source].direction}; SH ${hs.join(", ")}; período ${period}: ${answered} de ${total} países com resposta válida que inclui o produto${n.positive ? ` (${n.positive} com registro)` : ""}${[["no_simulation", "sem resposta simulada configurada"], ["not_consulted", "consulta sem estes códigos"], ["not_declared", "sem declaração do país"], ["failed", "falha da fonte"], ["pending", "pendentes"], ["missing", "sem lista"], ["no_code", "sem código na fonte"]].filter(([k]) => n[k]).map(([k, l]) => `; ${n[k]} ${l}`).join("")}.`,
      };
    }
    out.push({ productId: p.id, name: p.display_name ?? p.variant_name, hs6: hs, bySource, validAbsence: !bySource.mdic.counts.positive && !bySource.comtrade.counts.positive && bySource.mdic.complete && bySource.comtrade.complete });
  }
  return out;
}

// products: linhas de products (uma commodity ou um produto). deps.rebuild(env, tenant, { months }) refaz resumos a
// partir dos objetos oficiais já guardados (sem chamada externa). deps.refresh(iso3) pede a atualização de um país com
// dado vencido pelo fluxo existente (R12.15), quando a política permite.
// preparation: { prep (prepareMarketData), progress (marketDataProgress), asks (característica do produto pendente) }.
export async function destinationsFor(env, tenant, { products, profile, deps = {}, preparation = {} }) {
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
  const failedSources = (await s(env, "SELECT COUNT(DISTINCT st.iso3) n FROM trade_list_status st JOIN trade_list_versions v ON v.id=st.version_id WHERE v.status<>'running' AND st.state='data_unavailable' AND COALESCE(st.error,'')<>'país sem código nesta fonte' AND NOT EXISTS (SELECT 1 FROM trade_list_current c WHERE c.iso3=st.iso3 AND c.source=st.source)").first())?.n ?? 0;
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
  // Cobertura por produto: a ausência só é afirmada com consultas válidas que incluíram o produto, em todas as fontes.
  const diagnostics = classified.length ? await productCoverage(env, { products: classified, hsOf, months: w.months, countries }) : [];
  const allAbsent = diagnostics.length > 0 && diagnostics.every((d) => d.validAbsence) && !unclassified.length;
  for (const d of diagnostics) if (!d.validAbsence && !items.some((x) => x.products.some((p) => p.productId === d.productId)))
    reasons.push(...["mdic", "comtrade"].filter((k) => !d.bySource[k].complete).map((k) => `${d.name}, ${k === "mdic" ? "MDIC" : "Comtrade"}: ${d.bySource[k].answered} de ${d.bySource[k].total} países com resposta válida que inclui o produto`));
  // Preparação em curso (rotina iniciada, fila andando, resumos a refazer): os destinos chegam aos poucos; lista vazia
  // nunca é resultado final enquanto classificação ou cobertura estiverem pendentes.
  const { prep = null, progress = null, asks = [] } = preparation;
  if (prep?.state === "blocked") reasons.unshift(prep.reason);
  if (progress?.waiting) reasons.push(progress.waiting);
  const preparing = !!(progress || ["started", "running"].includes(prep?.state) || pending > 0);
  const state = items.length ? "ready"
    : preparing ? "preparing"
    : asks.length ? "needs_characteristic"
    : prep?.state === "blocked" ? "blocked"
    : allAbsent ? "none_valid" : "none_incomplete";
  const pct = (x) => (x?.total ? `${x.done} de ${x.total} países` : null);
  const progressText = progress ? [pct(progress.mdic) && `exportações do Brasil (MDIC): ${pct(progress.mdic)}`, pct(progress.comtrade) && `importações declaradas (Comtrade): ${pct(progress.comtrade)}`, progress.waiting].filter(Boolean).join("; ") : pending ? `${pending} resumo(s) em preparação a partir dos dados oficiais guardados` : null;
  return {
    state, items, unclassified, coverage, incomplete: incomplete || !allAbsent, reasons, preparing, progress, progressText, diagnostics,
    message: state === "ready" ? (preparing ? `Preparando os mercados compradores: os destinos comprovados aparecem conforme os dados chegam (${progressText}).` : null)
      : state === "preparing" ? `Preparando os mercados compradores${progressText ? ` (${progressText})` : ""}.`
      : state === "needs_characteristic" ? `Falta uma característica do produto para classificá-lo: ${asks.map((a) => `${a.name}: ${a.question}`).join("; ")}.`
      : state === "blocked" ? `Os mercados compradores ainda não podem ser preparados: ${prep.reason}.`
      : state === "none_valid" ? `Nenhum destino identificado: consultas válidas que incluíram o produto não registram comércio com o Brasil (${diagnostics.map((d) => `${d.name}: MDIC ${d.bySource.mdic.period}, ${d.bySource.mdic.answered} países; Comtrade ${d.bySource.comtrade.period}, ${d.bySource.comtrade.answered} países`).join("; ")}).`
      : `Nenhum destino identificado nos dados disponíveis. Cobertura incompleta: ${reasons.join("; ")}. Isso não indica ausência de compradores.`,
    retry: !["ready", "none_valid", "needs_characteristic"].includes(state),
  };
}

// Produtos da escolha: um produto, ou todos os produtos ativos da commodity.
export async function productsOf(env, tenant, { productId, commodity }) {
  if (productId) return (await s(env, "SELECT * FROM products WHERE tenant_id=? AND id=? AND active<>0", tenant, productId).all()).results;
  if (commodity) return (await s(env, "SELECT * FROM products WHERE tenant_id=? AND commodity=? AND active<>0", tenant, commodity).all()).results;
  return [];
}
