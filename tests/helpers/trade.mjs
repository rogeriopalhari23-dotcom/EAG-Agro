// Cenário da lista mensal: R2 em memória, fontes MDIC e Comtrade simuladas e um condutor da fila.
// Fixtures não substituem a validação real das fontes (Plano 3 T12).
import { HEADER } from "../../src/adapters/mdic-bulk.js";
import { runJob, startMonthlyRun, daily, sweep } from "../../src/trade-list.js";

export function memoryR2() {
  const store = new Map();
  return {
    store,
    async put(key, value) {
      store.set(key, typeof value === "string" ? value : new TextDecoder().decode(value));
    },
    async get(key) {
      return store.has(key) ? { text: async () => store.get(key) } : null;
    },
    async delete(keys) {
      for (const k of [].concat(keys)) store.delete(k);
    },
    async list({ prefix = "", cursor } = {}) {
      // Cursor estável (última chave entregue), como no R2: apagar durante a listagem não pula objetos.
      const all = [...store.keys()].filter((k) => k.startsWith(prefix) && (!cursor || k > cursor)).sort();
      const page = all.slice(0, 2);
      return { objects: page.map((key) => ({ key })), truncated: all.length > 2, cursor: page.at(-1) };
    },
  };
}

export const AGRI = { version: "sh-teste@2026-09-24", chapters: ["01", "02", "09", "12", "17"], excluded: ["03"] };

// Linhas de exportação: CO_PAIS 023 e 025 somam na Alemanha; 249 é EUA; 607 Portugal; 999 sem país.
export const MDIC_ROWS = {
  2026: [
    '"2026";"01";"09011110";"10";"023";"MG";"01";"0817800";19200;19200;101000',
    '"2026";"01";"09011110";"10";"025";"MG";"01";"0817800";100;100;500',
    '"2026";"02";"17011400";"10";"249";"SP";"01";"0817600";50000;50000;21000',
    '"2026";"02";"28353910";"10";"249";"SP";"01";"0817600";10;10;99',
    '"2026";"03";"09011110";"10";"023";"ES";"01";"0727600";300;300;1600',
    '"2026";"03";"12019000";"10";"999";"PR";"01";"0917500";;700000;280000',
  ],
  2025: ['"2025";"12";"09011110";"10";"023";"MG";"01";"0817800";1000;1000;5000'],
};
const NCM_CSV =
  '"CO_NCM";"CO_UNID";"CO_SH6";"NO_NCM_POR";"NO_NCM_ING"\n"09011110";"10";"090111";"Café não torrado";"Coffee, not roasted"\n"17011400";"10";"170114";"Outros açúcares de cana";"Other cane sugar"\n"12019000";"10";"120190";"Soja";"Soya beans"\n';

const rec = (code, hs6, year, partner, value, extra = {}) => ({
  refYear: year, reporterCode: code, flowCode: "M", partnerCode: partner, partner2Code: 0, customsCode: "C00", motCode: 0,
  cmdCode: hs6, cifvalue: value, primaryValue: value, netWgt: value * 2, isNetWgtEstimated: false, qty: value * 2, qtyUnitCode: 8, ...extra,
});
export const COMTRADE = {
  276: { years: [2022, 2023, 2024, 2025], rows: [rec(276, "090111", 2025, 0, 100), rec(276, "090111", 2025, 76, 30), rec(276, "170114", 2024, 0, 50)] },
  842: { years: [2023, 2024, 2025], rows: [rec(842, "170114", 2025, 0, 900), rec(842, "170114", 2025, 76, 0)] },
  620: { years: [2021, 2022, 2023], rows: [rec(620, "090111", 2023, 0, 40), rec(620, "090111", 2023, 76, 10)] },
  156: { years: [], rows: [] },
};
const HS = { results: ["010121", "090111", "090112", "120190", "170114", "170199"].map((id) => ({ id, aggrLevel: 6, text: `${id} - item ${id}` })) };

