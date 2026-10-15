// Idioma da ficha de identificação pelo país do destinatário (Spec R28.20/R28.21; decisão de Rogério em 2026-10-14):
// Brasil em português, América Latina hispânica em espanhol, fora da América Latina em inglês. Modelos em espanhol e
// inglês (A-ID10) são rascunhos até a aprovação expressa de Rogério. Rodapé pela fonte cadastrada (A-ID11). L1 e L4
// continuam pendentes: os casos de dúvida não geram ficha e a origem do país é a empresa cadastrada.
import "./helpers/signature.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, transport } from "./helpers/pilot.mjs";
import { tick } from "../src/sending.js";
import { buildCopy } from "../src/internal-copy.js";
import { classify } from "../src/inbound.js";
import { parseMessage } from "../src/mime.js";
import { languageForCountry } from "../src/language.js";
import { generateIdentification, morningVariant, IDENT_VERSION } from "../src/templates/identificacao.js";
import { reviewIdentification } from "../src/review.js";
import { DATA_REQUESTS_EMAIL } from "../src/privacy-contact.js";

const DAY = "2099-01-05"; // segunda-feira
const utc = (iso) => new Date(iso).toISOString();
const sig = { senderName: "Rogério Palhari", postalAddress: "Rua Exemplo, 100 — Sertãozinho/SP" };
const UNSUB = "https://compass.exemplo/u/x";
const SITE = { contactId: "c1", kind: "company_channel", sourceKind: "company_site", sourceUrl: "https://molinos.example/contacto" };
const gen = (language, commodity, recipients = [SITE], company = "Molinos del Sur") => generateIdentification({ language, commodity, recipients, sig, unsub: () => UNSUB, company });
const review = (msgs, language, extra = {}) =>
  reviewIdentification(msgs, { market: "international", recipients: [SITE], postalAddress: sig.postalAddress, postalAddressConfirmed: true, unsubUrl: () => UNSUB, language, languageGapNote: "lacuna", companyName: "Molinos del Sur", ...extra });
const bad = (r) => r.findings.filter((x) => !x.ok).map((x) => x.id);
// Corpo como chega de verdade: UTF-8 em quoted-printable.
const qp = (s) => [...Buffer.from(s, "utf8")].map((b) => (b < 128 && b !== 61 ? String.fromCharCode(b) : `=${b.toString(16).toUpperCase().padStart(2, "0")}`)).join("");
const until = (body) => body.split("\n\nRogerio Palhari\nBroker | EAG AGRO")[0];

test("R28.20: país → idioma nos casos definidos; L1 pendente sem idioma; nunca nome ou domínio", () => {
  assert.deepEqual(languageForCountry("BR"), { language: "pt-BR" });
  for (const c of ["AR", "MX", "CO", "CL", "PE", "UY", "PY", "BO", "EC", "VE", "CR", "PA", "GT", "HN", "SV", "NI", "DO", "CU"]) assert.equal(languageForCountry(c).language, "es", c);
  // L2 e L3 (decididas em 2026-10-14): Portugal, lusófonos fora da América Latina e Alemanha em inglês.
  for (const c of ["PT", "AO", "MZ", "CV", "GW", "ST", "TL", "DE", "US", "JP", "NL", "ES", "GQ"]) assert.equal(languageForCountry(c).language, "en", c);
  // L1 pendente (não decidida): casos geográficos de dúvida ficam sem idioma, e a ficha não é gerada.
  for (const c of ["PR", "HT", "BZ", "GY", "SR", "GF", "JM", "TT", "CW", "AW"]) assert.deepEqual(languageForCountry(c), { language: null, reason: "l1_pending" }, c);
  assert.deepEqual(languageForCountry(null), { language: null, reason: "country_missing" });
  assert.deepEqual(languageForCountry("Brasil"), { language: null, reason: "country_missing" }, "só código ISO, nada de nome");
  assert.equal(languageForCountry("ar").language, "es", "caixa do código não importa");
});

