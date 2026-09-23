import { createRemoteJWKSet, jwtVerify } from "jose";
import { fail } from "./http.js";
const keysets = new Map();
export function localAuthAllowed(request, env) {
  return (
    env.ENVIRONMENT === "local" &&
    env.ALLOW_LOCAL_AUTH === "true" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(request.url).hostname)
  );
}
export function accessConfig(env) {
  let issuer;
  try {
    issuer = new URL(env.ACCESS_TEAM_DOMAIN);
  } catch {
    fail(
      503,
      "auth_not_configured",
      "Cloudflare Access ainda não está configurado.",
    );
  }
  if (
    issuer.protocol !== "https:" ||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer.hostname) ||
    issuer.pathname !== "/" ||
    issuer.search ||
    issuer.hash ||
    issuer.port ||
    issuer.username ||
    issuer.password ||
    !env.ACCESS_AUD
  )
    fail(
      503,
      "auth_not_configured",
      "Configuração do Cloudflare Access inválida.",
    );
  return { issuer: issuer.origin, audience: env.ACCESS_AUD };
}
export async function verifyAccessToken(token, config, keys) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "email"],
    clockTolerance: 5,
  });
  if (payload.iat > Math.floor(Date.now() / 1000) + 5)
    throw new Error("Invalid issued at");
  if (
    typeof payload.email !== "string" ||
    !payload.email.includes("@") ||
    typeof payload.sub !== "string" ||
    !payload.sub
  )
    throw new Error("Invalid identity");
  return payload.email.trim().toLowerCase();
}
export async function getActor(request, env) {
  if (!env.DB)
    fail(503, "database_unavailable", "Banco de dados não configurado.");
  const tenant = env.DEFAULT_TENANT_ID;
  if (!tenant) fail(503, "tenant_not_configured", "Operação não configurada.");
  let email;
  if (localAuthAllowed(request, env))
    email = env.LOCAL_USER_EMAIL || "admin@local.eag";
  else {
    const config = accessConfig(env),
      token = request.headers.get("cf-access-jwt-assertion");
    if (!token)
      fail(
        401,
        "authentication_required",
        "Autenticação pelo Cloudflare Access obrigatória.",
      );
    if (!keysets.has(config.issuer))
      keysets.set(
        config.issuer,
        createRemoteJWKSet(new URL(`${config.issuer}/cdn-cgi/access/certs`), {
          timeoutDuration: 5000,
          cooldownDuration: 30000,
        }),
      );
    try {
      email = await verifyAccessToken(
        token,
        config,
        keysets.get(config.issuer),
      );
    } catch {
      fail(
        401,
        "invalid_token",
        "Sessão inválida ou expirada. Entre novamente.",
      );
    }
  }
  const actor = await env.DB.prepare(
    `SELECT u.id,u.tenant_id,u.email,u.display_name,u.role FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.tenant_id=? AND lower(u.email)=? AND u.status='active' AND t.status='active'`,
  )
    .bind(tenant, email.toLowerCase())
    .first();
  if (
    !actor ||
    (!localAuthAllowed(request, env) && actor.id === "system-admin")
  )
    fail(
      403,
      "user_not_authorized",
      "Usuário sem acesso. Solicite o cadastro ao administrador.",
    );
  return actor;
}
