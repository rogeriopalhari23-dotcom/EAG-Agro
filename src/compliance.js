// Registro da validação T11 por escopo (decisão de Rogério, 2026-10-09). Só o Administrador grava; cada decisão
// (validação ou revogação) é uma linha nova em compliance_validations (0035), com evidências obrigatórias em
// compliance_validation_evidence (0039). Nada é alterado nem apagado: revogar é registrar uma linha nova.
// Escopo aberto nesta rota: só a sequência automática de e-mail no Brasil (br_email_automatic). A proposta de registro da
// emenda T11-BR-TEL (ligação manual) não é usada para isso e nenhum outro escopo é gravável por aqui.
// Este módulo só registra e informa; quem libera canal, campanha e fichas continua sendo Rogério, cada um no seu passo.
import { fail, requireRole, bodyJson, str, oneOf } from "./http.js";
import { statement as s, commit, auditStatement, now } from "./store.js";

export const OPEN_SCOPES = ["br_email_automatic"];
// Evidências mínimas para validar o e-mail automático no Brasil (PRONTIDAO-PILOTO-BR-EMAIL.md §3 e §8):
// decisões aprovadas (E2-b, O7-e–O9-e, D5-a…), base legal (E1), mecanismo de transferência (art. 33), registro de
// incidentes criado e teste de exclusão.
export const REQUIRED_EVIDENCE = {
  br_email_automatic: ["decisions", "legal_basis", "transfer_mechanism", "incident_register", "erasure_test"],
};
const KINDS = ["decisions", "legal_basis", "transfer_mechanism", "incident_register", "erasure_test", "channel_test", "other"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function latest(env, tenant, scope, at = now()) {
  return s(
    env,
    "SELECT * FROM compliance_validations WHERE tenant_id=? AND gate='t11' AND scope=? AND decided_on<=? ORDER BY decided_on DESC, recorded_at DESC, rowid DESC LIMIT 1",
    tenant, scope, at.slice(0, 10),
  ).first();
}

export async function recordValidation(request, env, actor, rid) {
  requireRole(actor, new Set(["admin"]));
  const i = await bodyJson(request);
  const scope = oneOf(i.scope, OPEN_SCOPES, "escopo");
  const decision = oneOf(i.decision, ["validated", "revoked"], "decisão");
  const responsible = str(i.responsible, "responsável", 200);
  if (responsible.trim().length < 3) fail(422, "responsible_required", "Informe quem decide (nome e papel).");
  const decidedOn = str(i.decidedOn, "data da decisão", 10);
  if (!DAY.test(decidedOn) || Number.isNaN(Date.parse(decidedOn))) fail(422, "invalid_date", "Data no formato AAAA-MM-DD.");
  if (decidedOn > now().slice(0, 10)) fail(422, "future_date", "A data da decisão não pode ser futura.");
  const basis = str(i.basis, "fundamento", 2000);
  if (basis.trim().length < 10) fail(422, "basis_required", "Descreva o fundamento ou o documento da decisão.");
  if (i.confirm !== true) fail(422, "confirmation_required", "Confirme expressamente o registro (confirm: true).");
  const evidence = Array.isArray(i.evidence) ? i.evidence : [];
  if (evidence.length > 30) fail(422, "too_much_evidence", "No máximo 30 evidências.");
  const items = evidence.map((e, n) => {
    const kind = oneOf(e?.kind, KINDS, `tipo da evidência ${n + 1}`);
    const reference = str(e?.reference, `referência da evidência ${n + 1}`, 500);
    if (reference.trim().length < 5) fail(422, "evidence_reference", `Evidência ${n + 1}: referência curta demais.`);
    const sha256 = String(e?.sha256 ?? "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha256)) fail(422, "evidence_hash", `Evidência ${n + 1}: SHA-256 com 64 caracteres hexadecimais.`);
    return { kind, reference, sha256, note: e?.note == null ? null : str(e.note, "observação", 500) };
  });
  const cur = await latest(env, actor.tenant_id, scope, `${decidedOn}T23:59:59Z`);
  if (decision === "validated") {
    const missing = REQUIRED_EVIDENCE[scope].filter((k) => !items.some((x) => x.kind === k));
    if (missing.length) fail(422, "evidence_required", `Faltam evidências obrigatórias: ${missing.join(", ")}.`, { missing });
    if (cur?.decision === "validated") fail(409, "already_validated", "Já existe validação vigente para este escopo; revogue antes de registrar outra.");
  } else {
    if (cur?.decision !== "validated") fail(409, "nothing_to_revoke", "Não há validação vigente para revogar neste escopo.");
  }
  const id = crypto.randomUUID();
  await commit(env, [
    s(
      env,
      "INSERT INTO compliance_validations(id,tenant_id,gate,scope,decision,responsible,decided_on,basis,recorded_by,request_id) VALUES (?,?,'t11',?,?,?,?,?,?,?)",
      id, actor.tenant_id, scope, decision, responsible, decidedOn, basis, actor.id, rid,
    ),
    ...items.map((e) =>
      s(env, "INSERT INTO compliance_validation_evidence(id,validation_id,kind,reference,sha256,note) VALUES (?,?,?,?,?,?)", crypto.randomUUID(), id, e.kind, e.reference, e.sha256, e.note),
    ),
    auditStatement(env, actor, rid, decision === "validated" ? "t11.validated" : "t11.revoked", "compliance_validation", id, { scope, decidedOn, evidence: items.map((e) => e.kind) }),
  ]);
  return { id, scope, decision, decidedOn, evidence: items.length };
}

// Histórico completo por escopo (mais recente primeiro) e a decisão vigente hoje.
export async function listValidations(env, actor, scope) {
  requireRole(actor, new Set(["admin", "commercial_manager", "auditor_viewer"]));
  const sc = scope ? oneOf(scope, OPEN_SCOPES, "escopo") : OPEN_SCOPES[0];
  const rows = (
    await s(env, "SELECT id,scope,decision,responsible,decided_on,basis,recorded_by,recorded_at FROM compliance_validations WHERE tenant_id=? AND gate='t11' AND scope=? ORDER BY decided_on DESC, recorded_at DESC, rowid DESC", actor.tenant_id, sc).all()
  ).results;
  const ev = rows.length
    ? (await s(env, `SELECT validation_id,kind,reference,sha256,note,recorded_at FROM compliance_validation_evidence WHERE validation_id IN (${rows.map(() => "?").join(",")}) ORDER BY recorded_at`, ...rows.map((r) => r.id)).all()).results
    : [];
  const cur = await latest(env, actor.tenant_id, sc);
  return {
    scope: sc,
    current: cur ? { decision: cur.decision, decidedOn: cur.decided_on, id: cur.id } : { decision: "pending" },
    requiredEvidence: REQUIRED_EVIDENCE[sc],
    history: rows.map((r) => ({ ...r, evidence: ev.filter((e) => e.validation_id === r.id) })),
  };
}

// Trava T11 do e-mail automático (decisão de Rogério, 2026-10-09): aprovação de ficha de e-mail e cada envio exigem a
// decisão vigente do escopo <país da empresa>_email_automatic. Sem registro, revogada ou outro país (escopo incompatível,
// ex.: de_email_automatic, que esta rota nem grava): bloqueia. Liberar o canal continua decisão separada (R26.3).
export async function emailT11Cleared(env, tenant, countryCode, at = now()) {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) return false;
  const v = await latest(env, tenant, `${countryCode.toLowerCase()}_email_automatic`, at);
  return v?.decision === "validated";
}

// Única exceção: teste interno reconhecido pelo sistema — canal de e-mail em "internal_test" E destinatário da lista
// interna (INTERNAL_TEST_RECIPIENTS). Destinatário fora da lista nunca é exceção.
export function internalTestException(env, channelState, email) {
  if (channelState !== "internal_test" || !email) return false;
  const allowed = String(env.INTERNAL_TEST_RECIPIENTS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  return allowed.includes(String(email).toLowerCase());
}
