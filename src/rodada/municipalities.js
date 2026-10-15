// Conjunto de municípios da rodada: JSON [{code,name,region,country,lat,lon,bbox_*}] ou CSV com cabeçalho
// (código;nome;uf;lat;lon). O conjunto é da rodada; o código não conhece nenhum município.
// Conjunto nacional oficial do Brasil a partir do seed versionado do IBGE (migrations/0008_seed_municipios.sql), para uso
// local sem rede (CLI e testes). O Worker lê a mesma informação da tabela municipalities.
// Colunas: ibge_code,name,name_normalized,uf,lat,lon,source,source_version,bbox_min_lat,bbox_max_lat,bbox_min_lon,bbox_max_lon,area_km2
export function parseIbgeSeedSql(sql) {
  const out = [];
  const row = /^\((\d{7}),'((?:[^']|'')*)','(?:[^']|'')*','([A-Z]{2})',(-?[\d.]+),(-?[\d.]+),'(?:[^']|'')*','((?:[^']|'')*)',(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),/;
  for (const line of sql.split(/\r?\n/)) {
    const m = row.exec(line);
    if (!m) continue;
    out.push({
      code: m[1], name: m[2].replace(/''/g, "'"), region: m[3], country: "BR", lat: Number(m[4]), lon: Number(m[5]), source: m[6].replace(/''/g, "'"),
      bbox_min_lat: Number(m[7]), bbox_max_lat: Number(m[8]), bbox_min_lon: Number(m[9]), bbox_max_lon: Number(m[10]),
    });
  }
  return out;
}

export function parseMunicipalities(text, { format, country }) {
  const clean = text.replace(/^﻿/, "").trim();
  if (format === "json") return JSON.parse(clean).map((m) => ({ country, ...m }));
  const [head, ...lines] = clean.split(/\r?\n/);
  const h = head.split(";").map((x) => x.trim().toLowerCase());
  const ix = (...names) => h.findIndex((x) => names.includes(x));
  const [c, n, r, la, lo] = [ix("ibge_code", "code", "codigo"), ix("municipio", "name", "nome"), ix("uf", "region", "estado"), ix("lat"), ix("lon")];
  if (n < 0 || la < 0 || lo < 0) throw new Error("CSV de municípios precisa das colunas nome, lat e lon.");
  return lines.map((l) => l.split(";")).map((p) => ({ code: c >= 0 ? p[c] : undefined, name: p[n], region: r >= 0 ? p[r] : undefined, country, lat: Number(p[la]), lon: Number(p[lo]) }));
}
