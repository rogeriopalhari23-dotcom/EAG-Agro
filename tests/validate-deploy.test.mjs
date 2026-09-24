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
  const semAccess = real();
  semAccess.vars = { ...semAccess.vars, ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" };
  assert.throws(() => validateConfig(semAccess), /ACCESS_TEAM_DOMAIN/);
  assert.deepEqual(validateConfig(real()), { address: "workers.dev" }, "config real com Access preenchido passa no portão");
  assert.deepEqual(validateConfig(ready()), { address: "workers.dev" });
});

test("P1-T12: fila só com DLQ e limite, crons aprovados, R2 segurado e um endereço só", () => {
  const q = real().queues;
  assert.throws(() => validateConfig(ready({ queues: { ...q, consumers: [{ ...q.consumers[0], dead_letter_queue: undefined }] } })), /DLQ/);
  assert.throws(() => validateConfig(ready({ queues: { ...q, consumers: [{ ...q.consumers[0], max_retries: undefined }] } })), /Retentativas/);
  assert.throws(() => validateConfig(ready({ queues: { ...q, producers: [{ binding: "ASYNC_QUEUE", queue: "eag-scores-queue" }] } })), /Produtor/);
  assert.throws(() => validateConfig(ready({ triggers: { crons: ["* * * * *"] } })), /Cron fora/);
  assert.throws(() => validateConfig(ready({ r2_buckets: [{ binding: "FILES" }] })), /R2/);
  assert.throws(() => validateConfig(ready({ routes: [{ pattern: "compass.exemplo.com", custom_domain: true }] })), /não os dois/);
  assert.deepEqual(validateConfig(ready({ workers_dev: false, routes: [{ pattern: "compass.exemplo.com", custom_domain: true }] })), { address: "route" });
  assert.throws(() => validateConfig(ready({ preview_urls: true })), /prévia/);
});

test("P1-T12: consumidor confirma ping e devolve tipo desconhecido para nova tentativa (vai à DLQ ao esgotar)", async () => {
  const { handleQueue } = await import("../src/queue.js");
  const msg = (body) => ({ body, acked: false, retried: false, ack() { this.acked = true; }, retry() { this.retried = true; } });
  const ping = msg({ type: "ping", id: "verificacao" }), strange = msg({ type: "desconhecido" });
  await handleQueue({ messages: [ping, strange] }, {});
  assert.deepEqual([ping.acked, ping.retried, strange.acked, strange.retried], [true, false, false, true]);
});

test("P1-T12: cron em produção sem credenciais de e-mail, canal planejado e sem R2 não envia nem quebra", async () => {
  const { setup } = await import("./helpers/db.mjs");
  const worker = (await import("../src/worker.js")).default;
  const ctx = setup();
  try {
    const errors = [];
    const orig = console.error;
    console.error = (...a) => errors.push(a[0]);
    try {
      for (const cron of ["*/5 * * * *", "17 2 * * *"]) await worker.scheduled({ cron, scheduledTime: Date.now() }, ctx.env);
    } finally {
      console.error = orig;
    }
    const one = (sql) => ctx.DB.raw.prepare(sql).get();
    assert.equal(one("SELECT COUNT(*) n FROM send_log").n, 0);
    assert.equal(one("SELECT COUNT(*) n FROM send_outbox WHERE status NOT IN ('pending','cancelled')").n, 0);
    assert.equal(one("SELECT COUNT(*) n FROM trade_list_versions").n, 0, "sem R2 a rotina mensal não cria versão");
    assert.equal(one("SELECT state FROM channels WHERE channel='email'").state, "planned");
    // Falhas esperadas ficam registradas no log, sem derrubar a execução.
    assert.ok(errors.every((e) => ["inbound_poll_failed", "trade_list_daily_failed"].includes(e)), JSON.stringify(errors));
  } finally {
    ctx.close();
  }
});
