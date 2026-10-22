// Pesquisa automática por rotação (botões "Pesquisa automática nacional" e "internacional"): escolhe uma combinação
// elegível pelo perfil, pelas origens e limites configurados e pela evidência oficial, priorizando a pouco pesquisada
// ou com dados a atualizar. Só escolhe e inicia a pesquisa (dentro da política); nada de contato comercial.
// Falta de dado ou falha de fonte deixa a combinação inelegível agora, nunca vira conclusão sobre compradores.
import { statement as s, parameters } from "../store.js";
import { SEGMENT_PRESETS } from "../rodada/segments.js";
import { foreignSources } from "../sources-applicable.js";
import { commodityLabelOf } from "../catalog-names.js";
import { availabilityFor } from "../availability.js";

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
// Mesma regra do formulário e da criação da pesquisa (src/destinations.js): o país entra pela evidência oficial em
// QUALQUER subposição verificada do próprio produto. Evidência de mercado e fonte de empresas são separadas: a falta de
// conector vira limitação de cobertura listada a cada consulta, nunca esquecimento do mercado nem ausência de compradores.
const evText = (e, name) => e.source === "mdic" ? `exportações do Brasil para ${name} (MDIC, FOB, ${e.period}${e.extended ? ", período guardado mais longo" : ""})` : `importações de origem Brasil declaradas por ${name} (Comtrade, ${e.period})`;

// Ordem (mesma relação do formulário, src/availability.js):
//  0 empresas identificadas ainda sem pesquisa própria (já cadastradas compatíveis: aproveitar o que existe);
//  1 mercado a investigar nunca pesquisado; 2 empresas identificadas com pesquisa antiga (dados a atualizar);
//  3 mercado a investigar com nova tentativa vencida (consulta sem estabelecimentos ou pendência técnica).
// Dentro do nível: fonte de melhor qualidade (registro/diretório antes do mapa), maior valor de comércio, desempate do dia.
// Fora: pesquisa em andamento, sem fonte de empresas, nova tentativa ainda não vencida, identificadas pesquisadas há pouco.
export function rankPairs(dest, jobsByKey, at) {
  const out = [];
  const skipped = { researching: 0, waiting: 0, noSource: 0, recent: 0 };
  for (const d of dest.items) for (const pr of d.products) {
    const a = pr.availability;
    const key = `${pr.productId}|${d.iso3}`;
    if (a.status === "researching") { skipped.researching++; continue; }
    if (a.status === "no_source") { skipped.noSource++; continue; }
    if (a.nextAttempt) { skipped.waiting++; continue; }
    const mine = jobsByKey.get(key) ?? [];
    const last = mine.map((j) => j.created_at).sort().at(-1);
    const days = last ? Math.floor((Date.parse(at) - Date.parse(last)) / DAY) : null;
    let rank, why;
    if (a.tier === "identified") {
      if (!mine.length) (rank = 0), (why = `empresas identificadas (${a.note}) sem pesquisa própria: aproveitar o que existe`);
      else if (days >= STALE_DAYS) (rank = 2), (why = `empresas identificadas; última pesquisa há ${days} dias (dados a atualizar)`);
      else { skipped.recent++; continue; }
    } else if (a.status === "not_researched") (rank = 1), (why = "mercado a investigar, nunca pesquisado");
    else (rank = 3), (why = `mercado a investigar: nova tentativa vencida (${a.tag})`);
    const conn = (a.sourcesToTry ?? []);
    const quality = conn.some((x) => x.quality === "boa") ? 0 : 1;
    const usd = d.evidence.filter((e) => e.productId === pr.productId).reduce((n, e) => n + (Number(e.usd) || 0), 0);
    out.push({ key, rank, quality, usd, why, d, pr });
  }
  return { list: out.sort((a, b) => a.rank - b.rank || a.quality - b.quality || b.usd - a.usd || dayHash(a.key, at.slice(0, 10)) - dayHash(b.key, at.slice(0, 10))), skipped };
}

export async function pickInternational(env, tenant, { profile, at }, deps = {}) {
  const products = (await s(env, "SELECT * FROM products WHERE tenant_id=? AND active<>0 AND identity_status='confirmed'", tenant).all()).results;
  const dest = await availabilityFor(env, tenant, { products, profile, deps, at });
  const jobsByKey = new Map();
  for (const j of await history(env, tenant, "international")) { const k = `${j.input.productId}|${j.input.location?.iso3}`; (jobsByKey.get(k) ?? jobsByKey.set(k, []).get(k)).push(j); }
  // Fontes de cada par (a classificação de investigate já traz sourcesToTry; identificadas, do mesmo cálculo).
  for (const d of dest.items) for (const pr of d.products) pr.availability.sourcesToTry ??= dest.investigate.find((x) => x.iso3 === d.iso3 && x.productId === pr.productId)?.sourcesToTry ?? foreignSources(d.iso2, pr.hs6).filter((x) => x.status === "available" && (profile.sources?.international ?? []).includes(x.key)).map((x) => ({ key: x.key, label: x.label, quality: x.key === "osm" ? "parcial" : "boa" }));
  const { list, skipped } = rankPairs(dest, jobsByKey, at);
  const byId = new Map(products.map((p) => [p.id, p]));
  const coverage = {
    identified: dest.principal.length, toInvestigate: dest.investigate.length, exploration: dest.exploration,
    noSourceNote: skipped.noSource ? `${skipped.noSource} combinação(ões) com comércio comprovado e sem fonte de empresas coberta: limitação de cobertura, não ausência de compradores.` : null,
    waitingNote: skipped.waiting ? `${skipped.waiting} combinação(ões) aguardando o prazo de nova tentativa (consulta sem estabelecimentos ou pendência técnica, com cobertura e qualidade registradas).` : null,
    partialSummaries: dest.coverage.pendingSummaries ? `Resumo completo de subposições ainda em preparação para ${dest.coverage.pendingSummaries} registro(s).` : null,
  };
  const best = list[0];
  if (!best) return { none: true, eligible: 0, coverage, reasons: [skipped.researching ? `${skipped.researching} combinação(ões) já com pesquisa em andamento (reaproveitadas, sem duplicar)` : null, coverage.waitingNote, coverage.noSourceNote, skipped.recent ? `${skipped.recent} combinação(ões) com empresas identificadas e pesquisa recente` : null, dest.unclassified.length ? `${dest.unclassified.length} produto(s) ainda sem classificação SH confirmada` : null, !dest.items.length ? "nenhum país com comércio oficial registrado com o Brasil para os produtos classificados (na lista mensal já publicada)" : null].filter(Boolean) };
  const p = byId.get(best.pr.productId);
  const label = await commodityLabelOf(env, tenant, p.commodity);
  const ev = best.d.evidence.filter((e) => e.productId === p.id).map((e) => `${evText(e, best.d.name)} registram SH ${e.hs6.join(", ")}`).join("; ");
  return {
    key: best.key, eligible: list.length, coverage,
    input: { market: "international", productId: p.id, location: { iso3: best.d.iso3 } },
    reason: `${both(label, p.variant_name)} × ${best.d.name}: ${ev}; ${best.why}. Fontes de empresas: ${(best.pr.availability.sourcesToTry ?? []).map((x) => x.label).join("; ") || "—"}.`,
  };
}
