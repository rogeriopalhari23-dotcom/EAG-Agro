// UN Comtrade — importações declaradas pelo país (P3-T4; T6 §8; errata do Plano 3 itens 6, 7 e 11).
// Hipóteses a confirmar com a chave real na T12 (registradas em EVIDENCIAS): `period` e `partnerCode` com lista,
// filtros de total `partner2Code=0`, `customsCode=C00`, `motCode=0`, e o formato de `getDA`.
// A chave vai no cabeçalho do gateway (Ocp-Apim-Subscription-Key), nunca na URL; `redact` protege qualquer URL registrada.
import { AdapterError } from "./errors.js";

const SOURCE = "Comtrade";
const TIMEOUT_MS = 60000;
export const RECORD_LIMIT = 100000; // "max 100K records per call" (plano gratuito, T6 §8)
export const BRAZIL = 76;
export const WORLD = 0;

export const redact = (url) => String(url).replace(/([?&])subscription-key=[^&]*/gi, "$1subscription-key=***");

async function getJson(url, headers, fetchImpl) {
  let r;
  try {
    r = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new AdapterError("temporary", `${SOURCE}: sem resposta (${e?.name === "TimeoutError" ? "tempo esgotado" : "falha de rede"}).`);
  }
  if (r.status === 401 || r.status === 403) throw new AdapterError("auth", `${SOURCE}: chave recusada (${r.status}).`);
  if (r.status === 429) throw new AdapterError("temporary", `${SOURCE}: limite de chamadas (429).`, { rateLimited: true, retryAfter: Number(r.headers.get("retry-after")) || null });
  if (r.status >= 500) throw new AdapterError("temporary", `${SOURCE}: erro do provedor (${r.status}).`);
  if (r.status !== 200) throw new AdapterError("invalid_request", `${SOURCE}: requisição recusada (${r.status}).`);
  let text;
  try {
    text = await r.text();
  } catch {
    throw new AdapterError("temporary", `${SOURCE}: conexão interrompida.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    // Corpo bruto da falha nunca é registrado (errata item 11).
    throw new AdapterError("temporary", `${SOURCE}: resposta não é JSON.`);
  }
}

// Subposições SH6 agrícolas da tabela de referência, divididas em blocos de tamanho parecido, em ordem.
export async function loadHsBlocks(base, agriChapters, fetchImpl = fetch, blockCount = 3) {
  const d = await getJson(`${base}/files/v1/app/reference/HS.json`, {}, fetchImpl);
  if (!Array.isArray(d?.results)) throw new AdapterError("schema", `${SOURCE}: HS.json sem results.`);
  const chapters = new Set(agriChapters);
  const codes = [...new Set(d.results.filter((x) => Number(x.aggrLevel) === 6 && /^\d{6}$/.test(String(x.id)) && chapters.has(String(x.id).slice(0, 2))).map((x) => String(x.id)))].sort();
  if (!codes.length) throw new AdapterError("schema", `${SOURCE}: nenhuma subposição agrícola em HS.json.`);
  const size = Math.ceil(codes.length / blockCount);
  const blocks = [];
  for (let i = 0; i < codes.length; i += size) blocks.push(codes.slice(i, i + size));
  const names = Object.fromEntries(d.results.filter((x) => codes.includes(String(x.id))).map((x) => [String(x.id), String(x.text || "").replace(/^\d{6}\s*-\s*/, "")]));
  return { codes, blocks, names };
}

// Anos anuais disponíveis para o país declarante. Lista vazia = país sem declaração (não gasta chamada de dados).
export async function availableYears(base, comtradeCode, fetchImpl = fetch) {
  const d = await getJson(`${base}/public/v1/getDA/C/A/HS?reporterCode=${Number(comtradeCode)}`, {}, fetchImpl);
  if (!Array.isArray(d?.data)) throw new AdapterError("schema", `${SOURCE}: getDA sem data.`);
  const years = new Set();
  for (const x of d.data) {
    if (Number(x.reporterCode) !== Number(comtradeCode)) throw new AdapterError("schema", `${SOURCE}: getDA de outro país.`, { code: "filter_not_applied" });
    const y = String(x.period ?? x.refYear ?? "");
    if (!/^\d{4}$/.test(y)) throw new AdapterError("schema", `${SOURCE}: período anual inválido em getDA.`);
    years.add(Number(y));
  }
  return [...years].sort((a, b) => a - b);
}

const TOTAL = { partner2Code: 0, customsCode: "C00", motCode: 0 };
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

// Importações do país (todas as origens e Brasil) para os anos e o bloco de SH6 pedidos.
export async function fetchImports(base, key, { comtradeCode, years, hs6Block }, fetchImpl = fetch) {
  if (!key) throw new AdapterError("auth", `${SOURCE}: chave não configurada.`, { code: "no_key" });
  const q = new URLSearchParams({
    reporterCode: String(comtradeCode), period: years.join(","), partnerCode: `${WORLD},${BRAZIL}`, flowCode: "M",
    cmdCode: hs6Block.join(","), partner2Code: "0", customsCode: "C00", motCode: "0", includeDesc: "false",
  });
  const d = await getJson(`${base}/data/v1/get/C/A/HS?${q}`, { "Ocp-Apim-Subscription-Key": key }, fetchImpl);
  if (d?.error) throw new AdapterError("invalid_request", `${SOURCE}: a API recusou a consulta.`);
  if (!Array.isArray(d?.data) || typeof d.count !== "number") throw new AdapterError("schema", `${SOURCE}: resposta sem data/count.`);
  // count no limite = suspeita de corte; count diferente das linhas = resposta incompleta (errata item 7).
  if (d.count >= RECORD_LIMIT || d.data.length >= RECORD_LIMIT) throw new AdapterError("schema", `${SOURCE}: resposta no limite de registros.`, { code: "truncated" });
  if (d.count !== d.data.length) throw new AdapterError("incomplete", `${SOURCE}: count ${d.count} diferente de ${d.data.length} linhas.`);
  const yearSet = new Set(years.map(Number)), block = new Set(hs6Block), seen = new Set();
  const lines = [];
  for (const x of d.data) {
    const okFilter =
      Number(x.reporterCode) === Number(comtradeCode) && x.flowCode === "M" && [WORLD, BRAZIL].includes(Number(x.partnerCode)) &&
      yearSet.has(Number(x.refYear)) && block.has(String(x.cmdCode)) &&
      Object.entries(TOTAL).every(([k, v]) => x[k] === undefined || x[k] === null || String(x[k]) === String(v));
    if (!okFilter) throw new AdapterError("schema", `${SOURCE}: linha fora do filtro pedido.`, { code: "filter_not_applied" });
    const origin = Number(x.partnerCode) === BRAZIL ? "brazil" : "world";
    const k = `${x.cmdCode}|${x.refYear}|${origin}`;
    // Duas linhas para a mesma chave = desdobramento não previsto; nunca somar às cegas.
    if (seen.has(k)) throw new AdapterError("schema", `${SOURCE}: mais de uma linha para ${k}.`, { code: "ambiguous_totals" });
    seen.add(k);
    const cif = num(x.cifvalue);
    lines.push({
      hs6: String(x.cmdCode), year: Number(x.refYear), origin,
      valueUsd: cif ?? num(x.primaryValue), basis: cif !== null ? "CIF" : "primary",
      // Zero declarado é preservado; ausência fica nula com o indicador da fonte (errata item 7).
      netKg: num(x.netWgt), netKgEstimated: x.isNetWgtEstimated ?? null,
      qty: num(x.qty), qtyUnitCode: x.qtyUnitCode ?? null, qtyEstimated: x.isQtyEstimated ?? null,
    });
  }
  return lines;
}
