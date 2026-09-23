> **Revisão consolidada:** executar a fila `docs/implementation/sequence.json` e aplicar `docs/revisao/CORRECOES-DOS-PLANOS.md`. O código atual já substitui exemplos antigos; não sobrescrevê-lo com os snippets deste plano.

# EAG Compass v2.0 — Plano 3: Internacional País Primeiro (Etapa 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revisão 2 (2026-09-23):** refeita após a decisão de Rogério de **pesquisar uma vez por mês** as compras agrícolas de **todos os países**, em fontes oficiais do lado do importador, guardar a lista na plataforma e buscar importadores só a partir dela (Spec, revisão pós-aprovação 4: R12.2, R12.11–R12.15, AT71–AT75). A revisão 1 foi arquivada em `docs/historico/v2.0-planejamento/plano3-internacional-rev1.md`.

**Goal:** Sobre a Fundação (Plano 1) e o Piloto Nacional (Plano 2), entregar o fluxo **País Primeiro** apoiado numa lista mensal:
1. Todo mês, uma rotina automática monta, para cada país, a lista das commodities agrícolas que ele compra. São duas fontes oficiais, lado a lado:
   - **as importações declaradas pelo próprio país** (UN Comtrade), de todas as origens e de origem Brasil;
   - **as exportações do Brasil para o país** (arquivo completo do MDIC).
2. Rogério escolhe o país e vê a lista pronta, sem nenhuma consulta externa.
3. Ele escolhe as commodities, e cada uma vira uma campanha. A busca de importadores só parte de commodity presente na lista.
4. As empresas entram com evidência separada para cada condição de R12.10.
5. Fichas e envios reaproveitam o Plano 2, no idioma da campanha e no fuso de cada destinatário.

**Architecture:**
- **Rotina mensal (Cron no dia 10 + Queue).**
  - **MDIC:** o arquivo anual é lido em pedaços de 8 MB por `Range`, uma mensagem de fila por pedaço, e agregado por país × NCM × mês.
  - **Comtrade:** 3 chamadas por país (cerca de 300 subposições cada), espalhadas por 2 dias para caber no limite gratuito de 500 chamadas/dia.
  - **Consolidação:** cada país vira um JSON no R2 (`trade-list/<versão>/<ISO3>.json`). O D1 guarda só o índice: versão, estado por país e fonte, e o ponteiro da versão vigente de cada país.
  - **Falha:** um país que falha continua apontando para a versão anterior (R12.12).
- **Consulta:** ler o JSON do país no R2. Nenhuma chamada externa (AT71).
- **Empresas:** a descoberta segue manual, pela Camada 2 com evidência, sem fonte nominal paga (R13.7).

**Tech Stack:** Plano 2, sem dependências novas. `TextDecoder('windows-1252')` para as tabelas do MDIC (codificação não é UTF-8, T6 §7). `DecompressionStream` não é usado, porque os arquivos são CSV sem compressão. `Intl.DateTimeFormat` para fusos. `limits.cpu_ms: 300000` no `wrangler.jsonc` (Workers Paid; o padrão é 30 s): `https://developers.cloudflare.com/workers/platform/limits/`.

**Spec:** `docs/eag-compass-spec.md` (revisão pós-aprovação 4) · **Constituição:** `docs/eag-compass-constituicao.md` · **Evidências T6/T13:** `docs/eag-compass-t6-comexstat.md` (rev. 2) · **Skill:** `/prospeccao-vendas` (SHA-256 `33bd093f…9dd8`) · **Design:** `docs/eag-compass-design.md` (tela Internacional) · **Pré-requisito:** Planos 1 e 2 concluídos (migrações 0001–0008).

---

## Global Constraints

Todas as dos Planos 1 e 2 continuam valendo. Acrescentam-se:

- **Consulta de país nunca chama fonte externa.** Só a rotina mensal e o pedido manual de R12.15 fazem isso (R12.2, AT71).
- **Nunca apagar a lista boa com uma lista pior.** O ponteiro de um país só avança quando a nova versão desse país e dessa fonte termina completa (R12.12, AT72).
- **Fontes lado a lado, nunca somadas.** Comtrade vem em CIF, na visão do importador; MDIC vem em FOB, na visão do Brasil. A parte do Brasil é calculada só dentro da Comtrade (R12.13, AT74).
- **Exportações do Brasil, nunca importações do Brasil.** A rotina lê só `EXP_*.csv` do MDIC e `flowCode=M` do país declarante na Comtrade (R12.2).
- **"Nenhum registro" só com prova.** Fonte respondeu completa e sem linhas → `no_record`. País sem declaração do período → "sem declaração desde …" (R12.6.1). Qualquer falha → `data_unavailable`.
- **Soma só de kg líquido e valor.** A quantidade estatística é secundária, com unidade, nunca somada (T6 C6).
- **Dado de país não é dado de empresa.** Nada da lista entra em `evidence`, Confidence, ICP ou `company_conditions` (R1.4.3, AT23).
- **Idioma e fuso:** como na revisão 1. Inglês por padrão, português para países lusófonos, lacuna 🔴 na ficha, fuso IANA por contato, teto diário somando os dois mercados.
- **Chave da Comtrade** (`COMTRADE_KEY`) só como secret. Nunca em log nem em URL gravada (a URL leva `subscription-key`, então ela é removida antes de registrar).

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

