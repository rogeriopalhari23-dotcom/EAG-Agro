// D-EXC (aprovada por Rogério em 08/10/2026, opção a): telefone depois de exclusão ou oposição.
// Pessoal ou ramal com discagem direta → supressão pelo fluxo existente. Número geral, ramal atrás do geral, dúvida ou
// conflito → nada suprimido; aviso na empresa sem identidade (pendência quando não confirmado). Só dados fictícios.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot } from "./helpers/pilot.mjs";
import { memoryR2 } from "./helpers/trade.mjs";
import { encryptPii, decryptPii } from "../src/crypto.js";
import { nameHash } from "../src/people.js";
import { isSuppressed } from "../src/operations.js";
import { PURGED } from "../src/erasure.js";

const GERAL = "+55 16 3333-4444";
const PESSOAL = "+55 16 99999-0000";
const DIRETO = "+55 16 3333-4421";
const SRC = "https://valeverde.exemplo.invalid/contato";

async function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  ctx.env.FILES = memoryR2();
  const r = await pilot(ctx, { email: "compras@valeverde.com.br", phone: GERAL });
  const DB = ctx.DB.raw;
  // João: terceiro da mesma empresa, com o mesmo número geral.
  const joao = (await ctx.api(`/api/companies/${r.companyId}/contacts`, "POST", { fullName: "João Lima", email: "joao@valeverde.com.br", phone: GERAL, prospectRole: "influencer", sourceLabel: "site" })).data.id;
  // Ligação de nível 0 da empresa pelo número geral (contato da empresa, não da pessoa).
  const l0 = (await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: "corn", phone: GERAL, phoneSource: SRC })).data.id;
  // Supressões existentes (de outras pessoas) que não podem mudar.
  await ctx.api("/api/suppression", "POST", { channel: "email", value: "outra@exemplo.invalid", reason: "opt_out" });
  await ctx.api("/api/suppression", "POST", { channel: "phone", value: "+55 11 2222-0000", reason: "opt_out" });
  const supBefore = JSON.stringify(DB.prepare("SELECT * FROM suppression_entries ORDER BY id").all());
  const setPhone = async (contactId, phone) => DB.prepare("UPDATE contacts SET phone_encrypted=? WHERE id=?").run(await encryptPii(phone, ctx.env), contactId);
  const erase = (body = {}) => ctx.api(`/api/contacts/${r.dm}/delete-personal-data`, "POST", { legalBasis: "Pedido fictício do titular", ...body });
  const notices = () => DB.prepare("SELECT * FROM company_notices ORDER BY created_at,rowid").all();
  const supRows = () => DB.prepare("SELECT * FROM suppression_entries ORDER BY id").all();
  const existingIntact = () => {
    const now = supRows().filter((x) => JSON.parse(supBefore).some((b) => b.id === x.id));
    assert.equal(JSON.stringify(now), supBefore, "supressões existentes preservadas");
  };
  const task = (id) => DB.prepare("SELECT status,phone_hash,phone_enc FROM tasks WHERE id=?").get(id);
  return { ctx, r, DB, joao, l0, setPhone, erase, notices, supRows, existingIntact, task };
}
const noIdentity = (ctxDB, rows, hashOfName) => {
  const txt = JSON.stringify(rows);
  assert.ok(!/Maria|Souza|compras@valeverde/.test(txt), "aviso sem nome nem e-mail");
  assert.ok(!txt.includes(hashOfName), "aviso sem hash do nome");
  assert.ok(!txt.includes(PURGED), "aviso sem texto excluído");
};

test("Telefone pessoal comprovado: suprime o número normalizado; número geral e terceiros intactos; supressões existentes preservadas", async (t) => {
  const w = await world(t);
  await w.setPhone(w.r.dm, PESSOAL);
  const res = await w.erase({ phones: [{ phone: "+5516999990000", kind: "personal", sourceKind: "company_site", sourceUrl: SRC }] });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.phonesSuppressed, 1);
  assert.equal(res.data.phoneNotices, 0);
  assert.equal(await isSuppressed(w.ctx.env, "eag-internal", "phone", PESSOAL), true);
  assert.equal(await isSuppressed(w.ctx.env, "eag-internal", "phone", GERAL), false);
  w.existingIntact();
  assert.equal(w.task(w.l0).status, "open");
  assert.equal(await decryptPii(w.DB.prepare("SELECT phone_encrypted FROM contacts WHERE id=?").get(w.joao).phone_encrypted, w.ctx.env), GERAL);
  // Nova ligação ao número pessoal já nasce suspensa.
  const again = await w.ctx.api(`/api/companies/${w.r.companyId}/level0`, "POST", { commodity: "soy", phone: PESSOAL, phoneSource: SRC });
  assert.equal(again.data.suspended, true);
  assert.equal(w.notices().length, 0);
});

