-- Ficha para identificar o responsável pela compra (2026-09-30, pedido de Rogério; PV3 "descobrir a pessoa certa").
-- O destinatário pode ser o canal geral publicado da empresa (não é pessoa); a finalidade vale por versão da ficha, então
-- a mesma ficha passa de "identificar o responsável" para "conversa com o comprador" numa nova versão (R18.4).
ALTER TABLE contacts ADD COLUMN contact_kind TEXT NOT NULL DEFAULT 'person' CHECK (contact_kind IN ('person','company_channel'));
ALTER TABLE ficha_versions ADD COLUMN purpose TEXT NOT NULL DEFAULT 'meeting' CHECK (purpose IN ('meeting','identify_buyer'));
ALTER TABLE ficha_versions ADD COLUMN language TEXT;

-- Indício de responsabilidade de compra de uma pessoa (texto e fonte), sem confirmar poder de compra: confirmação só por
-- contact_verifications decision_authority com evidência.
ALTER TABLE person_candidates ADD COLUMN purchase_note TEXT;
ALTER TABLE person_candidates ADD COLUMN purchase_source_url TEXT;
