import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { runPartition, planPartitions } from "../src/search.js";
import { handleQueue } from "../src/queue.js";

const unit = (cnpj, municipio, over = {}) => ({
  cnpj,
  cnpj_raiz: cnpj.slice(0, 8),
  razao_social: over.razao || `EMPRESA ${cnpj.slice(0, 8)} LTDA`,
  porte_empresa: { codigo: over.porte || "05", descricao: "Demais" },
  matriz_filial: cnpj.slice(8, 12) === "0001" ? "MATRIZ" : "FILIAL",
  situacao_cadastral: { situacao_cadastral: "ATIVA" },
  endereco: { cep: "14160000", logradouro: "RUA A", numero: "1", bairro: "CENTRO", uf: "SP", municipio: municipio.toUpperCase(), ibge: { codigo_municipio: over.ibge } },
});
const SERT = 3551702, RP = 3543402;
// Respostas por município da partição (o corpo enviado decide).
// Simula a Casa dos Dados pelo conjunto de municípios pedido; erro de qualquer município derruba a consulta.
function provider(map, calls = []) {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    const names = body.municipio || [`uf:${body.uf[0]}`];
    calls.push(names.join("|"));
    const hits = names.map((n) => map[n]).filter(Boolean);
    const bad = hits.find((h) => h.status !== 200);
    if (bad) return new Response(JSON.stringify(bad.body), { status: bad.status });
    const cnpjs = hits.flatMap((h) => h.body.cnpjs);
    return new Response(JSON.stringify({ total: cnpjs.length, cnpjs }), { status: 200 });
  };
}
async function ready(ctx, { radius } = {}) {
  const { api, env } = ctx;
  env.CASADOSDADOS_API_KEY = "k";
  env.sent = [];
  env.ASYNC_QUEUE = { sendBatch: async (msgs) => env.sent.push(...msgs) };
  await api("/api/sectors", "POST", {
    sector: "balas",
    cnaeCode: "1093702",
    label: "Balas",
    source: "https://concla.ibge.gov.br/",
  });
  const c = await api("/api/campaigns", "POST", {
    productId: "product-06",
    market: "national",
    name: "Açúcar Sertãozinho",
    originCity: "Sertãozinho",
    originUf: "SP",
    radiusKm: radius ?? 5,
    icp: { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
  });
  await api(`/api/campaigns/${c.data.id}/activate`, "POST", { expectedVersion: 1 });
  return c.data.id;
}
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
async function drain(env, fetchImpl, now) {
  // Processa todas as mensagens enfileiradas (inclusive as que a própria execução cria).
  let guard = 0;
  while (env.sent.length && guard++ < 200) {
    const msg = env.sent.shift();
    if (msg.body.type !== "search_partition") continue;
    await runPartition(env, msg.body.partitionId, { fetchImpl, now: now?.() });
  }
}

check("P2-T4: busca só com commodity, cidade e raio; reenvio no mesmo dia não duplica (AT15)", async (ctx) => {
  const campaignId = await ready(ctx);
  const a = await ctx.api("/api/searches", "POST", { campaignId });
  assert.equal(a.status, 201);
  assert.ok(a.data.partitions >= 1);
  const b = await ctx.api("/api/searches", "POST", { campaignId });
  assert.equal(b.data.searchId, a.data.searchId);
  assert.equal(b.data.reused, true);
  assert.equal(ctx.env.sent.length, a.data.partitions);
});

check("P2-T4: raio fora da lista é recusado (AT66); setor sem CNAE bloqueia", async (ctx) => {
  const campaignId = await ready(ctx);
  assert.equal((await ctx.api("/api/searches", "POST", { campaignId, radiusKm: 150 })).status, 422);
  ctx.DB.raw.exec("DELETE FROM sector_cnae");
  const r = await ctx.api("/api/searches", "POST", { campaignId });
  assert.equal(r.data.error.code, "sector_unmapped");
});

check("P2-T4: mudar o raio cria v2 e preserva a v1 (AT37)", async (ctx) => {
  const campaignId = await ready(ctx);
  const v1 = (await ctx.api("/api/searches", "POST", { campaignId })).data;
  await drain(ctx.env, provider({ sertaozinho: { status: 200, body: { total: 1, cnpjs: [unit("11222333000181", "Sertaozinho", { ibge: SERT })] } } }));
  const before = (await ctx.api(`/api/searches/${v1.searchId}`)).data.search;
  assert.equal(before.status, "complete");
  const v2 = (await ctx.api("/api/searches", "POST", { campaignId, radiusKm: 100 })).data;
  assert.equal(v2.version, 2);
  const after = (await ctx.api(`/api/searches/${v1.searchId}`)).data.search;
  assert.equal(after.radius_km, 5);
  assert.equal(after.candidates_count, before.candidates_count);
  assert.equal(ctx.DB.raw.prepare("SELECT parent_search_id p FROM searches WHERE id=?").get(v2.searchId).p, v1.searchId);
});

check("P2-T4: mesma empresa em duas filiais vira uma empresa com duas unidades; sócios não são gravados", async (ctx) => {
  const campaignId = await ready(ctx, { radius: 100 });
  await ctx.api("/api/searches", "POST", { campaignId });
  await drain(
    ctx.env,
    provider({
      sertaozinho: { status: 200, body: { total: 1, cnpjs: [unit("11222333000181", "Sertaozinho", { ibge: SERT })] } },
      "ribeirao preto": { status: 200, body: { total: 1, cnpjs: [unit("11222333000262", "Ribeirao Preto", { ibge: RP })] } },
    }),
  );
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE cnpj_root='11222333'").get().n, 1);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM company_units").get().n, 2);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM company_units WHERE geo_precision='municipality_centroid'").get().n, 2);
});

