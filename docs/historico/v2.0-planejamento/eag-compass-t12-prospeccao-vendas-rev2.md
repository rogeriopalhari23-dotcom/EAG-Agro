# EAG Compass v2.0 — T12: Leitura da skill `/prospeccao-vendas`

**Data da leitura:** 2026-09-22 19:03 (-04:00) **Referência de escopo:** `docs/eag-compass-v2-escopo.md`, revisão 3, §2.11

**Revisão deste registro:** 2 — revisão documental em 2026-09-22.

**Proveniência:** caminho, versão, tamanho, data e hash abaixo foram informados no relatório de leitura no Windows. O `SKILL.md` integral não acompanha estes anexos. Esta revisão confere o relatório e sua compatibilidade com o escopo; não alega nova leitura da skill, dos livros ou recálculo do hash. As adaptações pertencem ao Compass e não modificam a skill original.

## 1. Identificação do conteúdo lido

| Item | Valor |
| --- | --- |
| Caminho | `C:\Users\Roger\.claude\skills\prospeccao-vendas\SKILL.md` |
| Arquivos da skill | Somente `SKILL.md` (340 linhas, 13.490 bytes). Não há pasta de referências nem arquivos auxiliares. |
| Origem | Skill local do usuário. Não é repositório git; nenhuma origem externa declarada no arquivo. |
| Versão declarada | "1.0 (Prospección y Vendas)" |
| Última atualização declarada | 2026-09-14 (data de modificação do arquivo: 2026-09-14 12:54 -04:00) |
| SHA-256 | `94544246b3beef79a3f7194d7718ae3b6e33b68dbed341c69165e240ca35acd0` |
| Referências citadas | Livros (Rackham, Keenan, Blount, Ross, Voss, Konrath). **Não disponíveis e não lidos**; nenhuma regra é atribuída a eles além do que o próprio `SKILL.md` resume. |

A ficha registra o SHA-256 do conteúdo efetivamente usado e as versões das adaptações Compass e do gerador. Atualizar a skill não altera textos aprovados: uma nova geração exige nova versão da ficha e aprovação.

## 2. Conteúdo, por módulo (resumo do que o arquivo diz)

| Módulo | Conteúdo do arquivo | Uso no Compass |
| --- | --- | --- |
| 1 — ICP | Volume de compra, decisores, influenciadores, dores, ciclo, termos, objeções; definir ICP pelo que converte. | Orienta aderência e priorização. A atividade "liste 100 clientes atuais" depende de dados da EAG não disponíveis; não vira regra automática. |
| 2 — Modelo EAG (Estrutura, Análise, Gestão) | Mapear quem decide, que dados usam para decidir, como controlam risco e aprovação. | Orienta pesquisa de decisores (Camada 2) e pendências da ficha. Nome coincide com a empresa EAG; tratar como framework da skill. |
| 3 — SPIN | Situação → Problema → Implicação → Need-payoff; "mais perguntas, menos apresentações"; erro clássico: pular para Implicação. | Base das perguntas do primeiro contato e do levantamento de demanda. |
| 4 — Gap Selling | Estado atual, desejado e gap; perguntar sobre o desejado antes de falar em solução. | Base do levantamento de demanda após resposta (tratado por Rogério) e das perguntas de follow-up. |
| 5 — Prospecção Fanática | Foco, atitude, atividade qualificada por ICP; sequência ligação → e-mail 24h → ligação → e-mail 48h → ligação/LinkedIn → encerrar e marcar 3 meses; scripts de ligação. | Estrutura de sequência multitoque e encerramento. Ligações e LinkedIn podem ser tarefas manuais opcionais, sem criar dependência no piloto por e-mail. |
| 6 — Receita Previsível | Pré-qualificação, segmentação por tiers, sequência multitoque (e-mail 1, ligação, e-mail 2, ligação, e-mail 3 de encerramento), handoff SDR→AE. | Sequência de e-mails e mensagem final de encerramento; handoff = resposta vai para Rogério. |
| 7 — Negociação (Voss) | Empatia tática, escuta, âncora, recalibrar escopo. | **Fora da automação.** Aplica-se apenas ao atendimento humano de Rogério; o Compass não negocia (escopo §7). |
| 8 — Vendas complexas | Economic/User/Technical Buyer, coach, PoC, processo de aprovação. | Orienta classificação de papéis dos contatos; cargo ≠ autoridade de compra (escopo §2.2). |
| Checklist antes de cada call | Pesquisa, ICP check, EAG base, SPIN, Gap, objetivo claro, reconvocação. | Vira checklist de revisão da ficha (ver §4). |

## 3. Compatibilidade com a revisão 3

### Compatível

1. Prospecção inicial orientada a **entender a demanda** (SPIN/Gap) — alinhada à revisão 3: a primeira abordagem apresenta a commodity e levanta demanda, sem preço, lote ou oferta específica.
2. Sequência multitoque com mensagem de encerramento — compatível com sequência congelada e follow-ups previamente aprovados.
3. "Pesquisa antes do contato" — compatível com evidências por informação e personalização antes da aprovação.
4. Distinção entre papéis (Economic/Technical/User Buyer) — compatível com cargo ≠ responsabilidade de compra.
5. Medir conexões, respostas e reuniões — compatível com métricas comerciais do piloto (§4.2).
6. Horário preferencial de prospecção de manhã — compatível com a janela de envio no fuso do destinatário (sem torná-lo regra fixa).

### Requer adaptação (regra do Compass prevalece)

