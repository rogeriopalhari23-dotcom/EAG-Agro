# Especificação — EAG Compass v2.0

## Requisitos EARS verificáveis

**Produto:** EAG Compass — descoberta, aprovação e prospecção de compradores de commodities agrícolas (Nacional + Internacional)
**Versão:** 2.0
**Data:** 2026-09-22
**Status:** **APROVADA por Rogério Palhari (Administrador) em 2026-09-22.** Fase 3 encerrada. Conteúdo idêntico ao rascunho 5 (`historico/v2.0-planejamento/…-rascunho5.md`), exceto estas linhas de controle e a ativação de R17.8. Pendências com regra vigente especificada: B1. **Revisão pós-aprovação 1 (2026-09-22):** limites de raio definidos por Rogério (B3) — R11.14, R11.16, R11.17, parâmetros de raio, AT66–AT67. Versão aprovada original em `historico/v2.0-planejamento/eag-compass-spec-v2.0-aprovada-2026-09-22.md`. **Revisão pós-aprovação 2 (2026-09-22):** volume de envio aprovado por Rogério — parâmetros de envio, R19.10–R19.12, AT68–AT69. **Revisão pós-aprovação 3 (2026-09-22):** envio pela caixa Hostinger com risco do §12 assumido por Rogério — R19.13, premissa e gatilho, AT70.
**Rascunhos anteriores:** `docs/historico/v2.0-planejamento/eag-compass-spec-v2.0-rascunho1.md` e `…-rascunho2.md`, `…-rascunho3.md` e `…-rascunho4.md`.
**Versão substituída:** Especificação v1.3 (2026-09-21), arquivada sem alteração em `docs/historico/v1.3/eag-compass-spec-v1.3.md`.
**Constituição associada:** `docs/eag-compass-constituicao.md` (v2.0, aprovada em 2026-09-22).

### Insumos rastreados

| Sigla usada neste documento | Documento | Revisão |
| --- | --- | --- |
| **ESC** | `docs/eag-compass-v2-escopo.md` | revisão 3 |
| **T12** | `docs/eag-compass-t12-prospeccao-vendas.md` | revisão 4 (leitura da skill `33bd093f…9dd8` + decisões K1–K6) |
| **PER** | `docs/eag-compass-perfil.md` | revisão 3 |
| **BEN** | `docs/eag-compass-benchmark.md` | revisão 2 |
| **STA** | `docs/eag-compass-planejamento-status.md` | revisão documental 4 (arquivada em `docs/historico/v2.0-planejamento/`) |
| **v1.3** | Especificação v1.3 | arquivada |

---

## 0. Como ler esta Spec

### 0.1 Numeração

- **R1.1 a R9.2 e AT1 a AT14 mantêm a numeração da v1.3.** Cada um traz a marca **Mantido**, **Revisado** ou **Substituído**. Quando revisado, o texto v1.3 continua no arquivo histórico e aqui aparece apenas a redação vigente e o que mudou.
- **R10 a R27 e AT15 a AT34 são novos na v2.0.** Nenhum número foi reaproveitado.
- Requisito futuramente removido fica marcado como **Retirado**, nunca renumerado.

### 0.2 Planejado × comprovado

Todo requisito desta Spec é **planejado**. Nenhum deles está comprovado por esta Spec. A marca de comprovação de cada requisito indica o que precisa acontecer antes de a funcionalidade ser ativada:

| Marca | Significado |
| --- | --- |
| **[Interno]** | Não depende de integração externa. Comprovado apenas por teste automatizado da implementação. |
| **[Interno · 0.3.1]** | Existe implementação na base 0.3.1 segundo relato anterior (14/14 testes em 2026-09-22). **Não reexecutado nesta fase**; a v2.0 pode exigir alteração. |
| **[Depende de Tn]** | Exige a dependência técnica Tn validada com evidência (ESC §5). Até lá, a funcionalidade não é ativada; alternativa só vale se documentada e compatível com o escopo. |
| **[Proposta Bn / DSn]** | Redação pendente de decisão de Rogério. Não é regra aprovada; a implementação não começa por ela. |
| **[Aprovado Bn]** | Decisão aprovada por Rogério nesta fase; o requisito é vigente, mas continua dependente da integração indicada. |

Estado das dependências na data desta Spec — **nenhuma integração externa foi testada**:

| ID | Dependência | Estado comprovado em 2026-09-22 | Etapa-limite |
| --- | --- | --- | --- |
| T1 | E-mail `eagagro.com` (envio, recebimento, eventos, SPF/DKIM/DMARC) | Não testado | Etapa 0 |
| T2 | WhatsApp Business oficial | Não testado | Antes de habilitar o canal (Etapa 2+) |
| T3 | LinkedIn por modalidade autorizada | Não testado; SNAP informa não aceitar novos parceiros (BEN §4) | Etapa 1 |
| T4 | Fontes de empresas/estabelecimentos no Brasil | Leitura documental de páginas; nada testado | Etapa 1 |
| T5 | Geocodificação, mapa, raio | Não testado | Etapa 1 |
| T6 | Comex Stat — exportações Brasil→país | Documentação lida; nenhuma consulta de dados executada | Etapa 3 |
| T7 | Fontes de empresas no exterior | Não testado | Etapa 3 |
| T8 | Pesquisa com evidências (Camada 2) | Não testado | Etapa 1 |
| T9 | Plano, recursos e custos Cloudflare | Não comprovado; Wrangler autenticado não comprova recursos | Etapa 0 |
| T10 | Hospedagem, autenticação e perfis | Não comprovado | Etapa 0 |
| T11 | Compliance pré-envio e política de ciclo de vida | Não validado com responsável competente | Antes de contatos reais da Etapa 1 |
| T12 | `/prospeccao-vendas` | Versão 1.0.0 do curso EAG Agro (SHA-256 `33bd093f…9dd8`) **lida nesta sessão** e registrada no T12 rev. 3; PV1–PV12 e R28 especificados. Conflitos K1–K6 decididos em 2026-09-22. Gerador, revisor e amostras não implementados. A v1.0 anterior (`94544246…acd0`) foi substituída. | Antes da primeira ficha do piloto |

---

## 1. Glossário

### 1.1 Tipos de evidência — **Revisado**

| Tipo | Definição | Exemplos | Efeito |
| --- | --- | --- | --- |
| Evidência empresarial | Prova vinculada à empresa específica que identifica a empresa e a informação confirmada | Registro alfandegário nominal, BL, documento empresarial, confirmação direta | Pode alimentar Confidence (R5) |
| Evidência de mercado | Contexto agregado de fluxo comercial | Comex Stat: Brasil exportou a commodity para o país | Não prova compra por empresa; não pontua |
| Indício comercial | Sinal ainda não validado | Website, LinkedIn, marketplace, notícia, **cadastro/CNAE compatível**, presença em base paga | Não pontua; sustenta descoberta e aderência |

Mudança: cadastro/CNAE e bases pagas entram expressamente como indício (ESC §2.4 Camada 1, item 3; BEN N4). Toda evidência registra ainda a **condição que sustenta** (R13.4).

### 1.2 Estados — **Mantido, com duas mudanças justificadas** (decisão DS3, 2026-09-22)

**Pipeline da empresa — mantido integralmente.** Mesmos nomes e entradas da v1.3 e do código 0.3.1 (`pipeline_status`):

| Estado | Código 0.3.1 | Requisito de entrada |
| --- | --- | --- |
| Descoberto | `discovered` | Nome da empresa + fonte de indício |
| Prospectado | `prospected` | Pelo menos uma evidência empresarial válida |
| Em Contato | `in_contact` | Contato cuja identidade foi confirmada |
| Em Qualificação | `qualifying` | Formulário iniciado e pelo menos 25% dos campos aplicáveis confirmados |
| Qualificado | `qualified` | Gate R7.2 integralmente atendido |
| Oportunidade Confirmada | `confirmed_opportunity` | Decisor contatado e próximo passo comercial acordado |

O código 0.3.1 também tem `blocked` e `inactive`, que a v1.3 não listava; ficam preservados como estão.

**Mudança necessária 1 — o pipeline deixa de ser pré-requisito do primeiro contato.**
- *Por quê:* a decisão 4 da Fase 3 e ESC §2.3 separam o primeiro contato da qualificação. Se a ficha exigisse `Prospectado`, toda empresa nacional precisaria de evidência empresarial antes do primeiro e-mail. Cadastro ou CNAE não bastam (P1), então o Radar Nacional ficaria sem nenhuma empresa elegível.
- *Efeito:* uma empresa em `Descoberto` pode ter ficha aprovada e sequência em execução. O pipeline continua medindo evidência e qualificação.

**Mudança necessária 2 — estados próprios das entidades novas.**
- *Por quê:* a v1.3 não tinha ficha, sequência, passo de envio, busca nem oferta específica (ESC §2.2). Esses estados não substituem nem renomeiam nenhum estado do pipeline.

| Entidade | Estados |
| --- | --- |
| Ficha (por empresa + campanha + commodity, versionada) | Rascunho · Em aprovação · Aprovada · Substituída por nova versão · Adiada · Descartada |
| Sequência | Aguardando verificação · Em espera (outra sequência ativa para o destinatário) · Ativa · Pausada (com alcance) · Suspensa por resposta · Concluída · Encerrada por supressão/bloqueio |
| Passo de envio | Pendente · Bloqueado na verificação · Solicitado · Aceito pelo provedor · Falha temporária · Falha permanente · Indeterminado · Cancelado antes do envio |
| Busca / análise de país | Em andamento · Concluída · Parcial · Falhou · Substituída por nova versão (R11.12) |
| Oferta específica (opcional) | Rascunho · Vigente · Alterada · Vencida · Encerrada |
| Canal | Planejado · Em teste interno · Habilitado (R26) |

### 1.3 Estados de exceção — **Revisado**

Mantidos: `Sanção em Revisão`, `Sanção Bloqueada`, `Risco Inconclusivo`, `Risco Alto sem Mitigação`, `Fora do ICP`, `Sem Progresso`.
Alterado: `Abaixo do Mínimo` só existe quando há mínimo configurado para a commodity/mercado ou para oferta vinculada (R3.3).
Novos: `Suprimido` (destinatário), `Pausado` (com alcance e motivo, R22), `Localização pendente` (R11.6), `Identidade de produto pendente` (R10.4), `Envio indeterminado` (R19.6).

### 1.4 Definições operacionais — **Revisado**

| Termo | Definição |
| --- | --- |
| Commodity / produto | Item do catálogo EAG com variante e origem (R10) |
| Campanha | Esforço de prospecção de uma commodity num mercado e contexto de busca; pode existir sem oferta específica (R16) |
| Demanda | Necessidade comercial do comprador, confirmada por humano (R27) |
| Oferta específica | Proposta concreta, versionada, opcional na prospecção inicial (R16.3) |
| Origem de prospecção | Commodity + cidade/UF do fornecedor já conhecido, centro do raio no Nacional (R11) |
| Consumidor final confirmado / possível consumidor final / trader-distribuidor / perfil não confirmado | As quatro classes de perfil comprador, por empresa + unidade + produto (R14) |
| Comprador final | Organização que consome, transforma ou utiliza a commodity (mantido da v1.3) |
| Intermediário | Trader ou distribuidor que compra para terceiro; **não bloqueado genericamente** (R2.4) |
| Decisor | Pessoa com autoridade confirmada de compra, orçamento ou assinatura. Cargo identificado ≠ responsabilidade de compra confirmada |
| Ficha de aprovação | Pacote versionado empresa + campanha + commodity + destinatários + canais + fuso + textos finais + regras da sequência (R18) |
| Supressão | Controle independente que impede contato com identificadores derivados, alcance e motivo (R21) |
| Resposta humana | Mensagem recebida do destinatário que não seja ausência automática identificada ou falha técnica |
| Campo confirmado / Não confirmado / Não se aplica / Coverage | Mantidos da v1.3 |

---

## 2. Requisitos funcionais

### Módulo 1 — Descoberta, evidência e sanções

#### R1.1 — Adição manual de empresa — **Revisado** [Interno · 0.3.1]

Origem: v1.3; ESC §2.2 (Empresa), §2.8.

- **R1.1.1:** QUANDO um usuário informar nome, país e fonte de indício, o sistema DEVE criar a empresa como `Descoberto`, registrar usuário e timestamp e classificar a fonte como `Indício comercial`.
- **R1.1.2:** O sistema NÃO DEVE exigir evidência empresarial, oferta específica, lote ou preço para criar o registro.
- **R1.1.3 (novo):** SE já existir empresa com o mesmo identificador (CNPJ raiz no Brasil; identificador legal + tipo + jurisdição no exterior), ENTÃO o sistema DEVE reutilizar o cadastro e acrescentar a nova fonte, sem criar duplicata.
- **R1.1.4 (novo):** SE não houver identificador e existir empresa de nome semelhante, ENTÃO o sistema DEVE criar pendência de deduplicação para decisão humana, sem fundir automaticamente e sem inventar identificador.

#### R1.2 — Triagem de sanções — **Mantido** [Interno · 0.3.1; listas dependem de T11]

Texto v1.3 integral mantido: consulta das listas da política EAG na criação ou alteração de identificadores; bloqueio automático só por país bloqueado ou identificador confiável + país confirmado; correspondência só por nome gera `Sanção em Revisão`, tarefa ao Administrador e impedimento de qualificação; decisão humana registra responsável, data, resultado, motivo e base.

Acréscimo v2.0 (ESC §2.5):

