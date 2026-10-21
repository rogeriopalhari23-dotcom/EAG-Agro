// Antes da publicação (2026-10-21): pesquisa sem o limite dos cinco maiores produtos, empresa reaproveitada em todo o
// Compass com relações independentes por produto, decisor por produto e classificação reutilizada sem perguntas repetidas.
// Tudo SIMULADO (lista mensal de teste, Receita fictícia, R2 em memória); nenhuma rede real.
import test from "node:test";
import { legacyJob } from "./helpers/legacy-job.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setup } from "./helpers/db.mjs";
import { sources, keepCountries, tradeParams, driver, AGRI, COMTRADE, rec, MDIC_ROWS } from "./helpers/trade.mjs";
import { internalCaller } from "../src/worker.js";
import { runJob } from "../src/prospect/engine.js";
import { restrictionsFor } from "../src/restrictions.js";

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url)));
const CORN = (() => { const c = read("docs/implementation/rodadas/exemplos/milho-gmo-indiara-300km.json"); return { ...c, id: "teste-milho-reuso", sources: c.sources.filter((x) => x.id !== "casadosdados") }; })();
// Fábrica de ração fictícia: a Receita (simulada) informa a CNAE 1066-0/00 (fabricação de alimentos para animais).
const REG = { "11111111000191": { razao_social: "ALFA NUTRICAO ANIMAL LTDA (FICTICIA)", estabelecimento: { situacao_cadastral: "Ativa", cidade: { nome: "Rio Verde" }, estado: { sigla: "GO" }, tipo: "Matriz", atividade_principal: { subclasse: "1066000", descricao: "Fabricação de alimentos para animais" } } } };

async function world(t) {
  const ctx = setup();
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const m = /publica\.cnpj\.ws\/cnpj\/(\d{14})/.exec(String(url));
    if (m) return REG[m[1]] ? Response.json(REG[m[1]]) : new Response("{}", { status: 404 });
    throw new Error(`rede bloqueada no teste: ${url}`);
  };
  t.after(() => ((globalThis.fetch = real), ctx.close()));
  const grant = () => ctx.api("/api/prospect/policy", "POST", { confirm: true, reference: "Decisão de teste (fictícia)" });
  const deps = { call: internalCaller(ctx.env, "rid-teste"), fetch: globalThis.fetch };
  // Executa a prospecção até parar (decisão, espera longa ou fim), "passando o tempo" do limite da Receita.
  const drive = async (id, extra = {}) => {
    let clock = Date.now();
    for (let k = 0; k < 30; k++) {
      clock += 120_000;
      ctx.DB.raw.prepare("UPDATE round_source_calls SET called_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes')").run();
      await runJob(ctx.env, id, { ...deps, ...extra, now: () => new Date(clock).toISOString() });
      const j = (await ctx.api(`/api/prospect/jobs/${id}`)).data;
      if (["done", "failed", "needs_decision", "paused", "cancelled"].includes(j.status) || j.waitingFor === "market_evidence") return j;
    }
    return (await ctx.api(`/api/prospect/jobs/${id}`)).data;
  };
  return { ...ctx, grant, deps, drive };
}

