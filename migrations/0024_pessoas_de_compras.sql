-- Pesquisa de pessoas de compras nos dois radares (2026-09-28). Pessoa encontrada numa fonte é "contato de compras a
-- validar" até a pessoa aceitar; cargo e poder de compra só são confirmados por contact_verifications (job_title,
-- decision_authority). Dados pessoais criptografados como em contacts (P7). Nenhum e-mail é deduzido do domínio.
CREATE TABLE person_candidates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  unit_id TEXT,                               -- unidade vinculada (Nacional), quando a fonte é da unidade
  name_encrypted TEXT NOT NULL,
  name_hash TEXT NOT NULL,                    -- evita duplicar a mesma pessoa na mesma empresa
  title_encrypted TEXT,
  role_suggestion TEXT NOT NULL CHECK (role_suggestion IN ('decision_maker','influencer','provisional_decision_maker','other')),
  relevance TEXT NOT NULL,                    -- por que a pessoa é relevante (sem dado pessoal)
  source_kind TEXT NOT NULL CHECK (source_kind IN ('impressum','registry_qsa','company_site','directory','linkedin_manual','manual')),
  source_url TEXT NOT NULL,
  verified_at TEXT NOT NULL,                  -- data da verificação na fonte
  refresh_after TEXT NOT NULL,                -- depois disso o vínculo/cargo pode estar desatualizado
  email_encrypted TEXT,
  email_source_url TEXT,
  email_scope TEXT CHECK (email_scope IS NULL OR email_scope IN ('personal','generic','registry')),
  phone_encrypted TEXT,
  phone_source_url TEXT,
  status TEXT NOT NULL DEFAULT 'to_validate' CHECK (status IN ('to_validate','accepted','dismissed')),
  contact_id TEXT REFERENCES contacts(id),
  decided_by TEXT,
  decided_at TEXT,
  dismiss_reason TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (company_id, name_hash)
);
CREATE INDEX idx_person_candidates_company ON person_candidates(tenant_id, company_id, status);

-- Última pesquisa de pessoas por empresa (evita repetir antes do prazo; mostra o que foi tentado).
CREATE TABLE people_research (
  company_id TEXT PRIMARY KEY REFERENCES companies(id),
  tenant_id TEXT NOT NULL,
  researched_at TEXT NOT NULL,
  refresh_after TEXT NOT NULL,
  sources_json TEXT NOT NULL,                 -- [{kind,url,status,found,note}]
  requests INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  researched_by TEXT NOT NULL
);
