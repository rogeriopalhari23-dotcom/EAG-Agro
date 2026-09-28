// Deutscher Kaffeeverband — "Kaffeekontakte" (diretório público de membros da associação alemã do café).
// Testado em 2026-09-28: https://www.kaffeeverband.de/de/kaffeekontakte/ — 151 entradas; busca GET "?s=<termo>";
// campos: nome, CEP/cidade, site e perfil com texto da própria empresa. Sem chave, sem custo; sem robots.txt e sem
// cláusula contra coleta nos termos (Impressum/Nutzungsbedingungen conferidos). Uso: consulta pontual, sob pedido,
// uma requisição por busca e uma por perfil validado, com pausa entre perfis.
// Só Alemanha + café (SH 0901). Membro da associação = empresa do setor, não prova de compra; o texto da própria
// empresa declarando que importa é sinal próprio (com fonte e data), não confirmação.
import { AdapterError, httpError } from "./errors.js";

export const KV_BASE = "https://www.kaffeeverband.de";
const UA = "EAG-Compass/0.3 (+uso interno EAG Agro; consulta pontual)";
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#8211;/g, "–").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();

async function getText(url, fetchImpl) {
  let r;
  try {
    r = await fetchImpl(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(30000) });
  } catch {
    throw new AdapterError("temporary", "Kaffeeverband: sem resposta.");
  }
  if (r.status !== 200) throw httpError("Kaffeeverband", r.status);
  return r.text();
}

// Lista de resultados: cada <li> traz nome (<strong>), "CEP cidade", site e o link do perfil.
export function parseDirectory(html) {
  const out = [];
  for (const m of html.matchAll(/<li data-zip="[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
    const li = m[1];
    const slug = /href="\/de\/kaffeekontakte\/([^"/]+)\/"/.exec(li)?.[1];
    const name = /<strong>([\s\S]*?)<\/strong>/.exec(li)?.[1];
    if (!slug || !name) continue;
    const paragraphs = [...li.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((p) => decode(p[1].replace(/<[^>]+>/g, " ")));
    const place = paragraphs.find((p) => /^\d{4,5}\s/.test(p)) ?? null;
    const site = /<a href="(https?:\/\/[^"]+)" target="_blank"/.exec(li)?.[1] ?? null;
    out.push({ externalId: slug, name: decode(name.replace(/<[^>]+>/g, " ")), place, website: site, profileUrl: `${KV_BASE}/de/kaffeekontakte/${slug}/` });
  }
  return out;
}

// Alemanha: CEP de 5 dígitos e nenhuma indicação de outro país (o diretório também lista Suíça, Áustria etc.).
export function isGermanPlace(place) {
  return !!place && /^\d{5}\s/.test(place) && !/(Schweiz|Österreich|Niederlande|Italien|Belgien|Luxemburg|Switzerland|Austria|Netherlands)/i.test(place);
}

export async function kvSearch(term, fetchImpl = fetch) {
  const html = await getText(`${KV_BASE}/de/kaffeekontakte/?s=${encodeURIComponent(term)}`, fetchImpl);
  if (!/company-list/.test(html)) throw new AdapterError("schema", "Kaffeeverband: página de resultados em formato inesperado.");
  return parseDirectory(html);
}

// Só o texto da seção PROFIL (o que a própria empresa publicou), até "KONTAKTINFORMATIONEN" — nunca menu ou rodapé
// (o rodapé do site tem "Handel, Kaffeepreis & Logistik", que classificaria todo mundo como prestador; visto em 2026-09-28).
export function profileText(html) {
  const start = html.search(/PROFIL\s*<\/h4>/i) >= 0 ? html.search(/PROFIL\s*<\/h4>/i) : html.indexOf("PROFIL");
  if (start < 0) throw new AdapterError("schema", "Kaffeeverband: perfil sem seção PROFIL.");
  const endAt = html.indexOf("KONTAKTINFORMATIONEN", start);
  const seg = html.slice(start, endAt > start ? endAt : start + 6000);
  const text = decode(seg.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " "));
  return text.replace(/^PROFIL\s*/, "").slice(0, 1500).trim();
}
export async function kvProfile(slug, fetchImpl = fetch) {
  return profileText(await getText(`${KV_BASE}/de/kaffeekontakte/${encodeURIComponent(slug)}/`, fetchImpl));
}

