// Modelos da /prospeccao-vendas (P2-T8, R17.1–R17.4). Textos copiados de references/scripts-abordagem.md da skill
// (SHA-256 do SKILL.md abaixo), trocando [SUA EMPRESA] por "EAG Agro" e [COMMODITY] pela commodity.
// Geração determinística: nenhum modelo de IA; o texto gerado é congelado na ficha e enviado byte a byte.
// Adaptações Compass (marcadas "A-" e revisadas por Rogério nas amostras do R17.6):
//  A-E3  E-mail 3 e mensagem ao influenciador: a skill não traz texto literal ("novo ângulo curto, mesmo pedido de conversa").
//  A-K6  Frase de volume e prova social do E-mail 1 e do Level 2 só com declaração aprovada da campanha; senão, omitidas.
//  A-PV4 "Encontrei seu contato pelo LinkedIn" só se a fonte registrada do contato for LinkedIn; site → "no site de vocês"; outra fonte → frase omitida.
//  A-D14 Break na segunda da semana 3 (dia 14), não na sexta da semana 2: a tabela da skill põe E-mail 3 e 4 em dias seguidos,
//        o que contraria a regra da própria skill e o R19.2 item 12. Vale o mais restritivo até decisão de Rogério (T12).
//  A-R19 Assinatura com endereço físico e forma de saída (R19.13, R21.7).
export const SKILL_SHA256 = "33bd093f5dcb87a7d4aa51d31597c6d6ddfc637097693e3830a38f9b219f9dd8";
export const TEMPLATES_VERSION = "pv-1.0.0";
export const GENERATOR_VERSION = "tpl-1.0.0";

