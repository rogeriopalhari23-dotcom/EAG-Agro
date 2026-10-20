// Prévia LOCAL do redesign (ferramenta de desenvolvimento; fora da suíte). Sobe o Worker real com D1 em memória e todas
// as migrações, semeia dados FICTÍCIOS (empresas marcadas "(fictícia)" e um "TESTE INTERNO"), reproduz os bloqueios de
// produção (canal planned, campanhas inativas, cópia desligada, T11 pendente, fichas em aprovação, nenhum envio) e serve
// a interface. Nada sai para a rede: a Receita é simulada; produção nunca é tocada.
//   node tests/preview-server.mjs                     → http://127.0.0.1:8790 (interface desta branch)
//   PREVIEW_PUBLIC=<pasta public antiga> PREVIEW_PORT=8791 node tests/preview-server.mjs   → interface anterior, mesmos dados
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { setup } from "./helpers/db.mjs";
import worker from "../src/worker.js";
import { securityHeaders } from "../src/http.js";
import { provenanceHeaders } from "../src/provenance.js";

const PORT = Number(process.env.PREVIEW_PORT || 8790);
const ctx = setup();
const { api, DB } = ctx;
Object.assign(ctx.env, { SENDER_NAME: "EAG Agro - Brasil (prévia)", EAG_POSTAL_ADDRESS: "Rua Fictícia, 000 — Indiara/GO", EAG_POSTAL_ADDRESS_CONFIRMED: "Rua Fictícia, 000 — Indiara/GO", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64") });
ctx.env.PUBLIC_BASE_URL = "https://previa-local.invalid";
const types = { html: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css", woff2: "font/woff2", json: "application/json", png: "image/png", txt: "text/plain" };
ctx.env.ASSETS = {
  async fetch(request) {
    let path = decodeURIComponent(new URL(request.url).pathname);
    if (path === "/") path = "/index.html";
    try {
      const file = process.env.PREVIEW_PUBLIC ? process.env.PREVIEW_PUBLIC + path : new URL("../public" + path, import.meta.url);
      return new Response(await readFile(file), { headers: { ...securityHeaders, "content-type": types[path.split(".").pop()] || "application/octet-stream" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },
};

// Receita simulada (só para a rodada fictícia); qualquer outra saída de rede é recusada.
const FAKE_REG = {
  "61111111000101": ["Ativa", "Acreúna", "1066-0/00 Fabricação de alimentos para animais", "Micro Empresa"],
  "62222222000102": ["Ativa", "Trindade", "1066-0/00 Fabricação de alimentos para animais", "Empresa de Pequeno Porte"],
  "63333333000103": ["Ativa", "Pontalina", "5211-7/01 Armazéns gerais - emissão de warrant", null],
  "64444444000104": ["Ativa", "Caturaí", "1066-0/00 Fabricação de alimentos para animais", "Empresa de Pequeno Porte"],
  "65555555000105": ["Suspensa", "Palmeiras de Goiás", "1066-0/00 Fabricação de alimentos para animais", null],
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const m = /publica\.cnpj\.ws\/cnpj\/(\d{14})/.exec(String(url));
  if (m) {
    const r = FAKE_REG[m[1]];
    if (!r) return new Response("{}", { status: 404 });
    const [sub, ...desc] = r[2].split(" ");
    return Response.json({ razao_social: `EMPRESA ${m[1].slice(0, 2)} (fictícia)`, porte: r[3] ? { descricao: r[3] } : null, estabelecimento: { situacao_cadastral: r[0], cidade: { nome: r[1] }, estado: { sigla: "GO" }, tipo: "Matriz", atividade_principal: { subclasse: sub, descricao: desc.join(" ") } } });
  }
  if (String(url).startsWith(`http://127.0.0.1:${PORT}`)) return realFetch(url, init);
  throw new Error(`Prévia local: rede bloqueada (${url})`);
};

// ---------- Dados fictícios ----------
const put = (key, scope, value) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Prévia local (fictício)" });
await put("send_timezone", "national", "America/Sao_Paulo");
await put("send_window", "national", { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] });
await put("sanctions_max_age_hours", "global", 720);
await put("email_validation_max_age_days", "email", 30);
const listDate = new Date(Date.now() - 22 * 86400000).toISOString(); // listas "baixadas" há 22 dias: vencem em 8
for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
  const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt: listDate });
  await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Nome Sem Relação (fictício)" }] });
  await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
}
// Ponte: última leitura há 3 minutos (fictício).
DB.raw.prepare("UPDATE reply_reader_state SET last_read_ok_at=?, reader='bridge' WHERE tenant_id='eag-internal'").run(new Date(Date.now() - 180000).toISOString());

const camp = (await api("/api/campaigns", "POST", { productId: "product-03", market: "national", name: "Milho GMO — Indiara/GO (fictícia)", originCity: "Indiara", originUf: "GO", icp: { userSectors: ["ração"], sizeTarget: "medium", region: "GO", decisionRole: "Compras", influencerRole: "Produção" } })).data;
await api(`/api/campaigns/${camp.id}/activate`, "POST", { expectedVersion: 1 });

const companies = [];
async function company(name, cnpj, opts = {}) {
  const co = (await api("/api/companies", "POST", { legalName: name, countryCode: "BR", registrationId: cnpj, registrationIdType: "CNPJ", sourceLabel: "Prévia local (dados fictícios)" })).data;
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,trade_name,municipality_name,uf,size_code,size_label,source_label,consulted_at) VALUES (?,'eag-internal',?,?,?,?,'GO',?,?,'prévia','2026-10-16')").run(`u-${cnpj}`, co.id, cnpj, name, opts.city ?? "Indiara", opts.size ?? "03", opts.size === "01" ? "Micro" : "Pequena");
  if (opts.profile) await api(`/api/companies/${co.id}/profiles`, "POST", { productId: "product-03", profileClass: "possible_final_consumer", basis: "Fábrica de ração registrada no MAPA (fictício)" });
  if (opts.screen) await api(`/api/companies/${co.id}/screening`, "POST", {});
  if (opts.evidence) await api(`/api/companies/${co.id}/evidence`, "POST", { productId: "product-03", category: "business", evidenceType: "company_document", market: "national", supports: ["consumes_as_input"], reference: "Site próprio: 'ração com milho moído' (fictício)", sourceUrl: "https://exemplo.invalid/produtos", consultedAt: "2026-10-16", validationStatus: "pending" });
  companies.push(co.id);
  return co.id;
}
const a = await company("Rações Serra Azul Ltda (fictícia)", "71111111000101", { profile: true, screen: true, evidence: true, city: "Trindade" });
const b = await company("Nutrição Animal Vale Verde (fictícia)", "72222222000102", { profile: true, screen: true, city: "Acreúna" });
await company("Cooperativa Agro Planalto (fictícia)", "73333333000103", { city: "Pontalina" });
await company("Granja Boa Esperança (fictícia)", "74444444000104", { profile: true, city: "Palmeiras de Goiás", size: "01" });
await company("TESTE INTERNO EAG — ponte de e-mail (fictício, não é prospect)", "75555555000105", {});
// Canal geral publicado + ficha em aprovação (nenhuma aprovação; nada é enviado).
for (const cid of [a, b]) {
  const ch = (await api(`/api/companies/${cid}/channels`, "POST", { email: `contato@${cid.slice(0, 6)}.exemplo.invalid`, sourceUrl: "https://exemplo.invalid/contato", sourceKind: "company_site" })).data;
  DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at=? WHERE id=?").run(new Date().toISOString(), ch.contactId);
  const f = await api("/api/fichas", "POST", { companyId: cid, campaignId: camp.id, recipients: [ch.contactId], purpose: "identify_buyer" });
  if (f.status >= 300) console.log("ficha da prévia:", JSON.stringify(f.data).slice(0, 300));
}
// Ligações de nível 0 (bloqueadas pela T11 pendente, como em produção).
for (const cid of companies.slice(0, 3)) await api(`/api/companies/${cid}/level0`, "POST", { commodity: "milho", phone: "+55 62 3000-0000", phoneSource: "site da empresa (fictício), 16/10/2026" });
// Campanha volta a inativa, como em produção (rascunho); pausa e supressão de exemplo.
DB.raw.prepare("UPDATE campaigns SET status='draft' WHERE id=?").run(camp.id);
await api("/api/pauses", "POST", { scope: "company", scopeRef: companies[3], reason: "Prévia: pediu retorno em novembro (fictício)" });
await api("/api/suppression", "POST", { channel: "email", value: "descadastro@exemplo.invalid", reason: "opt_out" });

// Rodada fictícia no mesmo formato da Rodada 1: importação, execução, cadastro em descoberta, pesquisa encerrada, anotação.
const cfg = JSON.parse(await readFile(new URL("../docs/implementation/rodadas/exemplos/milho-gmo-indiara-300km.json", import.meta.url), "utf8"));
const roundCfg = { ...cfg, id: "previa-milho-indiara-100km", description: "Rodada fictícia da prévia local.", radius: { value: 100, unit: "km", method: "haversine" }, sources: cfg.sources.filter((s) => s.id !== "casadosdados").map((s) => (s.id === "br-cnpj-ws" ? { ...s, rateLimitPerMinute: 30 } : s)) };
const rid = (await api("/api/rounds", "POST", { name: "Rodada fictícia — milho GMO, Indiara/GO, 100 km", config: roundCfg })).data.id;
const rb = `/api/rounds/${rid}`;
const csv = ["cnpj;nome;municipio;uf;segmento;fonte_url;evidence_kind;evidence_strength;trecho",
  "61.111.111/0001-01;Rações Campo Bom (fictícia);Acreúna;GO;feed_mill;https://exemplo.invalid/mapa;activity_code;official_record;Registro: FABRICANTE RAÇÃO (fictício)",
  "62.222.222/0001-02;Nutri Trindade (fictícia);Trindade;GO;feed_mill;https://exemplo.invalid/mapa;activity_code;official_record;Registro: FABRICANTE RAÇÃO (fictício)",
  "63.333.333/0001-03;Cooperativa Pontal (fictícia);Pontalina;GO;feed_mill;https://exemplo.invalid/mapa;activity_code;official_record;Registro: FABRICANTE RAÇÃO (fictício)",
  "64.444.444/0001-04;Rações Caturaí (fictícia);Caturaí;GO;feed_mill;https://exemplo.invalid/mapa;activity_code;official_record;Registro: FABRICANTE RAÇÃO (fictício)",
  "65.555.555/0001-05;Fábrica Palmeiras (fictícia);Palmeiras de Goiás;GO;feed_mill;;;;"].join("\n");
await api(`${rb}/candidates`, "POST", { intake: "import", source: "import-file", format: "csv", text: csv, label: "candidatas-ficticias.csv" });
await api(`${rb}/candidates`, "POST", { intake: "assisted", candidate: { name: "Rações Campo Bom (fictícia)", registrationId: "61.111.111/0001-01", sourceUrl: "https://exemplo.invalid/campobom", evidence: { kind: "operation", strength: "own_source", quote: "Fábrica em operação em Acreúna (fictício)" } } });
await api(`${rb}/preflight-ack`, "POST", { revision: 1 });
await api(`${rb}/run`, "POST", {});
await api(`${rb}/register`, "POST", { mode: "discovery", productId: "product-03", screening: true }, provenanceHeaders({ channel: "script", executor: "Prévia local (fictício)", authorization: { reference: "Dados fictícios da prévia", grantedBy: "—", grantedAt: "2026-10-16" } }));
const rv = (await api(rb)).data;
await api(rb, "PUT", { expectedRevision: rv.revision, config: { ...rv.config, research: { publicPhase: "closed" } } });
await api(`${rb}/preflight-ack`, "POST", { revision: rv.revision + 1 });
await api(`${rb}/run`, "POST", {});
await api(`${rb}/annotations`, "POST", { kind: "complement", text: "Anotação fictícia da prévia: cadastros em descoberta, sem decisão comercial individual.", refersTo: { requestIds: ["previa-0000"] }, authorization: { reference: "Exemplo fictício", grantedBy: "—", grantedAt: "2026-10-16" } }, provenanceHeaders({ channel: "script", executor: "Prévia local (fictício)" }));
// Segunda rodada, só configurada (para "continuar" no Início).
const cfg2 = JSON.parse(await readFile(new URL("../docs/implementation/rodadas/exemplos/soja-rio-verde-150km.json", import.meta.url), "utf8"));
await api("/api/rounds", "POST", { name: "Rodada fictícia — soja, Rio Verde/GO, 150 km (rascunho)", config: { ...cfg2, id: "previa-soja" } });

const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const r = await worker.fetch(new Request(`http://127.0.0.1:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: body.length ? body : undefined }), ctx.env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
});
server.listen(PORT, "127.0.0.1", () => console.log(`Prévia local (dados fictícios) em http://127.0.0.1:${PORT}  — Ctrl+C encerra`));
