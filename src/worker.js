import { calculateCompleteness, calculateConfidence, calculatePotential, calculateRisk, evaluateQualificationGate, SCORE_VERSION } from "./scoring.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const ROLES = ["admin", "commercial_manager", "seller_analyst", "auditor_viewer"];
const WRITE_ROLES = new Set(["admin", "commercial_manager", "seller_analyst"]);
const APPROVER_ROLES = new Set(["admin", "commercial_manager"]);

function response(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

function apiError(status, code, message, details) {
  return response({ error: { code, message, details: details ?? null } }, status);
}

async function bodyJson(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new ApiException(415, "unsupported_media_type", "Envie application/json.");
  try { return await request.json(); } catch { throw new ApiException(400, "invalid_json", "O corpo JSON é inválido."); }
}

class ApiException extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}

function requireFields(object, fields) {
  const missing = fields.filter((field) => object[field] === undefined || object[field] === null || object[field] === "");
  if (missing.length) throw new ApiException(422, "missing_fields", "Há campos obrigatórios ausentes.", { missing });
}

function bytesToBase64(bytes) {
  let binary=""; for(const byte of bytes) binary+=String.fromCharCode(byte); return btoa(binary);
}

function base64ToBytes(value) {
  const binary=atob(value); return Uint8Array.from(binary,(char)=>char.charCodeAt(0));
}

async function piiKey(env) {
  if(!env.PII_ENCRYPTION_KEY) throw new ApiException(503,"pii_key_unavailable","O armazenamento de contatos aguarda a chave de proteção de dados.");
  const raw=base64ToBytes(env.PII_ENCRYPTION_KEY);
  if(raw.length!==32) throw new ApiException(503,"pii_key_invalid","A chave de proteção de dados está inválida.");
  return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

async function encryptPii(value, env) {
  if(value===undefined||value===null||value==="") return null;
  const iv=crypto.getRandomValues(new Uint8Array(12)); const key=await piiKey(env);
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(String(value)));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decryptPii(value, env) {
  if(!value) return null;
  try { const [iv,cipher]=value.split("."); const key=await piiKey(env); const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:base64ToBytes(iv)},key,base64ToBytes(cipher)); return new TextDecoder().decode(plain); }
  catch { return null; }
}

async function getActor(request, env) {
  const tenantId = env.DEFAULT_TENANT_ID || "eag-internal";
  const platformId = request.headers.get("oai-authenticated-user-id");
  const accessEmail = request.headers.get("oai-authenticated-user-email") || request.headers.get("cf-access-authenticated-user-email");
  const localEmail = env.ENVIRONMENT === "local" ? request.headers.get("x-eag-user") || "admin@local.eag" : null;
  const email = accessEmail || localEmail;
  if (!email) throw new ApiException(401, "authentication_required", "Acesso autenticado é obrigatório.");
  await env.DB.prepare("INSERT OR IGNORE INTO tenants (id,name,status) VALUES (?,?, 'active')").bind(tenantId,"EAG — Operação Interna").run();
  const user = await env.DB.prepare("SELECT id, tenant_id, email, display_name, role FROM users WHERE tenant_id=? AND lower(email)=lower(?) AND status='active'").bind(tenantId, email).first();
  if (user) return user;
  const count = await env.DB.prepare("SELECT COUNT(*) total FROM users WHERE tenant_id=? AND status='active'").bind(tenantId).first();
  if (platformId && Number(count.total) === 0) {
    const fullNameHeader=request.headers.get("oai-authenticated-user-full-name");
    const encoding=request.headers.get("oai-authenticated-user-full-name-encoding");
    let displayName=email;
    if(fullNameHeader && encoding==="percent-encoded-utf-8") { try { displayName=decodeURIComponent(fullNameHeader); } catch {} }
    await env.DB.prepare("INSERT INTO users (id,tenant_id,email,display_name,role,status) VALUES (?,?,?,?,?,'active')").bind(platformId,tenantId,email,displayName,"admin").run();
    return {id:platformId,tenant_id:tenantId,email,display_name:displayName,role:"admin"};
  }
  if (env.ENVIRONMENT === "local") {
    const requestedRole = request.headers.get("x-eag-role") || "admin";
    return { id: "local-developer", tenant_id: tenantId, email, display_name: "Desenvolvimento local", role: ROLES.includes(requestedRole) ? requestedRole : "admin" };
  }
  throw new ApiException(403, "user_not_authorized", "Usuário autenticado não está autorizado no EAG Compass.");
}

