// Rota administrativa de registro da validação T11 do e-mail automático no Brasil (decisão de Rogério, 2026-10-09).
// Só registra: nada aqui libera canal, campanha ou ficha. Nenhuma validação real é gravada por estes testes fora do banco
// em memória.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";

const H = (c) => c.repeat(64);
const EVIDENCE = [
  { kind: "decisions", reference: "PRONTIDAO-PILOTO-BR-EMAIL.md §9 (decisões de 09/10)", sha256: H("a") },
  { kind: "legal_basis", reference: "E1 aprovado em 09/10/2026", sha256: H("b") },
  { kind: "transfer_mechanism", reference: "resposta da Cloudflare (art. 33)", sha256: H("c") },
  { kind: "incident_register", reference: "registro de incidentes criado", sha256: H("d") },
  { kind: "erasure_test", reference: "EVIDENCIAS.md — teste de exclusão de 08/10", sha256: H("e") },
];
const today = () => new Date().toISOString().slice(0, 10);
const body = (over = {}) => ({ scope: "br_email_automatic", decision: "validated", responsible: "Rogério Palhari (franqueado, controlador do Compass)", decidedOn: today(), basis: "Teste da rota: fundamento descrito", confirm: true, evidence: EVIDENCE, ...over });

test("T11 e-mail Brasil: começa pendente; só Administrador grava; evidências, hash, data, confirmação e escopo são exigidos", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api, env, DB } = ctx;
  let g = (await api("/api/compliance/t11")).data;
  assert.deepEqual(g.current, { decision: "pending" });
  assert.deepEqual(g.history, []);
  assert.deepEqual(g.requiredEvidence, ["decisions", "legal_basis", "transfer_mechanism", "incident_register", "erasure_test"]);
  const post = (b) => api("/api/compliance/t11", "POST", b);
  assert.equal((await post(body({ confirm: false }))).data.error.code, "confirmation_required");
  const miss = await post(body({ evidence: EVIDENCE.slice(0, 2) }));
  assert.equal(miss.data.error.code, "evidence_required");
  assert.deepEqual(miss.data.error.details.missing, ["transfer_mechanism", "incident_register", "erasure_test"]);
  assert.equal((await post(body({ evidence: [...EVIDENCE.slice(1), { ...EVIDENCE[0], sha256: "abc" }] }))).data.error.code, "evidence_hash");
  assert.equal((await post(body({ decidedOn: "2999-01-01" }))).data.error.code, "future_date");
  assert.equal((await post(body({ basis: "curto" }))).data.error.code, "basis_required");
  assert.equal((await post(body({ scope: "br_manual_phone" }))).status, 422, "escopo de ligação não é gravável por esta rota");
  assert.equal((await post(body({ scope: "de_email_automatic" }))).status, 422, "Alemanha fora");
  assert.equal((await post(body({ decision: "revoked" }))).data.error.code, "nothing_to_revoke");
  DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('m','eag-internal','gestor@example.test','Gestor','commercial_manager')");
  env.LOCAL_USER_EMAIL = "gestor@example.test";
  assert.equal((await post(body())).status, 403, "gestor não registra");
  assert.equal((await api("/api/compliance/t11")).status, 200, "gestor consulta");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM compliance_validations").get().n, 0, "nada gravado nas tentativas recusadas");
});

test("T11 e-mail Brasil: validação com evidências, histórico, revogação por linha nova e registros imutáveis", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api, DB } = ctx;
  const post = (b) => api("/api/compliance/t11", "POST", b);
  const v = await post(body());
  assert.equal(v.status, 201, JSON.stringify(v.data));
  let g = (await api("/api/compliance/t11")).data;
  assert.equal(g.current.decision, "validated");
  assert.equal(g.history[0].evidence.length, 5);
  assert.equal((await post(body())).data.error.code, "already_validated");
  const r = await post(body({ decision: "revoked", basis: "Revogação de teste com fundamento", evidence: [] }));
  assert.equal(r.status, 201, JSON.stringify(r.data));
  g = (await api("/api/compliance/t11")).data;
  assert.equal(g.current.decision, "revoked");
  assert.deepEqual(g.history.map((h) => h.decision).sort(), ["revoked", "validated"], "histórico preservado");
  assert.equal((await post(body({ decision: "revoked", evidence: [] }))).data.error.code, "nothing_to_revoke");
  assert.throws(() => DB.raw.exec("UPDATE compliance_validations SET decision='validated'"), /não pode ser alterado/);
  assert.throws(() => DB.raw.exec("DELETE FROM compliance_validation_evidence"), /não pode ser apagado/);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM compliance_validations WHERE scope<>'br_email_automatic'").get().n, 0, "ligação e outros escopos intocados");
  assert.ok(DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action IN ('t11.validated','t11.revoked')").get().n >= 2);
});
