// Fontes gratuitas de candidatos no exterior (Radar Internacional). Nenhuma exige chave ou contrato; todas são
// consultadas só quando a pessoa pede, com o que foi usado registrado na busca. Resultado = "empresa encontrada":
// atividade no cadastro/mapa é indício de uso, nunca prova de compra ou importação (P1, R12.10).
// Termos conferidos em 2026-09-27 (docs/implementation/FONTES-EMPRESAS-EXTERIOR.md).
import { AdapterError, httpError, fetchJson } from "./errors.js";
import { nafCodes, sn2007Codes, bandFromEmployees } from "../discovery-map.js";

const UA = "EAG-Compass/0.3 (+uso interno EAG Agro)";
const TIMEOUT = 60000;

async function getJson(source, url, init, fetchImpl) {
  const r = await fetchJson(source, url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) } }, fetchImpl, TIMEOUT);
  if (r.status === 429) throw new AdapterError("temporary", `${source}: limite de requisições (429); tente de novo mais tarde.`, { rateLimited: true });
  if (r.status !== 200) throw httpError(source, r.status);
  return r.data;
}

// ---------- OpenStreetMap (Overpass) — mundial, ODbL, sem chave; servidor público para uso moderado ----------
export const OSM_ATTRIBUTION = "© colaboradores do OpenStreetMap (ODbL)";
function osmFilter([k, v]) {
  const esc = (s) => String(s).replace(/["\\]/g, "");
  return v instanceof RegExp ? `nwr["${esc(k)}"~"${esc(v.source)}",i](area.a);` : `nwr["${esc(k)}"="${esc(v)}"](area.a);`;
}
export function overpassQuery(iso2, filters, limit = 500) {
  if (!/^[A-Z]{2}$/.test(iso2)) throw new AdapterError("invalid_request", "País sem código ISO de duas letras.");
  if (!filters.length) throw new AdapterError("invalid_request", "Nenhuma etiqueta do OpenStreetMap para esta commodity.");
  return `[out:json][timeout:90];area["ISO3166-1"="${iso2}"][admin_level=2]->.a;(${filters.map(osmFilter).join("")});out tags center ${limit};`;
}
// Só o servidor principal (FOSSGIS, cobertura mundial). Espelhos testados em 2026-09-27: um regional devolveu 0 resultados
// para a Alemanha (vazio falso) e outros não responderam. Falha do servidor vira erro temporário, nunca "nenhuma empresa".
export const OVERPASS_SERVERS = ["https://overpass-api.de/api/interpreter"];
export async function osmCandidates({ iso2, filters, limit = 500, servers = OVERPASS_SERVERS }, fetchImpl = fetch) {
  const query = overpassQuery(iso2, filters, limit);
  let data, lastError, calls = 0;
  for (const base of servers) {
    calls++;
    try {
      data = await getJson("OpenStreetMap", base, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(query)}` }, fetchImpl);
      break;
    } catch (e) {
      lastError = e;
      if (!e.retryable) throw e;
    }
  }
  if (!data) throw lastError;
  return { query, total: 0, calls, ...parseOverpass(data) };
}

// Mesmo tratamento para a resposta obtida pelo servidor ou pelo navegador (o servidor público do OSM recusa
// conexões vindas da Cloudflare: 521/522 testados em 2026-09-27).
export function parseOverpass(data) {
  if (!Array.isArray(data?.elements)) throw new AdapterError("schema", "OpenStreetMap: resposta sem elements.");
  const out = [];
  for (const e of data.elements) {
    const t = e.tags ?? {};
    const name = t.name || t.operator || t.brand;
    if (!name) continue;
    // Loja e café (ponto de venda) não são fábrica: ficam de fora, a menos que também tenham etiqueta de produção.
    if ((t.amenity === "cafe" || t.shop) && !t.craft && !t.industrial && t.man_made !== "works") continue;
    const tag = t.craft ? `craft=${t.craft}` : t.industrial ? `industrial=${t.industrial}` : t.product ? `product=${t.product}` : t.man_made ? `man_made=${t.man_made}` : "etiqueta";
    out.push({
      source: "osm", externalId: `${e.type}/${e.id}`, name: String(name).slice(0, 250), legalNameHint: t.operator && t.operator !== name ? t.operator : null,
      city: t["addr:city"] || null, website: t.website || t["contact:website"] || null,
      activity: { code: tag, label: tag }, size: null, registry: null,
      recordUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    });
  }
  return { total: out.length, candidates: out, attribution: OSM_ATTRIBUTION };
}

// ---------- França — API Recherche d'entreprises (data.gouv), sem chave; 7 req/s por IP ----------
// Faixa de efetivo INSEE → porte (00 = sem empregado; NN = não informado).
const FR_BAND = { "01": "micro", "02": "micro", "03": "micro", "11": "small", "12": "small", "21": "medium", "22": "medium", "31": "medium", "32": "medium_plus", "41": "medium_plus", "42": "medium_plus", "51": "medium_plus", "52": "medium_plus", "53": "medium_plus" };
// Porte-alvo da busca → faixas de efetivo INSEE (filtro da própria API).
const FR_TRANCHES = { small: ["11", "12"], medium: ["21", "22", "31"], medium_plus: ["32", "41", "42", "51", "52", "53"] };
export async function frCandidates({ nace, sizes = null, maxPages = 4, base = "https://recherche-entreprises.api.gouv.fr" }, fetchImpl = fetch) {
  const codes = nafCodes(nace);
  const tranches = sizes ? sizes.flatMap((z) => FR_TRANCHES[z] ?? []) : [];
  const out = [];
  let total = 0, calls = 0;
  for (let page = 1; page <= maxPages; page++) {
    const url = `${base}/search?activite_principale=${encodeURIComponent(codes.join(","))}&etat_administratif=A${tranches.length ? `&tranche_effectif_salarie=${tranches.join(",")}` : ""}&per_page=25&page=${page}`;
    const d = await getJson("Registro francês (Recherche d'entreprises)", url, {}, fetchImpl);
    calls++;
    if (!Array.isArray(d?.results)) throw new AdapterError("schema", "Registro francês: resposta sem results.");
    total = d.total_results ?? total;
    for (const x of d.results) {
      const band = FR_BAND[x.tranche_effectif_salarie] ?? null;
      out.push({
        source: "fr_registry", externalId: x.siren, name: x.nom_complet || x.nom_raison_sociale, legalNameHint: x.nom_raison_sociale || x.nom_complet,
        city: x.siege?.libelle_commune ?? null, website: null,
        activity: { code: x.activite_principale, label: `NAF ${x.activite_principale}` },
        size: band ? { band, source: `INSEE, faixa de efetivo ${x.tranche_effectif_salarie} (${x.annee_tranche_effectif_salarie ?? "ano não informado"}), via API Recherche d'entreprises; categoria ${x.categorie_entreprise ?? "—"}` } : null,
        registry: { id: x.siren, type: "SIREN" },
        eori: x.siege?.siret ? `FR${x.siege.siret}` : null,
        recordUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${x.siren}`,
      });
    }
    if (page >= (d.total_pages ?? 1)) break;
  }
  return { query: `activite_principale=${codes.join(",")}; etat_administratif=A${tranches.length ? `; tranche_effectif_salarie=${tranches.join(",")}` : ""}`, total, calls, candidates: out, truncated: out.length < total };
}

// ---------- Noruega — Enhetsregisteret (Brønnøysund), NLOD 2.0, sem chave ----------
export async function noCandidates({ nace, base = "https://data.brreg.no/enhetsregisteret/api" }, fetchImpl = fetch) {
  const codes = sn2007Codes(nace);
  const url = `${base}/enheter?naeringskode=${encodeURIComponent(codes.join(","))}&konkurs=false&underAvvikling=false&size=200`;
  const d = await getJson("Registro norueguês (Brønnøysund)", url, {}, fetchImpl);
  const list = d?._embedded?.enheter ?? [];
  const out = list.map((x) => {
    const band = bandFromEmployees(x.antallAnsatte);
    return {
      source: "no_registry", externalId: x.organisasjonsnummer, name: x.navn, legalNameHint: x.navn,
      city: x.forretningsadresse?.poststed ?? null, website: x.hjemmeside ? (/^https?:\/\//.test(x.hjemmeside) ? x.hjemmeside : `https://${x.hjemmeside}`) : null,
      activity: { code: x.naeringskode1?.kode ?? null, label: x.naeringskode1?.beskrivelse ?? null },
      size: band ? { band, source: `Brønnøysund: ${x.antallAnsatte} empregados informados` } : null,
      registry: { id: x.organisasjonsnummer, type: "ORGNR" },
      recordUrl: `https://data.brreg.no/enhetsregisteret/oppslag/enheter/${x.organisasjonsnummer}`,
    };
  });
  return { query: `naeringskode=${codes.join(",")}`, total: d?.page?.totalElements ?? out.length, calls: 1, candidates: out, truncated: out.length < (d?.page?.totalElements ?? 0) };
}

// ---------- GLEIF — identidade jurídica (nome legal, registro, LEI), dados abertos, sem chave ----------
export async function gleifLookup({ name, iso2, base = "https://api.gleif.org/api/v1" }, fetchImpl = fetch) {
  const url = `${base}/lei-records?filter[fulltext]=${encodeURIComponent(name)}&filter[entity.legalAddress.country]=${encodeURIComponent(iso2)}&page[size]=5`;
  const d = await getJson("GLEIF", url, { headers: { Accept: "application/vnd.api+json" } }, fetchImpl);
  return (d?.data ?? []).map((x) => ({
    lei: x.attributes.lei, legalName: x.attributes.entity.legalName.name, registeredAs: x.attributes.entity.registeredAs ?? null,
    city: x.attributes.entity.legalAddress.city ?? null, status: x.attributes.entity.status, recordUrl: `https://search.gleif.org/#/record/${x.attributes.lei}`,
  }));
}

// Fontes disponíveis por país (as demais aparecem como pendentes de chave ou pagas no documento de fontes).
export function sourcesFor(iso2, hs4 = null) {
  return [
    { key: "de_coffee_assoc", label: "Deutscher Kaffeeverband — Kaffeekontakte (diretório de membros)", available: iso2 === "DE" && hs4 === "0901" },
    { key: "osm", label: "OpenStreetMap (fábricas e torrefações mapeadas)", available: true },
    { key: "fr_registry", label: "Registro oficial da França (atividade e porte)", available: iso2 === "FR" },
    { key: "no_registry", label: "Registro oficial da Noruega (atividade, porte e site)", available: iso2 === "NO" },
  ];
}

// ---------- UE — validação EORI (Comissão Europeia, serviço público EOS, sem chave) ----------
// EORI ativo = empresa registrada na aduana para importar/exportar: sinal próprio de comércio exterior.
// Não prova importação da commodity nem origem Brasil. Lotes de até 10 números por chamada.
export async function eoriCheck(eoris, fetchImpl = fetch, base = "https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/validation") {
  const out = new Map();
  let calls = 0;
  const list = [...new Set(eoris.filter((e) => /^[A-Z]{2}[0-9A-Z]{1,15}$/.test(String(e))))];
  for (let i = 0; i < list.length; i += 10) {
    const chunk = list.slice(i, i + 10);
    const body = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ev="http://eori.ws.eos.dds.s/"><soapenv:Header/><soapenv:Body><ev:validateEORI>${chunk.map((e) => `<ev:eori>${e}</ev:eori>`).join("")}</ev:validateEORI></soapenv:Body></soapenv:Envelope>`;
    let r;
    try {
      r = await fetchImpl(base, { method: "POST", headers: { "content-type": "text/xml; charset=utf-8", SOAPAction: "", "User-Agent": UA }, body, signal: AbortSignal.timeout(TIMEOUT) });
    } catch {
      throw new AdapterError("temporary", "EORI (Comissão Europeia): sem resposta.");
    }
    calls++;
    if (r.status !== 200) throw httpError("EORI (Comissão Europeia)", r.status);
    const xml = await r.text();
    for (const m of xml.matchAll(/<result>([\s\S]*?)<\/result>/g)) {
      const eori = /<eori>([^<]+)<\/eori>/.exec(m[1])?.[1];
      const status = /<status>(\d+)<\/status>/.exec(m[1])?.[1];
      if (eori) out.set(eori, status === "0" ? "valid" : "not_valid");
    }
  }
  return { results: out, calls };
}