| # | Ponto da skill | Conflito | Adaptação |
| --- | --- | --- | --- |
| A1 | Sequências intercalam ligações e mensagens de LinkedIn | Piloto só envia e-mail; LinkedIn sem automação autorizada (T3); ligações não são canal automatizado | Ligações e LinkedIn podem ser tarefas manuais opcionais, sem criar canal obrigatório no piloto. Se previstas, registrar a execução; o piloto automático contém só e-mails. |
| A2 | Intervalos "24h/48h após a ligação" | Intervalos dependem de ligação humana | Intervalos entre e-mails definidos na ficha e congelados. Texto que afirme ligação ou conversa anterior exige evento realizado e documentado; tarefa apenas planejada não comprova contato ocorrido. |
| A3 | Scripts "vi seu perfil em X", "tenho uma ideia" | Personalização pode virar afirmação sem fonte | Toda frase personalizada precisa apontar para uma evidência registrada na ficha. |
| A4 | "Talvez [Colega/Competidor] já esteja ajudando" | Pode insinuar fato não verificado | Proibido citar concorrente ou fornecedor atual do comprador sem evidência. |
| A5 | "Encerre, marque para 3 meses" | Reconvocação automática fora do escopo | Encerramento registra próxima ação sugerida; nova sequência exige **nova ficha e aprovação**. |
| A6 | Módulo 7 (âncora de preço, recalibrar proposta) | Negociação autônoma e preço fora do escopo | Não usado em textos automáticos. |
| A7 | Exemplos de software/SaaS e métricas em US$ | Contexto diferente de commodities | Usar apenas a estrutura dos frameworks; conteúdo vem do catálogo, das evidências e da campanha. |
| A8 | Skill não trata descadastro, LGPD, entregabilidade, idioma | Lacuna | Regras do Compass (supressão, opt-out, janela, limites, idioma da campanha) prevalecem e são checadas pelo revisor. |

**Adaptações adicionais para o Compass:**

- **A9 — Modelos distintos:** “Estrutura, Análise, Gestão” é o framework relatado na skill. Não redefine o formulário EAG de demanda comercial, com produto, especificação, volume, embalagem, destino, prazo, condições, comprador e decisor.
- **A10 — Perfil do destinatário:** consumidor final, trader/distribuidor e perfil desconhecido exigem perguntas próprias. Confirmar compra, uso, revenda ou o responsável correto, sem afirmar consumo ou autoridade ainda não comprovados.
- **A11 — Interrupção prevalece:** encerramento e tarefas manuais não autorizam contato após resposta, descadastro, bloqueio ou pausa. Encerramento é só o passo final aprovado quando a sequência chega ao fim sem interrupção.

O relatório recebido não identifica exigência de lote, preço ou oferta específica na skill para a primeira abordagem. Não foi encontrada contradição que impeça seu uso com as adaptações acima.

## 4. Critérios verificáveis iniciais para o gerador e o revisor de textos

Derivados do arquivo lido; serão refinados na Spec v2.0 e validados com amostras internas.

| ID | Critério | Origem / adaptação |
| --- | --- | --- |
| PV1 | Primeiro e-mail com pergunta curta de Situação/Problema ou encaminhamento ao responsável. Uso para consumidor final, compra/revenda para intermediário, confirmação de perfil se desconhecido; sem presumir consumo. | Módulo 3 + A10 |
| PV2 | O primeiro e-mail não abre com Implicação nem com pitch longo do portfólio. | Módulo 3 ("erro clássico") |
| PV3 | Cada mensagem tem **um objetivo claro** (ex.: confirmar se usa o produto, pedir o contato certo, marcar conversa). | Checklist |
| PV4 | Cada afirmação personalizada tem evidência por informação, URL ou referência interna e data. Contato anterior exige evento realizado; tarefa prevista não basta. | Pesquisa + A2/A3 |
| PV5 | Follow-up com objetivo próprio e pergunta adequada ao perfil, sem inferir dores, volume ou interesse. Texto integral congelado antes da aprovação. | Módulos 4 e 6 + regras Compass |
| PV6 | Encerramento aprovado só é enviado se a sequência chegar ao passo final sem resposta, descadastro, bloqueio ou pausa. Nenhuma despedida para contornar interrupção. | Módulos 5 e 6 + A11 |
| PV7 | Nenhum texto contém preço, lote, estoque, prazo, certificação, pagamento ou concorrente sem dado aprovado. | Adaptações A4, A6 + escopo §2.5 |
| PV8 | Destinatário e argumento coerentes com o papel mapeado (decisor, técnico, usuário), sem afirmar autoridade não confirmada. | Módulos 2 e 8 |

## 5. Situação de T12

**Avançou, não está encerrada.**

- ✅ Leitura e identificação no Windows registradas no relatório recebido (caminho, versão, data, hash).
- ✅ Compatibilidade com a revisão 3 analisada; adaptações A1–A11 registradas; A9–A11 explicitam a compatibilidade com o escopo.
- ✅ Critérios iniciais PV1–PV8 derivados.
- ⏳ Pendente: aprovação desses critérios na Spec v2.0; implementação no gerador/revisor; geração de **amostras internas** e revisão por Rogério antes da primeira ficha do piloto (etapa-limite: antes da primeira ficha/abordagem do piloto).
- Nenhuma abordagem foi gerada ou enviada.

## 6. Encaminhamento para a Spec

T12 tem três marcos: leitura documentada, regras especificadas e implementação validada com amostras internas. O primeiro foi relatado como concluído; os demais seguem pendentes, sem impedir a redação da Spec. Amostras devem cobrir consumidor final, trader, perfil desconhecido e sequência interrompida antes do encerramento. Critérios refinados nesta revisão são propostas de implementação, não mensagens aprovadas.
