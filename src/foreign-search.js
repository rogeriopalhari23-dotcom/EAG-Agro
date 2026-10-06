// Radar Internacional — busca de empresas compradoras no país, registrada por campanha
// (R12.7–R12.8, R12.10, R12.14, R13.2–R13.6, R14.1–R14.8, P1, P11, P16 com a exceção de 2026-09-27, P18).
//
// Depois de escolher país e commodity e autorizar, o trabalho se concentra em pequenas e médias empresas
// importadoras: consumidoras finais, fábricas e processadoras primeiro; traders à parte, com prioridade secundária.
// "Importadora confirmada" só com evidência empresarial validada da própria empresa; indício → "potencial
// compradora a validar". Dado agregado do país nunca preenche condição de empresa (R12.10).
// O Compass não raspa sites nem consulta base paga (R13.7): o roteiro traz links montados, não executados, e cada
// fonte consultada por pessoa ou adaptador é registrada com resultado, esforço e custo (cobertura e rendimento).
import { bodyJson, fail, str, oneOf, url, requireRole, WRITE_ROLES, APPROVER_ROLES } from "./http.js";
import { statement as s, commit, product, auditStatement, now } from "./store.js";
import { decryptPii } from "./crypto.js";
import { ensureForeignCompany } from "./foreign-companies.js";
import { canHaveFicha, contactTargetFlag } from "./profiles.js";
import { validationLinks } from "./discovery.js";

const SIZE_LABEL = { micro: "Micro", small: "Pequena", medium: "Média", medium_plus: "Média-mais", giant: "Grande / grupo" };
// Referência de porte (aprovada em 2026-09-30): Recomendação da Comissão Europeia 2003/361/CE; fora da UE é referência
// operacional europeia, não enquadramento legal do país.
const EU_ISO2 = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]);
const sizeReference = (iso2) => (EU_ISO2.has(iso2) ? "Recomendação UE 2003/361/CE" : "referência operacional europeia (Recomendação UE 2003/361/CE), não enquadramento legal local");
// Pequenas e médias primeiro (pedido de Rogério em 2026-09-27); média-mais depois; porte desconhecido, micro e gigante no fim.
const SIZE_RANK = { small: 0, medium: 0, medium_plus: 1 };
const PROFILE_LABEL = {
  final_consumer_confirmed: "consumidora final confirmada",
  possible_final_consumer: "possível consumidora final (fábrica/processadora)",
  trader_distributor: "trader/distribuidor",
  unconfirmed: "perfil não confirmado",
};
// Porte ordena, não exclui (2026-09-30): micro e grande/grupo seguem candidatas, com prioridade menor.
const ICP_LABEL = { in_icp: "prioridade — pequena/média", out_small: "micro — candidata", out_giant: "grande ou grupo — candidata (avaliar unidade, uso, autonomia e acesso)", out_trader: "trader — classificação à parte", pending_size: "porte a confirmar (pesquisável)" };
// Três níveis (mais o intermediário "compradora confirmada"): só evidência da própria empresa sobe de nível.
// Estados distintos (pedido de Rogério em 2026-09-28): empresa encontrada, potencial compradora, importadora confirmada
// e consumidora final confirmada. Só evidência da própria empresa, com fonte e data, sobe de estado.
const BUYER = {
  confirmed_importer: { rank: 0, label: "importadora confirmada" },
  confirmed_buyer: { rank: 1, label: "compradora confirmada (importação não comprovada)" },
  potential: { rank: 2, label: "potencial compradora (sinal próprio, a validar)" },
  found: { rank: 3, label: "empresa encontrada — importação não verificada" },
};
const PRIORITY_LABEL = { primary: "prioridade principal", secondary: "prioridade secundária" };
const SOURCE_KINDS = ["web_research", "public_directory", "official_registry", "company_website", "trade_fair", "paid_database", "adapter"];

async function campaignContext(env, tenant, campaignId) {
  const campaign = await s(env, "SELECT * FROM campaigns WHERE tenant_id=? AND id=?", tenant, campaignId).first();
  if (!campaign) fail(404, "campaign_not_found", "Campanha não encontrada.");
  if (campaign.market !== "international") fail(422, "campaign_not_international", "Use uma campanha internacional.");
  // Busca só depois da seleção registrada na lista do país (R12.8, R12.14).
  if (!campaign.selection_id) fail(409, "selection_required", "Selecione a commodity na lista do país antes de buscar empresas (R12.8).");
  const sel = await s(env, "SELECT items_json,analysis_id FROM commodity_selections WHERE tenant_id=? AND id=?", tenant, campaign.selection_id).first();
  const item = sel && JSON.parse(sel.items_json).find((x) => x.campaignId === campaign.id);
  if (!item) fail(409, "selection_required", "Campanha sem item de seleção correspondente.");
  const country = await s(env, "SELECT iso3,iso2,name_pt,name_en FROM countries WHERE iso2=?", campaign.country_code).first();
  if (!country) fail(422, "country_not_found", "País da campanha fora do cadastro.");
  return { campaign, item, analysisId: sel.analysis_id, country };
}

