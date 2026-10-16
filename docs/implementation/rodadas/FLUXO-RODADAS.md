# Fluxo geral de rodadas de descoberta e qualificação

Situação em 15/10/2026: implementado e testado localmente, **sem publicação**.

Restrições respeitadas nesta etapa:

- A migração `0044_rodadas.sql` foi aplicada só nos testes locais; não foi aplicada em produção.
- Nenhum registro real do piloto foi alterado.
- Nenhum serviço pago foi usado.
- Nenhum contato foi liberado.

Milho GMO, Indiara/GO e 300 km são só uma configuração (`exemplos/milho-gmo-indiara-300km.json`). O código não contém cidade, empresa, commodity ou distância do piloto, e um teste confere isso em todos os módulos da rodada.

## Matriz de situação

### Funcionalidade operacional

Implementado e coberto por teste.

| Item | Onde | Teste |
|---|---|---|
| Configuração da rodada:<br>commodity, variedade, perfil, origem, raio em km ou mi, critério perto do limite, fontes, evidência, idioma, fuso e compliance | `src/rodada/config.js`; painel → Rodadas → Nova rodada / Editar configuração (com revisão e conflito de edição) | `rodada-fluxo`, `rodadas-worker` |
| Origem em qualquer município brasileiro (nome + UF ou código IBGE), sem CSV montado à mão | `src/rodada/area.js` + tabela `municipalities` (IBGE, migração 0008); na linha de comando, o mesmo conjunto lido da migração | `rodada-fontes` (Boa Vista/RR em milhas; o CSV antigo do piloto está contido na área calculada) |
| Área calculada:<br>municípios inteiros e parciais, distância do centroide marcada como estimativa e alcance mínimo e máximo | `roundArea`; painel → Área da rodada | `rodada-fontes`, `rodadas-worker` |
| Critério de proximidade do limite explícito (proporcional ou margem fixa), que gera **conferência**, não exclusão | `config.nearLimit.criterion`; resultado ganha `checks` e entra em "Exceções e conferências", mas continua elegível ao cadastro em descoberta | `rodada-fluxo` (Doverlândia, 271,8 km), `rodadas-worker` (unidade na faixa é cadastrada) |
| Distinção entre centroide municipal e localização da unidade | `distance.js`: centroide = ESTIMADA; só a coordenada da unidade ou o contorno do município afirmam dentro/fora | `rodada-fluxo` |
| Limitações mostradas **antes** da execução, com ciência registrada por revisão da configuração | `sources/catalog.js` (`preflight`); a rota `/run` recusa sem ciência; mudar a configuração anula a ciência | `rodada-fontes`, `rodadas-worker`, `ui-rodadas` |
| Três modos de entrada, identificados em cada candidata e no resultado | automática (OSM, Receita), importação (SIPEAGRO, CSV/JSON), assistida (registro manual com URL obrigatória) | `rodada-fontes`, `rodadas-worker`, `ui-rodadas` |
| Conciliação:<br>candidata provisória (sem CNPJ) junta na unidade identificada com mesmo nome e município. A máscara de CNPJ do SIPEAGRO precisa bater. Com duas opções, fica provisória e mostra as opções | `establishment.js` (`conciliateProvisional`) | `rodada-fontes`, `rodadas-worker` |
| Consulta cadastral com limite de taxa entre execuções:<br>o que passar do limite fica **adiado**, não falha. Erro 500 vira pendência; 429 bloqueia a fonte naquela execução | `rounds.js` (`round_source_calls`), `batch.js` | `rodadas-worker`, `rodada-fontes`, `rodada-fluxo` |
| Reexecução sem duplicidade:<br>estado por estabelecimento, reimportação ignorada por hash, contadores novos / alterados / sem mudança | `round_establishments`, `round_candidates` (único por hash) | `rodadas-worker`, `rodada-fluxo` |
| Revisão só de exceções e conferências | painel → Resultados → filtro | `rodadas-worker`, `ui-rodadas` |
| Decisão em lote (aceitar, incluir exceção, adiar, recusar):<br>responsável, data, observação e foto do resultado avaliado; histórico preservado; recusas explicadas por item | `round_decisions`; painel → seleção + "Registrar decisão em lote" | `rodadas-worker`, `ui-rodadas` |
| Cadastro no Compass pelas rotas existentes, com as mesmas regras do cadastro manual:<br>modo descoberta (sem aprovação individual) ou só as aceitas; idempotente; em partes de 25; ligado à decisão | `registerFromRound` + `round_registrations` | `rodadas-worker`, `ui-rodadas` |
| Cadastro em descoberta **antes** da triagem de sanções, com os avanços sujeitos à triagem bloqueados | qualificar a empresa cadastrada sem triagem → 409 `sanctions`. Triagem opcional logo após o cadastro (rotina interna, sem custo) | `rodadas-worker` |
| Exportação:<br>configuração, limitações, resultados, histórico de decisões, cadastros e relatório em markdown | painel → Exportar; `GET /api/rounds/:id/export` | `rodadas-worker` |
| Adaptação explícita de formatos antigos, sem reescrever o original | `src/rodada/legacy.js`; `rodada.mjs adaptar-candidatas` / `adaptar-lote` (recusa gravar sobre o original ou trocar o produto em silêncio; retira a ligação de nível 0 e registra isso) | `rodada-fontes` |

