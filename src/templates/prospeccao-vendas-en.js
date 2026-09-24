// Modelos em inglês da /prospeccao-vendas (P3-T9; R28.15, PV12). A skill diz que no internacional "o processo é o
// mesmo, só que em inglês" (SKILL.md, seção de lacunas 🔴): esta é a TRADUÇÃO FIEL dos blocos em português de
// ./prospeccao-vendas.js, frase a frase, com as mesmas adaptações A-* e a mesma cadência.
// ✋ Portão humano: a tradução só vale depois de Rogério aprová-la lado a lado com o português
// (docs/implementation/AMOSTRAS-TEXTOS-EN.md). Até lá o revisor marca a ficha em inglês como não aprovável.
// A-EN1 Prova social declarada (texto em português) não entra no texto em inglês: nunca misturar idiomas.
export const TEMPLATES_EN_VERSION = "pv-en-1.0.0";
export const GAP_NOTE =
  "Lacuna 🔴 (R28.15): a skill /prospeccao-vendas não tem método específico para exportação — o curso diz que o processo é o mesmo, em inglês. Feiras, câmaras de comércio e bases de importadores não são cobertos.";

const COMPANY = "EAG Agro";
// Nome em inglês por commodity do catálogo (termo de mercado, não tradução livre). Sem entrada → a ficha não é gerada.
const COMMODITY_EN = {
  soy: "soybean", corn: "corn", coffee: "coffee", sugar: "sugar", ethanol: "ethanol", industrial_alcohol: "ethyl alcohol",
  wheat: "wheat", sorghum: "sorghum", soy_meal: "soybean meal", canola_meal: "canola meal", cotton_meal: "cottonseed meal",
  soy_oil: "soybean oil", canola_oil: "canola oil", cotton_oil: "cottonseed oil", palm_oil: "palm oil", soy_lecithin: "soy lecithin",
  ddgs: "DDGS", cgf: "corn gluten feed", cgm: "corn gluten meal", uco: "used cooking oil",
};
export function commodityDisplayEn(product) {
  return COMMODITY_EN[product.commodity] ?? null;
}
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function firstName(full) {
  const n = String(full || "").trim().split(/\s+/)[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : null;
}
function foundSentence(sourceLabel) {
  if (/linkedin/i.test(sourceLabel || "")) return "I found your contact on LinkedIn and took the liberty of sending you a quick message.";
  if (/\bsite\b|website/i.test(sourceLabel || "")) return "I found your contact on your website and took the liberty of sending you a quick message.";
  return null;
}
function signature(sig, unsubUrl) {
  return ["", `${sig.senderName} — ${COMPANY}`, sig.postalAddress, `To stop receiving these messages, reply "unsubscribe" or use this link: ${unsubUrl}`].join("\n");
}

// Mesma assinatura de generateSequence (português); `declarations.socialProof` é ignorada (A-EN1).
export function generateSequenceEn({ commodity, recipients, declarations = {}, sig, unsub }) {
  const out = [];
  const subject = `${capital(commodity)} supplier`;
  const decisors = recipients.filter((r) => r.role !== "influencer");
  const influencers = recipients.filter((r) => r.role === "influencer");
  for (const r of decisors) {
    const name = firstName(r.fullName);
    const hello = name ? `Hi ${name}, I hope you're well.` : "Hi, I hope you're well.";
    const found = foundSentence(r.sourceLabel);
    const volume = declarations.volumeAvailable === true;
    const e1 = [
      hello,
      ...(found ? [found] : []),
      `I'm with ${COMPANY}; we trade commodities${volume ? ` and we currently have a relevant volume of ${commodity} available` : ""}.`,
      `My goal with this first contact is simply to start a conversation, to understand whether it makes sense to present ${COMPANY} as a possible supplier to your company.`,
      "Would you have about 20 minutes this week for me to quickly explain how we work?",
    ].join("\n");
    const e2 = [
      name ? `Hi ${name}, how are you?` : "Hi, how are you?",
      "Did you get a chance to see the email I sent you a few days ago? I haven't heard back from you. Is this the best way to reach you?",
    ].join("\n");
    const e3 = [
      hello,
      `I'm writing again because I know purchasing routines are busy. We talk with manufacturers that use ${commodity} to understand how they organize their supply.`,
      "If it makes sense, would you have 20 minutes for a quick conversation in the coming days?",
    ].join("\n");
    const e4 = [
      name ? `I guess now isn't the best time, ${name}.` : "I guess now isn't the best time.",
      "I've tried to reach you a few times over the last few weeks, but haven't heard back, either positive or negative. I imagine you have other priorities at the moment or are involved in more urgent projects, so I don't want to insist more than necessary.",
      `The idea of my contact was to talk about supplying ${commodity} to manufacturers and understand whether it would make sense to present how ${COMPANY} works with structured, regular and predictable supply.`,
      "I'll close here so as not to take up more of your time. If this topic makes sense at some point, just reply to this email.",
      "Best regards,",
    ].join("\n");
    const sigText = signature(sig, unsub(r.contactId));
    const email = (step, day, subj, body, objective) =>
      out.push({ contactId: r.contactId, role: r.role, channel: "email", kind: "auto_email", step, day, subject: subj, body: body + "\n" + sigText, objective });
    email(1, 0, subject, e1, "iniciar conversa e pedir 20 minutos");
    email(2, 4, `Re: ${subject}`, e2, "confirmar se viu e se o canal é este");
    email(3, 10, subject, e3, "reaparecer com ângulo novo e pedir conversa");
    email(4, 14, subject, e4, "encerrar a sequência (break)");
    const task = (step, day, channel, body, objective) =>
      out.push({ contactId: r.contactId, role: r.role, channel, kind: "manual_task", step, day, subject: null, body, objective });
    if (r.linkedin) task(5, 2, "linkedin", `${name ? `Hi ${name}, how are you?` : "Hi, how are you?"} I sent you an email, did you get a chance to see it?`, "reforçar o e-mail pelo LinkedIn");
    const l2 = [
      `Hi, ${name || "[name]"}, how are you? … ${/linkedin/i.test(r.sourceLabel || "") ? "I got your contact on LinkedIn and " : /\bsite\b|website/i.test(r.sourceLabel || "") ? "I got your contact on your website and " : ""}I'd like to talk with you for 5 minutes, it's a very quick matter. Did I catch you at a good time?`,
      `My name is ${sig.senderName}, I'm with ${COMPANY}. I saw that your company buys ${commodity}${volume ? " and I currently have a good volume available for negotiation" : ""}. I'd like to quickly understand whether it makes sense for us to talk.`,
      "Just to see whether there is any synergy between our businesses: if I can really help you, I'd like to ask three quick questions.",
      `— Today, do you buy ${commodity} directly from the mill or through a trading company?`,
      "— Do you usually work with spot purchases or monthly contracts?",
      "— In terms of volume, what is your average monthly consumption?",
      "Close: Can we schedule a video call, Wednesday or Thursday? It's quick, 20 to 30 minutes. (Confirm the email live and send the invitation right away.)",
    ].join("\n");
    const l1 = `Reception: ask to speak with ${name || "the buyer"} ("Is ${name || "the buyer"} at their desk?"). If they ask what it's about: "I'm in touch with ${name || "the buyer"} by email. Tell them it's ${sig.senderName}, from ${COMPANY}."\n\nIf they answer (Level 2):\n${l2}`;
    task(6, 3, "call", l1, "falar com o decisor e marcar a reunião");
    task(7, 7, "call", l1, "falar com o decisor e marcar a reunião");
    task(8, 8, "call", l1 + (r.linkedin ? "\n\nIf they don't answer: message on LinkedIn." : ""), "falar com o decisor e marcar a reunião");
    task(9, 11, "call", l1, "falar com o decisor e marcar a reunião");
  }
  for (const r of influencers) {
    const name = firstName(r.fullName);
    const body = [
      name ? `Hi ${name}, I hope you're well.` : "Hi, I hope you're well.",
      `I'm with ${COMPANY}; we trade commodities, and I've been trying to reach your purchasing team about supplying ${commodity}.`,
      "Could you help me with a 20-minute conversation, or point me to the most appropriate person to discuss this topic?",
    ].join("\n");
    out.push({ contactId: r.contactId, role: r.role, channel: "email", kind: "auto_email", step: 3, day: 10, subject, body: body + "\n" + signature(sig, unsub(r.contactId)), objective: "pedir conversa ao influenciador ou indicação" });
  }
  return out;
}

export const LEVEL0_SCRIPT_EN = [
  "Reception: Hi, this is Juliana, how can I help?",
  "You: Hi Juliana, how are you? Let's see if you can help me: I'm looking for the person responsible for purchasing. Can I reach them at this number or would it be another one?",
  "If they won't put you through: No problem, I completely understand — it's normal, we work the same way here. Let's do this: could you give me the email? If they're interested, they can reply there, all right?",
  "If the email is generic (purchasing@): Thanks for the email! Just tell me one thing: who should I address it to in the purchasing department?",
  'Never: "Good afternoon, I\'m … and I work at … Could I speak with the purchasing department?"',
].join("\n");
