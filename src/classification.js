// Classificação automática dos produtos do catálogo (SH 2022 / NCM), para a pesquisa internacional não parar numa
// pendência técnica solucionável. Cada regra cita a fonte oficial e o fundamento tirado da descrição ou da especificação
// do produto. Quando falta uma característica que muda o código, pergunta só essa característica; produto sem regra
// fundamentada fica pendente para o Administrador. Classificação verificada e compatível é reaproveitada.
// Registro: automação sob a política de pesquisa vigente (usuário de sistema), nunca como clique de pessoa.
// Pesquisa de mercado × lote comercial: quando a especificação documentada do produto cobre mais de uma subposição
// (VHP de 99,30% a 99,60%; álcool desnaturado ou não conforme o lote), a pesquisa usa todas as subposições da faixa
// (escopo "research") e não pergunta característica de lote. A classificação de um lote comercial (polarização do
// lote, desnaturante adicionado) fica para a etapa comercial, fora daqui. Pergunta só a característica do PRODUTO que
// muda o código e que nenhum documento registra; a resposta e os fatos usados ficam no catálogo, com fonte e data, e
// são reaproveitados em todas as pesquisas seguintes.
import { statement as s, commit, auditStatement, now } from "./store.js";

export const NCM_SOURCE = "NCM vigente em 20/10/2026 (Resolução Gecex nº 926/2026), tabela oficial do Portal Único Siscomex (classif/api/publico/nomenclatura), consultada em 2026-10-20; textos das subposições desde a Resolução Gecex nº 272/2021 (SH 2022)";
export const CLASSIFICATION_VERSION = "SH 2022 / NCM (Res. Gecex 926/2026)";
const NOTE17 = "Nota de subposição 1 do Capítulo 17 (TEC/NCM, Res. Gecex nº 272/2021): açúcar em bruto é o de leitura no polarímetro inferior a 99,5°";
const SUGAR_SHEET = "Ficha técnica interna EAG \"Especificação técnica açúcar ICUMSA 45, ICUMSA 150 e VHP\" (lida em 2026-10-20)";
const TRADING = "produto de trading de grãos para indústria (perfil da EAG: \"Trading de grãos, Açúcar e Energia\"), não semente";
const code = (hs6, ncm, basis) => ({ hs6, ncm, basis });

// Perguntas: só a característica que muda o código. Opções → códigos.
const ASK_ID = {
  coffee_state: { key: "classificacao:estado_do_cafe", question: "O café ofertado é cru (verde, não torrado)? É descafeinado?", options: [
    { value: "cru_nao_descafeinado", label: "Cru, não descafeinado", codes: [code("090111", "0901.11.10", "café não torrado, não descafeinado, em grão (NCM 0901.11.10)")] },
    { value: "cru_descafeinado", label: "Cru, descafeinado", codes: [code("090112", "0901.12.00", "café não torrado, descafeinado (NCM 0901.12.00)")] },
    { value: "torrado", label: "Torrado, não descafeinado", codes: [code("090121", "0901.21.00", "café torrado, não descafeinado (NCM 0901.21.00)")] },
  ] },
};
// Características de LOTE (etapa comercial): não são perguntadas na pesquisa de mercado.
export const LOT_CHARACTERISTICS = {
  denatured: { key: "lote:desnaturado", question: "O álcool do lote é desnaturado?", decides: "2207.10 (não desnaturado) × 2207.20 (desnaturado)" },
  vhp_pol: { key: "lote:polarizacao", question: "A polarização do lote de VHP é inferior a 99,5°?", decides: "1701.14.00 (inferior a 99,5°, açúcar em bruto) × 1701.99.00 (igual ou superior)" },
};
const ASK_PRODUCT = {
  durum: { key: "classificacao:trigo_duro", question: "O trigo é trigo duro (durum)?", options: [
    { value: "nao", label: "Não (trigo comum)", codes: [code("100199", "1001.99.00", "outros trigos, não para semeadura (NCM 1001.99.00)")] },
    { value: "sim", label: "Sim, trigo duro", codes: [code("100119", "1001.19.00", "trigo duro, não para semeadura (NCM 1001.19.00)")] },
  ] },
  refined: (what, crude, refined) => ({ key: "classificacao:bruto_ou_refinado", question: `O ${what} ofertado é bruto ou refinado?`, options: [
    { value: "bruto", label: "Bruto", codes: [crude] },
    { value: "refinado", label: "Refinado", codes: [refined] },
    { value: "ambos", label: "Ambos (bruto e refinado)", codes: [crude, refined] },
  ] }),
};
const ASK = { ...ASK_ID, ...ASK_PRODUCT };

