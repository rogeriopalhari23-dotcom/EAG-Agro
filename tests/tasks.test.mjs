import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, transport, at, DAY } from "./helpers/pilot.mjs";
import { tick } from "../src/sending.js";
import { processMessage } from "../src/inbound.js";

function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
async function approveCalls(ctx, r) {
  const f = (await ctx.api(`/api/fichas/${r.fichaId}`)).data;
  const x = f.toApprove.find((a) => a.channel === "call");
  const res = await ctx.api(`/api/fichas/${r.fichaId}/approve`, "POST", { versionNo: f.version.no, contactId: r.dm, channel: "call", messagesSha256: x.messagesSha256, startDate: DAY });
  assert.equal(res.status, 200, JSON.stringify(res.data));
}

check("P2-T14: aprovar o canal de ligação cria as tarefas com roteiro e datas da cadência", async (ctx) => {
  const r = await pilot(ctx);
  await approveCalls(ctx, r);
  const rows = ctx.DB.raw.prepare("SELECT kind,due_date,script FROM tasks ORDER BY due_date").all();
  assert.deepEqual(rows.map((t) => t.due_date), ["2099-01-08", "2099-01-12", "2099-01-13", "2099-01-16"]);
  assert.ok(rows.every((t) => t.kind === "call_l1" && t.script.startsWith("enc:") && !t.script.includes("Maria")));
  const list = await ctx.api("/api/tasks?until=2099-01-31");
  assert.equal(list.data.items.length, 4);
  assert.deepEqual(list.data.items[0].blocked, []);
  assert.match(list.data.items[0].script, /três perguntas rápidas/);
});

check("P2-T14: resposta suspende a ligação do dia seguinte (AT65); tarefa suspensa não conclui", async (ctx) => {
  const r = await pilot(ctx);
  await approveCalls(ctx, r);
  await tick(ctx.env, "eag-internal", { transport: transport(), now: at(10) });
  const mid = ctx.DB.raw.prepare("SELECT message_id FROM send_outbox WHERE step_no=1").get().message_id;
  const raw = `From: compras@valeverde.com.br\r\nIn-Reply-To: ${mid}\r\nSubject: Re: Fornecedor açúcar\r\nContent-Type: text/plain\r\n\r\nPode ligar amanhã.\r\n`;
  await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 1, uid: 1, bytes: new TextEncoder().encode(raw) }, at(12));
  const calls = ctx.DB.raw.prepare("SELECT id,status FROM tasks WHERE kind='call_l1'").all();
  assert.ok(calls.every((t) => t.status === "suspended"));
  assert.equal((await ctx.api(`/api/tasks/${calls[0].id}/complete`, "POST", { outcome: "done" })).status, 409);
  const follow = ctx.DB.raw.prepare("SELECT id FROM tasks WHERE kind='reply_followup'").get();
  assert.equal((await ctx.api(`/api/tasks/${follow.id}/complete`, "POST", { outcome: "done", note: "Liguei e marcamos" })).status, 200);
});

check("P2-T14: ligação obedece às restrições (pausa bloqueia a conclusão) e registra as 3 perguntas", async (ctx) => {
  const r = await pilot(ctx);
  await approveCalls(ctx, r);
  const task = ctx.DB.raw.prepare("SELECT id FROM tasks ORDER BY due_date LIMIT 1").get();
  const p = await ctx.api("/api/pauses", "POST", { scope: "company", scopeRef: r.companyId, reason: "Aguardando retorno do cliente" });
  const blocked = await ctx.api(`/api/tasks/${task.id}/complete`, "POST", { outcome: "done" });
  assert.equal(blocked.data.error.code, "task_blocked");
  assert.deepEqual(blocked.data.error.details.reasons, ["paused_company"]);
  await ctx.api(`/api/pauses/${p.data.id}/resume`, "POST", { reason: "Pode seguir agora" });
  assert.equal((await ctx.api(`/api/tasks/${task.id}/complete`, "POST", { outcome: "done", answers: { monthlyVolumeT: "cem" } })).status, 422);
  const ok = await ctx.api(`/api/tasks/${task.id}/complete`, "POST", { outcome: "done", answers: { buyingChannel: "trading", modality: "spot", monthlyVolumeT: 120 } });
  assert.equal(ok.status, 200);
  const res = JSON.parse(ctx.DB.raw.prepare("SELECT result_json FROM tasks WHERE id=?").get(task.id).result_json);
  assert.deepEqual(res.answers, { buyingChannel: "trading", modality: "spot", monthlyVolumeT: 120 });
  assert.equal(res.method, "ligação");
});

