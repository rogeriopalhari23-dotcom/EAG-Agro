// Mapa de fundo: leitura por faixa a partir de partes no R2, autenticada, sem servir o arquivo inteiro.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { setup } from "./helpers/db.mjs";

// R2 em memória com leitura por faixa (como env.FILES.get(key, { range })).
function rangeR2(objects) {
  return {
    async get(key, opts = {}) {
      const data = objects[key];
      if (!data) return null;
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
      const { offset = 0, length = bytes.length - offset } = opts.range || {};
      const slice = bytes.slice(offset, offset + length);
      return { arrayBuffer: async () => slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength), json: async () => JSON.parse(new TextDecoder().decode(bytes)) };
    },
  };
}
function fixture() {
  const whole = Uint8Array.from({ length: 25 }, (_, i) => i);
  const parts = [whole.slice(0, 10), whole.slice(10, 20), whole.slice(20)];
  const manifest = { name: "teste.pmtiles", size: 25, sha256: "a".repeat(64), bbox: [-74, -34, -34, 5], maxzoom: 12, attribution: "Protomaps © OpenStreetMap", license: "ODbL", parts: parts.map((p, i) => ({ key: `mapa/t/part-00${i}`, size: p.length })) };
  const objects = { "mapa/t/manifest.json": JSON.stringify(manifest) };
  parts.forEach((p, i) => (objects[`mapa/t/part-00${i}`] = p));
  return { whole, objects };
}
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
const get = (ctx, path, headers = {}) => worker.fetch(new Request(`http://localhost${path}`, { headers }), ctx.env);

check("Mapa: faixa que atravessa duas partes volta inteira (206) com Content-Range e ETag", async (ctx) => {
  const { whole, objects } = fixture();
  Object.assign(ctx.env, { FILES: rangeR2(objects), MAP_MANIFEST_KEY: "mapa/t/manifest.json" });
  const r = await get(ctx, "/api/mapa/brasil.pmtiles", { range: "bytes=8-21" });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), "bytes 8-21/25");
  assert.ok(r.headers.get("etag"));
  assert.match(r.headers.get("cache-control"), /^private/);
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [...whole.slice(8, 22)]);
  const info = await (await get(ctx, "/api/mapa")).json();
  assert.equal(info.available, true);
  assert.equal(info.attribution, "Protomaps © OpenStreetMap");
});
check("Mapa: sem Range, fora do arquivo ou sem manifesto não serve conteúdo", async (ctx) => {
  const { objects } = fixture();
  Object.assign(ctx.env, { FILES: rangeR2(objects), MAP_MANIFEST_KEY: "mapa/t/manifest.json" });
  assert.equal((await get(ctx, "/api/mapa/brasil.pmtiles")).status, 416);
  assert.equal((await get(ctx, "/api/mapa/brasil.pmtiles", { range: "bytes=30-40" })).status, 416);
  assert.equal((await get(ctx, "/api/mapa/brasil.pmtiles", { range: "bytes=5-2" })).status, 416);
  const ctx2 = setup();
  try {
    Object.assign(ctx2.env, { FILES: rangeR2({}), MAP_MANIFEST_KEY: "mapa/outro/manifest.json" });
    assert.equal((await (await get(ctx2, "/api/mapa")).json()).available, false);
    assert.equal((await get(ctx2, "/api/mapa/brasil.pmtiles", { range: "bytes=0-10" })).status, 404);
  } finally {
    ctx2.close();
  }
});
check("Mapa: rota exige sessão em produção (não é pública)", async (ctx) => {
  const { objects } = fixture();
  Object.assign(ctx.env, { FILES: rangeR2(objects), MAP_MANIFEST_KEY: "mapa/t/manifest.json", ENVIRONMENT: "production", ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com", ACCESS_AUD: "aud" });
  assert.equal((await get(ctx, "/api/mapa/brasil.pmtiles", { range: "bytes=0-10" })).status, 401);
});
