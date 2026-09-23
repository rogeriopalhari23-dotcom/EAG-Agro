PRAGMA foreign_keys = ON;

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','commercial_manager','seller_analyst','auditor_viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, email)
);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  country_code TEXT NOT NULL,
  registration_id TEXT,
  registration_id_type TEXT,
  buyer_type TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (buyer_type IN ('final_buyer','intermediary','unconfirmed')),
  pipeline_status TEXT NOT NULL DEFAULT 'discovered' CHECK (pipeline_status IN ('discovered','prospected','in_contact','qualifying','qualified','confirmed_opportunity','blocked','inactive')),
  exception_status TEXT CHECK (exception_status IN ('below_minimum','sanction_review','sanction_blocked','risk_inconclusive','high_risk_without_mitigation','outside_icp','no_progress')),
  owner_user_id TEXT REFERENCES users(id),
  source_label TEXT NOT NULL,
  source_url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, country_code, legal_name)
);

CREATE INDEX idx_companies_tenant_pipeline ON companies(tenant_id, pipeline_status);
CREATE INDEX idx_companies_tenant_country ON companies(tenant_id, country_code);
CREATE INDEX idx_companies_registration ON companies(tenant_id, registration_id);
CREATE INDEX idx_companies_tenant_updated ON companies(tenant_id, updated_at DESC) WHERE pipeline_status!='inactive';

CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  category TEXT NOT NULL CHECK (category IN ('business','market','commercial_signal')),
  evidence_type TEXT NOT NULL,
  reference TEXT NOT NULL,
  source_url TEXT,
  fact_date TEXT,
  consulted_at TEXT NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','valid','invalid','conflicting')),
  validated_by TEXT REFERENCES users(id),
  validated_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_evidence_company_category ON evidence(tenant_id, company_id, category, validation_status);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  full_name_encrypted TEXT,
  job_title_encrypted TEXT,
  email_encrypted TEXT,
  phone_encrypted TEXT,
  linkedin_url_encrypted TEXT,
  source_label TEXT NOT NULL,
  source_url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE contact_verifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  verification_type TEXT NOT NULL CHECK (verification_type IN ('email_deliverable','identity','job_title','decision_authority','direct_demand')),
  status TEXT NOT NULL CHECK (status IN ('confirmed','rejected','pending')),
  method TEXT NOT NULL,
  source_reference TEXT,
  verified_by TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE demands (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  commodity TEXT NOT NULL CHECK (commodity IN ('sugar','coffee')),
  product_variant TEXT,
  supplier_reference TEXT,
  currency_base TEXT NOT NULL DEFAULT 'USD',
  completeness REAL NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),
  current_state TEXT,
  desired_state TEXT,
  gap_summary TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, company_id, commodity)
);

CREATE TABLE demand_fields (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  demand_id TEXT NOT NULL REFERENCES demands(id),
  field_key TEXT NOT NULL,
  field_status TEXT NOT NULL CHECK (field_status IN ('confirmed','not_confirmed','not_applicable')),
  value_json TEXT,
  not_applicable_reason TEXT,
  source_reference TEXT,
  confirmed_by TEXT,
  confirmed_at TEXT,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, demand_id, field_key)
);

CREATE TABLE scores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  demand_id TEXT REFERENCES demands(id),
  score_type TEXT NOT NULL CHECK (score_type IN ('potential','confidence','risk')),
  score_value REAL,
  score_min REAL,
  score_max REAL,
  coverage REAL NOT NULL CHECK (coverage BETWEEN 0 AND 100),
  classification TEXT,
  components_json TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  calculated_by TEXT NOT NULL,
  calculated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_scores_latest ON scores(tenant_id, company_id, score_type, calculated_at DESC);

CREATE TABLE risk_observations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  component TEXT NOT NULL CHECK (component IN ('registration','credit','payment','reputation','logistics')),
  severity REAL NOT NULL CHECK (severity BETWEEN 0 AND 20),
  source_reference TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_risk_observations_company ON risk_observations(tenant_id, company_id, component, observed_at DESC);

