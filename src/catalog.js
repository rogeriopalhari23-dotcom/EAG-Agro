import {
  bodyJson,
  fail,
  str,
  oneOf,
  requireRole,
} from "./http.js";
import {
  statement as s,
  product,
  commit,
  auditStatement,
  now,
} from "./store.js";

const ADMIN = new Set(["admin"]);
export const ORIGINS = ["SITE", "SOLICITACAO", "PORTFOLIO"];
const COMMODITY = /^[a-z][a-z0-9_]{1,39}$/;
const CODE_FORMAT = { NCM: /^\d{8}$/, HS: /^\d{4}(?:\d{2})?$/ };

// R10.6 + errata: só característica confirmada e fora do escopo de amostra pode ser citada.
export function mentionableCharacteristics(rows) {
  return rows.filter((r) => r.status === "confirmed" && !r.sample_only);
}

export async function catalog(env, actor, id) {
  if (id) {
    const p = await product(env, actor.tenant_id, id);
    const [codes, characteristics] = await env.DB.batch([
      s(env, "SELECT * FROM product_codes WHERE product_id=? ORDER BY code_system,code", id),
      s(env, "SELECT * FROM product_characteristics WHERE product_id=? ORDER BY char_key,sample_only", id),
    ]);
    return {
      ...p,
      codes: codes.results,
      characteristics: characteristics.results,
    };
  }
  return {
    products: (
      await s(
        env,
        "SELECT * FROM products WHERE tenant_id=? ORDER BY id",
        actor.tenant_id,
      ).all()
    ).results,
  };
}

function reasonOf(i) {
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 5)
    fail(422, "reason_required", "Descreva o motivo da alteração.");
  return reason;
}

function origins(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3)
    fail(422, "invalid_origins", "Informe de 1 a 3 origens.", { allowed: ORIGINS });
  const list = [...new Set(value.map((v) => oneOf(v, ORIGINS, "origem")))];
  return JSON.stringify(list);
}

// Trava otimista: se a revisão mudou, o UPDATE força -1 e o CHECK revision>=1 aborta o lote.
function productLock(env, actor, p, expected) {
  if (expected !== p.revision)
    fail(409, "edit_conflict", "Recarregue o produto antes de alterar.");
  return s(
    env,
    "UPDATE products SET revision=CASE WHEN revision=? THEN revision+1 ELSE -1 END,updated_by=?,updated_at=? WHERE tenant_id=? AND id=?",
    p.revision,
    actor.id,
    now(),
    actor.tenant_id,
    p.id,
  );
}

async function save(env, statements) {
  try {
    return await commit(env, statements);
  } catch (error) {
    const m = String(error?.message || error);
    if (m.includes("product_code_source_required"))
      fail(422, "code_source_required", "Código confirmado exige fonte e versão da classificação.");
    if (m.includes("product_source_required"))
      fail(422, "product_source_required", "Identidade confirmada exige referência de origem.");
    throw error;
  }
}

export async function createProduct(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const commodity = str(i.commodity, "commodity", 40);
  if (!COMMODITY.test(commodity))
    fail(422, "invalid_commodity", "Use identificador em minúsculas, ex.: soy_meal.");
  const identity = oneOf(i.identityStatus ?? "pending", ["confirmed", "pending"], "identidade");
  const sourceRef = str(i.sourceRef, "referência", 500, identity === "pending");
  const id = crypto.randomUUID();
  await save(env, [
    s(
      env,
      "INSERT INTO products(id,tenant_id,commodity,group_name,variant_name,origins_json,source_ref,consulted_at,identity_status,active,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)",
      id,
      actor.tenant_id,
      commodity,
      str(i.groupName, "grupo", 120),
      str(i.variantName, "variante", 200),
      origins(i.origins),
      sourceRef,
      sourceRef ? now().slice(0, 10) : null,
      identity,
      actor.id,
      now(),
    ),
    auditStatement(env, actor, rid, "catalog.product_created", "product", id, {
      commodity,
      identity,
      reason: reasonOf(i),
    }),
  ]);
  return { id, revision: 1, identityStatus: identity };
}

