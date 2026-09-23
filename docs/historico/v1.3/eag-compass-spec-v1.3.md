# Especificação — EAG Compass v1.3

## Requisitos EARS verificáveis

**Produto:** Plataforma de Descoberta e Qualificação de Importadores de Commodities Agrícolas  
**Data:** 2026-09-21  
**Status:** pronta para aprovação formal

## 1. Glossário

### 1.1 Tipos de evidência

| Tipo | Definição | Exemplos | Efeito |
|---|---|---|---|
| Evidência empresarial | Prova vinculada à empresa específica | Registro alfandegário nominal, BL, documento empresarial, confirmação direta | Pode alimentar Confidence |
| Evidência de mercado | Contexto agregado de fluxo comercial | Comex Stat: Brasil exportou o produto para o mercado-alvo | Não prova compra empresarial e não pontua |
| Indício comercial | Sinal ainda não validado | Website, LinkedIn, marketplace, notícia | Não pontua; mantém estado `Descoberto` |

### 1.2 Estados do pipeline

| Estado | Requisito de entrada |
|---|---|
| Descoberto | Nome da empresa + fonte de indício |
| Prospectado | Pelo menos uma evidência empresarial válida |
| Em Contato | Contato cuja identidade foi confirmada |
| Em Qualificação | Formulário iniciado e pelo menos 25% dos campos aplicáveis confirmados |
| Qualificado | Gate definido em R7.6 integralmente atendido |
| Oportunidade Confirmada | Decisor contatado e próximo passo comercial acordado |

### 1.3 Estados de exceção

- `Abaixo do Mínimo`: volume por operação inferior ao parâmetro da commodity.
- `Sanção em Revisão`: correspondência sem identificador confiável.
- `Sanção Bloqueada`: identificador confiável em lista oficial ou país bloqueado pela política EAG.
- `Risco Inconclusivo`: Risk Coverage abaixo do mínimo.
- `Risco Alto sem Mitigação`: Risk Score a partir de 80 sem plano aprovado.
- `Fora do ICP`: não atende critérios básicos documentados.
- `Sem Progresso`: nenhum avanço durante período configurado; não implica exclusão.

### 1.4 Definições operacionais

| Termo | Definição |
|---|---|
| Comprador final | Organização que consumirá, transformará ou utilizará a commodity; não o mero intermediário |
| Intermediário | Trader ou distribuidor que compra para terceiro |
| Decisor | Pessoa com autoridade confirmada de compra, orçamento ou assinatura |
| Campo confirmado | Valor validado em diálogo ou por fonte rastreável |
| Não confirmado | Estado explícito de pendência; não conta na Completude |
| Não se aplica | Campo excluído do denominador mediante justificativa |
| Coverage | Proporção dos componentes aplicáveis efetivamente consultados |

## 2. Requisitos funcionais

### Módulo 1 — Descoberta, evidência e sanções

#### R1.1 — Adição de empresa

> **QUANDO** um usuário informar nome, país e fonte de indício,  
> **ENTÃO** o sistema DEVE criar a empresa como `Descoberto`, registrar usuário e timestamp e classificar a fonte como `Indício comercial`.

O sistema NÃO DEVE exigir evidência empresarial para criar o registro.

#### R1.2 — Triagem de sanções

> **QUANDO** uma empresa for criada ou seus identificadores forem alterados,  
> **ENTÃO** o sistema DEVE consultar as listas definidas pela política de compliance EAG e registrar lista, versão/data, termo e identificadores consultados.

Bloqueio automático é permitido somente quando:

1. o país estiver bloqueado pela política EAG; ou
2. houver correspondência em lista oficial por identificador confiável e país confirmado.

Correspondência exata ou parcial apenas por nome DEVE gerar `Sanção em Revisão`, tarefa para Administrador e impedimento de qualificação, sem bloqueio definitivo automático.

A decisão humana DEVE registrar responsável, data, resultado, motivo e base consultada.

#### R1.3 — Evidência empresarial

