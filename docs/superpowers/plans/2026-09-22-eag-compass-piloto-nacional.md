> **Revisão consolidada:** executar a fila `docs/implementation/sequence.json` e aplicar `docs/revisao/CORRECOES-DOS-PLANOS.md`. O código atual já substitui exemplos antigos; não sobrescrevê-lo com os snippets deste plano.

# EAG Compass v2.0 — Plano 2: Piloto Nacional (Etapa 1) — Implementation Plan

> **Revisão técnica 23/09/2026:** ler `../../revisao/CORRECOES-DOS-PLANOS.md` e `../../revisao/RELATORIO.md` antes de executar. Contratos corrigidos de migração, concorrência, envio e escopo prevalecem sobre os exemplos históricos abaixo; tarefas futuras não foram marcadas como implementadas.
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Com a Fundação pronta (Plano 1), entregar o piloto nacional: Radar de compradores por raio, empresas com evidências/perfil/ICP, contatos validados, fichas com textos da `/prospeccao-vendas` revisados (PV1–PV12), envio 1 a 1 pela caixa Hostinger com rampa e parada automática, leitura de respostas por IMAP com pausa empresa+commodity, descadastro público de um clique, tarefas manuais, migração do OpenClaw e interface completa — **com o primeiro e-mail externo liberado só depois do teste interno de T1 e de portão humano**.

**Architecture:** Mesmo Worker do Plano 1. Buscas e envios rodam por **Queues** (mensagens tipadas) disparadas por **Cron** a cada 5 minutos; dados no D1; mensagens recebidas guardadas no R2; tokens de terceiros em cache no KV. Transporte externo só em quatro pontos: Casa dos Dados (lista), LocationIQ (geocodificação), Snov.io (validação), Hostinger SMTP/IMAP (envio/respostas — exceção P19). Textos gerados por **modelos determinísticos** copiados da skill, nunca por IA no disparo (R17.2).

**Tech Stack:** Plano 1 + `worker-mailer@1.2.1` (SMTP por `cloudflare:sockets`), `imapflow@2.0.6` (IMAP em Workers com `nodejs_compat`, TLS implícito), MapLibre GL JS 6.x + `pmtiles` + `@turf/circle` (mapa), binding `ratelimits`.

**Spec:** `docs/eag-compass-spec.md` · **Constituição:** `docs/eag-compass-constituicao.md` · **Skill:** `/prospeccao-vendas` (T12 rev. 4, SHA-256 `33bd093f5dcb87a7d4aa51d31597c6d6ddfc637097693e3830a38f9b219f9dd8`) · **Design:** `docs/eag-compass-design.md` · **Pré-requisito:** Plano 1 concluído (migrações 0001–0005, `src/http.js`, `src/auth.js`, `src/parameters.js`, `src/catalog.js`, `src/campaigns.js`, `src/suppression.js`).

---

## Global Constraints

Todas as do Plano 1 continuam valendo. Acrescentam-se:

- **Nenhum e-mail a destinatário externo** antes da Tarefa 17 concluída **e** do portão humano de liberação do canal (R26.3, R26.6). Até lá, o canal `email` fica em `internal_test` e o envio só aceita destinatários da lista `INTERNAL_TEST_RECIPIENTS`.
- **Volume (aprovado):** rampa 5 → 10 → 15 → 20 por dia (semanas 1–4+), 15–25 min entre envios, só dias úteis 09:00–17:00 no fuso do destinatário (piloto nacional: `America/Sao_Paulo`), parada automática com hard bounce ≥ 3% na semana, marcação de spam ou aviso da Hostinger (R19.10–R19.12). Valores lidos dos parâmetros da T8 do Plano 1, nunca fixos em código.
- **Todo e-mail** contém: remetente `rogeriopalhari@eagagro.com`, `Reply-To` igual ao remetente, endereço físico da EAG na assinatura, forma de saída visível e cabeçalhos RFC 8058 (R19.13, R21.7, R21.10).
- **Sem IA no disparo, sem reescrita no disparo:** o envio usa o texto congelado da versão aprovada, byte a byte (R17.2, R19.1, AT25).
- **Sem resposta automática ao comprador** (R19.9). Nenhum código envia e-mail a um endereço que não esteja numa etapa de ficha aprovada (exceção: prova para Rogério, R18.10, e testes internos).
- **Método de prospecção:** só a `/prospeccao-vendas` (P17). Textos seguem `references/scripts-abordagem.md` da skill; o hash da skill é conferido pelo portão (T8).
- **Fontes externas** entram por adaptador (`src/adapters/*.js`) com dublê nos testes; fixtures copiados da documentação citada em cada tarefa.
- **Rastreamento de abertura (K5) desligado:** nenhum pixel nem link rastreado enquanto o parâmetro `open_tracking_enabled:email` não existir (T1 e T11 não comprovados).

### Portões

| Portão | Comando | Linha de base (fim do Plano 1) | Estado exigido |
| --- | --- | --- | --- |
| Testes puros | `npm run test:unit` | contagem ao fim do Plano 1 | 100% passando |
| Testes de Worker | `npm run test:worker` | contagem ao fim do Plano 1 | 100% passando |
| Checagem completa | `npm run check` | passando | passando |
| Migrações locais | `npx wrangler d1 migrations apply eag_compass --local` | 0001–0005 | todas aplicadas |
| Hash da skill | `npm run check:skill` (criado na T8) | não existe | passando |

Seção `## Portões` obrigatória no relatório de cada tarefa, com antes/depois. **Regra do erro herdado** idêntica ao Plano 1: nenhum erro vira ruído; cada um é listado com dono e prazo.

---

## Review Focus

1. **Resposta que chega em outra thread** (o comprador responde a um e-mail antigo ou encaminha para um colega que responde) — sem `In-Reply-To` conhecido, a mensagem de um endereço que recebeu passo aprovado deve ser correlacionada pelo remetente e pausar a empresa+commodity; nunca ser ignorada. Teste na Tarefa 11.
2. **Worker cai entre "enviado pela Hostinger" e "gravado no D1"** — o passo fica `indeterminate` e só é reenviado depois da reconciliação pela pasta de enviados (Message-ID). Teste na Tarefa 10.
3. **Cron dispara duas vezes (sobreposição)** — o mesmo passo não sai duas vezes. Teste na Tarefa 10.
4. **Link de descadastro aberto por robô de segurança do e-mail do comprador** (GET automático) — GET só mostra a página com o botão; só POST suprime. Teste na Tarefa 12.
5. **Busca de 1.500 km com milhares de candidatos e uma fonte que falha no meio** — resultados parciais preservados, cobertura "parcial" com o motivo, retomada sem duplicar. Teste na Tarefa 4.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Dona |
| --- | --- | --- |
| `migrations/0006_piloto_nacional.sql` | Esquema do piloto | T1 |
| `migrations/0007_seed_municipios.sql` | 5.570 municípios com centroide | T2 |
| `migrations/0008_seed_setores_cnae.sql` | Setores usuários → CNAE | T3 |
| `scripts/gen-municipios-sql.mjs` | Gera a 0007 a partir do CSV fixado | T2 |
| `src/geo.js` | Distância, municípios no raio, precisão | T2 |
| `src/adapters/casadosdados.js` | Busca e consulta de CNPJ | T3 |
| `src/adapters/locationiq.js` | Geocodificação | T5 |
| `src/adapters/snov.js` | Token e validação de e-mail | T7 |
| `src/adapters/mailbox.js` | SMTP (worker-mailer) e IMAP (imapflow) | T10, T11 |
| `src/search.js` | Buscas versionadas, partições, candidatos | T4 |
| `src/companies.js` | Unidades, dedup, evidências, perfis, ICP, exceções, contatos | T6 |
| `src/templates/prospeccao-vendas.js` | Modelos da skill + constante do hash | T8 |
| `src/review.js` | Revisor PV1–PV12 + R19.13 | T8 |
| `src/fichas.js` | Fichas versionadas, aprovação, prova | T9 |
| `src/sending.js` | Agendador, pré-envio, rampa, idempotência, reconciliação | T10 |
| `src/inbound.js` | Leitura, classificação e correlação de respostas | T11 |
| `src/unsubscribe.js` | Tokens e página pública de descadastro | T12 |
| `src/changes.js` | Efeitos de pausas e mudanças | T13 |
| `src/tasks.js` | Tarefas manuais, reuniões, linha do tempo | T14 |
| `src/openclaw.js` | Importação e transferência | T15 |
| `src/compliance.js` | Triagem de sanções pré-envio | T16 |
| `src/channels.js` | Estado dos canais e liberação | T17 |
| `src/queue.js` | Despacho das mensagens de fila por `type` | T4 (cria), T5, T10 (acrescentam) |
| `public/*` | Telas do piloto | T18 |
| `scripts/check-skill.mjs` | Portão do hash da skill | T8 |
| `docs/eag-compass-t1-validacao.md` | Registro do teste interno de T1 | T17 |

---

## Recursos nomeados

| Recurso | Nome | Dono |
| --- | --- | --- |
| Migração | `0006_piloto_nacional.sql` | T1 |
| Migração | `0007_seed_municipios.sql` | T2 |
| Migração | `0008_seed_setores_cnae.sql` | T3 |
| Migrações futuras | `0009_*` em diante | Plano 3 |
| Tabelas novas | `municipalities`, `sector_cnae`, `company_units`, `buyer_profiles`, `searches`, `search_partitions`, `search_candidates`, `fichas`, `ficha_versions`, `sequence_steps`, `send_log`, `send_ramp`, `inbound_messages`, `tasks`, `meetings`, `channels`, `openclaw_imports`, `openclaw_transfers` | T1 (DDL); seeds de `municipalities` T2 e `sector_cnae` T3 |
| Colunas novas | `companies.cnpj_root`; `contacts.prospect_role`, `contacts.email_validation`, `contacts.email_validated_at`, `contacts.email_validation_provider`, `contacts.email_hash`, `contacts.relationship_note` | T1 |
| Rotas | `POST /api/searches`, `GET /api/searches/:id`, `GET /api/searches/:id/candidates` | T4 |
| Rotas | `POST /api/units/:id/geocode` | T5 |
| Rotas | `GET/POST /api/companies/:id/units`, `POST /api/companies/:id/profiles`, `POST /api/companies/:id/exceptions`, `PATCH /api/contacts/:id` | T6 |
| Rotas | `POST /api/contacts/:id/validate-email` | T7 |
| Rotas | `POST /api/fichas`, `GET /api/fichas/:id`, `PUT /api/fichas/:id/draft`, `POST /api/fichas/:id/approve`, `POST /api/fichas/:id/defer`, `POST /api/fichas/:id/discard`, `POST /api/fichas/:id/proof` | T9 |
| Rotas | `GET /api/sending/today`, `POST /api/sending/reconcile/:stepId` | T10 |
| Rotas | `GET /api/inbound` | T11 |
| Rotas públicas | `GET /u/:token`, `POST /u/:token` (fora do Access) | T12 |
| Rotas | `GET/POST /api/tasks`, `POST /api/tasks/:id/complete`, `POST /api/meetings`, `GET /api/companies/:id/timeline` | T14 |
| Rotas | `POST /api/openclaw/import`, `POST /api/openclaw/transfers` | T15 |
| Rotas | `POST /api/compliance/lists`, `POST /api/compliance/screen/:companyId` | T16 |
| Rotas | `GET /api/channels`, `POST /api/channels/:channel/state` | T17 |
| Mensagens de fila (`body.type`) | `search_partition`, `geocode_unit`, `send_step` | T4, T5, T10 |
| Cron | `"*/5 * * * *"` (agendador de envio + leitura IMAP + partições pendentes) e `"17 2 * * *"` existente | T10 (acrescenta o de 5 min) |
| Binding | `UNSUB_LIMITER` (`ratelimits`, `namespace_id: "2001"`, `simple: { limit: 20, period: 60 }`) | T12 |
| Flag | `compatibility_flags: ["nodejs_compat"]` | T11 |
| Assets | `run_worker_first` passa de `["/api/*"]` para `["/api/*", "/u/*", "/tiles/*"]` | T12 (`/u/*`), T18 (`/tiles/*`) |
| Vars | `MAILBOX_USER` (`rogeriopalhari@eagagro.com`), `SMTP_HOST` (`smtp.hostinger.com`), `SMTP_PORT` (`465`), `IMAP_HOST` (`imap.hostinger.com`), `IMAP_PORT` (`993`), `LOCATIONIQ_HOST` (`us1.locationiq.com`), `PUBLIC_BASE_URL`, `EAG_POSTAL_ADDRESS` | T10 (e-mail), T5 (LocationIQ), T12 (URL) |
| Secrets | `MAILBOX_PASSWORD`, `CASADOSDADOS_API_KEY`, `LOCATIONIQ_KEY`, `SNOV_CLIENT_ID`, `SNOV_CLIENT_SECRET`, `UNSUB_TOKEN_KEY`, `INTERNAL_TEST_RECIPIENTS` | T3, T5, T7, T10, T12, T17 |
| Chaves KV | `snov:token`, `cron:lock:send`, `cron:lock:imap` | T7, T10, T11 |
| Prefixo R2 | `inbound/<uidvalidity>/<uid>.eml`, `evidence/<companyId>/<uuid>` | T11, T6 |
| Parâmetros novos | `open_tracking_enabled:email` (**não semeado**), `send_timezone:national` = `"America/Sao_Paulo"`, `send_hours:national` = `{"start":"09:00","end":"17:00","weekdays":[1,2,3,4,5]}` | T10 (seed via rota admin da T8/P1, registrado no relatório) |
| Constante | `SKILL_SHA256`, `TEMPLATES_VERSION = "pv-1.0.0"`, `GENERATOR_VERSION = "tpl-1.0.0"` | T8 |

