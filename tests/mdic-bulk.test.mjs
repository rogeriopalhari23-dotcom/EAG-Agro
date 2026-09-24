import test from "node:test";
import assert from "node:assert/strict";
import { HEADER, chunkRanges, headYear, processChunk, aggregate, linesOf, loadNcmTable } from "../src/adapters/mdic-bulk.js";

const BASE = "https://mdic.exemplo/bd";
const AGRI = ["01", "02", "04", "09", "12", "17", "23"];
// Linha copiada em T6 §7 e variações sintéticas (inclui capítulo 28, que não é agrícola, e QT_ESTAT vazio).
const ROWS = [
  '"2026";"01";"02023000";"10";"589";"MT";"07";"0230154";22356;22356;89125',
  '"2026";"01";"09011110";"10";"023";"MG";"01";"0817800";19200;19200;101000',
  '"2026";"01";"09011110";"10";"025";"MG";"01";"0817800";100;100;500',
  '"2026";"02";"17011400";"10";"249";"SP";"01";"0817600";50000;50000;21000',
  '"2026";"02";"28353910";"10";"249";"SP";"01";"0817600";10;10;99',
  '"2026";"02";"12019000";"10";"156";"PR";"01";"0917500";;700000;280000',
  '"2026";"03";"23040010";"10";"528";"RS";"01";"1017700";900;900;450',
  '"2026";"03";"09011110";"10";"023";"ES";"01";"0727600";300;300;1600',
];

function file({ crlf = false, finalNewline = true, rows = ROWS } = {}) {
  const nl = crlf ? "\r\n" : "\n";
  return new TextEncoder().encode([HEADER, ...rows].join(nl) + (finalNewline ? nl : ""));
}

function server(bytes, { etag = '"v1"', lastModified = "Fri, 04 Sep 2026 18:05:56 GMT", ignoreRange = false, mutate } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const h = { etag: mutate?.etag ?? etag, "last-modified": lastModified, "content-type": "text/csv" };
    if (init.method === "HEAD") return new Response(null, { status: 200, headers: { ...h, "content-length": String(bytes.length) } });
    const m = /bytes=(\d+)-(\d+)/.exec(init.headers?.Range || "");
    if (!m || ignoreRange) return new Response(bytes, { status: 200, headers: h });
    const [a, b] = [Number(m[1]), Math.min(Number(m[2]), bytes.length - 1)];
    return new Response(bytes.slice(a, b + 1), { status: 206, headers: { ...h, "content-range": `bytes ${a}-${b}/${bytes.length}` } });
  };
  return { fetchImpl, calls };
}

function merge(parts) {
  const out = {};
  for (const p of parts)
    for (const [k, [fob, kg, qt]] of Object.entries(p.rows)) {
      const c = out[k] || (out[k] = [0, 0, null]);
      c[0] += fob;
      c[1] += kg;
      if (qt !== null) c[2] = (c[2] ?? 0) + qt;
    }
  return out;
}

async function readAll(bytes, chunkBytes, srv = server(bytes)) {
  const version = await headYear(BASE, 2026, srv.fetchImpl);
  const parts = [];
  for (const r of chunkRanges(version.size, chunkBytes)) parts.push(await processChunk(BASE, { year: 2026, ...r, version, agriChapters: AGRI }, srv.fetchImpl));
  return { rows: merge(parts), lines: parts.reduce((s, p) => s + p.lines, 0) };
}

test("P3-T3: linha na fronteira contada uma vez para qualquer tamanho de pedaço (LF, CRLF, sem LF final)", async () => {
  for (const variant of [{}, { crlf: true }, { finalNewline: false }, { crlf: true, finalNewline: false }]) {
    const bytes = file(variant);
    const whole = aggregate(new TextDecoder().decode(bytes).split(/\r?\n/).filter(Boolean), AGRI, true).rows;
    for (let size = 1; size <= bytes.length; size += size < 40 ? 1 : 7) {
      const got = await readAll(bytes, size);
      assert.deepEqual(got.rows, whole, `${JSON.stringify(variant)} pedaço ${size}`);
      assert.equal(got.lines, ROWS.length, `${JSON.stringify(variant)} pedaço ${size}: linhas`);
    }
  }
});

test("P3-T3: fronteira logo após LF começa a linha no pedaço seguinte (regra do byte anterior)", () => {
  const bytes = new TextEncoder().encode("aaa\nbbb\nccc\n");
  // Pedaço [4, 7] começa exatamente em "bbb": o byte anterior (índice 3) é LF.
  assert.deepEqual(linesOf(bytes.slice(3), 3, 4, 7, true), ["bbb"]);
  // Pedaço [5, 7] começa no meio de "bbb": a linha pertence ao pedaço anterior.
  assert.deepEqual(linesOf(bytes.slice(4), 4, 5, 7, true), []);
  // Pedaço [0, 3] contém "aaa" inteira e nada mais.
  assert.deepEqual(linesOf(bytes, 0, 0, 3, true), ["aaa"]);
});

