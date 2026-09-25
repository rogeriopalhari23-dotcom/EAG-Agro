# Operação e implantação

## Desenvolvimento

Use os comandos do README na ordem. Dados locais são descartáveis apenas quando explicitamente autorizados; não apagar `.wrangler` para corrigir erro. Faça cópia privada do banco e das chaves antes de migrações com dados reais. As duas empresas de teste mencionadas na entrega original não vieram no ZIP e não foram alteradas nesta revisão.

## Cloudflare

1. Conta alinhada em 2026-09-24 (decisão de Rogério): produção publica sobre o Worker existente `eag-compass-production` e usa o D1 existente `eag_compass` (`d6a5873b-f768-4516-96b8-1f865db8aaa4`, 0 tabelas na conferência de 2026-09-22). O ambiente local continua `eag-compass-local` / `eag-compass-db` (o estado local fica preso a esse identificador). Antes do primeiro `db:migrate:remote`, conferir que o banco segue vazio: `npx wrangler d1 execute eag_compass --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`.
2. Definir domínio e aplicação Access que protejam o domínio inteiro. Usar issuer `https://<equipe>.cloudflareaccess.com` e audience exata. `workers_dev` e previews estão desativados. O JWT é verificado dentro do Worker; cabeçalho de e-mail não concede acesso.
3. Configurar `PII_ENCRYPTION_KEY` e `SUPPRESSION_HMAC_KEY` por `wrangler secret put`. Cada chave deve representar 32 bytes em Base64. Não mudar chave de banco já preenchido sem migração criptográfica.
4. Exportar backup do D1 e testar restauração em banco separado. Conferir `PRAGMA foreign_key_check`, contagens e documentos vinculados antes/depois das migrações.
5. Executar a validação estática de deploy, aplicar migrações com `npm run db:migrate:remote` e cadastrar o administrador real por SQL parametrizado/revisado. Nunca usar `system-admin` em produção.
6. Executar `npm run check` e publicar somente após revisar a configuração real. Confirmar 401 sem JWT, 403 com usuário não cadastrado, quatro perfis, ausência de assets internos e persistência criptografada.

Cadastro inicial, após substituir os marcadores por valores reais revisados em arquivo SQL privado:

```sql
INSERT INTO users(id,tenant_id,email,display_name,role,status)
VALUES ('<uuid-novo>','eag-internal','<email-minusculo>','<nome>','admin','active');
```

O usuário precisa estar autorizado também na política do Access. Não habilitar bootstrap automático. Auditar o provisionamento no registro de implantação; retirar o arquivo SQL privado depois de guardá-lo no local operacional apropriado.

## Comportamento de segurança

Ausência de Access/configuração/usuário/chave necessária produz erro explícito. Sanções sem política aprovada, listas atuais ou triagem completa impedem qualificação. `POST /api/companies/:id/qualify` recebe `demandId` e recalcula o gate; scores antigos não autorizam transição. Supressão não tem rota de remoção. Pausas estão registradas; o executor futuro precisa consultá-las antes de qualquer contato.

## Custo

Não há LLM no runtime desta versão. Não há envio de prompts nem consumo de tokens por clique, cadastro, score ou gate. Nenhuma cobrança real foi consultada. A arquitetura atual usa assets estáticos, Worker e D1; consumidores, cron, KV e R2 só devem voltar quando existir módulo funcional que os use. Meça invocações, CPU, linhas lidas/escritas e armazenamento antes de projetar custo mensal. O orçamento antigo de US$ 5 não é medição nem preço total garantido.

Registros de score idênticos são reaproveitados após recalcular dados e gate. Chaves criptográficas e JWKS usam cache; permissões continuam consultadas no banco. Paginação e lotes reduzem consultas; índices apoiam demandas e histórico. O navegador não repete mutações automaticamente ao receber timeout.

## Rollback

