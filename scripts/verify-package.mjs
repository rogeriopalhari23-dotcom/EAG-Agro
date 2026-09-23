import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url);
const text = await readFile(new URL("MANIFEST-SHA256.txt", root), "utf8");
let count = 0;
for (const line of text.trim().split(/\r?\n/)) {
  const match = line.match(/^([a-f0-9]{64}) \*(.+)$/);
  assert.ok(match, "Linha de manifesto inválida");
  const [, expected, path] = match;
  assert.ok(
    !path.split("/").includes("..") &&
      !path.includes("\\") &&
      !path.startsWith("/"),
    "Caminho inseguro",
  );
  const actual = createHash("sha256")
    .update(await readFile(new URL(path, root)))
    .digest("hex");
  assert.equal(actual, expected, `Arquivo alterado: ${path}`);
  count++;
}
console.log(`Integridade verificada: ${count} arquivos.`);
