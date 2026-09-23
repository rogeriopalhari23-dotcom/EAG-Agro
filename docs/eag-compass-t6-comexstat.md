# T6 — Comex Stat: registro de testes reais

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

## Fontes

- Consultas reais listadas acima (2026-09-23).
- Pacote R `comexr` (CRAN), manual: https://cran.r-project.org/web/packages/comexr/refman/comexr.html — endpoints `/general`, `/tables/*`, formato de `period` `YYYY-MM`, idiomas `pt`/`en`/`es`.
- Busca que indicou a especificação oficial `https://api-comexstat.mdic.gov.br/docs/doc.yaml` (bloqueada por desafio da Cloudflare; não lida).
