// Teste interno mínimo da cópia D5-a (14/10/2026, autorizado por Rogério): uma mensagem original a um alias interno e a
// cópia separada a outro alias interno. Só registros fictícios ("TESTE INTERNO … não é prospect") e endereços da lista
// interna, não suprimidos. Nenhum token é impresso. IDs em docs/implementation/teste-interno-ponte/registros.json.
// Uso: node bridge/scripts/teste-copia-d5a.mjs <preparar|abrir|estado|encerrar>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const B = "https://eag-compass-production.rogeriopalhari23.workers.dev";
const REG = new URL("../../docs/implementation/teste-interno-ponte/registros.json", import.meta.url);
const CLOUDFLARED = process.env.CLOUDFLARED || "C:/Program Files (x86)/cloudflared/cloudflared.exe";
const ORIGINAL = "rogeriopalhari23+ponte-a@gmail.com";
const COPIA = "rogeriopalhari23+ponte-b@gmail.com";
const JANELA_ORIGINAL = { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] }; // valor vigente em 14/10/2026
const reg = JSON.parse(readFileSync(REG, "utf8"));
const save = () => writeFileSync(REG, JSON.stringify(reg, null, 2) + "\n");
const out = (o) => console.log(JSON.stringify(o));
const T = execFileSync(CLOUDFLARED, ["access", "token", `-app=${B}`], { encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "pipe"] }).trim();
const api = async (path, method = "GET", body) => {
  const r = await fetch(B + path, { method, headers: { "cf-access-token": T, origin: B, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const j = await r.json().catch(() => null);
  if (r.status >= 300) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j?.error ?? j).slice(0, 300)}`);
  return j.data ?? j;
};
const hojeCuiaba = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date());
const param = (key, scope, value, reason) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason });

const modo = process.argv[2];
if (modo === "preparar") {
  if (reg.casos.H) {
    out({ ok: true, jaExiste: reg.casos.H });
  } else {
    const co = await api("/api/companies", "POST", { legalName: "TESTE INTERNO EAG H — cópia interna D5-a (não é prospect)", countryCode: "BR", sourceLabel: "teste interno da cópia D5-a (2026-10-14)" });
    await api(`/api/companies/${co.id}/profiles`, "POST", { productId: "product-06", profileClass: "possible_final_consumer", basis: "Registro de teste interno da cópia D5-a" });
    const p = (await api(`/api/companies/${co.id}/profiles`)).items[0];
    await api(`/api/profiles/${p.id}`, "PATCH", { sizeCallGoal: true, expectedRevision: p.revision });
    await api(`/api/companies/${co.id}/screening`, "POST", {});
    const ct = await api(`/api/companies/${co.id}/contacts`, "POST", { fullName: "Rogério Teste H", email: ORIGINAL, prospectRole: "decision_maker", sourceLabel: "teste interno", timezone: "America/Cuiaba" });
    reg.casos.H = { destinatario: ORIGINAL, copia: COPIA, empresa: co.id, contato: ct.id, perfil: p.id, ficha: null, cenario: "D5-a" };
    save();
    out({ ok: true, etapa: "contato criado; marcar validação interna no D1 e rodar abrir", empresa: co.id, contato: ct.id });
  }
} else if (modo === "abrir") {
  const c = reg.casos.H;
  if (!c) throw new Error("rode preparar antes");
  const motivo = "Teste interno da cópia D5-a (14/10/2026), autorizado por Rogério; restaurar ao final";
  await param("send_window", "national", { start: "00:00", end: "23:59", weekdays: [1, 2, 3, 4, 5, 6, 7] }, `${motivo}: janela alargada temporariamente`);
  await param("email_copy_to", "email", { enabled: true, address: COPIA, contractRef: "Teste interno D5-a com alias interno; não é o e-mail de vendas da EAG" }, motivo);
  const camp = await api(`/api/campaigns/${reg.campanha}`);
  const cc = camp.campaign ?? camp;
  if (cc.status !== "active") await api(`/api/campaigns/${reg.campanha}/activate`, "POST", { expectedVersion: cc.version });
  await api("/api/channels/email/state", "POST", { state: "internal_test", evidenceRef: "Teste interno da cópia D5-a (14/10/2026), autorizado por Rogério" });
  if (!c.ficha) {
    const f = await api("/api/fichas", "POST", { companyId: c.empresa, campaignId: reg.campanha, recipients: [c.contato] });
    c.ficha = f.id;
    save();
  }
  const f = await api(`/api/fichas/${c.ficha}`);
  const x = f.toApprove.find((a) => a.channel === "email" && a.contactId === c.contato);
  if (x) await api(`/api/fichas/${c.ficha}/approve`, "POST", { versionNo: f.version.no, contactId: c.contato, channel: "email", messagesSha256: x.messagesSha256, startDate: hojeCuiaba() });
  reg.testeD5a = { abertoEm: new Date().toISOString() };
  save();
  out({ ok: true, janela: "alargada", copia: COPIA, campanha: "ativa", canal: "internal_test", ficha: c.ficha, aprovadaSoEmail: !!x, inicio: hojeCuiaba() });
} else if (modo === "estado") {
  const c = reg.casos.H;
  const f = await api(`/api/fichas/${c.ficha}`);
  out({ ficha: f.ficha.status, copiaInterna: f.internalCopy, envios: f.outbox.map((o) => ({ passo: o.step_no, status: o.status, motivo: o.block_reason, copia: o.copy })) });
} else if (modo === "encerrar") {
  const c = reg.casos.H;
  const res = {};
  if (c?.ficha) {
    try {
      await api(`/api/fichas/${c.ficha}/discard`, "POST", { reason: "Encerramento do teste interno da cópia D5-a (14/10/2026)" });
      res.ficha = "descartada";
    } catch (e) {
      res.ficha = String(e.message).includes("ficha_discarded") ? "já descartada" : String(e.message).slice(0, 160);
    }
  }
  await param("email_copy_to", "email", { enabled: false }, "Fim do teste interno da cópia D5-a (14/10/2026): cópia desligada");
  await param("send_window", "national", JANELA_ORIGINAL, "Fim do teste interno da cópia D5-a (14/10/2026): janela restaurada");
  const camp = await api(`/api/campaigns/${reg.campanha}`);
  const cc = camp.campaign ?? camp;
  if (cc.status !== "ended") await api(`/api/campaigns/${reg.campanha}`, "PATCH", { status: "ended", expectedVersion: cc.version });
  await api("/api/channels/email/state", "POST", { state: "planned", evidenceRef: "Fim do teste interno da cópia D5-a (14/10/2026)" });
  reg.testeD5a = { ...(reg.testeD5a || {}), encerradoEm: new Date().toISOString() };
  save();
  out({ ...res, copia: "desligada", janela: "restaurada", campanha: "encerrada", canal: "planned" });
} else {
  console.log("Modos: preparar | abrir | estado | encerrar");
  process.exitCode = 2;
}
