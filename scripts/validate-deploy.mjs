import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const config = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);
assert.equal(config.vars.ENVIRONMENT, "production");
assert.equal(config.vars.ALLOW_LOCAL_AUTH, "false");
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert.ok(
  /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
    config.vars.ACCESS_TEAM_DOMAIN,
  ),
  "Configure ACCESS_TEAM_DOMAIN",
);
assert.ok(config.vars.ACCESS_AUD.length > 10, "Configure ACCESS_AUD");
assert.ok(
  /^[a-f0-9-]{36}$/.test(config.d1_databases[0].database_id) &&
    !/^0+-/.test(config.d1_databases[0].database_id),
  "Configure o identificador real do D1",
);
assert.ok(config.routes?.length, "Configure o domínio protegido pelo Access");
assert.ok(
  !config.queues && !config.triggers,
  "Adaptadores ainda não liberados",
);
console.log(
  "Configuração estática válida. Confirme Access, segredos, usuário e backup conforme README antes de publicar.",
);