- **R1.2.1:** SE houver `Sanção em Revisão` ou `Sanção Bloqueada`, ENTÃO o sistema DEVE impedir também a aprovação de ficha e todo envio para a empresa (R19.2).

#### R1.3 — Evidência empresarial — **Revisado** [Interno · 0.3.1]

- **R1.3.1:** QUANDO um usuário adicionar registro nominal, BL, documento empresarial ou confirmação direta, o sistema DEVE registrar tipo, referência, empresa identificada, informação confirmada, data do fato, data da consulta, validador e arquivo/URL ou referência interna protegida.
- **R1.3.2:** Após validação, o sistema DEVE alterar o estado para `Prospectado` (se ainda em `Descoberto`), recalcular Confidence (R5) e preservar evidências anteriores, inclusive conflitantes.
- **R1.3.3:** A ausência de evidência empresarial NÃO DEVE impedir a triagem, a ficha ou a sequência inicial (§1.2, mudança 1).

#### R1.4 — Contexto de mercado — **Revisado** [Depende de T6]

- **R1.4.1:** QUANDO o sistema consultar histórico comercial Brasil→país (R12), DEVE registrar origem Brasil, destino, código NCM/HS e versão da classificação, descrição, período, quantidade e unidade, valor e moeda, data da consulta, data de atualização da fonte e fonte.
- **R1.4.2:** A interface DEVE exibir: "O dado confirma exportação do Brasil para o país; não comprova compra por nenhuma empresa específica."
- **R1.4.3:** Evidência de mercado NÃO DEVE alterar Confidence nem classificar empresa.

### Módulo 2 — Contatos, decisor e comprador final

#### R2.1 — Cadastro e estados de contato — **Revisado** [Interno · 0.3.1]

Mantidos os cinco estados independentes da v1.3 (e-mail entregável; identidade; cargo; autoridade decisória; demanda confirmada diretamente), cada um com método, data e fonte. Acréscimos:

- **R2.1.1:** O contato DEVE registrar empresa **e unidade**, canal, URL de perfil quando disponível, fonte, data e grau de confirmação (ESC §2.2).
- **R2.1.2:** QUANDO um contato for cadastrado ou importado, o sistema DEVE consultar a supressão (R21) antes de torná-lo selecionável como destinatário.

#### R2.2 — Transição para Em Contato — **Mantido** [Interno]

Identidade confirmada por resposta, ligação ou outro método rastreável permite `Em Contato` na trilha de qualificação. Entregabilidade isolada não confirma identidade. **Aceite pelo provedor de e-mail também não.**

#### R2.3 — Decisor — **Mantido** [Interno]

Marcar decisor exige evidência de autoridade de compra, orçamento ou assinatura, com método e data. Nível hierárquico vindo de base paga é cargo, não autoridade (BEN D2).

#### R2.4 — Comprador final e intermediário — **Revisado** [Interno · 0.3.1 exige alteração]

Origem: ESC §1 itens 2–4, §2.3; §8.1.

- **R2.4.1:** O perfil comprador DEVE usar as quatro classes de R14, por empresa + unidade + produto.
- **R2.4.2 (revisado — K3):** O sistema NÃO DEVE ocultar, desclassificar nem bloquear a qualificação de uma empresa apenas porque o perfil é trader/distribuidor. A abertura de ficha para trader segue R14.7 (exceção registrada).
- **R2.4.3:** ONDE uma condição comercial confirmada da commodity/mercado ou de oferta específica vinculada exigir comprador final, o sistema DEVE exigir, para a qualificação, o comprador final atendido e evidência da relação com a demanda.
- **R2.4.4:** SE o perfil for `perfil não confirmado`, ENTÃO o sistema DEVE permitir a abordagem aprovada, mas impedir a qualificação até a classificação ser confirmada.

### Módulo 3 — Formulário EAG de demanda e metodologia consultiva

#### R3.1 — Estrutura dos campos — **Revisado** [Interno · 0.3.1]

Mantidos os 17 campos e os estados `Confirmado` / `Não confirmado` / `Não se aplica` da v1.3. Mudanças:

- **R3.1.1:** O formulário DEVE pertencer à trilha de qualificação (demanda), nunca ser exigido para triagem, ficha ou envio da sequência inicial.
- **R3.1.2:** No mercado Nacional, `País de destino` DEVE vir preenchido como Brasil; `Porto/local de entrega` passa a `Local de entrega`; `Incoterm` aceita as condições de entrega configuradas para o mercado interno ou `Não se aplica` com justificativa.
- **R3.1.3:** Campo 15 `Comprador final` DEVE ser obrigatório somente nas condições de R2.4.3; fora delas, é opcional.
- **R3.1.5 (T12 rev. 3):** O formulário DEVE incluir o canal de compra atual (`usina`, `trading`, `outro`, `Não confirmado`) e registrar as 3 perguntas de qualificação da skill (canal de compra, spot × contrato, volume mensal) nos campos correspondentes (Modalidade, Frequência, Volume). Resposta de telefone entra como `Confirmado` apenas com método e data registrados.
- **R3.1.4 (mantido da v1.3 — decisão DS2, 2026-09-22):** Preço indicativo continua opcional e DEVE registrar moeda, unidade comercial, validade e fonte. **USD é a moeda-base nos dois mercados**; BRL, quando exibido, DEVE registrar taxa, fonte e data. Uma alteração dessa regra exige aprovação.

#### R3.2 — Completude — **Mantido** [Interno · 0.3.1]

Fórmula, tratamento de `Não confirmado`, `Não se aplica`, campos opcionais e histórico mantidos. Campo opcional pela regra R3.1.3 não entra no denominador.

#### R3.3 — Volume mínimo — **Revisado** [Interno · 0.3.1 exige alteração]

- **R3.3.1:** QUANDO houver mínimo configurado para a commodity + mercado, ou definido pela oferta específica vinculada, e o volume por operação confirmado ficar abaixo dele, o sistema DEVE conservar o registro, aplicar `Abaixo do Mínimo` e impedir a qualificação até aprovação executiva.
- **R3.3.2:** SE não houver mínimo configurado nem oferta vinculada, ENTÃO o sistema NÃO DEVE aplicar `Abaixo do Mínimo`.
- **R3.3.3:** O mínimo de um fornecedor NÃO DEVE ser aplicado a outras campanhas da mesma commodity que não usem sua oferta (ESC §2.3).
- A aprovação registra aprovador, data, justificativa, volume real e parâmetro vigente (mantido).

#### R3.4 — SPIN e Gap Selling — **Revisado** [Interno]

- **R3.4.1:** QUANDO o usuário preencher ou revisar uma demanda, a interface DEVE oferecer perguntas de Situação, Problema, Implicação e Need-payoff e registrar estado atual, desejado e gap.
- **R3.4.2 (T12 rev. 3):** Na ligação, as perguntas DEVEM ser as 3 perguntas de qualificação da skill (R3.1.5), que são perguntas de Situação. SPIN completo e Gap Selling são apoio 📚 para a reunião conduzida por Rogério, identificados como "não é método do instrutor".
- **R3.4.3:** Sugestões não são respostas e não alteram scores sem confirmação (mantido). Referências da skill não redefinem os campos do formulário EAG de demanda.

### Módulo 4 — Potential Score

#### R4.1 — Cálculo geral — **Mantido** [Interno · 0.3.1]

Fórmula e máximos (30/20/20/15/10/5) mantidos. Regra versionada por commodity **e mercado**; cada cálculo registra a versão (R8.2).

#### R4.2 — Açúcar — **Mantido** [Interno · 0.3.1]

Tabelas da v1.3 mantidas como regra do mercado Internacional. **No Nacional, a tabela de açúcar não se aplica** (DS1): vale R4.3.4.

#### R4.3 — Café e commodities sem tabela específica — **Revisado** [Interno · 0.3.1 exige generalização]

- **R4.3.1:** A tabela relativa ao mínimo `M` da v1.3 DEVE valer para qualquer commodity + mercado que tenha `M` configurado e não tenha tabela específica aprovada.
- **R4.3.2:** SE não houver `M` nem tabela específica, ENTÃO as dimensões Volume e Potencial anual DEVEM ser tratadas como desconhecidas, com Potential exibido em intervalo (R4.5), nunca com pontos presumidos.
- **R4.3.3:** `M = 5 MT/operação` para café FoodEra no piloto internacional (mantido). Tabelas específicas substituem a relativa sem redeploy.
- **R4.3.4 (DS1, aprovada 2026-09-22):** No mercado Nacional, o Potential DEVE seguir a §6.1.2: tabela relativa a `M_N[commodity]` para Volume e Potencial anual, Prontidão por condição de entrega e Logística pela localização dentro do raio.
- **R4.3.5 (DS1-c):** `M_N[commodity]` DEVE ser o mesmo parâmetro que `param_volume_min[commodity, Nacional]`: escala da tabela e mínimo ao mesmo tempo. Volume confirmado abaixo de `M_N` aplica R3.3.1.
- **R4.3.6 (DS1-b):** A qualificação Nacional NÃO DEVE exigir `M_N` configurado. Sem `M_N`, Volume e Anual ficam desconhecidos e o gate usa o menor valor do intervalo (R4.3.2, R4.5).

#### R4.4 — Recorrência e dimensões comuns — **Revisado** [Interno · 0.3.1]

Mantidas as faixas. Logística passa a "porto **ou local de entrega** confirmado e operacionalmente atendível: 5 pontos".

#### R4.5 — Potencial anual e incerteza — **Mantido** [Interno · 0.3.1]

### Módulo 5 — Confidence Score

#### R5.1 — Fórmula — **Revisado parcialmente** [Interno · 0.3.1]

Fórmula, dimensões, pontos e exclusões da v1.3 mantidos. Acréscimos:

- **R5.1.1:** Cadastro, CNAE, presença em base paga, dado agregado de país e aprovação de ficha NÃO DEVEM pontuar em Confidence.
- **R5.1.2 (DS1, aprovada 2026-09-22):** No mercado Nacional, a dimensão "Evidência de compra" DEVE usar a tabela da §6.1.1 (registro público nominal 30, documento comercial nominal 25, documento da empresa 20, indícios 0). As demais dimensões e pontos são os da v1.3. Registro alfandegário e BL NÃO DEVEM pontuar compra doméstica.
- **R5.1.3:** Atualidade DEVE pontuar somente pela data do fato da evidência de compra pontuada; sem evidência pontuada, Atualidade = 0. É a leitura do AT5 da v1.3 (30 + 20 + 15 + 15 = 80), explicitada para os dois mercados.

### Módulo 6 — Risk Score e Coverage

#### R6.1 a R6.3 — **Mantidos** [Interno · 0.3.1]

Componentes, pesos, fórmulas, classificação e separação de sanções mantidos. Fontes de reputação seguem a pesquisa aprovada; Reclame Aqui foi retirado da pesquisa operacional (BEN §10).

### Módulo 7 — Parâmetros e gate de qualificação

#### R7.1 — Parâmetros editáveis sem redeploy — **Revisado** [Interno · 0.3.1]

Mantidos os parâmetros v1.3 e a regra de alteração (Administrador; valor anterior e novo, motivo, usuário, vigência). Novos parâmetros:

| Parâmetro | Padrão | Situação |
| --- | --- | --- |
| `param_volume_min[commodity, mercado, oferta?]` | sem valor salvo onde não configurado | Substitui `[commodity, supplier?]`. No Nacional é o próprio `M_N[commodity]` (R4.3.5); valores por commodity pendentes (Rogério). |
| `param_radius_km_min`, `param_radius_km_max`, `param_radius_km_step`, `param_radius_km_default` | **5 / 1.500 / 100 / 5** — valores permitidos: 5, 100, 200, …, 1.500 km (decisão de Rogério, 2026-09-22) | Aprovado (B3) |
| `param_period_default_months` (Internacional) | **a definir em T6** | Pendente |
| `param_send_daily_limit[canal, remetente]` | **E-mail: 5/dia (semana 1), 10 (semana 2), 15 (semana 3), 20 (semana 4 em diante)**, contando follow-ups | Aprovado por Rogério (2026-09-22) |
| `param_send_interval_minutes` | **15–25 min**, com variação aleatória entre envios | Aprovado (2026-09-22) |
| `param_send_stop_hard_bounce_pct` | **3%** na semana; e **< 2%** como condição para subir de degrau | Aprovado (2026-09-22) |
| `param_send_window` (início/fim no fuso do destinatário) | horário comercial; valores a definir | Pendente |
| `param_campaign_review_days` | a definir por campanha | ESC §2.6 |

- **R7.1.1:** SE um parâmetro exigido por uma funcionalidade não tiver valor aprovado, ENTÃO o sistema DEVE bloquear a ativação dessa funcionalidade e exibir a pendência, sem usar valor implícito.

#### R7.2 — Gate de qualificação — **Revisado** [Interno · 0.3.1 exige alteração]

QUANDO um usuário solicitar avanço para `Qualificado`, o sistema DEVE validar:

1. evidência empresarial válida (confirmação direta conta);
2. Confidence ≥ `param_confidence_min`;
3. menor valor do intervalo Potential ≥ `param_potential_min`;
4. Completude ≥ `param_completeness_min`;
5. nenhuma sanção confirmada ou revisão pendente;
6. Risk Coverage ≥ `param_risk_coverage_min`, salvo dispensa executiva justificada;
7. **perfil comprador confirmado; comprador final atendido apenas nas condições de R2.4.3** (revisado);
8. decisor confirmado;
9. **volume mínimo atendido ou aprovação executiva, somente quando R3.3.1 se aplicar** (revisado);
10. Risk Score < 80 ou plano de mitigação aprovado.

