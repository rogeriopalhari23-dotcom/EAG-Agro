import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("Setup preserva chaves existentes, completa vazias e falha sem alterar chave inválida", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "eag-setup-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "scripts"));
  const script = join(root, "scripts/setup-local.mjs");
  await copyFile(
    new URL("../scripts/setup-local.mjs", import.meta.url),
    script,
  );
  const key = Buffer.alloc(32, 7).toString("base64");
  await writeFile(join(root, ".dev.vars"), `PII_ENCRYPTION_KEY="${key}"\n`);
  await writeFile(join(root, ".dev.vars.local"), "SUPPRESSION_HMAC_KEY=\n");
  const run = () => spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(run().status, 0);
  const first = await readFile(join(root, ".dev.vars.local"), "utf8");
  assert.ok(first.includes(key));
  assert.equal(run().status, 0);
  assert.equal(await readFile(join(root, ".dev.vars.local"), "utf8"), first);
  await writeFile(
    join(root, ".dev.vars.local"),
    "PII_ENCRYPTION_KEY=invalid\n",
  );
  const bad = run();
  assert.notEqual(bad.status, 0);
  assert.equal(
    await readFile(join(root, ".dev.vars.local"), "utf8"),
    "PII_ENCRYPTION_KEY=invalid\n",
  );
  assert.ok(!bad.stdout.includes(key));
});
