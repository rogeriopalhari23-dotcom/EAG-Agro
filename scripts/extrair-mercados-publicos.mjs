// Extrato dos dados PÚBLICOS AGREGADOS da base de mercados compradores já construída (lista mensal em produção),
// para a prévia local: só as subposições SH das commodities autorizadas do catálogo, por país e período. Sem empresas e
// sem dados pessoais (os objetos da lista mensal só têm comércio agregado por país). A leitura da produção é feita à
// parte, somente por leitura (wrangler r2 object get dos objetos apontados por trade_list_current, SHA-256 conferido).
//   node scripts/extrair-mercados-publicos.mjs <pasta com pointers.json e objs/> tests/fixtures/mercados-publicos.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { setup } from "../tests/helpers/db.mjs";
import { resolveClassification } from "../src/classification.js";

const [dir, outFile] = process.argv.slice(2);
const ptrs = JSON.parse(readFileSync(`${dir}/pointers.json`, "utf8"))[0].results;
// Subposições do catálogo: as mesmas regras documentais usadas pela seleção de mercado (sem perguntas).
const ctx = setup();
const hsByProduct = {};
for (const p of ctx.DB.raw.prepare("SELECT id,variant_name,commodity FROM products WHERE active<>0").all()) {
  const r = await resolveClassification(ctx.env, "eag-internal", p.id);
  if (r.state === "classified" && r.codes.length) hsByProduct[p.id] = r.codes.map((c) => c.hs6);
}
ctx.close();
const HS = new Set(Object.values(hsByProduct).flat());
const out = { meta: {}, mdic: {}, comtrade: {}, names: {} };
const seen = { mdic: new Set(), comtrade: new Set() };
for (const p of ptrs) {
  const file = `${dir}/objs/${p.source}-${p.iso3}.json`;
  if (!existsSync(file)) continue;
  const o = JSON.parse(readFileSync(file, "utf8"));
  seen[p.source].add(p.version_id);
  if (p.source === "mdic") {
    const lines = (o.lines ?? []).filter((l) => HS.has(l.hs6) && (l.fobUsd > 0 || l.netKg > 0)).map((l) => [l.ncm, l.ym, Math.round(l.fobUsd * 100) / 100, Math.round((l.netKg ?? 0) * 100) / 100]);
    for (const l of o.lines ?? []) if (HS.has(l.hs6) && !out.names[l.ncm]) out.names[l.ncm] = [l.hs6, l.namePt ?? null, l.nameEn ?? null];
    out.mdic[p.iso3] = { state: o.state, lastPeriod: o.lastPeriod ?? null, fileLastPeriod: o.fileLastPeriod ?? null, version: p.version_id, lines };
  } else {
    const years = [...new Set((o.lines ?? []).map((l) => l.year))].sort();
    const lines = (o.lines ?? []).filter((l) => HS.has(l.hs6) && l.origin === "brazil" && l.valueUsd > 0).map((l) => [l.hs6, l.year, Math.round(l.valueUsd * 100) / 100, l.basis ?? null]);
    out.comtrade[p.iso3] = { state: o.state, lastPeriod: o.lastPeriod ?? null, years: o.years ?? years, basis: o.basis ?? null, version: p.version_id, lines };
  }
}
const count = (src, f) => Object.values(out[src]).filter(f).length;
out.meta = {
  origem: "Produção, somente leitura: objetos do R2 eag-compass-files apontados por trade_list_current (D1 eag_compass), SHA-256 conferido",
  lidoEm: new Date().toISOString(),
  natureza: "dados públicos agregados por país (MDIC: exportações do Brasil, FOB; UN Comtrade: importações declaradas pelo país, linha de origem Brasil); sem empresas e sem dados pessoais",
  versoes: { mdic: [...seen.mdic], comtrade: [...seen.comtrade] },
  cobertura: {
    mdicPaises: Object.keys(out.mdic).length, mdicComRegistroDoCatalogo: count("mdic", (x) => x.lines.length),
    comtradePaises: Object.keys(out.comtrade).length, comtradeComRegistroDoCatalogo: count("comtrade", (x) => x.lines.length),
    comtradeSemDeclaracao: count("comtrade", (x) => x.state === "not_declared"),
  },
  // Classificação agrícola da lista de produção (capítulos consultados): o que ficou fora nunca foi consultado.
  classificacao: existsSync(`${dir}/versions.json`) ? JSON.parse(JSON.parse(readFileSync(`${dir}/versions.json`, "utf8"))[0].results[0].classification_json) : null,
  subposicoes: [...HS].sort(), produtos: hsByProduct,
};
writeFileSync(outFile, JSON.stringify(out));
console.log(JSON.stringify(out.meta.cobertura), `${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
