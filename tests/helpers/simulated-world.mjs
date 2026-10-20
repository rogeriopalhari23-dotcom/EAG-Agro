// Mundo SIMULADO para a prospecção automática (testes e prévia local). Nada sai para a rede e todo nome é fictício.
//   - mapa colaborativo (Overpass): estabelecimentos fictícios perto da origem, conforme as etiquetas pedidas;
//   - sites das empresas (*.previa.invalid): CNPJ fictício válido e e-mail geral; um site fora do ar, um sem CNPJ;
//   - Receita (publica.cnpj.ws): responde pelos CNPJs fictícios; opcionalmente 429 na primeira consulta de alguns;
//   - diretório alemão do café: indisponível (fonte pendente, as demais seguem).
// opts: { refuseOsm: true → 522 (como a Cloudflare recebe), receita429: Set(cnpj), cityAt(lat, lon) → { name, uf } (município
// oficial mais próximo, para a Receita simulada responder um município coerente com o ponto do mapa) }
export function nearestMunicipality(DB) {
  const q = DB.raw.prepare("SELECT name, uf FROM municipalities ORDER BY (lat-?)*(lat-?)+(lon-?)*(lon-?) LIMIT 1");
  return (lat, lon) => q.get(lat, lat, lon, lon) ?? null;
}
const digits = (s) => [...String(s)].map(Number);
function cnpjFrom(seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const base = (String(h).padStart(8, "0").slice(0, 8) + "0001").split("").map(Number);
  const dv = (ns, w) => {
    const r = ns.reduce((a, n, i) => a + n * w[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join("");
}
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fmtCnpj = (d) => `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;

const KINDS = [
  { re: /coffee_roaster/, names: ["Torrefação Serra Verde", "Café Moinho Alto", "Torrefadora Vale do Sul", "Café Ponte Nova", "Torrefação Boa Vista", "Café Recanto"], segment: "torrefação" },
  { re: /"industrial"="feed"/, names: ["Rações Campo Firme", "Nutrição Animal Ipê", "Rações Planalto Norte", "Fábrica de Ração Aurora", "Rações Bom Pasto", "Nutri Gado Leste"], segment: "fábrica de ração" },
  { re: /oil_mill/, names: ["Esmagadora Rio Claro", "Óleos Vale Verde"], segment: "esmagadora" },
];

export function simulatedWorld(opts = {}) {
  const registry = new Map(); // cnpj → { name, city, uf, size }
  const calls = [];
  const osmFor = (query) => {
    const around = /around:(\d+),(-?[\d.]+),(-?[\d.]+)/.exec(query);
    const iso = /"ISO3166-1"="([A-Z]{2})"/.exec(query)?.[1];
    const out = [];
    let id = 1000;
    for (const k of KINDS) {
      if (!k.re.test(query)) continue;
      for (const [i, n] of k.names.entries()) {
        const name = `${n}${iso && iso !== "BR" ? " (fiktiv)" : " (fictícia)"}`;
        const host = i === 4 ? `fora-do-ar-${slug(n)}.previa.invalid` : i === 5 ? null : i === 3 ? `sem-cnpj-${slug(n)}.previa.invalid` : `${slug(n)}.previa.invalid`;
        const lat = around ? Number(around[2]) + (i - 2) * 0.05 : 50 + i * 0.1, lon = around ? Number(around[3]) + (i - 2) * 0.05 : 9 + i * 0.1;
        const tags = { name, ...(k.re.source.includes("coffee") ? { craft: "coffee_roaster" } : k.re.source.includes("feed") ? { industrial: "feed" } : { industrial: "oil_mill" }), ...(host ? { website: `https://${host}` } : {}) };
        out.push({ type: "node", id: id++, lat, lon, tags });
        const near = opts.cityAt?.(lat, lon);
        if (host && !host.startsWith("fora-do-ar") && !host.startsWith("sem-cnpj")) registry.set(cnpjFrom(host), { name: name.toUpperCase().replace(/ \((FICTÍCIA|FIKTIV)\)/, " LTDA (FICTÍCIA)"), city: near?.name ?? opts.city ?? null, uf: near?.uf ?? opts.uf ?? null, size: i === 0 ? "Demais" : i === 1 ? "Empresa de Pequeno Porte" : "Micro Empresa" });
      }
    }
    return out;
  };
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(String(url));
    calls.push(`${u.host}${u.pathname}`);
    if (u.host === "overpass-api.de") {
      if (opts.refuseOsm) return new Response("<html>522</html>", { status: 522 });
      const body = decodeURIComponent(String(init.body ?? "").replace(/^data=/, ""));
      return Response.json({ elements: osmFor(body) });
    }
    if (u.host.endsWith(".previa.invalid")) {
      if (u.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /privado\n", { status: 200, headers: { "content-type": "text/plain" } });
      if (u.host.startsWith("fora-do-ar")) return new Response("indisponível", { status: 503 });
      if (u.host.startsWith("sem-cnpj")) return new Response(`<html><body>Fale conosco: <a href="mailto:contato@${u.host}">contato@${u.host}</a></body></html>`, { status: 200, headers: { "content-type": "text/html" } });
      const cnpj = cnpjFrom(u.host);
      // Site lido sem a busca no mapa (ex.: resposta vinda do navegador): a Receita simulada também conhece o CNPJ.
      if (!registry.has(cnpj)) registry.set(cnpj, { name: `${u.host.split(".")[0].replace(/-/g, " ").toUpperCase()} LTDA (FICTÍCIA)`, city: opts.city ?? "Guaxupé", uf: opts.uf ?? "MG", size: "Empresa de Pequeno Porte" });
      return new Response(`<html><body><footer>${u.host} — CNPJ ${fmtCnpj(cnpj)} — <a href="mailto:contato@${u.host}">contato@${u.host}</a> · joao.pereira@${u.host}</footer></body></html>`, { status: 200, headers: { "content-type": "text/html" } });
    }
    const m = /publica\.cnpj\.ws\/cnpj\/(\d{14})/.exec(String(url));
    if (m) {
      if (opts.receita429?.has(m[1])) {
        opts.receita429.delete(m[1]);
        return new Response("Too Many Requests", { status: 429 });
      }
      const r = registry.get(m[1]);
      if (!r) return new Response("{}", { status: 404 });
      return Response.json({ razao_social: r.name, porte: { descricao: r.size }, estabelecimento: { situacao_cadastral: "Ativa", cidade: { nome: r.city ?? "Guaxupé" }, estado: { sigla: r.uf ?? "MG" }, tipo: "Matriz", atividade_principal: { subclasse: "1081-3/02", descricao: "Torrefação e moagem de café" } } });
    }
    if (/kaffeeverband|kaffee-netz|kaffee/.test(u.host)) return new Response("indisponível", { status: 503 });
    // ABIC: mesma estrutura da página real (lista de produtos embutida), com industrializadores FICTÍCIOS.
    if (u.host === "www.abic.com.br") {
      if (opts.abicDown) return new Response("indisponível", { status: 503 });
      const produtos = [
        ["TORREFADORA MONTE ALEGRE LTDA (FICTÍCIA)", "MG", "CAFÉ MONTE ALEGRE"],
        ["TORREFADORA MONTE ALEGRE LTDA (FICTÍCIA)", "MG", "CAFÉ MONTE ALEGRE GOURMET"],
        ["INDÚSTRIA DE CAFÉ VALE DO SAPUCAÍ LTDA (FICTÍCIA)", "MG", "SAPUCAÍ TRADICIONAL"],
        ["CAFÉ SERRA DA MANTIQUEIRA IND. LTDA (FICTÍCIA)", "SP", "MANTIQUEIRA EXTRAFORTE"],
        ["CAFÉ NORTE PIONEIRO LTDA (FICTÍCIA)", "PR", "PIONEIRO"],
      ].map(([t, uf, p]) => ({ no_torrefador: t, co_sigla_estado_fabrica: uf, no_produto: p, no_tipo_produto_abreviado: "TM", no_certificacao: "Pureza, Qualidade", no_tipo_simbolo: "Tradicional" }));
      return new Response(`<html><body><div id="produtos"></div><script>jQuery(document).ready(function() { var dados = { produtos: ${JSON.stringify(produtos)}, total: ${produtos.length} }; });</script></body></html>`, { status: 200, headers: { "content-type": "text/html" } });
    }
    return null; // não tratado pelo mundo simulado
  };
  return { fetch: fetchImpl, registry, calls, cnpjFrom };
}
