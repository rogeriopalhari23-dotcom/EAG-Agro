import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "..");
assert.deepEqual((await readdir(resolve(root, "dist"))).sort(), [
  "_headers",
  "app.css",
  "app.js",
  "fonts",
  "index.html",
]);
// Fontes: só woff2 e licenças; toda fonte citada no CSS precisa existir.
const fonts = await readdir(resolve(root, "dist/fonts"));
assert.ok(fonts.every((f) => /^[a-z0-9-]+\.woff2$|^LICENSE-[a-z0-9-]+\.txt$/.test(f)));
const css = await readFile(resolve(root, "dist/app.css"), "utf8");
for (const [, file] of css.matchAll(/url\("fonts\/([^"]+)"\)/g))
  assert.ok(fonts.includes(file), `Fonte ausente: ${file}`);
// Cada família presente (nome antes de "-latin-") precisa da licença OFL correspondente.
for (const family of new Set(fonts.filter((f) => f.endsWith(".woff2")).map((f) => f.split("-latin-")[0])))
  assert.ok(fonts.includes(`LICENSE-${family}.txt`), `Licença ausente: ${family}`);
const worker = await import(pathToFileURL(resolve(root, "src/worker.js")).href);
assert.equal(typeof worker.default.fetch, "function");
const html = await readFile(resolve(root, "dist/index.html"), "utf8");
assert.ok(html.includes("/app.js") && html.includes("/app.css"));
// Plano 3 T11 + Radar Internacional (2026-09-27): lista de países importadores, análise, lista mensal e busca de empresas.
const app = await readFile(resolve(root, "dist/app.js"), "utf8");
for (const needle of ['"data-screen", "internacional"', "/api/radar/importers", "/api/country-analyses", "/api/trade-list/versions", "/foreign-search", "/api/foreign-searches"])
  assert.ok(app.includes(needle), `app.js sem ${needle}`);
assert.ok(
  !/<script(?![^>]*src=)[^>]*>/i.test(html),
  "Script inline proibido pelo CSP",
);
console.log(
  "Artefato validado; importação por file URL compatível com Windows.",
);
