# Revisão para decisão — busca Alemanha / café verde (SH 0901.11)

Consolidado em 2026-09-30. Nada foi ativado, aprovado, aceito ou enviado. A aprovação individual de Rogério continua obrigatória antes de qualquer envio (R18.3).

## 1. Números da descoberta (diretório do Deutscher Kaffeeverband)

| | Empresas |
| --- | --- |
| **Únicas encontradas** (73 identificadores e 73 nomes distintos; 3 execuções de fonte) | 73 |
| Antes desta rodada (28/09): aceitas por Rogério | 5 |
| Antes desta rodada (28/09): descartadas automaticamente — fora da Alemanha | 4 |
| Antes desta rodada: ainda não validadas | 64 |
| **Esta rodada (30/09): validadas** | 64 |
| Esta rodada: descartadas automaticamente — perfil de prestador (logística, máquinas, consultoria, armazém) | 9 |
| **Esta rodada: relevantes aguardando aceite** (39 processadoras, 16 traders/importadoras) | 55 |
| **Acumulado:** 5 aceitas + 13 descartadas (4 + 9) + 55 aguardando | 73 |

Descartes automáticos que merecem olhar humano: CTS Coffee Trading Stehl (texto "als unabhängiger Berater", nome diz "Trading") e NKG Kala Hamburg (armazém/processamento de grupo cafeeiro).

## 2. Declarações de importação (autodeclarações)

Texto publicado pela própria empresa no perfil do diretório, consultado em 30/09/2026. Não é prova de importação; **nenhuma menciona o Brasil** — origem Brasil não confirmada.

| Empresa | Perfil | Autodeclaração (trecho) |
| --- | --- | --- |
| Dethlefsen & Balk GmbH (processadora) | https://www.kaffeeverband.de/de/kaffeekontakte/dethlefsen-balk-gmbh/ | "…beliefern als Importeur, Hersteller und Großhändler…" |
| Café Chavalo eG | https://www.kaffeeverband.de/de/kaffeekontakte/cafe-chavalo-eg/ | "…fair gehandelten Bio-Kaffee aus Nicaragua importiert" |
| EthioCo GmbH | https://www.kaffeeverband.de/de/kaffeekontakte/ethioco-gmbh/ | "Wir importieren nachhaltige Rohkaffees aus verschiedenen Ursprungsländern" |
| List + Beisler GmbH | https://www.kaffeeverband.de/de/kaffeekontakte/list-beisler-gmbh/ | "…leidenschaftlicher Importeur… seit 1901" |
| Sandtorkai Handel Papenhagen GmbH & Co. KG | https://www.kaffeeverband.de/de/kaffeekontakte/sandtorkai-handel-papenhagen-kg/ | "Wir sind Direktimporteur von Spezialitäten Kaffee aus Kenia" |
| Touton Specialties GmbH | https://www.kaffeeverband.de/de/kaffeekontakte/touton-specialties-gmbh/ | "Wir verstehen uns nicht nur als Importeur…" |

## 3. Azul — três coisas separadas (Nils Kästingschäfer)

| Item | Situação | Fonte |
| --- | --- | --- |
| Procuração (Prokura) | Registrada em 26/11/2024 — poder de representação, **não prova responsabilidade de compra** | North Data: https://www.northdata.de/K%C3%A4stingsch%C3%A4fer,+Nils,+Bremen |
| Cargo em compras | "Rohkaffee-Einkäufer bei Azul" na página da própria Azul (sem data); "Head of Procurement" só como indício do buscador (XING, sem link) | https://shop.azul.de/i/coffee-trip-peru |
| Autoridade para comprar café verde | **Não demonstrada** | — |

Azul segue como prioridade secundária, com "vínculo com grupo" e "autonomia de compras" a verificar.

## 4. Validação comercial do café para a Alemanha (R12.9)

- **Significado exato:** Rogério declara que o produto do catálogo "Café" corresponde à SH 0901.11 selecionada — café verde em grão, não torrado, não descafeinado — e que a EAG o oferece a compradores na Alemanha. Motivo: "Café" está confirmado no catálogo, mas **sem nenhum código SH/NCM**; por isso a seleção de 2026-09 foi marcada "precisa de validação comercial". Não tem relação com importação de empresas: o dado do país não comprova compra de nenhuma empresa (R12.10, AT23).
- **Efeito no sistema:**

| Etapa | Exige a validação comercial? | O que mais exige |
| --- | --- | --- |
| Pesquisar empresas e contatos | **Não** (busca já aberta pela seleção, R12.8) | — |
| Elegibilidade para primeiro contato (criar a ficha em rascunho) | **Sim** (`src/fichas.js`) | perfil no ICP ou porte tratado (R14.6/R14.8), destinatário com fuso e sem supressão, endereço físico da EAG |
| Ativar a campanha | **Sim** (`src/operations.js`) | ICP da campanha, revisão em dia |
| Autorização para enviar | **Sim** (na aprovação) | campanha ativa, internacional liberado por Rogério (T12), aprovação individual da ficha por destinatário, e no disparo todos os itens do R19.2 (supressão, pausas, compliance, fuso, janela, envio único, e-mail validado por verificador) |

- **Informação disponível (só do país):** Comtrade 2025 — importação alemã de 0901.11 USD 6,50 bi, do Brasil USD 2,43 bi (37,4%; 44,3% em 2024); MDIC — exportações do Brasil à Alemanha em 12 meses (2025-09 a 2026-08) USD 2,09 bi.
- **Decisão:** "A EAG oferece café verde em grão (SH 0901.11) para a Alemanha? Sim ou não, com motivo." Sim → registrar a validação (Administrador) na seleção `927ad9de-e25a-409b-acd5-4cb149094b56`, produto `product-05`. À parte e opcional: cadastrar SH 0901.11 como código confirmado do "Café" (vale para seleções futuras).

