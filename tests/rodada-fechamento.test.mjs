// Fechamento da pesquisa por estabelecimento (src/rodada/closure.js), no relatório e no painel, com triagens e validade.
// Regras gerais, sem nenhuma empresa específica; tudo local, com Receita simulada.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateRoundConfig } from "../src/rodada/config.js";
import { closureFor } from "../src/rodada/closure.js";
import { assess } from "../src/rodada/qualify.js";
import { renderReport } from "../src/rodada/report.js";
import { setup } from "./helpers/db.mjs";

const ex = (n) => JSON.parse(readFileSync(new URL(`../docs/implementation/rodadas/exemplos/${n}.json`, import.meta.url), "utf8"));
const NOW = "2026-10-16T12:00:00.000Z";
const cfg = (over = {}) => { const v = validateRoundConfig({ ...ex("soja-rio-verde-150km"), ...over }); assert.ok(v.ok, v.errors?.join("; ")); return v.config; };
const est = (evidence, extra = {}) => ({ key: "BR:1", country: "BR", registrationId: "00000000000191", provisional: false, names: ["X"], municipalities: ["Rio Verde"], evidence, hints: {}, ...extra });
const dist = { km: 40, label: "40 km (ESTIMADA: centroide do município)", estimated: true, nearLimit: false };
const close = (e, config, registry = { status: "Ativa", municipality: "Rio Verde", region: "GO", activity: "1066-0/00 Fabricação de alimentos para animais", size: "unknown" }, d = dist) =>
  closureFor({ est: e, assessment: assess(e, config, { now: NOW, registry }), registry, distance: d, config, lookup: { status: "cached" } });

test("Fechamento: verificado só com prova; desconhecidos listados uma vez; contato futuro pelo que fonte pública não responde", () => {
  const c = cfg();
  const r = close(est([{ kind: "operation", strength: "own_source", url: "https://x.example/fabrica", quote: "fábrica em operação" }]), c);
  assert.ok(r.verified.some((v) => v.field === "operation" && v.sources[0] === "https://x.example/fabrica"));
  assert.ok(r.verified.some((v) => v.field === "registry"));
  const unknownFields = r.unknown.map((u) => u.field);
  for (const f of ["commodity_use", "purchase", "role", "purchasing_channel", "size", "unit_location"]) assert.ok(unknownFields.includes(f), f);
  assert.equal(new Set(unknownFields).size, unknownFields.length, "cada campo desconhecido aparece uma vez");
  assert.equal(r.publicResearch, "open");
  // Com a pesquisa aberta, só vai para contato o que fonte pública normalmente não responde.
  assert.deepEqual(r.contact.map((x) => x.field).sort(), ["purchase", "purchasing_channel"]);
  // Encerrada a fase pública, todos os desconhecidos viram contato futuro, sem pedido de confirmação campo a campo.
  const closed = close(est([]), cfg({ research: { publicPhase: "closed" } }));
  assert.equal(closed.publicResearch, "closed");
  assert.deepEqual(closed.contact.map((x) => x.field), closed.unknown.map((x) => x.field));
  // Variedade configurada: aceitação vai para contato por natureza.
  const pilot = validateRoundConfig(ex("milho-gmo-indiara-300km")).config;
  assert.ok(close(est([]), pilot).contact.some((x) => x.field === "variety_acceptance"));
  assert.match(validateRoundConfig({ ...ex("soja-rio-verde-150km"), research: { publicPhase: "talvez" } }).errors.join(), /research\.publicPhase/);
});

