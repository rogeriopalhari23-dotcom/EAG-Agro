// Análise de país a partir da lista mensal (P3-T6; R12.1–R12.6.1, R12.13, R1.4, R8.2; AT20–AT23, AT71, AT73, AT74).
// Lê somente os objetos do R2 apontados por trade_list_current — nenhuma chamada externa. As duas fontes ficam
// lado a lado, sem soma; a parte do Brasil é calculada só dentro da Comtrade (mesmo ano, mesma base).
// Nada daqui toca empresas, evidências, condições ou scores (R1.4.3).
import { bodyJson, fail, str, WRITE_ROLES, requireRole } from "./http.js";
import { statement as s, commit, parameters, requireParameter, auditStatement } from "./store.js";
import { sha256 } from "./trade-list.js";

export const NOTICE = "O dado confirma exportação do Brasil para o país; não comprova compra por nenhuma empresa específica.";
const STATE_LABEL = {
  purchase_identified: "compra identificada",
  no_record: "nenhum registro no período",
  data_unavailable: "dados indisponíveis",
  not_declared: "sem declaração do país à fonte",
  pending: "dados indisponíveis",
};

const monthsBack = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - (n - 1), 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

async function readObject(env, key) {
  const o = await env.FILES?.get(key);
  if (!o) fail(503, "trade_list_object_missing", "Objeto da lista mensal indisponível no armazenamento.");
  return JSON.parse(await o.text());
}

async function pointers(env, iso3) {
  const rows = (
    await s(
      env,
      `SELECT c.source,c.version_id,c.r2_key,c.content_sha256,st.state,st.last_period,st.error,v.reference_month,v.finished_at
       FROM trade_list_current c JOIN trade_list_versions v ON v.id=c.version_id
       LEFT JOIN trade_list_status st ON st.version_id=c.version_id AND st.iso3=c.iso3 AND st.source=c.source WHERE c.iso3=?`,
      iso3,
    ).all()
  ).results;
  return Object.fromEntries(rows.map((r) => [r.source, r]));
}

// Estado da fonte na versão usada pela análise, com "não atualizado em <mês>" quando essa versão é anterior
// à última rotina mensal fechada (a rotina daquele mês falhou para o país).
async function sourceStatus(env, iso3, source, versionId) {
  const latest = await s(env, "SELECT reference_month FROM trade_list_versions WHERE kind='monthly' AND status<>'running' ORDER BY started_at DESC LIMIT 1").first();
  const lastRun = latest?.reference_month ?? null;
  if (!versionId) {
    const cur = lastRun ? await s(env, "SELECT state,error FROM trade_list_status WHERE version_id=? AND iso3=? AND source=?", lastRun, iso3, source).first() : null;
    const state = cur?.state && cur.state !== "pending" ? cur.state : "data_unavailable";
    return { state, label: STATE_LABEL[state], note: cur?.error ?? "Lista ainda não gerada para este país.", staleSince: null };
  }
  const st = await s(env, "SELECT state,error FROM trade_list_status WHERE version_id=? AND iso3=? AND source=?", versionId, iso3, source).first();
  const stale = lastRun && !versionId.startsWith(lastRun) && versionId < lastRun ? lastRun : null;
  return { state: st?.state ?? "data_unavailable", label: STATE_LABEL[st?.state ?? "data_unavailable"], note: stale ? `não atualizado em ${stale}` : st?.error ?? null, staleSince: stale };
}
// O hash cobre o que veio da lista (não a correspondência com o catálogo, que muda com o cadastro).
const listPart = (a) => JSON.stringify({ ...a, rows: a.rows.map(({ catalog, ...r }) => r) });

// Correspondência com o catálogo: só códigos `confirmed` comprovam (R12.4, AT22); pendente aparece como pendente.
async function catalogIndex(env, tenant) {
  const rows = (
    await s(
      env,
      "SELECT p.id,p.variant_name,p.commodity,c.code_system,c.code,c.status FROM product_codes c JOIN products p ON p.id=c.product_id WHERE p.tenant_id=? AND p.active=1",
      tenant,
    ).all()
  ).results;
  return rows.map((r) => ({ ...r, code: String(r.code).replace(/\D/g, "") }));
}
function matches(index, hs6, ncms) {
  const confirmed = new Map(), pending = new Map();
  for (const c of index) {
    const hit = c.code_system === "HS" ? c.code.length >= 4 && (hs6.startsWith(c.code) || c.code.startsWith(hs6)) : ncms.includes(c.code);
    if (!hit) continue;
    (c.status === "confirmed" ? confirmed : pending).set(c.id, { productId: c.id, variant: c.variant_name, commodity: c.commodity });
  }
  for (const id of confirmed.keys()) pending.delete(id);
  return { confirmed: [...confirmed.values()], pending: [...pending.values()] };
}

