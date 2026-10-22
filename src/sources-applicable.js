// Fontes aplicáveis a uma pesquisa (país × commodity × segmentos), numa regra só para o planejamento, a execução e as
// telas (Radar Nacional, Radar Internacional, Rodadas e prospecção automática). Fonte incompatível com o contexto não
// aparece nem é consultada; fonte pertinente que não pode rodar aparece como pendência, com o motivo.
// Fonte genérica (mapa colaborativo) só conta quando há regra de busca para a commodity: o conector existir não prova
// cobertura. O inventário completo de conectores fica na administração (inventory()).
import { proposalFor } from "./discovery-map.js";

const tagText = (osm) => osm.map(([k, v]) => `${k}=${v instanceof RegExp ? v.source.replace(/\|/g, "/") : String(v).replace(/^~/, "")}`).join(", ");
// Regra só pela etiqueta product (sem craft/industrial): existe, mas é rara no mapa.
const weakOsm = (osm) => osm.every(([k]) => k === "product");

// ---------- exterior ----------
const FOREIGN = [
  // Departamentos ultramarinos (Guadalupe, Martinica, Guiana Francesa, Reunião, Mayotte) estão no registro francês.
  { key: "fr_registry", label: "Registro oficial da França (atividade e porte)", countries: ["FR", "GP", "MQ", "GF", "RE", "YT"], needs: "nace" },
  { key: "no_registry", label: "Registro oficial da Noruega (atividade, porte e site)", countries: ["NO"], needs: "nace" },
  { key: "de_coffee_assoc", label: "Deutscher Kaffeeverband — diretório de membros", countries: ["DE"], hs4: ["0901"] },
  { key: "cl_sag_lenaa", label: "SAG (Chile) — LENAA, fabricantes de alimentos para animais", countries: ["CL"], needs: "feedRegistry" },
  { key: "osm", label: "OpenStreetMap", countries: "*", needs: "osm" },
];

// hs6: códigos SH6 confirmados do produto no catálogo (ou da seleção registrada). → [{ key, label, status, note, rule }]
export function foreignSources(iso2, hs6 = []) {
  const codes = (hs6 ?? []).map(String).filter((c) => /^\d{6}$/.test(c));
  const p = codes.length ? proposalFor(codes) : null;
  const out = [];
  for (const d of FOREIGN) {
    if (d.countries !== "*" && !d.countries.includes(iso2)) continue; // outro país: incompatível, fora da lista
    if (d.hs4 && !(p && d.hs4.includes(p.hs4)) && !codes.some((c) => d.hs4.includes(c.slice(0, 4)))) continue; // outra commodity
    if (d.needs === "osm") {
      if (!p?.processors.osm.length) continue; // sem regra para a commodity: o mapa não é cobertura
      out.push({ key: d.key, label: `OpenStreetMap — ${p.processors.label}`, status: "available", rule: tagText(p.processors.osm), note: weakOsm(p.processors.osm) ? "regra só pela etiqueta de produto, rara no mapa: cobertura muito irregular" : "cobertura irregular; quase nunca traz identificador cadastral" });
      continue;
    }
    if (d.needs === "feedRegistry") {
      if (!p?.processors.feedRegistry) continue; // commodity sem uso em ração: o registro não é cobertura
      out.push({ key: d.key, label: d.label, status: "available", rule: "registro oficial de fabricantes de ração; atividade de animais de produção, aquicultura ou ingrediente vegetal", note: "identifica a empresa (RUT) e a atividade autorizada; não prova compra da commodity nem importação" });
      continue;
    }
    if (d.needs === "nace") {
      if (!codes.length) out.push({ key: d.key, label: d.label, status: "pending", note: "classificação do produto (código SH) ainda não confirmada no catálogo" });
      else if (!p?.processors.nace.length) out.push({ key: d.key, label: d.label, status: "pending", note: "sem atividades compradoras mapeadas para esta commodity" });
      else out.push({ key: d.key, label: d.label, status: "available", rule: `atividades ${p.processors.nace.join(", ")} (${p.processors.label})` });
      continue;
    }
    out.push({ key: d.key, label: d.label, status: "available" });
  }
  return out;
}

