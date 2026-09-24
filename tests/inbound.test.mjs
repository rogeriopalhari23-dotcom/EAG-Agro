import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, transport, at } from "./helpers/pilot.mjs";
import { tick } from "../src/sending.js";
import { poll, processMessage, classify, PRICE_GUIDANCE } from "../src/inbound.js";
import { parseMessage } from "../src/mime.js";
import { responseReader, parseSearch, parseUidValidity, parseFetch } from "../src/adapters/imap.js";

// Mensagens escritas no formato RFC 5322 / RFC 3464 (valores de teste).
const reply = ({ from = "Maria Souza <compras@valeverde.com.br>", inReplyTo = "", subject = "Re: Fornecedor açúcar", body = "Oi Rogério, podemos conversar na quinta.", extra = "" } = {}) =>
  `From: ${from}\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: ${subject}\r\nMessage-ID: <r-${Math.random()}@valeverde.com.br>\r\n${inReplyTo ? `In-Reply-To: ${inReplyTo}\r\n` : ""}${extra}Content-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n\r\n> Olá, Maria, tudo bem?\r\n> Sou da EAG Agro\r\n`;
const dsn = (rcpt, status = "5.1.1") =>
  `From: Mail Delivery System <MAILER-DAEMON@hostinger.com>\r\nSubject: Undelivered Mail Returned to Sender\r\nContent-Type: multipart/report; report-type=delivery-status; boundary="B"\r\n\r\n--B\r\nContent-Type: text/plain\r\n\r\nNão foi possível entregar.\r\n--B\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; mx.hostinger.com\r\n\r\nFinal-Recipient: rfc822; ${rcpt}\r\nAction: failed\r\nStatus: ${status}\r\n--B--\r\n`;
const enc = (s) => new TextEncoder().encode(s);
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
async function sentFirst(ctx) {
  const r = await pilot(ctx);
  await tick(ctx.env, "eag-internal", { transport: transport(), now: at(10) });
  const mid = ctx.DB.raw.prepare("SELECT message_id FROM send_outbox WHERE step_no=1").get().message_id;
  return { ...r, mid };
}
let uid = 100;
const deliver = (ctx, raw) => processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: ++uid, bytes: enc(raw) }, at(12));
const statuses = (DB) => DB.raw.prepare("SELECT step_no,status,block_reason FROM send_outbox ORDER BY step_no").all().map((r) => `${r.step_no}:${r.status}`);

test("P2-T11: leitor MIME decodifica quoted-printable, base64 e cabeçalho codificado", () => {
  const m = parseMessage(
    "From: =?utf-8?B?Sm/Do28=?= <joao@x.com>\r\nSubject: =?iso-8859-1?Q?Aus=EAncia?=\r\nContent-Type: multipart/alternative; boundary=zz\r\n\r\n--zz\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nN=C3=A3o posso agora, sair da lista\r\n--zz--\r\n",
  );
  assert.equal(m.headers.get("from")[0], "João <joao@x.com>");
  assert.equal(m.headers.get("subject")[0], "Ausência");
  assert.match(m.text, /Não posso agora/);
});

test("P2-T11: classificação — ausência, bounce, descadastro, alerta do provedor, pedido de preço", () => {
  assert.equal(classify(parseMessage(reply({ extra: "Auto-Submitted: auto-replied\r\n" }))).kind, "auto_reply");
  assert.equal(classify(parseMessage(reply({ subject: "Out of Office: back Monday" }))).kind, "auto_reply");
  assert.equal(classify(parseMessage(dsn("x@y.com"))).kind, "bounce_hard");
  assert.equal(classify(parseMessage(dsn("x@y.com", "4.2.2"))).kind, "bounce_soft");
  assert.equal(classify(parseMessage(reply({ body: "SAIR" }))).kind, "unsubscribe");
  assert.equal(classify(parseMessage(reply({ body: "Please remove me from your list" }))).kind, "unsubscribe");
  // "sair" citado do nosso e-mail não é pedido de saída.
  assert.equal(classify(parseMessage(reply({ body: "Oi, tudo bem\r\n> responda \"sair\" ou use este link" }))).kind, "human");
  assert.equal(classify(parseMessage(`From: suporte@hostinger.com\r\nSubject: Your account was suspended for spam\r\n\r\nx`)).kind, "provider_alert");
  assert.equal(classify(parseMessage(reply({ body: "Me manda a tabela de preço?" }))).priceRequest, true);
});

check("P2-T11: resposta na thread pausa empresa+commodity em todos os passos e abre tarefa (AT29)", async (ctx) => {
  const r = await sentFirst(ctx);
  const out = await deliver(ctx, reply({ inReplyTo: r.mid }));
  assert.deepEqual({ c: out.classification, k: out.correlation }, { c: "human", k: "thread" });
  assert.deepEqual(statuses(ctx.DB), ["1:accepted", "2:cancelled", "3:cancelled", "4:cancelled"]);
  const task = ctx.DB.raw.prepare("SELECT kind,priority FROM tasks WHERE company_id=?").get(r.companyId);
  assert.deepEqual({ ...task }, { kind: "reply_followup", priority: 10 });
});

check("P2-T11: resposta fora da thread é ligada pelo remetente (Review Focus 1)", async (ctx) => {
  await sentFirst(ctx);
  const out = await deliver(ctx, reply({ subject: "Contato", body: "Recebi sua mensagem, me ligue." }));
  assert.equal(out.correlation, "sender");
  assert.equal(statuses(ctx.DB)[1], "2:cancelled");
});

