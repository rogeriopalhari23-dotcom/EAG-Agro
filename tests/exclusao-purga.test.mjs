import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, transport, at } from "./helpers/pilot.mjs";
import { memoryR2 } from "./helpers/trade.mjs";
import { tick } from "../src/sending.js";
import { processMessage } from "../src/inbound.js";
import { encryptPii, decryptPii } from "../src/crypto.js";
import { PURGED } from "../src/changes.js";

// EXCLUSAO-PURGA (R9.1, R23.5): só dados fictícios ("Maria Souza", valeverde.com.br, exemplo.invalid).
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
const enc = (s) => new TextEncoder().encode(s);

async function scenario(ctx) {
  ctx.env.FILES = memoryR2();
  const r = await pilot(ctx);
  await tick(ctx.env, "eag-internal", { transport: transport(), now: at(10) });
  const mid = ctx.DB.raw.prepare("SELECT message_id FROM send_outbox WHERE step_no=1").get().message_id;
  const raw = `From: Maria Souza <compras@valeverde.com.br>\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: Re: Fornecedor\r\nMessage-ID: <r-1@valeverde.com.br>\r\nIn-Reply-To: ${mid}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nOi, aqui é a Maria Souza, celular 16 99999-0000.\r\n`;
  await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: 501, bytes: enc(raw) }, at(12));
  ctx.DB.raw
    .prepare(
      `INSERT INTO person_candidates(id,tenant_id,company_id,name_encrypted,name_hash,title_encrypted,role_suggestion,relevance,source_kind,source_url,verified_at,refresh_after,email_encrypted,status,contact_id,created_by)
       VALUES ('pc-1','eag-internal',?,?,'h-maria',?,'decision_maker','compras','company_site','https://valeverde.exemplo.invalid/equipe','2099-01-01','2099-07-01',?,'accepted',?,'teste')`,
    )
    .run(r.companyId, await encryptPii("Maria Souza", ctx.env), await encryptPii("Compradora", ctx.env), await encryptPii("compras@valeverde.com.br", ctx.env), r.dm);
  ctx.DB.raw
    .prepare("INSERT INTO contact_verifications(id,tenant_id,contact_id,verification_type,status,method,source_reference,verified_by,verified_at) VALUES ('cv-1','eag-internal',?,'job_title','confirmed','site','https://linkedin.exemplo.invalid/in/maria-souza','teste','2099-01-01')")
    .run(r.dm);
  // Tarefa de ligação do contato (como as geradas pela ficha), com roteiro e resultado que citam a pessoa.
  ctx.DB.raw
    .prepare("INSERT INTO tasks(id,tenant_id,company_id,contact_id,kind,owner_id,due_date,status,script,result_json) VALUES ('tk-1','eag-internal',?,?,'call_l1','teste','2099-01-07','done','Ligar para Maria Souza','{\"nota\":\"Maria pediu retorno\"}')")
    .run(r.companyId, r.dm);
  return r;
}