1. **Linha do CSV cortada na fronteira do pedaço de 8 MB.** A linha partida entre dois pedaços precisa ser contada uma vez e inteira. Pedaço repetido pela fila não pode duplicar totais. Teste na Tarefa 3.
2. **Mês em que a Comtrade ou o MDIC falham para parte dos países.** Os que falharam mantêm a versão anterior com "não atualizado em <mês>"; os demais avançam. Teste na Tarefa 5.
3. **País que declara com atraso** (a China tem 2025, outros param em 2023). Mostrar "sem declaração desde 2023" e o último ano, nunca `nenhum registro`, e seguir mostrando o MDIC. Teste na Tarefa 6.
4. **Código de país divergente entre fontes** (EUA 842 na Comtrade; no MDIC, 249 e mais dois códigos de ilhas; Alemanha com duas entradas `DEU` na Comtrade, uma expirada). Um país errado mostraria a lista de outro. Teste na Tarefa 2.
5. **Destinatário em outro fuso e respostas em inglês:** mesmos casos da revisão 1. Teste na Tarefa 10.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Dona |
| --- | --- | --- |
| `migrations/0009_internacional.sql` | Esquema | T1 |
| `migrations/0010_seed_paises.sql` | Países com os códigos das duas fontes | T2 |
| `migrations/0011_seed_parametros_internacional.sql` | Parâmetros | T1 |
| `scripts/gen-paises-sql.mjs` | Gera a 0010 | T2 |
| `src/adapters/mdic-bulk.js` | Leitura por pedaços do arquivo completo e das tabelas | T3 |
| `src/adapters/comtrade.js` | Chamadas à Comtrade | T4 |
| `src/trade-list.js` | Rotina mensal, versões, consolidação, ponteiros | T5 |
| `src/country-analysis.js` | Leitura da lista, estados, catálogo | T6 |
| `src/selections.js` | Seleção → campanhas; trava de R12.14 | T7 |
| `src/foreign-companies.js` | Empresas no exterior e condições R12.10 | T8 |
| `src/templates/prospeccao-vendas-en.js`, `src/review.js` | Inglês | T9 |
| `src/fichas.js`, `src/sending.js`, `src/inbound.js`, `src/unsubscribe.js` | Fuso e idioma do destinatário | T10 |
| `public/*` | Tela Internacional e dashboard | T11 |
| `docs/eag-compass-t6-comexstat.md` | Testes pelo Worker | T12 |

---

## Recursos nomeados

| Recurso | Nome | Dono |
| --- | --- | --- |
| Migrações | `0009_internacional.sql`, `0010_seed_paises.sql`, `0011_seed_parametros_internacional.sql` | T1, T2, T1 |
| Migrações futuras | `0012_*` em diante | Fase de manutenção |
| Tabelas novas | `countries`, `country_mdic_codes`, `trade_list_versions`, `trade_list_status`, `trade_list_current`, `trade_list_jobs`, `trade_list_manual_refresh`, `country_analyses`, `commodity_selections`, `commercial_validations`, `company_conditions` | T1 (DDL), T2 (seed de `countries`) |
| Colunas novas | `contacts.timezone`; `companies.size_band`, `companies.size_source`, `companies.size_checked_at`; `campaigns.analysis_id`, `campaigns.selection_id` | T1 |
| Cron | `"0 6 10 * *"` (dia 10, 06:00 UTC) — início da rotina mensal | T5 |
| Mensagens de fila (`body.type`) | `mdic_chunk`, `comtrade_call`, `trade_consolidate` | T5 |
| Prefixos R2 | `trade-staging/<versionId>/mdic/<ano>/<n>.json`, `trade-staging/<versionId>/comtrade/<ISO3>/<parte>.json`, `trade-list/<versionId>/<ISO3>.json`, `trade-ref/<versionId>/ncm.json` | T3, T4, T5 |
| Rotas | `GET /api/countries`, `GET /api/trade-list/versions`, `POST /api/trade-list/refresh/:iso3` (admin, R12.15) | T5 |
| Rotas | `POST /api/country-analyses`, `GET /api/country-analyses/:id` | T6 |
| Rotas | `POST /api/country-analyses/:id/selections`, `POST /api/commercial-validations` | T7 |
| Rotas | `POST /api/foreign-companies`, `PUT /api/companies/:id/conditions/:productId`, `PATCH /api/companies/:id/size` | T8 |
| Secrets | `COMTRADE_KEY` | T4, T12 |
| Vars | `MDIC_BULK_BASE` = `https://balanca.economia.gov.br/balanca/bd`, `COMTRADE_BASE` = `https://comtradeapi.un.org` | T3, T4 |
| Config | `limits.cpu_ms: 300000` | T3 |
| Parâmetros (seed 0011) | `param_period_default_months:international` = `12` (D1, pendente); `agri_classification:international` = `{"version":"sh-01-24@2026-09-23","chapters":["01","02","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24"],"excluded":["03"]}` (D2, pendente); `trade_list_mdic_years` = `2` (ano corrente e anterior); `trade_list_comtrade_years` = `3` (últimos três anos declarados); `comtrade_calls_per_day` = `400`; `trade_list_retention_versions` = `3`; `send_hours:international` = `{"start":"09:00","end":"17:00","weekdays":[1,2,3,4,5]}` | T1 |
| Parâmetro de liberação | `international_enabled` (**não semeado**; só admin grava, com `evidenceRef`) | T12 |
| Constantes | `TEMPLATES_EN_VERSION = "pv-en-1.0.0"` | T9 |

---

## Tarefa 1: Migração 0009 e parâmetros

**Requisito:** R1.4.1, R12.2–R12.15, R13.4, R14 (porte estrangeiro), R18.6, R7.1.

**Files:** Create `migrations/0009_internacional.sql`, `migrations/0011_seed_parametros_internacional.sql`, `test/migracao-0009.test.mjs`

**Contrato — SQL exato (0009):**

