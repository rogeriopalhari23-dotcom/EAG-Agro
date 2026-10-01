// Chamado por enviar-segredos-vps.ps1: grava cada segredo no servidor pela entrada padrão do ssh (nunca em argumento,
// arquivo local ou tela). No Windows o PowerShell 5.1 altera bytes em pipes; o Node entrega o valor exato.
import { spawnSync } from "node:child_process";

const host = process.env.EAG_VPS_HOST;
const key = process.env.EAG_VPS_KEY;
const ssh = (cmd, input) =>
  spawnSync("ssh", ["-i", key, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", `root@${host}`, cmd], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });

const files = ["BRIDGE_HMAC_KEY", "ACCESS_CLIENT_SECRET", "MAILBOX_PASSWORD"];
for (const name of files) {
  const value = process.env[`EAG_VPS_${name}`];
  if (!value) throw new Error(`segredo ${name} vazio`);
  const r = ssh(`install -d -m 0700 /etc/eag-mail-bridge && umask 077 && cat > /etc/eag-mail-bridge/${name} && chmod 0600 /etc/eag-mail-bridge/${name}`, value);
  if (r.status !== 0) {
    console.error(JSON.stringify({ segredo: name, ok: false, erro: (r.stderr || "").split("\n")[0].slice(0, 160) }));
    process.exit(1);
  }
  console.log(JSON.stringify({ segredo: name, ok: true, bytes: Buffer.byteLength(value) }));
}
// O Client ID não é segredo, mas também não vai em argumento: substitui a linha em config.env pelo stdin.
const id = process.env.EAG_VPS_ACCESS_CLIENT_ID;
const r = ssh(`f=/etc/eag-mail-bridge/config.env; test -f "$f" || { echo "rode instalar.sh antes" >&2; exit 1; }; v="$(cat)"; grep -v '^ACCESS_CLIENT_ID=' "$f" > "$f.novo"; printf 'ACCESS_CLIENT_ID=%s\\n' "$v" >> "$f.novo"; chmod 0600 "$f.novo"; mv "$f.novo" "$f"`, id);
if (r.status !== 0) {
  console.error(JSON.stringify({ config: "ACCESS_CLIENT_ID", ok: false, erro: (r.stderr || "").split("\n")[0].slice(0, 160) }));
  process.exit(1);
}
console.log(JSON.stringify({ config: "ACCESS_CLIENT_ID", ok: true }));
