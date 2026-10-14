-- Saudação pelo horário do envio (2026-10-14, pedido de Rogério): o E-mail 1 que começa com "Boa tarde" ganha, na
-- geração da versão, uma variante idêntica com "Bom dia". As duas são revisadas, mostradas no painel e aprovadas juntas;
-- no envio, o horário local do destinatário escolhe uma delas (antes das 12:00 → "Bom dia"). Nada é regenerado no envio:
-- cada variante tem o próprio hash, conferido do congelamento à ponte. Só acrescenta colunas e troca o trigger de
-- imutabilidade por um equivalente que também protege o hash da variante.
ALTER TABLE ficha_messages ADD COLUMN body_am_enc TEXT;
ALTER TABLE ficha_messages ADD COLUMN body_html_am_enc TEXT;
ALTER TABLE ficha_messages ADD COLUMN message_am_sha256 TEXT;

-- Hash da variante congelado na aprovação (como message_sha256) e variante escolhida na reserva do passo.
ALTER TABLE send_outbox ADD COLUMN message_am_sha256 TEXT;
ALTER TABLE send_outbox ADD COLUMN greeting_variant TEXT CHECK (greeting_variant IS NULL OR greeting_variant = 'am');

DROP TRIGGER ficha_messages_immutable;
CREATE TRIGGER ficha_messages_immutable BEFORE UPDATE ON ficha_messages
WHEN OLD.purged_at IS NOT NULL OR NEW.purged_at IS NULL
  OR NEW.id IS NOT OLD.id OR NEW.version_id IS NOT OLD.version_id OR NEW.contact_id IS NOT OLD.contact_id
  OR NEW.channel IS NOT OLD.channel OR NEW.step_no IS NOT OLD.step_no OR NEW.kind IS NOT OLD.kind
  OR NEW.day_offset IS NOT OLD.day_offset OR NEW.message_sha256 IS NOT OLD.message_sha256
  OR NEW.message_am_sha256 IS NOT OLD.message_am_sha256
BEGIN SELECT RAISE(ABORT, 'ficha_message_immutable'); END;
