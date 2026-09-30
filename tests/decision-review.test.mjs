import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { discover } from "../src/discovery.js";
import { researchCandidateContacts } from "../src/discovery.js";

const admin = { tenant_id: "eag-internal", id: "system-admin", role: "admin" };
const req = (body = {}) => new Request("https://x/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  Object.assign(ctx.env, { EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Barueri/SP" });
  keepCountries(ctx.DB, ["DEU", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const d = driver(ctx.env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  const analysis = (await ctx.api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  const sel = await ctx.api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  const searchId = (await ctx.api(`/api/campaigns/${sel.data.campaigns[0].id}/foreign-search`, "POST", { confirm: true })).data.id;
  const elements = [
    { type: "node", id: 31, tags: { name: "Kleine Rösterei", craft: "coffee_roaster", "addr:city": "Passau", website: "https://kleine-roesterei.example" } },
    { type: "node", id: 32, tags: { name: "Veredelung Nord", craft: "coffee_roaster", "addr:city": "Bremen", website: "https://veredelung.example" } },
    { type: "node", id: 33, tags: { name: "Rösterei Fern", craft: "coffee_roaster", "addr:city": "Kiel", website: "https://fern.example" } },
  ];
  await discover(req({ source: "osm" }), ctx.env, admin, "rid", searchId, { fetch: async () => new Response(JSON.stringify({ elements }), { status: 200 }) });
  const disc = (await ctx.api(`/api/foreign-searches/${searchId}/discovery`)).data;
  const byName = Object.fromEntries(disc.processors.map((c) => [c.name, c.id]));
  return { ...ctx, searchId, byName };
}

test("Revisão para decisão: decisões, textos lado a lado e dez candidatas a partir do que está gravado; nada é aceito", async (t) => {
  const { api, DB, env, searchId, byName } = await world(t);
  // Sites: um com aviso legal, um que recusa a Cloudflare (403) — estado técnico, não ausência.
  const site = async (u) => {
    const x = new URL(String(u));
    if (x.hostname === "fern.example") return new Response("forbidden", { status: 403 });
    if (x.pathname === "/impressum") return new Response("<h1>Impressum</h1><p>Geschäftsführer: Anna Beispiel</p><p>E-Mail: info@x.example</p>", { status: 200 });
    return new Response("nope", { status: 404 });
  };
  await researchCandidateContacts(req({}), env, admin, "rid", searchId, { fetch: site });
  let r = (await api(`/api/foreign-searches/${searchId}/review`)).data;
  assert.equal(r.decisions.commercialValidation.status, "pendente");
  assert.match(r.decisions.commercialValidation.phrase, /café verde em grão, não torrado e não descafeinado \(SH 0901\.11\)/);
  assert.match(r.decisions.commercialValidation.authorizes, /Não autoriza envio/);
  assert.equal(r.decisions.r148.status, "proposta — não aplicada");
  assert.deepEqual(r.decisions.texts.steps.map((z) => z.day), [0, 4]);
  assert.equal(r.decisions.texts.steps[0].de.subject, "Zuständige Person für den Rohkaffee-Einkauf");
  assert.equal(r.decisions.texts.steps[1].de.subject, "Zuständige Person für den Rohkaffee-Einkauf", "acompanhamento sem Re: (envio não encadeia)");
  assert.equal(r.decisions.texts.steps[0].pt.subject, "Responsável pela compra de café verde");
  assert.equal(r.snov.configured, false);
  assert.ok(r.snov.steps.some((q) => /wrangler secret put SNOV_CLIENT_ID/.test(q)));
  assert.equal(r.top10.length, 3);
  const kr = r.top10.find((c) => c.name === "Kleine Rösterei");
  assert.deepEqual(kr.contact.people.map((q) => q.name), ["Anna Beispiel"]);
  assert.equal(kr.size.note, "desconhecido — pendência pesquisável");
  const fern = r.unreachable.find((u) => u.name === "Rösterei Fern");
  assert.equal(fern.httpStatus, 403);
  assert.ok(fern.assisted.some((l) => /unternehmensregister/.test(l.url)), "fontes alternativas permitidas");
  assert.ok(r.top10.find((c) => c.name === "Rösterei Fern").pending.some((q) => /estado técnico/.test(q)), "inacessível não é ausência");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM discovery_candidates WHERE status='accepted'").get().n, 0, "nada aceito");
  // Investigação: prestadora que beneficia produto de terceiros sai das consumidoras e vai para "classificação a revisar".
  const inv = (id, b) => api(`/api/foreign-searches/${searchId}/discovery/${id}`, "PATCH", b);
  assert.equal((await inv(byName["Veredelung Nord"], { activityType: "toll_processing", activityEvidence: "Dienstleister für die Veredelung" })).status, 422, "fonte obrigatória");
  assert.equal((await inv(byName["Veredelung Nord"], { activityType: "toll_processing", activityEvidence: "'Dienstleister für die Veredelung von Rohkaffee'", activitySourceUrl: "https://veredelung.example/", groupLink: "confirmed", groupNote: "'Teil der X-Gruppe' (texto próprio)", groupSourceUrl: "https://veredelung.example/" })).status, 200);
  r = (await api(`/api/foreign-searches/${searchId}/review`)).data;
  assert.ok(!r.top10.some((c) => c.name === "Veredelung Nord"));
  assert.equal(r.reclassify[0].name, "Veredelung Nord");
  assert.equal(r.reclassify[0].group.level, "confirmado");
  // Grupo reduz prioridade, não descarta; devolução de descartada é ação de Rogério, com motivo.
  await api(`/api/foreign-searches/${searchId}/discovery/dismiss`, "POST", { ids: [byName["Rösterei Fern"]], reason: "teste de devolução" });
  assert.equal((await api(`/api/foreign-searches/${searchId}/discovery/restore`, "POST", { ids: [byName["Rösterei Fern"]] })).status, 422, "motivo obrigatório");
  assert.equal((await api(`/api/foreign-searches/${searchId}/discovery/restore`, "POST", { ids: [byName["Rösterei Fern"]], reason: "Descarte indevido: torra própria" })).status, 200);
  assert.equal(DB.raw.prepare("SELECT status FROM discovery_candidates WHERE id=?").get(byName["Rösterei Fern"]).status, "new");
});

test("Devolução sugerida só com torra em primeira pessoa: fornecedor 'für Kaffeeröstereien' não entra; 'eigenen Kaffee zu rösten' entra", async (t) => {
  const { api, DB, searchId, byName } = await world(t);
  const put = (name, text) => {
    const c = DB.raw.prepare("SELECT external_id FROM discovery_candidates WHERE id=?").get(byName[name]);
    DB.raw.prepare("INSERT INTO research_cache(source,external_id,url,checked_at,refresh_after,result_json) VALUES ('de_coffee_assoc',?,?,?,?,?)").run(c.external_id, "https://x", "2026-09-30", "2027-03-30", JSON.stringify({ role: "non_buyer", profileText: text }));
    DB.raw.prepare("UPDATE discovery_candidates SET status='dismissed',dismiss_reason='[automático] perfil de prestador (teste), não comprador de café verde' WHERE id=?").run(byName[name]);
  };
  put("Veredelung Nord", "Röst & Pack – der One-Stopp-Shop für Kaffeeröstereien. Wir liefern Maschinen.");
  put("Rösterei Fern", "Seit 2018 kam die Idee, unseren eigenen Kaffee zu rösten. Marke Moin Bohne.");
  const r = (await api(`/api/foreign-searches/${searchId}/review`)).data;
  assert.deepEqual(r.restoreSuggestions.map((c) => c.name), ["Rösterei Fern"]);
});
