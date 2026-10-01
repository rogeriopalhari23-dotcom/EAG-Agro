import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, transport, at, DAY } from "./helpers/pilot.mjs";
import { tick } from "../src/sending.js";
import { processMessage } from "../src/inbound.js";

// Resposta numa empresa com três commodities em andamento (R20.1 pausa empresa + commodity; R20.5 só alerta as
// outras) e a mesma resposta recebida de novo. Dados fictícios.
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(() => ctx.close());
    await fn(ctx);
  });
}
const enc = (s) => new TextEncoder().encode(s);
const reply = ({ from, inReplyTo = "", n = 1, body = "Podemos conversar na quinta." }) =>
  `From: ${from}\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: Re: Fornecedor\r\nMessage-ID: <multi-${n}@valeverde.com.br>\r\n${inReplyTo ? `In-Reply-To: ${inReplyTo}\r\n` : ""}Content-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`;

// Empresa com açúcar (pilot), milho e etanol: um contato por sequência, todas aprovadas.
async function threeCommodities(ctx) {
  const r = await pilot(ctx, { email: "acucar@valeverde.com.br" });
  const extra = [
    ["product-03", "milho@valeverde.com.br"],
    ["product-09", "etanol@valeverde.com.br"],
  ];
  ctx.env.INTERNAL_TEST_RECIPIENTS += "," + extra.map((x) => x[1]).join(",");
  for (const [productId, email] of extra) {
    const camp = await ctx.api("/api/campaigns", "POST", {
      productId, market: "national", name: `Campanha ${productId}`, originCity: "Sertãozinho", originUf: "SP",
      icp: { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
    });
    assert.equal(camp.status, 201, JSON.stringify(camp.data));
    const act = await ctx.api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
    assert.equal(act.status, 200, JSON.stringify(act.data));
    // Regra de ativação: no máximo 2 commodities ativas por mercado; a terceira fica "waiting". O teste é do tratamento
    // da resposta (sequências que já existem para 3 commodities), por isso a terceira é ativada direto no banco.
    ctx.DB.raw.prepare("UPDATE campaigns SET status='active' WHERE id=?").run(camp.data.id);
    await ctx.api(`/api/companies/${r.companyId}/profiles`, "POST", { productId, profileClass: "possible_final_consumer", basis: "CNAE" });
    const contact = (await ctx.api(`/api/companies/${r.companyId}/contacts`, "POST", { fullName: `Compras ${productId}`, email, prospectRole: "decision_maker", sourceLabel: "site", timezone: "America/Sao_Paulo" })).data.id;
    ctx.DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at='2099-01-01T12:00:00.000Z' WHERE id=?").run(contact);
    const ficha = await ctx.api("/api/fichas", "POST", { companyId: r.companyId, campaignId: camp.data.id, recipients: [contact] });
    assert.equal(ficha.status, 201, JSON.stringify(ficha.data));
    const f = (await ctx.api(`/api/fichas/${ficha.data.id}`)).data;
    const x = f.toApprove.find((a) => a.channel === "email");
    const ok = await ctx.api(`/api/fichas/${ficha.data.id}/approve`, "POST", { versionNo: 1, contactId: contact, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
  }
  const commodities = ctx.DB.raw.prepare("SELECT DISTINCT commodity FROM send_outbox WHERE company_id=? ORDER BY commodity").all(r.companyId).map((x) => x.commodity);
  assert.deepEqual(commodities, ["corn", "ethanol", "sugar"]);
  return r;
}
const byCommodity = (ctx, companyId) => {
  const out = {};
  for (const row of ctx.DB.raw.prepare("SELECT commodity,status FROM send_outbox WHERE company_id=? ORDER BY commodity,step_no").all(companyId))
    (out[row.commodity] ??= []).push(row.status);
  return out;
};
const tasks = (ctx, companyId) =>
  ctx.DB.raw.prepare("SELECT id,commodity,kind,priority FROM tasks WHERE company_id=? AND kind IN ('reply_followup','review_ambiguous') ORDER BY priority DESC,commodity").all(companyId).map((x) => ({ ...x }));

check("Resposta na thread em empresa com 3 commodities: pausa só a commodity da conversa e alerta as outras duas, sem colisão; repetição não repete efeito", async (ctx) => {
  const r = await threeCommodities(ctx);
  await tick(ctx.env, "eag-internal", { transport: transport(), now: at(10) });
  const sent = ctx.DB.raw.prepare("SELECT commodity,message_id FROM send_outbox WHERE company_id=? AND status='accepted'").get(r.companyId);
  assert.equal(sent.commodity, "sugar");

  const msg = enc(reply({ from: "Compras <acucar@valeverde.com.br>", inReplyTo: sent.message_id }));
  const out = await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: 11, bytes: msg }, at(12));
  assert.deepEqual({ c: out.classification, k: out.correlation }, { c: "human", k: "thread" });

  const st = byCommodity(ctx, r.companyId);
  assert.ok(st.sugar.slice(1).every((x) => x === "cancelled"), `açúcar pausado: ${st.sugar}`);
  assert.ok(st.corn.every((x) => x !== "cancelled") && st.ethanol.every((x) => x !== "cancelled"), "milho e etanol seguem (R20.5)");
  const t1 = tasks(ctx, r.companyId);
  assert.deepEqual(t1.map(({ commodity, kind, priority }) => ({ commodity, kind, priority })), [
    { commodity: "sugar", kind: "reply_followup", priority: 10 },
    { commodity: "corn", kind: "reply_followup", priority: 1 },
    { commodity: "ethanol", kind: "reply_followup", priority: 1 },
  ]);
  assert.equal(new Set(t1.map((x) => x.id)).size, 3, "ids distintos");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(DISTINCT inbound_id) n FROM tasks WHERE inbound_id IS NOT NULL").get().n, 1);

  // Mesma resposta de novo: mesmo UID, e depois outro UID e outra UIDVALIDITY (caixa renumerada).
  assert.equal((await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: 11, bytes: msg }, at(13))).duplicate, true);
  const again = await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 8, uid: 3, bytes: msg }, at(14));
  assert.equal(again.duplicate, true);
  assert.equal(again.of, out.id);
  assert.deepEqual(tasks(ctx, r.companyId), t1, "nenhuma tarefa nova");
  assert.deepEqual(byCommodity(ctx, r.companyId), st, "nenhum estado novo");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM inbound_messages").get().n, 1);
});