check("P2-T4: partição processada duas vezes (ou em paralelo) não duplica nada", async (ctx) => {
  const campaignId = await ready(ctx);
  await ctx.api("/api/searches", "POST", { campaignId });
  const msgs = [...ctx.env.sent];
  const calls = [];
  const fetchImpl = provider({ sertaozinho: { status: 200, body: { total: 1, cnpjs: [unit("11222333000181", "Sertaozinho", { ibge: SERT })] } } }, calls);
  const first = msgs.find(Boolean).body.partitionId;
  const [a, b] = await Promise.all([runPartition(ctx.env, first, { fetchImpl }), runPartition(ctx.env, first, { fetchImpl })]);
  assert.equal([a, b].filter((r) => r.processed).length, 1);
  assert.equal((await runPartition(ctx.env, first, { fetchImpl })).skipped, true);
  assert.equal(calls.length, 1);
});

check("P2-T4: fonte que falha deixa busca parcial com o nome do lugar e preserva o resto (AT67)", async (ctx) => {
  const campaignId = await ready(ctx, { radius: 100 });
  const s = (await ctx.api("/api/searches", "POST", { campaignId })).data;
  let clock = Date.parse("2026-09-23T12:00:00Z");
  const fetchImpl = provider({
    sertaozinho: { status: 200, body: { total: 1, cnpjs: [unit("11222333000181", "Sertaozinho", { ibge: SERT })] } },
    franca: { status: 429, body: {} },
  });
  await drain(ctx.env, fetchImpl, () => new Date((clock += 3600000)).toISOString());
  const r = (await ctx.api(`/api/searches/${s.searchId}`)).data.search;
  assert.equal(r.status, "partial");
  assert.match(r.coverage_note, /Franca.*\/SP \[temporary\]/);
  assert.equal(r.candidates_count, 1);
  const fr = ctx.DB.raw.prepare("SELECT attempts,status FROM search_partitions WHERE municipality_names_json LIKE '%Franca%'").get();
  assert.deepEqual({ ...fr }, { attempts: 3, status: "failed" });
});

