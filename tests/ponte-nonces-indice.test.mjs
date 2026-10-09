// A limpeza de nonces da ponte usa índice (correção de 2026-10-09: sem ele, cada chamada varria a tabela e o D1 estourou o
// limite diário de leituras).
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";

test("Ponte: limpeza de nonces vencidos usa o índice de seen_at, sem varrer a tabela", (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const plan = ctx.DB.raw.prepare("EXPLAIN QUERY PLAN DELETE FROM bridge_nonces WHERE seen_at<?").all("2026-10-09T00:00:00Z").map((r) => r.detail).join(" | ");
  assert.match(plan, /USING (COVERING )?INDEX idx_bridge_nonces_seen/, plan);
  assert.doesNotMatch(plan, /^SCAN bridge_nonces$/m);
});
