import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { generateIdentification, IDENT_VERSION } from "../src/templates/identificacao.js";
import { reviewIdentification } from "../src/review.js";

// Mesmo cenário nacional de tests/fichas.test.mjs (açúcar, SP), com o canal geral publicado da empresa.
async function ready(ctx) {
  const { api, env, DB } = ctx;
  Object.assign(env, { EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP", PUBLIC_BASE_URL: "https://compass.exemplo", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64") });
  await api("/api/parameters/send_timezone", "PUT", { scope: "national", value: "America/Sao_Paulo", reason: "Fuso do piloto" });
  DB.raw.prepare("UPDATE channels SET state='internal_test' WHERE channel='email'").run();
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-06", market: "national", name: "Açúcar SP", originCity: "Sertãozinho", originUf: "SP",
    icp: { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
  });
  await api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
  const co = await api("/api/companies", "POST", { legalName: "Doces Vale Verde Ltda.", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES ('u1','eag-internal',?,'11222333000181','05','teste','2026-09-23')").run(co.data.id);
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-06", profileClass: "possible_final_consumer", basis: "CNAE e site" });
  const owner = (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: "Ana Dona", email: "ana@valeverde.com.br", jobTitle: "Sócia-administradora", prospectRole: "provisional_decision_maker", sourceLabel: "QSA", timezone: "America/Sao_Paulo" })).data.id;
  return { campaignId: camp.data.id, companyId: co.data.id, owner };
}

test("Identificação do responsável: canal geral com fonte vira destinatário só da ficha de identificação, sem exigir decisor", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api } = ctx;
  const r = await ready(ctx);
  const ch = (b) => api(`/api/companies/${r.companyId}/channels`, "POST", b);
  assert.equal((await ch({ email: "contato@valeverde.com.br" })).status, 422, "fonte obrigatória");
  const channel = await ch({ email: "contato@valeverde.com.br", sourceUrl: "https://valeverde.com.br/contato", timezone: "America/Sao_Paulo" });
  assert.equal(channel.status, 201);
  assert.equal((await ch({ email: "Contato@valeverde.com.br", sourceUrl: "https://valeverde.com.br/contato" })).status, 409, "sem duplicar o canal");
  const channelId = channel.data.contactId;
  const ficha = (b) => api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, ...b });
  assert.equal((await ficha({ recipients: [channelId] })).data.error.code, "recipient_is_channel", "canal geral não é decisor da ficha de reunião");
  assert.equal((await ficha({ purpose: "identify_buyer", recipients: [r.owner] })).data.error.code, "recipient_not_channel");
  const c = await ficha({ purpose: "identify_buyer", recipients: [channelId] });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  assert.equal(c.data.purpose, "identify_buyer");
  assert.equal(c.data.reviewOk, true, JSON.stringify(c.data.findings));
  assert.deepEqual(c.data.findings, [], "sem aprovação extra de modelo: a aprovação da ficha aprova o texto (R18.3)");
  let f = (await api(`/api/fichas/${c.data.id}`)).data;
  assert.equal(f.version.purpose, "identify_buyer");
  const emails = f.messages.filter((m) => m.kind === "auto_email");
  assert.deepEqual(emails.map((m) => m.day), [0, 4], "E-mail 2 no dia 4, como na skill; dias não seguidos (R19.2 item 12)");
  assert.match(emails[0].body, /Quem é responsável pela compra de açúcar na empresa\?/);
  assert.match(emails[0].body, /contato profissional adequado/);
  assert.equal(emails[1].subject, emails[0].subject, "acompanhamento sem Re:");
  assert.doesNotMatch(emails.map((m) => m.body).join("\n"), /20 minutos|preço|lote|volume/i, "sem reunião nem condição comercial");
  assert.match(emails[0].body, /Rua Exemplo, 100/);
  assert.match(emails[0].body, /"sair"/);
  // Nova versão mantém a finalidade da anterior.
  const v2 = await api(`/api/fichas/${c.data.id}/versions`, "POST", { expectedRowVersion: f.ficha.row_version });
  assert.equal(v2.status, 201, JSON.stringify(v2.data));
  assert.equal(v2.data.reviewOk, true, JSON.stringify(v2.data.findings));
  f = (await api(`/api/fichas/${c.data.id}`)).data;
  assert.equal(f.version.purpose, "identify_buyer");
  // Destinatário aprovado para abordagem só depois da aprovação individual da ficha.
  let people = (await api(`/api/companies/${r.companyId}/people`)).data;
  assert.equal(people.channels[0].approval, "sem aprovação para abordagem");
  const x = f.toApprove.find((a) => a.contactId === channelId);
  const ap = await api(`/api/fichas/${c.data.id}/approve`, "POST", { versionNo: f.version.no, contactId: channelId, channel: "email", messagesSha256: x.messagesSha256, startDate: "2099-01-05" });
  assert.equal(ap.status, 200, JSON.stringify(ap.data));
  people = (await api(`/api/companies/${r.companyId}/people`)).data;
  assert.equal(people.channels[0].approval, "destinatário aprovado para abordagem");
});

