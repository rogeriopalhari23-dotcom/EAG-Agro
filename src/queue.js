// Despacho das mensagens da fila por tipo. Tipo desconhecido é descartado com registro (sem reprocessar lixo).
import { runPartition } from "./search.js";

const handlers = {
  search_partition: (env, body) => runPartition(env, body.partitionId),
};

export async function handleQueue(batch, env, extra = {}) {
  for (const message of batch.messages) {
    const handler = (extra.handlers || handlers)[message.body?.type];
    if (!handler) {
      console.error("queue_unknown_type", { type: message.body?.type ?? null });
      message.ack();
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