---

## Tarefa 1: Migração 0006 — esquema do piloto

**Requisito:** R1.1.3, R2.1.1, R11.2, R11.5, R11.6, R11.12, R13.5, R14.1, R14.6–R14.8, R15.1, R17.1, R18.1–R18.8, R19.4–R19.8, R19.10–R19.12, R20.1–R20.3, R23.2, R23.3, R25.1–R25.3, R26.1, R28.10, R28.11.

**Files:** Create `migrations/0006_piloto_nacional.sql`, `test/migracao-0006.test.mjs`

**Contrato — SQL exato:**

```sql
PRAGMA defer_foreign_keys = true;

CREATE TABLE municipalities (
  ibge_code INTEGER PRIMARY KEY, name TEXT NOT NULL, uf_code INTEGER NOT NULL, uf TEXT NOT NULL,
  lat REAL NOT NULL, lon REAL NOT NULL, source TEXT NOT NULL
);
CREATE INDEX idx_municipalities_uf ON municipalities(uf);

CREATE TABLE sector_cnae (
  sector_key TEXT NOT NULL, cnae_code TEXT NOT NULL, label TEXT NOT NULL, source TEXT NOT NULL,
  PRIMARY KEY (sector_key, cnae_code)
);

ALTER TABLE companies ADD COLUMN cnpj_root TEXT;
CREATE UNIQUE INDEX idx_companies_cnpj_root ON companies(tenant_id, cnpj_root) WHERE cnpj_root IS NOT NULL;

CREATE TABLE company_units (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), company_id TEXT NOT NULL REFERENCES companies(id),
  cnpj TEXT NOT NULL, unit_role TEXT NOT NULL DEFAULT 'unknown' CHECK (unit_role IN ('consumer','receiving','headquarters','unknown')),
  trade_name TEXT, logradouro TEXT, numero TEXT, bairro TEXT, municipio_ibge INTEGER REFERENCES municipalities(ibge_code),
  municipio_nome TEXT, uf TEXT, cep TEXT,
  lat REAL, lon REAL,
  geo_precision TEXT NOT NULL DEFAULT 'unknown' CHECK (geo_precision IN ('address','municipality_centroid','manual','unknown')),
  geo_source TEXT, geocoded_at TEXT,
  porte_codigo TEXT, porte_descricao TEXT, porte_fonte TEXT,
  situacao TEXT, data_abertura TEXT, natureza_juridica TEXT, capital_social REAL,
  cnae_principal TEXT, cnaes_secundarios_json TEXT NOT NULL DEFAULT '[]',
  source_label TEXT NOT NULL, source_ref TEXT, consulted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, cnpj)
);

CREATE TABLE buyer_profiles (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), company_id TEXT NOT NULL REFERENCES companies(id),
  unit_id TEXT REFERENCES company_units(id), product_id TEXT NOT NULL REFERENCES products(id),
  profile_class TEXT NOT NULL CHECK (profile_class IN ('final_consumer_confirmed','possible_final_consumer','trader_distributor','unconfirmed')),
  basis TEXT NOT NULL, evidence_id TEXT REFERENCES evidence(id),
  icp_status TEXT NOT NULL CHECK (icp_status IN ('in_icp','out_small','out_giant','out_trader','pending_size')),
  exception_by TEXT, exception_at TEXT, exception_reason TEXT,
  updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX idx_buyer_profiles_key ON buyer_profiles(tenant_id, company_id, COALESCE(unit_id,''), product_id);

ALTER TABLE contacts ADD COLUMN prospect_role TEXT CHECK (prospect_role IN ('decision_maker','influencer','provisional_decision_maker','other'));
ALTER TABLE contacts ADD COLUMN email_validation TEXT CHECK (email_validation IN ('pending','valid','not_valid','unknown','catchall'));
ALTER TABLE contacts ADD COLUMN email_validated_at TEXT;
ALTER TABLE contacts ADD COLUMN email_validation_provider TEXT;
ALTER TABLE contacts ADD COLUMN email_hash TEXT;
ALTER TABLE contacts ADD COLUMN relationship_note TEXT;
CREATE INDEX idx_contacts_email_hash ON contacts(tenant_id, email_hash);

CREATE TABLE searches (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  version INTEGER NOT NULL, parent_search_id TEXT REFERENCES searches(id),
  origin_city TEXT NOT NULL, origin_uf TEXT NOT NULL, origin_ibge INTEGER NOT NULL REFERENCES municipalities(ibge_code),
  origin_lat REAL NOT NULL, origin_lon REAL NOT NULL,
  origin_precision TEXT NOT NULL CHECK (origin_precision IN ('city_centroid','address','coordinate')),
  radius_km INTEGER NOT NULL, sector_keys_json TEXT NOT NULL, cnae_codes_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','partial','complete','failed')),
  coverage_note TEXT, candidates_count INTEGER NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0, started_at TEXT, finished_at TEXT,
  request_key TEXT NOT NULL, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, request_key), UNIQUE (campaign_id, version)
);

CREATE TABLE search_partitions (
  id TEXT PRIMARY KEY, search_id TEXT NOT NULL REFERENCES searches(id),
  municipio_ibge INTEGER NOT NULL, page INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
  attempts INTEGER NOT NULL DEFAULT 0, error TEXT, done_at TEXT,
  UNIQUE (search_id, municipio_ibge, page)
);

CREATE TABLE search_candidates (
  search_id TEXT NOT NULL REFERENCES searches(id), unit_id TEXT NOT NULL REFERENCES company_units(id),
  distance_km REAL, distance_basis TEXT NOT NULL CHECK (distance_basis IN ('address','municipality_centroid','unknown')),
  inside_radius TEXT NOT NULL CHECK (inside_radius IN ('confirmed','estimated','outside','unknown')),
  PRIMARY KEY (search_id, unit_id)
);

CREATE TABLE fichas (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id), campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_approval','approved','superseded','deferred','discarded')),
  current_version INTEGER NOT NULL DEFAULT 1, row_version INTEGER NOT NULL DEFAULT 1,
  status_reason TEXT, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, company_id, campaign_id)
);

CREATE TABLE ficha_versions (
  id TEXT PRIMARY KEY, ficha_id TEXT NOT NULL REFERENCES fichas(id), version_no INTEGER NOT NULL,
  content_enc TEXT NOT NULL,              -- JSON cifrado (AES-GCM, PII_ENCRYPTION_KEY): destinatários, textos, intervalos
  content_sha256 TEXT NOT NULL,           -- hash do JSON em claro, para provar "byte a byte"
  pv_report_json TEXT NOT NULL,
  skill_sha256 TEXT NOT NULL, templates_version TEXT NOT NULL, generator_version TEXT NOT NULL,
  approved_by TEXT, approved_at TEXT,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (ficha_id, version_no)
);

CREATE TABLE sequence_steps (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  ficha_id TEXT NOT NULL REFERENCES fichas(id), ficha_version_id TEXT NOT NULL REFERENCES ficha_versions(id),
  company_id TEXT NOT NULL REFERENCES companies(id), product_id TEXT NOT NULL REFERENCES products(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  step_no INTEGER NOT NULL, channel TEXT NOT NULL CHECK (channel IN ('email','call','linkedin')),
  kind TEXT NOT NULL CHECK (kind IN ('auto_email','manual_task')),
  planned_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','blocked','waiting_sequence','queued','sending','accepted','temp_failed','perm_failed','indeterminate','cancelled','superseded')),
  block_reason TEXT, message_id TEXT UNIQUE, attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (ficha_id, contact_id, step_no)
);
CREATE INDEX idx_steps_due ON sequence_steps(tenant_id, status, planned_date);

CREATE TABLE send_log (
  id TEXT PRIMARY KEY, step_id TEXT NOT NULL REFERENCES sequence_steps(id),
  event TEXT NOT NULL CHECK (event IN ('requested','accepted','temp_failed','perm_failed','indeterminate','reconciled_sent','reconciled_not_sent','blocked')),
  detail TEXT, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE send_ramp (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id), channel TEXT NOT NULL DEFAULT 'email',
  ramp_started_on TEXT NOT NULL, current_step INTEGER NOT NULL DEFAULT 0,
  last_step_up_on TEXT, stopped_at TEXT, stopped_reason TEXT
);

CREATE TABLE inbound_messages (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  uidvalidity INTEGER NOT NULL, imap_uid INTEGER NOT NULL,
  message_id TEXT, in_reply_to TEXT, references_json TEXT NOT NULL DEFAULT '[]', from_hash TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('human','auto_reply','bounce','unsubscribe','unclassified')),
  step_id TEXT REFERENCES sequence_steps(id), company_id TEXT REFERENCES companies(id), product_id TEXT REFERENCES products(id),
  r2_key TEXT NOT NULL, received_at TEXT NOT NULL, processed_at TEXT,
  UNIQUE (tenant_id, uidvalidity, imap_uid)
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), company_id TEXT NOT NULL REFERENCES companies(id),
  contact_id TEXT REFERENCES contacts(id), ficha_id TEXT REFERENCES fichas(id), step_id TEXT REFERENCES sequence_steps(id),
  kind TEXT NOT NULL CHECK (kind IN ('call_l0','call_l1','call_l2','linkedin','reply_followup','meeting_confirm','return_suggested','hostinger_alert')),
  due_date TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','suspended','cancelled')),
  suspended_reason TEXT, result_json TEXT, done_by TEXT, done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_tasks_open ON tasks(tenant_id, status, due_date);

CREATE TABLE meetings (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), company_id TEXT NOT NULL REFERENCES companies(id),
  contact_id TEXT REFERENCES contacts(id), scheduled_for TEXT NOT NULL, duration_min INTEGER NOT NULL CHECK (duration_min BETWEEN 10 AND 120),
  channel TEXT NOT NULL, invite_sent INTEGER NOT NULL CHECK (invite_sent IN (0,1)),
  created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE channels (
  tenant_id TEXT NOT NULL REFERENCES tenants(id), channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','linkedin')),
  state TEXT NOT NULL CHECK (state IN ('planned','internal_test','enabled')),
  evidence_ref TEXT, changed_by TEXT NOT NULL, changed_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, channel)
);
INSERT INTO channels (tenant_id, channel, state, changed_by, changed_at) VALUES
  ('eag-internal','email','planned','system-admin','2026-09-22T00:00:00Z'),
  ('eag-internal','whatsapp','planned','system-admin','2026-09-22T00:00:00Z'),
  ('eag-internal','linkedin','planned','system-admin','2026-09-22T00:00:00Z');

CREATE TABLE openclaw_imports (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), r2_key TEXT NOT NULL,
  counts_json TEXT NOT NULL, imported_by TEXT NOT NULL, imported_at TEXT NOT NULL
);
CREATE TABLE openclaw_transfers (
  tenant_id TEXT NOT NULL REFERENCES tenants(id), company_id TEXT NOT NULL REFERENCES companies(id),
  retired_in_openclaw INTEGER NOT NULL DEFAULT 0 CHECK (retired_in_openclaw IN (0,1)),
  confirmed_by TEXT, confirmed_at TEXT,
  PRIMARY KEY (tenant_id, company_id)
);
```

**Intenções de teste:**
- *um passo por ficha+contato+número* — segundo insert com mesmo `(ficha_id, contact_id, step_no)` → erro UNIQUE. **Falha se:** a UNIQUE sair (duplicidade de envio, R19.4).
- *Message-ID único* — dois passos com o mesmo `message_id` → erro. **Falha se:** a UNIQUE sair.
- *mensagem IMAP gravada uma vez* — mesmo `(uidvalidity, imap_uid)` → erro. **Falha se:** a UNIQUE sair (resposta processada duas vezes).
- *perfil único por empresa+unidade+produto, inclusive sem unidade* — dois perfis com `unit_id NULL` para a mesma empresa/produto → erro. **Falha se:** o índice não usar `COALESCE` (SQLite trata NULL como distinto).
- *canais começam planejados* — os 3 canais `planned`. **Falha se:** alguém semear `email` como `enabled`.

**Comandos:** `npx wrangler d1 migrations apply eag_compass --local` · `npm run test:worker -- test/migracao-0006.test.mjs`
**Defesas (5g):** rota/saída/CSRF/cookie — não se aplica; campo opcional — colunas novas de `contacts` nulas para contatos antigos = "validação pendente"/"papel desconhecido" (tratado nas T6/T7); exclusão — não se aplica; config de teste — harness do Plano 1.
**Commit:** `feat: esquema do piloto nacional`

