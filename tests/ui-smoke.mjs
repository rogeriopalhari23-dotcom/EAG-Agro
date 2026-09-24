import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { setup } from "./helpers/db.mjs";
import { pilot } from "./helpers/pilot.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import worker from "../src/worker.js";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Optional QA dependencies live outside the product; see docs/revisao/RELATORIO.md.
const { chromium } = require(process.env.EAG_PLAYWRIGHT_PATH || "playwright");
const chrome = process.env.EAG_CHROMIUM_PACKAGE
  ? (await import(process.env.EAG_CHROMIUM_PACKAGE)).default
  : null;
const ctx = setup();
ctx.env.ASSETS = {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const files = {
      "/": ["index.html", "text/html"],
      "/app.js": ["app.js", "text/javascript"],
      "/app.css": ["app.css", "text/css"],
      "/fonts/roboto-latin-400-normal.woff2": ["fonts/roboto-latin-400-normal.woff2", "font/woff2"],
      "/fonts/barlow-condensed-latin-700-normal.woff2": ["fonts/barlow-condensed-latin-700-normal.woff2", "font/woff2"],
    };
    if (!files[path]) return new Response("Not found", { status: 404 });
    return new Response(
      await readFile(new URL("../public/" + files[path][0], import.meta.url)),
      { headers: { "content-type": files[path][1] } },
    );
  },
};
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const request = new Request(
      `http://127.0.0.1:${server.address().port}${req.url}`,
      {
        method: req.method,
        headers: req.headers,
        body: body.length ? body : undefined,
      },
    );
    const response = await worker.fetch(request, ctx.env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  ...(process.env.EAG_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.EAG_CHROMIUM_EXECUTABLE }
    : chrome
      ? { executablePath: await chrome.executablePath() }
      : {}),
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole("heading", { name: "Hoje", exact: true }).waitFor();
  await mkdir("review-output", { recursive: true });
  await page.screenshot({
    path: "review-output/hoje-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Empresas", exact: true })
    .click();
  await page.getByText("Cadastrar empresa", { exact: true }).first().click();
  const cf = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Cadastrar empresa" }) })
    .locator("form");
  await cf.getByLabel("Razão social").fill("Empresa de teste UI");
  await cf.getByLabel("Fonte do cadastro").fill("Teste automatizado");
  await cf
    .getByRole("button", { name: "Cadastrar empresa", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Empresa de teste UI", exact: true })
    .waitFor();
  await page.getByText("Nova demanda", { exact: true }).click();
  const df = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Nova demanda" }) })
    .locator("form");
  const row = df
    .locator(".demand-field")
    .filter({ has: page.getByLabel("Produto / descrição", { exact: true }) });
  await row.getByLabel("Produto / descrição", { exact: true }).fill("Soja GMO");
  await row.getByLabel("Estado", { exact: true }).selectOption("confirmed");
  await row.getByLabel("Fonte da confirmação").fill("Documento de teste UI");
  await df.getByLabel("Volume por operação", { exact: true }).fill("250");
  await df.getByLabel("Operações por ano", { exact: true }).fill("12");
  await df.getByRole("button", { name: "Criar demanda", exact: true }).click();
  await page
    .getByText(
      "Nacional · Demanda v1 · 6.67% dos campos aplicáveis confirmados",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    ctx.DB.raw
      .prepare(
        "SELECT value_json FROM demand_fields WHERE field_key='operations_per_year'",
      )
      .get().value_json,
    "12",
  );
  await page
    .getByRole("button", { name: "Calcular scores e verificar gate" })
    .click();
  await page.getByText("Pendências de qualificação", { exact: true }).waitFor();
  await page.screenshot({
    path: "review-output/empresa-desktop.png",
    fullPage: true,
  });
  for (const label of [
    "Campanhas",
    "Catálogo",
    "Parâmetros",
    "Supressão",
    "Pausas",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: label, exact: true })
      .click();
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
    assert.equal(
      await page.locator("#content .error").filter({ visible: true }).count(),
      0,
    );
  }
  // P1-T7: ficha do produto e código pendente pelo formulário do admin.
  const nav = (label) =>
    page.getByRole("navigation").getByRole("button", { name: label, exact: true }).click();
  const form = (summary) =>
    page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: summary }) })
      .locator("form");
  await nav("Catálogo");
  await page
    .locator(".row")
    .filter({ hasText: "ICUMSA 45" })
    .getByRole("button", { name: "Detalhes" })
    .click();
  await page.getByRole("heading", { name: "ICUMSA 45", exact: true }).waitFor();
  await page.locator("summary", { hasText: "Cadastrar código" }).click();
  const codeForm = form("Cadastrar código");
  await codeForm.getByLabel("Código", { exact: true }).fill("1701.14.00");
  await codeForm.getByLabel("Motivo", { exact: true }).fill("Código em apuração no teste de interface");
  await codeForm.getByRole("button", { name: "Registrar código" }).click();
  await page.getByText("NCM 17011400", { exact: true }).waitFor();
  // P1-T8: parâmetros mostram pendências sem valor inventado.
  await nav("Parâmetros");
  await page
    .locator(".row")
    .filter({ hasText: "Janela de envio no fuso do destinatário" })
    .getByText("Pendente", { exact: true })
    .waitFor();
  // P1-T9: campanha com edição de ICP versionada.
  await nav("Campanhas");
  await page.locator("summary", { hasText: "Criar campanha" }).click();
  const cform = form("Criar campanha");
  await cform.getByLabel("Nome", { exact: true }).fill("Açúcar interior UI");
  await cform.getByLabel("Produto", { exact: true }).selectOption("product-06");
  await cform.getByLabel("Cidade de origem nacional").fill("Sertãozinho");
  await cform.getByLabel("UF nacional").fill("SP");
  await cform.getByLabel("Setores usuários, separados por vírgula").fill("balas");
  await cform.getByLabel("Região do cliente ideal").fill("SP");
  await cform.getByLabel("Cargo decisor").fill("Compras");
  await cform.getByLabel("Cargo influenciador").fill("Qualidade");
  await cform.getByRole("button", { name: "Criar campanha" }).click();
  await page
    .locator(".row")
    .filter({ hasText: "Açúcar interior UI" })
    .getByRole("button", { name: "Detalhes" })
    .click();
  await page.locator("summary", { hasText: "Editar ICP" }).click();
  const icpForm = form("Editar ICP");
  await icpForm.getByLabel("Setores usuários, separados por vírgula").fill("balas, chocolates");
  await icpForm.getByRole("button", { name: "Salvar ICP" }).click();
  await page.getByText("balas, chocolates", { exact: true }).waitFor();
  assert.equal(
    ctx.DB.raw.prepare("SELECT version FROM campaigns WHERE name='Açúcar interior UI'").get().version,
    2,
  );
  await page.screenshot({ path: "review-output/campanha-desktop.png", fullPage: true });
  // P2-T18: telas do piloto com o cenário aprovado (ficha, fila e tarefas); nenhuma tela envia.
  const p = await pilot(ctx);
  for (const label of ["Radar", "Fichas", "Envios", "Tarefas"]) {
    await nav(label);
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
    assert.equal(await page.locator("#content .error").filter({ visible: true }).count(), 0, label);
  }
  await nav("Envios");
  await page.getByText("Teste interno", { exact: true }).waitFor();
  await page.locator(".row").filter({ hasText: "Doces Vale Verde" }).first().waitFor();
  await nav("Fichas");
  await page.locator(".row").filter({ hasText: "Doces Vale Verde" }).getByRole("button", { name: "Abrir" }).click();
  await page.getByRole("heading", { name: "Revisor PV", exact: true }).waitFor();
  await page.getByText(/^Aprovado por /).first().waitFor();
  await page.screenshot({ path: "review-output/ficha-desktop.png", fullPage: true });
  await nav("Radar");
  await page.getByRole("heading", { name: "Setores usuários → CNAE", exact: true }).waitFor();
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM send_log").get().n, 0);
  assert.ok(p.fichaId);
  // P3-T11: lista mensal gerada com fontes simuladas; análise da Alemanha e seleção pela tela.
  keepCountries(ctx.DB, ["DEU", "USA", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const d = driver(ctx.env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  await nav("Internacional");
  await page.getByRole("heading", { name: "Internacional", exact: true }).waitFor();
  await page.getByRole("searchbox", { name: "Buscar país" }).fill("Alemanha");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.locator(".row").filter({ hasText: "Alemanha (DEU)" }).getByRole("button", { name: "Analisar" }).click();
  await page.getByRole("heading", { name: "Alemanha · análise", exact: true }).waitFor();
  await page.getByText("O dado confirma exportação do Brasil para o país; não comprova compra por nenhuma empresa específica.").first().waitFor();
  await page.getByText(/parte do Brasil 30\.0%/).waitFor();
  await page.screenshot({ path: "review-output/analise-desktop.png", fullPage: true });
  await page.getByRole("checkbox", { name: "Selecionar 090111" }).check();
  await page.getByRole("button", { name: "Escolher commodities" }).click();
  await page.getByLabel(/Produto para 090111/).selectOption("product-05");
  await page.getByRole("button", { name: "Registrar seleção e criar campanhas" }).click();
  await page.getByRole("heading", { name: "Campanhas", exact: true }).waitFor();
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM campaigns WHERE market='international' AND selection_id IS NOT NULL AND country_code='DE'").get().n, 1);
  await page.screenshot({ path: "review-output/internacional-desktop.png", fullPage: true });
  await nav("Lista mensal");
  await page.getByRole("heading", { name: "Lista mensal", exact: true }).waitFor();
  await page.getByText("2026-10", { exact: true }).waitFor();
  assert.equal(await page.locator("#content .error").filter({ visible: true }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await nav("Internacional");
  await page.getByRole("heading", { name: "Internacional", exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Internacional sem rolagem horizontal em 390 px");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Hoje", exact: true })
    .click();
  await page.getByRole("heading", { name: "Hoje", exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.screenshot({
    path: "review-output/hoje-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "UI smoke OK: cadastro, demanda, gate, catálogo, parâmetros, ICP, Radar, Fichas, Envios, Tarefas, Internacional (análise e seleção), Lista mensal, 13 telas e viewport 390 px, sem erros JS.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  ctx.close();
}
