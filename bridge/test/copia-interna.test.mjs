// Cópia interna D5-a (decisão de Rogério, 2026-10-09): a ponte real falando com o Worker real (D1 em memória), SMTP e IMAP
// falsos. Destinatários só internos de teste; o endereço de vendas da EAG nunca aparece aqui.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../../src/worker.js";
import { setup } from "../../tests/helpers/db.mjs";
import { compassClient } from "../src/compass.js";
import { openJournal } from "../src/journal.js";
import { smtpClient } from "../src/mail.js";
import { runCycle, readReplies, recover, recoverCopies, sendCopyOne } from "../src/cycle.js";

const KEY = Buffer.alloc(32, 9).toString("base64");
const INTERNAL = "rogeriopalhari23@gmail.com";
const COPY = "rogeriopalhari23+ponte-copia@gmail.com"; // alias interno de teste (nunca o e-mail de vendas da EAG)
const FORBIDDEN = /vendas@eagagro/i;
const todaySP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function fakeSmtp(behavior = () => ({ kind: "accepted", code: 250, text: "250 OK queued" })) {
  const raws = [];
  return { raws, async send(raw, envelope) { raws.push({ raw: raw.toString(), envelope }); return behavior(raws.length, envelope); } };
}
function fakeImap() {
  const inbox = [], sent = [];
  const box = {
    inbox, sent, uidValidity: 7, sentDown: false,
    async fetchNew(cursor) {
      const top = inbox.length ? inbox[inbox.length - 1].uid : 0;
      if (!cursor.uidValidity) return { uidValidity: box.uidValidity, messages: [], highestUid: top, baseline: true };
      const messages = inbox.filter((m) => m.uid > cursor.lastUid);
      return { uidValidity: box.uidValidity, messages, highestUid: messages.length ? messages[messages.length - 1].uid : cursor.lastUid };
    },
    async appendSent(raw) { sent.push(raw.toString()); },
    async sentHasMessageId(id) {
      if (box.sentDown) throw new Error("enviados indisponíveis");
      return sent.some((r) => r.includes(`Message-ID: ${id}`));
    },
    push(raw) { inbox.push({ uid: inbox.length + 1, date: Date.now(), raw: Buffer.from(raw) }); },
  };
  return box;
}

