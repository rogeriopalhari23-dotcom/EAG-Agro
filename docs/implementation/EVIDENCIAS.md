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

## P2-T10 — Envio pela Hostinger (agendador, pré-envio, rampa, idempotência)

- `src/sending.js`, `src/adapters/mailbox.js` (`worker-mailer@1.2.1`, MIT, sem dependências; instalado com versão exata; importação dinâmica porque usa `cloudflare:sockets`), `src/timezone.js`, rotas `GET /api/sending/today` e `POST /api/sending/outbox/:id/resolve`, `scheduled` (5 min: `tick`; diário: `evaluateRamp`). O cron continua **fora** do `wrangler.jsonc` pelo portão do `validate-deploy`.
- Lease do remetente em D1 (`sender_state`) com token; no máximo um envio por execução; teto diário do remetente (soma dos mercados) pela rampa; intervalo aleatório entre o mínimo e o máximo do parâmetro; janela no fuso do destinatário.
- Pré-envio R19.2: supressão (cancela), pausas de operação/campanha/empresa/commodity, campanha e identidade do produto, OpenClaw, triagem de sanções (indisponível segura, AT28), aprovação vigente da versão corrente, e-mail validado e no prazo (AT52), canal habilitado ou teste interno só para `INTERNAL_TEST_RECIPIENTS` (R26.2), nenhum e-mail ao mesmo endereço no dia ou no dia anterior no fuso dele (AT53), data do passo.
- Texto enviado = texto aprovado: decifrado e conferido contra o hash da mensagem e da outbox antes do envio; diferença bloqueia (`content_mismatch`) (AT25). Cabeçalhos `Message-ID` estável, `List-Unsubscribe` e `List-Unsubscribe-Post` (R21.10).
- Resultado: aceito → contagem e próximo horário; 4xx → nova tentativa (até 3); 5xx → `perm_failed`, supressão por bounce e cancelamento do resto (R19.7); resposta não confirmada ou lease vencido → `indeterminate`, **nunca reenviado sem resolução humana** com evidência (gatilho no banco; AT27). Parada automática por hard bounce ≥ limite ou aviso do provedor cria pausa de operação; só a retomada da operação libera (AT69). Subida de degrau após 14 dias com bounce abaixo do limite.
- Harness do workerd: `cloudflare:*` externo no esbuild (como o wrangler). `wrangler deploy --dry-run`: 312 KiB.
- Testes: `tests/sending.test.mjs` (11 casos, com transporte SMTP falso; nenhum e-mail real enviado).
- **Depende de validação externa:** caixa Hostinger real (porta 465, autenticação), mensagens de erro reais do servidor para calibrar 4xx/5xx, teste interno de T1 (P2-T17).

## P2-T13 — Pausas e mudanças comerciais em todos os canais

- `src/restrictions.js` (motivos comuns a envio e tarefas manuais), pausa de commodity pausa as campanhas de todas as variantes (retomar exige reativar cada campanha, R22.3), `src/changes.js`: descarte de empresa (cancela envios, tarefas e fichas, mantém histórico, R23.4) e exclusão de dados pessoais do contato (apaga campos cifrados, mantém o hash para a supressão, auditoria sem PII, aviso sobre a janela de recuperação do D1; R23.5–R23.6). Retomada da operação limpa a parada automática.
- Testes: casos P2-T13 em `tests/sending.test.mjs`.

## P2-T11 — Respostas por IMAP e pausa por resposta

