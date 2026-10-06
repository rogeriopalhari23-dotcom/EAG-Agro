# Descoberta — milho GMO, centro Indiara/GO, raio 300 km (2026-10-06)

**Objetivo:** encontrar compradoras e consumidoras de milho para qualificação posterior. Descoberta apenas.
- Nenhuma empresa foi cadastrada ou aceita: o aceite é de Rogério.
- Nenhum contato foi feito, nenhum crédito Snov consumido, nenhuma ficha ou campanha.
- Método: `/prospeccao-vendas` (busca pelo uso final). Segmentos de `milho-brasil-prospeccao` como roteiro; o ranking por volume e o "volume estimado" dessa skill **não** foram usados (R13.3, R14.3, R28.16).

## Centro e raio

- **Indiara/GO:** IBGE 5209952, ponto representativo (centroide do município) **-17,1852; -49,9682** (IBGE, malhas v3, versão 2026-09-23, tabela `municipalities` do Compass). É o centro da busca, não o endereço do fornecedor (R11.3).
- **Raio:** 300 km, valor permitido (R11.14: 100–1.500 km em passos de 100). **Sem limite técnico que reduza o raio.**
- **Municípios no raio** (por centroide): 224, sendo 195 em GO, 28 em MG e 1 no DF. Lista em `municipios-300km.csv`. O radar do Compass também incluiria municípios cujo limite toca o raio; aqui contou-se só pelo centroide.
- **Distâncias:** do centroide de Indiara ao centroide do município da **unidade** (geodésica). São **estimadas** (R11.6). A distância rodoviária não foi calculada.

## Fontes e cobertura

| Fonte | Situação | Uso |
| --- | --- | --- |
| Casa dos Dados (fonte aprovada, G8) | **Indisponível**: sem chave e sem contratação autorizada | — |
| Dados Abertos do CNPJ da Receita | Não implementados; endereço registrado deu 404 em 2026-10-06 | — |
| **Alternativa documentada** (`DESCOBERTA-BRASIL-PROXIMO-PASSO.md`, opção A): pesquisa com evidências (R13.2) na web, por segmento de uso final | 9 consultas em 2026-10-06 | Candidatas e evidências |
| BrasilAPI (dados abertos da Receita, por CNPJ; gratuita, já usada em produção) | 8 CNPJs consultados | Ficha da unidade: situação, CNAE, porte, município |
| IBGE (tabela de municípios do Compass) | — | Coordenadas e distâncias |

**Cobertura:** **parcial**, sem afirmar todas as empresas existentes (R11.8). Sinais da lacuna:
- páginas de cadastro indicam **32 empresas ativas** com CNAE 1066-0 (alimentos para animais) só em Anápolis;
- indicam também **146** com CNAE 1064-3 (farinha de milho e derivados) em Goiás, das quais **70% ativas**.

A maior parte dessas pequenas e médias **não** apareceu aqui. Fechar a lacuna exige fonte estruturada por CNAE e município (Casa dos Dados, ou a lista oficial de estabelecimentos registrados de alimentação animal do MAPA/SIPEAGRO — ainda não consultada). Sem truncamento de resultados: a limitação é da busca manual.

**Duplicidades:** a mesma empresa com várias unidades aparece uma vez por unidade relevante (ex.: SuperFrango tem duas fábricas em Itaberaí e uma em Nova Veneza). Não há empresa repetida entre grupos: Comigo e Caramuru estão nas consumidoras/processadoras, com a originação anotada.

## Como ler

- **Evidência de milho:**
  - **explícita** — a fonte cita milho consumido ou processado pela unidade;
  - **indício** — a atividade (fábrica de ração, confinamento, pet food) usa milho tipicamente, mas a fonte não cita milho. Não é prova (R14.2, R13.3).
- **Milho GMO:** "a confirmar" em todas, salvo evidência contrária registrada.
- **Porte:**
  - Receita (BrasilAPI): "Demais" = não é ME/EPP;
  - números públicos citados com a fonte;
  - "não encontrado" quando não há dado.
  - Porte só desempata; grande, grupo e micro continuam candidatas (decisão de 2026-09-30).
- **Canal profissional público:** só o que estava publicado na fonte consultada; "não encontrado" quando não estava. Nenhum e-mail foi deduzido nem validado.

## A. Consumidoras finais, fábricas e processadoras

Ordem: evidência explícita antes de indício; dentro disso, distância. Porte só desempata.

