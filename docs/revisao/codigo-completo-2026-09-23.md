# EAG Compass — código completo do projeto (para revisão)

**Gerado em:** 2026-09-23, a partir da árvore de trabalho em `C:UsersRogereag-compass` (branch `main`).
**Total:** 17 arquivos, 1826 linhas.

## Leia antes

- **Este é todo o código que existe hoje: a base 0.3.1.** Os Planos 1 (Fundação) e 2 (Piloto Nacional) estão **só no papel** (`docs/superpowers/plans/`); nenhuma linha deles foi implementada.
- A troca pela base 0.3.1 **não está commitada**: `git status` mostra os arquivos antigos (`src/index.ts`, `tsconfig.json`, `wrangler.toml`, `migrations/0001_init_schema.sql`, `.github/workflows/deploy.yml`) como removidos, e os deste documento como novos ou modificados.
- **Fora do documento:** `node_modules/`, `dist/` (gerado pelo build), `package-lock.json` (gerado pelo npm), `.wrangler/` (estado local), `docs/` e `design/` (planejamento e protótipos, já revisados por você).
- Cada linha vem numerada (`12 | código`) para você citar na revisão, por exemplo "worker.js 120". Os números **não** fazem parte do arquivo.
- O hash SHA-256 de cada arquivo permite conferir, depois, que a revisão foi feita sobre esta versão.

## O que os planos já preveem mudar (para orientar a revisão)

| Arquivo | Ponto conhecido | Onde é tratado |
| --- | --- | --- |
| `src/worker.js` | `getActor` confia em cabeçalhos que qualquer um pode forjar (inclui `oai-*`) | Plano 1, T4 (validação do token do Access) |
| `src/worker.js` | `saveDemand` só aceita açúcar e café | Plano 1, T5 (`demands` sem restrição de commodity) |
| `src/scoring.js` | Mínimo de 500 fixo para açúcar; tabela relativa só para café; atualidade conta sem evidência | Plano 1, T6 (pontuação v2, DS1) |
| `scripts/validate-site.mjs` | Falha no Windows (`ERR_UNSUPPORTED_ESM_URL_SCHEME`) e ainda exige arquivos do OpenAI | Plano 1, T2 |
| `.openai/hosting.json` | Resto da hospedagem anterior | Plano 1, T2 (remoção) |
| `wrangler.jsonc` | IDs `LOCAL_REPLACE_AFTER_CREATE`; nome do banco e fila a alinhar | Plano 1, T3 e T12 |
| `public/index.html` | Interface 0.3.1 | Plano 1, T11 e Plano 2, T18 (design Talhão) |

## Índice

