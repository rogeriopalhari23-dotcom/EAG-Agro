-- Disponibilidade da prospecção internacional (2026-10-22): avaliação de cada combinação país × produto ao fim de uma
-- pesquisa (empresas encontradas, busca real concluída sem candidatas, ou pendência técnica), com fontes, data e prazo
-- de reavaliação. Histórico preservado: avaliação nova substitui a anterior (superseded_*), nada é apagado. Avaliação
-- de execução simulada (origin='simulated', prévia de demonstração) nunca altera a disponibilidade dos mercados reais.
CREATE TABLE market_assessments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  iso3 TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('found','empty','technical')),
  origin TEXT NOT NULL CHECK (origin IN ('real','simulated')),
  job_id TEXT,
  search_id TEXT,
  reason TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  fingerprint TEXT NOT NULL,
  candidates INTEGER NOT NULL DEFAULT 0,
  existing INTEGER NOT NULL DEFAULT 0,
  assessed_at TEXT NOT NULL,
  review_after TEXT NOT NULL,
  superseded_at TEXT,
  superseded_reason TEXT,
  superseded_by TEXT
);
CREATE INDEX idx_market_assessments_current ON market_assessments(tenant_id, superseded_at, product_id, iso3);

-- Tarefas de manutenção do cron com exclusão mútua (lease), progresso persistido e último resultado ou falha visível.
CREATE TABLE maintenance_leases (
  name TEXT PRIMARY KEY,
  holder TEXT,
  lease_until TEXT,
  cursor_json TEXT,
  last_started_at TEXT,
  last_finished_at TEXT,
  last_result_json TEXT,
  last_error TEXT,
  last_error_at TEXT
);
