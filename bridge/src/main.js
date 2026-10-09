// Processo da ponte. Configuração por variáveis de ambiente; segredos por arquivo (systemd LoadCredential= →
// $CREDENTIALS_DIRECTORY) ou pelo iniciador do Windows (DPAPI). Nunca imprime segredo, corpo ou endereço.
// Uso: node src/main.js            (laço contínuo, um ciclo por minuto)
//      node src/main.js --once     (um ciclo e sai)
//      node src/main.js --check    (só confere Compass, SMTP e IMAP, sem enviar)
//      node src/main.js --mailbox-only  (só a caixa: estado da INBOX e login SMTP, sem Compass e sem enviar)
import { readFileSync, writeFileSync, openSync, closeSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
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
  // D5-a: lista local de destinatários permitidos da cópia interna (separados por vírgula). Vazia = a ponte não envia
  // cópias e, com a cópia ligada no Compass, nenhum passo é reservado (falha fechada).
  copyAllow: String(env.BRIDGE_COPY_TO || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
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
  log, version: VERSION, copyAllow: cfg.copyAllow,
  // Teste interno: BRIDGE_FAULT=before_smtp|after_smtp|before_copy_smtp|after_copy_smtp encerra o processo nesse ponto;
  // imap_down simula a caixa fora do ar.
  fault: (point) => {
    if (env.BRIDGE_FAULT !== point) return;
    log("fault_injected", { point });
    if (point === "imap_down") throw Object.assign(new Error("caixa indisponível (simulação do teste interno)"), { code: "IMAP_SIMULATED_DOWN" });
    process.exit(86);
  },
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

// No Windows, process.exit() com conexões HTTP ainda fechando dispara uma asserção do Node (UV_HANDLE_CLOSING) e um
// código de saída anormal — a tarefa agendada leria como queda. Os modos terminam de forma natural, com process.exitCode.
const checkMode = process.argv.includes("--check");
if (checkMode) {
  // Diagnóstico sem envio: Compass (autenticação e cursor), IMAP (leitura) e SMTP (conexão e login pela ponte).
  let etapa = "compass";
  try {
    const cursor = await deps.compass.call("/api/bridge/cursor");
    log("compass_ok", { uidValidity: cursor.uidValidity, lastUid: cursor.lastUid });
    etapa = "imap";
    const st = await deps.imap.status();
    log("imap_ok", { uidValidity: st.uidValidity, messages: st.messages });
    etapa = "smtp";
    await deps.smtp.check();
    log("smtp_ok", { host: cfg.smtpHost, port: cfg.smtpPort });
    log("check_done", { note: "nenhuma mensagem enviada" });
    process.exitCode = 0;
  } catch (e) {
    log("check_failed", { etapa, status: e.status ?? null, code: e.code ?? null, message: String(e.message ?? "").slice(0, 160) });
    process.exitCode = 1;
  }
  deps.journal.close();
  release();
} else {

// Estado local para o comando "estado" (sem conteúdo, sem endereço, sem segredo).
const statePath = join(dirname(cfg.journalPath), "estado.json");
const stopPath = join(dirname(cfg.journalPath), "parar");
try {
  unlinkSync(stopPath); // pedido antigo não impede o novo início
} catch {}
const state = { pid: process.pid, version: VERSION, startedAt: new Date().toISOString(), lastCycleAt: null, lastReadOkAt: null, lastReadError: null, lastSentAt: null, sentSinceStart: 0, lastReason: null, stoppedAuth: false };
const saveState = () => {
  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch {}
};
saveState();

// Prazo do teste interno (BRIDGE_TEST_DEADLINE, ISO): passado o prazo, a ponte nunca pede envio — desliga o canal de
// e-mail no Compass (rota de trava, só desliga) e encerra. Vale a cada início, independente de sessão ou agendamento.
const deadline = env.BRIDGE_TEST_DEADLINE ? Date.parse(env.BRIDGE_TEST_DEADLINE) : null;
async function deadlinePassed() {
  if (!deadline || Date.now() < deadline) return false;
  try {
    const r = await deps.compass.call("/api/bridge/lockdown", { reason: "prazo do teste interno encerrado" });
    log("deadline_lockdown", { previous: r.previous, state: r.state });
  } catch (e) {
    log("deadline_lockdown_failed", { status: e.status ?? null, code: e.code ?? null });
  }
  state.lastReason = "prazo do teste interno encerrado";
  saveState();
  return true;
}

let stopping = false;
let authStopped = false;
do {
  if (await deadlinePassed()) break;
  try {
    if (!authStopped) {
      const r = await runCycle(deps);
      log("cycle", { readOk: r.readOk, sent: r.sent, reason: r.reason ?? null, copied: r.copied ?? false, copyReason: r.copyReason ?? null });
      Object.assign(state, { lastCycleAt: new Date().toISOString(), lastReason: r.reason ?? null });
      if (r.readOk) Object.assign(state, { lastReadOkAt: state.lastCycleAt, lastReadError: null });
      else state.lastReadError = r.reason ?? "leitura indisponível";
      if (r.sent) Object.assign(state, { lastSentAt: state.lastCycleAt, sentSinceStart: state.sentSinceStart + 1 });
      saveState();
      if (r.stop === "auth") {
        authStopped = true;
        state.stoppedAuth = true;
        saveState();
        log("smtp_auth_failed", { note: "envio parado até reiniciar a ponte com a senha correta" });
      }
    }
  } catch (e) {
    log("cycle_failed", { status: e.status ?? null, code: e.code ?? e.name ?? null });
  }
  if (process.argv.includes("--once")) break;
  // Espera o próximo ciclo conferindo o pedido de parada (arquivo "parar" criado por ponte.ps1): sai entre ciclos,
  // nunca no meio de um envio.
  const until = Date.now() + cfg.intervalMs + Math.floor(Math.random() * 10000);
  while (Date.now() < until && !stopping) {
    if (existsSync(stopPath)) stopping = true;
    else await new Promise((r) => setTimeout(r, 2000));
  }
} while (!stopping);
try {
  unlinkSync(stopPath);
} catch {}
log("stopped", { reason: stopping ? "pedido de parada" : "ciclo único concluído" });
deps.journal.close();
release();
process.exitCode = 0;
}