```sql
PRAGMA defer_foreign_keys = true;

CREATE TABLE countries (
  iso3 TEXT PRIMARY KEY CHECK (length(iso3) = 3),
  name_pt TEXT NOT NULL, name_en TEXT NOT NULL,
  comtrade_code INTEGER,                                               -- reporterCode ativo (≠ ISO numérico em vários países)
  default_language TEXT NOT NULL DEFAULT 'en' CHECK (default_language IN ('en','pt-BR')),
  source TEXT NOT NULL, loaded_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_countries_comtrade ON countries(comtrade_code) WHERE comtrade_code IS NOT NULL;

-- O MDIC tem vários CO_PAIS por ISO-3 (ex.: USA = 249 Estados Unidos, 396 Johnston, 873 Wake; DEU = 023 Alemanha, 025 Alemanha Oriental).
CREATE TABLE country_mdic_codes (
  mdic_code TEXT PRIMARY KEY CHECK (length(mdic_code) = 3),   -- CO_PAIS, texto com zeros
  iso3 TEXT NOT NULL REFERENCES countries(iso3),
  name_pt TEXT NOT NULL
);

CREATE TABLE trade_list_versions (
  id TEXT PRIMARY KEY,                       -- ex.: '2026-10' ou '2026-10-manual-DEU-<uuid>'
  kind TEXT NOT NULL CHECK (kind IN ('monthly','manual')),
  reference_month TEXT NOT NULL,             -- 'YYYY-MM' da rotina
  classification_version TEXT NOT NULL,
  mdic_last_modified_json TEXT,              -- {"2026":"Fri, 04 Sep 2026 …"}
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','partial','failed')),
  started_at TEXT NOT NULL, finished_at TEXT, note TEXT
);

CREATE TABLE trade_list_status (
  version_id TEXT NOT NULL REFERENCES trade_list_versions(id),
  iso3 TEXT NOT NULL REFERENCES countries(iso3),
  source TEXT NOT NULL CHECK (source IN ('comtrade','mdic')),
  state TEXT NOT NULL CHECK (state IN ('purchase_identified','no_record','data_unavailable','not_declared','pending')),
  last_period TEXT,                          -- 'YYYY' (Comtrade) ou 'YYYY-MM' (MDIC)
  lines INTEGER NOT NULL DEFAULT 0, error TEXT, updated_at TEXT NOT NULL,
  PRIMARY KEY (version_id, iso3, source)
);

CREATE TABLE trade_list_current (
  iso3 TEXT NOT NULL REFERENCES countries(iso3),
  source TEXT NOT NULL CHECK (source IN ('comtrade','mdic')),
  version_id TEXT NOT NULL REFERENCES trade_list_versions(id),
  r2_key TEXT NOT NULL, content_sha256 TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (iso3, source)
);

CREATE TABLE trade_list_jobs (
  id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES trade_list_versions(id),
  kind TEXT NOT NULL CHECK (kind IN ('mdic_chunk','comtrade_call','consolidate')),
  job_key TEXT NOT NULL,                     -- 'mdic:2026:7' | 'comtrade:DEU:2' | 'consolidate:DEU'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
  attempts INTEGER NOT NULL DEFAULT 0, error TEXT, done_at TEXT,
  UNIQUE (version_id, job_key)
);

CREATE TABLE trade_list_manual_refresh (
  iso3 TEXT NOT NULL REFERENCES countries(iso3), day TEXT NOT NULL,
  version_id TEXT NOT NULL REFERENCES trade_list_versions(id),
  requested_by TEXT NOT NULL, reason TEXT NOT NULL,
  PRIMARY KEY (iso3, day)                    -- R12.15: 1 por dia por país
);

CREATE TABLE country_analyses (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  iso3 TEXT NOT NULL REFERENCES countries(iso3),
  period_months INTEGER NOT NULL,
  comtrade_version_id TEXT REFERENCES trade_list_versions(id),
  mdic_version_id TEXT REFERENCES trade_list_versions(id),
  snapshot_sha256 TEXT NOT NULL,             -- hash do que foi exibido (R8.2)
  created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE commodity_selections (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  analysis_id TEXT NOT NULL REFERENCES country_analyses(id),
  items_json TEXT NOT NULL,                  -- [{ productId|null, hs6: [...], label }]
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

- A `0011` insere os parâmetros de Recursos nomeados no formato da `0005` do Plano 1. `source` = `Plano 3 rev. 2 — propostas D1–D2 e rotina mensal (Spec R12.11)`.
- ✋ Rogério aprova os valores D1 (período padrão de 12 meses) e D2 (capítulos 01–24 sem o 03) antes do merge. **Até lá a tarefa não termina.**

**Intenções de teste:**
- *condição confirmada exige evidência*: **Falha se:** o CHECK sair (AT23).
- *um ponteiro por país e fonte*: dois `trade_list_current` para `DEU`/`comtrade` → erro. **Falha se:** a chave primária sair (a consulta leria duas versões).
- *uma atualização manual por dia*: **Falha se:** a chave `(iso3, day)` sair (R12.15).
- *tarefa de fila única por versão*: `(version_id, job_key)` repetido → erro. **Falha se:** a UNIQUE sair (pedaço duplicado duplicaria totais).
- *código da Comtrade único e código do MDIC com um só país*: **Falha se:** o índice único ou a chave primária de `country_mdic_codes` saírem (Review Focus 4).

**Defesas (5g):** rota, saída, CSRF e cookie — não se aplicam. Campo opcional — país sem linha em `country_mdic_codes` ou com `comtrade_code` nulo = país sem aquela fonte (estado `data_unavailable` com nota "país sem código nesta fonte"). Exclusão — versões antigas podadas pela T5 conforme `trade_list_retention_versions`, nunca a vigente de nenhum país. Config de teste — harness do Plano 1.
**Commit:** `feat: esquema da lista mensal e do internacional`

---

## Tarefa 2: Países com os códigos das duas fontes

**Requisito:** R12.1, R12.2, PV12; Review Focus 4.

**Files:** Create `scripts/gen-paises-sql.mjs`, `migrations/0010_seed_paises.sql` (gerado e commitado), `tests/paises.test.mjs`

**Contrato (fontes conferidas em 2026-09-23, T6 §7 e §8):**
- `GET ${MDIC_BULK_BASE}/tabelas/PAIS.csv`, com cabeçalho `"CO_PAIS";"CO_PAIS_ISON3";"CO_PAIS_ISOA3";"NO_PAIS";"NO_PAIS_ING";"NO_PAIS_ESP"`, decodificado com `new TextDecoder('windows-1252')`.
- `GET ${COMTRADE_BASE}/files/v1/app/reference/Reporters.json` → `results[]` com `reporterCode`, `reporterCodeIsoAlpha3`, `isGroup`, `entryExpiredDate`. Só entradas com `isGroup === false` e **sem** `entryExpiredDate`.
- Junção pelo ISO-3. Os resultados vão para três listas no relatório:
  - países só no MDIC (sem declaração à Comtrade);
  - países só na Comtrade;
  - ISO-3 com mais de uma entrada **ativa na Comtrade**, que **param o script com erro** e exigem decisão.
- **MDIC com vários códigos por ISO-3 é normal** (conferido em 2026-09-23: `USA` = `249` Estados Unidos, `396` Johnston, `873` Wake; `DEU` = `023` Alemanha, `025` Alemanha Oriental). Todos entram em `country_mdic_codes` e as exportações do país **somam todos os seus códigos**. A lista de ISO-3 com mais de um código vai no relatório para Rogério conferir.
- Exclui `"000"`/`ZZZ` ("Não Definido") e códigos sem ISO-3.
- `default_language`: `pt-BR` para `AGO`, `CPV`, `GNB`, `MOZ`, `PRT`, `STP`, `TLS` (lista da CPLP a conferir pelo executor em `https://www.cplp.org/`); o resto `en`.
- O script roda local, uma vez, com 2 downloads, e a saída é commitada. A rotina mensal (T5) **não** reescreve `countries`: país novo exige rodar o script e criar uma migração nova.

