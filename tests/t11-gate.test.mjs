// T11-BLOQUEIO (2026-10-06): ligação (e LinkedIn manual) só fica pronta com validação T11 registrada para o escopo
// exato da tarefa (país + canal manual), com responsável, data e fundamento. Sem registro, o bloqueio "T11 pendente"
// é calculado no backend, sem mudar o estado da tarefa. Validação de outro escopo não libera. Uma validação futura
// não apaga os demais impedimentos (telefone ausente, suprimido, pausa…). Correção de dados e oposição seguem possíveis.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, DAY } from "./helpers/pilot.mjs";

const UNTIL = "2099-12-31";
const SOURCE = "site oficial da unidade, consulta 06/10/2026";
async function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  return { ctx, r: await pilot(ctx, { t11: false }) };
}
// Registro de validação como seria gravado no futuro (fixture de teste; o Compass não tem botão para isso).
function validate(ctx, scope, { decision = "validated", on = "2026-10-01", id = `v-${scope}-${decision}-${on}` } = {}) {
  ctx.DB.raw
    .prepare("INSERT INTO compliance_validations(id,tenant_id,gate,scope,decision,responsible,decided_on,basis,recorded_by,request_id) VALUES (?,'eag-internal','t11',?,?,?,?,?,'system-admin','teste')")
    .run(id, scope, decision, "Responsável fictício (teste)", on, "Documento fictício de validação para teste automatizado");
}
const listed = async (ctx) => (await ctx.api(`/api/tasks?until=${UNTIL}`)).data.items;
const blockedOf = async (ctx, id) => (await listed(ctx)).find((x) => x.id === id)?.blocked;
const level0 = (ctx, companyId, commodity, phone) =>
  ctx.api(`/api/companies/${companyId}/level0`, "POST", { commodity, phone, phoneSource: phone ? SOURCE : undefined, unitScript: "ANTES DE LIGAR: teste." });

test("Sem validação T11: ligação com telefone fica bloqueada por 'T11 pendente' e o backend recusa a conclusão", async (t) => {
  const { ctx, r } = await world(t);
  const id = (await level0(ctx, r.companyId, "corn", "+55 64 3615-9700")).data.id;
  assert.deepEqual(await blockedOf(ctx, id), ["t11_pending"]);
  const done = await ctx.api(`/api/tasks/${id}/complete`, "POST", { outcome: "done" });
  assert.equal(done.status, 409);
  assert.deepEqual(done.data.error.details.reasons, ["t11_pending"]);
  // Bloqueio calculado: a tarefa continua aberta, com telefone, roteiro e revisão.
  const row = ctx.DB.raw.prepare("SELECT status,revision,phone_hash,script FROM tasks WHERE id=?").get(id);
  assert.equal(row.status, "open");
  assert.equal(row.revision, 1);
  assert.ok(row.phone_hash && /ANTES DE LIGAR/.test(row.script));
  // Sem telefone: os dois motivos aparecem.
  const none = (await level0(ctx, r.companyId, "soy")).data.id;
  assert.deepEqual((await blockedOf(ctx, none)).sort(), ["phone_missing", "t11_pending"]);
});

test("Sem validação T11: ligações e LinkedIn gerados por ficha também ficam bloqueados", async (t) => {
  const { ctx, r } = await world(t);
  const f = (await ctx.api(`/api/fichas/${r.fichaId}`)).data;
  for (const channel of ["call", "linkedin"]) {
    const x = f.toApprove.find((a) => a.channel === channel);
    if (!x) continue;
    const res = await ctx.api(`/api/fichas/${r.fichaId}/approve`, "POST", { versionNo: f.version.no, contactId: r.dm, channel, messagesSha256: x.messagesSha256, startDate: DAY });
    assert.equal(res.status, 200, JSON.stringify(res.data));
  }
  const manual = (await listed(ctx)).filter((x) => ["call_l1", "linkedin"].includes(x.kind));
  assert.ok(manual.some((x) => x.kind === "call_l1"));
  assert.ok(manual.every((x) => x.blocked.includes("t11_pending")));
});

test("Escopo incompatível não libera: Alemanha, e-mail automático ou campanhas não liberam telefone no Brasil, e vice-versa", async (t) => {
  const { ctx, r } = await world(t);
  for (const scope of ["de_manual_phone", "br_email_automatic", "de_email_automatic", "campaigns", "br_manual_linkedin"]) validate(ctx, scope);
  const br = (await level0(ctx, r.companyId, "corn", "+55 64 3615-9700")).data.id;
  assert.deepEqual(await blockedOf(ctx, br), ["t11_pending"]);
  // Validação do Brasil não libera ligação para empresa na Alemanha.
  const ctx2 = await world(t);
  validate(ctx2.ctx, "br_manual_phone");
  const de = await ctx2.ctx.api("/api/companies", "POST", { legalName: "Kaffeerösterei Beispiel GmbH", countryCode: "DE", sourceLabel: "Registro fictício de teste" });
  const deTask = (await level0(ctx2.ctx, de.data.id, "coffee", "+49 30 1234567")).data.id;
  assert.ok((await blockedOf(ctx2.ctx, deTask)).includes("t11_pending"));
});

