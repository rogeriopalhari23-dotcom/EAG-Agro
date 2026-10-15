-- Horário do aceite SMTP do original (2026-10-15, pendência técnica do teste D5-a de 14/10): a ponte informa o instante em
-- que o servidor SMTP aceitou a mensagem (gravado no diário local logo após o SMTP, preservado na recuperação depois de
-- falha). accepted_at continua sendo o instante em que o Compass registrou o aceite. Nulo quando a ponte não informou
-- (versão antiga da ponte, ou aceite comprovado só pela pasta de enviados depois de queda).
ALTER TABLE send_outbox ADD COLUMN smtp_accepted_at TEXT;
