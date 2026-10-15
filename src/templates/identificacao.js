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
//  A-ID6 (2026-10-09, decisão E2-b de Rogério, versão pt 1.2.0) Transparência no próprio e-mail (LGPD art. 9º e art. 10,
//        § 2º): uma linha no rodapé, antes da saída, com a origem do endereço e o canal do titular (O2). A origem só é
//        dita quando a fonte registrada do canal é o site da empresa; em outra fonte entra só o canal do titular (PV4).
//  A-ID7 (2026-10-14, texto de Rogério, versão pt 1.3.0) Só o E-mail 1 muda: "Boa tarde, tudo bem?" (com o nome só quando
//        o destinatário for pessoa com nome confirmado; canal geral nunca recebe nome inventado), apresentação como
//        franqueado da EAG Agro que trabalha com originação, o nome da empresa e o pedido de quem cuida da área e do melhor
//        canal. Nome do remetente como Rogério escreveu ("Rogerio Palhari", igual à assinatura). E-mail 2, assinatura,
//        transparência (E2-b) e descadastro não mudam.
//  A-ID8 (2026-10-14, pedido de Rogério, versão pt 1.4.0) Saudação pelo horário: o E-mail 1 que começa com "Boa tarde"
//        ganha na geração a variante "Bom dia" (só a saudação muda). As duas são revisadas e aprovadas juntas; no envio,
//        antes das 12:00 no fuso do destinatário sai "Bom dia", a partir das 12:00 sai "Boa tarde" (src/sending.js).
//  A-ID9 (2026-10-14, decisão de Rogério; Spec R28.20 e R28.21) Idioma pelo país do destinatário (src/language.js):
//        Brasil, português; demais países da América Latina, espanhol; fora da América Latina, inglês. Nunca deduzido de
//        nome ou domínio. Vale para a sequência inteira (assunto, apresentação, acompanhamento, transparência,
//        descadastro); nomes próprios, marcas e endereços não se traduzem. Só a ficha de identificação; reunião fora.
//  A-ID10 (2026-10-14) Espanhol (id-es-1.0.0) e inglês (id-en-2.0.0): textos revisados por Rogério (TEXTOS-ES-EN-PARA-
//        REVISAO.md, commit dc73a29), redação própria de cada idioma. RASCUNHOS até a aprovação expressa de Rogério
//        (parâmetro ident_templates_approved:<versão>): sem ela o revisor reprova e a ficha não é aprovável.
//  A-ID11 (2026-10-14) Origem do endereço no rodapé pelo TIPO de fonte cadastrado (contacts.source_kind, 0042), nunca pela
//        palavra "site" num rótulo livre: site da empresa → frase do site; diretório → "diretório de empresas <domínio>"
//        só com o domínio da URL registrada; sem tipo ou sem URL → nenhuma frase de origem. Português 1.5.0 (o texto das
//        fichas com fonte no site não muda).
export const IDENT_VERSION = { "pt-BR": "id-pt-1.5.0", es: "id-es-1.0.0", en: "id-en-2.0.0", de: "id-de-1.1.0" };
// Modelos que só valem depois da aprovação expressa de Rogério (A-ID10).
export const IDENT_DRAFT_LANGUAGES = new Set(["es", "en"]);
// Hora local a partir da qual a saudação é a da tarde (antes dela, a da manhã).
export const AFTERNOON_FROM = "12:00";
// Saudação da tarde → da manhã, por idioma (R28.21).
const GREETINGS = [
  ["Boa tarde", "Bom dia"],
  ["Buenas tardes", "Buenos días"],
  ["Good afternoon", "Good morning"],
];
// Variante da manhã de um texto que começa com a saudação da tarde (texto e HTML; só a primeira ocorrência, a saudação).
export function morningVariant(m) {
  const g = GREETINGS.find(([pm]) => (m.body || "").startsWith(pm) && /^[\s,:]/.test((m.body || "").slice(pm.length)));
  if (!g) return null;
  const [pm, am] = g;
  return { body: am + m.body.slice(pm.length), html: m.html ? m.html.replace(pm, am) : null };
}

import { emailParts } from "./assinatura.js";
import { DATA_REQUESTS_EMAIL } from "../privacy-contact.js";
const COMPANY = "EAG Agro";
// Rodapé separado da assinatura: endereço físico (R19.13) e forma de saída (R21.7).
const footer = (s, unsubLine, privacyLine) => (privacyLine ? [s.postalAddress, privacyLine, unsubLine] : [s.postalAddress, unsubLine]);
// Termo de mercado da commodity em alemão (sem entrada → a ficha em alemão não é gerada).
const COMMODITY_DE = { coffee: "Rohkaffee", sugar: "Zucker", soy: "Sojabohnen", corn: "Mais", soy_meal: "Sojaschrot", soy_oil: "Sojaöl", ethanol: "Ethanol" };
export const commodityDisplayDe = (product) => COMMODITY_DE[product.commodity] ?? null;
// Termo de compras da commodity em espanhol (sem entrada → a ficha em espanhol não é gerada).
const COMMODITY_ES = { coffee: "café verde", sugar: "azúcar", soy: "soja", corn: "maíz", soy_meal: "harina de soja", soy_oil: "aceite de soja", ethanol: "etanol" };
export const commodityDisplayEs = (product) => COMMODITY_ES[product.commodity] ?? null;
// Nome da empresa no texto: nome fantasia cadastrado sem o rótulo interno da unidade ("Rei do Milho — fábrica, Inhumas"
// → "Rei do Milho"); sem nome fantasia, a razão social.
export const companyDisplayName = (c) => String(c?.trade_name || c?.legal_name || "").split(" — ")[0].trim();

