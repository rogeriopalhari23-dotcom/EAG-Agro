// G1 e G3 (decisão de retenção de Rogério Palhari em 08/10/2026). Só dados fictícios.
// G1: políticas A1–D1 registradas; revisão anual com histórico e lembrete; registrar revisão nunca libera contato.
// G3 (C1): descarte elimina os dados pessoais da empresa sem criar supressão; terceiros e conteúdo compartilhado
// ficam; repetir não muda nada; falha parcial não marca o descarte; restauração do banco é reaplicada pelo R2.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { setup } from "./helpers/db.mjs";
import { pilot, transport, at } from "./helpers/pilot.mjs";
import { memoryR2 } from "./helpers/trade.mjs";
import { tick } from "../src/sending.js";
import { encryptPii, decryptPii } from "../src/crypto.js";
import { nameHash } from "../src/people.js";
import { isSuppressed } from "../src/operations.js";
import { retentionReviewStatus } from "../src/retention.js";
import { erasuresConsistent, PURGED } from "../src/erasure.js";

const SITE = "https://valeverde.exemplo.invalid";
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(() => ctx.close());
    await fn(ctx);
  });
}

// ---------- G1 ----------
check("G1: as quatro escolhas e os avisos estão registrados com texto, responsável e data; revisão vence 12 meses depois", async (ctx) => {
  const r = await ctx.api("/api/retention");
  assert.equal(r.status, 200);
  const by = Object.fromEntries(r.data.policies.map((p) => [p.item, p]));
  assert.deepEqual(Object.keys(by).sort(), ["A", "B", "C", "D", "N"]);
  assert.deepEqual(["A", "B", "C", "D", "N"].map((k) => by[k].option_code), ["A1", "B1", "C1", "D1", "A1"]);
  for (const p of r.data.policies) {
    assert.equal(p.decided_by, "Rogério Palhari");
    assert.equal(p.decided_on, "2026-10-08");
    assert.ok(p.option_text.length > 20 && p.covers && p.criterion && p.review && p.end_action);
  }
  assert.match(by.A.option_text, /^Sem prazo fixo enquanto houver prospecção no canal; revisão registrada a cada 12 meses/);
  assert.equal(r.data.status.due, "2027-10-08");
  // Lembrete: a partir de 30 dias antes; atraso depois do vencimento.
  const st = (d) => retentionReviewStatus(ctx.env, "eag-internal", d);
  assert.deepEqual([(await st("2027-09-07")).remind, (await st("2027-09-08")).remind, (await st("2027-10-09")).overdue], [false, true, true]);
  assert.equal((await st("2027-01-01")).overdue, false);
  // Políticas só de inclusão.
  assert.throws(() => ctx.DB.raw.prepare("UPDATE retention_policies SET option_code='A2'").run());
  assert.throws(() => ctx.DB.raw.prepare("DELETE FROM retention_policies").run());
  // O Início recebe a situação da revisão.
  const dash = await ctx.api("/api/dashboard");
  assert.equal(dash.data.retentionReview.due, "2027-10-08");
  assert.equal(dash.data.retentionReview.policy, "A1");
});

