# EAG Compass — Status do Planejamento v2.0

**Expansão:** Nacional + Internacional
**Iniciado:** 2026-09-22
**Atualização:** 2026-09-22 — revisão documental 4 do status; escopo permanece revisão 3
**Método de planejamento:** `/planejar`, conforme fluxo adotado no projeto
**Metodologia das abordagens:** `/prospeccao-vendas` v1.0 — leitura no Windows relatada em 2026-09-22; registro revisado e critérios em `docs/eag-compass-t12-prospeccao-vendas.md`
**Base histórica:** Constituição v1.3 + Spec v1.3, preservadas.
**Código-base:** 0.3.1. Os 14/14 testes verdes em 2026-09-22 foram informados na leitura anterior; esta entrega não reexecutou testes nem alterou o código.
**Escopo vigente para revisão:** `eag-compass-v2-escopo.md`, revisão 3.

## Fases

| Fase | Status | Artefato / observação |
| --- | --- | --- |
| 0. Preflight | Ferramentas de planejamento verificadas anteriormente | Integrações de produção ainda pendentes; `/prospeccao-vendas` acrescentada como verificação T12. |
| Converge — leitura do existente | Leitura anterior registrada em 2026-09-22 | Divergências abaixo. Código não reinspecionado nesta revisão documental. |
| 1. Brainstorm | Direção definida; revisão 3 corrigida, aguardando fechamento documental | `docs/eag-compass-v2-escopo.md`. Não registrar aprovação formal ainda não recebida. |
| 2A. Benchmark | Revisão documental 2 entregue; aprovação não registrada | `docs/eag-compass-benchmark.md`. 16 páginas consultadas, com resultados parciais explícitos; nenhuma integração testada. B1–B3 propostas. |
| 2B. Perfil EAG + catálogo | Revisão documental 3 entregue; alinhada ao escopo revisão 3 | `docs/eag-compass-perfil.md`. 28 entradas editoriais; identidade/variante separadas de oferta; soja, café e etanol mantidos no Nacional. |
| 3. Spec v2.0 + Constituição v2.0 | Pendente | `docs/eag-compass-spec.md` e `docs/eag-compass-constituicao.md`; preservar v1.3 antes de substituí-las. |
| 4. Pesquisa técnica das alterações | Pendente | Dependências T1–T12 e evidências de viabilidade/custos. |
| 5. Design | Pendente | Dois dashboards, ficha por commodity e linha do tempo. |
| 6. Plano de implementação | Pendente | `docs/superpowers/plans/`; etapas 0–4 do escopo. |
| 7–9. Auditoria, correção e montagem | Pendente | Validação e consolidação posteriores. |

## Decisões tomadas

