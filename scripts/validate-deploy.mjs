import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Portão estático antes de migrar ou publicar produção (P1-T12). Endereço: workers.dev da conta protegido pelo
// Access (decisão de Rogério em 2026-09-24) ou rota em domínio próprio — nos dois casos com Access configurado.
// Fila, cron e R2 continuam fora até a liberação por escrito (validação T1/T12).
export function validateConfig(config) {
  assert.equal(config.vars.ENVIRONMENT, "production");
  assert.equal(config.vars.ALLOW_LOCAL_AUTH, "false");
  assert.equal(config.preview_urls, false, "URLs de prévia ficam desligadas");
  assert.ok(/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.vars.ACCESS_TEAM_DOMAIN), "Configure ACCESS_TEAM_DOMAIN");
  assert.ok(config.vars.ACCESS_AUD.length > 10, "Configure ACCESS_AUD");
  assert.ok(
    /^[a-f0-9-]{36}$/.test(config.d1_databases[0].database_id) && !/^0+-/.test(config.d1_databases[0].database_id),
    "Configure o identificador real do D1",
  );
  const onWorkersDev = config.workers_dev === true;
  // Transição para o domínio próprio: workers.dev pode coexistir só com domínios personalizados (nunca rotas soltas).
  const routes = config.routes || [];
  assert.ok(onWorkersDev || routes.length, "Configure um endereço (workers.dev ou domínio próprio)");
  assert.ok(routes.every((r) => r.custom_domain === true && /^[a-z0-9.-]+$/.test(r.pattern)), "Só domínio personalizado, sem curinga");
  // Fila e cron liberados em 2026-09-24: só a fila da v2 com DLQ e limite de tentativas, e só os dois crons aprovados.
  if (config.queues) {
    const p = config.queues.producers || [], c = config.queues.consumers || [];
    assert.deepEqual(p.map((x) => [x.binding, x.queue]), [["ASYNC_QUEUE", "eag-compass-async"]], "Produtor da fila fora do aprovado");
    assert.equal(c.length, 1, "Um consumidor só");
    assert.equal(c[0].queue, "eag-compass-async");
    assert.equal(c[0].dead_letter_queue, "eag-compass-dlq", "Fila sem DLQ");
    assert.ok(Number.isInteger(c[0].max_retries) && c[0].max_retries >= 1 && c[0].max_retries <= 10, "Retentativas sem limite");
  }
  if (config.triggers) {
    const allowed = new Set(["*/5 * * * *", "17 2 * * *"]);
    assert.ok((config.triggers.crons || []).every((x) => allowed.has(x)), "Cron fora do aprovado");
  }
  assert.ok(!config.r2_buckets, "R2 só na liberação da lista mensal");
  return { address: onWorkersDev ? "workers.dev" : "route" };
}

if (process.argv[1]?.endsWith("validate-deploy.mjs")) {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8").then((t) => t.replace(/^\s*\/\/.*$/gm, "")));
  const r = validateConfig(config);
  console.log(`Configuração estática válida (${r.address}). Confirme Access (aplicação no hostname e Bypass só em /u/*), segredos, usuário e backup antes de publicar.`);
}
