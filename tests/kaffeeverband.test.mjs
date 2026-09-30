import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { parseDirectory, classifyCoffeeProfile, isGermanPlace } from "../src/adapters/kaffeeverband.js";
import { discover, validateCandidates } from "../src/discovery.js";

// Estrutura copiada da página real (https://www.kaffeeverband.de/de/kaffeekontakte/, 2026-09-28), com dados sintéticos.
const li = (slug, name, place, site) =>
  `<li data-zip="10000" data-alphabetic="a"> <div class="row"> <div class="col-xs-12 col-sm-6"> <p><strong>${name}</strong><br> </p> <p>${place}</p> ${site ? `<p><a href="${site}" target="_blank">Website</a></p>` : ""} </div> <aside class="col-xs-12 col-sm-2"> <a href="/de/kaffeekontakte/${slug}/" class="btn btn-lg">Zum Profil</a> </aside> </div> </li>`;
const DIRECTORY = `<form id="database-searchform"><input name="s"></form><ul class="company-list list-unstyled">${[
  li("importhaus-nord", "Importhaus Nord GmbH", "20457 Hamburg", "https://importhaus.example/"),
  li("kleine-roesterei", "Kleine Rösterei GmbH", "94032 Passau", "https://kleine.example/"),
  li("kaffee-logistik", "Kaffee Logistik GmbH", "28217 Bremen", null),
  li("swiss-trading", "Swiss Trading AG", "3008 Bern", null),
  li("wiener-kaffee", "Wiener Kaffee GmbH", "12345 Wien - Österreich", null),
].join("")}</ul>`;
const PROFILES = {
  "importhaus-nord": "PROFIL Wir sind Importeur von Rohkaffee seit 1950 und beliefern Röstereien in ganz Deutschland mit Kaffees aus Brasilien und Kolumbien.",
  "kleine-roesterei": "PROFIL In unserer Rösterei rösten wir handwerklich. Wir importieren direkt vom Farmer in Minas Gerais.",
  "kaffee-logistik": "PROFIL Lagerung und Spedition von Rohkaffee im Bremer Hafen.",
};

