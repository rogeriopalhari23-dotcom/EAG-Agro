// Ficha para identificar o responsável pela compra (2026-09-30). Base na /prospeccao-vendas: PV3 admite toque cujo
// objetivo é "descobrir a pessoa certa"; o texto segue o Level 0 da skill ("estou procurando o responsável pela área de
// compras… para quem eu endereço?") e a mensagem ao influenciador ("me indicar a pessoa mais adequada"), levados para o
// e-mail ao canal geral publicado da empresa. Adaptações Compass:
//  A-ID1 Destinatário é o canal geral (info@, kontakt@), não uma pessoa: saudação sem nome.
//  A-ID2 Dois e-mails no máximo (dia 0 e dia 5), sem break: pergunta só quem responde pela compra e qual o canal profissional.
//  A-ID3 Sem pedido de reunião, preço, lote, volume ou condição comercial (PV7); a conversa vem na ficha do comprador.
//  A-ID4 Alemão: tradução fiel das frases em português, tratamento "Sie". ✋ Só aprovável depois de Rogério aprovar
//        o modelo alemão lado a lado com o português (parâmetro templates_de_approved), como no inglês.
export const IDENT_VERSION = { "pt-BR": "id-pt-1.0.0", en: "id-en-1.0.0", de: "id-de-1.0.0" };

const COMPANY = "EAG Agro";
// Termo de mercado da commodity em alemão (sem entrada → a ficha em alemão não é gerada).
const COMMODITY_DE = { coffee: "Rohkaffee", sugar: "Zucker", soy: "Sojabohnen", corn: "Mais", soy_meal: "Sojaschrot", soy_oil: "Sojaöl", ethanol: "Ethanol" };
export const commodityDisplayDe = (product) => COMMODITY_DE[product.commodity] ?? null;

const TEXT = {
  "pt-BR": {
    subject: (c) => `Fornecedor ${c}`,
    hello: "Olá, tudo bem?",
    found: "Encontrei o contato de vocês no site e tomei a liberdade de enviar uma mensagem rápida.",
    who: (c) => `Sou da ${COMPANY}; trabalhamos com commodities e gostaria de falar com a pessoa responsável pela compra de ${c} de vocês.`,
    ask: "Você poderia me indicar quem responde por essa área e qual o melhor canal profissional para falar com essa pessoa?",
    follow: (c) => `Chegou a ver a mensagem que enviei há alguns dias? Só preciso saber quem responde pela compra de ${c} e qual o melhor canal para falar com essa pessoa.`,
    sig: (s, u) => ["", `${s.senderName} — ${COMPANY}`, s.postalAddress, `Para não receber mais mensagens, responda "sair" ou use este link: ${u}`],
  },
  en: {
    subject: (c) => `${c.charAt(0).toUpperCase()}${c.slice(1)} supplier`,
    hello: "Hi, I hope you're well.",
    found: "I found your contact on your website and took the liberty of sending you a quick message.",
    who: (c) => `I'm with ${COMPANY}; we trade commodities, and I would like to speak with the person responsible for purchasing ${c} at your company.`,
    ask: "Could you tell me who is responsible for this area and the best professional channel to reach them?",
    follow: (c) => `Did you get a chance to see the message I sent a few days ago? I only need to know who is responsible for purchasing ${c} and the best channel to reach them.`,
    sig: (s, u) => ["", `${s.senderName} — ${COMPANY}`, s.postalAddress, `To stop receiving these messages, reply "unsubscribe" or use this link: ${u}`],
  },
  de: {
    subject: (c) => `Lieferant für ${c}`,
    hello: "Guten Tag,",
    found: "ich habe Ihre Kontaktdaten auf Ihrer Website gefunden und schreibe Ihnen kurz.",
    who: (c) => `Ich bin bei ${COMPANY}; wir handeln mit Agrarrohstoffen, und ich möchte gern mit der Person sprechen, die bei Ihnen für den Einkauf von ${c} zuständig ist.`,
    ask: "Könnten Sie mir sagen, wer diesen Bereich verantwortet und über welchen beruflichen Kontakt ich die Person am besten erreiche?",
    follow: (c) => `haben Sie meine Nachricht von vor einigen Tagen gesehen? Mir genügt ein kurzer Hinweis, wer bei Ihnen für den Einkauf von ${c} zuständig ist und wie ich die Person am besten erreiche.`,
    sig: (s, u) => ["", `${s.senderName} — ${COMPANY}`, s.postalAddress, `Wenn Sie keine weiteren Nachrichten erhalten möchten, antworten Sie mit „abmelden“ oder nutzen Sie diesen Link: ${u}`],
  },
};

// recipients: canais gerais da empresa [{ contactId, sourceLabel }]. Mesma saída de generateSequence (passos e dias).
export function generateIdentification({ language = "pt-BR", commodity, recipients, sig, unsub }) {
  const t = TEXT[language];
  if (!t) throw new Error(`Idioma sem modelo de identificação: ${language}`);
  const out = [];
  for (const r of recipients) {
    const fromSite = /\bsite\b|website/i.test(r.sourceLabel || "");
    const e1 = [t.hello, ...(fromSite ? [t.found] : []), t.who(commodity), t.ask].join("\n");
    const e2 = [t.hello, t.follow(commodity)].join("\n");
    const tail = t.sig(sig, unsub(r.contactId)).join("\n");
    out.push({ contactId: r.contactId, role: "company_channel", channel: "email", kind: "auto_email", step: 1, day: 0, subject: t.subject(commodity), body: `${e1}\n${tail}`, objective: "identificar o responsável pela compra e o canal profissional" });
    out.push({ contactId: r.contactId, role: "company_channel", channel: "email", kind: "auto_email", step: 2, day: 5, subject: `Re: ${t.subject(commodity)}`, body: `${e2}\n${tail}`, objective: "confirmar se viu e obter a indicação" });
  }
  return out;
}
