# Fluxo geral de rodadas de descoberta e qualificação

Data: 15/10/2026. Situação: implementado e testado localmente. Nada foi publicado. Nenhuma migração foi aplicada. Nenhum registro real foi alterado.

## Objetivo

O processo de descoberta e qualificação do piloto passa a ser um fluxo único do Compass.

Milho GMO, Indiara/GO e 300 km agora são só uma configuração (`exemplos/milho-gmo-indiara-300km.json`). O código em `src/rodada/` não contém cidade, empresa, commodity ou distância do piloto. Um teste garante isso: ele procura esses valores no código-fonte e falha se encontrar algum.

O fluxo:

- não faz contato;
- não consome crédito;
- não usa LLM para score, deduplicação, distância ou parse;
- não cadastra nada sozinho.

O cadastro continua sendo um passo separado, feito por `scripts/cadastrar-lote-aceito.mjs`. Ele roda em simulação por padrão e usa as rotas da API com as regras existentes.

## Auditoria do que já era parametrizado

| Parte | Situação antes | Agora |
|---|---|---|
| Radar do Worker (`src/search.js`, `src/geo.js`, mapa de descoberta, raio nas operações) | Já recebia origem e raio como parâmetro | Sem mudança |
| Scripts de descoberta do piloto (`docs/.../descoberta-milho-indiara/scripts/`) | Corte fixo em 270 km, nomes de milho e candidatas no código | Mantidos como registro histórico; o fluxo novo os substitui |
| `scripts/cadastrar-lote-aceito.mjs` | Produto padrão "Milho GMO" | Sem padrão: o lote precisa declarar `produto`. Opção `--triagem` adicionada. Aceita lotes com `rastreio` |
| Regra "perto do limite" | 270 km fixo | Deriva do raio configurado: fração (`fraction`) ou margem em km/mi (`distance`) |

## Configuração da rodada

Um arquivo JSON por rodada. Validação: `node scripts/rodada.mjs validar <config>`. A validação lista todos os erros de uma vez.

| Bloco | Campos | Observação |
|---|---|---|
| `commodity` | `code`, `label`, `variety`, `spec`, `nameHints`, `restrictionHints`, `segments` | Restrição conflitante com a variedade vira exceção. Segmento sem regra vira pendência explícita. |
| `buyer` | `roles`, `uses` | Perfil do comprador e uso |
| `origin` | `country` (ISO2) + `lat`/`lon` **ou** `municipality`/`municipalityCode`/`region` | Município resolvido pelo conjunto de municípios da rodada |
| `radius` | `value`, `unit` (`km`/`mi`), `method` (`haversine`) | Milhas convertidas para km internamente |
| `nearLimit` | `fraction` (0–1) ou `distance` | Padrão: 10% do raio |
| `priorities` | `size`, `segments` | Só ordenam o relatório; não excluem ninguém |
| `sources` | `id`, `kind` (`registry`…), `countries`, `rateLimitPerMinute`, `maxAgeDays` | País sem fonte cadastral → pendência explícita |
| `evidence.confirming` | Padrão: `own_source`, `official_record` | Só essas forças comprovam. As demais são indício. |
| `locale` | `language`, `timezone` | |
| `compliance` | `scope`, `sanctionsMaxAgeHours` (padrão 720) | O escopo é só registrado; as regras de envio continuam no Compass |
| `countryRules` | opcional | Se existir e o país da unidade não estiver nela, vira pendência |

### Exemplos (todos validados)

| Arquivo | Commodity | Origem | Raio | Perto do limite a partir de |
|---|---|---|---|---|
| `exemplos/milho-gmo-indiara-300km.json` | milho GMO | Indiara/GO | 300 km | 270,0 km (fração 0,1) |
| `exemplos/soja-rio-verde-150km.json` | soja | Rio Verde/GO | 150 km | 135,0 km (margem de 15 km) |
| `exemplos/sorgo-uberlandia-300mi.json` | sorgo | Uberlândia/MG | 300 mi (482,8 km) | 458,7 km (fração 0,05) |
| `exemplos/cafe-verde-hamburgo-200km.json` | café verde (HS 090111) | Hamburgo, DE (coordenada) | 200 km | 180,0 km; sem fonte cadastral, idioma `en` |

Os três primeiros são exemplos de configuração. O quarto é só uma ilustração: ainda não há fonte cadastral nem conjunto de municípios da Alemanha.

## Fluxo comum

