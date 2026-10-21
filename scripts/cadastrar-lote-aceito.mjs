// Cadastra no Compass um lote de empresas já aceitas por Rogério (empresa pela unidade/CNPJ, evidência,
// canal geral publicado e pessoas com fonte). Só usa as rotas da API, que aplicam as regras do Compass
// (raiz de CNPJ única, e-mail só publicado, limite de pessoas). Não envia mensagens nem consome créditos.
//   Simulação (padrão): node scripts/cadastrar-lote-aceito.mjs <arquivo.json>
//   Local (npm run dev): node scripts/cadastrar-lote-aceito.mjs <arquivo.json> --base http://127.0.0.1:8787 --apply
//   Produção: CF_ACCESS_TOKEN=$(cloudflared access token -app=https://<compass>) \
//             node --use-system-ca scripts/cadastrar-lote-aceito.mjs <arquivo.json> --base https://<compass> --apply
//   Procedência (registrada na auditoria; não prova ação humana): --executor, --autorizacao-ref, --autorizado-por,
//   --autorizado-em; o canal é sempre "script".
//   --triagem: depois de criar cada empresa, roda a triagem de sanções pelo fluxo existente (POST /screening).
//   O produto vem do arquivo ("produto"); não há padrão (fluxo geral de rodadas, 2026-10-15). Lotes gerados por
//   scripts/rodada.mjs trazem "rastreio" por empresa; o campo é só registro local.
import { readFileSync } from "node:fs";
import { scriptProvenance, PROVENANCE_FLAGS } from "./lib/procedencia.mjs";

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith("--") && !["--base", "--product", ...PROVENANCE_FLAGS].includes(args[i - 1]));
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : null;
const local = base && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base);
const apply = args.includes("--apply");
if (!file) throw new Error("Informe o arquivo JSON do lote.");
const lote = JSON.parse(readFileSync(file, "utf8"));

async function call(method, path, body) {
  if (!apply) {
    console.log(`[simulação] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 160) : "");
    return { status: 201, json: { id: `simulado-${path.split("/")[3] ?? "x"}` } };
  }
  if (!base || (!local && !process.env.CF_ACCESS_TOKEN)) throw new Error("Use --base e, fora do ambiente local, CF_ACCESS_TOKEN para aplicar.");
  const r = await fetch(new URL(path, base), {
    method,
    headers: { "content-type": "application/json", origin: new URL(base).origin, ...scriptProvenance(args), ...(process.env.CF_ACCESS_TOKEN ? { cookie: `CF_Authorization=${process.env.CF_ACCESS_TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

const catalog = await call("GET", "/api/catalog");
const forced = args.includes("--product") ? args[args.indexOf("--product") + 1] : null;
const variant = lote.produto;
if (!variant) throw new Error('Informe "produto" no arquivo do lote (variante do catálogo); não há produto padrão.');
const options = (catalog.json.products ?? []).filter((p) => String(p.variant_name ?? "").trim().toLowerCase() === variant.toLowerCase());
const produto = !apply ? { id: "simulado-produto" } : forced ? { id: forced } : options.length === 1 ? options[0] : null;
if (!produto) throw new Error(`Produto "${variant}": ${options.length} opções no catálogo (${options.map((p) => `${p.id} ${p.variant_name}`).join("; ")}). Escolha com --product <id>.`);
console.log(`Produto: ${produto.id} (${variant})`);
const triagem = args.includes("--triagem");

for (const e of lote.empresas) {
  const c = await call("POST", "/api/companies", e.company);
  let id = c.json.id;
  if (c.status === 409) {
    // Empresa já cadastrada (mesma raiz ou mesmo CNPJ, identificador oficial, nunca nome parecido): reaproveitada. Entra
    // só o que falta para este produto (unidade, evidências, canal, relação); a relação com outra commodity fica como
    // está. Pessoas e ligação de nível 0 não são criadas: o decisor de outra commodity não vale para esta.
    const existing = c.json.error?.details?.id;
    if (!existing) {
      console.log(`${e.chave}: duplicada sem identificador da existente — nada anexado; confira.`);
      continue;
    }
    if (!apply) {
      console.log(`${e.chave}: já existe (id ${existing}); seria complementada com a relação deste produto.`);
      continue;
    }
    const r = await call("POST", `/api/companies/${existing}/relations`, { productId: produto.id, unit: e.unit ?? null, evidence: e.evidence ?? [], channels: e.channels ?? [], profile: e.profile ?? null });
    console.log(`${e.chave}: já existia (id ${existing}) — ${r.status < 300 ? `unidade ${r.json.unit ?? "sem mudança"}, evidências +${r.json.evidence?.added ?? 0} (reaproveitadas ${r.json.evidence?.reused ?? 0}), relação ${r.json.profile}${r.json.restrictions?.length ? `; restrições vigentes: ${r.json.restrictions.join("; ")}` : ""}` : `complemento recusado (${r.status} ${r.json.error?.code ?? ""})`}. Pessoas e ligação não criadas para outra commodity.`);
    continue;
  } else if (c.status !== 201) {
    console.log(`${e.chave}: falhou ao cadastrar (${c.status})`, c.json);
    continue;
  }
  if (triagem) {
    const r = await call("POST", `/api/companies/${id}/screening`, {});
    console.log(`${e.chave}: triagem ${r.status} — ocorrências ${r.json.matches ?? "?"}, bloqueio ${r.json.block ?? "?"}, revisão ${r.json.review ?? "?"}`);
  }
  for (const ev of e.evidence ?? []) {
    const r = await call("POST", `/api/companies/${id}/evidence`, { ...ev, productId: produto.id });
    console.log(`${e.chave}: evidência ${r.status}${r.status >= 400 ? ` ${r.json.error?.code}: ${r.json.error?.message}` : ""}`);
  }
  for (const ch of e.channels ?? []) {
    const r = await call("POST", `/api/companies/${id}/channels`, ch);
    console.log(`${e.chave}: canal ${r.status}`);
  }
  for (const p of e.people ?? []) {
    const r = await call("POST", `/api/companies/${id}/people`, p);
    console.log(`${e.chave}: pessoa ${r.status}${r.status === 409 ? " (já registrada)" : r.status >= 400 ? ` ${r.json.error?.code}: ${r.json.error?.message}` : ""}`);
  }
  // Perfil comprador "possível" (não confirma compra) e a ligação de nível 0 com o roteiro da unidade (próxima ação).
  if (e.profile) {
    const r = await call("POST", `/api/companies/${id}/profiles`, { ...e.profile, productId: produto.id });
    console.log(`${e.chave}: perfil ${r.status}`);
  }
  if (e.level0) {
    const { channelNote, nextAction, ...create } = e.level0;
    const r = await call("POST", `/api/companies/${id}/level0`, create);
    console.log(`${e.chave}: ligação nível 0 ${r.status}${r.status === 409 ? " (já aberta)" : ""}`);
    // Canal e próxima ação ficam na tarefa pela edição auditada (revisão 1 → 2).
    if (r.status === 201 && (channelNote || nextAction)) {
      const p = await call("PATCH", `/api/tasks/${r.json.id}`, { expectedRevision: 1, reason: "Registro do canal cadastral e da próxima ação no cadastro do lote aceito", channelNote, nextAction });
      console.log(`${e.chave}: canal e próxima ação ${p.status}${p.status >= 400 ? ` ${p.json.error?.code}` : ""}`);
    }
  }
}
console.log(apply ? "Lote aplicado." : "Simulação concluída: nada foi gravado.");
