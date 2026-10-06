// SUPRESSAO-TELEFONE, parte 2 (2026-10-06): toda ligação identifica o número que será usado.
// - Ligação gerada por ficha leva o telefone do destinatário, com a fonte; sem número, com formato sem código do país ou
//   com números divergentes entre as fontes, fica pendente (nunca escolhe sozinha) e não aparece como pronta.
// - Ligação antiga (sem telefone) fica pendente até alguém definir o número.
// - Oposição registrada na ligação grava o resultado da conversa e a supressão juntos, mesmo com a tarefa suspensa,
//   e impede novas abordagens ao número.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, DAY } from "./helpers/pilot.mjs";
import { isSuppressed } from "../src/operations.js";

const UNTIL = "2099-12-31";
const SOURCE = "site oficial da unidade, consulta 06/10/2026";
async function world(t, opts) {
  const ctx = setup();
  t.after(ctx.close);
  return { ctx, r: await pilot(ctx, opts) };
}
async function approveCalls(ctx, r) {
  const f = (await ctx.api(`/api/fichas/${r.fichaId}`)).data;
  const x = f.toApprove.find((a) => a.channel === "call");
  const res = await ctx.api(`/api/fichas/${r.fichaId}/approve`, "POST", { versionNo: f.version.no, contactId: r.dm, channel: "call", messagesSha256: x.messagesSha256, startDate: DAY });
  assert.equal(res.status, 200, JSON.stringify(res.data));
}
const listed = async (ctx, status) => (await ctx.api(`/api/tasks?until=${UNTIL}${status ? `&status=${status}` : ""}`)).data.items;
const row = (ctx, id) => ctx.DB.raw.prepare("SELECT * FROM tasks WHERE id=?").get(id);
const calls = (ctx) => ctx.DB.raw.prepare("SELECT * FROM tasks WHERE kind='call_l1' ORDER BY due_date").all();
// Pessoa de compras vinculada ao destinatário, com telefone publicado (fonte própria).
async function linkPerson(ctx, r, phone) {
  const p = await ctx.api(`/api/companies/${r.companyId}/people`, "POST", {
    name: "Maria Souza", title: "Compradora", sourceKind: "company_site", sourceUrl: "https://valeverde.example/equipe", relevance: "Compras de açúcar", phone, phoneSourceUrl: "https://valeverde.example/contato",
  });
  assert.equal(p.status, 201, JSON.stringify(p.data));
  ctx.DB.raw.prepare("UPDATE person_candidates SET contact_id=?,status='accepted' WHERE id=?").run(r.dm, p.data.id);
}