check("G1: registrar revisão (manter ou avaliar eliminação) não expira, não remove e não libera supressão nem ligação", async (ctx) => {
  const r = await pilot(ctx, { t11: false });
  await ctx.api("/api/suppression", "POST", { channel: "phone", value: "+55 64 3615-9700", reason: "opt_out" });
  await ctx.api("/api/suppression", "POST", { channel: "email", value: "outra@exemplo.invalid", reason: "opt_out" });
  const task = (await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: "corn", phone: "+55 64 3615-9700", phoneSource: "site, teste" })).data.id;
  const sup = JSON.stringify(ctx.DB.raw.prepare("SELECT * FROM suppression_entries ORDER BY id").all());
  const taskBefore = { ...ctx.DB.raw.prepare("SELECT status,suspended_reason FROM tasks WHERE id=?").get(task) };
  const today = new Date().toISOString().slice(0, 10);
  for (const decision of ["keep", "elimination_to_assess"]) {
    const res = await ctx.api("/api/retention/reviews", "POST", { reviewedOn: today, responsible: "Rogério Palhari", decision, basis: "Revisão fictícia de teste da lista de supressão" });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    if (decision === "elimination_to_assess") assert.match(res.data.note, /Nada foi removido/);
  }
  assert.equal(JSON.stringify(ctx.DB.raw.prepare("SELECT * FROM suppression_entries ORDER BY id").all()), sup, "supressões intactas");
  assert.equal(await isSuppressed(ctx.env, "eag-internal", "phone", "+556436159700"), true);
  assert.deepEqual({ ...ctx.DB.raw.prepare("SELECT status,suspended_reason FROM tasks WHERE id=?").get(task) }, taskBefore);
  const ov = (await ctx.api("/api/retention")).data;
  assert.equal(ov.reviews.length, 2);
  assert.equal(ov.reviews[0].responsible, "Rogério Palhari");
  const base = today > "2026-10-08" ? today : "2026-10-08";
  assert.equal(ov.status.due, `${Number(base.slice(0, 4)) + 1}${base.slice(4)}`);
  // Recusas: data futura, sem fundamento, perfil não Administrador; histórico imutável.
  assert.equal((await ctx.api("/api/retention/reviews", "POST", { reviewedOn: "2999-01-01", responsible: "Rogério Palhari", decision: "keep", basis: "Revisão fictícia de teste" })).status, 422);
  assert.equal((await ctx.api("/api/retention/reviews", "POST", { reviewedOn: today, responsible: "Rogério Palhari", decision: "keep", basis: "curto" })).status, 422);
  assert.throws(() => ctx.DB.raw.prepare("UPDATE retention_reviews SET decision='keep'").run());
  assert.throws(() => ctx.DB.raw.prepare("DELETE FROM retention_reviews").run());
  ctx.DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('u-gerente','eag-internal','gerente@teste.invalid','Gerente','commercial_manager')");
  ctx.env.LOCAL_USER_EMAIL = "gerente@teste.invalid";
  assert.equal((await ctx.api("/api/retention/reviews", "POST", { reviewedOn: today, responsible: "Gerente", decision: "keep", basis: "Revisão fictícia de teste" })).status, 403);
});

