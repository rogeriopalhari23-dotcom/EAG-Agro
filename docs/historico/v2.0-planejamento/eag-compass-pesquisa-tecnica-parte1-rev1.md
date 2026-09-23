# EAG Compass v2.0 — Pesquisa Técnica (Fase 4)

**Parte 1 — auditoria da conta, camadas Cloudflare, autenticação e e-mail.** Data: 2026-09-22.
**Status:** em andamento; **nenhuma decisão de stack aprovada ainda**.
**Base normativa:** Spec v2.0 e Constituição v2.0 (aprovadas em 2026-09-22).
**Método:** `/planejar` Fase 4 com `cloudflare-atlas`. Toda afirmação sobre produto Cloudflare foi conferida na documentação ao vivo (MCP `cloudflare-docs`), com a URL citada. Fatos da conta vêm de `wrangler` 4.136.1 e da API da Cloudflare, em leitura apenas.
**Limite:** nada foi criado, alterado ou excluído na conta. Nenhum deploy, nenhum e-mail.

---

## 1. Auditoria da conta Cloudflare real

| Item | Encontrado | Situação |
| --- | --- | --- |
| Autenticação | `wrangler` OAuth, e-mail `rogeriopalhari23@gmail.com`, uma conta ("Rogeriopalhari23@gmail.com's Account") | ✅ Conta **pessoal**, não corporativa da EAG |
| Plano Workers (Free × Paid) | **Não foi possível ler**: o token não tem permissão de billing (erro 10000 em `/subscriptions`) | ⚠️ Verificar no painel: **Workers & Pages → Plans** |
| Zonas (domínios) | **Nenhuma** | ⚠️ `eagagro.com` **não está nesta conta** (ver §3) |
| Workers publicados | `eag-compass-production`, publicado em 2026-09-22 15:32, compatibility_date 2024-12-19, só variáveis de texto, **sem D1/R2/KV/Queues** | Worker do projeto TypeScript antigo. O projeto 0.3.1 (`eag-compass`) nunca foi publicado |
| Subdomínio `workers.dev` | `rogeriopalhari23.workers.dev` | ✅ |
| D1 | `eag_compass`, criado em 2026-09-22, **0 tabelas** | ⚠️ `wrangler.jsonc` espera `eag-compass-db` com `database_id` placeholder |
| R2 | **Não habilitado** (erro 10042: "Please enable R2 through the Cloudflare Dashboard") | ⚠️ Habilitar no painel; conferir se pede meio de pagamento |
| KV | Nenhum namespace | Config espera `CACHE` com id placeholder |
| Queues | `eag-sanctions-queue` e `eag-scores-queue` (0 produtores, 0 consumidores) | ⚠️ Config espera `eag-compass-async` + DLQ. As filas existentes são do projeto antigo |
| Cron | Configurado `17 2 * * *` | Sem recurso a criar |

**Configuração 0.3.1 × conta:** nenhum binding do `wrangler.jsonc` aponta para recurso existente. É a divergência C5 do status, agora confirmada.

## 2. Camadas — tabela de decisão (proposta)

Preços e limites conferidos ao vivo em 2026-09-22 (URLs no §6).

