-- T11-BLOQUEIO (2026-10-06): registro das validações T11 por escopo. Contato real (ligação, LinkedIn manual) só fica
-- pronto com validação vigente para o escopo exato da tarefa: país da empresa + canal. Não existe escopo "T11 inteira":
-- liberar telefone manual no Brasil não libera Alemanha, e-mail automático nem campanhas. A aprovação do uso pessoal do
-- Compass (06/10/2026) não é validação T11 e não entra aqui.
-- Só inclusão: cada decisão (validação ou revogação) é uma linha nova, com responsável, data e fundamento; vale a mais
-- recente por escopo cuja data já chegou. Não há rota nem botão para gravar: o registro fica vazio até o processo de
-- validação aprovado na Spec ser cumprido. Sem registro, as tarefas ficam bloqueadas ("T11 pendente"), sem mudar estado.
CREATE TABLE compliance_validations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  gate TEXT NOT NULL CHECK (gate IN ('t11')),
  scope TEXT NOT NULL CHECK (scope IN ('br_manual_phone','br_manual_linkedin','de_manual_phone','de_manual_linkedin','br_email_automatic','de_email_automatic','campaigns')),
  decision TEXT NOT NULL CHECK (decision IN ('validated','revoked')),
  responsible TEXT NOT NULL CHECK (length(trim(responsible)) >= 3),   -- quem validou (nome e papel)
  decided_on TEXT NOT NULL CHECK (decided_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  basis TEXT NOT NULL CHECK (length(trim(basis)) >= 10),              -- documento ou registro da decisão
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  request_id TEXT NOT NULL
);
CREATE INDEX idx_compliance_validations_scope ON compliance_validations(tenant_id, gate, scope, decided_on);
CREATE TRIGGER compliance_validations_no_update BEFORE UPDATE ON compliance_validations
BEGIN
  SELECT RAISE(ABORT, 'compliance_validations: registro não pode ser alterado; grave uma revogação');
END;
CREATE TRIGGER compliance_validations_no_delete BEFORE DELETE ON compliance_validations
BEGIN
  SELECT RAISE(ABORT, 'compliance_validations: registro não pode ser apagado');
END;