- **R7.2.1 (novo):** O gate NÃO DEVE exigir evidência de importação para comprador do mercado Nacional.
- **R7.2.2 (novo):** O gate de qualificação NÃO DEVE ser aplicado à aprovação da ficha nem à execução da sequência inicial; estas têm verificações próprias (R18, R19).

Falha em qualquer critério impede a transição e exibe pendências acionáveis; aprovações não podem ser implícitas (mantido).

### Módulo 8 — Rastreabilidade e auditoria

#### R8.1 — Histórico — **Revisado** [Interno · 0.3.1]

Mantidos os campos da v1.3. Acréscimo:

- **R8.1.1:** O `audit_log` DEVE aceitar apenas inserção e registrar eventos e referências **sem copiar conteúdo pessoal** (texto de mensagem, e-mail, telefone legíveis) para o histórico imutável (ESC §2.2).
- **R8.1.2:** Eventos obrigatórios: busca iniciada/concluída/falha; aprovação/reprovação/nova versão de ficha; envio solicitado/aceito/falha/indeterminado; resposta; pausa/retomada; supressão; mudança de parâmetro; decisão de sanção.

#### R8.2 — Reprodutibilidade — **Mantido** [Interno · 0.3.1]

Acréscimo: reproduzir também a busca (parâmetros, fontes, período, cobertura) e a análise de país que originaram cada campanha.

### Módulo 9 — Privacidade, segurança e acesso

#### R9.1 — LGPD/GDPR — **Revisado** [Depende de T11 para a política]

Mantida a regra v1.3 (remoção de PII, purga de índices/caches/embeddings, tombstone sem PII, registro sem PII no log, validação jurídica antes da implementação final). Acréscimos:

- **R9.1.1:** Identificadores de supressão DEVEM ser tratados como dados pseudonimizados, sujeitos a finalidade, acesso restrito e retenção; NÃO DEVEM ser chamados de anônimos.
- **R9.1.2:** QUANDO uma exclusão aplicável for executada, o sistema DEVE preservar o identificador de supressão necessário para não voltar a contatar a pessoa, conforme a política aprovada em T11.

#### R9.2 — RBAC — **Revisado** [Interno · 0.3.1; autenticação depende de T10]

Mantidos os quatro perfis fixos e as quatro verificações da v1.3. Novas permissões:

| Ação | Administrador | Gestor Comercial | Vendedor/Analista | Auditor/Visualizador |
| --- | --- | --- | --- | --- |
| Executar busca Nacional/Internacional | ✅ | ✅ | ✅ | — |
| Preparar ficha e textos | ✅ | ✅ | ✅ | — |
| **Aprovar ficha / autorizar sequência** | ✅ | ✅ | — | — |
| Pausar (empresa, campanha, commodity) | ✅ | ✅ | ✅ | — |
| **Pausar operação inteira / retomar operação** | ✅ | ✅ | — | — |
| Consultar lista de supressão | ✅ | — | — | — |
| Registrar descadastro recebido | ✅ | ✅ | ✅ | — |
| Remover supressão | ✅, com motivo e base | — | — | — |
| Habilitar canal/integração | ✅ | — | — | — |
| Ler linha do tempo e auditoria | ✅ | ✅ | ✅ | ✅ |

- **R9.2.1:** SE um perfil sem permissão tentar ação protegida, ENTÃO o sistema DEVE negar no servidor, registrar a tentativa e não alterar estado.
- Multi-tenant e permissões customizadas continuam fora do escopo (mono-tenant EAG).

---

### Módulo 10 — Catálogo de produtos — **Novo**

#### R10 — Catálogo com variante, origem e classificação [Interno]

Como Rogério, quero prospectar qualquer commodity do catálogo EAG com identidade clara, para que a abordagem nunca prometa o que não foi confirmado.
Origem: ESC §2.2 (Produto), PER §3–§4.

- **R10.1:** O sistema DEVE armazenar cada produto com grupo, variante, origem (`SITE`, `SOLICITAÇÃO`, `PORTFÓLIO`, podendo ter mais de uma), URL ou referência, data da consulta e responsável.
- **R10.2:** O catálogo inicial DEVE conter as 28 entradas de PER §3, sem nenhuma oferta específica, lote, preço ou disponibilidade associados.
- **R10.3:** Cada variante DEVE aceitar códigos NCM/HS com versão da classificação e estado (`confirmado` / `pendente`). SE o código estiver `pendente`, ENTÃO o sistema DEVE permitir cadastro e campanha nacional, mas NÃO DEVE usá-lo como correspondência comprovada no histórico internacional (R12.4).
- **R10.4:** SE a identidade do produto estiver pendente (caso atual: CSO), ENTÃO o sistema DEVE marcar `Identidade de produto pendente` e bloquear busca e ficha específicas desse item, sem bloquear os demais.
- **R10.5:** Características técnicas DEVEM registrar fonte e estado de confirmação; laudo de amostra DEVE ser marcado como válido apenas para a amostra.
- **R10.6:** SE uma característica não estiver confirmada, ENTÃO o gerador de textos (R17) NÃO DEVE citá-la.
- **R10.7:** QUANDO a comercialização de uma commodity for suspensa para uma origem ou mercado, o sistema DEVE aplicar R22.3.

### Módulo 11 — Radar Nacional de Compradores — **Novo**

#### R11 — Busca por commodity + cidade/UF do fornecedor + raio [Depende de T4, T5, T8]

Como Rogério, quero informar a commodity, a cidade/UF onde já tenho fornecedor e um raio, para ver compradores próximos e escolher quem abordar.
Origem: ESC §1, §2.4 (Dashboard Nacional 1–8), decisão 1 da Fase 3; BEN §2; B3.

- **R11.1:** QUANDO o usuário iniciar uma busca nacional, o sistema DEVE exigir commodity, cidade, UF e raio em km, e NÃO DEVE exigir fornecedor cadastrado, lote, preço, oferta ou cotação.
- **R11.2:** O sistema DEVE registrar a origem de prospecção com o ponto geográfico adotado e sua precisão (`ponto representativo da cidade`, `endereço`, `coordenada informada`), permitindo refinamento opcional por endereço ou coordenada.
- **R11.3:** O mapa DEVE exibir o ponto representativo da cidade como referência aproximada, nunca como endereço do fornecedor.
- **R11.4:** O sistema NÃO DEVE pesquisar, sugerir ou cadastrar fornecedores a partir do radar.
- **R11.5:** A distância DEVE ser calculada a partir da unidade consumidora ou de recebimento; na falta, da sede; e DEVE exibir qual localização e qual precisão foram usadas. Distância rodoviária, quando existir, DEVE aparecer separada da geográfica.
- **R11.6:** SE a localização do candidato for aproximada (centro de bairro/cidade) ou ausente, ENTÃO o sistema DEVE marcá-lo como `dentro do raio — estimado` ou `Localização pendente`, e NÃO DEVE apresentá-lo como comprovadamente dentro do raio.
- **R11.7:** O sistema DEVE exibir mapa e lista de **todos** os candidatos retornados pelas fontes consultadas, com paginação, e NÃO DEVE limitar a descoberta aos 5–10 do piloto.
- **R11.8:** O resultado DEVE exibir fontes consultadas, cobertura, falhas, truncamentos e limites atingidos, e NÃO DEVE declarar cobertura de todas as empresas existentes.
- **R11.9:** A ordenação padrão DEVE priorizar aderência ao ICP da campanha (R28.1) e consumidores finais no porte do ICP (R14.3, K1); traders e distribuidores DEVEM continuar visíveis e classificados, com prioridade secundária, respeitando filtros e condições confirmadas.
- **R11.10:** Cada resultado DEVE apresentar empresa/unidade, atividade, localização e precisão, distância, porte com fonte (ou pendência), perfil comprador, evidências, decisores, contatos, scores e próxima ação.
- **R11.11 [Aprovado B3]:** O raio DEVE ser um número positivo em quilômetros. SE o raio for zero, negativo ou não numérico, ENTÃO o sistema DEVE recusar a busca e informar o motivo.
- **R11.12 [Aprovado B3]:** QUANDO o usuário alterar o raio, o sistema DEVE criar uma nova versão da busca e preservar sem alteração os parâmetros e resultados das versões anteriores.
- **R11.14 [Aprovado B3 — limites, 2026-09-22]:** O raio DEVE aceitar somente os valores 5 km (padrão inicial) e de 100 km a 1.500 km em passos de 100 km (100, 200, …, 1.500). SE o raio informado não for um desses valores, ENTÃO o sistema DEVE recusar a busca e exibir os valores permitidos. Os limites foram definidos por Rogério e não copiam limites de fornecedores (Econodata, Google).
- **R11.16 [Aprovado B3]:** QUANDO a busca nacional for aberta, o raio DEVE vir preenchido com 5 km; o usuário amplia escolhendo o próximo valor permitido, e cada ampliação gera nova versão da busca (R11.12).
- **R11.17 [Aprovado B3]:** Em qualquer raio, inclusive 1.500 km, o sistema DEVE listar **todos** os possíveis compradores encontrados nas fontes consultadas dentro do raio (R11.7), paginados, e DEVE oferecer ordenação por distância crescente ao ponto de referência. SE uma fonte truncar resultados ou atingir limite, ENTÃO a busca DEVE continuar por partições (ex.: por UF ou município) até esgotar a fonte, ou marcar a cobertura como parcial com o motivo (R11.8, R11.13). Custo e tempo de cada busca DEVEM ser registrados (R13.5).
- **R11.15 [Aprovado B3]:** O sistema DEVE informar em cada busca a origem de prospecção (cidade/UF de referência) e o raio usado, e ambos DEVEM aparecer na versão da busca.
- **R11.13:** SE uma fonte falhar ou atingir limite, ENTÃO o sistema DEVE registrar a falha, manter os resultados parciais marcados como parciais e permitir retomada sem duplicar candidatos.

### Módulo 12 — Internacional País Primeiro — **Novo**

#### R12 — País → histórico agrícola Brasil→país → seleção → empresas [Depende de T6, T7, T8]

Como Rogério, quero informar só o país, ver o que ele comprou do Brasil e escolher as commodities, para só então buscar empresas compradoras.
Origem: ESC §1, §2.4 (País Primeiro 1–9), decisão 2 da Fase 3; BEN §3.

- **R12.1:** QUANDO o usuário iniciar uma análise internacional, o sistema DEVE exigir apenas o país e NÃO DEVE exigir commodity, NCM, lote ou preço.
- **R12.2:** O sistema DEVE consultar as **exportações do Brasil para o país** (nunca importações do Brasil) no período padrão `param_period_default_months`, ajustável pelo usuário, e registrar o período usado.
- **R12.3:** O resultado DEVE listar as commodities agrícolas identificadas conforme classificação agrícola versionada, com código e descrição NCM/HS, quantidade e unidade, valor e moeda, período, última ocorrência disponível, fonte e data de atualização.
- **R12.4:** O sistema DEVE destacar a correspondência com o catálogo EAG (R10) sem restringir o panorama ao catálogo, e sem usar código `pendente` como correspondência comprovada.
- **R12.5:** O sistema NÃO DEVE somar unidades incompatíveis, duplicar totais por mapeamentos sobrepostos, nem inferir variedade/qualidade que o código não distingue.
- **R12.6:** O sistema DEVE usar três estados distintos por consulta: `compra identificada`, `nenhum registro no período`, `dados indisponíveis`. SE a consulta falhar, for parcial ou exceder limites, ENTÃO o sistema DEVE exibir `dados indisponíveis` ou `parcial`, nunca `nenhum registro`.
- **R12.7:** QUANDO o usuário selecionar uma ou mais commodities e autorizar a busca, o sistema DEVE registrar a seleção, o autor, a data e a análise que a fundamentou, e criar uma campanha por commodity (R16).
- **R12.8:** O sistema NÃO DEVE iniciar busca de empresas no país antes da seleção registrada em R12.7.
- **R12.9:** SE a commodity selecionada não estiver no catálogo confirmado da EAG, ENTÃO o sistema DEVE exigir validação comercial registrada antes de permitir ficha para essa campanha.
- **R12.10:** Para cada empresa encontrada, o sistema DEVE registrar separadamente, com evidência própria: `importa do Brasil`, `compra a commodity`, `consome como matéria-prima`. O dado agregado do país NÃO DEVE preencher nenhuma dessas condições.

### Módulo 13 — Descoberta em duas camadas e evidências — **Novo**

#### R13 — Candidatos, verificação e cobertura [Depende de T4, T7, T8]

Origem: ESC §2.2 (Busca, Evidência), §2.4 Arquitetura comum; BEN N4.

- **R13.1:** A Camada 1 (fontes estruturadas) DEVE gerar candidatos registrando fonte, data e parâmetros; cadastro ou CNAE compatível DEVE ser registrado como indício.
- **R13.2:** A Camada 2 (pesquisa com evidências) DEVE registrar, para cada afirmação, fonte, trecho ou referência, data do fato quando conhecida, data da consulta e responsável (humano ou processo identificado).
- **R13.3:** SE uma informação não for encontrada, ENTÃO o sistema DEVE registrá-la como pendência, e NÃO DEVE preenchê-la por dedução.
- **R13.4:** No Internacional, cada evidência DEVE indicar qual condição de R12.10 ela sustenta.
- **R13.5:** Cada busca DEVE registrar parâmetros, fontes, período, status, cobertura, número de candidatos, custo e tempo (métricas do piloto, ESC §4.2).
- **R13.6:** SE a mesma empresa aparecer em outra busca, ENTÃO o sistema DEVE reutilizar o cadastro e acrescentar unidades, produtos, evidências e contextos de busca (R1.1.3, R23.1).
- **R13.7:** Fontes pagas DEVEM entrar por adaptador substituível, ativado somente após decisão registrada de custo, cobertura e qualidade.

