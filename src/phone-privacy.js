// D-EXC (aprovada em 08/10/2026, opção a): o que acontece com um telefone depois de exclusão ou oposição.
// - personal / direct_line (ramal com discagem direta, número próprio): suprime o número normalizado pelo mesmo fluxo da
//   supressão manual (HMAC, canal phone, ligações abertas ao número suspensas, auditoria sem o número).
// - shared (número geral) / extension (ramal atrás do número geral) / sem classificação / conflito: NÃO suprime
//   (bloquearia a empresa inteira). Registra um aviso na empresa, só com campos fechados: sem nome, hash do nome ou texto.
// O aviso orienta o operador; não garante que a pessoa nunca será reencontrada. Retenção pendente da decisão A.
import { fail, oneOf, url } from "./http.js";
import { statement as s, auditStatement } from "./store.js";
import { identifierHash, normalizeIdentifier } from "./crypto.js";

export const PHONE_SUPPRESSED = "telefone suprimido";
export const PHONE_KINDS = ["personal", "direct_line", "shared", "extension"];
const SUPPRESSING = new Set(["personal", "direct_line"]);
const SOURCE_KINDS = ["company_site", "directory", "receita", "call", "not_informed"];

// "+55 16 3333-4444 ramal 21" → base "+55 16 3333-4444" e ramal "21". Ramal atrás do número geral nunca suprime a base.
export function splitExtension(raw) {
  const m = String(raw ?? "").trim().match(/^(.*?)\s*(?:ramal|ext\.?|extens[aã]o|r\.)\s*(\d{1,6})\s*$/i);
  return m ? { base: m[1].trim(), extension: m[2] } : { base: String(raw ?? "").trim(), extension: null };
}

// Normaliza com a mesma regra da supressão; devolve null quando o número não tem formato reconhecível (sem +código).
export function normalizePhone(raw) {
  try {
    return normalizeIdentifier("phone", raw);
  } catch {
    return null;
  }
}

export function isSuppressingKind(kind) {
  return SUPPRESSING.has(kind);
}

// Supressão de telefone pelo fluxo existente; idempotente (supressão já existente não muda, nada é reauditado).
export async function phoneSuppressionStatements(env, actor, rid, hash, reason, { exceptTaskId = null, exceptContactId = null, context = {} } = {}) {
  const tasks = (
    await s(
      env,
      "SELECT id,company_id FROM tasks WHERE tenant_id=? AND status='open' AND phone_hash=? AND kind IN ('call_l0','call_l1','call_l2') AND id<>? AND (contact_id IS NULL OR contact_id<>?)",
      actor.tenant_id, hash, exceptTaskId ?? "", exceptContactId ?? "",
    ).all()
  ).results;
  const supId = crypto.randomUUID();
  return {
    suspended: tasks.length,
    statements: [
      s(
        env,
        "INSERT INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,'phone',?,'manual',?) ON CONFLICT(tenant_id,identifier_hash,channel) DO NOTHING",
        supId, actor.tenant_id, hash, reason, actor.id,
      ),
      s(
        env,
        "INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,new_value_json,request_id) SELECT ?,?,?,?,'suppression.added','suppression',?,?,? WHERE changes()>0",
        crypto.randomUUID(), actor.tenant_id, actor.id, actor.role, supId, JSON.stringify({ channel: "phone", reason, ...context }), rid,
      ),
      ...tasks.flatMap((t) => [
        s(env, "UPDATE tasks SET status='suspended',suspended_reason=? WHERE tenant_id=? AND id=? AND status='open'", PHONE_SUPPRESSED, actor.tenant_id, t.id),
        auditStatement(env, actor, rid, "task.suspended", "task", t.id, { companyId: t.company_id, reason: "suppressed_phone" }),
      ]),
    ],
  };
}

// Aviso na empresa (sem identidade). pending=1 quando a classificação não foi confirmada.
export function noticeStatements(env, actor, rid, { companyId, kind, classification, sourceKind = "not_informed", sourceUrl = null, reason, phoneHash = null }) {
  const id = crypto.randomUUID();
  const pending = classification === "unconfirmed" || classification === "conflict" ? 1 : 0;
  return [
    s(
      env,
      "INSERT INTO company_notices(id,tenant_id,company_id,kind,classification,source_kind,source_url,reason,phone_hash,pending,created_by,request_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      id, actor.tenant_id, companyId, kind, classification, sourceKind, sourceUrl, reason, phoneHash, pending, actor.id, rid,
    ),
    auditStatement(env, actor, rid, "company.notice_added", "company", companyId, { noticeId: id, kind, classification, reason, pending: !!pending }),
  ];
}

// Classificação informada pelo Administrador para um telefone: tipo, fonte e URL opcional (validados).
export function parseClassification(i) {
  const kind = oneOf(i.kind, PHONE_KINDS, "tipo do telefone");
  const sourceKind = oneOf(i.sourceKind ?? "not_informed", SOURCE_KINDS, "fonte da classificação");
  const sourceUrl = i.sourceUrl ? url(i.sourceUrl) : null;
  if (i.sourceUrl && !sourceUrl) fail(422, "invalid_source_url", "Informe uma URL válida para a fonte.");
  return { kind, sourceKind, sourceUrl };
}

export async function phoneHashOf(env, tenant, normalized) {
  return identifierHash(env, tenant, "phone", normalized);
}

// Texto do aviso para a tela (sem identidade).
export const NOTICE_TEXT = {
  erasure_shared_phone: "Pedido de exclusão de uma pessoa desta empresa: ao ligar, pedir o setor sem citar nomes antigos. Não garante que a pessoa não será reencontrada.",
  opposition_shared_phone: "Oposição registrada por uma pessoa pelo número geral: não ampliar à empresa; pedir o setor sem insistir com quem se opôs.",
};
export const CLASSIFICATION_TEXT = {
  shared: "número geral da empresa",
  extension: "ramal atrás do número geral",
  unconfirmed: "classificação não confirmada (tratado provisoriamente como compartilhado; não prova que o número é comercial)",
  conflict: "marcado como pessoal, mas ligado a outros registros (não suprimido; a conferir)",
};
