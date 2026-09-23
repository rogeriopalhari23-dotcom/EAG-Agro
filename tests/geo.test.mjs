import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import {
  haversineKm,
  classifyInsideRadius,
  municipalitiesWithin,
  originPoint,
  normalizeName,
} from "../src/geo.js";

// Linhas copiadas de migrations/0008_seed_municipios.sql (IBGE, 2026-09-23).
const SERT = { lat: -21.1229, lon: -48.0089, bbox_min_lat: -21.2184, bbox_max_lat: -20.9921, bbox_min_lon: -48.1869, bbox_max_lon: -47.8708 };
const RP = { lat: -21.2108, lon: -47.8213, bbox_min_lat: -21.3694, bbox_max_lat: -21.0595, bbox_min_lon: -47.9892, bbox_max_lon: -47.6467 };
const FRANCA = { lat: -20.5552, lon: -47.3811, bbox_min_lat: -20.7734, bbox_max_lat: -20.4171, bbox_min_lon: -47.5528, bbox_max_lon: -47.1435 };

test("P2-T2: Haversine com distância conhecida (Sertãozinho → Ribeirão Preto ≈ 21,9 km)", () => {
  const d = haversineKm(SERT.lat, SERT.lon, RP.lat, RP.lon);
  assert.ok(d > 20 && d < 24, String(d));
  assert.equal(haversineKm(SERT.lat, SERT.lon, SERT.lat, SERT.lon), 0);
});

test("P2-T2: centroide nunca vira 'confirmado' só pela distância do centroide", () => {
  const base = { basis: "municipality_centroid", originLat: SERT.lat, originLon: SERT.lon };
  const dFranca = haversineKm(SERT.lat, SERT.lon, FRANCA.lat, FRANCA.lon);
  // Centroide de Franca a ~95 km; raio 100: parte do município fica fora → estimado.
  assert.equal(classifyInsideRadius({ ...base, distanceKm: dFranca, radiusKm: 100, municipality: FRANCA }), "estimated");
  // Raio 200: município inteiro dentro → confirmado pela geometria.
  assert.equal(classifyInsideRadius({ ...base, distanceKm: dFranca, radiusKm: 200, municipality: FRANCA }), "confirmed");
  // Raio 5: município inteiro fora → fora.
  assert.equal(classifyInsideRadius({ ...base, distanceKm: dFranca, radiusKm: 5, municipality: FRANCA }), "outside");
  // Sem retângulo, centroide é sempre estimativa.
  assert.equal(classifyInsideRadius({ ...base, distanceKm: 10, radiusKm: 100, municipality: null }), "estimated");
});

test("P2-T2: endereço decide pela distância; sem coordenada é desconhecido (nunca 0 km)", () => {
  assert.equal(classifyInsideRadius({ basis: "address", distanceKm: 30, radiusKm: 100 }), "confirmed");
  assert.equal(classifyInsideRadius({ basis: "address", distanceKm: 130, radiusKm: 100 }), "outside");
  assert.equal(classifyInsideRadius({ basis: "unknown", distanceKm: null, radiusKm: 100 }), "unknown");
  assert.equal(classifyInsideRadius({ basis: "address", distanceKm: null, radiusKm: 100 }), "unknown");
});

test("P2-T2: nomes normalizados sem acento", () => {
  assert.equal(normalizeName("Sertãozinho"), "sertaozinho");
  assert.equal(normalizeName("  São  João d'Aliança "), "sao joao d alianca");
});

test("P2-T2: base oficial carregada; 5 km pega só a própria cidade; raio maior inclui vizinhos por borda", async (t) => {
  const { env, close } = setup();
  t.after(close);
  const total = env.DB.raw.prepare("SELECT COUNT(*) n, COUNT(DISTINCT source_version) v FROM municipalities").get();
  assert.equal(total.n, 5570);
  assert.equal(total.v, 1);
  const o = await originPoint(env, "SERTAOZINHO", "sp");
  assert.equal(o.ibge, 3551702);
  assert.equal(o.precision, "municipality_centroid");
  // 5 km: a própria cidade primeiro; vizinhos só entram se alguma borda do retângulo estiver a até 5 km.
  const cinco = await municipalitiesWithin(env, o.lat, o.lon, 5);
  assert.equal(cinco[0].ibge_code, 3551702);
  assert.ok(cinco.every((m) => m.reach.min <= 5));
  assert.ok(!cinco.some((m) => m.ibge_code === 3516200), "Franca não pode entrar em 5 km");
  const cem = await municipalitiesWithin(env, o.lat, o.lon, 100);
  assert.ok(cem.some((m) => m.ibge_code === 3543402));
  assert.ok(cem.every((m, i) => i === 0 || m.distance_km >= cem[i - 1].distance_km));
  // Algum município entra pela borda mesmo com centroide além de 100 km.
  assert.ok(cem.some((m) => m.distance_km > 100));
});

test("P2-T2: cidade inexistente ou sem malha oficial não vira coordenada inventada", async (t) => {
  const { env, close } = setup();
  t.after(close);
  await assert.rejects(originPoint(env, "Boa Esperança do Norte", "MT"), /IBGE/);
  await assert.rejects(originPoint(env, "Sertãozinho", "MG"), /IBGE/);
});
