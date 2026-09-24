import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { setup } from "./helpers/db.mjs";
import { parseCsv, parseOfac, parseCgu, decodeLatin, batches } from "../src/sanctions-parsers.js";
import { importList, unzipSingle, sha256 } from "../scripts/import-sanctions.mjs";

// Linhas no formato dos arquivos reais conferidos em 2026-09-24 (conteúdo sintético).
const SDN = [
  '306,"BANCO EXEMPLO DE CUBA",-0- ,"CUBA",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"a.k.a. \'BEC\'."',
  '7001,"SILVA, Joao",individual,"SDGT",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"DOB 01 Jan 1970."',
  '7002,"NAVIO EXEMPLO",vessel,"IRAN",-0- ,"9ABC",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
  '7003,"ACME TRADING, LLC",-0- ,"SDGT] [IRGC",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"Line one',
  'line two with ""quotes""."',
].join("\r\n") + "\r\n\x1a";
const ALT = ['306,220,"aka","NATIONAL EXAMPLE BANK",-0- ', '7003,221,"fka","ACME COMMODITIES",-0- '].join("\r\n") + "\r\n";
const CGU_HEAD =
  '"CADASTRO";"CÓDIGO DA SANÇÃO";"TIPO DE PESSOA";"CPF OU CNPJ DO SANCIONADO";"NOME DO SANCIONADO";"NOME INFORMADO PELO ÓRGÃO SANCIONADOR";"RAZÃO SOCIAL - CADASTRO RECEITA";"NOME FANTASIA - CADASTRO RECEITA";"NÚMERO DO PROCESSO";"CATEGORIA DA SANÇÃO";"DATA INÍCIO SANÇÃO";"DATA FINAL SANÇÃO";"DATA PUBLICAÇÃO";"PUBLICAÇÃO";"DETALHAMENTO DO MEIO DE PUBLICAÇÃO";"DATA DO TRÂNSITO EM JULGADO";"ABRAGÊNCIA DA SANÇÃO";"ÓRGÃO SANCIONADOR";"UF ÓRGÃO SANCIONADOR";"ESFERA ÓRGÃO SANCIONADOR";"FUNDAMENTAÇÃO LEGAL";"DATA ORIGEM INFORMAÇÃO";"ORIGEM INFORMAÇÕES";"OBSERVAÇÕES"';
const cgu = (list, kind, doc, name, razao = "") =>
  `"${list}";"1";"${kind}";"${doc}";"${name}";"${name}";"${razao}";"";"123";"Impedimento";"01/01/2026";"01/01/2030";"";"DOU";"";"";"Todas";"Órgão Exemplo";"SP";"FEDERAL";"LEI 8666; ART. 87";"01/01/2026";"Órgão Exemplo";""`;
const latin = (s) => Uint8Array.from([...s].map((c) => (c.charCodeAt(0) < 256 ? c.charCodeAt(0) : 63)));
const CEIS = [CGU_HEAD, cgu("CEIS", "J", "11.222.333/0001-81", "DOCES VALE VERDE", "DOCES VALE VERDE LTDA"), cgu("CEIS", "F", "12345678909", "FULANO DE TAL"), cgu("CNEP", "J", "99888777000166", "OUTRA LISTA SA")].join("\r\n") + "\r\n";

test("P2-T16: CSV com aspas, aspas dobradas, quebra de linha, CRLF e marca de fim de arquivo", () => {
  const rows = parseCsv(SDN, ",");
  assert.equal(rows.length, 4);
  assert.equal(rows[3][11], 'Line one\r\nline two with "quotes".');
  assert.equal(rows[0][1], "BANCO EXEMPLO DE CUBA");
  assert.throws(() => parseCsv('1,"aberto', ","), /aspas não fechadas/);
});

test("P2-T16: OFAC — aliases do ALT, pessoas físicas fora, número da OFAC nunca vira identificador de empresa", () => {
  const r = parseOfac(SDN, ALT);
  assert.equal(r.total, 4);
  assert.deepEqual(r.skipped, { individuals: 1 });
  assert.deepEqual(r.entries.map((e) => [e.primaryName, e.entityType]), [["BANCO EXEMPLO DE CUBA", "entity"], ["NAVIO EXEMPLO", "vessel"], ["ACME TRADING, LLC", "entity"]]);
  assert.deepEqual(r.entries[0].aliases, ["NATIONAL EXAMPLE BANK"]);
  assert.ok(r.entries.every((e) => e.officialEntityId === undefined && e.raw.entNum));
  assert.equal(parseOfac(SDN, ALT, { includeIndividuals: true }).entries.length, 4);
  assert.throws(() => parseOfac('1,"X",-0- ,"P"\r\n', ""), /layout mudou/);
});

