# Descoberta: milho GMO, centro em Indiara/GO, raio de 300 km (2026-10-06, rodada 2)

**Objetivo:** encontrar compradoras e consumidoras de milho para qualificação posterior. É só descoberta.
- Nenhuma empresa foi cadastrada no Compass nem aceita. O aceite é de Rogério.
- Nenhum contato, nenhum crédito Snov, nenhuma ficha ou campanha.
- Nenhuma pessoa pesquisada e nenhum e-mail validado nesta etapa.
- Método: `/prospeccao-vendas`, buscando pelo uso final.
- Rodada 1: pesquisa manual na web.
- Rodada 2: cadastro oficial do MAPA (SIPEAGRO) mais Receita (BrasilAPI).
- Sem LLM em distância, deduplicação, parse ou classificação: tudo por regras fixas em script (`build.mjs`, descrito no fim).

## 1. Centro e raio

- **Indiara/GO:** IBGE 5209952, centroide -17,1852; -49,9682. É o centro da busca, não o endereço do fornecedor (R11.3).
- **Raio:** 300 km, valor permitido (R11.14).
- **Municípios no raio** (centroide a até 300 km): 224, sendo 195 em GO, 28 em MG e 1 no DF. Estão em `municipios-300km.csv`.
- **Precisão da distância:** todas as distâncias são **estimadas**, do centroide de Indiara ao centroide do município da unidade (R11.6). Nenhuma usa a coordenada da unidade.
  - Unidades a partir de 270 km ficam marcadas "conferir distância". O endereço real pode estar fora do raio.
  - Isso vale também para o DF: o centroide de Brasília fica a 279,2 km e o DF se estende por dezenas de quilômetros.

## 2. Fonte oficial adotada: lista de estabelecimentos de alimentação animal do MAPA (SIPEAGRO)

| Item | Conferido em 06/10/2026 |
|---|---|
| Arquivo aberto | `sipeagroalimentacaoanimal.csv`, conjunto "SIPEAGRO — Alimentação Animal" em dados.agricultura.gov.br (recurso 378b184b) |
| Data | arquivo atualizado em **04/10/2026** (dados.gov.br); 17.977 linhas no Brasil |
| Licença | **CC-BY**: uso livre com citação da fonte (MAPA) |
| Campos | UF, município, número do registro, situação do registro, CPF/CNPJ (**mascarado**: só os dígitos 6–8 aparecem), razão social, área, atividade (fabricante, importador, fracionador, armazenador) e classificação (ração, concentrado, alimento, suplemento, núcleo, premix, aditivo, ingrediente, coproduto, mastigáveis) |
| Lista com CNPJ completo | PDF oficial do MAPA "Lista de Estabelecimentos SIPEAGRO", **21/07/2026**, 71 páginas (página "Registro e cadastro", Decreto 12.031/2024) |
| Cobertura | estabelecimentos **registrados no MAPA** para produzir ou manipular produtos de alimentação animal. **Não** cobre: moinhos de milho para alimentação humana (a não ser que também registrem ingrediente de ração), cervejarias, confinamentos e granjas que fabricam ração só para consumo próprio sem registro, nem usinas de etanol sem registro de coproduto |
| Contratação | nenhuma. Fonte pública e gratuita |

**Validação por amostra (antes de adotar):**
- as empresas conhecidas da rodada 1 aparecem nos municípios corretos, com os dígitos visíveis do CNPJ coerentes: SuperFrango (Itaberaí, Nova Veneza), Comigo (Rio Verde, Jataí, Montes Claros), BRF (Rio Verde, Jataí, Mineiros, Uberlândia), Caramuru (Itumbiara), São Martinho e Cargill Bioenergia (Quirinópolis), Rei do Milho (Inhumas), Gem (Acreúna), Milhão (Goianira, Goiânia, Rio Verde) e Cimilho (Uberlândia);
- a Inpasa (em construção) não aparece, como esperado;
- o registro GO0008923 do CSV equivale a "GO 000892-3" no PDF; a ligação foi conferida pelo CNPJ 03.387.396/0002-40 (SuperFrango).

**Ligação CSV × PDF:**
- o CNPJ completo vem do PDF;
- só é aceito quando bate com os dígitos visíveis da máscara do CSV;
- os registros cujo CNPJ não bateu ficam "CNPJ a conciliar". Não houve fusão.

## 3. Origem dos números "32 em Anápolis" e "146 em Goiás"

| Número | Origem | Situação |
|---|---|---|
| "32 empresas ativas" com CNAE 1066-0 em Anápolis | cirtrox.com.br, agregador privado de cadastros por CNAE, sem data | Não é cobertura comprovada: conta CNPJs por CNAE, inclusive escritórios e comércio, sem confirmar a fábrica |
| "146 empresas" com CNAE 1064-3 em Goiás, "70% ativas" | cnpjgo.com.br, agregador privado | Idem; CNAE 1064 inclui moinhos de milho para alimentação humana, quase todos fora do SIPEAGRO |
| Comparação oficial | SIPEAGRO | **26** estabelecimentos fabricantes ativos em Anápolis, 23 deles com perfil de consumidora |

## 4. Totais sem duplicidade

**Regras de contagem:**
- um estabelecimento é contado **uma vez por CNPJ completo** da unidade;
- registros repetidos por atividade ou classificação não inflam o total (no CSV do MAPA, cada combinação de atividade e classificação é uma linha);
- sem CNPJ conferido, conta-se pelo número do registro MAPA;
- a fusão automática só ocorre com o **mesmo CNPJ completo**;
- nome e município iguais apenas **sugerem** correspondência, marcada "a conciliar".

| Etapa | Quantidade |
|---|---|
| Linhas do CSV MAPA nos 224 municípios do raio | 1.743 |
| Registros MAPA distintos (todas as situações) | 507 |
| Registros ativos | 472 |
| Registros ativos com atividade de **fabricante** | 445 |
| **Estabelecimentos MAPA únicos** | **445**: 389 por CNPJ completo conferido (nenhum CNPJ repetido) e 56 só pelo registro, com CNPJ a conciliar |
| Candidatas da pesquisa manual (rodada 1) | 36 |
| Manuais com o **mesmo CNPJ completo** de um registro MAPA (fundidas) | 7 (SuperFrango ×3, Comigo Rio Verde, Rei do Milho, São Martinho Boa Vista, Cargill Bioenergia São Francisco) |
| Manuais mantidas como linha própria | 29 |
| Linhas em `candidatas.csv` | 474 |
| Manuais com **possível correspondência** a registro MAPA (a conciliar) | 18, ligadas a 23 registros MAPA |
| **Estabelecimentos distintos** | **entre 456 e 474**: o valor exato depende da conciliação desses 18 casos |

**Papéis entre os 445 estabelecimentos MAPA** (o papel é independente do porte):

| Papel | Qtde | Critério |
|---|---|---|
| Consumidora/processadora potencial | 405 | registra ração, concentrado, alimento, ingrediente ou coproduto |
| Trader/originadora (grupo separado) | 9 | ADM, Bunge, LDC, Cereal Comércio |
| Baixa aderência | 22 | só suplemento mineral, núcleo, premix ou aditivo (pouco ou nenhum milho a granel) |
| Excluída: subproduto de origem animal | 9 | frigoríficos e graxarias sem registro de ração |

**Consumidoras MAPA (405), por dimensão.** As dimensões são independentes entre si:
- **UF:** GO 336; MG 51; DF 18.
- **CNPJ conferido:** 354. Os demais estão sem consulta à Receita.
- **Situação na Receita:** ativa 341; não consultada 51; baixada 4; suspensa 7; inapta 2. As 13 não ativas na Receita seguem ativas no MAPA: ficam visíveis, com alerta na coluna "Alerta".
- **Porte cadastral:**
  - Demais (não indica média nem grande) 202; não consultado 51; EPP (pequena) 52; ME (micro) 100;
  - "Demais" só diz que **não** é ME nem EPP, sem distinguir média de grande;
  - porte só desempata.
