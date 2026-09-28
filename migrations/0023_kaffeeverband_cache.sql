-- Radar Internacional: diretório setorial (Deutscher Kaffeeverband — Kaffeekontakte), validação por empresa em duas
-- etapas e cache de pesquisa para não consultar de novo a mesma empresa antes do prazo da fonte.

-- discovery_candidates ganha a fonte setorial e o resultado da validação (reconstrução: o CHECK de source muda).
CREATE TABLE discovery_candidates_new (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES foreign_searches(id),
  run_id TEXT NOT NULL REFERENCES foreign_search_sources(id),
  source TEXT NOT NULL CHECK (source IN ('osm','fr_registry','no_registry','de_coffee_assoc')),
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
  -- Validação por empresa (segunda etapa): trecho da própria empresa, papel apurado e quando.
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
  UNIQUE (search_id, source, external_id)
);
INSERT INTO discovery_candidates_new(id,search_id,run_id,source,external_id,role,name,legal_name_hint,city,website,activity_code,activity_label,size_band,size_source,registry_id,registry_type,record_url,eori,eori_status,eori_checked_at,status,company_id,decided_by,decided_at,dismiss_reason,created_at)
  SELECT id,search_id,run_id,source,external_id,role,name,legal_name_hint,city,website,activity_code,activity_label,size_band,size_source,registry_id,registry_type,record_url,eori,eori_status,eori_checked_at,status,company_id,decided_by,decided_at,dismiss_reason,created_at FROM discovery_candidates;
DROP TABLE discovery_candidates;
ALTER TABLE discovery_candidates_new RENAME TO discovery_candidates;
CREATE INDEX idx_discovery_candidates_search ON discovery_candidates(search_id, status, role);

-- Cache por fonte e empresa, reaproveitado entre buscas: resultado, URL, data, motivo de descarte e prazo de atualização.
CREATE TABLE research_cache (
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  refresh_after TEXT NOT NULL,
  result_json TEXT NOT NULL,
  discard_reason TEXT,
  PRIMARY KEY (source, external_id)
);

-- Duração de cada consulta automática (custo e tempo por candidata válida).
ALTER TABLE foreign_search_sources ADD COLUMN duration_ms INTEGER;
