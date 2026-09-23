# Continuação EAG Compass

Siga `AGENTS.md`. A revisão consolidada já está implementada: não reinicie diagnóstico da versão 0.3.1 nem restaure trechos dos planos sobre o código corrigido.

1. Execute `npm run next`. Leia somente a tarefa selecionada, os arquivos listados e os requisitos relevantes da Spec/Constituição.
2. Consulte `docs/CONTINUAR-NO-CLAUDE.md` uma vez por sessão. O código atual e os testes são a base executável; os planos históricos contêm exemplos superados pela errata.
3. Implemente uma unidade concluível, com testes do risco observado. Reutilize resultados ainda válidos; rode a suíte completa antes da entrega.
4. Atualize estado, evidências e próxima ação em `docs/implementation/sequence.json`. Não reescreva o histórico a cada mensagem.
5. Não use LLM para score, deduplicação, distância, parse, cache, consulta de lista pronta ou disparo de mensagens aprovadas. Uma aprovação não autoriza regenerar conteúdo no envio.
6. Não marque dependência externa como concluída por fixture local. Em bloqueio de credencial, habilidade original ou decisão, avance outra tarefa independente e registre o bloqueio concreto.