// ---------- Brasil (rodadas) ----------
// segments: { chave: { label, discovery: { osm, sipeagro, abic } } } → itens da tela e entradas de config.sources da rodada.
export function nationalSources(segments = {}) {
  const segs = Object.values(segments ?? {});
  const with_ = (k) => segs.filter((g) => g.discovery?.[k]);
  const items = [
    { key: "br-cnpj-ws", label: "Receita Federal (consulta por CNPJ)", status: "available", note: "confirma situação, atividade e endereço de quem tem CNPJ; não busca empresas pelo nome" },
    { key: "company-site", label: "Site da própria empresa (CNPJ e canal publicados)", status: "available", note: "lido quando a candidata tem site" },
  ];
  const config = [{ id: "br-cnpj-ws", kind: "registry", countries: ["BR"], rateLimitPerMinute: 3, maxAgeDays: 30 }];
  if (with_("osm").length) {
    items.push({ key: "osm-overpass", label: `Mapa colaborativo (OpenStreetMap) — ${with_("osm").map((g) => g.label).join(", ")}`, status: "available", rule: with_("osm").map((g) => tagText(g.discovery.osm)).join("; "), note: "cobertura irregular; em produção depende do navegador (o servidor público recusa a Cloudflare)" });
    config.push({ id: "osm-overpass", kind: "discovery" });
  }
  if (with_("abic").length) {
    items.push({ key: "abic-certificados", label: "ABIC — torrefadoras certificadas", status: "available", note: "nome e estado da fábrica; município e CNPJ a identificar" });
    config.push({ id: "abic-certificados", kind: "discovery" });
  }
  if (with_("sipeagro").length) {
    items.push({ key: "mapa-sipeagro", label: `Registros do MAPA (SIPEAGRO) — ${with_("sipeagro").map((g) => g.label).join(", ")}`, status: "pending", note: "o portal recusou acesso automático; só por importação do arquivo" });
    config.push({ id: "mapa-sipeagro", kind: "discovery" });
  }
  const noRule = segs.filter((g) => !g.discovery || !Object.keys(g.discovery).length).map((g) => g.label);
  if (noRule.length) items.push({ key: "sem-regra", label: `Segmentos sem regra de busca automática: ${noRule.join(", ")}`, status: "pending", note: "candidatas por importação de arquivo ou pesquisa assistida" });
  if (!segs.length) items.push({ key: "sem-segmento", label: "Nenhum segmento comprador definido para esta commodity", status: "pending", note: "a busca automática não tem o que procurar; ajuste os segmentos no perfil comprador" });
  return { items, config };
}

// Inventário completo (só administração): todos os conectores e quando cada um se aplica.
export function inventory() {
  return {
    national: [
      { key: "br-cnpj-ws", label: "Receita Federal (publica.cnpj.ws)", appliesWhen: "Brasil, sempre (consulta por CNPJ)" },
      { key: "company-site", label: "Site da própria empresa", appliesWhen: "candidata com site publicado" },
      { key: "osm-overpass", label: "OpenStreetMap (Overpass)", appliesWhen: "segmento com regra de etiquetas do mapa" },
      { key: "abic-certificados", label: "ABIC — produtos certificados", appliesWhen: "café, segmento torrefação" },
      { key: "mapa-sipeagro", label: "MAPA — SIPEAGRO", appliesWhen: "segmento com regra do SIPEAGRO; só importação de arquivo" },
    ],
    international: FOREIGN.map((d) => ({ key: d.key, label: d.label, appliesWhen: `${d.countries === "*" ? "qualquer país" : d.countries.join(", ")}${d.hs4 ? `; SH ${d.hs4.join(", ")}` : ""}${d.needs === "nace" ? "; commodity com atividades mapeadas" : d.needs === "osm" ? "; commodity com regra de etiquetas do mapa" : ""}` })),
  };
}
