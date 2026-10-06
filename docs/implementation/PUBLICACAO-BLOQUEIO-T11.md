# Publicação: bloqueio das ligações até a T11 (migração 0035)

**Data:** 06/10/2026. **Estado:** **publicado em 06/10/2026** (Worker `65fe3503-b40e-4e3c-bdae-bc6cc0972799`). A lentidão da lista, que derrubava Tarefas e Início, foi corrigida e publicada no Worker `1213cf87-67fa-4352-8fc2-e558b07e084c` (mediana de 3,5 s; ver `EVIDENCIAS.md`).

**Base:**
- Worker atual em produção: `62182b6e-b9f6-4086-bb85-5db0deb58f1f`, publicado de `1ca78a2` com a migração 0034.
- Esta mudança está na `v2-revisao-2`.

## O que entra

- **Migração 0035, `compliance_validations`:** registro só de inclusão das decisões T11, por escopo. Cada linha tem:
  - escopo: `br_manual_phone`, `br_manual_linkedin`, `de_manual_phone`, `de_manual_linkedin`, `br_email_automatic`, `de_email_automatic` ou `campaigns`. Não existe escopo "T11 inteira";
  - decisão (validação ou revogação);
  - responsável;
  - data;
  - fundamento (documento ou registro da decisão).
  - Gatilhos impedem alterar ou apagar uma linha; uma revogação é gravada como linha nova.
  - **Não há rota nem botão para gravar.** O registro nasce vazio e assim fica até o processo de validação aprovado na Spec ser cumprido.
- **Bloqueio calculado no backend:**
  - ligação e LinkedIn manual só ficam prontos com validação vigente para o país da empresa e o canal exatos;
  - vale a decisão mais recente cuja data já chegou;
  - sem registro, o motivo é "T11 pendente" (`t11_pending`);
  - vale na listagem e na conclusão, inclusive para tarefas novas, editadas ou reabertas;
  - o estado da tarefa não muda: nada é cancelado ou suspenso.
- **O que continua possível:** corrigir dados (telefone, canal, roteiro, próxima ação), registrar oposição e atender pedido de exclusão.
- **Validação futura:** retira só o próprio motivo. Telefone ausente, divergente ou suprimido, pausas e triagem continuam bloqueando.
- **A aprovação do uso pessoal do Compass não conta como validação.**
- **Tela Tarefas:** motivo em texto: "T11 pendente (validação do contato real para este país e canal)".

## Verificações feitas (sem publicar)

- **Teste novo** `tests/t11-gate.test.mjs`, com 6 casos. Antes da correção, os 6 falhavam: a ligação aparecia pronta (`[]`) sem validação. Cobrem:
  - validação ausente, inclusive em tarefas de ficha;
  - escopo incompatível: Alemanha, e-mail automático, campanhas e LinkedIn não liberam telefone no Brasil, e a validação do Brasil não libera a Alemanha;
  - recusa da conclusão no backend;
  - preservação dos outros bloqueios (telefone ausente, suprimido, tarefa reaberta, pausa), data futura e revogação;
  - correção de dados e oposição durante o bloqueio;
  - integridade do registro e ausência de rota para gravar.
- **Cenário comum dos testes (`pilot`):** passa a gravar uma validação fictícia do Brasil para os testes antigos que concluem ligações; os testes da T11 usam `t11: false`.
- **`npm run check`:** 409 testes da suíte principal, 2 do Worker e 16 da ponte. `validate-deploy` também passou.
- **`npm run test:ui`** passou, com Playwright 1.63.0 externo e o Chrome do sistema.
- **Compatibilidade:** a suíte do commit publicado (`1ca78a2`) passou com a 0035 aplicada: 403 testes da suíte principal e 2 do Worker. A 0035 só cria uma tabela.
- **Ambiente local** (D1 do Wrangler com a 0035): "Para fazer (0)"; todas as ligações em "Bloqueadas" com "T11 pendente", e as sem telefone também com "sem telefone definido".

## Passo a passo (com autorização)

1. **Pré-checagem:**
   - `git status` limpo na `v2-revisao-2`;
   - `npm run check` e `npm run test:ui`;
   - em produção, só leitura: 13 ligações (7 com telefone, 6 sem), canais `planned`, campanhas inativas, ponte lendo a caixa.
2. **Ponto de restauração:**
   - anotar o Worker atual (`npx wrangler deployments list`);
   - anotar o bookmark do D1 (`npx wrangler d1 time-travel info eag_compass`);
   - fazer o backup privado (`npx wrangler d1 export eag_compass --remote --output C:\Users\Roger\eag-compass-backups\d1-remoto-antes-0035-<data>\eag_compass.sql`, com acesso só do usuário).
3. **Migração:** `npx wrangler d1 migrations list eag_compass --remote` deve listar só a 0035. Depois, `npm run db:migrate:remote`. Conferir:
   - a tabela `compliance_validations` **vazia**;
   - o índice;
   - os dois gatilhos.
4. **Deploy:** `npm run deploy`. Anotar o id da versão.
5. **Conferência pós-deploy (só leitura):**
   - "Para fazer" com 0 ligações;
   - as 7 com telefone em "Bloqueadas" só com `t11_pending`;
   - as 6 sem telefone com `phone_missing` e `t11_pending`;
   - telefones, roteiros, ids, estados, revisões e histórico iguais aos de antes (comparar com um retrato tirado no passo 1);
   - canais `planned`, campanhas inativas, outbox e supressões sem mudança;
   - ponte lendo a caixa.
6. **Registrar** em `EVIDENCIAS.md`.

## Reversão

- **Worker:** `npx wrangler rollback 62182b6e-b9f6-4086-bb85-5db0deb58f1f`, compatível com a 0035 (verificado). Com o Worker anterior, as 7 ligações com telefone voltam a aparecer em "Para fazer". A espera pela T11 volta a depender só da linha "ANTES DE LIGAR" e dos canais `planned`.
- **Banco:** a 0035 só cria uma tabela vazia e não precisa ser desfeita. Último recurso: o backup ou o bookmark do passo 2.

## Como uma validação T11 entraria no futuro (não implementado)

Só depois de o processo de validação da Spec ser cumprido (T11 "com responsável competente", ou a divisão T11-BR-TEL, se Rogério aprovar a emenda). A gravação seria uma linha por escopo, com responsável, data e fundamento verificáveis. Nunca um botão genérico. O desenho dessa gravação fica para quando o processo estiver aprovado.
