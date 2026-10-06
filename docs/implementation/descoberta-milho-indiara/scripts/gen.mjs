// Trechos de tabela do CANDIDATAS.md a partir de rows.json (regras fixas, sem LLM).
import { readFileSync, writeFileSync } from "node:fs";
const dir = process.argv[2];
const rows = JSON.parse(readFileSync(`${dir}/rows.json`, "utf8"));
const km = (x) => (x.km === "" ? "—" : String(x.km).replace(".", ","));
const t = (head, list, f) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...list.map((x, i) => `| ${f(x, i).map((v) => String(v).replace(/\|/g, "/")).join(" | ")} |`)].join("\n");
const out = [];
const cons = rows.filter((x) => x.papel.startsWith("consumidora"));
const lote1 = cons.filter((x) => x.ev === "específica" && x.sec === "A");
out.push("### LOTE1\n" + t(["#", "Candidata (id)", "Município", "km", "Evidência de milho [fonte]", "Nível da evidência", "CNPJ da unidade", "Registro MAPA / CNPJ sugerido", "Milho GMO"], lote1, (x, i) => [i + 1, `**${x.nome}** (${x.mid})`, x.municipio, `${km(x)} (${x.precisao.startsWith("estimada") ? "centroide" : "coordenada"})`, x.evidenciaTexto, x.evidencia.replace("específica, ", ""), x.cnpj === "não encontrado" ? "não confirmado" : `${x.cnpj} — confirmado: ${x.cnpjVinculo}`, x.origem.startsWith("MAPA + ") ? `mesmo CNPJ: ${x.registros}` : x.possivel, x.gmo]));
const a3 = rows.filter((x) => x.sec === "A3");
out.push("### A3\n" + t(["Candidata (id)", "Município", "km", "Evidência [fonte]", "Restrição GMO registrada", "Registro MAPA"], a3, (x) => [`**${x.nome}** (${x.mid})`, x.municipio, km(x), x.evidenciaTexto, x.gmo, x.possivel]));
const ind = rows.filter((x) => x.origem.startsWith("pesquisa manual") && x.ev === "indício");
const hist = rows.filter((x) => x.ev === "histórica");
out.push("### HISTORICAS\n" + t(["Candidata (id)", "Município", "km", "Situação [fonte]"], hist, (x) => [`**${x.nome}** (${x.mid})`, x.municipio, km(x), x.evidenciaTexto]));
const fund = rows.filter((x) => x.origem.startsWith("MAPA + ") && x.ev === "indício");
out.push("### INDICIOS_MANUAIS\n" + t(["Candidata (id)", "Município", "km", "Indício [fonte]", "CNPJ", "Registro MAPA"], [...fund, ...ind], (x) => [`**${x.nome}** (${x.mid})`, x.municipio, km(x), x.evidenciaTexto, x.cnpj, x.origem.startsWith("MAPA + ") ? `mesmo CNPJ: ${x.registros}` : x.possivel]));
const forte = cons.filter((x) => x.origem === "MAPA" && /milho no nome|usina\/bioenergia/.test(x.atividade) && !x.possivel);
out.push("### INDICIO_FORTE\n" + t(["Razão social (MAPA)", "CNPJ", "Município", "km", "Atividade (MAPA)", "CNAE (Receita)", "Porte", "Situação"], forte, (x) => [x.razao.trim(), x.cnpj, x.municipio, km(x), x.atividade, x.cnae, x.porte, x.situacao]));
const pme = cons.filter((x) => x.origem === "MAPA" && /^(ME|EPP)/.test(x.porte) && !forte.includes(x));
out.push(`### PME (${pme.length})\n` + t(["Razão social (MAPA)", "CNPJ", "Município", "km", "Porte", "CNAE (Receita)"], pme, (x) => [x.razao.trim(), x.cnpj, x.municipio, km(x), x.porte, x.cnae]));
const trad = rows.filter((x) => x.papel.startsWith("trader"));
out.push("### TRADERS\n" + t(["Origem", "Empresa — unidade", "CNPJ", "Município", "km", "Possível correspondência"], trad, (x) => [x.origem, x.nome || x.razao.trim(), x.cnpj, x.municipio, km(x), x.possivel || "—"]));
const lim = cons.filter((x) => x.conferirDistancia);
out.push(`### LIMITE (${lim.length})\n` + lim.map((x) => `${(x.nome || x.razao).trim()} (${x.municipio}, ${km(x)} km)`).join("; "));
const mapa = rows.filter((x) => x.origem.startsWith("MAPA")), mc = mapa.filter((x) => x.papel.startsWith("consumidora"));
const cnt = (l, f) => l.reduce((a, x) => ((a[f(x)] = (a[f(x)] || 0) + 1), a), {});
out.push("### TOTAIS\n" + JSON.stringify({
  linhas: rows.length, mapa: mapa.length, mapaPorPapel: cnt(mapa, (x) => x.papel), mapaConsumidorasCnpj: mc.filter((x) => !x.cnpj.startsWith("a conciliar")).length,
  porteConsumidorasMapa: cnt(mc, (x) => x.porte), situacaoReceita: cnt(mc, (x) => x.situacao.split("Receita: ")[1]),
  tipo: cnt(mc, (x) => x.tipo), raizMulti: mc.filter((x) => /estabelecimentos da raiz/.test(x.raiz)).length,
  porUF: cnt(mc, (x) => x.municipio.split("/").at(-1)), lote1: lote1.length, forte: forte.length, pme: pme.length, limite: lim.length, alertas: rows.filter((x) => x.alerta).length,
  naoAtivas: mc.filter((x) => !/ativa|não consultada/.test(x.situacao.split("Receita: ")[1] ?? "")).map((x) => `${x.razao.trim()} ${x.cnpj} ${x.situacao}`),
}, null, 1));
writeFileSync(`${dir}/md-trechos.md`, out.join("\n\n") + "\n");
console.log(out.at(-1));