> **QUANDO** um usuário adicionar registro nominal, BL, documento empresarial ou confirmação direta,  
> **ENTÃO** o sistema DEVE registrar tipo, referência, empresa identificada, data do fato, data da consulta, validador e arquivo/URL quando disponível.

Após validação, o sistema DEVE:

- alterar o estado para `Prospectado`;
- recalcular Confidence conforme R5;
- preservar evidências anteriores, inclusive conflitantes.

#### R1.4 — Contexto de mercado

> **QUANDO** o usuário consultar o Comex Stat,  
> **ENTÃO** o sistema DEVE registrar origem Brasil, destino, NCM, commodity, período, volume, valor FOB, data da consulta e fonte.

A interface DEVE exibir: “O dado confirma exportação do Brasil para o mercado-alvo; não comprova importação por esta empresa.”

Evidência de mercado NÃO DEVE alterar Confidence.

### Módulo 2 — Contatos, decisor e comprador final

#### R2.1 — Cadastro e estados de contato

> **QUANDO** um contato for cadastrado,  
> **ENTÃO** o sistema DEVE registrar nome, cargo, e-mail, telefone e LinkedIn quando disponíveis, fonte, responsável e timestamp.

Os estados abaixo DEVEM ser independentes:

1. e-mail entregável;
2. identidade confirmada;
3. cargo confirmado;
4. autoridade decisória confirmada;
5. demanda confirmada diretamente.

Cada verificação DEVE registrar método, data e fonte. Apenas os fatos definidos em R5 pontuam.

#### R2.2 — Transição para Em Contato

> **QUANDO** a identidade do contato for confirmada por resposta, ligação ou outro método rastreável,  
> **ENTÃO** o sistema DEVE permitir a transição para `Em Contato`.

Entregabilidade de e-mail isolada NÃO confirma identidade.

#### R2.3 — Decisor

> **QUANDO** um contato for marcado como decisor,  
> **ENTÃO** o sistema DEVE exigir evidência da autoridade de compra, orçamento ou assinatura e registrar método e data.

#### R2.4 — Comprador final e intermediário

> **QUANDO** o tipo de comprador for informado,  
> **ENTÃO** o sistema DEVE aceitar `Comprador final`, `Intermediário` ou `Não confirmado`.

Para `Intermediário`, a qualificação exige nome do comprador final atendido e evidência de sua relação com a demanda. `Não confirmado` impede qualificação.

### Módulo 3 — Formulário EAG e SPIN

#### R3.1 — Estrutura dos campos

Cada campo aplicável DEVE aceitar os estados `Confirmado`, `Não confirmado` e `Não se aplica`. O último exige justificativa e perfil autorizado quando o campo for normalmente exigido.

| # | Campo | Tipo | Regra para qualificação |
|---:|---|---|---|
| 1 | Produto | Lista | Obrigatório |
| 2 | Especificação | Texto estruturado | Obrigatório |
| 3 | Embalagem | Lista | Obrigatório |
| 4 | Volume por operação | Número + unidade | Obrigatório |
| 5 | País de destino | Lista | Obrigatório |
| 6 | Porto/local de entrega | Texto | Obrigatório quando aplicável ao Incoterm |
| 7 | Incoterm | Lista | Obrigatório |
| 8 | Data necessária | Data ou intervalo | Obrigatório |
| 9 | Modalidade | Spot ou contrato | Obrigatório |
| 10 | Frequência anual | Número de operações/ano | Obrigatório para contrato; 1 para spot |
| 11 | Método de pagamento | Lista | Obrigatório |
| 12 | Prazo de pagamento | Lista | Obrigatório |
| 13 | Garantia de pagamento | Lista | Obrigatório quando exigida pela política ou condição |
| 14 | Preço indicativo | Valor + moeda + unidade + validade | Opcional |
| 15 | Comprador final | Empresa + evidência | Obrigatório |
| 16 | Decisor | Contato + autoridade | Obrigatório |
| 17 | Restrições de compliance | Texto/status | Obrigatório, podendo ser `Nenhuma confirmada` |

