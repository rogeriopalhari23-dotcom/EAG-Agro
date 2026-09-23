// LocationIQ — geocodificação estruturada (P2-T5).
// Contrato: https://docs.locationiq.com/docs/search-forward-geocoding e /docs/errors (consultados em 2026-09-23).
// GET https://{us1|eu1}.locationiq.com/v1/search?key=…&street=…&city=…&state=…&postalcode=…&countrycodes=br&format=json&limit=1
// Resposta: array [{lat:"…", lon:"…", class, type, display_name, …}] (lat/lon em texto).
// Erros: 400 inválida; 401 chave; 403 serviço/escopo; 404 "Unable to geocode" (não encontrado, não é falha); 429 limites; 500.
// Armazenamento (https://locationiq.com/pricing): plano pago guarda sem prazo; gratuito só 48 h de cache.
import { AdapterError, httpError, fetchJson } from "./errors.js";

export const SOURCE = "locationiq:v1";
// Resultado no nível de cidade não é endereço: continua centroide.
const CITY_TYPES = new Set(["city", "town", "village", "municipality", "administrative", "county", "state", "hamlet", "suburb"]);

export async function geocodeAddress(env, a, fetchImpl = fetch) {
  if (!env.LOCATIONIQ_KEY) throw new AdapterError("auth", "LocationIQ: chave não configurada.");
  if (!a.street || !a.city || !a.uf) throw new AdapterError("invalid_request", "Endereço sem logradouro, cidade ou UF.");
  const host = env.LOCATIONIQ_HOST || "us1.locationiq.com";
  const q = new URLSearchParams({
    key: env.LOCATIONIQ_KEY,
    street: [a.street, a.number].filter(Boolean).join(" "),
    city: a.city,
    state: a.uf,
    countrycodes: "br",
    format: "json",
    limit: "1",
  });
  if (a.postalCode) q.set("postalcode", a.postalCode);
  const { status, data } = await fetchJson("LocationIQ", `https://${host}/v1/search?${q}`, { method: "GET" }, fetchImpl, 10000);
  if (status === 404) return null;
  if (status === 403) throw new AdapterError("auth", "LocationIQ: serviço não habilitado ou acesso restrito (403).");
  if (status !== 200) throw httpError("LocationIQ", status);
  if (!Array.isArray(data)) throw new AdapterError("schema", "LocationIQ: resposta não é lista.");
  if (!data.length) return null;
  const r = data[0];
  const lat = Number(r.lat),
    lon = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -35 || lat > 6 || lon < -75 || lon > -28)
    throw new AdapterError("schema", "LocationIQ: coordenada inválida ou fora do Brasil.");
  const cityLevel = r.class === "place" || r.class === "boundary" ? CITY_TYPES.has(r.type) : false;
  return { lat, lon, precision: cityLevel ? "municipality_centroid" : "address", cls: r.class ?? null, type: r.type ?? null };
}
