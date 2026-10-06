-- SUPRESSAO-TELEFONE (2026-10-06): a ligação manual guarda o telefone que será usado, para respeitar a supressão
-- do número (R21.2, R28.18). phone_hash usa a mesma normalização e HMAC da supressão (formatos equivalentes batem);
-- phone_enc guarda o número normalizado cifrado, para exibição. Nenhum dos dois vai para o audit_log.
ALTER TABLE tasks ADD COLUMN phone_hash TEXT;
ALTER TABLE tasks ADD COLUMN phone_enc TEXT;
CREATE INDEX idx_tasks_phone ON tasks(tenant_id, phone_hash) WHERE phone_hash IS NOT NULL;

-- O histórico de edição passa a aceitar o campo 'phone'. SQLite não altera CHECK: a tabela é recriada com as mesmas
-- linhas, o índice e o gatilho que impede alteração (0033).
CREATE TABLE task_revisions_0034 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  revision INTEGER NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('script','channel_note','next_action','due_date','phone')),
  old_value_enc TEXT,
  new_value_enc TEXT,
  reason TEXT NOT NULL CHECK (length(reason) >= 10),
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  request_id TEXT NOT NULL
);
INSERT INTO task_revisions_0034(id,tenant_id,task_id,revision,field,old_value_enc,new_value_enc,reason,changed_by,changed_at,request_id)
  SELECT id,tenant_id,task_id,revision,field,old_value_enc,new_value_enc,reason,changed_by,changed_at,request_id FROM task_revisions;
DROP TRIGGER task_revisions_no_update;
DROP INDEX idx_task_revisions_task;
DROP TABLE task_revisions;
ALTER TABLE task_revisions_0034 RENAME TO task_revisions;
CREATE INDEX idx_task_revisions_task ON task_revisions(tenant_id, task_id, changed_at);
CREATE TRIGGER task_revisions_no_update BEFORE UPDATE ON task_revisions
BEGIN
  SELECT RAISE(ABORT, 'task_revisions: histórico não pode ser alterado');
END;
