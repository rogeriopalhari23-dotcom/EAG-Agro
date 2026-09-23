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

## P2-T5 — Geocodificação (LocationIQ)

- Contrato conferido na documentação (forward geocoding e tabela de erros, 2026-09-23): 404 "Unable to geocode" = não encontrado; 429 por segundo/minuto/dia; 403 serviço não habilitado ou acesso restrito.
- `src/adapters/locationiq.js`, `src/geocoding.js`, `0010_geocode_cache.sql`: só unidades sem endereço preciso e com logradouro; cache por SHA-256 de fonte + endereço normalizado (inclusive "não encontrado"); resposta no nível da cidade continua centroide; coordenada fora do Brasil é erro. Plano `paid` grava a coordenada e recalcula distância e situação no raio em todas as buscas da unidade; plano gratuito (ou sem `LOCATIONIQ_PLAN`) só usa o resultado na hora e guarda o cache por 48 h, conforme o direito de armazenamento da página de preços.
- Busca com raio de até 5 km enfileira a geocodificação de todas as unidades encontradas (Fase 4 §7.6); acima, `POST /api/units/:id/geocode` sob demanda. Fila: erro definitivo do provedor é registrado e descartado; temporário volta à fila.
- Testes: `tests/geocoding.test.mjs` (5 casos).
- **Depende de validação externa:** chave e plano contratados (G9 decidiu plano pago), limites reais da conta.

## P2-T6 — Empresas, unidades, perfil comprador, ICP e contatos

- `0011_perfil_comprador.sql`, `src/profiles.js`, mudanças em `src/companies.js` e rotas `/api/companies/:id/profiles`, `PATCH /api/profiles/:id`, `PATCH /api/contacts/:id`.
- CNPJ manual grava a raiz; outra empresa com a mesma raiz é recusada com o id da existente (unidades pela busca). Ficha da empresa mostra unidades e perfis.
- Perfil por empresa + unidade (opcional) + produto (R14.1). `final_consumer_confirmed` exige evidência empresarial válida da própria empresa e da mesma commodity, ou confirmação direta de demanda; evidência de mercado nunca comprova compra (R14.2).
- ICP determinístico (K1/K3): trader → fora; gigante (marcação manual) → fora; porte Receita 01/03 → fora por porte; 05 → no ICP; sem porte → pendente. Ficha: trader só com exceção de gestor com motivo (R14.7); gigante só com relacionamento registrado com autor e data (R14.6); porte desconhecido só com "qualificar o porte" como objetivo da ligação (R14.8).
- Contatos: papel na prospecção (R15.1), hash HMAC do e-mail, validação `pending`, sinal de supressão no cadastro (R2.1.2), fuso IANA validado, sinal de CEO sem relacionamento e de cargo de operação/RH/logística (R15.6). Dados pessoais continuam cifrados.
- Política da fila alinhada ao teste existente da revisão: tipo desconhecido volta à fila (e vai para a DLQ), nunca é confirmado.
- Testes: `tests/profiles.test.mjs` (7 casos); suíte 150/150.

## P2-T7 — Validação de e-mail (Snov.io)

- Contrato conferido na documentação (`https://snov.io/api`, 2026-09-23): token OAuth `client_credentials` (3.600 s, Bearer); `POST /v2/email-verification/start` com até 10 `emails[]` → `task_hash`; `GET /v2/email-verification/result` → `completed`/`in_progress` (e `not_enough_credits`); `smtp_status` valid/not_valid/unknown com `unknown_status_reason` (catchall, banned); limite de 60 requisições/min. O custo em créditos da verificação **não aparece na página** (o "1 crédito" do levantamento anterior não foi confirmado); o sistema conta chamadas por tarefa (`api_calls`).
- `0012_validacao_email.sql`, `src/adapters/snov.js`, `src/email-validation.js`, rotas `POST /api/contacts/:id/validate-email` e `POST /api/companies/:id/validate-emails` (até 10 por tarefa, uma chamada para vários contatos). Token reaproveitado em KV.
- Estados: `pending`, `valid`, `not_valid`, `unknown`, `catchall`, `error`. Só `valid` confirma (G11); formato válido nunca confirma. Prazo: `email_validation_max_age_days:email` (parâmetro novo, sem valor padrão; sem ele a validade fica sem prazo e a interface deve mostrar). Consulta do resultado pela fila com intervalo crescente e no máximo 8 tentativas; depois, `error` registrado. Contato suprimido não é enviado ao provedor. Créditos esgotados viram falha registrada.
- Testes: `tests/email-validation.test.mjs` (5 casos).
- **Depende de validação externa:** credenciais, custo real por verificação e comportamento com endereços internos (P2-T17).

## P2-T8 — Modelos da `/prospeccao-vendas` e revisor PV