check("P2-T14: break enviado sugere retorno em ~6 meses e não abre nova sequência (AT56)", async (ctx) => {
  await pilot(ctx);
  ctx.DB.raw.exec("UPDATE send_outbox SET status='cancelled' WHERE step_no IN (1,2,3)");
  ctx.DB.raw.exec(`UPDATE send_outbox SET planned_date='${DAY}' WHERE step_no=4`);
  await tick(ctx.env, "eag-internal", { transport: transport(), now: at(10) });
  const t = ctx.DB.raw.prepare("SELECT kind,due_date FROM tasks WHERE kind='return_suggested'").get();
  assert.equal(t.due_date, "2099-07-06");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM send_outbox WHERE status='pending'").get().n, 0);
});

check("P2-T14: reunião cria confirmação na manhã; linha do tempo e funil sem dado pessoal", async (ctx) => {
  const r = await pilot(ctx);
  await tick(ctx.env, "eag-internal", { transport: transport(), now: at(10) });
  const m = await ctx.api("/api/meetings", "POST", { companyId: r.companyId, contactId: r.dm, scheduledFor: "2099-01-07T18:00:00Z", durationMin: 30, inviteSent: true });
  assert.equal(m.status, 201);
  assert.equal(ctx.DB.raw.prepare("SELECT due_date FROM tasks WHERE kind='meeting_confirm'").get().due_date, "2099-01-07");
  const tl = await ctx.api(`/api/companies/${r.companyId}/timeline`);
  const text = JSON.stringify(tl.data);
  assert.ok(tl.data.items.some((x) => x.kind === "send" && /accepted/.test(x.detail)));
  assert.ok(tl.data.items.some((x) => x.kind === "meeting"));
  assert.ok(!text.includes("valeverde") && !text.includes("Maria"));
  const f = await ctx.api("/api/dashboard/funnel");
  assert.deepEqual(f.data, { prospected: 0, meetings: 1, deals: 0 });
  const l0 = await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: "sugar" });
  assert.equal(l0.status, 201);
  assert.match(ctx.DB.raw.prepare("SELECT script FROM tasks WHERE kind='call_l0'").get().script, /para quem eu endereço/);
  // Repetir não duplica; o complemento da unidade vem depois do roteiro da skill e aparece na tela da empresa.
  const dup = await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: "sugar", unitScript: "Pergunta extra" });
  assert.equal(dup.status, 409);
  const corn = await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: "corn", unitScript: "Aceita milho GMO?" });
  assert.equal(corn.status, 201);
  const script = ctx.DB.raw.prepare("SELECT script FROM tasks WHERE id=?").get(corn.data.id).script;
  assert.ok(script.indexOf("para quem eu endereço") < script.indexOf("Aceita milho GMO?"));
  const view = await ctx.api(`/api/companies/${r.companyId}`);
  assert.ok(view.data.openTasks.some((t) => t.id === corn.data.id && /Aceita milho GMO\?/.test(t.script)));
  assert.equal(typeof view.data.peopleCount, "number");
});