check("EXCLUSAO-PURGA: exclusão alcança textos congelados, mensagem no R2, tarefas, candidata e verificação; hash vai para a supressão", async (ctx) => {
  const r = await scenario(ctx);
  const DB = ctx.DB.raw;
  const before = DB.prepare("SELECT id,message_sha256 FROM ficha_messages WHERE contact_id=? ORDER BY step_no").all(r.dm);
  assert.ok(before.length > 0);
  const inbound = DB.prepare("SELECT r2_key FROM inbound_messages WHERE uidvalidity=7 AND imap_uid=501").get();
  assert.match(inbound.r2_key, /^inbound\//);
  assert.ok(ctx.env.FILES.store.has(inbound.r2_key), "resposta guardada no R2 antes da exclusão");
  const hash = DB.prepare("SELECT email_hash FROM contacts WHERE id=?").get(r.dm).email_hash;

  const del = await ctx.api(`/api/contacts/${r.dm}/delete-personal-data`, "POST", { legalBasis: "Pedido fictício do titular em 2099-01-06" });
  assert.equal(del.status, 200, JSON.stringify(del.data));
  assert.equal(del.data.fichaMessagesPurged, before.length);
  assert.equal(del.data.inboundPurged, 1);
  assert.equal(del.data.suppressed, true);

  // Textos: marcador no lugar do conteúdo; identidade e hash da mensagem intactos.
  for (const m of DB.prepare("SELECT * FROM ficha_messages WHERE contact_id=? ORDER BY step_no").all(r.dm)) {
    assert.ok(m.purged_at);
    assert.equal(await decryptPii(m.body_enc, ctx.env), PURGED);
    assert.equal(m.body_html_enc, null);
    assert.equal(m.message_sha256, before.find((b) => b.id === m.id).message_sha256);
  }
  // Mensagem recebida: conteúdo fora do R2, linha mantida sem conteúdo.
  assert.equal(ctx.env.FILES.store.has(inbound.r2_key), false);
  const ib = DB.prepare("SELECT r2_key,content_purged_at,classification FROM inbound_messages WHERE uidvalidity=7 AND imap_uid=501").get();
  assert.equal(ib.r2_key, "purged");
  assert.ok(ib.content_purged_at);
  // Tarefas, candidata e verificação.
  const tasks = DB.prepare("SELECT script,result_json FROM tasks WHERE contact_id=?").all(r.dm);
  assert.ok(tasks.length > 0);
  for (const t of tasks) {
    assert.equal(t.script, null);
    assert.equal(t.result_json, null);
  }
  const pc = DB.prepare("SELECT * FROM person_candidates WHERE id='pc-1'").get();
  assert.equal(await decryptPii(pc.name_encrypted, ctx.env), PURGED);
  assert.equal(pc.title_encrypted, null);
  assert.equal(pc.email_encrypted, null);
  assert.equal(pc.status, "dismissed");
  assert.equal(DB.prepare("SELECT source_reference FROM contact_verifications WHERE id='cv-1'").get().source_reference, null);
  // Supressão pelo hash (R9.1.2) e nada do titular na API da ficha.
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM suppression_entries WHERE identifier_hash=? AND channel='email'").get(hash).n, 1);
  const view = JSON.stringify((await ctx.api(`/api/fichas/${r.fichaId}`)).data);
  assert.doesNotMatch(view, /Maria|valeverde/i);
  // Auditoria sem PII.
  const audit = DB.prepare("SELECT new_value_json FROM audit_log WHERE action='contact.personal_data_deleted'").get();
  assert.doesNotMatch(audit.new_value_json, /Maria|valeverde/i);
});

check("EXCLUSAO-PURGA: texto purgado não é aprovado e a imutabilidade continua para qualquer outra alteração", async (ctx) => {
  const r = await scenario(ctx);
  const DB = ctx.DB.raw;
  const m = DB.prepare("SELECT id FROM ficha_messages WHERE contact_id=? LIMIT 1").get(r.dm);
  // Sem a marca de purga, nada muda (nem o corpo, nem o hash).
  assert.throws(() => DB.prepare("UPDATE ficha_messages SET body_enc='x' WHERE id=?").run(m.id), /ficha_message_immutable/);
  assert.throws(() => DB.prepare("UPDATE ficha_messages SET message_sha256='x',purged_at='2099-01-06' WHERE id=?").run(m.id), /ficha_message_immutable/);
  assert.throws(() => DB.prepare("DELETE FROM ficha_messages WHERE id=?").run(m.id), /ficha_message_immutable/);

  assert.equal((await ctx.api(`/api/contacts/${r.dm}/delete-personal-data`, "POST", { legalBasis: "Pedido fictício do titular" })).status, 200);
  // Depois da purga, a marca não pode ser refeita nem desfeita.
  assert.throws(() => DB.prepare("UPDATE ficha_messages SET purged_at=NULL WHERE id=?").run(m.id), /ficha_message_immutable/);
  assert.throws(() => DB.prepare("UPDATE ficha_messages SET body_enc='y',purged_at='2099-02-01' WHERE id=?").run(m.id), /ficha_message_immutable/);

  const f = (await ctx.api(`/api/fichas/${r.fichaId}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  const ap = await ctx.api(`/api/fichas/${r.fichaId}/approve`, "POST", { versionNo: f.version.no, contactId: r.dm, channel: "email", messagesSha256: x?.messagesSha256 ?? "x" });
  assert.equal(ap.status, 409);
  assert.equal(ap.data.error?.code ?? ap.data.code, "personal_data_deleted");

  // Repetir o pedido é seguro: nada novo a purgar, supressão não duplica.
  const again = await ctx.api(`/api/contacts/${r.dm}/delete-personal-data`, "POST", { legalBasis: "Repetição fictícia" });
  assert.equal(again.status, 200);
  assert.equal(again.data.fichaMessagesPurged, 0);
  assert.equal(again.data.inboundPurged, 0);
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n, 1);
});
