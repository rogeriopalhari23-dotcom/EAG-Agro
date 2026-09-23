// Setor usuário → CNAE (P2-T3, R28.2): lista revisada pelo Administrador; nenhuma linha é semeada.
import { bodyJson, fail, str, requireRole } from "./http.js";
import { statement as s, commit, auditStatement, now } from "./store.js";

const ADMIN = new Set(["admin"]);
export const sectorKey = (v) =>
  String(v)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export async function listSectors(env, actor) {
  const rows = (
    await s(env, "SELECT * FROM sector_cnae WHERE tenant_id=? ORDER BY sector_key,cnae_code", actor.tenant_id).all()
  ).results;
  return { items: rows };
}

export async function addSectorCnae(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request),
    key = sectorKey(str(i.sector, "setor usuário", 100)),
    cnae = str(i.cnaeCode, "CNAE", 12).replace(/\D/g, "");
  if (!key) fail(422, "invalid_field", "Campo inválido: setor usuário.");
  if (!/^\d{7}$/.test(cnae)) fail(422, "invalid_cnae", "CNAE (subclasse) tem 7 dígitos.");
  const label = str(i.label, "descrição da subclasse", 300),
    source = str(i.source, "fonte (URL da CONCLA/IBGE)", 500);
  await commit(env, [
    s(
      env,
      "INSERT INTO sector_cnae(tenant_id,sector_key,cnae_code,label,source,approved_by,approved_at) VALUES (?,?,?,?,?,?,?)",
      actor.tenant_id,
      key,
      cnae,
      label,
      source,
      actor.id,
      now(),
    ),
    auditStatement(env, actor, rid, "sector.cnae_added", "sector", key, { cnae, source }),
  ]);
  return { sectorKey: key, cnaeCode: cnae };
}

export async function removeSectorCnae(request, env, actor, rid, key, cnae) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request),
    reason = str(i.reason, "motivo", 500);
  if (reason.length < 5) fail(422, "reason_required", "Descreva o motivo.");
  const r = await commit(env, [
    s(env, "DELETE FROM sector_cnae WHERE tenant_id=? AND sector_key=? AND cnae_code=?", actor.tenant_id, key, cnae),
    s(
      env,
      "INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,new_value_json,request_id) SELECT ?,?,?,?,'sector.cnae_removed','sector',?,?,? WHERE changes()>0",
      crypto.randomUUID(),
      actor.tenant_id,
      actor.id,
      actor.role,
      key,
      JSON.stringify({ cnae, reason }),
      rid,
    ),
  ]);
  if (!r[0].meta.changes) fail(404, "sector_cnae_not_found", "Associação não encontrada.");
  return { removed: true };
}

// CNAEs dos setores do ICP; setor sem CNAE aprovado bloqueia a busca (R7.1.1), nunca vira "qualquer CNAE".
export async function cnaesForSectors(env, tenant, sectors) {
  const keys = [...new Set(sectors.map(sectorKey))];
  const rows = (
    await s(
      env,
      `SELECT sector_key,cnae_code FROM sector_cnae WHERE tenant_id=? AND sector_key IN (${keys.map(() => "?").join(",")})`,
      tenant,
      ...keys,
    ).all()
  ).results;
  const missing = keys.filter((k) => !rows.some((r) => r.sector_key === k));
  if (missing.length)
    fail(422, "sector_unmapped", "Setor sem CNAE aprovado. Cadastre a associação antes de buscar.", { sectors: missing });
  return [...new Set(rows.map((r) => r.cnae_code))].sort();
}
