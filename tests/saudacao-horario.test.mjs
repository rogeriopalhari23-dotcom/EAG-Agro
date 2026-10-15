// Saudação pelo horário do envio (pedido de Rogério, 2026-10-14; modelo pt 1.4.0, A-ID8): o E-mail 1 que começa com
// "Boa tarde" ganha na geração a variante "Bom dia". As duas são revisadas, mostradas e aprovadas juntas; no envio, antes
// das 12:00 no fuso do destinatário sai "Bom dia" e a partir das 12:00 sai "Boa tarde". Nada é regenerado no envio: cada
// texto tem o próprio hash, conferido até a saída.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setup } from "./helpers/db.mjs";
import { tick, approvedMessage, greetingVariant } from "../src/sending.js";
import { buildCopy } from "../src/internal-copy.js";
import { morningVariant } from "../src/templates/identificacao.js";
import { memoryR2 } from "./helpers/trade.mjs";

const DAY = "2099-01-05"; // segunda-feira
const atSP = (hhmm, day = DAY) => new Date(`${day}T${hhmm}:00-03:00`).toISOString(); // hora de São Paulo
const ADDRESS = "Rua Exemplo, 100 — Sertãozinho/SP";
const EVIDENCE = ["decisions", "legal_basis", "transfer_mechanism", "incident_register", "erasure_test"].map((kind, i) => ({ kind, reference: `evidência de teste ${kind}`, sha256: "abcde"[i].repeat(64) }));
function transport() {
  const sent = [];
  return { sent, send: async (m) => (sent.push(m), { kind: "accepted" }) };
}

// Ficha de identificação de milho (canal geral publicado no site), pronta para aprovar; T11 validada no banco de teste.
async function world(ctx, { tz = "America/Sao_Paulo" } = {}) {
  const { api, env, DB } = ctx;
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: ADDRESS, EAG_POSTAL_ADDRESS_CONFIRMED: ADDRESS, SENDER_NAME: "EAG Agro - Brasil",
    PUBLIC_BASE_URL: "https://compass.exemplo", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), MAILBOX_USER: "rogeriopalhari@eagagro.com",
  });
  const put = (key, scope, value) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Parâmetro do teste" });
  await put("send_timezone", "national", "America/Sao_Paulo");
  await put("send_window", "national", { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] });
  await put("sanctions_max_age_hours", "global", 24);
  await put("email_validation_max_age_days", "email", 30);
  DB.raw.prepare("UPDATE channels SET state='enabled',evidence_ref='teste: canal habilitado só no banco em memória' WHERE channel='email'").run();
  for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
    const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt: new Date().toISOString() });
    await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Sem Relação Nenhuma" }] });
    await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
  }
  const t11 = await api("/api/compliance/t11", "POST", { scope: "br_email_automatic", decision: "validated", responsible: "Rogério Palhari (teste)", decidedOn: new Date().toISOString().slice(0, 10), basis: "Registro de teste", confirm: true, evidence: EVIDENCE });
  assert.equal(t11.status, 201, JSON.stringify(t11.data));
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-03", market: "national", name: "Milho teste", originCity: "Indiara", originUf: "GO", radiusKm: 300,
    icp: { userSectors: ["ração"], sizeTarget: "medium", region: "GO", decisionRole: "Compras", influencerRole: "Suprimentos" },
  });
  await api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
  const co = await api("/api/companies", "POST", { legalName: "Moinho Teste Ltda.", tradeName: "Moinho Teste — unidade 1", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  assert.equal(co.status, 201, JSON.stringify(co.data));
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-03", profileClass: "possible_final_consumer", basis: "site" });
  const p = (await api(`/api/companies/${co.data.id}/profiles`)).data.items[0];
  if (p.icp_status === "pending_size") await api(`/api/profiles/${p.id}`, "PATCH", { expectedRevision: p.revision, sizeCallGoal: true });
  await api(`/api/companies/${co.data.id}/screening`, "POST", {});
  const ch = await api(`/api/companies/${co.data.id}/channels`, "POST", { email: "contato@moinho.com.br", sourceUrl: "https://moinho.com.br/contato", timezone: tz });
  assert.ok([200, 201].includes(ch.status), JSON.stringify(ch.data));
  const contactId = ch.data.contactId;
  DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at='2099-01-01T12:00:00.000Z' WHERE id=?").run(contactId);
  const c = await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: camp.data.id, purpose: "identify_buyer", recipients: [contactId] });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  const id = c.data.id;
  const view = async () => (await api(`/api/fichas/${id}`)).data;
  const approve = async () => {
    const x = (await view()).toApprove.find((a) => a.channel === "email");
    return api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY });
  };
  return { id, contactId, view, approve };
}
const step1 = (DB) => ({ ...DB.raw.prepare("SELECT * FROM send_outbox WHERE step_no=1").get() });
const firstLine = (m) => m.text.split("\n")[0];

