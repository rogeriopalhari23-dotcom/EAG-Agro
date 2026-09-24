// Estado dos canais (P2-T17; R26.1–R26.6). Liberação para externos só com evidência do teste interno de T1.
import { bodyJson, fail, str, oneOf, requireRole } from "./http.js";
import { statement as s, commit, auditStatement, now } from "./store.js";

const ADMIN = new Set(["admin"]);
// T2 (WhatsApp) e T3 (LinkedIn automatizado) não comprovados: não podem ser habilitados nesta versão (R26.4, R26.5).
const NOT_ENABLEABLE = new Set(["whatsapp", "linkedin"]);

export async function listChannels(env, actor) {
  return { items: (await s(env, "SELECT * FROM channels WHERE tenant_id=? ORDER BY channel", actor.tenant_id).all()).results };
}

export async function setChannelState(request, env, actor, rid, channel) {
  requireRole(actor, ADMIN);
  oneOf(channel, ["email", "whatsapp", "linkedin"], "canal");
  const i = await bodyJson(request);
  const state = oneOf(i.state, ["planned", "internal_test", "enabled"], "estado");
  if (state !== "planned" && NOT_ENABLEABLE.has(channel)) fail(422, "channel_not_proven", "Canal sem integração comprovada nesta versão.");
  const evidence = state === "enabled" ? str(i.evidenceRef, "evidência do teste de T1", 300) : str(i.evidenceRef, "evidência", 300, true);
  if (state === "enabled" && !/^docs\/eag-compass-t1-validacao\.md#.+/.test(evidence))
    fail(422, "evidence_required", "Liberar exige referência ao registro do teste interno (docs/eag-compass-t1-validacao.md#seção).");
  const prev = await s(env, "SELECT state FROM channels WHERE tenant_id=? AND channel=?", actor.tenant_id, channel).first();
  await commit(env, [
    s(env, "UPDATE channels SET state=?,evidence_ref=?,changed_by=?,changed_at=? WHERE tenant_id=? AND channel=?", state, evidence, actor.id, now(), actor.tenant_id, channel),
    auditStatement(env, actor, rid, "channel.state_changed", "channel", channel, { from: prev?.state ?? null, to: state, evidence }),
  ]);
  return { channel, state };
}