test("P2-T16: CGU — windows-1252, CNPJ como identificador BR, pessoa física e outra lista fora, cabeçalho conferido", () => {
  const r = parseCgu(decodeLatin(latin(CEIS)), "CEIS");
  assert.equal(r.total, 3);
  assert.deepEqual(r.skipped, { individuals: 1, otherList: 1 });
  assert.equal(r.entries.length, 1);
  assert.deepEqual([r.entries[0].officialEntityId, r.entries[0].countryCode, r.entries[0].aliases], ["11222333000181", "BR", ["DOCES VALE VERDE LTDA"]]);
  assert.equal(r.entries[0].raw.authority, "Órgão Exemplo");
  assert.throws(() => parseCgu('"CADASTRO";"NOME"\r\n"CEIS";"X"\r\n', "CEIS"), /layout mudou/);
});

test("P2-T16: lotes respeitam 300 registros e o limite de bytes da API", () => {
  const many = Array.from({ length: 650 }, (_, i) => ({ primaryName: `EMPRESA ${i}` }));
  assert.deepEqual(batches(many).map((b) => b.length), [300, 300, 50]);
  const big = Array.from({ length: 10 }, (_, i) => ({ primaryName: `E${i}`, raw: { x: "y".repeat(9000) } }));
  assert.ok(batches(big).every((b) => new TextEncoder().encode(JSON.stringify({ entries: b })).length < 64 * 1024));
});

test("P2-T16: ZIP do Portal da Transparência com um CSV é lido; ZIP truncado é recusado", () => {
  const data = Buffer.from(CEIS, "latin1");
  const comp = deflateRawSync(data);
  const name = Buffer.from("20260923_CEIS.csv");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(comp.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt32LE(0, 42);
  const cdOffset = local.length + name.length + comp.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length + name.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  const zip = Buffer.concat([local, name, comp, cd, name, eocd]);
  assert.equal(unzipSingle(zip).toString("latin1"), CEIS);
  assert.throws(() => unzipSingle(Buffer.concat([local, name, comp.subarray(0, 10), cd, name, eocd])));
});

test("P2-T16: importação pela API → triagem bloqueia por CNPJ exato e manda nome da OFAC para revisão", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api } = ctx;
  await api("/api/parameters/sanctions_max_age_hours", "PUT", { scope: "global", value: 24, reason: "Teste" });
  const at = new Date().toISOString();
  const ofac = parseOfac(SDN, ALT);
  const ceis = parseCgu(decodeLatin(latin(CEIS)), "CEIS");
  const cnep = parseCgu(decodeLatin(latin(CEIS.replace(/"CEIS";"1";"J"/, '"CNEP";"1";"J"'))), "CNEP");
  for (const [list, r] of [["ofac", ofac], ["ceis", ceis], ["cnep", cnep]]) {
    const out = await importList(api, { list, entries: r.entries, contentHash: sha256(Buffer.from(list)), sourceVersion: "teste", downloadedAt: at });
    assert.equal(out.records, r.entries.length, list);
  }
  const vale = await api("/api/companies", "POST", { legalName: "Doces Vale Verde Ltda.", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  const s1 = await api(`/api/companies/${vale.data.id}/screening`, "POST", {});
  assert.equal(s1.status, 201, JSON.stringify(s1.data));
  assert.equal(s1.data.block, 2, "CEIS e CNEP pelo CNPJ exato");
  const acme = await api("/api/companies", "POST", { legalName: "ACME Commodities", countryCode: "US", sourceLabel: "teste" });
  const s2 = await api(`/api/companies/${acme.data.id}/screening`, "POST", {});
  assert.equal(s2.data.block ?? 0, 0);
  assert.equal(s2.data.review, 1);
});

test("P2-T16: contagem declarada diferente da importada → versão falha (lista parcial nunca vale)", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const r = parseOfac(SDN, ALT);
  const api = async (path, method, body) => ctx.api(path, method, path.endsWith("/versions") ? { ...body, recordCount: body.recordCount + 1 } : body);
  await assert.rejects(importList(api, { list: "ofac", entries: r.entries, contentHash: sha256(Buffer.from("x")), sourceVersion: "t", downloadedAt: new Date().toISOString() }), /import_incomplete/);
  assert.equal(ctx.DB.raw.prepare("SELECT import_status FROM sanction_list_versions").get().import_status, "failed");
});
