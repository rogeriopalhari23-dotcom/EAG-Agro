# Publicação do redesign — preparação (2026-10-01, aguardando autorização de Rogério)

Interface visual aprovada por Rogério em 2026-10-01 (prévia integrada). **Esta preparação não publica nada.**

## O que será publicado

- **Código:** branch `redesign-ui`, commit indicado no relatório da preparação (inclui `v2-revisao-2` até `ca23feb`).
- **De onde:** a pasta `C:\Users\Roger\eag-compass-redesign` (a produção atual saiu de `v2-revisao-2`; `main` está 25
  commits atrás de `v2-revisao-2` e não é a origem da produção — nada é mesclado na `main`).
- **Diferença para a produção atual (`a5016aff`, de `v2-revisao-2`):** interface nova (`public/app.js`, `app.css`,
  `index.html`, fontes IBM Plex no lugar de Roboto/Barlow), mapa (`public/mapa/`, 784 arquivos estáticos, 14 MB;
  `src/map-tiles.js`; rota autenticada `/api/mapa`), leituras novas (`/api/companies` com filtros `country`, `contact`,
  `profile` e contagem de contatos; `lat/lon` dos candidatos da busca nacional; `contactKind` dos contatos), CSP com
  `blob:` em `img-src`, variável `MAP_MANIFEST_KEY`, scripts de build/validação e testes. Nenhuma mudança de regra de
  envio, aprovação, supressão ou horário.
- **Migrações:** nenhuma nova. A `0031` já está aplicada (`wrangler d1 migrations list eag_compass --remote` → "No
  migrations to apply").
- **Recursos:** mesmo Worker (`eag-compass-production`), mesmo D1, mesmo bucket R2 privado (`eag-compass-files`, prefixo
  `mapa/` já enviado e conferido por hash), mesma fila e crons, mesmo Access (o hostname inteiro, inclusive `/mapa/*`).
  Simulação (`wrangler deploy --dry-run`): 802 arquivos estáticos, Worker 681 KiB (179 KiB gzip).

## Testes finais (na pasta do redesign)

`npm run check` (371 + 2 + ponte 15, build e validação do site e da configuração), `tests/ui-smoke.mjs`,
`tests/ui-keyboard.mjs` e `tests/ui-map.mjs` (desktop e 390 px) — todos OK. Prévia integrada conferida: compradores no
mapa, filtros de Empresas e remoção de supressão pela rota real.

## Comandos (PowerShell, depois da autorização)

```
cd C:\Users\Roger\eag-compass-redesign
git status --short                                   # deve estar vazio
git log --oneline -1                                 # deve mostrar o commit preparado
npx wrangler d1 time-travel info eag_compass         # anotar o bookmark (ponto de restauração)
npx wrangler d1 migrations list eag_compass --remote # deve dizer "No migrations to apply"
npm run deploy                                       # roda check + validate-deploy e publica
npx wrangler deployments list                        # anotar a nova versão (100%)
```

Conferência depois da publicação: login pelo Access; Início, Radar Nacional (mapa com compradores), Empresas
(filtros), Abordagem, Configurações › Supressão (lista, remoção recolhida, histórico); `/api/mapa` com
`available:true`; canal de e-mail `planned`; nenhuma campanha ativa; ponte do Windows seguindo com leitura OK.

## Reversão

- **Worker e interface:** `npx wrangler rollback a5016aff-f4c7-42ff-99a5-0c466db2e89d --message "volta à interface anterior"`
  (a versão inclui os arquivos estáticos; volta imediatamente a interface e o código de hoje). Sem migração nova, o D1
  não precisa ser restaurado; o recorte do mapa no R2 fica guardado e sem uso.
- **D1 (só se algum dado for alterado por engano):** `npx wrangler d1 time-travel restore eag_compass --bookmark=<bookmark anotado>`.
- **Código:** `v2-revisao-2` continua no estado publicado hoje; depois da publicação, levar `redesign-ui` para
  `v2-revisao-2` (fast-forward) para a branch de produção corresponder ao que estiver no ar — pedir autorização junto.

## O que não muda

Canal de e-mail `planned`, campanhas inativas, fichas sem aprovação nova, ponte do Windows, Access e segredos.