- **Desvio registrado da Fase 4:** em vez do `imapflow` (8 dependências, compatibilidade Node no Worker inteiro), um cliente IMAP só de leitura sobre `cloudflare:sockets` (`src/adapters/imap.js`: LOGIN, EXAMINE, UID SEARCH, UID FETCH `BODY.PEEK[]<0.262144>`, LOGOUT; RFC 9051) e um leitor MIME mínimo (`src/mime.js`: cabeçalhos com dobra e RFC 2047, text/plain em quoted-printable/base64, relatório RFC 3464). Nenhuma dependência nova. `EXAMINE` e `BODY.PEEK` não marcam mensagens como lidas.
- `src/inbound.js`, `0013_cursor_caixa.sql`, `GET /api/inbound` (sem corpo), `scheduled` de 5 min lê a caixa antes de enviar.
- Chave estável caixa + UIDVALIDITY + UID (duplicata não repete efeito); cursor com lease; UIDVALIDITY novo recomeça sem duplicar. `.eml` bruto só é guardado se houver R2 configurado.
- Classificação: bounce 5.x.x/4.x.x, alerta do provedor (Hostinger), resposta automática (Auto-Submitted, X-Autoreply, assunto de ausência), descadastro nas primeiras linhas escritas (citação ignorada; pt e en), humana, ilegível. Correlação: `In-Reply-To`/`References` com o Message-ID do envio; sem thread, pelo remetente com passo aceito nos últimos 60 dias; mais de uma empresa/commodity → `ambiguous` e todas pausadas com tarefa de revisão (errata item 7).
- Efeitos: humana, automática (B1 pendente) e ilegível pausam empresa + commodity em todos os passos, canais e contatos, suspendem ligações/LinkedIn e abrem tarefa (AT29, AT30, AT36); outra commodity da mesma empresa só recebe alerta (R20.5); "sair" suprime antes de tudo, sem despedida (AT31); pedido de preço traz a orientação fixa da skill (AT58); bounce 5.x.x suprime e cancela; alerta do provedor para a operação (R19.12). Nenhuma resposta automática é enviada.
- Testes: `tests/inbound.test.mjs` (11 casos) e helper `tests/helpers/pilot.mjs`. Suíte 208/208 + 2 workerd/D1.
- **Depende de validação externa:** login e leitura reais em `imap.hostinger.com:993`, formato real dos avisos da Hostinger e dos DSN.

## P2-T14 — Tarefas manuais, reuniões, retorno e linha do tempo

- `src/tasks.js`; rotas `GET /api/tasks`, `POST /api/tasks/:id/complete`, `POST /api/companies/:id/level0`, `POST /api/meetings`, `GET /api/companies/:id/timeline`, `GET /api/dashboard/funnel`.
- Aprovar o canal de ligação ou LinkedIn da ficha cria as tarefas com o roteiro congelado e as datas da cadência (dias 3, 7, 8 e 11 para ligações; 2 para LinkedIn), com dono. Roteiro com nome do contato gravado cifrado e decifrado só na listagem autenticada.
- Lista do dia: respostas e confirmações primeiro; ligações dos piores leads para os melhores (skill, R28.8); cada tarefa manual mostra os bloqueios das restrições comuns. Conclusão sempre humana; tarefa suspensa ou bloqueada (pausa, supressão, triagem) não conclui (errata item 6); as 3 perguntas da Level 2 ficam registradas com método e data (R3.1.5); volume em texto é recusado.
- Resposta suspende as ligações da empresa+commodity (AT65). Break aceito cria "retorno sugerido" no ciclo do ICP ou em 182 dias, sem sequência automática (R28.11, R17.7, AT56). Reunião cria confirmação para a manhã do dia (R28.10). Level 0 com o roteiro da skill quando não há e-mail do decisor (R28.6).
- Linha do tempo (auditoria, envios, respostas, tarefas, reuniões) e funil prospectadas → reuniões → negócios, sem dado pessoal.
- Testes: `tests/tasks.test.mjs` (5 casos).

## P2-T15 — Migração do OpenClaw (parcial)

- `src/openclaw.js`, rotas `/api/openclaw/*`, formato normalizado em `docs/OPERACAO.md`. Duas fases obrigatórias: todas as supressões primeiro (contatos antes disso → 409), depois empresas e contatos em lotes; dedup por raiz de CNPJ e hash do e-mail; sem CNPJ com nome existente → pendência, não fusão (R1.1.4). Relatório de conflitos (suprimido marcado ativo, e-mail em outra empresa, descadastrado fora da fase, sem CNPJ). Empresa `ativo` registra transferência pendente, que bloqueia ficha e envio até a retirada ser comprovada com evidência (R25.3, AT34). Reimportação não remove supressão; arquivo repetido (mesmo SHA-256) é recusado.
- Testes: `tests/openclaw.test.mjs` (3 casos).
- **Bloqueio:** exportação real do OpenClaw para escrever o conversor e o inventário do executor antigo para comprovar o corte.

## P2-T17 — Canais, teste interno de T1 e liberação (externo)

- `src/channels.js`, rotas `GET /api/channels` e `POST /api/channels/:canal/state` (só admin; `enabled` exige referência ao registro de T1; WhatsApp e LinkedIn não podem sair de `planned`). Testes: `tests/channels.test.mjs` (2 casos).
- Roteiro humano em `docs/eag-compass-t1-validacao.md` (pré-requisitos, 13 passos, seção de liberação). Estado: não iniciado. Nenhum envio real foi feito nesta sessão.

## P2-T18 — Telas do piloto

