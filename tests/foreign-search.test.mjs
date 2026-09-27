import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";

// Alemanha com café na lista; campanha nasce da seleção da commodity (R12.7).
async function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, ["DEU", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const src = sources();
  const d = driver(ctx.env, src, { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  const analysis = (await ctx.api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  const sel = await ctx.api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  assert.equal(sel.status, 201, JSON.stringify(sel.data));
  return { ...ctx, src, campaignId: sel.data.campaigns[0].id };
}

async function company(api, searchId, legalName, extra = {}) {
  const r = await api(`/api/foreign-searches/${searchId}/candidates`, "POST", { legalName, sourceLabel: "Europages — busca por café", sourceUrl: "https://www.europages.example/cafe", ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.companyId;
}
const profile = (api, id, profileClass) => api(`/api/companies/${id}/profiles`, "POST", { productId: "product-05", profileClass, basis: "Site da empresa descreve a atividade" });
const size = (api, id, sizeBand) => api(`/api/companies/${id}/size`, "PATCH", { sizeBand, source: "Handelsregister e site (equipe)" });

test("Radar: busca só depois da seleção e da autorização; autorizar de novo devolve a mesma busca; vendedor não autoriza", async (t) => {
  const { api, DB, env, campaignId, src } = await world(t);
  // Campanha internacional criada sem seleção na lista do país: sem busca (R12.8).
  DB.raw.exec("INSERT INTO campaigns(id,tenant_id,product_id,market,name,country_code,language,created_by) VALUES ('cp-solta','eag-internal','product-05','international','Café solta','DE','en','system-admin')");
  assert.equal((await api("/api/campaigns/cp-solta/foreign-search", "POST", { confirm: true })).data.error.code, "selection_required");
  assert.equal((await api(`/api/campaigns/${campaignId}/foreign-search`, "POST", {})).data.error.code, "confirmation_required");
  const calls = src.calls.log.length;
  const a = await api(`/api/campaigns/${campaignId}/foreign-search`, "POST", { confirm: true });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.equal(a.data.reused, false);
  assert.deepEqual(a.data.target.sizes, ["small", "medium"], "pequenas e médias por padrão");
  assert.equal(a.data.target.traders, "secondary");
  assert.equal(a.data.country.iso3, "DEU");
  assert.deepEqual(a.data.commodity.hs6, ["090111"]);
  // Roteiro de pesquisa: links montados, nada executado.
  assert.ok(a.data.researchPlan.links.length >= 5);
  assert.match(a.data.researchPlan.note, /não executados/);
  assert.equal(src.calls.log.length, calls, "autorizar não consulta fonte externa");
  const b = await api(`/api/campaigns/${campaignId}/foreign-search`, "POST", { confirm: true });
  assert.equal(b.data.id, a.data.id);
  assert.equal(b.data.reused, true);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM foreign_searches").get().n, 1);
  DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('s','eag-internal','s@example.test','Vendedor','seller_analyst')");
  env.LOCAL_USER_EMAIL = "s@example.test";
  const c2 = DB.raw.prepare("SELECT id FROM campaigns WHERE id<>? AND id<>'cp-solta'").get(campaignId);
  assert.equal(c2, undefined);
  assert.equal((await api(`/api/campaigns/${campaignId}/foreign-search`, "POST", { confirm: true })).status, 403);
});

test("Radar: resultado por empresa — consumidoras/fábricas antes, traders à parte; importadora só com evidência da empresa", async (t) => {
  const { api, DB, campaignId } = await world(t);
  const s = (await api(`/api/campaigns/${campaignId}/foreign-search`, "POST", { confirm: true })).data;
  // Fontes consultadas, com e sem resultado; base paga exige decisão registrada (R13.7).
  const src = await api(`/api/foreign-searches/${s.id}/sources`, "POST", { sourceLabel: "Europages", sourceKind: "public_directory", queryText: "Kaffee Rösterei Deutschland", resultCount: 4, minutes: 25 });
  assert.equal(src.status, 201);
  await api(`/api/foreign-searches/${s.id}/sources`, "POST", { sourceLabel: "Handelsregister", sourceKind: "official_registry", resultCount: 0, minutes: 10, note: "sem resultado útil" });
  assert.equal((await api(`/api/foreign-searches/${s.id}/sources`, "POST", { sourceLabel: "Base de embarques", sourceKind: "paid_database", resultCount: 10, costUsd: 99 })).data.error.code, "paid_source_needs_decision");

  // A: pequena torrefação, importa do Brasil comprovado por registro aduaneiro validado.
  const A = await company(api, s.id, "Kleine Rösterei GmbH", { sourceId: src.data.id, website: "https://kleine-roesterei.example", activityText: "Torrefação de café especial", activitySource: "Site da empresa" });
  await size(api, A, "small");
  await profile(api, A, "possible_final_consumer");
  const ev = await api(`/api/companies/${A}/evidence`, "POST", {
    category: "business", evidenceType: "customs_record", reference: "Registro aduaneiro: café verde do Brasil, 2 contêineres", sourceUrl: "https://registro.example/123",
    factDate: "2026-05-12", consultedAt: "2026-09-27", validationStatus: "valid", productId: "product-05", market: "international", supports: ["imports_from_brazil", "buys_commodity"],
  });
  assert.equal(ev.status, 201, JSON.stringify(ev.data));
  assert.equal((await api(`/api/companies/${A}/conditions/product-05/imports_from_brazil`, "PUT", { status: "confirmed", evidenceId: ev.data.id })).status, 200);
  await api(`/api/companies/${A}/contacts`, "POST", { fullName: "Anna Weber", jobTitle: "Einkaufsleiterin", email: "anna@kleine-roesterei.example", prospectRole: "decision_maker", sourceLabel: "Site — página Impressum", timezone: "Europe/Berlin" });

  // B: média processadora só com indício (anúncio de vaga citando café brasileiro) → potencial compradora a validar.
  const B = await company(api, s.id, "Mittel Verarbeitung GmbH");
  await size(api, B, "medium");
  await profile(api, B, "possible_final_consumer");
  const sig = await api(`/api/companies/${B}/evidence`, "POST", { category: "commercial_signal", evidenceType: "job_posting", reference: "Vaga cita blend com café do Brasil", sourceUrl: "https://jobs.example/9", factDate: "2026-08-01", consultedAt: "2026-09-27", supports: ["buys_commodity"] });
  assert.equal(sig.status, 201);
  // Indício nunca confirma condição (P1, R14.2).
  assert.equal((await api(`/api/companies/${B}/conditions/product-05/buys_commodity`, "PUT", { status: "confirmed", evidenceId: sig.data.id })).data.error.code, "signal_not_proof");
  // Dado de mercado não sustenta condição de empresa.
  assert.equal((await api(`/api/companies/${B}/evidence`, "POST", { category: "market", evidenceType: "country_stat", reference: "Comtrade DEU", consultedAt: "2026-09-27", supports: ["imports_from_brazil"] })).data.error.code, "market_evidence_not_company");

  // C: trader; D: média-mais consumidora; E: micro/MEI.
  const C = await company(api, s.id, "Kaffee Handel Import AG");
  await size(api, C, "medium");
  await profile(api, C, "trader_distributor");
  const D = await company(api, s.id, "Grosse Lebensmittel AG");
  await size(api, D, "medium_plus");
  await profile(api, D, "possible_final_consumer");
  const E = await company(api, s.id, "Mini Café Einzelunternehmen");
  await size(api, E, "micro");
  await profile(api, E, "possible_final_consumer");
  // Mesma empresa encontrada de novo: nada duplica (P13).
  assert.equal((await api(`/api/foreign-searches/${s.id}/candidates`, "POST", { companyId: A, sourceLabel: "LinkedIn empresa" })).data.added, false);

  const r = (await api(`/api/foreign-searches/${s.id}`)).data;
  assert.match(r.notice, /não prova que nenhuma empresa/);
  // Consumidoras: no ICP e pequenas/médias primeiro; importadora comprovada antes do indício; micro no fim.
  assert.deepEqual(r.groups.consumers.map((c) => c.name), ["Kleine Rösterei GmbH", "Mittel Verarbeitung GmbH", "Grosse Lebensmittel AG", "Mini Café Einzelunternehmen"]);
  assert.deepEqual(r.groups.traders.map((c) => c.name), ["Kaffee Handel Import AG"]);
  const a = r.groups.consumers[0];
  assert.equal(a.buyerStatus, "confirmed_importer");
  assert.deepEqual([a.importEvidence[0].sourceUrl, a.importEvidence[0].factDate.slice(0, 10), a.importEvidence[0].type], ["https://registro.example/123", "2026-05-12", "customs_record"]);
  assert.deepEqual([a.size.label, a.size.source, a.activity.text, a.website], ["Pequena", "Handelsregister e site (equipe)", "Torrefação de café especial", "https://kleine-roesterei.example/"]);
  assert.equal(a.contacts[0].name, "Anna Weber");
  assert.equal(a.contacts[0].verified, true);
  assert.equal(a.ficha.ok, true, "pequena no ICP pode ter ficha (exceção de 2026-09-27), sempre com aprovação individual");
  assert.equal(a.ficha.needsIndividualApproval, true);
  assert.ok(a.pending.includes("E-mail do decisor não validado."));
  const b = r.groups.consumers[1];
  assert.equal(b.buyerStatus, "potential");
  assert.equal(b.buyerStatusLabel, "potencial compradora a validar");
  assert.deepEqual([b.indications[0].sourceUrl, b.indications[0].factDate.slice(0, 10), b.indications[0].condition], ["https://jobs.example/9", "2026-08-01", "buys_commodity"]);
  assert.ok(b.pending.some((p) => /Validar o indício/.test(p)));
  assert.ok(b.pending.includes("Nenhum decisor ou comprador com fonte registrada."));
  const e = r.groups.consumers[3];
  assert.equal(e.ficha.ok, false);
  assert.match(e.ficha.reason, /microempresa ou MEI/);
  assert.equal(r.groups.traders[0].ficha.ok, false, "trader só com exceção registrada");
  // Cobertura, custo e rendimento.
  assert.equal(r.metrics.coverage.sourcesConsulted, 2);
  assert.equal(r.metrics.coverage.sourcesWithResults, 1);
  assert.equal(r.metrics.coverage.automaticCompanySource, false);
  assert.match(r.metrics.coverage.note, /nunca é integral/);
  assert.deepEqual([r.metrics.cost.minutes, r.metrics.cost.costUsd, r.metrics.cost.apiCalls], [35, 0, 0]);
  assert.deepEqual(
    [r.metrics.yield.candidates, r.metrics.yield.consumers, r.metrics.yield.traders, r.metrics.yield.inTargetSize, r.metrics.yield.confirmedImporters, r.metrics.yield.potentialBuyers, r.metrics.yield.withVerifiedDecisionMaker],
    [5, 4, 1, 3, 1, 4, 1],
  );
  // Nenhuma empresa ganhou condição pelo dado do país.
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM company_conditions WHERE status='confirmed'").get().n, 1);
  // Encerrar exige gestor e observação; depois, nada se acrescenta.
  assert.equal((await api(`/api/foreign-searches/${s.id}/close`, "POST", { note: "Primeira rodada concluída" })).data.status, "closed");
  assert.equal((await api(`/api/foreign-searches/${s.id}/candidates`, "POST", { legalName: "Outra GmbH", sourceLabel: "x" })).data.error.code, "search_closed");
});
