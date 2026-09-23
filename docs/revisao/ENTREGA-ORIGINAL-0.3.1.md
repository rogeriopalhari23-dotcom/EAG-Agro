# EAG Compass — Pacote para revisão técnica

**Gerado em:** 2026-09-23 01:47 (-04:00), a partir da pasta de trabalho `C:\Users\Roger\eag-compass`.
**Conferência de integridade:** `MANIFESTO-SHA256.txt` (um hash por arquivo deste pacote).

---

## 1. Versão entregue

| Item | Valor |
| --- | --- |
| Branch | `v2-planejamento` |
| Último commit (`HEAD`) | `a1a08d3808463931c340c8c0b5f0bd00f0a14822` — 2026-09-23 01:35:29 -0400 — "docs: planejamento EAG Compass v2.0 (Fases 3–6)" |
| Remoto | `https://github.com/rogeriopalhari23-dotcom/EAG-Agro.git` |
| Versão do produto (`package.json`) | `0.3.1` |

**Atenção — o pacote NÃO corresponde a nenhum commit.** O código em uso (0.3.1) nunca foi commitado:

- Em `HEAD` estão arquivos de um esqueleto anterior em TypeScript (`src/index.ts` com 24 linhas, `tsconfig.json`, `wrangler.toml`, `migrations/0001_init_schema.sql`, `.github/workflows/deploy.yml`). Na pasta de trabalho eles estão **apagados**.
- Os arquivos do código real estão **não rastreados**: `src/worker.js`, `src/scoring.js`, `wrangler.jsonc`, `migrations/0001_initial.sql`, `migrations/0002_seed_configuration.sql`, `public/`, `scripts/`, `tests/`, `.github/workflows/ci.yml`, `.openai/`, `PROGRESSO.md`, `.env.example`.
- Modificados e não commitados: `.gitignore`, `README.md`, `package.json`, `package-lock.json`.
- Os documentos (`docs/`, `design/`) estão commitados em `a1a08d3`.

A referência exata desta versão é o `MANIFESTO-SHA256.txt`.

**Outra versão existente, não incluída:** `Desktop\Downloads\eag-compass-mvp-0.3.2-clean.zip` (0.3.2: `worker.js` maior e `migrations/0003_seed_initial_pipeline.sql`, sem `public/`). Não foi comparada com a 0.3.1. O planejamento a trata como "comparação técnica pendente".

## 2. Conteúdo do pacote

| Pasta/arquivo | Conteúdo |
| --- | --- |
| `src/worker.js` | API (Worker nativo, sem framework): rotas, identidade, RBAC, criptografia de contatos, auditoria, fila e cron |
| `src/scoring.js` | Potential, Confidence, Risk/Coverage, Completude, gate de qualificação, sanções, matriz de perfis |
| `public/index.html` | Interface 0.3.1 (arquivo único; modo demonstração quando não há API) |
| `migrations/` | Esquema D1 (0001) e parâmetros iniciais (0002) |
| `tests/scoring.test.mjs` | 14 cenários de aceite (AT1–AT14 da Spec v1.3) |
| `scripts/` | Build do `dist/` e validação do artefato |
| `wrangler.jsonc`, `package.json`, `package-lock.json`, `.github/workflows/ci.yml` | Configuração |
| `.openai/hosting.json` | Resto da hospedagem anterior (IDs lógicos de binding; sem credencial) |
| `.mcp.json` | Configuração de ferramenta de sessão do Claude (servidor `mcp-brasil`); não faz parte do app |
| `.env.example` | **Somente nomes** das variáveis |
| `docs/eag-compass-spec.md`, `docs/eag-compass-constituicao.md` | **Spec v2.0 e Constituição v2.0 vigentes** (aprovadas em 2026-09-22, com revisões pós-aprovação) |
| `docs/` (demais) | Escopo, perfil, benchmark, pesquisa técnica, design, T6, T12, status; planos em `docs/superpowers/plans/`; histórico (v1.3 e rascunhos v2.0) em `docs/historico/` |
| `docs/revisao/codigo-completo-2026-09-23.md` | Documento anterior com o código transcrito; os arquivos reais deste pacote prevalecem |
| `design/fase5/` | Protótipos HTML e capturas da Fase 5 |

**Excluídos:** `node_modules/`, `dist/` (gerado), `.wrangler/` (estado local do D1/KV/R2), `.firecrawl/` (cópias de páginas raspadas), `.claude/` (configuração local), `.git/`, `.dev.vars`, `.env`.

