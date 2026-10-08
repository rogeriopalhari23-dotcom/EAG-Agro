-- D-EXC (aprovada por Rogério em 08/10/2026, opção a): telefone depois de exclusão ou oposição.
-- Telefone comprovadamente pessoal (ou ramal com discagem direta) é suprimido pelo fluxo existente. Número geral da
-- empresa, ramal atrás do número geral, classificação ausente ou conflitante NÃO é suprimido (bloquearia a empresa
-- inteira): fica um aviso na empresa, que orienta o operador e não garante que a pessoa nunca será reencontrada.
-- O aviso não guarda nome, hash do nome nem texto pessoal: só campos fechados. phone_hash é o HMAC do número geral
-- (dado da empresa), para mostrar o aviso nas ligações a ele. pending=1 quando a classificação não foi confirmada.
-- Só inclusão. Retenção: pendente da decisão A (T11-REVISAO §6); nenhum prazo é aplicado aqui.
CREATE TABLE company_notices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL CHECK (kind IN ('erasure_shared_phone','opposition_shared_phone')),
  classification TEXT NOT NULL CHECK (classification IN ('shared','extension','unconfirmed','conflict')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('company_site','directory','receita','call','not_informed')),
  source_url TEXT CHECK (source_url IS NULL OR source_url GLOB 'http*://*'),
  reason TEXT NOT NULL CHECK (reason IN ('classified_shared','classified_extension','not_classified','linked_to_others','unparseable','opposition_on_shared')),
  phone_hash TEXT,
  pending INTEGER NOT NULL DEFAULT 0 CHECK (pending IN (0,1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  request_id TEXT NOT NULL
);
CREATE INDEX idx_company_notices_company ON company_notices(tenant_id, company_id, created_at);
CREATE TRIGGER company_notices_no_update BEFORE UPDATE ON company_notices
BEGIN
  SELECT RAISE(ABORT, 'company_notices: aviso não pode ser alterado');
END;
CREATE TRIGGER company_notices_no_delete BEFORE DELETE ON company_notices
BEGIN
  SELECT RAISE(ABORT, 'company_notices: aviso não pode ser apagado');
END;