- **Matriz/filial:** matriz 253; filial 101; não consultado 51.
- **Raiz de CNPJ:** 42 estabelecimentos dividem a raiz com outra unidade no raio, ou seja, são a mesma pessoa jurídica. Isso **não** é "grupo econômico", campo que fica "não pesquisado" salvo fonte.
- **Evidência de milho:** nenhuma das linhas só-MAPA tem evidência específica. O registro **indica a atividade** e não prova compra de milho.
- **Milho GMO:** "a confirmar" em todas, salvo restrição registrada numa linha ou unidade (seção 7).

## 5. Vínculos entre evidência manual e unidade

A evidência manual só fica na unidade quando a fonte estabelece um vínculo inequívoco:
- CNPJ publicado na fonte;
- cadastro oficial da própria unidade;
- ou nome e endereço completos compatíveis.

A evidência sobre a empresa fica no nível da empresa.

| Situação | Qtde | Casos |
|---|---|---|
| **Vínculo confirmado** por CNPJ e endereço publicados na fonte da evidência | **1** | Cargill Uberlândia (M08): parecer IGAM/COPAM 2021 com CNPJ, endereço e coordenada |
| **Vínculo confirmado** por endereço da fonte igual ao da Receita | **1** | Rei do Milho (M02): endereço do site = endereço do CNPJ 05.574.242/0001-02 |
| **Vínculo confirmado** por cadastro oficial com nome ou endereço da unidade, mesmo CNPJ no MAPA | **2** | São Martinho (M06: Receita "Fazenda Boa Vista", CNAE álcool) e Cargill Bioenergia (M07: Receita "USF Usina São Francisco") |
| **Vínculo confirmado** pelo cadastro oficial da própria unidade, mesmo CNPJ no MAPA, só indício | **4** | SuperFrango NV (M12), Itaberaí (M14, M15) e Comigo Rio Verde (M17) |
| CNPJ da unidade pelo cadastro oficial, sem registro MAPA com o mesmo CNPJ | 2 | Premix Anápolis (M19), Cargill Agro Rio Verde (T01, trader) |
| **Vínculo sugerido** (nome e município), a conciliar | **18 candidatas manuais ↔ 23 registros MAPA** | ver colunas "Registro MAPA" e "Possível correspondência" |
| Sem registro MAPA sugerido | 11 | Usina Rio Verde, JBS Aruanã, Fazenda Tropical, Agrocria, Confinamento Pontal, Rialma Agropecuária, Cargill Agro (T01), Gravos e os 3 projetos |

Evidência específica de milho (10, depois da revisão de 06/10/2026):
- 4 com vínculo confirmado com a unidade: M02, M06, M07, M08;
- 5 descrevem a unidade, mas o CNPJ só é sugerido: M01 Gem, M03 BRF, M05 Caramuru, M09 JBJ, R02 BRMill;
- 1 do nível da empresa: R01 Milhão.

Rebaixadas na revisão:
- **Usina Rio Verde (M04)** passa a indício, porque "etanol de grãos" não comprova milho.
- **JBS Aruanã (M10)** passa a histórica, porque a fonte de 2014 não comprova a operação atual (seção 6).

## 6. Primeiro lote para o aceite de Rogério: evidência específica de milho

Critérios:
- a fonte cita milho consumido ou processado;
- consumidora ou processadora;
- sem restrição não-GMO registrada.

A coluna "Registro MAPA" mostra só a **sugestão**: aceitar a candidata não concilia o CNPJ.

| # | Candidata (id) | Município | km | Evidência de milho [fonte] | Nível da evidência | CNPJ da unidade | Registro MAPA / CNPJ sugerido | Milho GMO |
|---|---|---|---|---|---|---|---|---|
| 1 | **Gem Alimentos — usina de etanol de milho** (M01) | Acreúna/GO | 48,2 (centroide) | Autorização ANP (DOU 23/02/2023) para etanol de milho, até 120 mil L/dia; a empresa mói milho e modifica amido. Operação atual não confirmada por fonte de 2024–2026; compra de milho de terceiros não declarada [Empreender em Goiás 27/02/2023; JornalCana 24/02/2023] | nível unidade | não confirmado | CNPJ sugerido: 25.006.271/0001-85 (Receita: GEM e/ou GEM ALIMENTOS, BR-060 km 308, Acreúna; CNAE secundário álcool e óleo de milho) — nome e município batem, mas a fonte não traz CNPJ nem endereço da usina · possível correspondência com registro MAPA GO0009253 25.006.271/0001-85 (Acreúna/GO) — a conciliar | a confirmar |
| 2 | **Rei do Milho Alimentos** (M02) | Inhumas/GO | 106,5 (coordenada) | Moagem de milho (creme, sêmola, grits, fubá, gérmen); parque de 140 mil m² em Inhumas desde 1999. Compra de milho de terceiros não declarada. Razão social atual: 'em recuperação judicial' [reidomilho.com.br, consultado em 06/10/2026] | nível unidade | 05.574.242/0001-02 — confirmado: registro MAPA (CNPJ da lista oficial conferido pela máscara do CSV); endereço do site (Rod. GO-426 km 01, 2024, Bloco B, Inhumas) = endereço da Receita do CNPJ | mesmo CNPJ: GO0012572 | a confirmar |
| 3 | **BRF/MBRF — complexo de Rio Verde (fábrica de rações)** (M03) | Rio Verde/GO | 129,2 (centroide) | Ração com milho e sorgo locais; ~750 mil t de milho e farelo de soja em 2007 (dados de 2007–2014). A unidade segue operando (8 mil funcionários, 2026), mas o uso atual de milho não foi confirmado por fonte recente [Folha de S.Paulo 23/06/2014; artigo UNIFACS; AgFeed 21/02/2026 (operação)] | nível unidade | não confirmado | CNPJ sugerido: 01.838.723/0172-83 (único registro de ração BRF em Rio Verde no MAPA; Receita: BR-060 km 394, CNAE abate de suínos) — a fonte da evidência não traz CNPJ nem endereço da fábrica · possível correspondência com registro MAPA GO0009520 01.838.723/0172-83 (Rio Verde/GO) — a conciliar | a confirmar |
| 4 | **Caramuru Alimentos — fábrica de processamento de milho** (M05) | Itumbiara/GO | 142,4 (centroide) | Site da empresa: unidade de Itumbiara com processamento de milho de 24 mil t/mês, degerminação 960 t/dia, pré-cozido 5 mil t/mês (página sem data). Também origina grãos; compra de terceiros não declarada nessa página [caramuru.com, página 'Unidades industriais – Itumbiara', consultada em 06/10/2026] | nível unidade | não confirmado | CNPJ sugerido: 00.080.671/0001-00 é o CNPJ da matriz publicado pela própria empresa (Via Expressa Júlio Borges de Souza, 4240, Itumbiara); há outras filiais no mesmo complexo (0032-06 no nº 4240; 0033-97 no nº 4200) — qual delas opera a fábrica de milho fica a confirmar · possível correspondência com registro MAPA GO0009970 00.080.671/0001-00 (Itumbiara/GO) — a conciliar | a confirmar; a empresa declara linha de produtos não transgênicos (restrição dessa linha, não de toda a operação) |
| 5 | **São Martinho — Usina Boa Vista, planta de milho** (M06) | Quirinópolis/GO | 151,4 (centroide) | Em operação: previsão de 495 mil t de milho na safra 2026/27 (manutenção ampliada pela 2ª fase). Compra de milho de terceiros não declarada nas fontes; a ampliação de 2027 é projeto à parte [RPAnews 27/05/2026; BNDES (operação desde 2023/24)] | nível unidade | 51.466.860/0062-78 — confirmado: registro MAPA (CNPJ da lista oficial conferido pela máscara do CSV); cadastros oficiais: Receita (Rod. GO-164 km 10, Fazenda Boa Vista, CNAE fabricação de álcool) e registro MAPA GO0008761 de ingrediente no mesmo CNPJ | mesmo CNPJ: GO0008761 | a confirmar |
| 6 | **Cargill Bioenergia — Unidade São Francisco** (M07) | Quirinópolis/GO | 151,4 (centroide) | Em operação em 2025/26: cana e milho; maceração de 600 mil t de milho/ano; óleo de milho e DDG. Compra de milho de terceiros não declarada [STG News 01/09/2026; Globo Rural 11/06/2025] | nível unidade | 10.249.419/0002-16 — confirmado: registro MAPA (CNPJ da lista oficial conferido pela máscara do CSV); cadastro oficial: Receita com nome fantasia 'USF USINA SAO FRANCISCO' (Rod. GO-206 km 18, Fazenda São Francisco) e registro MAPA GO0011258 no mesmo CNPJ | mesmo CNPJ: GO0011258 | a confirmar |
| 7 | **Cargill — complexo de Uberlândia** (M08) | Uberlândia/MG | 256,5 (coordenada) | Planta de milho com capacidade nominal de 60 mil t/mês (glúten, amido, óleo); 'milho também fornecido por fazendeiros, cooperativas e corretores' — compra de terceiros declarada. Licença renovada em 2021 por 8 anos; operação 2025–2026 não confirmada por fonte própria recente [Parecer Único SUPRAM TM 0138312/2021, de 25/01/2021] | nível unidade | 60.498.706/0134-88 — confirmado: CNPJ e endereço (Rua Will Cargill, 880) publicados na fonte da evidência; mesmo endereço na Receita | possível correspondência com registro MAPA MG0001937 CNPJ a conciliar (Uberlândia/MG) — a conciliar | a confirmar |
| 8 | **Grupo JBJ — confinamento Fazenda Colorado** (M09) | Aruanã/GO | 284,1 (centroide) | Mais de 1.000 t de ração/dia; 'parte significativa do milho' é produzida no próprio sistema — produção própria não comprova compra de terceiros [Curta Mais 05/01/2026] | nível unidade | não confirmado | CNPJ sugerido: 15.689.716/0022-40 'JBJ NUTRICAO ANIMAL' (registro MAPA; endereço na GO-530 km 30, Fazenda Planura). A Fazenda Colorado tem outros CNPJs da mesma raiz (0033-00, 0032-11) — a fábrica que atende o confinamento fica a confirmar · possível correspondência com registro MAPA GO0011355 15.689.716/0022-40 (Aruanã/GO) — a conciliar | a confirmar |

