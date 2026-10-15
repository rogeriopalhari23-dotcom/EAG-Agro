# Evidência `erasure_test`: teste de exclusão em produção (08/10/2026) e correção publicada

> Extrato literal e congelado para a validação T11 `br_email_automatic`. Fonte: `docs/implementation/EVIDENCIAS.md`, no commit `e60b328`. Não editar: correção = novo extrato.

### Teste de exclusão concluído (08/10/2026)

- Novo login no Access, feito por Rogério no navegador. A exclusão rodou nos registros fictícios existentes (contatos `0c19f5d6` e `c27b4aca`, pessoa `af217a7e`), sem recriá-los.
- **Antes:** nenhuma exclusão anterior.
- **Depois:**
  - dados pessoais apagados;
  - supressões 2 → 3 (só o hash do e-mail fictício);
  - `erasure_ledger` com 2 linhas; registro no R2; 2 auditorias sem dados pessoais.
- **Resíduos e achados:** o texto "relevância" e o hash do nome da pessoa ficaram. Detalhes em `T11-REVISAO-PILOTO-BR-TELEFONE.md` §8; proposta D-EXC na §9.
- Dados reais, as 13 ligações, os canais e as campanhas não foram alterados.

## Publicação da correção da exclusão e migração 0036 (08/10/2026, autorizada por Rogério)

**Conferências antes:**
- `v2-revisao-2` em `ee4b031`, sincronizado com o remoto;
- o código a publicar difere do publicado (`7ea6095`, Worker 1213cf87) só em `src/erasure.js` e na migração 0036;
- **só a 0036 estava pendente**; nenhum servidor local aberto.

**Ponto de restauração:**
- Worker anterior **1213cf87-67fa-4352-8fc2-e558b07e084c** (100%);
- bookmark do D1: `00000730-000001c8-000050fe-95bafd1b0c049b8b61b8de9c6929ef6d`;
- backup privado: `C:\Users\Roger\eag-compass-backups\d1-remoto-antes-0036-20261008\eag_compass.sql`, 29.575.770 bytes, SHA-256 `ee95720609cf80a73c33e2f235fd2a080fc59bb40288bc478918a4a9e6878484`, acesso só de `ROGERIONOTE\Roger`.

**Migração 0036:**
- Antes: 13 pessoas, 1 delas excluída (`af217a7e`, fictícia do teste de 08/10) ainda com relevância e hash do nome; 3 supressões.
- Depois, por impressão SHA-256 de cada linha:
  - **só `af217a7e` mudou** (relevância = marca de conteúdo excluído; hash = `purged:<id>`);
  - as outras 12 pessoas e as 3 supressões ficaram idênticas;
  - "No migrations to apply".

**Publicação:**
- `npm run deploy` com check e validate-deploy: 412 testes da suíte principal, 2 do Worker e 16 da ponte.
- Worker **22711368-72a1-43af-8fb3-286c2fc7b642**, 100% do tráfego, 2026-10-08T19:57:27Z.

**Conferido depois:**
- nenhuma linha de pessoa ou supressão mudou desde a migração;
- 13 ligações com `t11_pending` (6 também com `phone_missing`), nenhuma sem bloqueio;
- 0 validações T11; 15 tarefas; 35 linhas de histórico;
- canais `planned`; campanhas: 1 rascunho e 1 encerrada; outbox sem mudança (5 aceitos, 19 cancelados): nenhum envio novo;
- ponte com leitura bem-sucedida às 19:58:25 UTC, depois do deploy.

**Reversão:**
- Código: `npx wrangler rollback 1213cf87-67fa-4352-8fc2-e558b07e084c`. É compatível com o banco atual; o código anterior só voltaria a deixar relevância e hash do nome em exclusões futuras.
- **A correção de dados da 0036 não é desfeita.** Não restaurar o backup nem o Time Travel para reverter código: isso devolveria dados pessoais já excluídos. Restauração do banco, só por outro motivo e seguida da reaplicação das exclusões (`POST /api/erasures/reapply`).

**Não feito:** D-EXC não implementado; nenhuma validação T11 registrada.
