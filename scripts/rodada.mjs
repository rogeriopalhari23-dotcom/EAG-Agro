// Rodada de descoberta e qualificação (fluxo geral) pela linha de comando. O painel (tela Rodadas) faz o mesmo com
// banco e histórico de decisões; este comando serve para rodar e conferir fora do painel. A configuração define
// commodity, origem, raio, fontes e critérios; nada do piloto fica no código. Não faz contato, não consome crédito,
// não cadastra nada: o cadastro é outro passo (scripts/cadastrar-lote-aceito.mjs) sobre o lote que este comando gera.
//   node scripts/rodada.mjs validar <config.json>                 (mostra também as limitações antes da execução)
//   node scripts/rodada.mjs area <config.json> [--municipios <arquivo>]
//   node scripts/rodada.mjs executar <config.json> [candidatas.json] [--municipios <arquivo.csv|json>]
//        [--importar <arquivo.csv|json>] [--sipeagro <arquivo.csv>] [--osm] [--estado <estado.json>] [--saida <pasta>] [--rede]
//      Municípios: no Brasil, o conjunto nacional do IBGE (migrations/0008) é o padrão; --municipios substitui.
//      --rede: consulta as fontes automáticas configuradas (Receita com limite de taxa; --osm consulta o OpenStreetMap).
//              Sem --rede, a consulta vira pendência explícita.
//   node scripts/rodada.mjs lote <resultado.json> --modo discovery|accept --produto "<variante do catálogo>"
//        [--decisoes <decisoes.json>] [--por "<quem decidiu>"] [--saida <arquivo.json>]
//   Formatos antigos (adaptação explícita; o arquivo original nunca é reescrito):
//   node scripts/rodada.mjs adaptar-candidatas <candidatas.csv antigo> --saida <novo.json>
//   node scripts/rodada.mjs adaptar-lote <lote antigo.json> --produto "<variante>" --saida <novo.json> [--por "<quem>"]
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateRoundConfig } from "../src/rodada/config.js";
import { runRound } from "../src/rodada/batch.js";
import { renderReport } from "../src/rodada/report.js";
import { buildRegistrationBatch } from "../src/rodada/acceptance.js";
import { brCnpjWs } from "../src/rodada/sources/br-cnpj-ws.js";
import { parseMunicipalities, parseIbgeSeedSql } from "../src/rodada/municipalities.js";
import { municipalityIndex, resolveOrigin } from "../src/rodada/distance.js";
import { roundArea } from "../src/rodada/area.js";
import { preflight } from "../src/rodada/sources/catalog.js";
import { osmDiscover } from "../src/rodada/sources/osm.js";
import { sipeagroToCandidates } from "../src/rodada/sources/sipeagro.js";
import { importCandidates } from "../src/rodada/sources/import.js";
import { adaptLegacyCandidatesCsv, adaptLegacyBatch } from "../src/rodada/legacy.js";

const [cmd, ...rest] = process.argv.slice(2);
const opt = (n) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : null);
const VALUED = new Set(["--municipios", "--estado", "--saida", "--modo", "--produto", "--decisoes", "--por", "--importar", "--sipeagro"]);
const pos = rest.filter((a, i) => !a.startsWith("--") && !VALUED.has(rest[i - 1]));
const json = (f) => JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""));
const root = resolve(import.meta.dirname, "..");
const IBGE_SEED = join(root, "migrations", "0008_seed_municipios.sql");

// Conjunto de municípios: arquivo informado ou, no Brasil, o nacional do IBGE.
function loadMunicipalities(config) {
  const file = opt("--municipios");
  if (file) return { list: parseMunicipalities(readFileSync(file, "utf8"), { format: file.endsWith(".json") ? "json" : "csv", country: config.origin.country }), geography: "file" };
  if (config.origin.country === "BR") return { list: parseIbgeSeedSql(readFileSync(IBGE_SEED, "utf8")), geography: "national_official" };
  return { list: [], geography: "none" };
}
// Nunca grava por cima do arquivo de entrada.
function safeOut(out, input) {
  if (!out) throw new Error("Informe --saida (o arquivo original não é reescrito).");
  if (existsSync(out) && realpathSync(out) === realpathSync(input)) throw new Error("A saída não pode ser o próprio arquivo original.");
  if (existsSync(out)) throw new Error(`${out} já existe: escolha outro nome.`);
  return out;
}
const FETCHERS = { "br-cnpj-ws": () => brCnpjWs() };

