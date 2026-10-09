// Trava T11 do e-mail automático (decisão de Rogério, 2026-10-09): aprovação de ficha de e-mail e cada envio exigem a
// validação vigente do escopo <país>_email_automatic. Ausência, revogação ou escopo incompatível bloqueiam. Única exceção:
// teste interno reconhecido pelo sistema (canal internal_test + destinatário da lista interna). Os demais bloqueios e a
// liberação separada do canal continuam valendo.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setup } from "./helpers/db.mjs";
import { tick } from "../src/sending.js";

const DAY = "2099-01-05"; // segunda-feira
const at = (h, day = DAY) => new Date(`${day}T${String(h + 3).padStart(2, "0")}:00:00Z`).toISOString(); // hora de São Paulo
const EXTERNAL = "compras@valeverde.com.br";
const H = (c) => c.repeat(64);
const EVIDENCE = ["decisions", "legal_basis", "transfer_mechanism", "incident_register", "erasure_test"].map((kind, i) => ({ kind, reference: `evidência de teste ${kind}`, sha256: H("abcde"[i]) }));
const today = () => new Date().toISOString().slice(0, 10);
const t11 = (api, decision) =>
  api("/api/compliance/t11", "POST", { scope: "br_email_automatic", decision, responsible: "Rogério Palhari (teste)", decidedOn: today(), basis: "Registro de teste da trava T11", confirm: true, evidence: decision === "validated" ? EVIDENCE : [] });
function transport() {
  const sent = [];
  return { sent, send: async (m) => (sent.push(m), { kind: "accepted" }) };
}

// Empresa do país pedido, ficha pronta para aprovar (sem aprovar). Canal e lista interna conforme o caso.
async function world(ctx, { country = "BR", channel = "enabled", internalList = "outro@eagagro.com", email = EXTERNAL } = {}) {
  const { api, env, DB } = ctx;
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP", EAG_POSTAL_ADDRESS_CONFIRMED: "Rua Exemplo, 100 — Sertãozinho/SP",
    PUBLIC_BASE_URL: "https://compass.exemplo", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
    MAILBOX_USER: "rogeriopalhari@eagagro.com", INTERNAL_TEST_RECIPIENTS: internalList,
  });
  const put = (key, scope, value) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Parâmetro do teste" });
  await put("send_timezone", "national", "America/Sao_Paulo");
  await put("send_window", "national", { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] });
  await put("sanctions_max_age_hours", "global", 24);
  await put("email_validation_max_age_days", "email", 30);
  DB.raw.prepare("UPDATE channels SET state=?,evidence_ref=? WHERE channel='email'").run(channel, channel === "enabled" ? "teste: canal habilitado só no banco em memória" : null);
  for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
    const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt: new Date().toISOString() });
    await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Sem Relação Nenhuma" }] });
    await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
  }
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-06", market: "national", name: "Açúcar", originCity: "Sertãozinho", originUf: "SP",
    icp: { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
  });
  await api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
  const co = await api("/api/companies", "POST", { legalName: "Doces Vale Verde Ltda.", countryCode: country, registrationId: "11222333000181", registrationIdType: country === "BR" ? "CNPJ" : "OTHER", sourceLabel: "teste" });
  assert.equal(co.status, 201, JSON.stringify(co.data));
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES ('u1','eag-internal',?,'11222333000181','05','t','2026-09-23')").run(co.data.id);
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-06", profileClass: "possible_final_consumer", basis: "CNAE" });
  await api(`/api/companies/${co.data.id}/screening`, "POST", {});
  const dm = (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: "Maria Souza", email, prospectRole: "decision_maker", sourceLabel: "site", timezone: "America/Sao_Paulo" })).data.id;
  DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at='2099-01-01T12:00:00.000Z' WHERE id=?").run(dm);
  const { id } = (await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: camp.data.id, recipients: [dm] })).data;
  const view = async () => (await api(`/api/fichas/${id}`)).data;
  const f = await view();
  const x = f.toApprove.find((a) => a.channel === "email");
  const approve = () => api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY });
  return { id, dm, view, approve };
}
const gate = (f) => f.approvalGates.gates.find((g) => g.id === "t11");
const step1 = (DB) => ({ ...DB.raw.prepare("SELECT status,block_reason FROM send_outbox WHERE step_no=1").get() });