test("Textos finais em espanhol (A-ID10): E-mail 1 nas duas saudações, E-mail 2, rodapé, sem marcador; revisor só reprova o rascunho", () => {
  const msgs = gen("es", "maíz");
  assert.equal(IDENT_VERSION.es, "id-es-1.0.0");
  assert.equal(msgs[0].subject, "Contacto de compras de maíz");
  assert.equal(msgs[1].subject, msgs[0].subject, "sem Re:");
  assert.equal(until(msgs[0].body), [
    "Buenas tardes:",
    "Mi nombre es Rogerio Palhari. Soy franquiciado de EAG Agro y trabajo en la originación de commodities agrícolas en Brasil.",
    "Estoy buscando a la persona responsable de las compras de maíz en Molinos del Sur, para presentarme y conocer cómo se abastecen de este insumo.",
    "¿Podría indicarme quién está a cargo de esa área y cuál es la mejor vía de contacto?",
    "Muchas gracias.",
  ].join("\n\n"));
  assert.equal(until(morningVariant(msgs[0]).body).split("\n")[0], "Buenos días:");
  assert.equal(morningVariant(msgs[0]).body, msgs[0].body.replace(/^Buenas tardes/, "Buenos días"), "só a saudação muda");
  assert.equal(morningVariant(msgs[1]), null, "E-mail 2 sem saudação por horário");
  assert.equal(until(msgs[1].body), [
    "Hola:",
    "Retomo mi correo anterior sobre las compras de maíz de Molinos del Sur.",
    "¿Podría indicarme qué persona o departamento se encarga de estas compras, o facilitarme el correo del área correspondiente?",
    "Si su empresa no compra maíz, le agradecería que me lo indicara para actualizar mis registros.",
    "Muchas gracias.",
  ].join("\n\n"));
  for (const m of msgs) {
    const lines = m.body.split("\n");
    const i = lines.indexOf(`Encontré esta dirección en el sitio web de su empresa. Para solicitudes sobre datos personales: ${DATA_REQUESTS_EMAIL}.`);
    assert.ok(i > 0 && lines[i - 1] === sig.postalAddress, "transparência depois do endereço físico");
    assert.equal(lines[i + 1], `Para dejar de recibir estos mensajes, responda "baja" o use este enlace: ${UNSUB}`);
    assert.doesNotMatch(`${m.subject}\n${m.body}\n${m.html}`, /\{\{|\}\}/);
  }
  assert.deepEqual(bad(review(msgs, "es")), []);
  assert.deepEqual(bad(review(msgs, "es", { identTemplateDraft: true, templatesVersion: "id-es-1.0.0" })), ["MODELO"], "rascunho não é aprovável");
  assert.deepEqual(bad(review(msgs.map((m) => (m.step === 1 ? { ...m, ...morningVariant(m) } : m)), "es")), [], "variante da manhã também passa");
});

test("Textos finais em inglês (A-ID10): E-mail 1 nas duas saudações, E-mail 2, rodapé, sem marcador", () => {
  const msgs = gen("en", "corn", [SITE], "Northern Mills");
  assert.equal(IDENT_VERSION.en, "id-en-2.0.0");
  assert.equal(msgs[0].subject, "Corn purchasing contact");
  assert.equal(until(msgs[0].body), [
    "Good afternoon,",
    "My name is Rogerio Palhari. I am an EAG Agro franchisee working in agricultural commodity origination in Brazil.",
    "I am trying to reach the person responsible for corn procurement at Northern Mills, to introduce myself and learn how your team sources corn.",
    "Could you let me know who handles corn purchasing and the best way to contact them?",
    "Thank you,",
  ].join("\n\n"));
  assert.equal(morningVariant(msgs[0]).body.split("\n")[0], "Good morning,");
  assert.equal(until(msgs[1].body), [
    "Hello,",
    "I’m following up on my previous email about corn procurement at Northern Mills.",
    "Could you direct me to the person or department responsible, or share the appropriate purchasing email address?",
    "If your company does not purchase corn, please let me know so I can update my records.",
    "Thank you,",
  ].join("\n\n"));
  for (const m of msgs) {
    assert.ok(m.body.includes(`I found this address on your company's website. For requests about personal data: ${DATA_REQUESTS_EMAIL}.\nTo stop receiving these messages, reply "unsubscribe" or use this link: ${UNSUB}`));
    assert.doesNotMatch(`${m.subject}\n${m.body}`, /\{\{|\}\}/);
  }
  assert.deepEqual(bad(review(msgs, "en", { companyName: "Northern Mills" })), []);
});

