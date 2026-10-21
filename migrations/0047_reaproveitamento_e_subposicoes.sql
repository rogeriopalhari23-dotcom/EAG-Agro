-- Pesquisa sem limite dos cinco maiores produtos, empresa reaproveitada em várias commodities e classificação
-- reutilizada (2026-10-21). NÃO aplicada em produção.

-- Todas as subposições SH6 com valor de origem Brasil no resumo do país ({"090111": 19300, ...}), além das cinco maiores
-- (top_json, que continua só para a lista de países). A pesquisa automática cruza o produto com qualquer subposição
-- registrada, não só com as maiores. Resumo antigo sem esta coluna é refeito a partir do objeto já publicado no R2.
ALTER TABLE trade_country_summary ADD COLUMN hs6_json TEXT;

-- Pessoa responsável por produto: o decisor (ou influenciador) de uma commodity não vale para outra. Cada vínculo tem
-- fonte e autoria próprias. Contato sem vínculo é "produto não informado" e não conta como decisor de nenhum produto.
CREATE TABLE contact_products (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  role TEXT NOT NULL CHECK (role IN ('decision_maker','influencer','provisional_decision_maker','other')),
  source_label TEXT NOT NULL,
  source_url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, contact_id, product_id)
);
CREATE INDEX idx_contact_products_product ON contact_products(tenant_id, product_id);

-- Classificação para a pesquisa de mercado (faixa documentada que cobre mais de uma subposição) separada da
-- classificação do produto. A classificação de um lote comercial fica fora do catálogo (etapa comercial).
ALTER TABLE product_codes ADD COLUMN scope TEXT CHECK (scope IS NULL OR scope IN ('product','research'));

-- Característica verificada: data da verificação (a fonte continua em source_ref).
ALTER TABLE product_characteristics ADD COLUMN verified_at TEXT;