CREATE TABLE parameters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  parameter_key TEXT NOT NULL,
  scope_key TEXT NOT NULL DEFAULT 'global',
  value_json TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  changed_by TEXT NOT NULL,
  change_reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, parameter_key, scope_key, effective_from)
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  demand_id TEXT REFERENCES demands(id),
  approval_type TEXT NOT NULL CHECK (approval_type IN ('below_minimum','risk_coverage_waiver','risk_mitigation','intermediary_validation')),
  status TEXT NOT NULL CHECK (status IN ('approved','rejected','pending')),
  reason TEXT NOT NULL,
  approved_by TEXT,
  decided_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sanction_sources (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  official_url TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  blocking_policy TEXT NOT NULL CHECK (blocking_policy IN ('legal_block','integrity_alert','review_only')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE sanction_list_versions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sanction_sources(id),
  source_version TEXT,
  content_hash TEXT NOT NULL,
  published_at TEXT,
  downloaded_at TEXT NOT NULL,
  record_count INTEGER,
  storage_key TEXT,
  import_status TEXT NOT NULL CHECK (import_status IN ('pending','imported','failed')),
  error_summary TEXT,
  UNIQUE (source_id, content_hash)
);

CREATE TABLE sanction_entries (
  id TEXT PRIMARY KEY,
  list_version_id TEXT NOT NULL REFERENCES sanction_list_versions(id),
  official_entity_id TEXT,
  primary_name TEXT NOT NULL,
  entity_type TEXT,
  country_code TEXT,
  program TEXT,
  raw_json TEXT NOT NULL
);

CREATE INDEX idx_sanction_entries_id_country ON sanction_entries(official_entity_id, country_code);
CREATE INDEX idx_sanction_entries_name ON sanction_entries(primary_name);

CREATE TABLE sanction_aliases (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES sanction_entries(id),
  alias_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL
);

CREATE INDEX idx_sanction_aliases_normalized ON sanction_aliases(normalized_name);

CREATE TABLE screening_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  initiated_by TEXT NOT NULL,
  initiated_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed')),
  query_json TEXT NOT NULL,
  source_versions_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE screening_matches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  screening_run_id TEXT NOT NULL REFERENCES screening_runs(id),
  sanction_entry_id TEXT NOT NULL REFERENCES sanction_entries(id),
  match_method TEXT NOT NULL CHECK (match_method IN ('official_id_country','exact_name','substring','fuzzy','phonetic','blocked_country')),
  similarity REAL,
  country_compatible INTEGER CHECK (country_compatible IN (0,1)),
  reliable_identifier_match INTEGER NOT NULL DEFAULT 0 CHECK (reliable_identifier_match IN (0,1)),
  recommended_action TEXT NOT NULL CHECK (recommended_action IN ('block','review','discard')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE screening_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  screening_match_id TEXT NOT NULL REFERENCES screening_matches(id),
  decision TEXT NOT NULL CHECK (decision IN ('confirmed_block','false_positive','keep_reviewing','integrity_alert')),
  reason TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT,
  old_value_json TEXT,
  new_value_json TEXT,
  reason TEXT,
  evidence_id TEXT,
  formula_version TEXT,
  parameters_json TEXT,
  request_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_audit_entity ON audit_log(tenant_id, entity_type, entity_id, occurred_at DESC);

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE VIEW company_latest_scores AS
SELECT s.* FROM scores s
JOIN (
  SELECT tenant_id, company_id, score_type, MAX(calculated_at) calculated_at
  FROM scores GROUP BY tenant_id, company_id, score_type
) latest ON latest.tenant_id=s.tenant_id AND latest.company_id=s.company_id AND latest.score_type=s.score_type AND latest.calculated_at=s.calculated_at;

PRAGMA optimize;
