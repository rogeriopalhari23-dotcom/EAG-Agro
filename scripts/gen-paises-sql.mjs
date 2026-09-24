#!/usr/bin/env node
// Gera migrations/0015_seed_paises.sql (P3-T2) a partir das tabelas oficiais:
//   MDIC  PAIS.csv (windows-1252)            → CO_PAIS por ISO-3 (vários por país), nomes pt/en
//   Comtrade Reporters.json                   → reporterCode ativo por ISO-3 e ISO-2
//   Comtrade partnerAreas.json                → ISO-2 dos países que não declaram à Comtrade
// Uso: node scripts/gen-paises-sql.mjs [--pais PAIS.csv --reporters Reporters.json --partners partnerAreas.json]
// Sem os caminhos, baixa das URLs oficiais. Roda local, uma vez; a rotina mensal não reescreve `countries`.
import { readFileSync, writeFileSync } from "node:fs";

const MDIC = "https://balanca.economia.gov.br/balanca/bd/tabelas/PAIS.csv";
const REPORTERS = "https://comtradeapi.un.org/files/v1/app/reference/Reporters.json";
const PARTNERS = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json";
// CPLP (https://www.cplp.org/): países com português como língua de trabalho comercial.
// Guiné Equatorial é membro, mas o comércio corre em espanhol/francês: fica em inglês e vai para o relatório.
export const PORTUGUESE = new Set(["AGO", "CPV", "GNB", "MOZ", "PRT", "STP", "TLS"]);

export function parsePaisCsv(bytes) {
  const text = new TextDecoder("windows-1252").decode(bytes);
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (header !== '"CO_PAIS";"CO_PAIS_ISON3";"CO_PAIS_ISOA3";"NO_PAIS";"NO_PAIS_ING";"NO_PAIS_ESP"')
    throw new Error("PAIS.csv: cabeçalho diferente do conferido em T6 §7");
  return lines.map((l) => {
    const [code, ison3, iso3, pt, en] = l.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
    return { code, ison3, iso3, pt, en };
  });
}

