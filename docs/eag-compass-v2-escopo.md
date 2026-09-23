# EAG Compass v2.0 — Documento de Escopo (Fase 1)

**Data:** 2026-09-22  
**Revisão documental:** 3 — consolidação das orientações mais recentes de Rogério  
**Status:** corrigido para revisão final; fechamento formal da Fase 1 ainda não registrado  
**Referência histórica:** Constituição v1.3 e Especificação v1.3, preservadas. A Spec e a Constituição v2.0 serão redigidas na Fase 3.  
**Código-base:** repositório EAG Compass 0.3.1. O resultado de 14/14 testes em 2026-09-22 foi informado na leitura anterior do projeto; não foi reexecutado nesta revisão documental.  
**Status associado:** [eag-compass-planejamento-status.md](eag-compass-planejamento-status.md).

---

## 1. Problema e objetivo

A EAG precisa encontrar empresas compradoras das commodities que comercializa, no Brasil e no exterior, e conduzir cada empresa da descoberta até uma oportunidade comercial. A prospecção inicial apresenta a commodity e procura entender a demanda do comprador. Preço, lote, estoque, cotação vigente e cadastro completo de fornecedor não são requisitos para buscar empresas, aprovar a abordagem ou enviar a sequência inicial.

O Compass procura **compradores**. A localização do fornecedor já conhecido serve como referência logística no Radar Nacional; descobrir ou captar fornecedores não faz parte deste trabalho.

**Nacional:** Rogério informa commodity, cidade/UF onde já possui fornecedor e raio em quilômetros. A plataforma pesquisa potenciais compradores próximos, apresenta as empresas encontradas e permite aprovar a prospecção individualmente.

**Internacional:** Rogério informa somente o país. A plataforma identifica quais commodities agrícolas o país comprou do Brasil no período analisado; Rogério escolhe uma ou mais commodities e então autoriza a pesquisa de empresas compradoras naquele país.

**Público-alvo comercial:**

1. Prioridade para pequenas e médias empresas consumidoras finais: fábricas, processadoras, indústrias e outras operações que utilizem a commodity.
2. Traders, distribuidores e intermediários permanecem nos resultados, classificados e com prioridade secundária. O simples fato de serem intermediários não gera bloqueio.
3. Porte desconhecido aparece como pendência. Empresas maiores podem permanecer nos resultados quando houver aderência e canal comercial identificado.
4. Restrições comerciais já confirmadas para o produto, mercado ou origem devem ser respeitadas. Quando houver uma oferta específica vinculada, aplicam-se também as condições do respectivo fornecedor, inclusive exigência de comprador final.

**Resultado esperado:** conhecer as empresas encontradas, validar cada destinatário e sequência, acompanhar a prospecção aprovada e assumir pessoalmente o atendimento quando houver resposta. A proposta comercial específica será preparada com dados confirmados, após o levantamento da demanda.

---

## 2. Decisões já tomadas

### 2.1 Produto e usuários

| ID | Decisão |
| --- | --- |
| D1 | Nome do produto: **EAG Compass v2.0**. Documentação v1.3 preservada como referência histórica. |
| D2 | Rogério é o usuário principal. Permanecem quatro perfis internos: Administrador, Gestor Comercial, Vendedor/Analista e Auditor/Visualizador. Sem usuários externos. |
| D3 | Dois dashboards, Nacional e Internacional, compartilham base comercial, aprovação, execução e acompanhamento. |
| D4 | Os artefatos do planejamento ficam em `eag-compass/docs/`. |
| D5 | Hospedagem definida na Cloudflare. Configuração da aplicação, autenticação e recursos de produção **a validar** na Etapa 0; login do Wrangler não comprova essa configuração. |
| D6 | E-mail remetente: `rogeriopalhari@eagagro.com`. Provedor, envio e recebimento ainda dependem de teste. WhatsApp Business entra após validação da integração oficial e das permissões aplicáveis. |
| D7 | Prospecção inicial por commodity. Oferta específica, lote, preço e fornecedor completamente cadastrado não são obrigatórios para aprovar ou iniciar a abordagem. |
| D8 | Abordagens e follow-ups obedecem à skill **`/prospeccao-vendas`**, com conteúdo e versão efetivamente lidos e registrados antes da elaboração dos textos. |

### 2.2 Base compartilhada (entidades)

**Distinção obrigatória:** produto é a commodity do catálogo; campanha é o esforço de prospecção daquele produto; demanda é a necessidade do comprador; oferta específica é uma proposta comercial concreta, opcional na prospecção inicial.

