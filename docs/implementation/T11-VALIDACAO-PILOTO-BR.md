# T11: preparação da validação do piloto brasileiro (milho GMO, Indiara/GO, 300 km, ligações)

**Data:** 06/10/2026. **Estado:** preparação. **Nada aqui está aprovado.**

**Atualização (06/10/2026):**
- Rogério aprovou o uso individual do Compass como ferramenta pessoal de apoio ao seu trabalho comercial. Finalidade esclarecida em 08/10/2026: apoio à pesquisa, à organização de informações e à preparação da prospecção; não é ferramenta da EAG nem substitui sistemas ou procedimentos da rede (`T11-REVISAO-PILOTO-BR-TELEFONE.md` §16). A T11 **segue não validada**.
- A revisão do bloqueio das ligações manuais no Brasil está em `T11-REVISAO-PILOTO-BR-TELEFONE.md` (proposta). Ela separa decisões operacionais, obrigações legais e exigências da Spec.

**Escopo (atualizado em 06/10/2026):** 13 ligações de nível 0, das unidades aceitas por Rogério:
- lote 1: Cimilho, Cargill Uberlândia, São Martinho Boa Vista e Cargill Bioenergia São Francisco;
- lote de 6 ME/EPP: Rural Forte, Sociagro, Nutrir, Super-Bovi, Rações VR e Ração Ituiutaba;
- grupo 2: Rei do Milho, Caramuru Itumbiara e BRF Rio Verde.

Não inclui e-mail, Alemanha, rastreamento de abertura nem campanha. A versão anterior (só as 4 do lote 1) foi substituída antes do envio, para a validação cobrir todas as ligações.

**Base:**
- Spec vigente: tabela de dependências, R9, R19, R21, R23, R26, R28.7, §6.0.1 e premissas;
- Constituição P7;
- `T11-POLITICA-PROPOSTA.md` (01/10/2026, proposta);
- `EXCLUSAO-PURGA-PLANO.md` §2.

## 1. O que é exigência, o que é proposta e o que é questão jurídica

