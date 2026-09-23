import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { icpStatus, canHaveFicha, contactTargetFlag } from "../src/profiles.js";

function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
async function companyWithUnit(ctx, sizeCode = "05") {
  const { api, DB } = ctx;
  const c = await api("/api/companies", "POST", {
    legalName: "Doces Vale Verde Ltda.",
    countryCode: "BR",
    registrationId: "11.222.333/0001-81",
    registrationIdType: "CNPJ",
    sourceLabel: "Cadastro manual de teste",
  });
  assert.equal(c.status, 201);
  DB.raw
    .prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES ('u1','eag-internal',?,'11222333000181',?,'teste','2026-09-23')")
    .run(c.data.id, sizeCode);
  return c.data.id;
}

test("P2-T6: regra do ICP (K1/K3) é determinística", () => {
  assert.equal(icpStatus({ profileClass: "possible_final_consumer", sizeCode: "05" }), "in_icp");
  assert.equal(icpStatus({ profileClass: "possible_final_consumer", sizeCode: "01" }), "out_small");
  assert.equal(icpStatus({ profileClass: "possible_final_consumer", sizeCode: "03" }), "out_small");
  assert.equal(icpStatus({ profileClass: "possible_final_consumer", sizeCode: null }), "pending_size");
  assert.equal(icpStatus({ profileClass: "trader_distributor", sizeCode: "05" }), "out_trader");
  assert.equal(icpStatus({ profileClass: "final_consumer_confirmed", sizeCode: "05", isGiant: true }), "out_giant");
  assert.equal(icpStatus({ profileClass: "unconfirmed", sizeBand: "medium_plus" }), "in_icp");
  assert.deepEqual(canHaveFicha({ icp_status: "out_small" }).ok, false);
  assert.deepEqual(canHaveFicha(null).ok, false);
});

test("P2-T6: CEO sem relacionamento e cargos de operação/RH são sinalizados (R15.6)", () => {
  assert.equal(contactTargetFlag("CEO", null), "executive_without_relationship");
  assert.equal(contactTargetFlag("Diretor Industrial", "Conhecemos desde 2019"), null);
  assert.equal(contactTargetFlag("Coordenadora de Logística", null), "out_of_icp_role");
  assert.equal(contactTargetFlag("Gerente de Compras", null), null);
});