| Camada | Escolha Cloudflare | Saiu? Por quê | Alternativa | Plano exigido / status na conta |
| --- | --- | --- | --- | --- |
| Frontend | Workers Static Assets (`public/` → `dist/`) | — | — | Free ✅ (assets estáticos gratuitos e ilimitados) |
| API / backend | Workers (`src/worker.js`) | — | — | ⚠️ Free = **10 ms de CPU por requisição**; Paid = 30 s. Criptografia AES-GCM de contatos, gate e geração de fichas pedem margem → **Paid recomendado** |
| Banco | D1 | — | — | Free: 5 M leituras/dia, 100 mil escritas/dia, 500 MB por banco, com limites diários **aplicados** desde 2026-09-01. Paid: 10 GB por banco. Volume do piloto cabe no Free; Paid dá folga |
| Arquivos (evidências, fichas salvas) | R2 | — | — | ⚠️ **Não habilitado** na conta. Free tier 10 GB-mês |
| Cache / sessão | KV | — | — | Free: 1.000 escritas/dia (não usar para contador por requisição) |
| Filas (busca, envio, reconciliação) | Queues | — | — | Free: 10 mil operações/dia, retenção de 24 h. Paid: 1 M/mês, retenção até 14 dias |
| Agendamento (cadência, lembretes) | Cron Triggers | — | — | Free: 10 ms de CPU por execução ⚠️ |
| Autenticação e perfis | **Cloudflare Access** no Worker + `ctx.access.getIdentity()` | — | — | Free (limite de usuários **a validar** — ver §4) |
| **Envio de e-mail de prospecção** | ~~Email Service (Sending)~~ | **Sim — cobertura.** A FAQ oficial: "Email Service is intended only for transactional emails". Prospecção não é transacional | Caixa do próprio remetente (Hostinger SMTP 465 via `connect()` do Worker) **ou** provedor dedicado — ver §3 | Email Sending exigiria Paid **e** zona na mesma conta |
| Recebimento de respostas | Email Routing (subdomínio) **ou** IMAP da caixa Hostinger | Depende de §3 | — | Email Routing é gratuito, mas exige a zona `eagagro.com` na conta |
| Rastreamento de abertura (K5) | Endpoint do próprio Worker (pixel) | — | — | Condicionado a T1 e T11 (Spec R28.7) |
| Geocodificação / mapa / fontes de empresas | **Parte 2** | Geocodificação não existe na Cloudflare (fronteira) | A pesquisar | — |

**Custo mensal estimado (Cloudflare), a validar:** Workers Paid **US$ 5/mês** cobre Workers, D1, KV e Queues no volume do piloto com folga (10 M requisições, 25 B leituras D1 e 1 M operações de fila incluídas). R2 dentro do free tier para evidências. Access dentro do Free para os perfis internos. **Estimativa: US$ 5/mês.** Premissa: piloto de 5–10 envios e descoberta de centenas de empresas por mês.

## 3. E-mail — o ponto que muda a arquitetura

**Fatos**

1. O DNS do `eagagro.com` está na Cloudflare (nameservers `chloe` e `ed.ns.cloudflare.com`), mas em **outra conta**. Quem a administra não foi identificado.
2. A caixa `rogeriopalhari@eagagro.com` é da **Hostinger**: MX `mx1/mx2.hostinger.com`, SPF `include:_spf.mail.hostinger.com ~all`, DKIM `hostingermail-a` publicado. **DMARC `p=none`** (só monitoramento).
3. O Email Service da Cloudflare só serve para envio **transacional**; o envio exige Workers Paid e o domínio integrado na mesma conta ("You must be using Cloudflare DNS").
4. Workers podem abrir TCP de saída com `connect()`; **só a porta 25 é proibida**. SMTP autenticado na 465 é tecnicamente possível — **não testado** (T1).
5. Email Routing no domínio raiz trocaria o MX e **desligaria as caixas da Hostinger**. Fora de questão. Routing num **subdomínio** (ex.: `respostas.eagagro.com`) não mexe no domínio raiz, mas também exige a zona na conta.

**Consequência:** o envio de prospecção sai da Cloudflare pela exceção de **cobertura** (Constituição P19), registrada como exceção documentada. O Worker continua orquestrando (fila, verificação pré-envio, idempotência, supressão); só o transporte SMTP é externo.

**Opções de envio**

