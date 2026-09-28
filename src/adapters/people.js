// Fontes gratuitas e permitidas de pessoas ligadas a compras (2026-09-28):
// - Impressum (DE/AT/CH): aviso legal obrigatório no site da própria empresa (TMG/DDG §5) — Geschäftsführer, Inhaber,
//   "vertreten durch"; telefone e e-mail publicados. Respeita robots.txt; no máximo 5 requisições por empresa.
// - QSA da Receita Federal via BrasilAPI (Brasil, por CNPJ): sócios e administradores com a qualificação; matriz/filial,
//   município, telefone e e-mail do cadastro (o e-mail do cadastro costuma ser do contador — marcado como "registry").
// Nada vem do LinkedIn: automação e extração são proibidas pelo User Agreement §8.2 (linkedin.com/help, a1341387).
// Nenhum e-mail é deduzido de padrão de domínio: só o que está publicado na fonte, com a URL.
import { AdapterError } from "./errors.js";

const UA = "EAG-Compass/0.3 (+uso interno EAG Agro)";
const TIMEOUT = 15000;

async function get(url, fetchImpl, accept = "text/html") {
  let r;
  try {
    r = await fetchImpl(url, { headers: { "User-Agent": UA, Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT) });
  } catch {
    return { status: 0, url, text: "" };
  }
  return { status: r.status, url: r.url || url, text: r.ok ? await r.text() : "" };
}