**Intenções de teste:**
- *EUA com códigos certos*: `USA` → `comtrade_code 842` e códigos MDIC `249`, `396` e `873`. **Falha se:** a junção da Comtrade usar o ISO numérico (840), ou se o MDIC ficar só com um código (Review Focus 4).
- *Alemanha pela entrada ativa*: `DEU` → `comtrade_code 276`, não 280. **Falha se:** o filtro de `entryExpiredDate` sair.
- *acentos corretos*: `name_pt` de `AFG` = "Afeganistão". **Falha se:** o CSV for lido como UTF-8.
- *Portugal em português*: **Falha se:** a regra de idioma inverter.

**Defesas (5g):** script local, sem rota. Config de teste — `node --test` lendo a migração gerada.
**Commit:** `feat: países com códigos do MDIC e da Comtrade`

---

## Tarefa 3: Adaptador do arquivo completo do MDIC

**Requisito:** R12.2, R12.3, R12.5, R1.4.1; Review Focus 1.

**Files:** Create `src/adapters/mdic-bulk.js`, `test/mdic-bulk.test.mjs`; Modify `wrangler.jsonc` (`limits.cpu_ms: 300000`)

**Contrato (T6 §7):**
- `export async function headYear(env, year, fetchImpl = fetch): Promise<{ size, lastModified }>`: `HEAD ${MDIC_BULK_BASE}/comexstat-bd/ncm/EXP_${year}.csv`. 404 → ano ainda não publicado.
- `export function chunkRanges(size, chunkBytes = 8_388_608): { n, start, end }[]`.
- `export async function processChunk(env, { year, n, start, end, agriChapters }, fetchImpl = fetch): Promise<Aggregate>`:
  - `GET` com `Range: bytes=${start}-${end + 65535}`. Exige 206; 200 → erro `range_unsupported`.
  - **Regra de fronteira:** o pedaço `n > 0` descarta tudo até o primeiro `\n`, inclusive. Cada pedaço processa as linhas que **começam** dentro de `[start, end]`, e a linha que começa antes de `end` e termina depois é lida até o fim com os 64 KB extras. Assim cada linha pertence a exatamente um pedaço.
  - O pedaço 0 descarta o cabeçalho. Confere se ele é literalmente `"CO_ANO";"CO_MES";"CO_NCM";"CO_UNID";"CO_PAIS";"SG_UF_NCM";"CO_VIA";"CO_URF";"QT_ESTAT";"KG_LIQUIDO";"VL_FOB"`; diferente → erro `layout_changed`, sem processar.
  - Parse: separador `;`, aspas removidas dos códigos, métricas com `Number()`. Mantém só as linhas cujo `CO_NCM` começa por um capítulo de `agriChapters`.
  - Agrega `key = CO_PAIS|CO_NCM|CO_ANO-CO_MES` (a consolidação da T5 soma os `CO_PAIS` de um mesmo ISO-3 via `country_mdic_codes`) → `{ fob, kg, qt }`.
  - Grava em R2 `trade-staging/<versionId>/mdic/<ano>/<n>.json` e marca o job `done`. O mesmo pedaço reprocessado sobrescreve o mesmo objeto, então não duplica.
- `export async function loadNcmTable(env, fetchImpl)`: `GET ${MDIC_BULK_BASE}/tabelas/NCM.csv` (windows-1252). Monta `{ ncm → { sh6, unit, name_pt, name_en } }` só dos capítulos agrícolas e grava em `trade-ref/<versionId>/ncm.json`.
- Erros: 5xx, timeout (60 s) ou HTML de desafio da Cloudflare → temporário (`retry` da fila); 404 no ano corrente antes da primeira publicação → ano ignorado, com nota.

**Fixtures:** o cabeçalho e as linhas copiados em T6 §7. Um arquivo sintético de 3 pedaços, montado a partir dessas linhas, com uma linha cortada exatamente na fronteira.

**Intenções de teste:**
- *linha na fronteira contada uma vez*: a soma dos 3 pedaços é igual à soma do arquivo inteiro processado de uma vez. **Falha se:** a regra de fronteira perder ou duplicar a linha (Review Focus 1).
- *pedaço reprocessado não duplica*: processar o pedaço 1 duas vezes e consolidar → mesmo total. **Falha se:** o staging acumular em vez de sobrescrever.
- *layout mudou para tudo*: cabeçalho com coluna a mais → `layout_changed`. **Falha se:** o parser seguir por posição com colunas erradas.
- *só capítulos agrícolas*: a linha `28353910` do fixture é descartada. **Falha se:** o filtro usar número em vez de prefixo de texto.
- *servidor sem Range*: 200 → erro. **Falha se:** o adaptador baixar o arquivo inteiro em memória (128 MB por isolate).

**Defesas (5g):** rota — não cria. Saída — nomes de NCM exibidos com `textContent`. Campo opcional — `QT_ESTAT` vazio → `qt null`. Exclusão — staging apagado pela T5 ao fechar a versão. Config de teste — `fetchImpl` injetado que atende `Range` sobre um buffer.
**Commit:** `feat: leitura por pedaços do arquivo completo do MDIC`

---

## Tarefa 4: Adaptador da Comtrade

**Requisito:** R12.2, R12.3, R12.6.1, R12.13; T13.

**Files:** Create `src/adapters/comtrade.js`, `test/comtrade.test.mjs`

