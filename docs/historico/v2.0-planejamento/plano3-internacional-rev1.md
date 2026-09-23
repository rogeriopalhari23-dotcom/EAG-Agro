# EAG Compass v2.0 — Plano 3: Internacional País Primeiro (Etapa 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sobre a Fundação (Plano 1) e o Piloto Nacional (Plano 2), entregar o fluxo **País Primeiro**:
1. Rogério informa só o país.
2. O Compass mostra o que o Brasil exportou de agrícola para ele (Comex Stat), com os três estados de R12.6.
3. Rogério escolhe as commodities, e cada uma vira uma campanha.
4. As empresas do país entram com evidência separada para cada condição de R12.10.
5. Fichas e envios reaproveitam o Plano 2, no idioma da campanha (inglês por padrão) e no fuso de cada destinatário.

**Architecture:** Mesmo Worker. A análise de país roda em **Queue**, uma mensagem por ano civil, espaçadas com `delaySeconds`, porque a API bloqueia chamadas próximas (T6 C5). As linhas ficam no D1 e a resposta bruta no R2, para reprodutibilidade (R8.2). **Nenhuma fonte nominal paga** de empresas no exterior nesta etapa. Descoberta de empresas é a Camada 2 (pesquisa com evidência registrada por Rogério), conforme H-I1 do benchmark. Fonte paga só por adaptador e após decisão registrada (R13.7).

**Tech Stack:** Plano 2 sem dependências novas. `Intl.DateTimeFormat` com `timeZone` IANA para validar fusos (disponível no runtime de Workers).

**Spec:** `docs/eag-compass-spec.md` · **Constituição:** `docs/eag-compass-constituicao.md` · **Evidência T6:** `docs/eag-compass-t6-comexstat.md` (testes reais de 2026-09-23) · **Skill:** `/prospeccao-vendas` (SHA-256 `33bd093f…9dd8`) · **Design:** `docs/eag-compass-design.md` (tela Internacional) · **Pré-requisito:** Planos 1 e 2 concluídos (migrações 0001–0008).

---

## Global Constraints

Todas as dos Planos 1 e 2 continuam valendo. Acrescentam-se:

- **Exportações do Brasil, nunca importações** (R12.2). O corpo da chamada tem `flow: "export"` fixo no adaptador, sem parâmetro.
- **Dado de país não é dado de empresa** (R1.4.3, R12.10, AT23). As linhas da análise **não** entram na tabela `evidence` (que exige `company_id`) nem alimentam Confidence, ICP ou condições de empresa.
- **"Nenhum registro" só com prova** (R12.6). Exige: todas as partes anuais com `200` + `success:true`, e o código do país validado em `/tables/countries/<id>`. Qualquer outra situação → `dados indisponíveis` ou `parcial`.
- **Soma só de `metricKG` (kg líquido) e `metricFOB` (US$)** (R12.5, T6 C6). Quantidade estatística é secundária: exibida com a unidade da NCM, nunca somada.
- **Espaçamento mínimo de 20 s entre chamadas ao Comex Stat** (T6 C5), em todo o sistema.
- **Idioma:** campanhas em **inglês** por padrão. Países de língua portuguesa usam os modelos em português. A ficha registra a lacuna 🔴: a skill não tem método específico para exportação (PV12, R28.15).
- **Fuso por destinatário** (R18.6). Sem fuso IANA válido no contato, a ficha não é aprovada. Janela e "dias não seguidos" são calculados no fuso dele (R19.2 itens 7 e 12).
- **Envio compartilha a rampa** do Plano 2. O teto diário é por remetente e soma Nacional e Internacional (R19.10).

### Portões

| Portão | Comando | Linha de base (fim do Plano 2) | Estado exigido |
| --- | --- | --- | --- |
| Testes puros | `npm run test:unit` | contagem ao fim do Plano 2 | 100% passando |
| Testes de Worker | `npm run test:worker` | contagem ao fim do Plano 2 | 100% passando |
| Checagem completa | `npm run check` (inclui `check:skill`) | passando | passando |
| Migrações locais | `npx wrangler d1 migrations apply eag_compass --local` | 0001–0008 | 0001–0011 aplicadas |

Seção `## Portões` obrigatória no relatório de cada tarefa, com antes e depois. Regra do erro herdado idêntica aos Planos 1 e 2.

---

## Review Focus

1. **Consulta "vazia" que na verdade é erro de formato.** País como número ou período atravessando o ano: a API responde "sucesso" sem linhas (T6 C1, C2). Nunca pode virar `nenhum registro no período`. Teste na Tarefa 3.
2. **429 no meio da análise.** Um ano veio e o outro esgotou as tentativas: a análise fica `parcial`, mostra o ano que falta e não soma o total como se fosse o período inteiro. Teste na Tarefa 4.
3. **NCM que casa com dois produtos do catálogo** (código HS de 4 dígitos e NCM de 8 do mesmo item). A linha aparece nos dois produtos, mas o total do país a conta uma vez. Teste na Tarefa 4.
4. **Destinatário em fuso diferente do de Rogério.** Um passo aprovado às 16h em São Paulo para um contato em Tóquio só sai entre 09:00 e 17:00 de Tóquio, e o "dia civil anterior" é o de Tóquio. Teste na Tarefa 8.
5. **Resposta em inglês.** "Please remove me", "unsubscribe", "send me your price list" e "Out of office" são classificados como no português. Teste na Tarefa 8.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Dona |
| --- | --- | --- |
| `migrations/0009_internacional.sql` | Esquema | T1 |
| `migrations/0010_seed_paises.sql` | Países (código Comex, ISO, idioma) | T2 |
| `migrations/0011_seed_parametros_internacional.sql` | Parâmetros internacionais | T1 |
| `scripts/gen-paises-sql.mjs` | Gera a 0010 a partir de `/tables/countries` | T2 |
| `src/adapters/comexstat.js` | Chamadas, validações C1–C7, normalização | T3 |
| `src/country-analysis.js` | Análise por país, partes anuais, estados, catálogo | T4 |
| `src/selections.js` | Seleção de commodities → campanhas | T5 |
| `src/foreign-companies.js` | Empresa estrangeira, condições R12.10, porte, fuso | T6 |
| `src/templates/prospeccao-vendas-en.js` | Modelos em inglês + roteiros | T7 |
| `src/review.js` | Regras PV em inglês (modifica) | T7 |
| `src/sending.js`, `src/inbound.js`, `src/unsubscribe.js`, `src/fichas.js` | Fuso por destinatário, inglês (modifica) | T8 |
| `public/*` | Tela Internacional e dashboard | T9 |
| `docs/eag-compass-t6-comexstat.md` | Registro de T6 (acrescenta o teste pelo Worker) | T10 |

