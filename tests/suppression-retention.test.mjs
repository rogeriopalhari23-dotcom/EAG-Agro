// SUPRESSAO-RETENCAO (2026-10-01): alcance e critério de retenção por registro (R21.1), remoção só pelo Administrador
// com motivo e base (R9.2), tentativa negada registrada (R9.2.1), histórico preservado e nada reenviado após a remoção.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, transport, at } from "./helpers/pilot.mjs";
import { tick } from "../src/sending.js";
import { isSuppressed } from "../src/operations.js";

function world() {
  const ctx = setup();
  ctx.DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('u-gerente','eag-internal','gerente@teste.invalid','Gerente (teste)','commercial_manager')");
  const as = (role) => ((ctx.env.LOCAL_USER_EMAIL = role === "admin" ? "admin@local.eag" : "gerente@teste.invalid"), ctx.api);
  return { ctx, as };
}
const removeBody = (o = {}) => ({ reason: "Pessoa pediu para voltar a receber contato", basis: "E-mail da pessoa em 01/10/2026 (caixa de Rogério)", confirm: true, ...o });

test("Supressão nova registra alcance e critério de retenção; prazo não é inventado (R21.1, T11 pendente)", async (t) => {
  const { ctx, as } = world();
  t.after(ctx.close);
  const r = await as("admin")("/api/suppression", "POST", { channel: "email", value: "alguem@exemplo.invalid", reason: "opt_out" });
  assert.equal(r.status, 200);
  const row = ctx.DB.raw.prepare("SELECT scope,retention_criterion,retention_until FROM suppression_entries").get();
  assert.deepEqual({ ...row }, { scope: "channel_all", retention_criterion: "until_t11_policy", retention_until: null });
  const list = (await as("admin")("/api/suppression")).data.items[0];
  assert.ok(list.retention_label.startsWith("A1 (decisão de Rogério Palhari em 08/10/2026)"));
  assert.match(list.retention_label, /sem prazo nem expiração automática/);
  assert.match(list.identifier_hash, /^hmac:.{4}….{4}$/);
});

test("Remoção: só Administrador; tentativa de outro perfil é negada, registrada e não altera nada (R9.2, R9.2.1)", async (t) => {
  const { ctx, as } = world();
  t.after(ctx.close);
  const { data } = await as("admin")("/api/suppression", "POST", { channel: "email", value: "alguem@exemplo.invalid", reason: "opt_out" });
  const denied = await as("commercial_manager")(`/api/suppression/${data.id}/remove`, "POST", removeBody());
  assert.equal(denied.status, 403);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM suppression_entries").get().n, 1);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='suppression.remove_denied' AND actor_role='commercial_manager'").get().n, 1);
  assert.equal((await as("commercial_manager")("/api/suppression/removals")).status, 403);
});

test("Remoção exige motivo, base e confirmação; guarda o histórico, audita e não reenvia o que foi cancelado", async (t) => {
  const { ctx, as } = world();
  t.after(ctx.close);
  const email = "compras@valeverde.com.br";
  await pilot(ctx, { email });
  await tick(ctx.env, "eag-internal", { transport: transport(), now: at(10) }); // passo 1 sai
  const api = as("admin");
  const { data } = await api("/api/suppression", "POST", { channel: "email", value: email, reason: "opt_out" });
  // Supressão manual não cancela a fila por si; o pré-envio bloqueia. Simula o cancelamento feito pelo descadastro.
  ctx.DB.raw.exec("UPDATE send_outbox SET status='cancelled',block_reason='unsubscribed' WHERE step_no>1");
  for (const [body, code] of [
    [removeBody({ reason: "curto" }), "reason_too_short"],
    [removeBody({ basis: "" }), null],
    [removeBody({ confirm: false }), "confirm_required"],
  ]) {
    const r = await api(`/api/suppression/${data.id}/remove`, "POST", body);
    assert.equal(r.status, 422);
    if (code) assert.equal(r.data.error.code, code);
  }
  assert.equal(await isSuppressed(ctx.env, "eag-internal", "email", email), true);
  const ok = await api(`/api/suppression/${data.id}/remove`, "POST", removeBody());
  assert.equal(ok.status, 200);
  assert.equal(await isSuppressed(ctx.env, "eag-internal", "email", email), false);
  const rem = ctx.DB.raw.prepare("SELECT entry_id,channel,reason,source,scope,retention_criterion,removed_by,removal_reason,removal_basis FROM suppression_removals").get();
  assert.equal(rem.entry_id, data.id);
  assert.equal(rem.removed_by, "system-admin");
  assert.match(rem.removal_basis, /01\/10\/2026/);
  const audit = ctx.DB.raw.prepare("SELECT old_value_json,new_value_json,reason FROM audit_log WHERE action='suppression.removed'").get();
  assert.equal(JSON.parse(audit.old_value_json).reason, "opt_out");
  assert.equal(JSON.parse(audit.new_value_json).removalId, ok.data.removalId);
  assert.ok(!audit.old_value_json.includes(email) && !audit.new_value_json.includes(email), "auditoria sem o endereço");
  // Nada volta à fila: passos cancelados continuam cancelados.
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM send_outbox WHERE status IN ('pending','temp_failed')").get().n, 0);
  // Segunda remoção do mesmo registro: não existe mais (404); listagem do histórico só para admin, com pseudônimo mascarado.
  assert.equal((await api(`/api/suppression/${data.id}/remove`, "POST", removeBody())).status, 404);
  assert.match((await api("/api/suppression/removals")).data.items[0].identifier_hash, /^hmac:/);
  // Novo pedido de saída depois da remoção volta a suprimir normalmente.
  const again = await api("/api/suppression", "POST", { channel: "email", value: email, reason: "opt_out" });
  assert.equal(again.data.created, true);
  assert.equal(await isSuppressed(ctx.env, "eag-internal", "email", email), true);
});
