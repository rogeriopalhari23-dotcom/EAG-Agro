import test from "node:test";
import assert from "node:assert/strict";
import { D1Test, migrations } from "./helpers/db.mjs";
import { buildCountries, parsePaisCsv } from "../scripts/gen-paises-sql.mjs";

const db = new D1Test();
for (const sql of migrations) db.raw.exec(sql);
const one = (sql, ...a) => db.raw.prepare(sql).get(...a);
const codes = (iso3) => db.raw.prepare("SELECT mdic_code FROM country_mdic_codes WHERE iso3=? ORDER BY mdic_code").all(iso3).map((r) => r.mdic_code);

test("P3-T2: EUA com o código da Comtrade (842) e os três códigos do MDIC", () => {
  assert.equal(one("SELECT comtrade_code c FROM countries WHERE iso3='USA'").c, 842);
  assert.deepEqual(codes("USA"), ["249", "396", "873"]);
  assert.equal(one("SELECT name_pt n FROM countries WHERE iso3='USA'").n, "Estados Unidos");
});

test("P3-T2: Alemanha pela entrada ativa (276, não 280) e acentos de windows-1252", () => {
  assert.equal(one("SELECT comtrade_code c FROM countries WHERE iso3='DEU'").c, 276);
  assert.deepEqual(codes("DEU"), ["023", "025"]);
  assert.equal(one("SELECT name_pt n FROM countries WHERE iso3='AFG'").n, "Afeganistão");
});

test("P3-T2: nome do país não é o da primeira ilha; Portugal em português; Brasil fora", () => {
  assert.equal(one("SELECT name_pt n FROM countries WHERE iso3='GBR'").n, "Reino Unido");
  assert.equal(one("SELECT name_pt n FROM countries WHERE iso3='ESP'").n, "Espanha");
  assert.equal(one("SELECT default_language l FROM countries WHERE iso3='PRT'").l, "pt-BR");
  assert.equal(one("SELECT default_language l FROM countries WHERE iso3='DEU'").l, "en");
  assert.equal(one("SELECT COUNT(*) n FROM countries WHERE iso3 IN ('BRA','ZZZ')").n, 0);
  assert.equal(one("SELECT iso2 FROM countries WHERE iso3='DEU'").iso2, "DE");
});

test("P3-T2: duas entradas ativas da Comtrade para o mesmo ISO-3 param a geração", () => {
  const pais = parsePaisCsv(new TextEncoder().encode('"CO_PAIS";"CO_PAIS_ISON3";"CO_PAIS_ISOA3";"NO_PAIS";"NO_PAIS_ING";"NO_PAIS_ESP"\n"023";"276";"DEU";"Alemanha";"Germany";"Alemania"\n'));
  const r = (code, extra = {}) => ({ reporterCode: code, reporterDesc: "Germany", reporterCodeIsoAlpha2: "DE", reporterCodeIsoAlpha3: "DEU", isGroup: false, ...extra });
  assert.throws(() => buildCountries({ pais, reporters: [r(276), r(280)], partners: [] }), /mais de uma entrada ativa/);
  const ok = buildCountries({ pais, reporters: [r(276), r(280, { entryExpiredDate: "1990-12-31T00:00:00" })], partners: [] });
  assert.equal(ok.countries[0].comtradeCode, 276);
});

test("P3-T2: cabeçalho diferente do conferido é recusado", () => {
  assert.throws(() => parsePaisCsv(new TextEncoder().encode('"CO_PAIS";"NOVA"\n')), /cabeçalho/);
});
