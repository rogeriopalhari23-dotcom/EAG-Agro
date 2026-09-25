#!/usr/bin/env node
// Job mensal do MDIC fora do Worker (P3-T5/T12; decisão de Rogério em 2026-09-25, opção "a").
// Motivo: o servidor do MDIC envia só o certificado folha e o fetch do Worker responde 526; aqui a cadeia é completada
// com o intermediário público fixado (scripts/lib/mdic-tls.mjs), sem desligar verificação.
//
// Fluxo (nada fica visível antes do passo 5):
//   1. confere a confiança TLS; 2. lê parâmetros aprovados e códigos de país no D1;
//   3. lê EXP_<ano>.csv por Range (8 MiB) e agrega por país (mesmo código do Worker: src/mdic-aggregate.js);
//   4. grava um objeto por país no R2 sob prefixo exclusivo da versão e confere amostras pelo hash;
//   5. publica no D1 num único arquivo SQL: versão "running", estados, ponteiros (CAS monotônico) e por último "complete".
// Falha antes do passo 5: nada publicado (objetos sem ponteiro no prefixo da versão; a rotina mensal regrava as mesmas chaves).
// Falha no meio do passo 5: cada ponteiro só troca para um objeto inteiro já conferido por hash; a versão fica "running"
// (a rotina mensal não é dada como feita) e reexecutar com os mesmos parâmetros completa a publicação (SQL idempotente).
//
// Uso: node scripts/mdic-job.mjs [--iso3 DEU] [--month AAAA-MM] [--force] [--dry-run --out pasta]
// Credenciais: as do wrangler (local: `wrangler login`; GitHub: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID).
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import * as mdic from "../src/adapters/mdic-bulk.js";
import { createAccumulator } from "../src/mdic-aggregate.js";
import { loadTrust, trustedFetch } from "./lib/mdic-tls.mjs";

export const DB = "eag_compass";
export const BUCKET = "eag-compass-files";
const BASE = "https://balanca.economia.gov.br/balanca/bd";
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const q = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
export const spMonth = (d = new Date()) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 7);

