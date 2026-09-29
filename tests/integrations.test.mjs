import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { checkMailbox, checkComtrade, checkSuppression } from "../src/integrations.js";
import { AdapterError } from "../src/adapters/errors.js";

const admin = { tenant_id: "eag-internal", id: "system-admin", role: "admin" };
const req = () => new Request("https://x/api/integrations/mailbox/check", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });

test("Integrações: estado sem valores de segredo; só admin", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  Object.assign(ctx.env, { MAILBOX_USER: "rogeriopalhari@eagagro.com", MAILBOX_PASSWORD: "senha-que-nao-pode-aparecer", SNOV_CLIENT_ID: "id-secreto", EAG_POSTAL_ADDRESS: "Endereço" });
  const r = await ctx.api("/api/integrations");
  assert.equal(r.status, 200);
  const text = JSON.stringify(r.data);
  for (const secret of ["senha-que-nao-pode-aparecer", "id-secreto"]) assert.ok(!text.includes(secret), secret);
  assert.equal(r.data.email.passwordConfigured, true);
  assert.equal(r.data.providers.snov, false, "Snov exige id e segredo");
  assert.equal(r.data.providers.comtrade, false);
  assert.equal(r.data.infrastructure.r2, false);
  assert.equal(r.data.email.channel, "planned");
  ctx.DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('g','eag-internal','g@teste.invalid','Gerente','commercial_manager')");
  ctx.env.LOCAL_USER_EMAIL = "g@teste.invalid";
  assert.equal((await ctx.api("/api/integrations")).status, 403);
});

test("Integrações: conferência da caixa sem senha configurada é recusada sem conectar", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  ctx.env.MAILBOX_USER = "rogeriopalhari@eagagro.com";
  const r = await ctx.api("/api/integrations/mailbox/check", "POST", {});
  assert.equal(r.data.error.code, "mailbox_not_configured");
});

test("Integrações: conferência da caixa devolve ok ou o tipo do erro, audita e não expõe a senha", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  Object.assign(ctx.env, { MAILBOX_USER: "rogeriopalhari@eagagro.com", MAILBOX_PASSWORD: "senha-secreta" });
  const ok = await checkMailbox(req(), ctx.env, admin, "rid", { client: { check: async () => ({ messages: 12, uidValidity: 99 }) } });
  assert.deepEqual(ok, { ok: true, messagesInInbox: 12, uidValidity: 99 });
  const bad = await checkMailbox(req(), ctx.env, admin, "rid", { client: { check: async () => { throw new AdapterError("auth", "IMAP: NO [AUTHENTICATIONFAILED] Invalid credentials"); } } });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "auth");
  assert.ok(!JSON.stringify(bad).includes("senha-secreta"));
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='integration.mailbox_checked'").get().n, 2);
});

test("Integrações: alcance da caixa lê só a saudação, sem login, e audita", async (t) => {
  const { reachMailbox } = await import("../src/integrations.js");
  const ctx = setup();
  t.after(ctx.close);
  const written = [];
  const fake = (greeting) => ({
    readable: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(greeting + "\r\n")); } }),
    writable: new WritableStream({ write(chunk) { written.push(new TextDecoder().decode(chunk)); } }),
    close: async () => {},
  });
  const sockets = { connect: ({ port }) => fake(port === 993 ? "* OK [CAPABILITY IMAP4rev1] Server ready." : "220 ESMTP smtp.hostinger.com") };
  const r = await reachMailbox(req(), ctx.env, admin, "rid", { sockets });
  assert.deepEqual([r.imap.ok, r.smtp.ok], [true, true]);
  assert.ok(written.every((w) => !/LOGIN|AUTH|MAIL FROM|RCPT/.test(w)), "nenhum login nem envio: " + written.join("|"));
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='integration.mailbox_reached'").get().n, 1);
});