test("Kaffeeverband: lista do diretório, país pelo CEP e regras definidas antes da consulta", () => {
  const list = parseDirectory(DIRECTORY);
  assert.deepEqual(list.map((e) => [e.externalId, e.name, e.place]), [
    ["importhaus-nord", "Importhaus Nord GmbH", "20457 Hamburg"],
    ["kleine-roesterei", "Kleine Rösterei GmbH", "94032 Passau"],
    ["kaffee-logistik", "Kaffee Logistik GmbH", "28217 Bremen"],
    ["swiss-trading", "Swiss Trading AG", "3008 Bern"],
    ["wiener-kaffee", "Wiener Kaffee GmbH", "12345 Wien - Österreich"],
  ]);
  assert.equal(list[0].profileUrl, "https://www.kaffeeverband.de/de/kaffeekontakte/importhaus-nord/");
  assert.deepEqual(list.map((e) => isGermanPlace(e.place)), [true, true, true, false, false]);
  // Importador que abastece torrefações é trader, não torrefação (erro achado no teste real de 2026-09-28).
  const imp = classifyCoffeeProfile("List + Beisler GmbH", "Wir sind nicht einfach nur Händler, sondern leidenschaftlicher Importeur. Als Experte für Rohkaffee bieten wir allen Röstern ausgesuchte Premiumkaffees.");
  assert.equal(imp.role, "trader");
  assert.match(imp.importStatement, /leidenschaftlicher Importeur/);
  const roast = classifyCoffeeProfile("Kleine Rösterei GmbH", PROFILES["kleine-roesterei"]);
  assert.deepEqual([roast.role, roast.mentionsBrazil], ["processor", true]);
  assert.match(roast.importStatement, /importieren direkt vom Farmer/);
  const log = classifyCoffeeProfile("Kaffee Logistik GmbH", PROFILES["kaffee-logistik"]);
  assert.equal(log.role, "non_buyer");
  assert.match(log.reason, /prestador/);
  assert.equal(classifyCoffeeProfile("Beispiel GmbH", "Wir sind ein Unternehmen.").role, "unclassified");
  // Correções do teste real: prestador com "Handel" no texto é descartado; torrefação sem trema; fornecer "aus unserer Rösterei" não é trader.
  assert.equal(classifyCoffeeProfile("Vollers Group GmbH", "Logistik und Lagerung für den Rohkaffeehandel in Europa.").role, "non_buyer");
  // Nome sozinho não descarta (decisão de 2026-09-30): sem evidência no texto, vai para triagem.
  const neu = classifyCoffeeProfile("Neuhaus Neotec Maschinen- und Anlagenbau GmbH", "Röstanlagen für den Handel.");
  assert.equal(neu.role, "unclassified");
  assert.match(neu.reason, /nome sugere prestador.*triagem manual/);
  assert.equal(classifyCoffeeProfile("Neuhaus Neotec Maschinen- und Anlagenbau GmbH", "NEUHAUS NEOTEC gehört weltweit zu den führenden Herstellern im Anlagenbau für die Kaffeeverarbeitung. Wir bieten Maschinen für jede Röstung.").role, "non_buyer", "texto mostra atividade incompatível");
  // Texto real da Haberland (2026-09-30): nome de prestador, mas torra própria no texto — não é descartada.
  assert.equal(classifyCoffeeProfile("Haberland Getränkesysteme GmbH", "Seit Anfang der 2000er sind wir im Dienstleistungsgeschäft mit dem Betrieb von Verpflegungsautomaten tätig. Genau das brachte uns 2018 auf die Idee, unseren eigenen Kaffee zu rösten. Der erste Röster zog bei uns ein, wir gründeten die Marke „Moin Bohne“.").role, "processor");
  assert.equal(classifyCoffeeProfile("Panea Kaffeeroester", "Wir liefern frischen Kaffee aus unserer Rösterei an Gastronomie.").role, "processor");
  assert.equal(classifyCoffeeProfile("Schirmer Kaffee GmbH", "Wir beliefern Handel und Gastronomie mit Kaffee aus unserer Rösterei in Dortmund.").role, "processor");
  assert.equal(classifyCoffeeProfile("Röst & Pack Maschinen e.K.", "Verpackungsmaschinen für Kaffee.").role, "non_buyer");
  // Texto real do perfil da Schirmer (2026-09-28): torrefação private label que compra café verde na origem.
  const schirmer = classifyCoffeeProfile("Schirmer Kaffee GmbH", "Schirmer Kaffee konzipiert und produziert für Retailer und Gastronomie individuelle Hauskaffees, von der Rohkaffeeauswahl über die Komposition und Röstung bis zur Verpackung. Das gilt auch für den Rohkaffeeeinkauf, der vorwiegend aus Anbauländern mit kleinbäuerlicher Erzeugerstruktur bezogen wird. Schirmer Kaffee ist einer der führenden Private Label Kaffeeröster.");
  assert.equal(schirmer.role, "processor");
  // Textos reais (2026-09-28) que exigiram ajuste: fornecedor de café verde a torrefações; perfil vazio não é descartado.
  assert.equal(classifyCoffeeProfile("Coffy Handels-Gesellschaft Bremen m.b.H.", "Die Coffy Handels-Gesellschaft Bremen m.b.H. beliefert Röstereien und Handelshäuser mit unbearbeiteten oder entkoffeinierten Rohkaffees.").role, "trader");
  assert.equal(classifyCoffeeProfile("Gollücke & Rothfos GmbH", "Wir fördern und leiten den Dialog zwischen Kaffee-Produzenten in den Ursprungsländern, Exporteuren und unseren Kunden.").role, "trader");
  assert.equal(classifyCoffeeProfile("Röst & Pack Maschinen e.K.", "Röst & Pack – der One-Stopp-Shop für Kaffeeröstereien. Als Handelsvertretung bündeln wir die Lösungen renommierter Maschinenbauer.").role, "non_buyer");
  assert.equal(classifyCoffeeProfile("Rigano caffe - Kaffeerösterei. Kaffeemaschinen. Service.", "Wir rösten täglich frisch.").role, "processor");
  assert.equal(classifyCoffeeProfile("Ecom Kaffee GmbH", "").role, "empty");
  assert.equal(classifyCoffeeProfile("Kaffeerösterei Elbe455 GmbH", "").role, "processor", "perfil vazio: nome de torrefação decide");
  // Consultoria que cita importadores não declara importar; importador/atacadista sem torrefação própria é trader.
  const cts = classifyCoffeeProfile("CTS Coffee Trading Stehl GmbH", "Mit CTS stehen wir Ihnen als unabhängiger Berater im Einkauf von Rohkaffee zur Verfügung. Durch zahlreiche Kooperationen mit Importeuren und Kaffeeröstern.");
  assert.deepEqual([cts.role, cts.importStatement], ["non_buyer", null]);
  assert.equal(classifyCoffeeProfile("Dethlefsen & Balk GmbH", "Dethlefsen & Balk ist eines der ältesten Handelshäuser Hamburgs und wir beliefern als Importeur, Hersteller und Großhändler Fachgeschäfte mit Tee, Süßwaren und Kaffee.").role, "trader");
  assert.equal(classifyCoffeeProfile("Panea Kaffeeroester", "Kaffeemaschinen und frischer Kaffee.").role, "processor");
});