test("Geração: o E-mail 1 tem a variante 'Bom dia' que só troca a saudação; revisor confere as duas; E-mail 2 sem variante", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const w = await world(ctx);
  const f = await w.view();
  assert.equal(f.version.templates, "id-pt-1.5.0");
  assert.equal(f.version.reviewOk, true, JSON.stringify(f.version.findings.filter((x) => !x.ok)));
  const [e1, e2] = f.messages.sort((a, b) => a.step - b.step);
  assert.equal(e1.body.split("\n")[0], "Boa tarde, tudo bem?");
  assert.equal(e1.morning.body.split("\n")[0], "Bom dia, tudo bem?");
  assert.equal(e1.morning.body, e1.body.replace(/^Boa tarde/, "Bom dia"), "só a saudação muda");
  assert.equal(e1.morning.html, e1.html.replace("Boa tarde", "Bom dia"), "HTML com a mesma troca");
  assert.ok(e1.morning.body.includes("compra de milho na Moinho Teste."));
  assert.notEqual(e1.morning.sha256, e1.sha256, "cada texto com o próprio hash");
  assert.equal(e2.morning, null, "E-mail 2 começa com 'Olá' e não tem variante");
  assert.doesNotMatch(`${e1.body}\n${e1.morning.body}`, /\{\{|\}\}/);
});

test("Aprovação cobre os dois textos: hash do conjunto inclui a variante e a outbox congela os dois hashes", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api, DB } = ctx;
  const w = await world(ctx);
  const f = await w.view();
  const x = f.toApprove.find((a) => a.channel === "email");
  // Hash calculado só com os textos principais (sem a variante) é recusado: a aprovação precisa ver as duas saudações.
  const { approvalHash } = await import("../src/fichas.js");
  const onlyMain = await approvalHash(f.messages.sort((a, b) => a.step - b.step).map((m) => m.sha256));
  assert.notEqual(onlyMain, x.messagesSha256);
  const bad = await api(`/api/fichas/${w.id}/approve`, "POST", { versionNo: 1, contactId: w.contactId, channel: "email", messagesSha256: onlyMain, startDate: DAY });
  assert.equal(bad.status, 409);
  assert.equal(bad.data.error.code, "content_changed");
  assert.equal((await w.approve()).status, 200);
  const e1 = f.messages.find((m) => m.step === 1);
  const o = step1(DB);
  assert.equal(o.message_sha256, e1.sha256);
  assert.equal(o.message_am_sha256, e1.morning.sha256);
  assert.equal(o.greeting_variant, null);
  assert.equal(DB.raw.prepare("SELECT message_am_sha256 FROM send_outbox WHERE step_no=2").get().message_am_sha256, null);
});

for (const [hhmm, expected] of [["09:00", "Bom dia, tudo bem?"], ["11:59", "Bom dia, tudo bem?"], ["12:00", "Boa tarde, tudo bem?"], ["16:30", "Boa tarde, tudo bem?"]]) {
  test(`Envio às ${hhmm} (São Paulo) sai com "${expected}" e o passo registra a variante`, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    const { env, DB } = ctx;
    const w = await world(ctx);
    assert.equal((await w.approve()).status, 200);
    const tr = transport();
    const r = await tick(env, "eag-internal", { transport: tr, now: atSP(hhmm) });
    assert.equal(r.sent, 1, JSON.stringify(r));
    assert.equal(firstLine(tr.sent[0]), expected);
    const o = step1(DB);
    assert.equal(o.status, "accepted");
    assert.equal(o.greeting_variant, expected.startsWith("Bom dia") ? "am" : null);
    // O que saiu é exatamente um dos dois textos aprovados (texto e HTML).
    const approved = await approvedMessage(env, o, o.greeting_variant);
    assert.equal(tr.sent[0].text, approved.body);
    assert.equal(tr.sent[0].html, approved.html);
  });
}

