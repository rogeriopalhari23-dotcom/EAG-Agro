// Pessoas de compras (2026-09-28), nos dois radares. Fluxo inspirado no Harpor (empresa-alvo → cargo-alvo → contato →
// ficha → acompanhamento), sem automação do LinkedIn (proibida pelo User Agreement §8.2): fontes próprias e permitidas
// (Impressum do site da empresa, QSA da Receita) e pesquisa assistida com links para o LinkedIn/site, registro manual.
// Estados: "contato de compras a validar" (pessoa encontrada numa fonte) → contato aceito → "cargo verificado"
// (contact_verifications job_title) → "decisor de compras confirmado" (decision_authority). Nada disso autoriza envio.
// Economia: só empresas aderentes (perfil no ICP ou porte a confirmar, nunca trader/gigante/micro), no máximo 3 pessoas,
// lotes de 5, pesquisa repetida só depois do prazo de atualização da fonte.
import { bodyJson, fail, str, oneOf, url, requireRole, WRITE_ROLES } from "./http.js";
import { statement as s, company, commit, companyLock, auditStatement, now } from "./store.js";
import { encryptPii, decryptPii, secretKey, identifierHash } from "./crypto.js";
import { isSuppressed } from "./operations.js";
import { impressumPeople, brasilApiCnpj, PEOPLE_REFRESH_DAYS } from "./adapters/people.js";
import { AdapterError } from "./adapters/errors.js";

const MAX_PEOPLE = 3;
const BATCH = 5;
const IMPRESSUM_COUNTRIES = new Set(["DE", "AT", "CH", "LI"]);
const addDays = (iso, d) => new Date(Date.parse(iso) + d * 86400000).toISOString();
const ADHERENT = ["in_icp", "pending_size"];
const SOURCE_LABEL = {
  impressum: "Impressum (aviso legal obrigatório) no site da empresa",
  registry_qsa: "QSA da Receita Federal (BrasilAPI)",
  company_site: "Site da empresa (equipe publicada)",
  directory: "Diretório profissional",
  linkedin_manual: "LinkedIn — consulta manual pela pessoa",
  manual: "Registro manual com fonte",
};
const GENERIC_LOCAL = /^(info|kontakt|contact|office|mail|hello|hallo|service|team|post|vendas|comercial|compras|contato|sac|financeiro|admin|einkauf|verkauf|sales|shop|bestellung|orders?)$/i;

