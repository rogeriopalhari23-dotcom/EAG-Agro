import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateConfig } from "../scripts/validate-deploy.mjs";

const real = () => JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, ""));
const ready = (over = {}) => {
  const c = real();
  c.vars = { ...c.vars, ACCESS_TEAM_DOMAIN: "https://eag.cloudflareaccess.com", ACCESS_AUD: "a".repeat(64) };
  return Object.assign(c, over);
};

test("P1-T12: config real aponta para o Worker e o D1 existentes e usa workers.dev", () => {
  const c = real();
  assert.equal(c.name, "eag-compass-production");
  assert.equal(c.d1_databases[0].database_name, "eag_compass");
  assert.equal(c.workers_dev, true);
  assert.equal(c.preview_urls, false);
  assert.equal(c.env.local.d1_databases[0].database_name, "eag-compass-db", "ambiente local preservado");
});

test("P1-T12: portão recusa publicar sem Access configurado", () => {
  assert.throws(() => validateConfig(real()), /ACCESS_TEAM_DOMAIN/);
  assert.deepEqual(validateConfig(ready()), { address: "workers.dev" });
});

test("P1-T12: portão segura fila, cron e R2 até a liberação e exige um endereço só", () => {
  assert.throws(() => validateConfig(ready({ queues: { producers: [] } })), /Adaptadores/);
  assert.throws(() => validateConfig(ready({ triggers: { crons: ["*/5 * * * *"] } })), /Adaptadores/);
  assert.throws(() => validateConfig(ready({ r2_buckets: [{ binding: "FILES" }] })), /R2/);
  assert.throws(() => validateConfig(ready({ routes: [{ pattern: "compass.exemplo.com", custom_domain: true }] })), /não os dois/);
  assert.deepEqual(validateConfig(ready({ workers_dev: false, routes: [{ pattern: "compass.exemplo.com", custom_domain: true }] })), { address: "route" });
  assert.throws(() => validateConfig(ready({ preview_urls: true })), /prévia/);
});
