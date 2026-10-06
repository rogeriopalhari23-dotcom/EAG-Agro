# Publicação: supressão por telefone nas ligações (migração 0034)

**Data:** 06/10/2026. **Estado:** **publicado em 06/10/2026** com autorização de Rogério: Worker `62182b6e-b9f6-4086-bb85-5db0deb58f1f`; 7 telefones aplicados e 6 pendentes. Registro em `EVIDENCIAS.md`.

**Escopo:**
- Código na `v2-revisao-2`.
- Worker atual em produção: `9866c2c3-0f48-427c-bcbf-7366daa30597`, publicado a partir de `9576cb9`.
- Entre `9576cb9` e esta mudança, `src/`, `public/` e `migrations/` não mudaram.

**O que não muda:**
- T11;
- canais (`planned`);
- campanhas (inativas);
- fichas e contatos.

## O que entra

- **Migração 0034:**
  - `tasks.phone_hash`, `phone_enc`, `phone_source`, `phone_issue`;
  - índice parcial em `phone_hash`;
  - `task_revisions` recriada para aceitar `phone` e `phone_source`, com as mesmas linhas, o mesmo índice e o mesmo gatilho que impede alteração.
- **Ligações:**
  - toda ligação mostra o número a usar e a fonte;
  - sem número, com números divergentes ou em formato sem código do país, a ligação fica pendente ("sem telefone definido" e similares) e não pode ser concluída;
  - ligações de ficha pegam o número do destinatário (contato e pessoa de compras vinculada) e nunca escolhem entre números divergentes.
- **Supressão:**
  - supressão por telefone suspende as ligações abertas com o número, com o motivo;
  - remover a supressão não reativa nada.
- **Oposição:** o resultado "Oposição" grava a nota da conversa e a supressão juntos, mesmo com a ligação já suspensa, e suspende as outras ligações ao número.
- **Tela Tarefas:**
  - telefone e fonte;
  - motivo em texto;
  - definição do telefone em ligação de ficha (o roteiro continua congelado);
  - registro de oposição;
  - seção "Suspensas".

## Compatibilidade com o Worker atual (verificada)

- **Código publicado contra o banco já migrado:** a suíte do commit publicado (`9576cb9`) rodou com a 0034 aplicada. Passaram 388 testes da suíte principal e 2 do Worker. A migração só **acrescenta**: as gravações do Worker antigo continuam válidas, e o histórico de edição mantém os campos antigos.
- **Janela entre a migração e o deploy:** o Worker antigo continua funcionando. Tarefas criadas nessa janela ficam sem telefone e aparecem como pendentes ("sem telefone definido") depois do deploy.
- **Migração local:** aplicada no D1 local do Wrangler; tabela, índice e gatilho conferidos.

## Passo a passo (com autorização)

1. **Pré-checagem (só leitura):**
   - `git status` limpo na `v2-revisao-2`;
   - `npm run check`;
   - `node scripts/validate-deploy.mjs`;
   - em produção: canais `planned`, campanhas inativas, 13 ligações de nível 0 abertas e nenhuma supressão de telefone (conferido em 06/10: só 2 supressões de e-mail).
2. **Backup privado:**
   - `npx wrangler d1 export eag_compass --remote --output <pasta privada>/eag_compass-antes-0034.sql`, com acesso restrito ao usuário, como nos backups anteriores;
   - anotar `SELECT COUNT(*) FROM task_revisions` antes da migração.
3. **Migração:** `npm run db:migrate:remote`, que deve aplicar só a 0034. Conferir:
   - as 4 colunas em `tasks`;
   - `task_revisions` com o mesmo número de linhas;
   - o índice e o gatilho `task_revisions_no_update` presentes.
4. **Deploy:** `npm run deploy`, que roda `check` e `validate-deploy` antes. Anotar o id da nova versão.
5. **Conferência pós-deploy (só leitura):**
   - as 13 ligações aparecem bloqueadas por "sem telefone definido";
   - `GET /api/tasks?status=suspended` responde e vem vazio;
   - canais `planned`.
6. **Telefones das 13 ligações:**
   - Simulação: `node --use-system-ca scripts/atualizar-telefones-ligacoes.mjs docs/implementation/descoberta-milho-indiara/telefones-ligacoes-l0.json --base https://eag-compass-production.rogeriopalhari23.workers.dev`.
   - Resultado esperado: **7 a definir, 6 pendentes, 0 problemas**, e **sem** o aviso de Worker antigo.
   - Aplicação: o mesmo comando com `--apply`. Cada tarefa ganha uma revisão, e o histórico registra `phone` e `phone_source` com o motivo.
   - Conferir: as 7 sem bloqueio de telefone (seguem aguardando a T11 pela linha "ANTES DE LIGAR") e as 6 com a pendência.
