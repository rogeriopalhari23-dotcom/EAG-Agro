// Empresas no exterior e condições R12.10 (P3-T8; R12.10, R13.2–R13.7, R14 porte estrangeiro, R1.4.3; AT23).
// Cada condição (importa do Brasil, compra a commodity, consome como insumo) só é confirmada por evidência
// da própria empresa, não de mercado, validada e que diga o que sustenta. Dado agregado do país nunca confirma.
// Camada 2: links de pesquisa montados, nunca executados; sem raspagem e sem fonte nominal paga (R13.7).
import { bodyJson, fail, str, oneOf, url, requireRole, WRITE_ROLES, APPROVER_ROLES } from "./http.js";
import { statement as s, commit, company, product, auditStatement, now } from "./store.js";
import { icpStatus } from "./profiles.js";

export const CONDITIONS = ["imports_from_brazil", "buys_commodity", "consumes_as_input"];
const LEGAL_SUFFIX = /\b(gmbh|ag|kg|co|kgaa|ltd|limited|llc|inc|corp|corporation|plc|sa|s\.a|sas|sarl|srl|spa|bv|nv|oy|ab|as|pty|pte|sdn bhd|bhd|ltda|eireli|me)\b\.?/g;
export const normalizeName = (v) =>
  String(v)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(LEGAL_SUFFIX, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function researchLinks(name, country, commodity) {
  const q = (text) => `https://www.google.com/search?q=${encodeURIComponent(text)}`;
  return [
    { label: "Site e produtos da empresa", url: q(`"${name}" ${country.name_en}`) },
    { label: "Compra da commodity", url: q(`"${name}" ${commodity} supplier OR import OR ingredient`) },
    { label: "Pessoas de compras no LinkedIn", url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name} purchasing`)}` },
  ];
}

export async function createForeignCompany(request, env, actor, rid) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request);
  const campaign = await s(env, "SELECT * FROM campaigns WHERE tenant_id=? AND id=?", actor.tenant_id, str(i.campaignId, "campanha", 80)).first();
  if (!campaign) fail(404, "campaign_not_found", "Campanha não encontrada.");
  if (campaign.market !== "international") fail(422, "campaign_not_international", "Use uma campanha internacional.");
  // Busca de empresas só parte de commodity selecionada na lista do país (R12.14).
  if (!campaign.selection_id) fail(409, "selection_required", "Campanha sem seleção na lista do país (R12.14).");
  const country = await s(env, "SELECT * FROM countries WHERE iso2=?", campaign.country_code).first();
  if (!country) fail(422, "country_not_found", "País da campanha fora do cadastro de países.");
  const p = await product(env, actor.tenant_id, campaign.product_id);
  const name = str(i.legalName, "razão social", 250);
  const source = str(i.sourceLabel, "fonte", 1000);
  const registration = str(i.registrationId, "registro", 100, true);
  const registrationType = str(i.registrationIdType, "tipo de registro", 40, true)?.toUpperCase() || null;
  if (registration && !registrationType) fail(422, "registration_type_required", "Informe o tipo de registro (ex.: HRB, CRN, EIN).");
  let id = null;
  if (registration) {
    const same = await s(env, "SELECT id FROM companies WHERE tenant_id=? AND country_code=? AND registration_id=? AND registration_id_type=?", actor.tenant_id, country.iso2, registration, registrationType).first();
    // Mesmo registro = mesma empresa: reaproveita e só garante as condições desta commodity.
    if (same) id = same.id;
  }
  if (!id && !i.confirmDistinct) {
    const key = normalizeName(name);
    const similar = (await s(env, "SELECT id,legal_name,registration_id FROM companies WHERE tenant_id=? AND country_code=?", actor.tenant_id, country.iso2).all()).results.filter((c) => normalizeName(c.legal_name) === key);
    // Nome parecido sem identificador em comum vira pendência para a pessoa decidir, nunca fusão automática.
    if (similar.length) fail(409, "possible_duplicate", "Há empresa com nome parecido neste país. Confira e, se for outra, confirme que é distinta.", { candidates: similar });
  }
  const created = !id;
  id ||= crypto.randomUUID();
  const at = now();
  const stmts = [];
  if (created)
    stmts.push(
      s(
        env,
        "INSERT INTO companies(id,tenant_id,legal_name,trade_name,country_code,registration_id,registration_id_type,buyer_type,owner_user_id,source_label,source_url,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'unconfirmed',?,?,?,?,?,?)",
        id, actor.tenant_id, name, str(i.tradeName, "nome fantasia", 250, true), country.iso2, registration, registrationType, actor.id, source, url(i.sourceUrl), actor.id, at, at,
      ),
      auditStatement(env, actor, rid, "company.created", "company", id, { market: "international", country: country.iso3, campaignId: campaign.id }),
    );
  for (const c of CONDITIONS)
    stmts.push(s(env, "INSERT OR IGNORE INTO company_conditions(tenant_id,company_id,product_id,condition,status,updated_by) VALUES (?,?,?,?,'pending',?)", actor.tenant_id, id, p.id, c, actor.id));
  try {
    await commit(env, stmts);
  } catch (e) {
    if (/UNIQUE/.test(String(e?.message))) fail(409, "company_duplicate", "Já existe empresa com essa razão social neste país.");
    throw e;
  }
  return { id, created, conditions: await conditionsOf(env, actor.tenant_id, id, p.id), researchLinks: researchLinks(name, country, p.commodity) };
}

