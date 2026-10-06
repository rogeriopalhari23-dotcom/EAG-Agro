// Cadastra no Compass um lote de empresas já aceitas por Rogério (empresa pela unidade/CNPJ, evidência,
// canal geral publicado e pessoas com fonte). Só usa as rotas da API, que aplicam as regras do Compass
// (raiz de CNPJ única, e-mail só publicado, limite de pessoas). Não envia mensagens nem consome créditos.
//   Simulação (padrão): node scripts/cadastrar-lote-aceito.mjs <arquivo.json>
//   Local (npm run dev): node scripts/cadastrar-lote-aceito.mjs <arquivo.json> --base http://127.0.0.1:8787 --apply
//   Produção: CF_ACCESS_TOKEN=$(cloudflared access token -app=https://<compass>) \
//             node --use-system-ca scripts/cadastrar-lote-aceito.mjs <arquivo.json> --base https://<compass> --apply
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
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
    headers: { "content-type": "application/json", origin: new URL(base).origin, ...(process.env.CF_ACCESS_TOKEN ? { cookie: `CF_Authorization=${process.env.CF_ACCESS_TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

const catalog = await call("GET", "/api/catalog");
const forced = args.includes("--product") ? args[args.indexOf("--product") + 1] : null;
const variant = lote.produto ?? "Milho GMO";
const options = (catalog.json.products ?? []).filter((p) => String(p.variant_name ?? "").trim().toLowerCase() === variant.toLowerCase());
const milho = !apply ? { id: "simulado-milho" } : forced ? { id: forced } : options.length === 1 ? options[0] : null;
if (!milho) throw new Error(`Produto milho: ${options.length} opções no catálogo (${options.map((p) => `${p.id} ${p.variant_name}`).join("; ")}). Escolha com --product <id>.`);
console.log(`Produto: ${milho.id} (${variant})`);

for (const e of lote.empresas) {
  const c = await call("POST", "/api/companies", e.company);
  let id = c.json.id;
  if (c.status === 409) {
    // A empresa existente pode ser outra unidade da mesma raiz: não anexa evidência nem pessoas sem conferência humana.
    console.log(`${e.chave}: já existe empresa com essa raiz ou CNPJ (id ${c.json.error?.details?.id}) — nada anexado; confira a unidade antes.`);
    continue;
  } else if (c.status !== 201) {
    console.log(`${e.chave}: falhou ao cadastrar (${c.status})`, c.json);
    continue;
  }
  for (const ev of e.evidence) {
    const r = await call("POST", `/api/companies/${id}/evidence`, { ...ev, productId: milho.id });
    console.log(`${e.chave}: evidência ${r.status}${r.status >= 400 ? ` ${r.json.error?.code}: ${r.json.error?.message}` : ""}`);
  }
  for (const ch of e.channels) {
    const r = await call("POST", `/api/companies/${id}/channels`, ch);
    console.log(`${e.chave}: canal ${r.status}`);
  }
  for (const p of e.people) {
    const r = await call("POST", `/api/companies/${id}/people`, p);
    console.log(`${e.chave}: pessoa ${r.status}${r.status === 409 ? " (já registrada)" : r.status >= 400 ? ` ${r.json.error?.code}: ${r.json.error?.message}` : ""}`);
  }
  // Perfil comprador "possível" (não confirma compra) e a ligação de nível 0 com o roteiro da unidade (próxima ação).
  if (e.profile) {
    const r = await call("POST", `/api/companies/${id}/profiles`, { ...e.profile, productId: milho.id });
    console.log(`${e.chave}: perfil ${r.status}`);
  }
  if (e.level0) {
    const r = await call("POST", `/api/companies/${id}/level0`, e.level0);
    console.log(`${e.chave}: ligação nível 0 ${r.status}${r.status === 409 ? " (já aberta)" : ""}`);
  }
}
console.log(apply ? "Lote aplicado." : "Simulação concluída: nada foi gravado.");
