-- SUPRESSAO-RETENCAO (2026-10-01): Spec R21.1 (alcance e critério de retenção por registro) e R9.2 (remover supressão:
-- só Administrador, com motivo e base). A política de retenção (prazo e fundamento) é decidida na validação jurídica T11,
-- ainda não feita: o critério gravado aqui é explícito e NÃO expira nada automaticamente (retention_until continua nulo).

-- Alcance: a supressão vale para o identificador no canal inteiro (todas as empresas, campanhas e commodities).
ALTER TABLE suppression_entries ADD COLUMN scope TEXT NOT NULL DEFAULT 'channel_all' CHECK (scope IN ('channel_all'));
-- Critério de retenção por registro. 'until_t11_policy' = mantido para não recontatar (R9.1.2) até a política de T11.
ALTER TABLE suppression_entries ADD COLUMN retention_criterion TEXT NOT NULL DEFAULT 'until_t11_policy' CHECK (retention_criterion IN ('until_t11_policy'));

-- Remoção administrativa: o registro sai da lista ativa e fica aqui, com quem removeu, quando, motivo e base informada.
-- Não é exclusão silenciosa. A remoção não reativa envios já cancelados.
CREATE TABLE suppression_removals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  entry_id TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,           -- mesmo pseudônimo HMAC da entrada removida (retenção também sujeita a T11)
  channel TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  scope TEXT NOT NULL,
  retention_criterion TEXT NOT NULL,
  entry_created_by TEXT NOT NULL,
  entry_created_at TEXT NOT NULL,
  removed_by TEXT NOT NULL,
  removed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  removal_reason TEXT NOT NULL CHECK (length(removal_reason) >= 10),
  removal_basis TEXT NOT NULL CHECK (length(removal_basis) >= 5),
  request_id TEXT NOT NULL
);
CREATE INDEX idx_suppression_removals_tenant ON suppression_removals(tenant_id, removed_at);
