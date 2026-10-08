# Prontidão do piloto brasileiro por e-mail (2026-10-08)

**Escopo (decisão de Rogério em 08/10/2026):**
- O piloto do Brasil (milho GMO, Indiara/GO, 300 km) passa a ser **exclusivamente por e-mail**.
- As ligações **não serão executadas**. As 13 tarefas de ligação e o histórico delas ficam preservados como estão: nada foi fechado, apagado ou alterado.
- A conclusão do piloto telefônico sai da prioridade.
- A emenda T11-BR-TEL (`T11-REVISAO-PILOTO-BR-TELEFONE.md`) foi proposta para ligação manual e **não serve para liberar e-mail**.
- Exigências exclusivas da Alemanha (UWG §7, GDPR Art. 14 e 27, liberação internacional, textos em alemão ou inglês) não entram aqui.

**Como foi conferido:**
- Leitura da produção pelo Access, só com `GET`: tarefas, empresas, contatos, candidatos a pessoa, canais, campanhas, integrações, parâmetros e catálogo.
- Leitura dos documentos de descoberta e de evidências.
- Nada foi gravado, pesquisado, deduzido ou validado. Nenhum crédito da Snov foi usado. Nenhum contato foi feito.

## 1. Pendências do piloto (valem para todas as empresas)

| # | Item | Requisito | Estado em 08/10/2026 | O que falta |
|---|---|---|---|---|
| P1 | Campanha nacional de milho | R16.1, R19.2 item 5 | O produto Milho GMO (`product-03`) está no catálogo com identidade `confirmed` (R12.9 atendido). **Não existe campanha nacional de milho**: só a de teste (`ended`) e a da Alemanha (`draft`) | Criar a campanha em rascunho. Ativá-la é decisão posterior de Rogério |
| P2 | Canal de e-mail | R26.1–R26.3, R19.2 item 10 | `planned`. Testes internos da ponte: cenários 1–8 aprovados em 01/10. Snov funcionando. Autenticação do domínio publicada pela Hostinger (SPF, DKIM, DMARC `p=none`) | A liberação expressa de Rogério, só no fim |
| P3 | Supressões do OpenClaw | R21.8, R25.2 | Não importadas (VPS reinstalada, sem base acessível; P2-T15 parcial) | Decisão de Rogério: importar, se houver base, ou registrar na Spec a exceção datada "sem base recuperável" (proposta em `DECISOES-PILOTO-2026-10-01.md`) |
| P4 | Amostras de texto | R17.6 | Português aprovado em 24/09 (`AMOSTRAS-TEXTOS-PV.md`). Falta a amostra "sequência interrompida antes do break". A amostra em inglês é do internacional e fica fora deste piloto | Gerar e revisar a amostra interrompida. **Recomendado:** como as empresas só têm canal geral, revisar também uma amostra da ficha de identificação em português (`identify_buyer`), que ainda não tem revisão registrada |
| P5 | T11 do e-mail no Brasil | Spec, tabela de dependências (T11 antes de contato real); R9.1; Constituição P7 | Sem validação. A T11-BR-TEL **não** se aplica. Já resolvido e reaproveitável: retenção A1–D1, D-EXC (para telefone), exclusão testada, O2 (`rogeriopalhari@hotmail.com`), responsabilidade por operação (§17.2 da revisão) | Ver §3: base legal e teste de balanceamento para e-mail, transparência no próprio e-mail e textos O7–O9 aprovados para o escopo e-mail |
| P6 | Transferência internacional | LGPD art. 33 (L9) | Mecanismo não identificado no DPA da Cloudflare; mensagem pronta (§11 da revisão), não enviada | Comprovação. Vale para qualquer canal, porque os dados ficam no Compass |
| P7 | Registro de incidentes | Res. CD/ANPD 15/2024, art. 10 | Procedimento documental proposto (§14.2 da revisão), não criado | Aprovar e criar. Obrigação legal para qualquer canal |
| P8 | Triagem de sanções | R19.2 item 6, R14 | Listas importadas em 24/09; validade de 720 h → **vencem em 24/10/2026** | Reimportar as listas se o primeiro envio for depois de 24/10 |
| P9 | Cópia à EAG das comunicações com clientes | Contrato de franquia (achado A5, §17 da revisão) | O contrato pede cópia das comunicações com clientes ao e-mail de vendas da EAG. Não está confirmado se isso alcança o e-mail de prospecção. A ponte hoje não copia | **Dúvida D5**, sem bloqueio automático: decidir se o primeiro e-mail sai com cópia (visível ou oculta) ou se a cópia vai depois da resposta. Pode-se também consultar a EAG |

