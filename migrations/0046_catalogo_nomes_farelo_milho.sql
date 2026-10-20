-- Catálogo (2026-10-20): nome comercial para exibição e Farelo de milho.
-- display_name só muda como o produto aparece nas listas; identidade, códigos e regras continuam os do produto.
ALTER TABLE products ADD COLUMN display_name TEXT;

-- Siglas de coprodutos com o nome comercial por extenso (sigla como complemento). Nenhum é sinônimo de outro:
-- CGF e CGM vêm da moagem úmida do milho, DDGS da destilaria de etanol de milho e o farelo de milho da moagem a seco.
UPDATE products SET display_name='Grãos secos de destilaria com solúveis (DDGS)' WHERE id='product-24' AND commodity='ddgs';
UPDATE products SET display_name='Farelo de glúten de milho (CGF)' WHERE id='product-25' AND commodity='cgf';
UPDATE products SET display_name='Glúten de milho (CGM)' WHERE id='product-26' AND commodity='cgm';
UPDATE products SET display_name='Óleo de cozinha usado (UCO)' WHERE id='product-27' AND commodity='uco';
UPDATE products SET display_name='CSO (identidade a confirmar)' WHERE id='product-28' AND commodity='cso';

-- Farelo de milho: produto próprio (não equivale a CGF, CGM nem DDGS). Incluído por pedido de Rogério Palhari em
-- 2026-10-20; não consta do portfólio documentado (docs/eag-compass-perfil.md), por isso a identidade fica PENDENTE:
-- pode ser pesquisado; ficha só depois da confirmação da oferta pela EAG (R10.4). Código e característica entram como
-- sugestão (pendente / não confirmada): a confirmação é do administrador, com auditoria, pelo fluxo do catálogo.
INSERT INTO products(id,tenant_id,commodity,group_name,variant_name,origins_json,source_ref,consulted_at,identity_status,display_name)
SELECT 'product-29','eag-internal','corn_bran','Farelos','Farelo de milho','["SOLICITACAO"]','Pedido de Rogério Palhari em 2026-10-20 (incluir Farelo de milho na seleção de commodities)','2026-10-20','pending','Farelo de milho'
WHERE EXISTS (SELECT 1 FROM tenants WHERE id='eag-internal') AND NOT EXISTS (SELECT 1 FROM products WHERE commodity='corn_bran');
INSERT INTO product_codes(id,product_id,code_system,code,classification_version,status,source_ref)
SELECT 'code-product-29-hs-230210','product-29','HS','230210','HS2022','pending','Sistema Harmonizado, subposição 2302.10: sêmeas, farelos e outros resíduos da peneiração, moagem ou outros tratamentos do milho'
WHERE EXISTS (SELECT 1 FROM products WHERE id='product-29');
INSERT INTO product_characteristics(id,product_id,char_key,char_value,source_ref,status)
SELECT 'char-product-29-origem','product-29','origem','Subproduto da moagem a seco do milho (pericarpo, gérmen e parte do endosperma). Distinto do farelo de glúten de milho (CGF), do glúten de milho (CGM) e do DDGS.','Sistema Harmonizado, subposição 2302.10; distinção de processo (moagem a seco × úmida × destilaria)','not_confirmed'
WHERE EXISTS (SELECT 1 FROM products WHERE id='product-29');
