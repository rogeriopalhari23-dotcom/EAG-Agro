// Token de descadastro (R21.7, R21.10): determinístico por versão da ficha + destinatário, sem PII,
// assinado com HMAC-SHA-256 (UNSUB_TOKEN_KEY). Fica dentro do texto aprovado, então o hash aprovado já o inclui.
import { fail } from "./http.js";
import { secretKey } from "./crypto.js";

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const key = (env) => secretKey(env, "UNSUB_TOKEN_KEY", { name: "HMAC", hash: "SHA-256" }, ["sign", "verify"]);

export async function unsubToken(env, versionId, contactId) {
  const payload = b64url(new TextEncoder().encode(`${versionId}.${contactId}`));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(env), new TextEncoder().encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

export async function unsubUrl(env, versionId, contactId) {
  if (!env.PUBLIC_BASE_URL || !/^https:\/\/[^/]+$/.test(env.PUBLIC_BASE_URL))
    fail(422, "public_base_url_missing", "Configure PUBLIC_BASE_URL (https://domínio, sem barra final) para o link de descadastro.");
  return `${env.PUBLIC_BASE_URL}/u/${await unsubToken(env, versionId, contactId)}`;
}

// Verificação em tempo constante (crypto.subtle.verify). Token inválido → null.
export async function readUnsubToken(env, token) {
  const m = /^([A-Za-z0-9_-]{8,200})\.([A-Za-z0-9_-]{20,100})$/.exec(String(token || ""));
  if (!m) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await key(env), unb64url(m[2]), new TextEncoder().encode(m[1]));
  } catch {
    return null;
  }
  if (!ok) return null;
  const [versionId, contactId] = new TextDecoder().decode(unb64url(m[1])).split(".");
  return versionId && contactId ? { versionId, contactId } : null;
}