export function sources(opts = {}) {
  const calls = { comtrade: 0, data: 0, mdicGets: 0, log: [] };
  const etags = { 2026: '"a1"', 2025: '"b1"', ...(opts.etags || {}) };
  const file = (y) => new TextEncoder().encode([HEADER, ...(opts.mdicRows?.[y] ?? MDIC_ROWS[y])].join("\n") + "\n");
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    calls.log.push(u.pathname);
    if (u.host === "mdic.test") {
      if (u.pathname.endsWith("/tabelas/NCM.csv")) return new Response(NCM_CSV, { status: 200, headers: { "content-type": "text/csv" } });
      const y = Number(/EXP_(\d{4})\.csv$/.exec(u.pathname)?.[1]);
      if (!MDIC_ROWS[y] || opts.mdicDown) return new Response(null, { status: opts.mdicDown ? 503 : 404 });
      const bytes = file(y);
      const h = { etag: typeof etags[y] === "function" ? etags[y]() : etags[y], "last-modified": "Fri, 04 Sep 2026 18:05:56 GMT", "content-type": "text/csv" };
      if (init.method === "HEAD") return new Response(null, { status: 200, headers: { ...h, "content-length": String(bytes.length) } });
      calls.mdicGets++;
      const m = /bytes=(\d+)-(\d+)/.exec(init.headers?.Range || "");
      const [a, b] = [Number(m[1]), Math.min(Number(m[2]), bytes.length - 1)];
      return new Response(bytes.slice(a, b + 1), { status: 206, headers: { ...h, "content-range": `bytes ${a}-${b}/${bytes.length}` } });
    }
    if (u.host === "comtrade.test") {
      calls.comtrade++;
      if (u.pathname.endsWith("/HS.json")) return Response.json(HS);
      const code = Number(u.searchParams.get("reporterCode"));
      if (u.pathname.includes("/getDA/")) return Response.json({ count: 0, data: (COMTRADE[code]?.years ?? []).map((period) => ({ period, reporterCode: code, freqCode: "A" })), error: "" });
      calls.data++;
      if (opts.failData?.(code)) return new Response("falhou", { status: opts.failStatus ?? 400 });
      const years = u.searchParams.get("period").split(",").map(Number);
      const block = new Set(u.searchParams.get("cmdCode").split(","));
      const data = (COMTRADE[code]?.rows ?? []).filter((r) => years.includes(r.refYear) && block.has(r.cmdCode));
      return Response.json({ count: data.length, data, error: "" });
    }
    throw new Error("host inesperado " + u.host);
  };
  return { fetchImpl, calls };
}

// Mantém só alguns países para o teste ser rápido (o seed tem 250).
export function keepCountries(DB, list) {
  const inList = list.map((c) => `'${c}'`).join(",");
  DB.raw.exec(`DELETE FROM country_mdic_codes WHERE iso3 NOT IN (${inList}); DELETE FROM countries WHERE iso3 NOT IN (${inList});`);
}

export async function tradeParams(api, over = {}) {
  const values = { agri_classification: AGRI, trade_list_mdic_years: 2, trade_list_comtrade_years: 3, comtrade_calls_per_day: 400, trade_list_retention_versions: 3, country_list_refresh_day: 10, ...over };
  for (const [key, value] of Object.entries(values)) {
    const r = await api(`/api/parameters/${key}`, "PUT", { scope: "international", value, reason: "Parâmetro do teste" });
    if (r.status !== 200) throw new Error(`${key}: ${JSON.stringify(r.data)}`);
  }
}

// Condutor da fila: entrega mensagens até esvaziar (ou até `max`), com relógio e fontes injetados.
export function driver(env, src, clock) {
  const queue = [];
  const deps = { fetch: src.fetchImpl, now: () => clock.at, enqueue: async (msgs) => queue.push(...msgs.map((m) => m.body)) };
  Object.assign(env, { FILES: env.FILES || memoryR2(), MDIC_BULK_BASE: "https://mdic.test/bd", COMTRADE_BASE: "https://comtrade.test", COMTRADE_KEY: env.COMTRADE_KEY ?? "chave-teste", MDIC_CHUNK_BYTES: "150", DEFAULT_TENANT_ID: "eag-internal" });
  return {
    queue,
    deps,
    start: () => startMonthlyRun(env, "eag-internal", deps),
    daily: () => daily(env, "eag-internal", deps),
    sweep: () => sweep(env, deps),
    async drain(max = 5000) {
      let n = 0;
      while (queue.length && n++ < max) {
        const m = queue.shift();
        if (m.type !== "trade_job") throw new Error("tipo inesperado " + m.type);
        await runJob(env, m.jobId, deps);
      }
      return n;
    },
  };
}
