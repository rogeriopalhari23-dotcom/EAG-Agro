import "./helpers/signature.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { generateIdentification, IDENT_VERSION } from "../src/templates/identificacao.js";
import { reviewIdentification } from "../src/review.js";
import { SIGNATURE } from "../src/templates/assinatura.js";
// Assinatura de teste (a real vem do HTML original da Hostinger, importado e conferido por Rogério).
const TEST_SIG = { ...SIGNATURE, status: "confirmed", html: '<table id="assinatura-teste"><tr><td>Rogerio Palhari</td></tr></table>' };
const withSig = (fn) => async (t) => {
  const saved = { status: SIGNATURE.status, html: SIGNATURE.html };
  Object.assign(SIGNATURE, { status: TEST_SIG.status, html: TEST_SIG.html });
  t.after(() => Object.assign(SIGNATURE, saved));
  return fn(t);
};

// Mesmo cenário nacional de tests/fichas.test.mjs (açúcar, SP), com o canal geral publicado da empresa.
async function ready(ctx) {
  const { api, env, DB } = ctx;
  Object.assign(env, { EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP", EAG_POSTAL_ADDRESS_CONFIRMED: "Rua Exemplo, 100 — Sertãozinho/SP", PUBLIC_BASE_URL: "https://compass.exemplo", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64") });
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

test("Identificação do responsável: canal geral com fonte vira destinatário só da ficha de identificação, sem exigir decisor", withSig(async (t) => {
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
  assert.deepEqual(c.data.findings, [], "com a assinatura conferida, nenhuma pendência do revisor");
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
  // Assinatura oficial uma vez no texto e no HTML congelado; rodapé separado com endereço e descadastro.
  assert.equal(f.messages[0].body.split("Rogerio Palhari\nBroker | EAG AGRO").length, 2);
  assert.equal(f.messages[0].html.split('<table id="assinatura-teste">').length, 2);
  assert.match(f.messages[0].html, /border-top:1px solid #ddd[\s\S]*Rua Exemplo, 100[\s\S]*sair/);
}));

test("Assinatura pendente de importação ou de conferência: ficha de identificação não é aprovável (SIG)", async (t) => {
  const unsub = () => "https://compass.exemplo/u/abc";
  const sig = { senderName: "Rogério Palhari", postalAddress: "Al. Rio Negro, 503 — Barueri/SP, Brasil" };
  const msgs = generateIdentification({ language: "de", commodity: "Rohkaffee", recipients: [{ contactId: "c1" }], sig, unsub });
  const ctx = { market: "international", recipients: [{ contactId: "c1", kind: "company_channel" }], postalAddress: sig.postalAddress, postalAddressConfirmed: true, unsubUrl: unsub, language: "de", languageGapNote: "lacuna", templatesVersion: IDENT_VERSION.de };
  const pendingLogo = { ...TEST_SIG, status: "pending_logo", html: '<img src="LOGO_EAG_HTTPS">' };
  assert.deepEqual(reviewIdentification(msgs, { ...ctx, signature: pendingLogo }).findings.filter((x) => !x.ok).map((x) => x.id), ["SIG"]);
  assert.match(reviewIdentification(msgs, { ...ctx, signature: pendingLogo }).findings.find((x) => x.id === "SIG").detail, /logo original pendente/);
  const pendingVisual = reviewIdentification(msgs, { ...ctx, signature: { ...TEST_SIG, status: "imported_pending_visual" } });
  assert.match(pendingVisual.findings.find((x) => x.id === "SIG").detail, /conferência visual/);
});

test("Identificação em alemão: texto com Sie, assunto e pergunta certos; revisor barra preço/quantidade e dias seguidos, sem aprovação extra", () => {
  const unsub = () => "https://compass.exemplo/u/abc";
  const sig = { senderName: "Rogério Palhari", postalAddress: "Al. Rio Negro, 503 — Barueri/SP, Brasil" };
  const msgs = generateIdentification({ language: "de", commodity: "Rohkaffee", recipients: [{ contactId: "c1", sourceLabel: "Canal geral publicado no site da empresa (site)" }], sig, unsub });
  // Texto de Rogério (2026-09-30), palavra por palavra.
  assert.equal(msgs[0].subject, "Zuständige Person für den Rohkaffee-Einkauf");
  assert.equal(msgs[0].body.split("\n\nRogerio Palhari\nBroker | EAG AGRO")[0], "Guten Tag,\n\nmein Name ist Rogério Palhari, ich bin bei EAG Agro in Brasilien tätig. Wir vermitteln Agrarrohstoffe, darunter brasilianischen Rohkaffee.\n\nWer ist in Ihrem Unternehmen für den Einkauf von Rohkaffee zuständig? Könnten Sie meine Nachricht bitte an die zuständige Person weiterleiten oder mir eine geeignete geschäftliche Kontaktadresse nennen?\n\nVielen Dank für Ihre Unterstützung.");
  assert.equal(msgs[1].body.split("\n\nRogerio Palhari\nBroker | EAG AGRO")[0], "Guten Tag,\n\nich komme kurz auf meine vorherige Nachricht zurück. Könnten Sie mir bitte mitteilen, an wen ich mich bezüglich des Einkaufs von Rohkaffee wenden kann?\n\nFalls Ihr Unternehmen keinen Rohkaffee einkauft, genügt ein kurzer Hinweis.\n\nVielen Dank.");
  assert.equal(msgs[1].subject, msgs[0].subject);
  assert.match(msgs[0].body, /„abmelden“/);
  const ctx = { market: "international", recipients: [{ contactId: "c1", kind: "company_channel", sourceLabel: "site" }], postalAddress: sig.postalAddress, postalAddressConfirmed: true, unsubUrl: unsub, language: "de", languageGapNote: "lacuna", templatesVersion: IDENT_VERSION.de };
  const r = reviewIdentification(msgs, { ...ctx, signature: TEST_SIG });
  assert.equal(r.ok, true, JSON.stringify(r.findings.filter((x) => !x.ok)));
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

test("R19.13: endereço sem confirmação de Rogério é pendência do revisor e bloqueia a aprovação; versão com endereço antigo também", withSig(async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api, env } = ctx;
  const r = await ready(ctx);
  delete env.EAG_POSTAL_ADDRESS_CONFIRMED;
  const channelId = (await api(`/api/companies/${r.companyId}/channels`, "POST", { email: "contato@valeverde.com.br", sourceUrl: "https://valeverde.com.br/contato", timezone: "America/Sao_Paulo" })).data.contactId;
  const c = await api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, purpose: "identify_buyer", recipients: [channelId] });
  assert.equal(c.status, 201, "a ficha é criada e fica em revisão");
  assert.equal(c.data.reviewOk, false);
  assert.deepEqual(c.data.findings.map((x) => x.id), ["R19.13"]);
  assert.match(c.data.findings[0].detail, /sem confirmação de Rogério/);
  const approve = async () => {
    const f = (await api(`/api/fichas/${c.data.id}`)).data;
    const x = f.toApprove.find((a) => a.contactId === channelId);
    return api(`/api/fichas/${c.data.id}/approve`, "POST", { versionNo: f.version.no, contactId: channelId, channel: "email", messagesSha256: x.messagesSha256, startDate: "2099-01-05" });
  };
  assert.equal((await approve()).data.error.code, "review_failed");
  // Confirmado depois: nova versão passa no revisor; se a confirmação sumir, a aprovação volta a bloquear.
  env.EAG_POSTAL_ADDRESS_CONFIRMED = env.EAG_POSTAL_ADDRESS;
  let f = (await api(`/api/fichas/${c.data.id}`)).data;
  const v2 = await api(`/api/fichas/${c.data.id}/versions`, "POST", { expectedRowVersion: f.ficha.row_version });
  assert.equal(v2.data.reviewOk, true, JSON.stringify(v2.data.findings));
  delete env.EAG_POSTAL_ADDRESS_CONFIRMED;
  assert.equal((await approve()).data.error.code, "postal_address_unconfirmed");
  // Endereço trocado e confirmado depois da versão: a versão com o endereço antigo não é aprovada.
  Object.assign(env, { EAG_POSTAL_ADDRESS: "Rua Nova, 200 — Sertãozinho/SP", EAG_POSTAL_ADDRESS_CONFIRMED: "Rua Nova, 200 — Sertãozinho/SP" });
  assert.equal((await approve()).data.error.code, "postal_address_outdated");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM ficha_approvals").get().n, 0);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM send_outbox").get().n, 0);
}));
