// Disponibilidade da prospecção internacional (2026-10-22): uma relação país × produto para os dois sentidos da
// escolha (commodity → países; país → commodities), usada no formulário, no Radar Internacional, na criação da pesquisa
// e na pesquisa automática. Parte dos destinos com evidência oficial de comércio (src/destinations.js) e aplica:
//  - empresas encontradas (inclusive já cadastradas, de qualquer commodity, com atividade compatível): disponível;
//  - ainda não pesquisada: disponível quando há fonte de empresas aplicável (sem fonte: limitação de cobertura);
//  - busca real concluída sem candidatas (todas as fontes aplicáveis responderam): retirada TEMPORARIAMENTE da seleção
//    principal, com motivo, fontes e data, até o vencimento da avaliação, fonte ou regra nova, empresa compatível
//    cadastrada ou reavaliação pedida por uma pessoa. Nunca exclusão permanente;
//  - falha, fonte indisponível, pesquisa incompleta ou dado em preparação: pendência técnica (não é ausência);
//  - execução simulada (prévia de demonstração): registrada como tal e ignorada aqui.
import { statement as s, now, auditStatement, commit } from "./store.js";
import { fail, requireRole, WRITE_ROLES } from "./http.js";
import { foreignSources } from "./sources-applicable.js";
import { MAP_VERSION } from "./discovery-map.js";
import { existingCompatible } from "./compatibility.js";
import { destinationsFor } from "./destinations.js";

const DAY = 86400000;
const parse = (t, d = null) => { try { return t ? JSON.parse(t) : d; } catch { return d; } };
const ACTIVE = ["queued", "running", "waiting", "needs_decision", "paused"];
// Prazos (política vigente; valores padrão quando a política não os define).
export function reviewWindows(policy) {
  const i = policy?.policy?.international ?? {};
  return { emptyDays: Number(i.reassessEmptyDays) > 0 ? Number(i.reassessEmptyDays) : 90, technicalHours: Number(i.retryTechnicalHours) > 0 ? Number(i.retryTechnicalHours) : 24 };
}
const allowedOf = (profile) => new Set(profile?.sources?.international ?? []);
// Fontes de empresas aplicáveis ao par (mesma regra do planejamento e da execução).
export const connectorOf = (iso2, hs6, profile) => foreignSources(iso2, hs6).filter((x) => x.status === "available" && allowedOf(profile).has(x.key));
// O que justifica reavaliar uma busca vazia antes do prazo: regra de descoberta ou conjunto de fontes diferente.
export const fingerprintOf = (iso2, hs6, profile) => `${MAP_VERSION}|fontes:${connectorOf(iso2, hs6, profile).map((x) => x.key).sort().join(",")}`;

