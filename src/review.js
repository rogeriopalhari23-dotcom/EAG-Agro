// Revisor automático PV1–PV12 + R19.13 (P2-T8, R17.3). Regras determinísticas; violação impede aprovação.
// Entrada: mensagens geradas (generateSequence) e contexto da ficha. Saída: { ok, findings: [{id, ok, detail, step?, contactId?}] }.
import { contactTargetFlag } from "./profiles.js";

const FORBIDDEN_PT = /\bR\$|\bUS\$|pre[çc]o|cota[çc][ãa]o|\blotes?\b|estoque|prazo de entrega|certifica|pagamento|concorrente|fornecedor atual/i;
const APOLOGY_PT = /poderia falar com o setor de compras|desculp[ae] (o |pelo )?inc[ôo]mod|desculpe incomodar|perd[ãa]o pelo inc[ôo]modo/i;
const VOLUME_PT = /volume relevante|bom volume dispon[íi]vel|volume dispon[íi]vel/i;
const URL_RE = /https?:\/\/[^\s)]+/g;
// Regras por idioma (P3-T9). Inglês conforme o Plano 3: PV1 "start a conversation" e "20 minutes"; PV7 com a lista do plano;
// PV9 "<Commodity> supplier" (sigla em maiúsculas aceita, ex.: DDGS); PV10 frases de desculpa e "forward me to purchasing".
const LANG = {
  "pt-BR": {
    hello: /^Olá/, conversation: /apenas iniciar uma conversa/, minutes: /20 minutos/, linkedin: /pelo LinkedIn/,
    inTouch: /em contato com .* por e-mail/i, breakText: /agora não é o melhor momento/, forbidden: FORBIDDEN_PT, apology: APOLOGY_PT,
    volume: VOLUME_PT, subject: /^Fornecedor [a-zà-ú][a-zà-ú ]*$/, subjectHint: "Fornecedor [commodity]", optOut: /"sair"/,
  },
  en: {
    hello: /^Hi\b/, conversation: /start a conversation/, minutes: /20 minutes|20-minute/, linkedin: /on LinkedIn/,
    inTouch: /in touch with .* by email/i, breakText: /now isn't the best time/,
    forbidden: /\bUS\$|\bprice|pricing|quot(e|ation)|\blots?\b|stock|inventory|certif|payment|delivery (time|date)/i,
    apology: /sorry to bother|apologies for|could you forward me to purchasing/i,
    volume: /relevant volume|good volume available|volume available/i,
    subject: /^([A-Z][a-z]+|[A-Z]{2,6})( [a-z]+)* supplier$/, subjectHint: "<Commodity> supplier", optOut: /"unsubscribe"/,
  },
};

function finding(list, id, ok, detail, extra = {}) {
  list.push({ id, ok, detail, ...extra });
}