function requireRole(actor, allowed) {
  if (!allowed.has(actor.role)) throw new ApiException(403, "forbidden", "Seu perfil não permite esta ação.");
}

async function audit(env, actor, requestId, action, entityType, entityId, values = {}) {
  await env.DB.prepare(`INSERT INTO audit_log
    (id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,field_name,old_value_json,new_value_json,reason,evidence_id,formula_version,parameters_json,request_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), actor.tenant_id, actor.id, actor.role, action, entityType, entityId, values.fieldName ?? null,
      values.oldValue === undefined ? null : JSON.stringify(values.oldValue), values.newValue === undefined ? null : JSON.stringify(values.newValue),
      values.reason ?? null, values.evidenceId ?? null, values.formulaVersion ?? null, values.parameters ? JSON.stringify(values.parameters) : null, requestId).run();
}

async function getParameters(env, tenantId) {
  const result = await env.DB.prepare(`SELECT parameter_key,scope_key,value_json FROM parameters p
    WHERE tenant_id=? AND effective_from<=? AND (effective_to IS NULL OR effective_to>?)
    AND effective_from=(SELECT MAX(effective_from) FROM parameters p2 WHERE p2.tenant_id=p.tenant_id AND p2.parameter_key=p.parameter_key AND p2.scope_key=p.scope_key AND p2.effective_from<=?)`)
    .bind(tenantId, new Date().toISOString(), new Date().toISOString(), new Date().toISOString()).all();
  const values = {};
  for (const row of result.results) values[`${row.parameter_key}:${row.scope_key}`] = JSON.parse(row.value_json);
  return values;
}

async function dashboard(env, actor) {
  const counts = await env.DB.prepare(`SELECT pipeline_status,COUNT(*) total FROM companies WHERE tenant_id=? AND pipeline_status!='inactive' GROUP BY pipeline_status`).bind(actor.tenant_id).all();
  const exceptions = await env.DB.prepare(`SELECT exception_status,COUNT(*) total FROM companies WHERE tenant_id=? AND exception_status IS NOT NULL GROUP BY exception_status`).bind(actor.tenant_id).all();
  return response({ pipeline: Object.fromEntries(counts.results.map((r) => [r.pipeline_status, r.total])), exceptions: Object.fromEntries(exceptions.results.map((r) => [r.exception_status, r.total])), generatedAt: new Date().toISOString() });
}

async function listCompanies(request, env, actor) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("q");
  const bindings = [actor.tenant_id];
  const where = ["c.tenant_id=?", "c.pipeline_status!='inactive'"];
  if (status) { where.push("c.pipeline_status=?"); bindings.push(status); }
  if (search) { where.push("(lower(c.legal_name) LIKE ? OR lower(c.country_code) LIKE ?)"); bindings.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`); }
  const query = `SELECT c.*,
    (SELECT commodity FROM demands d WHERE d.company_id=c.id ORDER BY d.updated_at DESC LIMIT 1) commodity,
    (SELECT product_variant FROM demands d WHERE d.company_id=c.id ORDER BY d.updated_at DESC LIMIT 1) product_variant,
    (SELECT completeness FROM demands d WHERE d.company_id=c.id ORDER BY d.updated_at DESC LIMIT 1) completeness,
    (SELECT score_value FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='confidence') confidence_score,
    (SELECT score_min FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='potential') potential_min,
    (SELECT score_max FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='potential') potential_max,
    (SELECT score_value FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='risk') risk_score,
    (SELECT coverage FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='risk') risk_coverage
    FROM companies c WHERE ${where.join(" AND ")} ORDER BY c.updated_at DESC LIMIT 200`;
  const result = await env.DB.prepare(query).bind(...bindings).all();
  return response({ companies: result.results, total: result.results.length });
}