| # | Arquivo | Linhas | SHA-256 (início) |
| --- | --- | --- | --- |
| 1 | [`package.json`](#arquivo-1) | 21 | `65ef70a352da` |
| 2 | [`wrangler.jsonc`](#arquivo-2) | 61 | `fcf39cbf06a7` |
| 3 | [`.gitignore`](#arquivo-3) | 12 | `18247a4940ec` |
| 4 | [`.env.example`](#arquivo-4) | 2 | `fec812402a3e` |
| 5 | [`.mcp.json`](#arquivo-5) | 16 | `9ccc2704b4bc` |
| 6 | [`.openai/hosting.json`](#arquivo-6) | 5 | `253a88ffd1bf` |
| 7 | [`.github/workflows/ci.yml`](#arquivo-7) | 27 | `b5899017eb91` |
| 8 | [`migrations/0001_initial.sql`](#arquivo-8) | 305 | `2daef3806929` |
| 9 | [`migrations/0002_seed_configuration.sql`](#arquivo-9) | 18 | `defe6e05b7c4` |
| 10 | [`src/worker.js`](#arquivo-10) | 387 | `6dced2b58cbb` |
| 11 | [`src/scoring.js`](#arquivo-11) | 139 | `536b388f8aeb` |
| 12 | [`tests/scoring.test.mjs`](#arquivo-12) | 85 | `1310cc0c2b8e` |
| 13 | [`scripts/build-site.mjs`](#arquivo-13) | 18 | `ff24165de970` |
| 14 | [`scripts/validate-site.mjs`](#arquivo-14) | 16 | `7359ed4f8451` |
| 15 | [`public/index.html`](#arquivo-15) | 563 | `9c4007c4149e` |
| 16 | [`README.md`](#arquivo-16) | 71 | `a5abcc2e4ecd` |
| 17 | [`PROGRESSO.md`](#arquivo-17) | 80 | `b58031f51e71` |

## Configuração

<a id="arquivo-1"></a>
### 1. `package.json`

21 linhas · SHA-256 `65ef70a352daa26812a5c067618fdc3c4ee7b35cecd54e1ba4e51075a5ca3e34`

```json
 1 | {
 2 |   "name": "eag-compass",
 3 |   "version": "0.3.1",
 4 |   "private": true,
 5 |   "type": "module",
 6 |   "scripts": {
 7 |     "build:site": "node scripts/build-site.mjs",
 8 |     "validate:site": "node scripts/validate-site.mjs",
 9 |     "predev": "npm run build:site",
10 |     "dev": "wrangler dev --local",
11 |     "test": "node --test tests/*.test.mjs",
12 |     "check": "node --check src/worker.js && node --check src/scoring.js && node --test tests/*.test.mjs && npm run build:site && npm run validate:site",
13 |     "db:migrate:local": "wrangler d1 migrations apply eag-compass-db --local",
14 |     "db:migrate:remote": "wrangler d1 migrations apply eag-compass-db --remote",
15 |     "predeploy": "npm run check",
16 |     "deploy": "wrangler deploy"
17 |   },
18 |   "devDependencies": {
19 |     "wrangler": "^4.0.0"
20 |   }
21 | }
```

<a id="arquivo-2"></a>
### 2. `wrangler.jsonc`

61 linhas · SHA-256 `fcf39cbf06a79a4ddaed12dabe9f96870934a88916a3fa335592b6fba86bae6a`

```jsonc
 1 | {
 2 |   "$schema": "./node_modules/wrangler/config-schema.json",
 3 |   "name": "eag-compass",
 4 |   "main": "src/worker.js",
 5 |   "compatibility_date": "2026-09-21",
 6 |   "workers_dev": true,
 7 |   "observability": {
 8 |     "enabled": true,
 9 |     "head_sampling_rate": 1
10 |   },
11 |   "vars": {
12 |     "ENVIRONMENT": "local",
13 |     "DEFAULT_TENANT_ID": "eag-internal"
14 |   },
15 |   "assets": {
16 |     "directory": "./dist",
17 |     "binding": "ASSETS",
18 |     "run_worker_first": ["/api/*"],
19 |     "not_found_handling": "single-page-application"
20 |   },
21 |   "d1_databases": [
22 |     {
23 |       "binding": "DB",
24 |       "database_name": "eag-compass-db",
25 |       "database_id": "LOCAL_REPLACE_AFTER_CREATE",
26 |       "migrations_dir": "migrations"
27 |     }
28 |   ],
29 |   "r2_buckets": [
30 |     {
31 |       "binding": "FILES",
32 |       "bucket_name": "eag-compass-files"
33 |     }
34 |   ],
35 |   "kv_namespaces": [
36 |     {
37 |       "binding": "CACHE",
38 |       "id": "LOCAL_REPLACE_AFTER_CREATE"
39 |     }
40 |   ],
41 |   "queues": {
42 |     "producers": [
43 |       {
44 |         "binding": "ASYNC_QUEUE",
45 |         "queue": "eag-compass-async"
46 |       }
47 |     ],
48 |     "consumers": [
49 |       {
50 |         "queue": "eag-compass-async",
51 |         "max_batch_size": 10,
52 |         "max_batch_timeout": 5,
53 |         "max_retries": 3,
54 |         "dead_letter_queue": "eag-compass-async-dlq"
55 |       }
56 |     ]
57 |   },
58 |   "triggers": {
59 |     "crons": ["17 2 * * *"]
60 |   }
61 | }
```

<a id="arquivo-3"></a>
### 3. `.gitignore`

12 linhas · SHA-256 `18247a4940ec58602841eeab9482052b2deec23400494c73db4cd0cc2aa1b43a`

```text
 1 | node_modules/
 2 | dist/
 3 | .wrangler/
 4 | .dev.vars
 5 | .env
 6 | .env.*
 7 | !.env.example
 8 | *.log
 9 | *.tar.gz
10 | .DS_Store
11 | 
12 | .firecrawl/
```

<a id="arquivo-4"></a>
### 4. `.env.example`

2 linhas · SHA-256 `fec812402a3e3b5b4f1724e1ffa6e3d58a888d894d4be6a820eb6c47254eba71`

```text
1 | # Somente desenvolvimento local. Nunca grave chaves reais neste arquivo.
2 | ENVIRONMENT=local
```

<a id="arquivo-5"></a>
### 5. `.mcp.json`

16 linhas · SHA-256 `9ccc2704b4bcdb8a76d9854e9921941c435dda808eb5dbbbd81dc9fbcc50f919`

```json
 1 | {
 2 |   "mcpServers": {
 3 |     "mcp-brasil": {
 4 |       "type": "stdio",
 5 |       "command": "uvx",
 6 |       "args": [
 7 |         "--from",
 8 |         "mcp-brasil==0.14.0",
 9 |         "python",
10 |         "-m",
11 |         "mcp_brasil.server"
12 |       ],
13 |       "env": {}
14 |     }
15 |   }
16 | }
```

<a id="arquivo-6"></a>
### 6. `.openai/hosting.json`

5 linhas · SHA-256 `253a88ffd1bfaa1d0807571a734a6df3b2ec7d123d71688d41100af2c91f9e6c`

```json
1 | {
2 |   "project_id": "appgprj_6ab1947bd68c8191a4cf1fd706ba5534",
3 |   "d1": "DB",
4 |   "r2": "FILES"
5 | }
```

<a id="arquivo-7"></a>
### 7. `.github/workflows/ci.yml`

27 linhas · SHA-256 `b5899017eb912466cd2563fbfa793fe7dd648e6da1b13cfedc7601da93bcaee1`

```yaml
 1 | name: Validate EAG Compass
 2 | 
 3 | on:
 4 |   push:
 5 |     branches: [main]
 6 |   pull_request:
 7 |   workflow_dispatch:
 8 | 
 9 | jobs:
10 |   validate:
11 |     runs-on: ubuntu-latest
12 |     timeout-minutes: 15
13 |     steps:
14 |       - name: Checkout
15 |         uses: actions/checkout@v6
16 | 
17 |       - name: Setup Node.js
18 |         uses: actions/setup-node@v6
19 |         with:
20 |           node-version: "24"
21 |           cache: npm
22 | 
23 |       - name: Install dependencies
24 |         run: npm ci
25 | 
26 |       - name: Validate application
27 |         run: npm run check
```


## Banco de dados (migrações D1)

<a id="arquivo-8"></a>
### 8. `migrations/0001_initial.sql`

305 linhas · SHA-256 `2daef3806929cd9ba3c92ca13232f9a87b3ea06a88952e1b88b7839b5ab8c955`

```sql
  1 | PRAGMA foreign_keys = ON;
  2 | 
  3 | CREATE TABLE tenants (
  4 |   id TEXT PRIMARY KEY,
  5 |   name TEXT NOT NULL,
  6 |   status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  7 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  8 | );
  9 | 
 10 | CREATE TABLE users (
 11 |   id TEXT PRIMARY KEY,
 12 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 13 |   email TEXT NOT NULL,
 14 |   display_name TEXT NOT NULL,
 15 |   role TEXT NOT NULL CHECK (role IN ('admin','commercial_manager','seller_analyst','auditor_viewer')),
 16 |   status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
 17 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 18 |   UNIQUE (tenant_id, email)
 19 | );
 20 | 
 21 | CREATE TABLE companies (
 22 |   id TEXT PRIMARY KEY,
 23 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 24 |   legal_name TEXT NOT NULL,
 25 |   trade_name TEXT,
 26 |   country_code TEXT NOT NULL,
 27 |   registration_id TEXT,
 28 |   registration_id_type TEXT,
 29 |   buyer_type TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (buyer_type IN ('final_buyer','intermediary','unconfirmed')),
 30 |   pipeline_status TEXT NOT NULL DEFAULT 'discovered' CHECK (pipeline_status IN ('discovered','prospected','in_contact','qualifying','qualified','confirmed_opportunity','blocked','inactive')),
 31 |   exception_status TEXT CHECK (exception_status IN ('below_minimum','sanction_review','sanction_blocked','risk_inconclusive','high_risk_without_mitigation','outside_icp','no_progress')),
 32 |   owner_user_id TEXT REFERENCES users(id),
 33 |   source_label TEXT NOT NULL,
 34 |   source_url TEXT,
 35 |   created_by TEXT NOT NULL,
 36 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 37 |   updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 38 |   UNIQUE (tenant_id, country_code, legal_name)
 39 | );
 40 | 
 41 | CREATE INDEX idx_companies_tenant_pipeline ON companies(tenant_id, pipeline_status);
 42 | CREATE INDEX idx_companies_tenant_country ON companies(tenant_id, country_code);
 43 | CREATE INDEX idx_companies_registration ON companies(tenant_id, registration_id);
 44 | CREATE INDEX idx_companies_tenant_updated ON companies(tenant_id, updated_at DESC) WHERE pipeline_status!='inactive';
 45 | 
 46 | CREATE TABLE evidence (
 47 |   id TEXT PRIMARY KEY,
 48 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 49 |   company_id TEXT NOT NULL REFERENCES companies(id),
 50 |   category TEXT NOT NULL CHECK (category IN ('business','market','commercial_signal')),
 51 |   evidence_type TEXT NOT NULL,
 52 |   reference TEXT NOT NULL,
 53 |   source_url TEXT,
 54 |   fact_date TEXT,
 55 |   consulted_at TEXT NOT NULL,
 56 |   validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','valid','invalid','conflicting')),
 57 |   validated_by TEXT REFERENCES users(id),
 58 |   validated_at TEXT,
 59 |   metadata_json TEXT NOT NULL DEFAULT '{}',
 60 |   created_by TEXT NOT NULL,
 61 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 62 | );
 63 | 
 64 | CREATE INDEX idx_evidence_company_category ON evidence(tenant_id, company_id, category, validation_status);
 65 | 
 66 | CREATE TABLE contacts (
 67 |   id TEXT PRIMARY KEY,
 68 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 69 |   company_id TEXT NOT NULL REFERENCES companies(id),
 70 |   full_name_encrypted TEXT,
 71 |   job_title_encrypted TEXT,
 72 |   email_encrypted TEXT,
 73 |   phone_encrypted TEXT,
 74 |   linkedin_url_encrypted TEXT,
 75 |   source_label TEXT NOT NULL,
 76 |   source_url TEXT,
 77 |   created_by TEXT NOT NULL,
 78 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 79 |   updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 80 | );
 81 | 
 82 | CREATE TABLE contact_verifications (
 83 |   id TEXT PRIMARY KEY,
 84 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 85 |   contact_id TEXT NOT NULL REFERENCES contacts(id),
 86 |   verification_type TEXT NOT NULL CHECK (verification_type IN ('email_deliverable','identity','job_title','decision_authority','direct_demand')),
 87 |   status TEXT NOT NULL CHECK (status IN ('confirmed','rejected','pending')),
 88 |   method TEXT NOT NULL,
 89 |   source_reference TEXT,
 90 |   verified_by TEXT NOT NULL,
 91 |   verified_at TEXT NOT NULL,
 92 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 93 | );
 94 | 
 95 | CREATE TABLE demands (
 96 |   id TEXT PRIMARY KEY,
 97 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
 98 |   company_id TEXT NOT NULL REFERENCES companies(id),
 99 |   commodity TEXT NOT NULL CHECK (commodity IN ('sugar','coffee')),
100 |   product_variant TEXT,
101 |   supplier_reference TEXT,
102 |   currency_base TEXT NOT NULL DEFAULT 'USD',
103 |   completeness REAL NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),
104 |   current_state TEXT,
105 |   desired_state TEXT,
106 |   gap_summary TEXT,
107 |   created_by TEXT NOT NULL,
108 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
109 |   updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
110 |   UNIQUE (tenant_id, company_id, commodity)
111 | );
112 | 
113 | CREATE TABLE demand_fields (
114 |   id TEXT PRIMARY KEY,
115 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
116 |   demand_id TEXT NOT NULL REFERENCES demands(id),
117 |   field_key TEXT NOT NULL,
118 |   field_status TEXT NOT NULL CHECK (field_status IN ('confirmed','not_confirmed','not_applicable')),
119 |   value_json TEXT,
120 |   not_applicable_reason TEXT,
121 |   source_reference TEXT,
122 |   confirmed_by TEXT,
123 |   confirmed_at TEXT,
124 |   updated_by TEXT NOT NULL,
125 |   updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
126 |   UNIQUE (tenant_id, demand_id, field_key)
127 | );
128 | 
129 | CREATE TABLE scores (
130 |   id TEXT PRIMARY KEY,
131 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
132 |   company_id TEXT NOT NULL REFERENCES companies(id),
133 |   demand_id TEXT REFERENCES demands(id),
134 |   score_type TEXT NOT NULL CHECK (score_type IN ('potential','confidence','risk')),
135 |   score_value REAL,
136 |   score_min REAL,
137 |   score_max REAL,
138 |   coverage REAL NOT NULL CHECK (coverage BETWEEN 0 AND 100),
139 |   classification TEXT,
140 |   components_json TEXT NOT NULL,
141 |   formula_version TEXT NOT NULL,
142 |   parameters_json TEXT NOT NULL,
143 |   calculated_by TEXT NOT NULL,
144 |   calculated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
145 | );
146 | 
147 | CREATE INDEX idx_scores_latest ON scores(tenant_id, company_id, score_type, calculated_at DESC);
148 | 
149 | CREATE TABLE risk_observations (
150 |   id TEXT PRIMARY KEY,
151 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
152 |   company_id TEXT NOT NULL REFERENCES companies(id),
153 |   component TEXT NOT NULL CHECK (component IN ('registration','credit','payment','reputation','logistics')),
154 |   severity REAL NOT NULL CHECK (severity BETWEEN 0 AND 20),
155 |   source_reference TEXT NOT NULL,
156 |   observed_at TEXT NOT NULL,
157 |   recorded_by TEXT NOT NULL,
158 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
159 | );
160 | 
161 | CREATE INDEX idx_risk_observations_company ON risk_observations(tenant_id, company_id, component, observed_at DESC);
162 | 
163 | CREATE TABLE parameters (
164 |   id TEXT PRIMARY KEY,
165 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
166 |   parameter_key TEXT NOT NULL,
167 |   scope_key TEXT NOT NULL DEFAULT 'global',
168 |   value_json TEXT NOT NULL,
169 |   effective_from TEXT NOT NULL,
170 |   effective_to TEXT,
171 |   changed_by TEXT NOT NULL,
172 |   change_reason TEXT NOT NULL,
173 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
174 |   UNIQUE (tenant_id, parameter_key, scope_key, effective_from)
175 | );
176 | 
177 | CREATE TABLE approvals (
178 |   id TEXT PRIMARY KEY,
179 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
180 |   company_id TEXT NOT NULL REFERENCES companies(id),
181 |   demand_id TEXT REFERENCES demands(id),
182 |   approval_type TEXT NOT NULL CHECK (approval_type IN ('below_minimum','risk_coverage_waiver','risk_mitigation','intermediary_validation')),
183 |   status TEXT NOT NULL CHECK (status IN ('approved','rejected','pending')),
184 |   reason TEXT NOT NULL,
185 |   approved_by TEXT,
186 |   decided_at TEXT,
187 |   metadata_json TEXT NOT NULL DEFAULT '{}',
188 |   created_by TEXT NOT NULL,
189 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
190 | );
191 | 
192 | CREATE TABLE sanction_sources (
193 |   id TEXT PRIMARY KEY,
194 |   source_key TEXT NOT NULL UNIQUE,
195 |   name TEXT NOT NULL,
196 |   official_url TEXT NOT NULL,
197 |   jurisdiction TEXT NOT NULL,
198 |   blocking_policy TEXT NOT NULL CHECK (blocking_policy IN ('legal_block','integrity_alert','review_only')),
199 |   active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
200 | );
201 | 
202 | CREATE TABLE sanction_list_versions (
203 |   id TEXT PRIMARY KEY,
204 |   source_id TEXT NOT NULL REFERENCES sanction_sources(id),
205 |   source_version TEXT,
206 |   content_hash TEXT NOT NULL,
207 |   published_at TEXT,
208 |   downloaded_at TEXT NOT NULL,
209 |   record_count INTEGER,
210 |   storage_key TEXT,
211 |   import_status TEXT NOT NULL CHECK (import_status IN ('pending','imported','failed')),
212 |   error_summary TEXT,
213 |   UNIQUE (source_id, content_hash)
214 | );
215 | 
216 | CREATE TABLE sanction_entries (
217 |   id TEXT PRIMARY KEY,
218 |   list_version_id TEXT NOT NULL REFERENCES sanction_list_versions(id),
219 |   official_entity_id TEXT,
220 |   primary_name TEXT NOT NULL,
221 |   entity_type TEXT,
222 |   country_code TEXT,
223 |   program TEXT,
224 |   raw_json TEXT NOT NULL
225 | );
226 | 
227 | CREATE INDEX idx_sanction_entries_id_country ON sanction_entries(official_entity_id, country_code);
228 | CREATE INDEX idx_sanction_entries_name ON sanction_entries(primary_name);
229 | 
230 | CREATE TABLE sanction_aliases (
231 |   id TEXT PRIMARY KEY,
232 |   entry_id TEXT NOT NULL REFERENCES sanction_entries(id),
233 |   alias_name TEXT NOT NULL,
234 |   normalized_name TEXT NOT NULL
235 | );
236 | 
237 | CREATE INDEX idx_sanction_aliases_normalized ON sanction_aliases(normalized_name);
238 | 
239 | CREATE TABLE screening_runs (
240 |   id TEXT PRIMARY KEY,
241 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
242 |   company_id TEXT NOT NULL REFERENCES companies(id),
243 |   initiated_by TEXT NOT NULL,
244 |   initiated_at TEXT NOT NULL,
245 |   completed_at TEXT,
246 |   status TEXT NOT NULL CHECK (status IN ('pending','completed','failed')),
247 |   query_json TEXT NOT NULL,
248 |   source_versions_json TEXT NOT NULL DEFAULT '{}'
249 | );
250 | 
251 | CREATE TABLE screening_matches (
252 |   id TEXT PRIMARY KEY,
253 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
254 |   screening_run_id TEXT NOT NULL REFERENCES screening_runs(id),
255 |   sanction_entry_id TEXT NOT NULL REFERENCES sanction_entries(id),
256 |   match_method TEXT NOT NULL CHECK (match_method IN ('official_id_country','exact_name','substring','fuzzy','phonetic','blocked_country')),
257 |   similarity REAL,
258 |   country_compatible INTEGER CHECK (country_compatible IN (0,1)),
259 |   reliable_identifier_match INTEGER NOT NULL DEFAULT 0 CHECK (reliable_identifier_match IN (0,1)),
260 |   recommended_action TEXT NOT NULL CHECK (recommended_action IN ('block','review','discard')),
261 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
262 | );
263 | 
264 | CREATE TABLE screening_decisions (
265 |   id TEXT PRIMARY KEY,
266 |   tenant_id TEXT NOT NULL REFERENCES tenants(id),
267 |   screening_match_id TEXT NOT NULL REFERENCES screening_matches(id),
268 |   decision TEXT NOT NULL CHECK (decision IN ('confirmed_block','false_positive','keep_reviewing','integrity_alert')),
269 |   reason TEXT NOT NULL,
270 |   decided_by TEXT NOT NULL,
271 |   decided_at TEXT NOT NULL
272 | );
273 | 
274 | CREATE TABLE audit_log (
275 |   id TEXT PRIMARY KEY,
276 |   tenant_id TEXT NOT NULL,
277 |   actor_id TEXT NOT NULL,
278 |   actor_role TEXT NOT NULL,
279 |   action TEXT NOT NULL,
280 |   entity_type TEXT NOT NULL,
281 |   entity_id TEXT NOT NULL,
282 |   field_name TEXT,
283 |   old_value_json TEXT,
284 |   new_value_json TEXT,
285 |   reason TEXT,
286 |   evidence_id TEXT,
287 |   formula_version TEXT,
288 |   parameters_json TEXT,
289 |   request_id TEXT NOT NULL,
290 |   occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
291 | );
292 | 
293 | CREATE INDEX idx_audit_entity ON audit_log(tenant_id, entity_type, entity_id, occurred_at DESC);
294 | 
295 | CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
296 | CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
297 | 
298 | CREATE VIEW company_latest_scores AS
299 | SELECT s.* FROM scores s
300 | JOIN (
301 |   SELECT tenant_id, company_id, score_type, MAX(calculated_at) calculated_at
302 |   FROM scores GROUP BY tenant_id, company_id, score_type
303 | ) latest ON latest.tenant_id=s.tenant_id AND latest.company_id=s.company_id AND latest.score_type=s.score_type AND latest.calculated_at=s.calculated_at;
304 | 
305 | PRAGMA optimize;
```

<a id="arquivo-9"></a>
### 9. `migrations/0002_seed_configuration.sql`

18 linhas · SHA-256 `defe6e05b7c496359308f2205e32a97d272aeb85a775453f47604455635da61a`

```sql
 1 | INSERT INTO tenants (id, name) VALUES ('eag-internal', 'EAG — Operação Interna');
 2 | 
 3 | INSERT INTO users (id, tenant_id, email, display_name, role) VALUES
 4 |   ('system-admin', 'eag-internal', 'admin@local.eag', 'Administrador local', 'admin');
 5 | 
 6 | INSERT INTO parameters (id, tenant_id, parameter_key, scope_key, value_json, effective_from, changed_by, change_reason) VALUES
 7 |   ('param-confidence', 'eag-internal', 'confidence_min', 'global', '50', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
 8 |   ('param-potential', 'eag-internal', 'potential_min', 'global', '40', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
 9 |   ('param-completeness', 'eag-internal', 'completeness_min', 'global', '60', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
10 |   ('param-risk-coverage', 'eag-internal', 'risk_coverage_min', 'global', '50', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
11 |   ('param-risk-high', 'eag-internal', 'risk_high', 'global', '70', '2026-09-21T00:00:00Z', 'system-admin', 'Padrão aprovado na Spec v1.3'),
12 |   ('param-sugar-volume', 'eag-internal', 'volume_min', 'sugar', '500', '2026-09-21T00:00:00Z', 'system-admin', '500 MT por operação'),
13 |   ('param-coffee-foodera-volume', 'eag-internal', 'volume_min', 'coffee:FoodEra', '5', '2026-09-21T00:00:00Z', 'system-admin', 'Piloto FoodEra');
14 | 
15 | INSERT INTO sanction_sources (id, source_key, name, official_url, jurisdiction, blocking_policy) VALUES
16 |   ('source-ofac-sdn', 'ofac_sdn', 'OFAC SDN', 'https://ofac.treasury.gov/sanctions-list-service', 'US', 'legal_block'),
17 |   ('source-cgu-ceis', 'cgu_ceis', 'CGU CEIS', 'https://portaldatransparencia.gov.br/sancoes/consulta', 'BR', 'integrity_alert'),
18 |   ('source-cgu-cnep', 'cgu_cnep', 'CGU CNEP', 'https://portaldatransparencia.gov.br/sancoes/consulta', 'BR', 'integrity_alert');
```


## Servidor (Worker)

<a id="arquivo-10"></a>
### 10. `src/worker.js`

387 linhas · SHA-256 `6dced2b58cbb267f2380f7b0e8a82a85c31a0431f781191c78dde42fe430f629`

```javascript
  1 | import { calculateCompleteness, calculateConfidence, calculatePotential, calculateRisk, evaluateQualificationGate, SCORE_VERSION } from "./scoring.js";
  2 | 
  3 | const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  4 | const ROLES = ["admin", "commercial_manager", "seller_analyst", "auditor_viewer"];
  5 | const WRITE_ROLES = new Set(["admin", "commercial_manager", "seller_analyst"]);
  6 | const APPROVER_ROLES = new Set(["admin", "commercial_manager"]);
  7 | 
  8 | function response(data, status = 200, extraHeaders = {}) {
  9 |   return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
 10 | }
 11 | 
 12 | function apiError(status, code, message, details) {
 13 |   return response({ error: { code, message, details: details ?? null } }, status);
 14 | }
 15 | 
 16 | async function bodyJson(request) {
 17 |   const type = request.headers.get("content-type") || "";
 18 |   if (!type.includes("application/json")) throw new ApiException(415, "unsupported_media_type", "Envie application/json.");
 19 |   try { return await request.json(); } catch { throw new ApiException(400, "invalid_json", "O corpo JSON é inválido."); }
 20 | }
 21 | 
 22 | class ApiException extends Error {
 23 |   constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
 24 | }
 25 | 
 26 | function requireFields(object, fields) {
 27 |   const missing = fields.filter((field) => object[field] === undefined || object[field] === null || object[field] === "");
 28 |   if (missing.length) throw new ApiException(422, "missing_fields", "Há campos obrigatórios ausentes.", { missing });
 29 | }
 30 | 
 31 | function bytesToBase64(bytes) {
 32 |   let binary=""; for(const byte of bytes) binary+=String.fromCharCode(byte); return btoa(binary);
 33 | }
 34 | 
 35 | function base64ToBytes(value) {
 36 |   const binary=atob(value); return Uint8Array.from(binary,(char)=>char.charCodeAt(0));
 37 | }
 38 | 
 39 | async function piiKey(env) {
 40 |   if(!env.PII_ENCRYPTION_KEY) throw new ApiException(503,"pii_key_unavailable","O armazenamento de contatos aguarda a chave de proteção de dados.");
 41 |   const raw=base64ToBytes(env.PII_ENCRYPTION_KEY);
 42 |   if(raw.length!==32) throw new ApiException(503,"pii_key_invalid","A chave de proteção de dados está inválida.");
 43 |   return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
 44 | }
 45 | 
 46 | async function encryptPii(value, env) {
 47 |   if(value===undefined||value===null||value==="") return null;
 48 |   const iv=crypto.getRandomValues(new Uint8Array(12)); const key=await piiKey(env);
 49 |   const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(String(value)));
 50 |   return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
 51 | }
 52 | 
 53 | async function decryptPii(value, env) {
 54 |   if(!value) return null;
 55 |   try { const [iv,cipher]=value.split("."); const key=await piiKey(env); const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:base64ToBytes(iv)},key,base64ToBytes(cipher)); return new TextDecoder().decode(plain); }
 56 |   catch { return null; }
 57 | }
 58 | 
 59 | async function getActor(request, env) {
 60 |   const tenantId = env.DEFAULT_TENANT_ID || "eag-internal";
 61 |   const platformId = request.headers.get("oai-authenticated-user-id");
 62 |   const accessEmail = request.headers.get("oai-authenticated-user-email") || request.headers.get("cf-access-authenticated-user-email");
 63 |   const localEmail = env.ENVIRONMENT === "local" ? request.headers.get("x-eag-user") || "admin@local.eag" : null;
 64 |   const email = accessEmail || localEmail;
 65 |   if (!email) throw new ApiException(401, "authentication_required", "Acesso autenticado é obrigatório.");
 66 |   await env.DB.prepare("INSERT OR IGNORE INTO tenants (id,name,status) VALUES (?,?, 'active')").bind(tenantId,"EAG — Operação Interna").run();
 67 |   const user = await env.DB.prepare("SELECT id, tenant_id, email, display_name, role FROM users WHERE tenant_id=? AND lower(email)=lower(?) AND status='active'").bind(tenantId, email).first();
 68 |   if (user) return user;
 69 |   const count = await env.DB.prepare("SELECT COUNT(*) total FROM users WHERE tenant_id=? AND status='active'").bind(tenantId).first();
 70 |   if (platformId && Number(count.total) === 0) {
 71 |     const fullNameHeader=request.headers.get("oai-authenticated-user-full-name");
 72 |     const encoding=request.headers.get("oai-authenticated-user-full-name-encoding");
 73 |     let displayName=email;
 74 |     if(fullNameHeader && encoding==="percent-encoded-utf-8") { try { displayName=decodeURIComponent(fullNameHeader); } catch {} }
 75 |     await env.DB.prepare("INSERT INTO users (id,tenant_id,email,display_name,role,status) VALUES (?,?,?,?,?,'active')").bind(platformId,tenantId,email,displayName,"admin").run();
 76 |     return {id:platformId,tenant_id:tenantId,email,display_name:displayName,role:"admin"};
 77 |   }
 78 |   if (env.ENVIRONMENT === "local") {
 79 |     const requestedRole = request.headers.get("x-eag-role") || "admin";
 80 |     return { id: "local-developer", tenant_id: tenantId, email, display_name: "Desenvolvimento local", role: ROLES.includes(requestedRole) ? requestedRole : "admin" };
 81 |   }
 82 |   throw new ApiException(403, "user_not_authorized", "Usuário autenticado não está autorizado no EAG Compass.");
 83 | }
 84 | 
 85 | function requireRole(actor, allowed) {
 86 |   if (!allowed.has(actor.role)) throw new ApiException(403, "forbidden", "Seu perfil não permite esta ação.");
 87 | }
 88 | 
 89 | async function audit(env, actor, requestId, action, entityType, entityId, values = {}) {
 90 |   await env.DB.prepare(`INSERT INTO audit_log
 91 |     (id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,field_name,old_value_json,new_value_json,reason,evidence_id,formula_version,parameters_json,request_id)
 92 |     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
 93 |     .bind(crypto.randomUUID(), actor.tenant_id, actor.id, actor.role, action, entityType, entityId, values.fieldName ?? null,
 94 |       values.oldValue === undefined ? null : JSON.stringify(values.oldValue), values.newValue === undefined ? null : JSON.stringify(values.newValue),
 95 |       values.reason ?? null, values.evidenceId ?? null, values.formulaVersion ?? null, values.parameters ? JSON.stringify(values.parameters) : null, requestId).run();
 96 | }
 97 | 
 98 | async function getParameters(env, tenantId) {
 99 |   const result = await env.DB.prepare(`SELECT parameter_key,scope_key,value_json FROM parameters p
100 |     WHERE tenant_id=? AND effective_from<=? AND (effective_to IS NULL OR effective_to>?)
101 |     AND effective_from=(SELECT MAX(effective_from) FROM parameters p2 WHERE p2.tenant_id=p.tenant_id AND p2.parameter_key=p.parameter_key AND p2.scope_key=p.scope_key AND p2.effective_from<=?)`)
102 |     .bind(tenantId, new Date().toISOString(), new Date().toISOString(), new Date().toISOString()).all();
103 |   const values = {};
104 |   for (const row of result.results) values[`${row.parameter_key}:${row.scope_key}`] = JSON.parse(row.value_json);
105 |   return values;
106 | }
107 | 
108 | async function dashboard(env, actor) {
109 |   const counts = await env.DB.prepare(`SELECT pipeline_status,COUNT(*) total FROM companies WHERE tenant_id=? AND pipeline_status!='inactive' GROUP BY pipeline_status`).bind(actor.tenant_id).all();
110 |   const exceptions = await env.DB.prepare(`SELECT exception_status,COUNT(*) total FROM companies WHERE tenant_id=? AND exception_status IS NOT NULL GROUP BY exception_status`).bind(actor.tenant_id).all();
111 |   return response({ pipeline: Object.fromEntries(counts.results.map((r) => [r.pipeline_status, r.total])), exceptions: Object.fromEntries(exceptions.results.map((r) => [r.exception_status, r.total])), generatedAt: new Date().toISOString() });
112 | }
113 | 
114 | async function listCompanies(request, env, actor) {
115 |   const url = new URL(request.url);
116 |   const status = url.searchParams.get("status");
117 |   const search = url.searchParams.get("q");
118 |   const bindings = [actor.tenant_id];
119 |   const where = ["c.tenant_id=?", "c.pipeline_status!='inactive'"];
120 |   if (status) { where.push("c.pipeline_status=?"); bindings.push(status); }
121 |   if (search) { where.push("(lower(c.legal_name) LIKE ? OR lower(c.country_code) LIKE ?)"); bindings.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`); }
122 |   const query = `SELECT c.*,
123 |     (SELECT commodity FROM demands d WHERE d.company_id=c.id ORDER BY d.updated_at DESC LIMIT 1) commodity,
124 |     (SELECT product_variant FROM demands d WHERE d.company_id=c.id ORDER BY d.updated_at DESC LIMIT 1) product_variant,
125 |     (SELECT completeness FROM demands d WHERE d.company_id=c.id ORDER BY d.updated_at DESC LIMIT 1) completeness,
126 |     (SELECT score_value FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='confidence') confidence_score,
127 |     (SELECT score_min FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='potential') potential_min,
128 |     (SELECT score_max FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='potential') potential_max,
129 |     (SELECT score_value FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='risk') risk_score,
130 |     (SELECT coverage FROM company_latest_scores s WHERE s.company_id=c.id AND s.score_type='risk') risk_coverage
131 |     FROM companies c WHERE ${where.join(" AND ")} ORDER BY c.updated_at DESC LIMIT 200`;
132 |   const result = await env.DB.prepare(query).bind(...bindings).all();
133 |   return response({ companies: result.results, total: result.results.length });
134 | }
135 | 
136 | async function getCompany(env, actor, companyId) {
137 |   const company = await env.DB.prepare("SELECT * FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id, companyId).first();
138 |   if (!company) throw new ApiException(404, "company_not_found", "Empresa não encontrada.");
139 |   const [evidence, contacts, demands, scores, approvals] = await Promise.all([
140 |     env.DB.prepare("SELECT * FROM evidence WHERE tenant_id=? AND company_id=? ORDER BY created_at DESC").bind(actor.tenant_id, companyId).all(),
141 |     env.DB.prepare("SELECT id,company_id,full_name_encrypted,job_title_encrypted,email_encrypted,phone_encrypted,linkedin_url_encrypted,source_label,source_url,created_at,updated_at FROM contacts WHERE tenant_id=? AND company_id=? ORDER BY created_at DESC").bind(actor.tenant_id, companyId).all(),
142 |     env.DB.prepare("SELECT * FROM demands WHERE tenant_id=? AND company_id=? ORDER BY updated_at DESC").bind(actor.tenant_id, companyId).all(),
143 |     env.DB.prepare("SELECT * FROM scores WHERE tenant_id=? AND company_id=? ORDER BY calculated_at DESC").bind(actor.tenant_id, companyId).all(),
144 |     env.DB.prepare("SELECT * FROM approvals WHERE tenant_id=? AND company_id=? ORDER BY created_at DESC").bind(actor.tenant_id, companyId).all()
145 |   ]);
146 |   const safeContacts=[];
147 |   for(const contact of contacts.results) safeContacts.push({id:contact.id,company_id:contact.company_id,fullName:await decryptPii(contact.full_name_encrypted,env),jobTitle:await decryptPii(contact.job_title_encrypted,env),email:await decryptPii(contact.email_encrypted,env),phone:await decryptPii(contact.phone_encrypted,env),linkedinUrl:await decryptPii(contact.linkedin_url_encrypted,env),sourceLabel:contact.source_label,sourceUrl:contact.source_url,createdAt:contact.created_at,updatedAt:contact.updated_at});
148 |   const demandFields={};
149 |   for(const demand of demands.results){ const rows=await env.DB.prepare("SELECT field_key,field_status,value_json,not_applicable_reason,source_reference,confirmed_at FROM demand_fields WHERE tenant_id=? AND demand_id=? ORDER BY field_key").bind(actor.tenant_id,demand.id).all(); demandFields[demand.id]=rows.results; }
150 |   return response({ company, evidence: evidence.results, contacts:safeContacts, demands: demands.results, demandFields, scores: scores.results, approvals: approvals.results });
151 | }
152 | 
153 | async function createCompany(request, env, actor, requestId) {
154 |   requireRole(actor, WRITE_ROLES);
155 |   const input = await bodyJson(request);
156 |   requireFields(input, ["legalName", "countryCode", "sourceLabel"]);
157 |   const id = crypto.randomUUID();
158 |   const now = new Date().toISOString();
159 |   try {
160 |     await env.DB.batch([
161 |       env.DB.prepare(`INSERT INTO companies (id,tenant_id,legal_name,trade_name,country_code,registration_id,registration_id_type,buyer_type,pipeline_status,owner_user_id,source_label,source_url,created_by,created_at,updated_at)
162 |         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, actor.tenant_id, input.legalName.trim(), input.tradeName ?? null, input.countryCode.toUpperCase(), input.registrationId ?? null, input.registrationIdType ?? null, input.buyerType ?? "unconfirmed", "discovered", actor.id, input.sourceLabel, input.sourceUrl ?? null, actor.id, now, now),
163 |       env.DB.prepare(`INSERT INTO evidence (id,tenant_id,company_id,category,evidence_type,reference,source_url,consulted_at,validation_status,metadata_json,created_by)
164 |         VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), actor.tenant_id, id, "commercial_signal", input.signalType ?? "manual_source", input.sourceLabel, input.sourceUrl ?? null, now, "pending", "{}", actor.id)
165 |     ]);
166 |   } catch (error) {
167 |     if (String(error).includes("UNIQUE")) throw new ApiException(409, "company_duplicate", "Já existe uma empresa com este nome e país.");
168 |     throw error;
169 |   }
170 |   await audit(env, actor, requestId, "company.created", "company", id, { newValue: { legalName: input.legalName, countryCode: input.countryCode, pipelineStatus: "discovered" } });
171 |   return response({ id, pipelineStatus: "discovered" }, 201);
172 | }
173 | 
174 | async function addEvidence(request, env, actor, requestId, companyId) {
175 |   requireRole(actor, WRITE_ROLES);
176 |   const input = await bodyJson(request);
177 |   requireFields(input, ["category", "evidenceType", "reference", "consultedAt"]);
178 |   if (!["business", "market", "commercial_signal"].includes(input.category)) throw new ApiException(422, "invalid_category", "Categoria de evidência inválida.");
179 |   const company = await env.DB.prepare("SELECT id,pipeline_status FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id, companyId).first();
180 |   if (!company) throw new ApiException(404, "company_not_found", "Empresa não encontrada.");
181 |   const id = crypto.randomUUID();
182 |   const validated = input.validationStatus === "valid";
183 |   await env.DB.prepare(`INSERT INTO evidence (id,tenant_id,company_id,category,evidence_type,reference,source_url,fact_date,consulted_at,validation_status,validated_by,validated_at,metadata_json,created_by)
184 |     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, actor.tenant_id, companyId, input.category, input.evidenceType, input.reference, input.sourceUrl ?? null, input.factDate ?? null, input.consultedAt, input.validationStatus ?? "pending", validated ? actor.id : null, validated ? new Date().toISOString() : null, JSON.stringify(input.metadata ?? {}), actor.id).run();
185 |   if (input.category === "business" && validated && company.pipeline_status === "discovered") {
186 |     await env.DB.prepare("UPDATE companies SET pipeline_status='prospected',updated_at=? WHERE tenant_id=? AND id=?").bind(new Date().toISOString(), actor.tenant_id, companyId).run();
187 |   }
188 |   await audit(env, actor, requestId, "evidence.created", "evidence", id, { newValue: input, evidenceId: id });
189 |   return response({ id, pipelineStatus: input.category === "business" && validated && company.pipeline_status === "discovered" ? "prospected" : company.pipeline_status }, 201);
190 | }
191 | 
192 | async function addContact(request, env, actor, requestId, companyId) {
193 |   requireRole(actor, WRITE_ROLES);
194 |   const input=await bodyJson(request); requireFields(input,["fullName","sourceLabel"]);
195 |   const company=await env.DB.prepare("SELECT id,pipeline_status FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id,companyId).first();
196 |   if(!company) throw new ApiException(404,"company_not_found","Empresa não encontrada.");
197 |   const id=crypto.randomUUID(); const now=new Date().toISOString();
198 |   const encrypted=await Promise.all([encryptPii(input.fullName,env),encryptPii(input.jobTitle,env),encryptPii(input.email,env),encryptPii(input.phone,env),encryptPii(input.linkedinUrl,env)]);
199 |   await env.DB.prepare(`INSERT INTO contacts (id,tenant_id,company_id,full_name_encrypted,job_title_encrypted,email_encrypted,phone_encrypted,linkedin_url_encrypted,source_label,source_url,created_by,created_at,updated_at)
200 |     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,actor.tenant_id,companyId,...encrypted,input.sourceLabel,input.sourceUrl??null,actor.id,now,now).run();
201 |   await audit(env,actor,requestId,"contact.created","contact",id,{newValue:{companyId,sourceLabel:input.sourceLabel,fieldsProvided:{fullName:true,jobTitle:Boolean(input.jobTitle),email:Boolean(input.email),phone:Boolean(input.phone),linkedinUrl:Boolean(input.linkedinUrl)}}});
202 |   return response({id,createdAt:now},201);
203 | }
204 | 
205 | async function addRiskObservation(request, env, actor, requestId, companyId) {
206 |   requireRole(actor, WRITE_ROLES);
207 |   const input=await bodyJson(request); requireFields(input,["component","severity","sourceReference","observedAt"]);
208 |   if(!["registration","credit","payment","reputation","logistics"].includes(input.component)||!Number.isFinite(Number(input.severity))||Number(input.severity)<0||Number(input.severity)>20) throw new ApiException(422,"invalid_risk_observation","Componente ou severidade inválidos.");
209 |   const id=crypto.randomUUID();
210 |   await env.DB.prepare("INSERT INTO risk_observations (id,tenant_id,company_id,component,severity,source_reference,observed_at,recorded_by) VALUES (?,?,?,?,?,?,?,?)").bind(id,actor.tenant_id,companyId,input.component,Number(input.severity),input.sourceReference,input.observedAt,actor.id).run();
211 |   await audit(env,actor,requestId,"risk_observation.created","risk_observation",id,{newValue:input});
212 |   return response({id},201);
213 | }
214 | 
215 | async function createApproval(request, env, actor, requestId, companyId) {
216 |   requireRole(actor, APPROVER_ROLES);
217 |   const input=await bodyJson(request); requireFields(input,["approvalType","status","reason"]);
218 |   if(!["below_minimum","risk_coverage_waiver","risk_mitigation","intermediary_validation"].includes(input.approvalType)||!["approved","rejected","pending"].includes(input.status)) throw new ApiException(422,"invalid_approval","Tipo ou estado de aprovação inválido.");
219 |   const id=crypto.randomUUID(); const now=new Date().toISOString();
220 |   await env.DB.prepare("INSERT INTO approvals (id,tenant_id,company_id,demand_id,approval_type,status,reason,approved_by,decided_at,metadata_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id,actor.tenant_id,companyId,input.demandId??null,input.approvalType,input.status,input.reason,input.status==="pending"?null:actor.id,input.status==="pending"?null:now,JSON.stringify(input.metadata??{}),actor.id).run();
221 |   await audit(env,actor,requestId,"approval.created","approval",id,{newValue:input,reason:input.reason});
222 |   return response({id,status:input.status},201);
223 | }
224 | 
225 | const REQUIRED_DEMAND_FIELDS = new Set(["product","specification","packaging","volume_per_operation","destination_country","delivery_location","incoterm","required_date","modality","operations_per_year","payment_method","payment_term","payment_guarantee","final_buyer","decision_maker","compliance_restrictions"]);
226 | 
227 | async function saveDemand(request, env, actor, requestId, companyId) {
228 |   requireRole(actor, WRITE_ROLES);
229 |   const input = await bodyJson(request);
230 |   requireFields(input, ["commodity", "fields"]);
231 |   if (!["sugar", "coffee"].includes(input.commodity) || !Array.isArray(input.fields)) throw new ApiException(422, "invalid_demand", "Commodity ou campos inválidos.");
232 |   const company = await env.DB.prepare("SELECT id,pipeline_status FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id, companyId).first();
233 |   if (!company) throw new ApiException(404, "company_not_found", "Empresa não encontrada.");
234 |   const demandId = input.id || crypto.randomUUID();
235 |   const normalizedFields = input.fields.map((field) => ({ ...field, required: REQUIRED_DEMAND_FIELDS.has(field.key) }));
236 |   for (const field of normalizedFields) {
237 |     requireFields(field, ["key", "status"]);
238 |     if (!["confirmed","not_confirmed","not_applicable"].includes(field.status)) throw new ApiException(422, "invalid_field_status", `Estado inválido para ${field.key}.`);
239 |     if (field.status === "not_applicable" && !field.notApplicableReason) throw new ApiException(422, "missing_not_applicable_reason", `Justificativa obrigatória para ${field.key}.`);
240 |   }
241 |   const completeness = calculateCompleteness(normalizedFields);
242 |   const now = new Date().toISOString();
243 |   const statements = [env.DB.prepare(`INSERT INTO demands (id,tenant_id,company_id,commodity,product_variant,supplier_reference,completeness,current_state,desired_state,gap_summary,created_by,created_at,updated_at)
244 |     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,company_id,commodity) DO UPDATE SET product_variant=excluded.product_variant,supplier_reference=excluded.supplier_reference,completeness=excluded.completeness,current_state=excluded.current_state,desired_state=excluded.desired_state,gap_summary=excluded.gap_summary,updated_at=excluded.updated_at`)
245 |     .bind(demandId, actor.tenant_id, companyId, input.commodity, input.productVariant ?? null, input.supplierReference ?? null, completeness.score, input.currentState ?? null, input.desiredState ?? null, input.gapSummary ?? null, actor.id, now, now)];
246 |   for (const field of normalizedFields) statements.push(env.DB.prepare(`INSERT INTO demand_fields (id,tenant_id,demand_id,field_key,field_status,value_json,not_applicable_reason,source_reference,confirmed_by,confirmed_at,updated_by,updated_at)
247 |     VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,demand_id,field_key) DO UPDATE SET field_status=excluded.field_status,value_json=excluded.value_json,not_applicable_reason=excluded.not_applicable_reason,source_reference=excluded.source_reference,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
248 |     .bind(crypto.randomUUID(), actor.tenant_id, demandId, field.key, field.status, field.value === undefined ? null : JSON.stringify(field.value), field.notApplicableReason ?? null, field.sourceReference ?? null, field.status === "confirmed" ? actor.id : null, field.status === "confirmed" ? now : null, actor.id, now));
249 |   await env.DB.batch(statements);
250 |   if (completeness.score >= 25 && !["qualified","confirmed_opportunity","blocked"].includes(company.pipeline_status)) await env.DB.prepare("UPDATE companies SET pipeline_status='qualifying',updated_at=? WHERE tenant_id=? AND id=?").bind(now, actor.tenant_id, companyId).run();
251 |   await audit(env, actor, requestId, "demand.saved", "demand", demandId, { newValue: { commodity: input.commodity, completeness } });
252 |   return response({ id: demandId, completeness, pipelineStatus: completeness.score >= 25 ? "qualifying" : company.pipeline_status });
253 | }
254 | 
255 | function decodeFields(rows) {
256 |   return Object.fromEntries(rows.map((row) => [row.field_key, row.value_json ? JSON.parse(row.value_json) : null]));
257 | }
258 | 
259 | async function recalculateScores(env, actor, requestId, companyId) {
260 |   requireRole(actor, WRITE_ROLES);
261 |   const demand = await env.DB.prepare("SELECT * FROM demands WHERE tenant_id=? AND company_id=? ORDER BY updated_at DESC LIMIT 1").bind(actor.tenant_id, companyId).first();
262 |   if (!demand) throw new ApiException(422, "demand_required", "Cadastre a demanda antes de calcular os scores.");
263 |   const [fieldResult, evidenceResult, verificationResult, riskResult, parameters] = await Promise.all([
264 |     env.DB.prepare("SELECT * FROM demand_fields WHERE tenant_id=? AND demand_id=?").bind(actor.tenant_id, demand.id).all(),
265 |     env.DB.prepare("SELECT * FROM evidence WHERE tenant_id=? AND company_id=? AND category='business' AND validation_status='valid' ORDER BY fact_date DESC").bind(actor.tenant_id, companyId).all(),
266 |     env.DB.prepare(`SELECT cv.* FROM contact_verifications cv JOIN contacts c ON c.id=cv.contact_id WHERE cv.tenant_id=? AND c.company_id=? AND cv.status='confirmed'`).bind(actor.tenant_id, companyId).all(),
267 |     env.DB.prepare(`SELECT component,severity FROM risk_observations ro WHERE tenant_id=? AND company_id=? AND observed_at=(SELECT MAX(observed_at) FROM risk_observations ro2 WHERE ro2.tenant_id=ro.tenant_id AND ro2.company_id=ro.company_id AND ro2.component=ro.component)`).bind(actor.tenant_id, companyId).all(),
268 |     getParameters(env, actor.tenant_id)
269 |   ]);
270 |   const fields = decodeFields(fieldResult.results);
271 |   const evidence = evidenceResult.results;
272 |   const verificationTypes = new Set(verificationResult.results.map((row) => row.verification_type));
273 |   const bestEvidence = evidence.find((row) => row.evidence_type === "customs_record") ? "customs_record" : evidence.find((row) => row.evidence_type === "bill_of_lading") ? "bill_of_lading" : evidence.length ? "company_document" : null;
274 |   const latestFact = evidence.map((row) => row.fact_date).filter(Boolean).sort().at(-1);
275 |   const ageMonths = latestFact ? (Date.now() - new Date(latestFact).getTime()) / 2629800000 : null;
276 |   const scope = demand.commodity === "coffee" && demand.supplier_reference ? `coffee:${demand.supplier_reference}` : demand.commodity;
277 |   const volumeMinimum = parameters[`volume_min:${scope}`] ?? parameters[`volume_min:${demand.commodity}`] ?? null;
278 |   const potential = calculatePotential({
279 |     commodity:demand.commodity, volumePerOperation:Number(fields.volume_per_operation?.amount ?? fields.volume_per_operation), operationsPerYear:Number(fields.operations_per_year), annualPotentialDirect:fields.annual_potential_direct?.amount ?? fields.annual_potential_direct,
280 |     specificationConfirmed:fieldResult.results.some((r)=>r.field_key==="specification"&&r.field_status==="confirmed"), packagingConfirmed:fieldResult.results.some((r)=>r.field_key==="packaging"&&r.field_status==="confirmed"),
281 |     incotermConfirmed:fieldResult.results.some((r)=>r.field_key==="incoterm"&&r.field_status==="confirmed"), requiredDateConfirmed:fieldResult.results.some((r)=>r.field_key==="required_date"&&r.field_status==="confirmed"), deliveryLocationConfirmed:fieldResult.results.some((r)=>r.field_key==="delivery_location"&&r.field_status==="confirmed"), logisticsConfirmed:Boolean(fields.logistics_confirmed)
282 |   }, { volumeMinimum });
283 |   const confidence = calculateConfidence({ purchaseEvidence:bestEvidence, recency:ageMonths===null?null:ageMonths<6?"under_6_months":ageMonths<=12?"from_6_to_12_months":"over_12_months", companyRegistry:fields.company_registry_status, decisionMaker:verificationTypes.has("decision_authority")?"verified_authority":fields.decision_maker?"title_only":null, directConfirmation:verificationTypes.has("direct_demand")?"demand_confirmed":verificationTypes.has("identity")?"initial_response":null });
284 |   const risk = calculateRisk(Object.fromEntries(riskResult.results.map((row)=>[row.component,row.severity])));
285 |   const now = new Date().toISOString();
286 |   const statements = [
287 |     env.DB.prepare("INSERT INTO scores (id,tenant_id,company_id,demand_id,score_type,score_value,score_min,score_max,coverage,classification,components_json,formula_version,parameters_json,calculated_by,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.tenant_id,companyId,demand.id,"potential",potential.scoreMin,potential.scoreMin,potential.scoreMax,potential.coverage,potential.belowMinimum?"below_minimum":null,JSON.stringify(potential.components),SCORE_VERSION,JSON.stringify({volumeMinimum}),actor.id,now),
288 |     env.DB.prepare("INSERT INTO scores (id,tenant_id,company_id,demand_id,score_type,score_value,score_min,score_max,coverage,classification,components_json,formula_version,parameters_json,calculated_by,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.tenant_id,companyId,demand.id,"confidence",confidence.score,confidence.score,confidence.score,100,null,JSON.stringify(confidence.components),SCORE_VERSION,"{}",actor.id,now),
289 |     env.DB.prepare("INSERT INTO scores (id,tenant_id,company_id,demand_id,score_type,score_value,score_min,score_max,coverage,classification,components_json,formula_version,parameters_json,calculated_by,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.tenant_id,companyId,demand.id,"risk",risk.score,risk.score,risk.score,risk.coverage,risk.state,JSON.stringify(risk.components),SCORE_VERSION,"{}",actor.id,now)
290 |   ];
291 |   await env.DB.batch(statements);
292 |   if (potential.belowMinimum) await env.DB.prepare("UPDATE companies SET exception_status='below_minimum',updated_at=? WHERE tenant_id=? AND id=?").bind(now,actor.tenant_id,companyId).run();
293 |   await audit(env, actor, requestId, "scores.calculated", "company", companyId, { newValue:{potential,confidence,risk}, formulaVersion:SCORE_VERSION, parameters });
294 |   return response({ potential, confidence, risk, completeness:demand.completeness });
295 | }
296 | 
297 | async function qualifyCompany(env, actor, requestId, companyId) {
298 |   requireRole(actor, APPROVER_ROLES);
299 |   const parameters = await getParameters(env, actor.tenant_id);
300 |   const company = await env.DB.prepare("SELECT * FROM companies WHERE tenant_id=? AND id=?").bind(actor.tenant_id,companyId).first();
301 |   if (!company) throw new ApiException(404,"company_not_found","Empresa não encontrada.");
302 |   const demand = await env.DB.prepare("SELECT * FROM demands WHERE tenant_id=? AND company_id=? ORDER BY updated_at DESC LIMIT 1").bind(actor.tenant_id,companyId).first();
303 |   const scoreRows = await env.DB.prepare("SELECT * FROM company_latest_scores WHERE tenant_id=? AND company_id=?").bind(actor.tenant_id,companyId).all();
304 |   const scores=Object.fromEntries(scoreRows.results.map((row)=>[row.score_type,row]));
305 |   const evidence=await env.DB.prepare("SELECT COUNT(*) total FROM evidence WHERE tenant_id=? AND company_id=? AND category='business' AND validation_status='valid'").bind(actor.tenant_id,companyId).first();
306 |   const decisions=await env.DB.prepare("SELECT decision FROM screening_decisions sd JOIN screening_matches sm ON sm.id=sd.screening_match_id JOIN screening_runs sr ON sr.id=sm.screening_run_id WHERE sd.tenant_id=? AND sr.company_id=?").bind(actor.tenant_id,companyId).all();
307 |   const approvals=await env.DB.prepare("SELECT approval_type,status FROM approvals WHERE tenant_id=? AND company_id=? ORDER BY created_at DESC").bind(actor.tenant_id,companyId).all();
308 |   const approved=new Set(approvals.results.filter((x)=>x.status==="approved").map((x)=>x.approval_type));
309 |   const fieldRows=demand?await env.DB.prepare("SELECT field_key,field_status,value_json FROM demand_fields WHERE tenant_id=? AND demand_id=?").bind(actor.tenant_id,demand.id).all():{results:[]};
310 |   const fieldMap=Object.fromEntries(fieldRows.results.map((r)=>[r.field_key,r]));
311 |   const gate=evaluateQualificationGate({
312 |     hasBusinessEvidence:evidence.total>0,confidence:scores.confidence?.score_value,potentialMin:scores.potential?.score_min,completeness:demand?.completeness,
313 |     sanctionBlocked:decisions.results.some((d)=>d.decision==="confirmed_block")||company.exception_status==="sanction_blocked",sanctionReviewPending:company.exception_status==="sanction_review",
314 |     riskCoverage:scores.risk?.coverage,riskCoverageWaiverApproved:approved.has("risk_coverage_waiver"),finalBuyerConfirmed:fieldMap.final_buyer?.field_status==="confirmed",decisionMakerConfirmed:fieldMap.decision_maker?.field_status==="confirmed",
315 |     belowMinimum:company.exception_status==="below_minimum",minimumVolumeApproval:approved.has("below_minimum"),riskScore:scores.risk?.score_value,mitigationApproved:approved.has("risk_mitigation")
316 |   },{confidenceMin:parameters["confidence_min:global"]??50,potentialMin:parameters["potential_min:global"]??40,completenessMin:parameters["completeness_min:global"]??60,riskCoverageMin:parameters["risk_coverage_min:global"]??50});
317 |   if(!gate.qualified) throw new ApiException(409,"qualification_gate_failed","A empresa ainda não atende ao gate de qualificação.",{pending:gate.pending,checks:gate.checks});
318 |   await env.DB.prepare("UPDATE companies SET pipeline_status='qualified',exception_status=NULL,updated_at=? WHERE tenant_id=? AND id=?").bind(new Date().toISOString(),actor.tenant_id,companyId).run();
319 |   await audit(env,actor,requestId,"company.qualified","company",companyId,{oldValue:{pipelineStatus:company.pipeline_status},newValue:{pipelineStatus:"qualified"},formulaVersion:SCORE_VERSION,parameters});
320 |   return response({qualified:true,pipelineStatus:"qualified",gate});
321 | }
322 | 
323 | async function listAudit(request, env, actor) {
324 |   const url=new URL(request.url); const entityId=url.searchParams.get("entityId"); const bindings=[actor.tenant_id]; const where=["tenant_id=?"];
325 |   if(entityId){where.push("entity_id=?");bindings.push(entityId)}
326 |   const result=await env.DB.prepare(`SELECT * FROM audit_log WHERE ${where.join(" AND ")} ORDER BY occurred_at DESC LIMIT 200`).bind(...bindings).all();
327 |   return response({events:result.results});
328 | }
329 | 
330 | async function route(request, env) {
331 |   const url = new URL(request.url);
332 |   if (!url.pathname.startsWith("/api/")) {
333 |     if (env.ASSETS) return env.ASSETS.fetch(request);
334 |     return new Response("Interface indisponível", { status: 503 });
335 |   }
336 |   const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
337 |   if (url.pathname === "/api/health") return response({ status:"ok", service:"eag-compass", version:"0.3.1", time:new Date().toISOString() });
338 |   const actor = await getActor(request, env);
339 |   if (url.pathname === "/api/session" && request.method === "GET") return response({ actor });
340 |   if (url.pathname === "/api/dashboard" && request.method === "GET") return dashboard(env, actor);
341 |   if (url.pathname === "/api/companies" && request.method === "GET") return listCompanies(request, env, actor);
342 |   if (url.pathname === "/api/companies" && request.method === "POST") return createCompany(request, env, actor, requestId);
343 |   if (url.pathname === "/api/audit" && request.method === "GET") return listAudit(request, env, actor);
344 |   const match = url.pathname.match(/^\/api\/companies\/([^/]+)(?:\/(evidence|contacts|demand|risk-observations|approvals|scores\/recalculate|qualify))?$/);
345 |   if (match) {
346 |     const [, companyId, action] = match;
347 |     if (!action && request.method === "GET") return getCompany(env, actor, companyId);
348 |     if (action === "evidence" && request.method === "POST") return addEvidence(request, env, actor, requestId, companyId);
349 |     if (action === "contacts" && request.method === "POST") return addContact(request, env, actor, requestId, companyId);
350 |     if (action === "demand" && request.method === "PUT") return saveDemand(request, env, actor, requestId, companyId);
351 |     if (action === "risk-observations" && request.method === "POST") return addRiskObservation(request, env, actor, requestId, companyId);
352 |     if (action === "approvals" && request.method === "POST") return createApproval(request, env, actor, requestId, companyId);
353 |     if (action === "scores/recalculate" && request.method === "POST") return recalculateScores(env, actor, requestId, companyId);
354 |     if (action === "qualify" && request.method === "POST") return qualifyCompany(env, actor, requestId, companyId);
355 |   }
356 |   throw new ApiException(404, "route_not_found", "Rota não encontrada.");
357 | }
358 | 
359 | async function processQueue(batch) {
360 |   for (const message of batch.messages) {
361 |     try {
362 |       if (!message.body?.type) throw new Error("Mensagem sem tipo");
363 |       message.ack();
364 |     } catch (error) {
365 |       console.error("queue_message_failed", { id:message.id, error:String(error) });
366 |       message.retry();
367 |     }
368 |   }
369 | }
370 | 
371 | async function runScheduled(env, controller) {
372 |   console.info("scheduled_checkpoint", { cron:controller.cron, scheduledTime:controller.scheduledTime, action:"source_version_check_pending_adapters" });
373 |   await env.CACHE.put("cron:last-run", new Date(controller.scheduledTime).toISOString(), { expirationTtl: 86400 * 7 });
374 | }
375 | 
376 | export default {
377 |   async fetch(request, env) {
378 |     try { return await route(request, env); }
379 |     catch (error) {
380 |       if (error instanceof ApiException) return apiError(error.status, error.code, error.message, error.details);
381 |       console.error("unhandled_error", { error:String(error), stack:error?.stack });
382 |       return apiError(500, "internal_error", "Ocorreu um erro interno.");
383 |     }
384 |   },
385 |   queue: processQueue,
386 |   scheduled: runScheduled
387 | };
```

<a id="arquivo-11"></a>
### 11. `src/scoring.js`

139 linhas · SHA-256 `536b388f8aeb481bd2f9edeec26b2df0c1235f743395fd26955256ec3e9d1ca6`

```javascript
  1 | export const SCORE_VERSION = "1.3.0";
  2 | 
  3 | const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
  4 | const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
  5 | 
  6 | export function calculatePotential(input, parameters = {}) {
  7 |   const commodity = input.commodity;
  8 |   const volume = input.volumePerOperation;
  9 |   const operations = input.operationsPerYear;
 10 |   const minimum = parameters.volumeMinimum ?? (commodity === "sugar" ? 500 : null);
 11 |   const annualDerived = isNumber(volume) && isNumber(operations) ? volume * operations : null;
 12 |   const annual = isNumber(input.annualPotentialDirect) ? input.annualPotentialDirect : annualDerived;
 13 |   const components = {};
 14 | 
 15 |   if (isNumber(volume) && commodity === "sugar") {
 16 |     components.volume = volume < 500 ? 0 : volume < 1000 ? 10 : volume < 2000 ? 20 : 30;
 17 |   } else if (isNumber(volume) && commodity === "coffee" && isNumber(minimum) && minimum > 0) {
 18 |     components.volume = volume < minimum ? 0 : volume < 2 * minimum ? 10 : volume < 4 * minimum ? 20 : 30;
 19 |   }
 20 | 
 21 |   if (isNumber(annual) && commodity === "sugar") {
 22 |     components.annual = annual < 3000 ? 5 : annual < 6000 ? 10 : 20;
 23 |   } else if (isNumber(annual) && commodity === "coffee" && isNumber(minimum) && minimum > 0) {
 24 |     components.annual = annual < 2 * minimum ? 5 : annual < 6 * minimum ? 10 : 20;
 25 |   }
 26 | 
 27 |   if (isNumber(operations)) components.recurrence = operations <= 1 ? 0 : operations <= 4 ? 8 : operations <= 11 ? 15 : 20;
 28 |   if (typeof input.specificationConfirmed === "boolean" || typeof input.packagingConfirmed === "boolean") {
 29 |     components.technical = (input.specificationConfirmed ? 10 : 0) + (input.packagingConfirmed ? 5 : 0);
 30 |   }
 31 |   if (typeof input.incotermConfirmed === "boolean" || typeof input.requiredDateConfirmed === "boolean") {
 32 |     components.readiness = (input.incotermConfirmed ? 5 : 0) + (input.requiredDateConfirmed ? 5 : 0);
 33 |   }
 34 |   if (typeof input.logisticsConfirmed === "boolean") components.logistics = input.logisticsConfirmed ? 5 : 0;
 35 | 
 36 |   const maxima = { volume: 30, annual: 20, recurrence: 20, technical: 15, readiness: 10, logistics: 5 };
 37 |   const observed = Object.values(components).reduce((sum, value) => sum + value, 0);
 38 |   const observedMaximum = Object.keys(components).reduce((sum, key) => sum + maxima[key], 0);
 39 |   const unknownMaximum = 100 - observedMaximum;
 40 |   const directDivergence = isNumber(input.annualPotentialDirect) && isNumber(annualDerived) && input.annualPotentialDirect !== 0
 41 |     ? Math.abs(input.annualPotentialDirect - annualDerived) / input.annualPotentialDirect
 42 |     : 0;
 43 | 
 44 |   return {
 45 |     scoreMin: clamp(observed),
 46 |     scoreMax: clamp(observed + unknownMaximum),
 47 |     coverage: observedMaximum,
 48 |     components,
 49 |     annualPotentialDirect: input.annualPotentialDirect ?? null,
 50 |     annualPotentialDerived: annualDerived,
 51 |     annualPotentialUsed: annual,
 52 |     annualDivergenceAlert: directDivergence > 0.1,
 53 |     belowMinimum: isNumber(volume) && isNumber(minimum) ? volume < minimum : null,
 54 |     version: SCORE_VERSION
 55 |   };
 56 | }
 57 | 
 58 | export function calculateConfidence(input) {
 59 |   const evidencePoints = { customs_record: 30, bill_of_lading: 25, company_document: 20 };
 60 |   const recencyPoints = { under_6_months: 20, from_6_to_12_months: 15, over_12_months: 5 };
 61 |   const registryPoints = { verified_active: 15, partially_verified: 8 };
 62 |   const decisionMakerPoints = { verified_authority: 15, title_only: 5 };
 63 |   const directPoints = { demand_confirmed: 20, initial_response: 15 };
 64 |   const components = {
 65 |     purchaseEvidence: evidencePoints[input.purchaseEvidence] ?? 0,
 66 |     recency: recencyPoints[input.recency] ?? 0,
 67 |     companyRegistry: registryPoints[input.companyRegistry] ?? 0,
 68 |     decisionMaker: decisionMakerPoints[input.decisionMaker] ?? 0,
 69 |     directConfirmation: directPoints[input.directConfirmation] ?? 0
 70 |   };
 71 |   return { score: Object.values(components).reduce((sum, value) => sum + value, 0), components, version: SCORE_VERSION };
 72 | }
 73 | 
 74 | export const RISK_WEIGHTS = { registration: 1, credit: 1.25, payment: 1.25, reputation: 0.75, logistics: 0.75 };
 75 | 
 76 | export function calculateRisk(input) {
 77 |   let weightedSeverity = 0;
 78 |   let consultedWeight = 0;
 79 |   const components = {};
 80 |   for (const [name, weight] of Object.entries(RISK_WEIGHTS)) {
 81 |     const severity = input[name];
 82 |     if (!isNumber(severity)) continue;
 83 |     const normalized = clamp(severity, 0, 20);
 84 |     components[name] = { severity: normalized, weight, contribution: normalized * weight };
 85 |     weightedSeverity += normalized * weight;
 86 |     consultedWeight += weight;
 87 |   }
 88 |   const coverage = consultedWeight / 5 * 100;
 89 |   const score = consultedWeight === 0 ? null : weightedSeverity / (20 * consultedWeight) * 100;
 90 |   const state = coverage < 50 ? "inconclusive" : coverage < 100 ? "provisional" : "complete";
 91 |   const band = score === null || coverage < 50 ? null : score < 50 ? "low" : score < 70 ? "medium" : score < 80 ? "high" : "very_high";
 92 |   return { score: score === null ? null : Number(score.toFixed(2)), coverage: Number(coverage.toFixed(2)), state, band, components, version: SCORE_VERSION };
 93 | }
 94 | 
 95 | export function calculateCompleteness(fields) {
 96 |   const required = fields.filter((field) => field.required && field.status !== "not_applicable");
 97 |   const confirmed = required.filter((field) => field.status === "confirmed");
 98 |   return {
 99 |     score: required.length === 0 ? 0 : Number((confirmed.length / required.length * 100).toFixed(2)),
100 |     confirmed: confirmed.length,
101 |     applicableRequired: required.length,
102 |     missing: required.filter((field) => field.status !== "confirmed").map((field) => field.key)
103 |   };
104 | }
105 | 
106 | export function evaluateQualificationGate(context, parameters) {
107 |   const checks = [
108 |     ["business_evidence", context.hasBusinessEvidence === true],
109 |     ["confidence", isNumber(context.confidence) && context.confidence >= parameters.confidenceMin],
110 |     ["potential", isNumber(context.potentialMin) && context.potentialMin >= parameters.potentialMin],
111 |     ["completeness", isNumber(context.completeness) && context.completeness >= parameters.completenessMin],
112 |     ["sanctions", !context.sanctionBlocked && !context.sanctionReviewPending],
113 |     ["risk_coverage", (isNumber(context.riskCoverage) && context.riskCoverage >= parameters.riskCoverageMin) || context.riskCoverageWaiverApproved],
114 |     ["final_buyer", context.finalBuyerConfirmed === true],
115 |     ["decision_maker", context.decisionMakerConfirmed === true],
116 |     ["minimum_volume", context.belowMinimum !== true || context.minimumVolumeApproval],
117 |     ["risk_mitigation", !isNumber(context.riskScore) || context.riskScore < 80 || context.mitigationApproved]
118 |   ];
119 |   const pending = checks.filter(([, passed]) => !passed).map(([key]) => key);
120 |   return { qualified: pending.length === 0, pending, checks: Object.fromEntries(checks), version: SCORE_VERSION };
121 | }
122 | 
123 | export function evaluateSanctionMatch(input) {
124 |   if (input.blockedCountry === true) return { action:"block", reason:"blocked_country" };
125 |   if (input.reliableIdentifierMatch === true && input.countryCompatible === true) return { action:"block", reason:"official_id_country" };
126 |   if (input.nameMatch === true) return { action:"review", reason:"name_only" };
127 |   return { action:"clear", reason:"no_match" };
128 | }
129 | 
130 | export function canPerform(role, action) {
131 |   const matrix = {
132 |     read:["admin","commercial_manager","seller_analyst","auditor_viewer"],
133 |     edit_operational:["admin","commercial_manager","seller_analyst"],
134 |     approve_exception:["admin","commercial_manager"],
135 |     manage_parameters:["admin"],
136 |     review_sanction:["admin"]
137 |   };
138 |   return (matrix[action] || []).includes(role);
139 | }
```


## Testes

<a id="arquivo-12"></a>
### 12. `tests/scoring.test.mjs`

85 linhas · SHA-256 `1310cc0c2b8e5a63363a3df2a4e933b98c64d2b17967398a92988e6c1a45d2de`

```javascript
 1 | import test from "node:test";
 2 | import assert from "node:assert/strict";
 3 | import { calculateCompleteness, calculateConfidence, calculatePotential, calculateRisk, canPerform, evaluateQualificationGate, evaluateSanctionMatch } from "../src/scoring.js";
 4 | 
 5 | test("AT2 — Potential de açúcar resulta em 85", () => {
 6 |   const result = calculatePotential({ commodity:"sugar", volumePerOperation:1500, operationsPerYear:6, specificationConfirmed:true, packagingConfirmed:true, incotermConfirmed:true, requiredDateConfirmed:true, logisticsConfirmed:true });
 7 |   assert.equal(result.scoreMin, 85);
 8 |   assert.equal(result.scoreMax, 85);
 9 | });
10 | 
11 | test("AT3 — Potential de café FoodEra resulta em 85", () => {
12 |   const result = calculatePotential({ commodity:"coffee", volumePerOperation:10, operationsPerYear:6, specificationConfirmed:true, packagingConfirmed:true, incotermConfirmed:true, requiredDateConfirmed:true, logisticsConfirmed:true }, { volumeMinimum:5 });
13 |   assert.equal(result.scoreMin, 85);
14 | });
15 | 
16 | test("AT5 — Confidence é independente da completude", () => {
17 |   const confidence = calculateConfidence({ purchaseEvidence:"customs_record", recency:"under_6_months", companyRegistry:"verified_active", decisionMaker:"verified_authority" });
18 |   assert.equal(confidence.score, 80);
19 |   const completeness = calculateCompleteness([{key:"a",required:true,status:"confirmed"},{key:"b",required:true,status:"not_confirmed"}]);
20 |   assert.equal(completeness.score, 50);
21 | });
22 | 
23 | test("AT7 — não se aplica sai do denominador", () => {
24 |   const result = calculateCompleteness([{key:"a",required:true,status:"confirmed"},{key:"b",required:true,status:"not_applicable"}]);
25 |   assert.deepEqual(result, { score:100, confirmed:1, applicableRequired:1, missing:[] });
26 | });
27 | 
28 | test("AT10 — Risk parcial é normalizado e inconclusivo", () => {
29 |   const result = calculateRisk({ registration:0, reputation:8 });
30 |   assert.equal(result.score, 17.14);
31 |   assert.equal(result.coverage, 35);
32 |   assert.equal(result.state, "inconclusive");
33 | });
34 | 
35 | test("AT11 — risco 84 sem mitigação impede qualificação", () => {
36 |   const result = evaluateQualificationGate({ hasBusinessEvidence:true, confidence:80, potentialMin:85, completeness:80, sanctionBlocked:false, sanctionReviewPending:false, riskCoverage:100, finalBuyerConfirmed:true, decisionMakerConfirmed:true, belowMinimum:false, riskScore:84, mitigationApproved:false }, { confidenceMin:50,potentialMin:40,completenessMin:60,riskCoverageMin:50 });
37 |   assert.equal(result.qualified, false);
38 |   assert.ok(result.pending.includes("risk_mitigation"));
39 | });
40 | 
41 | test("AT1 — açúcar abaixo de 500 MT recebe indicação abaixo do mínimo", () => {
42 |   const result=calculatePotential({commodity:"sugar",volumePerOperation:270,operationsPerYear:1},{volumeMinimum:500});
43 |   assert.equal(result.belowMinimum,true);
44 |   assert.equal(result.components.volume,0);
45 | });
46 | 
47 | test("AT4 — potencial anual direto prevalece e divergência acima de 10% alerta", () => {
48 |   const result=calculatePotential({commodity:"sugar",volumePerOperation:1500,operationsPerYear:6,annualPotentialDirect:8000});
49 |   assert.equal(result.annualPotentialUsed,8000);
50 |   assert.equal(result.annualPotentialDerived,9000);
51 |   assert.equal(result.annualDivergenceAlert,true);
52 | });
53 | 
54 | test("AT6 — não confirmado permanece no denominador", () => {
55 |   const result=calculateCompleteness([{key:"a",required:true,status:"confirmed"},{key:"b",required:true,status:"not_confirmed"}]);
56 |   assert.equal(result.applicableRequired,2);
57 |   assert.equal(result.score,50);
58 |   assert.deepEqual(result.missing,["b"]);
59 | });
60 | 
61 | test("AT8 — sanção apenas por nome sempre exige revisão", () => {
62 |   assert.deepEqual(evaluateSanctionMatch({nameMatch:true,reliableIdentifierMatch:false,countryCompatible:true}),{action:"review",reason:"name_only"});
63 | });
64 | 
65 | test("AT9 — identificador confiável e país compatível bloqueiam", () => {
66 |   assert.deepEqual(evaluateSanctionMatch({nameMatch:true,reliableIdentifierMatch:true,countryCompatible:true}),{action:"block",reason:"official_id_country"});
67 | });
68 | 
69 | test("AT12 — intermediário sem comprador final não passa no gate", () => {
70 |   const result=evaluateQualificationGate({hasBusinessEvidence:true,confidence:80,potentialMin:85,completeness:80,sanctionBlocked:false,sanctionReviewPending:false,riskCoverage:100,finalBuyerConfirmed:false,decisionMakerConfirmed:true,belowMinimum:false,riskScore:20},{confidenceMin:50,potentialMin:40,completenessMin:60,riskCoverageMin:50});
71 |   assert.ok(result.pending.includes("final_buyer"));
72 | });
73 | 
74 | test("AT13 — Coverage 40% impede qualificação sem dispensa", () => {
75 |   const result=evaluateQualificationGate({hasBusinessEvidence:true,confidence:80,potentialMin:85,completeness:80,sanctionBlocked:false,sanctionReviewPending:false,riskCoverage:40,riskCoverageWaiverApproved:false,finalBuyerConfirmed:true,decisionMakerConfirmed:true,belowMinimum:false,riskScore:20},{confidenceMin:50,potentialMin:40,completenessMin:60,riskCoverageMin:50});
76 |   assert.ok(result.pending.includes("risk_coverage"));
77 | });
78 | 
79 | test("AT14 — RBAC respeita os quatro perfis", () => {
80 |   assert.equal(canPerform("admin","manage_parameters"),true);
81 |   assert.equal(canPerform("commercial_manager","approve_exception"),true);
82 |   assert.equal(canPerform("seller_analyst","edit_operational"),true);
83 |   assert.equal(canPerform("seller_analyst","manage_parameters"),false);
84 |   assert.equal(canPerform("auditor_viewer","edit_operational"),false);
85 | });
```


## Scripts de build e validação

<a id="arquivo-13"></a>
### 13. `scripts/build-site.mjs`

18 linhas · SHA-256 `ff24165de970d6eed6f8833efaed8578abc3c8b6cebe0ce9c257adad2497b2d6`

```javascript
 1 | import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
 2 | import { resolve } from "node:path";
 3 | 
 4 | const root = resolve(import.meta.dirname, "..");
 5 | const dist = resolve(root, "dist");
 6 | await rm(dist, { recursive: true, force: true });
 7 | await mkdir(resolve(dist, "server"), { recursive: true });
 8 | await mkdir(resolve(dist, ".openai"), { recursive: true });
 9 | await mkdir(resolve(dist, "drizzle"), { recursive: true });
10 | 
11 | const html = await readFile(resolve(root, "public/index.html"), "utf8");
12 | await writeFile(resolve(dist, "index.html"), html);
13 | await writeFile(resolve(dist, "server/page.js"), `export const PAGE_HTML = ${JSON.stringify(html)};\n`);
14 | await cp(resolve(root, "src/worker.js"), resolve(dist, "server/index.js"));
15 | await cp(resolve(root, "src/scoring.js"), resolve(dist, "server/scoring.js"));
16 | await cp(resolve(root, ".openai/hosting.json"), resolve(dist, ".openai/hosting.json"));
17 | await cp(resolve(root, "migrations/0001_initial.sql"), resolve(dist, "drizzle/0000_initial.sql"));
18 | console.log(`Built ${dist}`);
```

<a id="arquivo-14"></a>
### 14. `scripts/validate-site.mjs`

16 linhas · SHA-256 `7359ed4f84512b267d106cee2c9c6589942c19f22dd9a366275299a5b0826af3`

```javascript
 1 | import { access, readFile } from "node:fs/promises";
 2 | import { resolve } from "node:path";
 3 | 
 4 | const root = resolve(import.meta.dirname, "..", "dist");
 5 | for (const relative of ["index.html","server/index.js","server/scoring.js","server/page.js",".openai/hosting.json","drizzle/0000_initial.sql"]) {
 6 |   await access(resolve(root, relative));
 7 | }
 8 | const worker = await import(`${resolve(root, "server/index.js")}?v=${Date.now()}`);
 9 | if (typeof worker.default?.fetch !== "function") throw new Error("Worker sem fetch exportado");
10 | const manifest = JSON.parse(await readFile(resolve(root, ".openai/hosting.json"), "utf8"));
11 | if (manifest.d1 !== "DB" || manifest.r2 !== "FILES") throw new Error("Bindings lógicos inválidos");
12 | const page = await readFile(resolve(root, "server/page.js"), "utf8");
13 | for (const marker of ["metricProspects", "flowQualifying", "exportPipelineButton", "/api/dashboard"]) {
14 |   if (!page.includes(marker)) throw new Error(`Contrato visual ausente: ${marker}`);
15 | }
16 | console.log("Site artifact valid");
```


## Interface

<a id="arquivo-15"></a>
### 15. `public/index.html`

563 linhas · SHA-256 `9c4007c4149e02f6ca757c29e8976781e7c8e5093320935739cdc2e55af15b6e`

```html
  1 | <!doctype html>
  2 | <html lang="pt-BR">
  3 | <head>
  4 |   <meta charset="utf-8">
  5 |   <meta name="viewport" content="width=device-width, initial-scale=1">
  6 |   <meta name="theme-color" content="#07111f">
  7 |   <meta name="description" content="Central operacional de prospecção e qualificação da EAG Compass.">
  8 |   <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2307111f'/%3E%3Cpath d='M32 10 46 48 32 42 18 48Z' fill='%232dd4bf'/%3E%3Ccircle cx='32' cy='31' r='5' fill='%23f8fafc'/%3E%3C/svg%3E">
  9 |   <title>EAG Compass — Central de Prospecção</title>
 10 |   <style>
 11 |     :root {
 12 |       color-scheme: dark;
 13 |       --bg: #07111f;
 14 |       --bg-2: #0a1626;
 15 |       --panel: rgba(15, 29, 48, .82);
 16 |       --panel-2: #11233a;
 17 |       --line: rgba(148, 163, 184, .16);
 18 |       --line-strong: rgba(148, 163, 184, .28);
 19 |       --text: #edf5ff;
 20 |       --muted: #91a4ba;
 21 |       --cyan: #38bdf8;
 22 |       --teal: #2dd4bf;
 23 |       --green: #4ade80;
 24 |       --amber: #fbbf24;
 25 |       --red: #fb7185;
 26 |       --purple: #a78bfa;
 27 |       --shadow: 0 22px 65px rgba(0, 0, 0, .28);
 28 |       --radius: 18px;
 29 |     }
 30 | 
 31 |     * { box-sizing: border-box; }
 32 |     html { scroll-behavior: smooth; }
 33 |     body {
 34 |       margin: 0;
 35 |       min-width: 320px;
 36 |       background:
 37 |         radial-gradient(circle at 80% -10%, rgba(56, 189, 248, .13), transparent 28rem),
 38 |         radial-gradient(circle at 18% 105%, rgba(45, 212, 191, .09), transparent 32rem),
 39 |         var(--bg);
 40 |       color: var(--text);
 41 |       font: 16px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
 42 |     }
 43 |     button, input, select, textarea { font: inherit; }
 44 |     button { color: inherit; }
 45 |     a { color: inherit; }
 46 |     .app { min-height: 100vh; }
 47 |     .sidebar {
 48 |       position: fixed;
 49 |       inset: 0 auto 0 0;
 50 |       width: 250px;
 51 |       padding: 24px 18px;
 52 |       border-right: 1px solid var(--line);
 53 |       background: rgba(7, 17, 31, .94);
 54 |       backdrop-filter: blur(22px);
 55 |       z-index: 20;
 56 |       display: flex;
 57 |       flex-direction: column;
 58 |     }
 59 |     .brand { display: flex; align-items: center; gap: 12px; margin: 0 8px 28px; }
 60 |     .brand-mark {
 61 |       width: 42px; height: 42px; border: 1px solid rgba(45, 212, 191, .35); border-radius: 13px;
 62 |       display: grid; place-items: center; background: linear-gradient(145deg, rgba(45,212,191,.19), rgba(56,189,248,.08));
 63 |       box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
 64 |     }
 65 |     .brand-mark svg { width: 26px; }
 66 |     .brand strong { display: block; letter-spacing: -.02em; font-size: 16px; }
 67 |     .brand small { color: var(--muted); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
 68 |     .nav-label { padding: 0 10px; margin: 18px 0 8px; color: #657b92; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
 69 |     .nav { display: grid; gap: 5px; }
 70 |     .nav button {
 71 |       border: 0; background: transparent; width: 100%; display: flex; align-items: center; gap: 11px;
 72 |       padding: 11px 12px; color: var(--muted); border-radius: 11px; cursor: pointer; text-align: left;
 73 |     }
 74 |     .nav button:hover { background: rgba(148,163,184,.07); color: var(--text); }
 75 |     .nav button.active { color: white; background: linear-gradient(90deg, rgba(45,212,191,.16), rgba(56,189,248,.07)); box-shadow: inset 2px 0 var(--teal); }
 76 |     .nav svg { width: 18px; height: 18px; opacity: .9; }
 77 |     .sidebar-foot { margin-top: auto; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: rgba(15,29,48,.58); }
 78 |     .sidebar-foot .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 12px var(--amber); margin-right: 8px; }
 79 |     .sidebar-foot strong { font-size: 12px; }
 80 |     .sidebar-foot p { color: var(--muted); font-size: 12px; margin: 7px 0 0; }
 81 |     main { margin-left: 250px; min-height: 100vh; }
 82 |     .topbar {
 83 |       height: 76px; padding: 0 30px; display: flex; align-items: center; justify-content: space-between; gap: 20px;
 84 |       position: sticky; top: 0; z-index: 15; background: rgba(7,17,31,.78); backdrop-filter: blur(20px); border-bottom: 1px solid var(--line);
 85 |     }
 86 |     .topbar-title h1 { font-size: 19px; line-height: 1.2; margin: 0; letter-spacing: -.02em; }
 87 |     .topbar-title p { margin: 3px 0 0; color: var(--muted); font-size: 13px; }
 88 |     .top-actions { display: flex; align-items: center; gap: 10px; }
 89 |     .search { position: relative; }
 90 |     .search input { width: 280px; padding: 10px 14px 10px 37px; border-radius: 11px; border: 1px solid var(--line); background: rgba(15,29,48,.74); color: var(--text); outline: none; }
 91 |     .search input:focus { border-color: rgba(56,189,248,.6); box-shadow: 0 0 0 3px rgba(56,189,248,.1); }
 92 |     .search svg { position: absolute; left: 12px; top: 11px; width: 17px; color: var(--muted); }
 93 |     .status-pill, .badge { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--line); border-radius: 999px; padding: 7px 11px; font-size: 13px; white-space: nowrap; }
 94 |     .status-pill .pulse { width: 7px; height: 7px; background: var(--teal); border-radius: 50%; box-shadow: 0 0 0 5px rgba(45,212,191,.09); }
 95 |     .content { padding: 28px 30px 64px; max-width: 1680px; margin: 0 auto; }
 96 |     .view { display: none; animation: enter .25s ease both; }
 97 |     .view.active { display: block; }
 98 |     @keyframes enter { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
 99 |     .section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; margin-bottom: 20px; }
100 |     .eyebrow { color: var(--teal); text-transform: uppercase; letter-spacing: .12em; font-weight: 800; font-size: 11px; }
101 |     .section-head h2 { font-size: clamp(24px, 3vw, 34px); line-height: 1.15; margin: 5px 0 0; letter-spacing: -.035em; }
102 |     .section-head p { max-width: 650px; margin: 7px 0 0; color: var(--muted); }
103 |     .btn { border: 1px solid var(--line-strong); background: rgba(15,29,48,.8); padding: 9px 13px; border-radius: 10px; cursor: pointer; }
104 |     .btn:hover { border-color: rgba(56,189,248,.55); background: rgba(22,42,65,.9); }
105 |     .btn.primary { border-color: rgba(45,212,191,.42); background: var(--teal); color: #05201e; font-weight: 750; }
106 |     .btn:disabled { opacity: .45; cursor: not-allowed; }
107 |     .grid { display: grid; gap: 16px; }
108 |     .grid-4 { grid-template-columns: repeat(4, minmax(0,1fr)); }
109 |     .grid-3 { grid-template-columns: repeat(3, minmax(0,1fr)); }
110 |     .grid-2 { grid-template-columns: repeat(2, minmax(0,1fr)); }
111 |     .card { border: 1px solid var(--line); border-radius: var(--radius); background: linear-gradient(145deg, rgba(17,35,58,.84), rgba(11,25,42,.78)); box-shadow: var(--shadow); }
112 |     .card.pad { padding: 20px; }
113 |     .metric { padding: 18px; min-height: 132px; position: relative; overflow: hidden; }
114 |     .metric:after { content:""; width: 95px; height: 95px; border-radius: 50%; position: absolute; right: -30px; bottom: -42px; background: radial-gradient(circle, var(--accent, rgba(56,189,248,.25)), transparent 67%); }
115 |     .metric-top { display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 13px; }
116 |     .metric-icon { width: 31px; height: 31px; display:grid; place-items:center; border:1px solid var(--line); border-radius: 9px; color: var(--accent-color,var(--cyan)); background: rgba(255,255,255,.025); }
117 |     .metric strong { display: block; font-size: 30px; line-height: 1; margin: 18px 0 7px; letter-spacing: -.04em; }
118 |     .metric small { color: var(--muted); }
119 |     .hero-grid { grid-template-columns: minmax(0, 1.55fr) minmax(310px, .75fr); margin-top: 16px; }
120 |     .panel-head { padding: 18px 20px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); }
121 |     .panel-head h3 { margin: 0; font-size: 15px; }
122 |     .panel-head span { color: var(--muted); font-size: 12px; }
123 |     .pipeline-flow { padding: 22px 18px 23px; display: grid; grid-template-columns: repeat(5,minmax(100px,1fr)); gap: 8px; align-items: center; }
124 |     .flow-stage { position: relative; padding: 14px 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(7,17,31,.46); min-height: 95px; }
125 |     .flow-stage:not(:last-child):after { content:""; position:absolute; top:50%; right:-9px; width:9px; border-top:1px solid rgba(56,189,248,.45); }
126 |     .flow-stage b { display:block; font-size: 20px; color: var(--stage,var(--cyan)); }
127 |     .flow-stage span { display:block; font-size: 12px; margin-top:3px; }
128 |     .flow-stage small { color: var(--muted); font-size:12px; }
129 |     .deadline { padding: 20px; }
130 |     .deadline-date { display: flex; align-items: baseline; gap: 8px; margin: 10px 0 4px; }
131 |     .deadline-date strong { font-size: 42px; letter-spacing: -.05em; color: var(--amber); }
132 |     .deadline-date span { color: var(--muted); }
133 |     .progress { height: 7px; background: rgba(148,163,184,.12); border-radius: 99px; overflow:hidden; margin: 17px 0 8px; }
134 |     .progress i { display:block; height:100%; background:linear-gradient(90deg,var(--teal),var(--cyan)); border-radius:99px; }
135 |     .task-list { display:grid; gap:10px; margin-top:14px; }
136 |     .task { padding:12px; border:1px solid var(--line); border-radius:11px; display:flex; gap:10px; align-items:flex-start; background:rgba(7,17,31,.35); }
137 |     .task .state { width:8px; height:8px; margin-top:6px; border-radius:50%; background:var(--amber); flex:0 0 auto; }
138 |     .task strong { display:block; font-size:12px; }
139 |     .task span { color:var(--muted); font-size:11px; }
140 |     .filters { display:flex; flex-wrap:wrap; gap:9px; margin-bottom:16px; }
141 |     .filters select, .filters input { border:1px solid var(--line); color:var(--text); background:rgba(15,29,48,.76); border-radius:10px; padding:9px 12px; outline:none; }
142 |     .filters input { min-width:240px; }
143 |     .table-wrap { overflow:auto; }
144 |     table { width:100%; border-collapse:collapse; min-width:980px; }
145 |     th { color:#7f94aa; text-transform:uppercase; letter-spacing:.08em; font-size:12px; text-align:left; padding:12px 16px; border-bottom:1px solid var(--line); }
146 |     td { padding:14px 16px; border-bottom:1px solid rgba(148,163,184,.1); vertical-align:middle; }
147 |     tbody tr { cursor:pointer; transition:.15s ease; }
148 |     tbody tr:hover { background:rgba(56,189,248,.045); }
149 |     .company { display:flex; align-items:center; gap:11px; }
150 |     .avatar { width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(56,189,248,.17),rgba(167,139,250,.12));border:1px solid var(--line);font-weight:800;font-size:11px;color:#c8eaff; }
151 |     .company strong { display:block;font-size:13px; }
152 |     .company small { color:var(--muted); }
153 |     .badge { padding:5px 9px; font-size:12px; border-color:transparent; }
154 |     .badge.blue { color:#9bddfa;background:rgba(56,189,248,.12); }
155 |     .badge.green { color:#9ef0b6;background:rgba(74,222,128,.11); }
156 |     .badge.amber { color:#fbd97b;background:rgba(251,191,36,.11); }
157 |     .badge.red { color:#fda4b3;background:rgba(251,113,133,.12); }
158 |     .badge.purple { color:#c8b8ff;background:rgba(167,139,250,.13); }
159 |     .muted { color:var(--muted); }
160 |     .score-mini { display:flex; gap:5px; }
161 |     .score-mini span { min-width:34px; padding:4px 6px; border-radius:7px; background:rgba(148,163,184,.08); color:var(--muted); font-size:10px; text-align:center; }
162 |     .empty { text-align:center;padding:42px;color:var(--muted);display:none; }
163 |     .split { display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,.55fr);gap:16px; }
164 |     .field-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:20px; }
165 |     .field { border:1px solid var(--line);border-radius:11px;padding:12px;background:rgba(7,17,31,.32); }
166 |     .field label { display:block;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px; }
167 |     .field strong { font-size:13px; }
168 |     .field.wide { grid-column:1/-1; }
169 |     .score-card { padding:18px; }
170 |     .score-row { display:grid;grid-template-columns:100px 1fr 72px;align-items:center;gap:10px;margin:15px 0; }
171 |     .score-row label { font-size:12px; }
172 |     .score-row .bar { height:7px;border-radius:99px;background:rgba(148,163,184,.1);overflow:hidden; }
173 |     .score-row .bar i { display:block;height:100%;border-radius:99px;background:var(--bar,var(--cyan)); }
174 |     .score-row b { text-align:right;font-size:11px;color:var(--muted); }
175 |     .notice { border:1px solid rgba(251,191,36,.22);background:rgba(251,191,36,.06);padding:13px 14px;border-radius:11px;color:#e9d18d;font-size:12px; }
176 |     .source-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
177 |     .source { padding:18px; position:relative; overflow:hidden; }
178 |     .source-top { display:flex;justify-content:space-between;gap:10px;align-items:start; }
179 |     .source h3 { margin:0;font-size:15px; }
180 |     .source p { color:var(--muted);font-size:13px;min-height:58px; }
181 |     .source dl { margin:16px 0 0;display:grid;grid-template-columns:95px 1fr;gap:7px;font-size:11px; }
182 |     .source dt { color:var(--muted); }
183 |     .source dd { margin:0; }
184 |     .rules { margin-top:16px; }
185 |     .rule { display:grid;grid-template-columns:35px 1fr auto;gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line); }
186 |     .rule-num { width:29px;height:29px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;color:var(--teal);font-weight:800;font-size:11px; }
187 |     .rule strong { display:block;font-size:12px; }
188 |     .rule span { color:var(--muted);font-size:11px; }
189 |     .arch { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:20px; }
190 |     .arch-node { padding:16px;border:1px solid var(--line);border-radius:13px;background:rgba(7,17,31,.38); }
191 |     .arch-node small { color:var(--teal);text-transform:uppercase;letter-spacing:.1em;font-weight:800; }
192 |     .arch-node h3 { margin:7px 0;font-size:15px; }
193 |     .arch-node p { color:var(--muted);font-size:12px;margin:0; }
194 |     .email-layout { display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px; }
195 |     .email-list { padding:8px; }
196 |     .email-item { width:100%;border:0;background:transparent;color:inherit;text-align:left;border-radius:12px;padding:13px;cursor:pointer;border-bottom:1px solid var(--line); }
197 |     .email-item:hover,.email-item.active { background:rgba(56,189,248,.07); }
198 |     .email-item strong { display:block;font-size:12px; }
199 |     .email-item span { color:var(--muted);font-size:10px; }
200 |     .email-editor { padding:20px; }
201 |     .email-meta { display:grid;grid-template-columns:95px 1fr;gap:8px 12px;font-size:12px;padding-bottom:16px;border-bottom:1px solid var(--line); }
202 |     .email-meta span:nth-child(odd) { color:var(--muted); }
203 |     .email-body { white-space:pre-wrap;font-family:inherit;color:#cbd8e8;background:rgba(7,17,31,.42);border:1px solid var(--line);border-radius:12px;padding:18px;margin:16px 0;max-height:390px;overflow:auto;font-size:13px; }
204 |     .email-actions { display:flex;gap:9px;align-items:center;flex-wrap:wrap; }
205 |     .local-note { color:var(--muted);font-size:11px;margin-left:auto; }
206 |     .timeline { padding:12px 20px 22px; }
207 |     .phase { display:grid;grid-template-columns:56px 1fr auto;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line); }
208 |     .phase-num { width:38px;height:38px;border-radius:11px;display:grid;place-items:center;border:1px solid var(--line);font-weight:800;color:var(--muted); }
209 |     .phase.done .phase-num { color:var(--green);border-color:rgba(74,222,128,.3);background:rgba(74,222,128,.07); }
210 |     .phase.active .phase-num { color:var(--amber);border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.07);box-shadow:0 0 22px rgba(251,191,36,.08); }
211 |     .phase strong { display:block;font-size:13px; }
212 |     .phase span { color:var(--muted);font-size:11px; }
213 |     .checklist { display:grid;gap:9px;padding:18px; }
214 |     .check { display:flex;gap:10px;align-items:flex-start;padding:11px;border-radius:10px;background:rgba(7,17,31,.28); }
215 |     .check i { width:17px;height:17px;border:1px solid var(--line-strong);border-radius:5px;flex:0 0 auto;margin-top:2px; }
216 |     .check.done i { background:var(--green);border-color:var(--green);box-shadow:inset 0 0 0 4px #17362a; }
217 |     .check strong { display:block;font-size:12px; }
218 |     .check span { color:var(--muted);font-size:10px; }
219 |     .drawer-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:40;opacity:0;pointer-events:none;transition:.2s ease; }
220 |     .drawer { position:fixed;z-index:41;top:0;right:0;height:100vh;width:min(540px,100%);background:#0a1727;border-left:1px solid var(--line-strong);box-shadow:-30px 0 80px rgba(0,0,0,.42);transform:translateX(103%);transition:.25s ease;overflow:auto; }
221 |     .drawer.open { transform:none; }
222 |     .drawer-backdrop.open { opacity:1;pointer-events:auto; }
223 |     .drawer-head { position:sticky;top:0;background:rgba(10,23,39,.94);backdrop-filter:blur(18px);display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid var(--line);z-index:2; }
224 |     .drawer-head h3 { margin:0;font-size:16px; }
225 |     .close { border:1px solid var(--line);background:transparent;width:34px;height:34px;border-radius:10px;cursor:pointer; }
226 |     .drawer-body { padding:20px; }
227 |     .drawer-body h4 { margin:24px 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted); }
228 |     .detail-list { display:grid;grid-template-columns:130px 1fr;gap:9px 14px;padding:14px;border:1px solid var(--line);border-radius:13px;background:rgba(7,17,31,.36);font-size:12px; }
229 |     .detail-list dt { color:var(--muted); }.detail-list dd { margin:0; }
230 |     .toast { position:fixed;right:22px;bottom:22px;background:#142942;border:1px solid var(--line-strong);box-shadow:var(--shadow);border-radius:12px;padding:12px 15px;z-index:60;transform:translateY(20px);opacity:0;pointer-events:none;transition:.2s ease;font-size:12px; }
231 |     .toast.show { transform:none;opacity:1; }
232 |     dialog { width:min(620px,calc(100% - 28px)); border:1px solid var(--line-strong); border-radius:18px; padding:0; color:var(--text); background:#0a1727; box-shadow:var(--shadow); }
233 |     dialog::backdrop { background:rgba(0,0,0,.66); backdrop-filter:blur(4px); }
234 |     .dialog-head { display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--line); }
235 |     .dialog-head h3 { margin:0;font-size:16px; }
236 |     .form-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;padding:20px; }
237 |     .form-control { display:grid;gap:6px; }
238 |     .form-control.wide { grid-column:1/-1; }
239 |     .form-control label { color:var(--muted);font-size:13px; }
240 |     .form-control input,.form-control select { width:100%;border:1px solid var(--line);background:rgba(7,17,31,.65);color:var(--text);border-radius:10px;padding:10px 11px;outline:none; }
241 |     .dialog-actions { display:flex;align-items:center;justify-content:flex-end;gap:9px;padding:15px 20px;border-top:1px solid var(--line); }
242 |     .mobile-nav { display:none; }
243 |     @media (max-width:1180px){
244 |       .grid-4{grid-template-columns:repeat(2,1fr)} .hero-grid,.split{grid-template-columns:1fr}.source-grid{grid-template-columns:repeat(2,1fr)}
245 |     }
246 |     @media (max-width:820px){
247 |       .sidebar{display:none}main{margin-left:0}.topbar{padding:0 16px}.search{display:none}.content{padding:20px 16px 90px}.mobile-nav{display:flex;position:fixed;z-index:30;bottom:0;left:0;right:0;background:rgba(7,17,31,.95);backdrop-filter:blur(18px);border-top:1px solid var(--line);padding:8px;overflow:auto}.mobile-nav button{border:0;background:transparent;color:var(--muted);padding:9px 12px;font-size:10px;min-width:max-content}.mobile-nav button.active{color:var(--teal)}.pipeline-flow{grid-template-columns:1fr}.flow-stage:not(:last-child):after{display:none}.source-grid,.grid-3,.arch{grid-template-columns:1fr}.email-layout{grid-template-columns:1fr}.email-list{display:flex;overflow:auto}.email-item{min-width:220px}.field-grid{grid-template-columns:1fr}.field.wide{grid-column:auto}.section-head{align-items:flex-start;flex-direction:column}.local-note{margin-left:0;width:100%}
248 |     }
249 |     @media (max-width:540px){.grid-4,.grid-2{grid-template-columns:1fr}.status-pill{display:none}.metric{min-height:115px}.topbar-title p{display:none}.phase{grid-template-columns:48px 1fr}.phase .badge{display:none}}
250 |   </style>
251 | </head>
252 | <body>
253 |   <div class="app">
254 |     <aside class="sidebar">
255 |       <div class="brand">
256 |         <div class="brand-mark"><svg viewBox="0 0 64 64" fill="none"><path d="M32 8 48 50 32 43 16 50 32 8Z" fill="#2dd4bf"/><circle cx="32" cy="31" r="6" fill="#07111f" stroke="#eaf8ff" stroke-width="3"/></svg></div>
257 |         <div><strong>EAG Compass</strong><small>Buyer Intelligence</small></div>
258 |       </div>
259 |       <div class="nav-label">Operação</div>
260 |       <nav class="nav" id="nav">
261 |         <button class="active" data-view="overview"><span>◫</span> Visão geral</button>
262 |         <button data-view="pipeline"><span>⌁</span> Pipeline</button>
263 |         <button data-view="qualification"><span>✓</span> Qualificação</button>
264 |         <button data-view="compliance"><span>◇</span> Compliance</button>
265 |         <button data-view="data"><span>⌘</span> Dados & arquitetura</button>
266 |         <button data-view="emails"><span>✉</span> Central de e-mails</button>
267 |         <div class="nav-label">Gestão</div>
268 |         <button data-view="planning"><span>◷</span> Planejamento</button>
269 |       </nav>
270 |       <div class="sidebar-foot"><strong><span class="dot"></span>Fase 4 em execução</strong><p>Pesquisa técnica e validação de fontes. Checkpoint: 05/10/2026.</p></div>
271 |     </aside>
272 | 
273 |     <main>
274 |       <header class="topbar">
275 |         <div class="topbar-title"><h1 id="pageTitle">Visão geral</h1><p>Operação interna EAG · MVP mono-tenant</p></div>
276 |         <div class="top-actions">
277 |           <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="globalSearch" placeholder="Buscar empresa, país ou produto"></div>
278 |           <div class="status-pill"><span class="pulse"></span> Protótipo operacional</div>
279 |         </div>
280 |       </header>
281 | 
282 |       <div class="content">
283 |         <section class="view active" id="overview">
284 |           <div class="section-head"><div><div class="eyebrow">Comando da operação</div><h2>O que está acontecendo agora</h2><p>Uma leitura única do funil comercial, dos bloqueios técnicos e das próximas decisões do EAG Compass.</p></div><button class="btn" data-go="pipeline">Abrir pipeline →</button></div>
285 |           <div class="grid grid-4">
286 |             <article class="card metric" style="--accent-color:var(--cyan);--accent:rgba(56,189,248,.28)"><div class="metric-top"><span>Prospects mapeados</span><span class="metric-icon">⌁</span></div><strong id="metricProspects">7</strong><small>Açúcar e café · base atual</small></article>
287 |             <article class="card metric" style="--accent-color:var(--teal);--accent:rgba(45,212,191,.28)"><div class="metric-top"><span>Em qualificação</span><span class="metric-icon">✓</span></div><strong id="metricQualifying">4</strong><small>Com dados comerciais pendentes</small></article>
288 |             <article class="card metric" style="--accent-color:var(--amber);--accent:rgba(251,191,36,.25)"><div class="metric-top"><span>Ações críticas</span><span class="metric-icon">!</span></div><strong id="metricCritical">3</strong><small>Bloqueios ou validações necessárias</small></article>
289 |             <article class="card metric" style="--accent-color:var(--purple);--accent:rgba(167,139,250,.25)"><div class="metric-top"><span>Fase atual</span><span class="metric-icon">04</span></div><strong>Dados</strong><small>Pesquisa técnica · em execução</small></article>
290 |           </div>
291 |           <div class="grid hero-grid">
292 |             <article class="card"><div class="panel-head"><div><h3>Funil de prospecção</h3><span>Estados definidos na Especificação v1.3</span></div><span id="pipelineTotal">7 empresas</span></div><div class="pipeline-flow">
293 |               <div class="flow-stage" style="--stage:var(--cyan)"><b id="flowDiscovered">1</b><span>Descoberto</span><small>Indício comercial</small></div>
294 |               <div class="flow-stage" style="--stage:var(--teal)"><b id="flowProspected">1</b><span>Prospectado</span><small>Evidência empresarial</small></div>
295 |               <div class="flow-stage" style="--stage:var(--purple)"><b id="flowContact">1</b><span>Em contato</span><small>Contato verificado</small></div>
296 |               <div class="flow-stage" style="--stage:var(--amber)"><b id="flowQualifying">4</b><span>Qualificação</span><small>Demanda em confirmação</small></div>
297 |               <div class="flow-stage" style="--stage:var(--green)"><b id="flowQualified">0</b><span>Qualificado</span><small>Gate completo</small></div>
298 |             </div></article>
299 |             <article class="card deadline"><div class="eyebrow">Checkpoint técnico</div><div class="deadline-date"><strong>05</strong><span>outubro · 2026</span></div><p class="muted">Decisão Go/No-Go para iniciar Design, baseada em fontes testadas, arquitetura e orçamento bottom-up.</p><div class="progress"><i style="width:38%"></i></div><small class="muted">Fase 4 · progresso documental estimado</small></article>
300 |           </div>
301 |           <div class="grid grid-2" style="margin-top:16px">
302 |             <article class="card"><div class="panel-head"><div><h3>Próximas ações</h3><span>Caminho crítico da Frente B</span></div><button class="btn" data-go="emails">Ver e-mails</button></div><div class="task-list" style="padding:5px 18px 20px">
303 |               <div class="task"><span class="state" style="background:var(--red)"></span><div><strong>Enviar RFQs para Moody’s Orbis e D&B</strong><span>Solicitar piloto de 60 dias, API/CSV, cobertura e direitos de uso.</span></div></div>
304 |               <div class="task"><span class="state"></span><div><strong>Validar download OFAC real</strong><span>Arquivo, checksum, importação e mudança de versão.</span></div></div>
305 |               <div class="task"><span class="state"></span><div><strong>Consolidar orçamento bottom-up</strong><span>Desenvolvimento, QA, infraestrutura, dados e suporte.</span></div></div>
306 |             </div></article>
307 |             <article class="card"><div class="panel-head"><div><h3>Decisões já protegidas</h3><span>Regras que evitam falsos positivos</span></div></div><div class="checklist">
308 |               <div class="check done"><i></i><div><strong>Comex Stat não prova compra de empresa</strong><span>É contexto agregado de país, produto e período.</span></div></div>
309 |               <div class="check done"><i></i><div><strong>Nome semelhante nunca bloqueia sozinho</strong><span>Match nominal sempre exige revisão humana.</span></div></div>
310 |               <div class="check done"><i></i><div><strong>Dados desconhecidos reduzem cobertura</strong><span>Não recebem risco zero nem penalidade inventada.</span></div></div>
311 |             </div></article>
312 |           </div>
313 |         </section>
314 | 
315 |         <section class="view" id="pipeline">
316 |           <div class="section-head"><div><div class="eyebrow">Pipeline comercial</div><h2>Prospects e oportunidades</h2><p>Clique em uma empresa para ver a demanda conhecida, as lacunas e o próximo passo recomendado.</p></div><div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap"><span class="badge blue" id="leadCountBadge">7 registros iniciais</span><button class="btn" id="exportPipelineButton">Exportar CSV</button><button class="btn primary" id="newProspectButton">+ Novo prospect</button></div></div>
317 |           <div class="filters"><input id="leadSearch" placeholder="Filtrar por empresa ou país"><select id="productFilter"><option value="all">Todos os produtos</option><option>Açúcar</option><option>Café</option></select><select id="statusFilter"><option value="all">Todos os estados</option><option>Descoberto</option><option>Prospectado</option><option>Em contato</option><option>Em qualificação</option><option>Bloqueado</option></select></div>
318 |           <article class="card table-wrap"><table><thead><tr><th>Empresa / mercado</th><th>Produto</th><th>Demanda conhecida</th><th>Estado</th><th>Decisão</th><th>Scores</th><th>Próximo passo</th></tr></thead><tbody id="leadRows"></tbody></table><div class="empty" id="leadEmpty">Nenhum prospect corresponde aos filtros.</div></article>
319 |         </section>
320 | 
321 |         <section class="view" id="qualification">
322 |           <div class="section-head"><div><div class="eyebrow">Qualificação EAG + SPIN</div><h2>Demanda comercial sem dados inventados</h2><p>Exemplo operacional selecionado: Bra Suisse. Campos desconhecidos permanecem explícitos e não reduzem automaticamente o score.</p></div><button class="btn" data-open="bra-suisse">Abrir ficha completa</button></div>
323 |           <div class="split">
324 |             <article class="card"><div class="panel-head"><div><h3>Bra Suisse · Suíça</h3><span>Canal aberto · demanda abaixo do mínimo padrão</span></div><span class="badge amber">Aprovação necessária</span></div><div class="field-grid">
325 |               <div class="field"><label>Produto</label><strong>Açúcar</strong></div><div class="field"><label>Especificação</label><strong>Não confirmada</strong></div>
326 |               <div class="field"><label>Volume por operação</label><strong>≈ 270 MT</strong></div><div class="field"><label>Volume mínimo EAG</label><strong>500 MT</strong></div>
327 |               <div class="field"><label>Embalagem</label><strong>Sacas de 50 kg</strong></div><div class="field"><label>Incoterm</label><strong>FOB</strong></div>
328 |               <div class="field"><label>Pagamento</label><strong>CAD at sight</strong></div><div class="field"><label>Porto / destino</label><strong>Não confirmado</strong></div>
329 |               <div class="field"><label>Data necessária</label><strong>Não confirmada</strong></div><div class="field"><label>Comprador final</label><strong>Não confirmado</strong></div>
330 |               <div class="field wide"><label>Pergunta consultiva recomendada</label><strong>“Além do volume inicial, existe previsão de compras recorrentes ou consolidação com outros pedidos?”</strong></div>
331 |             </div></article>
332 |             <div class="grid">
333 |               <article class="card score-card"><div class="panel-head" style="padding:0 0 13px"><div><h3>Scores independentes</h3><span>Sem cálculo enquanto faltam dados mínimos</span></div></div>
334 |                 <div class="score-row"><label>Potential</label><div class="bar"><i style="width:28%;--bar:var(--cyan)"></i></div><b>parcial</b></div>
335 |                 <div class="score-row"><label>Confidence</label><div class="bar"><i style="width:36%;--bar:var(--teal)"></i></div><b>parcial</b></div>
336 |                 <div class="score-row"><label>Risk</label><div class="bar"><i style="width:10%;--bar:var(--amber)"></i></div><b>não calc.</b></div>
337 |                 <div class="score-row"><label>Cobertura risco</label><div class="bar"><i style="width:18%;--bar:var(--purple)"></i></div><b>baixa</b></div>
338 |                 <div class="notice">As barras indicam apenas cobertura demonstrativa da ficha, não scores comerciais aprovados.</div>
339 |               </article>
340 |               <article class="card"><div class="panel-head"><div><h3>Gate de qualificação</h3><span>Itens obrigatórios</span></div></div><div class="checklist">
341 |                 <div class="check"><i></i><div><strong>Evidência empresarial nominal</strong><span>Pendente</span></div></div><div class="check"><i></i><div><strong>Decisor e comprador final</strong><span>Pendente</span></div></div><div class="check done"><i></i><div><strong>Demanda operacional iniciada</strong><span>Volume, embalagem, incoterm e pagamento conhecidos</span></div></div>
342 |               </div></article>
343 |             </div>
344 |           </div>
345 |         </section>
346 | 
347 |         <section class="view" id="compliance">
348 |           <div class="section-head"><div><div class="eyebrow">Compliance e risco</div><h2>Fontes, testes e regras de decisão</h2><p>O status abaixo separa documentação encontrada de integração realmente testada.</p></div><span class="badge amber">Validação parcial</span></div>
349 |           <div class="grid source-grid">
350 |             <article class="card source"><div class="source-top"><h3>OFAC SDN</h3><span class="badge amber">Parcial</span></div><p>Documentação oficial confirmada. Falta validar download real, checksum e importação completa.</p><dl><dt>Uso</dt><dd>Sanções internacionais</dd><dt>Integração</dt><dd>Download oficial + índice local</dd><dt>Cron</dt><dd>Diário, baixa apenas se hash mudar</dd></dl></article>
351 |             <article class="card source"><div class="source-top"><h3>CGU · CEIS/CNEP</h3><span class="badge amber">Token pendente</span></div><p>Listas de integridade administrativa brasileiras. Geram alertas, não bloqueio comercial automático.</p><dl><dt>Uso</dt><dd>Integridade Brasil</dd><dt>Integração</dt><dd>API oficial com token</dd><dt>Escopo</dt><dd>Empresas e sanções brasileiras</dd></dl></article>
352 |             <article class="card source"><div class="source-top"><h3>Comex Stat</h3><span class="badge blue">Teste pendente</span></div><p>Contexto agregado por país, produto, NCM e período. Nunca é evidência nominal de empresa.</p><dl><dt>Uso</dt><dd>Mercado-alvo</dd><dt>Integração</dt><dd>Adaptador controlado</dd><dt>Falta</dt><dd>Resposta real e limites</dd></dl></article>
353 |             <article class="card source"><div class="source-top"><h3>CNPJ Brasil</h3><span class="badge blue">Estratégia pendente</span></div><p>Cadastro para empresas brasileiras. Não resolve validação de importadores estrangeiros.</p><dl><dt>Uso</dt><dd>Situação cadastral</dd><dt>Integração</dt><dd>Dados abertos / lote</dd><dt>Falta</dt><dd>Contrato técnico e fallback</dd></dl></article>
354 |             <article class="card source"><div class="source-top"><h3>Moody’s Orbis</h3><span class="badge red">RFQ não enviado</span></div><p>Possível fonte paga de registro, crédito, UBO, PEP e risco empresarial internacional.</p><dl><dt>Uso</dt><dd>KYC e risco global</dd><dt>Gate</dt><dd>28/09/2026</dd><dt>MVP</dt><dd>Condicional a ROI</dd></dl></article>
355 |             <article class="card source"><div class="source-top"><h3>Dun & Bradstreet</h3><span class="badge red">RFQ não enviado</span></div><p>Alternativa paga para cadastro, crédito e risco. Precisa confirmar cobertura e direitos derivados.</p><dl><dt>Uso</dt><dd>Risco internacional</dd><dt>Gate</dt><dd>28/09/2026</dd><dt>MVP</dt><dd>Condicional a ROI</dd></dl></article>
356 |           </div>
357 |           <div class="grid grid-2 rules">
358 |             <article class="card pad"><div class="panel-head" style="padding:0 0 12px"><div><h3>Regra de matching</h3><span>Da identificação à decisão</span></div></div>
359 |               <div class="rule"><span class="rule-num">1</span><div><strong>ID confiável + país compatível</strong><span>Correspondência determinística com lista de bloqueio.</span></div><span class="badge red">Bloqueio</span></div>
360 |               <div class="rule"><span class="rule-num">2</span><div><strong>País bloqueado pela política EAG</strong><span>Política interna registrada e vigente.</span></div><span class="badge red">Bloqueio</span></div>
361 |               <div class="rule"><span class="rule-num">3</span><div><strong>Nome exato, parcial ou fuzzy</strong><span>Similaridade define prioridade, nunca decisão automática.</span></div><span class="badge amber">Revisão</span></div>
362 |             </article>
363 |             <article class="card pad"><div class="panel-head" style="padding:0 0 12px"><div><h3>Risk Score</h3><span>Risco e cobertura são separados</span></div></div><p class="muted">Componentes conhecidos são ponderados; componentes desconhecidos reduzem a cobertura. Sanção confirmada é um bloqueio jurídico separado do Risk Score.</p><div class="notice">Sem base paga, crédito e histórico financeiro de importadores estrangeiros permanecem pendentes; o resultado deve aparecer como “Risk provisório”.</div></article>
364 |           </div>
365 |         </section>
366 | 
367 |         <section class="view" id="data">
368 |           <div class="section-head"><div><div class="eyebrow">Frente A</div><h2>Dados e arquitetura técnica</h2><p>Uma arquitetura Cloudflare-first com três unidades lógicas e rastreabilidade desde a origem.</p></div><span class="badge blue">Decisões provisórias aprovadas</span></div>
369 |           <article class="card"><div class="panel-head"><div><h3>Unidades de execução</h3><span>Separação clara entre interação, processamento e sincronização</span></div></div><div class="arch">
370 |             <div class="arch-node"><small>Worker 01</small><h3>API</h3><p>CRUD de empresas, contatos, formulários, scores, RBAC e exportação.</p></div>
371 |             <div class="arch-node"><small>Worker 02</small><h3>Async</h3><p>Importações, matching, recálculo, relatórios e tarefas por Queues.</p></div>
372 |             <div class="arch-node"><small>Worker 03</small><h3>Cron</h3><p>Sincronização de listas, hashes, versões e verificações programadas.</p></div>
373 |           </div></article>
374 |           <div class="grid grid-3" style="margin-top:16px">
375 |             <article class="card pad"><div class="eyebrow">D1</div><h3>Dados relacionais</h3><p class="muted">Empresas, evidências, contatos, formulário EAG, scores, sanções, decisões e auditoria append-only.</p></article>
376 |             <article class="card pad"><div class="eyebrow">R2 + KV</div><h3>Arquivos e cache</h3><p class="muted">Datasets versionados, relatórios exportados, hashes e respostas temporárias sem PII em claro.</p></article>
377 |             <article class="card pad"><div class="eyebrow">Queues</div><h3>Processos resilientes</h3><p class="muted">Importação de fontes, matching, recálculo e retentativas sem bloquear a experiência do vendedor.</p></article>
378 |           </div>
379 |           <div class="grid grid-2" style="margin-top:16px">
380 |             <article class="card"><div class="panel-head"><div><h3>Modelo operacional</h3><span>MVP e preparação futura</span></div></div><div class="checklist"><div class="check done"><i></i><div><strong>MVP mono-tenant EAG</strong><span>Ambiente interno e piloto controlado.</span></div></div><div class="check done"><i></i><div><strong>tenant_id desde o início</strong><span>Preparação estrutural; multi-tenant não ativado no MVP.</span></div></div><div class="check"><i></i><div><strong>Retenção LGPD</strong><span>Prazo depende de validação jurídica/DPO.</span></div></div></div></article>
381 |             <article class="card"><div class="panel-head"><div><h3>Contratos de dados pendentes</h3><span>Bloqueiam a arquitetura final dos adaptadores</span></div></div><div class="checklist"><div class="check"><i></i><div><strong>Comex Stat</strong><span>Campos reais, resposta, limites e atualização.</span></div></div><div class="check"><i></i><div><strong>OFAC e CGU</strong><span>Download/token, versionamento e ingestão testada.</span></div></div><div class="check"><i></i><div><strong>Orbis / D&B</strong><span>Preço, licença, API, retenção e scores derivados.</span></div></div></div></article>
382 |           </div>
383 |         </section>
384 | 
385 |         <section class="view" id="emails">
386 |           <div class="section-head"><div><div class="eyebrow">Preparação de contato</div><h2>Central de e-mails</h2><p>Rascunhos prontos para revisão. O envio real será integrado depois da aprovação do fluxo.</p></div><span class="badge amber">Envio desativado</span></div>
387 |           <div class="email-layout">
388 |             <article class="card email-list" id="emailList"></article>
389 |             <article class="card email-editor"><div class="email-meta"><span>Destinatário</span><strong id="emailTo"></strong><span>Assunto</span><strong id="emailSubject"></strong><span>Prazo pedido</span><strong>28/09/2026</strong><span>Status</span><strong id="emailStatus" class="muted">Rascunho não enviado</strong></div><div class="email-body" id="emailBody"></div><div class="email-actions"><button class="btn primary" id="copyEmail">Copiar texto</button><button class="btn" id="markSent">Marcar como enviado</button><button class="btn" disabled>Enviar e-mail</button><span class="local-note">A marcação é salva somente neste navegador.</span></div></article>
390 |           </div>
391 |           <div class="grid grid-3" style="margin-top:16px"><article class="card pad"><div class="eyebrow">21/09</div><h3>Envio inicial</h3><p class="muted">RFQ com escopo de piloto, cobertura, API, licença e prazo.</p></article><article class="card pad"><div class="eyebrow">24/09</div><h3>1º follow-up</h3><p class="muted">Confirmar recebimento e disponibilidade de proposta até o gate.</p></article><article class="card pad"><div class="eyebrow">28/09</div><h3>Gate comercial</h3><p class="muted">Cotação recebida ou cenário MVP sem base paga formalizado.</p></article></div>
392 |         </section>
393 | 
394 |         <section class="view" id="planning">
395 |           <div class="section-head"><div><div class="eyebrow">Governança do produto</div><h2>Planejamento e critérios de avanço</h2><p>Histórico das fases, entregas aprovadas e evidências necessárias para o próximo Go/No-Go.</p></div><span class="badge green">Fases 1–3 fechadas</span></div>
396 |           <div class="split">
397 |             <article class="card"><div class="panel-head"><div><h3>Fases do produto</h3><span>Fase 4 em andamento</span></div></div><div class="timeline">
398 |               <div class="phase done"><span class="phase-num">01</span><div><strong>Brainstorm</strong><span>Problema, público, escopo e hipótese.</span></div><span class="badge green">Fechada</span></div>
399 |               <div class="phase done"><span class="phase-num">02</span><div><strong>Discovery</strong><span>Benchmark preliminar e diferenciação como hipótese.</span></div><span class="badge green">Fechada</span></div>
400 |               <div class="phase done"><span class="phase-num">03</span><div><strong>Especificação</strong><span>Constituição v1.3 e Spec v1.3 aprovadas.</span></div><span class="badge green">Fechada</span></div>
401 |               <div class="phase active"><span class="phase-num">04</span><div><strong>Pesquisa técnica</strong><span>Fontes, arquitetura, cotações e orçamento bottom-up.</span></div><span class="badge amber">Ativa</span></div>
402 |               <div class="phase"><span class="phase-num">05</span><div><strong>Design</strong><span>Fluxos UX/UI e design system.</span></div><span class="badge blue">Próxima</span></div>
403 |               <div class="phase"><span class="phase-num">06</span><div><strong>Plano detalhado</strong><span>Roadmap e implementação.</span></div></div><div class="phase"><span class="phase-num">07</span><div><strong>Auditoria</strong><span>Red-team e verificação cruzada.</span></div></div><div class="phase"><span class="phase-num">08</span><div><strong>Correção</strong><span>Aplicação dos achados.</span></div></div><div class="phase"><span class="phase-num">09</span><div><strong>Montagem</strong><span>Plano final e aceite.</span></div></div>
404 |             </div></article>
405 |             <div class="grid">
406 |               <article class="card"><div class="panel-head"><div><h3>Gate de 05/10</h3><span>Artefatos concretos</span></div></div><div class="checklist"><div class="check"><i></i><div><strong>Schema D1 revisado e testado</strong></div></div><div class="check"><i></i><div><strong>3 Workers especificados</strong></div></div><div class="check"><i></i><div><strong>Fontes testadas — inclusive falhas</strong></div></div><div class="check"><i></i><div><strong>Cotação ou pendência formal</strong></div></div><div class="check"><i></i><div><strong>Orçamento bottom-up</strong></div></div><div class="check"><i></i><div><strong>Recomendação Go/No-Go</strong></div></div></div></article>
407 |               <article class="card pad"><div class="eyebrow">Regra de controle</div><h3>Sem hipóteses ocultas</h3><p class="muted">Cada limitação de fonte, custo ou cobertura precisa aparecer na decisão. Falta de API ou resposta comercial também é um resultado documentado.</p></article>
408 |             </div>
409 |           </div>
410 |         </section>
411 |       </div>
412 |     </main>
413 |   </div>
414 | 
415 |   <nav class="mobile-nav" id="mobileNav"><button class="active" data-view="overview">Visão geral</button><button data-view="pipeline">Pipeline</button><button data-view="qualification">Qualificação</button><button data-view="compliance">Compliance</button><button data-view="data">Dados</button><button data-view="emails">E-mails</button><button data-view="planning">Plano</button></nav>
416 |   <div class="drawer-backdrop" id="drawerBackdrop"></div><aside class="drawer" id="drawer"><div class="drawer-head"><h3 id="drawerTitle">Empresa</h3><button class="close" id="closeDrawer">×</button></div><div class="drawer-body" id="drawerBody"></div></aside>
417 |   <dialog id="prospectDialog"><form id="prospectForm"><div class="dialog-head"><div><h3>Novo prospect</h3><span class="muted">Entra como Descoberto com um indício rastreável</span></div><button class="close" type="button" id="closeProspectDialog">×</button></div><div class="form-grid"><div class="form-control wide"><label>Razão social / nome da empresa *</label><input name="legalName" required></div><div class="form-control"><label>País (ISO 2 letras) *</label><input name="countryCode" required maxlength="2" placeholder="BR"></div><div class="form-control"><label>Tipo de comprador</label><select name="buyerType"><option value="unconfirmed">Não confirmado</option><option value="final_buyer">Comprador final</option><option value="intermediary">Intermediário</option></select></div><div class="form-control wide"><label>Fonte do indício *</label><input name="sourceLabel" required placeholder="Ex.: indicação comercial, website, LinkedIn"></div><div class="form-control wide"><label>URL da fonte</label><input name="sourceUrl" type="url" placeholder="https://"></div></div><div class="dialog-actions"><button type="button" class="btn" id="cancelProspect">Cancelar</button><button class="btn primary" type="submit">Salvar prospect</button></div></form></dialog>
418 |   <dialog id="operationDialog"><form id="operationForm"><div class="dialog-head"><div><h3 id="operationTitle">Atualizar ficha</h3><span class="muted" id="operationSubtitle">Dados rastreáveis e confirmados</span></div><button class="close" type="button" id="closeOperationDialog">×</button></div><div class="form-grid" id="operationFields"></div><div class="dialog-actions"><button type="button" class="btn" id="cancelOperation">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div></form></dialog>
419 |   <div class="toast" id="toast">Concluído</div>
420 | 
421 |   <script>
422 |     let leads = [
423 |       {id:'tanzania',company:'Prospect Tanzânia',country:'Tanzânia',place:'Dar es Salaam',product:'Açúcar',demand:'500 MT · ICUMSA 45 · CIF',status:'Em qualificação',decision:'Possível',decisionTone:'green',next:'Confirmar comprador final e LOI',known:['ICUMSA 45','500 MT','CIF','Sacas 25 kg'],missing:['Comprador final','Evidência empresarial','Decisor','Pagamento'],note:'O contato informou que não é o comprador final. LOI foi solicitada para avançar.'},
424 |       {id:'uae',company:'Prospect Jebel Ali',country:'Emirados Árabes',place:'Jebel Ali',product:'Açúcar',demand:'25.000 MT/mês · ICUMSA 45',status:'Em qualificação',decision:'Alta escala',decisionTone:'green',next:'Confirmar embalagem e decisor',known:['ICUMSA 45','25.000 MT/mês','Jebel Ali'],missing:['Embalagem','Incoterm','Pagamento','Evidência empresarial'],note:'Demanda declarada de grande escala; precisa comprovação e confirmação operacional.'},
425 |       {id:'enpra',company:'ENPRA',country:'Equador',place:'Destino não confirmado',product:'Açúcar',demand:'1 contêiner · especificação pendente',status:'Em contato',decision:'Abaixo do mínimo',decisionTone:'amber',next:'Receber especificação e volume em MT',known:['1 contêiner'],missing:['Especificação','Volume exato','Porto','Comprador final'],note:'Oportunidade preservada, mas provavelmente abaixo do mínimo padrão de 500 MT por operação.'},
426 |       {id:'bra-suisse',company:'Bra Suisse',country:'Suíça',place:'Porto não confirmado',product:'Açúcar',demand:'≈270 MT · FOB · 50 kg',status:'Em qualificação',decision:'Aprovação necessária',decisionTone:'amber',next:'Validar recorrência e consolidação',known:['≈270 MT','FOB','CAD at sight','Sacas 50 kg'],missing:['Especificação','Porto','Comprador final','Evidência empresarial'],note:'Canal aberto. Volume está abaixo do parâmetro atual de açúcar e exige aprovação.'},
427 |       {id:'oriens',company:'Oriens Logistic',country:'Rússia',place:'Destino não confirmado',product:'Café',demand:'23 MT Arábica + 23 MT Robusta',status:'Bloqueado',decision:'Política EAG',decisionTone:'red',next:'Não avançar sem revisão executiva',known:['23 MT Arábica','23 MT Robusta'],missing:['Demais condições comerciais'],note:'Mercado sinalizado para bloqueio/revisão por política EAG. Não avançar automaticamente.'},
428 |       {id:'foodmax',company:'Foodmax',country:'Vietnã',place:'Destino não confirmado',product:'Café',demand:'Demanda não confirmada',status:'Prospectado',decision:'Validar',decisionTone:'blue',next:'Confirmar produto, volume e decisor',known:['Empresa identificada'],missing:['Demanda','Volume','Contato','Evidência nominal'],note:'Prospect de café com lacunas operacionais ainda abertas.'},
429 |       {id:'lurunoa',company:'LURUNOA',country:'Espanha',place:'Destino não confirmado',product:'Café',demand:'Demanda não confirmada',status:'Descoberto',decision:'Investigar',decisionTone:'purple',next:'Buscar evidência empresarial',known:['Empresa identificada'],missing:['Evidência','Demanda','Contato','Decisor'],note:'Somente indício comercial neste momento.'}
430 |     ];
431 |     let apiAvailable = false;
432 |     async function api(path, options={}) {
433 |       const result = await fetch(path,{...options,headers:{"content-type":"application/json",...(options.headers||{})}});
434 |       const payload = await result.json().catch(()=>({}));
435 |       if(!result.ok) throw new Error(payload?.error?.message||`Erro HTTP ${result.status}`);
436 |       return payload;
437 |     }
438 |     function apiLead(row){
439 |       const labels={discovered:'Descoberto',prospected:'Prospectado',in_contact:'Em contato',qualifying:'Em qualificação',qualified:'Qualificado',confirmed_opportunity:'Oportunidade Confirmada',blocked:'Bloqueado'};
440 |       return {id:row.id,company:row.trade_name||row.legal_name,country:row.country_code,place:'Destino a confirmar',product:row.commodity==='coffee'?'Café':row.commodity==='sugar'?'Açúcar':'A definir',demand:row.product_variant||'Demanda não confirmada',status:labels[row.pipeline_status]||row.pipeline_status,decision:row.exception_status?row.exception_status.replaceAll('_',' '):'Em análise',decisionTone:row.exception_status?'amber':'blue',next:'Completar dados e evidências',known:['Registro criado no sistema'],missing:['Demanda','Evidência empresarial','Decisor'],note:'Ficha carregada do banco D1. Abra o módulo de qualificação para enriquecer o registro.',scores:{potential:row.potential_min,confidence:row.confidence_score,risk:row.risk_score}};
441 |     }
442 |     function updateDashboard(pipeline){
443 |       const count=(...states)=>states.reduce((sum,state)=>sum+Number(pipeline[state]||0),0);
444 |       const total=Object.values(pipeline).reduce((sum,value)=>sum+Number(value||0),0);
445 |       document.getElementById('metricProspects').textContent=total;
446 |       document.getElementById('metricQualifying').textContent=count('qualifying','Em qualificação');
447 |       document.getElementById('metricCritical').textContent=leads.filter(lead=>lead.status==='Bloqueado'||['Revisar','Validar','Aprovação'].some(term=>lead.decision.includes(term))).length;
448 |       document.getElementById('pipelineTotal').textContent=`${total} ${total===1?'empresa':'empresas'}`;
449 |       document.getElementById('flowDiscovered').textContent=count('discovered','Descoberto');
450 |       document.getElementById('flowProspected').textContent=count('prospected','Prospectado');
451 |       document.getElementById('flowContact').textContent=count('in_contact','Em contato');
452 |       document.getElementById('flowQualifying').textContent=count('qualifying','Em qualificação');
453 |       document.getElementById('flowQualified').textContent=count('qualified','confirmed_opportunity','Qualificado','Oportunidade Confirmada');
454 |     }
455 |     function demoPipeline(){return leads.reduce((result,lead)=>{result[lead.status]=(result[lead.status]||0)+1;return result;},{});}
456 |     async function hydrateFromApi(){
457 |       try{
458 |         const [companyPayload,dashboardPayload]=await Promise.all([api('/api/companies'),api('/api/dashboard')]);
459 |         apiAvailable=true; leads=companyPayload.companies.map(apiLead); document.querySelector('.status-pill').innerHTML='<span class="pulse"></span> Sistema conectado'; renderLeads(); updateDashboard(dashboardPayload.pipeline||{});
460 |       }catch(error){ document.querySelector('.status-pill').innerHTML='<span class="pulse" style="background:var(--amber)"></span> Protótipo local'; updateDashboard(demoPipeline()); }
461 |     }
462 |     const emails = [
463 |       {id:'orbis',name:'Moody’s Orbis',to:'Formulário comercial / contato a confirmar',subject:'Cotação para piloto KYC/Compliance — importadores agrícolas',body:`Prezados,
464 | 
465 | Estamos desenvolvendo uma plataforma interna de descoberta e qualificação de importadores de commodities agrícolas, inicialmente açúcar e café.
466 | 
467 | Solicitamos proposta para um piloto de 60 dias com 50–100 consultas de empresas, cobrindo prioritariamente Brasil, Argentina, Vietnã, Indonésia e Etiópia.
468 | 
469 | Precisamos confirmar:
470 | • cobertura de registro empresarial, crédito, insolvência e risco;
471 | • disponibilidade de UBO, PEPs e sanções, com preços separados por módulo;
472 | • acesso via API REST ou exportação CSV, sandbox e quotas;
473 | • preço por consulta, assinatura, mínimos contratuais e custos excedentes;
474 | • direitos de retenção, processamento e geração de scores derivados;
475 | • restrições de redistribuição, residência de dados, DPA, LGPD/GDPR;
476 | • prazo de implantação, SLA e suporte.
477 | 
478 | Se possível, gostaríamos de uma amostra ou PoC com cinco empresas. Solicitamos retorno idealmente até 28/09/2026.
479 | 
480 | Atenciosamente,
481 | [Nome]
482 | EAG`},
483 |       {id:'dnb',name:'Dun & Bradstreet',to:'Formulário comercial / contato a confirmar',subject:'Proposta para piloto de dados empresariais e risco — EAG',body:`Prezados,
484 | 
485 | A EAG está estruturando uma plataforma interna para descobrir e qualificar importadores de açúcar e café.
486 | 
487 | Gostaríamos de receber uma proposta para um piloto de 60 dias, com 50–100 consultas de empresas em Brasil, Argentina, Vietnã, Indonésia e Etiópia.
488 | 
489 | Por favor, detalhem:
490 | • cobertura cadastral, crédito, risco, sanções, PEPs e UBO;
491 | • API ou exportação em lote, sandbox, quotas e SLA;
492 | • preço por consulta e assinatura, contrato mínimo e módulos adicionais;
493 | • direitos para armazenar resultados e gerar análises/scores internos;
494 | • restrições de uso, DPA, LGPD/GDPR e residência dos dados;
495 | • possibilidade de trial com cinco empresas e prazo de onboarding.
496 | 
497 | Solicitamos retorno, se possível, até 28/09/2026.
498 | 
499 | Atenciosamente,
500 | [Nome]
501 | EAG`}
502 |     ];
503 |     const titles={overview:'Visão geral',pipeline:'Pipeline comercial',qualification:'Qualificação EAG',compliance:'Compliance e risco',data:'Dados & arquitetura',emails:'Central de e-mails',planning:'Planejamento'};
504 |     const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
505 |     const navButtons=[...document.querySelectorAll('[data-view]')];
506 |     function showView(id){
507 |       document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
508 |       navButtons.forEach(b=>b.classList.toggle('active',b.dataset.view===id));
509 |       document.getElementById('pageTitle').textContent=titles[id];
510 |       history.replaceState(null,'','#'+id); window.scrollTo({top:0,behavior:'smooth'});
511 |     }
512 |     navButtons.forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
513 |     document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));
514 |     const tone=s=>({Descoberto:'purple',Prospectado:'blue','Em contato':'blue','Em qualificação':'amber',Bloqueado:'red'}[s]||'blue');
515 |     function renderLeads(){
516 |       const q=document.getElementById('leadSearch').value.toLowerCase(); const p=document.getElementById('productFilter').value; const s=document.getElementById('statusFilter').value;
517 |       const rows=leads.filter(l=>(p==='all'||l.product===p)&&(s==='all'||l.status===s)&&(`${l.company} ${l.country} ${l.product} ${l.demand}`.toLowerCase().includes(q)));
518 |       document.getElementById('leadRows').innerHTML=rows.map(l=>`<tr data-id="${esc(l.id)}"><td><div class="company"><span class="avatar">${esc(l.company.split(/\s/).map(x=>x[0]).join('').slice(0,2))}</span><div><strong>${esc(l.company)}</strong><small>${esc(l.country)} · ${esc(l.place)}</small></div></div></td><td>${esc(l.product)}</td><td>${esc(l.demand)}</td><td><span class="badge ${tone(l.status)}">${esc(l.status)}</span></td><td><span class="badge ${esc(l.decisionTone)}">${esc(l.decision)}</span></td><td><div class="score-mini"><span>P ${esc(l.scores?.potential??'—')}</span><span>C ${esc(l.scores?.confidence??'—')}</span><span>R ${esc(l.scores?.risk??'—')}</span></div></td><td>${esc(l.next)}</td></tr>`).join('');
519 |       document.getElementById('leadEmpty').style.display=rows.length?'none':'block';
520 |       document.getElementById('leadCountBadge').textContent=`${rows.length} ${rows.length===1?'registro':'registros'}`;
521 |       document.querySelectorAll('#leadRows tr').forEach(r=>r.addEventListener('click',()=>openLead(r.dataset.id)));
522 |     }
523 |     ['leadSearch','productFilter','statusFilter'].forEach(id=>document.getElementById(id).addEventListener('input',renderLeads)); renderLeads(); updateDashboard(demoPipeline());
524 |     function csvCell(value){const text=String(value??'').replaceAll('"','""');return `"${text}"`;}
525 |     document.getElementById('exportPipelineButton').onclick=()=>{
526 |       const header=['Empresa','País','Produto','Demanda','Estado','Decisão','Potential','Confidence','Risk','Próximo passo'];
527 |       const rows=leads.map(lead=>[lead.company,lead.country,lead.product,lead.demand,lead.status,lead.decision,lead.scores?.potential??'',lead.scores?.confidence??'',lead.scores?.risk??'',lead.next]);
528 |       const csv='\uFEFF'+[header,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n');
529 |       const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
530 |       const link=document.createElement('a');link.href=url;link.download=`eag-compass-pipeline-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);toast('Pipeline exportado em CSV');
531 |     };
532 |     const drawer=document.getElementById('drawer'),backdrop=document.getElementById('drawerBackdrop');
533 |     async function openLead(id){ const l=leads.find(x=>x.id===id); if(!l)return; let detail=null;if(apiAvailable){try{detail=await api(`/api/companies/${encodeURIComponent(id)}`)}catch(error){toast(error.message)}} document.getElementById('drawerTitle').textContent=l.company; document.getElementById('drawerBody').innerHTML=`<span class="badge ${tone(l.status)}">${esc(l.status)}</span> <span class="badge ${esc(l.decisionTone)}">${esc(l.decision)}</span><h4>Resumo</h4><dl class="detail-list"><dt>Mercado</dt><dd>${esc(l.country)} · ${esc(l.place)}</dd><dt>Produto</dt><dd>${esc(l.product)}</dd><dt>Demanda</dt><dd>${esc(l.demand)}</dd><dt>Próximo passo</dt><dd>${esc(l.next)}</dd>${detail?`<dt>Evidências</dt><dd>${detail.evidence.length}</dd><dt>Contatos</dt><dd>${detail.contacts.length}</dd>`:''}</dl>${apiAvailable?`<h4>Ações da ficha</h4><div class="email-actions"><button class="btn" data-operation="evidence" data-company="${esc(id)}">+ Evidência</button><button class="btn" data-operation="contact" data-company="${esc(id)}">+ Contato</button><button class="btn" data-operation="demand" data-company="${esc(id)}">Demanda EAG</button><button class="btn" data-operation="risk" data-company="${esc(id)}">+ Risco</button><button class="btn" data-direct-action="recalculate" data-company="${esc(id)}">Recalcular</button><button class="btn primary" data-direct-action="qualify" data-company="${esc(id)}">Avaliar qualificação</button></div>`:''}<h4>Dados conhecidos</h4><div class="checklist">${l.known.map(x=>`<div class="check done"><i></i><div><strong>${esc(x)}</strong></div></div>`).join('')}</div><h4>Lacunas</h4><div class="checklist">${l.missing.map(x=>`<div class="check"><i></i><div><strong>${esc(x)}</strong></div></div>`).join('')}</div><h4>Leitura operacional</h4><div class="notice">${esc(l.note)}</div>`; drawer.classList.add('open');backdrop.classList.add('open');document.querySelectorAll('[data-operation]').forEach(button=>button.onclick=()=>openOperation(button.dataset.operation,button.dataset.company));document.querySelectorAll('[data-direct-action]').forEach(button=>button.onclick=()=>directAction(button.dataset.directAction,button.dataset.company)); }
534 |     function closeDrawer(){drawer.classList.remove('open');backdrop.classList.remove('open')}; document.getElementById('closeDrawer').onclick=closeDrawer;backdrop.onclick=closeDrawer;document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openLead(b.dataset.open));
535 |     let selectedEmail='orbis'; const sent=JSON.parse(localStorage.getItem('eag-email-status')||'{}');
536 |     function renderEmails(){document.getElementById('emailList').innerHTML=emails.map(e=>`<button class="email-item ${e.id===selectedEmail?'active':''}" data-email="${e.id}"><strong>${e.name}</strong><span>${sent[e.id]?'Marcado como enviado':'RFQ · rascunho'}</span></button>`).join('');document.querySelectorAll('[data-email]').forEach(b=>b.onclick=()=>{selectedEmail=b.dataset.email;renderEmails();showEmail()});}
537 |     function showEmail(){const e=emails.find(x=>x.id===selectedEmail);document.getElementById('emailTo').textContent=e.to;document.getElementById('emailSubject').textContent=e.subject;document.getElementById('emailBody').textContent=e.body;document.getElementById('emailStatus').textContent=sent[e.id]?'Marcado localmente como enviado':'Rascunho não enviado';}
538 |     renderEmails();showEmail();
539 |     function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
540 |     document.getElementById('copyEmail').onclick=async()=>{const e=emails.find(x=>x.id===selectedEmail);await navigator.clipboard.writeText(`Assunto: ${e.subject}\n\n${e.body}`);toast('E-mail copiado para a área de transferência')};
541 |     document.getElementById('markSent').onclick=()=>{sent[selectedEmail]=!sent[selectedEmail];localStorage.setItem('eag-email-status',JSON.stringify(sent));renderEmails();showEmail();toast(sent[selectedEmail]?'Marcado localmente como enviado':'Marcação removida')};
542 |     document.getElementById('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){showView('pipeline');document.getElementById('leadSearch').value=e.target.value;renderLeads();}});
543 |     const prospectDialog=document.getElementById('prospectDialog');
544 |     document.getElementById('newProspectButton').onclick=()=>prospectDialog.showModal(); document.getElementById('closeProspectDialog').onclick=()=>prospectDialog.close(); document.getElementById('cancelProspect').onclick=()=>prospectDialog.close();
545 |     document.getElementById('prospectForm').addEventListener('submit',async e=>{e.preventDefault();const form=new FormData(e.currentTarget);const data=Object.fromEntries(form.entries());try{if(!apiAvailable)throw new Error('A API ainda não está conectada. Use o projeto Cloudflare local ou publicado.');await api('/api/companies',{method:'POST',body:JSON.stringify(data)});prospectDialog.close();e.currentTarget.reset();toast('Prospect criado como Descoberto');await hydrateFromApi();}catch(error){toast(error.message)}});
546 |     const operationDialog=document.getElementById('operationDialog');let currentOperation=null;let currentCompany=null;
547 |     const input=(name,label,type='text',extra='')=>`<div class="form-control"><label>${label}</label><input name="${name}" type="${type}" ${extra}></div>`;
548 |     function openOperation(type,companyId){currentOperation=type;currentCompany=companyId;const fields=document.getElementById('operationFields');const titles={evidence:'Adicionar evidência',contact:'Cadastrar contato protegido',demand:'Registrar demanda EAG',risk:'Registrar observação de risco'};document.getElementById('operationTitle').textContent=titles[type];
549 |       if(type==='evidence')fields.innerHTML=`<div class="form-control"><label>Categoria</label><select name="category"><option value="business">Evidência empresarial</option><option value="market">Contexto de mercado</option><option value="commercial_signal">Indício comercial</option></select></div>${input('evidenceType','Tipo de evidência','text','required')}${input('reference','Referência / descrição','text','required')}${input('sourceUrl','URL da fonte','url')}${input('factDate','Data do fato','date')}${input('consultedAt','Data da consulta','datetime-local','required')}<div class="form-control"><label>Validação</label><select name="validationStatus"><option value="pending">Pendente</option><option value="valid">Válida</option><option value="invalid">Inválida</option></select></div>`;
550 |       if(type==='contact')fields.innerHTML=`${input('fullName','Nome completo','text','required')}${input('jobTitle','Cargo')}${input('email','E-mail','email')}${input('phone','Telefone')}${input('linkedinUrl','LinkedIn','url')}${input('sourceLabel','Fonte','text','required')}${input('sourceUrl','URL da fonte','url')}`;
551 |       if(type==='risk')fields.innerHTML=`<div class="form-control"><label>Componente</label><select name="component"><option value="registration">Registro</option><option value="credit">Crédito</option><option value="payment">Pagamento</option><option value="reputation">Reputação</option><option value="logistics">Logística</option></select></div>${input('severity','Severidade 0–20','number','required min="0" max="20"')}${input('sourceReference','Fonte / justificativa','text','required')}${input('observedAt','Data da observação','datetime-local','required')}`;
552 |       if(type==='demand')fields.innerHTML=`<div class="form-control"><label>Commodity</label><select name="commodity"><option value="sugar">Açúcar</option><option value="coffee">Café</option></select></div>${input('productVariant','Produto / variante','text','required')}${input('specification','Especificação')}${input('packaging','Embalagem')}${input('volume','Volume por operação (MT)','number','required min="0" step="0.01"')}${input('destinationCountry','País destino')}${input('deliveryLocation','Porto / local')}${input('incoterm','Incoterm')}${input('requiredDate','Data necessária','date')}${input('operations','Operações por ano','number','min="1"')}${input('paymentMethod','Método de pagamento')}${input('paymentTerm','Prazo de pagamento')}${input('finalBuyer','Comprador final')}${input('decisionMaker','Decisor')}${input('compliance','Restrições de compliance')}`;
553 |       operationDialog.showModal();
554 |     }
555 |     document.getElementById('closeOperationDialog').onclick=()=>operationDialog.close();document.getElementById('cancelOperation').onclick=()=>operationDialog.close();
556 |     document.getElementById('operationForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());try{if(currentOperation==='evidence')await api(`/api/companies/${currentCompany}/evidence`,{method:'POST',body:JSON.stringify({...data,consultedAt:new Date(data.consultedAt).toISOString()})});if(currentOperation==='contact')await api(`/api/companies/${currentCompany}/contacts`,{method:'POST',body:JSON.stringify(data)});if(currentOperation==='risk')await api(`/api/companies/${currentCompany}/risk-observations`,{method:'POST',body:JSON.stringify({...data,severity:Number(data.severity),observedAt:new Date(data.observedAt).toISOString()})});if(currentOperation==='demand'){const valueFields={product:data.productVariant,specification:data.specification,packaging:data.packaging,volume_per_operation:{amount:Number(data.volume),unit:'MT'},destination_country:data.destinationCountry,delivery_location:data.deliveryLocation,incoterm:data.incoterm,required_date:data.requiredDate,modality:Number(data.operations||1)>1?'contract':'spot',operations_per_year:Number(data.operations||1),payment_method:data.paymentMethod,payment_term:data.paymentTerm,payment_guarantee:'',final_buyer:data.finalBuyer,decision_maker:data.decisionMaker,compliance_restrictions:data.compliance};const fields=Object.entries(valueFields).map(([key,value])=>({key,status:value!==''&&value!==null?'confirmed':'not_confirmed',value}));await api(`/api/companies/${currentCompany}/demand`,{method:'PUT',body:JSON.stringify({commodity:data.commodity,productVariant:data.productVariant,fields})});}operationDialog.close();e.currentTarget.reset();toast('Ficha atualizada');await hydrateFromApi();await openLead(currentCompany);}catch(error){toast(error.message)}});
557 |     async function directAction(action,companyId){try{if(action==='recalculate'){await api(`/api/companies/${companyId}/scores/recalculate`,{method:'POST',body:'{}'});toast('Scores recalculados');}if(action==='qualify'){await api(`/api/companies/${companyId}/qualify`,{method:'POST',body:'{}'});toast('Empresa qualificada');}await hydrateFromApi();await openLead(companyId);}catch(error){toast(error.message)}}
558 |     function registerWebMcp(){const context=document.modelContext;if(!context?.registerTool)return;const fail=message=>{throw new Error(message)};Promise.resolve(context.registerTool({name:'list_prospects',title:'Listar prospects',description:'Lista prospects visíveis no pipeline EAG Compass, com filtros opcionais.',inputSchema:{type:'object',properties:{query:{type:'string'},product:{type:'string',enum:['Açúcar','Café']}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){const q=(input?.query||'').toLowerCase();return leads.filter(l=>(!q||`${l.company} ${l.country}`.toLowerCase().includes(q))&&(!input?.product||l.product===input.product)).map(l=>({id:l.id,company:l.company,country:l.country,product:l.product,status:l.status,nextStep:l.next}));}})).catch(()=>{});Promise.resolve(context.registerTool({name:'create_prospect',title:'Criar prospect',description:'Cria um prospect no estado Descoberto com nome, país e fonte rastreável.',inputSchema:{type:'object',properties:{legalName:{type:'string'},countryCode:{type:'string',minLength:2,maxLength:2},sourceLabel:{type:'string'},sourceUrl:{type:'string'}},required:['legalName','countryCode','sourceLabel'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){if(!apiAvailable)fail('API indisponível');const created=await api('/api/companies',{method:'POST',body:JSON.stringify(input)});await hydrateFromApi();return created;}})).catch(()=>{});}
559 |     const initial=location.hash.slice(1);if(titles[initial])showView(initial);
560 |     hydrateFromApi().then(registerWebMcp);
561 |   </script>
562 | </body>
563 | </html>
```


## Documentação do repositório

<a id="arquivo-16"></a>
### 16. `README.md`

71 linhas · SHA-256 `a5abcc2e4ecd225c6274c485ef81ec7da31d8466810f60a422d074d7179ad3c8`

````markdown
 1 | # EAG Compass
 2 | 
 3 | Central interna de descoberta, qualificação e acompanhamento de importadores de commodities agrícolas.
 4 | 
 5 | ## Estado atual
 6 | 
 7 | Versão `0.3.1`, construída sobre a Constituição v1.3 e a Especificação v1.3.
 8 | 
 9 | - Dashboard e pipeline responsivos.
10 | - Cadastro de prospects, evidências, contatos protegidos, demanda e risco.
11 | - Potential, Confidence, Risk, Risk Coverage e Completude separados.
12 | - Gate de qualificação e quatro perfis fixos de acesso.
13 | - Central de e-mails em modo rascunho, sem envio externo automático.
14 | - Exportação do pipeline em CSV.
15 | - Worker Cloudflare, D1, KV, R2 e Queue preparados.
16 | 
17 | ## Executar localmente
18 | 
19 | Requisitos: Node.js 24 e npm.
20 | 
21 | ```bash
22 | npm ci
23 | npm run db:migrate:local
24 | npm run dev
25 | ```
26 | 
27 | O Wrangler exibirá o endereço local. Nenhuma chave deve ser colocada no código.
28 | 
29 | ## Validar
30 | 
31 | ```bash
32 | npm run check
33 | ```
34 | 
35 | Esse comando verifica a sintaxe, executa os 14 testes de aceite, gera o artefato e valida os contratos essenciais da interface.
36 | 
37 | ## Antes de publicar na Cloudflare
38 | 
39 | Crie os recursos na conta e substitua os identificadores provisórios em `wrangler.jsonc`:
40 | 
41 | ```bash
42 | npx wrangler d1 create eag-compass-db
43 | npx wrangler kv namespace create CACHE
44 | npx wrangler r2 bucket create eag-compass-files
45 | npx wrangler queues create eag-compass-async
46 | npx wrangler queues create eag-compass-async-dlq
47 | ```
48 | 
49 | Depois, configure a chave de criptografia de PII como secret da Cloudflare:
50 | 
51 | ```bash
52 | npx wrangler secret put PII_ENCRYPTION_KEY
53 | ```
54 | 
55 | O valor deve ser uma chave aleatória de 32 bytes codificada em Base64. Não registre esse valor em Git, mensagens ou arquivos versionados.
56 | 
57 | Por fim:
58 | 
59 | ```bash
60 | npm run db:migrate:remote
61 | npm run deploy
62 | ```
63 | 
64 | ## Segurança
65 | 
66 | - Tokens da Cloudflare ficam apenas nos secrets do GitHub/Cloudflare.
67 | - Contatos são criptografados com AES-GCM.
68 | - Logs de auditoria não devem armazenar PII em texto aberto.
69 | - Nenhum e-mail é enviado automaticamente nesta versão.
70 | 
71 | Veja [PROGRESSO.md](./PROGRESSO.md) para o estado detalhado do produto.
````

<a id="arquivo-17"></a>
### 17. `PROGRESSO.md`

80 linhas · SHA-256 `b58031f51e71eeb9de4ca1a0d9e6cacf1ddc4ac507dabef0ddb364232becea16`

````markdown
 1 | # EAG Compass — Progresso de Construção
 2 | 
 3 | **Versão do produto:** 0.3.1  
 4 | **Data:** 2026-09-22  
 5 | **Base normativa:** Constituição v1.3 + Especificação v1.3
 6 | 
 7 | ## Resultado deste incremento
 8 | 
 9 | O protótipo visual foi convertido na base de um produto Cloudflare full-stack. A interface funciona como demonstração quando aberta isoladamente e muda para modo conectado quando encontra a API do Worker.
10 | 
11 | ## Implementado
12 | 
13 | - Interface responsiva com visão geral, pipeline, qualificação, compliance, dados, e-mails e planejamento.
14 | - Cadastro inicial de prospect como `Descoberto`, exigindo nome, país e fonte do indício.
15 | - Worker API nativo, sem framework adicional.
16 | - Banco D1 versionado com 20 tabelas/estruturas, índices, constraints e auditoria append-only.
17 | - Preparação mono-tenant para EAG com `tenant_id`, sem ativar multi-tenant.
18 | - Quatro perfis fixos: Administrador, Gestor Comercial, Vendedor/Analista e Auditor/Visualizador.
19 | - Evidências separadas em empresarial, mercado e indício comercial.
20 | - Formulário de demanda com estados `Confirmado`, `Não confirmado` e `Não se aplica`.
21 | - Cálculo de Potential, Confidence, Risk, Risk Coverage e Completude.
22 | - Gate de qualificação com dez verificações da Spec v1.3.
23 | - Estrutura de sanções com fontes, versões, entradas, aliases, triagens, matches e decisões.
24 | - Configuração para Workers Static Assets, D1, R2, KV, Queues e Cron.
25 | - Central de e-mails somente em rascunho; nenhum envio externo foi habilitado.
26 | - Ficha operacional com inclusão de evidência, contato, demanda e observação de risco.
27 | - Criptografia AES-GCM para nome, cargo, e-mail, telefone e LinkedIn dos contatos.
28 | - Identificação do usuário pelo ambiente privado e bootstrap controlado do primeiro Administrador.
29 | - Ferramentas estruturadas para listar e criar prospects quando o navegador oferecer suporte.
30 | - Dashboard conectado aos estados reais do pipeline, com fallback demonstrativo explícito.
31 | - Exportação do pipeline em CSV compatível com Excel, sem expor dados de contato protegidos.
32 | 
33 | ## Testes verdes
34 | 
35 | - AT2 — Potential de açúcar: 85/100.
36 | - AT3 — Potential de café FoodEra: 85/100.
37 | - AT5 — Confidence independente da Completude.
38 | - AT7 — Campo `Não se aplica` fora do denominador.
39 | - AT10 — Risk parcial normalizado: 17,14 com Coverage 35%.
40 | - AT11 — Risk 84 sem mitigação impede qualificação.
41 | - AT1, AT4, AT6, AT8, AT9, AT12, AT13 e AT14 adicionados.
42 | - Total: 14 cenários de aceite aprovados.
43 | - Integridade do schema SQLite/D1: `ok`.
44 | - Sintaxe do Worker, do motor de score e do frontend: válida.
45 | 
46 | ## Em andamento
47 | 
48 | - Substituição completa dos registros demonstrativos por dados do D1 após provisionamento da conta Cloudflare.
49 | - Tela de aprovação gerencial para exceções de volume, intermediário e mitigação de risco.
50 | - Testes integrados de autorização e persistência via Worker publicado.
51 | - Validação visual final nos navegadores desktop e móvel.
52 | 
53 | ## Bloqueios externos
54 | 
55 | - Recursos D1, R2, KV e Queues ainda precisam ser criados na conta Cloudflare antes da publicação full-stack.
56 | - OFAC requer download, checksum e importação reais testados.
57 | - CGU requer token e teste de ingestão.
58 | - Comex Stat requer resposta real e contrato técnico confirmado.
59 | - Moody’s Orbis e Dun & Bradstreet dependem do envio dos RFQs e das respostas comerciais.
60 | - Política de retenção depende de validação jurídica/DPO.
61 | 
62 | ## Próximo incremento
63 | 
64 | 1. Criar e vincular os recursos Cloudflare do ambiente de desenvolvimento.
65 | 2. Aplicar migrations e carregar os registros iniciais controlados.
66 | 3. Implementar a tela de aprovações e a triagem manual de sanções.
67 | 4. Testar autorização e persistência no ambiente Cloudflare.
68 | 5. Validar a experiência desktop e móvel com usuários EAG.
69 | 6. Executar varredura de segurança antes da publicação com dados reais.
70 | 
71 | ## Comandos locais
72 | 
73 | ```bash
74 | npm install
75 | npm run db:migrate:local
76 | npm run dev
77 | npm test
78 | ```
79 | 
80 | Nenhuma chave, senha ou token deve ser escrita no repositório. Valores locais ficam em `.dev.vars`; segredos de produção devem ser configurados no ambiente Cloudflare.
````