check("P2-T11: resposta automática e mensagem ilegível também pausam (AT30, AT36)", async (ctx) => {
  await sentFirst(ctx);
  const out = await deliver(ctx, reply({ extra: "Auto-Submitted: auto-replied\r\n", body: "Estou de férias até dia 20." }));
  assert.equal(out.classification, "auto_reply");
  assert.equal(statuses(ctx.DB)[1], "2:cancelled");
  const note = ctx.DB.raw.prepare("SELECT script FROM tasks WHERE kind='reply_followup'").get().script;
  assert.match(note, /B1 pendente/);
});

check("P2-T11: 'sair' suprime antes de tudo e sem despedida (AT31); pedido de preço traz a orientação (AT58)", async (ctx) => {
  await sentFirst(ctx);
  await deliver(ctx, reply({ body: "sair" }));
  assert.equal(ctx.DB.raw.prepare("SELECT source FROM suppression_entries").get().source, "reply");
  assert.ok(statuses(ctx.DB).slice(1).every((x) => x.endsWith("cancelled")));
  const t = transport();
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10, 0, "2099-01-19") });
  assert.equal(t.sent.length, 0);
  const ctx2 = setup();
  try {
    const r2 = await sentFirst(ctx2);
    await processMessage(ctx2.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: 1, bytes: enc(reply({ inReplyTo: r2.mid, body: "Qual o preço por tonelada?" })) }, at(12));
    assert.equal(ctx2.DB.raw.prepare("SELECT script FROM tasks WHERE kind='reply_followup'").get().script, PRICE_GUIDANCE);
  } finally {
    ctx2.close();
  }
});

check("P2-T11: bounce 5.x.x suprime o destinatário e cancela o resto; mesma mensagem lida duas vezes não repete efeito", async (ctx) => {
  await sentFirst(ctx);
  const raw = enc(dsn("compras@valeverde.com.br"));
  const a = await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: 5, bytes: raw }, at(12));
  const b = await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: 5, bytes: raw }, at(12));
  assert.equal(a.classification, "bounce_hard");
  assert.equal(b.duplicate, true);
  assert.equal(ctx.DB.raw.prepare("SELECT source FROM suppression_entries").get().source, "bounce");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM inbound_messages").get().n, 1);
});

check("P2-T11: remetente ligado a duas empresas é ambíguo e mantém as duas pausadas (errata item 7)", async (ctx) => {
  const a = await pilot(ctx);
  await pilot(ctx, { cnpj: "22333444000155", legalName: "Balas Serra Ltda.", reuseCampaign: a.campaignId });
  const t = transport();
  await tick(ctx.env, "eag-internal", { transport: t, now: at(10) });
  ctx.DB.raw.exec("UPDATE sender_state SET next_send_at=NULL");
  ctx.DB.raw.exec("UPDATE send_outbox SET status='accepted',accepted_at='2099-01-05T13:30:00.000Z' WHERE step_no=1 AND status<>'accepted'");
  const out = await deliver(ctx, reply({ subject: "Oi", body: "Pode me ligar?" }));
  assert.equal(out.correlation, "ambiguous");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM tasks WHERE kind='review_ambiguous'").get().n, 2);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM send_outbox WHERE status='pending'").get().n, 0);
});

check("P2-T11: aviso do provedor para a operação inteira", async (ctx) => {
  await sentFirst(ctx);
  await deliver(ctx, "From: abuse@hostinger.com\r\nSubject: Limite de envio atingido - conta sob revisão por spam\r\n\r\nDetalhes.");
  assert.ok(ctx.DB.raw.prepare("SELECT stopped_at FROM sender_state").get().stopped_at);
  assert.equal((await tick(ctx.env, "eag-internal", { transport: transport(), now: at(14) })).reason, "sender_stopped");
});

check("P2-T11: leitura com cursor: UID novo só uma vez; UIDVALIDITY novo recomeça sem duplicar", async (ctx) => {
  await sentFirst(ctx);
  const calls = [];
  let validity = 7;
  const client = {
    fetchNew: async (mb, last) => {
      calls.push(last);
      const all = [{ uid: 1, bytes: enc(reply({ body: "Oi" })) }, { uid: 2, bytes: enc(reply({ body: "Olá de novo" })) }];
      return { uidValidity: validity, messages: all.filter((m) => m.uid > last) };
    },
  };
  assert.equal((await poll(ctx.env, "eag-internal", { client, now: at(12) })).processed, 2);
  assert.equal((await poll(ctx.env, "eag-internal", { client, now: at(12, 5) })).processed, 0);
  validity = 8;
  await poll(ctx.env, "eag-internal", { client, now: at(12, 10) });
  assert.deepEqual(calls, [0, 2, 2, 0]);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM inbound_messages").get().n, 4);
});

test("P2-T11: leitor IMAP lê literais e filtra o UID devolvido por 'n:*'", async () => {
  const lines = [
    "* OK [UIDVALIDITY 42] UIDs valid\r\n* 3 EXISTS\r\nA2 OK [READ-ONLY] EXAMINE completed\r\n",
    "* SEARCH 7\r\nA3 OK SEARCH completed\r\n",
    "* 1 FETCH (UID 9 BODY[]<0> {5}\r\nHel",
    "lo)\r\nA4 OK FETCH completed\r\n",
    "A5 NO [AUTHENTICATIONFAILED] Invalid credentials\r\n",
  ];
  async function* stream() {
    for (const l of lines) yield enc(l);
  }
  const r = responseReader(stream());
  assert.equal(parseUidValidity(await r.until("A2")), 42);
  assert.deepEqual(parseSearch(await r.until("A3"), 8), []);
  const f = parseFetch(await r.until("A4"));
  assert.equal(f[0].uid, 9);
  assert.equal(new TextDecoder().decode(f[0].bytes), "Hello");
  await assert.rejects(r.until("A5"), (e) => e.kind === "auth");
});
