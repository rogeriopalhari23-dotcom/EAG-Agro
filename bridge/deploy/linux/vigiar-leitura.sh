#!/usr/bin/env bash
# Vigia da leitura da caixa (timer a cada 5 min). Com a ponte ligada, se a última leitura bem-sucedida tiver mais de
# 15 minutos, registra erro no journald e reinicia a ponte (o Compass já recusa envio sem leitura há mais de 10 minutos).
# Parada por credencial recusada não é reiniciada em laço: só registra o erro para Rogério.
set -uo pipefail
estado=/var/lib/eag-mail-bridge/estado.json
systemctl is-enabled --quiet eag-mail-bridge 2>/dev/null || exit 0 # desligada de propósito: nada a vigiar
if ! systemctl is-active --quiet eag-mail-bridge; then
  echo "<3>ponte habilitada mas parada; o systemd tenta reiniciar (Restart=always)"; exit 0
fi
[ -f "$estado" ] || exit 0
read -r inicio leitura auth < <(node -e "const s=require('$estado');console.log(s.startedAt||'',s.lastReadOkAt||'-',s.stoppedAuth?1:0)")
if [ "$auth" = "1" ]; then echo "<3>ponte parada por credencial recusada: confira a senha da caixa ou o token do Access"; exit 0; fi
ref="$leitura"; [ "$ref" = "-" ] && ref="$inicio"
idade=$(( $(date +%s) - $(date -d "$ref" +%s) ))
if [ "$idade" -gt 900 ]; then
  echo "<3>sem leitura bem-sucedida da caixa há $((idade / 60)) min: reiniciando a ponte"
  systemctl restart eag-mail-bridge
else
  echo "<6>leitura da caixa em dia ($((idade / 60)) min)"
fi