### Suporte parcial

Funciona, com limite conhecido e exibido.

| Item | Limite |
|---|---|
| OpenStreetMap (descoberta automática) | Cobertura irregular. Quase nunca traz CNPJ, então as candidatas ficam provisórias até a conciliação. É indício, não prova. No painel a consulta sai do navegador, porque o servidor público recusa a Cloudflare. |
| MAPA SIPEAGRO (importação) | CNPJ mascarado no arquivo público. O arquivo é baixado pela pessoa; o painel filtra pela área e envia em partes. O registro indica a atividade, não prova uso nem compra. |
| Receita (publica.cnpj.ws) | Só consulta CNPJ já conhecido (não busca por nome). 3 consultas por minuto, ou cerca de 180 por hora: rodadas grandes precisam de várias execuções. Não há fila automática. |
| Segmentos sem regra de descoberta (no piloto: cooperativa, confinamento, integração, etanol no SIPEAGRO) | Ficam só com importação e pesquisa assistida, e isso aparece antes da execução. |
| Prova de uso e de compra de terceiros | Sempre por pesquisa assistida (fonte própria ou registro oficial). Nada é automatizado e nenhum LLM é usado. |
| Países fora do Brasil | Sem conjunto de municípios: a distância sai só pela coordenada da unidade. Sem fonte cadastral nem regra de identificador. O painel mostra "Sem suporte" e exige ciência. |
| Formatos antigos | As provas do arquivo antigo entram como indício até serem reconfirmadas, porque o arquivo não guarda a força de cada prova. |

### Dependência externa

Fora do alcance do código local.

| Item | O que falta |
|---|---|
| Uso em produção | Aplicar a migração 0044 e publicar o Worker e o painel. Ambos exigem autorização explícita. |
| Overpass, publica.cnpj.ws e dados.agricultura.gov.br | Disponibilidade e termos dos serviços públicos (nenhum foi chamado de verdade nesta etapa; os testes usam respostas simuladas). |
| Casa dos Dados | Serviço pago: fica bloqueado até haver autorização de despesa. |
| Registros e conjuntos de municípios de outros países | Fonte, termos e regra de identificador por país (ex.: Handelsregister/Impressum na Alemanha, já mapeados em `FONTES-EMPRESAS-EXTERIOR.md`). |
| Listas de sanções | Validade das listas de 24/09/2026, até cerca de 24/10/2026. |
| Portões existentes | Sem mudança: aprovação de ficha, autorização de despesa, validação T11, liberação de envio, L1/L4 pendentes, canais `planned`, campanhas inativas e cópia desligada. |

## Como usar

### Painel (Rodadas)

1. **Nova rodada.** Preencha nome, commodity, origem (município + UF, ou código IBGE; fora do Brasil, a coordenada), raio e unidade, critério perto do limite, idioma, fuso e compliance. Em "Avançado", configure segmentos com regras de descoberta e fontes.
2. **Antes de executar.** Confira o que é suportado, parcial ou sem suporte e registre ciência.
3. **Área da rodada.** Confira os municípios inteiros e parciais e os que pedem conferência.
4. **Candidatas.** Use "Descoberta automática: OpenStreetMap", "Importar" (SIPEAGRO, CSV ou JSON) ou "Pesquisa assistida".
5. **Executar rodada.** Repita para continuar as consultas adiadas; a repetição não duplica nada.
6. **Resultados.** Filtre por "Exceções e conferências", selecione e registre a decisão em lote.
7. **Cadastrar no Compass.** Escolha o produto do catálogo e o modo. Opcionalmente, rode a triagem logo após. Nenhum contato, ficha ou envio é criado.
8. **Exportar.** Baixe o JSON ou o relatório em markdown.

