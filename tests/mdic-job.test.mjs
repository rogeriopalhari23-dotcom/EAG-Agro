import test from "node:test";
import assert from "node:assert/strict";
import tls from "node:tls";
import { readFileSync } from "node:fs";
import { createHash, X509Certificate } from "node:crypto";
import { loadTrust, trustedFetch, PINNED_PATH } from "../scripts/lib/mdic-tls.mjs";
import { run, publishSql } from "../scripts/mdic-job.mjs";
import { sources, AGRI, MDIC_ROWS } from "./helpers/trade.mjs";

const pem = readFileSync(PINNED_PATH, "utf8");
const sha = (s) => createHash("sha256").update(s).digest("hex");

test("MDIC/TLS: intermediário fixado confere impressão, validade e assinatura por raiz pública", () => {
  const t = loadTrust();
  assert.match(t.intermediate, /Sectigo Public Server Authentication CA OV R36/);
  assert.match(t.root, /Sectigo Public Server Authentication Root R46/);
  assert.equal(t.ca.length, tls.rootCertificates.length + 1, "raízes públicas + intermediário como elo");
  // Outro certificado no lugar do fixado → recusado pela impressão.
  assert.throws(() => loadTrust({ pem: tls.rootCertificates[0] }), /impressão inesperada/);
  // Fora da validade → recusado.
  assert.throws(() => loadTrust({ now: new Date("2037-01-01") }), /fora da validade/);
  // Sem a raiz emissora na loja → cadeia não validada (o intermediário nunca vira âncora).
  const semR46 = tls.rootCertificates.filter((r) => !new X509Certificate(r).subject.includes("Root R46"));
  assert.ok(semR46.length < tls.rootCertificates.length);
  assert.throws(() => loadTrust({ pem, roots: semR46 }), /cadeia não validada/);
});

test("MDIC/TLS: fetch confiável só aceita HTTPS", async () => {
  await assert.rejects(trustedFetch(loadTrust())("http://balanca.economia.gov.br/x"), /Só HTTPS/);
});

// R2 e D1 em memória no lugar do wrangler.
function fakeDb({ tamper = false, versionStatus = null } = {}) {
  const r2 = new Map();
  const executed = [];
  let published = null;
  return {
    r2, executed,
    get published() {
      return published;
    },
    query(sql) {
      if (sql.includes("agri_classification")) return [{ value_json: JSON.stringify(AGRI) }];
      if (sql.includes("trade_list_mdic_years")) return [{ value_json: "2" }];
      if (sql.includes("FROM country_mdic_codes")) return [{ mdic_code: "023", iso3: "DEU" }, { mdic_code: "025", iso3: "DEU" }, { mdic_code: "249", iso3: "USA" }, { mdic_code: "607", iso3: "PRT" }];
      if (sql.includes("SELECT status FROM trade_list_versions")) return published ? [{ status: "complete" }] : versionStatus ? [{ status: versionStatus }] : [];
      throw new Error("consulta inesperada: " + sql);
    },
    put(key, path) {
      r2.set(key, tamper ? "adulterado" : readFileSync(path, "utf8"));
    },
    get(key) {
      return r2.get(key);
    },
    execFile(path) {
      const sql = readFileSync(path, "utf8");
      executed.push(sql);
      if (sql.includes("SET status='complete'")) published = sql;
    },
  };
}
const base = "https://mdic.test/bd";

test("MDIC/job: Alemanha soma 023+025, grava no R2, confere hash e publica com 'complete' por último", async () => {
  const db = fakeDb();
  const src = sources();
  const r = await run({ iso3: "DEU", month: "2026-10", db, fetchImpl: src.fetchImpl, base, log: () => {}, runId: "teste", sleep: async () => {} });
  assert.equal(r.published, true);
  assert.equal(r.versionId, "2026-10-mdic-DEU-teste");
  const obj = JSON.parse(db.r2.get("trade-src/2026-10-mdic-DEU-teste/mdic/DEU.json"));
  assert.equal(obj.lines.find((l) => l.ncm === "09011110" && l.ym === "2026-01").fobUsd, 101500, "023 + 025 somados");
  assert.equal(obj.fileLastPeriod, "2026-03", "último mês do arquivo inteiro, não só do país");
  assert.equal(obj.basis, "FOB");
  const sql = db.executed[0];
  assert.ok(sql.indexOf("'running'") < sql.indexOf("trade_list_current") && sql.indexOf("trade_list_current") < sql.indexOf("SET status='complete'"), "ordem: versão, ponteiros, complete");
  assert.match(sql, /'manual','DEU'/);
  assert.match(sql, new RegExp(sha(db.r2.get("trade-src/2026-10-mdic-DEU-teste/mdic/DEU.json"))));
});