// Regras definidas antes da consulta (2026-09-28) e corrigidas no mesmo dia após o teste real: fornecer a torrefações
// indica trader; prestador (logística, armazém, máquinas, consultoria) no nome ou na atividade principal vence "Handel",
// salvo se a própria empresa disser que torra ou importa; nome sem trema ("Roester") também é torrefação.
const RE = {
  roasterSelf: /\bwir rösten|\brösten wir|unsere[rn]? (eigene[rn]? )?rösterei|kaffeerösterei|kaffeeröster\b|kaffeemanufaktur|röstmeister|in unserer rösterei|\bröstung\b|roastery|\bwe roast/i,
  supplierToRoasters: /(belief(ern|ert)|versorg(en|t)|biet(en|et)|liefer(n|t))[^.]{0,80}\b(kaffee)?röster(n|eien)?\b|\bröstern\b|für (kaffee)?röster(eien)?\b|kunden[^.]{0,40}\b(kaffee)?röster(n|eien)?\b/i,
  importer: /\bwir (sind|verstehen uns)[^.]{0,80}\bimport(eur|haus)\b|\bwir import(ieren|iert)\b|\bals import(eur|haus)\b|direktimport|\bimportiert\b|\bimportieren (wir|seit)\b|direkt (vom|von) (farmer|erzeuger|produzent|kooperativ)|aus (den )?(anbau|ursprungs|erzeuger)ländern bezogen|direct trade/i,
  trader: /händler|handelshaus|handelsgesellschaft|\bhandel\b|trading|makler|broker|agentur|rohkaffeehandel/i,
  nonBuyer: /logistik|spedition|lagerung|lagerhaus|warehous|maschinen|anlagenbau|verpackung|consulting|beratung|\blabor\b|zertifizier|software|versicherung|zubehör|kaffeemaschinen|siebträger|vending/i,
  brazil: /brasil|brazil|brasilien|santos|minas gerais|cerrado|sul de minas|mogiana/i,
  // Vocabulário para pesar a atividade principal quando o texto mistura comércio e serviços.
  tradeWords: /händler|handelshaus|\bhandel\b|trading|import|rohkaffee|agent|broker|makler|sortiment|provenienz|ursprung|exporteur|beschaffung|liefern wir/gi,
  providerWords: /logistik|spedition|lagerhaus|lagerung|warehous|anlagenbau|maschinen|consulting|beratung|berater|dienstleist|verpackungs/gi,
  providerName: /logistik|transport|spedition|warehous|lagerhaus|maschinen|anlagenbau|consulting|beratung|berater|getränkesysteme/i,
  roasterStrong: /\bwir rösten|\brösten wir|unsere[rn]? (eigene[rn]? )?rösterei|in unserer rösterei|röstmeister|kaffeeröster\b|\bwe roast/i,
};
export function classifyCoffeeProfile(name, text) {
  const all = `${name} ${text}`;
  const importer = RE.importer.test(text);
  const quote = importer ? (text.match(new RegExp(`[^.!]{0,160}(?:${RE.importer.source})[^.!]{0,160}`, "i"))?.[0] ?? null) : null;
  const base = { importStatement: quote ? quote.trim().slice(0, 300) : null, mentionsBrazil: RE.brazil.test(text) };
  const namedRoastery = /kaffeer(ö|oe)ster|r(ö|oe)sterei|roastery|kaffeemanufaktur/i.test(name);
  const roastStrong = namedRoastery || RE.roasterStrong.test(text);
  const roastAny = roastStrong || /röst|roast|roest/i.test(name) || /geröstet|röstung|\brösten\b|röstkaffee|frisch geröstet/i.test(text);
  const supplier = RE.supplierToRoasters.test(text);
  const tradeScore = (all.match(RE.tradeWords) ?? []).length;
  const providerScore = (text.match(RE.providerWords) ?? []).length;
  const providerSelf = /\bals (unabhängige[rn]? )?berater|\bberatungsunternehmen|\bwir beraten\b|logistikdienstleister|dienstleister für/i.exec(text);
  if (!text.trim()) return namedRoastery ? { ...base, role: "processor", reason: null } : { ...base, role: "empty", reason: "perfil sem texto no diretório — classificar manualmente" };
  if (importer) return { ...base, role: roastStrong && !supplier ? "processor" : "trader", reason: null };
  const providerByName = !namedRoastery ? RE.providerName.exec(name) : null;
  const providerByText = providerSelf ?? (providerScore >= 2 && providerScore > tradeScore && !roastAny ? RE.providerWords.exec(text) : null);
  RE.providerWords.lastIndex = 0;
  const provider = providerByName ?? providerByText;
  if (provider && !roastStrong) return { ...base, role: "non_buyer", reason: `perfil de prestador (${provider[0]}), não comprador de café verde` };
  if (roastAny && !supplier && !(RE.trader.test(all) && tradeScore >= 3 && !roastStrong)) return { ...base, role: "processor", reason: null };
  if (RE.trader.test(all) || supplier || tradeScore >= 2) return { ...base, role: "trader", reason: null };
  return { ...base, role: "unclassified", reason: "perfil sem indicação clara de torrefação, importação ou comércio — revisar" };
}

// Prazo de atualização do cache por fonte (dias): diretório associativo muda pouco; registros e EORI mais.
export const REFRESH_DAYS = { de_coffee_assoc: 180, osm: 90, fr_registry: 90, no_registry: 90, eori: 30 };