- `public/app.js`: telas **Radar** (busca por campanha e raio aprovado, versões, cobertura e nota de parcialidade, candidatos ordenados por ICP ou distância com base da distância explícita — centro do município é estimativa —, "tentar de novo" para parciais, setores → CNAE com cadastro pelo admin), **Fichas** (versões, achados do revisor PV, mensagens por destinatário e canal com nome e papel, aprovação por destinatário+canal enviando o hash das mensagens mostradas, envios da ficha, nova versão, adiar, descartar), **Envios** (estado do canal, degrau da rampa, teto do dia, próximo horário, parada automática, fila com motivo de bloqueio, resolução de indeterminado só pelo admin com evidência, respostas recebidas sem corpo) e **Tarefas** (roteiro, bloqueios das restrições comuns, resultado e as 3 perguntas da Level 2).
- Tela da empresa: unidades (CNPJ, município, precisão da localização, porte), perfil comprador e ICP por commodity com motivo do bloqueio da ficha, exceção de trader (aprovador), relacionamento com gigante, meta de porte na ligação, registro de perfil, validação de e-mails e geração de ficha (campanha + destinatários). Contato mostra papel, validação do e-mail e sinal de cargo fora do alvo.
- Nenhuma tela envia ou simula envio: o envio só acontece pelo cron com o canal liberado.
- Estados de erro e parcial: erro de carga mostra "Tentar novamente"; busca parcial mostra a cobertura; ficha com violação esconde o botão de aprovar.
- Teste: `tests/ui-smoke.mjs` ampliado com o cenário do piloto (Radar, Fichas, Envios, Tarefas, ficha aberta com aprovação e revisor, `send_log` vazio, 11 telas, 390 px sem rolagem horizontal, sem erro JS). `npm run check`: 218/218 + 2 workerd/D1.

## P3-T1 — Esquema da lista mensal e do internacional (parcial: D1/D2)

- `migrations/0014_internacional.sql` (numeração real; o plano chamava de 0009): `countries` (com `iso2` de tabela oficial e `source_version`), `country_mdic_codes`, `trade_list_versions`, `trade_list_status`, `trade_list_current` (com `revision` para CAS), `trade_list_jobs` (lease, fencing token, `next_attempt_at`, resultado por chave e hash — errata itens 4–6), `provider_budget` (reserva diária atômica — errata item 6), `trade_list_manual_refresh`, `country_analyses` (guarda as chaves R2 lidas, para a poda protegê-las — errata item 10), `commodity_selections`, `commercial_validations`, `company_conditions` (confirmada exige evidência; não encontrada exige nota); colunas `companies.size_*`, `campaigns.analysis_id/selection_id`. `contacts.timezone` já existia (0007).
- Parâmetros no registro tipado, **sem valor semeado** (R7.1.1): `agri_classification` (tipo `classification`), `trade_list_mdic_years`, `trade_list_comtrade_years`, `comtrade_calls_per_day`, `trade_list_retention_versions`, `international_enabled` (tipo `release`: liberar exige `evidenceRef` para `docs/…#…`). `period_default_months:international` e `country_list_refresh_day:international` já existiam.
- Testes: `tests/migration-international.test.mjs` (4 casos). Migrações aplicadas no D1 local após cópia em `eag-compass-backups/d1-local-20260924-090054`.
- **Portão humano:** Rogério aprova D1 (período padrão 12 meses) e D2 (`{"version":"sh-01-24@2026-09-23","chapters":["01",…,"24" sem "03"],"excluded":["03"]}`) e os valores de rotina propostos no Plano 3 (MDIC 2 anos, Comtrade 3 anos, 400 chamadas/dia, 3 versões guardadas). Sem eles a rotina mensal não começa.

## P3-T2 — Países com os códigos das duas fontes