test("MDIC/job: objeto adulterado no R2 cancela antes de publicar (nada no D1)", async () => {
  const db = fakeDb({ tamper: true });
  await assert.rejects(run({ iso3: "DEU", month: "2026-10", db, fetchImpl: sources().fetchImpl, base, log: () => {}, runId: "t", sleep: async () => {} }), /difere do gerado/);
  assert.equal(db.executed.length, 0);
});

test("MDIC/job: MDIC fora do ar falha antes de gravar qualquer coisa; mensal já completo não refaz", async () => {
  const db = fakeDb();
  await assert.rejects(run({ month: "2026-10", db, fetchImpl: sources({ mdicDown: true }).fetchImpl, base, log: () => {}, sleep: async () => {} }));
  assert.equal(db.r2.size, 0);
  assert.equal(db.executed.length, 0);
  const done = fakeDb({ versionStatus: "complete" });
  const r = await run({ month: "2026-10", db: done, fetchImpl: sources().fetchImpl, base, log: () => {} });
  assert.equal(r.skipped, true);
  assert.equal(done.r2.size, 0);
});

test("MDIC/job: arquivo republicado no meio da leitura recomeça o ano sem misturar publicações", async () => {
  let n = 0;
  const db = fakeDb();
  const src = sources({ etags: { 2026: () => (n++ < 1 ? '"a1"' : '"a2"') } });
  const r = await run({ iso3: "DEU", month: "2026-10", db, fetchImpl: src.fetchImpl, base, log: () => {}, runId: "r", sleep: async () => {} });
  const obj = JSON.parse(db.r2.get(`trade-src/${r.versionId}/mdic/DEU.json`));
  assert.equal(obj.lines.find((l) => l.ym === "2026-01").fobUsd, 101500, "sem duplicar a leitura abortada");
  assert.equal(obj.validators["2026"].etag, '"a2"');
});

test("MDIC/job: SQL de publicação é idempotente e o ponteiro só avança (CAS por started_at)", () => {
  const sql = publishSql({ versionId: "v", kind: "monthly", iso3: null, month: "2026-10", classification: AGRI, params: {}, validators: {}, objects: [{ iso3: "DEU", key: "k", sha: "h", state: "no_record", lastPeriod: "2026-03", lines: 0 }], at: "t", note: null });
  assert.match(sql, /INSERT OR IGNORE INTO trade_list_versions/);
  assert.match(sql, /ON CONFLICT\(version_id,iso3,source\) DO UPDATE/);
  assert.match(sql, /WHERE \(SELECT started_at FROM trade_list_versions WHERE id=trade_list_current.version_id\) <= /);
  void MDIC_ROWS;
});

test("MDIC/job: conexões derrubadas ao acaso — novas tentativas por pedaço recuperam sem duplicar", async () => {
  const db = fakeDb();
  const src = sources();
  let resets = 0;
  const waits = [];
  const flaky = async (url, init = {}) => {
    if (init.headers?.Range && resets < 5) {
      resets++;
      throw new TypeError("fetch failed: ECONNRESET");
    }
    return src.fetchImpl(url, init);
  };
  const r = await run({ iso3: "DEU", month: "2026-10", db, fetchImpl: flaky, base, log: () => {}, runId: "f", sleep: async (ms) => waits.push(ms) });
  assert.equal(r.published, true);
  assert.deepEqual(waits, [5000, 10000, 20000, 40000, 60000], "espera crescente com teto de 60 s");
  const obj = JSON.parse(db.r2.get("trade-src/2026-10-mdic-DEU-f/mdic/DEU.json"));
  assert.equal(obj.lines.find((l) => l.ncm === "09011110" && l.ym === "2026-01").fobUsd, 101500);
});