test("Identificação em alemão: texto com Sie, assunto e pergunta certos; revisor barra preço/quantidade e dias seguidos, sem aprovação extra", () => {
  const unsub = () => "https://compass.exemplo/u/abc";
  const sig = { senderName: "Rogério Palhari", postalAddress: "Al. Rio Negro, 503 — Barueri/SP, Brasil" };
  const msgs = generateIdentification({ language: "de", commodity: "Rohkaffee", recipients: [{ contactId: "c1", sourceLabel: "Canal geral publicado no site da empresa (site)" }], sig, unsub });
  // Texto de Rogério (2026-09-30), palavra por palavra.
  assert.equal(msgs[0].subject, "Zuständige Person für den Rohkaffee-Einkauf");
  assert.equal(msgs[0].body.split("\n\nRogério Palhari — EAG Agro")[0], "Guten Tag,\n\nmein Name ist Rogério Palhari, ich bin bei EAG Agro in Brasilien tätig. Wir vermitteln Agrarrohstoffe, darunter brasilianischen Rohkaffee.\n\nWer ist in Ihrem Unternehmen für den Einkauf von Rohkaffee zuständig? Könnten Sie meine Nachricht bitte an die zuständige Person weiterleiten oder mir eine geeignete geschäftliche Kontaktadresse nennen?\n\nVielen Dank für Ihre Unterstützung.");
  assert.equal(msgs[1].body.split("\n\nRogério Palhari — EAG Agro")[0], "Guten Tag,\n\nich komme kurz auf meine vorherige Nachricht zurück. Könnten Sie mir bitte mitteilen, an wen ich mich bezüglich des Einkaufs von Rohkaffee wenden kann?\n\nFalls Ihr Unternehmen keinen Rohkaffee einkauft, genügt ein kurzer Hinweis.\n\nVielen Dank.");
  assert.equal(msgs[1].subject, msgs[0].subject);
  assert.match(msgs[0].body, /„abmelden“/);
  const ctx = { market: "international", recipients: [{ contactId: "c1", kind: "company_channel", sourceLabel: "site" }], postalAddress: sig.postalAddress, unsubUrl: unsub, language: "de", languageGapNote: "lacuna", templatesVersion: IDENT_VERSION.de };
  const r = reviewIdentification(msgs, ctx);
  assert.equal(r.ok, true, JSON.stringify(r.findings));
  assert.ok(!r.findings.some((x) => /ID0|aprovação de Rogério/.test(`${x.id} ${x.detail}`)), "nenhuma aprovação extra");
  const fakeReply = msgs.map((m, i) => (i === 1 ? { ...m, subject: `Re: ${m.subject}` } : m));
  assert.ok(reviewIdentification(fakeReply, ctx).findings.some((x) => x.id === "PV4" && !x.ok && /Re:/.test(x.detail)), "Re: sem resposta encadeada é barrado");
  const sameDay = msgs.map((m, i) => (i === 1 ? { ...m, day: 1 } : m));
  assert.ok(reviewIdentification(sameDay, ctx).findings.some((x) => x.id === "R19.2-12" && !x.ok), "dias seguidos barrados");
  const withPrice = msgs.map((m, i) => (i === 0 ? { ...m, body: m.body.replace("Könnten Sie", "Wir haben eine Partie zum besten Preis. Könnten Sie") } : m));
  assert.ok(reviewIdentification(withPrice, ctx).findings.some((x) => x.id === "PV7" && !x.ok));
  const toPerson = reviewIdentification(msgs, { ...ctx, recipients: [{ contactId: "c1", kind: "person" }] });
  assert.ok(toPerson.findings.some((x) => x.id === "DEST" && !x.ok), "identificação só ao canal geral");
});

test("Quatro estados da pessoa: aceitar não confirma compra nem aprova; indício de compra exige fonte e não confirma", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api } = ctx;
  const r = await ready(ctx);
  const add = await api(`/api/companies/${r.companyId}/people`, "POST", { name: "Carla Compra", title: "Einkauf", sourceKind: "company_site", sourceUrl: "https://valeverde.com.br/equipe" });
  const pid = add.data.id;
  assert.equal((await api(`/api/companies/${r.companyId}/people/${pid}`, "PATCH", { purchaseNote: "Viaja à origem" })).status, 422, "indício sem fonte");
  assert.equal((await api(`/api/companies/${r.companyId}/people/${pid}`, "PATCH", { purchaseNote: "Viaja à origem e conhece produtores", purchaseSourceUrl: "https://ihk.example/portrait" })).data.confirms, false);
  await api(`/api/companies/${r.companyId}/people/${pid}/accept`, "POST", {});
  const p = (await api(`/api/companies/${r.companyId}/people`)).data.people.find((x) => x.id === pid);
  assert.deepEqual(p.states, { relevance: "contato relevante aceito", title: "cargo não verificado", purchase: "responsabilidade de compra pendente", approval: "sem aprovação para abordagem" });
  assert.equal(p.purchaseEvidence.confirms, false);
  assert.match(p.purchaseEvidence.note, /conhece produtores/);
});
