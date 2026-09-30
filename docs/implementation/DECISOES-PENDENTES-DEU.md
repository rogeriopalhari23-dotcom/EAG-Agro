# Decisões pendentes — busca Alemanha / café verde (SH 0901.11)

Preparado em 2026-09-30 para decisão de Rogério. Nada foi ativado, aprovado ou enviado.

## 1. Porte e ICP — o que está aprovado

- **Aprovado (Constituição, exceção P16/P17 de 2026-09-27; Spec R14.3 e R14.6 revisadas no mesmo dia):** pequenas, médias e média-mais estão no ICP nos dois mercados. Continuam fora: **muito pequenas/MEI** (Receita `01`; no exterior, faixa `micro`) e gigantes sem relacionamento prévio. Fundamento citado: skill I3 ("médias e média-mais"), ampliada por Rogério para pequenas, mantendo "muito pequenas/MEI fora".
- **Lacuna:** para o exterior, o texto aprovado diz só "faixa `micro`", **sem limite numérico**. O corte `< 10 funcionários` (e `< 50` pequena, `< 250` média) existe apenas no código (`src/discovery-map.js`, usado quando um registro oficial informa funcionários) e **não tem decisão aprovada**.
- **Proposta para decisão:** adotar a definição da Recomendação da Comissão Europeia 2003/361/CE — micro: menos de 10 pessoas e faturamento anual ou balanço até EUR 2 milhões; pequena: menos de 50 e até EUR 10 milhões; média: menos de 250 e faturamento até EUR 50 milhões ou balanço até EUR 43 milhões. Enquanto não houver decisão, nenhuma empresa estrangeira é classificada como `micro` por número de funcionários.

## 2. R14.8 — alteração pontual proposta

**Texto atual (Spec, K1):**
> R14.8 (K1): SE o porte for desconhecido, ENTÃO a ficha DEVE exigir a pendência de porte resolvida ou a qualificação do porte registrada como objetivo da ligação (skill: "manter e qualificar volume na ligação").

**Texto proposto:**
> R14.8 (K1; revisão proposta em 2026-09-30): SE o porte for desconhecido, ENTÃO a ficha DEVE exigir a pendência de porte resolvida ou a qualificação do porte registrada como objetivo do primeiro contato — na ligação ou, quando o primeiro contato for por e-mail, na conversa que ele abrir (skill: "manter e qualificar volume na ligação"). O porte DEVE continuar desconhecido até evidência com fonte.

Efeito: a ficha de identificação por e-mail passa a poder ser criada com o porte desconhecido, desde que o objetivo esteja registrado; nada é classificado sem evidência. Se aprovada, o rótulo da tela muda de "objetivo da ligação" para "objetivo do primeiro contato"; a regra do código (`size_call_goal`) já é a mesma.

## 3. Validação comercial do café para a Alemanha (R12.9)

- **Requisito (R12.9):** "SE a commodity selecionada não estiver no catálogo confirmado da EAG, ENTÃO o sistema DEVE exigir validação comercial registrada antes de permitir ficha para essa campanha."
- **Por que foi exigida:** o produto "Café" (product-05) está com identidade confirmada, mas **não tem nenhum código SH/NCM cadastrado** no catálogo; por isso a SH 0901.11 selecionada não corresponde a um código confirmado e a seleção de 2026-09 foi marcada "precisa de validação comercial". Não tem relação com prova de importação por empresa.
- **Evidência necessária:** declaração comercial de Rogério de que a EAG oferece esse produto — café verde em grão, não torrado e não descafeinado (SH 0901.11; Arábica e/ou Conilon) — a compradores na Alemanha, com motivo registrado.
- **Já disponível (só do país, não prova compra de nenhuma empresa, R12.10/AT23):** Comtrade 2025 — importação alemã de 0901.11: USD 6,50 bi no total, USD 2,43 bi do Brasil (37,4%; 44,3% em 2024); MDIC — exportações do Brasil para a Alemanha em 12 meses (2025-09 a 2026-08): USD 2,09 bi.
- **Decisão concreta:** "A EAG oferece café verde em grão (SH 0901.11) para a Alemanha? Sim ou não, com motivo."
  - Sim → registrar a validação aprovada (Administrador) para a seleção `927ad9de-e25a-409b-acd5-4cb149094b56`, produto `product-05`. Opcional e separado: cadastrar e confirmar SH 0901.11 no catálogo do "Café" (vale para seleções futuras; a seleção atual continua pedindo a validação registrada).
  - Não → a campanha não recebe ficha.

## 4. Snov (verificador da G11)

- **Situação:** o Worker de produção `eag-compass-production` **não tem** `SNOV_CLIENT_ID` nem `SNOV_CLIENT_SECRET` (conferido pelos nomes em 2026-09-30; valores nunca lidos).
- **Onde obter:** conta Snov.io → https://app.snov.io/account/api (client ID e client secret). Documentação oficial: no plano gratuito, acesso à API só por demonstração agendada; a verificação custa 1 crédito por e-mail com resultado "valid" ou "unknown". Catch-all/unknown não contam como validado (G11).
- **Comandos (PowerShell, na pasta do projeto; cada um pede o valor sem mostrá-lo):**
  ```powershell
  cd C:\Users\Roger\eag-compass
  npx wrangler secret put SNOV_CLIENT_ID
  npx wrangler secret put SNOV_CLIENT_SECRET
  npx wrangler secret list
  ```
  Sem `--env`: a configuração de topo do `wrangler.jsonc` é o Worker de produção (o único ambiente nomeado é `local`).
