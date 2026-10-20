// Estabelecimento = unidade (não a empresa). Chave estável para deduplicar e reexecutar sem duplicidade.
// Com identificador cadastral completo: país + identificador. Sem ele: chave PROVISÓRIA por nome + município, que vira
// pendência de conciliação (nunca é tratada como unidade confirmada).
import { normalizeName } from "../geo.js";

// Regras de identificador por país (formato e raiz da empresa). País sem regra → identificador aceito como texto, sem raiz.
export const ID_RULES = {
  BR: { type: "CNPJ", normalize: (v) => String(v).replace(/\D/g, ""), valid: (v) => /^\d{14}$/.test(v), root: (v) => v.slice(0, 8) },
};

export function normalizeId(country, id) {
  if (id == null || id === "") return null;
  const r = ID_RULES[country];
  const v = r ? r.normalize(id) : String(id).trim().toUpperCase().replace(/\s+/g, "");
  return r && !r.valid(v) ? null : v || null;
}

export function establishmentKey(c) {
  const id = normalizeId(c.country, c.registrationId);
  if (id) return { key: `${c.country}:${id}`, provisional: false, root: ID_RULES[c.country]?.root(id) ?? null };
  const name = c.name ?? c.names?.[0] ?? "", municipality = c.municipality ?? c.municipalities?.[0] ?? "";
  return { key: `${c.country}:nome:${normalizeName(name)}|${normalizeName(municipality)}|${String(c.region ?? "").toUpperCase()}`, provisional: true, root: null };
}

const uniqBy = (arr, f) => [...new Map(arr.map((x) => [f(x), x])).values()];

// Junta candidatas de várias fontes no mesmo estabelecimento. Idempotente: juntar de novo a mesma entrada não duplica
// fontes nem evidências. Divergências (nome, município) ficam registradas para conciliação, sem escolher em silêncio.
export function mergeCandidates(list) {
  const map = new Map();
  for (const c of list) {
    // Aceita a candidata bruta (name/municipality) e o estabelecimento já juntado de uma rodada anterior (names/municipalities).
    const names = c.names ?? [c.name], municipalities = c.municipalities ?? [c.municipality];
    const k = establishmentKey(c);
    const cur = map.get(k.key);
    if (!cur) {
      map.set(k.key, { key: k.key, provisional: k.provisional, root: k.root, country: c.country, registrationId: normalizeId(c.country, c.registrationId), names: [...new Set(names.filter(Boolean))], municipalities: [...new Set(municipalities.filter(Boolean))], region: c.region ?? null, unit: c.unit ?? null, sources: [...(c.sources ?? [])], evidence: [...(c.evidence ?? [])], hints: { ...(c.hints ?? {}) } });
      continue;
    }
    for (const n of names) if (n && !cur.names.includes(n)) cur.names.push(n);
    for (const m of municipalities) if (m && !cur.municipalities.includes(m)) cur.municipalities.push(m);
    cur.unit = cur.unit ?? c.unit ?? null;
    cur.sources = uniqBy([...cur.sources, ...(c.sources ?? [])], (s) => `${s.id}|${s.ref ?? ""}`);
    cur.evidence = uniqBy([...cur.evidence, ...(c.evidence ?? [])], (e) => `${e.kind}|${e.url ?? ""}|${e.quote ?? ""}`);
    cur.hints = { ...cur.hints, ...(c.hints ?? {}) };
    if (c.conciliatedFrom) cur.conciliatedFrom = [...new Set([...(cur.conciliatedFrom ?? []), ...c.conciliatedFrom])];
  }
  return conciliateProvisional([...map.values()]);
}

// Nome para comparação: sem acento, caixa e sufixos societários (LTDA, S/A, EIRELI, ME, EPP).
export const nameKey = (n) => normalizeName(n ?? "").replace(/\b(ltda|s a|sa|eireli|me|epp|cia|companhia)\b/g, " ").replace(/\s+/g, " ").trim();

