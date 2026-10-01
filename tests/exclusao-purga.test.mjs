import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, readFileSync } from "node:fs";
import { setup } from "./helpers/db.mjs";
import { pilot, transport, at } from "./helpers/pilot.mjs";
import { memoryR2 } from "./helpers/trade.mjs";
import { tick } from "../src/sending.js";
import { processMessage } from "../src/inbound.js";
import { encryptPii, decryptPii } from "../src/crypto.js";
import { nameHash } from "../src/people.js";
import { PURGED, redactAddresses } from "../src/erasure.js";
import { openJournal } from "../bridge/src/journal.js";
import { redactJournal } from "../bridge/scripts/redigir-diario.mjs";

// EXCLUSAO-PURGA (R9.1, R9.1.2, R23.5). Só dados fictícios: Maria Souza (titular que pede exclusão) e João Lima
// (colega, outro contato da mesma empresa), domínios valeverde.com.br e exemplo.invalid.
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(() => ctx.close());
    await fn(ctx);
  });
}
const enc = (s) => new TextEncoder().encode(s);
const MARIA = "compras@valeverde.com.br";
const JOAO = "joao@valeverde.com.br";
const SITE = "https://valeverde.exemplo.invalid";
const reply = (from, mid, body, n) =>
  `From: ${from}\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: Re: Fornecedor\r\nMessage-ID: <r-${n}@valeverde.com.br>\r\nIn-Reply-To: ${mid}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`;