// Roteiro de pesquisa: links montados, nunca executados pelo Compass (sem raspagem, sem base paga — R13.7).
async function researchPlan(env, ctx, p) {
  const ptr = await s(env, "SELECT r2_key FROM trade_list_current WHERE iso3=? AND source='comtrade'", ctx.country.iso3).first();
  let names = {};
  if (ptr && env.FILES) {
    const o = await env.FILES.get(ptr.r2_key);
    if (o) names = JSON.parse(await o.text()).names ?? {};
  }
  const hsNames = ctx.item.hs6.map((h) => names[h]).filter(Boolean);
  const term = (hsNames[0] || p.commodity).split(/[;,(]/)[0].trim();
  const icp = await s(env, "SELECT user_sectors_json FROM campaign_icp WHERE campaign_id=?", ctx.campaign.id).first();
  const sectors = icp ? JSON.parse(icp.user_sectors_json) : [];
  const g = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const c = ctx.country.name_en;
  const links = [
    // Importadores primeiro: fontes que apontam empresas que importam (consulta manual; nada é raspado).
    ...(ctx.country.iso2 === "US" ? [{ group: "Fontes de importadores (consulta manual)", label: "ImportYeti — registros de embarque dos EUA (gratuito)", url: `https://www.importyeti.com/search?q=${encodeURIComponent(term)}` }] : []),
    { group: "Fontes de importadores (consulta manual)", label: `Importadores de ${term} em ${c}`, url: g(`"${term}" importer ${c} -supplier`) },
    { group: "Fontes de importadores (consulta manual)", label: "Associação de importadores do setor (lista de membros)", url: g(`${term} importers association members ${c}`) },
    { group: "Fontes de importadores (consulta manual)", label: `Compradores por SH ${ctx.item.hs6[0]} (listas públicas de bases de comércio)`, url: g(`${c} buyers importers "${ctx.item.hs6[0]}"`) },
    ...["manufacturer", "processor", "factory"].map((w) => ({ group: "Consumidoras, fábricas e processadoras", label: `${term} — ${w} (${c})`, url: g(`"${term}" ${w} ${c}`) })),
    ...sectors.slice(0, 5).map((x) => ({ group: "Setores usuários do ICP da campanha", label: `${x} (${c})`, url: g(`${x} ${c} "${term}"`) })),
    { group: "Diretórios públicos (consulta manual)", label: "Europages", url: g(`site:europages.com "${term}" ${c}`) },
    { group: "Diretórios públicos (consulta manual)", label: "Kompass", url: g(`site:kompass.com "${term}" ${c}`) },
    { group: "Diretórios públicos (consulta manual)", label: "Empresas no LinkedIn (sem login automatizado)", url: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(`${term} ${c}`)}` },
    { group: "Traders (prioridade secundária)", label: `${term} importer / distributor (${c})`, url: g(`"${term}" importer OR distributor ${c}`) },
  ];
  return {
    term,
    note: "Links montados, não executados: o Compass não raspa sites nem consulta bases pagas. Registros de importação por empresa (ex.: bases de conhecimento de embarque) são fonte paga e exigem decisão registrada de custo e cobertura (R13.7).",
    links,
  };
}

// POST /api/campaigns/:id/foreign-search — autoriza a busca (Gestor Comercial ou Administrador).
export async function authorizeSearch(request, env, actor, rid, campaignId) {
  requireRole(actor, APPROVER_ROLES);
  const i = await bodyJson(request);
  if (i.confirm !== true) fail(422, "confirmation_required", "Confirme a autorização da busca de empresas.");
  const ctx = await campaignContext(env, actor.tenant_id, campaignId);
  const open = await s(env, "SELECT id FROM foreign_searches WHERE campaign_id=? AND status='open'", ctx.campaign.id).first();
  if (open) return { ...(await getSearch(env, actor, open.id)), reused: true };
  const sizes = i.targetSizes === undefined ? ["small", "medium"] : i.targetSizes;
  if (!Array.isArray(sizes) || !sizes.length) fail(422, "invalid_target_sizes", "Informe o porte-alvo.");
  const target = {
    sizes: [...new Set(sizes.map((x) => oneOf(x, ["small", "medium", "medium_plus"], "porte-alvo")))],
    profilePriority: ["final_consumer", "factory", "processor"],
    traders: "secondary",
  };
  const id = crypto.randomUUID();
  const at = now();
  try {
    await commit(env, [
      s(
        env,
        "INSERT INTO foreign_searches(id,tenant_id,campaign_id,selection_id,analysis_id,iso3,product_id,hs6_json,target_json,note,authorized_by,authorized_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        id, actor.tenant_id, ctx.campaign.id, ctx.campaign.selection_id, ctx.analysisId, ctx.country.iso3, ctx.campaign.product_id, JSON.stringify(ctx.item.hs6), JSON.stringify(target),
        str(i.note, "observação", 500, true), actor.id, at,
      ),
      auditStatement(env, actor, rid, "foreign_search.authorized", "foreign_search", id, { campaignId: ctx.campaign.id, iso3: ctx.country.iso3, hs6: ctx.item.hs6, target }),
    ]);
  } catch (e) {
    // Duplo clique: a outra autorização venceu; devolve a busca aberta.
    if (!/UNIQUE/.test(String(e?.message))) throw e;
    const again = await s(env, "SELECT id FROM foreign_searches WHERE campaign_id=? AND status='open'", ctx.campaign.id).first();
    return { ...(await getSearch(env, actor, again.id)), reused: true };
  }
  return { ...(await getSearch(env, actor, id)), reused: false };
}

async function openSearch(env, actor, id) {
  const x = await s(env, "SELECT * FROM foreign_searches WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!x) fail(404, "search_not_found", "Busca não encontrada.");
  if (x.status !== "open") fail(409, "search_closed", "Busca encerrada.");
  return x;
}

// POST /api/foreign-searches/:id/sources — fonte consultada (mesmo sem resultado), com esforço e custo.
export async function recordSource(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const x = await openSearch(env, actor, id);
  const i = await bodyJson(request);
  const kind = oneOf(i.sourceKind, SOURCE_KINDS, "tipo de fonte");
  if (kind === "paid_database" && !i.decisionRef) fail(409, "paid_source_needs_decision", "Base paga só com decisão registrada de custo e cobertura (R13.7): informe a referência da decisão.");
  const num = (v, name, max) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) fail(422, "invalid_number", `${name} inválido.`);
    return n;
  };
  const sid = crypto.randomUUID();
  const row = {
    label: str(i.sourceLabel, "fonte", 200), query: str(i.queryText, "consulta", 500, true), results: Math.trunc(num(i.resultCount, "resultados", 10000)),
    calls: Math.trunc(num(i.apiCalls, "chamadas", 100000)), cost: num(i.costUsd, "custo", 100000), minutes: i.minutes === undefined ? null : Math.trunc(num(i.minutes, "minutos", 10000)),
    note: [str(i.note, "observação", 500, true), i.decisionRef ? `Decisão: ${str(i.decisionRef, "decisão", 200)}` : null].filter(Boolean).join(" · ") || null,
  };
  await commit(env, [
    s(env, "INSERT INTO foreign_search_sources(id,search_id,source_label,source_kind,query_text,result_count,api_calls,cost_usd,minutes,note,recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)", sid, x.id, row.label, kind, row.query, row.results, row.calls, row.cost, row.minutes, row.note, actor.id),
    auditStatement(env, actor, rid, "foreign_search.source_recorded", "foreign_search", x.id, { sourceId: sid, kind, results: row.results, calls: row.calls, costUsd: row.cost }),
  ]);
  return { id: sid };
}

// POST /api/foreign-searches/:id/candidates — empresa encontrada (nova ou já cadastrada no país).
export async function addCandidate(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const x = await openSearch(env, actor, id);
  const i = await bodyJson(request);
  let sourceId = null;
  if (i.sourceId) {
    const src = await s(env, "SELECT id FROM foreign_search_sources WHERE id=? AND search_id=?", str(i.sourceId, "fonte", 80), x.id).first();
    if (!src) fail(422, "source_not_in_search", "Fonte não registrada nesta busca.");
    sourceId = src.id;
  }
  const sourceLabel = str(i.sourceLabel, "fonte", 1000);
  const sourceUrl = url(i.sourceUrl);
  let companyId;
  if (i.companyId) {
    const country = await s(env, "SELECT iso2 FROM countries WHERE iso3=?", x.iso3).first();
    const c = await s(env, "SELECT id,country_code FROM companies WHERE tenant_id=? AND id=?", actor.tenant_id, str(i.companyId, "empresa", 80)).first();
    if (!c) fail(404, "company_not_found", "Empresa não encontrada.");
    if (c.country_code !== country.iso2) fail(422, "company_other_country", "Empresa de outro país.");
    companyId = c.id;
    await commit(env, [s(env, "INSERT OR IGNORE INTO company_conditions(tenant_id,company_id,product_id,condition,status,updated_by) SELECT ?,?,?,c,'pending',? FROM (SELECT 'imports_from_brazil' c UNION SELECT 'buys_commodity' UNION SELECT 'consumes_as_input')", actor.tenant_id, companyId, x.product_id, actor.id)]);
  } else {
    // Mesmo registro = mesma empresa; nome parecido vira pendência para a pessoa decidir (P13, R13.6).
    companyId = (await ensureForeignCompany(env, actor, rid, { ...i, campaignId: (await s(env, "SELECT campaign_id FROM foreign_searches WHERE id=?", x.id).first()).campaign_id, sourceLabel, sourceUrl })).id;
  }
  const added = await s(env, "INSERT OR IGNORE INTO foreign_search_candidates(search_id,company_id,source_id,source_label,source_url,added_by) VALUES (?,?,?,?,?,?)", x.id, companyId, sourceId, sourceLabel, sourceUrl, actor.id).run();
  if (added.meta.changes) await commit(env, [auditStatement(env, actor, rid, "foreign_search.candidate_added", "foreign_search", x.id, { companyId, sourceId })]);
  return { companyId, added: !!added.meta.changes };
}

// POST /api/foreign-searches/:id/close
export async function closeSearch(request, env, actor, rid, id) {
  requireRole(actor, APPROVER_ROLES);
  const x = await openSearch(env, actor, id);
  const i = await bodyJson(request);
  const note = str(i.note, "observação de encerramento", 500);
  await commit(env, [
    s(env, "UPDATE foreign_searches SET status='closed',closed_by=?,closed_at=?,close_note=? WHERE id=? AND status='open'", actor.id, now(), note, x.id),
    auditStatement(env, actor, rid, "foreign_search.closed", "foreign_search", x.id, { note }),
  ]);
  return getSearch(env, actor, x.id);
}

const evidenceView = (e, condition) => ({
  id: e.id, condition, category: e.category, type: e.evidence_type, reference: e.reference, sourceUrl: e.source_url,
  factDate: e.fact_date, consultedAt: e.consulted_at, validation: e.validation_status,
});

async function companyCard(env, actor, x, row, productId) {
  const conditions = (await s(env, "SELECT condition,status,evidence_id FROM company_conditions WHERE tenant_id=? AND company_id=? AND product_id=?", actor.tenant_id, row.id, productId).all()).results;
  const evidences = (await s(env, "SELECT * FROM evidence WHERE tenant_id=? AND company_id=? AND category<>'market' ORDER BY consulted_at DESC", actor.tenant_id, row.id).all()).results;
  const supportsOf = (e) => {
    try {
      return JSON.parse(e.metadata_json || "{}").supports ?? [];
    } catch {
      return [];
    }
  };
  const confirmed = (c) => conditions.find((k) => k.condition === c && k.status === "confirmed");
  const proof = [];
  for (const k of conditions.filter((k) => k.status === "confirmed" && k.evidence_id)) {
    const e = evidences.find((v) => v.id === k.evidence_id);
    if (e) proof.push(evidenceView(e, k.condition));
  }
  // Documento da empresa conferido que prova importação (qualquer origem): confirma importação, não a origem Brasil.
  for (const e of evidences.filter((v) => v.category === "business" && v.validation_status === "valid" && supportsOf(v).includes("imports")))
    if (!proof.some((p) => p.id === e.id)) proof.push(evidenceView(e, "imports"));
  // Indícios: evidências da empresa que ainda não confirmam (indício comercial ou documento não validado).
  const used = new Set(proof.map((p) => p.id));
  const indications = evidences.filter((e) => !used.has(e.id) && (e.category === "commercial_signal" || e.validation_status !== "valid" || supportsOf(e).length)).map((e) => evidenceView(e, supportsOf(e)[0] ?? null));
  const brazilConfirmed = !!confirmed("imports_from_brazil");
  const importConfirmed = brazilConfirmed || proof.some((p) => p.condition === "imports");
  const buyer = importConfirmed ? "confirmed_importer" : confirmed("buys_commodity") ? "confirmed_buyer" : indications.length ? "potential" : "found";
  const profile = await s(env, "SELECT * FROM buyer_profiles WHERE tenant_id=? AND company_id=? AND unit_key='' AND product_id=?", actor.tenant_id, row.id, productId).first();
  const contactsRaw = (await s(env, "SELECT * FROM contacts WHERE tenant_id=? AND company_id=? ORDER BY created_at", actor.tenant_id, row.id).all()).results;
  const contacts = [];
  for (const c of contactsRaw) {
    const [name, title] = await Promise.all([decryptPii(c.full_name_encrypted, env), decryptPii(c.job_title_encrypted, env)]);
    contacts.push({
      id: c.id, name, jobTitle: title, role: c.prospect_role, source: c.source_label, sourceUrl: c.source_url,
      verified: !!(c.source_label || c.source_url), emailValidation: c.email_validation, timezone: c.timezone, targetFlag: contactTargetFlag(title, c.relationship_note), kind: c.contact_kind,
    });
  }
  const deciders = contacts.filter((c) => ["decision_maker", "provisional_decision_maker", "influencer"].includes(c.role) && c.verified);
  const ficha = canHaveFicha(profile);
  const pending = [];
  if (!row.size_class) pending.push("Porte não informado (registrar faixa com fonte).");
  else if (!row.size_source) pending.push("Porte sem fonte.");
  if (!row.activity_text) pending.push("Atividade da empresa não registrada.");
  if (!row.website) pending.push("Site não registrado.");
  if (buyer === "potential") pending.push("Validar o indício de compra com evidência da empresa (documento, registro aduaneiro).");
  if (buyer === "found") pending.push("Nenhuma evidência própria de compra ou importação registrada (use a validação assistida).");
  if (buyer !== "confirmed_importer") pending.push("Origem Brasil não comprovada para esta empresa (o dado do país não serve de prova).");
  if (!profile) pending.push("Perfil comprador desta commodity não registrado.");
  // Canal geral publicado (com fonte) leva à ficha de identificação do responsável; não substitui o decisor.
  const channels = contacts.filter((c) => c.kind === "company_channel" && c.verified);
  if (!deciders.length && channels.length)
    pending.push(channels.some((c) => c.emailValidation === "valid") ? "Responsável por compras não identificado: canal geral com e-mail validado (ficha de identificação)." : "Responsável por compras não identificado: canal geral com e-mail ainda não validado.");
  else if (!deciders.length) pending.push("Nenhum decisor ou comprador com fonte registrada.");
  else if (!deciders.some((c) => c.emailValidation === "valid")) pending.push("E-mail do decisor não validado.");
  if (deciders.length && !deciders.some((c) => c.timezone)) pending.push("Fuso do destinatário não confirmado.");
  const fichaRow = x.campaign_id
    ? await s(env, "SELECT id,status FROM fichas WHERE tenant_id=? AND company_id=? AND campaign_id=? AND status IN ('draft','in_approval','approved') ORDER BY updated_at DESC LIMIT 1", actor.tenant_id, row.id, x.campaign_id).first()
    : null;
  if (fichaRow?.status === "in_approval") pending.unshift("Ficha aguardando sua aprovação: os bloqueios estão listados na própria ficha.");
  else if (fichaRow?.status === "approved") pending.unshift("Ficha aprovada: acompanhe os envios e respostas em Abordagem.");
  else if (fichaRow?.status === "draft") pending.unshift("Ficha em rascunho: conclua e envie para aprovação.");
  return {
    id: row.id, name: row.legal_name, tradeName: row.trade_name,
    openFicha: fichaRow ? { id: fichaRow.id, status: fichaRow.status } : null,
    size: row.size_class ? { class: row.size_class, label: SIZE_LABEL[row.size_class], basis: row.size_basis === "proven" ? "comprovado" : "estimado", reference: sizeReference(row.country_code), source: row.size_source, checkedAt: row.size_checked_at } : null,
    activity: row.activity_text ? { text: row.activity_text, source: row.activity_source } : null,
    website: row.website,
    buyerStatus: buyer,
    buyerStatusLabel: buyer === "confirmed_importer" ? `importadora confirmada (${brazilConfirmed ? "origem Brasil comprovada" : "origem Brasil não comprovada"})` : BUYER[buyer].label,
    states: {
      found: true,
      potentialBuyer: buyer !== "found",
      importerConfirmed: importConfirmed,
      brazilOriginConfirmed: brazilConfirmed,
      finalConsumerConfirmed: profile?.profile_class === "final_consumer_confirmed",
    },
    importEvidence: proof, indications,
    profile: profile ? { class: profile.profile_class, label: PROFILE_LABEL[profile.profile_class], icpStatus: profile.icp_status, icpLabel: ICP_LABEL[profile.icp_status] } : null,
    contacts, ficha: { ok: ficha.ok, reason: ficha.reason ?? ficha.note ?? null, needsIndividualApproval: true },
    pending,
    ownEvidence: proof.length + indications.length,
    validationLinks: validationLinks({ name: row.legal_name, website: row.website }, x.commodityTerm ?? "", x.countryRef ?? { iso2: "" }),
    foundBy: { source: row.cand_source, url: row.cand_url, at: row.cand_at },
  };
}

// Candidatas são importadoras: sem sinal próprio de importação/compra a empresa fica no grupo "importação não verificada".
const groupOf = (card) =>
  card.buyerStatus === "found" ? "unverified" : card.profile?.class === "trader_distributor" ? "traders" : ["final_consumer_confirmed", "possible_final_consumer"].includes(card.profile?.class) ? "consumers" : "toConfirm";
// Ordem (2026-09-30): prioridade registrada por Rogério → evidência de compra → decisor/comprador com fonte → porte só como
// desempate (pequena/média primeiro). Vínculo com grupo não reduz a prioridade automaticamente.
const hasBuyerContact = (c) => (c.contacts ?? []).some((k) => k.verified && ["decision_maker", "provisional_decision_maker", "influencer"].includes(k.role));
const order = (a, b) =>
  (a.triage?.priority === "secondary" ? 1 : 0) - (b.triage?.priority === "secondary" ? 1 : 0) ||
  BUYER[a.buyerStatus].rank - BUYER[b.buyerStatus].rank ||
  (hasBuyerContact(a) ? 0 : 1) - (hasBuyerContact(b) ? 0 : 1) ||
  (SIZE_RANK[a.size?.class] ?? 2) - (SIZE_RANK[b.size?.class] ?? 2) ||
  a.name.localeCompare(b.name);

// GET /api/foreign-searches/:id — resultado por empresa, cobertura, custo e rendimento.
export async function getSearch(env, actor, id) {
  const x = await s(env, "SELECT * FROM foreign_searches WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!x) fail(404, "search_not_found", "Busca não encontrada.");
  const p = await product(env, actor.tenant_id, x.product_id);
  const country = await s(env, "SELECT iso3,iso2,name_pt,name_en FROM countries WHERE iso3=?", x.iso3).first();
  const campaign = await s(env, "SELECT * FROM campaigns WHERE id=?", x.campaign_id).first();
  const sel = await s(env, "SELECT items_json FROM commodity_selections WHERE id=?", x.selection_id).first();
  const item = { hs6: JSON.parse(x.hs6_json), label: sel ? JSON.parse(sel.items_json).find((i) => i.campaignId === x.campaign_id)?.label ?? null : null };
  const sources = (await s(env, "SELECT * FROM foreign_search_sources WHERE search_id=? ORDER BY recorded_at", x.id).all()).results;
  const rows = (
    await s(
      env,
      `SELECT c.*,fc.source_label cand_source,fc.source_url cand_url,fc.added_at cand_at,fc.priority cand_priority,fc.priority_reason cand_priority_reason,fc.status cand_status,fc.dismiss_reason cand_dismiss_reason,fc.decided_by cand_decided_by,fc.decided_at cand_decided_at FROM foreign_search_candidates fc JOIN companies c ON c.id=fc.company_id
       WHERE fc.search_id=? AND c.tenant_id=? ORDER BY fc.added_at`,
      x.id, actor.tenant_id,
    ).all()
  ).results;
  const plan = await researchPlan(env, { campaign, item, country }, p);
  const checks = (await s(env, "SELECT * FROM search_candidate_checks WHERE search_id=? ORDER BY created_at", x.id).all()).results;
  const all = [];
  for (const r of rows) {
    const card = await companyCard(env, actor, { ...x, commodityTerm: plan.term, countryRef: country }, r, x.product_id);
    card.triage = { priority: r.cand_priority, priorityLabel: PRIORITY_LABEL[r.cand_priority], priorityReason: r.cand_priority_reason, status: r.cand_status, dismissReason: r.cand_dismiss_reason, decidedBy: r.cand_decided_by, decidedAt: r.cand_decided_at };
    card.checks = checks.filter((k) => k.company_id === r.id).map((k) => ({ id: k.id, topic: k.topic, note: k.note, sourceUrl: k.source_url, status: k.status, resolution: k.resolution, createdAt: k.created_at, resolvedAt: k.resolved_at }));
    if (card.checks.some((k) => k.status === "open")) card.pending.unshift(...card.checks.filter((k) => k.status === "open").map((k) => `A verificar: ${k.topic}.`));
    all.push(card);
  }
  // Descartada nesta busca (empresa/produto): sai dos grupos e das métricas, mas fica visível com motivo e data.
  const dismissed = all.filter((c) => c.triage.status === "dismissed");
  const cards = all.filter((c) => c.triage.status !== "dismissed");
  const disc = (await s(env, "SELECT status,role,COUNT(*) n FROM discovery_candidates WHERE search_id=? GROUP BY status,role", x.id).all()).results;
  const dsum = (f) => disc.filter(f).reduce((a, r) => a + r.n, 0);
  const groups = { consumers: [], toConfirm: [], traders: [], unverified: [] };
  for (const c of cards) groups[groupOf(c)].push(c);
  for (const g of Object.values(groups)) g.sort(order);
  const target = JSON.parse(x.target_json);
  const inTarget = (c) => target.sizes.includes(c.size?.class);
  const lastActivity = [x.authorized_at, ...sources.map((s) => s.recorded_at), ...rows.map((r) => r.cand_at)].sort().at(-1);
  const count = (f) => cards.filter(f).length;
  const valid = count((c) => c.buyerStatus !== "found");
  const totalMs = sources.reduce((a, s) => a + (s.duration_ms ?? 0) + (s.minutes ?? 0) * 60000, 0);
  const totalCost = sources.reduce((a, s) => a + s.cost_usd, 0);
  const metrics = {
    coverage: {
      sourcesConsulted: sources.length,
      sourcesWithResults: sources.filter((s) => s.result_count > 0).length,
      byKind: Object.fromEntries(SOURCE_KINDS.map((k) => [k, sources.filter((s) => s.source_kind === k).length]).filter(([, n]) => n)),
      automaticSources: sources.filter((s) => s.source_kind === "adapter").length,
      note: "Cobertura = fontes consultadas nesta busca (gratuitas: OpenStreetMap e registros oficiais onde existem; pesquisa manual registrada). Nunca é integral: o OSM só tem o que foi mapeado e registros oficiais abertos existem em poucos países.",
    },
    cost: {
      apiCalls: sources.reduce((a, s) => a + s.api_calls, 0),
      costUsd: Math.round(sources.reduce((a, s) => a + s.cost_usd, 0) * 100) / 100,
      minutes: sources.reduce((a, s) => a + (s.minutes ?? 0), 0),
      elapsedHours: Math.round(((Date.parse(lastActivity) - Date.parse(x.authorized_at)) / 3600000) * 10) / 10,
      // Por candidata válida = empresa na busca com evidência ou sinal próprio (potencial compradora ou melhor).
      validCandidates: valid,
      costPerValidUsd: valid ? Math.round((totalCost / valid) * 100) / 100 : null,
      secondsPerValid: valid ? Math.round(totalMs / 1000 / valid) : null,
    },
    yield: {
      found: dsum(() => true),
      foundPending: dsum((r) => r.status === "new"),
      foundDismissed: dsum((r) => r.status === "dismissed"),
      candidates: cards.length,
      dismissedInSearch: dismissed.length,
      secondaryPriority: count((c) => c.triage.priority === "secondary"),
      openChecks: cards.reduce((a, c) => a + c.checks.filter((k) => k.status === "open").length, 0),
      withOwnEvidence: count((c) => c.ownEvidence > 0),
      withImportSignal: count((c) => c.buyerStatus !== "found"),
      unverified: groups.unverified.length,
      consumers: groups.consumers.length,
      traders: groups.traders.length,
      inTargetSize: count(inTarget),
      confirmedImporters: count((c) => c.buyerStatus === "confirmed_importer"),
      brazilOriginConfirmed: count((c) => c.states.brazilOriginConfirmed),
      finalConsumersConfirmed: count((c) => c.states.finalConsumerConfirmed),
      confirmedBuyers: count((c) => c.buyerStatus === "confirmed_buyer"),
      potentialBuyers: count((c) => c.buyerStatus === "potential"),
      withVerifiedDecisionMaker: count((c) => c.contacts.some((k) => k.verified && ["decision_maker", "provisional_decision_maker"].includes(k.role))),
      eligibleForFicha: count((c) => c.ficha.ok),
    },
  };
  // Etapas que ainda dependem de pessoa (nada disso é automático nem presumido).
  const y = metrics.yield;
  const humanSteps = [
    y.foundPending ? `Aceitar ou descartar ${y.foundPending} empresa(s) encontrada(s) pelas fontes gratuitas.` : null,
    count((c) => c.buyerStatus === "found") ? `Procurar sinal próprio de importação para ${count((c) => c.buyerStatus === "found")} empresa(s) sem sinal (validação assistida: site, associação de importadores, registros de embarque); sem sinal, ela não é candidata importadora.` : null,
    y.potentialBuyers ? `Validar o indício de ${y.potentialBuyers} potencial(is) compradora(s) com documento da empresa.` : null,
    count((c) => !c.size) ? `Confirmar o porte (com fonte) de ${count((c) => !c.size)} empresa(s).` : null,
    count((c) => !c.contacts.some((k) => k.verified && ["decision_maker", "provisional_decision_maker"].includes(k.role))) ? `Identificar decisor com fonte em ${count((c) => !c.contacts.some((k) => k.verified && ["decision_maker", "provisional_decision_maker"].includes(k.role)))} empresa(s).` : null,
    "Decidir se contrata base paga de registros aduaneiros para comprovar importação por empresa (comparação em docs/implementation/FONTES-EMPRESAS-EXTERIOR.md; R13.7).",
    y.openChecks ? `Resolver ${y.openChecks} ponto(s) a verificar registrado(s) nas candidatas.` : null,
    y.eligibleForFicha ? `Aprovar individualmente a ficha de cada empresa antes de qualquer contato (${y.eligibleForFicha} apta(s)).` : "Aprovar individualmente cada ficha antes de qualquer contato (P11).",
  ].filter(Boolean);
  return {
    id: x.id, status: x.status, authorizedBy: x.authorized_by, authorizedAt: x.authorized_at, closedAt: x.closed_at, closeNote: x.close_note,
    campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
    country, commodity: { productId: p.id, name: p.commodity, label: item.label, variant: p.variant_name, hs6: item.hs6 },
    target: { ...target, sizesLabel: target.sizes.map((z) => SIZE_LABEL[z]) },
    notice: "O dado do país mostra comércio com o Brasil; não prova que nenhuma empresa desta lista importe. Toda prospecção exige ficha aprovada individualmente (P11).",
    researchPlan: plan,
    humanSteps,
    sources: sources.map((s) => ({ id: s.id, label: s.source_label, kind: s.source_kind, query: s.query_text, results: s.result_count, apiCalls: s.api_calls, costUsd: s.cost_usd, minutes: s.minutes, note: s.note, at: s.recorded_at })),
    metrics,
    groups,
    dismissed,
  };
}

export async function listSearches(env, actor, campaignId) {
  return { items: (await s(env, "SELECT id,status,authorized_by,authorized_at,closed_at FROM foreign_searches WHERE tenant_id=? AND campaign_id=? ORDER BY authorized_at DESC", actor.tenant_id, campaignId).all()).results };
}

// GET /api/foreign-searches — buscas do Radar Internacional (mais recentes primeiro).
export async function listAllSearches(env, actor) {
  const rows = (
    await s(
      env,
      `SELECT f.id,f.status,f.authorized_at,f.closed_at,f.iso3,co.name_pt country,c.name campaign,p.commodity,
         (SELECT COUNT(*) FROM foreign_search_candidates x WHERE x.search_id=f.id AND x.status='active') candidates,
         (SELECT COUNT(*) FROM foreign_search_sources x WHERE x.search_id=f.id) sources
       FROM foreign_searches f JOIN campaigns c ON c.id=f.campaign_id JOIN countries co ON co.iso3=f.iso3 JOIN products p ON p.id=f.product_id
       WHERE f.tenant_id=? ORDER BY f.authorized_at DESC LIMIT 50`,
      actor.tenant_id,
    ).all()
  ).results;
  return { items: rows };
}

async function candidateOf(env, actor, searchId, companyId) {
  const x = await s(env, "SELECT * FROM foreign_searches WHERE tenant_id=? AND id=?", actor.tenant_id, searchId).first();
  if (!x) fail(404, "search_not_found", "Busca não encontrada.");
  if (x.status !== "open") fail(409, "search_closed", "Busca encerrada.");
  const fc = await s(env, "SELECT * FROM foreign_search_candidates WHERE search_id=? AND company_id=?", x.id, companyId).first();
  if (!fc) fail(404, "candidate_not_found", "Empresa não está nesta busca.");
  return { x, fc };
}

// PATCH /api/foreign-searches/:id/candidates/:companyId — prioridade, descarte ou retorno nesta busca (empresa/produto).
// Descarte exige motivo e preserva a empresa, as evidências, as pessoas e o histórico.
export async function triageCandidate(request, env, actor, rid, searchId, companyId) {
  requireRole(actor, WRITE_ROLES);
  const { x, fc } = await candidateOf(env, actor, searchId, companyId);
  const i = await bodyJson(request);
  const at = now();
  const action = oneOf(i.action, ["priority", "dismiss", "restore"], "ação");
  let stmt;
  if (action === "priority") {
    const priority = oneOf(i.priority, ["primary", "secondary"], "prioridade");
    stmt = s(env, "UPDATE foreign_search_candidates SET priority=?,priority_reason=?,decided_by=?,decided_at=? WHERE search_id=? AND company_id=?", priority, str(i.reason, "motivo", 500, priority === "primary"), actor.id, at, x.id, fc.company_id);
  } else if (action === "dismiss") {
    if (fc.status === "dismissed") fail(409, "candidate_dismissed", "Empresa já descartada nesta busca.");
    stmt = s(env, "UPDATE foreign_search_candidates SET status='dismissed',dismiss_reason=?,decided_by=?,decided_at=? WHERE search_id=? AND company_id=?", str(i.reason, "motivo", 500), actor.id, at, x.id, fc.company_id);
  } else {
    if (fc.status !== "dismissed") fail(409, "candidate_active", "Empresa já está ativa nesta busca.");
    stmt = s(env, "UPDATE foreign_search_candidates SET status='active',decided_by=?,decided_at=? WHERE search_id=? AND company_id=?", actor.id, at, x.id, fc.company_id);
  }
  await commit(env, [stmt, auditStatement(env, actor, rid, `foreign_search.candidate_${action}`, "foreign_search", x.id, { companyId: fc.company_id, productId: x.product_id, priority: i.priority ?? null, reason: i.reason ?? null, previous: { priority: fc.priority, status: fc.status, dismissReason: fc.dismiss_reason } })]);
  return { searchId: x.id, companyId: fc.company_id, action };
}

// POST /api/foreign-searches/:id/candidates/:companyId/checks — ponto a verificar (fica aberto até a conclusão com fonte).
export async function addCheck(request, env, actor, rid, searchId, companyId) {
  requireRole(actor, WRITE_ROLES);
  const { x, fc } = await candidateOf(env, actor, searchId, companyId);
  const i = await bodyJson(request);
  const id = crypto.randomUUID();
  await commit(env, [
    s(env, "INSERT INTO search_candidate_checks(id,tenant_id,search_id,company_id,topic,note,source_url,created_by) VALUES (?,?,?,?,?,?,?,?)", id, actor.tenant_id, x.id, fc.company_id, str(i.topic, "ponto a verificar", 200), str(i.note, "nota", 1000, true), url(i.sourceUrl), actor.id),
    auditStatement(env, actor, rid, "foreign_search.check_added", "foreign_search", x.id, { companyId: fc.company_id, checkId: id }),
  ]);
  return { id };
}

// PATCH /api/foreign-searches/:id/candidates/:companyId/checks/:checkId — conclusão (confirmado ou descartado) com texto.
export async function resolveCheck(request, env, actor, rid, searchId, companyId, checkId) {
  requireRole(actor, WRITE_ROLES);
  const { x, fc } = await candidateOf(env, actor, searchId, companyId);
  const i = await bodyJson(request);
  const status = oneOf(i.status, ["confirmed", "cleared"], "conclusão");
  const r = await s(env, "UPDATE search_candidate_checks SET status=?,resolution=?,resolved_by=?,resolved_at=? WHERE id=? AND search_id=? AND company_id=? AND status='open'", status, str(i.resolution, "conclusão", 1000), actor.id, now(), checkId, x.id, fc.company_id).run();
  if (!r.meta.changes) fail(404, "check_not_open", "Ponto não encontrado ou já concluído.");
  await commit(env, [auditStatement(env, actor, rid, "foreign_search.check_resolved", "foreign_search", x.id, { companyId: fc.company_id, checkId, status })]);
  return { id: checkId, status };
}
