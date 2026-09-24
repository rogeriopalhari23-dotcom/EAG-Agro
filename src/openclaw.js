// Migração do OpenClaw (P2-T15; R25.1–R25.5, R21.8, R23.1). Formato de exportação do OpenClaw desconhecido:
// o importador recebe linhas normalizadas (ver docs/OPERACAO.md) em lotes e em duas fases obrigatórias —
// primeiro TODAS as supressões, depois empresas e contatos — com relatório de conflitos.
import { bodyJson, fail, str, oneOf, requireRole } from "./http.js";
import { statement as s, commit, auditStatement, now, company } from "./store.js";
import { identifierHash, encryptPii } from "./crypto.js";

const ADMIN = new Set(["admin"]);
const STATUSES = ["ativo", "pausado", "respondeu", "descadastrado"];
const MAX_ROWS = 200;

async function importRow(env, actor, id) {
  const r = await s(env, "SELECT * FROM openclaw_imports WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!r) fail(404, "import_not_found", "Importação não encontrada.");
  return { ...r, counts: JSON.parse(r.counts_json), conflicts: JSON.parse(r.conflicts_json) };
}
const save = (env, r) =>
  s(env, "UPDATE openclaw_imports SET counts_json=?,conflicts_json=? WHERE id=?", JSON.stringify(r.counts), JSON.stringify(r.conflicts.slice(0, 1000)), r.id);

export async function startImport(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const sha = str(i.fileSha256, "SHA-256 do arquivo exportado", 64);
  if (!/^[0-9a-f]{64}$/.test(sha)) fail(422, "invalid_hash", "Informe o SHA-256 (hex) do arquivo exportado.");
  const id = crypto.randomUUID();
  const counts = { phase: "suppressions", suppressions: 0, companies: 0, contacts: 0, transfersPending: 0, replies: 0 };
  await commit(env, [
    s(env, "INSERT INTO openclaw_imports(id,tenant_id,r2_key,file_sha256,counts_json,imported_by,imported_at) VALUES (?,?,?,?,?,?,?)", id, actor.tenant_id, str(i.storageKey, "arquivo", 300, true) || "not_stored", sha, JSON.stringify(counts), actor.id, now()),
    auditStatement(env, actor, rid, "openclaw.import_started", "openclaw_import", id, { sha }),
  ]);
  return { id, phase: "suppressions" };
}

// Fase 1: supressões (linhas "descadastrado"), antes de qualquer contato (R21.8, R25.2).
export async function importSuppressions(request, env, actor, rid, id) {
  requireRole(actor, ADMIN);
  const imp = await importRow(env, actor, id);
  if (imp.counts.phase !== "suppressions") fail(409, "phase_closed", "Fase de supressões já encerrada.");
  const i = await bodyJson(request);
  if (!Array.isArray(i.emails) || !i.emails.length || i.emails.length > MAX_ROWS) fail(422, "invalid_batch", `Envie de 1 a ${MAX_ROWS} e-mails.`);
  const st = [];
  for (const e of i.emails) {
    const email = str(e, "e-mail", 320).toLowerCase();
    st.push(
      s(env, "INSERT INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,'email','legacy_import','openclaw',?) ON CONFLICT(tenant_id,identifier_hash,channel) DO NOTHING",
        crypto.randomUUID(), actor.tenant_id, await identifierHash(env, actor.tenant_id, "email", email), actor.id),
    );
  }
  imp.counts.suppressions += i.emails.length;
  await env.DB.batch([...st, save(env, imp)]);
  return { added: i.emails.length, total: imp.counts.suppressions };
}

export async function closeSuppressions(request, env, actor, rid, id) {
  requireRole(actor, ADMIN);
  await bodyJson(request);
  const imp = await importRow(env, actor, id);
  if (imp.counts.phase !== "suppressions") fail(409, "phase_closed", "Fase de supressões já encerrada.");
  imp.counts.phase = "contacts";
  await commit(env, [save(env, imp), auditStatement(env, actor, rid, "openclaw.suppressions_closed", "openclaw_import", id, { total: imp.counts.suppressions })]);
  return { phase: "contacts" };
}

// Fase 2: empresas e contatos. Deduplica por raiz de CNPJ e hash do e-mail; conflitos vão para o relatório.
export async function importContacts(request, env, actor, rid, id) {
  requireRole(actor, ADMIN);
  const imp = await importRow(env, actor, id);
  if (imp.counts.phase !== "contacts") fail(409, "suppressions_first", "Encerre a fase de supressões antes de importar contatos (R21.8).");
  const i = await bodyJson(request);
  if (!Array.isArray(i.rows) || !i.rows.length || i.rows.length > MAX_ROWS) fail(422, "invalid_batch", `Envie de 1 a ${MAX_ROWS} linhas.`);
  for (const [n, raw] of i.rows.entries()) {
    const line = raw.line ?? n + 1;
    const status = oneOf(raw.status, STATUSES, "status");
    const cnpj = raw.cnpj ? String(raw.cnpj).replace(/\D/g, "") : null;
    const email = raw.email ? str(raw.email, "e-mail", 320).toLowerCase() : null;
    const name = str(raw.company, "empresa", 250);
    const hash = email ? await identifierHash(env, actor.tenant_id, "email", email) : null;
    if (status === "descadastrado") {
      imp.conflicts.push({ line, issue: "descadastrado_na_fase_de_contatos", note: "Suprimido, contato não importado." });
      continue;
    }
    // Empresa: raiz do CNPJ; sem CNPJ, nome igual gera pendência, não fusão (R1.1.4).
    let co = null;
    if (cnpj && cnpj.length === 14) co = await s(env, "SELECT id FROM companies WHERE tenant_id=? AND cnpj_root=?", actor.tenant_id, cnpj.slice(0, 8)).first();
    if (!co && !cnpj) {
      const same = await s(env, "SELECT id FROM companies WHERE tenant_id=? AND country_code='BR' AND legal_name=?", actor.tenant_id, name).first();
      if (same) {
        imp.conflicts.push({ line, issue: "sem_cnpj_nome_existente", companyId: same.id });
        continue;
      }
    }
    if (!co) {
      const cid = crypto.randomUUID();
      await s(env, "INSERT INTO companies(id,tenant_id,legal_name,country_code,registration_id,registration_id_type,cnpj_root,source_label,created_by) VALUES (?,?,?,'BR',?,?,?,'OpenClaw',?)",
        cid, actor.tenant_id, name, cnpj && cnpj.length === 14 ? cnpj : null, cnpj && cnpj.length === 14 ? "CNPJ" : null, cnpj && cnpj.length === 14 ? cnpj.slice(0, 8) : null, actor.id).run();
      co = { id: cid };
      imp.counts.companies++;
    }
    if (hash) {
      const suppressed = await s(env, "SELECT 1 FROM suppression_entries WHERE tenant_id=? AND identifier_hash=? AND channel='email'", actor.tenant_id, hash).first();
      if (suppressed) imp.conflicts.push({ line, issue: "suprimido_aparece_como_" + status, companyId: co.id });
      const elsewhere = await s(env, "SELECT company_id FROM contacts WHERE tenant_id=? AND email_hash=? AND company_id<>? LIMIT 1", actor.tenant_id, hash, co.id).first();
      if (elsewhere) imp.conflicts.push({ line, issue: "email_em_outra_empresa", companyId: co.id, otherCompanyId: elsewhere.company_id });
      const exists = await s(env, "SELECT id FROM contacts WHERE tenant_id=? AND company_id=? AND email_hash=?", actor.tenant_id, co.id, hash).first();
      if (!exists) {
        await s(env, "INSERT INTO contacts(id,tenant_id,company_id,full_name_encrypted,email_encrypted,source_label,created_by,prospect_role,email_hash,email_validation) VALUES (?,?,?,?,?,'OpenClaw',?,'other',?,'pending')",
          crypto.randomUUID(), actor.tenant_id, co.id, await encryptPii(raw.contactName || null, env), await encryptPii(email, env), actor.id, hash).run();
        imp.counts.contacts++;
      }
    }
    // Contato anterior não bloqueia nova ficha (R25.4); empresa ativa no OpenClaw bloqueia até a retirada (R25.3).
    if (status === "ativo") {
      const t = await s(env, "INSERT INTO openclaw_transfers(tenant_id,company_id,retired_in_openclaw) VALUES (?,?,0) ON CONFLICT(tenant_id,company_id) DO NOTHING", actor.tenant_id, co.id).run();
      if (t.meta.changes) imp.counts.transfersPending++;
    }
    if (status === "respondeu") {
      await auditStatement(env, actor, rid, "openclaw.reply_history", "company", co.id, { lastSent: raw.lastSent ?? null, campaign: raw.campaign ?? null }).run();
      imp.counts.replies++;
    }
  }
  await save(env, imp).run();
  return { counts: imp.counts, conflicts: imp.conflicts.length };
}

export async function report(env, actor, id) {
  const imp = await importRow(env, actor, id);
  return { id, counts: imp.counts, conflicts: imp.conflicts };
}

// Corte comprovado: a empresa só volta a ter ficha/envio após a retirada registrada no sistema anterior.
export async function confirmTransfer(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  const companyId = str(i.companyId, "empresa", 80);
  await company(env, actor, companyId);
  const evidence = str(i.evidence, "evidência da retirada no OpenClaw", 1000);
  if (evidence.length < 10) fail(422, "reason_required", "Registre como a retirada foi comprovada.");
  const r = await commit(env, [
    s(env, "UPDATE openclaw_transfers SET retired_in_openclaw=1,confirmed_by=?,confirmed_at=? WHERE tenant_id=? AND company_id=?", actor.id, now(), actor.tenant_id, companyId),
    auditStatement(env, actor, rid, "openclaw.retired", "company", companyId, { evidence }),
  ]);
  if (!r[0].meta.changes) fail(404, "transfer_not_found", "Empresa sem registro ativo no OpenClaw.");
  return { companyId, retired: true };
}
