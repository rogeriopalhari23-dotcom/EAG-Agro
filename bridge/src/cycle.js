// Um ciclo da ponte: (1) fecha pendências de ciclos interrompidos, (2) lê respostas e registra no Compass,
// (3) só se a leitura deu certo, pede UM passo e envia; (4) envia no máximo UMA cópia interna pendente (D5-a).
// A ponte não decide elegibilidade: o Compass decide no claim.
// Regra de ouro: nunca enviar de novo um passo que possa ter saído. Dúvida vira "indeterminado" para Rogério.
// A cópia interna segue a mesma regra e nunca interfere no passo do prospect.
import { buildRaw, messageHash } from "./mail.js";

const oneRecipient = (envelope) => Array.isArray(envelope?.to) && envelope.to.length === 1;

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

// Cópias interrompidas. A pasta de enviados é gravada pela própria ponte depois do SMTP (a Hostinger não grava sozinha):
// "não encontrada" não prova que não saiu — fica indeterminado, sem reenvio automático.
export async function recoverCopies({ compass, imap, journal, log }) {
  for (const j of journal.copy.pending()) {
    const c = { outboxId: j.outbox_id, leaseToken: j.lease_token };
    let report;
    if (j.state === "claimed") report = { outcome: "temporary", evidence: "cópia reservada e não entregue ao SMTP (queda antes do envio)" };
    else if (j.state === "smtp_started") {
      const found = await imap.sentHasMessageId(j.message_id).catch(() => null);
      report =
        found === true
          ? { outcome: "accepted", evidence: "Message-ID da cópia encontrado nos enviados após queda" }
          : { outcome: "indeterminate", evidence: found === false ? "queda durante o envio da cópia; não encontrada nos enviados" : "queda durante o envio da cópia; enviados indisponíveis" };
    } else if (j.outcome === "not_sent") report = { outcome: "indeterminate", evidence: j.smtp_text || "cópia não enviada" };
    else report = { outcome: j.outcome, evidence: [j.smtp_code, j.smtp_text].filter(Boolean).join(" ") || null };
    try {
      await compass.call("/api/bridge/copy-result", { ...c, ...report });
      journal.copy.reported(c);
      log("copy_recovered", { outboxId: c.outboxId, outcome: report.outcome });
    } catch (e) {
      if (e.status === 409) journal.copy.reported(c);
      log("copy_recover_failed", { outboxId: c.outboxId, status: e.status ?? null, code: e.code ?? null });
    }
  }
}

// fault: só no teste interno (BRIDGE_FAULT) — simula queda ou caixa indisponível num ponto exato.
export async function readReplies({ compass, imap, log, version, fault }) {
  try {
    fault?.("imap_down");
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

export async function sendOne({ compass, smtp, imap, journal, log, fault, copyAllow = [] }) {
  // A lista local da cópia vai no pedido: com cópia exigida e endereço fora da lista, o Compass não reserva nada.
  const { message: m, reason } = await compass.call("/api/bridge/claim", { copyAllow });
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
  if (!oneRecipient(envelope)) {
    journal.notSent(m, "envelope com destinatários diferentes de um; não enviado");
    await compass.call("/api/bridge/result", { outboxId: m.outboxId, leaseToken: m.leaseToken, outcome: "indeterminate", evidence: "envelope com destinatários diferentes de um; não enviado" });
    journal.reported(m);
    return { sent: false, reason: "envelope_invalid" };
  }
  fault?.("before_smtp");
  journal.smtpStarted(m);
  const r = await smtp.send(raw, envelope);
  journal.smtpDone(m, r);
  if (r.kind === "accepted") fault?.("after_smtp");
  log("smtp_result", { outboxId: m.outboxId, kind: r.kind, code: r.code ?? null });
  if (r.kind === "accepted") await imap.appendSent(raw).catch((e) => log("append_sent_failed", { code: e.code ?? null }));
  await compass.call("/api/bridge/result", { outboxId: m.outboxId, leaseToken: m.leaseToken, outcome: r.kind, sentSha256: m.sha256, smtp: { code: r.code, text: r.text } });
  journal.reported(m);
  return { sent: r.kind === "accepted", reason: r.kind, stop: r.stop ?? null };
}

// Cópia interna D5-a: mensagem separada, ao endereço da lista local, só de passo já aceito (o Compass só entrega assim).
export async function sendCopyOne({ compass, smtp, imap, journal, log, fault, copyAllow = [] }) {
  if (!copyAllow.length) return { copied: false, reason: "copy_not_configured_locally" };
  const { copy: c, reason } = await compass.call("/api/bridge/copy-claim", { copyAllow });
  if (!c) return { copied: false, reason };
  journal.copy.claimed(c);
  const report = async (outcome, evidence) => {
    await compass.call("/api/bridge/copy-result", { outboxId: c.outboxId, leaseToken: c.leaseToken, outcome, evidence });
    journal.copy.reported(c);
  };
  // Conferências locais: destinatário na lista local e nenhum link de descadastro do prospect na cópia.
  if (!copyAllow.map((x) => x.toLowerCase()).includes(String(c.to).toLowerCase())) {
    journal.copy.notSent(c, "destinatário da cópia fora da lista local; não enviada");
    await report("permanent", "destinatário da cópia fora da lista local da ponte; não enviada");
    return { copied: false, reason: "copy_target_not_allowed" };
  }
  if (journal.copy.alreadyAccepted(c.outboxId)) {
    journal.copy.notSent(c, "cópia já aceita pelo SMTP em lease anterior");
    await report("accepted", "já aceita antes (diário da ponte)");
    return { copied: false, reason: "already_accepted" };
  }
  const { raw, envelope } = await buildRaw({ from: c.from, to: c.to, replyTo: c.replyTo, subject: c.subject, text: c.text, html: c.html, messageId: c.messageId, headers: { "X-EAG-Copy-Of": c.copyOf } });
  if (!oneRecipient(envelope) || /List-Unsubscribe/i.test(raw.toString("utf8").split(/\r?\n\r?\n/)[0])) {
    journal.copy.notSent(c, "cópia com envelope inválido ou cabeçalho de descadastro; não enviada");
    await report("indeterminate", "cópia com envelope inválido ou cabeçalho de descadastro; não enviada");
    return { copied: false, reason: "copy_invalid" };
  }
  fault?.("before_copy_smtp");
  journal.copy.smtpStarted(c);
  const r = await smtp.send(raw, envelope);
  journal.copy.smtpDone(c, r);
  if (r.kind === "accepted") fault?.("after_copy_smtp");
  log("copy_smtp_result", { outboxId: c.outboxId, kind: r.kind, code: r.code ?? null });
  if (r.kind === "accepted") await imap.appendSent(raw).catch((e) => log("append_sent_failed", { code: e.code ?? null }));
  await report(r.kind, [r.code, r.text].filter(Boolean).join(" ").slice(0, 200) || null);
  return { copied: r.kind === "accepted", reason: r.kind, stop: r.stop ?? null };
}

export async function runCycle(deps) {
  await recover(deps);
  await recoverCopies(deps);
  const readOk = await readReplies(deps);
  const s = readOk ? await sendOne(deps) : { sent: false, reason: "reply_reader_unavailable" };
  // A cópia não depende da leitura de respostas (não é contato com prospect) e nunca bloqueia o ciclo.
  const c = s.stop === "auth" ? { copied: false, reason: "auth" } : await sendCopyOne(deps).catch((e) => (deps.log("copy_failed", { status: e.status ?? null, code: e.code ?? null }), { copied: false, reason: "copy_error" }));
  return { readOk, ...s, copied: c.copied, copyReason: c.reason };
}
