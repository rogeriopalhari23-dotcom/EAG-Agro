-- P2-T7: tarefas de validação de e-mail (Snov.io). Consulta do resultado com número máximo de tentativas.
CREATE TABLE email_validation_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  provider TEXT NOT NULL,
  task_hash TEXT,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed','failed')),
  contact_ids_json TEXT NOT NULL,
  polls INTEGER NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0,
  next_poll_at TEXT,
  error TEXT,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT,
  UNIQUE (provider, task_hash)
);
CREATE INDEX idx_email_jobs_open ON email_validation_jobs(tenant_id, status, next_poll_at);