| Entidade | Regras |
| --- | --- |
| **Produto** | Catálogo EAG com origem e data: site oficial ou informação do responsável comercial. Códigos NCM/HS vinculados à especificação e versão da classificação. Código não confirmado não impede o cadastro, mas não pode ser usado como correspondência comprovada no histórico comercial. |
| **Origem de prospecção** | Commodity e cidade/UF do fornecedor já conhecido. Guarda o ponto geográfico adotado e sua precisão. Endereço ou coordenadas podem refinar o ponto, sem obrigar cadastro completo de fornecedor. |
| **Fornecedor** | Parceiro já conhecido ou posteriormente vinculado pelo usuário a uma negociação. Seu cadastro detalhado é opcional na prospecção inicial. Não há motor de descoberta de fornecedores neste escopo. |
| **Oferta específica** (versionada) | Produto, fornecedor quando identificado, especificação, disponibilidade, mínimo, condições, exigência de comprador final e validade. Só é obrigatória quando a abordagem ou negociação utiliza aquela proposta concreta. Dados não confirmados não viram promessa. |
| **Campanha** | Vinculada a uma commodity, mercado e contexto de busca; inclui origem/raio no Nacional ou país/análise no Internacional, público, idioma, duração/revisão e sequência. Pode existir sem oferta específica. Uma oferta específica pode ser relacionada a várias campanhas, sem se tornar obrigatória para todas. |
| **Empresa** | Registro único por empresa; CNPJ raiz no Brasil e identificador legal acompanhado de tipo e jurisdição no exterior. Porte com fonte e data. Ausência de identificador gera pendência de deduplicação, sem inventar cadastro. |
| **Unidade** | Estabelecimento ligado à empresa. Endereço, identificador quando disponível, função — unidade consumidora, recebimento ou sede — e precisão geográfica separados. |
| **Perfil comprador** | Por **empresa + unidade + produto**. Quatro classes: consumidor final confirmado; possível consumidor final; trader/distribuidor; perfil não confirmado. Cada classificação tem fundamento. |
| **Evidência** | Por informação: fonte, trecho ou referência comprobatória, data do fato quando conhecida, data da consulta e responsável. E-mail, documento ou conversa podem usar referência interna protegida. No Internacional, indica se sustenta importação do Brasil, compra da commodity ou consumo como matéria-prima. |
| **Contato / Decisor** | Nome, cargo, empresa/unidade, canal, URL do perfil quando disponível, fonte, data e grau de confirmação. Cargo identificado e responsabilidade de compra confirmada são informações diferentes. |
| **Lista de supressão** | Controle independente do cadastro de contatos. Usa identificadores derivados para reconhecer endereços, canal, motivo, data, alcance e critérios de retenção. Identificadores derivados são tratados como pseudonimizados; e-mail/telefone legíveis não são chamados de pseudônimos. Acesso restrito; reimportações não removem supressões. |
| **Busca / Análise de país** | Parâmetros, fontes, período, status, cobertura, candidatos, custo e tempo. No Internacional, preserva a análise do país, a escolha posterior das commodities e as buscas de empresas decorrentes. |
| **Ficha de aprovação** (versionada) | Empresa + campanha + commodity + destinatários + canais + fuso + textos finais + intervalos e regras da sequência. Evidências, pendências e referência à versão da skill usada ficam registradas. A oferta específica é referência opcional. |
| **Sequência / Envio** | Passos com canal e destinatário definidos, identificador estável para impedir duplicação e estados informados pelo provedor. Reaprovação não apaga etapas já enviadas. |
| **Demanda / Oportunidade** | Necessidade comercial do comprador: produto, especificação, volume, embalagem, destino, data, recorrência e condições pretendidas. Extrações de respostas são sugestões até confirmação humana. |
| **Linha do tempo** | Apresenta ações, mensagens, respostas, evidências, pausas, decisões e próximas tarefas da empresa, com fonte/canal e data. |
| **Auditoria (`audit_log`)** | Registra eventos e referências, apenas por inserção, sem copiar conteúdo pessoal para o histórico imutável. Identificadores vinculáveis também seguem controles de acesso e retenção aplicáveis. |

**Catálogo a consolidar na Fase 2B:** soja, milho, café, açúcar, etanol, álcool industrial, trigo, sorgo, farelos, óleos vegetais e lecitina de soja, com variantes e fontes verificadas. Soja, café e etanol integram o escopo nacional. DDGS, CGF, CGM, UCO e CSO têm como origem o portfólio informado pelo responsável comercial; especificações, disponibilidade e definição comercial de siglas ainda precisam ser confirmadas. Estar no catálogo não significa haver lote ou preço disponível.

### 2.3 Scores e qualificação

