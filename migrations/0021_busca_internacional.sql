-- Radar Internacional: busca de empresas registrada por campanha (R12.7–R12.8, R12.14, R13.2–R13.5, R14.3).
-- A busca só existe depois da seleção da commodity e da autorização; registra fontes consultadas, custo, tempo e
-- candidatos, para mostrar cobertura e rendimento (P18). Nenhuma fonte paga ativa sem decisão registrada (R13.7).

ALTER TABLE companies ADD COLUMN website TEXT;
ALTER TABLE companies ADD COLUMN activity_text TEXT;
ALTER TABLE companies ADD COLUMN activity_source TEXT;

CREATE TABLE foreign_searches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  selection_id TEXT NOT NULL,
  analysis_id TEXT,
  iso3 TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  hs6_json TEXT NOT NULL,
  target_json TEXT NOT NULL,                 -- porte-alvo e prioridade de perfil usados
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  authorized_by TEXT NOT NULL,
  authorized_at TEXT NOT NULL,
  closed_by TEXT,
  closed_at TEXT,
  close_note TEXT
);
-- Uma busca aberta por campanha (autorizar de novo devolve a mesma, P13).
CREATE UNIQUE INDEX ux_foreign_searches_open ON foreign_searches(campaign_id) WHERE status = 'open';

-- Fonte consultada nesta busca, mesmo sem resultado (cobertura honesta), com esforço e custo.
CREATE TABLE foreign_search_sources (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES foreign_searches(id),
  source_label TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('web_research','public_directory','official_registry','company_website','trade_fair','paid_database','adapter')),
  query_text TEXT,
  result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  api_calls INTEGER NOT NULL DEFAULT 0 CHECK (api_calls >= 0),
  cost_usd REAL NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  minutes INTEGER CHECK (minutes IS NULL OR minutes >= 0),
  note TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_foreign_search_sources ON foreign_search_sources(search_id);

-- Empresa encontrada nesta busca (a empresa é única por país; a busca só acrescenta o contexto, R13.6).
CREATE TABLE foreign_search_candidates (
  search_id TEXT NOT NULL REFERENCES foreign_searches(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  source_id TEXT REFERENCES foreign_search_sources(id),
  source_label TEXT NOT NULL,
  source_url TEXT,
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (search_id, company_id)
);