Backup de dados e chaves é obrigatório antes da migração real. Não executar down destrutivo. Código antigo 0.3.1 não é compatível com todo o novo schema. Em incidente, suspender mutações, restaurar o banco e o código da mesma versão em ambiente separado, validar e então reabrir. Nenhum rollback ou teste remoto foi executado nesta revisão.

## Piloto nacional — passos humanos antes de liberar (P2-T12, P2-T17)

- **Descadastro público `/u/*`:** criar no Zero Trust uma aplicação self-hosted só para `<domínio>/u/*` com política **Bypass Everyone**. Não ampliar o bypass para `/api/*` nem para arquivos. Testar sem login: `GET` mostra a confirmação e `POST` suprime.
- **Segredos do piloto:** `UNSUB_TOKEN_KEY` (32 bytes em base64; nunca trocar sem estratégia para os links já enviados), `CASADOSDADOS_API_KEY`, `LOCATIONIQ_KEY`, `SNOV_CLIENT_ID`, `SNOV_CLIENT_SECRET`, credenciais da caixa Hostinger. Variáveis não secretas: `PUBLIC_BASE_URL` (https, sem barra final), `EAG_POSTAL_ADDRESS`, `SENDER_NAME`, `LOCATIONIQ_HOST`, `LOCATIONIQ_PLAN`.
- **Adaptadores (fila e cron):** o código usa a fila `ASYNC_QUEUE` para buscas, geocodificação e validação de e-mail, mas `scripts/validate-deploy.mjs` recusa publicar com `queues` ou `triggers` enquanto os adaptadores não forem liberados. A liberação é um portão humano: criar a fila e a DLQ, adicionar os bindings e ajustar o portão no mesmo commit, com a autorização registrada.
- **Parâmetros sem valor padrão que o piloto exige:** `send_timezone:national`, `send_window:national`, `email_validation_max_age_days:email`, e a lista setor → CNAE em `/api/sectors`.

## Migração do OpenClaw (P2-T15)

Formato aceito (o arquivo exportado do OpenClaw precisa ser convertido para ele; o mapeamento depende de um arquivo de exemplo real):
1. `POST /api/openclaw/imports` com o SHA-256 do arquivo exportado.
2. `POST /api/openclaw/imports/:id/suppressions` com `{"emails": [...]}` — todos os descadastrados, em lotes de até 200. Depois `POST .../close-suppressions`.
3. `POST /api/openclaw/imports/:id/contacts` com `{"rows": [{"line","company","cnpj","contactName","email","status":"ativo|pausado|respondeu","lastSent","campaign"}]}`.
4. `GET /api/openclaw/imports/:id` mostra contagens e conflitos. Para cada empresa `ativo`, desligar no OpenClaw e registrar `POST /api/openclaw/transfers` com a evidência; só então a empresa volta a ter ficha e envio.

## Internacional — lista mensal e liberação (Plano 3)

Passos humanos, nesta ordem; nada disso foi criado automaticamente:

1. **Parâmetros** (Parâmetros, escopo `international`): `agri_classification` (D2, proposta `{"version":"sh-01-24@2026-09-23","chapters":["01",…,"24" sem "03"],"excluded":["03"]}`), `period_default_months` (D1, proposta 12), `trade_list_mdic_years` (2), `trade_list_comtrade_years` (3), `comtrade_calls_per_day` (400), `trade_list_retention_versions` (3), `country_list_refresh_day` (10), `send_window` internacional. Sem eles a rotina não começa.
2. **R2**: criar o bucket e o binding `FILES` no `wrangler.jsonc` (a lista mensal guarda um JSON por país e fonte). Fila e cron seguem o portão do `validate-deploy`.
3. **Comtrade**: `COMTRADE_KEY` como secret (conta de Rogério). Sem chave, a rotina completa só o MDIC e marca a Comtrade como indisponível ("Chave da Comtrade não configurada."); depois de gravar a chave, "Retomar Comtrade" na tela Lista mensal.
4. **Primeira rotina**: tela Lista mensal → "Rodar a rotina do mês agora" (com motivo). A partir daí o cron diário (`17 2 * * *`) começa a versão do mês no dia configurado e retoma o que estiver pendente; a Comtrade respeita o teto diário (o que não cabe espera o dia seguinte).
5. **Tradução**: Rogério aprova `docs/implementation/AMOSTRAS-TEXTOS-EN.md`; o admin grava `templates_en_approved` no escopo `pv-en-1.0.0`. Antes disso, ficha em inglês não é aprovada (PV12).
6. **Liberação**: roteiro em `docs/eag-compass-t6-comexstat.md` seção 9; só com todos os passos registrados o admin grava `international_enabled`. Revogar (`{"enabled":false}`) segura na hora os envios internacionais já aprovados.
7. **Atualização manual de um país**: tela Lista mensal, 1 por dia por país, com motivo; reaproveita o MDIC do mês quando o arquivo não mudou.

