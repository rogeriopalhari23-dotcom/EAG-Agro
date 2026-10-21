-- Fonte oficial do Chile para a descoberta de empresas (2026-10-21): LENAA do SAG (Lista de Establecimientos Nacionales
-- Fabricantes de Alimentos para Animales), planilha pública e gratuita com razão social, RUT, região, código de
-- registro e atividade autorizada. discovery_candidates é reconstruída só para aceitar a fonte 'cl_sag_lenaa' no CHECK
-- (mesmas colunas e índice de 0023 + 0027). NÃO aplicada em produção.
PRAGMA defer_foreign_keys = true;
CREATE TABLE discovery_candidates_new (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES foreign_searches(id),
  run_id TEXT NOT NULL REFERENCES foreign_search_sources(id),
  source TEXT NOT NULL CHECK (source IN ('osm','fr_registry','no_registry','de_coffee_assoc','cl_sag_lenaa')),
  external_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('processor','trader')),
  name TEXT NOT NULL,
  legal_name_hint TEXT,
  city TEXT,
  website TEXT,
  activity_code TEXT,
  activity_label TEXT,
  size_band TEXT CHECK (size_band IS NULL OR size_band IN ('micro','small','medium','medium_plus')),
  size_source TEXT,
  registry_id TEXT,
  registry_type TEXT,
  record_url TEXT NOT NULL,
  eori TEXT,
  eori_status TEXT NOT NULL DEFAULT 'not_checked' CHECK (eori_status IN ('valid','not_valid','not_checked')),
  eori_checked_at TEXT,
  import_statement TEXT,
  mentions_brazil INTEGER NOT NULL DEFAULT 0,
  validated_at TEXT,
  validation_note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','dismissed')),
  company_id TEXT REFERENCES companies(id),
  decided_by TEXT,
  decided_at TEXT,
  dismiss_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  activity_type TEXT CHECK (activity_type IS NULL OR activity_type IN ('buys_processes','mixed','toll_processing','trade','logistics_service','equipment_service','consulting','unknown')),
  activity_evidence TEXT,
  activity_source_url TEXT,
  activity_checked_at TEXT,
  group_link TEXT CHECK (group_link IS NULL OR group_link IN ('indication','confirmed')),
  group_note TEXT,
  group_source_url TEXT,
  investigated_by TEXT,
  UNIQUE (search_id, source, external_id)
);
INSERT INTO discovery_candidates_new SELECT id,search_id,run_id,source,external_id,role,name,legal_name_hint,city,website,activity_code,activity_label,size_band,size_source,registry_id,registry_type,record_url,eori,eori_status,eori_checked_at,import_statement,mentions_brazil,validated_at,validation_note,status,company_id,decided_by,decided_at,dismiss_reason,created_at,activity_type,activity_evidence,activity_source_url,activity_checked_at,group_link,group_note,group_source_url,investigated_by FROM discovery_candidates;
DROP TABLE discovery_candidates;
ALTER TABLE discovery_candidates_new RENAME TO discovery_candidates;
CREATE INDEX idx_discovery_candidates_search ON discovery_candidates(search_id, status, role);
