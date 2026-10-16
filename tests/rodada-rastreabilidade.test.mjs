// Rastreabilidade geral (src/provenance.js): responsável pela autorização × identidade autenticada × executor × momento.
// Canal, executor e autorização são DECLARADOS e nunca provam ação humana; cadastro em descoberta não tem decisão
// comercial individual; aceite e inclusão de exceção ficam ligados à decisão real; anotação é registro novo.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { setup } from "./helpers/db.mjs";
import { readProvenance, operationRecord, describeOperation, provenanceHeaders } from "../src/provenance.js";
import { scriptProvenance } from "../scripts/lib/procedencia.mjs";

const CONFIG = { ...JSON.parse(readFileSync(new URL("../docs/implementation/rodadas/exemplos/soja-rio-verde-150km.json", import.meta.url), "utf8")), sources: [{ id: "br-cnpj-ws", kind: "registry", countries: ["BR"], rateLimitPerMinute: 30 }] };
const REG = {
  "11111111000191": "Ativa", "22222222000191": "Ativa", "33333333000191": "Suspensa",
};
const SCRIPT = provenanceHeaders({ channel: "script", executor: "Claude (automação, script de teste)", authorization: { reference: "Instrução na conversa: cadastre em descoberta", grantedBy: "Rogério Palhari", grantedAt: "2026-10-16" } });
const PANEL = provenanceHeaders({ channel: "panel" });
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

async function round(t) {
  const ctx = setup();
  t.after(ctx.close);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const m = /publica\.cnpj\.ws\/cnpj\/(\d{14})/.exec(String(url));
    if (!m) throw new Error(`rede inesperada: ${url}`);
    return Response.json({ razao_social: `EMPRESA ${m[1]}`, estabelecimento: { situacao_cadastral: REG[m[1]], cidade: { nome: "Rio Verde" }, estado: { sigla: "GO" }, atividade_principal: { subclasse: "1066-0/00", descricao: "Fabricação de alimentos para animais" } } });
  };
  t.after(() => (globalThis.fetch = realFetch));
  const { api } = ctx;
  const id = (await api("/api/rounds", "POST", { name: "Rastreio", config: CONFIG })).data.id;
  const base = `/api/rounds/${id}`;
  const csv = ["cnpj;nome;municipio;uf", "11.111.111/0001-91;Alfa;Rio Verde;GO", "22.222.222/0001-91;Beta;Rio Verde;GO", "33.333.333/0001-91;Gama Suspensa;Rio Verde;GO"].join("\n");
  await api(`${base}/candidates`, "POST", { intake: "import", source: "import-file", format: "csv", text: csv });
  await api(`${base}/preflight-ack`, "POST", { revision: 1 });
  await api(`${base}/run`, "POST", {});
  const results = (await api(base)).data.results;
  const key = (n) => results.find((r) => r.names[0] === n).key;
  return { ...ctx, id, base, key };
}
const regRows = (DB, id) => DB.raw.prepare("SELECT est_key,company_id,mode,decision_id,outcome,registered_by,registered_at,detail_json FROM round_registrations WHERE round_id=? ORDER BY est_key").all(id);

test("Procedência: canal, executor e autorização declarados; identidade autenticada separada; nada prova ação humana", () => {
  const req = (h) => new Request("http://x/", { headers: h });
  const p = readProvenance(req({ ...SCRIPT }));
  assert.deepEqual(p, { channel: "script", executor: "Claude (automação, script de teste)", authorization: { reference: "Instrução na conversa: cadastre em descoberta", grantedBy: "Rogério Palhari", grantedAt: "2026-10-16" } });
  assert.deepEqual(readProvenance(req({ "x-compass-channel": "robô", "x-compass-authorization-at": "ontem" })), { channel: null, executor: null, authorization: null }, "canal inválido e data inválida não são aceitos");
  const op = operationRecord({ id: "u1", email: "pessoa@exemplo.test", display_name: "Pessoa", provenance: readProvenance(req(PANEL)) }, "2026-10-16T12:00:00.000Z");
  assert.equal(op.channel, "panel");
  assert.equal(op.executor, null, "o painel não declara executor: o botão pode ser acionado por automação");
  const text = describeOperation(op);
  assert.match(text, /identidade autenticada: Pessoa <pessoa@exemplo\.test> \(não prova ação humana\)/);
  assert.match(text, /executor declarado: não declarado; autorização não informada/);
  assert.deepEqual(scriptProvenance(["--executor", "Claude", "--autorizacao-ref", "ref 1"]), provenanceHeaders({ channel: "script", executor: "Claude", authorization: { reference: "ref 1" } }));
});

