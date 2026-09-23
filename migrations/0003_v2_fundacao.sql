PRAGMA defer_foreign_keys = true;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  commodity TEXT NOT NULL,
  group_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  origins_json TEXT NOT NULL,              -- ex.: ["SITE","SOLICITACAO"]
  source_ref TEXT,
  consulted_at TEXT,
  identity_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (identity_status IN ('confirmed','pending')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, group_name, variant_name)
);

CREATE TABLE product_codes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  code_system TEXT NOT NULL CHECK (code_system IN ('NCM','HS')),
  code TEXT NOT NULL,
  classification_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed','pending')),
  UNIQUE (product_id, code_system, code)
);

CREATE TABLE product_characteristics (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  char_key TEXT NOT NULL,
  char_value TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed','not_confirmed')),
  sample_only INTEGER NOT NULL DEFAULT 0 CHECK (sample_only IN (0,1))
);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  market TEXT NOT NULL CHECK (market IN ('national','international')),
  name TEXT NOT NULL,
  origin_city TEXT, origin_uf TEXT, radius_km INTEGER,
  country_code TEXT,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','waiting','paused','ended')),
  review_due_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK ((market='national' AND origin_city IS NOT NULL AND origin_uf IS NOT NULL AND radius_km IS NOT NULL AND country_code IS NULL)
      OR (market='international' AND country_code IS NOT NULL AND origin_city IS NULL))
);
CREATE INDEX idx_campaigns_active ON campaigns(tenant_id, market, status);

CREATE TABLE campaign_icp (
  campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id),
  user_sectors_json TEXT NOT NULL,         -- setores usuários (uso final), ex.: ["refrigerantes","balas"]
  size_target TEXT NOT NULL CHECK (size_target IN ('medium','medium_plus')),
  region TEXT NOT NULL,
  decision_role TEXT NOT NULL,
  influencer_role TEXT NOT NULL,
  supply_pains TEXT,
  buying_cycle_days INTEGER,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE campaign_declarations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  kind TEXT NOT NULL CHECK (kind IN ('volume_available','social_proof')),
  value_bool INTEGER CHECK (value_bool IN (0,1)),
  text TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','revoked')),
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  review_due_at TEXT,
  CHECK ((kind='volume_available' AND value_bool IS NOT NULL) OR (kind='social_proof' AND text IS NOT NULL))
);

CREATE TABLE suppression_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  identifier_hash TEXT NOT NULL,           -- HMAC-SHA-256 hex do identificador normalizado
  channel TEXT NOT NULL CHECK (channel IN ('email','phone','linkedin')),
  reason TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('link','reply','manual','openclaw','bounce')),
  retention_until TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, identifier_hash, channel)
);

CREATE TABLE pauses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  scope TEXT NOT NULL CHECK (scope IN ('company','campaign','commodity','offer','operation')),
  scope_ref TEXT,                          -- NULL só quando scope='operation'
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resumed_by TEXT, resumed_at TEXT, resume_reason TEXT,
  CHECK ((scope='operation' AND scope_ref IS NULL) OR (scope<>'operation' AND scope_ref IS NOT NULL))
);
CREATE INDEX idx_pauses_open ON pauses(tenant_id, scope, scope_ref) WHERE resumed_at IS NULL;

-- demands: remove o CHECK (sugar,coffee) e liga ao catálogo
CREATE TABLE demands_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  commodity TEXT NOT NULL,
  product_id TEXT REFERENCES products(id),
  market TEXT NOT NULL DEFAULT 'international' CHECK (market IN ('national','international')),
  product_variant TEXT, supplier_reference TEXT,
  currency_base TEXT NOT NULL DEFAULT 'USD',
  completeness REAL NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),
  current_state TEXT, desired_state TEXT, gap_summary TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  final_buyer_required INTEGER NOT NULL DEFAULT 0 CHECK (final_buyer_required IN (0,1)),
  UNIQUE (tenant_id, company_id, commodity, market, product_id)
);
INSERT INTO demands_new (id,tenant_id,company_id,commodity,product_id,market,product_variant,supplier_reference,currency_base,completeness,current_state,desired_state,gap_summary,created_by,created_at,updated_at)
  SELECT id,tenant_id,company_id,commodity,NULL,'international',product_variant,supplier_reference,currency_base,completeness,current_state,desired_state,gap_summary,created_by,created_at,updated_at FROM demands;