test("P3-T3: só capítulos agrícolas por prefixo de texto; métricas somadas; QT vazio fica nulo", () => {
  const { rows, kept } = aggregate([HEADER, ...ROWS], AGRI, true);
  assert.equal(kept, ROWS.length - 1);
  assert.ok(!Object.keys(rows).some((k) => k.includes("28353910")));
  assert.deepEqual(rows["156|12019000|2026-02"], [280000, 700000, null]);
  assert.deepEqual(rows["023|09011110|2026-01"], [101000, 19200, 19200]);
});

test("P3-T3: cabeçalho com coluna a mais para tudo (layout_changed)", async () => {
  const bytes = new TextEncoder().encode(HEADER + ';"NOVA"\n' + ROWS[0] + "\n");
  await assert.rejects(readAll(bytes, 1 << 20), (e) => e.details.code === "layout_changed");
});

test("P3-T3: servidor sem Range é erro; o arquivo nunca é lido inteiro", async () => {
  const bytes = file();
  await assert.rejects(readAll(bytes, 64, server(bytes, { ignoreRange: true })), (e) => e.details.code === "range_unsupported");
});

test("P3-T3: arquivo republicado durante a leitura → source_changed (não mistura versões)", async () => {
  const bytes = file();
  const srv = server(bytes);
  const version = await headYear(BASE, 2026, srv.fetchImpl);
  const changed = server(bytes, { mutate: { etag: '"v2"' } });
  await assert.rejects(processChunk(BASE, { year: 2026, n: 1, start: 64, end: 127, version, agriChapters: AGRI }, changed.fetchImpl), (e) => e.details.code === "source_changed");
  const bigger = { ...version, size: version.size + 1 };
  await assert.rejects(processChunk(BASE, { year: 2026, n: 0, start: 0, end: 63, version: bigger, agriChapters: AGRI }, srv.fetchImpl), (e) => e.details.code === "source_changed");
});

test("P3-T3: linha maior que a margem é erro explícito, nunca truncamento", async () => {
  const long = '"2026";"01";"09011110";"10";"023";"MG";"01";"' + "9".repeat(300) + '";1;1;1';
  const bytes = new TextEncoder().encode([HEADER, ROWS[0], long, ROWS[1]].join("\n") + "\n");
  const srv = server(bytes);
  const version = await headYear(BASE, 2026, srv.fetchImpl);
  const start = bytes.indexOf(10, HEADER.length + ROWS[0].length + 1) - 200; // meio da linha longa
  await assert.rejects(
    processChunk(BASE, { year: 2026, n: 1, start, end: start + 10, version, agriChapters: AGRI, margin: 16 }, srv.fetchImpl),
    (e) => e.details.code === "line_too_long",
  );
});

test("P3-T3: ano não publicado (404) e página HTML de desafio", async () => {
  assert.equal(await headYear(BASE, 2027, async () => new Response(null, { status: 404 })), null);
  await assert.rejects(headYear(BASE, 2026, async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })), (e) => e.kind === "temporary");
});

test("P3-T3: tabela NCM em windows-1252 só com capítulos agrícolas", async () => {
  const csv = '"CO_NCM";"CO_UNID";"CO_SH6";"CO_PPE";"CO_PPI";"CO_FAT_AGREG";"CO_CUCI_ITEM";"CO_CGCE_N3";"CO_SIIT";"CO_ISIC_CLASSE";"CO_EXP_SUBSET";"NO_NCM_POR";"NO_NCM_ESP";"NO_NCM_ING"\n"09011110";"10";"090111";"";"";"";"";"";"";"";"";"Café não torrado, em grão";"Café";"Coffee, not roasted"\n"28353910";"10";"283539";"";"";"";"";"";"";"";"";"Outros";"Otros";"Other"\n';
  const bytes = Uint8Array.from([...csv].map((c) => ({ "ã": 0xe3, "é": 0xe9 })[c] ?? c.charCodeAt(0)));
  const t = await loadNcmTable(BASE, AGRI, async () => new Response(bytes, { status: 200, headers: { "content-type": "text/csv" } }));
  assert.deepEqual(Object.keys(t), ["09011110"]);
  assert.equal(t["09011110"].namePt, "Café não torrado, em grão");
  assert.equal(t["09011110"].sh6, "090111");
});