---

## Recursos nomeados

| Recurso | Nome | Dono |
| --- | --- | --- |
| Migrações | `0009_internacional.sql`, `0010_seed_paises.sql`, `0011_seed_parametros_internacional.sql` | T1, T2, T1 |
| Migrações futuras | `0012_*` em diante | Fase de manutenção |
| Tabelas novas | `countries`, `country_analyses`, `country_analysis_parts`, `country_analysis_lines`, `commodity_selections`, `commercial_validations`, `company_conditions` | T1 (DDL), T2 (seed de `countries`) |
| Colunas novas | `contacts.timezone`; `companies.size_band`, `companies.size_source`, `companies.size_checked_at`; `campaigns.analysis_id`, `campaigns.selection_id` | T1 |
| Rotas | `GET /api/countries`, `POST /api/country-analyses`, `GET /api/country-analyses/:id`, `POST /api/country-analyses/:id/retry` | T4 |
| Rotas | `POST /api/country-analyses/:id/selections`, `POST /api/commercial-validations` | T5 |
| Rotas | `POST /api/foreign-companies`, `PUT /api/companies/:id/conditions/:productId`, `PATCH /api/companies/:id/size` | T6 |
| Mensagens de fila (`body.type`) | `comex_part` | T4 |
| Chave KV | `comex:next_at` (próximo horário livre para chamar a API) | T3 |
| Prefixo R2 | `comex/<analysisId>/<year>.json` | T4 |
| Parâmetros | `param_period_default_months:international` = `12`; `agri_classification:international` = `{"version":"sh-01-24@2026-09-23","chapters":["01","02","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24"],"excluded":["03"]}`; `send_hours:international` = `{"start":"09:00","end":"17:00","weekdays":[1,2,3,4,5]}`; `comex_min_interval_s` = `20` | T1 (seed 0011) |
| Parâmetro de liberação | `international_enabled` (**não semeado**; só admin grava, com `evidenceRef`) | T10 |
| Vars | `COMEX_BASE_URL` = `https://api-comexstat.mdic.gov.br` | T3 |
| Constantes | `TEMPLATES_EN_VERSION = "pv-en-1.0.0"` | T7 |

---

## Tarefa 1: Migração 0009 e parâmetros internacionais

**Requisito:** R1.4.1, R12.2–R12.10, R13.4, R14 (porte estrangeiro), R18.6, R7.1.

**Files:** Create `migrations/0009_internacional.sql`, `migrations/0011_seed_parametros_internacional.sql`, `test/migracao-0009.test.mjs`

**Contrato — SQL exato (0009):**

```sql
PRAGMA defer_foreign_keys = true;

CREATE TABLE countries (
  comex_id TEXT PRIMARY KEY CHECK (length(comex_id) = 3),   -- "023"; sempre texto com zeros (T6 C1)
  name_pt TEXT NOT NULL, iso3 TEXT, iso_numeric TEXT,
  default_language TEXT NOT NULL DEFAULT 'en' CHECK (default_language IN ('en','pt-BR')),
  source TEXT NOT NULL, loaded_at TEXT NOT NULL
);

CREATE TABLE country_analyses (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  country_comex_id TEXT NOT NULL REFERENCES countries(comex_id),
  period_from TEXT NOT NULL, period_to TEXT NOT NULL,            -- 'YYYY-MM'
  classification_version TEXT NOT NULL,
  source_updated_at TEXT,                                        -- de /general/dates/updated
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','partial','unavailable')),
  result_state TEXT CHECK (result_state IN ('purchase_identified','no_record','data_unavailable','partial')),
  coverage_note TEXT, request_key TEXT NOT NULL, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), finished_at TEXT,
  UNIQUE (tenant_id, request_key)
);

CREATE TABLE country_analysis_parts (
  id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL REFERENCES country_analyses(id),
  year INTEGER NOT NULL, month_from TEXT NOT NULL, month_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
  http_status INTEGER, attempts INTEGER NOT NULL DEFAULT 0, error TEXT,
  r2_key TEXT, rows_count INTEGER, done_at TEXT,
  UNIQUE (analysis_id, year)
);

CREATE TABLE country_analysis_lines (
  analysis_id TEXT NOT NULL REFERENCES country_analyses(id),
  ncm TEXT NOT NULL CHECK (length(ncm) = 8), year INTEGER NOT NULL, month INTEGER NOT NULL,
  description TEXT NOT NULL,
  fob_usd INTEGER NOT NULL, net_kg INTEGER NOT NULL,
  stat_qty INTEGER, stat_unit TEXT, stat_consistent INTEGER CHECK (stat_consistent IN (0,1)),
  PRIMARY KEY (analysis_id, ncm, year, month)
);

CREATE TABLE commodity_selections (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  analysis_id TEXT NOT NULL REFERENCES country_analyses(id),
  items_json TEXT NOT NULL,              -- [{ productId|null, ncms: [...], label }]
  selected_by TEXT NOT NULL, selected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE commercial_validations (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  selection_id TEXT NOT NULL REFERENCES commodity_selections(id), label TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')), reason TEXT NOT NULL,
  decided_by TEXT NOT NULL, decided_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE company_conditions (
  tenant_id TEXT NOT NULL REFERENCES tenants(id), company_id TEXT NOT NULL REFERENCES companies(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  condition TEXT NOT NULL CHECK (condition IN ('imports_from_brazil','buys_commodity','consumes_as_input')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed','pending','not_found')),
  evidence_id TEXT REFERENCES evidence(id),
  updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (tenant_id, company_id, product_id, condition),
  CHECK (status <> 'confirmed' OR evidence_id IS NOT NULL)
);

ALTER TABLE contacts ADD COLUMN timezone TEXT;
ALTER TABLE companies ADD COLUMN size_band TEXT CHECK (size_band IN ('small','medium','medium_plus','giant'));
ALTER TABLE companies ADD COLUMN size_source TEXT;
ALTER TABLE companies ADD COLUMN size_checked_at TEXT;
ALTER TABLE campaigns ADD COLUMN analysis_id TEXT REFERENCES country_analyses(id);
ALTER TABLE campaigns ADD COLUMN selection_id TEXT REFERENCES commodity_selections(id);
```