**Leitura das evidências (revisão de 06/10/2026):**
- capacidade nominal não é consumo;
- produção própria de milho (JBJ) não comprova compra de terceiros;
- só a Cargill Uberlândia declara compra de "fazendeiros, cooperativas e corretores";
- notícia antiga não comprova operação atual. A operação recente está confirmada só para São Martinho e Cargill Bioenergia (2026); para BRF, a operação da unidade é de 2026, mas o dado de milho é de 2007–2014.

Comparação curta com o lote ME/EPP: `QUALIFICACAO-LOTES-2026-10-06.md`.

| Candidata (id) | Município | km | Situação [fonte] |
|---|---|---|---|
| **JBS — confinamento com fábrica de ração (Fazenda Planura)** (M10) | Aruanã/GO | 284,1 | Fonte de 2014: não comprova operação atual. O CNPJ JBS Confinamento 'Fazenda Planura' segue ativo (GO-530 km 30), e a JBJ registra no MAPA uma fábrica de ração no mesmo endereço; identidade ou sucessão da unidade não comprovada — linhas mantidas separadas, a conciliar [ACSURS 07/05/2014; cadastro de terceiros (indicecnpj, Receita 07/2026)] |

## 7. Processam milho com restrição não-GMO registrada (por linha ou unidade)

Uma linha não-GMO **não** prova que todas as operações da empresa recusem milho GMO. A restrição vale só para a linha ou unidade citada.

| Candidata (id) | Município | km | Evidência [fonte] | Restrição GMO registrada | Registro MAPA |
|---|---|---|---|---|---|
| **BRMill Alimentos — Fazenda São Miguel** (R02) | Silvânia/GO | 163,3 | Moinho de milho não-GMO, com produção própria [brmill.com.br, consultado em 06/10/2026] | restrição registrada nesta unidade (moinho não-GMO) | possível correspondência com registro MAPA GO0011479 08.469.992/0001-02 (Silvânia/GO) — a conciliar |
| **Milhão Ingredientes** (R01) | localização pendente | — | Processa milho; linha de ingredientes de milho Non-GMO (unidades em Goianira e Rio Verde, ex-LDC) [milhao.net, consultado em 06/10/2026] | restrição registrada só na linha de ingredientes Non-GMO; outras linhas e unidades a verificar | possível correspondência com registro MAPA GO0012424 08.647.384/0002-21 (Goianira/GO); GO0012637 08.647.384/0001-40 (Goiânia/GO); GO0023566 08.647.384/0006-55 (Rio Verde/GO) — a conciliar |

A Caramuru (lote 1) declara linha de produtos não transgênicos. A restrição fica nessa linha, não na fábrica inteira.

## 8. Demais candidatas da pesquisa manual (indício por atividade)

| Candidata (id) | Município | km | Indício [fonte] | CNPJ | Registro MAPA |
|---|---|---|---|---|---|
| **São Salvador Alimentos (SuperFrango) — SSA Rações NV** (M12) | Nova Veneza/GO | 115,8 | Fábrica de ração (avicultura integrada) [BrasilAPI 06/10/2026] | 03.387.396/0022-94 | mesmo CNPJ: GO0011924 |
| **São Salvador Alimentos (SuperFrango) — Super Frango Rações** (M14) | Itaberaí/GO | 123,8 | Fábrica de ração [BrasilAPI 06/10/2026] | 03.387.396/0002-40 | mesmo CNPJ: GO0008923 |
| **São Salvador Alimentos (SuperFrango) — Fábrica de Rações Matrizes** (M15) | Itaberaí/GO | 123,8 | Fábrica de ração [BrasilAPI 06/10/2026] | 03.387.396/0024-56 | mesmo CNPJ: GO0014168 |
| **Comigo — fábrica de rações** (M17) | Rio Verde/GO | 129,2 | Rações (151 fórmulas); a cooperativa também origina e armazena milho [comigo.coop.br; revista Comigo; BrasilAPI 06/10/2026] | 02.077.618/0002-66 | mesmo CNPJ: GO0009610 |
| **Agroquima — fábrica de rações e suplementos** (M11) | Aparecida de Goiânia/GO | 85,9 | Rações e suplementos para bovinos [LinkedIn, consultado em 06/10/2026] | não encontrado | possível correspondência com registro MAPA GO0011193 CNPJ a conciliar (Aparecida de Goiânia/GO) — a conciliar |
| **Adimax — unidade industrial** (M13) | Goianápolis/GO | 121,5 | Alimentos para cães e gatos [adimax.com.br, consultado em 06/10/2026] | não encontrado | possível correspondência com registro MAPA GO0010693 03.887.324/0012-34 (Goianápolis/GO) — a conciliar |
| **De Heus — unidade industrial** (M16) | Itaberaí/GO | 123,8 | Suplementos, premixes, núcleos, proteinados e rações; a matéria cita milho nas dietas da região, não na fábrica [Portal do Agronegócio 26/05/2026] | não encontrado | possível correspondência com registro MAPA GO0011630 02.513.991/0010-22 (Itaberaí/GO) — a conciliar |
| **Usina Rio Verde** (M04) | Rio Verde/GO | 129,2 | Rebaixada: o site fala em 'etanol de grãos', DDG e WDG, sem nomear milho — grãos não comprovam milho [usinarioverde.com.br, consultado em 06/10/2026] | não encontrado | nenhum registro MAPA sugerido |
| **Fazenda Tropical — boitel** (M18) | Montividiu/GO | 130,6 | Boitel; mais de 35 mil cabeças já confinadas [fazendatropicalgoias.com.br, consultado em 06/10/2026] | não encontrado | nenhum registro MAPA sugerido |
| **Premix — filial Anápolis** (M19) | Anápolis/GO | 145,4 | Premix e suplementos; nada sobre milho [BrasilAPI 06/10/2026] | 50.411.321/0028-77 | possível correspondência com registro MAPA GO0014818 CNPJ a conciliar (Anápolis/GO) — a conciliar |
| **Agrocria Nutrição Animal** (M20) | Anápolis/GO | 145,4 | Nutrição para confinamento com milho grão inteiro (relatório de 2014) [relatório de estágio, 2014] | não encontrado | nenhum registro MAPA sugerido |
| **BAIA Nutrição Animal (Araguaia)** (M21) | Abadiânia/GO | 173,8 | Nutrição animal: 12 mil t/ano [araguaia.com.br, consultado em 06/10/2026] | não encontrado | possível correspondência com registro MAPA GO0013919 03.306.578/0055-51 (Abadiânia/GO) — a conciliar |
| **Confinamento Pontal** (M22) | Itapirapuã/GO | 185,8 | Confinamento; a fonte cita sorgo [Diário da Manhã 13/09/2024] | não encontrado | nenhum registro MAPA sugerido |
| **BRF/MBRF — Jataí (fábrica de rações)** (M23) | Jataí/GO | 203,6 | Abate de aves; fábrica de rações [artigo UNIFACS; Política em Goiás 18/09/2024] | não encontrado | possível correspondência com registro MAPA GO0013846 01.838.723/0188-40 (Jataí/GO) — a conciliar |
| **FVO Alimentos — fábrica Rialma** (M24) | Rialma/GO | 210,3 | Alimentos para cães e gatos [fvoalimentos.com.br, consultado em 06/10/2026] | não encontrado | possível correspondência com registro MAPA GO0009202 08.471.163/0013-06 (Rialma/GO) — a conciliar |
| **Rialma Agropecuária — confinamento** (M25) | Luziânia/GO | 224,4 | Confinamento de bovinos de corte [repositório IF Goiano 15/08/2025] | não encontrado | nenhum registro MAPA sugerido |
| **BRF/MBRF — Mineiros (fábrica de rações)** (M26) | Mineiros/GO | 299,8 | Abate; fábrica de rações [artigo UNIFACS] | não encontrado | possível correspondência com registro MAPA GO0014125 01.838.723/0189-21 (Mineiros/GO); GO0013323 01.838.723/0182-55 (Mineiros/GO) — a conciliar |