- Preservar os três scores — **Potential, Confidence e Risk** — e os indicadores separados **Completude e Risk Coverage**. Reutilizar o mecanismo existente onde compatível, com regras versionadas por mercado na Spec v2.0.
- O gate precisa ser revisado: não conservar o bloqueio genérico de intermediários do AT12 nem exigir evidência de importação para compradores nacionais.
- O pipeline começa na descoberta. Requisitos para autorizar o primeiro contato são separados dos critérios para qualificar uma oportunidade e das verificações de uma proposta comercial concreta.
- Falta de demanda confirmada, lote, estoque, preço ou oferta específica não bloqueia, por si só, a prospecção institucional da commodity. Dados ausentes permanecem desconhecidos e reduzem cobertura; não devem produzir certeza artificial.
- Exigências de comprador final e mínimos são aplicados conforme condições comerciais confirmadas do contexto e, quando vinculada, da oferta específica. Não universalizar uma condição de determinado fornecedor para todo o catálogo.
- Aprovação para contato não comprova compra nem consumo. Interesse manifestado abre atendimento comercial; qualificação depende dos critérios próprios.
- Manter qualificação consultiva e rastreabilidade da v1.3. A relação entre formulário EAG, SPIN/Gap e as instruções reais da `/prospeccao-vendas` será explicitada na Spec, sem atribuir à skill regras não lidas.

### 2.4 Descoberta e comprovação

#### Arquitetura comum

1. **Camada 1:** fontes estruturadas geram candidatos. No Nacional, cadastros de estabelecimentos, atividades e endereços. No Internacional, análise do fluxo Brasil–país e depois fontes de empresas no país escolhido.
2. **Camada 2:** pesquisa com evidências verifica atividade, sinais de uso/compra, porte, perfil e possíveis decisores. Cada afirmação possui fonte; ausências ficam como pendências.
3. Bases pagas podem ser incorporadas por adaptadores após comparação de custo, cobertura e qualidade. Cadastro ou CNAE compatível é indício, não prova de consumo.
4. Evidência nominal ou confirmação direta precisa identificar a empresa e a informação confirmada. Aprovar a abordagem não substitui essa confirmação.

#### Dashboard Nacional — Radar de Compradores

1. Entrada obrigatória: **commodity + cidade/UF do fornecedor já conhecido + raio em km**.
2. A cidade constitui o centro de referência do radar. Registrar o ponto adotado no mapa; endereço ou coordenadas podem refiná-lo. O ponto representativo da cidade deve aparecer como referência aproximada, não como endereço exato do fornecedor.
3. Pesquisar compradores próximos. A unidade consumidora ou de recebimento é a localização preferencial para calcular a distância; sede, coordenadas aproximadas ou localização pendente são explicitadas.
4. Aplicar o raio geográfico ao ponto de referência. Distância rodoviária, quando disponível, aparece separada. Sem localização suficiente, a empresa fica pendente de confirmação geográfica, sem ser apresentada como comprovadamente dentro do raio.
5. Exibir **mapa + lista** de todos os candidatos encontrados nas fontes consultadas, com paginação quando necessário. Mostrar fontes, cobertura, pendências, falhas e eventual limite atingido; não declarar cobertura de todas as empresas existentes.
6. Ordenar por aderência, priorizando PMEs consumidoras finais. Traders e distribuidores continuam classificados e visíveis, respeitando filtros e condições confirmadas.
7. Cada resultado apresenta empresa/unidade, atividade, localização, distância, porte com fonte, perfil, evidências, decisores, contatos, scores e próxima ação.
8. Rogério revisa cada empresa e aprova sua ficha antes de iniciar a sequência. **Não se exige oferta vigente, preço, lote ou cadastro completo do fornecedor para essa aprovação.**

Os 5–10 participantes do piloto limitam o teste de envio; não limitam a quantidade de empresas que o radar pode descobrir e apresentar.

#### Dashboard Internacional — País Primeiro

