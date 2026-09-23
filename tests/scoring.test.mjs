import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCompleteness,
  calculateConfidence,
  calculatePotential,
  calculateRisk,
  canPerform,
  evaluateQualificationGate,
  evaluateSanctionMatch,
} from "../src/scoring.js";

test("AT2 — Potential de açúcar resulta em 85", () => {
  const result = calculatePotential({
    commodity: "sugar",
    volumePerOperation: 1500,
    operationsPerYear: 6,
    specificationConfirmed: true,
    packagingConfirmed: true,
    incotermConfirmed: true,
    requiredDateConfirmed: true,
    logisticsConfirmed: true,
  });
  assert.equal(result.scoreMin, 85);
  assert.equal(result.scoreMax, 85);
});

test("AT3 — Potential de café FoodEra resulta em 85", () => {
  const result = calculatePotential(
    {
      commodity: "coffee",
      volumePerOperation: 10,
      operationsPerYear: 6,
      specificationConfirmed: true,
      packagingConfirmed: true,
      incotermConfirmed: true,
      requiredDateConfirmed: true,
      logisticsConfirmed: true,
    },
    { volumeMinimum: 5 },
  );
  assert.equal(result.scoreMin, 85);
});

test("AT5 — Confidence é independente da completude", () => {
  const confidence = calculateConfidence({
    purchaseEvidence: "customs_record",
    recency: "under_6_months",
    companyRegistry: "verified_active",
    decisionMaker: "verified_authority",
  });
  assert.equal(confidence.score, 80);
  const completeness = calculateCompleteness([
    { key: "a", required: true, status: "confirmed" },
    { key: "b", required: true, status: "not_confirmed" },
  ]);
  assert.equal(completeness.score, 50);
});

test("AT7 — não se aplica sai do denominador", () => {
  const result = calculateCompleteness([
    { key: "a", required: true, status: "confirmed" },
    { key: "b", required: true, status: "not_applicable" },
  ]);
  assert.deepEqual(result, {
    score: 100,
    confirmed: 1,
    applicableRequired: 1,
    missing: [],
  });
});

test("AT10 — Risk parcial é normalizado e inconclusivo", () => {
  const result = calculateRisk({ registration: 0, reputation: 8 });
  assert.equal(result.score, 17.14);
  assert.equal(result.coverage, 35);
  assert.equal(result.state, "inconclusive");
});

test("AT11 — risco 84 sem mitigação impede qualificação", () => {
  const result = evaluateQualificationGate(
    {
      hasBusinessEvidence: true,
      confidence: 80,
      potentialMin: 85,
      completeness: 80,
      sanctionBlocked: false,
      sanctionReviewPending: false,
      riskCoverage: 100,
      finalBuyerConfirmed: true,
      decisionMakerConfirmed: true,
      belowMinimum: false,
      riskScore: 84,
      mitigationApproved: false,
    },
    {
      confidenceMin: 50,
      potentialMin: 40,
      completenessMin: 60,
      riskCoverageMin: 50,
    },
  );
  assert.equal(result.qualified, false);
  assert.ok(result.pending.includes("risk_mitigation"));
});

test("AT1 — açúcar abaixo de 500 MT recebe indicação abaixo do mínimo", () => {
  const result = calculatePotential(
    { commodity: "sugar", volumePerOperation: 270, operationsPerYear: 1 },
    { volumeMinimum: 500 },
  );
  assert.equal(result.belowMinimum, true);
  assert.equal(result.components.volume, 0);
});

test("AT4 — potencial anual direto prevalece e divergência acima de 10% alerta", () => {
  const result = calculatePotential({
    commodity: "sugar",
    volumePerOperation: 1500,
    operationsPerYear: 6,
    annualPotentialDirect: 8000,
  });
  assert.equal(result.annualPotentialUsed, 8000);
  assert.equal(result.annualPotentialDerived, 9000);
  assert.equal(result.annualDivergenceAlert, true);
});

test("AT6 — não confirmado permanece no denominador", () => {
  const result = calculateCompleteness([
    { key: "a", required: true, status: "confirmed" },
    { key: "b", required: true, status: "not_confirmed" },
  ]);
  assert.equal(result.applicableRequired, 2);
  assert.equal(result.score, 50);
  assert.deepEqual(result.missing, ["b"]);
});

test("AT8 — sanção apenas por nome sempre exige revisão", () => {
  assert.deepEqual(
    evaluateSanctionMatch({
      nameMatch: true,
      reliableIdentifierMatch: false,
      countryCompatible: true,
    }),
    { action: "review", reason: "name_only" },
  );
});

test("AT9 — identificador confiável e país compatível bloqueiam", () => {
  assert.deepEqual(
    evaluateSanctionMatch({
      nameMatch: true,
      reliableIdentifierMatch: true,
      countryCompatible: true,
    }),
    { action: "block", reason: "official_id_country" },
  );
});

test("AT13 — Coverage 40% impede qualificação sem dispensa", () => {
  const result = evaluateQualificationGate(
    {
      hasBusinessEvidence: true,
      confidence: 80,
      potentialMin: 85,
      completeness: 80,
      sanctionBlocked: false,
      sanctionReviewPending: false,
      riskCoverage: 40,
      riskCoverageWaiverApproved: false,
      finalBuyerConfirmed: true,
      decisionMakerConfirmed: true,
      belowMinimum: false,
      riskScore: 20,
    },
    {
      confidenceMin: 50,
      potentialMin: 40,
      completenessMin: 60,
      riskCoverageMin: 50,
    },
  );
  assert.ok(result.pending.includes("risk_coverage"));
});

test("AT14 — RBAC respeita os quatro perfis", () => {
  assert.equal(canPerform("admin", "manage_parameters"), true);
  assert.equal(canPerform("commercial_manager", "approve_exception"), true);
  assert.equal(canPerform("seller_analyst", "edit_operational"), true);
  assert.equal(canPerform("seller_analyst", "manage_parameters"), false);
  assert.equal(canPerform("auditor_viewer", "edit_operational"), false);
});
