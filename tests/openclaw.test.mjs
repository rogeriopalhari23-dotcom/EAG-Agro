import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { isSuppressed } from "../src/operations.js";

function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
const sha = "d".repeat(64);

check("P2-T15: supressões primeiro; contatos antes disso são recusados; reimportação não remove supressão", async ({ api, env }) => {
  const imp = (await api("/api/openclaw/imports", "POST", { fileSha256: sha })).data.id;
  const early = await api(`/api/openclaw/imports/${imp}/contacts`, "POST", { rows: [{ company: "X", email: "a@x.com", status: "ativo" }] });
  assert.equal(early.data.error.code, "suppressions_first");
  await api(`/api/openclaw/imports/${imp}/suppressions`, "POST", { emails: ["Sair@Empresa.com.br"] });
  await api(`/api/openclaw/imports/${imp}/close-suppressions`, "POST", {});
  assert.equal(await isSuppressed(env, "eag-internal", "email", "sair@empresa.com.br"), true);
  const r = await api(`/api/openclaw/imports/${imp}/contacts`, "POST", {
    rows: [
      { line: 2, company: "Empresa Um Ltda", cnpj: "11.222.333/0001-81", contactName: "Ana", email: "sair@empresa.com.br", status: "ativo" },
      { line: 3, company: "Empresa Dois Ltda", cnpj: "22333444000155", contactName: "Bia", email: "bia@dois.com", status: "respondeu", lastSent: "2026-08-01" },
      { line: 4, company: "Empresa Um Ltda", cnpj: "11222333000262", contactName: "Caio", email: "bia@dois.com", status: "pausado" },
    ],
  });
  assert.deepEqual(
    { companies: r.data.counts.companies, contacts: r.data.counts.contacts, transfers: r.data.counts.transfersPending, replies: r.data.counts.replies },
    { companies: 2, contacts: 3, transfers: 1, replies: 1 },
  );
  const rep = (await api(`/api/openclaw/imports/${imp}`)).data;
  assert.deepEqual(rep.conflicts.map((c) => c.issue).sort(), ["email_em_outra_empresa", "suprimido_aparece_como_ativo"]);
  assert.equal(await isSuppressed(env, "eag-internal", "email", "sair@empresa.com.br"), true);
  assert.equal((await api("/api/openclaw/imports", "POST", { fileSha256: sha })).status, 409);
});

check("P2-T15: empresa ativa no OpenClaw bloqueia ficha até a retirada comprovada (AT34, R25.3)", async ({ api, DB, env }) => {
  const imp = (await api("/api/openclaw/imports", "POST", { fileSha256: sha })).data.id;
  await api(`/api/openclaw/imports/${imp}/close-suppressions`, "POST", {});
  await api(`/api/openclaw/imports/${imp}/contacts`, "POST", { rows: [{ company: "Doces Vale Verde Ltda.", cnpj: "11222333000181", email: "compras@valeverde.com.br", status: "ativo" }] });
  const co = DB.raw.prepare("SELECT id FROM companies WHERE cnpj_root='11222333'").get().id;
  const { restrictionsFor } = await import("../src/restrictions.js");
  assert.ok((await restrictionsFor(env, "eag-internal", { companyId: co })).includes("openclaw_active"));
  assert.equal((await api("/api/openclaw/transfers", "POST", { companyId: co, evidence: "curto" })).status, 422);
  const ok = await api("/api/openclaw/transfers", "POST", { companyId: co, evidence: "Campanha desligada no OpenClaw em 2026-09-24, print arquivado" });
  assert.equal(ok.status, 200);
  assert.ok(!(await restrictionsFor(env, "eag-internal", { companyId: co })).includes("openclaw_active"));
});

check("P2-T15: sem CNPJ e nome já existente vira pendência, não fusão; só admin importa", async ({ api, DB, env }) => {
  await api("/api/companies", "POST", { legalName: "Mercado Central", countryCode: "BR", sourceLabel: "manual" });
  const imp = (await api("/api/openclaw/imports", "POST", { fileSha256: sha })).data.id;
  await api(`/api/openclaw/imports/${imp}/close-suppressions`, "POST", {});
  const r = await api(`/api/openclaw/imports/${imp}/contacts`, "POST", { rows: [{ company: "Mercado Central", email: "x@mc.com", status: "pausado" }] });
  assert.equal(r.data.conflicts, 1);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE legal_name='Mercado Central'").get().n, 1);
  DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('mgr','eag-internal','mgr@example.test','Gestor','commercial_manager')");
  env.LOCAL_USER_EMAIL = "mgr@example.test";
  assert.equal((await api("/api/openclaw/imports", "POST", { fileSha256: "e".repeat(64) })).status, 403);
});
