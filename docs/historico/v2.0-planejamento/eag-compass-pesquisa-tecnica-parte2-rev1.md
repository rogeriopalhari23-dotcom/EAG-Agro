# EAG Compass v2.0 — Pesquisa Técnica (Fase 4)

**Parte 1** (conta, camadas, autenticação, e-mail) **e Parte 2** (fontes, geocodificação, mapa, envio, validação, raio). Data: 2026-09-22.
**Status:** em andamento. **Aprovadas por Rogério em 2026-09-22: G1, G4, G5.** **G3 reaberta** na parte 2 (§7.1: termos da Hostinger proíbem e-mail comercial não solicitado). Pendentes: G2, G3, G6–G11, B3.
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

## 5. Decisões da parte 1

**Registro:** G1 (Workers Paid), G4 (recebimento R1) e G5 (Access + `ctx.access`) **aprovadas em 2026-09-22**. G3 foi aprovada (envio E1) e **reaberta** no mesmo dia, depois da leitura dos termos da Hostinger (§7.1). G2, G6 e G7 continuam abertas.

| ID | Decisão | Recomendação | Por quê |
| --- | --- | --- | --- |
| **G1** | Plano Workers | **Workers Paid, US$ 5/mês** (verificar se a conta já está nele) | 10 ms de CPU no Free é apertado para criptografia e regras; filas com retenção de 24 h no Free |
| **G2** | Onde fica o Compass × zona `eagagro.com` | Descobrir quem administra a conta Cloudflare do `eagagro.com`. Depois: (a) Rogério vira membro dessa conta e o Compass é publicado lá, **ou** (b) a zona é movida para a conta de Rogério | Recebimento R1 e um domínio próprio para o app dependem disso. **Mover a zona mexe no DNS do site e do e-mail da EAG** — só com o responsável |
| **G3** | Envio de prospecção | ~~E1 (caixa Hostinger via SMTP 465)~~ — **reaberta em 7.1** | Cloudflare não cobre cold e-mail; os termos da Hostinger (§12) proíbem e-mail comercial não solicitado |
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

## 7. Parte 2 — fontes, geocodificação, mapa, envio e validação (2026-09-22)

**Método:** skill `search` (Exa, 4 frentes paralelas, 295 resultados examinados). Os fatos que sustentam decisão foram **conferidos por mim** diretamente na página oficial (Firecrawl), marcados ✔. Os demais vieram da pesquisa com URL oficial, mas sem reconferência (marcados ◐). Relatório completo: `~/pesquisas/pesquisa-eag-compass-fase4-parte2-2026-09-22.md`.

### 7.1 ⚠️ Envio pela caixa Hostinger — a G3 precisa ser revista

| Fato | Fonte | Conf. |
| --- | --- | --- |
| Termos de Serviço, §12 "NO SPAM POLICY": *"Spam includes unsolicited commercial or bulk messages sent via email […] without recipient's prior consent to receive such communications (regardless of the personal identity and context of the recipient being relevant for the message or not)."* Exige opt-in para "commercial advertising and (or) bulk communication", endereço físico do remetente e forma de descadastro. Pode suspender e **encerrar a conta** ligada ao spam, avaliando reclamações, padrão de envio e **conteúdo** das mensagens | `https://www.hostinger.com/legal/universal-terms-of-service-agreement` | ✔ |
| Página de suporte sobre envio em massa: proibido "Unsolicited emails (spam) – Sending emails to people who did not opt in"; orienta "Send emails only to users who opted in" | `https://www.hostinger.com/support/1583510-is-mass-mailing-supported-at-hostinger/` | ✔ |
| Limites por caixa: Business Starter 1.000 mensagens/dia (entrada + saída), Standard/Premium 3.000/dia; 100 destinatários por mensagem; limites por caixa, janela móvel de 24 h | `https://www.hostinger.com/support/4625828-parameters-and-limits-of-hostinger-email/` | ✔ |
| SMTP `smtp.hostinger.com` 465 (SSL) ou 587; IMAP `imap.hostinger.com` 993; serviço próprio da Hostinger (não Titan) | `https://docs.hostinger.com/emails/setup-devices` | ◐ |

**Leitura:** o volume do piloto cabe folgado no limite. O problema é contratual: o texto proíbe mensagem comercial não solicitada **mesmo que o destinatário seja relevante**, e prospecção B2B é exatamente isso. O risco não fica no Compass: uma suspensão atinge a caixa `rogeriopalhari@eagagro.com` e, conforme a conta, os demais e-mails da EAG na Hostinger.

**Opções (decisão de Rogério — ver §8):**

