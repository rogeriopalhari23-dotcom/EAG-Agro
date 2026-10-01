// Conferência da regra de validade do e-mail (decisão de 2026-10-01) com o código publicado e os estados reais dos
// contatos copiados da produção, num banco isolado em memória: nada é enviado, nada é aprovado na produção e qualquer
// chamada de rede é interceptada (a Snov não pode ser chamada). Uso: node scripts/conferir-validade-envio.mjs
import assert from "node:assert/strict";
import { setup } from "../tests/helpers/db.mjs";
import { pilot } from "../tests/helpers/pilot.mjs";
import { preSendCheck } from "../src/sending.js";

const realFetch = globalThis.fetch;
const network = [];
const ctx = setup();
try {
  const { dm } = await pilot(ctx, { email: "conferencia@exemplo.invalid" });
  ctx.DB.raw.exec("UPDATE channels SET state='planned' WHERE channel='email'"); // como na produção
  ctx.DB.raw.exec("UPDATE parameters SET value_json='30' WHERE parameter_key='email_validation_max_age_days'");
  globalThis.fetch = async (url) => {
    network.push(String(url));
    throw new Error("rede bloqueada na conferência");
  };
  const row = ctx.DB.raw.prepare("SELECT o.*,f.campaign_id FROM send_outbox o JOIN fichas f ON f.id=o.ficha_id WHERE o.step_no=1").get();
  const check = async (estado, at, semParametro = false) => {
    ctx.DB.raw.prepare("UPDATE contacts SET email_validation=?,email_validated_at=?,email_validation_expires_at=? WHERE id=?").run(estado.validation, estado.validatedAt, estado.expiresAt, dm);
    const r = await preSendCheck(ctx.env, row, { at, campaignId: row.campaign_id, market: "national", internationalEnabled: false, validationDays: semParametro ? undefined : 30 });
    return r.skip || r.block || r.cancel || "liberado";
  };
  // Estados reais (produção, 2026-10-01).
  const amori = { validation: "valid", validatedAt: "2026-10-01T18:33:34.906Z", expiresAt: "2026-10-31T18:33:34.906Z" };
  const blackyum = { validation: "valid", validatedAt: "2026-10-01T18:33:36.952Z", expiresAt: "2026-10-31T18:33:36.952Z" };
  const grad24 = { validation: "catchall", validatedAt: "2026-10-01T18:33:36.142Z", expiresAt: null };
  const resultados = {
    "Amori em 02/10 (dentro dos 30 dias)": await check(amori, "2026-10-02T13:00:00.000Z"),
    "Amori em 01/11 (vencido)": await check(amori, "2026-11-01T13:00:00.000Z"),
    "BLACK & YUM em 01/11 (vencido)": await check(blackyum, "2026-11-01T13:00:00.000Z"),
    "24grad catch-all": await check(grad24, "2026-10-02T13:00:00.000Z"),
    "valid sem data de validação": await check({ validation: "valid", validatedAt: null, expiresAt: null }, "2026-10-02T13:00:00.000Z"),
    "valid sem configuração (sem parâmetro e sem vencimento)": await check({ validation: "valid", validatedAt: "2026-10-01T18:33:34.906Z", expiresAt: null }, "2026-10-02T13:00:00.000Z", true),
    "valid de 01/09 sem vencimento gravado (data + 30 dias)": await check({ validation: "valid", validatedAt: "2026-09-01T12:00:00.000Z", expiresAt: null }, "2026-10-02T13:00:00.000Z"),
  };
  assert.equal(resultados["Amori em 02/10 (dentro dos 30 dias)"], "channel_not_enabled", "dentro do prazo passa da validade e para no canal planned");
  assert.equal(resultados["Amori em 01/11 (vencido)"], "email_validation_expired");
  assert.equal(resultados["BLACK & YUM em 01/11 (vencido)"], "email_validation_expired");
  assert.equal(resultados["24grad catch-all"], "email_not_validated");
  assert.equal(resultados["valid sem data de validação"], "email_validation_date_missing");
  assert.equal(resultados["valid sem configuração (sem parâmetro e sem vencimento)"], "email_validation_age_parameter_missing");
  assert.equal(resultados["valid de 01/09 sem vencimento gravado (data + 30 dias)"], "email_validation_expired");
  assert.equal(network.length, 0, "nenhuma chamada de rede (Snov) durante a conferência");
  console.log(JSON.stringify({ ok: true, resultados, chamadasDeRede: network.length }, null, 1));
} finally {
  globalThis.fetch = realFetch;
  ctx.close();
}
