import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { complianceStatus } from "../src/scores.js";
import { normalizeEntityName } from "../src/sanctions.js";

const hash = "a".repeat(64);
async function source(api, key = "lista_teste") {
  const src = await api("/api/sanctions/sources", "POST", {
    sourceKey: key, name: "Lista de teste", officialUrl: "https://sancoes.exemplo/lista.csv", jurisdiction: "BR", blockingPolicy: "legal_block",
  });
  assert.equal(src.status, 201);
  return src.data.id;
}
const SEEDED = ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"];
// As três fontes semeadas pela 0.3.1 estão ativas: toda triagem exige lista vigente de todas (errata item 5).
async function importAll(api, entries, day = 0) {
  for (const sid of SEEDED) {
    const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: (sid.length.toString(16) + day).padEnd(64, "c"), recordCount: entries.length, downloadedAt: new Date(Date.now() + day).toISOString() });
    await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries });
    await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
  }
}
async function importList(api, sourceId, entries, declared = entries.length) {
  const v = await api(`/api/sanctions/sources/${sourceId}/versions`, "POST", { contentHash: hash, recordCount: declared, downloadedAt: new Date().toISOString() });
  assert.equal((await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries })).status, 200);
  return { versionId: v.data.id, finish: await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {}) };
}
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await ctx.api("/api/parameters/sanctions_max_age_hours", "PUT", { scope: "global", value: 24, reason: "Política de teste" });
    await fn(ctx);
  });
}
const company = async (api, over = {}) =>
  (await api("/api/companies", "POST", { legalName: "Comercial Exemplo Ltda.", countryCode: "BR", sourceLabel: "teste", ...over })).data.id;

test("P2-T16: nome normalizado ignora acento, pontuação e sufixo societário", () => {
  assert.equal(normalizeEntityName("Comércio Exemplo S/A"), normalizeEntityName("COMERCIO EXEMPLO"));
  assert.equal(normalizeEntityName("Acme Trading LLC"), "acme trading");
});

check("P2-T16: sem lista importada a triagem não conclui e o pré-envio fica 'indisponível' (R19.3)", async ({ api, env }) => {
  const id = await company(api);
  assert.equal((await complianceStatus(env, "eag-internal", id)).status, "unavailable");
  await source(api);
  assert.equal((await api(`/api/companies/${id}/screening`, "POST", {})).data.error.code, "sanctions_sources_unavailable");
});

check("P2-T16: importação parcial não vale; contagem conferida", async ({ api }) => {
  const sid = await source(api);
  const r = await importList(api, sid, [{ primaryName: "Outra Empresa" }], 2);
  assert.equal(r.finish.data.error.code, "import_incomplete");
});

check("P2-T16: nome parecido vai para revisão, não bloqueio (AT8); falso positivo libera com decisão auditada", async ({ api, env }) => {
  await importAll(api, [{ primaryName: "COMERCIAL EXEMPLO S/A", countryCode: "US", aliases: ["Exemplo Comercial"] }]);
  const id = await company(api);
  const run = await api(`/api/companies/${id}/screening`, "POST", {});
  assert.equal(run.data.matches, 3);
  assert.equal(run.data.review, 3);
  assert.equal((await complianceStatus(env, "eag-internal", id)).status, "review");
  const view = await api(`/api/companies/${id}/screening`);
  assert.equal((await api(`/api/screening-matches/${view.data.matches[0].id}/decisions`, "POST", { decision: "false_positive", reason: "curto" })).status, 422);
  for (const m of view.data.matches) {
    const d = await api(`/api/screening-matches/${m.id}/decisions`, "POST", { decision: "false_positive", reason: "Outra empresa, outro país e outro endereço conferidos" });
    assert.equal(d.status, 201);
  }
  assert.equal((await complianceStatus(env, "eag-internal", id)).status, "clear");
});

check("P2-T16: identificador oficial com país compatível bloqueia (AT9)", async ({ api, env }) => {
  await importAll(api, [{ primaryName: "Nome Diferente", officialEntityId: "11.222.333/0001-81", countryCode: "BR" }]);
  const id = await company(api, { registrationId: "11222333000181", registrationIdType: "CNPJ" });
  const run = await api(`/api/companies/${id}/screening`, "POST", {});
  assert.equal(run.data.block, 3);
  assert.equal((await complianceStatus(env, "eag-internal", id)).status, "blocked");
});

check("P2-T16: triagem sem ocorrência libera; lista nova invalida a triagem anterior", async ({ api, env }) => {
  await importAll(api, [{ primaryName: "Nada a Ver Ltda" }]);
  const sid = "source-ofac-sdn";
  const id = await company(api);
  await api(`/api/companies/${id}/screening`, "POST", {});
  assert.equal((await complianceStatus(env, "eag-internal", id)).status, "clear");
  const v2 = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: "b".repeat(64), recordCount: 1, downloadedAt: new Date(Date.now() + 1000).toISOString() });
  await api(`/api/sanctions/versions/${v2.data.id}/entries`, "POST", { entries: [{ primaryName: "Outra" }] });
  await api(`/api/sanctions/versions/${v2.data.id}/finish`, "POST", {});
  assert.equal((await complianceStatus(env, "eag-internal", id)).status, "unavailable");
});

check("P2-T16: só administrador cadastra fonte e decide", async ({ api, env, DB }) => {
  DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('mgr','eag-internal','mgr@example.test','Gestor','commercial_manager')");
  env.LOCAL_USER_EMAIL = "mgr@example.test";
  const r = await api("/api/sanctions/sources", "POST", { sourceKey: "x", name: "x", officialUrl: "https://x.exemplo", jurisdiction: "BR", blockingPolicy: "legal_block" });
  assert.equal(r.status, 403);
});
