// Fontes gratuitas de candidatos no exterior (Radar Internacional). Nenhuma exige chave ou contrato; todas são
// consultadas só quando a pessoa pede, com o que foi usado registrado na busca. Resultado = "empresa encontrada":
// atividade no cadastro/mapa é indício de uso, nunca prova de compra ou importação (P1, R12.10).
// Termos conferidos em 2026-09-27 (docs/implementation/FONTES-EMPRESAS-EXTERIOR.md).
import { AdapterError, httpError, fetchJson } from "./errors.js";
import { nafCodes, sn2007Codes, bandFromEmployees } from "../discovery-map.js";
import { foreignSources } from "../sources-applicable.js";

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
  // Área pelo código do país em QUALQUER nível administrativo: territórios como Martinica, Guadalupe e Reunião têm o
  // código no nível 3/4, não no 2 (achado em 2026-10-22: a exigência do nível 2 fazia a consulta buscar numa área vazia e
  // responder 0 sem erro). A contagem de áreas vem na resposta: área não encontrada é falha da consulta, nunca "0".
  return `[out:json][timeout:90];area["ISO3166-1"="${iso2}"]->.a;.a out count;(${filters.map(osmFilter).join("")});out tags center ${limit};`;
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
  const count = data.elements.find((e) => e.type === "count");
  const areaCount = count ? Number(count.tags?.areas ?? count.tags?.total ?? 0) : null;
  if (areaCount === 0) throw new AdapterError("filter_not_applied", "OpenStreetMap: a área do país não foi encontrada no mapa; a consulta não buscou em lugar nenhum (falha da consulta, não ausência de estabelecimentos).");
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
  return { total: out.length, candidates: out, attribution: OSM_ATTRIBUTION, areaCount };
}

// ---------- Chile — LENAA do SAG (lista oficial pública de fabricantes de alimentos para animais), sem chave ----------
// A página oficial publica a planilha com data no nome; o endereço vigente é lido da própria página a cada consulta.
// Identidade: razão social, RUT (dígito verificador conferido) e região chilena do registro; atividade autorizada pelo SAG.
export const LENAA_PAGE = "https://www.sag.gob.cl/ambitos-de-accion/alimentacion-animal/registros";
export function validRut(rut) {
  const m = /^(\d{1,2}(?:\.?\d{3}){2})-([\dkK])$/.exec(String(rut ?? "").trim());
  if (!m) return false;
  const body = m[1].replace(/\./g, "");
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) (sum += Number(body[i]) * mul), (mul = mul === 7 ? 2 : mul + 1);
  const dv = 11 - (sum % 11);
  return (dv === 11 ? "0" : dv === 10 ? "K" : String(dv)) === m[2].toUpperCase();
}
const excelDate = (v) => (/^\d{5}$/.test(String(v)) ? new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000).toISOString().slice(0, 10) : null);
export async function clLenaaCandidates({ activity, page = LENAA_PAGE }, fetchImpl = fetch) {
  const html = await fetchImpl(page, { headers: { "user-agent": "eag-compass (uso pessoal, baixo volume)" } });
  if (!html.ok) throw new AdapterError("temporary", `SAG: página dos registros respondeu ${html.status}.`, { retryable: html.status >= 500 || html.status === 429 });
  const href = /href="([^"]*LENAA[^"]*\.xlsx)"/i.exec(await html.text())?.[1];
  if (!href) throw new AdapterError("schema", "SAG: link da planilha LENAA não encontrado na página oficial.");
  const url = new URL(href, page).toString();
  const r = await fetchImpl(url, { headers: { "user-agent": "eag-compass (uso pessoal, baixo volume)" } });
  if (!r.ok) throw new AdapterError("temporary", `SAG: planilha LENAA respondeu ${r.status}.`, { retryable: r.status >= 500 || r.status === 429 });
  const { readXlsx } = await import("./xlsx.js");
  const rows = await readXlsx(new Uint8Array(await r.arrayBuffer()));
  const head = rows.findIndex((x) => /^c[oó]digo$/i.test(x[0] ?? "") && rows.indexOf(x) >= 0);
  if (head < 0) throw new AdapterError("schema", "SAG: cabeçalho da LENAA diferente do conferido.", { code: "layout_changed" });
  const updated = rows.slice(0, head).map((x) => /actualizaci[oó]n:\s*([\d/]+)/i.exec(x[0] ?? "")?.[1]).find(Boolean) ?? null;
  // Uma candidata por empresa (RUT); as plantas registradas ficam juntas na atividade. Pessoa física aparece com o RUT
  // mascarado ("XXX") e fica de fora, como RUT inválido: nenhum nome de pessoa é guardado.
  const byRut = new Map();
  let invalidRut = 0, otherActivity = 0;
  for (const x of rows.slice(head + 1)) {
    const [code, resolution, region, , name, rawRut, date, ...acts] = x;
    if (!code || !name) continue;
    const label = acts.filter(Boolean).join("; ").replace(/\s+/g, " ");
    if (activity && !activity.test(label)) { otherActivity++; continue; }
    const rut = String(rawRut ?? "").trim().replace(/[.\s]+$/, "");
    if (!validRut(rut)) { invalidRut++; continue; }
    const id = rut.replace(/\./g, "").toUpperCase();
    const plant = `SAG ${code} — ${region ?? "região não informada"}: ${label}${resolution ? ` (resolução nº ${resolution}${excelDate(date) ? `, ${excelDate(date)}` : ""})` : ""}`;
    const c = byRut.get(id) ?? byRut.set(id, { source: "cl_sag_lenaa", externalId: `RUT ${id}`, name: String(name).slice(0, 250), legalNameHint: String(name).slice(0, 250), city: region ? `Região ${region} (Chile)` : null, website: null, plants: [], size: null, registry: { id, type: "RUT" }, recordUrl: url }).get(id);
    c.plants.push(plant);
  }
  // A atividade cabe no cadastro da empresa (500 caracteres com a região): plantas inteiras até o limite; as demais
  // ficam contadas, com o detalhe na planilha oficial (endereço da fonte).
  const fit = (plants) => {
    let label = "";
    for (let k = 0; k < plants.length; k++) {
      const next = label ? `${label} | ${plants[k]}` : plants[k];
      const more = plants.length - k - 1;
      if (next.length + (more ? 40 : 0) > 440) return `${label || plants[k].slice(0, 400)} | +${plants.length - (label ? k : k + 1)} planta(s) na planilha LENAA`;
      label = next;
    }
    return label;
  };
  const out = [...byRut.values()].map(({ plants, ...c }) => ({ ...c, activity: { code: `LENAA (${plants.length} planta${plants.length > 1 ? "s" : ""})`, label: fit(plants) } }));
  return { query: `LENAA ${updated ?? "(data não informada)"}: atividade compatível com a commodity`, total: out.length, calls: 2, candidates: out, attribution: `SAG — LENAA, atualizada em ${updated ?? "data não informada"}`, skipped: { invalidRut, otherActivity }, updated, url };
}

