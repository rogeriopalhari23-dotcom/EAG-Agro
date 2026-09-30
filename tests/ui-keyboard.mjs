// Teclado (redesign): pular para o conteúdo, navegação principal, abas e painel lateral com Esc. Ferramenta de validação local.
// Uso: EAG_PLAYWRIGHT_PATH=<playwright> EAG_CHROMIUM_EXECUTABLE=<chrome> PREVIEW_URL=<url da prévia> node tests/ui-keyboard.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EAG_PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true, ...(process.env.EAG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.EAG_CHROMIUM_EXECUTABLE } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const active = () => page.evaluate(() => ({ tag: document.activeElement.tagName, text: (document.activeElement.textContent || "").trim().slice(0, 40), id: document.activeElement.id }));
try {
  await page.goto(process.env.PREVIEW_URL);
  await page.getByRole("heading", { name: "Início", exact: true }).waitFor();
  // Ao carregar, o foco vai para o conteúdo (leitores de tela); o atalho vale a partir do topo do documento.
  const first = await page.evaluate(() => document.querySelector("a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex=\"-1\"])").textContent.trim());
  assert.equal(first, "Pular para o conteúdo", "atalho é o primeiro item focável");
  await page.locator(".skip").focus();
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".skip")).top), "12px", "atalho aparece ao receber foco");
  await page.keyboard.press("Enter");
  assert.equal((await active()).id, "content", "atalho leva ao conteúdo");
  // Navegação principal alcançável e acionável pelo teclado.
  await page.getByRole("navigation").getByRole("button", { name: "Início", exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal((await active()).text, "Radar Nacional");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Radar Nacional", exact: true }).waitFor();
  // Foco visível: contorno aplicado ao elemento focado.
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.ok(["solid", "auto"].includes(outline) || (await active()).id === "content", `contorno de foco: ${outline}`);
  await page.getByRole("button", { name: "Ver compradores" }).first().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: /^Compradores em até/ }).waitFor();
  await page.getByRole("button", { name: "Abrir", exact: true }).first().focus();
  await page.keyboard.press("Enter");
  await page.locator("dialog.drawer[open]").waitFor();
  const inDialog = await page.evaluate(() => !!document.activeElement.closest("dialog.drawer"));
  assert.ok(inDialog, "foco dentro do painel lateral");
  await page.keyboard.press("Escape");
  await page.locator("dialog.drawer").waitFor({ state: "detached" });
  // Abas de Abordagem pelo teclado.
  await page.getByRole("navigation").getByRole("button", { name: "Abordagem", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("tab", { name: "Envios" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Envios", exact: true }).waitFor();
  // Celular: menu abre, recebe foco e fecha com Esc.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu" }).focus();
  await page.keyboard.press("Enter");
  assert.equal((await active()).text, "Início", "menu aberto leva o foco ao primeiro item");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.getElementById("app").classList.contains("nav-open")), false, "Esc fecha o menu");
  console.log("Teclado OK: atalho, navegação, foco visível, painel lateral (Esc), abas e menu no celular.");
} finally {
  await browser.close();
}