### Linha de comando

```sh
node scripts/rodada.mjs validar <config.json>          # validação + limitações
node scripts/rodada.mjs area <config.json>             # área pelo IBGE (sem CSV)
node scripts/rodada.mjs executar <config.json> [candidatas.json] [--importar x.csv] [--sipeagro arquivo.csv] [--osm] [--rede] \
     --estado estado.json --saida pasta
node scripts/rodada.mjs lote pasta/resultado-<id>.json --modo discovery --produto "<variante>"
node scripts/rodada.mjs adaptar-candidatas docs/.../candidatas.csv --saida nova.json
node scripts/rodada.mjs adaptar-lote docs/.../cadastro-lote-aceito.json --produto "Milho GMO" --saida novo.json
```

## Configuração

O bloco `commodity.segments.<segmento>.discovery` define o que cada fonte procura:

- `osm`: lista de `[chave, valor]` ou `[chave, "~regex"]`;
- `sipeagro`: `{ activity: [...], classification: [...] }`.

Fontes do catálogo:

| Fonte | Papel | Modo |
|---|---|---|
| `br-cnpj-ws` | cadastro | automática |
| `osm-overpass` | descoberta | automática |
| `mapa-sipeagro` | descoberta | importação |
| `casadosdados` | descoberta | paga, bloqueada |
| `import-file` | descoberta | importação |
| `assisted` | descoberta | pesquisa assistida |

Uma fonte fora do catálogo aparece como "sem suporte".

Exemplos validados:

| Arquivo | Commodity | Origem | Raio |
|---|---|---|---|
| `exemplos/milho-gmo-indiara-300km.json` | milho GMO | Indiara/GO | 300 km |
| `exemplos/soja-rio-verde-150km.json` | soja | Rio Verde/GO | 150 km (margem fixa) |
| `exemplos/sorgo-uberlandia-300mi.json` | sorgo | Uberlândia/MG | 300 mi |
| `exemplos/cafe-verde-hamburgo-200km.json` | café verde | Hamburgo, DE (coordenada) | 200 km |

## Banco (migração 0044, só local)

| Tabela | Conteúdo |
|---|---|
| `discovery_rounds` | Configuração, revisão, limitações, ciência e última execução |
| `round_candidates` | Candidata, modo de entrada, fonte e hash (único por rodada) |
| `round_establishments` | Estado e resultado por estabelecimento; marca de revisão |
| `round_decisions` | Histórico de decisões com foto do resultado; a decisão nova substitui sem apagar |
| `round_registrations` | Cadastro feito, empresa, modo, decisão que autorizou e rastreio |
| `round_source_calls` | Chamadas às fontes externas (limite de taxa e auditoria) |

## Testes

- `tests/rodada-fluxo.test.mjs`: 12 testes.
- `tests/rodada-fontes.test.mjs`: 8 testes.
- `tests/rodadas-worker.test.mjs`: 2 testes, com o fluxo completo pelo Worker e banco em memória com todas as migrações.

O teste pelo Worker usa uma configuração fora do piloto: soja, Rio Verde, 150 km. Ele percorre:

- os três modos de entrada;
- a conciliação SIPEAGRO × CSV;
- erro 500, unidade suspensa e consultas adiadas pelo limite;
- três execuções e uma reimportação sem duplicidade;
- decisões com histórico;
- cadastro em descoberta em duas partes, com **3 empresas criadas**;
- o bloqueio por triagem de sanções;
- exportação, conflito de edição e a garantia de que os arquivos reais do piloto ficam intactos (o teste compara o SHA-256 antes e depois).

Há também um teste de tela opcional, fora do `npm run check`: `node tests/ui-rodadas.mjs [captura.png]`. Ele roda no Chrome headless, com o Worker local e a Receita simulada, e cobre:

- criar a rodada, ver a área e as limitações, ser recusado sem ciência e registrar a ciência;
- importar arquivo e registrar uma candidata por pesquisa assistida;
- executar, decidir em lote e cadastrar;
- largura de celular sem rolagem horizontal e ausência de erro de JavaScript.