- `0011` insere os 4 parâmetros de Recursos nomeados, com o mesmo formato de linha da `0005` do Plano 1 (`scope`, `key`, `value_json`, `valid_from`, `approved_by = 'system-admin'`, `source = 'Plano 3 — proposta D1–D4 de docs/eag-compass-t6-comexstat.md'`). **Os valores D1–D4 são propostas.** ✋ Rogério aprova os valores antes do merge desta tarefa. Até lá, a tarefa não é concluída.

**Intenções de teste:**
- *condição confirmada exige evidência*: `status='confirmed'` com `evidence_id NULL` → erro de CHECK. **Falha se:** o CHECK sair (AT23).
- *código de país com 3 caracteres*: inserir `'23'` → erro. **Falha se:** o CHECK de comprimento sair (T6 C1).
- *linha única por NCM, ano e mês*: **Falha se:** a chave primária composta sair (duplicaria totais, R12.5).
- *campanhas antigas intactas*: campanhas do Plano 2 continuam com `analysis_id NULL`. **Falha se:** o `ALTER` exigir valor.

**Defesas (5g):** rota, saída, CSRF e cookie — não se aplicam. Campo opcional — `contacts.timezone` nulo = "fuso pendente" (bloqueia aprovação, T8); `companies.size_band` nulo = `pending_size`. Exclusão — não se aplica. Config de teste — harness do Plano 1.
**Commit:** `feat: esquema do internacional e parâmetros propostos`

---

## Tarefa 2: Países

**Requisito:** R12.1, R12.2, PV12.

**Files:** Create `scripts/gen-paises-sql.mjs`, `migrations/0010_seed_paises.sql` (gerado e commitado), `tests/paises.test.mjs`

**Contrato:**
- O script chama `GET https://api-comexstat.mdic.gov.br/tables/countries?language=pt` uma vez. Resposta copiada em T6: `{"data":{"list":[{"id":"994","text":"A Designar"},{"id":"013","text":"Afeganistão"},…]}}`.
- Para ISO chama `GET /tables/countries/<id>?language=pt`, **respeitando 20 s entre chamadas** (≈ 250 países ≈ 85 min; roda **uma vez**, fora do CI). Resposta copiada: `{"data":{"id":"023","country":"Alemanha","coPaisIson3":"276","coPaisIsoa3":"DEU"}}`. Se interrompido, retoma pelo arquivo parcial `scripts/.paises-cache.json` (fora do git).
- `default_language`: `pt-BR` para `AGO`, `CPV`, `GNB`, `MOZ`, `PRT`, `STP`, `TLS` (países de língua oficial portuguesa, lista da CPLP: `https://www.cplp.org/id-2597.aspx`, a conferir pelo executor); todos os outros `en` (PV12: inglês por padrão).
- Exclui os ids sem país real (`994` "A Designar" e os que não tiverem `coPaisIsoa3`). Os excluídos vão listados em comentário na migração.
- `source` = `comexstat:/tables/countries@2026-MM-DD`.

**Intenções de teste:**
- *código sempre com 3 dígitos em texto*: todo `comex_id` casa `^\d{3}$`. **Falha se:** o script converter para número (T6 C1).
- *Portugal em português, Alemanha em inglês*: **Falha se:** a regra de idioma inverter.
- *"A Designar" fora*: **Falha se:** `994` aparecer como país selecionável.

**Defesas (5g):** script local, sem rota. Config de teste — `node --test` lendo a migração gerada.
**Commit:** `feat: tabela de países do Comex Stat`

---

## Tarefa 3: Adaptador Comex Stat

**Requisito:** R12.2, R12.5, R12.6, R13.5, T6; Review Focus 1.

**Files:** Create `src/adapters/comexstat.js`, `test/comexstat.test.mjs`