**Varredura de segredos:** nenhuma chave, token ou senha encontrada nos arquivos incluídos. **Dados pessoais presentes nos documentos:** e-mail comercial e e-mail pessoal de Rogério, telefone em `docs/eag-compass-planejamento-status.md` e no histórico, e endereços fictícios de teste.

## 3. Estado do produto

### Funciona (verificado localmente em 2026-09-23)

- `npm ci` (0 vulnerabilidades) e `npm test`: 14/14.
- Servidor local (`npm run dev`) e rotas conferidas:
  - `GET /api/health` → 200;
  - `GET /api/session`;
  - `GET /api/dashboard`;
  - `POST /api/companies` → cria como `discovered`;
  - `GET /api/companies`;
  - `POST /api/companies/:id/qualify` → 409 com a lista de pendências do gate;
  - `GET /` → interface (200, 71 KB).
- RBAC por rota: usuário com perfil Auditor (`x-eag-user` + `x-eag-role`, apenas em modo local) recebe 403 ao criar empresa.
- Contato sem `PII_ENCRYPTION_KEY` é recusado (`pii_key_unavailable`), sem gravar em texto aberto.
- Esquema D1: executado integralmente no SQLite do Node (`node:sqlite`): 20 tabelas, `integrity_check = ok`.

### Incompleto

- **Sanções:** tabelas existem; nenhuma lista importada; nenhuma rota de triagem.
- **Fila e cron:** o consumidor só confirma mensagens; o cron só grava um marcador no KV.
- **Não implementado:** validação de evidências, verificação de contatos (`contact_verifications`) e aprovação de parâmetros pela API.
- **Interface:** várias telas são demonstrativas (compliance, dados, e-mails, planejamento).
- **Central de e-mails:** só rascunho; nenhum envio.
- **Autenticação de produção:** não há validação de token do Cloudflare Access (ver §6, D1).

### Só planejamento (nenhuma linha implementada)

Toda a v2.0: catálogo, Radar Nacional, País Primeiro, campanhas, fichas versionadas, sequências e envio, respostas, supressão, pausas, dashboards v2, migração OpenClaw. Planos em `docs/superpowers/plans/`: 2026-09-22 Fundação, 2026-09-22 Piloto Nacional, 2026-09-23 Internacional. Nenhuma tarefa marcada como concluída.

## 4. Comandos

Requisitos: Node.js 24 (verificado com 24.15.0) e npm (11.12.1).

```bash
npm ci
npm test
npm run db:migrate:local
npm run dev
```

- `npm run dev` roda o build (`predev`) e depois `wrangler dev --local`. Rodar `npx wrangler dev` direto falha porque `dist/` ainda não existe.
- Para contatos locais, criar `.dev.vars` com `PII_ENCRYPTION_KEY` (32 bytes em Base64); ver `.env.example`.
- `npm run check` = sintaxe + testes + build + validação do artefato (ver §7: falha no Windows).
- Observado nesta máquina: `wrangler d1 ... --local` falhou com "internal error" ao rodar a partir de uma pasta temporária (até com `SELECT 1`) e funcionou no diretório do projeto. É problema de ambiente, não do SQL.

## 5. Cloudflare — o que está em uso de fato

| Recurso | Declarado no `wrangler.jsonc` | Na conta (consulta de 2026-09-23, somente leitura) |
| --- | --- | --- |
| Worker `eag-compass` | Sim, com Static Assets | **Não publicado** ("This Worker does not exist on your account") |
| D1 `eag-compass-db` | Sim, `database_id: LOCAL_REPLACE_AFTER_CREATE` | Não foi possível listar: token sem permissão (erro 10000) |
| R2 `eag-compass-files` | Sim | Não foi possível listar (erro 10000). A pesquisa técnica registra R2 "não habilitado" |
| KV `CACHE` | Sim, `id: LOCAL_REPLACE_AFTER_CREATE` | Nenhum namespace |
| Queues `eag-compass-async` + DLQ | Sim | Não existem. Existem `eag-sanctions-queue` e `eag-scores-queue` (criadas em 2026-09-22), sem produtores nem consumidores e não referenciadas pelo código |
| Cron `17 2 * * *` | Sim | Só existe se o Worker for publicado |

**Custo real hoje:** nenhum custo medido — nada publicado. O plano da conta (Free ou Paid) não pôde ser lido: o token não tem permissão de billing.
**Custo estimado no planejamento (a validar, não medido):** Workers Paid US$ 5/mês; Casa dos Dados R$ 29,90–59,90/mês; LocationIQ ~US$ 45/mês, se necessário (`docs/eag-compass-pesquisa-tecnica.md` §7.7).

