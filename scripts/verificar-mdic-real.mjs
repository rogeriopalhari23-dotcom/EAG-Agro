// Verificação REAL, pequena, gratuita e só de leitura do MDIC (2026-10-21): HEAD do arquivo anual e UM pedaço de 8 MB,
// pelo mesmo adaptador e pela mesma confiança TLS do job mensal (raízes públicas + intermediário fixado; verificação
// ligada). Agrega só o capítulo 15 e lista as exportações do Brasil de óleo de soja (NCM 1507) encontradas no pedaço.
// Um pedaço é parte do arquivo: o resultado mostra que a leitura e a interpretação funcionam, não a cobertura total.
//   node scripts/verificar-mdic-real.mjs
import { headYear, chunkRanges, processChunk, CHUNK_BYTES } from "../src/adapters/mdic-bulk.js";
import { loadTrust, trustedFetch } from "./lib/mdic-tls.mjs";

const BASE = "https://balanca.mdic.gov.br/balanca/bd";
const trust = loadTrust();
const f = trustedFetch(trust);
const t0 = Date.now();
const head = await headYear(BASE, 2026, f);
const [first] = chunkRanges(head.size, CHUNK_BYTES);
const rows = await processChunk(BASE, { year: 2026, n: 0, start: first.start, end: first.end, version: head, agriChapters: ["15"] }, f);
const oil = Object.entries(rows.rows ?? rows).filter(([k]) => /\|1507\d{4}\|/.test(k));
const byCountry = {};
for (const [k, [fob]] of oil) {
  const [pais, ncm] = k.split("|");
  byCountry[pais] ??= { fobUsd: 0, ncm: new Set() };
  byCountry[pais].fobUsd += fob;
  byCountry[pais].ncm.add(ncm);
}
console.log(JSON.stringify({
  consultado: `${BASE}/comexstat-bd/ncm/EXP_2026.csv`, horario: new Date().toISOString(), tls: `${trust.intermediate} ← ${trust.root}`,
  arquivo: head, pedaco: { bytes: `${first.start}-${first.end}`, de: head.size },
  linhasCapitulo15NoPedaco: Object.keys(rows.rows ?? rows).length,
  oleoDeSoja1507: Object.entries(byCountry).map(([pais, v]) => ({ coPais: pais, fobUsd: Math.round(v.fobUsd), ncm: [...v.ncm] })).sort((a, b) => b.fobUsd - a.fobUsd).slice(0, 12),
  ms: Date.now() - t0,
}, null, 1));
