// Procedência declarada pelos scripts (mesma regra do painel e da API; src/provenance.js): canal "script", executor e
// autorização vêm das opções da linha de comando — nada é deduzido da sessão do Access.
//   --executor "<quem ou que executa>"   --autorizacao-ref "<referência>"   --autorizado-por "<responsável>"
//   --autorizado-em AAAA-MM-DD
import { provenanceHeaders } from "../../src/provenance.js";

export function scriptProvenance(args) {
  const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
  return provenanceHeaders({
    channel: "script",
    executor: opt("--executor"),
    authorization: { reference: opt("--autorizacao-ref"), grantedBy: opt("--autorizado-por"), grantedAt: opt("--autorizado-em") },
  });
}
export const PROVENANCE_FLAGS = ["--executor", "--autorizacao-ref", "--autorizado-por", "--autorizado-em"];