async function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, ["DEU", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const d = driver(ctx.env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  const analysis = (await ctx.api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  const sel = await ctx.api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  const s = (await ctx.api(`/api/campaigns/${sel.data.campaigns[0].id}/foreign-search`, "POST", { confirm: true })).data;
  return { ...ctx, searchId: s.id, campaignId: sel.data.campaigns[0].id };
}
const admin = { tenant_id: "eag-internal", id: "system-admin", role: "admin" };
const req = (b) => new Request("https://x/api", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } });
function site() {
  const calls = { search: 0, profile: 0 };
  const fetchImpl = async (url) => {
    const u = new URL(url);
    assert.equal(u.host, "www.kaffeeverband.de");
    if (u.searchParams.has("s")) {
      calls.search++;
      return new Response(DIRECTORY, { status: 200 });
    }
    calls.profile++;
    const slug = u.pathname.split("/").filter(Boolean).pop();
    // Estrutura real: menu e rodapé com "Handel, Kaffeepreis & Logistik" fora da seção PROFIL (não podem contar).
    const body = (PROFILES[slug] ?? "PROFIL Wir sind ein Unternehmen.").replace(/^PROFIL /, "");
    return new Response(`<html><nav>Handel, Kaffeepreis &amp; Logistik</nav><h4>PROFIL</h4> <img src="x.jpg"> ${body} </div><div class="col-sm-4"><h4>KONTAKTINFORMATIONEN</h4><ul><li>Beispielweg 1</li></ul></div><footer>Handel, Kaffeepreis &amp; Logistik · Verpackung</footer></html>`, { status: 200 });
  };
  return { calls, fetchImpl };
}

