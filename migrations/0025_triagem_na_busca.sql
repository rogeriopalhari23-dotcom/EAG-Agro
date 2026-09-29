-- Triagem da empresa dentro de uma busca (2026-09-29). A busca é de um produto num país, então a decisão vale para a
-- combinação empresa/produto desta busca — nunca para a empresa em geral. Descartar não apaga: guarda motivo, autor e data.
ALTER TABLE foreign_search_candidates ADD COLUMN priority TEXT NOT NULL DEFAULT 'primary' CHECK (priority IN ('primary','secondary'));
ALTER TABLE foreign_search_candidates ADD COLUMN priority_reason TEXT;
ALTER TABLE foreign_search_candidates ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed'));
ALTER TABLE foreign_search_candidates ADD COLUMN dismiss_reason TEXT;
ALTER TABLE foreign_search_candidates ADD COLUMN decided_by TEXT;
ALTER TABLE foreign_search_candidates ADD COLUMN decided_at TEXT;

-- Pontos a verificar numa candidata (ex.: vínculo com grupo, autonomia de compras, responsabilidade de compra de uma
-- pessoa). Aberto até alguém registrar a conclusão com fonte; o histórico fica.
CREATE TABLE search_candidate_checks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  search_id TEXT NOT NULL REFERENCES foreign_searches(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  topic TEXT NOT NULL,
  note TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','confirmed','cleared')),
  resolution TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_by TEXT,
  resolved_at TEXT,
  CHECK (status = 'open' OR resolution IS NOT NULL)
);
CREATE INDEX idx_search_candidate_checks ON search_candidate_checks(search_id, company_id, status);
