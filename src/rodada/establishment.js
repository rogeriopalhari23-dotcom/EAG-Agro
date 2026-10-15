// Estabelecimento = unidade (não a empresa). Chave estável para deduplicar e reexecutar sem duplicidade.
// Com identificador cadastral completo: país + identificador. Sem ele: chave PROVISÓRIA por nome + município, que vira
// pendência de conciliação (nunca é tratada como unidade confirmada).
import { normalizeName } from "../geo.js";

// Regras de identificador por país (formato e raiz da empresa). País sem regra → identificador aceito como texto, sem raiz.
const ID_RULES = {
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
  }
  return [...map.values()];
}

// Conciliação empresa ↔ unidade ↔ identificador ↔ localização. Só registra pendências; não corrige nada sozinha.
export function conciliate(est, registryRecord) {
  const pending = [];
  if (est.provisional) pending.push("Sem identificador cadastral completo da unidade: conciliar antes de qualificar.");
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
