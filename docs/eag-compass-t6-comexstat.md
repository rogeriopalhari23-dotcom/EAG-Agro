# T6 e T13 — Comex Stat, arquivo do MDIC e UN Comtrade: registro de testes reais (rev. 2)

**Data:** 2026-09-23
**Executado por:** Claude, a partir da máquina de Rogério (Windows, rede doméstica), com `curl` e Node 24 (`fetch`).
**Tipo:** consulta de **dados públicos**, sem chave, sem cadastro e sem envio de dado pessoal.
**Situação de T6:** passa de "documentação lida; nenhuma consulta executada" para **"contrato conferido por consulta real a partir de rede doméstica; acesso a partir do Worker ainda não testado"**.

## 1. Acesso

| URL | Resultado | Leitura |
| --- | --- | --- |
| `https://api-comexstat.mdic.gov.br/docs` | 403 "Just a moment..." (desafio da Cloudflare) | A documentação oficial **não abre sem navegador**. Idem `/docs/doc.yaml`, `/docs/swagger.json` e `/`. |
| `https://comexstat.mdic.gov.br/` | 403 "Attention Required! \| Cloudflare" | Site também protegido. |
| `GET /general/dates/updated`, `GET /tables/*`, `POST /general` | 200 JSON | **A API responde a clientes automatizados** (testado com `user-agent: Mozilla/5.0`). |

**Risco aberto:** o site do MDIC usa proteção da Cloudflare contra robôs. A consulta a partir de um Worker (IP da própria Cloudflare) **não foi testada**. Se for bloqueada, o plano prevê o caminho alternativo (§6).

## 2. Contrato conferido

Base: `https://api-comexstat.mdic.gov.br`. Idioma: `?language=pt` (o pacote `comexr` documenta também `en` e `es`).

**`POST /general?language=pt`**, `content-type: application/json`. Corpo usado (copiado da consulta que funcionou):

```json
{"flow":"export","monthDetail":true,"period":{"from":"2025-01","to":"2025-12"},
 "filters":[{"filter":"country","values":["023"]},{"filter":"chapter","values":["01","02","…","24"]}],
 "details":["ncm"],"metrics":["metricFOB","metricKG","metricStatistic"]}
```

Resposta (copiada, 3 primeiras de 1.641 linhas; 314 KB; 765 ms):

```json
{"data":{"list":[
 {"coNcm":"09011110","year":"2025","monthNumber":"11","ncm":"Café não torrado, não descafeinado, em grão","metricFOB":"300582403","metricKG":"41067033","metricStatistic":"41006"},
 {"coNcm":"09011110","year":"2025","monthNumber":"03","ncm":"Café não torrado, não descafeinado, em grão","metricFOB":"282036386","metricKG":"45134372","metricStatistic":"47289"},
 {"coNcm":"09011110","year":"2025","monthNumber":"10","ncm":"Café não torrado, não descafeinado, em grão","metricFOB":"270141171","metricKG":"39231664","metricStatistic":"819606"}
]},"success":true,"message":null,"processo_info":null,"language":"pt"}
```

Outras respostas copiadas:

- `GET /general/dates/updated` → `{"data":{"updated":"2026-09-04","year":"2026","monthNumber":"08"},"success":true,...}`
- `GET /tables/countries/023?language=pt` → `{"data":{"id":"023","country":"Alemanha","coPaisIson3":"276","coPaisIsoa3":"DEU"},"success":true,"message":"País encontrado",...}`
- `GET /tables/ncm?search=09011110&language=pt` → `{"data":{"list":[{"noNCM":"Café não torrado, não descafeinado, em grão","unit":"TONELADA METRICA LIQUIDA","coNcm":"09011110"}],"count":1},...}`
- `GET /general/metrics` → `metricFOB` "Valor US$ FOB"; `metricKG` "Quilograma Liquido"; `metricStatistic` "Quantidade Estatística" com `"depends":{"filter":"ncm"}`; `metricFreight`, `metricInsurance`, `metricCIF` com `"depends":{"flow":"import"}`.
- `GET /general/filters` e `/general/details` → nomes aceitos: `country`, `economicBlock`, `state`, `via`, `urf`, `ncm`, `subHeading`, `heading`, `chapter`, `section`, `BECLevel1–3`, `SITC*` (lista truncada na captura).