7. **Registrar** em `EVIDENCIAS.md` a versão publicada, a migração e o resultado do passo 6.

## Simulação contra a produção (06/10/2026, só leitura, Worker atual)

| Unidade | Tarefa (rev) | Telefone | Fonte | Divergências / pendência | Ação |
|---|---|---|---|---|---|
| Cargill — Uberlândia | e6747f59 (1) | +55 34 3218-4900 | cargill.com.br/localidades (06/10/2026) | nenhuma | definir |
| São Martinho — Boa Vista | f3e7e383 (2) | +55 64 3615-9700 | saomartinho.com.br, Negócios & Unidades (06/10/2026); geral da unidade | nenhuma | definir |
| Cargill Bioenergia — São Francisco | 879acd70 (1) | +55 64 3615-9500 | cargill.com.br/localidades (06/10/2026) | nenhuma | definir |
| Nutrir — Itaberaí | 9f489696 (2) | +55 62 3375-2464 | cadastro da Receita (GuiaPJ, 09/2026); cadastral, não verificado como comercial | nenhuma | definir |
| Rações VR — Orizona | fff3d487 (2) | +55 64 3474-1528 | cadastro da Receita (GuiaPJ, 08/2026); cadastral | nenhuma | definir |
| Rei do Milho — Inhumas | 247bad11 (2) | +55 62 3514-1751 | reidomilho.com.br/site/contatos.php (06/10/2026) | nenhuma | definir |
| Caramuru — Itumbiara | 8b4bd935 (2) | +55 64 3404-0200 | cadastro da Receita da matriz (GuiaPJ, 09/2026); cadastral | filiais do complexo com outros números, de outras atividades | definir |
| Cimilho | 55770872 (1) | — | — | site publica (34) 3213-4242 e 3213-4251 | **pendente: escolher o número** |
| Rural Forte — Pontalina | 73eeb92f (2) | — | — | único número é celular do cadastro | **pendente: decisão O5** |
| Super-Bovi — Goianápolis | eb02c35d (2) | — | — | celulares divergentes (Receita x diretório) | **pendente: decisão O5** |
| Sociagro — Paraúna | d7f9f5b6 (2) | — | — | (64) 3556-1969 e 3556-1350; local da fábrica a conciliar | **pendente: escolher o número** |
| Ração Ituiutaba | 3fc79395 (2) | — | — | (34) 3268-2327 (Receita) x 3268-2108 (diretório) | **pendente: escolher o número** |
| BRF — Rio Verde | 2ad6c4a7 (2) | — | — | sem telefone da unidade; o da Receita é do centro tributário em SC | **pendente: localizar canal** |

**Teste do caminho de aplicação no ambiente local, com o Worker novo:**
- 3 tarefas atualizadas: revisão 2 e histórico gravado.
- Repetir o script mostrou "já definido".
- Uma tarefa foi suspensa porque o número estava suprimido na base local (supressão fictícia de teste). Isso mostra a trava funcionando.

## Reversão

- **Worker:** `npx wrangler rollback 9866c2c3-0f48-427c-bcbf-7366daa30597`. É compatível com o banco migrado (verificado). Limitações enquanto estiver revertido:
  - ele não confere supressão por telefone nas ligações;
  - não lista as suspensas;
  - não mostra o telefone.
  - Como as ligações aguardam a T11 e os canais seguem `planned`, nenhum contato depende disso.
- **Telefones definidos no passo 6:** desfazer por tarefa com a edição auditada (`phone: null` e motivo). O histórico guarda os dois valores. Não apagar o histórico.
- **Banco:** a 0034 só acrescenta e não precisa ser desfeita para o Worker antigo funcionar. Último recurso, que perde as gravações posteriores:
  - restaurar o backup do passo 2;
  - ou usar o Time Travel do D1: `npx wrangler d1 time-travel restore eag_compass --timestamp=<antes da migração>`.

## Dependência de teste de interface

- Playwright 1.63.0 instalado **fora do projeto**, em `%LOCALAPPDATA%\eag-compass-qa`, sem baixar navegador, como prevê o README.
- Para rodar: `EAG_PLAYWRIGHT_PATH=%LOCALAPPDATA%\eag-compass-qa\node_modules\playwright`, `EAG_CHROMIUM_EXECUTABLE=` o Chrome do sistema, e `npm run test:ui`.
- Nenhuma dependência do projeto foi atualizada.
