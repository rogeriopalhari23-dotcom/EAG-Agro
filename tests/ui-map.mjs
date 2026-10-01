// Mapa real do Radar Nacional (redesign): carrega com a política de segurança da produção, sem requisição a outra
// origem, mostra raio e compradores, aceita zoom e abre a empresa pelo ponto. Desktop e 390 px.
// Uso: EAG_PLAYWRIGHT_PATH=<playwright> EAG_CHROMIUM_EXECUTABLE=<chrome> PREVIEW_URL=<url da prévia> node tests/ui-map.mjs [pasta-de-capturas]
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EAG_PLAYWRIGHT_PATH || "playwright");
const base = process.env.PREVIEW_URL;
const out = process.argv[2] || "review-output/mapa";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"], ...(process.env.EAG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.EAG_CHROMIUM_EXECUTABLE } : {}) });
const results = [];
try {
  for (const [width, height, suffix] of [
    [1440, 900, "desktop"],
    [390, 844, "celular"],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const problems = [];
    const external = [];
    let tileRequests = 0;
    page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && problems.push(m.text()));
    page.on("pageerror", (e) => problems.push(e.message));
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (!["127.0.0.1", "localhost"].includes(u.hostname) && !u.protocol.startsWith("blob") && !u.protocol.startsWith("data")) external.push(r.url());
      if (u.pathname === "/api/mapa/brasil.pmtiles") tileRequests++;
    });
    await page.goto(base);
    await page.getByRole("heading", { name: "Início", exact: true }).waitFor();
    if (width < 860) await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("navigation").getByRole("button", { name: "Radar Nacional", exact: true }).click();
    await page.getByRole("button", { name: "Ver compradores" }).first().click();
    await page.getByRole("heading", { name: /^Compradores em até/ }).waitFor();
    const canvas = page.locator(".map-canvas[data-ready=true]");
    await canvas.waitFor({ timeout: 30000 });
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".map-canvas").mapInstance.loaded(), null, { timeout: 30000 });
    await page.waitForTimeout(800);
    // Atribuição obrigatória visível.
    await page.locator(".maplibregl-ctrl-attrib").getByRole("link", { name: "OpenStreetMap" }).waitFor();
    assert.ok(await page.locator(".maplibregl-ctrl-attrib").isVisible(), "atribuição visível");
    // Raio e compradores desenhados (camadas com feições).
    const state = await page.evaluate(() => {
      const m = document.querySelector(".map-canvas").mapInstance;
      return { buyers: m.querySourceFeatures("compradores").length, radius: !!m.getLayer("raio-line"), zoom: m.getZoom(), basemap: m.querySourceFeatures("protomaps", { sourceLayer: "places" }).length + m.querySourceFeatures("protomaps", { sourceLayer: "roads" }).length };
    });
    assert.ok(state.buyers >= 3, `compradores no mapa: ${state.buyers}`);
    assert.ok(state.radius, "raio desenhado");
    assert.ok(state.basemap > 0, "ladrilhos do mapa de fundo carregados");
    await page.screenshot({ path: `${out}/radar-mapa-${suffix}.png`, fullPage: true });
    // Zoom pelo botão.
    await page.getByRole("button", { name: /Zoom in|Aproximar|Ampliar/i }).click();
    await page.waitForTimeout(700);
    const zoomAfter = await page.evaluate(() => document.querySelector(".map-canvas").mapInstance.getZoom());
    assert.ok(zoomAfter > state.zoom + 0.5, `zoom aumentou (${state.zoom.toFixed(2)} → ${zoomAfter.toFixed(2)})`);
    await page.evaluate(() => document.querySelector(".map-canvas").mapInstance.zoomOut({ duration: 0 }));
    // Clique num comprador abre o resumo e leva ao painel da empresa.
    const pt = await page.evaluate(() => {
      const m = document.querySelector(".map-canvas").mapInstance;
      const f = m.querySourceFeatures("compradores")[0];
      const p = m.project(f.geometry.coordinates);
      const r = m.getCanvas().getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y, name: f.properties.name };
    });
    await page.mouse.click(pt.x, pt.y);
    const pop = page.locator(".maplibregl-popup .map-pop");
    await pop.waitFor();
    await page.screenshot({ path: `${out}/radar-mapa-ponto-${suffix}.png` });
    await pop.getByRole("button", { name: "Abrir" }).click();
    await page.locator("dialog.drawer .drawer-body h1").waitFor();
    await page.keyboard.press("Escape");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, "sem rolagem horizontal");
    assert.deepEqual(problems, [], "sem violação de CSP nem erro de página");
    assert.deepEqual(external, [], "nenhuma requisição a outra origem");
    results.push({ suffix, buyers: state.buyers, zoom: [Number(state.zoom.toFixed(2)), Number(zoomAfter.toFixed(2))], tileRequests, popup: pt.name });
    await page.close();
  }
  console.log("Mapa OK:", JSON.stringify(results));
} finally {
  await browser.close();
}