test("Ficha: a ligação leva o telefone do destinatário com a fonte e fica pronta", async (t) => {
  const { ctx, r } = await world(t);
  await approveCalls(ctx, r);
  const rows = calls(ctx);
  assert.ok(rows.length > 0);
  for (const x of rows) {
    assert.match(x.phone_hash, /^[0-9a-f]{64}$/);
    assert.equal(x.phone_issue, null);
    assert.match(x.phone_source, /^contato \(/);
    assert.ok(!x.phone_source.includes("3333"), "a fonte não repete o número");
  }
  const item = (await listed(ctx)).find((x) => x.kind === "call_l1");
  assert.equal(item.phone, "+551633334444");
  assert.deepEqual(item.blocked, []);
});

test("Ficha: destinatário sem telefone gera ligação pendente; o número é definido na tarefa, com fonte, sem mexer no roteiro", async (t) => {
  const { ctx, r } = await world(t, { phone: null });
  await approveCalls(ctx, r);
  const [first] = calls(ctx);
  assert.equal(first.phone_issue, "missing");
  const item = (await listed(ctx)).find((x) => x.id === first.id);
  assert.deepEqual(item.blocked, ["phone_missing"]);
  const done = await ctx.api(`/api/tasks/${first.id}/complete`, "POST", { outcome: "done" });
  assert.equal(done.data.error.code, "task_blocked");
  assert.deepEqual(done.data.error.details.reasons, ["phone_missing"]);
  // Roteiro de ficha segue congelado; só o telefone (com fonte) pode ser definido.
  const frozen = await ctx.api(`/api/tasks/${first.id}`, "PATCH", { expectedRevision: 1, reason: "tentar mudar o roteiro", nextAction: "x" });
  assert.equal(frozen.data.error.code, "task_frozen");
  const noSource = await ctx.api(`/api/tasks/${first.id}`, "PATCH", { expectedRevision: 1, reason: "telefone da recepção", phone: "+55 16 3333-4444" });
  assert.equal(noSource.data.error.code, "phone_source_required");
  const ok = await ctx.api(`/api/tasks/${first.id}`, "PATCH", { expectedRevision: 1, reason: "telefone da recepção", phone: "+55 16 3333-4444", phoneSource: SOURCE });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const after = row(ctx, first.id);
  assert.equal(after.script, first.script);
  assert.equal(after.phone_issue, null);
  assert.equal(after.phone_source, SOURCE);
  assert.deepEqual((await listed(ctx)).find((x) => x.id === first.id).blocked, []);
  const h = (await ctx.api(`/api/tasks/${first.id}/history`)).data.items;
  assert.deepEqual(h.map((x) => x.field).sort(), ["phone", "phone_source"]);
});

test("Ficha: telefones divergentes entre as fontes ficam pendentes, sem escolha automática", async (t) => {
  const { ctx, r } = await world(t);
  await linkPerson(ctx, r, "+55 16 3333-9999");
  await approveCalls(ctx, r);
  const [first] = calls(ctx);
  assert.equal(first.phone_hash, null);
  assert.equal(first.phone_enc, null);
  assert.equal(first.phone_issue, "ambiguous");
  assert.match(first.phone_source, /2 números diferentes: contato .*; pessoa de compras \(https:\/\/valeverde\.example\/contato\)/);
  assert.deepEqual((await listed(ctx)).find((x) => x.id === first.id).blocked, ["phone_ambiguous"]);
});

test("Ficha: o mesmo número em formatos diferentes não é divergência; formato sem código do país fica pendente", async (t) => {
  {
    const { ctx, r } = await world(t);
    await linkPerson(ctx, r, "+551633334444");
    await approveCalls(ctx, r);
    const [first] = calls(ctx);
    assert.equal(first.phone_issue, null);
    assert.match(first.phone_source, /contato .*; pessoa de compras/);
  }
  {
    const { ctx, r } = await world(t, { phone: "(16) 3333-4444" });
    await approveCalls(ctx, r);
    const [first] = calls(ctx);
    assert.equal(first.phone_issue, "unrecognized");
    assert.deepEqual((await listed(ctx)).find((x) => x.id === first.id).blocked, ["phone_unrecognized"]);
  }
});

test("Ficha: telefone do destinatário já suprimido cria as ligações suspensas, com o motivo", async (t) => {
  const { ctx, r } = await world(t);
  await ctx.api("/api/suppression", "POST", { channel: "phone", value: "+55 16 3333-4444", reason: "opt_out" });
  await approveCalls(ctx, r);
  assert.ok(calls(ctx).every((x) => x.status === "suspended" && x.suspended_reason === "telefone suprimido"));
  assert.ok((await listed(ctx, "suspended")).some((x) => x.kind === "call_l1"));
});

test("Ligação antiga sem telefone: pendente, não conclui; definir o número com fonte a libera e preserva id e roteiro", async (t) => {
  const { ctx, r } = await world(t);
  // Linha como as criadas antes da migração 0034 (sem colunas de telefone preenchidas).
  ctx.DB.raw.prepare("INSERT INTO tasks(id,tenant_id,company_id,commodity,kind,owner_id,due_date,priority,script) VALUES ('t-antiga','eag-internal',?,'corn','call_l0','system-admin','2099-01-05',0,'ANTES DE LIGAR: teste')").run(r.companyId);
  const item = (await listed(ctx)).find((x) => x.id === "t-antiga");
  assert.deepEqual(item.blocked, ["phone_missing"]);
  assert.equal(item.phone, null);
  assert.equal((await ctx.api("/api/tasks/t-antiga/complete", "POST", { outcome: "done" })).data.error.code, "task_blocked");
  const ok = await ctx.api("/api/tasks/t-antiga", "PATCH", { expectedRevision: 1, reason: "telefone oficial da unidade", phone: "+55 64 3615-9700", phoneSource: SOURCE });
  assert.equal(ok.status, 200);
  const after = row(ctx, "t-antiga");
  assert.equal(after.script, "ANTES DE LIGAR: teste");
  assert.equal(after.revision, 2);
  assert.deepEqual((await listed(ctx)).find((x) => x.id === "t-antiga").blocked, []);
});

test("Oposição: grava o resultado e a supressão juntos, suspende as outras ligações ao número e impede nova abordagem", async (t) => {
  const { ctx, r } = await world(t);
  const mk = (commodity) => ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity, phone: "+55 64 3615-9700", phoneSource: SOURCE });
  const a = (await mk("corn")).data.id;
  const b = (await mk("soy")).data.id;
  const note = "Atendente pediu para não ligarem mais para este número.";
  const res = await ctx.api(`/api/tasks/${a}/complete`, "POST", { outcome: "opposed", note });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.suppressed, true);
  assert.equal(res.data.tasksSuspended, 1);
  const done = row(ctx, a);
  assert.equal(done.status, "done");
  const result = JSON.parse(done.result_json);
  assert.equal(result.outcome, "opposed");
  assert.equal(result.note, note);
  assert.equal(result.suppressed, true);
  assert.equal(await isSuppressed(ctx.env, "eag-internal", "phone", "+556436159700"), true);
  assert.equal(row(ctx, b).status, "suspended");
  // Nova abordagem ao mesmo número já nasce suspensa.
  const c = await mk("wheat");
  assert.equal(c.data.suspended, true);
  const audit = JSON.stringify(ctx.DB.raw.prepare("SELECT * FROM audit_log WHERE action IN ('suppression.added','task.suspended','task.completed')").all());
  assert.ok(!audit.includes("3615") && !audit.includes("Atendente"), "auditoria sem número nem nota");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='suppression.added'").get().n, 1);
});