**Contrato (fonte: `docs/eag-compass-t6-comexstat.md`, consultas reais de 2026-09-23; documentação oficial bloqueada por desafio da Cloudflare):**
- `export function splitPeriodByYear(from, to): { year, monthFrom, monthTo }[]` — `('2025-09','2026-08')` → `[{2025,'2025-09','2025-12'},{2026,'2026-01','2026-08'}]` (T6 C2).
- `export async function fetchExportsByNcm(env, { countryComexId, monthFrom, monthTo }, fetchImpl = fetch): Promise<{ httpStatus, raw: string, rows: NormalizedRow[] }>`
  - Recusa localmente, sem chamar a API: `countryComexId` fora de `^\d{3}$`; `monthFrom` e `monthTo` de anos diferentes; formato fora de `YYYY-MM`. Lança `AdapterError('invalid_request')`.
  - `POST ${COMEX_BASE_URL}/general?language=pt`, cabeçalhos `content-type: application/json` e `user-agent: EAG-Compass/2.0 (+rogeriopalhari@eagagro.com)`. Timeout de 30 s (`AbortSignal.timeout(30000)`).
  - Corpo fixo: `{ flow: "export", monthDetail: true, period: { from, to }, filters: [{ filter: "country", values: [countryComexId] }, { filter: "chapter", values: <capítulos do parâmetro agri_classification> }], details: ["ncm"], metrics: ["metricFOB","metricKG","metricStatistic"] }`.
  - `NormalizedRow = { ncm, year, month, description, fobUsd, netKg, statQty }` — `Number()` em cada métrica (T6 C7); `NaN` → linha rejeitada e a parte vira `failed` com o motivo "valor não numérico".
  - Erros: 429 → `AdapterError('temporary', { retryAfterS: 20 })`; 400 → `AdapterError('invalid_request')` (sem nova tentativa, T6 C4); 5xx, timeout ou HTML no lugar de JSON (desafio da Cloudflare) → `AdapterError('temporary')`, com o último caso registrado como `blocked_by_challenge` no `error`. `success !== true` com 200 → `AdapterError('temporary')`.
- `export async function reserveSlot(env, now): Promise<number>` — lê KV `comex:next_at`. Devolve em quantos segundos a chamada pode acontecer (0 se já pode) e grava `next_at = max(now, next_at) + comex_min_interval_s`. **Limitação declarada:** o KV não é transacional. Com um só usuário e a fila com `max_concurrency` padrão, a sobreposição é rara, e o 429 é tratado como temporário.
- `export async function ncmUnit(env, ncm, fetchImpl)` — `GET /tables/ncm?search=<ncm>&language=pt` → `unit` (ex.: `"TONELADA METRICA LIQUIDA"`), com cache KV `comex:ncm:<ncm>` por 30 dias.
- `export function statConsistency({ netKg, statQty, unit }): 0|1|null` — só para unidade com "TONELADA": `|statQty − netKg/1000| / (netKg/1000) ≤ 0,05` → 1, senão 0. Outras unidades → `null` (T6 C6).

**Fixtures:** as respostas copiadas em `docs/eag-compass-t6-comexstat.md` §2 e §3: lista de café com 3 linhas; `{"data":{"list":[]},"success":true}`; `{"error":{"code":429,"message":"Você excedeu o limite de solicitações. Por favor, tente novamente em 10 segundos."}}`; `{"error":{"code":400,"message":"Filtro inválido"}}`; a página HTML "Just a moment...".

**Intenções de teste:**
- *período atravessando o ano é dividido*: **Falha se:** o adaptador aceitar `2025-09..2026-08` numa chamada só (Review Focus 1).
- *país numérico é recusado antes de chamar*: `fetchImpl` não é chamado. **Falha se:** `23` for convertido silenciosamente.
- *valores em texto viram número*: `"300582403"` → `300582403`. **Falha se:** a soma concatenar textos.
- *429 é temporário com espera*: **Falha se:** 429 virar resultado vazio.
- *página de desafio é temporária e registrada*: HTML → `temporary` com `blocked_by_challenge`. **Falha se:** o `JSON.parse` quebrar sem classificar.
- *estatística inconsistente marcada*: out/2025 do fixture (39.231.664 kg, 819.606 t) → 0. **Falha se:** a razão usar kg sem dividir por 1000.
- *fluxo sempre export*: o corpo capturado tem `flow === "export"`. **Falha se:** existir parâmetro de fluxo.

**Defesas (5g):** rota — não cria. Saída — descrições da NCM exibidas com `textContent`. CSRF e cookie — não se aplicam. Campo opcional — `metricStatistic` ausente → `statQty null`. Exclusão — não se aplica. Config de teste — `fetchImpl` injetado; KV do harness.
**Commit:** `feat: adaptador Comex Stat com as armadilhas de T6`

---

## Tarefa 4: Análise de país

**Requisito:** R12.1–R12.6, R12.8, R1.4.1–R1.4.3, R10.3, R13.5, R8.2, AT20–AT23; Review Focus 2 e 3.

**Files:** Create `src/country-analysis.js`, `test/analise-pais.test.mjs`; Modify `src/queue.js` (tipo `comex_part`), `src/worker.js` (rotas)

**Interfaces:**
- `export async function startAnalysis(env, actor, { countryComexId, periodMonths? })`:
  - Exige só o país (R12.1, AT20). Sem commodity, NCM, lote ou preço.
  - `periodMonths` padrão `param_period_default_months:international`; aceita 1–60 (422 `period_invalid`).
  - Período: termina no mês de `GET /general/dates/updated`. Essa chamada também respeita `reserveSlot`; o resultado fica em cache KV de 12 h.
  - `request_key` = SHA-256 de `country|from|to|classification_version|YYYY-MM-DD`; análise repetida no mesmo dia → devolve a existente.
  - Valida o país em `/tables/countries/<id>`, que precisa responder `"message":"País encontrado"`. Isso cobre a condição de `no_record` (D4).
  - Cria uma parte por ano (`splitPeriodByYear`). Envia `comex_part` com `delaySeconds` = `reserveSlot`, uma por vez: a mensagem seguinte só é enfileirada quando a anterior termina.
