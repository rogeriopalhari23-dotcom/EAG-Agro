-- Política de sanções T11 decidida por Rogério Palhari em 2026-09-24 (conversa no Claude Code):
-- listas exigidas OFAC SDN + CGU CEIS + CGU CNEP (as três fontes ativas da 0.3.1); validade de 30 dias para lista
-- importada e para a triagem; só empresas (pessoas físicas fora); mesma raiz de CNPJ → revisão humana.
-- As três escolhas que não são parâmetro ficam no código (scripts/import-sanctions.mjs e src/sanctions.js).
INSERT INTO parameters(id,tenant_id,parameter_key,scope_key,value_json,effective_from,changed_by,change_reason) VALUES
 ('t11-max-age','eag-internal','sanctions_max_age_hours','global','720','2026-09-24T00:00:00Z','system-admin','Política T11 aprovada por Rogério Palhari em 2026-09-24: listas e triagem valem 30 dias');
UPDATE sanction_sources SET active=1 WHERE id IN ('source-ofac-sdn','source-cgu-ceis','source-cgu-cnep');
