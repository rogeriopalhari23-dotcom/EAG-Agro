// Inicialização da pesquisa internacional a partir de uma base vazia (2026-10-21, caso "Açúcar"): sem política, sem
// classificação e sem lista mensal. A automação autorizada prepara a política delimitada (autorização escrita), aplica
// as classificações documentais e inicia a rotina mensal (MDIC agregado para todos os países; Comtrade em fila com o
// orçamento diário existente). Tudo SIMULADO (fontes de teste, R2 em memória), com TODOS os países da base.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { sources, tradeParams, driver, AGRI } from "./helpers/trade.mjs";
import { revokedPolicy } from "./helpers/revoked-policy.mjs";

// Ambiente da rota (como na produção): fila assíncrona e rede apontam para as fontes simuladas.
function wire(t, env, src) {
  const d = driver(env, src, { get at() { return new Date().toISOString(); } });
  env.ASYNC_QUEUE = { sendBatch: async (msgs) => d.queue.push(...msgs.map((m) => m.body)), send: async () => {} };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => (/^https:\/\/(mdic|comtrade)\.test\//.test(String(url)) ? src.fetchImpl(url, init) : Promise.reject(new Error(`rede bloqueada no teste: ${url}`)));
  t.after(() => (globalThis.fetch = real));
  return d;
}
const dest = async (api, body) => {
  const r = await api("/api/prospect/destinations", "POST", body);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
};

test("base vazia: política preparada da autorização escrita, classificação documental do açúcar e motivo concreto quando faltam parâmetros", async (t) => {
  const { api, DB, close } = setup();
  t.after(close);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM research_policies").get().n, 0);
  const r = await dest(api, { commodity: "sugar" });
  // Política delimitada: automação autorizada, sem clique de pessoa.
  const pol = DB.raw.prepare("SELECT granted_by,reference,policy_json FROM research_policies").all();
  assert.equal(pol.length, 1);
  assert.equal(pol[0].granted_by, "system-authorization");
  assert.match(pol[0].reference, /Autorização delimitada escrita .*2026-10-20.*sem clique de pessoa/);
  assert.equal(JSON.parse(pol[0].policy_json).grantedVia, "written_authorization");
  assert.equal(DB.raw.prepare("SELECT actor_id FROM audit_log WHERE action='research_policy.granted_from_authorization'").get().actor_id, "system-authorization");
  // Classificações documentais reaproveitadas: ICUMSA 45 e 150 (1701.99) e VHP (faixa 1701.14/1701.99), sem pergunta.
  const codes = DB.raw.prepare("SELECT product_id,code FROM product_codes WHERE code_system='HS' AND status='confirmed' AND product_id IN ('product-06','product-07','product-08') ORDER BY product_id,code").all().map((x) => `${x.product_id}:${x.code}`);
  assert.deepEqual(codes, ["product-06:170199", "product-07:170199", "product-08:170114", "product-08:170199"]);
  assert.equal(r.asks.length, 0, "nada a perguntar: classificação resolvida pelos documentos");
  assert.deepEqual(r.unclassified, []);
  // Sem os parâmetros da lista mensal (Administrador), não há rotina: bloqueio com o motivo concreto, não "lista vazia".
  assert.equal(r.state, "blocked");
  // (na base de teste os parâmetros da rotina vêm das migrações; falta o armazenamento de arquivos)
  assert.match(r.message, /não podem ser preparados: (parâmetros da lista mensal ainda sem valor aprovado|armazenamento de arquivos \(R2\) não configurado)/);
  assert.equal(r.retry, true);
  // Segunda consulta: nada duplicado, nada perguntado de novo.
  await dest(api, { commodity: "sugar" });
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM research_policies").get().n, 1);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM product_codes WHERE product_id='product-08'").get().n, 4);
});