// ---------- G3 ----------
async function company(ctx) {
  ctx.env.FILES = memoryR2();
  const r = await pilot(ctx, { email: "compras@valeverde.com.br", phone: "+55 16 99999-0000" });
  const DB = ctx.DB.raw;
  DB.prepare("UPDATE companies SET website=? WHERE id=?").run(SITE, r.companyId);
  const joao = (await ctx.api(`/api/companies/${r.companyId}/contacts`, "POST", { fullName: "João Lima", email: "joao@valeverde.com.br", jobTitle: "Gerente", prospectRole: "influencer", sourceLabel: "site" })).data.id;
  // Canal geral da empresa (dado da empresa): fica.
  DB.prepare("INSERT INTO contacts(id,tenant_id,company_id,full_name_encrypted,email_encrypted,source_label,created_by,prospect_role,contact_kind) VALUES ('ch-geral','eag-internal',?,?,?,'site','teste','other','company_channel')").run(r.companyId, await encryptPii("Canal geral", ctx.env), await encryptPii("contato@valeverde.exemplo.invalid", ctx.env));
  // Pessoa de compras sem contato (a validar).
  DB.prepare(
    `INSERT INTO person_candidates(id,tenant_id,company_id,name_encrypted,name_hash,title_encrypted,role_suggestion,relevance,source_kind,source_url,verified_at,refresh_after,phone_encrypted,status,created_by)
     VALUES ('pc-ana','eag-internal',?,?,?,?,'decision_maker','Ana Prado, compradora desde 2020','manual',?,'2099-01-01','2099-07-01',?,'to_validate','teste')`,
  ).run(r.companyId, await encryptPii("Ana Prado", ctx.env), await nameHash(ctx.env, "eag-internal", r.companyId, "Ana Prado"), await encryptPii("Compras", ctx.env), `${SITE}/equipe`, await encryptPii("+55 16 98888-0000", ctx.env));
  // Ligação de nível 0 com roteiro, telefone e histórico de edição.
  const l0 = (await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: "corn", phone: "+55 16 3333-4444", phoneSource: "site, teste", unitScript: "ANTES DE LIGAR: pedir a Ana Prado." })).data.id;
  await ctx.api(`/api/tasks/${l0}`, "PATCH", { expectedRevision: 1, reason: "nota fictícia de teste", nextAction: "Falar com Ana Prado" });
  // Aviso legal em cache (lista pessoas da empresa) e aviso D-EXC (sem identidade).
  DB.prepare("INSERT INTO research_cache(source,external_id,url,checked_at,refresh_after,result_json) VALUES ('impressum',?,?,'2099-01-01','2099-07-01',?)").run(SITE, `${SITE}/impressum`, await encryptPii(JSON.stringify({ people: [{ name: "Ana Prado" }] }), ctx.env));
  DB.prepare("INSERT INTO company_notices(id,tenant_id,company_id,kind,classification,source_kind,reason,pending,created_by,request_id) VALUES ('nt-1','eag-internal',?,'erasure_shared_phone','shared','company_site','classified_shared',0,'teste','t')").run(r.companyId);
  // Terceiro de outra empresa (não pode ser alcançado).
  const other = (await ctx.api("/api/companies", "POST", { legalName: "Outra Indústria Fictícia Ltda.", countryCode: "BR", sourceLabel: "teste" })).data.id;
  const otherContact = (await ctx.api(`/api/companies/${other}/contacts`, "POST", { fullName: "Ana Prado", email: "ana@outra.exemplo.invalid", prospectRole: "decision_maker", sourceLabel: "site" })).data.id;
  return { r, DB, joao, l0, other, otherContact };
}
const discard = (ctx, id, reason = "Fora do perfil após visita (fictício)") => ctx.api(`/api/companies/${id}/discard`, "POST", { reason });
const row = (DB, table, id) => ({ ...DB.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id) });

