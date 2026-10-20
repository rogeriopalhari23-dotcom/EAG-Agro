-- Prospecção automática (2026-10-20): perfil comprador versionado, política persistente de pesquisa de rotina e
-- execução em segundo plano com estado, eventos, espera por limites, pausa, cancelamento e retomada.
-- Nada aqui autoriza contato: fichas, T11, supressões, canais e envios continuam com as regras próprias.

-- Perfil comprador padrão (configurável e versionado). Cada versão é imutável; a vigente é a de maior versão.
CREATE TABLE prospect_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  version INTEGER NOT NULL CHECK (version >= 1),
  profile_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, version)
);

-- Política de pesquisa de rotina: autorização persistente, dada por Administrador ou gestor, para executar descoberta,
-- consulta cadastral, triagem e cadastro em descoberta sem pedir ciência das mesmas limitações a cada rodada.
-- Revogar = registrar revoked_at; versões anteriores ficam no histórico. Despesa, mudança material de escopo e exceções
-- continuam fora dela.
CREATE TABLE research_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  version INTEGER NOT NULL CHECK (version >= 1),
  policy_json TEXT NOT NULL,
  reference TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_by TEXT,
  revoked_at TEXT,
  revoke_reason TEXT,
  UNIQUE (tenant_id, version)
);

-- Uma prospecção: entrada mínima (commodity/produto, mercado, local e alcance), perfil e política usados, etapa atual,
-- estado por etapa e próximo horário de execução (espera automática por limite de fonte).
CREATE TABLE prospect_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  market TEXT NOT NULL CHECK (market IN ('national','international')),
  name TEXT NOT NULL,
  input_json TEXT NOT NULL,
  profile_id TEXT REFERENCES prospect_profiles(id),
  policy_id TEXT REFERENCES research_policies(id),
  round_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','waiting','needs_decision','paused','cancelled','done','failed')),
  step TEXT NOT NULL DEFAULT 'plan',
  state_json TEXT NOT NULL DEFAULT '{}',
  summary_json TEXT,
  next_run_at TEXT,
  lease_until TEXT,
  lease_token TEXT,
  cycles INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX idx_prospect_jobs_due ON prospect_jobs(status, next_run_at);
CREATE INDEX idx_prospect_jobs_tenant ON prospect_jobs(tenant_id, created_at);

-- Registro de cada etapa (rastreabilidade): o que foi feito, com que resultado, sem dados pessoais em texto aberto.
CREATE TABLE prospect_job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES prospect_jobs(id),
  at TEXT NOT NULL,
  step TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ok','partial','waiting','pending','failed','skipped','decision')),
  message TEXT NOT NULL,
  detail_json TEXT
);
CREATE INDEX idx_prospect_job_events_job ON prospect_job_events(job_id, at);