1. A entrada inicial é **somente o país-alvo**, por exemplo “Bélgica”. Não exigir commodity nem NCM antes da análise. O exemplo não constitui afirmação de compra real pela Bélgica.
2. Consultar o histórico de **exportações de commodities agrícolas do Brasil para o país escolhido**, em período padrão explícito e ajustável. O intervalo e a definição de commodities agrícolas serão documentados na pesquisa técnica.
3. Exibir as commodities com compra identificada, códigos e descrições NCM/HS, volume e unidade, valor e moeda, período, última ocorrência disponível, fonte e atualização. Destacar correspondência com o portfólio EAG sem restringir silenciosamente o panorama a açúcar/café ou ao catálogo interno.
4. Não inferir variedade, qualidade ou especificação técnica que o código comercial não distingue. Ausência de código confirmado no catálogo não deve impedir a análise geral do país.
5. Usar estados distintos: **compra identificada**, **nenhum registro no período** e **dados indisponíveis**. Consulta incompleta ou indisponível nunca é interpretada como ausência de compra.
6. Após visualizar o resultado, Rogério seleciona **uma ou mais commodities** e autoriza a pesquisa de compradores. Registrar a seleção e a análise que a fundamentou; organizar a execução em campanhas por commodity. Produto fora do portfólio confirmado exige validação comercial antes da abordagem.
7. Somente após essa seleção executar a descoberta de empresas no país, com as duas camadas de pesquisa. Priorizar consumidores finais, mantendo traders classificados.
8. Registrar separadamente as condições empresariais: **importa do Brasil**, **compra a commodity**, **consome como matéria-prima**. O dado agregado do país não comprova qualquer dessas condições para uma empresa específica.
9. Rogério valida cada empresa, destinatários, canais e sequência antes do contato. A pesquisa de empresas também não exige lote, preço ou cotação prévia.

#### LinkedIn e decisores

Conectar a conta profissional de Rogério somente por modalidades oficialmente autorizadas e conforme recursos disponíveis, a verificar em T3. Não solicitar senha nem cookies de sessão. Na ausência de capacidade autorizada de pesquisa/envio, oferecer pesquisa guiada, registro humano do perfil e mensagem preparada para envio manual. Registrar a execução manual na linha do tempo. Responsabilidade de compra permanece pendente quando só há identificação de cargo.

### 2.5 Aprovação e execução

- **Triagem:** revisar, pedir complementação, adiar ou descartar com motivo; registro no pipeline desde a descoberta.
- **Ficha inicial:** empresa, campanha, commodity, contexto geográfico, evidências, pendências, destinatários, canais, fuso confirmado e textos finais de toda a sequência. Não exige oferta específica. Ações: aprovar, complementar, adiar ou descartar.
- **Metodologia:** textos iniciais e follow-ups são preparados segundo a `/prospeccao-vendas`, com rastreabilidade da versão lida e das fontes utilizadas. Regras detalhadas no §2.11.
- **Alcance da aprovação:** autoriza a ficha versionada para aquela empresa, campanha, commodity, destinatários, canais e sequência. Follow-ups previstos dispensam nova aprovação.
- **Textos congelados:** personalização ocorre antes da aprovação. Mudança em texto, destinatário, canal, intervalo ou condição aprovada gera nova versão e nova aprovação. Nenhuma informação sobre preço, estoque, certificação, quantidade disponível, prazo ou pagamento é inventada. Na prospecção geral, esses dados não são obrigatórios e não são prometidos.
- **Conferência imediatamente antes de cada disparo:** supressão; pausas; aprovação vigente; correspondência do destinatário, canal, texto e versão; campanha e commodity habilitadas no contexto; elegibilidade comercial e bloqueios de compliance aplicáveis; fuso, janela, limite diário e identificação do envio para evitar duplicação. Versão e validade de oferta específica só são verificadas **quando ela estiver vinculada àquela abordagem**.
- **Compliance indisponível:** envio aguarda uma verificação válida ou alternativa prevista na política aprovada. Indisponibilidade não equivale a liberação. Preservar as regras de sanções aprovadas: similaridade de nome sozinha não gera bloqueio confirmado.
- **Janela:** horário comercial no fuso confirmado do destinatário. Fuso pendente impede ativação até definição. Duração e revisão da campanha são controles próprios, distintos da validade de uma cotação.
- **Entrega/falha:** registrar somente o estado efetivamente informado pelo provedor. Aceite pelo provedor não é comprovação de leitura ou de entrega final.
- **Resposta:** evento separado da entrega. Na prospecção geral, suspende os contatos automáticos da **mesma empresa para a mesma commodity**, em todas as campanhas, canais e decisores relacionados, e abre tarefa comercial para Rogério. Essa regra substitui a antiga dependência de uma oferta obrigatória. Respostas relativas a proposta específica também pausam as sequências vinculadas à proposta.
- **Extração da resposta:** informações de demanda aparecem como sugestões acompanhadas da mensagem de origem; confirmação humana é necessária. Não há resposta automática ao comprador.
- **Descadastro:** supressão alcança os canais/endereço comprovadamente vinculados à pessoa, em campanhas e propostas, respeitando a política aprovada. Não inferir identidade pelo nome. Demais destinatários da empresa ficam condicionados a nova aprovação com o aviso do descadastro visível.
- **Falha permanente:** bloquear o endereço afetado; não trocar automaticamente de canal fora da autorização.
- **Interesse/demanda:** Rogério assume o contato, confirma a necessidade e aplica o gate de qualificação. Oferta específica e cotação são preparadas quando necessárias, com condições reais confirmadas; não há negociação ou fechamento autônomos.

