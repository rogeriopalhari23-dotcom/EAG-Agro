# EAG Compass v2.0 — Benchmark de Referências (Fase 2A)

**Data:** 2026-09-22

**Revisão:** 2 — reconferência documental e aderência ao escopo **Referência de escopo:** `docs/eag-compass-v2-escopo.md`, revisão 3 **Metodologia das abordagens considerada:** `/prospeccao-vendas` v1.0 (ver `docs/eag-compass-t12-prospeccao-vendas.md`) **Restrição preservada:** o benchmark apoia a **construção** do Compass. Nenhuma integração com CRM externo nesta versão; nenhuma contratação, acesso a API, cobertura ou custo é presumido.

---

## 1. Como ler este documento

| Marca | Significado |
| --- | --- |
| **VERIFICADO** | Afirmação sustentada por página oficial lida, com URL e data. Não equivale a teste ou cotação. A pesquisa original relata capturas em `.firecrawl/bench/`; esta reconferência está no §10. |
| **A VALIDAR** | Informação trazida pelos subagentes de pesquisa, com URL, mas **não conferida** por leitura direta. Não sustenta decisão sem nova verificação. |
| **TESTADO** | Funcionalidade usada na prática. **Nenhuma ferramenta foi testada** nesta fase (sem contas, trials ou chaves). |
| **HIPÓTESE (Compass)** | Aplicação proposta ao Compass; depende de validação técnica na Fase 4 (T1–T12). |

### Cobertura da pesquisa

- 4 subagentes, 423 **resultados de busca retornados** (Exa). **Resultado de busca ≠ fonte verificada.**
- A pesquisa original relaciona **14 URLs de 12 fornecedores/órgãos**, não 11: Econodata (2), Speedio, Casa dos Dados, CNPJá, Neoway, Google Maps Platform, MDIC/Comex Stat, Volza, LinkedIn (Microsoft Learn), HubSpot (2), Apollo, Outreach.
- Quatro páginas falharam na primeira raspagem. Duas foram recuperadas numa segunda tentativa pelo Firecrawl (LinkedIn, Google Places); Receita Federal (dados abertos) e ImportGenius (preços) **não foram lidas** e ficam A VALIDAR.
- **Tier 1 (Brasil, pt-BR):** 4 fornecedores de descoberta de empresas com página verificada (Econodata, Speedio, Casa dos Dados, Neoway) + 1 adjacente (CNPJá). Nas páginas examinadas não se comprovou o conjunto completo de descoberta por raio, evidência de consumo, aprovação individual e execução. São referências por dimensão; isso não prova exclusividade nem inexistência de concorrentes. Diferenciação continua hipótese.
- **Tier 2 (global):** HubSpot, Apollo, Outreach, LinkedIn, Google Maps Platform, Volza verificados; Panjiva, ImportGenius, UN Comtrade, ITC Trade Map, Lusha, Salesloft apenas A VALIDAR.

### Correções feitas na verificação (resultado de subagente ≠ página oficial)