test("Validação compatível só tira 'T11 pendente': telefone ausente, suprimido, pausa e outros impedimentos continuam", async (t) => {
  const { ctx, r } = await world(t);
  const ready = (await level0(ctx, r.companyId, "corn", "+55 64 3615-9700")).data.id;
  const none = (await level0(ctx, r.companyId, "soy")).data.id;
  const sup = (await level0(ctx, r.companyId, "wheat", "+55 64 3615-9801")).data.id;
  await ctx.api("/api/suppression", "POST", { channel: "phone", value: "+55 64 3615-9801", reason: "opt_out" });
  // Data futura não vale ainda.
  validate(ctx, "br_manual_phone", { on: "2999-01-01" });
  assert.deepEqual(await blockedOf(ctx, ready), ["t11_pending"]);
  validate(ctx, "br_manual_phone", { on: "2026-10-01" });
  assert.deepEqual(await blockedOf(ctx, ready), []);
  assert.deepEqual(await blockedOf(ctx, none), ["phone_missing"]);
  const s = ctx.DB.raw.prepare("SELECT status,suspended_reason FROM tasks WHERE id=?").get(sup);
  assert.deepEqual({ ...s }, { status: "suspended", suspended_reason: "telefone suprimido" });
  // Reaberta à mão com o número suprimido: continua bloqueada pelo telefone.
  ctx.DB.raw.prepare("UPDATE tasks SET status='open',suspended_reason=NULL WHERE id=?").run(sup);
  assert.deepEqual(await blockedOf(ctx, sup), ["suppressed_phone"]);
  // Pausa da empresa continua valendo.
  const p = await ctx.api("/api/pauses", "POST", { scope: "company", scopeRef: r.companyId, reason: "Aguardando retorno do cliente" });
  assert.deepEqual(await blockedOf(ctx, ready), ["paused_company"]);
  await ctx.api(`/api/pauses/${p.data.id}/resume`, "POST", { reason: "Pode seguir agora" });
  // Revogação posterior volta a bloquear.
  validate(ctx, "br_manual_phone", { decision: "revoked", on: "2026-10-05" });
  assert.deepEqual(await blockedOf(ctx, ready), ["t11_pending"]);
});

test("Com 'T11 pendente' ainda é possível corrigir dados e registrar oposição; tarefa nova, editada ou reaberta segue bloqueada", async (t) => {
  const { ctx, r } = await world(t);
  const id = (await level0(ctx, r.companyId, "corn")).data.id;
  const ed = await ctx.api(`/api/tasks/${id}`, "PATCH", { expectedRevision: 1, reason: "telefone oficial da unidade", phone: "+55 64 3615-9700", phoneSource: SOURCE, nextAction: "Aguardar a T11" });
  assert.equal(ed.status, 200);
  assert.deepEqual(await blockedOf(ctx, id), ["t11_pending"]);
  const opp = await ctx.api(`/api/tasks/${id}/complete`, "POST", { outcome: "opposed", note: "Pediu para não ligarem (registro durante o bloqueio).", phoneKind: "personal" });
  assert.equal(opp.status, 200);
  assert.equal(opp.data.suppressed, true);
  ctx.DB.raw.prepare("UPDATE tasks SET status='open',done_at=NULL WHERE id=?").run(id);
  assert.deepEqual((await blockedOf(ctx, id)).sort(), ["suppressed_phone", "t11_pending"]);
});

test("Registro de validação exige responsável, data, escopo e fundamento, e não aceita alteração nem exclusão", async (t) => {
  const { ctx } = await world(t);
  const bad = (sql) => assert.throws(() => ctx.DB.raw.prepare(sql).run());
  bad("INSERT INTO compliance_validations(id,tenant_id,gate,scope,decision,responsible,decided_on,basis,recorded_by,request_id) VALUES ('x1','eag-internal','t11','all','validated','Fulano','2026-10-01','Documento de validação','u','r')");
  bad("INSERT INTO compliance_validations(id,tenant_id,gate,scope,decision,responsible,decided_on,basis,recorded_by,request_id) VALUES ('x2','eag-internal','t11','br_manual_phone','validated','','2026-10-01','Documento de validação','u','r')");
  bad("INSERT INTO compliance_validations(id,tenant_id,gate,scope,decision,responsible,decided_on,basis,recorded_by,request_id) VALUES ('x3','eag-internal','t11','br_manual_phone','validated','Fulano','01/10/2026','Documento de validação','u','r')");
  bad("INSERT INTO compliance_validations(id,tenant_id,gate,scope,decision,responsible,decided_on,basis,recorded_by,request_id) VALUES ('x4','eag-internal','t11','br_manual_phone','validated','Fulano','2026-10-01','curto','u','r')");
  validate(ctx, "br_manual_phone");
  bad("UPDATE compliance_validations SET decision='revoked'");
  bad("DELETE FROM compliance_validations");
  // Não há rota para registrar validação (sem botão que marque a T11 como validada).
  const res = await ctx.api("/api/compliance/validations", "POST", { scope: "br_manual_phone" });
  assert.equal(res.status, 404);
});
