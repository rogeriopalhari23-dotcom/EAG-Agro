// Rascunhos da ficha de identificação do responsável (busca Alemanha/café verde) para revisão de Rogério.
// Usa o gerador e o revisor do sistema: o texto é o mesmo que a ficha produziria. Nada é enviado nem gravado no banco.
import { writeFileSync } from "node:fs";
import { generateIdentification, IDENT_VERSION } from "../src/templates/identificacao.js";
import { reviewIdentification } from "../src/review.js";

const sig = { senderName: "Rogério Palhari", postalAddress: "Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil" };
const UNSUB = "[link de descadastro próprio, gerado na ficha]";
const companies = [
  { name: "24grad Kaffeerösterei GmbH (Hannover)", channel: "info@24grad.net", source: "https://www.24grad.net/impressum/", pending: ["Responsabilidade de compra de Markus Glaubitz não demonstrada pelas fontes (contato relevante, diretor-geral).", "Porte a confirmar (bloqueia a ficha: R14.8)."] },
  { name: "AMORI Coffee (Mainz)", channel: "info@amori.coffee", source: "https://amori.coffee/policies/contact-information", pending: ["Responsabilidade de compra de Roberto Cascone (dono) não demonstrada; compra via importadores parceiros.", "Porte a confirmar (bloqueia a ficha: R14.8)."] },
  { name: "BLACK & YUM GenussRösterei (Telgte)", channel: "genuss@blackandyum.de (publicado como “genuss ∂ blackandyum.de”)", source: "https://www.blackandyum.de/kontakt/", pending: ["Responsabilidade de compra de Reinhold Schmelter (dono) não demonstrada.", "Porte a confirmar (bloqueia a ficha: R14.8)."] },
];
const lines = [
  "# Rascunhos — identificação do responsável pela compra de café verde (Alemanha)",
  "",
  `Gerado por \`scripts/rascunhos-identificacao.mjs\` com o gerador \`${IDENT_VERSION.de}\` e o revisor do sistema. **Rascunho para revisão: nada foi enviado.** Não inclui preço, lote, volume nem condição comercial. Destino: canal geral publicado de cada empresa (não é pessoa). Envio só depois de: modelo alemão aprovado por Rogério lado a lado com o português (ID0), porte resolvido (R14.8), campanha ativa, internacional liberado e aprovação individual da ficha.`,
  "",
];
for (const c of companies) {
  const msgs = generateIdentification({ language: "de", commodity: "Rohkaffee", recipients: [{ contactId: "canal", sourceLabel: "Canal geral publicado no site da empresa (site)" }], sig, unsub: () => UNSUB });
  const review = reviewIdentification(msgs, { market: "international", recipients: [{ contactId: "canal", kind: "company_channel", sourceLabel: "site" }], postalAddress: sig.postalAddress, unsubUrl: () => UNSUB, language: "de", languageGapNote: "lacuna", templatesVersion: IDENT_VERSION.de, translationApproved: false });
  lines.push(`## ${c.name}`, "", `Canal: ${c.channel} — fonte: ${c.source}`, "");
  for (const m of msgs) lines.push(`**E-mail ${m.step} (dia ${m.day}) — Assunto: ${m.subject}**`, "", "```", m.body, "```", "");
  lines.push(`Revisor: ${review.findings.filter((x) => !x.ok).map((x) => `${x.id} — ${x.detail}`).join("; ") || "sem pendências"}`, "", "Pendências da empresa:", ...c.pending.map((p) => `- ${p}`), "");
}
lines.push(
  "## Tradução literal para revisão (igual para as três empresas)",
  "",
  "E-mail 1 — Assunto: Fornecedor de café verde. “Bom dia, / encontrei seus dados de contato no site de vocês e escrevo rapidamente. / Sou da EAG Agro; trabalhamos com commodities agrícolas e gostaria de falar com a pessoa responsável pela compra de café verde na empresa de vocês. / Poderiam me dizer quem responde por essa área e por qual contato profissional consigo falar melhor com essa pessoa?” + assinatura com endereço físico e forma de saída.",
  "",
  "E-mail 2 (dia 5) — “Bom dia, / chegaram a ver minha mensagem de alguns dias atrás? Basta uma indicação rápida de quem responde pela compra de café verde e como falar melhor com essa pessoa.”",
  "",
);
writeFileSync(new URL("../docs/implementation/RASCUNHOS-IDENTIFICACAO-DEU.md", import.meta.url), lines.join("\n"));
console.log(lines.join("\n"));