async function nameHash(env, tenant, companyId, name) {
  const key = await secretKey(env, "SUPPRESSION_HMAC_KEY", { name: "HMAC", hash: "SHA-256" }, ["sign"]);
  const norm = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
  const d = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${tenant}:person:${companyId}:${norm}`));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// E-mail publicado: pessoal só se a parte local contém o nome/sobrenome da pessoa; caixa genérica é da empresa.
export function emailScope(email, name, kind) {
  if (!email) return null;
  if (kind === "registry_qsa") return "registry";
  const local = email.split("@")[0].toLowerCase();
  if (GENERIC_LOCAL.test(local)) return "generic";
  const parts = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter((p) => p.length >= 3);
  return parts.some((p) => local.includes(p)) ? "personal" : "generic";
}

// Triagem de aderência: perfil desta empresa em alguma commodity com ICP válido (ou porte a confirmar).
async function adherence(env, tenant, companyId) {
  const rows = (await s(env, "SELECT icp_status,profile_class FROM buyer_profiles WHERE tenant_id=? AND company_id=?", tenant, companyId).all()).results;
  if (!rows.length) return { ok: false, reason: "Empresa sem perfil comprador registrado: faça a triagem antes de pesquisar pessoas." };
  if (!rows.some((r) => ADHERENT.includes(r.icp_status))) return { ok: false, reason: `Empresa fora da triagem de aderência (${rows.map((r) => r.icp_status).join(", ")}).` };
  return { ok: true };
}

// Unidade que compra (Nacional): consumidora > recebimento > desconhecida > sede. Só sede = alerta.
async function buyingUnit(env, tenant, companyId) {
  const units = (await s(env, "SELECT * FROM company_units WHERE tenant_id=? AND company_id=? ORDER BY CASE unit_role WHEN 'consumer' THEN 0 WHEN 'receiving' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END, cnpj", tenant, companyId).all()).results;
  return units[0] ?? null;
}

async function findPeople(c, unit, deps) {
  const f = deps.fetch ?? fetch;
  const out = [];
  if (c.country_code === "BR" || unit) {
    const cnpj = unit?.cnpj ?? null;
    if (!cnpj) out.push({ kind: "registry_qsa", status: "skipped", note: "Sem CNPJ de unidade cadastrado." });
    else {
      const r = await brasilApiCnpj(cnpj, f);
      out.push({ kind: "registry_qsa", ...r, requests: 1, unitId: unit.id, headOnly: r.unit?.headOffice && unit.unit_role !== "consumer" });
    }
  }
  if (c.website && IMPRESSUM_COUNTRIES.has(c.country_code)) out.push({ kind: "impressum", ...(await impressumPeople(c.website, f)) });
  else if (c.country_code !== "BR") out.push({ kind: "impressum", status: "skipped", note: c.website ? `País ${c.country_code} sem aviso legal padronizado; use a pesquisa assistida.` : "Empresa sem site registrado." });
  return out;
}

const relevanceOf = (kind, title) =>
  kind === "registry_qsa"
    ? `${title} no QSA da Receita: administra a empresa; em PME costuma decidir ou aprovar compras — a validar.`
    : `${title} no aviso legal (Impressum): representante legal; em PME costuma decidir ou aprovar compras — a validar.`;

// POST /api/companies/:id/people/research — pesquisa pessoas numa empresa aderente (reaproveita pesquisa ainda válida).
export async function researchCompany(request, env, actor, rid, companyId, deps = {}) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, companyId);
  return research(env, actor, rid, c, deps);
}

async function research(env, actor, rid, c, deps) {
  const at = deps.now ?? now();
  const prev = await s(env, "SELECT * FROM people_research WHERE company_id=?", c.id).first();
  if (prev && prev.refresh_after > at) return { companyId: c.id, reused: true, researchedAt: prev.researched_at, refreshAfter: prev.refresh_after, sources: JSON.parse(prev.sources_json), added: 0 };
  const adh = await adherence(env, actor.tenant_id, c.id);
  if (!adh.ok) return { companyId: c.id, skipped: true, reason: adh.reason, added: 0 };
  const unit = await buyingUnit(env, actor.tenant_id, c.id);
  const started = Date.now();
  let found;
  try {
    found = await findPeople(c, unit, deps);
  } catch (e) {
    if (e instanceof AdapterError) fail(e.retryable ? 503 : 502, `people_source_${e.kind}`, e.message);
    throw e;
  }
  const existing = (await s(env, "SELECT name_hash,status FROM person_candidates WHERE tenant_id=? AND company_id=?", actor.tenant_id, c.id).all()).results;
  const hashes = new Set(existing.map((r) => r.name_hash));
  let room = MAX_PEOPLE - existing.filter((r) => r.status !== "dismissed").length;
  const stmts = [];
  let added = 0;
  const sources = [];
  for (const src of found) {
    sources.push({ kind: src.kind, url: src.url ?? null, status: src.status, found: src.people?.length ?? 0, note: src.note ?? (src.headOnly ? "Só o endereço da sede (matriz) na fonte; a unidade que compra pode ser outra." : null), unit: src.unit ?? null });
    for (const p of src.people ?? []) {
      const h = await nameHash(env, actor.tenant_id, c.id, p.name);
      if (hashes.has(h) || room <= 0) continue;
      hashes.add(h);
      room--;
      added++;
      const scope = emailScope(src.email, p.name, src.kind);
      stmts.push(
        s(
          env,
          "INSERT INTO person_candidates(id,tenant_id,company_id,unit_id,name_encrypted,name_hash,title_encrypted,role_suggestion,relevance,source_kind,source_url,verified_at,refresh_after,email_encrypted,email_source_url,email_scope,phone_encrypted,phone_source_url,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          crypto.randomUUID(), actor.tenant_id, c.id, src.unitId ?? null, await encryptPii(p.name, env), h, await encryptPii(p.title, env),
          "provisional_decision_maker", relevanceOf(src.kind, p.title), src.kind, src.url, at, addDays(at, PEOPLE_REFRESH_DAYS[src.kind]),
          await encryptPii(src.email, env), src.email ? src.url : null, scope, await encryptPii(src.phone, env), src.phone ? src.url : null, actor.id,
        ),
      );
    }
  }
  const requests = found.reduce((n, x) => n + (x.requests ?? 0), 0);
  const days = Math.min(...found.filter((x) => x.status === "ok").map((x) => PEOPLE_REFRESH_DAYS[x.kind]), 30);
  stmts.push(
    s(
      env,
      "INSERT INTO people_research(company_id,tenant_id,researched_at,refresh_after,sources_json,requests,duration_ms,researched_by) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET researched_at=excluded.researched_at,refresh_after=excluded.refresh_after,sources_json=excluded.sources_json,requests=excluded.requests,duration_ms=excluded.duration_ms,researched_by=excluded.researched_by",
      c.id, actor.tenant_id, at, addDays(at, Number.isFinite(days) ? days : 30), JSON.stringify(sources), requests, Date.now() - started, actor.id,
    ),
    auditStatement(env, actor, rid, "people.researched", "company", c.id, { added, requests, sources: sources.map((x) => `${x.kind}:${x.status}`) }),
  );
  await commit(env, stmts);
  return { companyId: c.id, reused: false, added, requests, sources };
}

// POST /api/foreign-searches/:id/people/research — lote pequeno das empresas aderentes da busca ainda não pesquisadas.
export async function researchSearchBatch(request, env, actor, rid, searchId, deps = {}) {
  requireRole(actor, WRITE_ROLES);
  const x = await s(env, "SELECT * FROM foreign_searches WHERE tenant_id=? AND id=?", actor.tenant_id, searchId).first();
  if (!x) fail(404, "search_not_found", "Busca não encontrada.");
  const at = deps.now ?? now();
  const rows = (
    await s(
      env,
      `SELECT c.* FROM foreign_search_candidates fc JOIN companies c ON c.id=fc.company_id
       JOIN buyer_profiles bp ON bp.company_id=c.id AND bp.tenant_id=c.tenant_id AND bp.product_id=? AND bp.unit_key=''
       LEFT JOIN people_research pr ON pr.company_id=c.id
       WHERE fc.search_id=? AND c.tenant_id=? AND bp.icp_status IN ('in_icp','pending_size') AND (pr.company_id IS NULL OR pr.refresh_after<=?)
       ORDER BY CASE bp.icp_status WHEN 'in_icp' THEN 0 ELSE 1 END, fc.added_at LIMIT ?`,
      x.product_id, x.id, actor.tenant_id, at, BATCH,
    ).all()
  ).results;
  const results = [];
  for (const c of rows) {
    try {
      results.push(await research(env, actor, rid, c, deps));
    } catch (e) {
      results.push({ companyId: c.id, error: e.message });
    }
  }
  const remaining = (
    await s(
      env,
      `SELECT COUNT(*) n FROM foreign_search_candidates fc JOIN buyer_profiles bp ON bp.company_id=fc.company_id AND bp.product_id=? AND bp.unit_key='' LEFT JOIN people_research pr ON pr.company_id=fc.company_id
       WHERE fc.search_id=? AND bp.icp_status IN ('in_icp','pending_size') AND (pr.company_id IS NULL OR pr.refresh_after<=?)`,
      x.product_id, x.id, at,
    ).first()
  ).n;
  return { researched: results.length, added: results.reduce((n, r) => n + (r.added ?? 0), 0), results, remaining };
}

// Links de pesquisa assistida (a pessoa abre e registra o que confirmar). Nenhuma chamada automática ao LinkedIn.
export function assistedLinks(c) {
  const roles = c.country_code === "BR" ? ["compras", "suprimentos", "comprador", "diretor"] : ["Einkauf", "Beschaffung", "purchasing", "procurement", "sourcing", "Geschäftsführer"];
  const q = (t) => encodeURIComponent(t);
  const links = [
    { label: "LinkedIn — pessoas da empresa com cargo de compras (abrir e conferir manualmente)", url: `https://www.linkedin.com/search/results/people/?keywords=${q(`${c.trade_name || c.legal_name} ${roles.slice(0, 3).join(" OR ")}`)}` },
    { label: "Busca web — compras na empresa", url: `https://www.google.com/search?q=${q(`"${c.trade_name || c.legal_name}" (${roles.join(" OR ")})`)}` },
  ];
  if (c.website) {
    const host = (() => { try { return new URL(c.website).hostname; } catch { return null; } })();
    if (host) links.push({ label: "Site da empresa — equipe e contato", url: `https://www.google.com/search?q=${q(`site:${host} (team OR equipe OR ansprechpartner OR "über uns" OR ${roles.slice(0, 2).join(" OR ")})`)}` });
  }
  return links;
}