Preço indicativo DEVE registrar moeda, unidade comercial (`USD/MT`, `USD/saca de 60 kg`, `USD/kg` ou outra configurada), data de validade e fonte. USD é a moeda-base; BRL, quando exibido, DEVE registrar taxa, fonte e data.

#### R3.2 — Completude

> **QUANDO** um campo for alterado,  
> **ENTÃO** o sistema DEVE recalcular a Completude em tempo real.

Fórmula:

```text
Completude = campos aplicáveis confirmados / campos aplicáveis exigidos × 100
```

- Campo `Não confirmado` permanece no denominador e não conta no numerador.
- Campo `Não se aplica`, com justificativa válida, sai do numerador e do denominador.
- Campo opcional não entra no denominador.
- O sistema DEVE mostrar quais campos faltam e manter histórico de alterações.
- Dados externos podem ser exibidos como referência, mas nunca confirmados automaticamente.

#### R3.3 — Volume mínimo

> **QUANDO** o volume por operação ficar abaixo de `param_volume_min[commodity, supplier?]`,  
> **ENTÃO** o sistema DEVE conservar o registro, aplicar `Abaixo do Mínimo` e impedir qualificação até aprovação executiva.

A aprovação DEVE registrar aprovador, data, justificativa, volume real e parâmetro vigente.

#### R3.4 — SPIN e Gap Selling

> **QUANDO** o vendedor preencher ou revisar uma demanda,  
> **ENTÃO** a interface DEVE oferecer perguntas contextuais de Situação, Problema, Implicação e Need-payoff e permitir registrar estado atual, estado desejado e gap.

Sugestões não são respostas e não alteram scores sem confirmação.

### Módulo 4 — Potential Score

#### R4.1 — Cálculo geral

```text
Potential = Volume/operação + Potencial anual + Recorrência
          + Compatibilidade técnica + Prontidão comercial + Logística
Máximo = 100
```

| Dimensão | Máximo |
|---|---:|
| Volume por operação | 30 |
| Potencial anual | 20 |
| Recorrência | 20 |
| Compatibilidade técnica | 15 |
| Prontidão comercial | 10 |
| Logística | 5 |

#### R4.2 — Açúcar

| Volume/operação | Pontos |
|---:|---:|
| <500 MT | 0 |
| 500–999 MT | 10 |
| 1.000–1.999 MT | 20 |
| ≥2.000 MT | 30 |

| Potencial anual | Pontos |
|---:|---:|
| <3.000 MT | 5 |
| 3.000–5.999 MT | 10 |
| ≥6.000 MT | 20 |

#### R4.3 — Café no MVP

O score de café DEVE funcionar desde o MVP. Na ausência de tabela específica aprovada, aplica-se a tabela relativa ao mínimo configurado `M`:

| Volume/operação | Pontos |
|---:|---:|
| <1×M | 0 |
| 1×M a <2×M | 10 |
| 2×M a <4×M | 20 |
| ≥4×M | 30 |

| Potencial anual | Pontos |
|---:|---:|
| <2×M | 5 |
| 2×M a <6×M | 10 |
| ≥6×M | 20 |

Para FoodEra no piloto, `M = 5 MT/operação`. As faixas podem ser substituídas por tabela específica versionada sem redeploy.

#### R4.4 — Recorrência e dimensões comuns

| Frequência | Pontos |
|---:|---:|
| Spot, 1 operação/ano | 0 |
| 2–4 operações/ano | 8 |
| 5–11 operações/ano | 15 |
| ≥12 operações/ano | 20 |

Compatibilidade técnica:

- especificação confirmada: 10 pontos;
- embalagem confirmada e disponível: 5 pontos.

Prontidão comercial:

- Incoterm confirmado: 5 pontos;
- data firme: 5 pontos.

Logística:

- porto/local confirmado e operacionalmente atendível: 5 pontos.

#### R4.5 — Potencial anual e incerteza

