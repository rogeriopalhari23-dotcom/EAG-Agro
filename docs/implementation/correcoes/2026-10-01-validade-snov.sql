-- Validade de 30 dias para resultado "valid" da Snov (decisão de Rogério em 2026-10-01). Os dois resultados de hoje foram
-- gravados antes do parâmetro existir e ficaram sem vencimento; aqui recebem vencimento = data da validação + 30 dias.
-- Só altera contatos "valid" pela Snov, sem vencimento; cada alteração fica na auditoria.
INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,field_name,old_value_json,new_value_json,reason,request_id)
SELECT lower(hex(randomblob(16))),tenant_id,'system-correction','system','contact.email_validation_expiry_set','contact',id,'email_validation_expires_at','null',
  json_quote(strftime('%Y-%m-%dT%H:%M:%fZ', email_validated_at, '+30 days')),
  'Validade de 30 dias aprovada por Rogério em 2026-10-01 aplicada ao resultado valid gravado antes do parâmetro','validade-snov-2026-10-01'
FROM contacts WHERE id IN ('a93c0538-a1ca-42c4-9ea1-395338d33d25','f19ed55f-42dd-4a1a-9aed-ade19257b38c')
  AND email_validation='valid' AND email_validation_provider='snov:v2' AND email_validation_expires_at IS NULL AND email_validated_at IS NOT NULL;
UPDATE contacts SET email_validation_expires_at=strftime('%Y-%m-%dT%H:%M:%fZ', email_validated_at, '+30 days')
WHERE id IN ('a93c0538-a1ca-42c4-9ea1-395338d33d25','f19ed55f-42dd-4a1a-9aed-ade19257b38c')
  AND email_validation='valid' AND email_validation_provider='snov:v2' AND email_validation_expires_at IS NULL AND email_validated_at IS NOT NULL;
