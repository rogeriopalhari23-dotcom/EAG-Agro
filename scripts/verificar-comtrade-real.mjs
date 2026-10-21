// Verificação REAL, pequena, gratuita e só de leitura do caminho dos dados de comércio por produto (2026-10-21).
// Ambiente SEPARADO da produção: banco D1 em memória e R2 em memória (tests/helpers), nada é gravado fora deste processo.
// Um país (Canadá), só o capítulo 15 da classificação, o último ano declarado (o endpoint público aceita 1 período): o MESMO código da rotina (pedido do país, fila,
// adaptador da Comtrade, consolidação, resumo e regra de destinos) até a lista de destinos do óleo de soja.
// A consulta de dados usa o endpoint PÚBLICO de prévia da Comtrade (sem chave, gratuito); a rotina de produção usa o
// endpoint com chave, de mesmo formato. O MDIC fica de fora (MDIC_SOURCE=github) para não baixar os arquivos anuais.
//   node --use-system-ca scripts/verificar-comtrade-real.mjs
import { setup } from "../tests/helpers/db.mjs";
import { memoryR2, tradeParams } from "../tests/helpers/trade.mjs";
import { requestCountryList, runJob as runTradeJob, sweep } from "../src/trade-list.js";
import { rebuildSummaries } from "../src/importers.js";
import { resolveClassification, applyClassification } from "../src/classification.js";
import { destinationsFor } from "../src/destinations.js";
import { DEFAULT_PROFILE } from "../src/prospect/defaults.js";

const ctx = setup();
const { api, env, DB } = ctx;
Object.assign(env, { FILES: memoryR2(), MDIC_SOURCE: "github", COMTRADE_KEY: "nao-usada-endpoint-publico", DEFAULT_TENANT_ID: "eag-internal" });
delete env.SIMULATED_TRADE; // dado real: nada de marca de simulação
const log = [];
const queue = [];
const deps = {
  now: () => new Date().toISOString(),
  enqueue: async (msgs) => queue.push(...msgs.map((m) => m.body)),
  // Endpoint de dados com chave → endpoint público de prévia (mesmo formato); a chave nunca é enviada.
  fetch: async (url, init = {}) => {
    const u = String(url).replace("/data/v1/get/", "/public/v1/preview/");
    const headers = { ...(init.headers ?? {}) };
    delete headers["Ocp-Apim-Subscription-Key"];
    const t0 = Date.now();
    const r = await fetch(u, { ...init, headers });
    log.push({ url: u.replace(/cmdCode=[^&]+/, (m) => `cmdCode=<${m.split("%2C").length} códigos>`), status: r.status, ms: Date.now() - t0 });
    return r;
  },
};
await tradeParams(api, { period_default_months: 12, trade_list_comtrade_years: 1, comtrade_calls_per_day: 10, agri_classification: { version: "verificacao-real-cap15", chapters: ["15"], excluded: [] } });
const r = await requestCountryList(env, "eag-internal", "CAN", { requestedBy: "verificacao-real", reason: "Verificação real do caminho dos dados (ambiente separado)", deps });
// Fila até o fim, como a produção: trabalho reagendado (falha temporária, limite) volta pela varredura, no orçamento.
for (let k = 0; k < 40; k++) {
  while (queue.length) await runTradeJob(env, queue.shift().jobId, deps);
  const open = DB.raw.prepare("SELECT COUNT(*) n, MIN(next_attempt_at) next FROM trade_list_jobs WHERE version_id=? AND status IN ('pending','leased')").get(r.versionId);
  if (!open.n) break;
  const wait = Math.min(30_000, Math.max(1_000, Date.parse(open.next ?? 0) - Date.now()));
  await new Promise((res) => setTimeout(res, wait));
  await sweep(env, deps);
}
const jobs = DB.raw.prepare("SELECT kind,status,attempts,error_kind,error FROM trade_list_jobs WHERE version_id=?").all(r.versionId);
const status = DB.raw.prepare("SELECT source,state,last_period,lines,error FROM trade_list_status WHERE version_id=?").all(r.versionId);
const calls = DB.raw.prepare("SELECT used FROM provider_budget WHERE provider='comtrade'").get()?.used ?? 0;
await rebuildSummaries(env, "eag-internal", { limit: 10 });
// Óleo de soja (bruto e refinado): classificação documental 1507.10 e 1507.90.
const cl = await resolveClassification(env, "eag-internal", "product-19");
await applyClassification(env, "eag-internal", "product-19", cl, { policy: { id: "verificacao", version: 0 }, jobId: "verificacao-real" });
const oil = DB.raw.prepare("SELECT * FROM products WHERE id='product-19'").get();
const cur = DB.raw.prepare("SELECT r2_key FROM trade_list_current WHERE iso3='CAN' AND source='comtrade'").get();
const obj = cur ? JSON.parse(await (await env.FILES.get(cur.r2_key)).text()) : null;
const oilLines = (obj?.lines ?? []).filter((l) => ["150710", "150790"].includes(l.hs6));
const d = await destinationsFor(env, "eag-internal", { products: [oil], profile: DEFAULT_PROFILE });
console.log(JSON.stringify({
  ambiente: "D1 e R2 em memória (separado da produção); endpoint público de prévia da Comtrade, sem chave",
  consultasReais: log, chamadasContadasNoOrcamento: calls, orcamentoDiario: 10,
  statusDoPais: status, trabalhos: jobs,
  ultimoAnoDeclarado: obj?.lastPeriod ?? null,
  linhasDoOleoDeSoja: oilLines,
  classificacao: cl.codes?.map((c) => c.hs6),
  destinos: d.items.map((x) => ({ pais: x.name, linha: x.line, evidencia: x.evidence.map((e) => e.text) })),
  estado: d.state, mensagem: d.message,
  coberturaComtrade: d.diagnostics?.[0]?.bySource?.comtrade?.text,
  coberturaMdic: d.diagnostics?.[0]?.bySource?.mdic?.text,
}, null, 1));
ctx.close();
