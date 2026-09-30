# Ponte de e-mail (opção A) — proposta para aprovação

Decisão de Rogério em 2026-09-30: manter `rogeriopalhari@eagagro.com` (Hostinger) por meio de uma ponte fora da Cloudflare.
Esta proposta prepara a solução; não ativa campanha, não liga o canal e não envia nada a empresas.

## 1. Diagnóstico a partir da Cloudflare (2026-09-30 18:23 UTC)

`POST /api/integrations/mailbox/reach` no Worker de produção (abre TLS e lê só a saudação, sem login):

```
imap.hostinger.com:993  ok=false  stage=open  "proxy request failed, cannot connect to the specified address"
smtp.hostinger.com:465  ok=false  stage=open  "proxy request failed, cannot connect to the specified address"
```

DNS (DoH): `smtp.hostinger.com` → 172.65.255.143 / 2606:4700:90:0:f225:a1af:129b:4ba1; `imap.hostinger.com` → 172.65.188.64 /
2606:4700:90:0:4bc4:2557:ca17:2529 — endereços da Cloudflare. Documentação de TCP sockets (Workers, Troubleshooting): esse erro
significa endereço proibido — "Examples of a disallowed address include Cloudflare IPs, `localhost`, and private network IPs".
Mesmo resultado de 2026-09-25. Da máquina de Rogério o SMTP funciona (teste interno aceito em 2026-09-30). Conclusão: não é
senha nem configuração; o Worker não pode falar SMTP/IMAP com a Hostinger. Gravar `MAILBOX_PASSWORD` no Worker não resolve.

## 2. VPS existente

| Item | Situação em 2026-09-30 |
| --- | --- |
| Endereço | `2.24.78.149` (Hostinger, fora das faixas da Cloudflare) |
| SSH | responde; ED25519 `SHA256:zA4NvA5n8KMmxOVbyKdsgYdRn1I4LQjFREnM6y/1JX8` (igual a 25/09; diferente do `known_hosts` de maio → reinstalação ou troca) |
| Identidade | **não validada** — falta a conferência pelo terminal do hPanel (OPENCLAW-RECONCILIACAO.md) |
| Executor antigo (OpenClaw, `eag_mailer.py`) | **desconhecido** — precisa estar comprovadamente parado antes da ponte (R25.3) |

A VPS está disponível, mas não validada. A ponte só é instalada depois da validação da etapa F0.

## 3. Arquitetura

```
 Compass (Worker, atrás do Access)                         VPS (ponte eag-mail-bridge)            Hostinger
 ─────────────────────────────────                         ───────────────────────────            ─────────
 fila send_outbox, verificações pré-envio,   ◄── HTTPS ──   1. POST /api/bridge/claim  (a cada 60 s)
 rampa, intervalo, janela, supressão,          (só saída     2. envia a mensagem congelada ───────► SMTP 465 (TLS verificado)
 lease, Message-ID, hash aprovado              da VPS)       3. grava cópia em "Sent" ────────────► IMAP 993
                                             ◄──────────────  4. POST /api/bridge/result
 processMessage (resposta, descadastro,      ◄──────────────  5. lê INBOX por UID (a cada 2 min) ◄── IMAP 993
 bounce) → pausa empresa + commodity                          6. POST /api/bridge/inbound (bytes brutos)
 portão "leitura de respostas saudável"      ◄──────────────  7. POST /api/bridge/heartbeat
```

Princípio: a ponte não decide nada. O Worker continua dono da fila, das verificações pré-envio, da idempotência, da
supressão, da auditoria e do conteúdo; a ponte só transporta a mensagem já congelada e aprovada e devolve o que leu.

### 3.1 Contratos (Worker)

| Rota | O que faz |
| --- | --- |
| `POST /api/bridge/claim` | Roda o mesmo `tick()` de hoje com transporte "adiado": trava do remetente, rampa, intervalo, janela no fuso do destinatário, todas as verificações pré-envio (aprovação vigente, hash, supressão, sanções, canal, validação, pausa, internacional). Se passar, faz o lease e devolve **uma** mensagem: `outboxId`, `leaseToken`, `messageId`, `to`, `subject`, `text`, `html`, cabeçalhos (`List-Unsubscribe`, `List-Unsubscribe-Post`), `sha256` aprovado. Sem mensagem elegível: `204` com o motivo. |
| `POST /api/bridge/result` | `outboxId`, `leaseToken`, `outcome` (`accepted` / `temp` / `permanent` / `indeterminate`), resposta SMTP (código e texto curto), `sha256` do que foi enviado. Aceita só o lease vigente; repetição do mesmo resultado é idempotente; hash diferente do aprovado vira bloqueio e auditoria. |
| `POST /api/bridge/inbound` | `mailbox`, `uidValidity`, `uid`, bytes brutos (limite 5 MB) → `processMessage` existente (R2, correlação por `In-Reply-To`/`References`, descadastro "sair/abmelden/unsubscribe", bounce, aviso do provedor). Idempotente por `(mailbox, uidvalidity, uid)`. Devolve o maior UID processado. |
| `POST /api/bridge/heartbeat` | Última leitura IMAP bem-sucedida, UIDVALIDITY, versão da ponte. |

