// Geocodificação de unidades (P2-T5, R11.5–R11.6, G9): só lacunas, cache por endereço, precisão registrada.
import { fail, requireRole, WRITE_ROLES, bodyJson } from "./http.js";
import { statement as s, auditStatement, commit, now } from "./store.js";
import { geocodeAddress, SOURCE } from "./adapters/locationiq.js";
import { AdapterError } from "./adapters/errors.js";
import { haversineKm, classifyInsideRadius, normalizeName } from "./geo.js";

const FREE_TTL_MS = 48 * 3600 * 1000;
// Até 5 km (Fase 4 §7.6) toda unidade da busca é geocodificada; acima, só sob demanda (triagem/ficha).
export const GEOCODE_ALL_UNDER_KM = 5;

async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function addressKeyText(u) {
  return [SOURCE, normalizeName(u.street || ""), normalizeName(u.street_number || ""), (u.postal_code || "").replace(/\D/g, ""), normalizeName(u.municipality_name || ""), (u.uf || "").toUpperCase()].join("|");
}
// Direito de armazenar coordenada de forma permanente só no plano pago.
const paidPlan = (env) => env.LOCATIONIQ_PLAN === "paid";

async function applyToUnit(env, unit, g, at) {
  const statements = [
    s(
      env,
      "UPDATE company_units SET lat=?,lon=?,geo_precision=?,geo_source=?,geocoded_at=?,revision=revision+1,updated_at=? WHERE id=? AND geo_precision NOT IN ('address','manual')",
      g.lat, g.lon, g.precision, `${SOURCE} ${g.cls ?? ""}/${g.type ?? ""}`.trim(), at, at, unit.id,
    ),
  ];
  // Recalcula distância e situação no raio em todas as buscas que contêm a unidade.
  const cands = (
    await s(env, "SELECT sc.search_id,s.origin_lat,s.origin_lon,s.radius_km FROM search_candidates sc JOIN searches s ON s.id=sc.search_id WHERE sc.unit_id=?", unit.id).all()
  ).results;
  const muni = unit.municipality_ibge ? await s(env, "SELECT * FROM municipalities WHERE ibge_code=?", unit.municipality_ibge).first() : null;
  for (const c of cands) {
    const d = haversineKm(c.origin_lat, c.origin_lon, g.lat, g.lon);
    const basis = g.precision === "address" ? "address" : "municipality_centroid";
    statements.push(
      s(
        env,
        "UPDATE search_candidates SET distance_km=?,distance_basis=?,inside_radius=? WHERE search_id=? AND unit_id=?",
        d, basis,
        classifyInsideRadius({ basis, distanceKm: d, radiusKm: c.radius_km, municipality: muni, originLat: c.origin_lat, originLon: c.origin_lon }),
        c.search_id, unit.id,
      ),
    );
  }
  await env.DB.batch(statements);
}

// Resultado: { status: 'already_precise'|'no_address'|'cache_hit'|'geocoded'|'not_found'|'transient', precision? }
export async function geocodeUnit(env, unitId, deps = {}) {
  const at = deps.now ?? now();
  const unit = await s(env, "SELECT * FROM company_units WHERE id=?", unitId).first();
  if (!unit) fail(404, "unit_not_found", "Unidade não encontrada.");
  if (["address", "manual"].includes(unit.geo_precision)) return { status: "already_precise" };
  if (!unit.street || !unit.municipality_name || !unit.uf) return { status: "no_address" };
  const key = await sha256(addressKeyText(unit));
  const cached = await s(
    env,
    "SELECT * FROM geocode_cache WHERE tenant_id=? AND address_key=? AND (expires_at IS NULL OR expires_at>?)",
    unit.tenant_id, key, at,
  ).first();
  let g;
  if (cached) {
    if (cached.outcome === "not_found") return { status: "not_found", cached: true };
    g = { lat: cached.lat, lon: cached.lon, precision: cached.precision, cls: cached.result_class, type: cached.result_type };
  } else {
    g = await geocodeAddress(env, { street: unit.street, number: unit.street_number, city: unit.municipality_name, uf: unit.uf, postalCode: unit.postal_code }, deps.fetchImpl);
    const expires = paidPlan(env) ? null : new Date(Date.parse(at) + FREE_TTL_MS).toISOString();
    await s(
      env,
      "INSERT INTO geocode_cache(tenant_id,address_key,source,outcome,lat,lon,precision,result_class,result_type,fetched_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,address_key) DO UPDATE SET outcome=excluded.outcome,lat=excluded.lat,lon=excluded.lon,precision=excluded.precision,result_class=excluded.result_class,result_type=excluded.result_type,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at",
      unit.tenant_id, key, SOURCE, g ? "found" : "not_found", g?.lat ?? null, g?.lon ?? null, g?.precision ?? null, g?.cls ?? null, g?.type ?? null, at, expires,
    ).run();
    if (!g) return { status: "not_found" };
  }
  // Resultado no nível da cidade não melhora a precisão: a unidade continua centroide.
  if (g.precision !== "address") return { status: cached ? "cache_hit" : "geocoded", precision: g.precision, applied: false };
  if (!paidPlan(env)) return { status: "transient", precision: g.precision, lat: g.lat, lon: g.lon, applied: false };
  await applyToUnit(env, unit, g, at);
  return { status: cached ? "cache_hit" : "geocoded", precision: g.precision, applied: true };
}

export async function geocodeUnitRoute(request, env, actor, rid, unitId) {
  requireRole(actor, WRITE_ROLES);
  await bodyJson(request);
  const unit = await s(env, "SELECT tenant_id FROM company_units WHERE id=?", unitId).first();
  if (!unit || unit.tenant_id !== actor.tenant_id) fail(404, "unit_not_found", "Unidade não encontrada.");
  try {
    const r = await geocodeUnit(env, unitId);
    await commit(env, [auditStatement(env, actor, rid, "unit.geocode", "company_unit", unitId, { status: r.status, precision: r.precision ?? null })]);
    return r;
  } catch (e) {
    if (e instanceof AdapterError)
      fail(e.retryable ? 503 : 502, `geocoding_${e.kind}`, e.message);
    throw e;
  }
}

export async function enqueueGeocoding(env, unitIds, deps = {}) {
  if (!unitIds.length) return;
  const send = deps.enqueue ?? ((msgs) => env.ASYNC_QUEUE?.sendBatch(msgs));
  for (let i = 0; i < unitIds.length; i += 100)
    await send(unitIds.slice(i, i + 100).map((unitId) => ({ body: { type: "geocode_unit", unitId } })));
}
