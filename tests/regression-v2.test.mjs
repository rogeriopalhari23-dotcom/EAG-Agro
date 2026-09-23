import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePotential,
  calculateConfidence,
  evaluateQualificationGate,
} from "../src/scoring.js";
const full = {
  market: "national",
  commodity: "corn",
  volumePerOperation: 250,
  operationsPerYear: 12,
  specificationConfirmed: true,
  packagingConfirmed: true,
  deliveryConditionConfirmed: true,
  requiredDateConfirmed: true,
  logisticsConfirmed: true,
  preciseLocation: true,
  insideRadius: true,
};
const params = {
  confidenceMin: 50,
  potentialMin: 40,
  completenessMin: 60,
  riskCoverageMin: 50,
};
const gate = {
  hasBusinessEvidence: true,
  confidence: 80,
  potentialMin: 85,
  completeness: 80,
  sanctionScreeningCurrent: true,
  sanctionBlocked: false,
  sanctionReviewPending: false,
  riskCoverage: 100,
  buyerProfileConfirmed: true,
  finalBuyerRequired: false,
  decisionMakerConfirmed: true,
  riskScore: 20,
};
test("AT45 PN1: nacional completo = 90", () =>
  assert.equal(calculatePotential(full, { volumeMinimum: 100 }).scoreMin, 90));
test("AT46 PN2: localização estimada e campos desconhecidos = 35–90", () => {
  const p = calculatePotential(
    {
      market: "national",
      commodity: "corn",
      volumePerOperation: 250,
      specificationConfirmed: true,
      packagingConfirmed: true,
      logisticsConfirmed: true,
      preciseLocation: false,
    },
    { volumeMinimum: 100 },
  );
  assert.equal(p.scoreMin, 35);
  assert.equal(p.scoreMax, 90);
});
test("AT47 PN3: mínimo nacional ausente = 50–100", () => {
  const p = calculatePotential(full);
  assert.equal(p.scoreMin, 50);
  assert.equal(p.scoreMax, 100);
  assert.equal(p.belowMinimum, null);
});
test("AT48 PN4: volume 60 abaixo de M=100 = 70", () => {
  const p = calculatePotential(
    { ...full, volumePerOperation: 60 },
    { volumeMinimum: 100 },
  );
  assert.equal(p.scoreMin, 70);
  assert.equal(p.belowMinimum, true);
});
test("AT49 PN5: fora do raio = 85", () =>
  assert.equal(
    calculatePotential({ ...full, insideRadius: false }, { volumeMinimum: 100 })
      .scoreMin,
    85,
  ));
test("Mínimo ausente não é inventado para açúcar", () =>
  assert.equal(
    calculatePotential(
      { commodity: "sugar", volumePerOperation: 270 },
      { volumeMinimum: null },
    ).belowMinimum,
    null,
  ));
test("Recência sem evidência não pontua", () =>
  assert.equal(calculateConfidence({ recency: "under_6_months" }).score, 0));
test("AT40 CN1 documento nacional = 60", () =>
  assert.equal(
    calculateConfidence({
      market: "national",
      purchaseEvidence: "company_document",
      recency: "under_6_months",
      companyRegistry: "verified_active",
      decisionMaker: "title_only",
    }).score,
    60,
  ));
test("AT41 CN2 registro nominal = 80", () =>
  assert.equal(
    calculateConfidence({
      market: "national",
      purchaseEvidence: "public_nominal_record",
      recency: "over_12_months",
      companyRegistry: "verified_active",
      decisionMaker: "verified_authority",
      directConfirmation: "initial_response",
    }).score,
    80,
  ));
test("AT42 CN3 sem evidência = 30", () =>
  assert.equal(
    calculateConfidence({
      market: "national",
      recency: "under_6_months",
      companyRegistry: "verified_active",
      directConfirmation: "initial_response",
    }).score,
    30,
  ));
test("AT43 CN4 cadastro parcial = 8", () =>
  assert.equal(
    calculateConfidence({
      market: "national",
      companyRegistry: "partially_verified",
    }).score,
    8,
  ));
test("AT44 CN5 internacional = 80", () =>
  assert.equal(
    calculateConfidence({
      market: "international",
      purchaseEvidence: "customs_record",
      recency: "under_6_months",
      companyRegistry: "verified_active",
      decisionMaker: "verified_authority",
    }).score,
    80,
  ));
test("Campos técnicos parcialmente conhecidos preservam incerteza", () => {
  const p = calculatePotential({ specificationConfirmed: true });
  assert.equal(p.scoreMin, 10);
  assert.equal(p.scoreMax, 100);
});
test("Nulos e negativos não geram pontos", () => {
  const p = calculatePotential({
    volumePerOperation: -1,
    operationsPerYear: null,
  });
  assert.equal(p.scoreMin, 0);
  assert.equal(p.coverage, 0);
});
test("AT12 v2: trader confirmado sem condição de comprador final pode qualificar", () =>
  assert.equal(evaluateQualificationGate(gate, params).qualified, true));
test("AT12 v2: condição de comprador final permanece obrigatória quando aplicável", () =>
  assert.ok(
    evaluateQualificationGate(
      { ...gate, finalBuyerRequired: true, finalBuyerConfirmed: false },
      params,
    ).pending.includes("final_buyer"),
  ));
test("Sanções sem triagem bloqueiam, mesmo sem matches", () =>
  assert.ok(
    evaluateQualificationGate(
      { ...gate, sanctionScreeningCurrent: false },
      params,
    ).pending.includes("sanctions"),
  ));