| # | Empresa — unidade (cidade) · sede | km | Atividade da unidade | Evidência de milho | Milho GMO | Site | Canal público | Porte | CNPJ da unidade | Fonte · data da fonte |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Gem Alimentos** — usina de etanol de milho (Acreúna/GO) · sede não encontrada | 48,2 | Etanol de milho (até 120 mil L/dia); moagem, laminação e amido modificado | **Explícita** (habilitação ANP) | a confirmar | não encontrado | não encontrado | não encontrado | não encontrado | Empreender em Goiás, 27/02/2023 |
| 2 | **Rei do Milho Alimentos** — indústria (Inhumas/GO) | 108,8 | Moagem de milho: canjica, grits, fubá, gérmen | **Explícita** (site) | a confirmar | reidomilho.com.br | geral@ / contato@reidomilho.com.br · (62) 3514-1751 | não encontrado | não encontrado | site da empresa, consultado em 06/10/2026 |
| 3 | **BRF/MBRF** — complexo de Rio Verde (fábrica de rações) · sede Itajaí/SC | 129,2 | Aves, suínos e processados; fábrica de rações | **Explícita**: usa milho e sorgo locais para ração; ~750 mil t de milho e farelo de soja em 2007 | a confirmar | brf-global.com | não encontrado | grande (mais de 7 mil colaboradores na unidade, 2024) | não encontrado | Folha de S.Paulo 23/06/2014; artigo UNIFACS; Política em Goiás 18/09/2024 |
| 4 | **Usina Rio Verde** (Rio Verde/GO) | 129,2 | Etanol de cana e de grãos; DDG e WDG | **Explícita** quanto a grãos ("etanol de grãos"); milho não nomeado | a confirmar | usinarioverde.com.br | não encontrado | não encontrado | não encontrado | site, consultado em 06/10/2026 |
| 5 | **Caramuru Alimentos** — fábrica de processamento de milho (Itumbiara/GO) | 142,4 | Fubá, canjica, flocos, óleo de milho; também originadora (59 armazéns em GO e MT) | **Explícita** (relatório da empresa) | a confirmar; a empresa declara liderança em produtos **não transgênicos** | caramuru.com | não encontrado | grande | não encontrado | Relatório Caramuru 2020 |
| 6 | **São Martinho** — Usina Boa Vista, planta de milho (Quirinópolis/GO) · sede SP | 151,4 | Etanol de milho: 500 mil t de milho/ano, ampliação para 1,1 Mt em 2027 | **Explícita** | a confirmar | usinasaomartinho.com | não encontrado | grande | não encontrado | Globo Rural 11/08/2025; site (DDGS) |
| 7 | **Cargill Bioenergia** — Unidade São Francisco (Quirinópolis/GO) | 151,4 | Cana e milho: etanol, óleo de milho, DDG | **Explícita** | a confirmar | não encontrado | não encontrado | grande (4,3 mil funcionários em GO) | não encontrado | Notícia da Hora 31/08/2026 |
| 8 | **Cargill** — complexo de Uberlândia/MG | 268,1 | Planta de milho: 60 mil t/mês (amido, glúten, óleo); rações | **Explícita** (parecer ambiental) | a confirmar | não encontrado nesta rodada | não encontrado | Demais (Receita) | 60.498.706/0134-88 (ativa; CNAE 1065-1/01) | Parecer COPAM/IGAM 25/01/2021; BrasilAPI 06/10/2026 |
| 9 | **Grupo JBJ** — confinamento Fazenda Colorado (Aruanã/GO) | 284,1 | Confinamento: mais de 1.000 t de ração/dia | **Explícita**, mas **produz parte do próprio milho** | a confirmar | não encontrado | não encontrado | grande (mais de 130 mil bois/ano) | não encontrado | Curta Mais 05/01/2026 |
| 10 | **JBS** — confinamento com fábrica de ração (Aruanã/GO) | 284,1 | Fábrica de ração de 100 t/h no confinamento | **Explícita** (milho na dieta), **fonte de 2014**: conferir se segue ativa e se é a mesma área da linha 9 | a confirmar | não encontrado | não encontrado | grande | não encontrado | ACSURS 07/05/2014 |
| 11 | **Agroquima** — fábrica de rações e suplementos (Aparecida de Goiânia/GO) | 85,9 | Rações e suplementos para bovinos; também distribui insumos | Indício | a confirmar | agroquima (LinkedIn) | não encontrado | ~341 funcionários (LinkedIn) | não encontrado | LinkedIn, consultado em 06/10/2026 |
| 12 | **São Salvador Alimentos (SuperFrango)** — SSA Rações NV (Nova Veneza/GO) | 115,8 | Fábrica de ração (avícola integrada) | Indício | a confirmar | não encontrado nesta rodada | não encontrado | Demais (Receita); ~9 mil colaboradores | 03.387.396/0022-94 (ativa; CNAE 1066-0) | BrasilAPI 06/10/2026; WikiGoiás 04/08/2026 |
| 13 | **Adimax** — unidade industrial (Goianápolis/GO) · sede PR | 121,5 | Alimentos para cães e gatos | Indício | a confirmar | adimax.com.br | não encontrado | grande | não encontrado | site, consultado em 06/10/2026 |
| 14 | **São Salvador Alimentos (SuperFrango)** — Super Frango Rações e Fábrica de Rações Matrizes (Itaberaí/GO) | 123,8 | Fábricas de ração | Indício | a confirmar | não encontrado nesta rodada | não encontrado | Demais (Receita) | 03.387.396/0002-40 e 0024-56 (ativas; CNAE 1066-0) | BrasilAPI 06/10/2026; Econodata |
| 15 | **De Heus** — unidade industrial (Itaberaí/GO) | 123,8 | Suplementos minerais, premixes, núcleos, proteinados e rações | Indício: a matéria cita milho nas dietas da região, não na fábrica | a confirmar | não encontrado nesta rodada | não encontrado | não encontrado | não encontrado | Portal do Agronegócio 26/05/2026 |
| 16 | **Comigo** — fábrica de rações no complexo industrial (Rio Verde/GO) | 129,2 | Rações (151 fórmulas); também origina e armazena milho | Indício para a fábrica; a cooperativa negocia milho e sorgo (10% do faturamento) | a confirmar | comigo.coop.br | (64) 3611-1500 (revista da Comigo) | Demais (Receita) | 02.077.618/0002-66 (ativa; CNAE secundário 1066-0) | site; revista Comigo mar–abr; BrasilAPI 06/10/2026 |
| 17 | **Fazenda Tropical** — confinamento/boitel (Montividiu/GO) | 130,6 | Boitel; mais de 35 mil cabeças já confinadas | Indício | a confirmar | fazendatropicalgoias.com.br | fazenda.tropical@yahoo.com.br · (64) 99904-1996 | não encontrado | não encontrado | site, consultado em 06/10/2026 |
| 18 | **Premix** — filial (Anápolis/GO) · matriz em SP | 145,4 | Alimentos para animais (premix e suplementos) | Indício fraco: nada sobre milho | a confirmar | não encontrado | não encontrado | Demais (Receita) | 50.411.321/0028-77 (ativa; CNAE 1066-0) | BrasilAPI 06/10/2026 |
| 19 | **Agrocria Nutrição Animal** — fábrica (Anápolis/GO) | 145,4 | Nutrição para confinamento com milho grão inteiro | Indício (relatório de estágio de 2014) | a confirmar | não encontrado | não encontrado | não encontrado | não encontrado | relatório de estágio, 2014 |
| 20 | **BAIA Nutrição Animal (Araguaia)** (Abadiânia/GO) | 173,8 | Nutrição animal: 12 mil t/ano | Indício | a confirmar | araguaia.com.br | não encontrado | não encontrado | não encontrado | site, consultado em 06/10/2026 |
| 21 | **Confinamento Pontal** (Itapirapuã/GO) | 185,8 | Confinamento | Indício: a fonte cita sorgo | a confirmar | não encontrado | não encontrado | não encontrado | não encontrado | Diário da Manhã 13/09/2024 |
| 22 | **BRF/MBRF** — Jataí (fábrica de rações) | 203,6 | Abate de aves; fábrica de rações | Indício | a confirmar | brf-global.com | não encontrado | grande | não encontrado | artigo UNIFACS; Política em Goiás 18/09/2024 |
| 23 | **FVO Alimentos** — fábrica (Rialma/GO) | 210,3 | Alimentos para cães e gatos | Indício | a confirmar | fvoalimentos.com.br | não encontrado | não encontrado | não encontrado | site, consultado em 06/10/2026 |
| 24 | **Rialma Agropecuária** — confinamento (Luziânia/GO) | 224,4 | Confinamento de bovinos de corte | Indício | a confirmar | não encontrado | não encontrado | não encontrado | não encontrado | repositório IF Goiano 15/08/2025 |
| 25 | **BRF/MBRF** — Mineiros (fábrica de rações) | 299,8 (**no limite**) | Abate; fábrica de rações | Indício | a confirmar | brf-global.com | não encontrado | grande | não encontrado | artigo UNIFACS |

