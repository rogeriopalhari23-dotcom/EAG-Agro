# EXCLUSAO-PURGA — alcance, dados que permanecem, migração 0032, publicação e reversão

**Estado (2026-10-01):**
- Implementado e testado só com dados fictícios.
- **Não publicado.**
- Nenhuma exclusão real foi executada; nenhum backup ou registro local foi apagado.

**Requisitos:** R9.1, R9.1.1, R9.1.2, R21.5, R23.5.

**Retenção:** prazos e fundamentos são decisão da T11 (`T11-POLITICA-PROPOSTA.md`). Este documento não fixa nenhum.

## 1. Alcance da exclusão (`POST /api/contacts/:id/delete-personal-data`, só Administrador)

1. **Contato:** nome, cargo, e-mail, telefone, LinkedIn, nota e origem apagados. `email_hash`, papel e fuso ficam.
2. **Textos congelados das fichas dele:** viram marcador cifrado; identidade e `message_sha256` ficam iguais. A aprovação de texto purgado é recusada.
3. **Mensagens recebidas dele (`from_hash`):**
   - o arquivo sai do R2;
   - `message_id`, `in_reply_to` e `references` são anulados;
   - fica `message_key` (HMAC do Message-ID), para a mesma mensagem relida com outro UID ser reconhecida e não voltar ao R2 nem abrir tarefa.
4. **Tarefas:** as do contato e as abertas por **qualquer** mensagem dele (`tasks.inbound_id`) têm roteiro e resultado limpos; as abertas ou suspensas passam a canceladas.
5. **Outros registros:**
   - candidata de pessoa: nome-marcador, sem cargo, e-mail, telefone, nota de compra e fontes;
   - referência de verificação anulada;
   - a parte dele no cache do aviso legal (Impressum) da empresa;
   - endereço redigido em `send_log.detail` e `resolved_reason`.
6. **Envios pendentes** cancelados; **supressão** do hash do e-mail (R9.1.2).
7. **Registro de exclusão:** `erasure_ledger` no D1 e uma cópia no R2, sem PII, gravada antes do D1.
8. **Resposta da rota:**
   - contagens;
   - `sharedRetained`: mensagens de **outros** remetentes na conversa, que não são apagadas;
   - `replyTasksToReview`: tarefas de resposta da empresa ainda sem vínculo.
9. **Repetição:** pode ser repetida sem efeito novo; depois de uma ligação manual, a repetição alcança a tarefa ligada.

**Conteúdo de outros contatos:** nunca é apagado automaticamente.
- Uma resposta de colega na mesma conversa só é purgada por decisão individual (`POST /api/inbound/:id/purge-content`, motivo de 10 ou mais caracteres, auditada).
- No cache do aviso legal sai só a pessoa.

**Tarefas de resposta anteriores à 0032** (sem vínculo):
- `correcoes/0032-vinculo-tarefas-resposta.sql` liga só quando há **exatamente uma** mensagem candidata (mesma empresa, tipo que abre tarefa, mesmo dia). Cada vínculo é auditado.
- As demais aparecem em `GET /api/tasks/reply-review`, com as candidatas e sem PII, e são ligadas à mão por `POST /api/tasks/:id/link-inbound`, com motivo e auditoria; um vínculo existente nunca é trocado.
- **Produção hoje** (consulta só leitura, 2026-10-01 20:2x UTC): 2 tarefas de resposta (teste interno), cada uma com 1 candidata. Ambas seriam ligadas e nenhuma iria para revisão.

**Testes:** `tests/exclusao-purga.test.mjs`, 9 testes, dados fictícios.
1. Alcance completo e evidências do colega intactas.
2. Repetição e imutabilidade.
3. Restauração do D1 com bloqueio e reaplicação.
4. Redação no Worker e no diário da ponte.
5. Reversão.
6. Diário já gravado.
7. Vínculo inequívoco das tarefas antigas.
8. Tarefas ambíguas para revisão, com exclusão repetida após a ligação.
9. Mensagem relida depois da purga.

## 2. Dados que permanecem depois de uma exclusão — nada aqui foi "aceito"; cada item espera decisão