---

## Tarefa 2: Municípios e distância

**Requisito:** R11.2, R11.3, R11.5, R11.6, R11.15.

**Files:** Create `scripts/gen-municipios-sql.mjs`, `migrations/0007_seed_municipios.sql` (gerado e commitado), `src/geo.js`, `tests/geo.test.mjs`

**Contrato:**
- Fonte: `https://github.com/kelvins/municipios-brasileiros`, arquivo `csv/municipios.csv`, licença MIT, cabeçalho literal `codigo_ibge,nome,latitude,longitude,capital,codigo_uf,siafi_id,ddd,fuso_horario`, 5.570 linhas de dados (conferido em 2026-09-22). **Fixar o commit** do repositório usado (hash anotado no script e na coluna `source` = `kelvins/municipios-brasileiros@<commit>`).
- UF a partir de `codigo_uf` (tabela IBGE de 27 UFs embutida no script, com citação `https://servicodados.ibge.gov.br/api/v1/localidades/estados`).
- O script gera `INSERT` em lotes de 500 linhas.
- `src/geo.js`:
  - `export function haversineKm(lat1, lon1, lat2, lon2): number` — raio da Terra 6.371 km.
  - `export function boundingBox(lat, lon, radiusKm): { minLat, maxLat, minLon, maxLon }`.
  - `export async function municipalitiesWithin(env, originLat, originLon, radiusKm): Promise<{ ibge_code, name, uf, distance_km }[]>` — pré-filtro SQL pela caixa, filtro final por `haversineKm <= radiusKm`, ordenado por distância.
  - `export function classifyInsideRadius({ distanceKm, basis, radiusKm }): 'confirmed'|'estimated'|'outside'|'unknown'` — `address` + distância ≤ raio → `confirmed`; `municipality_centroid` → `estimated` se ≤ raio, `outside` se > raio + 30 km (margem para município grande — **decisão**: centroide a mais de raio+30 km é considerado fora), senão `estimated`; sem coordenada → `unknown` (R11.6).
  - `export async function originPoint(env, city, uf): Promise<{ ibge, lat, lon, precision: 'city_centroid' }>` — busca por nome normalizado (sem acento, minúsculo) + UF; não encontrado → 422 `origin_not_found` "Cidade não encontrada nesta UF."

**Fixtures:** 3 linhas copiadas literalmente do CSV fixado (Sertãozinho/SP, Ribeirão Preto/SP, Franca/SP), inseridas no teste.

**Intenções de teste (`tests/geo.test.mjs`, `node --test`):**
- *distância conhecida* — Sertãozinho → Ribeirão Preto (coordenadas do fixture) entre 15 e 25 km. **Falha se:** a fórmula trocar lat/lon ou usar graus sem converter para radianos.
- *centroide dentro vira estimado, nunca confirmado* — `classifyInsideRadius({ distanceKm: 30, basis: 'municipality_centroid', radiusKm: 50 })` → `estimated`. **Falha se:** centroide produzir `confirmed` (AT17).
- *endereço dentro vira confirmado* — `basis:'address'`, 30 km, raio 50 → `confirmed`. **Falha se:** a regra ignorar a base.
- *sem coordenada é desconhecido* — `distanceKm: null` → `unknown`. **Falha se:** nulo virar 0 km.
- *5 km só pega a própria cidade* — `municipalitiesWithin(Sertãozinho, 5)` com os 3 fixtures → só Sertãozinho. **Falha se:** o filtro final pela distância for omitido (a caixa pegaria vizinhos).

**Defesas (5g):** todas "não se aplica: módulo sem rota e seed pública"; config de teste — `node --test`.
**Commit:** `feat: municípios com centroide e cálculo de raio`

---

## Tarefa 3: Adaptador Casa dos Dados e setores usuários

**Requisito:** R13.1, R13.7, R28.2, R28.4 (dados da ficha cadastral), R14.6 (MEI/porte), T4.

**Files:** Create `src/adapters/casadosdados.js`, `migrations/0008_seed_setores_cnae.sql`, `test/casadosdados.test.mjs`

**Contrato (citações de `https://docs.casadosdados.com.br`, consultado em 2026-09-22 — página "Pesquisa avançada de empresas"):**
- `POST https://api.casadosdados.com.br/v5/cnpj/pesquisa`, cabeçalho `api-key: <CASADOSDADOS_API_KEY>`, `content-type: application/json`.
- Corpo enviado (campos **copiados** do exemplo da doc): `codigo_atividade_principal` (array de CNAE sem pontuação), `incluir_atividade_secundaria` (boolean), `codigo_atividade_secundaria` (array), `situacao_cadastral: ["ATIVA"]`, `mei: { "excluir_optante": true }`, `limite` (usar **1000**), `pagina`.
- **Filtros de localização — A CONFIRMAR:** pesquisa de 2026-09-22 (◐) indicou `uf` (array de siglas) e `municipio` (array de nomes); o exemplo copiado da doc **não** traz esses campos. **Decisão:** o adaptador envia `uf: [<UF>]` e `municipio: [<NOME>]`; o **primeiro uso com chave real** (portão da T17) confere se o filtro é aplicado comparando `endereco.municipio` de todos os resultados; se não for, a tarefa volta ao plano com a correção (sem improvisar outro campo).
- Resposta (copiada): `{ "total": 0, "cnpjs": [{ "cnpj", "cnpj_raiz", "filial_numero", "razao_social", "nome_fantasia", "porte_empresa": {"codigo","descricao"}, "matriz_filial", "situacao_cadastral": {"situacao_cadastral","motivo","data"}, "endereco": {"cep","logradouro","numero","bairro","municipio","uf","ibge": {"codigo_municipio","codigo_uf","latitude","longitude"}} }] }`.
- Erros documentados: 401 (chave ausente/errada), 403 (sem acesso ao recurso). Limite de requisições: **não documentado** — o adaptador trata 429 como erro temporário (retry da fila).
- Contagem de "consultas" da franquia por chamada ou por resultado: **não documentada**; a tarefa registra `api_calls` por busca (R13.5) para medir no piloto.
- Interface:
  - `export async function searchEstablishments(env, { cnaes: string[], uf: string, municipio: string, page: number }, fetchImpl = fetch): Promise<{ total: number, items: NormalizedUnit[] }>`
  - `NormalizedUnit = { cnpj, cnpjRoot, razaoSocial, nomeFantasia, porteCodigo, porteDescricao, matrizFilial, situacao, municipioNome, uf, cep, logradouro, numero, bairro, ibgeMunicipio, lat, lon }` — `lat/lon` da resposta são guardados como **centroide do município** (`geo_precision='municipality_centroid'`, `geo_source='casadosdados:ibge'`) — a doc põe as coordenadas dentro do bloco `ibge` junto do código do município; **não** tratar como endereço (Fase 4 §7.2).
  - Erros: 401/403 → `AdapterError('auth')` (não repetir); 429/5xx/timeout (10 s via `AbortSignal.timeout(10000)`) → `AdapterError('temporary')`.
- `0008_seed_setores_cnae.sql`: mapeamento **setor usuário → CNAE** para as commodities do piloto (açúcar: refrigerantes, sucos/néctar, balas e confeitos, chocolate, sorvetes, panificação, sobremesas lácteas; milho: rações; soja/farelo: rações). Códigos CNAE de 7 dígitos da classificação CNAE 2.3, **cada linha com `source` = URL da subclasse no concla.ibge.gov.br**. A lista final é apresentada a Rogério no relatório para revisão (a skill manda partir do uso final — R28.2); ✋ portão humano antes do merge.

**Fixture de teste:** a resposta copiada acima, preenchida com **valores de teste inventados** (CNPJ `11222333000181`, razão social "Doces Vale Verde Ltda.", município "Franca", UF "SP", `porte_empresa.codigo "03"`), servida por um `fetchImpl` falso.

**Intenções de teste:**
- *corpo enviado exclui MEI e só ativas* — o `fetchImpl` captura o corpo; conferir `mei.excluir_optante === true` e `situacao_cadastral` = `["ATIVA"]`. **Falha se:** a busca trouxer MEI (fora do ICP, K1) por esquecer o filtro.
- *coordenada vira centroide* — item normalizado tem `lat/lon` e o chamador grava `geo_precision='municipality_centroid'`. **Falha se:** o adaptador marcar como `address`.
- *401 não é repetido* — `fetchImpl` retorna 401 → `AdapterError` com `kind === 'auth'`. **Falha se:** 401 for tratado como temporário (fila repetiria e gastaria franquia).
- *429 é temporário* — **Falha se:** 429 derrubar a busca inteira.
- *chave não vaza em log* — mensagem de erro não contém o valor de `CASADOSDADOS_API_KEY`. **Falha se:** o erro incluir os cabeçalhos da requisição.

**Defesas (5g):** rota — não cria rota; saída — dados externos tratados como texto (a interface usa `textContent`); CSRF/cookie — não se aplica; campo opcional — campos ausentes da resposta viram `null`/"não encontrado" (R28.3); exclusão — não se aplica; config de teste — `fetchImpl` injetado.
**Commit:** `feat: adaptador Casa dos Dados e setores usuários`

---

## Tarefa 4: Buscas nacionais versionadas e particionadas

**Requisito:** R11.1–R11.17, R13.1, R13.3, R13.5, R13.6, R1.1.3, R1.1.4, R23.1, R23.2, R14.3, R14.6, R14.8, R28.2, R28.3, AT15–AT19, AT37, AT38, AT66, AT67.

**Files:** Create `src/search.js`, `src/queue.js`, `test/busca.test.mjs`; Modify `src/worker.js` (rotas, `queue` handler usa `src/queue.js`)

**Interfaces:**
- `export async function startSearch(env, actor, { campaignId, radiusKm? }): Promise<{ searchId, version, status }>`
  - Campanha nacional ativa (Plano 1); raio = `radiusKm ?? campaign.radius_km`, validado contra `radius_allowed_km:national` (422 `radius_not_allowed`).
  - Origem via `originPoint` (T2). Setores: `campaign_icp.user_sectors_json` → CNAEs via `sector_cnae` (sem CNAE mapeado → 422 `sector_unmapped`).
  - `request_key` = SHA-256 de `campaignId|radius|originIbge|sorted(cnaes)|YYYY-MM-DD`. Se já existir busca com a mesma chave → devolve a existente (R23.2, AT: reenvio não duplica).
  - Nova versão: `version = max(version)+1` da campanha; `parent_search_id` = a anterior; a anterior **não é alterada** (R11.12, AT37).
  - Cria partições `(municipio_ibge, page=1)` para cada município de `municipalitiesWithin` e envia uma mensagem `{ type: "search_partition", searchId, partitionId }` por partição (`env.ASYNC_QUEUE.sendBatch`, lotes de ≤ 100 — limite da doc de Queues citado na Fase 4). Status `running`.
- `src/queue.js`: `export async function handleQueue(batch, env)` — despacha por `message.body.type`; tipo desconhecido → `ack()` + `console.error` (não reprocessar lixo). Cada handler faz `ack()` no sucesso e `retry()` em `AdapterError('temporary')`.
- `export async function runPartition(env, { searchId, partitionId })`:
  - Chama `searchEstablishments` (T3) com UF/município da partição e a página.
  - Para cada item: upsert em `company_units` por `(tenant_id, cnpj)`; empresa por `cnpj_root` (`companies.cnpj_root`), criando `companies` com `country_code='BR'`, `legal_name=razaoSocial`, `source_label='Casa dos Dados'` só se não existir (R1.1.3, R13.6, R23.1); evidência `commercial_signal` "cadastro/CNAE compatível" (indício — R13.1).
  - Distância com base `municipality_centroid` (T2) → `search_candidates` com `inside_radius` de `classifyInsideRadius`.
  - Se `total > page*1000` → cria a partição da página seguinte e envia mensagem.
  - `api_calls += 1`; partição `done`. Falha temporária após 3 tentativas (config da fila) → partição `failed` com `error`.
  - Ao terminar a última partição: status `complete` se todas `done`; `partial` se alguma `failed`, com `coverage_note` listando os municípios com falha (R11.8, R11.13, AT67).
- `export async function listCandidates(env, actor, searchId, { order: 'icp'|'distance', page, pageSize = 50 })` — une `search_candidates` + `company_units` + `buyer_profiles` (T6) do produto da campanha. Ordem `icp`: `in_icp` primeiro, depois `pending_size`, `out_trader`, `out_giant`, `out_small`; dentro de cada grupo, distância. Ordem `distance`: distância crescente, `unknown` por último (R11.9, R11.17, AT19). Nunca filtra fora quem está no raio (R11.7, AT18).
- `export async function retryFailedPartitions(env, actor, searchId)` — reenvia partições `failed` (botão "Tentar de novo"), sem duplicar candidatos (PRIMARY KEY de `search_candidates`).
- Cron (acrescentado pela T10) chama `resumeStalledSearches(env)`: partições `pending` há mais de 30 min são reenviadas.
- Rotas: `POST /api/searches` `{ campaignId, radiusKm? }`; `GET /api/searches/:id`; `GET /api/searches/:id/candidates?order=icp|distance&page=`.

