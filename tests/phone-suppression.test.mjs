// SUPRESSAO-TELEFONE (2026-10-06): a ligação manual consulta a supressão do número que será usado (R21.2, R28.18).
// Oposição por telefone suspende as tarefas abertas com esse número, com motivo visível; formatos equivalentes
// (mesma normalização da supressão) batem, números diferentes não; concluídas e auditoria ficam intactas; a remoção
// administrativa da supressão não reativa tarefa nenhuma; a supressão de e-mail segue com o alcance de antes.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, DAY } from "./helpers/pilot.mjs";

const PHONE = "+55 (64) 3615-9700";
const SAME = "+55 64 3615-9700";
const SAME_COMPACT = "+556436159700";
const OTHER = "+55 (64) 3615-9701";
const UNTIL = "2099-12-31";

async function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  const r = await pilot(ctx);
  return { ctx, r };
}
const level0 = (ctx, r, commodity, phone) =>
  ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity, phone, unitScript: "ANTES DE LIGAR: contato real depende da T11 validada." });
const suppressPhone = (ctx, value) => ctx.api("/api/suppression", "POST", { channel: "phone", value, reason: "manual_request" });
const listed = async (ctx, status) => (await ctx.api(`/api/tasks?until=${UNTIL}${status ? `&status=${status}` : ""}`)).data.items;
const row = (ctx, id) => ctx.DB.raw.prepare("SELECT * FROM tasks WHERE id=?").get(id);
async function approveCalls(ctx, r) {
  const f = (await ctx.api(`/api/fichas/${r.fichaId}`)).data;
  const x = f.toApprove.find((a) => a.channel === "call");
  const res = await ctx.api(`/api/fichas/${r.fichaId}/approve`, "POST", { versionNo: f.version.no, contactId: r.dm, channel: "call", messagesSha256: x.messagesSha256, startDate: DAY });
  assert.equal(res.status, 200, JSON.stringify(res.data));
}

test("1 e 2: telefone suprimido impede a ligação, inclusive escrito em outro formato equivalente", async (t) => {
  const { ctx, r } = await world(t);
  assert.equal((await suppressPhone(ctx, SAME)).status, 200);
  const created = await level0(ctx, r, "corn", PHONE);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  // Criada já suspensa, com o motivo; não aparece entre as abertas e não pode ser concluída.
  const t1 = row(ctx, created.data.id);
  assert.equal(t1.status, "suspended");
  assert.equal(t1.suspended_reason, "telefone suprimido");
  assert.ok(!(await listed(ctx)).some((x) => x.id === t1.id));
  const susp = (await listed(ctx, "suspended")).find((x) => x.id === t1.id);
  assert.equal(susp.suspended_reason, "telefone suprimido");
  assert.equal((await ctx.api(`/api/tasks/${t1.id}/complete`, "POST", { outcome: "done" })).status, 409);
  // Verificação no backend mesmo se a tarefa estiver aberta (ex.: reaberta à mão): motivo visível e conclusão recusada.
  ctx.DB.raw.prepare("UPDATE tasks SET status='open',suspended_reason=NULL WHERE id=?").run(t1.id);
  const open = (await listed(ctx)).find((x) => x.id === t1.id);
  assert.deepEqual(open.blocked, ["suppressed_phone"]);
  const done = await ctx.api(`/api/tasks/${t1.id}/complete`, "POST", { outcome: "done" });
  assert.equal(done.data.error.code, "task_blocked");
  assert.deepEqual(done.data.error.details.reasons, ["suppressed_phone"]);
  // O número não fica legível no banco nem na auditoria.
  assert.match(t1.phone_hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(t1).includes("3615"));
  assert.ok(!JSON.stringify(ctx.DB.raw.prepare("SELECT * FROM audit_log").all()).includes("3615"));
});

test("2: formatos equivalentes geram o mesmo identificador; telefone sem código do país é recusado", async (t) => {
  const { ctx, r } = await world(t);
  const a = await level0(ctx, r, "corn", PHONE);
  const b = await level0(ctx, r, "soy", SAME_COMPACT);
  assert.equal(row(ctx, a.data.id).phone_hash, row(ctx, b.data.id).phone_hash);
  const bad = await level0(ctx, r, "wheat", "(64) 3615-9700");
  assert.equal(bad.status, 422);
  assert.equal(bad.data.error.code, "invalid_identifier");
});