**Contrato (T6 §8; ✋ o executor confere a chamada com chave na T12 antes de liberar):**
- Lista de subposições: `GET ${COMTRADE_BASE}/files/v1/app/reference/HS.json` → `results[]` com `id` de 6 dígitos e `aggrLevel 6`, filtrados pelos capítulos agrícolas (894 em 2026-09-23). Divididos em 3 blocos em ordem crescente, gravados em `trade-ref/<versionId>/hs6-blocks.json`.
- `export async function availableYears(env, comtradeCode, fetchImpl)`: `GET ${COMTRADE_BASE}/public/v1/getDA/C/A/HS?reporterCode=<code>` → anos presentes (resposta copiada em T6 §8). Nenhum ano → `not_declared` sem gastar chamadas de dados.
- `export async function fetchImports(env, { comtradeCode, years, hs6Block }, fetchImpl)`:
  - `GET ${COMTRADE_BASE}/data/v1/get/C/A/HS?reporterCode=<code>&period=<anos separados por vírgula>&partnerCode=0,76&flowCode=M&cmdCode=<bloco>&subscription-key=<COMTRADE_KEY>`.
  - Os nomes dos parâmetros vêm da página da API (T6 §8). O executor confere `partnerCode` com dois valores e `period` com lista na chamada real da T12. Se não aceitar, faz uma chamada por parceiro e o orçamento de chamadas é recalculado **antes** de codar a T5.
  - Normaliza: `{ hs6: cmdCode, year: refYear, origin: partnerCode === 76 ? 'brazil' : 'world', valueUsd: cifvalue ?? primaryValue, basis: cifvalue != null ? 'CIF' : 'primary', netKg: netWgt || null, qty, qtyUnitCode }`.
  - Descarta linhas com `partner2Code` ou `customsCode` diferentes do total, se a resposta trouxer desdobramentos. **O executor confere na resposta real** quais valores representam o total e registra.
- Erros: 401/403 → `auth` (para a rotina e alerta o admin); 429 → temporário, `retry` com `delaySeconds: 3600`; 5xx/timeout → temporário. **Resposta com `count` igual ao limite de registros → erro `truncated`**, porque nunca se aceita lista cortada como completa.
- A URL registrada em log e em `error` passa por `redact(url)`, que remove `subscription-key`.

**Fixtures:** o registro copiado em T6 §8, com `partnerCode` 0 e 76 em versões sintéticas. A resposta de `getDA` copiada.

**Intenções de teste:**
- *chave nunca aparece*: erro 500 com a URL → a mensagem não contém o valor do secret. **Falha se:** `redact` não for aplicado.
- *lista cortada não passa*: `count` = 100000 → `truncated`. **Falha se:** a resposta for aceita.
- *sem declaração não gasta chamada*: `getDA` vazio → nenhuma chamada a `/data`. **Falha se:** o adaptador chamar mesmo assim.
- *CIF marcado*: `basis === 'CIF'`. **Falha se:** o valor for rotulado como FOB (R12.13).

**Defesas (5g):** rota — não cria. Secret — `COMTRADE_KEY` só via `env`. Campo opcional — `netWgt` 0 → `null` ("peso não declarado"), nunca 0 kg. Config de teste — `fetchImpl` injetado.
**Commit:** `feat: adaptador da Comtrade`

---

## Tarefa 5: Rotina mensal, versões e atualização manual

**Requisito:** R12.11, R12.12, R12.15, R13.5, R8.2, AT72; Review Focus 2.

**Files:** Create `src/trade-list.js`, `test/lista-mensal.test.mjs`; Modify `src/queue.js` (tipos `mdic_chunk`, `comtrade_call`, `trade_consolidate`), `src/worker.js` (`scheduled` para `"0 6 10 * *"`, rotas), `wrangler.jsonc` (cron)

**Interfaces:**
- `export async function startMonthlyRun(env, now)`:
  1. Cria a versão `YYYY-MM` (`kind='monthly'`); se já existir, sai, porque o cron é idempotente.
  2. MDIC:
     - `headYear` do ano corrente e do anterior (`trade_list_mdic_years`);
     - `loadNcmTable`;
     - um job `mdic_chunk` por pedaço (cerca de 24 no total), enviados com `sendBatch` (≤ 100 por lote).
  3. Comtrade:
     - para cada país com `comtrade_code`, `availableYears`;
     - para cada bloco, um job `comtrade_call`;
     - espalhados com `delaySeconds` de modo que no máximo `comtrade_calls_per_day` (400) caiam em cada janela de 24 h;
     - `delaySeconds` ≤ 86.400 (doc de Queues), então o 2º dia recebe atraso de 86.400 s.
  4. Estado de cada país e fonte em `trade_list_status` como `pending`.
- `handleComtradeCall` / `handleMdicChunk`: gravam o staging, marcam o job `done` e, quando todos os jobs de uma fonte de um país (Comtrade) ou todos os pedaços (MDIC) terminam, enfileiram `trade_consolidate` para os países afetados.
- `consolidateCountry(env, versionId, iso3)`:
  - Junta o staging do país, monta `trade-list/<versionId>/<ISO3>.json` e grava o hash.
  - Formato do JSON: `{ iso3, versionId, sources: { comtrade: { state, lastPeriod, lines: [{ hs6, year, origin, valueUsd, basis, netKg, qty, qtyUnitCode }] }, mdic: { state, lastPeriod, lastModified, lines: [{ ncm, hs6, ym, fobUsd, netKg, qt, unit }] } }, classificationVersion }`.
  - Por fonte: completa com linhas → `purchase_identified`; completa sem linhas → `no_record`; sem declaração → `not_declared`; algum job `failed` → `data_unavailable`.
  - **Ponteiro:** `trade_list_current` só é atualizado para as fontes do país que ficaram **completas** (`purchase_identified`, `no_record`, `not_declared`). Fonte com falha mantém o ponteiro anterior, e o status da versão registra "não atualizado em <mês>" (R12.12, AT72).
- Fechamento da versão:
  - `complete` se todos os países e fontes estão completos; `partial` caso contrário.
  - Poda: apaga do R2 as versões além de `trade_list_retention_versions` **que não sejam apontadas** por nenhum `trade_list_current`.
  - Apaga o staging.
  - Grava em `audit_log` as contagens: países, linhas, chamadas feitas e falhas (R13.5).
- `POST /api/trade-list/refresh/:iso3` `{ reason }` (admin, R12.15): 1 por dia por país (`trade_list_manual_refresh`, 409 se repetir). Cria uma versão `manual` só para esse país: Comtrade com 3 chamadas; MDIC reaproveita o staging do mês se existir, senão os pedaços completos do ano (o arquivo não é por país).
- `GET /api/trade-list/versions`: versões com contagens por estado. `GET /api/countries`: países com o estado vigente de cada fonte e a data da versão.

