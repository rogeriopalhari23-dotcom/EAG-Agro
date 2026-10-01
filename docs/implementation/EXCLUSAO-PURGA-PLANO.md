# EXCLUSAO-PURGA — alcance, limitações, migração 0032 e reversão (2026-10-01)

**Estado:**
- Implementado e testado só com dados fictícios.
- **Não publicado.**
- Nenhuma exclusão real foi executada.

**Requisitos:** R9.1, R9.1.1, R9.1.2, R21.5, R23.5.

**Retenção:** prazos e fundamentos dependem da T11 (`T11-POLITICA-PROPOSTA.md`). Este documento não fixa nenhum.

## 1. Revisão dos dados que permaneciam (consulta ao esquema real, 75 tabelas)

| Onde | O que havia | Dado pessoal? | Tratamento agora |
| --- | --- | --- | --- |
| `ficha_approvals` | contato, canal, hash dos textos aprovados, quem aprovou, data | Não (id e hash) | Fica: é a evidência da aprovação |
| `send_outbox` | `email_hash`, `message_id` gerado por nós (`<ob-<id>@eagagro.com>`), estados | Pseudonimizado | Fica: é a evidência do envio |
| `send_outbox.resolved_reason` | Texto livre de Rogério ao resolver um indeterminado | **Pode ter o endereço** | Endereço → "[endereço]" nas linhas do contato; o texto restante fica |
| `send_log.detail` | Texto do servidor SMTP, até 160 caracteres | **Pode ter o endereço** (ex.: "550 5.1.1 <x@y> unknown") | Antes: na exclusão, endereço redigido nas linhas do contato. Agora: não entra mais em nenhuma linha nova (Worker e ponte) |
| `tasks` de resposta (`reply_followup`, `review_ambiguous`) | Orientação fixa no roteiro; a nota de Rogério em `result_json`; **sem contato e sem envio vinculados** | A nota pode citar a pessoa | **Vínculo corrigido:** `tasks.inbound_id`. A purga alcança a tarefa aberta pela mensagem da pessoa; a de outro remetente fica |
| `inbound_messages` | `from_hash`; `message_id`, `in_reply_to` e `references` do servidor dela; arquivo `.eml` no R2 | Sim (arquivo); IDs do servidor dela | Arquivo apagado; IDs anulados; classificação, correlação e datas ficam |
| `person_candidates` | Nome, cargo, e-mail e telefone cifrados; `purchase_note` e `purchase_source_url`; `source_url` | Sim | Tudo anulado ou com marcador; `name_hash` fica (impede recadastrar a pessoa); status `dismissed` |
| `research_cache` (Impressum) | Nomes de todas as pessoas do aviso legal da empresa, cifrados | **Compartilhado** | Sai só a pessoa (comparação por `name_hash`) e o e-mail ou telefone dela; os demais ficam |
| `contacts.source_label` | Texto livre da origem | Pode citar a pessoa | Trocado por "dados excluídos em AAAA-MM-DD" |
| `contact_verifications.source_reference` | Endereço da fonte (pode ser perfil) | Sim | Anulado |
| `ficha_versions.snapshot_enc` | Contato, papel, hash, fuso e `targetFlag` (categoria derivada do cargo) | Pseudonimizado; **compartilhado pela versão** | Fica (limitação §3). Não traz nome nem e-mail |
| `audit_log` | Ações sobre contatos | Não: só ids, papéis e indicadores (conferido em `companies.js`, `people.js`, `tasks.js`) | Fica |
| `email_validation_jobs` | Lista de ids, `task_hash`, erro da Snov (texto fixo do adaptador) | Não | Fica |
| `meetings` | Contato, data, canal | Não (id) | Fica |
| `evidence`, `demand_fields`, `search_candidate_checks` | Notas e referências por **empresa** | Podem citar a pessoa em texto livre | Não alcançado automaticamente (limitação §3) |

## 2. Alcance final da exclusão (`POST /api/contacts/:id/delete-personal-data`, só Administrador)

1. **Contato:** nome, cargo, e-mail, telefone, LinkedIn, nota e origem apagados. `email_hash`, papel e fuso ficam.
2. **Textos congelados das fichas dele:** o conteúdo vira marcador cifrado e o HTML fica nulo. Identidade e `message_sha256` ficam iguais. A aprovação de texto purgado é recusada (`personal_data_deleted`).
3. **Mensagens recebidas dele (`from_hash`):** o arquivo sai do R2, os IDs do servidor são anulados e a linha fica sem conteúdo.
4. **Tarefas:**
   - as do contato: roteiro e resultado limpos; abertas ou suspensas passam a canceladas;
   - as abertas por mensagens dele (`inbound_id`): mesmo tratamento.