- **Nome:** EAG Compass v2.0; documentação v1.3 preservada como referência histórica.
- **Usuários:** Rogério como principal; quatro perfis internos; sem acesso externo.
- **Arquivos:** centralizar em `eag-compass/docs/`.
- **Objetivo:** encontrar compradores; consumidores finais PME têm prioridade, traders continuam classificados e com prioridade secundária.
- **Prospecção inicial:** apresentar commodities comercializadas pela EAG e levantar demanda. Não exigir lote, estoque, preço, cotação vigente ou cadastro completo de fornecedor para buscar, aprovar a ficha ou iniciar a sequência.
- **Radar Nacional:** commodity + cidade/UF do fornecedor já conhecido + raio em km. A cidade é a origem logística da busca por compradores. O sistema não pesquisa fornecedores.
- **Descoberta nacional:** apresentar todos os candidatos encontrados nas fontes consultadas, com cobertura, localização e pendências. As 5–10 empresas limitam o teste de envio, não o radar.
- **Internacional:** somente país na primeira entrada; apresentar histórico das commodities agrícolas compradas do Brasil; Rogério escolhe uma ou mais commodities e autoriza a busca de empresas. Ficha e contato são aprovados empresa a empresa.
- **Campanha:** ligada à commodity e ao contexto comercial. Oferta específica opcional, vinculada quando a abordagem/negociação usar aquela proposta concreta.
- **Oferta específica:** mudanças e validade afetam apenas sequências que a utilizam. Suspensão de comercialização da commodity/origem/mercado pausa as campanhas correspondentes.
- **Aprovação:** textos finais, destinatários, canais, fuso e sequência congelados por versão. Mudanças exigem nova aprovação; retomada preserva envios concluídos.
- **Respostas:** suspendem a abordagem automática da empresa para a mesma commodity, inclusive outros decisores/canais, e abrem tarefa para Rogério. Dados extraídos são sugestões com fonte.
- **Abordagens e follow-ups:** devem obedecer à `/prospeccao-vendas`. Registrar conteúdo/versão efetivamente lidos; não atribuir regras à skill sem acesso ao arquivo real.
- **Hospedagem:** Cloudflare definida; recursos, configuração da aplicação, autenticação e permissões de produção a validar. Wrangler autenticado não comprova essas etapas.
- **E-mail:** `rogeriopalhari@eagagro.com`; provedor, envio e recebimento dependem de T1.
- **WhatsApp Business:** ativação condicionada à integração oficial, permissão do destinatário e regras aplicáveis de conteúdo, modelos e envio; número público não autoriza contato.
- **LinkedIn:** conta profissional por modalidades autorizadas; modo assistido quando não houver recurso oficial disponível.
- **OpenClaw:** substituir prospecção e envio. Retirar as campanhas transferidas antes do primeiro disparo do Compass; desligar os módulos substituídos após reconciliação/validação.
- **DDGS, CGF, CGM, UCO, CSO:** origem = portfólio informado pelo responsável comercial. Especificações, disponibilidade para negociação e siglas pendentes de confirmação.
- **Pacote 0.3.2:** comparação técnica com 0.3.1; incorporar somente melhorias verificadas. Não tratar sete prospects de carga inicial como validados sem fontes.

## Revisões do escopo

### Revisão 1 — mantida

1. Supressão tratada como dado pseudonimizado, com política de retenção/exclusão e alcance entre canais apenas por vínculos comprovados.
2. WhatsApp condicionado a permissões e regras do canal.
3. Uma sequência ativa por destinatário; a próxima aguarda, sem combinação automática de textos.
4. Compliance incluído na verificação pré-envio; consulta indisponível não libera envio (T11).
5. Dependências com etapa-limite; testes internos antes de contato real.
6. Aceite técnico separado de métricas comerciais.

### Revisão 2 — preservada com a retificação da revisão 3

- Cidade/UF = localização do fornecedor já conhecido, centro do raio para encontrar compradores.
- Mapa/lista apresentam cobertura e pendências; 5–10 empresas são o limite do teste de envio.
- A redação antiga que dispensava lote/preço apenas na busca, mas exigia oferta vigente na ficha, foi **substituída** pela revisão 3 abaixo. Ela não é regra vigente.

### Revisão 3 — correção vigente

1. Oferta específica deixou de ser requisito de busca, ficha, envio inicial e piloto. Campanha e aprovação vinculam-se à commodity.
2. Demanda do comprador e proposta específica passam a uma etapa posterior, com confirmação humana e condições reais.
3. Nacional consolidado: origem do fornecedor já conhecido + commodity + raio → compradores próximos.
4. Internacional consolidado: país → histórico agrícola Brasil–destino → seleção de commodities → empresas → aprovação → prospecção.
5. Pausa por resposta passa a operar por empresa + commodity. Regras de cotação aplicam-se apenas quando houver proposta específica vinculada.
6. Acrescentada a obrigação de seguir `/prospeccao-vendas`, dependência T12. Na emissão da revisão 3, conteúdo ainda não disponível. Posteriormente o T12 registrou leitura no Windows; implementação e amostras seguem pendentes. Nenhuma conformidade de mensagem produzida é declarada.
7. Corrigidas afirmações de validação técnica já concluída e a formatação das tabelas; escopo e status sincronizados.

