export const SCORE_VERSION = "2.0.0";
const valid = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
export function calculatePotential(input, parameters = {}) {
  const national = input.market === "national",
    sugar = !national && input.commodity === "sugar";
  const compatible = input.unitCompatible !== false;
  const volume =
    compatible && valid(input.volumePerOperation)
      ? input.volumePerOperation
      : null;
  const operations =
    Number.isInteger(input.operationsPerYear) && input.operationsPerYear >= 0
      ? input.operationsPerYear
      : null;
  const minimum =
    valid(parameters.volumeMinimum) && parameters.volumeMinimum > 0
      ? parameters.volumeMinimum
      : null;
  const derived =
    volume !== null && operations !== null ? volume * operations : null;
  const direct =
    compatible && valid(input.annualPotentialDirect)
      ? input.annualPotentialDirect
      : null;
  const annual = direct ?? derived;
  const components = {},
    maxima = {};
  const add = (name, value, max) => {
    if (value !== null) {
      components[name] = value;
      maxima[name] = max;
    }
  };
  if (volume !== null && (sugar || minimum !== null)) {
    const m = sugar ? 500 : minimum;
    add(
      "volume",
      volume < m ? 0 : volume < 2 * m ? 10 : volume < 4 * m ? 20 : 30,
      30,
    );
  }
  if (annual !== null && (sugar || minimum !== null))
    add(
      "annual",
      sugar
        ? annual < 3000
          ? 5
          : annual < 6000
            ? 10
            : 20
        : annual < 2 * minimum
          ? 5
          : annual < 6 * minimum
            ? 10
            : 20,
      20,
    );
  if (operations !== null)
    add(
      "recurrence",
      operations <= 1 ? 0 : operations <= 4 ? 8 : operations <= 11 ? 15 : 20,
      20,
    );
  for (const [key, field, max] of [
    ["specification", "specificationConfirmed", 10],
    ["packaging", "packagingConfirmed", 5],
    [
      "delivery",
      national ? "deliveryConditionConfirmed" : "incotermConfirmed",
      5,
    ],
    ["requiredDate", "requiredDateConfirmed", 5],
  ])
    if (typeof input[field] === "boolean")
      add(key, input[field] ? max : 0, max);
  if (national) {
    if (
      input.logisticsConfirmed === false ||
      (input.preciseLocation === true && input.insideRadius === false)
    )
      add("logistics", 0, 5);
    else if (
      input.logisticsConfirmed === true &&
      input.preciseLocation === true &&
      input.insideRadius === true
    )
      add("logistics", 5, 5);
  } else if (typeof input.logisticsConfirmed === "boolean")
    add("logistics", input.logisticsConfirmed ? 5 : 0, 5);
  const scoreMin = Object.values(components).reduce((a, b) => a + b, 0),
    coverage = Object.values(maxima).reduce((a, b) => a + b, 0);
  return {
    scoreMin,
    scoreMax: scoreMin + 100 - coverage,
    coverage,
    components,
    annualPotentialDirect: direct,
    annualPotentialDerived: derived,
    annualPotentialUsed: annual,
    annualDivergenceAlert:
      direct !== null &&
      derived !== null &&
      (direct === 0
        ? derived !== 0
        : Math.abs(direct - derived) / direct > 0.1),
    belowMinimum: volume !== null && minimum !== null ? volume < minimum : null,
    version: SCORE_VERSION,
  };
}
export function calculateConfidence(input) {
  const points =
    input.market === "national"
      ? {
          public_nominal_record: 30,
          commercial_document: 25,
          company_document: 20,
        }
      : { customs_record: 30, bill_of_lading: 25, company_document: 20 };
  const evidence = points[input.purchaseEvidence] ?? 0;
  const components = {
    purchaseEvidence: evidence,
    recency: evidence
      ? ({ under_6_months: 20, from_6_to_12_months: 15, over_12_months: 5 }[
          input.recency
        ] ?? 0)
      : 0,
    companyRegistry:
      { verified_active: 15, partially_verified: 8 }[input.companyRegistry] ??
      0,
    decisionMaker:
      { verified_authority: 15, title_only: 5 }[input.decisionMaker] ?? 0,
    directConfirmation:
      { demand_confirmed: 20, initial_response: 15 }[
        input.directConfirmation
      ] ?? 0,
  };
  return {
    score: Object.values(components).reduce((a, b) => a + b, 0),
    components,
    version: SCORE_VERSION,
  };
}
export const RISK_WEIGHTS = {
  registration: 1,
  credit: 1.25,
  payment: 1.25,
  reputation: 0.75,
  logistics: 0.75,
};
export function calculateRisk(input) {
  let weighted = 0,
    weightTotal = 0;
  const components = {};
  for (const [key, weight] of Object.entries(RISK_WEIGHTS)) {
    const severity = input[key];
    if (!valid(severity) || severity > 20) continue;
    components[key] = { severity, weight, contribution: severity * weight };
    weighted += severity * weight;
    weightTotal += weight;
  }
  const coverage = (weightTotal / 5) * 100,
    score = weightTotal
      ? Number(((weighted / (20 * weightTotal)) * 100).toFixed(2))
      : null;
  return {
    score,
    coverage: Number(coverage.toFixed(2)),
    state:
      coverage < 50
        ? "inconclusive"
        : coverage < 100
          ? "provisional"
          : "complete",
    band:
      coverage < 50
        ? null
        : score < 50
          ? "low"
          : score < 70
            ? "medium"
            : score < 80
              ? "high"
              : "very_high",
    components,
    version: SCORE_VERSION,
  };
}
export function calculateCompleteness(fields) {
  const required = fields.filter(
      (f) => f.required && f.status !== "not_applicable",
    ),
    confirmed = required.filter((f) => f.status === "confirmed");
  return {
    score: required.length
      ? Number(((confirmed.length / required.length) * 100).toFixed(2))
      : 0,
    confirmed: confirmed.length,
    applicableRequired: required.length,
    missing: required.filter((f) => f.status !== "confirmed").map((f) => f.key),
  };
}
export function evaluateQualificationGate(c, p) {
  const checks = Object.fromEntries([
    ["business_evidence", c.hasBusinessEvidence === true],
    [
      "confidence",
      valid(c.confidence) &&
        valid(p.confidenceMin) &&
        c.confidence >= p.confidenceMin,
    ],
    [
      "potential",
      valid(c.potentialMin) &&
        valid(p.potentialMin) &&
        c.potentialMin >= p.potentialMin,
    ],
    [
      "completeness",
      valid(c.completeness) &&
        valid(p.completenessMin) &&
        c.completeness >= p.completenessMin,
    ],
    [
      "sanctions",
      c.sanctionScreeningCurrent === true &&
        c.sanctionBlocked !== true &&
        c.sanctionReviewPending !== true,
    ],
    [
      "risk_coverage",
      (valid(c.riskCoverage) &&
        valid(p.riskCoverageMin) &&
        c.riskCoverage >= p.riskCoverageMin) ||
        c.riskCoverageWaiverApproved === true,
    ],
    ["buyer_profile", c.buyerProfileConfirmed === true],
    [
      "final_buyer",
      c.finalBuyerRequired !== true || c.finalBuyerConfirmed === true,
    ],
    ["decision_maker", c.decisionMakerConfirmed === true],
    [
      "minimum_volume",
      c.belowMinimum !== true || c.minimumVolumeApproval === true,
    ],
    [
      "risk_mitigation",
      !valid(c.riskScore) || c.riskScore < 80 || c.mitigationApproved === true,
    ],
  ]);
  const pending = Object.keys(checks).filter((k) => !checks[k]);
  return {
    qualified: pending.length === 0,
    pending,
    checks,
    version: SCORE_VERSION,
  };
}
export function evaluateSanctionMatch(input) {
  if (input.blockedCountry === true)
    return { action: "block", reason: "blocked_country" };
  if (
    input.reliableIdentifierMatch === true &&
    input.countryCompatible === true
  )
    return { action: "block", reason: "official_id_country" };
  if (input.nameMatch === true)
    return { action: "review", reason: "name_only" };
  return { action: "clear", reason: "no_match" };
}

export function canPerform(role, action) {
  const matrix = {
    read: ["admin", "commercial_manager", "seller_analyst", "auditor_viewer"],
    edit_operational: ["admin", "commercial_manager", "seller_analyst"],
    approve_exception: ["admin", "commercial_manager"],
    manage_parameters: ["admin"],
    review_sanction: ["admin"],
  };
  return (matrix[action] || []).includes(role);
}