## MDIC mensal pelo GitHub (decisão de 2026-09-25, opção "a")

O Worker não lê o MDIC (`MDIC_SOURCE=github` no `wrangler.jsonc`): o servidor `balanca.economia.gov.br` não envia o certificado intermediário e o `fetch` do Worker responde 526 (evidência em `docs/implementation/EVIDENCIAS.md`, 2026-09-25). O workflow `.github/workflows/mdic-mensal.yml` roda `scripts/mdic-job.mjs` nos dias 10, 11 e 12 às 12:00 UTC; o Worker continua cuidando da Comtrade.

- **Confiança TLS:** raízes públicas do Node + intermediário `certs/sectigo-public-server-authentication-ca-ov-r36.pem`, conferido a cada execução (impressão SHA-256 fixada, validade, assinatura pela raiz Sectigo R46 da loja do Node). Verificação nunca é desligada. Se o intermediário vencer (21/03/2036) ou o MDIC trocar de emissora, o job para antes de baixar qualquer coisa; atualizar o PEM **só** a partir do endereço AIA do certificado do servidor e conferir a assinatura por uma raiz pública.
- **Credencial (criada por Rogério, nunca colada na conversa):** token de API da Cloudflare (dash.cloudflare.com → My Profile → API Tokens → Create Custom Token) com **só** duas permissões de conta — *Account → D1 → Edit* e *Account → Workers R2 Storage → Edit* — restrito à conta `5d16c8ef26d280c96898835b4a71b7ea` (Account Resources → Include → essa conta), com validade definida. Cadastrar no GitHub em **Settings → Secrets and variables → Actions → New repository secret**: `CLOUDFLARE_API_TOKEN` (o token) e `CLOUDFLARE_ACCOUNT_ID` (`5d16c8ef26d280c96898835b4a71b7ea`). O workflow tem `permissions: contents: read` e não publica o Worker.
- **Ordem de publicação:** lê os anos inteiros → grava um JSON por país no R2 sob `trade-src/<versão>/mdic/` → confere amostra pelo hash → um único SQL no D1: versão `running`, estados, ponteiros (só avançam) e por último `complete` + auditoria.
- **Retomar após falha:** GitHub → Actions → **MDIC mensal** → *Run workflow* com os mesmos parâmetros (mês vazio = mês atual; `force` só para refazer um mês já completo). Falha antes do SQL: nada visível mudou; os objetos já gravados ficam no R2 sem ponteiro (inofensivos — a rotina mensal reexecutada grava por cima nas mesmas chaves; uma execução de país único usa prefixo novo e o anterior pode ser apagado à mão). Falha no meio do SQL: cada ponteiro já trocado aponta para um objeto inteiro conferido por hash; a versão fica `running` e a reexecução completa (SQL idempotente). O mês só é dado como feito quando a versão está `complete`.
- **Um país só:** *Run workflow* com `iso3` (ex.: `DEU`) cria a versão `AAAA-MM-mdic-DEU-<execução>`. Localmente, com `wrangler login`: `node scripts/mdic-job.mjs --iso3 DEU` (`--dry-run --out pasta` gera os arquivos sem publicar).
- A "Atualização manual" da tela Lista mensal passa a atualizar só a Comtrade; o MDIC de um país vem do workflow acima.