**Fixtures:** resposta da Casa dos Dados do T3 (valores de teste) com 3 municípios × 2 empresas, uma delas repetida em dois municípios (mesmo `cnpj_raiz`, filiais diferentes), e um município cujo dublê devolve 429 sempre.

**Intenções de teste:**
- *busca aceita só com commodity, cidade e raio* — campanha nacional ativa sem nenhum fornecedor/oferta/lote → `startSearch` 200. **Falha se:** exigir qualquer dado de fornecedor (AT15, R16.2).
- *nenhum fornecedor é criado* — após a busca, nenhuma linha nova fora de `companies/company_units/search_*`; nenhuma tabela de fornecedor. **Falha se:** o código tentar gravar "fornecedor" (AT16, R11.4).
- *mesma empresa em duas filiais vira uma empresa com duas unidades* — **Falha se:** a dedup usar nome em vez de `cnpj_root`.
- *reenvio não duplica* — duas chamadas iguais em sequência → mesmo `searchId`. **Falha se:** o `request_key` sair.
- *mudar o raio cria v2 e preserva v1* — v1 5 km, v2 100 km; v1 mantém `radius_km=5` e o mesmo número de candidatos. **Falha se:** a v2 atualizar a v1 (AT37).
- *raio 150 recusado* — **Falha se:** a validação usar faixa contínua (AT66).
- *fonte que falha deixa cobertura parcial e preserva o resto* — o município com 429 fica `failed`; a busca termina `partial` com o nome do município na nota; candidatos dos outros municípios presentes. **Falha se:** um erro de partição derrubar a busca ou apagar resultados (AT67, Review Focus 5).
- *"Tentar de novo" não duplica* — após corrigir o dublê, `retryFailedPartitions` → `complete` e cada unidade aparece uma vez. **Falha se:** `search_candidates` perder a chave primária composta.
- *ordem por distância põe desconhecido no fim* — **Falha se:** `NULL` vier primeiro no ORDER BY do SQLite (usar `distance_km IS NULL, distance_km`).

**Defesas (5g):** rota — autenticada; `POST` perfis admin/commercial_manager/seller_analyst; cap — 64 KB; `radiusKm` inteiro; rota pública — não; saída — JSON; dados externos exibidos com `textContent` (T18); CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — campos ausentes da fonte = "não encontrado"; `radiusKm` ausente = raio da campanha; exclusão — busca nunca é apagada; config de teste — fila testada chamando `handleQueue` com lote simulado (`{ messages: [{ body, ack, retry }] }`) conforme a interface de consumidor da doc de Queues (`https://developers.cloudflare.com/queues/configuration/javascript-apis/`).
**Commit:** `feat: buscas nacionais versionadas por partição`

---

## Tarefa 5: Geocodificação por endereço (LocationIQ)

**Requisito:** R11.5, R11.6, R11.10, G9; caso 5 km (Fase 4 §7.6).

**Files:** Create `src/adapters/locationiq.js`, `test/geocodificacao.test.mjs`; Modify `src/queue.js` (tipo `geocode_unit`), `src/worker.js` (rota)

**Contrato (citações: `https://docs.locationiq.com/docs/search-forward-geocoding` e `https://docs.locationiq.com/docs/errors`, consultados em 2026-09-22):**
- `GET https://${LOCATIONIQ_HOST}/v1/search?key=<LOCATIONIQ_KEY>&street=<logradouro numero>&city=<municipio>&state=<uf>&postalcode=<cep>&countrycodes=br&format=json&limit=1` (parâmetros estruturados documentados: `street, city, state, postalcode, country`; `countrycodes` e `limit` 1–50).
- Resposta (copiada): array de `{ "place_id", "licence", "osm_type", "osm_id", "lat", "lon", "display_name", "class", "type", "importance", "address": {…} }`; `lat`/`lon` chegam como **string** → converter com `Number`.
- Erros: 404 "Unable to geocode" → resultado nulo (não é falha); 429 (segundo/minuto/dia) → temporário; 401 → `auth`.
- **Armazenamento:** "You can store response data forever. If you have a free account, you can cache API request-response pairs for upto 48 hours." (`https://locationiq.com/pricing`, conferido em 2026-09-22) — por isso a coordenada só é **gravada permanentemente** com plano pago; `LOCATIONIQ_PLAN` var (`free`|`paid`); com `free` o resultado é usado na sessão e **não** gravado em `company_units` (registra `geo_source='locationiq:transient'`).
- **Decisão de precisão:** resultado com `class` = `place` e `type` em (`city`,`town`,`village`,`municipality`) é tratado como **centroide**, não endereço (a API caiu para o nível da cidade).
- `export async function geocodeUnit(env, unitId, fetchImpl = fetch): Promise<{ precision, lat, lon } | null>`
- Enfileirado (`geocode_unit`) quando: (a) a empresa entra em triagem ou ficha (T6/T9); (b) a busca tem raio de 5 km — todos os candidatos da cidade de origem (Fase 4 §7.6).
- `POST /api/units/:id/geocode` (admin, commercial_manager, seller_analyst) para disparar manualmente.
- Após geocodificar: recalcula `search_candidates.distance_km/distance_basis/inside_radius` das buscas em que a unidade aparece.

**Fixture:** a resposta copiada acima com valores de teste (`lat "-20.5386"`, `lon "-47.4009"`, `class "building"`, `type "yes"`) e uma variante com `class "place"`, `type "town"`.

**Intenções de teste:**
- *endereço preciso atualiza para confirmado* — unidade com centroide a 30 km vira `address`, e `inside_radius` passa de `estimated` para `confirmed` num raio de 50 km. **Falha se:** a distância não for recalculada após geocodificar.
- *resposta no nível da cidade continua centroide* — variante `type "town"` → `geo_precision` continua `municipality_centroid`. **Falha se:** qualquer resposta virar `address`.
- *404 não é erro* — `null`, unidade inalterada, mensagem da fila `ack`. **Falha se:** 404 fizer `retry` infinito.
- *plano gratuito não grava* — `LOCATIONIQ_PLAN=free` → `company_units.lat` inalterado. **Falha se:** gravar coordenada sem direito de armazenamento.

**Defesas (5g):** rota — autenticada; cap — sem corpo; saída — não exibe `display_name` bruto; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — endereço sem logradouro → não chama a API, fica centroide; exclusão — não se aplica; config de teste — `fetchImpl` injetado.
**Commit:** `feat: geocodificação por endereço com precisão explícita`

---

## Tarefa 6: Empresas — unidades, evidências, perfil comprador, ICP e contatos

**Requisito:** R1.1.3, R1.1.4, R1.3.1–R1.3.3, R2.1.1, R2.1.2, R2.3, R13.2–R13.4, R14.1–R14.8, R15.1, R15.2, R15.6, R28.4.

**Files:** Create `src/companies.js`, `test/empresas.test.mjs`; Modify `src/worker.js` (rotas; `addContact` e `addEvidence` passam a usar o módulo)

**Interfaces:**
- `export async function upsertProfile(env, actor, companyId, { unitId?, productId, profileClass, basis, evidenceId? })` — `final_consumer_confirmed` exige `evidenceId` de evidência `business` válida **ou** verificação `direct_demand` confirmada de um contato da empresa → senão 422 `profile_needs_evidence` (R14.2).
- `export function icpStatus({ profileClass, porteCodigo, isGiant, hasRelationship, naturezaJuridica }): 'in_icp'|'out_small'|'out_giant'|'out_trader'|'pending_size'` — regras (R14.3, R14.6–R14.8): trader → `out_trader`; MEI ou `porteCodigo` `01` (Micro) → `out_small`; `isGiant` sem relacionamento → `out_giant`; porte ausente → `pending_size`; senão `in_icp`. **Decisão:** porte `03` (Pequeno porte) também → `out_small` (ICP da skill: médias e média-mais, ~50+ funcionários; os códigos de porte da Receita são 01 Micro, 03 Pequeno, 05 Demais — citação do layout em `https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf`, ◐); `05` → `in_icp` salvo `isGiant`. `isGiant` é marcação manual (Rogério) — sem fonte automática confiável.
- `export async function addException(env, actor, companyId, productId, { reason })` — só admin/commercial_manager; exige `reason` ≥ 10 caracteres; grava `exception_by/at/reason` e audita (R14.7).
- `export async function setRelationship(env, actor, contactId, note)` — relacionamento prévio registrado (gigante e CEO/diretoria — R14.6, R15.6).
- `export function canHaveFicha(profileRow): { ok: boolean, reason?: string }` — ok se `in_icp`; ou `out_trader` com exceção; ou `out_giant` com relacionamento; ou `pending_size` com objetivo de qualificar porte marcado (R14.8); senão `{ ok:false, reason }`. **Consumida pela T9.**
- Contatos: `addContact` (existente) passa a gravar `prospect_role`, `email_hash` = `identifierHash(env,'email',email)` (T10/P1), `email_validation='pending'`; **consulta `isSuppressed` antes de tornar o contato selecionável** (R2.1.2) — suprimido → `email_validation` fica `pending` e o contato recebe marca `suppressed=true` na resposta; `PATCH /api/contacts/:id` para papel, relacionamento e correções.
- Evidências: `addEvidence` aceita tipos nacionais (`public_nominal_record`, `commercial_document`, `company_document`) e grava arquivo opcional em R2 `evidence/<companyId>/<uuid>`; a transição para `prospected` segue R1.3.2 (existente) e **não** bloqueia ficha (R1.3.3).

**Intenções de teste:**
- *MEI e micro ficam fora do ICP* — **Falha se:** `icpStatus` aceitar porte `01`.
- *trader só com exceção* — `canHaveFicha(out_trader)` falso; após `addException` verdadeiro; `seller_analyst` não cria exceção (403). **Falha se:** a exceção não exigir perfil gestor (AT59).
- *gigante só com relacionamento* — **Falha se:** `isGiant` sem `relationship_note` permitir ficha (AT63).
- *consumidor final confirmado exige evidência* — sem evidência → 422. **Falha se:** indício (CNAE) bastar (R14.2).
- *contato suprimido não fica selecionável* — suprimir o e-mail na T10/P1, cadastrar o contato → resposta com `suppressed: true`. **Falha se:** `isSuppressed` não for consultado (R2.1.2).
- *empresa sem CNPJ e nome parecido gera pendência, não fusão* — **Falha se:** `createCompany` fundir por nome (R1.1.4).

**Defesas (5g):** rota — autenticada; perfis por ação acima; cap — 64 KB, textos ≤ 500; arquivo de evidência ≤ 10 MB e tipos `application/pdf`, `image/png`, `image/jpeg`; saída — JSON; nomes de contato decifrados só na resposta autenticada; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — `unitId` ausente = perfil da empresa inteira; `prospect_role` ausente = `other`; exclusão — não há exclusão de contato nesta tarefa (R23.5 fica na T13); config de teste — harness.
**Commit:** `feat: unidades, perfil comprador, ICP e contatos com papel`

---

## Tarefa 7: Validação de e-mail (Snov.io)

**Requisito:** R19.2 item 11, G11, skill I6.

**Files:** Create `src/adapters/snov.js`, `test/snov.test.mjs`; Modify `src/worker.js` (rota)

**Contrato (citação: `https://snov.io/api`, consultado em 2026-09-22 por agente — ◐; o executor confere a página antes de codar e registra no relatório):**
- Token: `POST https://api.snov.io/v1/oauth/access_token` com `grant_type=client_credentials`, `client_id`, `client_secret`; resposta `{ "access_token", "token_type": "Bearer", "expires_in": 3600 }` → guardar em KV `snov:token` com `expirationTtl = expires_in - 60`.
- Início: `POST https://api.snov.io/v2/email-verification/start` com `emails[]` (até 10) → `task_hash`.
- Resultado: `GET https://api.snov.io/v2/email-verification/result?task_hash=<hash>`; resposta (copiada): `{ "status": "completed", "data": [{ "email", "result": { "is_webmail", "smtp_status": "valid"|"unknown"|"not_valid", "is_gibberish", "is_disposable", "is_valid_format", "unknown_status_reason"? } }] }`.
- Mapeamento: `smtp_status "valid"` → `valid`; `"not_valid"` → `not_valid`; `"unknown"` com `unknown_status_reason "catchall"` → `catchall`; outros `unknown` → `unknown`. **Só `valid` conta como validado** (R19.2 item 11; catch-all/unknown não — decisão G11).
- Limite documentado: 60 requisições/min; resultado `status` diferente de `completed` → reconsultar pela fila (`retry` com atraso de 30 s).
- `export async function validateContactEmail(env, actor, contactId, fetchImpl = fetch): Promise<'valid'|'not_valid'|'unknown'|'catchall'|'pending'>` — decifra o e-mail, valida, grava `email_validation`, `email_validated_at`, `email_validation_provider='snov'`.
- `POST /api/contacts/:id/validate-email` (admin, commercial_manager, seller_analyst).

**Fixture:** o JSON de resultado copiado acima (3 e-mails de exemplo da doc).

