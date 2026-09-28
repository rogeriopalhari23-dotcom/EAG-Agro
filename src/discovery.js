// Radar Internacional — descoberta de candidatos por fontes gratuitas e validação assistida.
// Fluxo: rodar fonte (registra consulta, chamadas e resultado) → candidatos "encontrados" → a pessoa aceita ou descarta →
// empresa na busca com atividade, porte e perfil vindos do cadastro (indícios, com fonte) → evidência própria de compra
// registrada pela pessoa → "potencial compradora" ou "importadora confirmada". MDIC/Comtrade nunca entram aqui.
import { bodyJson, fail, str, oneOf, requireRole, WRITE_ROLES } from "./http.js";
import { statement as s, commit, product, auditStatement, now, company } from "./store.js";
import { ensureForeignCompany, normalizeName } from "./foreign-companies.js";
import { icpStatus } from "./profiles.js";
import { proposalFor, MAP_VERSION } from "./discovery-map.js";
import { osmCandidates, parseOverpass, overpassQuery, frCandidates, noCandidates, gleifLookup, eoriCheck, sourcesFor, OSM_ATTRIBUTION } from "./adapters/discovery.js";

const SOURCE_LABEL = { osm: "OpenStreetMap (Overpass)", fr_registry: "Registro oficial da França (API Recherche d'entreprises)", no_registry: "Registro oficial da Noruega (Brønnøysund)" };
const NACE_RE = /^\d{2}\.\d{2}$/;

