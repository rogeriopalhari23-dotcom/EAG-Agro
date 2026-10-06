import { readFileSync, writeFileSync } from "node:fs";
const dir = process.argv[2];
const list = JSON.parse(readFileSync(`${dir}/sipe_raio_cnpj.json`, "utf8"));
const vis = (e) => e.cnpjMascarado.replace(/\*/g, "").replace(/\D/g, "");
for (const e of list) e.cnpjOk = !!(e.cnpj && vis(e) && e.cnpj.replace(/\D/g, "").includes(vis(e)));
const act = list.filter((e) => e.status === "Ativo" && /FABRICANTE/.test(e.atividades));
const N = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
const ANIMAL_BYPRODUCT = /FRIGO|RECICLAGEM|SUBPRODUTO|GRAXARIA|SEBO|CURTUME|PROTEINA ANIMAL|JBS|MINERVA|MARFRIG|ABATEDOURO|FARINHA DE (CARNE|OSSO|PEIXE)|SUB-PRODUTO/;
const CORN_NAME = /MILHO|MILHAO|CORN|FUBA|CANJIC/;
const ETHANOL = /BIOENERG|ETANOL|ALCOOL|ACUCAR|USINA|ENERGETICA|DESTILARIA|SUCROALCOOL/;
for (const e of act) {
  const n = N(e.razao), c = e.classificacoes;
  const feed = /RAÇÃO|CONCENTRADO|ALIMENTO/.test(c);
  e.segmento =
    ANIMAL_BYPRODUCT.test(n) && !feed ? "subproduto_animal" :
    CORN_NAME.test(n) ? "milho_no_nome" :
    ETHANOL.test(n) ? "usina_bioenergia" :
    feed && /ALIMENTO/.test(c) && !/RAÇÃO|CONCENTRADO/.test(c) ? "pet_food_ou_alimento" :
    feed ? "racao_concentrado" :
    /INGREDIENTE|COPRODUTO/.test(c) ? "ingrediente_outro" :
    "suplemento_mineral_aditivo";
}
const count = act.reduce((a, e) => ((a[e.segmento] = (a[e.segmento] || 0) + 1), a), {});
writeFileSync(`${dir}/sipe_ativos.json`, JSON.stringify(act, null, 1));
console.log(JSON.stringify({ ativosFabricantes: act.length, cnpjConciliado: act.filter((e) => e.cnpjOk).length, porSegmento: count }, null, 1));
for (const s of ["milho_no_nome", "usina_bioenergia"]) console.log(s, "→", act.filter((e) => e.segmento === s).map((e) => `${e.razao} (${e.municipio}, ${e.km} km, ${e.classificacoes})`).join("; "));
