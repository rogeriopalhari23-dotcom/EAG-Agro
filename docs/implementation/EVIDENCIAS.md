# Evidências de execução da fila

Registro curto por tarefa: o que foi feito, como foi verificado e o que continua dependendo de validação externa. `sequence.json` aponta, em `evidence`, para o arquivo de testes ou documento principal de cada item. Resultados locais não comprovam CI remoto, produção nem provedores externos.

Ambiente de verificação: Windows 10, Node 24.15.0, npm 11.12.1, wrangler 4.136.1 (branch `v2-revisao-2`).

## Integração da revisão 2 (2026-09-23)

- Pacote `eag-compass-revisado-0.3.1-review.2.zip` aplicado sobre a árvore local (commit `65251af`); 147 arquivos conferidos por `npm run verify:package`; commit `2aa8429`.
- `npm ci`: 38 pacotes, 0 vulnerabilidades. `npm run check` no Windows: 87 testes de regras/API + 2 workerd/D1 passando; build e validação do site passando.
- Banco local: backup em `C:\Users\Roger\eag-compass-backups\d1-local-20260923-120933` antes de aplicar 0003–0005; 0001–0002 idênticas às já aplicadas. Após aplicar: 28 produtos, 15 parâmetros.
- Numeração de migrações: segue a ordem real de execução a partir de 0006. Os números 0006–0011 citados nos planos eram ilustrativos (errata); as tarefas registram o arquivo efetivamente criado.

## P1-T2 — Harness no Windows

- `npm ci` e `npm run check` executados no Windows desta máquina com sucesso (acima). Falta a execução real do CI remoto (GitHub Actions, matriz Ubuntu/Windows), que depende de push da branch.

## P1-T7 — Catálogo editável

- Migração `0006_catalogo_admin.sql`: revisão otimista por produto; responsável e data em produto, código e característica; gatilhos que recusam código `confirmed` sem fonte ou versão da classificação e identidade `confirmed` sem referência.
- `src/catalog.js`: criação/edição de produto, códigos NCM/HS (formato validado, código imutável, remoção auditada) e características (fonte obrigatória, escopo de amostra). Só `admin`. Motivo obrigatório; auditoria na mesma transação.
- `mentionableCharacteristics`: só característica confirmada e fora do escopo de amostra (R10.6 + errata).
- Testes: `tests/catalog.test.mjs` (8 casos). Nenhum NCM/HS foi cadastrado nos seeds: os códigos reais dependem de fonte que Rogério informar.

## P1-T8 — Parâmetros tipados

- `src/parameter-registry.js`: registro de 18 parâmetros editáveis com escopo e tipo (número, inteiro, lista de raios, rampa, intervalo, janela HH:MM + dias, fuso IANA). Relações validadas: raio inicial dentro da lista; limite de subida de degrau abaixo do limite de parada.
- Nenhum valor padrão no código: `send_window`, `send_timezone`, `period_default_months` (D1), `country_list_refresh_day` e `campaign_review_days` continuam ausentes até decisão (R7.1.1). `open_tracking_enabled` não é editável (K5 depende de T1/T11).
- `GET /api/parameters` devolve também `definitions` (rótulo, escopo, quem depende, escopos configurados) para a interface exibir pendências.
- Testes: `tests/parameters.test.mjs` (7 casos).

## P1-T9 — Campanhas: ICP e declarações versionados

- `PUT /api/campaigns/:id/icp`: edição com versão esperada; campanha sobe de versão; auditoria com ICP anterior e novo. Porte só `medium`/`medium_plus` (K1).
- `POST /api/campaigns/:id/declarations/:declId/revoke` (gestores, motivo obrigatório) e `GET /api/campaigns/:id/declarations` (histórico com revogadas).
- Limite de 2 commodities ativas por mercado continua atômico em SQL; variantes da mesma commodity não ocupam vaga nova.
- Interface: tela de detalhe da campanha com ICP, histórico de declarações, edição do ICP, aprovação e revogação.
- Testes: `tests/campaigns.test.mjs` (5 casos) e o teste de interface.

## P1-T11 — Interface Talhão da fundação

- Catálogo: ficha do produto (identidade, códigos, características) e formulários de admin (identidade, código, característica, remoção de código com motivo).
- Parâmetros: lista pelas definições do registro, com "Pendente" quando não há valor aprovado; formulário com valor JSON tipado.
- Campanhas: detalhe com ICP e declarações (P1-T9).
- Fontes Barlow Condensed, Roboto e IBM Plex Mono servidas do próprio site (OFL 1.1, `@fontsource` 5.3.0; licenças em `public/fonts/LICENSE-*.txt`); `validate-site` confere arquivos e licenças.
- Teste de interface (`npm run test:ui`, Playwright 1.x fora do projeto + Chrome da máquina): cadastro, demanda, gate, catálogo, parâmetros pendentes, edição de ICP, 7 telas e viewport de 390 px sem erros de JS. `npm run check`: 107 testes + 2 workerd/D1.

## P2-T1 — Esquema do piloto nacional

