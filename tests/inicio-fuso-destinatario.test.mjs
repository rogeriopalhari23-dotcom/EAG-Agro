// Início da sequência no fuso confirmado do destinatário (regra de 2026-09-25, a mesma do pré-envio). Corrige o
// descompasso de 10/10/2026: approve() comparava o início com a data UTC; à noite no Brasil o UTC já é o dia seguinte.
// Relógio simulado só para Date (o banco em memória não usa temporizadores).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setup } from "./helpers/db.mjs";
import { t11Fixture } from "./helpers/t11.mjs";
import { tick } from "../src/sending.js";

const EMAIL = "compras@valeverde.com.br";
// 2026-10-11 01:30 UTC = 10/10 22:30 em São Paulo (sábado) = 11/10 10:30 em Tóquio (domingo).
const NIGHT_BR = Date.parse("2026-10-11T01:30:00Z");

async function ficha(ctx, tz) {
  const { api, env, DB } = ctx;
  t11Fixture(DB); // trava T11 do e-mail validada; o assunto aqui é a data de início
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP", EAG_POSTAL_ADDRESS_CONFIRMED: "Rua Exemplo, 100 — Sertãozinho/SP",
    PUBLIC_BASE_URL: "https://compass.exemplo", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
    MAILBOX_USER: "rogeriopalhari@eagagro.com", INTERNAL_TEST_RECIPIENTS: EMAIL,
  });
  const put = (key, scope, value) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Parâmetro do teste" });
  await put("send_timezone", "national", "America/Sao_Paulo");
  await put("send_window", "national", { start: "00:00", end: "23:59", weekdays: [1, 2, 3, 4, 5, 6, 7] });
  await put("sanctions_max_age_hours", "global", 24);
  await put("email_validation_max_age_days", "email", 30);
  DB.raw.exec("UPDATE channels SET state='internal_test' WHERE channel='email'");
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
  const co = await api("/api/companies", "POST", { legalName: "Doces Vale Verde Ltda.", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES ('u1','eag-internal',?,'11222333000181','05','t','2026-09-23')").run(co.data.id);
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-06", profileClass: "possible_final_consumer", basis: "CNAE" });
  await api(`/api/companies/${co.data.id}/screening`, "POST", {});
  const dm = (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: "Maria Souza", email: EMAIL, prospectRole: "decision_maker", sourceLabel: "site", timezone: tz })).data.id;
  DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at=? WHERE id=?").run(new Date(Date.now() - 86400000).toISOString(), dm);
  const { id } = (await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: camp.data.id, recipients: [dm] })).data;
  const f = (await api(`/api/fichas/${id}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  const approve = (startDate) => api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, ...(startDate === undefined ? {} : { startDate }) });
  return { approve, planned: () => DB.raw.prepare("SELECT planned_date FROM send_outbox WHERE step_no=1").get()?.planned_date };
}
function clock(t, ms) {
  t.mock.timers.enable({ apis: ["Date"], now: ms });
}

test("Início: à noite no Brasil (UTC já no dia seguinte), 'hoje' de São Paulo é aceito e o passo sai hoje; ontem é recusado", async (t) => {
  clock(t, NIGHT_BR);
  const ctx = setup();
  t.after(ctx.close);
  const w = await ficha(ctx, "America/Sao_Paulo");
  const past = await w.approve("2026-10-09");
  assert.equal(past.status, 422);
  assert.equal(past.data.error.code, "invalid_start");
  assert.match(past.data.error.message, /2026-10-10, America\/Sao_Paulo/);
  const r = await w.approve("2026-10-10");
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(w.planned(), "2026-10-10");
  // O pré-envio usa o mesmo critério: no mesmo instante, o passo do "hoje" local está vencido e sai.
  const sent = [];
  const out = await tick(ctx.env, "eag-internal", { transport: { send: async (m) => (sent.push(m), { kind: "accepted" }) }, now: new Date(NIGHT_BR).toISOString() });
  assert.equal(out.sent, 1, JSON.stringify(out));
});

test("Início: data futura é aceita; formato e data inválidos são recusados", async (t) => {
  clock(t, NIGHT_BR);
  const ctx = setup();
  t.after(ctx.close);
  const w = await ficha(ctx, "America/Sao_Paulo");
  for (const bad of ["10/10/2026", "2026-02-30", "2026-13-01"]) assert.equal((await w.approve(bad)).data.error.code, "invalid_start", bad);
  const r = await w.approve("2026-10-11"); // amanhã em São Paulo (= hoje em UTC)
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(w.planned(), "2026-10-11");
});

test("Início padrão: próxima segunda-feira contada do dia do destinatário, não do dia UTC", async (t) => {
  // Domingo 11/10 22:30 em São Paulo = segunda 12/10 01:30 UTC. Pelo dia UTC daria 19/10; pelo dia dele, 12/10.
  clock(t, Date.parse("2026-10-12T01:30:00Z"));
  const ctx = setup();
  t.after(ctx.close);
  const w = await ficha(ctx, "America/Sao_Paulo");
  assert.equal((await w.approve()).status, 200);
  assert.equal(w.planned(), "2026-10-12");
});

test("Início: destinatário à frente do UTC (Tóquio) — o 'hoje' dele vale; a data anterior é recusada mesmo sendo 'hoje' em UTC-3", async (t) => {
  clock(t, NIGHT_BR); // 11/10 10:30 em Tóquio
  const ctx = setup();
  t.after(ctx.close);
  const w = await ficha(ctx, "Asia/Tokyo");
  const r1 = await w.approve("2026-10-10");
  assert.equal(r1.data.error.code, "invalid_start");
  assert.match(r1.data.error.message, /2026-10-11, Asia\/Tokyo/);
  assert.equal((await w.approve("2026-10-11")).status, 200);
});

test("Início: meio do dia, quando UTC e São Paulo coincidem, nada muda", async (t) => {
  clock(t, Date.parse("2026-10-14T15:00:00Z")); // 12:00 em São Paulo
  const ctx = setup();
  t.after(ctx.close);
  const w = await ficha(ctx, "America/Sao_Paulo");
  assert.equal((await w.approve("2026-10-13")).data.error.code, "invalid_start");
  assert.equal((await w.approve("2026-10-14")).status, 200);
});
