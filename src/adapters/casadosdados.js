// Casa dos Dados — Pesquisa Avançada v5 (P2-T3).
// Contrato: https://docs.casadosdados.com.br/pesquisa-avan%C3%A7ada-de-empresas-16579062e0.md
// e esquemas CNPJPesquisaSolicitacao / CNPJPesquisaResposta (consultados em 2026-09-23).
// - POST https://api.casadosdados.com.br/v5/cnpj/pesquisa?tipo_resultado=completo, cabeçalho api-key.
//   Sem tipo_resultado=completo a resposta é "simples" (sem endereço).
// - Filtros usados: codigo_atividade_principal[], incluir_atividade_secundaria, codigo_atividade_secundaria[],
//   situacao_cadastral ["ATIVA"], mei.excluir_optante (K1), uf[] e municipio[] (nome em minúsculas sem acento), limite ≤ 1000, pagina ≥ 1.
// - Respostas: 200 {total, cnpjs[]}; 400 inválida; 401 chave; 403 sem saldo. Limite de requisições não documentado.
// - A resposta não traz CNAE nem marca de MEI; o quadro societário (nome/CPF de sócios) é descartado (minimização).
import { AdapterError, httpError, fetchJson } from "./errors.js";

export const SOURCE = "casadosdados:v5";
const URL_SEARCH = "https://api.casadosdados.com.br/v5/cnpj/pesquisa?tipo_resultado=completo";
export const PAGE_LIMIT = 1000;

const digits = (v) => String(v ?? "").replace(/\D/g, "");
const norm = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const MAX_MUNICIPALITIES = 25;
// municipalities: lista de nomes oficiais da mesma UF (vazia/ausente = UF inteira).
export function requestBody({ cnaes, uf, municipalities = [], page, limit = PAGE_LIMIT }) {
  if (!Array.isArray(cnaes) || !cnaes.length || cnaes.some((c) => !/^\d{7}$/.test(c)))
    throw new AdapterError("invalid_request", "CNAE deve ter 7 dígitos.");
  if (!/^[A-Z]{2}$/.test(uf)) throw new AdapterError("invalid_request", "UF inválida.");
  if (!Number.isInteger(page) || page < 1) throw new AdapterError("invalid_request", "Página inválida.");
  if (!Array.isArray(municipalities) || municipalities.length > MAX_MUNICIPALITIES)
    throw new AdapterError("invalid_request", `Até ${MAX_MUNICIPALITIES} municípios por consulta.`);
  return {
    codigo_atividade_principal: cnaes,
    incluir_atividade_secundaria: true,
    codigo_atividade_secundaria: cnaes,
    situacao_cadastral: ["ATIVA"],
    mei: { excluir_optante: true },
    uf: [uf.toLowerCase()],
    ...(municipalities.length ? { municipio: municipalities.map(norm) } : {}),
    limite: limit,
    pagina: page,
  };
}

// Normaliza um item; descarta sócios e dados pessoais. Esquema inválido é erro, não item ignorado.
export function normalizeItem(x) {
  const cnpj = digits(x?.cnpj);
  if (cnpj.length !== 14 || typeof x?.razao_social !== "string")
    throw new AdapterError("schema", "Casa dos Dados: item sem CNPJ de 14 dígitos ou razão social.");
  const e = x.endereco || {};
  return {
    cnpj,
    cnpjRoot: digits(x.cnpj_raiz) || cnpj.slice(0, 8),
    legalName: x.razao_social.trim(),
    tradeName: x.nome_fantasia?.trim() || null,
    headquarters: x.matriz_filial === "MATRIZ" ? true : x.matriz_filial === "FILIAL" ? false : null,
    sizeCode: x.porte_empresa?.codigo ?? null,
    sizeLabel: x.porte_empresa?.descricao ?? null,
    status: x.situacao_cadastral?.situacao_cadastral ?? null,
    legalNature: x.descricao_natureza_juridica ?? null,
    openedAt: x.data_abertura ?? null,
    street: [e.tipo_logradouro, e.logradouro].filter(Boolean).join(" ") || null,
    number: e.numero || null,
    district: e.bairro || null,
    postalCode: digits(e.cep) || null,
    municipalityName: e.municipio || null,
    uf: e.uf ? String(e.uf).toUpperCase() : null,
    municipalityIbge: Number.isInteger(e.ibge?.codigo_municipio) ? e.ibge.codigo_municipio : null,
  };
}

export async function searchEstablishments(env, query, fetchImpl = fetch) {
  if (!env.CASADOSDADOS_API_KEY)
    throw new AdapterError("auth", "Casa dos Dados: chave não configurada.");
  const body = requestBody(query);
  const { status, data } = await fetchJson(
    "Casa dos Dados",
    URL_SEARCH,
    {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": env.CASADOSDADOS_API_KEY },
      body: JSON.stringify(body),
    },
    fetchImpl,
    15000,
  );
  if (status === 403) throw new AdapterError("no_balance", "Casa dos Dados: sem saldo para a pesquisa (403).");
  if (status !== 200) throw httpError("Casa dos Dados", status);
  if (!data || !Number.isInteger(data.total) || data.total < 0 || !Array.isArray(data.cnpjs))
    throw new AdapterError("schema", "Casa dos Dados: resposta fora do esquema {total, cnpjs}.");
  const items = data.cnpjs.map(normalizeItem);
  // Página precisa vir inteira: menos itens do que o total indica é incompleto, nunca "fim da lista".
  const expected = Math.max(0, Math.min(body.limite, data.total - (body.pagina - 1) * body.limite));
  if (items.length !== expected)
    throw new AdapterError("incomplete", `Casa dos Dados: página ${body.pagina} com ${items.length} de ${expected} itens esperados.`);
  // O filtro de localização precisa ter sido aplicado; senão a partição não vale.
  const allowed = new Set((query.municipalities || []).map(norm));
  const foreign = items.filter((i) => i.uf !== query.uf || (allowed.size && !allowed.has(norm(i.municipalityName))));
  if (foreign.length)
    throw new AdapterError("filter_not_applied", `Casa dos Dados: ${foreign.length} itens fora dos municípios pedidos em ${query.uf}.`);
  return { total: data.total, items, page: body.pagina, limit: body.limite };
}