Já atendidos, sem ação:
- remetente real e endereço físico configurado (R19.13);
- leitura das respostas antes do envio (R19.14, ponte ativa);
- descadastro em um clique e por resposta (R21.7–R21.10, cenários 3a e 3b);
- rampa e espaçamento (R19.10);
- janela nacional 09–17, de segunda a sexta;
- validade da validação de e-mail de 30 dias (decisão de 01/10);
- exclusão e retenção.

## 2. Pendências por empresa (as 13 aceitas)

Regras do Compass que se aplicam a cada empresa:
- **Canal publicado e finalidade:**
  - canal geral da empresa (`company_channel`) só entra em ficha de **identificação do responsável** (`identify_buyer`), que pede o nome do comprador;
  - ficha de reunião (`meeting`) exige decisor ou influenciador com e-mail próprio (PV8);
  - endereço deduzido de padrão não recebe envio (R19.2 item 11; R13.3).
- **Validação:** `valid` por verificador, com data, e **dentro de 30 dias em cada passo** (R19.2 item 11). Validar perto do envio para não vencer no meio da sequência.
- **Fuso confirmado no contato** (R18.6): Goiás e Minas Gerais usam `America/Sao_Paulo`.
- **Contrato (A3)**, passo do franqueado fora do Compass: antes do primeiro contato, registrar o CNPJ e o nome no CRM da EAG; a exclusividade depende de iniciar em até 3 dias. O Compass não bloqueia por isso.
- **Na hora do envio:** sanções, supressão e pausas são conferidas automaticamente.

| Empresa | Canal de e-mail publicado | Finalidade possível | Validação | Falta |
|---|---|---|---|---|
| Cimilho | Sim: e-mail geral do site, cadastrado como `company_channel` (fonte do site, verificado em 06/10) | `identify_buyer` | Nunca pedida (`pending` é o estado de criação) | Validar; registrar no CRM da EAG; ficha |
| Rei do Milho (Inhumas) | Sim: e-mail de compras do site, cadastrado como `company_channel` (verificado em 06/10). O site traz também um e-mail geral, não cadastrado | `identify_buyer` (é canal de setor, não pessoa) | Nunca pedida | Validar; registrar no CRM da EAG; ficha |
| São Martinho — Usina Boa Vista | Sim: e-mail geral da unidade na página oficial, conferido e **cadastrado em 08/10** (§5) | `identify_buyer` | Nunca pedida | Validar; registrar no CRM da EAG; revisar a ficha |
| Cargill — Uberlândia | Nenhum registrado. 2 candidatos a pessoa, sem e-mail | — | — | Achar um canal publicado em fonte oficial, sem dedução |
| Cargill Bioenergia — São Francisco | Nenhum registrado. 2 candidatos, sem e-mail | — | — | Idem |
| Rural Forte | Nenhum registrado | — | — | Idem |
| Sociagro | Nenhum registrado | — | — | Idem |
| Nutrir | Nenhum registrado | — | — | Idem |
| Super-Bovi | Nenhum registrado | — | — | Idem |
| Rações VR | Nenhum registrado | — | — | Idem |
| Ração Ituiutaba | Nenhum registrado | — | — | Idem |
| Caramuru — Itumbiara | Nenhum registrado | — | — | Idem |
| BRF/MBRF — Rio Verde | Nenhum registrado | — | — | Idem |

Notas:
- "Nenhum registrado" quer dizer que não há e-mail no Compass nem nas evidências da descoberta. Não quer dizer que a empresa não publique um.
- A procura em fontes oficiais (site e cadastro) não foi feita nesta etapa.
- Busca de e-mail de pessoas pela Snov consome créditos e fica para decisão posterior.

## 3. T11 do e-mail no Brasil: o que decidir (separado da T11-BR-TEL)

Reaproveita só o que já foi decidido ou é igual para qualquer canal:
- retenção A1–D1;
- O2;
- responsabilidade por operação: o Compass é de Rogério; CRM, negociação e a caixa corporativa fornecida pela EAG são da EAG;
- os textos O7 (pedidos de titulares), O8 (incidentes) e O9 (sanções), se Rogério os aprovar também para o escopo e-mail.

Específico do e-mail:
- **E1. Base legal.** Legítimo interesse, com teste de balanceamento adaptado ao e-mail: canal geral publicado pela empresa, pedido só de identificação do comprador, saída em um clique, sem envio a endereço pessoal deduzido.
- **E2. Transparência no próprio e-mail.** O texto já diz como o contato foi achado (PV1) e traz a saída (R21.7). Decidir se entra uma linha com o canal O2 para pedidos sobre dados. Mudar o modelo gera versão nova dos textos.
- **E3. Registro da validação do escopo e-mail no Brasil.** Só por um registro novo, próprio desse escopo, depois de E1, E2, P6 e P7. A proposta de rota da emenda T11-BR-TEL não é usada para isso.

## 4. Próximo passo concreto

