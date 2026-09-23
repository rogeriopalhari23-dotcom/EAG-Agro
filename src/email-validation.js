// Validação de e-mail de contatos (P2-T7, R19.2 item 11, G11): estados explícitos, prazo, contagem de chamadas,
// consulta do resultado com limite de tentativas. Formato válido nunca confirma entrega.
import { bodyJson, fail, requireRole, WRITE_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, parameters, company } from "./store.js";
import { decryptPii } from "./crypto.js";
import { isSuppressed } from "./operations.js";
import { startVerification, verificationResult, SOURCE } from "./adapters/snov.js";
import { AdapterError } from "./adapters/errors.js";

export const MAX_POLLS = 8;
const pollDelay = (polls) => Math.min(3600, 30 * 2 ** polls);

async function send(env, deps, body, delaySeconds) {
  const fn = deps.enqueue ?? ((msgs) => env.ASYNC_QUEUE?.sendBatch(msgs));
  await fn([{ body, delaySeconds: Math.min(86400, delaySeconds) }]);
}

async function start(env, actor, rid, contacts, deps) {
  const eligible = [];
  const skipped = [];
  for (const c of contacts) {
    const email = await decryptPii(c.email_encrypted, env);
    if (!email) skipped.push({ id: c.id, reason: "sem_email" });
    else if (await isSuppressed(env, actor.tenant_id, "email", email)) skipped.push({ id: c.id, reason: "suprimido" });
    else eligible.push({ id: c.id, email: email.toLowerCase() });
  }
  if (!eligible.length) return { jobId: null, started: 0, skipped };
  if (eligible.length > 10) fail(422, "too_many_contacts", "Até 10 contatos por validação.");
  let hash;
  try {
    hash = await startVerification(env, eligible.map((x) => x.email), deps.fetchImpl);
  } catch (e) {
    if (e instanceof AdapterError) fail(e.retryable ? 503 : 502, `email_validation_${e.kind}`, e.message);
    throw e;
  }
  const id = crypto.randomUUID();
  const at = deps.now ?? now();
  await commit(env, [
    s(
      env,
      "INSERT INTO email_validation_jobs(id,tenant_id,provider,task_hash,contact_ids_json,api_calls,next_poll_at,requested_by) VALUES (?,?,?,?,?,1,?,?)",
      id, actor.tenant_id, SOURCE, hash, JSON.stringify(eligible.map((x) => x.id)),
      new Date(Date.parse(at) + pollDelay(0) * 1000).toISOString(), actor.id,
    ),
    ...eligible.map((x) =>
      s(env, "UPDATE contacts SET email_validation='pending',email_validation_provider=? WHERE tenant_id=? AND id=?", SOURCE, actor.tenant_id, x.id),
    ),
    auditStatement(env, actor, rid, "email_validation.started", "email_validation_job", id, { contacts: eligible.length, skipped: skipped.length }),
  ]);
  await send(env, deps, { type: "email_validation_poll", jobId: id }, pollDelay(0));
  return { jobId: id, started: eligible.length, skipped };
}

export async function validateContact(request, env, actor, rid, contactId, deps = {}) {
  requireRole(actor, WRITE_ROLES);
  await bodyJson(request);
  const c = await s(env, "SELECT * FROM contacts WHERE tenant_id=? AND id=?", actor.tenant_id, contactId).first();
  if (!c) fail(404, "contact_not_found", "Contato não encontrado.");
  if (!c.email_encrypted) fail(422, "contact_without_email", "Contato sem e-mail.");
  return start(env, actor, rid, [c], deps);
}

// Valida de uma vez (até 10) os contatos da empresa com e-mail ainda não validado ou vencido.
export async function validateCompanyContacts(request, env, actor, rid, companyId, deps = {}) {
  requireRole(actor, WRITE_ROLES);
  await bodyJson(request);
  await company(env, actor, companyId);
  const at = deps.now ?? now();
  const rows = (
    await s(
      env,
      "SELECT * FROM contacts WHERE tenant_id=? AND company_id=? AND email_encrypted IS NOT NULL AND (email_validation IS NULL OR email_validation IN ('pending','error') OR (email_validation='valid' AND email_validation_expires_at IS NOT NULL AND email_validation_expires_at<=?)) ORDER BY created_at LIMIT 10",
      actor.tenant_id, companyId, at,
    ).all()
  ).results;
  return start(env, actor, rid, rows, deps);
}

export async function pollJob(env, jobId, deps = {}) {
  const at = deps.now ?? now();
  const job = await s(env, "SELECT * FROM email_validation_jobs WHERE id=?", jobId).first();
  if (!job || job.status !== "started") return { skipped: true };
  const ids = JSON.parse(job.contact_ids_json);
  let r;
  try {
    r = await verificationResult(env, job.task_hash, deps.fetchImpl, Date.parse(at));
  } catch (e) {
    if (!(e instanceof AdapterError) || e.retryable) {
      if (job.polls + 1 >= MAX_POLLS) return finish(env, job, ids, null, at, `Sem resultado após ${MAX_POLLS} consultas: ${e.message}`);
      await s(env, "UPDATE email_validation_jobs SET polls=polls+1,api_calls=api_calls+1,next_poll_at=? WHERE id=? AND status='started'", new Date(Date.parse(at) + pollDelay(job.polls + 1) * 1000).toISOString(), jobId).run();
      await send(env, deps, { type: "email_validation_poll", jobId }, pollDelay(job.polls + 1));
      return { retry: true };
    }
    return finish(env, job, ids, null, at, e.message);
  }
  if (!r.done) {
    if (job.polls + 1 >= MAX_POLLS) return finish(env, job, ids, null, at, `Resultado não concluído após ${MAX_POLLS} consultas.`);
    await s(env, "UPDATE email_validation_jobs SET polls=polls+1,api_calls=api_calls+1,next_poll_at=? WHERE id=? AND status='started'", new Date(Date.parse(at) + pollDelay(job.polls + 1) * 1000).toISOString(), jobId).run();
    await send(env, deps, { type: "email_validation_poll", jobId }, pollDelay(job.polls + 1));
    return { pending: true };
  }
  return finish(env, job, ids, r.byEmail, at, null);
}

async function finish(env, job, ids, byEmail, at, error) {
  const params = await parameters(env, job.tenant_id);
  const days = params["email_validation_max_age_days:email"];
  const expires = days ? new Date(Date.parse(at) + days * 86400000).toISOString() : null;
  const contacts = (await s(env, `SELECT id,email_encrypted FROM contacts WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids).all()).results;
  const statements = [
    s(env, "UPDATE email_validation_jobs SET status=?,finished_at=?,error=?,polls=polls+1,api_calls=api_calls+1 WHERE id=? AND status='started'", error ? "failed" : "completed", at, error, job.id),
  ];
  const tally = {};
  for (const c of contacts) {
    const email = (await decryptPii(c.email_encrypted, env) || "").toLowerCase();
    const state = byEmail?.get(email) ?? "error";
    tally[state] = (tally[state] || 0) + 1;
    statements.push(
      s(
        env,
        // Só quem fechou a tarefa (mesmo finished_at) grava o resultado; execução concorrente não sobrescreve.
        "UPDATE contacts SET email_validation=?,email_validated_at=?,email_validation_provider=?,email_validation_expires_at=? WHERE id=? AND (SELECT finished_at FROM email_validation_jobs WHERE id=?)=?",
        state, at, SOURCE, state === "valid" ? expires : null, c.id, job.id, at,
      ),
    );
  }
  const r = await env.DB.batch(statements);
  if (!r[0].meta.changes) return { skipped: true };
  return { finished: true, tally, error };
}
