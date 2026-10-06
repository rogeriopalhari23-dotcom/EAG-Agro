-- TAREFAS-EDICAO (2026-10-06): edição simples de tarefa manual aberta (roteiro, canal e próxima ação), com histórico.
-- Não vale para tarefa gerada de ficha aprovada (texto congelado) nem muda estado, resultado ou aprovações.

-- Canal a usar (ex.: telefone geral da unidade, com fonte e data) e próxima ação em texto; revisão para conflito (R23.3).
ALTER TABLE tasks ADD COLUMN channel_note TEXT;
ALTER TABLE tasks ADD COLUMN next_action TEXT;
ALTER TABLE tasks ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1);

-- Histórico: valor anterior e novo cifrados (podem conter nome de pessoa; o audit_log não guarda conteúdo, R8.1.1),
-- autor, data e motivo. Sem UPDATE; DELETE só pela exclusão de dados pessoais (R23.5), junto com o roteiro da tarefa.
CREATE TABLE task_revisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  revision INTEGER NOT NULL,                -- revisão da tarefa criada por esta alteração
  field TEXT NOT NULL CHECK (field IN ('script','channel_note','next_action','due_date')),
  old_value_enc TEXT,
  new_value_enc TEXT,
  reason TEXT NOT NULL CHECK (length(reason) >= 10),
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  request_id TEXT NOT NULL
);
CREATE INDEX idx_task_revisions_task ON task_revisions(tenant_id, task_id, changed_at);
CREATE TRIGGER task_revisions_no_update BEFORE UPDATE ON task_revisions
BEGIN
  SELECT RAISE(ABORT, 'task_revisions: histórico não pode ser alterado');
END;