- `runPart(env, { analysisId, partId })`:
  - Chama `fetchExportsByNcm`.
  - Grava a resposta bruta no R2 `comex/<analysisId>/<year>.json`.
  - Insere as linhas em lotes de até 12 por `INSERT` (8 colunas × 12 = 96 parâmetros, abaixo do limite de 100 parâmetros por consulta do D1: `https://developers.cloudflare.com/d1/platform/limits/`, a conferir pelo executor).
  - Unidade por NCM (`ncmUnit`) só para as NCMs da resposta, com `stat_consistent`.
  - `temporary` → `retry({ delaySeconds: 30 })` até `max_retries` (3) e depois `failed`.
- Fechamento da análise:
  - Todas as partes `done` e linhas > 0 → `purchase_identified`.
  - Todas `done`, 0 linhas e país validado → `no_record`.
  - Alguma `failed` e alguma `done` → `partial`, com `coverage_note` "Faltam os meses X–Y (motivo)". Os totais só aparecem com o aviso "período incompleto".
  - Todas `failed` ou país não validado → `data_unavailable` (R12.6, AT21).
- `export async function getAnalysis(env, actor, analysisId)`:
  - Devolve cabeçalho (R1.4.1: origem Brasil, destino, período, fonte "Comex Stat/MDIC", `source_updated_at`, data da consulta, versão da classificação).
  - Devolve linhas agrupadas por NCM: soma de `fob_usd` e `net_kg`, última ocorrência (ano-mês mais recente com valor > 0), estatística só por mês com unidade e marca de inconsistência (R12.3, R12.5).
  - **Correspondência com o catálogo (R12.4):**
    - `product_codes` com `code_system='NCM'` e `code` igual à NCM → `match: 'confirmed'` se `status='confirmed'`, `'pending_code'` se `pending` (AT22).
    - `code_system='HS'` de 4 ou 6 dígitos que é prefixo da NCM → mesma regra.
    - Uma NCM pode aparecer em mais de um produto. O **total do país** é a soma das linhas por NCM, calculada uma vez (Review Focus 3).
  - O aviso literal de R1.4.2: "O dado confirma exportação do Brasil para o país; não comprova compra por nenhuma empresa específica."
- `POST /api/country-analyses/:id/retry` — reenvia as partes `failed` sem duplicar linhas (chave primária).
- Nenhuma rota de busca de empresas é oferecida a partir da análise antes da seleção (T5). A tela só mostra o botão "Escolher commodities" (R12.8).

**Fixtures:** respostas da T3. Dublê que devolve linhas para 2025 e 429 persistente para 2026. Catálogo com o mesmo café em `NCM 09011110 confirmed` e `HS 0901 pending`.

**Intenções de teste:**
- *só o país basta*: `startAnalysis({ countryComexId: "023" })` → 200. **Falha se:** exigir commodity (AT20).
- *falha vira indisponível, nunca nenhum registro*: todas as partes 429 → `data_unavailable`. **Falha se:** a ausência de linhas decidir o estado (AT21).
- *um ano falha, outro não*: → `partial` com a nota dos meses faltantes. **Falha se:** o total for exibido sem o aviso (Review Focus 2).
- *vazio com país validado*: → `no_record`. **Falha se:** a validação do país for pulada.
- *código pendente não comprova*: a linha do café aparece como `confirmed` pelo NCM e `pending_code` pelo HS, e o destaque "no catálogo" usa só o `confirmed`. **Falha se:** `pending` contar como correspondência (AT22).
- *NCM em dois produtos conta uma vez no total*: **Falha se:** o total do país somar por produto (Review Focus 3).
- *dado do país não toca empresas*: após a análise, `evidence`, `company_conditions` e `scores` sem nenhuma linha nova. **Falha se:** a análise gravar evidência (AT23, R1.4.3).
- *reprodutível*: toda parte `done` tem `r2_key` preenchido e o objeto existe no R2 com o mesmo texto recebido. **Falha se:** a resposta bruta não for guardada (R8.2).

**Defesas (5g):**
- Rota: autenticada. `POST` para admin, commercial_manager e seller_analyst. Cap 64 KB.
- Saída: descrições com `textContent`.
- CSRF: `assertSameOrigin`. Cookie: não se aplica.
- Campo opcional: `periodMonths` ausente = parâmetro.
- Exclusão: análises nunca apagadas.
- Config de teste: fila testada chamando `handleQueue` com lote simulado, como no Plano 2 T4.

**Commit:** `feat: análise de país com três estados e correspondência ao catálogo`

---

## Tarefa 5: Seleção de commodities e campanhas

**Requisito:** R12.7–R12.9, R16.1, R28.17, AT61.

**Files:** Create `src/selections.js`, `test/selecao.test.mjs`; Modify `src/worker.js` (rotas)

**Interfaces:**
- `export async function selectCommodities(env, actor, analysisId, { items: [{ productId?: string, ncms: string[], label: string }] })`:
  - Só admin ou commercial_manager.
  - Exige análise `purchase_identified` ou `partial`. `no_record` e `data_unavailable` → 409, porque não há base registrada.
  - Grava `commodity_selections` com autor e data (R12.7).
  - Para cada item com `productId`, cria uma campanha `international` (Plano 1 `createCampaign`) com `country_code` = ISO-3 do país, `language` = `countries.default_language`, `analysis_id` e `selection_id`. O ICP da campanha é preenchido depois pelo usuário, porque é obrigatório para ativar (Plano 1 T9).
  - Ativar a 3ª commodity no mercado internacional deixa a campanha em `waiting` com aviso; a regra de 2 ativas é a do Plano 1 T9 (R28.17, AT61).
- Item **sem** `productId` (fora do catálogo) cria campanha em `draft` marcada "validação comercial pendente". `POST /api/commercial-validations` `{ selectionId, label, decision, reason }` (admin) registra a decisão. Sem `approved`, `createFicha` (Plano 2 T9) recusa com 409 `commercial_validation_pending` (R12.9).
- **Decisão:** um item fora do catálogo exige cadastrar o produto (Plano 1 T7) como `identity_status='pending'` para a campanha existir. O Plano 1 exige `product_id` NOT NULL.

