// Descadastro público de um clique (P2-T12; R21.6, R21.7, R21.9, R21.10; RFC 8058).
// GET só mostra a confirmação (robôs de segurança abrem links); POST suprime. Sem login, sem PII na página.
import { readUnsubToken } from "./unsub-token.js";

const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const MAX_BODY = 2048;

function html(title, body, status = 200) {
  const page = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#07140c;color:#eef3ee}main{max-width:32rem;margin:10vh auto;padding:0 16px}h1{font-size:1.4rem}button{min-height:44px;padding:0 20px;border:0;background:#f9d428;color:#002f09;font-weight:700;cursor:pointer}p.en{color:#a9b8ab;font-size:.9rem}</style></head><body><main>${body}</main></body></html>`;
  return new Response(page, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": PAGE_CSP,
      "x-robots-tag": "noindex",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}
const notFound = () =>
  html("Link inválido", "<h1>Link inválido ou expirado.</h1><p class=\"en\">Invalid or expired link.</p>", 404);

// Resolve o destinatário do token: tenant, contato e hash do e-mail (sem decifrar dado pessoal).
async function resolve(env, token) {
  const t = await readUnsubToken(env, token);
  if (!t) return null;
  const row = await env.DB.prepare(
    "SELECT f.tenant_id,c.id contact_id,c.email_hash FROM ficha_versions v JOIN fichas f ON f.id=v.ficha_id JOIN contacts c ON c.id=? AND c.tenant_id=f.tenant_id WHERE v.id=?",
  )
    .bind(t.contactId, t.versionId)
    .first();
  return row && row.email_hash ? row : null;
}

export async function handleUnsubscribe(request, env, token) {
  if (!["GET", "HEAD", "POST"].includes(request.method)) return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
  if (env.UNSUB_LIMITER) {
    const { success } = await env.UNSUB_LIMITER.limit({ key: `u:${String(token).slice(0, 64)}` });
    if (!success) return html("Muitas tentativas", "<h1>Muitas tentativas. Tente de novo em um minuto.</h1><p class=\"en\">Too many attempts. Please try again in a minute.</p>", 429);
  }
  const target = await resolve(env, token);
  if (!target) return notFound();
  if (request.method !== "POST")
    return html(
      "Descadastro",
      `<h1>Não quer mais receber mensagens da EAG Agro?</h1><form method="post"><input type="hidden" name="List-Unsubscribe" value="One-Click"><button type="submit">Confirmar descadastro · Unsubscribe</button></form><p class="en">Don't want to receive messages from EAG Agro? Confirm above.</p>`,
    );
  // POST do botão ou one-click do provedor (RFC 8058: form-urlencoded ou multipart; sem cookie).
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return html("Pedido inválido", "<h1>Pedido inválido.</h1><p class=\"en\">Invalid request.</p>", 413);
  const at = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO suppression_entries(id,tenant_id,identifier_hash,channel,reason,source,created_by) VALUES (?,?,?,'email','opt_out','link','public-unsubscribe') ON CONFLICT(tenant_id,identifier_hash,channel) DO NOTHING",
    ).bind(crypto.randomUUID(), target.tenant_id, target.email_hash),
    env.DB.prepare(
      "INSERT INTO audit_log(id,tenant_id,actor_id,actor_role,action,entity_type,entity_id,new_value_json,request_id) SELECT ?,?,'public-unsubscribe','public','suppression.added','contact',?,?,? WHERE changes()>0",
    ).bind(crypto.randomUUID(), target.tenant_id, target.contact_id, JSON.stringify({ channel: "email", source: "link" }), crypto.randomUUID()),
    // Nada mais sai para este endereço, sem e-mail de despedida (R21.6); tarefas manuais do contato também param.
    env.DB.prepare(
      "UPDATE send_outbox SET status='cancelled',block_reason='unsubscribed',updated_at=? WHERE tenant_id=? AND email_hash=? AND status IN ('pending','blocked','waiting_sequence','temp_failed')",
    ).bind(at, target.tenant_id, target.email_hash),
    env.DB.prepare(
      "UPDATE tasks SET status='cancelled',suspended_reason='descadastro' WHERE tenant_id=? AND status='open' AND contact_id IN (SELECT id FROM contacts WHERE tenant_id=? AND email_hash=?)",
    ).bind(target.tenant_id, target.tenant_id, target.email_hash),
  ]);
  return html("Descadastro feito", "<h1>Pronto. Você não receberá mais mensagens.</h1><p class=\"en\">Done. You will not receive further messages.</p>");
}
