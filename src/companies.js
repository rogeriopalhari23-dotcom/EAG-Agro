import {
  bodyJson,
  fail,
  str,
  oneOf,
  number,
  date,
  url,
  page,
  requireRole,
  WRITE_ROLES,
  APPROVER_ROLES,
} from "./http.js";
import {
  statement as s,
  company,
  auditStatement,
  companyLock,
  commit,
  product,
  productUsable,
  now,
} from "./store.js";
import { encryptPii, decryptPii, identifierHash } from "./crypto.js";
import { contactTargetFlag, listProfiles } from "./profiles.js";
import { validTimezone } from "./parameter-registry.js";
import { isSuppressed } from "./operations.js";
import { invalidationStatements } from "./fichas.js";
import { validateFields, completeness } from "./demand.js";
export async function listCompanies(request, env, actor) {
  const { limit, offset } = page(request),
    p = new URL(request.url).searchParams,
    where = ["c.tenant_id=?"],
    args = [actor.tenant_id];
  if (p.get("status")) {
    where.push("c.pipeline_status=?");
    args.push(p.get("status"));
  }
  if (p.get("q")) {
    where.push(
      "(c.legal_name LIKE ? ESCAPE '\\' OR c.registration_id LIKE ? ESCAPE '\\')",
    );
    const q =
      "%" + str(p.get("q"), "busca", 200).replace(/[\\%_]/g, "\\$&") + "%";
    args.push(q, q);
  }
  const [rows, count] = await env.DB.batch([
    s(
      env,
      `SELECT c.*,d.id demand_id,d.commodity,d.market,d.completeness,d.version demand_version FROM companies c LEFT JOIN demands d ON d.id=(SELECT id FROM demands WHERE tenant_id=c.tenant_id AND company_id=c.id ORDER BY updated_at DESC,rowid DESC LIMIT 1) WHERE ${where.join(" AND ")} ORDER BY c.updated_at DESC,c.id LIMIT ? OFFSET ?`,
      ...args,
      limit,
      offset,
    ),
    s(
      env,
      `SELECT COUNT(*) total FROM companies c WHERE ${where.join(" AND ")}`,
      ...args,
    ),
  ]);
  return {
    companies: rows.results,
    total: count.results[0].total,
    limit,
    offset,
    nextOffset: offset + limit < count.results[0].total ? offset + limit : null,
  };
}
export async function getCompany(request, env, actor, id) {
  const c = await company(env, actor, id),
    { limit, offset } = page(request);
  const tables = [
    "evidence",
    "contacts",
    "demands",
    "scores",
    "approvals",
    "risk_observations",
  ];
  const data = await env.DB.batch(
    tables.map((table) =>
      s(
        env,
        `SELECT * FROM ${table} WHERE tenant_id=? AND company_id=? ORDER BY rowid DESC LIMIT ? OFFSET ?`,
        actor.tenant_id,
        id,
        limit + 1,
        offset,
      ),
    ),
  );
  const out = { company: c, pagination: { limit, offset, next: {} } };
  for (let i = 0; i < tables.length; i++) {
    const rows = data[i].results;
    out.pagination.next[tables[i]] =
      rows.length > limit ? offset + limit : null;
    out[tables[i]] = rows.slice(0, limit);
  }
  out.contacts = await Promise.all(
    out.contacts.map(async (c) => {
      const values = await Promise.all(
        ["full_name", "job_title", "email", "phone", "linkedin_url"].map(
          (key) => decryptPii(c[`${key}_encrypted`], env),
        ),
      );
      return {
        id: c.id,
        fullName: values[0],
        jobTitle: values[1],
        email: values[2],
        phone: values[3],
        linkedinUrl: values[4],
        sourceLabel: c.source_label,
        sourceUrl: c.source_url,
        prospectRole: c.prospect_role,
        emailValidation: c.email_validation,
        emailValidatedAt: c.email_validated_at,
        relationshipNote: c.relationship_note,
        timezone: c.timezone,
        targetFlag: contactTargetFlag(values[1], c.relationship_note),
      };
    }),
  );
  out.units = (
    await s(env, "SELECT * FROM company_units WHERE tenant_id=? AND company_id=? ORDER BY cnpj", actor.tenant_id, id).all()
  ).results;
  out.profiles = await listProfiles(env, actor, id);
  // Condições R12.10 (empresas no exterior): estado e evidência por commodity.
  out.conditions = (
    await s(env, "SELECT product_id,condition,status,evidence_id,note,updated_by,updated_at FROM company_conditions WHERE tenant_id=? AND company_id=? ORDER BY product_id,condition", actor.tenant_id, id).all()
  ).results;
  out.demandFields = {};
  if (out.demands.length) {
    const fields = await s(
      env,
      `SELECT * FROM demand_fields WHERE tenant_id=? AND demand_id IN (SELECT id FROM demands WHERE tenant_id=? AND company_id=? ORDER BY rowid DESC LIMIT ? OFFSET ?) ORDER BY field_key`,
      actor.tenant_id,
      actor.tenant_id,
      id,
      limit,
      offset,
    ).all();
    for (const d of out.demands) {
      out.demandFields[d.id] = fields.results.filter(
        (f) => f.demand_id === d.id,
      );
      d.completeness = completeness(out.demandFields[d.id], d).score;
    }
  }
  return out;
}
export async function createCompany(request, env, actor, rid) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request),
    id = crypto.randomUUID(),
    at = now();
  const name = str(i.legalName, "razão social", 250),
    country = str(i.countryCode, "país", 2).toUpperCase(),
    source = str(i.sourceLabel, "fonte", 1000);
  if (!/^[A-Z]{2}$/.test(country))
    fail(422, "invalid_country", "Use código de país com 2 letras.");
  let registration = str(i.registrationId, "registro", 100, true);
  const registrationType =
    str(i.registrationIdType, "tipo de registro", 40, true)?.toUpperCase() ||
    null;
  if (country === "BR" && registrationType === "CNPJ" && registration)
    registration = registration.replace(/[.\/\s-]/g, "").toUpperCase();
  if (registration && !registrationType)
    fail(422, "registration_type_required", "Informe o tipo de registro.");
  let cnpjRoot = null;
  if (country === "BR" && registrationType === "CNPJ" && registration) {
    if (!/^\d{14}$/.test(registration)) fail(422, "invalid_cnpj", "CNPJ tem 14 dígitos.");
    cnpjRoot = registration.slice(0, 8);
    const sameRoot = await s(env, "SELECT id FROM companies WHERE tenant_id=? AND cnpj_root=?", actor.tenant_id, cnpjRoot).first();
    if (sameRoot)
      fail(409, "company_duplicate", "Já existe empresa com essa raiz de CNPJ; cadastre a unidade nela.", { id: sameRoot.id });
  }
  if (registration) {
    const duplicate = await s(
      env,
      "SELECT id FROM companies WHERE tenant_id=? AND country_code=? AND registration_id=? AND registration_id_type=?",
      actor.tenant_id,
      country,
      registration,
      registrationType,
    ).first();
    if (duplicate)
      fail(
        409,
        "company_duplicate",
        "Já existe empresa com esse identificador.",
        { id: duplicate.id },
      );
  }
  await commit(env, [
    s(
      env,
      `INSERT INTO companies(id,tenant_id,legal_name,trade_name,country_code,registration_id,registration_id_type,cnpj_root,buyer_type,owner_user_id,source_label,source_url,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'unconfirmed',?,?,?,?,?,?)`,
      id,
      actor.tenant_id,
      name,
      str(i.tradeName, "nome fantasia", 250, true),
      country,
      registration,
      registrationType,
      cnpjRoot,
      actor.id,
      source,
      url(i.sourceUrl),
      actor.id,
      at,
      at,
    ),
    auditStatement(env, actor, rid, "company.created", "company", id),
  ]);
  return { id, pipelineStatus: "discovered" };
}
export async function addEvidence(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, id),
    i = await bodyJson(request),
    eid = crypto.randomUUID(),
    at = now();
  const category = oneOf(
      i.category,
      ["business", "market", "commercial_signal"],
      "categoria",
    ),
    type = str(i.evidenceType, "tipo", 80),
    status = oneOf(
      i.validationStatus || "pending",
      ["pending", "valid", "invalid", "conflicting"],
      "validação",
    );
  let productId = null,
    market = null;
  if (category === "business") {
    oneOf(
      type,
      [
        "customs_record",
        "bill_of_lading",
        "company_document",
        "public_nominal_record",
        "commercial_document",
      ],
      "tipo de prova",
    );
    const p = await product(
      env,
      actor.tenant_id,
      str(i.productId, "produto", 80),
    );
    productUsable(p);
    productId = p.id;
    market = oneOf(i.market, ["national", "international"], "mercado");
  }
  await commit(env, [
    companyLock(env, actor, c),
    s(
      env,
      `INSERT INTO evidence(id,tenant_id,company_id,category,evidence_type,reference,source_url,fact_date,consulted_at,validation_status,validated_by,validated_at,metadata_json,created_by,product_id,market) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      eid,
      actor.tenant_id,
      id,
      category,
      type,
      str(i.reference, "referência", 2000),
      url(i.sourceUrl),
      date(i.factDate, "data do fato", { optional: true }),
      date(i.consultedAt, "consulta"),
      status,
      status === "valid" ? actor.id : null,
      status === "valid" ? at : null,
      "{}",
      actor.id,
      productId,
      market,
    ),
    s(
      env,
      "UPDATE companies SET pipeline_status=CASE WHEN pipeline_status='discovered' AND ?='business' AND ?='valid' THEN 'prospected' ELSE pipeline_status END WHERE tenant_id=? AND id=?",
      category,
      status,
      actor.tenant_id,
      id,
    ),
    auditStatement(env, actor, rid, "evidence.created", "evidence", eid, {
      companyId: id,
      category,
      type,
      validationStatus: status,
    }),
  ]);
  return { id: eid };
}
export async function addContact(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, id),
    i = await bodyJson(request),
    cid = crypto.randomUUID();
  const values = [
    str(i.fullName, "nome", 250),
    str(i.jobTitle, "cargo", 250, true),
    str(i.email, "e-mail", 320, true),
    str(i.phone, "telefone", 50, true),
    url(i.linkedinUrl),
  ];
  if (values[2] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[2]))
    fail(422, "invalid_email", "E-mail inválido.");
  const role = oneOf(i.prospectRole ?? "other", ["decision_maker", "influencer", "provisional_decision_maker", "other"], "papel na prospecção");
  // Fuso confirmado do destinatário (regra de horário de 2026-09-25): opcional no cadastro; sem ele o envio espera.
  const timezone = typeof i.timezone === "string" && i.timezone.trim() ? i.timezone.trim() : null; // vazio = pendente
  if (timezone && !validTimezone(timezone)) fail(422, "timezone_invalid", "Fuso IANA inválido, ex.: America/Sao_Paulo.");
  const emailHash = values[2] ? await identifierHash(env, actor.tenant_id, "email", values[2]) : null;
  // R2.1.2: contato suprimido nunca fica selecionável; o cadastro registra, a ficha recusa.
  const suppressed = values[2] ? await isSuppressed(env, actor.tenant_id, "email", values[2]) : false;
  const encrypted = await Promise.all(values.map((v) => encryptPii(v, env)));
  await commit(env, [
    companyLock(env, actor, c),
    s(
      env,
      `INSERT INTO contacts(id,tenant_id,company_id,full_name_encrypted,job_title_encrypted,email_encrypted,phone_encrypted,linkedin_url_encrypted,source_label,source_url,created_by,prospect_role,email_hash,email_validation,timezone) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      cid,
      actor.tenant_id,
      id,
      ...encrypted,
      str(i.sourceLabel, "fonte", 1000),
      url(i.sourceUrl),
      actor.id,
      role,
      emailHash,
      values[2] ? "pending" : null,
      timezone,
    ),
    auditStatement(env, actor, rid, "contact.created", "contact", cid, {
      companyId: id,
      fieldsProvided: values.map(Boolean),
      prospectRole: role,
      suppressed,
    }),
  ]);
  return { id: cid, suppressed, targetFlag: contactTargetFlag(values[1], null) };
}
export async function verifyContact(request, env, actor, rid, companyId) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, companyId),
    i = await bodyJson(request),
    id = crypto.randomUUID();
  const contact = await s(
    env,
    "SELECT id FROM contacts WHERE tenant_id=? AND company_id=? AND id=?",
    actor.tenant_id,
    companyId,
    str(i.contactId, "contato", 80),
  ).first();
  const demand = await s(
    env,
    "SELECT id FROM demands WHERE tenant_id=? AND company_id=? AND id=?",
    actor.tenant_id,
    companyId,
    str(i.demandId, "demanda", 80),
  ).first();
  if (!contact || !demand)
    fail(
      404,
      "reference_not_found",
      "Contato ou demanda não pertence à empresa.",
    );
  const type = oneOf(
      i.type,
      [
        "email_deliverable",
        "identity",
        "job_title",
        "decision_authority",
        "direct_demand",
      ],
      "tipo de verificação",
    ),
    status = oneOf(i.status, ["confirmed", "rejected", "pending"], "status");
  await commit(env, [
    companyLock(env, actor, c),
    s(
      env,
      "INSERT INTO contact_verifications(id,tenant_id,contact_id,demand_id,verification_type,status,method,source_reference,verified_by,verified_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      id,
      actor.tenant_id,
      contact.id,
      demand.id,
      type,
      status,
      str(i.method, "método", 500),
      str(i.sourceReference, "fonte", 1000),
      actor.id,
      now(),
    ),
    auditStatement(env, actor, rid, "contact.verified", "contact", contact.id, {
      demandId: demand.id,
      type,
      status,
    }),
  ]);
  return { id };
}
export async function addRisk(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, id),
    i = await bodyJson(request),
    oid = crypto.randomUUID();
  const component = oneOf(
      i.component,
      ["registration", "credit", "payment", "reputation", "logistics"],
      "componente",
    ),
    severity = number(i.severity, "severidade", 0, 20);
  await commit(env, [
    companyLock(env, actor, c),
    s(
      env,
      "INSERT INTO risk_observations(id,tenant_id,company_id,component,severity,source_reference,observed_at,recorded_by) VALUES (?,?,?,?,?,?,?,?)",
      oid,
      actor.tenant_id,
      id,
      component,
      severity,
      str(i.sourceReference, "fonte", 1000),
      date(i.observedAt, "data observada"),
      actor.id,
    ),
    auditStatement(env, actor, rid, "risk.created", "company", id, {
      component,
      severity,
    }),
  ]);
  return { id: oid };
}
export async function saveDemand(request, env, actor, rid, companyId) {
  requireRole(actor, WRITE_ROLES);
  const c = await company(env, actor, companyId),
    i = await bodyJson(request),
    at = now();
  const p = await product(
    env,
    actor.tenant_id,
    str(i.productId, "produto", 80),
  );
  productUsable(p);
  const market = oneOf(i.market, ["national", "international"], "mercado");
  let existing = i.id
    ? await s(
        env,
        "SELECT * FROM demands WHERE tenant_id=? AND company_id=? AND id=?",
        actor.tenant_id,
        companyId,
        str(i.id, "demanda", 80),
      ).first()
    : null;
  if (i.id && !existing)
    fail(404, "demand_not_found", "Demanda não encontrada.");
  if (
    existing &&
    (!Number.isInteger(i.expectedVersion) ||
      i.expectedVersion !== existing.version)
  )
    fail(409, "edit_conflict", "Recarregue a demanda antes de salvar.");
  if (
    existing &&
    (existing.market !== market ||
      existing.commodity !== p.commodity ||
      (existing.product_id && existing.product_id !== p.id))
  )
    fail(
      422,
      "demand_identity_change",
      "Crie outra demanda para mudar produto ou mercado.",
    );
  let finalRequired = existing?.final_buyer_required || 0;
  if (i.finalBuyerRequired !== undefined) {
    if (typeof i.finalBuyerRequired !== "boolean")
      fail(422, "invalid_field", "Condição de comprador final inválida.");
    if (Number(i.finalBuyerRequired) !== finalRequired) {
      requireRole(actor, APPROVER_ROLES);
      str(i.conditionReason, "motivo da condição", 500);
      finalRequired = Number(i.finalBuyerRequired);
    }
  }
  const fields = validateFields(i.fields, actor, at),
    id = existing?.id || crypto.randomUUID();
  const old = existing
    ? (
        await s(
          env,
          "SELECT * FROM demand_fields WHERE tenant_id=? AND demand_id=?",
          actor.tenant_id,
          id,
        ).all()
      ).results
    : [];
  const merged = new Map(old.map((f) => [f.field_key, f]));
  for (const f of fields)
    merged.set(f.key, { field_key: f.key, field_status: f.status });
  const comp = completeness([...merged.values()], {
    final_buyer_required: finalRequired,
  });
  const statements = [companyLock(env, actor, c)];
  if (existing)
    statements.push(
      s(
        env,
        "UPDATE demands SET product_id=?,product_variant=?,completeness=?,final_buyer_required=?,version=CASE WHEN version=? THEN version+1 ELSE -1 END,updated_at=? WHERE tenant_id=? AND id=?",
        p.id,
        p.variant_name,
        comp.score,
        finalRequired,
        i.expectedVersion,
        at,
        actor.tenant_id,
        id,
      ),
    );
  else
    statements.push(
      s(
        env,
        `INSERT INTO demands(id,tenant_id,company_id,commodity,product_id,market,product_variant,currency_base,completeness,final_buyer_required,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id,
        actor.tenant_id,
        companyId,
        p.commodity,
        p.id,
        market,
        p.variant_name,
        "USD",
        comp.score,
        finalRequired,
        actor.id,
        at,
        at,
      ),
    );
  for (const f of fields)
    statements.push(
      s(
        env,
        `INSERT INTO demand_fields(id,tenant_id,demand_id,field_key,field_status,value_json,not_applicable_reason,source_reference,confirmed_by,confirmed_at,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,demand_id,field_key) DO UPDATE SET field_status=excluded.field_status,value_json=excluded.value_json,not_applicable_reason=excluded.not_applicable_reason,source_reference=excluded.source_reference,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
        crypto.randomUUID(),
        actor.tenant_id,
        id,
        f.key,
        f.status,
        f.value === null ? null : JSON.stringify(f.value),
        f.reason,
        f.sourceReference,
        f.confirmedBy,
        f.confirmedAt,
        actor.id,
        at,
      ),
    );
  statements.push(
    s(
      env,
      "UPDATE companies SET pipeline_status=CASE WHEN ? >=25 AND pipeline_status NOT IN ('blocked','inactive') THEN 'qualifying' ELSE pipeline_status END WHERE tenant_id=? AND id=?",
      comp.score,
      actor.tenant_id,
      companyId,
    ),
    auditStatement(env, actor, rid, "demand.saved", "demand", id, {
      companyId,
      productId: p.id,
      market,
      completeness: comp.score,
      version: (existing?.version || 0) + 1,
      fields: fields.map((f) => ({ key: f.key, status: f.status })),
      finalBuyerRequired: !!finalRequired,
    }),
  );
  await commit(env, statements);
  const updated = await company(env, actor, companyId);
  return {
    id,
    version: (existing?.version || 0) + 1,
    completeness: comp,
    pipelineStatus: updated.pipeline_status,
  };
}
export async function createApproval(request, env, actor, rid, id) {
  requireRole(actor, APPROVER_ROLES);
  const c = await company(env, actor, id),
    i = await bodyJson(request),
    aid = crypto.randomUUID(),
    at = now();
  const d = await s(
    env,
    "SELECT id FROM demands WHERE tenant_id=? AND company_id=? AND id=?",
    actor.tenant_id,
    id,
    str(i.demandId, "demanda", 80),
  ).first();
  if (!d) fail(404, "demand_not_found", "Demanda não encontrada.");
  const rev = (
    await s(
      env,
      "SELECT parameter_revision FROM tenants WHERE id=?",
      actor.tenant_id,
    ).first()
  ).parameter_revision;
  const type = oneOf(
      i.approvalType,
      [
        "below_minimum",
        "risk_coverage_waiver",
        "risk_mitigation",
        "intermediary_validation",
      ],
      "tipo",
    ),
    status = oneOf(i.status, ["approved", "rejected", "pending"], "status");
  await commit(env, [
    s(
      env,
      "UPDATE companies SET revision=CASE WHEN revision=? THEN revision ELSE -1 END WHERE id=? AND tenant_id=?",
      c.revision,
      id,
      actor.tenant_id,
    ),
    s(
      env,
      "UPDATE tenants SET parameter_revision=CASE WHEN parameter_revision=? THEN parameter_revision ELSE -1 END WHERE id=?",
      rev,
      actor.tenant_id,
    ),
    s(
      env,
      `INSERT INTO approvals(id,tenant_id,company_id,demand_id,approval_type,status,reason,approved_by,decided_at,created_by,created_at,company_revision,parameter_revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      aid,
      actor.tenant_id,
      id,
      d.id,
      type,
      status,
      str(i.reason, "motivo", 1000),
      status === "pending" ? null : actor.id,
      status === "pending" ? null : at,
      actor.id,
      at,
      c.revision,
      rev,
    ),
    s(
      env,
      "UPDATE companies SET pipeline_status=CASE WHEN pipeline_status IN ('qualified','confirmed_opportunity') THEN 'qualifying' ELSE pipeline_status END WHERE tenant_id=? AND id=?",
      actor.tenant_id,
      id,
    ),
    auditStatement(env, actor, rid, "approval.created", "approval", aid, {
      companyId: id,
      demandId: d.id,
      type,
      status,
      companyRevision: c.revision,
      parameterRevision: rev,
    }),
  ]);
  return { id: aid, status };
}

// Papel, relacionamento e fuso do contato (R15.1, R15.6, R18.6). Dados pessoais continuam cifrados.
export async function updateContact(request, env, actor, rid, contactId) {
  requireRole(actor, WRITE_ROLES);
  const c = await s(env, "SELECT * FROM contacts WHERE tenant_id=? AND id=?", actor.tenant_id, contactId).first();
  if (!c) fail(404, "contact_not_found", "Contato não encontrado.");
  const i = await bodyJson(request);
  let timezone = c.timezone;
  if (i.timezone !== undefined) {
    if (i.timezone !== null && !validTimezone(i.timezone))
      fail(422, "timezone_invalid", "Fuso IANA inválido, ex.: America/Sao_Paulo.");
    timezone = i.timezone;
  }
  const next = {
    prospect_role:
      i.prospectRole === undefined
        ? c.prospect_role
        : oneOf(i.prospectRole, ["decision_maker", "influencer", "provisional_decision_maker", "other"], "papel na prospecção"),
    relationship_note:
      i.relationshipNote === undefined ? c.relationship_note : str(i.relationshipNote, "relacionamento", 1000, true),
    timezone,
  };
  await commit(env, [
    s(
      env,
      "UPDATE contacts SET prospect_role=?,relationship_note=?,timezone=?,updated_at=? WHERE tenant_id=? AND id=?",
      next.prospect_role,
      next.relationship_note,
      next.timezone,
      now(),
      actor.tenant_id,
      contactId,
    ),
    ...(next.prospect_role !== c.prospect_role ? invalidationStatements(env, { contactId }, "papel do contato alterado") : []),
    auditStatement(env, actor, rid, "contact.updated", "contact", contactId, {
      prospectRole: next.prospect_role,
      relationshipChanged: next.relationship_note !== c.relationship_note,
      timezone: next.timezone,
    }),
  ]);
  return { id: contactId, prospectRole: next.prospect_role, relationshipNote: next.relationship_note, timezone: next.timezone };
}
