#!/usr/bin/env bash
# Ponte de e-mail do EAG Compass — preparo do servidor (Hetzner CX23, Ubuntu 24.04), executado como root uma vez.
# Atualizações automáticas de segurança, firewall só com SSH de entrada, SSH só por chave, fail2ban e Node.js 24 LTS.
# Não instala a ponte nem pede segredo (isso é instalar.sh). Uso: bash preparar-servidor.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Rode como root."; exit 1; }
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || echo "Aviso: preparado para Ubuntu 24.04; sistema detectado: ${PRETTY_NAME:-desconhecido}."

# Não aceitar login por senha: exige que a chave do Rogério já esteja instalada (a Hetzner grava ao criar o servidor).
if [ ! -s /root/.ssh/authorized_keys ]; then
  echo "Nenhuma chave SSH em /root/.ssh/authorized_keys: instale a sua chave antes (senão o acesso por senha seria cortado)."; exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install unattended-upgrades ufw fail2ban ca-certificates curl sqlite3

# Atualizações de segurança automáticas, sem reinício automático (reinício fica para uma janela escolhida).
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CFG'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CFG

# SSH: só chave, root só por chave.
install -d -m 0755 /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/10-eag.conf <<'CFG'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CFG
sshd -t && systemctl reload ssh

# Firewall: entrada só SSH; a ponte só faz conexões de saída (Compass 443, Hostinger 587 e 993).
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable
systemctl enable --now fail2ban

# Node.js 24 LTS pelo repositório oficial da NodeSource.
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh
  apt-get -y -q install nodejs
  rm -f /tmp/nodesource_setup.sh
fi
timedatectl set-timezone UTC
echo "Servidor preparado: $(node -v), firewall $(ufw status | head -1), atualizações automáticas ligadas."
