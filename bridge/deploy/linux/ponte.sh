#!/usr/bin/env bash
# Comandos da ponte no servidor (root). Nada aqui mostra segredo, corpo de mensagem ou endereço.
#   ponte estado     serviço, última leitura da caixa, último envio (horário de Cuiabá)
#   ponte registro   últimas linhas do registro (journald)
#   ponte caixa      IMAP 993 e login SMTP, sem Compass e sem enviar
#   ponte conferir   Compass + caixa, sem enviar
#   ponte ligar      liga e ativa no boot (só depois de desligar a ponte do Windows)
#   ponte desligar   para entre ciclos (nunca no meio de um envio) e desativa no boot
set -euo pipefail
estado=/var/lib/eag-mail-bridge/estado.json
cuiaba() { [ -n "$1" ] && [ "$1" != "null" ] && TZ=America/Cuiaba date -d "$1" '+%d/%m %H:%M:%S (Cuiabá)' || echo "—"; }
case "${1:-estado}" in
  estado)
    echo "serviço: $(systemctl is-active eag-mail-bridge) (boot: $(systemctl is-enabled eag-mail-bridge 2>/dev/null || echo desativado))"
    if [ -f "$estado" ]; then
      j() { node -e "const s=require('$estado');const v=s['$1'];process.stdout.write(v==null?'null':String(v))"; }
      echo "início: $(cuiaba "$(j startedAt)") | última leitura OK: $(cuiaba "$(j lastReadOkAt)") | erro de leitura: $(j lastReadError)"
      echo "último ciclo: $(cuiaba "$(j lastCycleAt)") | último envio: $(cuiaba "$(j lastSentAt)") | motivo: $(j lastReason) | parada por autenticação: $(j stoppedAuth)"
    else echo "sem estado ainda (ponte nunca ligada neste servidor)"; fi
    ;;
  registro) journalctl -u eag-mail-bridge -u eag-mail-bridge-vigia -n "${2:-50}" --no-pager -o short-iso ;;
  caixa) systemctl start eag-mail-bridge-caixa; journalctl -u eag-mail-bridge-caixa -n 10 --no-pager -o cat ;;
  conferir) systemctl start eag-mail-bridge-conferir; journalctl -u eag-mail-bridge-conferir -n 15 --no-pager -o cat ;;
  ligar)
    for s in MAILBOX_PASSWORD BRIDGE_HMAC_KEY ACCESS_CLIENT_SECRET; do [ -s "/etc/eag-mail-bridge/$s" ] || { echo "segredo $s ausente"; exit 1; }; done
    grep -q '^ACCESS_CLIENT_ID=.\+' /etc/eag-mail-bridge/config.env || { echo "ACCESS_CLIENT_ID ausente em config.env"; exit 1; }
    systemctl enable --now eag-mail-bridge
    echo "ligada; confira com: ponte estado (a primeira leitura sai em até 1 minuto)"
    ;;
  desligar)
    if systemctl is-active --quiet eag-mail-bridge; then
      pid="$(systemctl show -p MainPID --value eag-mail-bridge)"
      touch /var/lib/eag-mail-bridge/parar
      echo "pedido de parada registrado; aguardando o fim do ciclo atual…"
      for _ in $(seq 1 90); do kill -0 "$pid" 2>/dev/null || break; sleep 2; done
    fi
    systemctl disable --now eag-mail-bridge
    rm -f /var/lib/eag-mail-bridge/parar
    echo "desligada e desativada no boot"
    ;;
  *) sed -n '2,9p' "$0"; exit 2 ;;
esac