## 3. Armadilhas encontradas (todas reproduzidas)

| # | Condição | O que a API faz | Consequência para o Compass |
| --- | --- | --- | --- |
| C1 | País como número (`[23]`) em vez de texto com zeros (`["023"]`) | **200, `success:true`, lista vazia** | Seria lido como "nenhum registro". O adaptador só aceita o código de 3 dígitos em texto vindo de `/tables/countries`. |
| C2 | Período que atravessa o ano (`2025-09` a `2026-08`), com ou sem `monthDetail` | **200, `success:true`, lista vazia** — os mesmos dados aparecem consultando `2026-01..2026-08` sozinho | Seria lido como "nenhum registro". O adaptador **divide o período por ano civil** e junta as partes. |
| C3 | `metricStatistic` sem `ncm` em `details` | 400 `"Métrica inválida (ncm é obrigatório para metricStatistic)"` | Validação local antes de chamar. |
| C4 | Filtro ou métrica com nome errado | 400 `"Filtro inválido"`, `"Métrica inválida (fob)"` | Erro de programação: não repetir. |
| C5 | Requisições seguidas | 429 `"Você excedeu o limite de solicitações. Por favor, tente novamente em 10 segundos."` — **uma chamada 12 s após a anterior ainda recebeu 429**; 16 s entre chamadas não recebeu | Espaçamento mínimo de **20 s** entre chamadas (margem) e tratamento de 429 como temporário. Limite exato **não documentado**. |
| C6 | `metricStatistic` do café em out/2025: 819.606 com unidade "TONELADA METRICA LIQUIDA", para 39.231.664 kg (esperado ≈ 39.232 t) | Dado inconsistente na fonte | **Quantidade principal = `metricKG`** (unidade única: kg líquido). A quantidade estatística aparece só como dado secundário, com a unidade da NCM, **nunca somada** entre NCMs e marcada "inconsistente" quando divergir mais de 5% de kg/1000 em NCMs medidas em tonelada. |
| C7 | Valores numéricos | Chegam como **texto** (`"300582403"`) | Conversão com `Number()`; maior valor visto (9,99 × 10¹⁰) cabe com folga no inteiro seguro do JavaScript. |

## 4. Decisões propostas para o Plano 3 (a aprovar por Rogério)

- **D1 — Período padrão (`param_period_default_months`, pendente na Spec R7.1):** **12 meses** fechados, terminando no mês de `/general/dates/updated`. Ajustável pelo usuário de 1 a 60.
- **D2 — "Commodity agrícola" (R12.3, classificação versionada):** capítulos **01–24 do SH** (seções I–IV), versão `sh-01-24@2026-09-23`. **Exclui capítulo 03** (pescados) por não ser comércio da EAG. Lista de exceções ampliável sem redeploy (parâmetro).
- **D3 — Unidade de soma:** só `metricKG` e `metricFOB` (US$) são somados. Nada de unidade estatística agregada.
- **D4 — Estados R12.6:** `compra identificada` só com linhas > 0; `nenhum registro no período` só quando **todas** as partes anuais responderam 200 com `success:true` **e** o código do país foi validado em `/tables/countries/<id>`; qualquer 4xx/5xx/timeout/429 esgotado em alguma parte → `dados indisponíveis` ou `parcial`.

## 5. O que não foi testado

- Acesso a partir de um Worker (IP da Cloudflare).
- Limite real de requisições (só observado que 12 s é insuficiente às vezes).
- `language=en` (PV12/inglês).
- Páginas da API com muitas linhas (não houve paginação visível; o maior retorno foi 1.641 linhas).

## 6. Caminho alternativo se o Worker for bloqueado

O MDIC publica os arquivos completos por ano (CSV de exportação por NCM e país) para download. **Não conferido nesta sessão:** URL, formato e tamanho. Se a API bloquear o Worker, o Plano 3 volta à Fase 4 para esse item, sem improvisar.