async function scenario(ctx) {
  ctx.env.FILES = memoryR2();
  const r = await pilot(ctx, { email: MARIA });
  const DB = ctx.DB.raw;
  DB.prepare("UPDATE companies SET website=? WHERE id=?").run(SITE, r.companyId);
  // João: outro contato da mesma empresa, com candidata, verificação e tarefa próprias (evidências que devem ficar).
  const joao = (await ctx.api(`/api/companies/${r.companyId}/contacts`, "POST", { fullName: "João Lima", email: JOAO, prospectRole: "influencer", sourceLabel: "site", timezone: "America/Sao_Paulo" })).data.id;
  await tick(ctx.env, "eag-internal", { transport: transport(), now: at(10) });
  const outboxA = DB.prepare("SELECT id,message_id FROM send_outbox WHERE contact_id=? AND step_no=1").get(r.dm);
  // Resposta da Maria (dela) e, na mesma conversa, resposta do João (conteúdo compartilhado: é dele, cita a Maria).
  await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: 501, bytes: enc(reply(`Maria Souza <${MARIA}>`, outboxA.message_id, "Aqui é a Maria Souza, celular 16 99999-0000.", 1)) }, at(12));
  await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: 502, bytes: enc(reply(`João Lima <${JOAO}>`, outboxA.message_id, "Sou o João; a Maria me encaminhou.", 2)) }, at(13));
  const inMaria = DB.prepare("SELECT id,r2_key FROM inbound_messages WHERE imap_uid=501").get();
  const inJoao = DB.prepare("SELECT id,r2_key FROM inbound_messages WHERE imap_uid=502").get();
  // Notas de Rogério nas tarefas de resposta (o vínculo inbound_id é o que permite separar as duas).
  DB.prepare("UPDATE tasks SET result_json=? WHERE inbound_id=?").run('{"nota":"Maria pediu retorno na sexta"}', inMaria.id);
  DB.prepare("UPDATE tasks SET result_json=? WHERE inbound_id=?").run('{"nota":"João quer amostra"}', inJoao.id);
  // Candidatas, verificações e tarefas de ligação de cada um.
  const cand = async (id, name, email, phone, contactId) =>
    DB.prepare(
      `INSERT INTO person_candidates(id,tenant_id,company_id,name_encrypted,name_hash,title_encrypted,role_suggestion,relevance,source_kind,source_url,verified_at,refresh_after,email_encrypted,phone_encrypted,status,contact_id,created_by,purchase_note,purchase_source_url)
       VALUES (?,'eag-internal',?,?,?,?,'decision_maker','compras','impressum',?,'2099-01-01','2099-07-01',?,?,'accepted',?,'teste','Responde por compras de açúcar',?)`,
    ).run(id, r.companyId, await encryptPii(name, ctx.env), await nameHash(ctx.env, "eag-internal", r.companyId, name), await encryptPii("Compras", ctx.env), `${SITE}/impressum`, await encryptPii(email, ctx.env), await encryptPii(phone, ctx.env), contactId, `${SITE}/equipe`);
  await cand("pc-maria", "Maria Souza", MARIA, "+55 16 99999-0000", r.dm);
  await cand("pc-joao", "João Lima", JOAO, "+55 16 98888-0000", joao);
  for (const [id, contactId, who] of [["cv-maria", r.dm, "maria-souza"], ["cv-joao", joao, "joao-lima"]])
    DB.prepare("INSERT INTO contact_verifications(id,tenant_id,contact_id,verification_type,status,method,source_reference,verified_by,verified_at) VALUES (?,'eag-internal',?,'job_title','confirmed','site',?,'teste','2099-01-01')").run(id, contactId, `https://linkedin.exemplo.invalid/in/${who}`);
  for (const [id, contactId, script] of [["tk-maria", r.dm, "Ligar para Maria Souza"], ["tk-joao", joao, "Ligar para João Lima"]])
    DB.prepare("INSERT INTO tasks(id,tenant_id,company_id,contact_id,kind,owner_id,due_date,status,script) VALUES (?,'eag-internal',?,?,'call_l1','teste','2099-01-07','open',?)").run(id, r.companyId, contactId, script);
  // Aviso legal da empresa em cache: lista os dois (conteúdo compartilhado) e traz o e-mail da Maria e o telefone geral.
  const payload = { status: "ok", url: `${SITE}/impressum`, people: [{ name: "Maria Souza", title: "Einkauf" }, { name: "João Lima", title: "Geschäftsführer" }], email: MARIA, phone: "+55 16 3333-0000", requests: 1 };
  DB.prepare("INSERT INTO research_cache(source,external_id,url,checked_at,refresh_after,result_json) VALUES ('impressum',?,?,'2099-01-01','2099-07-01',?)").run(SITE, `${SITE}/impressum`, await encryptPii(JSON.stringify(payload), ctx.env));
  // Texto de servidor com o endereço dela no registro de envio e na resolução manual.
  DB.prepare("INSERT INTO send_log(id,outbox_id,event,detail) VALUES ('lg-1',?,'temp_failed',?)").run(outboxA.id, `451 4.2.0 <${MARIA}>: mailbox busy`);
  DB.prepare("UPDATE send_outbox SET resolved_reason=? WHERE id=?").run(`Conferido com ${MARIA} pelo telefone`, outboxA.id);
  return { ...r, joao, outboxA, inMaria, inJoao };
}
const impressum = async (ctx) => JSON.parse(await decryptPii(ctx.DB.raw.prepare("SELECT result_json FROM research_cache WHERE external_id=?").get(SITE).result_json, ctx.env));
const erase = (ctx, id, basis = "Pedido fictício do titular em 2099-01-06") => ctx.api(`/api/contacts/${id}/delete-personal-data`, "POST", { legalBasis: basis });

