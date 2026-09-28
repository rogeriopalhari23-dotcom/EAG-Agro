-- Radar Internacional: candidatos gerados por fontes gratuitas (OpenStreetMap, registros oficiais) antes de virarem
-- empresa. Ficam aqui até a pessoa aceitar ou descartar — nada entra no cadastro de empresas sozinho (P3, P13).
-- Candidato é "empresa encontrada": atividade no cadastro é indício de uso, nunca prova de compra (P1, R12.10).
CREATE TABLE discovery_candidates (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES foreign_searches(id),
  run_id TEXT NOT NULL REFERENCES foreign_search_sources(id),
  source TEXT NOT NULL CHECK (source IN ('osm','fr_registry','no_registry')),
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
  -- Sinal próprio de importação: registro EORI (aduana da UE) ativo. Indica comércio exterior da empresa, não a
  -- importação da commodity nem a origem Brasil. 'not_valid' = não achado com esse número (pode usar outro).
  eori TEXT,
  eori_status TEXT NOT NULL DEFAULT 'not_checked' CHECK (eori_status IN ('valid','not_valid','not_checked')),
  eori_checked_at TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','dismissed')),
  company_id TEXT REFERENCES companies(id),
  decided_by TEXT,
  decided_at TEXT,
  dismiss_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (search_id, source, external_id)
);
CREATE INDEX idx_discovery_candidates_search ON discovery_candidates(search_id, status, role);
