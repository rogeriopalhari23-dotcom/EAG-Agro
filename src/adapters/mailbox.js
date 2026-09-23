// Transporte SMTP pela caixa Hostinger (exceção P19; porta 465 com TLS implícito) via worker-mailer 1.2.1 (MIT).
// Import dinâmico: a biblioteca usa cloudflare:sockets, que só existe no runtime do Worker.
// Classificação do resultado (errata item 2): só "aceito" quando o send resolve; resposta 5xx do servidor → definitiva;
// 4xx → temporária; falha de conexão/autenticação antes do envio → temporária; qualquer outra falha → indeterminada.
export function classifySmtpError(error, stage) {
  const msg = String(error?.message || error);
  if (stage === "connect") return { kind: "temporary", detail: "conexão ou autenticação SMTP falhou antes do envio" };
  if (/(^|\D)5\d\d(\D|$)|\b5\.\d\.\d+\b/.test(msg)) return { kind: "permanent", detail: "servidor recusou a mensagem (5xx)" };
  if (/(^|\D)4\d\d(\D|$)|\b4\.\d\.\d+\b/.test(msg)) return { kind: "temporary", detail: "servidor adiou a mensagem (4xx)" };
  return { kind: "indeterminate", detail: "resposta do servidor não confirmada" };
}

export function smtpTransport(env) {
  return {
    async send({ to, subject, text, headers }) {
      if (!env.MAILBOX_USER || !env.MAILBOX_PASSWORD) return { kind: "temporary", detail: "credenciais da caixa não configuradas" };
      let mailer;
      try {
        const { WorkerMailer } = await import("worker-mailer");
        mailer = await WorkerMailer.connect({
          host: env.SMTP_HOST || "smtp.hostinger.com",
          port: Number(env.SMTP_PORT || 465),
          secure: true,
          credentials: { username: env.MAILBOX_USER, password: env.MAILBOX_PASSWORD },
          authType: "plain",
          socketTimeoutMs: 20000,
          responseTimeoutMs: 20000,
        });
      } catch (e) {
        return classifySmtpError(e, "connect");
      }
      try {
        await mailer.send({
          from: { name: env.SENDER_NAME || "Rogério Palhari", email: env.MAILBOX_USER },
          to: { email: to },
          reply: { email: env.MAILBOX_USER },
          subject,
          text,
          headers,
        });
        return { kind: "accepted" };
      } catch (e) {
        return classifySmtpError(e, "send");
      } finally {
        try {
          await mailer.close?.();
        } catch {}
      }
    },
  };
}