test("Horário é o do destinatário: 12:30 em São Paulo é 11:30 em Manaus (Bom dia lá); 13:00 em São Paulo é 12:00 em Manaus", () => {
  const row = { message_am_sha256: "x" };
  assert.equal(greetingVariant(row, atSP("12:30"), "America/Sao_Paulo"), null);
  assert.equal(greetingVariant(row, atSP("12:30"), "America/Manaus"), "am");
  assert.equal(greetingVariant(row, atSP("13:00"), "America/Manaus"), null);
});

test("Sem variante aprovada (versões antigas ou texto que não começa com 'Boa tarde'), sai sempre o texto principal", () => {
  assert.equal(greetingVariant({ message_am_sha256: null }, atSP("09:30"), "America/Sao_Paulo"), null);
  assert.equal(morningVariant({ body: "Olá,\n\nTexto" }), null);
  assert.equal(morningVariant({ body: "Boa tarde, tudo bem?\n\nTexto", html: "<p>Boa tarde, tudo bem?</p><p>Boa tarde</p>" }).html, "<p>Bom dia, tudo bem?</p><p>Boa tarde</p>", "só a primeira ocorrência");
});

test("Variante adulterada não sai: hash diferente do aprovado bloqueia o passo (content_mismatch)", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { env, DB } = ctx;
  const w = await world(ctx);
  assert.equal((await w.approve()).status, 200);
  DB.raw.prepare("UPDATE send_outbox SET message_am_sha256=? WHERE step_no=1").run("0".repeat(64));
  const tr = transport();
  await tick(env, "eag-internal", { transport: tr, now: atSP("10:00") });
  assert.equal(tr.sent.length, 0);
  assert.deepEqual({ status: step1(DB).status, reason: step1(DB).block_reason }, { status: "blocked", reason: "content_mismatch" });
});

test("Texto congelado é imutável: o hash da variante não pode ser trocado na mensagem da ficha", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { DB } = ctx;
  await world(ctx);
  assert.throws(() => DB.raw.prepare("UPDATE ficha_messages SET message_am_sha256=? WHERE step_no=1").run("1".repeat(64)), /ficha_message_immutable/);
});

test("Cópia interna reproduz a saudação que saiu (variante registrada no passo)", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { env, DB } = ctx;
  const w = await world(ctx);
  assert.equal((await w.approve()).status, 200);
  await tick(env, "eag-internal", { transport: transport(), now: atSP("10:15") });
  const o = step1(DB);
  assert.equal(o.greeting_variant, "am");
  const copy = await buildCopy(env, o, { copy_message_id: "<copia-teste@eagagro.com>", to_address: "interno@exemplo.com" });
  assert.ok(copy.text.split("\n\n")[1].startsWith("Bom dia, tudo bem?"), copy.text.slice(0, 300));
});

test("Exclusão de dados pessoais apaga também a variante 'Bom dia' do texto congelado", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api, DB } = ctx;
  const w = await world(ctx);
  ctx.env.FILES = memoryR2();
  const r = await api(`/api/contacts/${w.contactId}/delete-personal-data`, "POST", { legalBasis: "Pedido fictício do titular em 2099-01-06" });
  assert.ok([200, 201].includes(r.status), JSON.stringify(r.data));
  const m = DB.raw.prepare("SELECT body_enc,body_am_enc,body_html_am_enc,purged_at FROM ficha_messages WHERE step_no=1").get();
  assert.ok(m.purged_at);
  assert.equal(m.body_am_enc, m.body_enc, "variante trocada pelo mesmo marcador do texto principal");
  assert.equal(m.body_html_am_enc, null);
  assert.doesNotMatch(JSON.stringify((await api(`/api/fichas/${w.id}`)).data), /Bom dia, tudo bem|contato@moinho/i);
});