5. **Candidata de pessoa, verificação e parte dele no cache do aviso legal.**
6. **Endereço redigido** em `send_log` e `resolved_reason` dos envios dele.
7. **Envios pendentes** cancelados (`personal_data_deleted`).
8. **Supressão** do hash do e-mail (`personal_data_deleted`, R9.1.2), sem duplicar.
9. **Registro de exclusão:** `erasure_ledger` no D1 (sem PII) e a cópia `erasures/<tenant>/<contato>.json` no R2. A cópia é gravada **antes** do D1.
10. **Auditoria:** só contagens e base legal.
11. **Repetição:** pode ser repetido sem efeito novo. Testado: zero purgas novas, um único registro e uma única supressão.

**Conteúdo compartilhado.** Uma resposta de **outro remetente** na conversa da pessoa (ex.: o colega que responde citando-a):
- é do colega, e **não é apagada** automaticamente;
- volta em `sharedRetained` para Rogério revisar;
- se precisar, há a purga individual `POST /api/inbound/:id/purge-content`, com motivo de 10 ou mais caracteres e auditada.

O mesmo vale para o cache do aviso legal: sai só a pessoa.

**Testes:** `tests/exclusao-purga.test.mjs`, 6 testes, dados fictícios.
1. Alcance completo da titular e evidências do colega intactas, incluindo a tarefa de resposta de cada um e a resposta compartilhada.
2. Repetição do pedido e imutabilidade.
3. Restauração do D1 (cópia `VACUUM INTO`), bloqueio e reaplicação.
4. Redação de endereço no Worker e no diário da ponte.
5. Reversão da 0032.
6. Redação do diário já gravado.

O teste 3 encontrou um defeito: a reaplicação não marcava `reapplied_at` quando o banco restaurado nem tinha a linha. Já está corrigido.

## 3. Limitações que continuam

