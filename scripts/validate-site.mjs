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
for (const family of ["roboto", "barlow-condensed", "ibm-plex-mono"])
  assert.ok(fonts.includes(`LICENSE-${family}.txt`), `Licença ausente: ${family}`);
const worker = await import(pathToFileURL(resolve(root, "src/worker.js")).href);
assert.equal(typeof worker.default.fetch, "function");
const html = await readFile(resolve(root, "dist/index.html"), "utf8");
assert.ok(html.includes("/app.js") && html.includes("/app.css"));
assert.ok(
  !/<script(?![^>]*src=)[^>]*>/i.test(html),
  "Script inline proibido pelo CSP",
);
console.log(
  "Artefato validado; importação por file URL compatível com Windows.",
);