export async function updateProduct(request, env, actor, rid, id) {
  requireRole(actor, ADMIN);
  const p = await product(env, actor.tenant_id, id),
    i = await bodyJson(request),
    reason = reasonOf(i);
  if (i.commodity !== undefined && i.commodity !== p.commodity) {
    const used = await s(
      env,
      "SELECT 1 FROM campaigns WHERE tenant_id=? AND product_id=? UNION ALL SELECT 1 FROM demands WHERE tenant_id=? AND product_id=? LIMIT 1",
      actor.tenant_id,
      id,
      actor.tenant_id,
      id,
    ).first();
    if (used)
      fail(409, "commodity_in_use", "Produto já usado em campanha ou demanda; crie um produto novo.");
  }
  const next = {
    commodity: i.commodity === undefined ? p.commodity : str(i.commodity, "commodity", 40),
    group_name: i.groupName === undefined ? p.group_name : str(i.groupName, "grupo", 120),
    variant_name: i.variantName === undefined ? p.variant_name : str(i.variantName, "variante", 200),
    origins_json: i.origins === undefined ? p.origins_json : origins(i.origins),
    source_ref: i.sourceRef === undefined ? p.source_ref : str(i.sourceRef, "referência", 500, true),
    identity_status: i.identityStatus === undefined ? p.identity_status : oneOf(i.identityStatus, ["confirmed", "pending"], "identidade"),
    active: i.active === undefined ? p.active : i.active === true ? 1 : i.active === false ? 0 : fail(422, "invalid_field", "Campo inválido: ativo."),
  };
  if (!COMMODITY.test(next.commodity))
    fail(422, "invalid_commodity", "Use identificador em minúsculas, ex.: soy_meal.");
  const consulted = i.sourceRef !== undefined && next.source_ref ? now().slice(0, 10) : p.consulted_at;
  await save(env, [
    productLock(env, actor, p, i.expectedRevision),
    s(
      env,
      "UPDATE products SET commodity=?,group_name=?,variant_name=?,origins_json=?,source_ref=?,consulted_at=?,identity_status=?,active=? WHERE tenant_id=? AND id=?",
      next.commodity,
      next.group_name,
      next.variant_name,
      next.origins_json,
      next.source_ref,
      consulted,
      next.identity_status,
      next.active,
      actor.tenant_id,
      id,
    ),
    auditStatement(env, actor, rid, "catalog.product_updated", "product", id, {
      before: {
        identity: p.identity_status,
        active: p.active,
        commodity: p.commodity,
      },
      after: {
        identity: next.identity_status,
        active: next.active,
        commodity: next.commodity,
      },
      reason,
    }),
  ]);
  return { id, revision: p.revision + 1 };
}

function codeFields(i, current = {}) {
  const system = current.code_system ?? oneOf(i.codeSystem, ["NCM", "HS"], "sistema");
  const code = current.code ?? str(i.code, "código", 14).replace(/\D/g, "");
  if (!CODE_FORMAT[system].test(code))
    fail(422, "invalid_code", system === "NCM" ? "NCM tem 8 dígitos." : "HS tem 4 ou 6 dígitos.");
  const status = i.status === undefined ? current.status ?? "pending" : oneOf(i.status, ["confirmed", "pending"], "estado");
  const version = i.classificationVersion === undefined ? current.classification_version ?? null : str(i.classificationVersion, "versão da classificação", 80, true);
  const source = i.sourceRef === undefined ? current.source_ref ?? null : str(i.sourceRef, "fonte", 500, true);
  if (status === "confirmed" && (!source || !version))
    fail(422, "code_source_required", "Código confirmado exige fonte e versão da classificação.");
  return { system, code, status, version, source };
}

export async function addCode(request, env, actor, rid, id) {
  requireRole(actor, ADMIN);
  const p = await product(env, actor.tenant_id, id),
    i = await bodyJson(request),
    reason = reasonOf(i),
    f = codeFields(i),
    codeId = crypto.randomUUID();
  await save(env, [
    productLock(env, actor, p, i.expectedRevision),
    s(
      env,
      "INSERT INTO product_codes(id,product_id,code_system,code,classification_version,status,source_ref,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      codeId,
      id,
      f.system,
      f.code,
      f.version,
      f.status,
      f.source,
      actor.id,
      now(),
    ),
    auditStatement(env, actor, rid, "catalog.code_added", "product", id, {
      codeId,
      system: f.system,
      code: f.code,
      status: f.status,
      reason,
    }),
  ]);
  return { id: codeId, revision: p.revision + 1 };
}

