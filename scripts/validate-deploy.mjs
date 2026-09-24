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
  assert.ok(onWorkersDev !== Boolean(config.routes?.length), "Use workers.dev ou rota em domínio próprio, não os dois");
  assert.ok(!config.queues && !config.triggers, "Adaptadores ainda não liberados");
  assert.ok(!config.r2_buckets, "R2 só na liberação da lista mensal");
  return { address: onWorkersDev ? "workers.dev" : "route" };
}

if (process.argv[1]?.endsWith("validate-deploy.mjs")) {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8").then((t) => t.replace(/^\s*\/\/.*$/gm, "")));
  const r = validateConfig(config);
  console.log(`Configuração estática válida (${r.address}). Confirme Access (aplicação no hostname e Bypass só em /u/*), segredos, usuário e backup antes de publicar.`);
}
