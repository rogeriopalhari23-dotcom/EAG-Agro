#!/usr/bin/env node
// Importa a versão atual de uma lista de sanções semeada (P2-T16) pela API do Compass, com hash do arquivo oficial,
// contagem declarada e lotes; lista parcial vira versão `failed` (a triagem nunca usa lista incompleta).
//
// Uso (admin, na máquina de Rogério):
//   node scripts/import-sanctions.mjs --list ofac|ceis|cnep --base https://<compass> [--date AAAAMMDD] [--dir pasta-com-arquivos]
//   Produção: CF_ACCESS_TOKEN=$(cloudflared access token -app=https://<compass>) node scripts/import-sanctions.mjs ...
//   Local:    --base http://127.0.0.1:8787 (autenticação local do wrangler dev)
// Sem --dir, baixa das URLs oficiais. Pessoas físicas ficam de fora (política T11 de 2026-09-24: só empresas).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { parseOfac, parseCgu, decodeLatin, batches } from "../src/sanctions-parsers.js";

export const SOURCES = {
  ofac: { sourceId: "source-ofac-sdn", files: ["https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV", "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ALT.CSV"] },
  ceis: { sourceId: "source-cgu-ceis", portal: "ceis" },
  cnep: { sourceId: "source-cgu-cnep", portal: "cnep" },
};

// Um arquivo por ZIP (formato do Portal da Transparência): lê o diretório central e descomprime o único CSV.
export function unzipSingle(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("ZIP inválido.");
  const count = buf.readUInt16LE(eocd + 10);
  if (count !== 1) throw new Error(`ZIP com ${count} arquivos (esperado 1).`);
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error("Diretório central do ZIP inválido.");
  const method = buf.readUInt16LE(cd + 10), size = buf.readUInt32LE(cd + 20), usize = buf.readUInt32LE(cd + 24), local = buf.readUInt32LE(cd + 42);
  const nameLen = buf.readUInt16LE(local + 26), extraLen = buf.readUInt16LE(local + 28);
  const data = buf.subarray(local + 30 + nameLen + extraLen, local + 30 + nameLen + extraLen + size);
  const out = method === 0 ? data : method === 8 ? inflateRawSync(data) : null;
  if (!out) throw new Error(`Compressão ${method} não suportada.`);
  if (out.length !== usize) throw new Error("ZIP truncado.");
  return out;
}

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// Lê os arquivos e devolve { entries, contentHash, sourceVersion }. `read(urlOrName)` devolve Buffer.
export async function load(list, read, date) {
  if (list === "ofac") {
    const [sdn, alt] = await Promise.all(SOURCES.ofac.files.map(read));
    const r = parseOfac(sdn.toString("latin1"), alt.toString("latin1"));
    return { ...r, contentHash: sha256(Buffer.concat([sdn, alt])), sourceVersion: `SDN.CSV+ALT.CSV sha256:${sha256(sdn).slice(0, 12)}` };
  }
  // O Portal mantém só o arquivo do último dia publicado (o anterior passa a 403): sem data explícita, tenta hoje e ontem.
  let zip, used = date;
  for (const d of Array.isArray(date) ? date : [date]) {
    try {
      zip = await read(`https://portaldatransparencia.gov.br/download-de-dados/${SOURCES[list].portal}/${d}`);
      used = d;
      break;
    } catch (e) {
      if (d === [].concat(date).at(-1)) throw e;
    }
  }
  date = used;
  const csv = unzipSingle(zip);
  const r = parseCgu(decodeLatin(csv), list.toUpperCase());
  return { ...r, contentHash: sha256(zip), sourceVersion: `${date}_${list.toUpperCase()}` };
}

// Envia pela API: abre a versão, manda os lotes e fecha conferindo a contagem. `api(path, method, body)` → {status, data}.
export async function importList(api, { list, entries, contentHash, sourceVersion, downloadedAt }) {
  const sourceId = SOURCES[list].sourceId;
  const v = await api(`/api/sanctions/sources/${sourceId}/versions`, "POST", { contentHash, recordCount: entries.length, sourceVersion, downloadedAt });
  if (v.status !== 201 && v.status !== 200) throw new Error(`Abrir versão: ${JSON.stringify(v.data)}`);
  const id = v.data.id;
  for (const batch of batches(entries)) {
    const r = await api(`/api/sanctions/versions/${id}/entries`, "POST", { entries: batch });
    if (r.status !== 200 && r.status !== 201) throw new Error(`Lote recusado: ${JSON.stringify(r.data)}`);
  }
  const f = await api(`/api/sanctions/versions/${id}/finish`, "POST", {});
  if (f.status !== 200) throw new Error(`Fechar versão: ${JSON.stringify(f.data)}`);
  return { versionId: id, records: f.data.records };
}

function arg(k) {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : null;
}
if (process.argv[1]?.endsWith("import-sanctions.mjs")) {
  const list = arg("--list"), base = arg("--base");
  if (!SOURCES[list] || !base) {
    console.error("Uso: --list ofac|ceis|cnep --base URL [--date AAAAMMDD] [--dir pasta]");
    process.exit(2);
  }
  const day = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10).replace(/-/g, ""); // dia em Brasília
  const date = arg("--date") || [day(Date.now()), day(Date.now() - 86400000)];
  const dir = arg("--dir");
  const read = async (u) => {
    if (dir) return readFileSync(`${dir}/${u.split("/").pop().replace(/^(\d{8})$/, `$1_${list.toUpperCase()}.zip`)}`);
    const r = await fetch(u, { redirect: "follow" });
    if (!r.ok) throw new Error(`${u}: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  };
  const loaded = await load(list, read, date);
  const headers = { "content-type": "application/json", origin: new URL(base).origin };
  if (process.env.CF_ACCESS_TOKEN) headers.cookie = `CF_Authorization=${process.env.CF_ACCESS_TOKEN}`;
  const api = async (path, method, body) => {
    const r = await fetch(new URL(path, base), { method, headers, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
  console.log(`${list}: ${loaded.total} registros no arquivo, ${loaded.entries.length} a importar`, loaded.skipped);
  const r = await importList(api, { list, ...loaded, downloadedAt: new Date().toISOString() });
  console.log(`Versão ${r.versionId} importada com ${r.records} registros.`);
}