async function getCompany(env, actor, companyId) {
  const company = await env.DB.prepare("SELECT * FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id, companyId).first();
  if (!company) throw new ApiException(404, "company_not_found", "Empresa não encontrada.");
  const [evidence, contacts, demands, scores, approvals] = await Promise.all([
    env.DB.prepare("SELECT * FROM evidence WHERE tenant_id=? AND company_id=? ORDER BY created_at DESC").bind(actor.tenant_id, companyId).all(),
    env.DB.prepare("SELECT id,company_id,full_name_encrypted,job_title_encrypted,email_encrypted,phone_encrypted,linkedin_url_encrypted,source_label,source_url,created_at,updated_at FROM contacts WHERE tenant_id=? AND company_id=? ORDER BY created_at DESC").bind(actor.tenant_id, companyId).all(),
    env.DB.prepare("SELECT * FROM demands WHERE tenant_id=? AND company_id=? ORDER BY updated_at DESC").bind(actor.tenant_id, companyId).all(),
    env.DB.prepare("SELECT * FROM scores WHERE tenant_id=? AND company_id=? ORDER BY calculated_at DESC").bind(actor.tenant_id, companyId).all(),
    env.DB.prepare("SELECT * FROM approvals WHERE tenant_id=? AND company_id=? ORDER BY created_at DESC").bind(actor.tenant_id, companyId).all()
  ]);
  const safeContacts=[];
  for(const contact of contacts.results) safeContacts.push({id:contact.id,company_id:contact.company_id,fullName:await decryptPii(contact.full_name_encrypted,env),jobTitle:await decryptPii(contact.job_title_encrypted,env),email:await decryptPii(contact.email_encrypted,env),phone:await decryptPii(contact.phone_encrypted,env),linkedinUrl:await decryptPii(contact.linkedin_url_encrypted,env),sourceLabel:contact.source_label,sourceUrl:contact.source_url,createdAt:contact.created_at,updatedAt:contact.updated_at});
  const demandFields={};
  for(const demand of demands.results){ const rows=await env.DB.prepare("SELECT field_key,field_status,value_json,not_applicable_reason,source_reference,confirmed_at FROM demand_fields WHERE tenant_id=? AND demand_id=? ORDER BY field_key").bind(actor.tenant_id,demand.id).all(); demandFields[demand.id]=rows.results; }
  return response({ company, evidence: evidence.results, contacts:safeContacts, demands: demands.results, demandFields, scores: scores.results, approvals: approvals.results });
}

async function createCompany(request, env, actor, requestId) {
  requireRole(actor, WRITE_ROLES);
  const input = await bodyJson(request);
  requireFields(input, ["legalName", "countryCode", "sourceLabel"]);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO companies (id,tenant_id,legal_name,trade_name,country_code,registration_id,registration_id_type,buyer_type,pipeline_status,owner_user_id,source_label,source_url,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, actor.tenant_id, input.legalName.trim(), input.tradeName ?? null, input.countryCode.toUpperCase(), input.registrationId ?? null, input.registrationIdType ?? null, input.buyerType ?? "unconfirmed", "discovered", actor.id, input.sourceLabel, input.sourceUrl ?? null, actor.id, now, now),
      env.DB.prepare(`INSERT INTO evidence (id,tenant_id,company_id,category,evidence_type,reference,source_url,consulted_at,validation_status,metadata_json,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), actor.tenant_id, id, "commercial_signal", input.signalType ?? "manual_source", input.sourceLabel, input.sourceUrl ?? null, now, "pending", "{}", actor.id)
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new ApiException(409, "company_duplicate", "Já existe uma empresa com este nome e país.");
    throw error;
  }
  await audit(env, actor, requestId, "company.created", "company", id, { newValue: { legalName: input.legalName, countryCode: input.countryCode, pipelineStatus: "discovered" } });
  return response({ id, pipelineStatus: "discovered" }, 201);
}

async function addEvidence(request, env, actor, requestId, companyId) {
  requireRole(actor, WRITE_ROLES);
  const input = await bodyJson(request);
  requireFields(input, ["category", "evidenceType", "reference", "consultedAt"]);
  if (!["business", "market", "commercial_signal"].includes(input.category)) throw new ApiException(422, "invalid_category", "Categoria de evidência inválida.");
  const company = await env.DB.prepare("SELECT id,pipeline_status FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id, companyId).first();
  if (!company) throw new ApiException(404, "company_not_found", "Empresa não encontrada.");
  const id = crypto.randomUUID();
  const validated = input.validationStatus === "valid";
  await env.DB.prepare(`INSERT INTO evidence (id,tenant_id,company_id,category,evidence_type,reference,source_url,fact_date,consulted_at,validation_status,validated_by,validated_at,metadata_json,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, actor.tenant_id, companyId, input.category, input.evidenceType, input.reference, input.sourceUrl ?? null, input.factDate ?? null, input.consultedAt, input.validationStatus ?? "pending", validated ? actor.id : null, validated ? new Date().toISOString() : null, JSON.stringify(input.metadata ?? {}), actor.id).run();
  if (input.category === "business" && validated && company.pipeline_status === "discovered") {
    await env.DB.prepare("UPDATE companies SET pipeline_status='prospected',updated_at=? WHERE tenant_id=? AND id=?").bind(new Date().toISOString(), actor.tenant_id, companyId).run();
  }
  await audit(env, actor, requestId, "evidence.created", "evidence", id, { newValue: input, evidenceId: id });
  return response({ id, pipelineStatus: input.category === "business" && validated && company.pipeline_status === "discovered" ? "prospected" : company.pipeline_status }, 201);
}

async function addContact(request, env, actor, requestId, companyId) {
  requireRole(actor, WRITE_ROLES);
  const input=await bodyJson(request); requireFields(input,["fullName","sourceLabel"]);
  const company=await env.DB.prepare("SELECT id,pipeline_status FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id,companyId).first();
  if(!company) throw new ApiException(404,"company_not_found","Empresa não encontrada.");
  const id=crypto.randomUUID(); const now=new Date().toISOString();
  const encrypted=await Promise.all([encryptPii(input.fullName,env),encryptPii(input.jobTitle,env),encryptPii(input.email,env),encryptPii(input.phone,env),encryptPii(input.linkedinUrl,env)]);
  await env.DB.prepare(`INSERT INTO contacts (id,tenant_id,company_id,full_name_encrypted,job_title_encrypted,email_encrypted,phone_encrypted,linkedin_url_encrypted,source_label,source_url,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,actor.tenant_id,companyId,...encrypted,input.sourceLabel,input.sourceUrl??null,actor.id,now,now).run();
  await audit(env,actor,requestId,"contact.created","contact",id,{newValue:{companyId,sourceLabel:input.sourceLabel,fieldsProvided:{fullName:true,jobTitle:Boolean(input.jobTitle),email:Boolean(input.email),phone:Boolean(input.phone),linkedinUrl:Boolean(input.linkedinUrl)}}});
  return response({id,createdAt:now},201);
}

async function addRiskObservation(request, env, actor, requestId, companyId) {
  requireRole(actor, WRITE_ROLES);
  const input=await bodyJson(request); requireFields(input,["component","severity","sourceReference","observedAt"]);
  if(!["registration","credit","payment","reputation","logistics"].includes(input.component)||!Number.isFinite(Number(input.severity))||Number(input.severity)<0||Number(input.severity)>20) throw new ApiException(422,"invalid_risk_observation","Componente ou severidade inválidos.");
  const id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO risk_observations (id,tenant_id,company_id,component,severity,source_reference,observed_at,recorded_by) VALUES (?,?,?,?,?,?,?,?)").bind(id,actor.tenant_id,companyId,input.component,Number(input.severity),input.sourceReference,input.observedAt,actor.id).run();
  await audit(env,actor,requestId,"risk_observation.created","risk_observation",id,{newValue:input});
  return response({id},201);
}

async function createApproval(request, env, actor, requestId, companyId) {
  requireRole(actor, APPROVER_ROLES);
  const input=await bodyJson(request); requireFields(input,["approvalType","status","reason"]);
  if(!["below_minimum","risk_coverage_waiver","risk_mitigation","intermediary_validation"].includes(input.approvalType)||!["approved","rejected","pending"].includes(input.status)) throw new ApiException(422,"invalid_approval","Tipo ou estado de aprovação inválido.");
  const id=crypto.randomUUID(); const now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO approvals (id,tenant_id,company_id,demand_id,approval_type,status,reason,approved_by,decided_at,metadata_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id,actor.tenant_id,companyId,input.demandId??null,input.approvalType,input.status,input.reason,input.status==="pending"?null:actor.id,input.status==="pending"?null:now,JSON.stringify(input.metadata??{}),actor.id).run();
  await audit(env,actor,requestId,"approval.created","approval",id,{newValue:input,reason:input.reason});
  return response({id,status:input.status},201);
}

const REQUIRED_DEMAND_FIELDS = new Set(["product","specification","packaging","volume_per_operation","destination_country","delivery_location","incoterm","required_date","modality","operations_per_year","payment_method","payment_term","payment_guarantee","final_buyer","decision_maker","compliance_restrictions"]);

async function saveDemand(request, env, actor, requestId, companyId) {
  requireRole(actor, WRITE_ROLES);
  const input = await bodyJson(request);
  requireFields(input, ["commodity", "fields"]);
  if (!["sugar", "coffee"].includes(input.commodity) || !Array.isArray(input.fields)) throw new ApiException(422, "invalid_demand", "Commodity ou campos inválidos.");
  const company = await env.DB.prepare("SELECT id,pipeline_status FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id, companyId).first();
  if (!company) throw new ApiException(404, "company_not_found", "Empresa não encontrada.");
  const demandId = input.id || crypto.randomUUID();
  const normalizedFields = input.fields.map((field) => ({ ...field, required: REQUIRED_DEMAND_FIELDS.has(field.key) }));
  for (const field of normalizedFields) {
    requireFields(field, ["key", "status"]);
    if (!["confirmed","not_confirmed","not_applicable"].includes(field.status)) throw new ApiException(422, "invalid_field_status", `Estado inválido para ${field.key}.`);
    if (field.status === "not_applicable" && !field.notApplicableReason) throw new ApiException(422, "missing_not_applicable_reason", `Justificativa obrigatória para ${field.key}.`);
  }
  const completeness = calculateCompleteness(normalizedFields);
  const now = new Date().toISOString();
  const statements = [env.DB.prepare(`INSERT INTO demands (id,tenant_id,company_id,commodity,product_variant,supplier_reference,completeness,current_state,desired_state,gap_summary,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,company_id,commodity) DO UPDATE SET product_variant=excluded.product_variant,supplier_reference=excluded.supplier_reference,completeness=excluded.completeness,current_state=excluded.current_state,desired_state=excluded.desired_state,gap_summary=excluded.gap_summary,updated_at=excluded.updated_at`)
    .bind(demandId, actor.tenant_id, companyId, input.commodity, input.productVariant ?? null, input.supplierReference ?? null, completeness.score, input.currentState ?? null, input.desiredState ?? null, input.gapSummary ?? null, actor.id, now, now)];
  for (const field of normalizedFields) statements.push(env.DB.prepare(`INSERT INTO demand_fields (id,tenant_id,demand_id,field_key,field_status,value_json,not_applicable_reason,source_reference,confirmed_by,confirmed_at,updated_by,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,demand_id,field_key) DO UPDATE SET field_status=excluded.field_status,value_json=excluded.value_json,not_applicable_reason=excluded.not_applicable_reason,source_reference=excluded.source_reference,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
    .bind(crypto.randomUUID(), actor.tenant_id, demandId, field.key, field.status, field.value === undefined ? null : JSON.stringify(field.value), field.notApplicableReason ?? null, field.sourceReference ?? null, field.status === "confirmed" ? actor.id : null, field.status === "confirmed" ? now : null, actor.id, now));
  await env.DB.batch(statements);
  if (completeness.score >= 25 && !["qualified","confirmed_opportunity","blocked"].includes(company.pipeline_status)) await env.DB.prepare("UPDATE companies SET pipeline_status='qualifying',updated_at=? WHERE tenant_id=? AND id=?").bind(now, actor.tenant_id, companyId).run();
  await audit(env, actor, requestId, "demand.saved", "demand", demandId, { newValue: { commodity: input.commodity, completeness } });
  return response({ id: demandId, completeness, pipelineStatus: completeness.score >= 25 ? "qualifying" : company.pipeline_status });
}

function decodeFields(rows) {
  return Object.fromEntries(rows.map((row) => [row.field_key, row.value_json ? JSON.parse(row.value_json) : null]));
}

async function recalculateScores(env, actor, requestId, companyId) {
  requireRole(actor, WRITE_ROLES);
  const demand = await env.DB.prepare("SELECT * FROM demands WHERE tenant_id=? AND company_id=? ORDER BY updated_at DESC LIMIT 1").bind(actor.tenant_id, companyId).first();
  if (!demand) throw new ApiException(422, "demand_required", "Cadastre a demanda antes de calcular os scores.");
  const [fieldResult, evidenceResult, verificationResult, riskResult, parameters] = await Promise.all([
    env.DB.prepare("SELECT * FROM demand_fields WHERE tenant_id=? AND demand_id=?").bind(actor.tenant_id, demand.id).all(),
    env.DB.prepare("SELECT * FROM evidence WHERE tenant_id=? AND company_id=? AND category='business' AND validation_status='valid' ORDER BY fact_date DESC").bind(actor.tenant_id, companyId).all(),
    env.DB.prepare(`SELECT cv.* FROM contact_verifications cv JOIN contacts c ON c.id=cv.contact_id WHERE cv.tenant_id=? AND c.company_id=? AND cv.status='confirmed'`).bind(actor.tenant_id, companyId).all(),
    env.DB.prepare(`SELECT component,severity FROM risk_observations ro WHERE tenant_id=? AND company_id=? AND observed_at=(SELECT MAX(observed_at) FROM risk_observations ro2 WHERE ro2.tenant_id=ro.tenant_id AND ro2.company_id=ro.company_id AND ro2.component=ro.component)`).bind(actor.tenant_id, companyId).all(),
    getParameters(env, actor.tenant_id)
  ]);
  const fields = decodeFields(fieldResult.results);
  const evidence = evidenceResult.results;
  const verificationTypes = new Set(verificationResult.results.map((row) => row.verification_type));
  const bestEvidence = evidence.find((row) => row.evidence_type === "customs_record") ? "customs_record" : evidence.find((row) => row.evidence_type === "bill_of_lading") ? "bill_of_lading" : evidence.length ? "company_document" : null;
  const latestFact = evidence.map((row) => row.fact_date).filter(Boolean).sort().at(-1);
  const ageMonths = latestFact ? (Date.now() - new Date(latestFact).getTime()) / 2629800000 : null;
  const scope = demand.commodity === "coffee" && demand.supplier_reference ? `coffee:${demand.supplier_reference}` : demand.commodity;
  const volumeMinimum = parameters[`volume_min:${scope}`] ?? parameters[`volume_min:${demand.commodity}`] ?? null;
  const potential = calculatePotential({
    commodity:demand.commodity, volumePerOperation:Number(fields.volume_per_operation?.amount ?? fields.volume_per_operation), operationsPerYear:Number(fields.operations_per_year), annualPotentialDirect:fields.annual_potential_direct?.amount ?? fields.annual_potential_direct,
    specificationConfirmed:fieldResult.results.some((r)=>r.field_key==="specification"&&r.field_status==="confirmed"), packagingConfirmed:fieldResult.results.some((r)=>r.field_key==="packaging"&&r.field_status==="confirmed"),
    incotermConfirmed:fieldResult.results.some((r)=>r.field_key==="incoterm"&&r.field_status==="confirmed"), requiredDateConfirmed:fieldResult.results.some((r)=>r.field_key==="required_date"&&r.field_status==="confirmed"), deliveryLocationConfirmed:fieldResult.results.some((r)=>r.field_key==="delivery_location"&&r.field_status==="confirmed"), logisticsConfirmed:Boolean(fields.logistics_confirmed)
  }, { volumeMinimum });
  const confidence = calculateConfidence({ purchaseEvidence:bestEvidence, recency:ageMonths===null?null:ageMonths<6?"under_6_months":ageMonths<=12?"from_6_to_12_months":"over_12_months", companyRegistry:fields.company_registry_status, decisionMaker:verificationTypes.has("decision_authority")?"verified_authority":fields.decision_maker?"title_only":null, directConfirmation:verificationTypes.has("direct_demand")?"demand_confirmed":verificationTypes.has("identity")?"initial_response":null });
  const risk = calculateRisk(Object.fromEntries(riskResult.results.map((row)=>[row.component,row.severity])));
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare("INSERT INTO scores (id,tenant_id,company_id,demand_id,score_type,score_value,score_min,score_max,coverage,classification,components_json,formula_version,parameters_json,calculated_by,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.tenant_id,companyId,demand.id,"potential",potential.scoreMin,potential.scoreMin,potential.scoreMax,potential.coverage,potential.belowMinimum?"below_minimum":null,JSON.stringify(potential.components),SCORE_VERSION,JSON.stringify({volumeMinimum}),actor.id,now),
    env.DB.prepare("INSERT INTO scores (id,tenant_id,company_id,demand_id,score_type,score_value,score_min,score_max,coverage,classification,components_json,formula_version,parameters_json,calculated_by,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.tenant_id,companyId,demand.id,"confidence",confidence.score,confidence.score,confidence.score,100,null,JSON.stringify(confidence.components),SCORE_VERSION,"{}",actor.id,now),
    env.DB.prepare("INSERT INTO scores (id,tenant_id,company_id,demand_id,score_type,score_value,score_min,score_max,coverage,classification,components_json,formula_version,parameters_json,calculated_by,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.tenant_id,companyId,demand.id,"risk",risk.score,risk.score,risk.score,risk.coverage,risk.state,JSON.stringify(risk.components),SCORE_VERSION,"{}",actor.id,now)
  ];
  await env.DB.batch(statements);
  if (potential.belowMinimum) await env.DB.prepare("UPDATE companies SET exception_status='below_minimum',updated_at=? WHERE tenant_id=? AND id=?").bind(now,actor.tenant_id,companyId).run();
  await audit(env, actor, requestId, "scores.calculated", "company", companyId, { newValue:{potential,confidence,risk}, formulaVersion:SCORE_VERSION, parameters });
  return response({ potential, confidence, risk, completeness:demand.completeness });
}

async function qualifyCompany(env, actor, requestId, companyId) {
  requireRole(actor, APPROVER_ROLES);
  const parameters = await getParameters(env, actor.tenant_id);
  const company = await env.DB.prepare("SELECT * FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id,companyId).first();
  if (!company) throw new ApiException(404,"company_not_found","Empresa não encontrada.");
  const demand = await env.DB.prepare("SELECT * FROM demands WHERE tenant_id=? AND company_id=? ORDER BY updated_at DESC LIMIT 1").bind(actor.tenant_id,companyId).first();
  const scoreRows = await env.DB.prepare("SELECT * FROM company_latest_scores WHERE tenant_id=? AND company_id=?").bind(actor.tenant_id,companyId).all();
  const scores=Object.fromEntries(scoreRows.results.map((row)=>[row.score_type,row]));
  const evidence=await env.DB.prepare("SELECT COUNT(*) total FROM evidence WHERE tenant_id=? AND company_id=? AND category='business' AND validation_status='valid'").bind(actor.tenant_id,companyId).first();
  const decisions=await env.DB.prepare("SELECT decision FROM screening_decisions sd JOIN screening_matches sm ON sm.id=sd.screening_match_id JOIN screening_runs sr ON sr.id=sm.screening_run_id WHERE sd.tenant_id=? AND sr.company_id=?").bind(actor.tenant_id,companyId).all();
  const approvals=await env.DB.prepare("SELECT approval_type,status FROM approvals WHERE tenant_id=? AND company_id=? ORDER BY created_at DESC").bind(actor.tenant_id,companyId).all();
  const approved=new Set(approvals.results.filter((x)=>x.status==="approved").map((x)=>x.approval_type));
  const fieldRows=demand?await env.DB.prepare("SELECT field_key,field_status,value_json FROM demand_fields WHERE tenant_id=? AND demand_id=?").bind(actor.tenant_id,demand.id).all():{results:[]};
  const fieldMap=Object.fromEntries(fieldRows.results.map((r)=>[r.field_key,r]));
  const gate=evaluateQualificationGate({
    hasBusinessEvidence:evidence.total>0,confidence:scores.confidence?.score_value,potentialMin:scores.potential?.score_min,completeness:demand?.completeness,
    sanctionBlocked:decisions.results.some((d)=>d.decision==="confirmed_block")||company.exception_status==="sanction_blocked",sanctionReviewPending:company.exception_status==="sanction_review",
    riskCoverage:scores.risk?.coverage,riskCoverageWaiverApproved:approved.has("risk_coverage_waiver"),finalBuyerConfirmed:fieldMap.final_buyer?.field_status==="confirmed",decisionMakerConfirmed:fieldMap.decision_maker?.field_status==="confirmed",
    belowMinimum:company.exception_status==="below_minimum",minimumVolumeApproval:approved.has("below_minimum"),riskScore:scores.risk?.score_value,mitigationApproved:approved.has("risk_mitigation")
  },{confidenceMin:parameters["confidence_min:global"]??50,potentialMin:parameters["potential_min:global"]??40,completenessMin:parameters["completeness_min:global"]??60,riskCoverageMin:parameters["risk_coverage_min:global"]??50});
  if(!gate.qualified) throw new ApiException(409,"qualification_gate_failed","A empresa ainda não atende ao gate de qualificação.",{pending:gate.pending,checks:gate.checks});
  await env.DB.prepare("UPDATE companies SET pipeline_status='qualified',exception_status=NULL,updated_at=? WHERE tenant_id=? AND id=?").bind(new Date().toISOString(),actor.tenant_id,companyId).run();
  await audit(env,actor,requestId,"company.qualified","company",companyId,{oldValue:{pipelineStatus:company.pipeline_status},newValue:{pipelineStatus:"qualified"},formulaVersion:SCORE_VERSION,parameters});
  return response({qualified:true,pipelineStatus:"qualified",gate});
}

async function listAudit(request, env, actor) {
  const url=new URL(request.url); const entityId=url.searchParams.get("entityId"); const bindings=[actor.tenant_id]; const where=["tenant_id=?"];
  if(entityId){where.push("entity_id=?");bindings.push(entityId)}
  const result=await env.DB.prepare(`SELECT * FROM audit_log WHERE ${where.join(" AND ")} ORDER BY occurred_at DESC LIMIT 200`).bind(...bindings).all();
  return response({events:result.results});
}

async function route(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) {
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Interface indisponível", { status: 503 });
  }
  const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
  if (url.pathname === "/api/health") return response({ status:"ok", service:"eag-compass", version:"0.3.1", time:new Date().toISOString() });
  const actor = await getActor(request, env);
  if (url.pathname === "/api/session" && request.method === "GET") return response({ actor });
  if (url.pathname === "/api/dashboard" && request.method === "GET") return dashboard(env, actor);
  if (url.pathname === "/api/companies" && request.method === "GET") return listCompanies(request, env, actor);
  if (url.pathname === "/api/companies" && request.method === "POST") return createCompany(request, env, actor, requestId);
  if (url.pathname === "/api/audit" && request.method === "GET") return listAudit(request, env, actor);
  const match = url.pathname.match(/^\/api\/companies\/([^/]+)(?:\/(evidence|contacts|demand|risk-observations|approvals|scores\/recalculate|qualify))?$/);
  if (match) {
    const [, companyId, action] = match;
    if (!action && request.method === "GET") return getCompany(env, actor, companyId);
    if (action === "evidence" && request.method === "POST") return addEvidence(request, env, actor, requestId, companyId);
    if (action === "contacts" && request.method === "POST") return addContact(request, env, actor, requestId, companyId);
    if (action === "demand" && request.method === "PUT") return saveDemand(request, env, actor, requestId, companyId);
    if (action === "risk-observations" && request.method === "POST") return addRiskObservation(request, env, actor, requestId, companyId);
    if (action === "approvals" && request.method === "POST") return createApproval(request, env, actor, requestId, companyId);
    if (action === "scores/recalculate" && request.method === "POST") return recalculateScores(env, actor, requestId, companyId);
    if (action === "qualify" && request.method === "POST") return qualifyCompany(env, actor, requestId, companyId);
  }
  throw new ApiException(404, "route_not_found", "Rota não encontrada.");
}

async function processQueue(batch) {
  for (const message of batch.messages) {
    try {
      if (!message.body?.type) throw new Error("Mensagem sem tipo");
      message.ack();
    } catch (error) {
      console.error("queue_message_failed", { id:message.id, error:String(error) });
      message.retry();
    }
  }
}

async function runScheduled(env, controller) {
  console.info("scheduled_checkpoint", { cron:controller.cron, scheduledTime:controller.scheduledTime, action:"source_version_check_pending_adapters" });
  await env.CACHE.put("cron:last-run", new Date(controller.scheduledTime).toISOString(), { expirationTtl: 86400 * 7 });
}

export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (error) {
      if (error instanceof ApiException) return apiError(error.status, error.code, error.message, error.details);
      console.error("unhandled_error", { error:String(error), stack:error?.stack });
      return apiError(500, "internal_error", "Ocorreu um erro interno.");
    }
  },
  queue: processQueue,
  scheduled: runScheduled
};
