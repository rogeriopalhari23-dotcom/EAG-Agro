// Prévia visual do redesign (ferramenta de desenvolvimento; não faz parte da suíte). Sobe o Worker real com D1 em memória,
// semeia dados de TESTE (empresas fictícias do ambiente de teste, nunca produção) e captura as telas em desktop e 390 px.
// Uso: EAG_PLAYWRIGHT_PATH=<playwright> EAG_CHROMIUM_EXECUTABLE=<chrome> node tests/ui-preview.mjs [pasta-de-saída]
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { setup } from "./helpers/db.mjs";
import { pilot } from "./helpers/pilot.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import worker from "../src/worker.js";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EAG_PLAYWRIGHT_PATH || "playwright");
const out = process.argv[2] || "review-output/depois";
await mkdir(out, { recursive: true });
const ctx = setup();
const types = { html: "text/html", js: "text/javascript", css: "text/css", woff2: "font/woff2" };
ctx.env.ASSETS = {
  async fetch(request) {
    let path = new URL(request.url).pathname;
    if (path === "/") path = "/index.html";
    try {
      return new Response(await readFile(new URL("../public" + path, import.meta.url)), { headers: { "content-type": types[path.split(".").pop()] || "application/octet-stream" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },
};
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const r = await worker.fetch(new Request(`http://127.0.0.1:${server.address().port}${req.url}`, { method: req.method, headers: req.headers, body: body.length ? body : undefined }), ctx.env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise((r) => server.listen(Number(process.env.PREVIEW_PORT || 0), "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// ---- Dados de teste ----
const { api, DB } = ctx;
const p = await pilot(ctx);
const campaign = DB.raw.prepare("SELECT id FROM campaigns WHERE market='national' AND status='active' LIMIT 1").get().id;
const cnpj = (seed) => {
  const n = String(seed).padStart(8, "0").slice(0, 8).split("").map(Number).concat([0, 0, 0, 1]);
  const dv = (arr) => {
    const w = arr.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = arr.reduce((a, d, i) => a + d * w[i], 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  n.push(dv(n));
  n.push(dv(n));
  return n.join("");
};
const origin = { lat: -21.1378, lon: -47.9903 };
const units = [
  ["Balas Pontal Indústria Ltda. (teste)", 3540200, "Pontal", -21.0216, -48.0423, "address", 14.1, "05"],
  ["Confeitaria Jaboticabal S.A. (teste)", 3524303, "Jaboticabal", -21.2549, -48.3226, "municipality_centroid", 37.0, "03"],
  ["Doces Ribeirão Alimentos (teste)", 3543402, "Ribeirão Preto", -21.1775, -47.8103, "address", 19.1, "01"],
  ["Chocolates Batatais Ltda. (teste)", 3505906, "Batatais", -20.8911, -47.5921, "municipality_centroid", 49.6, "05"],
];
const unitIds = [];
for (const [i, [name, ibge, city, lat, lon, prec, , size]] of units.entries()) {
  const co = await api("/api/companies", "POST", { legalName: name, countryCode: "BR", registrationId: cnpj(40000000 + i * 7919), registrationIdType: "CNPJ", sourceLabel: "prévia de interface (teste)" });
  const uid = `prev-u${i}`;
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,trade_name,municipality_ibge,municipality_name,uf,lat,lon,geo_precision,size_code,size_label,source_label,consulted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(uid, "eag-internal", co.data.id, cnpj(40000000 + i * 7919), name.replace(/ \(teste\)$/, ""), ibge, city, "SP", lat, lon, prec, size, size === "05" ? "Demais" : size === "03" ? "Pequena" : "Micro", "prévia", "2026-09-30");
  unitIds.push(uid);
}
DB.raw.prepare("INSERT INTO searches(id,tenant_id,campaign_id,version,origin_ibge,origin_lat,origin_lon,origin_precision,radius_km,cnae_codes_json,source_versions_json,status,candidates_count,request_key,created_by) VALUES ('prev-s1','eag-internal',?,1,3551702,?,?,'municipality_centroid',100,'[]','{}','complete',?,'previa','system-admin')").run(campaign, origin.lat, origin.lon, units.length);
units.forEach(([, , , , , prec, dist], i) => DB.raw.prepare("INSERT INTO search_candidates(search_id,unit_id,distance_km,distance_basis,inside_radius) VALUES ('prev-s1',?,?,?,?)").run(unitIds[i], dist, prec === "address" ? "address" : "municipality_centroid", prec === "address" ? "confirmed" : "estimated"));

// Internacional: lista mensal simulada, análise da Alemanha, seleção de café e busca de empresas com uma candidata.
keepCountries(DB, ["DEU", "USA", "CHN"]);
await tradeParams(api, { period_default_months: 12 });
const d = driver(ctx.env, sources(), { at: "2026-10-10T12:00:00.000Z" });
await d.start();
await d.drain();
await api("/api/radar/importers/summaries/rebuild", "POST", {});
const a = (await api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
const sel = (await api(`/api/country-analyses/${a.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] })).data;
const fs1 = sel.campaigns?.[0] ? (await api(`/api/campaigns/${sel.campaigns[0].id}/foreign-search`, "POST", { confirm: true })).data : null;
if (fs1) {
  await api(`/api/foreign-searches/${fs1.id}/candidates`, "POST", { legalName: "Kleine Rösterei GmbH (teste)", sourceLabel: "Europages — torrefações (teste)", activityText: "Torrefação de café", activitySource: "site da empresa (teste)", confirmDistinct: true });
}

// ---- Capturas ----
const browser = await chromium.launch({ headless: true, ...(process.env.EAG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.EAG_CHROMIUM_EXECUTABLE } : {}) });
const errors = [];
async function shots(width, height, suffix) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/favicon|status of 404/.test(m.text()) && errors.push(m.text()));
  const nav = async (label) => {
    if (width < 860) {
      await page.getByRole("button", { name: "Menu" }).click();
    }
    await page.getByRole("navigation").getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("heading", { name: label, exact: true }).first().waitFor();
  };
  const snap = async (name) => {
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) errors.push(`${name}-${suffix}: rolagem horizontal`);
    await page.screenshot({ path: `${out}/${name}-${suffix}.png`, fullPage: true });
  };
  await page.goto(base);
  await page.getByRole("heading", { name: "Início", exact: true }).waitFor();
  await snap("inicio");
  if (width < 860) {
    await page.getByRole("button", { name: "Menu" }).click();
    await snap("menu-aberto");
    await page.keyboard.press("Escape");
  }
  await nav("Radar Nacional");
  await snap("radar-nacional");
  await page.getByRole("button", { name: "Ver compradores" }).first().click();
  await page.getByRole("heading", { name: /^Compradores em até/ }).waitFor();
  await snap("radar-resultado");
  await page.getByRole("button", { name: "Abrir", exact: true }).first().click();
  await page.locator("dialog.drawer .drawer-body h1").waitFor();
  await snap("empresa-painel");
  await page.keyboard.press("Escape");
  await nav("Radar Internacional");
  await snap("radar-internacional");
  if (fs1) {
    await page.getByRole("button", { name: "Abrir", exact: true }).first().click();
    await page.getByRole("heading", { name: /^Alemanha · / }).waitFor();
    await snap("busca-internacional");
  }
  await nav("Empresas");
  await snap("empresas");
  await nav("Abordagem");
  await snap("abordagem-fichas");
  await page.getByRole("tab", { name: "Envios" }).click();
  await page.getByRole("heading", { name: "Envios", exact: true }).waitFor();
  await snap("abordagem-envios");
  await nav("Configurações");
  await snap("configuracoes");
  await page.close();
}
try {
  await shots(1440, 900, "desktop");
  await shots(390, 844, "celular");
  console.log(JSON.stringify({ ok: errors.length === 0, errors, out }));
  if (process.env.PREVIEW_KEEP) {
    console.log(`Prévia em ${base} (Ctrl+C para encerrar)`);
    await new Promise(() => {});
  }
} finally {
  await browser.close();
  server.close();
  ctx.close();
}
