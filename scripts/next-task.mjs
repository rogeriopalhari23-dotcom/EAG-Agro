import { readFile, access } from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url);
const plan = JSON.parse(
  await readFile(new URL("docs/implementation/sequence.json", root), "utf8"),
);
const byId = new Map(plan.tasks.map((t) => [t.id, t]));
assert.equal(byId.size, plan.tasks.length, "IDs repetidos");
const visiting = new Set(),
  visited = new Set();
function visit(id) {
  assert.ok(byId.has(id), `Dependência desconhecida: ${id}`);
  assert.ok(!visiting.has(id), "Ciclo de dependências");
  if (visited.has(id)) return;
  visiting.add(id);
  for (const d of byId.get(id).dependsOn) visit(d);
  visiting.delete(id);
  visited.add(id);
}
for (const t of plan.tasks) {
  visit(t.id);
  assert.ok(
    ["implemented", "partial", "pending", "external"].includes(t.status),
  );
  assert.ok(t.acceptance && t.validation);
  for (const path of [t.plan, ...t.read, ...(t.evidence ? [t.evidence] : [])]) {
    assert.ok(!path.includes("..") && !path.startsWith("/"));
    await access(new URL(path, root));
  }
}
if (process.argv.includes("--validate")) {
  console.log(`Sequência válida: ${plan.tasks.length} tarefas, sem ciclos.`);
} else if (process.argv.includes("--all")) {
  for (const t of plan.tasks) console.log(`${t.id} [${t.status}] ${t.title}`);
} else {
  const requested = process.argv.find((a) => a.startsWith("--task="))?.slice(7);
  const ready = plan.tasks.filter(
    (t) =>
      ["partial", "pending"].includes(t.status) &&
      t.dependsOn.every((id) => byId.get(id).status === "implemented"),
  );
  const task = requested
    ? byId.get(requested)
    : ready.find((t) => !t.blockedBy) || ready[0];
  assert.ok(!requested || task, "Tarefa não encontrada");
  if (!task)
    console.log(
      "Nenhuma tarefa pronta. Consulte --all e resolva as dependências registradas.",
    );
  else if (process.argv.includes("--json"))
    console.log(JSON.stringify(task, null, 2));
  else {
    console.log(
      `${task.id} — ${task.title}\nEstado: ${task.status}\nPlano: ${task.plan} (${task.section})\nLer: ${task.read.join(", ")}\nAceite: ${task.acceptance}\nValidar: ${task.validation}\nDependências: ${task.dependsOn.join(", ") || "nenhuma"}\nBloqueio: ${task.blockedBy || "nenhum registrado"}\nAtualize apenas este item com a evidência ao concluir; não refaça o histórico.`,
    );
  }
}