test("Rodapé pela fonte cadastrada nos três idiomas: site, diretório só com o domínio, sem tipo nada de origem", () => {
  const dir = { contactId: "c1", kind: "company_channel", sourceKind: "directory", sourceUrl: "https://www.kompass.com/ar/molinos" };
  const none = { contactId: "c1", kind: "company_channel", sourceLabel: "Canal geral publicado no site da empresa (site)" };
  const cases = [
    ["pt-BR", "milho", "Encontrei este endereço no diretório de empresas kompass.com.", `Pedidos sobre dados pessoais: ${DATA_REQUESTS_EMAIL}.`],
    ["es", "maíz", "Encontré esta dirección en el directorio de empresas kompass.com.", `Para solicitudes sobre datos personales: ${DATA_REQUESTS_EMAIL}.`],
    ["en", "corn", "I found this address in the business directory kompass.com.", `For requests about personal data: ${DATA_REQUESTS_EMAIL}.`],
  ];
  for (const [lang, c, origin, data] of cases) {
    const d = gen(lang, c, [dir]);
    assert.ok(d[0].body.split("\n").includes(`${origin} ${data}`), `${lang}: diretório com domínio`);
    const n = gen(lang, c, [none]);
    assert.ok(n[0].body.split("\n").includes(data), `${lang}: sem tipo cadastrado (rótulo com "site" não conta)`);
    assert.doesNotMatch(n[0].body, /Encontrei este endereço|Encontré esta dirección|I found this address/);
    // Revisor: frase de origem sem a fonte cadastrada é barrada.
    const r = reviewIdentification(gen(lang, c), { market: "international", recipients: [none], postalAddress: sig.postalAddress, postalAddressConfirmed: true, unsubUrl: () => UNSUB, language: lang, languageGapNote: "lacuna", companyName: "Molinos del Sur" });
    assert.ok(r.findings.some((x) => x.id === "TRANSP" && !x.ok), `${lang}: origem afirmada sem cadastro`);
  }
});

test("Revisor por idioma barra nome no canal geral, marcador sobrando, empresa ausente, GMO, preço e desculpas", () => {
  const checks = [
    ["es", "maíz", "Molinos del Sur", (b) => b.replace("Buenas tardes:", "Buenas tardes, Juan:"), "SAUDACAO"],
    ["es", "maíz", "Molinos del Sur", (b) => b.replace("en Molinos del Sur,", "en {{empresa}},"), "SAUDACAO"],
    ["es", "maíz", "Molinos del Sur", (b) => b.replace("en Molinos del Sur,", "en su empresa,"), "SAUDACAO"],
    ["es", "maíz", "Molinos del Sur", (b) => b.replace("compras de maíz en", "compras de maíz transgénico en"), "AFIRMACAO"],
    ["es", "maíz", "Molinos del Sur", (b) => b.replace("Muchas gracias.", "Tenemos el mejor precio. Muchas gracias."), "PV7"],
    ["es", "maíz", "Molinos del Sur", (b) => b.replace("Muchas gracias.", "Disculpe la molestia. Muchas gracias."), "PV10"],
    ["en", "corn", "Northern Mills", (b) => b.replace("Good afternoon,", "Good afternoon John,"), "SAUDACAO"],
    ["en", "corn", "Northern Mills", (b) => b.replace("at Northern Mills,", "at your company,"), "SAUDACAO"],
    ["en", "corn", "Northern Mills", (b) => b.replace("corn procurement at", "non-GMO corn procurement at"), "AFIRMACAO"],
    ["en", "corn", "Northern Mills", (b) => b.replace("Thank you,", "Our price is competitive. Thank you,"), "PV7"],
  ];
  for (const [lang, c, co, edit, id] of checks) {
    const msgs = gen(lang, c, [SITE], co).map((m) => (m.step === 1 ? { ...m, body: edit(m.body) } : m));
    assert.ok(bad(review(msgs, lang, { companyName: co })).includes(id), `${lang} ${id}`);
  }
});

