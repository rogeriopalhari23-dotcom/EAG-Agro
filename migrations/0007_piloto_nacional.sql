-- P2-T1: esquema do piloto nacional sobre a 0003 real (errata: aprovação por destinatário/canal,
-- hash por mensagem, outbox com lease em D1, indeterminado bloqueado, resposta ambígua mantém pausa).
PRAGMA defer_foreign_keys = true;

-- Municípios (P2-T2): fonte e versão sempre registradas; centroide é estimativa.
CREATE TABLE municipalities (
  ibge_code INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  uf TEXT NOT NULL CHECK (length(uf) = 2),
  lat REAL NOT NULL CHECK (lat BETWEEN -35 AND 6),
  lon REAL NOT NULL CHECK (lon BETWEEN -75 AND -28),
  source TEXT NOT NULL,
  source_version TEXT NOT NULL
);
CREATE INDEX idx_municipalities_uf_name ON municipalities(uf, name_normalized);
CREATE INDEX idx_municipalities_lat ON municipalities(lat, lon);

-- Setor usuário → CNAE (P2-T3): lista revisada por Rogério; nenhuma linha semeada aqui.
CREATE TABLE sector_cnae (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  sector_key TEXT NOT NULL,
  cnae_code TEXT NOT NULL CHECK (length(cnae_code) = 7),
  label TEXT NOT NULL,
  source TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, sector_key, cnae_code)
);

ALTER TABLE companies ADD COLUMN cnpj_root TEXT CHECK (cnpj_root IS NULL OR length(cnpj_root) = 8);
CREATE UNIQUE INDEX idx_companies_cnpj_root ON companies(tenant_id, cnpj_root) WHERE cnpj_root IS NOT NULL;

-- Unidade (estabelecimento) com precisão geográfica explícita (P2-T4, P2-T5, P2-T6).
CREATE TABLE company_units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  cnpj TEXT NOT NULL CHECK (length(cnpj) = 14),
  unit_role TEXT NOT NULL DEFAULT 'unknown' CHECK (unit_role IN ('consumer','receiving','headquarters','unknown')),
  trade_name TEXT,
  street TEXT, street_number TEXT, district TEXT, postal_code TEXT,
  municipality_ibge INTEGER REFERENCES municipalities(ibge_code),
  municipality_name TEXT, uf TEXT,
  lat REAL, lon REAL,
  geo_precision TEXT NOT NULL DEFAULT 'unknown' CHECK (geo_precision IN ('address','municipality_centroid','manual','unknown')),
  geo_source TEXT, geocoded_at TEXT,
  size_code TEXT, size_label TEXT, size_source TEXT,
  registration_status TEXT, primary_cnae TEXT, secondary_cnaes_json TEXT NOT NULL DEFAULT '[]',
  mei INTEGER CHECK (mei IN (0,1)),
  source_label TEXT NOT NULL, source_ref TEXT, consulted_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, cnpj),
  CHECK ((lat IS NULL) = (lon IS NULL)),
  CHECK (geo_precision = 'unknown' OR lat IS NOT NULL)
);
CREATE INDEX idx_units_company ON company_units(tenant_id, company_id);

-- Perfil comprador por empresa (+ unidade opcional) + produto (R14).
CREATE TABLE buyer_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  unit_key TEXT NOT NULL DEFAULT '',          -- '' = empresa inteira; senão id da unidade
  product_id TEXT NOT NULL REFERENCES products(id),
  profile_class TEXT NOT NULL CHECK (profile_class IN ('final_consumer_confirmed','possible_final_consumer','trader_distributor','unconfirmed')),
  basis TEXT NOT NULL,
  evidence_id TEXT REFERENCES evidence(id),
  icp_status TEXT NOT NULL CHECK (icp_status IN ('in_icp','out_small','out_giant','out_trader','pending_size')),
  exception_by TEXT, exception_at TEXT, exception_reason TEXT,
  relationship_note TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, company_id, unit_key, product_id),
  CHECK (profile_class <> 'final_consumer_confirmed' OR evidence_id IS NOT NULL)
);