| Dado que permanece | Por quê | Quem pode acessar | Decisão T11 que falta |
| --- | --- | --- | --- |
| `email_hash` no contato, na supressão e no registro de exclusão | Não voltar a contatar (R9.1.2) e refazer a exclusão após restauração | Administrador (Compass) e o titular da conta Cloudflare | Prazo de retenção do identificador de supressão e do registro de exclusão (T11 §2.1–2.2) |
| `message_key` (HMAC do Message-ID) das mensagens dela | Impedir que a mesma mensagem relida volte a ser guardada ou abra tarefa | Idem | Mesmo prazo do identificador de supressão, ou outro |
| Retrato da versão da ficha (`ficha_versions.snapshot_enc`): id do contato, hash, papel, fuso e `targetFlag` (categoria derivada do cargo) | Imutável e compartilhado pelos destinatários da versão; prova do que foi aprovado | Perfis que abrem a ficha (hoje só Rogério, Administrador) e o titular da conta Cloudflare | Guardar como evidência da aprovação, e por quanto tempo; ou exigir purga do `targetFlag` |
| Linhas de envio e aprovação (`send_outbox`, `ficha_approvals`, `send_log` sem endereço) e da mensagem recebida sem conteúdo | Evidência de que houve envio, aprovação e resposta (auditoria, R19) | Idem | Prazo de guarda da evidência operacional |
| Notas livres por empresa que citem a pessoa pelo nome (`evidence`, `demand_fields`, verificações de busca, texto restante de `resolved_reason`) | Não têm vínculo com o contato; não dá para achar sem ler | Perfis com acesso à empresa (hoje só Rogério) | Se a exclusão exige revisão manual dessas notas e quem a faz |
| Respostas de outros remetentes na conversa (`sharedRetained`) | São dados de outra pessoa | Administrador | Critério para purgar uma resposta de terceiro que cite o titular |
| Tarefas de resposta sem vínculo (quando houver) | Sem evidência inequívoca da mensagem | Administrador | Nenhuma de política: decisão manual caso a caso (rota de ligação) |
| **Time Travel do D1** (estado anterior à exclusão) | Recurso da plataforma; um ponto não pode ser apagado | O titular da conta Cloudflare (Rogério) | Aceitar a janela do plano como limite técnico e informá-la ao titular dos dados? (§3) |
| **Exportações locais do D1** (`C:\Users\Roger\eag-compass-backups\`), feitas antes de migrações | Ponto de volta de migração | Usuário Windows de Rogério | Prazo de guarda das exportações; nenhuma foi apagada |
| **Caixa `rogeriopalhari@eagagro.com`** (Entrada, Enviados, Lixeira) e cópias da Hostinger | Fora do Compass; a caixa é da EAG | Rogério e os administradores da caixa na EAG/Hostinger | Jurídico da EAG: guarda da caixa corporativa e quem atende a exclusão nela |
| **Diário local da ponte** (`%LOCALAPPDATA%\eag-mail-bridge\journal.sqlite`): id do envio, `Message-ID` nosso, hash, estado e texto SMTP (sem endereço depois do script) | Impede reenvio depois de queda | Usuário Windows de Rogério | Prazo de guarda do diário |
| **Registro de execução da ponte** (`ponte.log`): sem endereço e sem conteúdo por desenho | Diagnóstico | Usuário Windows de Rogério | Rotação ou prazo |

## 3. Plano do D1 e janela do Time Travel

- **Fonte da regra:** documentação da Cloudflare (`developers.cloudflare.com/d1/reference/time-travel/`, atualizada em 2026-04-21): 7 dias no Workers Free e 30 dias no Workers Paid.
- **O que deu para conferir pela conta (2026-10-01):**
  - `wrangler whoami` e `wrangler d1 info` não mostram o plano;
  - a API `GET /accounts/{id}/subscriptions` recusou por permissão (o token só tem leitura de conta, não de cobrança);
  - `workers/account-settings` mostra `default_usage_model: standard`, que existe nos dois planos.
  - **O plano não está confirmado.**
- **Indício, não prova:** `wrangler d1 time-travel info eag_compass --timestamp=2026-09-24T13:28:57Z` (7 dias e 7 horas antes) devolveu o bookmark inicial `00000000-…`. O comando pode só converter a data em bookmark sem validar a retenção, por isso não fecha a questão.
- **Onde conferir:**
  - painel da Cloudflare, conta "Rogeriopalhari23@gmail.com's Account" → **Workers & Pages** → aba **Plans** (ou **Compute (Workers) → Plans**): aparece "Workers Free" ou "Workers Paid";
  - alternativa: **Manage Account → Billing → Subscriptions**, que lista "Workers Paid" quando contratado.
- **O plano define:**
  - por quanto tempo um dado excluído continua recuperável por restauração (7 ou 30 dias);
  - a janela de volta do passo 2 do §4.

## 4. Plano final de publicação (para autorização; nada executado)

**Commits a publicar** (`git log b3935f9..HEAD` em `v2-revisao-2`; código em produção = `b3935f9`, Worker `b6d4b19d`):
- `ab723e9` purga inicial: textos, R2, tarefas, candidatas, documentos T11;
- `c3c2bd1` resíduos de envio e respostas, conteúdo compartilhado, proteção contra restauração;
- `1b9fd59` **correção de respostas com várias commodities** (commit separado);
- o commit final desta entrega (EXCLUSAO-PURGA finalizada e este plano), indicado no relatório e conferido no passo 1.

**Compatibilidade:** a suíte da versão em produção (`b3935f9`) passou com a 0032 aplicada (conferência repetida com a versão final da 0032 — ver EVIDENCIAS). Por isso a ordem é migração, depois deploy, e a volta só do código é segura.

| # | Passo (PowerShell em `C:\Users\Roger\eag-compass`) | Conferência esperada |
| --- | --- | --- |
| 1 | `git fetch; git status -sb; git log --oneline b3935f9..origin/v2-revisao-2` | árvore limpa; exatamente os commits acima |
| 2 | `npm run check` | tudo verde |
| 3 | `npx wrangler d1 time-travel info eag_compass` | anotar o bookmark (ponto de volta) |
| 4 | `npx wrangler d1 export eag_compass --remote --output C:\Users\Roger\eag-compass-backups\d1-antes-0032-<data>.sql` | arquivo criado; contém PII; guarda conforme a decisão T11 |
| 5 | `npx wrangler d1 migrations list eag_compass --remote` | só a `0032_exclusao_purga.sql` pendente |
| 6 | `npx wrangler d1 migrations apply eag_compass --remote` | sucesso |
| 7 | `npx wrangler d1 execute eag_compass --remote --command "SELECT name FROM sqlite_master WHERE name IN ('ficha_messages_immutable','erasure_ledger','idx_inbound_message_key')"` | as três linhas |
| 8 | `npx wrangler d1 execute eag_compass --remote --file docs\implementation\correcoes\0032-vinculo-tarefas-resposta.sql` | depois: `SELECT COUNT(*) FROM tasks WHERE inbound_id IS NOT NULL AND kind='reply_followup'` = 2; auditoria `vinculo-tarefas-0032` = 2 |
| 9 | `npx wrangler deploy` e `npx wrangler deployments list` | nova versão ativa; anotar o id |
| 10 | Conferências só de leitura: `GET /api/tasks/reply-review` (0 itens); ficha da Amori abre igual; `GET /api/integrations`; próximo ciclo da ponte com `nothing_due` (e não `erasure_reapply_required`); canal `planned`; nenhuma campanha ativa | sem mudança de comportamento |
| 11 | **Ponte Windows** (só redação do diário): `bridge\ponte parar` → `git pull` → `node bridge\scripts\redigir-diario.mjs "$env:LOCALAPPDATA\eag-mail-bridge\journal.sqlite"` → `bridge\ponte iniciar` → `bridge\ponte estado` | ponte lendo; anotar `{examined, changed}`; nenhuma linha apagada |

Nenhum passo exclui dado real. A rota de exclusão só roda num pedido real, por decisão de Rogério.

## 5. Reversão

- **Só o código:** `npx wrangler rollback b6d4b19d-a56b-402e-b78f-e7394a395ecd`. É seguro com a 0032 aplicada: o código antigo não usa as colunas novas.
  - Efeito colateral a conhecer: sem o código novo, a resposta com 3 ou mais commodities volta a falhar como antes de `1b9fd59`.
- **Esquema:** `docs/implementation/correcoes/0032-reversao.sql`, com o código anterior. Testado.
  - O que volta: a imutabilidade total dos textos.
  - O que fica e não interfere: as colunas novas (`tasks.inbound_id` tem chave estrangeira e o SQLite não a remove) e o índice da `message_key`.
  - `erasure_ledger` não é apagado, porque é a prova das exclusões.
  - Os vínculos do passo 8 ficam: são inofensivos para o código anterior.
- **Último recurso:** `npx wrangler d1 time-travel restore eag_compass --bookmark=<bookmark do passo 3>`. Apaga tudo o que foi gravado depois.
  - Se houver exclusão real depois da 0032, mantenha o código novo no ar: a guarda bloqueia envio e aprovação até `POST /api/erasures/reapply`.
- **Ponte:** voltar `bridge/src/journal.js` ao commit anterior e reiniciar. O script não apaga linhas; só troca endereço por "[endereço]".
- **Purgas executadas não são desfeitas** por nenhuma reversão.

## 6. Depois de qualquer restauração do D1

1. Parar a ponte.
2. Restaurar.
3. Rodar `POST /api/erasures/reapply` (Administrador); confirmar `consistent: true`.
4. Conferir `GET /api/tasks/reply-review`.
5. Religar a ponte.

Enquanto a reaplicação não roda, envio e aprovação ficam bloqueados (`erasure_reapply_required`), mas a tela mostra os dados que voltaram.
