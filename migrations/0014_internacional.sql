-- Plano 3 rev. 2 (P3-T1): lista mensal de compras por país e fluxo País Primeiro.
-- Errata "Internacional — Plano 3 revisão 2 vigente": jobs com lease e fencing, orçamento persistente,
-- ponteiro por CAS, objetos protegidos da poda enquanto referenciados. contacts.timezone já existe (0007).
PRAGMA defer_foreign_keys = true;

CREATE TABLE countries (
  iso3 TEXT PRIMARY KEY CHECK (length(iso3) = 3),
  iso2 TEXT CHECK (iso2 IS NULL OR length(iso2) = 2),  -- tabelas oficiais da Comtrade (Reporters/partnerAreas), nunca truncamento
  name_pt TEXT NOT NULL, name_en TEXT NOT NULL,
  comtrade_code INTEGER,                                -- reporterCode ativo (≠ ISO numérico em vários países)
  default_language TEXT NOT NULL DEFAULT 'en' CHECK (default_language IN ('en','pt-BR')),
  source_version TEXT NOT NULL,                         -- ex.: 'mdic-PAIS@<Last-Modified>+comtrade-Reporters@<data>'
  loaded_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_countries_comtrade ON countries(comtrade_code) WHERE comtrade_code IS NOT NULL;
CREATE UNIQUE INDEX idx_countries_iso2 ON countries(iso2) WHERE iso2 IS NOT NULL;

-- O MDIC tem vários CO_PAIS por ISO-3 (USA = 249, 396, 873; DEU = 023, 025). Todos somam no país.
CREATE TABLE country_mdic_codes (
  mdic_code TEXT PRIMARY KEY CHECK (length(mdic_code) = 3),
  iso3 TEXT NOT NULL REFERENCES countries(iso3),
  name_pt TEXT NOT NULL
);

CREATE TABLE trade_list_versions (
  id TEXT PRIMARY KEY,                       -- '2026-10' ou '2026-10-manual-DEU-<uuid>'
  kind TEXT NOT NULL CHECK (kind IN ('monthly','manual')),
  iso3 TEXT REFERENCES countries(iso3),      -- só na manual
  reference_month TEXT NOT NULL,
  classification_json TEXT NOT NULL,         -- parâmetro agri_classification vigente na criação
  params_json TEXT NOT NULL,                 -- anos e orçamento vigentes na criação
  mdic_validators_json TEXT NOT NULL DEFAULT '{}', -- {"2026":{"etag","lastModified","size","gen"}}
  comtrade_blocked TEXT,                     -- motivo (ex.: 'auth', 'no_key'); rotina da Comtrade parada
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','partial','failed')),
  started_at TEXT NOT NULL, finished_at TEXT, note TEXT,
  CHECK ((kind='manual') = (iso3 IS NOT NULL))
);

CREATE TABLE trade_list_status (
  version_id TEXT NOT NULL REFERENCES trade_list_versions(id),
  iso3 TEXT NOT NULL REFERENCES countries(iso3),
  source TEXT NOT NULL CHECK (source IN ('comtrade','mdic')),
  state TEXT NOT NULL CHECK (state IN ('purchase_identified','no_record','data_unavailable','not_declared','pending')),
  last_period TEXT, lines INTEGER NOT NULL DEFAULT 0, error TEXT, updated_at TEXT NOT NULL,
  PRIMARY KEY (version_id, iso3, source)
);

-- Ponteiro por país e fonte; avança só por CAS (revision) depois de o objeto completo estar no R2.
CREATE TABLE trade_list_current (
  iso3 TEXT NOT NULL REFERENCES countries(iso3),
  source TEXT NOT NULL CHECK (source IN ('comtrade','mdic')),
  version_id TEXT NOT NULL REFERENCES trade_list_versions(id),
  r2_key TEXT NOT NULL, content_sha256 TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (iso3, source)
);

-- Trabalho da rotina. A fila só carrega o id; o estado verdadeiro está aqui (lease + fencing token).
CREATE TABLE trade_list_jobs (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES trade_list_versions(id),
  kind TEXT NOT NULL CHECK (kind IN ('mdic_ref','mdic_chunk','mdic_merge','comtrade_ref','comtrade_da','comtrade_call','consolidate')),
  job_key TEXT NOT NULL,                     -- 'mdic:2026:g1:7' | 'comtrade:DEU:2' | 'consolidate:comtrade:DEU'
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','done','failed','superseded')),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT, lease_until TEXT,
  next_attempt_at TEXT, enqueued_at TEXT,
  result_r2_key TEXT, result_sha256 TEXT,
  error_kind TEXT, error TEXT, done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (version_id, job_key)
);
CREATE INDEX idx_trade_jobs_due ON trade_list_jobs(status, next_attempt_at);
CREATE INDEX idx_trade_jobs_version ON trade_list_jobs(version_id, kind, status);

-- Orçamento diário por provedor (reserva atômica antes de cada chamada, inclusive referências e retentativas).
CREATE TABLE provider_budget (
  provider TEXT NOT NULL, day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (provider, day)
);

CREATE TABLE trade_list_manual_refresh (
  iso3 TEXT NOT NULL REFERENCES countries(iso3), day TEXT NOT NULL,
  version_id TEXT NOT NULL REFERENCES trade_list_versions(id),
  requested_by TEXT NOT NULL, reason TEXT NOT NULL,
  PRIMARY KEY (iso3, day)
);

CREATE TABLE country_analyses (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  iso3 TEXT NOT NULL REFERENCES countries(iso3),
  period_months INTEGER NOT NULL CHECK (period_months BETWEEN 1 AND 60),
  comtrade_version_id TEXT REFERENCES trade_list_versions(id),
  comtrade_r2_key TEXT, mdic_version_id TEXT REFERENCES trade_list_versions(id), mdic_r2_key TEXT,
  snapshot_sha256 TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE commodity_selections (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  analysis_id TEXT NOT NULL REFERENCES country_analyses(id),
  items_json TEXT NOT NULL,                  -- [{ productId|null, hs6: [...], label, campaignId }]
  selected_by TEXT NOT NULL, selected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE commercial_validations (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  selection_id TEXT NOT NULL REFERENCES commodity_selections(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')), reason TEXT NOT NULL,
  decided_by TEXT NOT NULL, decided_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE company_conditions (
  tenant_id TEXT NOT NULL REFERENCES tenants(id), company_id TEXT NOT NULL REFERENCES companies(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  condition TEXT NOT NULL CHECK (condition IN ('imports_from_brazil','buys_commodity','consumes_as_input')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed','pending','not_found')),
  evidence_id TEXT REFERENCES evidence(id), note TEXT,
  updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (tenant_id, company_id, product_id, condition),
  CHECK (status <> 'confirmed' OR evidence_id IS NOT NULL),
  CHECK (status <> 'not_found' OR note IS NOT NULL)
);

ALTER TABLE companies ADD COLUMN size_band TEXT CHECK (size_band IN ('small','medium','medium_plus','giant'));
ALTER TABLE companies ADD COLUMN size_source TEXT;
ALTER TABLE companies ADD COLUMN size_checked_at TEXT;
ALTER TABLE campaigns ADD COLUMN analysis_id TEXT REFERENCES country_analyses(id);
ALTER TABLE campaigns ADD COLUMN selection_id TEXT REFERENCES commodity_selections(id);
