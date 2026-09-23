// Snov.io — Email Verifier (P2-T7). Contrato lido em https://snov.io/api (2026-09-23):
// - POST https://api.snov.io/v1/oauth/access_token (grant_type=client_credentials, client_id, client_secret)
//   → {access_token, token_type:"Bearer", expires_in:3600}; usar "Authorization: Bearer <token>".
// - POST https://api.snov.io/v2/email-verification/start com emails[] (até 10) → {data:{task_hash}}.
// - GET  https://api.snov.io/v2/email-verification/result?task_hash=… → {status:"completed"|"in_progress", data:[{email,result:{smtp_status,unknown_status_reason,…}}]}
//   smtp_status: valid | not_valid | unknown (unknown_status_reason: catchall | banned …). Status "not_enough_credits" pode aparecer.
// - Limite: 60 requisições por minuto. Custo em créditos da verificação não confirmado na página (medir na conta).
import { AdapterError, httpError, fetchJson } from "./errors.js";

export const SOURCE = "snov:v2";
const BASE = "https://api.snov.io";
const memoryToken = { value: null, until: 0 };

async function token(env, fetchImpl, nowMs) {
  if (!env.SNOV_CLIENT_ID || !env.SNOV_CLIENT_SECRET) throw new AdapterError("auth", "Snov.io: credenciais não configuradas.");
  const cached = env.CACHE ? await env.CACHE.get("snov:token") : memoryToken.until > nowMs ? memoryToken.value : null;
  if (cached) return cached;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: env.SNOV_CLIENT_ID, client_secret: env.SNOV_CLIENT_SECRET });
  const { status, data } = await fetchJson(
    "Snov.io",
    `${BASE}/v1/oauth/access_token`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
    fetchImpl,
    10000,
  );
  if (status !== 200) throw httpError("Snov.io", status);
  if (!data?.access_token || !Number.isFinite(data.expires_in)) throw new AdapterError("schema", "Snov.io: token fora do esquema.");
  const ttl = Math.max(60, data.expires_in - 60);
  if (env.CACHE) await env.CACHE.put("snov:token", data.access_token, { expirationTtl: ttl });
  else Object.assign(memoryToken, { value: data.access_token, until: nowMs + ttl * 1000 });
  return data.access_token;
}

export async function startVerification(env, emails, fetchImpl = fetch, nowMs = Date.now()) {
  if (!emails.length || emails.length > 10) throw new AdapterError("invalid_request", "Snov.io: de 1 a 10 e-mails por tarefa.");
  const t = await token(env, fetchImpl, nowMs);
  const body = new URLSearchParams();
  for (const e of emails) body.append("emails[]", e);
  const { status, data } = await fetchJson(
    "Snov.io",
    `${BASE}/v2/email-verification/start`,
    { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/x-www-form-urlencoded" }, body },
    fetchImpl,
    15000,
  );
  if (status !== 200) throw httpError("Snov.io", status);
  const hash = data?.data?.task_hash;
  if (typeof hash !== "string" || !hash) throw new AdapterError("schema", "Snov.io: tarefa sem task_hash.");
  return hash;
}

// Só "valid" confirma; unknown/catchall/banned nunca viram válidos (G11).
export function mapResult(result) {
  if (!result || typeof result.smtp_status !== "string") return "error";
  if (result.smtp_status === "valid") return "valid";
  if (result.smtp_status === "not_valid") return "not_valid";
  if (result.smtp_status === "unknown") return result.unknown_status_reason === "catchall" ? "catchall" : "unknown";
  return "error";
}

export async function verificationResult(env, taskHash, fetchImpl = fetch, nowMs = Date.now()) {
  const t = await token(env, fetchImpl, nowMs);
  const { status, data } = await fetchJson(
    "Snov.io",
    `${BASE}/v2/email-verification/result?task_hash=${encodeURIComponent(taskHash)}`,
    { method: "GET", headers: { authorization: `Bearer ${t}` } },
    fetchImpl,
    15000,
  );
  if (status !== 200) throw httpError("Snov.io", status);
  if (data?.status === "not_enough_credits") throw new AdapterError("no_balance", "Snov.io: créditos insuficientes.");
  if (data?.status === "in_progress") return { done: false };
  if (data?.status !== "completed" || !Array.isArray(data.data)) throw new AdapterError("schema", "Snov.io: resultado fora do esquema.");
  const byEmail = new Map(data.data.map((x) => [String(x.email).toLowerCase(), mapResult(x.result)]));
  return { done: true, byEmail };
}
