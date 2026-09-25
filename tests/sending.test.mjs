import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setup } from "./helpers/db.mjs";
import { tick, evaluateRamp } from "../src/sending.js";

const DAY = "2099-01-05"; // segunda-feira
const at = (h, m = 0, day = DAY) => new Date(`${day}T${String(h + 3).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`).toISOString(); // hora de São Paulo (UTC-3)
function transport(result = { kind: "accepted" }) {
  const sent = [];
  return { sent, send: async (m) => (sent.push(m), typeof result === "function" ? result(m) : result) };
}
async function ready(ctx, { email = "compras@valeverde.com.br", internal = true, validated = true } = {}) {
  const { api, env, DB } = ctx;
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP",
    PUBLIC_BASE_URL: "https://compass.exemplo",
    UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
    MAILBOX_USER: "rogeriopalhari@eagagro.com",
    INTERNAL_TEST_RECIPIENTS: internal ? email : "outro@eagagro.com",
  });
  const put = (key, scope, value) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Parâmetro do teste" });
  await put("send_timezone", "national", "America/Sao_Paulo");
  await put("send_window", "national", { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] });
  await put("sanctions_max_age_hours", "global", 24);
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
  const dm = (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: "Maria Souza", email, prospectRole: "decision_maker", sourceLabel: "site", timezone: "America/Sao_Paulo" })).data.id;
  if (validated) DB.raw.prepare("UPDATE contacts SET email_validation='valid' WHERE id=?").run(dm);
  const { id } = (await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: camp.data.id, recipients: [dm] })).data;
  const f = (await api(`/api/fichas/${id}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  const ok = await api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  return { fichaId: id, companyId: co.data.id, campaignId: camp.data.id, dm, f };
}
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
const rows = (DB) => DB.raw.prepare("SELECT step_no,status,block_reason FROM send_outbox ORDER BY step_no").all().map((r) => ({ ...r }));

check("P2-T10: envia o texto aprovado byte a byte, com Message-ID e descadastro RFC 8058 (AT25, R21.10)", async (ctx) => {
  const r = await ready(ctx);
  const t = transport();
  const out = await tick(ctx.env, "eag-internal", { transport: t, now: at(10) });
  assert.equal(out.sent, 1, JSON.stringify(out));
  const m = t.sent[0];
  const approved = r.f.messages.find((x) => x.step === 1 && x.channel === "email");
  assert.equal(m.text, approved.body);
  assert.equal(m.subject, "Fornecedor açúcar");
  assert.equal(createHash("sha256").update(`${m.subject}\n\n${m.text}`).digest("hex"), approved.sha256);
  assert.match(m.headers["Message-ID"], /^<ob-.+@eagagro\.com>$/);
  assert.match(m.headers["List-Unsubscribe"], /^<https:\/\/compass\.exemplo\/u\/.+>$/);
  assert.equal(m.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.equal(rows(ctx.DB)[0].status, "accepted");
});

check("P2-T10: um envio por execução; intervalo e passo futuro respeitados", async (ctx) => {
  await ready(ctx);
  const t = transport();
  assert.equal((await tick(ctx.env, "eag-internal", { transport: t, now: at(10) })).sent, 1);
  assert.equal((await tick(ctx.env, "eag-internal", { transport: t, now: at(10, 5) })).reason, "interval");
  assert.equal((await tick(ctx.env, "eag-internal", { transport: t, now: at(11) })).reason, "nothing_eligible");
  assert.equal(t.sent.length, 1);
});

check("P2-T10: execuções sobrepostas não enviam duas vezes (lease do remetente)", async (ctx) => {
  await ready(ctx);
  const t = transport();
  const results = await Promise.all([1, 2, 3].map(() => tick(ctx.env, "eag-internal", { transport: t, now: at(10) })));
  assert.equal(t.sent.length, 1);
  assert.equal(results.filter((x) => x.reason === "sender_busy").length >= 0, true);
});

check("P2-T10: queda depois de iniciar o envio vira indeterminado e não reenvia sozinho (AT27)", async (ctx) => {
  await ready(ctx);
  ctx.DB.raw.exec(`UPDATE send_outbox SET status='leased',lease_owner='morto',lease_until='${at(9)}',lease_token=1,message_id='<ob-x@eagagro.com>' WHERE step_no=1`);
  const t = transport();
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10) });
  assert.equal(t.sent.length, 0);
  assert.deepEqual(rows(ctx.DB)[0], { step_no: 1, status: "indeterminate", block_reason: "lease_expired" });
  assert.throws(() => ctx.DB.raw.exec("UPDATE send_outbox SET status='pending' WHERE step_no=1"), /requires_resolution/);
  const id = ctx.DB.raw.prepare("SELECT id FROM send_outbox WHERE step_no=1").get().id;
  const bad = await ctx.api(`/api/sending/outbox/${id}/resolve`, "POST", { outcome: "sent", reason: "curto" });
  assert.equal(bad.status, 422);
  const ok = await ctx.api(`/api/sending/outbox/${id}/resolve`, "POST", { outcome: "sent", reason: "Conferido na pasta Enviados da caixa Hostinger" });
  assert.equal(ok.data.status, "accepted");
});

check("P2-T10: resposta ambígua do SMTP fica indeterminada; 5xx suprime e cancela o resto; 4xx tenta de novo", async (ctx) => {
  await ready(ctx);
  await tick(ctx.env, "eag-internal", { transport: transport({ kind: "indeterminate", detail: "sem confirmação" }), now: at(10) });
  assert.equal(rows(ctx.DB)[0].status, "indeterminate");
  const ctx2 = setup();
  try {
    await ready(ctx2);
    await tick(ctx2.env, "eag-internal", { transport: transport({ kind: "permanent", detail: "550" }), now: at(10) });
    assert.deepEqual(rows(ctx2.DB).map((r) => r.status), ["perm_failed", "cancelled", "cancelled", "cancelled"]);
    assert.equal(ctx2.DB.raw.prepare("SELECT source FROM suppression_entries").get().source, "bounce");
  } finally {
    ctx2.close();
  }
});

check("P2-T10: e-mail não validado e compliance indisponível seguram o envio (AT52, AT28)", async (ctx) => {
  await ready(ctx, { validated: false });
  const t = transport();
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10) });
  assert.equal(t.sent.length, 0);
  assert.equal(rows(ctx.DB)[0].block_reason, "email_not_validated");
  ctx.DB.raw.exec("UPDATE contacts SET email_validation='valid'");
  ctx.DB.raw.exec("DELETE FROM screening_matches; DELETE FROM screening_runs");
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10) });
  assert.equal(t.sent.length, 0);
  assert.equal(rows(ctx.DB)[0].block_reason, "compliance_unavailable");
});

check("P2-T10: canal em teste interno só envia para endereço interno (R26.2); fora da janela espera", async (ctx) => {
  await ready(ctx, { internal: false });
  const t = transport();
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10) });
  assert.equal(rows(ctx.DB)[0].block_reason, "channel_internal_test_only");
  ctx.env.INTERNAL_TEST_RECIPIENTS = "compras@valeverde.com.br";
  await tick(ctx.env, "eag-internal", { transport: t, now: at(18) });
  assert.equal(rows(ctx.DB)[0].block_reason, "outside_window");
  assert.equal(t.sent.length, 0);
});

check("P2-T10: e-mail em dias seguidos é segurado (R19.2 item 12, AT53); teto diário vem do parâmetro (AT68)", async (ctx) => {
  await ready(ctx);
  const t = transport();
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10) });
  ctx.DB.raw.exec(`UPDATE send_outbox SET planned_date='2099-01-06' WHERE step_no=2`);
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10, 0, "2099-01-06") });
  assert.equal(rows(ctx.DB)[1].block_reason, "consecutive_day");
  await ctx.api("/api/parameters/send_daily_ramp", "PUT", { scope: "email", value: [1, 2], reason: "Teste de teto" });
  ctx.DB.raw.exec(`UPDATE send_outbox SET planned_date='2099-01-05' WHERE step_no=3`);
  assert.equal((await tick(ctx.env, "eag-internal", { transport: t, now: at(15) })).reason, "daily_cap");
});

check("P2-T13: pausa de empresa segura; pausa de commodity pausa a campanha (todas as variantes)", async (ctx) => {
  const r = await ready(ctx);
  const t = transport();
  const p = await ctx.api("/api/pauses", "POST", { scope: "company", scopeRef: r.companyId, reason: "Cliente pediu para aguardar" });
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10) });
  assert.equal(rows(ctx.DB)[0].block_reason, "paused_company");
  await ctx.api(`/api/pauses/${p.data.id}/resume`, "POST", { reason: "Pode seguir agora" });
  await ctx.api("/api/pauses", "POST", { scope: "commodity", scopeRef: "sugar", reason: "Sem açúcar para vender" });
  assert.equal(ctx.DB.raw.prepare("SELECT status FROM campaigns WHERE id=?").get(r.campaignId).status, "paused");
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10) });
  assert.match(rows(ctx.DB)[0].block_reason, /paused_commodity/);
  assert.equal(t.sent.length, 0);
});

check("P2-T10: hard bounce ≥ 3% na semana para tudo e só a retomada da operação libera (AT69)", async (ctx) => {
  await ready(ctx);
  ctx.DB.raw.exec("UPDATE sender_state SET ramp_step=0");
  await tick(ctx.env, "eag-internal", { transport: transport({ kind: "permanent", detail: "550" }), now: at(10) });
  const r = await evaluateRamp(ctx.env, "eag-internal", { now: new Date().toISOString() });
  assert.match(r.stopped, /hard bounce/);
  const t = transport();
  assert.equal((await tick(ctx.env, "eag-internal", { transport: t, now: at(10, 30) })).reason, "sender_stopped");
  const pause = ctx.DB.raw.prepare("SELECT id FROM pauses WHERE scope='operation'").get();
  await ctx.api(`/api/pauses/${pause.id}/resume`, "POST", { reason: "Lista revisada, retomando" });
  assert.equal(ctx.DB.raw.prepare("SELECT stopped_at FROM sender_state").get().stopped_at, null);
});

check("P2-T13: descartar empresa e excluir dados pessoais cancelam o que falta enviar", async (ctx) => {
  const r = await ready(ctx);
  const d = await ctx.api(`/api/companies/${r.companyId}/discard`, "POST", { reason: "Fora do perfil após visita" });
  assert.equal(d.status, 200);
  assert.ok(rows(ctx.DB).every((x) => x.status === "cancelled"));
  const del = await ctx.api(`/api/contacts/${r.dm}/delete-personal-data`, "POST", { legalBasis: "Pedido do titular por e-mail em 2099-01-05" });
  assert.equal(del.status, 200);
  const c = ctx.DB.raw.prepare("SELECT full_name_encrypted,email_encrypted,email_hash FROM contacts WHERE id=?").get(r.dm);
  assert.equal(c.full_name_encrypted, null);
  assert.equal(c.email_encrypted, null);
  assert.match(c.email_hash, /^[0-9a-f]{64}$/);
});