// Regra por commodity (e variante): códigos diretos, com fundamento, ou a pergunta da característica que falta.
function ruleFor(p) {
  const v = String(p.variant_name ?? "");
  switch (p.commodity) {
    case "soy": return { codes: [code("120190", "1201.90.00", `soja, mesmo triturada, outras que não para semeadura; ${TRADING}`)] };
    case "corn": return { codes: [code("100590", "1005.90.10", `milho em grão, outro que não para semeadura; ${TRADING}`)] };
    case "sorghum": return { codes: [code("100790", "1007.90.00", `sorgo de grão, outro que não para semeadura; ${TRADING}`)] };
    case "coffee": return { ask: ASK.coffee_state };
    case "sugar":
      if (/ICUMSA\s*45\b/i.test(v)) return { codes: [code("170199", "1701.99.00", `polarização mínima 99,80% (${SUGAR_SHEET}) ≥ 99,5°: não é açúcar em bruto (${NOTE17}); sem aromatizantes ou corantes`)] };
      if (/ICUMSA\s*150\b/i.test(v)) return { codes: [code("170199", "1701.99.00", `polarização mínima 99,50% (${SUGAR_SHEET}) não é inferior a 99,5°: não é açúcar em bruto (${NOTE17}); sem aromatizantes ou corantes`)] };
      // VHP: a faixa da ficha (99,30% a 99,60%) cruza o limite de 99,5°. Para a pesquisa de mercado, as duas subposições
      // da faixa (escopo "research"); a do lote comercial depende da polarização do lote (LOT_CHARACTERISTICS.vhp_pol).
      if (/VHP/i.test(v)) return { scope: "research", facts: [{ key: "classificacao:polarizacao_especificada", value: "99,30% a 99,60%", source: SUGAR_SHEET }], codes: [
        code("170114", "1701.14.00", `faixa de polarização da especificação 99,30% a 99,60% (${SUGAR_SHEET}): a parte inferior a 99,5° é açúcar de cana em bruto, centrifugado (${NOTE17})`),
        code("170199", "1701.99.00", `faixa de polarização da especificação 99,30% a 99,60% (${SUGAR_SHEET}): a parte igual ou superior a 99,5° não é açúcar em bruto (${NOTE17})`),
      ], note: `pesquisa de mercado nas duas subposições da faixa documentada; a classificação de cada lote comercial (${LOT_CHARACTERISTICS.vhp_pol.decides}) é feita na etapa comercial, pela polarização do lote` };
      return null;
    case "ethanol":
    case "industrial_alcohol": return { scope: "research", codes: [
      code("220710", "2207.10", "álcool etílico não desnaturado, teor alcoólico em volume ≥ 80 % vol. (posição 2207)"),
      code("220720", "2207.20", "álcool etílico desnaturado, com qualquer teor alcoólico (posição 2207)"),
    ], note: `pesquisa de mercado nas duas subposições da posição 2207; a adição de desnaturante é do lote (${LOT_CHARACTERISTICS.denatured.decides}), classificada na etapa comercial` };
    case "wheat": return { ask: ASK.durum };
    case "soy_meal": return { codes: [code("230400", "2304.00", "tortas, farelos e outros resíduos sólidos da extração do óleo de soja (2304.00)")] };
    case "canola_meal": return { codes: [code("230641", "2306.41.00", "farelo de colza com baixo teor de ácido erúcico: canola é a colza de baixo teor de ácido erúcico (2306.41.00)")] };
    case "cotton_meal": return { codes: [code("230610", "2306.10.00", "tortas e farelos de sementes de algodão (2306.10.00)")] };
    case "soy_oil": return /bruto e refinado/i.test(v) ? { codes: [code("150710", "1507.10.00", "óleo de soja em bruto (1507.10.00)"), code("150790", "1507.90.1", "óleo de soja refinado (1507.90)")] } : { ask: ASK.refined("óleo de soja", code("150710", "1507.10.00", "óleo de soja em bruto"), code("150790", "1507.90.1", "óleo de soja refinado")) };
    case "palm_oil": return /bruto e refinado/i.test(v) ? { codes: [code("151110", "1511.10.00", "óleo de palma em bruto (1511.10.00)"), code("151190", "1511.90.00", "outros óleos de palma, inclusive refinado (1511.90.00)")] } : { ask: ASK.refined("óleo de palma", code("151110", "1511.10.00", "óleo de palma em bruto"), code("151190", "1511.90.00", "óleo de palma refinado")) };
    case "canola_oil": return { ask: ASK.refined("óleo de canola", code("151411", "1514.11.00", "óleo de colza de baixo teor de ácido erúcico, em bruto (1514.11.00)"), code("151419", "1514.19.10", "óleo de colza de baixo teor de ácido erúcico, refinado (1514.19.10)")) };
    case "cotton_oil": return { ask: ASK.refined("óleo de algodão", code("151221", "1512.21.00", "óleo de algodão em bruto (1512.21.00)"), code("151229", "1512.29.10", "óleo de algodão refinado (1512.29.10)")) };
    case "soy_lecithin": return { codes: [code("292320", "2923.20.00", "lecitinas e outros fosfoaminolipídios (2923.20.00)")] };
    case "ddgs": return { codes: [code("230330", "2303.30.00", "borras e desperdícios das destilarias: grãos secos de destilaria com solúveis (2303.30.00)")] };
    case "cgf":
    case "cgm": return { codes: [code("230310", "2303.10.00", "resíduos da fabricação do amido (moagem úmida do milho), como o farelo de glúten e o glúten de milho (2303.10.00)")] };
    case "corn_bran": return { codes: [code("230210", "2302.10.00", "sêmeas, farelos e outros resíduos da moagem do milho (2302.10.00)")] };
    default: return null; // UCO, CSO e outros: sem regra fundamentada (Administrador, no Catálogo)
  }
}

