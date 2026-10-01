-- Vínculo das tarefas de resposta anteriores à migração 0032 com a mensagem que as abriu (tasks.inbound_id), para que
-- uma exclusão alcance a nota de Rogério sobre a resposta da pessoa. Executar UMA vez, logo depois da 0032.
--
-- Só liga quando a evidência é inequívoca, isto é, existe EXATAMENTE UMA mensagem candidata:
--   * tarefa de resposta (reply_followup ou review_ambiguous) ainda sem vínculo;
--   * mensagem do mesmo tenant e da MESMA empresa (inbound_messages.company_id), de um tipo que abre tarefa
--     (human, auto_reply, unclassified, unsubscribe) e correlação thread/sender;
--   * o dia da tarefa (due_date = dia do processamento em pauseTargets) igual ao dia do processamento da mensagem.
-- Resposta ambígua (company_id nulo), duas respostas da mesma empresa no mesmo dia ou nenhuma candidata: NÃO liga;
-- a tarefa aparece em GET /api/tasks/reply-review para decisão manual (POST /api/tasks/:id/link-inbound).
-- Cada vínculo fica no audit_log (request_id 'vinculo-tarefas-0032').
INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,field_name,old_value_json,new_value_json,reason,request_id)
WITH cand AS (
  SELECT t.id AS task_id, t.tenant_id, i.id AS inbound_id
  FROM tasks t JOIN inbound_messages i ON i.tenant_id=t.tenant_id AND i.company_id=t.company_id
  WHERE t.inbound_id IS NULL AND t.kind IN ('reply_followup','review_ambiguous')
    AND i.classification IN ('human','auto_reply','unclassified','unsubscribe') AND i.correlation IN ('thread','sender')
    AND substr(i.processed_at,1,10)=t.due_date
), uniq AS (SELECT task_id, tenant_id, MIN(inbound_id) AS inbound_id FROM cand GROUP BY task_id, tenant_id HAVING COUNT(*)=1)
SELECT lower(hex(randomblob(16))), tenant_id, 'system-correction', 'system', 'task.inbound_linked', 'task', task_id, 'inbound_id',
  'null', json_quote(inbound_id), 'Vínculo inequívoco (única mensagem da empresa no dia) para a exclusão alcançar a tarefa', 'vinculo-tarefas-0032'
FROM uniq;

WITH cand AS (
  SELECT t.id AS task_id, i.id AS inbound_id
  FROM tasks t JOIN inbound_messages i ON i.tenant_id=t.tenant_id AND i.company_id=t.company_id
  WHERE t.inbound_id IS NULL AND t.kind IN ('reply_followup','review_ambiguous')
    AND i.classification IN ('human','auto_reply','unclassified','unsubscribe') AND i.correlation IN ('thread','sender')
    AND substr(i.processed_at,1,10)=t.due_date
), uniq AS (SELECT task_id, MIN(inbound_id) AS inbound_id FROM cand GROUP BY task_id HAVING COUNT(*)=1)
UPDATE tasks SET inbound_id=(SELECT inbound_id FROM uniq WHERE uniq.task_id=tasks.id)
WHERE id IN (SELECT task_id FROM uniq);