**Intenções de teste:**
- *catch-all não valida* — `unknown` + `catchall` → `catchall`, e `sending.preSendCheck` (T10) recusa. **Falha se:** `unknown` for mapeado para `valid`.
- *token reaproveitado* — duas validações seguidas → uma chamada de token. **Falha se:** o KV não for usado.
- *e-mail não aparece em log* — **Falha se:** o erro incluir o endereço.

**Defesas (5g):** rota — autenticada; cap — sem corpo; saída — só o status; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — contato sem e-mail → 422 `contact_without_email`; exclusão — não se aplica; config de teste — `fetchImpl` injetado.
**Commit:** `feat: validação de e-mail pelo Snov.io`

---

## Tarefa 8: Modelos da `/prospeccao-vendas` e revisor PV

**Requisito:** R17.1–R17.8, R16.8, R19.13, R21.7, PV1–PV12, AT24, AT50, AT53–AT55, AT62 (texto), AT70.

**Files:** Create `src/templates/prospeccao-vendas.js`, `src/review.js`, `scripts/check-skill.mjs`, `tests/revisor.test.mjs`; Modify `package.json` (`"check:skill": "node scripts/check-skill.mjs"` e incluir no `check`)

**Contrato:**
- `SKILL_SHA256 = "33bd093f5dcb87a7d4aa51d31597c6d6ddfc637097693e3830a38f9b219f9dd8"`, `TEMPLATES_VERSION = "pv-1.0.0"`, `GENERATOR_VERSION = "tpl-1.0.0"`.
- `scripts/check-skill.mjs`: se existir `~/.claude/skills/prospeccao-vendas/SKILL.md`, calcula o SHA-256 e **falha** (código 1) se diferente de `SKILL_SHA256`, com a mensagem "A /prospeccao-vendas mudou. Refaça a leitura T12 antes de gerar textos." (R17.8, AT50); se o arquivo não existir (CI), passa com aviso.
- **Modelos (texto literal copiado de `references/scripts-abordagem.md` da skill, com `[SUA EMPRESA]`→`EAG Agro` e `[COMMODITY]`→nome da commodity):**
  - E-mail 1 (assunto `Fornecedor <commodity em minúsculas>`), E-mail 2 (reforço), E-mail 3 (reaparecer; variante ao influenciador), E-mail 4 (break) — copiar os blocos da seção "1. Cold e-mail — sequência de 4" da skill **literalmente**, trocando só os marcadores.
  - Frase de volume ("hoje estamos com um volume relevante de … disponível") incluída **somente** se `activeDeclarations().volumeAvailable === true`; frase de prova social substituída pelo texto aprovado da declaração ou **omitida** (R16.8, PV1, PV7).
  - "Encontrei seu contato pelo LinkedIn" substituído conforme `contact.source_label` registrado: `LinkedIn` → "pelo LinkedIn"; `site` → "no site da <empresa>"; outro → "em <fonte>"; sem fonte → frase omitida (PV4).
  - Assinatura obrigatória: `Rogério Palhari · EAG Agro` + `EAG_POSTAL_ADDRESS` + "Para não receber mais mensagens, responda \"sair\" ou use este link: <URL de descadastro>" (R19.13, R21.7).
- `export function generateSequence({ commodity, recipient: { firstName, role }, source, declarations, dates }): Step[]` — 4 passos `auto_email` com datas em dias diferentes e não seguidos (semana 1 seg e sex; semana 2 qui e sex — cadência da skill); passos manuais (LinkedIn qua semana 1; ligações qui/sex semana 1, seg/ter/sex semana 2) como `manual_task` (K4).
- `export function reviewSequence(steps, context): { ok: boolean, findings: { id: 'PV1'…'PV12'|'R19.13', ok: boolean, detail }[] }` — verificações determinísticas:
  - PV1: E-mail 1 contém saudação, frase de objetivo "iniciar uma conversa" e pedido de "20 minutos".
  - PV2: nenhum anexo; nenhum link além do de descadastro; uma única commodity citada.
  - PV3: cada passo tem `objective` preenchido.
  - PV4: frase "como achou o contato" coerente com `source`; menção a contato anterior ("estou em contato", "ele sabe do que se trata") só se existir passo anterior `accepted` (valor passado em `context.priorSent`).
  - PV5: 3–4 e-mails; nenhum par de e-mails em dias consecutivos.
  - PV6: o break é o último e-mail.
  - PV7: regex proibida (sem declaração) — `/\bR\$|US\$|pre[cç]o|cota[cç][aã]o|lote|estoque|certifica|pagamento|prazo de entrega/i`; frase de volume só com declaração ativa.
  - PV8: destinatário com `prospect_role` em (`decision_maker`,`influencer`,`provisional_decision_maker`); CEO/diretoria sem relacionamento → achado.
  - PV9: assunto do E-mail 1 casa `^Fornecedor [a-zà-ú0-9 ]+$` e não contém `%` nem dígitos de estatística.
  - PV10: frases proibidas da skill — "poderia falar com o setor de compras", "desculpe o incômodo", "desculpe incomodar".
  - PV11: texto ao influenciador ≠ texto ao decisor no mesmo passo.
  - PV12: mercado nacional → `ok` com `detail: "não se aplica (nacional)"`.
  - R19.13: assinatura contém `EAG_POSTAL_ADDRESS`, a URL de descadastro e "sair".
- Rogério pode **editar** os textos antes da aprovação (T9); toda edição passa de novo pelo revisor.

**Intenções de teste (`tests/revisor.test.mjs`):**
- *sequência gerada padrão passa* — com declarações vazias e fonte `site` → `ok === true`. **Falha se:** o modelo copiado da skill violar o próprio revisor.
- *preço no texto reprova PV7* — editar E-mail 1 com "preço competitivo" → PV7 falso (AT24). **Falha se:** a regex não cobrir "preço" com cedilha.
- *link de apresentação reprova PV2* — **Falha se:** o revisor contar só anexos (AT54).
- *título estatístico reprova PV9* — "90% das indústrias têm dificuldade no fornecimento" → PV9 falso (AT55). **Falha se:** a regex aceitar `%`.
- *e-mails em dias seguidos reprovam PV5* — datas seg e ter → PV5 falso (AT53). **Falha se:** a checagem comparar só a data do primeiro e do último.
- *sem declaração a frase de volume some* — `volumeAvailable null` → nenhum passo contém "volume relevante". **Falha se:** o modelo incluir a frase fixa (AT62).
- *sem endereço reprova R19.13* — `EAG_POSTAL_ADDRESS` vazio → achado R19.13 (AT70). **Falha se:** a assinatura não for verificada.
- *hash diferente bloqueia* — rodar `check-skill.mjs` com um arquivo temporário alterado (caminho injetável por env `SKILL_PATH`) → código 1. **Falha se:** o script só avisar (AT50).

**Defesas (5g):** rota — não cria rota; saída — o texto é e-mail em **texto puro** (worker-mailer `text`), sem HTML nesta fase — nenhum risco de injeção de HTML; nomes vindos de dados são inseridos em texto puro; CSRF/cookie — não se aplica; campo opcional — `firstName` ausente → saudação "Olá, tudo bem?"; fonte ausente → frase omitida; exclusão — não se aplica; config de teste — `node --test`.
**Commit:** `feat: modelos da /prospeccao-vendas e revisor PV`

---

## Tarefa 9: Fichas de aprovação versionadas

**Requisito:** R18.1–R18.10, R17.2, R17.5, R17.7, R14 (via `canHaveFicha`), R10.4, R25.3, R26.2, R23.3, AT26, AT39, AT60.

**Files:** Create `src/fichas.js`, `test/fichas.test.mjs`; Modify `src/worker.js` (rotas)

**Interfaces:**
- `export async function createFicha(env, actor, { companyId, campaignId, recipients: [{ contactId }] })` — exige: campanha ativa (P1), `canHaveFicha` ok (T6), produto utilizável (P1 T7), ao menos um destinatário com `prospect_role` válido, fuso definido (nacional: `send_timezone:national`; sem parâmetro → 422 `timezone_pending`, R18.6), empresa sem `openclaw_transfers.retired_in_openclaw=0` pendente (R25.3 — se existir registro com 0 → 422 `openclaw_active`). Gera a sequência (T8) para cada destinatário; grava `fichas` (`draft`) e `ficha_versions` v1 com `content_enc`, `content_sha256`, `pv_report_json`, hashes/versões (R17.1). Uma ficha por empresa+campanha (UNIQUE).
- `export async function saveDraft(env, actor, fichaId, { steps, expectedRowVersion })` — só antes da aprovação da versão corrente; revisa de novo (T8); conflito de `row_version` → 409 (R18.8).
- `export async function approveFicha(env, actor, fichaId, { versionNo })` — admin/commercial_manager (R9.2). Exige `pv_report.ok === true` (R17.3), canal `email` em `internal_test` ou `enabled` (R26.2). **Idempotente**: se a versão já está aprovada, devolve o mesmo resultado sem criar passos (R18.7, AT26). Cria `sequence_steps` para cada passo: `step_no` estável; se já existir passo `accepted` com o mesmo `(ficha_id, contact_id, step_no)` de versão anterior, **não recria** (R19.4). `status='approved'`. Não altera `companies.pipeline_status` (AT39).
- `export async function newVersion(env, actor, fichaId, changes)` — mudança de texto/destinatário/canal/intervalo: versão +1, `status='in_approval'`, passos `pending`/`queued` da versão anterior → `superseded` (R18.4); passos `accepted` preservados.
- `export async function deferFicha` / `discardFicha(env, actor, fichaId, { reason })` — motivo ≥ 5 caracteres (R18.2); descartar cancela passos não enviados.
- `export async function sendProof(env, actor, fichaId)` — envia os 4 e-mails da versão corrente para `MAILBOX_USER` (T10 `sendRaw`), assunto prefixado "[PROVA] ", **sem** criar `sequence_steps`, sem entrar na contagem da rampa (R18.10, AT60).
- Rotas conforme Recursos nomeados.

**Intenções de teste:**
- *aprovação duplicada é uma só* — dois `approve` seguidos → mesma contagem de `sequence_steps`. **Falha se:** a idempotência sair (AT26).
- *aprovação exige revisor ok* — ficha com achado PV7 → 409 `review_failed`. **Falha se:** o `approve` ignorar `pv_report`.
- *nova versão preserva enviados* — passo 1 `accepted`; nova versão muda texto do passo 2 → passo 1 continua `accepted` e não é recriado; passo 2 antigo `superseded`. **Falha se:** a nova versão recriar todos os passos (duplicaria envio).
- *edição concorrente* — dois `saveDraft` com o mesmo `expectedRowVersion` → segundo 409. **Falha se:** `row_version` não for checado.
- *ficha não muda pipeline* — após aprovar, `companies.pipeline_status` continua `discovered` (AT39). **Falha se:** a aprovação promover a empresa.
- *prova não conta como envio* — após `sendProof`, nenhum `sequence_steps` novo; `send_ramp` inalterado. **Falha se:** a prova usar o caminho normal de envio.
- *OpenClaw ativo bloqueia* — **Falha se:** a checagem de `openclaw_transfers` sair (AT34 parcial).
- *conteúdo cifrado no banco* — `ficha_versions.content_enc` não contém o primeiro nome do destinatário em claro. **Falha se:** o JSON for gravado sem cifrar.

**Defesas (5g):** rota — autenticada; aprovar só admin/commercial_manager; cap — 64 KB, cada texto ≤ 5.000 caracteres; saída — textos devolvidos só a perfis autenticados; interface exibe com `textContent`; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — sem `firstName` → saudação neutra; exclusão — ficha nunca apagada (`discarded`); config de teste — `sendRaw` substituído por dublê.
**Commit:** `feat: fichas de aprovação versionadas com revisor obrigatório`

---

## Tarefa 10: Envio pela Hostinger — agendador, pré-envio, rampa, idempotência

**Requisito:** R19.1–R19.13, R21.7, R21.10, R22.7, R26.2, R26.3, R28.7 (desligado), AT25–AT28, AT32, AT52, AT53, AT64, AT68, AT69; Review Focus 2 e 3.

**Files:** Create `src/adapters/mailbox.js` (parte SMTP), `src/sending.js`, `test/envio.test.mjs`; Modify `wrangler.jsonc` (cron `*/5 * * * *`, vars de e-mail), `src/worker.js` (`scheduled`)

**Contrato SMTP (citação: README de `worker-mailer` 1.2.1, `https://github.com/zou-yu/worker-mailer`, conferido em 2026-09-22 por agente — o executor confere o README da versão instalada):**
- `WorkerMailer.connect({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT), secure: true, credentials: { username: env.MAILBOX_USER, password: env.MAILBOX_PASSWORD }, authType: 'plain' })` — porta 465 com TLS implícito (Hostinger confirmada por Rogério).
- `mailer.send({ from: { name: "Rogério Palhari", email: env.MAILBOX_USER }, to: { email }, subject, text, reply: { email: env.MAILBOX_USER }, headers: { "Message-ID": messageId, "List-Unsubscribe": "<" + unsubUrl + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } })` — cabeçalhos RFC 8058 copiados de `https://www.rfc-editor.org/rfc/rfc8058` ("List-Unsubscribe-Post: List-Unsubscribe=One-Click").
- `export async function sendRaw(env, { to, subject, text, messageId, unsubUrl })`: retorna `{ accepted: true }` quando o `send` resolve; exceção de rede **depois** de iniciado o `DATA` → `{ indeterminate: true }`; resposta SMTP 5xx → `{ permanent: true, code }`; 4xx → `{ temporary: true, code }`.