## 6. Divergências conhecidas: código × Spec v2.0 × Constituição v2.0

O código implementa a **Spec v1.3**. A Spec v2.0 e a Constituição v2.0 já estão aprovadas; os Módulos 10–28 da Spec v2.0 não têm código.

| # | Divergência | Evidência | Documento |
| --- | --- | --- | --- |
| D1 | **Identidade por cabeçalho sem verificação.** `getActor` confia em `oai-authenticated-user-*` e `cf-access-authenticated-user-email` sem validar token. Com `ENVIRONMENT=local`, qualquer e-mail vira `admin`. **O `wrangler.jsonc` fixa `ENVIRONMENT: "local"` em `vars`, sem ambiente de produção separado.** | Teste local: cabeçalho `cf-access-authenticated-user-email: qualquer@externo.com` → `role: admin`. `src/worker.js` 59–83; `wrangler.jsonc` 11–14 | Constituição P7; Spec R9.2; pesquisa técnica G5 (Access + `ctx.access`) |
| D2 | Identidade local fixa: sem `x-eag-user`, o ator é `admin@local.eag` (semeado como admin), e `x-eag-role` é ignorado para ele. O AT14 testa só a função `canPerform`, não as rotas. | `src/worker.js` 63–80; `migrations/0002` | Spec R9.2 / AT14 |
| D3 | Commodities limitadas a açúcar e café (CHECK no banco e validação na API). | `migrations/0001_initial.sql` 99; `src/worker.js` 231; teste: `soy` → 422 | Spec v2.0 Módulo 10 (catálogo) |
| D4 | `buyer_type` com 3 valores por empresa; gate exige `final_buyer` para todos (bloqueia intermediário, AT12). | `migrations/0001` 29; `src/scoring.js` 114 | Spec v2.0 Módulo 14 (4 classes por empresa + unidade + produto); escopo rev. 3 |
| D5 | Pontuação v1.3: mínimo de 500 fixo para açúcar; tabela relativa só para café; Confidence baseada em evidência de importação. | `src/scoring.js` 10–34, 58–72 | Spec v2.0 §6.1 DS1 (pontuação nacional) |
| D6 | Pipeline como pré-requisito implícito; não há ficha, sequência, envio, supressão nem pausa. | — | Spec v2.0 §1.2 e Módulos 18–22; Constituição P11–P13 |
| D7 | Build e validação voltados à hospedagem anterior: `dist/server/*`, `dist/drizzle/`, `.openai/hosting.json`. O `wrangler.jsonc` usa `main: src/worker.js` e assets em `dist/`. | `scripts/build-site.mjs`, `scripts/validate-site.mjs` | Constituição P19 (Cloudflare-first); Plano Fundação T2 |
| D8 | Nomes de fila divergentes entre código e conta (ver §5). | — | Plano Fundação T3/T12 |
| D9 | README e PROGRESSO descrevem 0.3.1/v1.3; não mencionam v2.0. | — | — |
| D10 | Contatos descriptografados um a um em laço sequencial; lista limitada a 200 sem paginação. | `src/worker.js` 147, 131 | Spec v2.0 R11 (radar mostra todos os candidatos, com paginação) |

A lista não é exaustiva: é o que foi verificado nesta preparação. O objetivo da revisão é justamente ampliá-la.

## 7. Resultado dos testes (executados em 2026-09-23)

| Comando | Resultado |
| --- | --- |
| `npm ci` (cópia limpa) | OK, 0 vulnerabilidades |
| `npm test` | **14 testes, 14 passaram, 0 falharam** (AT1–AT14, só funções de `scoring.js`) |
| `npm run check` | **Falhou.** `node --check` e testes OK; `build:site` OK; `validate:site` quebrou com `ERR_UNSUPPORTED_ESM_URL_SCHEME` (Windows): linha 8 faz `import()` de caminho absoluto `C:\...` sem `file://`. Consequência: `npm run deploy` (`predeploy`) também falha nesta máquina. No Linux (CI) não foi executado. |
| CI do GitHub (`.github/workflows/ci.yml`) | **Não executado** nesta verificação |
| Testes de integração das rotas | **Não existem.** As chamadas do §3 foram manuais (curl), no servidor local |
| Migração no D1 remoto / publicação | **Não executados** |
