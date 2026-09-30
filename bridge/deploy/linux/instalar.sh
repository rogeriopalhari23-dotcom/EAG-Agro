#!/usr/bin/env bash
# Ponte de e-mail do EAG Compass — instalação num servidor Linux próprio (Debian/Ubuntu), executada como root.
# Os segredos são digitados no terminal do servidor (sem eco) e gravados só em /etc/eag-mail-bridge (root, 0600).
# Uso: sudo bash bridge/deploy/linux/instalar.sh   (a partir de uma cópia do repositório no servidor)
set -euo pipefail
command -v node >/dev/null || { echo "Instale Node.js 24 LTS antes (https://nodejs.org)."; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' || { echo "Node.js 22.5+ necessário."; exit 1; }
id eagbridge >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin eagbridge
install -d -m 0755 /opt/eag-mail-bridge
cp -r "$(dirname "$0")/../.." /opt/eag-mail-bridge/bridge
(cd /opt/eag-mail-bridge/bridge && npm ci --omit=dev)
install -d -m 0700 /etc/eag-mail-bridge
if [ ! -f /etc/eag-mail-bridge/config.env ]; then
  # Hetzner bloqueia a porta 465 de saída em contas novas; a Hostinger aceita 587 com STARTTLS (TLS obrigatório na ponte).
  cat > /etc/eag-mail-bridge/config.env <<'CFG'
COMPASS_URL=https://eag-compass-production.rogeriopalhari23.workers.dev
MAILBOX_USER=rogeriopalhari@eagagro.com
ACCESS_CLIENT_ID=
SMTP_PORT=587
CFG
  chmod 0600 /etc/eag-mail-bridge/config.env
fi
for nome in MAILBOX_PASSWORD BRIDGE_HMAC_KEY ACCESS_CLIENT_SECRET; do
  if [ ! -s "/etc/eag-mail-bridge/$nome" ]; then
    read -r -s -p "$nome (não aparece na tela): " valor; echo
    umask 077; printf '%s' "$valor" > "/etc/eag-mail-bridge/$nome"; unset valor
  fi
done
install -m 0644 "$(dirname "$0")/eag-mail-bridge.service" /etc/systemd/system/eag-mail-bridge.service
systemctl daemon-reload
echo "Instalado. Confira antes de ligar: sudo -u eagbridge env \$(cat /etc/eag-mail-bridge/config.env | xargs) CREDENTIALS_DIRECTORY=/etc/eag-mail-bridge node /opt/eag-mail-bridge/bridge/src/main.js --mailbox-only"
echo "Ligar: systemctl enable --now eag-mail-bridge   |   Registro: journalctl -u eag-mail-bridge -f"