test("Número geral compartilhado: não suprime; vínculo pessoal sai; aviso na empresa sem identidade; terceiros e ligação da empresa intactos", async (t) => {
  const w = await world(t);
  const hn = await nameHash(w.ctx.env, "eag-internal", w.r.companyId, "Maria Souza");
  const res = await w.erase({ phones: [{ phone: GERAL, kind: "shared", sourceKind: "company_site", sourceUrl: SRC }] });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.deepEqual([res.data.phonesSuppressed, res.data.phoneNotices, res.data.phonePending], [0, 1, 0]);
  assert.equal(await isSuppressed(w.ctx.env, "eag-internal", "phone", GERAL), false);
  w.existingIntact();
  // Vínculo pessoal: o telefone saiu do contato excluído; João e a ligação da empresa seguem com o número.
  assert.equal(w.DB.prepare("SELECT phone_encrypted FROM contacts WHERE id=?").get(w.r.dm).phone_encrypted, null);
  assert.equal(await decryptPii(w.DB.prepare("SELECT phone_encrypted FROM contacts WHERE id=?").get(w.joao).phone_encrypted, w.ctx.env), GERAL);
  assert.equal(w.task(w.l0).status, "open");
  assert.ok(w.task(w.l0).phone_hash);
  const [n] = w.notices();
  assert.deepEqual([n.kind, n.classification, n.reason, n.source_kind, n.source_url, n.pending], ["erasure_shared_phone", "shared", "classified_shared", "company_site", SRC, 0]);
  assert.equal(n.phone_hash, w.task(w.l0).phone_hash, "aviso ligado ao número geral (dado da empresa)");
  noIdentity(w.DB, w.notices(), hn);
  // O aviso aparece na ligação da empresa e na ficha da empresa.
  const item = (await w.ctx.api("/api/tasks?until=2099-12-31")).data.items.find((x) => x.id === w.l0);
  assert.equal(item.notices[0].classification, "shared");
  assert.ok(!item.blocked.includes("suppressed_phone"));
  const co = (await w.ctx.api(`/api/companies/${w.r.companyId}`)).data;
  assert.equal(co.notices.length, 1);
  // Exclusão repetida: nenhum aviso nem supressão novos.
  const sup = w.supRows().length;
  assert.equal((await w.erase({ phones: [{ phone: GERAL, kind: "shared" }] })).status, 200);
  assert.equal(w.notices().length, 1);
  assert.equal(w.supRows().length, sup);
  // Aviso é só inclusão.
  assert.throws(() => w.DB.prepare("UPDATE company_notices SET pending=1").run());
  assert.throws(() => w.DB.prepare("DELETE FROM company_notices").run());
});

test("Na dúvida (sem classificação): tratado como compartilhado não confirmado, sem supressão; demais dados excluídos; pendência registrada", async (t) => {
  const w = await world(t);
  await w.setPhone(w.r.dm, PESSOAL);
  const res = await w.erase();
  assert.equal(res.status, 200);
  assert.deepEqual([res.data.phonesSuppressed, res.data.phoneNotices, res.data.phonePending], [0, 1, 1]);
  assert.equal(await isSuppressed(w.ctx.env, "eag-internal", "phone", PESSOAL), false, "dúvida não vira supressão");
  const c = w.DB.prepare("SELECT full_name_encrypted,email_encrypted,phone_encrypted FROM contacts WHERE id=?").get(w.r.dm);
  assert.deepEqual([c.full_name_encrypted, c.email_encrypted, c.phone_encrypted], [null, null, null], "demais dados excluídos");
  const [n] = w.notices();
  assert.deepEqual([n.classification, n.reason, n.source_kind, n.source_url, n.pending], ["unconfirmed", "not_classified", "not_informed", null, 1]);
  w.existingIntact();
});

test("Marcado como pessoal, mas o número é usado por terceiros: não suprime (conflito com pendência); terceiros intactos", async (t) => {
  const w = await world(t);
  const res = await w.erase({ phones: [{ phone: GERAL, kind: "personal", sourceKind: "receita" }] });
  assert.equal(res.status, 200);
  assert.deepEqual([res.data.phonesSuppressed, res.data.phonePending], [0, 1]);
  assert.equal(await isSuppressed(w.ctx.env, "eag-internal", "phone", GERAL), false);
  const [n] = w.notices();
  assert.deepEqual([n.classification, n.reason, n.pending], ["conflict", "linked_to_others", 1]);
  assert.equal(w.task(w.l0).status, "open");
});