### 2.6 Mudanças de campanha, commodity e oferta específica

| Mudança | Efeito |
| --- | --- |
| Texto, destinatário, canal, intervalo ou condição aprovada | Suspender os passos afetados, criar nova versão da ficha e exigir nova aprovação. Preservar histórico e envios concluídos. |
| Suspensão da comercialização de uma commodity ou da atuação em determinada origem/mercado | Pausar as campanhas correspondentes e alertar Rogério. Retomar somente após confirmação do contexto comercial e das fichas afetadas. |
| Alteração de cidade de origem, produto, país ou contexto que fundamentou a aprovação | Reavaliar elegibilidade, evidências e textos; nova aprovação das fichas afetadas antes da retomada. |
| Fim da duração ou revisão vencida da campanha, conforme regra configurada | Pausar a execução para revisão da campanha. Não exigir uma cotação para renovar uma campanha geral. |
| Oferta específica vinculada alterada ou vencida | Pausar apenas as campanhas/sequências que utilizam essa oferta. Mostrar diferenças, verificar elegibilidade e exigir nova aprovação. |
| Alteração de anotação interna sem efeito no conteúdo ou na elegibilidade | Registrar edição; não invalidar a aprovação comercial por si só. |

Uma campanha geral da commodity não depende de validade de lote ou preço que nunca foi vinculado a ela. Uma proposta específica não pode continuar sendo usada após mudar ou vencer apenas por estar dentro de uma campanha geral.

Retomadas continuam dos passos pendentes. Não reenviar mensagens já aceitas pelo provedor; quando o resultado do envio for indeterminado, reconciliar antes de tentar novamente. Uma pausa não deve ser exibida como cancelamento de mensagem já enviada.

### 2.7 Pausas

Pausas por empresa, campanha, commodity/contexto, operação inteira e oferta específica vinculada. Pausar uma campanha não pausa automaticamente campanhas independentes. Respostas e mudanças comerciais seguem os alcances definidos nos §§2.5–2.6. Toda retomada reexecuta as verificações de envio e preserva as etapas concluídas.

### 2.8 Ciclo de vida do dado

| Situação | Regra |
| --- | --- |
| Empresa repetida em buscas | Reutilizar cadastro e acrescentar unidades, produtos, evidências e contextos de busca. Não duplicar por nome semelhante nem fundir sem identificação suficiente. |
| Mesmo destinatário em campanhas distintas | No máximo uma sequência ativa por destinatário comprovadamente identificado. A seguinte fica em espera e passa novamente pelas verificações de ativação; não combinar textos sem aprovação. |
| Aprovação, disparo ou importação repetidos | Não gerar envio duplicado. Reaprovação preserva a identidade das etapas já concluídas. |
| Edição simultânea | Detectar conflito na segunda gravação, sem sobrescrever silenciosamente. |
| Descarte comercial | Manter motivo e histórico necessário, aplicando a política de retenção aos dados pessoais. Descarte não significa conservação indefinida. |
| Pedido de exclusão | Avaliar validade e aplicabilidade. Eliminar ou conservar dados conforme política aprovada, incluindo conteúdo, índices e referências afetados. Identificadores de supressão continuam sujeitos a finalidade, acesso e retenção; não são automaticamente anônimos. |
| Reimportação de contatos | Consultar supressões e estados anteriores; não reativar destinatários bloqueados nem apagar pausas ou respostas. |

### 2.9 Visibilidade em cada dashboard

Mostrar buscas em andamento/concluídas, fontes consultadas, cobertura e falhas; empresas e unidades encontradas; perfis compradores; pendências; aprovações; mensagens programadas, enviadas, respondidas e falhas; próximas ações; demandas e oportunidades qualificadas. No Nacional, mapa e distâncias; no Internacional, análise do país e seleção das commodities que originou cada busca.

Cada empresa tem linha do tempo. Distinguir dados reais, sugestões, informações não confirmadas e demonstração. Exibir claramente pausas e seu motivo; oferecer controles de pausa por empresa, campanha e operação.

### 2.10 OpenClaw Autopilot

