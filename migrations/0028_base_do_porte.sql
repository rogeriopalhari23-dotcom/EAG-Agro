-- Referência de porte aprovada por Rogério em 2026-09-30 (Recomendação da Comissão Europeia 2003/361/CE, só para
-- priorização): o porte gravado diz se é estimado (dado parcial, ex.: só efetivo) ou comprovado (efetivo e dados
-- financeiros de fonte oficial, considerando empresas parceiras e ligadas). Porte nunca descarta.
ALTER TABLE companies ADD COLUMN size_basis TEXT CHECK (size_basis IS NULL OR size_basis IN ('estimated','proven'));
UPDATE companies SET size_basis='estimated' WHERE size_class IS NOT NULL AND size_basis IS NULL;
