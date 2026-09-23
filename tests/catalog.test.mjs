import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { mentionableCharacteristics } from "../src/catalog.js";

function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
const reason = "Ajuste revisado pelo administrador";
const rev = async (api, id) => (await api(`/api/catalog/${id}`)).data.revision;

check("P1-T7: catálogo inicial tem 28 itens e CSO com identidade pendente", async ({ api }) => {
  const r = await api("/api/catalog");
  assert.equal(r.data.products.length, 28);
  const cso = r.data.products.find((p) => p.commodity === "cso");
  assert.equal(cso.identity_status, "pending");
  assert.equal(cso.revision, 1);
});

check("P1-T7: código confirmado exige fonte e versão; nunca inventado", async ({ api }) => {
  const base = { codeSystem: "NCM", code: "17011400", status: "confirmed", reason };
  const semFonte = await api("/api/catalog/product-06/codes", "POST", {
    ...base,
    expectedRevision: 1,
    classificationVersion: "NCM 2022",
  });
  assert.equal(semFonte.status, 422);
  assert.equal(semFonte.data.error.code, "code_source_required");
  const pendente = await api("/api/catalog/product-06/codes", "POST", {
    codeSystem: "NCM",
    code: "1701.14.00",
    expectedRevision: 1,
    reason,
  });
  assert.equal(pendente.status, 201);
  const p = (await api("/api/catalog/product-06")).data;
  assert.equal(p.codes[0].code, "17011400");
  assert.equal(p.codes[0].status, "pending");
  const formato = await api("/api/catalog/product-06/codes", "POST", {
    codeSystem: "NCM",
    code: "1701",
    expectedRevision: p.revision,
    reason,
  });
  assert.equal(formato.status, 422);
  assert.equal(formato.data.error.code, "invalid_code");
});

check("P1-T7: confirmar código registra fonte, versão, responsável e auditoria", async ({ api }) => {
  const added = await api("/api/catalog/product-06/codes", "POST", {
    codeSystem: "HS",
    code: "170114",
    expectedRevision: 1,
    reason,
  });
  const r = await api(`/api/catalog/product-06/codes/${added.data.id}`, "PATCH", {
    status: "confirmed",
    sourceRef: "Tabela NCM vigente, consulta de 2026-09-23",
    classificationVersion: "SH 2022",
    expectedRevision: 2,
    reason,
  });
  assert.equal(r.status, 200);
  const code = (await api("/api/catalog/product-06")).data.codes[0];
  assert.equal(code.status, "confirmed");
  assert.equal(code.updated_by, "system-admin");
  const audit = await api("/api/audit?entityId=product-06");
  assert.deepEqual(
    audit.data.events.map((e) => e.action).sort(),
    ["catalog.code_added", "catalog.code_updated"],
  );
});

check("P1-T7: edição concorrente do produto dá conflito", async ({ api }) => {
  const a = await api("/api/catalog/product-28", "PATCH", {
    variantName: "CSO (identidade em apuração)",
    expectedRevision: 1,
    reason,
  });
  assert.equal(a.status, 200);
  const b = await api("/api/catalog/product-28", "PATCH", {
    variantName: "CSO outro nome",
    expectedRevision: 1,
    reason,
  });
  assert.equal(b.status, 409);
  assert.equal(b.data.error.code, "edit_conflict");
});

check("P1-T7: identidade confirmada exige referência; pendente bloqueia campanha", async ({ api }) => {
  const r = await api("/api/catalog", "POST", {
    commodity: "cso_test",
    groupName: "Óleos",
    variantName: "Teste",
    origins: ["PORTFOLIO"],
    identityStatus: "confirmed",
    reason,
  });
  assert.equal(r.status, 422);
  const pend = await api("/api/catalog", "POST", {
    commodity: "cso_test",
    groupName: "Óleos",
    variantName: "Teste",
    origins: ["PORTFOLIO"],
    reason,
  });
  assert.equal(pend.status, 201);
  assert.equal(pend.data.identityStatus, "pending");
  const camp = await api("/api/campaigns", "POST", {
    productId: pend.data.id,
    market: "national",
    name: "Teste",
    originCity: "Franca",
    originUf: "SP",
    icp: {
      userSectors: ["balas"],
      sizeTarget: "medium",
      region: "SP",
      decisionRole: "Compras",
      influencerRole: "Qualidade",
    },
  });
  assert.equal(camp.status, 422);
  assert.equal(camp.data.error.code, "product_identity_pending");
});

check("P1-T7: commodity em uso não muda de identidade", async ({ api }) => {
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-03",
    market: "national",
    name: "Milho SP",
    originCity: "Franca",
    originUf: "SP",
    icp: {
      userSectors: ["rações"],
      sizeTarget: "medium",
      region: "SP",
      decisionRole: "Compras",
      influencerRole: "Nutrição",
    },
  });
  assert.equal(camp.status, 201);
  const r = await api("/api/catalog/product-03", "PATCH", {
    commodity: "wheat",
    expectedRevision: 1,
    reason,
  });
  assert.equal(r.status, 409);
  assert.equal(r.data.error.code, "commodity_in_use");
});

check("P1-T7: característica exige fonte; laudo de amostra nunca é mencionável", async ({ api }) => {
  const semFonte = await api("/api/catalog/product-19/characteristics", "POST", {
    key: "acidez",
    value: "0,05%",
    status: "confirmed",
    sampleOnly: false,
    expectedRevision: 1,
    reason,
  });
  assert.equal(semFonte.status, 422);
  const ok = await api("/api/catalog/product-19/characteristics", "POST", {
    key: "acidez",
    value: "0,05%",
    status: "confirmed",
    sampleOnly: false,
    sourceRef: "Especificação comercial revisada",
    expectedRevision: 1,
    reason,
  });
  assert.equal(ok.status, 201);
  const rows = (await api("/api/catalog/product-19")).data.characteristics;
  const citaveis = mentionableCharacteristics(rows).map((r) => r.char_key);
  assert.deepEqual(citaveis, ["acidez"]);
  assert.ok(rows.some((r) => r.sample_only === 1 && r.status === "confirmed"));
});

check("P1-T7: só administrador edita o catálogo", async ({ api, env }) => {
  env.LOCAL_USER_EMAIL = "admin@local.eag";
  const { DB } = { DB: env.DB };
  DB.raw.exec("UPDATE users SET role='seller_analyst' WHERE id='system-admin'");
  const r = await api("/api/catalog/product-06/codes", "POST", {
    codeSystem: "NCM",
    code: "17011400",
    expectedRevision: 1,
    reason,
  });
  assert.equal(r.status, 403);
  assert.equal(await rev(api, "product-06"), 1);
});