check("EXCLUSAO-PURGA: alcance completo da Maria; evidências do João intactas; resposta compartilhada só listada", async (ctx) => {
  const r = await scenario(ctx);
  const DB = ctx.DB.raw;
  const before = DB.prepare("SELECT id,message_sha256 FROM ficha_messages WHERE contact_id=?").all(r.dm);
  assert.ok(before.length > 0);
  assert.ok(ctx.env.FILES.store.has(r.inMaria.r2_key) && ctx.env.FILES.store.has(r.inJoao.r2_key));
  const hash = DB.prepare("SELECT email_hash FROM contacts WHERE id=?").get(r.dm).email_hash;

  const del = await erase(ctx, r.dm);
  assert.equal(del.status, 200, JSON.stringify(del.data));
  assert.equal(del.data.fichaMessagesPurged, before.length);
  assert.equal(del.data.inboundPurged, 1);
  assert.deepEqual(del.data.sharedRetained, [r.inJoao.id]);
  assert.equal(del.data.impressumCacheTrimmed, true);
  assert.equal(del.data.sendLogRedacted, 2);

  // Textos congelados: marcador; identidade e hash intactos.
  for (const m of DB.prepare("SELECT * FROM ficha_messages WHERE contact_id=?").all(r.dm)) {
    assert.equal(await decryptPii(m.body_enc, ctx.env), PURGED);
    assert.equal(m.body_html_enc, null);
    assert.equal(m.message_sha256, before.find((b) => b.id === m.id).message_sha256);
  }
  // Mensagem da Maria: fora do R2 e sem identificadores do servidor dela. A do João continua inteira.
  assert.equal(ctx.env.FILES.store.has(r.inMaria.r2_key), false);
  const im = DB.prepare("SELECT * FROM inbound_messages WHERE id=?").get(r.inMaria.id);
  assert.deepEqual([im.r2_key, im.message_id, im.in_reply_to, im.references_json, !!im.content_purged_at], ["purged", null, null, "[]", true]);
  assert.equal(im.outbox_id, r.outboxA.id, "correlação com o envio fica como evidência");
  assert.ok(ctx.env.FILES.store.has(r.inJoao.r2_key));
  assert.equal(DB.prepare("SELECT content_purged_at FROM inbound_messages WHERE id=?").get(r.inJoao.id).content_purged_at, null);
  // Tarefa de resposta da Maria (pelo vínculo) limpa e cancelada; a do João mantém a nota.
  const tm = DB.prepare("SELECT status,script,result_json FROM tasks WHERE inbound_id=? AND kind='reply_followup'").get(r.inMaria.id);
  assert.deepEqual([tm.status, tm.script, tm.result_json], ["cancelled", null, null]);
  assert.match(DB.prepare("SELECT result_json FROM tasks WHERE inbound_id=? AND kind='reply_followup'").get(r.inJoao.id).result_json, /amostra/);
  // Tarefa, candidata e verificação: Maria purgadas, João intactas.
  assert.deepEqual({ ...DB.prepare("SELECT status,script FROM tasks WHERE id='tk-maria'").get() }, { status: "cancelled", script: null });
  assert.deepEqual({ ...DB.prepare("SELECT status,script FROM tasks WHERE id='tk-joao'").get() }, { status: "open", script: "Ligar para João Lima" });
  const pm = DB.prepare("SELECT * FROM person_candidates WHERE id='pc-maria'").get();
  assert.equal(await decryptPii(pm.name_encrypted, ctx.env), PURGED);
  assert.deepEqual([pm.email_encrypted, pm.phone_encrypted, pm.purchase_note, pm.purchase_source_url, pm.source_url, pm.status], [null, null, null, null, "purged", "dismissed"]);
  const pj = DB.prepare("SELECT * FROM person_candidates WHERE id='pc-joao'").get();
  assert.equal(await decryptPii(pj.name_encrypted, ctx.env), "João Lima");
  assert.equal(pj.status, "accepted");
  assert.equal(DB.prepare("SELECT source_reference FROM contact_verifications WHERE id='cv-maria'").get().source_reference, null);
  assert.match(DB.prepare("SELECT source_reference FROM contact_verifications WHERE id='cv-joao'").get().source_reference, /joao-lima/);
  // Cache do aviso legal: sai só a Maria e o e-mail dela; João e o telefone geral ficam.
  const cache = await impressum(ctx);
  assert.deepEqual(cache.people, [{ name: "João Lima", title: "Geschäftsführer" }]);
  assert.equal(cache.email, null);
  assert.equal(cache.phone, "+55 16 3333-0000");
  // Registros de envio sem o endereço; contato do João intacto; supressão e registro de exclusão.
  assert.equal(DB.prepare("SELECT detail FROM send_log WHERE id='lg-1'").get().detail, "451 4.2.0 <[endereço]>: mailbox busy");
  assert.equal(DB.prepare("SELECT resolved_reason FROM send_outbox WHERE id=?").get(r.outboxA.id).resolved_reason, "Conferido com [endereço] pelo telefone");
  assert.ok(DB.prepare("SELECT email_encrypted FROM contacts WHERE id=?").get(r.joao).email_encrypted);
  assert.match(DB.prepare("SELECT source_label FROM contacts WHERE id=?").get(r.dm).source_label, /^dados excluídos em /);
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM suppression_entries WHERE identifier_hash=?").get(hash).n, 1);
  assert.equal(DB.prepare("SELECT email_hash FROM erasure_ledger WHERE contact_id=?").get(r.dm).email_hash, hash);
  assert.ok(ctx.env.FILES.store.has(`erasures/eag-internal/${r.dm}.json`));
  assert.doesNotMatch(ctx.env.FILES.store.get(`erasures/eag-internal/${r.dm}.json`), /Maria|valeverde|Pedido/);
  // Nada da Maria na API da ficha nem na auditoria.
  assert.doesNotMatch(JSON.stringify((await ctx.api(`/api/fichas/${r.fichaId}`)).data), /Maria|compras@/i);
  for (const a of DB.prepare("SELECT new_value_json FROM audit_log WHERE action LIKE 'contact.personal_data%'").all()) assert.doesNotMatch(a.new_value_json, /Maria|valeverde/i);

  // Conteúdo compartilhado: purga individual da resposta do João, por decisão registrada.
  assert.equal((await ctx.api(`/api/inbound/${r.inJoao.id}/purge-content`, "POST", { reason: "curto" })).status, 422);
  const pj2 = await ctx.api(`/api/inbound/${r.inJoao.id}/purge-content`, "POST", { reason: "Resposta cita a titular excluída (revisão de 2099-01-06)" });
  assert.equal(pj2.status, 200);
  assert.equal(ctx.env.FILES.store.has(r.inJoao.r2_key), false);
  assert.equal(DB.prepare("SELECT result_json FROM tasks WHERE inbound_id=? AND kind='reply_followup'").get(r.inJoao.id).result_json, null);
  assert.equal((await ctx.api(`/api/inbound/${r.inJoao.id}/purge-content`, "POST", { reason: "Repetição da mesma revisão" })).data.idempotent, true);
});