test("Kaffeeverband/fluxo: descoberta descarta fora do país com motivo; validação por perfil com cache; aceitar gera sinal próprio", async (t) => {
  const { env, api, DB, searchId } = await world(t);
  const s1 = site();
  const r = await discover(req({ source: "de_coffee_assoc" }), env, admin, "rid", searchId, { fetch: s1.fetchImpl });
  assert.equal(s1.calls.search, 2, "uma busca por termo (Rohkaffee, Rösterei)");
  assert.equal(s1.calls.profile, 0, "descoberta não abre perfis");
  assert.equal(r.found, 5);
  let d = r.discovery;
  assert.equal(d.counts.autoDismissed, 2, "Suíça e Áustria descartadas");
  assert.ok(d.processors.filter((c) => c.status === "dismissed").every((c) => /fora da Alemanha/.test(c.dismissReason)));
  assert.equal(d.counts.awaitingValidation, 3);
  // Segunda etapa: só as 3 relevantes; logística descartada automaticamente, com motivo.
  const v = await validateCandidates(req({ limit: 20 }), env, admin, "rid", searchId, { fetch: s1.fetchImpl, pause: async () => {} });
  assert.deepEqual([v.checked, v.calls, v.reusedFromCache], [3, 3, 0]);
  d = v.discovery;
  const by = Object.fromEntries([...d.processors, ...d.traders].map((c) => [c.name, c]));
  assert.equal(by["Importhaus Nord GmbH"].role, "trader");
  assert.equal(by["Kleine Rösterei GmbH"].role, "processor");
  assert.equal(by["Kaffee Logistik GmbH"].status, "dismissed");
  assert.match(by["Kaffee Logistik GmbH"].dismissReason, /\[automático\] texto descreve prestador/);
  assert.equal(d.counts.relevant, 2);
  assert.equal(d.counts.withImportStatement, 2);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM research_cache").get().n, 3);
  const cache = DB.raw.prepare("SELECT * FROM research_cache WHERE external_id='kleine-roesterei'").get();
  assert.ok(cache.refresh_after > cache.checked_at, "prazo de atualização da fonte");
  // Outra busca da mesma empresa: nenhuma nova consulta de perfil (cache dentro do prazo).
  DB.raw.prepare("DELETE FROM discovery_candidates").run();
  const s2 = site();
  const again = await discover(req({ source: "de_coffee_assoc" }), env, admin, "rid", searchId, { fetch: s2.fetchImpl });
  assert.equal(again.reusedFromCache, 3);
  assert.equal(s2.calls.profile, 0);
  // Aceitar: a declaração da própria empresa vira evidência (sinal, pendente de validação) → potencial compradora.
  d = (await api(`/api/foreign-searches/${searchId}/discovery`)).data;
  const roaster = d.processors.find((c) => c.name === "Kleine Rösterei GmbH");
  assert.equal((await api(`/api/foreign-searches/${searchId}/discovery/accept`, "POST", { ids: [roaster.id] })).data.accepted, 1);
  const res = (await api(`/api/foreign-searches/${searchId}`)).data;
  const card = res.groups.consumers[0];
  assert.equal(card.buyerStatus, "potential");
  assert.equal(card.buyerStatusLabel, "potencial compradora (sinal próprio, a validar)");
  assert.deepEqual(card.states, { found: true, potentialBuyer: true, importerConfirmed: false, brazilOriginConfirmed: false, finalConsumerConfirmed: false });
  assert.match(card.indications[0].reference, /importieren direkt vom Farmer/);
  assert.equal(card.indications[0].sourceUrl, "https://www.kaffeeverband.de/de/kaffeekontakte/kleine-roesterei/");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM company_conditions WHERE status='confirmed'").get().n, 0, "declaração não confirma importação");
  assert.equal(res.metrics.cost.validCandidates, 1);
  assert.equal(res.metrics.cost.costPerValidUsd, 0);
  assert.ok(res.metrics.cost.secondsPerValid !== null);
  // Importadora confirmada só com documento da empresa conferido (qualquer origem); origem Brasil à parte.
  const doc = await api(`/api/companies/${card.id}/evidence`, "POST", { category: "business", evidenceType: "customs_record", reference: "Declaração de importação de café verde (Santos)", factDate: "2026-05-02", consultedAt: "2026-09-28", validationStatus: "valid", productId: "product-05", market: "international", supports: ["imports"] });
  assert.equal(doc.status, 201);
  const c2 = (await api(`/api/foreign-searches/${searchId}`)).data.groups.consumers[0];
  assert.equal(c2.buyerStatusLabel, "importadora confirmada (origem Brasil não comprovada)");
  assert.deepEqual([c2.states.importerConfirmed, c2.states.brazilOriginConfirmed, c2.states.finalConsumerConfirmed], [true, false, false]);
});
