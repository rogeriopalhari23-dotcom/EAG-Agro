// Conjunto de municípios da rodada: JSON [{code,name,region,country,lat,lon,bbox_*}] ou CSV com cabeçalho
// (código;nome;uf;lat;lon). O conjunto é da rodada; o código não conhece nenhum município.
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