-- Contatos: papel na prospecção e validação de e-mail (P2-T6, P2-T7).
ALTER TABLE contacts ADD COLUMN prospect_role TEXT CHECK (prospect_role IN ('decision_maker','influencer','provisional_decision_maker','other'));
ALTER TABLE contacts ADD COLUMN email_hash TEXT;
ALTER TABLE contacts ADD COLUMN email_validation TEXT CHECK (email_validation IN ('pending','valid','not_valid','unknown','catchall','error'));
ALTER TABLE contacts ADD COLUMN email_validated_at TEXT;
ALTER TABLE contacts ADD COLUMN email_validation_provider TEXT;
ALTER TABLE contacts ADD COLUMN email_validation_expires_at TEXT;
ALTER TABLE contacts ADD COLUMN relationship_note TEXT;
ALTER TABLE contacts ADD COLUMN timezone TEXT;
CREATE INDEX idx_contacts_email_hash ON contacts(tenant_id, email_hash);

-- Buscas nacionais versionadas e particionadas (P2-T4).
CREATE TABLE searches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  version INTEGER NOT NULL CHECK (version >= 1),
  parent_search_id TEXT REFERENCES searches(id),
  origin_ibge INTEGER NOT NULL REFERENCES municipalities(ibge_code),
  origin_lat REAL NOT NULL, origin_lon REAL NOT NULL,
  origin_precision TEXT NOT NULL CHECK (origin_precision IN ('municipality_centroid','address','coordinate')),
  radius_km INTEGER NOT NULL CHECK (radius_km > 0),
  cnae_codes_json TEXT NOT NULL,
  source_versions_json TEXT NOT NULL,         -- {"municipalities":"…","casadosdados":"v5"}
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','partial','complete','failed')),
  coverage_note TEXT,
  candidates_count INTEGER NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0,
  request_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT,
  UNIQUE (tenant_id, request_key),
  UNIQUE (campaign_id, version)
);
CREATE TABLE search_partitions (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES searches(id),
  municipality_ibge INTEGER NOT NULL REFERENCES municipalities(ibge_code),
  page INTEGER NOT NULL CHECK (page >= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','done','failed')),
  lease_owner TEXT, lease_until TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  result_total INTEGER,
  error TEXT,
  done_at TEXT,
  UNIQUE (search_id, municipality_ibge, page)
);
CREATE INDEX idx_partitions_ready ON search_partitions(status, next_attempt_at);
CREATE TABLE search_candidates (
  search_id TEXT NOT NULL REFERENCES searches(id),
  unit_id TEXT NOT NULL REFERENCES company_units(id),
  distance_km REAL,
  distance_basis TEXT NOT NULL CHECK (distance_basis IN ('address','municipality_centroid','unknown')),
  inside_radius TEXT NOT NULL CHECK (inside_radius IN ('confirmed','estimated','outside','unknown')),
  PRIMARY KEY (search_id, unit_id)
);

-- Fichas (P2-T9): ficha → versões imutáveis → mensagens com hash → aprovação por destinatário e canal.
CREATE TABLE fichas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_approval','approved','deferred','discarded')),
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  status_reason TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, company_id, campaign_id)
);
CREATE TABLE ficha_versions (
  id TEXT PRIMARY KEY,
  ficha_id TEXT NOT NULL REFERENCES fichas(id),
  version_no INTEGER NOT NULL CHECK (version_no >= 1),
  snapshot_enc TEXT NOT NULL,                 -- contexto congelado (destinatários, evidências, fuso), cifrado
  snapshot_sha256 TEXT NOT NULL,
  pv_report_json TEXT NOT NULL,
  review_ok INTEGER NOT NULL CHECK (review_ok IN (0,1)),
  skill_sha256 TEXT NOT NULL,
  templates_version TEXT NOT NULL,
  generator_version TEXT NOT NULL,
  superseded_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (ficha_id, version_no)
);
CREATE TABLE ficha_messages (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES ficha_versions(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  channel TEXT NOT NULL CHECK (channel IN ('email','call','linkedin')),
  step_no INTEGER NOT NULL CHECK (step_no >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('auto_email','manual_task')),
  day_offset INTEGER NOT NULL CHECK (day_offset >= 0),
  subject_enc TEXT,
  body_enc TEXT NOT NULL,
  message_sha256 TEXT NOT NULL,               -- hash dos bytes exatos a submeter (assunto + corpo)
  UNIQUE (version_id, contact_id, channel, step_no)
);
CREATE TABLE ficha_approvals (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES ficha_versions(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  channel TEXT NOT NULL CHECK (channel IN ('email','call','linkedin')),
  messages_sha256 TEXT NOT NULL,              -- hash da lista ordenada de message_sha256 aprovados
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','invalidated')),
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  invalidated_at TEXT, invalidated_reason TEXT,
  UNIQUE (version_id, contact_id, channel)
);

-- Outbox (P2-T10): uma linha por mensagem aprovada; aquisição por lease com token de cerca.
CREATE TABLE send_outbox (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  ficha_id TEXT NOT NULL REFERENCES fichas(id),
  message_row_id TEXT NOT NULL REFERENCES ficha_messages(id),
  approval_id TEXT NOT NULL REFERENCES ficha_approvals(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  commodity TEXT NOT NULL,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  email_hash TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email','call','linkedin')),
  step_no INTEGER NOT NULL,
  planned_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','blocked','waiting_sequence','leased','accepted','temp_failed','perm_failed','indeterminate','cancelled','superseded')),
  block_reason TEXT,
  message_id TEXT UNIQUE,
  message_sha256 TEXT NOT NULL,
  lease_owner TEXT, lease_until TEXT, lease_token INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  accepted_at TEXT,
  resolved_by TEXT, resolved_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (ficha_id, contact_id, channel, step_no)
);
CREATE INDEX idx_outbox_ready ON send_outbox(tenant_id, status, planned_date);
CREATE INDEX idx_outbox_company ON send_outbox(tenant_id, company_id, commodity, status);
CREATE INDEX idx_outbox_email ON send_outbox(tenant_id, email_hash, status);
CREATE TABLE send_log (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL REFERENCES send_outbox(id),
  event TEXT NOT NULL CHECK (event IN ('leased','accepted','temp_failed','perm_failed','indeterminate','blocked','cancelled','resolved_sent','resolved_not_sent','lease_expired')),
  detail TEXT,
  lease_token INTEGER,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_send_log_outbox ON send_log(outbox_id, at);
-- Coordenação por remetente: um envio por vez e contagem do dia, atualizadas de forma condicional.
CREATE TABLE sender_state (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  sender TEXT NOT NULL,
  lease_owner TEXT, lease_until TEXT, lease_token INTEGER NOT NULL DEFAULT 0,
  day TEXT, sent_today INTEGER NOT NULL DEFAULT 0,
  next_send_at TEXT,
  ramp_started_on TEXT, ramp_step INTEGER NOT NULL DEFAULT 0, last_step_up_on TEXT,
  stopped_at TEXT, stopped_reason TEXT,
  PRIMARY KEY (tenant_id, sender)
);

-- Canais começam planejados (R26); nenhum habilitado por migração.
CREATE TABLE channels (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','linkedin')),
  state TEXT NOT NULL CHECK (state IN ('planned','internal_test','enabled')),
  evidence_ref TEXT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, channel),
  CHECK (state <> 'enabled' OR evidence_ref IS NOT NULL)
);
INSERT INTO channels(tenant_id,channel,state,changed_by,changed_at)
  SELECT id,'email','planned','system-admin','2026-09-23T00:00:00Z' FROM tenants;
INSERT INTO channels(tenant_id,channel,state,changed_by,changed_at)
  SELECT id,'whatsapp','planned','system-admin','2026-09-23T00:00:00Z' FROM tenants;
INSERT INTO channels(tenant_id,channel,state,changed_by,changed_at)
  SELECT id,'linkedin','planned','system-admin','2026-09-23T00:00:00Z' FROM tenants;

-- Respostas (P2-T11): chave IMAP estável; correlação explícita, ambígua mantém pausa.
CREATE TABLE inbound_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mailbox TEXT NOT NULL,
  uidvalidity INTEGER NOT NULL,
  imap_uid INTEGER NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  references_json TEXT NOT NULL DEFAULT '[]',
  from_hash TEXT,
  classification TEXT NOT NULL CHECK (classification IN ('human','auto_reply','bounce_hard','bounce_soft','unsubscribe','provider_alert','unclassified')),
  correlation TEXT NOT NULL CHECK (correlation IN ('thread','sender','ambiguous','none')),
  outbox_id TEXT REFERENCES send_outbox(id),
  company_id TEXT REFERENCES companies(id),
  commodity TEXT,
  r2_key TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE (tenant_id, mailbox, uidvalidity, imap_uid)
);

-- Tarefas manuais e reuniões (P2-T14).
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  commodity TEXT,
  contact_id TEXT REFERENCES contacts(id),
  ficha_id TEXT REFERENCES fichas(id),
  outbox_id TEXT REFERENCES send_outbox(id),
  kind TEXT NOT NULL CHECK (kind IN ('call_l0','call_l1','call_l2','linkedin','reply_followup','meeting_confirm','return_suggested','provider_alert','review_ambiguous')),
  owner_id TEXT NOT NULL,
  due_date TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','suspended','cancelled')),
  suspended_reason TEXT,
  script TEXT,
  result_json TEXT,
  done_by TEXT, done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_tasks_open ON tasks(tenant_id, status, due_date);
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  contact_id TEXT REFERENCES contacts(id),
  owner_id TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min BETWEEN 10 AND 120),
  channel TEXT NOT NULL,
  invite_sent INTEGER NOT NULL CHECK (invite_sent IN (0,1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- OpenClaw (P2-T15): supressões primeiro; empresa ativa no sistema anterior bloqueia ficha/envio.
CREATE TABLE openclaw_imports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  r2_key TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  counts_json TEXT NOT NULL,
  conflicts_json TEXT NOT NULL DEFAULT '[]',
  imported_by TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  UNIQUE (tenant_id, file_sha256)
);
CREATE TABLE openclaw_transfers (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  retired_in_openclaw INTEGER NOT NULL DEFAULT 0 CHECK (retired_in_openclaw IN (0,1)),
  confirmed_by TEXT, confirmed_at TEXT,
  PRIMARY KEY (tenant_id, company_id),
  CHECK (retired_in_openclaw = 0 OR confirmed_by IS NOT NULL)
);

-- Isolamento por tenant nas referências novas.
CREATE TRIGGER company_units_tenant BEFORE INSERT ON company_units
WHEN NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = NEW.company_id AND c.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'tenant_reference_mismatch'); END;
CREATE TRIGGER buyer_profiles_tenant BEFORE INSERT ON buyer_profiles
WHEN NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = NEW.company_id AND c.tenant_id = NEW.tenant_id)
  OR NOT EXISTS (SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'tenant_reference_mismatch'); END;
