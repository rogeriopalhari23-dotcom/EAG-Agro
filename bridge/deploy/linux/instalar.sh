#!/usr/bin/env bash
# Ponte de e-mail do EAG Compass — instalação no servidor independente (Hetzner CX23, Ubuntu 24.04), como root.
# Rode depois de preparar-servidor.sh. Os segredos chegam por enviar-segredos-vps.ps1 (do computador do Rogério, sem
# aparecer na tela) e ficam só em /etc/eag-mail-bridge (root, 0600), entregues ao serviço por LoadCredential=.
# NÃO liga a ponte: a ligação é um passo separado, depois de desligar a ponte do Windows (uma ponte só).
# Uso: bash /opt/eag-mail-bridge/instalacao/bridge/deploy/linux/instalar.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Rode como root."; exit 1; }
command -v node >/dev/null || { echo "Node.js ausente: rode preparar-servidor.sh."; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' || { echo "Node.js 22.5+ necessário."; exit 1; }
origem="$(cd "$(dirname "$0")/../.." && pwd)"
id eagbridge >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin eagbridge
install -d -m 0755 /opt/eag-mail-bridge
rm -rf /opt/eag-mail-bridge/bridge.novo
cp -r "$origem" /opt/eag-mail-bridge/bridge.novo
rm -rf /opt/eag-mail-bridge/bridge.novo/node_modules /opt/eag-mail-bridge/bridge.novo/data
(cd /opt/eag-mail-bridge/bridge.novo && npm ci --omit=dev --no-audit --no-fund)
rm -rf /opt/eag-mail-bridge/bridge
mv /opt/eag-mail-bridge/bridge.novo /opt/eag-mail-bridge/bridge
chown -R root:root /opt/eag-mail-bridge/bridge

install -d -m 0700 /etc/eag-mail-bridge
if [ ! -f /etc/eag-mail-bridge/config.env ]; then
  # Hetzner bloqueia a saída pela porta 465 em contas novas; a Hostinger aceita 587 com STARTTLS (TLS obrigatório na ponte).
  # ACCESS_CLIENT_ID chega junto com os segredos (enviar-segredos-vps.ps1).
  cat > /etc/eag-mail-bridge/config.env <<'CFG'
COMPASS_URL=https://eag-compass-production.rogeriopalhari23.workers.dev
MAILBOX_USER=rogeriopalhari@eagagro.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
IMAP_HOST=imap.hostinger.com
IMAP_PORT=993
BRIDGE_INTERVAL_MS=60000
CFG
  chmod 0600 /etc/eag-mail-bridge/config.env
fi
aqui="$(dirname "$0")"
for u in eag-mail-bridge.service eag-mail-bridge-caixa.service eag-mail-bridge-conferir.service eag-mail-bridge-vigia.service eag-mail-bridge-vigia.timer; do
  install -m 0644 "$aqui/$u" "/etc/systemd/system/$u"
done
install -m 0755 "$aqui/vigiar-leitura.sh" /usr/local/sbin/eag-mail-bridge-vigiar
install -m 0755 "$aqui/ponte.sh" /usr/local/sbin/ponte
systemctl daemon-reload
systemctl enable --now eag-mail-bridge-vigia.timer
echo "Instalado (ponte DESLIGADA). Próximos passos:"
echo "  1. segredos: no Windows, bridge\\deploy\\windows\\enviar-segredos-vps.ps1 -Servidor <IP>"
echo "  2. ponte caixa      (IMAP 993 e login SMTP 587, sem Compass e sem enviar)"
echo "  3. ponte conferir   (Compass + caixa, sem enviar)"
echo "  4. só depois de desligar a ponte do Windows: ponte ligar"
