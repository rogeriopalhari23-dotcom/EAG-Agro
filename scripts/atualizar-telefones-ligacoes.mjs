// Define o telefone das ligações de nível 0 já existentes a partir dos canais documentados (migração 0034).
// Usa só a edição auditada (PATCH /api/tasks/:id com expectedRevision): preserva id, roteiro, canal, próxima ação,
// estado e histórico. Unidades marcadas "pendente" não são tocadas. Simulação por padrão; nada é enviado a ninguém.
//   Simulação: CF_ACCESS_TOKEN=... node --use-system-ca scripts/atualizar-telefones-ligacoes.mjs <arquivo.json> --base https://<compass>
//   Aplicar:   ... --apply   (só depois da migração 0034 e do Worker novo publicados)
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && !/^https?:/.test(a));
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : null;
const apply = args.includes("--apply");
if (!file || !base) throw new Error("Use: <arquivo.json> --base <url> [--apply]");
const plan = JSON.parse(readFileSync(file, "utf8"));
const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base);
if (!local && !process.env.CF_ACCESS_TOKEN) throw new Error("Fora do ambiente local, informe CF_ACCESS_TOKEN.");
const headers = { "content-type": "application/json", origin: new URL(base).origin, ...(process.env.CF_ACCESS_TOKEN ? { cookie: `CF_Authorization=${process.env.CF_ACCESS_TOKEN}` } : {}) };
const call = async (method, path, body) => {
  const r = await fetch(new URL(path, base), { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const companies = (await call("GET", "/api/companies?limit=100")).json.companies ?? [];
const open = (await call("GET", "/api/tasks?until=9999-12-31&limit=100")).json.items ?? [];
const suspended = (await call("GET", "/api/tasks?until=9999-12-31&status=suspended&limit=100")).json.items ?? [];
// O Worker anterior à 0034 ignora status=suspended e devolve as abertas de novo: junta por id e avisa.
const oldWorker = suspended.some((x) => x.status !== "suspended");
const allTasks = [...new Map([...open, ...suspended].map((x) => [x.id, x])).values()];
if (oldWorker) console.log("Aviso: o Worker publicado ainda é o anterior à migração 0034 (sem telefone nas ligações); a aplicação só funciona depois da publicação.");
const rows = [];
let problems = 0;
for (const u of plan.unidades) {
  const co = companies.filter((c) => c.registration_id === u.cnpj);
  const tasks = co.length === 1 ? allTasks.filter((t) => t.company_id === co[0].id && t.kind === "call_l0") : [];
  const t = tasks.length === 1 ? tasks[0] : null;
  let action = u.acao === "definir" ? "definir telefone" : "pendente (não alterada)";
  if (co.length !== 1) (action = `ERRO: ${co.length} empresas com o CNPJ`), problems++;
  else if (tasks.length !== 1) (action = `ERRO: ${tasks.length} ligações de nível 0`), problems++;
  else if (u.acao === "definir" && t.status !== "open") (action = `não alterada: tarefa ${t.status}`), problems++;
  else if (u.acao === "definir" && t.phone && t.phone !== u.phone.replace(/[^\d+]/g, "")) (action = `ERRO: tarefa já tem outro telefone (${t.phone})`), problems++;
  else if (u.acao === "definir" && t.phone) action = "já definido (nada a fazer)";
  rows.push({ u, t, action });
}
console.log(`${apply ? "APLICAÇÃO" : "SIMULAÇÃO"} — ${base}`);
for (const { u, t, action } of rows)
  console.log(
    [
      `\n${u.nome} (CNPJ ${u.cnpj})`,
      `  tarefa: ${t ? `${t.id.slice(0, 8)} rev ${t.revision} ${t.status}` : "—"}`,
      `  telefone: ${u.phone ?? "—"}`,
      `  fonte: ${u.phoneSource ?? "—"}`,
      `  pendência: ${u.pendencia ?? "nenhuma"}`,
      `  divergências: ${u.divergencias}`,
      `  ação: ${action}`,
    ].join("\n"),
  );
const todo = rows.filter((r) => r.action === "definir telefone");
console.log(`\nResumo: ${todo.length} a definir; ${rows.filter((r) => r.u.acao === "pendente").length} pendentes; ${problems} problema(s).`);
if (!apply) process.exit(0);
if (problems) throw new Error("Há problemas na simulação: nada foi aplicado.");
if (oldWorker) throw new Error("Worker anterior à 0034: publique antes de aplicar.");
for (const { u, t } of todo) {
  const r = await call("PATCH", `/api/tasks/${t.id}`, { expectedRevision: t.revision, reason: plan.motivo, phone: u.phone, phoneSource: u.phoneSource });
  console.log(`${u.nome}: ${r.status}${r.status >= 400 ? ` ${r.json.error?.code}` : ` rev ${r.json.revision}${r.json.suspended ? " (SUSPENSA: número suprimido)" : ""}`}`);
}