## 7. Arquivo completo do MDIC (acrescentado na rev. 2, 2026-09-23)

Com a decisão de Rogério de montar uma **lista mensal de todos os países** (Spec R12.11), a fonte brasileira passa a ser o **arquivo completo** do MDIC. A API fica sem uso na análise, o que elimina C1, C2 e C5.

| Item | Resultado conferido |
| --- | --- |
| `https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm/EXP_2026.csv` | 200; `Content-Length: 75055366`; `Last-Modified: Fri, 04 Sep 2026 18:05:56 GMT`; aceita `Range` (206) |
| `…/ncm/EXP_2025.csv` | 200; `Content-Length: 113715007`; `Last-Modified: Thu, 05 Feb 2026 18:21:06 GMT` |
| Cabeçalho (copiado) | `"CO_ANO";"CO_MES";"CO_NCM";"CO_UNID";"CO_PAIS";"SG_UF_NCM";"CO_VIA";"CO_URF";"QT_ESTAT";"KG_LIQUIDO";"VL_FOB"` |
| Linha (copiada) | `"2026";"01";"02023000";"10";"589";"MT";"07";"0230154";22356;22356;89125` — códigos entre aspas, métricas sem aspas; separador `;` |
| `…/bd/tabelas/PAIS.csv` | `"CO_PAIS";"CO_PAIS_ISON3";"CO_PAIS_ISOA3";"NO_PAIS";"NO_PAIS_ING";"NO_PAIS_ESP"`; ex.: `"013";"004";"AFG";"Afeganistão";"Afghanistan";"Afganistan"`; **codificação não é UTF-8** (acentos quebrados na leitura como UTF-8; tratar como Latin-1/Windows-1252) |
| Vários códigos por país | `PAIS.csv` repete ISO-3: `"249";"840";"USA";"Estados Unidos"`, `"396";"840";"USA";"Johnston, Ilhas"`, `"873";"840";"USA";"Wake, Ilha"`; `"023";"276";"DEU";"Alemanha"`, `"025";"278";"DEU";"Alemanha Oriental"`. Um país do Compass agrega todos os seus `CO_PAIS`. |
| `…/bd/tabelas/NCM.csv` | `"CO_NCM";"CO_UNID";"CO_SH6";…;"NO_NCM_POR";"NO_NCM_ESP";"NO_NCM_ING"` — traz a subposição SH6 de cada NCM e o nome em inglês |
| Proteção | O host `balanca.economia.gov.br` respondeu sem desafio da Cloudflare (a partir da rede doméstica). Pelo Worker: não testado. |

