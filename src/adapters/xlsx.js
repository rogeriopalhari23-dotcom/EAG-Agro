// Leitor mínimo de planilha .xlsx (zip + XML), sem dependência: lê a primeira aba como linhas de texto. Usado para
// listas oficiais publicadas em Excel (ex.: LENAA do SAG). Só leitura; fórmulas e estilos são ignorados.
import { AdapterError } from "./errors.js";

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(out);
}

// Arquivos do zip pelo diretório central → Map(nome → função que devolve o conteúdo em texto).
function zipEntries(b) {
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new AdapterError("schema", "Planilha: arquivo não é um .xlsx (zip) válido.");
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const out = new Map();
  for (let k = 0; k < count; k++) {
    if (u32(b, p) !== 0x02014b50) throw new AdapterError("schema", "Planilha: diretório do zip inválido.");
    const method = u16(b, p + 10), size = u32(b, p + 20), nameLen = u16(b, p + 28), extra = u16(b, p + 30), comment = u16(b, p + 32), local = u32(b, p + 42);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    out.set(name, async () => {
      const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
      const data = b.subarray(start, start + size);
      const raw = method === 0 ? data : method === 8 ? await inflateRaw(data) : null;
      if (!raw) throw new AdapterError("schema", `Planilha: compressão ${method} não suportada.`);
      return new TextDecoder().decode(raw);
    });
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

const unxml = (s) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
const colIndex = (ref) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// → [[célula, ...], ...] da primeira aba (linhas na ordem do arquivo).
export async function readXlsx(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const files = zipEntries(b);
  const shared = files.has("xl/sharedStrings.xml") ? [...(await files.get("xl/sharedStrings.xml")()).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unxml(m[1]).trim()) : [];
  const sheetName = [...files.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  if (!sheetName) throw new AdapterError("schema", "Planilha: nenhuma aba encontrada.");
  const xml = await files.get(sheetName)();
  const rows = [];
  for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], body = c[2] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const t = /t="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const text = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? unxml(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? "") : v != null ? unxml(v) : "";
      row[ref ? colIndex(ref) : row.length] = String(text).trim();
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return rows;
}
