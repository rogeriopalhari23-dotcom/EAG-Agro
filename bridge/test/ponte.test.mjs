// Ponte de ponta a ponta: o processo da ponte (bridge/src) falando com o Worker real (src/worker.js, D1 em memória),
// com SMTP e IMAP falsos no lugar da caixa da Hostinger. Cobre os casos do teste interno da proposta.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../../src/worker.js";
import { setup } from "../../tests/helpers/db.mjs";
import { compassClient, signature } from "../src/compass.js";
import { openJournal } from "../src/journal.js";
import { runCycle, readReplies, recover } from "../src/cycle.js";

const KEY = Buffer.alloc(32, 9).toString("base64");
const INTERNAL = "rogeriopalhari23@gmail.com";
const todaySP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function fakeSmtp(behavior = () => ({ kind: "accepted", code: 250, text: "250 OK queued" })) {
  const raws = [];
  return { raws, async send(raw, envelope) { raws.push({ raw: raw.toString(), envelope }); return behavior(raws.length); } };
}
// Caixa falsa com a mesma regra da real (bridge/src/mail.js): primeira leitura só marca a posição; numeração nova lê
// só as mensagens dos 2 dias anteriores à última leitura.
function fakeImap() {
  const inbox = [], sent = [];
  const box = {
    inbox, sent, down: false, uidValidity: 7,
    async fetchNew(cursor) {
      if (box.down) throw Object.assign(new Error("imap indisponível"), { code: "ECONNREFUSED" });
      const top = inbox.length ? inbox[inbox.length - 1].uid : 0;
      if (!cursor.uidValidity) return { uidValidity: box.uidValidity, messages: [], highestUid: top, baseline: true };
      if (cursor.uidValidity !== box.uidValidity) {
        const since = Date.parse(cursor.updatedAt) - 2 * 86400000;
        return { uidValidity: box.uidValidity, messages: inbox.filter((m) => m.date >= since), highestUid: top, baseline: true };
      }
      const messages = inbox.filter((m) => m.uid > cursor.lastUid);
      return { uidValidity: box.uidValidity, messages, highestUid: messages.length ? messages[messages.length - 1].uid : cursor.lastUid };
    },
    async appendSent(raw) { sent.push(raw.toString()); },
    async sentHasMessageId(id) { return sent.some((r) => r.includes(`Message-ID: ${id}`)); },
    reply(body, inReplyTo, subject = "Re: Fornecedor açúcar", date = Date.now()) {
      const uid = inbox.length + 1;
      inbox.push({ uid, date, raw: Buffer.from(`From: Rogerio <${INTERNAL}>\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: ${subject}\r\nMessage-ID: <r${uid}-${randomUUID()}@gmail.com>\r\n${inReplyTo ? `In-Reply-To: ${inReplyTo}\r\n` : ""}Content-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`) });
    },
  };
  return box;
}

