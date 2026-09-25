// Estado das integrações para o admin (sem valores de segredo) e conferência da caixa sem envio.
// Serve para Rogério e para a verificação depois de cada `wrangler secret put`: só diz se está configurado.
import { bodyJson, fail, requireRole } from "./http.js";
import { statement as s, commit, auditStatement, parameters } from "./store.js";
import { imapClient } from "./adapters/imap.js";
import { AdapterError } from "./adapters/errors.js";

const ADMIN = new Set(["admin"]);
const has = (v) => typeof v === "string" && v.length > 0;

export async function status(env, actor) {
  requireRole(actor, ADMIN);
  const p = await parameters(env, actor.tenant_id);
  const channel = await s(env, "SELECT state FROM channels WHERE tenant_id=? AND channel='email'", actor.tenant_id).first();
  const lists = (
    await s(
      env,
      "SELECT ss.source_key,(SELECT MAX(v.downloaded_at) FROM sanction_list_versions v WHERE v.source_id=ss.id AND v.import_status='imported') last FROM sanction_sources ss WHERE ss.active=1",
    ).all()
  ).results;
  const maxAge = p["sanctions_max_age_hours:global"] ?? null;
  return {
    email: {
      provider: "Hostinger (SMTP 465 / IMAP 993, SSL)",
      sender: env.MAILBOX_USER || null,
      passwordConfigured: has(env.MAILBOX_PASSWORD),
      postalAddressConfigured: has(env.EAG_POSTAL_ADDRESS),
      publicBaseUrl: env.PUBLIC_BASE_URL || null,
      internalTestRecipients: String(env.INTERNAL_TEST_RECIPIENTS || "").split(",").filter((x) => x.trim()).length,
      channel: channel?.state ?? "planned",
      sendWindowNational: p["send_window:national"] ?? null,
      sendTimezoneNational: p["send_timezone:national"] ?? null,
      sendWindowInternational: p["send_window:international"] ?? null,
    },
    providers: {
      snov: has(env.SNOV_CLIENT_ID) && has(env.SNOV_CLIENT_SECRET),
      casadosdados: has(env.CASADOSDADOS_API_KEY),
      locationiq: has(env.LOCATIONIQ_KEY),
      comtrade: has(env.COMTRADE_KEY),
    },
    infrastructure: { queue: !!env.ASYNC_QUEUE, r2: !!env.FILES },
    sanctions: {
      maxAgeHours: maxAge,
      lists: lists.map((l) => ({ source: l.source_key, importedAt: l.last, current: !!l.last && maxAge != null && Date.now() - Date.parse(l.last) <= maxAge * 3600000 })),
    },
  };
}

// LOGIN + EXAMINE (só leitura) + LOGOUT na caixa configurada. Nenhuma mensagem é lida, marcada ou enviada.
export async function checkMailbox(request, env, actor, rid, deps = {}) {
  requireRole(actor, ADMIN);
  await bodyJson(request);
  if (!has(env.MAILBOX_USER) || !has(env.MAILBOX_PASSWORD)) fail(409, "mailbox_not_configured", "Senha da caixa ainda não configurada (wrangler secret put MAILBOX_PASSWORD).");
  let result;
  try {
    const r = await (deps.client ?? imapClient(env)).check("INBOX");
    result = { ok: true, messagesInInbox: r.messages, uidValidity: r.uidValidity };
  } catch (e) {
    result = { ok: false, error: e instanceof AdapterError ? e.kind : "unexpected", detail: e instanceof AdapterError ? e.message.slice(0, 160) : null };
  }
  await commit(env, [auditStatement(env, actor, rid, "integration.mailbox_checked", "integration", "mailbox", { ok: result.ok, error: result.error ?? null })]);
  return result;
}
