import { fail } from "./http.js";
const cache = new Map();
const encode = (bytes) => btoa(String.fromCharCode(...bytes));
const decode = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export async function secretKey(env, name, algorithm, usage) {
  const value = env[name];
  let raw;
  try {
    raw = decode(value);
  } catch {}
  if (!raw || raw.length !== 32)
    fail(503, "secret_unavailable", `Chave ${name} ausente ou inválida.`);
  const id = `${name}:${value}`;
  if (!cache.has(id)) {
    if (cache.size >= 8) cache.clear();
    cache.set(id, crypto.subtle.importKey("raw", raw, algorithm, false, usage));
  }
  return cache.get(id);
}
export async function encryptPii(value, env) {
  if (value == null || value === "") return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await secretKey(env, "PII_ENCRYPTION_KEY", "AES-GCM", [
    "encrypt",
    "decrypt",
  ]);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `${encode(iv)}.${encode(new Uint8Array(data))}`;
}
export async function decryptPii(value, env) {
  if (!value) return null;
  const key = await secretKey(env, "PII_ENCRYPTION_KEY", "AES-GCM", [
    "encrypt",
    "decrypt",
  ]);
  try {
    const [iv, data] = value.split(".");
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decode(iv) },
        key,
        decode(data),
      ),
    );
  } catch {
    fail(
      503,
      "pii_unavailable",
      "Contato indisponível: confira a chave e a integridade dos dados.",
    );
  }
}
export function normalizeIdentifier(channel, value) {
  const v = value.trim();
  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      fail(422, "invalid_identifier", "E-mail inválido.");
    return v.toLowerCase();
  }
  if (channel === "phone") {
    if (!/^\+[1-9][0-9 ()-]{7,18}$/.test(v))
      fail(422, "invalid_identifier", "Use telefone com + e código do país.");
    return v.replace(/[^\d+]/g, "");
  }
  let u;
  try {
    u = new URL(v);
  } catch {
    fail(422, "invalid_identifier", "URL de LinkedIn inválida.");
  }
  if (
    u.protocol !== "https:" ||
    !["linkedin.com", "www.linkedin.com"].includes(u.hostname) ||
    !/^\/in\/[^/]+\/?$/.test(u.pathname)
  )
    fail(422, "invalid_identifier", "Use a URL https de um perfil LinkedIn.");
  return `https://linkedin.com${u.pathname.replace(/\/$/, "").toLowerCase()}`;
}
export async function identifierHash(env, tenant, channel, value) {
  const key = await secretKey(
    env,
    "SUPPRESSION_HMAC_KEY",
    { name: "HMAC", hash: "SHA-256" },
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      `${tenant}:${channel}:${normalizeIdentifier(channel, value)}`,
    ),
  );
  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
