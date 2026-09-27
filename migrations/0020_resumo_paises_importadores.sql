-- Resumo curto por país e fonte para a lista de países importadores do Radar Internacional.
-- Chave = hash do objeto da lista mensal + janela (MDIC); a lista só usa o resumo cujo hash é o do ponteiro vigente,
-- então resumo de objeto antigo nunca aparece como atual. Dado do país: não indica empresa (R12.10).
CREATE TABLE trade_country_summary (
  content_sha256 TEXT NOT NULL,
  period_months INTEGER NOT NULL,           -- janela do MDIC usada; 0 na Comtrade (último ano declarado)
  iso3 TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('mdic','comtrade')),
  version_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('purchase_identified','no_record','data_unavailable','not_declared')),
  period_from TEXT,
  period_to TEXT,
  basis TEXT,
  brazil_usd REAL,
  hs6_count INTEGER NOT NULL DEFAULT 0,
  top_json TEXT NOT NULL DEFAULT '[]',      -- até 5 SH6 de maior valor de origem Brasil: [{hs6,name,usd}]
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (content_sha256, period_months)
);
CREATE INDEX idx_trade_country_summary_iso3 ON trade_country_summary(iso3, source);
