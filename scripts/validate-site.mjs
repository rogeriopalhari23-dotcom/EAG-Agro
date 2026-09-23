import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "dist");
for (const relative of ["index.html","server/index.js","server/scoring.js","server/page.js",".openai/hosting.json","drizzle/0000_initial.sql"]) {
  await access(resolve(root, relative));
}
const worker = await import(`${resolve(root, "server/index.js")}?v=${Date.now()}`);
if (typeof worker.default?.fetch !== "function") throw new Error("Worker sem fetch exportado");
const manifest = JSON.parse(await readFile(resolve(root, ".openai/hosting.json"), "utf8"));
if (manifest.d1 !== "DB" || manifest.r2 !== "FILES") throw new Error("Bindings lógicos inválidos");
const page = await readFile(resolve(root, "server/page.js"), "utf8");
for (const marker of ["metricProspects", "flowQualifying", "exportPipelineButton", "/api/dashboard"]) {
  if (!page.includes(marker)) throw new Error(`Contrato visual ausente: ${marker}`);
}
console.log("Site artifact valid");
