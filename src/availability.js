// Disponibilidade da prospecção internacional (2026-10-22, revisão): distingue MERCADO COMPRADOR (evidência oficial de
// comércio com o Brasil, src/destinations.js) de CAPACIDADE EFETIVA DE ENCONTRAR EMPRESAS. Uma relação país × produto para
// os dois sentidos (commodity → destinos; destino → commodities), usada no formulário, no Radar Internacional, na
// criação da pesquisa, na pesquisa automática e na exploração em segundo plano.
//  - "Empresas identificadas" (seleção principal): candidatas reais encontradas numa pesquisa, ou empresas já cadastradas
//    no país relacionadas ao produto ou com atividade compatível (inclusive de outra commodity). São candidatas, não
//    compradoras confirmadas.
//  - "Mercados a investigar" (seção recolhida): comércio comprovado sem candidata identificada — ainda não pesquisado,
//    pesquisa sem candidatas, pendência técnica ou sem fonte de empresas coberta. A exploração automática tenta as fontes
//    pertinentes dentro da política e dos limites; com candidatas, a combinação passa para a seleção principal.
//  - Consulta vazia comprova só que AQUELA consulta não achou estabelecimentos: a cobertura e a qualidade de cada fonte
//    ficam registradas e definem quando tentar de novo; nunca conclui ausência de compradores. Falha técnica, simulação
//    ausente ou cobertura insuficiente nunca produzem conclusão negativa. Execução simulada não muda nada aqui.
import { statement as s, now, auditStatement, commit } from "./store.js";
import { fail, requireRole, WRITE_ROLES } from "./http.js";
import { foreignSources } from "./sources-applicable.js";
import { MAP_VERSION } from "./discovery-map.js";
import { compatibleActivity } from "./compatibility.js";
import { destinationsFor } from "./destinations.js";

const DAY = 86400000;
const parse = (t, d = null) => { try { return t ? JSON.parse(t) : d; } catch { return d; } };
const ACTIVE = ["queued", "running", "waiting", "needs_decision", "paused"];
// Prazos de nova tentativa (política vigente; padrões quando a política não os define).
export function reviewWindows(policy) {
  const i = policy?.policy?.international ?? {};
  const pos = (v, d) => (Number(v) > 0 ? Number(v) : d);
  return { emptyCompleteDays: pos(i.reassessEmptyDays, 90), emptyPartialDays: pos(i.reassessPartialDays, 30), technicalHours: pos(i.retryTechnicalHours, 24), technicalMaxDays: 30 };
}
const allowedOf = (profile) => new Set(profile?.sources?.international ?? []);
// Fontes de empresas aplicáveis ao par (mesma regra do planejamento e da execução).
export const connectorOf = (iso2, hs6, profile) => foreignSources(iso2, hs6).filter((x) => x.status === "available" && allowedOf(profile).has(x.key));
// Identidade da consulta de empresas: regra de descoberta e, por fonte, a regra aplicada. Produtos da mesma commodity com a
// mesma consulta no mesmo país compartilham o resultado; fonte ou regra nova muda a identidade (nova tentativa).
export const fingerprintOf = (iso2, hs6, profile) => `${MAP_VERSION}|${connectorOf(iso2, hs6, profile).map((x) => `${x.key}:${x.rule ?? ""}`).sort().join(";")}`;
// Cobertura e qualidade por fonte: registro oficial ou diretório da atividade cobre quem está registrado; o mapa
// colaborativo só o que foi mapeado (regra só por etiqueta de produto: fraca).
export function sourceQuality(src) {
  if (src.key === "osm") return /muito irregular|só pela etiqueta/.test(src.note ?? "") ? { coverage: "parcial (só o que foi mapeado)", quality: "fraca" } : { coverage: "parcial (só o que foi mapeado)", quality: "parcial" };
  return { coverage: "registro ou diretório da atividade", quality: "boa" };
}
const QUALITY_TEXT = { boa: "boa", parcial: "parcial", fraca: "fraca" };