## Dependências e marcos

| ID | Dependência | Limite de validação |
| --- | --- | --- |
| T1 | E-mail: provedor, envio, recebimento e eventos | Etapa 0; antes de contatos reais. |
| T2 | WhatsApp: integração oficial, permissão e regras | Antes da ativação do canal na Etapa 2 ou posterior. |
| T3 | LinkedIn: capacidades permitidas ou modo assistido | Etapa 1; automação somente se validada. |
| T4 | Fontes de empresas/unidades no Brasil | Etapa 1. |
| T5 | Geocodificação, mapa e raio | Etapa 1. |
| T6 | Histórico agrícola Brasil–país, classificação e período | Etapa 3. |
| T7 | Fontes de compradores no exterior | Etapa 3. |
| T8 | Pesquisa com evidências, cobertura e custo | Etapa 1. |
| T9 | Plano, recursos e custos Cloudflare | Etapa 0. |
| T10 | Hospedagem, autenticação e perfis da aplicação | Etapa 0. |
| T11 | Triagem/compliance e política de ciclo de vida | Antes dos contatos reais da Etapa 1. |
| T12 | Leitura e incorporação de `/prospeccao-vendas` | Leitura relatada: v1.0, atualização 2026-09-14, hash no T12. Registro revisão 2, adaptações A1–A11, PV1–PV8. Pendente: consolidar critérios na Spec, implementar e revisar amostras internas antes da primeira ficha. Não impede escrever a Spec. |

Planejamento e pesquisa podem continuar. A funcionalidade dependente só é ativada após validação ou alternativa documentada. Não confundir marco planejado com atividade executada.

## Piloto e pendências comerciais

**Ordem:** Fundação → Piloto Nacional por e-mail → Validação/ajustes → Internacional → Ampliação.

Confirmar commodity, cidade/UF onde Rogério possui fornecedor e raio inicial. Não exigir lote, cotação ou cadastro completo de fornecedor. O teste externo terá 5–10 empresas individualmente aprovadas; a descoberta não fica limitada a essa quantidade.

Aceite técnico: mensagens conforme aprovação, sem duplicidades, linha do tempo completa, respostas processadas em testes controlados, pausas/supressão efetivas e fluxo executável conforme a etapa. Respostas reais e oportunidades são métricas comerciais, sem promessa de resultado.

## Divergências registradas entre v1.3 e a expansão

Itens abaixo são provenientes da leitura anterior do projeto, sem reinspeção do código nesta entrega:

1. Spec v1.3 e README excluem envio/follow-up automático; v2.0 permite execução de sequência aprovada.
2. `demands.commodity` limitado a `sugar`/`coffee`; catálogo/campanha/demanda e proposta opcional precisam ser modelados.
3. `buyer_type` e AT12 antigos precisam refletir perfil por empresa/unidade/produto e ausência de bloqueio genérico a traders.
4. Mercado nacional exige origem do fornecedor conhecido, unidades consumidoras, precisão geográfica, raio e porte com fonte.
5. Configuração anterior contém `LOCAL_REPLACE_AFTER_CREATE`; provisionamento de produção ainda precisa de comprovação.
6. Dois status históricos contraditórios devem ser arquivados como referência; este arquivo concentra o acompanhamento da expansão v2.0.
7. Geração/revisão de abordagens precisa incorporar a skill `/prospeccao-vendas`, sem geração no momento do disparo.

## Atualização 2026-09-22 — Fase 2 e T12

### Concluído (documentos entregues, aguardando revisão)