check("G3: descarte elimina os dados pessoais da empresa, sem supressão; mantém empresa, motivo, data, canal geral, avisos e terceiros", async (ctx) => {
  const w = await company(ctx);
  const otherBefore = row(w.DB, "contacts", w.otherContact);
  const supBefore = w.DB.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n;
  const res = await discard(ctx, w.r.companyId);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.deepEqual([res.data.status, res.data.contactsPurged, res.data.suppressionsCreated], ["inactive", 2, 0]);
  assert.equal(w.DB.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n, supBefore, "descarte não cria supressão");
  for (const id of [w.r.dm, w.joao]) {
    const c = row(w.DB, "contacts", id);
    assert.deepEqual([c.full_name_encrypted, c.job_title_encrypted, c.email_encrypted, c.phone_encrypted, c.email_hash, c.source_url], [null, null, null, null, null, null]);
    assert.match(c.source_label, /dados excluídos no descarte da empresa/);
  }
  // Canal geral da empresa e terceiro de outra empresa intactos.
  assert.equal(await decryptPii(row(w.DB, "contacts", "ch-geral").email_encrypted, ctx.env), "contato@valeverde.exemplo.invalid");
  assert.deepEqual(row(w.DB, "contacts", w.otherContact), otherBefore);
  // Pessoas de compras (com e sem contato), tarefas, histórico, fichas e aviso legal.
  for (const p of w.DB.prepare("SELECT * FROM person_candidates WHERE company_id=?").all(w.r.companyId)) {
    assert.match(p.name_hash, /^purged:/);
    assert.equal(p.relevance, PURGED);
    assert.equal(await decryptPii(p.name_encrypted, ctx.env), PURGED);
    assert.deepEqual([p.phone_encrypted, p.title_encrypted, p.status], [null, null, "dismissed"]);
  }
  const t = row(w.DB, "tasks", w.l0);
  assert.deepEqual([t.status, t.script, t.next_action, t.channel_note, t.phone_hash, t.phone_enc, t.phone_source, t.result_json], ["cancelled", null, null, null, null, null, null, null]);
  assert.equal(w.DB.prepare("SELECT COUNT(*) n FROM task_revisions WHERE task_id=?").get(w.l0).n, 0);
  assert.ok(w.DB.prepare("SELECT COUNT(*) n FROM ficha_messages m JOIN ficha_versions v ON v.id=m.version_id JOIN fichas f ON f.id=v.ficha_id WHERE f.company_id=? AND m.purged_at IS NULL").get(w.r.companyId).n === 0);
  assert.equal(w.DB.prepare("SELECT COUNT(*) n FROM research_cache WHERE external_id=?").get(SITE).n, 0, "cache não compartilhado sai");
  // Empresa, motivo e data ficam; aviso D-EXC fica; registro do descarte e marcador sem textos pessoais.
  const co = row(w.DB, "companies", w.r.companyId);
  assert.deepEqual([co.legal_name, co.pipeline_status], ["Doces Vale Verde Ltda.", "inactive"]);
  assert.match(w.DB.prepare("SELECT status_reason FROM fichas WHERE company_id=?").get(w.r.companyId).status_reason, /Fora do perfil/);
  assert.match(w.DB.prepare("SELECT new_value_json FROM audit_log WHERE action='company.discarded'").get().new_value_json, /Fora do perfil/);
  assert.equal(w.DB.prepare("SELECT COUNT(*) n FROM company_notices WHERE company_id=?").get(w.r.companyId).n, 1);
  const led = w.DB.prepare("SELECT * FROM company_discard_ledger WHERE company_id=?").get(w.r.companyId);
  assert.ok(led && led.discarded_at);
  const markerText = await ctx.env.FILES.get(`discards/eag-internal/${w.r.companyId}.json`).then((o) => o.text());
  assert.deepEqual(Object.keys(JSON.parse(markerText)).sort(), ["companyId", "discardedAt", "requestId"]);
  assert.ok(!/Ana|Maria|João|valeverde\.com|Fora do perfil/.test(markerText), "marcador sem textos pessoais nem motivo");
  // Auditoria sem dados pessoais.
  assert.ok(!/Ana Prado|Maria Souza|João Lima|99999-0000/.test(JSON.stringify(w.DB.prepare("SELECT new_value_json FROM audit_log WHERE action IN ('company.discarded','contact.personal_data_deleted')").all())));
  // Repetir: nada muda, nada é auditado de novo.
  const audits = w.DB.prepare("SELECT COUNT(*) n FROM audit_log").get().n;
  const again = await discard(ctx, w.r.companyId);
  assert.equal(again.status, 200);
  assert.equal(again.data.already, true);
  assert.equal(w.DB.prepare("SELECT COUNT(*) n FROM audit_log").get().n, audits);
  assert.equal(await ctx.env.FILES.get(`discards/eag-internal/${w.r.companyId}.json`).then((o) => o.text()), markerText);
});

check("G3: aviso legal compartilhado com outra empresa ativa (mesmo site) não é apagado; os dados dela ficam", async (ctx) => {
  const w = await company(ctx);
  w.DB.prepare("UPDATE companies SET website=? WHERE id=?").run(`${SITE}/outra-unidade`, w.other);
  const res = await discard(ctx, w.r.companyId);
  assert.equal(res.status, 200);
  assert.deepEqual([res.data.impressumShared, res.data.impressumPurged], [true, false]);
  assert.equal(w.DB.prepare("SELECT COUNT(*) n FROM research_cache WHERE external_id=?").get(SITE).n, 1);
  assert.ok(row(w.DB, "contacts", w.otherContact).full_name_encrypted);
});

