-- EXCLUSAO-RELEVANCIA (2026-10-08): pessoas excluídas antes desta correção ainda guardam a relevância (texto livre sobre
-- a pessoa) e o hash do nome (pseudônimo que permitiria reconhecê-la pelo nome). Aplica a elas o mesmo que a exclusão
-- passa a fazer: relevância vira a marca de conteúdo excluído e o hash vira um valor sem relação com o nome (NOT NULL e
-- único por empresa). Só alcança linhas já marcadas como excluídas a pedido do titular; terceiros não mudam. Repetível.
UPDATE person_candidates
   SET relevance = '[conteúdo excluído a pedido do titular]',
       name_hash = 'purged:' || id
 WHERE dismiss_reason = 'personal_data_deleted'
   AND (relevance <> '[conteúdo excluído a pedido do titular]' OR name_hash <> 'purged:' || id);
