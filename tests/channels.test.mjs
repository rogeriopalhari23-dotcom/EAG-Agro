import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";

function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}

check("P2-T17: e-mail vai a teste interno; liberar exige evidência do registro de T1", async ({ api }) => {
  assert.equal((await api("/api/channels/email/state", "POST", { state: "internal_test" })).status, 200);
  assert.equal((await api("/api/channels/email/state", "POST", { state: "enabled" })).status, 422);
  assert.equal((await api("/api/channels/email/state", "POST", { state: "enabled", evidenceRef: "confiei" })).data.error.code, "evidence_required");
  const ok = await api("/api/channels/email/state", "POST", { state: "enabled", evidenceRef: "docs/eag-compass-t1-validacao.md#liberacao" });
  assert.equal(ok.status, 200);
  const list = (await api("/api/channels")).data.items;
  assert.equal(list.find((c) => c.channel === "email").state, "enabled");
});

check("P2-T17: WhatsApp e LinkedIn não habilitam; só admin muda canal", async ({ api, env, DB }) => {
  assert.equal((await api("/api/channels/whatsapp/state", "POST", { state: "internal_test" })).data.error.code, "channel_not_proven");
  assert.equal((await api("/api/channels/linkedin/state", "POST", { state: "enabled", evidenceRef: "docs/eag-compass-t1-validacao.md#x" })).data.error.code, "channel_not_proven");
  DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('s','eag-internal','s@example.test','Vendedor','seller_analyst')");
  env.LOCAL_USER_EMAIL = "s@example.test";
  assert.equal((await api("/api/channels/email/state", "POST", { state: "internal_test" })).status, 403);
});
