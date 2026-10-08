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

## P1-T3 — Conferência da conta Cloudflare (só leitura, 2026-09-24)

Inventário lido pela integração Cloudflare (apenas GET; nada criado, alterado ou apagado). Conta `Rogeriopalhari23@gmail.com's Account` (tipo `standard`), subdomínio workers.dev `rogeriopalhari23`.

| Recurso | Na conta | No `wrangler.jsonc` | Consequência |
| --- | --- | --- | --- |
| Worker | `eag-compass-production` (alterado em 2026-09-22) | `name: "eag-compass"` | Um deploy como está criaria **um segundo Worker**. Decidir: publicar sobre `eag-compass-production` ou aposentá-lo |
| D1 | `eag_compass` (`d6a5873b-f768-4516-96b8-1f865db8aaa4`, criado em 2026-09-22) | `eag-compass-db` com `LOCAL_REPLACE_AFTER_CREATE` | `db:migrate:remote` não acharia o banco (nome diferente) ou levaria a criar outro. O banco existente pode ter dados e migrações da 0.3.1 — **não foi lido** (leitura de dados de produção negada pela regra de permissões desta sessão) |
| Filas | `eag-sanctions-queue`, `eag-scores-queue` (da 0.3.1); nenhuma DLQ listada | nenhuma (portão do `validate-deploy`); o código usa um binding `ASYNC_QUEUE` | Decidir reaproveitar uma delas ou criar `eag-compass-async` + DLQ na liberação |
| R2 | **não habilitado** na conta ("Please enable R2 through the Cloudflare Dashboard") | não configurado | A lista mensal (P3-T5) precisa do R2 habilitado pelo painel e do binding `FILES` |
| Access (Zero Trust) | **não habilitado** | o Worker exige JWT do Access | Sem Access, a API em produção responde 401 para todos. Habilitar o Zero Trust e criar a aplicação para o hostname workers.dev, com Bypass só em `/u/*` |
| Zonas / domínio próprio | nenhuma | — | URL seria `eag-compass-production.rogeriopalhari23.workers.dev` (ou o nome escolhido) |
| KV | nenhum | nenhum (errata: lease/outbox em D1) | ok |
| Plano | não lido (a assinatura respondeu erro de autenticação ao token) | `limits` não usado | Filas existirem indica Workers Paid; confirmar no painel |

**Estado:** continua `external`. Próximos passos são de Rogério (decisões acima) antes de P1-T12: nome do Worker, banco (reaproveitar `eag_compass` depois de ler/copiar o conteúdo, ou criar novo), fila, habilitar R2 e Access.

- **Decisão de Rogério (2026-09-24):** publicar sobre `eag-compass-production` e reaproveitar o D1 `eag_compass`. `wrangler.jsonc` (produção) e `db:migrate:remote` atualizados; ambiente local mantido (`eag-compass-local`/`eag-compass-db`) para não perder o D1 local. `wrangler deploy --dry-run` lê o binding `DB → eag_compass`. Nada publicado.
- **Decisões de Rogério (2026-09-24):** endereço workers.dev atrás do Access; fila nova `eag-compass-async` + DLQ `eag-compass-dlq`. `workers_dev: true`; `scripts/validate-deploy.mjs` virou função testada (`tests/validate-deploy.test.mjs`, 3 casos) — aceita workers.dev ou rota (um só), exige Access e D1 real, segura fila/cron/R2; antes o portão sempre falhava ao ler o `wrangler.jsonc` por causa dos comentários. Blocos de fila/cron/R2 documentados em `docs/OPERACAO.md`, não aplicados.

## Aprovações de Rogério — 2026-09-24

- Canal: conversa no Claude Code. Mensagem "aprovado"; na confirmação pedida em seguida, Rogério marcou: "D1 e D2", "Valores da rotina mensal", "Tradução em inglês" e "Outra coisa" (sem texto — a esclarecer, nada registrado para ela).
- Registrado em `migrations/0016_parametros_internacional_aprovados.sql` (vigência 2026-09-24, motivo com autor e data): `period_default_months` 12 (D1); `agri_classification` `sh-01-24@2026-09-23`, capítulos 01–24 sem 03 (D2); `trade_list_mdic_years` 2; `trade_list_comtrade_years` 3; `comtrade_calls_per_day` 400; `trade_list_retention_versions` 3; `country_list_refresh_day` 10; `templates_en_approved` no escopo `pv-en-1.0.0` com `evidenceRef` para `docs/implementation/AMOSTRAS-TEXTOS-EN.md#aprovacao` (seção de aprovação preenchida pelo gerador, só para essa versão).
- Continuam sem valor (não aprovados): `international_enabled` (só depois de T12) e `send_window:international`.
- Testes ajustados ao novo estado: os cenários "sem aprovação vigente" agora encerram a vigência do parâmetro em vez de depender da ausência. Migração aplicada no D1 local após cópia em `eag-compass-backups/d1-local-20260924-112922`.
- P3-T1 e P3-T9 passam a `implemented`.

## P1-T2 — CI remoto (2026-09-24)

- Push de `v2-revisao-2` autorizado por Rogério e executado por ele (`git -c http.postBuffer=157286400 push -u origin v2-revisao-2`; a primeira tentativa caiu com HTTP 408). Workflow passou a incluir a branch (`96ccfda`).
- GitHub Actions, run 36021958011 (https://github.com/rogeriopalhari23-dotcom/EAG-Agro/actions/runs/36021958011), commit `96ccfda`: `npm ci` + `npm run check` — **ubuntu-latest: success** (15:41:04–15:41:34 UTC), **windows-latest: success** (15:41:05–15:42:07 UTC).

## Aprovação dos textos em português (R17.6) — 2026-09-24

- Rogério viu os textos na conversa e respondeu "ok"; na confirmação pedida, marcou "Sim, aprovo os textos" e, sobre o break no masculino, "Tirar o gênero da frase".
- Nova adaptação **A-G1**: "…outras prioridades no momento ou com projetos mais urgentes…" (antes "ou envolvido em projetos mais urgentes", literal da skill). Modelos passam a `pv-1.1.0`; fichas já geradas guardam a versão e o texto com que foram criadas. A tradução `pv-en-1.0.0` não muda (o inglês já é neutro).
- Registro em `docs/implementation/AMOSTRAS-TEXTOS-PV.md` (seção Aprovação, gerada só para `pv-1.1.0`) e no item 11 de `docs/eag-compass-t1-validacao.md`. Continua pendente a amostra "sequência interrompida antes do break", que depende do envio real (T1).

## Política de sanções T11 — decidida por Rogério em 2026-09-24

- Canal: conversa no Claude Code (quatro perguntas com as opções; respostas registradas aqui literalmente): listas "OFAC + CEIS + CNEP (Recomendado)"; validade "30 dias"; pessoas físicas "Não, só empresas (Recomendado)"; raiz de CNPJ "Raiz vai para revisão (Recomendado)".
- Aplicação: `migrations/0017_politica_sancoes.sql` (`sanctions_max_age_hours` = 720, vale para a idade de cada lista importada e da triagem; as três fontes ativas); pessoas físicas já ficam fora no `scripts/import-sanctions.mjs` (padrão); `src/sanctions.js`: outra unidade com a mesma raiz de CNPJ → resultado de revisão (registrado como `match_method='substring'`, o valor existente mais próximo — o CHECK da 0001 não tem valor próprio para raiz); CNPJ exato continua bloqueando.
- Consequência operacional: com 30 dias, cada lista precisa ser reimportada ao menos uma vez por mês; lista vencida deixa a triagem indisponível e segura o pré-envio (R19.3).
- Teste: `tests/sanctions-parsers.test.mjs` (filial da mesma raiz → 2 revisões, 0 bloqueio; empresa sem relação → nada; parâmetro 720 e três fontes ativas). Suíte 298 + 2. Migração aplicada no D1 local após cópia em `eag-compass-backups/d1-local-20260924-120332`.
- P2-T16 passa a `external`: falta só o admin rodar a importação das três listas em produção (`docs/OPERACAO.md`, seção Listas de sanções).

## P2-T15 — Busca dos dados do OpenClaw nesta máquina (2026-09-24)

- Autorizado por Rogério a ler `~/.openclaw` e `AppData/Local/EAG-OpenClaw-*` só para descobrir formato e local dos dados; lida apenas a estrutura (nomes, tamanhos e nomes de campos), nenhum conteúdo copiado.
- `~/.openclaw`: configuração da tela Claw3D (`claw3d/settings.json`), skills e o quadro de tarefas dos agentes (`claw3d/task-manager/tasks.json`, 128 tarefas com `title, status, source, channel, externalThreadId, history…`). **Não há empresas, contatos nem supressões.**
- `AppData/Local/EAG-OpenClaw-{AuthClean,Clean,DirectClean,Stable}`: perfis do navegador Edge usados para abrir a tela (cache, uso, estatísticas). **Sem dados de prospecção.**
- Indícios de que o OpenClaw em uso roda na VPS da Hostinger: chave `~/.ssh/eag_openclaw` e o guia de instalação na VPS em Downloads. A base de contatos e descadastros deve estar lá.
- **Bloqueio atualizado:** exportação feita na VPS (ou autorização de Rogério para leitura por SSH, só leitura) e inventário do que ainda roda no executor antigo para comprovar o corte.
- **Tentativa por SSH (2026-09-24, autorizada por Rogério, só leitura):** `srv1644560.hstgr.cloud` não resolve mais no DNS; o IP `2.24.78.149` (mesma chave ed25519 que o nome no `known_hosts`) apresentou **chave de host diferente** (`SHA256:zA4NvA5n8KMmxOVbyKdsgYdRn1I4LQjFREnM6y/1JX8`). Conexão recusada pela verificação estrita; nada foi executado nem lido no servidor e a checagem não foi contornada. Provável reinstalação/troca da VPS — Rogério confere a impressão digital no hPanel e se há backup do OpenClaw antigo.

## P1-T12 — Access configurado (2026-09-24)

- Rogério habilitou o Zero Trust no painel (time `quiet-bird-4d88`); R2 ainda não habilitado (só a lista mensal depende dele).
- Criado pela API, com autorização dele ("pronto" depois de "eu crio os dois apps de Access pela API"): provedor de login **One-time PIN** (`c8166e03-…`); aplicação **EAG Compass** (`5c5864c5-…`) em `eag-compass-production.rogeriopalhari23.workers.dev`, sessão de 24 h, só One-time PIN, política *Allow* para `rogeriopalhari23@gmail.com` (os outros três perfis entram quando Rogério informar os e-mails); aplicação **EAG Compass — descadastro público** (`5c87c934-…`) em `…/u`, política *Bypass — Everyone*.
- `wrangler.jsonc`: `ACCESS_TEAM_DOMAIN` = `https://quiet-bird-4d88.cloudflareaccess.com`, `ACCESS_AUD` = AUD da aplicação principal. `validate-deploy` passa (`workers.dev`); `wrangler deploy --dry-run` lê Access e o D1 `eag_compass`. **Nada publicado; banco remoto não migrado.**

## P1-T12 — Primeira publicação (2026-09-24, autorizada por Rogério)

- Autorização (mensagem de Rogério): consultar o D1 `eag_compass`; se vazio e compatível, aplicar 0001–0017, criar o admin `rogeriopalhari23@gmail.com` e publicar; sem contas fictícias; sem disparos comerciais.
- **Diagnóstico do banco antes:** só a tabela interna `_cf_KV` (12 KB), sem `d1_migrations` → vazio e compatível. Maior instrução das migrações: 75 KB (limite do D1: 100 KB).
- **Migrações aplicadas no remoto:** 0001 a 0017 (conferido em `d1_migrations`).
- **Usuários:** criado `user-rogerio-palhari` (`rogeriopalhari23@gmail.com`, admin, ativo). O usuário de sistema `system-admin` (`admin@local.eag`, criado pela migração 0002 da 0.3.1 e autor dos registros semeados) foi marcado **inativo** — não apagado, porque é referenciado pelos seeds; não consegue entrar (Access só libera o e-mail de Rogério e o login local está desligado). As duas ações estão no `audit_log`.
- **Segredos:** `PII_ENCRYPTION_KEY` e `UNSUB_TOKEN_KEY` gerados aleatoriamente (32 bytes) e enviados ao Worker sem exibição; cópia de segurança em `C:\Users\Roger\eag-compass-backups\segredos-producao-2026-09-24.txt` (fora do repositório; Rogério guarda num gerenciador de senhas e apaga o arquivo). Nenhum segredo de provedor (Hostinger, Snov, Casa dos Dados, LocationIQ, Comtrade) foi configurado.
- **Publicação:** `wrangler deploy` → `https://eag-compass-production.rogeriopalhari23.workers.dev`, versão `efaddf90-5ea6-44bf-85ef-66a7993603a5`; bindings: D1 `eag_compass`, rate limit do descadastro, assets, variáveis de produção com Access. Sem fila, cron nem R2 (portão).
- **Verificações sem login:** `/`, `/api/health`, `/api/session`, `/api/companies`, `/app.js`, `/uxyz`, `/api/u/x` → 302 para `quiet-bird-4d88.cloudflareaccess.com` (Access). `/u/<token inválido>` GET e POST de um clique → 404 com a página "Link inválido ou expirado." servida pelo Worker, sem login; `/u` e `/u/` → 404 vazio. Tentativas de travessia (`/u/../api/session`, `/u/%2e%2e/api/session`, `/u/x/../../api/health`) → Access; `/u/..%2fapi%2fsession` e `/u//api/session` → tratados como token de descadastro (404), nunca chegam à API. Cabeçalhos da página pública: `Cache-Control: no-store`, `x-robots-tag: noindex`, CSP `default-src 'none'`, `frame-ancestors 'none'`, `referrer-policy: no-referrer`, HSTS, `nosniff`.
- **Pendente de Rogério:** entrar pelo Access (código enviado ao e-mail) e confirmar que a tela abre como administrador. Nenhum e-mail comercial foi enviado; o canal de e-mail segue `planned`.
- **Login confirmado (2026-09-24):** log do Access mostra `rogeriopalhari23@gmail.com` com `login` permitido às 18:43 e 18:48 UTC no app do Compass; Rogério respondeu "feito" à instrução de entrar e confirmar a tela como administrador.

## Execução autorizada de 2026-09-24 (tarde) — sanções, fila/cron, e-mail, perfis, domínio

**GitHub:** varredura antes do push — nenhum padrão de segredo nos 8 commits e os valores de `PII_ENCRYPTION_KEY`/`UNSUB_TOKEN_KEY` com 0 ocorrências no histórico e nos arquivos; push `96ccfda..cef9772` sem força; CI verde (run 36046577955).

**P2-T16 — importação em produção:** sessão do Access obtida com `cloudflared access login` (Rogério digitou o código do e-mail); `/api/session` → admin, `production`. `scripts/import-sanctions.mjs` (token lido do cache, nunca exibido):

| Fonte | Arquivo | Registros no arquivo | Importados (empresas) | Versão | Hash |
| --- | --- | --- | --- | --- | --- |
| OFAC SDN | SDN.CSV+ALT.CSV de 2026-09-24 | 19.391 | 11.857 (23.317 aliases) | `00e702fc…` | `37a0f224cbd4…` |
| CGU CEIS | `20260924_CEIS` | 23.684 | 14.503 (32.150 aliases; 9.572 CNPJs distintos) | `279f05dc…` | `65e2623702ba…` |
| CGU CNEP | `20260924_CNEP` | 1.811 | 1.783 (3.866 aliases; 1.007 CNPJs distintos) | `9b743870…` | `986cb26eb9f4…` |

- Persistência conferida no D1 (`record_count` = entradas; `import_status='imported'`). Duplicatas: a mesma empresa pode ter várias sanções — cada uma fica como registro próprio; a triagem agrupa por empresa.
- Falha: o Portal mantém só o arquivo do último dia (o de 23/09 passou a 403); o script agora tenta o dia de hoje e o de ontem em Brasília. Lista incompleta vira versão `failed` (teste).
- Triagem controlada com as consultas do próprio código, só leitura, sem criar empresas em produção: CNPJ exato `00000113000197` → 2 sanções CEIS (**bloqueio**); outra unidade da raiz `00000113` → 2 (**revisão**); CNPJ sem relação → 0; nome repetido em 5 CNPJs diferentes ("TRANSCOPS") → casamento só por nome (**revisão**, nunca bloqueio). Listas vencidas (> 720 h) ou ausentes → triagem indisponível e pré-envio segurado (testes).
- Próxima importação obrigatória: até 2026-10-24.

**Fila e cron:** filas `eag-compass-async` e `eag-compass-dlq` criadas (a DLQ pelo wrangler, a principal pela API depois de o wrangler parar numa pergunta interativa; nenhum arquivo alterado por ele). `wrangler.jsonc` com produtor/consumidor (5 tentativas, lote 10, DLQ) e crons `*/5 * * * *` e `17 2 * * *`; `validate-deploy` agora exige DLQ, limite de tentativas e só os crons aprovados (R2 continua barrado). Antes de publicar: produção sem outbox, fichas nem campanhas ativas; canal `planned`; teste novo do cron sem credenciais (não envia, não quebra, sem R2 não cria versão). Publicado (versão `edbee7ad…`); consumidor = Worker, DLQ `eag-compass-dlq`, 5 tentativas. Verificação: `ping` processado e confirmado uma vez; tipo desconhecido reprocessado até esgotar e **2 mensagens na DLQ** (métrica da fila); fila principal com 0; cron `*/5` executado às 19:45:47 UTC com `ok` (leitura de respostas registrou `auth`, esperado sem senha).

**E-mail (P2-T17):** encontrado nas fontes do projeto — remetente `rogeriopalhari@eagagro.com` (Spec R19.13), endereço físico "Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP" (`docs/eag-compass-perfil.md`, de eagagro.com/contato), servidores Hostinger SMTP 465 / IMAP 993 (`docs/eag-compass-pesquisa-tecnica.md`). Publicado como variáveis (versão `264820c3…`), com `INTERNAL_TEST_RECIPIENTS` só `rogeriopalhari23@gmail.com`. **Senha da caixa não existe em fonte autorizada** — T1 não executado; nenhum e-mail enviado.

**Perfis:** `tests/roles.test.mjs` (3 casos): matriz leitura/escrita/aprovação/admin para admin, gerente, vendedor e leitor; ativar campanha só admin/gerente; usuário inativo e e-mail desconhecido recusados. Usuários de teste só no banco de teste. Em produção, só o admin de Rogério.

**Recuperação:** Time Travel do D1 disponível (bookmark `0000000e-…-ba4b16395eb650dfad342f0f93930248`); não restaurado.

**Domínio `eagcompass.com`:** RDAP — registrador Hostinger, registrado e alterado em 2026-09-24, expira 2027-09-24, `client transfer prohibited`; DNS em `horizon/orbit.dns-parking.com`; só `www` → `2.57.91.91` (estacionamento), sem MX/TXT. Zona criada no Cloudflare (`5879e506…`, Free, `pending`, sem importar registros) com DNS `joyce.ns.cloudflare.com` e `yoxall.ns.cloudflare.com`. O Access recusou o novo domínio enquanto a zona não estiver ativa ("domain does not belong to zone"). Falta Rogério trocar os DNS no hPanel.

**Reconciliação:** P1-T12 volta a `partial` (quatro perfis e domínio próprio); P2-T16 → `implemented`. `ESTADO-DAS-42-TAREFAS.md` reescrito com implementação, publicação e validação operacional separadas.

## Reconciliação e verificações de 2026-09-25

**Divergência "site publicado" × "zona não ativou":** são endereços diferentes. O Compass está publicado em `eag-compass-production.rogeriopalhari23.workers.dev` (302 para o Access na raiz; `/u/<inválido>` → 404 sem login) — conferido hoje. O domínio próprio `eagcompass.com` é outra coisa: zona `5879e506…` no Cloudflare com status `pending`, `activated_on` nulo, sem registros e com DNS atribuídos `joyce.ns.cloudflare.com` / `yoxall.ns.cloudflare.com` (lidos hoje na própria zona); o registro .com (RDAP) e o DNS público (8.8.8.8 e 1.1.1.1) seguem em `horizon/orbit.dns-parking.com`, última alteração 2026-09-24 19:00 UTC; `https://eagcompass.com` serve a página "Parked Domain name on Hostinger DNS system". O Worker não tem domínio personalizado. Nenhum nameserver foi alterado.

**Caixa `rogeriopalhari@eagagro.com`:** provedor confirmado no DNS público — MX `mx1/mx2.hostinger.com`, SPF `include:_spf.mail.hostinger.com`, DKIM publicado (seletor `default`), DMARC `p=none`. `smtp.hostinger.com:465` e `imap.hostinger.com:993` respondem com TLS válido (certificado `hostinger.com`). O código usa exatamente SMTP 465 SSL e IMAP 993 SSL com o usuário completo da caixa. Observação: a zona DNS de `eagagro.com` está em servidores Cloudflare (`chloe/ed.ns.cloudflare.com`) de **outra conta** — não está na conta do Compass.

**Novo — estado das integrações e conferência da caixa sem envio:** `GET /api/integrations` (admin; só "configurado ou não", nunca valores) e `POST /api/integrations/mailbox/check` (admin; LOGIN + EXAMINE só leitura + LOGOUT, auditado; não lê, não marca e não envia). `src/adapters/imap.js` passou a ter sessão compartilhada. Testes `tests/integrations.test.mjs` (3). Publicado (versão `483dfaa3…`); rotas atrás do Access (302 sem login). Leitura em produção: senha da caixa **não configurada**; Snov, Casa dos Dados, LocationIQ e Comtrade **não configurados**; fila sim; R2 não; sanções OFAC/CEIS/CNEP vigentes (720 h); janela e fuso de envio **ausentes** (não aprovados).

**R2:** conferido de novo pela integração — continua desabilitado ("Please enable R2 through the Cloudflare Dashboard").

**Janela 09:00–17:00 America/Sao_Paulo — proposta, NÃO aprovada.** Efeito conforme o código (`src/sending.js`): a janela `send_window:national` é aplicada no fuso **do destinatário**; para contato nacional sem fuso próprio vale `send_timezone:national` (a proposta: America/Sao_Paulo), então Manaus (UTC−4) receberia entre 08:00 e 16:00 locais e o Acre (UTC−5) entre 07:00 e 15:00, a menos que o contato tenha fuso registrado. O Internacional **não** usa esse fuso: exige fuso por contato e usa `send_window:international` (hoje ausente → envio internacional parado com `window_missing`); se fosse 09:00–17:00, Berlim receberia entre 04:00 e 12:00 de Brasília e Tóquio entre 21:00 e 05:00 de Brasília. O teto diário conta o dia de Brasília e soma os dois mercados; o "dia civil anterior" é no fuso do destinatário; dias úteis segunda a sexta no dia local dele; feriados não tratados.

## 2026-09-25 — DNS de eagcompass.com, regra de horário e método da caixa

**Comparação DNS (antes de trocar os nameservers):** servidores autoritativos atuais (`horizon/orbit.dns-parking.com`, Hostinger, SOA serial `2026092403`): `A eagcompass.com → 2.57.91.91` (estacionamento), `CNAME www → eagcompass.com`, NS e SOA; **nenhum** MX, TXT/SPF, DKIM, DMARC, CAA, AAAA, SRV, `mail`, `autodiscover`. Zona Cloudflare `5879e506…`: `pending`, `activated_on` nulo, **0 registros**, DNS atribuídos `joyce.ns.cloudflare.com` e `yoxall.ns.cloudflare.com`. Conclusão: nenhum registro precisa ser recriado (os dois existentes só servem o estacionamento); o registro do Compass é criado ao ligar o domínio ao Worker; `www` vira redirecionamento. Opcional (não criado): MX nulo, SPF `-all` e DMARC `p=reject` para impedir falsificação de `@eagcompass.com`.

**Regra de horário aprovada por Rogério em 2026-09-25:** "09:00–17:00 no fuso horário confirmado do destinatário, nacional ou internacional. Sem fuso confirmado, mantenha o envio em espera." Registrada em `migrations/0018_janela_envio_aprovada.sql` (`send_window` nacional e internacional, `changed_by = user-rogerio-palhari`); dias **segunda a sexta** assumidos por "horário comercial" (Spec) e sinalizados para confirmação. Aplicada no D1 remoto (antes: nenhuma janela; bookmark de recuperação `000000d4-00000000-000050f1-0fa0ce4c8c0e865858335ab1d0506a0e`) e no local (após cópia de segurança).
- Código: `src/sending.js` deixa de usar o fuso do mercado — sem fuso no contato, o passo fica em espera (`timezone_pending`) nos dois mercados; `send_timezone:national` deixou de ser exigido. `src/fichas.js`: aprovação exige o fuso do destinatário (R18.6); a ficha nacional é gerada sem ele. `src/companies.js`: cadastro de contato aceita fuso (vazio = pendente; inválido recusado). Tela da empresa: campo de fuso no cadastro e botão "Confirmar/Alterar fuso" em cada contato.
- Testes: `tests/send-window.test.mjs` (5: parâmetros vigentes; nacional sem fuso espera mesmo às 10h de Brasília; Manaus 08:30 fora e 09:05 dentro; sábado não envia; fuso vazio/ inválido no cadastro), fixtures confirmam `America/Sao_Paulo`; teste de aprovação R18.6 reescrito. Suíte 311 + 2; UI smoke 13 telas. Publicado (versão `8a0f78c9…`); `/api/integrations` em produção mostra as duas janelas e nenhum fuso de mercado; canal `planned`.
- Nota: a primeira rodada do UI smoke falhou porque ainda esperava a janela "Pendente"; o deploy saiu antes da correção do teste (mudança só no teste, código publicado igual ao validado depois).

**Caixa `rogeriopalhari@eagagro.com` — provedor e autenticação:** Hostinger (MX `mx1/mx2.hostinger.com`, SPF Hostinger, DKIM `default`, DMARC `p=none`). Anúncio dos servidores, sem login: SMTP `smtp.hostinger.com:465` (TLS implícito) oferece `AUTH PLAIN LOGIN`; IMAP `imap.hostinger.com:993` (TLS) oferece `AUTH=PLAIN AUTH=LOGIN`. Método: usuário = endereço completo + senha da própria caixa (não a do hPanel), sem OAuth — o mesmo que o código usa. Nenhuma mensagem enviada.

## 2026-09-25 (tarde) — pendências operacionais

**Domínio `eagcompass.com`:** zona `pending`, DNS atribuídos `joyce.ns.cloudflare.com`/`yoxall.ns.cloudflare.com`; registro .com e DNS público seguem em `horizon/orbit.dns-parking.com` (sem mudança desde 2026-09-24 19:00 UTC); site = página de estacionamento da Hostinger. Sem acesso ao registrador (Hostinger) neste ambiente. **Pré-configurado na zona** (sem efeito até ativar): `AAAA www 100::` com proxy + regra de redirecionamento 301 `www.eagcompass.com` → `https://eagcompass.com` (caminho e query preservados); **domínio personalizado `eagcompass.com` ligado ao Worker** `eag-compass-production` (aceito com a zona pendente) e declarado no `wrangler.jsonc` (`routes` com `custom_domain`); `validate-deploy` aceita a transição workers.dev + domínio personalizado (nunca rota com curinga). Publicado (versões `35786b61…` e seguintes). **Não testado:** login e descadastro em `eagcompass.com` (dependem da ativação; o Access só aceita o hostname com a zona ativa). Até o Access cobrir o novo domínio, a API nele responde 401 (o Worker valida o token do Access).

**Caixa — bloqueio de plataforma encontrado (crítico):** teste novo `POST /api/integrations/mailbox/reach` (só saudação, sem login) a partir do Worker em produção → IMAP e SMTP: `proxy request failed, cannot connect to the specified address`. Causa confirmada: `smtp.hostinger.com` = 172.65.255.143 / `2606:4700:90::…` e `imap.hostinger.com` = 172.65.188.64 / `2606:4700:90::…` estão na faixa da Cloudflare (172.64.0.0/13, 2606:4700::/32), e a documentação oficial de Workers (Runtime APIs → TCP sockets) diz: "Outbound TCP sockets to Cloudflare IP ranges are blocked". Da máquina de Rogério os mesmos servidores respondem normalmente. **Consequência:** o Worker não consegue enviar pela Hostinger nem ler respostas por IMAP; `MAILBOX_PASSWORD` no Worker não resolveria. É o gatilho previsto na Spec ("T1 falhar em autenticação, recebimento ou correlação → canal alternativo"). Nenhum e-mail enviado. Decisão de arquitetura pendente com Rogério (opções em `docs/OPERACAO.md`).

**Método da caixa (confirmado no código):** SMTP `AUTH PLAIN` e IMAP `LOGIN` com `MAILBOX_USER` + `MAILBOX_PASSWORD` (senha da própria caixa), iguais ao que os servidores anunciam.

**Janela:** Rogério confirmou em 2026-09-25 "segunda a sexta, 09:00–17:00 no fuso horário confirmado de cada destinatário, para ambos os mercados; sem fuso confirmado, o envio aguarda" — igual ao já registrado na migração 0018 (dias úteis agora confirmados por ele, não mais presumidos). Testes de fronteira e horário de verão (`tests/send-window.test.mjs`, 20 casos numa tabela): 08:59/09:00/16:59/17:00 em São Paulo (fim exclusivo), sábado/domingo fora, Brasil sem horário de verão em novembro, Manaus e Rio Branco, Berlim antes/depois de 2026-03-29, Nova York antes/depois de 2026-11-01, Tóquio (segunda local = domingo UTC). Nenhuma campanha ativada.

**OpenClaw:** origem da impressão esperada = `~/.ssh/known_hosts` (conexões até maio/2026); as três chaves (ED25519, RSA, ECDSA) apresentadas hoje por `ssh-keyscan` diferem das registradas → padrão de reinstalação. Inventário do executor antigo e plano em `docs/implementation/OPENCLAW-RECONCILIACAO.md` (modo `internal_report_only`, todos os `EAG_ALLOW_*` falsos na cópia validada local; e-mail só de relatório). Sem conexão.

**Snov/Comtrade/R2:** Comtrade `getDA` (público) respondeu de verdade (Alemanha, 35 registros, 1991–2025); `data/v1/get` sem chave → 401 (exige `COMTRADE_KEY`, só a lista mensal). Snov: API alcançável, sem credencial → 400 (não é validação). R2: a API recusa habilitar ("enable R2 through the Cloudflare Dashboard") — ação no painel. Nenhuma dessas APIs foi declarada validada.

**Backup de segredos:** `C:\Users\Roger\eag-compass-backups\segredos-producao-2026-09-24.txt`, 336 bytes, permissões herdadas só para `SISTEMA`, `Administradores` e `ROGERIONOTE\Roger` (não lido). Script `scripts/conferir-backup-segredos.ps1` confere o gerenciador contra o arquivo sem exibir valores e só então mostra o comando de remoção.

## 2026-09-25 (noite) — R2 e Comtrade configurados por Rogério; T12 passo 4 pelo Worker

- Conferido pela API: R2 habilitado (sem buckets) e segredo `COMTRADE_KEY` presente no Worker. Criado o bucket privado `eag-compass-files` (ENAM, Standard); `wrangler.jsonc` com `r2_buckets` → binding `FILES`; `validate-deploy` aceita só esse bucket. Publicado (versões `29015592…`, `1ab5a573…`).
- **Termos da Comtrade (T12 passo 2):** página oficial "Policy on use and re-dissemination" — uso interno ("only for use by staff members of the institutional unit for the benefit of the unit") está entre os usos sem licença; o Compass é interno (só usuários da EAG atrás do Access; nenhum e-mail ou ficha leva os dados a terceiros). Guardar a lista é permitido.
- **Atualização real da Alemanha pelo Worker** (`POST /api/trade-list/refresh/DEU`, versão `2026-09-manual-DEU-608914c6`): `comtrade_ref` (HS.json) e `comtrade_da` (disponibilidade) **ok**; `comtrade:DEU:0` → **401 (chave recusada)**, rotina da Comtrade bloqueada (`comtrade_blocked='auth'`), blocos 1 e 2 em espera; `mdic_ref` → **HTTP 526** (certificado inválido na origem) em novas tentativas.
- Diagnóstico da chave sem expor valor (`GET /api/integrations` → `comtradeKeyShape`): **53 caracteres, não hexadecimal, sem espaço nas bordas** — chaves da Comtrade têm 32 caracteres hexadecimais; o valor gravado não é a chave primária da assinatura. O adaptador passou a usar a chave sem bordas (teste novo).
- **MDIC pelo Worker: bloqueado pelo certificado do servidor** (risco registrado em P3-T2): `balanca.economia.gov.br` não envia o intermediário Sectigo; o `fetch` do Worker não completa a cadeia e responde 526; não há CA personalizada no `fetch`. Conforme o Plano 3 T12 passo 4, o item volta à decisão: (a) coleta do MDIC fora do Worker (GitHub Actions mensal com o intermediário público anexado, gravando no R2/D1 com token de API) ou (b) execução mensal local pelo admin, enviando os agregados pela API do Compass com a sessão do Access. Nenhuma das duas aplicada.

## 2026-09-25 (noite) — MDIC 526: causa demonstrada e job mensal pelo GitHub (decisão "a" de Rogério)

**URL que falha pelo Worker:** `HEAD https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm/EXP_2026.csv` (tarefa `mdic_ref` da versão `2026-09-manual-DEU-608914c6`) → **HTTP 526** (Cloudflare: certificado da origem inválido), repetido nas novas tentativas.

**Validação TLS (da máquina de Rogério, verificação sempre ligada):**
- O servidor envia **só o certificado folha**: `CN=*.economia.gov.br`, emissor `Sectigo Public Server Authentication CA OV R36`, válido até 2026-10-03, SHA-256 `70:69:83:47:…:98:04`. `openssl s_client` → `Verify return code: 21 (unable to verify the first certificate)`.
- O próprio certificado indica o intermediário (AIA): `http://crt.sectigo.com/SectigoPublicServerAuthenticationCAOVR36.crt` → SHA-256 `65:42:D1:76:BE:D5:0F:19:3C:0C:E2:97:AE:44:EC:D8:A0:A8:6B:EC:2E:DE:68:27:69:34:40:59:B4:E7:85:30`, válido até 2036-03-21, assinado por `Sectigo Public Server Authentication Root R46`, raiz presente na loja pública do Node (Mozilla).
- `openssl verify` da folha: só com as raízes → falha; com o intermediário como `-untrusted` + raízes → **OK**.
- Node (`https`): só raízes → `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; raízes + intermediário → **HTTP 200**; **só o intermediário** (sem raízes) → `UNABLE_TO_GET_ISSUER_CERT` — o intermediário é elo, não âncora de confiança.

**Causa demonstrada:** configuração do servidor do MDIC (cadeia incompleta). Navegadores completam pelo AIA; o `fetch` do Worker não completa nem aceita CA personalizada, daí o 526. Não é bloqueio de rede nem certificado vencido/revogado.

**Solução aplicada (sem reduzir a segurança TLS):** `scripts/lib/mdic-tls.mjs` usa raízes públicas + o intermediário fixado em `certs/…ov-r36.pem`; a cada execução confere impressão SHA-256, validade e assinatura por raiz pública antes de baixar qualquer coisa (testes: certificado trocado, vencido e loja sem a raiz R46 → recusa). `scripts/mdic-job.mjs` lê e agrega com o mesmo código do Worker (`src/mdic-aggregate.js`, extraído de `mdicMerge`), grava no R2, confere hash e publica no D1 com `complete` por último. Worker com `MDIC_SOURCE=github` (não agenda mais `mdic_ref`; publicado, versão `c4d6847f…`). Workflow `.github/workflows/mdic-mensal.yml` (dias 10–12, 12:00 UTC; `contents: read`; segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` ainda não cadastrados). Testes `tests/mdic-job.test.mjs` (7); suíte 321 + 2.
- Primeira execução local falhou antes de ler o D1 (o `cmd` do Windows quebrou o SQL passado por `npx`); nada publicado. Corrigido chamando o wrangler direto pelo Node, sem shell.
- **Segunda execução real (DEU):** TLS conferido, D1 lido, 2026 pedaços 1–4 lidos; o pedaço 5 recebeu `ECONNRESET` nas 4 tentativas e o job parou com "FALHA: MDIC: sem resposta (falha de rede)" — **nada gravado no D1**, versão não criada (falha tratada demonstrada). Sondagem direta: resets ao acaso com pedaços de 8 MiB e de 2 MiB, sucesso na repetição (1 MiB em ~0,5 s; 8 MiB em ~10 s). Ajuste: até 8 tentativas por pedaço, espera 5/10/20/40/60 s (teste novo com 5 resets seguidos).
- **Correção sobre a chave da Comtrade:** a frase da entrada anterior "chaves da Comtrade têm 32 caracteres hexadecimais" não tem fonte oficial (é só o padrão do gerenciador de API usado pelo portal) e fica retirada. O único fato demonstrado é a recusa real: `data/v1/get` com o valor gravado → 401. A validação será por chamada real após Rogério regravar a chave.
- **Terceira execução real (DEU) — publicada:** `node scripts/mdic-job.mjs --iso3 DEU` → TLS conferido; 2026 e 2025 lidos inteiros (5 resets recuperados na 2ª tentativa); versão `2026-09-mdic-DEU-1790371550056` (`manual`, `complete`). D1: estado `purchase_identified`, último período `2026-08`, 2.882 linhas, ponteiro `trade_list_current` DEU/mdic revisão 1 com SHA-256 `c5b8154f…4c704f`, igual ao do objeto baixado do R2. Conteúdo: FOB, "exportações do Brasil", 483 NCMs, meses 2025-01..2026-08; FOB agro 2025 US$ 3,30 bi, 2026 (jan–ago) US$ 1,67 bi; maiores SH6: 090111 café não torrado, 230400 farelo de soja, 020714 pedaços de galo/galinha congelados, 020130 carne bovina desossada fresca, 240120 fumo. 4.496 agregados do arquivo inteiro têm CO_PAIS sem país no cadastro (contados na nota da versão, não somados a ninguém).
- **Leitura pelo Worker em produção:** `POST /api/country-analyses {"iso3":"DEU"}` (sessão do Access de Rogério) → 201, fonte MDIC da versão acima, "compra identificada", janela 2025-09..2026-08, 338 linhas, snapshot reproduzido; Comtrade "dados indisponíveis" (chave ainda recusada).

