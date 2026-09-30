# Ponte de e-mail (opção A) — proposta e estado da preparação

Decisão de Rogério em 2026-09-30: manter `rogeriopalhari@eagagro.com` (caixa Hostinger que ele usa) por meio de uma ponte fora
da Cloudflare. **Premissa corrigida em 2026-09-30:** Rogério não tem acesso administrativo ao domínio, ao DNS nem a servidores
da EAG; o Compass é ferramenta pessoal de trabalho dele. Nenhuma alteração na infraestrutura corporativa é pedida, e nenhuma
VPS da Hostinger é considerada disponível. Nada foi contratado, nenhum canal foi ligado e nada foi enviado a empresas.

## 1. Diagnóstico a partir da Cloudflare (2026-09-30 18:23 UTC)

`POST /api/integrations/mailbox/reach` no Worker de produção (abre TLS e lê só a saudação, sem login):

```
imap.hostinger.com:993  ok=false  stage=open  "proxy request failed, cannot connect to the specified address"
smtp.hostinger.com:465  ok=false  stage=open  "proxy request failed, cannot connect to the specified address"
```

DNS: `smtp.hostinger.com` → 172.65.255.143 / 2606:4700:90:0:f225:a1af:129b:4ba1; `imap.hostinger.com` → 172.65.188.64 /
2606:4700:90:0:4bc4:2557:ca17:2529 (faixas da Cloudflare). Documentação de TCP sockets (Workers, Troubleshooting): o erro indica
endereço proibido — "Examples of a disallowed address include Cloudflare IPs, `localhost`, and private network IPs". Não é senha
nem configuração. Da máquina de Rogério o SMTP funciona (teste interno aceito em 2026-09-30).

## 2. Onde o OpenClaw está hospedado (verificação independente, 2026-09-30)

- O lançador local (`%USERPROFILE%\EAG-OpenClaw\iniciar-eag-openclaw.ps1`) abre um túnel SSH `18789:127.0.0.1:18789` para
  `root@2.24.78.149`; a tela Claw3D roda no computador de Rogério e fala com o gateway do OpenClaw por esse túnel.
- `2.24.78.149` pertence à rede `HOSTINGER-HOSTING` (RIPE, 2.24.64.0–2.24.127.255, registrante `MNT-HOSTINGER`); o nome antigo
  `srv1644560.hstgr.cloud` é do produto VPS da Hostinger. Os dados públicos não mostram de quem é a conta — não se presume que
  seja da EAG nem de Rogério.
- As chaves SSH mudaram depois de maio/2026 (reinstalação ou troca). A ponte **não** usa esse servidor.

## 3. Arquitetura (implementada e testada localmente)

```
 Compass (Worker, atrás do Access)                           Ponte (processo Node.js)                 Hostinger
 fila, verificações pré-envio, rampa,     ◄── HTTPS ──  1. cursor → lê INBOX por UID ◄────────────── IMAP 993
 intervalo, janela, supressão, lease,        (só saída    2. inbound (bytes) → processMessage
 Message-ID, hash aprovado, auditoria         da ponte)   3. read-status ok  (portão de leitura)
                                             ◄──────────  4. claim → UMA mensagem congelada
                                                          5. envia os bytes MIME ───────────────────► SMTP 465/587
                                                          6. mesma MIME em "Sent" ──────────────────► IMAP 993
                                             ◄──────────  7. result (aceito/temporário/permanente/indeterminado)
```

A ponte não decide nada: o `claim` roda o mesmo caminho do envio de hoje (`prepareNext` em `src/sending.js`); respostas vão
para o mesmo `processMessage` (resposta pausa **empresa + commodity** em todos os contatos e canais e abre tarefa; descadastro
suprime; bounce suprime; aviso do provedor para tudo).

| Garantia | Como |
| --- | --- |
| Só mensagens congeladas e aprovadas | `claim` exige aprovação vigente e hash igual ao aprovado; a ponte confere o hash de novo antes de enviar e informa o hash do que enviou (divergência para o remetente) |
| Leitura de respostas indisponível → sem envio | portão no Worker: sem leitura bem-sucedida nos últimos 10 min (horário do Worker), `claim` devolve `reply_reader_unavailable`; a ponte também só pede mensagem depois de ler |
| Sem duplicidade | lease com token e um passo em trânsito por vez; `Message-ID` fixo; diário local (SQLite) `claimed → smtp_started → smtp_done → reported`; após queda: aceito e não informado → informa; queda durante o envio → procura o `Message-ID` em "Sent" (achou: aceito; não achou: indeterminado para Rogério); queda antes do SMTP → volta à fila; nunca reenvia sozinha |
| Erro de envio ambíguo | só resposta explícita do servidor decide; falha sem resposta durante o envio = indeterminado |
| Autenticação | token de serviço do Cloudflare Access (só `/api/bridge/*`, `common_name` conferido) + HMAC-SHA256 do corpo, carimbo de tempo (±5 min) e nonce de uso único no D1 |
| Credenciais | senha da caixa só na máquina da ponte (Linux: `/etc/eag-mail-bridge`, root 0600, `LoadCredential=`; Windows: DPAPI da conta de Rogério); no Worker só a chave HMAC |
| Privacidade da caixa | primeira leitura só marca a posição da INBOX (o histórico não vai ao Compass); caixa renumerada relê só os 2 últimos dias |
| Assinatura, remetente, descadastro | a MIME usa exatamente o texto e o HTML congelados (assinatura conferida), De "EAG Agro - Brasil" <rogeriopalhari@eagagro.com>, `List-Unsubscribe` + `List-Unsubscribe-Post` |
| Auditoria | Worker: `bridge.claimed`, `bridge.result`, `bridge.reader_ok/error`, `bridge.cursor_rebased`, `bridge.hash_mismatch` + `send_log`; ponte: só IDs, códigos SMTP e hashes |