- **T12 avançada:** leitura no Windows relatada; registro revisado com adaptações A1–A11 e PV1–PV8. A revisão não alterou a skill original. Registro: `docs/eag-compass-t12-prospeccao-vendas.md`.
- **2B:** `docs/eag-compass-perfil.md` revisão 3 — campanha vinculada à commodity e ao mercado; cotação/oferta específica posterior; soja, café e etanol registrados no escopo nacional; origem distingue publicação da EAG (SITE) de informação de Rogério (SOLICITAÇÃO, PORTFÓLIO).
- **2A:** `docs/eag-compass-benchmark.md` — descoberta nacional por raio, inteligência internacional por país, decisores e execução de sequências. revisão 2: reconferência das 14 URLs originais (12 organizações) e consulta de duas páginas MDIC; preços Volza/detalhes Comex com ressalvas. As 423 ocorrências pertencem à pesquisa anterior e não equivalem a fontes verificadas. Nenhuma integração testada.
- Correções: raio de fonte não define limite universal do Compass; Econodata pode usar centroide para candidato; Google Nearby Search retorna até 20 resultados; contrato anual não é universal. Preços Volza anteriores não reconfirmados; limite de 500 ms Comex não comprovado.

### Pendente

- Revisão de Rogério dos três documentos acima e fechamento documental das Fases 1 e 2.
- Decisões do benchmark para a Spec: **B1** (classificação de ausência, dúvida e condições de retomada), **B2** (saída clara e mecanismo técnico aplicável), **B3** (raio ajustável, precisão e cobertura). Permanecem propostas, não aprovações tácitas.
- Confirmar identidade de CSO antes da busca/abordagem específica. Famílias de café já previstas; características e disponibilidade dependem do conteúdo a afirmar ou da cotação concreta, sem exigir oferta para contato genérico.
- Dados do piloto: commodity, cidade/UF do fornecedor e raio inicial.

### Dependências que exigem teste técnico (não testadas nesta revisão documental)

| ID | O que testar | Insumo do benchmark |
| --- | --- | --- |
| T1 | Envio, recebimento, correlação de respostas e autenticação do domínio `eagagro.com` | Requisitos Google/Yahoo a validar; dois domínios de e-mail no material da EAG |
| T3 | Capacidades e permissões efetivas das APIs oficiais LinkedIn | SNAP informa ausência de novos parceiros; não extrapolar para todas as APIs. Modo assistido preservado. |
| T4/T5 | Fonte de unidades, geocodificação, raio, cobertura e deduplicação | Econodata: centroides; Google: até 20 resultados/consulta. Limites das fontes não fixam a faixa do Compass. |
| T6 | Comex Stat: classificação agrícola, sentido do fluxo, códigos, limites e unidades | API e sigilo documentados pelo MDIC; contrato e chamadas de dados ainda por testar. |
| T8 | Custo e tempo por empresa da pesquisa com evidências | Modelo de cobrança por campo (Econodata) como referência |
| T12 | Amostras internas conforme PV1–PV8 | — |

## Correções desta revisão documental

1. Abordagem por commodity preservada, sem oferta obrigatória; identidade do produto precisa estar clara.
2. T12 inclui consumidor final, trader e perfil desconhecido; encerramento não ultrapassa supressão/pausa. Framework da skill não redefine formulário comercial.
3. Retirada a referência operacional ao Reclame Aqui, conforme decisão anterior.
4. Corrigidos limites geográficos, cobertura, generalizações sobre bases pagas e afirmações não reconfirmadas.
5. B1–B3 permanecem propostas. Resposta incerta mantém a pausa existente; retomada automática não foi aprovada por este documento.
6. Revisão documental não equivale a teste, aprovação comercial ou autorização de envio.

## Próximo passo

Preparar a **Fase 3 — Spec v2.0 e Constituição v2.0**, usando os documentos corrigidos e destacando B1–B3 para decisão durante a especificação. Registrar o fechamento documental das Fases 1/2 quando houver aprovação expressa, rastreando cada requisito ao escopo revisão 3, sem repetir o brainstorm e sem reintroduzir exigências antigas (oferta obrigatória, bloqueio genérico de traders, importação obrigatória no Nacional).

**Limite desta atualização:** documentos de planejamento apenas. Nenhuma alteração de código, publicação, criação de recursos Cloudflare, conexão de canais, teste de ferramentas ou envio de mensagens. Nenhuma aprovação formal foi registrada em nome do usuário.
