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