Correção feita durante a preparação: a resposta „abmelden“ (pedida no rodapé alemão) não era reconhecida como descadastro;
agora suprime como "sair" (também "abbestellen", "austragen", avisos de ausência em alemão).

## 4. Hospedagem — alternativas para decisão

| | A. Servidor independente (Hetzner Cloud CX23) | B. Computador de Rogério (Windows) |
| --- | --- | --- |
| Custo mensal | **€ 5,49 + IPv4** (cerca de € 0,50) **+ impostos**, preço da Hetzner desde 15/06/2026 para novos pedidos (conta em nome de Rogério, cartão ou PayPal) | **R$ 0** (energia e internet já existentes) |
| Disponibilidade | 24 h; respostas lidas a cada minuto, também com o computador desligado | só com o computador ligado, com sessão aberta e sem suspensão |
| Envio | porta 587 com STARTTLS (a Hetzner bloqueia 465 em contas novas; a Hostinger aceita 587) | porta 465 (já testada daqui no envio interno de 30/09) |
| Instalação | `bridge/deploy/linux/instalar.sh` + serviço systemd isolado | `bridge/deploy/windows/` (segredos DPAPI, tarefa agendada ao entrar no Windows) |
| Manutenção | atualizações do sistema do servidor | nenhuma além do próprio computador |

**Por que a opção B exige o computador ligado:**
- A sequência só avança quando a ponte pede o próximo passo. Com o computador desligado ou suspenso, nenhum e-mail sai e os
  passos seguintes ficam para quando ele voltar, respeitando janela, intervalo e dias não seguidos (atrasam, não se acumulam).
- A leitura de respostas também para. Isso não causa envio indevido: o Compass só libera envio com leitura bem-sucedida nos
  últimos 10 minutos, e a ponte lê a caixa antes de cada envio — uma resposta que chegou com o computador desligado é
  registrada, e pausa a empresa, antes de qualquer novo toque.
- O custo é de ritmo: com 5 a 20 e-mails por dia na janela de 9h às 17h no fuso do destinatário, o computador precisa ficar
  ligado nesse horário; para destinatários na Alemanha, a janela deles é das 4h às 12h em Brasília no horário de verão europeu (5h às 13h no inverno).

Nas duas opções a caixa, o remetente, a assinatura e o Compass são os mesmos; dá para começar em B e mudar para A depois (o
diário local só precisa estar vazio de pendências na troca).

## 5. Estado e próximos passos

| Etapa | Situação |
| --- | --- |
| Worker: rotas `/api/bridge/{claim,result,cursor,rebase,inbound,read-status}`, portão de leitura, migração `0030_ponte_email.sql` | implementado e testado; **não publicado** (publicar junto com a configuração) |
| Ponte `bridge/` (Node.js, `nodemailer` 10.0.13 e `imapflow` 2.1.2, `npm audit`: 0 vulnerabilidades) | implementada; 11 testes de ponta a ponta com o Worker real e SMTP/IMAP simulados |
| Conferência real da caixa pela ponte (`iniciar-ponte.ps1 -SoCaixa`: estado da INBOX e login SMTP, sem enviar) | pode ser feita já, no computador de Rogério |
| Hospedagem | **decisão de Rogério (A ou B)** |
| Configuração | token de serviço do Access e política *Service Auth* só para `/api/bridge/*` na conta Cloudflare pessoal de Rogério; `BRIDGE_HMAC_KEY` no Worker e na ponte; `SEND_TRANSPORT=bridge`; migração 0030 no D1 |
| Teste interno de ponta a ponta | canal `email` em `internal_test`, campanha de teste interna só para `rogeriopalhari23@gmail.com`, **ativada só com autorização específica**; casos: envio, resposta, „abmelden“, queda depois do envio, queda antes do envio, leitura indisponível, repetição de chamada, destinatário externo |
| Envio comercial | fora deste escopo: depende de Snov, liberação internacional, ativação da campanha real e aprovações individuais |

## 6. Mudanças de documento para aprovar

- **Constituição P19:** transporte "via ponte (SMTP/IMAP Hostinger) fora da Cloudflare, recebendo do Worker só mensagens
  congeladas e aprovadas; o Worker continua dono de fila, verificação pré-envio, idempotência, supressão e registro".
- **Spec:** "SE a última leitura de respostas bem-sucedida tiver mais de 10 minutos, ENTÃO nenhum e-mail DEVE ser enviado", com
  teste de aceitação; T1 (P2-T17) passa a validar pela ponte.
