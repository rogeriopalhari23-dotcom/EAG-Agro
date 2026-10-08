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
    };
    if (/^\/fonts\/[a-z0-9-]+\.woff2$/.test(path)) files[path] = [path.slice(1), "font/woff2"];
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
  const MAIN = { Início: "Início", Hoje: "Início", Empresas: "Empresas", Radar: "Radar Nacional", "Radar Nacional": "Radar Nacional", Internacional: "Radar Internacional", "Radar Internacional": "Radar Internacional", Abordagem: "Abordagem", Configurações: "Configurações" };
  const TABS = ["Fichas", "Envios", "Tarefas"];
  const clickNav = async (label) => {
    if (await page.getByRole("button", { name: "Menu" }).isVisible()) await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("navigation").getByRole("button", { name: label, exact: true }).click();
  };
  // Vai para uma tela pelo caminho do usuário: item principal, aba de Abordagem ou cartão de Configurações.
  const nav = async (label) => {
    if (MAIN[label]) return clickNav(MAIN[label]);
    if (TABS.includes(label)) {
      await clickNav("Abordagem");
      await page.getByRole("heading", { name: "Abordagem", exact: true }).waitFor();
      return page.getByRole("tab", { name: label, exact: true }).click();
    }
    await clickNav("Configurações");
    await page.getByRole("heading", { name: "Configurações", exact: true }).waitFor();
    await page.locator(".settings-list button").filter({ has: page.locator("strong", { hasText: new RegExp(`^${label}$`) }) }).click();
  };
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole("heading", { name: "Início", exact: true }).waitFor();
  await mkdir("review-output", { recursive: true });
  await page.screenshot({
    path: "review-output/hoje-desktop.png",
    fullPage: true,
  });
  await nav("Empresas");
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
  // D-EXC: aviso da empresa (sem identidade) aparece na tela da empresa com ou sem tarefa aberta, inclusive depois que a
  // última tarefa é encerrada. Aviso e tarefa fictícios, gravados direto no banco de teste.
  {
    const uiCo = ctx.DB.raw.prepare("SELECT id FROM companies WHERE legal_name='Empresa de teste UI'").get().id;
    ctx.DB.raw
      .prepare("INSERT INTO company_notices(id,tenant_id,company_id,kind,classification,source_kind,reason,pending,created_by,request_id) VALUES ('nt-ui','eag-internal',?,'erasure_shared_phone','unconfirmed','not_informed','not_classified',1,'teste','ui')")
      .run(uiCo);
    // Reabre a empresa pelo caminho do usuário (Empresas → Abrir), que busca os dados de novo.
    const refresh = async () => {
      if (await page.locator("dialog.drawer[open]").count()) await page.keyboard.press("Escape");
      await nav("Empresas");
      await page.locator(".row", { hasText: "Empresa de teste UI" }).getByRole("button", { name: "Abrir", exact: true }).first().click();
      await page.locator("dialog.drawer[open]").waitFor();
    };
    const noticeVisible = () => page.locator("dialog.drawer[open]").getByText(/^Aviso \(\d{4}-\d{2}-\d{2}\): Pedido de exclusão de uma pessoa desta empresa/).first().waitFor({ timeout: 8000 });
    await refresh();
    await noticeVisible(); // sem tarefa nenhuma
    ctx.DB.raw.prepare("INSERT INTO tasks(id,tenant_id,company_id,commodity,kind,owner_id,due_date,priority,script) VALUES ('tk-ui','eag-internal',?,'corn','call_l0','system-admin','2099-01-05',0,'ANTES DE LIGAR: teste')").run(uiCo);
    await refresh();
    await noticeVisible(); // com tarefa aberta
    ctx.DB.raw.prepare("UPDATE tasks SET status='done',done_at='2099-01-05T12:00:00Z' WHERE id='tk-ui'").run();
    await refresh();
    await noticeVisible(); // depois de encerrar a última tarefa
    await page.getByText(/classificação não confirmada \(tratado como compartilhado; não prova que o número é comercial\) · pendente/).first().waitFor({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await page.locator("dialog.drawer[open]").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  }
  for (const label of [
    "Campanhas",
    "Catálogo",
    "Parâmetros",
    "Supressão",
    "Pausas",
  ]) {
    await nav(label);
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
    assert.equal(
      await page.locator("#content .error").filter({ visible: true }).count(),
      0,
    );
  }
  // P1-T7: ficha do produto e código pendente pelo formulário do admin.
  const form = (summary) =>
    page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: summary }) })
      .locator("form");
  await nav("Catálogo");
  await page
    .locator(".row")
    .filter({ hasText: "ICUMSA 45" })
    .getByRole("button", { name: "Abrir" })
    .click();
  await page.getByRole("heading", { name: "ICUMSA 45", exact: true }).waitFor();
  await page.locator("summary", { hasText: "Cadastrar código" }).click();
  const codeForm = form("Cadastrar código");
  await codeForm.getByLabel("Código", { exact: true }).fill("1701.14.00");
  await codeForm.getByLabel("Motivo", { exact: true }).fill("Código em apuração no teste de interface");
  await codeForm.getByRole("button", { name: "Registrar código" }).click();
  await page.getByText("NCM 17011400", { exact: true }).waitFor();
  // P1-T8: parâmetros mostram pendências sem valor inventado (a janela de envio foi aprovada em 2026-09-25).
  await nav("Parâmetros");
  await page
    .locator(".row")
    .filter({ hasText: "Revisão de campanha (dias)" })
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
    .getByRole("button", { name: "Abrir" })
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
  for (const label of ["Radar Nacional", "Fichas", "Envios", "Tarefas"]) {
    await nav(label);
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
    assert.equal(await page.locator("#content .error").filter({ visible: true }).count(), 0, label);
  }
  await nav("Envios");
  await page.getByText(/^Teste interno: só destinatários internos/).waitFor();
  await page.locator(".row").filter({ hasText: "Doces Vale Verde" }).first().waitFor();
  await nav("Fichas");
  await page.locator(".row").filter({ hasText: "Doces Vale Verde" }).getByRole("button", { name: /^(Abrir|Revisar e aprovar)$/ }).click();
  await page.getByRole("heading", { name: "Revisor PV", exact: true }).waitFor();
  await page.getByText(/^Aprovado por /).first().waitFor();
  await page.screenshot({ path: "review-output/ficha-desktop.png", fullPage: true });
  await nav("Setores e CNAE");
  await page.getByRole("heading", { name: "Setores usuários → CNAE", exact: true }).waitFor();
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM send_log").get().n, 0);
  assert.ok(p.fichaId);
  // P3-T11: lista mensal gerada com fontes simuladas; análise da Alemanha e seleção pela tela.
  keepCountries(ctx.DB, ["DEU", "USA", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const d = driver(ctx.env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  // Radar Internacional: lista básica de países importadores → resumo curto → commodity → busca de empresas.
  await nav("Radar Internacional");
  await page.getByRole("heading", { name: "Radar Internacional", exact: true }).waitFor();
  // Resumo do MDIC publicado pelo Worker nesta rotina: o admin prepara na hora (o cron diário também faria).
  await page.getByRole("button", { name: "Preparar agora" }).click();
  await page.getByText(/resumo\(s\) preparados/).waitFor();
  await page.getByRole("searchbox", { name: "Buscar país" }).fill("Alemanha");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const deuRow = page.locator(".row").filter({ hasText: "Alemanha (DEU)" });
  await deuRow.getByText(/MDIC — exportações do Brasil \(FOB\) · 2025-04 a 2026-03 · Café não torrado/).waitFor();
  await deuRow.getByRole("button", { name: "Escolher" }).click();
  await page.getByRole("heading", { name: "Alemanha · resumo", exact: true }).waitFor();
  await page.getByText("Há importações de commodities agrícolas do Brasil identificadas.", { exact: false }).waitFor();
  await page.getByText("O dado confirma exportação do Brasil para o país; não comprova compra por nenhuma empresa específica.").first().waitFor();
  await page.getByText(/^Tabela completa/).click();
  await page.getByText(/parte do Brasil 30\.0%/).waitFor();
  await page.screenshot({ path: "review-output/analise-desktop.png", fullPage: true });
  await page.getByRole("checkbox", { name: "Selecionar 090111" }).first().check();
  await page.getByRole("button", { name: "Escolher commodity" }).click();
  await page.getByLabel(/Produto para 090111/).selectOption("product-05");
  await page.getByRole("button", { name: "Registrar seleção" }).click();
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM campaigns WHERE market='international' AND selection_id IS NOT NULL AND country_code='DE'").get().n, 1);
  await page.getByRole("button", { name: "Autorizar busca de empresas" }).click();
  await page.getByRole("heading", { name: /^Alemanha · / }).waitFor();
  await page.getByText(/porte-alvo: Pequena e Média/).waitFor();
  await page.getByText(/^Sem empresas importadoras ainda em: consumidoras finais, fábricas e processadoras; perfil a confirmar; traders e distribuidores/).waitFor();
  await page.getByRole("heading", { name: "Descobrir empresas (fontes gratuitas)" }).waitFor();
  await page.getByText("Registrar empresa encontrada").click();
  await page.getByLabel("Razão social").fill("Kleine Rösterei GmbH");
  await page.getByLabel("Onde foi encontrada (fonte)").fill("Europages — torrefações");
  await page.getByRole("button", { name: "Registrar empresa" }).click();
  // Cadastro manual sem sinal próprio de importação: não é candidata importadora até ser validada.
  const unverified = page.locator("details").filter({ has: page.locator("summary", { hasText: /^Importação não verificada — usam a commodity, sem sinal próprio de importação \(1\)/ }) });
  assert.equal(await unverified.evaluate((d) => d.open), true, "sem importadoras, a lista não verificada abre sozinha");
  await page.getByText("empresa encontrada — importação não verificada").first().waitFor();
  await page.getByText(/^Próximo passo: /).first().waitFor();
  await unverified.getByText("Detalhes, evidências e pessoas").click();
  // Validação assistida: sinal próprio de importação registrado no cartão → sobe para "Importadoras".
  await page.getByText("Registrar sinal ou prova de importação").click();
  await page.getByLabel("O que diz (referência)").fill("Site da empresa: 'importamos café verde de Santos'");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await page.getByRole("heading", { name: "Importadoras — perfil a confirmar (1)" }).waitFor();
  await page.getByText(/potencial compradora/).first().waitFor();
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM company_conditions WHERE status='confirmed'").get().n, 0, "indício não confirma");
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM foreign_search_candidates").get().n, 1);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM company_conditions WHERE status='confirmed'").get().n, 0, "nenhuma condição preenchida pelo dado do país");
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
  await nav("Radar Internacional");
  await page.getByRole("heading", { name: "Radar Internacional", exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Radar Internacional sem rolagem horizontal em 390 px");
  await nav("Início");
  await page.getByRole("heading", { name: "Início", exact: true }).waitFor();
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
    "UI smoke OK (redesign): navegação em 6 itens + Configurações e abas de Abordagem; cadastro, demanda, gate, catálogo, parâmetros, ICP, Radar Nacional, Fichas, Envios, Tarefas, Radar Internacional (países, resumo, seleção, busca e cartão compacto), Lista mensal, 390 px com menu, sem erros JS.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  ctx.close();
}
