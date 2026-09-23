import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pollJob, MAX_POLLS } from "../src/email-validation.js";
import { mapResult } from "../src/adapters/snov.js";

// Formatos copiados da documentação do Snov.io (2026-09-23); e-mails de teste.
const token = { access_token: "tok-1", token_type: "Bearer", expires_in: 3600 };
const started = { data: { task_hash: "0110437df6811068197577a538849a4b" }, meta: { emails: [] } };
const done = (list) => ({ status: "completed", data: list, meta: { task_hash: "0110437df6811068197577a538849a4b" } });
const r = (email, smtp, reason) => ({ email, result: { is_webmail: false, smtp_status: smtp, is_gibberish: false, is_disposable: false, is_valid_format: true, ...(reason ? { unknown_status_reason: reason } : {}) } });

function kv() {
  const m = new Map();
  return { get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v) };
}
function provider(routes, calls = []) {
  return async (url, init) => {
    const u = new URL(url);
    calls.push(u.pathname);
    const [status, body] = routes[u.pathname]();
    return new Response(JSON.stringify(body), { status });
  };
}
async function ready(ctx) {
  const { api, env } = ctx;
  env.SNOV_CLIENT_ID = "id";
  env.SNOV_CLIENT_SECRET = "segredo";
  env.CACHE = kv();
  env.sent = [];
  env.ASYNC_QUEUE = { sendBatch: async (m) => env.sent.push(...m) };
  const co = await api("/api/companies", "POST", { legalName: "Doces", countryCode: "BR", sourceLabel: "teste" });
  const add = async (email, name) =>
    (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: name, email, sourceLabel: "site", prospectRole: "decision_maker" })).data.id;
  return { companyId: co.data.id, add };
}
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}

test("P2-T7: só 'valid' confirma; catch-all, banned e desconhecido não", () => {
  assert.equal(mapResult({ smtp_status: "valid" }), "valid");
  assert.equal(mapResult({ smtp_status: "not_valid" }), "not_valid");
  assert.equal(mapResult({ smtp_status: "unknown", unknown_status_reason: "catchall" }), "catchall");
  assert.equal(mapResult({ smtp_status: "unknown", unknown_status_reason: "banned" }), "unknown");
  assert.equal(mapResult({}), "error");
});

check("P2-T7: fluxo completo com estados, prazo e uma tarefa para vários contatos", async (ctx) => {
  const { companyId, add } = await ready(ctx);
  await ctx.api("/api/parameters/email_validation_max_age_days", "PUT", { scope: "email", value: 90, reason: "Política de teste" });
  const a = await add("compras@valeverde.com.br", "Ana");
  const b = await add("qualidade@valeverde.com.br", "Bia");
  const c = await add("geral@valeverde.com.br", "Caio");
  let phase = 0;
  const calls = [];
  const fetchImpl = provider(
    {
      "/v1/oauth/access_token": () => [200, token],
      "/v2/email-verification/start": () => [200, started],
      "/v2/email-verification/result": () =>
        phase++ === 0
          ? [200, { status: "in_progress", data: [] }]
          : [200, done([r("compras@valeverde.com.br", "valid"), r("qualidade@valeverde.com.br", "unknown", "catchall"), r("geral@valeverde.com.br", "not_valid")])],
    },
    calls,
  );
  const { validateCompanyContacts } = await import("../src/email-validation.js");
  const req = new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const actor = { id: "system-admin", tenant_id: "eag-internal", role: "admin" };
  const s = await validateCompanyContacts(req, ctx.env, actor, "rid", companyId, { fetchImpl });
  assert.equal(s.started, 3);
  assert.equal(ctx.env.sent[0].body.type, "email_validation_poll");
  assert.ok(ctx.env.sent[0].delaySeconds >= 30);
  const at = "2026-09-23T12:00:00.000Z";
  assert.equal((await pollJob(ctx.env, s.jobId, { fetchImpl, now: at })).pending, true);
  const fim = await pollJob(ctx.env, s.jobId, { fetchImpl, now: at });
  assert.deepEqual(fim.tally, { valid: 1, catchall: 1, not_valid: 1 });
  const row = (id) => ctx.DB.raw.prepare("SELECT email_validation,email_validation_expires_at FROM contacts WHERE id=?").get(id);
  assert.equal(row(a).email_validation, "valid");
  assert.equal(row(a).email_validation_expires_at, "2026-12-22T12:00:00.000Z");
  assert.equal(row(b).email_validation, "catchall");
  assert.equal(row(b).email_validation_expires_at, null);
  assert.equal(row(c).email_validation, "not_valid");
  assert.equal(calls.filter((p) => p === "/v1/oauth/access_token").length, 1, "token reaproveitado");
  const job = ctx.DB.raw.prepare("SELECT status,api_calls FROM email_validation_jobs").get();
  assert.equal(job.status, "completed");
  assert.equal(job.api_calls, 3);
  assert.equal((await pollJob(ctx.env, s.jobId, { fetchImpl, now: at })).skipped, true);
});

