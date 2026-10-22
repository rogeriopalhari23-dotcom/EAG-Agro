// Base de mercados compradores (2026-10-21): o extrato PÚBLICO da lista mensal de produção (tests/fixtures/
// mercados-publicos.json; MDIC exportações do Brasil e UN Comtrade importações declaradas com origem Brasil, agregados
// por país, sem empresas nem dados pessoais) passa pela MESMA rotina do Compass; para CADA commodity do catálogo, os
// destinos mostrados pelo formulário são comparados com os destinos calculados diretamente do extrato, sem o código do
// Compass. Diferenças precisam ser zero (ou explicadas aqui). Também: histórico, ausência e pesquisa automática.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { setup } from "./helpers/db.mjs";
import { sources, tradeParams, driver, AGRI, rec } from "./helpers/trade.mjs";
import { summaryCatchUp } from "../src/importers.js";

const FIX = new URL("./fixtures/mercados-publicos.json", import.meta.url);
const EXTRACT = existsSync(FIX) ? JSON.parse(readFileSync(FIX, "utf8")) : null;

async function world(t, mutate = (x) => x) {
  const ctx = setup();
  t.after(() => ctx.close());
  const { api, DB, env } = ctx;
  const X = mutate(structuredClone(EXTRACT));
  await tradeParams(api, { period_default_months: 12, comtrade_calls_per_day: 5000, agri_classification: X.meta.classificacao }); // a mesma classificação da lista de produção
  const mdicCode = new Map(DB.raw.prepare("SELECT iso3,MIN(mdic_code) code FROM country_mdic_codes GROUP BY iso3").all().map((x) => [x.iso3, x.code]));
  const ctCode = new Map(DB.raw.prepare("SELECT iso3,comtrade_code FROM countries WHERE comtrade_code IS NOT NULL").all().map((x) => [x.iso3, x.comtrade_code]));
  const mdicRows = {};
  for (const [iso3, c] of Object.entries(X.mdic)) for (const [ncm, ym, fob, kg] of c.lines) if (mdicCode.get(iso3)) (mdicRows[ym.slice(0, 4)] ??= []).push(`"${ym.slice(0, 4)}";"${ym.slice(5, 7)}";"${ncm}";"10";"${mdicCode.get(iso3)}";"SP";"01";"0817600";${kg};${kg};${fob}`);
  const comtrade = {};
  for (const [iso3, c] of Object.entries(X.comtrade)) if (ctCode.has(iso3)) comtrade[ctCode.get(iso3)] = { years: c.years ?? [], rows: c.lines.map(([hs6, year, v]) => rec(ctCode.get(iso3), hs6, year, 76, v)) };
  const clean = (x) => String(x ?? "").replace(/"/g, "'").replace(/;/g, ",");
  const src = sources({ exclusive: true, mdicRows, comtrade, hs: X.meta.subposicoes, ncm: Object.entries(X.names).map(([n, [h, pt, en]]) => `"${n}";"10";"${h}";"${clean(pt)}";"${clean(en)}"`), covered: { mdic: Object.keys(X.mdic), comtrade: Object.keys(X.comtrade) }, label: "fora do extrato" });
  const d = driver(env, src, { at: new Date().toISOString() });
  env.MDIC_CHUNK_BYTES = String(4 * 1024 * 1024); // extrato real: pedaços do tamanho da produção, não os 150 bytes dos fixtures
  await d.start();
  await d.drain();
  const dest = async (body) => {
    let r;
    // Como na produção: o cron retoma os resumos que faltam em lotes (summaryCatchUp) entre as consultas da tela.
    for (let k = 0; k < 40; k++) if ((await summaryCatchUp(env, "eag-internal", { batch: 200 })).state === "idle") break;
    for (let k = 0; k < 15; k++) { r = (await api("/api/prospect/destinations", "POST", body)).data; if (!r.coverage?.pendingSummaries && r.state !== "preparing") break; }
    return r;
  };
  return { ...ctx, X, dest };
}

// Destinos esperados, calculados só do extrato: país com linha de qualquer subposição do produto (MDIC na janela
// guardada; Comtrade em qualquer ano guardado, origem Brasil).
function expected(X, hs6, countries) {
  const hs = new Set(hs6);
  const out = new Map();
  for (const [iso3, c] of Object.entries(X.mdic)) if (c.lines.some(([ncm, , fob, kg]) => hs.has(X.names[ncm]?.[0] ?? ncm.slice(0, 6)) && (fob > 0 || kg > 0))) out.set(iso3, "MDIC");
  // Comtrade: ano declarado recente (últimos 3 anos guardados + 1 de defasagem, contados do ano corrente).
  const minYear = new Date().getUTCFullYear() - 3 - 1;
  for (const [iso3, c] of Object.entries(X.comtrade)) if (c.lines.some(([h, y, v]) => hs.has(h) && y >= minYear && v > 0)) out.set(iso3, out.has(iso3) ? "MDIC+Comtrade" : "Comtrade");
  return new Map([...out].filter(([iso3]) => countries.has(iso3)));
}
// O que o extrato registra e as restrições vigentes deixam de fora: código sem país na base (agregados, Brasil) e
// declaração da Comtrade anterior ao ano mínimo (sem linha recente nem MDIC). → { outside: [iso3], oldOnly: [iso3] }
function excluded(X, hs6, countries) {
  const hs = new Set(hs6);
  const minYear = new Date().getUTCFullYear() - 3 - 1;
  const any = new Set(), recent = new Set();
  for (const [iso3, c] of Object.entries(X.mdic)) if (c.lines.some(([ncm, , fob, kg]) => hs.has(X.names[ncm]?.[0] ?? ncm.slice(0, 6)) && (fob > 0 || kg > 0))) (any.add(iso3), recent.add(iso3));
  for (const [iso3, c] of Object.entries(X.comtrade)) for (const [h, y, v] of c.lines) if (hs.has(h) && v > 0) (any.add(iso3), y >= minYear && recent.add(iso3));
  return { outside: [...any].filter((k) => !countries.has(k)), oldOnly: [...any].filter((k) => countries.has(k) && !recent.has(k)) };
}

test("extrato da base pública presente e identificado (origem, versões, natureza)", { skip: !EXTRACT && "extrato ausente" }, () => {
  assert.match(EXTRACT.meta.origem, /Produção, somente leitura/);
  assert.match(EXTRACT.meta.natureza, /sem empresas e sem dados pessoais/);
  assert.ok(EXTRACT.meta.cobertura.mdicPaises >= 200, JSON.stringify(EXTRACT.meta.cobertura));
});

test("catálogo inteiro: destinos do formulário = destinos calculados do extrato, commodity por commodity", { skip: !EXTRACT && "extrato ausente" }, async (t) => {
  const { api, DB, X, dest } = await world(t);
  const countries = new Set(DB.raw.prepare("SELECT iso3 FROM countries WHERE iso2 IS NOT NULL AND iso3<>'BRA'").all().map((x) => x.iso3));
  const catalog = (await api("/api/catalog")).data;
  const report = [];
  for (const c of [...new Set(catalog.products.filter((p) => p.active !== 0).map((p) => p.commodity))]) {
    const r = await dest({ commodity: c });
    const hs = X.meta.subposicoes.filter((h) => Object.entries(X.meta.produtos).some(([pid, codes]) => catalog.products.find((p) => p.id === pid)?.commodity === c && codes.includes(h)));
    const exp = expected(X, hs, countries);
    // Regra definitiva (2026-10-22): a caixa principal mostra TODO destino comprovado da commodity; empresa
    // identificada, pesquisa vazia, falha ou sem fonte de empresas não tiram nem acrescentam país.
    const got = new Set((r.principal ?? []).map((x) => x.iso3));
    assert.deepEqual([...got].sort(), r.items.map((x) => x.iso3).sort(), `${c}: caixa principal = destinos comprovados`);
    const missing = [...exp.keys()].filter((k) => !got.has(k));
    const extra = [...got].filter((k) => !exp.has(k));
    const ex = excluded(X, hs, countries);
    report.push(`${c}: extrato ${exp.size}, formulário ${got.size}${ex.outside.length ? `, fora da base de países ${ex.outside.join(",")}` : ""}${ex.oldOnly.length ? `, só Comtrade anterior ao ano mínimo ${ex.oldOnly.join(",")}` : ""}${missing.length ? `, faltando ${missing.join(",")}` : ""}${extra.length ? `, a mais ${extra.join(",")}` : ""}`);
    assert.deepEqual(missing, [], `${c}: destinos do extrato que o formulário não mostrou`);
    assert.deepEqual(extra, [], `${c}: país mostrado sem evidência no extrato`);
    // Commodities distintas não se misturam: cada país é fundamentado por produto da própria commodity.
    for (const x of r.items) assert.ok(x.products.every((p) => catalog.products.find((q) => q.id === p.productId)?.commodity === c), `${c} × ${x.iso3}: produto de outra commodity`);
    assert.equal(r.asks?.length ?? 0, 0, `${c}: seleção de mercado sem perguntas`);
  }
  t.diagnostic(report.join(" | "));
});

test("histórico: país sem linha no último ano da Comtrade continua comprovado pelos anos guardados", { skip: !EXTRACT && "extrato ausente" }, async (t) => {
  // Copia do extrato com um país em que a ÚNICA evidência de café é um ano anterior da Comtrade (sem MDIC).
  const { dest } = await world(t, (X) => {
    const coffee = X.meta.produtos["product-05"];
    X.mdic.JPN = { ...(X.mdic.JPN ?? {}), state: "purchase_identified", lines: (X.mdic.JPN?.lines ?? []).filter(([ncm]) => !coffee.includes(X.names[ncm]?.[0])) };
    X.comtrade.JPN = { state: "purchase_identified", lastPeriod: "2025", years: [2023, 2024, 2025], basis: "CIF", lines: [["090111", 2023, 5000, "CIF"]] };
    return X;
  });
  const r = await dest({ commodity: "coffee" });
  const jpn = r.items.find((x) => x.iso3 === "JPN");
  assert.ok(jpn, "Japão continua na lista pelo histórico guardado");
  assert.ok(jpn.evidence.some((e) => e.source === "comtrade" && e.extended && /2023/.test(e.period)), JSON.stringify(jpn.evidence));
});

test("ausência de dados e pesquisa automática usam a mesma relação", { skip: !EXTRACT && "extrato ausente" }, async (t) => {
  const { api, X, dest, DB } = await world(t);
  await api("/api/prospect/policy/prepare", "POST", {});
  // UCO: sem classificação documental → nunca lista nem "nenhum comércio".
  const uco = await dest({ commodity: "uco" });
  assert.equal(uco.items.length, 0);
  assert.notEqual(uco.state, "none_valid");
  // Derivados de soja (SH 2923.20, capítulo 29): fora da classificação agrícola da lista de produção (01–24 sem 03).
  // A base nunca consultou o produto: "consulta sem estes códigos", nunca "nenhum comércio".
  const lec = await dest({ commodity: "soy_lecithin" });
  assert.equal(lec.items.length, 0);
  assert.notEqual(lec.state, "none_valid", lec.message);
  assert.equal(lec.diagnostics[0].bySource.mdic.counts.not_consulted, lec.diagnostics[0].bySource.mdic.total - lec.diagnostics[0].bySource.mdic.counts.no_code - lec.diagnostics[0].bySource.mdic.counts.missing, lec.diagnostics[0].bySource.mdic.text);
  // Escolha automática: só combinação produto × país presente na relação.
  const countries = new Set(DB.raw.prepare("SELECT iso3 FROM countries WHERE iso2 IS NOT NULL AND iso3<>'BRA'").all().map((x) => x.iso3));
  for (let k = 0; k < 3; k++) {
    const a = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
    if (!a.started) break;
    const pid = a.job.input.productId, iso3 = a.job.input.location.iso3;
    assert.ok(expected(X, X.meta.produtos[pid] ?? [], countries).has(iso3), `automática escolheu ${pid} × ${iso3} sem evidência`);
  }
});