const STATE_LABEL = { to_validate: "contato de compras a validar", accepted: "contato aceito (cargo a verificar)", dismissed: "descartado" };

// GET /api/companies/:id/people — candidatos, contatos aceitos com o estado de verificação e pesquisa assistida.
export async function listPeople(env, actor, companyId, deps = {}) {
  const c = await company(env, actor, companyId);
  const at = deps.now ?? now();
  const research = await s(env, "SELECT * FROM people_research WHERE company_id=?", c.id).first();
  const rows = (await s(env, "SELECT * FROM person_candidates WHERE tenant_id=? AND company_id=? ORDER BY status='dismissed', created_at", actor.tenant_id, c.id).all()).results;
  const verifs = (
    await s(env, "SELECT v.contact_id,v.verification_type,v.status FROM contact_verifications v JOIN contacts ct ON ct.id=v.contact_id WHERE v.tenant_id=? AND ct.company_id=? ORDER BY v.verified_at", actor.tenant_id, c.id).all()
  ).results;
  const confirmed = (cid, type) => { const last = verifs.filter((v) => v.contact_id === cid && v.verification_type === type).pop(); return last?.status === "confirmed"; };
  const contacts = new Map((await s(env, "SELECT id,email_validation,phone_encrypted FROM contacts WHERE tenant_id=? AND company_id=?", actor.tenant_id, c.id).all()).results.map((r) => [r.id, r]));
  const people = [];
  for (const r of rows) {
    const [name, title, email, phone] = await Promise.all([r.name_encrypted, r.title_encrypted, r.email_encrypted, r.phone_encrypted].map((v) => decryptPii(v, env)));
    const ct = r.contact_id ? contacts.get(r.contact_id) : null;
    const decider = ct && confirmed(ct.id, "decision_authority");
    const titleOk = ct && (decider || confirmed(ct.id, "job_title"));
    people.push({
      id: r.id, name, title, relevance: r.relevance, roleSuggestion: r.role_suggestion,
      source: { kind: r.source_kind, label: SOURCE_LABEL[r.source_kind], url: r.source_url, verifiedAt: r.verified_at },
      stale: r.refresh_after <= at, staleNote: r.refresh_after <= at ? "Vínculo e cargo verificados há mais que o prazo da fonte: reconfira antes de usar." : null,
      status: r.status, contactId: r.contact_id,
      state: decider ? "decisor de compras confirmado" : titleOk ? "cargo verificado" : STATE_LABEL[r.status],
      email: email ? { value: email, scope: r.email_scope, source: r.email_source_url, validation: ct?.email_validation ?? "not_validated",
        note: r.email_scope === "personal" ? "E-mail pessoal publicado na fonte; entrega não validada." : r.email_scope === "registry" ? "E-mail do cadastro da Receita (costuma ser do contador) — não é da pessoa." : "Caixa geral da empresa — não é da pessoa." } : null,
      phone: phone ? { value: phone, source: r.phone_source_url, note: "Telefone publicado da empresa; não autoriza WhatsApp nem prova que atende a pessoa." } : null,
      dismissReason: r.dismiss_reason,
    });
  }
  return {
    companyId: c.id,
    research: research ? { at: research.researched_at, refreshAfter: research.refresh_after, stale: research.refresh_after <= at, requests: research.requests, durationMs: research.duration_ms, sources: JSON.parse(research.sources_json) } : null,
    adherence: await adherence(env, actor.tenant_id, c.id),
    people,
    counts: {
      identified: people.filter((p) => p.status !== "dismissed").length,
      titleVerified: people.filter((p) => p.state === "cargo verificado" || p.state === "decisor de compras confirmado").length,
      decidersConfirmed: people.filter((p) => p.state === "decisor de compras confirmado").length,
      emailsValidated: people.filter((p) => p.email?.validation === "valid").length,
    },
    assisted: assistedLinks(c),
    notice: "Pessoa encontrada em fonte pública é contato a validar: cargo e poder de compra só valem depois da verificação registrada. Nenhum e-mail é deduzido do domínio; telefone publicado não autoriza WhatsApp. LinkedIn só por consulta manual.",
  };
}