## 9. Segundo lote sugerido: indício forte no cadastro, sem evidência específica

Usinas registradas no MAPA como produtoras de ingrediente (possível DDG de milho, ainda não comprovado) e empresas com milho no nome. A evidência de milho fica pendente.

| Razão social (MAPA) | CNPJ | Município | km | Atividade (MAPA) | CNAE (Receita) | Porte | Situação |
|---|---|---|---|---|---|---|---|
| DENUSA DESTILARIA NOVA UNIÃO S/A | 00.595.322/0001-20 | Jandaia/GO | 25 | ADITIVO+INGREDIENTE · usina/bioenergia | 1931400 Fabricação de álcool | Demais (não indica média nem grande) | MAPA: ativo; Receita: ativa |
| caçu comercio e industria de açucar e alcool ltda | 07.996.345/0001-96 | Vicentinópolis/GO | 60,7 | ADITIVO+INGREDIENTE · usina/bioenergia | 1071600 Fabricação de açúcar em bruto | Demais (não indica média nem grande) | MAPA: ativo; Receita: ativa |
| USINA NOVA GALIA LTDA. | 07.300.906/0001-70 | Paraúna/GO | 72,8 | INGREDIENTE · usina/bioenergia | 1931400 Fabricação de álcool | Demais (não indica média nem grande) | MAPA: ativo; Receita: ativa |
| Araporã bioenergia s/a | 19.818.301/0001-55 | Araporã/MG | 169 | INGREDIENTE · usina/bioenergia | 1071600 Fabricação de açúcar em bruto | Demais (não indica média nem grande) | MAPA: ativo; Receita: ativa |
| CASA DO MILHO DISTRIBUICAO LTDA | 28.035.928/0001-20 | Araguari/MG | 241 | RAÇÃO+SUPLEMENTO · milho no nome | 4632001 Comércio atacadista de cereais e leguminosas beneficiados | ME (micro) | MAPA: ativo; Receita: ativa |
| CIMILHO COMERCIO INDUSTRIA DE MILHO GUIMARAES LTDA | 19.980.044/0001-53 | Uberlândia/MG | 268,1 | INGREDIENTE · milho no nome | 1064300 Fabricação de farinha de milho e derivados, exceto óleos de milho | EPP (pequena) | MAPA: ativo; Receita: ativa |
| S.A. USINA CORURIPE AÇÚCAR E ÁLCOOOL | a conciliar (máscara **.***.415/***-**) | Carneirinho/MG | 299,3 | INGREDIENTE · usina/bioenergia | não consultado | não consultado | MAPA: ativo; Receita: não consultada |

## 10. Pequenas empresas (ME/EPP pelo porte cadastral)

Entre as 405 consumidoras potenciais do MAPA, **152** têm porte ME ou EPP na Receita (100 ME + 52 EPP). Esta seção lista **150**: as outras 2 (Cimilho, EPP, e Casa do Milho, ME) estão na seção 9, para não aparecerem duas vezes. Das 150:
- 140 estão ativas na Receita;
- 115 têm CNAE principal 1066-0 (alimentos para animais).

É a lacuna das pequenas que a rodada 1 não cobria. Médias **não** podem ser separadas das grandes: a Receita só informa "Demais". Nenhuma tem evidência específica de milho ainda.

| Razão social (MAPA) | CNPJ | Município | km | Porte | CNAE (Receita) |
|---|---|---|---|---|---|
| CALFORTE BENEFICIAMENTO DE CALCÁRIO LTDA | 25.982.566/0001-97 | Cezarina/GO | 25,1 | EPP (pequena) | 2399199 Fabricação de outros produtos de minerais não-metálicos não especificados anteriormente |
| A PIONEIRA COMERCIO DE GRÃOS LTDA ME | 00.047.274/0001-36 | Guapó/GO | 52 | ME (micro) | 4623199 Comércio atacadista de matérias-primas agrícolas não especificadas anteriormente |
| RURAL FORTE NUTRICAO ANIMAL LTDA | 06.026.372/0001-73 | Pontalina/GO | 59,7 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| LF COMERCIO DE GRAOS LTDA | 14.331.970/0002-65 | Pontalina/GO | 59,7 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| AGROVET ATACADISTA DE PRODUTOS AGROPECUARIOS LTDA | 37.354.203/0002-77 | Aragoiânia/GO | 63,9 | EPP (pequena) | 4623109 Comércio atacadista de alimentos para animais |
| RICARTE AGROPECUÁRIA - EIRELI | 37.670.854/0001-95 | Nazário/GO | 68,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| P&S PRODUTOS AGROPECUÁRIOS LTDA | 09.276.439/0002-05 | Abadia de Goiás/GO | 70,6 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| SOCIAGRO NUTRICAO ANIMAL LTDA - ME | 08.769.542/0001-35 | Paraúna/GO | 72,8 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| FAZENDÂO INDÚSTRIA E COMÉRCIO DE NUTRIÇÂO ANIMAL EIRELI | 34.113.619/0001-24 | Trindade/GO | 75,5 | EPP (pequena) | 4639701 Comércio atacadista de produtos alimentícios em geral |
| YABAGATA NUTRICAO ANIMAL LTDA | 21.196.572/0001-68 | Trindade/GO | 75,5 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| SUPERA PARTICIPAÇÕES LTDA | 35.841.026/0001-47 | Trindade/GO | 75,5 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RURAL CRIA INDUSTRIA E COMERCIO DE RAÇÕES LTDA | 54.478.827/0001-34 | Trindade/GO | 75,5 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| AGRORURALVET NUTRIÇÃO ANIMAL LTDA | 51.466.590/0001-83 | Hidrolândia/GO | 77 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| VF INDUSTRIA E COMERCIO DE RACOES LTDA - ME | 11.595.239/0001-78 | Hidrolândia/GO | 77 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| D.L NUTRI INDÚSTRIA DE SUPLEMENTO E NUTRIÇÃO ANIMAL LTDA | 37.405.722/0001-36 | Hidrolândia/GO | 77 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| KAHU ALIMENTACAO E ARTIGOS PARA PETS LTDA | 54.066.051/0001-45 | Aparecida de Goiânia/GO | 85,9 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| INDUSTRIA E COMERCIO DE RAÇÕES HERLAN LTDA | 50.478.250/0001-00 | Caturaí/GO | 91 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| S. R. C. FERREIRA TECNOLOGIA E NUTRICAO ANIMAL LTDA - ME | 10.892.660/0001-88 | São Luís de Montes Belos/GO | 92 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| AGROPECUARIA MONTES BELOS INDUSTRIA COMERCIO LTDA | 32.426.665/0001-58 | São Luís de Montes Belos/GO | 92 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| FIBRA NUTRIÇÃO E SAUDE ANIMAL LTDA | 38.235.145/0001-44 | São Luís de Montes Belos/GO | 92 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| NUTRIBEL NUTRIÇÃO ANIMAL LTDA | 37.826.092/0001-73 | São Luís de Montes Belos/GO | 92 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| FOSBEL PRODUTOS AGROPECUARIOS LTDA - ME | 00.439.444/0001-28 | São Luís de Montes Belos/GO | 92 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RACOES PEROLA EIRELI | 41.809.266/0001-67 | Adelândia/GO | 93,6 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| OX PRODUTS COMERCIO IMPORTACAO E EXPORTACAO DE ALIMENTOS PARA ANIMAIS LTDA | 37.382.523/0001-50 | Goiânia/GO | 95,3 | EPP (pequena) | 4623109 Comércio atacadista de alimentos para animais |
| HAWK NUTRIENTES - FEDERAL AGRARIA ZOOTECNICA LTDA - EPP | 02.447.722/0001-14 | Goiânia/GO | 95,3 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| PBS SEMENTES E NUTRICAO ANIMAL LTDA | 20.815.241/0001-04 | Goiânia/GO | 95,3 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| BONAPETTI INDUSTRIA DE ALIMENTOS LTDA | 17.580.643/0001-54 | Goiânia/GO | 95,3 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| FHOSCRIA - IND. E COM. DE PRODUTOS AGROPECUARIO LTDA - ME | 07.252.524/0001-19 | Goianira/GO | 95,4 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| trevo agro industrial ltda me | 03.872.306/0001-26 | Inhumas/GO | 108,8 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| MASTER AGROINDUSTRIAL LTDA - ME | 13.263.292/0001-05 | Inhumas/GO | 108,8 | ME (micro) | 1013902 Preparação de subprodutos do abate |
| SF BRASIL PROCESSOS INDUSTRIAIS LTDA | 20.507.765/0001-20 | Inhumas/GO | 108,8 | ME (micro) | 8292000 Envasamento e empacotamento sob contrato |
| NUTREMA NUTRICAO ANIMAL LTDA - ME | 11.024.784/0001-04 | Brazabrantes/GO | 108,9 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| L. A. LINHARES - RACOES - ME | 13.196.384/0001-01 | Sanclerlândia/GO | 109,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| SUPRIBEM NUTRICAO ANIMAL LTDA | 13.538.676/0001-85 | Sanclerlândia/GO | 109,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| TABIA INDUSTRIA E COMERCIO DE PRODUTOS AGROPECUARIOS LTDA - ME | 06.031.332/0001-10 | Bom Jesus de Goiás/GO | 112 | ME (micro) | 4692300 Comércio atacadista de mercadorias em geral, com predominância de insumos agropecuários |
| EDCLEIA CARDOSO FLORIANO RACOES AGRO-RACA EIRELI | 04.996.834/0001-50 | Bom Jesus de Goiás/GO | 112 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RACOES AGRO OURO LTDA | 17.777.216/0001-60 | Córrego do Ouro/GO | 112,2 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| CARLOS JOSE SOARES EIRELI | 14.070.442/0001-19 | Córrego do Ouro/GO | 112,2 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| BONTRATO NUTRICAO ANIMAL LTDA - EPP | 13.318.445/0001-66 | Bela Vista de Goiás/GO | 115,1 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| ITALY AGROINDUSTRIALLTDA | 31.538.240/0001-78 | Nova Veneza/GO | 115,8 | ME (micro) | 1013902 Preparação de subprodutos do abate |
| AGRO SIQUEIRA EIRELI - ME | 02.301.246/0001-29 | Caldazinha/GO | 116,9 | ME (micro) | 4771704 Comércio varejista de medicamentos veterinários |
| ROYAL MIX NUTRIÇÃO ANIMAL EIRELI- ME | 19.583.928/0001-74 | Nerópolis/GO | 118,6 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| IRMAOS COELHO DA SILVA LTDA - ME | 01.670.389/0001-45 | Nerópolis/GO | 118,6 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| INDUSTRIA E COMERCIO DE PRODUTOS VETERINARIOS NUTRICRIA LTDA | 37.624.707/0001-89 | Bonfinópolis/GO | 120,9 | ME (micro) | 2122000 Fabricação de medicamentos para uso veterinário |
| PISCICULTURA BOA CRIA LTDA | 02.023.476/0001-73 | Bonfinópolis/GO | 120,9 | ME (micro) | 322101 Criação de peixes em água doce |
| SUPER-BOVI NUTRIÇÃO ANIMAL LTDA | 19.091.828/0001-20 | Goianápolis/GO | 121,5 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| ALIZOO NUTRIÇÃO ANIMAL LTDA | 52.665.827/0001-18 | Goianápolis/GO | 121,5 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| NUTRIR INDUSTRIA E COMERCIO DE RACOES LTDA | 26.899.864/0001-80 | Itaberaí/GO | 123,8 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| NUTRICORTE NUTRICAO ANIMAL LTDA | 54.678.910/0001-57 | Itaberaí/GO | 123,8 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| BOVIDAN NUTRIÇAO ANIMAL LTDA | 06.315.979/0001-73 | Itaberaí/GO | 123,8 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| TRANS SIMÕES LTDA-ME | 21.051.005/0001-13 | Itaberaí/GO | 123,8 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RACOES AGRIVET LTDA | 52.816.488/0001-23 | Buriti de Goiás/GO | 124,2 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| OPTIMUS ANIMAL FEED LTDA | 41.947.343/0001-45 | Rio Verde/GO | 129,2 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| PRESENCE NUTRICAO ANIMAL LTDA | 43.818.636/0001-58 | Rio Verde/GO | 129,2 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| AGROOURO INDÚSTRIA DE ALIMENTOS PARA ANIMAIS LTDA | 26.442.304/0001-00 | Ouro Verde de Goiás/GO | 130,6 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| AGRO-ANJOS FABRICAÇÃO E COMERCIO DE PRODUTOS AGROPECUARIOS LTDA. | 12.268.487/0001-77 | Taquaral de Goiás/GO | 132,9 | ME (micro) | 4771704 Comércio varejista de medicamentos veterinários |
| RACAO DA FAZENDA LTDA | 04.018.126/0001-44 | Cristianópolis/GO | 134 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| COMPETRE INDUSTRIA DE RACOES EIRELI | 33.040.816/0001-06 | Petrolina de Goiás/GO | 138,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| CAMARU - INDUSTRIA E COMERCIO DE RACOES LTDA | 03.888.858/0001-22 | Itumbiara/GO | 142,4 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| KITANO NUTRICAO ANIMAL LTDA | 37.842.795/0001-95 | Itumbiara/GO | 142,4 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| GO PET ALIMENTOS EIRELI - ME | 26.632.670/0001-14 | Itumbiara/GO | 142,4 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| FR NUTRAN ANIMAL LTDA | 08.261.268/0001-99 | Itumbiara/GO | 142,4 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| IVONEI RODRIGUES DE CARVALHO COMÉRCIO DE RAÇÃO LTDA | 19.620.741/0001-01 | Novo Brasil/GO | 145 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| NUTRI CAMPO NUTRIÇÃO ANIMAL LTDA | 29.566.763/0001-86 | Novo Brasil/GO | 145 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| PHOS FORTE INDUSTRIA E COMERCIO LTDA | 17.376.299/0001-86 | Anápolis/GO | 145,4 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| CH NUTRI NUTRIÇÃO E SUPLEMENTAÇÃO ANIMAL LTDA | 53.970.536/0001-04 | Anápolis/GO | 145,4 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| GERMANO SAUDE ANIMAL - EIRELI | 14.588.627/0001-10 | Anápolis/GO | 145,4 | EPP (pequena) | 4692300 Comércio atacadista de mercadorias em geral, com predominância de insumos agropecuários |
| ALVES E CARMO IND. COM. DE PROD AGROPECUARIOS LTDA | 20.013.729/0001-00 | Anápolis/GO | 145,4 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| CB SILVA AGROBOVI EIRELI - ME | 15.728.727/0001-67 | Anápolis/GO | 145,4 | ME (micro) | 2122000 Fabricação de medicamentos para uso veterinário |
| DARIO DIAS DE OLIVEIRA & CIA LTDA - ME | 10.756.171/0001-07 | Fazenda Nova/GO | 149 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| NB INDUSTRIA E COMERCIO DE RACOES LTDA | 51.508.396/0001-13 | Fazenda Nova/GO | 149 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| VALDISON F DOS SANTOS & CIA LTDA | 05.067.086/0001-93 | Fazenda Nova/GO | 149 | ME (micro) | 4789099 Comércio varejista de outros produtos não especificados anteriormente |
| ALEXANDRE THEODORO CABRAL | 15.643.088/0001-37 | Quirinópolis/GO | 151,4 | ME (micro) | 4632001 Comércio atacadista de cereais e leguminosas beneficiados |
| CAMINHO DO CAMPO RACOES LTDA | 23.626.019/0001-43 | Quirinópolis/GO | 151,4 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| SERRA DOURADA NUTRICÃO ANIMAL LTDA | 25.286.776/0001-40 | Goiás/GO | 151,6 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RACOES G M LTDA - EPP | 07.442.937/0001-66 | Caldas Novas/GO | 151,9 | EPP (pequena) | 4623109 Comércio atacadista de alimentos para animais |
| JOVIANO E FERREIRA PRODUTOS AGROPECUARIOS LTDA | 04.982.176/0002-28 | Iporá/GO | 154,8 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| AGRO X NUTRIÇÃO ANIMAL EIRELI | 40.757.837/0001-02 | Itaguaru/GO | 161,5 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| LUIZ FERNANDO AMATO ANGELINI | 20.428.259/0001-45 | Silvânia/GO | 163,3 | ME (micro) | 4623106 Comércio atacadista de sementes, flores, plantas e gramas |
| RAÇOES MARANATA EIRELI | 33.262.088/0001-79 | Vianópolis/GO | 167,6 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| NUTRIMIMO EIRELI - ME | 21.900.008/0001-84 | Pires do Rio/GO | 168 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| AJL-PRODUTOS AGROPECUARIOS LTDA - ME | 07.888.494/0003-01 | Pires do Rio/GO | 168 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| A SERTANEJA NUTRICAO E SAUDE ANIMAL LTDA - EPP | 13.251.600/0001-74 | Pires do Rio/GO | 168 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| IRMÃOS RESENDE GONÇALVES | 03.381.082/0001-50 | Pires do Rio/GO | 168 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RACOES 2M LTDA | 61.402.494/0001-25 | Pires do Rio/GO | 168 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RSM INDUSTRIA E SERVICOS LTDA | 36.760.861/0001-15 | Ipiaçu/MG | 168,3 | EPP (pequena) | 1013902 Preparação de subprodutos do abate |
| AGROCAMPO LTDA | 10.957.552/0001-46 | Abadiânia/GO | 173,8 | EPP (pequena) | 4771704 Comércio varejista de medicamentos veterinários |
| CASA DA ROÇA NUTRIÇÃO ANIMAL LTDA | 27.417.192/0001-92 | Jaraguá/GO | 176,2 | ME (micro) | 4744001 Comércio varejista de ferragens e ferramentas |
| MULTIGRÃOS COMERCIO E SERVIÇO EIRELI | 21.538.907/0001-89 | Jaraguá/GO | 176,2 | ME (micro) | 4789004 Comércio varejista de animais vivos e de artigos e alimentos para animais de estimação |
| IND. E COM. DE RAÇÕES URUANENSE LTDA | 23.111.848/0001-93 | Uruana/GO | 182,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| CAMBUI NUTRIÇÃO ANIMAL LTDA | 52.548.523/0001-70 | Itapuranga/GO | 182,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| GADO GORDO NUTRIÇÃO ANIMAL COMÉRCIO E INDUSTRIA LTDA ME | 05.750.457/0001-37 | Itapuranga/GO | 182,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| ELIOMAR RAMOS DE SOUSA ME | 22.778.941/0001-93 | Itapuranga/GO | 182,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| SUPER MARCOS NUTRICAO ANIMAL LTDA | 20.998.478/0001-60 | Itapuranga/GO | 182,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| TERRA FORTE NUTRIÇÃO ANIMAL LTDA | 52.529.941/0001-10 | Itapuranga/GO | 182,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| M & F ALIANÇA NUTRIÇÃO ANIMAL LTDA | 31.729.667/0001-53 | Itapirapuã/GO | 185,8 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| BRENO BARBOSA VAZ EIRELI | 18.132.817/0001-89 | Itapirapuã/GO | 185,8 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| WCA - NUTRIÇÃO ANIMAL INDUSTRIA E COMÉRCIO LTDA | 53.116.709/0001-13 | Corumbaíba/GO | 187,4 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| R V RACOES LTDA - EPP | 07.611.367/0001-90 | Orizona/GO | 189,5 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| SALTO INDUSTRIAL COMERCIO DE RACOES E GRAOS LTDA | 49.182.853/0001-80 | Orizona/GO | 189,5 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| PIAI VIEIRA IND. E COM. DE PRODUTOS AGROPECUARIOS LTDA - EPP | 02.726.893/0002-63 | Paranaiguara/GO | 193,4 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| NUTRIMAIS SUPLEMENTOS E NUTRICAO ANIMAL LTDA | 41.831.491/0001-08 | Corumbá de Goiás/GO | 195,9 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| NUTRI AGRO INDÚSTRIA E COMERCIO LTDA | 29.969.537/0001-46 | Carmo do Rio Verde/GO | 197,2 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| D P DE LIMA BASTOS NUTRICAO ANIMAL | 45.725.086/0001-58 | Carmo do Rio Verde/GO | 197,2 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| VITABORGES NUTRIÇÃO ANIMAL LTDA | 32.764.801/0001-10 | Alexânia/GO | 199,8 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| UNICRIA RACOES E SUPLEMENTOS ANIMAIS LTDA - EPP | 08.038.927/0001-22 | Alexânia/GO | 199,8 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| AGRO-COSTA INDUSTRIA E COMERCIO DE SUPLEMENTOS ANIMAL LTDA | 32.971.765/0001-65 | São Patrício/GO | 202,8 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RACAO ITUIUTABA INDUSTRIA E COMERCIO LTDA - EPP | 71.054.894/0001-40 | Ituiutaba/MG | 205,9 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| RENOVAR OLEOS VEGETAIS LTDA | 13.397.065/0001-64 | Ipameri/GO | 206,2 | EPP (pequena) | 1041400 Fabricação de óleos vegetais em bruto, exceto óleo de milho |
| AGROLEITE RAÇÕES EIRELI | 23.494.694/0001-66 | Morro Agudo de Goiás/GO | 208,4 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| NUTROFORTE IND. COM. SUPLEMENTOS ANIMAL LTDA - ME | 03.698.298/0001-43 | Rialma/GO | 210,3 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| NUTRIVIDA PRODUTOS PECUARIOS LIMITADA - ME | 02.117.646/0001-89 | Rialma/GO | 210,3 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| QUALITY AGRO NUTRIÇÃO ANIMAL LTDA | 30.809.270/0002-90 | Gurinhatã/MG | 213 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| DIAS RIBEIRO & OLIVEIRA - COMERCIO DE PRODUTOS AGROPECUARIOS LTDA - ME | 07.305.315/0001-96 | Piranhas/GO | 217,1 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| PREMIUM NUTRIÇÃO ANIMAL LTDA | 07.326.375/0001-95 | Piranhas/GO | 217,1 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| A.C COMERCIAL DE PRODUTOS AGROPECUARIOS EIRELI | 04.526.987/0001-33 | Luziânia/GO | 224,4 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| MA NUTRICAO ANIMAL LTDA - ME | 14.595.778/0001-03 | Ipiranga de Goiás/GO | 226,5 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| A FORTALEZA DISTRIBUIDORA DE RAÇÕES E CEREAIS LTDA | 17.854.630/0002-07 | Goianésia/GO | 229 | ME (micro) | 4623109 Comércio atacadista de alimentos para animais |
| OLIVEIRA E OLIVEIRA MOTA LTDA - RAÇÕES FAZENDA | 28.942.551/0001-93 | Goianésia/GO | 229 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| ZOOBENTO COMERCIO VAREJISTA DE MINERAIS E RACOES PARA ANIMAIS LTDA - ME | 10.295.876/0001-66 | Jussara/GO | 229,9 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| CASA AGROPECUARIA CAMPO ALEGRE - RACA NUTRICAO ANIMAL | 40.273.905/0001-50 | Jussara/GO | 229,9 | ME (micro) | 4771704 Comércio varejista de medicamentos veterinários |
| FLEX NUTRICAO ANIMAL LTDA - ME | 10.992.431/0001-35 | Jussara/GO | 229,9 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| FOSTEC NUTRIAO ANIMAL LTDA - ME | 23.810.878/0001-98 | Jussara/GO | 229,9 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| A M DE FREITAS E CIA LTDA | 17.560.898/0001-55 | Jussara/GO | 229,9 | ME (micro) | 4692300 Comércio atacadista de mercadorias em geral, com predominância de insumos agropecuários |
| JOSE DE LIMA ALCANJO LTDA | 57.349.526/0001-07 | Jussara/GO | 229,9 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| PRUDENTE E GOMES LTDA | 13.113.902/0001-86 | Araguapaz/GO | 233 | ME (micro) | 4771704 Comércio varejista de medicamentos veterinários |
| COMERCIAL AGROPECUARIA JGF LTDA | 06.922.510/0001-00 | Águas Lindas de Goiás/GO | 239,7 | EPP (pequena) | 4789004 Comércio varejista de animais vivos e de artigos e alimentos para animais de estimação |
| RACOES CARRIJO LTDA - ME | 10.600.410/0001-27 | Itapaci/GO | 251,7 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| MR RURAL LTDA. | 35.941.556/0002-48 | Campina Verde/MG | 255,6 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| QUALITY AGRO NUTRICAO ANIMAL EIRELI | 30.809.270/0001-09 | Campina Verde/MG | 255,6 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| VULCAN CEREAIS LTDA. | 44.994.342/0001-40 | Catalão/GO | 257,9 | ME (micro) | 4632001 Comércio atacadista de cereais e leguminosas beneficiados |
| INAGRO MACEDO LTDA | 30.887.231/0001-20 | Catalão/GO | 257,9 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| COMERCIO DE RACAO DOIS IRMAOS LTDA - ME | 12.230.578/0001-13 | Ouvidor/GO | 261,8 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| AGROFOS INDUSTRIA E COMERCIO DE RACOES LTDA - ME | 09.405.401/0001-04 | Uberlândia/MG | 268,1 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| RACOES NUTTRIMAIS LTDA | 05.358.513/0002-73 | Uberlândia/MG | 268,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| PMS RAÇOES ERIELI | 33.180.049/0001-22 | Uberlândia/MG | 268,1 | ME (micro) | 4789004 Comércio varejista de animais vivos e de artigos e alimentos para animais de estimação |
| EXTRA FARMA LTDA - ME | 71.288.625/0001-49 | Uberlândia/MG | 268,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RACOES NUTTRIMAIS LTDA | 05.358.513/0001-92 | Uberlândia/MG | 268,1 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| ROGÉRIO COELHO RODRIGUES | 07.907.273/0001-63 | Mozarlândia/GO | 268,7 | EPP (pequena) | 4623109 Comércio atacadista de alimentos para animais |
| IND. COM. REPRES. PRODUTOS AGROPECUÁRIOS BOV LTDA | 25.130.337/0001-44 | Padre Bernardo/GO | 269,6 | ME (micro) | 4692300 Comércio atacadista de mercadorias em geral, com predominância de insumos agropecuários |
| DAIANE CRISTINA FERREIRA - ME | 06.864.543/0002-14 | Doverlândia/GO | 271,8 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| PLEP FABRICAÇÃO E COMERCIALIZAÇÃO DE ALIMENTOS NATURAIS LTDA | 32.417.715/0001-30 | Brasília/DF | 279,2 | ME (micro) | 4789004 Comércio varejista de animais vivos e de artigos e alimentos para animais de estimação |
| SÃO FRANCISCO NUTRIÇÃO LTDA | 33.450.554/0001-40 | Hidrolina/GO | 279,5 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| BOIMAX NUTRIÇÃO ANIMAL LTDA | 24.855.004/0001-10 | Hidrolina/GO | 279,5 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| AGROPECUARIA SUPER NUTRI NUTRICAO ANIMAL LTDA | 37.373.623/0001-10 | Crixás/GO | 283,2 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| RACOES NUTRIMILK LTDA | 04.457.900/0001-13 | Iturama/MG | 284,2 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| DRY MATTER NUTRIÇÃO ANIMAL LTDA | 62.990.555/0001-85 | Iturama/MG | 284,2 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| NUTRIBRAZ NUTRICAO ANIMAL EIRELI | 09.547.545/0001-97 | Carneirinho/MG | 299,3 | ME (micro) | 1066000 Fabricação de alimentos para animais |
| Fortaleza Rações Ltda | 01.002.989/0001-35 | Mineiros/GO | 299,8 | EPP (pequena) | 1066000 Fabricação de alimentos para animais |
| SANTA FE AGROINDUSTRIAL LTDA | 23.163.718/0001-02 | Indiara/GO | 0 | EPP (pequena) | 1013902 Preparação de subprodutos do abate |

## 11. Traders e originadoras (grupo separado)

| Origem | Empresa — unidade | CNPJ | Município | km | Possível correspondência |
|---|---|---|---|---|---|
| MAPA | CEREAL COMÉRCIO EXPORTAÇÃO E REPRESENTAÇÃO AGROPECUÁRIA S/A | 00.012.377/0001-60 | Rio Verde/GO | 129,2 | possível correspondência com T04 Cereal Comércio Exportação — armazéns em GO — a conciliar |
| MAPA | LOUIS DREYFUS COMPANY BRASIL | 47.067.525/0192-08 | Rio Verde/GO | 129,2 | possível correspondência com T02 Louis Dreyfus Company — Rio Verde e Itumbiara — a conciliar |
| pesquisa manual T01 | Cargill Agro — Rio Verde | 53.169.389/0013-01 | Rio Verde/GO | 129,2 | nenhum registro MAPA sugerido |
| pesquisa manual T02 | Louis Dreyfus Company — Rio Verde e Itumbiara | não encontrado | Rio Verde/GO; Itumbiara/GO | 129,2 | possível correspondência com registro MAPA GO0009946 47.067.525/0184-06 (Itumbiara/GO); GO0014893 47.067.525/0192-08 (Rio Verde/GO) — a conciliar |
| pesquisa manual T05 | Gravos Comercialização de Grãos | não encontrado | Rio Verde/GO | 129,2 | nenhum registro MAPA sugerido |
| MAPA | LOUIS DREYFUS COMPANY BRASIL | 47.067.525/0184-06 | Itumbiara/GO | 142,4 | possível correspondência com T02 Louis Dreyfus Company — Rio Verde e Itumbiara — a conciliar |
| MAPA | LOUIS DREYFUS COMPANY BRASIL | 47.067.525/0076-25 | Jataí/GO | 203,6 | — |
| MAPA | ADM DO BRASIL LTDA | 02.003.402/0090-40 | Ipameri/GO | 206,2 | — |
| MAPA | BUNGE ALIMENTOS S/A | 84.046.101/0057-48 | Luziânia/GO | 224,4 | possível correspondência com T03 Bunge — armazéns em GO — a conciliar |
| MAPA | ADM do Brasil Ltda | a conciliar (máscara **.***.402/***-**) | Uberlândia/MG | 268,1 | — |
| MAPA | ADM do Brasil Ltda | a conciliar (máscara **.***.402/***-**) | Uberlândia/MG | 268,1 | — |
| MAPA | BUNGE ALIMENTOS | 84.046.101/0383-28 | Brasília/DF | 279,2 | possível correspondência com T03 Bunge — armazéns em GO — a conciliar |
| pesquisa manual T03 | Bunge — armazéns em GO | não encontrado | localização pendente | — | possível correspondência com registro MAPA DF0004251 84.046.101/0383-28 (Brasília/DF); GO0009164 84.046.101/0057-48 (Luziânia/GO) — a conciliar |
| pesquisa manual T04 | Cereal Comércio Exportação — armazéns em GO | não encontrado | localização pendente | — | possível correspondência com registro MAPA GO0009423 00.012.377/0001-60 (Rio Verde/GO) — a conciliar |

Comigo e Caramuru também originam grãos, mas ficam entre as consumidoras pela fábrica.

## 12. Projetos (consumo futuro, separados da operação atual)

| Candidata | Município | km | Situação | Fonte |
|---|---|---|---|---|
| Inpasa — biorrefinaria (P01) | Rio Verde/GO | 129,2 | Em construção; operação prevista para o 1º tri de 2027 | Inpasa 30/10/2025 |
| Goiás Bioenergia (P02) | Porteirão/GO | 81,9 | Planta de milho anunciada em 2022; operação não confirmada | JornalCana 08/06/2022 |
| Energética Serranópolis (P03) | Serranópolis/GO | 264,3 | Início do milho previsto para 2026 | Jornal Opção 13/06/2026 |
| São Martinho Boa Vista | Quirinópolis/GO | 151,4 | Só a **ampliação** para 2027 é projeto; a operação atual está no lote 1 | Globo Rural 11/08/2025 |

**Fora do raio** (encontradas, não contam):
- Neomille, em Chapadão do Céu: 316,0 km;
- Mantiqueira, em Formosa: 357,7 km.

## 13. Distância a conferir (≥ 270 km, centroide)

Grupo JBJ — confinamento Fazenda Colorado (Aruanã/GO, 284,1 km); BRF/MBRF — Mineiros (fábrica de rações) (Mineiros/GO, 299,8 km); PECUAGRO - NUTRICAO ANIMAL (Doverlândia/GO, 271,8 km); CSG S/A (Brasília/DF, 279,2 km); FVO - BRASILIA INDUSTRIAL (Brasília/DF, 279,2 km); NUTROPLUS (Brasília/DF, 279,2 km); PET S KITCHEN (Brasília/DF, 279,2 km); NUTRINA-VET (Brasília/DF, 279,2 km); CEREALISTA GUARA (Brasília/DF, 279,2 km); UNIÃO QUÍMICA FARMACÊUTICA NACIONAL S.A (Brasília/DF, 279,2 km); SCP CHEF DE PATAS (Brasília/DF, 279,2 km); NUTRINI RAOES E MINERAIS (Brasília/DF, 279,2 km); SEARA (Brasília/DF, 279,2 km); BONASA (Brasília/DF, 279,2 km); BOLT LUCKY LTDA (Brasília/DF, 279,2 km); COOPA DF (Brasília/DF, 279,2 km); RANGAUT (Brasília/DF, 279,2 km); RAINHA ALIMENTOS (Brasília/DF, 279,2 km); ALIPAN NUTRICAO ANIMAL (Brasília/DF, 279,2 km); IDEAL ALIMENTOS (Brasília/DF, 279,2 km); SEARA ALIMENTOS LTDA (Brasília/DF, 279,2 km); HIDROVET NUTRICAO (Hidrolina/GO, 279,5 km); BOIMAX NUTRICAO ANIMAL (Hidrolina/GO, 279,5 km); BOIPORE (Aporé/GO, 281,5 km); AGROPECUARIA SUPER NUTRI NUTRICAO ANIMAL (Crixás/GO, 283,2 km); JBJ NUTRICAO ANIMAL (Aruanã/GO, 284,1 km); JBS — confinamento com fábrica de ração (Fazenda Planura) (Aruanã/GO, 284,1 km); RACOES NUTRIMILK (Iturama/MG, 284,2 km); DRY MATTER NUTRICAO ANIMAL (Iturama/MG, 284,2 km); CASA AGROPECUÁRIA SANTA CRUZ LTDA (Douradoquara/MG, 286,4 km); S.A. USINA CORURIPE AÇÚCAR E ÁLCOOOL (Carneirinho/MG, 299,3 km); NUTRIBRAZ NUTRICAO ANIMAL (Carneirinho/MG, 299,3 km); COOPERATIVA MISTA AGROPECUARIA DO VALE DO ARAGUAIA (Mineiros/GO, 299,8 km); MINERMIX (Mineiros/GO, 299,8 km); PREZOTTO CEREAIS (Mineiros/GO, 299,8 km); RIT CEREAIS (Mineiros/GO, 299,8 km); FORTUNCERES S.A. (Mineiros/GO, 299,8 km); FORTALEZA RACOES (Mineiros/GO, 299,8 km); BRF S.A. (Mineiros/GO, 299,8 km); BRF S.A. (Mineiros/GO, 299,8 km)

## 14. Áreas sem cobertura (declaradas, R11.8)

- **Moinhos de milho para alimentação humana:** fubá, canjica, flocos. A maioria não tem registro SIPEAGRO; o CNAE 1064 (os "146") exige outra fonte.
- **Cervejarias, fábricas de amido e etanol** sem registro de coproduto de ração.
- **Confinamentos e granjas** que fazem ração própria sem registro. Os confinamentos citados sem município (Agropecuária Grande Lago e Fazenda Conforto, Scot Consultoria 16/08/2024) seguem com localização pendente.
- **Grupo econômico:** não pesquisado. A raiz de CNPJ não serve para isso.
- **Média x grande:** indistinguíveis pelo porte cadastral.
- **Sites, canais, decisores e e-mails:** não coletados nesta etapa. Ficam para a validação comercial por lotes, depois do aceite.
- **CNPJ a conciliar:** 56 registros MAPA sem CNPJ conferido.

## 15. Pendências, em ordem

1. **Aceite de Rogério** sobre o lote 1 (seção 6) e o lote ME/EPP (`QUALIFICACAO-LOTES-2026-10-06.md`). Nada é aceito automaticamente.
2. **Conciliação de CNPJ** só das aceitas, com fonte que publique o CNPJ ou cadastro oficial com endereço. Sem fusão por nome.
3. **Validação comercial por lotes:**
   - reaproveitar o cache da BrasilAPI e as evidências já registradas;
   - não pesquisar pessoas nem validar e-mails antes do aceite;
   - Snov só com decisão.
4. **Fontes para as áreas sem cobertura** (seção 14). Nada contratado.
5. **Nenhum contato real antes da T11 validada**, inclusive a retenção, e dos demais bloqueios (`DECISOES-PILOTO-2026-10-01.md`).

## Reprodução

- **Script:** `build.mjs`, com regras fixas e sem LLM. Entradas:
  - CSV do MAPA (04/10/2026);
  - PDF de 21/07/2026, convertido com `pdftotext -layout`;
  - tabela de municípios do Compass;
  - cache da BrasilAPI (361 CNPJs consultados em 06/10/2026, um a cada 2 s, 0 erros).
- **Saída:** `candidatas.csv`, separado por ponto e vírgula, em UTF-8 com BOM.
- **Colunas** do contrato da skill mais as dimensões separadas: origem, papel, atividade, porte, raiz de CNPJ, grupo econômico, situação, evidência, GMO, precisão da distância e possível correspondência.
- Decisor, influenciador e LinkedIn: "não pesquisado nesta etapa".
