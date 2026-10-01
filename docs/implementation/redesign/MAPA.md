# Mapa de fundo do Radar Nacional (implementado em 2026-10-01, branch `redesign-ui`, não publicado)

Aprovado por Rogério em 2026-10-01 ("implementar o mapa Protomaps na branch de redesign; gravar o recorte no R2 existente").

## O que foi feito

| Item | Situação |
| --- | --- |
| Recorte | Protomaps Basemap, build diário 2026-09-29 (v4.15.2), Brasil (`bbox -74.1,-33.9,-34.7,5.4`), zoom 0–12 |
| Tamanho medido | 755.882.552 bytes (≈ 0,76 GB); `pmtiles verify` sem erro; SHA-256 `170af15b…5dde`. Medidas antes do envio: z10 = 149 MB, z11 = 314 MB, z12 = 755 MB (escolhido: nível de cidade e estradas para raios de 5 a 1.500 km) |
| Onde está | Bucket existente `eag-compass-files`, prefixo `mapa/brasil-20260929-z12/` (3 partes de até 300 MB, porque o upload pelo Wrangler aceita até 315 MB por objeto, + `manifest.json`). Partes conferidas por hash depois do envio |
| Proteção | Bucket continua **privado**: `r2.dev` desativado e nenhum domínio próprio ligado (conferido em 2026-10-01). O mapa só sai pela rota autenticada `GET /api/mapa/brasil.pmtiles` (mesma sessão/Access do Compass), somente leitura, por faixa de bytes (`Range`), até 8 MB por pedido, apenas chaves `mapa/` listadas no manifesto |
| Biblioteca | MapLibre GL JS 6.11.2, PMTiles 4.5.0 e camadas `@protomaps/basemaps` 5.7.2, servidos pela própria origem em `public/mapa/` (gerados por `scripts/vendor-map.mjs`) |
| Fontes e ícones | Noto Sans Regular/Medium/Italic em PBF (OFL 1.1) e ícones "light" v4 (derivados de tangrams/icons, MIT), locais |
| Atribuição | "Protomaps © OpenStreetMap" sempre visível no canto do mapa, com link para openstreetmap.org/copyright (exigência ODbL); `public/mapa/ATRIBUICAO.txt` lista dados, estilo e bibliotecas |
| Licenças | ODbL 1.0 (dados OSM), Natural Earth (domínio público), estilo Protomaps CC0, MapLibre BSD-3, PMTiles BSD-3, @protomaps/basemaps BSD-3, fflate MIT, Noto Sans OFL, ícones MIT — textos em `public/mapa/` e conferidos em `scripts/validate-site.mjs` |

## Política de segurança (CSP)

Única mudança: `img-src 'self' data:` → `img-src 'self' data: blob:` (em `src/http.js` e `public/_headers`). O MapLibre monta
imagens de ícones e rótulos como `blob:` gerados no próprio navegador. Nenhum domínio externo foi liberado. O worker do
MapLibre é carregado da própria origem (`setWorkerUrl`), coberto por `script-src 'self'` — sem `worker-src blob:` e sem
`unsafe-eval`. Teste: nenhuma violação de CSP e nenhuma requisição a outra origem durante o uso do mapa.

## Custos (documentação oficial da Cloudflare, consultada em 2026-10-01)

| Recurso | Franquia | Preço acima | Uso previsto |
| --- | --- | --- | --- |
| R2 armazenamento (Standard) | 10 GB-mês por mês | US$ 0,015 por GB-mês | ≈ 0,82 GB no bucket (0,76 do mapa + 0,06 já existentes) |
| R2 Classe B (leituras) | 10 milhões por mês | US$ 0,36 por milhão | 1 leitura por pedido de faixa (2 quando cruza partes); no teste, 6 a 10 pedidos por abertura do mapa |
| R2 Classe A (escritas) | 1 milhão por mês | US$ 4,50 por milhão | 4 escritas no envio inicial |
| R2 saída | sem cobrança | — | — |
| Workers, pedidos | Paid: 10 milhões/mês incluídos; Free: 100 mil/dia | Paid: US$ 0,30 por milhão | cada pedido de faixa passa pelo Worker (arquivos de `public/mapa` são estáticos: gratuitos e ilimitados) |
| Workers, CPU | Paid: 30 milhões de ms/mês | US$ 0,02 por milhão de ms | cópia de bytes; poucos ms por pedido |

Estimativa, **não garantia**: com uso pessoal (dezenas de aberturas do mapa por dia, algumas centenas de pedidos de faixa), o
consumo fica muito abaixo das franquias. Custo zero **não é garantido**: depende do plano da conta (não conferido por API nesta
sessão), do uso de outras aplicações na mesma conta (as franquias do R2 e do Workers são por conta) e de mudanças de preço.
Acompanhar no painel da Cloudflare (R2 › Métricas e Workers › Uso). Fontes: [R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limites de upload do R2](https://developers.cloudflare.com/r2/objects/upload-objects/).

## Atualização do recorte

1. `pmtiles extract https://build.protomaps.com/<AAAAMMDD>.pmtiles brasil-<AAAAMMDD>-z12.pmtiles --bbox=-74.1,-33.9,-34.7,5.4 --maxzoom=12`
2. `pmtiles verify`, dividir em partes de 300 MB, gerar `manifest.json` (tamanhos, SHA-256, fonte, atribuição).
3. Enviar com `wrangler r2 object put eag-compass-files/mapa/brasil-<AAAAMMDD>-z12/<parte> --file=… --remote`.
4. Trocar `MAP_MANIFEST_KEY` em `wrangler.jsonc`; apagar o prefixo antigo só depois de conferir o novo.

## Comportamento na tela

Radar Nacional › resultado: mapa com fundo real, círculo tracejado do raio, centro da busca, compradores (ponto cheio = endereço
da unidade; vazado = centro do município, estimativa), zoom por botões, roda/pinça (no celular, dois dedos para não prender a
rolagem), escala métrica. Clique ou toque num comprador mostra nome, cidade, distância e precisão, com "Abrir" para o painel
da empresa. Sem WebGL, sem recorte configurado (ex.: ambiente local) ou com falha de carga, o esquema em SVG continua no lugar.

Validado por `tests/ui-map.mjs` em 1440 px e 390 px (Chrome, WebGL por software): atribuição visível, raio e compradores
desenhados, ladrilhos carregados, zoom, clique abrindo a empresa, sem rolagem horizontal, sem violação de CSP e sem requisição
externa. A rota tem testes de faixa entre partes, limites e exigência de sessão (`tests/map-tiles.test.mjs`).
