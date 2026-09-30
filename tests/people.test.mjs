import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver } from "./helpers/trade.mjs";
import { discover } from "../src/discovery.js";
import { parseImpressum, robotsAllows, brasilApiCnpj } from "../src/adapters/people.js";
import { researchCompany, researchSearchBatch, listPeople, emailScope } from "../src/people.js";

const admin = { tenant_id: "eag-internal", id: "system-admin", role: "admin" };
const req = (body = {}) => new Request("https://x/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

// Formatos reais vistos em 2026-09-28 (24grad, Black & Yum, Brühmarkt), reduzidos.
const IMP_24GRAD = "<h1>Impressum</h1><p>24grad GmbH<br>wird vertreten durch den Unternehmer Markus Glaubitz</p><p>Telefon: +49 221 123456<br>E-Mail: info@24grad.net</p>";
const IMP_BY = "<h1>Impressum</h1><table><tr><td>Inhaber/in</td><td>Reinhold Schmelter</td></tr><tr><td>Tel.</td><td>0521 998877</td></tr></table>";
const IMP_BM = "<h1>Impressum</h1><p>Geschäftsführer</p><p>Konstantinova, Natalia | Yanyuk, Yulia</p><p>Amtsgericht Köln HRB 1234</p><p>E-Mail: natalia.konstantinova@bruehmarkt.de</p>";

test("Impressum: extrai representantes nos formatos reais; não pega registro, endereço nem rodapé", () => {
  assert.deepEqual(parseImpressum(IMP_24GRAD).people, [{ name: "Markus Glaubitz", title: "vertreten durch" }]);
  assert.equal(parseImpressum(IMP_24GRAD).email, "info@24grad.net");
  assert.match(parseImpressum(IMP_24GRAD).phone, /^\+49 221/);
  assert.deepEqual(parseImpressum(IMP_BY).people.map((p) => p.name), ["Reinhold Schmelter"]);
  const bm = parseImpressum(IMP_BM);
  assert.deepEqual(parseImpressum(IMP_BM.replace(" | ", "</p><p>")).people, bm.people, "mesma leitura em linha única ou separada");
  assert.deepEqual(bm.people.map((p) => p.name), ["Natalia Konstantinova", "Yulia Yanyuk"]);
  assert.deepEqual(parseImpressum("<h1>Impressum</h1><p>Geschäftsführer: Musterstraße 5, 50667 Köln</p>").people, []);
  assert.deepEqual(parseImpressum("<p>Kaffee aus Brasilien</p>").people, []);
  // Falsos positivos do teste real: texto de direitos autorais, parte do nome da firma e título acadêmico.
  assert.deepEqual(parseImpressum("<p>Die Rechte liegen beim jeweiligen Inhaber der Marken und Systemen. Inhalte</p>").people, []);
  assert.deepEqual(parseImpressum("<p>Inhaber:</p><p>Peter Vagt</p><p>Radbruch Nachfolger</p>").people.map((p) => p.name), ["Peter Vagt"]);
  assert.deepEqual(parseImpressum("<p>Geschäftsführer: Dipl. Kfm. Andreas Muster</p>").people.map((p) => p.name), ["Andreas Muster"]);
  assert.deepEqual(parseImpressum("<p>Vorstand:</p><p>Paula Beispiel</p><p>Commerzbank Leipzig</p>").people.map((p) => p.name), ["Paula Beispiel"]);
  // Abreviação vista na Amori Coffee (2026-09-29): "Inh. Roberto Cascone".
  assert.deepEqual(parseImpressum("<p>AMORI Coffee Kaffeerösterei<br>Mombacher Str. 68<br>55122 Mainz<br>Inh. Roberto Cascone<br>Telefon: 06131 4996560</p>").people, [{ name: "Roberto Cascone", title: "Inh." }]);
  assert.deepEqual(parseImpressum("<p>Die Beispiel Rösterei GmbH mit Sitz in Köln wird vertreten durch Gustav August</p>").people.map((p) => p.name), ["Gustav August"]);
});

test("robots.txt é respeitado; e-mail: pessoal só com o nome da pessoa, caixa geral nunca vira e-mail pessoal", () => {
  assert.equal(robotsAllows("User-agent: *\nDisallow: /impressum", "/impressum"), false);
  assert.equal(robotsAllows("User-agent: Googlebot\nDisallow: /", "/impressum"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nAllow: /impressum", "/impressum"), true);
  // Visto em 2026-09-28 (WooCommerce/Yoast): curinga não bloqueia o site todo.
  assert.equal(robotsAllows("User-agent: *\nDisallow: /*?add-to-cart=\nDisallow: /wp-admin/", "/impressum"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /*?add-to-cart=", "/shop?add-to-cart=1"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/impressum"), true);
  assert.equal(robotsAllows("User-agent: bingbot\nUser-agent: *\nDisallow: /impressum", "/impressum"), false, "grupo com vários agentes");
  assert.equal(emailScope("info@24grad.net", "Markus Glaubitz", "impressum"), "generic");
  assert.equal(emailScope("m.glaubitz@24grad.net", "Markus Glaubitz", "impressum"), "personal");
  assert.equal(emailScope("contabil@escritorio.com.br", "Fulana de Tal", "registry_qsa"), "registry");
});

test("BrasilAPI: só administradores do QSA; matriz/filial e município da unidade", async () => {
  const body = {
    identificador_matriz_filial: 1, municipio: "FRANCA", uf: "SP", codigo_municipio_ibge: 3516200, cnae_fiscal: 1081302, descricao_situacao_cadastral: "ATIVA",
    ddd_telefone_1: "1633334444", email: "contato@contab.com.br",
    qsa: [{ nome_socio: "ANA SOCIA ADM", qualificacao_socio: "Sócio-Administrador" }, { nome_socio: "BRUNO SO COTISTA", qualificacao_socio: "Sócio" }],
  };
  const r = await brasilApiCnpj("12.345.678/0001-90", async (u) => {
    assert.equal(String(u), "https://brasilapi.com.br/api/cnpj/v1/12345678000190");
    return new Response(JSON.stringify(body), { status: 200 });
  });
  assert.deepEqual(r.people, [{ name: "ANA SOCIA ADM", title: "Sócio-Administrador" }]);
  assert.equal(r.unit.headOffice, true);
  await assert.rejects(brasilApiCnpj("12345678000190", async () => new Response("", { status: 429 })), (e) => e.kind === "temporary");
});

async function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, ["DEU", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const d = driver(ctx.env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  const analysis = (await ctx.api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  const sel = await ctx.api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  const searchId = (await ctx.api(`/api/campaigns/${sel.data.campaigns[0].id}/foreign-search`, "POST", { confirm: true })).data.id;
  const elements = [
    { type: "node", id: 11, tags: { name: "Kleine Rösterei", craft: "coffee_roaster", "addr:city": "Passau", website: "https://kleine-roesterei.example" } },
    { type: "node", id: 12, tags: { name: "Bohnen Werk", craft: "coffee_roaster", "addr:city": "Köln", website: "https://bohnen.example" } },
  ];
  await discover(req({ source: "osm" }), ctx.env, admin, "rid", searchId, { fetch: async () => new Response(JSON.stringify({ elements }), { status: 200 }) });
  const disc = (await ctx.api(`/api/foreign-searches/${searchId}/discovery`)).data;
  const acc = await ctx.api(`/api/foreign-searches/${searchId}/discovery/accept`, "POST", { ids: disc.processors.map((c) => c.id) });
  return { ...ctx, searchId, companyIds: acc.data.results.map((r) => r.companyId) };
}
const site = (pages, calls = []) => async (u) => {
  calls.push(String(u));
  const path = new URL(String(u)).pathname;
  return path in pages ? new Response(pages[path], { status: 200 }) : new Response("nope", { status: 404 });
};

test("Pesquisa de pessoas: empresa aderente, até 3, sem duplicar, reaproveita dentro do prazo e marca vencido", async (t) => {
  const { env, api, DB, companyIds, searchId } = await world(t);
  const [kr] = companyIds;
  const calls = [];
  const pages = { "/robots.txt": "User-agent: *\nDisallow: /intern", "/impressum": IMP_BM.replace(" | ", "</p><p>") };
  const at = "2026-10-11T10:00:00.000Z";
  const r = await researchCompany(req(), env, admin, "rid", kr, { fetch: site(pages, calls), now: at });
  assert.equal(r.added, 2);
  assert.equal(DB.raw.prepare("SELECT refresh_after FROM people_research WHERE company_id=?").get(kr).refresh_after, "2027-04-09T10:00:00.000Z", "Impressum: 180 dias");
  assert.equal(calls.length, 2, "robots + impressum: nada além do necessário");
  const again = await researchCompany(req(), env, admin, "rid", kr, { fetch: site(pages, calls), now: "2026-11-01T00:00:00.000Z" });
  assert.equal(again.reused, true);
  assert.equal(calls.length, 2, "dentro do prazo não consulta de novo");
  const row = DB.raw.prepare("SELECT * FROM person_candidates LIMIT 1").get();
  assert.doesNotMatch(row.name_encrypted, /Natalia|Konstantinova/, "nome criptografado");
  let v = await listPeople(env, admin, kr, { now: at });
  assert.equal(v.people.length, 2);
  const nat = v.people.find((p) => p.name === "Natalia Konstantinova");
  assert.equal(nat.state, "contato de compras a validar");
  assert.equal(nat.source.kind, "impressum");
  assert.equal(nat.source.verifiedAt, at);
  assert.match(nat.relevance, /a validar/);
  assert.equal(nat.email.scope, "personal");
  assert.equal(nat.email.validation, "not_validated");
  assert.equal(v.people.find((p) => p.name === "Yulia Yanyuk").email.scope, "generic", "o e-mail da Natalia não é da Yulia");
  assert.ok(v.assisted.some((l) => l.url.startsWith("https://www.linkedin.com/search/")), "LinkedIn só como link para consulta manual");
  // Vencido: depois de 180 dias o cargo aparece como desatualizado e a pesquisa volta a rodar.
  v = await listPeople(env, admin, kr, { now: "2027-06-01T00:00:00.000Z" });
  assert.equal(v.people[0].stale, true);
  const redo = await researchCompany(req(), env, admin, "rid", kr, { fetch: site(pages, calls), now: "2027-06-01T00:00:00.000Z" });
  assert.equal(redo.reused, false);
  assert.equal(redo.added, 0, "mesmas pessoas não duplicam");
  // Lote da busca: só a outra empresa aderente, ainda não pesquisada.
  const batch = await researchSearchBatch(req(), env, admin, "rid", searchId, { fetch: site({}), now: "2027-06-01T00:00:00.000Z" });
  assert.equal(batch.researched, 1);
  assert.equal(batch.remaining, 0);
  assert.equal(batch.results[0].sources[0].status, "not_found");
});

test("Aceitar vira contato (só e-mail pessoal publicado); estados cargo verificado e decisor confirmado; manual exige fonte", async (t) => {
  const { env, api, DB, companyIds } = await world(t);
  const [kr, bw] = companyIds;
  await researchCompany(req(), env, admin, "rid", kr, { fetch: site({ "/impressum": IMP_BM.replace(" | ", "</p><p>") }) });
  let v = (await api(`/api/companies/${kr}/people`)).data;
  const [nat, yul] = [v.people.find((p) => p.name.startsWith("Natalia")), v.people.find((p) => p.name.startsWith("Yulia"))];
  const a = await api(`/api/companies/${kr}/people/${nat.id}/accept`, "POST", {});
  assert.equal(a.status, 201);
  assert.equal(a.data.emailCopied, true);
  const b = await api(`/api/companies/${kr}/people/${yul.id}/accept`, "POST", {});
  assert.equal(b.data.emailCopied, false, "caixa de outra pessoa/geral não vira e-mail do contato");
  assert.equal((await api(`/api/companies/${kr}/people/${nat.id}/accept`, "POST", {})).status, 409);
  const ct = DB.raw.prepare("SELECT * FROM contacts WHERE id=?").get(a.data.contactId);
  assert.equal(ct.prospect_role, "provisional_decision_maker");
  assert.equal(ct.email_validation, "pending");
  assert.match(ct.source_label, /Impressum/);
  // Cargo verificado e decisor confirmado vêm só de verificação registrada (com demanda).
  const demandId = crypto.randomUUID();
  DB.raw.prepare("INSERT INTO demands(id,tenant_id,company_id,commodity,product_id,created_by) VALUES (?,?,?,?,?,?)").run(demandId, admin.tenant_id, kr, "coffee", "product-05", admin.id);
  const ver = (type) => api(`/api/companies/${kr}/contact-verifications`, "POST", { contactId: a.data.contactId, demandId, type, status: "confirmed", method: "Telefonema com a pessoa", sourceReference: "Registro interno 2026-10-11" });
  assert.equal((await ver("job_title")).status, 201);
  v = (await api(`/api/companies/${kr}/people`)).data;
  assert.equal(v.people.find((p) => p.id === nat.id).state, "cargo verificado");
  await ver("decision_authority");
  v = (await api(`/api/companies/${kr}/people`)).data;
  assert.equal(v.people.find((p) => p.id === nat.id).state, "decisor de compras confirmado");
  assert.deepEqual([v.counts.identified, v.counts.titleVerified, v.counts.decidersConfirmed, v.counts.emailsValidated], [2, 1, 1, 0]);
  // Registro manual: fonte obrigatória; e-mail sem fonte (padrão do domínio) é recusado; limite de 3.
  const add = (body) => api(`/api/companies/${bw}/people`, "POST", body);
  assert.equal((await add({ name: "Eva Einkauf", title: "Leiterin Einkauf", sourceKind: "company_site" })).status, 422);
  assert.equal((await add({ name: "Eva Einkauf", title: "Leiterin Einkauf", sourceKind: "linkedin_manual", sourceUrl: "https://www.linkedin.com/in/eva", email: "eva.einkauf@bohnen.example" })).data.error.code, "email_source_required");
  assert.equal((await add({ name: "Eva Einkauf", title: "Leiterin Einkauf", sourceKind: "linkedin_manual", sourceUrl: "https://www.linkedin.com/in/eva" })).status, 201);
  assert.equal((await add({ name: "Einkauf Eva", title: "Einkauf", sourceKind: "manual", sourceUrl: "https://bohnen.example/team" })).status, 409, "mesma pessoa com nome invertido");
  await add({ name: "Otto Zwei", title: "Sourcing", sourceKind: "company_site", sourceUrl: "https://bohnen.example/team" });
  await add({ name: "Paula Drei", title: "Procurement", sourceKind: "company_site", sourceUrl: "https://bohnen.example/team" });
  assert.equal((await add({ name: "Quarta Pessoa", title: "Einkauf", sourceKind: "company_site", sourceUrl: "https://bohnen.example/team" })).status, 409);
});

test("Triagem: empresa sem perfil não é pesquisada; micro, grande/grupo e trader são pesquisados, trader por último no lote", async (t) => {
  const { env, DB, companyIds, searchId } = await world(t);
  const [a, b] = companyIds;
  DB.raw.prepare("DELETE FROM buyer_profiles WHERE company_id=?").run(a);
  const calls = [];
  const r = await researchCompany(req(), env, admin, "rid", a, { fetch: site({}, calls) });
  assert.equal(r.skipped, true);
  assert.match(r.reason, /sem perfil comprador/);
  assert.equal(calls.length, 0);
  // Porte ordena, não exclui (2026-09-30).
  for (const st of ["out_small", "out_giant", "out_trader"]) {
    DB.raw.prepare("UPDATE buyer_profiles SET icp_status=? WHERE company_id=?").run(st, b);
    DB.raw.prepare("DELETE FROM people_research WHERE company_id=?").run(b);
    const x = await researchCompany(req(), env, admin, "rid", b, { fetch: site({}) });
    assert.notEqual(x.skipped, true, st);
  }
});

test("Triagem na busca: prioridade secundária, descarte por empresa/produto com histórico, pontos a verificar; lote pula descartada", async (t) => {
  const { api, DB, env, companyIds, searchId } = await world(t);
  const [kr, bw] = companyIds;
  const base = `/api/foreign-searches/${searchId}/candidates`;
  assert.equal((await api(`${base}/${bw}`, "PATCH", { action: "dismiss" })).status, 422, "descarte exige motivo");
  assert.equal((await api(`${base}/${kr}`, "PATCH", { action: "priority", priority: "secondary", reason: "Pertence a grupo; autonomia de compras a verificar" })).status, 200);
  const chk = await api(`${base}/${kr}/checks`, "POST", { topic: "Vínculo com grupo", note: "Registro comercial lista sócia do grupo", sourceUrl: "https://www.northdata.com/x" });
  assert.equal(chk.status, 201);
  await api(`${base}/${kr}/checks`, "POST", { topic: "Autonomia de compras" });
  assert.equal((await api(`${base}/${bw}`, "PATCH", { action: "dismiss", reason: "Treinamento e eventos; sem compra de café verde" })).status, 200);
  let s = (await api(`/api/foreign-searches/${searchId}`)).data;
  const cards = Object.values(s.groups).flat();
  assert.equal(cards.length, 1, "descartada sai dos grupos");
  assert.equal(s.dismissed[0].id, bw);
  assert.match(s.dismissed[0].triage.dismissReason, /sem compra de café verde/);
  assert.equal(s.metrics.yield.dismissedInSearch, 1);
  assert.equal(cards[0].triage.priority, "secondary");
  assert.equal(cards[0].checks.filter((k) => k.status === "open").length, 2);
  assert.ok(cards[0].pending.includes("A verificar: Vínculo com grupo."));
  assert.ok(s.humanSteps.some((h) => /2 ponto\(s\) a verificar/.test(h)));
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies WHERE id=?").get(bw).n, 1, "empresa preservada");
  // Lote de pessoas: descartada fica de fora.
  const batch = await researchSearchBatch(req(), env, admin, "rid", searchId, { fetch: site({}) });
  assert.deepEqual(batch.results.map((r) => r.companyId), [kr]);
  assert.equal(batch.remaining, 0);
  // Conclusão do ponto exige texto; volta da descartada fica no histórico de auditoria.
  assert.equal((await api(`${base}/${kr}/checks/${chk.data.id}`, "PATCH", { status: "confirmed" })).status, 422);
  assert.equal((await api(`${base}/${kr}/checks/${chk.data.id}`, "PATCH", { status: "confirmed", resolution: "Handelsregister conferido em 2026-10-01" })).status, 200);
  assert.equal((await api(`${base}/${kr}/checks/${chk.data.id}`, "PATCH", { status: "cleared", resolution: "x" })).status, 404, "já concluído");
  assert.equal((await api(`${base}/${bw}`, "PATCH", { action: "restore" })).status, 200);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action IN ('foreign_search.candidate_priority','foreign_search.candidate_dismiss','foreign_search.candidate_restore')").get().n, 3);
  s = (await api(`/api/foreign-searches/${searchId}`)).data;
  assert.equal(s.dismissed.length, 0);
});

test("Contatos das candidatas: aviso legal lido antes do aceite, guardado cifrado como evidência e reaproveitado depois do aceite", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  keepCountries(ctx.DB, ["DEU", "CHN"]);
  await tradeParams(ctx.api, { period_default_months: 12 });
  const d = driver(ctx.env, sources(), { at: "2026-10-10T12:00:00.000Z" });
  await d.start();
  await d.drain();
  const analysis = (await ctx.api("/api/country-analyses", "POST", { iso3: "DEU" })).data;
  const sel = await ctx.api(`/api/country-analyses/${analysis.id}/selections`, "POST", { items: [{ productId: "product-05", label: "Café", hs6: ["090111"] }] });
  const searchId = (await ctx.api(`/api/campaigns/${sel.data.campaigns[0].id}/foreign-search`, "POST", { confirm: true })).data.id;
  const elements = [{ type: "node", id: 21, tags: { name: "Kleine Rösterei", craft: "coffee_roaster", "addr:city": "Passau", website: "https://kleine-roesterei.example" } }];
  await discover(req({ source: "osm" }), ctx.env, admin, "rid", searchId, { fetch: async () => new Response(JSON.stringify({ elements }), { status: 200 }) });
  const calls = [];
  const pages = { "/impressum": IMP_BM.replace(" | ", "</p><p>") };
  const { researchCandidateContacts } = await import("../src/discovery.js");
  const r = await researchCandidateContacts(req({}), ctx.env, admin, "rid", searchId, { fetch: site(pages, calls) });
  assert.deepEqual([r.checked, r.reusedFromCache, r.withPeople], [1, 0, 1]);
  const raw = ctx.DB.raw.prepare("SELECT result_json FROM research_cache WHERE source='impressum'").get().result_json;
  assert.doesNotMatch(raw, /Natalia|Konstantinova/, "nomes cifrados no cache");
  const disc = (await ctx.api(`/api/foreign-searches/${searchId}/discovery`)).data;
  const cand = disc.processors[0];
  assert.equal(cand.status, "new", "pesquisar contatos não aceita a empresa");
  assert.deepEqual(cand.contactEvidence.people.map((p) => p.name), ["Natalia Konstantinova", "Yulia Yanyuk"]);
  assert.match(cand.contactEvidence.people[0].kind, /a validar/);
  assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM person_candidates").get().n, 0, "nenhuma pessoa gravada antes do aceite");
  // Depois do aceite, a pesquisa de pessoas reaproveita o cache (nenhuma requisição nova).
  const acc = await ctx.api(`/api/foreign-searches/${searchId}/discovery/accept`, "POST", { ids: [cand.id] });
  const after = [];
  await researchCompany(req(), ctx.env, admin, "rid", acc.data.results[0].companyId, { fetch: site(pages, after) });
  assert.equal(after.length, 0);
});

test("Aviso legal: site que recusa a conexão fica 'inacessível' (não 'sem aviso legal') e expira em 7 dias", async () => {
  const { impressumPeople } = await import("../src/adapters/people.js");
  const r = await impressumPeople("https://recusa.example", async () => new Response("forbidden", { status: 403 }));
  assert.equal(r.status, "unreachable");
  assert.equal(r.httpStatus, 403);
  const nf = await impressumPeople("https://semimpressum.example", async (u) => (new URL(String(u)).pathname === "/" ? new Response("<a href='/kontakt'>Kontakt</a>", { status: 200 }) : new Response("", { status: 404 })));
  assert.equal(nf.status, "not_found");
});
