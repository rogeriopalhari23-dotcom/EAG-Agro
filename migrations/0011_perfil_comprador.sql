-- P2-T6: complementos do perfil comprador exigidos por R14.6–R14.8.
ALTER TABLE buyer_profiles ADD COLUMN is_giant INTEGER NOT NULL DEFAULT 0 CHECK (is_giant IN (0,1));
ALTER TABLE buyer_profiles ADD COLUMN relationship_by TEXT;
ALTER TABLE buyer_profiles ADD COLUMN relationship_at TEXT;
-- R14.8: porte desconhecido só vai para ficha com a qualificação do porte registrada como objetivo da ligação.
ALTER TABLE buyer_profiles ADD COLUMN size_call_goal INTEGER NOT NULL DEFAULT 0 CHECK (size_call_goal IN (0,1));
ALTER TABLE buyer_profiles ADD COLUMN size_call_goal_by TEXT;
CREATE INDEX idx_buyer_profiles_company ON buyer_profiles(tenant_id, company_id, product_id);
