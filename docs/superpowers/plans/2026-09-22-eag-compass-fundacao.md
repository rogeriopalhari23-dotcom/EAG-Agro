> **Revisão consolidada:** executar a fila `docs/implementation/sequence.json` e aplicar `docs/revisao/CORRECOES-DOS-PLANOS.md`. O código atual já substitui exemplos antigos; não sobrescrevê-lo com os snippets deste plano.

# EAG Compass v2.0 — Plano 1: Fundação (Etapa 0) — Implementation Plan

> **Revisão técnica 23/09/2026:** ler `../../revisao/CORRECOES-DOS-PLANOS.md` e `../../revisao/RELATORIO.md` antes de executar. Contratos corrigidos de migração, concorrência, envio e escopo prevalecem sobre os exemplos históricos abaixo; tarefas futuras não foram marcadas como implementadas.
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a base 0.3.1 pronta para a v2.0: testes de Worker de verdade, login seguro pelo Cloudflare Access, esquema de dados v2 (catálogo, campanhas, supressão, pausas), scores v2 (DS1), parâmetros aprovados, interface Talhão e o Worker publicado na conta de Rogério — **sem nenhum contato externo** (Etapa 0 do escopo).

**Architecture:** Um único Worker JS (ES modules) serve a interface estática (Workers Static Assets) e a API `/api/*`. Dados no D1 (`eag_compass`), arquivos no R2, cache no KV, trabalho assíncrono em Queues e rotinas em Cron. Login pelo Cloudflare Access na frente do `workers.dev`; o Worker **valida o JWT do Access** (`Cf-Access-Jwt-Assertion`) e resolve o perfil no D1. Nenhum framework novo.

**Tech Stack:** Cloudflare Workers (JS), D1, R2, KV, Queues, Cron Triggers, Static Assets, Cloudflare Access; `jose` (validação do JWT); `vitest@^4.1.0` + `@cloudflare/vitest-plugin` (testes de Worker); `node --test` (testes puros existentes); `wrangler` 4.x.

**Spec:** `docs/eag-compass-spec.md` (v2.0 + revisões pós-aprovação 1–3) · **Constituição:** `docs/eag-compass-constituicao.md` · **Stack:** `docs/eag-compass-pesquisa-tecnica.md` §11 · **Design:** `docs/eag-compass-design.md` + `design/fase5/compass-prototipo.html`

**Planos irmãos:** Plano 2 — Piloto Nacional (Radar, fichas, envio SMTP, respostas IMAP, tarefas; Etapa 1) e Plano 3 — Internacional (Etapa 3) virão depois deste. Este plano **não** envia e-mail, **não** consulta fontes externas de empresas e **não** implementa fichas/sequências.

---

## Global Constraints

- **Cloudflare-first (P19):** toda camada nesta fase é Cloudflare. Única exceção aprovada: envio SMTP pela Hostinger (Plano 2). Nenhum outro serviço externo entra neste plano.
- **Mono-tenant EAG:** `tenant_id = 'eag-internal'` em toda tabela de negócio; toda query filtra por `tenant_id` resolvido **no servidor** (do usuário autenticado), nunca de URL/corpo/cabeçalho do cliente.
- **Perfis fixos (R9.2):** `admin`, `commercial_manager`, `seller_analyst`, `auditor_viewer`. Rogério é `admin`.
- **Moeda (R3.1.4):** USD é a moeda-base; BRL só com taxa, fonte e data.
- **Nada inventado (P1, P5):** dado desconhecido fica desconhecido (intervalo/pendência), nunca valor presumido. **Nenhum valor padrão em código para parâmetro de negócio** (ex.: mínimo de açúcar) — parâmetros vêm do D1 (R7.1.1).
- **`audit_log` só aceita inserção** e não guarda PII em claro (R8.1.1).
- **PII de contato** criptografada com AES-GCM (`PII_ENCRYPTION_KEY`, 32 bytes base64) — mecanismo existente preservado.
- **Supressão** guarda só identificador derivado (HMAC-SHA-256 com `SUPPRESSION_HMAC_KEY`), nunca o e-mail/telefone em claro (R9.1.1, R21.1).
- **Textos da interface em português do Brasil**; dados de exemplo sempre rotulados como fictícios.
- **Nenhum contato externo** neste plano (Etapa 0). Nenhum e-mail, nenhuma chamada a API de terceiros.
- **Commits:** mensagens em português, prefixos `feat:`, `fix:`, `test:`, `chore:`, `docs:`; um commit por tarefa no mínimo.

### Portões (estado exigido ao fim de CADA tarefa)

| Portão | Comando exato | Linha de base medida em 2026-09-22 | Estado exigido |
| --- | --- | --- | --- |
| Testes puros | `npm run test:unit` | 14 passam (`node --test tests/*.test.mjs`, hoje via `npm test`) | 100% passando |
| Testes de Worker | `npm run test:worker` | não existe (0) | 100% passando |
| Checagem completa | `npm run check` | **FALHA no Windows** (`ERR_UNSUPPORTED_ESM_URL_SCHEME` em `scripts/validate-site.mjs`) | passando a partir da Tarefa 2 |
| Migrações locais | `npx wrangler d1 migrations apply eag_compass --local` | 0001–0002 aplicadas | todas aplicadas, sem erro |

**Regra do relatório:** toda tarefa termina com uma seção `## Portões` no relatório, uma linha por comando, com a contagem **antes** e **depois** (ex.: `npm run test:unit — antes 14/14, depois 22/22`).

**Regra do erro herdado:** portão vermelho herdado não vira "ruído de fundo". Se um erro já existente não puder ser corrigido na tarefa, ele é listado no relatório com dono (tarefa do plano) e prazo; uma tarefa **não** pode declarar "são os mesmos erros de antes" sem listar cada erro, item a item, antes e depois.

---

## Review Focus

1. **Requisição sem o cabeçalho do Access (ou com JWT forjado/expirado/de outro app)** — deve responder 401 em toda rota `/api/*` exceto `/api/health`; nunca cair em "usuário local". Teste na Tarefa 4.
2. **Primeiro acesso com banco vazio** — só o e-mail em `BOOTSTRAP_ADMIN_EMAIL` vira admin; qualquer outro e-mail autenticado pelo Access recebe 403. Teste na Tarefa 4.
3. **Migração 0003 aplicada sobre banco com dados da 0.3.1** (demandas `sugar`/`coffee` existentes) — os dados sobrevivem à recriação de `demands`. Teste na Tarefa 5.
4. **Duas pessoas editando a mesma campanha** — a segunda gravação recebe 409, sem sobrescrever (R23.3). Teste na Tarefa 9.
5. **Mesmo e-mail suprimido duas vezes / reimportado com caixa diferente** — continua uma entrada só e continua suprimido (R21.5). Teste na Tarefa 10.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa dona |
| --- | --- | --- |
| `src/worker.js` | Roteamento, handlers existentes (modificado) | T4, T7–T10 |
| `src/http.js` | `response`, `apiError`, `ApiException`, `bodyJson` com limite de tamanho, `requireFields`, `assertSameOrigin` | T4 |
| `src/auth.js` | `verifyAccessJwt`, `getActor` | T4 |
| `src/scoring.js` | Motor de scores v2 (modificado) | T6 |
| `src/catalog.js` | Leitura/regras do catálogo | T7 |
| `src/parameters.js` | Leitura e alteração versionada de parâmetros | T8 |
| `src/campaigns.js` | Campanhas, ICP, declarações, limite de ativas | T9 |
| `src/suppression.js` | HMAC de identificadores, supressão, pausas | T10 |
| `migrations/0003_v2_fundacao.sql` | Esquema v2 da fundação | T5 |
| `migrations/0004_seed_catalogo.sql` | 28 itens do catálogo | T7 |
| `migrations/0005_seed_parametros_v2.sql` | Parâmetros aprovados na v2.0 | T8 |
| `vitest.config.mjs`, `test/apply-migrations.mjs` | Harness de testes de Worker | T2 |
| `test/*.test.mjs` | Testes de Worker (vitest) | T2, T4–T10 |
| `tests/scoring.test.mjs` | Testes puros (node --test), modificado | T6 |
| `scripts/build-site.mjs`, `scripts/validate-site.mjs` | Build e validação (modificados) | T2, T11 |
| `public/index.html` | Interface Talhão | T11 |
| `wrangler.jsonc` | Bindings e variáveis | T3 |
| `.github/workflows/deploy.yml` | Deploy (recriado) | T12 |
| `docs/eag-compass-provisionamento.md` | Registro do provisionamento real | T12 |

