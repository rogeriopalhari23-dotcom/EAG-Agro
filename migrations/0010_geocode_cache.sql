-- P2-T5: cache de geocodificação por endereço normalizado + fonte. Evita pagar duas vezes pelo mesmo endereço.
-- `expires_at` segue o direito de armazenamento do plano (LocationIQ: gratuito 48 h; pago sem prazo).
CREATE TABLE geocode_cache (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  address_key TEXT NOT NULL,            -- SHA-256 de fonte|endereço normalizado
  source TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('found','not_found')),
  lat REAL, lon REAL,
  precision TEXT CHECK (precision IN ('address','municipality_centroid')),
  result_class TEXT, result_type TEXT,
  fetched_at TEXT NOT NULL,
  expires_at TEXT,
  PRIMARY KEY (tenant_id, address_key),
  CHECK ((outcome = 'found') = (lat IS NOT NULL AND lon IS NOT NULL AND precision IS NOT NULL))
);