1. **Rogério decide**, por escrito:
   - P3 (OpenClaw: importar ou exceção datada);
   - D5 (cópia à EAG);
   - E1 e E2;
   - se aprova O7–O9 também para o e-mail.
2. **Com autorização própria**, gravações sem envio nem aprovação:
   - cadastrar o canal da São Martinho Boa Vista como `company_channel`, com a fonte já registrada;
   - criar a campanha nacional de milho GMO em **rascunho**;
   - gerar as 3 fichas `identify_buyer` em português para revisão.
3. **Perto da data do envio:**
   - validar os 3 canais pela Snov (3 créditos);
   - reimportar as listas de sanções, se for depois de 24/10;
   - registrar as 3 empresas no CRM da EAG.

   Depois disso vêm a aprovação de cada ficha, a ativação da campanha e a liberação do canal, nessa ordem e só por Rogério.
4. **Em paralelo:** procurar canais publicados das outras 10 empresas em fontes oficiais, sem dedução, para aumentar o lote além de 3.

## 5. Rascunhos criados (08/10/2026, autorização de Rogério)

Gravados em produção pelo Access. Nenhum envio, aprovação, ativação ou liberação; nenhum crédito da Snov.

| Item | Resultado |
|---|---|
| Canal da São Martinho — Usina Boa Vista | Conferido na página oficial "Negócios & Unidades" (`saomartinho.com.br/show.aspx?idCanal=FFaluiXA+xksIA8UxDdVAw==`, 08/10/2026). O e-mail geral da unidade aparece no bloco de endereço da Unidade Boa Vista. Os endereços de coprodutos (DDG e óleo) e de privacidade são separados e **não** foram usados. Cadastrado como `company_channel`: contato `93ea58d8-2218-40fd-b7b2-eb5324691ec9`, fonte e data registradas, rótulo "só identificação do comprador", fuso `America/Sao_Paulo`, não suprimido |
| Campanha | `40e348d2-e148-4d03-9dde-d166955ef22f`, "Milho GMO — Indiara/GO, 300 km (piloto por e-mail)", nacional, Milho GMO (`product-03`), origem Indiara/GO, raio 300 km, **`draft`**. ICP: fábricas de ração, processadoras de milho e usinas de etanol de milho; porte médio; comprador de grãos ou milho; influenciador de compras ou suprimentos |
| Perfis comprador (R14.8) | Cimilho, São Martinho e Rei do Milho: marcado "esclarecer o porte é objetivo do primeiro contato" (`size_call_goal`). Classe e ICP não mudaram: continuam `possible_final_consumer` e `pending_size` |
| Fichas de identificação (pt-BR, `identify_buyer`, modelo `id-pt-1.1.0`) | Cimilho `92203532-1ef4-4ec9-8d0a-9dd4fc51e09e`; São Martinho `3bba38e2-b2b8-491b-b34a-8e4c647d028b`; Rei do Milho `5217599f-cce1-41d1-94fa-4ec4c6be2834`. Status `in_approval` (aguardando revisão); revisor sem violações |

**Conteúdo das fichas.** São 2 passos, dia 0 e dia 4, com o mesmo texto nas três:
- o e-mail pergunta quem é o responsável pela compra de milho;
- o segundo passo aceita "a empresa não compra milho" como resposta.

Não afirmam aceitação de GMO, responsabilidade de compra nem compra de terceiros. Não trazem preço, disponibilidade nem condições.

**Bloqueios da aprovação, calculados pelo sistema:**
- campanha em `draft`;
- canal `planned`;
- e-mail não validado (`pending`).

Fuso, endereço físico, sanções e revisor estão ok.

**Para revisar no painel:** Abordagem → Fichas → as três "em aprovação". Também se chega pela página de cada empresa, em "Abrir ficha".

**Observação, sem ação:** a mesma página oficial traz para a Unidade Boa Vista o telefone (64) 3514-1000, diferente do (64) 3615-9700 registrado em 06/10 na tarefa de ligação. As ligações estão fora do escopo; a tarefa não foi alterada.

## 6. Textos para decisão

### E1. Base legal do e-mail de identificação (Brasil)