---

## Recursos nomeados

Todo nome global abaixo tem **um** dono. Tarefas consomem desta lista; precisou de nome novo, a tarefa para e pede alocação.

| Recurso | Nome | Dono |
| --- | --- | --- |
| Migração | `0003_v2_fundacao.sql` | T5 |
| Migração | `0004_seed_catalogo.sql` | T7 |
| Migração | `0005_seed_parametros_v2.sql` | T8 |
| Migrações futuras | `0006_*` em diante | **Reservadas ao Plano 2** |
| Tabela nova | `products`, `product_codes`, `product_characteristics` | T5 |
| Tabela nova | `campaigns`, `campaign_icp`, `campaign_declarations` | T5 |
| Tabela nova | `suppression_entries`, `pauses` | T5 |
| Tabela recriada | `demands` (sem CHECK de commodity; com `product_id`, `market`) | T5 |
| Tabela existente | `parameters` (novas chaves) | T8 |
| Rota | `GET /api/health`, `GET /api/session` | T4 |
| Rota | `GET /api/catalog`, `GET /api/catalog/:id` | T7 |
| Rota | `GET /api/parameters`, `PUT /api/parameters/:key` | T8 |
| Rota | `GET/POST /api/campaigns`, `GET/PATCH /api/campaigns/:id`, `POST /api/campaigns/:id/activate`, `POST /api/campaigns/:id/declarations` | T9 |
| Rota | `GET/POST /api/suppression`, `GET/POST /api/pauses`, `POST /api/pauses/:id/resume` | T10 |
| Binding | `DB` (D1 `eag_compass`), `FILES` (R2 `eag-compass-files`), `CACHE` (KV), `ASYNC_QUEUE` (Queue `eag-compass-async`), `ASSETS` | T3 |
| Fila | `eag-compass-async`, DLQ `eag-compass-async-dlq` | T3 (config), T12 (criação) |
| Var | `ENVIRONMENT` (`local`/`production`), `DEFAULT_TENANT_ID` (`eag-internal`), `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | T3 |
| Secret | `PII_ENCRYPTION_KEY` (existente), `BOOTSTRAP_ADMIN_EMAIL`, `SUPPRESSION_HMAC_KEY` | T4 / T10 (uso), T12 (valor em produção) |
| Test binding | `TEST_MIGRATIONS`, `MIGRATION_TEST_DB` | T2 |
| Versão de fórmula | `SCORE_VERSION = "2.0.0"` | T6 |

---

## Tarefa 1: Linha de base no git (decisão de Rogério)

**Requisito:** infra (sem R<n>) — resolve a pendência "Git: destino da troca da base 0.3.1".

**Contexto:** a árvore de trabalho tem a base 0.3.1 descompactada por cima do projeto TypeScript antigo, sem commit (C14). Nada deste plano pode ser commitado sem essa decisão.

- [ ] **Passo 1: Portão humano.** Mostrar a Rogério `git status --short` e perguntar: *"Posso criar a branch `v2-fundacao` e registrar a base 0.3.1 como está (inclui a remoção de `deploy.yml`, `src/index.ts`, `tsconfig.json`, `wrangler.toml` e `migrations/0001_init_schema.sql`, que continuam no commit `4edff05`)?"* Sem "sim" explícito, **parar o plano**.
- [ ] **Passo 2:** `git checkout -b v2-fundacao`
- [ ] **Passo 3:** conferir que `.gitignore` cobre `node_modules/`, `.wrangler/`, `dist/`, `.env`, `.dev.vars`, `.firecrawl/`; se faltar, acrescentar.
- [ ] **Passo 4:** `git add -A && git commit -m "chore: registra base 0.3.1 e documentos de planejamento v2.0"`

**Defesas (5g):** rota pública — não se aplica (sem código); saída com dado de usuário — não se aplica; CSRF — não se aplica; cookie/sessão — não se aplica; campo opcional — não se aplica; exclusão permanente — não se aplica (nada é apagado: arquivos removidos seguem no commit `4edff05`); config de teste — não se aplica.
**Verificação:** manual — `git log --oneline -2` mostra o novo commit sobre `38eea61`; `git status` limpo.

---

## Tarefa 2: Harness de testes e checagem funcionando no Windows

**Requisito:** infra (sem R<n>) — viabiliza P20 (testes antes de cada módulo).

**Files:**
- Modify: `scripts/validate-site.mjs`, `scripts/build-site.mjs`, `package.json`, `.gitignore`
- Delete: `.openai/hosting.json` (C5 — hospedagem é Cloudflare)
- Create: `vitest.config.mjs`, `test/apply-migrations.mjs`, `test/smoke.test.mjs`

**Contrato:**
- `scripts/validate-site.mjs`: importar o módulo com `pathToFileURL(resolve(root, "server/index.js")).href` (`node:url`), em vez de caminho absoluto (causa do `ERR_UNSUPPORTED_ESM_URL_SCHEME` no Windows). Remover a checagem de `.openai/hosting.json` e dos bindings do manifesto OpenAI; remover a exigência de `drizzle/0000_initial.sql`. Marcadores de interface: ver T11 (esta tarefa mantém os marcadores atuais).
- `scripts/build-site.mjs`: parar de copiar `.openai/` e de gerar `dist/drizzle` e `dist/server` (o Worker é servido por `main`, não de `dist`). `dist/` passa a conter **só** os assets estáticos (`index.html` e, na T11, `app.css`/`app.js`).
- `package.json` scripts (nomes exatos):
  - `"test:unit": "node --test tests/*.test.mjs"`
  - `"test:worker": "vitest run"`
  - `"test": "npm run test:unit && npm run test:worker"`
  - `"check": "node --check src/worker.js && node --check src/scoring.js && npm run test && npm run build:site && npm run validate:site"`
- devDependencies: `vitest@^4.1.0`, `@cloudflare/vitest-plugin@^1.0.0`; dependencies: `jose@^6` (usada na T4; instalar aqui para fixar o lockfile uma vez).
- `vitest.config.mjs` — **copiado da doc oficial** (`https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/`, seção `readD1Migrations`, consultada em 2026-09-22), adaptado só no caminho e na extensão:

```js
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrationsPath = path.join(import.meta.dirname, "migrations");
      const migrations = await readD1Migrations(migrationsPath);
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations }, d1Databases: ["MIGRATION_TEST_DB"] },
      };
    }),
  ],
  test: { include: ["test/**/*.test.mjs"], setupFiles: ["./test/apply-migrations.mjs"] },
});
```

  **Adaptação registrada:** `d1Databases: ["MIGRATION_TEST_DB"]` acrescenta um segundo D1 **não migrado pelo setup** (opção `miniflare` documentada em "Write your first test", que remete ao `WorkerOptions` do Miniflare). Usado só pelo teste de migração da T5.

  **Contradição documentada:** a mesma página diz que `readD1Migrations` é "Exported from `@cloudflare/vitest-plugin/config`", mas o exemplo importa de `@cloudflare/vitest-plugin`; a página de API de testes repete `/config`. **Decisão:** usar o import do exemplo; se o build falhar com "is not exported", trocar para `@cloudflare/vitest-plugin/config` e registrar no relatório qual funcionou. Nenhuma outra linha depende disso.
- `test/apply-migrations.mjs`: `import { applyD1Migrations } from "cloudflare:test"; import { env } from "cloudflare:workers"; await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);` — assinatura `applyD1Migrations(db, migrations, migrationTableName?)` conforme `https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/` (seção D1). Import de `env` de `cloudflare:workers` conforme o guia de migração Vitest 4 ("Replace all `import { env, SELF } from "cloudflare:test"` with `import { env, exports } from "cloudflare:workers"`").
- Invocar o Worker nos testes com `import { exports } from "cloudflare:workers"; await exports.default.fetch(request)` (doc "Migrate from unstable_dev").
- Isolamento: armazenamento isolado **por arquivo de teste** (doc "Migrate from Vitest 3 to 4"). Nenhum teste pode depender de dados criados em outro arquivo.

**Intenções de teste (`test/smoke.test.mjs`):**
- *health responde sem autenticação* — `GET /api/health` → 200 e `body.status === "ok"`. **Falha se:** a rota passar a exigir o Access ou o roteamento de `/api/*` quebrar.
- *migrações aplicadas no D1 de teste* — `SELECT name FROM sqlite_master WHERE name='audit_log'` retorna 1 linha. **Falha se:** o setup deixar de chamar `applyD1Migrations` ou o binding `TEST_MIGRATIONS` não for injetado.

**Comandos:** `npm install -D vitest@^4.1.0 @cloudflare/vitest-plugin@^1.0.0 && npm install jose@^6` · `npm run check`
**Defesas (5g):** rota pública — `/api/health` já é pública e só devolve status/versão, sem dado; saída com dado de usuário — não se aplica; CSRF — não se aplica (GET); cookie — não se aplica; campo opcional — não se aplica; exclusão — `.openai/hosting.json` removido fica no git; config de teste — copiada da doc citada acima.
**Commit:** `chore: harness de testes de Worker e checagem no Windows`

---

## Tarefa 3: `wrangler.jsonc` alinhado à conta

**Requisito:** infra (sem R<n>) — alinha a configuração à auditoria da conta (Fase 4 §1).

**Files:** Modify `wrangler.jsonc`, `.env.example`

**Contrato (valores exatos):**
- `d1_databases[0]`: `binding: "DB"`, `database_name: "eag_compass"` (**reaproveita o D1 existente e vazio**, decisão G6 parcial), `database_id: "<preencher na T12>"`, `migrations_dir: "migrations"`.
- `r2_buckets[0]`: `binding: "FILES"`, `bucket_name: "eag-compass-files"`.
- `kv_namespaces[0]`: `binding: "CACHE"`, `id: "<preencher na T12>"`.
- `queues.producers[0]`: `binding: "ASYNC_QUEUE"`, `queue: "eag-compass-async"`; `queues.consumers[0]`: `queue: "eag-compass-async"`, `max_batch_size: 10`, `max_batch_timeout: 5`, `max_retries: 3`, `dead_letter_queue: "eag-compass-async-dlq"` (mantidos da 0.3.1).
- `vars`: `ENVIRONMENT: "local"`, `DEFAULT_TENANT_ID: "eag-internal"`, `ACCESS_TEAM_DOMAIN: ""`, `ACCESS_AUD: ""` (preenchidos por ambiente na T12).
- `compatibility_date`: manter `"2026-09-21"`.
- `assets`: manter `directory: "./dist"`, `binding: "ASSETS"`, `run_worker_first: ["/api/*"]`, `not_found_handling: "single-page-application"`.
- **Não** usar o bloco `access.dev` do wrangler: ele só simula `ctx.access`, que **não chega ao Worker quando há Static Assets** ("the router does not pass `ctx.access` to the user Worker" — `https://developers.cloudflare.com/workers/configuration/cloudflare-access/`, seção "ctx.access limitations", consultada em 2026-09-22). A autenticação local é tratada na T4.
- `.env.example` (sem valores reais): documenta `PII_ENCRYPTION_KEY`, `BOOTSTRAP_ADMIN_EMAIL`, `SUPPRESSION_HMAC_KEY` como secrets e aponta `.dev.vars` para desenvolvimento local.

**Verificação:** manual + portão — `npx wrangler d1 migrations apply eag_compass --local` aplica 0001–0002 no novo nome local; `npm run test:worker` continua verde (o vitest lê este arquivo).
**Defesas (5g):** todas "não se aplica: arquivo de configuração sem rota, saída ou dado de usuário"; config de teste — o vitest consome este arquivo via `wrangler.configPath` (citação da T2).
**Commit:** `chore: alinha wrangler.jsonc aos recursos da conta`

---

## Tarefa 4: Autenticação pelo Access com JWT validado e HTTP endurecido

**Requisito:** R9.2, R9.2.1 (servidor nega sem permissão), P7, decisão G5 (Access). Corrige o achado de segurança da Fase 4 (cabeçalhos `oai-*` forjáveis, `src/worker.js:59-83`).

**Decisão registrada (ajuste da G5):** a G5 aprovou "Access + `ctx.access`". A doc oficial diz que, com Static Assets, `ctx.access` não chega ao Worker (citação na T3). **Mantém-se o Access como camada de login; a identidade vem da validação do JWT** do cabeçalho `Cf-Access-Jwt-Assertion`, que é o caminho que a própria doc indica ("To fully secure your application, it is important that you validate the JWT that Cloudflare Access adds to the `Cf-Access-Jwt-Assertion` header" — `https://developers.cloudflare.com/changelog/post/2025-10-03-one-click-access-for-workers/`).

**Files:**
- Create: `src/http.js`, `src/auth.js`, `test/auth.test.mjs`, `test/http.test.mjs`
- Modify: `src/worker.js` (remover `getActor`, `response`, `apiError`, `ApiException`, `bodyJson`, `requireFields` locais; importar de `src/http.js` e `src/auth.js`)

**Interfaces:**
- `src/http.js`
  - `export class ApiException extends Error { constructor(status: number, code: string, message: string, details?: object) }`
  - `export function response(data: any, status = 200, headers = {}): Response` — JSON, `cache-control: no-store` (igual à 0.3.1).
  - `export function apiError(status, code, message, details?): Response`
  - `export async function bodyJson(request: Request, maxBytes = 65536): Promise<object>` — 415 se não for `application/json`; **413 `payload_too_large` se o corpo passar de `maxBytes`** (lê `request.text()` e mede `TextEncoder().encode(text).length`); 400 se JSON inválido.
  - `export function requireFields(object, fields: string[]): void` — igual à 0.3.1.
  - `export function assertSameOrigin(request: Request): void` — para `POST|PUT|PATCH|DELETE`: se o cabeçalho `Origin` existir e `new URL(origin).host !== new URL(request.url).host` → `ApiException(403, "cross_origin_blocked", "Origem não autorizada.")`. Sem `Origin` em mutação → também 403 (navegadores enviam `Origin` em POST/PUT/PATCH/DELETE com fetch).
- `src/auth.js`
  - `export async function verifyAccessJwt(token: string, env, keyResolver?): Promise<{ email: string, sub: string }>` — usa `jwtVerify(token, keyResolver ?? createRemoteJWKSet(new URL(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)), { issuer: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD })` (assinatura conferida em `/panva/jose`, docs `jwks/remote/functions/createRemoteJWKSet.md`; URL do JWKS e opções conforme exemplo oficial citado acima). Erro de verificação → `ApiException(401, "access_token_invalid", "Sessão inválida. Entre de novo pelo Access.")`. Payload sem `email` (ex.: token de serviço) → 401 `access_user_required`.
  - `export async function getActor(request: Request, env, deps?: { keyResolver? }): Promise<{ id, tenant_id, email, display_name, role }>`:
    1. Se `env.ENVIRONMENT === "local"` **e** `request.url` tem host `localhost` ou `127.0.0.1`: aceita cabeçalho `x-eag-user` (padrão `admin@local.eag`) e `x-eag-role` — comportamento de desenvolvimento da 0.3.1, agora **restrito a localhost**.
    2. Senão: exige `Cf-Access-Jwt-Assertion`; sem ele → 401 `authentication_required`. Valida com `verifyAccessJwt`.
    3. Procura usuário ativo por `tenant_id` + `lower(email)`. Encontrou → retorna.
    4. Não encontrou e **não existe nenhum usuário ativo** e `lower(email) === lower(env.BOOTSTRAP_ADMIN_EMAIL)` → cria `admin` (id `crypto.randomUUID()`, `display_name` = parte local do e-mail), grava `audit_log` `user.bootstrap_admin` sem o e-mail em claro (`new_value_json: {"role":"admin"}`), retorna.
    5. Caso contrário → 403 `user_not_authorized`.
  - Os cabeçalhos `oai-authenticated-user-*` e `cf-access-authenticated-user-email` **deixam de ser lidos**.
- `src/worker.js` → `route()`: chamar `assertSameOrigin(request)` antes de qualquer handler de mutação; `GET /api/health` continua sem autenticação.

**Fixture de teste (valores de teste inventados por necessidade; o formato segue a doc):** o teste gera um par de chaves com `generateKeyPair("RS256")` (jose), assina com `new SignJWT({ email }).setProtectedHeader({ alg: "RS256", kid: "test" }).setIssuer(TEAM).setAudience(AUD).setIssuedAt().setExpirationTime("1h")` e injeta `createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: "test", alg: "RS256" }] })` como `keyResolver`. **Citado:** nomes das claims `iss`, `aud`, `exp`, `iat`, `sub` e o campo `email` da identidade do usuário (`https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/`). **Inventado:** `TEAM = "https://eag-teste.cloudflareaccess.com"`, `AUD = "aud-teste"`, e-mails.

Para os testes chegarem à `getActor` com o resolver injetado, `test/auth.test.mjs` chama `getActor(request, env, { keyResolver })` diretamente (unidade) e um teste de rota usa `env.ENVIRONMENT = "production"` com um cabeçalho inválido para provar o 401 pela rota real.

**Intenções de teste:**
- *JWT válido de usuário cadastrado entra* — usuário `admin` inserido no D1; `getActor` com JWT válido retorna `role === "admin"`. **Falha se:** a validação usar issuer/audience errados ou a busca por e-mail ignorar `lower()`.
- *JWT com audience de outro app é recusado* — mesmo token assinado com `setAudience("outro-app")` → `ApiException` 401 `access_token_invalid`. **Falha se:** `jwtVerify` for chamado sem a opção `audience`.
- *JWT expirado é recusado* — `setExpirationTime` no passado → 401. **Falha se:** a verificação de `exp` for desligada (`clockTolerance` enorme ou decodificação sem verificar).
- *cabeçalho legado forjado não autentica* — rota `GET /api/session` em `ENVIRONMENT=production`, só com `oai-authenticated-user-email: admin@x.com` e `cf-access-authenticated-user-email` → 401. **Falha se:** qualquer cabeçalho legado voltar a ser lido.
- *atalho local não vale fora de localhost* — `ENVIRONMENT=local`, URL `https://compass.example/api/session`, `x-eag-user` presente, sem JWT → 401. **Falha se:** a checagem de host for removida do passo 1.
- *bootstrap só para o e-mail configurado* — banco sem usuários, `BOOTSTRAP_ADMIN_EMAIL="rogerio@teste.com"`: JWT de `outra@teste.com` → 403; JWT de `Rogerio@Teste.com` → cria admin (1 linha em `users`, 1 linha `user.bootstrap_admin` em `audit_log` cujo `new_value_json` **não contém** `"@"`). **Falha se:** o bootstrap aceitar qualquer primeiro usuário (comportamento da 0.3.1) ou gravar o e-mail no log.
- *bootstrap só vale com banco vazio* — já existe 1 usuário ativo (`gestor@teste.com`, `commercial_manager`) e `BOOTSTRAP_ADMIN_EMAIL="rogerio@teste.com"`, que **ainda não** está cadastrado: JWT de `rogerio@teste.com` → 403 `user_not_authorized`, e `users` continua com 1 linha. **Falha se:** a condição "nenhum usuário ativo" for removida (qualquer detentor do e-mail de bootstrap viraria admin depois da implantação).
- *perfil sem permissão é negado no servidor* — `auditor_viewer` em `POST /api/companies` → 403 `forbidden` e nenhuma linha nova em `companies`. **Falha se:** `requireRole` sair do handler.
- *mutação de outra origem é bloqueada* — `POST /api/companies` com `Origin: https://evil.example` → 403 `cross_origin_blocked`, zero linhas criadas. **Falha se:** `assertSameOrigin` não for chamado antes do handler.
- *corpo grande é recusado* — `POST /api/companies` com 70 KB → 413. **Falha se:** `bodyJson` voltar a usar `request.json()` sem medir.

**Comandos:** `npm run test:worker -- test/auth.test.mjs test/http.test.mjs` · `npm run check`
**Defesas (5g):** rota pública — só `/api/health`, sem dado; todas as outras exigem JWT; cap de entrada — `bodyJson` 64 KB; saída com dado de usuário — respostas JSON (`content-type: application/json`), sem HTML; CSRF — `assertSameOrigin` (Origin obrigatório em mutação) — **não** depende do atributo SameSite do cookie `CF_Authorization`, cujo padrão não foi verificado; cookie/sessão — a sessão é do Access; o Compass não emite cookie; campo opcional — `display_name` do bootstrap derivado quando não houver nome; exclusão — não se aplica; config de teste — fixture de JWT descrita acima.
**Commit:** `feat: autenticação por JWT do Access e endurecimento HTTP`

---

## Tarefa 5: Migração 0003 — esquema v2 da fundação

**Requisito:** R10.1, R10.3, R10.4, R10.5 (catálogo), R16.1, R16.3 (preparo), R16.7, R28.1, R28.17 (campanhas), R21.1, R9.1.1 (supressão), R22.1 (pausas), R3.1 (demanda sem commodity fixa), R23.3 (versão para conflito).

**Files:** Create `migrations/0003_v2_fundacao.sql`, `test/migracao-0003.test.mjs`

**Contrato — SQL exato (é contrato: outras tarefas dependem dos nomes e das restrições):**

```sql
PRAGMA defer_foreign_keys = true;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  group_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  origins_json TEXT NOT NULL,              -- ex.: ["SITE","SOLICITACAO"]
  source_ref TEXT,
  consulted_at TEXT,
  identity_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (identity_status IN ('confirmed','pending')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, group_name, variant_name)
);

CREATE TABLE product_codes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  code_system TEXT NOT NULL CHECK (code_system IN ('NCM','HS')),
  code TEXT NOT NULL,
  classification_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed','pending')),
  UNIQUE (product_id, code_system, code)
);

CREATE TABLE product_characteristics (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  char_key TEXT NOT NULL,
  char_value TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed','not_confirmed')),
  sample_only INTEGER NOT NULL DEFAULT 0 CHECK (sample_only IN (0,1))
);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  market TEXT NOT NULL CHECK (market IN ('national','international')),
  name TEXT NOT NULL,
  origin_city TEXT, origin_uf TEXT, radius_km INTEGER,
  country_code TEXT,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','waiting','paused','ended')),
  review_due_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK ((market='national' AND origin_city IS NOT NULL AND origin_uf IS NOT NULL AND radius_km IS NOT NULL AND country_code IS NULL)
      OR (market='international' AND country_code IS NOT NULL AND origin_city IS NULL))
);
CREATE INDEX idx_campaigns_active ON campaigns(tenant_id, market, status);

CREATE TABLE campaign_icp (
  campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id),
  user_sectors_json TEXT NOT NULL,         -- setores usuários (uso final), ex.: ["refrigerantes","balas"]
  size_target TEXT NOT NULL CHECK (size_target IN ('medium','medium_plus')),
  region TEXT NOT NULL,
  decision_role TEXT NOT NULL,
  influencer_role TEXT NOT NULL,
  supply_pains TEXT,
  buying_cycle_days INTEGER,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE campaign_declarations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  kind TEXT NOT NULL CHECK (kind IN ('volume_available','social_proof')),
  value_bool INTEGER CHECK (value_bool IN (0,1)),
  text TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','revoked')),
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  review_due_at TEXT,
  CHECK ((kind='volume_available' AND value_bool IS NOT NULL) OR (kind='social_proof' AND text IS NOT NULL))
);

CREATE TABLE suppression_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  identifier_hash TEXT NOT NULL,           -- HMAC-SHA-256 hex do identificador normalizado
  channel TEXT NOT NULL CHECK (channel IN ('email','phone','linkedin')),
  reason TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('link','reply','manual','openclaw','bounce')),
  retention_until TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, identifier_hash, channel)
);

CREATE TABLE pauses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  scope TEXT NOT NULL CHECK (scope IN ('company','campaign','commodity','offer','operation')),
  scope_ref TEXT,                          -- NULL só quando scope='operation'
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resumed_by TEXT, resumed_at TEXT, resume_reason TEXT,
  CHECK ((scope='operation' AND scope_ref IS NULL) OR (scope<>'operation' AND scope_ref IS NOT NULL))
);
CREATE INDEX idx_pauses_open ON pauses(tenant_id, scope, scope_ref) WHERE resumed_at IS NULL;

-- demands: remove o CHECK (sugar,coffee) e liga ao catálogo
CREATE TABLE demands_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  commodity TEXT NOT NULL,
  product_id TEXT REFERENCES products(id),
  market TEXT NOT NULL DEFAULT 'international' CHECK (market IN ('national','international')),
  product_variant TEXT, supplier_reference TEXT,
  currency_base TEXT NOT NULL DEFAULT 'USD',
  completeness REAL NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),
  current_state TEXT, desired_state TEXT, gap_summary TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, company_id, commodity)
);
INSERT INTO demands_new (id,tenant_id,company_id,commodity,product_id,market,product_variant,supplier_reference,currency_base,completeness,current_state,desired_state,gap_summary,created_by,created_at,updated_at)
  SELECT id,tenant_id,company_id,commodity,NULL,'international',product_variant,supplier_reference,currency_base,completeness,current_state,desired_state,gap_summary,created_by,created_at,updated_at FROM demands;
DROP TABLE demands;
ALTER TABLE demands_new RENAME TO demands;
```

**Decisão:** demandas antigas (`sugar`/`coffee` da 0.3.1) recebem `market='international'` porque a v1.3 era só importadores. Não há CASCADE nem gatilho dependente de FK: o `PRAGMA defer_foreign_keys` segue a doc (`https://developers.cloudflare.com/d1/reference/migrations/`, "Foreign key constraints").

**Intenções de teste (`test/migracao-0003.test.mjs`):**
- *demanda antiga sobrevive* — no binding `MIGRATION_TEST_DB` (vazio, criado na T2): `applyD1Migrations(env.MIGRATION_TEST_DB, env.TEST_MIGRATIONS.filter(m => m.name.startsWith("0001") || m.name.startsWith("0002")))`; inserir empresa + demanda `sugar`; aplicar a lista completa; conferir que a demanda existe com `market='international'` e o mesmo `id`. (O filtro por `name` assume o campo `name` de `D1Migration`; se o objeto usar outro nome de campo, ajustar e registrar no relatório.) **Falha se:** o `INSERT … SELECT` for omitido ou esquecer uma coluna.
- *demanda com commodity nova é aceita* — `INSERT INTO demands(... commodity='milho' ...)` passa. **Falha se:** o CHECK antigo continuar.
- *campanha nacional sem cidade é rejeitada* — insert `market='national'` com `origin_city NULL` → erro de CHECK. **Falha se:** o CHECK de campanha for afrouxado.
- *pausa de operação com scope_ref é rejeitada* — **Falha se:** o CHECK de `pauses` sumir.
- *supressão duplicada é rejeitada no banco* — dois inserts com mesmo `(tenant_id, identifier_hash, channel)` → erro UNIQUE. **Falha se:** a UNIQUE sair.

**Comandos:** `npx wrangler d1 migrations apply eag_compass --local` · `npm run test:worker -- test/migracao-0003.test.mjs`
**Defesas (5g):** rota — não se aplica; saída — não se aplica; CSRF — não se aplica; cookie — não se aplica; campo opcional — `product_id` e `market` de demandas antigas definidos acima; exclusão — `DROP TABLE demands` só após copiar; testado; config de teste — harness da T2.
**Commit:** `feat: esquema v2 da fundação (catálogo, campanhas, supressão, pausas)`

---

## Tarefa 6: Scores v2 (DS1) e gate revisado

**Requisito:** R3.3.1–R3.3.3, R4.2, R4.3.1–R4.3.6, R4.4, R5.1.1–R5.1.3, R7.2 (itens 1, 7, 9), R7.2.1, R2.4.3; cenários AT1, AT12, AT40–AT49; regressão AT2–AT11, AT13, AT14.

**Files:** Modify `src/scoring.js`, `tests/scoring.test.mjs`, `src/worker.js:259-321` (`recalculateScores`, `qualifyCompany`)

**Interfaces (assinaturas finais):**
- `SCORE_VERSION = "2.0.0"`
- `calculatePotential(input, parameters)`
  - `input`: `{ commodity, market: 'national'|'international', volumePerOperation?, operationsPerYear?, annualPotentialDirect?, specificationConfirmed?, packagingConfirmed?, readinessConditionConfirmed?, requiredDateConfirmed?, logistics?: 'inside_radius_precise'|'outside_radius'|'estimated'|'confirmed'|'not_served'|null }`
  - `parameters`: `{ minimum?: number|null }` — **sem valor padrão em código** (remove o `?? 500` de açúcar, C10/C17).
  - Regras: tabela absoluta de açúcar **só** se `market==='international' && commodity==='sugar'`; tabela relativa a `minimum` para qualquer outro caso com `minimum>0`; sem `minimum` → Volume e Anual **desconhecidos**. Logística: internacional — `'confirmed'` 5, `'not_served'` 0; nacional — `'inside_radius_precise'` 5, `'outside_radius'` 0, `'estimated'`/`null` desconhecida. `belowMinimum` = `null` quando não há `minimum`.
  - Retorno inalterado: `{ scoreMin, scoreMax, coverage, components, annualPotentialDirect, annualPotentialDerived, annualPotentialUsed, annualDivergenceAlert, belowMinimum, version }`.
- `calculateConfidence(input)`
  - `input`: `{ market, purchaseEvidence, factAgeMonths?, companyRegistry, decisionMaker, directConfirmation }` (substitui `recency` por `factAgeMonths`, número).
  - Pontos de evidência: internacional `customs_record 30, bill_of_lading 25, company_document 20`; nacional `public_nominal_record 30, commercial_document 25, company_document 20`; tipo de outro mercado → 0.
  - Atualidade calculada de `factAgeMonths` (<6 → 20; ≤12 → 15; >12 → 5) **somente se** a evidência pontuou > 0 (R5.1.3).
- `evaluateQualificationGate(context, parameters)` — `context` troca `finalBuyerConfirmed` por `{ buyerProfileConfirmed: boolean, finalBuyerRequired: boolean, finalBuyerConfirmed: boolean }`; check `final_buyer` = `buyerProfileConfirmed && (!finalBuyerRequired || finalBuyerConfirmed)`; check `minimum_volume` = `belowMinimum !== true || minimumVolumeApproval`. Nenhum check de "evidência de importação" (R7.2.1).
- `src/worker.js`:
  - Chave de commodity nos parâmetros = o texto de `demands.commodity` (legado `sugar`/`coffee`; commodities novas usam o `group_name` normalizado do catálogo, definido no Plano 2).
  - `recalculateScores`: `minimum` vem de `parameters["volume_min:<commodity>:<market>"]` e, se houver, `volume_min:<commodity>:<market>:<supplier>` (formato de chave de T8); `market` vem de `demands.market`; `factAgeMonths` da evidência válida mais recente; nacional sem evidência mapeada → `purchaseEvidence: null`.
  - `qualifyCompany`: `finalBuyerRequired` = existe `parameters["final_buyer_required:<commodity>:<market>"] === true`; `buyerProfileConfirmed` = campo `buyer_profile` da demanda com status `confirmed` (campo novo aceito pelo formulário; ver R3.1.3/R2.4.4).

**Fixtures (copiados literalmente da Spec §6.1.3 e §3):**

| Teste | Entrada (fixture) | Esperado |
| --- | --- | --- |
| AT40 / EX-CN1 | nacional, `company_document`, fato 1 mês, registro `verified_active`, decisor `title_only`, sem confirmação | 60 |
| AT41 / EX-CN2 | nacional, `public_nominal_record`, fato 14 meses, `verified_active`, `verified_authority`, `initial_response` | 80 |
| AT42 / EX-CN3 | nacional, evidência `null`, `verified_active`, decisor `null`, `initial_response` | 30 |
| AT43 / EX-CN4 | nacional, evidência `null`, `partially_verified`, resto nulo | 8 |
| AT44 / EX-CN5 | internacional, `customs_record`, fato 2 meses, `verified_active`, `verified_authority`, sem confirmação | 80 |
| AT45 / EX-PN1 | nacional, milho, `minimum 100`, 250/op, 12 op/ano, spec+embalagem, condição+data, `inside_radius_precise` | 90–90 |
| AT46 / EX-PN2 | nacional, `minimum 100`, 250/op, op/ano e anual ausentes, spec+embalagem, prontidão ausente, `estimated` | 35–90 |
| AT47 / EX-PN3 | como AT45 sem `minimum` | 50–100 |
| AT48 / EX-PN4 | `minimum 100`, 60/op, 12 op/ano, resto como AT45 | 70–70 e `belowMinimum === true` |
| AT49 / EX-PN5 | como AT45 com `outside_radius` | 85–85 |
| AT1 (revisado) | internacional, açúcar, `minimum 500`, 270/op | `belowMinimum === true`; e com `minimum null` → `belowMinimum === null` |
| AT12 (substituído) | gate: `buyerProfileConfirmed true`, `finalBuyerRequired false`, `finalBuyerConfirmed false`, demais ok | `qualified === true`; com `finalBuyerRequired true` → `pending` contém `final_buyer` |

**Intenções de teste** (em `tests/scoring.test.mjs`, `node --test`; cada linha acima vira um `test("ATnn — …")`):
- AT40–AT49 com a assertiva de valor da tabela. **Falha se:** a tabela de evidência nacional usar os tipos internacionais (AT40–42), a Atualidade pontuar sem evidência (AT42, AT43 dariam 50 e 28), a logística "estimada" contar como conhecida (AT46 daria 35–85), o mínimo não gerar `belowMinimum` (AT48).
- AT47 **Falha se:** o código voltar a presumir um mínimo quando não há parâmetro.
- AT1 par `minimum null` **Falha se:** o `?? 500` voltar.
- AT12 **Falha se:** o gate exigir comprador final para trader sem condição (comportamento v1.3).
- Regressão: AT2, AT3, AT5 continuam com os números da v1.3 (85, 85, 80) usando `market:'international'`. **Falha se:** a mudança da tabela relativa alterar açúcar internacional.

**Comandos:** `npm run test:unit`
**Defesas (5g):** rota/saída/CSRF/cookie — não se aplica (motor puro; rotas existentes mantêm a T4); campo opcional — todo campo ausente vira dimensão desconhecida, testado em AT46/AT47; exclusão — não se aplica; config de teste — `node --test` existente.
**Commit:** `feat: scores v2 com pontuação nacional (DS1) e gate revisado`

---

## Tarefa 7: Catálogo com 28 itens e regras de identidade

**Requisito:** R10.1–R10.6.

**Files:** Create `migrations/0004_seed_catalogo.sql`, `src/catalog.js`, `test/catalogo.test.mjs`; Modify `src/worker.js` (rotas)

**Contrato:**
- `0004_seed_catalogo.sql`: 28 linhas em `products` com `tenant_id='eag-internal'`, **exatamente** os grupos/variantes/origens da tabela de `docs/eag-compass-perfil.md` §3 (itens 1–28; `origins_json` com `"SITE"`, `"SOLICITACAO"` e/ou `"PORTFOLIO"`; `source_ref` = rota do site ou "Rogério (responsável comercial)"; `consulted_at='2026-09-22'`). Item 28 (CSO): `identity_status='pending'`. Nenhum código NCM é inserido como `confirmed` (todos pendentes até a Fase de fontes — PER §5 P4). Laudo do óleo de soja bruto: 1 linha em `product_characteristics` com `sample_only=1`, `status='confirmed'`, `source_ref` = caminho do laudo interno.
- `src/catalog.js`:
  - `export async function listProducts(env, tenantId, { activeOnly = true }): Promise<Product[]>`
  - `export async function getProduct(env, tenantId, id): Promise<Product & { codes, characteristics }>` (404 se não existir)
  - `export function assertProductUsable(product): void` — `ApiException(422, "product_identity_pending", "Identidade do produto pendente: confirme o que este item representa antes de buscar ou abordar.")` quando `identity_status==='pending'` (R10.4). Usado pela T9.
  - `export function mentionableCharacteristics(product): Characteristic[]` — só `status==='confirmed'` (R10.6; consumida pelo gerador no Plano 2).
- Rotas: `GET /api/catalog` (todos os perfis), `GET /api/catalog/:id`.

**Intenções de teste:**
- *28 itens semeados* — `GET /api/catalog` retorna 28. **Falha se:** a seed perder ou duplicar item.
- *CSO bloqueia uso* — `assertProductUsable(cso)` lança 422 `product_identity_pending`; para soja GMO não lança. **Falha se:** o status de CSO for semeado como `confirmed`.
- *característica não confirmada não é mencionável* — produto com 1 característica `confirmed` e 1 `not_confirmed` → `mentionableCharacteristics` devolve 1. **Falha se:** o filtro de status sumir.
- *nenhum NCM confirmado na seed* — `SELECT COUNT(*) FROM product_codes WHERE status='confirmed'` = 0. **Falha se:** alguém semear código como confirmado sem fonte.

**Defesas (5g):** rota — autenticada (T4); cap — GET sem corpo; saída — JSON; CSRF — só GET; cookie — não se aplica; campo opcional — `consulted_at`/`source_ref` nulos permitidos só onde a PER não tem fonte; exclusão — não há exclusão de produto (campo `active`); config de teste — T2.
**Commit:** `feat: catálogo EAG com 28 itens e regra de identidade pendente`

---

## Tarefa 8: Parâmetros v2 versionados

**Requisito:** R7.1, R7.1.1, R3.3.1, R4.3.5, R11.14, R19.10–R19.12 (valores), P10.

**Files:** Create `migrations/0005_seed_parametros_v2.sql`, `src/parameters.js`, `test/parametros.test.mjs`; Modify `src/worker.js` (troca `getParameters` local pelo módulo; rotas)

**Contrato:**
- **Formato de chave** (consumido pela T6 e pelo Plano 2): `parameter_key` + `scope_key`, lidos como `"<parameter_key>:<scope_key>"`.
- `0005_seed_parametros_v2.sql` insere, com `effective_from='2026-09-22T00:00:00Z'`, `changed_by='system-admin'` e `change_reason` citando a decisão:
  - `radius_allowed_km` / `national` → `[5,100,200,300,400,500,600,700,800,900,1000,1100,1200,1300,1400,1500]` (B3)
  - `radius_default_km` / `national` → `5`
  - `send_daily_ramp` / `email` → `[5,10,15,20]` (volume aprovado)
  - `send_interval_minutes` / `email` → `{"min":15,"max":25}`
  - `send_stop_hard_bounce_pct` / `email` → `3`; `send_step_up_max_hard_bounce_pct` / `email` → `2`
  - `volume_min` / `sugar:international` → `500` (mantém o valor aprovado da v1.3 **como parâmetro**, não como código)
  - `volume_min` / `coffee:international:FoodEra` → `5`
  - **Não semear** `volume_min` nacional (M_N sem valor aprovado — pendência comercial), `period_default_months` (T6 internacional) nem `send_window` além do horário comercial: ausentes = funcionalidade bloqueada (R7.1.1).
  - A seed 0002 mantém `volume_min`/`sugar` e `volume_min`/`coffee:FoodEra`; a 0005 **encerra** esses dois (`UPDATE parameters SET effective_to='2026-09-22T00:00:00Z' WHERE parameter_key='volume_min' AND scope_key IN ('sugar','coffee:FoodEra')`), para que só a chave nova com mercado valha.
- `src/parameters.js`:
  - `export async function getParameters(env, tenantId, at = new Date().toISOString()): Promise<Record<string, any>>` — mesma consulta da 0.3.1 (`src/worker.js:98-106`), movida.
  - `export async function requireParameter(params, key): any` — `ApiException(409, "parameter_missing", "Parâmetro sem valor aprovado: <key>. Esta função fica bloqueada até um Administrador definir o valor.")` se ausente (R7.1.1).
  - `export async function setParameter(env, actor, { key, scope, value, reason, effectiveFrom }): Promise<{ id }>` — só `admin`; fecha a vigência anterior (`effective_to = effectiveFrom`) e insere a nova numa única `env.DB.batch`; grava `audit_log` `parameter.changed` com `old_value_json`, `new_value_json`, `reason`. `reason` com menos de 5 caracteres → 422.
- Rotas: `GET /api/parameters` (todos), `PUT /api/parameters/:key` com corpo `{ scope, value, reason, effectiveFrom? }` (só admin).

**Intenções de teste:**
- *raio 5 e 1.500 permitidos, 150 não* — `radius_allowed_km:national` contém 5 e 1500 e não contém 150. **Falha se:** a seed usar outro passo.
- *mínimo nacional ausente bloqueia* — `requireParameter(params, "volume_min:milho:national")` → 409 `parameter_missing`. **Falha se:** houver valor implícito.
- *mínimo antigo sem mercado deixou de valer* — `getParameters` hoje não contém `volume_min:sugar`, contém `volume_min:sugar:international` = 500. **Falha se:** o `UPDATE … effective_to` for esquecido (duas chaves vivas).
- *alteração guarda histórico* — admin altera `send_interval_minutes:email`; a leitura seguinte devolve o novo valor; existe 1 linha com `effective_to` preenchido e 1 `audit_log` com valor antigo e novo. **Falha se:** o update sobrescrever a linha em vez de criar nova vigência.
- *vendedor não altera* — `seller_analyst` em `PUT` → 403, nenhuma linha nova. **Falha se:** a checagem de perfil sair.

**Defesas (5g):** rota — autenticada; `PUT` exige admin; cap — `bodyJson` 64 KB; `value` serializado com limite de 4 KB (422 acima); saída — JSON; CSRF — `assertSameOrigin` (T4); cookie — não se aplica; campo opcional — `effectiveFrom` ausente = agora; exclusão — parâmetro nunca é apagado, só encerrado; config de teste — T2.
**Commit:** `feat: parâmetros v2 versionados com valores aprovados`

---

## Tarefa 9: Campanhas com ICP, declarações e limite de ativas

**Requisito:** R16.1, R16.2, R16.7, R16.8, R28.1, R28.17, R10.4, R23.3, R22.6 (revisão vencida → pausa, só marcação nesta fase).

**Files:** Create `src/campaigns.js`, `test/campanhas.test.mjs`; Modify `src/worker.js` (rotas)

**Interfaces:**
- `export async function createCampaign(env, actor, input): Promise<{ id, version }>` — `input`: `{ productId, market, name, originCity?, originUf?, radiusKm?, countryCode?, language?, reviewDueAt?, icp: { userSectors: string[], sizeTarget: 'medium'|'medium_plus', region, decisionRole, influencerRole, supplyPains?, buyingCycleDays? } }`. Perfis: admin, commercial_manager, seller_analyst. Valida produto com `assertProductUsable` (T7). Nacional: `radiusKm` deve estar em `radius_allowed_km:national` (T8) — senão 422 `radius_not_allowed` com a lista na mensagem (R11.11/R11.14). Cria `campaigns` + `campaign_icp` na mesma `batch`. Status inicial `draft`.
- `export async function updateCampaign(env, actor, id, input, expectedVersion: number)` — `UPDATE … SET …, version = version + 1 WHERE id=? AND tenant_id=? AND version=?`; `meta.changes === 0` → 409 `edit_conflict` "Esta campanha foi alterada por outra pessoa. Recarregue antes de salvar." (R23.3).
- `export async function activateCampaign(env, actor, id)` — só admin/commercial_manager. Exige `campaign_icp` presente (R28.1: sem ICP → 422 `icp_required`). Conta campanhas `active` do mesmo `market` com `product_id` distinto; se já houver 2 produtos distintos ativos e o desta não for um deles → status `waiting` e resposta `{ status: "waiting", reason: "max_two_active_commodities" }` (R28.17); senão `active`.
- `export async function addDeclaration(env, actor, campaignId, { kind, valueBool?, text?, reviewDueAt? })` — só admin/commercial_manager; revoga a declaração anterior do mesmo `kind` (`status='revoked'`) e cria a nova; grava `audit_log` `campaign.declaration`.
- `export async function activeDeclarations(env, campaignId, at): Promise<{ volumeAvailable: boolean|null, socialProof: string|null }>` — ignora `revoked` e as com `review_due_at < at` (R16.8). Consumida pelo gerador no Plano 2.
- Rotas: `GET/POST /api/campaigns`, `GET/PATCH /api/campaigns/:id` (PATCH exige `expectedVersion` no corpo), `POST /api/campaigns/:id/activate`, `POST /api/campaigns/:id/declarations`.

**Intenções de teste:**
- *campanha com produto pendente é recusada* — CSO → 422 `product_identity_pending`. **Falha se:** `assertProductUsable` não for chamado.
- *raio fora da lista é recusado* — `radiusKm: 150` → 422 `radius_not_allowed`; `5` e `1500` aceitos. **Falha se:** a validação usar faixa contínua em vez da lista.
- *sem ICP não ativa* — campanha criada e ICP apagado no teste por SQL → `activate` → 422 `icp_required`. **Falha se:** a checagem de ICP sair.
- *terceira commodity fica em espera* — ativas: açúcar e milho (nacional); ativar café → `waiting`; ativar outra campanha de açúcar → `active`; café internacional → `active`. **Falha se:** a contagem não separar por mercado ou por produto distinto (AT61).
- *edição concorrente* — duas leituras com `version=1`; primeira `PATCH` ok (version 2); segunda `PATCH` com `expectedVersion=1` → 409 e o nome continua o da primeira. **Falha se:** o `WHERE version=?` sair.
- *declaração vencida não vale* — declaração `volume_available=true` com `review_due_at` ontem → `activeDeclarations` devolve `volumeAvailable: null`. **Falha se:** o filtro de vencimento sair (AT62, parte da Fundação).
- *nova declaração revoga a anterior* — duas `social_proof` seguidas → só a segunda `approved`. **Falha se:** as duas ficarem ativas.

**Defesas (5g):** rota — autenticada, perfis acima; cap — 64 KB; textos (`name`, `text`, `supplyPains`) com `.length ≤ 500` (422 acima); saída — JSON; o texto de prova social será exibido na interface via `textContent` (T11), nunca `innerHTML`; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — `reviewDueAt` nulo = sem vencimento; `buyingCycleDays` nulo = desconhecido; exclusão — campanha não é apagada (`ended`); config de teste — T2.
**Commit:** `feat: campanhas com ICP, declarações e limite de 2 commodities ativas`

---

## Tarefa 10: Supressão pseudonimizada e pausas

**Requisito:** R21.1, R21.3, R21.5, R9.1.1, R9.2 (consulta só admin), R22.1, R22.2, R22.8.

**Files:** Create `src/suppression.js`, `test/supressao-pausas.test.mjs`; Modify `src/worker.js` (rotas)

**Interfaces:**
- `export function normalizeIdentifier(channel, value): string` — e-mail: `trim().toLowerCase()`; telefone: só dígitos; linkedin: URL minúscula sem barra final e sem query.
- `export async function identifierHash(env, channel, value): Promise<string>` — HMAC-SHA-256 (`crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])`) sobre `` `${channel}:${normalizeIdentifier(channel, value)}` `` com `SUPPRESSION_HMAC_KEY` (base64, 32 bytes; ausente/inválida → 503 `suppression_key_unavailable`); saída hex minúscula.
- `export async function suppress(env, actor, { channel, value, reason, source }): Promise<{ id, created: boolean }>` — `INSERT … ON CONFLICT(tenant_id, identifier_hash, channel) DO NOTHING`; `created=false` quando já existia. `audit_log` `suppression.added` **sem** o valor em claro.
- `export async function isSuppressed(env, tenantId, channel, value): Promise<boolean>` — consumida pelo Plano 2 (R19.2 item 1, R2.1.2, R21.5).
- `export async function listSuppression(env, actor)` — só admin; devolve `identifier_hash` abreviado (`sha256:` + 4 primeiros + `…` + 4 últimos), canal, motivo, origem, data.
- `export async function createPause(env, actor, { scope, scopeRef?, reason })` — operação inteira: só admin/commercial_manager; demais escopos: admin, commercial_manager, seller_analyst (tabela R9.2). `reason` ≥ 5 caracteres.
- `export async function resumePause(env, actor, pauseId, { reason })` — mesmos perfis do escopo; preenche `resumed_*`; pausa já retomada → 409.
- `export async function openPauses(env, tenantId): Promise<Pause[]>` — consumida pelo Plano 2 (R19.2 item 2).
- Rotas: `GET/POST /api/suppression` (GET só admin; POST admin, commercial_manager, seller_analyst — "registrar descadastro recebido"), `GET/POST /api/pauses`, `POST /api/pauses/:id/resume`.
- **Sem rota de remoção de supressão nesta fase** (R9.2 prevê remoção só por admin com motivo e base; fica para o Plano 2 junto com a política de T11).

**Intenções de teste:**
- *e-mail com caixa e espaços diferentes é a mesma pessoa* — suprimir `" Joao@Empresa.com.br "`; `isSuppressed(..., "joao@empresa.com.br")` → `true`; segunda supressão devolve `created:false`. **Falha se:** a normalização sair (Review Focus 5).
- *banco não guarda o e-mail* — após suprimir, nenhuma coluna de `suppression_entries` nem `audit_log` contém `"empresa.com.br"`. **Falha se:** o valor em claro for gravado em qualquer tabela.
- *hash depende da chave* — mesmo e-mail com duas chaves diferentes → hashes diferentes. **Falha se:** o HMAC virar SHA-256 simples (reversível por dicionário).
- *vendedor não lê a lista* — `seller_analyst` em `GET /api/suppression` → 403. **Falha se:** a permissão de leitura for aberta.
- *pausa de operação exige gestor* — `seller_analyst` cria pausa `operation` → 403; `commercial_manager` → 201. **Falha se:** a regra de perfil por escopo sair.
- *pausar campanha A não pausa B* — pausa `campaign` em A; `openPauses` tem só A. **Falha se:** a pausa for gravada sem `scope_ref`.
- *retomar duas vezes* — segunda retomada → 409. **Falha se:** a checagem de `resumed_at` sair.

**Defesas (5g):** rota — autenticada com perfis acima; cap — 64 KB; `value` ≤ 320 caracteres; saída — lista de supressão só com hash abreviado; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — `retention_until` nulo = política a definir em T11 (registrado no relatório como pendência); exclusão — **não há exclusão** nesta fase; config de teste — T2, com `SUPPRESSION_HMAC_KEY` de teste em `miniflare.bindings`.
**Commit:** `feat: supressão pseudonimizada e pausas por escopo`

---

## Tarefa 11: Interface Talhão (casca, Hoje, Parâmetros, Supressão, Campanhas)

**Requisito:** R24.1, R24.2 (partes disponíveis na Fundação), R24.5, R24.6; design doc aprovado (`docs/eag-compass-design.md` §2–§6).

**Files:** Modify `public/index.html` (substitui a interface 0.3.1); Create `public/app.css`, `public/app.js`; Modify `scripts/build-site.mjs` (copiar os 3 arquivos para `dist/`), `scripts/validate-site.mjs` (marcadores)

**Contrato:**
- Tokens CSS **copiados** de `docs/eag-compass-design.md` §2 (valores exatos) para `:root` em `public/app.css`. Fontes Google (Barlow Condensed, Roboto, IBM Plex Mono) via `<link>`, como no protótipo aprovado.
- Estrutura e componentes do protótipo `design/fase5/compass-prototipo.html` (barra lateral, `.screen`, `rows`, `list`, `kv`, `tag`, `box`, `btn`, diálogo, toast, faixa de pausa), **sem** os dados fictícios.
- Telas nesta fase: **Hoje** (contadores reais: fichas 0 — a funcionalidade é do Plano 2 —, campanhas ativas, pausas abertas, parâmetros pendentes), **Campanhas** (lista, criar com ICP, ativar, declarações), **Parâmetros e supressão** (tabela de `GET /api/parameters`, lista de supressão só para admin, registrar descadastro, criar/retomar pausa). As demais telas do protótipo aparecem na navegação como "Disponível no piloto" (desabilitadas, com texto explicativo), sem dados de exemplo.
- Todo texto vindo da API é inserido com `textContent` ou `createElement` — **nunca `innerHTML`** com dado da API.
- Chamadas à API com `fetch("/api/…", { method, headers: { "content-type": "application/json" }, body })`; o navegador envia `Origin` sozinho (compatível com `assertSameOrigin`).
- Estados: carregando (skeleton), vazio acionável ("Nenhuma campanha. Criar campanha"), erro com mensagem da API (`error.message`) e ação de tentar de novo; 401 → texto "Sessão expirada. Recarregue a página para entrar pelo Access."; faixa vermelha quando houver pausa `operation` aberta.
- `scripts/validate-site.mjs` marcadores exigidos em `dist/index.html`: `data-screen="hoje"`, `data-screen="campanhas"`, `data-screen="config"`, `/api/session`, `/api/campaigns`, `/api/parameters`; e em `dist/app.js`: ausência da string `innerHTML` (falha a validação se aparecer).

**Verificação:** manual (sem framework de teste de navegador na stack; P20 aceita verificação manual justificada) — roteiro: `npm run dev`; abrir `http://localhost:8787` (atalho local da T4); (1) criar campanha nacional açúcar ICUMSA 45, Sertãozinho/SP, 5 km, com ICP; (2) tentar raio 150 pela API (`curl`) e ver 422; (3) ativar; (4) registrar descadastro de `teste@exemplo.com` e conferir na lista só o hash abreviado; (5) pausar operação e ver a faixa vermelha; retomar; (6) capturar telas em 1440 px e no quadro de 390 px (`design/fase5/verificacao-mobile.html` apontando para o dev server) e anexar ao relatório. Automático: `npm run check` (marcadores e proibição de `innerHTML`).
**Defesas (5g):** rota — não cria rota; saída com dado de usuário — `textContent` obrigatório, verificado pelo validate-site; CSRF — requisições same-origin; cookie — não se aplica; campo opcional — campos opcionais do formulário vazios são enviados como ausentes, não como string vazia; exclusão — não se aplica; config de teste — não se aplica.
**Commit:** `feat: interface Talhão da fundação`

---

## Tarefa 12: Provisionamento, Access e deploy (com portões humanos)

**Requisito:** infra (T9, T10), decisões G1, G5, G6; C14 (deploy.yml).

**Files:** Create `.github/workflows/deploy.yml`, `docs/eag-compass-provisionamento.md`; Modify `wrangler.jsonc` (ids reais, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` em `env.production`)

**Passos (cada ✋ é portão humano — o executor para e pede a Rogério):**
- [ ] ✋ **G1:** Rogério confirma no painel que a conta está no **Workers Paid** (ou faz o upgrade). Registrar data no `provisionamento.md`.
- [ ] ✋ Rogério **habilita o R2** no painel (erro 10042 da auditoria).
- [ ] Criar recursos: `npx wrangler kv namespace create CACHE`; `npx wrangler r2 bucket create eag-compass-files`; `npx wrangler queues create eag-compass-async`; `npx wrangler queues create eag-compass-async-dlq`; `npx wrangler d1 info eag_compass` (id do D1 existente). Copiar os ids para `wrangler.jsonc`.
- [ ] Secrets de produção: `npx wrangler secret put PII_ENCRYPTION_KEY`, `BOOTSTRAP_ADMIN_EMAIL` (e-mail de Rogério no Access), `SUPPRESSION_HMAC_KEY` (gerar 32 bytes aleatórios em base64 localmente; nunca commitar).
- [ ] `npx wrangler d1 migrations apply eag_compass --remote`.
- [ ] `npm run check && npx wrangler deploy`.
- [ ] ✋ Rogério ativa o Access no Worker (**Settings → Domains & Routes → Enable Cloudflare Access**, `https://developers.cloudflare.com/workers/configuration/cloudflare-access/`), com política por e-mail; copia o **AUD** e o **team domain** para `ACCESS_AUD` e `ACCESS_TEAM_DOMAIN`; novo deploy.
- [ ] ✋ **G6:** perguntar a Rogério o destino do Worker antigo `eag-compass-production` e das filas `eag-sanctions-queue`/`eag-scores-queue`. **Nada é excluído sem "sim" explícito**; registrar a resposta.
- [ ] `.github/workflows/deploy.yml`: em `push` para `main`, `npm ci`, `npm run check`, `wrangler d1 migrations apply eag_compass --remote`, `wrangler deploy` via `cloudflare/wrangler-action@v3` com `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}` e `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}` (inputs conforme o `deploy.yml` removido do commit `4edff05`, que usava a mesma action). ✋ Rogério cria os dois secrets no GitHub.
- [ ] Verificação pós-deploy (anotar no `provisionamento.md`): `GET https://eag-compass.<subdominio>.workers.dev/api/health` → 200; abrir a raiz → tela de login do Access; após login com o e-mail de bootstrap → tela Hoje com o perfil "Administrador"; tentar com outro e-mail autorizado no Access mas não cadastrado → 403 "Usuário autenticado não está autorizado".

**Defesas (5g):** rota pública — só `/api/health`; toda a aplicação atrás do Access; saída — não se aplica; CSRF — T4; cookie — sessão do Access; campo opcional — não se aplica; exclusão permanente — **nenhuma exclusão** sem G6 aprovado; `wrangler delete`/`queues delete` só com "sim" registrado; config de teste — não se aplica.
**Verificação:** manual, com o roteiro acima (não há teste automatizado de infraestrutura real).
**Commit:** `chore: provisionamento e deploy da fundação`

---

## Cobertura de requisitos neste plano

| Requisito | Tarefa |
| --- | --- |
| R9.2, R9.2.1 | T4 |
| R3.1 (demanda sem commodity fixa), R3.3, R4.2–R4.4, R5.1, R7.2, R2.4.3 | T5, T6 |
| R7.1, R7.1.1, R11.14 (valores), R19.10–R19.12 (valores) | T8 |
| R10.1–R10.6 | T5, T7 |
| R16.1, R16.2, R16.7, R16.8, R28.1, R28.17, R23.3 | T5, T9 |
| R21.1, R21.3, R21.5, R9.1.1, R22.1, R22.2 | T5, T10 |
| R24.1, R24.2 (parcial), R24.5, R24.6 | T11 |
| Infra (T9, T10, G1, G5, G6, C5, C14, git) | T1, T2, T3, T12 |

**Fora deste plano (Plano 2 — Piloto Nacional):** R1.1.3/R1.1.4 (dedup por busca), R11 (Radar), R13–R15, R17 (gerador/revisor PV), R18 (fichas), R19 (envio SMTP, rampa em execução, idempotência), R20 (respostas IMAP), R21.2/R21.4/R21.6/R21.7–R21.10 (descadastro em e-mail), R22.3–R22.7, R23.1/R23.2/R23.4–R23.6, R24.3/R24.4, R25 (OpenClaw), R26, R27, R28.2–R28.16/R28.18/R28.19, AT15–AT39, AT50–AT70 (exceto os cobertos acima). **Plano 3 — Internacional:** R1.4, R12.