export async function conditionsOf(env, tenant, companyId, productId) {
  return (
    await s(env, "SELECT condition,status,evidence_id,note,updated_by,updated_at FROM company_conditions WHERE tenant_id=? AND company_id=? AND product_id=? ORDER BY condition", tenant, companyId, productId).all()
  ).results;
}

// Condição R12.10 com evidência por condição (R13.4). Nunca por dado de país (AT23).
export async function setCondition(request, env, actor, rid, companyId, productId, condition) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, companyId);
  const p = await product(env, actor.tenant_id, productId);
  oneOf(condition, CONDITIONS, "condição");
  const i = await bodyJson(request);
  const status = oneOf(i.status, ["confirmed", "pending", "not_found"], "estado");
  let evidenceId = null, note = null;
  if (status === "confirmed") {
    const e = await s(env, "SELECT * FROM evidence WHERE tenant_id=? AND id=?", actor.tenant_id, str(i.evidenceId, "evidência", 80)).first();
    if (!e) fail(404, "evidence_not_found", "Evidência não encontrada.");
    if (e.company_id !== c.id) fail(422, "evidence_other_company", "A evidência é de outra empresa.");
    if (e.category === "market") fail(422, "market_evidence_not_company", "Dado de mercado ou do país não confirma condição de empresa (R1.4.3).");
    if (e.validation_status !== "valid") fail(422, "evidence_not_valid", "Valide a evidência antes de usá-la.");
    let supports = [];
    try {
      supports = JSON.parse(e.metadata_json || "{}").supports ?? [];
    } catch {
      supports = [];
    }
    if (!Array.isArray(supports) || !supports.includes(condition))
      fail(422, "evidence_missing_support", "A evidência não diz que sustenta esta condição (metadata.supports).");
    evidenceId = e.id;
  }
  if (status === "not_found") {
    note = str(i.note, "nota", 500);
    if (note.length < 10) fail(422, "note_required", "Descreva onde procurou (mínimo 10 caracteres).");
  }
  await commit(env, [
    s(
      env,
      `INSERT INTO company_conditions(tenant_id,company_id,product_id,condition,status,evidence_id,note,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(tenant_id,company_id,product_id,condition) DO UPDATE SET status=excluded.status,evidence_id=excluded.evidence_id,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
      actor.tenant_id, c.id, p.id, condition, status, evidenceId, note, actor.id, now(),
    ),
    auditStatement(env, actor, rid, "company_condition.set", "company", c.id, { productId: p.id, condition, status, evidenceId }),
  ]);
  return { conditions: await conditionsOf(env, actor.tenant_id, c.id, p.id) };
}

// Porte de empresa no exterior (sem código da Receita): faixa com fonte, só gestores; refaz o ICP dos perfis.
export async function setSize(request, env, actor, rid, companyId) {
  requireRole(actor, APPROVER_ROLES);
  const c = await company(env, actor, companyId);
  const i = await bodyJson(request);
  const band = oneOf(i.sizeBand, ["small", "medium", "medium_plus", "giant"], "porte");
  const source = str(i.source, "fonte do porte", 500);
  const at = now();
  const profiles = (await s(env, "SELECT * FROM buyer_profiles WHERE tenant_id=? AND company_id=?", actor.tenant_id, c.id).all()).results;
  const stmts = [s(env, "UPDATE companies SET size_band=?,size_source=?,size_checked_at=?,updated_at=? WHERE tenant_id=? AND id=?", band, source, at, at, actor.tenant_id, c.id)];
  for (const p of profiles) {
    const status = icpStatus({ profileClass: p.profile_class, sizeCode: null, sizeBand: band, isGiant: !!p.is_giant });
    if (status !== p.icp_status) stmts.push(s(env, "UPDATE buyer_profiles SET icp_status=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=?", status, actor.id, at, p.id));
  }
  stmts.push(auditStatement(env, actor, rid, "company.size_set", "company", c.id, { sizeBand: band, source }));
  await commit(env, stmts);
  return { id: c.id, sizeBand: band };
}

// Linha da lista mensal do país para a commodity da campanha, marcada como dado do país (R1.4.2) — só leitura.
export async function countryLine(env, actor, campaignId) {
  const campaign = await s(env, "SELECT * FROM campaigns WHERE tenant_id=? AND id=?", actor.tenant_id, campaignId).first();
  if (!campaign?.selection_id) return null;
  const sel = await s(env, "SELECT items_json,analysis_id FROM commodity_selections WHERE id=?", campaign.selection_id).first();
  const item = JSON.parse(sel.items_json).find((x) => x.campaignId === campaign.id);
  return { analysisId: sel.analysis_id, hs6: item?.hs6 ?? [], label: "dado do país, não da empresa" };
}
