// Redesign da interface (2026-10): dados somente leitura que a Visão geral usa. Só dados fictícios.
// - /api/dashboard separa prospects de testes internos (nome começando por TESTE) sem mudar o funil original.
// - /api/sending/today informa a última leitura da ponte e se está no prazo; informar não libera envio.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";

function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(() => ctx.close());
    await fn(ctx);
  });
}
const company = (api, legalName, registrationId) => api("/api/companies", "POST", { legalName, countryCode: "BR", registrationId, registrationIdType: "CNPJ", sourceLabel: "teste (fictício)" });

check("painel separa testes internos dos prospects sem alterar o funil", async ({ api }) => {
  await company(api, "Rações Vale Fictício Ltda", "11111111000191");
  await company(api, "Nutrição Fictícia SA", "22222222000191");
  await company(api, "TESTE INTERNO ponte de e-mail", "33333333000191");
  await company(api, "teste minúsculo também é teste", "44444444000191");
  const d = (await api("/api/dashboard")).data;
  assert.equal(d.pipeline.discovered, 4, "funil original continua contando tudo");
  assert.equal(d.prospectPipeline.discovered, 2);
  assert.equal(d.internalTests.total, 2);
  assert.match(d.internalTests.rule, /TESTE/);
});

check("leitura da ponte: ausente, recente e atrasada; não muda canal nem fila", async ({ api, DB }) => {
  DB.raw.prepare("UPDATE reply_reader_state SET last_read_ok_at=NULL WHERE tenant_id='eag-internal'").run();
  let t = (await api("/api/sending/today")).data;
  assert.equal(t.reader.lastReadOkAt, null);
  assert.equal(t.reader.healthy, false);
  assert.equal(t.reader.maxAgeMinutes, 10);
  const set = (iso) => DB.raw.prepare("UPDATE reply_reader_state SET last_read_ok_at=?, reader='bridge' WHERE tenant_id='eag-internal'").run(iso);
  set(new Date(Date.now() - 3 * 60000).toISOString());
  t = (await api("/api/sending/today")).data;
  assert.equal(t.reader.healthy, true);
  assert.equal(t.reader.source, "bridge");
  set(new Date(Date.now() - 30 * 60000).toISOString());
  t = (await api("/api/sending/today")).data;
  assert.equal(t.reader.healthy, false);
  assert.equal(t.channel, "planned");
  assert.deepEqual(t.queue, []);
});
