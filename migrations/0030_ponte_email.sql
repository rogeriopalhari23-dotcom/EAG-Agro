-- Ponte de e-mail (2026-09-30): o Worker não alcança SMTP/IMAP da Hostinger (IPs da Cloudflare). Um processo fora da
-- Cloudflare transporta mensagens congeladas e aprovadas e devolve o que lê na caixa; o Worker continua dono da fila,
-- das verificações pré-envio, da idempotência, da supressão e da auditoria.

-- Saúde da leitura de respostas: sem leitura bem-sucedida recente, nenhum envio sai (horário do Worker, não da ponte).
CREATE TABLE reply_reader_state (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  last_read_ok_at TEXT,
  last_error TEXT,
  last_error_at TEXT,
  reader TEXT,
  bridge_version TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Nonces das chamadas assinadas da ponte (contra repetição); limpeza de itens com mais de 1 dia.
CREATE TABLE bridge_nonces (
  nonce TEXT PRIMARY KEY,
  seen_at TEXT NOT NULL
);
