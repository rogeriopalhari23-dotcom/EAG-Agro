// Listas pesquisáveis (país, commodity, cidade) e decisores na lista de empresas, num navegador real (Chrome headless pelo
// protocolo de depuração). Worker local com banco em memória; nada sai para a rede além do navegador falando com o
// servidor local. Opcional (fora do npm run check): node tests/ui-listas.mjs [captura.png]
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
  if (/^http:\/\/127\.0\.0\.1:9335\//.test(String(url))) return realFetch(url, init);
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

const dir = await mkdtemp(join(tmpdir(), "eag-ui-listas-"));

const chrome = spawn(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--remote-debugging-port=9335", `--user-data-dir=${join(dir, "perfil")}`, "--window-size=1280,900", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(500);
  try { target = (await (await realFetch("http://127.0.0.1:9335/json/list")).json()).find((t) => t.type === "page"); } catch {}
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


// Empresas fictícias: uma com decisora (contato pessoal) e canal geral separado; outra só com o nome.
{
  const cid = (await ctx.api("/api/companies", "POST", { legalName: "Torrefação Alfa Ltda (fictícia)", countryCode: "BR", sourceLabel: "Teste de tela (fictício)" })).data.id;
  await ctx.api(`/api/companies/${cid}/contacts`, "POST", { fullName: "Ana Souza Teste", jobTitle: "Compradora", email: "ana.souza@alfa.previa.invalid", sourceLabel: "Site (fictício)", sourceUrl: "https://alfa.previa.invalid/contato", prospectRole: "decision_maker" });
  const ch = await ctx.api(`/api/companies/${cid}/contacts`, "POST", { fullName: "Canal geral", email: "contato@alfa.previa.invalid", sourceLabel: "Site (fictício)" });
  ctx.DB.raw.prepare("UPDATE contacts SET contact_kind='company_channel' WHERE id=?").run(ch.data.id);
  await ctx.api("/api/companies", "POST", { legalName: "Rações Beta Ltda (fictícia)", countryCode: "BR", sourceLabel: "Teste de tela (fictício)" });
}

// Classificação SH confirmada no catálogo (como pelo Administrador) para o café e o álcool industrial.
for (const [pid, code] of [["product-05", "090111"], ["product-11", "220710"]]) {
  const p = (await ctx.api(`/api/catalog/${pid}`)).data;
  await ctx.api(`/api/catalog/${pid}/codes`, "POST", { codeSystem: "HS", code, status: "confirmed", classificationVersion: "HS2022", sourceRef: "Teste de tela (fictício)", expectedRevision: p.revision, reason: "Teste de tela" });
}

const S = ".prospect-form";
const q = (n) => `document.querySelector('${S} [name="${n}Text"]')`;
const listOf = (n) => `${q(n)}.closest(".combo").querySelector(".combo-list")`;
const typeIn = (n, v) => js(`(() => { const c = ${q(n)}; c.focus(); c.value = ${JSON.stringify(v)}; c.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
const options = (n) => js(`(() => { const l = ${listOf(n)}; return l.hidden ? [] : [...l.querySelectorAll("li[role=option]:not(.combo-empty):not(.combo-error)")].map((li) => li.firstChild?.textContent); })()`);
const hasOption = (n, label) => until(`(() => { const l = ${listOf(n)}; return !l.hidden && [...l.querySelectorAll("li")].some((li) => li.firstChild?.textContent === ${JSON.stringify(label)}); })()`, `opção ${label}`);
const hiddenVal = (n) => js(`document.querySelector('${S} [name="${n}"]').value`);
const key = (n, k) => js(`(() => { ${q(n)}.dispatchEvent(new KeyboardEvent("keydown", { key: "${k}", bubbles: true, cancelable: true })); return true; })()`);
const blur = (n) => js(`(() => { ${q(n)}.blur(); return true; })()`);
const pickMouse = (n, label) => js(`(() => { const li = [...${listOf(n)}.querySelectorAll("li")].find((x) => x.firstChild?.textContent === ${JSON.stringify(label)}); li.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); li.click(); return true; })()`);
const nav = (v) => js(`(() => { document.querySelector('#navigation button[data-view="${v}"]').click(); return true; })()`);

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }); // foco e saída do campo como numa janela ativa
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: origin + "/" });
  await until(`!!document.querySelector('#navigation button[data-view="Radar Internacional"]')`, "navegação");
  // Falha de carregamento da lista de países: erro visível e "Tentar de novo" (a primeira chamada falha de propósito).
  await js(`(() => { const f = window.fetch; let once = true; window.fetch = (u, i) => (once && String(u).includes("/api/countries") ? ((once = false), Promise.resolve(new Response(JSON.stringify({ error: { message: "falha simulada" } }), { status: 503, headers: { "content-type": "application/json" } }))) : f(u, i)); return true; })()`);
  await nav("Radar Internacional");
  await until(`!!${q("country")}`, "formulário internacional");
  await js(`(() => { ${q("country")}.click(); return true; })()`);
  await until(`/Não foi possível carregar a lista/.test(${listOf("country")}.innerText)`, "erro de carregamento");
  await js(`(() => { ${listOf("country")}.querySelector(".combo-error button").click(); return true; })()`);
  await until(`${listOf("country")}.querySelectorAll("li[role=option]:not(.combo-error)").length > 150`, "lista recarregada");
  // Clique abre a lista inteira (nenhum país escondido por falta de conector; o Brasil fica fora no internacional).
  const all = await options("country");
  assert.ok(all.length > 200 && all.includes("Argentina") && all.includes("Zâmbia"), `lista completa (${all.length})`);
  assert.ok(!all.includes("Brasil"), "internacional não oferece o Brasil");
  // Altura máxima com rolagem interna; linhas compactas e legíveis.
  const geo = await js(`(() => { const l = ${listOf("country")}; const li = l.querySelector("li"); return { h: l.clientHeight, sh: l.scrollHeight, li: li.getBoundingClientRect().height, fs: parseFloat(getComputedStyle(li).fontSize) }; })()`);
  assert.ok(geo.h <= 300 && geo.sh > geo.h, `altura máxima com rolagem: ${JSON.stringify(geo)}`);
  assert.ok(geo.li >= 36 && geo.li <= 48 && geo.fs >= 14, `linha compacta e legível: ${JSON.stringify(geo)}`);
  await key("country", "Escape");

  // Commodity: Farelo de milho pesquisável e distinto de CGF/CGM/DDGS.
  await typeIn("commodity", "farelo de milho");
  await hasOption("commodity", "Farelo de milho");
  const fm = await options("commodity");
  assert.ok(!fm.some((x) => /CGF|CGM|DDGS/.test(x)), `farelo de milho sem CGF, CGM nem DDGS: ${JSON.stringify(fm)}`);
  await typeIn("commodity", "gluten");
  await until(`${listOf("commodity")}.querySelectorAll("li[role=option]:not(.combo-empty)").length > 0`, "glúten");
  const gl = await options("commodity");
  assert.ok(gl.some((x) => /\(CGF\)/.test(x)) && gl.some((x) => /\(CGM\)/.test(x)) && !gl.includes("Farelo de milho"), JSON.stringify(gl));
  // Teclado: digitar e Enter escolhe a primeira; seta muda a opção ativa.
  await typeIn("commodity", "soja");
  await hasOption("commodity", "Soja");
  await key("commodity", "ArrowDown");
  await key("commodity", "ArrowUp");
  await key("commodity", "Enter");
  assert.equal(await hiddenVal("commodity"), "soy");
  await until(`!!document.querySelector('${S} select[name="productId"]')`, "soja pede o produto");
  await js(`(() => { const s = document.querySelector('${S} select[name="productId"]'); s.value = s.options[1].value; s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
  // Trocar a commodity não herda o produto anterior.
  await typeIn("commodity", "cafe");
  await hasOption("commodity", "Café");
  await pickMouse("commodity", "Café");
  assert.equal(await hiddenVal("commodity"), "coffee");
  assert.ok(await js(`!document.querySelector('${S} select[name="productId"]')`), "produto da soja não fica para o café");
  assert.match(await js(`document.querySelector('${S} .prospect-product').innerText`), /Café/);

  // Países: digitar "argentina" e escolher com o mouse; nomes completos reconhecidos sem clique; acentos ignorados.
  await typeIn("country", "argentina");
  await hasOption("country", "Argentina");
  await pickMouse("country", "Argentina");
  assert.equal(await hiddenVal("country"), "AR");
  assert.equal(await js(`${q("country")}.value`), "Argentina");
  await until(`/Fontes desta pesquisa/.test(document.querySelector("${S}").innerText)`, "cobertura informada para a Argentina");
  for (const [typed, iso, label] of [["Alemanha", "DE", "Alemanha"], ["portugal", "PT", "Portugal"], ["japao", "JP", "Japão"], ["MEXICO", "MX", "México"], ["Germany", "DE", "Alemanha"]]) {
    await typeIn("country", typed);
    await sleep(60);
    await blur("country");
    await until(`document.querySelector('${S} [name="country"]').value === "${iso}"`, `${typed} reconhecido`);
    assert.equal(await js(`${q("country")}.value`), label);
  }
  await typeIn("country", "Guin"); // Guiné, Guiné-Bissau, Guiné Equatorial…: parcial e ambíguo
  await sleep(60);
  await blur("country");
  await until(`/Escolha uma opção da lista/.test(${q("country")}.closest(".combo").innerText)`, "nome ambíguo pede escolha");
  assert.equal(await hiddenVal("country"), "", "nenhuma seleção invisível em texto ambíguo");
  assert.ok(!/\b(BRA|ARG|DEU)\b/.test(await js(`document.querySelector("${S}").innerText`)), "código do país fica interno");

  // Troca rápida: a resposta atrasada da pesquisa anterior (café × Alemanha) não preenche a atual (álcool × Alemanha).
  await js(`(() => { const f = window.fetch; window.fetch = (u, i) => (String(u).includes("/api/prospect/coverage") && String(u).includes("product-05") ? new Promise((r) => setTimeout(() => r(f(u, i)), 1500)) : f(u, i)); return true; })()`);
  await typeIn("country", "Alemanha");
  await sleep(60);
  await blur("country");
  await until(`document.querySelector('${S} [name="country"]').value === "DE"`, "Alemanha");
  await typeIn("commodity", "álcool industrial");
  await hasOption("commodity", "Álcool industrial");
  await pickMouse("commodity", "Álcool industrial");
  await sleep(2200);
  const cov = await js(`document.querySelector("${S} .prospect-coverage").innerText`);
  assert.match(cov, /Álcool industrial em Alemanha/, cov);
  assert.doesNotMatch(cov, /Kaffeeverband|torrefação|Noruega|França/, "nada de café, Noruega ou França na pesquisa de álcool");
  assert.match(await js(`document.querySelector("${S} .prospect-coverage").dataset.for`), /product-1[123]/);
  // Café × Alemanha: diretório do café e mapa de torrefação; nada da França nem da Noruega.
  await typeIn("commodity", "cafe");
  await hasOption("commodity", "Café");
  await pickMouse("commodity", "Café");
  await until(`/Café em Alemanha/.test(document.querySelector("${S} .prospect-coverage").innerText)`, "cobertura do café", 6000);
  const covCafe = await js(`document.querySelector("${S} .prospect-coverage").innerText`);
  assert.match(covCafe, /Kaffeeverband/);
  assert.doesNotMatch(covCafe, /França|Noruega/);

  // Brasil (origem nacional) na mesma lista comum: Rodadas → configuração manual.
  await nav("Rodadas");
  await until(`!!document.querySelector("details.complementary")`, "tela Rodadas");
  await js(`(() => { document.querySelector("details.complementary").open = true; return true; })()`);
  await until(`/Nova rodada/.test(document.body.innerText)`, "configuração manual");
  await js(`(() => { const d = [...document.querySelectorAll("details")].find((x) => x.querySelector("summary").textContent === "Nova rodada"); d.open = true; return true; })()`);
  await until(`!!document.querySelector('.round-form [name="countryText"]')`, "formulário da rodada");

  // Empresas: decisor e canal geral separados, "Decisor ainda não identificado" e busca pelo nome da pessoa.
  await nav("Empresas");
  await until(`/Rações Beta/.test(document.body.innerText)`, "lista de empresas");
  const lista = await js(`document.querySelector("main").innerText`);
  assert.match(lista, /Ana Souza Teste/);
  assert.match(lista, /canal geral da empresa/);
  assert.match(lista, /Decisor ainda não identificado/);
  await js(`(() => { const i = document.querySelector('.filter-bar [name="q"]'); i.value = "ana souza"; i.closest("form").requestSubmit(); return true; })()`);
  await until(`!/Rações Beta/.test(document.querySelector("main").innerText) && /Torrefação Alfa/.test(document.querySelector("main").innerText)`, "busca por pessoa");

  if (shotPath) {
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    await writeFile(shotPath, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
  }

  // Celular: alvo de toque de 44 px, lista abre e escolhe, sem rolagem horizontal.
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await sleep(300);
  await nav("Radar Internacional");
  await until(`!!${q("country")}`, "formulário no celular");
  await typeIn("country", "arg");
  await hasOption("country", "Argentina");
  const mob = await js(`${listOf("country")}.querySelector("li").getBoundingClientRect().height`);
  assert.ok(mob >= 44, `alvo de toque no celular: ${mob}`);
  await pickMouse("country", "Argentina");
  assert.equal(await hiddenVal("country"), "AR");
  assert.ok(await js(`document.documentElement.scrollWidth <= window.innerWidth + 1`), "sem rolagem horizontal no celular");
  assert.deepEqual(errors, [], "sem erro de JavaScript na página");
  console.log("ui-listas: ok");
} finally {
  ws.close();
  chrome.kill();
  server.close();
  ctx.close();
}
