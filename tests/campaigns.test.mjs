import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";

function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
const icp = (over = {}) => ({
  userSectors: ["balas e confeitos"],
  sizeTarget: "medium",
  region: "Interior de SP",
  decisionRole: "Gerente de compras",
  influencerRole: "Qualidade",
  ...over,
});
async function newCampaign(api, productId = "product-06") {
  const r = await api("/api/campaigns", "POST", {
    productId,
    market: "national",
    name: "Açúcar interior SP",
    originCity: "Sertãozinho",
    originUf: "SP",
    icp: icp(),
  });
  assert.equal(r.status, 201);
  return r.data.id;
}

check("P1-T9: edição do ICP sobe a versão e audita antes/depois", async ({ api, DB }) => {
  const id = await newCampaign(api);
  const r = await api(`/api/campaigns/${id}/icp`, "PUT", {
    expectedVersion: 1,
    icp: icp({ userSectors: ["refrigerantes", "sucos"], sizeTarget: "medium_plus" }),
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.version, 2);
  const c = (await api(`/api/campaigns/${id}`)).data;
  assert.equal(c.campaign.version, 2);
  assert.equal(c.icp.size_target, "medium_plus");
  assert.deepEqual(JSON.parse(c.icp.user_sectors_json), ["refrigerantes", "sucos"]);
  const audit = DB.raw
    .prepare("SELECT new_value_json FROM audit_log WHERE action='campaign.icp_updated' AND entity_id=?")
    .get(id);
  const v = JSON.parse(audit.new_value_json);
  assert.equal(v.before.size_target, "medium");
  assert.equal(v.after.size_target, "medium_plus");
});

check("P1-T9: ICP com versão antiga dá conflito; porte pequeno é recusado (K1)", async ({ api }) => {
  const id = await newCampaign(api);
  await api(`/api/campaigns/${id}/icp`, "PUT", { expectedVersion: 1, icp: icp() });
  const stale = await api(`/api/campaigns/${id}/icp`, "PUT", { expectedVersion: 1, icp: icp() });
  assert.equal(stale.status, 409);
  const small = await api(`/api/campaigns/${id}/icp`, "PUT", {
    expectedVersion: 2,
    icp: icp({ sizeTarget: "small" }),
  });
  assert.equal(small.status, 422);
});

check("P1-T9: revogar declaração tira a frase da campanha e fica no histórico", async ({ api }) => {
  const id = await newCampaign(api);
  const d = await api(`/api/campaigns/${id}/declarations`, "POST", {
    kind: "volume_available",
    valueBool: true,
    expectedVersion: 1,
  });
  assert.equal(d.status, 201);
  assert.equal((await api(`/api/campaigns/${id}`)).data.declarations.length, 1);
  const semMotivo = await api(`/api/campaigns/${id}/declarations/${d.data.id}/revoke`, "POST", {
    expectedVersion: 2,
    reason: "x",
  });
  assert.equal(semMotivo.status, 422);
  const r = await api(`/api/campaigns/${id}/declarations/${d.data.id}/revoke`, "POST", {
    expectedVersion: 2,
    reason: "Volume vendido; declaração não vale mais",
  });
  assert.equal(r.status, 200);
  assert.equal((await api(`/api/campaigns/${id}`)).data.declarations.length, 0);
  const hist = (await api(`/api/campaigns/${id}/declarations`)).data.items;
  assert.equal(hist.length, 1);
  assert.equal(hist[0].status, "revoked");
  const again = await api(`/api/campaigns/${id}/declarations/${d.data.id}/revoke`, "POST", {
    expectedVersion: 3,
    reason: "Tentativa repetida",
  });
  assert.equal(again.status, 409);
});

check("P1-T9: terceira commodity ativa espera; variante da mesma commodity não conta vaga", async ({ api }) => {
  const acucar = await newCampaign(api, "product-06");
  const milho = await newCampaign(api, "product-03");
  const soja = await newCampaign(api, "product-01");
  const acucarVhp = await newCampaign(api, "product-08");
  const act = (id) => api(`/api/campaigns/${id}/activate`, "POST", { expectedVersion: 1 });
  assert.equal((await act(acucar)).data.campaign.status, "active");
  assert.equal((await act(milho)).data.campaign.status, "active");
  assert.equal((await act(soja)).data.campaign.status, "waiting");
  assert.equal((await act(acucarVhp)).data.campaign.status, "active");
});

check("P1-T9: vendedor edita ICP mas não revoga declaração", async ({ api, env, DB }) => {
  const id = await newCampaign(api);
  const d = await api(`/api/campaigns/${id}/declarations`, "POST", {
    kind: "social_proof",
    text: "Fornecemos para indústrias de alimentos no interior de SP.",
    expectedVersion: 1,
  });
  DB.raw.exec(
    "INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('seller','eag-internal','seller@example.test','Vendedor','seller_analyst')",
  );
  env.LOCAL_USER_EMAIL = "seller@example.test";
  assert.equal(
    (await api(`/api/campaigns/${id}/icp`, "PUT", { expectedVersion: 2, icp: icp() })).status,
    200,
  );
  assert.equal(
    (
      await api(`/api/campaigns/${id}/declarations/${d.data.id}/revoke`, "POST", {
        expectedVersion: 3,
        reason: "Sem permissão para isto",
      })
    ).status,
    403,
  );
});
