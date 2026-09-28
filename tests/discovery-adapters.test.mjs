import test from "node:test";
import assert from "node:assert/strict";
import { overpassQuery, osmCandidates, frCandidates, noCandidates, gleifLookup, sourcesFor } from "../src/adapters/discovery.js";
import { proposalFor, nafCodes, sn2007Codes, bandFromEmployees } from "../src/discovery-map.js";

const json = (body, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("Descoberta: mapa commodity → atividades que usam a commodity (proposta versionada) e códigos por registro", () => {
  const p = proposalFor(["090111"]);
  assert.equal(p.hs4, "0901");
  assert.deepEqual(p.processors.nace, ["10.83"]);
  assert.deepEqual(p.traders.nace, ["46.37"]);
  assert.match(p.version, /descoberta-v1/);
  assert.equal(proposalFor(["999999"]), null, "sem mapeamento: a pessoa informa, nada é inventado");
  assert.deepEqual(nafCodes(["10.83", "10.13"]), ["10.83Z", "10.13A", "10.13B"]);
  assert.deepEqual(sn2007Codes(["10.83"]), ["10.830"]);
  assert.deepEqual([bandFromEmployees(3), bandFromEmployees(10), bandFromEmployees(49), bandFromEmployees(50), bandFromEmployees(250), bandFromEmployees(null)], ["micro", "small", "small", "medium", "medium_plus", null]);
  assert.deepEqual(sourcesFor("DE").filter((s) => s.available).map((s) => s.key), ["osm"]);
  assert.deepEqual(sourcesFor("FR").filter((s) => s.available).map((s) => s.key), ["osm", "fr_registry"]);
});

test("Descoberta/OSM: consulta por país e etiquetas; loja e café fora; servidor sobrecarregado é erro, nunca lista vazia", async () => {
  const q = overpassQuery("DE", [["craft", "coffee_roaster"], ["product", /coffee|kaffee/]]);
  assert.match(q, /area\["ISO3166-1"="DE"\]/);
  assert.match(q, /nwr\["craft"="coffee_roaster"\]\(area\.a\);/);
  assert.match(q, /nwr\["product"~"coffee\|kaffee",i\]\(area\.a\);/);
  assert.throws(() => overpassQuery("DEU", [["craft", "x"]]), /duas letras/);
  const f = json({
    elements: [
      { type: "node", id: 1, tags: { name: "Kleine Rösterei", craft: "coffee_roaster", "addr:city": "Passau", website: "https://kr.example" } },
      { type: "way", id: 2, tags: { name: "Café da esquina", amenity: "cafe", product: "coffee" } },
      { type: "node", id: 3, tags: { craft: "coffee_roaster" } },
      { type: "node", id: 4, tags: { name: "Werk", man_made: "works", product: "coffee", "contact:website": "https://werk.example", operator: "Werk GmbH" } },
    ],
  });
  const r = await osmCandidates({ iso2: "DE", filters: [["craft", "coffee_roaster"]] }, f);
  assert.deepEqual(r.candidates.map((c) => c.name), ["Kleine Rösterei", "Werk"], "sem nome e ponto de venda ficam fora");
  assert.deepEqual([r.candidates[0].externalId, r.candidates[0].recordUrl, r.candidates[0].website, r.candidates[0].city], ["node/1", "https://www.openstreetmap.org/node/1", "https://kr.example", "Passau"]);
  assert.equal(r.candidates[1].legalNameHint, "Werk GmbH");
  assert.match(r.attribution, /OpenStreetMap/);
  await assert.rejects(osmCandidates({ iso2: "DE", filters: [["craft", "x"]] }, async () => new Response("<html>504</html>", { status: 504 })), (e) => e.kind === "temporary");
});

test("Descoberta/França: atividade NAF e porte oficial (faixa INSEE) com fonte; porte-alvo vira filtro; 429 é temporário", async () => {
  const urls = [];
  const page = (n, results, total_pages = 2) => ({ results, total_results: 3, total_pages, page: n });
  const f = async (url) => {
    urls.push(url);
    const n = Number(new URL(url).searchParams.get("page"));
    return new Response(JSON.stringify(n === 1
      ? page(1, [{ siren: "111", nom_complet: "TORREFACTION A", nom_raison_sociale: "TORREFACTION A SAS", activite_principale: "10.83Z", tranche_effectif_salarie: "12", annee_tranche_effectif_salarie: "2023", categorie_entreprise: "PME", siege: { libelle_commune: "LYON" } }, { siren: "222", nom_complet: "CAFE B", activite_principale: "10.83Z", tranche_effectif_salarie: "NN", siege: {} }])
      : page(2, [{ siren: "333", nom_complet: "C", activite_principale: "10.83Z", tranche_effectif_salarie: "22", siege: {} }])), { status: 200 });
  };
  const r = await frCandidates({ nace: ["10.83"], sizes: ["small", "medium"] }, f);
  assert.equal(urls.length, 2, "pagina até o fim");
  assert.match(urls[0], /activite_principale=10\.83Z/);
  assert.match(urls[0], /tranche_effectif_salarie=11,12,21,22,31/);
  assert.deepEqual(r.candidates.map((c) => c.size?.band ?? null), ["small", null, "medium"]);
  assert.match(r.candidates[0].size.source, /INSEE, faixa de efetivo 12 \(2023\)/);
  assert.deepEqual(r.candidates[0].registry, { id: "111", type: "SIREN" });
  assert.deepEqual([r.candidates[0].name, r.candidates[0].legalNameHint], ["TORREFACTION A", "TORREFACTION A SAS"]);
  await assert.rejects(frCandidates({ nace: ["10.83"] }, json({}, 429)), (e) => e.kind === "temporary" && e.details.rateLimited);
});

test("Descoberta/Noruega: porte pelo número de empregados, site normalizado; GLEIF devolve identidade jurídica", async () => {
  const r = await noCandidates({ nace: ["10.83"] }, json({ page: { totalElements: 2 }, _embedded: { enheter: [
    { organisasjonsnummer: "9", navn: "KAFFE AS", antallAnsatte: 12, hjemmeside: "www.kaffe.no", naeringskode1: { kode: "10.830", beskrivelse: "Bearbeiding av te og kaffe" }, forretningsadresse: { poststed: "OSLO" } },
    { organisasjonsnummer: "8", navn: "MINI AS", naeringskode1: { kode: "10.830" } },
  ] } }));
  assert.deepEqual(r.candidates.map((c) => [c.name, c.size?.band ?? null, c.website]), [["KAFFE AS", "small", "https://www.kaffe.no"], ["MINI AS", null, null]]);
  assert.equal(r.candidates[0].activity.label, "Bearbeiding av te og kaffe");
  const g = await gleifLookup({ name: "Burgkaffee", iso2: "DE" }, json({ data: [{ attributes: { lei: "3912001J48LOOQD7YV54", entity: { legalName: { name: "Burgkaffee-Rösterei GmbH" }, registeredAs: "HRB 13569", legalAddress: { city: "Kempten" }, status: "ACTIVE" } } }] }));
  assert.deepEqual([g[0].legalName, g[0].registeredAs, g[0].status], ["Burgkaffee-Rösterei GmbH", "HRB 13569", "ACTIVE"]);
});
