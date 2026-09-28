import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { discover } from "../src/discovery.js";

const admin = { tenant_id: "eag-internal", id: "system-admin", role: "admin" };
const req = (body) => new Request("https://x/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function world(t, countries = ["DEU", "CHN"]) {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, countries);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const d = driver(ctx.env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  const analysis = (await ctx.api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  const sel = await ctx.api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  const s = (await ctx.api(`/api/campaigns/${sel.data.campaigns[0].id}/foreign-search`, "POST", { confirm: true })).data;
  return { ...ctx, searchId: s.id, campaignId: sel.data.campaigns[0].id };
}
const overpass = (elements) => async (url) => {
  assert.match(String(url), /overpass-api\.de/);
  return new Response(JSON.stringify({ elements }), { status: 200 });
};
const ELEMENTS = [
  { type: "node", id: 11, tags: { name: "Kleine Rösterei", craft: "coffee_roaster", "addr:city": "Passau", website: "https://kleine-roesterei.example" } },
  { type: "node", id: 12, tags: { name: "Bohnen Werk", craft: "coffee_roaster", "addr:city": "Köln" } },
  { type: "node", id: 13, tags: { name: "Café Central", amenity: "cafe", product: "coffee" } },
];

test("Descoberta: fonte gratuita gera 'empresas encontradas'; repetir não duplica; falha da fonte é registrada, nunca lista vazia", async (t) => {
  const { env, api, DB, searchId } = await world(t);
  const run = (body, f) => discover(req(body), env, admin, "rid", searchId, { fetch: f });
  await assert.rejects(run({ source: "fr_registry" }, overpass([])), (e) => e.code === "source_not_available");
  await assert.rejects(run({ source: "osm", role: "trader" }, overpass([])), (e) => e.code === "osm_traders_unsupported");
  const r = await run({ source: "osm" }, overpass(ELEMENTS));
  assert.equal(r.found, 2, "café (ponto de venda) fica fora");
  assert.equal(r.discovery.counts.new, 2);
  assert.equal(r.discovery.stage, "empresa encontrada");
  assert.match(r.discovery.notice, /não prova de compra nem de importação/);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies").get().n, 0, "nada entra no cadastro sem a pessoa aceitar");
  const src = DB.raw.prepare("SELECT * FROM foreign_search_sources WHERE id=?").get(r.runId);
  assert.deepEqual([src.source_kind, src.result_count, src.api_calls, src.cost_usd], ["adapter", 2, 1, 0]);
  assert.match(src.note, /OpenStreetMap \(ODbL\)/);
  await run({ source: "osm" }, overpass(ELEMENTS));
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM discovery_candidates").get().n, 2);
  await assert.rejects(run({ source: "osm" }, async () => new Response("<html>504</html>", { status: 504 })), (e) => e.code === "source_unavailable");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM foreign_search_sources WHERE note LIKE 'FALHA:%'").get().n, 1);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM discovery_candidates").get().n, 2, "falha não apaga nem esvazia");
  const d = (await api(`/api/foreign-searches/${searchId}/discovery`)).data;
  assert.equal(d.proposal.hs4, "0901");
  assert.deepEqual(d.sources.filter((x) => x.available).map((x) => x.key), ["osm"]);
});

