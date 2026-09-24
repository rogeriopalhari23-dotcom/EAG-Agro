// Gera docs/implementation/AMOSTRAS-TEXTOS-PV.md (R17.6): amostras internas para revisão de Rogério.
// Determinístico: os mesmos modelos usados nas fichas. Nomes, empresa e endereço são fictícios.
import { writeFile } from "node:fs/promises";
import { generateSequence, SKILL_SHA256, TEMPLATES_VERSION, GENERATOR_VERSION } from "../src/templates/prospeccao-vendas.js";
import { reviewSequence } from "../src/review.js";

const sig = { senderName: "Rogério Palhari", postalAddress: "[ENDEREÇO FÍSICO DA EAG — definir EAG_POSTAL_ADDRESS]" };
const unsub = (id) => `https://compass.exemplo/u/token-${id}`;
const cases = [
  {
    title: "Consumidor final, sem declarações (caso padrão)",
    declarations: {},
    recipients: [
      { contactId: "decisor", role: "decision_maker", fullName: "Maria Souza", sourceLabel: "Site da empresa", jobTitle: "Gerente de Compras", linkedin: true },
      { contactId: "influenciador", role: "influencer", fullName: "João Lima", sourceLabel: "LinkedIn", jobTitle: "Coordenador de Suprimentos" },
    ],
  },
  {
    title: "Com declarações aprovadas (volume disponível e prova social — K6)",
    declarations: { volumeAvailable: true, socialProof: "[TEXTO DE PROVA SOCIAL APROVADO PELA CAMPANHA]" },
    recipients: [{ contactId: "decisor", role: "decision_maker", fullName: "Carlos Pereira", sourceLabel: "LinkedIn", jobTitle: "Comprador", linkedin: true }],
  },
];
let out = `# Amostras de texto — revisão de Rogério (R17.6)

Geradas por \`scripts/gen-amostras-pv.mjs\` com os modelos que as fichas usam. Skill \`${SKILL_SHA256.slice(0, 8)}…\`, modelos \`${TEMPLATES_VERSION}\`, gerador \`${GENERATOR_VERSION}\`. Pessoas, empresa e endereço são fictícios.

**O que precisa da sua revisão:**
1. **E-mail 3 e mensagem ao influenciador (A-E3):** a skill não traz texto literal; o texto abaixo é adaptação do Compass.
2. **Break na segunda da semana 3 (A-D14):** a tabela da skill põe E-mail 3 (quinta) e E-mail 4 (sexta) em dias seguidos, contra a regra "nunca e-mail em dias seguidos". Mantive o mais restritivo.
3. **Assinatura (A-R19):** endereço físico e forma de saída em todo e-mail.
4. **Frase de origem do contato (A-PV4):** "pelo LinkedIn" só quando a fonte registrada é o LinkedIn; "no site de vocês" quando é o site; nas demais, a frase sai.

Ainda faltam as amostras "sequência interrompida antes do break" (depende do envio real) e o caso internacional em inglês (Plano 3).
`;
for (const c of cases) {
  const msgs = generateSequence({ commodity: "açúcar", recipients: c.recipients, declarations: c.declarations, sig, unsub });
  const review = reviewSequence(msgs, {
    market: "national",
    commodity: "açúcar",
    otherCommodities: ["milho", "soja", "café", "etanol"],
    declarations: c.declarations,
    recipients: c.recipients,
    postalAddress: sig.postalAddress,
    unsubUrl: unsub,
  });
  out += `\n## ${c.title}\n\nRevisor PV: ${review.ok ? "sem violações" : review.findings.filter((f) => !f.ok).map((f) => `${f.id}: ${f.detail}`).join("; ")}.\n`;
  for (const m of msgs.sort((a, b) => a.day - b.day || a.step - b.step)) {
    out += `\n### Dia ${m.day} — ${m.kind === "auto_email" ? "E-mail" : m.channel === "call" ? "Ligação (tarefa)" : "LinkedIn (tarefa)"} ${m.step} → ${m.role === "influencer" ? "influenciador" : "decisor"}\n\n`;
    if (m.subject) out += `**Assunto:** ${m.subject}\n\n`;
    out += m.body.split("\n").map((l) => `> ${l}`).join("\n") + "\n";
  }
}
// Aprovação vale só para a versão aprovada dos modelos.
const APPROVALS = { "pv-1.1.0": 'Aprovadas por Rogério Palhari em 2026-09-24, na conversa do Claude Code ("ok", confirmado como "Sim, aprovo os textos"), com as adaptações A-E3, A-D14, A-K6, A-PV4, A-R19 e a nova A-G1 (break sem gênero, escolhida por ele na mesma resposta).' };
out += `
## Aprovação

${APPROVALS[TEMPLATES_VERSION] ? `- [x] ${APPROVALS[TEMPLATES_VERSION]}` : "- [ ] Aguardando aprovação de Rogério."}
`;
await writeFile("docs/implementation/AMOSTRAS-TEXTOS-PV.md", out);
console.log("Amostras geradas.");
