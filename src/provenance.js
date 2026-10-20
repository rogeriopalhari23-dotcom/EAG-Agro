// Procedência de uma operação (regra geral do Compass; vale para painel, API e scripts, qualquer commodity ou país).
// Separa quatro coisas que não podem ser confundidas:
//   - identidade autenticada: quem o Access autenticou nesta requisição (actor). NÃO prova ação humana: uma automação
//     pode usar a sessão de uma pessoa, e um botão do painel pode ser acionado por automação do navegador;
//   - canal de execução: painel, script ou API — DECLARADO por quem chama (cabeçalho), nunca deduzido;
//   - executor: quem/que executou (pessoa ou automação) — DECLARADO por quem chama; ausente = "não declarado";
//   - autorização: referência, responsável e data da autorização — DECLARADAS; o Compass registra, não valida;
//   - momento: instante em que o Compass executou a operação (servidor).
// Cabeçalhos (valores com encodeURIComponent, para aceitar acentos):
//   x-compass-channel: panel | script | api | automation (motor da prospecção automática, sob a política de pesquisa)
//   x-compass-executor: texto livre (ex.: "Rogério (manual)", "Claude (automação, script r1.mjs)")
//   x-compass-authorization-ref / -by / -at: referência, responsável e data (AAAA-MM-DD ou ISO) da autorização
export const CHANNELS = ["panel", "script", "api", "automation"];
const MAX = { executor: 160, ref: 400, by: 160 };

const header = (request, name, max) => {
  const raw = request.headers.get(name);
  if (!raw) return null;
  let v;
  try { v = decodeURIComponent(raw); } catch { v = raw; }
  v = v.replace(/[\u0000-\u001f]/g, " ").trim();
  return v ? v.slice(0, max) : null;
};
const isoDate = (v) => (v && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);

export function readProvenance(request) {
  const declaredChannel = request.headers.get("x-compass-channel");
  const channel = CHANNELS.includes(declaredChannel) ? declaredChannel : null;
  const reference = header(request, "x-compass-authorization-ref", MAX.ref);
  const grantedBy = header(request, "x-compass-authorization-by", MAX.by);
  const grantedAt = isoDate(header(request, "x-compass-authorization-at", 40));
  return {
    channel,
    executor: header(request, "x-compass-executor", MAX.executor),
    authorization: reference || grantedBy || grantedAt ? { reference, grantedBy, grantedAt } : null,
  };
}

// Registro da operação, guardado junto do que foi feito (cadastro, decisão, anotação) e na auditoria.
export function operationRecord(actor, at) {
  const p = actor.provenance ?? {};
  return {
    authenticatedIdentity: { id: actor.id, email: actor.email ?? null, name: actor.display_name ?? null },
    channel: p.channel ?? "não declarado",
    executor: p.executor ?? null,
    authorization: p.authorization ?? null,
    operatedAt: at,
  };
}

// Texto único para painel, relatório e scripts (nenhum rótulo sugere decisão ou ação humana que não existe).
export function describeOperation(op) {
  if (!op) return "Operação sem procedência registrada (anterior à regra de rastreabilidade).";
  const who = op.authenticatedIdentity ? `${op.authenticatedIdentity.name ?? op.authenticatedIdentity.id}${op.authenticatedIdentity.email ? ` <${op.authenticatedIdentity.email}>` : ""}` : "não registrada";
  const auth = op.authorization
    ? `autorização declarada: ${[op.authorization.reference, op.authorization.grantedBy && `por ${op.authorization.grantedBy}`, op.authorization.grantedAt && `em ${op.authorization.grantedAt}`].filter(Boolean).join(", ")}`
    : "autorização não informada";
  return `Operação em ${op.operatedAt}; identidade autenticada: ${who} (não prova ação humana); canal declarado: ${op.channel}; executor declarado: ${op.executor ?? "não declarado"}; ${auth}.`;
}

// Cabeçalhos para scripts e painel montarem a mesma procedência.
export function provenanceHeaders({ channel, executor, authorization } = {}) {
  const h = {};
  if (channel) h["x-compass-channel"] = channel;
  if (executor) h["x-compass-executor"] = encodeURIComponent(executor);
  if (authorization?.reference) h["x-compass-authorization-ref"] = encodeURIComponent(authorization.reference);
  if (authorization?.grantedBy) h["x-compass-authorization-by"] = encodeURIComponent(authorization.grantedBy);
  if (authorization?.grantedAt) h["x-compass-authorization-at"] = encodeURIComponent(authorization.grantedAt);
  return h;
}
