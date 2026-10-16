// Qualificação assistida de um lote de empresas JÁ CADASTRADAS (fluxo geral; qualquer commodity, origem ou rodada).
// Usa só as rotas existentes do Compass, com as mesmas regras do cadastro manual:
//   - evidências com fonte → POST /api/companies/:id/evidence (sem duplicar: mesma URL e mesma referência);
//   - canal corporativo publicado (e-mail + URL onde está publicado + finalidade no rótulo) → POST /channels;
//   - site e atividade com fonte → PATCH /basics; porte com fonte e base (estimado/comprovado) → PATCH /size;
//   - perfil comprador (classe e fundamento) → POST /profiles, com a revisão atual;
//   - opcional: as mesmas evidências entram na rodada como pesquisa assistida (POST /api/rounds/:id/candidates),
//     para o resultado da rodada refletir a qualificação na próxima execução.
// Procedência (registrada na auditoria; não prova ação humana): --executor, --autorizacao-ref, --autorizado-por,
// --autorizado-em; o canal é sempre "script".
// Não cria pessoa, contato pessoal, ficha, tarefa ou envio. Não consome crédito. Simulação por padrão.
//   node scripts/qualificar-lote.mjs <lote.json>                               (simulação; nada é gravado)
//   CF_ACCESS_TOKEN=... node scripts/qualificar-lote.mjs <lote.json> --base https://<compass> --apply
//   node scripts/qualificar-lote.mjs <lote.json> --base https://<compass> --foto <saida.json>   (só leitura)
// Formato do lote:
//   { "produto": "<id do produto>", "rodada": "<id da rodada, opcional>", "empresas": [ { "cnpj": "...",
//     "assistidas": [ { "name", "sourceUrl", "evidence": { "kind", "strength", "quote" } } ],
//     "evidencias": [ { "category", "evidenceType", "market", "supports", "reference", "sourceUrl", "consultedAt",
//                       "validationStatus" } ],
//     "canais": [ { "email", "sourceUrl", "sourceKind", "label" } ],
//     "basicos": { "website", "activityText", "activitySource" },
//     "porte": { "sizeBand", "source", "basis" },
//     "perfil": { "profileClass", "basis" } } ] }
import { readFileSync, writeFileSync } from "node:fs";
import { scriptProvenance, PROVENANCE_FLAGS } from "./lib/procedencia.mjs";

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith("--") && !["--base", "--foto", ...PROVENANCE_FLAGS].includes(args[i - 1]));
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : null;
const apply = args.includes("--apply");
const foto = args.includes("--foto") ? args[args.indexOf("--foto") + 1] : null;
if (!file) throw new Error("Informe o arquivo JSON do lote.");
const lote = JSON.parse(readFileSync(file, "utf8"));
if (!lote.produto) throw new Error('Informe "produto" (id do catálogo); não há padrão.');
const digits = (v) => String(v ?? "").replace(/\D/g, "");

