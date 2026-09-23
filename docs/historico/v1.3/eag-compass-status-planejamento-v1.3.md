# EAG Compass — Status do Planejamento v1.3

**Produto:** Plataforma de Descoberta e Qualificação de Importadores de Commodities Agrícolas  
**Data:** 2026-09-21  
**Status geral:** Fase 3 corrigida — pronta para aprovação formal

## Progresso por fase

| Fase | Status | Artefatos | Observação |
|---|---|---|---|
| 1. Brainstorm | Fechada | Escopo aprovado | Problema, público e recorte do MVP definidos |
| 2. Discovery | Benchmark preliminar concluído | Análise comparativa | Diferenciação permanece hipótese |
| 3. Especificação | Pronta para aprovação | Constituição v1.3 + Spec v1.3 | Correções bloqueadoras aplicadas |
| 4. Pesquisa Técnica | Próxima | — | Stack, arquitetura, fontes e cotações |
| 5. Design | Pendente | — | Fluxos, UX/UI e design tokens |
| 6. Plano | Pendente | — | Implementação e roadmap detalhados |
| 7. Auditoria | Pendente | — | Red-team e verificação cruzada |
| 8. Correção | Pendente | — | Aplicação dos achados |
| 9. Montagem | Pendente | — | Plano final e pacote de aceite |

## Escopo consolidado do MVP

| Item | Decisão |
|---|---|
| Usuário | Time interno EAG |
| Modelo operacional | Mono-tenant; preparação arquitetural para multi-tenant futuro |
| Commodities | Açúcar ICUMSA 45, açúcar VHP e café Arábica/Robusta |
| Futuro | Milho e demais tiers fora do MVP |
| Etapas | Discovery, prospecção, qualificação, risco, scoring e próximo passo |
| Açúcar | Mínimo de 500 MT por operação |
| Café | Mínimo configurável; 5 MT somente no piloto FoodEra |
| CRM | Standalone no MVP |
| Perfis | Administrador, Gestor Comercial, Vendedor/Analista e Auditor/Visualizador |
| Beta | EAG interno; cliente externo somente com aceite formal |

## Regras consolidadas

### Evidências

- **Empresarial:** prova vinculada à empresa; alimenta Confidence.
- **Mercado:** contexto agregado de origem, destino, produto e período; não prova compra da empresa.
- **Indício:** sinal que exige validação; não pontua.

### Scores

| Score | Regra | Saída obrigatória |
|---|---|---|
| Potential | Soma de seis dimensões, com tabelas por commodity | Resultado ou intervalo + cobertura |
| Confidence | Soma de cinco dimensões de evidência | 0–100, independente da Completude |
| Risk | Risco observado normalizado pelos componentes consultados | 0–100 + Coverage + classificação |

### Gate de qualificação

Um registro só pode ir para `Qualificado` quando:

1. possui evidência empresarial;
2. não possui sanção confirmada nem revisão de sanção pendente;
3. alcança Confidence e Potential mínimos;
4. alcança Completude mínima configurada;
5. atinge Risk Coverage mínima ou possui dispensa executiva justificada;
6. identifica o comprador final; trader exige validação do comprador final atendido;
7. volume abaixo do mínimo possui aprovação executiva;
8. Risk Score ≥80 possui plano de mitigação aprovado.

## Parâmetros do piloto

| Parâmetro | Padrão inicial | Observação |
|---|---:|---|
| `param_confidence_min` | 50 | Ajustável por administrador |
| `param_potential_min` | 40 | Ajustável por commodity |
| `param_completeness_min` | 60% | Campos aplicáveis confirmados |
| `param_risk_coverage_min` | 50% | Abaixo disso: risco inconclusivo |
| `param_risk_high` | 70 | A partir de 80 exige mitigação |
| `param_volume_min[sugar]` | 500 MT/operação | ICUMSA 45 e VHP |
| `param_volume_min[coffee:FoodEra]` | 5 MT/operação | Somente piloto FoodEra |

## Correções incorporadas na v1.3

| Correção | Resultado |
|---|---|
| Gate de qualificação incompleto | Incluídos comprador final, mínimo, risco, cobertura e Completude |
| Campos obrigatórios versus `Não confirmado` | Criados estados de campo e denominador por aplicabilidade |
| Unidade de preço | Moeda, unidade e validade registradas |
| Café sem scoring no MVP | Incluída tabela relativa ao mínimo configurado |
| Potencial anual ambíguo | Definidas origem direta/derivada, precedência e divergência |
| Risk parcial subestimado | Score normalizado pelos componentes consultados + Coverage separada |
| Comex Stat invertido | Corrigido para exportação Brasil → mercado-alvo |
| Sanções por nome | Nome sem identificador exige revisão humana |
| Testes insuficientes | Cenários AT1–AT14 adicionados |
| Inconsistências editoriais | Versões, títulos, checkboxes e módulos padronizados |

## Clarifications encerradas

| Tema | Decisão |
|---|---|
| Volume de café | Configurável; FoodEra = 5 MT no piloto |
| Moeda | USD base; BRL gerencial com fonte e data do câmbio |
| CRM | Standalone no MVP |
| RBAC | Quatro perfis fixos |
| Prazo | 12 semanas após aprovação técnica e início efetivo |
| Beta | EAG interno |

## Estimativas

| Item | Estimativa | Status |
|---|---:|---|
| Fases 1–3 | 2–3 semanas | Concluídas após aprovação formal |
| Fase 4 | 1 semana | Próxima |
| Fase 5 | 1–2 semanas | Após Fase 4 |
| Fase 6 | 2–3 semanas | Após Fase 5 |
| Fases 7–9 | 3 semanas | Após Fase 6 |
| Planejamento até montagem | Aproximadamente 12 semanas | Preliminar |
| Desenvolvimento + QA | A definir na Fase 4 | Não cotado |
| Orçamento | A definir na Fase 4 | Não confirmado |

## Gatilhos de replanejamento

1. Se mais de 50% das oportunidades de açúcar estiverem abaixo de 500 MT, revisar ICP e mínimo comercial.
2. Se café não gerar demanda suficiente no piloto, removê-lo do MVP.
3. Se fontes nominais forem indisponíveis ou inviáveis, reduzir promessa de validação empresarial.
4. Se estimativas técnicas excederem 15 semanas, renegociar escopo ou capacidade.
5. Se a preparação multi-tenant elevar materialmente custo ou prazo, registrar decisão arquitetural explícita.

## Próximo passo

Após aprovação formal da Constituição v1.3 e da Especificação v1.3, marcar a Fase 3 como `Fechada` e iniciar a Fase 4 com pesquisa técnica, arquitetura de dados, fontes e cotações.

## Controle do documento

- **Versão:** 1.3
- **Data:** 2026-09-21
- **Status:** pronta para aprovação formal

