// E2-b (decisão de Rogério, 2026-10-09): o e-mail de identificação em português traz no rodapé a origem do endereço
// (só quando a fonte é o site) e o canal do titular (O2). Nova versão da ficha preserva a anterior.
import "./helpers/signature.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { generateIdentification, IDENT_VERSION } from "../src/templates/identificacao.js";
import { reviewIdentification } from "../src/review.js";
import { DATA_REQUESTS_EMAIL } from "../src/privacy-contact.js";

const sig = { senderName: "Rogério Palhari", postalAddress: "Rua Exemplo, 100 — Sertãozinho/SP" };
const UNSUB = "https://compass.exemplo/u/x";
const LINE_SITE = `Encontrei este endereço no site da empresa. Pedidos sobre dados pessoais: ${DATA_REQUESTS_EMAIL}.`;
const LINE_ONLY = `Pedidos sobre dados pessoais: ${DATA_REQUESTS_EMAIL}.`;
const gen = (sourceLabel, language = "pt-BR", commodity = "milho") =>
  generateIdentification({ language, commodity, recipients: [{ contactId: "c1", sourceLabel }], sig, unsub: () => UNSUB });
const review = (msgs, sourceLabel) =>
  reviewIdentification(msgs, { market: "national", recipients: [{ contactId: "c1", kind: "company_channel", sourceLabel }], postalAddress: sig.postalAddress, postalAddressConfirmed: true, unsubUrl: () => UNSUB, language: "pt-BR" });

test("E2-b: modelo pt 1.2.0; com fonte no site, a linha completa fica no rodapé antes da saída, nos dois passos e no HTML", () => {
  assert.equal(IDENT_VERSION["pt-BR"], "id-pt-1.2.0");
  assert.equal(DATA_REQUESTS_EMAIL, "rogeriopalhari@hotmail.com", "O2 decidido em 08/10/2026");
  const msgs = gen("Canal geral publicado no site da empresa (site) — verificado em 2026-10-08");
  assert.equal(msgs.length, 2);
  for (const m of msgs) {
    const lines = m.body.split("\n");
    const i = lines.indexOf(LINE_SITE);
    assert.ok(i > 0, `passo ${m.step} com a linha de transparência`);
    assert.equal(lines[i - 1], sig.postalAddress, "depois do endereço físico");
    assert.match(lines[i + 1], /^Para não receber mais mensagens, responda "sair"/, "antes da linha de saída");
    assert.ok(m.html.includes(DATA_REQUESTS_EMAIL), `HTML do passo ${m.step} com o canal do titular`);
  }
  const r = review(msgs, "Canal geral publicado no site da empresa (site)");
  assert.equal(r.ok, true, JSON.stringify(r.findings.filter((x) => !x.ok)));
  assert.ok(r.findings.some((x) => x.id === "TRANSP" && x.ok));
  // Nada de GMO, preço ou condição: a linha nova não muda o corpo.
  assert.doesNotMatch(msgs.map((m) => m.body).join("\n"), /GMO|transg|preço|disponib|condiç/i);
});

test("E2-b: fonte que não é o site não afirma origem (PV4) — entra só o canal do titular", () => {
  const msgs = gen("Canal geral publicado em diretório (diretório) — verificado em 2026-10-08");
  for (const m of msgs) {
    assert.ok(m.body.split("\n").includes(LINE_ONLY), `passo ${m.step} com o canal do titular`);
    assert.doesNotMatch(m.body, /no site da empresa/);
  }
  assert.equal(review(msgs, "Canal geral publicado em diretório (diretório)").ok, true);
});

test("E2-b: revisor barra e-mail sem o canal do titular e origem 'site' com fonte de diretório", () => {
  const noLine = gen("site").map((m) => ({ ...m, body: m.body.replace(LINE_SITE, "") }));
  const r1 = review(noLine, "site");
  assert.equal(r1.ok, false);
  assert.match(r1.findings.find((x) => x.id === "TRANSP").detail, /Passo 1, 2/);
  const wrongOrigin = gen("site");
  const r2 = review(wrongOrigin, "Canal geral publicado em diretório (diretório)");
  assert.equal(r2.findings.find((x) => x.id === "TRANSP").ok, false, "afirma site sem fonte no site");
});