// → { state: "classified", codes } | { state: "ask", ask, why } | { state: "unresolved", reason }
export async function resolveClassification(env, tenant, productId) {
  const p = await s(env, "SELECT * FROM products WHERE tenant_id=? AND id=?", tenant, productId).first();
  if (!p) return { state: "unresolved", reason: "produto não encontrado" };
  const have = (await s(env, "SELECT code_system,code,status FROM product_codes WHERE product_id=?", p.id).all()).results;
  if (have.some((c) => c.status === "confirmed")) return { state: "classified", codes: [], reused: true };
  if (p.identity_status !== "confirmed" && !["corn_bran"].includes(p.commodity)) return { state: "unresolved", reason: "identidade do produto ainda pendente no catálogo" };
  const r = ruleFor(p);
  if (!r) return { state: "unresolved", reason: "sem regra de classificação fundamentada para este produto (a classificação depende de laudo ou de característica que o catálogo não registra)" };
  if (r.codes) return { state: "classified", codes: r.codes, product: p, scope: r.scope ?? "product", facts: r.facts ?? [], note: r.note ?? null };
  const answer = (await s(env, "SELECT char_value FROM product_characteristics WHERE product_id=? AND char_key=? AND status='confirmed' ORDER BY rowid DESC LIMIT 1", p.id, r.ask.key).first())?.char_value;
  const opt = answer && r.ask.options.find((o) => o.value === answer);
  if (opt) return { state: "classified", codes: opt.codes, product: p, scope: "product", facts: [], byCharacteristic: { key: r.ask.key, value: answer } };
  // Seleção de mercado (2026-10-21): a característica (café cru ou torrado, trigo duro, óleo bruto ou refinado) não é
  // indispensável para saber quais países compram o produto. A pesquisa usa TODAS as subposições documentadas das opções
  // (escopo "research") e não pergunta nada; a característica fica para a etapa comercial (oferta, ficha).
  const union = [...new Map(r.ask.options.flatMap((o) => o.codes).map((c) => [c.hs6, c])).values()];
  if (p.commodity === "coffee" && !union.some((c) => c.hs6 === "090122")) union.push(code("090122", "0901.22.00", "café torrado, descafeinado (NCM 0901.22.00)"));
  return { state: "classified", codes: union, product: p, scope: "research", facts: [], note: `seleção de mercado em todas as subposições documentadas do produto (${union.map((c) => c.ncm).join(", ")}); "${r.ask.question}" fica para a etapa comercial`, commercialCharacteristic: { key: r.ask.key, question: r.ask.question } };
}

