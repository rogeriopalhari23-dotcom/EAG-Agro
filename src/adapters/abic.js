// ABIC — produtos certificados (Selo de Pureza, Qualidade, Sustentabilidade), lista pública da página de certificações.
// A página traz, em dados públicos embutidos, cada produto certificado com o industrializador (torrefadora) e o estado da
// fábrica; "atualizada diariamente" segundo a própria página. robots.txt permite (conferido em 2026-10-20).
// Uso: torrefadora industrial é compradora de café verde (perfil: fabricante/processador). A lista NÃO traz CNPJ nem
// município: cada industrializador entra como candidata provisória, com o estado, até a conciliação.
import { AdapterError } from "./errors.js";

export const ABIC_URL = "https://www.abic.com.br/certificacoes/";
const UA = "eag-compass-prospeccao/1.0 (uso pessoal, baixo volume; respeita robots.txt)";

// html → [{ name, uf, products: [nome], certifications: [..] }]
export function parseAbic(html) {
  const m = /produtos\s*:\s*(\[[\s\S]*?\])\s*[,}]/.exec(String(html));
  if (!m) throw new AdapterError("schema", "ABIC: lista de produtos certificados não encontrada na página (formato mudou).");
  let arr;
  try {
    arr = JSON.parse(m[1]);
  } catch {
    throw new AdapterError("schema", "ABIC: lista de produtos certificados em formato inesperado.");
  }
  if (!Array.isArray(arr) || (arr.length && !("no_torrefador" in arr[0] && "co_sigla_estado_fabrica" in arr[0])))
    throw new AdapterError("schema", "ABIC: campos esperados ausentes (no_torrefador, co_sigla_estado_fabrica).");
  const by = new Map();
  for (const p of arr) {
    const name = String(p.no_torrefador ?? "").trim(), uf = String(p.co_sigla_estado_fabrica ?? "").trim().toUpperCase();
    if (!name || !/^[A-Z]{2}$/.test(uf)) continue;
    const k = `${name}|${uf}`;
    const cur = by.get(k) ?? { name, uf, products: [], certifications: new Set() };
    if (p.no_produto) cur.products.push(String(p.no_produto));
    if (p.no_certificacao) cur.certifications.add(String(p.no_certificacao));
    by.set(k, cur);
  }
  return [...by.values()].map((x) => ({ ...x, certifications: [...x.certifications] }));
}

export async function fetchAbicRoasters(fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(ABIC_URL, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout?.(30_000) });
  } catch {
    throw new AdapterError("temporary", "ABIC: sem resposta.");
  }
  if (res.status === 429 || res.status >= 500) throw new AdapterError("temporary", `ABIC: indisponível (HTTP ${res.status}).`);
  if (!res.ok) throw new AdapterError("unavailable", `ABIC: HTTP ${res.status}.`);
  return parseAbic(await res.text());
}