// ---------- França — API Recherche d'entreprises (data.gouv), sem chave; 7 req/s por IP ----------
// Faixa de efetivo INSEE → porte (00 = sem empregado; NN = não informado).
const FR_BAND = { "01": "micro", "02": "micro", "03": "micro", "11": "small", "12": "small", "21": "medium", "22": "medium", "31": "medium", "32": "medium_plus", "41": "medium_plus", "42": "medium_plus", "51": "medium_plus", "52": "medium_plus", "53": "medium_plus" };
// Porte-alvo da busca → faixas de efetivo INSEE (filtro da própria API).
const FR_TRANCHES = { small: ["11", "12"], medium: ["21", "22", "31"], medium_plus: ["32", "41", "42", "51", "52", "53"] };
// departement: departamento ultramarino (971 Guadalupe, 972 Martinica, 973 Guiana Francesa, 974 Reunião, 976 Mayotte):
// empresas com estabelecimento ativo ali (o registro francês cobre os departamentos); a cidade vem do estabelecimento.
export async function frCandidates({ nace, sizes = null, departement = null, maxPages = 4, base = "https://recherche-entreprises.api.gouv.fr" }, fetchImpl = fetch) {
  const codes = nafCodes(nace);
  const tranches = sizes ? sizes.flatMap((z) => FR_TRANCHES[z] ?? []) : [];
  const out = [];
  let total = 0, calls = 0;
  for (let page = 1; page <= maxPages; page++) {
    const url = `${base}/search?activite_principale=${encodeURIComponent(codes.join(","))}&etat_administratif=A${departement ? `&departement=${departement}` : ""}${tranches.length ? `&tranche_effectif_salarie=${tranches.join(",")}` : ""}&per_page=25&page=${page}`;
    const d = await getJson("Registro francês (Recherche d'entreprises)", url, {}, fetchImpl);
    calls++;
    if (!Array.isArray(d?.results)) throw new AdapterError("schema", "Registro francês: resposta sem results.");
    total = d.total_results ?? total;
    for (const x of d.results) {
      const band = FR_BAND[x.tranche_effectif_salarie] ?? null;
      out.push({
        source: "fr_registry", externalId: x.siren, name: x.nom_complet || x.nom_raison_sociale, legalNameHint: x.nom_raison_sociale || x.nom_complet,
        city: (departement ? x.matching_etablissements?.find((m) => String(m.code_postal ?? "").startsWith(departement.slice(0, 3)))?.libelle_commune ?? x.matching_etablissements?.[0]?.libelle_commune : null) ?? x.siege?.libelle_commune ?? null, website: null,
        activity: { code: x.activite_principale, label: `NAF ${x.activite_principale}` },
        size: band ? { band, source: `INSEE, faixa de efetivo ${x.tranche_effectif_salarie} (${x.annee_tranche_effectif_salarie ?? "ano não informado"}), via API Recherche d'entreprises; categoria ${x.categorie_entreprise ?? "—"}` } : null,
        registry: { id: x.siren, type: "SIREN" },
        eori: x.siege?.siret ? `FR${x.siege.siret}` : null,
        recordUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${x.siren}`,
      });
    }
    if (page >= (d.total_pages ?? 1)) break;
  }
  return { query: `activite_principale=${codes.join(",")}; etat_administratif=A${departement ? `; departement=${departement}` : ""}${tranches.length ? `; tranche_effectif_salarie=${tranches.join(",")}` : ""}`, total, calls, candidates: out, truncated: out.length < total };
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

// Fontes aplicáveis ao país e à commodity (regra única em src/sources-applicable.js). Fonte de outro país ou de outra
// commodity não aparece; pertinente sem condição de rodar vem como pendente (available=false), com o motivo.
export function sourcesFor(iso2, hs6 = []) {
  return foreignSources(iso2, Array.isArray(hs6) ? hs6 : [hs6].filter(Boolean)).map((x) => ({ ...x, available: x.status === "available" }));
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