test("Descoberta: aceitar cria empresa com atividade e perfil de indício; três níveis — encontrada, potencial, importadora confirmada", async (t) => {
  const { env, api, DB, searchId } = await world(t);
  await discover(req({ source: "osm" }), env, admin, "rid", searchId, { fetch: overpass(ELEMENTS) });
  const d = (await api(`/api/foreign-searches/${searchId}/discovery`)).data;
  const [kr, bw] = [d.processors.find((c) => c.name === "Kleine Rösterei"), d.processors.find((c) => c.name === "Bohnen Werk")];
  const acc = await api(`/api/foreign-searches/${searchId}/discovery/accept`, "POST", { ids: [kr.id] });
  assert.equal(acc.data.accepted, 1);
  const companyId = acc.data.results[0].companyId;
  assert.equal((await api(`/api/foreign-searches/${searchId}/discovery/dismiss`, "POST", { ids: [bw.id], reason: "Loja de varejo, não torra em escala" })).status, 200);
  const c = DB.raw.prepare("SELECT * FROM companies WHERE id=?").get(companyId);
  assert.deepEqual([c.legal_name, c.website, c.country_code], ["Kleine Rösterei", "https://kleine-roesterei.example/", "DE"]);
  assert.match(c.activity_text, /craft=coffee_roaster · Passau/);
  const prof = DB.raw.prepare("SELECT * FROM buyer_profiles WHERE company_id=?").get(companyId);
  assert.equal(prof.profile_class, "possible_final_consumer", "atividade é indício: só 'possível', nunca 'confirmada'");
  assert.match(prof.basis, /Indício, não prova de compra/);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM company_conditions WHERE status='confirmed'").get().n, 0);
  // Nível 1: encontrada.
  let s = (await api(`/api/foreign-searches/${searchId}`)).data;
  let card = s.groups.unverified[0];
  assert.equal(s.groups.consumers.length, 0, "sem sinal próprio de importação não é candidata importadora");
  assert.equal(card.buyerStatus, "found");
  assert.match(card.buyerStatusLabel, /importação não verificada/);
  assert.equal(card.ownEvidence, 0);
  assert.ok(card.validationLinks.some((l) => l.url.includes(encodeURIComponent("site:kleine-roesterei.example"))), "validação assistida no site da empresa");
  assert.deepEqual([s.metrics.yield.found, s.metrics.yield.foundPending, s.metrics.yield.foundDismissed, s.metrics.yield.candidates, s.metrics.yield.withOwnEvidence], [2, 0, 1, 1, 0]);
  assert.ok(s.humanSteps.some((h) => /sinal próprio de importação/.test(h)));
  assert.ok(s.humanSteps.some((h) => /base paga/.test(h)));
  // Nível 2: potencial (indício próprio, ex.: página da empresa citando café do Brasil).
  await api(`/api/companies/${companyId}/evidence`, "POST", { category: "commercial_signal", evidenceType: "company_website", reference: "Página 'Unsere Bohnen' cita Santos (Brasil)", sourceUrl: "https://kleine-roesterei.example/bohnen", factDate: "2026-09-01", consultedAt: "2026-09-27", supports: ["buys_commodity"] });
  s = (await api(`/api/foreign-searches/${searchId}`)).data;
  card = s.groups.consumers[0];
  assert.equal(card.buyerStatus, "potential");
  assert.equal(s.metrics.yield.withOwnEvidence, 1);
  // Nível 3: importadora confirmada — só com evidência empresarial validada da própria empresa.
  const ev = await api(`/api/companies/${companyId}/evidence`, "POST", { category: "business", evidenceType: "commercial_document", reference: "Fatura de importação de café verde de Santos", factDate: "2026-06-10", consultedAt: "2026-09-27", validationStatus: "valid", productId: "product-05", market: "international", supports: ["imports_from_brazil"] });
  await api(`/api/companies/${companyId}/conditions/product-05/imports_from_brazil`, "PUT", { status: "confirmed", evidenceId: ev.data.id });
  s = (await api(`/api/foreign-searches/${searchId}`)).data;
  assert.equal(s.groups.consumers[0].buyerStatus, "confirmed_importer");
  assert.equal(s.metrics.yield.confirmedImporters, 1);
});

