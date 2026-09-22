-- EAG Compass D1 Schema v1.0
-- Migration: Initial schema with tenant isolation

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  cnpj TEXT,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'descoberto',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, cnpj, country)
) STRICT;

CREATE INDEX idx_companies_tenant_status ON companies(tenant_id, status);

INSERT INTO tenants (id, name, created_at, updated_at) VALUES
  ('eag-internal', 'EAG Compass Internal', datetime('now'), datetime('now'));
