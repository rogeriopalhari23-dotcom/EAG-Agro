-- Rodadas de descoberta e qualificação pelo painel (fluxo geral, 2026-10-15). NÃO aplicada em produção.
-- A configuração da rodada (commodity, origem, raio, fontes, critérios) fica inteira em config_json; nada do piloto é fixo.
-- Candidatas guardam o modo de entrada (automatic / import / assisted / legacy) e a fonte. O estado por estabelecimento
-- permite reexecutar sem duplicidade. Decisões são um histórico (nova decisão substitui a anterior sem apagá-la).
-- Cadastro feito a partir da rodada fica ligado à decisão que o autorizou. Nada aqui libera contato ou envio.
CREATE TABLE discovery_rounds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  config_revision INTEGER NOT NULL DEFAULT 1 CHECK (config_revision >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  preflight_json TEXT,
  preflight_ack_by TEXT,
  preflight_ack_at TEXT,
  preflight_ack_revision INTEGER,
  last_run_at TEXT,
  last_run_json TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_discovery_rounds_tenant ON discovery_rounds(tenant_id, updated_at);

CREATE TABLE round_candidates (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES discovery_rounds(id),
  intake TEXT NOT NULL CHECK (intake IN ('automatic','import','assisted','legacy')),
  source_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (round_id, payload_hash)
);
CREATE INDEX idx_round_candidates_round ON round_candidates(round_id);

CREATE TABLE round_establishments (
  round_id TEXT NOT NULL REFERENCES discovery_rounds(id),
  est_key TEXT NOT NULL,
  status TEXT NOT NULL,
  needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0,1)),
  state_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (round_id, est_key)
);
CREATE INDEX idx_round_establishments_review ON round_establishments(round_id, needs_review, status);

CREATE TABLE round_decisions (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES discovery_rounds(id),
  est_key TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('accept','include','reject','defer')),
  note TEXT,
  -- Foto do resultado avaliado na hora da decisão: situação, provas, pendências e conferências.
  evidence_json TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  superseded_at TEXT
);
CREATE INDEX idx_round_decisions_current ON round_decisions(round_id, est_key, superseded_at);

CREATE TABLE round_registrations (
  round_id TEXT NOT NULL REFERENCES discovery_rounds(id),
  est_key TEXT NOT NULL,
  company_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('discovery','accept')),
  decision_id TEXT REFERENCES round_decisions(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('created','already_exists','failed')),
  detail_json TEXT,
  registered_by TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  PRIMARY KEY (round_id, est_key)
);

-- Chamadas a fontes externas (limite de taxa entre execuções e auditoria do que foi consultado).
CREATE TABLE round_source_calls (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES discovery_rounds(id),
  source_id TEXT NOT NULL,
  called_at TEXT NOT NULL,
  outcome TEXT NOT NULL,
  note TEXT
);
CREATE INDEX idx_round_source_calls ON round_source_calls(source_id, called_at);
