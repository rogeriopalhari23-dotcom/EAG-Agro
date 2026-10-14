// E-mail 1 da identificação em português, texto de Rogério de 2026-10-14 (modelo pt 1.3.0): saudação sem nome inventado,
// apresentação como franqueado da EAG Agro, nome da empresa; E-mail 2, transparência, assinatura e descadastro mantidos.
import test from "node:test";
import assert from "node:assert/strict";
import { generateIdentification, companyDisplayName, IDENT_VERSION } from "../src/templates/identificacao.js";
import { reviewIdentification } from "../src/review.js";

const sig = { senderName: "Rogério Palhari", postalAddress: "Rua Exemplo, 100 — Sertãozinho/SP" };
const UNSUB = "https://compass.exemplo/u/x";
const CH = { contactId: "c1", kind: "company_channel", sourceLabel: "Canal geral publicado no site da empresa (site)" };
const gen = (recipients, company = "Cimilho") => generateIdentification({ language: "pt-BR", commodity: "milho", recipients, sig, unsub: () => UNSUB, company });
const review = (msgs, recipients = [CH], companyName = "Cimilho") =>
  reviewIdentification(msgs, { market: "national", recipients, postalAddress: sig.postalAddress, postalAddressConfirmed: true, unsubUrl: () => UNSUB, language: "pt-BR", companyName });
const bad = (r) => r.findings.filter((x) => !x.ok).map((x) => x.id);
const E1 = [
  "Boa tarde, tudo bem?",
  "",
  "Meu nome é Rogerio Palhari e trabalho com originação de commodities agrícolas. Atuo como franqueado da EAG Agro e estou buscando o contato da pessoa responsável pela compra de milho na Cimilho.",
  "",
  "Você poderia me indicar quem cuida dessa área e qual seria o melhor canal para conversar?",
  "",
  "Obrigado pela atenção.",
].join("\n");

test("E-mail 1 (pt 1.3.0): texto de Rogério, canal geral sem nome, empresa citada; revisor sem violações", () => {
  assert.equal(IDENT_VERSION["pt-BR"], "id-pt-1.4.0");
  const msgs = gen([CH]);
  assert.ok(msgs[0].body.startsWith(E1 + "\n\n"), msgs[0].body.slice(0, 400));
  assert.equal(msgs[0].subject, "Responsável pela compra de milho");
  assert.equal(bad(review(msgs)).length, 0, JSON.stringify(bad(review(msgs))));
  assert.doesNotMatch(msgs.map((m) => m.body).join("\n"), /GMO|transg|preço|disponib|volume|condiç|\{\{/i);
  assert.ok(msgs[0].html.includes("franqueado da EAG Agro"), "HTML com o mesmo texto");
});

test("Canal geral nunca recebe nome, mesmo se vier um nome; pessoa com nome confirmado recebe", () => {
  assert.equal(gen([{ ...CH, confirmedName: "Fulano" }])[0].body.split("\n")[0], "Boa tarde, tudo bem?");
  const person = { contactId: "p1", kind: "person", sourceLabel: "site", confirmedName: "Maria" };
  assert.equal(gen([person])[0].body.split("\n")[0], "Boa tarde, Maria, tudo bem?");
  assert.equal(gen([{ ...person, confirmedName: "  " }])[0].body.split("\n")[0], "Boa tarde, tudo bem?", "nome vazio não conta");
});

test("Nome da empresa é obrigatório em português; nome com ponto final não duplica o ponto", () => {
  assert.throws(() => gen([CH], ""), /Nome da empresa obrigatório/);
  assert.throws(() => gen([CH], null), /Nome da empresa obrigatório/);
  assert.throws(() => gen([CH], "  "), /Nome da empresa obrigatório/);
  const m = gen([CH], "Moinho Ltda.")[0].body;
  assert.match(m, /na Moinho Ltda\.\n/);
  assert.doesNotMatch(m, /Ltda\.\./);
  assert.equal(bad(review(gen([CH], "Moinho Ltda."), [CH], "Moinho Ltda.")).length, 0);
});

test("Revisor barra nome no canal geral, marcador {{…}} sobrando, empresa ausente, GMO e preço", () => {
  const ok = gen([CH]);
  const edit = (fn) => ok.map((m) => (m.step === 1 ? { ...m, body: fn(m.body) } : m));
  assert.ok(bad(review(edit((b) => b.replace("Boa tarde, tudo bem?", "Boa tarde, João, tudo bem?")))).includes("SAUDACAO"));
  assert.ok(bad(review(edit((b) => b.replace("na Cimilho.", "na {{empresa}}.")))).includes("SAUDACAO"));
  assert.ok(bad(review(edit((b) => b.replace("na Cimilho.", "na empresa.")))).includes("SAUDACAO"));
  assert.ok(bad(review(edit((b) => b.replace("compra de milho na", "compra de milho GMO na")))).includes("AFIRMACAO"));
  assert.ok(bad(review(edit((b) => b.replace("Obrigado pela atenção.", "Temos preço competitivo. Obrigado pela atenção.")))).includes("PV7"));
});

test("E-mail 2, assinatura, transparência e descadastro não mudam", () => {
  const [, e2] = gen([CH]);
  assert.equal(e2.step, 2);
  assert.equal(e2.day, 4);
  assert.ok(e2.body.startsWith("Olá,\n\nRetomo brevemente minha mensagem anterior. Poderia indicar com quem devo falar sobre a compra de milho?\n\nSe a empresa não compra milho, uma breve confirmação já ajuda.\n\nObrigado."));
  for (const m of gen([CH])) {
    assert.ok(m.body.includes("Encontrei este endereço no site da empresa. Pedidos sobre dados pessoais: rogeriopalhari@hotmail.com."));
    assert.ok(m.body.includes(`Para não receber mais mensagens, responda "sair" ou use este link: ${UNSUB}`));
    assert.ok(m.body.includes(sig.postalAddress));
  }
});

test("Nome de exibição da empresa: nome fantasia sem o rótulo da unidade; sem fantasia, a razão social", () => {
  assert.equal(companyDisplayName({ trade_name: "Rei do Milho — fábrica, Inhumas", legal_name: "REI DO MILHO ALIMENTOS LTDA" }), "Rei do Milho");
  assert.equal(companyDisplayName({ trade_name: "São Martinho — Usina Boa Vista" }), "São Martinho");
  assert.equal(companyDisplayName({ trade_name: "Cimilho" }), "Cimilho");
  assert.equal(companyDisplayName({ trade_name: null, legal_name: "Doces Vale Verde Ltda." }), "Doces Vale Verde Ltda.");
});
