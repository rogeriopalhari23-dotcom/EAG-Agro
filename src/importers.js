// Radar Internacional — lista básica de países importadores (consulta rápida, sem relatório).
// Para cada país: nome, commodities agrícolas de origem Brasil, período e fonte — MDIC e Comtrade lado a lado,
// nunca somados (R12.13). Lê só a lista mensal já publicada e os resumos guardados; nenhuma chamada externa
// (R12.2, R12.11). Dado do país: não indica que alguma empresa importe (R12.10).
import { fail, requireRole } from "./http.js";
import { statement as s, commit, parameters, auditStatement } from "./store.js";
import { summarizeMdic, summarizeComtrade, summaryRow, SUMMARY_COLUMNS } from "./trade-summary.js";

const ADMIN = new Set(["admin"]);
export const STATE_LABEL = {
  purchase_identified: "compra identificada",
  no_record: "nenhum registro no período",
  data_unavailable: "dados indisponíveis",
  not_declared: "sem declaração do país à fonte",
};
export const SOURCE_LABEL = {
  mdic: "MDIC/Comex Stat — exportações do Brasil para o país (FOB, mensal)",
  comtrade: "UN Comtrade — importações declaradas pelo país, origem Brasil (CIF, anual)",
};

export function summaryStmt(env, row) {
  return s(env, `INSERT OR IGNORE INTO trade_country_summary(${SUMMARY_COLUMNS.join(",")}) VALUES (${SUMMARY_COLUMNS.map(() => "?").join(",")})`, ...SUMMARY_COLUMNS.map((c) => row[c] ?? null));
}

async function periodMonths(env, tenant) {
  const p = await parameters(env, tenant);
  const m = p["period_default_months:international"];
  return Number.isInteger(m) ? m : null;
}

// Preenche resumos que faltam para os ponteiros vigentes (objetos publicados antes do resumo existir, ou janela mudada).
// Só lê o R2; limitado por chamada. Usado pelo cron diário e pelo admin.
export async function rebuildSummaries(env, tenant, { limit = 40 } = {}) {
  const months = await periodMonths(env, tenant);
  if (months == null) return { built: 0, remaining: null, reason: "Parâmetro period_default_months (D1) não aprovado." };
  if (!env.FILES) return { built: 0, remaining: null, reason: "R2 não configurado." };
  const missingSql = `FROM trade_list_current c LEFT JOIN trade_country_summary t
      ON t.content_sha256=c.content_sha256 AND t.period_months=(CASE c.source WHEN 'mdic' THEN ? ELSE 0 END)
     WHERE t.content_sha256 IS NULL`;
  const todo = (await s(env, `SELECT c.iso3,c.source,c.version_id,c.r2_key,c.content_sha256 ${missingSql} ORDER BY c.source,c.iso3 LIMIT ?`, months, limit).all()).results;
  let built = 0;
  const failed = [];
  for (const p of todo) {
    const o = await env.FILES.get(p.r2_key);
    if (!o) {
      failed.push(p.iso3);
      continue;
    }
    const obj = JSON.parse(await o.text());
    const summary = p.source === "mdic" ? summarizeMdic(obj, months) : summarizeComtrade(obj);
    await summaryStmt(env, summaryRow({ iso3: p.iso3, versionId: p.version_id, sha: p.content_sha256, periodMonths: months, summary })).run();
    built++;
  }
  // Resumos de objetos que nenhum ponteiro usa mais saem (a lista nunca os mostraria).
  await s(env, "DELETE FROM trade_country_summary WHERE content_sha256 NOT IN (SELECT content_sha256 FROM trade_list_current)").run();
  const remaining = (await s(env, `SELECT COUNT(*) n ${missingSql}`, months).first()).n;
  return { built, remaining, failed };
}

export async function rebuildSummariesRoute(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  const r = await rebuildSummaries(env, actor.tenant_id, { limit: 40 });
  await commit(env, [auditStatement(env, actor, rid, "trade_list.summaries_rebuilt", "trade_list", "summaries", { built: r.built, remaining: r.remaining })]);
  return r;
}

