import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, DAY, transport } from "./helpers/pilot.mjs";
import { tick } from "../src/sending.js";

// Regra de horário aprovada por Rogério em 2026-09-25: 09:00–17:00 no fuso CONFIRMADO do destinatário,
// nacional ou internacional; sem fuso confirmado, o envio espera.
const utc = (iso) => new Date(iso).toISOString();

test("Janela: parâmetros aprovados em 2026-09-25 vigentes para os dois mercados", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const p = (await ctx.api("/api/parameters")).data.parameters;
  const expected = { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] };
  assert.deepEqual(p["send_window:national"], expected);
  assert.deepEqual(p["send_window:international"], expected);
  assert.equal(p["send_timezone:national"], undefined, "fuso de mercado não substitui o do destinatário");
});

test("Janela: contato nacional sem fuso confirmado espera, mesmo dentro do horário de Brasília", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const p = await pilot(ctx);
  ctx.DB.raw.prepare("UPDATE contacts SET timezone=NULL WHERE id=?").run(p.dm);
  const tr = transport();
  const r = await tick(ctx.env, "eag-internal", { transport: tr, now: utc(`${DAY}T13:00:00Z`) }); // 10h em Brasília
  assert.equal(r.sent, 0);
  assert.equal(tr.sent.length, 0);
  assert.equal(ctx.DB.raw.prepare("SELECT block_reason FROM send_outbox WHERE ficha_id=? AND step_no=1").get(p.fichaId).block_reason, "timezone_pending");
});

test("Janela: com fuso confirmado vale o horário local do destinatário (Manaus 09h = 10h de Brasília)", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const p = await pilot(ctx);
  ctx.DB.raw.prepare("UPDATE contacts SET timezone='America/Manaus' WHERE id=?").run(p.dm);
  const tr = transport();
  // 08:30 em Manaus (12:30 UTC) → fora; 09:05 em Manaus (13:05 UTC) → dentro.
  let r = await tick(ctx.env, "eag-internal", { transport: tr, now: utc(`${DAY}T12:30:00Z`) });
  assert.equal(r.sent, 0);
  assert.equal(ctx.DB.raw.prepare("SELECT block_reason FROM send_outbox WHERE ficha_id=? AND step_no=1").get(p.fichaId).block_reason, "outside_window");
  r = await tick(ctx.env, "eag-internal", { transport: tr, now: utc(`${DAY}T13:05:00Z`) });
  assert.equal(r.sent, 1);
});

test("Janela: sábado no fuso do destinatário não envia", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const p = await pilot(ctx);
  const r = await tick(ctx.env, "eag-internal", { transport: transport(), now: utc("2099-01-10T13:00:00Z") }); // sábado, 10h em Brasília
  assert.equal(r.sent, 0);
  void p;
});

test("Janela: cadastro de contato aceita fuso vazio (fica pendente) e recusa fuso inválido", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const co = await ctx.api("/api/companies", "POST", { legalName: "Fuso Teste Ltda.", countryCode: "BR", sourceLabel: "teste" });
  const add = (timezone) => ctx.api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: `Pessoa ${Math.random()}`, prospectRole: "decision_maker", sourceLabel: "site", timezone });
  const empty = await add("");
  assert.equal(empty.status, 201);
  assert.equal(ctx.DB.raw.prepare("SELECT timezone FROM contacts WHERE id=?").get(empty.data.id).timezone, null);
  assert.equal((await add("America/Sao_Pablo")).data.error.code, "timezone_invalid");
  const ok = await add(" America/Manaus ");
  assert.equal(ctx.DB.raw.prepare("SELECT timezone FROM contacts WHERE id=?").get(ok.data.id).timezone, "America/Manaus");
});
