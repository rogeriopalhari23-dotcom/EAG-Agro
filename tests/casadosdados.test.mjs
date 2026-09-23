import test from "node:test";
import assert from "node:assert/strict";
import { searchEstablishments, requestBody } from "../src/adapters/casadosdados.js";
import { setup } from "./helpers/db.mjs";

// Estrutura copiada do esquema CNPJPesquisaResposta da documentação (2026-09-23); valores de teste inventados.
const item = (over = {}) => ({
  cnpj: "11222333000181",
  cnpj_raiz: "11222333",
  filial_numero: 1,
  razao_social: "DOCES VALE VERDE LTDA",
  qualificacao_responsavel: { codigo: "49", descricao: "Sócio-Administrador" },
  porte_empresa: { codigo: "05", descricao: "Demais" },
  matriz_filial: "MATRIZ",
  codigo_natureza_juridica: "2062",
  descricao_natureza_juridica: "Sociedade Empresária Limitada",
  nome_fantasia: "VALE VERDE",
  situacao_cadastral: { situacao_cadastral: "ATIVA", motivo: "", data: "2010-05-01" },
  endereco: {
    cep: "14160-000",
    tipo_logradouro: "RUA",
    logradouro: "DAS FLORES",
    numero: "100",
    complemento: "",
    bairro: "CENTRO",
    uf: "SP",
    municipio: "SERTAOZINHO",
    ibge: { codigo_municipio: 3551702, codigo_uf: 35, latitude: -21.13, longitude: -47.99 },
  },
  data_abertura: "2010-05-01",
  capital_social: 500000,
  quadro_societario: [{ nome: "FULANO DE TAL", documento: "***123456**", qualificacao_socio: "Sócio" }],
  ...over,
});
const env = { CASADOSDADOS_API_KEY: "chave-secreta-de-teste" };
const query = { cnaes: ["1093701"], uf: "SP", municipality: "Sertãozinho", page: 1 };
function fake(status, body, capture = {}) {
  return async (url, init) => {
    capture.url = url;
    capture.init = init;
    capture.body = JSON.parse(init.body);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
}

test("P2-T3: corpo pede resultado completo, só ativas, exclui MEI e filtra UF/município normalizado", async () => {
  const cap = {};
  const r = await searchEstablishments(env, query, fake(200, { total: 1, cnpjs: [item()] }, cap));
  assert.match(cap.url, /tipo_resultado=completo/);
  assert.equal(cap.init.headers["api-key"], env.CASADOSDADOS_API_KEY);
  assert.deepEqual(cap.body.situacao_cadastral, ["ATIVA"]);
  assert.equal(cap.body.mei.excluir_optante, true);
  assert.deepEqual(cap.body.uf, ["sp"]);
  assert.deepEqual(cap.body.municipio, ["sertaozinho"]);
  assert.equal(cap.body.limite, 1000);
  assert.equal(r.items[0].cnpj, "11222333000181");
  assert.equal(r.items[0].postalCode, "14160000");
  assert.equal(r.items[0].municipalityIbge, 3551702);
});

test("P2-T3: sócios e documentos pessoais são descartados", async () => {
  const r = await searchEstablishments(env, query, fake(200, { total: 1, cnpjs: [item()] }));
  const json = JSON.stringify(r);
  assert.ok(!json.includes("FULANO"));
  assert.ok(!json.includes("123456"));
});

test("P2-T3: falhas nunca viram lista vazia", async () => {
  const cases = [
    [401, {}, "auth"],
    [403, {}, "no_balance"],
    [429, {}, "temporary"],
    [502, {}, "temporary"],
    [400, {}, "invalid_request"],
    [200, "<html>Just a moment...</html>", "temporary"],
    [200, { cnpjs: [] }, "schema"],
    [200, { total: 2, cnpjs: [item()] }, "incomplete"],
    [200, { total: 1, cnpjs: [item({ cnpj: "123" })] }, "schema"],
  ];
  for (const [status, body, kind] of cases)
    await assert.rejects(searchEstablishments(env, query, fake(status, body)), (e) => e.kind === kind, `${status} → ${kind}`);
  const timeout = async () => {
    throw Object.assign(new Error("t"), { name: "TimeoutError" });
  };
  await assert.rejects(searchEstablishments(env, query, timeout), (e) => e.kind === "temporary");
});

test("P2-T3: filtro de município não aplicado invalida a partição", async () => {
  const outra = item({ endereco: { ...item().endereco, municipio: "RIBEIRAO PRETO" } });
  await assert.rejects(
    searchEstablishments(env, query, fake(200, { total: 2, cnpjs: [item(), outra] })),
    (e) => e.kind === "filter_not_applied",
  );
});

test("P2-T3: segunda página espera só o restante; zero resultados comprovados é lista vazia legítima", async () => {
  const r = await searchEstablishments(env, { ...query, page: 2 }, fake(200, { total: 1001, cnpjs: [item()] }));
  assert.equal(r.items.length, 1);
  const vazio = await searchEstablishments(env, query, fake(200, { total: 0, cnpjs: [] }));
  assert.equal(vazio.total, 0);
});

test("P2-T3: chave não aparece em mensagem de erro; chave ausente não chama a API", async () => {
  try {
    await searchEstablishments(env, query, fake(500, { detail: "x" }));
  } catch (e) {
    assert.ok(!e.message.includes(env.CASADOSDADOS_API_KEY));
  }
  let called = false;
  await assert.rejects(
    searchEstablishments({}, query, async () => {
      called = true;
    }),
    (e) => e.kind === "auth",
  );
  assert.equal(called, false);
  assert.throws(() => requestBody({ ...query, cnaes: ["10.93-7"] }), /7 dígitos/);
});

test("P2-T3: setor → CNAE só pelo administrador, com fonte; setor sem CNAE bloqueia", async (t) => {
  const { api, env: e, close } = setup();
  t.after(close);
  const { cnaesForSectors } = await import("../src/sectors.js");
  await assert.rejects(cnaesForSectors(e, "eag-internal", ["Balas e confeitos"]), /Setor sem CNAE/);
  const semFonte = await api("/api/sectors", "POST", { sector: "Balas e confeitos", cnaeCode: "1093-7/01", label: "Fabricação de produtos derivados do cacau" });
  assert.equal(semFonte.status, 422);
  const ok = await api("/api/sectors", "POST", {
    sector: "Balas e confeitos",
    cnaeCode: "1093-7/02",
    label: "Fabricação de frutas cristalizadas, balas e semelhantes",
    source: "https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=1093702",
  });
  assert.equal(ok.status, 201);
  assert.deepEqual(await cnaesForSectors(e, "eag-internal", ["balas e confeitos"]), ["1093702"]);
  const dup = await api("/api/sectors", "POST", { sector: "Balas e Confeitos", cnaeCode: "1093702", label: "x", source: "y" });
  assert.equal(dup.status, 409);
});
