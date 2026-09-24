import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, DAY, transport } from "./helpers/pilot.mjs";
import { tick } from "../src/sending.js";
import { classify } from "../src/inbound.js";
import { parseMessage } from "../src/mime.js";
import { TEMPLATES_EN_VERSION } from "../src/templates/prospeccao-vendas-en.js";

const ICP = { userSectors: ["confectionery"], sizeTarget: "medium", region: "Japan", decisionRole: "Purchasing", influencerRole: "Quality" };
const TOKYO = "tanaka@kashi.example";
const utc = (iso) => new Date(iso).toISOString();

// Parâmetros de envio e listas de sanções do piloto + campanha internacional (Japão) nascida de seleção.
async function world(t, { country = "JP", language = "en", email = TOKYO, tz = "Asia/Tokyo" } = {}) {
  const ctx = setup();
  t.after(ctx.close);
  const { api, DB, env } = ctx;
  await pilot(ctx); // nacional pronto: parâmetros, sanções, canal em teste interno
  env.INTERNAL_TEST_RECIPIENTS += `,${email}`;
  await api("/api/parameters/send_window", "PUT", { scope: "international", value: { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] }, reason: "Janela internacional do teste" });
  DB.raw.exec(`
    INSERT INTO country_analyses(id,tenant_id,iso3,period_months,snapshot_sha256,created_by) VALUES ('an','eag-internal','JPN',12,'h','system-admin');
    INSERT INTO commodity_selections(id,tenant_id,analysis_id,items_json,selected_by) VALUES ('sel','eag-internal','an','[{"campaignId":"cp-int","productId":"product-05","hs6":["090111"],"needsCommercialValidation":false}]','system-admin');
    INSERT INTO campaigns(id,tenant_id,product_id,market,name,country_code,language,analysis_id,selection_id,created_by) VALUES ('cp-int','eag-internal','product-05','international','Café · exterior','${country}','${language}','an','sel','system-admin');
  `);
  let c = (await api("/api/campaigns/cp-int")).data.campaign;
  assert.equal((await api("/api/campaigns/cp-int/icp", "PUT", { expectedVersion: c.version, icp: ICP })).status, 200);
  c = (await api("/api/campaigns/cp-int")).data.campaign;
  assert.equal((await api("/api/campaigns/cp-int/activate", "POST", { expectedVersion: c.version })).status, 200);
  const co = await api("/api/foreign-companies", "POST", { campaignId: "cp-int", legalName: "Kashi Kobo KK", registrationId: "1234567890123", registrationIdType: "CORPORATE_NUMBER", sourceLabel: "site" });
  assert.equal(co.status, 201, JSON.stringify(co.data));
  const id = co.data.id;
  await api(`/api/companies/${id}/profiles`, "POST", { productId: "product-05", profileClass: "possible_final_consumer", basis: "Confeitaria usa café como insumo" });
  await api(`/api/companies/${id}/size`, "PATCH", { sizeBand: "medium", source: "Site: 120 funcionários" });
  await api(`/api/companies/${id}/screening`, "POST", {});
  const dm = (await api(`/api/companies/${id}/contacts`, "POST", { fullName: "Haruto Tanaka", email, prospectRole: "decision_maker", sourceLabel: "LinkedIn" })).data.id;
  DB.raw.prepare("UPDATE contacts SET email_validation='valid' WHERE id=?").run(dm);
  return { ...ctx, companyId: id, dm, tz };
}
const release = (api, key, scope) => api(`/api/parameters/${key}`, "PUT", { scope, value: { enabled: true, evidenceRef: "docs/eag-compass-t1-validacao.md#liberacao" }, reason: "Liberação registrada no teste" });

