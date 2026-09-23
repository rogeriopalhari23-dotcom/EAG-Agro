INSERT INTO tenants (id, name) VALUES ('eag-internal', 'EAG — Operação Interna');

INSERT INTO users (id, tenant_id, email, display_name, role) VALUES
  ('system-admin', 'eag-internal', 'admin@local.eag', 'Administrador local', 'admin');

INSERT INTO parameters (id, tenant_id, parameter_key, scope_key, value_json, effective_from, changed_by, change_reason) VALUES
  ('param-confidence', 'eag-internal', 'confidence_min', 'global', '50', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
  ('param-potential', 'eag-internal', 'potential_min', 'global', '40', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
  ('param-completeness', 'eag-internal', 'completeness_min', 'global', '60', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
  ('param-risk-coverage', 'eag-internal', 'risk_coverage_min', 'global', '50', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
  ('param-risk-high', 'eag-internal', 'risk_high', 'global', '70', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
  ('param-sugar-volume', 'eag-internal', 'volume_min', 'sugar', '500', '2026-09-21T00:00:00Z', 'system-admin', '500 MT por operação'),
  ('param-coffee-foodera-volume', 'eag-internal', 'volume_min', 'coffee:FoodEra', '5', '2026-09-21T00:00:00Z', 'system-admin', 'Piloto FoodEra');

INSERT INTO sanction_sources (id, source_key, name, official_url, jurisdiction, blocking_policy) VALUES
  ('source-ofac-sdn', 'ofac_sdn', 'OFAC SDN', 'https://ofac.treasury.gov/sanctions-list-service', 'US', 'legal_block'),
  ('source-cgu-ceis', 'cgu_ceis', 'CGU CEIS', 'https://portaldatransparencia.gov.br/sancoes/consulta', 'BR', 'integrity_alert'),
  ('source-cgu-cnep', 'cgu_cnep', 'CGU CNEP', 'https://portaldatransparencia.gov.br/sancoes/consulta', 'BR', 'integrity_alert');