## Listas de sanções (P2-T16)

Depois da política T11 aprovada, o admin importa cada lista ativa (uma versão por arquivo oficial; lista parcial vira `failed`):

```
CF_ACCESS_TOKEN=$(cloudflared access token -app=https://<compass>) node scripts/import-sanctions.mjs --list ofac --base https://<compass>
CF_ACCESS_TOKEN=... node scripts/import-sanctions.mjs --list ceis --base https://<compass> --date AAAAMMDD
CF_ACCESS_TOKEN=... node scripts/import-sanctions.mjs --list cnep --base https://<compass> --date AAAAMMDD
```

No Windows, se o Node recusar certificado de algum portal, rode com `node --use-system-ca`. Depois de importar, refaça a triagem das empresas (lista nova torna a anterior desatualizada).

## Publicação em `eag-compass-production.rogeriopalhari23.workers.dev` (decisões de 2026-09-24)

Endereço workers.dev atrás do Access; fila nova com DLQ. Ordem (cada passo com autorização de Rogério; nada disso foi criado ainda):

1. **Zero Trust / Access:** habilitar no painel (plano gratuito até 50 usuários). Criar a aplicação self-hosted para `eag-compass-production.rogeriopalhari23.workers.dev` com política *Allow* só para os e-mails dos quatro perfis; criar uma segunda aplicação no mesmo hostname, caminho `/u`, com política *Bypass — Everyone* (só o descadastro público). Copiar o *team domain* (`https://<time>.cloudflareaccess.com`) e o *Application Audience (AUD)* para `ACCESS_TEAM_DOMAIN` e `ACCESS_AUD` no `wrangler.jsonc`.
2. **Banco:** conferir que `eag_compass` segue vazio (`npx wrangler d1 execute eag_compass --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`), depois `npm run db:migrate:remote` (roda o `validate-deploy` antes). Criar o usuário admin de Rogério.
3. **Publicar:** `node scripts/build-site.mjs && node scripts/validate-deploy.mjs && npx wrangler deploy`. Conferir `/api/health`, login pelo Access e `/u/<token-inválido>` sem login.
4. **Liberação do envio (após T1):** criar as filas e acrescentar ao `wrangler.jsonc` — só então o `validate-deploy` é ajustado para aceitar estes blocos:

```jsonc
"queues": {
  "producers": [{ "binding": "ASYNC_QUEUE", "queue": "eag-compass-async" }],
  "consumers": [{ "queue": "eag-compass-async", "max_batch_size": 10, "max_retries": 5, "dead_letter_queue": "eag-compass-dlq" }]
},
"triggers": { "crons": ["*/5 * * * *", "17 2 * * *"] }
```

   `npx wrangler queues create eag-compass-async` e `npx wrangler queues create eag-compass-dlq`. As filas da 0.3.1 (`eag-sanctions-queue`, `eag-scores-queue`) ficam intocadas até Rogério decidir apagá-las.
5. **Lista mensal (após T12):** habilitar R2 no painel, `npx wrangler r2 bucket create eag-compass-files` e acrescentar `"r2_buckets": [{ "binding": "FILES", "bucket_name": "eag-compass-files" }]`.

## Estado em produção (2026-09-24, fim do dia)

