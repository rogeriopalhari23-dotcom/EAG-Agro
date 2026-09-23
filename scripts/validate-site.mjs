import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "..");
assert.deepEqual((await readdir(resolve(root, "dist"))).sort(), [
  "_headers",
  "app.css",
  "app.js",
  "index.html",
]);
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
