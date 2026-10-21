# Classificação fiscal dos produtos (SH 2022 / NCM), 2026-10-20

## Fontes oficiais consultadas (reais, deste computador, em 2026-10-20)

- **NCM:** tabela oficial do Portal Único Siscomex (`classif/api/publico/nomenclatura/download/json`), marcada "Vigente em 20/10/2026", ato **Resolução Gecex nº 926/2026**. Códigos e descrições do capítulo, com vigência desde 01/04/2022 pela Resolução Gecex nº 272/2021 (SH 2022).
- **Açúcar em bruto:** Nota de subposição 1 do Capítulo 17 da TEC/NCM (Res. Gecex nº 272/2021). Para as subposições 1701.12, 1701.13 e 1701.14, açúcar em bruto é o de leitura no polarímetro **inferior a 99,5°**. Nota de subposição 2: 1701.13 só para açúcar de cana não centrifugado, de 69° a menos de 93°. O texto é o mesmo do SH 2022 nas tarifas oficiais reproduzidas (Sri Lanka Customs, capítulo 17; ABF Austrália, capítulo 17).
- **Especificação do açúcar:** ficha técnica interna da EAG ("Especificação técnica açúcar ICUMSA 45, ICUMSA 150 e VHP"), lida em 2026-10-20 e já citada em `docs/eag-compass-perfil.md`. Polarização: ICUMSA 45, mínimo 99,80%; ICUMSA 150, mínimo 99,50%; VHP, de 99,30% a 99,60%. A ficha **não** é copiada para o catálogo; só o valor que decide a classificação entra na regra.

## Regras (`src/classification.js`)

| Produto | SH6 / NCM | Fundamento |
| --- | --- | --- |
| Soja GMO / não GMO | 1201.90 / 1201.90.00 | Grão para trading, não semente (perfil da EAG). Semente seria 1201.10. |
| Milho GMO / não GMO | 1005.90 / 1005.90.10 | Milho em grão, não semente. |
| Sorgo | 1007.90 / 1007.90.00 | Sorgo de grão, não semente. |
| Açúcar ICUMSA 45 | 1701.99 / 1701.99.00 | Polarização ≥ 99,80% (ficha): não é açúcar em bruto (Nota 1). |
| Açúcar ICUMSA 150 | 1701.99 / 1701.99.00 | Polarização ≥ 99,50% (ficha), que não é "inferior a 99,5°": não é açúcar em bruto. |
| Açúcar VHP | **pergunta**: polarização do lote | 99,30% a 99,60% cruza o limite. Inferior a 99,5° → 1701.14.00 (cana em bruto); igual ou superior → 1701.99.00. |
| Café | **pergunta**: cru ou torrado; descafeinado | 0901.11.10, 0901.12.00 ou 0901.21.00. |
| Etanol hidratado e anidro; álcool industrial (3) | **pergunta**: desnaturado? | Não desnaturado → 2207.10; desnaturado → 2207.20. |
| Trigo | **pergunta**: trigo duro? | 1001.19.00 (duro) × 1001.99.00 (outros). |
| Farelo de soja | 2304.00 | Resíduos da extração do óleo de soja. |
| Farelo de canola | 2306.41 / 2306.41.00 | Canola é colza de baixo teor de ácido erúcico. |
| Farelo de algodão | 2306.10 / 2306.10.00 | Sementes de algodão. |
| Óleo de soja (bruto e refinado) | 1507.10 e 1507.90 | O produto abrange os dois. |
| Óleo de palma (bruto e refinado) | 1511.10 e 1511.90 | O produto abrange os dois. |
| Óleo de canola; óleo de algodão | **pergunta**: bruto, refinado ou ambos | 1514.11/1514.19; 1512.21/1512.29. |
| Lecitina de soja | 2923.20 / 2923.20.00 | Lecitinas. |
| DDGS | 2303.30 / 2303.30.00 | Borras e desperdícios das destilarias. |
| CGF e CGM | 2303.10 / 2303.10.00 | Resíduos da fabricação do amido (moagem úmida do milho). |
| Farelo de milho | 2302.10 / 2302.10.00 | Resíduos da moagem do milho (código antes só sugerido, agora fundamentado). |
| UCO | **sem regra** | Depende do estado ou do tratamento (laudo): Administrador, no Catálogo. |
| CSO | **sem regra** | Identidade do produto ainda pendente. |

## Funcionamento

- **Classificação verificada:** o produto com código confirmado é reaproveitado e não é reclassificado.
- **Sem código:** a pesquisa internacional aplica a regra no próprio trabalho automático e segue. O código entra como confirmado, com a fonte oficial, a versão e o fundamento. O autor é o usuário de sistema `system-classification`, e a auditoria `catalog.code_auto_classified` registra o canal `automation` e a política.
- **Característica que muda o código:** a pesquisa pergunta só essa característica, com as opções. A resposta fica no catálogo com a autoria de quem respondeu, sob a chave `classificacao:…`, que não vira argumento de mensagem, e a pesquisa continua sozinha.
- **Sem regra fundamentada:** pendência técnica para o Administrador. Nenhum código genérico é usado.