> Adoto o legítimo interesse (LGPD art. 7º, IX) para enviar, ao canal geral publicado por uma empresa, um e-mail que só pergunta quem é o responsável pela compra de milho.
>
> **Teste de balanceamento:**
> 1. **Finalidade:** prospecção comercial entre empresas para fornecimento de milho a consumidores industriais, dentro da minha atividade de franqueado.
> 2. **Necessidade:** uso só o endereço geral publicado pela própria empresa no site oficial, com fonte e data. Não uso endereço pessoal, deduzido ou comprado. Nome de pessoa só entra se a empresa indicar.
> 3. **Expectativa:** o endereço foi publicado pela empresa para contato institucional. A mensagem é curta, sem anexo, sem preço e sem oferta.
> 4. **Salvaguardas:**
>    - no máximo 2 mensagens, com 4 dias de intervalo;
>    - saída por resposta "sair" ou em um clique, processada antes do próximo envio;
>    - supressão mantida para não recontatar (A1);
>    - nada sai sem minha aprovação, empresa a empresa;
>    - endereço validado antes do envio.
> 5. **Direitos:** pedidos pelo e-mail rogeriopalhari@hotmail.com, ou respondendo à própria mensagem.
>
> **Conclusão:** com o caráter institucional do canal e as salvaguardas, o interesse legítimo não se sobrepõe aos direitos dos titulares. Revisável se houver orientação contrária.

### E2. Transparência no próprio e-mail

- **E2-a (manter):** o texto atual identifica remetente, empresa, finalidade, endereço físico e forma de saída. Informações sobre dados só a pedido.
- **E2-b (acrescentar uma linha ao rodapé)**, antes da linha de saída:
  > "Encontrei este endereço no site da empresa. Pedidos sobre dados pessoais: rogeriopalhari@hotmail.com."

  Efeito: muda o modelo para `id-pt-1.2.0`. Exige mudança de código, publicação e versão nova das 3 fichas, que voltam à revisão.

### Supressões do OpenClaw (R21.8, R25.2)

- **Opção A (importar):**
  > "Recupero a base do OpenClaw da VPS e importo as supressões no Compass antes do primeiro envio, pela rota de importação (supressões primeiro)."

  Hoje não há base acessível: a VPS foi reinstalada e não há cópia local.
- **Opção B (exceção datada na Spec):**
  > "R21.8/R25.2 — exceção registrada em [data] por Rogério Palhari: a base do OpenClaw não é recuperável (VPS reinstalada em 24/09/2026, sem cópia local). Antes do primeiro envio do piloto brasileiro, cadastro manualmente no Compass as supressões de que tenho conhecimento. Declaro que [nenhuma / as seguintes] empresas do piloto foram contatadas pelo OpenClaw. A exceção vale só para a base perdida e não dispensa a importação se ela for recuperada."

  A declaração entre colchetes só pode ser feita por Rogério.

### O7, O8 e O9 aplicados ao e-mail

- **O7-e (pedidos de titulares):**
  > "Recebo pedidos pela resposta ao próprio e-mail ou por rogeriopalhari@hotmail.com.
  > - Confirmação e acesso: resposta simplificada imediata, ou declaração completa em até 15 dias (LGPD art. 19).
  > - Correção, exclusão e oposição: execução no mesmo dia da decisão, com meta de resposta em até 15 dias. Se não puder atender de imediato, respondo com as razões (art. 18, § 4º).
  > - Um 'sair' ou o clique de saída vale como oposição e é processado antes do próximo envio (R21.9)."
- **O8-e (incidentes):**
  > "Mesma regra do O8, com estes exemplos do e-mail:
  > - envio a destinatário errado;
  > - exposição de lista ou de conteúdo;
  > - acesso indevido ao Compass ou à ponte.
  >
  > Um incidente na caixa corporativa fornecida pela EAG é tratado pela EAG; eu a informo do que souber."
- **O9-e (sanções):**
  > "A triagem é conferida pelo sistema antes de cada envio. As listas vencem 30 dias após a importação (atuais: 24/10/2026) e são reimportadas antes de envios posteriores. Uma correspondência confirmada bloqueia o envio."

### D5. Cópia à EAG: o que o contrato diz

- O contrato pede cópia ao e-mail de vendas da EAG em "todas as comunicações com os clientes" e nas "negociações". Pede também que as etapas da operação e da negociação sejam reportadas no CRM ou por esse e-mail.
- O contrato separa "cliente em potencial" (antes do contato) de "cliente". Não diz expressamente se o primeiro e-mail de prospecção, enviado depois do registro no CRM, já é comunicação com cliente.
- A cópia desse e-mail é também a prova mais direta de que as tratativas começaram em até 3 dias do registro, condição da exclusividade.
- Alteração do contrato só por aditivo escrito. **Uma preferência de Rogério não muda o dever**; dispensá-lo exige autorização escrita da EAG.

Opções de cumprimento, a decidir:
- **D5-a:** cópia oculta a vendas@ em cada passo. Exige mudança na ponte e uma nota na R19.1, porque o destinatário aprovado continua único.
- **D5-b:** encaminhar a vendas@ cada e-mail enviado, logo depois do aceite. Pode ser feito manualmente ou por uma função nova.
- **D5-c:** pedir à EAG confirmação escrita de que o e-mail de identificação dispensa cópia até haver resposta.

Referências e trechos estão na análise privada (fora do Git).