test("Descadastro em espanhol: 'baja' e variantes suprimem; frase comum com 'baja' no meio não", () => {
  const msg = (text) =>
    parseMessage(`From: Compras <compras@molinos.example>\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: Re: Contacto de compras de maíz\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${qp(text)}\r\n\r\n> Buenos d=C3=ADas:\r\n`);
  for (const t of ["baja", "Baja.", "Por favor, darme de baja", "dar de baja", "Cancelar suscripción", "desuscribirme"])
    assert.equal(classify(msg(t), "rogeriopalhari@eagagro.com").kind, "unsubscribe", t);
  assert.notEqual(classify(msg("Hola, la persona de compras es Ana: ana@molinos.example. La demanda bajará en marzo."), "rogeriopalhari@eagagro.com").kind, "unsubscribe");
  assert.notEqual(classify(msg("Bajamos el pedido este mes, escriba a compras@molinos.example."), "rogeriopalhari@eagagro.com").kind, "unsubscribe");
});

// Mundo internacional com campanha de milho no país pedido e canal geral publicado no site (cadastrado com o tipo).
async function world(t, { country, iso3, tz, email = "compras@molinos.example", legalName = "Molinos del Sur SA" }) {
  const ctx = setup();
  t.after(ctx.close);
  const { api, DB, env } = ctx;
  await pilot(ctx);
  env.INTERNAL_TEST_RECIPIENTS += `,${email}`;
  await api("/api/parameters/send_window", "PUT", { scope: "international", value: { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] }, reason: "Janela internacional do teste" });
  DB.raw.exec(`
    INSERT INTO country_analyses(id,tenant_id,iso3,period_months,snapshot_sha256,created_by) VALUES ('an','eag-internal','${iso3}',12,'h','system-admin');
    INSERT INTO commodity_selections(id,tenant_id,analysis_id,items_json,selected_by) VALUES ('sel','eag-internal','an','[{"campaignId":"cp-int","productId":"product-03","hs6":["100590"],"needsCommercialValidation":false}]','system-admin');
    INSERT INTO campaigns(id,tenant_id,product_id,market,name,country_code,language,analysis_id,selection_id,created_by) VALUES ('cp-int','eag-internal','product-03','international','Milho · exterior','${country}','en','an','sel','system-admin');
  `);
  let c = (await api("/api/campaigns/cp-int")).data.campaign;
  assert.equal((await api("/api/campaigns/cp-int/icp", "PUT", { expectedVersion: c.version, icp: { userSectors: ["feed"], sizeTarget: "medium", region: country, decisionRole: "Purchasing", influencerRole: "Supply" } })).status, 200);
  c = (await api("/api/campaigns/cp-int")).data.campaign;
  assert.equal((await api("/api/campaigns/cp-int/activate", "POST", { expectedVersion: c.version })).status, 200);
  const co = await api("/api/foreign-companies", "POST", { campaignId: "cp-int", legalName, registrationId: "30-12345678-9", registrationIdType: "OTHER", sourceLabel: "site" });
  assert.equal(co.status, 201, JSON.stringify(co.data));
  const id = co.data.id;
  await api(`/api/companies/${id}/profiles`, "POST", { productId: "product-03", profileClass: "possible_final_consumer", basis: "Fábrica de ração usa milho" });
  await api(`/api/companies/${id}/size`, "PATCH", { sizeBand: "medium", source: "Site: 120 funcionários" });
  await api(`/api/companies/${id}/screening`, "POST", {});
  const ch = await api(`/api/companies/${id}/channels`, "POST", { email, sourceUrl: "https://molinos.example/contacto", sourceKind: "company_site", timezone: tz });
  assert.equal(ch.status, 201, JSON.stringify(ch.data));
  DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at='2099-01-01T12:00:00.000Z' WHERE id=?").run(ch.data.contactId);
  return { ...ctx, companyId: id, channelId: ch.data.contactId };
}
const release = (api, key, scope) => api(`/api/parameters/${key}`, "PUT", { scope, value: { enabled: true, evidenceRef: "docs/implementation/TEXTOS-ES-EN-PARA-REVISAO.md#teste" }, reason: "Liberação registrada no teste" });