async function candidateOf(env, actor, companyId, id) {
  const r = await s(env, "SELECT * FROM person_candidates WHERE tenant_id=? AND company_id=? AND id=?", actor.tenant_id, companyId, id).first();
  if (!r) fail(404, "person_not_found", "Pessoa não encontrada nesta empresa.");
  return r;
}

// POST /api/companies/:id/people/:pid/accept — vira contato (dados criptografados); e-mail só se for pessoal e publicado.
export async function acceptPerson(request, env, actor, rid, companyId, pid) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, companyId);
  const r = await candidateOf(env, actor, companyId, pid);
  if (r.status !== "to_validate") fail(409, "person_decided", r.status === "accepted" ? "Pessoa já aceita." : "Pessoa descartada.");
  const i = await bodyJson(request);
  const role = oneOf(i.prospectRole ?? r.role_suggestion, ["decision_maker", "influencer", "provisional_decision_maker", "other"], "papel na prospecção");
  const email = r.email_scope === "personal" ? await decryptPii(r.email_encrypted, env) : null;
  const cid = crypto.randomUUID();
  const at = now();
  await commit(env, [
    companyLock(env, actor, c),
    s(
      env,
      "INSERT INTO contacts(id,tenant_id,company_id,full_name_encrypted,job_title_encrypted,email_encrypted,phone_encrypted,linkedin_url_encrypted,source_label,source_url,created_by,prospect_role,email_hash,email_validation) VALUES (?,?,?,?,?,?,NULL,NULL,?,?,?,?,?,?)",
      cid, actor.tenant_id, c.id, r.name_encrypted, r.title_encrypted, email ? r.email_encrypted : null,
      `${SOURCE_LABEL[r.source_kind]} — verificado em ${r.verified_at.slice(0, 10)}`, r.source_url, actor.id, role,
      email ? await identifierHash(env, actor.tenant_id, "email", email) : null, email ? "pending" : null,
    ),
    s(env, "UPDATE person_candidates SET status='accepted',contact_id=?,decided_by=?,decided_at=? WHERE id=? AND status='to_validate'", cid, actor.id, at, r.id),
    auditStatement(env, actor, rid, "people.accepted", "contact", cid, { companyId: c.id, personId: r.id, source: r.source_kind, emailCopied: !!email }),
  ]);
  return { contactId: cid, emailCopied: !!email, suppressed: email ? await isSuppressed(env, actor.tenant_id, "email", email) : false };
}