test("3 e 4: oposição suspende a tarefa já aberta com o número; número diferente segue elegível", async (t) => {
  const { ctx, r } = await world(t);
  const hit = (await level0(ctx, r, "corn", PHONE)).data.id;
  const other = (await level0(ctx, r, "soy", OTHER)).data.id;
  const noPhone = (await level0(ctx, r, "wheat")).data.id;
  assert.deepEqual((await listed(ctx)).find((x) => x.id === hit).blocked, []);
  await suppressPhone(ctx, SAME);
  assert.equal(row(ctx, hit).status, "suspended");
  assert.equal(row(ctx, hit).suspended_reason, "telefone suprimido");
  assert.equal(row(ctx, hit).revision, 1, "suspensão não é edição do roteiro");
  for (const id of [other, noPhone]) {
    assert.equal(row(ctx, id).status, "open");
    assert.deepEqual((await listed(ctx)).find((x) => x.id === id).blocked, []);
  }
  assert.equal((await ctx.api(`/api/tasks/${other}/complete`, "POST", { outcome: "no_answer" })).status, 200);
  // Auditoria da suspensão sem o número.
  const audit = ctx.DB.raw.prepare("SELECT new_value_json FROM audit_log WHERE action='task.suspended' AND entity_id=?").get(hit);
  assert.ok(audit && !audit.new_value_json.includes("3615"));
});

test("4: trocar o telefone de uma tarefa aberta por um número suprimido a suspende; histórico guarda o número cifrado", async (t) => {
  const { ctx, r } = await world(t);
  const id = (await level0(ctx, r, "corn", OTHER)).data.id;
  await suppressPhone(ctx, PHONE);
  const res = await ctx.api(`/api/tasks/${id}`, "PATCH", { expectedRevision: 1, reason: "telefone oficial da unidade", phone: SAME });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(row(ctx, id).status, "suspended");
  const rev = ctx.DB.raw.prepare("SELECT * FROM task_revisions WHERE task_id=? AND field='phone'").get(id);
  assert.ok(rev && !rev.new_value_enc.includes("3615"));
  const h = (await ctx.api(`/api/tasks/${id}/history`)).data.items.find((x) => x.field === "phone");
  assert.equal(h.newValue, "+556436159700");
});

test("5: repetir a supressão é seguro; concluídas, auditoria e remoção administrativa não reativam nada", async (t) => {
  const { ctx, r } = await world(t);
  const finished = (await level0(ctx, r, "soy", PHONE)).data.id;
  assert.equal((await ctx.api(`/api/tasks/${finished}/complete`, "POST", { outcome: "no_answer" })).status, 200);
  const before = { ...row(ctx, finished) };
  const id = (await level0(ctx, r, "corn", PHONE)).data.id;
  const first = await suppressPhone(ctx, PHONE);
  const again = await suppressPhone(ctx, SAME_COMPACT);
  assert.equal(again.status, 200);
  assert.equal(again.data.created, false);
  assert.equal(again.data.id, first.data.id);
  const count = (action) => ctx.DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action=?").get(action).n;
  assert.equal(count("suppression.added"), 1);
  assert.equal(count("task.suspended"), 1);
  assert.equal(row(ctx, id).status, "suspended");
  // A tarefa concluída fica como estava (estado, resultado, data); a auditoria da conclusão continua lá.
  assert.deepEqual({ ...row(ctx, finished) }, before);
  assert.equal(count("task.completed"), 1);
  // Remoção administrativa: a supressão sai, a tarefa continua suspensa (nada reativa sozinho).
  const rem = await ctx.api(`/api/suppression/${first.data.id}/remove`, "POST", { reason: "Pessoa pediu para voltar a ser contatada", basis: "Pedido registrado em 06/10/2026", confirm: true });
  assert.equal(rem.status, 200);
  assert.equal(row(ctx, id).status, "suspended");
  assert.equal(row(ctx, id).suspended_reason, "telefone suprimido");
  assert.ok(!(await listed(ctx)).some((x) => x.id === id));
});

test("6: supressão de e-mail segue com o alcance de antes e não se mistura com a de telefone", async (t) => {
  const { ctx, r } = await world(t);
  await approveCalls(ctx, r);
  const phoneTask = (await level0(ctx, r, "corn", PHONE)).data.id;
  await ctx.api("/api/suppression", "POST", { channel: "email", value: "compras@valeverde.com.br", reason: "opt_out" });
  const items = await listed(ctx);
  const fromFicha = items.filter((x) => x.kind === "call_l1");
  assert.ok(fromFicha.length > 0);
  assert.ok(fromFicha.every((x) => x.blocked.includes("suppressed")), "ligação ao contato com e-mail suprimido continua bloqueada");
  assert.deepEqual(items.find((x) => x.id === phoneTask).blocked, [], "e-mail suprimido não bloqueia telefone de outra tarefa");
  await suppressPhone(ctx, OTHER);
  assert.equal(row(ctx, phoneTask).status, "open", "outro telefone suprimido não afeta este");
  assert.ok((await listed(ctx)).filter((x) => x.kind === "call_l1").every((x) => !x.blocked.includes("suppressed_phone")));
});