| Afirmação anterior | Conferência documental |
| --- | --- |
| Econodata API: "pagamento único, a partir de R$ 97, sem assinatura" | "a API Econodata é para empresas com consumo recorrente, **a partir do plano Premium, com contrato de 12 meses**. Não atendemos consulta pontual nem uso individual." — [https://www.econodata.com.br/api](https://www.econodata.com.br/api) |
| Volza SME: valores conflitantes na pesquisa anterior | O relatório indicava US$ 4.500/ano. Esse preço não apareceu no conteúdo recuperado nesta reconferência; A VALIDAR por captura completa ou cotação. Não usar como orçamento aprovado. [Fonte](https://www.volza.com/pricing/) |
| Comex Stat API: intervalo mínimo de 500 ms | Limite numérico não comprovado. O conteúdo acessível não permitiu reproduzir todos os detalhes anteriores; testar limites e erros em T6. [Documentação](https://api-comexstat.mdic.gov.br/docs) |

---

**Reconferência:** 14 URLs originais reconsultadas e duas páginas MDIC acrescentadas. Preços Volza e detalhes dinâmicos da documentação Comex Stat não foram reproduzidos integralmente; ressalvas nas linhas correspondentes. Nenhum teste de integração foi executado.

## 2. Descoberta nacional por raio

### 2.1 Fatos verificados

| Fornecedor | O que a página oficial diz | URL | Limitações observadas |
| --- | --- | --- | --- |
| **Econodata** | Busca por estado/cidade/bairro com raio 20–200 km. Empresas podem ser posicionadas no centro do bairro ou da cidade. | [Documentação](https://help.econodata.com.br/pt/article/geolocalizacao-econodata-1ghvnjl/) | A aproximação afeta também o candidato. Não comprova coordenada da fábrica ou unidade consumidora. |
| **Econodata (API)** | Unidade de cobrança = **token**; consome pela operação e pelos campos que voltam preenchidos ("campo vazio não" consome); retorno inclui `decisores` com `nivelDecisao`; API a partir do plano Premium, contrato de 12 meses. | [https://www.econodata.com.br/api](https://www.econodata.com.br/api) | Contrato anual; preço do plano não publicado na página. |
| **Speedio** | Preços de entrada: R$ 719/mês (300 empresas), R$ 1.079 (500), R$ 1.379 (1.000). Formulário anuncia 12 meses; FAQ cita também contratos trimestrais e semestrais. | [Planos](https://www.speedio.com.br/planos/) | Confirmar modalidade e custo total em proposta. Raio em km não comprovado nessa página. |
| **Casa dos Dados** | Básico 1: R$ 29,90/mês, 5.000 consultas; Intermediário 1: R$ 199,90/mês, 70.000 consultas. Página informa pré-pago sem fidelidade e crédito avulso. | [Planos](https://portal.casadosdados.com.br/planos) | Custo unitário depende de aproveitar o pacote; não é custo por comprador validado. Geocodificação, cobertura e uso de resultados exigem teste. |
| **CNPJá** | Parâmetro `geocoding=true` na consulta de estabelecimento retorna latitude e longitude "permitindo exibir o estabelecimento em um mapa ou realizar análises espaciais". | [https://cnpja.com/api](https://cnpja.com/api) | Geocodificação por CNPJ consultado; não é busca por raio. Preço da API comercial não verificado. |
| **Neoway** | Neoway Maps: "segmente suas buscas com raios customizados". | [https://www.neoway.com.br/solucoes/neoway-maps](https://www.neoway.com.br/solucoes/neoway-maps) | Página de marketing; sem limites, API ou preço verificados. |
| **Google Places API (New) — Nearby Search** | Raio informado maior que zero e até 50.000 m; `maxResultCount` de 1 a 20. | [Documentação](https://developers.google.com/maps/documentation/places/web-service/nearby-search) | Limites do endpoint, não do Compass. Uma consulta não enumera todos os compradores. Truncamento não representa cobertura completa. |

### 2.2 A validar

- Receita Federal — dados abertos do CNPJ: arquivos Empresas/Estabelecimentos, CNAE secundária, periodicidade, ausência de coordenadas (subagente citou [https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj](https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj) e [https://arquivos.receitafederal.gov.br/dados/cnpj/](https://arquivos.receitafederal.gov.br/dados/cnpj/)). **Página não lida nesta fase.**
- Econodata: confirmar operacionalmente os filtros por CNAE primário/secundário, porte e matriz/filial ([https://help.econodata.com.br/pt/article/como-funcionam-os-filtros-da-plataforma-x25v4a/](https://help.econodata.com.br/pt/article/como-funcionam-os-filtros-da-plataforma-x25v4a/)).
- Speedio API: 100 req/min, 1.000 req/h; busca por lote de 100 CNPJs ([https://docs.speedio.com.br/introducao](https://docs.speedio.com.br/introducao)).
- Casa dos Dados API: filtros por CNAE, porte, matriz/filial; limite de 1.000 por consulta ([https://docs.casadosdados.com.br/](https://docs.casadosdados.com.br/)).
- Google Places: preço (Nearby Search Pro, Geocoding) e restrições de armazenamento de resultados ([https://developers.google.com/maps/billing-and-pricing/pricing](https://developers.google.com/maps/billing-and-pricing/pricing); política de cache não lida).
- Cortex/Geofusion e 10 ferramentas adicionais brasileiras (Metis, EmpresAqui, Oportunidados, MapaLead etc.): existência e recursos apenas relatados.

### 2.3 Conclusões e hipóteses

| # | Conclusão | Fonte e data | Limitação |
| --- | --- | --- | --- |
| N1 | Busca por raio sobre cadastro de empresas é recurso **existente no mercado brasileiro** (Econodata; Neoway declara). | Econodata help, Neoway Maps — 2026-09-22 | Nenhuma ferramenta testada; cobertura e precisão da localização não medidas. |
| N2 | Fontes têm limites próprios; o Compass precisa definir limites operacionais e cobertura transparentes. | Econodata; Google — 2026-09-22 | Não copiar 20–200 km ou 50 km para o produto como limites universais. |
| N3 | Geocodificação por estabelecimento existe como serviço (CNPJá). | CNPJá — 2026-09-22 | Precisão e custo não verificados. |
| N4 | Nenhuma referência verificada comprova **consumo** da commodity; filtros são por CNAE/porte/localização. | Todas as páginas acima | Confirma o escopo: CNAE é indício, não prova. |
| N5 | Há modalidades distintas: Econodata anuncia contrato anual, Speedio mostra outras modalidades e Casa dos Dados informa pré-pago sem fidelidade. | Páginas oficiais — 2026-09-22 | Comparar custo total e qualidade no piloto. Nenhuma contratação aprovada; não concluir que toda base paga exige 12 meses. |

**Hipóteses para a Fase 4 (T4, T5):**

- **H-N1:** Camada 1 nacional a partir dos dados abertos de estabelecimentos + geocodificação própria/serviço, com base paga como adaptador opcional depois do piloto.
- **H-N2:** Google Places pode complementar endereço/unidade; não comprova sozinho identidade cadastral ou consumo. Limite de resultados e termos de armazenamento precisam ser considerados.
- **H-N3:** Exibir precisão do centro e de cada candidato: unidade, sede, centro de bairro/cidade ou desconhecida. Coordenada aproximada não comprova estar dentro do raio; indicar estimativa ou resultado indeterminado.

---

## 3. Inteligência internacional por país

### 3.1 Fatos verificados

| Fonte | O que a página oficial diz | URL | Limitações observadas |
| --- | --- | --- | --- |
| **Comex Stat — MDIC** | MDIC confirma acesso gratuito e serviço de API. A FAQ descreve dados por produto/país sem identificação comercial de empresas. | [Documentação](https://api-comexstat.mdic.gov.br/docs) · [FAQ](https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/perguntas-frequentes-faq) · [Informativo](https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/informativos/informativo-2024-086) | Leitura documental, sem consulta de dados executada. Contrato da API, limites e unidades: T6. |
| **Volza** | Página descreve Startup, SME e Corporate e categorias de bases, incluindo espelho e estatísticas. | [Planos](https://www.volza.com/pricing/) | Valores US$ 1.500/4.500/9.600 anuais constavam do relatório anterior, mas não foram reproduzidos nesta consulta: A VALIDAR. Confirmar cobertura nominal, licença e custo API por país. |

### 3.2 A validar

- Panjiva (S&P Global): dados nominais de embarque, lista de \~22 países de origem de dados, API ([https://panjiva.com/api-guide/](https://panjiva.com/api-guide/)).
- ImportGenius: preços, condições e países cobertos a validar; página não carregou na pesquisa original. Valores sem confirmação não entram no orçamento.
- UN Comtrade API: preview gratuito limitado a 500 registros; assinatura premium ([https://comtradeapi.un.org](https://comtradeapi.un.org/)).
- ITC Trade Map: assinatura e dados de empresas por país — afirmações do subagente com sinais de inconsistência; exigem conferência.
- Validar por país a origem dos registros, campos nominais e método dos dados espelho. Não presumir que todo dado espelho seja estimativa ou identifique consumidor final.

### 3.3 Conclusões e hipóteses

| # | Conclusão | Fonte e data | Limitação |
| --- | --- | --- | --- |
| I1 | Comex Stat é candidato oficial para País Primeiro, com acesso gratuito e API divulgada pelo MDIC. | MDIC, FAQ e informativo — 2026-09-22 | Integração depende de T6; documentação não significa adaptador pronto. |
| I2 | Comex Stat é **evidência de mercado**, nunca prova de compra de uma empresa. | MDIC — 2026-09-22 | Confirma escopo §2.4 Internacional item 8. |
| I3 | Há provedores comerciais de dados nominais; origem, qualidade e licença variam. | Volza — 2026-09-22 | Não concluir que toda evidência empresarial é paga. Documentos de empresa, registros públicos acessíveis e confirmação direta continuam possíveis. |

**Hipóteses para a Fase 4 (T6, T7):**

- **H-I1:** Etapa 3 começa com Comex Stat para a análise do país e pesquisa com evidências (Camada 2) para empresas; base nominal paga só após medir o piloto internacional.
- **H-I2:** A tela do país mostra o estado "dados indisponíveis" quando a consulta falhar ou exceder limites — reforça o escopo (§2.4, item 5).

---

**Contrato funcional País Primeiro:**

1. Entrada inicial = país. Consultar exportações brasileiras ao destino, com período informado; não inverter para importações do Brasil.
2. Classificação agrícola versionada lista commodities e destaca o portfólio EAG sem limitar a análise inicial a ele. Mapeamentos NCM/HS não podem duplicar totais.
3. Registrar período, atualização, unidade e valor. Não somar unidades incompatíveis nem inferir variante além da classificação disponível.
4. Distinguir compra identificada, nenhum registro no período e dados indisponíveis; indicar resultados parciais.
5. Após escolha da commodity, buscar empresas. Importar do Brasil, comprar o produto e consumi-lo como matéria-prima são condições independentes.

São aplicações do escopo. A [FAQ MDIC](https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/perguntas-frequentes-faq) sustenta as limitações de sigilo, detalhamento e unidades; não comprova demanda individual.

## 4. Identificação de decisores

### 4.1 Fatos verificados

| Fonte | O que a página oficial diz | URL | Limitação |
| --- | --- | --- | --- |
| **LinkedIn Sales Navigator API (SNAP)** | "We are **not currently accepting new partners** for access to the LinkedIn Sales Navigator API." | [https://learn.microsoft.com/en-us/linkedin/sales/](https://learn.microsoft.com/en-us/linkedin/sales/) | Página informa suspensão de novos parceiros; não comprova direitos da conta EAG nem possibilidades por parceiros existentes. |
| **Econodata API** | Retorno com `decisores` e `nivelDecisao` (ex.: "C-LEVEL"). | [https://www.econodata.com.br/api](https://www.econodata.com.br/api) | Contrato anual; exatidão não verificada. |

### 4.2 A validar

- APIs públicas do LinkedIn (Sign In, Share, Community Management, Marketing) **não** permitem busca de pessoas nem envio de mensagens — conclusão do subagente, sem leitura direta das páginas.
- Política do LinkedIn contra automação e scraping ([https://www.linkedin.com/help/linkedin/answer/a1340567](https://www.linkedin.com/help/linkedin/answer/a1340567)) e limites de convites/InMail (terceiros).
- Apollo People Search/Enrichment API, créditos, preço e qualidade no Brasil: validar em documentação e amostra. Percentagens de terceiros sem comprovação foram retiradas.
- Lusha Prospecting/Decision Makers API, 100 req/min ([https://docs.lusha.com](https://docs.lusha.com/)).
- Speedio Decision Makers API com URL do LinkedIn ([https://docs.speedio.com.br/endpoints/search-enriched-leads-decision-makers](https://docs.speedio.com.br/endpoints/search-enriched-leads-decision-makers)).

### 4.3 Conclusões e hipóteses

| # | Conclusão | Fonte e data | Limitação |
| --- | --- | --- | --- |
| D1 | SNAP informa que não aceita novos parceiros. Não presumir acesso do Compass à API; manter modo assistido. | Microsoft Learn — 2026-09-22 | T3 verifica capacidades e permissões concretas; não generalizar para todas as APIs oficiais. |
| D2 | Bases brasileiras oferecem "decisores" com nível hierárquico — isso é **cargo/nível**, não autoridade de compra confirmada. | Econodata API — 2026-09-22 | Confirma a distinção do escopo (§2.2). |

**Hipóteses (T3, T8):** decisores vêm da Camada 2 (site, notícias, perfis públicos registrados por Rogério) e, opcionalmente, de base paga após o piloto; o framework relatado no T12 pode orientar papéis de decisão sem substituir o formulário EAG de demanda.

---

## 5. Execução de sequências, parada por resposta e concorrência

### 5.1 Fatos verificados

| Regra | HubSpot | Apollo | Outreach |
| --- | --- | --- | --- |
| Parada por resposta | Com o "reply switch" ligado, resposta a e-mail da sequência (ou e-mail avulso do mesmo endereço) desinscreve o contato; também por reunião agendada via link, descadastro e bounce. | Configurável por "sequence rulesets": parar ou manter o contato na sequência. | Resposta atualiza o estágio do prospect conforme ruleset. |
| Parada da **empresa** | Opção "Unenroll contacts from the same company": "the specific contact who took the action and **all other contacts at the same company** will be unenrolled from the sequence". | Não verificado. | Não verificado. |
| Concorrência | Um contato só pode estar inscrito em uma sequência por vez. | Alerta sobre sequência simultânea, mas permite prosseguir. | Ruleset oferece opção de exclusividade por sequência; não testada. |
| Ausência (out-of-office) | Detecta certas respostas automáticas pelo código do servidor e mantém o contato; porém "Gmail out-of-office replies sent to Outlook inboxes aren't recognized", e o contato é desinscrito. | Pausa o contato; retoma automaticamente se detectar data de retorno (formato mês-primeiro); não conta como resposta; detecta português. | Detecta OOO por frases no assunto/corpo; "OOO replies do not count as a reply". |
| Descadastro | Descadastro via link desinscreve. | — | Opção de adicionar link de descadastro aos e-mails da sequência. |
| **URL** | [https://knowledge.hubspot.com/sequences/unenroll-from-sequence](https://knowledge.hubspot.com/sequences/unenroll-from-sequence) · [https://knowledge.hubspot.com/sequences/enroll-and-unenroll-contacts-in-sequences-using-workflows](https://knowledge.hubspot.com/sequences/enroll-and-unenroll-contacts-in-sequences-using-workflows) | [https://knowledge.apollo.io/hc/en-us/articles/4409237165837-Sequences-Overview](https://knowledge.apollo.io/hc/en-us/articles/4409237165837-Sequences-Overview) | [https://support.outreach.io/support/solutions/articles/159000426339-outreach-sequence-rulesets-overview](https://support.outreach.io/support/solutions/articles/159000426339-outreach-sequence-rulesets-overview) |

**Regras HubSpot reconferidas documentalmente** em 2026-09-22. Opção por empresa refere-se à sequência documentada; workflows têm requisitos próprios de plano. Nenhum comportamento foi testado no produto.

### 5.2 A validar

- Salesloft (cadências, Do Not Contact, limites de envio) — nenhuma página lida.
- Limites de envio e janelas (HubSpot 3 e-mails/min, Outreach throttles, Apollo 1.000 inscrições/dia por caixa).
- Requisitos de remetentes em massa do Google e do Yahoo (SPF/DKIM/DMARC, descadastro em um clique RFC 8058, taxa de spam < 0,3%, atender descadastro em 48 h) — URLs oficiais trazidas pelo subagente ([https://support.google.com/a/answer/81126](https://support.google.com/a/answer/81126), [https://senders.yahooinc.com/best-practices/](https://senders.yahooinc.com/best-practices/)), **não lidas**. Relevante para T1.

### 5.3 Conclusões e hipóteses

| # | Conclusão | Fonte e data | Limitação |
| --- | --- | --- | --- |
| S1 | HubSpot e Apollo documentam controle de interrupção por resposta. A página Outreach consultada descreve atualização de estágio; isso não basta para afirmar a mesma regra de parada. | Páginas oficiais — 2026-09-22 | Compass mantém sua regra de pausa por resposta independentemente de paridade com concorrentes. |
| S2 | Parada no nível da **empresa** existe como opção na HubSpot, limitada à mesma sequência. O Compass vai além: empresa + commodity, em todas as campanhas, canais e decisores. | HubSpot — 2026-09-22 | Mais restritivo que a referência; intencional. |
| S3 | "Uma sequência por contato" é regra documentada na HubSpot; a Apollo permite várias, com alerta. O Compass segue o modelo mais restritivo (escopo §2.8). | HubSpot, Apollo — 2026-09-22 | — |
| S4 | **Resposta automática de ausência** é tratada à parte por todas as três referências, com falhas documentadas (HubSpot desinscreve em um caso). O escopo revisão 3 **não define** esse caso. | HubSpot, Apollo, Outreach — 2026-09-22 | Lacuna do escopo (ver §7, ideia B1). |
| S5 | Link de descadastro nas mensagens de sequência é recurso padrão (HubSpot, Outreach). | HubSpot, Outreach — 2026-09-22 | Requisito formal do Google/Yahoo ainda a validar. |

---

## 6. Tabela de funcionalidades — adotar, ignorar ou melhorar

| Funcionalidade | Referência | Direção / proposta | Por quê |
| --- | --- | --- | --- |
| Busca por raio com mapa | Econodata, Neoway (declarado), Google Places | **Adotar** | Núcleo do Radar Nacional. |
| Limite explícito de raio e precisão do centro | Econodata (20–200 km; cidade/bairro), Google (≤ 50 km) | **Adotar** | Escopo exige declarar precisão e cobertura. |
| Cobrança por campo preenchido | Econodata API | **Aprender** | Modelo útil para estimar custo por empresa (métrica do piloto). |
| Contrato de base paga | Econodata; Speedio com modalidades; Casa dos Dados sem fidelidade declarada | Avaliar custo e evidência | Sem contratação antecipada; dados abertos também geram custos de processamento, geocodificação e operação. |
| Análise país/NCM oficial | Comex Stat API | **Adotar** | Fonte oficial para País Primeiro. |
| Dado nominal de importador | Volza; Panjiva/ImportGenius a validar | Avaliar fonte por país | Provedor pago é opcional; registro acessível e confirmação direta também podem sustentar evidência. |
| API do Sales Navigator | SNAP sem novos parceiros na consulta | Não presumir acesso | Modo assistido enquanto T3 não comprovar capacidade autorizada. |
| Parada por resposta | HubSpot/Apollo; parada Outreach a confirmar | Manter regra do escopo | Regra Compass fixa; não depende da configuração das referências. |
| Parada da empresa inteira | HubSpot (opção) | **Melhorar** | Compass: empresa + commodity, todas as campanhas. |
| Uma sequência ativa por contato | HubSpot | **Adotar** | Escopo §2.8. |
| Várias sequências com alerta | Apollo | **Ignorar** | Contraria o controle de duplicidade. |
| Tratamento de ausência (OOO) | HubSpot, Apollo, Outreach | **Decidir** | Lacuna do escopo (B1). |
| Link de descadastro | HubSpot, Outreach | Proposta B2 | Supressão já é regra; apresentação em todos os e-mails e mecanismo técnico serão especificados. |
| Integração com CRM | Não avaliada universalmente | Fora do escopo | Nenhuma integração CRM nesta versão. |

---

## 7. Ideias para a Spec v2.0 (exigem decisão de Rogério)

| ID | Proposta para a Spec | Origem | Impacto / decisão |
| --- | --- | --- | --- |
| **B1** | Separar resposta humana, ausência automática identificada e resposta incerta. Proposta: ausência confirmada pausa a pessoa e não conta como resposta comercial. Retomada automática só se prevista na ficha, com retorno/fuso inequívocos e todas as verificações pré-envio; sem isso, revisão humana. | S4 + aprovação Compass | Pendente. Na dúvida preservar pausa empresa + commodity. Supressão/bloqueio prevalecem; contato substituto citado não vira destinatário autorizado. |
| **B2** | Saída clara em todos os e-mails e processamento direto na supressão. Distinguir link visível de descadastro técnico em um clique quando exigido pelo provedor. | S5; validar T1 | Proposta pendente. Pedido por resposta também é tratado; nenhuma mensagem de encerramento após supressão. |
| **B3** | Raio ajustável com limites operacionais documentados; precisão do centro/candidato; distância geográfica separada da rodoviária. Localização aproximada ou ausente gera resultado estimado/indeterminado. | N2/N3; escopo | Sem faixa numérica aprovada. Limite do fornecedor não fixa faixa do Compass; exibir truncamento, falhas e cobertura. |

---

## 8. Relação com a `/prospeccao-vendas`

- As sequências das referências (e-mail + tarefas manuais de ligação/LinkedIn) correspondem à estrutura multitoque dos Módulos 5 e 6 da skill. No Compass, ligações e LinkedIn podem ser tarefas manuais opcionais, sem se tornarem requisito do piloto por e-mail (A1 do T12).
- A parada por resposta e o repasse a Rogério equivalem ao "handoff SDR → AE" do Módulo 6.
- O framework da skill pode orientar decisores sem redefinir o formulário de demanda; as bases com "nível de decisão" apenas sugerem cargo (conclusão D2).

---

## 9. Pendências do benchmark

1. Ler as páginas A VALIDAR que sustentarem decisões da Fase 4 (Receita dados abertos, preço Google Maps, requisitos Google/Yahoo, APIs públicas do LinkedIn, ImportGenius, Panjiva, UN Comtrade).
2. Nenhuma integração testada nesta revisão. Documentação e testes locais/leitura pública já autorizados podem avançar. Contas, dados pessoais, contratação e envio externo seguem a autorização concreta e regras do piloto; não criar nova aprovação para cada leitura documental.
3. Decisões B1–B3 na Spec v2.0.

## 10. Reconferência e limites desta revisão

Em 2026-09-22, foram reconsultadas as 14 URLs originais, de 12 organizações, e acrescentadas FAQ e Informativo 086/2024 do MDIC: **16 páginas públicas consultadas**, com resultados parciais para preços Volza e documentação dinâmica Comex Stat. Contagem de páginas não mede cobertura nem comprova APIs. As 423 ocorrências e os subagentes pertencem ao relato anterior; não foram repetidos nesta revisão.

| Ponto | Correção |
| --- | --- |
| Raio Econodata | Centroide também pode representar candidato; registrar incerteza. |
| Google Nearby Search | Até 50 km e 20 resultados por requisição; não é censo de compradores. |
| Bases pagas | Modalidades variam; custo total deve incluir integração e validação. |
| Volza | Preços anteriores não reproduzidos; não tratar como cotação. |
| Comex Stat | Fonte oficial agregada documentada; integração continua T6. |
| Respostas | B1–B3 permanecem propostas; nenhuma aprovação presumida. |
| Fonte excluída | Reclame Aqui removido da pesquisa operacional, conforme decisão do usuário. |

**Próximo uso:** redigir Spec v2.0 com rastreabilidade ao escopo revisão 3, mantendo propostas identificadas até decisão. Dado cadastral não é prova de compra; preço publicado não é orçamento personalizado; referências de ferramentas não autorizam mensagens.
