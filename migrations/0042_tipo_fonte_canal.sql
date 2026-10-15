-- Tipo da fonte do canal geral (2026-10-14, pedido de Rogério): o rodapé da ficha de identificação diz a origem do
-- endereço pelo tipo de fonte CADASTRADO (site da empresa ou diretório), nunca procurando a palavra "site" em texto livre.
-- Coluna nova, nula quando não há classificação (o rodapé então não afirma origem).
ALTER TABLE contacts ADD COLUMN source_kind TEXT CHECK (source_kind IS NULL OR source_kind IN ('company_site', 'directory'));

-- Canais já cadastrados: a rota de canais (POST /api/companies/:id/channels) recebia o tipo estruturado (sourceKind) e o
-- gravava só dentro do rótulo gerado pelo sistema, sempre com o mesmo texto fixo. Só esse texto exato, gerado pelo código a
-- partir do tipo escolhido, é convertido (comparação do início exato do rótulo, porque o D1 recusa LIKE com padrão longo).
-- Qualquer outro rótulo fica sem classificação.
UPDATE contacts SET source_kind = 'company_site'
WHERE contact_kind = 'company_channel' AND source_kind IS NULL AND source_url IS NOT NULL
  AND substr(source_label, 1, length('Canal geral publicado no site da empresa (site) — verificado em ')) = 'Canal geral publicado no site da empresa (site) — verificado em ';
UPDATE contacts SET source_kind = 'directory'
WHERE contact_kind = 'company_channel' AND source_kind IS NULL AND source_url IS NOT NULL
  AND substr(source_label, 1, length('Canal geral publicado em diretório (diretório) — verificado em ')) = 'Canal geral publicado em diretório (diretório) — verificado em ';