// Grava os códigos (SH6 e NCM quando de 8 dígitos) como automação sob a política; reaproveita o pendente igual.
export async function applyClassification(env, tenant, productId, res, { policy, jobId }) {
  if (res.state !== "classified" || !res.codes.length) return { applied: 0 };
  const at = now();
  const actor = { tenant_id: tenant, id: "system-classification", role: "system" };
  const stmts = [];
  for (const c of res.codes)
    for (const [system, value] of [["HS", c.hs6], ...(/^\d{4}\.\d{2}\.\d{2}$/.test(c.ncm) ? [["NCM", c.ncm.replace(/\D/g, "")]] : [])]) {
      const src = `${NCM_SOURCE}. Fundamento: ${c.basis}.${res.byCharacteristic ? ` Característica informada: ${res.byCharacteristic.key} = ${res.byCharacteristic.value}.` : ""} ${res.note ? ` Escopo: ${res.note}.` : ""} Classificação automática do Compass sob a política de pesquisa v${policy?.version ?? "—"}.`;
      stmts.push(s(env, "INSERT INTO product_codes(id,product_id,code_system,code,classification_version,status,source_ref,scope,updated_by,updated_at) VALUES (?,?,?,?,?,'confirmed',?,?,?,?) ON CONFLICT(product_id,code_system,code) DO UPDATE SET status='confirmed',classification_version=excluded.classification_version,source_ref=excluded.source_ref,scope=excluded.scope,updated_by=excluded.updated_by,updated_at=excluded.updated_at", crypto.randomUUID(), productId, system, value, CLASSIFICATION_VERSION, src, res.scope ?? "product", actor.id, at));
    }
  // Fatos documentais usados (ex.: faixa de polarização da ficha), com fonte e data: reaproveitados nas próximas pesquisas.
  const known = new Set((await s(env, "SELECT char_key FROM product_characteristics WHERE product_id=? AND status='confirmed'", productId).all()).results.map((x) => x.char_key));
  for (const fct of res.facts ?? []) if (!known.has(fct.key)) stmts.push(s(env, "INSERT INTO product_characteristics(id,product_id,char_key,char_value,source_ref,status,verified_at) VALUES (?,?,?,?,?,'confirmed',?)", crypto.randomUUID(), productId, fct.key, fct.value, `${fct.source} — registrado pela classificação automática do Compass`, at.slice(0, 10)));
  stmts.push(s(env, "UPDATE products SET revision=revision+1 WHERE id=?", productId));
  stmts.push(auditStatement(env, actor, `prospect:${jobId ?? "—"}`, "catalog.code_auto_classified", "product", productId, { codes: res.codes.map((c) => ({ hs6: c.hs6, ncm: c.ncm })), scope: res.scope ?? "product", policy: policy ? { id: policy.id, version: policy.version } : null, source: NCM_SOURCE, characteristic: res.byCharacteristic ?? null, channel: "automation" }));
  await commit(env, stmts);
  return { applied: res.codes.length };
}

// Resposta da pessoa à característica perguntada: fica no catálogo com a fonte (quem informou, quando e onde).
export async function recordCharacteristic(env, actor, rid, productId, key, value, where) {
  const id = crypto.randomUUID();
  await commit(env, [
    s(env, "INSERT INTO product_characteristics(id,product_id,char_key,char_value,source_ref,status,verified_at) VALUES (?,?,?,?,?,'confirmed',?)", id, productId, key, value, `Informado por ${actor.display_name ?? actor.email ?? actor.id} em ${now().slice(0, 10)} (${where})`, now().slice(0, 10)),
    s(env, "UPDATE products SET revision=revision+1 WHERE id=?", productId),
    auditStatement(env, actor, rid, "catalog.characteristic_informed", "product", productId, { key, value, where }),
  ]);
  return id;
}
