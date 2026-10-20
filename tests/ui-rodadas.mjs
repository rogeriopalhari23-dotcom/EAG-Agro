// Verificação de ponta a ponta da tela Rodadas num navegador real (Chrome headless pelo protocolo de depuração, sem
// dependências). Worker local com banco em memória (todas as migrações) e Receita simulada; nada sai para a rede além
// do próprio navegador falando com o servidor local. Opcional (fora do npm run check):
//   node tests/ui-rodadas.mjs [captura.png]   (CHROME_PATH para outro executável)
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import worker from "../src/worker.js";

const shotPath = process.argv[2] ?? null;
const ctx = setup();
const realFetch = globalThis.fetch;
// O Worker só pode consultar a Receita simulada; qualquer outra saída é erro.
const REG = { "11111111000191": "Rio Verde", "22222222000191": "Jataí" };
globalThis.fetch = async (url, init) => {
  const m = /publica\.cnpj\.ws\/cnpj\/(\d{14})/.exec(String(url));
  if (m && REG[m[1]]) return Response.json({ razao_social: `EMPRESA ${m[1]}`, estabelecimento: { situacao_cadastral: "Ativa", cidade: { nome: REG[m[1]] }, estado: { sigla: "GO" } } });
  if (m) return new Response("{}", { status: 404 });
  if (/^http:\/\/127\.0\.0\.1:9334\//.test(String(url))) return realFetch(url, init);
  throw new Error(`rede inesperada: ${url}`);
};
ctx.env.ASSETS = {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const files = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/app.css": ["app.css", "text/css"] };
    if (/^\/fonts\/[a-z0-9-]+\.woff2$/.test(path)) files[path] = [path.slice(1), "font/woff2"];
    if (!files[path]) return new Response("Not found", { status: 404 });
    return new Response(await readFile(new URL("../public/" + files[path][0], import.meta.url)), { headers: { "content-type": files[path][1] } });
  },
};
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const response = await worker.fetch(new Request(`http://127.0.0.1:${server.address().port}${req.url}`, { method: req.method, headers: req.headers, body: body.length ? body : undefined }), ctx.env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const dir = await mkdtemp(join(tmpdir(), "eag-ui-rodadas-"));
const csvPath = join(dir, "candidatas.csv");
await writeFile(csvPath, ["cnpj;nome;municipio;uf;segmento;fonte_url;evidence_kind;evidence_strength;trecho", "22.222.222/0001-91;Beta Rações;Jataí;GO;feed_mill;https://beta.example;operation;own_source;fábrica em operação", "99.999.999/0001-91;Ômega Grãos;Rio Verde;GO;;;;;"].join("\n"));

const chrome = spawn(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--remote-debugging-port=9334", `--user-data-dir=${join(dir, "perfil")}`, "--window-size=1280,900", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(500);
  try { target = (await (await realFetch("http://127.0.0.1:9334/json/list")).json()).find((t) => t.type === "page"); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let n = 0;
const pending = new Map(), errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "erro no navegador");
  return r.result?.result?.value;
};
const until = async (expr, what, ms = 10000) => {
  for (let t = 0; t < ms; t += 200) { if (await js(expr)) return; await sleep(200); }
  throw new Error(`Tempo esgotado: ${what}. Aviso: ${await js(`document.getElementById("notice")?.innerText`)}`);
};
const click = (label) => js(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) throw new Error("botão não encontrado: " + ${JSON.stringify(label)}); b.click(); return true; })()`);
const noticeText = () => js(`document.getElementById("notice").innerText`);

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: origin + "/" });
  await until(`!!document.querySelector('#navigation button[data-view="Rodadas"]')`, "navegação");
  await click("Rodadas");
  await until(`/Nova rodada/.test(document.body.innerText)`, "tela Rodadas");

  // Criar pelo formulário em 4 passos (2026-10-20): commodity e produto do catálogo, país pelo nome, estado e cidade
  // escolhidos (sem código IBGE nem coordenada), raio; segmentos e fontes no passo 3; revisar e criar.
  const fset = (n, v, ev = "change") => js(`(() => { const c = document.querySelector('.round-form [name="${n}"]'); c.value = ${JSON.stringify(v)}; c.dispatchEvent(new Event("input", { bubbles: true })); c.dispatchEvent(new Event("${ev}", { bubbles: true })); return true; })()`);
  const next = () => js(`(() => { [...document.querySelectorAll(".round-form button")].find((b) => b.textContent === "Continuar" && !b.hidden).click(); return true; })()`);
  const stepIs = (label) => until(`/${label}/.test(document.querySelector(".round-form .wizard-steps .current").textContent)`, label);
  await js(`(() => { const d = [...document.querySelectorAll("details")].find((x) => x.querySelector("summary").textContent === "Nova rodada"); d.open = true; return true; })()`);
  assert.ok(!/Código IBGE|Latitude|Longitude/.test(await js(`document.querySelector(".round-form").innerText`)), "sem campos técnicos de localização");
  await fset("name", "Soja Rio Verde (teste de tela)");
  await fset("code", "soy");
  await fset("configProductId", "product-01");
  // Enviar no passo 1 só avança (nunca cria antes da revisão).
  await js(`document.querySelector(".round-form").requestSubmit()`);
  await stepIs("Local e alcance");
  await until(`document.querySelector('.round-form [name="countryName"]').value === "Brasil"`, "país pelo nome");
  await fset("region", "GO");
  await fset("municipality", "Rio Verde", "input");
  await fset("radius", "150");
  await next();
  await stepIs("Fontes e limites");
  await until(`/Segmentos compradores de Soja/.test(document.querySelector(".round-form").innerText)`, "segmentos da soja");
  await js(`(() => {
    const t = document.querySelector('.round-form [name="advanced"]'); const adv = JSON.parse(t.value);
    adv.segments = { feed_mill: { label: "fábrica de ração", discovery: { sipeagro: { activity: ["FABRICANTE"] } } }, crusher: { label: "esmagadora" } };
    adv.sources = [{ id: "br-cnpj-ws", kind: "registry", countries: ["BR"], rateLimitPerMinute: 3, maxAgeDays: 30 }, { id: "osm-overpass", kind: "discovery" }, { id: "mapa-sipeagro", kind: "discovery" }];
    t.value = JSON.stringify(adv); t.dispatchEvent(new Event("change")); return true; })()`);
  await fset("scope", "br_email_automatic");
  await next();
  await stepIs("Revisar e salvar");
  assert.match(await js(`document.querySelector(".round-form").innerText`), /Rio Verde\/GO/);
  await js(`document.querySelector(".round-form").requestSubmit()`);
  await until(`/Antes de executar/.test(document.body.innerText)`, "rodada criada");
  await until(`/Municípios/.test(document.body.innerText) && !/Calculando a área/.test(document.body.innerText)`, "área calculada");
  const areaText = await js(`document.body.innerText`);
  assert.match(areaText, /IBGE/);
  assert.match(areaText, /proporcional: últimos 10% do raio \(de 135 a 150 km\)/);
  assert.match(areaText, /Sem suporte|Parcial/, "limitações visíveis antes da execução");

  // Executar sem ciência é recusado; registrar ciência.
  await click("Executar rodada");
  await until(`/ciência/.test(document.getElementById("notice").innerText)`, "recusa sem ciência");
  await click("Registrar ciência das limitações");
  // Com a ciência registrada, a rodada passa para a seção Buscar/importar; o registro fica na seção Configuração.
  await until(`document.querySelector('.round-tabs [data-tab="buscar"]')?.getAttribute("aria-selected") === "true"`, "próxima seção");
  await js(`document.querySelector('.round-tabs [data-tab="config"]').click()`);
  await until(`/Ciência registrada por/.test(document.body.innerText)`, "ciência registrada");

  // Importação de CSV pelo seletor de arquivo (seção Buscar/importar).
  await js(`document.querySelector('.round-tabs [data-tab="buscar"]').click()`);
  const doc = await send("DOM.getDocument", {});
  const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: 'input[type="file"]' });
  await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [csvPath] });
  await js(`(() => { const s = document.querySelector('select[name="kind"]'); s.value = "csv"; return true; })()`);
  await click("Importar");
  await until(`/Importação: 2 novas/.test(document.getElementById("notice").innerText)`, "importação");

  // Pesquisa assistida com fonte.
  await js(`(() => {
    const d = [...document.querySelectorAll("details")].find((x) => /Pesquisa assistida/.test(x.querySelector("summary").textContent)); d.open = true;
    const f = d.querySelector("form"); const set = (n, v) => { f.querySelector('[name="' + n + '"]').value = v; };
    set("name", "Alfa Esmagadora"); set("registrationId", "11.111.111/0001-91"); set("municipality", "Rio Verde"); set("region", "GO"); set("segment", "crusher");
    set("sourceUrl", "https://alfa.example/sobre"); set("kind", "commodity_use"); set("strength", "own_source"); set("quote", "esmagamos soja");
    f.requestSubmit(); return true; })()`);
  await until(`/Candidata registrada/.test(document.getElementById("notice").innerText)`, "pesquisa assistida");

  await click("Executar rodada");
  await until(`/Rodada executada: 3 estabelecimentos/.test(document.getElementById("notice").innerText)`, "execução");
  await until(`/Ômega Grãos/.test(document.body.innerText) && /ESTIMADA/.test(document.body.innerText)`, "resultados renderizados");
  const afterRun = await js(`document.body.innerText`);
  assert.match(afterRun, /Ômega Grãos/, "exceção (CNPJ não encontrado) aparece para revisão");
  assert.match(afterRun, /ESTIMADA/);

  // Decisão em lote: mostrar todos, selecionar Alfa e aceitar (seção Conferir).
  await js(`document.querySelector('.round-tabs [data-tab="conferir"]').click()`);
  await js(`(() => { const s = document.querySelector('select[name="filter"]'); s.value = "all"; s.dispatchEvent(new Event("change")); return true; })()`);
  await js(`(() => { document.querySelector('input[aria-label="Selecionar Alfa Esmagadora"]').click(); return true; })()`);
  await js(`(() => { document.querySelector('select[name="decision"]').value = "accept"; return true; })()`);
  await click("Registrar decisão em lote");
  await until(`/1 decisão\\(ões\\) registrada\\(s\\) por/.test(document.getElementById("notice").innerText)`, "decisão em lote");
  await until(`/Decisão: Aceita para cadastro por/.test(document.body.innerText)`, "decisão visível com responsável e data");

  // Cadastro em descoberta: o produto vem da configuração (fixo) e o servidor recusa produto de outra commodity.
  await js(`document.querySelector('.round-tabs [data-tab="cadastrar"]').click()`);
  assert.equal(await js(`document.querySelector('select[name="productId"]').value`), "product-01");
  assert.equal(await js(`document.querySelector('select[name="productId"]').disabled`), true, "produto preso à configuração");
  await click("Cadastrar no Compass");
  await until(`/Cadastro \\(descoberta\\)/.test(document.getElementById("notice").innerText)`, "cadastro");
  const reg = await noticeText();
  assert.match(reg, /2 criada\(s\)/, reg);
  assert.match(reg, /Nenhum contato, ficha ou envio foi criado/);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE registration_id IN ('11111111000191','22222222000191')").get().n, 2);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE registration_id='99999999000191'").get().n, 0, "exceção fica de fora");

  if (shotPath) {
    await js(`(() => { const s = document.querySelector('select[name="filter"]'); s.value = "all"; s.dispatchEvent(new Event("change")); window.scrollTo(0, 0); return true; })()`);
    const h = await js(`document.documentElement.scrollHeight`);
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: Math.min(h, 6000), deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(shotPath, Buffer.from(shot.result.data, "base64"));
  }
  // Largura de celular: sem rolagem horizontal.
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  assert.ok(await js(`document.documentElement.scrollWidth <= window.innerWidth + 1`), "sem rolagem horizontal no celular");
  assert.deepEqual(errors, [], "sem erro de JavaScript na página");
  console.log("Tela Rodadas: criar, área, limitações, ciência, importar, pesquisa assistida, executar, decidir em lote e cadastrar — ok.");
} finally {
  ws.close();
  chrome.kill();
  server.close();
  ctx.close();
}