// ctx: { market, commodity, otherCommodities: [nomes], declarations: {volumeAvailable, socialProof},
//        recipients: [{contactId, role, jobTitle, relationshipNote, sourceLabel}], postalAddress, unsubUrl: (contactId)=>URL }
export function reviewSequence(messages, ctx) {
  const f = [];
  const L = LANG[ctx.language || "pt-BR"] || LANG["pt-BR"];
  const emails = messages.filter((m) => m.kind === "auto_email");
  const byContact = new Map();
  for (const m of emails) byContact.set(m.contactId, [...(byContact.get(m.contactId) || []), m].sort((a, b) => a.day - b.day));
  const decisors = ctx.recipients.filter((r) => r.role !== "influencer");
  const influencers = ctx.recipients.filter((r) => r.role === "influencer");

  // PV1: estrutura do E-mail 1.
  for (const r of decisors) {
    const e1 = (byContact.get(r.contactId) || []).find((m) => m.step === 1);
    const ok = !!e1 && L.hello.test(e1.body) && L.conversation.test(e1.body) && L.minutes.test(e1.body);
    finding(f, "PV1", ok, ok ? "E-mail 1 com saudação, objetivo de conversa e pedido de 20 minutos." : "E-mail 1 sem a estrutura da skill.", { contactId: r.contactId });
  }
  // PV2: uma commodity, sem anexo, sem link além do descadastro.
  for (const m of messages) {
    const links = (m.body.match(URL_RE) || []).filter((u) => u !== ctx.unsubUrl(m.contactId));
    const other = (ctx.otherCommodities || []).filter((c) =>
      new RegExp(`(?<!\\p{L})${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu").test(m.body),
    );
    const ok = !links.length && !other.length && !m.attachments?.length;
    if (!ok)
      finding(f, "PV2", false, `Passo ${m.step} (${m.channel}): ${links.length ? "link além do descadastro" : other.length ? `outra commodity citada (${other.join(", ")})` : "anexo"}.`, { step: m.step, contactId: m.contactId });
  }
  if (!f.some((x) => x.id === "PV2")) finding(f, "PV2", true, "Uma commodity, sem anexo e sem link além do descadastro.");
  // PV3: todo toque tem objetivo de próximo passo.
  const noObjective = messages.filter((m) => !m.objective);
  finding(f, "PV3", !noObjective.length, noObjective.length ? `${noObjective.length} passo(s) sem objetivo.` : "Cada toque tem objetivo de próximo passo.");
  // PV4: origem do contato coerente; "em contato por e-mail" só depois do primeiro e-mail.
  let pv4 = true;
  for (const r of decisors) {
    const e1 = (byContact.get(r.contactId) || []).find((m) => m.step === 1);
    const says = e1 && L.linkedin.test(e1.body);
    if (says && !/linkedin/i.test(r.sourceLabel || "")) {
      pv4 = false;
      finding(f, "PV4", false, "E-mail 1 diz LinkedIn, mas a fonte registrada do contato é outra.", { contactId: r.contactId });
    }
    const firstEmailDay = Math.min(...(byContact.get(r.contactId) || []).map((m) => m.day));
    for (const m of messages.filter((x) => x.contactId === r.contactId && L.inTouch.test(x.body)))
      if (!(m.day > firstEmailDay)) {
        pv4 = false;
        finding(f, "PV4", false, `Passo ${m.step}: "em contato por e-mail" antes de qualquer e-mail.`, { step: m.step, contactId: r.contactId });
      }
  }
  if (pv4) finding(f, "PV4", true, "Afirmações coerentes com a fonte registrada e com o que já foi enviado.");
  // PV5: 3–4 e-mails ao decisor, dias diferentes e nunca seguidos.
  for (const r of decisors) {
    const list = byContact.get(r.contactId) || [];
    const gaps = list.slice(1).map((m, i) => m.day - list[i].day);
    const ok = list.length >= 3 && list.length <= 4 && gaps.every((g) => g >= 2);
    finding(f, "PV5", ok, ok ? "3–4 e-mails em dias diferentes, nunca seguidos." : `E-mails nos dias ${list.map((m) => m.day).join(", ")}: precisam ser 3–4 e nunca em dias seguidos.`, { contactId: r.contactId });
  }
  // PV6: break é o último e-mail.
  for (const r of decisors) {
    const list = byContact.get(r.contactId) || [];
    const breakIdx = list.findIndex((m) => L.breakText.test(m.body));
    const ok = breakIdx === -1 || breakIdx === list.length - 1;
    finding(f, "PV6", ok, ok ? "Break só ao fim da sequência." : "Há e-mail depois do break.", { contactId: r.contactId });
  }
  // PV7: nada de preço/cotação/lote…; volume só com declaração aprovada. Roteiros de ligação são guia de Rogério (fora do PV7, exceto volume).
  let pv7 = true;
  for (const m of messages) {
    if (m.channel !== "call" && L.forbidden.test(m.body)) {
      pv7 = false;
      finding(f, "PV7", false, `Passo ${m.step} (${m.channel}) cita preço, cotação, lote, estoque, prazo, certificação, pagamento ou concorrente.`, { step: m.step, contactId: m.contactId });
    }
    if (L.volume.test(m.body) && ctx.declarations?.volumeAvailable !== true) {
      pv7 = false;
      finding(f, "PV7", false, `Passo ${m.step}: volume disponível sem declaração aprovada (K6).`, { step: m.step, contactId: m.contactId });
    }
  }
  if (pv7) finding(f, "PV7", true, "Sem preço, lote ou prazo; volume e prova social só com declaração aprovada.");
  // PV8: papéis e cargos.
  for (const r of ctx.recipients) {
    const flag = contactTargetFlag(r.jobTitle, r.relationshipNote);
    const roleOk = ["decision_maker", "influencer", "provisional_decision_maker"].includes(r.role);
    const ok = roleOk && !flag;
    finding(
      f, "PV8", ok,
      ok ? "Destinatário com papel de comprador ou influenciador." : !roleOk ? "Destinatário sem papel de decisor ou influenciador." : flag === "executive_without_relationship" ? "CEO/diretoria sem relacionamento prévio registrado." : "Cargo fora do ICP (operação, RH ou logística).",
      { contactId: r.contactId },
    );
  }
  // PV9: assunto do E-mail 1.
  for (const m of emails.filter((x) => x.step === 1)) {
    const ok = L.subject.test(m.subject || "") && !/[%\d]/.test(m.subject || "");
    finding(f, "PV9", ok, ok ? `Assunto "${m.subject}".` : `Assunto "${m.subject}" fora do padrão "${L.subjectHint}".`, { contactId: m.contactId });
  }
  // PV10: tom sem pedido de desculpas nem pedido de "setor de compras".
  const apologies = messages.filter((m) => L.apology.test(m.body));
  finding(f, "PV10", !apologies.length, apologies.length ? `Frase proibida no passo ${apologies.map((m) => m.step).join(", ")}.` : "Tom direto, sem pedido de desculpas.");
  // PV11: influenciador com texto próprio.
  for (const r of influencers) {
    const mine = (byContact.get(r.contactId) || [])[0];
    const dec = decisors.map((d) => (byContact.get(d.contactId) || []).find((m) => m.step === 3)).filter(Boolean);
    const ok = !!mine && L.minutes.test(mine.body) && dec.every((d) => d.body !== mine.body);
    finding(f, "PV11", ok, ok ? "Mensagem ao influenciador própria, com pedido de conversa." : "Mensagem ao influenciador ausente, sem pedido de conversa ou igual à do decisor.", { contactId: r.contactId });
  }
  if (!influencers.length) finding(f, "PV11", true, "Sem influenciador nesta ficha.");
  // PV12: internacional no idioma do país.
  // PV12: internacional no idioma da campanha, com a lacuna 🔴 registrada; tradução em inglês só depois da aprovação de Rogério.
  if (ctx.market !== "international") finding(f, "PV12", true, "Não se aplica (nacional).");
  else {
    const gap = !!ctx.languageGapNote;
    const translation = ctx.language !== "en" || ctx.translationApproved === true;
    finding(
      f, "PV12", gap && translation,
      !gap ? "Lacuna 🔴 do internacional não registrada na ficha (R28.15)." : !translation ? `Tradução em inglês (${ctx.templatesVersion}) aguardando aprovação de Rogério lado a lado com o português.` : "Idioma da campanha e lacuna 🔴 registrados.",
    );
  }
  // R19.13 / R21.7: endereço físico e saída em todo e-mail.
  for (const m of emails) {
    const ok = !!ctx.postalAddress && m.body.includes(ctx.postalAddress) && m.body.includes(ctx.unsubUrl(m.contactId)) && L.optOut.test(m.body);
    if (!ok) finding(f, "R19.13", false, `E-mail passo ${m.step} sem endereço físico ou forma de saída.`, { step: m.step, contactId: m.contactId });
  }
  if (!f.some((x) => x.id === "R19.13")) finding(f, "R19.13", !!ctx.postalAddress, ctx.postalAddress ? "Endereço físico e saída em todos os e-mails." : "Endereço físico da EAG não configurado.");
  return { ok: f.every((x) => x.ok), findings: f };
}