// Rodada de milho com a fábrica de ração (CNPJ fictício), executada e cadastrada em descoberta.
async function cornCompany(api, DB) {
  const r = await api("/api/rounds", "POST", { name: "Teste milho (reaproveitamento)", config: { ...CORN, commodity: { ...CORN.commodity, productId: "product-03" } } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const base = `/api/rounds/${r.data.id}`;
  await api(`${base}/candidates`, "POST", { intake: "assisted", candidate: { name: "Alfa Nutrição Animal (fictícia)", registrationId: "11.111.111/0001-91", municipality: "Rio Verde", region: "GO", segment: "feed_mill", sourceUrl: "https://alfa.previa.invalid/milho", evidence: { kind: "commodity_use", strength: "own_source", quote: "fabricamos ração com milho" } } });
  await api(`${base}/preflight-ack`, "POST", { revision: (await api(base)).data.revision });
  DB.raw.prepare("UPDATE round_source_calls SET called_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes')").run();
  assert.ok((await api(`${base}/run`, "POST", {})).status < 300);
  const out = (await api(`${base}/register`, "POST", { mode: "discovery", productId: "product-03" })).data;
  assert.equal(out.items[0]?.outcome, "created", JSON.stringify(out));
  return out.items[0].companyId;
}

test("empresa já cadastrada para milho reaparece na pesquisa de soja: relação nova não confirmada, sem copiar compra nem decisor; retomada sem duplicar", async (t) => {
  const { api, DB, env, grant, drive } = await world(t);
  await grant();
  const companyId = await cornCompany(api, DB);
  // Cadastro único por unidade: o CNPJ da rodada virou unidade com município, coordenada do município e CNAE.
  const unit = DB.raw.prepare("SELECT cnpj,primary_cnae,lat,geo_precision FROM company_units WHERE company_id=?").all(companyId);
  assert.equal(unit.length, 1);
  assert.equal(unit[0].primary_cnae, "1066000");
  assert.equal(unit[0].geo_precision, "municipality_centroid");
  // Confirmação de compra e decisor registrados só para o milho.
  DB.raw.prepare("INSERT INTO company_conditions(tenant_id,company_id,product_id,condition,status,note,updated_by) VALUES ('eag-internal',?,'product-03','buys_commodity','not_found','teste','system-admin')").run(companyId);
  const a = await api(`/api/companies/${companyId}/contacts`, "POST", { fullName: "Ana Compras (fictícia)", jobTitle: "Compradora de milho", prospectRole: "decision_maker", sourceLabel: "Site da empresa (fictício)", productId: "product-03" });
  assert.equal(a.status, 201, JSON.stringify(a.data));

  const job = (await api("/api/prospect/jobs", "POST", { market: "national", productId: "product-01", location: { region: "GO", municipality: "Rio Verde" }, radius: { value: 150, unit: "km" } })).data;
  let j = await drive(job.id);
  const ev = j.events.find((e) => e.step === "existing");
  assert.ok(ev, JSON.stringify(j.events.map((e) => `${e.step}: ${e.message}`)));
  assert.match(ev.message, /Empresas já cadastradas com atividade compatível com Soja GMO: 1 usuária\(s\) dentro do raio.*Relação "a investigar".*Compra, decisor e contato de outras commodities não foram copiados/);
  const prof = DB.raw.prepare("SELECT product_id,profile_class,basis,updated_by FROM buyer_profiles WHERE company_id=? ORDER BY product_id").all(companyId);
  assert.deepEqual(prof.map((x) => x.product_id), ["product-01", "product-03"], "uma relação por produto; a do milho preservada");
  const soja = prof.find((x) => x.product_id === "product-01");
  assert.equal(soja.profile_class, "unconfirmed", "compatibilidade não prova compra");
  assert.match(soja.basis, /CNAE 1066-0\/00 \(fabricação de alimentos para animais\).*não prova de compra/);
  assert.equal(soja.updated_by, "system-prospect", "automação sob a política, não clique de pessoa");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM company_conditions WHERE company_id=? AND product_id='product-01' AND status='confirmed'").get(companyId).n, 0, "confirmação de compra não propagada");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM contact_products WHERE product_id='product-01'").get().n, 0, "decisor do milho não vira decisor da soja");
  const dec = (pid) => api(`/api/companies/decisors?ids=${companyId}&productId=${pid}`).then((r) => r.data.items[companyId]);
  assert.equal((await dec("product-03")).summary?.name, "Ana Compras (fictícia)");
  const ds = await dec("product-01");
  assert.equal(ds.summary, null, "sem decisor da soja");
  assert.equal(ds.people[0].productScope, "other_product");
  assert.match(ds.people[0].productScopeLabel, /responde por Milho GMO/);
  // Estado da etapa (o relatório só sai no fim; a busca no mapa depende do navegador nesta simulação).
  const st = JSON.parse(DB.raw.prepare("SELECT state_json FROM prospect_jobs WHERE id=?").get(job.id).state_json).existing;
  assert.equal(st.count, 1);
  assert.deepEqual(st.items[0].otherProducts, ["Milho GMO"]);

  // Retomada: rodar de novo não duplica nada; nova pesquisa do mesmo produto não acha "nova" relação.
  const before = DB.raw.prepare("SELECT COUNT(*) n FROM buyer_profiles").get().n;
  await runJob(env, job.id, { call: internalCaller(env, "rid-teste"), fetch: globalThis.fetch });
  DB.raw.prepare("UPDATE prospect_jobs SET status='done' WHERE id=?").run(job.id);
  const again = (await api("/api/prospect/jobs", "POST", { market: "national", productId: "product-01", location: { region: "GO", municipality: "Rio Verde" }, radius: { value: 150, unit: "km" } })).data;
  j = await drive(again.id);
  assert.match(j.events.find((e) => e.step === "existing").message, /Nenhuma empresa já cadastrada com atividade compatível/);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM buyer_profiles").get().n, before, "sem relação duplicada");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies").get().n, 1, "sem empresa duplicada");

  // Pausa da empresa continua valendo para qualquer commodity; a relação nova a informa e não a contorna.
  DB.raw.prepare("INSERT INTO pauses(id,tenant_id,scope,scope_ref,reason,created_by) VALUES ('p-reuso','eag-internal','company',?,'Oposição registrada (fictícia)','system-admin')").run(companyId);
  for (const commodity of ["corn", "soy"]) assert.ok((await restrictionsFor(env, "eag-internal", { companyId, commodity })).includes("paused_company"));
  const ex = (await api(`/api/rounds/${(await api("/api/rounds")).data.items?.[0]?.id ?? DB.raw.prepare("SELECT id FROM discovery_rounds LIMIT 1").get().id}/existing`)).data;
  assert.ok(Array.isArray(ex.items));
});