1. **Entrada.** Candidatas de qualquer fonte, em JSON. Campos: `country`, `registrationId`, `name`, `municipality`, `region`, `unit`, `sources`, `evidence`, `hints`. Novas candidatas entram como descoberta, sem aprovação individual.
2. **Estabelecimento.** A chave é a unidade, não a empresa.
   - Com identificador completo (no Brasil, o CNPJ de 14 dígitos): chave = país + identificador. CNPJ com ou sem pontuação gera a mesma chave.
   - Sem identificador: chave **provisória** (nome + município + UF). Nunca é tratada como unidade confirmada.
   - Unidades com a mesma raiz de CNPJ ficam separadas e ligadas como `siblings`.
3. **Conciliação.**
   - Consulta cadastral pela fonte configurada para o país, com limite de taxa. A consulta anterior é reaproveitada dentro de `maxAgeDays`.
   - Erro de consulta vira pendência. HTTP 429 bloqueia aquela fonte pelo resto da execução.
   - Situação cadastral não ativa e município divergente viram exceção.
4. **Distância.**
   - A distância sai sempre com a base declarada.
   - Pelo centroide do município, aparece como **ESTIMADA**.
   - Só a coordenada da unidade (ou o contorno do município) afirma se está dentro ou fora.
5. **Qualificação** (`assess`). Separa:
   - operação comprovada;
   - uso/processamento da commodity;
   - compra de terceiros;
   - revenda/trading;
   - restrição.

   Regras:

   - Código de atividade e situação ativa são **indício**, nunca prova de uso.
   - A aceitação da variedade fica sempre "não confirmada".
   - Só entram canais publicados com fonte.
6. **Classificação.** Cada estabelecimento recebe uma situação:
   - `qualified_purchase`: uso e compra de terceiros comprovados;
   - `qualified_use`: uso comprovado;
   - `discovery`: evidência insuficiente;
   - `exception`: precisa de análise;
   - `separated`: revendedora ou trader;
   - `outside`: fora do raio.

   Só as exceções pedem atenção humana. São elas:

   - conflito de restrição;
   - cadastro não ativo;
   - dados divergentes;
   - unidade sem identificador;
   - perto do limite;
   - consulta cadastral pendente.
7. **Relatório** (`relatorio-<id>.md`).
   - Resumo por situação.
   - Seção "Exceções para análise".
   - Tabela por estabelecimento: distância rotulada, situação de cada prova ("comprovado" ou "indício") e pendências.
8. **Reexecução.** Um arquivo de estado (`--estado`) guarda as entradas e a última consulta. Rodar de novo não duplica nada. Os contadores mostram novos, alterados e sem mudança.
9. **Lote para cadastro** (`lote`).
   - Modo `discovery`: inclui quem não é exceção, sem decisão individual. Exceções entram só com decisão `include`.
   - Modo `accept`: só entra quem tem decisão `accept`, com `--por` (quem decidiu) e data.
   - Ficam sempre de fora: unidade provisória, fora do raio e revendedora/trader.
   - Cada empresa leva um `rastreio`: rodada, chave, situação, modo, decisão, quem decidiu, quando e pendências.
   - Evidência só de fonte própria ou registro oficial com URL. Canal só de e-mail publicado em fonte própria.
   - Sem pessoas, sem ligação de nível 0 e sem ficha.

## Uso

```sh
node scripts/rodada.mjs validar docs/implementation/rodadas/exemplos/soja-rio-verde-150km.json
node scripts/rodada.mjs executar <config.json> <candidatas.json> --municipios <municipios.csv|json> \
     --estado <estado.json> --saida <pasta> [--rede]
node scripts/rodada.mjs lote <pasta>/resultado-<id>.json --modo discovery --produto "<variante do catálogo>" --saida lote.json
node scripts/cadastrar-lote-aceito.mjs lote.json            # simulação; nada é gravado
```

- **`--rede`:** consulta as fontes cadastrais configuradas, com o limite de taxa da configuração. Sem `--rede`, a consulta vira pendência e a unidade fica como exceção.
- **CSV de municípios:** separado por `;`, com as colunas `ibge_code|code|codigo`, `municipio|name|nome`, `uf|region|estado`, `lat` e `lon`.

## O que continua igual (portões existentes)

Esta generalização não altera:

- aprovação de ficha;
- autorização de despesa;
- validação T11;
- liberação de envio;
- canais `planned`;
- campanhas inativas;
- cópia desligada;
- L1 e L4 pendentes.

Ela não autoriza contato nem consumo de créditos.

