export const SCORE_VERSION = "1.3.0";

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

export function calculatePotential(input, parameters = {}) {
  const commodity = input.commodity;
  const volume = input.volumePerOperation;
  const operations = input.operationsPerYear;
  const minimum = parameters.volumeMinimum ?? (commodity === "sugar" ? 500 : null);
  const annualDerived = isNumber(volume) && isNumber(operations) ? volume * operations : null;
  const annual = isNumber(input.annualPotentialDirect) ? input.annualPotentialDirect : annualDerived;
  const components = {};

  if (isNumber(volume) && commodity === "sugar") {
    components.volume = volume < 500 ? 0 : volume < 1000 ? 10 : volume < 2000 ? 20 : 30;
  } else if (isNumber(volume) && commodity === "coffee" && isNumber(minimum) && minimum > 0) {
    components.volume = volume < minimum ? 0 : volume < 2 * minimum ? 10 : volume < 4 * minimum ? 20 : 30;
  }

  if (isNumber(annual) && commodity === "sugar") {
    components.annual = annual < 3000 ? 5 : annual < 6000 ? 10 : 20;
  } else if (isNumber(annual) && commodity === "coffee" && isNumber(minimum) && minimum > 0) {
    components.annual = annual < 2 * minimum ? 5 : annual < 6 * minimum ? 10 : 20;
  }

  if (isNumber(operations)) components.recurrence = operations <= 1 ? 0 : operations <= 4 ? 8 : operations <= 11 ? 15 : 20;
  if (typeof input.specificationConfirmed === "boolean" || typeof input.packagingConfirmed === "boolean") {
    components.technical = (input.specificationConfirmed ? 10 : 0) + (input.packagingConfirmed ? 5 : 0);
  }
  if (typeof input.incotermConfirmed === "boolean" || typeof input.requiredDateConfirmed === "boolean") {
    components.readiness = (input.incotermConfirmed ? 5 : 0) + (input.requiredDateConfirmed ? 5 : 0);
  }
  if (typeof input.logisticsConfirmed === "boolean") components.logistics = input.logisticsConfirmed ? 5 : 0;

  const maxima = { volume: 30, annual: 20, recurrence: 20, technical: 15, readiness: 10, logistics: 5 };
  const observed = Object.values(components).reduce((sum, value) => sum + value, 0);
  const observedMaximum = Object.keys(components).reduce((sum, key) => sum + maxima[key], 0);
  const unknownMaximum = 100 - observedMaximum;
  const directDivergence = isNumber(input.annualPotentialDirect) && isNumber(annualDerived) && input.annualPotentialDirect !== 0
    ? Math.abs(input.annualPotentialDirect - annualDerived) / input.annualPotentialDirect
    : 0;

  return {
    scoreMin: clamp(observed),
    scoreMax: clamp(observed + unknownMaximum),
    coverage: observedMaximum,
    components,
    annualPotentialDirect: input.annualPotentialDirect ?? null,
    annualPotentialDerived: annualDerived,
    annualPotentialUsed: annual,
    annualDivergenceAlert: directDivergence > 0.1,
    belowMinimum: isNumber(volume) && isNumber(minimum) ? volume < minimum : null,
    version: SCORE_VERSION
  };
}

export function calculateConfidence(input) {
  const evidencePoints = { customs_record: 30, bill_of_lading: 25, company_document: 20 };
  const recencyPoints = { under_6_months: 20, from_6_to_12_months: 15, over_12_months: 5 };
  const registryPoints = { verified_active: 15, partially_verified: 8 };
  const decisionMakerPoints = { verified_authority: 15, title_only: 5 };
  const directPoints = { demand_confirmed: 20, initial_response: 15 };
  const components = {
    purchaseEvidence: evidencePoints[input.purchaseEvidence] ?? 0,
    recency: recencyPoints[input.recency] ?? 0,
    companyRegistry: registryPoints[input.companyRegistry] ?? 0,
    decisionMaker: decisionMakerPoints[input.decisionMaker] ?? 0,
    directConfirmation: directPoints[input.directConfirmation] ?? 0
  };
  return { score: Object.values(components).reduce((sum, value) => sum + value, 0), components, version: SCORE_VERSION };
}

