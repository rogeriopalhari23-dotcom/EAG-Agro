# Política de pesquisa consolidada (2026-10-20)

Uma política para Radar Nacional, Radar Internacional, Prospecção e Rodadas. O código executável está em `src/prospect/defaults.js` (perfil comprador `DEFAULT_PROFILE`, modelo da política `POLICY_TEMPLATE`, autorização `AMENDMENT`), `src/sources-applicable.js` (fontes por contexto), `src/classification.js` (classificação fiscal), `src/prospect/rotation.js` (pesquisa automática) e `src/relations.js` (empresa em várias commodities).

## Fontes consolidadas

| Fonte | O que entra na política |
| --- | --- |
| Instrução escrita de Rogério Palhari, 2026-10-20 (esta sessão) | Autorização delimitada para automatizar seleção de commodity, mercado, segmentos e fontes e o encaminhamento de candidatas para descoberta. Não pedir de novo a mesma decisão por pesquisa. Custos novos, ampliação de escopo e ambiguidade comercial real continuam pedindo decisão específica. Perfil: médias, depois pequenas, depois grandes com canal claro; consumidores finais, indústrias e processadores separados de traders e distribuidores. |
| Spec (`docs/eag-compass-spec.md`) | R12.7 (revisada em 2026-10-20), R12.6/R12.6.1 (estados do dado de mercado), R12.10 (dado do país não prova empresa), R12.14 (busca só com compra identificada), R12.15 (atualização de país fora do ciclo), R14 (perfil e ICP), R19 a R22 (envio, supressão, pausas). |
| Constituição (`docs/eag-compass-constituicao.md`) | P1 (evidência real), P2 (rastreabilidade), P8 (qualificação humana), P11 (nenhum contato sem aprovação individual), P12 (interrupção prevalece), P13 (sem duplicidade), P15, P16 (compradores, ICP), P17 (método da `/prospeccao-vendas`), P18 (cobertura e incerteza visíveis). |
| Skill `/prospeccao-vendas` | Buscar pelo **uso final** da commodity (indústrias usuárias), não pelo produto. Médias e média-mais são o centro do ICP; gigante briga por preço, MEI não tem volume. Decisor: comprador e gestor de compras. |
| Decisões e registros (`docs/implementation/DECISOES-PILOTO-2026-10-01.md`, `EVIDENCIAS.md`, `sequence.json`) | Piloto nacional por e-mail; T11 por escopo; nenhuma ficha, campanha ativa ou envio pela pesquisa. |

## O que o Compass decide sozinho (sob a política vigente)

1. **Commodity e mercado na pesquisa automática.**
   - Nacional: commodity com segmento de busca automática, a partir de uma origem já configurada para ela (campanha nacional, rodada ou prospecção anterior), com o raio padrão configurado e dentro do limite da política.
   - Internacional: produto com classificação confirmada × país com comércio oficial registrado com o Brasil (exportações do Brasil, MDIC; ou importações de origem Brasil declaradas pelo país, Comtrade) em **qualquer** subposição do produto, não só nas cinco maiores do país (`trade_country_summary.hs6_json`, refeito do objeto oficial guardado, sem custo), e com fonte de empresas coberta.
   - Lista de países do formulário (Radar Internacional e Prospecção), criação da pesquisa e pesquisa automática usam a mesma regra (`src/destinations.js`): só destinos com evidência do PRÓPRIO produto (soja em grão não comprova farelo nem óleo; importação do mundo não comprova compra do Brasil); período padrão e, sem registro nele, o período guardado mais longo das exportações do Brasil (identificado).
   - Mercado com evidência e sem conector de empresas: limitação de cobertura listada a cada pesquisa automática e na própria prospecção; nunca esquecido nem tratado como ausência de compradores.
   - Prioridade: nunca pesquisada; depois pesquisa com 30 dias ou mais (dados a atualizar); depois a menos pesquisada.
   - A justificativa da escolha fica na prospecção.
2. **Segmentos e fontes.** Os segmentos vêm do perfil (uso final, conforme a skill) e as fontes da regra única de aplicabilidade. Fonte incompatível não aparece nem é consultada.
3. **Seleção R12.7 e autorização da busca no exterior**, só para commodity com evidência de mercado (R12.14). A campanha criada fica em rascunho.
4. **Encaminhamento de candidatas para descoberta:** candidata com identificador cadastral ou site publicado. Nome parecido com empresa existente vai para a fila de exceções; nada é fundido sozinho (P13).
5. **Ciência das limitações já aceitas** pela política. Limitação nova ou mais grave pede decisão.
6. **Classificação fiscal** por regra fundamentada em fonte oficial (`CLASSIFICACAO-PRODUTOS.md`). Quando falta uma característica que muda o código, o Compass pergunta só essa característica.
7. **Indicadores do país** (lista mensal) pedidos pelo fluxo existente, sob política concedida por Administrador (R12.15).
8. **Reaproveitamento de empresa já cadastrada** em nova commodity: a relação nova é acrescentada sem duplicar nem substituir as anteriores. Antes de buscar empresas novas, a prospecção (e a tela da rodada, só leitura) considera as já cadastradas com atividade compatível (CNAE conferida no IBGE, atividade publicada ou relação com commodity de uso em ração), no raio ou no país. A relação entra **não confirmada** (trader separado). Confirmação de compra e decisor de outra commodity não são copiados; o decisor é registrado por produto (`contact_products`). Pausas, supressões e exclusões mantêm o próprio alcance.

Tudo isso fica registrado como **automação sob a política** (canal `automation`, executor "Compass — prospecção automática", a política como autorização). Nada é atribuído a um clique ou confirmação de pessoa.

## Perfil comprador (prioridade de pesquisa e descoberta)

- **Porte:** médias, depois pequenas, depois grandes com canal claro; micro e porte desconhecido por último. A ordem prioriza a pesquisa. O critério de ICP das fichas (P16, R14.6–R14.7) continua o mesmo.
- **Papel:** consumidores finais, indústrias (fabricantes) e processadores vêm antes; traders, distribuidores e revendedores ficam separados e nunca misturados com eles.
- **Evidência:** só fonte própria da empresa ou registro oficial confirma; o resto é indício. Dado de país não prova empresa (R12.10). Dado agregado não comprova aceitação de GMO nem identifica comprador.

## O que continua pedindo decisão específica

- custo novo (fonte paga, créditos);
- ampliação de escopo (raio acima do limite, mercado fora da política, limitação nova ou mais grave);
- ambiguidade comercial real;
- característica de produto que muda a classificação e não está registrada;
- produto sem regra de classificação fundamentada (Administrador).

## O que esta política não toca

- T11 e validações por escopo;
- revisão e aprovação comercial, fichas;
- triagem de sanções (continua obrigatória e válida, R19.3);
- canais, campanhas ativas, envios, supressões, pausas e exclusões;
- o plano de consultas fora da Cloudflare (ponte), que **não foi aprovado**.

## Concessão

A política é concedida uma vez, em Configurações → Prospecção automática, por Administrador ou gestor. O pedido de indicadores só entra quando quem concede é Administrador (R12.15). Depois disso, nenhuma pesquisa pede a mesma decisão de novo. A revogação para as pesquisas antes de qualquer nova consulta.