**Intenções de teste:**
- *seleção registrada antes de campanha*: **Falha se:** existir campanha com `analysis_id` sem `selection_id` (R12.8).
- *fora do catálogo sem validação não gera ficha*: **Falha se:** `createFicha` não consultar `commercial_validations` (R12.9).
- *terceira ativa espera*: **Falha se:** o limite contar Nacional e Internacional juntos (R28.17 é por mercado).
- *análise indisponível não permite seleção*: **Falha se:** `data_unavailable` aceitar seleção.

**Defesas (5g):**
- Rota: autenticada, só gestores. Cap 64 KB; no máximo 20 itens, cada `label` ≤ 200 caracteres e NCMs `^\d{8}$`.
- Saída: JSON. CSRF: `assertSameOrigin`. Cookie: não se aplica.
- Campo opcional: `productId` ausente = fora do catálogo.
- Exclusão: seleções nunca apagadas.
- Config de teste: harness.

**Commit:** `feat: seleção de commodities gera campanhas internacionais`

---

## Tarefa 6: Empresas no exterior e condições R12.10

**Requisito:** R12.10, R13.2–R13.4, R13.6, R13.7, R14.1–R14.8 (porte estrangeiro), R1.1, R1.2, R15, R18.6, T7.

**Files:** Create `src/foreign-companies.js`, `test/empresas-exterior.test.mjs`; Modify `src/companies.js` (Plano 2: `icpStatus` aceita `sizeBand`), `src/worker.js` (rotas)

**Interfaces:**
- `export async function createForeignCompany(env, actor, { countryIso3, legalName, tradeName?, registrationId?, registrationIdType?, sourceLabel, sourceUrl?, campaignId })`:
  - `country_code` = ISO-3 e deve existir em `countries`.
  - Dedup por `(country_code, registration_id)` quando houver; sem identificador → dedup por nome normalizado **gera pendência, não fusão** (R1.1.4, escopo §59).
  - `registrationIdType` livre com até 40 caracteres (ex.: "Handelsregister HRB", "EIN", "SIREN"). Sem lista fixa, porque não há fonte validada (T7).
  - Cria as 3 linhas de `company_conditions` do produto da campanha em `pending` (R12.10).
- `export async function setCondition(env, actor, companyId, productId, condition, { status, evidenceId? })`:
  - `confirmed` exige `evidenceId` de evidência da **mesma empresa**, `category` diferente de `market` e `validation_status='valid'` (422 `condition_needs_company_evidence`).
  - A evidência precisa ter `metadata_json.supports` contendo o nome da condição (R13.4). `addEvidence` do Plano 2 T6 passa a aceitar `supports: string[]`.
  - `not_found` exige nota. Nunca é preenchida por dedução (R13.3).
- `export async function setSize(env, actor, companyId, { sizeBand, source })` — porte manual com fonte e data (R14.6).
- **ICP estrangeiro:** `icpStatus` recebe `sizeBand` quando não há `porteCodigo`: `small` → `out_small`; `giant` sem relacionamento → `out_giant`; `medium` e `medium_plus` → `in_icp`; ausente → `pending_size`. As regras de trader e exceção ficam iguais às do Plano 2 T6.
- **Fuso do contato:** `PATCH /api/contacts/:id` (Plano 2) aceita `timezone`, validado com `new Intl.DateTimeFormat('en-US', { timeZone })` dentro de try/catch; inválido → 422 `timezone_invalid`.
- **Camada 2 — sem fonte paga:** a interface mostra links de pesquisa **montados, não executados** (busca web com o nome da empresa e a commodity; página da empresa no LinkedIn) para Rogério abrir. O Compass não raspa nenhum site. Um adaptador pago de dados nominais **não** faz parte deste plano (R13.7): exige decisão de custo, cobertura e qualidade registrada depois do piloto.
- Sanções (Plano 2 T16) valem igual para empresas estrangeiras: `screenCompany` com `country_code`.

**Intenções de teste:**
- *dado de país não confirma condição*: evidência `category='market'` → 422. **Falha se:** a checagem de categoria sair (AT23).
- *evidência de outra empresa não serve*: **Falha se:** a checagem de `company_id` sair.
- *evidência precisa dizer o que sustenta*: sem `supports` → 422. **Falha se:** R13.4 não for exigido.
- *mesmo registro, mesma empresa*: dois cadastros com o mesmo país e `registration_id` → uma empresa. **Falha se:** a dedup usar só o nome.
- *fuso inválido recusado*: `"Europe/Berlim"` → 422. **Falha se:** o texto for gravado sem validar.
- *porte médio entra no ICP*: **Falha se:** empresa estrangeira ficar sempre `pending_size` por falta de código da Receita.

**Defesas (5g):**
- Rota: autenticada; perfis operacionais; `setSize` e exceções só para gestores. Cap 64 KB; textos ≤ 500.
- Saída: `textContent`.
- CSRF: `assertSameOrigin`. Cookie: não se aplica.
- Campo opcional: `registrationId` ausente = pendência de dedup.
- Exclusão: a do Plano 2 T13.
- Config de teste: harness.

**Commit:** `feat: empresas no exterior com evidência por condição`

---

## Tarefa 7: Modelos em inglês e revisor PV em inglês

**Requisito:** PV1–PV12, R17.1–R17.6, R28.9, R28.15, AT24, AT53–AT55.

**Files:** Create `src/templates/prospeccao-vendas-en.js`, `tests/revisor-en.test.mjs`; Modify `src/review.js`, `src/templates/prospeccao-vendas.js` (seleção por idioma)

