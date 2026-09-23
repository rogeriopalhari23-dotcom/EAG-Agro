// Erro de fonte externa. `kind` decide o destino da tarefa:
// temporary → nova tentativa com atraso; demais → falha registrada, nunca "resultado vazio".
export class AdapterError extends Error {
  constructor(kind, message, details = {}) {
    super(message);
    this.name = "AdapterError";
    this.kind = kind; // temporary | auth | no_balance | invalid_request | schema | incomplete | filter_not_applied | not_found
    this.details = details;
  }
  get retryable() {
    return this.kind === "temporary" || this.kind === "incomplete";
  }
}

// Classificação comum de respostas HTTP. Nunca inclui cabeçalhos nem corpo da requisição.
export function httpError(source, status) {
  if (status === 401) return new AdapterError("auth", `${source}: credencial recusada (401).`);
  if (status === 429) return new AdapterError("temporary", `${source}: limite de requisições (429).`);
  if (status >= 500) return new AdapterError("temporary", `${source}: erro do provedor (${status}).`);
  return new AdapterError("invalid_request", `${source}: requisição recusada (${status}).`);
}

export async function fetchJson(source, url, init, fetchImpl, timeoutMs) {
  let r;
  try {
    r = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new AdapterError("temporary", `${source}: sem resposta (${e?.name === "TimeoutError" ? "tempo esgotado" : "falha de rede"}).`);
  }
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Página HTML (ex.: desafio anti-robô) não é resultado: vira erro temporário registrado.
    throw new AdapterError("temporary", `${source}: resposta não é JSON (${r.status}).`, { nonJson: true });
  }
  return { status: r.status, data };
}