test("Cadastro em descoberta: sem decisão comercial individual, operação registrada com procedência; reexecução não duplica", async (t) => {
  const { api, DB, id, base, key } = await round(t);
  const reg = await api(`${base}/register`, "POST", { mode: "discovery", productId: "product-01" }, SCRIPT);
  assert.deepEqual(reg.data.items.map((x) => x.outcome), ["created", "created"], "suspensa (exceção) fica de fora");
  const rows = regRows(DB, id);
  for (const r of rows) {
    const d = JSON.parse(r.detail_json);
    assert.equal(r.decision_id, null);
    assert.equal(d.trace.basis, "discovery_mode");
    assert.equal(d.trace.decision, null);
    assert.equal(d.trace.label, "cadastro sem decisão comercial individual");
    assert.ok(!("decidedBy" in d.trace) && !("decidedAt" in d.trace), "nenhum campo de decisão inexistente");
    assert.equal(d.operation.authenticatedIdentity.id, r.registered_by);
    assert.equal(d.operation.channel, "script");
    assert.equal(d.operation.executor, "Claude (automação, script de teste)");
    assert.equal(d.operation.authorization.grantedBy, "Rogério Palhari");
  }
  // Auditoria: a operação de lote e cada criação de empresa (mesma requisição) levam a procedência declarada.
  const audit = DB.raw.prepare("SELECT action,request_id,new_value_json FROM audit_log WHERE action IN ('round.registered','company.created') ORDER BY occurred_at").all();
  const lote = audit.find((a) => a.action === "round.registered");
  assert.equal(JSON.parse(lote.new_value_json).basis, "discovery_mode");
  for (const a of audit) assert.equal(JSON.parse(a.new_value_json)._operation.channel, "script", a.action);
  assert.equal(new Set(audit.map((a) => a.request_id)).size, 1, "uma requisição liga o lote às empresas");
  // Painel/API: rótulo e texto da operação, sem afirmar ação humana.
  const view = (await api(base)).data.results.find((r) => r.key === key("Alfa")).registration;
  assert.equal(view.label, "cadastro sem decisão comercial individual");
  assert.equal(view.decision, null);
  assert.match(view.operationText, /não prova ação humana\); canal declarado: script; executor declarado: Claude \(automação, script de teste\); autorização declarada: Instrução na conversa: cadastre em descoberta, por Rogério Palhari, em 2026-10-16\./);
  const exp = (await api(`${base}/export`)).data;
  assert.match(exp.report, /## Cadastros e rastreabilidade/);
  assert.match(exp.report, /cadastro sem decisão comercial individual\. Operação em/);
  assert.doesNotMatch(exp.report, /aceite em lote|aprovação comercial/i);
  // Reexecução: nada duplicado, nada reescrito.
  const before = hash(regRows(DB, id));
  const again = (await api(`${base}/register`, "POST", { mode: "discovery", productId: "product-01" }, PANEL)).data;
  assert.ok(again.items.every((x) => x.outcome === "skipped"));
  await api(`${base}/run`, "POST", {});
  assert.equal(hash(regRows(DB, id)), before, "cadastros e rastreio intactos depois de recadastrar e reexecutar");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies").get().n, 2);
});

test("Cadastro por aceite e inclusão de exceção: vínculo com a decisão real; decisão e operação separadas; histórico preservado", async (t) => {
  const { api, DB, id, base, key } = await round(t);
  const dec = (await api(`${base}/decisions`, "POST", { decisions: [{ key: key("Alfa"), decision: "accept", note: "aceite registrado no painel" }, { key: key("Gama Suspensa"), decision: "include", note: "inclusão consciente da exceção" }] }, PANEL)).data;
  assert.ok(dec.outcomes.every((x) => x.ok));
  const decRow = (k) => DB.raw.prepare("SELECT id,decided_by,decided_at,evidence_json FROM round_decisions WHERE est_key=? AND superseded_at IS NULL").get(k);
  const alfaDec = decRow(key("Alfa"));
  assert.equal(JSON.parse(alfaDec.evidence_json).recordedBy.channel, "panel", "a decisão guarda o canal declarado de quem a registrou");
  // Modo "aceitas": só Alfa, ligado à decisão.
  const acc = (await api(`${base}/register`, "POST", { mode: "accept", productId: "product-01" }, SCRIPT)).data;
  assert.deepEqual(acc.items.map((x) => [x.key, x.outcome]), [[key("Alfa"), "created"]]);
  let rows = regRows(DB, id);
  const alfa = rows.find((r) => r.est_key === key("Alfa"));
  const t1 = JSON.parse(alfa.detail_json).trace;
  assert.equal(alfa.decision_id, alfaDec.id);
  assert.equal(t1.basis, "decision_accept");
  assert.deepEqual(t1.decision, { value: "accept", id: alfaDec.id, decidedBy: alfaDec.decided_by, decidedAt: alfaDec.decided_at });
  assert.equal(JSON.parse(alfa.detail_json).operation.channel, "script", "operação de cadastro ≠ decisão");
  assert.ok(JSON.parse(alfa.detail_json).operation.operatedAt >= alfaDec.decided_at);
  // Modo descoberta depois: Beta sem decisão; Gama (exceção) por inclusão, ligada à decisão de inclusão.
  await api(`${base}/register`, "POST", { mode: "discovery", productId: "product-01" }, PANEL);
  rows = regRows(DB, id);
  const beta = rows.find((r) => r.est_key === key("Beta")), gama = rows.find((r) => r.est_key === key("Gama Suspensa"));
  assert.equal(beta.decision_id, null);
  assert.equal(JSON.parse(beta.detail_json).trace.basis, "discovery_mode");
  assert.equal(gama.decision_id, decRow(key("Gama Suspensa")).id);
  assert.equal(JSON.parse(gama.detail_json).trace.basis, "discovery_mode_with_inclusion");
  // Nova decisão depois do cadastro: a anterior fica no histórico e o cadastro continua ligado à que o fundamentou.
  await api(`${base}/decisions`, "POST", { decisions: [{ key: key("Alfa"), decision: "defer", note: "revisão posterior" }] }, PANEL);
  const hist = DB.raw.prepare("SELECT id,decision,superseded_at FROM round_decisions WHERE est_key=? ORDER BY decided_at, rowid").all(key("Alfa"));
  assert.equal(hist.length, 2);
  assert.ok(hist[0].superseded_at && hist[0].decision === "accept");
  assert.equal(regRows(DB, id).find((r) => r.est_key === key("Alfa")).decision_id, alfaDec.id);
  const view = (await api(base)).data.results.find((r) => r.key === key("Alfa")).registration;
  assert.equal(view.label, "cadastro por aceite (decisão registrada)");
  assert.equal(view.decisionId, alfaDec.id);
});