### Módulo 14 — Perfil comprador e priorização — **Novo**

#### R14 — Quatro classes por empresa + unidade + produto [Interno]

Origem: ESC §1, §2.2 (Perfil comprador), decisão 3 da Fase 3.

- **R14.1:** O sistema DEVE classificar cada combinação empresa + unidade + produto em: `consumidor final confirmado`, `possível consumidor final`, `trader/distribuidor`, `perfil não confirmado`, com fundamento (evidência ou pendência) registrado.
- **R14.2:** `consumidor final confirmado` DEVE exigir evidência empresarial ou confirmação direta; indício só permite `possível consumidor final`.
- **R14.3 (K1 e K3, decididos em 2026-09-22):** A priorização DEVE seguir o ICP da skill: indústrias usuárias da commodity, de porte médio ou média-mais (a partir de ~50 funcionários), antes das demais. Todas as empresas encontradas continuam visíveis e classificadas no Radar (decisão 1).
- **R14.6 (K1):** SE a empresa for pequena demais ou MEI, ENTÃO o sistema DEVE marcá-la "fora do ICP — porte" e NÃO DEVE permitir ficha. SE for gigante do setor (ex.: líderes nacionais), ENTÃO o sistema DEVE marcá-la "fora do ICP — gigante" e só permitir ficha havendo relacionamento prévio registrado (autor, data, descrição).
- **R14.7 (K3):** SE o perfil for trader/distribuidor, ENTÃO a empresa fica fora da prospecção ativa, e a ficha só DEVE ser permitida por exceção registrada para aquela empresa, com autor (Gestor Comercial ou Administrador), data e motivo, visível na ficha.
- **R14.8 (K1):** SE o porte for desconhecido, ENTÃO a ficha DEVE exigir a pendência de porte resolvida ou a qualificação do porte registrada como objetivo da ligação (skill: "manter e qualificar volume na ligação").
- **R14.4:** SE o porte for desconhecido, ENTÃO o sistema DEVE exibir pendência de porte e manter a empresa nos resultados; empresas maiores com aderência e canal identificado DEVEM permanecer.
- **R14.5:** SE uma restrição comercial confirmada para produto, mercado ou origem excluir um perfil, ENTÃO o sistema DEVE aplicar a restrição apenas ao contexto em que foi confirmada e exibir o motivo.

### Módulo 15 — Contatos, decisores e LinkedIn assistido — **Novo**

#### R15 — Decisores com fonte e modo assistido [LinkedIn automatizado depende de T3]

Origem: ESC §2.4 (LinkedIn e decisores); BEN §4; T12 módulos 2 e 8.

- **R15.1:** O sistema DEVE registrar para cada contato: nome, cargo, papel na prospecção (`decisor/comprador`, `influenciador/gestor de compras`, `decisor provisório — sócio-administrador`, `outro`), fonte, data e grau de confirmação; cargo não implica autoridade (R2.3).
- **R15.6 (T12 rev. 3):** SE o contato for CEO/diretoria sem relacionamento prévio registrado, ENTÃO o sistema DEVE sinalizá-lo como fora do alvo preferencial da skill; perfis de operação, RH ou logística DEVEM ser marcados como fora do ICP.
- **R15.2:** O sistema NÃO DEVE solicitar, armazenar ou usar senha ou cookies de sessão do LinkedIn.
- **R15.3:** ENQUANTO T3 não comprovar capacidade autorizada de pesquisa ou envio, o sistema DEVE oferecer apenas o modo assistido: pesquisa guiada, registro humano do perfil e mensagem preparada para envio manual.
- **R15.4:** QUANDO um envio manual for registrado, o sistema DEVE incluí-lo na linha do tempo com autor, data, canal e versão do texto usado.
- **R15.5:** Tarefa manual planejada (ligação, LinkedIn) NÃO DEVE ser tratada como contato ocorrido em textos ou estados (T12 A2).

### Módulo 16 — Campanha e oferta específica opcional — **Novo**

#### R16 — Campanha por commodity; oferta só quando usada [Interno]

Origem: ESC §2.2 (Campanha, Oferta), §2.6, decisão 4 da Fase 3; PER regra da revisão 3.

- **R16.1:** O sistema DEVE permitir criar campanha com commodity, mercado, contexto de busca (origem/raio ou país/análise), público, idioma, duração/revisão e modelo de sequência, **sem oferta específica**.
- **R16.2:** Busca, ficha, aprovação e envio da sequência inicial NÃO DEVEM exigir oferta, lote, estoque, preço, cotação ou cadastro completo de fornecedor.
- **R16.3:** QUANDO uma oferta específica for criada, o sistema DEVE versioná-la com produto/variante, fornecedor quando identificado, especificação, disponibilidade, mínimo, condições, exigência de comprador final e validade.
- **R16.4:** Uma oferta PODE ser vinculada a várias campanhas ou fichas; o vínculo é explícito e opcional.
- **R16.5:** SE uma oferta vinculada mudar ou vencer, ENTÃO o sistema DEVE pausar apenas as sequências que a utilizam (R22.4) e NÃO DEVE pausar campanhas gerais que não a utilizam.
- **R16.6:** Dados de oferta não confirmados NÃO DEVEM aparecer em textos como promessa.
- **R16.7 (K6):** Cada campanha DEVE aceitar "declarações aprovadas": (a) volume disponível da commodity — sim/não, autor, data e validade de revisão; (b) texto de prova social aprovado, com autor e data. Não exige lote, preço, cotação nem oferta específica.
- **R16.8 (K6):** SE a declaração não existir, estiver negativa ou com revisão vencida, ENTÃO a frase correspondente do roteiro da skill DEVE ser omitida, mantendo a estrutura do texto. Mudança de declaração em campanha com fichas aprovadas segue R18.4 (nova versão e aprovação).

### Módulo 17 — Textos conforme `/prospeccao-vendas` — **Novo**

#### R17 — Geração e revisão antes da aprovação [T12: implementação e amostras pendentes]

Como Rogério, quero textos que sigam a metodologia `/prospeccao-vendas` e só afirmem o que tem fonte, para aprovar com segurança.
Origem: ESC D8, §2.11; T12 §2–§6.

- **R17.1:** Cada texto gerado DEVE registrar o SHA-256 do `SKILL.md` efetivamente lido e incorporado, a versão das adaptações Compass e a versão do gerador. PV1–PV12 derivam da versão `33bd093f…9dd8` (T12 rev. 3).
- **R17.8:** SE o SHA-256 da skill disponível for diferente do incorporado, ENTÃO o sistema DEVE impedir a geração de novos textos até nova leitura registrada (T12) e revisão de PV/A. Textos já aprovados não são reescritos (R17.5). *Vigente desde a aprovação (2026-09-22): hash de referência `33bd093f5dcb87a7d4aa51d31597c6d6ddfc637097693e3830a38f9b219f9dd8`.*
- **R17.2:** Textos DEVEM ser gerados e revisados **antes** da aprovação; o sistema NÃO DEVE gerar nem reescrever texto no momento do disparo.
- **R17.3:** O revisor automático DEVE verificar os critérios PV1–PV12 abaixo e exibir cada violação na ficha. SE houver violação não resolvida, ENTÃO o sistema DEVE impedir a aprovação da ficha.

| ID | Critério verificável | Origem na skill (T12 rev. 3) |
| --- | --- | --- |
| PV1 | E-mail 1: saudação → como achou o contato (fato registrado) → quem é (EAG Agro, commodities) → [volume disponível e prova social só se aprovados, K6] → objetivo só de iniciar conversa → pedido de ~20 min | scripts-abordagem §1 |
| PV2 | Uma commodity por sequência; sem lista de portfólio; sem PDF, anexo, link de apresentação ou proposta | I2, I3, I7 |
| PV3 | O objetivo de cada toque é o próximo passo (conversa/reunião de 20–30 min) ou descobrir a pessoa certa; nenhum toque tenta vender o produto | I1 |
| PV4 | Toda afirmação é verdadeira e registrada (como achou o contato, fatos da empresa, mercado com fonte + data); "estou em contato por e-mail" só após e-mail enviado | I10; eval 21 |
| PV5 | 3–4 e-mails em dias diferentes, nunca seguidos: E-mail 2 "chegou a ver?"; E-mail 3 reaparece com ângulo novo; E-mail 4 = break | scripts-abordagem §1; cadência |
| PV6 | Break só ao fim da sequência sem resposta, supressão, bloqueio ou pausa; depois dele, parar | I4; A11 |
| PV7 | Sem preço, cotação, lote, estoque, prazo, certificação, pagamento, concorrente ou fornecedor atual; volume disponível e prova social só por declaração aprovada (K6) | I2; ESC §2.5 |
| PV8 | Destinatários: comprador (decisor) e gestor de compras (influenciador); CEO/diretoria só com relacionamento prévio; sócio-administrador marcado "provisório"; sem afirmar autoridade não confirmada | I3 |
| PV9 | Assunto diz o que o comprador busca ("Fornecedor [commodity]"); sem título estatístico/"criativo" | I8 |
| PV10 | Tom de consultor, direto, sem formalidade de vendedor nem pedido de desculpas; português (ou idioma da campanha) revisado | Voz do instrutor; eval 36 |
| PV11 | Mensagem ao influenciador (E-mail 3) mantém o pedido de conversa e não repete o texto do decisor | Cadência, semana 2 |
| PV12 | Internacional: mesma estrutura no idioma do país (inglês por padrão), lacuna 🔴 registrada na ficha | Lacuna declarada |

- **R17.4:** Textos DEVEM seguir os roteiros de `references/scripts-abordagem.md` da skill, trocando `[SUA EMPRESA]` e `[COMMODITY]` e mantendo a estrutura; conteúdo específico vem do catálogo, das evidências, da campanha e das declarações aprovadas (K6). Frameworks 📚 (SPIN, Gap, Voss) NÃO DEVEM ser usados em texto automático: servem à reunião conduzida por Rogério.
- **R17.5:** QUANDO a skill for atualizada, o sistema NÃO DEVE reescrever mensagens aprovadas; DEVE marcar as fichas afetadas para revisão, e SE houver conflito identificado, ENTÃO DEVE impedir novos envios da ficha até nova versão aprovada.
- **R17.6:** Antes da primeira ficha real do piloto, amostras internas DEVEM cobrir E-mails 1–4, mensagem ao influenciador, sequência interrompida antes do break e um caso internacional em inglês, com revisão registrada por Rogério.
- **R17.7:** Nova sequência após encerramento DEVE exigir nova ficha e aprovação; o sistema NÃO DEVE reconvocar automaticamente (A5).

### Módulo 18 — Triagem e ficha de aprovação — **Novo**

#### R18 — Aprovação empresa a empresa, texto congelado [Interno]

Origem: ESC §2.2 (Ficha), §2.5, decisão 5 da Fase 3.

- **R18.1:** A ficha DEVE conter empresa, campanha, commodity, contexto geográfico ou de país, evidências, pendências, destinatários, canais, fuso confirmado, textos finais de toda a sequência, intervalos, regras da sequência e referência à skill (R17.1). Oferta específica é referência opcional.
- **R18.2:** Na triagem e na ficha, o usuário DEVE poder aprovar, pedir complementação, adiar ou descartar; adiar e descartar exigem motivo.
- **R18.3:** A aprovação DEVE autorizar somente aquela versão da ficha: empresa, campanha, commodity, destinatários, canais, textos e sequência; follow-ups nela previstos dispensam nova aprovação.
- **R18.4:** QUANDO texto, destinatário, canal, intervalo ou condição aprovada mudar, o sistema DEVE suspender os passos afetados, criar nova versão e exigir nova aprovação, preservando histórico e envios concluídos.
- **R18.5:** QUANDO mudar apenas anotação interna sem efeito em conteúdo ou elegibilidade, o sistema DEVE registrar a edição sem invalidar a aprovação.
- **R18.6:** SE o fuso de algum destinatário estiver pendente, ENTÃO o sistema DEVE impedir a aprovação.
- **R18.7:** SE a mesma aprovação for enviada duas vezes (duplo clique, reenvio, duas abas), ENTÃO o sistema DEVE registrar uma única aprovação para a versão e NÃO DEVE criar passos duplicados.
- **R18.8:** SE dois usuários editarem a mesma ficha, ENTÃO o sistema DEVE detectar o conflito na segunda gravação e recusá-la com aviso, sem sobrescrever.
- **R18.9:** A aprovação NÃO DEVE ser apresentada como prova de compra, consumo ou interesse.
- **R18.10 (T12 rev. 3):** Antes da aprovação, o sistema DEVE permitir o envio de prova de cada e-mail da sequência para o endereço de Rogério (revisão de título e português), sem contar como passo da sequência nem contato com o destinatário.

### Módulo 19 — Execução da sequência e verificação pré-envio — **Novo**

#### R19 — Envio só da versão congelada, sem duplicidade [E-mail depende de T1; compliance depende de T11]

Origem: ESC §2.5, §2.6 (retomadas), §4.1 critérios 1–2 e 5.