**Contrato do envio:**
- `messageId` estável por passo: `<step-${stepId}@eagagro.com>` — gravado em `sequence_steps.message_id` **antes** de enviar (R19.4).
- `export async function preSendCheck(env, step, now): { ok: true } | { ok: false, reason }` — na ordem de R19.2: (1) supressão (`isSuppressed` pelo e-mail decifrado); (2) pausas abertas de `operation`, `campaign`, `company`, `commodity` que alcancem o passo (`openPauses`); (3) versão da ficha aprovada e igual à `ficha_version_id` do passo; (4) `content_sha256` da versão confere com o texto a enviar (byte a byte, AT25); (5) campanha `active` e produto utilizável; (6) sem sanção bloqueante e triagem válida (T16 — indisponível → `compliance_unavailable`, R19.3); (7) dentro da janela `send_hours:national` no fuso `send_timezone:national` e dentro do teto do dia (rampa); (8) passo sem `accepted` anterior; (9) oferta vinculada — não se aplica no piloto (sem ofertas); (10) canal `enabled`, **ou** `internal_test` com destinatário em `INTERNAL_TEST_RECIPIENTS`; (11) `email_validation === 'valid'`; (12) nenhum outro e-mail da sequência ao mesmo destinatário no dia civil anterior. Falha → passo `blocked` com `block_reason` e `send_log` `blocked` (sem enviar).
- Uma sequência ativa por destinatário (R19.8): na aprovação, se o `email_hash` do contato tiver passos `queued/accepted` de outra ficha ainda não concluída, os novos passos ficam `waiting_sequence`; ao terminar a anterior, reavaliam (AT32).
- **Rampa:** `send_ramp.current_step` indexa `send_daily_ramp:email` (P1 T8). Criado com `current_step=0` no primeiro envio real. Cron diário (`17 2 * * *`) avalia subida: 14 dias desde a última mudança, `hard_bounce_pct < send_step_up_max_hard_bounce_pct`, zero spam/aviso → `current_step+1` (máx. 3) e `audit_log` (R19.11).
- **Parada automática (R19.12):** hard bounce da semana ≥ `send_stop_hard_bounce_pct`, ou `inbound` classificado como aviso da Hostinger/marcação de spam conhecida (T11) → cria pausa `operation` com motivo e grava `send_ramp.stopped_*`; só admin retoma (P1 T10).
- **Agendador (cron 5 min):** `KV cron:lock:send` com `expirationTtl: 300` como trava (se existir, sai) — Review Focus 3; seleciona passos `pending` com `planned_date <= hoje` e canal email; aplica `preSendCheck`; **no máximo 1 envio por execução** e só se o último `accepted` foi há ≥ `intervalo aleatório entre min e max` minutos (sorteado e gravado em KV `send:next_at`); marca `sending` (UPDATE condicional `WHERE status='pending'`; `changes===0` → outro processo já pegou) e envia **no próprio cron** (sem fila, para respeitar o espaçamento).
- `sending` → `accepted` (grava `sent_at`, `send_log accepted`) / `temp_failed` (volta a `pending` com `attempts+1`, máx. 3) / `perm_failed` (endereço bloqueado: supressão `source='bounce'` e passos futuros do contato `cancelled` — R19.7, sem trocar de canal) / `indeterminate`.
- `indeterminate` e `sending` há mais de 15 min → reconciliação: IMAP `SEARCH HEADER Message-ID <id>` na pasta de enviados (T11 `findSentByMessageId`); achou → `accepted` (`reconciled_sent`); não achou → volta a `pending` (`reconciled_not_sent`). Nunca reenvia antes (R19.6, AT27, Review Focus 2).
- **Sem pixel/rastreamento** enquanto `open_tracking_enabled:email` ausente (AT64): o texto é puro e sem links além do descadastro.
- `GET /api/sending/today` — degrau, enviados/teto, próximo horário, fila do dia, bloqueios com motivo, pausas; `POST /api/sending/reconcile/:stepId` (admin) força reconciliação.
- Tarefas manuais da sequência (ligação/LinkedIn): no dia planejado, o cron cria `tasks` correspondentes **somente se** `preSendCheck` itens 1, 2, 3, 5 e 6 passarem (R28.18).

**Intenções de teste (dublê de `sendRaw` e de `findSentByMessageId`; relógio injetado):**
- *enviado é o texto aprovado byte a byte* — o dublê recebe `text` cujo SHA-256 é o `content_sha256` da versão. **Falha se:** algum passo regenerar o texto no envio (AT25).
- *cron sobreposto não duplica* — duas execuções concorrentes (`Promise.all`) → `sendRaw` chamado uma vez. **Falha se:** a trava KV ou o UPDATE condicional saírem (Review Focus 3).
- *queda entre SMTP e D1 não reenvia* — `sendRaw` resolve e o teste força erro ao gravar `accepted` → passo fica `sending`; após 15 min, reconciliação com dublê que encontra o Message-ID → `accepted`, `sendRaw` continua com 1 chamada. **Falha se:** o passo voltar a `pending` sem reconciliar (AT27, Review Focus 2).
- *e-mail não validado não sai* — `catchall` → `blocked` motivo `email_not_validated` (AT52). **Falha se:** o item 11 for pulado.
- *compliance indisponível segura* — dublê da T16 lança → `blocked` `compliance_unavailable` (AT28). **Falha se:** exceção for tratada como liberação.
- *teto da semana 1* — 8 passos prontos → 5 `accepted` no dia, 3 `pending` para o próximo dia útil; intervalos entre 15 e 25 min (AT68). **Falha se:** o teto não vier do parâmetro ou o intervalo não for respeitado.
- *hard bounce 3% para tudo* — 1 bounce em 33 envios na semana → pausa `operation` criada, próximo cron não envia (AT69). **Falha se:** a parada depender de ação manual.
- *canal em teste só envia para interno* — `internal_test` e destinatário externo → `blocked` `channel_not_enabled`; interno → envia. **Falha se:** o item 10 aceitar externo (R26.2).
- *segunda sequência espera* — mesmo e-mail em duas fichas → a segunda `waiting_sequence` (AT32). **Falha se:** a verificação usar `contact_id` em vez de `email_hash` (o mesmo e-mail em dois contatos furaria).
- *cabeçalhos de descadastro presentes* — dublê recebe `List-Unsubscribe` com URL https e `List-Unsubscribe-Post`. **Falha se:** algum passo sair sem os cabeçalhos (R21.10).

**Defesas (5g):** rota — autenticada (`/api/sending/*`); reconciliar só admin; cap — sem corpo; saída — `today` não devolve o texto dos e-mails; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — `send_hours` ausente → envio bloqueado (R7.1.1), `firstName` ausente tratado na T8; exclusão — passos nunca apagados; config de teste — dublês injetados por parâmetro (`deps`), `scheduled` testado chamando o handler com `{ cron, scheduledTime }` conforme a interface de `scheduled()` (`https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/`).
**Commit:** `feat: envio 1 a 1 pela Hostinger com rampa e reconciliação`

---

## Tarefa 11: Leitura de respostas (IMAP) e pausa por resposta

**Requisito:** R20.1–R20.9, R21.2, R21.4, R21.6, R19.7, R19.12, R28.13, AT29–AT31, AT36, AT58; Review Focus 1.

**Files:** Modify `src/adapters/mailbox.js` (parte IMAP), `wrangler.jsonc` (`compatibility_flags: ["nodejs_compat"]`); Create `src/inbound.js`, `test/respostas.test.mjs`

**Contrato IMAP (citação: README de `imapflow` 2.0.6, `https://github.com/postalsys/imapflow` — "on Cloudflare Workers with the `nodejs_compat` compatibility flag. On Workers connect with implicit TLS (`secure: true`, usually port 993)… STARTTLS negotiation fails" — conferido em 2026-09-22):**
- `new ImapFlow({ host: env.IMAP_HOST, port: Number(env.IMAP_PORT), secure: true, auth: { user: env.MAILBOX_USER, pass: env.MAILBOX_PASSWORD }, logger: false })`; `await client.connect()`; `await client.mailboxOpen('INBOX')`; `client.search({ since })`; `client.fetch(range, { uid: true, envelope: true, headers: ['message-id','in-reply-to','references','auto-submitted','x-autoreply','content-type','from','subject'], source: true })`. O executor confere cada método no README/typings da versão instalada e cita no relatório; comandos IMAP subjacentes seguem RFC 9051 (`UID SEARCH SINCE`, `UID FETCH … BODY.PEEK[HEADER.FIELDS (…)]`).
- `export async function findSentByMessageId(env, messageId): Promise<boolean>` — abre a pasta de enviados (`client.list()` e procura `specialUse === '\\Sent'`), busca por cabeçalho `Message-ID` (consumida pela T10).
- Cron 5 min com trava `cron:lock:imap`: busca mensagens com UID maior que o último processado (guardado em KV por `uidvalidity`), guarda o `.eml` bruto no R2 `inbound/<uidvalidity>/<uid>.eml` e insere `inbound_messages` (UNIQUE evita duplicar).
- **Classificação (`classify(headers, text)`):**
  - `bounce`: `content-type` `multipart/report; report-type=delivery-status` → extrai o `Final-Recipient` e o código `5.x.x` (hard) ou `4.x.x` (soft).
  - `unsubscribe`: corpo (primeiras 5 linhas sem citação) igual a/contendo `sair`, `descadastrar`, `remover`, `unsubscribe` (sem diferenciar caixa).
  - `auto_reply`: `Auto-Submitted` diferente de `no`, ou `X-Autoreply`, ou assunto começando por "Resposta automática"/"Automatic reply"/"Out of Office".
  - `human`: resto; mensagem que não dá para ler → `unclassified`.
- **Correlação:** `In-Reply-To`/`References` contra `sequence_steps.message_id`; se não achar, remetente (`email_hash` de `from`) contra contatos com passo `accepted` nos últimos 60 dias (Review Focus 1); não achou → só armazena.
- **Efeitos:**
  - `human`, `auto_reply` (B1 pendente — R20.7), `unclassified` (R20.6): pausa `company+commodity` = cancela (`superseded` não; **`cancelled` com motivo `reply`**) todos os passos não enviados da mesma empresa **e mesmo `product_id`**, de todas as fichas/contatos/canais; suspende as `tasks` abertas correspondentes; cria `tasks` `reply_followup` para Rogério com o link da mensagem (R20.1, AT29, AT30, AT36). Fichas da mesma empresa com **outro** produto recebem alerta (tarefa `reply_followup` de prioridade baixa), sem cancelar (R20.5).
  - Resposta que pede preço/tabela/apresentação (`/pre[cç]o|tabela|apresenta[cç][aã]o|proposta/i`) → a tarefa recebe a orientação fixa da skill (R28.13, AT58).
  - `unsubscribe`: `suppress` (P1 T10) do remetente com `source='reply'` **antes** de qualquer outro processamento; cancela passos futuros do endereço, **sem** break (R21.2, R21.6, AT31); demais contatos da empresa: fichas voltam para `in_approval` com aviso (R21.4).
  - `bounce` hard: supressão `source='bounce'` do destinatário, passo → `perm_failed` (R19.7); conta para o hard bounce da semana (R19.12).
  - Mensagem do domínio `hostinger.com` com palavras "suspens", "limit", "spam", "abuse" → tarefa `hostinger_alert` e **parada automática** (R19.12).
  - Nenhum e-mail é enviado em resposta (R19.9).
- `GET /api/inbound` — lista mensagens classificadas (sem corpo), com link autenticado para o `.eml` só para admin/commercial_manager.

**Fixtures:** três `.eml` escritos à mão **com cabeçalhos no formato da RFC 5322/RFC 3464** (valores de teste): resposta humana com `In-Reply-To` de um passo; resposta automática com `Auto-Submitted: auto-replied`; DSN `multipart/report; report-type=delivery-status` com `Status: 5.1.1`. O cliente IMAP é substituído por dublê que devolve esses objetos.