- `scripts/gen-paises-sql.mjs` → `migrations/0015_seed_paises.sql` (gerado em 2026-09-24 das URLs oficiais; PAIS.csv `Last-Modified: Fri, 04 Sep 2026 18:06:01 GMT`). 250 países (Brasil e "Não Definido" fora); 32 só no MDIC (territórios, códigos históricos e Taiwan, que não declara à Comtrade); 0 só na Comtrade; 11 com mais de um código MDIC — ARE (Dubai), DEU (Alemanha Oriental), ESP (Alboran, Canárias), GBR (Jersey, Inglaterra, Antártico), GGY, KNA, MYS (Labuan), PNG, PRT (Madeira), UMI, USA (Johnston, Wake) — **para Rogério conferir**: as exportações do Brasil ao país somam todos os códigos.
- Nome do país: entrada do MDIC cujo ISO numérico é o M49 oficial, depois nome inglês igual ao da ONU, depois sem qualificador — a regra "menor código" escolhia Jersey para o Reino Unido e foi descartada.
- ISO-2 (para ligar às empresas e campanhas, que usam duas letras) vem de `Reporters.json` e, para quem não declara, de `partnerAreas.json` — nunca por truncamento (errata item 13). Sem ISO-2: ANT, CSK, GLP, GUF, PCZ, REU, SCG, VIR, YMD (históricos ou departamentos franceses); esses países não recebem campanha.
- Idioma `pt-BR`: AGO, CPV, GNB, MOZ, PRT, STP, TLS. Guiné Equatorial (CPLP) fica em inglês — a conferir por Rogério.
- Testes: `tests/countries.test.mjs` (5 casos: EUA 842 + 249/396/873, Alemanha 276 e não 280, acentos windows-1252, Reino Unido/Espanha pelo nome certo, cabeçalho diferente recusado, duas entradas ativas param a geração).
- **Risco para a T12 (comprovado):** `balanca.economia.gov.br` entrega só o certificado folha (sem o intermediário Sectigo "Public Server Authentication CA OV R36"); `openssl` retorna `Verify return code: 21` e o Node recusa (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) sem `--use-system-ca`. HTTP redireciona para HTTPS. Se o `fetch` do Worker também recusar, a fonte MDIC não funciona pelo Worker e o item volta à Fase 4 (Plano 3 T12 passo 4).

## P3-T3 — Arquivo completo do MDIC por pedaços

- `src/adapters/mdic-bulk.js`: `headYear` (tamanho, ETag, Last-Modified; 404 = ano não publicado), `chunkRanges` (8 MiB), `processChunk`, `linesOf`, `aggregate`, `loadNcmTable`.
- Errata item 1 (fronteira): pede-se o byte anterior ao início do pedaço; a linha em curso só é descartada quando esse byte não é LF. Última linha sem LF é lida; linha maior que a margem de 64 KB → erro `line_too_long` (nunca truncamento).
- Errata item 2 (versão consistente): cada pedaço exige 206, `Content-Range` com o intervalo pedido e o tamanho registrado, e ETag/Last-Modified iguais aos do início; diferença → `source_changed` (a rotina refaz o ano inteiro). Servidor que ignora Range → `range_unsupported` (o arquivo nunca é baixado inteiro).
- Errata item 3 (memória): o agregado de um pedaço real de 128 KB tinha ~600 chaves para ~1.950 linhas (o arquivo não é ordenado por país); estimativa para 8 MiB: ~36 mil chaves (~2 MB de JSON). `limits.cpu_ms` **não** foi alterado: sem medição no workerd não se presume que resolva algo (medir na T12).
- Métricas: `VL_FOB` e `KG_LIQUIDO` somados; `QT_ESTAT` vazio fica nulo (não vira zero). Só capítulos da classificação vigente, por prefixo de texto.
- Conexão cortada no meio do corpo → erro temporário (observado duas vezes na `NCM.csv` real: `TypeError: terminated`).
- Testes: `tests/mdic-bulk.test.mjs` (9 casos), incluindo a propriedade "soma dos pedaços = arquivo inteiro" para todos os tamanhos de pedaço de 1 byte ao arquivo inteiro, com LF, CRLF e sem LF final.
- **Leitura real (rede doméstica, 2026-09-24, só leitura):** `EXP_2026.csv` → 75.055.366 bytes, ETag `"4794106-65aac1ebd8ade"`, `Last-Modified: Fri, 04 Sep 2026 18:05:56 GMT`, 9 pedaços de 8 MiB; pedaços 0 e 1 de 128 KB lidos por Range (206) com cabeçalho conferido, 1.949 + 1.963 linhas, sem perda nem duplicação na fronteira. `NCM.csv` lida uma vez completa (açúcar 17011400 → SH6 170114, "Outros açúcares de cana"); nas outras duas tentativas a conexão caiu.
- **Depende de validação externa (T12):** leitura pelo Worker (certificado incompleto do servidor, ver P3-T2) e o tempo de CPU por pedaço no workerd.

## P3-T4 — Adaptador da Comtrade

