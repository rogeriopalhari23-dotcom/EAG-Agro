// Conciliação pelo site da própria empresa (fonte própria, gratuita, baixo volume): CNPJ publicado e canal geral.
// Lê no máximo a página inicial e uma página de contato, respeita o robots.txt e o tamanho máximo, e só aceita:
//   - CNPJ com dígitos verificadores válidos (a confirmação de nome e município fica com a consulta à Receita);
//   - e-mail genérico do próprio domínio (contato@, vendas@, compras@…), nunca e-mail com nome de pessoa.
// Nada é inventado: página fora do ar, sem CNPJ ou sem e-mail vira pendência com o motivo.
const UA = "eag-compass-prospeccao/1.0 (uso pessoal, baixo volume; respeita robots.txt)";
const MAX_BYTES = 400_000;
const TIMEOUT_MS = 10_000;
const CONTACT_PATHS = ["/contato", "/contact", "/fale-conosco", "/contatos"];
const GENERIC = /^(contato|contatos|contact|comercial|vendas|sales|compras|purchasing|suprimentos|atendimento|sac|faleconosco|fale|info|informacoes|adm|administrativo|financeiro|geral|office|hello|ola)$/i;

export function validCnpj(raw) {
  const d = String(raw).replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n) => {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((a, x, i) => a + x * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
export function extractCnpjs(html) {
  const out = new Set();
  for (const m of String(html).matchAll(/\b(\d{2})\.?(\d{3})\.?(\d{3})\s*\/?\s*(\d{4})\s*-?\s*(\d{2})\b/g)) {
    const d = m.slice(1).join("");
    if (validCnpj(d)) out.add(d);
  }
  return [...out];
}
export function extractGenericEmails(html, host) {
  const domain = String(host).replace(/^www\./, "").toLowerCase();
  const out = new Set();
  for (const m of String(html).matchAll(/(?:mailto:)?([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi)) {
    const local = m[1].toLowerCase(), dom = m[2].toLowerCase();
    if (!(dom === domain || dom.endsWith(`.${domain}`) || domain.endsWith(`.${dom}`))) continue; // só do próprio domínio
    if (!GENERIC.test(local.replace(/[._-]/g, ""))) continue; // só canal geral; nome de pessoa fica de fora
    out.add(`${local}@${dom}`);
  }
  return [...out];
}

async function get(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: { "user-agent": UA, accept: "text/html,text/plain" }, redirect: "follow", signal: AbortSignal.timeout?.(TIMEOUT_MS) });
  if (!res.ok) return { status: res.status, text: null };
  const type = res.headers.get("content-type") ?? "";
  if (!/text\/html|text\/plain/i.test(type)) return { status: res.status, text: null, skipped: "tipo" };
  const text = (await res.text()).slice(0, MAX_BYTES);
  return { status: res.status, text, url: res.url || url };
}
// robots.txt simples: respeita Disallow do agente "*" (ou do nosso) para o caminho pedido.
function allowedByRobots(robots, path) {
  if (!robots) return true;
  let applies = false;
  const rules = [];
  for (const line of robots.split(/\r?\n/)) {
    const [k, ...v] = line.split(":");
    const key = k.trim().toLowerCase(), val = v.join(":").trim();
    if (key === "user-agent") applies = val === "*" || /eag-compass/i.test(val);
    else if (applies && key === "disallow" && val) rules.push(val);
  }
  return !rules.some((r) => path.startsWith(r));
}

// → { pages:[url], cnpjs:[], emails:[{email,url}], pending?:texto }
export async function readCompanySite(website, fetchImpl = fetch) {
  let origin;
  try {
    const u = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    if (!["http:", "https:"].includes(u.protocol)) return { pages: [], cnpjs: [], emails: [], pending: "endereço do site inválido" };
    origin = u.origin;
  } catch {
    return { pages: [], cnpjs: [], emails: [], pending: "endereço do site inválido" };
  }
  let robots = null;
  try {
    const r = await get(fetchImpl, `${origin}/robots.txt`);
    robots = r.text;
  } catch {}
  const pages = [], cnpjs = new Set(), emails = new Map();
  const visit = async (path) => {
    if (!allowedByRobots(robots, path)) return "robots";
    try {
      const r = await get(fetchImpl, `${origin}${path}`);
      if (!r.text) return `HTTP ${r.status}`;
      pages.push(r.url);
      for (const c of extractCnpjs(r.text)) cnpjs.add(c);
      for (const e of extractGenericEmails(r.text, new URL(origin).host)) if (!emails.has(e)) emails.set(e, r.url);
      return "ok";
    } catch (e) {
      return e?.name === "TimeoutError" ? "tempo esgotado" : "fora do ar";
    }
  };
  const home = await visit("/");
  if (!cnpjs.size || !emails.size)
    for (const p of CONTACT_PATHS) {
      const r = await visit(p);
      if (r === "ok") break;
    }
  const pending = !pages.length ? `site sem resposta (${home})` : !cnpjs.size ? "CNPJ não publicado nas páginas lidas" : null;
  return { pages, cnpjs: [...cnpjs], emails: [...emails].map(([email, url]) => ({ email, url })), pending };
}