| Opção | Como | A favor | Contra / a verificar |
| --- | --- | --- | --- |
| **E1 — Caixa do próprio Rogério (Hostinger), via SMTP 465 do Worker** | Credencial SMTP em Secret; envio na janela e no ritmo da cadência | É o que a `/prospeccao-vendas` pressupõe (e-mails 1 a 1 da caixa do vendedor); remetente real `rogeriopalhari@eagagro.com` (decisão D6); SPF/DKIM já existem; volume baixo; a mensagem enviada fica na caixa dele | Limites de envio e termos da Hostinger para prospecção **não verificados**; resposta ao e-mail chega na caixa Hostinger (ver recebimento); senha da caixa vira segredo do Worker |
| E2 — Provedor dedicado de envio via API | Conta de envio separada, subdomínio próprio | Métricas e webhooks de entrega | Muitos provedores proíbem cold e-mail nos termos; custo; outro fornecedor; remetente vira subdomínio (muda D6). Exige pesquisa de 2–3 candidatos |

**Opções de recebimento (correlação de respostas)**

| Opção | Como | A favor | Contra |
| --- | --- | --- | --- |
| **R1 — `Reply-To` em subdomínio com Email Routing → Email Worker** | `Reply-To: r+<id-do-passo>@respostas.eagagro.com`; o Worker recebe, correlaciona, pausa e encaminha cópia para a caixa de Rogério | Nativo da Cloudflare, gratuito, correlação exata por endereço | Exige a zona `eagagro.com` na conta do Compass (ou o Compass na conta da zona); quem responder ao `From:` em vez do `Reply-To` cai só na Hostinger |
| R2 — Leitura IMAP da caixa Hostinger (TCP 993) por Cron | Worker lê a caixa e correlaciona por `In-Reply-To`/`References` | Pega toda resposta, inclusive ao `From:` | Implementar IMAP num Worker é trabalhoso; credencial de leitura da caixa inteira; mais superfície de privacidade |
| R1 + R2 | Routing como caminho principal e IMAP como rede de segurança | Cobertura máxima | Soma das duas complexidades |

**Recomendação:** **E1 + R1** no piloto, com leitura IMAP (R2) só se os testes de T1 mostrarem respostas escapando do `Reply-To`. Pré-condição comum: resolver onde mora a zona `eagagro.com` (G2).

## 4. Autenticação e perfis

- **Modelo de uso:** time interno pequeno, quatro perfis fixos, mono-tenant (Spec §7).
- **Escolha: Cloudflare Access** no `workers.dev` do Worker (ativação com um clique em *Settings → Domains & Routes*), com política por e-mail.
- **Identidade:** `ctx.access.getIdentity()` entrega e-mail, nome e grupos **sem validar JWT à mão**; `ctx.access` é `undefined` se o Access não autenticou. Teste local com o bloco `access.dev` no `wrangler.jsonc` (changelog 2026-08-14; `/workers/configuration/cloudflare-access/`).
- **Perfil (Administrador etc.):** continua na tabela `users` do D1. O Access diz quem é; o Compass diz o que pode (Spec R9.2).
- **Limite gratuito de usuários do Access:** a documentação técnica consultada não traz o número de assentos. A referência interna da metodologia (verificada em 2026-07) diz 50 por conta, e o passo seguinte é **US$ 7/usuário/mês cobrado de todos**. **A validar** na página de planos Zero Trust. Premissa: menos de 10 usuários; gatilho de revisão aos 40.

**Achado de segurança no código 0.3.1 (vai para a Fase 6/7):** `src/worker.js:61-62` identifica o usuário pelos cabeçalhos `oai-authenticated-user-*` (herança da hospedagem OpenAI) ou `cf-access-authenticated-user-email`, **sem validar a assinatura**. Publicado sem Access, qualquer pessoa forjaria o cabeçalho, e o primeiro acesso vira Administrador (bootstrap nas linhas 69-76). Correção prevista: remover os cabeçalhos `oai-*` e usar só `ctx.access`. A retirada de `.openai/hosting.json` e dos passos correspondentes em `scripts/build-site.mjs` e `scripts/validate-site.mjs` resolve a pendência C5 (a hospedagem é Cloudflare).

## 5. Decisões que dependem de Rogério (gate da parte 1)