check("EXCLUSAO-PURGA: repetir o pedido não muda nada nem duplica registro; aprovação de texto purgado é recusada", async (ctx) => {
  const r = await scenario(ctx);
  const DB = ctx.DB.raw;
  assert.equal((await erase(ctx, r.dm)).status, 200);
  const again = await erase(ctx, r.dm, "Repetição fictícia do pedido");
  assert.equal(again.status, 200);
  assert.deepEqual(
    [again.data.fichaMessagesPurged, again.data.inboundPurged, again.data.sendLogRedacted, again.data.impressumCacheTrimmed],
    [0, 0, 0, false],
  );
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n, 1);
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM erasure_ledger").get().n, 1);
  assert.equal([...ctx.env.FILES.store.keys()].filter((k) => k.startsWith("erasures/")).length, 1);
  assert.deepEqual((await impressum(ctx)).people, [{ name: "João Lima", title: "Geschäftsführer" }]);

  // Imutabilidade: sem a marca de purga nada muda; depois dela, nem a marca.
  const m = DB.prepare("SELECT id FROM ficha_messages WHERE contact_id=? LIMIT 1").get(r.dm);
  assert.throws(() => DB.prepare("UPDATE ficha_messages SET purged_at=NULL WHERE id=?").run(m.id), /ficha_message_immutable/);
  assert.throws(() => DB.prepare("UPDATE ficha_messages SET body_enc='y',purged_at='2099-02-01' WHERE id=?").run(m.id), /ficha_message_immutable/);
  assert.throws(() => DB.prepare("DELETE FROM ficha_messages WHERE id=?").run(m.id), /ficha_message_immutable/);

  const f = (await ctx.api(`/api/fichas/${r.fichaId}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  const ap = await ctx.api(`/api/fichas/${r.fichaId}/approve`, "POST", { versionNo: f.version.no, contactId: r.dm, channel: "email", messagesSha256: x?.messagesSha256 ?? "x" });
  assert.equal(ap.status, 409);
  assert.equal(ap.data.error?.code ?? ap.data.code, "personal_data_deleted");
});

check("EXCLUSAO-PURGA: restauração do D1 para antes da exclusão para envio e aprovação até a reaplicação", async (ctx) => {
  const r = await scenario(ctx);
  const file = join(tmpdir(), `eag-restauracao-${process.pid}-${Date.now()}.sqlite`);
  try {
    ctx.DB.raw.exec(`VACUUM INTO '${file.replace(/\\/g, "/")}'`); // ponto de restauração anterior à exclusão
    assert.equal((await erase(ctx, r.dm)).status, 200);
    // "Restauração": o D1 volta à cópia; o R2 (registro de exclusão) não volta.
    ctx.DB.raw.close();
    ctx.DB.raw = new DatabaseSync(file);
    ctx.DB.raw.exec("PRAGMA foreign_keys=ON");
    const DB = ctx.DB.raw;
    assert.ok(DB.prepare("SELECT email_encrypted FROM contacts WHERE id=?").get(r.dm).email_encrypted, "dado excluído voltou com a restauração");
    assert.equal((await tick(ctx.env, "eag-internal", { transport: transport(), now: at(15) })).reason, "erasure_reapply_required");
    const f = (await ctx.api(`/api/fichas/${r.fichaId}`)).data;
    const x = f.toApprove.find((a) => a.channel === "email");
    const ap = await ctx.api(`/api/fichas/${r.fichaId}/approve`, "POST", { versionNo: f.version.no, contactId: r.dm, channel: "email", messagesSha256: x?.messagesSha256 ?? "x" });
    assert.equal(ap.data.error?.code ?? ap.data.code, "erasure_reapply_required");

    const re = await ctx.api("/api/erasures/reapply", "POST", {});
    assert.equal(re.status, 200, JSON.stringify(re.data));
    assert.equal(re.data.reapplied, 1);
    assert.equal(re.data.consistent, true);
    assert.equal(DB.prepare("SELECT email_encrypted FROM contacts WHERE id=?").get(r.dm).email_encrypted, null);
    assert.ok(DB.prepare("SELECT purged_at FROM ficha_messages WHERE contact_id=? LIMIT 1").get(r.dm).purged_at);
    assert.equal(DB.prepare("SELECT r2_key FROM inbound_messages WHERE id=?").get(r.inMaria.id).r2_key, "purged");
    assert.ok(DB.prepare("SELECT reapplied_at FROM erasure_ledger WHERE contact_id=?").get(r.dm).reapplied_at);
    assert.equal(DB.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='contact.personal_data_reapplied'").get().n, 1);
    assert.notEqual((await tick(ctx.env, "eag-internal", { transport: transport(), now: at(15) })).reason, "erasure_reapply_required");
    // Reaplicar de novo não faz nada.
    assert.equal((await ctx.api("/api/erasures/reapply", "POST", {})).data.reapplied, 0);
  } finally {
    // Windows não apaga arquivo aberto: fecha a cópia e deixa um banco vazio para o encerramento do teste.
    ctx.DB.raw.close();
    ctx.DB.raw = new DatabaseSync(":memory:");
    rmSync(file, { force: true });
  }
});

check("EXCLUSAO-PURGA: texto de servidor sem endereço no registro do Worker e no diário local da ponte", async () => {
  assert.equal(redactAddresses("550 5.1.1 <maria.souza@valeverde.com.br>: User unknown"), "550 5.1.1 <[endereço]>: User unknown");
  assert.equal(redactAddresses("250 2.0.0 Ok: queued as 4ABC"), "250 2.0.0 Ok: queued as 4ABC");
  assert.equal(redactAddresses(null), null);
  const j = openJournal(":memory:");
  const m = { outboxId: "o-1", leaseToken: 1, messageId: "<m@eagagro.com>", sha256: "h" };
  j.claimed(m);
  j.smtpDone(m, { kind: "perm_failed", code: 550, text: "5.1.1 <joao@valeverde.com.br> unknown" });
  assert.equal(j.pending()[0].smtp_text, "5.1.1 <[endereço]> unknown");
  j.close();
});

check("EXCLUSAO-PURGA: reversão da 0032 volta à imutabilidade total e mantém colunas e registro de exclusões", async (ctx) => {
  const r = await scenario(ctx);
  const DB = ctx.DB.raw;
  assert.equal((await erase(ctx, r.dm)).status, 200);
  DB.exec(readFileSync(new URL("../docs/implementation/correcoes/0032-reversao.sql", import.meta.url), "utf8"));
  const m = DB.prepare("SELECT id FROM ficha_messages WHERE contact_id=? LIMIT 1").get(r.joao) ?? DB.prepare("SELECT id FROM ficha_messages LIMIT 1").get();
  assert.throws(() => DB.prepare("UPDATE ficha_messages SET purged_at='2099-03-01' WHERE id=?").run(m.id), /ficha_message_immutable/);
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM erasure_ledger").get().n, 1, "a prova da exclusão não some");
  const cols = (t) => DB.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  assert.ok(cols("ficha_messages").includes("purged_at") && cols("tasks").includes("inbound_id"));
  // Conteúdo purgado continua purgado.
  assert.equal(await decryptPii(DB.prepare("SELECT body_enc FROM ficha_messages WHERE contact_id=? LIMIT 1").get(r.dm).body_enc, ctx.env), PURGED);
});

check("EXCLUSAO-PURGA: script local redige endereços já gravados no diário da ponte sem apagar linhas", async () => {
  const file = join(tmpdir(), `eag-diario-${process.pid}-${Date.now()}.sqlite`);
  try {
    const j = openJournal(file);
    j.claimed({ outboxId: "o-1", leaseToken: 1, messageId: "<m1@eagagro.com>", sha256: "h" });
    j.claimed({ outboxId: "o-2", leaseToken: 1, messageId: "<m2@eagagro.com>", sha256: "h" });
    j.close();
    const raw = new DatabaseSync(file);
    raw.prepare("UPDATE sends SET smtp_text=? WHERE outbox_id='o-1'").run("550 <maria.souza@valeverde.com.br> unknown");
    raw.prepare("UPDATE sends SET smtp_text=? WHERE outbox_id='o-2'").run("250 Ok");
    raw.close();
    assert.deepEqual(redactJournal(file), { examined: 1, changed: 1 });
    const check = new DatabaseSync(file);
    assert.deepEqual(check.prepare("SELECT smtp_text FROM sends ORDER BY outbox_id").all().map((x) => x.smtp_text), ["550 <[endereço]> unknown", "250 Ok"]);
    check.close();
    assert.deepEqual(redactJournal(file), { examined: 0, changed: 0 });
  } finally {
    for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
  }
});

// Tarefas de resposta "anteriores à 0032": sem inbound_id, como estariam em produção antes da migração.
const legacy = (DB) => DB.exec("UPDATE tasks SET inbound_id=NULL WHERE kind IN ('reply_followup','review_ambiguous')");
const linkSql = () => readFileSync(new URL("../docs/implementation/correcoes/0032-vinculo-tarefas-resposta.sql", import.meta.url), "utf8");

check("EXCLUSAO-PURGA: tarefas antigas ligadas só com evidência inequívoca (uma mensagem da empresa no dia)", async (ctx) => {
  const r = await scenario(ctx);
  const DB = ctx.DB.raw;
  // Respostas em dias diferentes: cada tarefa tem uma única candidata.
  DB.prepare("UPDATE inbound_messages SET processed_at='2099-01-06T12:00:00.000Z' WHERE id=?").run(r.inJoao.id);
  DB.prepare("UPDATE tasks SET due_date='2099-01-06' WHERE inbound_id=?").run(r.inJoao.id);
  const expected = Object.fromEntries(DB.prepare("SELECT id,inbound_id FROM tasks WHERE inbound_id IS NOT NULL").all().map((x) => [x.id, x.inbound_id]));
  assert.ok(Object.keys(expected).length >= 2);
  legacy(DB);
  DB.exec(linkSql());
  for (const [taskId, inboundId] of Object.entries(expected)) assert.equal(DB.prepare("SELECT inbound_id FROM tasks WHERE id=?").get(taskId).inbound_id, inboundId);
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM audit_log WHERE request_id='vinculo-tarefas-0032'").get().n, Object.keys(expected).length);
  assert.equal((await ctx.api("/api/tasks/reply-review")).data.items.length, 0);
  // Rodar de novo não liga nada a mais nem duplica a auditoria.
  DB.exec(linkSql());
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM audit_log WHERE request_id='vinculo-tarefas-0032'").get().n, Object.keys(expected).length);
  // A exclusão da Maria alcança a tarefa dela pelo vínculo e não a do João.
  const del = await erase(ctx, r.dm);
  assert.equal(del.data.replyTasksToReview, 0);
  assert.equal(DB.prepare("SELECT result_json FROM tasks WHERE inbound_id=? AND kind='reply_followup'").get(r.inMaria.id).result_json, null);
  assert.match(DB.prepare("SELECT result_json FROM tasks WHERE inbound_id=? AND kind='reply_followup'").get(r.inJoao.id).result_json, /amostra/);
});

check("EXCLUSAO-PURGA: tarefas antigas ambíguas ficam para revisão manual; exclusão informa e só alcança depois da ligação", async (ctx) => {
  const r = await scenario(ctx);
  const DB = ctx.DB.raw;
  legacy(DB);
  DB.exec(linkSql()); // Maria e João responderam no mesmo dia: duas candidatas por tarefa
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM tasks WHERE inbound_id IS NOT NULL").get().n, 0, "nada ligado sem evidência inequívoca");
  const review = (await ctx.api("/api/tasks/reply-review")).data.items;
  assert.ok(review.length >= 2 && review.every((x) => x.candidates.length === 2));
  assert.doesNotMatch(JSON.stringify(review), /Maria|valeverde|compras@/i, "revisão sem PII");

  const del = await erase(ctx, r.dm);
  assert.equal(del.data.replyTasksToReview, review.length, "a exclusão avisa o que ficou sem alcance");
  const mariaTask = DB.prepare("SELECT id FROM tasks WHERE kind='reply_followup' AND result_json LIKE '%Maria%'").get();
  assert.ok(mariaTask, "sem vínculo, a nota não foi apagada automaticamente");

  // Decisão manual: liga à mensagem da Maria; repetir o pedido de exclusão alcança a tarefa.
  assert.equal((await ctx.api(`/api/tasks/${mariaTask.id}/link-inbound`, "POST", { inboundId: r.inMaria.id, reason: "curto" })).status, 422);
  const ln = await ctx.api(`/api/tasks/${mariaTask.id}/link-inbound`, "POST", { inboundId: r.inMaria.id, reason: "Nota cita a resposta da Maria (conferido na tarefa)" });
  assert.equal(ln.status, 200);
  assert.equal((await ctx.api(`/api/tasks/${mariaTask.id}/link-inbound`, "POST", { inboundId: r.inJoao.id, reason: "Tentativa de trocar o vínculo" })).status, 409);
  assert.equal((await erase(ctx, r.dm, "Repetição após a ligação manual")).status, 200);
  assert.equal(DB.prepare("SELECT result_json FROM tasks WHERE id=?").get(mariaTask.id).result_json, null);
  assert.match(DB.prepare("SELECT result_json FROM tasks WHERE kind='reply_followup' AND result_json LIKE '%amostra%'").get().result_json, /João/);
});

check("EXCLUSAO-PURGA: mensagem da pessoa relida depois da purga é reconhecida e não volta ao R2 nem gera tarefa", async (ctx) => {
  const r = await scenario(ctx);
  const DB = ctx.DB.raw;
  assert.equal((await erase(ctx, r.dm)).status, 200);
  const before = DB.prepare("SELECT COUNT(*) n FROM tasks").get().n;
  const raw = reply(`Maria Souza <${MARIA}>`, r.outboxA.message_id, "Aqui é a Maria Souza, celular 16 99999-0000.", 1);
  const again = await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 9, uid: 77, bytes: enc(raw) }, at(16));
  assert.equal(again.duplicate, true);
  assert.equal(again.of, r.inMaria.id);
  assert.equal(DB.prepare("SELECT COUNT(*) n FROM tasks").get().n, before);
  assert.equal([...ctx.env.FILES.store.keys()].some((k) => k.startsWith("inbound/9/")), false);
});