test("Integrações: chamada real da Comtrade devolve código e metadados, nunca a chave; 401 compara formas e endpoints", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const KEY = "rotulo: abcdef0123456789abcdef0123456789 segredo";
  ctx.env.COMTRADE_KEY = KEY;
  const seen = [];
  const fetch401 = async (url, init) => {
    seen.push({ path: new URL(url).pathname, header: !!init.headers["Ocp-Apim-Subscription-Key"], query: new URL(url).searchParams.has("subscription-key") });
    if (new URL(url).pathname.startsWith("/public/")) return Response.json({ count: 1, data: [{ refYear: 2024, reporterCode: 276, partnerCode: 76, flowCode: "M", cmdCode: "090111" }] });
    const sent = init.headers["Ocp-Apim-Subscription-Key"] || new URL(url).searchParams.get("subscription-key");
    return Response.json({ statusCode: 401, message: sent ? `Access denied due to invalid subscription key ${sent}` : "Access denied due to missing subscription key." }, { status: 401 });
  };
  const r = await checkComtrade(req(), ctx.env, admin, "rid", { fetch: fetch401 });
  const text = JSON.stringify(r);
  assert.ok(!text.includes(KEY.trim()) && !text.includes("abcdef0123456789abcdef0123456789"), "chave e trechos nunca aparecem: " + (text.match(/.{0,60}abcdef.{0,20}/g) || []).join(" | "));
  assert.deepEqual(r.calls.map((c) => c.status), [401, 401, 401, 200, 401]);
  assert.match(r.calls[2].message, /missing subscription key/);
  assert.equal(r.calls[3].count, 1, "endpoint público confirma parâmetros");
  assert.equal(r.calls[4].segmentLength, 32);
  assert.deepEqual(seen.slice(0, 2).map((x) => [x.header, x.query]), [[true, false], [false, true]]);
  assert.equal(r.shape.internalWhitespace, true);
  assert.equal(r.query.reporterCode, "276");
  assert.equal(ctx.DB.raw.prepare("SELECT count(*) n FROM audit_log WHERE action='integration.comtrade_checked'").get().n, 1);

  // Sucesso: uma chamada só, com registros resumidos.
  const ok = await checkComtrade(req(), ctx.env, admin, "rid", { fetch: async () => Response.json({ count: 1, data: [{ refYear: 2024, period: "2024", reporterCode: 276, reporterDesc: "Germany", partnerCode: 76, partnerDesc: "Brazil", flowCode: "M", flowDesc: "Import", cmdCode: "090111", cmdDesc: "Coffee", cifvalue: 10, primaryValue: 10, netWgt: 5 }], error: "" }) });
  assert.equal(ok.calls.length, 1);
  assert.equal(ok.calls[0].status, 200);
  assert.equal(ok.calls[0].records[0].partner, "76 Brazil");
  // Sem perfil admin → recusado.
  await assert.rejects(checkComtrade(req(), ctx.env, { ...admin, role: "commercial_manager" }, "rid", { fetch: fetch401 }));
});

test("Supressão: diagnóstico só leitura reconhece a chave, consulta a lista e não grava entrada; sem chave, acusa", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const r = await checkSuppression(req(), ctx.env, admin, "rid");
  assert.deepEqual([r.keyLoaded, r.stableHash, r.lookupOk, r.probeSuppressed, r.entries, r.error], [true, true, true, false, 0, null]);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n, 0, "não grava na lista");
  assert.doesNotMatch(JSON.stringify(r), /[0-9a-f]{64}/, "não devolve hash");
  const missing = await checkSuppression(req(), { ...ctx.env, SUPPRESSION_HMAC_KEY: undefined }, admin, "rid");
  assert.equal(missing.keyLoaded, false);
  assert.match(missing.error, /SUPPRESSION_HMAC_KEY ausente/);
  await assert.rejects(checkSuppression(req(), ctx.env, { ...admin, role: "operator" }, "rid"), (e) => e.status === 403);
});