- **Bloqueio resolvido nesta máquina:** a skill original está em `~/.claude/skills/prospeccao-vendas/`, com `SKILL.md` de SHA-256 `33bd093f5dcb87a7d4aa51d31597c6d6ddfc637097693e3830a38f9b219f9dd8`, igual ao do T12.
- `src/templates/prospeccao-vendas.js`: textos copiados de `references/scripts-abordagem.md` (E-mails 1, 2 e 4; LinkedIn; ligações L0/L1/L2), com `[SUA EMPRESA]` → EAG Agro e `[COMMODITY]` pelo nome do catálogo. Geração determinística, sem IA. Cadência da tabela de 2 semanas (e-mails nos dias 0, 4, 10 e 14; LinkedIn dia 2; ligações dias 3, 7, 8 e 11).
- Adaptações registradas para decisão de Rogério: **A-E3** texto do E-mail 3 e do influenciador (a skill não traz texto literal); **A-D14** break movido para a segunda da semana 3, porque a tabela da skill põe E-mail 3 e 4 em dias seguidos, contra a regra da própria skill e o R19.2 item 12 (vale o mais restritivo, T12); **A-K6** volume e prova social só com declaração aprovada; **A-PV4** frase de origem pela fonte registrada; **A-R19** assinatura com endereço físico e saída. O roteiro Level 2 do instrutor fala em "preço competitivo" no teste final: fica como guia de ligação, fora do PV7 dos textos automáticos.
- `src/review.js`: PV1–PV12 e R19.13 determinísticos, com achado por passo e destinatário. `scripts/check-skill.mjs` no `npm run check`: hash diferente da skill para a checagem (AT50); sem a skill na máquina (CI), só avisa.
- Amostras para Rogério (R17.6): `docs/implementation/AMOSTRAS-TEXTOS-PV.md` (gerado por `scripts/gen-amostras-pv.mjs`), revisor sem violações. Faltam a amostra interrompida antes do break (envio real) e a internacional em inglês (Plano 3).
- Regressão de higiene: `tests/source-hygiene.test.mjs` recusa caracteres de controle no código (uma edição automatizada tinha gravado backspace no lugar de `\b`; corrigido).
- Testes: `tests/review.test.mjs` (10 casos).

## P2-T9 — Fichas de aprovação

- `src/fichas.js`, `src/unsub-token.js`, rotas `/api/fichas` (criar, listar, ver, `versions`, `approve`, `defer`, `discard`).
- Criação confere: campanha disponível, identidade do produto, OpenClaw retirado (R25.3), perfil com permissão de ficha (K1/K3/R14.6–R14.8), fuso aprovado (R18.6), endereço físico configurado (R19.13), destinatários da empresa com papel válido, e-mail e fora da supressão, ao menos um decisor.
- Versão imutável: contexto congelado cifrado com hash; mensagens cifradas com `message_sha256` dos bytes exatos (assunto + corpo); relatório PV; hash da skill e versões dos modelos. Link de descadastro determinístico por versão + destinatário (HMAC), então o hash aprovado já inclui o link.
- Aprovação por destinatário e canal (errata): gestor envia o hash agregado que viu; conteúdo diferente → 409. Idempotente (AT26). Exige revisão sem violações (R17.3), campanha ativa e na mesma versão (R22.5), canal de e-mail além de `planned` (R26.2). Cria a outbox com as datas da cadência; mesmo e-mail em outra sequência ativa → `waiting_sequence` (R19.8). Pipeline da empresa não muda (AT39).
- Nova versão (edição de texto, troca de destinatários, regeneração): anterior marcada como substituída, aprovações invalidadas, envios não aceitos → `superseded`; na nova aprovação, as linhas substituídas são reaproveitadas e o passo já aceito fica intacto.
- Mudança comercial invalida aprovação e bloqueia envios pendentes (`approval_invalidated`): ICP da campanha, declaração aprovada ou revogada, papel do contato.
- Testes: `tests/fichas.test.mjs` (8 casos).

## P2-T12 — Descadastro público de um clique

- `src/unsubscribe.js`, rota `/u/:token` antes da autenticação e da checagem de origem; `wrangler.jsonc`: `/u/*` em `run_worker_first` e limitador `UNSUB_LIMITER` (20 por 60 s por token, conforme a doc de Rate Limiting). Build de teste (`wrangler deploy --dry-run`) confirmou o binding.
- Token HMAC da P2-T9 verificado em tempo constante; inválido → 404 genérico. `GET` só confirma (robôs de segurança abrem links); `POST` do botão ou one-click RFC 8058 suprime pelo hash do e-mail já existente (sem decifrar PII), cancela os envios futuros e as tarefas do contato, sem despedida (R21.6), idempotente (AT35). Página sem dado pessoal, com CSP própria restritiva (o Worker agora preserva CSP definida pela resposta), bilíngue.
- `docs/OPERACAO.md`: passo humano do Access (bypass só para `/u/*`), segredos e parâmetros do piloto, e a liberação dos adaptadores como portão humano (o `validate-deploy` recusa `queues`/`triggers`).
- Testes: `tests/unsubscribe.test.mjs` (5 casos).
- **Depende de validação externa:** aplicação do Access com bypass e teste sem login no domínio real.

## P2-T16 — Sanções pré-envio (parcial)

- `src/sanctions.js`, `complianceStatus` em `src/scores.js`, rotas `/api/sanctions/*`, `/api/companies/:id/screening`, `/api/screening-matches/:id/decisions`.
- Fontes: cadastro, listagem e ativação só pelo admin com motivo (a 0.3.1 já semeia OFAC SDN, CGU CEIS e CGU CNEP ativas). Importação por versão em lotes de até 300 registros (limite de 64 KB), com hash do arquivo oficial e contagem declarada; contagem diferente → versão `failed` (lista parcial nunca vale).
- Triagem contra a versão importada mais recente de **todas** as fontes ativas (errata item 5): nome normalizado (sem acento, pontuação e sufixo societário) → revisão (AT8); identificador oficial + país compatível → bloqueio (AT9). Decisão humana auditada (falso positivo, bloqueio confirmado, continuar revisando, alerta de integridade). Lista nova torna a triagem anterior desatualizada.
- `complianceStatus` para o pré-envio: `clear`, `review`, `blocked` ou `unavailable` (sem política, sem lista, sem triagem ou triagem vencida → nunca liberação; R19.3).
- Testes: `tests/sanctions.test.mjs` (7 casos).
- **Bloqueio:** política T11 (quais fontes e validade) e leitores dos arquivos oficiais de cada fonte escolhida (formatos OFAC/CGU). Até lá, nenhuma empresa passa no pré-envio.
