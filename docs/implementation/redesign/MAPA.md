# Mapa de fundo do Radar Nacional — proposta (30/09/2026)

Situação atual (branch `redesign-ui`): mapa esquemático em SVG (centro, círculo do raio, posição relativa das unidades),
sem mapa de fundo, porque a política de segurança só aceita imagens da própria origem (`img-src 'self' data:`).
Esta proposta **não foi implementada**; depende da sua decisão.

## Recomendação: Protomaps (OpenStreetMap) hospedado na própria conta Cloudflare

| Item | Proposta |
| --- | --- |
| Provedor dos dados | Mapa base Protomaps (derivado do OpenStreetMap), recorte do Brasil em um arquivo `.pmtiles` |
| Onde fica | Bucket R2 da sua conta Cloudflare, servido pelo próprio Worker do Compass (mesma origem) |
| Biblioteca | MapLibre GL JS + `pmtiles` (JavaScript), arquivos copiados para `public/mapa/` (sem CDN) |
| Estilo, fontes e ícones | Estilo "light" do Protomaps e os arquivos de fontes/ícones (`basemaps-assets`), também em `public/mapa/` |
| Atribuição obrigatória | "© OpenStreetMap" visível no canto do mapa, com link para openstreetmap.org/copyright (licença ODbL); sugerido "Protomaps © OpenStreetMap" |
| Custo | Previsto US$ 0: o R2 inclui 10 GB de armazenamento, 10 milhões de leituras por mês e saída gratuita. Acima disso: US$ 0,015 por GB/mês e US$ 0,36 por milhão de leituras |
| Contrato/chave | Nenhum. Sem conta em terceiros, sem chave exposta no navegador, sem rastreamento de quem consulta |

Tamanho do arquivo: o planeta inteiro tem ~120 GB (zoom 0–15). Para um raio de 50 a 300 km basta o Brasil até o zoom
11 ou 12; o tamanho exato deve ser medido no recorte (`pmtiles extract … --bbox=<Brasil> --maxzoom=12 --dry-run`) antes do
envio. A expectativa é ficar dentro dos 10 GB gratuitos; se não ficar, reduz-se o zoom máximo.

## Alteração mínima na política de segurança

Uma só mudança: acrescentar `blob:` em `img-src` (o MapLibre monta ícones e rótulos como imagens `blob:` geradas no
próprio navegador; nada é baixado de fora).

```
antes:  img-src 'self' data:
depois: img-src 'self' data: blob:
```

Nenhum domínio externo é liberado. Os ladrilhos chegam por `fetch` à mesma origem (`connect-src 'self'` já permite).
O processamento em segundo plano do MapLibre usa o arquivo de worker servido pela própria origem (`setWorkerUrl`),
coberto por `script-src 'self'` — sem `worker-src blob:` e sem `unsafe-eval`. A mudança vale nos dois lugares em que a
política é definida hoje: `src/http.js` e `public/_headers`.

## Passos de implementação (quando aprovado)

1. Baixar o build diário do Protomaps e recortar o Brasil (`pmtiles extract`), conferindo o hash BLAKE3 publicado.
2. Enviar o arquivo a um bucket R2 (novo ou prefixo `mapa/` em um existente) — exige sua autorização de escrita na conta.
3. Rota `GET /mapa/brasil.pmtiles` no Worker, com suporte a `Range`, somente leitura, atrás do mesmo Access do painel.
4. Copiar MapLibre, `pmtiles`, estilo, fontes e ícones para `public/mapa/` com as licenças (BSD-3, BSD-3, ODbL/CC0, OFL),
   e registrar as licenças na validação do site (`scripts/validate-site.mjs`).
5. Trocar o SVG pelo mapa no Radar Nacional mantendo os mesmos sinais: centro, círculo do raio, ponto cheio = endereço,
   ponto vazado = centro do município (estimado). O SVG continua como alternativa sem WebGL.
6. Testes: política de segurança sem domínio externo, atribuição visível, nenhuma requisição a outra origem durante o
   carregamento do mapa (Playwright), 390 px sem rolagem horizontal.

## Alternativa considerada e não recomendada: MapTiler Cloud

O plano gratuito é só para uso não comercial e exige o logotipo MapTiler; o uso comercial começa no plano Flex (US$ 25/mês).
Exigiria liberar `api.maptiler.com` em `connect-src`/`img-src`, expor uma chave no navegador e enviar a um terceiro
cada área consultada. Por isso não é recomendada aqui.

Fontes: [Protomaps — downloads](https://docs.protomaps.com/basemaps/downloads), [Protomaps — licença dos dados](https://github.com/protomaps/basemaps/blob/main/LICENSE_DATA.md),
[OSMF — diretrizes de atribuição](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines), [MapLibre — CSP](https://github.com/maplibre/maplibre-gl-js/blob/main/docs/guides/v5-to-v6-migration-guide.md),
[preços R2](https://egresscost.com/cloudflare/), [termos MapTiler Cloud](https://www.maptiler.com/terms/cloud/).
