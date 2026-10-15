// Descoberta automática pelo OpenStreetMap (Overpass) no raio da rodada, com as etiquetas de cada segmento
// (config.commodity.segments[seg].discovery.osm = [[chave, valor]] ou [[chave, "~regex"]]).
// Resultado = candidata PROVISÓRIA (o OSM quase nunca traz CNPJ) com indício de diretório; nunca prova uso ou compra.
// No Worker a consulta não sai (o servidor público recusa a Cloudflare): o painel consulta pelo navegador e envia a
// resposta bruta, que é lida aqui do mesmo jeito. Na linha de comando, a consulta sai direto com --rede.
import { parseOverpass, OSM_ATTRIBUTION } from "../../adapters/discovery.js";

const esc = (s) => String(s).replace(/["\\]/g, "");

export function osmRoundQuery(config, origin, { limit = 500 } = {}) {
  const radiusM = Math.round(config.radius.km * 1000);
  const parts = [];
  for (const [seg, rule] of Object.entries(config.commodity.segments ?? {}))
    for (const [k, v] of rule?.discovery?.osm ?? [])
      parts.push(String(v).startsWith("~") ? `nwr["${esc(k)}"~"${esc(String(v).slice(1))}",i](around:${radiusM},${origin.lat},${origin.lon});` : `nwr["${esc(k)}"="${esc(v)}"](around:${radiusM},${origin.lat},${origin.lon});`);
  if (!parts.length) return null;
  return `[out:json][timeout:90];(${parts.join("")});out tags center ${limit};`;
}

// Segmento provável pela etiqueta encontrada (primeira regra que casa).
function segmentFor(config, tags) {
  for (const [seg, rule] of Object.entries(config.commodity.segments ?? {}))
    for (const [k, v] of rule?.discovery?.osm ?? []) {
      const t = tags?.[k];
      if (t == null) continue;
      if (String(v).startsWith("~") ? new RegExp(String(v).slice(1), "i").test(t) : t === v) return seg;
    }
  return null;
}

// data: resposta JSON do Overpass. → candidatas da rodada.
export function osmToCandidates(data, config, { consultedAt }) {
  const parsed = parseOverpass(data);
  const byId = new Map((data.elements ?? []).map((e) => [`${e.type}/${e.id}`, e]));
  return parsed.candidates.map((c) => {
    const e = byId.get(c.externalId) ?? {};
    const center = e.center ?? (typeof e.lat === "number" ? { lat: e.lat, lon: e.lon } : null);
    const t = e.tags ?? {};
    return {
      country: config.origin.country,
      name: c.name,
      municipality: t["addr:city"] ?? null,
      region: t["addr:state"] ?? null,
      // Ponto do mapa é a posição do objeto no OSM, não um endereço conferido: entra como pista, não como unidade.
      unit: null,
      hints: { segment: segmentFor(config, t), osmPoint: center, website: c.website, legalNameHint: c.legalNameHint },
      sources: [{ id: "osm-overpass", mode: "automatic", ref: c.recordUrl, consultedAt, attribution: OSM_ATTRIBUTION }],
      evidence: [{ kind: "activity_code", strength: "directory", url: c.recordUrl, quote: `OpenStreetMap: ${c.activity.code}`, date: consultedAt }],
    };
  });
}

export async function osmDiscover({ config, origin, fetchImpl = fetch, consultedAt = new Date().toISOString() }) {
  const query = osmRoundQuery(config, origin);
  if (!query) return { candidates: [], query: null, note: "Nenhum segmento com etiquetas do OpenStreetMap." };
  const r = await fetchImpl("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "eag-compass-rodada (uso pessoal, baixo volume)" }, body: `data=${encodeURIComponent(query)}` });
  if (r.status !== 200) throw Object.assign(new Error(`OpenStreetMap: HTTP ${r.status}`), { status: r.status });
  return { candidates: osmToCandidates(await r.json(), config, { consultedAt }), query };
}