- **R19.1:** O sistema DEVE enviar somente o texto congelado da versão aprovada, ao destinatário e canal aprovados.
- **R19.2:** Imediatamente antes de cada disparo, o sistema DEVE verificar, e SE qualquer item falhar, ENTÃO NÃO DEVE enviar e DEVE registrar o motivo:
  1. supressão do destinatário e canal;
  2. pausas aplicáveis (R22);
  3. aprovação vigente da versão;
  4. correspondência destinatário + canal + texto + versão;
  5. campanha e commodity habilitadas no contexto;
  6. elegibilidade comercial e ausência de bloqueio de sanção/compliance;
  7. fuso, janela `param_send_window` e limite diário;
  8. identificador estável do passo ainda sem envio aceito;
  9. versão e validade da oferta específica **apenas se vinculada**;
  10. canal habilitado com integração comprovada (R26);
  11. endereço de e-mail validado por verificador, com data (skill I6); endereço deduzido de padrão de domínio sem validação NÃO DEVE receber envio;
  12. nenhum outro e-mail da sequência enviado ao mesmo destinatário no dia civil anterior, no fuso dele (skill: nunca e-mail em dias seguidos).
- **R19.10 (volume, aprovado em 2026-09-22):** O sistema DEVE limitar os envios de e-mail de prospecção por remetente ao degrau vigente da rampa (5, 10, 15, 20 por dia, contando follow-ups) e espaçar os envios de 15 a 25 minutos com variação aleatória, só em horário comercial no fuso do destinatário. SE o limite do dia for atingido, ENTÃO os passos restantes DEVEM ficar para o próximo dia útil, sem reordenar a sequência nem quebrar a regra de dias não seguidos.
- **R19.11:** O sistema DEVE subir um degrau da rampa somente QUANDO, nas 2 semanas anteriores, não houver marcação de spam conhecida, o hard bounce for < 2% e não houver aviso ou bloqueio do provedor; a subida é registrada com data e métricas. Subida manual acima do degrau exige Administrador e motivo.
- **R19.13 (risco Hostinger assumido, 2026-09-22):** Todo e-mail de prospecção DEVE conter, além da forma de saída (R21.7): remetente real (`rogeriopalhari@eagagro.com`), endereço de resposta legítimo e o **endereço físico da EAG** na assinatura, conforme os requisitos listados no §12 dos termos da Hostinger. SE algum desses itens faltar no texto, ENTÃO o revisor DEVE impedir a aprovação da ficha.
- **R19.12:** SE houver reclamação ou marcação de spam conhecida, aviso ou bloqueio de envio do provedor, ou hard bounce ≥ 3% na semana, ENTÃO o sistema DEVE pausar a operação inteira de envio (R22.1), alertar Rogério e só retomar por ação de Administrador com motivo registrado.
- **R19.3:** SE a verificação de compliance estiver indisponível, ENTÃO o envio DEVE aguardar verificação válida ou alternativa prevista na política aprovada; indisponibilidade NÃO DEVE liberar o envio.
- **R19.4:** Cada passo DEVE ter identificador estável; QUANDO o mesmo passo for acionado novamente (reexecução, retomada, reaprovação), o sistema NÃO DEVE reenviar passo já aceito pelo provedor.
- **R19.5:** O sistema DEVE registrar somente o estado informado pelo provedor; aceite NÃO DEVE ser exibido como entrega final ou leitura.
- **R19.6:** SE o resultado do envio for indeterminado, ENTÃO o sistema DEVE marcar `Envio indeterminado` e reconciliar com o provedor antes de qualquer nova tentativa.
- **R19.7:** SE ocorrer falha permanente, ENTÃO o sistema DEVE bloquear o endereço afetado e NÃO DEVE trocar de canal fora da autorização da ficha.
- **R19.8:** ENQUANTO o destinatário tiver uma sequência ativa, qualquer outra sequência para ele DEVE ficar em espera e, ao ser liberada, passar novamente por R19.2; textos de sequências distintas NÃO DEVEM ser combinados.
- **R19.9:** O sistema NÃO DEVE responder, negociar ou fechar automaticamente com compradores.

### Módulo 20 — Respostas — **Novo**

#### R20 — Resposta suspende empresa + commodity e vai para Rogério [Recebimento depende de T1]

Origem: ESC §2.5 (Resposta, Extração), §4.1 critério 4; BEN S1–S4; B1.

- **R20.1:** QUANDO uma resposta humana for recebida, o sistema DEVE suspender todos os contatos automáticos da **mesma empresa para a mesma commodity**, em todas as campanhas, canais e decisores relacionados, e abrir tarefa para Rogério.
- **R20.2:** QUANDO a resposta se referir a oferta específica vinculada, o sistema DEVE suspender também as sequências vinculadas a essa oferta.
- **R20.3:** Respostas DEVEM ser registradas como evento separado da entrega, correlacionadas ao passo e à ficha.
- **R20.4:** Informações de demanda extraídas DEVEM aparecer como sugestões ao lado da mensagem de origem e só virar dado após confirmação humana.
- **R20.5:** Sequências da mesma empresa para **outras** commodities NÃO DEVEM ser suspensas automaticamente pela resposta; DEVEM exibir alerta para decisão de Rogério.
- **R20.6:** SE não for possível classificar a mensagem recebida, ENTÃO o sistema DEVE tratá-la como resposta humana (pausa empresa + commodity) até revisão.
- **R20.7 (regra vigente enquanto B1 estiver pendente):** SE a mensagem recebida for ausência automática, identificada ou não, ENTÃO o sistema DEVE aplicar a mesma pausa por resposta da revisão 3 (R20.1: empresa + commodity) e abrir tarefa para Rogério.
- **R20.8:** O sistema NÃO DEVE retomar automaticamente nenhuma sequência pausada por mensagem recebida. Retomada só por ação humana registrada, com R19.2 reexecutado. Supressão e bloqueio prevalecem sobre qualquer retomada.
- **R20.9:** Contato substituto citado em mensagem recebida NÃO DEVE virar destinatário sem nova ficha aprovada.
- **Proposta B1 (não vigente, não implementar):** ausência identificada pausaria só a pessoa e não contaria como resposta comercial; retomada automática só se prevista na ficha, com data e fuso inequívocos. Só entra em vigor como exceção aprovada, com nova redação de R20.7.

### Módulo 21 — Supressão e descadastro — **Novo**

#### R21 — Supressão independente e prioritária [Interno; mecanismo técnico de saída depende de T1]

Origem: ESC §2.2 (Supressão), §2.5 (Descadastro), §2.8; BEN S5; B2.

- **R21.1:** A lista de supressão DEVE ser independente do cadastro de contatos e registrar identificador derivado, canal, motivo, data, alcance e critério de retenção, com acesso restrito (R9.2).
- **R21.2:** QUANDO um pedido de descadastro for recebido por qualquer meio (link, resposta, contato manual), o sistema DEVE suprimir os canais e endereços comprovadamente vinculados à pessoa, em todas as campanhas e propostas, antes do próximo envio agendado.
- **R21.3:** O sistema NÃO DEVE inferir identidade pelo nome para estender a supressão.
- **R21.4:** QUANDO houver descadastro, os demais destinatários da mesma empresa DEVEM ficar condicionados a nova aprovação, com o aviso do descadastro visível na ficha.
- **R21.5:** Reimportações NÃO DEVEM remover supressões, pausas ou respostas.
- **R21.6:** Após supressão, o sistema NÃO DEVE enviar mensagem de encerramento ou despedida.
- **R21.7 [Aprovado B2 · mecanismo depende de T1]:** Todo e-mail de sequência, em todos os passos, DEVE conter forma clara de saída.
- **R21.9 [Aprovado B2]:** QUANDO um descadastro for acionado pela forma de saída, o sistema DEVE processá-lo diretamente na supressão (R21.2), antes do próximo envio agendado, sem exigir login ou confirmação adicional do destinatário.
- **R21.10 [Aprovado B2 · depende de T1]:** O sistema DEVE implementar o mecanismo técnico de descadastro aplicável ao provedor escolhido em T1, como descadastro em um clique quando exigido. O mecanismo concreto é definido e comprovado em T1; sem ele, o e-mail não passa a `habilitado` (R26.3).
- **R21.8:** As supressões do OpenClaw DEVEM ser importadas antes do primeiro envio do piloto (R25.2).

### Módulo 22 — Pausas e mudanças comerciais — **Novo**

#### R22 — Alcance explícito das pausas [Interno]

Origem: ESC §2.6, §2.7.

- **R22.1:** O sistema DEVE oferecer pausa por empresa, campanha, commodity/contexto, oferta específica vinculada e operação inteira, com motivo, autor e data.
- **R22.2:** Pausar uma campanha NÃO DEVE pausar campanhas independentes.
- **R22.3:** QUANDO a comercialização de uma commodity for suspensa para uma origem ou mercado, o sistema DEVE pausar as campanhas correspondentes e alertar Rogério; a retomada DEVE exigir confirmação do contexto e das fichas afetadas.
- **R22.4:** QUANDO uma oferta vinculada mudar ou vencer, o sistema DEVE pausar apenas as sequências que a usam, mostrar diferenças, reverificar elegibilidade e exigir nova aprovação.
- **R22.5:** QUANDO mudar cidade de origem, produto, país ou contexto que fundamentou a aprovação, o sistema DEVE reavaliar elegibilidade, evidências e textos e exigir nova aprovação antes da retomada.
- **R22.6:** QUANDO a duração da campanha terminar ou a revisão vencer, o sistema DEVE pausar para revisão, sem exigir cotação.
- **R22.7:** Toda retomada DEVE reexecutar R19.2 e continuar dos passos pendentes, preservando os concluídos.
- **R22.8:** A interface NÃO DEVE exibir pausa como cancelamento de mensagem já enviada.

### Módulo 23 — Ciclo de vida do dado — **Novo**

#### R23 — Duplicidade, concorrência, descarte e exclusão [Interno; retenção depende de T11]

Origem: ESC §2.8.

- **R23.1:** SE a mesma empresa voltar em nova busca ou importação, ENTÃO o sistema DEVE reutilizar o cadastro, sem duplicar por nome semelhante nem fundir sem identificação suficiente.
- **R23.2:** SE a mesma busca for submetida duas vezes em sequência (reenvio, duplo clique), ENTÃO o sistema DEVE registrar uma única busca ou vincular a segunda à primeira, sem duplicar candidatos.
- **R23.3:** SE duas gravações concorrentes atingirem o mesmo registro editável (empresa, contato, ficha, campanha, parâmetro), ENTÃO o sistema DEVE recusar a segunda com aviso de conflito.
- **R23.4:** QUANDO houver descarte comercial, o sistema DEVE manter motivo e histórico necessário e aplicar a política de retenção aos dados pessoais; descarte não implica conservação indefinida.
- **R23.5:** QUANDO houver pedido de exclusão, o sistema DEVE avaliar validade e aplicabilidade e executar R9.1, incluindo conteúdo, índices e referências afetados.
- **R23.6:** SE um registro referenciado por outro for excluído (ex.: contato com envios na linha do tempo), ENTÃO o sistema DEVE manter o evento com tombstone sem PII, sem quebrar a linha do tempo.

### Módulo 24 — Dashboards e linha do tempo — **Novo**

#### R24 — Dois dashboards, uma base [Interno]

Origem: ESC D3, §2.9.

- **R24.1:** O sistema DEVE oferecer dashboards Nacional e Internacional sobre a mesma base de empresas, aprovações, execução e acompanhamento.
- **R24.2:** Cada dashboard DEVE mostrar buscas em andamento/concluídas, fontes, cobertura e falhas; empresas e unidades; perfis; pendências; aprovações; mensagens programadas, enviadas, respondidas e falhas; próximas ações; demandas e oportunidades.
- **R24.3:** O Nacional DEVE mostrar mapa e distâncias com precisão (R11); o Internacional DEVE mostrar a análise do país e a seleção de commodities que originou cada busca (R12).
- **R24.4:** Cada empresa DEVE ter linha do tempo com ações, mensagens, respostas, evidências, pausas, decisões e próximas tarefas, com fonte/canal e data.
- **R24.5:** A interface DEVE distinguir visualmente dado real, sugestão, informação não confirmada e demonstração; SE a API não estiver disponível, ENTÃO dados demonstrativos DEVEM ser rotulados como demonstração.
- **R24.6:** O sistema DEVE exibir cada pausa com alcance e motivo e oferecer controles de pausa conforme R9.2.

### Módulo 25 — Migração OpenClaw — **Novo**

#### R25 — Substituição delimitada [Depende de inventário real do OpenClaw]

Origem: ESC §2.10.

- **R25.1:** O sistema DEVE importar o inventário do OpenClaw (contatos, históricos, campanhas, pendências, respostas, descadastros) registrando origem `OpenClaw` e data.
- **R25.2:** Supressões do OpenClaw DEVEM ser importadas antes do primeiro envio do Compass.
- **R25.3:** SE uma empresa/campanha transferida ainda estiver ativa no OpenClaw, ENTÃO o sistema DEVE impedir o primeiro envio do Compass para ela até a retirada ser registrada.
- **R25.4:** Contato anterior pelo OpenClaw NÃO DEVE ser tratado como proibição permanente; nova campanha exige ficha aprovada.
- **R25.5:** O desligamento dos módulos substituídos DEVE ocorrer apenas após reconciliação registrada de envios, respostas, pausas e supressões.

### Módulo 26 — Canais condicionados à integração comprovada — **Novo**

#### R26 — Canal só ativa com evidência [Depende de T1, T2, T3]

Origem: ESC D6, §3 Etapas, §5; STA "Limite desta atualização".

