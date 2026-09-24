// Respostas recebidas (P2-T11; R20, R21.2–R21.6, R19.7, R19.12, R28.13; errata itens 4 e 7).
// Chave estável (caixa + UIDVALIDITY + UID); correlação por Message-ID e, sem thread, pelo remetente;
// ambígua mantém pausa de todos os envolvidos; nenhuma resposta automática é enviada (R19.9).
import { statement as s, now } from "./store.js";
import { identifierHash } from "./crypto.js";
import { parseMessage, header, addressOf, messageIds } from "./mime.js";
import { imapClient } from "./adapters/imap.js";

const UNSUB_RE = /^\s*(?:please,?\s+|por favor,?\s+)?(sair|descadastr\w*|remover|remova[- ]me|me (tire|remova)|unsubscribe|remove me|stop|opt[ -]?out|take me off)\b/im;
const PRICE_RE = /pre[çc]o|tabela|cota[çc][ãa]o|apresenta[çc][ãa]o|proposta|price|pricing|quote|quotation|catalog|proposal|presentation/i;
const AUTO_SUBJECT = /^(resposta autom[áa]tica|automatic reply|auto[- ]?reply|out of office|aus[êe]ncia|f[ée]rias|ooo\b)/i;
const PROVIDER_ALERT = /suspens|bloque|limit|spam|abuse|abuso|blacklist|violation|viola[çc][ãa]o/i;
const LOOKBACK_DAYS = 60;
// Orientação fixa quando o comprador pede preço/tabela (R28.13; skill: nada de preço antes da reunião).
export const PRICE_GUIDANCE =
  "Pedido de preço, tabela ou apresentação: responda pessoalmente propondo a conversa de 20–30 minutos para entender volume, especificação e prazo antes de qualquer valor (a /prospeccao-vendas não envia preço nem proposta antes da reunião).";

export function classify(msg, mailboxUser) {
  const from = addressOf(header(msg, "from"));
  const subject = header(msg, "subject") || "";
  if (msg.contentType === "multipart/report" || msg.report) {
    const st = msg.report?.status || "";
    return { kind: /^5\./.test(st) ? "bounce_hard" : "bounce_soft", from, target: msg.report?.finalRecipient?.toLowerCase() || null };
  }
  if (from && /@(.+\.)?hostinger\.com$/i.test(from) && PROVIDER_ALERT.test(`${subject} ${msg.text}`)) return { kind: "provider_alert", from };
  const auto = header(msg, "auto-submitted");
  if ((auto && auto.toLowerCase() !== "no") || header(msg, "x-autoreply") || header(msg, "x-autorespond") || AUTO_SUBJECT.test(subject))
    return { kind: "auto_reply", from };
  if (!from || (mailboxUser && from === mailboxUser.toLowerCase())) return { kind: "unclassified", from };
  // Só as primeiras linhas escritas (sem citação) contam para "sair".
  const own = msg.text.split(/\r?\n/).filter((l) => !/^\s*>/.test(l)).slice(0, 6).join("\n");
  if (UNSUB_RE.test(own)) return { kind: "unsubscribe", from };
  if (!msg.text.trim()) return { kind: "unclassified", from };
  return { kind: "human", from, priceRequest: PRICE_RE.test(own) };
}

// Envolvidos: thread (In-Reply-To/References) ou remetente com passo aceito nos últimos 60 dias.
async function correlate(env, tenant, msg, fromHash, at) {
  const ids = [...messageIds(header(msg, "in-reply-to")), ...messageIds(header(msg, "references"))];
  if (ids.length) {
    const hit = await s(
      env,
      `SELECT id,company_id,commodity,contact_id FROM send_outbox WHERE tenant_id=? AND message_id IN (${ids.map(() => "?").join(",")}) LIMIT 1`,
      tenant, ...ids,
    ).first();
    if (hit) return { correlation: "thread", targets: [hit], outboxId: hit.id };
  }
  if (!fromHash) return { correlation: "none", targets: [] };
  const since = new Date(Date.parse(at) - LOOKBACK_DAYS * 86400000).toISOString();
  const rows = (
    await s(
      env,
      "SELECT DISTINCT company_id,commodity FROM send_outbox WHERE tenant_id=? AND email_hash=? AND status='accepted' AND accepted_at>=?",
      tenant, fromHash, since,
    ).all()
  ).results;
  if (!rows.length) return { correlation: "none", targets: [] };
  return { correlation: rows.length === 1 ? "sender" : "ambiguous", targets: rows };
}