// Avaliação ao fim de uma pesquisa internacional (etapa "relatório"). → linha gravada
export async function recordAssessment(env, { job, input, state, summary, profile, policy, at = now() }) {
  const origin = env.SIMULATED_DISCOVERY === "1" ? "simulated" : "real";
  const runs = state.sourceRuns ?? {};
  const sources = (state.applicable ?? []).map((x) => {
    const r = runs[x.key];
    const status = r?.done && !r.failed ? "ok" : r?.failed ? "failed" : x.status === "pending" ? "pending" : "not_run";
    return { key: x.key, label: x.label ?? x.key, status, found: r?.found ?? null, note: r?.failed ?? (status === "pending" ? x.note ?? null : null), ...sourceQuality(x) };
  });
  const existing = state.existing?.count ?? 0;
  const candidates = summary.candidates ?? 0;
  const ran = sources.filter((x) => x.status === "ok");
  const w = reviewWindows(policy);
  let outcome, reason, quality = null, wait;
  if (candidates > 0 || (summary.registered ?? 0) > 0 || existing > 0) {
    outcome = "found";
    reason = `${candidates} candidata(s) nas fontes, ${summary.registered ?? 0} empresa(s) na busca, ${existing} já cadastrada(s) com atividade compatível (candidatas, não compradoras confirmadas).`;
    wait = w.emptyCompleteDays * DAY;
  } else if (state.searchId && sources.length && ran.length === sources.length) {
    outcome = "empty";
    quality = ran.some((x) => x.quality === "boa") ? "complete" : "partial";
    reason = `As consultas feitas não acharam estabelecimentos: ${ran.map((x) => `${x.label} (cobertura ${x.coverage}, qualidade ${QUALITY_TEXT[x.quality]}): 0`).join("; ")}; nenhuma empresa já cadastrada compatível no país. Isso comprova só o resultado destas consultas, não ausência de compradores.`;
    wait = (quality === "complete" ? w.emptyCompleteDays : w.emptyPartialDays) * DAY;
  } else {
    outcome = "technical";
    const bad = sources.filter((x) => x.status !== "ok").map((x) => `${x.label}: ${x.status === "failed" ? `falhou (${x.note})` : x.status === "pending" ? `pendente (${x.note ?? "sem cobertura"})` : "não consultada"}`);
    reason = !state.searchId ? `Busca de empresas não aberta: ${state.blocked?.message ?? state.marketGap?.reason ?? "pesquisa incompleta"}.`
      : !sources.length ? "Nenhuma fonte de empresas aplicável foi consultada."
      : `Pesquisa incompleta: ${bad.join("; ")}. Isso não indica ausência de compradores.`;
    // Falhas seguidas: espera crescente (24 h, 48 h, 96 h…, até 30 dias), sem repetir a mesma falha a cada ciclo.
    const prev = (await s(env, "SELECT outcome FROM market_assessments WHERE tenant_id=? AND product_id=? AND iso3=? AND origin=? ORDER BY assessed_at DESC LIMIT 6", job.tenant_id, input.productId, input.location.iso3, origin).all()).results;
    let k = 0;
    for (const p of prev) { if (p.outcome !== "technical") break; k++; }
    wait = Math.min(w.technicalHours * 3600000 * 2 ** k, w.technicalMaxDays * DAY);
  }
  const reviewAfter = new Date(Date.parse(at) + wait).toISOString();
  const hs6 = state.hs6 ?? input.evidenceAtStart?.hs6 ?? [];
  const id = crypto.randomUUID();
  const stored = sources.map((x) => ({ ...x, searchQuality: quality }));
  await commit(env, [
    s(env, "UPDATE market_assessments SET superseded_at=?,superseded_reason=?,superseded_by=? WHERE tenant_id=? AND product_id=? AND iso3=? AND superseded_at IS NULL AND origin=?", at, "nova avaliação", id, job.tenant_id, input.productId, input.location.iso3, origin),
    s(env, "INSERT INTO market_assessments(id,tenant_id,product_id,iso3,outcome,origin,job_id,search_id,reason,sources_json,fingerprint,candidates,existing,assessed_at,review_after) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id, job.tenant_id, input.productId, input.location.iso3, outcome, origin, job.id, state.searchId ?? null, reason, JSON.stringify(stored), fingerprintOf(input.location.iso2, hs6, profile), candidates, existing, at, reviewAfter),
  ]);
  return { id, outcome, origin, reason, reviewAfter, quality };
}

// Empresas já cadastradas no exterior, por país: relação com o produto ou atividade compatível com a commodity.
async function companiesIndex(env, tenant) {
  const rows = (await s(env, "SELECT id,country_code,activity_text,pipeline_status FROM companies WHERE tenant_id=? AND country_code<>'BR'", tenant).all()).results;
  const rel = new Map();
  for (const r of (await s(env, "SELECT b.company_id,b.product_id,p.commodity,COALESCE(p.display_name,p.variant_name) label FROM buyer_profiles b JOIN products p ON p.id=b.product_id WHERE b.tenant_id=?", tenant).all()).results)
    (rel.get(r.company_id) ?? rel.set(r.company_id, []).get(r.company_id)).push(r);
  const by = new Map();
  for (const c of rows) if (!["blocked", "inactive"].includes(c.pipeline_status)) (by.get(c.country_code) ?? by.set(c.country_code, []).get(c.country_code)).push({ ...c, related: rel.get(c.id) ?? [] });
  return (iso2, product) => {
    let relatedN = 0, compatibleN = 0;
    for (const c of by.get(iso2) ?? []) {
      if (c.related.some((x) => x.product_id === product.id)) relatedN++;
      else if (compatibleActivity(product.commodity, { activityText: c.activity_text ?? "", related: c.related }).compatible) compatibleN++;
    }
    return { relatedN, compatibleN };
  };
}

// Situação de cada par (só execuções reais): avaliação vigente, a da mesma consulta para outro produto e a última pesquisa.
async function pairsState(env, tenant) {
  const rows = (await s(env, "SELECT * FROM market_assessments WHERE tenant_id=? AND superseded_at IS NULL AND origin='real'", tenant).all()).results;
  const assessed = new Map(rows.map((r) => [`${r.product_id}|${r.iso3}`, r]));
  const sameQuery = new Map();
  for (const r of rows.filter((x) => x.outcome !== "technical").sort((a, b) => a.assessed_at.localeCompare(b.assessed_at))) sameQuery.set(`${r.iso3}|${r.fingerprint}`, r);
  const names = new Map((await s(env, "SELECT id,COALESCE(display_name,variant_name) name FROM products WHERE tenant_id=?", tenant).all()).results.map((p) => [p.id, p.name]));
  const jobs = new Map();
  for (const j of (await s(env, "SELECT id,status,input_json,created_by,created_at,updated_at,error FROM prospect_jobs WHERE tenant_id=? AND market='international' ORDER BY created_at", tenant).all()).results) {
    const i = parse(j.input_json, {});
    if (i.productId && i.location?.iso3) jobs.set(`${i.productId}|${i.location.iso3}`, j);
  }
  return { assessed, sameQuery, names, jobs, companies: await companiesIndex(env, tenant) };
}

// Classificação de um par. → { tier: identified|investigate, status, tag, note, nextAttempt, sources, … }
function classify({ product, iso2, iso3, hs6, profile, at, ctx }) {
  const key = `${product.id}|${iso3}`;
  const conn = connectorOf(iso2, hs6, profile);
  const fp = fingerprintOf(iso2, hs6, profile);
  const job = ctx.jobs.get(key);
  const own = ctx.assessed.get(key);
  const sib = !own ? ctx.sameQuery.get(`${iso3}|${fp}`) ?? null : null;
  const a = own ?? sib;
  const via = sib ? ` (mesma consulta de empresas já feita na pesquisa de ${ctx.names.get(sib.product_id) ?? sib.product_id}: mesmas fontes e regras)` : "";
  const base = a ? { assessmentId: a.id, assessedAt: a.assessed_at, nextAttempt: a.review_after, sources: parse(a.sources_json, []), reason: `${a.reason}${via}`, jobId: a.job_id, viaProductId: sib ? sib.product_id : null, sameQuery: a.fingerprint === fp } : {};
  const co = ctx.companies(iso2, product);
  const active = job && ACTIVE.includes(job.status);
  // Empresas identificadas: candidatas encontradas na pesquisa ou empresas já cadastradas (relação ou atividade).
  if (a?.outcome === "found" || co.relatedN || co.compatibleN) {
    // Candidatas da própria pesquisa já viram empresas relacionadas ao produto: não contar duas vezes.
    const parts = [a?.outcome === "found" ? a.reason.replace(/ \(candidatas, não compradoras confirmadas\)\.$/, "") : null, co.relatedN && a?.outcome !== "found" ? `${co.relatedN} empresa(s) já cadastrada(s) relacionada(s) ao produto` : null, co.compatibleN ? `${co.compatibleN} empresa(s) já cadastrada(s) com atividade compatível (inclusive de outra commodity)` : null].filter(Boolean);
    return { tier: "identified", status: active ? "researching" : "identified", tag: "empresas identificadas", note: `${parts.join("; ")}${via}. Candidatas, não compradoras confirmadas.`, ...base, related: co.relatedN, compatible: co.compatibleN, jobId: active ? job.id : base.jobId };
  }
  if (!conn.length) return { tier: "investigate", status: "no_source", tag: "sem fonte de empresas", note: "nenhuma fonte de empresas coberta para este país e esta commodity: limitação de cobertura, não ausência de compradores", nextAttempt: null };
  if (active) return { tier: "investigate", status: "researching", tag: "pesquisa em andamento", note: `pesquisa em andamento${job.created_by === EXPLORER_ID ? " (exploração automática)" : ""}`, jobId: job.id, ...(a ? base : {}) };
  if (job && ["failed", "cancelled"].includes(job.status) && (!a || a.assessed_at < job.created_at))
    return { tier: "investigate", status: "technical", tag: "pendência técnica", note: `última pesquisa ${job.status === "failed" ? `falhou${job.error ? ` (${String(job.error).slice(0, 120)})` : ""}` : "cancelada"} antes de concluir; não indica ausência de compradores`, nextAttempt: null, jobId: job.id };
  if (!a) return { tier: "investigate", status: "not_researched", tag: "ainda não pesquisada", note: `comércio comprovado; fontes de empresas a consultar: ${conn.map((x) => x.label).join("; ")}`, nextAttempt: null };
  // Regra ou fonte nova desde a avaliação: nova tentativa já.
  const due = !base.sameQuery || a.review_after <= at;
  if (a.outcome === "technical") return { tier: "investigate", status: "technical", tag: "pendência técnica", note: a.reason, ...base, nextAttempt: due ? null : a.review_after };
  return { tier: "investigate", status: "empty", tag: "consultas sem estabelecimentos", note: `${a.reason}${!base.sameQuery ? " Fontes ou regras mudaram desde então: nova tentativa permitida." : ""}`, ...base, nextAttempt: due ? null : a.review_after };
}
export const EXPLORER_ID = "system-exploration";

// Relação a partir dos destinos comprovados. products: linhas de products. → resposta de destinationsFor com cada
// produto classificado (availability), principal (só empresas identificadas) e investigate (mercados a investigar).
export async function availabilityFor(env, tenant, { products, profile, deps = {}, preparation = {}, at = now() }) {
  const dest = await destinationsFor(env, tenant, { products, profile, deps, preparation });
  const ctx = await pairsState(env, tenant);
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = [], principal = [], investigate = [];
  for (const d of dest.items) {
    const prods = d.products.map((pr) => ({ ...pr, availability: classify({ product: byId.get(pr.productId), iso2: d.iso2, iso3: d.iso3, hs6: pr.hs6, profile, at, ctx }) }));
    items.push({ ...d, products: prods });
    const ident = prods.filter((p) => p.availability.tier === "identified");
    if (ident.length) principal.push({ ...d, products: ident, evidence: d.evidence.filter((e) => ident.some((k) => k.productId === e.productId)) });
    for (const p of prods.filter((x) => x.availability.tier === "investigate")) {
      const ev = d.evidence.filter((e) => e.productId === p.productId);
      investigate.push({ iso2: d.iso2, iso3: d.iso3, country: d.name, productId: p.productId, product: p.name, commodity: byId.get(p.productId)?.commodity ?? null, hs6: p.hs6, evidence: ev.map((e) => e.text), usd: ev.reduce((n, e) => n + (Number(e.usd) || 0), 0), sourcesToTry: connectorOf(d.iso2, p.hs6, profile).map((x) => ({ key: x.key, label: x.label, ...sourceQuality(x) })), ...p.availability });
    }
  }
  const out = { ...dest, items, principal, investigate, exploration: await explorationStatus(env, investigate) };
  if (dest.state === "ready" && !principal.length) {
    out.state = "none_identified";
    out.message = `${dest.preparing && dest.message ? `${dest.message} ` : ""}Nenhum destino com empresas identificadas ainda. ${investigate.length} mercado(s) com comércio comprovado estão em "Mercados a investigar": a exploração automática consulta as fontes de empresas pertinentes dentro da política e dos limites.`;
    out.retry = false;
  }
  return out;
}

// Progresso da exploração em segundo plano (src/prospect/explore.js).
export async function explorationStatus(env, investigate = []) {
  const r = await s(env, "SELECT last_started_at,last_finished_at,last_result_json,last_error,last_error_at FROM maintenance_leases WHERE name='market_exploration'").first().catch(() => null);
  const last = parse(r?.last_result_json, null);
  const count = (st) => investigate.filter((x) => x.status === st).length;
  return {
    toInvestigate: investigate.length, notResearched: count("not_researched"), empty: count("empty"), technical: count("technical"), noSource: count("no_source"), researching: count("researching"),
    due: investigate.filter((x) => ["not_researched", "empty", "technical"].includes(x.status) && !x.nextAttempt).length,
    lastRunAt: r?.last_finished_at ?? null, last, error: r?.last_error ?? null, errorAt: r?.last_error_at ?? null,
  };
}

// Sentido destino → commodities: a mesma relação, agrupada por país. iso2 opcional (detalhe de um país).
export async function byCountry(env, tenant, { products, profile, deps, preparation, iso2 = null, labels = new Map() }) {
  const r = await availabilityFor(env, tenant, { products, profile, deps, preparation });
  const prodById = new Map(products.map((p) => [p.id, p]));
  const countries = new Map();
  const touch = (x) => countries.get(x.iso2) ?? countries.set(x.iso2, { iso2: x.iso2, iso3: x.iso3, name: x.name ?? x.country, commodities: new Map(), investigate: [] }).get(x.iso2);
  for (const d of r.principal) {
    const c = touch(d);
    for (const pr of d.products) {
      const code = prodById.get(pr.productId)?.commodity;
      const g = c.commodities.get(code) ?? c.commodities.set(code, { code, label: labels.get(code) ?? code, products: [] }).get(code);
      g.products.push({ productId: pr.productId, name: pr.name, hs6: pr.hs6, availability: pr.availability });
    }
  }
  for (const w of r.investigate) touch(w).investigate.push({ ...w, commodityLabel: labels.get(w.commodity) ?? w.commodity });
  const list = [...countries.values()].map((c) => ({ ...c, commodities: [...c.commodities.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR")) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return {
    state: ["ready", "none_identified"].includes(r.state) ? (list.some((c) => c.commodities.length) ? "ready" : "none_identified") : r.state,
    preparing: r.preparing, progressText: r.progressText, message: r.message, reasons: r.reasons, incomplete: r.incomplete, coverage: r.coverage, exploration: r.exploration,
    countries: list.filter((c) => c.commodities.length).map((c) => ({ iso2: c.iso2, iso3: c.iso3, name: c.name, commodities: c.commodities.map((g) => ({ code: g.code, label: g.label })) })),
    investigateCountries: list.filter((c) => !c.commodities.length && c.investigate.length).map((c) => ({ iso2: c.iso2, iso3: c.iso3, name: c.name, count: c.investigate.length })),
    country: iso2 ? list.find((c) => c.iso2 === iso2) ?? null : null,
  };
}

// POST /api/prospect/availability/reassess { assessmentId } — pessoa pede nova tentativa antes do prazo: a avaliação
// vigente é encerrada (histórico preservado). Nada é pesquisado aqui.
export async function reassessRoute(request, env, actor, rid, body) {
  requireRole(actor, WRITE_ROLES);
  const productId = String(body?.productId ?? "").slice(0, 80), iso3 = String(body?.iso3 ?? "").toUpperCase().slice(0, 3);
  const assessmentId = body?.assessmentId ? String(body.assessmentId).slice(0, 80) : null;
  const a = assessmentId
    ? await s(env, "SELECT id,outcome,product_id,iso3 FROM market_assessments WHERE tenant_id=? AND id=? AND superseded_at IS NULL AND origin='real'", actor.tenant_id, assessmentId).first()
    : await s(env, "SELECT id,outcome,product_id,iso3 FROM market_assessments WHERE tenant_id=? AND product_id=? AND iso3=? AND superseded_at IS NULL AND origin='real'", actor.tenant_id, productId, iso3).first();
  if (!a) fail(404, "assessment_not_found", "Não há avaliação vigente para esta combinação.");
  if (a.outcome === "found") fail(409, "already_identified", "A combinação já tem empresas identificadas.");
  const at = now();
  await commit(env, [
    s(env, "UPDATE market_assessments SET superseded_at=?,superseded_reason=?,superseded_by=? WHERE id=? AND superseded_at IS NULL", at, "nova tentativa pedida por pessoa", `user:${actor.id}`, a.id),
    auditStatement(env, actor, rid, "market_assessment.reassess_requested", "market_assessment", a.id, { productId: a.product_id, iso3: a.iso3, requestedFor: productId || null }),
  ]);
  return { ok: true, assessmentId: a.id, at };
}