- `src/adapters/comtrade.js`: `loadHsBlocks`, `availableYears`, `fetchImports`, `redact`.
- Chave (`COMTRADE_KEY`) no cabeçalho `Ocp-Apim-Subscription-Key` do gateway, nunca na URL (errata item 11); corpo bruto de falha nunca é registrado; `redact` cobre qualquer URL com `subscription-key`.
- Filtros de total pedidos explicitamente (`partner2Code=0`, `customsCode=C00`, `motCode=0`) e conferidos linha a linha; linha fora do filtro → `filter_not_applied`; duas linhas na mesma chave SH6×ano×origem → `ambiguous_totals` (nunca soma às cegas).
- `count` no limite de 100 mil → `truncated`; `count` diferente das linhas → `incomplete` (errata item 7). Zero declarado em `netWgt` é preservado com o indicador de estimativa; ausência fica nula.
- CIF marcado (`basis: "CIF"`); sem CIF, `primaryValue` com `basis: "primary"` — nunca rotulado FOB.
- Testes: `tests/comtrade.test.mjs` (7 casos).
- **Leitura real sem chave (2026-09-24):** `getDA/C/A/HS?reporterCode=276` → `{elapsedTime,count,data,error}`, `period` numérico, Alemanha com anos 1991–2025; China também respondeu. `HS.json` → 894 SH6 nos capítulos 01–24 sem o 03, em 3 blocos de 298 códigos (2.085 caracteres cada), igual a T6 §8.
- **Hipóteses a confirmar com a chave real (T12 passo 3):** `period` e `partnerCode` com lista; os valores de total de `partner2Code`/`customsCode`/`motCode`; cabeçalho da chave aceito; orçamento de 3 chamadas por país. Até lá é só fixture — não é validação do provedor.

## P3-T5 — Rotina mensal, versões e atualização manual

- `src/trade-list.js`; fila `trade_job` em `src/queue.js`; cron diário `17 2 * * *` chama `daily` (começa a versão do mês a partir de `country_list_refresh_day`, retoma a que está rodando e varre jobs) — não foi criado cron novo; rotas `GET /api/countries`, `GET /api/trade-list/versions`, `POST /api/trade-list/run` (admin, motivo; T12 passo 5), `POST /api/trade-list/refresh/:iso3` (admin, 1 por dia por país, R12.15), `POST /api/trade-list/versions/:id/resume` (admin, depois de corrigir a chave).
- Errata aplicada:
  - item 4: job adquirido por lease com token; tudo o que o job grava em D1 é condicionado ao próprio token no mesmo batch (fencing); resultados em chaves R2 determinísticas; mensagem duplicada ou lease perdido não altera totais (teste).
  - item 5: versão existente é retomada (jobs com `INSERT OR IGNORE` por chave única); transições derivadas do estado (`advance`), então queda entre criar a versão e os jobs, ou durante a consolidação, se recupera na próxima varredura (teste).
  - item 6: orçamento diário persistente (`provider_budget`, reserva atômica antes de cada chamada à Comtrade, inclusive HS.json e getDA); esgotado → `next_attempt_at` no dia seguinte, sem mensagem esperando na fila (teste com teto 5/dia em 4 dias).
  - item 2: arquivo do MDIC republicado no meio da leitura → geração nova do ano, pedaços antigos `superseded`, no máximo 3 gerações (teste).
  - item 9: atualização manual reaproveita o agregado MDIC vigente quando tamanho/ETag/Last-Modified não mudaram (nenhum pedaço relido — teste); senão relê o ano só para o país.
  - item 10: poda guarda as N versões mais novas e, das antigas, tudo o que `trade_list_current` ou `country_analyses` referencia (teste).
- Ponteiro por CAS monotônico (versão que começou antes nunca sobrescreve a mais nova); só avança para fonte completa (`purchase_identified`, `no_record`, `not_declared`). Falha → `data_unavailable` "não atualizada em <mês>", ponteiro anterior e objeto anterior preservados; `GET /api/countries` marca `*_stale` (teste AT72).
- MDIC: junção em 4 grupos de países (memória limitada a ~1/4 do agregado); CO_PAIS de um país somados; CO_PAIS sem país no cadastro anotado na versão. País sem código numa fonte → `data_unavailable` "país sem código nesta fonte" (não conta como falha).
- Comtrade sem chave → rotina da Comtrade bloqueada com motivo `no_key`, MDIC completa, versão `partial`.
- Auditoria: início e fechamento com contagens por estado, chamadas à Comtrade e jobs com falha (R13.5). Staging apagado ao fechar.
- Testes: `tests/trade-list.test.mjs` (10 casos) com `tests/helpers/trade.mjs` (R2 em memória com cursor estável, fontes simuladas, condutor da fila). Suíte: 253/253 + 2 workerd/D1.
- **Portões humanos:** bucket R2 e binding `FILES`, fila/DLQ e cron (bloqueados por `validate-deploy` até liberação); `COMTRADE_KEY`; parâmetros D1/D2 e da rotina. Nada disso foi criado nesta sessão.

## P3-T6 — Análise de país a partir da lista

