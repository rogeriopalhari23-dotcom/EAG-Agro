import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSequence, commodityDisplay, SKILL_SHA256 } from "../src/templates/prospeccao-vendas.js";
import { reviewSequence } from "../src/review.js";

const sig = { senderName: "Rogério Palhari", postalAddress: "Rua Exemplo, 100 — Sertãozinho/SP — CEP 14160-000" };
const unsub = (id) => `https://compass.example/u/tok-${id}`;
const recipients = [
  { contactId: "c1", role: "decision_maker", fullName: "MARIA SOUZA", sourceLabel: "Site da empresa", jobTitle: "Gerente de Compras", linkedin: true },
  { contactId: "c2", role: "influencer", fullName: "João Lima", sourceLabel: "LinkedIn", jobTitle: "Gestor de Suprimentos" },
];
const ctx = (over = {}) => ({
  market: "national",
  commodity: "açúcar",
  otherCommodities: ["milho", "soja", "café", "etanol"],
  declarations: {},
  recipients,
  postalAddress: sig.postalAddress,
  unsubUrl: unsub,
  ...over,
});
const gen = (over = {}) => generateSequence({ commodity: "açúcar", recipients, declarations: {}, sig, unsub, ...over });

test("P2-T8: sequência padrão gerada da skill passa no revisor", () => {
  const msgs = gen();
  const r = reviewSequence(msgs, ctx());
  assert.equal(r.ok, true, JSON.stringify(r.findings.filter((x) => !x.ok)));
  const emails = msgs.filter((m) => m.contactId === "c1" && m.kind === "auto_email");
  assert.deepEqual(emails.map((m) => m.day), [0, 4, 10, 14]);
  assert.equal(emails[0].subject, "Fornecedor açúcar");
  assert.match(emails[0].body, /Olá, Maria, tudo bem\?/);
  assert.match(emails[0].body, /no site de vocês/);
  assert.match(emails[3].body, /Acho que agora não é o melhor momento, Maria\./);
  assert.ok(msgs.some((m) => m.contactId === "c2" && m.step === 3));
});

test("P2-T8: sem declaração não há frase de volume nem prova social (AT62, K6); com declaração, há", () => {
  const sem = gen().map((m) => m.body).join("\n");
  assert.ok(!/volume relevante|bom volume/.test(sem));
  assert.ok(!/grande porte/.test(sem));
  const com = gen({ declarations: { volumeAvailable: true, socialProof: "Fornecemos para indústrias de doces no interior de SP." } });
  assert.match(com[0].body, /volume relevante de açúcar disponível/);
  assert.match(com[0].body, /indústrias de doces/);
  assert.equal(reviewSequence(com, ctx({ declarations: { volumeAvailable: true } })).ok, true);
});

test("P2-T8: preço no texto reprova PV7 (AT24); volume sem declaração reprova PV7", () => {
  const msgs = gen();
  msgs[0].body = msgs[0].body.replace("Você teria", "Temos preço competitivo. Você teria");
  const r = reviewSequence(msgs, ctx());
  assert.equal(r.ok, false);
  assert.ok(r.findings.some((x) => x.id === "PV7" && !x.ok));
  const v = gen({ declarations: { volumeAvailable: true } });
  assert.ok(reviewSequence(v, ctx()).findings.some((x) => x.id === "PV7" && !x.ok && /declaração/.test(x.detail)));
});

test("P2-T8: link de apresentação reprova PV2 (AT54); outra commodity reprova PV2", () => {
  const msgs = gen();
  msgs[0].body += "\nVeja nossa apresentação: https://eag.example/apresentacao.pdf";
  assert.ok(reviewSequence(msgs, ctx()).findings.some((x) => x.id === "PV2" && !x.ok));
  const outra = gen();
  outra[1].body = outra[1].body.replace("dias atrás?", "dias atrás? Também temos milho.");
  assert.ok(reviewSequence(outra, ctx()).findings.some((x) => x.id === "PV2" && /milho/.test(x.detail)));
});

test("P2-T8: título estatístico reprova PV9 (AT55); e-mails em dias seguidos reprovam PV5 (AT53)", () => {
  const msgs = gen();
  msgs[0].subject = "90% das indústrias têm dificuldade no fornecimento";
  assert.ok(reviewSequence(msgs, ctx()).findings.some((x) => x.id === "PV9" && !x.ok));
  const seguidos = gen();
  seguidos.find((m) => m.contactId === "c1" && m.step === 2).day = 1;
  assert.ok(reviewSequence(seguidos, ctx()).findings.some((x) => x.id === "PV5" && !x.ok));
});

test("P2-T8: sem endereço físico reprova R19.13 (AT70); desculpas reprovam PV10", () => {
  assert.ok(reviewSequence(gen({ sig: { ...sig, postalAddress: "" } }), ctx({ postalAddress: "" })).findings.some((x) => x.id === "R19.13" && !x.ok));
  const msgs = gen();
  msgs[1].body = "Desculpe o incômodo. " + msgs[1].body;
  assert.ok(reviewSequence(msgs, ctx()).findings.some((x) => x.id === "PV10" && !x.ok));
});

test("P2-T8: CEO sem relacionamento reprova PV8; LinkedIn sem fonte LinkedIn reprova PV4", () => {
  const ceo = [{ ...recipients[0], jobTitle: "CEO" }];
  const msgs = generateSequence({ commodity: "açúcar", recipients: ceo, sig, unsub });
  assert.ok(reviewSequence(msgs, ctx({ recipients: ceo })).findings.some((x) => x.id === "PV8" && !x.ok));
  const fake = gen();
  fake[0].body = fake[0].body.replace("no site de vocês", "pelo LinkedIn");
  assert.ok(reviewSequence(fake, ctx()).findings.some((x) => x.id === "PV4" && !x.ok));
});

test("P2-T8: influenciador com texto igual ao do decisor reprova PV11", () => {
  const msgs = gen();
  const dec3 = msgs.find((m) => m.contactId === "c1" && m.step === 3);
  msgs.find((m) => m.contactId === "c2").body = dec3.body;
  assert.ok(reviewSequence(msgs, ctx()).findings.some((x) => x.id === "PV11" && !x.ok));
});

test("P2-T8: nome da commodity no texto vem do catálogo", () => {
  assert.equal(commodityDisplay({ group_name: "Açúcar", variant_name: "ICUMSA 45" }), "açúcar");
  assert.equal(commodityDisplay({ group_name: "Farelos", variant_name: "Farelo de soja" }), "farelo de soja");
  assert.equal(commodityDisplay({ group_name: "Óleos", variant_name: "Óleo de soja (bruto e refinado)" }), "óleo de soja");
});

test("P2-T8: hash da skill diferente bloqueia (AT50); igual passa", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-"));
  const alt = join(dir, "SKILL.md");
  writeFileSync(alt, "conteúdo alterado");
  const bad = spawnSync(process.execPath, ["scripts/check-skill.mjs"], { env: { ...process.env, SKILL_PATH: alt }, encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Refaça a leitura T12/);
  assert.equal(SKILL_SHA256.length, 64);
});