test("Oposição em ligação já suspensa pela supressão: o resultado da conversa é salvo; resultado comum continua recusado", async (t) => {
  const { ctx, r } = await world(t);
  const id = (await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: "corn", phone: "+55 64 3615-9700", phoneSource: SOURCE })).data.id;
  await ctx.api("/api/suppression", "POST", { channel: "phone", value: "+55 64 3615-9700", reason: "opt_out" });
  assert.equal(row(ctx, id).status, "suspended");
  assert.equal((await ctx.api(`/api/tasks/${id}/complete`, "POST", { outcome: "done" })).status, 409);
  const res = await ctx.api(`/api/tasks/${id}/complete`, "POST", { outcome: "opposed", note: "Disse que não quer contato." });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(row(ctx, id).result_json).note, "Disse que não quer contato.");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM suppression_entries WHERE channel='phone'").get().n, 1, "supressão não duplica");
  // Concluída não é registrada de novo.
  assert.equal((await ctx.api(`/api/tasks/${id}/complete`, "POST", { outcome: "opposed" })).status, 409);
});

test("Oposição em ligação sem telefone: o resultado é salvo e a resposta avisa que não houve supressão; LinkedIn não aceita", async (t) => {
  const { ctx, r } = await world(t);
  const id = (await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: "corn" })).data.id;
  const res = await ctx.api(`/api/tasks/${id}/complete`, "POST", { outcome: "opposed", note: "Não quer contato." });
  assert.equal(res.status, 200);
  assert.equal(res.data.suppressed, false);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n, 0);
  ctx.DB.raw.prepare("INSERT INTO tasks(id,tenant_id,company_id,kind,owner_id,due_date) VALUES ('t-li','eag-internal',?,'linkedin','system-admin','2099-01-05')").run(r.companyId);
  assert.equal((await ctx.api("/api/tasks/t-li/complete", "POST", { outcome: "opposed" })).data.error.code, "opposition_call_only");
});
