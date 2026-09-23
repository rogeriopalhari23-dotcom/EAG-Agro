-- P1-T7: edição administrativa do catálogo com revisão otimista e responsável (R10.1, R10.3, R10.5).
-- Números de migração seguem a ordem real de execução; os números dos planos eram ilustrativos.
ALTER TABLE products ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1);
ALTER TABLE products ADD COLUMN updated_by TEXT NOT NULL DEFAULT 'system-admin';
ALTER TABLE products ADD COLUMN updated_at TEXT;
ALTER TABLE product_codes ADD COLUMN source_ref TEXT;
ALTER TABLE product_codes ADD COLUMN updated_by TEXT NOT NULL DEFAULT 'system-admin';
ALTER TABLE product_codes ADD COLUMN updated_at TEXT;
ALTER TABLE product_characteristics ADD COLUMN updated_by TEXT NOT NULL DEFAULT 'system-admin';
ALTER TABLE product_characteristics ADD COLUMN updated_at TEXT;
CREATE UNIQUE INDEX idx_product_characteristics_key ON product_characteristics(product_id, char_key, sample_only);

-- Código confirmado sem fonte ou sem versão da classificação não é aceito (nunca inventar NCM/HS).
CREATE TRIGGER product_codes_confirmed_insert BEFORE INSERT ON product_codes
WHEN NEW.status = 'confirmed' AND (NEW.source_ref IS NULL OR trim(NEW.source_ref) = '' OR NEW.classification_version IS NULL OR trim(NEW.classification_version) = '')
BEGIN SELECT RAISE(ABORT, 'product_code_source_required'); END;
CREATE TRIGGER product_codes_confirmed_update BEFORE UPDATE ON product_codes
WHEN NEW.status = 'confirmed' AND (NEW.source_ref IS NULL OR trim(NEW.source_ref) = '' OR NEW.classification_version IS NULL OR trim(NEW.classification_version) = '')
BEGIN SELECT RAISE(ABORT, 'product_code_source_required'); END;

-- Identidade confirmada exige referência de origem.
CREATE TRIGGER products_identity_insert BEFORE INSERT ON products
WHEN NEW.identity_status = 'confirmed' AND (NEW.source_ref IS NULL OR trim(NEW.source_ref) = '')
BEGIN SELECT RAISE(ABORT, 'product_source_required'); END;
CREATE TRIGGER products_identity_update BEFORE UPDATE ON products
WHEN NEW.identity_status = 'confirmed' AND (NEW.source_ref IS NULL OR trim(NEW.source_ref) = '')
BEGIN SELECT RAISE(ABORT, 'product_source_required'); END;