async function ready(ctx, { email = INTERNAL } = {}) {
  const { api, env, DB } = ctx;
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP", EAG_POSTAL_ADDRESS_CONFIRMED: "Rua Exemplo, 100 — Sertãozinho/SP",
    PUBLIC_BASE_URL: "https://compass.exemplo", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
    MAILBOX_USER: "rogeriopalhari@eagagro.com", SENDER_NAME: "EAG Agro - Brasil", INTERNAL_TEST_RECIPIENTS: INTERNAL,
    BRIDGE_HMAC_KEY: KEY, SEND_TRANSPORT: "bridge",
  });
  const put = (key, scope, value) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Parâmetro do teste da ponte" });
  await put("send_timezone", "national", "America/Sao_Paulo");
  // Janela o dia todo, todos os dias (1 = segunda … 7 = domingo): o teste não depende da hora em que roda.
  const w = await put("send_window", "national", { start: "00:00", end: "23:59", weekdays: [1, 2, 3, 4, 5, 6, 7] });
  assert.equal(w.status, 200, JSON.stringify(w.data));
  await put("sanctions_max_age_hours", "global", 24);
  await put("email_validation_max_age_days", "email", 30); // decisão de 2026-10-01
  DB.raw.exec("UPDATE channels SET state='internal_test' WHERE channel='email'");
  for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
    const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt: new Date().toISOString() });
    await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Sem Relação Nenhuma" }] });
    await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
  }
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-06", market: "national", name: "Teste interno da ponte", originCity: "Sertãozinho", originUf: "SP",
    icp: { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
  });
  await api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
  const co = await api("/api/companies", "POST", { legalName: "Doces Vale Verde Ltda.", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES ('u1','eag-internal',?,'11222333000181','05','t','2026-09-23')").run(co.data.id);
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-06", profileClass: "possible_final_consumer", basis: "CNAE" });
  await api(`/api/companies/${co.data.id}/screening`, "POST", {});
  const dm = (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: "Maria Souza", email, prospectRole: "decision_maker", sourceLabel: "site", timezone: "America/Sao_Paulo" })).data.id;
  DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at=? WHERE id=?").run(new Date(Date.now() - 86400000).toISOString(), dm);
  const { id } = (await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: camp.data.id, recipients: [dm] })).data;
  const f = (await api(`/api/fichas/${id}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  const ok = await api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, startDate: todaySP() });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  DB.raw.exec("DELETE FROM reply_reader_state"); // portão real: só a leitura da ponte libera o envio
  return { fichaId: id, companyId: co.data.id, dm, f };
}

function bridgeDeps(ctx, over = {}) {
  const compass = compassClient({ baseUrl: "http://localhost", hmacKey: KEY, fetchImpl: (url, init) => worker.fetch(new Request(url, init), ctx.env) });
  const journal = openJournal(join(mkdtempSync(join(tmpdir(), "ponte-")), "journal.sqlite"));
  const events = [];
  return { compass, journal, smtp: fakeSmtp(), imap: fakeImap(), log: (e, d) => events.push({ e, ...d }), events, version: "teste", ...over };
}
const outbox = (DB) => DB.raw.prepare("SELECT step_no,status,block_reason,message_id FROM send_outbox ORDER BY step_no").all().map((r) => ({ ...r }));

test("Ponte: sem leitura de respostas bem-sucedida, nada sai (portão no Compass)", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = bridgeDeps(ctx);
  d.imap.down = true;
  const r = await runCycle(d);
  assert.equal(r.readOk, false);
  assert.equal(d.smtp.raws.length, 0);
  // Mesmo uma ponte com defeito que pule a leitura não recebe mensagem.
  assert.equal((await d.compass.call("/api/bridge/claim")).reason, "reply_reader_unavailable");
  assert.match(ctx.DB.raw.prepare("SELECT last_error FROM reply_reader_state").get().last_error, /ECONNREFUSED/);
});

test("Ponte: envia o aprovado uma vez, com remetente, assinatura, descadastro e cópia nos enviados; o intervalo segura o próximo", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const r0 = await ready(ctx);
  const d = bridgeDeps(ctx);
  const r = await runCycle(d);
  assert.equal(r.sent, true, JSON.stringify(r));
  assert.equal(d.smtp.raws.length, 1);
  const { raw: folded, envelope } = d.smtp.raws[0];
  const raw = folded.replace(/\r\n[ \t]+/g, " "); // cabeçalhos longos vêm dobrados (RFC 5322)
  assert.deepEqual(envelope, { from: "rogeriopalhari@eagagro.com", to: [INTERNAL] });
  assert.match(raw, /^From: "EAG Agro - Brasil" <rogeriopalhari@eagagro\.com>$/m);
  assert.match(raw, /^Reply-To: rogeriopalhari@eagagro\.com$/m);
  assert.match(raw, /^List-Unsubscribe: <https:\/\/compass\.exemplo\/u\/.+>$/m);
  assert.match(raw, /^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m);
  assert.match(raw, /multipart\/alternative/);
  assert.ok(raw.includes("assinatura-teste"), "HTML congelado com a assinatura");
  const [s1] = outbox(ctx.DB);
  assert.equal(s1.status, "accepted");
  assert.ok(raw.includes(`Message-ID: ${s1.message_id}`));
  assert.equal(d.imap.sent.length, 1, "cópia na pasta de enviados");
  assert.equal(d.imap.sent[0], folded, "mesmos bytes no SMTP e nos enviados");
  const approved = r0.f.messages.find((m) => m.step === 1 && m.channel === "email");
  assert.equal(ctx.DB.raw.prepare("SELECT message_sha256 FROM send_outbox WHERE step_no=1").get().message_sha256, approved.sha256);
  assert.equal((await runCycle(d)).reason, "interval", "um envio por vez, com o intervalo do Compass");
  assert.equal(d.smtp.raws.length, 1);
});

test("Ponte: resposta lida na caixa pausa empresa + commodity e abre tarefa; „abmelden“ suprime", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = bridgeDeps(ctx);
  await runCycle(d);
  const [s1] = outbox(ctx.DB);
  d.imap.reply("Olá, pode me ligar amanhã?", s1.message_id);
  const r = await runCycle(d);
  assert.equal(r.readOk, true);
  const rows = outbox(ctx.DB);
  assert.ok(rows.filter((x) => x.step_no > 1).every((x) => x.status === "cancelled" && /^reply_/.test(x.block_reason)), JSON.stringify(rows));
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM tasks WHERE kind='reply_followup'").get().n, 1);
  assert.equal(ctx.DB.raw.prepare("SELECT classification FROM inbound_messages").get().classification, "human");
  // Repetir a leitura não duplica efeito (mesmo UID).
  await d.compass.call("/api/bridge/inbound", { mailbox: "INBOX", uidValidity: 7, uid: 1, raw: d.imap.inbox[0].raw.toString("base64") });
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM inbound_messages").get().n, 1);
  d.imap.reply("abmelden", null, "Zuständige Person für den Rohkaffee-Einkauf");
  await runCycle(d);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM suppression_entries WHERE reason='opt_out'").get().n, 1);
});

test("Ponte: primeira leitura não leva o histórico da caixa ao Compass; caixa renumerada relê só os 2 últimos dias", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = bridgeDeps(ctx);
  const old = Date.now() - 30 * 86400000;
  for (let i = 0; i < 5; i++) d.imap.reply(`mensagem antiga ${i}`, null, "Assunto antigo", old);
  assert.equal(await readReplies(d), true);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM inbound_messages").get().n, 0, "histórico não registrado");
  assert.deepEqual({ ...ctx.DB.raw.prepare("SELECT uidvalidity,last_uid FROM inbound_cursor").get() }, { uidvalidity: 7, last_uid: 5 });
  d.imap.reply("nova, depois da primeira leitura", null, "Pergunta");
  assert.equal(await readReplies(d), true);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM inbound_messages").get().n, 1);
  // Caixa renumerada: só as recentes voltam (a nova já registrada não duplica); as antigas não entram.
  d.imap.uidValidity = 8;
  assert.equal(await readReplies(d), true);
  // A recente volta sob a nova numeração, mas o mesmo Message-ID já processado não gera linha nem efeito (2026-10-01).
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM inbound_messages").get().n, 1, "a recente relida não duplica");
  assert.deepEqual({ ...ctx.DB.raw.prepare("SELECT uidvalidity,last_uid FROM inbound_cursor").get() }, { uidvalidity: 8, last_uid: 6 });
  assert.equal((await d.compass.call("/api/bridge/rebase", { uidValidity: 8, highestUid: 99 }).catch((e) => e)).status, 409, "rebase sem renumeração é recusado");
  assert.equal((await d.compass.call("/api/bridge/inbound", { mailbox: "INBOX", uidValidity: 9, uid: 1, raw: "eA==" }).catch((e) => e)).status, 409, "numeração desconhecida exige rebase");
});

test("Ponte: queda depois de o SMTP aceitar e antes de avisar o Compass — ao voltar informa aceito, sem reenviar", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = bridgeDeps(ctx);
  const real = d.compass;
  let dropped = false;
  const flaky = { call: (p, b) => (p === "/api/bridge/result" && !dropped ? ((dropped = true), Promise.reject(Object.assign(new Error("rede caiu"), { code: "ECONNRESET" }))) : real.call(p, b)) };
  await assert.rejects(runCycle({ ...d, compass: flaky }));
  assert.equal(outbox(ctx.DB)[0].status, "leased");
  const r = await runCycle(d);
  assert.equal(outbox(ctx.DB)[0].status, "accepted");
  assert.equal(d.smtp.raws.length, 1, "um único e-mail");
  assert.ok(d.events.some((e) => e.e === "recovered" && e.outcome === "accepted"));
  assert.equal(r.sent, false);
});

test("Ponte: queda durante o envio sem prova — indeterminado para Rogério, nunca reenviado", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const crashing = fakeSmtp(() => {
    throw new Error("processo interrompido no meio do DATA");
  });
  const d = bridgeDeps(ctx, { smtp: crashing });
  await assert.rejects(runCycle(d));
  const d2 = { ...d, smtp: fakeSmtp() };
  await recover(d2);
  assert.equal(outbox(ctx.DB)[0].status, "indeterminate");
  await runCycle(d2);
  await runCycle(d2);
  assert.equal(d2.smtp.raws.length, 0, "nenhum reenvio automático");
  assert.equal(outbox(ctx.DB)[0].status, "indeterminate");
});

test("Ponte: queda antes do SMTP — o passo volta à fila como temporário", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = bridgeDeps(ctx);
  assert.equal(await readReplies(d), true);
  const claim = await d.compass.call("/api/bridge/claim");
  d.journal.claimed(claim.message); // reservou e caiu antes de chamar o SMTP
  await recover(d);
  const [s1] = outbox(ctx.DB);
  assert.equal(s1.status, "temp_failed");
  assert.equal(d.smtp.raws.length, 0);
});

test("Ponte: SMTP recusa o destinatário (550) — supressão por bounce, sem outro envio para ele", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = bridgeDeps(ctx, { smtp: fakeSmtp(() => ({ kind: "permanent", code: 550, text: "550 mailbox unavailable" })) });
  await runCycle(d);
  assert.deepEqual(outbox(ctx.DB).map((x) => x.status), ["perm_failed", "cancelled", "cancelled", "cancelled"].slice(0, outbox(ctx.DB).length));
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM suppression_entries WHERE reason='hard_bounce'").get().n, 1);
});

test("Ponte: canal em teste interno recusa destinatário externo", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx, { email: "compras@valeverde.com.br" });
  const d = bridgeDeps(ctx);
  const r = await runCycle(d);
  assert.equal(r.sent, false);
  assert.equal(d.smtp.raws.length, 0);
  assert.equal(outbox(ctx.DB)[0].block_reason, "channel_internal_test_only");
});

test("Ponte: assinatura, repetição e configuração ausente são recusadas", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const send = (headers, body = "{}") => worker.fetch(new Request("http://localhost/api/bridge/cursor", { method: "POST", headers: { "content-type": "application/json", ...headers }, body }), ctx.env);
  const ts = String(Date.now()), nonce = randomUUID();
  const good = { "x-bridge-timestamp": ts, "x-bridge-nonce": nonce, "x-bridge-signature": signature(KEY, "POST", "/api/bridge/cursor", ts, nonce, "{}") };
  assert.equal((await send(good)).status, 200);
  assert.equal((await send(good)).status, 409, "mesmo nonce: repetição");
  const n2 = randomUUID();
  assert.equal((await send({ ...good, "x-bridge-nonce": n2, "x-bridge-signature": signature(Buffer.alloc(32, 1).toString("base64"), "POST", "/api/bridge/cursor", ts, n2, "{}") })).status, 403, "chave errada");
  const n3 = randomUUID();
  assert.equal((await send({ ...good, "x-bridge-nonce": n3, "x-bridge-signature": signature(KEY, "POST", "/api/bridge/cursor", ts, n3, "{}") }, '{"x":1}')).status, 403, "corpo alterado");
  const old = String(Date.now() - 10 * 60000), n4 = randomUUID();
  assert.equal((await send({ "x-bridge-timestamp": old, "x-bridge-nonce": n4, "x-bridge-signature": signature(KEY, "POST", "/api/bridge/cursor", old, n4, "{}") })).status, 401, "carimbo velho");
  delete ctx.env.BRIDGE_HMAC_KEY;
  assert.equal((await send(good)).status, 503);
});

test("Ponte: hash local igual ao do congelamento da ficha", async () => {
  const { messageHash } = await import("../src/mail.js");
  const { messageHash: workerHash } = await import("../../src/fichas.js");
  for (const [s, b, h] of [["Assunto", "Texto", null], ["Zuständige Person", "Guten Tag,\n\nText", "<p>x</p>"]]) assert.equal(messageHash(s, b, h), await workerHash(s, b, h));
});

test("Ponte: erro de leitura depois de uma leitura boa suspende o envio na hora", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = bridgeDeps(ctx);
  assert.equal(await readReplies(d), true);
  d.imap.down = true;
  assert.equal(await readReplies(d), false);
  assert.equal((await d.compass.call("/api/bridge/claim")).reason, "reply_reader_unavailable");
  assert.equal(d.smtp.raws.length, 0);
});

test("Ponte: passo enviado com atraso empurra os seguintes, mantendo os dias aprovados entre passos", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const day = (n) => new Date(Date.parse(todaySP() + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  // Aprovado para começar 3 dias atrás (computador desligado): passo 1 atrasado, passo 2 (dia 4) venceria amanhã.
  const offsets = ctx.DB.raw.prepare("SELECT o.step_no, m.day_offset FROM send_outbox o JOIN ficha_messages m ON m.id=o.message_row_id ORDER BY o.step_no").all();
  for (const r of offsets) ctx.DB.raw.prepare("UPDATE send_outbox SET planned_date=? WHERE step_no=?").run(day(r.day_offset - 3), r.step_no);
  const d = bridgeDeps(ctx);
  assert.equal((await runCycle(d)).sent, true);
  const planned = ctx.DB.raw.prepare("SELECT o.step_no, o.planned_date, m.day_offset FROM send_outbox o JOIN ficha_messages m ON m.id=o.message_row_id WHERE o.step_no>1 ORDER BY o.step_no").all();
  const first = offsets.find((r) => r.step_no === 1).day_offset;
  for (const r of planned) assert.equal(r.planned_date, day(r.day_offset - first), `passo ${r.step_no}: mesma distância do passo 1 enviado hoje`);
  assert.equal(d.smtp.raws.length, 1, "atrasados não saem juntos");
  assert.equal((await runCycle(d)).reason, "interval");
});

test("Ponte: chave em hexadecimal (formato de produção) assina igual nos dois lados", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const hex = "ab".repeat(32);
  ctx.env.BRIDGE_HMAC_KEY = hex;
  const compass = compassClient({ baseUrl: "http://localhost", hmacKey: hex, fetchImpl: (url, init) => worker.fetch(new Request(url, init), ctx.env) });
  const c = await compass.call("/api/bridge/cursor");
  assert.equal(c.mailbox, "INBOX");
  ctx.env.BRIDGE_HMAC_KEY = "  " + hex + "\r\n"; // espaço/quebra em volta não atrapalha
  assert.equal((await compass.call("/api/bridge/cursor")).mailbox, "INBOX");
});

test("Ponte: trava local desliga o canal (nunca liga) e segura a fila", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  await ready(ctx);
  const d = bridgeDeps(ctx);
  const r = await d.compass.call("/api/bridge/lockdown", { reason: "prazo do teste interno" });
  assert.deepEqual(r, { channel: "email", previous: "internal_test", state: "planned" });
  assert.equal((await runCycle(d)).sent, false);
  assert.equal(ctx.DB.raw.prepare("SELECT block_reason FROM send_outbox WHERE step_no=1").get().block_reason, "channel_not_enabled");
  assert.equal(d.smtp.raws.length, 0);
  assert.equal((await d.compass.call("/api/bridge/lockdown", {})).previous, "planned", "idempotente");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='bridge.lockdown'").get().n, 2);
});
