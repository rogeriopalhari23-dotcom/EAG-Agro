export class ApiException extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
export const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};
export const response = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...securityHeaders,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
export function fail(status, code, message, details) {
  throw new ApiException(status, code, message, details);
}
export function assertSameOrigin(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  if (request.headers.get("sec-fetch-site") === "cross-site")
    fail(403, "cross_origin", "Origem da requisição não autorizada.");
  if (request.headers.get("origin") !== new URL(request.url).origin)
    fail(
      403,
      "origin_required",
      "Envie Origin correspondente ao endereço da plataforma.",
    );
}
export async function bodyJson(request) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("content-type") || "",
    )
  )
    fail(415, "unsupported_media_type", "Envie application/json.");
  const max = 65536;
  if (Number(request.headers.get("content-length")) > max)
    fail(413, "body_too_large", "Limite de 64 KB por requisição.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "invalid_json", "O corpo JSON é obrigatório.");
  let length = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > max) {
      await reader.cancel();
      fail(413, "body_too_large", "Limite de 64 KB por requisição.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(400, "invalid_json", "O corpo JSON é inválido.");
  }
  if (!value || Array.isArray(value) || typeof value !== "object")
    fail(422, "invalid_object", "Envie um objeto JSON.");
  return value;
}
export function str(value, name, max = 500, optional = false) {
  if (optional && (value === undefined || value === null || value === ""))
    return null;
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(422, "invalid_field", `Campo inválido: ${name}.`);
  return value.trim();
}
export function oneOf(value, allowed, name) {
  if (!allowed.includes(value))
    fail(422, "invalid_field", `Valor inválido para ${name}.`, { allowed });
  return value;
}
export function number(value, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail(422, "invalid_field", `Número inválido: ${name}.`);
  return value;
}
export function date(value, name, { future = false, optional = false } = {}) {
  if (optional && !value) return null;
  str(value, name, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10) ||
    (!future && Date.parse(value) > Date.now())
  )
    fail(422, "invalid_date", `Data inválida: ${name}.`);
  return new Date(value).toISOString();
}
export function url(value, name = "URL") {
  if (value === undefined || value === null || value === "") return null;
  str(value, name, 2000);
  let u;
  try {
    u = new URL(value);
  } catch {
    fail(422, "invalid_url", `URL inválida: ${name}.`);
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    fail(422, "invalid_url", `URL inválida: ${name}.`);
  return u.href;
}
export function page(request) {
  const p = new URL(request.url).searchParams;
  const limit = Number(p.get("limit") || 50),
    offset = Number(p.get("offset") || 0);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    fail(422, "invalid_pagination", "Paginação inválida.");
  return { limit, offset };
}
export const WRITE_ROLES = new Set([
  "admin",
  "commercial_manager",
  "seller_analyst",
]);
export const APPROVER_ROLES = new Set(["admin", "commercial_manager"]);
export function requireRole(actor, allowed) {
  if (!allowed.has(actor.role))
    fail(403, "forbidden", "Seu perfil não permite esta ação.");
}