// Domínio da URL registrada como fonte (sem "www."); sem URL http(s) válida → null.
export function sourceDomain(url) {
  try {
    const u = new URL(String(url ?? ""));
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}
// Origem do endereço a partir do cadastro: { kind: "company_site" } | { kind: "directory", domain } | null.
export function sourceOrigin(r) {
  if (r?.sourceKind === "company_site") return { kind: "company_site" };
  if (r?.sourceKind === "directory") {
    const domain = sourceDomain(r.sourceUrl);
    return domain ? { kind: "directory", domain } : null;
  }
  return null;
}

const TEXT = {
  "pt-BR": {
    subject: (c) => `Responsável pela compra de ${c}`,
    e1: (c, s, x) => [
      x.name ? `Boa tarde, ${x.name}, tudo bem?` : "Boa tarde, tudo bem?",
      `Meu nome é Rogerio Palhari e trabalho com originação de commodities agrícolas. Atuo como franqueado da ${COMPANY} e estou buscando o contato da pessoa responsável pela compra de ${c} na ${x.company}.`,
      "Você poderia me indicar quem cuida dessa área e qual seria o melhor canal para conversar?",
      "Obrigado pela atenção.",
    ],
    e2: (c) => ["Olá,", `Retomo brevemente minha mensagem anterior. Poderia indicar com quem devo falar sobre a compra de ${c}?`, `Se a empresa não compra ${c}, uma breve confirmação já ajuda.`, "Obrigado."],
    unsub: (u) => `Para não receber mais mensagens, responda "sair" ou use este link: ${u}`,
    origin: { company_site: () => "Encontrei este endereço no site da empresa.", directory: (d) => `Encontrei este endereço no diretório de empresas ${d}.` },
    data: `Pedidos sobre dados pessoais: ${DATA_REQUESTS_EMAIL}.`,
  },
  // Espanhol (A-ID10): texto revisado por Rogério em 2026-10-14; rascunho até aprovação expressa.
  es: {
    subject: (c) => `Contacto de compras de ${c}`,
    e1: (c, s, x) => [
      x.name ? `Buenas tardes, ${x.name}:` : "Buenas tardes:",
      `Mi nombre es Rogerio Palhari. Soy franquiciado de ${COMPANY} y trabajo en la originación de commodities agrícolas en Brasil.`,
      `Estoy buscando a la persona responsable de las compras de ${c} en ${x.company}, para presentarme y conocer cómo se abastecen de este insumo.`,
      "¿Podría indicarme quién está a cargo de esa área y cuál es la mejor vía de contacto?",
      "Muchas gracias.",
    ],
    e2: (c, x) => [
      "Hola:",
      `Retomo mi correo anterior sobre las compras de ${c} de ${x.company}.`,
      "¿Podría indicarme qué persona o departamento se encarga de estas compras, o facilitarme el correo del área correspondiente?",
      `Si su empresa no compra ${c}, le agradecería que me lo indicara para actualizar mis registros.`,
      "Muchas gracias.",
    ],
    unsub: (u) => `Para dejar de recibir estos mensajes, responda "baja" o use este enlace: ${u}`,
    origin: { company_site: () => "Encontré esta dirección en el sitio web de su empresa.", directory: (d) => `Encontré esta dirección en el directorio de empresas ${d}.` },
    data: `Para solicitudes sobre datos personales: ${DATA_REQUESTS_EMAIL}.`,
  },
  // Inglês (A-ID10): texto revisado por Rogério em 2026-10-14; rascunho até aprovação expressa.
  en: {
    subject: (c) => `${c.charAt(0).toUpperCase()}${c.slice(1)} purchasing contact`,
    e1: (c, s, x) => [
      x.name ? `Good afternoon ${x.name},` : "Good afternoon,",
      `My name is Rogerio Palhari. I am an ${COMPANY} franchisee working in agricultural commodity origination in Brazil.`,
      `I am trying to reach the person responsible for ${c} procurement at ${x.company}, to introduce myself and learn how your team sources ${c}.`,
      `Could you let me know who handles ${c} purchasing and the best way to contact them?`,
      "Thank you,",
    ],
    e2: (c, x) => [
      "Hello,",
      `I’m following up on my previous email about ${c} procurement at ${x.company}.`,
      "Could you direct me to the person or department responsible, or share the appropriate purchasing email address?",
      `If your company does not purchase ${c}, please let me know so I can update my records.`,
      "Thank you,",
    ],
    unsub: (u) => `To stop receiving these messages, reply "unsubscribe" or use this link: ${u}`,
    origin: { company_site: () => "I found this address on your company's website.", directory: (d) => `I found this address in the business directory ${d}.` },
    data: `For requests about personal data: ${DATA_REQUESTS_EMAIL}.`,
  },
  de: {
    // Texto de Rogério para Rohkaffee; o substantivo composto vale para café verde. Pela R28.20 a Alemanha passa a usar
    // inglês (L3, 2026-10-14): este modelo só serve às fichas alemãs já existentes, mantidas sem alteração.
    subject: (c) => `Zuständige Person für den ${c}-Einkauf`,
    e1: (c, s) => ["Guten Tag,", `mein Name ist ${s.senderName}, ich bin bei ${COMPANY} in Brasilien tätig. Wir vermitteln Agrarrohstoffe, darunter brasilianischen ${c}.`, `Wer ist in Ihrem Unternehmen für den Einkauf von ${c} zuständig? Könnten Sie meine Nachricht bitte an die zuständige Person weiterleiten oder mir eine geeignete geschäftliche Kontaktadresse nennen?`, "Vielen Dank für Ihre Unterstützung."],
    e2: (c) => ["Guten Tag,", `ich komme kurz auf meine vorherige Nachricht zurück. Könnten Sie mir bitte mitteilen, an wen ich mich bezüglich des Einkaufs von ${c} wenden kann?`, `Falls Ihr Unternehmen keinen ${c} einkauft, genügt ein kurzer Hinweis.`, "Vielen Dank."],
    unsub: (u) => `Wenn Sie keine weiteren Nachrichten erhalten möchten, antworten Sie mit „abmelden“ oder nutzen Sie diesen Link: ${u}`,
  },
};

// Linha de transparência do rodapé (E2-b e A-ID11): origem só pelo tipo de fonte cadastrado; sempre o canal do titular.
export function privacyLine(language, r) {
  const t = TEXT[language];
  if (!t?.data) return null;
  const o = sourceOrigin(r);
  const origin = o ? t.origin[o.kind](o.domain) : null;
  return origin ? `${origin} ${t.data}` : t.data;
}
// Frases de origem do idioma (para o revisor conferir que nenhuma aparece sem a fonte cadastrada).
export const ORIGIN_START = { "pt-BR": "Encontrei este endereço", es: "Encontré esta dirección", en: "I found this address" };

// recipients: canais gerais da empresa [{ contactId, kind, sourceKind, sourceUrl }]. Mesma saída de generateSequence.
// company: nome de exibição da empresa (obrigatório em português, espanhol e inglês: o E-mail 1 cita a empresa).
// recipients[].confirmedName: só para destinatário pessoa com nome confirmado; canal geral nunca recebe nome.
export function generateIdentification({ language = "pt-BR", commodity, recipients, sig, unsub, company }) {
  const t = TEXT[language];
  if (!t) throw new Error(`Idioma sem modelo de identificação: ${language}`);
  if (language !== "de" && !(typeof company === "string" && company.trim())) throw new Error(`Nome da empresa obrigatório no E-mail 1 (${language === "pt-BR" ? "português" : language}).`);
  const out = [];
  for (const r of recipients) {
    const name = r.kind !== "company_channel" && typeof r.confirmedName === "string" && r.confirmedName.trim() ? r.confirmedName.trim() : null;
    // Nome terminado em ponto ("Ltda.") não gera ponto duplo no fim da frase.
    const x = { name, company: company?.trim().replace(/\.+$/, "") };
    const e1 = t.e1(commodity, sig, x).join("\n\n");
    const e2 = t.e2(commodity, x).join("\n\n");
    // Texto: corpo, assinatura oficial (uma vez) e rodapé separado; HTML com a assinatura original, quando importada.
    const foot = footer(sig, t.unsub(unsub(r.contactId)), privacyLine(language, r));
    // Mesmo assunto no acompanhamento: o envio não encadeia como resposta real (sem In-Reply-To/References).
    out.push({ contactId: r.contactId, role: "company_channel", channel: "email", kind: "auto_email", step: 1, day: 0, subject: t.subject(commodity), ...emailParts(e1, foot), objective: "identificar o responsável pela compra e o canal profissional" });
    out.push({ contactId: r.contactId, role: "company_channel", channel: "email", kind: "auto_email", step: 2, day: 4, subject: t.subject(commodity), ...emailParts(e2, foot), objective: "obter a indicação do responsável ou a confirmação de que não compra" });
  }
  return out;
}