**Intenções de teste (dublês dos adaptadores; relógio injetado):**
- *cron duas vezes não duplica*: `startMonthlyRun` duas vezes no mesmo dia → uma versão, sem jobs duplicados. **Falha se:** a versão não for checada.
- *falha mantém o anterior*: mês 1 completo para `DEU`; no mês 2 a Comtrade falha para `DEU` e o MDIC funciona → ponteiro Comtrade de `DEU` continua no mês 1, ponteiro MDIC avança, status "não atualizado em <mês 2>". **Falha se:** o país ficar com lista vazia (AT72, Review Focus 2).
- *orçamento diário respeitado*: 219 países × 3 blocos → nenhuma janela de 24 h com mais de 400 chamadas agendadas. **Falha se:** tudo for enfileirado sem atraso.
- *não declarado não gasta*: país sem ano em `getDA` → 0 jobs de Comtrade e estado `not_declared`.
- *atualização manual 1 por dia*: segunda chamada no mesmo dia → 409. **Falha se:** a trava sair (R12.15).
- *poda não apaga o vigente*: com retenção 3 e um país ainda apontando para a versão 1, a versão 1 desse país continua no R2. **Falha se:** a poda for só por idade.

**Defesas (5g):**
- Rota: `refresh` só para admin; cap 2 KB; `reason` ≥ 10 caracteres.
- Saída: listas sem PII.
- CSRF: `assertSameOrigin`. Cookie: não se aplica.
- Exclusão: poda descrita acima.
- Config de teste: `scheduled` chamado com `{ cron: "0 6 10 * *", scheduledTime }` (interface `scheduled()` citada no Plano 2 T10).

**Commit:** `feat: rotina mensal da lista de compras por país`

---

## Tarefa 6: Análise de país a partir da lista

**Requisito:** R12.1–R12.6.1, R12.13, R1.4.1–R1.4.3, R10.3, R8.2, AT20–AT23, AT71, AT73, AT74; Review Focus 3.

**Files:** Create `src/country-analysis.js`, `test/analise-pais.test.mjs`; Modify `src/worker.js` (rotas)

**Interfaces:**
- `export async function createAnalysis(env, actor, { iso3, periodMonths? })`:
  - Exige só o país (AT20).
  - Lê os dois ponteiros de `trade_list_current` e os JSON do R2. **Nenhum `fetch` externo** (AT71).
  - `periodMonths` (padrão do parâmetro, 1–24 limitado ao que o MDIC guarda) filtra as linhas do MDIC. A Comtrade é **anual** e mostra os anos declarados guardados, com o rótulo "anual, visão do importador".
  - Grava `country_analyses` com as versões e o `snapshot_sha256` do que foi montado (R8.2).
- `export async function getAnalysis(env, actor, id)` → por subposição SH6 (chave comum às duas fontes; a NCM de 8 dígitos do MDIC aparece como detalhe):
  - **Comtrade (visão do importador):** valor de todas as origens, valor de origem Brasil, **parte do Brasil = Brasil ÷ todas**, mesmo ano e mesma base (R12.13); peso quando declarado; último ano.
  - **MDIC (visão do Brasil):** FOB e kg no período, última ocorrência, quantidade estatística com unidade e marca de inconsistência.
  - Estado por fonte (R12.6):
    - `not_declared` → "sem declaração do país desde <lastPeriod>", com os anos guardados exibidos e nunca "nenhum registro" (R12.6.1, AT73);
    - ponteiro de versão antiga → "não atualizado em <mês>" (AT72).
  - Correspondência com o catálogo (R12.4, AT22): igual à revisão 1, agora pelo SH6 (`product_codes` HS de 4/6 dígitos como prefixo, ou NCM igual à do MDIC).
  - O aviso literal de R1.4.2.
  - **Nenhuma soma entre fontes** (AT74).
- Uma linha só aparece com `compra identificada` se tiver valor > 0 em pelo menos uma fonte. Isso define a lista selecionável para a T7 (R12.14).

**Intenções de teste:**
- *nenhuma chamada externa*: `fetch` global substituído por um que falha o teste se for chamado. **Falha se:** a análise consultar fonte (AT71).
- *país atrasado*: Comtrade `not_declared` com último ano 2023 e MDIC com dados → mensagem "sem declaração do país desde 2023" e MDIC visível. **Falha se:** aparecer "nenhum registro" (AT73, Review Focus 3).
- *parte do Brasil só na Comtrade*: café com Comtrade (todas 100, Brasil 30) e MDIC FOB 40 → parte 30%; nenhum campo com 70 ou 140. **Falha se:** o MDIC entrar na conta (AT74).
- *código pendente não comprova*: **Falha se:** `pending` contar como correspondência (AT22).
- *análise não toca empresas*: **Falha se:** gravar em `evidence`, `company_conditions` ou `scores` (AT23).

**Defesas (5g):**
- Rota: autenticada; perfis operacionais. Cap 2 KB.
- Saída: `textContent`.
- CSRF: `assertSameOrigin`. Cookie: não se aplica.
- Campo opcional: `periodMonths` ausente = parâmetro.
- Exclusão: análises nunca apagadas.
- Config de teste: R2 do harness com JSON de fixture.

**Commit:** `feat: análise de país a partir da lista mensal`

---

## Tarefa 7: Seleção de commodities e campanhas

**Requisito:** R12.7–R12.9, R12.14, R16.1, R28.17, AT61, AT75.

**Files:** Create `src/selections.js`, `test/selecao.test.mjs`; Modify `src/worker.js` (rotas), `src/fichas.js` (trava de R12.9)

Mesmo contrato da revisão 1, com três mudanças:
- **Cada item** precisa ter todas as suas subposições `hs6` presentes na análise com `compra identificada`; senão 422 `not_in_country_list` (R12.14, AT75).
- A seleção exige análise com ao menos uma fonte `purchase_identified`.
- `commodity_selections.items_json` usa `hs6` no lugar de `ncms`.