check("P2-T7: resultado que nunca conclui para depois do limite e vira 'error', sem loop infinito", async (ctx) => {
  const { add, companyId } = await ready(ctx);
  const a = await add("compras@valeverde.com.br", "Ana");
  const fetchImpl = provider({
    "/v1/oauth/access_token": () => [200, token],
    "/v2/email-verification/start": () => [200, started],
    "/v2/email-verification/result": () => [200, { status: "in_progress", data: [] }],
  });
  const { validateCompanyContacts } = await import("../src/email-validation.js");
  const req = new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const s = await validateCompanyContacts(req, ctx.env, { id: "system-admin", tenant_id: "eag-internal", role: "admin" }, "rid", companyId, { fetchImpl });
  let polls = 0;
  while (polls < 50) {
    polls++;
    const x = await pollJob(ctx.env, s.jobId, { fetchImpl });
    if (x.finished || x.skipped) break;
  }
  assert.equal(polls, MAX_POLLS);
  assert.equal(ctx.DB.raw.prepare("SELECT email_validation FROM contacts WHERE id=?").get(a).email_validation, "error");
  assert.equal(ctx.DB.raw.prepare("SELECT status FROM email_validation_jobs").get().status, "failed");
});

check("P2-T7: contato suprimido não é enviado ao provedor; créditos esgotados viram falha registrada", async (ctx) => {
  const { add } = await ready(ctx);
  const a = await add("sair@valeverde.com.br", "Ana");
  await ctx.api("/api/suppression", "POST", { channel: "email", value: "sair@valeverde.com.br", reason: "opt_out" });
  const calls = [];
  const fetchImpl = provider({ "/v1/oauth/access_token": () => [200, token] }, calls);
  const { validateContact, pollJob: poll } = await import("../src/email-validation.js");
  const req = () => new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const actor = { id: "system-admin", tenant_id: "eag-internal", role: "admin" };
  const s = await validateContact(req(), ctx.env, actor, "rid", a, { fetchImpl });
  assert.deepEqual(s.skipped, [{ id: a, reason: "suprimido" }]);
  assert.equal(calls.length, 0);
  const b = await add("compras@valeverde.com.br", "Bia");
  const fetch2 = provider({
    "/v1/oauth/access_token": () => [200, token],
    "/v2/email-verification/start": () => [200, started],
    "/v2/email-verification/result": () => [200, { status: "not_enough_credits" }],
  });
  const s2 = await validateContact(req(), ctx.env, actor, "rid", b, { fetchImpl: fetch2 });
  const x = await poll(ctx.env, s2.jobId, { fetchImpl: fetch2 });
  assert.match(x.error, /créditos/);
  assert.equal(ctx.DB.raw.prepare("SELECT email_validation FROM contacts WHERE id=?").get(b).email_validation, "error");
});

check("P2-T7: credencial ausente responde erro sem chamar o provedor", async (ctx) => {
  const { add } = await ready(ctx);
  delete ctx.env.SNOV_CLIENT_SECRET;
  const a = await add("compras@valeverde.com.br", "Ana");
  const r2 = await ctx.api(`/api/contacts/${a}/validate-email`, "POST", {});
  assert.equal(r2.status, 502);
  assert.equal(r2.data.error.code, "email_validation_auth");
});