## 2026-09-27 — revisor PV reprovava ao acaso fichas corretas (corrigido antes de levar para main)

**Sintoma:** `npm run check` falhou uma vez em `tests/inbound.test.mjs` ("remetente ligado a duas empresas"): aprovação 409 `review_failed`; isolado, o teste passou 3/3. **Causa demonstrada:** as regras de conteúdo liam o texto com o link de descadastro, cujo token é base64url aleatório; entre dígitos, `-` ou `_`, o token forma por acaso siglas do catálogo (`CGM`, `CSO`, `CGF`, `UCO`) ou palavras vetadas, e PV2/PV7 reprovavam a ficha. Simulação com a sequência real e 200.000 tokens aleatórios: ~50 reprovações (~1 em 4.000 fichas), afetando também produção. **Correção** (`src/review.js`): regras de conteúdo leem o texto sem os links de descadastro da própria ficha; PV2 (só o próprio link) e R19.13 (link e endereço presentes) continuam no texto original. Mesma simulação depois: 0 reprovações. Teste novo em `tests/review.test.mjs` (falha sem a correção; sigla fora do link continua reprovando; link ausente continua reprovando R19.13). Suíte 323 + 2.

## 2026-09-27 — MDIC mensal pelo GitHub em produção (main)

- **main:** `origin/main` (`38eea61`, projeto inicial) era ancestral de `v2-revisao-2` → avanço rápido sem conflitos para `ddc865b`. O `deploy.yml` antigo da main (Node 18, `wrangler.toml` do protótipo) já tinha sido removido na branch e não roda mais. Workflows ativos: "Validate EAG Compass" e "MDIC mensal".
- **Execução manual** (Rogério cadastrou `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`): https://github.com/rogeriopalhari23-dotcom/EAG-Agro/actions/runs/36351899211 — `workflow_dispatch` em `ddc865b`, rotina mensal completa (sem país), 21:29–21:36 UTC, **success**. Testes do job no runner 8/8; TLS conferido (OV R36 ← Root R46); 2026 e 2025 lidos inteiros (24 pedaços, sem reset); segredos só como `***` no log e o ID da conta não aparece.
- **Resultado conferido no D1/R2 (não só pelos testes):** versão `2026-09-mdic` (`monthly`, `complete`), 250 países (229 com compra identificada, 21 sem registro), 250 ponteiros MDIC nessa versão, auditoria `trade_list.mdic_published` por `system-mdic-job`. Alemanha: ponteiro revisão 2 → `trade-src/2026-09-mdic/mdic/DEU.json`, SHA-256 `30c4cf6b…4b5542` igual ao objeto baixado do R2; estado `purchase_identified`, fonte `mdic`, FOB, "exportações do Brasil", meses 2025-01..2026-08, 2.882 linhas — **linhas idênticas** às da importação local de 25/09.
- **Agendamento:** `cron: '0 12 10-12 * *'` no arquivo da main (workflow `active`); próxima execução 2026-10-10 12:00 UTC (09:00 Brasília), com repescagem nos dias 11 e 12 que sai sem mexer se o mês já estiver `complete`.
- **Conferência no EAG Compass (produção, sessão do Access de Rogério):** `POST /api/country-analyses {"iso3":"DEU"}` → 201; Alemanha, fonte "Exportações do Brasil (FOB, mensal, visão do Brasil)", versão **`2026-09-mdic`**, "compra identificada", janela da análise 2025-09..2026-08 (12 meses, D1), 338 linhas, snapshot reproduzido. Comtrade "dados indisponíveis" (chave ainda recusada; integração **não** validada).

## 2026-09-27 — Comtrade: chamada real com a chave regravada por Rogério → 401 (integração NÃO validada)