CREATE TRIGGER fichas_tenant BEFORE INSERT ON fichas
WHEN NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = NEW.company_id AND c.tenant_id = NEW.tenant_id)
  OR NOT EXISTS (SELECT 1 FROM campaigns k WHERE k.id = NEW.campaign_id AND k.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'tenant_reference_mismatch'); END;
CREATE TRIGGER searches_tenant BEFORE INSERT ON searches
WHEN NOT EXISTS (SELECT 1 FROM campaigns k WHERE k.id = NEW.campaign_id AND k.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'tenant_reference_mismatch'); END;

-- Versão de ficha é imutável: só a marca de substituição pode mudar.
CREATE TRIGGER ficha_versions_immutable BEFORE UPDATE ON ficha_versions
WHEN NEW.snapshot_enc IS NOT OLD.snapshot_enc OR NEW.snapshot_sha256 IS NOT OLD.snapshot_sha256
  OR NEW.pv_report_json IS NOT OLD.pv_report_json OR NEW.review_ok IS NOT OLD.review_ok
  OR NEW.skill_sha256 IS NOT OLD.skill_sha256 OR NEW.version_no IS NOT OLD.version_no
BEGIN SELECT RAISE(ABORT, 'ficha_version_immutable'); END;
CREATE TRIGGER ficha_messages_immutable BEFORE UPDATE ON ficha_messages
BEGIN SELECT RAISE(ABORT, 'ficha_message_immutable'); END;
CREATE TRIGGER ficha_messages_no_delete BEFORE DELETE ON ficha_messages
BEGIN SELECT RAISE(ABORT, 'ficha_message_immutable'); END;

-- Indeterminado nunca volta sozinho para envio: só resolução humana registrada.
CREATE TRIGGER outbox_indeterminate_guard BEFORE UPDATE OF status ON send_outbox
WHEN OLD.status = 'indeterminate' AND NEW.status NOT IN ('indeterminate','accepted','cancelled','pending')
BEGIN SELECT RAISE(ABORT, 'outbox_indeterminate_requires_resolution'); END;
CREATE TRIGGER outbox_indeterminate_resolution BEFORE UPDATE OF status ON send_outbox
WHEN OLD.status = 'indeterminate' AND NEW.status IN ('accepted','cancelled','pending') AND (NEW.resolved_by IS NULL OR NEW.resolved_reason IS NULL)
BEGIN SELECT RAISE(ABORT, 'outbox_indeterminate_requires_resolution'); END;
-- Mensagem aceita não volta a outro estado.
CREATE TRIGGER outbox_accepted_final BEFORE UPDATE OF status ON send_outbox
WHEN OLD.status = 'accepted' AND NEW.status <> 'accepted'
BEGIN SELECT RAISE(ABORT, 'outbox_accepted_final'); END;