async function owner(env, tenant, companyId) {
  const f = await s(env, "SELECT created_by FROM fichas WHERE tenant_id=? AND company_id=? ORDER BY updated_at DESC LIMIT 1", tenant, companyId).first();
  return f?.created_by || "system-admin";
}

// Pausa empresa + commodity (todas as variantes, todos os canais e contatos) e abre tarefa para Rogério (R20.1, R20.5).
async function pauseTargets(env, tenant, targets, at, kind, note) {
  const st = [];
  for (const t of targets) {
    st.push(
      s(env, "UPDATE send_outbox SET status='cancelled',block_reason=?,updated_at=? WHERE tenant_id=? AND company_id=? AND commodity=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')", `reply_${kind}`, at, tenant, t.company_id, t.commodity),
      s(env, "UPDATE tasks SET status='suspended',suspended_reason='resposta recebida' WHERE tenant_id=? AND company_id=? AND commodity=? AND status='open' AND kind IN ('call_l0','call_l1','call_l2','linkedin')", tenant, t.company_id, t.commodity),
      s(
        env,
        "INSERT INTO tasks(id,tenant_id,company_id,commodity,kind,owner_id,due_date,priority,script) VALUES (?,?,?,?,?,?,?,10,?)",
        crypto.randomUUID(), tenant, t.company_id, t.commodity, kind === "ambiguous" ? "review_ambiguous" : "reply_followup", await owner(env, tenant, t.company_id), at.slice(0, 10), note,
      ),
    );
    // Outra commodity da mesma empresa: só alerta (R20.5).
    st.push(
      s(
        env,
        "INSERT INTO tasks(id,tenant_id,company_id,commodity,kind,owner_id,due_date,priority,script) SELECT ?,?,?,o.commodity,'reply_followup',?,?,1,? FROM (SELECT DISTINCT commodity FROM send_outbox WHERE tenant_id=? AND company_id=? AND commodity<>? AND status IN ('pending','waiting_sequence','temp_failed')) o",
        crypto.randomUUID(), tenant, t.company_id, await owner(env, tenant, t.company_id), at.slice(0, 10), "A empresa respondeu sobre outra commodity; revise antes do próximo toque.", tenant, t.company_id, t.commodity,
      ),
    );
  }
  return st;
}

// Processa uma mensagem da caixa. Repetida (mesma chave) não produz efeito duplicado.
export async function processMessage(env, tenant, { mailbox, uidValidity, uid, bytes }, at = now()) {
  const msg = parseMessage(bytes);
  const c = classify(msg, env.MAILBOX_USER);
  const fromHash = c.from ? await identifierHash(env, tenant, "email", c.from) : null;
  const corr = ["human", "auto_reply", "unclassified", "unsubscribe"].includes(c.kind)
    ? await correlate(env, tenant, msg, fromHash, at)
    : { correlation: "none", targets: [] };
  const id = crypto.randomUUID();
  let r2Key = "not_stored";
  if (env.FILES) {
    r2Key = `inbound/${uidValidity}/${uid}.eml`;
    await env.FILES.put(r2Key, bytes);
  }
  const ins = await s(
    env,
    "INSERT INTO inbound_messages(id,tenant_id,mailbox,uidvalidity,imap_uid,message_id,in_reply_to,references_json,from_hash,classification,correlation,outbox_id,company_id,commodity,r2_key,received_at,processed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,mailbox,uidvalidity,imap_uid) DO NOTHING",
    id, tenant, mailbox, uidValidity, uid, header(msg, "message-id"), header(msg, "in-reply-to"),
    JSON.stringify(messageIds(header(msg, "references"))), fromHash, c.kind, corr.correlation, corr.outboxId ?? null,
    corr.targets.length === 1 ? corr.targets[0].company_id : null, corr.targets.length === 1 ? corr.targets[0].commodity : null, r2Key, at, at,
  ).run();
  if (!ins.meta.changes) return { duplicate: true };
  const st = [];
  if (c.kind === "unsubscribe" && fromHash) {
    // Supressão antes de qualquer outro efeito; sem despedida (R21.2, R21.6).
    st.push(
      s(env, "INSERT INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,'email','opt_out','reply','system-inbound') ON CONFLICT(tenant_id,identifier_hash,channel) DO NOTHING", crypto.randomUUID(), tenant, fromHash),
      s(env, "UPDATE send_outbox SET status='cancelled',block_reason='unsubscribed',updated_at=? WHERE tenant_id=? AND email_hash=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')", at, tenant, fromHash),
    );
  }
  if (["human", "auto_reply", "unclassified", "unsubscribe"].includes(c.kind) && corr.targets.length) {
    const note =
      corr.correlation === "ambiguous"
        ? "Resposta de um remetente ligado a mais de uma empresa/commodity: confira na caixa e decida; todos ficam pausados."
        : c.kind === "auto_reply"
          ? "Resposta automática (ausência): a sequência fica pausada até sua decisão (B1 pendente)."
          : c.priceRequest
            ? PRICE_GUIDANCE
            : "Resposta recebida: leia na caixa e defina o próximo passo.";
    st.push(...(await pauseTargets(env, tenant, corr.targets, at, corr.correlation === "ambiguous" ? "ambiguous" : c.kind, note)));
  }
  if (c.kind === "bounce_hard" && c.target) {
    const h = await identifierHash(env, tenant, "email", c.target);
    st.push(
      s(env, "INSERT INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,'email','hard_bounce','bounce','system-inbound') ON CONFLICT(tenant_id,identifier_hash,channel) DO NOTHING", crypto.randomUUID(), tenant, h),
      s(env, "UPDATE send_outbox SET status='cancelled',block_reason='hard_bounce',updated_at=? WHERE tenant_id=? AND email_hash=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')", at, tenant, h),
    );
  }
  if (c.kind === "provider_alert") {
    // Aviso do provedor para tudo imediatamente (R19.12); só a retomada da operação libera.
    st.push(
      s(env, "UPDATE sender_state SET stopped_at=?,stopped_reason='aviso do provedor' WHERE tenant_id=? AND stopped_at IS NULL", at, tenant),
      s(env, "INSERT INTO pauses(id,tenant_id,scope,scope_ref,reason,created_by) VALUES (?,?,'operation',NULL,'Parada automática: aviso do provedor de e-mail','system-inbound')", crypto.randomUUID(), tenant),
    );
  }
  if (st.length) await env.DB.batch(st);
  return { id, classification: c.kind, correlation: corr.correlation };
}