export const RISK_WEIGHTS = { registration: 1, credit: 1.25, payment: 1.25, reputation: 0.75, logistics: 0.75 };

export function calculateRisk(input) {
  let weightedSeverity = 0;
  let consultedWeight = 0;
  const components = {};
  for (const [name, weight] of Object.entries(RISK_WEIGHTS)) {
    const severity = input[name];
    if (!isNumber(severity)) continue;
    const normalized = clamp(severity, 0, 20);
    components[name] = { severity: normalized, weight, contribution: normalized * weight };
    weightedSeverity += normalized * weight;
    consultedWeight += weight;
  }
  const coverage = consultedWeight / 5 * 100;
  const score = consultedWeight === 0 ? null : weightedSeverity / (20 * consultedWeight) * 100;
  const state = coverage < 50 ? "inconclusive" : coverage < 100 ? "provisional" : "complete";
  const band = score === null || coverage < 50 ? null : score < 50 ? "low" : score < 70 ? "medium" : score < 80 ? "high" : "very_high";
  return { score: score === null ? null : Number(score.toFixed(2)), coverage: Number(coverage.toFixed(2)), state, band, components, version: SCORE_VERSION };
}

export function calculateCompleteness(fields) {
  const required = fields.filter((field) => field.required && field.status !== "not_applicable");
  const confirmed = required.filter((field) => field.status === "confirmed");
  return {
    score: required.length === 0 ? 0 : Number((confirmed.length / required.length * 100).toFixed(2)),
    confirmed: confirmed.length,
    applicableRequired: required.length,
    missing: required.filter((field) => field.status !== "confirmed").map((field) => field.key)
  };
}

export function evaluateQualificationGate(context, parameters) {
  const checks = [
    ["business_evidence", context.hasBusinessEvidence === true],
    ["confidence", isNumber(context.confidence) && context.confidence >= parameters.confidenceMin],
    ["potential", isNumber(context.potentialMin) && context.potentialMin >= parameters.potentialMin],
    ["completeness", isNumber(context.completeness) && context.completeness >= parameters.completenessMin],
    ["sanctions", !context.sanctionBlocked && !context.sanctionReviewPending],
    ["risk_coverage", (isNumber(context.riskCoverage) && context.riskCoverage >= parameters.riskCoverageMin) || context.riskCoverageWaiverApproved],
    ["final_buyer", context.finalBuyerConfirmed === true],
    ["decision_maker", context.decisionMakerConfirmed === true],
    ["minimum_volume", context.belowMinimum !== true || context.minimumVolumeApproval],
    ["risk_mitigation", !isNumber(context.riskScore) || context.riskScore < 80 || context.mitigationApproved]
  ];
  const pending = checks.filter(([, passed]) => !passed).map(([key]) => key);
  return { qualified: pending.length === 0, pending, checks: Object.fromEntries(checks), version: SCORE_VERSION };
}

export function evaluateSanctionMatch(input) {
  if (input.blockedCountry === true) return { action:"block", reason:"blocked_country" };
  if (input.reliableIdentifierMatch === true && input.countryCompatible === true) return { action:"block", reason:"official_id_country" };
  if (input.nameMatch === true) return { action:"review", reason:"name_only" };
  return { action:"clear", reason:"no_match" };
}

export function canPerform(role, action) {
  const matrix = {
    read:["admin","commercial_manager","seller_analyst","auditor_viewer"],
    edit_operational:["admin","commercial_manager","seller_analyst"],
    approve_exception:["admin","commercial_manager"],
    manage_parameters:["admin"],
    review_sanction:["admin"]
  };
  return (matrix[action] || []).includes(role);
}
