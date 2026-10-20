// Origem da rodada sem código nem coordenada digitados, e produto do cadastro preso à commodity da rodada (2026-10-20).
// Banco em memória com todas as migrações (5.570 municípios do IBGE). Só dados fictícios; nenhum registro real é lido.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setup } from "./helpers/db.mjs";

const base = JSON.parse(readFileSync(new URL("../docs/implementation/rodadas/exemplos/soja-rio-verde-150km.json", import.meta.url)));
// Rodada de café de demonstração: origem só por cidade e estado, sem segmentos de outra commodity.
const coffee = (origin, extra = {}) => ({
  ...base,
  id: "cafe-teste",
  commodity: { code: "coffee", label: "café", segments: {}, ...extra },
  origin,
  radius: { value: 150, unit: "km", method: "haversine" },
});
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(() => ctx.close());
    await fn(ctx);
  });
}
const create = (api, config, name = "Café de teste") => api("/api/rounds", "POST", { name, config });

check("busca de municípios: por estado e nome, homônimos com o estado; base oficial", async ({ api }) => {
  const g = (await api("/api/geo/municipalities?uf=MG&q=guax")).data.items;
  assert.deepEqual(g[0], { code: "3128709", name: "Guaxupé", uf: "MG" });
  const bj = (await api("/api/geo/municipalities?q=bom%20jesus")).data.items.filter((m) => m.name === "Bom Jesus");
  assert.deepEqual(bj.map((m) => m.uf).sort(), ["PB", "PI", "RN", "RS", "SC"]);
  assert.equal((await api("/api/geo/municipalities?q=bo")).status, 422, "sem estado, pede ao menos 3 letras");
  const regions = (await api("/api/geo/regions?country=BR")).data;
  assert.equal(regions.items.length, 27);
  const abroad = (await api("/api/geo/regions?country=DE")).data;
  assert.equal(abroad.supported, false);
  assert.doesNotMatch(abroad.message, /lat|lon|coordenad/i, "não pede latitude e longitude");
});

check("origem no Brasil por cidade e estado: código IBGE resolvido e gravado; área calculada sem digitar código", async ({ api }) => {
  const r = await create(api, coffee({ country: "BR", region: "mg", municipality: "guaxupe" }));
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const g = (await api(`/api/rounds/${r.data.id}`)).data;
  assert.deepEqual([g.config.origin.municipality, g.config.origin.region, g.config.origin.municipalityCode], ["Guaxupé", "MG", "3128709"]);
  assert.equal(g.config.origin.lat, undefined, "nenhuma coordenada inventada na configuração");
  const area = (await api(`/api/rounds/${r.data.id}/area`)).data;
  assert.equal(area.radiusKm, 150);
  assert.ok(area.summary.municipalities > 50);
  assert.ok(area.summary.regions.includes("MG") && area.summary.regions.includes("SP"));
});

check("homônimos: sem estado é recusado com as opções; com estado escolhe o certo; código e estado divergentes recusados", async ({ api }) => {
  const amb = await create(api, coffee({ country: "BR", municipality: "Bom Jesus" }));
  assert.equal(amb.status, 422);
  assert.equal(amb.data.error.code, "origin_ambiguous");
  assert.deepEqual(amb.data.error.details.ufs, ["PB", "PI", "RN", "RS", "SC"]);
  const rs = await create(api, coffee({ country: "BR", region: "RS", municipality: "Bom Jesus" }));
  assert.equal(rs.status, 201);
  assert.equal((await api(`/api/rounds/${rs.data.id}`)).data.config.origin.region, "RS");
  const sc = await create(api, coffee({ country: "BR", region: "SC", municipality: "Bom Jesus" }));
  assert.notEqual((await api(`/api/rounds/${sc.data.id}`)).data.config.origin.municipalityCode, (await api(`/api/rounds/${rs.data.id}`)).data.config.origin.municipalityCode);
  const mismatch = await create(api, coffee({ country: "BR", region: "SP", municipality: "Guaxupé", municipalityCode: "3128709" }));
  assert.equal(mismatch.status, 422);
  assert.equal(mismatch.data.error.code, "origin_mismatch");
  const missing = await create(api, coffee({ country: "BR", region: "MG", municipality: "Cidade Inexistente" }));
  assert.equal(missing.data.error.code, "origin_not_found");
});

