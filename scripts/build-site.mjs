import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });
await mkdir(resolve(dist, "drizzle"), { recursive: true });

const html = await readFile(resolve(root, "public/index.html"), "utf8");
await writeFile(resolve(dist, "index.html"), html);
await writeFile(resolve(dist, "server/page.js"), `export const PAGE_HTML = ${JSON.stringify(html)};\n`);
await cp(resolve(root, "src/worker.js"), resolve(dist, "server/index.js"));
await cp(resolve(root, "src/scoring.js"), resolve(dist, "server/scoring.js"));
await cp(resolve(root, ".openai/hosting.json"), resolve(dist, ".openai/hosting.json"));
await cp(resolve(root, "migrations/0001_initial.sql"), resolve(dist, "drizzle/0000_initial.sql"));
console.log(`Built ${dist}`);