| # | Item | Tipo | Fonte (requisito ou trecho) | Efeito nas 13 ligações |
|---|---|---|---|---|
| 1 | T11 validada antes de contato real | **Exigência expressa** | Spec, tabela de dependências: "T11 · Compliance pré-envio e política de ciclo de vida · Não validado com responsável competente · **Antes de contatos reais da Etapa 1**" | Bloqueia. A ligação ao comprador é contato real |
| 2 | Tratamento conforme LGPD e "política EAG" | **Exigência expressa** | Constituição P7: "tratados conforme LGPD/GDPR e política EAG" | Exige saber qual é a política da EAG ou se ela existe (questão 13) |
| 3 | Validação jurídica antes da implementação final da exclusão | **Exigência expressa** | R9.1: "validação jurídica antes da implementação final" | A exclusão está publicada e foi testada com dados fictícios; falta a validação |
| 4 | Supressão pseudonimizada, com finalidade, acesso restrito e **retenção** | **Exigência expressa** (o prazo não é fixado) | R9.1.1; R21.1 ("critério de retenção"); P7 ("retenção definida") | O prazo é escolha de Rogério (§3) depois do parecer |
| 5 | Preservar o identificador de supressão na exclusão "conforme a política aprovada em T11" | **Exigência expressa** (depende da política) | R9.1.2 | Idem |
| 6 | Descadastro por qualquer meio, inclusive "contato manual", vale antes do próximo contato | **Exigência expressa** | R21.2, R21.3, R21.6 | Já implementado: oposição dita na ligação vira supressão manual. **Correção (06/10/2026):** a supressão do canal `phone` é registrada, mas **não suspende** a ligação de nível 0 (as tarefas só consultam supressão de e-mail). Ver `T11-REVISAO-PILOTO-BR-TELEFONE.md` §3, item 1. Correção implementada em 06/10/2026 (não publicada) |
| 7 | Descarte comercial não implica conservação indefinida | **Exigência expressa** | R23.4 | Precisa de prazo de retenção dos dados pessoais de quem foi descartado (§3) |
| 8 | Pedido de exclusão avaliado e executado, incluindo índices e referências | **Exigência expressa** | R23.5, R23.6 | Mecanismo existe; falta validar prazo de resposta e alcance (questão 9) |
| 9 | Triagem de sanções antes do contato | **Exigência expressa**, política já decidida | R19.2 item 6 e R19.3; decisão de Rogério de 24/09/2026 (OFAC, CEIS, CNEP; 30 dias) | Feita em 06/10 nas 13: 0 resultados; listas válidas até 24/10/2026. Se a T11 for validada depois disso, reimportar as listas e refazer a triagem antes das ligações |
| 10 | Testes controlados antes de qualquer contato real | Exigência expressa, **aplicação ao telefone a interpretar** | R26.6: "Antes de qualquer contato real, testes controlados DEVEM comprovar envio, recebimento, supressão, pausas…" | O texto fala de canais automáticos. Para ligação manual, pedir confirmação de Rogério; não tratar como bloqueio sem decisão |
| 11 | Retenção do hash de supressão: sem prazo fixo enquanto houver prospecção, revisão anual | **Proposta não aprovada** | T11-POLITICA §2.1 ("Escolha (proposta)") | Nenhum, até decisão |
| 12 | Remoção de supressão só em 3 casos (erro, pedido do titular, ordem de autoridade) | **Proposta não aprovada** | T11-POLITICA §2.3 | Nenhum, até decisão |
| 13 | Quem é o controlador (EAG, Rogério ou ambos) e se a EAG autoriza a prospecção em seu nome por ferramenta pessoal | **Questão jurídica** | T11-POLITICA §3 (perguntas 1–2); fato: a ligação se apresenta "da EAG Agro" | Decide quem responde pelo tratamento |
| 14 | Base legal (hipótese a avaliar, sem validação jurídica: legítimo interesse, LGPD Art. 7 IX e Art. 10), teste de balanceamento e registro de operações (Art. 37) | **Questão jurídica** | T11-POLITICA §2.1 (Interpretação); Guia ANPD (fev/2024) | Condiciona o uso de nomes e cargos de profissionais |
| 15 | Transferência internacional (Cloudflare, Snov) | **Questão jurídica** | T11-POLITICA §3, pergunta 5 (LGPD Art. 33; Res. CD/ANPD 19/2024) | Snov não é usado neste piloto; a Cloudflare é |
| 16 | Prazos de guarda: histórico de remoções, caixa da EAG, backups, diário da ponte | **Questão jurídica + escolha de Rogério** | T11-POLITICA §2.2 ("prazo de prova a definir pelo validador"); EXCLUSAO-PURGA §2 | §3 |
| 17 | Rastreamento de abertura de e-mail | Exigência condicionada a T1 e T11 | R28.7, AT64 | **Não se aplica**: ligação, sem e-mail |
| 18 | E-mail sem consentimento prévio, GDPR Art. 14 e Art. 27, telefone B2B na Alemanha | Questão jurídica **só da Alemanha** | T11-POLITICA §4–§5 | **Não se aplica** ao piloto brasileiro |

**Leitura:**
- O único bloqueio expresso para as ligações é o item 1, que depende das questões 13–16 e das escolhas de retenção (§3).
- As propostas 11 e 12 não bloqueiam enquanto não forem aprovadas. Também não podem ser tratadas como regra vigente.

## 2. Mensagem pronta para o responsável competente da EAG