- O Compass substitui os módulos de **prospecção e envio** do OpenClaw.
- Inventariar contatos, históricos, campanhas, pendências, respostas e descadastros; importar supressões antes do piloto.
- Antes do primeiro envio do Compass, retirar da execução do OpenClaw as empresas/campanhas transferidas. O restante pode continuar até a migração completa.
- Reconciliar etapas já enviadas, respostas, pausas e supressões. Contato anterior não representa proibição permanente de uma nova campanha aprovada.
- Desativar os módulos substituídos após validação e reconciliação. Outras funções precisam ter destino definido antes de qualquer desligamento integral.

### 2.11 Metodologia obrigatória — `/prospeccao-vendas`

Esta exigência foi acrescentada expressamente por Rogério e se aplica aos dois mercados, a todos os canais, aos textos de apresentação e aos follow-ups.

1. Localizar e ler o `SKILL.md` real da `/prospeccao-vendas` e as referências necessárias no ambiente do projeto antes de elaborar abordagens. Registrar origem, versão ou identificação do conteúdo lido e data.
2. Transformar suas instruções aplicáveis em critérios verificáveis para o gerador e o revisor dos textos, respeitando o briefing, a commodity, o perfil comprador, as evidências e o idioma.
3. Gerar e revisar os textos **antes da aprovação humana**. A ficha mostra os textos finais e a referência da skill utilizada; a execução envia apenas a versão congelada.
4. Atualização da skill não reescreve mensagens aprovadas. Eventual adequação de uma sequência exige nova versão e aprovação; conflito identificado impede novo envio até revisão.
5. Não atribuir à skill frameworks, regras ou conteúdo que não tenham sido lidos. A skill não substitui autorização comercial, confirmação de fatos ou permissões dos canais.
6. Nesta revisão documental, o conteúdo real da skill não estava disponível entre os arquivos/skills acessíveis. A obrigação foi incorporada; a conformidade dos textos ainda precisa ser verificada em T12. Nenhuma abordagem foi gerada ou enviada nesta revisão.

---

## 3. Etapas

As **fases** organizam o planejamento; as **etapas** abaixo organizam a futura implantação. Etapa planejada não significa integração já concluída.

| Etapa | Conteúdo | Contato externo |
| --- | --- | --- |
| **0 — Fundação** | Base compartilhada, catálogo com fontes, contexto de origem, fichas por commodity e supressão; provisionamento/configuração Cloudflare e autenticação a validar; e-mail conectado e testado com endereços internos; inventário OpenClaw; importação de supressões; leitura e registro da `/prospeccao-vendas`. | Sem prospecção externa. |
| **1 — Piloto Nacional** | Uma commodity comercializada pela EAG, cidade/UF onde Rogério já possui fornecedor e raio ajustável. Mostrar todos os candidatos encontrados nas fontes consultadas. Aprovar **5–10 empresas reais para o teste de envio**, somente por e-mail. Não exigir lote, preço, cotação vigente ou cadastro completo do fornecedor. Transferir essas campanhas do OpenClaw antes de disparar. | E-mail, após aprovação individual e testes internos. |
| **2 — Validação e ajuste** | Medir rendimento e custos; decidir sobre bases pagas. WhatsApp somente com integração oficial validada, permissão do destinatário registrada e regras de conteúdo/modelos atendidas. Caso contrário, adiar o canal sem bloquear as demais etapas. | E-mail; WhatsApp condicional. |
| **3 — Dashboard Internacional** | País como única entrada inicial, histórico agrícola Brasil–destino, escolha posterior de commodities e pesquisa de empresas. Piloto com um país e poucas empresas aprovadas, reutilizando motor comum. | Canais habilitados e autorizados. |
| **4 — Ampliação de volume** | Ampliar commodities, cidades e países após medir custo e qualidade; calibrar limites; concluir migração e desligamento delimitado do OpenClaw. | Conforme limites e aprovações. |

---

## 4. Critérios de aceite técnico e métricas comerciais

### 4.1 Aceite técnico

Preservam-se os seis critérios originais, detalhados para o modelo corrigido:

1. **Nenhuma mensagem fora da sequência aprovada:** texto, destinatário, canal, fuso e versão conferidos; elaboração/revisão segundo `/prospeccao-vendas` rastreável. A sequência geral pode ser aprovada e executada sem oferta específica.
2. **Nenhuma duplicidade:** aprovação repetida, reexecução e reaprovação não repetem etapas já enviadas; estado de envio incerto exige reconciliação.
3. **Histórico completo:** empresa, unidade/produto, origem da busca, evidências, campanhas, aprovação, mensagens, eventos, pausas e próxima ação rastreáveis.
4. **Resposta e oportunidade em testes controlados:** resposta suspende os contatos da empresa para a commodity relacionada, gera tarefa e sugestões com fonte; oportunidade é criada com confirmação humana e gate próprio.
5. **Pausas e supressão efetivas:** bloqueiam o próximo envio agendado; oferta específica só participa da validação quando vinculada, enquanto campanha/commodity e compliance sempre seguem as regras aplicáveis.
6. **Fluxos executáveis:** Nacional com commodity, cidade do fornecedor e raio, sem procura de fornecedores nem obrigação de lote; Internacional com país primeiro, lista de commodities agrícolas compradas do Brasil e pesquisa empresarial somente depois da seleção do usuário. A ficha aprovada habilita contato, recebimento de resposta e qualificação.