test("decisores diferentes por produto: cada pessoa conta só para o produto vinculado; contato sem vínculo fica 'produto não informado'", async (t) => {
  const { api, DB } = await world(t);
  const companyId = await cornCompany(api, DB);
  const add = (body) => api(`/api/companies/${companyId}/contacts`, "POST", { sourceLabel: "Site da empresa (fictício)", prospectRole: "decision_maker", ...body });
  const a = (await add({ fullName: "Ana Milho (fictícia)", productId: "product-03" })).data.id;
  const b = (await add({ fullName: "Bruno Farelo (fictício)", productId: "product-16" })).data.id;
  await add({ fullName: "Carla Sem Produto (fictícia)" });
  const get = async (pid) => (await api(`/api/companies/decisors?ids=${companyId}${pid ? `&productId=${pid}` : ""}`)).data.items[companyId];
  const corn = await get("product-03"), meal = await get("product-16");
  assert.equal(corn.summary.name, "Ana Milho (fictícia)");
  assert.equal(meal.summary.name, "Bruno Farelo (fictício)");
  assert.equal(corn.people.find((p) => p.name === "Bruno Farelo (fictício)").buyer, false, "o decisor do farelo não conta para o milho");
  assert.equal(corn.people.find((p) => p.name === "Carla Sem Produto (fictícia)").productScope, "not_informed");
  assert.equal(corn.people.find((p) => p.name === "Carla Sem Produto (fictícia)").buyer, false);
  // Vínculo novo só por registro explícito, com fonte; repetir é recusado.
  const l = await api(`/api/contacts/${a}/products`, "POST", { productId: "product-16", role: "influencer", sourceLabel: "Ligação registrada (fictícia)" });
  assert.equal(l.status, 201, JSON.stringify(l.data));
  assert.equal((await api(`/api/contacts/${a}/products`, "POST", { productId: "product-16", role: "influencer", sourceLabel: "x" })).status, 409);
  const meal2 = await get("product-16");
  assert.equal(meal2.people.find((p) => p.name === "Ana Milho (fictícia)").roleLabel, "influenciador", "papel próprio em cada produto");
  assert.equal(meal2.summary.name, "Bruno Farelo (fictício)");
  assert.ok(DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='contact.product_linked'").get().n >= 1);
  assert.equal((await get()).summary.name !== undefined, true, "sem produto: leitura geral de antes");
  void b;
});

test("importação de lote: empresa existente recebe só a relação do novo produto, sem duplicar nem substituir", async (t) => {
  const { api, DB } = await world(t);
  const companyId = await cornCompany(api, DB);
  const body = { productId: "product-16", unit: { cnpj: "11111111000191", municipality: "Rio Verde", uf: "GO" }, evidence: [{ category: "business", evidenceType: "company_document", market: "national", consultedAt: "2026-10-21", reference: "Usamos farelo de soja na ração (fictício)", sourceUrl: "https://alfa.previa.invalid/farelo", validationStatus: "pending" }], profile: { profileClass: "possible_final_consumer", basis: "Importação de lote (fictícia)" } };
  const r1 = await api(`/api/companies/${companyId}/relations`, "POST", body);
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  assert.equal(r1.data.profile, "added");
  assert.equal(r1.data.evidence.added, 1);
  const r2 = await api(`/api/companies/${companyId}/relations`, "POST", body);
  assert.equal(r2.data.evidence.added, 0);
  assert.equal(r2.data.evidence.reused, 1, "mesma evidência não se repete");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM buyer_profiles WHERE company_id=?").get(companyId).n, 2);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM company_units WHERE company_id=?").get(companyId).n, 1, "unidade única pelo CNPJ");
});