// Avaliação ao fim de uma pesquisa internacional (etapa "relatório"). → linha gravada
export async function recordAssessment(env, { job, input, state, summary, profile, policy, at = now() }) {
  const origin = env.SIMULATED_DISCOVERY === "1" ? "simulated" : "real";
  const runs = state.sourceRuns ?? {};
  const sources = (state.applicable ?? []).map((x) => {
    const r = runs[x.key];
    const status = r?.done && !r.failed ? "ok" : r?.failed ? "failed" : x.status === "pending" ? "pending" : "not_run";
    return { key: x.key, label: x.label ?? x.key, status, found: r?.found ?? null, note: r?.failed ?? (status === "pending" ? x.note ?? null : null) };
  });
  const existing = state.existing?.count ?? 0;
  const candidates = summary.candidates ?? 0;
  const ran = sources.filter((x) => x.status === "ok");
  let outcome, reason;
  if (candidates > 0 || (summary.registered ?? 0) > 0 || existing > 0) {
    outcome = "found";
    reason = `${candidates} candidata(s) nas fontes, ${summary.registered ?? 0} empresa(s) na busca, ${existing} já cadastrada(s) com atividade compatível.`;
  } else if (state.searchId && sources.length && ran.length === sources.length) {
    outcome = "empty";
    reason = `Busca real concluída sem candidatas: ${ran.map((x) => `${x.label} respondeu com 0`).join("; ")}; nenhuma empresa já cadastrada com atividade compatível no país.`;
  } else {
    outcome = "technical";
    const bad = sources.filter((x) => x.status !== "ok").map((x) => `${x.label}: ${x.status === "failed" ? `falhou (${x.note})` : x.status === "pending" ? `pendente (${x.note ?? "sem cobertura"})` : "não consultada"}`);
    reason = !state.searchId ? `Busca de empresas não aberta: ${state.blocked?.message ?? state.marketGap?.reason ?? "pesquisa incompleta"}.`
      : !sources.length ? "Nenhuma fonte de empresas aplicável foi consultada."
      : `Pesquisa incompleta: ${bad.join("; ")}. Isso não indica ausência de compradores.`;
  }
  const w = reviewWindows(policy);
  const reviewAfter = new Date(Date.parse(at) + (outcome === "technical" ? w.technicalHours * 3600000 : w.emptyDays * DAY)).toISOString();
  const hs6 = state.hs6 ?? input.evidenceAtStart?.hs6 ?? [];
  const id = crypto.randomUUID();
  await commit(env, [
    s(env, "UPDATE market_assessments SET superseded_at=?,superseded_reason=?,superseded_by=? WHERE tenant_id=? AND product_id=? AND iso3=? AND superseded_at IS NULL AND origin=?", at, "nova avaliação", id, job.tenant_id, input.productId, input.location.iso3, origin),
    s(env, "INSERT INTO market_assessments(id,tenant_id,product_id,iso3,outcome,origin,job_id,search_id,reason,sources_json,fingerprint,candidates,existing,assessed_at,review_after) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id, job.tenant_id, input.productId, input.location.iso3, outcome, origin, job.id, state.searchId ?? null, reason, JSON.stringify(sources), fingerprintOf(input.location.iso2, hs6, profile), candidates, existing, at, reviewAfter),
  ]);
  return { id, outcome, origin, reason, reviewAfter };
}

// Situação atual de cada par (só execuções reais): avaliação vigente e última pesquisa.
async function pairsState(env, tenant) {
  const rows = (await s(env, "SELECT * FROM market_assessments WHERE tenant_id=? AND superseded_at IS NULL AND origin='real'", tenant).all()).results;
  const assessed = new Map(rows.map((r) => [`${r.product_id}|${r.iso3}`, r]));
  const jobs = new Map();
  for (const j of (await s(env, "SELECT id,status,input_json,created_at,updated_at,error FROM prospect_jobs WHERE tenant_id=? AND market='international' ORDER BY created_at", tenant).all()).results) {
    const i = parse(j.input_json, {});
    if (i.productId && i.location?.iso3) jobs.set(`${i.productId}|${i.location.iso3}`, j);
  }
  return { assessed, jobs };
}

// Classificação de um par. → { status: available|withdrawn|coverage, tag, note, review }
async function classify(env, tenant, { product, iso2, iso3, hs6, profile, at, assessed, job }) {
  const conn = connectorOf(iso2, hs6, profile);
  const fp = fingerprintOf(iso2, hs6, profile);
  if (job && ACTIVE.includes(job.status)) return { status: "available", tag: "em andamento", note: "pesquisa em andamento (reaproveitada, sem duplicar)", jobId: job.id };
  if (!conn.length) return { status: "coverage", tag: "sem fonte de empresas", note: "sem fonte de empresas coberta para este país e esta commodity: limitação de cobertura, não ausência de compradores" };
  const a = assessed;
  // Pesquisa interrompida depois da última avaliação (falha ou cancelamento): pendência técnica.
  if (job && ["failed", "cancelled"].includes(job.status) && (!a || a.assessed_at < job.created_at))
    return { status: "available", tag: "pendência técnica", note: `última pesquisa ${job.status === "failed" ? `falhou${job.error ? ` (${String(job.error).slice(0, 120)})` : ""}` : "cancelada"} antes de concluir; não indica ausência de compradores`, technical: true, retryAfter: null, jobId: job.id };
  if (!a) return { status: "available", tag: "não pesquisada", note: "ainda não pesquisada" };
  const sources = parse(a.sources_json, []);
  const base = { assessmentId: a.id, assessedAt: a.assessed_at, reviewAfter: a.review_after, sources, reason: a.reason, jobId: a.job_id };
  if (a.outcome === "found") return { status: "available", tag: "empresas encontradas", note: a.reason, ...base };
  if (a.outcome === "technical") return { status: "available", tag: "pendência técnica", note: a.reason, technical: true, retryAfter: a.review_after > at ? a.review_after : null, ...base };
  // Busca vazia: reavaliação quando vence, quando muda regra ou fonte, ou quando há empresa compatível já cadastrada.
  if (a.review_after <= at) return { status: "available", tag: "reavaliação", note: `busca vazia em ${a.assessed_at.slice(0, 10)}; avaliação vencida em ${a.review_after.slice(0, 10)}: nova pesquisa permitida`, ...base };
  if (a.fingerprint !== fp) return { status: "available", tag: "reavaliação", note: `busca vazia em ${a.assessed_at.slice(0, 10)}; desde então mudaram as fontes ou a regra de descoberta`, ...base };
  const existing = await existingCompatible(env, tenant, { product, market: "international", iso2, limit: 5 });
  if (existing.length) return { status: "available", tag: "empresas já cadastradas", note: `${existing.length} empresa(s) já cadastrada(s) no país com atividade compatível (inclusive de outra commodity)`, ...base };
  return { status: "withdrawn", tag: "retirada temporariamente", note: a.reason, ...base };
}

// Relação disponível a partir dos destinos comprovados. products: linhas de products. → resposta de destinationsFor com
// items só dos pares disponíveis, e withdrawn/coverage com os pares fora da seleção principal (motivo, fontes, datas).
export async function availabilityFor(env, tenant, { products, profile, deps = {}, preparation = {}, at = now() }) {
  const dest = await destinationsFor(env, tenant, { products, profile, deps, preparation });
  const { assessed, jobs } = await pairsState(env, tenant);
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = [], withdrawn = [], coverage = [];
  for (const d of dest.items) {
    const keep = [];
    for (const pr of d.products) {
      const key = `${pr.productId}|${d.iso3}`;
      const c = await classify(env, tenant, { product: byId.get(pr.productId), iso2: d.iso2, iso3: d.iso3, hs6: pr.hs6, profile, at, assessed: assessed.get(key), job: jobs.get(key) });
      const entry = { ...pr, availability: c };
      if (c.status === "available") keep.push(entry);
      else (c.status === "withdrawn" ? withdrawn : coverage).push({ iso2: d.iso2, iso3: d.iso3, country: d.name, productId: pr.productId, product: pr.name, commodity: byId.get(pr.productId)?.commodity ?? null, hs6: pr.hs6, evidence: d.evidence.filter((e) => e.productId === pr.productId).map((e) => e.text), ...c });
    }
    if (keep.length) items.push({ ...d, products: keep, evidence: d.evidence.filter((e) => keep.some((k) => k.productId === e.productId)) });
  }
  const out = { ...dest, items, withdrawn, coverageGaps: coverage };
  // Todos os destinos comprovados fora da seleção principal: não é "sem destino"; o motivo de cada um fica listado.
  if (dest.state === "ready" && !items.length) {
    out.state = "none_available";
    out.message = `Os ${withdrawn.length + coverage.length} destino(s) com comércio comprovado estão fora da seleção principal agora: ${withdrawn.length} retirado(s) temporariamente por busca vazia recente, ${coverage.length} sem fonte de empresas coberta. Os motivos e a reavaliação estão abaixo.`;
    out.retry = false;
  }
  return out;
}

// Sentido país → commodities: a mesma relação, agrupada por país. iso2 opcional (detalhe de um país).
export async function byCountry(env, tenant, { products, profile, deps, preparation, iso2 = null, labels = new Map() }) {
  const r = await availabilityFor(env, tenant, { products, profile, deps, preparation });
  const countries = new Map();
  const touch = (iso2x, iso3, name) => countries.get(iso2x) ?? countries.set(iso2x, { iso2: iso2x, iso3, name, commodities: new Map(), withdrawn: [], coverageGaps: [] }).get(iso2x);
  const prodById = new Map(products.map((p) => [p.id, p]));
  for (const d of r.items) {
    const c = touch(d.iso2, d.iso3, d.name);
    for (const pr of d.products) {
      const code = prodById.get(pr.productId)?.commodity;
      const g = c.commodities.get(code) ?? c.commodities.set(code, { code, label: labels.get(code) ?? code, products: [] }).get(code);
      g.products.push({ productId: pr.productId, name: pr.name, hs6: pr.hs6, availability: pr.availability });
    }
  }
  for (const w of r.withdrawn) touch(w.iso2, w.iso3, w.country).withdrawn.push(w);
  for (const w of r.coverageGaps) touch(w.iso2, w.iso3, w.country).coverageGaps.push(w);
  const list = [...countries.values()].map((c) => ({ ...c, commodities: [...c.commodities.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR")) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const pick = iso2 ? list.find((c) => c.iso2 === iso2) ?? null : null;
  return {
    state: r.state === "ready" || r.state === "none_available" ? (list.some((c) => c.commodities.length) ? "ready" : "none_available") : r.state,
    preparing: r.preparing, progressText: r.progressText, message: r.message, reasons: r.reasons, incomplete: r.incomplete, coverage: r.coverage,
    countries: list.filter((c) => c.commodities.length).map((c) => ({ iso2: c.iso2, iso3: c.iso3, name: c.name, commodities: c.commodities.map((g) => ({ code: g.code, label: g.label })) })),
    country: pick,
  };
}

// POST /api/prospect/availability/reassess { productId, iso3 } — pessoa pede reavaliação de um par retirado: a avaliação
// vigente é encerrada (histórico preservado) e o par volta à seleção principal. Nada é pesquisado aqui.
export async function reassessRoute(request, env, actor, rid, body) {
  requireRole(actor, WRITE_ROLES);
  const productId = String(body?.productId ?? "").slice(0, 80), iso3 = String(body?.iso3 ?? "").toUpperCase().slice(0, 3);
  const a = await s(env, "SELECT id,outcome FROM market_assessments WHERE tenant_id=? AND product_id=? AND iso3=? AND superseded_at IS NULL AND origin='real'", actor.tenant_id, productId, iso3).first();
  if (!a) fail(404, "assessment_not_found", "Não há avaliação vigente para esta combinação.");
  if (a.outcome !== "empty") fail(409, "not_withdrawn", "Só uma combinação retirada por busca vazia pode ser reavaliada aqui.");
  const at = now();
  await commit(env, [
    s(env, "UPDATE market_assessments SET superseded_at=?,superseded_reason=?,superseded_by=? WHERE id=? AND superseded_at IS NULL", at, "reavaliação pedida por pessoa", `user:${actor.id}`, a.id),
    auditStatement(env, actor, rid, "market_assessment.reassess_requested", "market_assessment", a.id, { productId, iso3 }),
  ]);
  return { ok: true, assessmentId: a.id, at };
}