- **R26.1:** Cada canal DEVE ter estado `planejado`, `em teste interno` ou `habilitado`, com a evidência de validação (data, responsável, teste executado).
- **R26.2:** SE o canal não estiver `habilitado`, ENTÃO o sistema NÃO DEVE permitir sua seleção em ficha para envio automático a destinatário externo.
- **R26.3:** E-mail só DEVE passar a `habilitado` após T1 comprovado com endereços internos: envio, estados, recebimento, correlação de resposta, autenticação do domínio e mecanismo de descadastro de R21.10.
- **R26.4:** WhatsApp só DEVE passar a `habilitado` com integração oficial, permissão do destinatário registrada e modelos/regras atendidos (T2); número público NÃO DEVE ser tratado como permissão.
- **R26.5:** ENQUANTO LinkedIn não tiver capacidade autorizada comprovada (T3), o canal DEVE operar só em modo assistido (R15.3).
- **R26.6:** Antes de qualquer contato real, testes controlados DEVEM comprovar envio, recebimento, supressão, pausas, deduplicação e aplicação de R17 com endereços internos.

### Módulo 27 — Demanda, oportunidade e proposta específica — **Novo**

#### R27 — Humano confirma; gate próprio [Interno]

Origem: ESC §2.2 (Demanda), §2.5 (Interesse), §4.1 critério 4.

- **R27.1:** QUANDO Rogério assumir um atendimento, o sistema DEVE permitir abrir a trilha de qualificação com demanda (produto, especificação, volume, embalagem, destino, data, recorrência, condições) usando o formulário R3.
- **R27.2:** A oportunidade DEVE ser criada somente por confirmação humana e avançar pelo gate R7.2.
- **R27.3:** Proposta específica e cotação DEVEM ser preparadas com condições reais confirmadas (R16.3); o sistema NÃO DEVE preenchê-las a partir de sugestões não confirmadas.

### Módulo 28 — Método `/prospeccao-vendas` em todo o trabalho de prospecção — **Novo (rascunho 4)**

#### R28 — ICP, lista, cadência, ligações e reunião conforme a skill [Interno; LinkedIn só assistido (R15.3); abertura de e-mail depende de T1 e T11]

Como Rogério, quero que todo o trabalho de prospecção do Compass siga o método da `/prospeccao-vendas`, para prospectar como a EAG Agro ensina.
Origem: diretriz de Rogério de 2026-09-22; T12 rev. 3 (§2, §3).

- **R28.1:** Cada campanha DEVE registrar o ICP por escrito: commodity (1–2 por ICP), setor(es) usuário(s), porte-alvo, região, decisor e influenciador, dores de fornecimento conhecidas e ciclo médio de compra. SE o ICP não estiver registrado, ENTÃO a campanha NÃO DEVE gerar fichas.
- **R28.2:** A busca (R11, R12) DEVE partir dos setores que usam a commodity (uso final; ex.: açúcar → refrigerante, bala, chocolate, sorvete, panetone, néctar, energético, achocolatado), nunca de "compradores de [commodity]" genéricos; o setor usado DEVE ficar registrado na versão da busca.
- **R28.3:** A lista DEVE poder ser exibida e exportada com as colunas do contrato de saída da skill (empresa, razão social, CNPJ, situação/abertura/porte, CNAE, site, telefone, e-mail validado s/n, decisor, influenciador, LinkedIn, fonte do dado), com "não encontrado" em célula sem dado.
- **R28.4:** QUANDO houver ficha cadastral, o sistema DEVE registrar situação, data de abertura, natureza jurídica, porte, CNAE e sócios, e usá-los como sinais de prioridade: MEI → fora do ICP; CNPJ recente com capital baixo → ponto de atenção; matriz baixada → verificar filiais antes de descartar.
- **R28.5 [Aprovado K4]:** A campanha DEVE usar o modelo de cadência da skill (2 semanas, lote de 10–15 empresas). E-mails aprovados são enviados pelo sistema; ligações e mensagens de LinkedIn viram tarefas manuais para Rogério no dia previsto, com o roteiro correspondente. LinkedIn só em modo assistido (R15.3). WhatsApp continua fora (R26.4).
- **R28.6 [Aprovado K4]:** SE não houver e-mail validado do decisor, ENTÃO o sistema DEVE criar tarefa de cold call Level 0 (descobrir nome e e-mail do comprador) em vez de iniciar a sequência.
- **R28.7 [Aprovado K5 · depende de T1 e T11]:** QUANDO o provedor sinalizar abertura de um e-mail da sequência, o sistema DEVE registrar "abertura sinalizada" (nunca "lido") e criar tarefa "ligar agora" para Rogério, sem enviar nada automaticamente. ENQUANTO T1 (capacidade do provedor) e T11 (base legal e aviso do rastreamento) não estiverem comprovados, o rastreamento fica desligado e a interface avisa que a regra I5 está inativa.
- **R28.8:** Tarefas de ligação de um mesmo bloco DEVEM vir ordenadas das empresas de menor prioridade para as de maior (skill: começar pelos piores leads).
- **R28.9:** Cada tarefa de ligação DEVE trazer o roteiro do level aplicável (L0, L1 ou L2) e campos para as 3 perguntas de qualificação e o teste condicional (R3.1.5); a tarefa NÃO DEVE conter preço nem proposta.
- **R28.10:** QUANDO Rogério registrar reunião agendada, o sistema DEVE registrar o evento na linha do tempo (data, duração prevista de 20–30 min, canal, convite enviado s/n) e criar tarefa de confirmação na manhã do dia.
- **R28.11:** QUANDO a sequência terminar no break sem resposta, o sistema DEVE marcar a empresa para retorno sugerido em 6–12 meses (ou pelo ciclo médio de compra do ICP), e NÃO DEVE reabordá-la sem nova ficha aprovada (R17.7).
- **R28.12:** Os dashboards DEVEM mostrar o funil da skill: empresas prospectadas → reuniões agendadas → negócios, por campanha e período.
- **R28.13:** SE o comprador pedir preço, tabela ou apresentação na resposta, ENTÃO a tarefa aberta para Rogério DEVE exibir a orientação da skill (qualificar e propor a reunião; sem preço ou proposta antes dela). O sistema não responde (R19.9).
- **R28.14:** Contexto de mercado em textos ou tarefas DEVE citar fonte e data; os números de `contexto-mercado.md` da skill (maio/2026) DEVEM ser reconferidos antes de qualquer uso.
- **R28.15:** No Internacional, o sistema DEVE aplicar o mesmo processo no idioma da campanha (inglês por padrão) e registrar na ficha que a skill não tem método específico para exportação (lacuna 🔴).
- **R28.16:** SE uma regra da skill conflitar com um controle do Compass (supressão, aprovação, LGPD, compliance, veracidade, integração comprovada), ENTÃO vale a regra mais restritiva até a decisão de Rogério registrada nesta Spec. Nenhum controle do Compass é afrouxado pela skill, e nenhum inviolável da skill é descumprido sem exceção registrada na Constituição.
- **R28.17 (K2):** O sistema DEVE permitir no máximo 2 commodities com campanhas ativas por mercado (Nacional, Internacional). SE uma terceira for ativada, ENTÃO ela DEVE ficar em espera com aviso. A análise de país (R12) continua mostrando todas as commodities, e a seleção de mais de duas é registrada.
- **R28.18 (K4):** Tarefas manuais (ligação, LinkedIn) DEVEM obedecer às mesmas interrupções dos envios: supressão, pausas, resposta (R20.1), bloqueio de sanção/compliance e aprovação vigente. SE alguma se aplicar, ENTÃO a tarefa DEVE ser suspensa antes de aparecer a Rogério, com o motivo.
- **R28.19 (K4):** QUANDO Rogério concluir uma tarefa manual, o sistema DEVE registrar resultado, data, canal e roteiro usado na linha do tempo (R15.4); tarefa planejada e não executada NÃO DEVE contar como contato (R15.5).

---

## 3. Cenários verificáveis de aceite

### 3.1 Cenários v1.3

| ID | Situação v2.0 | Observação |
| --- | --- | --- |
| AT1 | **Revisado** | DADO açúcar com mínimo de 500 MT configurado para o mercado **ou oferta vinculada** e 270 MT/operação, QUANDO a demanda for salva, ENTÃO recebe `Abaixo do Mínimo` e não qualifica sem aprovação executiva. Novo par: DADO a mesma demanda sem mínimo configurado nem oferta vinculada, ENTÃO não recebe `Abaixo do Mínimo` (R3.3.2). |
| AT2 | Mantido | 85/100. |
| AT3 | Mantido | 85/100 com M = 5 MT. |
| AT4 | Mantido | — |
| AT5 | Mantido | — |
| AT6 | Mantido | — |
| AT7 | Mantido | — |
| AT8 | Mantido | — |
| AT9 | Mantido | Acréscimo: a ficha também fica bloqueada (R1.2.1). |
| AT10 | Mantido | — |
| AT11 | Mantido | — |
| AT12 | **Substituído** | DADO um trader sem comprador final identificado e **sem** condição confirmada que exija comprador final, QUANDO tentar qualificar com os demais critérios atendidos, ENTÃO o critério 7 do gate é atendido. DADO o mesmo trader numa campanha cuja condição confirmada exige comprador final, ENTÃO a qualificação é impedida até comprador final e relação serem validados. Em ambos os casos a abordagem aprovada não é bloqueada. |
| AT13 | Mantido | — |
| AT14 | **Revisado** | Inclui as ações novas da tabela R9.2 (aprovar ficha: Gestor/Admin; consultar supressão: só Admin; Auditor só lê). Rogério opera como Administrador (confirmado em 2026-09-22). |

### 3.2 Cenários novos

Todos rodam com endereços internos/controlados e dublês das integrações até que Tn seja comprovado.