- Publicado em `https://eag-compass-production.rogeriopalhari23.workers.dev` atrás do Access; fila `eag-compass-async` + DLQ `eag-compass-dlq` e crons ativos; canal de e-mail `planned` (nenhum envio possível).
- Sanções importadas (OFAC, CEIS, CNEP) em 2026-09-24 — **reimportar até 2026-10-24** (validade de 30 dias). Sessão: `cloudflared access login https://eag-compass-production.rogeriopalhari23.workers.dev` (código no e-mail), depois os comandos da seção "Listas de sanções" com `node --use-system-ca`.
- Domínio `eagcompass.com`: zona no Cloudflare aguardando a troca dos DNS no hPanel (Domínios → eagcompass.com → DNS/Nameservers → personalizados: `joyce.ns.cloudflare.com` e `yoxall.ns.cloudflare.com`). Depois da ativação: domínio personalizado no Worker, Access incluindo `eagcompass.com` e `eagcompass.com/u`, `PUBLIC_BASE_URL` = `https://eagcompass.com` e `workers_dev` desligado.
- DLQ: 2 mensagens de verificação de 2026-09-24 (tipo `verificacao-dlq`) ficam como registro; não reprocessar.

## Regra de horário (aprovada em 2026-09-25)

Envio só das 09:00 às 17:00, de segunda a sexta, **no fuso confirmado de cada contato** (nacional ou internacional). Contato sem fuso: a ficha pode ser gerada, mas não é aprovada e o envio fica em espera (`timezone_pending`). Confirme o fuso no cadastro do contato ou no botão "Confirmar fuso" da tela da empresa (ex.: `America/Sao_Paulo`, `America/Manaus`, `Europe/Berlin`).

## E-mail pela Hostinger — bloqueio da plataforma (2026-09-25)

O Worker **não consegue** abrir conexão com `smtp.hostinger.com`/`imap.hostinger.com`: esses servidores estão atrás da Cloudflare, e Workers bloqueiam sockets TCP para IPs da própria Cloudflare (documentação oficial). Opções para decisão de Rogério (nenhuma aplicada):

1. **Ponte na VPS da Hostinger (recomendada):** um serviço pequeno na VPS (fora da faixa da Cloudflare) recebe do Worker por HTTPS autenticado e fala SMTP/IMAP com a Hostinger. Mantém o remetente `rogeriopalhari@eagagro.com`, o risco do §12 já assumido e o custo atual. A senha da caixa fica na VPS, não no Worker. Depende de confirmar a identidade da VPS (OpenClaw) e de manter a VPS.
2. **Provedor de envio por API HTTP** (ex.: Amazon SES): exige verificar o domínio `eagagro.com` (DNS em outra conta Cloudflare), tem custo por volume e regras próprias para prospecção; respostas continuariam precisando de leitura da caixa.
3. **Mudar a hospedagem de e-mail** para um provedor fora da Cloudflare: mudança maior, afeta a caixa em uso.

Até a decisão: canal de e-mail segue `planned`; não grave `MAILBOX_PASSWORD` no Worker (não teria efeito).

## Domínio eagcompass.com — transição

Pré-configurado: domínio personalizado no Worker, `www` → apex (301). Falta só a troca dos nameservers no hPanel. Depois da ativação: incluir `eagcompass.com` e `eagcompass.com/u` nas aplicações do Access (mesmo AUD), testar login e descadastro, então `PUBLIC_BASE_URL=https://eagcompass.com` e `workers_dev: false`.

## Backup dos segredos de produção

1. Abrir `C:\Users\Roger\eag-compass-backups\segredos-producao-2026-09-24.txt` no Bloco de Notas e criar no gerenciador de senhas o item "EAG Compass — Worker eag-compass-production" com os campos `PII_ENCRYPTION_KEY` e `UNSUB_TOKEN_KEY` (copiar e colar; não digitar).
2. Conferir sem exibir: `powershell -ExecutionPolicy Bypass -File scripts\conferir-backup-segredos.ps1` (cole cada valor do gerenciador; deve dizer "confere" nas duas).
3. Só então: `Remove-Item -LiteralPath 'C:\Users\Roger\eag-compass-backups\segredos-producao-2026-09-24.txt'` (não vai para a Lixeira). Em SSD a sobrescrita não é garantida; com o BitLocker ativo o disco já é cifrado.