check("fora do Brasil sem coordenada: rodada salva, limitação explicada sem pedir latitude/longitude; coordenada antiga preservada", async ({ api }) => {
  const r = await create(api, coffee({ country: "DE", municipality: "Hamburgo" }));
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const geo = r.data.preflight.items.find((x) => x.area === "geografia");
  assert.equal(geo.level, "unsupported", "nunca apresentado como localização confirmada");
  const area = await api(`/api/rounds/${r.data.id}/area`);
  assert.equal(area.status, 422);
  assert.equal(area.data.error.code, "origin_unsupported");
  assert.doesNotMatch(area.data.error.message, /lat|lon|coordenad/i);
  await api(`/api/rounds/${r.data.id}/preflight-ack`, "POST", { revision: 1 });
  const run = await api(`/api/rounds/${r.data.id}/run`, "POST", {});
  assert.equal(run.status, 422, "execução sem origem não acontece");
  // Configuração que já tinha coordenada (exemplo de Hamburgo): continua funcionando e a coordenada fica gravada.
  const old = await create(api, coffee({ country: "DE", lat: 53.5511, lon: 9.9937, label: "Hamburgo (coordenada)" }));
  assert.equal(old.status, 201);
  const g = (await api(`/api/rounds/${old.data.id}`)).data;
  assert.equal(g.config.origin.lat, 53.5511);
  assert.equal((await api(`/api/rounds/${old.data.id}/area`)).status, 200);
});

check("produto preso à commodity: configuração e cadastro recusam produto de outra commodity; troca só pela revisão", async ({ api }) => {
  const bad = await create(api, coffee({ country: "BR", region: "MG", municipality: "Guaxupé" }, { productId: "product-01" }));
  assert.equal(bad.status, 422);
  assert.equal(bad.data.error.code, "product_mismatch");
  const r = await create(api, coffee({ country: "BR", region: "MG", municipality: "Guaxupé" }, { productId: "product-05" }));
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const reg = await api(`/api/rounds/${r.data.id}/register`, "POST", { mode: "discovery", productId: "product-01" });
  assert.equal(reg.status, 422);
  assert.equal(reg.data.error.code, "product_mismatch");
  assert.match(reg.data.error.message, /Soja GMO/);
  // Rodada de milho com produto definido: outra variedade da mesma commodity também exige revisão da configuração.
  const corn = await create(api, { ...base, id: "milho-teste", commodity: { ...base.commodity, code: "corn", label: "milho", productId: "product-03" }, origin: { country: "BR", region: "GO", municipality: "Indiara" } });
  assert.equal(corn.status, 201, JSON.stringify(corn.data));
  const other = await api(`/api/rounds/${corn.data.id}/register`, "POST", { mode: "discovery", productId: "product-04" });
  assert.equal(other.data.error.code, "product_mismatch");
  // Commodity sem correspondência no catálogo (código digitado livremente): nenhum produto passa.
  const free = await create(api, coffee({ country: "BR", region: "MG", municipality: "Guaxupé" }, { code: "cafe" }));
  assert.equal(free.status, 201);
  for (const pid of ["product-01", "product-05"])
    assert.equal((await api(`/api/rounds/${free.data.id}/register`, "POST", { mode: "discovery", productId: pid })).data.error.code, "product_mismatch");
});

check("catálogo da rodada: segmentos sugeridos por commodity, sem herdar ração ou milho no café", async ({ api }) => {
  const c = (await api("/api/round-catalog")).data;
  assert.deepEqual(Object.keys(c.segmentPresets.coffee), ["roaster"]);
  assert.ok(c.segmentPresets.corn.feed_mill);
  assert.equal(c.segmentPresets.coffee.feed_mill, undefined);
  assert.equal(c.sources["mapa-sipeagro"].segmentRule, "sipeagro");
  assert.equal(c.segmentPresets.sugar, undefined, "commodity sem sugestão não recebe a de outra");
});