check("P2-T4: sem saldo para todas as partições restantes sem gastar chamadas", async (ctx) => {
  const campaignId = await ready(ctx, { radius: 100 });
  const s = (await ctx.api("/api/searches", "POST", { campaignId })).data;
  const calls = [];
  await drain(ctx.env, provider(new Proxy({}, { get: () => ({ status: 403, body: {} }) }), calls));
  const r = (await ctx.api(`/api/searches/${s.searchId}`)).data.search;
  assert.equal(r.status, "failed");
  assert.equal(calls.length, 1);
  assert.match(r.coverage_note, /no_balance/);
});

check("P2-T4: ordem por distância põe desconhecido no fim; ICP provisório pelo porte", async (ctx) => {
  const campaignId = await ready(ctx, { radius: 100 });
  const s = (await ctx.api("/api/searches", "POST", { campaignId })).data;
  await drain(
    ctx.env,
    provider({
      sertaozinho: {
        status: 200,
        body: {
          total: 3,
          cnpjs: [
            unit("11222333000181", "Sertaozinho", { ibge: SERT, porte: "01" }),
            unit("22333444000155", "Sertaozinho", { ibge: SERT }),
            unit("33444555000100", "Sertaozinho", { ibge: undefined }),
          ],
        },
      },
      "ribeirao preto": { status: 200, body: { total: 1, cnpjs: [unit("44555666000111", "Ribeirao Preto", { ibge: RP })] } },
    }),
  );
  const d = (await ctx.api(`/api/searches/${s.searchId}/candidates?order=distance`)).data.items;
  assert.equal(d.at(-1).cnpj, "33444555000100");
  assert.equal(d.at(-1).inside_radius, "unknown");
  assert.ok(d[0].distance_km <= d[1].distance_km);
  const icp = (await ctx.api(`/api/searches/${s.searchId}/candidates?order=icp`)).data.items;
  assert.equal(icp.at(-1).icp_status, "out_small");
  assert.ok(icp.every((x) => x.icp_provisional));
});

check("P2-T4: endereço já geocodificado não é rebaixado para centroide", async (ctx) => {
  const campaignId = await ready(ctx);
  await ctx.api("/api/searches", "POST", { campaignId });
  const fetchImpl = provider({ sertaozinho: { status: 200, body: { total: 1, cnpjs: [unit("11222333000181", "Sertaozinho", { ibge: SERT })] } } });
  await drain(ctx.env, fetchImpl);
  ctx.DB.raw.exec("UPDATE company_units SET lat=-21.14,lon=-47.99,geo_precision='address',geo_source='locationiq' WHERE cnpj='11222333000181'");
  const v2 = (await ctx.api("/api/searches", "POST", { campaignId, radiusKm: 100 })).data;
  await drain(ctx.env, fetchImpl);
  const u = ctx.DB.raw.prepare("SELECT geo_precision,lat FROM company_units WHERE cnpj='11222333000181'").get();
  assert.equal(u.geo_precision, "address");
  assert.equal(u.lat, -21.14);
  const cand = ctx.DB.raw.prepare("SELECT distance_basis,inside_radius FROM search_candidates WHERE search_id=?").get(v2.searchId);
  assert.deepEqual({ ...cand }, { distance_basis: "address", inside_radius: "confirmed" });
});

check("P2-T4: estado inteiro dentro do raio vira uma partição por UF", async (ctx) => {
  const origin = { lat: -21.1229, lon: -48.0089 };
  const plan = await planPartitions(ctx.env, origin, 1500);
  const ufs = plan.filter((p) => p.scope === "uf").map((p) => p.uf);
  assert.ok(ufs.includes("SP") && ufs.includes("RJ"), ufs.join(","));
  assert.ok(plan.length < 1500, `partições: ${plan.length}`);
});

test("P2-T4: fila descarta tipo desconhecido e reentrega erro inesperado", async () => {
  const log = [];
  const msg = (type) => ({ body: { type }, ack: () => log.push(`ack:${type}`), retry: () => log.push(`retry:${type}`) });
  await handleQueue({ messages: [msg("nada"), msg("boom")] }, {}, { handlers: { boom: async () => { throw new Error("x"); } } });
  assert.deepEqual(log, ["ack:nada", "retry:boom"]);
});