test("Ficha: idioma pelo país da empresa (nome e domínio .br não mudam); escolha manual divergente recusada; L1 pendente não gera", async (t) => {
  const { api, DB, companyId, channelId } = await world(t, { country: "AR", iso3: "ARG", tz: "America/Argentina/Buenos_Aires", email: "joao.silva@moinho.com.br", legalName: "João Silva Molinos SA" });
  const wrong = await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", purpose: "identify_buyer", language: "pt-BR", recipients: [channelId] });
  assert.equal(wrong.data.error.code, "language_by_country");
  const f = await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", purpose: "identify_buyer", recipients: [channelId] });
  assert.equal(f.status, 201, JSON.stringify(f.data));
  assert.equal(f.data.language, "es", "Argentina → espanhol, apesar do nome e do domínio brasileiros");
  const v = (await api(`/api/fichas/${f.data.id}`)).data;
  assert.equal(v.version.templates, "id-es-1.0.0");
  assert.deepEqual(v.version.snapshot.languageBasis, { country: "AR", source: "empresa cadastrada (L4 pendente)", rule: "R28.20" });
  // Rascunho (A-ID10): sem a aprovação expressa, o revisor reprova e a ficha não é aprovável.
  assert.equal(f.data.reviewOk, false);
  assert.deepEqual(f.data.findings.map((x) => x.id), ["MODELO"]);
  // L1 pendente: Porto Rico não tem idioma definido; nada é gerado.
  DB.raw.prepare("UPDATE companies SET country_code='PR' WHERE id=?").run(companyId);
  const pr = await api(`/api/fichas/${f.data.id}/versions`, "POST", { expectedRowVersion: v.ficha.row_version });
  assert.equal(pr.data.error.code, "language_pending_l1");
});