check("Tarefas: edição de ligação manual aberta guarda histórico cifrado, preserva id e estado e mantém a pendência T11", async (ctx) => {
  const r = await pilot(ctx);
  const l0 = await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: "corn", unitScript: "ANTES DE LIGAR: contato real depende da T11 validada.\nTelefone: NÃO CONFIRMADO" });
  assert.equal(l0.status, 201);
  const id = l0.data.id;
  const before = ctx.DB.raw.prepare("SELECT * FROM tasks WHERE id=?").get(id);
  const oldScript = before.script;
  const newScript = oldScript.replace("Telefone: NÃO CONFIRMADO", "Telefone: (64) 3615-9700 — canal geral da unidade (site oficial, 06/10/2026)");
  // Sem motivo, sem revisão certa, ou tirando a linha da T11: recusado.
  assert.equal((await ctx.api(`/api/tasks/${id}`, "PATCH", { expectedRevision: 1, script: newScript })).status, 422);
  assert.equal((await ctx.api(`/api/tasks/${id}`, "PATCH", { expectedRevision: 9, reason: "corrigir telefone", script: newScript })).status, 409);
  const noT11 = await ctx.api(`/api/tasks/${id}`, "PATCH", { expectedRevision: 1, reason: "corrigir telefone", script: newScript.replace(/^ANTES DE LIGAR:.*$/m, "") });
  assert.equal(noT11.status, 422);
  assert.equal(noT11.data.error.code, "t11_notice_required");
  // Edição válida.
  const ok = await ctx.api(`/api/tasks/${id}`, "PATCH", { expectedRevision: 1, reason: "corrigir telefone oficial", script: newScript, channelNote: "(64) 3615-9700 — canal geral da unidade", nextAction: "Aguardar T11" });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.deepEqual(ok.data, { id, revision: 2, fields: ["script", "channel_note", "next_action"] });
  const after = ctx.DB.raw.prepare("SELECT * FROM tasks WHERE id=?").get(id);
  assert.equal(after.status, "open");
  assert.equal(after.result_json, null);
  assert.equal(after.done_at, null);
  assert.equal(after.due_date, before.due_date);
  assert.equal(after.script, newScript);
  assert.match(after.script, /^ANTES DE LIGAR:/m);
  // Histórico: valores cifrados no banco, legíveis pela rota; auditoria sem conteúdo.
  const rev = ctx.DB.raw.prepare("SELECT * FROM task_revisions WHERE task_id=? AND field='script'").get(id);
  assert.ok(!rev.old_value_enc.includes("NÃO CONFIRMADO") && !rev.new_value_enc.includes("3615"));
  const h = await ctx.api(`/api/tasks/${id}/history`);
  const s = h.data.items.find((x) => x.field === "script");
  assert.equal(s.oldValue, oldScript);
  assert.equal(s.newValue, newScript);
  assert.equal(s.reason, "corrigir telefone oficial");
  assert.ok(s.changedBy && s.changedAt);
  const audit = ctx.DB.raw.prepare("SELECT new_value_json FROM audit_log WHERE action='task.updated' AND entity_id=?").get(id).new_value_json;
  assert.ok(!audit.includes("3615") && !audit.includes("NÃO CONFIRMADO"));
  // Histórico não aceita alteração.
  assert.throws(() => ctx.DB.raw.prepare("UPDATE task_revisions SET reason='trocado à mão' WHERE task_id=?").run(id));
  // Leitor não edita.
  ctx.DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('u-leitor','eag-internal','leitor@teste.invalid','Leitor','auditor_viewer')");
  ctx.env.LOCAL_USER_EMAIL = "leitor@teste.invalid";
  assert.equal((await ctx.api(`/api/tasks/${id}`, "PATCH", { expectedRevision: 2, reason: "tentativa do leitor", nextAction: "x" })).status, 403);
  ctx.env.LOCAL_USER_EMAIL = "admin@local.eag";
  // Concluída não edita.
  ctx.DB.raw.prepare("UPDATE tasks SET status='done' WHERE id=?").run(id);
  assert.equal((await ctx.api(`/api/tasks/${id}`, "PATCH", { expectedRevision: 2, reason: "depois de concluída", nextAction: "x" })).status, 409);
});

check("Tarefas: tarefa gerada de ficha aprovada não é editável (texto congelado; ficha e aprovação intactas)", async (ctx) => {
  const r = await pilot(ctx);
  await approveCalls(ctx, r);
  const t = ctx.DB.raw.prepare("SELECT id,revision,script FROM tasks WHERE ficha_id IS NOT NULL LIMIT 1").get();
  const msgs = JSON.stringify(ctx.DB.raw.prepare("SELECT body_enc FROM ficha_messages ORDER BY id").all());
  const approvals = JSON.stringify(ctx.DB.raw.prepare("SELECT * FROM ficha_approvals ORDER BY id").all());
  const res = await ctx.api(`/api/tasks/${t.id}`, "PATCH", { expectedRevision: t.revision, reason: "tentar mudar roteiro congelado", nextAction: "x" });
  assert.equal(res.status, 409);
  assert.equal(res.data.error.code, "task_frozen");
  assert.equal(ctx.DB.raw.prepare("SELECT script FROM tasks WHERE id=?").get(t.id).script, t.script);
  assert.equal(JSON.stringify(ctx.DB.raw.prepare("SELECT body_enc FROM ficha_messages ORDER BY id").all()), msgs);
  assert.equal(JSON.stringify(ctx.DB.raw.prepare("SELECT * FROM ficha_approvals ORDER BY id").all()), approvals);
});
