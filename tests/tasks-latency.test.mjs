// Latência do D1 em produção (06/10/2026): com 13 ligações, a lista de tarefas somava ~7 idas ao banco por tarefa em
// sequência (~21 s), passando do tempo da tela (20 s) e derrubando Início e Tarefas. Aqui cada ida ao banco custa 40 ms;
// a lista precisa responder bem abaixo da soma sequencial (13 × 7 × 40 ms ≈ 3,6 s), sem mudar ordem nem bloqueios.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot } from "./helpers/pilot.mjs";

const DELAY = 40;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function withLatency(DB) {
  const prepare = DB.prepare.bind(DB);
  DB.prepare = (sql) => {
    const st = prepare(sql);
    for (const m of ["first", "all", "run"]) {
      const orig = st[m].bind(st);
      st[m] = async (...a) => (await sleep(DELAY), orig(...a));
    }
    return st;
  };
  const batch = DB.batch.bind(DB);
  DB.batch = async (statements) => (await sleep(DELAY), batch(statements));
}

test("Lista de tarefas com 13 ligações responde dentro do tempo da tela mesmo com latência do banco", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const r = await pilot(ctx, { t11: false });
  const ids = [];
  for (let i = 0; i < 13; i++)
    ids.push((await ctx.api(`/api/companies/${r.companyId}/level0`, "POST", { commodity: `c${i}`, phone: i % 2 ? `+55 64 3615-97${String(i).padStart(2, "0")}` : undefined, phoneSource: i % 2 ? "site, teste" : undefined })).data.id);
  const before = (await ctx.api("/api/tasks?until=2099-12-31&limit=100")).data.items.map((x) => [x.id, x.blocked.join(",")]);
  withLatency(ctx.DB);
  const start = Date.now();
  const res = await ctx.api("/api/tasks?until=2099-12-31&limit=100");
  const ms = Date.now() - start;
  assert.equal(res.status, 200);
  assert.deepEqual(res.data.items.map((x) => [x.id, x.blocked.join(",")]), before, "mesma ordem e mesmos bloqueios");
  assert.ok(res.data.items.filter((x) => ids.includes(x.id)).every((x) => x.blocked.includes("t11_pending")));
  assert.ok(ms < 1500, `lista levou ${ms} ms com ${DELAY} ms por ida ao banco`);
});
