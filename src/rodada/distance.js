// Distância de um estabelecimento à origem da rodada, sempre com a base declarada.
// Centroide municipal é ESTIMATIVA; só a coordenada da unidade afirma dentro/fora pela própria distância.
// "Perto do limite" acompanha o raio configurado (config.nearLimit), sem corte fixo.
import { haversineKm, classifyInsideRadius, normalizeName } from "../geo.js";

// Índice de municípios por código e por nome normalizado + UF/região + país.
export function municipalityIndex(list) {
  const byCode = new Map(), byName = new Map();
  for (const m of list ?? []) {
    if (m.code != null) byCode.set(String(m.code), m);
    byName.set(`${m.country}|${String(m.region ?? "").toUpperCase()}|${normalizeName(m.name)}`, m);
  }
  return {
    find({ code, name, region, country }) {
      if (code != null && byCode.has(String(code))) return byCode.get(String(code));
      if (!name) return null;
      return byName.get(`${country}|${String(region ?? "").toUpperCase()}|${normalizeName(name)}`) ?? null;
    },
  };
}

// Resolve a origem da configuração: coordenada explícita ou município do conjunto de dados.
export function resolveOrigin(config, index) {
  const o = config.origin;
  if (typeof o.lat === "number" && typeof o.lon === "number") return { lat: o.lat, lon: o.lon, label: o.label ?? `${o.lat}, ${o.lon}`, basis: "coordinate" };
  const m = index.find({ code: o.municipalityCode, name: o.municipality, region: o.region, country: o.country });
  if (!m) return null;
  return { lat: m.lat, lon: m.lon, label: `${m.name}/${m.region ?? ""} (centroide)`, basis: "municipality_centroid" };
}

const round1 = (x) => Math.round(x * 10) / 10;

// unit: { lat, lon } da unidade (opcional); municipality: registro do conjunto (opcional).
// → { km, basis, estimated, inside, nearLimit, label, pending? }
export function distanceFor({ origin, unit, municipality, config }) {
  const radiusKm = config.radius.km;
  let km = null, basis = null;
  if (unit && typeof unit.lat === "number" && typeof unit.lon === "number") {
    km = haversineKm(origin.lat, origin.lon, unit.lat, unit.lon);
    basis = "address";
  } else if (municipality) {
    km = haversineKm(origin.lat, origin.lon, municipality.lat, municipality.lon);
    basis = "municipality_centroid";
  }
  if (km == null)
    return { km: null, basis: null, estimated: true, inside: "unknown", nearLimit: false, label: "sem coordenada", pending: "Distância desconhecida: sem coordenada da unidade nem município no conjunto de dados." };
  const inside = classifyInsideRadius({ basis, distanceKm: km, radiusKm, municipality, originLat: origin.lat, originLon: origin.lon });
  const estimated = basis !== "address";
  // Perto do limite: dentro da faixa configurada; com centroide, também quando o município cruza o raio (inside = estimated
  // e a distância passa do raio). Fora pela coordenada da unidade é "outside", não "perto".
  const nearLimit = (km >= config.nearLimit.fromKm && km <= radiusKm) || (estimated && inside === "estimated" && km > radiusKm);
  const label = `${round1(km)} km ${estimated ? "(ESTIMADA: centroide do município)" : "(coordenada da unidade)"}`;
  const out = { km: round1(km), basis, estimated, inside, nearLimit, label };
  if (nearLimit) out.pending = estimated ? "Perto do limite do raio pelo centroide: conferir a localização da unidade." : "Perto do limite do raio: conferir.";
  if (inside === "outside") out.pending = "Fora do raio configurado.";
  return out;
}
