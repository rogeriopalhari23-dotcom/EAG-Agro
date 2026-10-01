-- EXCLUSAO-PURGA (2026-10-01): Spec R9.1, R9.1.2 e R23.5 — o pedido de exclusão alcança também o conteúdo congelado
-- das fichas, as mensagens recebidas da pessoa e os registros ligados a elas, sem apagar evidências de outros contatos.
-- Retenção final depende de T11 (não definida aqui). Só acrescenta colunas, uma tabela e troca um trigger: reversão
-- em docs/implementation/EXCLUSAO-PURGA-PLANO.md.
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

-- Mensagem recebida da pessoa: o arquivo no R2 é apagado; a linha fica (classificação, correlação, datas) sem conteúdo
-- e sem os identificadores de mensagem do servidor dela.
ALTER TABLE inbound_messages ADD COLUMN content_purged_at TEXT;
-- Chave da mensagem (HMAC do Message-ID, sem PII em claro): a mesma resposta relida com outro UID é reconhecida mesmo
-- depois da purga, que apaga o Message-ID. Linhas anteriores a esta migração ficam sem chave (o código também confere
-- o message_id em claro enquanto ele existir).
ALTER TABLE inbound_messages ADD COLUMN message_key TEXT;
CREATE INDEX idx_inbound_message_key ON inbound_messages(tenant_id, message_key);

-- Tarefa aberta por uma mensagem recebida (resposta, ambígua, outra commodity) passa a apontar para a mensagem: é o
-- vínculo que permite purgar a nota de Rogério sobre a resposta da pessoa sem tocar nas tarefas de outros remetentes.
-- Tarefas anteriores a esta migração: vínculo só com evidência inequívoca (correcoes/0032-vinculo-tarefas-resposta.sql);
-- as demais ficam em GET /api/tasks/reply-review para decisão manual.
ALTER TABLE tasks ADD COLUMN inbound_id TEXT REFERENCES inbound_messages(id);

-- Registro das exclusões executadas, sem PII (só o id do contato e o hash do e-mail). Uma cópia de cada linha vai para
-- o R2 (erasures/<tenant>/<contato>.json): se o D1 for restaurado para antes da exclusão, a diferença entre o R2 e esta
-- tabela bloqueia envio e aprovação até a reaplicação (POST /api/erasures/reapply).
CREATE TABLE erasure_ledger (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  contact_id TEXT NOT NULL,
  email_hash TEXT,
  erased_at TEXT NOT NULL,
  request_id TEXT,
  reapplied_at TEXT,
  PRIMARY KEY (tenant_id, contact_id)
);