const COMPANY = "EAG Agro";
const GROUP_DISPLAY = { Soja: "soja", Milho: "milho", Café: "café", Açúcar: "açúcar", Etanol: "etanol", Cereais: null };
// Nome da commodity como aparece no texto: grupo para commodities simples; variante para derivados (farelo, óleo...).
export function commodityDisplay(product) {
  const g = GROUP_DISPLAY[product.group_name];
  if (g) return g;
  const v = String(product.variant_name).split(/[;(]/)[0].trim();
  // Sigla (DDGS, CGF, UCO) fica como está; só a inicial de palavra comum vira minúscula.
  return /^[A-Z]{2,}\b/.test(v) ? v : v.charAt(0).toLowerCase() + v.slice(1);
}

function firstName(full) {
  const n = String(full || "").trim().split(/\s+/)[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : null;
}
function foundSentence(sourceLabel) {
  if (/linkedin/i.test(sourceLabel || "")) return "Encontrei seu contato pelo LinkedIn e tomei a liberdade de te enviar uma mensagem rápida.";
  if (/\bsite\b/i.test(sourceLabel || "")) return "Encontrei seu contato no site de vocês e tomei a liberdade de te enviar uma mensagem rápida.";
  return null;
}
function signature(sig, unsubUrl) {
  return [
    "",
    `${sig.senderName} — ${COMPANY}`,
    sig.postalAddress,
    `Para não receber mais mensagens, responda "sair" ou use este link: ${unsubUrl}`,
  ].join("\n");
}

// Sequência de uma ficha. recipients: [{ contactId, role, fullName, sourceLabel, linkedin?: bool }]
// declarations: { volumeAvailable: true|false|null, socialProof: string|null }
// sig: { senderName, postalAddress }; unsub: (contactId) => URL de descadastro daquele destinatário.
export function generateSequence({ commodity, recipients, declarations = {}, sig, unsub }) {
  const out = [];
  const decisors = recipients.filter((r) => r.role !== "influencer");
  const influencers = recipients.filter((r) => r.role === "influencer");
  for (const r of decisors) {
    const nome = firstName(r.fullName);
    const hello = nome ? `Olá, ${nome}, tudo bem?` : "Olá, tudo bem?";
    const found = foundSentence(r.sourceLabel);
    const volume = declarations.volumeAvailable === true;
    const proof = declarations.socialProof || null;
    const e1 = [
      hello,
      ...(found ? [found] : []),
      `Sou da ${COMPANY}; atuamos na comercialização de commodities${volume ? ` e hoje estamos com um volume relevante de ${commodity} disponível` : ""}.${proof ? ` ${proof}` : ""}`,
      `Meu objetivo neste primeiro contato é apenas iniciar uma conversa, para entender se faz sentido apresentar a ${COMPANY} como possível fornecedor para a sua empresa.`,
      "Você teria cerca de 20 minutos ainda esta semana para eu explicar rapidamente como trabalhamos?",
    ].join("\n");
    const e2 = [
      nome ? `Fala, ${nome}, tudo bem?` : "Olá, tudo bem?",
      "Você chegou a ver o e-mail que te enviei dias atrás? Não tive retorno seu. A melhor forma de falar com você é por aqui mesmo?",
    ].join("\n");
    // A-E3: ângulo curto novo, mesmo pedido de conversa.
    const e3 = [
      nome ? `Olá, ${nome}, tudo bem?` : "Olá, tudo bem?",
      `Volto a escrever porque sei que a rotina de compras é corrida. Conversamos com indústrias que utilizam ${commodity} para entender como organizam o fornecimento.`,
      "Se fizer sentido, você teria 20 minutos para uma conversa rápida nos próximos dias?",
    ].join("\n");
    const e4 = [
      nome ? `Acho que agora não é o melhor momento, ${nome}.` : "Acho que agora não é o melhor momento.",
      "Tentei entrar em contato com você algumas vezes nas últimas semanas, mas não tive retorno, nem positivo nem negativo. Imagino que você esteja com outras prioridades no momento ou envolvido em projetos mais urgentes, então não quero insistir além do necessário.",
      `A ideia do meu contato era conversarmos sobre fornecimento de ${commodity} para indústrias e entender se faria sentido apresentar como a ${COMPANY} trabalha com fornecimento estruturado, regular e previsível.`,
      "Vou encerrar por aqui para não tomar mais seu tempo. Se em algum momento esse tema fizer sentido, é só responder este e-mail.",
      "Um abraço,",
    ].join("\n");
    const sigText = signature(sig, unsub(r.contactId));
    const email = (step, day, subject, body, objective) =>
      out.push({ contactId: r.contactId, role: r.role, channel: "email", kind: "auto_email", step, day, subject, body: body + "\n" + sigText, objective });
    email(1, 0, `Fornecedor ${commodity}`, e1, "iniciar conversa e pedir 20 minutos");
    email(2, 4, `Re: Fornecedor ${commodity}`, e2, "confirmar se viu e se o canal é este");
    email(3, 10, `Fornecedor ${commodity}`, e3, "reaparecer com ângulo novo e pedir conversa");
    email(4, 14, `Fornecedor ${commodity}`, e4, "encerrar a sequência (break)");
    // Tarefas manuais da cadência (K4), com os roteiros da skill.
    const task = (step, day, channel, body, objective) =>
      out.push({ contactId: r.contactId, role: r.role, channel, kind: "manual_task", step, day, subject: null, body, objective });
    if (r.linkedin)
      task(5, 2, "linkedin", `${nome ? `Fala, ${nome}, tudo bem?` : "Olá, tudo bem?"} Te mandei um e-mail, chegou a ver?`, "reforçar o e-mail pelo LinkedIn");
    const l2 = [
      `Olá, ${nome || "[nome]"}, tudo bem? … ${/linkedin/i.test(r.sourceLabel || "") ? "Peguei seu contato no LinkedIn e " : /\bsite\b/i.test(r.sourceLabel || "") ? "Peguei seu contato no site de vocês e " : ""}queria conversar com você 5 minutos, o assunto é bem rápido. Te peguei num bom horário?`,
      `Me chamo ${sig.senderName}, sou da ${COMPANY}. Vi que a sua empresa atua na compra de ${commodity}${volume ? " e atualmente estou com um bom volume disponível para negociação" : ""}. Queria entender rapidamente se faz sentido conversarmos.`,
      "Só para saber se temos alguma sinergia entre os negócios: se eu realmente posso te ajudar, queria fazer três perguntas rápidas.",
      `— Hoje vocês compram ${commodity} direto da usina ou via trading?`,
      "— Normalmente trabalham com compras spot ou contratos mensais?",
      "— Em termos de volume, qual o consumo mensal médio de vocês?",
      "Fechamento: Podemos marcar um bate-papo por vídeo, quarta ou quinta-feira? É rápido, 20 a 30 minutos. (Confirmar o e-mail ao vivo e enviar o convite na hora.)",
    ].join("\n");
    const l1 = `Recepção: pedir para falar com ${nome || "o comprador"} ("${nome || "Ele"} está na mesa?"). Se perguntarem o assunto: "Estou em contato com ${nome || "o comprador"} por e-mail. Fala que é o ${sig.senderName}, da ${COMPANY}."\n\nSe atender (Level 2):\n${l2}`;
    task(6, 3, "call", l1, "falar com o decisor e marcar a reunião");
    task(7, 7, "call", l1, "falar com o decisor e marcar a reunião");
    task(8, 8, "call", l1 + (r.linkedin ? "\n\nSe não atender: mensagem pelo LinkedIn." : ""), "falar com o decisor e marcar a reunião");
    task(9, 11, "call", l1, "falar com o decisor e marcar a reunião");
  }
  for (const r of influencers) {
    const nome = firstName(r.fullName);
    // A-E3 (influenciador): mesmo pedido de conversa, texto diferente do enviado ao decisor (PV11).
    const body = [
      nome ? `Olá, ${nome}, tudo bem?` : "Olá, tudo bem?",
      `Sou da ${COMPANY}; atuamos na comercialização de commodities e tenho tentado falar com a área de compras de vocês sobre fornecimento de ${commodity}.`,
      "Você poderia me ajudar com 20 minutos de conversa, ou me indicar a pessoa mais adequada para tratar desse tema?",
    ].join("\n");
    out.push({
      contactId: r.contactId,
      role: r.role,
      channel: "email",
      kind: "auto_email",
      step: 3,
      day: 10,
      subject: `Fornecedor ${commodity}`,
      body: body + "\n" + signature(sig, unsub(r.contactId)),
      objective: "pedir conversa ao influenciador ou indicação",
    });
  }
  return out;
}

// Roteiro Level 0 (sem e-mail do decisor: a cadência começa pela ligação).
export const LEVEL0_SCRIPT = [
  "Recepção: Oi, é a Juliana, como posso ajudar?",
  "Você: Oi, Juliana, tudo bem? Veja se você consegue me ajudar: estou procurando o responsável pela área de compras de vocês. Encontro ele neste número ou seria outro?",
  "Se não passar o telefone: Sem problemas, entendo perfeitamente — é normal, aqui trabalhamos assim também. Vamos fazer assim: me passa o e-mail? Se ele tiver interesse, me retorna por lá mesmo, pode ser?",
  "Se o e-mail for genérico (compras@): Obrigado pelo e-mail! Só me fala uma coisa: para quem eu endereço lá no setor de compras?",
  "Nunca: \"Boa tarde, eu sou o … e trabalho na… Poderia falar com o setor de compras?\"",
].join("\n");