if (cmd === "validar") {
  const v = validateRoundConfig(json(pos[0]));
  if (!v.ok) {
    console.log(`Configuração inválida:\n- ${v.errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Configuração válida: ${v.config.id} (raio ${v.config.radius.value} ${v.config.radius.unit}; perto do limite a partir de ${v.config.nearLimit.fromKm.toFixed(1)} km — ${v.config.nearLimit.criterion}).`);
  const pf = preflight(v.config, { geography: v.config.origin.country === "BR" ? "national_official" : "none", implemented: Object.keys(FETCHERS).concat("osm-overpass") });
  console.log(`Cobertura: ${pf.overall}${pf.requiresAcknowledgement ? " (há limitações)" : ""}`);
  for (const x of pf.items) console.log(`  [${x.level}] ${x.area}: ${x.message}`);
} else if (cmd === "area") {
  const v = validateRoundConfig(json(pos[0]));
  if (!v.ok) throw new Error(v.errors.join("; "));
  const { list } = loadMunicipalities(v.config);
  const origin = resolveOrigin(v.config, municipalityIndex(list));
  if (!origin) throw new Error("Origem não encontrada no conjunto de municípios: confira nome e UF, o código IBGE ou informe lat/lon.");
  const a = roundArea({ origin, config: v.config, municipalities: list });
  console.log(`Área de ${v.config.id}: origem ${origin.label}; raio ${a.radiusKm} km; ${a.summary.municipalities} municípios (inteiros ${a.summary.full}, parciais ${a.summary.partial}, a conferir ${a.summary.review}); UFs ${a.summary.regions.join(", ")}.`);
  console.log(`Critério perto do limite: ${a.criterion}.`);
  if (opt("--saida")) writeFileSync(opt("--saida"), JSON.stringify(a, null, 1));
} else if (cmd === "executar") {
  const config = json(pos[0]);
  const v = validateRoundConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const at = new Date().toISOString();
  const { list: municipalities } = loadMunicipalities(v.config);
  const candidates = pos[1] ? json(pos[1]) : [];
  const origin = resolveOrigin(v.config, municipalityIndex(municipalities));
  if (opt("--importar")) {
    const f = opt("--importar");
    const out = importCandidates(readFileSync(f, "utf8"), { format: f.endsWith(".json") ? "json" : "csv", country: v.config.origin.country, consultedAt: at, label: f });
    for (const e of out.errors) console.log(`Aviso (importação): ${e}`);
    candidates.push(...out.candidates);
  }
  if (opt("--sipeagro")) {
    if (!origin) throw new Error("Sem origem resolvida, não há área para filtrar o SIPEAGRO.");
    const out = sipeagroToCandidates(readFileSync(opt("--sipeagro"), "utf8"), { config: v.config, area: roundArea({ origin, config: v.config, municipalities }), sourceUrl: opt("--sipeagro"), consultedAt: at });
    console.log(`SIPEAGRO: ${out.rows} linhas; ${out.candidates.length} estabelecimentos na área; fora: ${JSON.stringify(out.skipped)}.`);
    candidates.push(...out.candidates);
  }
  if (rest.includes("--osm")) {
    if (!rest.includes("--rede")) console.log("OpenStreetMap: sem --rede, não consultado.");
    else {
      const out = await osmDiscover({ config: v.config, origin, consultedAt: at });
      console.log(`OpenStreetMap: ${out.candidates.length} candidatas (indício; provisórias até conciliar).`);
      candidates.push(...out.candidates);
    }
  }
  const statePath = opt("--estado");
  const state = statePath && existsSync(statePath) ? json(statePath) : { establishments: {} };
  const fetchers = {};
  if (rest.includes("--rede")) for (const s of config.sources ?? []) if (FETCHERS[s.id]) fetchers[s.id] = FETCHERS[s.id]();
  const run = await runRound({ config, municipalities, candidates, fetchers, state, now: at });
  if (!run.ok) {
    console.log(`Rodada não executada:\n- ${run.errors.join("\n- ")}`);
    process.exit(1);
  }
  const out = opt("--saida") ?? ".";
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `resultado-${run.config.id}.json`), JSON.stringify({ config: run.config, origin: run.origin, results: run.results, counters: run.counters }, null, 1));
  writeFileSync(join(out, `relatorio-${run.config.id}.md`), renderReport(run));
  if (statePath) writeFileSync(statePath, JSON.stringify(run.state, null, 1));
  console.log(`Rodada ${run.config.id}: ${run.results.length} estabelecimentos; exceções ${run.exceptions.length}; para revisar ${run.review.length}; novos ${run.counters.created}, alterados ${run.counters.updated}, sem mudança ${run.counters.unchanged}.`);
} else if (cmd === "lote") {
  const run = json(pos[0]);
  const batch = buildRegistrationBatch(run, {
    mode: opt("--modo"),
    decisions: opt("--decisoes") ? json(opt("--decisoes")) : {},
    decidedBy: opt("--por"),
    decidedAt: new Date().toISOString(),
    productVariant: opt("--produto"),
  });
  const out = opt("--saida") ?? `lote-${run.config.id}-${opt("--modo")}.json`;
  writeFileSync(out, JSON.stringify(batch, null, 1));
  console.log(`Lote ${opt("--modo")}: ${batch.empresas.length} empresas em ${out}. Cadastro só com scripts/cadastrar-lote-aceito.mjs (simulação primeiro).`);
} else if (cmd === "adaptar-candidatas") {
  const out = safeOut(opt("--saida"), pos[0]);
  const list = adaptLegacyCandidatesCsv(readFileSync(pos[0], "utf8"), { file: pos[0], adaptedAt: new Date().toISOString() });
  writeFileSync(out, JSON.stringify(list, null, 1));
  console.log(`${list.length} candidatas adaptadas em ${out} (provas como indício até reconfirmar). Original intocado: ${pos[0]}.`);
} else if (cmd === "adaptar-lote") {
  const out = safeOut(opt("--saida"), pos[0]);
  const batch = adaptLegacyBatch(json(pos[0]), { produto: opt("--produto"), file: pos[0], adaptedAt: new Date().toISOString(), adaptedBy: opt("--por") });
  writeFileSync(out, JSON.stringify(batch, null, 1));
  console.log(`Lote adaptado em ${out}: ${batch.empresas.length} empresas. ${batch.adaptacao.notes.join(" ")} Original intocado: ${pos[0]}.`);
} else {
  console.log("Comandos: validar | area | executar | lote | adaptar-candidatas | adaptar-lote (ver o cabeçalho deste arquivo).");
  process.exit(1);
}