test("Trava T11: sem validação a ficha mostra o bloqueio e a aprovação é recusada; validada pelo Administrador, aprova", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const w = await world(ctx);
  let f = await w.view();
  assert.equal(gate(f).ok, false);
  assert.match(gate(f).why, /br_email_automatic/);
  const r = await w.approve();
  assert.equal(r.status, 409);
  assert.equal(r.data.error.code, "t11_pending");
  assert.equal((await t11(ctx.api, "validated")).status, 201);
  f = await w.view();
  assert.equal(gate(f).ok, true);
  assert.equal((await w.approve()).status, 200);
});

test("Trava T11: antes de cada envio — sem validação nada sai; revogação segura o passo seguinte; nova validação libera", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api, env, DB } = ctx;
  const w = await world(ctx);
  await t11(api, "validated");
  assert.equal((await w.approve()).status, 200);
  // Revogada depois da aprovação: o pré-envio segura o passo, sem cancelar nem mudar a ficha.
  await t11(api, "revoked");
  const tr = transport();
  const r1 = await tick(env, "eag-internal", { transport: tr, now: at(10) });
  assert.equal(tr.sent.length, 0);
  assert.equal(r1.reason, "nothing_eligible");
  assert.deepEqual(step1(DB), { status: "pending", block_reason: "t11_pending" });
  assert.equal((await w.view()).ficha.status !== "discarded", true);
  // Nova validação: o mesmo passo sai, com os demais bloqueios conferidos como antes.
  await t11(api, "validated");
  const r2 = await tick(env, "eag-internal", { transport: tr, now: at(10) });
  assert.equal(r2.sent, 1, JSON.stringify(r2));
  assert.equal(step1(DB).status, "accepted");
});

test("Trava T11: escopo incompatível bloqueia — empresa de outro país não usa a validação do Brasil", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const w = await world(ctx, { country: "DE" });
  await t11(ctx.api, "validated"); // br_email_automatic
  const f = await w.view();
  assert.equal(gate(f).ok, false);
  assert.match(gate(f).why, /de_email_automatic/);
  assert.equal((await w.approve()).data.error.code, "t11_pending");
});

test("Trava T11: exceção só para teste interno reconhecido (canal internal_test + lista interna); fora disso bloqueia", async (t) => {
  // Teste interno: canal internal_test e destinatário da lista interna — aprova e envia sem validação.
  const ctx = setup();
  t.after(ctx.close);
  const w = await world(ctx, { channel: "internal_test", internalList: EXTERNAL });
  assert.equal(gate(await w.view()).ok, true);
  assert.equal((await w.approve()).status, 200);
  const tr = transport();
  assert.equal((await tick(ctx.env, "eag-internal", { transport: tr, now: at(10) })).sent, 1);

  // Mesmo canal internal_test, destinatário fora da lista: não é teste interno; trava vale.
  const ctx2 = setup();
  t.after(ctx2.close);
  const w2 = await world(ctx2, { channel: "internal_test", internalList: "outro@eagagro.com" });
  assert.equal(gate(await w2.view()).ok, false);
  assert.equal((await w2.approve()).data.error.code, "t11_pending");

  // Destinatário da lista, mas canal habilitado (contato real): trava vale.
  const ctx3 = setup();
  t.after(ctx3.close);
  const w3 = await world(ctx3, { channel: "enabled", internalList: EXTERNAL });
  assert.equal((await w3.approve()).data.error.code, "t11_pending");
});

test("Trava T11: validação não libera o canal nem passa por cima dos outros bloqueios", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api, DB } = ctx;
  const w = await world(ctx, { channel: "planned" });
  await t11(api, "validated");
  const f = await w.view();
  assert.equal(gate(f).ok, true);
  assert.equal(f.approvalGates.gates.find((g) => g.id === "channel").ok, false, "canal continua planejado");
  assert.equal((await w.approve()).data.error.code, "channel_not_ready");
  assert.equal(DB.raw.prepare("SELECT state FROM channels WHERE channel='email'").get().state, "planned");
});