check("P2-T6: CNPJ manual grava a raiz e recusa outra empresa com a mesma raiz", async (ctx) => {
  const id = await companyWithUnit(ctx);
  assert.equal(ctx.DB.raw.prepare("SELECT cnpj_root FROM companies WHERE id=?").get(id).cnpj_root, "11222333");
  const dup = await ctx.api("/api/companies", "POST", {
    legalName: "Filial Vale Verde",
    countryCode: "BR",
    registrationId: "11222333000262",
    registrationIdType: "CNPJ",
    sourceLabel: "teste",
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.data.error.details.id, id);
  const c = await ctx.api(`/api/companies/${id}`);
  assert.equal(c.data.units.length, 1);
});

check("P2-T6: consumidor final confirmado exige evidência empresarial válida; mercado nunca comprova", async (ctx) => {
  const id = await companyWithUnit(ctx);
  const semBase = await ctx.api(`/api/companies/${id}/profiles`, "POST", {
    productId: "product-06",
    profileClass: "final_consumer_confirmed",
    basis: "Indício por CNAE",
  });
  assert.equal(semBase.data.error.code, "profile_needs_evidence");
  const mercado = await ctx.api(`/api/companies/${id}/evidence`, "POST", {
    category: "market",
    evidenceType: "trade_statistics",
    reference: "Comex Stat",
    consultedAt: new Date().toISOString().slice(0, 10),
    validationStatus: "valid",
  });
  const comMercado = await ctx.api(`/api/companies/${id}/profiles`, "POST", {
    productId: "product-06",
    profileClass: "final_consumer_confirmed",
    basis: "Dado de mercado",
    evidenceId: mercado.data.id,
  });
  assert.equal(comMercado.data.error.code, "profile_needs_evidence");
  const doc = await ctx.api(`/api/companies/${id}/evidence`, "POST", {
    category: "business",
    evidenceType: "commercial_document",
    reference: "Pedido de compra de açúcar 2026",
    consultedAt: new Date().toISOString().slice(0, 10),
    validationStatus: "valid",
    productId: "product-07",
    market: "national",
  });
  const ok = await ctx.api(`/api/companies/${id}/profiles`, "POST", {
    productId: "product-06",
    profileClass: "final_consumer_confirmed",
    basis: "Pedido de compra",
    evidenceId: doc.data.id,
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.icpStatus, "in_icp");
  assert.equal(ok.data.ficha.ok, true);
});

check("P2-T6: trader só com exceção de gestor; gigante só com relacionamento; porte desconhecido com objetivo", async (ctx) => {
  const id = await companyWithUnit(ctx, null);
  const trader = await ctx.api(`/api/companies/${id}/profiles`, "POST", {
    productId: "product-06",
    profileClass: "trader_distributor",
    basis: "Site da empresa declara revenda",
  });
  assert.equal(trader.data.icpStatus, "out_trader");
  assert.equal(trader.data.ficha.ok, false);
  const exc = await ctx.api(`/api/profiles/${trader.data.id}`, "PATCH", {
    exceptionReason: "Trader com consumo próprio comprovado em visita",
    expectedRevision: 1,
  });
  assert.equal(exc.data.ficha.ok, true);
  const pending = await ctx.api(`/api/companies/${id}/profiles`, "POST", {
    productId: "product-03",
    profileClass: "possible_final_consumer",
    basis: "CNAE compatível",
  });
  assert.equal(pending.data.icpStatus, "pending_size");
  assert.equal(pending.data.ficha.ok, false);
  const goal = await ctx.api(`/api/profiles/${pending.data.id}`, "PATCH", { sizeCallGoal: true, expectedRevision: 1 });
  assert.equal(goal.data.ficha.ok, true);
  const giant = await ctx.api(`/api/companies/${id}/profiles`, "POST", {
    productId: "product-01",
    profileClass: "possible_final_consumer",
    basis: "Líder nacional",
    isGiant: true,
  });
  assert.equal(giant.data.icpStatus, "out_giant");
  const rel = await ctx.api(`/api/profiles/${giant.data.id}`, "PATCH", {
    relationshipNote: "Rogério atende o gerente de compras desde 2021",
    expectedRevision: 1,
  });
  assert.equal(rel.data.ficha.ok, true);
});

check("P2-T6: vendedor não cria exceção de trader; edição com revisão antiga dá conflito", async (ctx) => {
  const id = await companyWithUnit(ctx);
  const t = await ctx.api(`/api/companies/${id}/profiles`, "POST", {
    productId: "product-06",
    profileClass: "trader_distributor",
    basis: "Revenda",
  });
  ctx.DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('seller','eag-internal','seller@example.test','Vendedor','seller_analyst')");
  ctx.env.LOCAL_USER_EMAIL = "seller@example.test";
  const r = await ctx.api(`/api/profiles/${t.data.id}`, "PATCH", { exceptionReason: "Quero enviar mesmo assim", expectedRevision: 1 });
  assert.equal(r.status, 403);
  ctx.env.LOCAL_USER_EMAIL = "admin@local.eag";
  await ctx.api(`/api/profiles/${t.data.id}`, "PATCH", { exceptionReason: "Consumo próprio comprovado", expectedRevision: 1 });
  const stale = await ctx.api(`/api/profiles/${t.data.id}`, "PATCH", { sizeCallGoal: true, expectedRevision: 1 });
  assert.equal(stale.status, 409);
});

check("P2-T6: contato com papel, hash do e-mail e validação pendente; suprimido é sinalizado; fuso validado", async (ctx) => {
  const id = await companyWithUnit(ctx);
  await ctx.api("/api/suppression", "POST", { channel: "email", value: "Compras@ValeVerde.com.br", reason: "opt_out" });
  const c = await ctx.api(`/api/companies/${id}/contacts`, "POST", {
    fullName: "Maria Souza",
    jobTitle: "Gerente de Compras",
    email: "compras@valeverde.com.br",
    prospectRole: "decision_maker",
    sourceLabel: "Site da empresa",
  });
  assert.equal(c.status, 201);
  assert.equal(c.data.suppressed, true);
  const row = ctx.DB.raw.prepare("SELECT prospect_role,email_hash,email_validation,email_encrypted FROM contacts WHERE id=?").get(c.data.id);
  assert.equal(row.prospect_role, "decision_maker");
  assert.equal(row.email_validation, "pending");
  assert.match(row.email_hash, /^[0-9a-f]{64}$/);
  assert.ok(!row.email_encrypted.includes("valeverde"));
  assert.equal((await ctx.api(`/api/contacts/${c.data.id}`, "PATCH", { timezone: "America/Sao_Pablo" })).status, 422);
  const ok = await ctx.api(`/api/contacts/${c.data.id}`, "PATCH", { timezone: "America/Sao_Paulo", relationshipNote: "Conhece a EAG" });
  assert.equal(ok.data.timezone, "America/Sao_Paulo");
  const view = await ctx.api(`/api/companies/${id}`);
  assert.equal(view.data.contacts[0].prospectRole, "decision_maker");
  assert.equal(view.data.contacts[0].emailValidation, "pending");
});
