import {
  calculateConfidence,
  calculatePotential,
  calculateRisk,
  evaluateQualificationGate,
  SCORE_VERSION,
} from "./scoring.js";
import { completeness, confirmedValues, amountMT } from "./demand.js";
import {
  statement as s,
  company,
  parameters,
  requireParameter,
  now,
  commit,
  auditStatement,
  companyLock,
} from "./store.js";
import { fail, requireRole, WRITE_ROLES, APPROVER_ROLES } from "./http.js";
async function currentScreening(env, actor, c, params) {
  const maxAge = params["sanctions_max_age_hours:global"];
  const fresh = (value) => {
    const time = Date.parse(value);
    return (
      Number.isFinite(time) &&
      time <= Date.now() &&
      Date.now() - time <= maxAge * 3600000
    );
  };
  if (typeof maxAge !== "number" || maxAge <= 0)
    return {
      current: false,
      blocked: false,
      review: true,
      reason: "sanctions_policy_missing",
    };
  const [sources, runs] = await env.DB.batch([
    s(
      env,
      `SELECT ss.id,(SELECT v.id FROM sanction_list_versions v WHERE v.source_id=ss.id AND v.import_status='imported' ORDER BY v.downloaded_at DESC,v.rowid DESC LIMIT 1) version_id,(SELECT v.downloaded_at FROM sanction_list_versions v WHERE v.source_id=ss.id AND v.import_status='imported' ORDER BY v.downloaded_at DESC,v.rowid DESC LIMIT 1) downloaded_at FROM sanction_sources ss WHERE active=1`,
    ),
    s(
      env,
      "SELECT * FROM screening_runs WHERE tenant_id=? AND company_id=? ORDER BY initiated_at DESC,rowid DESC LIMIT 1",
      actor.tenant_id,
      c.id,
    ),
  ]);
  const run = runs.results[0];
  if (!run || run.status !== "completed" || !fresh(run.completed_at))
    return {
      current: false,
      blocked: false,
      review: true,
      reason: "screening_unavailable",
    };
  let versions, query;
  try {
    versions = JSON.parse(run.source_versions_json);
    query = JSON.parse(run.query_json);
  } catch {
    return {
      current: false,
      blocked: false,
      review: true,
      reason: "screening_invalid",
    };
  }
  if (
    !versions ||
    Array.isArray(versions) ||
    typeof versions !== "object" ||
    !query ||
    Array.isArray(query) ||
    typeof query !== "object"
  )
    return {
      current: false,
      blocked: false,
      review: true,
      reason: "screening_invalid",
    };
  if (
    !sources.results.length ||
    sources.results.some(
      (r) =>
        !r.version_id ||
        versions[r.id] !== r.version_id ||
        !fresh(r.downloaded_at),
    ) ||
    query.registrationId !== c.registration_id ||
    query.countryCode !== c.country_code ||
    query.legalName !== c.legal_name
  )
    return {
      current: false,
      blocked: false,
      review: true,
      reason: "screening_outdated",
    };
  const matches = await s(
    env,
    `SELECT sm.recommended_action,(SELECT decision FROM screening_decisions sd WHERE sd.tenant_id=sm.tenant_id AND sd.screening_match_id=sm.id ORDER BY decided_at DESC,rowid DESC LIMIT 1) decision FROM screening_matches sm WHERE sm.tenant_id=? AND sm.screening_run_id=?`,
    actor.tenant_id,
    run.id,
  ).all();
  return {
    current: true,
    blocked: matches.results.some(
      (r) =>
        r.decision === "confirmed_block" ||
        (r.recommended_action === "block" && r.decision !== "false_positive"),
    ),
    review: matches.results.some(
      (r) =>
        r.decision === "keep_reviewing" ||
        (r.recommended_action !== "discard" &&
          !["false_positive", "integrity_alert", "confirmed_block"].includes(
            r.decision,
          )),
    ),
    reason: null,
  };
}
export async function snapshot(env, actor, companyId, demandId) {
  const c = await company(env, actor, companyId);
  const d = await s(
    env,
    "SELECT * FROM demands WHERE tenant_id=? AND company_id=? AND id=?",
    actor.tenant_id,
    companyId,
    demandId,
  ).first();
  if (!d)
    fail(
      404,
      "demand_not_found",
      "Demanda não encontrada. Selecione a demanda a avaliar.",
    );
  const [fields, evidence, verifications, risks, tenant] = await env.DB.batch([
    s(
      env,
      "SELECT * FROM demand_fields WHERE tenant_id=? AND demand_id=?",
      actor.tenant_id,
      d.id,
    ),
    s(
      env,
      "SELECT * FROM evidence WHERE tenant_id=? AND company_id=? AND category='business' AND validation_status='valid' AND product_id=? AND market=?",
      actor.tenant_id,
      c.id,
      d.product_id,
      d.market,
    ),
    s(
      env,
      `SELECT * FROM (SELECT cv.*,ROW_NUMBER() OVER(PARTITION BY cv.contact_id,cv.verification_type ORDER BY cv.verified_at DESC,cv.rowid DESC) rank FROM contact_verifications cv JOIN contacts ct ON ct.id=cv.contact_id AND ct.tenant_id=cv.tenant_id WHERE cv.tenant_id=? AND ct.company_id=? AND cv.demand_id=?) WHERE rank=1 AND status='confirmed'`,
      actor.tenant_id,
      c.id,
      d.id,
    ),
    s(
      env,
      `SELECT * FROM (SELECT ro.*,ROW_NUMBER() OVER(PARTITION BY component ORDER BY observed_at DESC,rowid DESC) rank FROM risk_observations ro WHERE tenant_id=? AND company_id=?) WHERE rank=1`,
      actor.tenant_id,
      c.id,
    ),
    s(
      env,
      "SELECT parameter_revision FROM tenants WHERE id=?",
      actor.tenant_id,
    ),
  ]);
  const p = await parameters(env, actor.tenant_id),
    v = confirmedValues(fields.results);
  // Mínimos de fornecedor só poderão entrar via oferta versionada vinculada, não texto livre.
  const minimum = p[`volume_min:${d.commodity}:${d.market}`] ?? null;
  const amount = amountMT(v.volume_per_operation),
    annual = amountMT(v.annual_potential_direct);
  // Localização/raio precisam do adaptador por unidade/campanha (Plano 2); flags manuais não provam distância.
  const potential = calculatePotential(
    {
      market: d.market,
      commodity: d.commodity,
      volumePerOperation: amount,
      operationsPerYear: v.operations_per_year,
      annualPotentialDirect: annual,
      unitCompatible: amount !== null || !v.volume_per_operation,
      specificationConfirmed: v.specification ? true : undefined,
      packagingConfirmed: v.packaging ? true : undefined,
      incotermConfirmed: v.incoterm ? true : undefined,
      deliveryConditionConfirmed: v.delivery_condition ? true : undefined,
      requiredDateConfirmed: v.required_date ? true : undefined,
      logisticsConfirmed: v.logistics_confirmed,
      preciseLocation: undefined,
      insideRadius: undefined,
    },
    { volumeMinimum: minimum },
  );
  const rank =
    d.market === "national"
      ? {
          public_nominal_record: 30,
          commercial_document: 25,
          company_document: 20,
        }
      : { customs_record: 30, bill_of_lading: 25, company_document: 20 };
  const best = evidence.results
    .filter((r) => rank[r.evidence_type])
    .sort(
      (a, b) =>
        rank[b.evidence_type] - rank[a.evidence_type] ||
        String(b.fact_date || "").localeCompare(a.fact_date || ""),
    )[0];
  const age = best?.fact_date
    ? (Date.now() - Date.parse(best.fact_date)) / 2629800000
    : null;
  const types = new Set(verifications.results.map((r) => r.verification_type));
  const authority = verifications.results.some(
    (r) =>
      r.verification_type === "decision_authority" &&
      verifications.results.some(
        (i) =>
          i.contact_id === r.contact_id && i.verification_type === "identity",
      ),
  );
  const confidence = calculateConfidence({
    market: d.market,
    purchaseEvidence: best?.evidence_type,
    recency:
      age === null || !Number.isFinite(age) || age < 0
        ? null
        : age < 6
          ? "under_6_months"
          : age <= 12
            ? "from_6_to_12_months"
            : "over_12_months",
    companyRegistry: v.company_registry_status,
    decisionMaker: authority
      ? "verified_authority"
      : types.has("job_title")
        ? "title_only"
        : null,
    directConfirmation: types.has("direct_demand") ? "demand_confirmed" : null,
  });
  const risk = calculateRisk(
    Object.fromEntries(risks.results.map((r) => [r.component, r.severity])),
  );
  const screen = await currentScreening(env, actor, c, p);
  const rev = tenant.results[0].parameter_revision;
  const approvals = await s(
    env,
    `SELECT * FROM (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY approval_type ORDER BY created_at DESC,rowid DESC) rank FROM approvals a WHERE tenant_id=? AND company_id=? AND demand_id=?) WHERE rank=1`,
    actor.tenant_id,
    c.id,
    d.id,
  ).all();
  const approved = new Set(
    approvals.results
      .filter(
        (a) =>
          a.status === "approved" &&
          a.company_revision === c.revision &&
          a.parameter_revision === rev,
      )
      .map((a) => a.approval_type),
  );
  const comp = completeness(fields.results, d);
  const gp = Object.fromEntries(
    [
      ["confidenceMin", "confidence_min"],
      ["potentialMin", "potential_min"],
      ["completenessMin", "completeness_min"],
      ["riskCoverageMin", "risk_coverage_min"],
    ].map(([key, param]) => [key, requireParameter(p, `${param}:global`)]),
  );
  const gate = evaluateQualificationGate(
    {
      hasBusinessEvidence: !!best,
      confidence: confidence.score,
      potentialMin: potential.scoreMin,
      completeness: comp.score,
      sanctionScreeningCurrent: screen.current,
      sanctionBlocked:
        screen.blocked || c.exception_status === "sanction_blocked",
      sanctionReviewPending:
        screen.review || c.exception_status === "sanction_review",
      riskCoverage: risk.coverage,
      riskCoverageWaiverApproved: approved.has("risk_coverage_waiver"),
      buyerProfileConfirmed: [
        "confirmed_final_consumer",
        "possible_final_consumer",
        "trader_distributor",
      ].includes(v.buyer_profile),
      finalBuyerRequired: !!d.final_buyer_required,
      finalBuyerConfirmed: v.final_buyer === true,
      decisionMakerConfirmed: authority,
      belowMinimum: potential.belowMinimum,
      minimumVolumeApproval: approved.has("below_minimum"),
      riskScore: risk.score,
      mitigationApproved: approved.has("risk_mitigation"),
    },
    gp,
  );
  return {
    company: c,
    demand: d,
    parameterRevision: rev,
    potential,
    confidence,
    risk,
    completeness: comp,
    gate,
    screening: screen,
    parameters: { volumeMinimum: minimum, ...gp },
  };
}
function approvalLock(env, actor, c) {
  return s(
    env,
    "UPDATE companies SET approval_revision=CASE WHEN approval_revision=? THEN approval_revision ELSE -1 END WHERE tenant_id=? AND id=?",
    c.approval_revision,
    actor.tenant_id,
    c.id,
  );
}
function parameterLock(env, actor, rev) {
  return s(
    env,
    "UPDATE tenants SET parameter_revision=CASE WHEN parameter_revision=? THEN parameter_revision ELSE -1 END WHERE id=?",
    rev,
    actor.tenant_id,
  );
}
export async function recalculate(env, actor, requestId, companyId, demandId) {
  requireRole(actor, WRITE_ROLES);
  const x = await snapshot(env, actor, companyId, demandId),
    at = now();
  const results = [
    ["potential", x.potential],
    ["confidence", x.confidence],
    ["risk", x.risk],
  ];
  const response = {
    potential: x.potential,
    confidence: x.confidence,
    risk: x.risk,
    completeness: x.completeness,
    gate: x.gate,
    screening: x.screening,
  };
  // Recompute time-sensitive evidence and gates, but do not append identical scores.
  const previous = await s(
    env,
    `SELECT * FROM (SELECT scores.*,ROW_NUMBER() OVER(PARTITION BY score_type ORDER BY calculated_at DESC,rowid DESC) position FROM scores WHERE tenant_id=? AND company_id=? AND demand_id=?) WHERE position=1`,
    actor.tenant_id,
    companyId,
    demandId,
  ).all();
  if (
    results.every(([type, result]) =>
      previous.results.some(
        (row) =>
          row.score_type === type &&
          row.formula_version === SCORE_VERSION &&
          row.company_revision === x.company.revision &&
          row.parameter_revision === x.parameterRevision &&
          row.components_json === JSON.stringify(result.components) &&
          row.parameters_json === JSON.stringify(x.parameters) &&
          row.score_min === (result.scoreMin ?? result.score ?? null) &&
          row.score_max === (result.scoreMax ?? result.score ?? null) &&
          row.coverage === (result.coverage ?? 0),
      ),
    )
  )
    return { ...response, scoresReused: true };
  // Compare snapshots without changing the revision: approvals remain valid on recalculation.
  const statements = [
    approvalLock(env, actor, x.company),
    s(
      env,
      "UPDATE companies SET revision=CASE WHEN revision=? THEN revision ELSE -1 END WHERE tenant_id=? AND id=?",
      x.company.revision,
      actor.tenant_id,
      companyId,
    ),
    parameterLock(env, actor, x.parameterRevision),
  ];
  for (const [type, result] of results)
    statements.push(
      s(
        env,
        `INSERT INTO scores(id,tenant_id,company_id,demand_id,score_type,score_value,score_min,score_max,coverage,classification,components_json,formula_version,parameters_json,calculated_by,calculated_at,company_revision,parameter_revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        crypto.randomUUID(),
        actor.tenant_id,
        companyId,
        demandId,
        type,
        result.score ?? result.scoreMin ?? null,
        result.scoreMin ?? result.score ?? null,
        result.scoreMax ?? result.score ?? null,
        result.coverage ?? 0,
        type === "potential"
          ? result.belowMinimum
            ? "below_minimum"
            : null
          : (result.state ?? null),
        JSON.stringify(result.components),
        SCORE_VERSION,
        JSON.stringify(x.parameters),
        actor.id,
        at,
        x.company.revision,
        x.parameterRevision,
      ),
    );
  statements.push(
    auditStatement(
      env,
      actor,
      requestId,
      "scores.calculated",
      "demand",
      demandId,
      {
        formulaVersion: SCORE_VERSION,
        companyRevision: x.company.revision,
        parameterRevision: x.parameterRevision,
      },
    ),
  );
  await commit(env, statements);
  return { ...response, scoresReused: false };
}
export async function qualify(env, actor, requestId, companyId, demandId) {
  requireRole(actor, APPROVER_ROLES);
  const x = await snapshot(env, actor, companyId, demandId);
  if (["blocked", "inactive"].includes(x.company.pipeline_status))
    fail(409, "company_blocked", "Empresa bloqueada ou inativa.");
  if (!x.gate.qualified)
    fail(
      409,
      "qualification_gate_failed",
      "A demanda ainda não atende ao gate.",
      { ...x.gate, screening: x.screening },
    );
  await commit(env, [
    approvalLock(env, actor, x.company),
    parameterLock(env, actor, x.parameterRevision),
    companyLock(env, actor, x.company),
    s(
      env,
      "UPDATE companies SET pipeline_status='qualified',exception_status=NULL WHERE tenant_id=? AND id=?",
      actor.tenant_id,
      companyId,
    ),
    auditStatement(
      env,
      actor,
      requestId,
      "company.qualified",
      "company",
      companyId,
      {
        demandId,
        formulaVersion: SCORE_VERSION,
        revision: x.company.revision,
        parameters: x.parameters,
      },
    ),
  ]);
  return { qualified: true, pipelineStatus: "qualified", gate: x.gate };
}