- `0007_piloto_nacional.sql` (a numeração real substitui o "0006" citado no aceite): municípios com fonte/versão; setor→CNAE sem seed; `companies.cnpj_root`; unidades com precisão geográfica; perfil comprador por empresa/unidade/produto; contatos com papel, hash do e-mail e validação com validade; buscas versionadas com partições com lease e candidatos; fichas → versões imutáveis → mensagens com `message_sha256` → aprovação por destinatário e canal; outbox com lease/token; `sender_state` para coordenação por remetente; canais `planned`; respostas IMAP com correlação explícita; tarefas com dono; reuniões; OpenClaw.
- Gatilhos: versão e mensagens da ficha imutáveis; `indeterminate` só sai com resolução registrada (autor e motivo); `accepted` é final; isolamento por tenant nas referências novas; `enabled` exige evidência.
- Testes: `tests/migration-pilot.test.mjs` (6 casos, incluindo banco preenchido antes da 0007); workerd/D1 aplica todas as migrações; banco local migrado (backup antes).

## P2-T2 — Municípios e distância

- Fonte oficial versionada: `scripts/gen-municipios-sql.mjs` gera `0008_seed_municipios.sql` das APIs do IBGE (localidades v1 para nome/UF; malhas v3 para centroide, retângulo envolvente e área), versão `ibge-api-v3-malhas@2026-09-23`, 5.570 municípios. A base `kelvins/municipios-brasileiros` do plano foi descartada: não informa a origem das coordenadas.
- Boa Esperança do Norte/MT (5101837) não tem malha oficial na data: fica fora e registrado no cabeçalho da migração; busca com origem nela responde 422 em vez de coordenada inventada.
- `src/geo.js`: Haversine; municípios com alguma parte dentro do raio pelo retângulo do IBGE (R11.7); classificação: endereço decide pela distância; centroide só vira `confirmed`/`outside` quando o município inteiro está de um lado do raio, senão `estimated`; sem coordenada, `unknown`. Substitui a margem arbitrária de 30 km do plano.
- Efeito de custo registrado: raio de 5 km em Sertãozinho alcança 5 municípios pela borda (mais partições na Casa dos Dados).
- Testes: `tests/geo.test.mjs` (6 casos); suíte 119/119; workerd/D1 aplica a migração de 1 MB.

## P2-T3 — Casa dos Dados e setores usuários

- Contrato lido na documentação oficial (llms.txt → "Pesquisa Avançada de empresas" v5 e esquemas, 2026-09-23). Confirmados: filtros `uf` e `municipio` (nome sem acento em minúsculas), `limite` ≤ 1000, `pagina`, `mei.excluir_optante`; 403 = sem saldo. Achados que o plano não previa: **sem `?tipo_resultado=completo` a resposta não traz endereço**; a resposta **não traz CNAE nem marca de MEI**; traz o quadro societário com nome/CPF de sócios, que o adaptador descarta.
- `src/adapters/casadosdados.js` + `src/adapters/errors.js`: esquema inválido, página incompleta, filtro de município não aplicado, HTML no lugar de JSON, 429/5xx/timeout, 401 e 403 viram erros tipados; nunca lista vazia. Chave só no cabeçalho, fora das mensagens.
- `src/sectors.js` + rotas `/api/sectors`: setor usuário → CNAE (7 dígitos, fonte obrigatória, só admin, auditado). Nada semeado: a lista é decisão de Rogério; setor sem CNAE bloqueia a busca.
- Testes: `tests/casadosdados.test.mjs` (7 casos, fixture na estrutura do esquema oficial).
- **Depende de validação externa:** chamada real com chave e saldo; consumo de saldo por página/resultado e limite de requisições não documentados (medir com o endpoint de saldo na P2-T17).

## P2-T4 — Buscas nacionais versionadas e particionadas

- `src/search.js`, `src/queue.js`, `0009_particoes_por_uf.sql`. Busca exige só campanha nacional ativa (commodity), cidade de origem e raio da lista permitida; nenhum fornecedor é criado (AT15/AT16). Mesma requisição no mesmo dia reaproveita a busca; outro raio cria nova versão com `parent_search_id` e a anterior fica intacta (AT37). Origem e fontes registradas (`source_versions_json`).
- Partições: grupos de até 25 municípios da mesma UF (o filtro `municipio` da Casa dos Dados aceita lista) ou a UF inteira quando todo o estado está no raio. Custo mínimo por busca a partir de Sertãozinho (chamadas antes de páginas extras): 5 km → 1; 100 km → 6; 200 km → 14; 500 km → 59; 1.000 km → 78; 1.500 km → 64 (antes do agrupamento: 1.275 a 1.401).
- Execução: lease atômico no D1 com token de cerca; mensagem repetida ou concorrente não reprocessa; nova tentativa com atraso (`delaySeconds`) até 3 vezes; página seguinte criada de forma idempotente. Sem saldo ou chave recusada encerra as partições pendentes sem gastar chamadas. Fim: `complete`, `partial` com os lugares sem resultado e o motivo (AT67), ou `failed`.
- Empresas por raiz de CNPJ (duas filiais = uma empresa, duas unidades); nome igual com outra raiz não funde (R1.1.4). Endereço já geocodificado não é rebaixado para centroide.
- Candidatos paginados no SQL, ordem por ICP (perfil registrado ou provisório pelo porte, marcado) ou distância com desconhecido no fim.
- Testes: `tests/search.test.mjs` (11 casos). Banco local: 0009 aplicada (versão final reaplicada só no banco de desenvolvimento, sem dados de busca).
- **Depende de validação externa:** limite de nomes por `municipio[]` aceito pela API (usado 25) e consumo de saldo por consulta, na chamada real (P2-T17).