**Contrato:**
- A skill só tem textos em português. A versão em inglês é uma **tradução fiel** dos mesmos blocos de `references/scripts-abordagem.md`: E-mails 1–4, variante ao influenciador e roteiros L0/L1/L2/LinkedIn. A estrutura, a ordem das frases e os pedidos são os mesmos, com a única troca dos marcadores. O assunto do E-mail 1 fica `<Commodity> supplier`.
- ✋ **Portão humano:** o executor escreve a tradução e a apresenta **lado a lado com o português** no relatório. Rogério aprova o texto antes do merge. Sem aprovação, a tarefa não termina e `TEMPLATES_EN_VERSION` não é publicado.
- Assinatura em inglês: `Rogério Palhari · EAG Agro` + `EAG_POSTAL_ADDRESS` + `To stop receiving these messages, reply "unsubscribe" or use this link: <URL>`.
- `generateSequence` recebe `language` ('pt-BR' | 'en') e escolhe o conjunto de modelos. Países lusófonos usam o português.
- A ficha internacional recebe o aviso fixo de R28.15: "A /prospeccao-vendas não tem método específico para exportação (lacuna 🔴). Sequência aplicada no idioma da campanha."
- **Revisor em inglês.** As mesmas funções PV com listas por idioma:
  - PV1: "start a conversation" e "20 minutes".
  - PV7: `/\bUS\$|\bprice|pricing|quot(e|ation)|\blots?\b|stock|inventory|certif|payment|delivery (time|date)/i`.
  - PV9: `^[A-Z][a-z]+( [a-z]+)* supplier$`, sem `%` nem dígitos.
  - PV10: "sorry to bother", "apologies for", "could you forward me to purchasing".
  - PV12: a ficha tem idioma definido e o aviso de lacuna → `ok`.
  - R19.13: assinatura com endereço, link e "unsubscribe".
- `SKILL_SHA256` e o portão `check:skill` são os mesmos do Plano 2. Se a skill mudar, a tradução também precisa ser refeita (R17.8).

**Intenções de teste:**
- *sequência em inglês padrão passa no revisor*: **Falha se:** a tradução violar o próprio revisor.
- *"competitive price" reprova PV7*: **Falha se:** a lista em inglês não for usada para campanha `en` (AT24).
- *"70% of manufacturers struggle" reprova PV9*: **Falha se:** a regex aceitar dígitos (AT55).
- *Portugal usa português*: **Falha se:** o idioma vier fixo em inglês.
- *ficha internacional traz a lacuna*: **Falha se:** o aviso de R28.15 faltar.

**Defesas (5g):** rota — não cria. Saída — texto puro. CSRF e cookie — não se aplicam. Campo opcional — `firstName` ausente → "Hi," sem nome. Exclusão — não se aplica. Config de teste — `node --test`.
**Commit:** `feat: modelos e revisor PV em inglês`

---

## Tarefa 8: Envio, respostas e descadastro no fuso e idioma do destinatário

**Requisito:** R18.6, R19.2 itens 7 e 12, R19.10, R20, R21.7, R21.10, R28.13; Review Focus 4 e 5.

**Files:** Modify `src/fichas.js`, `src/sending.js`, `src/inbound.js`, `src/unsubscribe.js`; Create `test/internacional-envio.test.mjs`

**Contrato:**
- `createFicha` e `approveFicha` (Plano 2 T9):
  - Campanha `international` → cada destinatário precisa de `contacts.timezone`; senão 422 `timezone_pending` (R18.6).
  - Campanha `national` → vale o `send_timezone:national`, como no Plano 2.
- `preSendCheck` (Plano 2 T10):
  - Item 7: janela `send_hours:<market>` no fuso do contato (internacional) ou em `America/Sao_Paulo` (nacional).
  - Item 12: "dia civil anterior" calculado no fuso do contato.
  - Conversão com `Intl.DateTimeFormat(..., { timeZone, hour12: false, year, month, day, hour, minute, weekday })`, sem biblioteca externa.
  - O teto diário da rampa é contado no dia civil de `America/Sao_Paulo` (remetente) e soma os dois mercados (R19.10).
  - Feriados: **não tratados** nesta versão. Fica registrado como limitação na ficha internacional.
- `inbound.classify` (Plano 2 T11) ganha as listas em inglês:
  - unsubscribe: `unsubscribe|remove me|stop|opt out|take me off`;
  - auto_reply: assunto `Automatic reply|Auto-Reply|Out of Office|OOO`;
  - pedido de preço (R28.13): `price|pricing|quote|quotation|price list|catalog(ue)?|proposal|presentation`. A orientação da tarefa é a mesma da skill, em português, porque é para Rogério.
- Página `/u/*` (Plano 2 T12) bilíngue, português e inglês na mesma página, sem dado pessoal.

**Intenções de teste (relógio injetado):**
- *Tóquio fora da janela espera*: passo pronto às 16:00 de São Paulo (04:00 do dia seguinte em Tóquio) fica `pending` e sai no primeiro cron dentro de 09:00–17:00 de Tóquio. **Falha se:** a janela usar o fuso do servidor ou de São Paulo (Review Focus 4).
- *dias não seguidos no fuso do destinatário*: e-mail aceito às 23:30 de São Paulo, que já é o dia seguinte em Berlim → o próximo só sai dois dias civis depois em Berlim. **Falha se:** o item 12 usar o dia de São Paulo.
- *teto soma os mercados*: 3 nacionais e 3 internacionais no mesmo dia com teto 5 → o 6º fica para o próximo dia útil. **Falha se:** cada mercado tiver o próprio teto.
- *respostas em inglês*: "Please remove me from your list" → `unsubscribe`; assunto "Out of Office: back Monday" → `auto_reply` (pausa, B1 pendente); "Could you send me your price list?" → `human` com orientação. **Falha se:** alguma cair em `human` sem a regra certa (Review Focus 5).
- *ficha sem fuso não aprova*: **Falha se:** o nacional passar a exigir fuso por contato (regressão do Plano 2).

