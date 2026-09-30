// Revisão para decisão de Rogério (2026-09-30): reúne numa tela as decisões pendentes da busca internacional e as
// candidatas mais promissoras, a partir do que já está gravado (descoberta, cache do diretório, aviso legal cifrado).
// Nada aqui aceita candidata, aprova texto, ativa campanha ou envia mensagem. Ordenação determinística, sem IA.
import { bodyJson, fail, str, oneOf, url, requireRole, WRITE_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, product } from "./store.js";
import { decryptPii } from "./crypto.js";
import { generateIdentification, commodityDisplayDe } from "./templates/identificacao.js";
import { commodityDisplay } from "./templates/prospeccao-vendas.js";
import { siteOrigin } from "./people.js";

const ACTIVITY_LABEL = {
  buys_processes: "compra a commodity e processa/torra para si",
  mixed: "compra a commodity e também presta serviço ou revende",
  toll_processing: "beneficia produto de terceiros (serviço), sem evidência de compra própria",
  trade: "importa/revende (trader)",
  logistics_service: "logística (transporte/armazenagem)",
  equipment_service: "máquinas e serviço técnico",
  consulting: "consultoria",
  unknown: "a investigar",
};
const NOT_CONSUMER = new Set(["toll_processing", "trade", "logistics_service", "equipment_service", "consulting"]);
// Primeira pessoa ("wir rösten", "unsere Rösterei", "eigenen Kaffee zu rösten"): a própria empresa diz que torra.
const ROAST_FIRST = /\bwir rösten[^.]*|\brösten wir[^.]*|unsere[rn]? (eigene[rn]? |kleine[rn]? )?rösterei[^.]*|in unserer rösterei[^.]*|hauseigene[rn]? rösterei[^.]*|eigenen kaffee zu rösten[^.]*|trommelröst[^.]*|röstet \([^.]*/i;
// Autodescrição pelo substantivo ("Die Kaffeerösterei X…") só vale para quem o diretório já classificou como processadora;
// em fornecedores ("für Kaffeeröstereien") o substantivo descreve o cliente, não a empresa (visto em 2026-09-30).
const ROAST_NOUN = /(?<!für |von |mit )\b(kaffeer(ö|oe)sterei|privatrösterei|spezialitätenrösterei|kleine rösterei)(?!en)[^.]*/i;

async function searchOf(env, actor, id) {
  const x = await s(env, "SELECT * FROM foreign_searches WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!x) fail(404, "search_not_found", "Busca não encontrada.");
  return x;
}

// PATCH /api/foreign-searches/:id/discovery/:candidateId — registra a investigação (atividade e/ou grupo) com fonte.
export async function investigateCandidate(request, env, actor, rid, searchId, candidateId) {
  requireRole(actor, WRITE_ROLES);
  const x = await searchOf(env, actor, searchId);
  const c = await s(env, "SELECT id FROM discovery_candidates WHERE id=? AND search_id=?", candidateId, x.id).first();
  if (!c) fail(404, "candidate_not_found", "Candidata não encontrada nesta busca.");
  const i = await bodyJson(request);
  const sets = [], args = [];
  if (i.activityType !== undefined) {
    const t = oneOf(i.activityType, Object.keys(ACTIVITY_LABEL), "tipo de atividade");
    const src = url(i.activitySourceUrl);
    if (!src) fail(422, "source_required", "Informe a fonte da atividade.");
    sets.push("activity_type=?", "activity_evidence=?", "activity_source_url=?", "activity_checked_at=?");
    args.push(t, str(i.activityEvidence, "evidência da atividade", 1000), src, now());
  }
  if (i.groupLink !== undefined) {
    const g = oneOf(i.groupLink, ["indication", "confirmed"], "vínculo com grupo");
    const src = url(i.groupSourceUrl);
    if (!src) fail(422, "source_required", "Informe a fonte do vínculo.");
    sets.push("group_link=?", "group_note=?", "group_source_url=?");
    args.push(g, str(i.groupNote, "nota do vínculo", 500), src);
  }
  if (!sets.length) fail(422, "nothing_to_update", "Informe a atividade ou o vínculo com grupo.");
  sets.push("investigated_by=?");
  args.push(actor.id);
  await commit(env, [
    s(env, `UPDATE discovery_candidates SET ${sets.join(",")} WHERE id=?`, ...args, c.id),
    auditStatement(env, actor, rid, "discovery.candidate_investigated", "foreign_search", x.id, { candidateId: c.id, activityType: i.activityType ?? null, groupLink: i.groupLink ?? null }),
  ]);
  return { id: c.id };
}

// POST /api/foreign-searches/:id/discovery/restore — Rogério devolve candidata descartada para "encontrada", com motivo.
export async function restoreCandidates(request, env, actor, rid, searchId) {
  requireRole(actor, WRITE_ROLES);
  const x = await searchOf(env, actor, searchId);
  const i = await bodyJson(request);
  if (!Array.isArray(i.ids) || !i.ids.length || i.ids.length > 50) fail(422, "invalid_ids", "Selecione de 1 a 50 candidatas.");
  const reason = str(i.reason, "motivo", 300);
  const stmts = i.ids.map((cid) => s(env, "UPDATE discovery_candidates SET status='new',dismiss_reason=NULL,decided_by=?,decided_at=?,validation_note=COALESCE(validation_note,'')||? WHERE id=? AND search_id=? AND status='dismissed'", actor.id, now(), ` · devolvida por ${actor.id}: ${reason}`, String(cid), x.id));
  stmts.push(auditStatement(env, actor, rid, "discovery.candidates_restored", "foreign_search", x.id, { ids: i.ids, reason }));
  await commit(env, stmts);
  return { restored: i.ids.length };
}

const sentence = (text, re) => {
  const m = re.exec(text || "");
  return m ? m[0].trim().slice(0, 220) : null;
};

// GET /api/foreign-searches/:id/review
export async function getReview(env, actor, searchId) {
  const x = await searchOf(env, actor, searchId);
  const p = await product(env, actor.tenant_id, x.product_id);
  const hs6 = JSON.parse(x.hs6_json);
  const campaign = await s(env, "SELECT id,name,status,selection_id,language FROM campaigns WHERE id=?", x.campaign_id).first();
  const cv = campaign?.selection_id ? await s(env, "SELECT decision,reason,decided_by,decided_at FROM commercial_validations WHERE tenant_id=? AND selection_id=? AND product_id=? ORDER BY decided_at DESC,rowid DESC LIMIT 1", actor.tenant_id, campaign.selection_id, p.id).first() : null;
  const green = p.commodity === "coffee" && hs6.every((h) => h.startsWith("090111"));
  const ptCommodity = green ? "café verde" : commodityDisplay(p);
  const deCommodity = commodityDisplayDe(p);
  const sig = { senderName: env.SENDER_NAME || "Rogério Palhari", postalAddress: env.EAG_POSTAL_ADDRESS || "[endereço físico da EAG não configurado]" };
  const rec = [{ contactId: "canal", sourceLabel: "site" }];
  const unsub = () => "[link de descadastro próprio, gerado na ficha]";
  const de = deCommodity ? generateIdentification({ language: "de", commodity: deCommodity, recipients: rec, sig, unsub }) : [];
  const pt = generateIdentification({ language: "pt-BR", commodity: ptCommodity, recipients: rec, sig, unsub });

  // Candidatas: dados gravados, cache do diretório e aviso legal (cifrado).
  const rows = (await s(env, "SELECT * FROM discovery_candidates WHERE search_id=? ORDER BY name", x.id).all()).results;
  const kv = new Map((await s(env, "SELECT external_id,result_json FROM research_cache WHERE source='de_coffee_assoc'").all()).results.map((r) => [r.external_id, JSON.parse(r.result_json)]));
  const imp = new Map((await s(env, "SELECT external_id,checked_at,refresh_after,result_json FROM research_cache WHERE source='impressum'").all()).results.map((r) => [r.external_id, r]));
  const at = now();
  const cards = [];
  for (const r of rows) {
    const text = kv.get(r.external_id)?.profileText ?? "";
    const row = r.website ? imp.get(siteOrigin(r.website)) : null;
    const ev = row ? JSON.parse(await decryptPii(row.result_json, env)) : null;
    const first = sentence(text, ROAST_FIRST);
    const roast = first ?? (r.role === "processor" ? sentence(text, ROAST_NOUN) : null);
    const host = r.website ? (() => { try { return new URL(r.website).hostname; } catch { return null; } })() : null;
    cards.push({
      id: r.id, name: r.name, city: r.city, status: r.status, role: r.role, website: r.website, profileUrl: r.record_url, dismissReason: r.dismiss_reason,
      activity: { summary: text ? text.replace(/\s+/g, " ").slice(0, 240) : null, type: r.activity_type, typeLabel: r.activity_type ? ACTIVITY_LABEL[r.activity_type] : null, evidence: r.activity_evidence, sourceUrl: r.activity_source_url, checkedAt: r.activity_checked_at },
      purchaseEvidence: {
        importStatement: r.import_statement ? { text: r.import_statement, date: r.validated_at, kind: "autodeclaração no diretório", brazil: r.mentions_brazil ? "menciona o Brasil (não comprovado)" : "Brasil não mencionado" } : null,
        consumption: roast ? { text: roast, kind: "texto da própria empresa no diretório (torra café)" } : null,
      },
      size: r.size_band ? { band: r.size_band, source: r.size_source, kind: "estimado pela fonte" } : { band: null, note: "desconhecido — pendência pesquisável" },
      group: r.group_link ? { level: r.group_link === "confirmed" ? "confirmado" : "indício", note: r.group_note, sourceUrl: r.group_source_url } : null,
      contact: ev
        ? { technicalState: ev.status === "unreachable" ? "inacessível a partir da Cloudflare" : ev.status, httpStatus: ev.httpStatus ?? null, checkedAt: row.checked_at, stale: row.refresh_after <= at,
            people: (ev.people ?? []).map((q) => ({ name: q.name, title: q.title, kind: "representante legal — a validar" })), generalEmail: ev.email ?? null, phone: ev.phone ?? null }
        : { technicalState: r.website ? "não pesquisado" : "sem site no diretório", people: [] },
      assisted: host || r.name
        ? [
            ...(host ? [{ label: "Busca: aviso legal e contato no site", url: `https://www.google.com/search?q=${encodeURIComponent(`site:${host} impressum OR kontakt`)}` }] : []),
            { label: "Perfil no diretório do Kaffeeverband", url: r.record_url },
            { label: "North Data (registro comercial, dados públicos)", url: `https://www.northdata.de/${encodeURIComponent(r.name)}` },
            { label: "Unternehmensregister (registro oficial — busca manual)", url: "https://www.unternehmensregister.de/ureg/" },
            { label: "LinkedIn — página da empresa (consulta manual)", url: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(r.name)}` },
          ]
        : [],
      _roastStrong: !!roast,
      _roastFirst: !!first,
      // Unidade compradora: a própria empresa diz que torra/compra no seu local (primeira pessoa), com cidade conhecida.
      _unit: !!first && !!r.city,
    });
  }
  const consumerOk = (c) => c.role === "processor" && !NOT_CONSUMER.has(c.activity.type);
  const score = (c) =>
    (consumerOk(c) ? 3 : 0) + (c._roastStrong ? 4 : 0) + (c.activity.type === "buys_processes" ? 2 : c.activity.type === "mixed" ? 1 : 0) +
    (c.purchaseEvidence.importStatement ? 2 : 0) + (c._unit ? 1 : 0) + (c.contact.people.length ? 2 : 0) + (c.contact.generalEmail ? 1 : 0);
  // Porte só desempata (pequena/média primeiro); vínculo com grupo não reduz a prioridade (decisão de 2026-09-30).
  const sizePref = (c) => ({ small: 0, medium: 0, medium_plus: 1 })[c.size.band] ?? (c.size.band === "micro" ? 3 : c.size.band === "giant" ? 4 : 2);
  const open = cards.filter((c) => c.status === "new");
  for (const c of open) {
    const pend = [];
    if (!c.size.band) pend.push("Porte desconhecido — pesquisável (R14.8).");
    if (!c.purchaseEvidence.importStatement) pend.push("Compra de café verde pela empresa a confirmar (a torra indica consumo, não prova a origem nem o fornecedor).");
    pend.push("Origem Brasil não comprovada.");
    if (c.group) pend.push(`Vínculo com grupo (${c.group.level}): avaliar unidade compradora, autonomia de compras e acesso ao responsável.`);
    if (c.contact.technicalState === "inacessível a partir da Cloudflare") pend.push("Site inacessível à Cloudflare (estado técnico): usar a pesquisa assistida; não indica ausência de empresa ou contato.");
    else if (!c.contact.people.length) pend.push("Nenhuma pessoa nomeada no aviso legal: pesquisar compras/gestão.");
    pend.push("E-mail sem validação por verificador (Snov pendente).");
    c.pending = pend;
    const strong = c._roastStrong && consumerOk(c);
    const reach = c.contact.people.length || c.contact.generalEmail;
    c.recommendation = strong && reach ? "Aceitar para avaliação" : consumerOk(c) ? "Avaliar" : "Classificação à parte";
    c.rationale = [
      c._roastStrong ? `consumo declarado pela própria empresa ("${c.purchaseEvidence.consumption.text.slice(0, 90)}…")` : consumerOk(c) ? "processadora pelo diretório, sem frase própria de torra" : `atividade: ${c.activity.typeLabel ?? c.role}`,
      c.purchaseEvidence.importStatement ? "autodeclara importação" : null,
      c.contact.people.length ? `representante nomeado (${c.contact.people.map((q) => q.name).join(", ")})` : c.contact.generalEmail ? "só e-mail geral" : "sem contato lido",
      c._unit ? "unidade compradora: torra no próprio local" : null,
      c.group ? `vínculo com grupo (${c.group.level}) a avaliar — não altera a prioridade` : null,
    ].filter(Boolean).join("; ");
    c.score = score(c);
  }
  const ranked = open.filter(consumerOk).sort((a, b) => b.score - a.score || sizePref(a) - sizePref(b) || a.name.localeCompare(b.name));
  const strip = ({ _roastStrong, _roastFirst, _unit, ...c }) => c;
  const top = ranked.slice(0, 10).map(strip);
  const reclassify = open.filter((c) => c.role === "processor" && NOT_CONSUMER.has(c.activity.type)).map(strip);
  const restoreSuggestions = cards.filter((c) => c.status === "dismissed" && /^\[automático\] (perfil de prestador|texto descreve prestador)/.test(c.dismissReason ?? "") && (c._roastFirst || c.activity.type === "buys_processes" || c.activity.type === "mixed")).map(strip);
  const dismissedInvestigated = cards.filter((c) => c.status === "dismissed" && c.activity.type).map(strip);
  const unreachable = open.filter((c) => c.contact.technicalState === "inacessível a partir da Cloudflare").map((c) => ({ id: c.id, name: c.name, city: c.city, httpStatus: c.contact.httpStatus, checkedAt: c.contact.checkedAt, assisted: c.assisted }));

  return {
    search: { id: x.id, country: x.iso3, hs6, commodity: p.commodity, campaign: campaign ? { id: campaign.id, name: campaign.name, status: campaign.status } : null },
    notice: "Revisão para decisão: nada aqui aceita candidata, aprova texto, ativa campanha ou envia mensagem. Porte e vínculo com grupo mudam a prioridade, nunca descartam. Aprovação individual obrigatória antes de qualquer envio (R18.3).",
    decisions: {
      commercialValidation: {
        rule: "R12.9",
        status: cv ? (cv.decision === "approved" ? "aprovada" : "recusada") : "pendente",
        decidedAt: cv?.decided_at ?? null,
        phrase: `O produto "${p.group_name || p.commodity}" do catálogo da EAG inclui ${green ? "café verde em grão, não torrado e não descafeinado (SH 0901.11)" : `a subposição ${hs6.join(", ")}`}, e a EAG o oferece a compradores ${x.iso3 === "DEU" ? "na Alemanha" : `no país ${x.iso3}`}.`,
        why: "O produto não tem código SH/NCM confirmado no catálogo; a correspondência com a subposição selecionada não é automática.",
        authorizes: "Criar fichas em rascunho e ativar a campanha desta seleção. Não autoriza envio.",
        met: ["Seleção feita na lista do país com compra identificada (R12.14).", "Produto com identidade confirmada no catálogo.", "Busca de empresas aberta (R12.8)."],
        stillPending: ["Porte por empresa (R14.8).", "Aprovação dos textos.", "Ativação da campanha.", "Liberação do internacional (T12).", "E-mail validado por verificador (R19.2 item 11 — Snov).", "Aprovação individual por destinatário (R18.3).", "Verificações do R19.2 no envio."],
        registerAt: campaign?.selection_id ? { selectionId: campaign.selection_id, productId: p.id } : null,
      },
      sizeReference: {
        status: "aprovada em 2026-09-30 (só para priorização)",
        current: "Porte ordena, não exclui: micro, pequenas, médias, grandes e empresas de grupos continuam elegíveis; pequenas e médias têm preferência quando os demais critérios forem semelhantes. Dados parciais geram porte estimado ou desconhecido, nunca descarte.",
        proposal: "Referência: Recomendação da Comissão Europeia 2003/361/CE (base autêntica da definição de PME, conforme o guia oficial da Comissão). Desde 2025 existe também a categoria 'small mid-cap' (Recomendação (UE) 2025/1099): menos de 750 pessoas e faturamento até EUR 150 mi ou balanço até EUR 129 mi. Fora da UE, é referência operacional europeia, não enquadramento legal local.",
        table: [
          { category: "Micro", staff: "< 10", turnover: "≤ EUR 2 mi", balance: "≤ EUR 2 mi" },
          { category: "Pequena", staff: "< 50", turnover: "≤ EUR 10 mi", balance: "≤ EUR 10 mi" },
          { category: "Média", staff: "< 250", turnover: "≤ EUR 50 mi", balance: "≤ EUR 43 mi" },
          { category: "Grande", staff: "≥ 250", turnover: "acima", balance: "acima" },
        ],
        groups: "Vínculo não se decide só pela porcentagem: empresa ligada é a que tem maioria dos votos, pode nomear ou destituir a maioria da administração, exerce influência dominante por contrato ou estatuto, ou controla a maioria dos votos por acordo; ligação por pessoas físicas agindo em conjunto conta quando atuam no mesmo mercado ou em mercados adjacentes. Parceira: 25% ou mais sem ser ligada, somando a parte proporcional. Exceções que não quebram a autonomia até 50%: sociedades públicas de participação e capital de risco, investidores-anjo (investimento total abaixo de EUR 1,25 mi na mesma empresa), universidades e centros de pesquisa sem fins lucrativos, investidores institucionais e autoridades locais autônomas com orçamento abaixo de EUR 10 mi e menos de 5 mil habitantes. Empresa com 25% ou mais do capital ou votos controlados por órgãos públicos não é PME.",
        headcount: "Efetivo em UTA: tempo integral conta 1; tempo parcial e sazonal contam como fração. Não entram aprendizes ou estudantes em formação profissional com contrato de aprendizagem ou de formação profissional, nem pessoas em licença-maternidade ou parental. A mudança de categoria só vale depois de ultrapassar (ou ficar abaixo de) um limite em dois exercícios consecutivos.",
        estimatedVsProven: "Estimado = faixa inferida de fonte parcial (ex.: funcionários citados em matéria, faixa de efetivo de registro). Comprovado = efetivo e dados financeiros de fonte oficial, somando parceiras e ligadas. Sem dado, o porte fica desconhecido e pesquisável.",
        source: "Comissão Europeia, User guide to the SME definition (Publications Office): 'Commission Recommendation 2003/361/EC … is the sole authentic basis for determining the conditions regarding qualification as an SME'.",
      },
      r148: {
        status: "aprovada em 2026-09-30",
        current: 'R14.8 (K1; revisada em 2026-09-30): SE o porte for desconhecido, ENTÃO a ficha DEVE exigir a pendência de porte resolvida ou a qualificação do porte registrada como objetivo do primeiro contato — na ligação ou, quando o primeiro contato for por e-mail, na conversa que ele abrir (skill: "manter e qualificar volume na ligação"). O porte DEVE continuar desconhecido até evidência com fonte. A falta de porte conhecido NÃO DEVE impedir ficha cujo objetivo inclua esclarecer essa informação.',
        proposed: null,
      },
      texts: {
        status: "rascunho — não aprovado",
        recipient: "canal geral publicado no site oficial de cada empresa",
        // Endereço físico da assinatura (R19.13): vem de docs/eag-compass-perfil.md (eagagro.com/contato), configurado em
        // 2026-09-24 na implementação; não há confirmação registrada de Rogério. Sinalizado, sem trocar por outro.
        address: {
          value: env.EAG_POSTAL_ADDRESS || null,
          confirmedByRogerio: false,
          source: "Perfil da empresa no projeto (docs/eag-compass-perfil.md, de eagagro.com/contato), configurado em 24/09/2026 durante a implementação.",
          pending: "Endereço sem confirmação registrada de Rogério: confirmar ou corrigir antes de aprovar a ficha (R19.13 exige endereço físico real).",
        },
        followUpSubject: "O acompanhamento usa o mesmo assunto, sem \"Re:\": o envio não encadeia o segundo e-mail como resposta ao primeiro.",
        stops: "A sequência para com resposta (R20.1), descadastro (R21) ou pausa (R22), como as demais fichas.",
        steps: de.map((m, k) => ({ step: m.step, day: m.day, de: { subject: m.subject, body: m.body }, pt: { subject: pt[k].subject, body: pt[k].body } })),
      },
    },
    top10: top,
    reclassify,
    restoreSuggestions,
    dismissedInvestigated,
    unreachable,
    counts: { open: open.length, consumers: ranked.length, traders: open.filter((c) => c.role === "trader").length, reclassify: reclassify.length, unreachable: unreachable.length },
    snov: {
      configured: !!(env.SNOV_CLIENT_ID && env.SNOV_CLIENT_SECRET),
      note: "Pendência independente: validação de e-mail por verificador (R19.2 item 11; decisão G11). Não bloqueia a pesquisa nem a revisão.",
      steps: [
        "Entrar na conta Snov.io e abrir https://app.snov.io/account/api (client ID e client secret). No plano gratuito, a API é liberada por demonstração agendada; cada verificação válida ou 'unknown' custa 1 crédito.",
        "No PowerShell, na pasta do projeto: cd C:\\Users\\Roger\\eag-compass",
        "npx wrangler secret put SNOV_CLIENT_ID (o valor é pedido sem ser exibido)",
        "npx wrangler secret put SNOV_CLIENT_SECRET",
        "npx wrangler secret list — conferir só os nomes. Sem --env: a configuração de topo é o Worker de produção eag-compass-production.",
      ],
    },
  };
}