// POST /api/companies/:id/people/:pid/dismiss
export async function dismissPerson(request, env, actor, rid, companyId, pid) {
  requireRole(actor, WRITE_ROLES);
  await company(env, actor, companyId);
  const r = await candidateOf(env, actor, companyId, pid);
  const reason = str((await bodyJson(request)).reason, "motivo", 300);
  await commit(env, [
    s(env, "UPDATE person_candidates SET status='dismissed',dismiss_reason=?,decided_by=?,decided_at=? WHERE id=? AND status='to_validate'", reason, actor.id, now(), r.id),
    auditStatement(env, actor, rid, "people.dismissed", "company", companyId, { personId: r.id }),
  ]);
  return { dismissed: true };
}

// POST /api/companies/:id/people — registro manual (site, diretório ou LinkedIn consultado pela pessoa), sempre com fonte.
export async function addPerson(request, env, actor, rid, companyId) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, companyId);
  const i = await bodyJson(request);
  const name = str(i.name, "nome", 200);
  const title = str(i.title, "cargo", 200);
  const kind = oneOf(i.sourceKind, ["company_site", "directory", "linkedin_manual", "manual"], "tipo de fonte");
  const sourceUrl = url(i.sourceUrl);
  if (!sourceUrl) fail(422, "source_required", "Informe a URL da fonte onde a pessoa e o cargo aparecem.");
  const email = str(i.email, "e-mail", 320, true);
  const emailSource = email ? url(i.emailSourceUrl) : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422, "invalid_email", "E-mail inválido.");
  // Sem inferência pelo padrão do domínio: o e-mail precisa estar publicado numa fonte (URL).
  if (email && !emailSource) fail(422, "email_source_required", "Informe onde o e-mail está publicado; e-mail deduzido do padrão do domínio não é aceito.");
  const phone = str(i.phone, "telefone", 50, true);
  const phoneSource = phone ? url(i.phoneSourceUrl) : null;
  if (phone && !phoneSource) fail(422, "phone_source_required", "Informe onde o telefone está publicado.");
  const h = await nameHash(env, actor.tenant_id, c.id, name);
  const dup = await s(env, "SELECT id,status FROM person_candidates WHERE company_id=? AND name_hash=?", c.id, h).first();
  if (dup) fail(409, "person_duplicate", "Esta pessoa já está registrada nesta empresa.");
  const active = (await s(env, "SELECT COUNT(*) n FROM person_candidates WHERE company_id=? AND status<>'dismissed'", c.id).first()).n;
  if (active >= MAX_PEOPLE) fail(409, "people_limit", `Até ${MAX_PEOPLE} pessoas por empresa: descarte uma antes de incluir outra.`);
  const at = now();
  const id = crypto.randomUUID();
  await commit(env, [
    s(
      env,
      "INSERT INTO person_candidates(id,tenant_id,company_id,unit_id,name_encrypted,name_hash,title_encrypted,role_suggestion,relevance,source_kind,source_url,verified_at,refresh_after,email_encrypted,email_source_url,email_scope,phone_encrypted,phone_source_url,created_by) VALUES (?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id, actor.tenant_id, c.id, await encryptPii(name, env), h, await encryptPii(title, env),
      oneOf(i.roleSuggestion ?? "influencer", ["decision_maker", "influencer", "provisional_decision_maker", "other"], "papel"),
      str(i.relevance ?? `${title} — cargo ligado a compras segundo a fonte; a validar.`, "relevância", 300), kind, sourceUrl, at, addDays(at, PEOPLE_REFRESH_DAYS[kind]),
      await encryptPii(email, env), emailSource, email ? emailScope(email, name, kind) : null, await encryptPii(phone, env), phoneSource, actor.id,
    ),
    auditStatement(env, actor, rid, "people.added", "company", c.id, { personId: id, source: kind, email: !!email, phone: !!phone }),
  ]);
  return { id };
}