check("G3: falha no meio da eliminação não marca o descarte; envio fica travado; repetir conclui com a data original", async (ctx) => {
  const w = await company(ctx);
  const orig = ctx.DB.batch.bind(ctx.DB);
  let n = 0;
  ctx.DB.batch = async (st) => {
    if (st.some((x) => /UPDATE contacts SET full_name_encrypted=NULL/.test(x.sql)) && ++n === 2) throw new Error("falha simulada no banco");
    return orig(st);
  };
  const res = await discard(ctx, w.r.companyId);
  assert.ok(res.status >= 500, JSON.stringify(res.data));
  ctx.DB.batch = orig;
  assert.equal(row(w.DB, "companies", w.r.companyId).pipeline_status === "inactive", false, "descarte não aparece como concluído");
  assert.equal(w.DB.prepare("SELECT COUNT(*) n FROM company_discard_ledger").get().n, 0);
  assert.equal(await erasuresConsistent(ctx.env, "eag-internal"), false, "marcador no R2 sem conclusão trava envio e aprovação");
  assert.equal((await tick(ctx.env, "eag-internal", { transport: transport(), now: at(15) })).reason, "erasure_reapply_required");
  const marker = JSON.parse(await ctx.env.FILES.get(`discards/eag-internal/${w.r.companyId}.json`).then((o) => o.text()));
  const retry = await discard(ctx, w.r.companyId);
  assert.equal(retry.status, 200, JSON.stringify(retry.data));
  assert.equal(row(w.DB, "companies", w.r.companyId).pipeline_status, "inactive");
  assert.equal(w.DB.prepare("SELECT discarded_at FROM company_discard_ledger WHERE company_id=?").get(w.r.companyId).discarded_at, marker.discardedAt);
  assert.equal(await erasuresConsistent(ctx.env, "eag-internal"), true);
  for (const id of [w.r.dm, w.joao]) assert.equal(row(w.DB, "contacts", id).full_name_encrypted, null);
});

check("G3: restauração do banco para antes do descarte trava envio até a reaplicação, que refaz a eliminação", async (ctx) => {
  const w = await company(ctx);
  const file = join(tmpdir(), `eag-descarte-${process.pid}-${Date.now()}.sqlite`);
  try {
    ctx.DB.raw.exec(`VACUUM INTO '${file.replace(/\\/g, "/")}'`);
    assert.equal((await discard(ctx, w.r.companyId)).status, 200);
    ctx.DB.raw.close();
    ctx.DB.raw = new DatabaseSync(file);
    ctx.DB.raw.exec("PRAGMA foreign_keys=ON");
    const DB = ctx.DB.raw;
    assert.ok(row(DB, "contacts", w.r.dm).full_name_encrypted, "dado voltou com a restauração");
    assert.equal((await tick(ctx.env, "eag-internal", { transport: transport(), now: at(15) })).reason, "erasure_reapply_required");
    const re = await ctx.api("/api/erasures/reapply", "POST", {});
    assert.equal(re.status, 200, JSON.stringify(re.data));
    assert.equal(re.data.consistent, true);
    assert.ok(re.data.items.some((x) => x.companyId === w.r.companyId));
    assert.equal(row(DB, "companies", w.r.companyId).pipeline_status, "inactive");
    for (const id of [w.r.dm, w.joao]) assert.equal(row(DB, "contacts", id).full_name_encrypted, null);
    assert.match(DB.prepare("SELECT name_hash FROM person_candidates WHERE id='pc-ana'").get().name_hash, /^purged:/);
    assert.ok(DB.prepare("SELECT reapplied_at FROM company_discard_ledger WHERE company_id=?").get(w.r.companyId).reapplied_at);
    assert.equal(DB.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='company.discard_reapplied'").get().n, 1);
    assert.equal(DB.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n, 0, "reaplicação também não cria supressão");
    assert.equal((await ctx.api("/api/erasures/reapply", "POST", {})).data.reapplied, 0);
  } finally {
    ctx.DB.raw.close();
    ctx.DB.raw = new DatabaseSync(":memory:");
    rmSync(file, { force: true });
  }
});
