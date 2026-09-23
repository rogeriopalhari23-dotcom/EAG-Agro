import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

// Regressão: edições automatizadas já gravaram backspace (\x08) no lugar de "\b" dentro de regex.
test("Arquivos de código e migrações não têm caracteres de controle", async () => {
  const bad = [];
  for (const dir of ["src", "tests", "scripts", "migrations", "public"])
    for (const f of await readdir(dir, { recursive: true })) {
      if (!/\.(m?js|sql|html|css|json)$/.test(f)) continue;
      const text = await readFile(`${dir}/${f}`, "utf8");
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) bad.push(`${dir}/${f}`);
    }
  assert.deepEqual(bad, []);
});
