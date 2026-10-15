// Área da rodada calculada a partir da origem, do raio e da unidade configurados, sobre um conjunto nacional oficial
// (no Brasil, os 5.570 municípios do IBGE com centroide e retângulo envolvente — migrations/0008_seed_municipios.sql).
// Nenhum CSV montado à mão: qualquer município do conjunto pode ser origem.
//
// Para cada município com alguma parte no raio:
//   coverage "full"    → o município inteiro está dentro (retângulo inteiro dentro do raio);
//   coverage "partial" → só parte dele está dentro: uma unidade ali pode estar dentro ou fora (conferir a localização);
//   centroidKm         → distância do centroide (ESTIMATIVA da localização de uma unidade, nunca a localização dela).
import { haversineKm, rectDistances, boundingBox } from "../geo.js";

const hasRect = (m) => [m.bbox_min_lat, m.bbox_max_lat, m.bbox_min_lon, m.bbox_max_lon].every((x) => typeof x === "number");
const round1 = (x) => Math.round(x * 10) / 10;

// Linha da tabela municipalities (D1) → registro de município da rodada.
export const fromIbgeRow = (m) => ({
  code: String(m.ibge_code), name: m.name, region: m.uf, country: "BR", lat: m.lat, lon: m.lon,
  bbox_min_lat: m.bbox_min_lat, bbox_max_lat: m.bbox_max_lat, bbox_min_lon: m.bbox_min_lon, bbox_max_lon: m.bbox_max_lon,
  source: m.source_version ?? m.source ?? null,
});

// Pré-filtro retangular (para consulta SQL ou filtro em memória).
export const areaBox = (origin, radiusKm) => boundingBox(origin.lat, origin.lon, radiusKm);

export function roundArea({ origin, config, municipalities }) {
  const radiusKm = config.radius.km, fromKm = config.nearLimit.fromKm;
  const box = areaBox(origin, radiusKm);
  const items = [];
  for (const m of municipalities) {
    if (hasRect(m) && (m.bbox_max_lat < box.minLat || m.bbox_min_lat > box.maxLat || m.bbox_max_lon < box.minLon || m.bbox_min_lon > box.maxLon)) continue;
    const centroidKm = haversineKm(origin.lat, origin.lon, m.lat, m.lon);
    const reach = hasRect(m) ? rectDistances(origin.lat, origin.lon, m) : { min: centroidKm, max: centroidKm };
    if (reach.min > radiusKm) continue;
    const coverage = hasRect(m) ? (reach.max <= radiusKm ? "full" : "partial") : "centroid_only";
    // Conferência: centroide na faixa de proximidade, ou município cortado pelo raio.
    const review = (centroidKm >= fromKm && centroidKm <= radiusKm) || coverage !== "full";
    items.push({ code: m.code, name: m.name, region: m.region, country: m.country, centroidKm: round1(centroidKm), minKm: round1(reach.min), maxKm: round1(reach.max), coverage, review });
  }
  items.sort((a, b) => a.centroidKm - b.centroidKm || String(a.code).localeCompare(String(b.code)));
  const regions = [...new Set(items.map((x) => x.region))].sort();
  return {
    origin: { lat: origin.lat, lon: origin.lon, label: origin.label },
    radiusKm: round1(radiusKm),
    criterion: config.nearLimit.criterion ?? null,
    summary: {
      municipalities: items.length,
      full: items.filter((x) => x.coverage === "full").length,
      partial: items.filter((x) => x.coverage === "partial").length,
      review: items.filter((x) => x.review).length,
      regions,
    },
    municipalities: items,
  };
}
