-- Reversão da migração 0032 (EXCLUSAO-PURGA). Usar SÓ junto com a volta do Worker à versão anterior e só se a 0032
-- tiver causado problema. Plano completo: docs/implementation/EXCLUSAO-PURGA-PLANO.md §6.
--
-- O que volta: a imutabilidade total dos textos de ficha (trigger original da 0007).
-- O que fica, de propósito:
--   * colunas ficha_messages.purged_at, inbound_messages.content_purged_at e tasks.inbound_id — inertes para o código
--     anterior (ele não as lê nem escreve); tasks.inbound_id tem chave estrangeira e o SQLite não remove coluna com FK;
--   * tabela erasure_ledger — é a prova das exclusões feitas; apagá-la permitiria que uma exclusão "sumisse".
--   * linha 0032 em d1_migrations — o esquema continua com os acréscimos.
-- Purgas já executadas NÃO são desfeitas (não há como, nem se deve): o conteúdo apagado não volta.
DROP TRIGGER ficha_messages_immutable;
CREATE TRIGGER ficha_messages_immutable BEFORE UPDATE ON ficha_messages
BEGIN SELECT RAISE(ABORT, 'ficha_message_immutable'); END;