| ID | Decisão | Recomendação | Por quê |
| --- | --- | --- | --- |
| **G1** | Plano Workers | **Workers Paid, US$ 5/mês** (verificar se a conta já está nele) | 10 ms de CPU no Free é apertado para criptografia e regras; filas com retenção de 24 h no Free |
| **G2** | Onde fica o Compass × zona `eagagro.com` | Descobrir quem administra a conta Cloudflare do `eagagro.com`. Depois: (a) Rogério vira membro dessa conta e o Compass é publicado lá, **ou** (b) a zona é movida para a conta de Rogério | Recebimento R1 e um domínio próprio para o app dependem disso. **Mover a zona mexe no DNS do site e do e-mail da EAG** — só com o responsável |
| **G3** | Envio de prospecção | **E1** (caixa Hostinger via SMTP 465), registrada como exceção de cobertura na Constituição | Cloudflare não cobre cold e-mail; E1 é o que a skill pressupõe |
| **G4** | Recebimento de respostas | **R1** (Reply-To em subdomínio + Email Routing); R2 só se o teste mostrar perdas | Nativo, gratuito, correlação exata |
| **G5** | Autenticação | **Cloudflare Access + `ctx.access`**; remover cabeçalhos `oai-*` | Zero código de login; fecha a falha de cabeçalho forjável |
| **G6** | Recursos antigos na conta | Não excluir nada agora. No plano: reaproveitar o D1 `eag_compass` (vazio) e decidir o destino do Worker `eag-compass-production` e das filas antigas | Exclusão é irreversível e exige sua confirmação |
| **G7** | DMARC `p=none` | Manter até os testes de T1; depois avaliar `quarantine` com quem administra o DNS | Mudar DMARC afeta todos os e-mails da EAG |

## 6. Fontes consultadas (2026-09-22)

- Email Service — preços e disponibilidade: `developers.cloudflare.com/email-service/platform/pricing/`; visão geral: `/email-service/`
- Email Service — só transacional: `/email-service/reference/faq/`
- Email Service — domínio precisa estar na conta com Cloudflare DNS: `/email-service/get-started/send-emails/`, `/email-service/configuration/domains/`
- Email Routing em subdomínio: `/email-service/configuration/subdomains/`
- Workers — CPU Free 10 ms × Paid 30 s: `/workers/platform/limits/`
- TCP `connect()`, porta 25 proibida: `/workers/runtime-apis/tcp-sockets/`
- Queues no Free (10 mil operações/dia): `/changelog/post/2026-02-04-queues-free-plan/`, `/workers/platform/pricing/`
- Access no Worker e `ctx.access`: `/changelog/post/2026-08-14-workers-access/`, `/workers/configuration/cloudflare-access/`
- Limites de conta do Cloudflare One: `/cloudflare-one/account-limits/` (não traz número de assentos)
- D1, KV e R2 (limites e free tier): referências da `cloudflare-atlas` (`d1.md`, `kv.md`, `r2.md`); D1 com limite diário aplicado desde 2026-09-01
- DNS público de `eagagro.com` (NS, MX, SPF, DMARC, DKIM): consulta via 8.8.8.8

## 7. Parte 2 (próxima)

1. **T4/T8 — fontes da lista pelo uso final:** dados abertos da Receita (CNAE, endereço), Casa dos Dados (citada pela skill), CNPJá; como filtrar por setor usuário + UF sem processar a base inteira num Worker.
2. **T5 — geocodificação e mapa:** geocodificação é externa (fronteira da Cloudflare); mapa com tiles servidos do R2 (nativo) ou de fornecedor. Proposta dos **limites de raio** com justificativa técnica (B3).
3. **T1 — envio e recebimento:** limites e termos da Hostinger para envio pela caixa; validação de e-mail (skill I6); descadastro em um clique aplicado ao envio via SMTP.
4. Cobertura de skills da stack.
5. Scaffold: conferir `cloudflare/templates` só depois da stack aprovada.
