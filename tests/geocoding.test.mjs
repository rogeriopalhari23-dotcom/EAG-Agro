import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { geocodeUnit } from "../src/geocoding.js";
import { geocodeAddress } from "../src/adapters/locationiq.js";

// Formato da resposta copiado da documentação (lat/lon em texto); valores de teste.
const found = (over = {}) => [{ place_id: "1", lat: "-21.1401", lon: "-47.9902", display_name: "Rua das Flores, 100, Sertãozinho", class: "building", type: "yes", ...over }];
function fake(status, body, calls = []) {
  return async (url) => {
    calls.push(url);
    return new Response(JSON.stringify(body), { status });
  };
}
function seedUnit(DB, over = {}) {
  DB.raw.exec(`INSERT INTO companies(id,tenant_id,legal_name,country_code,cnpj_root,source_label,created_by) VALUES ('co','eag-internal','Doces','BR','11222333','teste','system-admin')`);
  const u = { id: "u1", street: "RUA DAS FLORES", number: "100", ...over };
  DB.raw
    .prepare(
      "INSERT INTO company_units(id,tenant_id,company_id,cnpj,street,street_number,postal_code,municipality_ibge,municipality_name,uf,lat,lon,geo_precision,source_label,consulted_at) VALUES (?,'eag-internal','co','11222333000181',?,?,'14160000',3551702,'SERTAOZINHO','SP',-21.1229,-48.0089,'municipality_centroid','teste','2026-09-23')",
    )
    .run(u.id, u.street, u.number);
  DB.raw.exec(`INSERT INTO campaigns(id,tenant_id,product_id,market,name,origin_city,origin_uf,radius_km,created_by) VALUES ('cp','eag-internal','product-06','national','A','Sertãozinho','SP',5,'system-admin');
    INSERT INTO searches(id,tenant_id,campaign_id,version,origin_ibge,origin_lat,origin_lon,origin_precision,radius_km,cnae_codes_json,source_versions_json,status,request_key,created_by) VALUES ('s1','eag-internal','cp',1,3551702,-21.1229,-48.0089,'municipality_centroid',5,'[]','{}','complete','k','system-admin');
    INSERT INTO search_candidates VALUES ('s1','u1',0,'municipality_centroid','estimated');`);
}
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    ctx.env.LOCATIONIQ_KEY = "chave-teste";
    await fn(ctx);
  });
}

check("P2-T5: plano pago grava endereço, recalcula distância e o mesmo endereço não é pago de novo", async ({ env, DB }) => {
  env.LOCATIONIQ_PLAN = "paid";
  seedUnit(DB);
  const calls = [];
  const r = await geocodeUnit(env, "u1", { fetchImpl: fake(200, found(), calls) });
  assert.deepEqual({ status: r.status, applied: r.applied }, { status: "geocoded", applied: true });
  const u = DB.raw.prepare("SELECT geo_precision,lat,geo_source FROM company_units WHERE id='u1'").get();
  assert.equal(u.geo_precision, "address");
  assert.equal(u.lat, -21.1401);
  assert.match(u.geo_source, /locationiq/);
  const c = DB.raw.prepare("SELECT distance_basis,inside_radius,distance_km FROM search_candidates").get();
  assert.equal(c.distance_basis, "address");
  assert.equal(c.inside_radius, "confirmed");
  assert.ok(c.distance_km > 1 && c.distance_km < 5);
  // Unidade já precisa: nada a fazer, nenhuma chamada.
  assert.equal((await geocodeUnit(env, "u1", { fetchImpl: fake(200, found(), calls) })).status, "already_precise");
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].includes("undefined"));
});

check("P2-T5: cache por endereço normalizado evita segunda chamada para outra unidade no mesmo endereço", async ({ env, DB }) => {
  env.LOCATIONIQ_PLAN = "paid";
  seedUnit(DB);
  DB.raw.exec(
    "INSERT INTO company_units(id,tenant_id,company_id,cnpj,street,street_number,postal_code,municipality_ibge,municipality_name,uf,geo_precision,source_label,consulted_at) VALUES ('u2','eag-internal','co','11222333000262','Rua das Flores','100','14160-000',3551702,'Sertãozinho','SP','unknown','teste','2026-09-23')",
  );
  const calls = [];
  await geocodeUnit(env, "u1", { fetchImpl: fake(200, found(), calls) });
  const r = await geocodeUnit(env, "u2", { fetchImpl: fake(200, found(), calls) });
  assert.equal(r.status, "cache_hit");
  assert.equal(calls.length, 1);
});

check("P2-T5: resposta no nível da cidade continua centroide; 404 é 'não encontrado' em cache", async ({ env, DB }) => {
  env.LOCATIONIQ_PLAN = "paid";
  seedUnit(DB);
  const r = await geocodeUnit(env, "u1", { fetchImpl: fake(200, found({ class: "place", type: "town" })) });
  assert.equal(r.precision, "municipality_centroid");
  assert.equal(r.applied, false);
  assert.equal(DB.raw.prepare("SELECT geo_precision FROM company_units").get().geo_precision, "municipality_centroid");
  DB.raw.exec("DELETE FROM geocode_cache");
  const calls = [];
  assert.equal((await geocodeUnit(env, "u1", { fetchImpl: fake(404, { error: "Unable to geocode" }, calls) })).status, "not_found");
  assert.equal((await geocodeUnit(env, "u1", { fetchImpl: fake(404, {}, calls) })).cached, true);
  assert.equal(calls.length, 1);
});

check("P2-T5: plano gratuito não grava coordenada permanente e o cache expira em 48 h", async ({ env, DB }) => {
  seedUnit(DB);
  const now = "2026-09-23T12:00:00.000Z";
  const r = await geocodeUnit(env, "u1", { fetchImpl: fake(200, found()), now });
  assert.equal(r.status, "transient");
  assert.equal(DB.raw.prepare("SELECT geo_precision FROM company_units").get().geo_precision, "municipality_centroid");
  assert.equal(DB.raw.prepare("SELECT expires_at FROM geocode_cache").get().expires_at, "2026-09-25T12:00:00.000Z");
  const calls = [];
  await geocodeUnit(env, "u1", { fetchImpl: fake(200, found(), calls), now: "2026-09-26T12:00:00.000Z" });
  assert.equal(calls.length, 1, "cache vencido gera nova consulta");
});

check("P2-T5: sem logradouro não chama a API; erros viram erro tipado, nunca coordenada", async ({ env, DB }) => {
  seedUnit(DB, { street: null });
  const calls = [];
  assert.equal((await geocodeUnit(env, "u1", { fetchImpl: fake(200, found(), calls) })).status, "no_address");
  assert.equal(calls.length, 0);
  const a = { street: "Rua A", city: "Sertãozinho", uf: "SP" };
  await assert.rejects(geocodeAddress(env, a, fake(429, { error: "Rate Limited Second" })), (e) => e.kind === "temporary");
  await assert.rejects(geocodeAddress(env, a, fake(401, { error: "Invalid key" })), (e) => e.kind === "auth");
  await assert.rejects(geocodeAddress(env, a, fake(403, { error: "Service not enabled" })), (e) => e.kind === "auth");
  await assert.rejects(geocodeAddress(env, a, fake(200, found({ lat: "48.8", lon: "2.3" }))), (e) => e.kind === "schema");
  try {
    await geocodeAddress(env, a, fake(500, {}));
  } catch (e) {
    assert.ok(!e.message.includes(env.LOCATIONIQ_KEY));
  }
});
