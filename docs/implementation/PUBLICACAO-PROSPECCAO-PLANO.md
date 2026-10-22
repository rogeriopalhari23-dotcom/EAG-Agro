# Plano de publicação: prospecção automática e descoberta real (preparado em 2026-10-21; executado em 2026-10-22, ver EVIDENCIAS)

Aguarda autorização de Rogério. Este plano publica o código. **Não cadastra** em produção as 147 empresas do Chile. O cadastro desse lote é uma ação separada, que pede autorização própria.

## 1. O que vai e o que não vai

**Produção atual** (consulta só de leitura em 2026-10-21):
- Worker `4933fc92-71b6-4163-8b24-41035e0a88b3`, código `e58b7ed`, 100% ativo desde 2026-10-20T19:14Z;
- 44 migrações aplicadas;
- 37 empresas, nenhuma no Chile;
- 73 candidatas de descoberta (café, Alemanha);
- 1 busca internacional;
- campanhas: 3 `draft` + 1 `ended`.

**Código.** São 13 commits, de `4c348f6` a `df7e353`, de `e58b7ed` até a ponta da `redesign-interface` (`e58b7ed` é ancestral dela):
- prospecção automática com perfil e política;
- listas pesquisáveis;
- evidência de mercado por fonte;
- política delimitada (R12.7);
- reaproveitamento de empresas e todas as subposições;
- países por commodity e base de mercados;
- LENAA do SAG e modo real da prévia.

O `wrangler.jsonc` não mudou: mesmos crons, bindings e variáveis, e nenhum segredo novo.

**Migrações pendentes** (`wrangler d1 migrations list --remote`):

| Migração | Efeito |
| --- | --- |
| 0045 | Tabelas novas: `prospect_profiles`, `research_policies`, `prospect_jobs`, `prospect_job_events`, com seus índices |
| 0046 | Coluna `products.display_name`; produto Farelo de milho, com código e característica |
| 0047 | Colunas novas (`product_codes.scope`, `product_characteristics.verified_at`, `hs6_json` no resumo do país) e tabela `contact_products` |
| 0048 | Recria `discovery_candidates` aceitando a fonte `cl_sag_lenaa`. Mesmas colunas, UNIQUE e índice; as linhas são copiadas |

**Ensaio feito em 2026-10-21:**
- 0045–0048 aplicadas, em memória, sobre o esquema exportado da produção (sem dados);
- a linha existente foi preservada, a UNIQUE continua valendo e os índices foram recriados;
- produção tem 0 candidatas órfãs (de busca, de execução ou de empresa).

**Testes:** `npm run check` com 613 testes e 0 falhas, e `npm run test:ui` OK.

**Fica fora:**
- o cadastro das 147 empresas;
- qualquer ficha, T11, canal, campanha ou envio;
- o filtro de disponibilidade (pedido seguinte, ainda não implementado).

## 2. Execução real preservada (fora do Git)

