# Ponte de e-mail no servidor independente (Hetzner CX23)

Decisão de Rogério em 2026-10-01: contratar Hetzner CX23 (€ 5,49 + € 0,50 de IPv4 por mês, sem impostos; preços de
15/06/2026) e migrar a ponte do Windows para execução contínua. O Compass continua na Cloudflare. Nada aqui libera envio
comercial: canal `email` segue `planned`; pendências "sair", Snov e aprovação individual das fichas continuam.

## Contratação (Rogério)

1. Conta: https://accounts.hetzner.com/signUp (sem VPN; a Hetzner pode pedir documento ou pagamento antecipado).
2. https://console.hetzner.com → projeto → **Add Server**: local Nuremberg ou Falkenstein · imagem **Ubuntu 24.04** ·
   tipo **Cost-Optimized › x86 › CX23** · **Public IPv4 + IPv6** · chave SSH **eag-ponte-vps** (conteúdo de
   `%USERPROFILE%\.ssh\eag_ponte_vps.pub`) · backups desligados.
3. Informar só o IP do servidor.

## Instalação (sem ligar a ponte)

Do Windows (Git Bash), na pasta do repositório:

```
ssh -i ~/.ssh/eag_ponte_vps root@IP true                       # primeira conexão: grava a impressão do servidor
git archive HEAD bridge | ssh -i ~/.ssh/eag_ponte_vps root@IP "mkdir -p /opt/eag-mail-bridge/instalacao && tar -x -C /opt/eag-mail-bridge/instalacao"
ssh -i ~/.ssh/eag_ponte_vps root@IP "bash /opt/eag-mail-bridge/instalacao/bridge/deploy/linux/preparar-servidor.sh"
ssh -i ~/.ssh/eag_ponte_vps root@IP "bash /opt/eag-mail-bridge/instalacao/bridge/deploy/linux/instalar.sh"
```

Segredos (PowerShell, do computador de Rogério; nada aparece na tela):

```
powershell -NoProfile -ExecutionPolicy Bypass -File bridge\deploy\windows\enviar-segredos-vps.ps1 -Servidor IP
```

Conferências sem envio, no servidor: `ponte caixa` (IMAP 993 e login SMTP 587 — **só isto comprova a conexão**) e
`ponte conferir` (Compass + caixa).

## Migração (uma ponte só)

1. Windows: `bridge\ponte parar` e, se existir, remover a tarefa de início automático (`instalar-tarefa.ps1 -Remover`
   ou `Unregister-ScheduledTask`); confirmar que não há processo `node … src\main.js`.
2. Reconciliar: diário local do Windows sem pendências (`state` diferente de `reported` = 0) e Compass sem `leased`,
   `indeterminate` ou `temp_failed`. Pendência encontrada é resolvida antes de ligar a remota (nunca reenviar no escuro).
3. Servidor: `ponte ligar` → `ponte estado` mostra leitura OK em até 1 minuto. O cursor da caixa fica no Compass, então
   a ponte nova continua do mesmo ponto, sem reler o histórico.
4. Teste interno (só aliases autorizados de `rogeriopalhari23@gmail.com`, com o canal em `internal_test` só durante o
   teste): envio, resposta e envio único; canal volta a `planned` ao final.

## Operação

| Comando (root no servidor) | Efeito |
| --- | --- |
| `ponte estado` | serviço, última leitura OK, último envio (horário de Cuiabá) |
| `ponte registro [n]` | últimas linhas do journald (sem segredo, corpo ou endereço) |
| `ponte ligar` / `ponte desligar` | liga e ativa no boot / para entre ciclos e desativa |
| `ponte caixa` / `ponte conferir` | conferências sem envio |

- Início automático e reinício após falha: `eag-mail-bridge.service` (`Restart=always`, limite de 10 reinícios em 15 min).
- Credenciais: `/etc/eag-mail-bridge/` (root, 0600), entregues só ao serviço por `LoadCredential=`; processo como
  usuário `eagbridge`, sem privilégios, sistema de arquivos somente leitura exceto `/var/lib/eag-mail-bridge`.
- Vigia da leitura: `eag-mail-bridge-vigia.timer` a cada 5 min; sem leitura OK há mais de 15 min, registra erro e
  reinicia a ponte; credencial recusada não entra em laço (só registra). O Compass recusa envio sem leitura há 10 min (R19.14).
- Manutenção: atualizações de segurança automáticas (`unattended-upgrades`, sem reinício automático); SSH só por chave;
  firewall só com SSH de entrada; Node.js 24 LTS pelo repositório da NodeSource (atualiza com o sistema).