DROP VIEW company_latest_scores;
CREATE TABLE demand_fields_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  demand_id TEXT NOT NULL REFERENCES demands_new(id),
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
INSERT INTO demand_fields_new SELECT * FROM demand_fields;
CREATE TABLE scores_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  demand_id TEXT REFERENCES demands_new(id),
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
INSERT INTO scores_new SELECT * FROM scores;
CREATE TABLE approvals_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  demand_id TEXT REFERENCES demands_new(id),
  approval_type TEXT NOT NULL CHECK (approval_type IN ('below_minimum','risk_coverage_waiver','risk_mitigation','intermediary_validation')),
  status TEXT NOT NULL CHECK (status IN ('approved','rejected','pending')),
  reason TEXT NOT NULL,
  approved_by TEXT,
  decided_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO approvals_new SELECT * FROM approvals;
DROP TABLE demand_fields;
DROP TABLE scores;
DROP TABLE approvals;
DROP TABLE demands;
ALTER TABLE demands_new RENAME TO demands;
ALTER TABLE demand_fields_new RENAME TO demand_fields;
ALTER TABLE scores_new RENAME TO scores;
ALTER TABLE approvals_new RENAME TO approvals;
CREATE INDEX idx_scores_latest ON scores(tenant_id,company_id,score_type,calculated_at DESC);


CREATE UNIQUE INDEX idx_demands_legacy_unique ON demands(tenant_id, company_id, commodity, market) WHERE product_id IS NULL;
CREATE INDEX idx_demands_company ON demands(tenant_id,company_id,updated_at DESC);
ALTER TABLE tenants ADD COLUMN parameter_revision INTEGER NOT NULL DEFAULT 1 CHECK(parameter_revision >= 1);
ALTER TABLE companies ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1);
ALTER TABLE evidence ADD COLUMN product_id TEXT REFERENCES products(id);
ALTER TABLE evidence ADD COLUMN market TEXT CHECK(market IN ('national','international'));
ALTER TABLE contact_verifications ADD COLUMN demand_id TEXT REFERENCES demands(id);
ALTER TABLE approvals ADD COLUMN company_revision INTEGER;
ALTER TABLE approvals ADD COLUMN parameter_revision INTEGER;
ALTER TABLE scores ADD COLUMN company_revision INTEGER;
ALTER TABLE scores ADD COLUMN parameter_revision INTEGER;
CREATE VIEW company_latest_scores AS
SELECT * FROM (SELECT s.*, ROW_NUMBER() OVER (PARTITION BY tenant_id,company_id,demand_id,score_type ORDER BY calculated_at DESC,rowid DESC) position FROM scores s) WHERE position=1;
CREATE INDEX idx_scores_demand_latest ON scores(tenant_id,company_id,demand_id,score_type,calculated_at DESC);
CREATE INDEX idx_verifications_contact ON contact_verifications(tenant_id,contact_id,demand_id,verification_type,verified_at DESC);
CREATE INDEX idx_approvals_demand ON approvals(tenant_id,company_id,demand_id,approval_type,created_at DESC);
CREATE INDEX idx_screening_company ON screening_runs(tenant_id,company_id,initiated_at DESC);
CREATE INDEX idx_screening_matches ON screening_matches(tenant_id,screening_run_id);
CREATE INDEX idx_screening_decisions ON screening_decisions(tenant_id,screening_match_id,decided_at DESC);
-- Os fatos antigos permanecem. Valores sem fonte não podem ser confirmados no gate v2.
UPDATE demand_fields SET field_status='not_confirmed',confirmed_by=NULL,confirmed_at=NULL
WHERE field_status='confirmed' AND (source_reference IS NULL OR trim(source_reference)='');
UPDATE demands SET completeness=0;
UPDATE companies SET pipeline_status='qualifying',revision=revision+1 WHERE pipeline_status IN ('qualified','confirmed_opportunity');
CREATE TRIGGER parameter_revision_insert AFTER INSERT ON parameters BEGIN
 UPDATE tenants SET parameter_revision=parameter_revision+1 WHERE id=NEW.tenant_id;
 UPDATE companies SET pipeline_status='qualifying' WHERE tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity');