| ID | Requisito | DADO / QUANDO / ENTÃO |
| --- | --- | --- |
| AT15 | R11.1, R16.2 | DADO commodity, cidade/UF e raio, sem fornecedor, lote, preço ou oferta, QUANDO a busca nacional for iniciada, ENTÃO é aceita. |
| AT16 | R11.4 | QUANDO uma busca nacional terminar, ENTÃO nenhum registro de fornecedor é criado ou sugerido. |
| AT17 | R11.6 | DADO candidato com coordenada de centroide de cidade a 30 km do ponto e raio de 50 km, ENTÃO aparece como `dentro do raio — estimado`, nunca como comprovado. |
| AT18 | R11.7, R11.8 | DADO 37 candidatos retornados com uma fonte truncada, ENTÃO os 37 aparecem paginados e a fonte truncada é exibida como parcial. |
| AT19 | R11.9 | DADO um consumidor final no porte do ICP e um trader com a mesma aderência, ENTÃO o consumidor final vem antes e o trader continua visível e classificado. |
| AT20 | R12.1, R12.8 | DADO somente o país, QUANDO a análise for pedida, ENTÃO é aceita; e nenhuma busca de empresas ocorre antes da seleção de commodities registrada. |
| AT21 | R12.6 | DADO falha ou timeout da fonte, ENTÃO o estado é `dados indisponíveis`, nunca `nenhum registro no período`. |
| AT22 | R12.4, R10.3 | DADO commodity do catálogo com NCM `pendente`, ENTÃO a linha do país não é marcada como correspondência comprovada com o catálogo. |
| AT23 | R12.10, R1.4.3 | DADO compra identificada do país para café, ENTÃO nenhuma empresa recebe `importa do Brasil`, `compra a commodity` ou `consome` por esse dado. |
| AT24 | R17.3 | DADO primeiro e-mail com preço ou lote sem dado aprovado, ENTÃO o revisor aponta PV7 e a ficha não pode ser aprovada. |
| AT25 | R17.2, R19.1 | QUANDO um passo for disparado, ENTÃO o conteúdo enviado é byte a byte o texto congelado da versão aprovada e nenhum gerador é chamado. |
| AT26 | R18.7, R19.4 | DADO aprovação enviada duas vezes e um passo reexecutado após retomada, ENTÃO existe uma aprovação e um único envio aceito por passo. |
| AT27 | R19.6 | DADO envio com resultado indeterminado, ENTÃO nenhum novo envio ocorre antes da reconciliação. |
| AT28 | R19.3 | DADO compliance indisponível, QUANDO chegar a hora do passo, ENTÃO o envio aguarda e o motivo é registrado. |
| AT29 | R20.1, R20.5 | DADO sequências da empresa X para café (dois decisores, e-mail) e para açúcar, QUANDO um decisor responder à de café, ENTÃO todos os passos de café da empresa X param, a tarefa é aberta e a de açúcar continua com alerta. |
| AT30 | R20.6 | DADO mensagem recebida não classificável, ENTÃO é tratada como resposta humana. |
| AT31 | R21.2, R21.6 | DADO descadastro por resposta, ENTÃO o endereço é suprimido antes do próximo passo e nenhum encerramento é enviado. |
| AT32 | R19.8 | DADO destinatário com sequência ativa na campanha A, QUANDO a ficha da campanha B for aprovada para ele, ENTÃO B fica em espera e é reverificada ao ser liberada. |
| AT33 | R22.4, R16.5 | DADO oferta vinculada à campanha A e campanha geral B da mesma commodity, QUANDO a oferta vencer, ENTÃO só A pausa. |
| AT34 | R26.2, R25.3 | DADO canal WhatsApp `planejado` ou empresa ainda ativa no OpenClaw, ENTÃO a ficha não permite envio por WhatsApp e a empresa não recebe envio do Compass. |
| AT35 | R21.7, R21.9 | DADO uma sequência de 3 e-mails, ENTÃO os 3 textos enviados contêm a forma de saída. QUANDO o destinatário a aciona após o passo 1, ENTÃO o endereço entra na supressão e os passos 2 e 3 não são enviados. |
| AT36 | R20.7, R20.8 | DADO resposta de ausência automática com data de retorno explícita, ENTÃO os passos da empresa para a commodity param e, ao chegar a data de retorno, nenhum passo é retomado sem ação humana registrada. |
| AT37 | R11.12 | DADO busca v1 com raio de 100 km e 12 resultados, QUANDO o raio for alterado para 150 km, ENTÃO existe busca v2 com os novos parâmetros e a v1 continua com raio de 100 km e os mesmos 12 resultados. |
| AT38 | R11.11 | DADO raio 0, −10 ou "abc", ENTÃO a busca é recusada com motivo. |
| AT39 | R1.3.3, §1.2 | DADO empresa em `Descoberto` sem evidência empresarial, QUANDO a ficha for aprovada, ENTÃO a sequência pode ser ativada e o pipeline continua `Descoberto`. |
| AT40 | R5.1.2, R5.1.3 | Exemplo EX-CN1 da §6.1.3 → CN = 60. |
| AT41 | R5.1.2 | EX-CN2 → CN = 80. |
| AT42 | R5.1.2, R5.1.1 | EX-CN3 → CN = 30 (CNAE não pontua). |
| AT43 | R5.1.1, R1.4.3 | EX-CN4 → CN = 8 (dado agregado e página genérica não pontuam). |
| AT44 | R5.1 | EX-CN5 → AT5 internacional continua 80. |
| AT45 | R4.3.4 | EX-PN1 → PN = 90–90. |
| AT46 | R4.5, R4.3.4 | EX-PN2 → PN = 35–90; critério 3 do gate não atendido. |
| AT47 | R4.3.6 (DS1-b) | EX-PN3 → PN = 50–100 sem `M_N`; qualificação não bloqueada pela ausência de `M_N`. |
| AT48 | R4.3.5 (DS1-c), R3.3.1 | EX-PN4 → PN = 70 e `Abaixo do Mínimo`. |
| AT49 | R4.3.4, R11.6 | EX-PN5 → PN = 85 (unidade fora do raio: Logística 0). |
| AT50 | R17.8 | DADO SHA-256 da skill diferente do incorporado, QUANDO for pedida geração de texto, ENTÃO a geração é recusada com o motivo e fichas já aprovadas permanecem inalteradas. |
| AT51 | R28.1 | DADO campanha sem ICP registrado, QUANDO se tentar criar ficha, ENTÃO a criação é recusada com o motivo. |
| AT52 | R19.2 item 11 | DADO destinatário com e-mail não validado (ou deduzido do padrão do domínio), QUANDO chegar a hora do passo, ENTÃO não há envio e o motivo é registrado. |
| AT53 | R19.2 item 12, PV5 | DADO E-mail 1 enviado na segunda, QUANDO o E-mail 2 estiver programado para terça, ENTÃO a ficha não é aprovada (PV5) e, se já aprovada, o envio de terça é bloqueado. |
| AT54 | R17.3 (PV2) | DADO e-mail com anexo, PDF ou link de apresentação, ENTÃO o revisor aponta PV2 e a ficha não pode ser aprovada. |
| AT55 | R17.3 (PV9) | DADO assunto "90% das indústrias têm dificuldade no fornecimento", ENTÃO o revisor aponta PV9. |
| AT56 | R28.11 | DADO sequência encerrada no break sem resposta, ENTÃO a empresa recebe retorno sugerido em 6–12 meses e nenhuma nova sequência começa sem nova ficha aprovada. |
| AT57 | R28.3 | DADO empresa sem telefone e sem LinkedIn encontrados, QUANDO a lista for exportada, ENTÃO as colunas aparecem com "não encontrado" e a fonte de cada dado preenchido. |
| AT58 | R28.13, R19.9 | DADO resposta "me manda sua tabela de preços e uma apresentação", ENTÃO os contatos automáticos param (R20.1), a tarefa de Rogério mostra a orientação da skill e nada é enviado automaticamente. |
| AT59 | R14.6, R14.7 | DADO uma empresa MEI e uma trader, ENTÃO ambas aparecem no Radar com a classificação; a ficha da MEI é recusada; a da trader só é aceita após exceção registrada com autor, data e motivo. |
| AT60 | R18.10 | DADO envio de prova da sequência para Rogério, ENTÃO nenhum passo muda de estado e a linha do tempo da empresa não registra contato com o destinatário. |
| AT61 | R28.17 | DADO campanhas ativas de açúcar e milho no Nacional, QUANDO a de café for ativada, ENTÃO ela fica em espera com aviso; no Internacional a análise de país continua listando todas as commodities. |
| AT62 | R16.7, R16.8 | DADO campanha sem declaração de volume disponível, ENTÃO o E-mail 1 gerado não contém a frase de volume e mantém a estrutura; QUANDO a declaração for aprovada com fichas já aprovadas, ENTÃO as fichas exigem nova versão e aprovação. |
| AT63 | R14.6 | DADO empresa gigante sem relacionamento prévio registrado, ENTÃO a ficha é recusada; com relacionamento registrado, é aceita. |
| AT64 | R28.7 | DADO T1 ou T11 não comprovados, ENTÃO nenhum rastreamento de abertura é incluído nos e-mails e a interface mostra a regra I5 como inativa. DADO ambos comprovados e abertura sinalizada, ENTÃO é criada tarefa "ligar agora" e nada é enviado automaticamente. |
| AT65 | R28.5, R28.18 | DADO cadência com ligação prevista para quinta, QUANDO houver resposta na quarta, ENTÃO a tarefa de ligação de quinta é suspensa com o motivo e não aparece como pendente. |
| AT66 | R11.14, R11.16 | DADO busca nova, ENTÃO o raio vem em 5 km. DADO raio 50, 150 ou 1.600, ENTÃO a busca é recusada com a lista de valores permitidos. DADO raio 5, 100 ou 1.500, ENTÃO é aceita. |
| AT67 | R11.17 | DADO fonte que devolve 1.000 resultados por página e 2.350 candidatos no raio de 1.500 km, ENTÃO a lista mostra os 2.350, paginados e ordenáveis por distância; se uma partição falhar, a busca aparece como parcial com o motivo. |
| AT68 | R19.10 | DADO semana 1 da rampa e 8 passos prontos no dia, ENTÃO só 5 são enviados, com intervalos entre 15 e 25 min, e os 3 restantes vão para o próximo dia útil sem violar a regra de dias não seguidos. |
| AT69 | R19.11, R19.12 | DADO hard bounce de 3% na semana, ENTÃO toda a operação de envio pausa, Rogério é alertado e nenhum envio sai até a retomada por Administrador; DADO 2 semanas limpas, ENTÃO o degrau sobe e a subida é registrada. |
| AT70 | R19.13 | DADO e-mail de sequência sem o endereço físico da EAG na assinatura, ENTÃO o revisor aponta a falta e a ficha não pode ser aprovada. |

---

## 4. Fora de escopo

| Item | Horizonte |
| --- | --- |
| Descoberta ou captação de fornecedores | Nunca nesta versão |
| Resposta automática, negociação autônoma, fechamento automático | Nunca nesta versão |
| Geração ou reescrita de texto no momento do disparo | Nunca |
| Divulgar preço, estoque, certificação, prazo ou condição sem dado aprovado | Nunca |
| Exigir lote, cotação ou oferta para prospecção inicial | Nunca nesta versão |
| LinkedIn por senha, cookies ou automação não autorizada | Nunca |
| Integração com CRM externo | Por enquanto |
| Multi-tenant ativado, usuários externos, permissões customizadas | Por enquanto |
| Promessa de cobertura integral ou de conversão | Nunca |
| Reconvocação automática após encerramento | Por enquanto |
| Pricing SaaS | Por enquanto |

Retirado da lista v1.3: "automação completa de follow-up" (agora permitida para sequência aprovada) e "milho e demais commodities" (agora no catálogo).

## 5. Clarifications

| Data | Pergunta | Resposta | Onde entrou |
| --- | --- | --- | --- |
| 2026-09-22 | Qual é o papel da cidade no Nacional? | Localização do fornecedor já conhecido, centro do raio para achar compradores; o sistema não busca fornecedores. | R11 |
| 2026-09-22 | O que é a primeira entrada do Internacional? | Só o país; depois histórico agrícola Brasil→país; depois escolha das commodities; depois empresas. | R12 |
| 2026-09-22 | Traders ficam de fora? | Não. Consumidores finais PME têm prioridade; traders continuam elegíveis e classificados. **Revisado por K3 (abaixo).** | R2.4, R14 |
| 2026-09-22 | Precisa de lote/preço/oferta para prospectar? | Não. Prospecção inicial é por commodity; oferta específica é opcional. | R16 |
| 2026-09-22 | O que Rogério aprova? | Textos finais, destinatários, canais, fuso e sequência, empresa a empresa, congelados por versão. | R18, R19 |
| 2026-09-22 | O piloto limita a descoberta? | Não. 5–10 empresas limitam o teste de envio. | R11.7 |
| 2026-09-22 | Resposta pausa o quê? | Empresa + commodity em todas as campanhas, canais e decisores. | R20.1 |
| 2026-09-22 | Metodologia dos textos? | `/prospeccao-vendas` v1.0 com adaptações A1–A11 e critérios PV1–PV8 (**superado** em 2026-09-22 pela leitura da skill nova: T12 rev. 3, PV1–PV12, R28). | R17 |
| 2026-09-22 | Reenvio, edição simultânea, exclusão, retenção? | Sem duplicidade; conflito na segunda gravação; exclusão conforme política; supressão pseudonimizada. | R18.7–R18.8, R23, premissas |
| 2026-09-22 | Qual perfil Rogério usa? | Administrador. | R9.2, AT14 |
| 2026-09-22 | B2 — saída e descadastro? | Aprovado: saída clara em todos os e-mails, processamento do descadastro e mecanismo técnico aplicável ao provedor. | R21.7, R21.9, R21.10, AT35 |
| 2026-09-22 | B3 — raio? | Aprovado em parte: cidade/UF de referência + raio positivo em km; alterar o raio gera nova versão da busca, preservando a anterior. Limites operacionais: propor na Fase 4, com justificativa técnica, sem copiar Econodata/Google. | R11.11, R11.12, R11.14, R11.15, AT37, AT38 |
| 2026-09-22 | B1 — ausência automática? | Pendente. Até exceção aprovada: mesma pausa por resposta da revisão 3 e nenhuma retomada automática. | R20.7, R20.8, AT36 |
| 2026-09-22 | Limites de raio (B3)? | Mínimo 5 km, máximo 1.500 km; começa em 5 km e aumenta de 100 em 100 (100, 200, …, 1.500). No raio máximo, todos os possíveis compradores mais próximos devem ser listados. | R11.14, R11.16, R11.17, AT66, AT67 |
| 2026-09-22 | Consultar a Hostinger sobre o §12? | Não. Envio pela caixa Hostinger com o risco assumido. | R19.13, premissas, AT70 |
| 2026-09-22 | Volume diário de envio? | Baixo volume, a partir de pesquisa: 5 → 10 → 15 → 20/dia (semanas 1–4+), 15–25 min entre envios, parada automática. Aprovado. | R19.10–R19.12, parâmetros de envio, AT68, AT69 |
| 2026-09-22 | DS2 — moeda? | Preservar USD como base e BRL para visualização (com taxa, fonte e data) até alteração aprovada. | R3.1.4 |
| 2026-09-22 | DS3 — estados? | Preservar os estados existentes, salvo mudança necessária e justificada. | §1.2 (pipeline mantido; duas mudanças justificadas), R1.3, AT39 |
| 2026-09-22 | DS1 — pontuação nacional? | Apresentar proposta com fórmulas e exemplos verificáveis. | §6.1 |
| 2026-09-22 | Aprova DS1? | Sim. DS1-b: não (qualificar não exige `M_N`). DS1-c: sim (`M_N` é escala e mínimo). | R4.2, R4.3.4–R4.3.6, R5.1.2, §6.1, AT40–AT49 |
| 2026-09-22 | Ler a nova `/prospeccao-vendas` antes de fechar a Fase 3? | Sim. E todo trabalho de prospecção deve obedecer à skill. | T12 rev. 3; R17, R28, R14.3, R15, R18.10, R19.2 itens 11–12, AT51–AT60; K1–K6 |
| 2026-09-22 | K1–K6? | Seguir as recomendações: K1, K2, K4 e K5 conforme a skill (K5 condicionado a T1 e T11); K6 por declarações aprovadas por campanha; K3 traders fora da prospecção ativa, com exceção registrada por empresa. | R2.4.2, R14.3, R14.6–R14.8, R16.7–R16.8, R28.5–R28.7, R28.17–R28.19, AT59, AT61–AT65 |

## 6. Decisões pendentes

### 6.0 Decididas em 2026-09-22

