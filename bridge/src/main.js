// Processo da ponte. Configuração por variáveis de ambiente; segredos por arquivo (systemd LoadCredential= →
// $CREDENTIALS_DIRECTORY) ou pelo iniciador do Windows (DPAPI). Nunca imprime segredo, corpo ou endereço.
// Uso: node src/main.js            (laço contínuo, um ciclo por minuto)
//      node src/main.js --once     (um ciclo e sai)
//      node src/main.js --check    (só confere Compass, SMTP e IMAP, sem enviar)
//      node src/main.js --mailbox-only  (só a caixa: estado da INBOX e login SMTP, sem Compass e sem enviar)
import { readFileSync, writeFileSync, openSync, closeSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { compassClient } from "./compass.js";
import { smtpClient, imapClient } from "./mail.js";
import { openJournal } from "./journal.js";
import { runCycle } from "./cycle.js";

const VERSION = "eag-mail-bridge/0.1.0";
const env = process.env;
function secret(name) {
  if (env.CREDENTIALS_DIRECTORY) {
    try {
      return readFileSync(join(env.CREDENTIALS_DIRECTORY, name), "utf8").trim();
    } catch {}
  }
  const v = env[name];
  if (!v) throw new Error(`Segredo ausente: ${name}`);
  return v;
}
const log = (event, data = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));

const cfg = {
  compassUrl: env.COMPASS_URL,
  mailboxUser: env.MAILBOX_USER,
  smtpHost: env.SMTP_HOST || "smtp.hostinger.com",
  smtpPort: Number(env.SMTP_PORT || 465),
  imapHost: env.IMAP_HOST || "imap.hostinger.com",
  imapPort: Number(env.IMAP_PORT || 993),
  journalPath: env.BRIDGE_JOURNAL || "./data/journal.sqlite",
  intervalMs: Number(env.BRIDGE_INTERVAL_MS || 60000),
};
const mailboxOnly = process.argv.includes("--mailbox-only");
if (!cfg.mailboxUser || (!mailboxOnly && !cfg.compassUrl)) throw new Error("Defina MAILBOX_USER e COMPASS_URL.");

const pass = secret("MAILBOX_PASSWORD");
if (mailboxOnly) {
  const smtp = smtpClient({ host: cfg.smtpHost, port: cfg.smtpPort, user: cfg.mailboxUser, pass });
  const imap = imapClient({ host: cfg.imapHost, port: cfg.imapPort, user: cfg.mailboxUser, pass });
  try {
    const st = await imap.status();
    log("imap_ok", { host: cfg.imapHost, messages: st.messages });
    await smtp.check();
    log("smtp_ok", { host: cfg.smtpHost, port: cfg.smtpPort });
    log("mailbox_check_done", { note: "nenhuma mensagem enviada ou lida" });
    process.exit(0);
  } catch (e) {
    log("mailbox_check_failed", { code: e.code ?? null, responseCode: e.responseCode ?? null, message: String(e.message ?? "").slice(0, 120) });
    process.exit(1);
  }
}
const deps = {
  compass: compassClient({
    baseUrl: cfg.compassUrl, hmacKey: secret("BRIDGE_HMAC_KEY"),
    accessClientId: env.ACCESS_CLIENT_ID || null, accessClientSecret: env.ACCESS_CLIENT_ID ? secret("ACCESS_CLIENT_SECRET") : null,
  }),
  smtp: smtpClient({ host: cfg.smtpHost, port: cfg.smtpPort, user: cfg.mailboxUser, pass }),
  imap: imapClient({ host: cfg.imapHost, port: cfg.imapPort, user: cfg.mailboxUser, pass }),
  log, version: VERSION,
};

// Uma única instância por diário (evita dois processos enviando pela mesma caixa).
mkdirSync(dirname(cfg.journalPath), { recursive: true });
// A trava guarda o PID: depois de queda (sem apagar a trava), o próximo início a retoma se o processo não existe mais.
const lockPath = `${cfg.journalPath}.lock`;
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};
let lockFd;
try {
  lockFd = openSync(lockPath, "wx");
} catch {
  const pid = Number(readFileSync(lockPath, "utf8").trim());
  if (pid && pid !== process.pid && alive(pid)) throw new Error(`Outra instância da ponte está ativa (PID ${pid}).`);
  unlinkSync(lockPath);
  lockFd = openSync(lockPath, "wx");
}
writeFileSync(lockFd, String(process.pid));
const release = () => {
  try {
    closeSync(lockFd);
    unlinkSync(lockPath);
  } catch {}
};
process.on("exit", release);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
deps.journal = openJournal(cfg.journalPath);

if (process.argv.includes("--check")) {
  // Diagnóstico sem envio: Compass (autenticação e cursor), IMAP (leitura) e SMTP (conexão e login pela ponte).
  const cursor = await deps.compass.call("/api/bridge/cursor");
  log("compass_ok", { uidValidity: cursor.uidValidity, lastUid: cursor.lastUid });
  const st = await deps.imap.status();
  log("imap_ok", { uidValidity: st.uidValidity, messages: st.messages });
  await deps.smtp.check();
  log("smtp_ok", { host: cfg.smtpHost, port: cfg.smtpPort });
  log("check_done", { note: "nenhuma mensagem enviada" });
  process.exit(0);
}

let stopping = false;
let authStopped = false;
do {
  try {
    if (!authStopped) {
      const r = await runCycle(deps);
      log("cycle", { readOk: r.readOk, sent: r.sent, reason: r.reason ?? null });
      if (r.stop === "auth") {
        authStopped = true;
        log("smtp_auth_failed", { note: "envio parado até reiniciar a ponte com a senha correta" });
      }
    }
  } catch (e) {
    log("cycle_failed", { status: e.status ?? null, code: e.code ?? e.name ?? null });
  }
  if (process.argv.includes("--once")) break;
  await new Promise((r) => setTimeout(r, cfg.intervalMs + Math.floor(Math.random() * 10000)));
} while (!stopping);