// Lista mensal simulada: na Alemanha, o café (SH 090111) é só a 7ª subposição exportada pelo Brasil (fora das cinco
// maiores); nos EUA, óleo de palma com comércio registrado e nenhum conector de empresas (limitação de cobertura).
async function tradeWorld(t) {
  const ctx = await world(t);
  const { api, DB, env } = ctx;
  const snap = (tb) => DB.raw.prepare(`SELECT * FROM ${tb}`).all();
  const saved = { countries: snap("countries"), country_mdic_codes: snap("country_mdic_codes") };
  keepCountries(DB, ["DEU", "USA"]);
  await tradeParams(api, { period_default_months: 12, agri_classification: { ...AGRI, chapters: ["01", "02", "09", "12", "15", "17"] } });
  const big = [["12019000", 200000], ["17011400", 210000], ["17019900", 220000], ["01012100", 230000], ["02013000", 240000], ["12011000", 250000]];
  const mdicRows = { ...MDIC_ROWS, 2026: [...MDIC_ROWS[2026], ...big.map(([n, v]) => `"2026";"02";"${n}";"10";"023";"SP";"01";"0817600";${v};${v};${v}`), '"2026";"02";"15111000";"10";"249";"PA";"01";"0817600";40000;40000;40000'] };
  const ncm = ['"17019900";"10";"170199";"Outros açúcares";"Other sugar"', '"01012100";"10";"010121";"Cavalos";"Horses"', '"02013000";"10";"020130";"Carne bovina";"Beef"', '"12011000";"10";"120110";"Soja para semeadura";"Soy seed"', '"15111000";"10";"151110";"Óleo de palma em bruto";"Crude palm oil"'];
  // Comtrade da Alemanha sem linha de origem Brasil para o café: a evidência vem só do MDIC (7ª subposição).
  const comtrade = { 276: { ...COMTRADE[276], rows: [rec(276, "090111", 2025, 0, 100), rec(276, "170114", 2024, 0, 50)] } };
  const d = driver(env, sources({ mdicRows, ncm, comtrade }), { at: new Date().toISOString() });
  await d.start();
  await d.drain();
  for (const [tb, rows] of Object.entries(saved)) for (const r of rows) DB.raw.prepare(`INSERT OR IGNORE INTO ${tb} (${Object.keys(r).join(",")}) VALUES (${Object.keys(r).map(() => "?").join(",")})`).run(...Object.values(r));
  return { ...ctx, d };
}
const confirm = async (api, id, code) => {
  const p = (await api(`/api/catalog/${id}`)).data;
  const r = await api(`/api/catalog/${id}/codes`, "POST", { codeSystem: "HS", code, status: "confirmed", classificationVersion: "HS2022", sourceRef: "Teste (fictício)", expectedRevision: p.revision, reason: "Teste" });
  assert.ok(r.status < 300, JSON.stringify(r.data));
};

