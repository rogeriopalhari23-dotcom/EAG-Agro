import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";

async function ready(ctx, { profileClass = "possible_final_consumer", channel = "internal_test", timezone = true } = {}) {
  const { api, env, DB } = ctx;
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP",
    PUBLIC_BASE_URL: "https://compass.exemplo",
    UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
  });
  if (timezone) await api("/api/parameters/send_timezone", "PUT", { scope: "national", value: "America/Sao_Paulo", reason: "Fuso do piloto" });
  DB.raw.prepare("UPDATE channels SET state=? WHERE channel='email'").run(channel);
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-06", market: "national", name: "Açúcar SP", originCity: "Sertãozinho", originUf: "SP",
    icp: { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
  });
  await api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
  const co = await api("/api/companies", "POST", { legalName: "Doces Vale Verde Ltda.", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES ('u1','eag-internal',?,'11222333000181','05','teste','2026-09-23')").run(co.data.id);
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-06", profileClass, basis: "CNAE e site" });
  // Fuso confirmado do destinatário (regra de horário de 2026-09-25); `timezone: false` deixa o contato sem fuso.
  const add = async (fullName, email, role, jobTitle, sourceLabel = "Site da empresa") =>
    (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName, email, jobTitle, prospectRole: role, sourceLabel, ...(timezone ? { timezone: "America/Sao_Paulo" } : {}) })).data.id;
  const dm = await add("Maria Souza", "compras@valeverde.com.br", "decision_maker", "Gerente de Compras");
  const inf = await add("João Lima", "suprimentos@valeverde.com.br", "influencer", "Coordenador de Suprimentos", "LinkedIn");
  return { campaignId: camp.data.id, companyId: co.data.id, dm, inf };
}
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
const approveAll = async (api, id, f, channel = "email", contactId) => {
  const x = f.toApprove.find((a) => a.channel === channel && (!contactId || a.contactId === contactId));
  return api(`/api/fichas/${id}/approve`, "POST", { versionNo: f.version.no, contactId: x.contactId, channel, messagesSha256: x.messagesSha256, startDate: "2099-01-05" });
};

check("P2-T9: ficha gera versão congelada, cifrada e revisada; texto não fica em claro no banco", async (ctx) => {
  const r = await ready(ctx);
  const c = await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm, r.inf] });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  assert.equal(c.data.reviewOk, true, JSON.stringify(c.data.findings));
  const f = (await ctx.api(`/api/fichas/${c.data.id}`)).data;
  assert.equal(f.messages.filter((m) => m.kind === "auto_email" && m.contactId === r.dm).length, 4);
  assert.match(f.messages[0].body, /compass\.exemplo\/u\//);
  const raw = ctx.DB.raw.prepare("SELECT body_enc FROM ficha_messages").all().map((x) => x.body_enc).join(" ");
  assert.ok(!raw.includes("Maria") && !raw.includes("EAG Agro"));
  assert.equal(f.version.snapshot.skill.slice(0, 8), "33bd093f");
  assert.equal((await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm] })).status, 409);
});

check("P2-T9: aprovação por destinatário e canal com o hash visto; repetida é idempotente (AT26); pipeline não muda (AT39)", async (ctx) => {
  const r = await ready(ctx);
  const { id } = (await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm, r.inf] })).data;
  const f = (await ctx.api(`/api/fichas/${id}`)).data;
  const x = f.toApprove.find((a) => a.contactId === r.dm && a.channel === "email");
  const wrong = await ctx.api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId: r.dm, channel: "email", messagesSha256: "0".repeat(64) });
  assert.equal(wrong.data.error.code, "content_changed");
  const ok = await approveAll(ctx.api, id, f, "email", r.dm);
  assert.equal(ok.status, 200);
  const again = await approveAll(ctx.api, id, f, "email", r.dm);
  assert.equal(again.data.idempotent, true);
  const rows = ctx.DB.raw.prepare("SELECT step_no,planned_date,status FROM send_outbox WHERE contact_id=? ORDER BY step_no").all(r.dm);
  assert.deepEqual(rows.map((z) => z.planned_date), ["2099-01-05", "2099-01-09", "2099-01-15", "2099-01-19"]);
  assert.ok(rows.every((z) => z.status === "pending"));
  assert.equal(ctx.DB.raw.prepare("SELECT pipeline_status FROM companies WHERE id=?").get(r.companyId).pipeline_status, "discovered");
  assert.equal((await ctx.api(`/api/fichas/${id}`)).data.ficha.status, "in_approval");
  assert.ok(x);
});

check("P2-T9: canal de e-mail só planejado impede aprovação (R26.2)", async (ctx) => {
  const r = await ready(ctx, { channel: "planned" });
  const { id } = (await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm] })).data;
  const f = (await ctx.api(`/api/fichas/${id}`)).data;
  assert.equal((await approveAll(ctx.api, id, f)).data.error.code, "channel_not_ready");
});