test("Ramais: ramal atrás do número geral não suprime a base; ramal com discagem direta é suprimido sem bloquear o geral", async (t) => {
  {
    const w = await world(t);
    await w.setPhone(w.r.dm, `${GERAL} ramal 21`);
    const res = await w.erase({ phones: [{ phone: GERAL, kind: "extension", sourceKind: "company_site", sourceUrl: SRC }] });
    assert.deepEqual([res.data.phonesSuppressed, res.data.phoneNotices, res.data.phonePending], [0, 1, 0]);
    assert.equal(await isSuppressed(w.ctx.env, "eag-internal", "phone", GERAL), false);
    assert.deepEqual([w.notices()[0].classification, w.notices()[0].reason], ["extension", "classified_extension"]);
    assert.equal(w.task(w.l0).status, "open");
  }
  {
    const w = await world(t);
    // Pessoa de compras vinculada à Maria com ramal de discagem direta (número próprio).
    w.DB.prepare(
      `INSERT INTO person_candidates(id,tenant_id,company_id,name_encrypted,name_hash,title_encrypted,role_suggestion,relevance,source_kind,source_url,verified_at,refresh_after,phone_encrypted,phone_source_url,status,contact_id,created_by)
       VALUES ('pc-maria','eag-internal',?,?,?,?,'decision_maker','compras','manual',?,'2099-01-01','2099-07-01',?,?,'accepted',?,'teste')`,
    ).run(w.r.companyId, await encryptPii("Maria Souza", w.ctx.env), await nameHash(w.ctx.env, "eag-internal", w.r.companyId, "Maria Souza"), await encryptPii("Compras", w.ctx.env), SRC, await encryptPii(DIRETO, w.ctx.env), SRC, w.r.dm);
    const res = await w.erase({ phones: [{ phone: DIRETO, kind: "direct_line", sourceKind: "company_site", sourceUrl: SRC }, { phone: GERAL, kind: "shared", sourceKind: "company_site" }] });
    assert.deepEqual([res.data.phonesSuppressed, res.data.phoneNotices], [1, 1]);
    assert.equal(await isSuppressed(w.ctx.env, "eag-internal", "phone", DIRETO), true);
    assert.equal(await isSuppressed(w.ctx.env, "eag-internal", "phone", GERAL), false);
    assert.equal(w.task(w.l0).status, "open", "o número geral da empresa segue ligável");
    w.existingIntact();
  }
});

test("Oposição pelo número geral: aviso sem supressão e sem ampliar à empresa; sem tipo, pendência (pessoal suprime: phone-call-tasks)", async (t) => {
  const w = await world(t);
  const other = (await w.ctx.api(`/api/companies/${w.r.companyId}/level0`, "POST", { commodity: "soy", phone: GERAL, phoneSource: SRC })).data.id;
  const res = await w.ctx.api(`/api/tasks/${w.l0}/complete`, "POST", { outcome: "opposed", note: "Recepção: uma pessoa pediu para não ligarem a ela.", phoneKind: "shared" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.deepEqual([res.data.suppressed, res.data.notice, res.data.tasksSuspended], [false, true, 0]);
  assert.equal(await isSuppressed(w.ctx.env, "eag-internal", "phone", GERAL), false);
  assert.equal(w.task(other).status, "open", "outras ligações da empresa seguem");
  const [n] = w.notices();
  assert.deepEqual([n.kind, n.classification, n.reason, n.source_kind, n.pending], ["opposition_shared_phone", "shared", "opposition_on_shared", "call", 0]);
  assert.ok(!JSON.stringify(w.notices()).includes("Recepção"), "nota da conversa não vai para o aviso");
  // Sem tipo: não confirmado, sem supressão.
  const res2 = await w.ctx.api(`/api/tasks/${other}/complete`, "POST", { outcome: "opposed" });
  assert.deepEqual([res2.data.suppressed, res2.data.phoneKind], [false, "unconfirmed"]);
  assert.equal(w.notices()[1].pending, 1);
  w.existingIntact();
});

test("Rota de leitura lista os telefones do contato, com origem, ramal e uso por terceiros, só para o Administrador", async (t) => {
  const w = await world(t);
  await w.setPhone(w.r.dm, `${GERAL} ramal 21`);
  const res = await w.ctx.api(`/api/contacts/${w.r.dm}/erasure-phones`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.data.items, [{ phone: "+551633334444", unparseable: false, origins: ["contato"], extension: true, linkedToOthers: true }]);
  w.DB.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('u-gerente','eag-internal','gerente@teste.invalid','Gerente','commercial_manager')");
  w.ctx.env.LOCAL_USER_EMAIL = "gerente@teste.invalid";
  assert.equal((await w.ctx.api(`/api/contacts/${w.r.dm}/erasure-phones`)).status, 403);
});
