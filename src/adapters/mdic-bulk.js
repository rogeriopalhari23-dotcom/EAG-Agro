// Arquivo completo do MDIC (EXP_<ano>.csv) lido em pedaços por Range (P3-T3; T6 §7; errata do Plano 3 itens 1–3).
// Cada linha pertence ao pedaço em que COMEÇA: pede-se também o byte anterior ao início e a linha em curso
// só é descartada quando esse byte não encerra uma linha. A versão do arquivo (tamanho, ETag, Last-Modified)
// é conferida em cada pedaço; se mudar, a tentativa inteira do ano é refeita (nunca mistura publicações).
import { AdapterError } from "./errors.js";

export const HEADER = '"CO_ANO";"CO_MES";"CO_NCM";"CO_UNID";"CO_PAIS";"SG_UF_NCM";"CO_VIA";"CO_URF";"QT_ESTAT";"KG_LIQUIDO";"VL_FOB"';
export const CHUNK_BYTES = 8 * 1024 * 1024;
export const MARGIN_BYTES = 64 * 1024;
const TIMEOUT_MS = 60000;
const LF = 10;
const SOURCE = "MDIC";

const yearUrl = (base, year) => `${base}/comexstat-bd/ncm/EXP_${year}.csv`;

async function call(url, init, fetchImpl) {
  let r;
  try {
    r = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new AdapterError("temporary", `${SOURCE}: sem resposta (${e?.name === "TimeoutError" ? "tempo esgotado" : "falha de rede"}).`);
  }
  if (r.status >= 500 || r.status === 429) throw new AdapterError("temporary", `${SOURCE}: erro do servidor (${r.status}).`);
  // Página de desafio anti-robô chega como HTML: é erro temporário, nunca conteúdo.
  if ((r.headers.get("content-type") || "").includes("text/html")) throw new AdapterError("temporary", `${SOURCE}: resposta HTML (${r.status}).`, { nonCsv: true });
  return r;
}

// Conexão cortada no meio do corpo ("terminated", observado na leitura real da NCM.csv) é temporária.
async function body(r) {
  try {
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    throw new AdapterError("temporary", `${SOURCE}: conexão interrompida durante a leitura.`);
  }
}

const validatorsOf = (r) => ({ etag: r.headers.get("etag") || null, lastModified: r.headers.get("last-modified") || null });

// HEAD do ano: { size, etag, lastModified } ou null quando o ano ainda não foi publicado (404).
export async function headYear(base, year, fetchImpl = fetch) {
  const r = await call(yearUrl(base, year), { method: "HEAD" }, fetchImpl);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new AdapterError("invalid_request", `${SOURCE}: HEAD recusado (${r.status}).`);
  const size = Number(r.headers.get("content-length"));
  if (!Number.isSafeInteger(size) || size <= HEADER.length) throw new AdapterError("schema", `${SOURCE}: tamanho do arquivo ausente.`);
  return { size, ...validatorsOf(r) };
}

export function chunkRanges(size, chunkBytes = CHUNK_BYTES) {
  const out = [];
  for (let n = 0, start = 0; start < size; n++, start += chunkBytes) out.push({ n, start, end: Math.min(start + chunkBytes, size) - 1 });
  return out;
}

// Linhas cujo início está em [start, end], a partir dos bytes lidos em [from, …].
// Exportada para teste direto da regra de fronteira.
export function linesOf(bytes, from, start, end, atFileEnd) {
  const lines = [];
  let i = start - from; // índice do primeiro byte do pedaço
  if (start > 0) {
    // Byte anterior encerra linha → a linha começa exatamente em `start`. Senão, pula a linha em curso.
    if (bytes[i - 1] !== LF) {
      const lf = bytes.indexOf(LF, i);
      if (lf < 0) {
        if (atFileEnd) return lines;
        throw new AdapterError("schema", `${SOURCE}: linha maior que a margem de leitura.`, { code: "line_too_long" });
      }
      i = lf + 1;
    }
  }
  const dec = new TextDecoder("windows-1252");
  while (i <= end - from && i < bytes.length) {
    const lf = bytes.indexOf(LF, i);
    if (lf < 0 && !atFileEnd) throw new AdapterError("schema", `${SOURCE}: linha maior que a margem de leitura.`, { code: "line_too_long" });
    const stop = lf < 0 ? bytes.length : lf;
    let line = dec.decode(bytes.subarray(i, stop));
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (line) lines.push(line);
    if (lf < 0) break;
    i = lf + 1;
  }
  return lines;
}

const unq = (v) => v.replace(/^"|"$/g, "");
function metric(v) {
  if (v === "") return null;
  const x = Number(v);
  if (!Number.isFinite(x)) throw new AdapterError("schema", `${SOURCE}: métrica inválida.`, { code: "layout_changed" });
  return x;
}

