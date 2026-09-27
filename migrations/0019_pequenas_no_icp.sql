-- Pequenas empresas no ICP de prospecção ativa, nos dois mercados (decisão de Rogério em 2026-09-27;
-- exceção P16/P17 registrada na Constituição; Spec R14.3 e R14.6 revisadas).
-- Continuam fora: muito pequenas/MEI (Receita 01; exterior 'micro') e gigantes sem relacionamento prévio.

-- Faixa de porte no exterior com a classe 'micro' (a coluna size_band antiga não aceita o valor novo).
ALTER TABLE companies ADD COLUMN size_class TEXT CHECK (size_class IN ('micro','small','medium','medium_plus','giant'));
UPDATE companies SET size_class = size_band WHERE size_band IS NOT NULL;

-- Porte-alvo da campanha passa a aceitar "pequeno ou maior".
CREATE TABLE campaign_icp_new (
  campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id),
  user_sectors_json TEXT NOT NULL,
  size_target TEXT NOT NULL CHECK (size_target IN ('small_plus','medium','medium_plus')),
  region TEXT NOT NULL,
  decision_role TEXT NOT NULL,
  influencer_role TEXT NOT NULL,
  supply_pains TEXT,
  buying_cycle_days INTEGER,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO campaign_icp_new(campaign_id,user_sectors_json,size_target,region,decision_role,influencer_role,supply_pains,buying_cycle_days,updated_by,updated_at)
  SELECT campaign_id,user_sectors_json,size_target,region,decision_role,influencer_role,supply_pains,buying_cycle_days,updated_by,updated_at FROM campaign_icp;
DROP TABLE campaign_icp;
ALTER TABLE campaign_icp_new RENAME TO campaign_icp;

-- Perfis marcados "fora do ICP — porte" por serem de pequeno porte voltam ao ICP (micro/MEI continuam fora).
UPDATE buyer_profiles SET icp_status = 'in_icp', revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE icp_status = 'out_small'
  AND (
    (SELECT size_class FROM companies c WHERE c.id = buyer_profiles.company_id) = 'small'
    OR (unit_key <> '' AND (SELECT size_code FROM company_units u WHERE u.id = buyer_profiles.unit_key) = '03')
    OR (unit_key = '' AND (SELECT size_code FROM company_units u WHERE u.company_id = buyer_profiles.company_id AND u.size_code IS NOT NULL
                           GROUP BY size_code ORDER BY COUNT(*) DESC LIMIT 1) = '03')
  );
