// Confiança TLS para o servidor do MDIC (balanca.mdic.gov.br, endereço oficial vigente em 2026-10-21; o antigo
// balanca.economia.gov.br serve certificado vencido em 03/10/2026), que envia só o certificado folha.
// NÃO desliga verificação: a conexão usa as raízes públicas do Node (Mozilla) + o intermediário SERPRO AR46 OV TLS CA 2025 só como
// elo da cadeia. O intermediário sozinho não é âncora (prova em EVIDENCIAS: sem as raízes a conexão falha).
// A cada execução: impressão SHA-256 fixada, validade e assinatura por uma raiz pública conferidas antes de qualquer download.
import https from "node:https";
import tls from "node:tls";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";

export const PINNED_PATH = new URL("../../certs/serpro-ar46-ov-tls-ca-2025.pem", import.meta.url);
// Obtido em 2026-10-21 do endereço AIA do próprio certificado do MDIC (*.mdic.gov.br):
// http://secure.globalsign.com/cacert/acserproar46ovtlsca2025.crt (emitido por GlobalSign Root R46; válido até 2030-10-15).
// O intermediário anterior (Sectigo OV R36, certs/sectigo-…) era do host antigo e fica só no histórico.
export const PINNED_SHA256 = "F2:70:95:D0:B4:0D:F7:65:59:94:04:01:1C:F8:B1:67:DA:06:26:0E:81:DD:A7:27:F1:63:EF:08:22:10:71:E4";

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
