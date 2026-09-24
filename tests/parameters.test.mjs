import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { validateParameter, DEFINITIONS } from "../src/parameter-registry.js";

function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
const put = (api, key, scope, value) =>
  api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Decisão registrada no teste" });

check("P1-T8: parâmetros pendentes da Spec continuam ausentes, sem valor inventado", async ({ api }) => {
  const r = await api("/api/parameters");
  for (const k of [
    "send_window:national",
    "send_window:international",
    "send_timezone:national",
    "campaign_review_days:global",
    "international_enabled:international",
    "volume_min:corn:national",
  ])
    assert.equal(r.data.parameters[k], undefined, k);
  const def = r.data.definitions.find((d) => d.key === "send_window");
  assert.deepEqual(def.configuredScopes, []);
  assert.equal(r.data.definitions.length, Object.keys(DEFINITIONS).length);
});

check("P1-T8: janela de envio e fuso são validados por tipo", async ({ api }) => {
  assert.equal((await put(api, "send_window", "national", { start: "17:00", end: "09:00", weekdays: [1] })).status, 422);
  assert.equal((await put(api, "send_window", "national", { start: "9h", end: "17:00", weekdays: [1] })).status, 422);
  assert.equal((await put(api, "send_window", "national", { start: "09:00", end: "17:00", weekdays: [5, 1] })).status, 422);
  assert.equal((await put(api, "send_window", "national", { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] })).status, 200);
  assert.equal((await put(api, "send_timezone", "national", "America/Sao_Pablo")).status, 422);
  assert.equal((await put(api, "send_timezone", "national", "America/Sao_Paulo")).status, 200);
  assert.equal((await put(api, "send_window", "global", { start: "09:00", end: "17:00", weekdays: [1] })).status, 422);
});

check("P1-T8: raio inicial precisa estar na lista de raios permitidos", async ({ api }) => {
  assert.equal((await put(api, "radius_default_km", "national", 150)).status, 422);
  assert.equal((await put(api, "radius_default_km", "national", 100)).status, 200);
  const semInicial = await put(api, "radius_allowed_km", "national", [5, 200, 300]);
  assert.equal(semInicial.status, 422);
  assert.equal((await put(api, "radius_allowed_km", "national", [100, 50])).status, 422);
});

check("P1-T8: rampa, intervalo e limites de bounce coerentes entre si", async ({ api }) => {
  assert.equal((await put(api, "send_daily_ramp", "email", [5, 5, 10])).status, 422);
  assert.equal((await put(api, "send_interval_minutes", "email", { min: 30, max: 15 })).status, 422);
  assert.equal((await put(api, "send_interval_minutes", "email", { min: 15, max: 25, extra: 1 })).status, 422);
  assert.equal((await put(api, "send_step_up_max_hard_bounce_pct", "email", 3)).status, 422);
  assert.equal((await put(api, "send_stop_hard_bounce_pct", "email", 2)).status, 422);
  assert.equal((await put(api, "send_stop_hard_bounce_pct", "email", 4)).status, 200);
});

check("P1-T8: volume mínimo aceita escopo por fornecedor e recusa commodity inexistente", async ({ api }) => {
  assert.equal((await put(api, "volume_min", "coffee:international:FoodEra", 6)).status, 200);
  assert.equal((await put(api, "volume_min", "unobtainium:national", 6)).status, 422);
  assert.equal((await put(api, "volume_min", "corn", 6)).status, 422);
});

check("P1-T8: rastreamento de abertura não é editável (K5 depende de T1/T11)", async ({ api }) => {
  const r = await put(api, "open_tracking_enabled", "email", true);
  assert.equal(r.status, 422);
  assert.equal(r.data.error.code, "parameter_not_editable");
});

test("P1-T8: validador puro recusa tipo errado", () => {
  assert.throws(() => validateParameter("confidence_min", "global", "50"), /intervalo/);
  assert.throws(() => validateParameter("campaign_review_days", "global", 1.5), /intervalo/);
  assert.equal(validateParameter("period_default_months", "international", 12), 12);
});
