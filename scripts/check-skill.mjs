// Portão R17.8: se a /prospeccao-vendas disponível mudou, a geração de textos para até nova leitura T12.
// Sem a skill na máquina (ex.: CI), só avisa: o hash incorporado continua em src/templates/prospeccao-vendas.js.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { SKILL_SHA256 } from "../src/templates/prospeccao-vendas.js";

const path = process.env.SKILL_PATH || join(homedir(), ".claude", "skills", "prospeccao-vendas", "SKILL.md");
let data;
try {
  data = await readFile(path);
} catch {
  console.log(`Aviso: ${path} não encontrado; hash incorporado ${SKILL_SHA256.slice(0, 8)}… não conferido nesta máquina.`);
  process.exit(0);
}
const hash = createHash("sha256").update(data).digest("hex");
if (hash !== SKILL_SHA256) {
  console.error(`A /prospeccao-vendas mudou (${hash.slice(0, 8)}… ≠ ${SKILL_SHA256.slice(0, 8)}…). Refaça a leitura T12 antes de gerar textos.`);
  process.exit(1);
}
console.log(`Skill /prospeccao-vendas conferida: ${hash.slice(0, 8)}…`);