export function buildCountries({ pais, reporters, partners }) {
  const report = { onlyMdic: [], onlyComtrade: [], multiMdic: [], noIso2: [], noPortugueseName: [], notes: [] };
  const active = reporters.filter((r) => r.isGroup === false && !r.entryExpiredDate && /^[A-Z]{3}$/.test(r.reporterCodeIsoAlpha3 || ""));
  const byIso = new Map();
  for (const r of active) {
    if (byIso.has(r.reporterCodeIsoAlpha3)) throw new Error(`Comtrade: mais de uma entrada ativa para ${r.reporterCodeIsoAlpha3}; decidir antes de gerar`);
    byIso.set(r.reporterCodeIsoAlpha3, r);
  }
  const partnerIso2 = new Map(), partnerM49 = new Map(), partnerName = new Map();
  for (const p of partners) {
    if (p.isGroup !== false || p.entryExpiredDate || !/^[A-Z]{3}$/.test(p.PartnerCodeIsoAlpha3 || "")) continue;
    partnerM49.set(p.PartnerCodeIsoAlpha3, p.PartnerCode);
    partnerName.set(p.PartnerCodeIsoAlpha3, p.PartnerDesc);
    if (/^[A-Z]{2}$/.test(p.PartnerCodeIsoAlpha2 || "")) partnerIso2.set(p.PartnerCodeIsoAlpha3, p.PartnerCodeIsoAlpha2);
  }
  const mdic = new Map();
  for (const r of pais) {
    if (!/^\d{3}$/.test(r.code) || r.code === "000" || !/^[A-Z]{3}$/.test(r.iso3) || r.iso3 === "ZZZ" || r.iso3 === "BRA") continue;
    (mdic.get(r.iso3) || mdic.set(r.iso3, []).get(r.iso3)).push(r);
  }
  const countries = [];
  for (const iso3 of [...new Set([...mdic.keys(), ...byIso.keys()])].sort()) {
    if (iso3 === "BRA") continue;
    const codes = (mdic.get(iso3) || []).sort((a, b) => a.code.localeCompare(b.code));
    const rep = byIso.get(iso3);
    if (!codes.length) report.onlyComtrade.push(iso3);
    if (!rep) report.onlyMdic.push(iso3);
    if (codes.length > 1) report.multiMdic.push(`${iso3}: ${codes.map((c) => `${c.code} ${c.pt}`).join(", ")}`);
    // Nome do país: entrada do MDIC cujo ISO numérico é o M49 oficial, depois nome em inglês igual ao da ONU,
    // depois nome sem qualificador (vírgula/parênteses), depois o menor código. Nunca a primeira ilha da lista.
    const m49 = partnerM49.get(iso3);
    const unName = (rep?.reporterDesc || partnerName.get(iso3) || "").toLowerCase();
    const score = (c) => (Number(c.ison3) === m49 ? 4 : 0) + (c.en.toLowerCase() === unName ? 2 : 0) + (/[,(]/.test(c.pt) ? 0 : 1);
    const main = [...codes].sort((a, b) => score(b) - score(a) || a.code.localeCompare(b.code))[0];
    const iso2 = rep?.reporterCodeIsoAlpha2 && /^[A-Z]{2}$/.test(rep.reporterCodeIsoAlpha2) ? rep.reporterCodeIsoAlpha2 : partnerIso2.get(iso3) || null;
    if (!iso2) report.noIso2.push(iso3);
    if (!main) report.noPortugueseName.push(iso3);
    countries.push({
      iso3, iso2,
      namePt: main?.pt || rep.reporterDesc,
      nameEn: main?.en || rep.reporterDesc,
      comtradeCode: rep?.reporterCode ?? null,
      language: PORTUGUESE.has(iso3) ? "pt-BR" : "en",
      mdicCodes: codes.map((c) => ({ code: c.code, namePt: c.pt })),
    });
  }
  const iso2Seen = new Map();
  for (const c of countries) {
    if (!c.iso2) continue;
    if (iso2Seen.has(c.iso2)) throw new Error(`ISO-2 ${c.iso2} repetido em ${iso2Seen.get(c.iso2)} e ${c.iso3}`);
    iso2Seen.set(c.iso2, c.iso3);
  }
  if (!countries.some((c) => c.iso3 === "GNQ" && c.language === "en")) report.notes.push("GNQ ausente ou em português: conferir regra de idioma");
  return { countries, report };
}

const q = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

export function toSql({ countries, report }, sourceVersion, loadedAt) {
  const out = [
    "-- P3-T2: países com os códigos do MDIC e da Comtrade. Gerado por scripts/gen-paises-sql.mjs; não editar à mão.",
    `-- Fontes: ${sourceVersion}`,
    `-- ${countries.length} países; ${report.onlyMdic.length} só no MDIC; ${report.onlyComtrade.length} só na Comtrade; ${report.multiMdic.length} com mais de um código MDIC.`,
  ];
  for (const c of countries)
    out.push(`INSERT INTO countries(iso3,iso2,name_pt,name_en,comtrade_code,default_language,source_version,loaded_at) VALUES (${[c.iso3, c.iso2, c.namePt, c.nameEn, c.comtradeCode, c.language, sourceVersion, loadedAt].map(q).join(",")});`);
  for (const c of countries)
    for (const m of c.mdicCodes) out.push(`INSERT INTO country_mdic_codes(mdic_code,iso3,name_pt) VALUES (${[m.code, c.iso3, m.namePt].map(q).join(",")});`);
  return out.join("\n") + "\n";
}

async function get(url, binary) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return { body: binary ? new Uint8Array(await r.arrayBuffer()) : await r.json(), lastModified: r.headers.get("last-modified") };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1]?.endsWith("gen-paises-sql.mjs")) {
  const arg = (k) => {
    const i = process.argv.indexOf(k);
    return i > 0 ? process.argv[i + 1] : null;
  };
  const today = new Date().toISOString().slice(0, 10);
  const pais = arg("--pais") ? { body: readFileSync(arg("--pais")), lastModified: "arquivo local" } : await get(MDIC, true);
  const rep = arg("--reporters") ? { body: JSON.parse(readFileSync(arg("--reporters"), "utf8")) } : await get(REPORTERS);
  const par = arg("--partners") ? { body: JSON.parse(readFileSync(arg("--partners"), "utf8")) } : await get(PARTNERS);
  const built = buildCountries({ pais: parsePaisCsv(pais.body), reporters: rep.body.results, partners: par.body.results });
  const sourceVersion = `mdic-PAIS.csv@${pais.lastModified || today};comtrade-Reporters.json@${today};comtrade-partnerAreas.json@${today}`;
  writeFileSync(new URL("../migrations/0015_seed_paises.sql", import.meta.url), toSql(built, sourceVersion, today));
  console.log(JSON.stringify({ countries: built.countries.length, ...built.report }, null, 1));
}