test("E2-b: alemão e inglês não mudam (decisão só para o português)", () => {
  for (const [lang, c] of [["de", "Rohkaffee"], ["en", "corn"]]) {
    for (const m of gen("site", lang, c)) assert.ok(!m.body.includes(DATA_REQUESTS_EMAIL), `${lang} sem a linha`);
  }
  assert.equal(IDENT_VERSION.de, "id-de-1.1.0");
  assert.equal(IDENT_VERSION.en, "id-en-1.0.0");
});

test("E2-b: nova versão da ficha usa o modelo novo, fica aguardando revisão e preserva a versão anterior", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api, env, DB } = ctx;
  Object.assign(env, { SENDER_NAME: "EAG Agro - Brasil", EAG_POSTAL_ADDRESS: sig.postalAddress, EAG_POSTAL_ADDRESS_CONFIRMED: sig.postalAddress, PUBLIC_BASE_URL: "https://compass.exemplo", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64") });
  await api("/api/parameters/send_timezone", "PUT", { scope: "national", value: "America/Sao_Paulo", reason: "Fuso do piloto" });
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-03", market: "national", name: "Milho GMO teste", originCity: "Indiara", originUf: "GO", radiusKm: 300,
    icp: { userSectors: ["ração"], sizeTarget: "medium", region: "GO", decisionRole: "Compras", influencerRole: "Suprimentos" },
  });
  assert.equal(camp.data.status, "draft", "campanha fica em rascunho");
  const co = await api("/api/companies", "POST", { legalName: "Moinho Teste Ltda.", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  const prof = await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-03", profileClass: "possible_final_consumer", basis: "site" });
  const p = (await api(`/api/companies/${co.data.id}/profiles`)).data.items[0];
  if (p.icp_status === "pending_size") await api(`/api/profiles/${p.id}`, "PATCH", { expectedRevision: p.revision, sizeCallGoal: true });
  assert.ok([200, 201].includes(prof.status));
  const ch = await api(`/api/companies/${co.data.id}/channels`, "POST", { email: "contato@moinho.com.br", sourceUrl: "https://moinho.com.br/contato", timezone: "America/Sao_Paulo" });
  const c = await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: camp.data.id, purpose: "identify_buyer", recipients: [ch.data.contactId] });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  // Simula a ficha criada antes do modelo novo: a versão 1 fica registrada como 1.1.0.
  DB.raw.prepare("UPDATE ficha_versions SET templates_version='id-pt-1.1.0' WHERE ficha_id=? AND version_no=1").run(c.data.id);
  const v1 = DB.raw.prepare("SELECT id,snapshot_sha256,templates_version FROM ficha_versions WHERE ficha_id=? AND version_no=1").get(c.data.id);
  const before = (await api(`/api/fichas/${c.data.id}`)).data;
  const v2 = await api(`/api/fichas/${c.data.id}/versions`, "POST", { expectedRowVersion: before.ficha.row_version });
  assert.equal(v2.status, 201, JSON.stringify(v2.data));
  assert.equal(v2.data.reviewOk, true, JSON.stringify(v2.data.findings));
  const f = (await api(`/api/fichas/${c.data.id}`)).data;
  assert.equal(f.ficha.status, "in_approval", "aguardando revisão; nada aprovado");
  assert.equal(f.version.no, 2);
  assert.equal(f.version.templates, "id-pt-1.2.0");
  assert.ok(f.messages.every((m) => m.body.includes(LINE_SITE)), "texto novo nos dois passos");
  const old = DB.raw.prepare("SELECT snapshot_sha256,templates_version,superseded_at FROM ficha_versions WHERE id=?").get(v1.id);
  assert.equal(old.snapshot_sha256, v1.snapshot_sha256, "versão anterior intacta");
  assert.equal(old.templates_version, "id-pt-1.1.0");
  assert.ok(old.superseded_at, "versão anterior marcada como substituída, não apagada");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM ficha_approvals WHERE version_id IN (SELECT id FROM ficha_versions WHERE ficha_id=?)").get(c.data.id).n, 0, "nenhuma aprovação");
});