Aplicar os critérios conforme a etapa habilitada; o piloto nacional não depende de o módulo internacional já estar implementado. Antes de qualquer contato real, testar envio, recebimento de respostas, supressão, pausas, deduplicação e aplicação da metodologia com endereços internos/controlados.

### 4.2 Métricas comerciais do piloto

- Empresas encontradas, unidades geolocalizadas e resultados comprovadamente dentro do raio.
- Fontes cobertas, pendências de localização e limites/falhas de pesquisa.
- Evidências válidas e decisores identificados por empresa.
- Tempo e custo por empresa pesquisada.
- Empresas aprovadas para contato, entregas informadas, falhas, taxa e tempo de resposta.
- Demandas confirmadas e oportunidades qualificadas.

Respostas ou oportunidades no piloto real são resultados a medir, sem promessa de conversão e sem bloquear por si só o aceite técnico. O funcionamento das transições é demonstrado em testes controlados. Métricas orientam a decisão sobre bases pagas e ampliação; a amostra de 5–10 empresas é um piloto operacional.

---

## 5. Dependências técnicas ainda não validadas

| ID | Dependência | Verificação necessária | Etapa-limite |
| --- | --- | --- | --- |
| T1 | E-mail `eagagro.com` | Provedor, conexão autorizada, envio, estados de entrega/falha, recebimento e correlação de respostas; SPF/DKIM/DMARC. | Etapa 0, antes do piloto externo. |
| T2 | WhatsApp Business | API oficial, permissão do destinatário com registro, modelos aprovados quando exigidos, regras de conteúdo/envio, janelas e custos. | Etapa 2, antes de habilitar o canal. |
| T3 | LinkedIn | Capacidades oficialmente autorizadas e conexão da conta profissional; alternativa assistida documentada. | Etapa 1; automação apenas após validação específica. |
| T4 | Empresas no Brasil | Cadastros por estabelecimento, atividades e endereço, identificação, atualização, direitos de uso, cobertura e custos. | Etapa 1. |
| T5 | Geocodificação e mapas | Ponto de referência da cidade, precisão por endereço/unidade, cálculo do raio, mapa, limites e custos. Distância rodoviária é opcional. | Etapa 1. |
| T6 | Comércio Brasil–país | API ou importação oficial verificadas; classificação de commodities agrícolas, NCM/HS, período padrão ajustável, códigos do país, unidades, moeda, atualização e tratamento de dados ausentes. Não depender de commodity informada antes da consulta. | Etapa 3. |
| T7 | Empresas no exterior | Fontes por país, identificação legal, cobertura de compradores, evidências, acesso e custos. | Etapa 3. |
| T8 | Pesquisa com evidências | Mecanismo, rastreabilidade das afirmações, fontes acessíveis, custo/tempo, cobertura e retomada quando houver limites. | Etapa 1. |
| T9 | Conta Cloudflare | Plano e recursos necessários: Workers, D1, R2, KV, Queues e Cron; configuração e custos medidos/estimados com premissas. | Etapa 0. |
| T10 | Hospedagem e acesso | Cloudflare já escolhida; validar aplicação, autenticação e quatro perfis. Reavaliar dependências/cabeçalhos de hospedagem OpenAI do código sem presumir necessidade. | Etapa 0. |
| T11 | Compliance e ciclo de vida | Fontes de triagem, atualização, bloqueios aprovados, indisponibilidade; política aplicável de retenção/exclusão/supressão a validar com o responsável competente. | Etapa 1, antes de contatos reais. |
| T12 | `/prospeccao-vendas` | Localizar e ler o conteúdo real e referências; registrar versão; incorporar regras ao gerador/revisor e validar amostras internas. Conteúdo não disponibilizado nesta revisão. | Etapa 0 para preparação dos textos; antes da primeira ficha/abordagem do piloto. |

As dependências não impedem o planejamento do restante. Cada funcionalidade só é ativada após evidência de funcionamento ou alternativa documentada compatível com o escopo. A falta da `/prospeccao-vendas` impede declarar conformidade ou gerar abordagens finais conforme essa skill, mas não impede corrigir o planejamento ou pesquisar empresas. Transformar dependências em premissas e gatilhos de replanejamento na Spec v2.0.