test("pesquisa automática internacional: commodity fora das cinco maiores do país entra; mercado sem conector fica como limitação de cobertura", async (t) => {
  const { api, DB, grant } = await tradeWorld(t);
  await grant();
  await confirm(api, "product-05", "090111");
  await confirm(api, "product-22", "151110");
  const r = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
  assert.equal(r.started, true, JSON.stringify(r));
  const sum = DB.raw.prepare("SELECT top_json,hs6_json FROM trade_country_summary WHERE iso3='DEU' AND source='mdic'").get();
  assert.ok(sum, "resumo do MDIC da Alemanha");
  const top = JSON.parse(sum.top_json).map((x) => x.hs6);
  assert.equal(top.length, 5);
  assert.ok(!top.includes("090111"), `café fora das cinco maiores (${top})`);
  assert.ok(JSON.parse(sum.hs6_json)["090111"] > 0, "mas na lista completa de subposições");
  assert.equal(r.job.input.location.iso3, "DEU");
  assert.match(r.reason, /Café .*× Alemanha: exportações do Brasil para Alemanha \(MDIC.*SH 090111.*Fontes de empresas: .*Kaffeeverband/);
  // Mercado com evidência e sem fonte de empresas: limitação de cobertura, não esquecimento nem ausência de compradores.
  assert.equal(r.coverage.gapCount, 1, JSON.stringify(r.coverage));
  assert.match(r.coverage.gaps[0].label, /Óleo de palma.*Estados Unidos/);
  assert.match(r.coverage.gaps[0].coverage, /nenhum conector de empresas cobre este país e esta commodity/);
  assert.match(r.coverage.note, /limitação de cobertura, não ausência de compradores/);
  assert.equal(r.job.choice?.coverageGaps ?? JSON.parse(DB.raw.prepare("SELECT state_json FROM prospect_jobs WHERE id=?").get(r.job.id).state_json).choice.coverageGaps, 1);
  // Resumo antigo, sem a lista completa: refeito do objeto oficial guardado (sem chamada externa); o mercado continua.
  DB.raw.prepare("UPDATE trade_country_summary SET hs6_json=NULL").run();
  const again = (await api("/api/prospect/auto", "POST", { market: "international" })).data;
  assert.equal(again.started, false, "a combinação em andamento não é duplicada");
  assert.ok(again.reasons.some((x) => /já têm pesquisa em andamento/.test(x)), JSON.stringify(again));
  assert.equal(again.coverage.gapCount, 1, "o mercado sem conector continua listado");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_country_summary WHERE hs6_json IS NULL").get().n, 0, "resumos completos refeitos do R2");
  assert.doesNotMatch(JSON.stringify(again), /não há compradores|sem compradores/);
});

test("classificação persistida: seleção de mercado sem perguntas, característica já registrada reaproveitada; VHP e álcool usam a faixa documentada sem pergunta de lote", async (t) => {
  const { api, DB, env, grant, d, drive } = await tradeWorld(t);
  await grant();
  const extra = { trade: d.deps };
  const job = async (productId, iso3) => (await legacyJob(env, { market: "international", productId, location: { iso3 } })).id;
  // VHP: a faixa da ficha (99,30–99,60%) cobre 1701.14 e 1701.99: pesquisa de mercado nas duas, nenhuma pergunta de lote.
  const v = await drive(await job("product-08", "USA"), extra);
  assert.notEqual(v.decision?.kind, "classification_characteristic", JSON.stringify(v.decision));

  const vc = DB.raw.prepare("SELECT code,scope FROM product_codes WHERE product_id='product-08' AND code_system='HS' ORDER BY code").all();
  assert.deepEqual(vc.map((x) => [x.code, x.scope]), [["170114", "research"], ["170199", "research"]]);
  assert.ok(v.events.some((e) => /resolvida automaticamente .*para a pesquisa de mercado .*polarização do lote.*nenhuma característica de lote foi pedida/.test(e.message)));
  const fact = DB.raw.prepare("SELECT char_value,source_ref,verified_at FROM product_characteristics WHERE product_id='product-08' AND char_key='classificacao:polarizacao_especificada'").get();
  assert.equal(fact.char_value, "99,30% a 99,60%");
  assert.match(fact.source_ref, /Ficha técnica interna EAG/);
  assert.match(fact.verified_at, /^\d{4}-\d{2}-\d{2}$/, "fato com fonte e data");
  // Álcool: as duas subposições da posição 2207, sem perguntar o desnaturante do lote.
  const al = await drive(await job("product-11", "USA"), extra);
  assert.notEqual(al.decision?.kind, "classification_characteristic");
  assert.deepEqual(DB.raw.prepare("SELECT code FROM product_codes WHERE product_id='product-11' ORDER BY code").all().map((x) => x.code), ["220710", "220720"]);

  // Café: cru ou torrado não é indispensável para escolher o mercado. Duas pesquisas, nenhuma pergunta: a seleção usa
  // todas as subposições do café; a característica fica para a etapa comercial.
  const c1 = await job("product-05", "DEU"), c2 = await job("product-05", "USA");
  const j1 = await drive(c1, extra), j2 = await drive(c2, extra);
  for (const j of [j1, j2]) assert.notEqual(j.decision?.kind, "classification_characteristic", JSON.stringify(j.decision));
  assert.deepEqual(DB.raw.prepare("SELECT code,scope FROM product_codes WHERE product_id='product-05' AND code_system='HS' ORDER BY code").all().map((x) => [x.code, x.scope]), [["090111", "research"], ["090112", "research"], ["090121", "research"], ["090122", "research"]]);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM product_characteristics WHERE product_id='product-05'").get().n, 0, "nada perguntado nem gravado como resposta");
  // Característica já registrada (ex.: informada antes na etapa comercial) continua valendo e refina sem nova pergunta.
  DB.raw.prepare("DELETE FROM product_codes WHERE product_id='product-05'").run();
  DB.raw.prepare("INSERT INTO product_characteristics(id,product_id,char_key,char_value,source_ref,status,verified_at) VALUES ('ch-cafe','product-05','classificacao:estado_do_cafe','cru_nao_descafeinado','Informado por Teste (fictício)','confirmed','2026-10-21')").run();
  for (const id of [c1, c2]) DB.raw.prepare("UPDATE prospect_jobs SET status='done' WHERE id=?").run(id);
  const c3 = await drive(await job("product-05", "DEU"), extra);
  assert.ok(c3.events.some((e) => /Característica do produto já registrada no catálogo reaproveitada \(estado_do_cafe = cru_nao_descafeinado\), sem nova pergunta/.test(e.message)), JSON.stringify(c3.events.map((e) => e.message)));
  assert.deepEqual(DB.raw.prepare("SELECT code FROM product_codes WHERE product_id='product-05' AND code_system='HS'").all().map((x) => x.code), ["090111"]);
  void env;
});
