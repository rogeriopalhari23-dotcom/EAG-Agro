// Adaptação EXPLÍCITA de formatos antigos do piloto para o fluxo geral. Nunca reescreve o arquivo original: devolve um
// objeto novo, com a origem registrada, para ser salvo em outro arquivo. Tudo o que vem do formato antigo entra como
// indício até ser reconfirmado (o arquivo antigo não guarda a força de cada prova).
import { parseCsv } from "./sources/import.js";

const FALTA = /^(não encontrad[oa]|não consultad[oa]|não pesquisado|—|-|)$/i;
const clean = (v) => (v == null || FALTA.test(String(v).trim()) ? null : String(v).trim());

// docs/implementation/descoberta-milho-indiara/candidatas.csv (planilha de 06/10/2026) → candidatas da rodada.
export function adaptLegacyCandidatesCsv(text, { country = "BR", file, adaptedAt }) {
  const rows = parseCsv(text);
  if (!rows.length || !("Empresa — unidade (nome)" in rows[0])) throw new Error("Não é a planilha antiga de candidatas (coluna \"Empresa — unidade (nome)\" ausente).");
  return rows.map((r, i) => {
    const [mun, uf] = String(r["Município da unidade"] ?? "").split("/").map((x) => x?.trim());
    const cnpj = clean(r["CNPJ da unidade"]);
    const ref = `${file}#${i + 2}`;
    const evidence = [];
    const detail = clean(r["Detalhe e fonte da evidência"]);
    if (detail) evidence.push({ kind: "commodity_use", strength: "search_summary", url: null, quote: `[formato antigo] ${detail}`.slice(0, 1000), date: adaptedAt });
    const activity = clean(r["CNAE principal (Receita)"]);
    if (activity) evidence.push({ kind: "activity_code", strength: "activity_code", url: null, quote: activity, date: adaptedAt });
    return {
      country, name: clean(r["Empresa — unidade (nome)"]), registrationId: cnpj && /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/.test(cnpj) ? cnpj : null,
      municipality: clean(mun), region: clean(uf),
      hints: { legacyRole: clean(r["Papel"]), legacyMatch: clean(r["Possível correspondência (a conciliar)"]), legacyAlert: clean(r["Alerta"]) },
      sources: [{ id: "legacy-candidatas-csv", mode: "import", ref, consultedAt: adaptedAt, note: "adaptado do formato antigo; provas a reconfirmar" }],
      evidence,
    };
  }).filter((c) => c.name);
}

// Lote antigo de cadastro (ex.: cadastro-lote-aceito.json de 06/10/2026, sem "produto" e com ligação de nível 0)
// → lote no formato atual. O produto precisa ser informado (não há padrão). A ligação de nível 0 é retirada e registrada
// (o piloto é só por e-mail); a decisão original é preservada em "rastreio".
export function adaptLegacyBatch(json, { produto, file, adaptedAt, adaptedBy }) {
  if (!produto) throw new Error("Informe o produto (variante do catálogo): o formato antigo não declara e não há padrão.");
  if (!Array.isArray(json?.empresas)) throw new Error("Lote antigo sem a lista \"empresas\".");
  if (json.produto && json.produto !== produto) throw new Error(`O lote já declara o produto "${json.produto}"; adaptação recusada para não trocar em silêncio.`);
  const removed = [];
  const empresas = json.empresas.map((e) => {
    const { level0, ...rest } = e;
    if (level0) removed.push(e.chave);
    return {
      ...rest,
      rastreio: { mode: "legacy", originalFile: file, originalDecision: json.aceite ?? null, originalConsultedAt: json.consultadoEm ?? null, adaptedAt, adaptedBy: adaptedBy ?? null, removedLevel0: Boolean(level0) },
    };
  });
  return {
    aceite: json.aceite ?? null,
    produto,
    adaptacao: { from: file, at: adaptedAt, by: adaptedBy ?? null, notes: removed.length ? [`Ligação de nível 0 retirada de: ${removed.join(", ")} (piloto só por e-mail).`] : [] },
    empresas,
  };
}
