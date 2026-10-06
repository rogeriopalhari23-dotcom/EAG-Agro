// BrasilAPI (dados abertos da Receita), 1 pedido a cada 2 s, só leitura; grava porte, CNAE, situação e município da unidade.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
const dir = process.argv[2];
const out = `${dir}/brasilapi.jsonl`;
const done = new Set(existsSync(out) ? readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).cnpj) : []);
const act = JSON.parse(readFileSync(`${dir}/sipe_ativos.json`, "utf8")).filter((e) => e.cnpjOk && e.segmento !== "subproduto_animal" && e.segmento !== "suplemento_mineral_aditivo");
const cnpjs = [...new Set(act.map((e) => e.cnpj.replace(/\D/g, "")))].filter((c) => c.length === 14 && !done.has(c));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const c of cnpjs) {
  let rec = { cnpj: c };
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`, { headers: { Accept: "application/json", "User-Agent": "EAG-Compass/0.3 (+uso interno EAG Agro)" } });
    if (r.status === 200) {
      const j = await r.json();
      rec = { cnpj: c, razao: j.razao_social, fantasia: j.nome_fantasia || null, tipo: j.descricao_identificador_matriz_filial, situacao: j.descricao_situacao_cadastral, abertura: j.data_inicio_atividade, porte: j.porte || j.descricao_porte, cnae: `${j.cnae_fiscal} ${j.cnae_fiscal_descricao}`, municipio: `${j.municipio}/${j.uf}`, capital: j.capital_social, natureza: j.natureza_juridica };
    } else rec.http = r.status;
  } catch (e) { rec.erro = String(e.message).slice(0, 60); }
  appendFileSync(out, JSON.stringify(rec) + "\n");
  await sleep(2000);
}
console.log("fim", cnpjs.length);
