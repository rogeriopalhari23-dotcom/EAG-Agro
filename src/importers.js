// Radar Internacional — lista básica de países importadores (consulta rápida, sem relatório).
// Para cada país: nome, commodities agrícolas de origem Brasil, período e fonte — MDIC e Comtrade lado a lado,
// nunca somados (R12.13). Lê só a lista mensal já publicada e os resumos guardados; nenhuma chamada externa
// (R12.2, R12.11). Dado do país: não indica que alguma empresa importe (R12.10).
import { fail, requireRole } from "./http.js";
import { statement as s, commit, parameters, auditStatement, now } from "./store.js";
import { summarizeMdic, summarizeComtrade, summarizeComtradeHistory, comtradeMinYear, summaryRow, SUMMARY_COLUMNS } from "./trade-summary.js";

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
  return s(env, `INSERT OR REPLACE INTO trade_country_summary(${SUMMARY_COLUMNS.join(",")}) VALUES (${SUMMARY_COLUMNS.map(() => "?").join(",")})`, ...SUMMARY_COLUMNS.map((c) => row[c] ?? null));
}

async function periodMonths(env, tenant) {
  const p = await parameters(env, tenant);
  const m = p["period_default_months:international"];
  return Number.isInteger(m) ? m : null;
}

// Preenche resumos que faltam para os ponteiros vigentes (objetos publicados antes do resumo existir, ou janela mudada).
// Só lê o R2; limitado por chamada. Usado pelo cron diário e pelo admin.
// months: janela do MDIC diferente da padrão (ex.: período guardado mais longo, para a evidência de mercado).
// comtradeHistory: resumo da Comtrade nos anos guardados da janela recente (period_months = ano inicial), só Comtrade.
// after: cursor "fonte|ISO3" (retomada do lote anterior, sem recomeçar pelos mesmos países); objeto que falha não
// interrompe o lote: fica em failed, com o motivo, e os demais seguem.
export async function rebuildSummaries(env, tenant, { limit = 40, months: windowMonths = null, comtradeHistory = false, after = null } = {}) {
  const minYear = comtradeHistory ? comtradeMinYear((await parameters(env, tenant))["trade_list_comtrade_years:international"], now()) : null;
  const months = comtradeHistory ? minYear : windowMonths ?? (await periodMonths(env, tenant));
  if (months == null) return { built: 0, remaining: null, reason: "Parâmetro period_default_months (D1) não aprovado." };
  if (!env.FILES) return { built: 0, remaining: null, reason: "R2 não configurado." };
  const missingSql = comtradeHistory
    ? `FROM trade_list_current c LEFT JOIN trade_country_summary t ON t.content_sha256=c.content_sha256 AND t.period_months=?
     WHERE c.source='comtrade' AND (t.content_sha256 IS NULL OR t.hs6_json IS NULL)`
    : `FROM trade_list_current c LEFT JOIN trade_country_summary t
      ON t.content_sha256=c.content_sha256 AND t.period_months=(CASE c.source WHEN 'mdic' THEN ? ELSE 0 END)
     WHERE (t.content_sha256 IS NULL OR t.hs6_json IS NULL)`;
  // Só contagem (limit 0): nenhuma leitura do R2 e nenhuma gravação.
  if (limit === 0) return { built: 0, remaining: (await s(env, `SELECT COUNT(*) n ${missingSql}`, months).first()).n, failed: [], errors: [], last: null, exhausted: true };
  const todo = (await s(env, `SELECT c.iso3,c.source,c.version_id,c.r2_key,c.content_sha256 ${missingSql}${after ? " AND (c.source||'|'||c.iso3)>?" : ""} ORDER BY c.source,c.iso3 LIMIT ?`, ...(after ? [months, after, limit] : [months, limit])).all()).results;
  let built = 0, last = null;
  const failed = [], errors = [];
  for (const p of todo) {
    last = `${p.source}|${p.iso3}`;
    try {
      const o = await env.FILES.get(p.r2_key);
      if (!o) {
        failed.push(p.iso3);
        errors.push(`${p.source}/${p.iso3}: objeto não encontrado no R2`);
        continue;
      }
      const obj = JSON.parse(await o.text());
      const summary = comtradeHistory ? summarizeComtradeHistory(obj, minYear) : p.source === "mdic" ? summarizeMdic(obj, months) : summarizeComtrade(obj);
      await summaryStmt(env, summaryRow({ iso3: p.iso3, versionId: p.version_id, sha: p.content_sha256, periodMonths: months, summary })).run();
      built++;
    } catch (e) {
      failed.push(p.iso3);
      errors.push(`${p.source}/${p.iso3}: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
  // Resumos de objetos que nenhum ponteiro usa mais saem (a lista nunca os mostraria).
  await s(env, "DELETE FROM trade_country_summary WHERE content_sha256 NOT IN (SELECT content_sha256 FROM trade_list_current)").run();
  const remaining = (await s(env, `SELECT COUNT(*) n ${missingSql}`, months).first()).n;
  return { built, remaining, failed, errors, last, exhausted: todo.length < limit };
}

// Retomada automática dos resumos que faltam (cron de 5 minutos): lotes pequenos, um executor por vez (lease), cursor
// persistido por janela e último resultado ou falha visível na tela. Só lê objetos oficiais já guardados no R2; nenhuma
// chamada externa. Enquanto houver resumo pendente, a lista de destinos fica "em preparação": resumo ausente nunca é
// ausência de comércio nem de empresas.
export const CATCHUP = "trade_summary_catchup";
export async function summaryWindows(env, tenant) {
  const p = await parameters(env, tenant);
  const months = Number(p["period_default_months:international"]) || null;
  const longest = Math.min(60, Math.max(12, (Number(p["trade_list_mdic_years:international"]) || 1) * 12));
  return [
    months ? { key: `m${months}`, months } : null,
    months && longest > months ? { key: `m${longest}`, months: longest } : null,
    { key: "hist", comtradeHistory: true },
  ].filter(Boolean);
}
export async function summaryCatchUp(env, tenant, { at = now(), batch = 20, leaseMs = 4 * 60_000, rebuild = rebuildSummaries } = {}) {
  if (!env.FILES) return { state: "idle", reason: "R2 não configurado" };
  const passes = await summaryWindows(env, tenant);
  // Nada a fazer: nenhuma gravação (o cron roda a cada 5 minutos).
  const pending = async () => {
    let n = 0;
    for (const w of passes) n += (await rebuild(env, tenant, { ...w, limit: 0 })).remaining ?? 0;
    return n;
  };
  if (!(await pending())) return { state: "idle", remaining: 0 };
  const holder = crypto.randomUUID();
  const until = new Date(Date.parse(at) + leaseMs).toISOString();
  await s(env, "INSERT OR IGNORE INTO maintenance_leases(name) VALUES (?)", CATCHUP).run();
  const got = await s(env, "UPDATE maintenance_leases SET holder=?,lease_until=?,last_started_at=? WHERE name=? AND (lease_until IS NULL OR lease_until<?)", holder, until, at, CATCHUP, at).run();
  if (!got.meta?.changes) return { state: "busy" };
  const row = await s(env, "SELECT cursor_json FROM maintenance_leases WHERE name=?", CATCHUP).first();
  let cursor = {};
  try { cursor = JSON.parse(row?.cursor_json ?? "{}") ?? {}; } catch { cursor = {}; }
  let budget = batch, built = 0;
  const errors = [];
  try {
    for (const w of passes) {
      if (budget <= 0) break;
      const r = await rebuild(env, tenant, { ...w, limit: budget, after: cursor[w.key] ?? null });
      built += r.built;
      errors.push(...(r.errors ?? []));
      budget -= r.built + (r.failed?.length ?? 0);
      // Fim da janela: volta ao começo na próxima vez (refaz o que falhou, sem repetir o que já foi feito).
      cursor[w.key] = r.exhausted ? null : r.last;
    }
    const remaining = await pending();
    const result = { built, remaining, errors: errors.slice(0, 10), at };
    await s(env, "UPDATE maintenance_leases SET holder=NULL,lease_until=NULL,cursor_json=?,last_finished_at=?,last_result_json=?,last_error=?,last_error_at=? WHERE name=? AND holder=?", JSON.stringify(cursor), now(), JSON.stringify(result), errors.length ? errors.slice(0, 3).join("; ") : null, errors.length ? now() : null, CATCHUP, holder).run();
    return { state: "ran", ...result };
  } catch (e) {
    const msg = String(e?.message ?? e).slice(0, 200);
    await s(env, "UPDATE maintenance_leases SET holder=NULL,lease_until=NULL,cursor_json=?,last_error=?,last_error_at=? WHERE name=? AND holder=?", JSON.stringify(cursor), msg, now(), CATCHUP, holder).run().catch(() => null);
    return { state: "failed", built, error: msg };
  }
}
// Situação da retomada para a tela: último lote, falha, restante.
export async function catchUpStatus(env) {
  const r = await s(env, "SELECT lease_until,last_started_at,last_finished_at,last_result_json,last_error,last_error_at FROM maintenance_leases WHERE name=?", CATCHUP).first().catch(() => null);
  if (!r) return null;
  let last = null;
  try { last = r.last_result_json ? JSON.parse(r.last_result_json) : null; } catch { last = null; }
  return { running: !!(r.lease_until && r.lease_until > now()), lastStartedAt: r.last_started_at, lastFinishedAt: r.last_finished_at, built: last?.built ?? null, remaining: last?.remaining ?? null, error: r.last_error, errorAt: r.last_error_at };
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