export async function buildAnalysis(env, tenant, iso3, periodMonths, objs) {
  const { mdicObj, comtradeObj } = objs;
  const rows = new Map();
  const row = (hs6) => rows.get(hs6) || rows.set(hs6, { hs6, name: null, comtrade: null, mdic: null }).get(hs6);
  // MDIC: janela de N meses terminando no último mês publicado do arquivo.
  let window = null;
  if (mdicObj) {
    const end = mdicObj.fileLastPeriod || mdicObj.lastPeriod;
    if (end) {
      window = { from: monthsBack(end, periodMonths), to: end };
      for (const l of mdicObj.lines) {
        if (l.ym < window.from || l.ym > window.to) continue;
        const r = row(l.hs6);
        r.name ||= l.nameEn || l.namePt;
        const m = (r.mdic ||= { fobUsd: 0, netKg: 0, qty: {}, lastOccurrence: null, ncms: [] });
        m.fobUsd += l.fobUsd;
        m.netKg += l.netKg;
        if (l.qt !== null && l.qt !== undefined) m.qty[l.unit ?? "?"] = (m.qty[l.unit ?? "?"] ?? 0) + l.qt;
        if (!m.lastOccurrence || l.ym > m.lastOccurrence) m.lastOccurrence = l.ym;
        if (!m.ncms.some((x) => x.ncm === l.ncm)) m.ncms.push({ ncm: l.ncm, namePt: l.namePt, unit: l.unit });
      }
    }
  }
  for (const r of rows.values())
    if (r.mdic) {
      const units = Object.keys(r.mdic.qty);
      // Quantidade estatística nunca é somada entre unidades diferentes (T6 C6): mais de uma unidade = inconsistência marcada.
      r.mdic.qtyInconsistent = units.length > 1;
    }
  // Comtrade: por SH6, o último ano declarado com a linha de todas as origens; parte do Brasil no mesmo ano e base.
  if (comtradeObj?.lines?.length) {
    const by = new Map();
    for (const l of comtradeObj.lines) (by.get(l.hs6) || by.set(l.hs6, []).get(l.hs6)).push(l);
    for (const [hs6, list] of by) {
      const years = [...new Set(list.map((l) => l.year))].sort();
      const perYear = years.map((year) => {
        const world = list.find((l) => l.year === year && l.origin === "world");
        const brazil = list.find((l) => l.year === year && l.origin === "brazil");
        const sameBasis = world && brazil && world.basis === brazil.basis;
        const share = sameBasis && world.valueUsd > 0 && brazil.valueUsd !== null ? brazil.valueUsd / world.valueUsd : null;
        return {
          year, basis: world?.basis ?? brazil?.basis ?? null,
          worldUsd: world?.valueUsd ?? null, brazilUsd: brazil?.valueUsd ?? null, brazilShare: share,
          shareNote: share === null ? (!world ? "sem linha de todas as origens" : !brazil ? "sem linha de origem Brasil" : !sameBasis ? "bases de valor diferentes" : "total do país zero ou ausente") : null,
          worldNetKg: world?.netKg ?? null, brazilNetKg: brazil?.netKg ?? null,
        };
      });
      const r = row(hs6);
      r.comtrade = { latest: perYear.at(-1), years: perYear };
      r.name ||= comtradeObj.names?.[hs6] ?? null;
    }
  }
  const index = await catalogIndex(env, tenant);
  const table = [...rows.values()]
    .map((r) => {
      const purchase = (r.mdic && (r.mdic.fobUsd > 0 || r.mdic.netKg > 0)) || (r.comtrade && r.comtrade.years.some((y) => (y.worldUsd ?? 0) > 0 || (y.brazilUsd ?? 0) > 0));
      return { ...r, purchaseIdentified: !!purchase, catalog: matches(index, r.hs6, r.mdic?.ncms.map((n) => n.ncm) ?? []) };
    })
    .sort((a, b) => a.hs6.localeCompare(b.hs6));
  const lastDeclared = comtradeObj?.lastPeriod ?? null;
  // Atraso medido contra o mês da versão da lista (determinístico), não contra o relógio.
  const refYear = Number(String(comtradeObj?.versionId ?? "").slice(0, 4)) || null;
  return {
    iso3,
    periodMonths,
    mdicWindow: window,
    comtradeLastDeclared: lastDeclared,
    // R12.6.1: país que parou de declarar mostra "sem declaração desde <ano>" e os anos guardados — nunca "nenhum registro".
    comtradeLagging: lastDeclared && refYear && Number(lastDeclared) < refYear - 1 ? `sem declaração do país desde ${lastDeclared}` : null,
    rows: table,
  };
}