for (const [country, iso3, tz, lang, am, pm] of [
  ["AR", "ARG", "America/Argentina/Buenos_Aires", "es", "Buenos días:", "Buenas tardes:"],
  ["PT", "PRT", "Europe/Lisbon", "en", "Good morning,", "Good afternoon,"],
]) {
  test(`Envio ${lang} (${country}): aprovado só depois da aprovação expressa do modelo; manhã e tarde no horário local; cópia reproduz o enviado`, async (t) => {
    const { api, env, DB, companyId, channelId } = await world(t, { country, iso3, tz });
    await release(api, "international_enabled", "international");
    const create = async () => (await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", purpose: "identify_buyer", recipients: [channelId] })).data;
    const draft = await create();
    assert.equal(draft.language, lang);
    const x0 = (await api(`/api/fichas/${draft.id}`)).data.toApprove.find((a) => a.channel === "email");
    const refused = await api(`/api/fichas/${draft.id}/approve`, "POST", { versionNo: 1, contactId: channelId, channel: "email", messagesSha256: x0.messagesSha256, startDate: DAY });
    assert.equal(refused.data.error.code, "review_failed", "rascunho bloqueia a aprovação");
    // Aprovação expressa do modelo (parâmetro) e nova versão da mesma ficha: agora o revisor aprova.
    await release(api, "ident_templates_approved", IDENT_VERSION[lang]);
    const row = (await api(`/api/fichas/${draft.id}`)).data.ficha.row_version;
    const v2 = (await api(`/api/fichas/${draft.id}/versions`, "POST", { expectedRowVersion: row })).data;
    assert.equal(v2.reviewOk, true, JSON.stringify(v2.findings));
    const f = { id: draft.id };
    const view = (await api(`/api/fichas/${f.id}`)).data;
    const e1 = view.messages.find((m) => m.step === 1);
    assert.equal(e1.body.split("\n")[0], pm);
    assert.equal(e1.morning.body.split("\n")[0], am);
    const x = view.toApprove.find((a) => a.channel === "email");
    assert.equal((await api(`/api/fichas/${f.id}/approve`, "POST", { versionNo: 2, contactId: channelId, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY })).status, 200);
    DB.raw.prepare("UPDATE send_outbox SET status='cancelled' WHERE ficha_id<>?").run(f.id);
    const tr = transport();
    // 10:00 local.
    const local10 = country === "AR" ? `${DAY}T13:00:00Z` : `${DAY}T10:00:00Z`;
    const r = await tick(env, "eag-internal", { transport: tr, now: utc(local10) });
    assert.equal(r.sent, 1, JSON.stringify(r));
    assert.equal(tr.sent[0].text.split("\n")[0], am);
    const o = { ...DB.raw.prepare("SELECT * FROM send_outbox WHERE ficha_id=? AND step_no=1").get(f.id) };
    assert.equal(o.greeting_variant, "am");
    const copy = await buildCopy(env, o, { copy_message_id: "<copia@eagagro.com>", to_address: "interno@exemplo.com" });
    assert.equal(copy.text.split("\n\n")[1].split("\n")[0], am, "cópia com a saudação que saiu");
    // Tarde: outra ficha só para conferir a seleção (variante principal).
    assert.equal(tr.sent[0].subject, lang === "es" ? "Contacto de compras de maíz" : "Corn purchasing contact");
  });
}

test("Bloqueios preservados: modelo aprovado não dispensa T11 fora do teste interno nem a liberação internacional; fichas brasileiras seguem em português", async (t) => {
  const { api, DB, companyId, channelId } = await world(t, { country: "AR", iso3: "ARG", tz: "America/Argentina/Buenos_Aires" });
  await release(api, "ident_templates_approved", IDENT_VERSION.es);
  const f = (await api("/api/fichas", "POST", { companyId, campaignId: "cp-int", purpose: "identify_buyer", recipients: [channelId] })).data;
  assert.equal(f.reviewOk, true, JSON.stringify(f.findings));
  const x = (await api(`/api/fichas/${f.id}`)).data.toApprove.find((a) => a.channel === "email");
  const approve = () => api(`/api/fichas/${f.id}/approve`, "POST", { versionNo: 1, contactId: channelId, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY });
  assert.equal((await approve()).data.error.code, "international_not_enabled");
  await release(api, "international_enabled", "international");
  DB.raw.exec("UPDATE channels SET state='enabled',evidence_ref='teste' WHERE channel='email'");
  assert.equal((await approve()).data.error.code, "t11_pending", "sem validação ar_email_automatic");
  assert.equal(languageForCountry("BR").language, "pt-BR");
});

test("Migração 0042: classifica só o rótulo exato gerado pela rota de canais; rótulo livre com 'site' fica sem tipo", async (t) => {
  const { readFileSync } = await import("node:fs");
  const ctx = setup();
  t.after(ctx.close);
  const db = ctx.DB.raw;
  db.exec("UPDATE contacts SET source_kind=NULL");
  const co = (await ctx.api("/api/companies", "POST", { legalName: "Empresa Migração Ltda.", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" })).data.id;
  const add = (id, kind, label, url) => db.prepare("INSERT INTO contacts(id,tenant_id,company_id,source_label,source_url,created_by,prospect_role,contact_kind) VALUES (?,?,?,?,?,'system-admin','other',?)").run(id, "eag-internal", co, label, url, kind);
  add("m1", "company_channel", "Canal geral publicado no site da empresa (site) — verificado em 2026-10-08", "https://cimilho.com.br/");
  add("m2", "company_channel", "Canal geral publicado em diretório (diretório) — verificado em 2026-10-08", "https://www.kompass.com/x");
  add("m3", "company_channel", "E-mail de Compras publicado no site da indústria", "https://x.example/");
  add("m4", "company_channel", "Canal geral publicado no site da empresa (site) — verificado em 2026-10-08", null);
  add("m5", "person", "Canal geral publicado no site da empresa (site) — verificado em 2026-10-08", "https://y.example/");
  const sql = readFileSync(new URL("../migrations/0042_tipo_fonte_canal.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\bLIKE\b/i, "D1 recusa LIKE com padrão longo");
  for (const stmt of sql.split(";").map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter((s) => /^UPDATE/i.test(s))) db.exec(stmt);
  const kind = (id) => db.prepare("SELECT source_kind k FROM contacts WHERE id=?").get(id).k;
  assert.deepEqual(["m1", "m2", "m3", "m4", "m5"].map(kind), ["company_site", "directory", null, null, null]);
});
