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

test("Janela: fronteiras 09:00–17:00 (fim exclusivo), dias úteis e horário de verão pelo fuso do destinatário", async () => {
  const { inWindow } = await import("../src/timezone.js");
  const W = { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] };
  const cases = [
    // São Paulo (UTC−3, sem horário de verão desde 2019): segunda 2026-09-28
    ["2026-09-28T11:59:00Z", "America/Sao_Paulo", false, "08:59 fora"],
    ["2026-09-28T12:00:00Z", "America/Sao_Paulo", true, "09:00 dentro"],
    ["2026-09-28T19:59:00Z", "America/Sao_Paulo", true, "16:59 dentro"],
    ["2026-09-28T20:00:00Z", "America/Sao_Paulo", false, "17:00 fora (fim exclusivo)"],
    ["2026-10-02T19:59:00Z", "America/Sao_Paulo", true, "sexta 16:59 dentro"],
    ["2026-10-03T13:00:00Z", "America/Sao_Paulo", false, "sábado 10:00 fora"],
    ["2026-10-04T13:00:00Z", "America/Sao_Paulo", false, "domingo 10:00 fora"],
    ["2026-11-02T12:00:00Z", "America/Sao_Paulo", true, "novembro: Brasil sem horário de verão, 09:00 = 12:00 UTC"],
    // Manaus (UTC−4) e Acre (UTC−5)
    ["2026-09-28T12:59:00Z", "America/Manaus", false, "Manaus 08:59"],
    ["2026-09-28T13:00:00Z", "America/Manaus", true, "Manaus 09:00"],
    ["2026-09-28T14:00:00Z", "America/Rio_Branco", true, "Rio Branco 09:00"],
    // Berlim: horário de verão começa domingo 2026-03-29
    ["2026-03-27T07:59:00Z", "Europe/Berlin", false, "sexta antes do verão: 08:59 CET"],
    ["2026-03-27T08:00:00Z", "Europe/Berlin", true, "sexta antes do verão: 09:00 CET = 08:00 UTC"],
    ["2026-03-30T06:59:00Z", "Europe/Berlin", false, "segunda depois: 08:59 CEST"],
    ["2026-03-30T07:00:00Z", "Europe/Berlin", true, "segunda depois: 09:00 CEST = 07:00 UTC"],
    // Nova York: horário de verão termina domingo 2026-11-01
    ["2026-10-30T13:00:00Z", "America/New_York", true, "sexta EDT 09:00 = 13:00 UTC"],
    ["2026-11-02T13:00:00Z", "America/New_York", false, "segunda EST: 13:00 UTC = 08:00 local"],
    ["2026-11-02T14:00:00Z", "America/New_York", true, "segunda EST 09:00 = 14:00 UTC"],
    // Tóquio: segunda 09:00 local é domingo 00:00 UTC — vale o dia do destinatário
    ["2026-09-28T00:00:00Z", "Asia/Tokyo", true, "Tóquio segunda 09:00 (domingo em UTC)"],
    ["2026-09-26T00:00:00Z", "Asia/Tokyo", false, "Tóquio sábado 09:00 (sexta em UTC)"],
  ];
  for (const [iso, tz, expected, label] of cases) assert.equal(inWindow(iso, tz, W), expected, `${label} (${tz} ${iso})`);
});
