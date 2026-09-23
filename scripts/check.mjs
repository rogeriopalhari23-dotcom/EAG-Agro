import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
run(["scripts/next-task.mjs", "--validate"]);
for (const dir of ["src", "public", "scripts"])
  for (const file of await readdir(dir, { recursive: true }))
    if (/\.m?js$/.test(file)) run(["--check", `${dir}/${file}`]);
run([
  "--test",
  ...(await readdir("tests", { recursive: true }))
    .filter((x) => x.endsWith(".test.mjs"))
    .sort()
    .map((x) => `tests/${x}`),
]);
run(["scripts/check-skill.mjs"]);
run(["scripts/build-site.mjs"]);
run(["scripts/validate-site.mjs"]);
run(["--test", "tests/worker.integration.mjs"]);

