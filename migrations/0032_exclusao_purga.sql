-- EXCLUSAO-PURGA (2026-10-01): Spec R9.1 e R23.5 — o pedido de exclusão alcança também o conteúdo congelado das fichas
-- e o conteúdo das mensagens recebidas, não só os campos do contato. Retenção final depende de T11 (não definida aqui).
--
-- Textos de ficha continuam imutáveis, com UMA exceção: a purga por exclusão de dados pessoais. Ela troca assunto,
-- corpo e HTML por um marcador cifrado e grava purged_at uma única vez; a identidade da mensagem (versão, contato,
-- canal, passo, tipo, dia e message_sha256) não muda, para o histórico de aprovação e envio continuar coerente.
ALTER TABLE ficha_messages ADD COLUMN purged_at TEXT;

DROP TRIGGER ficha_messages_immutable;
CREATE TRIGGER ficha_messages_immutable BEFORE UPDATE ON ficha_messages
WHEN OLD.purged_at IS NOT NULL OR NEW.purged_at IS NULL
  OR NEW.id IS NOT OLD.id OR NEW.version_id IS NOT OLD.version_id OR NEW.contact_id IS NOT OLD.contact_id
  OR NEW.channel IS NOT OLD.channel OR NEW.step_no IS NOT OLD.step_no OR NEW.kind IS NOT OLD.kind
  OR NEW.day_offset IS NOT OLD.day_offset OR NEW.message_sha256 IS NOT OLD.message_sha256
BEGIN SELECT RAISE(ABORT, 'ficha_message_immutable'); END;

-- Mensagem recebida: o arquivo no R2 é apagado; a linha fica (classificação, correlação, datas) sem conteúdo.
ALTER TABLE inbound_messages ADD COLUMN content_purged_at TEXT;
