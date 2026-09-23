import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { build } from "esbuild";
import { unstable_splitSqlQuery } from "wrangler";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
export async function runtime() {
  const root = resolve(import.meta.dirname, "../..");
  // The maintenance route exists only in this test wrapper, never in src/ or public/.
  const built = await build({
    stdin: {
      contents: `import worker from './src/worker.js'; export default {async fetch(r,e){if(new URL(r.url).pathname==='/__test/sql'){try{const queries=await r.json();return Response.json(await e.DB.batch(queries.map(q=>e.DB.prepare(q))));}catch(x){return Response.json({error:String(x)},{status:500})}}return worker.fetch(r,e)}}`,
      resolveDir: root,
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
  });
  const m = new Miniflare(
    convertV4MiniflareOptions({
      cf: false,
      modules: true,
      compatibilityDate: "2026-09-21",
      script: built.outputFiles[0].text,
      d1Databases: ["DB"],
      bindings: {
        ENVIRONMENT: "local",
        ALLOW_LOCAL_AUTH: "true",
        DEFAULT_TENANT_ID: "eag-internal",
        LOCAL_USER_EMAIL: "admin@local.eag",
        PII_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
        SUPPRESSION_HMAC_KEY: Buffer.alloc(32, 2).toString("base64"),
      },
    }),
  );
  const address = await m.ready;
  async function call(path, method = "GET", body) {
    const r = await m.dispatchFetch(`http://localhost${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json();
    return { status: r.status, data };
  }
  async function sql(source) {
    const r = await call("/__test/sql", "POST", unstable_splitSqlQuery(source));
    if (r.status !== 200) throw new Error(JSON.stringify(r.data));
    return r.data;
  }
  async function migrate() {
    for (const name of (await readdir(resolve(root, "migrations")))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      await sql(await readFile(resolve(root, "migrations", name), "utf8"));
  }
  return { m, address, call, sql, migrate, close: () => m.dispose() };
}
