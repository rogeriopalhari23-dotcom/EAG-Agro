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
| São Martinho — Usina Boa Vista | Sim, nas evidências: e-mail geral da unidade na página oficial (06/10). **Não está cadastrado como contato** | `identify_buyer` | — | Cadastrar o canal com a fonte já registrada; validar; CRM da EAG; ficha |
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
