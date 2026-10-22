-- Disponibilidade da prospecção internacional (2026-10-22): avaliação de cada combinação país × produto ao fim de uma
-- pesquisa (empresas encontradas, busca real concluída sem candidatas, ou pendência técnica), com fontes, data e prazo
-- de reavaliação. Histórico preservado: avaliação nova substitui a anterior (superseded_*), nada é apagado. Avaliação
-- de execução simulada (origin='simulated', prévia de demonstração) nunca altera a disponibilidade dos mercados reais.
CREATE TABLE market_assessments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  iso3 TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('found','empty','technical')),
  origin TEXT NOT NULL CHECK (origin IN ('real','simulated')),
  job_id TEXT,
  search_id TEXT,
  reason TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  fingerprint TEXT NOT NULL,
  candidates INTEGER NOT NULL DEFAULT 0,
  existing INTEGER NOT NULL DEFAULT 0,
  assessed_at TEXT NOT NULL,
  review_after TEXT NOT NULL,
  superseded_at TEXT,
  superseded_reason TEXT,
  superseded_by TEXT
);
CREATE INDEX idx_market_assessments_current ON market_assessments(tenant_id, superseded_at, product_id, iso3);

-- Tarefas de manutenção do cron com exclusão mútua (lease), progresso persistido e último resultado ou falha visível.
CREATE TABLE maintenance_leases (
  name TEXT PRIMARY KEY,
  holder TEXT,
  lease_until TEXT,
  cursor_json TEXT,
  last_started_at TEXT,
  last_finished_at TEXT,
  last_result_json TEXT,
  last_error TEXT,
  last_error_at TEXT
);

-- Chaves de automação do cron, persistentes e independentes da política de pesquisa: só uma decisão registrada as muda
-- (nenhuma tela, reinício ou preparação automática da política as liga). A exploração em segundo plano dos "Mercados a
-- investigar" nasce DESLIGADA nesta migração, antes do primeiro ciclo do Worker que a contém; a política de pesquisa,
-- as pesquisas iniciadas por pessoa e a pesquisa automática dos botões continuam valendo. Ausência da linha = desligada.
CREATE TABLE automation_switches (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
  reason TEXT NOT NULL,
  set_by TEXT NOT NULL,
  set_at TEXT NOT NULL
);
INSERT INTO automation_switches(name,enabled,reason,set_by,set_at) VALUES ('market_exploration',0,'Exploração em segundo plano desligada na publicação da disponibilidade (instrução escrita de 2026-10-22). Desligar não revoga a política de pesquisa; pesquisas iniciadas por pessoa e a pesquisa automática dos botões continuam disponíveis.','Rogério Palhari (instrução escrita, 2026-10-22)','2026-10-22T00:00:00.000Z');

-- Base de países: territórios atuais da ISO 3166-1 que o seed (0015) deixou sem alpha-2 porque a Comtrade os agrega a
-- outro país. Sem alpha-2 o destino comprovado pelo MDIC ficava fora da seleção (ex.: Guiana Francesa). Códigos
-- históricos sem alpha-2 vigente (Antilhas Holandesas, Tchecoslováquia, Zona do Canal, Iugoslávia, Iêmen Democrático)
-- continuam sem código.
UPDATE countries SET iso2='GP' WHERE iso3='GLP' AND iso2 IS NULL;
UPDATE countries SET iso2='GF' WHERE iso3='GUF' AND iso2 IS NULL;
UPDATE countries SET iso2='RE' WHERE iso3='REU' AND iso2 IS NULL;
UPDATE countries SET iso2='VI' WHERE iso3='VIR' AND iso2 IS NULL;
