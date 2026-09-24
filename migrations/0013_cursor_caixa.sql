-- P2-T11: posição de leitura da caixa por UIDVALIDITY; UIDVALIDITY novo recomeça do zero sem duplicar (UNIQUE da 0007).
CREATE TABLE inbound_cursor (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mailbox TEXT NOT NULL,
  uidvalidity INTEGER NOT NULL,
  last_uid INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT, lease_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (tenant_id, mailbox)
);