END;
CREATE TRIGGER parameter_revision_update AFTER UPDATE ON parameters BEGIN
 UPDATE tenants SET parameter_revision=parameter_revision+1 WHERE id=NEW.tenant_id;
 UPDATE companies SET pipeline_status='qualifying' WHERE tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity');
END;

CREATE TRIGGER evidence_tenant_insert BEFORE INSERT ON evidence WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER evidence_tenant_update BEFORE UPDATE ON evidence WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER contacts_tenant_insert BEFORE INSERT ON contacts WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER contacts_tenant_update BEFORE UPDATE ON contacts WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER demands_tenant_insert BEFORE INSERT ON demands WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) OR (NEW.product_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM products p WHERE p.id=NEW.product_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER demands_tenant_update BEFORE UPDATE ON demands WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) OR (NEW.product_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM products p WHERE p.id=NEW.product_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER risk_observations_tenant_insert BEFORE INSERT ON risk_observations WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER risk_observations_tenant_update BEFORE UPDATE ON risk_observations WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER scores_tenant_insert BEFORE INSERT ON scores WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) OR (NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands p WHERE p.id=NEW.demand_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER scores_tenant_update BEFORE UPDATE ON scores WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) OR (NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands p WHERE p.id=NEW.demand_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER approvals_tenant_insert BEFORE INSERT ON approvals WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) OR (NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands p WHERE p.id=NEW.demand_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER approvals_tenant_update BEFORE UPDATE ON approvals WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) OR (NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands p WHERE p.id=NEW.demand_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER contact_verifications_tenant_insert BEFORE INSERT ON contact_verifications WHEN (NEW.contact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM contacts p WHERE p.id=NEW.contact_id AND p.tenant_id=NEW.tenant_id)) OR (NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands p WHERE p.id=NEW.demand_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER contact_verifications_tenant_update BEFORE UPDATE ON contact_verifications WHEN (NEW.contact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM contacts p WHERE p.id=NEW.contact_id AND p.tenant_id=NEW.tenant_id)) OR (NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands p WHERE p.id=NEW.demand_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER demand_fields_tenant_insert BEFORE INSERT ON demand_fields WHEN (NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands p WHERE p.id=NEW.demand_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER demand_fields_tenant_update BEFORE UPDATE ON demand_fields WHEN (NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands p WHERE p.id=NEW.demand_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER campaigns_tenant_insert BEFORE INSERT ON campaigns WHEN (NEW.product_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM products p WHERE p.id=NEW.product_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER campaigns_tenant_update BEFORE UPDATE ON campaigns WHEN (NEW.product_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM products p WHERE p.id=NEW.product_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER screening_runs_tenant_insert BEFORE INSERT ON screening_runs WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER screening_runs_tenant_update BEFORE UPDATE ON screening_runs WHEN (NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies p WHERE p.id=NEW.company_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER screening_matches_tenant_insert BEFORE INSERT ON screening_matches WHEN (NEW.screening_run_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM screening_runs p WHERE p.id=NEW.screening_run_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER screening_matches_tenant_update BEFORE UPDATE ON screening_matches WHEN (NEW.screening_run_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM screening_runs p WHERE p.id=NEW.screening_run_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER screening_decisions_tenant_insert BEFORE INSERT ON screening_decisions WHEN (NEW.screening_match_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM screening_matches p WHERE p.id=NEW.screening_match_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;

CREATE TRIGGER screening_decisions_tenant_update BEFORE UPDATE ON screening_decisions WHEN (NEW.screening_match_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM screening_matches p WHERE p.id=NEW.screening_match_id AND p.tenant_id=NEW.tenant_id)) BEGIN SELECT RAISE(ABORT,'tenant_reference_mismatch'); END;
CREATE TRIGGER scores_demand_company_insert BEFORE INSERT ON scores WHEN NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands d WHERE d.id=NEW.demand_id AND d.company_id=NEW.company_id AND d.tenant_id=NEW.tenant_id) BEGIN SELECT RAISE(ABORT,'demand_company_mismatch'); END;
CREATE TRIGGER scores_demand_company_update BEFORE UPDATE ON scores WHEN NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands d WHERE d.id=NEW.demand_id AND d.company_id=NEW.company_id AND d.tenant_id=NEW.tenant_id) BEGIN SELECT RAISE(ABORT,'demand_company_mismatch'); END;
CREATE TRIGGER approvals_demand_company_insert BEFORE INSERT ON approvals WHEN NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands d WHERE d.id=NEW.demand_id AND d.company_id=NEW.company_id AND d.tenant_id=NEW.tenant_id) BEGIN SELECT RAISE(ABORT,'demand_company_mismatch'); END;
CREATE TRIGGER approvals_demand_company_update BEFORE UPDATE ON approvals WHEN NEW.demand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM demands d WHERE d.id=NEW.demand_id AND d.company_id=NEW.company_id AND d.tenant_id=NEW.tenant_id) BEGIN SELECT RAISE(ABORT,'demand_company_mismatch'); END;
CREATE TRIGGER evidence_invalidate_insert AFTER INSERT ON evidence BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER evidence_invalidate_update AFTER UPDATE ON evidence BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER evidence_invalidate_delete AFTER DELETE ON evidence BEGIN UPDATE companies SET revision=revision+1 WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER contacts_invalidate_insert AFTER INSERT ON contacts BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER contacts_invalidate_update AFTER UPDATE ON contacts BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER contacts_invalidate_delete AFTER DELETE ON contacts BEGIN UPDATE companies SET revision=revision+1 WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER demands_invalidate_insert AFTER INSERT ON demands BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER demands_invalidate_update AFTER UPDATE ON demands BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER demands_invalidate_delete AFTER DELETE ON demands BEGIN UPDATE companies SET revision=revision+1 WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER risk_observations_invalidate_insert AFTER INSERT ON risk_observations BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER risk_observations_invalidate_update AFTER UPDATE ON risk_observations BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER risk_observations_invalidate_delete AFTER DELETE ON risk_observations BEGIN UPDATE companies SET revision=revision+1 WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER screening_runs_invalidate_insert AFTER INSERT ON screening_runs BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER screening_runs_invalidate_update AFTER UPDATE ON screening_runs BEGIN UPDATE companies SET revision=revision+1 WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER screening_runs_invalidate_delete AFTER DELETE ON screening_runs BEGIN UPDATE companies SET revision=revision+1 WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=OLD.company_id AND tenant_id=OLD.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER demand_fields_invalidate_insert AFTER INSERT ON demand_fields BEGIN UPDATE companies SET revision=revision+1 WHERE id=(SELECT company_id FROM demands WHERE id=NEW.demand_id) AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=(SELECT company_id FROM demands WHERE id=NEW.demand_id) AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER demand_fields_invalidate_update AFTER UPDATE ON demand_fields BEGIN UPDATE companies SET revision=revision+1 WHERE id=(SELECT company_id FROM demands WHERE id=NEW.demand_id) AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=(SELECT company_id FROM demands WHERE id=NEW.demand_id) AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER demand_fields_invalidate_delete AFTER DELETE ON demand_fields BEGIN UPDATE companies SET revision=revision+1 WHERE id=(SELECT company_id FROM demands WHERE id=OLD.demand_id) AND tenant_id=OLD.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=(SELECT company_id FROM demands WHERE id=OLD.demand_id) AND tenant_id=OLD.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER contact_verifications_invalidate_insert AFTER INSERT ON contact_verifications BEGIN UPDATE companies SET revision=revision+1 WHERE id=(SELECT company_id FROM contacts WHERE id=NEW.contact_id) AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=(SELECT company_id FROM contacts WHERE id=NEW.contact_id) AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER contact_verifications_invalidate_update AFTER UPDATE ON contact_verifications BEGIN UPDATE companies SET revision=revision+1 WHERE id=(SELECT company_id FROM contacts WHERE id=NEW.contact_id) AND tenant_id=NEW.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=(SELECT company_id FROM contacts WHERE id=NEW.contact_id) AND tenant_id=NEW.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER contact_verifications_invalidate_delete AFTER DELETE ON contact_verifications BEGIN UPDATE companies SET revision=revision+1 WHERE id=(SELECT company_id FROM contacts WHERE id=OLD.contact_id) AND tenant_id=OLD.tenant_id; UPDATE companies SET pipeline_status='qualifying' WHERE id=(SELECT company_id FROM contacts WHERE id=OLD.contact_id) AND tenant_id=OLD.tenant_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER sanction_sources_invalidate_insert AFTER INSERT ON sanction_sources BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER sanction_sources_invalidate_update AFTER UPDATE ON sanction_sources BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER sanction_sources_invalidate_delete AFTER DELETE ON sanction_sources BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER sanction_list_versions_invalidate_insert AFTER INSERT ON sanction_list_versions BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER sanction_list_versions_invalidate_update AFTER UPDATE ON sanction_list_versions BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER sanction_list_versions_invalidate_delete AFTER DELETE ON sanction_list_versions BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER screening_matches_invalidate_insert AFTER INSERT ON screening_matches BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER screening_matches_invalidate_update AFTER UPDATE ON screening_matches BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER screening_matches_invalidate_delete AFTER DELETE ON screening_matches BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER screening_decisions_invalidate_insert AFTER INSERT ON screening_decisions BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER screening_decisions_invalidate_update AFTER UPDATE ON screening_decisions BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER screening_decisions_invalidate_delete AFTER DELETE ON screening_decisions BEGIN UPDATE tenants SET parameter_revision=parameter_revision+1; UPDATE companies SET pipeline_status='qualifying' WHERE pipeline_status IN ('qualified','confirmed_opportunity'); END;

-- Serializa decisões concorrentes sem invalidar outras exceções vigentes.
ALTER TABLE companies ADD COLUMN approval_revision INTEGER NOT NULL DEFAULT 1 CHECK(approval_revision >= 1);
CREATE TRIGGER approvals_revision_insert AFTER INSERT ON approvals BEGIN UPDATE companies SET approval_revision=approval_revision+1 WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id; UPDATE companies SET pipeline_status='qualifying' WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER approvals_revision_update AFTER UPDATE ON approvals BEGIN UPDATE companies SET approval_revision=approval_revision+1 WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id; UPDATE companies SET pipeline_status='qualifying' WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE TRIGGER approvals_revision_delete AFTER DELETE ON approvals BEGIN UPDATE companies SET approval_revision=approval_revision+1 WHERE tenant_id=OLD.tenant_id AND id=OLD.company_id; UPDATE companies SET pipeline_status='qualifying' WHERE tenant_id=OLD.tenant_id AND id=OLD.company_id AND pipeline_status IN ('qualified','confirmed_opportunity'); END;
CREATE INDEX idx_company_registration ON companies(tenant_id,country_code,registration_id_type,registration_id);
CREATE TRIGGER company_identifier_insert BEFORE INSERT ON companies WHEN NEW.registration_id IS NOT NULL AND NEW.registration_id_type IS NOT NULL AND EXISTS(SELECT 1 FROM companies c WHERE c.id<>NEW.id AND c.tenant_id=NEW.tenant_id AND c.country_code=NEW.country_code AND upper(c.registration_id_type)=upper(NEW.registration_id_type) AND ((NEW.country_code='BR' AND upper(NEW.registration_id_type)='CNPJ' AND upper(replace(replace(replace(replace(c.registration_id,'.',''),'/',''),'-',''),' ',''))=upper(replace(replace(replace(replace(NEW.registration_id,'.',''),'/',''),'-',''),' ',''))) OR (NOT(NEW.country_code='BR' AND upper(NEW.registration_id_type)='CNPJ') AND c.registration_id=NEW.registration_id))) BEGIN SELECT RAISE(ABORT,'company_identifier_duplicate'); END;
CREATE TRIGGER company_identifier_update BEFORE UPDATE ON companies WHEN NEW.registration_id IS NOT NULL AND NEW.registration_id_type IS NOT NULL AND EXISTS(SELECT 1 FROM companies c WHERE c.id<>NEW.id AND c.tenant_id=NEW.tenant_id AND c.country_code=NEW.country_code AND upper(c.registration_id_type)=upper(NEW.registration_id_type) AND ((NEW.country_code='BR' AND upper(NEW.registration_id_type)='CNPJ' AND upper(replace(replace(replace(replace(c.registration_id,'.',''),'/',''),'-',''),' ',''))=upper(replace(replace(replace(replace(NEW.registration_id,'.',''),'/',''),'-',''),' ',''))) OR (NOT(NEW.country_code='BR' AND upper(NEW.registration_id_type)='CNPJ') AND c.registration_id=NEW.registration_id))) BEGIN SELECT RAISE(ABORT,'company_identifier_duplicate'); END;