### A2. Projetos e planos de consumo (ainda não consomem, ou operação não confirmada)

| Empresa — unidade | km | Situação | Fonte |
|---|---|---|---|
| **Inpasa** — biorrefinaria (Rio Verde/GO) | 129,2 | Em construção; operação prevista para o 1º trimestre de 2027; 2 Mt de grãos por ano | Inpasa, 30/10/2025 |
| **Goiás Bioenergia** — (Porteirão/GO) | 81,9 | Planta de etanol de milho anunciada em 2022; operação **não confirmada** | JornalCana 08/06/2022 |
| **Energética Serranópolis** (Serranópolis/GO) | 264,3 | Deve iniciar processamento de milho em 2026 | Jornal Opção 13/06/2026 |
| Usina de Vicentinópolis (empresa não identificada pela fonte) | 60,7 | Citada em ampliação de etanol de milho. A unidade da Usina Caçu ali é de **cultivo** de cana e milho (CNAE 0113-0), sem prova de consumo | Jornal Opção 13/06/2026; BrasilAPI 06/10/2026 |

### A3. Processam milho, mas declaram **não-GMO** (evidência contrária ao milho GMO)

| Empresa — unidade | km | Evidência | Fonte |
|---|---|---|---|
| **Milhão Ingredientes** — Goianira/GO e Rio Verde/GO (ex-unidade da LDC, parceria com Amaggi) | 95,4 / 129,2 | Processa milho; "ingredientes de milho Non-GMO" | milhao.net, consultado em 06/10/2026 |
| **BRMill Alimentos** — Fazenda São Miguel (Silvânia/GO) | 163,3 | Moinho de milho não-GMO, com produção própria | brmill.com.br, consultado em 06/10/2026 |

