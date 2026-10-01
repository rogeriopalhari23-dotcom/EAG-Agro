// Mapa de fundo do Radar Nacional (redesign, 2026-10-01): recorte do Brasil do mapa base Protomaps (OpenStreetMap),
// guardado no R2 privado em partes (o upload pelo Wrangler aceita até 315 MB por objeto) e servido por esta rota
// autenticada com leitura por faixa de bytes (Range). O bucket continua privado: nenhuma URL pública, nenhum outro prefixo.
import { securityHeaders, fail, response } from "./http.js";

const MAX_RANGE = 8 * 1024 * 1024; // o cliente PMTiles pede cabeçalho, diretórios e ladrilhos; nada perto disso
let cached = null; // { key, manifest } por isolate

async function manifest(env) {
  const key = env.MAP_MANIFEST_KEY;
  if (!key || !env.FILES) return null;
  if (cached?.key === key) return cached.manifest;
  const o = await env.FILES.get(key);
  if (!o) return null;
  const m = await o.json();
  if (!Array.isArray(m.parts) || !m.parts.length || !m.parts.every((p) => typeof p.key === "string" && p.key.startsWith("mapa/") && p.size > 0))
    fail(500, "map_manifest_invalid", "Manifesto do mapa inválido.");
  let offset = 0;
  for (const p of m.parts) (p.offset = offset), (offset += p.size);
  if (offset !== m.size) fail(500, "map_manifest_invalid", "Tamanho do mapa não confere com as partes.");
  cached = { key, manifest: m };
  return m;
}

// Informações para a tela: se há mapa, de que data, área e atribuição obrigatória.
export async function mapInfo(env) {
  const m = await manifest(env);
  if (!m) return response({ available: false, reason: "Mapa de fundo não configurado neste ambiente." });
  return response({ available: true, url: "/api/mapa/brasil.pmtiles", name: m.name, bbox: m.bbox, maxzoom: m.maxzoom, attribution: m.attribution, license: m.license, source: m.source });
}

function parseRange(header, size) {
  const r = /^bytes=(\d+)-(\d*)$/.exec(header || "");
  if (!r) fail(416, "range_required", "Leitura do mapa só por faixa de bytes (Range).");
  const start = Number(r[1]);
  const end = r[2] === "" ? Math.min(size - 1, start + MAX_RANGE - 1) : Math.min(Number(r[2]), size - 1);
  if (start >= size || end < start) fail(416, "range_invalid", "Faixa fora do arquivo do mapa.");
  if (end - start + 1 > MAX_RANGE) fail(416, "range_too_large", "Faixa grande demais.");
  return { start, end };
}

// Junta a faixa pedida a partir de uma ou duas partes (as faixas são pequenas e as partes têm 300 MB).
export async function mapTiles(request, env) {
  const m = await manifest(env);
  if (!m) fail(404, "map_unavailable", "Mapa de fundo não configurado.");
  const etag = `"${m.sha256.slice(0, 32)}"`;
  const { start, end } = parseRange(request.headers.get("range"), m.size);
  const chunks = [];
  for (const p of m.parts) {
    const a = Math.max(start, p.offset),
      b = Math.min(end, p.offset + p.size - 1);
    if (a > b) continue;
    const o = await env.FILES.get(p.key, { range: { offset: a - p.offset, length: b - a + 1 } });
    if (!o) fail(503, "map_part_missing", "Parte do mapa ausente.");
    chunks.push(new Uint8Array(await o.arrayBuffer()));
  }
  const body = new Uint8Array(end - start + 1);
  let at = 0;
  for (const c of chunks) body.set(c, at), (at += c.length);
  if (at !== body.length) fail(503, "map_part_short", "Leitura incompleta do mapa.");
  return new Response(request.method === "HEAD" ? null : body, {
    status: 206,
    headers: {
      ...securityHeaders,
      "content-type": "application/octet-stream",
      "content-range": `bytes ${start}-${end}/${m.size}`,
      "content-length": String(body.length),
      "accept-ranges": "bytes",
      etag,
      // Conteúdo imutável por versão do recorte; cache só no navegador da pessoa autenticada.
      "cache-control": "private, max-age=86400",
    },
  });
}
