// Importação do arquivo público do MAPA SIPEAGRO (estabelecimentos registrados; dados abertos, CSV com ";").
// Colunas: UF;MUNICIPIO;NUMERO_REGISTRO_ESTABELECIMENTO;STATUS_DO_REGISTRO;CPF_CNPJ;RAZAO_SOCIAL;AREA_ATUACAO;ATIVIDADE;CLASSIFICACAO
// O CNPJ vem MASCARADO ("**.***.379/***-**"): a candidata entra provisória, com a máscara para conciliar.
// Filtra pela área calculada da rodada (UF + município) e pelas regras do segmento
// (config.commodity.segments[seg].discovery.sipeagro = { activity: [...], classification: [...] }).
// Registro ativo indica a atividade; não prova uso da commodity nem compra.
import { normalizeName } from "../../geo.js";

const HEAD = ["UF", "MUNICIPIO", "NUMERO_REGISTRO_ESTABELECIMENTO", "STATUS_DO_REGISTRO", "CPF_CNPJ", "RAZAO_SOCIAL", "ATIVIDADE", "CLASSIFICACAO"];
const up = (s) => normalizeName(s).toUpperCase();

export function parseSipeagro(text) {
  const [head, ...lines] = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const cols = head.split(";").map((x) => x.trim().toUpperCase());
  const missing = HEAD.filter((h) => !cols.includes(h));
  if (missing.length) throw new Error(`Arquivo SIPEAGRO sem as colunas: ${missing.join(", ")}.`);
  const ix = Object.fromEntries(cols.map((c, i) => [c, i]));
  return lines.map((l) => {
    const p = l.split(";");
    return { uf: p[ix.UF]?.trim(), municipio: p[ix.MUNICIPIO]?.trim(), registro: p[ix.NUMERO_REGISTRO_ESTABELECIMENTO]?.trim(), status: p[ix.STATUS_DO_REGISTRO]?.trim(), cnpjMask: p[ix.CPF_CNPJ]?.trim(), name: p[ix.RAZAO_SOCIAL]?.trim(), activity: p[ix.ATIVIDADE]?.trim(), classification: p[ix.CLASSIFICACAO]?.trim() };
  });
}

// area: resultado de roundArea (municípios da rodada). → { candidates, skipped: { outsideArea, inactive, noRule, cpf } }
export function sipeagroToCandidates(text, { config, area, sourceUrl, consultedAt }) {
  const rows = parseSipeagro(text);
  const inArea = new Set(area.municipalities.map((m) => `${m.region}|${normalizeName(m.name)}`));
  const rules = Object.entries(config.commodity.segments ?? {}).filter(([, v]) => v?.discovery?.sipeagro);
  const skipped = { outsideArea: 0, inactive: 0, noRule: 0, cpf: 0 };
  const byReg = new Map();
  for (const r of rows) {
    if (!inArea.has(`${r.uf}|${normalizeName(r.municipio)}`)) { skipped.outsideArea++; continue; }
    if (!/^ativo/i.test(r.status ?? "")) { skipped.inactive++; continue; }
    // Pessoa física (CPF) fica fora: a rodada trata estabelecimentos de empresa.
    if (!/\//.test(r.cnpjMask ?? "")) { skipped.cpf++; continue; }
    const seg = rules.find(([, v]) => (!v.discovery.sipeagro.activity || v.discovery.sipeagro.activity.map(up).includes(up(r.activity))) && (!v.discovery.sipeagro.classification || v.discovery.sipeagro.classification.map(up).includes(up(r.classification))));
    if (!seg) { skipped.noRule++; continue; }
    const cur = byReg.get(r.registro) ?? { r, segment: seg[0], activities: new Set() };
    cur.activities.add(`${r.activity} ${r.classification}`);
    byReg.set(r.registro, cur);
  }
  const candidates = [...byReg.values()].map(({ r, segment, activities }) => ({
    country: "BR", name: r.name, municipality: r.municipio, region: r.uf,
    hints: { segment, idMask: r.cnpjMask, sipeagroRegistry: r.registro },
    sources: [{ id: "mapa-sipeagro", mode: "import", ref: `${r.registro}`, consultedAt, url: sourceUrl }],
    evidence: [{ kind: "activity_code", strength: "activity_code", url: sourceUrl, quote: `SIPEAGRO ${r.registro} (${r.status}): ${[...activities].join("; ")}`, date: consultedAt }],
  }));
  return { candidates, skipped, rows: rows.length };
}
