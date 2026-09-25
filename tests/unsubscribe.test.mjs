import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { setup } from "./helpers/db.mjs";
import { unsubToken } from "../src/unsub-token.js";

async function ready(ctx) {
  const { api, env, DB } = ctx;
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: "Rua Exemplo, 100",
    PUBLIC_BASE_URL: "https://compass.exemplo",
    UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
  });
  await api("/api/parameters/send_timezone", "PUT", { scope: "national", value: "America/Sao_Paulo", reason: "Fuso do piloto" });
  DB.raw.exec("UPDATE channels SET state='internal_test' WHERE channel='email'");
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-06", market: "national", name: "Açúcar", originCity: "Sertãozinho", originUf: "SP",
    icp: { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
  });
  await api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
  const co = await api("/api/companies", "POST", { legalName: "Doces", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES ('u1','eag-internal',?,'11222333000181','05','t','2026-09-23')").run(co.data.id);
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-06", profileClass: "possible_final_consumer", basis: "CNAE" });
  const dm = (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: "Maria Souza", email: "compras@valeverde.com.br", prospectRole: "decision_maker", sourceLabel: "site", timezone: "America/Sao_Paulo" })).data.id;
  const { id } = (await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: camp.data.id, recipients: [dm] })).data;
  const f = (await api(`/api/fichas/${id}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  await api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, startDate: "2099-01-05" });
  const link = f.messages.find((m) => m.step === 1 && m.channel === "email").body.match(/https:\/\/compass\.exemplo\/u\/(\S+)/)[1];
  return { dm, token: link, versionId: f.version.id };
}
const call = (env, token, method = "GET", body, headers = {}) =>
  worker.fetch(new Request(`https://compass.exemplo/u/${token}`, { method, body, headers }), env);
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
const suppressed = (DB) => DB.raw.prepare("SELECT COUNT(*) n FROM suppression_entries WHERE source='link'").get().n;

check("P2-T12: GET só mostra a confirmação e não suprime (robô de segurança)", async (ctx) => {
  const r = await ready(ctx);
  const res = await call(ctx.env, r.token);
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.match(page, /Confirmar descadastro/);
  assert.ok(!page.includes("valeverde") && !page.includes("Maria"));
  assert.match(res.headers.get("content-security-policy"), /default-src 'none'/);
  assert.equal(suppressed(ctx.DB), 0);
});

check("P2-T12: POST de um clique (RFC 8058) suprime sem login, cancela passos futuros sem despedida e é idempotente (AT35)", async (ctx) => {
  const r = await ready(ctx);
  const res = await call(ctx.env, r.token, "POST", "List-Unsubscribe=One-Click", { "content-type": "application/x-www-form-urlencoded" });
  assert.equal(res.status, 200);
  assert.equal(suppressed(ctx.DB), 1);
  const st = ctx.DB.raw.prepare("SELECT DISTINCT status,block_reason FROM send_outbox").all();
  assert.deepEqual(st.map((z) => ({ ...z })), [{ status: "cancelled", block_reason: "unsubscribed" }]);
  assert.equal((await call(ctx.env, r.token, "POST", "List-Unsubscribe=One-Click", { "content-type": "application/x-www-form-urlencoded" })).status, 200);
  assert.equal(suppressed(ctx.DB), 1);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='suppression.added'").get().n, 1);
  // O e-mail agora aparece como suprimido para o restante do sistema.
  const { isSuppressed } = await import("../src/operations.js");
  assert.equal(await isSuppressed(ctx.env, "eag-internal", "email", "COMPRAS@valeverde.com.br"), true);
});

check("P2-T12: token forjado ou alterado dá 404 genérico", async (ctx) => {
  const r = await ready(ctx);
  const [payload, sig] = r.token.split(".");
  const other = await unsubToken({ UNSUB_TOKEN_KEY: Buffer.alloc(32, 9).toString("base64") }, r.versionId, r.dm);
  for (const bad of [`${payload}.${sig.slice(0, -2)}AA`, other, "abc", `${payload}`])
    assert.equal((await call(ctx.env, bad, "POST", "")).status, 404, bad);
  assert.equal(suppressed(ctx.DB), 0);
});

check("P2-T12: sem Origin nem Access funciona; limite por token responde 429", async (ctx) => {
  const r = await ready(ctx);
  let n = 0;
  ctx.env.UNSUB_LIMITER = { limit: async () => ({ success: ++n <= 2 }) };
  assert.equal((await call(ctx.env, r.token)).status, 200);
  assert.equal((await call(ctx.env, r.token)).status, 200);
  assert.equal((await call(ctx.env, r.token)).status, 429);
});

check("P2-T12: método e corpo fora do contrato são recusados", async (ctx) => {
  const r = await ready(ctx);
  assert.equal((await call(ctx.env, r.token, "PUT", "x")).status, 405);
  assert.equal((await call(ctx.env, r.token, "POST", "x".repeat(3000), { "content-length": "3000" })).status, 413);
});
