# Operação e implantação

## Desenvolvimento

Use os comandos do README na ordem. Dados locais são descartáveis apenas quando explicitamente autorizados; não apagar `.wrangler` para corrigir erro. Faça cópia privada do banco e das chaves antes de migrações com dados reais. As duas empresas de teste mencionadas na entrega original não vieram no ZIP e não foram alteradas nesta revisão.

## Cloudflare

1. Confirmar conta, plano, permissões, nome e UUID do D1. O pacote usa `eag-compass-db`; alinhar uma vez antes de provisionar, sem criar recursos duplicados.
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