1. **Cópias de recuperação do D1 (Time Travel):** guardam o estado anterior pelo prazo do plano. Segundo a documentação da Cloudflare (atualizada em 2026-04-21), são 7 dias no Workers Free e 30 dias no Workers Paid; o plano da conta precisa ser confirmado no painel. Não há como apagar um ponto do Time Travel. A exclusão só some das cópias quando o prazo vence. **Decisão T11:** aceitar esse prazo como limite técnico e informá-lo ao titular?
2. **Exportações locais do D1** (`C:\Users\Roger\eag-compass-backups\`), feitas antes de migrações, contêm PII. **Procedimento proposto:**
   - depois de cada exclusão real, apagar as exportações anteriores a ela que não forem mais necessárias;
   - registrar quais foram mantidas e por quê.
   
   **Decisão T11:** prazo de guarda das exportações.
3. **Caixa de e-mail `rogeriopalhari@eagagro.com`:** Entrada e Enviados guardam as mensagens originais. A caixa é da EAG; Rogério não administra a infraestrutura dela.
   - **Procedimento proposto:** Rogério procura pelo endereço e apaga as mensagens da pessoa em Entrada, Enviados e Lixeira, depois esvazia a Lixeira.
   - Cópias de segurança da Hostinger ou da EAG ficam fora do alcance dele.
   - **Decisão T11 / jurídico da EAG:** a caixa corporativa tem guarda própria ou retenção legal? Quem atende a exclusão nela?
4. **Diário local da ponte** (`%LOCALAPPDATA%\eag-mail-bridge\journal.sqlite`):
   - guarda id do envio, `Message-ID`, hash, estado e o texto SMTP;
   - as linhas novas entram sem endereço;
   - as antigas são redigidas com `bridge\scripts\redigir-diario.mjs`, com a ponte parada (§5, passo 9).
   
   **Decisão T11:** por quanto tempo guardar o diário. Ele só serve para impedir reenvio depois de queda.
5. **Registro de execução da ponte** (`ponte.log`): por desenho, sem endereço e sem conteúdo. Mensagens de erro de conexão (até 120–160 caracteres) vêm do servidor e não costumam ter endereço. **Decisão T11:** rotação ou guarda.
6. **Retrato da versão** (`ficha_versions.snapshot_enc`): continua com id, hash, papel, fuso e `targetFlag` da pessoa. É pseudonimizado e compartilhado pela versão, e a versão é imutável.
7. **Notas livres por empresa** (`evidence`, `demand_fields`, verificações de busca, `resolved_reason` sem o endereço) podem citar a pessoa pelo nome. Não há vínculo com o contato; a revisão é manual no pedido de exclusão.
8. **Tarefas de resposta anteriores à 0032** não têm `inbound_id`. Em produção só existem as do teste interno, com endereços internos.
9. **Restauração para antes da própria 0032:** sem `erasure_ledger`, envio e aprovação falham com erro (falha fechada), e não com liberação. Nesse caso, reaplicar a migração e depois a reaplicação.
10. **Se o R2 perder a cópia** do registro de exclusão, a guarda não detecta a restauração daquela exclusão. O R2 não tem versão e a cópia não é apagada por nenhuma rota.

## 4. Restauração: como impedir que dados excluídos voltem a ser usados

- **Detecção automática:** cada envio (`prepareNext`, usado pela ponte e pelo caminho direto) e cada aprovação comparam as cópias no R2 com o `erasure_ledger` do D1. Faltou alguma no D1 → envio `erasure_reapply_required` e aprovação 409. Testado com restauração real de arquivo.
- **Procedimento depois de qualquer restauração do D1:**
  1. parar a ponte;
  2. restaurar;
  3. `POST /api/erasures/reapply` (Administrador): refaz cada exclusão que faltar, com auditoria `contact.personal_data_reapplied`, e responde `consistent: true`;
  4. conferir `GET /api/session` e um envio de teste interno;
  5. religar a ponte.
- **Enquanto a reaplicação não roda,** a tela ainda mostra os dados que voltaram. Por isso o passo 3 vem logo após a restauração.

## 5. Plano de publicação (para autorização; nada disto foi executado)

**Pré-condições:**
- branch `v2-revisao-2` com o commit desta entrega enviado ao GitHub;
- `npm run check` verde;
- canal `planned`;
- ponte em execução.

**Compatibilidade comprovada:** a suíte da versão em produção (`b3935f9`, Worker `b6d4b19d`) passou **373 de 373** com a 0032 aplicada, numa cópia temporária. Por isso a ordem é **migração primeiro, deploy depois**, e a volta só do código é segura.

| # | Passo (PowerShell, `C:\Users\Roger\eag-compass`) | Conferência |
| --- | --- | --- |
| 1 | `git status -sb` e `git log --oneline -1` | branch e commit esperados, árvore limpa |
| 2 | `npx wrangler d1 time-travel info eag_compass` | anotar o bookmark atual (ponto de volta) |
| 3 | `npx wrangler d1 export eag_compass --remote --output C:\Users\Roger\eag-compass-backups\d1-antes-0032-<data>.sql` | arquivo criado. Contém PII: guardar conforme a decisão T11 do §3.2 |
| 4 | `npx wrangler d1 migrations list eag_compass --remote` | só a 0032 pendente |
| 5 | `npx wrangler d1 migrations apply eag_compass --remote` | sucesso |
| 6 | `npx wrangler d1 execute eag_compass --remote --command "SELECT sql FROM sqlite_master WHERE name IN ('ficha_messages_immutable','erasure_ledger')"` e `PRAGMA table_info(tasks)` | trigger novo, tabela criada, coluna `inbound_id` |
| 7 | `npx wrangler deploy` e depois `npx wrangler deployments list` | nova versão ativa |
| 8 | Conferências só de leitura: ficha da Amori abre igual; `GET /api/integrations`; ciclo da ponte com `nothing_due` (e não `erasure_reapply_required`); canal `planned` | sem mudança de comportamento |
| 9 | Ponte (código do diário): `bridge\ponte parar` → `git pull` já feito → `node bridge\scripts\redigir-diario.mjs "$env:LOCALAPPDATA\eag-mail-bridge\journal.sqlite"` → `bridge\ponte iniciar` → `bridge\ponte estado` | ponte lendo; resultado `{examined, changed}` registrado |

Nenhum passo exclui dado real: a rota de exclusão só roda quando Rogério pedir, por um pedido real.

## 6. Reversão

- **Só o código** (problema no Worker): `npx wrangler rollback b6d4b19d-a56b-402e-b78f-e7394a395ecd`. É seguro com a 0032 aplicada, como comprovado acima.
- **Esquema:** `docs/implementation/correcoes/0032-reversao.sql`, junto com a volta do código. Testado.
  - O que volta: a imutabilidade total dos textos.
  - O que fica: as colunas novas, que ficam inertes (`tasks.inbound_id` tem chave estrangeira e o SQLite não remove essa coluna), e o `erasure_ledger`, que é a prova das exclusões.
- **Último recurso:** Time Travel para o bookmark do passo 2 (`npx wrangler d1 time-travel restore eag_compass --bookmark=<bookmark>`). Isso apaga tudo o que foi gravado depois.
  - Se já houver exclusão real depois da 0032, a guarda bloqueia o envio até a reaplicação; para isso, a versão nova do código precisa estar no ar.
  - Purgas executadas não são desfeitas por nenhuma reversão.
- **Ponte:** a mudança do diário é só redação de texto. Voltar o arquivo `bridge/src/journal.js` e reiniciar.

## 7. Achado fora do escopo (não corrigido)

`src/inbound.js`, alerta de "outra commodity": o `INSERT … SELECT` usa um único `crypto.randomUUID()` para todas as linhas. Se a empresa tiver duas ou mais outras commodities com envio pendente, a segunda linha repete a chave e o lote inteiro da resposta falha: pausa e tarefa não são gravadas. Proposta: gerar o id no SQL (`lower(hex(randomblob(16)))`) e testar o caso. Aguarda decisão para entrar como tarefa própria.
