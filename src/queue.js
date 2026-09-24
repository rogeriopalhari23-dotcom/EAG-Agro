// Despacho das mensagens da fila por tipo. Tipo desconhecido volta à fila e, esgotadas as tentativas,
// vai para a fila de mensagens mortas (nada é confirmado sem processamento).
import { runPartition } from "./search.js";
import { geocodeUnit } from "./geocoding.js";
import { pollJob } from "./email-validation.js";
import { AdapterError } from "./adapters/errors.js";
import { runJob } from "./trade-list.js";

// Erro definitivo de provedor (chave, dado inválido) é registrado e descartado; temporário volta à fila.
const tolerant = (fn) => async (env, body) => {
  try {
    await fn(env, body);
  } catch (e) {
    if (e instanceof AdapterError && !e.retryable) {
      console.error("queue_provider_error", { kind: e.kind });
      return;
    }
    throw e;
  }
};
const handlers = {
  search_partition: (env, body) => runPartition(env, body.partitionId),
  geocode_unit: tolerant((env, body) => geocodeUnit(env, body.unitId)),
  email_validation_poll: (env, body) => pollJob(env, body.jobId),
  // Verificação operacional do consumidor (sem efeito em dados).
  ping: async (env, body) => console.log("queue_ping", { id: String(body.id ?? "").slice(0, 60) }),
  // Lista mensal: o job trata os próprios erros (lease, tentativas, falha registrada); a mensagem sempre é confirmada.
  trade_job: (env, body) => runJob(env, body.jobId),
};

export async function handleQueue(batch, env, extra = {}) {
  for (const message of batch.messages) {
    const handler = (extra.handlers || handlers)[message.body?.type];
    if (!handler) {
      console.error("queue_unknown_type", { type: message.body?.type ?? null });
      message.retry();
      continue;
    }
    try {
      await handler(env, message.body);
      message.ack();
    } catch (error) {
      // Erro inesperado (não classificado pelo adaptador): nova entrega pela política da fila.
      console.error("queue_handler_failed", { type: message.body.type });
      message.retry();
    }
  }
}