Pasta: `C:\Users\Roger\eag-compass-backups\execucao-real-soja-chile-20261021\`

| Arquivo | Conteúdo |
| --- | --- |
| `execucao-real.json` | Cópia da execução local real (prévia `8975371`, banco em memória): 147 empresas, 4 buscas com candidatas e execuções, 4 trabalhos com eventos. Os trabalhos são Soja — Chile e os três disparados depois na prévia: Milho — Bermudas, Etanol — África do Sul e Milho — Albânia |
| `empresas-candidatas.csv` | 147 linhas com nome, país, RUT, fonte, URL da fonte e atividade. Compra, importação do Brasil e GMO estão marcados "não confirmada" |
| `LENAA 09-10-2026 - PUBLICA.xlsx` | Planilha oficial do SAG usada na execução |
| `SHA256.txt` | Hashes do JSON (`bf0dea92…6199`) e da planilha (`ec2c6149…5c5c`) |

As 147 empresas são **candidatas em descoberta**. A LENAA prova a fabricação de ração autorizada pelo SAG. Não prova compra de soja, importação do Brasil nem aceitação de GMO.

## 3. Passos (cada um só com a autorização deste plano)

1. **Backup:**
   - `npx wrangler d1 time-travel info eag_compass`: anotar o marcador (bookmark) de antes;
   - `npx wrangler d1 export eag_compass --remote --output C:\Users\Roger\eag-compass-backups\d1-remoto-antes-0045-0048-AAAAMMDD\eag_compass.sql` e registrar o SHA-256. A exportação bloqueia o banco por alguns segundos; a ponte pode ter uma leitura recusada e repete sozinha;
   - anotar o Worker vigente (`4933fc92`).
2. **Migrações:** `npm run db:migrate:remote`. Antes, o script roda `validate-deploy` e aplica 0045–0048 em ordem. Conferir "No migrations to apply" e as 73 candidatas mantidas.
3. **Publicação:** `npm run deploy`. Antes, o `predeploy` roda `npm run check` e `validate-deploy`. Anotar a versão nova.
4. **Conferência (só leitura,** Chrome sem interface com a sessão do Access, sem exibir token):
   - Telas: Visão geral, Prospecção, Radar Internacional (commodity → países), Empresas (37), Rodadas e Compliance.
   - No banco: T11 `pending`; canais `planned`; cópia `enabled:false`; 0 fichas aprovadas; fila de envio vazia; campanhas 3 `draft` + 1 `ended`; 0 empresas no Chile.
   - Ponte: uma leitura bem-sucedida depois da publicação.
5. **Registro:** EVIDENCIAS e `sequence.json` (versão, horários, hashes).

**Escrita automática a esperar.** A primeira abertura da tela Prospecção em produção grava a política delimitada (`research_policies` v1, mais auditoria `research_policy.granted_from_authorization`). Ela vem da autorização escrita de 2026-10-20, registrada como automação, sem clique de pessoa. Nenhuma pesquisa começa sozinha: o cron só avança trabalhos iniciados por uma pessoa, e a pesquisa automática precisa do botão. Se Rogério preferir que nem a política seja gravada antes de nova decisão, isso tem de ser dito antes do passo 3.

## 4. Reversão

- **Código:** `npx wrangler rollback 4933fc92-71b6-4163-8b24-41035e0a88b3`.
  - O código anterior ignora as tabelas e colunas novas.
  - A 0048 só amplia a lista de fontes aceitas.
  - Não é preciso desfazer migração para voltar o código.
- **Banco:**
  - Só se uma migração falhar no meio ou corromper dados: `npx wrangler d1 time-travel restore eag_compass --bookmark=<marcador do passo 1>`. Isso descarta toda gravação posterior, inclusive as da ponte.
  - Alternativa: reimportar a exportação do passo 1.
- **Repositório:** nada a reverter. A produção volta ao commit `e58b7ed`.

## 5. Onde cada parte roda depois de publicada

| Parte | Worker publicado | Depende do navegador ou da execução local |
| --- | --- | --- |
| Trabalhos da prospecção (cron a cada 5 min), relatório, triagem com as listas importadas em produção | Sim | — |
| Lista commodity × países (MDIC e Comtrade já guardados no D1) | Sim | — |
| LENAA (SAG, Chile) | Deve funcionar: `fetch` de 220 KB e leitura do xlsx com `DecompressionStream`. **Ainda não comprovado no Worker** (o SAG pode recusar a Cloudflare). Uma falha aparece como fonte indisponível, nunca como empresa fictícia | — |
| OpenStreetMap (Overpass) | Recusa conexões da Cloudflare (521/522, já comprovado) | **Navegador:** a prospecção fica em "a busca no mapa precisa deste navegador" e o painel aberto faz a consulta |
| Modo real da prévia (`PREVIEW_REAL=1`) e demonstração simulada | Não vão para o Worker | Só local (`tests/preview-server.mjs`) |
| Banco da execução real de Soja — Chile | Não existe em produção | Só no arquivo da seção 2 |

## 6. Cadastro do lote do Chile (ação separada, não autorizada)

Ainda não existe rotina de importação deste arquivo. Depois da publicação, o caminho previsto é rodar "Soja — Chile" pela própria produção, com consulta nova à LENAA. O resultado é comparável por RUT com o arquivo da seção 2. Esse passo depende de autorização própria e não afirma compra, importação nem aceitação de GMO.