// Agrega as linhas agrícolas: chave CO_PAIS|CO_NCM|AAAA-MM → [fob, kg, qt|null].
export function aggregate(lines, agriChapters, isFirst) {
  const chapters = new Set(agriChapters);
  const rows = {};
  let kept = 0;
  let k = 0;
  if (isFirst) {
    if (lines[0] !== HEADER) throw new AdapterError("schema", `${SOURCE}: cabeçalho diferente do conferido.`, { code: "layout_changed" });
    k = 1;
  }
  for (; k < lines.length; k++) {
    const f = lines[k].split(";");
    if (f.length !== 11) throw new AdapterError("schema", `${SOURCE}: linha com ${f.length} colunas.`, { code: "layout_changed" });
    const ncm = unq(f[2]);
    if (!/^\d{8}$/.test(ncm)) throw new AdapterError("schema", `${SOURCE}: NCM inválida.`, { code: "layout_changed" });
    if (!chapters.has(ncm.slice(0, 2))) continue;
    const key = `${unq(f[4])}|${ncm}|${unq(f[0])}-${unq(f[1])}`;
    const fob = metric(f[10]), kg = metric(f[9]), qt = metric(f[8]);
    const cur = rows[key] || (rows[key] = [0, 0, null]);
    cur[0] += fob ?? 0;
    cur[1] += kg ?? 0;
    if (qt !== null) cur[2] = (cur[2] ?? 0) + qt;
    kept++;
  }
  return { rows, lines: lines.length - (isFirst ? 1 : 0), kept };
}

// Um pedaço do ano. `version` = { size, etag, lastModified } registrada no início da versão da lista.
export async function processChunk(base, { year, n, start, end, version, agriChapters, margin = MARGIN_BYTES }, fetchImpl = fetch) {
  const from = start > 0 ? start - 1 : 0;
  const to = Math.min(end + margin, version.size - 1);
  const r = await call(yearUrl(base, year), { headers: { Range: `bytes=${from}-${to}` } }, fetchImpl);
  if (r.status === 200) throw new AdapterError("schema", `${SOURCE}: servidor ignorou Range.`, { code: "range_unsupported" });
  if (r.status === 412 || r.status === 416) throw new AdapterError("schema", `${SOURCE}: arquivo mudou durante a leitura.`, { code: "source_changed" });
  if (r.status !== 206) throw new AdapterError("invalid_request", `${SOURCE}: pedaço recusado (${r.status}).`);
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(r.headers.get("content-range") || "");
  const now = validatorsOf(r);
  if (!m || Number(m[3]) !== version.size || (version.etag && now.etag && now.etag !== version.etag) || (version.lastModified && now.lastModified && now.lastModified !== version.lastModified))
    throw new AdapterError("schema", `${SOURCE}: arquivo mudou durante a leitura.`, { code: "source_changed" });
  if (Number(m[1]) !== from || Number(m[2]) !== to) throw new AdapterError("schema", `${SOURCE}: intervalo diferente do pedido.`, { code: "range_unsupported" });
  const bytes = await body(r);
  if (bytes.length !== to - from + 1) throw new AdapterError("temporary", `${SOURCE}: pedaço incompleto.`);
  const lines = linesOf(bytes, from, start, end, to === version.size - 1);
  return aggregate(lines, agriChapters, n === 0);
}

// Tabela NCM (windows-1252): só capítulos agrícolas → { ncm: { sh6, unit, namePt, nameEn } }.
export async function loadNcmTable(base, agriChapters, fetchImpl = fetch) {
  const r = await call(`${base}/tabelas/NCM.csv`, {}, fetchImpl);
  if (r.status !== 200) throw new AdapterError("invalid_request", `${SOURCE}: tabela NCM recusada (${r.status}).`);
  const text = new TextDecoder("windows-1252").decode(await body(r));
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(";").map(unq);
  const col = (name) => {
    const i = head.indexOf(name);
    if (i < 0) throw new AdapterError("schema", `${SOURCE}: tabela NCM sem ${name}.`, { code: "layout_changed" });
    return i;
  };
  const [cNcm, cUnit, cSh6, cPt, cEn] = ["CO_NCM", "CO_UNID", "CO_SH6", "NO_NCM_POR", "NO_NCM_ING"].map(col);
  const chapters = new Set(agriChapters);
  const out = {};
  for (const l of lines) {
    const f = l.split(";").map(unq);
    if (!chapters.has(f[cNcm]?.slice(0, 2))) continue;
    out[f[cNcm]] = { sh6: f[cSh6], unit: f[cUnit], namePt: f[cPt], nameEn: f[cEn] };
  }
  return out;
}
