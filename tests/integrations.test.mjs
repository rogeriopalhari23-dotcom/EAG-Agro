import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { checkMailbox } from "../src/integrations.js";
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