> **Assunto:** Validação de privacidade (LGPD) para piloto de prospecção por telefone — milho, Goiás/MG
>
> Olá, [nome],
>
> Preciso da sua validação antes de iniciar um piloto pequeno de prospecção comercial em nome da EAG Agro. Nada foi contatado ainda. Peço respostas objetivas às perguntas do final; onde não houver resposta, o piloto não começa.
>
> **1. Finalidade e alcance**
>
> - Identificar quem compra milho em 13 unidades industriais num raio de 300 km de Indiara/GO:
>   - processadoras e usinas: Cimilho (Uberlândia/MG), Cargill (amidos, Uberlândia/MG), São Martinho (Usina Boa Vista, Quirinópolis/GO), Cargill Bioenergia (Usina São Francisco, Quirinópolis/GO), Rei do Milho (Inhumas/GO), Caramuru (Itumbiara/GO);
>   - fábricas de ração: BRF (Rio Verde/GO) e seis fábricas pequenas em Goiás e Minas Gerais (Pontalina, Paraúna, Itaberaí, Goianápolis, Orizona e Ituiutaba).
> - Canal: **somente telefone**, pelos números gerais das empresas: os publicados por elas e, quando não há, o telefone do cadastro público da Receita Federal. Sem e-mail, sem WhatsApp e sem campanha automática.
> - Objetivo da ligação: saber quem cuida da compra de milho e pedir uma conversa de 20–30 min. Sem preço ou oferta na ligação.
>
> **2. Dados utilizados (só profissionais e públicos)**
>
> - Das empresas: CNPJ, endereço, atividade e evidências públicas (cadastro do MAPA, Receita Federal, licenças ambientais, relatórios, sites, notícias), com fonte e data. Também a triagem em listas de sanções (OFAC, CEIS, CNEP), só de empresas.
> - De 6 profissionais: nome, cargo e URL do perfil público no LinkedIn, marcados "a validar". Nenhum e-mail ou telefone pessoal foi coletado ou deduzido.
> - Canais: telefones e e-mails gerais das empresas (publicados por elas ou no cadastro público da Receita). Alguns telefones do cadastro da Receita podem ser de sócios; não são tratados como canal comercial confirmado.
>
> **3. Apresentação em nome da EAG**
>
> - A ligação começa assim: "Aqui é o Rogerio Palhari, da EAG Agro".
> - Uso a caixa `rogeriopalhari@eagagro.com`. Nos e-mails, que hoje estão desligados, a assinatura e o rodapé trazem o nome e o endereço da EAG.
> - Não administro a infraestrutura da EAG.
>
> **4. Como os dados são tratados**
>
> - O Compass é uma ferramenta pessoal minha, hospedada na Cloudflare (conta pessoal; banco D1 e armazenamento R2; acesso protegido por login). Os dados pessoais ficam cifrados e o histórico de auditoria não guarda dados pessoais legíveis.
> - Fornecedores que recebem ou podem receber dados:
>   - Cloudflare (hospedagem);
>   - Hostinger (caixa de e-mail da EAG);
>   - BrasilAPI (consulta de CNPJ, só dados de empresa);
>   - Snov (validação de e-mail): **não usado neste piloto**;
>   - ferramentas de busca e assistente de IA usadas na pesquisa (resultados públicos, nomes e cargos).
>
> **5. Oposição, supressão e exclusão (já existentes)**
>
> - Quem pedir para não ser contatado, por qualquer meio inclusive na ligação, entra numa lista de supressão que guarda só um identificador pseudonimizado (hash), canal, motivo e data. O acesso é restrito ao administrador, e reimportação não remove a supressão.
> - Pedido de exclusão: o Compass elimina os dados abrangidos pela rotina implementada, incluindo dados de contato e determinados textos, mensagens e tarefas. Mantém um identificador pseudonimizado para evitar novo contato e registros residuais de auditoria. Notas livres podem exigir revisão manual. Cópias em backups, na caixa corporativa e nos registros locais têm tratamento separado, ainda pendente de definição.
> - Limitações conhecidas:
>   - a exclusão só foi testada com dados fictícios;
>   - não há prazo de retenção definido;
>   - backups do banco, a "volta no tempo" da Cloudflare, a caixa de e-mail e o diário local da ponte guardam cópias até haver regra;
>   - a política de privacidade da EAG **não foi localizada nas fontes que consultei**: `eagagro.com/politica-de-privacidade` e `/privacidade` retornaram 404 em 01/10/2026. Isso não significa que a EAG não tenha uma.
>
> **6. Perguntas (respostas objetivas, por favor)**
>
> 1. Quem é o controlador destes dados: a EAG, eu, ou ambos?
> 2. A EAG autoriza que eu me apresente "da EAG Agro" nesta prospecção, feita com ferramenta pessoal?
> 3. A EAG tem política de privacidade e encarregado (DPO)? Se sim, onde estão?
> 4. Qual é a base legal adequada? Levanto o legítimo interesse (LGPD Art. 7 IX e Art. 10) como **hipótese a avaliar**, ainda sem validação jurídica. Se for essa, é preciso registrar o teste de balanceamento e a operação (Art. 37)? Quem faz?
> 5. O que devo dizer ao profissional, na ligação ou depois, sobre a origem dos dados e o direito de oposição (Art. 10 §2 e Art. 18)?
> 6. O uso da Cloudflare e de ferramentas de busca e IA fora do Brasil é aceitável (Art. 33)? Há condição?
> 7. Por quanto tempo a EAG exige ou permite guardar:
>    - a lista de supressão (hash);
>    - o histórico de remoções;
>    - mensagens na caixa da EAG;
>    - backups?
> 8. Quem atende pedido de exclusão que envolva a caixa da EAG?
> 9. Em quanto tempo devo responder a um pedido de exclusão no Brasil?
>
> Posso enviar o detalhamento técnico se for útil. Obrigado,
> Rogerio Palhari