async function ready(ctx, { copy = COPY } = {}) {
  const { api, env, DB } = ctx;
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP", EAG_POSTAL_ADDRESS_CONFIRMED: "Rua Exemplo, 100 — Sertãozinho/SP",
    PUBLIC_BASE_URL: "https://compass.exemplo", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
    MAILBOX_USER: "rogeriopalhari@eagagro.com", SENDER_NAME: "EAG Agro - Brasil", INTERNAL_TEST_RECIPIENTS: INTERNAL,
    BRIDGE_HMAC_KEY: KEY, SEND_TRANSPORT: "bridge",
  });
  const put = (key, scope, value) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Parâmetro do teste da cópia" });
  await put("send_timezone", "national", "America/Sao_Paulo");
  await put("send_window", "national", { start: "00:00", end: "23:59", weekdays: [1, 2, 3, 4, 5, 6, 7] });
  await put("sanctions_max_age_hours", "global", 24);
  await put("email_validation_max_age_days", "email", 30);
  if (copy) {
    const r = await put("email_copy_to", "email", { enabled: true, address: copy, contractRef: "COF — cópia das comunicações com clientes (teste)" });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  DB.raw.exec("UPDATE channels SET state='internal_test' WHERE channel='email'");
  for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
    const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt: new Date().toISOString() });
    await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Sem Relação Nenhuma" }] });
    await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
  }
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-06", market: "national", name: "Teste da cópia", originCity: "Sertãozinho", originUf: "SP",
    icp: { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
  });
  await api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
  const co = await api("/api/companies", "POST", { legalName: "Doces Vale Verde Ltda.", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES ('u1','eag-internal',?,'11222333000181','05','t','2026-09-23')").run(co.data.id);
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-06", profileClass: "possible_final_consumer", basis: "CNAE" });
  await api(`/api/companies/${co.data.id}/screening`, "POST", {});
  const dm = (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: "Maria Souza", email: INTERNAL, prospectRole: "decision_maker", sourceLabel: "site", timezone: "America/Sao_Paulo" })).data.id;
  DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at=? WHERE id=?").run(new Date(Date.now() - 86400000).toISOString(), dm);
  const { id } = (await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: camp.data.id, recipients: [dm] })).data;
  const f = (await api(`/api/fichas/${id}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  const ok = await api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, startDate: todaySP() });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  DB.raw.exec("DELETE FROM reply_reader_state");
  return { fichaId: id, companyId: co.data.id, dm };
}

function deps(ctx, over = {}) {
  const compass = compassClient({ baseUrl: "http://localhost", hmacKey: KEY, fetchImpl: (url, init) => worker.fetch(new Request(url, init), ctx.env) });
  const journal = openJournal(join(mkdtempSync(join(tmpdir(), "ponte-copia-")), "journal.sqlite"));
  const events = [];
  return { compass, journal, smtp: fakeSmtp(), imap: fakeImap(), log: (e, d) => events.push({ e, ...d }), events, version: "teste", copyAllow: [COPY], ...over };
}
const step1 = (DB) => ({ ...DB.raw.prepare("SELECT id,status,message_id FROM send_outbox WHERE step_no=1").get() });
const copyRow = (DB) => {
  const r = DB.raw.prepare("SELECT * FROM send_copies").get();
  return r ? { ...r } : null;
};
const unfold = (raw) => raw.replace(/\r\n[ \t]+/g, " ");
const headerBlock = (raw) => unfold(raw).split(/\r?\n\r?\n/)[0];
// Corpo em quoted-printable: decodifica para procurar texto e link.
const qp = (raw) => Buffer.from(raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8");
const prospectSends = (smtp) => smtp.raws.filter((r) => r.envelope.to[0] === INTERNAL).length;

test("Cópia: passo aceito gera UMA cópia separada ao endereço fixo, sem descadastro do prospect, com referência ao original", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx);
  const r = await runCycle(d);
  assert.equal(r.sent, true, JSON.stringify(r));
  assert.equal(r.copied, true, JSON.stringify(r));
  assert.equal(d.smtp.raws.length, 2, "prospect e cópia: duas mensagens, dois envelopes");
  const [p, c] = d.smtp.raws;
  assert.deepEqual(p.envelope.to, [INTERNAL]);
  assert.deepEqual(c.envelope.to, [COPY], "cópia só para o endereço fixo");
  assert.ok(!FORBIDDEN.test(c.raw) && !FORBIDDEN.test(JSON.stringify(c.envelope)), "endereço de vendas nunca usado em teste");
  const s1 = step1(ctx.DB);
  const ch = headerBlock(c.raw);
  assert.doesNotMatch(ch, /List-Unsubscribe/i, "cópia sem cabeçalho de descadastro");
  assert.match(ch, new RegExp(`^X-EAG-Copy-Of: ${s1.message_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "mi"), "nome de cabeçalho não diferencia maiúsculas");
  assert.match(c.raw, /Subject: =\?UTF-8\?Q\?=5BC=C3=B3pia=5D/, "assunto com [Cópia]");
  const link = unfold(p.raw).match(/https:\/\/compass\.exemplo\/u\/[^\s>"]+/)[0];
  assert.ok(qp(p.raw).includes(link), "o prospect tem o link no corpo");
  assert.ok(!qp(c.raw).includes(link) && !unfold(c.raw).includes(link), "link de descadastro do prospect fora da cópia");
  assert.ok(qp(c.raw).includes("[link de descadastro do destinatário omitido na cópia]"), "aviso no lugar do link");
  assert.ok(qp(c.raw).includes("Cópia interna (contrato de franquia)"), "cópia identificada");
  const row = copyRow(ctx.DB);
  assert.equal(row.status, "accepted");
  assert.match(ch, new RegExp(`^Message-ID: ${row.copy_message_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  assert.equal(d.imap.sent.length, 2, "prospect e cópia nos enviados");
  // Ciclos seguintes: nenhuma cópia nova, nenhum reenvio do prospect.
  await runCycle(d);
  await runCycle(d);
  assert.equal(prospectSends(d.smtp), 1);
  assert.equal(d.smtp.raws.filter((x) => x.envelope.to[0] === COPY).length, 1);
  // Ficha mostra a cópia configurada e o estado da cópia do passo.
  const f = (await ctx.api(`/api/fichas/${ctx.DB.raw.prepare("SELECT ficha_id FROM send_outbox WHERE step_no=1").get().ficha_id}`)).data;
  assert.deepEqual({ enabled: f.internalCopy.enabled, address: f.internalCopy.address }, { enabled: true, address: COPY });
  assert.equal(f.outbox.find((o) => o.step_no === 1).copy.status, "accepted");
});

test("Cópia: falha fechada — cópia ligada e endereço fora da lista local da ponte: nada é reservado nem enviado", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  for (const copyAllow of [[], ["outro-interno@exemplo.test"]]) {
    const d = deps(ctx, { copyAllow });
    const r = await runCycle(d);
    assert.equal(r.reason, "copy_target_not_allowed", JSON.stringify(r));
    assert.equal(d.smtp.raws.length, 0);
    assert.equal(step1(ctx.DB).status, "pending");
  }
  // Ponte antiga (sem a lista no pedido) também não recebe passo.
  const old = deps(ctx);
  assert.equal(await readReplies(old), true);
  assert.equal((await old.compass.call("/api/bridge/claim")).reason, "copy_target_not_allowed");
});

test("Cópia: sem configuração, nenhuma cópia é criada e o envio segue como antes", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx, { copy: null });
  const d = deps(ctx, { copyAllow: [] });
  const r = await runCycle(d);
  assert.equal(r.sent, true);
  assert.equal(d.smtp.raws.length, 1);
  assert.equal(copyRow(ctx.DB), null);
});

test("Cópia: endereço trocado no Compass depois do aceite — a cópia pendente não sai para o endereço novo", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx, { smtp: fakeSmtp((n, env) => (env.to[0] === COPY ? { kind: "temporary", code: 451, text: "451 tente depois" } : { kind: "accepted", code: 250, text: "250 OK" })) });
  await runCycle(d);
  assert.equal(copyRow(ctx.DB).status, "temp_failed");
  const other = "rogeriopalhari23+ponte-copia2@gmail.com";
  await ctx.api("/api/parameters/email_copy_to", "PUT", { scope: "email", value: { enabled: true, address: other, contractRef: "COF — cópia (teste, troca)" }, reason: "troca no teste" });
  ctx.DB.raw.exec("UPDATE send_copies SET next_attempt_at=NULL");
  const r = await sendCopyOne(deps(ctx, { copyAllow: [COPY, other] }));
  assert.equal(r.reason, "copy_address_changed");
  assert.equal(copyRow(ctx.DB).to_address, COPY, "a cópia guarda o endereço vigente no aceite");
});

test("Cópia: SMTP temporário tenta de novo depois; permanente encerra sem tocar o prospect", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  let copyCalls = 0;
  const d = deps(ctx, { smtp: fakeSmtp((n, env) => (env.to[0] === COPY ? (++copyCalls === 1 ? { kind: "temporary", code: 451, text: "451" } : { kind: "accepted", code: 250, text: "250" }) : { kind: "accepted", code: 250, text: "250" })) });
  await runCycle(d);
  assert.equal(copyRow(ctx.DB).status, "temp_failed");
  assert.equal((await sendCopyOne(d)).reason, "nothing_due", "espera a próxima tentativa");
  ctx.DB.raw.exec("UPDATE send_copies SET next_attempt_at=NULL");
  assert.equal((await sendCopyOne(d)).copied, true);
  assert.equal(copyRow(ctx.DB).status, "accepted");
  assert.equal(prospectSends(d.smtp), 1, "prospect enviado uma vez");

  const ctx2 = setup();
  t.after(ctx2.close);
  await ready(ctx2);
  const d2 = deps(ctx2, { smtp: fakeSmtp((n, env) => (env.to[0] === COPY ? { kind: "permanent", code: 550, text: "550 caixa inexistente" } : { kind: "accepted", code: 250, text: "250" })) });
  await runCycle(d2);
  await runCycle(d2);
  assert.equal(copyRow(ctx2.DB).status, "permanent_failed");
  assert.equal(step1(ctx2.DB).status, "accepted", "prospect continua aceito");
  assert.equal(prospectSends(d2.smtp), 1);
  // Falha da cópia não suprime o destinatário da cópia nem o prospect.
  assert.equal(ctx2.DB.raw.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n, 0);
});

test("Cópia: aceitação parcial ou resultado incerto do SMTP — indeterminado, sem reenvio automático da cópia nem do prospect", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx, { smtp: fakeSmtp((n, env) => (env.to[0] === COPY ? { kind: "indeterminate", code: null, text: "aceitação parcial do envelope" } : { kind: "accepted", code: 250, text: "250" })) });
  await runCycle(d);
  assert.equal(copyRow(ctx.DB).status, "indeterminate");
  await runCycle(d);
  await runCycle(d);
  assert.equal(d.smtp.raws.filter((x) => x.envelope.to[0] === COPY).length, 1, "cópia incerta nunca reenviada sozinha");
  assert.equal(prospectSends(d.smtp), 1);
  assert.equal(step1(ctx.DB).status, "accepted");
});

test("Transporte: aceitação parcial do envelope vira indeterminado; recusa total vira permanente", async () => {
  class Conn {
    constructor() { this.handlers = {}; }
    on() {}
    connect(cb) { cb(); }
    login(o, cb) { cb(); }
    send(env, raw, cb) { cb(null, Conn.info); }
    quit() {}
    close() {}
  }
  const smtp = smtpClient({ host: "h", port: 465, user: "u", pass: "p", Connection: Conn });
  Conn.info = { accepted: ["a@x.test"], rejected: ["b@x.test"], response: "250 OK" };
  assert.equal((await smtp.send(Buffer.from("x"), { from: "f@x.test", to: ["a@x.test", "b@x.test"] })).kind, "indeterminate");
  Conn.info = { accepted: [], rejected: ["b@x.test"], response: "550" };
  assert.equal((await smtp.send(Buffer.from("x"), { from: "f@x.test", to: ["b@x.test"] })).kind, "permanent");
  Conn.info = { accepted: ["a@x.test"], rejected: [], response: "250 OK" };
  assert.equal((await smtp.send(Buffer.from("x"), { from: "f@x.test", to: ["a@x.test"] })).kind, "accepted");
});

test("Prospect com resultado incerto ou aceitação parcial: nenhuma cópia é criada e nada é reenviado", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx, { smtp: fakeSmtp(() => ({ kind: "indeterminate", code: null, text: "aceitação parcial do envelope" })) });
  await runCycle(d);
  await runCycle(d);
  assert.equal(step1(ctx.DB).status, "indeterminate");
  assert.equal(copyRow(ctx.DB), null, "cópia só de passo aceito");
  assert.equal(d.smtp.raws.length, 1);
});

test("Cópia: queda depois do SMTP aceitar e antes de avisar — ao voltar informa aceita, sem reenviar", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx);
  const real = d.compass;
  let dropped = false;
  const flaky = { call: (p, b) => (p === "/api/bridge/copy-result" && !dropped ? ((dropped = true), Promise.reject(Object.assign(new Error("rede caiu"), { code: "ECONNRESET" }))) : real.call(p, b)) };
  const r = await runCycle({ ...d, compass: flaky });
  assert.equal(r.copyReason, "copy_error");
  assert.equal(copyRow(ctx.DB).status, "leased");
  await runCycle(d);
  assert.equal(copyRow(ctx.DB).status, "accepted");
  assert.equal(d.smtp.raws.filter((x) => x.envelope.to[0] === COPY).length, 1, "uma única cópia");
  assert.ok(d.events.some((e) => e.e === "copy_recovered" && e.outcome === "accepted"));
});

test("Cópia: queda durante o SMTP — achada nos enviados fecha aceita; não achada ou enviados fora do ar fica indeterminada, sem reenvio", async (t) => {
  for (const scenario of ["found", "not_found", "sent_down"]) {
    const ctx = setup();
    t.after(ctx.close);
    await ready(ctx);
    const imap = fakeImap();
    const crashing = fakeSmtp((n, env) => {
      if (env.to[0] !== COPY) return { kind: "accepted", code: 250, text: "250" };
      throw new Error("processo interrompido no meio do DATA da cópia");
    });
    const d = deps(ctx, { smtp: crashing, imap });
    const r = await runCycle(d);
    assert.equal(r.copyReason, "copy_error");
    const id = copyRow(ctx.DB).copy_message_id;
    if (scenario === "found") imap.sent.push(`Message-ID: ${id}\r\n\r\ncópia`);
    if (scenario === "sent_down") imap.sentDown = true;
    const d2 = { ...d, smtp: fakeSmtp() };
    await recoverCopies(d2);
    assert.equal(copyRow(ctx.DB).status, scenario === "found" ? "accepted" : "indeterminate", scenario);
    await runCycle(d2);
    await runCycle(d2);
    assert.equal(d2.smtp.raws.filter((x) => x.envelope.to[0] === COPY).length, 0, `${scenario}: nenhum reenvio automático da cópia`);
    assert.equal(prospectSends(d.smtp) + prospectSends(d2.smtp), 1, `${scenario}: prospect enviado uma vez`);
  }
});

test("Cópia: queda antes do SMTP da cópia — volta como temporária e sai uma vez depois", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  // Primeiro ciclo: prospect aceito; a cópia volta temporária (não saiu).
  let copyAccepts = false;
  const d = deps(ctx, { smtp: fakeSmtp((n, env) => (env.to[0] === COPY && !copyAccepts ? { kind: "temporary", code: 451, text: "451" } : { kind: "accepted", code: 250, text: "250" })) });
  await runCycle(d);
  assert.equal(copyRow(ctx.DB).status, "temp_failed");
  copyAccepts = true;
  ctx.DB.raw.exec("UPDATE send_copies SET next_attempt_at=NULL");
  const claim = await d.compass.call("/api/bridge/copy-claim", { copyAllow: [COPY] });
  d.journal.copy.claimed(claim.copy); // reservou e caiu antes do SMTP
  await recoverCopies(d);
  assert.equal(copyRow(ctx.DB).status, "temp_failed", "certamente não saiu: volta à fila");
  ctx.DB.raw.exec("UPDATE send_copies SET next_attempt_at=NULL");
  const before = d.smtp.raws.filter((x) => x.envelope.to[0] === COPY).length;
  assert.equal((await sendCopyOne(d)).copied, true);
  assert.equal((await sendCopyOne(d)).reason, "nothing_due");
  assert.equal(copyRow(ctx.DB).status, "accepted");
  assert.equal(d.smtp.raws.filter((x) => x.envelope.to[0] === COPY).length, before + 1, "uma cópia aceita");
  assert.equal(prospectSends(d.smtp), 1);
});

test("Cópia: lease vencido sem notícia da ponte vira indeterminado e não volta à fila", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx, { smtp: fakeSmtp((n, env) => (env.to[0] === COPY ? { kind: "temporary", code: 451, text: "451" } : { kind: "accepted", code: 250, text: "250" })) });
  await runCycle(d);
  ctx.DB.raw.exec("UPDATE send_copies SET next_attempt_at=NULL");
  const claim = await d.compass.call("/api/bridge/copy-claim", { copyAllow: [COPY] });
  assert.ok(claim.copy);
  ctx.DB.raw.exec("UPDATE send_copies SET lease_until='2000-01-01T00:00:00Z'");
  assert.equal((await d.compass.call("/api/bridge/copy-claim", { copyAllow: [COPY] })).reason, "nothing_due");
  assert.equal(copyRow(ctx.DB).status, "indeterminate");
  // Com prova (Message-ID nos enviados), o mesmo lease fecha como aceito.
  const r = await d.compass.call("/api/bridge/copy-result", { outboxId: claim.copy.outboxId, leaseToken: claim.copy.leaseToken, outcome: "accepted", evidence: "achada nos enviados" });
  assert.equal(r.recovered, true);
  assert.equal(copyRow(ctx.DB).status, "accepted");
});

test("Cópia: mensagens do endereço da cópia são internas — 'sair' não suprime, nada abre tarefa; devolução da cópia não suprime", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx);
  await runCycle(d);
  const copyId = copyRow(ctx.DB).copy_message_id;
  d.imap.push(`From: Vendas <${COPY}>\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: Re: [Cópia] Fornecedor\r\nMessage-ID: <i1-${randomUUID()}@gmail.com>\r\nIn-Reply-To: ${copyId}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nsair\r\n`);
  d.imap.push(
    `From: MAILER-DAEMON@mx.exemplo\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: Undelivered\r\nMessage-ID: <b1-${randomUUID()}@mx>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/report; report-type=delivery-status; boundary="B"\r\n\r\n--B\r\nContent-Type: text/plain\r\n\r\nfalhou\r\n--B\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; mx.exemplo\r\n\r\nFinal-Recipient: rfc822; ${COPY}\r\nAction: failed\r\nStatus: 5.1.1\r\n--B--\r\n`,
  );
  const before = ctx.DB.raw.prepare("SELECT COUNT(*) n FROM tasks").get().n;
  assert.equal(await readReplies(d), true, JSON.stringify(d.events.filter((e) => e.e === "read_failed")));
  const rows = ctx.DB.raw.prepare("SELECT classification,correlation FROM inbound_messages ORDER BY imap_uid").all().map((r) => `${r.classification}/${r.correlation}`);
  assert.deepEqual(rows, ["unclassified/none", "bounce_hard/none"], "interna: sem classificação de prospect e sem correlação");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n, 0, "nada suprimido");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM tasks").get().n, before, "nenhuma tarefa nova");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM send_outbox WHERE status='cancelled'").get().n, 0, "sequência do prospect intacta");
});

test("Cópia: parâmetro só do Administrador, com motivo, endereço válido e referência do contrato", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api, env, DB } = ctx;
  const put = (value, reason = "Cópia interna D5-a") => api("/api/parameters/email_copy_to", "PUT", { scope: "email", value, reason });
  assert.equal((await put({ enabled: true, address: "não-é-email", contractRef: "COF cópia clientes" })).status, 422);
  assert.equal((await put({ enabled: true, address: COPY })).data.error.code, "evidence_required");
  assert.equal((await put({ enabled: true, address: COPY, contractRef: "COF — cópia das comunicações" }, "x")).status, 422, "motivo obrigatório");
  assert.equal((await put({ enabled: true, address: COPY, contractRef: "COF — cópia das comunicações" })).status, 200);
  DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('manager','eag-internal','gestor@example.test','Gestor','commercial_manager')");
  env.LOCAL_USER_EMAIL = "gestor@example.test";
  assert.equal((await put({ enabled: false })).status, 403, "gestor não altera a cópia");
});

// Horário do aceite SMTP (0043, ponte 0.2.1): o aceite do servidor e o registro do aceite no Compass são instantes
// distintos; a cópia diz os dois, e nunca apresenta o registro como horário do envio.
const outbox1 = (DB) => ({ ...DB.raw.prepare("SELECT * FROM send_outbox WHERE step_no=1").get() });
const intro = (raw) => qp(raw).split(/\r?\n\r?\n/).find((p) => p.includes("Cópia interna (contrato de franquia)"));
const hms = (iso) => iso.slice(0, 19).replace("T", " ");

test("Horário: aceite normal grava o instante do SMTP informado pela ponte; a cópia mostra aceite e registro, com o texto que saiu", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx);
  assert.equal((await runCycle(d)).sent, true);
  const o = outbox1(ctx.DB);
  assert.ok(o.smtp_accepted_at, "aceite SMTP gravado");
  assert.ok(o.smtp_accepted_at <= o.accepted_at, "aceite SMTP não depois do registro");
  const [p, c] = d.smtp.raws;
  const text = intro(c.raw);
  assert.ok(text.includes(`aceito pelo servidor de envio em ${hms(o.smtp_accepted_at)} UTC`), text);
  assert.ok(text.includes(`aceite registrado no Compass em ${hms(o.accepted_at)} UTC`), text);
  // Corpo da cópia = texto que saiu ao destinatário (saudação incluída).
  const firstLine = qp(p.raw).split(/\r?\n\r?\n/).find((x) => /^(Olá|Bom dia|Boa tarde|Buenos|Buenas|Good|Hi)/.test(x.trim()));
  assert.ok(firstLine && qp(c.raw).includes(firstLine.trim().split(/\r?\n/)[0]), "saudação enviada reproduzida na cópia");
});

test("Horário: queda depois do SMTP e antes de avisar — a recuperação informa o instante original do SMTP, sem reenviar", async (t) => {
  const t0 = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now: t0 });
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx);
  const real = d.compass;
  let dropped = false;
  const flaky = { call: (p, b) => (p === "/api/bridge/result" && !dropped ? ((dropped = true), Promise.reject(Object.assign(new Error("rede caiu"), { code: "ECONNRESET" }))) : real.call(p, b)) };
  await runCycle({ ...d, compass: flaky }).catch(() => {});
  const smtpAt = new Date(Date.now()).toISOString();
  assert.equal(outbox1(ctx.DB).status, "leased", "Compass ainda não sabe do aceite");
  t.mock.timers.setTime(t0 + 95_000); // a ponte volta 95 s depois
  await runCycle(d);
  const o = outbox1(ctx.DB);
  assert.equal(o.status, "accepted");
  assert.equal(prospectSends(d.smtp), 1, "nenhum reenvio ao prospect");
  assert.ok(Date.parse(o.accepted_at) - Date.parse(o.smtp_accepted_at) >= 90_000, `registro (${o.accepted_at}) depois do aceite SMTP (${o.smtp_accepted_at})`);
  assert.ok(Math.abs(Date.parse(o.smtp_accepted_at) - Date.parse(smtpAt)) < 2000, "instante original do SMTP, não o da recuperação");
  const c = d.smtp.raws.find((x) => x.envelope.to[0] === COPY);
  assert.ok(c, "cópia sai depois do aceite registrado");
  assert.ok(intro(c.raw).includes(`aceito pelo servidor de envio em ${hms(o.smtp_accepted_at)} UTC (aceite registrado no Compass em ${hms(o.accepted_at)} UTC)`));
  assert.equal(d.smtp.raws.filter((x) => x.envelope.to[0] === COPY).length, 1, "uma única cópia");
});

test("Horário: ponte antiga (sem smtpAt) ou aceite só comprovado nos enviados — sem horário SMTP, a cópia diz só o registro", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx);
  const real = d.compass;
  const old = { call: (p, b) => real.call(p, p === "/api/bridge/result" ? { ...b, smtpAt: undefined } : b) };
  await runCycle({ ...d, compass: old });
  const o = outbox1(ctx.DB);
  assert.equal(o.status, "accepted");
  assert.equal(o.smtp_accepted_at, null);
  const c = d.smtp.raws.find((x) => x.envelope.to[0] === COPY);
  const text = intro(c.raw);
  assert.ok(text.includes(`com aceite registrado no Compass em ${hms(o.accepted_at)} UTC (horário do aceite pelo servidor de envio não informado pela ponte)`), text);
  assert.doesNotMatch(text, /enviado em/);
});

test("Horário: queda durante o SMTP, mensagem achada nos enviados — aceite fechado sem horário SMTP inventado", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  // SMTP cai no meio: a mensagem pode ter saído, mas a ponte não recebeu resposta (diário fica em smtp_started).
  const raws = [];
  const dying = { raws, async send(raw) { raws.push(raw.toString()); throw Object.assign(new Error("conexão caiu durante o SMTP"), { code: "ECONNRESET" }); } };
  const d = deps(ctx, { smtp: dying });
  await runCycle(d).catch(() => {});
  assert.equal(outbox1(ctx.DB).status, "leased");
  // A caixa guardou a mensagem nos enviados: a recuperação fecha como aceita, sem horário SMTP (não foi observado).
  d.imap.sent.push(raws[0]);
  await recover(d);
  const o = outbox1(ctx.DB);
  assert.equal(o.status, "accepted");
  assert.equal(o.smtp_accepted_at, null, "horário do SMTP desconhecido não é inventado");
  assert.equal(raws.length, 1, "nenhum reenvio");
});

test("Horário: smtpAt no futuro ou inválido é ignorado; diário antigo ganha a coluna sem perder registros", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = deps(ctx);
  const real = d.compass;
  const future = { call: (p, b) => real.call(p, p === "/api/bridge/result" && b.outcome === "accepted" ? { ...b, smtpAt: new Date(Date.now() + 3600_000).toISOString() } : b) };
  await runCycle({ ...d, compass: future });
  assert.equal(outbox1(ctx.DB).status, "accepted");
  assert.equal(outbox1(ctx.DB).smtp_accepted_at, null, "horário no futuro não é aceito");
  // Diário da versão 0.2.0 (sem smtp_at): abre, ganha a coluna e mantém a linha.
  const { DatabaseSync } = await import("node:sqlite");
  const path = join(mkdtempSync(join(tmpdir(), "ponte-diario-antigo-")), "journal.sqlite");
  const old = new DatabaseSync(path);
  old.exec("CREATE TABLE sends (outbox_id TEXT NOT NULL, lease_token INTEGER NOT NULL, message_id TEXT NOT NULL, sha256 TEXT NOT NULL, state TEXT NOT NULL, outcome TEXT, smtp_code INTEGER, smtp_text TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (outbox_id, lease_token)); INSERT INTO sends VALUES ('o1',1,'<m@x>','h','reported','accepted',250,'OK','2026-10-14T21:13:19Z');");
  old.close();
  const j = openJournal(path);
  assert.equal(j.alreadyAccepted("o1"), true, "registro antigo preservado");
  assert.equal(j.acceptedAt("o1"), null, "sem horário SMTP no diário antigo");
  j.close();
});