Continuam iguais à revisão 1:
- uma campanha por item com `productId`, `language` do país, `analysis_id` e `selection_id`;
- item fora do catálogo → produto `identity_status='pending'` + validação comercial obrigatória antes de ficha (R12.9);
- 3ª campanha ativa no mercado internacional → `waiting` (R28.17, AT61).

**Intenções de teste:**
- *fora da lista é recusado*: **Falha se:** a checagem de R12.14 sair (AT75).
- *seleção antes de campanha*, *validação comercial*, *terceira espera*: como na revisão 1. **Falha se:** qualquer uma delas sair.

**Defesas (5g):** como na revisão 1. Cap 64 KB, no máximo 20 itens, `hs6` casando `^\d{6}$`.
**Commit:** `feat: seleção de commodities a partir da lista do país`

---

## Tarefa 8: Empresas no exterior e condições R12.10

Sem mudança de contrato em relação à **Tarefa 6 da revisão 1** (arquivada em `plano3-internacional-rev1.md`), reproduzida aqui para quem lê só este arquivo.

**Requisito:** R12.10, R13.2–R13.4, R13.6, R13.7, R14 (porte estrangeiro), R1.1, R1.2, R15, R18.6, T7.

**Files:** Create `src/foreign-companies.js`, `test/empresas-exterior.test.mjs`; Modify `src/companies.js`, `src/worker.js`

**Interfaces:**
- `createForeignCompany(env, actor, { countryIso3, legalName, tradeName?, registrationId?, registrationIdType?, sourceLabel, sourceUrl?, campaignId })`:
  - O país precisa existir em `countries`.
  - Dedup por `(country_code, registration_id)`. Sem identificador, o nome parecido gera pendência, não fusão.
  - Cria as 3 condições em `pending`.
- `setCondition(env, actor, companyId, productId, condition, { status, evidenceId? })`:
  - `confirmed` exige evidência da **mesma empresa**, `category` diferente de `market`, `validation_status='valid'` e `metadata_json.supports` com o nome da condição (R13.4).
  - `not_found` exige nota.
- `setSize(env, actor, companyId, { sizeBand, source })` (gestores); `icpStatus` usa `sizeBand` quando não há código da Receita: `small` → `out_small`; `giant` sem relacionamento → `out_giant`; `medium`/`medium_plus` → `in_icp`; ausente → `pending_size`.
- `contacts.timezone` validado com `Intl.DateTimeFormat`; inválido → 422 `timezone_invalid`.
- Camada 2 com links de pesquisa **montados, não executados**. Sem raspagem e sem fonte paga (R13.7).
- **Novo:** a interface mostra, ao lado da empresa, a linha da lista mensal do país para a commodity da campanha, marcada "dado do país, não da empresa" (R1.4.2).

**Intenções de teste:**
- *dado de país não confirma condição*: evidência `market` → 422 (AT23).
- *evidência de outra empresa não serve*.
- *evidência precisa dizer o que sustenta*: sem `supports` → 422.
- *mesmo registro, mesma empresa*.
- *fuso inválido recusado*: "Europe/Berlim" → 422.
- *porte médio entra no ICP*.

Cada teste **falha se** a respectiva checagem sair.

**Defesas (5g):**
- Rota: autenticada; `setSize` e exceções só para gestores. Cap 64 KB; textos ≤ 500.
- Saída: `textContent`.
- CSRF: `assertSameOrigin`. Cookie: não se aplica.
- Config de teste: harness.

**Commit:** `feat: empresas no exterior com evidência por condição`

---

## Tarefa 9: Modelos em inglês e revisor PV em inglês

Sem mudança em relação à **Tarefa 7 da revisão 1**, reproduzida aqui:

**Requisito:** PV1–PV12, R17.1–R17.6, R28.9, R28.15, AT24, AT53–AT55.

**Files:** Create `src/templates/prospeccao-vendas-en.js`, `tests/revisor-en.test.mjs`; Modify `src/review.js`, `src/templates/prospeccao-vendas.js`

- **Tradução fiel** dos blocos da skill: E-mails 1–4, variante ao influenciador e roteiros L0/L1/L2/LinkedIn. Assunto do E-mail 1: `<Commodity> supplier`.
- ✋ **Portão:** a tradução é apresentada **lado a lado com o português** e só entra com a aprovação de Rogério.
- Assinatura em inglês: nome, endereço (`EAG_POSTAL_ADDRESS`) e `To stop receiving these messages, reply "unsubscribe" or use this link: <URL>`.
- `generateSequence` recebe `language`. Países lusófonos usam o português.
- Aviso fixo de R28.15 na ficha internacional.
- Revisor em inglês:
  - PV1: "start a conversation" e "20 minutes".
  - PV7: `/\bUS\$|\bprice|pricing|quot(e|ation)|\blots?\b|stock|inventory|certif|payment|delivery (time|date)/i`.
  - PV9: `^[A-Z][a-z]+( [a-z]+)* supplier$`.
  - PV10: "sorry to bother", "apologies for", "could you forward me to purchasing".
  - PV12 e R19.13 como na revisão 1.

**Intenções de teste:**
- *a sequência padrão em inglês passa*: **Falha se:** a tradução violar o próprio revisor.
- *"competitive price" reprova PV7* (AT24).
- *"70% of manufacturers struggle" reprova PV9* (AT55).
- *Portugal usa português*: **Falha se:** o idioma vier fixo.
- *ficha traz a lacuna*: **Falha se:** o aviso de R28.15 faltar.

**Defesas (5g):** sem rota nova; texto puro; `firstName` ausente → "Hi,".
**Commit:** `feat: modelos e revisor PV em inglês`

---

## Tarefa 10: Envio, respostas e descadastro no fuso e idioma do destinatário

Sem mudança em relação à **Tarefa 8 da revisão 1**, reproduzida aqui:

**Requisito:** R18.6, R19.2 itens 7 e 12, R19.10, R20, R21.7, R21.10, R28.13; Review Focus 5.

**Files:** Modify `src/fichas.js`, `src/sending.js`, `src/inbound.js`, `src/unsubscribe.js`; Create `test/internacional-envio.test.mjs`