// Leitura periódica com lease por caixa; UIDVALIDITY diferente recomeça a contagem.
export async function poll(env, tenant, deps = {}) {
  const at = deps.now ?? now();
  const mailbox = "INBOX";
  const owner = crypto.randomUUID();
  await s(env, "INSERT OR IGNORE INTO inbound_cursor(tenant_id,mailbox,uidvalidity,last_uid) VALUES (?,?,0,0)", tenant, mailbox).run();
  const got = await s(
    env,
    "UPDATE inbound_cursor SET lease_owner=?,lease_until=? WHERE tenant_id=? AND mailbox=? AND (lease_until IS NULL OR lease_until<?)",
    owner, new Date(Date.parse(at) + 120000).toISOString(), tenant, mailbox, at,
  ).run();
  if (!got.meta.changes) return { reason: "busy" };
  try {
    const cur = await s(env, "SELECT * FROM inbound_cursor WHERE tenant_id=? AND mailbox=?", tenant, mailbox).first();
    const client = deps.client ?? imapClient(env);
    let { uidValidity, messages } = await client.fetchNew(mailbox, cur.last_uid);
    let last = cur.last_uid;
    if (uidValidity !== cur.uidvalidity) {
      last = 0;
      if (cur.last_uid > 0) ({ uidValidity, messages } = await client.fetchNew(mailbox, 0));
    }
    let processed = 0;
    for (const m of messages) {
      await processMessage(env, tenant, { mailbox, uidValidity, uid: m.uid, bytes: m.bytes }, at);
      last = Math.max(last, m.uid);
      processed++;
      await s(env, "UPDATE inbound_cursor SET uidvalidity=?,last_uid=?,updated_at=? WHERE tenant_id=? AND mailbox=? AND lease_owner=?", uidValidity, last, at, tenant, mailbox, owner).run();
    }
    if (!messages.length)
      await s(env, "UPDATE inbound_cursor SET uidvalidity=?,updated_at=? WHERE tenant_id=? AND mailbox=? AND lease_owner=?", uidValidity, at, tenant, mailbox, owner).run();
    return { processed };
  } finally {
    await s(env, "UPDATE inbound_cursor SET lease_owner=NULL,lease_until=NULL WHERE tenant_id=? AND mailbox=? AND lease_owner=?", tenant, mailbox, owner).run();
  }
}
