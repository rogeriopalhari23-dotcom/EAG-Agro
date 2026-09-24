// Leitores dos arquivos oficiais das listas semeadas (P2-T16): OFAC SDN (SDN.CSV + ALT.CSV) e CGU CEIS/CNEP
// (Portal da Transparência). Formatos conferidos nos arquivos reais em 2026-09-24 (EVIDENCIAS, P2-T16).
// Saída no formato de POST /api/sanctions/versions/:id/entries. Leitura determinística; nenhuma inferência.
// Pessoas físicas ficam de fora por padrão: a triagem é de empresas e o tratamento de PII aguarda a política T11.

// CSV com aspas (RFC 4180): campo entre aspas pode ter separador, aspas dobradas e quebra de linha.
export function parseCsv(text, sep = ",") {
  const rows = [];
  let row = [], field = "", quoted = false, i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else field += c;
      i++;
      continue;
    }
    if (c === '"' && field.trim() === "") {
      quoted = true;
      field = "";
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\x1a" && i === n - 1) {
      // Marca de fim de arquivo (SUB) no final do SDN.CSV.
    } else field += c;
    i++;
  }
  if (quoted) throw new Error("CSV com aspas não fechadas: arquivo truncado.");
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

const ofacNull = (v) => {
  const t = String(v ?? "").trim();
  return t === "-0-" || t === "" ? null : t;
};

// OFAC SDN: SDN.CSV sem cabeçalho, 12 colunas (ent_num, SDN_Name, SDN_Type, Program, Title, Call_Sign, Vess_type,
// Tonnage, GRT, Vess_flag, Vess_owner, Remarks); ALT.CSV com 5 (ent_num, alt_num, alt_type, alt_name, alt_remarks).
// ent_num é identificador da OFAC, não registro de empresa: vai em `raw`, nunca em officialEntityId (evita bloqueio
// por coincidência numérica com CNPJ/registro). OFAC casa por nome → revisão humana.
export function parseOfac(sdnText, altText, { includeIndividuals = false } = {}) {
  const sdn = parseCsv(sdnText, ",");
  const alt = parseCsv(altText, ",");
  for (const r of sdn) if (r.length !== 12) throw new Error(`SDN.CSV: linha com ${r.length} colunas (esperado 12) — layout mudou.`);
  for (const r of alt) if (r.length !== 5) throw new Error(`ALT.CSV: linha com ${r.length} colunas (esperado 5) — layout mudou.`);
  const aliases = new Map();
  for (const [ent, , type, name] of alt) {
    const nm = ofacNull(name);
    if (!nm) continue;
    (aliases.get(ent.trim()) || aliases.set(ent.trim(), []).get(ent.trim())).push({ type: ofacNull(type), name: nm });
  }
  const entries = [];
  const skipped = { individuals: 0 };
  for (const r of sdn) {
    const [ent, name, type, program] = r.map(ofacNull);
    if (!ent || !name) throw new Error("SDN.CSV: registro sem número ou nome.");
    const entityType = type ? type.toLowerCase() : "entity";
    if (entityType === "individual" && !includeIndividuals) {
      skipped.individuals++;
      continue;
    }
    entries.push({
      primaryName: name,
      aliases: (aliases.get(ent) || []).map((a) => a.name).slice(0, 29),
      entityType,
      program: program ? program.slice(0, 200) : null,
      raw: { source: "ofac_sdn", entNum: ent },
    });
  }
  return { entries, skipped, total: sdn.length };
}

// CGU CEIS/CNEP (Portal da Transparência): CSV com ";" em windows-1252, cabeçalho com nomes fixos.
const CGU_REQUIRED = ["CADASTRO", "CÓDIGO DA SANÇÃO", "TIPO DE PESSOA", "CPF OU CNPJ DO SANCIONADO", "NOME DO SANCIONADO", "NOME INFORMADO PELO ÓRGÃO SANCIONADOR", "RAZÃO SOCIAL - CADASTRO RECEITA", "NOME FANTASIA - CADASTRO RECEITA", "CATEGORIA DA SANÇÃO", "DATA INÍCIO SANÇÃO", "DATA FINAL SANÇÃO", "ÓRGÃO SANCIONADOR"];
export function decodeLatin(bytes) {
  return new TextDecoder("windows-1252").decode(bytes);
}
export function parseCgu(text, list, { includeIndividuals = false } = {}) {
  const rows = parseCsv(text, ";");
  const head = rows.shift()?.map((h) => h.trim()) ?? [];
  const col = Object.fromEntries(CGU_REQUIRED.map((h) => [h, head.indexOf(h)]));
  const missing = CGU_REQUIRED.filter((h) => col[h] < 0);
  if (missing.length) throw new Error(`${list}: cabeçalho sem ${missing.join(", ")} — layout mudou.`);
  const entries = [];
  const skipped = { individuals: 0, otherList: 0 };
  for (const r of rows) {
    if (r.length !== head.length) throw new Error(`${list}: linha com ${r.length} colunas (esperado ${head.length}).`);
    const get = (h) => (r[col[h]] ?? "").trim();
    if (get("CADASTRO").toUpperCase() !== list) {
      skipped.otherList++;
      continue;
    }
    const person = get("TIPO DE PESSOA").toUpperCase();
    if (person === "F" && !includeIndividuals) {
      skipped.individuals++;
      continue;
    }
    const doc = get("CPF OU CNPJ DO SANCIONADO").replace(/\D/g, "");
    const names = [get("NOME DO SANCIONADO"), get("RAZÃO SOCIAL - CADASTRO RECEITA"), get("NOME INFORMADO PELO ÓRGÃO SANCIONADOR"), get("NOME FANTASIA - CADASTRO RECEITA")].filter(Boolean);
    const unique = [...new Set(names)];
    if (!unique.length) throw new Error(`${list}: sanção ${get("CÓDIGO DA SANÇÃO")} sem nome.`);
    entries.push({
      primaryName: unique[0],
      aliases: unique.slice(1),
      // CNPJ com 14 dígitos é identificador oficial comparável ao registro da empresa (país BR).
      officialEntityId: person === "J" && /^\d{14}$/.test(doc) ? doc : null,
      countryCode: "BR",
      entityType: person === "J" ? "entity" : "individual",
      program: get("CATEGORIA DA SANÇÃO").slice(0, 200) || null,
      raw: { source: list.toLowerCase(), code: get("CÓDIGO DA SANÇÃO"), start: get("DATA INÍCIO SANÇÃO") || null, end: get("DATA FINAL SANÇÃO") || null, authority: get("ÓRGÃO SANCIONADOR").slice(0, 200) },
    });
  }
  return { entries, skipped, total: rows.length };
}

// Lotes para a API: até 300 registros e abaixo de ~60 KB de JSON por requisição (limite de 64 KB).
export function batches(entries, maxCount = 300, maxBytes = 60000) {
  const out = [];
  let cur = [], size = 20;
  for (const e of entries) {
    const len = new TextEncoder().encode(JSON.stringify(e)).length + 1;
    if (len + 20 > maxBytes) throw new Error(`Registro grande demais para um lote: ${e.primaryName.slice(0, 60)}`);
    if (cur.length && (cur.length >= maxCount || size + len > maxBytes)) {
      out.push(cur);
      cur = [];
      size = 20;
    }
    cur.push(e);
    size += len;
  }
  if (cur.length) out.push(cur);
  return out;
}