Portão de leitura de respostas (no Worker, não na ponte): se a última leitura IMAP bem-sucedida tiver mais de **10 min**,
`claim` devolve `reply_reader_unavailable` e nada sai. Assim, mesmo uma ponte com defeito não envia sem a leitura em dia. O
cron atual deixa de chamar o transporte SMTP (`SEND_TRANSPORT=bridge`); o `tick()` só roda pelo `claim`.

### 3.2 Parada na empresa inteira

Já implementada em `src/inbound.js` (R20.1, R20.5): resposta correlacionada cancela todos os passos pendentes da mesma
**empresa + commodity** (todos os contatos e canais), suspende ligações e LinkedIn e abre tarefa para Rogério; outra commodity
da mesma empresa recebe alerta. Descadastro suprime o endereço; bounce permanente cancela o destinatário; aviso do provedor
para o remetente. A ponte só passa a entregar a mensagem; a regra continua no Worker e nos testes existentes.

### 3.3 Sem duplicidade, inclusive após falhas

1. **Worker:** lease com token por linha e trava do remetente; `Message-ID` fixo por linha da fila; resultado aceito uma vez
   por lease; lease vencido vira `indeterminate` (regra atual AT27) e nunca volta sozinho para `pending`.
2. **Ponte:** diário local (SQLite) por `outboxId`: `claimed → smtp_started → smtp_done → reported`. Ao reiniciar:
   `smtp_done` não reportado → reporta de novo (idempotente); `smtp_started` sem desfecho → procura o `Message-ID` em "Sent"
   (IMAP `SEARCH HEADER Message-ID`): achou → `accepted`; não achou → `indeterminate` para decisão de Rogério. Nunca reenvia
   por conta própria.
3. **Hostinger:** a mesma MIME enviada por SMTP é gravada em "Sent" por IMAP `APPEND`: Rogério vê o enviado na caixa e a
   conferência de duplicidade tem prova.

### 3.4 Autenticação e credenciais

- **Ponte → Worker:** token de serviço do Cloudflare Access (Client ID/Secret) numa política *Service Auth* só para
  `/api/bridge/*`; o Worker valida o JWT do Access (como já faz), exige o `common_name` do token da ponte e dá a esse ator só as
  rotas da ponte. Além disso, cada chamada leva assinatura HMAC-SHA256 do corpo com carimbo de tempo (±5 min) e nonce guardado
  no D1 (contra repetição).
- **Segredos:** senha da caixa, segredo do Access e chave HMAC ficam só na VPS, em `/etc/eag-mail-bridge/` (root, 0600),
  entregues ao serviço por `LoadCredential=` do systemd; digitados por Rogério no terminal da VPS, nunca no chat, no Git ou em
  log. No Worker: só `BRIDGE_HMAC_KEY` (secret) e o ID do token.
- **Rede:** a VPS não abre porta nova (a ponte só faz conexões de saída); firewall com entrada só SSH por chave. TLS com
  certificado verificado nos três destinos (Compass, SMTP, IMAP).
- **Registro:** o Worker audita claim, resultado, respostas e mudança de saúde da leitura; a ponte registra no journald só
  IDs, códigos SMTP e hashes (sem corpo e sem endereço).

### 3.5 Serviço na VPS

Node.js 24 LTS, um processo `systemd` (usuário próprio sem shell, `NoNewPrivileges`, `ProtectSystem=strict`, reinício
automático), bibliotecas `nodemailer` (SMTP e montagem MIME) e `imapflow` (IMAP), diário em `node:sqlite`. Código versionado
neste repositório (`bridge/`), com testes contra servidores SMTP/IMAP falsos; instalação por script conferido.

## 4. Custo e hospedagem