**Intenções de teste:**
- *resposta pausa a commodity em todos os decisores e canais* — empresa com passos de café para 2 contatos + tarefa de ligação, e passos de açúcar; resposta humana a café → todos os de café `cancelled`, tarefa de café suspensa, açúcar intacto com alerta (AT29). **Falha se:** a pausa filtrar por `contact_id` em vez de empresa+produto.
- *resposta automática também pausa (B1 pendente)* — **Falha se:** `auto_reply` for ignorado ou retomar sozinho (AT36).
- *mensagem ilegível é tratada como humana* — **Falha se:** `unclassified` não pausar (AT30).
- *"sair" suprime antes do próximo passo e sem despedida* — **Falha se:** o break for enviado depois (AT31).
- *resposta fora da thread é correlacionada pelo remetente* — sem `In-Reply-To`, `From` de contato com passo aceito → pausa. **Falha se:** a correlação depender só de cabeçalho de thread (Review Focus 1).
- *mesma mensagem lida duas vezes* — cron roda duas vezes com o mesmo UID → uma linha e uma tarefa. **Falha se:** a UNIQUE ou a trava saírem.
- *hard bounce suprime e conta* — DSN 5.1.1 → supressão `bounce`, passo `perm_failed`. **Falha se:** 4.x.x for tratado como hard.
- *pedido de preço gera orientação* — **Falha se:** a tarefa não trouxer o texto da skill (AT58).

**Defesas (5g):** rota — autenticada; `.eml` só gestores; cap — mensagens > 5 MB guardadas mas não analisadas (classificação `unclassified` → pausa, lado seguro); saída — `/api/inbound` sem corpo; cabeçalhos exibidos com `textContent`; CSRF — GET apenas; cookie — não se aplica; campo opcional — sem `From` → `unclassified`; exclusão — `.eml` retidos até a política de T11 (pendência registrada); config de teste — dublê do cliente IMAP.
**Commit:** `feat: leitura de respostas por IMAP com pausa empresa+commodity`

---

## Tarefa 12: Descadastro público de um clique

**Requisito:** R21.7, R21.9, R21.10, R21.6, AT35; Review Focus 4.

**Files:** Create `src/unsubscribe.js`, `test/descadastro.test.mjs`; Modify `src/worker.js` (rotas `/u/*` **antes** da autenticação), `wrangler.jsonc` (`ratelimits`; acrescentar `"/u/*"` em `assets.run_worker_first` — sem isso a rota cai na página estática por `not_found_handling: "single-page-application"`)

**Contrato:**
- Token: `base64url(stepId) + "." + base64url(HMAC-SHA-256(UNSUB_TOKEN_KEY, stepId))`; `export async function unsubUrl(env, stepId): string` = `${PUBLIC_BASE_URL}/u/${token}` (consumida pela T8/T10).
- `GET /u/:token` — valida HMAC (inválido → 404 genérico); responde **página HTML mínima** "Não quer mais receber mensagens da EAG Agro? [Confirmar descadastro]" com `<form method="post">`; **GET não suprime** (robôs de segurança abrem links — Review Focus 4). Cabeçalhos `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'`, `x-robots-tag: noindex`.
- `POST /u/:token` — aceita o POST do botão **e** o POST de um clique (RFC 8058: corpo `List-Unsubscribe=One-Click`, "multipart/form-data" ou "application/x-www-form-urlencoded", sem cookies/autenticação). Suprime o e-mail do contato do passo (`source='link'`), cancela passos futuros desse endereço, **sem break** (R21.6), processado antes do próximo envio (R21.9, AT35). Responde 200 com página "Pronto. Você não receberá mais mensagens." (idempotente: segundo POST responde igual).
- Limite: `env.UNSUB_LIMITER.limit({ key: ip })` (IP de `cf-connecting-ip`) — excedido → 429 (config copiada de `https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/`: `ratelimits: [{ name, namespace_id, simple: { limit, period } }]`, `period` 10 ou 60).
- **Access:** ✋ portão humano na T17 — Rogério cria aplicação self-hosted do Access para `<host>/u/*` com política **Bypass Everyone** (`https://developers.cloudflare.com/cloudflare-one/access-controls/policies/` — "Bypass… used to enable applications that require specific endpoints to be public"; precedência "Hostname or path-based Access: Applies first", `https://developers.cloudflare.com/workers/configuration/cloudflare-access/`).
- Rotas `/u/*` **não** passam por `getActor` nem por `assertSameOrigin` (formulário de um clique vem do provedor de e-mail).

**Intenções de teste:**
- *GET não suprime* — `GET /u/<token válido>` → 200 com formulário e `isSuppressed` falso. **Falha se:** o GET suprimir (Review Focus 4).
- *POST um clique suprime* — POST `application/x-www-form-urlencoded` com `List-Unsubscribe=One-Click` → suprimido; passos 2–3 do contato `cancelled`; nenhum break enfileirado (AT35). **Falha se:** exigir cookie/sessão ou enviar despedida.
- *token forjado* — HMAC trocado → 404. **Falha se:** o token não for verificado com comparação de tempo constante (`crypto.subtle.verify`).
- *abuso* — 21 POSTs do mesmo IP em 60 s → 429 (dublê do binding). **Falha se:** o limite não for consultado.
- *rota chega ao Worker* — `GET /u/<token>` via `SELF.fetch` devolve o formulário, não o `index.html`. **Falha se:** `/u/*` não estiver em `run_worker_first`.
- *sem Access e sem Origin funciona* — POST sem cabeçalho `Origin` nem JWT → 200. **Falha se:** `/u/*` cair no `assertSameOrigin`/`getActor`.

**Defesas (5g):** rota pública — limite 20/min por IP (`UNSUB_LIMITER`), corpo ≤ 2 KB, token HMAC; saída — HTML estático sem dado de usuário (nem e-mail, nem nome), CSP restritiva; CSRF — ação é o próprio pedido de saída e idempotente; não há sessão a sequestrar; cookie — nenhum; campo opcional — corpo ausente no POST do botão é aceito; exclusão — supressão é permanente até política T11 (registrado); config de teste — binding de rate limit substituído por dublê em `miniflare.bindings`.
**Commit:** `feat: descadastro público de um clique`

---

## Tarefa 13: Efeitos de pausas e mudanças comerciais

**Requisito:** R22.3–R22.8, R16.5, R18.4, R18.5, R23.4–R23.6, R10.7, AT33.

**Files:** Create `src/changes.js`, `test/mudancas.test.mjs`

**Interfaces:**
- `export async function suspendCommodity(env, actor, { productId, market, reason })` — pausa `commodity` + todas as campanhas do produto no mercado → `paused`; tarefa de alerta a Rogério; retomada exige confirmação por campanha e reaprovação das fichas afetadas (R22.3, R10.7).
- `export async function onCampaignContextChange(env, actor, campaignId, change)` — mudança de cidade de origem/produto/raio que fundamentou a aprovação → fichas `in_approval` com nova versão exigida (R22.5).
- `export async function expireCampaignReviews(env, now)` (cron diário) — campanha com `review_due_at < now` → `paused` sem exigir cotação (R22.6).
- `export async function resume(env, actor, pauseId)` — ao retomar, nada é enviado direto: os passos voltam a passar pelo `preSendCheck` completo no próximo cron (R22.7); passos já enviados continuam `accepted` (a interface mostra "enviado antes da pausa", R22.8).
- `export async function discardCompany(env, actor, companyId, { reason })` — mantém histórico e motivo, marca `inactive` (P3/R23.4); `export async function deletePersonalData(env, actor, contactId, { legalBasis })` — só admin; apaga campos cifrados do contato, mantém `email_hash` na supressão se houver pedido de não contato, grava tombstone no `audit_log` sem PII, mantém eventos da linha do tempo com "contato removido" (R23.5, R23.6, R9.1). **Ofertas específicas (R16.5, R22.4, AT33): fora do piloto — sem tabela de ofertas; registrado como "não se aplica: piloto sem oferta vinculada".**

**Intenções de teste:**
- *pausar campanha A não pausa B* — **Falha se:** a pausa usar `product_id` em vez de `campaign_id` (R22.2).
- *retomada revalida* — pausa com passo pronto; ao retomar, o passo só sai se `preSendCheck` passar (ex.: e-mail invalidado durante a pausa → `blocked`). **Falha se:** a retomada enviar direto.
- *exclusão de dados pessoais mantém a linha do tempo* — após `deletePersonalData`, a linha do tempo mostra o evento com "contato removido" e o contato não tem nome/e-mail decifrável. **Falha se:** a exclusão apagar `sequence_steps`/`send_log` (quebraria histórico) ou deixar o nome.

**Defesas (5g):** rotas — as do Plano 1 (pausas) + `POST /api/companies/:id/discard` e `POST /api/contacts/:id/delete-personal-data` (admin); cap — 64 KB; saída — JSON; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — `legalBasis` obrigatório; exclusão permanente — **declaração do que a infraestrutura garante:** o D1 mantém recuperação de ponto no tempo (Time Travel) de 30 dias no Paid — valor da referência `d1.md` da `cloudflare-atlas` (◐; confirmar em `https://developers.cloudflare.com/d1/reference/time-travel/` antes de declarar ao titular); os dados apagados continuam recuperáveis por esse período; config de teste — harness.
**Commit:** `feat: efeitos de pausas, mudanças e exclusão de dados pessoais`

---

## Tarefa 14: Tarefas manuais, reuniões e linha do tempo

**Requisito:** R28.5, R28.6, R28.8–R28.12, R28.18, R28.19, R15.3–R15.5, R3.1.5, R24.4, R20.5, AT56, AT65.

**Files:** Create `src/tasks.js`, `test/tarefas.test.mjs`; Modify `src/worker.js` (rotas)

**Interfaces:**
- `export async function listTasks(env, actor, { date })` — abertas do dia, **ordenadas da menor prioridade para a maior** (skill: ligar primeiro para os piores leads, R28.8); prioridade = ordem do ICP (T6) invertida.
- `export async function completeTask(env, actor, taskId, { result, answers?: { buyingChannel?, modality?, monthlyVolumeT? } })` — grava `result_json`, `done_by/at`; respostas das 3 perguntas viram campos do formulário de demanda com status `confirmed`, método "ligação" e data (R3.1.5); `monthlyVolumeT` numérico ≥ 0 (422 senão); evento na linha do tempo (R28.19). Tarefa `suspended` não pode ser concluída (409).
- `export async function createL0Task(env, companyId)` — sem e-mail validado do decisor (R28.6), com o roteiro L0 da skill no campo `script`.
- Roteiros por tipo (`call_l0`, `call_l1`, `call_l2`, `linkedin`) copiados de `references/scripts-abordagem.md` §2 e §3 da skill, sem preço/proposta (R28.9).
- `export async function recordMeeting(env, actor, { companyId, contactId?, scheduledFor, durationMin, channel, inviteSent })` — 20–30 min sugerido (aceita 10–120); cria `meeting_confirm` na manhã do dia (R28.10).
- `export async function onSequenceFinished(env, fichaId)` — chamada pela T10 quando o break é aceito sem resposta: cria `return_suggested` com vencimento em 6 meses ou `campaign_icp.buying_cycle_days`, se houver; não cria sequência nova (R28.11, R17.7, AT56).
- `export async function timeline(env, actor, companyId)` — união ordenada de `audit_log` (sem PII), `send_log`, `inbound_messages` (classificação e data), `tasks`, `meetings`, evidências (R24.4).
- `GET /api/dashboard/funnel?period=` — prospectadas (empresas com ficha aprovada) → reuniões (`meetings`) → negócios (`confirmed_opportunity`) (R28.12).

**Intenções de teste:**
- *tarefa de ligação suspensa após resposta* — resposta na quarta cancela a ligação de quinta (AT65). **Falha se:** a suspensão (T11) não alcançar `tasks`.
- *ordem começa pelos piores* — 3 tarefas `in_icp`, `pending_size`, `out_giant`(com relacionamento) → primeira é a de menor prioridade. **Falha se:** a ordem for decrescente.
- *fim da sequência sugere retorno e não reabre* — após o break sem resposta, 1 tarefa `return_suggested` para +6 meses; nenhum passo novo (AT56). **Falha se:** criar sequência automática.
- *volume inválido recusado* — "cem" → 422. **Falha se:** aceitar texto como número.
- *linha do tempo sem PII* — conteúdo não contém e-mail do contato. **Falha se:** o `audit_log` for exibido com campos cifrados decifrados.

**Defesas (5g):** rota — autenticada; perfis operacionais; cap — 64 KB; saída — `textContent` na interface; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — respostas das perguntas ausentes = `Não confirmado`; exclusão — não se aplica; config de teste — harness.
**Commit:** `feat: tarefas manuais, reuniões, retorno sugerido e linha do tempo`

---

## Tarefa 15: Migração do OpenClaw

**Requisito:** R25.1–R25.5, R21.8, AT34 (parte OpenClaw).

**Files:** Create `src/openclaw.js`, `test/openclaw.test.mjs`; Modify `src/worker.js` (rotas)

**Contrato:**
- ✋ **Portão humano:** Rogério exporta do OpenClaw um CSV (formato do OpenClaw **não conhecido**; a tarefa **para** e pede um arquivo de exemplo antes de codar o parser). Contrato do lado do Compass (colunas normalizadas após mapeamento acordado com Rogério): `empresa, cnpj, contato_nome, contato_email, status (ativo|pausado|respondeu|descadastrado), ultimo_envio, campanha`.
- `POST /api/openclaw/import` (admin, multipart, ≤ 10 MB) — guarda o arquivo no R2; **primeiro** importa todas as linhas `descadastrado` como supressão `source='openclaw'` (R21.8, R25.2); depois empresas/contatos (dedup por CNPJ/e-mail hash, R23.1); respostas viram evento na linha do tempo; `openclaw_transfers` com `retired_in_openclaw=0` para empresas `ativo`; grava `openclaw_imports.counts_json`.
- `POST /api/openclaw/transfers` `{ companyId }` (admin) — registra que a empresa foi retirada do OpenClaw (`retired_in_openclaw=1`); só então a T9/T10 permitem ficha/envio (R25.3).
- Contato anterior no OpenClaw não bloqueia nova ficha (R25.4). Desligamento do OpenClaw: fora do código — checklist no relatório (R25.5).

