// Revisão da ficha de identificação do responsável (busca Alemanha/café verde), para Rogério aprovar textos e fichas.
// Usa o gerador e o revisor do sistema: o texto é o mesmo que a ficha produziria. Nada é enviado nem gravado no banco.
import { writeFileSync } from "node:fs";
import { generateIdentification, IDENT_VERSION } from "../src/templates/identificacao.js";
import { reviewIdentification } from "../src/review.js";

const sig = { senderName: "Rogério Palhari", postalAddress: "Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil" };
const UNSUB = "[link de descadastro próprio, gerado na ficha]";
const rec = [{ contactId: "canal", sourceLabel: "Canal geral publicado no site da empresa (site)" }];
// Português só como referência lado a lado (a campanha da Alemanha envia em alemão); "café verde" = Rohkaffee.
const de = generateIdentification({ language: "de", commodity: "Rohkaffee", recipients: rec, sig, unsub: () => UNSUB });
const pt = generateIdentification({ language: "pt-BR", commodity: "café verde", recipients: rec, sig, unsub: () => UNSUB });
const review = reviewIdentification(de, { market: "international", recipients: [{ contactId: "canal", kind: "company_channel", sourceLabel: "site" }], postalAddress: sig.postalAddress, unsubUrl: () => UNSUB, language: "de", languageGapNote: "lacuna", templatesVersion: IDENT_VERSION.de });
const cell = (s) => s.replace(/\|/g, "\\|");
const side = (a, b) => {
  const la = a.split("\n"), lb = b.split("\n");
  return ["| Alemão (enviado) | Português (referência) |", "| --- | --- |", ...la.map((x, i) => `| ${cell(x) || " "} | ${cell(lb[i] ?? "") || " "} |`)].join("\n");
};
const companies = [
  { name: "24grad Kaffeerösterei GmbH (Hannover)", to: "info@24grad.net", src: "https://www.24grad.net/impressum/", mx: "10 www53.your-server.de", size: "Desconhecido. North Data: GmbH, capital social EUR 25.000; porte/funcionários só no serviço pago. Indício não oficial: página \"Über uns\" lista 48 primeiros nomes (café + torrefação)." },
  { name: "AMORI Coffee (Mainz)", to: "info@amori.coffee", src: "https://amori.coffee/policies/contact-information", mx: "10 mx00.udag.de, 20 mx01.udag.de", size: "Desconhecido. Empresa individual (\"Inh. Roberto Cascone\"); nenhuma fonte pública de funcionários ou faturamento." },
  { name: "BLACK & YUM GenussRösterei (Telgte)", to: "genuss@blackandyum.de (publicado como \"genuss ∂ blackandyum.de\")", src: "https://www.blackandyum.de/kontakt/", mx: "0 mail.blackandyum.de", size: "Desconhecido. Impressum: \"Rechtsform Einzelunternehmen\"; nenhuma fonte pública de funcionários ou faturamento." },
];
const lines = [
  "# Revisão — ficha de identificação do responsável pela compra de café verde (Alemanha)",
  "",
  `Gerado por \`scripts/rascunhos-identificacao.mjs\` (modelo \`${IDENT_VERSION.de}\`, revisor do sistema). **Nada foi enviado nem aprovado.** Textos de Rogério (versão 1.1.0, 30/09/2026). Sequência: **um destinatário** (o canal geral publicado da empresa) e **dois passos** — dia 0 e dia 4, mesmo assunto (o envio não encadeia como resposta, então sem "Re:"). Endereço da assinatura sem confirmação registrada de Rogério (pendência).`,
  "",
  `Revisor (regras da Spec aplicáveis): ${review.findings.map((x) => `${x.id} ${x.ok ? "ok" : "falha"}`).join(" · ")}`,
  "",
];
for (const [i, m] of de.entries()) lines.push(`## E-mail ${m.step} — dia ${m.day}`, "", `Assunto: **${m.subject}** — referência: **${pt[i].subject}**`, "", side(m.body, pt[i].body), "");
lines.push("## Por empresa", "", "| Empresa | Destinatário (fonte oficial) | MX (DNS, 30/09/2026) | Entregabilidade | Porte (fonte) |", "| --- | --- | --- | --- | --- |");
for (const c of companies) lines.push(`| ${c.name} | ${cell(c.to)} — ${c.src} | ${c.mx} | não verificada (verificador exigido por R19.2 item 11) | ${cell(c.size)} |`);
lines.push("");
writeFileSync(new URL("../docs/implementation/RASCUNHOS-IDENTIFICACAO-DEU.md", import.meta.url), lines.join("\n"));
console.log(lines.join("\n"));
