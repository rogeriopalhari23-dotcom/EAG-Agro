import {
  bodyJson,
  fail,
  str,
  number,
  oneOf,
  date,
  page,
  requireRole,
  WRITE_ROLES,
  APPROVER_ROLES,
} from "./http.js";
import {
  statement as s,
  company,
  product,
  productUsable,
  parameters,
  requireParameter,
  commit,
  auditStatement,
  now,
} from "./store.js";
import { identifierHash } from "./crypto.js";
import { validateParameter, crossCheck } from "./parameter-registry.js";
import { invalidationStatements } from "./fichas.js";
export async function setParameter(request, env, actor, rid, key) {
  requireRole(actor, new Set(["admin"]));
  const i = await bodyJson(request),
    scope = str(i.scope, "escopo", 120),
    reason = str(i.reason, "motivo", 1000);
  if (reason.length < 5)
    fail(422, "reason_required", "Descreva o motivo da alteração.");
  const current = await parameters(env, actor.tenant_id);
  i.value = validateParameter(key, scope, i.value, current);
  crossCheck(key, scope, i.value, current);
  if (key === "volume_min") {
    const found = await s(
      env,
      "SELECT id FROM products WHERE tenant_id=? AND commodity=? AND active=1 AND identity_status=?",
      actor.tenant_id,
      scope.split(":")[0],
      "confirmed",
    ).first();
    if (!found) fail(422, "invalid_scope", "Commodity inválida.");
  }
  const rows = await s(
    env,
    "SELECT * FROM parameters WHERE tenant_id=? AND parameter_key=? AND scope_key=? ORDER BY effective_from DESC,rowid DESC LIMIT 1",
    actor.tenant_id,
    key,
    scope,
  ).all();
  const prev = rows.results[0];
  const rev = (
    await s(
      env,
      "SELECT parameter_revision FROM tenants WHERE id=?",
      actor.tenant_id,
    ).first()
  ).parameter_revision;
  let at = now();
  if (prev && prev.effective_from >= at)
    at = new Date(Date.parse(prev.effective_from) + 1).toISOString();
  if (i.effectiveFrom)
    fail(
      422,
      "scheduled_parameter_unsupported",
      "Esta versão aplica a alteração imediatamente.",
    );
  const id = crypto.randomUUID();
  await commit(env, [
    s(
      env,
      "UPDATE tenants SET parameter_revision=CASE WHEN parameter_revision=? THEN parameter_revision ELSE -1 END WHERE id=?",
      rev,
      actor.tenant_id,
    ),
    s(
      env,
      "UPDATE parameters SET effective_to=? WHERE tenant_id=? AND parameter_key=? AND scope_key=? AND effective_to IS NULL",
      at,
      actor.tenant_id,
      key,
      scope,
    ),
    s(
      env,
      "INSERT INTO parameters(id,tenant_id,parameter_key,scope_key,value_json,effective_from,changed_by,change_reason) VALUES (?,?,?,?,?,?,?,?)",
      id,
      actor.tenant_id,
      key,
      scope,
      JSON.stringify(i.value),
      at,
      actor.id,
      reason,
    ),
    auditStatement(env, actor, rid, "parameter.changed", "parameter", id, {
      key,
      scope,
      oldValue: prev ? JSON.parse(prev.value_json) : null,
      newValue: i.value,
    }),
  ]);
  return { id, effectiveFrom: at };
}
export async function listRecords(request, env, actor, table) {
  const { limit, offset } = page(request);
  const rows = await s(
    env,
    `SELECT * FROM ${table} WHERE tenant_id=? ORDER BY rowid DESC LIMIT ? OFFSET ?`,
    actor.tenant_id,
    limit + 1,
    offset,
  ).all();
  return {
    items: rows.results.slice(0, limit),
    limit,
    offset,
    nextOffset: rows.results.length > limit ? offset + limit : null,
  };
}
async function campaign(env, actor, id) {
  const c = await s(
    env,
    "SELECT * FROM campaigns WHERE tenant_id=? AND id=?",
    actor.tenant_id,
    id,
  ).first();
  if (!c) fail(404, "campaign_not_found", "Campanha não encontrada.");
  return c;
}
export async function getCampaign(env, actor, id) {
  const c = await campaign(env, actor, id);
  const [icp, declarations] = await env.DB.batch([
    s(env, "SELECT * FROM campaign_icp WHERE campaign_id=?", id),
    s(
      env,
      "SELECT * FROM campaign_declarations WHERE campaign_id=? AND status='approved' AND (review_due_at IS NULL OR review_due_at>?)",
      id,
      now(),
    ),
  ]);
  return {
    campaign: c,
    icp: icp.results[0] || null,
    declarations: declarations.results,
  };
}
export async function createCampaign(request, env, actor, rid) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request),
    p = await product(env, actor.tenant_id, str(i.productId, "produto", 80));
  productUsable(p);
  const market = oneOf(i.market, ["national", "international"], "mercado"),
    name = str(i.name, "nome", 200),
    id = crypto.randomUUID();
  let city = null,
    uf = null,
    radius = null,
    country = null;
  if (market === "national") {
    city = str(i.originCity, "cidade de origem", 120);
    uf = str(i.originUf, "UF", 2).toUpperCase();
    if (
      ![
        "AC",
        "AL",
        "AP",
        "AM",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MT",
        "MS",
        "MG",
        "PA",
        "PB",
        "PR",
        "PE",
        "PI",
        "RJ",
        "RN",
        "RS",
        "RO",
        "RR",
        "SC",
        "SP",
        "SE",
        "TO",
      ].includes(uf)
    )
      fail(422, "invalid_uf", "UF inválida.");
    const params = await parameters(env, actor.tenant_id);
    radius =
      i.radiusKm ?? requireParameter(params, "radius_default_km:national");
    if (
      !requireParameter(params, "radius_allowed_km:national").includes(radius)
    )
      fail(
        422,
        "radius_not_allowed",
        "Raio permitido: 5 ou múltiplos de 100 até 1.500 km.",
      );
  } else {
    country = str(i.countryCode, "país", 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(country) || country === "BR")
      fail(422, "invalid_country", "Informe país estrangeiro com duas letras.");
  }
  const icp = icpValues(i.icp);
  await commit(env, [
    s(
      env,
      `INSERT INTO campaigns(id,tenant_id,product_id,market,name,origin_city,origin_uf,radius_km,country_code,language,review_due_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      actor.tenant_id,
      p.id,
      market,
      name,
      city,
      uf,
      radius,
      country,
      market === "national" ? "pt-BR" : "en",
      date(i.reviewDueAt, "revisão", { optional: true, future: true }),
      actor.id,
    ),
    s(
      env,
      `INSERT INTO campaign_icp(campaign_id,user_sectors_json,size_target,region,decision_role,influencer_role,supply_pains,buying_cycle_days,updated_by) VALUES (?,?,?,?,?,?,?,?,?)`,
      id,
      ...icp,
      actor.id,
    ),
    auditStatement(env, actor, rid, "campaign.created", "campaign", id, {
      market,
      productId: p.id,
    }),
  ]);
  return { id, version: 1, status: "draft" };
}
// ICP da campanha (K1): setores usuários, porte médio/média-mais, região e papéis de decisão.
function icpValues(icp) {
  if (
    !icp ||
    typeof icp !== "object" ||
    !Array.isArray(icp.userSectors) ||
    icp.userSectors.length < 1 ||
    icp.userSectors.length > 20
  )
    fail(422, "icp_required", "Preencha o perfil de cliente da campanha.");
  return [
    JSON.stringify(icp.userSectors.map((v) => str(v, "setor usuário", 100))),
    oneOf(icp.sizeTarget, ["medium", "medium_plus"], "porte"),
    str(icp.region, "região", 200),
    str(icp.decisionRole, "decisor", 200),
    str(icp.influencerRole, "influenciador", 200),
    str(icp.supplyPains, "dor", 500, true),
    icp.buyingCycleDays == null
      ? null
      : number(icp.buyingCycleDays, "ciclo", 1, 3650),
  ];
}
const ICP_COLUMNS = [
  "user_sectors_json",
  "size_target",
  "region",
  "decision_role",
  "influencer_role",
  "supply_pains",
  "buying_cycle_days",
];
// Edição versionada: a campanha sobe de versão e a auditoria guarda o ICP anterior e o novo.
export async function updateIcp(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const c = await campaign(env, actor, id),
    i = await bodyJson(request);
  if (i.expectedVersion !== c.version)
    fail(409, "edit_conflict", "Recarregue a campanha antes de alterar.");
  if (c.status === "ended")
    fail(409, "campaign_ended", "Campanha encerrada não muda de perfil.");
  const before = await s(env, "SELECT * FROM campaign_icp WHERE campaign_id=?", id).first();
  const values = icpValues(i.icp);
  await commit(env, [
    s(
      env,
      "UPDATE campaigns SET version=CASE WHEN version=? THEN version+1 ELSE -1 END,updated_at=? WHERE tenant_id=? AND id=?",
      c.version,
      now(),
      actor.tenant_id,
      id,
    ),
    s(
      env,
      `INSERT INTO campaign_icp(campaign_id,${ICP_COLUMNS.join(",")},updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id) DO UPDATE SET ${ICP_COLUMNS.map((k) => `${k}=excluded.${k}`).join(",")},updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
      id,
      ...values,
      actor.id,
      now(),
    ),
    ...invalidationStatements(env, { campaignId: id }, "ICP da campanha alterado"),
    auditStatement(env, actor, rid, "campaign.icp_updated", "campaign", id, {
      version: c.version + 1,
      before: before
        ? Object.fromEntries(ICP_COLUMNS.map((k) => [k, before[k]]))
        : null,
      after: Object.fromEntries(ICP_COLUMNS.map((k, n) => [k, values[n]])),
    }),
  ]);
  return { id, version: c.version + 1 };
}
export async function revokeDeclaration(request, env, actor, rid, id, declId) {
  requireRole(actor, APPROVER_ROLES);
  const c = await campaign(env, actor, id),
    i = await bodyJson(request);
  if (i.expectedVersion !== c.version)
    fail(409, "edit_conflict", "Recarregue a campanha.");
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 5) fail(422, "reason_required", "Descreva o motivo.");
  const d = await s(
    env,
    "SELECT * FROM campaign_declarations WHERE id=? AND campaign_id=?",
    declId,
    id,
  ).first();
  if (!d) fail(404, "declaration_not_found", "Declaração não encontrada.");
  if (d.status !== "approved")
    fail(409, "declaration_revoked", "Declaração já revogada.");
  await commit(env, [
    s(
      env,
      "UPDATE campaigns SET version=CASE WHEN version=? THEN version+1 ELSE -1 END,updated_at=? WHERE tenant_id=? AND id=?",
      c.version,
      now(),
      actor.tenant_id,
      id,
    ),
    s(
      env,
      "UPDATE campaign_declarations SET status='revoked' WHERE id=? AND campaign_id=? AND status='approved'",
      declId,
      id,
    ),
    ...invalidationStatements(env, { campaignId: id }, "declaração revogada"),
    auditStatement(env, actor, rid, "campaign.declaration_revoked", "campaign", id, {
      declarationId: declId,
      kind: d.kind,
      reason,
    }),
  ]);
  return { id: declId, revoked: true, version: c.version + 1 };
}
export async function listDeclarations(env, actor, id) {
  await campaign(env, actor, id);
  return {
    items: (
      await s(
        env,
        "SELECT * FROM campaign_declarations WHERE campaign_id=? ORDER BY approved_at DESC,rowid DESC",
        id,
      ).all()
    ).results,
  };
}
export async function changeCampaign(
  request,
  env,
  actor,
  rid,
  id,
  activate = false,
) {
  requireRole(actor, activate ? APPROVER_ROLES : WRITE_ROLES);
  const c = await campaign(env, actor, id),
    i = await bodyJson(request);
  if (i.expectedVersion !== c.version)
    fail(409, "edit_conflict", "Recarregue a campanha antes de alterar.");
  const p = await product(env, actor.tenant_id, c.product_id);
  productUsable(p);
  if (activate) {
    if (c.review_due_at && Date.parse(c.review_due_at) <= Date.now())
      fail(409, "review_due", "Revise a campanha antes de ativar.");
    const icp = await s(
      env,
      "SELECT campaign_id FROM campaign_icp WHERE campaign_id=?",
      id,
    ).first();
    if (!icp) fail(422, "icp_required", "ICP obrigatório.");
    // Count commodities (not variants), within the same market; decision runs atomically in SQLite.
    await commit(env, [
      s(
        env,
        `UPDATE campaigns SET status=CASE WHEN EXISTS(SELECT 1 FROM campaigns c2 JOIN products p2 ON p2.id=c2.product_id WHERE c2.tenant_id=? AND c2.market=? AND c2.status='active' AND p2.commodity=?) OR (SELECT COUNT(DISTINCT p2.commodity) FROM campaigns c2 JOIN products p2 ON p2.id=c2.product_id WHERE c2.tenant_id=? AND c2.market=? AND c2.status='active')<2 THEN 'active' ELSE 'waiting' END, version=CASE WHEN version=? THEN version+1 ELSE -1 END,updated_at=? WHERE tenant_id=? AND id=?`,
        actor.tenant_id,
        c.market,
        p.commodity,
        actor.tenant_id,
        c.market,
        c.version,
        now(),
        actor.tenant_id,
        id,
      ),
      auditStatement(
        env,
        actor,
        rid,
        "campaign.activation_requested",
        "campaign",
        id,
      ),
    ]);
  } else {
    const status = i.status
      ? oneOf(i.status, ["draft", "paused", "ended"], "status")
      : c.status;
    const name = i.name === undefined ? c.name : str(i.name, "nome", 200),
      review =
        i.reviewDueAt === undefined
          ? c.review_due_at
          : date(i.reviewDueAt, "revisão", { optional: true, future: true });
    await commit(env, [
      s(
        env,
        "UPDATE campaigns SET name=?,status=?,review_due_at=?,version=CASE WHEN version=? THEN version+1 ELSE -1 END,updated_at=? WHERE tenant_id=? AND id=?",
        name,
        status,
        review,
        c.version,
        now(),
        actor.tenant_id,
        id,
      ),
      auditStatement(env, actor, rid, "campaign.updated", "campaign", id, {
        status,
      }),
    ]);
  }
  return { campaign: await campaign(env, actor, id) };
}
export async function addDeclaration(request, env, actor, rid, id) {
  requireRole(actor, APPROVER_ROLES);
  const c = await campaign(env, actor, id),
    i = await bodyJson(request),
    kind = oneOf(i.kind, ["volume_available", "social_proof"], "declaração");
  if (i.expectedVersion !== c.version)
    fail(409, "edit_conflict", "Recarregue a campanha.");
  const bool = kind === "volume_available" ? i.valueBool : null;
  if (kind === "volume_available" && typeof bool !== "boolean")
    fail(
      422,
      "invalid_boolean",
      "Informe volume disponível confirmado: true/false.",
    );
  const text =
      kind === "social_proof"
        ? str(i.text, "prova social aprovada", 500)
        : null,
    declId = crypto.randomUUID();
  await commit(env, [
    s(
      env,
      "UPDATE campaigns SET version=CASE WHEN version=? THEN version+1 ELSE -1 END WHERE tenant_id=? AND id=?",
      c.version,
      actor.tenant_id,
      id,
    ),
    s(
      env,
      "UPDATE campaign_declarations SET status='revoked' WHERE campaign_id=? AND kind=? AND status='approved'",
      id,
      kind,
    ),
    s(
      env,
      "INSERT INTO campaign_declarations(id,campaign_id,kind,value_bool,text,approved_by,approved_at,review_due_at) VALUES (?,?,?,?,?,?,?,?)",
      declId,
      id,
      kind,
      bool === null ? null : Number(bool),
      text,
      actor.id,
      now(),
      date(i.reviewDueAt, "validade", { optional: true, future: true }),
    ),
    ...invalidationStatements(env, { campaignId: id }, "declaração alterada"),
    auditStatement(env, actor, rid, "campaign.declaration", "campaign", id, {
      kind,
      declarationId: declId,
    }),
  ]);
  return { id: declId, version: c.version + 1 };
}
export async function suppress(request, env, actor, rid) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request),
    channel = oneOf(i.channel, ["email", "phone", "linkedin"], "canal"),
    value = str(i.value, "identificador", 320),
    hash = await identifierHash(env, actor.tenant_id, channel, value),
    id = crypto.randomUUID();
  // Motivos enumerados evitam que o identificador seja repetido no texto ou na auditoria.
  const reason = oneOf(
    i.reason,
    ["opt_out", "hard_bounce", "manual_request", "legacy_import"],
    "motivo",
  );
  const result = await commit(env, [
    s(
      env,
      "INSERT INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,identifier_hash,channel) DO NOTHING",
      id,
      actor.tenant_id,
      hash,
      channel,
      reason,
      "manual",
      actor.id,
    ),
    s(
      env,
      `INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,new_value_json,request_id) SELECT ?,?,?,?,'suppression.added','suppression',?,?,? WHERE changes()>0`,
      crypto.randomUUID(),
      actor.tenant_id,
      actor.id,
      actor.role,
      id,
      JSON.stringify({ channel, reason }),
      rid,
    ),
  ]);
  const saved = await s(
    env,
    "SELECT id FROM suppression_entries WHERE tenant_id=? AND identifier_hash=? AND channel=?",
    actor.tenant_id,
    hash,
    channel,
  ).first();
  return { id: saved.id, created: !!result[0].meta.changes };
}
export async function isSuppressed(env, tenant, channel, value) {
  const hash = await identifierHash(env, tenant, channel, value);
  return !!(await s(
    env,
    "SELECT id FROM suppression_entries WHERE tenant_id=? AND identifier_hash=? AND channel=?",
    tenant,
    hash,
    channel,
  ).first());
}
export async function listSuppression(request, env, actor) {
  requireRole(actor, new Set(["admin"]));
  const result = await listRecords(request, env, actor, "suppression_entries");
  result.items = result.items.map((r) => ({
    ...r,
    identifier_hash: `hmac:${r.identifier_hash.slice(0, 4)}…${r.identifier_hash.slice(-4)}`,
  }));
  return result;
}
export async function createPause(request, env, actor, rid) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request),
    scope = oneOf(
      i.scope,
      ["company", "campaign", "commodity", "operation"],
      "escopo",
    );
  let ref = null;
  if (scope === "operation") requireRole(actor, APPROVER_ROLES);
  else ref = str(i.scopeRef, "referência", 80);
  if (scope === "company") await company(env, actor, ref);
  if (scope === "campaign") await campaign(env, actor, ref);
  if (
    scope === "commodity" &&
    !(await s(
      env,
      "SELECT id FROM products WHERE tenant_id=? AND commodity=?",
      actor.tenant_id,
      ref,
    ).first())
  )
    fail(404, "commodity_not_found", "Commodity não encontrada.");
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 5) fail(422, "reason_required", "Descreva o motivo.");
  const id = crypto.randomUUID();
  await commit(env, [
    s(
      env,
      "INSERT INTO pauses(id,tenant_id,scope,scope_ref,reason,created_by) VALUES (?,?,?,?,?,?)",
      id,
      actor.tenant_id,
      scope,
      ref,
      reason,
      actor.id,
    ),
    auditStatement(env, actor, rid, "pause.created", "pause", id, {
      scope,
      scopeRef: ref,
    }),
  ]);
  return { id };
}
export async function resumePause(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const p = await s(
    env,
    "SELECT * FROM pauses WHERE tenant_id=? AND id=?",
    actor.tenant_id,
    id,
  ).first();
  if (!p) fail(404, "pause_not_found", "Pausa não encontrada.");
  if (p.scope === "operation") requireRole(actor, APPROVER_ROLES);
  if (p.resumed_at) fail(409, "pause_resumed", "Pausa já retomada.");
  const i = await bodyJson(request),
    reason = str(i.reason, "motivo", 500);
  if (reason.length < 5) fail(422, "reason_required", "Descreva o motivo.");
  const result = await commit(env, [
    s(
      env,
      "UPDATE pauses SET resumed_by=?,resumed_at=?,resume_reason=? WHERE id=? AND tenant_id=? AND resumed_at IS NULL",
      actor.id,
      now(),
      reason,
      id,
      actor.tenant_id,
    ),
    s(
      env,
      `INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,request_id) SELECT ?,?,?,?,'pause.resumed','pause',?,? WHERE changes()>0`,
      crypto.randomUUID(),
      actor.tenant_id,
      actor.id,
      actor.role,
      id,
      rid,
    ),
  ]);
  if (!result[0].meta.changes) fail(409, "pause_resumed", "Pausa já retomada.");
  return { id, resumed: true };
}