// robots.txt: bloqueia se algum Disallow do grupo "*" (ou do nosso agente) cobre o caminho.
// Grupos (linhas User-agent seguidas), curingas "*" e "$" como no RFC 9309; a regra mais longa vence, Allow no empate.
export function robotsAllows(robots, path) {
  if (!robots) return true;
  let group = null;
  let inAgents = false;
  const rules = [];
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [k, v] = [m[1].toLowerCase(), m[2].trim()];
    if (k === "user-agent") {
      if (!inAgents) group = false;
      inAgents = true;
      if (v === "*" || /eag-compass/i.test(v)) group = true;
      continue;
    }
    inAgents = false;
    if (group && (k === "disallow" || k === "allow") && v) rules.push({ allow: k === "allow", path: v });
  }
  const matches = (p) => {
    const end = p.endsWith("$");
    const body = (end ? p.slice(0, -1) : p).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${body}${end ? "$" : ""}`).test(path);
  };
  const hit = rules.filter((r) => matches(r.path)).sort((a, b) => b.path.length - a.path.length || b.allow - a.allow)[0];
  return !hit || hit.allow;
}

const lines = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d|td|tr)>/gi, "\n").replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;/g, "–").split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);

const MARKER = /(gesch(ä|ae)ftsf(ü|ue)hr(er|erin|ung|ende[rn]?)?|vertreten durch|vertretungsberechtigt\w*|inhaber(in|\/in)?|vorstand|gesch(ä|ae)ftsleitung)/i;
const NAME_WORD = /^(?:[A-ZÄÖÜ][a-zäöüßéèáàóòíìçñ'-]+|[A-Z]\.)$/;
const ACADEMIC = /^(?:dipl\.?(?:-[a-zäöü]+\.?)?|kfm\.?|kffr\.?|ing\.?|dr\.?|prof\.?|mag\.?|herr|frau|mba)\s+/i;
// Palavras que aparecem perto do marcador mas não são nome (visto em 2026-09-28: "Systemen. Inhalte", "Radbruch Nachfolger").
const STOP = /\d|@|register|\bhr[ab]\b|\bust\b|steuer|\btel\b|telefon|\bfax\b|mail|www|http|straße|\bstr\.|gmbh|\bkg\b|\bag\b|e\.k\.|verantwortlich|haftung|impressum|kontakt|anschrift|\bsitz\b|amtsgericht|nachfolger|inhalt|rechte|system|gesellschaft|kaffee|rösterei|roesterei|\bfirma\b|\bmarken?\b|bank\b|sparkasse|iban|\bbic\b|aufsichtsrat/i;
function asName(s) {
  let t = s.replace(/^[:\-–\s]+/, "").replace(/^(den|die|der)\s+(unternehmer(in)?|gesch(ä|ae)ftsf(ü|ue)hrer(in)?|inhaber(in)?)\s+/i, "").trim();
  while (ACADEMIC.test(t)) t = t.replace(ACADEMIC, "");
  const comma = /^([A-ZÄÖÜ][\wäöüß'-]+),\s*([A-ZÄÖÜ][\wäöüß'-]+)$/.exec(t);
  if (comma) t = `${comma[2]} ${comma[1]}`;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 4 || STOP.test(t) || !words.every((w) => NAME_WORD.test(w))) return null;
  return t;
}
// Nomes depois do marcador: no resto da linha e nas até 3 linhas seguintes (separados por vírgula, "und", "&").
export function parseImpressum(html) {
  const ls = lines(html);
  const people = [];
  for (let i = 0; i < ls.length && people.length < 3; i++) {
    const m = MARKER.exec(ls[i]);
    // Marcador no começo da linha (rótulo do aviso legal), não no meio de texto jurídico ("Inhaber der Rechte…").
    if (!m || (m.index > 25 && !/vertreten durch/i.test(m[0]))) continue;
    const title = m[0].replace(/:$/, "");
    const rest = ls[i].slice(m.index + m[0].length).replace(/^[\s:/in]*:?/i, "");
    const chunks = [rest, ...ls.slice(i + 1, i + 4)];
    for (const chunk of chunks) {
      if (chunk !== rest && (MARKER.test(chunk) || STOP.test(chunk))) break;
      // "Konstantinova, Natalia" é um nome (sobrenome, nome); vírgula só separa pessoas quando cada parte tem 2+ palavras.
      const parts = chunk.split(/\s*[|;]\s*/).flatMap((seg) => (asName(seg) ? [seg] : seg.split(/\s*(?:,|\bund\b|&|\/)\s*/)));
      for (const p of parts) {
        const n = asName(p);
        if (n && !people.some((x) => x.name === n) && people.length < 3) people.push({ name: n, title });
      }
    }
  }
  const text = ls.join("\n");
  const phone = /(?:tel(?:efon)?\.?|phone|fon)\s*:?\s*(\+?[\d][\d\s/().-]{6,}\d)/i.exec(text)?.[1]?.trim() ?? null;
  const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(text)?.[0] ?? null;
  return { people, phone, email };
}

// Localiza o Impressum no site da própria empresa (caminho padrão ou link da página inicial).
export async function impressumPeople(website, fetchImpl = fetch) {
  let origin;
  try {
    origin = new URL(website).origin;
  } catch {
    throw new AdapterError("invalid_request", "Site da empresa inválido.");
  }
  let requests = 1;
  const robots = await get(`${origin}/robots.txt`, fetchImpl, "text/plain");
  for (const path of ["/impressum", "/impressum/", "/de/impressum"]) {
    if (!robotsAllows(robots.text, path)) return { status: "blocked_by_robots", requests, url: origin + path, people: [] };
    requests++;
    const r = await get(origin + path, fetchImpl);
    if (r.status === 200 && /impressum/i.test(r.text)) return { status: "ok", requests, url: r.url, ...parseImpressum(r.text) };
    if (requests >= 3) break;
  }
  requests++;
  const home = await get(origin + "/", fetchImpl);
  const href = /href="([^"]*(?:impressum|imprint|legal-notice)[^"]*)"/i.exec(home.text)?.[1];
  if (!href) return { status: "not_found", requests, url: origin, people: [] };
  const target = new URL(href, origin + "/").toString();
  if (!robotsAllows(robots.text, new URL(target).pathname)) return { status: "blocked_by_robots", requests, url: target, people: [] };
  requests++;
  const r = await get(target, fetchImpl);
  return r.status === 200 ? { status: "ok", requests, url: r.url, ...parseImpressum(r.text) } : { status: "not_found", requests, url: target, people: [] };
}

// QSA e dados da unidade pelo CNPJ (BrasilAPI, gratuita, dados abertos da Receita).
const DECIDERS = /s(ó|o)cio-administrador|^administrador|diretor|presidente|titular/i;
export async function brasilApiCnpj(cnpj, fetchImpl = fetch) {
  const digits = String(cnpj).replace(/\D/g, "");
  if (digits.length !== 14) throw new AdapterError("invalid_request", "CNPJ inválido.");
  const url = `https://brasilapi.com.br/api/cnpj/v1/${digits}`;
  const r = await get(url, fetchImpl, "application/json");
  if (r.status === 404) return { status: "not_found", url, people: [] };
  if (r.status !== 200) throw new AdapterError(r.status === 429 || r.status >= 500 || r.status === 0 ? "temporary" : "invalid_request", `BrasilAPI: resposta ${r.status || "sem conexão"}.`);
  const d = JSON.parse(r.text);
  const people = (d.qsa ?? [])
    .map((q) => ({ name: String(q.nome_socio ?? "").trim(), title: String(q.qualificacao_socio ?? "").trim() }))
    .filter((q) => q.name && DECIDERS.test(q.title))
    .slice(0, 3);
  const phone = d.ddd_telefone_1 ? String(d.ddd_telefone_1).replace(/\D/g, "") : null;
  return {
    status: "ok", url, people, phone, email: d.email ? String(d.email).toLowerCase() : null,
    unit: { headOffice: Number(d.identificador_matriz_filial) === 1, municipalityIbge: d.codigo_municipio_ibge ?? null, municipality: d.municipio ?? null, uf: d.uf ?? null, cnae: d.cnae_fiscal ?? null, situation: d.descricao_situacao_cadastral ?? null },
  };
}

export const PEOPLE_REFRESH_DAYS = { impressum: 180, registry_qsa: 90, manual: 365, linkedin_manual: 180, company_site: 180, directory: 180 };
