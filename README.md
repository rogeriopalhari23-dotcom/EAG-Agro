# EAG Compass

Central interna de descoberta, qualificação e acompanhamento de importadores de commodities agrícolas.

## Estado atual

Versão `0.3.1`, construída sobre a Constituição v1.3 e a Especificação v1.3.

- Dashboard e pipeline responsivos.
- Cadastro de prospects, evidências, contatos protegidos, demanda e risco.
- Potential, Confidence, Risk, Risk Coverage e Completude separados.
- Gate de qualificação e quatro perfis fixos de acesso.
- Central de e-mails em modo rascunho, sem envio externo automático.
- Exportação do pipeline em CSV.
- Worker Cloudflare, D1, KV, R2 e Queue preparados.

## Executar localmente

Requisitos: Node.js 24 e npm.

```bash
npm ci
npm run db:migrate:local
npm run dev
```

O Wrangler exibirá o endereço local. Nenhuma chave deve ser colocada no código.

## Validar

```bash
npm run check
```

Esse comando verifica a sintaxe, executa os 14 testes de aceite, gera o artefato e valida os contratos essenciais da interface.

## Antes de publicar na Cloudflare

Crie os recursos na conta e substitua os identificadores provisórios em `wrangler.jsonc`:

```bash
npx wrangler d1 create eag-compass-db
npx wrangler kv namespace create CACHE
npx wrangler r2 bucket create eag-compass-files
npx wrangler queues create eag-compass-async
npx wrangler queues create eag-compass-async-dlq
```

Depois, configure a chave de criptografia de PII como secret da Cloudflare:

```bash
npx wrangler secret put PII_ENCRYPTION_KEY
```

O valor deve ser uma chave aleatória de 32 bytes codificada em Base64. Não registre esse valor em Git, mensagens ou arquivos versionados.

Por fim:

```bash
npm run db:migrate:remote
npm run deploy
```

## Segurança

- Tokens da Cloudflare ficam apenas nos secrets do GitHub/Cloudflare.
- Contatos são criptografados com AES-GCM.
- Logs de auditoria não devem armazenar PII em texto aberto.
- Nenhum e-mail é enviado automaticamente nesta versão.

Veja [PROGRESSO.md](./PROGRESSO.md) para o estado detalhado do produto.
