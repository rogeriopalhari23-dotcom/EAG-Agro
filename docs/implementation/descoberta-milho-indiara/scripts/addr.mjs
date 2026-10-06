// BrasilAPI: endereço completo da unidade (cache brasilapi-end.jsonl), 1 pedido a cada 2 s.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
const out = "brasilapi-end.jsonl";
const done = new Set(existsSync(out) ? readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !r.http && !r.erro).map((r) => r.cnpj) : []);
for (const c of process.argv.slice(2).map((x) => x.replace(/\D/g, "")).filter((x) => !done.has(x))) {
  let rec = { cnpj: c };
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
    if (r.ok) { const j = await r.json(); rec = { cnpj: c, razao: j.razao_social, fantasia: j.nome_fantasia, tipo: j.descricao_identificador_matriz_filial, situacao: j.descricao_situacao_cadastral, abertura: j.data_inicio_atividade, porte: j.porte, cnae: `${j.cnae_fiscal} ${j.cnae_fiscal_descricao}`, secundarios: (j.cnaes_secundarios || []).map((s) => `${s.codigo} ${s.descricao}`), end: `${j.descricao_tipo_de_logradouro || ""} ${j.logradouro}, ${j.numero} ${j.complemento || ""} — ${j.bairro}, ${j.municipio}/${j.uf}, CEP ${j.cep}`.replace(/\s+/g, " ") }; }
    else rec.http = r.status;
  } catch (e) { rec.erro = String(e.message).slice(0, 60); }
  appendFileSync(out, JSON.stringify(rec) + "\n");
  await new Promise((s) => setTimeout(s, 8000));
}
console.log(readFileSync(out, "utf8"));
