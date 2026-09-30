-- E-mail com parte HTML (2026-09-30): a assinatura oficial de Rogério (HTML original da Hostinger) vai no próprio envio do
-- Compass, porque o servidor SMTP não acrescenta a assinatura do webmail (teste interno de 30/09). O HTML é congelado na
-- ficha junto com o texto e entra no hash aprovado (R17.2, R19.1).
ALTER TABLE ficha_messages ADD COLUMN body_html_enc TEXT;