**Registro da resposta:** quando a EAG responder, registrar só as decisões expressamente validadas, com responsável, data e alcance de cada uma. Uma resposta parcial não conclui a T11; o que não for respondido continua pendente.

**Respostas da EAG** (preencher só com o que for expressamente validado; "pendente" até lá):

| # | Pergunta | Situação | Resposta validada | Responsável | Data | Alcance |
|---|---|---|---|---|---|---|
| 1 | Controlador | pendente | — | — | — | — |
| 2 | Apresentação "da EAG Agro" com ferramenta pessoal | pendente | — | — | — | — |
| 3 | Política de privacidade e encarregado (DPO) | pendente | — | — | — | — |
| 4 | Base legal, balanceamento e registro (Art. 37) | pendente | — | — | — | — |
| 5 | O que informar ao profissional (origem e oposição) | pendente | — | — | — | — |
| 6 | Cloudflare e ferramentas fora do Brasil (Art. 33) | pendente | — | — | — | — |
| 7 | Prazos de guarda (supressão, remoções, caixa, backups) | pendente | — | — | — | — |
| 8 | Quem atende exclusão que envolve a caixa da EAG | pendente | — | — | — | — |
| 9 | Prazo de resposta a pedido de exclusão | pendente | — | — | — | — |

- **Encaminhamento:** feito por Rogério (data e destinatário a registrar).
- **Como o Compass muda depois:** só quando as respostas cobrirem o item 1 (§1). As ligações seguem com a linha "ANTES DE LIGAR" até lá.

## 3. Retenção: opções para as decisões de Rogério (nenhuma escolhida)

O parecer da EAG (perguntas 7–9) pode restringir ou impor prazos; as opções abaixo valem dentro do que ele permitir.