test("Conflitos de fonte: marcados na evidência e papel divergente entre cadastro oficial (CNAE) e registro de fabricante", () => {
  const c = cfg();
  const fab = { kind: "activity_code", strength: "official_record", url: "https://registro.example", quote: "Registro: FABRICANTE RAÇÃO" };
  const trade = close(est([fab]), c, { status: "Ativa", municipality: "Rio Verde", region: "GO", activity: "4692-3/00 Comércio atacadista de mercadorias em geral", url: "https://cadastro.example/1" });
  assert.ok(trade.conflicts.some((x) => x.field === "role" && /comércio \(4692-3\/00/.test(x.text)));
  const storage = close(est([fab]), c, { status: "Ativa", activity: "5211-7/01 Armazéns gerais" });
  assert.match(storage.conflicts[0].text, /armazenagem/);
  assert.equal(close(est([fab]), c).conflicts.length, 0, "CNAE de indústria com registro de fabricante: sem conflito");
  const marked = close(est([{ kind: "activity_code", strength: "own_source", url: "https://grupo.example", quote: "site do grupo: armazém de grãos; entidade pode ser outra", conflict: true }]), c);
  assert.ok(marked.conflicts.some((x) => x.sources[0] === "https://grupo.example"));
  // Fora do Brasil não há regra de CNAE: nenhum conflito inventado.
  assert.equal(close(est([fab], { country: "DE" }), c, { status: "active", activity: "4692" }).conflicts.length, 0);
});

test("Localização: perto do limite pelo centroide fica como desconhecida com conferência pendente; coordenada da unidade verifica", () => {
  const c = cfg();
  const near = close(est([]), c, undefined, { km: 96, label: "96 km (ESTIMADA: centroide do município)", estimated: true, nearLimit: true });
  assert.match(near.unknown.find((u) => u.field === "unit_location").text, /conferência do limite pendente/);
  const unit = close(est([]), c, undefined, { km: 96, label: "96 km (coordenada da unidade)", estimated: false, nearLimit: true });
  assert.ok(unit.verified.some((v) => v.field === "unit_location"));
});

test("Relatório: seções de verificado, conflitos, desconhecidos, contato futuro e triagens com validade", () => {
  const c = cfg({ research: { publicPhase: "closed" } });
  const e = est([]);
  const a = assess(e, c, { now: NOW });
  const result = { key: e.key, names: ["Empresa Teste"], registrationId: e.registrationId, status: "discovery", reasons: [], checks: [], municipality: "Rio Verde", distance: dist, assessment: a, pending: a.pending, closure: closureFor({ est: e, assessment: a, registry: null, distance: dist, config: c }) };
  const md = renderReport({ config: c, origin: { label: "Rio Verde/GO" }, results: [result], counters: { created: 0, updated: 0, unchanged: 1 }, screenings: { [e.key]: { status: "completed", completedAt: "2026-10-16T00:52:00.000Z", matches: 0, lists: 3, validUntil: "2026-10-24T19:17:00.000Z", valid: true } } });
  for (const h of ["## Verificações concluídas", "## Conflitos de fonte", "## Dados desconhecidos", "## Pendências para contato futuro (pesquisa pública encerrada)", "## Triagens de sanções"]) assert.ok(md.includes(h), h);
  assert.match(md, /completed em 2026-10-16 00:52 UTC; ocorrências 0; 3 listas; válida até 2026-10-24 19:17 UTC/);
});

test("Painel/Worker: resultado e exportação trazem o fechamento e a triagem com validade pela regra do Compass", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  const { api } = ctx;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!/publica\.cnpj\.ws/.test(String(url))) throw new Error(`rede inesperada: ${url}`);
    return Response.json({ razao_social: "EMPRESA TESTE LTDA", estabelecimento: { situacao_cadastral: "Ativa", cidade: { nome: "Rio Verde" }, estado: { sigla: "GO" }, atividade_principal: { subclasse: "4692-3/00", descricao: "Comércio atacadista" } } });
  };
  t.after(() => (globalThis.fetch = realFetch));
  // Listas de sanções importadas (mesmo caminho do Compass) e validade de 720 h.
  await api("/api/parameters/sanctions_max_age_hours", "PUT", { scope: "global", value: 720, reason: "Parâmetro do teste" });
  const downloadedAt = new Date(Date.now() - 3600000).toISOString();
  for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
    const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt });
    await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Sem Relação Nenhuma" }] });
    await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
  }
  const config = { ...ex("soja-rio-verde-150km"), sources: [{ id: "br-cnpj-ws", kind: "registry", countries: ["BR"], rateLimitPerMinute: 3 }], research: { publicPhase: "closed" } };
  const id = (await api("/api/rounds", "POST", { name: "Fechamento", config })).data.id;
  const base = `/api/rounds/${id}`;
  const csv = "cnpj;nome;municipio;uf;fonte_url;evidence_kind;evidence_strength;trecho\n12.345.678/0001-95;Cooperativa Teste;Rio Verde;GO;https://registro.example;activity_code;official_record;Registro: FABRICANTE RAÇÃO";
  await api(`${base}/candidates`, "POST", { intake: "import", source: "import-file", format: "csv", text: csv });
  await api(`${base}/preflight-ack`, "POST", { revision: 1 });
  await api(`${base}/run`, "POST", {});
  const reg = (await api(`${base}/register`, "POST", { mode: "discovery", productId: "product-01", screening: true })).data;
  assert.equal(reg.items[0].outcome, "created");
  const r = (await api(base)).data.results[0];
  assert.equal(r.closure.publicResearch, "closed");
  assert.ok(r.closure.conflicts.some((x) => x.field === "role"), "atacado na Receita × fabricante no registro");
  assert.ok(r.closure.contact.length >= 4, "desconhecidos viram contato futuro de uma vez");
  assert.equal(r.screening.status, "completed");
  assert.equal(r.screening.matches, 0);
  assert.equal(r.screening.lists, 3);
  assert.equal(r.screening.validUntil, new Date(Date.parse(downloadedAt) + 720 * 3600000).toISOString(), "validade = download mais antigo + sanctions_max_age_hours");
  assert.equal(r.screening.valid, true);
  // Evidência marcada como conflitante no cadastro do Compass aparece como conflito de fonte na rodada.
  const evr = await api(`/api/companies/${reg.items[0].companyId}/evidence`, "POST", { productId: "product-01", category: "business", evidenceType: "company_document", market: "national", supports: [], reference: "Site do grupo descreve armazém; entidade pode ser outra", sourceUrl: "https://grupo.example", consultedAt: "2026-10-16", validationStatus: "conflicting" });
  assert.equal(evr.status, 201, JSON.stringify(evr.data));
  const r2 = (await api(base)).data.results[0];
  assert.ok(r2.closure.conflicts.some((x) => x.field === "registered_evidence" && String(x.sources[0]).startsWith("https://grupo.example")));
  const exp = (await api(`${base}/export`)).data;
  assert.match(exp.report, /Evidência do cadastro marcada como conflitante: Site do grupo/);
  assert.ok(exp.screenings[r.key]);
  for (const h of ["## Conflitos de fonte", "## Pendências para contato futuro (pesquisa pública encerrada)", "## Triagens de sanções"]) assert.ok(exp.report.includes(h), h);
  // Nenhum contato, ficha ou tarefa criados pela rodada.
  for (const tbl of ["contacts", "fichas", "tasks"]) assert.equal(ctx.DB.raw.prepare(`SELECT COUNT(*) n FROM ${tbl}`).get().n, 0, tbl);
});
