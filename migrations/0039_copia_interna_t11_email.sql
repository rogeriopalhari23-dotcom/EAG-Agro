-- D5-a e validação T11 do e-mail automático no Brasil (decisões de Rogério Palhari em 09/10/2026).
--
-- 1. Cópia interna (D5-a): o contrato de franquia pede cópia das comunicações com clientes ao e-mail de vendas da EAG.
--    A cópia é uma mensagem SEPARADA, enviada pela ponte só depois do aceite SMTP do passo do prospect, sem o link nem o
--    cabeçalho de descadastro do prospect (um clique na caixa de vendas não pode suprimir o prospect). O destinatário é
--    fixo (parâmetro email_copy_to, só Administrador) e a ponte confere contra uma lista local. Uma linha por passo
--    aceito; Message-ID determinístico (recuperação sem duplicar). Falha na cópia nunca reenvia o e-mail do prospect.
CREATE TABLE send_copies (
  outbox_id TEXT PRIMARY KEY REFERENCES send_outbox(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  to_address TEXT NOT NULL,
  copy_message_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','accepted','temp_failed','permanent_failed','indeterminate')),
  lease_token INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  evidence TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  accepted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_send_copies_ready ON send_copies(tenant_id, status, next_attempt_at);

-- 2. Evidências obrigatórias de cada registro da validação T11 (compliance_validations, migração 0035). Só inclusão.
--    Cada evidência: tipo, referência (documento ou registro) e SHA-256 do conteúdo conferido.
CREATE TABLE compliance_validation_evidence (
  id TEXT PRIMARY KEY,
  validation_id TEXT NOT NULL REFERENCES compliance_validations(id),
  kind TEXT NOT NULL CHECK (kind IN ('decisions','legal_basis','transfer_mechanism','incident_register','erasure_test','channel_test','other')),
  reference TEXT NOT NULL CHECK (length(trim(reference)) >= 5),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  note TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_compliance_evidence_validation ON compliance_validation_evidence(validation_id);
CREATE TRIGGER compliance_validation_evidence_no_update BEFORE UPDATE ON compliance_validation_evidence
BEGIN
  SELECT RAISE(ABORT, 'compliance_validation_evidence: registro não pode ser alterado');
END;
CREATE TRIGGER compliance_validation_evidence_no_delete BEFORE DELETE ON compliance_validation_evidence
BEGIN
  SELECT RAISE(ABORT, 'compliance_validation_evidence: registro não pode ser apagado');
END;
