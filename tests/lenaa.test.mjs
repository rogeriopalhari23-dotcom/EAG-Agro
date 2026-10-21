// Descoberta real no Chile pela LENAA do SAG (2026-10-21): leitura da planilha oficial, identidade (RUT com dígito
// verificador), atividade compatível com a commodity, filtro de país, falha sem simulação e repetição sem duplicar.
// A planilha deste teste é montada aqui (nomes e RUTs inventados, RUTs com dígito válido); a fonte real foi conferida
// pela interface na execução local real.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { readXlsx } from "../src/adapters/xlsx.js";
import { clLenaaCandidates, validRut, LENAA_PAGE } from "../src/adapters/discovery.js";
import { proposalFor } from "../src/discovery-map.js";
import { foreignSources } from "../src/sources-applicable.js";

// Zip "stored" (sem compressão) com as partes mínimas de um .xlsx.
function xlsx(rows) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const col = (i) => String.fromCharCode(65 + i);
  const sheet = `<worksheet><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => `<c r="${col(ci)}${ri + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const files = [["xl/worksheets/sheet1.xml", sheet]];
  const enc = new TextEncoder();
  const parts = [], central = [];
  let off = 0;
  const crc = (b) => { let c = -1; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; };
  for (const [name, text] of files) {
    const n = enc.encode(name), d = enc.encode(text), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(8, 0, true); h.setUint32(14, crc(d), true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, n.length, true);
    parts.push(new Uint8Array(h.buffer), n, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(10, 0, true); c.setUint32(16, crc(d), true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), n);
    off += 30 + n.length + d.length;
  }
  const cd = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cd, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const b of all) out.set(b, p), (p += b.length);
  return out;
}
const ROWS = [
  ["Lista de Elaboradores Nacionales de Alimentos para Animales (LENAA)"],
  ["Fecha de actualización:09/10/2026"],
  ["Código", "N° Resolución", "Región", "Oficina SAG", "Nombre del Establecimiento", "", "Fecha", "Actividad N°1", "Actividad N°2"],
  ["RM 01-001N", "10", "Metropolitana", "Metropolitana", "Alimentos Andinos SpA (teste)", "76.123.456-0", "46300", "Fábrica de alimentos completos para aves y cerdos", ""],
  ["LL 02-001N", "11", "Los Lagos", "Los Lagos", "Alimentos Andinos SpA (teste)", "76.123.456-0", "46301", "Fábrica de alimentos no medicados para peces", ""],
  ["BB 01-001N", "12", "Bio-Bio", "Bio-Bio", "Suplementos Sur SpA (teste)", "77.654.321-7", "46302", "Fabricante de suplementos y aditivos para mascotas", ""],
  ["CO 01-001N", "13", "Coquimbo", "Coquimbo", "Nome de pessoa física (teste)", "XXX", "46303", "Elaboradora de alimento completo para aves", ""],
  ["MA 01-001N", "14", "Maule", "Maule", "Molinos del Maule Ltda. (teste)", "78.111.222-4", "46304", "Elaboradora de ingredientes de origen vegetal para alimentación animal", "Venta a terceros"],
  ...Array.from({ length: 7 }, (_, k) => [`MA 02-00${k}N`, `2${k}`, "Maule", "Maule", "Molinos del Maule Ltda. (teste)", "78.111.222-4", "46310", "Elaboradora de alimentos completos y concentrados para bovinos de leche, rumiantes y aves de postura en planta industrial", "Venta a terceros a granel y ensacado"]),
];
const PAGE = `<html><a href="/sites/default/files/LENAA%20%2009-10-2026%20-%20PUBLICA.xlsx">LENAA</a></html>`;
const sagFetch = (bytes, { failXlsx = false } = {}) => async (url) => {
  const u = String(url);
  if (u === LENAA_PAGE) return new Response(PAGE, { status: 200, headers: { "content-type": "text/html" } });
  if (u.includes("LENAA")) return failXlsx ? new Response("indisponível", { status: 503 }) : new Response(bytes, { status: 200 });
  throw new Error(`rede bloqueada no teste: ${u}`);
};

test("RUT chileno: dígito verificador conferido; RUT mascarado de pessoa física recusado", () => {
  for (const r of ["76.123.456-0", "77.654.321-7", "78.111.222-4", "96.547.710-1", "76.076.311-K"]) assert.ok(validRut(r), r);
  for (const r of ["XXX", "76.123.456-1", "78.0171.61-8", ""]) assert.ok(!validRut(r), r);
});

test("LENAA: uma candidata por RUT, só atividade compatível com a commodity, pessoa física fora; endereço da fonte guardado", async () => {
  const bytes = xlsx(ROWS);
  assert.equal((await readXlsx(bytes)).length, ROWS.length);

  const r = await clLenaaCandidates({ activity: proposalFor(["120190"]).processors.feedRegistry }, sagFetch(bytes));
  assert.deepEqual(r.candidates.map((c) => c.registry.id).sort(), ["76123456-0", "78111222-4"]);
  const andinos = r.candidates.find((c) => c.registry.id === "76123456-0");
  assert.match(andinos.activity.label, /RM 01-001N .*aves y cerdos .*\| SAG LL 02-001N .*peces/, "as duas plantas juntas");
  assert.equal(andinos.registry.type, "RUT");
  const maule = r.candidates.find((c) => c.registry.id === "78111222-4");
  assert.ok(maule.activity.label.length <= 440 && /\+\d+ planta\(s\) na planilha LENAA$/.test(maule.activity.label), "8 plantas cabem no cadastro, com o restante contado");
  assert.equal(maule.activity.code, "LENAA (8 plantas)");
  assert.match(andinos.city, /Chile/);
  assert.equal(andinos.recordUrl, "https://www.sag.gob.cl/sites/default/files/LENAA%20%2009-10-2026%20-%20PUBLICA.xlsx");
  assert.deepEqual(r.skipped, { invalidRut: 1, otherActivity: 1 }, "pessoa física (RUT mascarado) e suplemento de mascote fora");
  assert.equal(r.updated, "09/10/2026");
  assert.ok(!JSON.stringify(r).includes("pessoa física (teste)"), "nenhum nome de pessoa física guardado");
});