| ID | Decisão | Onde |
| --- | --- | --- |
| C4 | Rogério é Administrador | R9.2, AT14 |
| B2 | Aprovada integralmente | R21.7, R21.9, R21.10, AT35 |
| B3 (parte) | Raio positivo em km; nova versão da busca ao alterar o raio, preservando a anterior | R11.11, R11.12, R11.15, AT37, AT38 |
| DS2 | USD base; BRL para visualização com taxa, fonte e data | R3.1.4 |
| B3 — limites | 5 km (padrão) e 100–1.500 km em passos de 100 km; lista completa em qualquer raio, ordenável por distância | R11.14, R11.16, R11.17, AT66, AT67 |
| DS3 | Pipeline v1.3/0.3.1 preservado; duas mudanças necessárias justificadas | §1.2, R1.3.2–R1.3.3, AT39 |
| K1 | Porte do ICP: médias/média-mais; pequenas/MEI fora; gigantes só com relacionamento prévio | R14.3, R14.6, R14.8, AT59, AT63 |
| K2 | Máximo de 2 commodities com campanhas ativas por mercado | R28.17, AT61 |
| K3 | Traders fora da prospecção ativa; ficha só por exceção registrada por empresa | R2.4.2, R14.7, AT59 |
| K4 | Cadência completa da skill: e-mails automáticos + tarefas manuais de ligação e LinkedIn assistido | R28.5, R28.6, R28.18, R28.19, AT65 |
| K5 | Abertura sinalizada → tarefa "ligar agora", condicionada a T1 e T11 | R28.7, AT64 |
| K6 | Declarações aprovadas por campanha (volume disponível, prova social) | R16.7, R16.8, AT62 |
| DS1 | Aprovada: pontuação Nacional da §6.1. DS1-b **não** (qualificar sem exigir `M_N`); DS1-c **sim** (`M_N` é escala e mínimo) | R4.2, R4.3.4–R4.3.6, R5.1.2, AT40–AT49 |

### 6.0.1 Pendentes

| ID | Decisão | Regra vigente até a decisão | Bloqueia |
| --- | --- | --- | --- |
| **B1** | Exceção para ausência automática | Pausa por resposta da revisão 3 (empresa + commodity); nenhuma retomada automática (R20.7, R20.8) | Nada: a regra conservadora já está especificada |

Pendências comerciais que **não** são decisões da Spec: commodity, cidade/UF e raio do piloto (bloqueia Etapa 1); identidade de CSO (bloqueia só o item); valores `M_N` por commodity e demais parâmetros pendentes (R7.1); declarações aprovadas de volume disponível e prova social por campanha (R16.7); validação jurídica da retenção (T11).

### 6.1 DS1 — pontuação do mercado Nacional (**vigente — aprovada em 2026-09-22; DS1-b não, DS1-c sim**)

**Objetivo:** pontuar compradores domésticos com o mesmo mecanismo da v1.3 e do motor 0.3.1 (mesmas dimensões, pesos e máximos, mesmo tratamento de desconhecido como intervalo). Mudam apenas as regras que dependiam de importação ou de lote de exportação. Os limites do gate (`param_confidence_min` = 50, `param_potential_min` = 40) não mudam.

#### 6.1.1 Confidence Nacional

```text
CN = E + A + R + D + C          (máximo 30 + 20 + 15 + 15 + 20 = 100)
A  = 0 quando E = 0             (R5.1.3)
```

| Dimensão | Condição Nacional | Pontos | Código proposto |
| --- | --- | ---: | --- |
| **E — Evidência de compra/consumo** | Registro público nominal que identifica a empresa (CNPJ) e a compra ou consumo da commodity: ata ou contrato de licitação homologada; licença ou relatório regulatório com a commodity como insumo; demonstração financeira ou relatório anual publicado | 30 | `public_nominal_record` |
|  | Documento comercial nominal (nota fiscal, pedido, contrato) que identifica empresa e commodity, obtido com base legítima e guardado como referência interna protegida | 25 | `commercial_document` |
|  | Documento emitido pela empresa que identifica a commodity como insumo: ficha técnica ou rotulagem oficial de produto, especificação de compra publicada | 20 | `company_document` (já existe) |
|  | CNAE, cadastro, base paga, página institucional genérica, notícia, dado agregado | 0 | — |
| **A — Atualidade** (data do fato da evidência E) | < 6 meses / 6–12 meses / > 12 meses | 20 / 15 / 5 | mantido |
| **R — Registro empresarial** | Situação ativa em fonte oficial, consultada com data / só em fonte secundária | 15 / 8 | mantido |
| **D — Decisor** | Autoridade, identidade e contato confirmados / só cargo | 15 / 5 | mantido |
| **C — Confirmação direta** | Demanda confirmada / resposta inicial sem demanda | 20 / 15 | mantido |

Os pontos 30/25/20 são os mesmos da tabela internacional (alfândega / BL / documento empresarial). Assim o máximo do Nacional também é 100, sem penalizar o comprador doméstico por não importar.

#### 6.1.2 Potential Nacional

```text
PN = V + N + Rc + T + P + L     (máximos 30, 20, 20, 15, 10, 5)
PN_min = soma das dimensões conhecidas
PN_max = PN_min + soma dos máximos das dimensões desconhecidas     (R4.5; motor 0.3.1)
Gate usa PN_min.
```

| Dimensão | Regra Nacional proposta |
| --- | --- |
| V — Volume/operação | Tabela relativa a `M_N[commodity]` (R4.3.1): < 1M = 0; 1M a < 2M = 10; 2M a < 4M = 20; ≥ 4M = 30. `M_N` na unidade comercial configurada para a commodity (t, m³, saca de 60 kg). Volume em outra unidade sem fator registrado = desconhecido. **A tabela absoluta de açúcar (R4.2) não se aplica ao Nacional**: suas faixas partem de 500 MT por operação, pensadas para lotes de exportação, enquanto o público prioritário no Nacional é a indústria consumidora no porte do ICP (K1). |
| N — Potencial anual | < 2M = 5; 2M a < 6M = 10; ≥ 6M = 20. Direto confirmado prevalece sobre o derivado (R4.5). |
| Rc — Recorrência | Mantida (1 op = 0; 2–4 = 8; 5–11 = 15; ≥ 12 = 20). |
| T — Técnica | Mantida (especificação 10 + embalagem 5). |
| P — Prontidão | Condição de entrega confirmada (FOB, CIF ou outra configurada para o mercado interno) 5 + data firme 5. |
| L — Logística | 5 = local de entrega confirmado e unidade com localização por endereço ou coordenada dentro do raio da campanha. 0 = fora do raio ou declarado inviável. Desconhecida = localização estimada ou pendente (liga a R11.6). |
| Sem `M_N` | V e N desconhecidas (R4.3.2). |

#### 6.1.3 Exemplos verificáveis

Datas de referência: consulta em 2026-09-22. `M_N = 100 t` é **valor de teste**, não parâmetro aprovado.

| ID | Dados | Cálculo | Resultado |
| --- | --- | --- | --- |
| EX-CN1 | Rotulagem oficial de produto com açúcar como ingrediente, fato em 2026-08; CNPJ ativo em fonte oficial; decisor só com cargo; sem resposta | 20 + 20 + 15 + 5 + 0 | **CN = 60** (≥ 50) |
| EX-CN2 | Ata de licitação homologada de compra de milho, fato em 2025-07 (14 meses); CNPJ ativo; decisor confirmado; resposta inicial sem demanda | 30 + 5 + 15 + 15 + 15 | **CN = 80** |
| EX-CN3 | Só CNAE compatível; CNPJ ativo; resposta inicial | 0 + 0 + 15 + 0 + 15 | **CN = 30** (< 50) |
| EX-CN4 | Dado agregado do país + página institucional "atuamos com grãos"; registro só em base secundária | 0 + 0 + 8 + 0 + 0 | **CN = 8** |
| EX-CN5 | Regressão: AT5 internacional (registro nominal recente, empresa ativa, decisor verificado, sem demanda) | 30 + 20 + 15 + 15 + 0 | **80**, inalterado |
| EX-PN1 | Milho; 250 t/op (2,5M); 12 op/ano, anual derivado 3.000 t (30M); especificação e embalagem confirmadas; condição de entrega e data firmes; unidade por endereço a 80 km, raio 150 km | 20 + 20 + 20 + 15 + 10 + 5 | **PN = 90–90** |
| EX-PN2 | 250 t/op; op/ano e anual desconhecidos; técnica 15; prontidão não informada; unidade só por centroide da cidade | conhecidas 20 + 15 = 35; desconhecidas 20 + 20 + 10 + 5 = 55 | **PN = 35–90**; gate usa 35 < 40 → critério 3 não atendido |
| EX-PN3 | Sem `M_N` configurado; demais dados como EX-PN1 | conhecidas 20 + 15 + 10 + 5 = 50; desconhecidas 30 + 20 = 50 | **PN = 50–100**; critério 3 atendido (DS1-b: `M_N` não é exigido) |
| EX-PN4 | 60 t/op (0,6M); 12 op/ano, anual 720 t (7,2M); demais como EX-PN1 | 0 + 20 + 20 + 15 + 10 + 5 | **PN = 70** e `Abaixo do Mínimo` (DS1-c: `M_N` é também o mínimo; R3.3.1) |
| EX-PN5 | Como EX-PN1, mas unidade por endereço a 180 km, raio 150 km | 20 + 20 + 20 + 15 + 10 + 0 | **PN = 85** |

Os exemplos são os cenários AT40–AT49 (§3.2). R4.3.4–R4.3.6 e R5.1.2 apontam para esta seção. A implementação exige alterar o motor 0.3.1 em três pontos: tabela relativa para qualquer commodity com `M` (hoje só café), catálogo de evidência por mercado e Atualidade condicionada a E (hoje é entrada independente).

## 7. Premissas e gatilhos de replanejamento

| Premissa | Gatilho | O que revisitar |
| --- | --- | --- |
| Mono-tenant EAG; usuários internos, Rogério principal, poucos usuários (modelo de uso: time interno pequeno) | Usuário externo ou outro cliente | Constituição P7, auth (Fase 4), R9.2 |
| Hospedagem Cloudflare (Workers, D1, R2, KV, Queues, Cron) | T9 mostrar limite do plano ou custo inviável | Stack (Fase 4), constituição P11 |
| E-mail `rogeriopalhari@eagagro.com` viável para envio e recebimento | T1 falhar em autenticação, recebimento ou correlação | Etapa 1 inteira; canal alternativo |
| Fontes abertas + geocodificação sustentam o piloto nacional | Cobertura ou precisão insuficientes em T4/T5 | Adaptador pago (R13.7), orçamento |
| Comex Stat fornece exportações por país e NCM | T6 indicar ausência, sigilo ou limites incompatíveis | R12, fonte alternativa |
| LinkedIn só em modo assistido | T3 comprovar capacidade autorizada | R15.3, R26.5 |
| Volume do piloto: 5–10 envios aprovados; descoberta sem limite fixo | Custo por empresa (T8) acima do aceitável | Limites de busca, R13.5 |
| `/prospeccao-vendas` 1.0.0, curso EAG Agro (SHA-256 `33bd093f…9dd8`), lida em 2026-09-22 (T12 rev. 3) | Skill atualizada de novo (hash diferente) | Nova leitura T12, PV, R17, R28; geração bloqueada até lá (R17.8) |
| Rede de franqueados pode contatar as mesmas empresas fora do Compass (PER §2 obs. 2) | Duplicidade de abordagem relatada | Checagem cruzada com a rede |
| Retenção de dados pessoais: conforme política a validar em T11; supressão pseudonimizada retida para não recontatar | Orientação jurídica diferente | R9.1, R21, R23 |
| Reenvio/duplo clique/reexecução não geram duplicidade (R18.7, R19.4, R23.2) | — | Critério permanente |
| Edição concorrente detectada na segunda gravação (R18.8, R23.3) | — | Critério permanente |
| **Envio de prospecção pela caixa Hostinger do domínio principal, sem consulta prévia à Hostinger** — o §12 dos termos proíbe comercial não solicitado sem opt-in; risco **assumido por Rogério em 2026-09-22**, mitigado por baixo volume (R19.10–R19.12) e R19.13 | Qualquer aviso, limitação ou suspensão da Hostinger; queda de entrega da caixa principal | Parar todo envio (R19.12); replanejar o canal (domínio dedicado foi descartado; reabrir com Rogério) |
| OpenClaw ativo até a migração | Envio do OpenClaw a empresa transferida | R25.3 |

## 8. Rastreabilidade das decisões preservadas

| Decisão da Fase 3 | Requisitos |
| --- | --- |
| 1. Nacional: commodity + cidade/UF do fornecedor + raio ajustável → compradores | R11.1–R11.17, AT15–AT19, AT37, AT38, AT66, AT67 |
| 2. Internacional: país → histórico agrícola Brasil → commodities → empresas | R12.1–R12.10, R1.4, AT20–AT23 |
| 3. Consumidores finais prioritários; traders elegíveis — **revisada por K3/K1 em 2026-09-22**: indústrias usuárias de porte médio/média-mais têm prioridade; traders visíveis e classificados, com ficha só por exceção | R2.4, R14.3, R14.6–R14.8, R11.9, AT12, AT19, AT59, AT63 |
| 4. Prospecção por commodity, sem lote, preço ou oferta | R1.1.2, R1.3.3, R11.1, R12.1, R16.1–R16.2, R7.2.2, AT15, AT39 |
| 5. Textos finais aprovados por empresa; execução e interrupções | R17, R18, R19, R20, R21, R22, R28, AT24–AT33, AT35, AT36, AT51–AT60 |
| Diretriz: todo trabalho de prospecção obedece à `/prospeccao-vendas` | R17, R28, R14.3, R15.1, R15.6, R3.1.5, R18.10, R19.2 itens 11–12; conflitos K1–K6 |

## 9. Controle do documento

- **Versão:** 2.0
- **Data:** 2026-09-22
- **Status:** aprovada em 2026-09-22 por Rogério. Mudanças posteriores: editar esta Spec primeiro e propagar (regra de mudança).
- **Regra de mudança:** requisito alterado depois desta fase é editado aqui primeiro e só então propagado.
