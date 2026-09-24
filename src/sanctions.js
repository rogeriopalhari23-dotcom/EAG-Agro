// Triagem de sanções (P2-T16; R1.2, R1.2.1, R19.2 item 6, R19.3; errata item 5).
// Fontes e validade dependem da política T11: nada é semeado. Importação em lotes, auditável, com contagem conferida.
import { bodyJson, fail, str, oneOf, url, requireRole, WRITE_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, company } from "./store.js";
import { evaluateSanctionMatch } from "./scoring.js";

const ADMIN = new Set(["admin"]);
const LEGAL_SUFFIX = /\b(ltda|s\/?a|sa|eireli|me|epp|mei|inc|llc|ltd|limited|gmbh|co|corp|corporation|company|sarl|srl|bv|nv|ag|plc)\b/g;
export function normalizeEntityName(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ")
    .replace(LEGAL_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const normalizeId = (v) => String(v || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();

export async function addSource(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const id = crypto.randomUUID();
  const key = str(i.sourceKey, "chave da fonte", 60);
  if (!/^[a-z0-9_]+$/.test(key)) fail(422, "invalid_field", "Chave em minúsculas, ex.: ofac_sdn.");
  const officialUrl = url(i.officialUrl, "URL oficial");
  if (!officialUrl) fail(422, "invalid_url", "URL oficial obrigatória.");
  await commit(env, [
    s(
      env,
      "INSERT INTO sanction_sources(id,source_key,name,official_url,jurisdiction,blocking_policy,active) VALUES (?,?,?,?,?,?,1)",
      id, key, str(i.name, "nome", 200), officialUrl, str(i.jurisdiction, "jurisdição", 60),
      oneOf(i.blockingPolicy, ["legal_block", "integrity_alert", "review_only"], "política de bloqueio"),
    ),
    auditStatement(env, actor, rid, "sanctions.source_added", "sanction_source", id, { key }),
  ]);
  return { id };
}

export async function startVersion(request, env, actor, rid, sourceId) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const src = await s(env, "SELECT id FROM sanction_sources WHERE id=?", sourceId).first();
  if (!src) fail(404, "source_not_found", "Fonte não encontrada.");
  const hash = str(i.contentHash, "hash do arquivo", 64);
  if (!/^[0-9a-f]{64}$/.test(hash)) fail(422, "invalid_hash", "Informe o SHA-256 (hex) do arquivo oficial.");
  const count = i.recordCount;
  if (!Number.isInteger(count) || count < 1 || count > 500000) fail(422, "invalid_count", "Quantidade de registros inválida.");
  const id = crypto.randomUUID();
  await commit(env, [
    s(
      env,
      "INSERT INTO sanction_list_versions(id,source_id,source_version,content_hash,published_at,downloaded_at,record_count,storage_key,import_status) VALUES (?,?,?,?,?,?,?,?,'pending')",
      id, sourceId, str(i.sourceVersion, "versão da fonte", 100, true), hash, str(i.publishedAt, "publicação", 40, true), str(i.downloadedAt, "download", 40), count, str(i.storageKey, "arquivo", 300, true),
    ),
    auditStatement(env, actor, rid, "sanctions.version_started", "sanction_list_version", id, { sourceId, hash, count }),
  ]);
  return { id };
}

// Lote de registros (cabe no limite de 64 KB por requisição). Nome primário também vira alias normalizado.
export async function addEntries(request, env, actor, rid, versionId) {
  requireRole(actor, ADMIN);
  const v = await s(env, "SELECT * FROM sanction_list_versions WHERE id=?", versionId).first();
  if (!v) fail(404, "version_not_found", "Versão não encontrada.");
  if (v.import_status !== "pending") fail(409, "version_closed", "Versão já fechada.");
  const i = await bodyJson(request);
  if (!Array.isArray(i.entries) || !i.entries.length || i.entries.length > 300) fail(422, "invalid_batch", "Envie de 1 a 300 registros por lote.");
  const statements = [];
  for (const e of i.entries) {
    const id = crypto.randomUUID();
    const name = str(e.primaryName, "nome", 500);
    statements.push(
      s(
        env,
        "INSERT INTO sanction_entries(id,list_version_id,official_entity_id,primary_name,entity_type,country_code,program,raw_json) VALUES (?,?,?,?,?,?,?,?)",
        id, versionId, e.officialEntityId ? normalizeId(e.officialEntityId) : null, name, str(e.entityType, "tipo", 40, true),
        e.countryCode ? str(e.countryCode, "país", 2).toUpperCase() : null, str(e.program, "programa", 200, true), JSON.stringify(e.raw ?? {}),
      ),
    );
    for (const alias of [name, ...(Array.isArray(e.aliases) ? e.aliases : [])].slice(0, 30)) {
      const n = normalizeEntityName(alias);
      if (n) statements.push(s(env, "INSERT INTO sanction_aliases(id,entry_id,alias_name,normalized_name) VALUES (?,?,?,?)", crypto.randomUUID(), id, String(alias).slice(0, 500), n));
    }
  }
  await env.DB.batch(statements);
  return { added: i.entries.length };
}

// Fecha a versão só se a contagem bate com a declarada; senão, falha registrada (lista parcial nunca vale).
export async function finishVersion(request, env, actor, rid, versionId) {
  requireRole(actor, ADMIN);
  await bodyJson(request);
  const v = await s(env, "SELECT * FROM sanction_list_versions WHERE id=?", versionId).first();
  if (!v) fail(404, "version_not_found", "Versão não encontrada.");
  if (v.import_status !== "pending") fail(409, "version_closed", "Versão já fechada.");
  const n = (await s(env, "SELECT COUNT(*) n FROM sanction_entries WHERE list_version_id=?", versionId).first()).n;
  const ok = n === v.record_count;
  await commit(env, [
    s(env, "UPDATE sanction_list_versions SET import_status=?,error_summary=? WHERE id=? AND import_status='pending'", ok ? "imported" : "failed", ok ? null : `Importados ${n} de ${v.record_count} registros.`, versionId),
    auditStatement(env, actor, rid, ok ? "sanctions.version_imported" : "sanctions.version_failed", "sanction_list_version", versionId, { expected: v.record_count, imported: n }),
  ]);
  if (!ok) fail(422, "import_incomplete", `Importados ${n} de ${v.record_count} registros; versão marcada como falha.`);
  return { id: versionId, status: "imported", records: n };
}

// Triagem da empresa contra a versão importada mais recente de cada fonte ativa.
export async function screenCompany(request, env, actor, rid, companyId) {
  requireRole(actor, WRITE_ROLES);
  await bodyJson(request);
  const c = await company(env, actor, companyId);
  const sources = (
    await s(
      env,
      "SELECT ss.id,ss.blocking_policy,(SELECT v.id FROM sanction_list_versions v WHERE v.source_id=ss.id AND v.import_status='imported' ORDER BY v.downloaded_at DESC,v.rowid DESC LIMIT 1) version_id FROM sanction_sources ss WHERE ss.active=1",
    ).all()
  ).results;
  if (!sources.length || sources.some((x) => !x.version_id))
    fail(409, "sanctions_sources_unavailable", "Há fonte ativa sem lista importada: a triagem não pode ser concluída (R19.3).");
  const versions = Object.fromEntries(sources.map((x) => [x.id, x.version_id]));
  const names = [...new Set([c.legal_name, c.trade_name].filter(Boolean).map(normalizeEntityName))].filter(Boolean);
  const regId = c.registration_id ? normalizeId(c.registration_id) : null;
  const vIds = Object.values(versions);
  const ph = (a) => a.map(() => "?").join(",");
  const byName = names.length
    ? (
        await s(
          env,
          `SELECT DISTINCT e.id,e.country_code,e.official_entity_id FROM sanction_aliases a JOIN sanction_entries e ON e.id=a.entry_id WHERE e.list_version_id IN (${ph(vIds)}) AND a.normalized_name IN (${ph(names)})`,
          ...vIds, ...names,
        ).all()
      ).results
    : [];
  const byId = regId
    ? (await s(env, `SELECT id,country_code,official_entity_id FROM sanction_entries WHERE list_version_id IN (${ph(vIds)}) AND official_entity_id=?`, ...vIds, regId).all()).results
    : [];
  // Política T11 (2026-09-24): outra unidade com a mesma raiz de CNPJ vai para revisão humana; só o CNPJ exato bloqueia.
  // Registrado como match_method "substring" (prefixo do identificador; o CHECK da 0001 não tem valor próprio para raiz).
  const root = c.country_code === "BR" && /^\d{14}$/.test(regId || "") ? regId.slice(0, 8) : null;
  const byRoot = root
    ? (await s(env, `SELECT id,country_code,official_entity_id FROM sanction_entries WHERE list_version_id IN (${ph(vIds)}) AND substr(official_entity_id,1,8)=? AND official_entity_id<>?`, ...vIds, root, regId).all()).results
    : [];
  const hits = new Map();
  for (const e of byName) hits.set(e.id, { e, name: true });
  for (const e of byRoot) if (!hits.has(e.id)) hits.set(e.id, { e, root: true });
  for (const e of byId) hits.set(e.id, { e, name: hits.has(e.id), id: true });
  const runId = crypto.randomUUID(),
    at = now();
  const statements = [
    s(
      env,
      "INSERT INTO screening_runs(id,tenant_id,company_id,initiated_by,initiated_at,completed_at,status,query_json,source_versions_json) VALUES (?,?,?,?,?,?,'completed',?,?)",
      runId, actor.tenant_id, companyId, actor.id, at, at,
      JSON.stringify({ registrationId: c.registration_id, countryCode: c.country_code, legalName: c.legal_name }), JSON.stringify(versions),
    ),
  ];
  const summary = { block: 0, review: 0 };
  for (const { e, name, id, root: sameRoot } of hits.values()) {
    const countryCompatible = e.country_code ? e.country_code === c.country_code : null;
    const r = evaluateSanctionMatch({ reliableIdentifierMatch: !!id, countryCompatible: countryCompatible === true, nameMatch: !!name });
    const action = sameRoot && !id && !name ? "review" : r.action === "clear" ? "discard" : r.action;
    summary[action] = (summary[action] || 0) + 1;
    statements.push(
      s(
        env,
        "INSERT INTO screening_matches(id,tenant_id,screening_run_id,sanction_entry_id,match_method,similarity,country_compatible,reliable_identifier_match,recommended_action) VALUES (?,?,?,?,?,?,?,?,?)",
        crypto.randomUUID(), actor.tenant_id, runId, e.id, id ? "official_id_country" : sameRoot && !name ? "substring" : "exact_name", 1,
        countryCompatible === null ? null : countryCompatible ? 1 : 0, id ? 1 : 0, action,
      ),
    );
  }
  statements.push(auditStatement(env, actor, rid, "sanctions.screened", "company", companyId, { runId, matches: hits.size, ...summary }));
  await commit(env, statements);
  return { runId, matches: hits.size, ...summary };
}

// Decisão humana sobre um resultado (só admin; motivo obrigatório). Nome sozinho nunca bloqueia sem decisão.
export async function decideMatch(request, env, actor, rid, matchId) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const m = await s(env, "SELECT * FROM screening_matches WHERE tenant_id=? AND id=?", actor.tenant_id, matchId).first();
  if (!m) fail(404, "match_not_found", "Resultado de triagem não encontrado.");
  const decision = oneOf(i.decision, ["confirmed_block", "false_positive", "keep_reviewing", "integrity_alert"], "decisão");
  const reason = str(i.reason, "motivo", 1000);
  if (reason.length < 10) fail(422, "reason_required", "Descreva o fundamento da decisão.");
  const id = crypto.randomUUID();
  await commit(env, [
    s(env, "INSERT INTO screening_decisions(id,tenant_id,screening_match_id,decision,reason,decided_by,decided_at) VALUES (?,?,?,?,?,?,?)", id, actor.tenant_id, matchId, decision, reason, actor.id, now()),
    auditStatement(env, actor, rid, "sanctions.decided", "screening_match", matchId, { decision }),
  ]);
  return { id, decision };
}

export async function screeningView(env, actor, companyId) {
  await company(env, actor, companyId);
  const run = await s(env, "SELECT * FROM screening_runs WHERE tenant_id=? AND company_id=? ORDER BY initiated_at DESC,rowid DESC LIMIT 1", actor.tenant_id, companyId).first();
  if (!run) return { run: null, matches: [] };
  const matches = (
    await s(
      env,
      `SELECT sm.*,e.primary_name,e.country_code entry_country,e.program,src.name source_name,
        (SELECT decision FROM screening_decisions d WHERE d.screening_match_id=sm.id ORDER BY decided_at DESC,rowid DESC LIMIT 1) decision
       FROM screening_matches sm JOIN sanction_entries e ON e.id=sm.sanction_entry_id JOIN sanction_list_versions v ON v.id=e.list_version_id JOIN sanction_sources src ON src.id=v.source_id
       WHERE sm.tenant_id=? AND sm.screening_run_id=?`,
      actor.tenant_id, run.id,
    ).all()
  ).results;
  return { run, matches };
}

// Ativar/desativar fonte é decisão da política de compliance (T11): só admin, com motivo auditado.
export async function setSourceActive(request, env, actor, rid, sourceId) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  if (typeof i.active !== "boolean") fail(422, "invalid_field", "Informe active true/false.");
  const reason = str(i.reason, "motivo", 1000);
  if (reason.length < 10) fail(422, "reason_required", "Descreva o fundamento (política T11).");
  const r = await commit(env, [
    s(env, "UPDATE sanction_sources SET active=? WHERE id=?", i.active ? 1 : 0, sourceId),
    auditStatement(env, actor, rid, "sanctions.source_active", "sanction_source", sourceId, { active: i.active, reason }),
  ]);
  if (!r[0].meta.changes) fail(404, "source_not_found", "Fonte não encontrada.");
  return { id: sourceId, active: i.active };
}

export async function listSources(env) {
  return {
    items: (
      await s(
        env,
        "SELECT ss.*,(SELECT v.downloaded_at FROM sanction_list_versions v WHERE v.source_id=ss.id AND v.import_status='imported' ORDER BY v.downloaded_at DESC LIMIT 1) last_import FROM sanction_sources ss ORDER BY ss.source_key",
      ).all()
    ).results,
  };
}