| Opção | Descrição | Risco / custo |
| --- | --- | --- |
| G3-a | Manter a Hostinger assumindo o risco (volume baixo, 1 a 1, com descadastro) | Viola o texto literal do §12; suspensão possível da caixa principal. **Não recomendo** |
| G3-b | Pedir **confirmação por escrito** à Hostinger de que prospecção B2B 1 a 1, com descadastro, é aceita | Barato; se negarem, cai para G3-c |
| **G3-c** | **Domínio secundário e caixa dedicada à prospecção**, num provedor cujos termos admitam contato B2B individual, isolando o domínio principal. Pesquisar 2–3 provedores (termos, SMTP/API, preço) | Muda o remetente decidido em D6 (`rogeriopalhari@eagagro.com`); exige avaliar a `/prospeccao-vendas` (roteiros assumem a empresa real) e a base legal em T11 |
| G3-d | Compass só prepara; Rogério envia manualmente do próprio cliente de e-mail | **Não resolve**: os termos tratam o conteúdo, não a automação. E perde idempotência, pausa e supressão automáticas |

**Recomendação:** **G3-b já, em paralelo com a pesquisa de G3-c.** Até decidir, a Etapa 1 não envia nenhum e-mail externo (a Spec já exige T1 comprovado, R26.3). **A exceção P19 registrada na Constituição continua válida quanto a sair da Cloudflare, mas o destino "Hostinger" fica suspenso.**

### 7.2 Fonte da lista pelo uso final (T4)

| Fonte | Fatos | Conf. |
| --- | --- | --- |
| **Receita — Dados Abertos do CNPJ** | Publicação mensal em `https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/`; CSV zipado, `;`, Latin-1, sem cabeçalho; ~6 GB zipado (~30 GB aberto) em 10 partes; Estabelecimentos traz CNAE principal e secundárias, endereço, CEP, UF, município (código RFB), situação, data de início, e-mail e telefone; Empresas traz porte, natureza jurídica e capital; **sem coordenadas** | ◐ (layout: `https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf`) |
| **Casa dos Dados — API v5** | `POST /v5/cnpj/pesquisa` com filtros de CNAE principal e secundária, UF, município, porte, situação, matriz/filial e data de abertura; até **1.000 por página** com paginação; chave no cabeçalho `api-key`. Planos com API a partir de **R$ 29,90/mês** (5.000 consultas); 200 consultas grátis por 7 dias; limite de requisições não publicado | ◐ (`https://docs.casadosdados.com.br/cnpjpesquisasolicitacao-6605251d0`, `https://portal.casadosdados.com.br/planos`) |
| Coordenadas na Casa dos Dados | O retorno tem `latitude`/`longitude` **dentro do bloco `ibge`**, junto de `codigo_municipio` e `codigo_uf`. Indica centroide do município, não do endereço | ✔ (esquema); precisão **a validar** com consulta real |

**Proposta:** **Casa dos Dados como fonte da Camada 1 no piloto.** Ela filtra no servidor por CNAE + município, o que evita processar 30 GB num Worker, tem custo baixo e é a ferramenta citada pela `/prospeccao-vendas` (passo 6 da lista). Os dados abertos da Receita ficam como adaptador futuro (Spec R13.7), se o volume justificar um pré-processamento fora do Worker. O mapeamento **setor usuário → códigos CNAE** por commodity (R28.2) é trabalho do plano, com revisão de Rogério.

### 7.3 Geocodificação (T5) — fronteira: a Cloudflare não tem geocodificação

| Opção | Coordenada | Guardar no próprio banco? | Custo | Conf. |
| --- | --- | --- | --- | --- |
| **LocationIQ** | Endereço/rua | **Sim, para sempre**, sendo cliente pagante; no Free, cache de só 48 h | Free 5.000/dia; pago a partir de US$ 45/mês (◐) | ✔ (armazenamento: `https://locationiq.com/pricing`) |
| Nominatim (OSMF) | Endereço | Dados ODbL | Grátis, 1 req/s, **uso em massa proibido** | ◐ |
| Google Geocoding | Endereço/telhado | **Só 30 dias** para lat/long | Pago por requisição | ◐ |
| BrasilAPI CEP v2 | Por CEP, via OSM, com lacunas | Não explícito | Grátis | ◐ |
| IBGE CNEFE 2022 | Endereço, do Censo | Arquivo para download, não API; licença **a validar** | Grátis | ◐ |
| CNPJá (`geocoding=true`) | Endereço do estabelecimento | Parcial | 50 créditos/mês grátis; pago | ◐ |

**Proposta:**
1. Na busca, usar o **centroide do município** para decidir quais municípios entram no raio. É exibido como "estimado" (R11.6), sem custo por empresa.
2. Geocodificar pelo endereço só os **candidatos que avançam para triagem ou ficha**, com LocationIQ pago (armazenamento permitido) e a precisão registrada (R11.5).
3. Nominatim e Google ficam de fora: bulk proibido e armazenamento limitado a 30 dias, respectivamente.
4. O CNEFE fica como alternativa gratuita a estudar (licença e esforço de casamento de endereços).

### 7.4 Mapa — nativo na Cloudflare

