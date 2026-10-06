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
| Manuais com o **mesmo CNPJ completo** de um registro MAPA (fundidas) | 4 (SuperFrango ×3, Comigo Rio Verde) |
| Manuais mantidas como linha própria | 32 |
| Linhas em `candidatas.csv` | {{LINHAS}} |
| Manuais com **possível correspondência** a registro MAPA (a conciliar) | 21, ligadas a 26 registros MAPA |
| **Estabelecimentos distintos** | **entre 456 e 477**: o valor exato depende da conciliação desses 21 casos |

**Papéis entre os 445 estabelecimentos MAPA** (o papel é independente do porte):

| Papel | Qtde | Critério |
|---|---|---|
| Consumidora/processadora potencial | {{MAPA_CONS}} | registra ração, concentrado, alimento, ingrediente ou coproduto |
| Trader/originadora (grupo separado) | {{MAPA_TRAD}} | ADM, Bunge, LDC, Cereal Comércio |
| Baixa aderência | 22 | só suplemento mineral, núcleo, premix ou aditivo (pouco ou nenhum milho a granel) |
| Excluída: subproduto de origem animal | 9 | frigoríficos e graxarias sem registro de ração |

**Consumidoras MAPA ({{MAPA_CONS}}), por dimensão.** As dimensões são independentes entre si:
- **UF:** {{UF}}.
- **CNPJ conferido:** {{CONS_CNPJ}}. Os demais estão sem consulta à Receita.
- **Situação na Receita:** {{SIT}}. As 13 não ativas na Receita seguem ativas no MAPA: ficam visíveis, com alerta na coluna "Alerta".
- **Porte cadastral:**
  - {{PORTE}};
  - "Demais" só diz que **não** é ME nem EPP, sem distinguir média de grande;
  - porte só desempata.
- **Matriz/filial:** {{TIPO}}.
- **Raiz de CNPJ:** {{RAIZ}} estabelecimentos dividem a raiz com outra unidade no raio, ou seja, são a mesma pessoa jurídica. Isso **não** é "grupo econômico", campo que fica "não pesquisado" salvo fonte.
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
| **Vínculo confirmado** por CNPJ publicado na fonte da evidência | **1** | Cargill Uberlândia (M08): parecer IGAM/COPAM com CNPJ 60.498.706/0134-88 |
| **Vínculo confirmado** pelo cadastro oficial da própria unidade, com o mesmo CNPJ no MAPA | **4** | SuperFrango NV (M12), Itaberaí (M14, M15) e Comigo Rio Verde (M17). Todos são **indícios**, sem evidência específica de milho |
| CNPJ da unidade pelo cadastro oficial, sem registro MAPA com o mesmo CNPJ | 2 | Premix Anápolis (M19), Cargill Agro Rio Verde (T01, trader) |
| **Vínculo sugerido** (nome e município), a conciliar | **21 candidatas manuais ↔ 26 registros MAPA** | ver colunas "Registro MAPA" e "Possível correspondência" |
| Sem registro MAPA sugerido | 11 | Usina Rio Verde, JBS Aruanã, Fazenda Tropical, Agrocria, Confinamento Pontal, Rialma Agropecuária, Cargill Agro (T01), Gravos e os 3 projetos |

Evidência específica de milho (12):
- 1 tem vínculo confirmado com a unidade (M08);
- 8 descrevem a unidade, mas sem CNPJ na fonte (M01, M03, M05, M06, M07, M09, M10, R02);
- 3 são do nível da empresa (M02 Rei do Milho, M04 Usina Rio Verde, R01 Milhão).

Os 26 registros MAPA sugeridos continuam como linhas próprias, com "possível correspondência".

## 6. Primeiro lote para o aceite de Rogério: evidência específica de milho

Critérios:
- a fonte cita milho consumido ou processado;
- consumidora ou processadora;
- sem restrição não-GMO registrada.

A coluna "Registro MAPA" mostra só a **sugestão**: aceitar a candidata não concilia o CNPJ.

{{LOTE1}}

**Antes do cadastro de cada aceita:**
- confirmar o CNPJ da unidade (fonte com CNPJ, ou cadastro oficial com endereço);
- conferir a distância das linhas 8 a 10 (≥ 268 km);
- para JBS, conferir se a fonte de 2014 ainda vale e se é a mesma área da JBJ.

## 7. Processam milho com restrição não-GMO registrada (por linha ou unidade)

Uma linha não-GMO **não** prova que todas as operações da empresa recusem milho GMO. A restrição vale só para a linha ou unidade citada.

{{A3}}

A Caramuru (lote 1, linha 5) declara linha de produtos não transgênicos. A restrição fica nessa linha, não na fábrica inteira.

## 8. Demais candidatas da pesquisa manual (indício por atividade)

{{INDICIOS_MANUAIS}}

## 9. Segundo lote sugerido: indício forte no cadastro, sem evidência específica

Usinas registradas no MAPA como produtoras de ingrediente (possível DDG de milho, ainda não comprovado) e empresas com milho no nome. A evidência de milho fica pendente.

{{INDICIO_FORTE}}

## 10. Pequenas empresas (ME/EPP pelo porte cadastral)

São {{PME_N}} consumidoras potenciais com porte ME ou EPP na Receita:
- 140 estão ativas na Receita;
- 115 têm CNAE principal 1066-0 (alimentos para animais).

É a lacuna das pequenas que a rodada 1 não cobria. Médias **não** podem ser separadas das grandes: a Receita só informa "Demais". Nenhuma tem evidência específica de milho ainda.

{{PME}}

## 11. Traders e originadoras (grupo separado)

{{TRADERS}}

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

{{LIMITE}}

## 14. Áreas sem cobertura (declaradas, R11.8)

- **Moinhos de milho para alimentação humana:** fubá, canjica, flocos. A maioria não tem registro SIPEAGRO; o CNAE 1064 (os "146") exige outra fonte.
- **Cervejarias, fábricas de amido e etanol** sem registro de coproduto de ração.
- **Confinamentos e granjas** que fazem ração própria sem registro. Os confinamentos citados sem município (Agropecuária Grande Lago e Fazenda Conforto, Scot Consultoria 16/08/2024) seguem com localização pendente.
- **Grupo econômico:** não pesquisado. A raiz de CNPJ não serve para isso.
- **Média x grande:** indistinguíveis pelo porte cadastral.
- **Sites, canais, decisores e e-mails:** não coletados nesta etapa. Ficam para a validação comercial por lotes, depois do aceite.
- **CNPJ a conciliar:** 56 registros MAPA sem CNPJ conferido.

## 15. Pendências, em ordem

1. **Aceite de Rogério** sobre o lote 1 (seção 6) e, se quiser, sobre o segundo lote (seção 9).
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