## 5. Porte

- **Regra vigente:** pequenas, médias e média-mais no ICP; fora: muito pequenas/MEI (Receita `01`; exterior faixa `micro`) e gigantes sem relacionamento prévio (Constituição, exceção P16/P17 de 27/09/2026; R14.3, R14.6). Porte desconhecido **não exclui**: a empresa fica visível e na busca; só a ficha exige o porte resolvido ou a qualificação do porte como objetivo (R14.8).
- **Lacuna:** para o exterior não há limite numérico aprovado para `micro` (o corte `< 10 funcionários` existe só no código).
- **Proposta fundamentada:** Recomendação da Comissão Europeia 2003/361/CE, definição oficial de PME na UE — micro: menos de 10 pessoas e faturamento anual ou balanço até EUR 2 mi; pequena: menos de 50 e até EUR 10 mi; média: menos de 250 e faturamento até EUR 50 mi ou balanço até EUR 43 mi. Sem dado, o porte fica desconhecido.
- **Situação:** 24grad — evidência sem classificar (IHK 04/02/2025: "mehr als 20 Festangestellte", faturamento 2024 "im niedrigen einstelligen Millionenbereich"); Amori e BLACK & YUM — desconhecido.

## 6. R14.8 — alteração pontual proposta

**Atual:** "R14.8 (K1): SE o porte for desconhecido, ENTÃO a ficha DEVE exigir a pendência de porte resolvida ou a qualificação do porte registrada como objetivo da ligação (skill: "manter e qualificar volume na ligação")."

**Proposta:** "R14.8 (K1; revisão proposta em 2026-09-30): SE o porte for desconhecido, ENTÃO a ficha DEVE exigir a pendência de porte resolvida ou a qualificação do porte registrada como objetivo do primeiro contato — na ligação ou, quando o primeiro contato for por e-mail, na conversa que ele abrir (skill: "manter e qualificar volume na ligação"). O porte DEVE continuar desconhecido até evidência com fonte."

## 6a. Textos finais (ainda não aprovados) — iguais para 24grad, AMORI e BLACK & YUM

Destinatário: canal geral publicado no site oficial de cada empresa (info@24grad.net, info@amori.coffee, genuss@blackandyum.de). Dois passos da mesma sequência, dias 0 e 4. Texto completo com assinatura em `RASCUNHOS-IDENTIFICACAO-DEU.md`.

| Passo | Alemão (enviado) | Português (referência) |
| --- | --- | --- |
| Dia 0 — assunto | Lieferant für Rohkaffee | Fornecedor café verde |
| Dia 0 — texto | Guten Tag, / ich habe Ihre Kontaktdaten auf Ihrer Website gefunden und schreibe Ihnen kurz. / Ich bin bei EAG Agro; wir handeln mit Agrarrohstoffen, und ich möchte gern mit der Person sprechen, die bei Ihnen für den Einkauf von Rohkaffee zuständig ist. / Könnten Sie mir sagen, wer diesen Bereich verantwortet und über welchen beruflichen Kontakt ich die Person am besten erreiche? | Olá, tudo bem? / Encontrei o contato de vocês no site e tomei a liberdade de enviar uma mensagem rápida. / Sou da EAG Agro; trabalhamos com commodities agrícolas e gostaria de falar com a pessoa responsável pela compra de café verde de vocês. / Você poderia me indicar quem responde por essa área e qual o melhor canal profissional para falar com essa pessoa? |
| Dia 4 — assunto | Re: Lieferant für Rohkaffee | Re: Fornecedor café verde |
| Dia 4 — texto | Guten Tag, / haben Sie meine Nachricht von vor einigen Tagen gesehen? Mir genügt ein kurzer Hinweis, wer bei Ihnen für den Einkauf von Rohkaffee zuständig ist und wie ich die Person am besten erreiche. | Olá, tudo bem? / Chegou a ver a mensagem que enviei há alguns dias? Só preciso saber quem responde pela compra de café verde e qual o melhor canal para falar com essa pessoa. |
| Assinatura (os dois) | Rogério Palhari — EAG Agro · Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil · „abmelden“ + link próprio | igual, com "sair" + link |

## 7. Credenciais do Snov (verificador da G11)

- Situação: o Worker de produção `eag-compass-production` não tem `SNOV_CLIENT_ID` nem `SNOV_CLIENT_SECRET` (conferido só pelos nomes).
- Origem: conta Snov.io → https://app.snov.io/account/api. No plano gratuito, API só com demonstração agendada; 1 crédito por verificação "valid" ou "unknown"; catch-all/unknown não validam (G11).
- Cadastro (PowerShell, na pasta do projeto; cada comando pede o valor sem exibi-lo; sem `--env`, porque a configuração de topo é a produção):
  ```powershell
  cd C:\Users\Roger\eag-compass
  npx wrangler secret put SNOV_CLIENT_ID
  npx wrangler secret put SNOV_CLIENT_SECRET
  npx wrangler secret list
  ```

## 8. Pesquisa de contatos em andamento (não depende das decisões)

Das 55 relevantes aguardando aceite: 49 têm site, todas lidas pelo aviso legal (43 em 28/09, reaproveitadas; 6 em 30/09); 22 com representante legal identificado (28 pessoas) — contatos a validar, não decisores. Sem site: 6. Pontos de atenção para a triagem: Gollücke & Rothfos publica e-mail da Volcafe no aviso legal e Ecom Kaffee pertence a grupo trader internacional (possível gigante; verificar).