// Execução do wrangler (substituível nos testes).
export function wranglerRunner() {
  // Node direto no binário do wrangler (sem shell): o SQL passa como argumento intacto também no Windows.
  const bin = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
  const run = (args, opts = {}) => execFileSync(process.execPath, [bin, ...args], { encoding: opts.binary ? "buffer" : "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return {
    query(sql) {
      const out = run(["d1", "execute", DB, "--remote", "--json", "--command", sql]);
      return JSON.parse(out.slice(out.indexOf("[")))[0].results;
    },
    execFile(path) {
      run(["d1", "execute", DB, "--remote", "--file", path, "--yes"]);
    },
    put(key, path) {
      run(["r2", "object", "put", `${BUCKET}/${key}`, "--file", path, "--content-type", "application/json", "--remote"]);
    },
    get(key) {
      return run(["r2", "object", "get", `${BUCKET}/${key}`, "--pipe", "--remote"], { binary: true }).toString("utf8");
    },
  };
}

const PARAM_SQL = (key) =>
  `SELECT value_json FROM parameters WHERE tenant_id='eag-internal' AND parameter_key='${key}' AND scope_key='international' AND effective_from<=strftime('%Y-%m-%dT%H:%M:%fZ','now') AND (effective_to IS NULL OR effective_to>strftime('%Y-%m-%dT%H:%M:%fZ','now')) ORDER BY effective_from DESC LIMIT 1`;

export function readSetup(db, iso3) {
  const cls = db.query(PARAM_SQL("agri_classification"))[0];
  const years = db.query(PARAM_SQL("trade_list_mdic_years"))[0];
  if (!cls || !years) throw new Error("Parâmetros agri_classification/trade_list_mdic_years sem valor aprovado no D1.");
  const codes = Object.fromEntries(db.query("SELECT mdic_code,iso3 FROM country_mdic_codes").map((r) => [r.mdic_code, r.iso3]));
  const members = iso3 ? [iso3] : [...new Set(Object.values(codes))].sort();
  if (iso3 && !Object.values(codes).includes(iso3)) throw new Error(`País ${iso3} sem código MDIC no cadastro.`);
  return { classification: JSON.parse(cls.value_json), mdicYears: JSON.parse(years.value_json), codes, members };
}

// Lê um ano inteiro por pedaços; arquivo republicado no meio → recomeça o ano (até 3 vezes); erro temporário → até 8 tentativas
// por pedaço, com espera crescente (a origem derruba conexões ao acaso: ECONNRESET observado em pedaços de 1 a 8 MiB).
export async function readYear(year, { base = BASE, fetchImpl, chapters, codes, members, log = () => {}, maxAttempts = 8, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  for (let gen = 1; gen <= 3; gen++) {
    const head = await mdic.headYear(base, year, fetchImpl);
    if (!head) return null;
    const partial = createAccumulator(codes, members);
    let restart = false;
    for (const r of mdic.chunkRanges(head.size)) {
      for (let attempt = 1; ; attempt++) {
        try {
          partial.add((await mdic.processChunk(base, { year, ...r, version: head, agriChapters: chapters }, fetchImpl)).rows);
          break;
        } catch (e) {
          if (e?.details?.code === "source_changed") {
            restart = true;
            break;
          }
          if (e?.kind === "temporary" && attempt < maxAttempts) {
            log(`  pedaço ${year}/${r.n}: ${e.message} — nova tentativa ${attempt + 1}`);
            await sleep(Math.min(60000, 5000 * 2 ** (attempt - 1)));
            continue;
          }
          throw e;
        }
      }
      if (restart) break;
      log(`  ${year}: pedaço ${r.n + 1}`);
    }
    if (!restart) return { head: { ...head, gen }, partial };
    log(`  ${year}: arquivo mudou durante a leitura — recomeçando (geração ${gen + 1})`);
  }
  throw new Error(`MDIC ${year} mudou 3 vezes durante a leitura.`);
}

// SQL de publicação: tudo idempotente; "complete" só no fim.
export function publishSql({ versionId, kind, iso3, month, classification, params, validators, objects, at, note }) {
  const out = [
    `INSERT OR IGNORE INTO trade_list_versions(id,kind,iso3,reference_month,classification_json,params_json,mdic_validators_json,status,started_at,note) VALUES (${[versionId, kind, iso3, month, JSON.stringify(classification), JSON.stringify(params), JSON.stringify(validators), "running", at, note].map(q).join(",")});`,
  ];
  for (const o of objects) {
    out.push(
      `INSERT INTO trade_list_status(version_id,iso3,source,state,last_period,lines,error,updated_at) VALUES (${[versionId, o.iso3, "mdic", o.state, o.lastPeriod, o.lines, null, at].map(q).join(",")}) ON CONFLICT(version_id,iso3,source) DO UPDATE SET state=excluded.state,last_period=excluded.last_period,lines=excluded.lines,error=NULL,updated_at=excluded.updated_at;`,
      `INSERT INTO trade_list_current(iso3,source,version_id,r2_key,content_sha256,revision,updated_at) VALUES (${[o.iso3, "mdic", versionId, o.key, o.sha, 1, at].map(q).join(",")}) ON CONFLICT(iso3,source) DO UPDATE SET version_id=excluded.version_id,r2_key=excluded.r2_key,content_sha256=excluded.content_sha256,revision=trade_list_current.revision+1,updated_at=excluded.updated_at WHERE (SELECT started_at FROM trade_list_versions WHERE id=trade_list_current.version_id) <= (SELECT started_at FROM trade_list_versions WHERE id=excluded.version_id);`,
    );
  }
  out.push(
    `UPDATE trade_list_versions SET status='complete',finished_at=${q(at)} WHERE id=${q(versionId)};`,
    `INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,new_value_json,request_id) VALUES (${[crypto.randomUUID(), "eag-internal", "system-mdic-job", "system", "trade_list.mdic_published", "trade_list_version", versionId, JSON.stringify({ countries: objects.length, withPurchase: objects.filter((o) => o.state === "purchase_identified").length }), "mdic-job"].map(q).join(",")});`,
  );
  return out.join("\n") + "\n";
}

export async function run({ iso3 = null, month = spMonth(), force = false, dryRun = false, outDir = null, db = wranglerRunner(), fetchImpl = null, base = BASE, log = console.log, runId = String(Date.now()), sleep } = {}) {
  if (!fetchImpl) {
    const trust = loadTrust();
    log(`TLS: ${trust.intermediate} ← ${trust.root} (intermediário válido até ${trust.validTo})`);
    fetchImpl = trustedFetch(trust);
  }
  const setup = readSetup(db, iso3);
  const kind = iso3 ? "manual" : "monthly";
  const versionId = iso3 ? `${month}-mdic-${iso3}-${runId}` : `${month}-mdic`;
  if (!iso3 && !dryRun) {
    const prev = db.query(`SELECT status FROM trade_list_versions WHERE id=${q(versionId)}`)[0];
    if (prev?.status === "complete" && !force) {
      log(`Versão ${versionId} já completa; nada a fazer (use --force para refazer).`);
      return { versionId, skipped: true };
    }
  }
  const year = Number(month.slice(0, 4));
  const acc = createAccumulator(setup.codes, setup.members);
  const validators = {};
  for (let y = year; y > year - setup.mdicYears; y--) {
    log(`MDIC ${y}:`);
    const r = await readYear(y, { base, fetchImpl, chapters: setup.classification.chapters, codes: setup.codes, members: setup.members, log, sleep });
    if (!r) {
      log(`  ${y}: ainda não publicado`);
      continue;
    }
    validators[y] = r.head;
    // Só depois de o ano inteiro ser lido numa única publicação ele entra no agregado final.
    acc.mergeFrom(r.partial);
  }
  if (!Object.keys(validators).length) throw new Error("Nenhum ano do MDIC publicado: nada a importar.");
  const ncm = await mdic.loadNcmTable(base, setup.classification.chapters, fetchImpl);
  const meta = { versionId, ncm, validators, classificationVersion: setup.classification.version };
  const dir = outDir || join(tmpdir(), `mdic-${versionId}`);
  mkdirSync(dir, { recursive: true });
  const objects = setup.members.map((iso) => {
    const obj = acc.countryObject(iso, meta);
    const text = JSON.stringify(obj);
    const path = join(dir, `${iso}.json`);
    writeFileSync(path, text);
    return { iso3: iso, key: `trade-src/${versionId}/mdic/${iso}.json`, sha: sha256(text), path, state: obj.state, lastPeriod: obj.lastPeriod, lines: obj.lines.length };
  });
  const summary = { versionId, countries: objects.length, withPurchase: objects.filter((o) => o.state === "purchase_identified").length, fileLastPeriod: acc.lastYm, unknownCodes: acc.unknownCodes };
  log(`Agregado: ${JSON.stringify(summary)}`);
  if (dryRun) return { ...summary, dir, dryRun: true };
  for (const [i, o] of objects.entries()) {
    db.put(o.key, o.path);
    if ((i + 1) % 25 === 0) log(`  R2: ${i + 1}/${objects.length}`);
  }
  // Conferência por hash: o país pedido (ou até 5 amostras) relidos do R2.
  const sample = iso3 ? objects : objects.filter((_, i) => i % Math.max(1, Math.floor(objects.length / 5)) === 0).slice(0, 5);
  for (const o of sample) if (sha256(db.get(o.key)) !== o.sha) throw new Error(`Objeto ${o.key} no R2 difere do gerado: publicação cancelada.`);
  const at = new Date().toISOString();
  const sqlPath = join(dir, "publicar.sql");
  writeFileSync(
    sqlPath,
    publishSql({ versionId, kind, iso3, month, classification: setup.classification, params: { mdicYears: setup.mdicYears, source: "github-mdic-job" }, validators, objects, at, note: summary.unknownCodes ? `MDIC: ${summary.unknownCodes} agregados com CO_PAIS sem país no cadastro.` : null }),
  );
  db.execFile(sqlPath);
  const check = db.query(`SELECT status FROM trade_list_versions WHERE id=${q(versionId)}`)[0];
  if (check?.status !== "complete") throw new Error(`Publicação não confirmada (${check?.status ?? "sem versão"}); reexecute o job.`);
  if (!outDir) rmSync(dir, { recursive: true, force: true });
  log(`Publicado: ${versionId} (${objects.length} países).`);
  return { ...summary, published: true };
}

if (process.argv[1]?.endsWith("mdic-job.mjs")) {
  const arg = (k) => {
    const i = process.argv.indexOf(k);
    return i > 0 ? process.argv[i + 1] : null;
  };
  run({
    iso3: arg("--iso3")?.toUpperCase() || null,
    month: arg("--month") || spMonth(),
    force: process.argv.includes("--force"),
    dryRun: process.argv.includes("--dry-run"),
    outDir: arg("--out"),
  }).catch((e) => {
    console.error(`FALHA: ${e.message}`);
    console.error("Nenhum dado parcial fica visível: a análise só lê objetos inteiros conferidos por hash, e a versão não é marcada 'complete'.");
    console.error("Para retomar: reexecute o workflow 'MDIC mensal' com os mesmos parâmetros (ou `node scripts/mdic-job.mjs` localmente).");
    process.exit(1);
  });
}
