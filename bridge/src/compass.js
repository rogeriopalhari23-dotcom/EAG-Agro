// Cliente do Compass: chamadas POST assinadas (HMAC-SHA256 do corpo, carimbo de tempo, nonce de uso único) e, em
// produção, com o token de serviço do Cloudflare Access. Nunca registra corpo, segredo ou endereço.
import { createHash, createHmac, randomUUID } from "node:crypto";

export function signature(keyB64, method, path, ts, nonce, body) {
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  return createHmac("sha256", Buffer.from(keyB64, "base64")).update(`${method}\n${path}\n${ts}\n${nonce}\n${bodyHash}`, "utf8").digest("hex");
}

export class CompassError extends Error {
  constructor(status, code, message) {
    super(`${status} ${code}: ${message}`);
    this.status = status;
    this.code = code;
  }
}

export function compassClient({ baseUrl, hmacKey, accessClientId, accessClientSecret, fetchImpl = fetch, timeoutMs = 30000 }) {
  if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/localhost(:\d+)?$/.test(baseUrl)) throw new Error("COMPASS_URL precisa ser https.");
  return {
    async call(path, payload = {}) {
      const body = JSON.stringify(payload);
      const ts = String(Date.now());
      const nonce = randomUUID();
      const headers = {
        "content-type": "application/json",
        "x-bridge-timestamp": ts,
        "x-bridge-nonce": nonce,
        "x-bridge-signature": signature(hmacKey, "POST", path, ts, nonce, body),
      };
      if (accessClientId) Object.assign(headers, { "CF-Access-Client-Id": accessClientId, "CF-Access-Client-Secret": accessClientSecret });
      const res = await fetchImpl(`${baseUrl}${path}`, { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // resposta do Access (login) ou erro de borda: não é JSON do Compass
      }
      if (res.status >= 300) throw new CompassError(res.status, data?.error?.code ?? "http_error", data?.error?.message ?? `HTTP ${res.status}`);
      return data;
    },
  };
}
