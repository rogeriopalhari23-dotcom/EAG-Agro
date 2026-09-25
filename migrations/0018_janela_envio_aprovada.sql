-- Regra de horário aprovada por Rogério Palhari em 2026-09-25 (conversa no Claude Code):
-- "09:00–17:00 no fuso horário confirmado do destinatário, nacional ou internacional. Sem fuso confirmado, mantenha o
-- envio em espera." Dias: segunda a sexta ("horário comercial", Spec §parâmetros `param_send_window`) — registrado como
-- tal e sinalizado a Rogério para confirmação. O fuso vem do contato (src/sending.js); não há fuso de mercado no envio.
INSERT INTO parameters(id,tenant_id,parameter_key,scope_key,value_json,effective_from,changed_by,change_reason) VALUES
 ('p-janela-nacional','eag-internal','send_window','national','{"start":"09:00","end":"17:00","weekdays":[1,2,3,4,5]}','2026-09-25T00:00:00Z','user-rogerio-palhari','Regra de horário aprovada por Rogério Palhari em 2026-09-25: 09:00–17:00 no fuso confirmado do destinatário; sem fuso, envio em espera'),
 ('p-janela-internacional','eag-internal','send_window','international','{"start":"09:00","end":"17:00","weekdays":[1,2,3,4,5]}','2026-09-25T00:00:00Z','user-rogerio-palhari','Regra de horário aprovada por Rogério Palhari em 2026-09-25: 09:00–17:00 no fuso confirmado do destinatário; sem fuso, envio em espera');