## Fechamento da pesquisa (16/10/2026; no repositório, ainda não publicado)

Para cada estabelecimento, `src/rodada/closure.js` monta o fechamento a partir das evidências, do cadastro oficial e da distância. As regras são gerais, sem nada por empresa:

- **Verificado:** só o que tem prova aceita pela configuração, e a consulta cadastral feita.
- **Conflitos de fonte:**
  - evidência marcada como conflitante na pesquisa assistida (`evidence.conflict`);
  - evidência do cadastro do Compass com validação `conflicting`;
  - papel divergente entre a atividade principal do cadastro oficial e o registro de fabricante. Por enquanto essa regra existe só para a CNAE do Brasil; em outros países nenhum conflito é inventado.
- **Desconhecido:** cada campo aparece **uma vez**, com o nível atual (indício ou sem evidência). Os campos são operação, uso da commodity, compra de terceiros, aceitação da variedade, papel, responsável e canal de compras, porte e localização da unidade. Perto do limite, a localização leva a marca "conferência do limite pendente".
- **Contato futuro:**
  - com a pesquisa pública aberta, só o que fonte pública normalmente não responde: compra de terceiros, aceitação da variedade, responsável e canal de compras;
  - encerrada a fase (`research.publicPhase: "closed"`, escolhida no formulário da rodada), todos os desconhecidos.
  - Nenhum pedido de confirmação campo a campo.
- **Triagens de sanções** das empresas cadastradas pela rodada: situação, ocorrências, número de listas e **validade** pela regra do Compass. A validade é o download mais antigo das listas usadas mais `sanctions_max_age_hours`.

Onde o fechamento aparece:

- **Painel:** em cada resultado da rodada ("Fechamento da pesquisa" e linha da triagem com validade).
- **Exportação e relatório:** seções "Verificações concluídas", "Conflitos de fonte", "Dados desconhecidos", "Pendências para contato futuro" e "Triagens de sanções".
- **Comandos novos:**
  - `scripts/qualificar-lote.mjs`: qualificação assistida de empresas já cadastradas, pelas rotas existentes, sem duplicar;
  - `node scripts/rodada.mjs consolidar <id> --d1 <banco> --remote [--encerrar] --saida <pasta>`: fechamento de uma rodada já executada, só lendo o banco, sem consultar fontes.

### Situação atual (publicado em 16/10/2026, Worker `aefbf8b7`)

| Funciona pelo painel em produção | Exige pesquisa assistida ou fonte externa |
|---|---|
| Criar e configurar a rodada, área IBGE, limitações e ciência | Prova de uso e de compra de terceiros (fonte própria, documento oficial ou contato) |
| Importação (SIPEAGRO, CSV/JSON) e pesquisa assistida | Papel comercial (consome, revende, armazena, origina), responsável e canal de compras |
| Consulta à Receita com limite entre execuções; contagem de adiadas por limite interno ou HTTP 429 | Localização exata da unidade sem coordenada (ex.: ruas fora do OSM) |
| Conciliação, reexecução sem duplicar, revisão, decisão em lote com histórico | Porte quando a Receita não informa |
| Cadastro em descoberta com triagem; aceitar, incluir ou cadastrar exige consulta cadastral concluída | OpenStreetMap: falhou (502) na rodada real; disponibilidade não comprovada |
| Fechamento por estabelecimento (verificado, conflitos, desconhecidos, contato futuro); triagens com validade; campo "Pesquisa pública" | **Países fora do Brasil:** sem conjunto de municípios, fonte cadastral nem regra de identificador integrados. **Não há suporte completo.** A tela mostra "Sem suporte" e exige ciência, e a ciência **não dispensa** fonte, identificador nem verificação: sem consulta cadastral, nada é aceito nem cadastrado pela rodada |
| Exportação e relatório com as seções do fechamento | — |

Regras de leitura do fechamento:

- Atividades diferentes no cadastro oficial e no registro de atividade (ex.: armazenagem na CNAE e fabricante no MAPA) **não são conflito**: aparecem como "papel comercial a confirmar".
- A atividade industrial registrada conta como verificada; o papel comercial é outra pergunta.
- Encerrar a pesquisa pública não conclui a qualificação comercial nem muda a etapa da empresa.