O sistema DEVE armazenar separadamente:

- `annual_potential_direct`: volume anual confirmado pelo comprador;
- `annual_potential_derived`: volume/operação × operações/ano;
- fonte, data e status de confirmação de cada valor.

Se o valor direto estiver confirmado, ele prevalece no score. O derivado continua visível. Divergência superior a 10% gera alerta e pendência de reconfirmação.

Se uma dimensão estiver desconhecida, o sistema DEVE apresentar:

- mínimo confirmado;
- máximo possível;
- intervalo do Potential;
- cobertura das dimensões.

Para avanço automático, aplica-se o limite ao menor valor do intervalo. Dispensa exige aprovação executiva justificada.

### Módulo 5 — Confidence Score

#### R5.1 — Fórmula

```text
Confidence = Evidência de compra + Atualidade + Registro empresarial
           + Decisor verificado + Confirmação direta
Máximo = 100
```

| Dimensão | Condição | Pontos |
|---|---|---:|
| Evidência de compra | Registro alfandegário nominal | 30 |
|  | BL | 25 |
|  | Documento empresarial | 20 |
| Atualidade | <6 meses | 20 |
|  | 6–12 meses | 15 |
|  | >12 meses | 5 |
| Registro empresarial | Ativo e verificado | 15 |
|  | Parcialmente verificado | 8 |
| Decisor | Autoridade, identidade e contato confirmados | 15 |
|  | Cargo conhecido, confirmação pendente | 5 |
| Confirmação direta | Demanda confirmada verbalmente ou por escrito | 20 |
|  | Resposta inicial sem demanda confirmada | 15 |

Somente o maior valor aplicável dentro de cada dimensão é usado. Ausência de evidência rende zero porque nenhum ponto foi conquistado; não constitui penalidade presumida.

Não entram em Confidence: Comex Stat, presença digital, Completude, sanções ou Risk Score.

### Módulo 6 — Risk Score e Coverage

#### R6.1 — Componentes

Cada componente recebe severidade de 0 a 20 e peso:

| Componente | Peso | Exemplos de severidade |
|---|---:|---|
| Registro empresarial | 1,00 | ativo 0; suspenso 15; fictício confirmado 20 |
| Crédito | 1,25 | sem ocorrência 0; 1–2 ocorrências 10; recorrente/grave 20 |
| Pagamento | 1,25 | pontual 0; atraso isolado 8; recorrente 20 |
| Reputação | 0,75 | sem ocorrência 0; ocorrência moderada 8; grave/procedente 20 |
| Logística | 0,75 | normal 0; restrita 10; inviável 20 |

Quantidade isolada de reclamações não basta; procedência, gravidade e atualidade DEVEM ser consideradas.

#### R6.2 — Fórmulas

Dados desconhecidos não recebem zero. São excluídos do cálculo observado e reduzem Coverage.

```text
Risk Score = soma(severidade × peso dos componentes consultados)
             / soma(20 × peso dos componentes consultados) × 100

Risk Coverage = soma(pesos consultados) / 5,00 × 100
```

Se nenhum componente tiver sido consultado, Risk Score é `Não calculável` e Coverage é 0%.

#### R6.3 — Classificação

| Coverage | Estado |
|---:|---|
| <50% | Risco Inconclusivo; sem classificação baixo/médio/alto |
| 50–99% | Risco Provisório |
| 100% | Risco Completo |

Com Coverage suficiente:

| Risk Score | Faixa |
|---:|---|
| 0–49 | Baixo |
| 50–69 | Médio |
| 70–79 | Alto; ação recomendada |
| 80–100 | Muito alto; plano de mitigação obrigatório |

Sanção é bloqueio separado e independe do Risk Score e da Coverage.

### Módulo 7 — Parâmetros e gate de qualificação

#### R7.1 — Parâmetros editáveis sem redeploy

