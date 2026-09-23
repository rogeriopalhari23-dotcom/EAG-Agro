import { fail } from "./http.js";
import { statement as s } from "./store.js";

const EARTH_KM = 6371.0088;
const rad = (d) => (d * Math.PI) / 180;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1),
    dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Caixa que contém o círculo (pré-filtro SQL). Margem de latitude/longitude conservadora.
export function boundingBox(lat, lon, radiusKm) {
  const dLat = radiusKm / 110.574;
  const dLon = radiusKm / (111.32 * Math.max(0.01, Math.cos(rad(Math.min(89, Math.abs(lat) + dLat)))));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLon: lon - dLon, maxLon: lon + dLon };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Distância mínima e máxima do ponto ao retângulo do município (aproximação válida para municípios).
export function rectDistances(lat, lon, m) {
  const min = haversineKm(lat, lon, clamp(lat, m.bbox_min_lat, m.bbox_max_lat), clamp(lon, m.bbox_min_lon, m.bbox_max_lon));
  const max = Math.max(
    ...[
      [m.bbox_min_lat, m.bbox_min_lon],
      [m.bbox_min_lat, m.bbox_max_lon],
      [m.bbox_max_lat, m.bbox_min_lon],
      [m.bbox_max_lat, m.bbox_max_lon],
    ].map(([a, b]) => haversineKm(lat, lon, a, b)),
  );
  return { min, max };
}

const hasRect = (m) =>
  m && [m.bbox_min_lat, m.bbox_max_lat, m.bbox_min_lon, m.bbox_max_lon].every((v) => typeof v === "number");

// R11.5/R11.6: endereço preciso decide pela distância; centroide só afirma dentro/fora
// quando o município inteiro está de um lado do raio; sem coordenada é desconhecido.
export function classifyInsideRadius({ basis, distanceKm, radiusKm, municipality, originLat, originLon }) {
  if (basis === "address" && typeof distanceKm === "number")
    return distanceKm <= radiusKm ? "confirmed" : "outside";
  if (basis === "municipality_centroid" && typeof distanceKm === "number") {
    if (hasRect(municipality) && typeof originLat === "number") {
      const r = rectDistances(originLat, originLon, municipality);
      if (r.max <= radiusKm) return "confirmed";
      if (r.min > radiusKm) return "outside";
    }
    return "estimated";
  }
  return "unknown";
}

export const normalizeName = (v) =>
  String(v)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function originPoint(env, city, uf) {
  const row = await s(
    env,
    "SELECT ibge_code,name,uf,lat,lon,source_version FROM municipalities WHERE uf=? AND name_normalized=?",
    String(uf).toUpperCase(),
    normalizeName(city),
  ).first();
  if (!row)
    fail(
      422,
      "origin_not_found",
      "Cidade não encontrada nesta UF na base oficial do IBGE (município sem malha oficial também fica indisponível).",
    );
  return { ibge: row.ibge_code, lat: row.lat, lon: row.lon, precision: "municipality_centroid", sourceVersion: row.source_version, name: row.name, uf: row.uf };
}

// Municípios com alguma parte dentro do raio (R11.7: nenhum possível comprador fica de fora),
// ordenados pela distância do centroide.
export async function municipalitiesWithin(env, lat, lon, radiusKm) {
  const box = boundingBox(lat, lon, radiusKm);
  const rows = (
    await s(
      env,
      "SELECT * FROM municipalities WHERE bbox_max_lat>=? AND bbox_min_lat<=? AND bbox_max_lon>=? AND bbox_min_lon<=?",
      box.minLat,
      box.maxLat,
      box.minLon,
      box.maxLon,
    ).all()
  ).results;
  return rows
    .map((m) => ({ ...m, distance_km: haversineKm(lat, lon, m.lat, m.lon), ...(hasRect(m) ? { reach: rectDistances(lat, lon, m) } : {}) }))
    .filter((m) => (m.reach ? m.reach.min : m.distance_km) <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km || a.ibge_code - b.ibge_code);
}
