// Ficha para identificar o responsável pela compra (2026-09-30). Base na /prospeccao-vendas: PV3 admite toque cujo
// objetivo é "descobrir a pessoa certa"; o texto segue o Level 0 da skill ("estou procurando o responsável pela área de
// compras… para quem eu endereço?") e a mensagem ao influenciador ("me indicar a pessoa mais adequada"), levados para o
// e-mail ao canal geral publicado da empresa. Adaptações Compass:
//  A-ID1 Destinatário é o canal geral (info@, kontakt@), não uma pessoa: saudação sem nome.
//  A-ID2 Sequência do modelo: E-mail 1 (dia 0) e E-mail 2 "chegou a ver?" (dia 4, como o E-mail 2 da skill). A contagem é
//        escolha do modelo, não regra da Spec; o revisor só exige o que a Spec exige (dias não seguidos, R19.2 item 12).
//  A-ID3 Sem pedido de reunião, preço, lote, volume ou condição comercial (PV7); a conversa vem na ficha do comprador.
//  A-ID4 Alemão e inglês: tradução fiel das frases em português (PV12: idioma do país); alemão com "Sie".
//        A aprovação do texto é a própria aprovação individual da ficha (R18.3); não há aprovação extra.
//  A-ID5 (2026-09-30) Textos em alemão e português escritos por Rogério (versão 1.1.0). O acompanhamento usa o mesmo
//        assunto, sem "Re:": o envio não encadeia o segundo e-mail ao primeiro (sem In-Reply-To/References), então "Re:"
//        diria que é resposta sem ser. O inglês continua na versão 1.0.0 (não revisado).
export const IDENT_VERSION = { "pt-BR": "id-pt-1.1.0", en: "id-en-1.0.0", de: "id-de-1.1.0" };

import { emailParts } from "./assinatura.js";
const COMPANY = "EAG Agro";
// Rodapé separado da assinatura: endereço físico (R19.13) e forma de saída (R21.7).
const footer = (s, unsubLine) => [s.postalAddress, unsubLine];
// Termo de mercado da commodity em alemão (sem entrada → a ficha em alemão não é gerada).
const COMMODITY_DE = { coffee: "Rohkaffee", sugar: "Zucker", soy: "Sojabohnen", corn: "Mais", soy_meal: "Sojaschrot", soy_oil: "Sojaöl", ethanol: "Ethanol" };
export const commodityDisplayDe = (product) => COMMODITY_DE[product.commodity] ?? null;

const TEXT = {
  "pt-BR": {
    subject: (c) => `Responsável pela compra de ${c}`,
    e1: (c, s) => ["Olá,", `Meu nome é ${s.senderName}, da ${COMPANY}, no Brasil. Atuamos na intermediação de commodities agrícolas, incluindo ${c} brasileiro.`, `Quem é responsável pela compra de ${c} na empresa? Poderia encaminhar esta mensagem à pessoa responsável ou indicar um contato profissional adequado?`, "Obrigado pela atenção."],
    e2: (c) => ["Olá,", `Retomo brevemente minha mensagem anterior. Poderia indicar com quem devo falar sobre a compra de ${c}?`, `Se a empresa não compra ${c}, uma breve confirmação já ajuda.`, "Obrigado."],
    unsub: (u) => `Para não receber mais mensagens, responda "sair" ou use este link: ${u}`,
  },
  en: {
    subject: (c) => `${c.charAt(0).toUpperCase()}${c.slice(1)} supplier`,
    hello: "Hi, I hope you're well.",
    found: "I found your contact on your website and took the liberty of sending you a quick message.",
    who: (c) => `I'm with ${COMPANY}; we trade agricultural commodities, and I would like to speak with the person responsible for purchasing ${c} at your company.`,
    ask: "Could you tell me who is responsible for this area and the best professional channel to reach them?",
    follow: (c) => `Did you get a chance to see the message I sent a few days ago? I only need to know who is responsible for purchasing ${c} and the best channel to reach them.`,
    unsub: (u) => `To stop receiving these messages, reply "unsubscribe" or use this link: ${u}`,
  },
  de: {
    // Texto de Rogério para Rohkaffee; o substantivo composto vale para café verde.
    subject: (c) => `Zuständige Person für den ${c}-Einkauf`,
    e1: (c, s) => ["Guten Tag,", `mein Name ist ${s.senderName}, ich bin bei ${COMPANY} in Brasilien tätig. Wir vermitteln Agrarrohstoffe, darunter brasilianischen ${c}.`, `Wer ist in Ihrem Unternehmen für den Einkauf von ${c} zuständig? Könnten Sie meine Nachricht bitte an die zuständige Person weiterleiten oder mir eine geeignete geschäftliche Kontaktadresse nennen?`, "Vielen Dank für Ihre Unterstützung."],
    e2: (c) => ["Guten Tag,", `ich komme kurz auf meine vorherige Nachricht zurück. Könnten Sie mir bitte mitteilen, an wen ich mich bezüglich des Einkaufs von ${c} wenden kann?`, `Falls Ihr Unternehmen keinen ${c} einkauft, genügt ein kurzer Hinweis.`, "Vielen Dank."],
    unsub: (u) => `Wenn Sie keine weiteren Nachrichten erhalten möchten, antworten Sie mit „abmelden“ oder nutzen Sie diesen Link: ${u}`,
  },
};

// recipients: canais gerais da empresa [{ contactId, sourceLabel }]. Mesma saída de generateSequence (passos e dias).
export function generateIdentification({ language = "pt-BR", commodity, recipients, sig, unsub }) {
  const t = TEXT[language];
  if (!t) throw new Error(`Idioma sem modelo de identificação: ${language}`);
  const out = [];
  for (const r of recipients) {
    // Versão 1.1.0 (pt/de): parágrafos separados por linha em branco; versão 1.0.0 (en): linhas simples.
    const e1 = t.e1 ? t.e1(commodity, sig).join("\n\n") : [t.hello, ...(/\bsite\b|website/i.test(r.sourceLabel || "") ? [t.found] : []), t.who(commodity), t.ask].join("\n");
    const e2 = t.e2 ? t.e2(commodity).join("\n\n") : [t.hello, t.follow(commodity)].join("\n");
    // Texto: corpo, assinatura oficial (uma vez) e rodapé separado; HTML com a assinatura original, quando importada.
    const foot = footer(sig, t.unsub(unsub(r.contactId)));
    // Mesmo assunto no acompanhamento: o envio não encadeia como resposta real (sem In-Reply-To/References).
    out.push({ contactId: r.contactId, role: "company_channel", channel: "email", kind: "auto_email", step: 1, day: 0, subject: t.subject(commodity), ...emailParts(e1, foot), objective: "identificar o responsável pela compra e o canal profissional" });
    out.push({ contactId: r.contactId, role: "company_channel", channel: "email", kind: "auto_email", step: 2, day: 4, subject: t.subject(commodity), ...emailParts(e2, foot), objective: "obter a indicação do responsável ou a confirmação de que não compra" });
  }
  return out;
}