test("Descoberta/França: registro oficial traz porte com fonte (pequena no ICP); traders em grupo separado; duplicata não funde", async (t) => {
  const { env, api, DB, searchId, campaignId } = await world(t, ["DEU", "FRA", "CHN"]);
  // Mesma busca simulada para a França (a lista mensal do teste só tem compra da Alemanha).
  DB.raw.prepare("UPDATE campaigns SET country_code='FR' WHERE id=?").run(campaignId);
  DB.raw.prepare("UPDATE foreign_searches SET iso3='FRA' WHERE id=?").run(searchId);
  const urls = [];
  const fr = async (url, init) => {
    urls.push(String(url));
    if (String(url).includes("ec.europa.eu")) {
      // Serviço EORI: só a torrefação tem registro aduaneiro ativo.
      const body = String(init.body);
      return new Response(`<S:Envelope><S:Body><return>${[...body.matchAll(/<ev:eori>([^<]+)<\/ev:eori>/g)].map((m) => `<result><eori>${m[1]}</eori><status>${m[1] === "FR10000000000011" ? 0 : 1}</status></result>`).join("")}</return></S:Body></S:Envelope>`, { status: 200 });
    }
    const trader = String(url).includes("46.37");
    return new Response(JSON.stringify({ total_results: 1, total_pages: 1, results: [trader
      ? { siren: "900", nom_complet: "NEGOCE CAFE", activite_principale: "46.37Z", tranche_effectif_salarie: "11", siege: { libelle_commune: "LE HAVRE", siret: "90000000000019" } }
      : { siren: "100", nom_complet: "TORREFACTION DU SUD", nom_raison_sociale: "TORREFACTION DU SUD SAS", activite_principale: "10.83Z", tranche_effectif_salarie: "12", annee_tranche_effectif_salarie: "2023", categorie_entreprise: "PME", siege: { libelle_commune: "NIMES", siret: "10000000000011" } }] }), { status: 200 });
  };
  await discover(req({ source: "fr_registry" }), env, admin, "rid", searchId, { fetch: fr });
  await discover(req({ source: "fr_registry", role: "trader" }), env, admin, "rid", searchId, { fetch: fr });
  assert.match(urls[0], /tranche_effectif_salarie=11,12,21,22,31/, "porte-alvo pequenas e médias vira filtro do registro");
  assert.doesNotMatch(urls[1], /tranche_effectif_salarie/, "traders sem filtro de porte");
  const d = (await api(`/api/foreign-searches/${searchId}/discovery`)).data;
  assert.deepEqual([d.processors.length, d.traders.length], [1, 1]);
  assert.equal(d.processors[0].size.band, "small");
  assert.deepEqual([d.processors[0].importSignal.status, d.traders[0].importSignal.status, d.counts.withEori], ["valid", "not_valid", 1]);
  const ids = [d.processors[0].id, d.traders[0].id];
  assert.equal((await api(`/api/foreign-searches/${searchId}/discovery/accept`, "POST", { ids })).data.accepted, 2);
  const s = (await api(`/api/foreign-searches/${searchId}`)).data;
  assert.equal(s.groups.consumers[0].name, "TORREFACTION DU SUD SAS");
  assert.equal(s.groups.consumers[0].buyerStatus, "potential", "EORI ativo = sinal próprio de importação, a validar");
  assert.match(s.groups.consumers[0].indications[0].reference, /EORI FR10000000000011 ativo/);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM company_conditions WHERE status='confirmed'").get().n, 0, "EORI nunca confirma importação da commodity");
  assert.deepEqual([s.groups.consumers[0].size.label, s.groups.consumers[0].profile.icpStatus], ["Pequena", "in_icp"]);
  assert.match(s.groups.consumers[0].size.source, /INSEE, faixa de efetivo 12/);
  assert.equal(s.groups.unverified[0].name, "NEGOCE CAFE", "trader sem EORI ativo: importação não verificada");
  assert.equal(s.groups.unverified[0].profile.class, "trader_distributor");
  assert.equal(s.groups.unverified[0].ficha.ok, false, "trader só com exceção registrada");
  assert.equal(DB.raw.prepare("SELECT registration_id_type FROM companies WHERE legal_name='TORREFACTION DU SUD SAS'").get().registration_id_type, "SIREN");
  // Mesmo SIREN encontrado de novo em outra rodada: reaproveita a empresa (P13).
  DB.raw.prepare("DELETE FROM discovery_candidates").run();
  await discover(req({ source: "fr_registry" }), env, admin, "rid", searchId, { fetch: fr });
  const again = (await api(`/api/foreign-searches/${searchId}/discovery`)).data.processors[0];
  const r2 = (await api(`/api/foreign-searches/${searchId}/discovery/accept`, "POST", { ids: [again.id] })).data;
  assert.equal(r2.results[0].companyId, s.groups.consumers[0].id);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE country_code='FR'").get().n, 2);
});

test("Descoberta/OSM pelo navegador: servidor não chama o OSM (recusa a Cloudflare), trata o resultado com o mesmo código e registra", async (t) => {
  const { env, api, DB, searchId } = await world(t);
  const d0 = (await api(`/api/foreign-searches/${searchId}/discovery`)).data;
  assert.match(d0.osmQuery, /area\["ISO3166-1"="DE"\]/, "consulta pronta para o navegador");
  const noNetwork = async () => {
    throw new Error("o servidor não deve chamar o OSM neste caminho");
  };
  const r = await discover(req({ source: "osm", overpass: { elements: ELEMENTS } }), env, admin, "rid", searchId, { fetch: noNetwork });
  assert.equal(r.found, 2);
  const src = DB.raw.prepare("SELECT * FROM foreign_search_sources WHERE id=?").get(r.runId);
  assert.match(src.note, /executada no navegador/);
  assert.equal(src.api_calls, 1);
  // Navegador informa que havia mais do que enviou: a rodada fica marcada como parcial.
  const p = await discover(req({ source: "osm", overpass: { elements: ELEMENTS, totalElements: 900 } }), env, admin, "rid", searchId, { fetch: noNetwork });
  assert.equal(p.truncated, true);
  assert.match(DB.raw.prepare("SELECT note FROM foreign_search_sources WHERE id=?").get(p.runId).note, /lidos 2 de 900/);
  await assert.rejects(discover(req({ source: "osm", overpass: { elements: Array.from({ length: 601 }, (_, n) => ({ type: "node", id: n })) } }), env, admin, "rid", searchId, { fetch: noNetwork }), (e) => e.code === "invalid_overpass");
});
