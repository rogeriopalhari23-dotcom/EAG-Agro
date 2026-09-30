// Um ciclo da ponte: (1) fecha pendências de ciclos interrompidos, (2) lê respostas e registra no Compass,
// (3) só se a leitura deu certo, pede UM passo e envia. A ponte não decide elegibilidade: o Compass decide no claim.
// Regra de ouro: nunca enviar de novo um passo que possa ter saído. Dúvida vira "indeterminado" para Rogério.
import { buildRaw, messageHash } from "./mail.js";

export async function recover({ compass, imap, journal, log }) {
  for (const j of journal.pending()) {
    const m = { outboxId: j.outbox_id, leaseToken: j.lease_token };
    let report;
    if (j.state === "claimed") {
      // Reservado e nunca entregue ao SMTP (o diário grava "smtp_started" antes de conectar): certamente não saiu.
      // "Temporário" devolve o passo à fila do Compass, que decide de novo no próximo claim.
      report = { outcome: "temporary", evidence: "reservado pela ponte e não entregue ao SMTP (queda antes do envio)" };
    } else if (j.state === "smtp_started") {
      const found = await imap.sentHasMessageId(j.message_id).catch(() => null);
      report =
        found === true
          ? { outcome: "accepted", sentSha256: j.sha256, evidence: "Message-ID encontrado na pasta de enviados após queda" }
          : { outcome: "indeterminate", evidence: found === false ? "queda durante o envio; Message-ID não encontrado nos enviados" : "queda durante o envio; pasta de enviados indisponível" };
    } else if (j.outcome === "not_sent") {
      report = { outcome: "indeterminate", evidence: j.smtp_text || "não enviado" };
    } else {
      report = { outcome: j.outcome, sentSha256: j.sha256, smtp: { code: j.smtp_code, text: j.smtp_text } };
    }
    try {
      await compass.call("/api/bridge/result", { ...m, ...report });
      journal.reported(m);
      log("recovered", { outboxId: m.outboxId, outcome: report.outcome });
    } catch (e) {
      // 409 = o Compass já tem outro desfecho para esse lease (ex.: resolvido por Rogério): encerra o registro local.
      if (e.status === 409) journal.reported(m);
      log("recover_failed", { outboxId: m.outboxId, status: e.status ?? null, code: e.code ?? null });
    }
  }
}

export async function readReplies({ compass, imap, log, version }) {
  try {
    const cursor = await compass.call("/api/bridge/cursor");
    const got = await imap.fetchNew(cursor);
    // Primeira leitura ou caixa renumerada: o Compass passa a contar da posição atual; só as recentes são registradas.
    if (got.baseline) await compass.call("/api/bridge/rebase", { uidValidity: got.uidValidity, highestUid: got.highestUid });
    for (const m of got.messages)
      await compass.call("/api/bridge/inbound", { mailbox: "INBOX", uidValidity: got.uidValidity, uid: m.uid, raw: Buffer.from(m.raw).toString("base64") });
    await compass.call("/api/bridge/read-status", { ok: true, uidValidity: got.uidValidity, highestUid: got.highestUid, version });
    if (got.messages.length) log("replies_registered", { count: got.messages.length });
    return true;
  } catch (e) {
    log("read_failed", { status: e.status ?? null, code: e.code ?? null });
    await compass.call("/api/bridge/read-status", { ok: false, error: `${e.code ?? e.name ?? "erro"}`.slice(0, 120), version }).catch(() => {});
    return false;
  }
}

export async function sendOne({ compass, smtp, imap, journal, log }) {
  const { message: m, reason } = await compass.call("/api/bridge/claim");
  if (!m) return { sent: false, reason };
  journal.claimed(m);
  // Conferência local: o que vai sair é o que Rogério aprovou (mesmo hash do congelamento da ficha).
  if (messageHash(m.subject, m.text, m.html) !== m.sha256) {
    journal.notSent(m, "hash local diferente do aprovado; não enviado");
    await compass.call("/api/bridge/result", { outboxId: m.outboxId, leaseToken: m.leaseToken, outcome: "indeterminate", evidence: "hash local diferente do aprovado; não enviado" });
    journal.reported(m);
    return { sent: false, reason: "hash_mismatch" };
  }
  if (journal.alreadyAccepted(m.outboxId)) {
    journal.notSent(m, "passo já aceito pelo SMTP em lease anterior");
    await compass.call("/api/bridge/result", { outboxId: m.outboxId, leaseToken: m.leaseToken, outcome: "accepted", sentSha256: m.sha256, evidence: "já aceito antes (diário da ponte)" });
    journal.reported(m);
    return { sent: false, reason: "already_accepted" };
  }
  const { raw, envelope } = await buildRaw(m);
  journal.smtpStarted(m);
  const r = await smtp.send(raw, envelope);
  journal.smtpDone(m, r);
  log("smtp_result", { outboxId: m.outboxId, kind: r.kind, code: r.code ?? null });
  if (r.kind === "accepted") await imap.appendSent(raw).catch((e) => log("append_sent_failed", { code: e.code ?? null }));
  await compass.call("/api/bridge/result", { outboxId: m.outboxId, leaseToken: m.leaseToken, outcome: r.kind, sentSha256: m.sha256, smtp: { code: r.code, text: r.text } });
  journal.reported(m);
  return { sent: r.kind === "accepted", reason: r.kind, stop: r.stop ?? null };
}

export async function runCycle(deps) {
  await recover(deps);
  const readOk = await readReplies(deps);
  if (!readOk) return { readOk, sent: false, reason: "reply_reader_unavailable" };
  const s = await sendOne(deps);
  return { readOk, ...s };
}