Um lote `accept` registra quem aceitou o cadastro. Esse registro não aprova ficha nem envio.

## Lacunas restantes

1. **Fontes cadastrais.** Só o Brasil tem fonte cadastral implementada (`br-cnpj-ws`, publica.cnpj.ws, 3 consultas por minuto). Outros países ficam com pendência explícita até haver fonte e regra de identificador (`ID_RULES`). O caso da Alemanha, por exemplo, depende do Handelsregister/Impressum, que já está em `FONTES-EMPRESAS-EXTERIOR.md`, mas ainda não ligado ao fluxo.
2. **Municípios.** Cada país e cada raio precisam de um conjunto com centroides e, de preferência, contorno (bbox). Hoje só existe o CSV do piloto (300 km de Indiara). Uma rodada com origem fora dessa área precisa de um conjunto novo; não há conjunto nacional versionado.
3. **Coleta de candidatas.** Continua manual ou assistida. O fluxo começa de um JSON de candidatas. A busca por fonte (SIPEAGRO, diretórios, sites) não está automatizada.
4. **Triagem de sanções.** Continua no Compass (`POST /screening`, opção `--triagem` no cadastro). A rodada não roda a triagem antes do cadastro. A validade das listas (720 h) é checada pelo Compass, não pela rodada.
5. **Regras por país e segmento.** `countryRules` e `segments` só registram a ausência como pendência. Não há regras de qualificação específicas por segmento além do rótulo.
6. **Lote histórico de 06/10.** `descoberta-milho-indiara/cadastro-lote-aceito.json` não declara `produto`. Como o script não tem mais produto padrão, reaplicá-lo agora falha com mensagem explícita, em vez de usar "Milho GMO" em silêncio. O arquivo não foi alterado porque é registro real do piloto.
7. **Integração com a interface do Compass.** O fluxo roda por linha de comando. A revisão em lote pela interface, com decisões por empresa, não foi implementada; as decisões entram por arquivo (`--decisoes`).

## Testes

Arquivo: `tests/rodada-fluxo.test.mjs`. São 12 testes, todos locais, sem rede e sem API. Fontes e relógio são falsos.

| Tema | O que o teste verifica |
|---|---|
| Configuração | Piloto com perto do limite em 270 km derivado do raio. Soja com margem de 15 km. Sorgo em milhas. Alemanha válida. Vários erros listados juntos. Nenhum valor do piloto no código. |
| Distância | Raios de 100 e 500 km, centroide ESTIMADA, coordenada da unidade decide fora, contorno dentro/fora, sem coordenada → desconhecida. |
| Piloto como configuração | Abadiânia a 173,8 km (estimada). Origem em outro estado (Uberlândia/MG) resolvida pelo mesmo código. |
| Estabelecimentos | CNPJ formatado igual ao CNPJ só com dígitos. Filiais separadas. Unidade sem CNPJ e CNPJ incompleto são provisórios. |
| Qualificação | Código de atividade e diretório são indício. Fonte própria comprova. Revenda e trader separados. Restrição não transgênica conflita com milho GMO, mas não com soja. Segmento sem regra vira pendência. Canal sem fonte é descartado. |
| Limite de taxa | 3 por minuto = 20 s entre consultas. |
| Lote com pendências parciais | Erro 500 e 429 não param a rodada. Depois do 429, a fonte não é mais chamada. |
| Reexecução | Mesma entrada não cria nada. Nova candidata entra. Evidência nova conta como alteração. Estabelecimento que só está no estado mantém nome e município (bug encontrado pelo teste e corrigido). |
| Exceções | Cadastro suspenso. Município divergente. Doverlândia a 271,8 km perto do limite em 300 km, mas não em 500 km. Unidade sem CNPJ. |
| Internacional | Alemanha, origem por coordenada, sem fonte cadastral → pendência explícita, idioma `en`. |
| Relatório | ESTIMADA, seção de exceções, "indício" em vez de "comprovado". |
| Lote | Produto obrigatório. `discovery` sem exceções. `accept` com decisor e rastreio. Evidência e canal filtrados. Sem nível 0. |

Suíte completa (`npm run check`, 15/10/2026): **484 + 2 + 37 testes, 0 falhas**.

Também foi feito um teste da linha de comando sem rede, com saída na pasta temporária da sessão:

- `executar` duas vezes: na primeira, 2 novos; na segunda, 2 sem mudança;
- `lote`: 0 empresas, porque sem `--rede` ambas ficam como exceção;
- `cadastrar-lote-aceito.mjs`: simulação, nada gravado.
