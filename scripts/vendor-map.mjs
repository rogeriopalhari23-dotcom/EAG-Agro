// Copia para public/mapa/ tudo o que o mapa de fundo precisa, servido pela própria origem (sem CDN):
// MapLibre GL JS (BSD-3), PMTiles (BSD-3) + fflate (MIT) e camadas Protomaps (BSD-3; estilo CC0) num módulo só,
// fontes Noto Sans em PBF (OFL 1.1) e ícones "light" (derivados de tangrams/icons, MIT).
// Uso: node scripts/vendor-map.mjs <pasta basemaps-assets> <pasta com as licenças pmtiles.txt, basemaps.txt, tangrams.txt>
import { cp, mkdir, rm, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build } from "esbuild";
const root = resolve(import.meta.dirname, "..");
const [assets, licenses] = process.argv.slice(2);
if (!assets || !licenses) throw new Error("Informe a pasta basemaps-assets e a pasta de licenças.");
const out = resolve(root, "public/mapa");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const nm = (p) => resolve(root, "node_modules", p);
for (const f of ["maplibre-gl.mjs", "maplibre-gl-shared.mjs", "maplibre-gl-worker.mjs", "maplibre-gl.css"]) await cp(nm(`maplibre-gl/dist/${f}`), join(out, f));
await cp(nm("maplibre-gl/LICENSE.txt"), join(out, "LICENSE-maplibre-gl.txt"));
await build({
  stdin: { contents: 'export { Protocol, PMTiles } from "pmtiles"; export { layers, namedFlavor } from "@protomaps/basemaps";', resolveDir: root, loader: "js" },
  bundle: true,
  format: "esm",
  minify: true,
  legalComments: "eof",
  outfile: join(out, "mapa-base.mjs"),
  logLevel: "warning",
});
await cp(join(licenses, "pmtiles.txt"), join(out, "LICENSE-pmtiles.txt"));
await cp(join(licenses, "basemaps.txt"), join(out, "LICENSE-protomaps-basemaps.txt"));
await cp(nm("fflate/LICENSE"), join(out, "LICENSE-fflate.txt"));
for (const font of ["Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic"]) await cp(join(assets, "fonts", font), join(out, "fonts", font), { recursive: true });
await cp(join(assets, "fonts", "OFL.txt"), join(out, "fonts", "OFL.txt"));
await mkdir(join(out, "sprites"), { recursive: true });
for (const f of ["light.json", "light.png", "light@2x.json", "light@2x.png"]) await cp(join(assets, "sprites/v4", f), join(out, "sprites", f));
await cp(join(licenses, "tangrams.txt"), join(out, "sprites", "LICENSE-tangrams-icons.txt"));
await writeFile(
  join(out, "ATRIBUICAO.txt"),
  `Mapa de fundo do EAG Compass
Dados: © OpenStreetMap (colaboradores), Open Database License 1.0 — https://www.openstreetmap.org/copyright
Ladrilhos: Protomaps Basemap (obra produzida a partir do OpenStreetMap; também Natural Earth, domínio público) — https://protomaps.com
Estilo visual: Protomaps (CC0). Ícones: derivados de tangrams/icons (MIT). Fontes: Noto Sans (SIL OFL 1.1).
Bibliotecas: MapLibre GL JS (BSD-3), PMTiles (BSD-3), fflate (MIT), @protomaps/basemaps (BSD-3).
Atribuição exibida no mapa: "Protomaps © OpenStreetMap".
`,
);
const count = async (d) => (await readdir(d, { recursive: true })).length;
console.log(`public/mapa pronto (${await count(out)} arquivos).`);