Diagnóstico novo `POST /api/integrations/comtrade/check` (admin, auditado; devolve só códigos, mensagem do gateway com a chave mascarada — inclusive trechos testados —, metadados da consulta e o formato do valor; testes em `tests/integrations.test.mjs`). Publicado (versão `85475955…`). Execução real em produção (base `https://comtradeapi.un.org`):
- Consulta: `/data/v1/get/C/A/HS`, reporter 276 (Alemanha), partner 76 (Brasil), fluxo M, HS 090111, período 2024, `partner2Code=0`, `customsCode=C00`, `motCode=0`.
- Chave no cabeçalho `Ocp-Apim-Subscription-Key` (forma do Compass) → **401** "Access denied due to invalid subscription key. Make sure to provide a valid key for an active subscription."
- Chave na query `subscription-key` → **401**, mesma mensagem.
- Sem chave → 401 "Access denied due to **missing** subscription key" (o gateway reconhece que o valor é enviado nas duas formas).
- Mesmos parâmetros no endpoint público `/public/v1/preview/C/A/HS` → **200**, 1 registro: 2024, 276 Germany, 76 Brazil, M Import, 090111 "Coffee; not roasted or decaffeinated", CIF US$ 2.023.562.552, 502.695.236 kg — **endpoint e parâmetros corretos**.
- Formato do valor gravado (sem o valor): 53 caracteres, sem espaços nas bordas ou no meio, letras maiúsculas e minúsculas, dígitos e `_` — o mesmo comprimento do valor anterior.
- Conclusão demonstrada: endpoint, parâmetros e forma de autenticação estão corretos; o gateway recusa o valor como chave de uma assinatura ativa para esta API. Fonte oficial (https://uncomtrade.org/docs/api-subscription-keys/): a chave da API é emitida no **Developer Portal** (`comtradedeveloper.un.org`), aparece em `comtradedeveloper.un.org/profile` numa assinatura com estado "Active" → "Show keys"; para assinantes premium é gerada automaticamente depois do primeiro login no Developer Portal (com aviso por e-mail); usuários gratuitos assinam o produto "Free APIs". Hipótese a conferir por Rogério: o valor copiado vem de outra tela/credencial (ex.: conta do portal de dados Comtrade Plus) e não da chave primária da assinatura no Developer Portal, ou a assinatura ainda não está "Active". A versão `2026-09-manual-DEU-608914c6` **não** foi retomada (repetiria o 401 e consumiria cota); a análise da Alemanha segue com Comtrade "dados indisponíveis" e MDIC da versão `2026-09-mdic`.

## 2026-09-27 (noite) — Comtrade validada por chamada real; Alemanha com Comtrade e MDIC separados

- **Chave nova (gravada por Rogério; valor nunca exibido):** `POST /api/integrations/comtrade/check` → **200**, 1 registro: 2024, 276 Germany ← 76 Brazil, M Import, 090111 "Coffee; not roasted or decaffeinated", CIF US$ 2.023.562.552,46, 502.695.236 kg (endpoint `/data/v1/get/C/A/HS`, chave no cabeçalho `Ocp-Apim-Subscription-Key`).
- **Segundo defeito revelado pela chave válida:** retomada da versão `2026-09-manual-DEU-608914c6` → as 3 chamadas de dados falharam com **414**. Medição com a chave real (novo modo `{"cmdCount": n}` do diagnóstico, só código e tamanho): 298 códigos = 2.865 caracteres → 414 "Request URL exceeds maximum allowed length of 2000 characters"; 150 códigos = 1.533 caracteres → 200 (419 registros). O 401 anterior escondia o limite.
- **Correção:** `loadHsBlocks` passa a dimensionar os blocos pelo limite (`MAX_URL` 2000, orçamento de 1.650 caracteres para `cmdCode`) → 894 códigos em **5 blocos** de ~179 (maior URL ~1.800); `fetchImports` recusa URL acima de 2000 antes de chamar (não gasta cota). Efeito na cota: 5 chamadas de dados por país declarante em vez de 3. Jobs do MDIC de versões criadas antes de `MDIC_SOURCE=github` deixam de tentar pelo Worker (falha `superseded` só na versão; ponteiro do MDIC intocado). Testes novos em `tests/comtrade.test.mjs` e `tests/trade-list.test.mjs`; suíte 326 + 2. Publicado (versão `6c3be3f5…`).
- **Nova atualização manual da Alemanha** (`2026-09-manual-DEU-0d4ed1a4`, motivo registrado) → **complete**: HS.json, disponibilidade, 5 blocos e consolidação, todos na 1ª tentativa. Comtrade DEU: `purchase_identified`, anos declarados **2023–2025** (último 2025), 3.051 linhas, 738 SH6, origens mundo e Brasil, CIF, "importações declaradas pelo país"; ponteiro revisão 1, SHA-256 `4b4988b7…29f0b0bc` igual ao objeto do R2. Conferência cruzada: café 090111, 2024, Brasil = **US$ 2.023.562.552,46** no objeto = valor da chamada direta.
- **Análise no EAG Compass** (`POST /api/country-analyses {"iso3":"DEU"}` → 201, snapshot reproduzido, 738 linhas): Comtrade "Compras declaradas pelo país (CIF, anual, visão do importador)", versão `2026-09-manual-DEU-0d4ed1a4`, anos 2023–2025; MDIC "Exportações do Brasil (FOB, mensal, visão do Brasil)", versão `2026-09-mdic`, janela 2025-09..2026-08 — cada linha traz os dois blocos separados (ex.: 090111: Comtrade 2025 mundo US$ 6,50 bi, Brasil US$ 2,43 bi, 37,4%; MDIC 12 meses FOB US$ 2,09 bi).
- **Versão antiga `2026-09-manual-DEU-608914c6`:** retomada de novo só para a varredura (a varredura da lista mensal roda no cron diário 02:17 UTC) → job `mdic_ref` marcado `superseded` ("MDIC lido pelo workflow do GitHub"), versão fechada como `partial` às 23:02 UTC. Ponteiros da Alemanha conferidos depois: Comtrade `2026-09-manual-DEU-0d4ed1a4` (rev. 1), MDIC `2026-09-mdic` (rev. 2) — inalterados.

## 2026-09-27 (noite) — Radar Internacional: lista de países importadores, resumo curto e busca de pequenas e médias importadoras

**Decisão de Rogério (2026-09-27):** "Pequena entra nos dois mercados" — exceção P16/P17 (skill I3, K1) registrada na Constituição; Spec R14.3/R14.6 e T12 (K1) revisados. Pequeno porte (Receita `03`; exterior `small`) entra no ICP e pode ter ficha; micro/MEI (`01`; exterior `micro`) e gigante sem relacionamento continuam fora; trader só com exceção. Migração `0019` (coluna `size_class` com `micro`; porte-alvo da campanha aceita "pequeno ou maior"; perfis `out_small` de pequeno porte voltam ao ICP).

**Implementado e testado:**
- Lista básica de países importadores (`GET /api/radar/importers`, tela Radar Internacional): nome, commodities agrícolas de origem Brasil (até 5 SH6 de maior valor), período e fonte, MDIC e Comtrade lado a lado, sem soma; filtro "com compra identificada" e busca por nome. Lê só resumos guardados (`trade_country_summary`, migração `0020`) com o hash do objeto vigente — resumo antigo nunca aparece como atual. Resumos gravados na publicação (job do GitHub para o MDIC; consolidação da Comtrade no Worker) e completados pelo cron diário/`POST /api/radar/importers/summaries/rebuild` (só R2, sem chamada externa).
- Escolher país: resumo curto por fonte (compra identificada, commodities, período, fonte); análise com a mesma lista e o mesmo período é reaproveitada (`reused: true`, nenhum registro novo); tabela completa só sob demanda.
- Busca de empresas por campanha (migração `0021`; `src/foreign-search.js`): só após seleção registrada e autorização de Gestor/Admin (idempotente); porte-alvo padrão pequenas e médias; resultado em três grupos — consumidoras finais/fábricas/processadoras, perfil a confirmar, traders (prioridade secundária); por empresa: nome, porte com fonte, atividade com fonte, site, "importadora confirmada" só com evidência empresarial validada da própria empresa (fonte e data do fato), senão "potencial compradora a validar" com os indícios (fonte e data), decisores com fonte, pendências e elegibilidade de ficha (aprovação individual mantida). Cobertura (fontes consultadas, com e sem resultado; "nunca integral"), custo (chamadas, US$, minutos, horas) e rendimento. Roteiro de pesquisa com links montados, não executados; base paga só com decisão registrada (R13.7).
- Correções encontradas: a API de evidência não registrava que condição a evidência sustenta (agora `supports`); indício comercial deixou de confirmar condição (só evidência empresarial, P1/R14.2); dado de mercado recusado como suporte.
- Testes: `tests/importers.test.mjs` (4), `tests/foreign-search.test.mjs` (2), `tests/profiles.test.mjs` e `tests/mdic-job.test.mjs` ampliados; fixture da NCM passou a vir em windows-1252 como a fonte real; UI smoke com o fluxo novo (lista → resumo → commodity → autorizar busca → registrar empresa) e 390 px. Suíte 332 + 2.

**Publicado e validado em produção:** bookmark D1 antes das migrações `000003a5-00000000-000050f3-1dbd7ff80c51299a6e5674cd518fbeeb`; migrações 0019–0021 aplicadas; Worker `b154aa61…`. Resumos preparados: 264 (250 MDIC + Comtrade), 0 pendentes, sem falhas. Lista: 219 países com compra identificada (MDIC, janela 2025-09..2026-08); Alemanha MDIC US$ 3,07 bi (café, bagaços de soja, carnes de frango e bovina, tabaco) e Comtrade 2025 US$ 4,65 bi origem Brasil (= total da importação conferida). Escolher Alemanha reaproveitou a análise `2fa02b78…` (nenhuma análise nova). **Não exercitado em produção:** seleção, autorização de busca e cadastro de empresas (criariam campanha e registros reais) — validados por testes e UI smoke.

**Depende de fonte de dados de empresas:** não há fonte automática de empresas no exterior; candidatos vêm de pesquisa registrada (diretórios, registros oficiais, sites). Evidência de importação por empresa (registros aduaneiros/conhecimentos de embarque) é fonte paga e exige decisão de custo e cobertura (R13.7). A Comtrade da lista mensal só existe hoje para a Alemanha (atualização manual); os demais países ganham a Comtrade na primeira rotina mensal completa.

## 2026-09-27/28 — Radar Internacional: descoberta de candidatas importadoras por fontes gratuitas

Pesquisa, testes e comparação completos em `docs/implementation/FONTES-EMPRESAS-EXTERIOR.md`.

- **Requisito de Rogério durante o trabalho:** "as empresas candidatas devem ser importadoras". Aplicado: só empresa com evidência ou **sinal próprio de importação** fica nos grupos principais ("Importadoras — …"); quem apenas usa a commodity fica em "Importação não verificada" (recolhido). Níveis: empresa encontrada → potencial importadora (sinal próprio: EORI ativo, registro de embarque visto, associação de importadores, site da empresa) → importadora confirmada (documento da empresa conferido). MDIC/Comtrade, atividade e EORI nunca confirmam importação da commodity (testado).
- **Implementado:** adaptadores OpenStreetMap, registro oficial da França (atividade NAF + faixa de efetivo INSEE como filtro de porte-alvo), registro da Noruega, EORI da UE (FR+SIRET, sinal automático), GLEIF (identidade); mapa commodity→atividades `descoberta-v1` (proposta NACE Rev.2, editável por busca); candidatos em `discovery_candidates` (migração 0022) até a pessoa aceitar/descartar; aceitar cria a empresa com atividade, porte oficial e perfil de indício, com fontes; formulário no cartão para registrar sinal ou prova; métricas de encontradas, candidatas importadoras, não verificadas e evidência própria; etapas humanas listadas.
- **Achado de produção:** o servidor público do OSM recusa conexões da Cloudflare (521/522 a partir do Worker; do computador 200). Solução: a consulta montada pelo Compass roda no navegador (CSP libera só `overpass-api.de`; CORS `*` conferido; Chrome real de outra origem: 200, 59 elementos, 8,3 s) e o Worker trata o resultado. Demais fontes alcançáveis do Worker: França 200, EORI 200, Noruega 200, GLEIF 200 (`POST /api/integrations/discovery/reach`).
- **Teste ponta a ponta com APIs reais** (banco local temporário, nada em produção): Alemanha/café 58 encontradas, **0** com sinal próprio de importação (não há sinal gratuito por empresa na Alemanha); França/café 204 encontradas, **105 candidatas importadoras** (62 processadoras PME + 43 traders com EORI ativo), 96 não verificadas, 3 possíveis duplicatas retidas, 0 confirmadas.
- **Bases pagas comparadas, nada contratado:** Export Genius (grátis limitado; US$ 1.400–9.000/ano), Volza (desde US$ 1.500/ano; teste de 7 dias), ImportGenius (EUA US$ 229–449/mês; países adicionais desde US$ 159/mês), TradeAtlas (US$ 2.950–9.950/ano), Panjiva (US$ 5–50 mil+/ano, fonte secundária), ImportYeti (grátis, só EUA). Recomendação: amostra "importadores alemães de café verde SH 090111 origem Brasil" antes de qualquer contratação (R13.7).
- Testes: `tests/discovery-adapters.test.mjs` (4), `tests/discovery-flow.test.mjs` (4), `tests/foreign-search.test.mjs` atualizado; UI smoke cobre registrar sinal no cartão → empresa sobe para "Importadoras". Suíte 340 + 2. Publicado: migração 0022 (bookmark antes `000003b9-00000000-000050f4-d228c7892440332c0a46cf726e916853`), Worker `569f492f…`.

## 2026-09-28 — Fontes do governo brasileiro testadas e diretório do Deutscher Kaffeeverband implementado

Detalhes e tabela em `docs/implementation/FONTES-EMPRESAS-EXTERIOR.md` §6.
- Catálogo de Empresas Estrangeiras: indisponível desde a migração para o gov.br (aviso oficial em `…/invest-export-brasil/erro`); BRAEXP no ar com listas de importadores sob demanda por SECOM, **sem serviço do SECOM Berlim**; diretórios alemães da página "Oportunidades de Negócios": IXPOS 404, BDEx fora do alvo (exportadores), Europages/TradersCity/Export Helpdesk bloqueados (202/403). Nenhuma integração baseada em página antiga.
- Fonte nova utilizável: **Deutscher Kaffeeverband — Kaffeekontakte** (grátis, sem chave, termos sem restrição, alcançável do Worker). Implementado: descoberta (2 buscas), descarte automático com motivo (fora do país; prestador), validação por perfil em lotes com **cache por empresa** (`research_cache`, prazo de 180 dias; prazos por fonte definidos), declaração de importação em primeira pessoa vira evidência de sinal (pendente, com URL e data), quatro estados distintos (empresa encontrada, potencial compradora, importadora confirmada — com origem Brasil à parte — e consumidora final confirmada), custo e tempo por candidata válida. Migração 0023 (bookmark antes `000003c6-00000000-000050f4-ee5718723c5b14143f417b481987caa8`), Worker `33a03aa3…`.
- Caso real Alemanha + café verde: 73 encontradas → 60 para revisão (36 torrefações, 16 traders, 8 a classificar) → **6 potenciais compradoras com declaração própria de importação** → **0 com prova individual**. Custo US$ 0; ~14–17 s por candidata válida.
- Achado de produção: o registro francês respondeu 429 a partir do Worker (limite por ASN da API, documentado); tratado como temporário.
- Testes: `tests/kaffeeverband.test.mjs` (casos reais que exigiram ajuste das regras), suíte 342 + 2, UI smoke OK.

### 2026-09-28 — Pessoas de compras nos dois radares

- Implementado: migração `0024_pessoas_de_compras.sql` (`person_candidates` com nome/cargo/e-mail/telefone criptografados e hash do nome; `people_research`), `src/adapters/people.js` (Impressum com robots.txt; BrasilAPI QSA), `src/people.js` (triagem de aderência, até 3 pessoas, lote de 5 por busca, reaproveitamento por prazo, aceite como contato, descarte, registro manual com fonte obrigatória), rotas `/api/companies/:id/people[...]` e `/api/foreign-searches/:id/people/research`, painel "Pessoas de compras" na empresa e na busca, sondas BrasilAPI e Impressum em `/api/integrations/discovery/reach`.
- Teste real: DE 48 empresas → 37 Impressum → 21 com representante (24 pessoas), 0 e-mail pessoal, US$ 0, ≈12 s por empresa útil. BR 3 CNPJs de Franca/SP → 5 sócios-administradores, 0 e-mail. Detalhes em FONTES-EMPRESAS-EXTERIOR.md §7.
- Correções achadas no teste real: robots.txt com curinga (`/*?add-to-cart=`) era lido como bloqueio total (19 falsos bloqueios); falsos nomes ("Systemen. Inhalte", "Radbruch Nachfolger", "Commerzbank Leipzig"); lista de exclusão pegava "ust" dentro de nomes (Muster, Gustav).
- Testes: `tests/people.test.mjs`; suíte 348 + 2; UI smoke OK. Workflow de diagnóstico `receita-velocidade.yml` removido.
- Alcance pelo Worker em produção (versão `07ee88c2`, `POST /api/integrations/discovery/reach`, 2026-09-28, HTTP 200 em 48 s): BrasilAPI QSA 200 (370 ms, 1 administrador), Impressum 24grad 200 (1,4 s, representante encontrado), Kaffeeverband 200 (40), EORI 200, Noruega 200 (110), GLEIF 200 (5); OpenStreetMap 522 (Cloudflare recusada — continua no navegador) e registro da França 429 (limite por ASN — temporário). Só leitura; uma linha de auditoria.

### 2026-09-29 — SUPPRESSION_HMAC_KEY em produção e pesquisa de pessoas retomada

- Verificado: Worker `eag-compass-production` (configuração de topo do `wrangler.jsonc`; o único ambiente nomeado é `local`). Secrets antes: `COMTRADE_KEY`, `PII_ENCRYPTION_KEY`, `UNSUB_TOKEN_KEY` — `SUPPRESSION_HMAC_KEY` nunca havia sido cadastrada.
- Registros dependentes de chave anterior: nenhum (`suppression_entries` 0, `contacts.email_hash` 0, `send_outbox.email_hash` 0, `inbound_messages.from_hash` 0, `person_candidates` 0). Sem recuperação ou migração necessária.
- Corrigido: chave de 32 bytes aleatórios (Base64, formato exigido por `secretKey`) gerada em memória e enviada por stdin ao `wrangler secret put`; o valor não foi exibido nem gravado em arquivo, log ou Git. **Não há cópia fora da Cloudflare**: trocá-la depois invalida os hashes da lista de supressão.
- Validação interna nova (`POST /api/integrations/suppression/check`, só admin, só leitura, endereço reservado `.invalid`): em produção `keyLoaded`, `stableHash` e `lookupOk` verdadeiros; endereço de teste não suprimido; lista com 0 entradas; nada gravado além da linha de auditoria.
- Pesquisa retomada pelo lote da busca DEU/café: só as 3 empresas sem pesquisa válida (as 2 já pesquisadas foram reaproveitadas). 24grad Kaffeerösterei, Azul Kaffee e Black & Yum: 1 representante legal cada no Impressum (2 consultas por empresa), todos "contato de compras a validar". Amori Coffee (Impressum sem nome) e Barista World (sem site) ficam para a pesquisa assistida. Nenhum contato criado, nenhum envio.
- Corrigido: o prazo de nova pesquisa ficava sempre em 30 dias (`Math.min(..., 30)`); agora segue a fonte (Impressum 180 dias, QSA 90). As 5 pesquisas já gravadas mantêm 30 dias (só antecipa a reconferência; não duplica pessoas).
- Testes: 349 + 2. Versões publicadas: `af7d8c55` (diagnóstico) e `3b169dfb` (prazo).

### 2026-09-29 — Pessoas de compras: segunda rodada nas 5 empresas da busca DEU/café

- Fontes testadas por empresa: site próprio (sobre, equipe, origem do café, contato), buscador, registro comercial (North Data), imprensa, perfis públicos do LinkedIn **só como resultado de buscador** (nenhum acesso automatizado ao LinkedIn). Reaproveitado: texto do diretório do Kaffeeverband já em cache.
- 24grad: Markus Glaubitz (já registrado) — retrato da IHK (04/02/2025): diretor-geral único desde 2017 e cuida pessoalmente das relações com produtores e viagens à origem. Cofundador Dr. Jürgen Piechaczek sem vínculo atual comprovado (não registrado). Página de equipe só com primeiros nomes, sem cargos.
- Azul: registrado Nils Kästingschäfer — "Rohkaffee-Einkäufer bei Azul" (página da própria Azul) e procurador (ppa) desde 26/11/2024 (North Data). Jörg Bieß (já registrado) é diretor-geral. **Achado de aderência:** sócia Alois Dallmayr KG (North Data, 2025); Dallmayr comprou a Azul em 1997 (taz), ~150 funcionários — empresa de grupo grande, decisão de ICP pendente com Rogério. Site azul.de recusou conexão daqui; loja shop.azul.de respondeu.
- BLACK & YUM: Reinhold Schmelter (já registrado), dono e fundador ("Über uns"); o site diz que o café verde vem de comércio direto e de importadores de especialidade, sem nomear quem compra; perfil público no LinkedIn localizado pelo buscador. Nenhuma outra pessoa com função de compras encontrada.
- Amori Coffee: registrado Roberto Cascone — "Inh." na página de contato e fundador em "Unsere Story"; compra café verde de importadores parceiros. O leitor de Impressum não reconhecia a abreviação "Inh." — corrigido com teste.
- Barista World: site correto confirmado (barista-world.de: mesma pessoa, cidade e texto do diretório) e gravado na empresa; registrada Nana Holthaus-Vehse, "Vertretungsberechtigte Geschäftsführerin" (página de contato). Atividade: treinamento, eventos e consultoria de barista — compra de café verde não evidenciada. Impressum e outras páginas bloqueadas por Wordfence para a nossa região (não contornado); e-mail citado num diretório de terceiros não registrado (certificado TLS inválido).
- Nenhum e-mail deduzido; nenhum contato aceito; nenhuma ficha, aprovação ou envio (produção: 6 pessoas a validar, 0 contatos, 0 aprovações, fila de envio vazia). Versão publicada `b9bc0c2e`.

### 2026-09-30 — Triagem na busca DEU/café (decisões de Rogério) e evidência da 24grad

- Implementado: migração `0025_triagem_na_busca.sql` — prioridade (principal/secundária), descarte com motivo e retorno por **combinação empresa/produto da busca** (a empresa, pessoas e evidências ficam), e pontos a verificar com conclusão e fonte. Rotas `PATCH /api/foreign-searches/:id/candidates/:companyId`, `POST …/checks`, `PATCH …/checks/:checkId`; o lote de pessoas ignora descartadas e deixa as secundárias por último; tela com seção "Descartadas nesta busca". Teste em `tests/people.test.mjs`; suíte 350 + 2; UI smoke OK. Ponto de restauração D1 antes da migração: `000005f0-00000000-000050f5-a145fe3fe0247dff174991d6c44aceee`; versão `eec926aa`.
- Azul: prioridade secundária; pontos a verificar "Vínculo com grupo" (North Data, publicação de 12/05/2025, a conferir no registro oficial) e "Autonomia de compras de café verde". **Correção da entrada anterior:** a notícia de 1997 (taz) não comprova a composição societária atual e não deve ser usada para isso.
- Barista World: descartada desta busca (café verde) com o motivo registrado; empresa e histórico preservados.
- 24grad: ponto "Responsabilidade de compra de Markus Glaubitz" com as citações do retrato da IHK (04/02/2025). O texto também diz que os grãos são comprados de fornecedores; não afirma que ele decide a compra. Site e blog da 24grad conferidos: sem declaração explícita de quem compra.
- Contatos profissionais: nenhum perfil próprio localizado para Markus Glaubitz ou Roberto Cascone; para Nils Kästingschäfer o buscador cita perfil XING (Head of Procurement/Prokurist desde 11/2024), sem link obtido — registrado como ponto a conferir.

### 2026-09-30 — Estados separados, ficha de identificação do responsável e rascunhos em alemão

- Implementado: migração `0026_ficha_identificacao.sql` — canal geral da empresa como contato não pessoal (`contact_kind=company_channel`), finalidade e idioma por versão da ficha (`meeting`/`identify_buyer`), indício de responsabilidade de compra na pessoa (texto + fonte, nunca confirma). Ficha de identificação: destinatário só canal geral, sem exigir decisor (PV3 "descobrir a pessoa certa"); 2 e-mails (dias 0 e 5), sem reunião, preço, lote ou volume; revisor próprio (ID0 modelo aprovado por Rogério, ID1 pergunta certa, ID2 canal geral e cadência, PV2/3/4/7/9/10/12, R19.13); modelos pt-BR, inglês e alemão (`src/templates/identificacao.js`), cada um com aprovação própria (`templates_ident_approved`). Ficha de reunião recusa canal geral como destinatário. Tela: quatro estados separados por pessoa (contato relevante aceito / responsabilidade de compra pendente ou decisor confirmado / destinatário aprovado para abordagem, e cargo verificado), canais gerais, registro de canal e botão da ficha de identificação na busca. Testes em `tests/ficha-identificacao.test.mjs`; suíte 353 + 2; UI smoke OK. Ponto de restauração D1: `000005f7-00000000-000050f6-f3d2dd1ac57c972f0c96f052969a3b30`; versão `bbcc9848`.
- Produção: indício registrado (sem confirmação) para Markus Glaubitz (retrato IHK) e Nils Kästingschäfer (Prokura na Azul em 26/11/2024 pelo North Data — https://www.northdata.de/K%C3%A4stingsch%C3%A4fer,+Nils,+Bremen; "Head of Procurement" só como indício do buscador). Ponto da 24grad que transferia a confirmação a Rogério foi reformulado como pendência de evidência. Canais gerais registrados com fonte e fuso Europe/Berlin: info@24grad.net, info@amori.coffee, genuss@blackandyum.de (publicado como "genuss ∂ blackandyum.de"). Nenhuma pessoa aceita, nenhuma ficha criada (porte pendente bloqueia a ficha, R14.8), nenhum envio.
- Rascunhos em alemão para revisão: `docs/implementation/RASCUNHOS-IDENTIFICACAO-DEU.md` (gerados por `scripts/rascunhos-identificacao.mjs` com o gerador e o revisor do sistema).

### 2026-09-30 — Revisão das três fichas de identificação (24grad, Amori, BLACK & YUM)

- **Correção de requisitos sem base na Spec:** removidos do revisor da ficha de identificação o ID0 (aprovação extra do modelo por idioma, com o parâmetro `templates_ident_approved`) e o teto "até 2 e-mails". A aprovação individual da ficha já aprova o texto exato (R18.3). Ficam só regras da Spec: PV3 (objetivo "descobrir a pessoa certa"), R19.2 item 12 (dias não seguidos), PV2, PV4, PV7, PV9, PV10, PV12, R19.13; o destinatário ser o canal geral é a definição da ficha pedida por Rogério. E-mail 2 passa ao dia 4 (como o E-mail 2 da skill). PT/EN dizem "commodities agrícolas", igual ao alemão. Versão `0b7ff9f3`.
- **Canal:** os três endereços estão publicados nos sites oficiais (Impressum/contato); o de BLACK & YUM aparece mascarado ("genuss ∂ blackandyum.de"). MX por DNS (DoH Cloudflare, 30/09/2026): 24grad.net → www53.your-server.de; amori.coffee → mx00/mx01.udag.de; blackandyum.de → mail.blackandyum.de. MX só mostra que o domínio recebe e-mail; não prova que o endereço existe nem que entrega. Nenhum teste de SMTP nem envio.
- **Verificador:** a Spec exige "validado por verificador, com data" (R19.2 item 11, skill I6), sem nomear fornecedor; Snov.io é a escolha aprovada na decisão técnica G11 (22/09/2026; catch-all/unknown não validam). Outro verificador exigiria nova decisão e, em geral, contratação; sondagem SMTP direta não foi feita (contato com o servidor da empresa e porta 25 bloqueada em Workers). Sem a chave Snov, os três ficam "não validados".
- **Porte:** desconhecido nas três (North Data mostra só o capital social da 24grad, EUR 25.000; Amori e BLACK & YUM são empresas individuais, sem dado público de funcionários). Nada foi classificado.
- **Fichas não criadas:** o sistema recusaria as três por (1) validação comercial do café na seleção da Alemanha pendente (R12.9) e (2) porte desconhecido sem objetivo de qualificação registrado (R14.8). Revisão lado a lado em `docs/implementation/RASCUNHOS-IDENTIFICACAO-DEU.md`.

### 2026-09-30 — Itens pendentes preparados para decisão (Alemanha/café verde)

- Documento de decisão: `docs/implementation/DECISOES-PENDENTES-DEU.md` (porte/ICP e lacuna do limite numérico no exterior; R14.8 atual × proposta; validação comercial R12.9 explicada — causa: "Café" sem código SH/NCM no catálogo; Snov ausente no Worker de produção, com origem das credenciais e comandos).
- Pesquisa sem decisão: 64 candidatas do diretório do Kaffeeverband validadas em produção (64 chamadas, 0 falhas): 13 prestadores descartados automaticamente, 55 relevantes aguardando aceite, 6 com declaração própria de importação (5 traders/importadores e Dethlefsen & Balk). Nenhuma aceita.
- 24grad: evidência de porte registrada como ponto a verificar, sem classificar — IHK 04/02/2025, "mehr als 20 Festangestellte, plus etwa ebenso viele Minijobber und Werksstudenten", faturamento 2024 "im niedrigen einstelligen Millionenbereich". BLACK & YUM: diretório com "6 funcionários (2011)" não usado (dado antigo e certificado TLS inválido). Amori: perfil LinkedIn público de Roberto Cascone (fundador) registrado como canal para consulta manual.

### 2026-09-30 — Revisão consolidada para decisão (Alemanha/café verde)

- `docs/implementation/DECISOES-PENDENTES-DEU.md` reescrito como revisão única: números reconciliados (73 únicas = 5 aceitas + 13 descartadas [4 em 28/09 fora da Alemanha + 9 nesta rodada, prestadores] + 55 aguardando; o "13 descartadas" do relatório anterior era acumulado), seis autodeclarações de importação com fonte e data (nenhuma menciona o Brasil), Azul com procuração, cargo e autoridade separados (evidência de Kästingschäfer reescrita em produção), efeito exato da validação comercial por etapa (pesquisar: não exige; ficha, ativação e aprovação: exigem), porte (regra vigente, lacuna numérica e proposta UE 2003/361/CE), R14.8 atual × proposta, textos DE/PT, caminho do Snov.
- Pesquisa: aviso legal lido em 6 candidatas ainda não cobertas (CR3, Coffein Compagnie, Utamtsi, Gollücke & Rothfos com representantes; Ecom Kaffee e HACOFCO sem Impressum nos caminhos padrão). Resultado reaproveitado de 28/09 para as outras 43. Nenhum dado gravado para candidatas não aceitas.

### 2026-09-30 — Porte ordena, não exclui (decisão de Rogério) e revisão única da busca Alemanha/café

- Governança: Constituição (nova linha de exceção P16/P17), Spec R14.3, R14.6, K1, AT59, AT63 e registro de decisões; FONTES (registro francês sem filtro de porte).
- Código: `canHaveFicha` — micro com perfil de uso da commodity aceita ficha (prioridade menor), grande/grupo aceita ficha com pendências (unidade, uso, autonomia, acesso); rótulos e ordenação (Radar, tarefas, busca internacional); pesquisa de pessoas inclui micro, grande/grupo e trader (trader por último); registro francês busca faixas-alvo e depois todas. Testes ajustados à regra nova.
- Evidência de contatos das candidatas: `POST /api/foreign-searches/:id/discovery/contacts` lê o aviso legal das candidatas não aceitas e guarda o resultado cifrado em `research_cache` (fonte `impressum`); aparece no painel e é reaproveitado depois do aceite (sem nova requisição). Site que recusa a conexão agora fica "inacessível" (antes "sem aviso legal") e expira em 7 dias. Produção: 49 sites — 23 com representante, 10 sem nome, 12 inacessíveis, 3 sem aviso legal, 1 robots.txt; 6 sem site. Nenhuma candidata aceita.
- 24grad: ponto de porte reescrito — evidência IHK 04/02/2025 ("mehr als 20 Festangestellte…"), sem limite superior, sem classificação.
- Descartes revisados: nenhum em produção foi só por porte ou grupo.
- Revisão para decisão: `docs/implementation/DECISOES-PENDENTES-DEU.md`. Suíte 355 + 2; UI smoke OK; versão `d0ebdeca`.

### 2026-09-30 — Tela "Revisão para decisão" e investigação das candidatas

- Implementado: `GET /api/foreign-searches/:id/review` e tela "Revisão para decisão" (frase da validação comercial com efeito, cumpridos e pendentes; referência de porte UE com regras de grupo e estimado × comprovado; R14.8 atual × proposta; textos DE/PT lado a lado; dez candidatas com atividade, evidência de compra/consumo, porte, contato, pendências e recomendação; classificação a revisar; descartes a reconsiderar; sites inacessíveis com pesquisa assistida e fontes permitidas — North Data, Unternehmensregister, perfil do diretório, busca no site, LinkedIn manual; Snov com passos). Só leitura: não aceita, não aprova, não ativa, não envia. Migração `0027_investigacao_candidatas.sql` (tipo de atividade e vínculo com grupo, com fonte); `PATCH …/discovery/:id` (investigação) e `POST …/discovery/restore` (devolução por Rogério, com motivo). Testes `tests/decision-review.test.mjs`; suíte 357 + 2; UI smoke OK; ponto de restauração D1 `00000603-00000008-000050f6-69f08a2d5a190e7de942d9de02e392a0`; versão `5eef2a40`.
- Investigação registrada em produção (12 empresas; tabela em DECISOES-PENDENTES-DEU.md §7): cache do diretório reaproveitado; leitura nova só de CR3, Coffein Compagnie e ECOM, porque o cache não respondia. Representante legal em comum (Schirmer/Azul) registrado só como indício fraco.
- Correção achada na revisão: a sugestão de devolução confundia fornecedor "für Kaffeeröstereien" com torrefação; agora exige frase em primeira pessoa ou atividade investigada (teste de regressão). "Sem resposta" substitui "HTTP 0" nos sites inacessíveis.

### 2026-09-30 — Nome não descarta; grupo não reduz prioridade; auditoria dos descartes

- Classificador do diretório (`src/adapters/kaffeeverband.js`): descarte automático só com evidência de atividade incompatível no TEXTO (autodescrição de prestador ou predomínio de vocabulário de serviço) e sem torra em primeira pessoa; nome de prestador sozinho → "a triar" com o motivo. Torra genérica ("Rösten", "Röstung") não protege fabricante de máquinas; "eigenen Kaffee zu rösten" e "hauseigene Rösterei" protegem. Testes com textos reais (Haberland, Neuhaus, Röst & Pack).
- Auditoria dos 13 descartes (cache reaproveitado, sem nova consulta): 4 por endereço fora da Alemanha e 6 com evidência no texto mantêm o descarte; 3 foram só pelo nome e ficam para decisão de Rogério — Haberland Getränkesysteme (texto: "unseren eigenen Kaffee zu rösten … Marke „Moin Bohne“"), NKG Kala (texto descreve serviço para clientes — beneficiamento, grupo Neumann) e Guse Transport + Logistik (texto: "Europas führender Transporteur für Rohkaffee"). Nenhum status alterado.
- Ordem: sem redução automática por vínculo com grupo; critérios aderência → evidência de uso/compra → unidade compradora → contatos; porte (pequena/média primeiro) só desempata — revisão (`decision-review.js`), busca internacional (`foreign-search.js`), Radar nacional (aderência → distância → porte) e tarefas. Spec R14.3 atualizada. Suíte 357 + 2; UI smoke OK; versão `11f33fd0`.

### 2026-09-30 — Textos de identificação de Rogério (v1.1.0), acompanhamento sem "Re:", endereço sem confirmação, teste de assinatura

- Modelos `id-de-1.1.0` e `id-pt-1.1.0` com os textos de Rogério, palavra por palavra (teste compara o texto integral). Inglês segue `id-en-1.0.0`.
- Acompanhamento do dia 4 com o mesmo assunto, sem "Re:": o envio (`src/sending.js`) só define `Message-ID`, sem `In-Reply-To`/`References`, então não é resposta encadeada; o revisor passa a barrar "Re:" nesse caso.
- Revisor da ficha de identificação: pergunta pelo responsável reconhece os textos novos; PV9 aplicado a esta ficha como "assunto diz o objetivo do contato" (pt "Responsável pela compra de …", de "Zuständige Person für den …-Einkauf"), porque o assunto de Rogério não segue "Fornecedor [commodity]".
- Parada da sequência: teste `tests/identificacao-parada.test.mjs` — resposta ao primeiro e-mail cancela o acompanhamento (`cancelled`, `reply_human`), mesma regra das demais fichas.
- Endereço da assinatura: "Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP" vem de `docs/eag-compass-perfil.md` (eagagro.com/contato), configurado em 24/09 na implementação; **sem confirmação registrada de Rogério** — pendência exibida na tela, sem trocar o endereço.
- Assinatura automática do webmail: o teste pelo método do Compass não pôde rodar pelo Worker (sem `MAILBOX_PASSWORD` e sem acesso da Cloudflare ao SMTP da Hostinger, registrado em 25/09). Preparado `scripts/teste-assinatura-smtp.mjs` (mesmo servidor, porta 465 com certificado verificado, AUTH PLAIN, From/Reply-To e corpo do Compass; só para `INTERNAL_TEST_RECIPIENTS`; senha digitada sem eco; `DRY_RUN=1` mostra a mensagem sem conectar). Nenhum envio feito.
- Suíte 358 + 2; UI smoke OK; versão `bb182266`.

### 2026-09-30 — Decisões 1–3 aprovadas por Rogério, fichas de identificação em rascunho

- Decisões registradas: validação comercial do café verde (SH 090111) para a Alemanha (`commercial_validations` aprovada, texto de Rogério); referência de porte — Recomendação UE 2003/361/CE só para priorização (Spec R14.9: vínculo por controle e exceções da norma, não só porcentagem; aprendizes/estudantes com contrato de formação e licenças fora do efetivo; dois exercícios consecutivos; porte estimado × comprovado; referência operacional fora da UE; todos os portes elegíveis; small mid-cap da Recomendação (UE) 2025/1099 registrada), conferida no guia oficial da Comissão (Publications Office); R14.8 revisada (esclarecer o porte na conversa aberta pelo primeiro contato, inclusive por e-mail). Registro de decisões da Spec atualizado.
- Migração `0028_base_do_porte.sql` (`companies.size_basis` estimado/comprovado); ponto de restauração `0000060f-00000000-000050f6-beb84e39eb6796a610c077ea14ecfc3a`; versão `61022725`.
- Produção: objetivo "esclarecer o porte no primeiro contato" registrado nos perfis de 24grad, AMORI e BLACK & YUM; três fichas de identificação criadas (67e48b8b…, 14f46b96…, b299df74…), versão 1, alemão, modelo `id-de-1.1.0`, revisor sem pendências, estado "em aprovação" sem nenhuma aprovação. Conferido em produção: campanha em rascunho, 0 aprovações, fila de envio vazia, nenhum registro de ativação ou aprovação na auditoria.
- Auditoria da R14.6 (sem alteração): a condição "só permitir ficha de microempresa quando o perfil registrar uso da commodity" veio da tradução, na implementação, da frase de Rogério "Microempresas continuam candidatas quando houver aderência comercial à commodity"; diverge da decisão posterior "Micro, pequenas, médias, grandes e empresas de grupos continuam elegíveis" e cria assimetria (só micro tem essa exigência). Apresentada para decisão.

### 2026-09-30 — R14.6, opção A: sem condição própria para microempresa

- Retirada a exigência de perfil "consumidora final confirmada ou possível" só para micro (`src/profiles.js`); todos os portes seguem os mesmos critérios de aderência (perfil comprador registrado; traders por R14.7); porte só desempata (pequenas e médias primeiro). Rótulo "micro — candidata". Spec R14.6, AT59 e registro de decisões; Constituição (linha de exceção de 30/09) sincronizadas.
- Teste novo: microempresa e pequena, ambas com perfil "não confirmado", recebem o mesmo tratamento (ficha permitida) e o perfil continua "não confirmado" — ausência de evidência não vira consumo confirmado.
- `scripts/teste-assinatura-smtp.mjs`: confirmação explícita ("SIM") do destinatário interno antes de pedir a senha; recusa qualquer outro destinatário. Teste ainda não executado (depende de Rogério digitar a senha no próprio terminal); fichas sem nova versão até o resultado.
- Suíte 359 + 2; UI smoke OK.

### 2026-09-30 — Assinatura oficial no envio do Compass (estrutura pronta; HTML original pendente de importação)

- Teste interno recebido por Rogério (Gmail, 30/09 16:51 UTC, marcador ab97b5ee): nada depois de "--- fim do texto gerado pelo Compass ---" — o SMTP da Hostinger não acrescenta a assinatura do webmail. O Compass precisa enviar a assinatura.
- Implementado: `src/templates/assinatura.js` (assinatura única, versão `sig-eag-0.1.0`, dados exatos de Rogério; `html` = HTML original a importar, sem redesenho; status `pending_import` → `imported_pending_visual` → `confirmed`); modelos de identificação com assinatura uma vez e rodapé separado (endereço físico R19.13 e descadastro R21.7); parte HTML (multipart texto + HTML) congelada na ficha (migração `0029_html_da_ficha.sql`, `ficha_messages.body_html_enc`) e incluída no hash aprovado; envio passa `html` ao `worker-mailer`; revisor da ficha de identificação com a regra SIG (assinatura importada, conferida por Rogério e presente uma única vez no texto e no HTML). `worker-mailer` 1.2.1 envia HTML, mas não imagens embutidas (sem Content-ID): logo e bandeiras precisam dos endereços originais da assinatura.
- `scripts/teste-assinatura-smtp.mjs` envia no mesmo formato (texto + HTML quando importado). Print citado por Rogério não chegou a esta sessão (só texto); nenhuma mensagem do webmail com a assinatura encontrada no Gmail interno.
- As três fichas v1 continuam como estavam (texto antigo, sem aprovação; aprovação impossível hoje: campanha em rascunho e internacional não liberado). Nova versão só depois da conferência visual da assinatura.
- Modelos da sequência de reunião (PV, pt/en) ainda com a assinatura antiga — ajustar antes de usá-los.
- Ponto de restauração D1 `000006c3-00000000-000050f6-a524ca28f46355426ed7ef570fa5e3a5`; versão `74647395`; suíte 360 + 2; UI smoke OK.

### Assinatura oficial — HTML de Rogério integrado como fonte única (2026-09-30)
- `src/templates/assinatura.js` (`sig-eag-1.0.0`): HTML fornecido por Rogério, sem alteração de layout, cores, cargo, bandeiras, links e aviso de confidencialidade; texto simples equivalente; `emailParts()` monta corpo + assinatura (uma vez) + rodapé separado (endereço físico e descadastro). Usada pelos modelos de identificação (de/pt/en) e de reunião (PV pt/en) e, via HTML congelado na ficha, pelo envio real.
- Logo: o original tinha URL `blob:` temporária. Não recuperado — nenhum arquivo no projeto, nenhuma mensagem interna com a assinatura no Gmail; os logos de eagagro.com são horizontais (1424×205, WebP), não o original 128×128. Marcador `LOGO_EAG_HTTPS` mantido; status `pending_logo`.
- Bloqueios enquanto houver marcador: regra SIG do revisor (reunião e identificação) reprova a ficha; `scripts/teste-assinatura-smtp.mjs` recusa enviar (testado: "Nada foi enviado", saída 1).
- Regras de conteúdo passam a ler o texto sem a assinatura fixa (conferida só pela SIG): o aviso "third parties" disparava a regra alemã `\bpartie`.
- Pré-visualização (Chrome/Playwright, 1100 px e 375 px): legível, sem rolagem horizontal; ícones icons8 (3), bandeiras flagcdn (2) e eagagro.com respondem 200; só o logo ausente.
- Testes: 360/360 (`npm run check`). Endereço físico "Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP" continua vindo de eagagro.com/contato, sem confirmação registrada de Rogério.
- Logo original recebido (2026-09-30): `Desktop\EAG Agro\Logotipo EAG AGRO.png` (idêntico ao de `Desktop\Downloads`; o caminho `%USERPROFILE%\Downloads` indicado não existia), PNG 150×150, sha256 `9f20a4749659c96af210ece81bfb1aa3eda73d3749328dea99b41b4899b030d5`, sem redesenho. Copiado para `assinatura-publica/public/assinatura/logo-eag-agro.png`.
- Publicação: Worker estático separado `eag-assinatura` (só arquivos, sem código, banco ou segredo; versão `cbeaef50-3ac7-47f5-8bf2-f9928f1c660c`), fora do Access do Compass — o bypass do Compass continua só em `/u/*`. URL: `https://eag-assinatura.rogeriopalhari23.workers.dev/assinatura/logo-eag-agro.png` → 200 `image/png`, 10 593 bytes, sha256 idêntico, sem login; raiz → 404.
- `LOGO_URL` preenchida; status `imported_pending_visual` (revisor SIG ainda reprova até a conferência de Rogério). Conferência dos modelos pt/en/de de identificação (as três empresas) e de reunião pt/en: 18 e-mails com assinatura uma vez no texto e no HTML, logo, bandeiras e aviso presentes, descadastro e endereço no rodapé separado. Pré-visualização 1100 px/375 px com todas as imagens carregadas.
- Testes 361 + 2 (check). Compass publicado: versão `abb0c5d6-1666-4b89-888d-d8174d388bbb`; `/api/health` → 302 para o Access; `/u/<inválido>` → 404 sem login. Fichas v1 inalteradas; nova versão só após a confirmação visual.
- Conferência visual da assinatura registrada (Rogério, 2026-09-30: "a assinatura recebida está visualmente correta"): `VISUAL_CONFIRMED_AT` em `assinatura.js`, status `confirmed`. Compass publicado: versão `e8446297-9f94-4532-bc76-9ed00a43c1cf`.
- Fichas de identificação v2 (POST `/api/fichas/:id/versions`, sem edições): 24grad `67e48b8b…` (versão `d0dd2606…`), AMORI `14f46b96…` (`24d1f34e…`), BLACK & YUM `b299df74…` (`f606b23d…`); `id-de-1.1.0`, revisor ok (SIG, PV2–PV12, R19.2-12, R19.13). Conferido por GET: 2 e-mails cada (dias 0 e 4), assinatura 1× no texto e no HTML, logo HTTPS, descadastro e endereço no rodapé. Status `in_approval` sem aprovação, `send_outbox` vazio, campanha `defa3ad8…` em rascunho; v1 marcadas como substituídas.
- Pedido de Rogério (2026-09-30) para retirar o endereço físico de assinatura e rodapé: **não aplicado** — Spec R19.13 e AT70 exigem o endereço (base: Hostinger ToS §12, reconferido em 2026-09-30: "messages include a legitimate return address and reply-to address, the sender's physical address"; Constituição P19 cita R19.13 como mitigação do risco assumido). Retirada depende de revisão da Spec decidida por Rogério. Endereço continua pendente de confirmação.
- Endereço físico (Rogério, 2026-09-30): mantido só no rodapé, separado da assinatura; texto validado por Rogério: "Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil" (`EAG_POSTAL_ADDRESS_CONFIRMED` no `wrangler.jsonc`). `src/postal-address.js`: confirmado só se o texto confirmado for idêntico ao configurado. Revisor (reunião e identificação) aponta R19.13 "sem confirmação de Rogério" e reprova; aprovação volta a conferir (`postal_address_unconfirmed`) e recusa versão cujo e-mail não traga o endereço confirmado (`postal_address_outdated` — gerar nova versão). Tela de revisão mostra `confirmedByRogerio` a partir da configuração. Spec R19.13/AT70 e registro de decisões atualizados. Teste novo cobre os três bloqueios, sem aprovação nem fila.
- Fichas v2 preservadas (conteúdo já com o endereço validado, sem nova versão): 3× `in_approval`, 0 aprovações, 0 na fila, campanha `draft`. Compass publicado com o bloqueio (`7badc214…`) e texto da origem ajustado.
- Nome do remetente (Rogério, 2026-09-30): `SENDER_NAME` = "EAG Agro - Brasil", usado só no campo De (`src/adapters/mailbox.js` e teste SMTP). O nome da pessoa no texto dos modelos passou para `SENDER_PERSON_NAME` = "Rogério Palhari" — sem isso o texto diria "mein Name ist EAG Agro - Brasil". Texto das fichas inalterado (sem nova versão); o campo De não entra no hash aprovado. Teste de identificação fixa "Meu nome é Rogério Palhari" com `SENDER_NAME` da empresa. Simulação do teste SMTP: `From: EAG Agro - Brasil <rogeriopalhari@eagagro.com>`.
- Aceite do teste interno SMTP (Rogério, 2026-09-30): e-mail recebido em rogeriopalhari23@gmail.com pelo `scripts/teste-assinatura-smtp.mjs` (Hostinger 465, TLS verificado, multipart texto + HTML) — confirmado correto: campo De "EAG Agro - Brasil", texto, assinatura, logo e rodapé. Aceite visual e técnico do formato de envio. **Não autoriza envio às empresas:** fichas v2 aguardando aprovação individual, campanha `defa3ad8…` em rascunho.
- Bloqueios restantes do piloto (conferidos em produção em 2026-09-30): transporte do Worker até a Hostinger (SMTP/IMAP inalcançáveis a partir da Cloudflare; `MAILBOX_PASSWORD` ausente no Worker); canal `email` = `planned`; validação dos 3 canais = `pending` (Snov sem credenciais); fluxo internacional sem liberação (`international_enabled` ausente); campanha em rascunho; aprovações individuais pendentes. Sanções válidas até 2026-10-24.

### Ponte de e-mail (opção A, decisão de Rogério em 2026-09-30)
- Diagnóstico real (2026-09-30 18:23 UTC, `POST /api/integrations/mailbox/reach` em produção): IMAP 993 e SMTP 465 `stage=open`, "proxy request failed, cannot connect to the specified address"; hosts resolvem para 172.65.x / 2606:4700 (Cloudflare); documentação de TCP sockets: IPs da Cloudflare são endereços proibidos.
- VPS 2.24.78.149: SSH responde com ED25519 `SHA256:zA4NvA5n8KMmxOVbyKdsgYdRn1I4LQjFREnM6y/1JX8` (igual a 25/09); identidade ainda não conferida pelo hPanel; estado do executor antigo desconhecido.
- Proposta em `docs/implementation/PONTE-EMAIL-PROPOSTA.md` (arquitetura, contratos, deduplicação, credenciais, custo, etapas F0–F5 e casos do teste interno). Nada instalado; canal `email` continua `planned`.
- Premissa corrigida (Rogério, 2026-09-30): sem acesso administrativo a domínio, DNS ou servidores da EAG; Compass é ferramenta pessoal; nenhuma VPS Hostinger considerada disponível. OpenClaw: tela local com túnel SSH para `root@2.24.78.149`, rede `HOSTINGER-HOSTING` (RIPE); titular da conta não identificável por dados públicos; não usado pela ponte.
- Ponte implementada e testada localmente: Worker (`src/bridge.js`; `prepareNext`/`reserveForBridge`/`settleFromBridge` e portão `reply_reader_unavailable` em `src/sending.js`; migração `0030_ponte_email.sql`) e processo `bridge/` (`nodemailer` 10.0.13, `imapflow` 2.1.2; `npm audit`: 0). `npm run check`: 362 + 2 + 11 (ponte de ponta a ponta com o Worker real e SMTP/IMAP simulados: portão de leitura, envio único com remetente/assinatura/descadastro e cópia em Sent, resposta pausa empresa + commodity, „abmelden“ suprime, primeira leitura sem histórico, caixa renumerada, queda depois/durante/antes do SMTP, 550, destinatário externo em teste interno, assinatura/repetição/carimbo). Corrigido: „abmelden“/„abbestellen“/„austragen“ e ausência em alemão reconhecidos. Nada publicado, nada contratado, canal `email` segue `planned`.
- Hospedagem para decisão: Hetzner CX23 € 5,49/mês + IPv4 (preço oficial desde 15/06/2026; SMTP 587, pois 465 é bloqueada em contas novas) ou computador de Rogério (R$ 0; envio e leitura só com o computador ligado; portão impede envio sem leitura recente).
- Opção B escolhida (Rogério, 2026-09-30): ponte no computador dele. Publicado o Compass com as rotas da ponte e `SEND_TRANSPORT=bridge` (versão `a1c17f85-f4f5-4803-8dcf-1cec42f57ca8`); migração `0030_ponte_email.sql` aplicada no D1 de produção; `BRIDGE_HMAC_KEY` criada por `configurar-chave-compass.ps1` (Worker + DPAPI, sem exibição). Ajustes: erro de leitura invalida na hora a última leitura boa; passo atrasado empurra os seguintes mantendo os dias entre passos; conteúdo de mensagens da caixa sem relação com envios não é guardado no R2; comandos `bridge\ponte iniciar|parar|estado|registro|conferir-caixa`, tarefa agendada com uma instância e trava por PID, parada entre ciclos. Testes: 362 + 2 + 13.
- Registros do teste interno em produção (marcados "TESTE INTERNO", não comerciais): campanha nacional inativa `5069cc54…` (açúcar), 4 empresas/contatos/fichas (A, B, C: aliases `rogeriopalhari23+ponte-a/b/c@gmail.com`; F: `teste-externo@example.com`, domínio reservado), fuso America/Cuiaba, validação de e-mail marcada `internal_test`, fichas revisadas sem pendência, sem aprovação. Aguardando o token de serviço do Access (criado por Rogério no painel) para ligar a ponte.
- Correção (2026-09-30, relato de Rogério): `iniciar-ponte.ps1` montava `...\bridge\bridge` (a raiz calculada já era a pasta da ponte). Caminhos agora partem da localização do script; validação antes de qualquer senha (pasta e `package.json` da ponte, `src\main.js`, `nodemailer`/`imapflow` instalados, Node.js ≥ 22.5, configuração e segredos exigidos por modo); modo automático não pede senha e, com configuração incompleta, registra o motivo em `ponte.log`/`ultimo-erro.txt` e sai sem reinício em laço; `ponte iniciar` valida antes de registrar a tarefa; `conferir-caixa`/`conferir` devolvem o código real. Testado: `-Validar` (recusa sem token), `conferir-caixa` chega ao Node (caixa apontada para endereço local, sem login real), dependência ausente barrada antes da senha, `estado`, `iniciar` (não registra tarefa sem configuração), `parar`. Configuração existente preservada; nenhuma credencial registrada.
- Access da ponte (2026-09-30): token `eag-compass-ponte-windows` (sem validade) localizado na conta do Compass; criada a aplicação do Access só para `…/api/bridge` com uma única regra Service Auth (`non_identity`, só esse token); `BRIDGE_ACCESS_CLIENT_ID` e `BRIDGE_ACCESS_AUD` gravados como secrets do Worker pela API, sem exibição. Conferido de fora: `/api/bridge/*` sem token → 403; com sessão de usuário do Compass → 403; resto do Compass sem login → 302 para o Access. `ponte conferir` → 403 do Access: o Client ID guardado no computador (DPAPI) não é o deste token (SHA-256 local `e8b454a5…` ≠ `ac3ac0aa…` do token; token nunca usado). Aguardando novo cadastro local. Ajustes: mensagem clara de recusa do Access; saída natural sem asserção do Node no Windows; teste da ponte com janela válida (dias 1–7).
- 403/500 da ponte investigados (2026-09-30): (1) regra do Access correta — aplicação só de `/api/bridge`, uma regra `non_identity` com exatamente o token `eag-compass-ponte-windows`, sem exclusões; log do Access sem registros (credencial não identificava token). Causa do 403: valores guardados com o rótulo do painel (`CF-Access-Client-Id: …`, `CF-Access-Client-Secret: …`); sem o rótulo, SHA-256 do Client ID local = o do token. Correção: `guardar-segredos.ps1` e `iniciar-ponte.ps1` aceitam a linha inteira ou só o valor; valores já guardados normalizados (DPAPI mantido). (2) Depois, 500 no Worker (`InvalidCharacterError` em `atob`) — `BRIDGE_HMAC_KEY` chegava ao Worker alterada pelo pipe de texto do PowerShell 5.1; e uma correção intermediária perdeu a barra de `\s` (removia a letra "s"). Correção: chave em hexadecimal, entregue ao `wrangler` pelo Node byte a byte; Worker tolera espaço/BOM em volta e responde 503 `bridge_not_configured` com diagnóstico sem o valor; log de erro do Worker passa a trazer tipo e mensagem. Resultado: `ponte conferir` → `compass_ok`, `imap_ok`, `smtp_ok`, `check_done` (nenhuma mensagem enviada). Worker `a4f592c2`. Testes 362 + 2 + 14. Canal `email` segue `planned`; nada enviado.
- Teste interno da ponte — parte sem envio (2026-09-30, 22:34–22:37 UTC, produção): canal `email` em `internal_test` (estado anterior: `planned`); campanha "TESTE INTERNO — ponte de e-mail (não comercial)" ativa; fichas de teste A, B, C, F em nova versão (a ativação mudou a campanha, R22.5) e aprovadas com início em 01/10/2026. Campanha comercial (Alemanha) segue `draft`.
  - Conferência completa (`-Conferir`): `compass_ok`, `imap_ok` (INBOX com 103 mensagens), `smtp_ok`; nada enviado.
  - Primeira leitura: `bridge.cursor_rebased` (UIDVALIDITY 1764508669, UID 1429); `inbound_messages` = 0 (histórico da caixa não entrou).
  - Cenário 6 (caixa indisponível, simulada): `read_failed IMAP_SIMULATED_DOWN`, ciclo sem pedido de envio; pedido direto logo depois → `reply_reader_unavailable`; `reply_reader_state.last_error` registrado; leitura seguinte restabeleceu (`bridge.reader_ok`). OK.
  - Cenário 7 (segurança): chamada válida 200; mesmo nonce 409 `bridge_replay`; chave errada 403 `bridge_bad_signature`; corpo alterado 403 `bridge_bad_signature`; carimbo de 10 min 401 `bridge_clock_skew`; sem assinatura 401 `bridge_signature_required`; sem token do Access 403 (Access). OK.
  - Cenário 8 (destinatário externo `teste-externo@example.com`): passo 1 fica `pending` com `channel_internal_test_only`; nenhum envio. OK.
  - Passos de A, B, C: `not_due` (vencem em 01/10). Cenários com envio (1–5) agendados para 01/10/2026 a partir das 9h de Cuiabá.
- Ajustes do roteiro pedidos por Rogério (30/09, antes das 9h de 01/10): (1) nenhum descadastro de `rogeriopalhari23@gmail.com` — cenário 3a ("sair") pendente por falta de caixa interna dedicada; 3b por link com alias exclusivo `+ponte-link` (caso D criado e aprovado para 01/10). Conferido em produção antes dos envios: nenhum endereço interno suprimido e nenhum alias com o mesmo hash do principal (normalização só remove espaços e põe em minúsculas, `src/crypto.js:57`). (2) Encerramento local independente da sessão: prazo `BRIDGE_TEST_DEADLINE` na configuração da ponte (depois dele a ponte trava o canal pela nova rota `/api/bridge/lockdown`, que só desliga, e encerra) — comprovado em produção com prazo vencido de propósito (`deadline_lockdown`, canal `internal_test` → `planned`, restaurado em seguida); tarefa agendada "EAG Compass - prazo do teste interno" às 17h00 de 01/10 (para a ponte, trava o canal, tenta encerrar campanha e fichas de teste e grava pendências em `%LOCALAPPDATA%\eag-mail-bridge\encerramento-teste-interno.txt`). (3) Roteiro permanente em `docs/implementation/teste-interno-ponte/ROTEIRO.md` e IDs em `registros.json` (sem credenciais). (4) Correção: a supressão não é "definitiva" pela Spec — o Administrador pode remover com motivo e base (R9.2), R21.1 exige critério de retenção por registro e a política depende de T11 (R9.1.2), não validada; a implementação não tem rota de remoção e não preenche `retention_until` (divergência pendente). Worker `9054e359`; testes 362 + 2 + 15.
- Tarefa de implementação registrada em `sequence.json` (`SUPRESSAO-RETENCAO`, pendente): remoção de supressão pelo Administrador com motivo e base (R9.2) e critério de retenção por registro (R21.1). Separada da validação jurídica T11, que define a política de retenção e a base de remoção. Descadastros reais preservados.
- Teste interno da ponte — cenários com envio (2026-10-01, 09h04–11h15 Cuiabá, produção; só aliases de `rogeriopalhari23@gmail.com`). Ciclos `-UmCiclo` executados por Rogério no próprio terminal depois que o controle de permissões recusou ações externas da sessão (resposta pelo Gmail e espera); o assistente só fez leituras (D1, Gmail, diário local da ponte).
  - Cenário 1 (A, envio normal): **aprovado.** 13:06 UTC, SMTP 250; outbox `cd40378b…` `accepted`; um e-mail em `+ponte-a` na caixa de entrada; De "EAG Agro - Brasil" <rogeriopalhari@eagagro.com>, Reply-To igual, `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click`, SPF/DKIM/DMARC `pass`, logo, rodapé com o endereço confirmado e link de descadastro; sem `append_sent_failed` (cópia em Enviados não conferida na caixa); intervalo seguinte 13:28:30.
  - Cenário 2 (resposta de A): **aprovado.** Resposta manual de Rogério pelo Gmail (sem "sair"); `inbound_messages` `human`/`thread` ligada à empresa e ao outbox de A; passos 2–4 de A `cancelled` `reply_human`; tarefa `reply_followup` aberta; nenhuma supressão nova.
  - Cenário 4 (queda depois do SMTP): **aprovado, executado em D** (plano reorganizado com Rogério). A primeira tentativa em B não exercitou a falha: B saiu normalmente uma vez (13:30, `recovered:false`, um e-mail em `+ponte-b`). Em D (`bed63b7e…`): SMTP 250 às 14:03, `fault_injected after_smtp`, diário `smtp_done`, Compass ainda `leased`; ciclo seguinte → `recovered accepted` às 14:05, `sent:false interval`; **um** e-mail em `+ponte-link`.
  - Cenário 5 (queda antes do SMTP, C): **aprovado.** `fault_injected before_smtp` às 13:52 (nada enviado); recuperação às 14:02 → `recovered temporary`, `temp_failed` com nova tentativa às 15:02:52 (o lease vencera às 13:57:44, mas a recuperação roda antes de qualquer claim e não houve `indeterminate`); nova tentativa 15:10 → `accepted` (2 tentativas); **um** e-mail em `+ponte-c`.
  - Cenário 3b (descadastro por link, D): **aprovado.** POST one-click às 14:10:26 → HTTP 200; `suppression_entries` = 1 (`email`, `opt_out`, origem `link`); só `+ponte-link` `suppressed:true`; `rogeriopalhari23@gmail.com` e os demais aliases `suppressed:false`, nenhum hash igual ao do principal (conferido antes e depois); passos 2–4 de D `cancelled` `unsubscribed`. Supressão preservada.
  - Cenário 3a (resposta "sair"): **pendente** — exige caixa interna dedicada e autorizada; nenhum descadastro do Gmail principal.
  - Cenários 6–8: aprovados em 30/09 (acima). F (externo) seguiu recusado (`channel_internal_test_only`) durante todo o dia.
  - Falhas/observações: (1) cenário 4 não ocorreu em B (comando com falha simulada não chegou a enviar antes do intervalo; corrigido no plano); (2) uma execução às 09h57 não iniciou a ponte (nada mudou; repetida em seguida); (3) a caixa registrou 5 mensagens não relacionadas como `human`/`none` — notificações do LinkedIn (Message-ID `*.prod.linkedin.com`, UIDs 1432–1435 e 1437), sem empresa, sem efeito e não guardadas (`not_stored`); corrigido em seguida (abaixo).
  - Encerramento: `teste-interno-admin.mjs encerrar` (Rogério): canal `email` = `planned`; campanha de teste `ended`; fichas A–F `discarded`; `send_outbox` = 4 `accepted` + 16 `cancelled`, nenhum pendente; tarefa agendada do prazo removida; ponte sem execução contínua. Envios do dia: 4 (A, B, D, C), todos para aliases internos. Campanhas comerciais desligadas; fichas da Alemanha intocadas.
- Correção da classificação de notificações automáticas (2026-10-01, pedido de Rogério):
  - Conferência: as 5 mensagens do LinkedIn tinham só a classificação errada — `company_id`/`outbox_id`/`commodity` nulos, correlação `none`, conteúdo não guardado; nenhuma tarefa, pausa, cancelamento ou supressão ligada a elas (a única tarefa do dia é a de A, pela resposta real; os 3 cancelamentos `reply_human` são de A).
  - Regra nova em `src/inbound.js` (`bulkNotification`): `Precedence` bulk/list/junk, `List-Id`, cabeçalhos `X-LinkedIn-*`, remetente no-reply/notificações, ou `List-Unsubscribe` sem thread → `auto_reply`, avaliada antes de "sair" e de "human" (uma notificação com "Unsubscribe" no texto não vira descadastro). Respostas na thread seguem como antes. Testes de regressão em `tests/inbound.test.mjs` (classificação e efeito: sem pausa, tarefa, supressão nem conteúdo guardado); suíte 364 + 2 + 15.
  - Dados de produção: `docs/implementation/correcoes/2026-10-01-linkedin-classificacao.sql` aplicado às 15:30 UTC — 5 linhas `human` → `auto_reply` com guarda e 5 registros `inbound.reclassified` em `audit_log` (`request_id` `correcao-linkedin-2026-10-01`, valor anterior e novo). Resposta real de Rogério (UID 1436) preservada como `human`/`thread`.
  - Pendente: publicar o Worker com a regra (aguarda autorização) e conferir a regra com os cabeçalhos reais (`iniciar-ponte.ps1 -TesteInterno cabecalhos`, somente leitura, sem corpo, assunto ou endereço).
  - Encerramento reconferido: canal `planned`, campanha de teste `ended`, 4 `accepted` + 16 `cancelled` (nenhum pendente), ponte sem processo, tarefa das 17h já removida. Pendências separadas: cenário 3a ("sair"), Snov, liberação comercial por Rogério.
- Estado conferido em 2026-10-01 ~16:20 UTC: ponte do Windows em execução contínua (tarefa "EAG Compass - ponte de e-mail", leitura OK, `nothing_due`); canal `email` = `planned`; fila 4 `accepted` + 16 `cancelled`; supressão de `+ponte-link` (`opt_out`, `link`, 14:10:26) preservada; Worker em produção ainda na versão 9054e359 (sem a regra do classificador). Uma notificação do LinkedIn lida às 16:17 (UID 1438) foi registrada como `human`/`none`, sem empresa nem efeito — correção auditada preparada em `docs/implementation/correcoes/2026-10-01-linkedin-uid1438.sql`, a aplicar depois da publicação. A publicação foi recusada pelo controle de permissões da sessão (ação de produção): fica com Rogério.
- SUPRESSAO-RETENCAO implementada (2026-10-01, não publicada):
  - Migração `0031_supressao_retencao.sql`: `scope` (`channel_all`: identificador no canal inteiro) e `retention_criterion` (`until_t11_policy`: mantido para não recontatar até a política de T11, sem prazo nem expiração automática; `retention_until` segue nulo) em cada registro (R21.1); tabela `suppression_removals` com o histórico de cada remoção (quem, quando, motivo, base, dados da entrada; pseudônimo HMAC, sem endereço).
  - `POST /api/suppression/:id/remove` (R9.2): só Administrador; motivo (≥ 10 caracteres), base (≥ 5) e `confirm: true`; outro perfil → 403 e `suppression.remove_denied` no `audit_log` (R9.2.1); remoção → `suppression.removed` com valor anterior e base, sem endereço; envios cancelados continuam cancelados. `GET /api/suppression/removals` só para Administrador. Tela Supressão mostra alcance, critério de retenção e a remoção recolhida "(administrador)" com confirmação.
  - Testes: `tests/suppression-retention.test.mjs` (critério e alcance, permissão e tentativa negada, motivo/base/confirmação, histórico, auditoria sem endereço, nada reenviado, nova supressão após remoção). Suíte 367 + 2 + 15; UI smoke OK.
  - Depende de T11 (não inventado): prazo de retenção, fundamento jurídico da remoção e da guarda do histórico. Nenhum descadastro real foi removido.
- Teste interno da ponte: 3a ("sair") segue **pendente**; T1/P2-T17 **não** está concluído (faltam 3a, Snov e a liberação expressa de Rogério).
- Publicação autorizada por Rogério (2026-10-01): branch `v2-revisao-2`, commit `57a7230`. Ponto de restauração do D1 antes de qualquer mudança (16:31 UTC): bookmark `000006fd-0000009e-000050f7-e0b699b1882445d8fee889e2bb024364` (`wrangler d1 time-travel restore eag_compass --bookmark=…`). Ordem executada:
  1. Migração `0031_supressao_retencao.sql` aplicada (5 comandos); supressão de `+ponte-link` passou a `scope=channel_all`, `retention_criterion=until_t11_policy`, `retention_until` nulo; `suppression_removals` vazia.
  2. Deploy: versão `a5016aff-f4c7-42ff-99a5-0c466db2e89d` (16:34:23 UTC), 100% do tráfego; suíte 367 + 2 + 15 no pré-deploy; `/api/health` responde 302 do Access (proteção mantida).
  3. Correção da UID 1438 (`correcoes/2026-10-01-linkedin-uid1438.sql`): `human` → `auto_reply` com auditoria `correcao-linkedin-2026-10-01-b`.
  - Verificação: as 6 notificações do LinkedIn (UIDs 1432–1435, 1437, 1438) `auto_reply`/`none`, sem empresa; resposta real (UID 1436) `human`/`thread`; só `+ponte-link` suprimido, Gmail principal e demais aliases não; canal `email` = `planned`; campanhas: 1 rascunho, 1 encerrada (nenhuma ativa); fila 4 `accepted` + 16 `cancelled`; ponte do Windows seguiu lendo depois do deploy (16:35:23 UTC). T1/P2-T17 continua pendente (3a "sair", Snov, liberação de Rogério).
- Publicação do redesign (2026-10-01, autorizada por Rogério): commit `61c1321`, Worker `7d178094-67c9-4ad9-bc53-78b87f4c5a53` (17:25:55 UTC); bookmark do D1 antes `00000700-00000084-000050f7-b51a46b5f2f3e447ffa4189f3ffc825e`; sem migração; conferência pelo Access (desktop e 390 px) sem falha; `v2-revisao-2` avançada sem merge para `61c1321` e marcada com a tag `producao-7d178094` (detalhes na tag).
- Cenário 3a ("sair") — 2026-10-01, caixa `rogeriopalhari@hotmail.com` autorizada por Rogério só para este teste interno:
  - Preparação: `INTERNAL_TEST_RECIPIENTS` com a caixa (commit `a2b857c`, Worker `1a34524a`); caso G criado (`teste-interno-admin.mjs preparar-sair`; validação interna marcada no D1); campanha de teste reativada, canal `internal_test`, ficha G aprovada para 01/10 (`abrir-sair`).
  - Envio: ponte do Windows, passo 1 de G aceito pelo SMTP às 17:46:54 UTC (13:46 Cuiabá); quinto e último envio do dia (teto 5).
  - Resposta "sair" de Rogério pela Hotmail lida às 17:50:31 UTC (UID 1441): `unsubscribe`/`thread`, ligada à empresa e ao envio de G; supressão `opt_out`, origem `reply`, alcance `channel_all`, retenção `until_t11_policy` (17:50:32); passos 2–4 de G `cancelled` `unsubscribed`; tarefa `reply_followup` aberta.
  - Conferência por endereço: só `rogeriopalhari@hotmail.com` e (desde o 3b) `+ponte-link` suprimidos; `rogeriopalhari23@gmail.com`, `+ponte-a`, `+ponte-b`, `+ponte-c` livres; nenhum hash igual ao do principal. **Cenário 3a aprovado.**
  - Encerramento: `encerrar` → ficha G descartada (A–F já descartadas), campanha de teste `ended`, canal `email` = `planned`; caixa Hotmail removida da lista interna (Worker `d881e070-a389-487b-ac66-50d20050a925`). Fila: 5 `accepted` + 19 `cancelled`, nenhum pendente. Campanhas: 1 rascunho + 1 encerrada. Ponte do Windows lendo (17:54 UTC). A caixa Hotmail não entra em campanha comercial (e segue suprimida).
  - Teste interno da ponte: cenários 1, 2, 3a, 3b, 4, 5, 6, 7 e 8 aprovados. T1/P2-T17 ainda não liberado: falta Snov e a liberação expressa de Rogério (R26.3); campanhas comerciais desligadas.
- Snov.io (2026-10-01): `SNOV_CLIENT_ID` e `SNOV_CLIENT_SECRET` presentes nos segredos do Worker (conferido pelo nome, sem valores). Validação real das 3 fichas alemãs (contatos de canal geral `a93c0538…` 24grad, `c21f6d0e…` Amori, `f19ed55f…` BLACK & YUM; todos `pending`), iniciada às 18:18:17 UTC pela rota `POST /api/contacts/:id/validate-email`:
  - Resultado: as 3 chamadas (e 1 chamada de diagnóstico para o primeiro contato) voltaram **502 `email_validation_invalid_request`**, mensagem "Snov.io: requisição recusada (202)". Autenticação aceita (o token passou); a Snov respondeu **202 Accepted** ao iniciar a tarefa e o adaptador só aceitava 200 — **defeito do Compass**.
  - Efeito: nenhuma tarefa registrada (`email_validation_jobs` = 0), nenhum contato alterado (3 seguem `pending`), nenhuma ficha aprovada. Custo provável: a Snov cobra 1 crédito por e-mail verificado independentemente do resultado; até **4 créditos** podem ter sido consumidos sem resultado gravado (conferir o saldo e o histórico de verificações no painel da Snov).
  - Correção (não publicada): `src/adapters/snov.js` aceita qualquer 2xx em iniciar e consultar; teste de regressão com 202 (tarefa registrada e resultado aplicado) e 400 (segue recusa). Suíte 372 + 2 + ponte 15. Publicar e repetir a validação (3 créditos) dependem de autorização de Rogério.
  - Estado: canal `email` = `planned`; campanhas 1 rascunho (Alemanha) + 1 encerrada; nenhuma ativada.
- Correção do Snov publicada (2026-10-01, autorização de Rogério): commit `d97bd91`, Worker `252600c3-52c6-4276-9d4c-eb9d40c78c8b`. Conferido antes: com 202/200 a tarefa grava o `task_hash` em `email_validation_jobs`, os contatos ficam `pending` (nunca `valid` pela aceitação) e o resultado é consultado pela fila até `completed` (no máximo 8 consultas, depois `error`); teste de regressão cobre 202 e 400.
- Recuperação dos 4 pedidos de 18:18 UTC: a API da Snov só devolve resultado com o `task_hash` (`GET /v2/email-verification/result?task_hash=…`) e não tem método de histórico (documentação oficial em snov.io/api, conferida em 01/10); o Compass não gravou os `task_hash` (a falha ocorreu antes de gravar) e não há registro deles no D1, na auditoria nem nos logs do Worker (o código não registra respostas do provedor). Resultado: **não recuperável pela API**; resta conferir o histórico no painel da Snov, acessível só por Rogério. Nenhuma nova consulta feita; contatos seguem `pending`.
- Validação real das 3 fichas alemãs pela Snov (2026-10-01, 3 créditos autorizados por Rogério), iniciada às 18:32:48 UTC, uma tarefa por contato, versão `252600c3`:
  - Amori Coffee (contato de canal geral `a93c0538…`): **valid** — tarefa `8569907e…` (task_hash `71dd79ad…`), concluída 18:33:34 UTC, 2 chamadas (início + 1 consulta).
  - 24grad Kaffeerösterei GmbH (`c21f6d0e…`): **catchall** (domínio aceita qualquer endereço; não confirma a caixa e não conta como validado) — tarefa `8878311c…` (`504a812f…`), 18:33:36 UTC, 2 chamadas.
  - BLACK & YUM GenussRösterei - Telgter KaffeeBar (`f19ed55f…`): **valid** — tarefa `18629cb7…` (`a746125f…`), 18:33:36 UTC, 2 chamadas.
  - Correção do registro anterior: o contato `a93c0538…` é da Amori e o `c21f6d0e…` é da 24grad (a entrada das 18:18 trocou os nomes).
  - Custo: 3 créditos (1 por endereço, regra da Snov), mais até 4 da tentativa das 18:18. Validade da validação: `email_validated_at` gravado; `email_validation_expires_at` vazio porque o parâmetro `email_validation_max_age_days` segue sem valor aprovado (pendência de decisão; o pré-envio depende dele, R19.2 item 11).
  - Nenhuma ficha aprovada (as 3 seguem `in_approval`); canal `email` = `planned`; campanhas 1 rascunho + 1 encerrada.
- Validade da validação de e-mail (decisão de Rogério, 2026-10-01): `email_validation_max_age_days` = 30 (escopo `email`) gravado pela API; os 2 `valid` de hoje receberam vencimento = validação + 30 dias (Amori e BLACK & YUM vencem em 31/10/2026 ~18:33 UTC), com 2 registros de auditoria (`correcoes/2026-10-01-validade-snov.sql`). Vencido bloqueia o envio até nova verificação pedida por alguém; não há reverificação automática (a Snov só é chamada pelas rotas manuais de validação). Código (commit `b3935f9`, **não publicado**): o pré-envio passa a calcular o vencimento pela data da validação + parâmetro quando o vencimento não estiver gravado e espera se faltar data ou parâmetro; teste confirma que nada sai e que nenhuma chamada à Snov acontece.
- 24grad Kaffeerösterei GmbH: mantida como **catch-all, não validada** (contato de canal geral `c21f6d0e…`). Pesquisa de contato profissional (método /prospeccao-vendas: sem decisor de compras identificado → sócio-administrador como decisor provisório): Impressum de 24grad.net (consultado 2026-10-01) publica o Geschäftsführer **Markus Glaubitz**, telefone geral +49 511 37074732 e só caixas genéricas (info@, webshop@, contact@ no Kaffeeverband; seminare@ e firmenkunden@ em 24grad.coffee). Registrado como contato `48dc8835…` (decisor provisório, fonte Impressum, fuso Europe/Berlin, **sem e-mail**). Nenhum e-mail pessoal publicado; o domínio 24grad.net é catch-all, então nenhum endereço nele pode ser confirmado pela Snov. Nenhum crédito usado, nenhuma ficha aprovada, canal `planned`, campanhas inativas.
- Publicação da regra de validade (2026-10-01, autorizada por Rogério): código do commit `b3935f9` (publicado a partir de `c327837`, que só acrescenta documentação), Worker **`b6d4b19d-a56b-402e-b78f-e7394a395ecd`** (19:02 UTC); pré-deploy 373 + 2 + ponte 15.
  - Conferência da regra com o código publicado e os estados reais copiados da produção, em banco isolado e com a rede bloqueada (`scripts/conferir-validade-envio.mjs`; nada enviado nem aprovado na produção — um teste no caminho real de envio exigiria aprovar uma ficha, o que não foi autorizado): Amori em 02/10 passa da validade e para no canal `planned`; Amori e BLACK & YUM em 01/11 → `email_validation_expired`; 24grad catch-all → `email_not_validated`; valid sem data de validação → `email_validation_date_missing`; valid sem configuração → `email_validation_age_parameter_missing`; valid de 01/09 sem vencimento gravado → `email_validation_expired`; **0 chamadas de rede (Snov)**.
  - Produção depois do deploy: parâmetro `email_validation_max_age_days` = 30 (`email`, vigente); Amori vence em 2026-10-31T18:33:34.906Z e BLACK & YUM em 2026-10-31T18:33:36.952Z; 24grad: canal geral `catchall` (sem vencimento, não validado) e decisor provisório sem e-mail; `email_validation_jobs` = 3 (último 18:32:53 UTC, nenhum novo depois do deploy, conferido às 19:04:59 UTC); canal `email` = `planned`; campanhas 1 rascunho + 1 encerrada (nenhuma ativa); fichas alemãs em `in_approval`.
- 24grad — próximo contato possível: ligação para o número geral (+49 511 37074732) para identificar o responsável por compras (Level 0 do método). **Não autorizada** por Rogério (2026-10-01): fica informada para decisão dele; nenhum e-mail será enviado com base no resultado catch-all.

## Proposta para o piloto: T11, prontidão das fichas alemãs e T1 contra a Spec (2026-10-01)

- Só leitura em produção (D1 `SELECT` e `GET /api/fichas/:id` pelo Access). Nada enviado, aprovado, ativado ou contratado; nenhum crédito da Snov; nenhuma ligação. Estado: canais `planned`; campanha da Alemanha `draft`, a de teste `ended`; 3 fichas alemãs `in_approval` v2; fila 5 `accepted` + 19 `cancelled`; 2 supressões preservadas; `international_enabled` ausente; listas de sanções de 2026-09-24 (vencem em 24/10); **nenhuma triagem de sanções das empresas alemãs**.
- `docs/implementation/T11-POLITICA-PROPOSTA.md`: política proposta (retenção, histórico, remoção administrativa, acesso, exclusão, reimportação), separando exigência, interpretação e escolha, com fontes oficiais consultadas em 2026-10-01: UWG §7, BGH I ZR 218/07 e VI ZR 225/17, DSK Orientierungshilfe Werbung (fev. 2022, §1.4, §2.2, §5.1), LGPD no Planalto, Guia de legítimo interesse da ANPD. A EUR-Lex recusou acesso automatizado (HTTP 202 vazio): artigos do GDPR, da ePrivacy e de Roma II citados sem texto baixado, para conferência do validador. Não é validação jurídica.
- Achado principal: e-mail de prospecção a empresas na Alemanha exige consentimento prévio (UWG §7(2) Nr. 2, sem exceção para empresas). Endereço publicado, `valid` da Snov e link de saída não são consentimento. Proposta: Amori, BLACK & YUM e 24grad sem aprovação por e-mail até parecer.
- Lacuna encontrada: `deletePersonalData` não purga `ficha_messages`, snapshots nem mensagens recebidas (R9.1/R23.5). Registrada como `EXCLUSAO-PURGA` (pendente, aguarda decisão).
- `PRONTIDAO-FICHAS-DEU.md`: conferência item a item e textos congelados completos. Conteúdo inalterado desde a v2, por isso nenhuma versão nova. Bloqueios B1–B6.
- `DECISOES-PILOTO-2026-10-01.md`: T1 contra R26.3/R26.6. Teste técnico concluído; falta a liberação operacional (R26.1) e a comercial. Tabela de 12 itens abertos e 9 propostas de decisão.
- `sequence.json`: P2-T17 e RADAR-PESSOAS atualizados (Snov deixou de ser pendência); novas `T11-VALIDACAO` (external) e `EXCLUSAO-PURGA` (pending). Spec: nota datada sob a tabela de dependências, que fica preservada como registro de 2026-09-22. `ESTADO-DAS-42-TAREFAS.md`: seção de 2026-10-01 no topo, com a tabela de 24/09 mantida.

## Triagem de sanções das empresas alemãs e EXCLUSAO-PURGA (2026-10-01, pedido de Rogério)

- **Triagem (produção, interna, sem chamada externa):** `POST /api/companies/:id/screening` contra as listas importadas em 2026-09-24. Amori `948d3201…`, BLACK & YUM `30c65784…`, 24grad `d7720a41…`, às 19:36 UTC: **0 resultados** nas três. Libera o `compliance_unavailable` até as listas vencerem (2026-10-24). Nenhuma ficha aprovada, nenhuma campanha ativada, canal `planned`.
- **EXCLUSAO-PURGA (implementado; testado só com dados fictícios; não publicado):**
  - `migrations/0032_exclusao_purga.sql`: `ficha_messages.purged_at` e trigger de imutabilidade com uma única exceção. A purga troca o conteúdo uma vez; identidade e `message_sha256` não mudam; sem purga, ou depois dela, qualquer UPDATE ou DELETE continua abortado. Também `inbound_messages.content_purged_at`.
  - `src/changes.js` `deletePersonalData`:
    - apaga a mensagem no R2 antes do banco;
    - textos de ficha recebem o marcador cifrado "[conteúdo excluído a pedido do titular]" e o HTML fica nulo;
    - limpa roteiro e resultado das tarefas do contato;
    - a candidata de pessoa fica `dismissed`, com nome-marcador e sem cargo, e-mail ou telefone;
    - zera a referência de verificação;
    - grava o hash do e-mail na supressão (`personal_data_deleted`, R9.1.2);
    - auditoria só com contagens e base legal;
    - pode ser repetido sem efeito novo.
  - `src/fichas.js`: aprovação de texto purgado → 409 `personal_data_deleted`.
  - `tests/exclusao-purga.test.mjs` (2 testes, "Maria Souza"/`valeverde.com.br`/`exemplo.invalid`). O primeiro rascunho checava tarefas que não tinham `contact_id` (a tarefa de resposta só guarda orientação fixa, sem PII) e por isso passava sem testar nada; foi corrigido com uma tarefa de ligação do contato e a asserção `tasks.length > 0`.
  - Limites declarados: Time Travel do D1, a caixa de e-mail (Enviados/Entrada) e o diário local da ponte ficam fora do Compass. Resultado de tarefa de resposta sem `contact_id` não é alcançado.
- Correção de documento pedida por Rogério: a carta postal e o piloto no Brasil são **alternativas propostas**, não decisões (DECISOES-PILOTO §4).

## EXCLUSAO-PURGA — revisão de resíduos, vínculos e proteção contra restauração (2026-10-01, sem publicar)

- **Pedido de Rogério:** revisar os dados que ficam em aprovação, envio e tarefas de resposta; corrigir vínculos sem apagar evidências de outros contatos; testar com dados fictícios; documentar backups, caixa e ponte; impedir que uma restauração recoloque dados excluídos em uso. Sem exclusão real e sem publicação.
- **Revisão** sobre o esquema real (75 tabelas, `PRAGMA table_info` do banco de teste migrado). Resíduos encontrados e tratados:
  - endereço no texto SMTP (`send_log.detail` e diário local da ponte);
  - endereço em `resolved_reason`;
  - tarefas de resposta sem vínculo (nova coluna `tasks.inbound_id`);
  - IDs do servidor da pessoa em `inbound_messages`;
  - `purchase_note`, `purchase_source_url` e `source_url` da candidata;
  - nomes no cache compartilhado do aviso legal;
  - `contacts.source_label`.
  
  Sem PII: `ficha_approvals`, `message_id` gerado por nós, auditoria, jobs da Snov, reuniões.
- **Regra do conteúdo compartilhado:** mensagem de outro remetente na conversa não é apagada e volta em `sharedRetained`; a purga individual é auditada (`POST /api/inbound/:id/purge-content`). No cache do aviso legal sai só a pessoa.
- **Restauração:** `erasure_ledger` (D1) mais cópia em R2 gravada antes do D1. A divergência bloqueia envio (`prepareNext`) e aprovação até `POST /api/erasures/reapply`.
- **Código:**
  - `src/erasure.js` (novo; `changes.js` reexporta);
  - `src/inbound.js` (`inbound_id`);
  - `src/sending.js` (guarda e redação no `log`);
  - `src/bridge.js` (redação);
  - `src/fichas.js` (guarda);
  - `src/worker.js` (2 rotas);
  - `src/people.js` (exporta `nameHash`);
  - `bridge/src/journal.js` (redação);
  - `bridge/scripts/redigir-diario.mjs` (novo);
  - migração 0032 revisada;
  - `docs/implementation/correcoes/0032-reversao.sql`.
- **Testes:**
  - `tests/exclusao-purga.test.mjs`: 6 testes, dados fictícios — tarefa de resposta, conteúdo compartilhado, repetição, restauração por `VACUUM INTO`, reversão, diário.
  - Defeito achado pelo teste de restauração e corrigido: `reapplied_at` não era gravado quando a linha não existia no banco restaurado.
  - O teste antigo P2-T13 passou a fornecer R2, porque a exclusão agora exige o registro fora do banco.
  - Suíte completa: 377 + 2 + 15 (ponte), 0 falhas.
  - Compatibilidade: suíte da versão em produção (`b3935f9`) com a 0032 aplicada, 373/373, numa cópia temporária já removida.
- **Fontes e achados:**
  - Prazo do Time Travel conferido na documentação da Cloudflare (atualizada em 2026-04-21): 7 dias no Free e 30 no Paid. O plano da conta precisa ser confirmado.
  - Achado fora do escopo (não corrigido): id repetido no alerta de "outra commodity" em `src/inbound.js`, registrado em `EXCLUSAO-PURGA-PLANO.md` §7.
- **Plano e decisões:** plano de publicação e reversão em `EXCLUSAO-PURGA-PLANO.md` §5–§6, não executado. Decisões T11 pendentes no §3.

## Respostas com várias commodities corrigidas e EXCLUSAO-PURGA finalizada (2026-10-01, sem publicar)

- **Correção de respostas (commit separado `1b9fd59`):**
  - `pauseTargets` dá um id por tarefa e um alerta por commodity da empresa ainda em andamento fora das pausadas (R20.1, R20.5). Antes, um único id no `INSERT…SELECT` derrubava o lote (`UNIQUE constraint failed: tasks.id`, reproduzido com o código anterior) e nem pausa nem tarefa eram gravadas.
  - O mesmo Message-ID já processado (outro UID ou caixa renumerada) não produz efeito.
  - Teste `tests/resposta-multicommodity.test.mjs`: empresa com açúcar, milho e etanol; resposta na thread e resposta ambígua; repetição com o mesmo UID e com outra numeração.
  - A terceira campanha é ativada direto no banco no teste, porque a regra limita 2 commodities ativas por mercado.
  - O teste da ponte "caixa renumerada" passou a esperar 1 linha (relida não duplica), em vez de 2.
- **EXCLUSAO-PURGA:**
  - `inbound_messages.message_key` (HMAC do Message-ID, índice) na 0032: a deduplicação continua depois da purga. Testado: mensagem relida após a exclusão não volta ao R2 nem abre tarefa.
  - A purga das tarefas passou a considerar todas as mensagens da pessoa, inclusive já purgadas, para alcançar uma tarefa ligada à mão depois.
  - Tarefas antigas: `correcoes/0032-vinculo-tarefas-resposta.sql` liga só com candidata única e audita.
    - Ambíguas: `GET /api/tasks/reply-review` e `POST /api/tasks/:id/link-inbound`.
    - A exclusão informa `replyTasksToReview`.
    - Prévia só leitura em produção: 2 tarefas, 1 candidata cada.
  - 9 testes de exclusão, todos com dados fictícios.
  - Dados que permanecem documentados com motivo, acesso e decisão T11 pendente (`EXCLUSAO-PURGA-PLANO.md` §2), sem classificação de "aceito".
- **Plano do D1:** não confirmado.
  - `wrangler whoami` e `d1 info` não mostram o plano; `GET /accounts/{id}/subscriptions` falhou por autenticação (token sem leitura de cobrança); `workers/account-settings` = `standard`, que existe nos dois planos.
  - `time-travel info --timestamp` de 7 dias e 7 horas atrás devolveu o bookmark inicial: é indício, não prova.
  - Onde conferir: painel → Workers & Pages → Plans, ou Manage Account → Billing → Subscriptions.
- **Verificação:**
  - suíte completa 384 + 2 + 15 (ponte), 0 falhas;
  - suíte da versão em produção (`b3935f9`) com a 0032 final aplicada: 373/373, numa cópia temporária já removida.
- **Fora desta etapa:** nada publicado, nenhuma purga real, nenhum backup ou registro local apagado; canal `planned`, campanhas inativas.

## Publicação de EXCLUSAO-PURGA e da correção de respostas (2026-10-01, autorizada por Rogério)

Ordem seguida (EXCLUSAO-PURGA-PLANO.md §4):

1. **Commits conferidos:** `v2-revisao-2` limpa e igual a `origin` em `ab040e3`; código a publicar: `ab723e9`, `c3c2bd1`, `1b9fd59`, `ab040e3` (os demais desde `b3935f9` são só documentos).
2. **Verificação:** `npm run check` com 384 + 2 + 15, 0 falhas.
3. **Bookmark** antes da migração: `00000707-0000008e-000050f7-312320b704e8e0ba63c6ac20ac4f909d` (20:47 UTC).
4. **Backup protegido:**
   - arquivo: `C:\Users\Roger\eag-compass-backups\d1-remoto-antes-0032-20261001\eag_compass.sql`, 29.416.992 bytes, do mesmo bookmark;
   - SHA-256 `3ab1ff618686297f8e0cfdfc007b563e158a0c3fa6002bd91bad4a47afd7077a`;
   - acesso só de `ROGERIONOTE\Roger`, sem herança.
   - Correção registrada: a primeira aplicação de permissões (`icacls /inheritance:r … /T`) deixou o arquivo sem nenhuma entrada; foi corrigida com permissão explícita e o hash conferido de novo, igual. Contém PII; guarda conforme decisão T11.
5. **Migração:** só a `0032_exclusao_purga.sql` pendente; aplicada (9 comandos).
   - Esquema conferido: trigger novo; `erasure_ledger` vazio; `idx_inbound_message_key`; colunas `tasks.inbound_id`, `ficha_messages.purged_at`, `inbound_messages.content_purged_at` e `message_key`.
6. **Vínculo das tarefas:** a prévia mostrou 2 tarefas sem vínculo, 1 candidata cada (igual ao esperado).
   - `correcoes/0032-vinculo-tarefas-resposta.sql`: `5aa82911…` → `ea7d4ca4…` e `9e00ea80…` → `f896fb57…`.
   - Auditoria `vinculo-tarefas-0032` = 2; tarefas sem vínculo = 0.
7. **Worker:** `validate-deploy` OK; `wrangler deploy` → versão **`9913e71c-66f5-4be4-8fb4-58c7209d7a36`** (20:50 UTC), 100% ativa (conferido em `deployments status`).
8. **Conferências só de leitura:**
   - `GET /api/tasks/reply-review` = 0 itens;
   - ficha da Amori igual (`in_approval` v2, passo 1 `d60987c8…`);
   - canais `planned`.
9. **Ponte Windows:**
   - antes: `config.json` `96786122909BD5B3…` e `segredos.json` `2A5BB59649A52218…` (prefixos do SHA-256, conteúdo não lido); diário com 6 linhas, todas `reported`;
   - `ponte parar` (parada limpa) → código já em `ab040e3` na mesma pasta → `ponte iniciar`: PID 15068, leitura OK às 16:52:37 e 16:57:35 (Cuiabá);
   - depois: mesmos hashes e mesmas 6 linhas;
   - `redigir-diario.mjs` **não executado** (adiado por decisão T11).
10. **Parada da ponte pelo prazo do teste:** às 21:00 UTC a ponte parou sozinha pelo `BRIDGE_TEST_DEADLINE = 2026-10-01T21:00:00Z` do `config.json`, prazo do teste interno. O processo anterior tinha o mesmo prazo. A trava não alterou nada, porque o canal já estava `planned`. Desde então a ponte está parada e a caixa não é lida. A configuração não foi alterada: remover ou trocar o prazo depende de decisão de Rogério.
11. **Estado conferido em 2026-10-06:**
    - canal `email` `planned` (desde 2026-10-01 17:51 UTC);
    - campanhas: 1 `draft`, 1 `ended`;
    - fila: 5 `accepted` (internas, a última às 17:46 UTC de 01/10, antes da publicação) e 19 `cancelled`;
    - **nenhuma mensagem enviada** depois da publicação.
12. **Fora desta autorização:** nenhuma purga real, remoção de supressão, redação de registros nem exclusão de backup.

## Ponte de e-mail retomada em operação contínua (2026-10-06, decisão de Rogério)

- **Antes de mexer:** canais `planned`; campanhas 1 `draft` e 1 `ended` (nenhuma ativa); fila 5 `accepted` + 19 `cancelled`, **0 pendentes**.
- **Tarefas do Windows:** só existe "EAG Compass - ponte de e-mail" (gatilho ao entrar no Windows). A tarefa do prazo do teste interno já tinha sido removida em 01/10. Nada do teste na pasta Inicializar nem em `HKCU\…\Run`. Nenhuma tarefa foi desativada.
- **Cópia protegida** da configuração: `eag-compass-backups\ponte-config-antes-prazo-20261006\config.json`.
  - SHA-256 `96786122909BD5B348AE4D923349FD18303E41FDCD37B9D15646C53BB670DB61`, igual ao original.
  - Acesso só de `ROGERIONOTE\Roger`. A permissão explícita foi aplicada antes de cortar a herança e o arquivo continuou legível.
- **Correção:** removida só a chave `BRIDGE_TEST_DEADLINE`. As chaves `SMTP_PORT`, `MAILBOX_USER` e `COMPASS_URL` ficaram na mesma ordem, e o recuo foi mantido. `segredos.json` inalterado (`2A5BB59649A52218…`). Diário: 6 linhas, todas `reported`, antes e depois.
- **`ponte conferir`:** `compass_ok`, `imap_ok` (131 mensagens), `smtp_ok` (`smtp.hostinger.com:465`), "nenhuma mensagem enviada".
- **`ponte iniciar`:**
  - PID 1868 às 00:17:16 (Cuiabá);
  - início automático ligado; gatilho de logon ativo; reinício a cada 1 min, até 999 vezes; sem limite de tempo; resultado 267009, que significa "em execução".
- **Ciclos observados:** 04:17:47, 04:18:58 e 04:20:15 UTC.
  - Todos com `nothing_due`, leitura OK, `lastReadError` nulo e 0 envios.
  - No Compass: `reply_reader_state.last_read_ok_at = 2026-10-06T04:20:13Z`. O último erro registrado é o antigo de 2026-10-01, sem erro novo.
- **Estado final:** canal `planned`, nenhuma campanha ativa, fila inalterada (último `accepted` em 2026-10-01 17:46 UTC), **nenhuma mensagem enviada**.
- **Fora desta etapa:** canal e campanhas não ativados; nenhuma purga; `redigir-diario.mjs` não executado; prazos da T11 continuam pendentes.

## Revisão do fluxo principal e comparação produção x branches (2026-10-06, sem publicar)

- **Fila:** os itens não implementados (P1-T12, P2-T15, P2-T17, P3-T12, RADAR-PESSOAS, T11-VALIDACAO) dependem só de portões externos ou decisões. Nenhum é trabalho técnico puro.
- **Leitura em produção não feita:** a sessão do Access expirou (302 para o login, que exige navegador). A revisão foi feita no código e com dados fictícios.
- **Erros concretos corrigidos** (commit local `91fbd46`):
  1. **"Antes de aprovar" incompleto.** A tela montava a lista no navegador e omitia gates que `approve()` confere: liberação internacional (P3-T12), seleção e validação comercial, endereço confirmado, fuso por destinatário, dados excluídos e exclusões reaplicadas. Para as fichas alemãs, a tela mostraria 2 pendências e a aprovação recusaria por uma terceira, invisível.
     - Agora `getFicha` devolve `approvalGates`, calculados pelo servidor na mesma ordem.
     - Também mostra, à parte, o que o pré-envio ainda exige: e-mail validado em dia, pela mesma regra do `preSendCheck`, e triagem de sanções.
     - Teste: cada bloqueio mostrado corresponde à recusa real, um a um, até aprovar.
  2. **"Próximo passo" do cartão da busca internacional.** Ignorava a ficha aberta da empresa (ex.: Amori em aprovação aparecia com "Porte não informado") e tratava o canal geral publicado como "nenhum contato".
     - Agora a ficha aberta da campanha vem primeiro, e o canal geral aponta a ficha de identificação, indicando se o e-mail está validado.
- **Verificação:** `npm run check` com 386 + 2 + 15, 0 falhas; UI smoke OK, sem erros JS.
- **Comparação produção x branches:** `BRANCHES-E-PRODUCAO.md`.
  - Produção = código de `origin/v2-revisao-2`.
  - `main` desatualizada, ancestral, 50 commits atrás.
  - Proposta de avanço simples registrada, não executada.
- **Estado preservado:** ponte lendo a caixa; canal `planned`; nenhuma mensagem, crédito, purga ou publicação.

## Publicação da correção do fluxo e sincronização da main (2026-10-06, autorizada por Rogério)

1. **Conferência antes de publicar:**
   - `v2-revisao-2` limpa, 2 commits à frente do GitHub: `91fbd46` (código: `public/app.js`, `src/fichas.js`, `src/foreign-search.js` e testes) e `2abf8fe` (só documentos);
   - código em relação à produção anterior: só `91fbd46`;
   - sem migração.
2. **Verificação:** `npm run check` com 386 + 2 + 15, 0 falhas.
3. **Publicação:** `npm run deploy` (o `predeploy` repetiu `check` e `validate-deploy`).
   - Versão **`4a515430-0249-43bb-9663-1f3982dd7cb8`** (13:58:59 UTC), do commit **`2abf8fe`**; 1 arquivo estático novo (`app.js`).
   - `v2-revisao-2` enviada (`58a2d24..2abf8fe`).
4. **Depois da publicação (D1):**
   - canal `email` `planned`; 0 campanhas ativas; 0 envios pendentes;
   - fila com 5 `accepted`, o último em 2026-10-01 17:46 UTC (nenhum envio novo);
   - leitura da caixa pela ponte às 13:59:36 UTC, depois do deploy.
5. **Bloqueios das fichas em produção:** **não conferidos pela API**. A sessão do Access expirou (`cloudflared access token`: "Unable to find token") e o login exige navegador. Os bloqueios estão cobertos pelo teste que compara cada um com a recusa real de `approve()`.
   - A conferir depois de `cloudflared access login`: Amori, BLACK & YUM e 24grad devem listar `campaign_active`, `international` e `channel`.
6. **`main`:** workflows conferidos (só CI no push; deploy manual).
   - Avanço simples `bbe69ec..2abf8fe` no GitHub e `38eea61..2abf8fe` local, sem force push e sem commits exclusivos a preservar.
   - Rodou só "Validate EAG Compass" nas duas branches.
7. **Lista de decisões restantes** corrigida, com os bloqueios pelo nome: `DECISOES-PILOTO-2026-10-01.md`, atualização de 2026-10-06.
8. **Fora desta autorização:** nenhuma campanha ativada, internacional não liberado, nenhum serviço contratado, nenhuma purga.

## Bloqueios corrigidos conforme a Spec e próximo passo da descoberta no Brasil (2026-10-06)

- **Correção:** a lista de 2026-10-06 punha os prazos de retenção da T11 entre os itens que não bloqueiam. Pela Spec, a T11 (inclusive a política de ciclo de vida e retenção) é exigida "Antes de contatos reais da Etapa 1" (tabela de dependências; §6.0.1 "validação jurídica da retenção (T11)"; premissa de retenção; R9.1; R23.4; P7). Lista corrigida em `DECISOES-PILOTO-2026-10-01.md`, separando descoberta de abordagem. A versão errada ficou marcada como substituída.
- **Fontes nacionais:**
  - radar R11 depende de T4, e a única fonte aprovada é a Casa dos Dados (G8), sem chave;
  - só a busca dela cria `company_units`;
  - Dados Abertos da Receita: gratuitos, não implementados; o endereço registrado devolveu 404 em 2026-10-06.
- **Caminho manual conferido localmente** (dados fictícios, rede bloqueada):
  - empresa por CNPJ com fonte 201;
  - perfil 200 `pending_size`;
  - evidência 201;
  - pessoa manual com fonte 201;
  - pesquisa de pessoas: QSA `skipped` ("Sem CNPJ de unidade cadastrado"), 0 unidades.
- **Produção (só leitura):** 0 linhas setor → CNAE, 5.570 municípios, 0 buscas nacionais, 6 empresas brasileiras (as do teste interno), nenhuma campanha nacional ativa.
- **Próximo passo e dados a fornecer:** `DESCOBERTA-BRASIL-PROXIMO-PASSO.md` (opções A manual, B Casa dos Dados em avaliação, C unidade pela BrasilAPI como funcionalidade nova).
- **Nada contratado, ativado ou enviado.**

## Descoberta milho GMO — Indiara/GO, 300 km (2026-10-06, sem contato)

- **Busca definida por Rogério:** milho GMO; centro Indiara/GO; raio 300 km; mercado Brasil; demanda, não fornecedores.
- **Correção documental da T11 antes de propor contato:** em `DECISOES-PILOTO-2026-10-01.md`, o item 4 (retenção) passa a bloquear qualquer contato real; em `EXCLUSAO-PURGA-PLANO.md` §2, nota de que as decisões de retenção são da T11 e precedem o contato (Spec, tabela T11; §6.0.1; R9.1; R23.4).
- **Centro e raio:**
  - Indiara: IBGE 5209952, centroide -17,1852; -49,9682 (tabela `municipalities`, IBGE malhas v3 de 2026-09-23);
  - 300 km é valor permitido (R11.14), sem limite técnico;
  - 224 municípios no raio por centroide (195 GO, 28 MG, 1 DF), em `descoberta-milho-indiara/municipios-300km.csv`.
- **Fontes:**
  - Casa dos Dados indisponível (sem chave; nada contratado);
  - alternativa documentada (opção A): 9 pesquisas web por segmento de uso final;
  - BrasilAPI para 8 CNPJs de unidades: situação, CNAE, porte "Demais", município. Gratuita, sem crédito.
- **Resultado em `descoberta-milho-indiara/CANDIDATAS.md` e `candidatas.csv`:**
  - 25 consumidoras, fábricas e processadoras (10 com evidência explícita de milho, 15 com indício);
  - 3 projetos;
  - 2 processadoras que declaram **não-GMO** (evidência contrária), mais Caramuru com linha não transgênica declarada;
  - 5 traders e originadores em grupo separado;
  - 2 encontradas fora do raio (Neomille 316 km; Mantiqueira 358 km).
  - Unidade separada da sede; distância estimada pelo centroide do município da unidade; GMO "a confirmar" em todas.
- **Cobertura parcial declarada:** só em Anápolis há 32 empresas ativas com CNAE 1066-0, e no estado há 146 com CNAE 1064-3. A lacuna exige fonte estruturada.
- **Ajustes de veracidade antes de salvar:** três sites que eu tinha preenchido sem fonte consultada (Cargill, SuperFrango, De Heus) foram trocados por "não encontrado nesta rodada"; o grupo da Fazenda Colorado foi corrigido para "Grupo JBJ".
- **Nada aceito, cadastrado, validado ou enviado.** Canal `planned`.

### Rodada 2 — cadastro oficial MAPA (SIPEAGRO) + Receita (2026-10-06, sem contato)

- **Fonte oficial adotada após validação por amostra:**
  - CSV aberto "SIPEAGRO — Alimentação Animal": CC-BY, arquivo de 04/10/2026, 17.977 linhas, CNPJ mascarado;
  - lista oficial em PDF de 21/07/2026, com CNPJ completo;
  - o CNPJ do PDF só é aceito quando bate com os dígitos visíveis do CSV.
  - Nada contratado.
- **Enriquecimento:** BrasilAPI para 361 CNPJs (situação, CNAE, porte, matriz/filial, município), um pedido a cada 2 s, 0 erros. Sem e-mails, telefones ou pessoas.
- **Deduplicação:** só por CNPJ completo.
  - 1.743 linhas no raio → 507 registros → 472 ativos → **445 fabricantes ativos únicos** (389 por CNPJ conferido; 56 com CNPJ a conciliar).
  - Das 36 candidatas manuais, 4 têm o mesmo CNPJ completo de um registro e foram fundidas.
  - 32 continuam em linhas próprias; 21 delas têm **possível correspondência** (nome e município) com 26 registros, sem fusão.
  - Estabelecimentos distintos: **entre 456 e 477**.
- **Vínculos entre evidência manual e unidade:**
  - **5 confirmados**: Cargill Uberlândia, pelo CNPJ publicado no parecer IGAM/COPAM; e 4 unidades com o mesmo CNPJ no cadastro oficial e no MAPA, todas indícios: SuperFrango ×3 e Comigo Rio Verde;
  - **21 sugeridos**, a conciliar.
  - Das 12 evidências específicas de milho, só 1 tem vínculo confirmado com a unidade.
- **Dimensões separadas:** papel, atividade, porte (ME/EPP/Demais, sem deduzir PME de "Demais"), raiz de CNPJ (≠ grupo econômico), situação MAPA e Receita, evidência, GMO, precisão da distância (sempre por centroide; ≥ 270 km = conferir).
- **Restrição não-GMO só na linha ou unidade citada:** Milhão (linha de ingredientes Non-GMO), BRMill (unidade) e Caramuru (linha).
- **"32 em Anápolis" e "146 em GO":** vêm dos agregadores privados cirtrox.com.br e cnpjgo.com.br. Não são cobertura comprovada; o SIPEAGRO tem 26 fabricantes ativos em Anápolis.
- **Entrega:** `CANDIDATAS.md` (rodada 2), com:
  - primeiro lote de 10 com evidência específica para aceite;
  - segundo lote sugerido de 7;
  - 150 ME/EPP visíveis.
  - Também `candidatas.csv` (477 linhas) e scripts em `descoberta-milho-indiara/scripts/`.
- **Nada aceito, cadastrado, validado ou enviado.**
### Qualificação dos lotes (2026-10-06, sem contato nem aceite)

- **Lote 1:** CNPJ, endereço e distância revisados.
  - 4 vínculos confirmados:
    - Cargill Uberlândia (CNPJ, endereço e coordenada no parecer SUPRAM 2021; 256,5 km pela coordenada);
    - Rei do Milho (endereço do site = Receita; em recuperação judicial);
    - São Martinho Boa Vista e Cargill Bioenergia São Francisco (Receita com o nome da unidade e o mesmo CNPJ no MAPA).
  - 4 sugeridos: Gem, BRF, Caramuru, JBJ.
  - Rebaixadas: Usina Rio Verde ("grãos" não prova milho) e JBS Aruanã (evidência histórica de 2014; mantida separada da JBJ, pois o endereço comum não comprova identidade nem sucessão).
- **Revisão 2 da qualificação:** idade da empresa deixa de ser critério; Camaru, Rações Garantido, Casa do Milho e Rações 2 Irmãos voltam como candidatas com pendências a conciliar; lista curta em 3 grupos (compra de terceiros comprovada: Cargill Uberlândia; uso comprovado, compra a confirmar: Cimilho e outras 10; atividade compatível: 12). Consultas à BrasilAPI suspensas enquanto houver 429. Suíte não repetida (revisão só documental).
  - Compra de terceiros comprovada só na Cargill Uberlândia; a JBJ produz parte do próprio milho.
- **Lote ME/EPP (8):** só a Cimilho tem evidência própria de milho; as outras 7 têm atividade pertinente e endereço conferido, sem fonte própria.
- **Reconciliação:**
  - 474 linhas no CSV; 456–474 estabelecimentos distintos;
  - 152 ME/EPP (100 + 52), das quais 150 listadas na seção 10 e 2 na seção 9.
- **Limite de taxa:** a BrasilAPI respondeu 429 nas novas consultas de endereço. O endereço veio de páginas públicas da base da Receita (08–09/2026).
- **Arquivo:** `descoberta-milho-indiara/QUALIFICACAO-LOTES-2026-10-06.md`.
### Lote aceito para qualificação (2026-10-06)

- **Aceite de Rogério:** Cimilho, Cargill Uberlândia, São Martinho Boa Vista e Cargill Bioenergia São Francisco. Autoriza cadastro e pesquisa; não confirma compra atual, GMO nem abordagem.
- **Cadastro no Compass bloqueado por credencial:**
  - sessão do Access expirada ("Unable to find token");
  - D1 remoto com erro 7403;
  - nada gravado direto no banco;
  - pronto para aplicar: `cadastro-lote-aceito.json` + `scripts/cadastrar-lote-aceito.mjs`, que simula por padrão e não anexa nada a uma raiz de CNPJ já existente.
- **Conferências:**
  - São Martinho passa a ter compra de terceiros comprovada (carta financeira de 17/06/2024: cerca de 439 mil t de milho compradas para 24/25; relatório: milho de cooperativas, tradings e produtores);
  - Cargill Uberlândia em operação (vaga de envase de amido, 09/2026);
  - Cimilho a 263,0 km pela rua (OSM, ±1 km).
- **Pessoas com fonte pública (LinkedIn ou notícia), sem e-mail deduzido:**
  - Cargill Uberlândia: gerente de originação de milho (CSSTSA) e um originador;
  - São Martinho: gerente de originação de milho e diretor comercial e de logística;
  - Cargill Bioenergia: gerente de suprimentos corporativo, com responsabilidade por milho **não** declarada; originador atual a verificar;
  - Cimilho: nenhuma pessoa.
  - Nenhum decisor confirmado.
- **Detalhe:** `descoberta-milho-indiara/LOTE-ACEITO-2026-10-06.md`.
### Lote aceito — revisão 2 (2026-10-06)

- **Leitura do Compass (D1, só SELECT):** nenhuma das 4 raízes de CNPJ cadastrada, nenhuma duplicata por nome e nenhuma unidade. O cadastro segue **só preparado**; a API continua sem sessão do Access.
- **Distâncias, mesma metodologia** (linha reta, haversine, centroide de Indiara até o melhor ponto da unidade):
  - Cargill Uberlândia: 256,5 km (coordenada oficial);
  - Cimilho: 263,0 km (rua, OSM);
  - São Martinho e Cargill Bioenergia: 151,4 km (centroide; sem coordenada pública da usina).
  - Não é percurso rodoviário.
- **Pesquisa:**
  - Cargill Uberlândia: o merchant cuida do milho Non-GMO e waxy; o milho regular está alinhado com a CASC (a confirmar);
  - São Martinho: 120 fornecedores de milho homologados; Portal de Compras Paradigma só para suprimentos; gerente de originação desde 01/2026;
  - Cargill Bioenergia: originador atual não identificado;
  - Cimilho: compra de terceiros não comprovada (armazenagem e moagem para terceiros não são compra);
  - GMO a confirmar nas 4.
- **Correção:** o texto anterior dizia que o ex-originador da Cargill Bioenergia (Valter Junior) "saiu em 02/2026". A postagem era de outra pessoa; ele segue na Cargill em Quirinópolis, com função atual não descrita.
- **Pacote:** retirado `coprodutos@` (vendas).
- **Suíte:** não repetida, porque só houve mudança de documentos e dados.
### Lote aceito — rodada 3: registros utilizáveis (2026-10-06)

- **Local (D1 `eag-compass-db`, `npm run dev`):** as 4 unidades estão cadastradas pela API, cada uma com:
  - evidência pendente;
  - perfil "possível consumidor final";
  - pessoas com fonte (2, 2, 2 e 0);
  - canal geral (só Cimilho);
  - ligação de nível 0 com roteiro da unidade.
  - Conferido por API e pela tela, por screenshot do Chrome headless.
- **Produção:** não cadastrado; a sessão do Access segue ausente. A leitura do D1 de produção mostra 0 empresas nas 4 raízes.
- **Código:**
  - `POST /companies/:id/level0` aceita `unitScript`, colocado depois do roteiro da skill, e recusa uma segunda ligação aberta para a mesma empresa e commodity (409);
  - `GET /companies/:id` devolve `openTasks` (com roteiro) e `peopleCount`;
  - a tela da empresa mostra a próxima ação registrada e o roteiro, a unidade no título e as pessoas a validar;
  - `VERSION` deixou de ser exportação do worker, porque o workerd local recusava exportação que não é entrypoint;
  - `env.local` ganhou `routes: []`, porque o wrangler dev herdava o domínio de produção e quebrava o login local.
  - Testes: `tasks.test.mjs` com casos novos; suíte completa com 403 aprovados e 0 falhas.
  - **Não publicado.**
- **Buscas específicas:** nenhum canal oficial de compra de milho para a Cargill Uberlândia nem para a São Martinho Boa Vista. O telefone da Boa Vista fica como pendência explícita.

### Publicação, cadastro em produção e recuperação da ponte (2026-10-06)

**Versões, separadas:**

| Componente | Versão |
|---|---|
| Worker publicado | **770334ac-f855-4fc3-ae7f-66e85b902ce9**, do commit 5a062cd, via `npm run deploy` (check com 403 aprovados e 0 falhas, `validate-deploy`, skill 33bd093f…). Nenhuma migração pendente ("No migrations to apply") |
| Scripts locais da ponte (Windows, fora do Worker) | commit cb05b4c (ouvinte de `error` no IMAP) mais o commit deste registro (supervisor, gatilho de reserva e `ponte parar`). Testes da ponte: 16 aprovados; o teste novo falha sem a correção |

**Cadastro em produção:**
- Aplicado pelo script documentado, depois do login de Rogério no Access e de conferir que não havia registro (0 empresas nas 4 raízes).
- Resultado: 4 empresas (1 por CNPJ), 4 evidências pendentes, 6 pessoas "a validar" (`to_validate`), 1 canal geral (Cimilho), 4 perfis "possível consumidor final" com porte pendente e 4 tarefas `call_l0` abertas.
- Conferência com o pacote: fonte e URL iguais; o roteiro começa pelo da skill e termina com o trecho da unidade e suas pendências.
- Tela de produção conferida por captura (Cargill Uberlândia): resumo, pessoas a validar, próxima ação e roteiro.
- As 4 ligações aparecem em Abordagem → Tarefas como **bloqueadas** (`compliance_unavailable`, sem triagem de sanções dessas empresas) e aguardam também a T11.
- Canal de e-mail `planned`; campanhas: 1 rascunho e 1 encerrada (nenhuma ativa); outbox sem envio pendente (5 aceitos e 19 cancelados, anteriores).

**Ponte: queda e divergência corrigida:**
- A ponte caiu às 14:25 UTC: ECONNRESET no AUTHENTICATE, com `error` sem ouvinte. Não reiniciou: o "reiniciar se falhar" da tarefa agendada só vale quando a tarefa não consegue iniciar. A OPERACAO afirmava reinício a cada 1 min e foi corrigida.

**Verificações da recuperação (só o observado):**

| # | Verificação | Resultado |
|---|---|---|
| 1 | Supervisor | **Comprovada.** Node derrubado à força às 13:23:43 (Cuiabá); `supervisor_restart` registrado (exitCode -1); ponte de volta às 13:24:53 (PID 11252), com leitura OK e sem envio |
| 2 | Gatilho de reserva | **Comprovada.** Supervisor e node derrubados às 13:25:09; a tarefa iniciou pelo gatilho de 15 min às 13:38:38; leitura OK às 13:38:57 (PID 15576) |
| 3 | Sem duas instâncias | **Comprovada no nível da tarefa.** Novo início da tarefa pedido às 13:39:30 com a ponte rodando; às 13:39:49 havia 1 supervisor (13980) e 1 ponte (15576). A trava por PID do `main.js` não foi exercitada separadamente nesta rodada |
| 4 | `ponte parar` | **Comprovada.** Parada às 13:40:00; às 13:42:06, nenhum processo, tarefa desligada e nenhum `supervisor_restart` |

- Uma leitura feita por monitor contou o próprio processo do monitor como supervisor e foi descartada; valem as leituras diretas acima.
- **Estado final:** ponte iniciada às 13:42:19 (PID 6724); leitura OK às 13:42:26, `nothing_due`, 0 envios.
- **Nada foi feito em contato, envio, Snov, ficha ou campanha.** O bloqueio da T11 segue.

### Triagem de sanções do lote milho Indiara e situação das ligações (2026-10-06)

**Critério aplicado (sem alteração):** política decidida por Rogério em 2026-09-24 (T11-POLITICA-PROPOSTA §1):
- listas OFAC SDN (bloqueio legal), CGU CEIS e CGU CNEP (alerta de integridade);
- validade de 30 dias (`sanctions_max_age_hours` = 720);
- sem pessoas físicas (sócios não entram);
- busca por razão social e nome fantasia (nome normalizado exato), CNPJ exato e **outras unidades da mesma raiz de CNPJ** (vão para revisão). Só o CNPJ exato bloqueia; nome sozinho nunca bloqueia sem decisão do Administrador.

**Listas (validade conferida):**

| Lista | Versão | Baixada (UTC) | Registros | Com CNPJ de 14 dígitos |
|---|---|---|---|---|
| OFAC SDN | `SDN.CSV+ALT.CSV sha256:cf3ffced4675` (id 00e702fc) | 2026-09-24 19:17 | 11.857 | 0 (lista estrangeira; triagem por nome) |
| CGU CEIS | `20260924_CEIS` (id 279f05dc) | 2026-09-24 19:19 | 14.503 | 14.491 |
| CGU CNEP | `20260924_CNEP` (id 9b743870) | 2026-09-24 19:21 | 1.783 | 1.771 |

Válidas até **2026-10-24 ~19:17 UTC**. Depois disso, a triagem deixa de valer (`compliance_unavailable`) até reimportar as listas e triar de novo.

**Triagem pelo fluxo existente** (`POST /api/companies/:id/screening`, Rogério Palhari, 2026-10-06 18:34 UTC, produção):

| Unidade | CNPJ | Run | Resultados |
|---|---|---|---|
| Cimilho | 19.980.044/0001-53 | 87d77256 | 0 (bloqueio 0, revisão 0) |
| Cargill — complexo de Uberlândia | 60.498.706/0134-88 | 327afb8d | 0 |
| São Martinho — Usina Boa Vista | 51.466.860/0062-78 | d3d1f68b | 0 |
| Cargill Bioenergia — Usina São Francisco | 10.249.419/0002-16 | 50693a84 | 0 |

Cada run registra a consulta (CNPJ, país, razão social) e as versões das 3 listas.

**Conferência complementar** (consulta somente leitura, fora do critério; não altera o resultado):
- Nenhuma entrada das listas com as raízes 19980044, 60498706, 51466860 ou 10249419.
- Nomes parecidos (contendo CARGILL, CIMILHO, SAO MARTINHO ou MILHO GUIMARAES): 1 ocorrência, "Comércio de Peças para Tratores São Martinho", CEIS, CNPJ 80.652.548/0001-55. Raiz e atividade são diferentes da São Martinho S/A (51.466.860). Pelo critério aprovado, isso não é correspondência (nem nome exato, nem CNPJ, nem raiz).
- Fica **registrada para análise de Rogério, sem confirmar sanção** e sem bloquear.

**Ligações (Abordagem → Tarefas) depois da triagem:**
- As 4 tarefas `call_l0` deixaram a lista de bloqueadas: `compliance_unavailable` saiu, e não há pausa nem supressão.
- **Bloqueios que permanecem:**
  - **T11 não validada.** A Spec exige a T11 "antes de contatos reais". **O sistema não impõe isso nas ligações**: o bloqueio é o aviso na primeira linha de cada roteiro e a decisão de Rogério. Se ele quiser trava no sistema, uma pausa (R22) por empresa ou commodity faria isso; não foi criada sem decisão.
  - **Validade da triagem:** vence com as listas em 2026-10-24.
  - **São Martinho:** sem telefone confirmado.
- Ponte lendo a caixa; canal de e-mail `planned`. Nenhum contato, envio, Snov, ficha ou campanha.

### T11: preparação da validação do piloto brasileiro (2026-10-06)

- **Documento:** `T11-VALIDACAO-PILOTO-BR.md`, com:
  - tabela exigência × proposta × questão jurídica, com requisitos citados;
  - mensagem pronta para o responsável da EAG, **não enviada**;
  - opções de retenção A–H, **nenhuma escolhida**.
  - Único bloqueio expresso para as ligações: a Spec exige a T11 "antes de contatos reais".
- **Telefone da São Martinho Boa Vista:** (64) 3615-9700, página oficial "Negócios & Unidades" (saomartinho.com.br), consultada em 06/10/2026. É o telefone geral da unidade; o mesmo número aparece na Prefeitura de Quirinópolis e no CONSECANA.
- **Distância:** coordenada oficial da usina (-18,5477; -50,4326) a 159,3 km em linha reta do centroide de Indiara.
- **Pendência:** o roteiro da tarefa em produção ainda diz "telefone não confirmado"; editar exige decisão.
- Nada aprovado, enviado ou contatado.

### Edição de tarefas publicada e tarefa da São Martinho corrigida (2026-10-06)

- **Antes:** não havia rota de atualização de tarefa (só criar e concluir).
- **Implementação** (commit 9576cb9):
  - `PATCH /api/tasks/:id`, para perfis de escrita: só tarefa aberta, manual e sem ficha; motivo obrigatório; revisão contra edição concorrente (R23.3);
  - id preservado;
  - não altera estado, resultado, ficha nem aprovações;
  - a linha "ANTES DE LIGAR:" (T11) não pode ser retirada.
  - Histórico em `task_revisions` (migração 0033): valor anterior e novo cifrados, motivo, autor e data; sem UPDATE. O `audit_log` registra só os campos (R8.1.1).
  - `GET /api/tasks/:id/history`. A exclusão de dados pessoais apaga o histórico junto com o roteiro.
- **Testes:** 2 casos novos em `tasks.test.mjs`: edição e histórico, recusas (sem motivo, revisão antiga, retirada da T11, leitor, tarefa concluída) e tarefa de ficha congelada sem alterar mensagens nem aprovações. Suíte completa: 406 aprovados, 0 falhas.
- **Publicação:**
  - backup privado do D1 antes da migração em `C:\Users\Roger\eag-compass-backups\d1-remoto-antes-0033-20261006\eag_compass.sql` (29.581.350 bytes, SHA-256 446E90E9A8A5B833…, acesso só do usuário);
  - migração 0033 aplicada;
  - Worker **9866c2c3-0f48-427c-bcbf-7366daa30597**.
- **Tarefa da São Martinho Boa Vista** (f3e7e383, produção):
  - telefone (64) 3615-9700 como canal geral da unidade, com fonte (saomartinho.com.br, "Negócios & Unidades") e data (06/10/2026);
  - distância de 159,3 km em linha reta (haversine) do centroide de Indiara até a coordenada oficial da usina, não rodoviária;
  - próxima ação: aguardar a T11;
  - revisão 1 → 2; histórico com 3 campos (`script`, `channel_note`, `next_action`); a tarefa segue aberta, não concluída, com a linha da T11.
  - Fundamento do perfil comprador atualizado com a nova distância (revisão 2).
  - Outras 3 tarefas sem alteração.
- **Estado:** canal `planned`; campanhas inativas; nenhum envio pendente; ponte lendo a caixa.

### Lote de 6 candidatas ME/EPP qualificado (2026-10-06, sem contato)

- **Candidatas:** Rural Forte, Sociagro, Nutrir, Super-Bovi, Rações VR, Ração Ituiutaba. Detalhes em `descoberta-milho-indiara/QUALIFICACAO-LOTES-2026-10-06.md`, seção final.
- **Cadastro:** todas ativas, EPP, CNAE 1066-0, matriz.
- **Divergências de endereço:**
  - Nutrir resolvida: o endereço da Av. Goiás é da filial 0003-42, baixada em 26/11/2021; a unidade ativa é a matriz na Rua VA-14;
  - Sociagro não resolvida: Rua Tegucigalpa "Sala A" no cadastro × "GO-320 saída para Jandaia" no diretório de mapas.
- **Fonte própria:** só a Rações VR (perfil no Instagram: "Fábrica de Rações… Orizona").
- **Homônimo descartado como fonte:** `ruralforte.com.br` é de outra empresa (SP).
- **Milho:**
  - nenhuma tem evidência própria de uso de milho;
  - Ração Ituiutaba tem só indício de terceiro (avaliação de 2018);
  - compra de terceiros não comprovada em nenhuma;
  - GMO a confirmar em todas.
- **BrasilAPI:** 200 no teste e depois **403** no lote; consultas suspensas e cache reaproveitado.
- **Recomendações:**
  - aceitar para qualificação: Rações VR e Rural Forte;
  - manter em descoberta: Nutrir (aceite opcional), Super-Bovi, Ração Ituiutaba e Sociagro.
- Nada aceito, cadastrado, enviado ou contatado; Snov e T11 inalterados.

### Lote de 6 ME/EPP aceito e cadastrado em produção (2026-10-06)

- **Aceite de Rogério:** Rural Forte, Sociagro, Nutrir, Super-Bovi, Rações VR e Ração Ituiutaba, para qualificação. Não confirma milho, compra de terceiros, GMO nem responsável.
- **Antes:** produção sem nenhuma das 6 raízes de CNPJ, nem nomes parecidos.
- **Aplicado** com `scripts/cadastrar-lote-aceito.mjs` e `cadastro-lote-pme-aceito.json` (simulação antes):
  - 1 empresa por CNPJ confirmado;
  - perfil "não confirmado" (`unconfirmed`, porte pendente);
  - 1 ligação de nível 0 com roteiro: skill mais a unidade, com a linha da T11, telefones e distância com método;
  - canal cadastral e próxima ação gravados pela edição auditada (revisão 2, histórico com 2 campos).
  - **Nenhum contato criado:** canais cadastrais identificados como tais; e-mails cadastrais de aparência pessoal não copiados.
- **Telefones divergentes registrados com fonte:** Super-Bovi (Receita × Diário Cidade), Ração Ituiutaba (Receita × Telelista), Sociagro (2 números da Receita).
- **Pendência de localização:**
  - Sociagro: Rua Tegucigalpa "Sala A" × GO-320;
  - Nutrir: fábrica no endereço atual, em bairro residencial.
- **Ligações:** aparecem em Abordagem → Tarefas **bloqueadas por `compliance_unavailable`**: a triagem de sanções dessas 6 ainda não foi feita. Aguardam também a T11.
- **Estado:** canal `planned`; campanhas inativas; nenhum envio pendente. Total de empresas: 21.

### Triagem de sanções do lote de 6 ME/EPP e regra para os próximos lotes (2026-10-06)

- **Critério e listas:** os mesmos das 4 anteriores, sem alteração: política de 24/09 (OFAC SDN, CGU CEIS, CGU CNEP; 720 h).
  - OFAC `SDN.CSV+ALT.CSV sha256:cf3ffced4675` (24/09 19:17 UTC);
  - CEIS `20260924_CEIS` (19:19);
  - CNEP `20260924_CNEP` (19:21).
  - Válidas até **24/10/2026, por volta das 19:17 UTC**.
- **Triagem pelo fluxo existente** (`POST /api/companies/:id/screening`, 06/10/2026). Cada run registra consulta (CNPJ, país, razão social) e versões das listas.

| Unidade | CNPJ | Run | Resultados |
|---|---|---|---|
| Rural Forte — fábrica, Pontalina | 06.026.372/0001-73 | d08d1af1 | 0 |
| Sociagro — Paraúna | 08.769.542/0001-35 | ec408e20 | 0 |
| Nutrir — matriz, Itaberaí | 26.899.864/0001-80 | bbf98d7e | 0 |
| Super-Bovi — Goianápolis | 19.091.828/0001-20 | e93f2e8f | 0 |
| Rações VR — fábrica, Orizona | 07.611.367/0001-90 | bb126102 | 0 |
| Ração Ituiutaba | 71.054.894/0001-40 | 6c1a600a | 0 |

- **Conferência complementar** (somente leitura, fora do critério):
  - nenhuma entrada com as 6 raízes de CNPJ;
  - 1 nome parecido, "dinutrir" (CEIS, 31.865.774/0001-09): raiz e nome diferentes, só o trecho "nutrir" coincide. **Para análise de Rogério, sem bloquear e sem confirmar sanção.**
- **Ligações:** as 10 ligações de nível 0 estão sem bloqueio no sistema; todas mantêm a linha da T11 no roteiro e aguardam a T11.
- **Regra para os próximos lotes (Rogério, 06/10/2026):**
  - a triagem de sanções entra na rotina de qualificação de todo lote aceito, com as listas válidas e o fluxo existente, **sem confirmação separada por empresa**;
  - listas vencidas: reimportar antes (ou registrar o impedimento);
  - correspondência por nome fica para análise.
  - **Não autoriza contato comercial.**
- **Estado:** canal `planned`; campanhas inativas; nenhum envio pendente.

## Descoberta complementar de 5 candidatas do grupo 2 (06/10/2026, sem contato)

- **Candidatas:** Rei do Milho, Caramuru Itumbiara, JBJ Aruanã, Gem Acreúna, BRF Rio Verde. Tabela, fontes e datas em `descoberta-milho-indiara/QUALIFICACAO-LOTES-2026-10-06.md`, seção "Grupo 2, descoberta complementar".
- **Correção:** a restrição não transgênica da Caramuru vale para Sorriso/MT e São Simão/GO (soja). Ela não cobre a linha de milho de Itumbiara.
- **Recomendações:**
  - aceitar com alerta: Rei do Milho (recuperação judicial com plano homologado);
  - aceitar com CNPJ a conciliar: Caramuru;
  - aceitar como conta corporativa: BRF/MBRF;
  - manter em descoberta: JBJ (compra de terceiros não comprovada) e Gem (sem fonte de operação em 2025–2026).
- **Sem aceite, cadastro, Snov, contato, ficha ou alteração da T11.** Nenhum teste rodado: alteração só de documentação.

## Grupo 2: cadastro e triagem de Rei do Milho, Caramuru Itumbiara e BRF Rio Verde (06/10/2026)

- **Aceite:** Rogério, 06/10/2026, para qualificação. JBJ e Gem seguem em descoberta.
- **Duplicações:** nenhuma em produção antes do cadastro (busca por raiz 05574242, 00080671, 01838723 e por nome). Só a Cimilho casou pelo termo "milho", com raiz diferente.
- **CNPJs:** os três foram confirmados, com o fundamento em `QUALIFICACAO-LOTES-2026-10-06.md`. Nenhum foi cadastrado como confirmado só por sugestão.
- **Cadastro em produção** (`scripts/cadastrar-lote-aceito.mjs`, arquivo `cadastro-lote-g2-aceito.json`), em cada unidade:
  - empresa com fonte, distância e método no rótulo;
  - 2 evidências pendentes de validação;
  - perfil `possible_final_consumer` (não confirmado);
  - ligação de nível 0 (revisão 2) com a linha da T11, canal e próxima ação;
  - nenhuma pessoa.
  - Canal: só o Rei do Milho tem canal (`compras@` e telefone publicados no site). Caramuru e BRF não têm e-mail publicado utilizável; o telefone e o portal ficam na tarefa.
- **BRF:** duas evidências separadas.
  - Grupo MBRF: compra de milho em 2026 (Reuters/Notícias Agrícolas, 19/03/2026) e Relatório Integrado 2024. Não sustenta condição da unidade.
  - Unidade de Rio Verde: registro MAPA de ração e operação em 2026 (AgFeed). O uso de milho específico da unidade só aparece em fonte de 2014.
  - Compras centralizadas: a confirmar. O porte não exclui a candidata.
- **Caramuru:** a evidência de correção cita a página NON-GMO (`caramuru.com/?page_id=925`): a restrição é de Sorriso e São Simão. A linha anterior da lista curta foi preservada com a nota de correção. A aceitação de GMO em Itumbiara é **desconhecida**.
- **Triagem de sanções** (`POST /api/companies/:id/screening`, critério de 24/09/2026):
  - listas válidas até 24/10/2026: OFAC SDN 00e702fc (24/09 19:17 UTC), CEIS 279f05dc (19:19 UTC), CNEP 9b743870 (19:21 UTC).

| Unidade | Identidade pesquisada | Run | Resultado |
|---|---|---|---|
| Rei do Milho | CNPJ 05574242000102 (exato e raiz); nomes "REI DO MILHO ALIMENTOS LTDA" e "Rei do Milho — fábrica, Inhumas" | e9e4903f | 0 |
| Caramuru | CNPJ 00080671000100 (exato e raiz); nomes "CARAMURU ALIMENTOS S/A" e "Caramuru — complexo industrial de Itumbiara" | 6fd1bf6f | 0 |
| BRF | CNPJ 01838723017283 (exato e raiz); nomes "BRF S.A" e "BRF/MBRF — complexo de Rio Verde (fábrica de rações)" | 00e757c0 | 0 |

- **Conferência complementar** (somente leitura, fora do critério):
  - nenhuma entrada com as 3 raízes;
  - nome parcial: "G G Brasil Foods" (CEIS, 27.606.589/0001-22), raiz e empresa diferentes; "Brasil Foods" foi nome antigo da BRF. **Para análise de Rogério, sem bloquear e sem confirmar sanção.**
  - A marca do grupo **MBRF/Marfrig não foi triada como identidade própria**: a unidade cadastrada é BRF S.A.
- **Estado conferido em produção:**
  - 24 empresas;
  - 13 ligações de nível 0 abertas, as 3 novas sem bloqueio no sistema e com a T11 no roteiro;
  - canais e-mail, WhatsApp e LinkedIn `planned`;
  - campanhas: 1 rascunho e 1 encerrada;
  - outbox sem mudança (5 aceitos, 19 cancelados);
  - 9 fichas; nenhuma criada ou aprovada.
- Sem Snov, sem contato. Nenhum teste rodado: só dados e documentação mudaram.

### Decisão: "G G Brasil Foods" x BRF Rio Verde, falso positivo (06/10/2026)

- **Decisão:** falso positivo.
- **Autor:** Rogério Palhari, em 06/10/2026. Registrado por Claude a pedido dele.
- **Alcance:** vale só para a correspondência entre a BRF S.A. (01.838.723/0172-83, empresa `a756e2b6`) e a entrada abaixo. **Não exclui "G G Brasil Foods" de triagens futuras** nem vale para outra empresa ou unidade.
- **Motivo (Rogério):** empresas distintas, com raízes de CNPJ diferentes; a semelhança parcial de nome não identifica a BRF.
- **Entrada da lista (preservada sem alteração):**
  - CGU CEIS, versão `279f05dc-9e7a-4199-b8fb-30de42d1140c`, baixada em 24/09/2026 19:19:40 UTC, válida até 24/10/2026;
  - entrada `d581de6d-7050-4e8f-b109-48c02347085a`, "G & G BRASIL FOODS - FRIG S/A", CNPJ 27.606.589/0001-22.
- **Origem da correspondência:** a semelhança veio da conferência complementar por nome parcial, que é somente leitura e fica fora do critério. Ela **não** veio da triagem do sistema:
  - a rodada `00e757c0` da BRF terminou com 0 correspondências;
  - não existe `screening_match` para essa entrada em nenhuma rodada.
  - Por isso a decisão **não foi gravada** pelo fluxo `screening_decisions`, que exige uma correspondência existente. Criar uma correspondência só para classificá-la fabricaria um registro de triagem. Este texto é o registro da decisão.
  - Se uma triagem futura do sistema gerar essa correspondência, a decisão deve ser lançada pelo fluxo próprio (Administrador, motivo obrigatório), citando esta seção.
- **Conferência depois da decisão (06/10/2026):**
  - BRF: 1 rodada, 0 correspondências, nenhuma correspondência confirmada;
  - nenhuma decisão de triagem gravada (`screening_decisions` = 0);
  - ligação de nível 0 da BRF continua aberta, na revisão 2, com a linha da T11 e sem mudança;
  - canais e-mail, WhatsApp e LinkedIn `planned`;
  - campanhas: 1 rascunho e 1 encerrada;
  - outbox sem mudança (5 aceitos, 19 cancelados);
  - 9 fichas, nenhuma criada ou aprovada.
  - **Nada foi liberado por esta classificação.**

## T11: uso individual do Compass e revisão do bloqueio das ligações manuais no Brasil (06/10/2026)

- **Decisão registrada:** Rogério aprova o uso individual do Compass como ferramenta pessoal de apoio ao seu trabalho comercial.
  - Registrada na tabela de decisões da Spec (linha de 2026-10-06).
  - Não é autorização da EAG, não é parecer jurídico nem isenção da LGPD, e **não valida a T11**.
  - Não libera e-mail automático, campanhas nem contatos na Alemanha.
- **Revisão proposta:** `T11-REVISAO-PILOTO-BR-TELEFONE.md`, não aprovada. Separa:
  - decisões operacionais (O1–O9);
  - obrigações legais da LGPD (L1–L9);
  - exigências da Spec (S1–S7).
  - Inclui a emenda proposta (T11-BR-TEL) e rascunhos de teste de balanceamento, de texto de transparência e de registro simplificado.
- **Lacuna encontrada no código:** a ligação de nível 0 não é suspensa por supressão de telefone. `restrictionsFor` só recebe o hash de e-mail, e essas tarefas não têm contato vinculado.
  - O item 6 de `T11-VALIDACAO-PILOTO-BR.md` foi corrigido por nota, preservando o texto original.
  - A correção do código está proposta e ainda não foi implementada.
- **Estado:** as 13 ligações seguem abertas, com a linha da T11 no roteiro. Nenhum contato. Canais `planned`. Nenhum teste rodado: só documentação mudou.

## Supressão por telefone nas ligações manuais (06/10/2026, implementada; não publicada)

- **Falha reproduzida antes da correção** (`tests/phone-suppression.test.mjs`): 5 de 6 casos falhavam. A tarefa seguia `open` depois da oposição por telefone, o telefone não era validado, a edição ignorava o número e não havia auditoria de suspensão. O caso 6 (e-mail) já passava e ficou como proteção contra regressão.
- **Correção:**
  - **Migração 0034:**
    - `tasks.phone_hash`, com o mesmo HMAC e a mesma normalização da supressão;
    - `tasks.phone_enc`, o número normalizado cifrado;
    - índice parcial;
    - `task_revisions` recriada para aceitar o campo `phone`, com as mesmas linhas, o mesmo índice e o mesmo gatilho que impede alteração.
  - **`restrictionsFor`:** passa a consultar também a supressão do canal `phone` (motivo `suppressed_phone`), na listagem e na conclusão.
  - **`POST /api/suppression` com canal `phone`:** suspende as ligações abertas com o número (`suspended_reason` = "telefone suprimido"), com auditoria `task.suspended` sem o número. Repetir a supressão não muda nada; concluídas ficam intactas.
  - **Criação e edição de ligação:**
    - aceitam `phone` (E.164; sem `+55` é recusado);
    - número já suprimido cria ou deixa a tarefa suspensa;
    - o histórico guarda o número cifrado.
  - **Remoção administrativa da supressão:** não reativa tarefa.
  - **Exclusão de dados pessoais:** apaga `phone_hash` e `phone_enc` das tarefas afetadas.
  - **Tela Abordagem → Tarefas:**
    - mostra o telefone da ligação e um campo para editá-lo;
    - mostra o motivo legível do bloqueio;
    - mostra a seção "Suspensas — não voltam sozinhas", com o motivo, sem edição nem conclusão. Isso usa `GET /api/tasks?status=suspended`.
- **Verificações:**
  - `npm run check` passou: 394 testes da suíte principal, 2 do Worker e 16 da ponte, além de sintaxe, skill e site.
  - `validate-deploy` passou.
  - Migração 0034 aplicada no D1 local (Wrangler): tabela, índice e gatilho conferidos.
  - Conferência no servidor local com dados fictícios: a supressão suspendeu 1 tarefa e o outro número ficou aberto; captura da tela conferida.
  - `npm run test:ui` não rodou: o Playwright é dependência opcional e não está instalado.
- **Alcance:** número exato normalizado, em todas as ligações (R21.2). Nenhuma inferência por nome (R21.3).
- **Limites conhecidos:**
  - ligações de ficha (`call_l1`) só são cruzadas com telefone se ele for informado na tarefa; o telefone do contato não é lido;
  - as 13 ligações em produção ainda não têm telefone estruturado.
- **Não publicado.** T11 não alterada; nenhuma ligação liberada, campanha ativada ou contato feito. Canais `planned`.

### Complemento (06/10/2026): número de toda ligação, ligações de ficha, oposição e preparação das 13 tarefas (não publicado)

- **Toda ligação identifica o número:**
  - Ligações de ficha pegam o telefone do destinatário (contato e pessoa de compras vinculada), com a fonte.
  - Sem número, número sem código do país ou números divergentes viram pendência (`phone_missing`, `phone_unrecognized`, `phone_ambiguous`). A ligação não aparece como pronta e não conclui.
  - Nada é escolhido automaticamente: o número de uma ligação de ficha é definido na tarefa, com fonte, e o roteiro continua congelado.
  - Ligações antigas sem telefone ficam pendentes até a definição.
- **Backend:** listagem e conclusão conferem a supressão do número da tarefa.
- **Oposição:** o resultado "opposed" grava a nota da conversa e a supressão do número na mesma operação, inclusive com a ligação já suspensa, e suspende as outras ligações ao número. Uma nova ligação ao número já nasce suspensa.
- **Migração 0034:** ainda não publicada; ganhou `phone_source` e `phone_issue`, e o histórico aceita `phone_source`.
- **Testes:**
  - `tests/phone-call-tasks.test.mjs`, com 9 casos: ficha com número e fonte, sem número, divergência, mesmo número em formatos diferentes, formato sem código do país, número já suprimido, tarefa antiga sem telefone e três cenários de oposição.
  - O cenário de teste (`pilot`) agora dá telefone ao contato.
  - `npm run check`: 403 testes da suíte principal, 2 do Worker e 16 da ponte.
  - `validate-deploy` passou.
  - `npm run test:ui` passou, com Playwright 1.63.0 instalado fora do projeto e o Chrome do sistema.
- **Compatibilidade:** a suíte do commit publicado (`9576cb9`, Worker 9866c2c3) passou com a 0034 aplicada: 388 testes da suíte principal e 2 do Worker.
- **13 tarefas:**
  - plano em `descoberta-milho-indiara/telefones-ligacoes-l0.json`, script `scripts/atualizar-telefones-ligacoes.mjs`;
  - simulação contra a produção (só leitura): 7 a definir, 6 pendentes (Cimilho, Rural Forte, Super-Bovi, Sociagro, Ração Ituiutaba e BRF), 0 problemas;
  - caminho de aplicação testado no ambiente local.
- **Incidente local, corrigido:** ao remover a cópia temporária usada no teste de compatibilidade, `git worktree remove --force` seguiu o atalho para `node_modules` e apagou parte das dependências locais.
  - Restaurado com `npm ci`, nas versões exatas do `package-lock.json`, sem atualização.
  - `npm ls` passou e a verificação completa passou depois disso.
  - Repositório e produção não foram afetados.
- **Plano de publicação e reversão:** `PUBLICACAO-SUPRESSAO-TELEFONE.md`. Nada publicado; T11, canais (`planned`) e campanhas sem alteração; nenhum contato.

## Publicação da supressão por telefone e telefones das ligações (06/10/2026, autorizada por Rogério)

**Antes:**
- branch `v2-revisao-2` limpo e sincronizado com o remoto em `1ca78a2`;
- `npm run test:ui` passou no commit final (Playwright 1.63.0 externo, Chrome do sistema);
- `npm run check` passou dentro do deploy: 403 testes da suíte principal, 2 do Worker e 16 da ponte.

**Ponto de restauração:**
- Worker anterior **9866c2c3-0f48-427c-bcbf-7366daa30597** (100%);
- bookmark do Time Travel do D1 antes da migração: `00000725-00000100-000050fc-0ed904436e09b38b29a4fafb64a1f45a`;
- backup privado: `C:\Users\Roger\eag-compass-backups\d1-remoto-antes-0034-20261006\eag_compass.sql`, 29.733.437 bytes, SHA-256 `b87b18b95ccf427095c1b62fc02bb02007de9bc8a0abf62d480bc90aec0b81d5`, acesso só de `ROGERIONOTE\Roger`.

**Estado anterior:**
- 15 tarefas, 13 ligações de nível 0 abertas;
- 21 linhas em `task_revisions`;
- 2 supressões, ambas de e-mail;
- canais `planned`;
- campanhas: 1 rascunho e 1 encerrada;
- outbox: 5 aceitos e 19 cancelados.

**Migração:**
- antes de aplicar, só a 0034 estava pendente;
- aplicada com `npm run db:migrate:remote`.
- Esquema conferido:
  - `tasks.phone_hash`, `phone_enc`, `phone_source`, `phone_issue`;
  - `idx_tasks_phone`;
  - `task_revisions` com as mesmas 21 linhas, aceitando `phone_source`, com índice e gatilho `task_revisions_no_update`.
- Depois: "No migrations to apply".

**Publicação:**
- `npm run deploy` (check, validate-deploy e deploy);
- Worker **62182b6e-b9f6-4086-bb85-5db0deb58f1f**, 100% do tráfego, publicado em 2026-10-06T22:14:48Z.
- Logo depois: as 13 ligações abertas, com ids únicos e a linha da T11, todas bloqueadas por "sem telefone definido"; nenhuma suspensa.

**Telefones** (`scripts/atualizar-telefones-ligacoes.mjs`, plano `telefones-ligacoes-l0.json`):
- simulação: 7 a definir, 6 pendentes, 0 problemas, sem aviso de Worker antigo;
- aplicação: 7 respostas 200, nenhuma suspensa;
- simulação repetida: 7 "já definido", 6 pendentes.

| Ligação | Revisão | Histórico | Telefone | Situação |
|---|---|---|---|---|
| Cargill Uberlândia (e6747f59) | 1→2 | 0→2 | +55 34 3218-4900 | definido |
| São Martinho Boa Vista (f3e7e383) | 2→3 | 3→5 | +55 64 3615-9700 | definido |
| Cargill Bioenergia (879acd70) | 1→2 | 0→2 | +55 64 3615-9500 | definido |
| Nutrir (9f489696) | 2→3 | 2→4 | +55 62 3375-2464 | definido |
| Rações VR (fff3d487) | 2→3 | 2→4 | +55 64 3474-1528 | definido |
| Rei do Milho (247bad11) | 2→3 | 2→4 | +55 62 3514-1751 | definido |
| Caramuru (8b4bd935) | 2→3 | 2→4 | +55 64 3404-0200 | definido |
| Cimilho (55770872) | 1 | 0 | — | pendente: escolher entre dois números |
| Rural Forte (73eeb92f) | 2 | 2 | — | pendente: O5 (celular não usado) |
| Super-Bovi (eb02c35d) | 2 | 2 | — | pendente: O5 (celulares não usados) |
| Sociagro (d7f9f5b6) | 2 | 2 | — | pendente: escolher entre dois números |
| Ração Ituiutaba (3fc79395) | 2 | 2 | — | pendente: números divergentes |
| BRF Rio Verde (2ad6c4a7) | 2 | 2 | — | pendente: sem telefone apropriado |

**Conferido depois:**
- Nas 13 tarefas, roteiro (hash), canal, próxima ação, data, estado e id são iguais aos de antes. O histórico anterior foi preservado e foram acrescentadas só as linhas `phone` e `phone_source`; `task_revisions` passou de 21 para 35 linhas.
- As 6 pendentes seguem bloqueadas por "sem telefone definido".
- Auditoria: 7 `task.updated` só com os nomes dos campos, sem número; nenhuma `task.suspended`.
- Supressões: as mesmas 2, de e-mail. Nenhuma supressão real foi criada ou alterada.
- Canais `planned`; campanhas inativas; outbox sem mudança.
- Ponte: leitura bem-sucedida às 22:17:17 UTC, depois do deploy.
- Nenhum contato.

**T11:** as 7 ligações com telefone não têm bloqueio no sistema. A espera pela T11 continua indicada pela linha "ANTES DE LIGAR" no roteiro, como em todas as ligações desde o cadastro, e pelos canais `planned`. A T11 não foi alterada.

**Reversão:**
- Worker: `npx wrangler rollback 9866c2c3-0f48-427c-bcbf-7366daa30597`. É compatível com o banco migrado; o Worker antigo ignora telefone e suspensões nas ligações.
- Telefones: edição auditada por tarefa (`phone: null` com motivo).
- Banco, só em último recurso: `npx wrangler d1 time-travel restore eag_compass --bookmark=00000725-00000100-000050fc-0ed904436e09b38b29a4fafb64a1f45a` ou o backup acima. Ambos perdem as gravações posteriores, inclusive os 7 telefones.

## Bloqueio das ligações até a T11 (06/10/2026, implementado; não publicado)

- **Falha reproduzida:** `tests/t11-gate.test.mjs`, com 6 casos. Antes da correção, os 6 falhavam: uma ligação com telefone aparecia pronta (`blocked: []`) sem nenhuma validação T11.
- **Correção:**
  - **Migração 0035, `compliance_validations`:**
    - escopo específico (país + canal; sem "T11 inteira"), responsável, data e fundamento;
    - só inclusão; revogação é linha nova;
    - sem rota e sem botão para gravar; registro vazio.
  - **`taskBlocks`:** acrescenta `t11_pending` quando não há validação vigente do escopo exato da tarefa (ligação → `xx_manual_phone`, LinkedIn → `xx_manual_linkedin`, pelo país da empresa). O cálculo vale na listagem e na conclusão; o estado da tarefa não muda.
  - Correção de dados, oposição e exclusão seguem possíveis. Uma validação futura só retira o próprio motivo.
  - A aprovação do uso pessoal do Compass não conta como validação.
  - Tela: "T11 pendente".
- **Verificações:**
  - `npm run check`: 409 testes da suíte principal, 2 do Worker e 16 da ponte;
  - `validate-deploy` e `npm run test:ui` passaram;
  - a suíte do commit publicado (`1ca78a2`) passou com a 0035: 403 da suíte principal e 2 do Worker;
  - ambiente local com a 0035: "Para fazer (0)" e todas as ligações em "Bloqueadas" com "T11 pendente".
- **Teste de compatibilidade:** desta vez a cópia temporária ficou dentro do repositório (`.claude/worktrees`, ignorada pelo git), sem atalho para `node_modules`; `npm ls` íntegro depois da remoção.
- **Plano de publicação e reversão:** `PUBLICACAO-BLOQUEIO-T11.md`.
- **Estado:** T11 não validada; nada publicado; canais `planned`; campanhas inativas; supressões sem alteração; nenhum contato.

## Publicação do bloqueio T11 (06/10/2026, autorizada por Rogério) e lentidão da lista de tarefas

**Antes:**
- `v2-revisao-2` limpo e sincronizado em `672bf80`;
- `npm run test:ui` passou;
- retrato das 13 ligações guardado.

**Ponto de restauração:**
- Worker anterior **62182b6e-b9f6-4086-bb85-5db0deb58f1f** (100%);
- bookmark do D1: `00000726-0000003c-000050fc-100170c11fd36c9a5031c4fd166d62d5`;
- backup privado: `C:\Users\Roger\eag-compass-backups\d1-remoto-antes-0035-20261006\eag_compass.sql`, 29.757.486 bytes, SHA-256 `f64c12a27faf77afbb773f69eeb2d1d2848e59d934c3755b3a59ba505a353952`, acesso só de `ROGERIONOTE\Roger`.

**Estado anterior:**
- 35 linhas em `task_revisions`;
- 15 tarefas;
- 2 supressões;
- canais `planned`;
- campanhas: 1 rascunho e 1 encerrada;
- outbox: 5 aceitos e 19 cancelados;
- ponte com leitura bem-sucedida às 22:41 UTC.

**Migração:**
- só a 0035 estava pendente e foi aplicada;
- conferidos: tabela `compliance_validations`, índice e os dois gatilhos;
- **0 registros de validação**;
- depois: "No migrations to apply".

**Deploy:**
- A primeira tentativa de `npm run deploy` parou antes do upload: um servidor local deixado aberto por mim na rodada anterior travava `dist/` (EBUSY). Nada foi publicado nessa tentativa. Encerrei os processos e repeti.
- Publicado o Worker **65fe3503-b40e-4e3c-bdae-bc6cc0972799** (100%, 22:47 UTC). A verificação interna do deploy passou: 409 testes da suíte principal, 2 do Worker e 16 da ponte.

**Conferido em produção (só leitura e sondagens sem gravação):**
- 13 ligações abertas, ids únicos, nenhuma suspensa, nenhuma pronta: as 7 com telefone bloqueadas por `t11_pending`; as 6 sem telefone por `phone_missing` e `t11_pending`.
- Comparação com o retrato: ids, telefones, roteiros (hash), canal, próxima ação, data, estado, revisão e histórico iguais nas 13.
- **Edição durante o bloqueio:** PATCH com os mesmos valores retornou 422 `nothing_to_change`, ou seja, passou pela checagem e não havia nada a gravar.
- **Oposição durante o bloqueio:** POST "opposed" com nota acima do limite retornou 422 de validação da nota; o bloqueio não barra a oposição.
- **Conclusão comum:** retornou 409 `task_blocked` com `t11_pending`.
- Depois das sondagens: as 13 tarefas sem nenhuma revisão ou histórico novo.
- `task_revisions` com as mesmas 35 linhas; 2 supressões; 0 validações; canais `planned`; campanhas inativas; outbox sem mudança.
- Ponte com leitura bem-sucedida às **23:02:04 UTC**, depois do deploy.

**Problema encontrado na conferência do painel:**
- Em Abordagem → Tarefas, a tela mostrou "A solicitação demorou demais".
- `GET /api/tasks` levou ~21 s (duas medições: 21,7 s e 20,9 s); a tela desiste aos 20 s. A lista de suspensas levou 0,6 s.
- A tela Início também carrega essa lista e é afetada.
- Causa: cerca de 7 idas ao D1 em sequência por ligação (pausas, supressões, triagem, parâmetros, país, T11), em série para as 13. As 2 consultas da T11 levaram ao estouro um tempo que provavelmente já estava perto do limite.
- O bloqueio no servidor continua efetivo; nada foi liberado.
- **Não revertido**, porque a reversão retiraria o bloqueio T11.

**Correção preparada, não publicada:**
- A lista calcula os bloqueios das tarefas em paralelo.
- Em cada tarefa, as consultas independentes também rodam em paralelo (lote de restrições junto com a triagem; parâmetros junto com a empresa).
- As regras não mudaram.
- O simulador de D1 dos testes passou a executar cada lote sem ceder a vez dentro da transação, como no D1 real.
- **Teste novo** `tests/tasks-latency.test.mjs`, com 40 ms por ida ao banco e 13 ligações: o código publicado levou 4.408 ms (falha); a correção leva cerca de 349 ms, com a mesma ordem e os mesmos bloqueios. Estimativa em produção: perto de 1,7 s.
- `npm run check`: 410 testes da suíte principal, 2 do Worker e 16 da ponte. `validate-deploy` e `npm run test:ui` passaram.

**Reversão do bloqueio:** `npx wrangler rollback 62182b6e-b9f6-4086-bb85-5db0deb58f1f`. Com ela, as 7 ligações com telefone voltam a "Para fazer"; a 0035 só criou uma tabela vazia e pode ficar.

**Sem validação T11, sem alteração de supressões, sem contatos.**

## Publicação da correção de desempenho da lista de tarefas (06/10/2026, autorizada por Rogério)

**Antes:**
- `v2-revisao-2` em `1d4d5b8`, sem migração pendente e sem servidor local aberto;
- Worker anterior **65fe3503-b40e-4e3c-bdae-bc6cc0972799**;
- retrato das 13 ligações e contagens guardados.

**Primeira tentativa:**
- `npm run deploy` parou na verificação prévia: 1 teste falhou (409 aprovados). Nada foi publicado.
- Causa: o teste procurava o trecho "3615" em toda a auditoria, e UUIDs aleatórios podem conter esse trecho; falhou 1 vez em 5. É falha do teste, não do produto.
- Correção em `7ea6095`, só em testes (`phone-suppression`, `phone-call-tasks`, `tasks`): as asserções procuram o número completo (`3615-?9[0-9]{3}`, `3333-?4444`). Rodaram 8 vezes seguidas sem falha.
- `src/`, `public/`, `migrations/` e `wrangler.jsonc` idênticos a `1d4d5b8`.

**Publicação:**
- `npm run deploy` passou a verificação interna: 410 testes da suíte principal, 2 do Worker e 16 da ponte.
- Worker **1213cf87-67fa-4352-8fc2-e558b07e084c**, 100% do tráfego, 2026-10-06T23:14:45Z.

**Latência medida em produção** (`GET /api/tasks?until=<hoje>&limit=100`, 15 tarefas, 5 chamadas):
- 4.509, 3.857, 3.540, 3.016 e 2.295 ms; mediana **3,5 s**.
- Antes: 21,7 s e 20,9 s.
- Outras rotas: suspensas 0,8 s; `/api/dashboard` 0,7 s; `/api/fichas` 0,5 s; `/api/sending/today` 1,2 s.
- O limite de espera da interface (20 s) não foi alterado.
- O desempenho foi considerado suficiente, por ficar bem abaixo do limite; reaproveitar parâmetros e listas de sanções entre tarefas fica como melhoria futura, não necessária.

**Navegador em produção** (Chrome headless, sessão do Access, sem gravação):
- Início carregou em ~4,4 s, sem erro.
- Abordagem → Tarefas carregou em ~5,8 s, sem erro.
- **13 ligações em "Bloqueadas"**, as 13 com "T11 pendente" e 6 com "sem telefone definido".
- Formulários de oposição e de edição presentes nas 13.
- "Para fazer (2)" tem só duas tarefas "Responder" (`reply_followup`, 01/10/2026) dos testes internos da ponte ("TESTE INTERNO EAG A" e "G", não são prospects). **Nenhuma ligação ou LinkedIn sem bloqueio.**
- Nenhum erro de página.

**Sem mudança:**
- retrato das 13 ligações idêntico ao de antes (ids, telefones, fontes, roteiros, estado, revisão, histórico e bloqueios);
- tarefas 15; `task_revisions` 35; validações T11 0; supressões 2;
- campanhas: 1 rascunho e 1 encerrada; outbox: 5 aceitos e 19 cancelados; canais `planned`.
- **Ponte:** leitura bem-sucedida às 23:18:35 UTC, depois do deploy.

**Reversão:** `npx wrangler rollback 65fe3503-b40e-4e3c-bdae-bc6cc0972799` volta à versão lenta, que também tem o bloqueio T11. Não reverter para versão anterior a essa, porque ela não tem o bloqueio.

**Sem validação T11, sem liberação de contatos, sem reversão.**

## T11-BR-TEL: verificações pendentes (06–08/10/2026, sem aprovação registrada)

- **Tarefas de teste encerradas (06/10):** as 2 tarefas "Responder" de TESTE INTERNO EAG A e G foram concluídas pela rota auditada (`task.completed`), com a nota "teste interno encerrado; nenhuma ação comercial necessária". Mensagens (35), histórico (35) e supressões (2) intactos; nenhuma tarefa aberta desses testes.
- **Fontes conferidas:**
  - LGPD, arts. 18, 19, 33 e 48 (planalto.gov.br);
  - Res. CD/ANPD 2/2022 (arts. 2º, 3º, 14 e 15), 15/2024 (arts. 5º, 6º, 9º e 10) e 19/2024 (arts. 16 e 18–20);
  - Agenda Regulatória 2025–2026 (direitos dos titulares "em andamento");
  - Res. 32/2026 (UE adequada);
  - DPA da Cloudflare v6.4, de 03/04/2026, e a página "Brazil LGPD FAQs";
  - documentação do D1 (jurisdição `eu` só na criação).
  - Resultado em `T11-REVISAO-PILOTO-BR-TELEFONE.md`: L4, L6, L9 e §§6–8.
- **L9:** o DPA não tem cláusulas-padrão da ANPD; nenhum mecanismo do art. 33 foi identificado para os dados no D1 em ENAM. Decisão D-L9 pendente.
- **Teste de exclusão (autorizado em 06/10):**
  - registros fictícios criados em produção: empresa `98a50482`, contatos `0c19f5d6` e `c27b4aca`, pessoa `af217a7e`;
  - **a exclusão não foi executada**: a sessão do Access tinha vencido, as chamadas receberam a página de login e o banco confirmou que nada foi apagado;
  - o script agora recusa resposta que não seja JSON da API;
  - falta o login para concluir.
- **Conferido em 08/10 pelo wrangler, só leitura:** 13 ligações abertas e bloqueadas; 0 validações T11; 2 supressões; canais `planned`; campanhas inativas; outbox sem mudança; ponte com leitura bem-sucedida às 18:27 UTC.

### Teste de exclusão concluído (08/10/2026)

- Novo login no Access, feito por Rogério no navegador. A exclusão rodou nos registros fictícios existentes (contatos `0c19f5d6` e `c27b4aca`, pessoa `af217a7e`), sem recriá-los.
- **Antes:** nenhuma exclusão anterior.
- **Depois:**
  - dados pessoais apagados;
  - supressões 2 → 3 (só o hash do e-mail fictício);
  - `erasure_ledger` com 2 linhas; registro no R2; 2 auditorias sem dados pessoais.
- **Resíduos e achados:** o texto "relevância" e o hash do nome da pessoa ficaram. Detalhes em `T11-REVISAO-PILOTO-BR-TELEFONE.md` §8; proposta D-EXC na §9.
- Dados reais, as 13 ligações, os canais e as campanhas não foram alterados.

### Correção da exclusão: relevância e hash do nome (08/10/2026; não publicada, sem migração em produção)

- **Falha reproduzida:** novo caso em `tests/exclusao-purga.test.mjs`. A "relevância" da pessoa excluída continuava com o texto sobre ela.
- **Correção em `src/erasure.js`:**
  - a exclusão grava a marca de conteúdo excluído em `relevance` e troca `name_hash` por `purged:<id>`, um valor sem relação com o nome que respeita o NOT NULL e a unicidade;
  - assim nenhum bloqueio por nome fica implícito (R21.3);
  - linha já excluída não é regravada, então um pedido repetido não muda nada;
  - linha restaurada de backup volta sem a marca e é excluída de novo na reaplicação (teste existente de restauração passou).
- **Migração 0036:** aplica o mesmo às linhas já excluídas pelo código anterior; é repetível e não alcança terceiros. **Não aplicada em produção.**
- **Testes:**
  - relevância e hash apagados, sem nenhuma linha com o hash antigo;
  - João (terceiro, mesma empresa) e uma homônima "Maria Souza" de outra empresa intactos, coluna a coluna;
  - aviso legal compartilhado mantém o João e o telefone geral;
  - exclusão repetida não altera a linha, os terceiros nem as supressões;
  - novo cadastro com o mesmo nome é aceito como registro novo;
  - migração 0036 corrige só a linha excluída e pode rodar de novo.
- **Efeito a considerar:** sem o hash do nome, a pesquisa automática pode reencontrar a mesma pessoa e sugeri-la de novo, a validar por Rogério. Impedir novo contato depende da supressão do e-mail (já existe) e da decisão D-EXC sobre o telefone.
- **Verificação:** `npm run check` com 412 testes da suíte principal, 2 do Worker e 16 da ponte. T11 pendente; 13 ligações bloqueadas; nada publicado.
