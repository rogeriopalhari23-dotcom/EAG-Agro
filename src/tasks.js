// Tarefas manuais, reuniões, retorno sugerido e linha do tempo (P2-T14; R28.5–R28.12, R28.18–R28.19, R15.4–R15.5, R24.4, R17.7).
import { bodyJson, fail, str, oneOf, number, requireRole, page, WRITE_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, company } from "./store.js";
import { restrictionsFor } from "./restrictions.js";
import { LEVEL0_SCRIPT } from "./templates/prospeccao-vendas.js";
import { decryptPii } from "./crypto.js";

const MANUAL = new Set(["call_l0", "call_l1", "call_l2", "linkedin"]);
const ICP_BADNESS = "CASE (SELECT bp.icp_status FROM buyer_profiles bp WHERE bp.tenant_id=t.tenant_id AND bp.company_id=t.company_id ORDER BY bp.unit_key='' DESC LIMIT 1) WHEN 'in_icp' THEN 0 WHEN 'pending_size' THEN 1 WHEN 'out_trader' THEN 2 WHEN 'out_giant' THEN 3 ELSE 4 END";

// Tarefas geradas na aprovação de um canal manual (a ficha já tem os roteiros congelados).
export function manualTaskStatements(env, { tenant, ficha, contactId, commodity, owner, start, messages, addDays }) {
  return messages
    .filter((m) => m.kind === "manual_task")
    .map((m) =>
      s(
        env,
        "INSERT INTO tasks(id,tenant_id,company_id,commodity,contact_id,ficha_id,kind,owner_id,due_date,priority,script) VALUES (?,?,?,?,?,?,?,?,?,0,?)",
        crypto.randomUUID(), tenant, ficha.company_id, commodity, contactId, ficha.id, m.channel === "call" ? "call_l1" : "linkedin", owner, addDays(start, m.day_offset), m.body,
      ),
    );
}

// Lista do dia: respostas e confirmações primeiro; ligações começam pelos piores leads (skill, R28.8).
export async function listTasks(request, env, actor) {
  const u = new URL(request.url);
  const { limit, offset } = page(request);
  const until = str(u.searchParams.get("until") || now().slice(0, 10), "data", 10);
  const rows = (
    await s(
      env,
      `SELECT t.*,c.legal_name,${ICP_BADNESS} badness FROM tasks t JOIN companies c ON c.id=t.company_id
       WHERE t.tenant_id=? AND t.status='open' AND t.due_date<=? ORDER BY t.priority DESC, badness DESC, t.due_date, t.created_at LIMIT ? OFFSET ?`,
      actor.tenant_id, until, limit + 1, offset,
    ).all()
  ).results;
  // Canal manual obedece às mesmas restrições do e-mail (errata item 6): a tarefa aparece com o bloqueio.
  const items = [];
  for (const t of rows.slice(0, limit)) {
    let blocked = [];
    if (MANUAL.has(t.kind)) {
      const campaign = t.ficha_id ? (await s(env, "SELECT campaign_id FROM fichas WHERE id=?", t.ficha_id).first())?.campaign_id : null;
      const emailHash = t.contact_id ? (await s(env, "SELECT email_hash FROM contacts WHERE id=?", t.contact_id).first())?.email_hash : null;
      blocked = await restrictionsFor(env, actor.tenant_id, { companyId: t.company_id, campaignId: campaign, commodity: t.commodity, emailHash });
    }
    const script = t.script?.startsWith("enc:") ? await decryptPii(t.script.slice(4), env) : t.script;
    items.push({ ...t, script, blocked });
  }
  return { items, nextOffset: rows.length > limit ? offset + limit : null };
}