| Parâmetro | Padrão do piloto |
|---|---:|
| `param_confidence_min` | 50 |
| `param_potential_min` | 40 |
| `param_completeness_min` | 60% |
| `param_risk_coverage_min` | 50% |
| `param_risk_high` | 70 |
| `param_volume_min[sugar]` | 500 MT/operação |
| `param_volume_min[coffee:FoodEra]` | 5 MT/operação |

Toda alteração DEVE ser restrita a Administrador e registrar valor anterior, novo valor, motivo, usuário e vigência.

#### R7.2 — Gate de qualificação

> **QUANDO** um usuário solicitar avanço para `Qualificado`,  
> **ENTÃO** o sistema DEVE validar todos os critérios abaixo.

1. evidência empresarial válida;
2. Confidence ≥ `param_confidence_min`;
3. menor valor do intervalo Potential ≥ `param_potential_min`;
4. Completude ≥ `param_completeness_min`;
5. nenhuma sanção confirmada ou revisão de sanção pendente;
6. Risk Coverage ≥ `param_risk_coverage_min`, salvo dispensa executiva justificada;
7. comprador final confirmado; intermediário exige comprador final atendido e evidência;
8. decisor confirmado;
9. volume mínimo atendido ou aprovação executiva registrada;
10. Risk Score <80 ou plano de mitigação aprovado.

Falha em qualquer critério DEVE impedir a transição e exibir pendências acionáveis. Aprovações não podem ser implícitas.

### Módulo 8 — Rastreabilidade e auditoria

#### R8.1 — Histórico

Toda alteração crítica DEVE registrar:

- entidade e campo;
- valor anterior e novo;
- usuário e perfil;
- timestamp ISO 8601;
- motivo;
- evidência relacionada;
- versão da fórmula e parâmetros, quando houver score.

#### R8.2 — Reprodutibilidade

O sistema DEVE permitir reconstruir cada score com os dados, fontes, parâmetros e versão vigentes no momento do cálculo. Recálculo posterior não apaga o resultado anterior.

### Módulo 9 — Privacidade, segurança e acesso

#### R9.1 — LGPD/GDPR

> **QUANDO** houver solicitação válida e aplicável de titular,  
> **ENTÃO** o sistema DEVE executar a ação determinada pela base legal e política de retenção.

Para exclusão aplicável:

- remover nome, e-mail, telefone e URL pessoal;
- purgar índices, caches e embeddings;
- manter tombstone sem PII;
- preservar dados empresariais não pessoais quando houver base legal;
- registrar data, responsável e fundamento, sem gravar PII no log.

Validação jurídica é obrigatória antes da implementação final.

#### R9.2 — RBAC

| Perfil | Permissões principais |
|---|---|
| Administrador | Usuários, parâmetros, sanções, aprovações e acesso total |
| Gestor Comercial | Pipeline, relatórios, aprovações comerciais e status |
| Vendedor/Analista | Criar e enriquecer registros, contatos e formulários |
| Auditor/Visualizador | Leitura e histórico, sem edição |

- [ ] Vendedor não altera fórmula, parâmetro ou score manualmente.
- [ ] Auditor não cria, edita, aprova ou exclui registros.
- [ ] Aprovação executiva exige Gestor ou Administrador.
- [ ] Revisão de sanção exige Administrador.

Multi-tenant e permissões customizadas ficam fora do MVP.

## 3. Cenários verificáveis de aceite

### AT1 — Açúcar abaixo do mínimo

**DADO** açúcar com 270 MT/operação, **QUANDO** a demanda for salva, **ENTÃO** o lead é mantido, recebe `Abaixo do Mínimo` e não avança sem aprovação executiva registrada.

### AT2 — Potential de açúcar

**DADO** 1.500 MT/operação, seis operações/ano, especificação e embalagem confirmadas, Incoterm e data firmes e porto atendível, **QUANDO** o score for calculado, **ENTÃO** o resultado é 85/100: 20 + 20 + 15 + 15 + 10 + 5.

### AT3 — Potential de café FoodEra

