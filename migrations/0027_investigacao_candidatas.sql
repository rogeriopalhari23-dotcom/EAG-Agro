-- Investigação das candidatas da descoberta (2026-09-30), antes de qualquer aceite: tipo de atividade e vínculo com grupo,
-- cada um com evidência e fonte. Não é aceite, não descarta e não autoriza contato; serve à revisão de Rogério.
-- Tipo de atividade separa quem compra a commodity (processa para si) de quem só presta serviço sobre produto de terceiros.
ALTER TABLE discovery_candidates ADD COLUMN activity_type TEXT CHECK (activity_type IS NULL OR activity_type IN (
  'buys_processes',     -- compra a commodity e processa/torra para si
  'mixed',              -- compra e também presta serviço ou revende
  'toll_processing',    -- beneficia produto de terceiros (Lohnveredelung), sem evidência de compra própria
  'trade',              -- importa/revende
  'logistics_service',  -- transporte, armazenagem, manuseio
  'equipment_service',  -- máquinas, manutenção
  'consulting',         -- consultoria
  'unknown'));
ALTER TABLE discovery_candidates ADD COLUMN activity_evidence TEXT;
ALTER TABLE discovery_candidates ADD COLUMN activity_source_url TEXT;
ALTER TABLE discovery_candidates ADD COLUMN activity_checked_at TEXT;
-- Vínculo com grupo: indício (ex.: e-mail ou site de outro grupo) ≠ confirmado (declaração da própria empresa ou registro).
-- Representante legal em comum sozinho é, no máximo, indício.
ALTER TABLE discovery_candidates ADD COLUMN group_link TEXT CHECK (group_link IS NULL OR group_link IN ('indication','confirmed'));
ALTER TABLE discovery_candidates ADD COLUMN group_note TEXT;
ALTER TABLE discovery_candidates ADD COLUMN group_source_url TEXT;
ALTER TABLE discovery_candidates ADD COLUMN investigated_by TEXT;