Fonte da página de downloads: [Base de dados do Comex Stat — arquivos para download](https://balanca.economia.gov.br/index.php/comercio-exterior/estatisticas-de-comercio-exterior/9-assuntos/categ-comercio-exterior/2551-base-de-dados-do-comercio-exterior-brasileiro-arquivos-para-download); [Estatísticas em dados abertos (MDIC)](https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/base-de-dados-bruta).

## 8. UN Comtrade — fonte do importador (T13, acrescentado na rev. 2)

| Item | Resultado conferido |
| --- | --- |
| Planos | Conta gratuita (Basic Individual): "500 calls/day", "max 100K records per call" (Data API). Premium Individual: 5.000/dia. [Página de planos](https://uncomtrade.org/docs/subscriptions/) |
| Chave | API completa exige conta e `subscription-key`; sem chave só a pré-visualização (`public/v1/preview`), limitada a 500 registros. [UN Comtrade API](https://uncomtrade.org/docs/un-comtrade-api/) |
| Consulta sem chave | `GET https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=276&period=2025&partnerCode=0&flowCode=M&cmdCode=09` → 200, `"count":500`; registro com `refYear 2025`, `flowCode "M"`, `classificationCode "H6"`, `cifvalue`, `fobvalue null`, `netWgt`, `qty`, `qtyUnitCode`, `primaryValue` |
| Disponibilidade | `GET …/public/v1/getDA/C/M/HS?reporterCode=276` → Alemanha com mensal até `period 202606` (liberado em 2026-08-28). China: anual 2022–2025. |
| Valor | Importações declaradas em **CIF** (`cifvalue`; `fobvalue` nulo no exemplo). O MDIC é **FOB**. Por isso as fontes não são somadas (Spec R12.13). |
| Códigos de país | `https://comtradeapi.un.org/files/v1/app/reference/Reporters.json` (255 entradas, 219 ativas e não grupo). **Diferem do ISO numérico:** EUA 842, França 251, Índia 699, Suíça 757, Noruega 579. Há entradas expiradas com o mesmo ISO-3 (ex.: `DEU` 280, `entryExpiredDate 1990-12-31`); usar só as sem `entryExpiredDate`. |
| Produtos | `https://comtradeapi.un.org/files/v1/app/reference/HS.json`: **894 subposições SH6** nos capítulos 01–24 sem o 03 (6.257 caracteres juntas) → 3 chamadas de ~300 códigos por país. Nenhum código agregado "agrícola" na tabela (só `TOTAL`). |
| Parceiro Brasil | `partnerCode=76`; todas as origens `partnerCode=0`. |
| Não testado | Chamada com chave; limite por segundo da conta gratuita; termos de reutilização ("Policy on use and re-dissemination", citada sem texto na página de planos). |

## Fontes

- Consultas reais listadas acima (2026-09-23).
- Pacote R `comexr` (CRAN), manual: https://cran.r-project.org/web/packages/comexr/refman/comexr.html — endpoints `/general`, `/tables/*`, formato de `period` `YYYY-MM`, idiomas `pt`/`en`/`es`.
- Busca que indicou a especificação oficial `https://api-comexstat.mdic.gov.br/docs/doc.yaml` (bloqueada por desafio da Cloudflare; não lida).

## 9. Teste pelo Worker (Plano 3 T12 — roteiro, não iniciado em 2026-09-24)

Cada passo é feito com Rogério e registrado aqui com data, resultado e a resposta copiada. Fixtures dos testes automatizados **não** substituem este registro.

| # | Passo | Resultado esperado | Data | Resultado / evidência |
| --- | --- | --- | --- | --- |
| 1 | Rogério cria a conta gratuita em https://comtradedeveloper.un.org/, assina o produto gratuito e grava `npx wrangler secret put COMTRADE_KEY` (Claude não cria contas) | Chave só como secret | | |
| 2 | Ler a "Policy on use and re-dissemination" da Comtrade | Permite guardar a lista para uso interno; se não permitir, a Comtrade sai da rotina e a Spec volta para revisão | | |
| 3 | Chamada real com chave para `DEU` e um bloco (`src/adapters/comtrade.js`) | Conferir: cabeçalho `Ocp-Apim-Subscription-Key` aceito; `partnerCode=0,76` e `period` com lista aceitos; valores de total de `partner2Code`/`customsCode`/`motCode`; `count`; ajustar o orçamento de chamadas se preciso | | |
| 4 | Pelo Worker publicado: `POST /api/trade-list/refresh/DEU` | MDIC responde ao Worker **apesar do certificado incompleto** (ver P3-T2 em EVIDENCIAS: o servidor não envia o intermediário Sectigo); totais de café 2025 batem com a seção 2 (340.503.519 kg). Se o Worker for recusado, o Internacional não é liberado e o item volta à Fase 4 | | |
| 5 | Primeira rotina mensal completa (`POST /api/trade-list/run`, mesmo código do cron) | Duração, chamadas por dia, 429, CPU por pedaço do MDIC no workerd e tamanho no R2 medidos e registrados | | |
| 6 | Amostra R17.6 internacional: sequência em inglês para contato interno em outro fuso, pelo modo `internal_test` | Rogério revisa texto e horário (depende da aprovação da tradução — `docs/implementation/AMOSTRAS-TEXTOS-EN.md`) | | |
| 7 | Com 1–6 registrados, Rogério autoriza por escrito "liberar internacional" | Admin grava `international_enabled` = `{"enabled":true,"evidenceRef":"docs/eag-compass-t6-comexstat.md#liberacao-internacional"}` | | |

### Liberação internacional

Preencher só com os passos 1–7 registrados: data, texto e canal da autorização de Rogério.