test("P3-T10: ficha internacional sem fuso do destinatário não é gerada; com fuso sai em inglês (R18.6, PV12)", async (t) => {
  const { api, DB, companyId, dm } = await world(t);
  // Cenário "tradução sem aprovação vigente": a aprovação de 2026-09-24 perde a vigência.
  DB.raw.exec("UPDATE parameters SET effective_to='2026-09-24T00:00:01Z' WHERE parameter_key='templates_en_approved'");
  const noTz = await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", recipients: [dm] });
  assert.equal(noTz.data.error.code, "timezone_pending");
  assert.equal((await api(`/api/contacts/${dm}`, "PATCH", { timezone: "Asia/Tokyo" })).status, 200);
  const f = await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", recipients: [dm] });
  assert.equal(f.status, 201, JSON.stringify(f.data));
  // Tradução ainda não aprovada: PV12 reprova e a ficha não pode ser aprovada.
  assert.equal(f.data.reviewOk, false);
  assert.deepEqual(f.data.findings.map((x) => x.id), ["PV12"]);
  const view = (await api(`/api/fichas/${f.data.id}`)).data;
  const e1 = view.messages.find((m) => m.channel === "email" && m.step === 1);
  assert.equal(e1.subject, "Coffee supplier");
  assert.match(e1.body, /^Hi Haruto, I hope you're well\./);
  assert.match(view.version.snapshot.fichaNote, /Lacuna 🔴 \(R28\.15\)/);
  assert.equal(view.version.templates, TEMPLATES_EN_VERSION);
});

test("P3-T10: internacional desligado não aprova; liberado aprova e envia no horário de Tóquio (T12, R19.2 item 7)", async (t) => {
  const { api, env, companyId, dm } = await world(t);
  await api(`/api/contacts/${dm}`, "PATCH", { timezone: "Asia/Tokyo" });
  await release(api, "templates_en_approved", TEMPLATES_EN_VERSION);
  const f = (await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", recipients: [dm] })).data;
  assert.equal(f.reviewOk, true, JSON.stringify(f.findings));
  const view = (await api(`/api/fichas/${f.id}`)).data;
  const x = view.toApprove.find((a) => a.channel === "email");
  const approve = () => api(`/api/fichas/${f.id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY });
  assert.equal((await approve()).data.error.code, "international_not_enabled");
  await release(api, "international_enabled", "international");
  assert.equal((await approve()).status, 200);
  // Envios nacionais do piloto já concluídos/cancelados não interferem: deixa só o internacional na fila.
  env.DB.raw.exec("UPDATE send_outbox SET status='cancelled' WHERE ficha_id<>'" + f.id + "'");
  const tr = transport();
  // 10h em São Paulo = 22h em Tóquio → fora da janela do destinatário.
  let r = await tick(env, "eag-internal", { transport: tr, now: utc(`${DAY}T13:00:00Z`) });
  assert.equal(r.sent, 0);
  assert.equal(env.DB.raw.prepare("SELECT block_reason FROM send_outbox WHERE ficha_id=? AND step_no=1").get(f.id).block_reason, "outside_window");
  // 10h de terça em Tóquio (01h UTC) → dentro da janela; sai o E-mail 1 em inglês.
  r = await tick(env, "eag-internal", { transport: tr, now: utc("2099-01-06T01:00:00Z") });
  assert.equal(r.sent, 1, JSON.stringify(r));
  assert.equal(tr.sent[0].to, TOKYO);
  assert.equal(tr.sent[0].subject, "Coffee supplier");
});

test("P3-T10: liberação revogada segura o envio internacional já aprovado", async (t) => {
  const { api, env, companyId, dm } = await world(t);
  await api(`/api/contacts/${dm}`, "PATCH", { timezone: "Asia/Tokyo" });
  await release(api, "templates_en_approved", TEMPLATES_EN_VERSION);
  await release(api, "international_enabled", "international");
  const f = (await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", recipients: [dm] })).data;
  const x = (await api(`/api/fichas/${f.id}`)).data.toApprove.find((a) => a.channel === "email");
  assert.equal((await api(`/api/fichas/${f.id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY })).status, 200);
  env.DB.raw.exec("UPDATE send_outbox SET status='cancelled' WHERE ficha_id<>'" + f.id + "'");
  await api("/api/parameters/international_enabled", "PUT", { scope: "international", value: { enabled: false }, reason: "Suspensão registrada no teste" });
  const r = await tick(env, "eag-internal", { transport: transport(), now: utc("2099-01-06T01:00:00Z") });
  assert.equal(r.sent, 0);
  assert.equal(env.DB.raw.prepare("SELECT block_reason FROM send_outbox WHERE ficha_id=? AND step_no=1").get(f.id).block_reason, "international_not_enabled");
});

test("P3-T10: país lusófono usa o português (Portugal)", async (t) => {
  const { api, companyId, dm } = await world(t, { country: "PT", language: "pt-BR" });
  await api(`/api/contacts/${dm}`, "PATCH", { timezone: "Europe/Lisbon" });
  const f = (await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", recipients: [dm] })).data;
  assert.equal(f.reviewOk, true, JSON.stringify(f.findings));
  const e1 = (await api(`/api/fichas/${f.id}`)).data.messages.find((m) => m.channel === "email" && m.step === 1);
  assert.match(e1.body, /^Olá, Haruto, tudo bem\?/);
  assert.equal(e1.subject, "Fornecedor café");
});

test("P3-T10: respostas em inglês classificadas (descadastro, ausência, pedido de preço)", () => {
  const msg = (text, subject = "Re: Coffee supplier") =>
    parseMessage(`From: Haruto Tanaka <tanaka@kashi.example>\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n\r\n> Hi Haruto, I hope you're well.\r\n`);
  assert.equal(classify(msg("Please remove me from your list."), "rogeriopalhari@eagagro.com").kind, "unsubscribe");
  assert.equal(classify(msg("I'm away until Monday.", "Out of Office: back Monday"), "rogeriopalhari@eagagro.com").kind, "auto_reply");
  const price = classify(msg("Could you send me your price list?"), "rogeriopalhari@eagagro.com");
  assert.equal(price.kind, "human");
  assert.equal(price.priceRequest, true);
  assert.equal(classify(msg("Could you send a short presentation?"), "rogeriopalhari@eagagro.com").priceRequest, true);
});

test("P3-T10: o teto do dia é do remetente e soma Nacional + Internacional (R19.10)", async (t) => {
  const { api, env, companyId, dm } = await world(t, { country: "PT", language: "pt-BR", email: "compras@lisboa.example" });
  await api(`/api/contacts/${dm}`, "PATCH", { timezone: "Europe/Lisbon" });
  await release(api, "international_enabled", "international");
  const f = (await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", recipients: [dm] })).data;
  const x = (await api(`/api/fichas/${f.id}`)).data.toApprove.find((a) => a.channel === "email");
  assert.equal((await api(`/api/fichas/${f.id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY })).status, 200);
  await api("/api/parameters/send_daily_ramp", "PUT", { scope: "email", value: [1, 2], reason: "Teto 1 no teste" });
  env.DB.raw.exec("UPDATE sender_state SET ramp_step=0");
  // 13h UTC: 10h em São Paulo e 13h em Lisboa — os dois passos 1 (nacional e internacional) estão na janela.
  const tr = transport();
  const first = await tick(env, "eag-internal", { transport: tr, now: utc(`${DAY}T13:00:00Z`) });
  assert.equal(first.sent, 1);
  env.DB.raw.exec("UPDATE sender_state SET next_send_at=NULL");
  const second = await tick(env, "eag-internal", { transport: tr, now: utc(`${DAY}T15:00:00Z`) });
  assert.equal(second.reason, "daily_cap");
  assert.equal(tr.sent.length, 1);
});