| Decisão | Opção | Efeito | Fundamento |
|---|---|---|---|
| **A. Hash da lista de supressão** | A1. Sem prazo fixo enquanto houver prospecção no canal, com revisão registrada a cada 12 meses | Ninguém volta a ser contatado por esquecimento; exige revisão anual | Proposta T11 §2.1; GDPR/LGPD admitem guardar o mínimo para respeitar a oposição; o validador confirma a base |
| | A2. Prazo fixo (ex.: 5 anos após a última atividade de prospecção no canal) | Encerra a guarda automaticamente; depois, risco de recontato | LGPD Art. 15–16 (término do tratamento); o número é escolha |
| | A3. Até o fim definitivo da prospecção no canal, e então eliminar | Mínima guarda; não protege em retomada futura | Proposta T11 §2.1 (último item) |
| **B. Histórico de remoções de supressão** | B1. Mesmo prazo da lista, mais o prazo de prova que o validador indicar | Prova de cada remoção enquanto ela importa | T11 §2.2; LGPD Art. 6 X e Art. 37 |
| | B2. Prazo próprio, sem vínculo com a lista | Mais simples; pode apagar prova ainda necessária | Escolha |
| **C. Dados de empresa descartada** (pessoas "a validar", notas) | C1. Eliminar os dados pessoais na hora do descarte, mantendo empresa, motivo e data | Atende R23.4 sem prazo a controlar | R23.4 ("descarte não implica conservação indefinida") |
| | C2. Revisão periódica (ex.: semestral) e eliminação dos descartados há mais de N meses | Permite reconsiderar; exige rotina | R23.4 |
| **D. Exportações locais do D1** (`eag-compass-backups`) | D1. Guardar só até a migração seguinte confirmada e apagar a anterior | Menos cópias com dados pessoais; perde ponto de volta antigo | EXCLUSAO-PURGA §2; P7 |
| | D2. Guardar N meses (ex.: 3) e apagar | Ponto de volta por mais tempo; mais cópias | Escolha |
| **E. Diário local da ponte** (`journal.sqlite`) | E1. Guardar enquanto houver envio possível, mais 30 dias | Garante não reenviar após queda | EXCLUSAO-PURGA §2 (função anti-reenvio) |
| | E2. Rotação curta (ex.: 90 dias de entradas concluídas) | Menos dados; ainda cobre quedas recentes | Escolha |
| **F. Registro da ponte** (`ponte.log`, sem endereço nem conteúdo) | F1. Rotação mensal, guardar 3 arquivos | Diagnóstico suficiente | EXCLUSAO-PURGA §2 |
| **G. Caixa da EAG** | — | **Não é decisão de Rogério**: a caixa é da EAG (pergunta 7) | EXCLUSAO-PURGA §2 |
| **H. Time Travel do D1** | — | Limite técnico da plataforma: um ponto não pode ser apagado; aceitar e informar (EXCLUSAO-PURGA §3) | Questão ao validador |

## 4. Telefone da São Martinho Boa Vista (pendência resolvida)

**Telefone oficial:** **(64) 3615-9700**.

- Fonte: página oficial "Negócios & Unidades" de saomartinho.com.br, consultada em 06/10/2026: "Usina Boa Vista, Rodovia GO 164, Km 131,5, Zona Rural, Fazenda Boa Vista, Quirinópolis/GO · Tel. (64) 3615-9700 · usinaboavista@saomartinho.com.br".
- O mesmo número aparece na lista da Prefeitura de Quirinópolis e no CONSECANA.
- É o **telefone geral da unidade**, não um canal de compras.
- A mesma página traz a coordenada oficial (-18,5477; -50,4326): **159,3 km** em linha reta do centroide de Indiara (antes: 151,4 km pelo centroide de Quirinópolis).

**Compass:** tarefa corrigida em produção em 06/10/2026 pela nova edição de tarefas (Worker 9866c2c3): telefone como canal geral da unidade, com fonte e data, e distância de 159,3 km. Mesmo id, revisão 2, histórico registrado e pendência T11 mantida.

## 5. Estado das 13 ligações

- Aguardando T11 (item 1). Próximo passo: Rogério encaminha a mensagem do §2 ao responsável competente da EAG; as respostas são registradas por pergunta, conforme a regra do §2.
- Triagem de sanções das 13: 0 correspondências; listas válidas até 24/10/2026.
- Nenhum contato comercial, Snov, campanha ou mudança de regra.
