import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import worker from "../../src/worker.js";
export class D1Test {
  constructor() {
    this.raw = new DatabaseSync(":memory:");
    this.raw.exec("PRAGMA foreign_keys=ON");
  }
  prepare(sql) {
    const db = this;
    let args = [];
    return {
      sql,
      bind(...a) {
        args = a;
        return this;
      },
      async first() {
        return db.raw.prepare(sql).get(...args) || null;
      },
      async all() {
        return { results: db.raw.prepare(sql).all(...args), success: true };
      },
      async run() {
        const stmt = db.raw.prepare(sql);
        if (stmt.columns().length) {
          return {
            results: stmt.all(...args),
            meta: { changes: 0 },
            success: true,
          };
        }
        return { results: [], meta: stmt.run(...args), success: true };
      },
    };
  }
  async batch(statements) {
    this.raw.exec("BEGIN");
    try {
      const result = [];
      for (const s of statements) result.push(await s.run());
      this.raw.exec("COMMIT");
      return result;
    } catch (e) {
      this.raw.exec("ROLLBACK");
      throw e;
    }
  }
}
export const migrations = readdirSync(
  new URL("../../migrations/", import.meta.url),
)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) =>
    readFileSync(new URL(`../../migrations/${f}`, import.meta.url), "utf8"),
  );
export function setup() {
  const DB = new D1Test();
  for (const sql of migrations) {
    DB.raw.exec("BEGIN");
    try {
      DB.raw.exec(sql);
      DB.raw.exec("COMMIT");
    } catch (e) {
      DB.raw.exec("ROLLBACK");
      throw e;
    }
  }
  const env = {
    DB,
    ENVIRONMENT: "local",
    ALLOW_LOCAL_AUTH: "true",
    LOCAL_USER_EMAIL: "admin@local.eag",
    DEFAULT_TENANT_ID: "eag-internal",
    PII_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    SUPPRESSION_HMAC_KEY: Buffer.alloc(32, 2).toString("base64"),
  };
  async function api(path, method = "GET", body, extra = {}) {
    const res = await worker.fetch(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
    return { status: res.status, data: await res.json(), headers: res.headers };
  }
  return { DB, env, api, close: () => DB.raw.close() };
}
export const create = async (api) =>
  (
    await api("/api/companies", "POST", {
      legalName: "Empresa Teste",
      countryCode: "BR",
      sourceLabel: "Teste controlado",
    })
  ).data.id;
export const field = (key, value) => ({
  key,
  value,
  status: "confirmed",
  sourceReference: "Documento verificado no teste",
});
export const demand = (fields = []) => ({
  productId: "product-03",
  market: "national",
  fields,
});
