-- G1 e G3 (08/10/2026). Decisão de retenção de Rogério Palhari em 08/10/2026 (T11-REVISAO §12): A1, B1, C1, D1; avisos
-- da empresa seguem A1. Esta migração registra as políticas aprovadas, o histórico das revisões anuais e o registro dos
-- descartes de empresa (para reaplicar a eliminação depois de uma restauração do banco).

-- Políticas de retenção aprovadas (texto completo, responsável e data). Só inclusão: uma decisão nova é uma linha nova.
CREATE TABLE retention_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  item TEXT NOT NULL CHECK (item IN ('A','B','C','D','N')),
  option_code TEXT NOT NULL,
  covers TEXT NOT NULL,
  criterion TEXT NOT NULL,
  review TEXT NOT NULL,
  end_action TEXT NOT NULL,
  option_text TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  decided_on TEXT NOT NULL CHECK (decided_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER retention_policies_no_update BEFORE UPDATE ON retention_policies
BEGIN SELECT RAISE(ABORT, 'retention_policies: registre uma nova decisão'); END;
CREATE TRIGGER retention_policies_no_delete BEFORE DELETE ON retention_policies
BEGIN SELECT RAISE(ABORT, 'retention_policies: decisão não pode ser apagada'); END;

INSERT INTO retention_policies(id,tenant_id,item,option_code,covers,criterion,review,end_action,option_text,decided_by,decided_on) VALUES
 ('ret-2026-10-08-A','eag-internal','A','A1',
  'Hashes de e-mail e telefone suprimidos (inclusive os criados por exclusão) e hashes do registro de exclusões (banco e R2)',
  'Enquanto houver prospecção no canal; sem prazo fixo',
  'A cada 12 meses, registrada',
  'Se a revisão concluir que a prospecção no canal acabou: eliminar os itens do canal (rotina ainda não implementada; nada expira sozinho)',
  'Sem prazo fixo enquanto houver prospecção no canal; revisão registrada a cada 12 meses. Ninguém é recontatado por esquecimento; exige revisão anual.',
  'Rogério Palhari','2026-10-08'),
 ('ret-2026-10-08-N','eag-internal','N','A1',
  'Avisos da empresa (company_notices): tipo, classificação, fonte, motivo, pendência e hash do número geral',
  'Igual a A1','Junto com A1','Eliminar com A, quando a revisão decidir (rotina ainda não implementada)',
  'Os avisos da empresa seguem A (A1).',
  'Rogério Palhari','2026-10-08'),
 ('ret-2026-10-08-B','eag-internal','B','B1',
  'Histórico de remoções de supressão (suppression_removals)',
  'Enquanto existir a lista (A1), mais um prazo de prova a escolher se a lista for eliminada','Junto com A1',
  'Ao fim do prazo de prova depois da eliminação da lista: eliminar',
  'Mesmo prazo da lista (A) mais um prazo de prova escolhido. Prova disponível enquanto a remoção importa.',
  'Rogério Palhari','2026-10-08'),
 ('ret-2026-10-08-C','eag-internal','C','C1',
  'Dados pessoais de empresa descartada: contatos, pessoas de compras, roteiros, notas e histórico das tarefas, textos das fichas',
  'Eliminar no ato do descarte; manter empresa, motivo e data','Não se aplica','Eliminação imediata',
  'Eliminar os dados pessoais no descarte; manter empresa, motivo e data. Atende R23.4 sem prazo a controlar.',
  'Rogério Palhari','2026-10-08'),
 ('ret-2026-10-08-D','eag-internal','D','D1',
  'Exportações locais do D1 (C:\Users\Roger\eag-compass-backups)',
  'Só até a migração seguinte confirmada','A cada migração','Apagar a exportação anterior (procedimento manual, com confirmação)',
  'Guardar só até a migração seguinte confirmada; apagar a anterior. Menos cópias com dados pessoais; perde pontos antigos.',
  'Rogério Palhari','2026-10-08');

-- Revisões anuais de A1 (e dos avisos, que seguem A). Registrar uma revisão NUNCA remove, expira nem libera supressão.
CREATE TABLE retention_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  item TEXT NOT NULL CHECK (item IN ('A')),
  reviewed_on TEXT NOT NULL CHECK (reviewed_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  responsible TEXT NOT NULL CHECK (length(trim(responsible)) >= 3),
  decision TEXT NOT NULL CHECK (decision IN ('keep','elimination_to_assess')),
  basis TEXT NOT NULL CHECK (length(trim(basis)) >= 10),
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  request_id TEXT NOT NULL
);
CREATE INDEX idx_retention_reviews ON retention_reviews(tenant_id, item, reviewed_on);
CREATE TRIGGER retention_reviews_no_update BEFORE UPDATE ON retention_reviews
BEGIN SELECT RAISE(ABORT, 'retention_reviews: histórico não pode ser alterado'); END;
CREATE TRIGGER retention_reviews_no_delete BEFORE DELETE ON retention_reviews
BEGIN SELECT RAISE(ABORT, 'retention_reviews: histórico não pode ser apagado'); END;

-- Descartes de empresa (C1). Junto com a cópia no R2 (discards/<tenant>/<empresa>.json, sem textos pessoais), permite
-- refazer a eliminação se o banco voltar a um ponto anterior ao descarte. Não guarda o motivo nem dados pessoais.
CREATE TABLE company_discard_ledger (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  company_id TEXT NOT NULL,
  discarded_at TEXT NOT NULL,
  request_id TEXT,
  reapplied_at TEXT,
  PRIMARY KEY (tenant_id, company_id)
);