- `src/country-analysis.js`; rotas `POST /api/country-analyses` (`{iso3, periodMonths?}`) e `GET /api/country-analyses/:id`.
- Lê só os objetos do R2 apontados por `trade_list_current` (teste com `fetch` global que falha se chamado — AT71); grava as versões e as chaves R2 usadas (a poda as protege) e o SHA-256 da parte vinda da lista; `GET` reproduz dos mesmos objetos e informa `reproduced` (R8.2, errata item 10). A correspondência com o catálogo fica fora do hash (muda com o cadastro).
- Por SH6, lado a lado e sem soma (AT74, R12.13): "Compras declaradas pelo país (CIF, anual)" com todas as origens, Brasil e parte do Brasil do mesmo ano e mesma base; "Exportações do Brasil (FOB, mensal)" na janela de N meses que termina no último mês publicado do arquivo, com as NCM de 8 dígitos como detalhe, última ocorrência e quantidade estatística por unidade (mais de uma unidade = `qtyInconsistent`, nunca somada).
- Parte do Brasil desconhecida (nula, com motivo) quando falta a linha de todas as origens ou a do Brasil, bases diferentes, ou total zero/ausente — nunca divisão infinita (errata item 8). Brasil declarado 0 → parte 0.
- Estados R12.6: `compra identificada`, `nenhum registro no período`, `dados indisponíveis`; país que não declara à Comtrade → "sem declaração do país à fonte"; país atrasado → "sem declaração do país desde <ano>" com o último ano e os anos guardados, medido contra o mês da versão (AT73); versão anterior à última rotina → "não atualizado em <mês>" (AT72).
- Catálogo: código `confirmed` destaca a correspondência; `pending` aparece só como pendente (AT22). Várias variantes na mesma linha não duplicam o agregado.
- Aviso literal de R1.4.2 na resposta. Nada é gravado em empresas, evidências, condições ou scores (AT23, teste).
- Período padrão exige `period_default_months:international` aprovado (D1) ou período explícito (1–60).
- Testes: `tests/country-analysis.test.mjs` (8 casos).

## P3-T7 — Seleção de commodities e campanhas

- `src/selections.js`; rotas `POST|GET /api/country-analyses/:id/selections` (gestores) e `POST /api/commercial-validations` (admin).
- Checagem de lista **no serviço** (errata item 12, R12.14, AT75): cada item só entra se **todas** as suas subposições SH6 estiverem na análise com compra identificada; a análise precisa ter ao menos uma fonte `compra identificada` e reproduzir o hash (lista não mudou).
- Seleção gravada antes das campanhas, no mesmo batch; cada item gera campanha `international` em rascunho com `country_code` = ISO-2 oficial, idioma do país, `analysis_id` e `selection_id` (R12.7, R12.8). País sem ISO-2 não recebe campanha.
- Item exige produto do catálogo (novo = cadastrar antes com identidade pendente). Validação comercial obrigatória quando o produto não está confirmado ou não corresponde à linha por código confirmado; sem `approved`, a ativação e a geração de ficha recusam com `commercial_validation_pending` (R12.9). Produto com identidade pendente não ativa mesmo validado (errata item 12).
- Trava comum `internationalGate` na ativação de campanha e na geração/aprovação de ficha: campanha internacional criada fora da seleção não ativa (`selection_required`).
- Aprovação de ficha internacional exige `international_enabled` com evidência (T12); ausência do parâmetro não libera.
- Limite de 2 commodities ativas por mercado reaproveitado do Plano 1 (terceira fica `waiting`; nacionais não contam — teste).
- Testes: `tests/selections.test.mjs` (7 casos).

## P3-T8 — Empresas no exterior e condições R12.10

- `src/foreign-companies.js`; rotas `POST /api/foreign-companies`, `PUT /api/companies/:id/conditions/:productId/:condition`, `PATCH /api/companies/:id/size`.
- Empresa só a partir de campanha internacional com seleção (R12.14); país pelo ISO-2 oficial da campanha. Mesmo registro no país = mesma empresa (só garante as condições da commodity); sem registro, nome normalizado igual (sem acentos e sufixos societários) → 409 `possible_duplicate` com os candidatos, e só cria com `confirmDistinct` — pendência, nunca fusão.
- Três condições nascem `pending`. `confirmed` exige evidência da mesma empresa, categoria diferente de `market` (dado de país nunca confirma — AT23, R1.4.3), `validation_status='valid'` e `metadata.supports` com o nome da condição (R13.4); `not_found` exige nota. Evidência de uma condição não confirma outra (teste).
- Porte no exterior por faixa com fonte (gestores): refaz o ICP dos perfis — médio/médio-mais → no ICP; pequena → fora; gigante → fora (relacionamento prévio como no Plano 2).
- Fuso do contato validado por `Intl` (já existia no `PATCH /api/contacts/:id`; teste com "Europe/Berlim").
- Camada 2: links de pesquisa montados (Google, LinkedIn), nunca executados; sem raspagem e sem fonte nominal paga (R13.7).
- Testes: `tests/foreign-companies.test.mjs` (6 casos).

