// Resumo curto por país e fonte para a lista de países importadores (Radar Internacional).
// Puro e determinístico: lê só o objeto da lista mensal já publicado (MDIC ou Comtrade) — nenhuma chamada externa.
// Mesmas regras da análise (src/country-analysis.js): MDIC na janela de N meses que termina no último mês do
// arquivo; Comtrade no último ano declarado, só a linha de origem Brasil. As fontes nunca são somadas (R12.13).
// É dado do país: não indica nenhuma empresa (R12.10).

export const TOP_N = 5;

const monthsBack = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - (n - 1), 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

function top(byHs6, names) {
  return [...byHs6.entries()]
    .filter(([, usd]) => usd > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_N)
    .map(([hs6, usd]) => ({ hs6, name: names.get(hs6) ?? null, usd: Math.round(usd) }));
}

// MDIC: exportações do Brasil para o país (FOB, mensal).
export function summarizeMdic(obj, periodMonths) {
  const end = obj?.fileLastPeriod || obj?.lastPeriod;
  if (!obj || !end || obj.state === "data_unavailable")
    return { source: "mdic", state: "data_unavailable", periodFrom: null, periodTo: null, basis: "FOB", brazilUsd: null, hs6Count: 0, top: [] };
  const from = monthsBack(end, periodMonths);
  const byHs6 = new Map(), best = new Map(), names = new Map();
  for (const l of obj.lines ?? []) {
    if (l.ym < from || l.ym > end) continue;
    byHs6.set(l.hs6, (byHs6.get(l.hs6) ?? 0) + (l.fobUsd || 0));
    // Nome do SH6: o da NCM de maior valor dentro dele (em português, da tabela do MDIC).
    const k = `${l.hs6}|${l.ncm}`;
    best.set(k, (best.get(k) ?? 0) + (l.fobUsd || 0));
  }
  const bestNcm = new Map();
  for (const [k, usd] of best) {
    const [hs6, ncm] = k.split("|");
    if (!bestNcm.has(hs6) || usd > bestNcm.get(hs6).usd) bestNcm.set(hs6, { ncm, usd });
  }
  for (const l of obj.lines ?? []) if (bestNcm.get(l.hs6)?.ncm === l.ncm && !names.has(l.hs6)) names.set(l.hs6, l.namePt || l.nameEn || null);
  const total = [...byHs6.values()].reduce((a, b) => a + b, 0);
  const withValue = [...byHs6.values()].filter((v) => v > 0).length;
  return {
    source: "mdic", state: withValue ? "purchase_identified" : "no_record", periodFrom: from, periodTo: end, basis: "FOB",
    brazilUsd: Math.round(total), hs6Count: withValue, top: top(byHs6, names),
  };
}

// Comtrade: importações declaradas pelo país, origem Brasil, no último ano declarado (CIF quando houver).
export function summarizeComtrade(obj) {
  if (!obj || obj.state === "data_unavailable")
    return { source: "comtrade", state: "data_unavailable", periodFrom: null, periodTo: null, basis: null, brazilUsd: null, hs6Count: 0, top: [] };
  if (obj.state === "not_declared" || !obj.lines?.length)
    return { source: "comtrade", state: obj.state === "not_declared" ? "not_declared" : "no_record", periodFrom: null, periodTo: obj.lastPeriod ?? null, basis: obj.basis ?? null, brazilUsd: null, hs6Count: 0, top: [] };
  const year = Number(obj.lastPeriod) || Math.max(...obj.lines.map((l) => l.year));
  const byHs6 = new Map(), bases = new Set();
  for (const l of obj.lines) {
    if (l.year !== year || l.origin !== "brazil") continue;
    byHs6.set(l.hs6, (byHs6.get(l.hs6) ?? 0) + (l.valueUsd || 0));
    if (l.basis) bases.add(l.basis);
  }
  const names = new Map(Object.entries(obj.names ?? {}));
  const total = [...byHs6.values()].reduce((a, b) => a + b, 0);
  const withValue = [...byHs6.values()].filter((v) => v > 0).length;
  return {
    source: "comtrade", state: withValue ? "purchase_identified" : "no_record", periodFrom: String(year), periodTo: String(year),
    basis: bases.size === 1 ? [...bases][0] : bases.size ? "misto" : obj.basis ?? null,
    brazilUsd: Math.round(total), hs6Count: withValue, top: top(byHs6, names),
  };
}

// Linha para trade_country_summary. period_months = 0 na Comtrade (o resumo não depende da janela).
export function summaryRow({ iso3, versionId, sha, periodMonths, summary }) {
  return {
    content_sha256: sha, period_months: summary.source === "mdic" ? periodMonths : 0, iso3, source: summary.source, version_id: versionId,
    state: summary.state, period_from: summary.periodFrom, period_to: summary.periodTo, basis: summary.basis,
    brazil_usd: summary.brazilUsd, hs6_count: summary.hs6Count, top_json: JSON.stringify(summary.top),
  };
}
export const SUMMARY_COLUMNS = ["content_sha256", "period_months", "iso3", "source", "version_id", "state", "period_from", "period_to", "basis", "brazil_usd", "hs6_count", "top_json"];
