#!/usr/bin/env node
// Gera docs/implementation/AMOSTRAS-TEXTOS-EN.md: português e inglês lado a lado para Rogério aprovar a tradução (P3-T9).
// Determinístico: mesmos destinatários fictícios, mesma assinatura; nenhum dado real.
import { writeFileSync } from "node:fs";
import { generateSequence, LEVEL0_SCRIPT, SKILL_SHA256, TEMPLATES_VERSION } from "../src/templates/prospeccao-vendas.js";
import { generateSequenceEn, LEVEL0_SCRIPT_EN, TEMPLATES_EN_VERSION, GAP_NOTE } from "../src/templates/prospeccao-vendas-en.js";

const recipients = [
  { contactId: "decisor", role: "decision_maker", fullName: "Anna Weber", sourceLabel: "LinkedIn", linkedin: true },
  { contactId: "influenciador", role: "influencer", fullName: "Jonas Keller", sourceLabel: "site" },
];
const sig = { senderName: "Rogério Palhari", postalAddress: "[endereço físico da EAG — EAG_POSTAL_ADDRESS]" };
const unsub = (id) => `https://compass.exemplo/u/<token-${id}>`;
const cases = [
  { title: "Sem declarações de volume", declarations: {} },
  { title: "Com volume disponível declarado (A-K6)", declarations: { volumeAvailable: true, socialProof: "Atendemos indústrias de alimentos no Sudeste." } },
];
const block = (lang, m) => [`**${lang}**${m.subject ? ` — assunto: \`${m.subject}\`` : ""}`, "", "```text", m.body, "```", ""].join("\n");

const out = [
  "# Amostras lado a lado — tradução para o inglês (P3-T9)",
  "",
  `Gerado por \`scripts/amostras-en.mjs\`. Skill \`/prospeccao-vendas\` SHA-256 \`${SKILL_SHA256.slice(0, 8)}…\`; modelos \`${TEMPLATES_VERSION}\` (português) e \`${TEMPLATES_EN_VERSION}\` (inglês).`,
  "",
  "**Portão humano (Plano 3 T9):** a tradução só vale depois que Rogério aprovar este documento. Até lá toda ficha em inglês sai com PV12 reprovado e não pode ser aprovada. Para liberar, depois da aprovação por escrito, o admin grava o parâmetro `templates_en_approved` no escopo `" + TEMPLATES_EN_VERSION + "` com `{\"enabled\":true,\"evidenceRef\":\"docs/implementation/AMOSTRAS-TEXTOS-EN.md#aprovacao\"}`.",
  "",
  "Decisões a conferir:",
  "- A-EN1: a prova social declarada (texto em português) **não** entra no e-mail em inglês, para não misturar idiomas. Se Rogério quiser prova social no internacional, precisa de uma declaração em inglês.",
  "- \"usina\" traduzido por \"mill\" na pergunta do Level 2 (\"directly from the mill or through a trading company?\").",
  "- Saudação \"Olá, <nome>, tudo bem?\" → \"Hi <nome>, I hope you're well.\"; break \"Um abraço,\" → \"Best regards,\".",
  "- Nomes das commodities em inglês: termos de mercado (soybean, soybean meal, cottonseed meal, corn gluten feed, used cooking oil…); CSO sem nome em inglês (identidade pendente) — a ficha não é gerada.",
  "",
  `Lacuna registrada em toda ficha internacional: _${GAP_NOTE}_`,
  "",
];
for (const c of cases) {
  const pt = generateSequence({ commodity: "café", recipients, declarations: c.declarations, sig, unsub });
  const en = generateSequenceEn({ commodity: "coffee", recipients, declarations: c.declarations, sig, unsub });
  out.push(`## ${c.title}`, "");
  pt.forEach((m, i) => {
    const e = en[i];
    const who = m.contactId === "decisor" ? "Decisor" : "Influenciador";
    out.push(`### ${who} — passo ${m.step}, dia ${m.day}, ${m.channel === "email" ? "e-mail" : m.channel === "call" ? "ligação" : "LinkedIn"}`, "", block("Português", m), block("English", e));
  });
}
out.push("## Level 0 (sem e-mail do decisor)", "", block("Português", { body: LEVEL0_SCRIPT }), block("English", { body: LEVEL0_SCRIPT_EN }));
// Aprovação vale só para a versão aprovada; versão nova dos modelos volta a exigir aprovação.
const APPROVALS = { "pv-en-1.0.0": 'Aprovada por Rogério Palhari em 2026-09-24, na conversa do Claude Code (resposta "aprovado", opção "Tradução em inglês"). Registro: docs/implementation/EVIDENCIAS.md e parâmetro templates_en_approved (migração 0016).' };
out.push("## Aprovação", "", APPROVALS[TEMPLATES_EN_VERSION] ? `- [x] ${APPROVALS[TEMPLATES_EN_VERSION]}` : "- [ ] Rogério aprova a tradução (data, canal e texto da aprovação):", "- [ ] Correções pedidas: nenhuma registrada.", "");
writeFileSync(new URL("../docs/implementation/AMOSTRAS-TEXTOS-EN.md", import.meta.url), out.join("\n"));
console.log("ok");