async function searchOf(env, actor, id, { open = false } = {}) {
  const x = await s(env, "SELECT * FROM foreign_searches WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!x) fail(404, "search_not_found", "Busca não encontrada.");
  if (open && x.status !== "open") fail(409, "search_closed", "Busca encerrada.");
  const country = await s(env, "SELECT iso3,iso2,name_pt,name_en FROM countries WHERE iso3=?", x.iso3).first();
  return { x, country, hs6: JSON.parse(x.hs6_json), target: JSON.parse(x.target_json) };
}

// GET /api/foreign-searches/:id/discovery — proposta de atividades, fontes do país e candidatos encontrados.
export async function getDiscovery(env, actor, id) {
  const { x, country, hs6 } = await searchOf(env, actor, id);
  const rows = (await s(env, "SELECT * FROM discovery_candidates WHERE search_id=? ORDER BY role, CASE eori_status WHEN 'valid' THEN 0 WHEN 'not_checked' THEN 1 ELSE 2 END, CASE size_band WHEN 'small' THEN 0 WHEN 'medium' THEN 0 WHEN 'medium_plus' THEN 1 WHEN 'micro' THEN 3 ELSE 2 END, name", x.id).all()).results;
  // Possível duplicata: mesmo nome normalizado de outro candidato ou de empresa já cadastrada no país (nunca funde sozinho).
  const known = (await s(env, "SELECT id,legal_name FROM companies WHERE tenant_id=? AND country_code=?", actor.tenant_id, country.iso2).all()).results;
  const byKey = new Map();
  for (const r of rows) (byKey.get(normalizeName(r.name)) || byKey.set(normalizeName(r.name), []).get(normalizeName(r.name))).push(r.id);
  const view = (r) => ({
    id: r.id, source: r.source, sourceLabel: SOURCE_LABEL[r.source], role: r.role, name: r.name, legalNameHint: r.legal_name_hint, city: r.city, website: r.website,
    activity: r.activity_code ? { code: r.activity_code, label: r.activity_label } : null,
    size: r.size_band ? { band: r.size_band, source: r.size_source } : null,
    registry: r.registry_id ? { id: r.registry_id, type: r.registry_type } : null,
    recordUrl: r.record_url, status: r.status, companyId: r.company_id, dismissReason: r.dismiss_reason,
    importSignal: r.eori ? { eori: r.eori, status: r.eori_status, checkedAt: r.eori_checked_at } : null,
    possibleDuplicate: (byKey.get(normalizeName(r.name)) ?? []).length > 1 || (r.status === "new" && known.some((k) => normalizeName(k.legal_name) === normalizeName(r.name))),
  });
  const items = rows.map(view);
  const count = (f) => items.filter(f).length;
  return {
    searchId: x.id, country, proposal: proposalFor(hs6), mapVersion: MAP_VERSION,
    // Consulta pronta para o navegador executar no servidor público do OSM (que recusa a Cloudflare).
    osmQuery: proposalFor(hs6)?.processors.osm.length ? overpassQuery(country.iso2, proposalFor(hs6).processors.osm) : null,
    sources: sourcesFor(country.iso2),
    stage: "empresa encontrada",
    notice: "Candidato encontrado por atividade no cadastro ou no mapa: indício de uso da commodity, não prova de compra nem de importação. EORI ativo (aduana da UE) é sinal próprio de comércio exterior — não prova importação da commodity nem origem Brasil. O dado do país (MDIC/Comtrade) nunca confirma empresa.",
    counts: { withEori: count((c) => c.importSignal?.status === "valid"), found: items.length, new: count((c) => c.status === "new"), accepted: count((c) => c.status === "accepted"), dismissed: count((c) => c.status === "dismissed"), processors: count((c) => c.role === "processor"), traders: count((c) => c.role === "trader") },
    processors: items.filter((c) => c.role === "processor"),
    traders: items.filter((c) => c.role === "trader"),
  };
}

// POST /api/foreign-searches/:id/discover — roda uma fonte gratuita (só quando a pessoa pede).
export async function discover(request, env, actor, rid, id, deps = {}) {
  requireRole(actor, WRITE_ROLES);
  const { x, country, hs6, target } = await searchOf(env, actor, id, { open: true });
  const i = await bodyJson(request);
  const source = oneOf(i.source, ["osm", "fr_registry", "no_registry"], "fonte");
  const role = oneOf(i.role ?? "processor", ["processor", "trader"], "grupo");
  if (!sourcesFor(country.iso2).find((z) => z.key === source)?.available) fail(422, "source_not_available", "Fonte não cobre este país.");
  const proposal = proposalFor(hs6);
  const nace = i.nace ?? proposal?.[role === "trader" ? "traders" : "processors"]?.nace;
  if (!Array.isArray(nace) || !nace.length || nace.length > 12 || !nace.every((c) => NACE_RE.test(String(c))))
    fail(422, "nace_required", "Informe as atividades NACE (formato NN.NN) — não há proposta para esta commodity.");
  if (source === "osm" && role === "trader") fail(422, "osm_traders_unsupported", "O OpenStreetMap não distingue atacadistas; use um registro oficial para traders.");
  const f = deps.fetch ?? fetch;
  let r;
  const started = Date.now();
  try {
    if (source === "osm") {
      if (!proposal?.processors.osm.length) fail(422, "osm_map_missing", "Sem etiquetas do OpenStreetMap para esta commodity.");
      if (i.overpass !== undefined) {
        // Resultado obtido pelo navegador da pessoa com a consulta montada aqui; tratado pelo mesmo código.
        if (!Array.isArray(i.overpass?.elements) || i.overpass.elements.length > 600) fail(422, "invalid_overpass", "Resultado do OpenStreetMap inválido (máximo 600 elementos).");
        r = { query: overpassQuery(country.iso2, proposal.processors.osm), calls: 0, browser: true, ...parseOverpass(i.overpass) };
        const informed = Number(i.overpass.totalElements);
        if (Number.isInteger(informed) && informed > r.candidates.length) Object.assign(r, { truncated: true, total: informed });
      } else r = await osmCandidates({ iso2: country.iso2, filters: proposal.processors.osm }, f);
    } else if (source === "fr_registry") {
      r = await frCandidates({ nace, sizes: role === "processor" ? target.sizes : null }, f);
      // Sinal de importação gratuito: EORI = FR + SIRET da sede, validado no serviço público da Comissão Europeia.
      try {
        const e = await eoriCheck(r.candidates.map((c) => c.eori).filter(Boolean), f);
        r.calls = (r.calls ?? 1) + e.calls;
        r.eoriAt = new Date().toISOString();
        for (const c of r.candidates) c.eoriStatus = c.eori ? e.results.get(c.eori) ?? "not_valid" : "not_checked";
      } catch (err) {
        if (err?.name !== "AdapterError") throw err;
        r.eoriNote = `EORI não conferido: ${err.message}`;
      }
    }
    else r = await noCandidates({ nace }, f);
  } catch (e) {
    if (e?.name !== "AdapterError") throw e;
    // Falha registrada como fonte consultada sem resultado confiável — nunca "nenhuma empresa".
    const sid = crypto.randomUUID();
    await commit(env, [
      s(env, "INSERT INTO foreign_search_sources(id,search_id,source_label,source_kind,query_text,result_count,api_calls,cost_usd,minutes,note,recorded_by) VALUES (?,?,?,'adapter',?,0,1,0,NULL,?,?)", sid, x.id, SOURCE_LABEL[source], `${role}; NACE ${nace.join(",")}`, `FALHA: ${e.message}`, actor.id),
      auditStatement(env, actor, rid, "foreign_search.discovery_failed", "foreign_search", x.id, { source, kind: e.kind }),
    ]);
    fail(503, "source_unavailable", `${e.message} Nada foi descartado; tente de novo mais tarde.`, { retryable: e.retryable });
  }
  const runId = crypto.randomUUID();
  const note = [source === "osm" ? OSM_ATTRIBUTION : null, r.browser ? "consulta executada no navegador (o servidor público do OSM recusa conexões da Cloudflare)" : null, r.truncated ? `lidos ${r.candidates.length} de ${r.total} (primeiras páginas)` : null, r.eoriAt ? `EORI conferido: ${r.candidates.filter((c) => c.eoriStatus === "valid").length} ativo(s)` : null, r.eoriNote ?? null, `mapa ${MAP_VERSION}`].filter(Boolean).join(" · ");
  const stmts = [
    s(
      env,
      "INSERT INTO foreign_search_sources(id,search_id,source_label,source_kind,query_text,result_count,api_calls,cost_usd,minutes,note,recorded_by) VALUES (?,?,?,'adapter',?,?,?,0,?,?,?)",
      runId, x.id, SOURCE_LABEL[source], `${role === "trader" ? "traders" : "consumidoras/processadoras"}; ${r.query}`.slice(0, 500), r.candidates.length, r.browser ? 1 : r.calls ?? 1, Math.max(0, Math.round((Date.now() - started) / 60000)), note, actor.id,
    ),
  ];
  for (const c of r.candidates)
    stmts.push(
      s(
        env,
        `INSERT OR IGNORE INTO discovery_candidates(id,search_id,run_id,source,external_id,role,name,legal_name_hint,city,website,activity_code,activity_label,size_band,size_source,registry_id,registry_type,record_url,eori,eori_status,eori_checked_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        crypto.randomUUID(), x.id, runId, source, c.externalId, role, c.name, c.legalNameHint, c.city, c.website, c.activity?.code ?? null, c.activity?.label ?? null,
        c.size?.band ?? null, c.size?.source ?? null, c.registry?.id ?? null, c.registry?.type ?? null, c.recordUrl,
        c.eori ?? null, c.eoriStatus ?? "not_checked", c.eoriStatus && c.eoriStatus !== "not_checked" ? r.eoriAt : null,
      ),
    );
  stmts.push(auditStatement(env, actor, rid, "foreign_search.discovered", "foreign_search", x.id, { source, role, nace, found: r.candidates.length, total: r.total }));
  for (let k = 0; k < stmts.length; k += 90) await commit(env, stmts.slice(k, k + 90));
  return { runId, source, role, found: r.candidates.length, totalInSource: r.total, truncated: !!r.truncated, discovery: await getDiscovery(env, actor, x.id) };
}

// POST /api/foreign-searches/:id/discovery/accept — candidatos viram empresas da busca (sem confirmar compra).
export async function accept(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const { x } = await searchOf(env, actor, id, { open: true });
  const i = await bodyJson(request);
  if (!Array.isArray(i.ids) || !i.ids.length || i.ids.length > 100) fail(422, "invalid_ids", "Selecione de 1 a 100 candidatos.");
  const p = await product(env, actor.tenant_id, x.product_id);
  const results = [];
  for (const cid of i.ids.map(String)) {
    const c = await s(env, "SELECT * FROM discovery_candidates WHERE id=? AND search_id=?", cid, x.id).first();
    if (!c) {
      results.push({ id: cid, ok: false, reason: "Candidato não encontrado nesta busca." });
      continue;
    }
    if (c.status !== "new") {
      results.push({ id: cid, ok: c.status === "accepted", companyId: c.company_id, reason: c.status === "accepted" ? "Já aceito." : "Descartado." });
      continue;
    }
    let companyId;
    try {
      const created = await ensureForeignCompany(env, actor, rid, {
        campaignId: x.campaign_id, legalName: c.legal_name_hint || c.name, tradeName: c.legal_name_hint && c.legal_name_hint !== c.name ? c.name : undefined,
        registrationId: c.registry_id ?? undefined, registrationIdType: c.registry_type ?? undefined,
        sourceLabel: SOURCE_LABEL[c.source], sourceUrl: c.record_url, website: c.website ?? undefined,
        activityText: c.activity_label ? `${c.activity_label}${c.city ? ` · ${c.city}` : ""}` : undefined, activitySource: c.activity_label ? `${SOURCE_LABEL[c.source]} (${c.record_url})` : undefined,
        confirmDistinct: i.confirmDistinct === true,
      });
      companyId = created.id;
    } catch (e) {
      // Nome parecido com empresa já cadastrada: a pessoa confere; nada é fundido automaticamente (P13).
      results.push({ id: cid, ok: false, reason: e.message, code: e.code ?? null });
      continue;
    }
    const at = now();
    const co = await s(env, "SELECT size_class FROM companies WHERE id=?", companyId).first();
    const stmts = [
      s(env, "UPDATE discovery_candidates SET status='accepted',company_id=?,decided_by=?,decided_at=? WHERE id=? AND status='new'", companyId, actor.id, at, c.id),
      s(env, "INSERT OR IGNORE INTO foreign_search_candidates(search_id,company_id,source_id,source_label,source_url,added_by) VALUES (?,?,?,?,?,?)", x.id, companyId, c.run_id, SOURCE_LABEL[c.source], c.record_url, actor.id),
    ];
    // Porte oficial do registro, com a fonte, quando a empresa ainda não tem porte.
    if (c.size_band && !co?.size_class) stmts.push(s(env, "UPDATE companies SET size_class=?,size_source=?,size_checked_at=?,updated_at=? WHERE id=? AND size_class IS NULL", c.size_band, c.size_source, at, at, companyId));
    // Perfil pela atividade (indício): processadora → possível consumidora final; atacado → trader (R14.2 permite só "possível").
    const profile = await s(env, "SELECT id FROM buyer_profiles WHERE tenant_id=? AND company_id=? AND unit_key='' AND product_id=?", actor.tenant_id, companyId, p.id).first();
    if (!profile) {
      const cls = c.role === "trader" ? "trader_distributor" : "possible_final_consumer";
      const band = co?.size_class ?? c.size_band ?? null;
      stmts.push(
        s(
          env,
          "INSERT INTO buyer_profiles(id,tenant_id,company_id,unit_key,product_id,profile_class,basis,icp_status,is_giant,updated_by) VALUES (?,?,?,'',?,?,?,?,0,?)",
          crypto.randomUUID(), actor.tenant_id, companyId, p.id, cls,
          `Atividade no cadastro/mapa: ${c.activity_label ?? c.activity_code} — ${SOURCE_LABEL[c.source]} (${c.record_url}). Indício, não prova de compra (P1).`,
          icpStatus({ profileClass: cls, sizeBand: band }), actor.id,
        ),
      );
    }
    if (c.eori_status === "valid")
      stmts.push(
        s(
          env,
          "INSERT INTO evidence(id,tenant_id,company_id,category,evidence_type,reference,source_url,fact_date,consulted_at,validation_status,validated_by,validated_at,metadata_json,created_by) VALUES (?,?,?,'commercial_signal','customs_registration',?,?,NULL,?,'valid',?,?,?,?)",
          crypto.randomUUID(), actor.tenant_id, companyId,
          `EORI ${c.eori} ativo na União Europeia (validação EOS da Comissão Europeia): empresa registrada na aduana para importar/exportar. Não prova importação da commodity nem origem Brasil.`,
          "https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp", c.eori_checked_at, actor.id, at, JSON.stringify({ supports: ["imports"] }), actor.id,
        ),
      );
    stmts.push(auditStatement(env, actor, rid, "foreign_search.candidate_accepted", "foreign_search", x.id, { candidateId: c.id, companyId, source: c.source, eori: c.eori_status }));
    await commit(env, stmts);
    results.push({ id: cid, ok: true, companyId });
  }
  return { results, accepted: results.filter((r) => r.ok).length };
}

// POST /api/foreign-searches/:id/discovery/dismiss
export async function dismiss(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const { x } = await searchOf(env, actor, id, { open: true });
  const i = await bodyJson(request);
  if (!Array.isArray(i.ids) || !i.ids.length || i.ids.length > 200) fail(422, "invalid_ids", "Selecione de 1 a 200 candidatos.");
  const reason = str(i.reason, "motivo", 300);
  const at = now();
  const stmts = i.ids.map((cid) => s(env, "UPDATE discovery_candidates SET status='dismissed',dismiss_reason=?,decided_by=?,decided_at=? WHERE id=? AND search_id=? AND status='new'", reason, actor.id, at, String(cid), x.id));
  stmts.push(auditStatement(env, actor, rid, "foreign_search.candidates_dismissed", "foreign_search", x.id, { count: i.ids.length, reason }));
  await commit(env, stmts);
  return { dismissed: i.ids.length };
}

// GET /api/companies/:id/gleif — identidade jurídica no GLEIF (nome legal, registro, LEI). Não é evidência de compra.
export async function companyGleif(env, actor, companyId, deps = {}) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, companyId);
  if (c.country_code === "BR") fail(422, "national_company", "Use o CNPJ para empresas brasileiras.");
  try {
    return { matches: await gleifLookup({ name: c.legal_name, iso2: c.country_code }, deps.fetch ?? fetch), note: "Só empresas com LEI aparecem; pequenas empresas costumam não ter. Ausência aqui não indica nada." };
  } catch (e) {
    if (e?.name !== "AdapterError") throw e;
    fail(503, "source_unavailable", e.message);
  }
}

// Validação assistida: links montados (abertos pela pessoa) para achar evidência própria de compra/importação.
export function validationLinks(card, commodityTerm, country) {
  const g = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const links = [];
  let domain = null;
  try {
    domain = card.website ? new URL(card.website).hostname.replace(/^www\./, "") : null;
  } catch {
    domain = null;
  }
  if (domain) links.push({ label: "Site da empresa: menções a Brasil e à commodity", url: g(`site:${domain} (Brasil OR Brazil OR Brasilien OR Brésil OR Brasile) ${commodityTerm}`) });
  links.push({ label: "Notícias e documentos: empresa + commodity + Brasil", url: g(`"${card.name}" ${commodityTerm} Brazil`) });
  if (country.iso2 === "US") links.push({ label: "ImportYeti (registros de embarque dos EUA, gratuito)", url: `https://www.importyeti.com/search?q=${encodeURIComponent(card.name)}` });
  links.push({ label: "LinkedIn: compras da empresa (sem login automatizado)", url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${card.name} purchasing`)}` });
  return links;
}
