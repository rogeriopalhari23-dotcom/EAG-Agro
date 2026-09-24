-- Parâmetros do internacional aprovados por Rogério Palhari em 2026-09-24 (conversa no Claude Code, resposta "aprovado"
-- às opções D1 e D2, valores da rotina mensal e tradução em inglês). Registro em docs/implementation/EVIDENCIAS.md.
-- Qualquer mudança posterior entra como nova vigência pela tela Parâmetros; esta migração não é editada.
INSERT INTO parameters(id,tenant_id,parameter_key,scope_key,value_json,effective_from,changed_by,change_reason) VALUES
 ('p3-param-d1','eag-internal','period_default_months','international','12','2026-09-24T00:00:00Z','system-admin','D1 aprovado por Rogério Palhari em 2026-09-24'),
 ('p3-param-d2','eag-internal','agri_classification','international','{"version":"sh-01-24@2026-09-23","chapters":["01","02","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24"],"excluded":["03"]}','2026-09-24T00:00:00Z','system-admin','D2 aprovado por Rogério Palhari em 2026-09-24'),
 ('p3-param-mdic','eag-internal','trade_list_mdic_years','international','2','2026-09-24T00:00:00Z','system-admin','Rotina mensal aprovada por Rogério Palhari em 2026-09-24'),
 ('p3-param-ct','eag-internal','trade_list_comtrade_years','international','3','2026-09-24T00:00:00Z','system-admin','Rotina mensal aprovada por Rogério Palhari em 2026-09-24'),
 ('p3-param-calls','eag-internal','comtrade_calls_per_day','international','400','2026-09-24T00:00:00Z','system-admin','Rotina mensal aprovada por Rogério Palhari em 2026-09-24'),
 ('p3-param-ret','eag-internal','trade_list_retention_versions','international','3','2026-09-24T00:00:00Z','system-admin','Rotina mensal aprovada por Rogério Palhari em 2026-09-24'),
 ('p3-param-day','eag-internal','country_list_refresh_day','international','10','2026-09-24T00:00:00Z','system-admin','Rotina mensal aprovada por Rogério Palhari em 2026-09-24'),
 ('p3-param-en','eag-internal','templates_en_approved','pv-en-1.0.0','{"enabled":true,"evidenceRef":"docs/implementation/AMOSTRAS-TEXTOS-EN.md#aprovacao"}','2026-09-24T00:00:00Z','system-admin','Tradução pv-en-1.0.0 aprovada por Rogério Palhari em 2026-09-24');
