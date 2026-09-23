import { fail } from "./http.js";
export const now = () => new Date().toISOString();
export const statement = (env, sql, ...args) =>
  env.DB.prepare(sql).bind(...args);
export async function company(env, actor, id) {
  const row = await statement(
    env,
    "SELECT * FROM companies WHERE tenant_id=? AND id=?",
    actor.tenant_id,
    id,
  ).first();
  if (!row) fail(404, "company_not_found", "Empresa não encontrada.");
  return row;
}
export function auditStatement(
  env,
  actor,
  requestId,
  action,
  type,
  id,
  metadata = {},
) {
  return statement(
    env,
    `INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,new_value_json,request_id) VALUES (?,?,?,?,?,?,?,?,?)`,
    crypto.randomUUID(),
    actor.tenant_id,
    actor.id,
    actor.role,
    action,
    type,
    id,
    JSON.stringify(metadata),
    requestId,
  );
}
export function companyLock(env, actor, c) {
  return statement(
    env,
    "UPDATE companies SET revision=CASE WHEN revision=? THEN revision+1 ELSE -1 END,updated_at=? WHERE tenant_id=? AND id=?",
    c.revision,
    now(),
    actor.tenant_id,
    c.id,
  );
}
export async function commit(env, statements) {
  try {
    return await env.DB.batch(statements);
  } catch (error) {
    const message = String(error);
    if (
      message.includes("revision >= 1") ||
      message.includes("approval_revision >= 1") ||
      message.includes("version >= 1")
    )
      fail(
        409,
        "edit_conflict",
        "Dados alterados por outra pessoa. Recarregue antes de salvar.",
      );
    if (
      message.includes("UNIQUE constraint") ||
      message.includes("company_identifier_duplicate")
    )
      fail(
        409,
        "duplicate",
        "Registro duplicado ou alterado por outra pessoa.",
      );
    throw error;
  }
}
export async function parameters(env, tenant, at = now()) {
  const result = await statement(
    env,
    `SELECT parameter_key,scope_key,value_json FROM (SELECT p.*,ROW_NUMBER() OVER(PARTITION BY parameter_key,scope_key ORDER BY effective_from DESC,rowid DESC) rank FROM parameters p WHERE tenant_id=? AND effective_from<=? AND (effective_to IS NULL OR effective_to>?)) WHERE rank=1`,
    tenant,
    at,
    at,
  ).all();
  return Object.fromEntries(
    result.results.map((r) => [
      `${r.parameter_key}:${r.scope_key}`,
      JSON.parse(r.value_json),
    ]),
  );
}
export function requireParameter(p, key) {
  if (!Object.hasOwn(p, key))
    fail(409, "parameter_missing", `Parâmetro sem valor aprovado: ${key}.`);
  return p[key];
}
export async function product(env, tenant, id) {
  const row = await statement(
    env,
    "SELECT * FROM products WHERE tenant_id=? AND id=?",
    tenant,
    id,
  ).first();
  if (!row) fail(404, "product_not_found", "Produto não encontrado.");
  return row;
}
export function productUsable(p) {
  if (!p.active || p.identity_status !== "confirmed")
    fail(
      422,
      "product_identity_pending",
      "Confirme a identidade do produto antes de utilizá-lo.",
    );
}
export const parse = (row) => (row == null ? null : JSON.parse(row));