// Máscara pública de identificador (ex.: SIPEAGRO "**.***.379/***-**") compatível com o identificador completo?
export function idMaskMatches(country, mask, id) {
  if (!mask || !id) return true;
  if (country === "BR") {
    const m = /^\*\*\.\*\*\*\.(\d{3})\//.exec(mask);
    return !m || id.slice(5, 8) === m[1];
  }
  return true;
}

// Candidata provisória (sem identificador) com o mesmo nome e município de UMA unidade identificada é a mesma unidade:
// junta nela e registra de onde veio. Mais de uma unidade possível → continua provisória, com as opções para conciliar.
// Origem do site (sem www, http/https iguais) para ligar a candidata do mapa à identificada pelo CNPJ lido naquele site.
const siteOrigin = (w) => {
  if (!w) return null;
  try {
    return new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};
function conciliateProvisional(ests) {
  const identified = ests.filter((e) => !e.provisional);
  const out = [];
  for (const e of ests) {
    if (!e.provisional) { out.push(e); continue; }
    const names = new Set(e.names.map(nameKey).filter(Boolean)), muns = new Set(e.municipalities.map((m) => normalizeName(m)));
    const site = siteOrigin(e.hints?.website);
    const matches = identified.filter((x) => x.country === e.country && (!e.region || !x.region || String(x.region).toUpperCase() === String(e.region).toUpperCase())
      && ((x.municipalities.some((m) => muns.has(normalizeName(m))) && x.names.some((n) => names.has(nameKey(n)))) || (site && siteOrigin(x.hints?.website) === site && x.hints?.fromSite === true))
      && idMaskMatches(e.country, e.hints?.idMask, x.registrationId));
    if (matches.length !== 1) {
      if (matches.length > 1) e.hints = { ...e.hints, conciliationOptions: matches.map((x) => x.key) };
      out.push(e);
      continue;
    }
    const t = matches[0];
    for (const n of e.names) if (!t.names.includes(n)) t.names.push(n);
    t.sources = uniqBy([...t.sources, ...e.sources], (s) => `${s.id}|${s.ref ?? ""}`);
    t.evidence = uniqBy([...t.evidence, ...e.evidence], (x) => `${x.kind}|${x.url ?? ""}|${x.quote ?? ""}`);
    t.hints = { ...e.hints, ...t.hints };
    delete t.hints.idMask;
    t.conciliatedFrom = [...new Set([...(t.conciliatedFrom ?? []), e.key])];
  }
  return out;
}

// Conciliação empresa ↔ unidade ↔ identificador ↔ localização. Só registra pendências; não corrige nada sozinha.
export function conciliate(est, registryRecord) {
  const pending = [];
  if (est.provisional)
    pending.push(est.hints?.conciliationOptions?.length
      ? `Sem identificador cadastral: ${est.hints.conciliationOptions.length} unidades identificadas com o mesmo nome e município (${est.hints.conciliationOptions.join(", ")}); escolher na conciliação.`
      : "Sem identificador cadastral completo da unidade: conciliar antes de qualificar.");
  if (est.municipalities.length > 1) pending.push(`Municípios divergentes entre fontes: ${est.municipalities.join(" / ")}.`);
  if (registryRecord) {
    if (registryRecord.status && !/^ativ/i.test(registryRecord.status)) pending.push(`Situação cadastral "${registryRecord.status}": fora da qualificação ativa até mudar.`);
    const regMun = registryRecord.municipality ? normalizeName(registryRecord.municipality) : null;
    if (regMun && est.municipalities.length && !est.municipalities.some((m) => normalizeName(m) === regMun))
      pending.push(`Município do cadastro (${registryRecord.municipality}) difere das fontes (${est.municipalities.join(" / ")}).`);
  }
  return pending;
}

// Unidades da mesma empresa (mesma raiz): ficam separadas, mas ligadas, para ninguém tratar uma pela outra.
export function groupByRoot(ests) {
  const g = new Map();
  for (const e of ests) if (e.root) g.set(e.root, [...(g.get(e.root) ?? []), e.key]);
  return g;
}