test("preparação autorizada: rotina iniciada para todos os países, \"Preparando\" com progresso, destinos do açúcar chegando, limite diário e retomada após reinício sem duplicar", async (t) => {
  const { api, DB, env, close } = setup();
  t.after(close);
  // Orçamento diário pequeno de propósito: o limite existente segura a Comtrade; nada é aumentado.
  await tradeParams(api, { period_default_months: 12, comtrade_calls_per_day: 20, agri_classification: { ...AGRI, chapters: ["01", "02", "09", "12", "17"] } });
  const d = wire(t, env, sources());
  const countries = DB.raw.prepare("SELECT COUNT(*) n FROM countries").get().n;
  assert.ok(countries > 200, "base completa de países (sem recorte)");
  let r = await dest(api, { commodity: "sugar" });
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_versions WHERE kind='monthly'").get().n, 1, "rotina do mês iniciada pela automação");
  assert.ok(["preparing", "ready"].includes(r.state), r.state);
  if (r.state === "preparing") assert.match(r.message, /^Preparando os mercados compradores/);
  assert.ok(r.progress?.comtrade?.total >= 200, JSON.stringify(r.progress));
  // Fila andando aos poucos: os destinos comprovados aparecem conforme chegam.
  await d.drain(40);
  // "Reinício" no meio: trabalhos com lease vencido (processo interrompido) são retomados, sem versão nem job duplicado.
  DB.raw.prepare("UPDATE trade_list_jobs SET status='leased', lease_until='2000-01-01T00:00:00Z', lease_token='perdido' WHERE status='pending' AND rowid IN (SELECT rowid FROM trade_list_jobs WHERE status='pending' LIMIT 5)").run();
  const jobsBefore = DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_jobs").get().n;
  r = await dest(api, { commodity: "sugar" });
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_versions").get().n, 1);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_jobs").get().n, jobsBefore, "nenhum job duplicado na retomada");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM (SELECT version_id,job_key FROM trade_list_jobs GROUP BY 1,2 HAVING COUNT(*)>1)").get().n, 0);
  await d.drain();
  // Como a tela: nova consulta a cada poucos segundos enquanto os resumos são refeitos (60 por consulta).
  for (let k = 0; k < 12; k++) {
    r = await dest(api, { commodity: "sugar" });
    if (r.items.some((x) => x.iso3 === "USA") && !r.coverage.pendingSummaries) break;
  }
  // MDIC (agregado) já cobre todos os países: EUA com açúcar 1701.14 exportado pelo Brasil → VHP fundamenta.
  const usa = r.items.find((x) => x.iso3 === "USA");
  assert.ok(usa, JSON.stringify({ state: r.state, msg: r.message, n: r.items.length }));
  assert.equal(usa.basis, "VHP");
  assert.match(usa.line, /MDIC — exportações do Brasil/);
  // Comtrade parada no limite diário existente: espera explicada, limite intacto, lista não tratada como final.
  assert.ok(r.preparing, "ainda preparando (Comtrade na fila)");
  assert.match(r.message, /Preparando os mercados compradores: os destinos comprovados aparecem conforme os dados chegam/);
  assert.match(r.progressText, /limite diário de consultas à Comtrade atingido \(\d+ de 20\).*sem aumentar o limite/);
  assert.equal(DB.raw.prepare("SELECT value_json FROM parameters WHERE parameter_key='comtrade_calls_per_day' AND effective_to IS NULL ORDER BY rowid DESC LIMIT 1").get()?.value_json, "20", "limite diário não alterado");
  // Nova tentativa: recuperação concreta (fila retomada / resumos refeitos), com o que foi feito.
  const rec = await dest(api, { commodity: "sugar", recover: true });
  assert.ok(Array.isArray(rec.recovery) && rec.recovery.length >= 1, JSON.stringify(rec.recovery));
});

test("falha da fonte e cobertura parcial: recuperação concreta pede de novo o país que falhou, uma vez por dia", async (t) => {
  const { api, DB, env, close } = setup();
  t.after(close);
  await tradeParams(api, { period_default_months: 12, comtrade_calls_per_day: 2000, agri_classification: { ...AGRI, chapters: ["01", "02", "09", "12", "17"] } });
  const d = wire(t, env, sources({ failData: (code) => code === 842 }));
  await dest(api, { commodity: "sugar" });
  await d.drain();
  for (let k = 0; k < 3; k++) {
    await dest(api, { commodity: "sugar" });
    await d.drain();
  }
  const usaCt = DB.raw.prepare("SELECT st.state,st.error FROM trade_list_status st JOIN trade_list_versions v ON v.id=st.version_id WHERE st.iso3='USA' AND st.source='comtrade' AND v.kind='monthly'").get();
  assert.equal(usaCt?.state, "data_unavailable", JSON.stringify(usaCt));
  let r = await dest(api, { commodity: "sugar" });
  assert.ok(r.reasons.some((x) => /falha da fonte/.test(x)), JSON.stringify(r.reasons));
  assert.ok(r.items.some((x) => x.iso3 === "USA"), "o MDIC continua comprovando os EUA: a falha da Comtrade não apaga a evidência");
  r = await dest(api, { commodity: "sugar", recover: true });
  assert.ok(r.recovery.some((x) => /nova consulta pedida para USA/.test(x)), JSON.stringify(r.recovery));
  const again = await dest(api, { commodity: "sugar", recover: true });
  assert.ok(!again.recovery.some((x) => /USA/.test(x)), "um pedido por país por dia");
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM trade_list_manual_refresh WHERE iso3='USA'").get().n, 1);
});

test("política revogada: nada é recriado sozinho; motivo concreto em vez de lista vazia", async (t) => {
  const { api, DB, close } = setup();
  t.after(close);
  revokedPolicy(DB);
  const r = await dest(api, { commodity: "sugar" });
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM research_policies WHERE revoked_at IS NULL").get().n, 0, "revogação prevalece");
  assert.equal(r.policy, null);
  assert.ok(r.unresolvedClassification.length >= 1 && /política/.test(r.unresolvedClassification[0].reason));
  assert.notEqual(r.state, "none_valid", "lista vazia não é resultado final com classificação pendente");
});