| Item | Custo |
| --- | --- |
| VPS atual (Hostinger) | nenhum adicional, se validada e mantida (valor do plano no hPanel) |
| Cloudflare Access (token de serviço) e Workers | incluídos no que já está em uso (Zero Trust gratuito até 50 usuários) |
| `nodemailer`, `imapflow`, Node.js | licenças livres, sem custo |
| Plano B, se a VPS não puder ser validada | nova VPS de entrada na Hostinger (mesmo fornecedor; preço a conferir no hPanel no dia) |

Volume do piloto: 5 → 20 e-mails/dia (R19.10–R19.12); consumo de recursos desprezível.

## 5. Plano de execução e de teste interno

| Etapa | Conteúdo | Quem |
| --- | --- | --- |
| **F0 — Validar a VPS** | No terminal do hPanel: `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` (tem de mostrar `SHA256:zA4N…1JX8`); `cat /etc/os-release`; `systemctl list-units --type=service --state=running`; `crontab -l; ls /etc/cron.d`; `ps aux \| grep -i -E "openclaw\|autopilot\|eag_mailer"`. Resultado define: usar a VPS, limpar o executor antigo (R25.3) ou plano B. | Rogério (terminal do hPanel) |
| **F1 — Worker** | Rotas da ponte, transporte adiado no `tick()`, portão de leitura, HMAC com nonce, migração (estado da ponte, nonces), testes. Publicado com o canal `email` ainda `planned`. | Implementação |
| **F2 — Ponte** | `bridge/` com diário, recuperação após queda, cópia em "Sent", leitura por UID, heartbeat; testes com SMTP/IMAP falsos. | Implementação |
| **F3 — Instalação** | Token de serviço do Access (criado por Rogério no painel ou por mim com autorização), serviço na VPS, segredos digitados por Rogério. Diagnóstico da VPS até SMTP/IMAP (saudação e login). | Rogério + implementação |
| **F4 — Teste interno ponta a ponta** | Canal `email` em `internal_test` (o Worker recusa qualquer destinatário fora de `INTERNAL_TEST_RECIPIENTS`). Campanha interna de teste com destinatário `rogeriopalhari23@gmail.com`, aprovada por Rogério — **ativação dessa campanha de teste só com autorização específica**. | Rogério + implementação |
| **F5 — Aceite** | Rogério confere o resultado; ligar o canal para empresas é decisão separada, com as demais pendências (Snov, liberação internacional, campanha, aprovações). | Rogério |

Casos do teste interno (F4), cada um com evidência no Compass e na caixa:

1. Passo 1 enviado: chega no Gmail com De "EAG Agro - Brasil", texto, assinatura, logo, rodapé e `List-Unsubscribe`; cópia em
   "Sent"; hash enviado = hash aprovado; fila `accepted`.
2. Resposta do Gmail: a ponte lê, o Compass registra, cancela o passo 2 e pausa empresa + commodity; tarefa para Rogério.
3. Resposta "sair"/"abmelden" e clique no link de descadastro: supressão; nada mais sai para o endereço.
4. Queda da ponte depois do SMTP aceitar e antes de reportar: ao voltar, acha a mensagem em "Sent" e reporta `accepted`; **um**
   e-mail no Gmail.
5. Queda antes do SMTP: lease vence, linha `indeterminate`, nada reenviado sozinho.
6. Leitura IMAP indisponível (senha IMAP errada de propósito ou bloqueio de saída): após 10 min o `claim` recusa com
   `reply_reader_unavailable`; nenhum envio.
7. Chamadas repetidas de `result`/`inbound`: sem efeito duplicado. Token revogado ou assinatura inválida: 403, auditado.
8. Destinatário fora da lista interna: recusado pelo Worker em `internal_test`.

## 6. Mudanças de documento para aprovar

- **Constituição P19:** onde diz transporte "via `connect()` do Worker", passa a "via ponte na VPS (SMTP/IMAP Hostinger),
  recebendo do Worker só mensagens congeladas e aprovadas; o Worker continua dono de fila, verificação pré-envio,
  idempotência, supressão e registro". Motivo: bloqueio de sockets da Cloudflare para IPs da própria Cloudflare (seção 1).
- **Spec:** novo requisito "SE a última leitura de respostas bem-sucedida tiver mais de 10 minutos, ENTÃO nenhum e-mail DEVE
  ser enviado" e teste de aceitação correspondente; T1 (P2-T17) passa a validar pela ponte.

## 7. Pendências independentes

Snov (validação de e-mail) segue separado: não impede construir nem testar a ponte com destinatário interno. Liberação
internacional, ativação da campanha real e aprovações das três fichas v2 continuam decisões de Rogério.