- Campanha internacional exige `contacts.timezone` em cada destinatário (422 `timezone_pending`, R18.6).
- `preSendCheck`: janela `send_hours:<market>` e "dia civil anterior" no fuso do contato. O teto diário é contado no dia de `America/Sao_Paulo` e soma os dois mercados (R19.10). Feriados não são tratados; a limitação fica registrada.
- `inbound.classify` em inglês:
  - `unsubscribe|remove me|stop|opt out|take me off`;
  - auto-resposta: `Automatic reply|Auto-Reply|Out of Office|OOO`;
  - pedido de preço: `price|pricing|quote|quotation|price list|catalog(ue)?|proposal|presentation`.
- Página `/u/*` bilíngue, sem dado pessoal.

**Intenções de teste (relógio injetado):**
- *Tóquio fora da janela espera*.
- *dias não seguidos no fuso do destinatário*.
- *o teto soma os mercados*.
- *respostas em inglês* ("Please remove me from your list", "Out of Office: back Monday", "Could you send me your price list?").
- *ficha sem fuso não aprova, e o nacional não passa a exigir fuso por contato*.

Cada teste **falha se** a regra usar o fuso errado, tiver teto por mercado ou deixar de classificar.

**Commit:** `feat: envio e respostas no fuso e idioma do destinatário`

---

## Tarefa 11: Interface Internacional e dashboard

**Requisito:** R12 (tela), R12.6.1, R12.12, R12.13, R12.15, R24.1, R24.3, R1.4.2, R28.17.

**Files:** Modify `public/index.html`, `public/app.css`, `public/app.js`, `scripts/validate-site.mjs`

**Contrato:**
- **Países:** lista com busca. Cada país mostra o estado das duas fontes e a data da versão vigente, com "não atualizado em <mês>" quando for o caso.
- **Análise:**
  - tabela por SH6 com dois blocos lado a lado: **"Compras declaradas pelo país (CIF, anual)"**, com todas as origens, Brasil e a parte do Brasil; e **"Exportações do Brasil (FOB, mensal)"**;
  - "sem declaração desde …" quando for o caso;
  - destaque do catálogo só para `confirmed`;
  - aviso de R1.4.2;
  - nenhuma coluna de soma entre fontes.
- **Seleção:** só linhas com `compra identificada` são selecionáveis (R12.14).
- **Admin:** tela "Lista mensal" com as versões, as contagens e o botão "Atualizar este país" (motivo obrigatório, R12.15).
- **Empresa estrangeira e dashboard:** como na revisão 1.
- Tudo por `textContent`. `validate-site.mjs` passa a exigir `data-screen="internacional"`, `/api/country-analyses`, `/api/trade-list/versions`, `/api/foreign-companies`.

**Verificação:** manual: "Lista mensal → Alemanha → café com as duas fontes e a parte do Brasil → escolher café → campanha → importador com evidência → fuso Europe/Berlin → ficha em inglês". Automático: `npm run check`.
**Commit:** `feat: interface internacional com a lista mensal`

---

## Tarefa 12: Validação pelo Worker, chave da Comtrade e liberação (portões humanos)

**Requisito:** T6, T13, R17.6, R26, premissas da Spec.

**Files:** Modify `docs/eag-compass-t6-comexstat.md` (seção "Teste pelo Worker"), `docs/eag-compass-t1-validacao.md` (amostra internacional)

**Roteiro (✋ com Rogério; cada resultado registrado com data):**
1. **Conta Comtrade:** Rogério cria a conta gratuita em `https://comtradedeveloper.un.org/`, assina o produto gratuito e grava a chave com `npx wrangler secret put COMTRADE_KEY`. Claude não cria contas.
2. **Termos:** ler a "Policy on use and re-dissemination" da Comtrade e registrar se permite guardar a lista para uso interno. Se não permitir, a Comtrade sai da rotina e a Spec volta para revisão (premissa da Spec).
3. **Chamada real com chave** para `DEU` e um bloco. Conferir `partnerCode=0,76`, `period` com lista, o que significa `partner2Code`/`customsCode` no total, e o `count`. Registrar as respostas copiadas e ajustar o orçamento de chamadas se preciso.
4. **Pelo Worker publicado:** uma versão `manual` para `DEU`. Conferir que o MDIC responde ao Worker sem desafio da Cloudflare e que os totais de café 2025 batem com T6 (340.503.519 kg). Se algum host bloquear o Worker, o fluxo Internacional **não** é liberado e o item volta à Fase 4.
5. **Primeira rotina mensal completa** (disparada manualmente, com o mesmo código do cron). Medir a duração, as chamadas por dia, os 429 e o tamanho no R2, e registrar.
6. **Amostra R17.6:** uma sequência em inglês para um contato interno em outro fuso, pelo modo `internal_test` do Plano 2. Rogério revisa o texto e o horário.
7. ✋ Com 1–6 registrados, Rogério autoriza por escrito "liberar internacional". Só então o admin grava `international_enabled = true` com `evidenceRef`; antes disso fichas internacionais não são aprovadas.

**Intenções de teste (automáticas):** *internacional desligado não aprova*. **Falha se:** a ausência do parâmetro liberar.
**Commit:** `docs: validação das fontes pelo Worker e amostra internacional`

---

## Cobertura de requisitos

| Requisito | Tarefa |
| --- | --- |
| R1.4.1–R1.4.3 | T3, T4, T6, T11 |
| R12.1–R12.6.1 | T2, T3, T4, T6, T11 |
| R12.7–R12.9, R12.14 | T7 |
| R12.10 | T8 |
| R12.11, R12.12, R12.15 | T5, T11 |
| R12.13 | T4, T6, T11 |
| R13.2–R13.7 (internacional) | T5, T8 |
| R14 (porte estrangeiro) | T8 |
| R17.6 (caso internacional), PV12, R28.15 | T9, T12 |
| R18.6, R19.2 itens 7 e 12, R19.10, R20, R21 (inglês) | T10 |
| R24.1, R24.3 | T11 |
| R28.17 (internacional) | T7 |
| AT20–AT23, AT61, AT71–AT75 | T5, T6, T7, T8 |
| Premissas T6/T13 | T12 |

**Fora deste plano:**
- Fonte paga de importadores (R13.7).
- Feriados por país.
- Idiomas além de inglês e português.
- Plano pago da Comtrade: só se a T12 mostrar limite insuficiente.
- A API do Comex Stat: deixa de ser usada. As armadilhas C1–C7 ficam registradas em T6 para uso futuro.