check("P2-T9: edição vira nova versão, revisão reprovada impede aprovação e envios não aceitos são substituídos", async (ctx) => {
  const r = await ready(ctx);
  const { id } = (await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm] })).data;
  let f = (await ctx.api(`/api/fichas/${id}`)).data;
  await approveAll(ctx.api, id, f);
  // Passo 1 já saiu: deve ser preservado.
  ctx.DB.raw.exec("UPDATE send_outbox SET status='accepted',accepted_at='2099-01-05T12:00:00Z' WHERE step_no=1");
  const e1 = f.messages.find((m) => m.step === 1 && m.channel === "email");
  const bad = await ctx.api(`/api/fichas/${id}/versions`, "POST", {
    expectedRowVersion: 1,
    edits: [{ contactId: r.dm, channel: "email", step: 2, body: "Temos preço competitivo para você.\n" + e1.body.split("\n").slice(-4).join("\n") }],
  });
  assert.equal(bad.status, 201);
  assert.equal(bad.data.reviewOk, false);
  assert.ok(bad.data.findings.some((x) => x.id === "PV7"));
  f = (await ctx.api(`/api/fichas/${id}`)).data;
  assert.equal((await approveAll(ctx.api, id, f)).data.error.code, "review_failed");
  const st = ctx.DB.raw.prepare("SELECT step_no,status FROM send_outbox ORDER BY step_no").all();
  assert.deepEqual(st.map((z) => z.status), ["accepted", "superseded", "superseded", "superseded"]);
  assert.equal(ctx.DB.raw.prepare("SELECT status FROM ficha_approvals").get().status, "invalidated");
  // Versão corrigida: aprova e reaproveita as linhas substituídas, sem tocar no passo já enviado.
  const good = await ctx.api(`/api/fichas/${id}/versions`, "POST", { expectedRowVersion: 2 });
  assert.equal(good.data.reviewOk, true);
  f = (await ctx.api(`/api/fichas/${id}`)).data;
  assert.equal((await approveAll(ctx.api, id, f)).status, 200);
  const after = ctx.DB.raw.prepare("SELECT step_no,status FROM send_outbox ORDER BY step_no").all();
  assert.deepEqual(after.map((z) => z.status), ["accepted", "pending", "pending", "pending"]);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM send_outbox").get().n, 4);
});

check("P2-T9: edição concorrente com versão antiga dá conflito", async (ctx) => {
  const r = await ready(ctx);
  const { id } = (await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm] })).data;
  await ctx.api(`/api/fichas/${id}/versions`, "POST", { expectedRowVersion: 1 });
  assert.equal((await ctx.api(`/api/fichas/${id}/versions`, "POST", { expectedRowVersion: 1 })).status, 409);
});

check("P2-T9: mudança de ICP invalida aprovação e bloqueia envios pendentes", async (ctx) => {
  const r = await ready(ctx);
  const { id } = (await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm] })).data;
  const f = (await ctx.api(`/api/fichas/${id}`)).data;
  await approveAll(ctx.api, id, f);
  const camp = (await ctx.api(`/api/campaigns/${r.campaignId}`)).data.campaign;
  await ctx.api(`/api/campaigns/${r.campaignId}/icp`, "PUT", {
    expectedVersion: camp.version,
    icp: { userSectors: ["balas", "chocolates"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
  });
  assert.equal(ctx.DB.raw.prepare("SELECT status FROM ficha_approvals").get().status, "invalidated");
  const st = ctx.DB.raw.prepare("SELECT DISTINCT status,block_reason FROM send_outbox").all();
  assert.deepEqual(st.map((z) => ({ ...z })), [{ status: "blocked", block_reason: "approval_invalidated" }]);
});

check("P2-T9: trader sem exceção, destinatário suprimido, fuso ou endereço ausentes impedem a ficha", async (ctx) => {
  const r = await ready(ctx, { profileClass: "trader_distributor" });
  assert.equal((await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm] })).data.error.code, "ficha_not_allowed");
  ctx.DB.raw.exec("UPDATE buyer_profiles SET icp_status='in_icp',profile_class='possible_final_consumer'");
  await ctx.api("/api/suppression", "POST", { channel: "email", value: "compras@valeverde.com.br", reason: "opt_out" });
  assert.equal((await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm] })).data.error.code, "recipient_suppressed");
  delete ctx.env.EAG_POSTAL_ADDRESS;
  assert.equal((await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.inf] })).data.error.code, "postal_address_missing");
});

check("P2-T9: destinatário sem fuso confirmado não é aprovado (R18.6, regra de 2026-09-25); vendedor não aprova", async (ctx) => {
  const r = await ready(ctx, { timezone: false });
  // A ficha nacional é gerada (o fuso do mercado não substitui o do destinatário), mas a aprovação espera o fuso.
  const { id } = (await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: r.campaignId, recipients: [r.dm] })).data;
  let f = (await ctx.api(`/api/fichas/${id}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  const tryApprove = () => ctx.api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId: r.dm, channel: "email", messagesSha256: x.messagesSha256 });
  assert.equal((await tryApprove()).data.error.code, "timezone_pending");
  assert.equal((await ctx.api(`/api/contacts/${r.dm}`, "PATCH", { timezone: "America/Manaus" })).status, 200);
  assert.equal((await tryApprove()).status, 200);
  f = (await ctx.api(`/api/fichas/${id}`)).data;
  ctx.DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('seller','eag-internal','seller@example.test','Vendedor','seller_analyst')");
  ctx.env.LOCAL_USER_EMAIL = "seller@example.test";
  assert.equal((await approveAll(ctx.api, id, f)).status, 403);
});