test("filtro de país e de commodity: a LENAA só vale para o Chile e para commodity de uso em ração", () => {
  assert.ok(foreignSources("CL", ["120190"]).some((x) => x.key === "cl_sag_lenaa"));
  assert.ok(foreignSources("CL", ["230400"]).some((x) => x.key === "cl_sag_lenaa"));
  assert.ok(!foreignSources("PE", ["120190"]).some((x) => x.key === "cl_sag_lenaa"), "outro país: fora");
  assert.ok(!foreignSources("CL", ["090111"]).some((x) => x.key === "cl_sag_lenaa"), "café: fora");
  assert.ok(!foreignSources("CL", ["170199"]).some((x) => x.key === "cl_sag_lenaa"), "açúcar: fora");
});

test("falha real da fonte: erro registrado, nenhuma candidata e nenhuma simulação como alternativa", async () => {
  await assert.rejects(clLenaaCandidates({ activity: proposalFor(["120190"]).processors.feedRegistry }, sagFetch(null, { failXlsx: true })), /SAG: planilha LENAA respondeu 503/);
  // O código publicado não tem mundo simulado nem nomes fictícios (só testes e a prévia de demonstração os usam).
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith(".js") ? [`${d}/${e.name}`] : []));
  for (const f of walk(new URL("../src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) assert.doesNotMatch(readFileSync(f, "utf8"), /simulated-world|previa\.invalid|\(fiktiv\)|\(fictícia\)/, f);
});

test("OpenStreetMap: moinho de azeite de oliva não é comprador de soja (matéria-prima diferente)", () => {
  const p = proposalFor(["120190"]).processors;
  assert.ok(p.exclude.test("Planta de Aceite de Oliva María Isabel") && p.exclude.test("Almazara Qori"));
  assert.ok(!p.exclude.test("Nutrikelef"));
  assert.ok(p.osm.some(([k, v]) => k === "industrial" && v === "feed"), "fábrica de ração entra para a soja");
});

test("pela rota do motor: descobrir duas vezes e aceitar não duplica empresas; país da busca respeitado", async (t) => {
  const { api, DB, env, close } = setup();
  t.after(close);
  keepCountries(DB, ["CHL", "DEU"]);
  await tradeParams(api, { period_default_months: 12 });
  const drv = driver(env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await drv.start();
  await drv.drain();
  const bytes = xlsx(ROWS);
  const real = globalThis.fetch;
  globalThis.fetch = sagFetch(bytes);
  t.after(() => (globalThis.fetch = real));
  // Busca real do motor na Alemanha (o extrato de comércio do teste cobre café na Alemanha): a LENAA é recusada lá.
  const an = await api("/api/country-analyses", "POST", { iso3: "DEU" });
  const sel = await api(`/api/country-analyses/${an.data.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  const fs = (await api(`/api/campaigns/${sel.data.campaigns[0].id}/foreign-search`, "POST", { confirm: true })).data;
  assert.equal((await api(`/api/foreign-searches/${fs.id}/discover`, "POST", { source: "cl_sag_lenaa", role: "processor" })).data.error.code, "source_not_available", "outro país: recusada");
  // A mesma busca passa a ser Soja — Chile (o extrato de teste não tem comércio chileno; a análise real foi conferida na execução local).
  DB.raw.prepare(`UPDATE foreign_searches SET iso3='CHL', hs6_json='["120190"]' WHERE id=?`).run(fs.id);
  DB.raw.prepare("UPDATE campaigns SET country_code='CL' WHERE id=?").run(sel.data.campaigns[0].id);
  for (let k = 0; k < 2; k++) {
    const d = await api(`/api/foreign-searches/${fs.id}/discover`, "POST", { source: "cl_sag_lenaa", role: "processor" });
    assert.equal(d.status, 201, JSON.stringify(d.data));
  }
  const cand = DB.raw.prepare("SELECT id FROM discovery_candidates WHERE search_id=?").all(fs.id).map((x) => x.id);
  assert.equal(cand.length, 2, "repetir a descoberta não duplica candidatas");
  for (let k = 0; k < 2; k++) await api(`/api/foreign-searches/${fs.id}/discovery/accept`, "POST", { ids: cand });
  const co = DB.raw.prepare("SELECT country_code,registration_id,registration_id_type,source_url FROM companies ORDER BY registration_id").all();
  assert.deepEqual(co.map((c) => [c.country_code, c.registration_id, c.registration_id_type]), [["CL", "76123456-0", "RUT"], ["CL", "78111222-4", "RUT"]]);
  assert.ok(co.every((c) => /sag\.gob\.cl/.test(c.source_url)), "endereço da fonte");
  // Fonte de outro país numa busca do Chile não roda; e a LENAA não roda numa busca de outro país.
  assert.equal((await api(`/api/foreign-searches/${fs.id}/discover`, "POST", { source: "fr_registry", role: "processor" })).status, 422);
  void env;
});
