// Remove endereços de e-mail do texto SMTP gravado no diário local da ponte (registros anteriores à correção de
// 2026-10-01; os novos já entram sem endereço). Não apaga linhas: o diário continua impedindo reenvio.
// Uso (com a ponte parada): node bridge/scripts/redigir-diario.mjs "%LOCALAPPDATA%\eag-mail-bridge\journal.sqlite"
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const ADDRESS = /[^\s<>"'(),;:[\]]+@[^\s<>"'(),;:[\]]+\.[a-z]{2,}/gi;

export function redactJournal(path) {
  const db = new DatabaseSync(path);
  try {
    const rows = db.prepare("SELECT rowid AS r, smtp_text FROM sends WHERE smtp_text LIKE '%@%'").all();
    const upd = db.prepare("UPDATE sends SET smtp_text=? WHERE rowid=?");
    let changed = 0;
    for (const row of rows) {
      const next = String(row.smtp_text).replace(ADDRESS, "[endereço]");
      if (next !== row.smtp_text) changed += upd.run(next, row.r).changes;
    }
    return { examined: rows.length, changed };
  } finally {
    db.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = process.argv[2];
  if (!path) {
    console.error("Informe o caminho do journal.sqlite (ponte parada).");
    process.exit(2);
  }
  console.log(JSON.stringify(redactJournal(path)));
}
