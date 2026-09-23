-- P2-T4: partição da busca é um grupo de municípios da mesma UF (o filtro `municipio` da Casa dos Dados aceita lista)
-- ou a UF inteira quando todo o estado está dentro do raio. Custo: uma chamada paga cobre vários municípios.
-- A tabela da 0007 não tem dados em nenhum ambiente nesta data; é recriada.
DROP INDEX IF EXISTS idx_partitions_ready;
DROP TABLE search_partitions;
CREATE TABLE search_partitions (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES searches(id),
  scope TEXT NOT NULL CHECK (scope IN ('municipalities','uf')),
  uf TEXT NOT NULL CHECK (length(uf) = 2),
  municipality_key TEXT NOT NULL DEFAULT '',   -- códigos IBGE do grupo, em ordem, separados por vírgula; '' quando scope='uf'
  municipality_names_json TEXT,                -- nomes oficiais do grupo, na mesma ordem
  page INTEGER NOT NULL CHECK (page >= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','done','failed')),
  lease_owner TEXT, lease_until TEXT, lease_token INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  result_total INTEGER,
  error_kind TEXT, error TEXT,
  done_at TEXT,
  UNIQUE (search_id, scope, uf, municipality_key, page),
  CHECK ((scope = 'uf' AND municipality_key = '' AND municipality_names_json IS NULL)
      OR (scope = 'municipalities' AND municipality_key <> '' AND municipality_names_json IS NOT NULL))
);
CREATE INDEX idx_partitions_ready ON search_partitions(search_id, status, next_attempt_at);