| Fato | Fonte | Conf. |
| --- | --- | --- |
| Protomaps documenta servir **PMTiles do R2 por um Worker**; o recorte de região sai de `pmtiles extract --bbox` | `https://docs.protomaps.com/deploy/cloudflare`, `https://docs.protomaps.com/pmtiles/cli` | ◐ |
| MapLibre GL JS (BSD-3) lê PMTiles via `addProtocol("pmtiles", …)`; versão atual 6.x | `https://docs.protomaps.com/pmtiles/maplibre` | ◐ |
| Dados do mapa: OpenStreetMap, **ODbL** (atribuição "© OpenStreetMap" obrigatória) | `https://github.com/protomaps/basemaps` | ◐ |
| Tiles do `tile.openstreetmap.org`: sem SLA, com restrições de uso — não usar em produto | `https://operations.osmfoundation.org/policies/tiles/` | ◐ |
| Círculo do raio: `turf.circle` (MIT) | `https://turfjs.org/docs/api/circle` | ◐ |

**Proposta:** recorte do Brasil em PMTiles no **R2** (tamanho a medir com `--dry-run`; o free tier é de 10 GB-mês) + MapLibre + turf. Zero fornecedor de mapa e zero custo por visualização.

### 7.5 Validação de e-mail (skill I6; Spec R19.2 item 11)

O Worker **não consegue** validar por SMTP (porta 25 proibida), então é preciso uma API.

| Serviço | Preço (página oficial, sem reconferência) | Observação |
| --- | --- | --- |
| **Snov.io** | 1 crédito por verificação; 50 créditos grátis/mês | **Ferramenta citada pela `/prospeccao-vendas`** para achar e validar e-mails |
| Reoon | ~US$ 11,90 / 10 mil; 600/mês grátis | Retorna explicitamente "catch-all" (comum em `.com.br`) |
| ZeroBounce | ~US$ 39 / 2 mil | — |
| NeverBounce | ~US$ 8 / 1 mil | — |

**Proposta:** **Snov.io**, para seguir a skill, que usa o mesmo serviço para achar e validar. Preços **a validar** antes de contratar. Regra de produto: endereço "catch-all" ou "unknown" **não conta como validado** (R19.2 item 11 exige validação).

### 7.6 Limites do raio (B3) — proposta com justificativa técnica

| Parâmetro | Proposta | Justificativa |
| --- | --- | --- |
| `param_radius_km_min` | **10 km** | Com a coordenada do candidato no centroide do município (§7.3), raios menores que a extensão típica de um município dão "dentro/fora" sem significado; abaixo de 10 km quase tudo seria "estimado" |
| `param_radius_km_max` | **300 km** | Custo e tempo da busca crescem com o número de municípios no raio: a Casa dos Dados pagina 1.000 empresas por consulta, e cada consulta consome franquia. 300 km já cobre a área logística usual de frete rodoviário de commodities a partir de uma origem (premissa a confirmar com Rogério). Acima disso, o Nacional vira busca por UF, não por proximidade |

Os números **não** vêm da Econodata (20–200 km) nem do Google (≤ 50 km). São propostas para aprovação (Spec R11.14) e podem ser recalibrados pelo custo real medido no piloto (R13.5).

### 7.7 Custo mensal estimado do piloto (a validar)

| Item | Estimativa |
| --- | --- |
| Cloudflare Workers Paid | US$ 5 |
| Casa dos Dados (Básico 1–2) | R$ 29,90 – 59,90 |
| LocationIQ (se o Free de 48 h não servir para armazenar) | ~US$ 45 (◐) |
| Snov.io | a validar |
| Envio de e-mail | depende da G3 |

## 8. Decisões pendentes após a parte 2

| ID | Decisão | Recomendação |
| --- | --- | --- |
| **G3 (reaberta)** | Canal de envio diante do §12 da Hostinger | **G3-b** (consulta formal à Hostinger) + pesquisa de **G3-c** (domínio e caixa dedicados em provedor que admita B2B 1 a 1) |
| **G2** | Onde mora a zona `eagagro.com` | Identificar o administrador da conta Cloudflare do domínio |
| **G8** | Fonte da lista | Casa dos Dados (API) no piloto |
| **G9** | Geocodificação | Centroide do município na busca + LocationIQ pago para os candidatos que avançam |
| **G10** | Mapa | PMTiles no R2 + MapLibre + turf |
| **G11** | Validação de e-mail | Snov.io; catch-all e unknown não contam como validado |
| **B3** | Limites de raio | 10–300 km |
| G6, G7 | Recursos antigos; DMARC | Mantidos como na parte 1 |

## 9. Próximo (depois do gate)

1. Pesquisa G3-c: 2–3 provedores com termos compatíveis com prospecção B2B individual + visão legal (T11).
2. Cobertura de skills da stack (passo 7 da Fase 4).
3. Scaffold: conferir `cloudflare/templates` após a stack aprovada.