export async function updateCode(request, env, actor, rid, id, codeId) {
  requireRole(actor, ADMIN);
  const p = await product(env, actor.tenant_id, id),
    i = await bodyJson(request),
    reason = reasonOf(i),
    current = await s(env, "SELECT * FROM product_codes WHERE id=? AND product_id=?", codeId, id).first();
  if (!current) fail(404, "code_not_found", "Código não encontrado.");
  if (i.codeSystem !== undefined || i.code !== undefined)
    fail(422, "code_immutable", "Para outro código, cadastre um novo e remova o anterior.");
  const f = codeFields(i, current);
  await save(env, [
    productLock(env, actor, p, i.expectedRevision),
    s(
      env,
      "UPDATE product_codes SET classification_version=?,status=?,source_ref=?,updated_by=?,updated_at=? WHERE id=? AND product_id=?",
      f.version,
      f.status,
      f.source,
      actor.id,
      now(),
      codeId,
      id,
    ),
    auditStatement(env, actor, rid, "catalog.code_updated", "product", id, {
      codeId,
      before: current.status,
      after: f.status,
      reason,
    }),
  ]);
  return { id: codeId, revision: p.revision + 1 };
}

export async function removeCode(request, env, actor, rid, id, codeId) {
  requireRole(actor, ADMIN);
  const p = await product(env, actor.tenant_id, id),
    i = await bodyJson(request),
    reason = reasonOf(i),
    current = await s(env, "SELECT * FROM product_codes WHERE id=? AND product_id=?", codeId, id).first();
  if (!current) fail(404, "code_not_found", "Código não encontrado.");
  await save(env, [
    productLock(env, actor, p, i.expectedRevision),
    s(env, "DELETE FROM product_codes WHERE id=? AND product_id=?", codeId, id),
    auditStatement(env, actor, rid, "catalog.code_removed", "product", id, {
      codeId,
      system: current.code_system,
      code: current.code,
      status: current.status,
      reason,
    }),
  ]);
  return { id: codeId, removed: true, revision: p.revision + 1 };
}

function characteristicFields(i, current = {}) {
  const key = current.char_key ?? str(i.key, "característica", 80);
  const value = i.value === undefined ? current.char_value : str(i.value, "valor", 1000);
  const source = i.sourceRef === undefined ? current.source_ref : str(i.sourceRef, "fonte", 500);
  const status = i.status === undefined ? current.status : oneOf(i.status, ["confirmed", "not_confirmed"], "estado");
  let sample = current.sample_only;
  if (i.sampleOnly !== undefined) {
    if (typeof i.sampleOnly !== "boolean") fail(422, "invalid_field", "Campo inválido: só amostra.");
    sample = i.sampleOnly ? 1 : 0;
  }
  if (!value || !source || !status || sample === undefined)
    fail(422, "invalid_characteristic", "Informe valor, fonte, estado e se vale só para a amostra.");
  return { key, value, source, status, sample };
}

export async function addCharacteristic(request, env, actor, rid, id) {
  requireRole(actor, ADMIN);
  const p = await product(env, actor.tenant_id, id),
    i = await bodyJson(request),
    reason = reasonOf(i),
    f = characteristicFields(i),
    charId = crypto.randomUUID();
  await save(env, [
    productLock(env, actor, p, i.expectedRevision),
    s(
      env,
      "INSERT INTO product_characteristics(id,product_id,char_key,char_value,source_ref,status,sample_only,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      charId,
      id,
      f.key,
      f.value,
      f.source,
      f.status,
      f.sample,
      actor.id,
      now(),
    ),
    auditStatement(env, actor, rid, "catalog.characteristic_added", "product", id, {
      characteristicId: charId,
      key: f.key,
      status: f.status,
      sampleOnly: !!f.sample,
      reason,
    }),
  ]);
  return { id: charId, revision: p.revision + 1 };
}

export async function updateCharacteristic(request, env, actor, rid, id, charId) {
  requireRole(actor, ADMIN);
  const p = await product(env, actor.tenant_id, id),
    i = await bodyJson(request),
    reason = reasonOf(i),
    current = await s(env, "SELECT * FROM product_characteristics WHERE id=? AND product_id=?", charId, id).first();
  if (!current) fail(404, "characteristic_not_found", "Característica não encontrada.");
  if (i.key !== undefined && i.key !== current.char_key)
    fail(422, "characteristic_key_immutable", "Para outra característica, cadastre uma nova.");
  const f = characteristicFields(i, current);
  await save(env, [
    productLock(env, actor, p, i.expectedRevision),
    s(
      env,
      "UPDATE product_characteristics SET char_value=?,source_ref=?,status=?,sample_only=?,updated_by=?,updated_at=? WHERE id=? AND product_id=?",
      f.value,
      f.source,
      f.status,
      f.sample,
      actor.id,
      now(),
      charId,
      id,
    ),
    auditStatement(env, actor, rid, "catalog.characteristic_updated", "product", id, {
      characteristicId: charId,
      before: { status: current.status, sampleOnly: !!current.sample_only },
      after: { status: f.status, sampleOnly: !!f.sample },
      reason,
    }),
  ]);
  return { id: charId, revision: p.revision + 1 };
}