**Defesas (5g):** rotas existentes, sem novas. Saída — página `/u/*` sem dado pessoal. Campo opcional — `timezone` nulo bloqueia só o internacional. Config de teste — relógio e dublês injetados como no Plano 2.
**Commit:** `feat: envio e respostas no fuso e idioma do destinatário`

---

## Tarefa 9: Interface Internacional e dashboard

**Requisito:** R12 (tela), R24.1, R24.3, R1.4.2, R28.17; design doc §4 linha "Internacional".

**Files:** Modify `public/index.html`, `public/app.css`, `public/app.js`, `scripts/validate-site.mjs`

**Contrato:**
- **Tela Internacional**, seguindo `design/fase5/compass-prototipo.html` e os tokens do Plano 1:
  1. Escolha do país: lista de `GET /api/countries`, com busca por nome.
  2. Período (padrão do parâmetro, ajustável).
  3. Estado da análise com os três rótulos de R12.6, mais "parcial" com a nota de cobertura e o botão "Tentar de novo".
  4. Tabela por NCM: descrição, kg líquido, US$ FOB, última ocorrência e estatística com unidade e marca "inconsistente na fonte".
  5. Destaque "no catálogo EAG" só para `confirmed`; `pending_code` mostra "código pendente".
  6. O aviso de R1.4.2 fixo acima da tabela.
  7. Botão "Escolher commodities" → seleção → campanhas, com aviso de espera da 3ª.
- **Empresa estrangeira:** as 3 condições de R12.10 como três linhas com estado e evidência; links de pesquisa montados; porte com fonte; fuso por contato.
- **Dashboard (R24.1, R24.3):** um seletor Nacional/Internacional sobre a mesma base. No Internacional aparecem as análises, as seleções e as campanhas que cada uma originou.
- Tudo por `textContent`. `validate-site.mjs` passa a exigir `data-screen="internacional"`, `/api/country-analyses`, `/api/foreign-companies`.

**Verificação:** manual, como no Plano 2 T18: "Alemanha → análise → café aparece com correspondência → escolher café → campanha → cadastrar importador com evidência de 'importa do Brasil' → fuso Europe/Berlin → ficha em inglês". Capturas em 1440 px anexadas ao relatório. Automático: `npm run check`.
**Defesas (5g):** saída — `textContent`. CSRF — same-origin. Campo opcional — estados vazios acionáveis. Config de teste — não se aplica.
**Commit:** `feat: interface internacional e dashboard por mercado`

---

## Tarefa 10: Validação de T6 pelo Worker e amostra internacional (portões humanos)

**Requisito:** T6, R17.6 (caso internacional em inglês), R26.

**Files:** Modify `docs/eag-compass-t6-comexstat.md` (seção "Teste pelo Worker"), `docs/eag-compass-t1-validacao.md` (amostra internacional)

**Roteiro (✋ com Rogério; cada resultado registrado com data):**
1. Com o Worker publicado (Plano 1 T12), rodar a análise da Alemanha pelo Compass e comparar com a consulta de 2026-09-23. Resultado esperado: café 09011110 presente, 2025 com 340.503.519 kg no ano. **Se** a API responder com o desafio da Cloudflare (`blocked_by_challenge`), a análise fica `data_unavailable`, o item volta à Fase 4 e o fluxo Internacional **não** é liberado. Não há contorno improvisado.
2. Medir o número de 429 em 10 análises seguidas e ajustar `comex_min_interval_s` só se necessário (parâmetro, sem redeploy).
3. **Amostra R17.6:** gerar uma sequência internacional em inglês (importador fictício, contato interno com fuso de outro país) e enviá-la ao endereço interno pelo modo `internal_test` do Plano 2. Rogério revisa o texto e o horário de chegada.
4. ✋ Liberação do Internacional: com 1–3 registrados como OK, Rogério autoriza por escrito "liberar internacional". Antes disso, fichas internacionais podem ser criadas, mas não aprovadas: `approveFicha` exige o parâmetro `international_enabled` = `true`, que só um admin grava, com `evidenceRef`.

**Intenções de teste (automáticas):**
- *internacional desligado não aprova*: **Falha se:** a ausência do parâmetro liberar.

**Defesas (5g):** parâmetro só admin; nenhuma rota nova.
**Commit:** `docs: validação de T6 pelo Worker e amostra internacional`

---

## Cobertura de requisitos

| Requisito | Tarefa |
| --- | --- |
| R1.4.1–R1.4.3 | T4, T9 |
| R12.1–R12.6 | T2, T3, T4, T9 |
| R12.7–R12.9 | T5 |
| R12.10 | T6 |
| R13.2–R13.7 (internacional) | T4, T6 |
| R14 (porte estrangeiro) | T6 |
| R17.6 (caso internacional), PV12, R28.15 | T7, T10 |
| R18.6, R19.2 itens 7 e 12, R19.10 | T8 |
| R20, R21 (inglês) | T8 |
| R24.1, R24.3 | T9 |
| R28.17 (internacional) | T5 |
| AT20–AT23, AT61 | T4, T5, T6 |
| R7.1 `param_period_default_months` | T1 (proposta D1, a aprovar) |

**Fora deste plano:**
- Fonte paga de dados nominais de importadores (Volza, Panjiva, ImportGenius): exige decisão registrada (R13.7) após o piloto.
- Feriados por país.
- Idiomas além de inglês e português.
- Caminho alternativo por arquivos anuais do MDIC: só se o teste da T10 falhar.
