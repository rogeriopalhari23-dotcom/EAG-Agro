// Gera migrations/0008_seed_municipios.sql a partir das APIs oficiais do IBGE (P2-T2).
// Uso único, local: node scripts/gen-municipios-sql.mjs. A saída é commitada; o Worker nunca chama o IBGE.
// Fontes:
//   nomes/UF:  https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado
//   centroide, retângulo envolvente e área:
//              https://servicodados.ibge.gov.br/api/v3/malhas/estados/{UF}/metadados?intrarregiao=municipio
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const consulted = new Date().toISOString().slice(0, 10);
const VERSION = `ibge-api-v3-malhas@${consulted}`;

async function json(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (r.ok) return r.json();
    if (attempt === 3) throw new Error(`${r.status} em ${url}`);
    await new Promise((ok) => setTimeout(ok, 2000 * attempt));
  }
}
export const normalizeName = (s) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;

const names = new Map();
for (const m of await json("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado"))
  names.set(String(m["municipio-id"]), { name: m["municipio-nome"], uf: m["UF-sigla"] });

const rows = [];
for (const uf of UFS) {
  const meta = await json(
    `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}/metadados?intrarregiao=municipio`,
  );
  for (const m of meta) {
    const n = names.get(String(m.id));
    if (!n) throw new Error(`Município sem nome na API de localidades: ${m.id}`);
    if (n.uf !== uf) throw new Error(`UF divergente para ${m.id}: ${n.uf} x ${uf}`);
    const [a, b] = m["regiao-limitrofe"];
    rows.push({
      id: Number(m.id),
      name: n.name,
      uf,
      lat: m.centroide.latitude,
      lon: m.centroide.longitude,
      minLat: Math.min(a.latitude, b.latitude),
      maxLat: Math.max(a.latitude, b.latitude),
      minLon: Math.min(a.longitude, b.longitude),
      maxLon: Math.max(a.longitude, b.longitude),
      area: Number(m.area.dimensao),
    });
  }
  await new Promise((ok) => setTimeout(ok, 300));
}
// Município sem malha oficial (ex.: criado depois da última malha) fica fora, registrado, sem coordenada inventada.
const withGeo = new Set(rows.map((r) => String(r.id)));
const missing = [...names].filter(([id]) => !withGeo.has(id)).map(([id, n]) => `${id} ${n.name}/${n.uf}`);
if (rows.length + missing.length !== names.size || missing.length > 10)
  throw new Error(`Contagem divergente: ${rows.length} centroides, ${missing.length} sem malha, ${names.size} municípios`);
rows.sort((x, y) => x.id - y.id);

let out = `-- P2-T2: municípios oficiais do IBGE com centroide, retângulo envolvente e área.
-- Gerado por scripts/gen-municipios-sql.mjs em ${consulted}; ${rows.length} municípios; versão ${VERSION}.
-- Sem malha oficial na data (excluídos, origem indisponível até nova malha): ${missing.join("; ") || "nenhum"}.
-- O centroide é estimativa da localização de uma unidade; o retângulo permite afirmar dentro/fora do raio só quando o município inteiro está de um lado.
ALTER TABLE municipalities ADD COLUMN bbox_min_lat REAL;
ALTER TABLE municipalities ADD COLUMN bbox_max_lat REAL;
ALTER TABLE municipalities ADD COLUMN bbox_min_lon REAL;
ALTER TABLE municipalities ADD COLUMN bbox_max_lon REAL;
ALTER TABLE municipalities ADD COLUMN area_km2 REAL;
`;
for (let i = 0; i < rows.length; i += 400) {
  out += "INSERT INTO municipalities(ibge_code,name,name_normalized,uf,lat,lon,source,source_version,bbox_min_lat,bbox_max_lat,bbox_min_lon,bbox_max_lon,area_km2) VALUES\n";
  out += rows
    .slice(i, i + 400)
    .map(
      (r) =>
        `(${r.id},${sql(r.name)},${sql(normalizeName(r.name))},${sql(r.uf)},${r.lat},${r.lon},'IBGE — API de malhas v3 e localidades v1',${sql(VERSION)},${r.minLat},${r.maxLat},${r.minLon},${r.maxLon},${r.area})`,
    )
    .join(",\n");
  out += ";\n";
}
await writeFile(resolve(root, "migrations/0008_seed_municipios.sql"), out);
console.log(`${rows.length} municípios gravados (${VERSION}); sem malha: ${missing.join("; ") || "nenhum"}.`);
