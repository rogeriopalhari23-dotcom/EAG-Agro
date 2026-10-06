// Tarefas manuais, reuniões, retorno sugerido e linha do tempo (P2-T14; R28.5–R28.12, R28.18–R28.19, R15.4–R15.5, R24.4, R17.7).
import { bodyJson, fail, str, oneOf, number, requireRole, page, WRITE_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, company } from "./store.js";
import { restrictionsFor } from "./restrictions.js";
import { LEVEL0_SCRIPT } from "./templates/prospeccao-vendas.js";
import { decryptPii, encryptPii } from "./crypto.js";

const MANUAL = new Set(["call_l0", "call_l1", "call_l2", "linkedin"]);
const ICP_BADNESS = "CASE (SELECT bp.icp_status FROM buyer_profiles bp WHERE bp.tenant_id=t.tenant_id AND bp.company_id=t.company_id ORDER BY bp.unit_key='' DESC LIMIT 1) WHEN 'out_trader' THEN 10 WHEN 'in_icp' THEN 0 WHEN 'pending_size' THEN 1 WHEN 'out_small' THEN 2 WHEN 'out_giant' THEN 3 ELSE 4 END";

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
  // Uma ligação de nível 0 aberta por empresa e commodity: repetir o cadastro não duplica a tarefa.
  const open = await s(env, "SELECT id FROM tasks WHERE tenant_id=? AND company_id=? AND commodity=? AND kind='call_l0' AND status='open'", actor.tenant_id, companyId, commodity).first();
  if (open) fail(409, "task_duplicate", "Já existe ligação de nível 0 aberta para esta empresa e commodity.", { id: open.id });
  // Complemento da unidade (perguntas e pendências próprias) vem depois do roteiro da skill, que não é alterado.
  const unitScript = str(i.unitScript, "roteiro da unidade", 4000, true);
  const script = unitScript ? `${LEVEL0_SCRIPT}\n\n— Desta unidade —\n${unitScript}` : LEVEL0_SCRIPT;
  const id = crypto.randomUUID();
  await commit(env, [
    s(env, "INSERT INTO tasks(id,tenant_id,company_id,commodity,kind,owner_id,due_date,priority,script) VALUES (?,?,?,?,'call_l0',?,?,0,?)", id, actor.tenant_id, companyId, commodity, actor.id, str(i.dueDate || now().slice(0, 10), "data", 10), script),
    auditStatement(env, actor, rid, "task.created", "task", id, { kind: "call_l0", companyId }),
  ]);
  return { id };
}

// Edição de tarefa manual aberta (roteiro, canal, próxima ação, data). Preserva o id e não toca estado, resultado,
// ficha nem aprovações. Tarefa vinda de ficha aprovada tem texto congelado: muda só por nova versão da ficha.
const EDITABLE = { script: ["script", "roteiro", 8000], channelNote: ["channel_note", "canal", 500], nextAction: ["next_action", "próxima ação", 500], dueDate: ["due_date", "data", 10] };
const T11_NOTICE = /^ANTES DE LIGAR:.*$/gm;
export async function updateTask(request, env, actor, rid, id) {
  requireRole(actor, WRITE_ROLES);
  const t = await s(env, "SELECT * FROM tasks WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!t) fail(404, "task_not_found", "Tarefa não encontrada.");
  if (t.status !== "open") fail(409, "task_not_open", "Só tarefa aberta pode ser editada.");
  if (t.ficha_id) fail(409, "task_frozen", "O roteiro desta tarefa vem de ficha aprovada (texto congelado): altere pela ficha, com nova versão e aprovação.");
  if (!MANUAL.has(t.kind)) fail(409, "task_not_editable", "Só tarefas manuais (ligação, LinkedIn) podem ser editadas.");
  const i = await bodyJson(request);
  if (i.expectedRevision !== t.revision) fail(409, "edit_conflict", "Recarregue a tarefa antes de alterar.");
  const reason = str(i.reason, "motivo", 500);
  if (reason.length < 10) fail(422, "reason_required", "Informe o motivo da alteração (10 caracteres ou mais).");
  const encrypted = t.script?.startsWith("enc:");
  const current = { script: encrypted ? await decryptPii(t.script.slice(4), env) : t.script, channel_note: t.channel_note, next_action: t.next_action, due_date: t.due_date };
  const next = {};
  for (const [key, [col, label, max]] of Object.entries(EDITABLE)) {
    if (i[key] === undefined) continue;
    const value = i[key] === null ? null : str(i[key], label, max, true) ?? null;
    if (col === "due_date" && !/^\d{4}-\d{2}-\d{2}$/.test(value || "")) fail(422, "invalid_date", "Data no formato AAAA-MM-DD.");
    if ((value ?? null) !== (current[col] ?? null)) next[col] = value;
  }
  if (!Object.keys(next).length) fail(422, "nothing_to_change", "Nenhum campo foi alterado.");
  // A pendência T11 escrita no roteiro ("ANTES DE LIGAR: …") não pode ser retirada por edição.
  if ("script" in next)
    for (const line of current.script?.match(T11_NOTICE) || [])
      if (!(next.script || "").includes(line)) fail(422, "t11_notice_required", "A pendência T11 do roteiro não pode ser retirada pela edição.");
  const at = now();
  const cols = Object.keys(next);
  const stored = { ...next };
  if ("script" in stored && encrypted && stored.script) stored.script = `enc:${await encryptPii(stored.script, env)}`;
  await commit(env, [
    s(
      env,
      `UPDATE tasks SET ${cols.map((c) => `${c}=?`).join(",")},revision=CASE WHEN revision=? THEN revision+1 ELSE -1 END WHERE tenant_id=? AND id=? AND status='open'`,
      ...cols.map((c) => stored[c]), t.revision, actor.tenant_id, id,
    ),
    ...(await Promise.all(
      cols.map(async (c) =>
        s(
          env,
          "INSERT INTO task_revisions(id,tenant_id,task_id,revision,field,old_value_enc,new_value_enc,reason,changed_by,changed_at,request_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          crypto.randomUUID(), actor.tenant_id, id, t.revision + 1, c, await encryptPii(current[c], env), await encryptPii(next[c], env), reason, actor.id, at, rid,
        ),
      ),
    )),
    auditStatement(env, actor, rid, "task.updated", "task", id, { companyId: t.company_id, fields: cols, revision: t.revision + 1 }),
  ]);
  return { id, revision: t.revision + 1, fields: cols };
}

// Histórico da tarefa (valores decifrados só para quem pode escrever).
export async function taskHistory(env, actor, id) {
  requireRole(actor, WRITE_ROLES);
  const t = await s(env, "SELECT id FROM tasks WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!t) fail(404, "task_not_found", "Tarefa não encontrada.");
  const rows = (await s(env, "SELECT * FROM task_revisions WHERE tenant_id=? AND task_id=? ORDER BY changed_at,rowid", actor.tenant_id, id).all()).results;
  return {
    items: await Promise.all(
      rows.map(async (r) => ({ revision: r.revision, field: r.field, oldValue: await decryptPii(r.old_value_enc, env), newValue: await decryptPii(r.new_value_enc, env), reason: r.reason, changedBy: r.changed_by, changedAt: r.changed_at })),
    ),
  };
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
