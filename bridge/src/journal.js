// Diário local da ponte (SQLite). Guarda só o necessário para não duplicar envio depois de queda: IDs, estado,
// hash e código SMTP — sem texto, sem endereço, sem senha.
// Estados: claimed → smtp_started → smtp_done → reported (ou not_sent → reported).
// Cópia interna D5-a (tabela copies): mesmos estados, por passo do prospect e lease da cópia. Sem texto e sem endereço.
import { DatabaseSync } from "node:sqlite";

export function openJournal(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sends (
      outbox_id TEXT NOT NULL, lease_token INTEGER NOT NULL, message_id TEXT NOT NULL, sha256 TEXT NOT NULL,
      state TEXT NOT NULL, outcome TEXT, smtp_code INTEGER, smtp_text TEXT, updated_at TEXT NOT NULL,
      PRIMARY KEY (outbox_id, lease_token));
    CREATE TABLE IF NOT EXISTS copies (
      outbox_id TEXT NOT NULL, lease_token INTEGER NOT NULL, message_id TEXT NOT NULL,
      state TEXT NOT NULL, outcome TEXT, smtp_code INTEGER, smtp_text TEXT, updated_at TEXT NOT NULL,
      PRIMARY KEY (outbox_id, lease_token));`);
  const redact = (t) => (t ?? "").slice(0, 160).replace(/[^\s<>"'(),;:[\]]+@[^\s<>"'(),;:[\]]+\.[a-z]{2,}/gi, "[endereço]");
  const at = () => new Date().toISOString();
  const q = (sql) => db.prepare(sql);
  return {
    claimed: (m) => q("INSERT OR IGNORE INTO sends(outbox_id,lease_token,message_id,sha256,state,updated_at) VALUES (?,?,?,?,'claimed',?)").run(m.outboxId, m.leaseToken, m.messageId, m.sha256, at()),
    smtpStarted: (m) => q("UPDATE sends SET state='smtp_started',updated_at=? WHERE outbox_id=? AND lease_token=? AND state='claimed'").run(at(), m.outboxId, m.leaseToken),
    smtpDone: (m, r) => q("UPDATE sends SET state='smtp_done',outcome=?,smtp_code=?,smtp_text=?,updated_at=? WHERE outbox_id=? AND lease_token=?").run(r.kind, r.code ?? null, (r.text ?? "").slice(0, 160).replace(/[^\s<>"'(),;:[\]]+@[^\s<>"'(),;:[\]]+\.[a-z]{2,}/gi, "[endereço]"), at(), m.outboxId, m.leaseToken),
    notSent: (m, why) => q("UPDATE sends SET state='smtp_done',outcome='not_sent',smtp_text=?,updated_at=? WHERE outbox_id=? AND lease_token=?").run(why, at(), m.outboxId, m.leaseToken),
    reported: (m) => q("UPDATE sends SET state='reported',updated_at=? WHERE outbox_id=? AND lease_token=?").run(at(), m.outboxId, m.leaseToken),
    pending: () => q("SELECT * FROM sends WHERE state IN ('claimed','smtp_started','smtp_done') ORDER BY updated_at").all(),
    // Mesmo passo já aceito pelo SMTP (com qualquer lease): nunca enviar de novo.
    alreadyAccepted: (outboxId) => !!q("SELECT 1 FROM sends WHERE outbox_id=? AND outcome='accepted' LIMIT 1").get(outboxId),
    copy: {
      claimed: (c) => q("INSERT OR IGNORE INTO copies(outbox_id,lease_token,message_id,state,updated_at) VALUES (?,?,?,'claimed',?)").run(c.outboxId, c.leaseToken, c.messageId, at()),
      smtpStarted: (c) => q("UPDATE copies SET state='smtp_started',updated_at=? WHERE outbox_id=? AND lease_token=? AND state='claimed'").run(at(), c.outboxId, c.leaseToken),
      smtpDone: (c, r) => q("UPDATE copies SET state='smtp_done',outcome=?,smtp_code=?,smtp_text=?,updated_at=? WHERE outbox_id=? AND lease_token=?").run(r.kind, r.code ?? null, redact(r.text), at(), c.outboxId, c.leaseToken),
      notSent: (c, why) => q("UPDATE copies SET state='smtp_done',outcome='not_sent',smtp_text=?,updated_at=? WHERE outbox_id=? AND lease_token=?").run(why, at(), c.outboxId, c.leaseToken),
      reported: (c) => q("UPDATE copies SET state='reported',updated_at=? WHERE outbox_id=? AND lease_token=?").run(at(), c.outboxId, c.leaseToken),
      pending: () => q("SELECT * FROM copies WHERE state IN ('claimed','smtp_started','smtp_done') ORDER BY updated_at").all(),
      // Cópia deste passo já aceita pelo SMTP (qualquer lease): nunca enviar de novo.
      alreadyAccepted: (outboxId) => !!q("SELECT 1 FROM copies WHERE outbox_id=? AND outcome='accepted' LIMIT 1").get(outboxId),
    },
    close: () => db.close(),
  };
}