export async function createAnalysis(request, env, actor, rid) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request);
  const iso3 = str(i.iso3, "país", 3).toUpperCase();
  const country = await s(env, "SELECT * FROM countries WHERE iso3=?", iso3).first();
  if (!country) fail(404, "country_not_found", "País não encontrado.");
  const p = await parameters(env, actor.tenant_id);
  const periodMonths = i.periodMonths === undefined ? requireParameter(p, "period_default_months:international") : i.periodMonths;
  if (!Number.isInteger(periodMonths) || periodMonths < 1 || periodMonths > 60) fail(422, "invalid_period", "Período de 1 a 60 meses.");
  const ptr = await pointers(env, iso3);
  if (!ptr.mdic && !ptr.comtrade) fail(409, "trade_list_missing", "A lista mensal deste país ainda não foi gerada.");
  const mdicObj = ptr.mdic ? await readObject(env, ptr.mdic.r2_key) : null;
  const comtradeObj = ptr.comtrade ? await readObject(env, ptr.comtrade.r2_key) : null;
  const analysis = await buildAnalysis(env, actor.tenant_id, iso3, periodMonths, { mdicObj, comtradeObj });
  const id = crypto.randomUUID();
  const hash = await sha256(listPart(analysis));
  await commit(env, [
    s(
      env,
      "INSERT INTO country_analyses(id,tenant_id,iso3,period_months,comtrade_version_id,comtrade_r2_key,mdic_version_id,mdic_r2_key,snapshot_sha256,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
      id, actor.tenant_id, iso3, periodMonths, ptr.comtrade?.version_id ?? null, ptr.comtrade?.r2_key ?? null, ptr.mdic?.version_id ?? null, ptr.mdic?.r2_key ?? null, hash, actor.id,
    ),
    auditStatement(env, actor, rid, "country_analysis.created", "country_analysis", id, { iso3, periodMonths, comtrade: ptr.comtrade?.version_id ?? null, mdic: ptr.mdic?.version_id ?? null }),
  ]);
  return getAnalysis(env, actor, id);
}

// Reproduz a análise dos mesmos objetos (imutáveis e protegidos da poda) e confere o hash do que foi exibido (R8.2).
export async function getAnalysis(env, actor, id) {
  const a = await s(env, "SELECT * FROM country_analyses WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!a) fail(404, "analysis_not_found", "Análise não encontrada.");
  const country = await s(env, "SELECT iso3,iso2,name_pt,name_en,default_language FROM countries WHERE iso3=?", a.iso3).first();
  const mdicObj = a.mdic_r2_key ? await readObject(env, a.mdic_r2_key) : null;
  const comtradeObj = a.comtrade_r2_key ? await readObject(env, a.comtrade_r2_key) : null;
  const analysis = await buildAnalysis(env, actor.tenant_id, a.iso3, a.period_months, { mdicObj, comtradeObj });
  const reproduced = (await sha256(listPart(analysis))) === a.snapshot_sha256;
  return {
    id: a.id,
    country,
    createdAt: a.created_at,
    createdBy: a.created_by,
    notice: NOTICE,
    sources: {
      comtrade: {
        title: "Compras declaradas pelo país (CIF, anual, visão do importador)",
        versionId: a.comtrade_version_id,
        ...(await sourceStatus(env, a.iso3, "comtrade", a.comtrade_version_id)),
        lastDeclared: analysis.comtradeLastDeclared,
        lagging: analysis.comtradeLagging,
        years: comtradeObj?.years ?? [],
      },
      mdic: {
        title: "Exportações do Brasil (FOB, mensal, visão do Brasil)",
        versionId: a.mdic_version_id,
        ...(await sourceStatus(env, a.iso3, "mdic", a.mdic_version_id)),
        window: analysis.mdicWindow,
      },
    },
    periodMonths: a.period_months,
    rows: analysis.rows,
    snapshotSha256: a.snapshot_sha256,
    reproduced,
  };
}

// Painel do mercado internacional (R24.1, R24.3): análises, seleções e campanhas que cada uma originou.
export async function listAnalyses(env, actor) {
  const rows = (
    await s(
      env,
      `SELECT a.id,a.iso3,c.name_pt,a.period_months,a.created_at,a.created_by,a.comtrade_version_id,a.mdic_version_id,
        (SELECT COUNT(*) FROM commodity_selections x WHERE x.analysis_id=a.id) selections,
        (SELECT COUNT(*) FROM campaigns p WHERE p.analysis_id=a.id) campaigns,
        (SELECT COUNT(*) FROM campaigns p WHERE p.analysis_id=a.id AND p.status='active') active_campaigns
       FROM country_analyses a JOIN countries c ON c.iso3=a.iso3 WHERE a.tenant_id=? ORDER BY a.created_at DESC LIMIT 50`,
      actor.tenant_id,
    ).all()
  ).results;
  return { items: rows };
}
