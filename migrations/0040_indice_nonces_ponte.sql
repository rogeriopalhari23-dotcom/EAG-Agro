-- Correção de custo (2026-10-09): a limpeza de nonces da ponte (DELETE FROM bridge_nonces WHERE seen_at<?) roda a cada
-- chamada e, sem índice, varria a tabela inteira (≈ 5,5 milhões de linhas lidas por dia; estourou o limite diário de
-- leituras do D1 em 09/10/2026). Com o índice, a limpeza lê só as linhas vencidas.
CREATE INDEX IF NOT EXISTS idx_bridge_nonces_seen ON bridge_nonces(seen_at);