## P3-T9 — Modelos em inglês e revisor PV em inglês (parcial: aprovação da tradução)

- `src/templates/prospeccao-vendas-en.js` (`pv-en-1.0.0`): tradução frase a frase dos blocos em português (E-mails 1–4, influenciador, LinkedIn, roteiros L1/L2 e Level 0), mesma cadência, passos, canais e objetivos (teste de estrutura idêntica). Assunto `<Commodity> supplier`; assinatura com endereço e `To stop receiving these messages, reply "unsubscribe" or use this link: <URL>`. A skill só diz que o internacional é "o mesmo processo, em inglês" — nada foi inventado além da tradução.
- A-EN1: prova social declarada (texto em português) não entra no texto em inglês. Nomes das commodities em inglês por termo de mercado; commodity sem nome (CSO) → ficha não é gerada.
- `src/review.js` bilíngue: regras por idioma, com as do Plano 3 para o inglês (PV1, PV7, PV9 — aceitando sigla como DDGS —, PV10, R19.13 com "unsubscribe"). PV12: ficha internacional exige a lacuna 🔴 de R28.15 registrada e, em inglês, a tradução aprovada.
- `src/fichas.js`: idioma da campanha escolhe modelo e revisor (Portugal e demais lusófonos em português); versão dos modelos gravada na ficha; nota da lacuna no snapshot.
- Correção no português: sigla preservada no nome da commodity ("DDGS", antes saía "dDGS").
- Portão de tradução: parâmetro `templates_en_approved` no escopo `pv-en-1.0.0` (tipo `release`, exige `evidenceRef`); sem ele, PV12 reprova e a ficha em inglês não é aprovada.
- `scripts/amostras-en.mjs` → `docs/implementation/AMOSTRAS-TEXTOS-EN.md` (português e inglês lado a lado, com as decisões a conferir).
- Testes: `tests/review-en.test.mjs` (7 casos: sequência padrão passa, estrutura igual à do português, AT24 "competitive price", AT55 "70% of manufacturers", PV10, volume sem declaração, PV12 sem lacuna ou sem aprovação, nomes e siglas).
- **Portão humano:** Rogério aprova a tradução lado a lado; só então o admin grava `templates_en_approved`.

## P3-T10 — Envio, respostas e descadastro no fuso e idioma do destinatário

- `src/sending.js`: janela `send_window:<mercado da campanha>` no fuso do destinatário; internacional só envia com `international_enabled` vigente (revogar segura envios já aprovados — `international_not_enabled`) e com fuso do contato (`timezone_pending`); "dia civil anterior" no fuso do contato (já existia); teto diário do remetente contado no dia de São Paulo e somando os dois mercados (teste). Feriados por país não são tratados (limitação declarada no plano).
- `src/fichas.js` (P3-T9/T10): ficha internacional exige fuso de cada destinatário (R18.6; já recusava na geração); nacional continua usando o fuso do mercado.
- `src/inbound.js`: pedido de preço em inglês inclui "proposal" e "presentation" (o resto — unsubscribe/remove me/stop/opt out/take me off, Automatic reply/Out of Office/OOO, price/pricing/quote/quotation/catalog — já existia).
- `src/unsubscribe.js`: todas as páginas de `/u/*` com a frase em inglês e botão "Confirmar descadastro · Unsubscribe"; sem dado pessoal.
- Testes: `tests/international-send.test.mjs` (6 casos de ponta a ponta com a campanha nascida de seleção: sem fuso não gera; ficha em inglês com lacuna e PV12 aguardando a tradução; internacional desligado não aprova (T12); liberado envia só às 10h de Tóquio e não às 22h; revogação segura o envio; Portugal em português; teto único somando mercados; respostas em inglês classificadas).

## P3-T11 — Interface Internacional e Lista mensal