function sourceView(row, prefix, lastMonth, pending, namesPt) {
  const has = row[`${prefix}_version`];
  if (!has) return { state: "data_unavailable", label: "lista ainda não gerada para este país", commodities: [], period: null, versionId: null };
  if (pending) return { state: "summary_pending", label: "resumo em preparação (lista publicada)", commodities: [], period: null, versionId: has };
  const top = JSON.parse(row[`${prefix}_top`] || "[]").map((c) => ({ ...c, name: namesPt.get(c.hs6) ?? c.name }));
  const stale = lastMonth && !has.startsWith(lastMonth) && has < lastMonth ? lastMonth : null;
  return {
    state: row[`${prefix}_state`],
    label: STATE_LABEL[row[`${prefix}_state`]] ?? row[`${prefix}_state`],
    source: SOURCE_LABEL[prefix === "md" ? "mdic" : "comtrade"],
    period: row[`${prefix}_from`] || row[`${prefix}_to`] ? { from: row[`${prefix}_from`], to: row[`${prefix}_to`] } : null,
    basis: row[`${prefix}_basis`],
    brazilUsd: row[`${prefix}_usd`],
    hs6Count: row[`${prefix}_n`],
    commodities: top,
    versionId: has,
    staleSince: stale,
  };
}

// GET /api/radar/importers?q=&purchase=1
export async function listImporters(request, env, actor) {
  const u = new URL(request.url);
  const q = (u.searchParams.get("q") || "").trim().toLowerCase().slice(0, 60);
  const onlyPurchase = u.searchParams.get("purchase") === "1";
  const months = await periodMonths(env, actor.tenant_id);
  if (months == null) fail(409, "parameter_missing", "Período padrão do Internacional (D1) não aprovado.");
  const rows = (
    await s(
      env,
      `SELECT co.iso3,co.name_pt,co.name_en,
         md.version_id md_version, sm.content_sha256 md_ok, sm.state md_state, sm.period_from md_from, sm.period_to md_to, sm.basis md_basis, sm.brazil_usd md_usd, sm.hs6_count md_n, sm.top_json md_top,
         ct.version_id ct_version, sc.content_sha256 ct_ok, sc.state ct_state, sc.period_from ct_from, sc.period_to ct_to, sc.basis ct_basis, sc.brazil_usd ct_usd, sc.hs6_count ct_n, sc.top_json ct_top
       FROM countries co
       LEFT JOIN trade_list_current md ON md.iso3=co.iso3 AND md.source='mdic'
       LEFT JOIN trade_country_summary sm ON sm.content_sha256=md.content_sha256 AND sm.period_months=?
       LEFT JOIN trade_list_current ct ON ct.iso3=co.iso3 AND ct.source='comtrade'
       LEFT JOIN trade_country_summary sc ON sc.content_sha256=ct.content_sha256 AND sc.period_months=0
       WHERE md.iso3 IS NOT NULL OR ct.iso3 IS NOT NULL`,
      months,
    ).all()
  ).results;
  const latest = await s(env, "SELECT reference_month FROM trade_list_versions WHERE kind='monthly' AND status<>'running' ORDER BY started_at DESC LIMIT 1").first();
  const lastMonth = latest?.reference_month ?? null;
  let pendingSummaries = 0;
  const items = rows
    .map((r) => {
      // Nome em português do MDIC para o mesmo SH6 quando a Comtrade só traz o nome em inglês.
      const namesPt = new Map(JSON.parse(r.md_top || "[]").filter((c) => c.name).map((c) => [c.hs6, c.name]));
      const mdPending = !!r.md_version && !r.md_ok;
      const ctPending = !!r.ct_version && !r.ct_ok;
      pendingSummaries += mdPending + ctPending;
      const mdic = sourceView(r, "md", lastMonth, mdPending, new Map());
      const comtrade = sourceView(r, "ct", lastMonth, ctPending, namesPt);
      return {
        iso3: r.iso3, name: r.name_pt, nameEn: r.name_en,
        purchaseIdentified: mdic.state === "purchase_identified" || comtrade.state === "purchase_identified",
        sources: { mdic, comtrade },
      };
    })
    .filter((x) => (!q || x.name.toLowerCase().includes(q) || x.nameEn.toLowerCase().includes(q) || x.iso3.toLowerCase() === q) && (!onlyPurchase || x.purchaseIdentified))
    .sort((a, b) => b.purchaseIdentified - a.purchaseIdentified || (b.sources.mdic.brazilUsd ?? -1) - (a.sources.mdic.brazilUsd ?? -1) || a.name.localeCompare(b.name));
  return {
    notice: "Dado agregado do país: mostra comércio com o Brasil, não prova que alguma empresa específica importe.",
    periodMonths: months,
    latestMonthly: lastMonth,
    pendingSummaries,
    items,
  };
}