**Intenções de teste:**
- *supressões entram antes de tudo* — arquivo com linha descadastrada e a mesma pessoa ativa em outra linha → fica suprimida. **Falha se:** a ordem de importação inverter.
- *empresa ativa no OpenClaw bloqueia envio* — **Falha se:** a T10 não consultar `openclaw_transfers` (AT34).
- *reimportação não remove supressão* — segunda importação com a pessoa "ativa" → continua suprimida (R21.5).

**Defesas (5g):** rota — admin; arquivo ≤ 10 MB, só `text/csv`; linhas com mais de 50 colunas ou campos > 1.000 caracteres rejeitados; saída — contagens apenas; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — CNPJ ausente → dedup por e-mail hash, senão pendência (R1.1.4); exclusão — arquivo original retido no R2 até a política T11; config de teste — CSV de teste com valores inventados.
**Commit:** `feat: importação e transferência do OpenClaw`

---

## Tarefa 16: Triagem de sanções pré-envio

**Requisito:** R1.2, R1.2.1, R19.2 item 6, R19.3, T11.

**Files:** Create `src/compliance.js`, `test/compliance.test.mjs`; Modify `src/worker.js` (rotas)

**Contrato:**
- Estrutura existente da 0.3.1 (`sanction_sources`, `sanction_list_versions`, `sanction_entries`, `sanction_aliases`, `screening_*`) e `evaluateSanctionMatch` (existente, AT8/AT9).
- ✋ **Pendência T11:** a política de compliance e as fontes oficiais não foram validadas com o responsável. **Decisão para o piloto:** o Administrador carrega as listas manualmente (`POST /api/compliance/lists`, CSV ≤ 20 MB com `official_entity_id, primary_name, country_code, program`), gravando versão e hash (`sanction_list_versions`).
- `export async function screenCompany(env, actor, companyId)` — roda contra a versão mais recente de cada fonte ativa; grava `screening_runs/matches`; nome só → `Sanção em Revisão` (sem bloqueio definitivo, R1.2); identificador confiável + país → bloqueio.
- `export async function complianceStatus(env, companyId): 'clear'|'review'|'blocked'|'unavailable'` — `unavailable` quando **não há nenhuma versão de lista importada** ou a triagem mais recente tem mais de 30 dias (**decisão**: validade de 30 dias até a política T11) → a T10 bloqueia o envio (R19.3).

**Intenções de teste:**
- *sem lista carregada não envia* — `complianceStatus` = `unavailable` → `preSendCheck` recusa. **Falha se:** ausência de lista virar `clear` (R19.3).
- *nome parecido vai para revisão, não bloqueio* — AT8 continua válido pelo caminho novo. **Falha se:** `exact_name` virar `block`.
- *revisão pendente bloqueia ficha e envio* — R1.2.1. **Falha se:** `review` for tratado como `clear`.

**Defesas (5g):** rota — admin; arquivo ≤ 20 MB CSV; saída — JSON; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — `country_code` ausente → só nome (revisão); exclusão — versões nunca apagadas; config de teste — CSV de teste.
**Commit:** `feat: triagem de sanções pré-envio com bloqueio por indisponibilidade`

---

## Tarefa 17: Canais, teste interno de T1 e liberação (portões humanos)

**Requisito:** R26.1–R26.6, R17.6, T1, B2 (mecanismo), R21.10.

**Files:** Create `src/channels.js`, `test/canais.test.mjs`, `docs/eag-compass-t1-validacao.md`; Modify `src/worker.js` (rotas)

**Contrato:**
- `POST /api/channels/:channel/state` `{ state, evidenceRef }` — só admin; `enabled` exige `evidenceRef` apontando para o registro de T1 (`docs/eag-compass-t1-validacao.md#<seção>`); WhatsApp e LinkedIn **não podem** ir para `enabled` nesta versão (422 — T2/T3 não comprovados, R26.4, R26.5).
- **Roteiro do teste interno (executado com ✋ Rogério; registrar cada resultado no `t1-validacao.md` com data e prints):**
  1. Secrets de produção da caixa (`MAILBOX_PASSWORD`) e das APIs; `INTERNAL_TEST_RECIPIENTS` = 2–3 endereços internos de Rogério (fora do `eagagro.com` também, ex.: Gmail pessoal).
  2. Canal `email` → `internal_test`.
  3. Campanha de teste + empresa fictícia com contato interno; validar e-mail (Snov) — conferir que endereço interno volta `valid`.
  4. Gerar ficha; enviar **prova** (R18.10); aprovar.
  5. Deixar o cron enviar os passos (encurtar datas só no ambiente de teste) e conferir: chegada na caixa interna; `Message-ID`, `List-Unsubscribe`, `List-Unsubscribe-Post`; SPF/DKIM `pass` no cabeçalho `Authentication-Results` do Gmail; mensagem na pasta de enviados da Hostinger.
  6. Responder do endereço interno → pausa empresa+commodity e tarefa criada.
  7. Responder "sair" → supressão; clicar o link de descadastro no Gmail (um clique) → supressão.
  8. Enviar para endereço inexistente do domínio de teste → bounce classificado, `perm_failed`, supressão.
  9. Derrubar o envio no meio (forçar erro no teste) → `indeterminate` → reconciliação.
  10. **Amostras de texto (R17.6):** gerar e registrar no documento 4 sequências — consumidor final, trader com exceção, perfil com porte pendente, sequência interrompida por resposta antes do break — revisadas por Rogério.
  11. ✋ **Casa dos Dados real:** 1 busca de 5 km com chave real; conferir se o filtro de município foi aplicado (T3) e registrar quantas "consultas" a franquia consumiu.
  12. ✋ Rogério cria no Access a aplicação `/u/*` com **Bypass Everyone** (T12) e confirma que o link abre sem login.
- ✋ **Liberação:** só com os itens 1–12 registrados como OK, Rogério autoriza por escrito "liberar e-mail" e o admin muda o canal para `enabled` com `evidenceRef`. Antes disso, **nenhum destinatário externo** (R26.6).

**Intenções de teste:**
- *enabled sem evidência é recusado* — **Falha se:** o `evidenceRef` for opcional.
- *WhatsApp não habilita* — **Falha se:** a lista de canais bloqueados sair.
- *vendedor não altera canal* — **Falha se:** a permissão sair.

**Defesas (5g):** rota — admin; cap — 64 KB; saída — JSON; CSRF — `assertSameOrigin`; cookie — não se aplica; campo opcional — `evidenceRef` obrigatório para `enabled`; exclusão — não se aplica; config de teste — harness. **Verificação:** o roteiro 1–12 é manual por natureza (depende da caixa real e do Gmail); o registro no `t1-validacao.md` é a prova.
**Commit:** `feat: estado dos canais e roteiro de validação de T1`

---

## Tarefa 18: Interface do piloto

**Requisito:** R24.1–R24.6, R11.3, R11.10, R11.17, R12 (não), R18, R19 (painel), R28 (tarefas), telas do design doc §4 e os requisitos "ainda sem tela" (§4 final).

**Files:** Modify `public/index.html`, `public/app.css`, `public/app.js`, `scripts/build-site.mjs` (copiar `vendor/` e o `.pmtiles`), `scripts/validate-site.mjs`, `wrangler.jsonc` (acrescentar `"/tiles/*"` em `assets.run_worker_first`); Create `scripts/pmtiles-extract.md` (instruções)

**Contrato:**
- Telas, seguindo `design/fase5/compass-prototipo.html` e os tokens do Plano 1: **Radar** (formulário com raio da lista de parâmetros, mapa, lista com ordenação ICP/distância, precisão, cobertura, versões, "Tentar de novo", triagem em lote: marcar exceção/relacionamento/porte e criar ficha); **Empresa** (unidades, evidências com upload, contatos com papel e validação, perfil/ICP, linha do tempo, próxima ação, reunião); **Ficha** (passos E-mail 1–4 e manuais, edição antes da aprovação, revisor PV com achados, prova, aprovar/adiar/descartar com motivo, versões); **Envios** (degrau, teto, próximo horário, fila, bloqueios com motivo, pausas, parada automática, reconciliação); **Tarefas** (roteiros L0/L1/L2/LinkedIn, 3 perguntas, reunião); **Respostas** (lista de `inbound`); **Canais** (estado e evidência, só admin); **Hoje** com os contadores reais (fichas em aprovação, respostas, tarefas, envio do dia, busca em andamento).
- **Mapa:** MapLibre GL JS 6.x com `pmtiles` via `maplibregl.addProtocol("pmtiles", protocol.tile)` (`https://docs.protomaps.com/pmtiles/maplibre`), recorte do Brasil gerado com `pmtiles extract … --bbox=-74.0,-34.0,-34.0,5.5` (`https://docs.protomaps.com/pmtiles/cli`; tamanho medido com `--dry-run` e anotado — deve caber no free tier do R2), servido do R2 por rota `GET /tiles/brasil.pmtiles` com suporte a `Range` (requisito do PMTiles); atribuição "© OpenStreetMap" visível; círculo do raio com `@turf/circle` (MIT). Bibliotecas copiadas de `node_modules` para `dist/vendor/` pelo build (sem CDN em produção). O executor confere cada assinatura no context7 (`/maplibre/maplibre-gl-js`) e na doc do Protomaps antes de codar.
- Pino por precisão: preenchido = endereço, tracejado = estimado, cinza = fora do ICP (design doc).
- Toda string da API por `textContent`; `validate-site.mjs` continua proibindo `innerHTML` em `app.js` e passa a exigir os marcadores `data-screen="radar"`, `data-screen="ficha"`, `data-screen="envios"`, `data-screen="tarefas"`, `data-screen="empresa"`, `/api/searches`, `/api/fichas`, `/api/sending/today`.
- Celular (≤ 900 px): só Hoje, respostas e tarefas (design doc §5).

**Verificação:** manual (sem framework de teste de navegador) — roteiro: percorrer o fluxo "Radar 5 km → marcar exceção de um trader → criar ficha → ver PV7 reprovar ao escrever 'preço' → corrigir → prova → aprovar → ver fila em Envios → registrar ligação L2 com as 3 perguntas → registrar reunião"; capturas em 1440 px e no quadro de 390 px anexadas ao relatório. Automático: `npm run check` (marcadores, proibição de `innerHTML`).
**Defesas (5g):** rota — `/tiles/*` autenticada (atrás do Access) e só leitura com `Range`; saída — `textContent`; CSRF — same-origin; cookie — não se aplica; campo opcional — estados vazios acionáveis por tela; exclusão — não se aplica; config de teste — não se aplica.
**Commit:** `feat: interface do piloto nacional`

---

## Cobertura de requisitos

| Requisito | Tarefa |
| --- | --- |
| R1.1.3, R1.1.4, R1.3, R2.1.1, R2.1.2, R2.3 | T4, T6 |
| R1.2, R1.2.1 | T16 |
| R3.1.5 | T14 |
| R11.1–R11.17 | T2, T4, T5, T18 |
| R13.1–R13.7 | T3, T4, T6 |
| R14.1–R14.8 | T6 |
| R15.1–R15.6 | T6, T14 |
| R16.5, R22.4 (ofertas) | T13 — **não se aplica no piloto** (sem ofertas) |
| R17.1–R17.8 | T8, T9, T17 |
| R18.1–R18.10 | T9 |
| R19.1–R19.13 | T10, T16 |
| R20.1–R20.9 | T11 |
| R21.2, R21.4, R21.6–R21.10 | T11, T12 |
| R22.3, R22.5–R22.8 | T13 |
| R23.1, R23.2, R23.4–R23.6 | T4, T13 |
| R24.3, R24.4 | T14, T18 |
| R25.1–R25.5 | T15 |
| R26.1–R26.6 | T17 |
| R27.1–R27.3 | **Gap:** a trilha de qualificação reaproveita o formulário e o gate existentes (0.3.1 + P1 T6); a tela de demanda completa e a criação de oportunidade estão na T18 como "Empresa → Demanda" — sem tarefa de API nova porque as rotas `PUT /api/companies/:id/demand` e `POST /api/companies/:id/qualify` já existem; o analyze da Fase 7 deve conferir |
| R28.2–R28.19 | T3, T4, T10, T11, T14 |
| AT15–AT39, AT50–AT70 (nacionais) | nas tarefas acima |

**Fora deste plano:** R1.4, R12, AT20–AT23 (Plano 3 — Internacional); R28.7 com rastreamento ativo (depende de T1+T11); ofertas específicas (R16.3–R16.6, R22.4).