---

## 6. Confirmações pendentes

### 6.1 Piloto comercial

- Commodity que a EAG comercializa e que Rogério deseja prospectar primeiro.
- Cidade/UF do fornecedor já conhecido e raio inicial. Ponto mais preciso, se disponível, é opcional.
- Condições/restrições gerais já conhecidas para aquela commodity, mercado ou origem, quando existirem.
- Empresas, destinatários e textos que serão aprovados para os 5–10 contatos de teste.
- Fornecedor detalhado, lote, preço, cotação e validade comercial **não são requisitos de entrada** do piloto de prospecção geral.

### 6.2 Catálogo e metodologia

- Confirmar variantes, fontes e campos dos produtos do site na Fase 2B; preço ou disponibilidade anunciados não são presumidos.
- DDGS, CGF, CGM, UCO e CSO: origem informada pelo responsável comercial já registrada; especificações, disponibilidade para eventual negociação e siglas a confirmar.
- Disponibilizar/localizar o `SKILL.md` e referências reais da `/prospeccao-vendas` no ambiente de implementação para cumprir T12.

### 6.3 Comparação técnica separada

Comparar `eag-compass-mvp-0.3.2-clean.zip` com a base 0.3.1, incorporando somente melhorias verificadas. A carga de sete prospects não equivale a empresas validadas e não deve ser incorporada como tal sem examinar as fontes. Essa tarefa não é dado comercial do piloto e não obriga troca de versão.

---

## 7. Fora do escopo desta versão

- Descoberta ou captação de fornecedores; o fornecedor nacional já conhecido fornece apenas o contexto de origem.
- Resposta automática a compradores, negociação autônoma e fechamento automático.
- Geração ou reescrita de texto no momento do disparo.
- Divulgação de preço, estoque, certificação, prazo ou condição sem dado aprovado pela EAG.
- Exigência de lote ou cotação para a prospecção inicial da commodity.
- Acesso ao LinkedIn por senha, cookies ou automação não autorizada.
- Integração com CRM externo, multi-tenant ativado e usuários externos.
- Promessa de cobertura integral de todas as empresas existentes ou garantia de conversão comercial.

---

## 8. Mudanças e controle da revisão

### 8.1 Em relação à v1.3

| Base anterior | Escopo v2.0 |
| --- | --- |
| Importadores internacionais | Radar Nacional de compradores próximos ao fornecedor conhecido e Internacional País Primeiro. |
| Açúcar e café | Catálogo EAG ampliado; seleção por commodity e campanha. |
| Follow-up automático fora do MVP | Execução da sequência congelada após aprovação individual; respostas tratadas por Rogério. |
| Intermediário bloqueado genericamente | Traders visíveis com prioridade secundária; restrições comerciais aplicadas conforme contexto confirmado. |
| Perfil único por empresa | Quatro classes por empresa, unidade e produto. |
| Qualificação orientada à importação | Evidências adequadas ao mercado; cadastro/CNAE/fluxo do país não comprovam compra individual. |
| Gate único | Requisitos de primeiro contato separados da demanda, qualificação e proposta específica. |

### 8.2 Revisão 3 deste documento

1. Eliminada a oferta obrigatória da campanha, ficha inicial, gate, piloto e verificações gerais de envio.
2. Separados commodity/campanha, demanda do comprador e oferta específica de negociação.
3. Preservado o Nacional com cidade do fornecedor conhecido como centro do raio e descoberta exclusiva de compradores; limite de envio do piloto separado da cobertura do radar.
4. Explicitado o Internacional: país → histórico agrícola Brasil–destino → escolha de commodities → pesquisa de empresas → aprovação → prospecção.
5. Ajustado o alcance da pausa por resposta para empresa + commodity, sem depender da existência de oferta.
6. Limitadas as regras de mudança/validade de oferta às propostas efetivamente vinculadas; campanhas gerais têm controles próprios.
7. Incluída `/prospeccao-vendas` como metodologia obrigatória, com T12 e sem alegar leitura ou aplicação não realizada.
8. Mantidas as correções de supressão, WhatsApp, compliance, migração e aceite; corrigidos cabeçalhos e tabelas Markdown.
9. Corrigida a afirmação de validação da hospedagem: configuração continua pendente. Testes de código são relato anterior, não resultado desta revisão.

**Limite desta entrega:** revisão dos documentos fornecidos. Não altera o código, não cria recursos Cloudflare, não conecta contas e não envia mensagens. O encerramento formal da Fase 1 depende do registro da revisão final; Fases 2A e 2B continuam liberadas para avançar.
