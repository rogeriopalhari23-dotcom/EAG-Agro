// Rodada de descoberta e qualificação (fluxo geral). A configuração define commodity, origem, raio, fontes e critérios;
// nada do piloto fica no código. Não faz contato, não consome crédito, não cadastra nada: o cadastro é outro passo
// (scripts/cadastrar-lote-aceito.mjs) sobre o lote que este comando gera.
//   node scripts/rodada.mjs validar <config.json>
//   node scripts/rodada.mjs executar <config.json> <candidatas.json> --municipios <arquivo.csv|json>
//        [--estado <estado.json>] [--saida <pasta>] [--rede]
//      --rede: consulta as fontes cadastrais configuradas (com o limite de taxa da configuração). Sem --rede, a consulta
//              vira pendência explícita.
//   node scripts/rodada.mjs lote <resultado.json> --modo discovery|accept --produto "<variante do catálogo>"
//        [--decisoes <decisoes.json>] [--por "<quem decidiu>"] [--saida <arquivo.json>]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateRoundConfig } from "../src/rodada/config.js";
import { runRound } from "../src/rodada/batch.js";
import { renderReport } from "../src/rodada/report.js";
import { buildRegistrationBatch } from "../src/rodada/acceptance.js";
import { brCnpjWs } from "../src/rodada/sources/br-cnpj-ws.js";
import { parseMunicipalities } from "../src/rodada/municipalities.js";

const [cmd, ...rest] = process.argv.slice(2);
const opt = (n) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : null);
const VALUED = new Set(["--municipios", "--estado", "--saida", "--modo", "--produto", "--decisoes", "--por"]);
const pos = rest.filter((a, i) => !a.startsWith("--") && !VALUED.has(rest[i - 1]));
const json = (f) => JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""));

const loadMunicipalities = (file, country) => parseMunicipalities(readFileSync(file, "utf8"), { format: file.endsWith(".json") ? "json" : "csv", country });

const FETCHERS = { "br-cnpj-ws": () => brCnpjWs() };

if (cmd === "validar") {
  const v = validateRoundConfig(json(pos[0]));
  console.log(v.ok ? `Configuração válida: ${v.config.id} (raio ${v.config.radius.value} ${v.config.radius.unit}; perto do limite a partir de ${v.config.nearLimit.fromKm.toFixed(1)} km).` : `Configuração inválida:\n- ${v.errors.join("\n- ")}`);
  process.exit(v.ok ? 0 : 1);
} else if (cmd === "executar") {
  const config = json(pos[0]);
  const candidates = json(pos[1]);
  const munFile = opt("--municipios");
  if (!munFile) throw new Error("Informe --municipios.");
  const statePath = opt("--estado");
  const state = statePath && existsSync(statePath) ? json(statePath) : { establishments: {} };
  const fetchers = {};
  if (rest.includes("--rede")) for (const s of config.sources ?? []) if (FETCHERS[s.id]) fetchers[s.id] = FETCHERS[s.id]();
  const run = await runRound({ config, municipalities: loadMunicipalities(munFile, config.origin.country), candidates, fetchers, state });
  if (!run.ok) { console.log(`Rodada não executada:\n- ${run.errors.join("\n- ")}`); process.exit(1); }
  const out = opt("--saida") ?? ".";
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `resultado-${run.config.id}.json`), JSON.stringify({ config: run.config, origin: run.origin, results: run.results, counters: run.counters }, null, 1));
  writeFileSync(join(out, `relatorio-${run.config.id}.md`), renderReport(run));
  if (statePath) writeFileSync(statePath, JSON.stringify(run.state, null, 1));
  console.log(`Rodada ${run.config.id}: ${run.results.length} estabelecimentos; exceções ${run.exceptions.length}; novos ${run.counters.created}, alterados ${run.counters.updated}, sem mudança ${run.counters.unchanged}.`);
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
} else {
  console.log("Comandos: validar | executar | lote (ver o cabeçalho deste arquivo).");
  process.exit(1);
}