**DADO** `M=5 MT`, volume de 10 MT/operação, seis operações/ano e demais dimensões confirmadas, **QUANDO** o score for calculado, **ENTÃO** Volume=20, Anual=20, Recorrência=15, Técnica=15, Prontidão=10 e Logística=5, totalizando 85/100.

### AT4 — Potencial anual divergente

**DADO** potencial direto confirmado de 8.000 MT/ano e derivado de 9.000 MT/ano, **QUANDO** o sistema calcular o score, **ENTÃO** usa 8.000, mantém 9.000 visível e gera alerta porque a diferença supera 10%.

### AT5 — Confidence independente da Completude

**DADO** registro nominal recente, empresa ativa, decisor verificado, nenhuma demanda confirmada e Completude de 30%, **QUANDO** calcular Confidence, **ENTÃO** exibe 80/100 e mantém Completude em 30%, sem interferência entre indicadores.

### AT6 — Campo Não confirmado

**DADO** prazo de pagamento como `Não confirmado`, **QUANDO** calcular Completude, **ENTÃO** o campo permanece no denominador, não entra no numerador e aparece como pendência.

### AT7 — Campo Não se aplica

**DADO** campo condicional validamente marcado `Não se aplica`, **QUANDO** calcular Completude, **ENTÃO** o campo sai do numerador e denominador e a justificativa fica auditável.

### AT8 — Sanção apenas por nome

**DADO** nome idêntico ou semelhante em lista oficial, sem identificador confiável, **QUANDO** ocorrer a triagem, **ENTÃO** não há bloqueio definitivo automático; o registro fica em revisão e não pode ser qualificado.

### AT9 — Sanção por identificador confiável

**DADO** identificador empresarial e país confirmados em lista oficial, **QUANDO** ocorrer a triagem, **ENTÃO** o sistema bloqueia automaticamente e registra lista, identificador e data.

### AT10 — Risk parcial normalizado

**DADO** Registro ativo (0, peso 1,00) e Reputação moderada (8, peso 0,75), sem outros componentes, **QUANDO** calcular, **ENTÃO** Risk Score = `6 / 35 × 100 = 17,14`, Coverage = `1,75 / 5 × 100 = 35%` e classificação = `Risco Inconclusivo`.

### AT11 — Plano de mitigação

**DADO** Risk Score 84 e Coverage 100%, **QUANDO** o usuário tentar qualificar sem plano aprovado, **ENTÃO** a transição é impedida e a pendência de mitigação é exibida.

### AT12 — Comprador intermediário

**DADO** um trader sem comprador final identificado, **QUANDO** tentar qualificar, **ENTÃO** a transição é impedida. Após comprador final e relação com a demanda serem validados, o gate pode ser reavaliado.

### AT13 — Risk Coverage insuficiente

**DADO** Coverage de 40%, **QUANDO** tentar qualificar, **ENTÃO** a transição é impedida, salvo dispensa executiva com justificativa, usuário e timestamp.

### AT14 — RBAC

**DADO** os quatro perfis, **QUANDO** ações protegidas forem tentadas, **ENTÃO** somente Administrador altera parâmetros e revisa sanções; Gestor ou Administrador aprova exceções; Vendedor edita dados operacionais; Auditor apenas lê.

## 4. Decisões encerradas

| Tema | Decisão |
|---|---|
| Café | Mínimo configurável; 5 MT apenas para FoodEra no piloto |
| Moeda | USD base; BRL gerencial com taxa, fonte e data |
| CRM | Standalone no MVP |
| RBAC | Quatro perfis fixos |
| Prazo | 12 semanas após aprovação técnica e início efetivo |
| Beta | EAG interno; externo somente com aceite formal |

## 5. Fora do MVP

- automação completa de follow-up;
- integrações Salesforce/HubSpot;
- multi-tenant ativado;
- permissões customizadas;
- bases pagas obrigatórias;
- milho e demais commodities;
- pricing SaaS público;
- reconvocação automática.

## 6. Controle do documento

- **Versão:** 1.3
- **Data:** 2026-09-21
- **Status:** pronta para aprovação formal