check("Resposta ambígua do mesmo remetente em duas commodities: pausa as duas, revisão para cada uma e alerta só a terceira", async (ctx) => {
  const r = await threeCommodities(ctx);
  await tick(ctx.env, "eag-internal", { transport: transport(), now: at(10) });
  // O mesmo endereço também recebeu o passo 1 do milho (outra campanha): duas commodities ligadas ao remetente.
  const sugarHash = ctx.DB.raw.prepare("SELECT email_hash FROM send_outbox WHERE company_id=? AND commodity='sugar' AND step_no=1").get(r.companyId).email_hash;
  ctx.DB.raw.prepare("UPDATE send_outbox SET email_hash=?,status='accepted',accepted_at=? WHERE company_id=? AND commodity='corn' AND step_no=1").run(sugarHash, at(10, 30), r.companyId);

  const out = await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: 21, bytes: enc(reply({ from: "acucar@valeverde.com.br", n: 2, body: "Recebi, me ligue." })) }, at(12));
  assert.equal(out.correlation, "ambiguous");
  const st = byCommodity(ctx, r.companyId);
  assert.ok(st.sugar.slice(1).every((x) => x === "cancelled") && st.corn.slice(1).every((x) => x === "cancelled"));
  assert.ok(st.ethanol.every((x) => x !== "cancelled"));
  const t1 = tasks(ctx, r.companyId);
  assert.deepEqual(t1.map(({ commodity, kind, priority }) => ({ commodity, kind, priority })), [
    { commodity: "corn", kind: "review_ambiguous", priority: 10 },
    { commodity: "sugar", kind: "review_ambiguous", priority: 10 },
    { commodity: "ethanol", kind: "reply_followup", priority: 1 },
  ]);
  assert.equal(new Set(t1.map((x) => x.id)).size, 3);
  assert.equal((await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 9, uid: 1, bytes: enc(reply({ from: "acucar@valeverde.com.br", n: 2, body: "Recebi, me ligue." })) }, at(13))).duplicate, true);
  assert.deepEqual(tasks(ctx, r.companyId), t1);
});