// Conclusão sempre por ação humana; 3 perguntas da Level 2 viram dado registrado com método e data (R3.1.5).
export async function completeTask(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const t = await s(env, "SELECT * FROM tasks WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!t) fail(404, "task_not_found", "Tarefa não encontrada.");
  if (t.status !== "open") fail(409, "task_not_open", "Tarefa suspensa, cancelada ou já concluída.");
  const i = await bodyJson(request);
  if (MANUAL.has(t.kind)) {
    const campaign = t.ficha_id ? (await s(env, "SELECT campaign_id FROM fichas WHERE id=?", t.ficha_id).first())?.campaign_id : null;
    const emailHash = t.contact_id ? (await s(env, "SELECT email_hash FROM contacts WHERE id=?", t.contact_id).first())?.email_hash : null;
    const reasons = await restrictionsFor(env, actor.tenant_id, { companyId: t.company_id, campaignId: campaign, commodity: t.commodity, emailHash });
    if (reasons.length) fail(409, "task_blocked", "Contato bloqueado por pausa, supressão ou triagem.", { reasons });
  }
  const outcome = oneOf(i.outcome, ["done", "no_answer", "not_reached", "wrong_contact"], "resultado");
  const answers = {};
  if (i.answers) {
    if (i.answers.buyingChannel !== undefined) answers.buyingChannel = oneOf(i.answers.buyingChannel, ["usina", "trading", "ambos", "não informado"], "compra de usina ou trading");
    if (i.answers.modality !== undefined) answers.modality = oneOf(i.answers.modality, ["spot", "contrato", "ambos", "não informado"], "spot ou contrato");
    if (i.answers.monthlyVolumeT !== undefined) answers.monthlyVolumeT = number(i.answers.monthlyVolumeT, "consumo mensal (t)", 0, 1e9);
  }
  const at = now();
  await commit(env, [
    s(env, "UPDATE tasks SET status='done',result_json=?,done_by=?,done_at=? WHERE id=? AND status='open'",
      JSON.stringify({ outcome, note: str(i.note, "nota", 2000, true), answers, method: t.kind.startsWith("call") ? "ligação" : t.kind, at }), actor.id, at, id),
    auditStatement(env, actor, rid, "task.completed", "task", id, { kind: t.kind, outcome, companyId: t.company_id, answered: Object.keys(answers) }),
  ]);
  return { id, status: "done" };
}

// Level 0: sem e-mail do decisor, a cadência começa pela ligação (skill; R28.6).
export async function createLevel0(request, env, actor, rid, companyId) {
  requireRole(actor, WRITE_ROLES);
  await company(env, actor, companyId);
  const i = await bodyJson(request);
  const commodity = str(i.commodity, "commodity", 40);
  const id = crypto.randomUUID();
  await commit(env, [
    s(env, "INSERT INTO tasks(id,tenant_id,company_id,commodity,kind,owner_id,due_date,priority,script) VALUES (?,?,?,?,'call_l0',?,?,0,?)", id, actor.tenant_id, companyId, commodity, actor.id, str(i.dueDate || now().slice(0, 10), "data", 10), LEVEL0_SCRIPT),
    auditStatement(env, actor, rid, "task.created", "task", id, { kind: "call_l0", companyId }),
  ]);
  return { id };
}

// Reunião: 10–120 min (sugestão da skill 20–30); confirmação na manhã do dia (R28.10).
export async function recordMeeting(request, env, actor, rid) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request);
  const companyId = str(i.companyId, "empresa", 80);
  await company(env, actor, companyId);
  const when = str(i.scheduledFor, "data e hora", 40);
  if (!Number.isFinite(Date.parse(when))) fail(422, "invalid_date", "Data e hora inválidas.");
  const id = crypto.randomUUID();
  await commit(env, [
    s(env, "INSERT INTO meetings(id,tenant_id,company_id,contact_id,owner_id,scheduled_for,duration_min,channel,invite_sent,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
      id, actor.tenant_id, companyId, str(i.contactId, "contato", 80, true), actor.id, new Date(when).toISOString(), number(i.durationMin ?? 30, "duração", 10, 120),
      oneOf(i.channel ?? "video", ["video", "phone", "in_person"], "canal"), i.inviteSent === true ? 1 : 0, actor.id),
    s(env, "INSERT INTO tasks(id,tenant_id,company_id,contact_id,kind,owner_id,due_date,priority,script) VALUES (?,?,?,?,'meeting_confirm',?,?,5,?)",
      crypto.randomUUID(), actor.tenant_id, companyId, str(i.contactId, "contato", 80, true), actor.id, new Date(when).toISOString().slice(0, 10),
      "Confirmar a reunião pela manhã (mensagem ou ligação)."),
    auditStatement(env, actor, rid, "meeting.recorded", "meeting", id, { companyId }),
  ]);
  return { id };
}

// Linha do tempo sem dado pessoal (R24.4): auditoria, envios, respostas, tarefas e reuniões.
export async function timeline(env, actor, companyId) {
  await company(env, actor, companyId);
  const t = actor.tenant_id;
  const rows = (
    await s(
      env,
      `SELECT at,kind,detail FROM (
         SELECT occurred_at at,'audit' kind,action detail FROM audit_log WHERE tenant_id=? AND (entity_id=? OR new_value_json LIKE ?)
         UNION ALL SELECT l.at,'send',l.event||' · passo '||o.step_no FROM send_log l JOIN send_outbox o ON o.id=l.outbox_id WHERE o.tenant_id=? AND o.company_id=?
         UNION ALL SELECT received_at,'reply',classification||' · '||correlation FROM inbound_messages WHERE tenant_id=? AND company_id=?
         UNION ALL SELECT COALESCE(done_at,created_at),'task',kind||' · '||status FROM tasks WHERE tenant_id=? AND company_id=?
         UNION ALL SELECT created_at,'meeting','reunião em '||scheduled_for FROM meetings WHERE tenant_id=? AND company_id=?
       ) ORDER BY at DESC LIMIT 200`,
      t, companyId, `%${companyId}%`, t, companyId, t, companyId, t, companyId, t, companyId,
    ).all()
  ).results;
  return { items: rows };
}

// Funil da skill: prospectadas (ficha aprovada) → reuniões → negócios (R28.12).
export async function funnel(env, actor) {
  const t = actor.tenant_id;
  const [a, b, c] = await env.DB.batch([
    s(env, "SELECT COUNT(DISTINCT company_id) n FROM fichas WHERE tenant_id=? AND status='approved'", t),
    s(env, "SELECT COUNT(DISTINCT company_id) n FROM meetings WHERE tenant_id=?", t),
    s(env, "SELECT COUNT(*) n FROM companies WHERE tenant_id=? AND pipeline_status='confirmed_opportunity'", t),
  ]);
  return { prospected: a.results[0].n, meetings: b.results[0].n, deals: c.results[0].n };
}
