// Administração do teste interno da ponte (produção) com a identidade de Rogério no Access (cloudflared; nenhum token é
// impresso). Registros em docs/implementation/teste-interno-ponte/registros.json (IDs, sem credenciais).
// Uso: node bridge/scripts/teste-interno-admin.mjs <supressao|criar-caso-link|encerrar|estado>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const B = "https://eag-compass-production.rogeriopalhari23.workers.dev";
const REG = new URL("../../docs/implementation/teste-interno-ponte/registros.json", import.meta.url);
const CLOUDFLARED = process.env.CLOUDFLARED || "C:/Program Files (x86)/cloudflared/cloudflared.exe";
const reg = JSON.parse(readFileSync(REG, "utf8"));
const save = () => writeFileSync(REG, JSON.stringify(reg, null, 2) + "\n");
const out = (o) => console.log(JSON.stringify(o));

// "access token" só devolve um token já existente; não abre login (seguro para tarefa agendada sem janela).
let T;
try {
  T = execFileSync(CLOUDFLARED, ["access", "token", `-app=${B}`], { encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (!/^ey/.test(T)) throw new Error("sem token");
} catch {
  out({ erro: "sessão do Access indisponível", acao: `rode: cloudflared access login ${B}` });
  process.exit(3);
}
const api = async (path, method = "GET", body) => {
  const r = await fetch(B + path, { method, headers: { "cf-access-token": T, origin: B, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const j = await r.json().catch(() => null);
  if (r.status >= 300) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j?.error ?? j).slice(0, 200)}`);
  return j.data ?? j;
};
const internos = ["rogeriopalhari23@gmail.com", ...Object.values(reg.casos).map((c) => c.destinatario).filter((e) => e.startsWith("rogeriopalhari23+"))];

const modo = process.argv[2];
if (modo === "supressao") {
  out(await api("/api/integrations/suppression/check", "POST", { internalEmails: internos }));
} else if (modo === "criar-caso-link") {
  // Caso D: alias exclusivo para o teste de descadastro por link.
  if (reg.casos.D) {
    out({ ok: true, jaExiste: reg.casos.D.ficha });
  } else {
    const email = "rogeriopalhari23+ponte-link@gmail.com";
    const co = await api("/api/companies", "POST", { legalName: "TESTE INTERNO EAG D — ponte de e-mail, descadastro por link (não é prospect)", countryCode: "BR", sourceLabel: "teste interno da ponte (2026-09-30)" });
    await api(`/api/companies/${co.id}/profiles`, "POST", { productId: "product-06", profileClass: "possible_final_consumer", basis: "Registro de teste interno da ponte de e-mail" });
    const p = (await api(`/api/companies/${co.id}/profiles`)).items[0];
    await api(`/api/profiles/${p.id}`, "PATCH", { sizeCallGoal: true, expectedRevision: p.revision });
    await api(`/api/companies/${co.id}/screening`, "POST", {});
    const ct = await api(`/api/companies/${co.id}/contacts`, "POST", { fullName: "Rogério Teste D", email, prospectRole: "decision_maker", sourceLabel: "teste interno", timezone: "America/Cuiaba" });
    reg.casos.D = { destinatario: email, empresa: co.id, contato: ct.id, perfil: p.id, ficha: null };
    save();
    out({ ok: true, etapa: "contato criado; marcar validação interna no D1 e rodar criar-caso-link de novo para a ficha", contato: ct.id });
  }
} else if (modo === "ficha-link") {
  const c = reg.casos.D;
  if (!c.ficha) {
    const f = await api("/api/fichas", "POST", { companyId: c.empresa, campaignId: reg.campanha, recipients: [c.contato] });
    c.ficha = f.id;
    save();
  }
  const f = await api(`/api/fichas/${c.ficha}`);
  const x = f.toApprove.find((a) => a.channel === "email" && a.contactId === c.contato);
  if (x) await api(`/api/fichas/${c.ficha}/approve`, "POST", { versionNo: f.version.no, contactId: c.contato, channel: "email", messagesSha256: x.messagesSha256, startDate: "2026-10-01" });
  out({ ok: true, ficha: c.ficha, aprovada: !!x });
} else if (modo === "encerrar") {
  // Descarta as fichas de teste (cancela a fila), encerra a campanha de teste e devolve o canal ao estado anterior.
  const res = { fichas: {} };
  for (const [k, c] of Object.entries(reg.casos)) {
    if (!c.ficha) continue;
    try {
      await api(`/api/fichas/${c.ficha}/discard`, "POST", { reason: "Encerramento do teste interno da ponte de e-mail (01/10/2026)" });
      res.fichas[k] = "descartada";
    } catch (e) {
      res.fichas[k] = String(e.message).includes("ficha_discarded") ? "já descartada" : String(e.message).slice(0, 120);
    }
  }
  const camp = await api(`/api/campaigns/${reg.campanha}`);
  const c = camp.campaign ?? camp;
  if (c.status !== "ended") await api(`/api/campaigns/${reg.campanha}`, "PATCH", { status: "ended", expectedVersion: c.version });
  res.campanha = "encerrada";
  await api("/api/channels/email/state", "POST", { state: reg.canalAntes, evidenceRef: "Fim do teste interno da ponte (01/10/2026)" });
  res.canal = reg.canalAntes;
  reg.encerradoEm = new Date().toISOString();
  save();
  out(res);
} else if (modo === "reabrir-canal") {
  // Só para o teste interno, antes do prazo: canal volta a "internal_test" (o Compass recusa destinatário fora da lista).
  if (reg.encerradoEm) throw new Error("teste já encerrado");
  await api("/api/channels/email/state", "POST", { state: "internal_test", evidenceRef: "Teste interno da ponte (reabertura antes do prazo)" });
  out({ canal: "internal_test" });
} else if (modo === "estado") {
  const camp = await api(`/api/campaigns/${reg.campanha}`);
  const ch = await api("/api/channels");
  out({ campanha: (camp.campaign ?? camp).status, canal: (Array.isArray(ch) ? ch : ch.items).find((x) => x.channel === "email")?.state });
} else {
  console.log("Modos: supressao | criar-caso-link | ficha-link | encerrar | reabrir-canal | estado");
  process.exitCode = 2;
}