test("Anotação complementar: registro novo com a data real; não reescreve cadastros nem cria decisões; cadastros antigos sem procedência ficam como estão", async (t) => {
  const { api, DB, id, base } = await round(t);
  const reg = (await api(`${base}/register`, "POST", { mode: "discovery", productId: "product-01" }, SCRIPT)).data;
  const reqId = DB.raw.prepare("SELECT request_id FROM audit_log WHERE action='round.registered'").get().request_id;
  // Simula cadastro anterior à regra: sem "operation" no detalhe (só no banco de teste).
  const old = regRows(DB, id)[0];
  const d = JSON.parse(old.detail_json);
  delete d.operation;
  d.trace = { roundId: d.trace.roundId, key: d.trace.key, status: d.trace.status, mode: "discovery", decision: "discovery", decidedBy: old.registered_by, decidedAt: old.registered_at };
  DB.raw.prepare("UPDATE round_registrations SET detail_json=? WHERE round_id=? AND est_key=?").run(JSON.stringify(d), id, old.est_key);
  const before = hash(regRows(DB, id));
  const decisionsBefore = DB.raw.prepare("SELECT COUNT(*) n FROM round_decisions").get().n;
  const n = await api(`${base}/annotations`, "POST", { kind: "complement", text: "Os cadastros foram feitos em modo descoberta, sem decisão comercial individual, por automação com a sessão do responsável.", refersTo: { requestIds: [reqId] }, authorization: { reference: "Instrução registrada em EVIDENCIAS.md", grantedBy: "Rogério Palhari", grantedAt: "2026-10-16" } }, SCRIPT);
  assert.equal(n.status, 201);
  assert.ok(Date.parse(n.data.annotatedAt) >= Date.parse(regRows(DB, id)[1].registered_at), "data real da anotação, posterior ao cadastro");
  assert.equal(hash(regRows(DB, id)), before, "cadastros intactos");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM round_decisions").get().n, decisionsBefore, "nenhuma decisão retroativa");
  const r = (await api(base)).data;
  assert.equal(r.annotations.length, 1);
  assert.deepEqual(r.annotations[0].refersTo.requestIds, [reqId]);
  assert.equal(r.annotations[0].operation.executor, "Claude (automação, script de teste)");
  assert.equal(r.annotations[0].authorization.grantedBy, "Rogério Palhari");
  // Cadastro antigo: o painel não inventa decisão nem procedência; mostra o que foi gravado.
  const oldView = r.results.find((x) => x.key === old.est_key).registration;
  assert.equal(oldView.label, "cadastro sem decisão comercial individual");
  assert.equal(oldView.decision, null, "o antigo 'decision: discovery' não vira decisão");
  assert.match(oldView.operationText, /canal e executor não registrados \(cadastro anterior à regra de rastreabilidade\)/);
  const exp = (await api(`${base}/export`)).data;
  assert.match(exp.report, /## Anotações complementares/);
  assert.match(exp.report, new RegExp(`operações: ${reqId}`));
  assert.equal(reg.items.length, 2);
  // Sem permissão de escrita, não anota.
  DB.raw.prepare("UPDATE users SET role='auditor_viewer' WHERE id='system-admin'").run();
  assert.equal((await api(`${base}/annotations`, "POST", { text: "x" })).status, 403);
});
