// Confiança TLS para o servidor do MDIC (balanca.economia.gov.br), que envia só o certificado folha.
// NÃO desliga verificação: a conexão usa as raízes públicas do Node (Mozilla) + o intermediário Sectigo OV R36 só como
// elo da cadeia. O intermediário sozinho não é âncora (prova em EVIDENCIAS: sem as raízes a conexão falha).
// A cada execução: impressão SHA-256 fixada, validade e assinatura por uma raiz pública conferidas antes de qualquer download.
import https from "node:https";
import tls from "node:tls";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";

export const PINNED_PATH = new URL("../../certs/sectigo-public-server-authentication-ca-ov-r36.pem", import.meta.url);
// Obtido em 2026-09-25 do endereço AIA do próprio certificado do MDIC:
// http://crt.sectigo.com/SectigoPublicServerAuthenticationCAOVR36.crt (emitido por Sectigo Public Server Authentication Root R46).
export const PINNED_SHA256 = "65:42:D1:76:BE:D5:0F:19:3C:0C:E2:97:AE:44:EC:D8:A0:A8:6B:EC:2E:DE:68:27:69:34:40:59:B4:E7:85:30";

export function loadTrust({ pem = readFileSync(PINNED_PATH, "utf8"), roots = tls.rootCertificates, now = new Date() } = {}) {
  const inter = new X509Certificate(pem);
  if (inter.fingerprint256 !== PINNED_SHA256) throw new Error(`Intermediário fixado com impressão inesperada (${inter.fingerprint256}).`);
  if (now < new Date(inter.validFrom) || now > new Date(inter.validTo)) throw new Error(`Intermediário fora da validade (${inter.validFrom} a ${inter.validTo}).`);
  const issuer = roots.map((r) => new X509Certificate(r)).find((root) => inter.checkIssued(root) && inter.verify(root.publicKey));
  if (!issuer) throw new Error("Intermediário não é assinado por nenhuma raiz pública da loja do Node: cadeia não validada.");
  return { ca: [...roots, pem], intermediate: inter.subject.replace(/\n/g, ", "), root: issuer.subject.replace(/\n/g, ", "), validTo: inter.validTo };
}

// fetch mínimo sobre https com a loja acima (HEAD e GET com Range), no formato Response que os adaptadores usam.
export function trustedFetch(trust, { timeoutMs = 120000 } = {}) {
  return (url, init = {}) =>
    new Promise((resolve, reject) => {
      const u = new URL(url);
      if (u.protocol !== "https:") return reject(new Error("Só HTTPS."));
      const req = https.request(
        { host: u.hostname, path: u.pathname + u.search, method: init.method || "GET", headers: init.headers || {}, ca: trust.ca, timeout: timeoutMs },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const headers = new Headers();
            for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
            const body = init.method === "HEAD" || res.statusCode === 204 ? null : Buffer.concat(chunks);
            resolve(new Response(body, { status: res.statusCode, headers }));
          });
          res.on("error", reject);
        },
      );
      req.on("timeout", () => req.destroy(new Error("tempo esgotado")));
      req.on("error", reject);
      if (init.signal) init.signal.addEventListener("abort", () => req.destroy(new Error("abortado")), { once: true });
      req.end();
    });
}
