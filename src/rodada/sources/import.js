// Entrada de candidatas por importação de arquivo e por pesquisa assistida. Cada candidata leva a fonte e o modo de entrada
// (import / assisted), para o relatório separar o que veio de descoberta automática, de arquivo ou de pesquisa manual.

const ALIASES = {
  registrationId: ["registrationid", "cnpj", "identificador", "id"],
  name: ["name", "nome", "empresa"],
  municipality: ["municipality", "municipio", "município", "cidade"],
  region: ["region", "uf", "estado"],
  segment: ["segment", "segmento"],
  url: ["source_url", "fonte_url", "url", "fonte"],
  kind: ["evidence_kind", "tipo_evidencia"],
  strength: ["evidence_strength", "forca_evidencia"],
  quote: ["quote", "trecho", "evidencia"],
};
const KINDS = new Set(["operation", "commodity_use", "purchase", "resale", "trade", "restriction", "channel", "activity_code"]);
const STRENGTHS = new Set(["own_source", "official_record", "press", "academic", "directory", "search_summary", "activity_code"]);

function splitCsv(line, sep) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}
export function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const sep = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/,/g) ?? []).length ? ";" : ",";
  const head = splitCsv(lines[0], sep);
  return lines.slice(1).map((l) => Object.fromEntries(splitCsv(l, sep).map((v, i) => [head[i], v])));
}

const pick = (row, field) => {
  const keys = Object.keys(row);
  const k = keys.find((x) => ALIASES[field].includes(x.trim().toLowerCase()));
  const v = k ? String(row[k] ?? "").trim() : "";
  return v || null;
};

// format: "json" (array de candidatas) | "csv". country: país padrão da rodada. → { candidates, errors }
export function importCandidates(text, { format, country, consultedAt, label = "arquivo importado" }) {
  const errors = [];
  let rows;
  try { rows = format === "json" ? JSON.parse(text.replace(/^﻿/, "")) : parseCsv(text); } catch (e) { return { candidates: [], errors: [`Arquivo ilegível: ${e.message}`] }; }
  if (!Array.isArray(rows)) return { candidates: [], errors: ["O JSON precisa ser uma lista de candidatas."] };
  const candidates = [];
  rows.forEach((row, i) => {
    const line = i + 2;
    const isJson = format === "json";
    const name = isJson ? row.name : pick(row, "name");
    if (!name) { errors.push(`Linha ${line}: sem nome.`); return; }
    const url = isJson ? (row.sources?.[0]?.url ?? row.sourceUrl ?? null) : pick(row, "url");
    const c = isJson
      ? { ...row, country: row.country ?? country }
      : { country, name, registrationId: pick(row, "registrationId"), municipality: pick(row, "municipality"), region: pick(row, "region")?.toUpperCase() ?? null, hints: { segment: pick(row, "segment") } };
    c.sources = [...(c.sources ?? []).map((s) => ({ mode: "import", ...s })), { id: "import-file", mode: "import", ref: `${label}#${line}`, url, consultedAt }];
    if (!isJson) {
      const kind = pick(row, "kind"), strength = pick(row, "strength");
      if (kind && !KINDS.has(kind)) errors.push(`Linha ${line}: tipo de evidência "${kind}" desconhecido (ignorado).`);
      if (strength && !STRENGTHS.has(strength)) errors.push(`Linha ${line}: força "${strength}" desconhecida (vira indício).`);
      // Sem URL a evidência não comprova: entra como resumo de busca (indício).
      if (kind && KINDS.has(kind)) c.evidence = [{ kind, strength: url && STRENGTHS.has(strength) ? strength : "search_summary", url, quote: pick(row, "quote"), date: consultedAt }];
    }
    candidates.push(c);
  });
  return { candidates, errors };
}

// Pesquisa assistida: uma candidata registrada pela pessoa. Fonte (URL) obrigatória; sem ela, não entra.
export function assistedCandidate(input, { country, consultedAt, by }) {
  const errors = [];
  if (!input?.name) errors.push("Nome obrigatório.");
  if (!/^https?:\/\//.test(input?.sourceUrl ?? "")) errors.push("Fonte (URL) obrigatória na pesquisa assistida.");
  if (input?.evidence?.kind && !KINDS.has(input.evidence.kind)) errors.push("Tipo de evidência desconhecido.");
  if (input?.evidence?.strength && !STRENGTHS.has(input.evidence.strength)) errors.push("Força de evidência desconhecida.");
  if (errors.length) return { candidate: null, errors };
  const c = {
    country: input.country ?? country, name: input.name, registrationId: input.registrationId || null, municipality: input.municipality || null, region: input.region?.toUpperCase() || null,
    hints: { segment: input.segment || null },
    sources: [{ id: "assisted", mode: "assisted", ref: input.sourceUrl, url: input.sourceUrl, consultedAt, by }],
    evidence: input.evidence?.kind ? [{ kind: input.evidence.kind, strength: input.evidence.strength ?? "search_summary", url: input.sourceUrl, quote: input.evidence.quote ?? null, date: consultedAt }] : [],
  };
  return { candidate: c, errors };
}