async function http(method, path, body) {
  if (!base) throw new Error("Use --base para ler ou gravar.");
  const r = await fetch(new URL(path, base), {
    method,
    headers: { "content-type": "application/json", origin: new URL(base).origin, ...scriptProvenance(args), ...(process.env.CF_ACCESS_TOKEN ? { cookie: `CF_Authorization=${process.env.CF_ACCESS_TOKEN}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const json = (r.headers.get("content-type") || "").includes("json") ? await r.json() : {};
  return { status: r.status, json };
}
// Gravação: em simulação só mostra o que seria enviado.
async function write(method, path, body) {
  if (!apply) {
    console.log(`  [simulação] ${method} ${path} ${JSON.stringify(body).slice(0, 140)}`);
    return { status: 0, json: {} };
  }
  return http(method, path, body);
}

async function companyByCnpj(cnpj) {
  const r = await http("GET", `/api/companies?q=${digits(cnpj)}&limit=5`);
  const hits = (r.json.companies ?? []).filter((c) => digits(c.registration_id) === digits(cnpj));
  if (hits.length !== 1) throw new Error(`CNPJ ${cnpj}: ${hits.length} empresas encontradas (esperada 1).`);
  return hits[0];
}

async function snapshot(id) {
  const c = (await http("GET", `/api/companies/${id}?limit=100`)).json;
  const profiles = (await http("GET", `/api/companies/${id}/profiles`)).json.items ?? [];
  return {
    id, legalName: c.company.legal_name, pipeline: c.company.pipeline_status, website: c.company.website ?? null, activity: c.company.activity_text ?? null,
    size: c.company.size_class ? { band: c.company.size_class, basis: c.company.size_basis, source: c.company.size_source } : null,
    evidence: c.evidence.map((e) => ({ type: e.evidence_type, status: e.validation_status, url: e.source_url, supports: JSON.parse(e.metadata_json || "{}").supports ?? [], reference: e.reference.slice(0, 160) })),
    channels: c.contacts.filter((k) => k.contactKind === "company_channel").map((k) => ({ email: k.email, label: k.fullName, source: k.sourceUrl })),
    people: c.contacts.filter((k) => k.contactKind !== "company_channel").length,
    profiles: profiles.map((p) => ({ product: p.product_id, class: p.profile_class, icp: p.icp_status, revision: p.revision, basis: p.basis })),
  };
}

const out = {};
for (const e of lote.empresas) {
  const c = await companyByCnpj(e.cnpj);
  console.log(`${e.cnpj} → ${c.id} (${c.legal_name})`);
  if (foto) { out[e.cnpj] = await snapshot(c.id); continue; }
  const before = await snapshot(c.id);
  if (lote.rodada)
    for (const a of e.assistidas ?? []) {
      const r = await write("POST", `/api/rounds/${lote.rodada}/candidates`, { intake: "assisted", candidate: { ...a, registrationId: e.cnpj } });
      if (apply) console.log(`  rodada (pesquisa assistida): ${r.status}${r.json.added === 0 ? " (já registrada)" : ""}`);
    }
  for (const ev of e.evidencias ?? []) {
    if (before.evidence.some((x) => x.url === ev.sourceUrl && x.reference === ev.reference.slice(0, 160))) { console.log("  evidência já registrada: mantida"); continue; }
    const r = await write("POST", `/api/companies/${c.id}/evidence`, { productId: lote.produto, ...ev });
    if (apply) console.log(`  evidência: ${r.status}${r.status >= 400 ? ` ${r.json.error?.code}` : ""}`);
  }
  for (const ch of e.canais ?? []) {
    if (before.channels.some((x) => x.email === ch.email)) { console.log("  canal já registrado: mantido"); continue; }
    const r = await write("POST", `/api/companies/${c.id}/channels`, ch);
    if (apply) console.log(`  canal: ${r.status}${r.status >= 400 ? ` ${r.json.error?.code}` : ""}`);
  }
  if (e.basicos && (before.website !== (e.basicos.website ?? before.website) || before.activity !== (e.basicos.activityText ?? before.activity))) {
    const r = await write("PATCH", `/api/companies/${c.id}/basics`, e.basicos);
    if (apply) console.log(`  site/atividade: ${r.status}`);
  }
  if (e.porte && !(before.size?.band === e.porte.sizeBand && before.size?.basis === (e.porte.basis ?? "estimated") && before.size?.source === e.porte.source)) {
    const r = await write("PATCH", `/api/companies/${c.id}/size`, e.porte);
    if (apply) console.log(`  porte: ${r.status}${r.status >= 400 ? ` ${r.json.error?.code}` : ""}`);
  }
  if (e.perfil) {
    // Revisão lida agora: gravar o porte pode ter atualizado o perfil (situação no ICP).
    const prev = apply ? (await snapshot(c.id)).profiles.find((p) => p.product === lote.produto) : before.profiles.find((p) => p.product === lote.produto);
    if (prev && prev.class === e.perfil.profileClass && prev.basis === e.perfil.basis) { console.log("  perfil já igual: mantido"); continue; }
    const r = await write("POST", `/api/companies/${c.id}/profiles`, { productId: lote.produto, ...e.perfil, ...(prev ? { expectedRevision: prev.revision } : {}) });
    if (apply) console.log(`  perfil: ${r.status}${r.status >= 400 ? ` ${r.json.error?.code}` : ` (${r.json.icpStatus})`}`);
  }
}
if (foto) {
  writeFileSync(foto, JSON.stringify(out, null, 1));
  console.log(`Foto de ${Object.keys(out).length} empresas em ${foto} (só leitura).`);
} else console.log(apply ? "Lote aplicado." : "Simulação concluída: nada foi gravado.");
