import test from "node:test";
import assert from "node:assert/strict";
import { generateSequenceEn, commodityDisplayEn, GAP_NOTE, TEMPLATES_EN_VERSION } from "../src/templates/prospeccao-vendas-en.js";
import { generateSequence, commodityDisplay } from "../src/templates/prospeccao-vendas.js";
import { reviewSequence } from "../src/review.js";

const UNSUB = (id) => `https://compass.exemplo/u/${id}`;
const recipients = [
  { contactId: "dm", role: "decision_maker", fullName: "anna weber", jobTitle: "Head of Purchasing", sourceLabel: "LinkedIn", linkedin: true },
  { contactId: "inf", role: "influencer", fullName: "Jonas Keller", jobTitle: "Quality Manager", sourceLabel: "website" },
];
const sig = { senderName: "Rogério Palhari", postalAddress: "Rua Exemplo, 100 — Sertãozinho/SP, Brazil" };
const ctx = (over = {}) => ({
  market: "international", commodity: "coffee", otherCommodities: ["sugar", "soybean", "corn"], declarations: {},
  recipients, postalAddress: sig.postalAddress, unsubUrl: UNSUB, language: "en", languageGapNote: GAP_NOTE, translationApproved: true, templatesVersion: TEMPLATES_EN_VERSION, ...over,
});
const seq = (over = {}) => generateSequenceEn({ commodity: "coffee", recipients, sig, unsub: UNSUB, ...over });
const failed = (r) => r.findings.filter((x) => !x.ok).map((x) => x.id);

test("P3-T9: a sequência padrão em inglês passa no próprio revisor", () => {
  const r = reviewSequence(seq(), ctx());
  assert.deepEqual(failed(r), []);
  const e1 = seq().find((m) => m.step === 1 && m.contactId === "dm");
  assert.equal(e1.subject, "Coffee supplier");
  assert.match(e1.body, /^Hi Anna, I hope you're well\.\nI found your contact on LinkedIn/);
  assert.match(e1.body, /To stop receiving these messages, reply "unsubscribe" or use this link: https:\/\/compass\.exemplo\/u\/dm$/);
});

test("P3-T9: mesma estrutura do português — passos, dias, canais e objetivos idênticos", () => {
  const pt = generateSequence({ commodity: "café", recipients, sig, unsub: UNSUB });
  const shape = (list) => list.map((m) => [m.contactId, m.channel, m.kind, m.step, m.day, m.objective]);
  assert.deepEqual(shape(seq()), shape(pt));
});

test("P3-T9: 'competitive price' reprova PV7 (AT24)", () => {
  const msgs = seq();
  msgs[0].body = msgs[0].body.replace("we trade commodities", "we trade commodities at a competitive price");
  assert.ok(failed(reviewSequence(msgs, ctx())).includes("PV7"));
});

test("P3-T9: assunto com estatística reprova PV9 (AT55)", () => {
  const msgs = seq();
  msgs[0].subject = "70% of manufacturers struggle";
  assert.ok(failed(reviewSequence(msgs, ctx())).includes("PV9"));
});

test("P3-T9: pedido de desculpas reprova PV10; volume sem declaração reprova PV7", () => {
  const msgs = seq();
  msgs[1].body = "Sorry to bother you again.\n" + msgs[1].body;
  assert.ok(failed(reviewSequence(msgs, ctx())).includes("PV10"));
  const vol = seq({ declarations: { volumeAvailable: true } });
  assert.match(vol[0].body, /relevant volume of coffee available/);
  assert.ok(failed(reviewSequence(vol, ctx({ declarations: {} }))).includes("PV7"));
  assert.deepEqual(failed(reviewSequence(vol, ctx({ declarations: { volumeAvailable: true } }))), []);
});

test("P3-T9: ficha internacional sem a lacuna 🔴 ou com tradução não aprovada não passa (PV12, R28.15)", () => {
  assert.ok(failed(reviewSequence(seq(), ctx({ languageGapNote: null }))).includes("PV12"));
  const pending = reviewSequence(seq(), ctx({ translationApproved: false }));
  assert.ok(failed(pending).includes("PV12"));
  assert.match(pending.findings.find((x) => x.id === "PV12").detail, /aguardando aprovação de Rogério/);
  // Português (país lusófono) não depende da aprovação da tradução, mas precisa da lacuna.
  const pt = generateSequence({ commodity: "café", recipients, sig, unsub: UNSUB });
  assert.deepEqual(failed(reviewSequence(pt, ctx({ language: "pt-BR", translationApproved: false, commodity: "café", otherCommodities: ["açúcar"] }))), []);
});

test("P3-T9: nomes em inglês do catálogo; sigla preservada nos dois idiomas; sem nome → nulo (não inventa)", () => {
  assert.equal(commodityDisplayEn({ commodity: "soy_meal" }), "soybean meal");
  assert.equal(commodityDisplayEn({ commodity: "ddgs" }), "DDGS");
  assert.equal(commodityDisplayEn({ commodity: "cso" }), null);
  assert.equal(commodityDisplay({ group_name: "Coprodutos", variant_name: "DDGS" }), "DDGS");
  const ddgs = generateSequenceEn({ commodity: "DDGS", recipients, sig, unsub: UNSUB });
  assert.deepEqual(failed(reviewSequence(ddgs, ctx({ commodity: "DDGS" }))), []);
});
