// Decisores e canais por empresa (só leitura), para a lista de empresas, o resumo da empresa e os resultados da prospecção.
// Situação de cada pessoa:
//   confirmado   — contato com identidade ou autoridade de compra registrada como confirmada (contact_verifications);
//   identificado — contato aceito com papel de comprador (decisor, decisor provisório ou influenciador), sem confirmação;
//   a validar    — pessoa encontrada numa fonte permitida e ainda não aceita (person_candidates).
// Canal geral da empresa (contact_kind = company_channel) fica à parte: nunca aparece como contato pessoal de comprador.
// Mesma visibilidade do detalhe da empresa (que já mostra os contatos decriptados); nada é deduzido nem validado aqui.
import { decryptPii } from "./crypto.js";

const ROLE_LABEL = { decision_maker: "decisor", provisional_decision_maker: "decisor provisório", influencer: "influenciador", other: "outro papel" };
const BUYER_ROLES = new Set(["decision_maker", "provisional_decision_maker", "influencer"]);
const STATUS_RANK = { confirmado: 0, identificado: 1, "a validar": 2 };
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function rowsFor(env, tenant, ids) {
  const contacts = [], verif = [], cands = [];
  for (const part of chunks(ids, 50)) {
    const q = part.map(() => "?").join(",");
    contacts.push(...(await env.DB.prepare(`SELECT id,company_id,contact_kind,prospect_role,full_name_encrypted,job_title_encrypted,email_encrypted,phone_encrypted,source_url,source_label,source_kind,email_validation FROM contacts WHERE tenant_id=? AND company_id IN (${q})`).bind(tenant, ...part).all()).results);
    cands.push(...(await env.DB.prepare(`SELECT id,company_id,name_encrypted,title_encrypted,email_encrypted,phone_encrypted,role_suggestion,source_kind,source_url,verified_at FROM person_candidates WHERE tenant_id=? AND company_id IN (${q}) AND status='to_validate'`).bind(tenant, ...part).all()).results);
  }
  const cids = contacts.map((c) => c.id);
  for (const part of chunks(cids, 50))
    if (part.length) verif.push(...(await env.DB.prepare(`SELECT contact_id,verification_type FROM contact_verifications WHERE tenant_id=? AND status='confirmed' AND verification_type IN ('identity','decision_authority') AND contact_id IN (${part.map(() => "?").join(",")})`).bind(tenant, ...part).all()).results);
  return { contacts, verif, cands };
}

// → Map(companyId → { people: [...], channels: [...], summary })
export async function decisorsFor(env, tenant, ids) {
  const out = new Map(ids.map((id) => [id, { people: [], channels: [] }]));
  if (!ids.length) return out;
  const { contacts, verif, cands } = await rowsFor(env, tenant, ids);
  const confirmed = new Set(verif.map((v) => v.contact_id));
  for (const c of contacts) {
    const [name, title, email, phone] = await Promise.all([c.full_name_encrypted, c.job_title_encrypted, c.email_encrypted, c.phone_encrypted].map((x) => decryptPii(x, env)));
    const box = out.get(c.company_id);
    if (c.contact_kind === "company_channel") {
      box.channels.push({ email: email || null, phone: phone || null, sourceUrl: c.source_url, sourceLabel: c.source_label, emailValidation: c.email_validation ?? null });
      continue;
    }
    box.people.push({ kind: "contact", id: c.id, name: name || null, title: title || null, email: email || null, phone: phone || null, role: c.prospect_role ?? null, roleLabel: ROLE_LABEL[c.prospect_role] ?? "papel não informado", buyer: BUYER_ROLES.has(c.prospect_role), status: confirmed.has(c.id) ? "confirmado" : "identificado", sourceUrl: c.source_url, sourceLabel: c.source_label, emailValidation: c.email_validation ?? null });
  }
  for (const p of cands) {
    const [name, title, email, phone] = await Promise.all([p.name_encrypted, p.title_encrypted, p.email_encrypted, p.phone_encrypted].map((x) => decryptPii(x, env)));
    out.get(p.company_id).people.push({ kind: "candidate", id: p.id, name: name || null, title: title || null, email: email || null, phone: phone || null, role: p.role_suggestion, roleLabel: ROLE_LABEL[p.role_suggestion] ?? "papel sugerido", buyer: BUYER_ROLES.has(p.role_suggestion), status: "a validar", sourceUrl: p.source_url, sourceLabel: p.source_kind, verifiedAt: p.verified_at });
  }
  for (const box of out.values()) {
    box.people.sort((a, b) => (b.buyer ? 1 : 0) - (a.buyer ? 1 : 0) || STATUS_RANK[a.status] - STATUS_RANK[b.status] || String(a.name).localeCompare(String(b.name), "pt-BR"));
    const main = box.people.find((x) => x.buyer) ?? null;
    box.summary = main ? { name: main.name, title: main.title, status: main.status, roleLabel: main.roleLabel } : null;
    box.hasChannel = box.channels.length > 0 || box.people.some((x) => x.email || x.phone);
  }
  return out;
}

// Empresas cuja pessoa vinculada (contato ou candidata) tem nome, e-mail ou telefone que contém a busca, ou cujo canal
// geral tem esse e-mail ou telefone.
// Os dados pessoais estão cifrados: a busca decifra no servidor e devolve só os ids das empresas.
export async function companiesMatchingPeople(env, tenant, query, limit = 5000) {
  const q = fold(query).trim();
  if (q.length < 2) return [];
  const digits = String(query).replace(/\D/g, "");
  const ids = new Set();
  const rows = (await env.DB.prepare("SELECT company_id,contact_kind,full_name_encrypted,email_encrypted,phone_encrypted FROM contacts WHERE tenant_id=? LIMIT ?").bind(tenant, limit).all()).results;
  const cands = (await env.DB.prepare("SELECT company_id,name_encrypted full_name_encrypted,email_encrypted,phone_encrypted FROM person_candidates WHERE tenant_id=? AND status<>'dismissed' LIMIT ?").bind(tenant, limit).all()).results;
  for (const r of [...rows, ...cands]) {
    if (ids.has(r.company_id)) continue;
    const [name, email, phone] = await Promise.all([r.full_name_encrypted, r.email_encrypted, r.phone_encrypted].map((x) => decryptPii(x, env)));
    // Canal geral: só e-mail e telefone contam (o nome dele não é de pessoa).
    const byName = r.contact_kind !== "company_channel" && fold(name).includes(q);
    if (byName || fold(email).includes(q) || (digits.length >= 4 && String(phone ?? "").replace(/\D/g, "").includes(digits))) ids.add(r.company_id);
  }
  return [...ids];
}
