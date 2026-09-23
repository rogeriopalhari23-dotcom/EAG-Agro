import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, ".."),
  dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ["index.html", "app.js", "app.css", "_headers"])
  await cp(resolve(root, "public", file), resolve(dist, file));
await cp(resolve(root, "public", "fonts"), resolve(dist, "fonts"), { recursive: true });
console.log("Build concluído: somente arquivos públicos.");
