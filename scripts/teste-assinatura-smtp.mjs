// Teste interno (2026-09-30): a assinatura automática do webmail entra nos e-mails enviados por SMTP, como o Compass envia?
// Repete o envio do Compass (src/adapters/mailbox.js): smtp.hostinger.com:465, TLS implícito com certificado verificado,
// AUTH PLAIN com rogeriopalhari@eagagro.com, From/Reply-To iguais, corpo text/plain gerado pelo próprio modelo do Compass.
// Só envia para o endereço interno configurado em INTERNAL_TEST_RECIPIENTS (wrangler.jsonc). Nunca para prospects.
// A senha é digitada sem eco neste terminal (ou vem de MAILBOX_PASSWORD no ambiente local); nunca é exibida nem gravada.
// Uso: node scripts/teste-assinatura-smtp.mjs
import tls from "node:tls";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { generateIdentification } from "../src/templates/identificacao.js";

const cfg = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const pick = (k) => new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`).exec(cfg)?.[1];
const USER = pick("MAILBOX_USER");
const TO = (pick("INTERNAL_TEST_RECIPIENTS") || "").split(",")[0].trim();
const ADDRESS = pick("EAG_POSTAL_ADDRESS");
const SENDER = pick("SENDER_NAME") || "Rogério Palhari";
if (!USER || !/^[^@\s]+@[^@\s]+$/.test(TO)) throw new Error("MAILBOX_USER ou INTERNAL_TEST_RECIPIENTS ausente no wrangler.jsonc.");
if (/@(24grad|amori|blackandyum)\./i.test(TO)) throw new Error("Destinatário não é interno.");

async function askHidden(prompt) {
  if (process.env.MAILBOX_PASSWORD) return process.env.MAILBOX_PASSWORD;
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", function onData(ch) {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") process.exit(1);
      else if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
      else value += ch;
    });
  });
}

const marker = randomUUID().slice(0, 8);
const [m] = generateIdentification({ language: "de", commodity: "Rohkaffee", recipients: [{ contactId: "teste", sourceLabel: "site" }], sig: { senderName: SENDER, postalAddress: ADDRESS }, unsub: () => "[link de descadastro — teste interno, sem link real]" });
const body = `${m.body}\n\n--- fim do texto gerado pelo Compass (marcador ${marker}) ---`;
const subject = `[TESTE INTERNO ${marker}] ${m.subject}`;
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const wrap = (s) => b64(s).replace(/.{76}/g, "$&\r\n");
// Com a assinatura HTML importada, envia como o Compass: multipart/alternative (texto + HTML); sem ela, só texto.
const html = m.html ? m.html.replace("</body>", `<p style="font-size:11px;color:#999">--- fim do texto gerado pelo Compass (marcador ${marker}) ---</p></body>`) : null;
const boundary = `compass-${marker}`;
const content = html
  ? [`Content-Type: multipart/alternative; boundary="${boundary}"`, "", `--${boundary}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", wrap(body), `--${boundary}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "", wrap(html), `--${boundary}--`]
  : ["Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", wrap(body)];
const message = [
  `From: =?UTF-8?B?${b64(SENDER)}?= <${USER}>`,
  `To: <${TO}>`,
  `Reply-To: <${USER}>`,
  `Subject: =?UTF-8?B?${b64(subject)}?=`,
  `Date: ${new Date().toUTCString()}`,
  `Message-ID: <teste-${marker}@eagagro.com>`,
  "MIME-Version: 1.0",
  ...content,
].join("\r\n");

// DRY_RUN=1: mostra a mensagem que seria enviada, sem conectar nem pedir senha.
if (process.env.DRY_RUN) {
  console.log(message.split("\r\n\r\n")[0].replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, x) => Buffer.from(x, "base64").toString("utf8")));
  console.log("\n" + body);
  process.exit(0);
}
// Confirmação explícita do destinatário interno antes de pedir a senha.
if (!process.env.CONFIRM_INTERNAL) {
  process.stdout.write(`Enviar UM e-mail de teste somente para ${TO} (destinatário interno do wrangler.jsonc)? Digite SIM: `);
  const answer = await new Promise((r) => process.stdin.once("data", (d) => r(String(d).trim())));
  process.stdin.pause();
  if (answer !== "SIM") {
    console.log("Cancelado. Nada foi enviado.");
    process.exit(0);
  }
}
const password = await askHidden(`Senha da caixa ${USER} (não aparece na tela): `);
const sock = tls.connect({ host: "smtp.hostinger.com", port: 465, servername: "smtp.hostinger.com" }); // certificado verificado (padrão)
let buf = "";
const reply = () =>
  new Promise((resolve, reject) => {
    const tryParse = () => {
      const lines = buf.split("\r\n");
      for (let i = 0; i < lines.length - 1; i++)
        if (/^\d{3} /.test(lines[i])) {
          const out = lines.slice(0, i + 1).join("\n");
          buf = lines.slice(i + 1).join("\r\n");
          sock.off("data", onData);
          return resolve(out);
        }
    };
    const onData = (d) => ((buf += d.toString("utf8")), tryParse());
    sock.on("data", onData);
    sock.once("error", reject);
    tryParse();
  });
const step = async (cmd, expect, label) => {
  if (cmd) sock.write(cmd + "\r\n");
  const r = await reply();
  const code = r.slice(-200).match(/^(\d{3})/m)?.[1] ?? r.slice(0, 3);
  console.log(`${label}: ${r.split("\n").pop().slice(0, 3)}`);
  if (!expect.test(r.split("\n").pop())) throw new Error(`${label} recusado (${r.split("\n").pop().slice(0, 60)})`);
  return code;
};
await new Promise((ok, ko) => (sock.once("secureConnect", ok), sock.once("error", ko)));
console.log(`TLS: certificado verificado para smtp.hostinger.com (${sock.authorized ? "ok" : "falhou"})`);
await step(null, /^220/, "saudação");
await step("EHLO eag-compass-teste", /^250/, "EHLO");
await step(`AUTH PLAIN ${Buffer.from(`\0${USER}\0${password}`, "utf8").toString("base64")}`, /^235/, "autenticação");
await step(`MAIL FROM:<${USER}>`, /^250/, "remetente");
await step(`RCPT TO:<${TO}>`, /^250/, "destinatário interno");
await step("DATA", /^354/, "DATA");
await step(message.replace(/^\./gm, "..") + "\r\n.", /^250/, "mensagem aceita");
await step("QUIT", /^221/, "QUIT");
sock.end();
console.log(`\nEnviado só para ${TO}. Procure o assunto "[TESTE INTERNO ${marker}]".`);
console.log("Se a assinatura do webmail aparecer DEPOIS da linha \"--- fim do texto gerado pelo Compass ---\", o servidor a acrescenta nos envios por SMTP.");