Ficam visíveis, com a evidência contrária. Só valem para milho GMO se a própria empresa confirmar outra linha.

## B. Traders e originadores (grupo separado, prioridade secundária)

| Empresa — unidade | km | Evidência | Fonte |
|---|---|---|---|
| **Cargill Agro** — Rio Verde/GO | 129,2 | CNAE 4632-0/01, comércio atacadista de cereais (CNPJ 53.169.389/0013-01, ativa) | BrasilAPI 06/10/2026 |
| **Louis Dreyfus Company** — Rio Verde e Itumbiara | 129,2 / 142,4 | Unidades listadas; 13 armazéns em GO | site LDC; pili.ind.br |
| **Bunge** — armazéns em GO | — (unidades não localizadas) | 12 armazéns em GO | pili.ind.br |
| **Cereal Comércio Exportação** — armazéns em GO | — (unidades não localizadas) | 15 armazéns em GO | pili.ind.br |
| **Gravos Comercialização de Grãos** — Rio Verde/GO | 129,2 | Comercialização e transporte de milho | gravos.com.br |
| (Comigo e Caramuru também originam e estão no grupo A, pela fábrica) | — | — | — |

## Fora do raio (encontradas, não contam)

- **Neomille (CerradinhoBio)**, em Chapadão do Céu: 316,0 km. Etanol de milho, 1,2 Mt/ano.
- **Mantiqueira**, em Formosa: 357,7 km. Ovos, com fábrica de ração.

## Pendências desta descoberta

1. **Cobertura:** consultar uma fonte estruturada por CNAE e município. Nada foi contratado. Candidatas a fonte gratuita, ainda a validar como fonte: lista do MAPA/SIPEAGRO e lista de associados do Sindirações. Hoje faltam a maioria das pequenas e médias fábricas de ração, moinhos de milho e confinamentos.
2. **Unidade x sede:** CNPJ da unidade não encontrado nas linhas 1–7, 9–11, 13, 15, 17, 19–25.
3. **Evidência:** transformar indício em evidência da própria empresa (documento, página da unidade, registro). Indício não pontua.
4. **Milho GMO:** "a confirmar" em todas. Só a própria empresa confirma, na qualificação. Caramuru, Milhão e BRMill têm sinal de linha não-GMO.
5. **Confinamentos citados sem município:** Agropecuária Grande Lago e Fazenda Conforto, cada uma com cerca de 70 mil cabeças e floculadores de milho (Scot Consultoria, 16/08/2024). Ficam com localização pendente e não entraram na lista.
6. **Aceite:** nenhuma empresa foi cadastrada no Compass. O aceite de cada candidata é de Rogério; depois dele, cadastro por CNPJ com fonte, e nenhum contato antes da T11 e dos demais bloqueios (`DECISOES-PILOTO-2026-10-01.md`).