- `public/app.js`: tela **Internacional** (`data-screen="internacional"`): aviso de R1.4.2 fixo; busca de país; estado das duas fontes com "não atualizado em <mês>"; "Analisar" cria a análise só da lista guardada; cadastro de importador de campanha internacional com os links de pesquisa montados (abertos só pela pessoa); painel "Análises, seleções e campanhas" (R24.1/R24.3 — o que cada análise originou).
- **Análise**: dois cartões (Compras declaradas pelo país — CIF, anual; Exportações do Brasil — FOB, mensal) com estado, versão, anos guardados, janela e "sem declaração desde"; tabela por SH6 lado a lado, sem coluna de soma; parte do Brasil em % ou "desconhecida (motivo)"; quantidade estatística inconsistente marcada; "No catálogo EAG" só para código confirmado, "código pendente" para pendente; só linhas com compra identificada têm caixa de seleção; "Escolher commodities" junta linhas do mesmo produto em um item e cria as campanhas (avisa validação comercial e espera da 3ª).
- **Lista mensal**: versões com contagens por estado e fonte, jobs, notas, bloqueio da Comtrade com "Retomar", chamadas do dia; admin roda a rotina do mês ou atualiza um país, sempre com motivo.
- **Empresa no exterior** (tela da empresa): condições R12.10 por commodity com estado e evidência, formulário que só lista evidências que não são de mercado; porte com fonte (gestores). `GET /api/companies/:id` passa a trazer `conditions`; `GET /api/country-analyses` lista as análises.
- Nome da subposição da Comtrade (HS.json oficial) guardado no objeto consolidado do país.
- Texto da tela Hoje atualizado para o estado real (antes dizia que nada estava implementado).
- `scripts/validate-site.mjs` exige `data-screen="internacional"`, `/api/country-analyses`, `/api/trade-list/versions` e `/api/foreign-companies` no `app.js` publicado.
- `tests/ui-smoke.mjs`: lista gerada com fontes simuladas → Internacional → busca "Alemanha" → análise com aviso e "parte do Brasil 30.0%" → seleção do café pela tela → campanha internacional com seleção e país DE → Lista mensal; 13 telas; Internacional sem rolagem horizontal em 390 px (a tabela rola dentro da própria caixa); sem erro JS. Capturas em `review-output/` (ignorado pelo git).

## P2-T16 — Leitores dos arquivos oficiais (continuação, 2026-09-24)

- `src/sanctions-parsers.js`: CSV com aspas (RFC 4180, quebra de linha dentro de campo, aspas dobradas, marca de fim `\x1A`); `parseOfac` (SDN.CSV 12 colunas sem cabeçalho + ALT.CSV 5 colunas; `-0-` = nulo); `parseCgu` (CEIS/CNEP do Portal da Transparência, `;`, windows-1252, cabeçalho conferido por nome); `batches` (≤ 300 registros e < 60 KB por lote).
- `scripts/import-sanctions.mjs --list ofac|ceis|cnep --base <url>`: baixa o arquivo oficial (ou lê de `--dir`), calcula o SHA-256 do arquivo, lê o ZIP do Portal (um CSV, deflate), abre a versão com a contagem, envia os lotes e fecha; contagem diferente → versão `failed`. Produção: `CF_ACCESS_TOKEN=$(cloudflared access token -app=<url>)` (cookie `CF_Authorization` da sessão do admin; o Access exige e-mail, então token de serviço não serve).
- Decisões: número da OFAC (`ent_num`) fica em `raw`, nunca como identificador — OFAC casa por nome e vai para revisão; CNPJ de 14 dígitos da CGU é identificador oficial com país BR — casamento exato bloqueia (teste). Pessoas físicas ficam fora por padrão (a triagem é de empresas; PII aguarda T11) — `includeIndividuals` existe para quando a política decidir. Casamento é pelo CNPJ completo; casar pela raiz (filiais) fica para a política T11.
- **Leitura real (2026-09-24, só leitura, rede doméstica):** OFAC SDN.CSV 5.695.076 bytes / ALT.CSV 1.063.989 bytes → 19.391 registros, 11.857 não individuais (entidades, embarcações, aeronaves), 41 lotes, 0,7 s. CEIS `20260923_CEIS.zip` (CSV de 34 MB) → 23.734 sanções, 14.543 de pessoa jurídica (14.531 com CNPJ), 92 lotes, 3,6 s. CNEP `20260923_CNEP.zip` → 1.811 sanções, 1.783 PJ (1.771 com CNPJ), 11 lotes. Todas as linhas com a contagem de colunas esperada. **Nada foi importado em produção.**
- Testes: `tests/sanctions-parsers.test.mjs` (7 casos, incluindo importação pela API seguida de triagem: CNPJ exato → 2 bloqueios (CEIS e CNEP); nome da OFAC → 1 revisão; contagem divergente → versão falha).
- **Bloqueio restante:** política T11 (fontes exigidas, validade, pessoas físicas, raiz de CNPJ) e a execução da importação em produção pelo admin.
