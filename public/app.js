const $ = (id) => document.getElementById(id);
const state = {
  actor: null,
  products: [],
  view: "Hoje",
  offset: 0,
  search: "",
  generation: 0,
  listOffsets: {},
};
const statusLabels = {
  discovered: "Descoberta",
  prospected: "Com evidência",
  in_contact: "Em contato",
  qualifying: "Em qualificação",
  qualified: "Qualificada",
  confirmed_opportunity: "Oportunidade confirmada",
  blocked: "Bloqueada",
  inactive: "Inativa",
  draft: "Rascunho",
  active: "Ativa",
  waiting: "Em espera",
  paused: "Pausada",
  ended: "Encerrada",
};
const gateLabels = {
  business_evidence: "Prova de compra vinculada ao produto e mercado",
  confidence: "Confiança mínima",
  potential: "Potencial mínimo",
  completeness: "Completude mínima",
  sanctions: "Triagem de sanções atual e sem bloqueio",
  risk_coverage: "Cobertura de risco",
  buyer_profile: "Perfil comprador confirmado",
  final_buyer: "Comprador final exigido nesta demanda",
  decision_maker: "Identidade e autoridade do decisor verificadas",
  minimum_volume: "Volume mínimo ou exceção vigente",
  risk_mitigation: "Mitigação de risco",
};
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (v !== undefined && v !== null) n.setAttribute(k, v);
  }
  for (const c of children.flat())
    if (c !== null && c !== undefined)
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
const text = (tag, value, cls) => el(tag, { class: cls }, value);
const button = (label, action, primary = false) =>
  el(
    "button",
    {
      type: "button",
      class: primary ? "primary" : "",
      onclick: async (event) => {
        const b = event.currentTarget;
        b.disabled = true;
        try {
          await safe(action);
        } finally {
          b.disabled = false;
        }
      },
    },
    label,
  );
async function safe(action) {
  try {
    await action();
  } catch (e) {
    notice(e.message, true);
  }
}
function notice(message, error = false) {
  $("notice").replaceChildren(
    text("div", message, error ? "error" : "success"),
  );
}
function input(label, name, type = "text", value = "", required = true) {
  const control = el(type === "textarea" ? "textarea" : "input", {
    name,
    type: type === "textarea" ? undefined : type,
    required: required ? "" : undefined,
    maxlength: 2000,
  });
  control.value = value ?? "";
  return { node: el("label", {}, label, control), control };
}
function select(label, name, options, value) {
  const control = el("select", { name, "aria-label": label });
  for (const item of options) {
    const [v, l] = Array.isArray(item) ? item : [item, item];
    control.append(el("option", { value: v }, l));
  }
  if (value !== undefined) control.value = value;
  return { node: el("label", {}, label, control), control };
}
function makeForm(fields, onSubmit, label = "Salvar") {
  const form = el("form");
  let grid = null;
  for (const f of fields) {
    if (f.group) {
      grid = null;
      const body = [f.hint ? text("p", f.hint, "form-hint") : null, el("div", { class: "form-grid" }, ...f.fields.map((x) => x.node))];
      form.append(f.collapsed ? el("details", { class: "group" }, el("summary", {}, f.group), ...body) : el("fieldset", { class: "group" }, el("legend", {}, f.group), ...body));
    } else {
      if (!grid) form.append((grid = el("div", { class: "form-grid" })));
      grid.append(f.node);
    }
  }
  const error = el("p", { class: "error", hidden: "" }),
    submit = el("button", { type: "submit", class: "primary" }, label);
  form.append(error, el("div", { class: "toolbar" }, submit));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    error.hidden = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
      error.scrollIntoView({ block: "nearest" });
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}
const details = (title, content) =>
  el("details", {}, el("summary", {}, title), content);
// ===== Blocos novos do redesign (inseridos em public/app.js) =====

// Cabeçalho de página: título e uma frase de apoio. O rótulo superior mostra a etapa da jornada (só organização visual).
function section(title, subtitle) {
  return el("div", {}, el("div", { class: "page-head" }, text("h1", title), subtitle ? text("p", subtitle, "muted") : null));
}

// Ícones de traço simples (rótulo sempre visível ao lado; nunca o ícone sozinho como informação).
const ICONS = {
  home: "M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  radar: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 12l6-6",
  globe: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  building: "M4 21V5l8-2v18M12 8l8 2v11M3 21h18M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2",
  file: "M14 3H6v18h12V7l-4-4zM14 3v4h4M9 12h6M9 16h6",
  check: "M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10",
  send: "M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z",
  target: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3zM9 12l2 2 4-4",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  play: "M7 4.5v15l12-7.5z",
};
function icon(name, cls = "icon") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", cls);
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", ICONS[name] || ICONS.arrow);
  svg.append(p);
  return svg;
}

// Navegação agrupada. As chaves continuam sendo os nomes das telas (navigate() e atalhos internos não mudam).
const NAV_GROUPS = [
  [null, [["Início", "home"]]],
  ["Descoberta", [["Prospecção", "play"], ["Rodadas", "layers"], ["Radar Nacional", "radar"], ["Radar Internacional", "globe"]]],
  ["Organização", [["Empresas", "building"]]],
  ["Abordagem", [["Fichas", "file"], ["Tarefas", "check"], ["Envios", "send"], ["Campanhas", "target"]]],
  ["Administração", [["Configurações", "gear"], ["Compliance e auditoria", "shield"]]],
];
const NAV_LABEL = { Início: "Visão geral", Envios: "Envios e respostas" };
const navLabel = (v) => NAV_LABEL[v] || v;
const NAV_KEYS = NAV_GROUPS.flatMap(([, items]) => items.map(([k]) => k));
const MAIN_NAV = NAV_KEYS;
// Telas de apoio ficam sob o item "pai" (abas ou Configurações). Nomes antigos (Hoje, Radar, Internacional) são apelidos.
const PARENT = {
  Hoje: "Início",
  Radar: "Radar Nacional",
  Internacional: "Radar Internacional",
  "Lista mensal": "Radar Internacional",
  Abordagem: "Fichas",
  Catálogo: "Configurações",
  Parâmetros: "Configurações",
  Supressão: "Configurações",
  Pausas: "Configurações",
  "Setores e CNAE": "Configurações",
  "Prospecção automática": "Configurações",
};
const GROUP_OF = Object.fromEntries(NAV_GROUPS.flatMap(([g, items]) => items.map(([k]) => [k, g])));

// Jornada em 6 etapas: organização da interface. Não é estado comercial, não promove empresa nem libera ação.
const JOURNEY = [
  { label: "Descobrir", hint: "Rodadas e radares", go: () => navigate("Rodadas") },
  { label: "Organizar", hint: "Cadastros em descoberta, duplicidades e conciliação", go: () => goCompanies({ status: "discovered" }) },
  { label: "Qualificar e priorizar", hint: "Evidências, perfil (ICP), porte e triagem", go: () => goCompanies({ profile: "in_icp" }) },
  { label: "Identificar e preparar", hint: "Responsáveis, canal e fichas", go: () => navigate("Fichas") },
  { label: "Abordar", hint: "Envios e campanhas, só com aprovação individual", go: () => navigate("Envios") },
  { label: "Acompanhar", hint: "Respostas, retornos e tarefas", go: () => navigate("Tarefas") },
];
const STEP_OF = { Início: -1, Hoje: -1, Prospecção: 0, Rodadas: 0, "Radar Nacional": 0, Radar: 0, "Radar Internacional": 0, Internacional: 0, "Lista mensal": 0, Fichas: 3, Abordagem: 3, Envios: 4, Campanhas: 4, Tarefas: 5 };
function stepOfView(view) {
  if (view === "Empresas") return state.companyFilters?.profile === "in_icp" ? 2 : 1;
  return STEP_OF[view] ?? null;
}
// Etapa de uma empresa aberta: só leitura do estágio já existente.
const COMPANY_STEP = { discovered: 1, prospected: 2, qualifying: 2, qualified: 2, in_contact: 4, confirmed_opportunity: 5, blocked: 2, inactive: 1 };
function goCompanies(filters) {
  state.search = "";
  state.companyFilters = filters;
  state.offset = 0;
  return navigate("Empresas");
}
function renderJourney(step) {
  const bar = $("journey");
  if (!bar) return;
  state.step = step;
  if (step === null || step === undefined) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const ctx = [];
  if (state.ctxRound) ctx.push(el("button", { type: "button", class: "ctx-chip", onclick: () => safe(() => showRound(state.ctxRound.id)) }, icon("layers", "icon sm"), el("span", {}, text("small", "Rodada"), text("strong", state.ctxRound.name))));
  if (state.ctxCompany) ctx.push(el("button", { type: "button", class: "ctx-chip", onclick: () => safe(() => showCompany(state.ctxCompany.id)) }, icon("building", "icon sm"), el("span", {}, text("small", "Empresa"), text("strong", state.ctxCompany.name))));
  bar.replaceChildren(
    el(
      "ol",
      { class: "journey-steps", "aria-label": "Jornada de prospecção (organização da interface; não altera o estado das empresas)" },
      ...JOURNEY.map((s, i) =>
        el(
          "li",
          { class: i === step ? "current" : i < step ? "before" : "" },
          el("button", { type: "button", "aria-current": i === step ? "step" : "false", title: s.hint, onclick: () => safe(s.go) }, text("span", String(i + 1).padStart(2, "0"), "n"), el("span", { class: "l" }, text("strong", s.label), text("small", s.hint))),
        ),
      ),
    ),
    ...(ctx.length ? [el("div", { class: "journey-ctx", "aria-label": "Voltar ao contexto" }, text("span", "Continuar em", "k"), ...ctx)] : []),
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
const fmtDay = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso ?? "—") : d.toLocaleDateString("pt-BR");
};
function setCrumb(...parts) {
  const nodes = [];
  parts.forEach((p, i) => {
    if (i) nodes.push(el("span", { class: "sep", "aria-hidden": "true" }, "/"));
    nodes.push(i < parts.length - 1 && views[p] ? el("button", { type: "button", onclick: () => navigate(p) }, navLabel(p)) : text("span", navLabel(p)));
  });
  $("breadcrumb").replaceChildren(...nodes);
}
function markNav(view) {
  const key = NAV_KEYS.includes(view) ? view : PARENT[view] || view;
  for (const b of $("navigation").querySelectorAll("button")) b.setAttribute("aria-current", b.dataset.view === key ? "page" : "false");
  const group = GROUP_OF[key];
  const trail = ["Hoje", "Radar", "Internacional", "Abordagem"].includes(view) || key === view ? [key] : [key, view];
  $("breadcrumb").replaceChildren();
  setCrumb(...trail);
  if (group) $("breadcrumb").prepend(text("span", group, "group"), el("span", { class: "sep", "aria-hidden": "true" }, "/"));
  renderJourney(stepOfView(view));
  closeMenu();
}
function closeMenu() {
  $("app").classList.remove("nav-open");
  $("menu").setAttribute("aria-expanded", "false");
}
// Troca de tela direta (detalhes de empresa, busca, ficha): mantém o item de navegação e o caminho.
function showScreen(node, ...crumb) {
  $("content").replaceChildren(node);
  if (crumb.length) setCrumb(...crumb);
  if (node.dataset?.step !== undefined) renderJourney(Number(node.dataset.step));
  $("content").focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

// Visão geral: em que estou trabalhando, o que posso fazer agora, o que está bloqueado e por quê, qual a próxima ação.
// Só dados reais; cada número diz o que conta e leva aos registros. Zero é zero.
const PIPELINE_ORDER = ["discovered", "prospected", "qualifying", "qualified", "in_contact", "confirmed_opportunity", "blocked", "inactive"];
const DAY_MS = 86400000;
async function home() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const opt = (p) => api(p).catch(() => null);
  const [d, fichas, tasks, today, rounds, sanctions, t11, params] = await Promise.all([
    api("/api/dashboard"),
    api("/api/fichas?limit=100"),
    api(`/api/tasks?until=${todayIso}&limit=100`),
    api("/api/sending/today"),
    opt("/api/rounds"),
    opt("/api/sanctions/sources"),
    opt("/api/compliance/t11"),
    opt("/api/parameters"),
  ]);
  const p = d.prospectPipeline || d.pipeline;
  const node = section("Visão geral", "Em que você está trabalhando, o que dá para fazer agora, o que está bloqueado e por quê.");
  node.dataset.step = "-1";

  // 1. Em andamento: a rodada mais recente não encerrada, com continuidade, e o estado do canal ao lado.
  const roundList = rounds?.items ?? [];
  const current = roundList.find((r) => r.status !== "closed");
  const where = (o) => (o?.municipality ? `${o.municipality}/${o.region ?? ""}` : o ? o.label ?? (typeof o.lat === "number" ? "coordenada registrada" : "sem localização") : "—");
  const roundCard = current
    ? el(
        "div",
        { class: "hero-main" },
        text("span", "Rodada em andamento", "eyebrow-tag"),
        text("h2", current.name),
        text("p", `${current.commodity ?? "—"}${current.variety ? ` ${current.variety}` : ""} · origem ${where(current.origin)} · raio ${current.radius?.value} ${current.radius?.unit}`, "hero-sub"),
        current.lastRun
          ? el(
              "div",
              { class: "hero-stats" },
              ...[
                [current.lastRun.total, "estabelecimentos na última execução"],
                [current.lastRun.review, "para conferir"],
                [current.lastRun.exceptions, "exceções"],
                [current.lastRun.lookups?.deferred ?? current.lastRun.deferred ?? 0, "consultas adiadas"],
              ].map(([n, l]) => el("div", {}, text("strong", n, "num"), text("span", l))),
            )
          : text("p", "Configurada, ainda não executada. Antes de executar: conferir a área e registrar ciência das limitações.", "hero-sub"),
        el(
          "div",
          { class: "toolbar" },
          button("Continuar rodada", () => showRound(current.id), true),
          button("Nova rodada", () => ((state.openWizard = true), navigate("Rodadas"))),
          roundList.length > 1 ? button(`Todas as rodadas (${roundList.length})`, () => navigate("Rodadas")) : null,
        ),
      )
    : el(
        "div",
        { class: "hero-main" },
        text("span", "Nenhuma rodada em andamento", "eyebrow-tag"),
        text("h2", "Comece por uma rodada de descoberta"),
        text("p", "Commodity, origem, raio, fontes e limites. Criar e executar não faz contato nem libera envio.", "hero-sub"),
        el("div", { class: "toolbar" }, button("Criar rodada", () => ((state.openWizard = true), navigate("Rodadas")), true), roundList.length ? button(`Rodadas (${roundList.length})`, () => navigate("Rodadas")) : null),
      );
  const ch = {
    planned: ["Planejado", "nenhuma mensagem sai, mesmo com ficha aprovada"],
    internal_test: ["Teste interno", "só endereços da lista interna recebem"],
    enabled: ["Liberado", `sai só o aprovado individualmente (${today.sentToday} de ${today.dailyCap ?? "—"} hoje)`],
  }[today.channel] || [lbl(today.channel), ""];
  const rd = today.reader;
  const readerAge = rd?.lastReadOkAt ? Math.round((Date.now() - Date.parse(rd.lastReadOkAt)) / 60000) : null;
  const status = (k, v, why, kind) => el("div", { class: `status-line ${kind || ""}`.trim() }, text("span", k, "k"), el("div", {}, text("strong", v), why ? text("small", why) : null));
  const channelCard = el(
    "div",
    { class: "hero-side", "aria-label": "Canal e ponte" },
    text("span", "Canal e ponte", "eyebrow-tag"),
    status("E-mail", ch[0], ch[1], today.channel === "enabled" ? "ok" : "neutral"),
    today.stopped ? status("Parada automática", "Ativa", `${today.stopped.reason}; só a retomada registrada libera`, "bad") : status("Parada automática", "Não acionada", "para sozinha se a leitura das respostas falhar", "neutral"),
    status(
      "Leitura da ponte",
      rd?.lastReadOkAt ? `${rd.healthy ? "Em dia" : "Atrasada"} · ${fmtDate(rd.lastReadOkAt)}` : "Sem leitura registrada",
      rd?.lastReadOkAt ? `há ${readerAge} min; prazo ${rd.maxAgeMinutes} min${rd.source ? ` · ${rd.source === "bridge" ? "ponte" : rd.source}` : ""}` : "sem leitura recente o envio não é liberado",
      rd?.healthy ? "ok" : "warn",
    ),
    today.internalCopy ? status("Cópia interna", today.internalCopy.enabled ? "Ligada" : "Desligada", today.internalCopy.enabled ? "mensagem separada a cada e-mail aceito" : "nenhuma cópia é enviada", "neutral") : null,
    button("Ver envios e respostas", () => navigate("Envios")),
  );
  node.append(el("section", { class: "hero", "aria-label": "Em andamento" }, roundCard, channelCard));

  // 2. Agora: disponível, aguardando, bloqueado, concluído. Cada item tem contagem, significado e caminho.
  const inApproval = fichas.items.filter((f) => f.status === "in_approval");
  const openTasks = tasks.items.filter((t) => t.status === "open" && !t.blocked?.length);
  const blockedTasks = tasks.items.filter((t) => t.blocked?.length);
  const byReason = {};
  for (const t of blockedTasks) for (const b of t.blocked) (byReason[b] ||= []).push(t);
  const stuck = today.queue.filter((o) => ["blocked", "indeterminate", "perm_failed"].includes(o.status));
  const scheduled = today.queue.filter((o) => !stuck.includes(o));
  const lanes = { available: [], waiting: [], blocked: [], done: [] };
  const add = (lane, n, title, why, label, go, level) => n > 0 && lanes[lane].push({ n, title, why, label, go, level });
  add("available", inApproval.length, "Fichas para revisar", "Revisar não envia: cada destinatário é aprovado à parte e o canal decide se algo sai.", "Revisar fichas", () => navigate("Fichas"));
  add("available", openTasks.length, "Tarefas liberadas até hoje", "Respostas, confirmações e ligações sem bloqueio.", "Ver tarefas", () => navigate("Tarefas"));
  add("available", p.discovered || 0, "Cadastros em descoberta", "Organizar: conferir unidade, duplicidade e conciliação. Não é qualificação.", "Organizar", () => goCompanies({ status: "discovered" }));
  for (const r of roundList.filter((x) => x.status !== "closed")) {
    if (!r.lastRun) add("available", 1, `Rodada a executar: ${r.name}`, "Conferir área e limitações, registrar ciência e executar.", "Abrir rodada", () => showRound(r.id));
    else add("available", r.lastRun.review, `Para conferir em ${r.name}`, "Exceções e itens perto do limite; conferir não aceita nem cadastra nada.", "Abrir rodada", () => showRound(r.id));
  }
  add("waiting", scheduled.length, "Envios na fila", "Saem um por vez, na janela do destinatário, se o canal permitir.", "Ver fila", () => navigate("Envios"));
  for (const r of roundList) if (r.lastRun?.lookups?.deferred) add("waiting", r.lastRun.lookups.deferred, `Consultas adiadas em ${r.name}`, "Limite de requisições da fonte; executar de novo retoma sem duplicar.", "Abrir rodada", () => showRound(r.id));
  add("waiting", p.qualifying || 0, "Empresas em qualificação", "Faltam evidências, demanda ou validações.", "Ver empresas", () => goCompanies({ status: "qualifying" }));
  for (const [reason, list] of Object.entries(byReason))
    add("blocked", list.length, `${list.length === 1 ? "Tarefa bloqueada" : "Tarefas bloqueadas"}: ${BLOCK_LABEL[reason] || reason}`, reason === "t11_pending" ? "Não são contatos prontos para hoje: ficam visíveis, sem conclusão, até a validação T11 deste escopo." : "Tarefa bloqueada não é concluída; o motivo fica no próprio item.", "Ver motivos", () => navigate("Tarefas"), reason === "t11_pending" ? "neutral" : "warn");
  add("blocked", stuck.length, "Envios bloqueados ou indeterminados", "Só voltam à fila com decisão registrada.", "Resolver", () => navigate("Envios"), "warn");
  if (today.stopped) add("blocked", 1, "Envio parado automaticamente", today.stopped.reason, "Ver envios", () => navigate("Envios"), "bad");
  if (t11?.current?.decision && t11.current.decision !== "approved")
    add("blocked", 1, `Compliance T11 (${t11.scope}): ${t11.current.decision === "pending" ? "pendente" : lbl(t11.current.decision)}`, `Evidências exigidas: ${(t11.requiredEvidence ?? []).length}. Enquanto pendente, contatos deste escopo não são liberados.`, "Ver compliance", () => navigate("Compliance e auditoria"), "neutral");
  if (today.channel === "planned") add("blocked", 1, "Canal de e-mail planejado", "Bloqueio esperado nesta fase: nenhum envio comercial sai.", "Ver canal", () => navigate("Envios"), "neutral");
  const rr = d.retentionReview;
  if (rr?.remind) add("available", 1, rr.overdue ? `Revisão anual da retenção atrasada (venceu em ${rr.due})` : `Revisão anual da retenção vence em ${rr.due}`, "Registre a revisão da lista de supressão e dos avisos. Nada expira nem é liberado sozinho.", "Ver supressões", () => navigate("Supressão"), rr.overdue ? "warn" : "");
  add("done", p.qualified || 0, "Empresas qualificadas", "Estágio já registrado; não autoriza contato sozinho.", "Ver", () => goCompanies({ status: "qualified" }));
  add("done", p.confirmed_opportunity || 0, "Oportunidades confirmadas", "Registradas pelo fluxo de qualificação.", "Ver", () => goCompanies({ status: "confirmed_opportunity" }));
  add("done", roundList.filter((r) => r.lastRun).length, "Rodadas executadas", "Com resultados, fechamento e exportação na própria rodada.", "Ver rodadas", () => navigate("Rodadas"));
  add("done", roundList.filter((r) => r.status === "closed").length, "Rodadas encerradas", "Consulta e anotações complementares continuam disponíveis.", "Ver rodadas", () => navigate("Rodadas"));
  const LANES = [
    ["available", "Disponível agora", "Dá para fazer sem esperar ninguém."],
    ["waiting", "Aguardando", "Depende de fila, fonte ou pesquisa em curso."],
    ["blocked", "Bloqueado", "Não avança até o motivo ser resolvido; o servidor confere."],
    ["done", "Concluído", "Já registrado."],
  ];
  node.append(
    el(
      "section",
      { class: "board", "aria-label": "Agora" },
      ...LANES.map(([k, title, why]) =>
        el(
          "div",
          { class: `lane lane-${k}` },
          el("div", { class: "lane-head" }, text("h2", title), text("span", String(lanes[k].length), "lane-n"), text("small", why)),
          lanes[k].length
            ? el(
                "ul",
                { class: "lane-list" },
                ...lanes[k].map((x) =>
                  el(
                    "li",
                    { class: `lane-item ${x.level || ""}`.trim() },
                    text("span", x.n, "action-count num"),
                    el("div", {}, text("strong", x.title), text("small", x.why)),
                    el("button", { type: "button", class: "link-btn", onclick: () => safe(x.go) }, x.label, icon("arrow", "icon sm")),
                  ),
                ),
              )
            : text("p", k === "available" ? "Nada disponível agora." : k === "blocked" ? "Nenhum bloqueio registrado." : "Nada aqui.", "lane-empty"),
        ),
      ),
    ),
  );

  // 3. Empresas por estágio já existente (sem testes internos), e prazos de validade.
  const total = Object.values(p).reduce((a, b) => a + b, 0);
  const stages = PIPELINE_ORDER.filter((k) => p[k]).concat(Object.keys(p).filter((k) => !PIPELINE_ORDER.includes(k)));
  const maxN = Math.max(1, ...stages.map((k) => p[k]));
  const tests = d.internalTests?.total ?? 0;
  const funnel = el(
    "section",
    { class: "panel funnel-panel" },
    el("div", { class: "panel-head" }, text("h2", "Empresas por estágio"), text("span", `${total} prospect(s)`, "muted")),
    stages.length
      ? el(
          "ul",
          { class: "stage-bars" },
          ...stages.map((k) =>
            el(
              "li",
              {},
              el(
                "button",
                { type: "button", onclick: () => safe(() => goCompanies({ status: k })), "aria-label": `${statusLabels[k] || lbl(k)}: ${p[k]} empresa(s). Abrir lista.` },
                text("span", statusLabels[k] || lbl(k), "stage-l"),
                el("span", { class: "stage-track" }, el("span", { class: `stage-fill s-${k}`, style: `width:${Math.max(4, Math.round((p[k] / maxN) * 100))}%` })),
                text("span", p[k], "stage-n num"),
              ),
            ),
          ),
        )
      : text("p", "Nenhuma empresa cadastrada.", "empty"),
    tests
      ? el("p", { class: "tests-note" }, tag("Teste interno"), ` ${tests} registro(s) de teste interno (${d.internalTests.rule}) fora destas contagens. `, el("button", { type: "button", class: "link-btn", onclick: () => safe(() => ((state.search = "TESTE"), (state.companyFilters = {}), (state.offset = 0), navigate("Empresas"))) }, "Ver testes"))
      : null,
  );
  const due = [];
  const maxH = params?.parameters?.["sanctions_max_age_hours:global"];
  for (const s of sanctions?.items ?? []) {
    if (!s.active) continue;
    if (!s.last_import) {
      due.push([s.name, "Sem importação registrada", "a triagem que depende desta lista fica incompleta", "warn"]);
      continue;
    }
    const until = maxH ? Date.parse(s.last_import) + maxH * 3600000 : null;
    const left = until ? Math.floor((until - Date.now()) / DAY_MS) : null;
    due.push([s.name, until ? (left < 0 ? `Vencida em ${fmtDay(until)}` : `Válida até ${fmtDay(until)}`) : `Importada em ${fmtDay(s.last_import)}`, until ? (left < 0 ? "triagens novas ficam bloqueadas até reimportar" : `faltam ${left} dia(s) · importada em ${fmtDay(s.last_import)}`) : "prazo não parametrizado", left !== null && left < 7 ? (left < 0 ? "bad" : "warn") : ""]);
  }
  const ev = params?.parameters?.["email_validation_max_age_days:email"];
  if (ev) due.push(["Validação de e-mail", `Vale ${ev} dia(s)`, "depois disso o e-mail precisa ser validado de novo antes da ficha", ""]);
  if (rr?.due) due.push(["Retenção A1", `Revisão anual até ${fmtDay(rr.due + "T12:00:00")}`, rr.lastReview ? `última em ${rr.lastReview.reviewed_on}` : "nenhuma revisão registrada ainda", rr.overdue ? "bad" : rr.remind ? "warn" : ""]);
  const duePanel = el(
    "section",
    { class: "panel due-panel" },
    el("div", { class: "panel-head" }, text("h2", "Prazos e validade")),
    due.length ? el("ul", { class: "due-list" }, ...due.map(([k, v, why, lvl]) => el("li", { class: lvl }, text("span", k, "k"), el("div", {}, text("strong", v), text("small", why))))) : text("p", "Prazos indisponíveis para este perfil.", "empty"),
    rr?.due ? text("p", `Retenção A1: próxima revisão anual até ${rr.due}${rr.lastReview ? ` (última em ${rr.lastReview.reviewed_on})` : ""}.`, "muted retention-line") : null,
  );
  node.append(el("div", { class: "split" }, funnel, duePanel));

  // 4. Atalhos de descoberta.
  node.append(
    el(
      "nav",
      { class: "shortcuts", "aria-label": "Atalhos" },
      ...[
        ["radar", "Radar nacional", "Compradores perto da cidade do fornecedor", "Radar Nacional"],
        ["globe", "Radar internacional", "Países importadores e empresas compradoras", "Radar Internacional"],
        ["layers", "Rodadas", "Descoberta configurável por commodity e raio", "Rodadas"],
        ["building", "Empresas", "Lista, filtros, exportação e cadastro", "Empresas"],
      ].map(([ic, t, why, v]) => el("button", { type: "button", class: "shortcut", onclick: () => navigate(v) }, icon(ic), el("span", {}, text("strong", t), text("small", why)))),
    ),
  );
  return node;
}

// Compliance e auditoria: somente leitura. Nenhuma validação, liberação ou alteração sai daqui.
async function complianceView() {
  const opt = (p) => api(p).catch((e) => ({ error: e.message }));
  const offset = state.auditOffset || 0;
  const [t11, channels, sanctions, audit] = await Promise.all([opt("/api/compliance/t11"), opt("/api/channels"), opt("/api/sanctions/sources"), opt(`/api/audit?limit=30&offset=${offset}`)]);
  const node = section("Compliance e auditoria", "Consulta do estado de compliance, canais, listas de sanções e trilha de auditoria. Esta tela não registra validações nem libera canais.");
  const err = (x) => (x?.error ? text("p", x.error, "error") : null);
  const DECISION = { pending: ["Pendente", "warn"], approved: ["Aprovada", "ok"], rejected: ["Recusada", "bad"] };
  const EVIDENCE = { decisions: "decisões registradas", legal_basis: "base legal", transfer_mechanism: "mecanismo de transferência", incident_register: "registro de incidentes", erasure_test: "teste de eliminação" };
  node.append(
    panel(
      "T11 — validação por escopo",
      err(t11) ||
        el(
          "div",
          { class: "rows" },
          el("div", { class: "row" }, el("div", {}, text("strong", `Escopo ${t11.scope}`), text("small", `Evidências exigidas: ${(t11.requiredEvidence ?? []).map((k) => EVIDENCE[k] || k).join(", ") || "—"}`), text("small", t11.history?.length ? `${t11.history.length} registro(s) no histórico` : "Nenhum registro no histórico.")), tag(...(DECISION[t11.current?.decision] || [lbl(t11.current?.decision), ""]))),
        ),
    ),
    panel(
      "Canais",
      err(channels) ||
        rows(channels.items ?? [], (c) => el("div", { class: "row" }, el("div", {}, text("strong", CHANNEL_NAME[c.channel] || c.channel), text("small", `Desde ${fmtDate(c.changed_at)}${c.evidence_ref ? ` · evidência ${c.evidence_ref}` : ""}`)), tag({ planned: "Planejado", internal_test: "Teste interno", enabled: "Liberado" }[c.state] || c.state, c.state === "enabled" ? "ok" : ""))),
    ),
    panel(
      "Listas de sanções",
      err(sanctions) || rows(sanctions.items ?? [], (s) => el("div", { class: "row" }, el("div", {}, text("strong", s.name), text("small", `${s.jurisdiction} · ${s.blocking_policy} · última importação ${s.last_import ? fmtDate(s.last_import) : "nenhuma"}`)), tag(s.active ? "Ativa" : "Inativa", s.active ? "ok" : ""))),
    ),
  );
  const ap = panel("Auditoria", text("small", "Eventos mais recentes primeiro. Valores alterados ficam no registro do banco; aqui aparecem ação, entidade, perfil e requisição.", "muted"));
  if (audit?.error) ap.append(err(audit));
  else {
    const ev = audit.events ?? audit.items ?? [];
    ap.append(
      ev.length
        ? el(
            "div",
            { class: "table-wrap" },
            el(
              "table",
              { class: "trade audit" },
              el("thead", {}, el("tr", {}, ...["Quando", "Ação", "Entidade", "Perfil", "Requisição"].map((h) => el("th", { scope: "col" }, h)))),
              el("tbody", {}, ...ev.map((e) => el("tr", {}, text("td", fmtDate(e.occurred_at)), el("td", {}, text("code", e.action)), text("td", `${e.entity_type}${e.field_name ? ` · ${e.field_name}` : ""}`), text("td", `${e.actor_id} (${e.actor_role})`), el("td", {}, text("code", (e.request_id || "—").slice(0, 8)))))),
            ),
          )
        : text("p", "Nenhum evento nesta página.", "empty"),
      el(
        "div",
        { class: "toolbar" },
        offset ? button("Mais recentes", () => ((state.auditOffset = Math.max(0, offset - 30)), navigate("Compliance e auditoria"))) : null,
        ev.length === 30 ? button("Mais antigos", () => ((state.auditOffset = offset + 30), navigate("Compliance e auditoria"))) : null,
      ),
    );
  }
  node.append(ap);
  return node;
}

// Abordagem: fichas, envios e tarefas em abas (uma tela, três visões).
const ABORDAGEM_TABS = ["Fichas", "Envios", "Tarefas"];
async function abordagemView(tab) {
  const views = { Fichas: fichasView, Envios: enviosView, Tarefas: tarefasView };
  const sub = await views[tab]();
  const head = sub.querySelector(".page-head");
  if (head) {
    const h = head.querySelector("h1");
    const h2 = text("h2", h.textContent);
    h.replaceWith(h2);
  }
  const node = section("Abordagem", "Preparar e aprovar fichas, acompanhar envios, respostas e tarefas de contato.");
  node.append(
    el(
      "div",
      { class: "tabs", role: "tablist", "aria-label": "Abordagem" },
      ...ABORDAGEM_TABS.map((t) => el("button", { type: "button", role: "tab", "aria-selected": t === tab ? "true" : "false", onclick: () => navigate(t) }, t)),
    ),
    sub,
  );
  return node;
}

// Configurações: cadastros e regras que não fazem parte do trabalho diário.
async function settingsView() {
  const node = section("Configurações", "Cadastros, regras e controles da operação. O trabalho diário fica nos radares, em Empresas e em Abordagem.");
  const group = (title, hint, items) =>
    el(
      "section",
      { class: "settings-group" },
      text("h2", title),
      text("p", hint, "muted"),
      el("div", { class: "settings-list" }, ...items.map(([name, desc, tag]) => el("button", { type: "button", onclick: () => navigate(name) }, text("strong", name), text("span", desc), tag ? text("small", tag, "tag") : null))),
    );
  node.append(
    group("Preparação das buscas", "Usado ao montar campanhas e radares.", [
      ["Campanhas", "Commodity, cidade de origem e cliente ideal de cada busca; ativação."],
      ["Catálogo", "Produtos, identidade e códigos NCM/HS."],
      ["Setores e CNAE", "Setores usuários ligados às subclasses CNAE da busca nacional."],
      ["Prospecção automática", "Perfil comprador padrão (versionado) e política de pesquisa de rotina."],
    ]),
    group("Controles e administração", "Mudanças aqui afetam toda a operação; cada uma pede motivo e fica no histórico.", [
      ["Pausas", "Pausas de empresa, campanha, commodity ou da operação."],
      ["Supressão", "Descadastros e endereços que não podem receber contato.", admin() ? null : "consulta restrita"],
      ["Parâmetros", "Raios, janelas e limites de envio, prazos.", "administrador"],
      ["Lista mensal", "Rotina mensal de países importadores e fontes (MDIC, Comtrade)."],
    ]),
  );
  return node;
}

// Setores usuários → CNAE (antes no Radar; é cadastro de apoio da busca nacional).
async function sectorsView() {
  const sectors = await api("/api/sectors");
  const node = section("Setores e CNAE", "Setor sem CNAE aprovado bloqueia a busca nacional. Cadastre a subclasse com a fonte da CONCLA/IBGE.");
  node.append(panel("Setores usuários → CNAE", rows(sectors.items, (x) => el("div", { class: "row" }, el("div", {}, text("strong", `${x.sector_key} · ${x.cnae_code}`), text("small", `${x.label} · ${x.source}`))))));
  if (admin())
    node.append(
      details(
        "Cadastrar setor → CNAE",
        makeForm(
          [input("Setor usuário (como no ICP)", "sector"), input("CNAE (subclasse, 7 dígitos)", "cnaeCode"), input("Descrição da subclasse", "label"), input("Fonte (URL)", "source")],
          async (v) => {
            await api("/api/sectors", "POST", v);
            notice("Associação registrada.");
            await navigate("Setores e CNAE");
          },
          "Cadastrar",
        ),
      ),
    );
  return node;
}

// Menu de ações secundárias (a principal fica visível ao lado).
function moreMenu(label, ...buttons) {
  const list = buttons.filter(Boolean);
  if (!list.length) return null;
  const menu = el("details", { class: "more" }, el("summary", {}, label), el("div", { class: "more-list" }, ...list));
  menu.addEventListener("click", (e) => {
    if (e.target.closest(".more-list button")) menu.open = false;
  });
  return menu;
}

// Painel lateral: abre a empresa sem sair da lista (fecha com Esc ou "Fechar").
function openDrawer(title, build) {
  document.querySelector("dialog.drawer")?.remove();
  const body = el("div", { class: "drawer-body" }, text("p", "Carregando…", "muted"));
  const dlg = el(
    "dialog",
    { class: "drawer", "aria-label": title },
    el("div", { class: "drawer-head" }, text("strong", title), button("Fechar", () => dlg.close())),
    body,
  );
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  safe(async () => body.replaceChildren(await build()));
  return dlg;
}

// Radar Nacional: commodity + cidade do fornecedor (campanha) + raio → compradores próximos.
async function radarView() {
  const node = section("Radar Nacional", "Compradores próximos da cidade do fornecedor. A cidade é o centro da busca; o raio define até onde procurar.");
  const [campaigns, params] = await Promise.all([campaignsOf("national"), api("/api/parameters")]);
  const active = campaigns.filter((c) => c.status === "active");
  const radii = params.parameters["radius_allowed_km:national"] || [];
  const productName = (id) => state.products.find((p) => p.id === id)?.variant_name || "commodity";
  if (!active.length) {
    const drafts = campaigns.filter((c) => c.status === "draft");
    node.append(
      el(
        "div",
        { class: "callout warn" },
        el("p", {}, text("strong", "Nenhuma busca nacional disponível. "), drafts.length ? `Há ${drafts.length} campanha(s) nacional(is) em rascunho: ative a que tem a commodity e a cidade do fornecedor.` : "Crie uma campanha nacional com a commodity e a cidade do fornecedor para buscar compradores."),
        button(drafts.length ? "Ver campanhas" : "Criar campanha", () => navigate("Campanhas"), true),
      ),
    );
  } else if (writable()) {
    const choice = select("Commodity e cidade do fornecedor", "campaignId", active.map((c) => [c.id, `${productName(c.product_id)} · ${c.origin_city}/${c.origin_uf}`]), active[0].id);
    const radius = select("Raio de busca", "radiusKm", radii.map((r) => [String(r), `${r} km`]), String(active[0].radius_km));
    choice.control.addEventListener("change", () => {
      const c = active.find((x) => x.id === choice.control.value);
      if (c) radius.control.value = String(c.radius_km);
    });
    node.append(
      panel(
        "Nova busca de compradores",
        makeForm(
          [choice, radius],
          async (v) => {
            const r = await api("/api/searches", "POST", { campaignId: v.campaignId, radiusKm: Number(v.radiusKm) });
            notice(r.reused ? "A busca de hoje com estes parâmetros já existe; abrindo o resultado." : `Busca iniciada em ${r.partitions} consulta(s).`);
            await showSearch(r.searchId);
          },
          "Buscar compradores",
        ),
        text("small", "Outra commodity ou cidade? Cadastre ou ative a campanha em Configurações > Campanhas.", "muted"),
      ),
    );
  }
  const recent = [];
  for (const c of active) for (const s of (await api(`/api/searches?campaignId=${c.id}`)).items) recent.push({ ...s, label: `${productName(c.product_id)} · ${c.origin_city}/${c.origin_uf}` });
  recent.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  node.append(
    panel(
      "Buscas recentes",
      rows(recent.slice(0, 12), (s) =>
        el(
          "div",
          { class: "row" },
          el("div", {}, text("strong", `${s.label} · ${s.radius_km} km`), text("small", `${s.candidates_count} compradores encontrados${s.coverage_note ? ` · ${s.coverage_note}` : ""}`)),
          text("span", lbl(s.status), s.status === "complete" ? "tag ok" : ["partial", "failed"].includes(s.status) ? "tag warn" : "tag"),
          button("Ver compradores", () => showSearch(s.id)),
        ),
      ),
    ),
  );
  return node;
}

// Mapa esquemático (sem mapa de fundo): posição relativa de cada unidade ao centro da busca, na escala do raio.
function radarMap(search, items) {
  const size = 320, c = size / 2, R = size / 2 - 18;
  const lat0 = search.origin_lat, lon0 = search.origin_lon;
  const kmX = (lon) => (lon - lon0) * 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const kmY = (lat) => (lat - lat0) * 110.57;
  const scale = R / Math.max(1, search.radius_km);
  const ns = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const svg = svgEl("svg", { viewBox: `0 0 ${size} ${size}`, role: "img", "aria-label": `Mapa esquemático: ${items.length} compradores em até ${search.radius_km} km do centro da busca` });
  svg.append(
    svgEl("rect", { x: 0, y: 0, width: size, height: size, rx: 10, fill: "#f8faf8" }),
    svgEl("circle", { cx: c, cy: c, r: R, fill: "#e5f2e9", stroke: "#1d7a43", "stroke-width": 1.2, "stroke-dasharray": "4 4" }),
    svgEl("circle", { cx: c, cy: c, r: R / 2, fill: "none", stroke: "#c5cfc8", "stroke-width": 1 }),
    svgEl("circle", { cx: c, cy: c, r: 5, fill: "#17231c" }),
  );
  let placed = 0;
  for (const x of items) {
    if (x.lat == null || x.lon == null) continue;
    let px = kmX(x.lon) * scale, py = -kmY(x.lat) * scale;
    const d = Math.hypot(px, py);
    if (d > R + 12) (px = (px / d) * (R + 12)), (py = (py / d) * (R + 12));
    const exact = x.geo_precision && !/munic/.test(String(x.geo_precision));
    const dot = svgEl("circle", { cx: c + px, cy: c + py, r: 4.5, fill: exact ? "#1d7a43" : "#ffffff", stroke: "#1d7a43", "stroke-width": 1.6 });
    const t = svgEl("title", {});
    t.textContent = `${x.trade_name || x.legal_name} · ${x.distance_km == null ? "distância desconhecida" : `${x.distance_km.toFixed(1)} km`}`;
    dot.append(t);
    svg.append(dot);
    placed++;
  }
  const noPos = items.length - placed;
  const wrap = el(
    "div",
    { class: "map-wrap" },
    text("strong", "Mapa"),
    svg,
    el("div", { class: "map-legend" }, el("span", {}, el("i", { class: "dot-origin" }), "centro da busca"), el("span", {}, el("i", { class: "dot-exact" }), "endereço da unidade"), el("span", {}, el("i", { class: "dot-est" }), "centro do município (estimativa)")),
    text("small", `Círculo tracejado: ${search.radius_km} km; interno: ${Math.round(search.radius_km / 2)} km. Esquema sem mapa de fundo.${noPos ? ` ${noPos} desta página sem posição conhecida (fora do mapa).` : ""}`, "muted"),
  );
  // Troca o esquema pelo mapa real quando disponível; qualquer falha mantém o esquema.
  upgradeToRealMap(wrap, search, items).catch((e) => console.warn("mapa indisponível:", e.message));
  return wrap;
}

// Mapa de fundo real (Protomaps/OpenStreetMap, servido pela própria origem e lido do R2 privado pela rota /api/mapa).
// Sem WebGL, sem recorte configurado ou com falha de carga, o esquema em SVG continua no lugar.
let mapLibs = null;
function loadMapLibs() {
  mapLibs ||= (async () => {
    if (!document.querySelector('link[href="/mapa/maplibre-gl.css"]')) document.head.append(el("link", { rel: "stylesheet", href: "/mapa/maplibre-gl.css" }));
    const [ml, base] = await Promise.all([import("/mapa/maplibre-gl.mjs"), import("/mapa/mapa-base.mjs")]);
    // Worker na própria origem: dispensa "blob:" em worker-src (coberto por script-src 'self').
    ml.setWorkerUrl(new URL("/mapa/maplibre-gl-worker.mjs", location.origin).href);
    ml.addProtocol("pmtiles", new base.Protocol().tile);
    return { ml, base };
  })().catch((e) => {
    mapLibs = null;
    throw e;
  });
  return mapLibs;
}
let mapInfoCache = null;
function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
// Círculo do raio como polígono (geodésico simples; suficiente para a escala do Radar).
function radiusRing(lat0, lon0, km, steps = 96) {
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lon0 + (km * Math.sin(a)) / (111.32 * Math.cos((lat0 * Math.PI) / 180)), lat0 + (km * Math.cos(a)) / 110.57]);
  }
  return ring;
}
async function upgradeToRealMap(wrap, search, items) {
  if (!webglAvailable()) return;
  mapInfoCache ||= api("/api/mapa").catch(() => ({ available: false }));
  const info = await mapInfoCache;
  if (!info.available) return;
  const { ml, base } = await loadMapLibs();
  const box = el("div", { class: "map-canvas", role: "region", "aria-label": `Mapa: ${items.length} compradores em até ${search.radius_km} km do centro da busca` });
  const sketch = wrap.querySelector("svg");
  sketch.replaceWith(box);
  wrap.classList.add("real");
  const ring = radiusRing(search.origin_lat, search.origin_lon, search.radius_km);
  const lons = ring.map((p) => p[0]),
    lats = ring.map((p) => p[1]);
  const map = new ml.Map({
    container: box,
    style: {
      version: 8,
      glyphs: `${location.origin}/mapa/fonts/{fontstack}/{range}.pbf`,
      sprite: `${location.origin}/mapa/sprites/light`,
      sources: { protomaps: { type: "vector", url: `pmtiles://${location.origin}${info.url}`, attribution: '<a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' } },
      layers: base.layers("protomaps", base.namedFlavor("light"), { lang: "pt" }),
    },
    bounds: [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ],
    fitBoundsOptions: { padding: 16 },
    maxZoom: 15,
    attributionControl: false,
    cooperativeGestures: matchMedia("(max-width: 860px)").matches,
  });
  map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
  map.addControl(new ml.AttributionControl({ compact: false }), "bottom-right");
  const points = items
    .filter((x) => x.lat != null && x.lon != null)
    .map((x) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [x.lon, x.lat] },
      properties: { id: x.company_id, name: x.trade_name || x.legal_name, exact: !!(x.geo_precision && !/munic/.test(String(x.geo_precision))), dist: x.distance_km == null ? "distância desconhecida" : `${x.distance_km.toFixed(1)} km`, city: `${x.municipality_name || "—"}/${x.uf || "—"}` },
    }));
  map.on("load", () => {
    map.addSource("raio", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} } });
    map.addLayer({ id: "raio-fill", type: "fill", source: "raio", paint: { "fill-color": "#1d7a43", "fill-opacity": 0.06 } });
    map.addLayer({ id: "raio-line", type: "line", source: "raio", paint: { "line-color": "#1d7a43", "line-width": 1.6, "line-dasharray": [3, 2] } });
    map.addSource("centro", { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: [search.origin_lon, search.origin_lat] }, properties: {} } });
    map.addLayer({ id: "centro", type: "circle", source: "centro", paint: { "circle-radius": 6, "circle-color": "#17231c", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    map.addSource("compradores", { type: "geojson", data: { type: "FeatureCollection", features: points } });
    map.addLayer({
      id: "compradores",
      type: "circle",
      source: "compradores",
      paint: { "circle-radius": 6.5, "circle-color": ["case", ["get", "exact"], "#1d7a43", "#ffffff"], "circle-stroke-color": "#1d7a43", "circle-stroke-width": 2 },
    });
    map.on("mouseenter", "compradores", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "compradores", () => (map.getCanvas().style.cursor = ""));
    map.on("click", "compradores", (e) => {
      const p = e.features[0].properties;
      new ml.Popup({ closeButton: true, maxWidth: "260px" })
        .setLngLat(e.features[0].geometry.coordinates)
        .setDOMContent(el("div", { class: "map-pop" }, text("strong", p.name), text("small", `${p.city} · ${p.dist} · ${p.exact ? "endereço da unidade" : "centro do município (estimativa)"}`), p.id ? button("Abrir", () => openCompanyPanel(p.id, p.name), true) : null))
        .addTo(map);
    });
    box.dataset.ready = "true";
    box.mapInstance = map; // usado pelos testes de interface (clique num comprador)
  });
  map.on("error", (e) => console.warn("mapa:", e.error?.message || e));
  const note = wrap.querySelector("small.muted");
  const noPos = items.length - points.length;
  if (note) note.textContent = `Círculo tracejado: ${search.radius_km} km. Toque ou clique num ponto para ver a empresa.${noPos ? ` ${noPos} desta página sem posição conhecida (fora do mapa).` : ""}`;
}


async function showSearch(id, order = "icp", offset = 0) {
  const [d, c] = await Promise.all([api(`/api/searches/${id}`), api(`/api/searches/${id}/candidates?order=${order}&limit=50&offset=${offset}`)]);
  const s = d.search;
  const node = section(`Compradores em até ${s.radius_km} km`, `${lbl(s.status)} · ${s.candidates_count} empresa(s) encontrada(s) · versão ${s.version} da busca`);
  const head = el("div", { class: "toolbar" }, button("Voltar ao Radar", () => navigate("Radar Nacional")));
  if (["partial", "failed"].includes(s.status) && approver())
    head.append(
      button("Tentar de novo", async () => {
        await api(`/api/searches/${id}/resume`, "POST", {});
        notice("Consultas com falha voltaram para a fila.");
        await showSearch(id, order);
      }),
    );
  node.append(head);
  if (s.coverage_note) node.append(el("div", { class: "callout warn" }, el("p", {}, text("strong", "Cobertura parcial. "), s.coverage_note)));
  node.append(
    el(
      "div",
      { class: "toolbar" },
      text("span", "Ordenar:", "muted"),
      el(
        "div",
        { class: "segmented", role: "group", "aria-label": "Ordenar" },
        el("button", { type: "button", "aria-pressed": order === "icp" ? "true" : "false", onclick: () => safe(() => showSearch(id, "icp")) }, "Aderência ao perfil"),
        el("button", { type: "button", "aria-pressed": order === "distance" ? "true" : "false", onclick: () => safe(() => showSearch(id, "distance")) }, "Distância"),
      ),
    ),
  );
  const list = rows(c.items, (x) =>
    el(
      "div",
      { class: "row" },
      el(
        "div",
        {},
        text("strong", x.trade_name || x.legal_name),
        text("small", `${x.municipality_name || "—"}/${x.uf || "—"} · ${x.distance_km == null ? "distância desconhecida" : `${x.distance_km.toFixed(1)} km`} (${lbl(x.distance_basis)}) · porte ${x.size_label || "não informado"}`),
      ),
      text("span", `${lbl(x.icp_status)}${x.icp_provisional ? " (provisório)" : ""}`, x.icp_status === "in_icp" ? "tag ok" : "tag"),
      button("Abrir", () => openCompanyPanel(x.company_id, x.trade_name || x.legal_name)),
    ),
  );
  node.append(el("div", { class: "radar-results" }, el("div", { class: "panel" }, text("h2", "Lista"), list, c.nextOffset != null ? button("Próxima página", () => showSearch(id, order, c.nextOffset)) : null), radarMap(s, c.items)));
  showScreen(node, "Radar Nacional", "Compradores");
}

// Empresa no painel lateral: o mesmo conteúdo da tela da empresa, sem perder a lista.
function openCompanyPanel(companyId, name) {
  const dlg = openDrawer(name || "Empresa", async () => {
    const n = await companyNode(companyId, 0, true);
    n.prepend(el("div", { class: "toolbar" }, button("Abrir em tela cheia", () => { document.querySelector("dialog.drawer")?.close(); return showCompany(companyId); })));
    return n;
  });
  dlg.dataset.company = companyId;
}

function panel(title, ...children) {
  return el("section", { class: "panel" }, text("h2", title), ...children);
}
function rows(items, render) {
  return items.length
    ? el("div", { class: "rows" }, ...items.map(render))
    : text("p", "Nenhum registro nesta página.", "empty");
}
function kv(pairs) {
  return el(
    "dl",
    { class: "data-grid" },
    ...pairs.flatMap(([a, b]) => [
      text("dt", a),
      text("dd", b ?? "Não informado"),
    ]),
  );
}
function productSelect(name = "productId", value) {
  return select(
    "Produto",
    name,
    state.products.map((p) => [
      p.id,
      (p.display_name || p.variant_name) +
        (p.identity_status === "pending" ? " — identidade pendente" : ""),
    ]),
    value,
  );
}
const marketSelect = (value) =>
  select(
    "Mercado",
    "market",
    [
      ["national", "Nacional"],
      ["international", "Internacional"],
    ],
    value,
  );
function writable() {
  return state.actor?.role !== "auditor_viewer";
}
function approver() {
  return ["admin", "commercial_manager"].includes(state.actor?.role);
}
async function api(path, method = "GET", body, extraHeaders = {}) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(path, {
      method,
      // Canal declarado: painel. O painel não declara executor: um botão pode ser acionado por pessoa ou automação.
      headers: { "x-compass-channel": "panel", ...(body === undefined ? {} : { "content-type": "application/json" }), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const d = await r.json();
    if (!r.ok) {
      let message = d.error?.message || "Falha na solicitação.";
      if (d.error?.details?.pending)
        message +=
          " Pendências: " +
          d.error.details.pending.map((x) => gateLabels[x] || x).join("; ");
      throw new Error(message);
    }
    return d;
  } catch (e) {
    if (e.name === "AbortError")
      throw new Error(
        "A solicitação demorou demais. Atualize os dados antes de repetir uma gravação.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
async function navigate(view = state.view) {
  state.view = view;
  const generation = ++state.generation;
  $("content").setAttribute("aria-busy", "true");
  $("content").replaceChildren(text("p", "Carregando…", "muted"));
  markNav(view);
  try {
    const content = await views[view]();
    if (generation !== state.generation) return;
    $("content").replaceChildren(content);
    window.scrollTo({ top: 0 });
    $("content").focus({ preventScroll: true });
  } catch (e) {
    if (generation !== state.generation) return;
    $("content").replaceChildren(
      section(view, "Os dados não puderam ser carregados."),
      text("p", e.message, "error"),
      button("Tentar novamente", () => navigate(view)),
    );
  } finally {
    if (generation === state.generation)
      $("content").setAttribute("aria-busy", "false");
  }
}
// Filtros da lista de Empresas: parâmetros de consulta (somente leitura), preservados na paginação e na exportação.
function companyQuery() {
  const f = state.companyFilters || {};
  const q = new URLSearchParams({ q: state.search || "" });
  for (const k of ["status", "country", "contact", "profile", "decisor", "commodity", "uf"]) if (f[k]) q.set(k, f[k]);
  return q.toString();
}
async function companiesView() {
  const f = (state.companyFilters ||= {});
  const d = await api(`/api/companies?limit=25&offset=${state.offset}&${companyQuery()}`),
    filtered = !!(state.search || Object.values(f).some(Boolean)),
    node = section("Empresas", "Fontes e confirmações ficam no histórico de cada empresa.");
  const apply = async (v) => {
    state.search = v.q || "";
    state.companyFilters = { status: v.status, country: v.country, contact: v.contact, profile: v.profile, decisor: v.decisor, commodity: v.commodity, uf: v.uf };
    state.offset = 0;
    await navigate("Empresas");
  };
  const fields = [
    input("Buscar empresa, CNPJ, pessoa ou contato", "q", "search", state.search, false),
    select("Etapa", "status", [["", "Todas"], ...Object.keys(statusLabels).slice(0, 8).map((k) => [k, statusLabels[k]])], f.status || ""),
    select("País", "country", [["", "Todos"], ["BR", "Brasil"], ["exterior", "Exterior"]], f.country || ""),
    select("Contato", "contact", [["", "Todos"], ["com", "Com contato"], ["sem", "Sem contato"]], f.contact || ""),
    select("Perfil (ICP)", "profile", [["", "Todos"], ["in_icp", "No ICP"], ["pending_size", "Porte pendente"], ["out_trader", "Fora: trader"], ["out_small", "Fora: pequena"], ["out_giant", "Fora: gigante"], ["sem", "Sem perfil"]], f.profile || ""),
    select("Decisor", "decisor", [["", "Todos"], ["confirmado", "Confirmado"], ["identificado", "Identificado"], ["a_validar", "A validar"], ["sem", "Ainda não identificado"]], f.decisor || ""),
    select("Commodity", "commodity", [["", "Todas"], ...(state.commodities ?? []).map((c) => [c.code, c.label])], f.commodity || ""),
    select("Estado", "uf", [["", "Todos"], ...Object.entries(UF_NAMES).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([k, v]) => [k, v])], f.uf || ""),
  ];
  const bar = el("form", { class: "filter-bar", role: "search", "aria-label": "Filtrar empresas" }, ...fields.map((x) => x.node));
  // Selecionar um filtro já aplica; a busca por texto aplica com Enter ou "Filtrar".
  for (const x of fields.slice(1)) x.control.addEventListener("change", () => bar.requestSubmit());
  bar.append(
    el(
      "div",
      { class: "toolbar" },
      el("button", { type: "submit", class: "primary" }, "Filtrar"),
      filtered ? button("Limpar", () => apply({})) : null,
    ),
  );
  bar.addEventListener("submit", (e) => {
    e.preventDefault();
    safe(() => apply(Object.fromEntries(new FormData(bar))));
  });
  node.append(bar, text("p", filtered ? `${d.total} empresa(s) com estes filtros.` : `${d.total} empresa(s) cadastradas.`, "result-count"));
  if (writable())
    node.append(
      details(
        "Cadastrar empresa",
        makeForm(
          [
            input("Razão social", "legalName"),
            input("País — código de 2 letras", "countryCode", "text", "BR"),
            input(
              "Identificador cadastral",
              "registrationId",
              "text",
              "",
              false,
            ),
            input(
              "Tipo de registro, como CNPJ",
              "registrationIdType",
              "text",
              "",
              false,
            ),
            input("Fonte do cadastro", "sourceLabel"),
            input("URL da fonte", "sourceUrl", "url", "", false),
          ],
          async (v) => {
            const r = await api("/api/companies", "POST", v);
            notice("Empresa cadastrada.");
            await showCompany(r.id);
          },
          "Cadastrar empresa",
        ),
      ),
    );
  const ICP_TAG = { in_icp: ["No ICP", "tag ok"], pending_size: ["Porte pendente", "tag warn"], out_trader: ["Fora: trader", "tag"], out_small: ["Fora: pequena", "tag"], out_giant: ["Fora: gigante", "tag"] };
  node.append(
    d.companies.length
      ? rows(d.companies, (c) =>
          el(
            "div",
            { class: "row" },
            el(
              "div",
              {},
              text("strong", c.legal_name),
              el(
                "div",
                { class: "tags" },
                text("span", statusLabels[c.pipeline_status] || c.pipeline_status, "tag"),
                c.icp_status ? text("span", ...ICP_TAG[c.icp_status]) : text("span", "Sem perfil", "tag warn"),
                text("span", c.contacts_count ? `${c.contacts_count} contato(s)` : "Sem contato", c.contacts_count ? "tag" : "tag warn"),
              ),
              text("small", `${c.country_code} · ${c.commodity ? commodityName(c.commodity) : "Demanda pendente"} · ${c.market === "national" ? "Nacional" : c.market === "international" ? "Internacional" : "Mercado pendente"}${c.profile_class ? ` · ${lbl(c.profile_class)}` : ""}`),
              decisorLine(c.decisors),
            ),
            button("Abrir", () => openCompanyPanel(c.id, c.legal_name)),
          ),
        )
      : el("div", { class: "empty" }, filtered ? "Nenhuma empresa com estes filtros. " : "Nenhuma empresa cadastrada ainda. ", filtered ? button("Limpar filtros", () => apply({})) : null),
  );
  node.append(
    el(
      "div",
      { class: "toolbar" },
      state.offset > 0
        ? button("Página anterior", () => {
            state.offset = Math.max(0, state.offset - 25);
            return navigate("Empresas");
          })
        : null,
      d.nextOffset !== null
        ? button("Próxima página", () => {
            state.offset = d.nextOffset;
            return navigate("Empresas");
          })
        : null,
      button("Exportar empresas filtradas", exportCompanies),
    ),
  );
  return node;
}
function csvCell(value) {
  let v = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(v)) v = "'" + v;
  return '"' + v.replaceAll('"', '""') + '"';
}
// Decisor e canal da empresa: pessoa (situação e fonte) separada do canal geral, que nunca aparece como contato pessoal.
const DECISOR_TAG = { confirmado: "ok", identificado: "", "a validar": "warn" };
function personLine(p) {
  const bits = [p.title || "cargo não informado", p.email, p.phone].filter(Boolean).join(" · ");
  return el("li", { class: "person-line" }, tag(p.status, DECISOR_TAG[p.status] ?? ""), text("strong", p.name || "Nome não informado"), text("span", `${p.roleLabel}${bits ? ` · ${bits}` : ""}`), p.sourceUrl ? el("a", { href: p.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, "fonte") : null);
}
function decisorLine(d) {
  if (!d) return null;
  const buyers = d.people.filter((x) => x.buyer);
  const others = d.people.filter((x) => !x.buyer);
  const channel = d.channels[0];
  const box = el("div", { class: "decisor-box" });
  if (!buyers.length) box.append(el("p", { class: "decisor-none" }, text("span", "Decisor ainda não identificado"), d.people.length ? text("small", ` · ${d.people.length} pessoa(s) sem papel de comprador`) : null));
  else box.append(el("ul", { class: "plain-list person-list" }, personLine(buyers[0])));
  const rest = [...buyers.slice(1), ...others];
  if (rest.length) box.append(details(`Mais ${rest.length} pessoa(s)`, el("ul", { class: "plain-list person-list" }, ...rest.map(personLine))));
  box.append(el("p", { class: "channel-line" }, channel ? el("span", {}, tag("canal geral da empresa", ""), ` ${[channel.email, channel.phone].filter(Boolean).join(" · ")}`, channel.sourceUrl ? el("a", { href: channel.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, " fonte") : null) : text("small", d.hasChannel ? "Canal pela pessoa acima" : "Sem canal de contato registrado")));
  return box;
}
async function exportCompanies() {
  let offset = 0,
    items = [];
  do {
    const d = await api(
      `/api/companies?limit=100&offset=${offset}&${companyQuery()}`,
    );
    items.push(...d.companies);
    offset = d.nextOffset;
  } while (offset !== null);
  const csv = [
    ["Empresa", "País", "Etapa", "Commodity", "Mercado"],
    ...items.map((c) => [
      c.legal_name,
      c.country_code,
      statusLabels[c.pipeline_status],
      c.commodity,
      c.market,
    ]),
  ]
    .map((r) => r.map(csvCell).join(";"))
    .join("\r\n");
  const link = el("a", {
    href: URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    ),
    download: "eag-empresas.csv",
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  notice(`${items.length} empresas exportadas.`);
}
const fieldDefinitions = [
  ["product", "Produto / descrição"],
  ["specification", "Especificação"],
  ["packaging", "Embalagem"],
  ["volume_per_operation", "Volume por operação", "volume"],
  ["destination_country", "País de destino"],
  ["delivery_location", "Local de entrega"],
  ["incoterm", "Incoterm"],
  ["required_date", "Data requerida", "date"],
  ["modality", "Spot ou contrato"],
  ["operations_per_year", "Operações por ano", "number"],
  ["payment_method", "Forma de pagamento"],
  ["payment_term", "Prazo de pagamento"],
  ["payment_guarantee", "Garantia de pagamento"],
  ["final_buyer", "É comprador final?", "boolean"],
  ["decision_maker", "Decisor identificado"],
  ["compliance_restrictions", "Restrições de compliance"],
  ["buyer_profile", "Perfil comprador", "profile"],
  ["company_registry_status", "Situação cadastral", "registry"],
  ["delivery_condition", "Condição de entrega nacional"],
  ["logistics_confirmed", "Entrega viável confirmada?", "boolean"],
];
// Evidência: o que conta como prova depende da categoria; o tipo é filtrado por ela.
const EVIDENCE_TYPES = {
  business: [
    ["customs_record", "Registro aduaneiro"],
    ["bill_of_lading", "Conhecimento de embarque"],
    ["commercial_document", "Documento comercial (fatura, contrato)"],
    ["company_document", "Documento publicado pela empresa"],
    ["public_nominal_record", "Registro público nominal"],
  ],
  market: [["market_aggregate", "Dado agregado de mercado"]],
  commercial_signal: [["commercial_signal", "Sinal comercial"]],
};
const EVIDENCE_HINT = {
  business: "Prova de compra: documento que liga esta empresa à compra do produto. Informe produto e mercado.",
  market: "Mercado agregado: dado do país ou do setor. Não prova que esta empresa compra.",
  commercial_signal: "Sinal comercial: indício (anúncio, vaga, notícia). Não confirma compra.",
};
function evidenceForm(companyId) {
  const category = select("Categoria", "category", [
    ["business", "Prova de compra"],
    ["market", "Mercado agregado"],
    ["commercial_signal", "Sinal comercial"],
  ]);
  const type = select("Tipo de evidência", "evidenceType", EVIDENCE_TYPES.business);
  const product = productSelect();
  const market = marketSelect("national");
  const hint = text("p", EVIDENCE_HINT.business, "form-hint");
  const sync = () => {
    const k = category.control.value;
    type.control.replaceChildren(...EVIDENCE_TYPES[k].map(([v, l]) => el("option", { value: v }, l)));
    hint.textContent = EVIDENCE_HINT[k];
    product.node.hidden = market.node.hidden = k !== "business";
  };
  category.control.addEventListener("change", sync);
  const form = makeForm(
    [
      { group: "O que foi encontrado", fields: [category, type, product, market] },
      {
        group: "Fonte",
        fields: [input("Referência do documento", "reference"), input("URL da fonte", "sourceUrl", "url", "", false), input("Data da consulta", "consultedAt", "date", new Date().toISOString().slice(0, 10))],
      },
      {
        group: "Data do fato e validação",
        collapsed: true,
        fields: [
          input("Data do fato", "factDate", "date", "", false),
          select("Validação", "validationStatus", [
            ["pending", "Pendente"],
            ["valid", "Validada"],
            ["invalid", "Inválida"],
            ["conflicting", "Conflitante"],
          ]),
        ],
      },
    ],
    async (v) => {
      await api(`/api/companies/${companyId}/evidence`, "POST", v);
      await showCompany(companyId);
    },
    "Registrar evidência",
  );
  form.querySelector("fieldset")?.insertBefore(hint, form.querySelector("fieldset .form-grid"));
  return form;
}
// Fuso: lista curta dos mais comuns, aceitando qualquer fuso IANA digitado.
function timezoneInput() {
  const f = input("Fuso confirmado do contato (ex.: America/Sao_Paulo) — sem ele o envio espera", "timezone", "text", "", false);
  f.control.setAttribute("list", "tz-list");
  f.node.append(
    el("datalist", { id: "tz-list" }, ...["America/Sao_Paulo", "America/Cuiaba", "America/Manaus", "America/Belem", "America/Recife", "America/Porto_Velho", "America/Rio_Branco", "Europe/Berlin", "Europe/Lisbon", "Europe/Madrid", "Europe/Paris", "Europe/London", "America/New_York", "Asia/Shanghai"].map((z) => el("option", { value: z }))),
  );
  return f;
}
const DEMAND_GROUPS = [
  ["Produto e volume", ["product", "specification", "packaging", "volume_per_operation", "operations_per_year", "modality"]],
  ["Entrega", ["destination_country", "delivery_location", "incoterm", "required_date", "delivery_condition", "logistics_confirmed"]],
  ["Pagamento", ["payment_method", "payment_term", "payment_guarantee"]],
  ["Comprador e compliance", ["final_buyer", "decision_maker", "buyer_profile", "company_registry_status", "compliance_restrictions"]],
];
function demandForm(companyId, d, existing = []) {
  const form = el("form"),
    header = el("div", { class: "form-grid" }),
    product = productSelect("productId", d?.product_id),
    market = marketSelect(d?.market || "national");
  if (d?.product_id) product.control.disabled = true;
  if (d) market.control.disabled = true;
  header.append(product.node, market.node);
  form.append(
    header,
    text("p", "Preencha o que já sabe. Marque \"Confirmado\" só com valor e fonte; o que ficar em branco continua como pendência da empresa.", "form-hint"),
  );
  // Campos agrupados por assunto: produto e volume sempre visíveis; o resto recolhido, com contagem de confirmados.
  const groups = DEMAND_GROUPS.map(([title, keys], i) => {
    const box = i === 0 ? el("fieldset", { class: "group" }, el("legend", {}, title)) : el("details", { class: "group" }, el("summary", {}, title, el("small")));
    form.append(box);
    return { title, keys, box };
  });
  const groupOf = (key) => (groups.find((g) => g.keys.includes(key)) || groups[groups.length - 1]).box;
  const editors = fieldDefinitions.map(([key, label, type]) => {
    const old = existing.find((f) => f.field_key === key),
      value = old?.value_json ? JSON.parse(old.value_json) : "";
    const status = select(
      "Estado",
      `${key}-status`,
      [
        ["not_confirmed", "Não confirmado"],
        ["confirmed", "Confirmado"],
        ["not_applicable", "Não se aplica"],
      ],
      old?.field_status || "not_confirmed",
    );
    let edit;
    if (type === "boolean")
      edit = select(
        label,
        key,
        [
          ["", "Escolha"],
          ["true", "Sim"],
          ["false", "Não"],
        ],
        String(value),
      );
    else if (type === "profile")
      edit = select(
        label,
        key,
        [
          ["", "Escolha"],
          ["confirmed_final_consumer", "Consumidor final confirmado"],
          ["possible_final_consumer", "Possível consumidor final"],
          ["trader_distributor", "Trader / distribuidor"],
          ["unconfirmed", "Não confirmado"],
        ],
        value,
      );
    else if (type === "registry")
      edit = select(
        label,
        key,
        [
          ["", "Escolha"],
          ["verified_active", "Ativo verificado"],
          ["partially_verified", "Parcialmente verificado"],
          ["inactive", "Inativo"],
        ],
        value,
      );
    else
      edit = input(
        label,
        key,
        type === "number" || type === "volume"
          ? "number"
          : type === "date"
            ? "date"
            : "text",
        type === "volume"
          ? value?.amount
          : type === "date"
            ? String(value).slice(0, 10)
            : value,
        false,
      );
    if (["number", "volume"].includes(type)) {
      edit.control.min = "0";
      edit.control.step = type === "number" ? "1" : "any";
    }
    const source = input(
      "Fonte da confirmação / motivo de não se aplicar",
      `${key}-source`,
      "text",
      old?.source_reference || old?.not_applicable_reason || "",
      false,
    );
    source.node.classList.add("source");
    const unit =
      type === "volume"
        ? select(
            "Unidade",
            `${key}-unit`,
            ["MT", "KG", "L", "M3", "SAC60KG"],
            value?.unit || "MT",
          )
        : null;
    const row = el("div", { class: unit ? "demand-field has-unit" : "demand-field" }, edit.node, unit?.node, status.node, source.node);
    // A fonte só aparece quando o campo deixa de ser "Não confirmado" (ou já tem fonte registrada).
    const syncSource = () => (source.node.hidden = status.control.value === "not_confirmed" && !source.control.value);
    status.control.addEventListener("change", syncSource);
    syncSource();
    groupOf(key).append(row);
    return {
      key,
      type,
      old,
      status: status.control,
      value: edit.control,
      source: source.control,
      unit: unit?.control,
    };
  });
  for (const g of groups.slice(1)) {
    const done = editors.filter((x) => g.keys.includes(x.key) && x.status.value !== "not_confirmed").length;
    g.box.querySelector("summary small").textContent = `${done} de ${g.keys.length} preenchidos`;
    if (done) g.box.open = true;
  }
  const condition = select(
      "Esta demanda exige comprador final?",
      "finalRequired",
      [
        ["false", "Não há condição registrada"],
        ["true", "Sim, condição comercial registrada"],
      ],
      String(!!d?.final_buyer_required),
    ),
    conditionReason = input(
      "Motivo para mudar essa condição",
      "conditionReason",
      "text",
      "",
      false,
    );
  if (approver()) form.append(condition.node, conditionReason.node);
  const error = text("p", "", "error");
  error.hidden = true;
  const submit = el(
    "button",
    { type: "submit", class: "primary" },
    d ? "Salvar demanda" : "Criar demanda",
  );
  form.append(error, el("div", { class: "toolbar" }, submit));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    error.hidden = true;
    try {
      const fields = editors.map((x) => {
        let value = x.value.value;
        if (x.status.value !== "not_applicable" && value !== "") {
          if (x.type === "boolean") {
            if (!value) throw new Error("Escolha Sim ou Não para " + x.key);
            value = value === "true";
          } else if (x.type === "number") {
            if (value === "") throw new Error("Informe o valor numérico.");
            value = Number(value);
          } else if (x.type === "volume") {
            if (value === "") throw new Error("Informe o volume.");
            value = { amount: Number(value), unit: x.unit.value };
          }
        }
        return {
          key: x.key,
          status: x.status.value,
          value,
          sourceReference: x.source.value,
          reason: x.source.value,
        };
      });
      const body = {
        id: d?.id,
        expectedVersion: d?.version,
        productId: product.control.value,
        market: market.control.value,
        fields,
      };
      if (approver()) {
        body.finalBuyerRequired = condition.control.value === "true";
        body.conditionReason = conditionReason.control.value;
      }
      await api(`/api/companies/${companyId}/demand`, "PUT", body);
      notice("Demanda salva. Scores e exceções devem considerar esta versão.");
      await showCompany(companyId);
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}

// Empresa: resumo compacto no topo + abas. Os blocos existentes (formulários, evidências, contatos, ficha) são os mesmos;
// só passam a ficar agrupados por assunto, com a aba "Resumo e demanda" aberta.
const COMPANY_TABS = [
  ["resumo", "Resumo e demanda"],
  ["contatos", "Contatos e pessoas"],
  ["evidencias", "Evidências e perfil"],
  ["ficha", "Ficha"],
];
function companyTabOf(block) {
  const title = (block.querySelector(":scope > h2, :scope > summary")?.textContent || "").trim();
  if (/^(Pessoas de compras|Contatos|Cadastrar contato|Registrar verificação)/.test(title)) return "contatos";
  if (/^(Gerar ficha|Fichas|Validação de e-mail)/.test(title)) return "ficha";
  if (/^(Evidências|Registrar evidência|Unidades|Perfil comprador|Registrar perfil|Registrar observação de risco|Riscos|Condições|Importação|Compra)/.test(title)) return "evidencias";
  return "resumo";
}
// Estado de cada condição pelas evidências registradas: confirmado (válida), indício (pendente), conflito (válida e
// inválida, ou marcada em conflito) ou desconhecido (nenhuma). Só leitura; não muda a validação nem o estágio.
const PROOF_CONDITIONS = [["consumes_as_input", "Uso da commodity como insumo"], ["buys_commodity", "Compra de terceiros"], ["imports_from_brazil", "Importa do Brasil"]];
function proofState(evidence, key) {
  const rel = evidence.filter((e) => { try { return (JSON.parse(e.metadata_json || "{}").supports || []).includes(key); } catch { return false; } });
  if (!rel.length) return ["Desconhecido", "", null];
  const ok = rel.filter((e) => e.validation_status === "valid").length, bad = rel.filter((e) => e.validation_status === "invalid").length;
  if ((ok && bad) || rel.some((e) => e.validation_status === "conflicting")) return ["Conflito", "bad", `${ok} validada(s) e ${bad} refutada(s)`];
  if (ok) return ["Confirmado", "ok", `${ok} evidência(s) validada(s)`];
  if (bad) return ["Refutado", "bad", `${bad} evidência(s) refutada(s)`];
  return ["Indício", "warn", `${rel.length} evidência(s) com validação pendente`];
}
// Bloco "Decisor e canal" do resumo da empresa (pessoas com situação e fonte; canal geral à parte).
function decisorItem(companyId) {
  const box = el("div", { class: "decisor-item" }, text("span", "Decisor e canal", "k"), text("small", "Carregando…"));
  safe(async () => {
    const d = (await api(`/api/companies/decisors?ids=${companyId}`)).items[companyId];
    box.replaceChildren(text("span", "Decisor e canal", "k"), decisorLine(d) ?? text("strong", "Decisor ainda não identificado"));
  });
  return box;
}
function companySummary(data, goTab) {
  const c = data.company;
  const profile = (data.profiles || [])[0];
  const unit = (data.units || [])[0];
  const contacts = data.contacts || [];
  const decisor = contacts.find((k) => ["decision_maker", "provisional_decision_maker"].includes(k.prospectRole));
  const channel = contacts.find((k) => k.contactKind === "company_channel");
  const evidence = (data.evidence || []).length;
  const why = profile ? `${lbl(profile.profile_class)}${profile.basis ? ` (base: ${profile.basis})` : ""}` : "Perfil comprador não registrado";
  const size = unit?.size_label ? `${unit.size_label} (cadastro da unidade)` : c.size_basis ? `${lbl(c.size_basis)}` : "Desconhecido";
  const contact = decisor
    ? `${decisor.fullName || "Decisor"}${decisor.jobTitle ? `, ${decisor.jobTitle}` : " (cargo não verificado)"}${decisor.emailValidation === "valid" ? " · e-mail validado" : " · e-mail não validado"}`
    : channel
      ? "Canal geral da empresa; responsável por compras ainda não identificado"
      : contacts.length
        ? `${contacts.length} contato(s); nenhum decisor identificado`
        : data.peopleCount
          ? `${data.peopleCount} pessoa(s) de compras a validar; responsabilidade de compra não confirmada`
          : "Nenhum contato registrado";
  let pending, action;
  if (!profile) (pending = "Perfil comprador não registrado para a commodity."), (action = ["Registrar perfil", "evidencias"]);
  else if (!profile.ficha?.ok) (pending = profile.ficha?.reason || "Perfil ainda não permite ficha."), (action = ["Ver perfil e evidências", "evidencias"]);
  else if (!contacts.length) (pending = "Falta um contato com fonte (pessoa de compras ou canal geral publicado)."), (action = ["Encontrar contatos", "contatos"]);
  else if (!decisor && !channel) (pending = "Responsável por compras não identificado."), (action = ["Encontrar responsável", "contatos"]);
  else if (data.openFichas?.some((f) => f.status === "in_approval")) {
    const f = data.openFichas.find((x) => x.status === "in_approval");
    pending = "Ficha aguardando sua aprovação; nada é enviado antes dela.";
    action = ["Revisar e aprovar", () => showFicha(f.id)];
  } else if (data.openFichas?.length) (pending = `Ficha ${lbl(data.openFichas[0].status).toLowerCase()}; acompanhe os envios em Abordagem.`), (action = ["Abrir ficha", () => showFicha(data.openFichas[0].id)]);
  else (pending = "Pronta para preparar a ficha; o envio só acontece após aprovação individual."), (action = ["Preparar ficha", "ficha"]);
  const item = (k, v, extra) => el("div", {}, text("span", k, "k"), text("strong", v), extra ? text("small", extra) : null);
  // Quem é a unidade e o que sustenta a relevância: uso da commodity e compra de terceiros ficam separados (um não prova o outro).
  const whoItem = item("Unidade", unit ? [unit.trade_name || c.legal_name, unit.municipality_name && `${unit.municipality_name}/${unit.uf ?? ""}`].filter(Boolean).join(" · ") : "Unidade não registrada", unit?.cnpj ? `${c.registration_id_type || "Registro"} ${unit.cnpj}` : c.registration_id ? `${c.registration_id_type || "Registro"} ${c.registration_id}` : "sem identificador cadastral");
  const proofBlock = el("div", { class: "proof" }, text("span", "O que está comprovado", "k"), el("ul", { class: "proof-list" }, ...PROOF_CONDITIONS.map(([key, label]) => {
    const [st, cls, why] = proofState(data.evidence || [], key);
    return el("li", {}, tag(st, cls), text("span", label), why ? text("small", why, "muted") : null);
  })));
  // Próxima ação já registrada (tarefa aberta) prevalece sobre a sugestão calculada; o roteiro fica à mão.
  const task = (data.openTasks || [])[0];
  // Avisos D-EXC (sem identidade) valem para a empresa com ou sem tarefa aberta, inclusive depois da última encerrada.
  const notices = (data.notices || []).map((n) => text("p", noticeLine(n), "notice-line"));
  if (task)
    return el(
      "div",
      { class: "company-summary" },
      whoItem, item("Etapa", statusLabels[c.pipeline_status] || lbl(c.pipeline_status)),
      item("Por que pode comprar", why, profile ? lbl(profile.icp_status) : null),
      item("Porte", size, unit?.size_label ? null : "Pendência pesquisável; não impede a busca"),
      decisorItem(c.id),
      item("Evidências", evidence ? `${evidence} registrada(s)` : "Nenhuma registrada", `Fonte do cadastro: ${c.source_label}`), proofBlock,
      el(
        "div",
        { class: "next" },
        el("p", {}, text("strong", "Próxima ação: "), `${TASK_KIND[task.kind] || task.kind} — vence ${task.due_date}. Registre o resultado em Tarefas.`),
        task.next_action ? el("p", {}, text("strong", "O que fazer: "), task.next_action) : null,
        task.channel_note ? el("p", {}, text("strong", "Canal: "), task.channel_note) : null,
        ...notices,
        task.script ? details("Roteiro", el("pre", { class: "message" }, task.script)) : null,
        button("Abrir Tarefas", () => (document.querySelector("dialog.drawer")?.close(), navigate("Tarefas")), true),
      ),
    );
  return el(
    "div",
    { class: "company-summary" },
    whoItem, item("Etapa", statusLabels[c.pipeline_status] || lbl(c.pipeline_status)),
    item("Por que pode comprar", why, profile ? lbl(profile.icp_status) : null),
    item("Porte", size, unit?.size_label ? null : "Pendência pesquisável; não impede a busca"),
    decisorItem(c.id),
    item("Evidências", evidence ? `${evidence} registrada(s)` : "Nenhuma registrada", `Fonte do cadastro: ${c.source_label}`), proofBlock,
    el("div", { class: "next" }, el("p", {}, text("strong", "Pendência principal: "), pending), ...notices, button(action[0], () => (typeof action[1] === "function" ? (document.querySelector("dialog.drawer")?.close(), action[1]()) : goTab(action[1])), true)),
  );
}
function organizeCompany(node, data) {
  const head = node.querySelector(".page-head");
  const blocks = [...node.children].filter((ch) => ch !== head && !(ch.tagName === "BUTTON"));
  const loose = [...node.children].filter((ch) => ch.tagName === "BUTTON");
  const panels = Object.fromEntries(COMPANY_TABS.map(([k]) => [k, el("div", { class: "tab-panel", role: "tabpanel", id: `tab-${k}` })]));
  for (const b of blocks) panels[companyTabOf(b)].append(b);
  for (const [k, p] of Object.entries(panels)) if (!p.children.length) p.append(text("p", "Nada registrado nesta parte ainda.", "empty"));
  const tabs = el("div", { class: "tabs", role: "tablist", "aria-label": "Partes da empresa" });
  const goTab = (key) => {
    state.companyTab = key;
    for (const b of tabs.children) b.setAttribute("aria-selected", b.dataset.tab === key ? "true" : "false");
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== key;
  };
  for (const [k, label] of COMPANY_TABS) tabs.append(el("button", { type: "button", role: "tab", "data-tab": k, "aria-controls": `tab-${k}`, onclick: () => goTab(k) }, label));
  node.replaceChildren(head, ...(loose.length ? [el("div", { class: "toolbar" }, ...loose)] : []), companySummary(data, goTab), tabs, ...Object.values(panels));
  goTab(COMPANY_TABS.some(([k]) => k === state.companyTab) ? state.companyTab : "resumo");
  return node;
}

async function companyNode(id, offset = 0, inDrawer = false) {
  const data = await api(`/api/companies/${id}?limit=50&offset=${offset}`);
  const c = data.company,
    node = section(
      c.trade_name ? `${c.trade_name} (${c.legal_name})` : c.legal_name,
      `${c.country_code} · ${statusLabels[c.pipeline_status]} · Fonte: ${c.source_label}`,
    );
  // Etapa da jornada e contexto de retorno: só leitura do estágio existente.
  node.dataset.step = String(COMPANY_STEP[c.pipeline_status] ?? 1);
  state.ctxCompany = { id, name: c.trade_name || c.legal_name };
  if (!inDrawer) node.append(button("Voltar às empresas", () => navigate("Empresas")));
  node.append(details("Pessoas de compras", peoplePanel(id)));
  for (const d of data.demands) {
    const scoreBox = el("div", {});
    const box = panel(
      d.product_variant || d.commodity,
      text(
        "p",
        `${d.market === "national" ? "Nacional" : "Internacional"} · Demanda v${d.version} · ${d.completeness}% dos campos aplicáveis confirmados`,
      ),
    );
    if (writable())
      box.append(
        el(
          "div",
          { class: "toolbar" },
          button("Calcular scores e verificar gate", async () => {
            const r = await api(
              `/api/companies/${id}/scores/recalculate`,
              "POST",
              { demandId: d.id },
            );
            scoreBox.replaceChildren(
              kv([
                [
                  "Potencial",
                  `${r.potential.scoreMin}–${r.potential.scoreMax}`,
                ],
                ["Confiança", r.confidence.score],
                ["Risco", r.risk.score ?? "Desconhecido"],
                ["Cobertura de risco", `${r.risk.coverage}%`],
              ]),
              el(
                "div",
                { class: "gate" },
                text(
                  "strong",
                  r.gate.qualified
                    ? "Critérios atendidos"
                    : "Pendências de qualificação",
                ),
                el(
                  "ul",
                  {},
                  ...r.gate.pending.map((k) => text("li", gateLabels[k] || k)),
                ),
              ),
            );
          }),
          approver()
            ? button(
                "Qualificar demanda",
                async () => {
                  await api(`/api/companies/${id}/qualify`, "POST", {
                    demandId: d.id,
                  });
                  notice("Empresa qualificada para esta demanda.");
                  await showCompany(id);
                },
                true,
              )
            : null,
        ),
      );
    box.append(
      scoreBox,
      writable()
        ? details(
            "Editar campos da demanda",
            demandForm(id, d, data.demandFields[d.id]),
          )
        : text(
            "p",
            "Consulta disponível; seu perfil não altera dados.",
            "muted",
          ),
    );
    node.append(box);
  }
  if (writable()) node.append(details("Nova demanda", demandForm(id)));
  node.append(
    panel(
      "Evidências",
      rows(data.evidence, (r) =>
        el(
          "div",
          { class: "row" },
          el(
            "div",
            {},
            text("strong", r.reference),
            text(
              "small",
              `${r.category} · ${r.evidence_type} · ${r.fact_date?.slice(0, 10) || "Data do fato não informada"}`,
            ),
          ),
          text("span", r.validation_status, "tag"),
        ),
      ),
    ),
  );
  if (writable())
    node.append(
      details(
        "Registrar evidência",
        evidenceForm(id),
      ),
    );
  node.append(
    panel(
      "Contatos",
      rows(data.contacts, (r) =>
        el(
          "div",
          { class: "row" },
          el(
            "div",
            {},
            text("strong", r.fullName),
            text(
              "small",
              [r.jobTitle, r.email, r.phone].filter(Boolean).join(" · "),
            ),
          ),
          text("span", `${lbl(r.prospectRole)} · e-mail ${lbl(r.emailValidation)} · ${r.timezone ? `fuso ${r.timezone}` : "fuso pendente"}${r.targetFlag ? " · cargo fora do alvo" : ""}`, "tag"),
          writable()
            ? button(r.timezone ? "Alterar fuso" : "Confirmar fuso", async () => {
                const tz = prompt("Fuso horário confirmado do contato (IANA), ex.: America/Sao_Paulo, America/Manaus, Europe/Berlin:", r.timezone || "America/Sao_Paulo");
                if (!tz) return;
                await api(`/api/contacts/${r.id}`, "PATCH", { timezone: tz.trim() });
                notice("Fuso registrado.");
                await showCompany(id);
              })
            : null,
        ),
      ),
    ),
  );
  node.append(...(await pilotPanels(id, data)), ...internationalPanels(id, data));
  if (writable()) {
    node.append(
      details(
        "Cadastrar contato",
        makeForm(
          [
            {
              group: "Quem é",
              fields: [
                input("Nome", "fullName"),
                input("Cargo", "jobTitle", "text", "", false),
                select("Papel na prospecção", "prospectRole", ["decision_maker", "influencer", "provisional_decision_maker", "other"].map((k) => [k, lbl(k)])),
                input("Fonte do contato (ex.: LinkedIn, site)", "sourceLabel"),
              ],
            },
            {
              group: "Como falar",
              hint: "O e-mail é validado à parte. Sem fuso confirmado o envio espera (horário comercial do destinatário).",
              fields: [input("E-mail", "email", "email", "", false), timezoneInput()],
            },
            { group: "Outros canais (opcional)", collapsed: true, fields: [input("Telefone", "phone", "text", "", false), input("LinkedIn", "linkedinUrl", "url", "", false)] },
          ],
          async (v) => {
            await api(`/api/companies/${id}/contacts`, "POST", v);
            await showCompany(id);
          },
          "Cadastrar contato",
        ),
      ),
    );
    if (data.contacts.length && data.demands.length)
      node.append(
        details(
          "Registrar verificação de contato",
          makeForm(
            [
              select(
                "Contato",
                "contactId",
                data.contacts.map((c) => [c.id, c.fullName]),
              ),
              select(
                "Demanda",
                "demandId",
                data.demands.map((d) => [
                  d.id,
                  d.product_variant + " · " + d.market,
                ]),
              ),
              select("Verificação", "type", [
                ["identity", "Identidade"],
                ["job_title", "Cargo"],
                ["decision_authority", "Autoridade decisória"],
                ["direct_demand", "Demanda confirmada"],
                ["email_deliverable", "Entregabilidade de e-mail"],
              ]),
              select("Resultado", "status", [
                ["confirmed", "Confirmado"],
                ["rejected", "Rejeitado"],
                ["pending", "Pendente"],
              ]),
              input("Método", "method"),
              input("Fonte que comprova a verificação", "sourceReference"),
            ],
            async (v) => {
              await api(
                `/api/companies/${id}/contact-verifications`,
                "POST",
                v,
              );
              notice("Verificação registrada. Recalcule os scores.");
              await showCompany(id);
            },
            "Registrar verificação",
          ),
        ),
      );
    node.append(
      details(
        "Registrar observação de risco",
        makeForm(
          [
            select("Componente", "component", [
              ["registration", "Cadastro"],
              ["credit", "Crédito"],
              ["payment", "Pagamento"],
              ["reputation", "Reputação"],
              ["logistics", "Logística"],
            ]),
            input("Severidade de 0 a 20", "severity", "number"),
            input("Fonte", "sourceReference"),
            input(
              "Data observada",
              "observedAt",
              "date",
              new Date().toISOString().slice(0, 10),
            ),
          ],
          async (v) => {
            await api(`/api/companies/${id}/risk-observations`, "POST", {
              ...v,
              severity: Number(v.severity),
            });
            notice("Risco registrado.");
            await showCompany(id);
          },
          "Registrar risco",
        ),
      ),
    );
  }
  if (approver() && data.demands.length)
    node.append(
      details(
        "Decidir exceção",
        makeForm(
          [
            select(
              "Demanda",
              "demandId",
              data.demands.map((d) => [
                d.id,
                d.product_variant + " · " + d.market,
              ]),
            ),
            select("Tipo", "approvalType", [
              ["below_minimum", "Volume abaixo do mínimo"],
              ["risk_coverage_waiver", "Dispensa de cobertura de risco"],
              ["risk_mitigation", "Mitigação de risco"],
              ["intermediary_validation", "Validação de intermediário"],
            ]),
            select("Decisão", "status", [
              ["pending", "Pendente"],
              ["approved", "Aprovada"],
              ["rejected", "Rejeitada"],
            ]),
            input("Motivo documentado", "reason", "textarea"),
          ],
          async (v) => {
            await api(`/api/companies/${id}/approvals`, "POST", v);
            notice("Decisão registrada para os dados atuais desta demanda.");
            await showCompany(id);
          },
          "Registrar decisão",
        ),
      ),
    );
  const more = Object.values(data.pagination.next).some((x) => x !== null);
  if (offset || more)
    node.append(
      el(
        "div",
        { class: "toolbar" },
        offset
          ? button("Registros anteriores", () =>
              showCompany(id, Math.max(0, offset - 50)),
            )
          : null,
        more
          ? button("Mais registros da empresa", () =>
              showCompany(id, offset + 50),
            )
          : null,
      ),
    );
  // Ficha já existente muda a pendência principal (revisar/aprovar em vez de preparar outra).
  data.openFichas = (await api("/api/fichas?limit=100").catch(() => ({ items: [] }))).items.filter((f) => f.company_id === id && f.status !== "discarded");
  return organizeCompany(node, data);
}
async function showCompany(id, offset = 0) {
  if (!offset && state.companyShown !== id) state.companyTab = "resumo";
  state.companyShown = id;
  // Painel lateral aberto para esta empresa: atualiza nele (ações registradas não tiram a pessoa da lista).
  const dlg = document.querySelector("dialog.drawer[open]");
  if (dlg && dlg.dataset.company === id) {
    const node = await companyNode(id, offset, true);
    node.prepend(el("div", { class: "toolbar" }, button("Abrir em tela cheia", () => { dlg.close(); return showCompany(id); })));
    dlg.querySelector(".drawer-body").replaceChildren(node);
    return;
  }
  const generation = ++state.generation;
  $("content").replaceChildren(text("p", "Carregando empresa…", "muted"));
  const node = await companyNode(id, offset);
  if (generation !== state.generation) return;
  showScreen(node, "Empresas", node.querySelector("h1")?.textContent || "Empresa");
}
const originLabels = {
  SITE: "Site",
  SOLICITACAO: "Solicitação",
  PORTFOLIO: "Portfólio",
};
const admin = () => state.actor?.role === "admin";
async function reloadProducts() {
  const cat = await api("/api/catalog");
  state.products = cat.products;
  state.commodities = cat.commodities;
}
async function catalogView() {
  const node = section(
    "Catálogo",
    "Portfólio documentado. Identidade pendente bloqueia uso; características só da amostra não viram promessa de oferta.",
  );
  node.append(
    rows(state.products, (p) =>
      el(
        "div",
        { class: "row" },
        el(
          "div",
          {},
          text("strong", p.variant_name),
          text(
            "small",
            `${p.group_name} · ${p.source_ref || "sem referência"} · rev. ${p.revision ?? 1}`,
          ),
        ),
        text(
          "span",
          !p.active
            ? "Inativo"
            : p.identity_status === "confirmed"
              ? "Identificado"
              : "Identidade pendente",
          !p.active ? "tag" : p.identity_status === "confirmed" ? "tag ok" : "tag warn",
        ),
        button("Abrir", () => showProduct(p.id)),
      ),
    ),
  );
  if (admin())
    node.append(
      details(
        "Cadastrar produto (administrador)",
        makeForm(
          [
            input("Commodity (identificador, ex.: soy_meal)", "commodity"),
            input("Grupo", "groupName"),
            input("Variante", "variantName"),
            select(
              "Origem",
              "origin",
              Object.entries(originLabels),
            ),
            input("Referência da origem", "sourceRef", "text", "", false),
            input("Motivo", "reason", "textarea"),
          ],
          async (v) => {
            await api("/api/catalog", "POST", {
              commodity: v.commodity,
              groupName: v.groupName,
              variantName: v.variantName,
              origins: [v.origin],
              sourceRef: v.sourceRef || undefined,
              reason: v.reason,
            });
            await reloadProducts();
            notice("Produto cadastrado com identidade pendente.");
            await navigate("Catálogo");
          },
          "Cadastrar",
        ),
      ),
    );
  return node;
}
async function showProduct(id) {
  const p = await api(`/api/catalog/${id}`),
    origins = JSON.parse(p.origins_json || "[]"),
    node = section(
      p.variant_name,
      `${p.group_name} · commodity ${p.commodity} · revisão ${p.revision}`,
    );
  node.append(
    button("Voltar ao catálogo", () => navigate("Catálogo")),
    panel(
      "Identidade",
      kv([
        ["Situação", p.identity_status === "confirmed" ? "Identificado" : "Identidade pendente"],
        ["Ativo", p.active ? "Sim" : "Não"],
        ["Origem", origins.map((o) => originLabels[o] || o).join(", ")],
        ["Referência", p.source_ref],
        ["Consulta", p.consulted_at],
        ["Responsável", p.updated_by],
      ]),
    ),
    panel(
      "Códigos NCM/HS",
      text(
        "p",
        "Código pendente não comprova correspondência no mercado internacional. Confirmado exige fonte e versão da classificação.",
        "muted",
      ),
      rows(p.codes, (c) =>
        el(
          "div",
          { class: "row" },
          el(
            "div",
            {},
            text("strong", `${c.code_system} ${c.code}`),
            text(
              "small",
              `${c.classification_version || "versão não informada"} · ${c.source_ref || "sem fonte"}`,
            ),
          ),
          text("span", c.status === "confirmed" ? "Confirmado" : "Pendente", "tag"),
          admin()
            ? button("Remover", async () => {
                const reason = prompt("Motivo da remoção do código:");
                if (!reason) return;
                await api(`/api/catalog/${id}/codes/${c.id}`, "DELETE", {
                  expectedRevision: p.revision,
                  reason,
                });
                notice("Código removido.");
                await showProduct(id);
              })
            : null,
        ),
      ),
    ),
    panel(
      "Características",
      text(
        "p",
        "Só característica confirmada e fora do escopo de amostra pode ser citada em texto comercial.",
        "muted",
      ),
      rows(p.characteristics, (c) =>
        el(
          "div",
          { class: "row" },
          el(
            "div",
            {},
            text("strong", c.char_key),
            text("small", `${c.char_value} · ${c.source_ref}`),
          ),
          text(
            "span",
            (c.status === "confirmed" ? "Confirmada" : "Não confirmada") +
              (c.sample_only ? " · só amostra" : ""),
            "tag",
          ),
        ),
      ),
    ),
  );
  if (admin()) {
    node.append(
      details(
        "Alterar identidade",
        makeForm(
          [
            input("Variante", "variantName", "text", p.variant_name),
            input("Grupo", "groupName", "text", p.group_name),
            input("Referência da origem", "sourceRef", "text", p.source_ref || "", false),
            select(
              "Identidade",
              "identityStatus",
              [
                ["pending", "Pendente"],
                ["confirmed", "Confirmada"],
              ],
              p.identity_status,
            ),
            select(
              "Ativo",
              "active",
              [
                ["true", "Sim"],
                ["false", "Não"],
              ],
              p.active ? "true" : "false",
            ),
            input("Motivo", "reason", "textarea"),
          ],
          async (v) => {
            await api(`/api/catalog/${id}`, "PATCH", {
              variantName: v.variantName,
              groupName: v.groupName,
              sourceRef: v.sourceRef || null,
              identityStatus: v.identityStatus,
              active: v.active === "true",
              expectedRevision: p.revision,
              reason: v.reason,
            });
            await reloadProducts();
            notice("Produto atualizado.");
            await showProduct(id);
          },
        ),
      ),
      details(
        "Cadastrar código",
        makeForm(
          [
            select("Sistema", "codeSystem", ["NCM", "HS"]),
            input("Código", "code"),
            select("Estado", "status", [
              ["pending", "Pendente"],
              ["confirmed", "Confirmado"],
            ]),
            input("Versão da classificação", "classificationVersion", "text", "", false),
            input("Fonte", "sourceRef", "text", "", false),
            input("Motivo", "reason", "textarea"),
          ],
          async (v) => {
            await api(`/api/catalog/${id}/codes`, "POST", {
              codeSystem: v.codeSystem,
              code: v.code,
              status: v.status,
              classificationVersion: v.classificationVersion || undefined,
              sourceRef: v.sourceRef || undefined,
              expectedRevision: p.revision,
              reason: v.reason,
            });
            notice("Código registrado.");
            await showProduct(id);
          },
          "Registrar código",
        ),
      ),
      details(
        "Cadastrar característica",
        makeForm(
          [
            input("Característica", "key"),
            input("Valor", "value"),
            input("Fonte", "sourceRef"),
            select("Estado", "status", [
              ["not_confirmed", "Não confirmada"],
              ["confirmed", "Confirmada"],
            ]),
            select("Vale só para a amostra", "sampleOnly", [
              ["true", "Sim"],
              ["false", "Não"],
            ]),
            input("Motivo", "reason", "textarea"),
          ],
          async (v) => {
            await api(`/api/catalog/${id}/characteristics`, "POST", {
              key: v.key,
              value: v.value,
              sourceRef: v.sourceRef,
              status: v.status,
              sampleOnly: v.sampleOnly === "true",
              expectedRevision: p.revision,
              reason: v.reason,
            });
            notice("Característica registrada.");
            await showProduct(id);
          },
          "Registrar característica",
        ),
      ),
    );
  }
  showScreen(node);
}
async function parametersView() {
  const d = await api("/api/parameters"),
    node = section(
      "Parâmetros",
      "Valores versionados. Parâmetro sem valor aprovado fica pendente e bloqueia a função que depende dele.",
    );
  const show = (v) => (typeof v === "object" && v !== null ? (Array.isArray(v) ? v.join(", ") : Object.entries(v).map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(", ") : typeof x === "object" && x !== null ? JSON.stringify(x) : x}`).join(" · ")) : String(v));
  const defs = [...d.definitions].sort((a, b) => (a.configuredScopes.length ? 1 : 0) - (b.configuredScopes.length ? 1 : 0));
  const pendingCount = defs.filter((x) => !x.configuredScopes.length).length;
  if (pendingCount) node.append(el("div", { class: "callout warn" }, text("p", `${pendingCount} parâmetro(s) sem valor aprovado: a função que depende de cada um fica bloqueada até a decisão.`)));
  node.append(
    rows(defs, (def) => {
      const configured = def.configuredScopes.map((scope) => [
        scope,
        d.parameters[`${def.key}:${scope}`],
      ]);
      return el(
        "div",
        { class: "row" },
        el(
          "div",
          {},
          text("strong", def.label),
          ...configured.map(([scope, value]) => text("small", `${scope}: ${show(value)}`)),
          text("small", `Usado em ${def.requiredBy} · ${def.key}`),
        ),
        text("span", configured.length ? "Com valor" : "Pendente", configured.length ? "tag ok" : "tag warn"),
      );
    }),
  );
  if (state.actor.role === "admin")
    node.append(
      details(
        "Alterar parâmetro (administrador)",
        makeForm(
          [
            select(
              "Parâmetro",
              "key",
              d.definitions.map((def) => [def.key, def.label]),
            ),
            input("Escopo (ver a linha do parâmetro)", "scope"),
            input(
              'Valor em JSON, ex.: 50, [5,10,15,20] ou {"start":"09:00","end":"17:00","weekdays":[1,2,3,4,5]}',
              "value",
              "textarea",
            ),
            input("Motivo da decisão", "reason", "textarea"),
          ],
          async (v) => {
            let value;
            try {
              value = JSON.parse(v.value);
            } catch {
              throw new Error("Valor precisa ser JSON válido. Texto vai entre aspas.");
            }
            await api(`/api/parameters/${v.key}`, "PUT", {
              scope: v.scope,
              value,
              reason: v.reason,
            });
            notice("Nova vigência registrada.");
            await navigate("Parâmetros");
          },
          "Registrar parâmetro",
        ),
      ),
    );
  return node;
}
function listPager(node, data, view) {
  const offset = state.listOffsets[view] || 0;
  node.append(
    el(
      "div",
      { class: "toolbar" },
      offset > 0
        ? button("Página anterior", () => {
            state.listOffsets[view] = Math.max(0, offset - 50);
            return navigate(view);
          })
        : null,
      data.nextOffset !== null
        ? button("Próxima página", () => {
            state.listOffsets[view] = data.nextOffset;
            return navigate(view);
          })
        : null,
    ),
  );
}
async function campaignView() {
  const d = await api(`/api/campaigns?limit=50&offset=${state.listOffsets.Campanhas || 0}`),
    node = section("Campanhas", "Cada campanha reúne produto, mercado e cliente ideal. Ativar libera a busca; nenhum envio sai sem ficha aprovada.");
  const STATUS_TAG = { active: "tag ok", waiting: "tag warn", paused: "tag warn", draft: "tag", ended: "tag" };
  node.append(
    d.items.length
      ? rows(d.items, (c) =>
          el(
            "div",
            { class: "row" },
            el("div", {}, text("strong", c.name), text("small", `${c.market === "national" ? `Nacional · ${c.origin_city}/${c.origin_uf} · ${c.radius_km} km` : `Internacional · ${c.country_code}`} · versão ${c.version}`)),
            text("span", statusLabels[c.status], STATUS_TAG[c.status] || "tag"),
            button("Abrir", () => showCampaign(c.id)),
            moreMenu(
              "Mais ações",
              approver() && c.status !== "active"
                ? button("Ativar", async () => {
                    const r = await api(`/api/campaigns/${c.id}/activate`, "POST", { expectedVersion: c.version });
                    notice(r.campaign.status === "waiting" ? "Campanha em espera: duas commodities já estão ativas neste mercado." : "Campanha ativada.");
                    await navigate("Campanhas");
                  })
                : null,
              c.status === "active" && writable()
                ? button("Pausar", async () => {
                    await api(`/api/campaigns/${c.id}`, "PATCH", { expectedVersion: c.version, status: "paused" });
                    await navigate("Campanhas");
                  })
                : null,
            ),
          ),
        )
      : text("p", "Nenhuma campanha ainda. Crie a primeira abaixo.", "empty"),
  );
  listPager(node, d, "Campanhas");
  if (writable()) {
    const market = marketSelect("national");
    const national = { group: "Origem nacional", hint: "Cidade do fornecedor e raio da busca de compradores.", fields: [input("Cidade de origem nacional", "originCity", "text", "", false), input("UF nacional", "originUf", "text", "", false), select("Raio nacional", "radiusKm", [5, ...Array.from({ length: 15 }, (_, i) => (i + 1) * 100)].map((k) => [k, `${k} km`]))] };
    const foreign = { group: "País (internacional)", fields: [input("País internacional (código de 2 letras)", "countryCode", "text", "", false)] };
    const form = makeForm(
      [
        { group: "Produto e mercado", fields: [input("Nome", "name"), productSelect(), market] },
        national,
        foreign,
        {
          group: "Cliente ideal",
          fields: [
            input("Setores usuários, separados por vírgula", "userSectors"),
            select("Porte alvo", "sizeTarget", [["small_plus", "Pequeno ou maior"], ["medium", "Médio"], ["medium_plus", "Médio ou maior"]]),
            input("Região do cliente ideal", "region"),
            input("Cargo decisor", "decisionRole"),
            input("Cargo influenciador", "influencerRole"),
          ],
        },
        { group: "Dores de suprimento (opcional)", collapsed: true, fields: [input("Dores de suprimento", "supplyPains", "textarea", "", false)] },
      ],
      async (v) => {
        await api("/api/campaigns", "POST", {
          ...v,
          radiusKm: Number(v.radiusKm),
          icp: { userSectors: v.userSectors.split(",").map((x) => x.trim()).filter(Boolean), sizeTarget: v.sizeTarget, region: v.region, decisionRole: v.decisionRole, influencerRole: v.influencerRole, supplyPains: v.supplyPains },
        });
        notice("Campanha criada como rascunho.");
        await navigate("Campanhas");
      },
      "Criar campanha",
    );
    // Só o bloco do mercado escolhido fica visível.
    const [, natBox, forBox] = form.querySelectorAll("fieldset");
    const sync = () => {
      natBox.hidden = market.control.value !== "national";
      forBox.hidden = market.control.value === "national";
    };
    market.control.addEventListener("change", sync);
    sync();
    node.append(details("Criar campanha", form));
  }
  return node;
}

async function showCampaign(id) {
  const [d, hist] = await Promise.all([
      api(`/api/campaigns/${id}`),
      api(`/api/campaigns/${id}/declarations`),
    ]),
    c = d.campaign,
    icp = d.icp,
    sectors = icp ? JSON.parse(icp.user_sectors_json) : [],
    node = section(
      c.name,
      `${statusLabels[c.status]} · versão ${c.version} · ${c.market === "national" ? `${c.origin_city}/${c.origin_uf} · ${c.radius_km} km` : c.country_code}`,
    );
  node.append(
    button("Voltar às campanhas", () => navigate("Campanhas")),
    panel(
      "Cliente ideal (ICP)",
      icp
        ? kv([
            ["Setores usuários", sectors.join(", ")],
            ["Porte alvo", { small_plus: "Pequeno ou maior", medium: "Médio", medium_plus: "Médio ou maior" }[icp.size_target] || icp.size_target],
            ["Região", icp.region],
            ["Decisor", icp.decision_role],
            ["Influenciador", icp.influencer_role],
            ["Dores de suprimento", icp.supply_pains],
            ["Ciclo de compra (dias)", icp.buying_cycle_days],
            ["Atualizado por", `${icp.updated_by} em ${icp.updated_at}`],
          ])
        : text("p", "ICP ausente: a campanha não pode ser ativada.", "error"),
    ),
    panel(
      "Declarações comerciais",
      text(
        "p",
        "Frase de volume e prova social só entram nos textos com declaração aprovada e vigente.",
        "muted",
      ),
      rows(hist.items, (x) =>
        el(
          "div",
          { class: "row" },
          el(
            "div",
            {},
            text(
              "strong",
              x.kind === "volume_available"
                ? `Volume disponível: ${x.value_bool ? "sim" : "não"}`
                : "Prova social",
            ),
            x.text ? text("small", x.text) : null,
            text(
              "small",
              `Aprovada por ${x.approved_by} em ${x.approved_at}${x.review_due_at ? ` · válida até ${x.review_due_at}` : ""}`,
            ),
          ),
          text("span", x.status === "approved" ? "Vigente" : "Revogada", "tag"),
          approver() && x.status === "approved"
            ? button("Revogar", async () => {
                const reason = prompt("Motivo da revogação:");
                if (!reason) return;
                await api(`/api/campaigns/${id}/declarations/${x.id}/revoke`, "POST", {
                  expectedVersion: c.version,
                  reason,
                });
                notice("Declaração revogada.");
                await showCampaign(id);
              })
            : null,
        ),
      ),
    ),
  );
  if (writable() && c.status !== "ended")
    node.append(
      details(
        "Editar ICP",
        makeForm(
          [
            input("Setores usuários, separados por vírgula", "userSectors", "text", sectors.join(", ")),
            select(
              "Porte alvo",
              "sizeTarget",
              [
                ["small_plus", "Pequeno ou maior"],
                ["medium", "Médio"],
                ["medium_plus", "Médio ou maior"],
              ],
              icp?.size_target,
            ),
            input("Região do cliente ideal", "region", "text", icp?.region),
            input("Cargo decisor", "decisionRole", "text", icp?.decision_role),
            input("Cargo influenciador", "influencerRole", "text", icp?.influencer_role),
            input("Dores de suprimento", "supplyPains", "textarea", icp?.supply_pains || "", false),
            input("Ciclo de compra em dias", "buyingCycleDays", "number", icp?.buying_cycle_days ?? "", false),
          ],
          async (v) => {
            await api(`/api/campaigns/${id}/icp`, "PUT", {
              expectedVersion: c.version,
              icp: {
                userSectors: v.userSectors
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                sizeTarget: v.sizeTarget,
                region: v.region,
                decisionRole: v.decisionRole,
                influencerRole: v.influencerRole,
                supplyPains: v.supplyPains || null,
                buyingCycleDays: v.buyingCycleDays ? Number(v.buyingCycleDays) : null,
              },
            });
            notice("ICP salvo em nova versão da campanha.");
            await showCampaign(id);
          },
          "Salvar ICP",
        ),
      ),
    );
  if (approver() && c.status !== "ended")
    node.append(
      details(
        "Aprovar declaração",
        makeForm(
          [
            select("Tipo", "kind", [
              ["volume_available", "Volume disponível"],
              ["social_proof", "Prova social"],
            ]),
            select("Volume disponível confirmado", "valueBool", [
              ["true", "Sim"],
              ["false", "Não"],
            ]),
            input("Texto aprovado da prova social", "text", "textarea", "", false),
            input("Válida até (AAAA-MM-DD)", "reviewDueAt", "date", "", false),
          ],
          async (v) => {
            await api(`/api/campaigns/${id}/declarations`, "POST", {
              kind: v.kind,
              valueBool: v.kind === "volume_available" ? v.valueBool === "true" : undefined,
              text: v.kind === "social_proof" ? v.text : undefined,
              reviewDueAt: v.reviewDueAt || undefined,
              expectedVersion: c.version,
            });
            notice("Declaração aprovada.");
            await showCampaign(id);
          },
          "Aprovar",
        ),
      ),
    );
  showScreen(node);
}
const SUPPRESSION_REASON = { opt_out: "Pedido de descadastro", manual_request: "Pedido recebido manualmente", hard_bounce: "Falha definitiva de entrega", legacy_import: "Registro legado" };
const SUPPRESSION_SOURCE = { link: "link de descadastro", reply: "resposta", manual: "registro manual", openclaw: "importação", bounce: "falha de entrega" };
const CHANNEL_NAME = { email: "E-mail", phone: "Telefone", linkedin: "LinkedIn" };
async function suppressionView() {
  const node = section("Supressão", "Quem pediu para não ser contatado. O endereço é guardado só como código protegido (HMAC) e bloqueia qualquer envio a ele.");
  node.append(
    el(
      "div",
      { class: "callout" },
      text("p", "Retenção: cada registro fica mantido para não recontatar até a política da validação jurídica T11 — sem prazo e sem expiração automática. Remoção só pelo Administrador, com motivo e base; envios já cancelados não voltam."),
    ),
  );
  if (state.actor.role === "admin") {
    const [d, removals] = await Promise.all([
      api(`/api/suppression?limit=50&offset=${state.listOffsets["Supressão"] || 0}`),
      api("/api/suppression/removals?limit=50").catch(() => null),
    ]);
    const removeForm = (r) => {
      const ack = el("input", { type: "checkbox", name: "confirm", required: "" });
      const form = makeForm(
        [
          input("Motivo da remoção (ao menos 10 caracteres)", "reason", "textarea"),
          input("Base da remoção (ex.: pedido expresso da pessoa, com data e meio)", "basis"),
          { node: el("label", { class: "check" }, ack, "Entendo que esta pessoa volta a poder ser contatada neste canal e que envios cancelados não voltam."), control: ack },
        ],
        async (v) => {
          await api(`/api/suppression/${r.id}/remove`, "POST", { reason: v.reason, basis: v.basis, confirm: v.confirm === "on" });
          notice("Supressão removida e registrada no histórico.");
          await navigate("Supressão");
        },
        "Remover supressão",
      );
      return details("Remover (administrador)", form);
    };
    node.append(
      panel(
        `Registros ativos (${d.total ?? d.items.length})`,
        d.items.length
          ? rows(d.items, (r) =>
              el(
                "div",
                { class: "row" },
                el(
                  "div",
                  {},
                  text("strong", `${CHANNEL_NAME[r.channel] || r.channel} · ${SUPPRESSION_REASON[r.reason] || r.reason}`),
                  text("small", `${r.created_at ? fmtDate(r.created_at) : ""}${r.source ? ` · ${SUPPRESSION_SOURCE[r.source] || r.source}` : ""} · código ${String(r.identifier_hash).slice(0, 12)}…`),
                  text("small", `Alcance: ${r.scope_label || "canal inteiro"} · Retenção: ${r.retention_label || "até a política de T11"}`),
                ),
                text("span", "Bloqueado", "tag warn"),
                removeForm(r),
              ),
            )
          : text("p", "Nenhuma supressão registrada.", "empty"),
      ),
    );
    listPager(node, d, "Supressão");
    if (removals)
      node.append(
        details(
          `Histórico de remoções (${removals.items.length})`,
          removals.items.length
            ? rows(removals.items, (x) =>
                el(
                  "div",
                  { class: "row" },
                  el(
                    "div",
                    {},
                    text("strong", `${CHANNEL_NAME[x.channel] || x.channel} · ${SUPPRESSION_REASON[x.reason] || x.reason} · removida em ${fmtDate(x.removed_at)}`),
                    text("small", `Motivo: ${x.removal_reason}`),
                    text("small", `Base: ${x.removal_basis}`),
                    text("small", `Por ${x.removed_by === "system-admin" || /^user-/.test(x.removed_by) ? "Administrador" : x.removed_by} · registrada em ${fmtDate(x.entry_created_at)} · código ${String(x.identifier_hash).slice(0, 12)}…`),
                  ),
                  text("span", "Removida", "tag"),
                ),
              )
            : text("p", "Nenhuma remoção registrada.", "empty"),
        ),
      );
  } else node.append(text("p", "A lista e o histórico são visíveis só para administradores. Você pode registrar um pedido abaixo.", "muted"));
  if (writable())
    node.append(
      details(
        "Registrar supressão",
        makeForm(
          [
            select("Canal", "channel", [["email", "E-mail"], ["phone", "Telefone"], ["linkedin", "LinkedIn"]]),
            input("E-mail, telefone internacional ou URL do perfil", "value"),
            select("Motivo", "reason", Object.entries(SUPPRESSION_REASON)),
          ],
          async (v) => {
            const r = await api("/api/suppression", "POST", v);
            notice(`${r.created ? "Supressão registrada." : "Identificador já estava suprimido."}${r.tasksSuspended ? ` ${r.tasksSuspended} ligação(ões) com esse número foram suspensas.` : ""}`);
            await navigate("Supressão");
          },
          "Registrar supressão",
        ),
      ),
    );
  return node;
}

const PAUSE_SCOPE = { operation: "Toda a operação", company: "Empresa", campaign: "Campanha", commodity: "Commodity", offer: "Oferta" };
async function pausesView() {
  const d = await api(`/api/pauses?limit=50&offset=${state.listOffsets.Pausas || 0}`),
    node = section("Pausas", "Uma pausa impede envios e tarefas no escopo indicado até ser retomada, com motivo.");
  const active = d.items.filter((p) => !p.resumed_at),
    past = d.items.filter((p) => p.resumed_at);
  const row = (p) =>
    el(
      "div",
      { class: "row" },
      el("div", {}, text("strong", `${PAUSE_SCOPE[p.scope] || p.scope}${p.scope_ref ? ` · ${p.scope_ref}` : ""}`), text("small", p.reason), text("small", p.resumed_at ? `Retomada em ${fmtDate(p.resumed_at)}${p.resume_reason ? ` · ${p.resume_reason}` : ""}` : `Desde ${fmtDate(p.created_at)}`)),
      text("span", p.resumed_at ? "Retomada" : "Em pausa", p.resumed_at ? "tag" : "tag warn"),
      !p.resumed_at && writable()
        ? details(
            "Retomar",
            makeForm([input("Motivo da retomada", "reason")], async (v) => {
              await api(`/api/pauses/${p.id}/resume`, "POST", v);
              notice("Pausa retomada.");
              await navigate("Pausas");
            }, "Retomar"),
          )
        : null,
    );
  node.append(panel(`Em pausa (${active.length})`, active.length ? rows(active, row) : text("p", "Nenhuma pausa ativa.", "empty")));
  if (past.length) node.append(details(`Histórico (${past.length})`, rows(past, row)));
  listPager(node, d, "Pausas");
  if (writable())
    node.append(
      details(
        "Registrar pausa",
        makeForm(
          [
            select("Escopo", "scope", (approver() ? ["operation", "company", "campaign", "commodity"] : ["company", "campaign", "commodity"]).map((k) => [k, PAUSE_SCOPE[k]])),
            input("Identificador do escopo (vazio para operação)", "scopeRef", "text", "", false),
            input("Motivo", "reason", "textarea"),
          ],
          async (v) => {
            await api("/api/pauses", "POST", v);
            await navigate("Pausas");
          },
          "Registrar pausa",
        ),
      ),
    );
  return node;
}

// ---------- Piloto nacional (P2-T18): Radar, Fichas, Envios, Tarefas e painéis da empresa ----------
const pilotLabels = {
  in_icp: "No ICP",
  pending_size: "Porte pendente",
  out_trader: "Trader/distribuidor",
  out_giant: "Grande/grupo — candidata",
  out_small: "Micro — candidata",
  confirmed: "Dentro do raio",
  estimated: "Dentro (estimado)",
  outside: "Fora do raio",
  unknown: "Sem localização",
  address: "Endereço",
  municipality_centroid: "Centro do município",
  final_consumer_confirmed: "Consumidor final confirmado",
  possible_final_consumer: "Possível consumidor final",
  trader_distributor: "Trader/distribuidor",
  unconfirmed: "Perfil não confirmado",
  decision_maker: "Decisor",
  influencer: "Influenciador",
  provisional_decision_maker: "Decisor provisório",
  other: "Outro",
  pending: "Pendente",
  valid: "Validado",
  not_valid: "Inválido",
  catchall: "Não verificável (catch-all)",
  error: "Erro na validação",
  in_approval: "Em aprovação",
  approved: "Aprovada",
  deferred: "Adiada",
  discarded: "Descartada",
  queued: "Na fila",
  running: "Em andamento",
  partial: "Parcial",
  complete: "Completa",
  failed: "Falhou",
  leased: "Enviando",
  accepted: "Enviado",
  temp_failed: "Nova tentativa",
  perm_failed: "Recusado",
  indeterminate: "Indeterminado",
  blocked: "Bloqueado",
  waiting_sequence: "Aguardando outra sequência",
  cancelled: "Cancelado",
  superseded: "Substituído",
  planned: "Planejado",
  internal_test: "Teste interno",
  enabled: "Liberado",
};
const lbl = (v) => pilotLabels[v] || statusLabels[v] || v || "Não informado";

async function campaignsOf(market) {
  const d = await api("/api/campaigns?limit=100");
  return d.items.filter((c) => !market || c.market === market);
}

// Empresa: unidades, perfis, validação de e-mail e criação de ficha.
async function pilotPanels(id, data) {
  const nodes = [];
  nodes.push(
    panel(
      "Unidades",
      rows(data.units || [], (u) =>
        el(
          "div",
          { class: "row" },
          el("div", {}, text("strong", `CNPJ ${u.cnpj}`), text("small", `${u.municipality_name || "Município não informado"}/${u.uf || "—"} · ${lbl(u.geo_precision)} · porte ${u.size_label || "não informado"}`)),
          text("span", u.source_label, "tag"),
        ),
      ),
    ),
  );
  nodes.push(
    panel(
      "Perfil comprador e ICP",
      rows(data.profiles || [], (p) =>
        el(
          "div",
          { class: "row" },
          el(
            "div",
            {},
            text("strong", `${state.products.find((x) => x.id === p.product_id)?.variant_name || p.product_id} · ${lbl(p.profile_class)}`),
            text("small", p.ficha.ok ? p.ficha.note || "Pode receber ficha." : p.ficha.reason),
          ),
          text("span", lbl(p.icp_status), "tag"),
          p.icp_status === "out_trader" && approver() && !p.exception_by
            ? button("Registrar exceção", async () => {
                const reason = prompt("Motivo da exceção (trader com consumo próprio comprovado):");
                if (!reason) return;
                await api(`/api/profiles/${p.id}`, "PATCH", { exceptionReason: reason, expectedRevision: p.revision });
                await showCompany(id);
              })
            : null,
          p.icp_status === "out_giant" && writable() && !p.relationship_note
            ? button("Registrar relacionamento", async () => {
                const note = prompt("Relacionamento prévio (quem, desde quando, como):");
                if (!note) return;
                await api(`/api/profiles/${p.id}`, "PATCH", { relationshipNote: note, expectedRevision: p.revision });
                await showCompany(id);
              })
            : null,
          p.icp_status === "pending_size" && writable() && !p.size_call_goal
            ? button("Esclarecer o porte no primeiro contato (ligação ou e-mail)", async () => {
                await api(`/api/profiles/${p.id}`, "PATCH", { sizeCallGoal: true, expectedRevision: p.revision });
                await showCompany(id);
              })
            : null,
        ),
      ),
    ),
  );
  if (!writable()) return nodes;
  nodes.push(
    details(
      "Registrar perfil comprador",
      makeForm(
        [
          productSelect(),
          select("Perfil", "profileClass", ["possible_final_consumer", "final_consumer_confirmed", "trader_distributor", "unconfirmed"].map((k) => [k, lbl(k)])),
          input("Fundamento (evidência ou pendência)", "basis", "textarea"),
          select("Evidência que confirma (consumidor final confirmado)", "evidenceId", [["", "Nenhuma"], ...data.evidence.filter((e) => e.category === "business").map((e) => [e.id, `${e.evidence_type} · ${e.reference}`])]),
          select("Gigante do setor", "isGiant", [["false", "Não"], ["true", "Sim"]]),
        ],
        async (v) => {
          const prev = (data.profiles || []).find((p) => p.product_id === v.productId && p.unit_key === "");
          await api(`/api/companies/${id}/profiles`, "POST", {
            productId: v.productId, profileClass: v.profileClass, basis: v.basis, evidenceId: v.evidenceId || undefined,
            isGiant: v.isGiant === "true", expectedRevision: prev?.revision,
          });
          notice("Perfil registrado.");
          await showCompany(id);
        },
        "Registrar perfil",
      ),
    ),
  );
  const withEmail = data.contacts.filter((c) => c.email);
  if (withEmail.length)
    nodes.push(
      el(
        "div",
        { class: "toolbar" },
        button("Validar e-mails dos contatos", async () => {
          const r = await api(`/api/companies/${id}/validate-emails`, "POST", {});
          notice(r.started ? `Validação iniciada para ${r.started} contato(s). O resultado chega em alguns minutos.` : "Nenhum contato precisa de validação agora.");
        }),
      ),
    );
  const campaigns = (await campaignsOf()).filter((c) => ["active", "waiting"].includes(c.status));
  const eligible = data.contacts.filter((c) => ["decision_maker", "influencer", "provisional_decision_maker"].includes(c.prospectRole) && c.email);
  if (campaigns.length && eligible.length) {
    const boxes = eligible.map((c) => {
      const control = el("input", { type: "checkbox", name: "recipients", value: c.id });
      return { node: el("label", { class: "check" }, control, `${c.fullName} — ${lbl(c.prospectRole)}${c.targetFlag ? " (atenção: cargo fora do alvo)" : ""}`), control };
    });
    const form = makeForm(
      [select("Campanha", "campaignId", campaigns.map((c) => [c.id, c.name])), ...boxes],
      async (v) => {
        const recipients = boxes.filter((b) => b.control.checked).map((b) => b.control.value);
        const r = await api("/api/fichas", "POST", { companyId: id, campaignId: v.campaignId, recipients });
        notice(r.reviewOk ? "Ficha gerada sem violações do revisor." : "Ficha gerada com violações do revisor: corrija antes de aprovar.");
        await showFicha(r.id);
      },
      "Gerar ficha",
    );
    nodes.push(details("Gerar ficha de aprovação", form));
  }
  return nodes;
}

// Radar nacional: setores → CNAE, busca por campanha, cobertura e candidatos.


// Fichas: aprovação por destinatário e canal, com o hash do que está na tela.
async function fichasView() {
  const d = await api("/api/fichas?limit=100");
  const node = section("Fichas", "Textos congelados por versão. Aprovar vale para o destinatário e o canal mostrados; qualquer mudança exige nova versão.");
  // Aguardando aprovação primeiro; cada uma com a ação que cabe a ela.
  const order = { in_approval: 0, draft: 1, approved: 2, deferred: 3, discarded: 4 };
  const items = [...d.items].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  node.append(
    panel(
      `Fichas (${d.items.length})`,
      rows(items, (f) =>
        el(
          "div",
          { class: "row" },
          el("div", {}, text("strong", f.legal_name), text("small", `Versão ${f.current_version} · atualizada em ${fmtDate(f.updated_at)}`)),
          text("span", f.status === "in_approval" ? "Aguardando aprovação" : lbl(f.status), f.status === "in_approval" ? "tag warn" : f.status === "approved" ? "tag ok" : "tag"),
          f.status === "in_approval" && approver() ? button("Revisar e aprovar", () => showFicha(f.id), true) : button("Abrir", () => showFicha(f.id)),
        ),
      ),
    ),
  );
  return node;
}

const COPY_LABEL = { pending: "aguardando envio", leased: "enviando", accepted: "aceita pelo servidor", temp_failed: "falha temporária (nova tentativa)", permanent_failed: "falhou — verificar", indeterminate: "resultado incerto — verificar nos enviados" };
async function showFicha(id) {
  const d = await api(`/api/fichas/${id}`);
  const v = d.version;
  // Os bloqueios da aprovação vêm calculados pelo servidor (d.approvalGates).
  const company = await api(`/api/companies/${d.ficha.company_id}`);
  const contactOf = (cid) => company.contacts.find((x) => x.id === cid);
  const recipientOf = (cid) => v.snapshot.recipients.find((x) => x.contactId === cid);
  const channelName = (ch) => (ch === "email" ? "E-mail" : ch === "call" ? "Ligações" : "LinkedIn");
  const open = !["discarded", "deferred"].includes(d.ficha.status);
  const approvedGroups = d.toApprove.filter((g) => d.approvals.some((a) => a.contact_id === g.contactId && a.channel === g.channel && a.status === "approved")).length;
  const bad = v.findings.filter((x) => !x.ok);
  const node = section("Ficha para aprovação", `${company.company.legal_name} · versão ${v.no}`);
  node.append(
    el(
      "div",
      { class: "toolbar" },
      button("Voltar às fichas", () => navigate("Fichas")),
      button("Abrir empresa", () => openCompanyPanel(d.ficha.company_id, company.company.legal_name)),
      writable() && d.ficha.status !== "discarded"
        ? moreMenu(
            "Outras ações",
            button("Gerar nova versão", async () => {
              const r = await api(`/api/fichas/${id}/versions`, "POST", { expectedRowVersion: d.ficha.row_version });
              notice(r.reviewOk ? "Nova versão sem violações." : "Nova versão com violações do revisor.");
              await showFicha(id);
            }),
            button("Adiar", async () => {
              const reason = prompt("Motivo do adiamento:");
              if (!reason) return;
              await api(`/api/fichas/${id}/defer`, "POST", { reason });
              await showFicha(id);
            }),
            approver()
              ? button("Descartar", async () => {
                  const reason = prompt("Motivo do descarte:");
                  if (!reason) return;
                  await api(`/api/fichas/${id}/discard`, "POST", { reason });
                  await showFicha(id);
                })
              : null,
          )
        : null,
    ),
  );
  const item = (k, val, extra) => el("div", {}, text("span", k, "k"), text("strong", val), extra ? text("small", extra) : null);
  node.append(
    el(
      "div",
      { class: "company-summary" },
      item("Situação", lbl(d.ficha.status), d.ficha.status_reason || null),
      item("Aprovações", `${approvedGroups} de ${d.toApprove.length}`, "Cada destinatário e canal é aprovado à parte."),
      item("Finalidade e idioma", `${v.purpose === "identify_buyer" ? "Identificar o responsável" : "Reunião com o comprador"} · ${String(v.language || "").toUpperCase()}`),
      item("Revisor PV", bad.length ? `${bad.length} violação(ões)` : "Sem violações", `modelos ${v.templates}`),
      // D5-a: cópia interna separada de cada e-mail aceito, ao endereço fixo do contrato (parâmetro só do Administrador).
      item("Cópia interna", d.internalCopy?.enabled ? d.internalCopy.address : "Desligada", d.internalCopy?.enabled ? "Mensagem separada, sem o link de descadastro do destinatário (contrato de franquia)." : "Nenhuma cópia é enviada."),
    ),
  );
  // Condições que o servidor confere na aprovação (lista calculada por ele, na mesma ordem); ele confere de novo ao aprovar.
  const g = d.approvalGates;
  const who = (cid) => contactOf(cid)?.fullName || "destinatário";
  const checks = [
    ...g.gates.map((x) => [x.label, x.ok, x.why]),
    ...g.recipients.flatMap((r) => r.approve.map((x) => [`${x.label} — ${who(r.contactId)}`, x.ok, x.why])),
  ];
  const sendChecks = g.recipients.flatMap((r) => r.send.map((x) => [`${x.label} — ${who(r.contactId)}`, x.ok, x.why]));
  const missing = checks.filter(([, ok]) => !ok);
  const list = (rows) => el("ul", { class: "checklist" }, ...rows.map(([label, ok, why]) => el("li", {}, text("span", ok ? "ok" : "pendente", ok ? "tag ok" : "tag warn"), el("span", {}, label, !ok ? text("small", why) : null))));
  node.append(
    panel(
      "Antes de aprovar",
      list(checks),
      text("p", missing.length ? `A aprovação será recusada enquanto houver pendência (${missing.length}).` : "Nada impede a aprovação; o servidor confere tudo de novo no momento de aprovar.", "muted"),
      sendChecks.length ? details("Para o envio, depois da aprovação", el("div", {}, list(sendChecks), text("p", "Não impedem aprovar; seguram cada envio até estarem em dia.", "muted"))) : null,
    ),
  );
  const pv = panel("Revisor PV");
  if (bad.length) pv.append(el("div", { class: "callout warn" }, text("p", "Violações encontradas: esta versão não pode ser aprovada."), el("ul", {}, ...bad.map((x) => el("li", {}, text("strong", x.id), ` ${x.detail}`)))));
  else pv.append(text("p", "Sem violações nos textos desta versão.", "success"));
  if (v.snapshot.fichaNote) pv.append(el("div", { class: "callout" }, text("p", v.snapshot.fichaNote)));
  pv.append(details(`Regras conferidas (${v.findings.length})`, el("ul", { class: "plain-list" }, ...v.findings.map((x) => el("li", {}, `${x.ok ? "ok" : "violação"} · ${x.id}${x.detail ? ` — ${x.detail}` : ""}`)))));
  node.append(pv);
  for (const g of d.toApprove) {
    const msgs = d.messages.filter((m) => m.contactId === g.contactId && m.channel === g.channel);
    const approved = d.approvals.find((a) => a.contact_id === g.contactId && a.channel === g.channel);
    const k = contactOf(g.contactId);
    const r = recipientOf(g.contactId);
    const box = el(
      "section",
      { class: "panel" },
      el(
        "div",
        { class: "panel-head" },
        el("div", {}, text("h2", `${channelName(g.channel)} · ${k?.fullName || g.contactId.slice(0, 8)}`), text("small", `${lbl(r?.role)}${k?.jobTitle ? ` · ${k.jobTitle}` : ""}${r?.targetFlag ? " · cargo fora do alvo" : ""} · ${k?.timezone ? `fuso ${k.timezone}` : "fuso não confirmado"}`, "muted")),
        approved
          ? text("span", approved.status === "approved" ? "Aprovado" : "Aprovação invalidada", approved.status === "approved" ? "tag ok" : "tag bad")
          : text("span", "Aguardando aprovação", "tag warn"),
      ),
    );
    msgs.forEach((m, i) => {
      // Saudação pelo horário (A-ID8): os dois textos aparecem e são aprovados juntos; o envio escolhe pelo horário local.
      const msg = m.morning
        ? details(
            `Dia ${m.day} · passo ${m.step}${m.subject ? " · " + m.subject : ""}`,
            el(
              "div",
              {},
              text("p", "A partir das 12:00 no fuso do destinatário:", "muted"),
              el("pre", { class: "message" }, m.body),
              text("p", "Antes das 12:00 no fuso do destinatário (só a saudação muda):", "muted"),
              el("pre", { class: "message" }, m.morning.body),
            ),
          )
        : details(`Dia ${m.day} · passo ${m.step}${m.subject ? " · " + m.subject : ""}`, el("pre", { class: "message" }, m.body));
      if (i === 0 && !approved) msg.open = true;
      box.append(msg);
    });
    if (approved) box.append(text("p", `${approved.status === "approved" ? "Aprovado" : "Aprovação invalidada"} por ${approved.approved_by} em ${fmtDate(approved.approved_at)}`, "muted"));
    else if (approver() && v.reviewOk) {
      if (!k?.timezone) box.append(el("div", { class: "callout warn" }, text("p", "Fuso do destinatário não confirmado: a aprovação será recusada. Confirme o fuso no contato (empresa › Contatos e pessoas).")));
      box.append(
        el(
          "div",
          { class: "approve" },
          text("p", `A aprovação vale exatamente para ${msgs.length === 1 ? "o texto acima" : `os ${msgs.length} ${msgs.some((m) => m.morning) ? "passos" : "textos"} acima`}${msgs.some((m) => m.morning) ? ", incluindo as duas saudações (Bom dia antes das 12:00, Boa tarde a partir das 12:00)" : ""} (versão ${v.no}). Qualquer mudança gera nova versão e pede nova aprovação; no envio nada é regenerado.`, "muted"),
          makeForm(
            [input("Início da cadência (segunda-feira, AAAA-MM-DD)", "startDate", "date", "", false)],
            async (x) => {
              await api(`/api/fichas/${id}/approve`, "POST", { versionNo: v.no, contactId: g.contactId, channel: g.channel, messagesSha256: g.messagesSha256, startDate: x.startDate || undefined });
              notice("Aprovado.");
              await showFicha(id);
            },
            "Aprovar este destinatário neste canal",
          ),
        ),
      );
    }
    node.append(box);
  }
  if (d.outbox.length)
    node.append(panel("Envios desta ficha", rows(d.outbox, (o) => el("div", { class: "row" }, el("div", {}, text("strong", `Passo ${o.step_no} · ${o.planned_date}`), o.block_reason ? text("small", o.block_reason) : null, o.copy ? text("small", `Cópia interna: ${COPY_LABEL[o.copy.status] || o.copy.status}${o.copy.evidence ? ` — ${o.copy.evidence}` : ""}`) : null), text("span", lbl(o.status), "tag")))));
  node.append(details("Dados técnicos da versão", kv([["Skill", v.skill], ["Modelos", v.templates], ["Gerador", v.generator], ["Criada por", d.ficha.created_by]])));
  showScreen(node);
}

// Envios: rampa, teto, próximo horário, fila e bloqueios; respostas recebidas.
async function enviosView() {
  const [t, inbound] = await Promise.all([api("/api/sending/today"), api("/api/inbound?limit=30")]);
  const node = section("Envios", "Um e-mail por vez, no horário comercial do destinatário. Nada sai sem ficha aprovada.");
  const channelText = { planned: "Planejado: nenhum envio comercial", internal_test: "Teste interno: só destinatários internos", enabled: "Liberado" }[t.channel] || lbl(t.channel);
  const item = (k, v, extra) => el("div", {}, text("span", k, "k"), text("strong", v), extra ? text("small", extra) : null);
  node.append(
    el(
      "div",
      { class: "company-summary" },
      item("Canal de e-mail", channelText),
      item("Hoje", `${t.sentToday} enviado(s)`, `teto ${t.dailyCap ?? "sem parâmetro"} · degrau ${t.rampStep + 1} da rampa`),
      item("Próximo envio", t.nextSendAt ? fmtDate(t.nextSendAt) : "Agora, dentro da janela"),
      item("Parada automática", t.stopped ? "Ativa" : "Não", t.stopped ? null : "Para sozinha se a leitura das respostas falhar."),
    ),
  );
  if (t.stopped) node.append(el("div", { class: "callout warn" }, el("p", {}, text("strong", "Envios parados. "), `${t.stopped.reason} (${fmtDate(t.stopped.at)})`)));
  // Fila: o que precisa de decisão primeiro; agendados depois.
  const attention = t.queue.filter((o) => ["indeterminate", "blocked", "perm_failed"].includes(o.status));
  const scheduled = t.queue.filter((o) => !attention.includes(o));
  const row = (o) =>
    el(
      "div",
      { class: "row" },
      el("div", {}, text("strong", o.legal_name), text("small", `Passo ${o.step_no} · ${o.planned_date}`), o.block_reason ? text("small", `Motivo: ${o.block_reason}`) : null),
      text("span", lbl(o.status), ["indeterminate", "blocked", "perm_failed"].includes(o.status) ? "tag warn" : o.status === "accepted" ? "tag ok" : "tag"),
      // Resolver indeterminado é decisão de administrador, com evidência; fica recolhido no próprio item.
      o.status === "indeterminate" && admin()
        ? details(
            "Resolver (administrador)",
            makeForm(
              [
                select("Resultado conferido na caixa", "outcome", [["sent", "Saiu (está em Enviados)"], ["not_sent", "Não saiu"], ["cancel", "Cancelar este passo"]]),
                input("Evidência (ex.: conferido na pasta Enviados)", "reason"),
              ],
              async (v) => {
                await api(`/api/sending/outbox/${o.id}/resolve`, "POST", v);
                notice("Decisão registrada.");
                await navigate("Envios");
              },
              "Registrar decisão",
            ),
          )
        : null,
    );
  node.append(
    panel(`Precisa de decisão (${attention.length})`, attention.length ? rows(attention, row) : text("p", "Nada parado. Indeterminado só volta com decisão registrada.", "muted")),
    panel(`Agendados (${scheduled.length})`, scheduled.length ? rows(scheduled, row) : text("p", "Nenhum envio agendado. Os envios aparecem aqui depois que uma ficha é aprovada.", "empty")),
  );
  const classText = { human: "Resposta de pessoa", auto_reply: "Resposta automática", bounce_hard: "Falha definitiva", bounce_soft: "Falha temporária", unsubscribe: "Descadastro", provider_alert: "Alerta do provedor", unclassified: "A classificar" };
  node.append(
    panel(
      `Respostas recebidas (${inbound.items.length})`,
      inbound.items.length
        ? rows(inbound.items, (m) =>
            el(
              "div",
              { class: "row" },
              el("div", {}, text("strong", m.legal_name || "Remetente sem empresa ligada"), text("small", `${fmtDate(m.received_at)} · ${m.correlation}`)),
              text("span", classText[m.classification] || m.classification, m.classification === "human" ? "tag ok" : ["unsubscribe", "bounce_hard"].includes(m.classification) ? "tag warn" : "tag"),
            ),
          )
        : text("p", "Nenhuma resposta registrada.", "empty"),
    ),
  );
  return node;
}

// Tarefas: o que vence hoje primeiro; bloqueadas à parte, com o motivo. Roteiro e registro ficam no próprio item.
// Motivos de bloqueio mais comuns em texto; os demais aparecem pelo código.
const BLOCK_LABEL = {
  suppressed_phone: "telefone suprimido (oposição)",
  suppressed: "e-mail suprimido",
  phone_missing: "sem telefone definido",
  phone_ambiguous: "telefones divergentes entre as fontes: escolha o número",
  phone_unrecognized: "telefone sem código do país: confira o número",
  t11_pending: "T11 pendente (validação do contato real para este país e canal)",
  compliance_unavailable: "triagem de sanções ausente ou vencida para a empresa",
  campaign_not_active: "campanha inativa",
};
const CALL_KINDS = ["call_l0", "call_l1", "call_l2"];
// Avisos D-EXC (sem identidade): orientam o operador; não garantem que a pessoa não será reencontrada.
const NOTICE_KIND = {
  erasure_shared_phone: "Pedido de exclusão de uma pessoa desta empresa: pedir o setor sem citar nomes antigos",
  opposition_shared_phone: "Oposição de uma pessoa pelo número geral: não ampliar à empresa; não insistir com quem se opôs",
};
const NOTICE_CLASS = {
  shared: "número geral da empresa",
  extension: "ramal atrás do número geral",
  unconfirmed: "classificação não confirmada (tratado como compartilhado; não prova que o número é comercial)",
  conflict: "marcado como pessoal, mas usado por outros registros (não suprimido; a conferir)",
};
const noticeLine = (n) => `Aviso (${(n.created_at || "").slice(0, 10)}): ${NOTICE_KIND[n.kind] || n.kind} — ${NOTICE_CLASS[n.classification] || n.classification}${n.pending ? " · pendente" : ""}`;
const TASK_KIND = { call_l0: "Ligação (nível 0)", call_l1: "Ligação (nível 1)", call_l2: "Ligação (nível 2)", linkedin: "LinkedIn", reply_followup: "Responder", meeting_confirm: "Confirmar reunião", return_suggested: "Retorno sugerido", provider_alert: "Alerta do provedor", review_ambiguous: "Revisar resposta" };
async function tarefasView() {
  const today = new Date().toISOString().slice(0, 10);
  const d = await api(`/api/tasks?until=${today}&limit=100`);
  // Suspensas (oposição por telefone, resposta recebida etc.) ficam à vista com o motivo; não voltam sozinhas.
  const suspended = (await api(`/api/tasks?until=9999-12-31&status=suspended&limit=100`)).items;
  const node = section("Tarefas", "Respostas e confirmações primeiro; ligações começam pelos leads mais fracos. Tarefa bloqueada não é concluída.");
  const blocked = d.items.filter((t) => t.blocked?.length);
  const open = d.items.filter((t) => !t.blocked?.length);
  const card = (t) => {
    const box = el(
      "div",
      { class: "row task" },
      el(
        "div",
        {},
        text("strong", t.legal_name),
        el("div", { class: "tags" }, text("span", TASK_KIND[t.kind] || t.kind, "tag"), text("span", t.due_date < today ? `Atrasada (${t.due_date})` : `Vence ${t.due_date === today ? "hoje" : t.due_date}`, t.due_date < today ? "tag warn" : "tag")),
        t.blocked?.length ? text("small", `Bloqueada: ${t.blocked.map((b) => BLOCK_LABEL[b] || b).join(", ")}`) : null,
        t.status === "suspended" ? text("small", `Suspensa: ${t.suspended_reason || "sem motivo registrado"}`) : null,
      ),
    );
    if (t.phone) box.append(text("p", `Telefone da ligação: ${t.phone}${t.phone_source ? ` — fonte: ${t.phone_source}` : ""}`));
    else if (CALL_KINDS.includes(t.kind) && t.phone_source) box.append(text("p", `Telefone pendente: ${t.phone_source}`));
    for (const n of t.notices || []) box.append(text("p", noticeLine(n), "notice-line"));
    if (t.channel_note) box.append(text("p", `Canal: ${t.channel_note}`));
    if (t.next_action) box.append(text("p", `Próxima ação: ${t.next_action}`));
    if (t.script) box.append(details("Roteiro", el("pre", { class: "message" }, t.script)));
    // Edição só de tarefa manual sem ficha (texto de ficha aprovada é congelado); não conclui nem libera a ligação.
    if (writable() && t.status === "open" && !t.ficha_id && ["call_l0", "call_l1", "call_l2", "linkedin"].includes(t.kind))
      box.append(
        details(
          "Editar roteiro, canal ou próxima ação",
          makeForm(
            [
              input("Telefone da ligação (+55 DDD número; a supressão é conferida por ele)", "phone", "tel", t.phone || "", false),
              input("Fonte do telefone (onde está publicado e data; obrigatória ao trocar o número)", "phoneSource", "text", "", false),
              input("Canal (com fonte e data)", "channelNote", "text", t.channel_note || "", false),
              input("Próxima ação", "nextAction", "text", t.next_action || "", false),
              input("Data", "dueDate", "date", t.due_date, true),
              (() => { const f = input("Roteiro", "script", "textarea", t.script || "", false); f.control.setAttribute("maxlength", "8000"); return f; })(),
              input("Motivo da alteração", "reason", "text", "", true),
            ],
            async (v) => {
              const r = await api(`/api/tasks/${t.id}`, "PATCH", { expectedRevision: t.revision, reason: v.reason, phone: v.phone || null, phoneSource: v.phoneSource || undefined, channelNote: v.channelNote || null, nextAction: v.nextAction || null, dueDate: v.dueDate, script: v.script || null });
              notice(r.suspended ? "Tarefa atualizada e suspensa: o telefone informado está na lista de supressão." : "Tarefa atualizada; o histórico guarda o valor anterior.");
              await navigate("Tarefas");
            },
            "Salvar alteração",
          ),
        ),
      );
    if (writable() && t.status === "open" && t.ficha_id && CALL_KINDS.includes(t.kind))
      box.append(
        details(
          t.phone ? "Trocar o telefone da ligação" : "Definir o telefone da ligação",
          makeForm(
            [
              input("Telefone (+55 DDD número)", "phone", "tel", t.phone || "", true),
              input("Fonte do telefone (onde está publicado e data)", "phoneSource", "text", "", true),
              input("Motivo", "reason", "text", "", true),
            ],
            async (v) => {
              const r = await api(`/api/tasks/${t.id}`, "PATCH", { expectedRevision: t.revision, reason: v.reason, phone: v.phone, phoneSource: v.phoneSource });
              notice(r.suspended ? "Telefone definido; a ligação foi suspensa porque o número está na lista de supressão." : "Telefone definido; o roteiro da ficha não mudou.");
              await navigate("Tarefas");
            },
            "Salvar telefone",
          ),
        ),
      );
    // Oposição: grava o resultado da conversa mesmo com a ligação suspensa ou bloqueada. Só número pessoal ou ramal com
    // discagem direta é suprimido; número geral, ramal atrás do geral ou "não confirmado" viram aviso na empresa.
    if (writable() && CALL_KINDS.includes(t.kind) && ["open", "suspended"].includes(t.status))
      box.append(
        details(
          "Registrar oposição (não quer ser contatado)",
          makeForm(
            [
              select("Tipo do número desta ligação", "phoneKind", [
                ["", "Não confirmado (não suprime; registra aviso pendente)"],
                ["personal", "Pessoal da pessoa (suprime o número)"],
                ["direct_line", "Ramal com discagem direta, número próprio (suprime o número)"],
                ["shared", "Número geral da empresa (não suprime; aviso na empresa)"],
                ["extension", "Ramal atrás do número geral (não suprime; aviso na empresa)"],
              ]),
              input("O que foi dito (nota da conversa)", "note", "textarea", "", false),
            ],
            async (v) => {
              const r = await api(`/api/tasks/${t.id}/complete`, "POST", { outcome: "opposed", note: v.note || undefined, phoneKind: v.phoneKind || undefined });
              notice(
                r.suppressed
                  ? `Oposição registrada: número suprimido${r.tasksSuspended ? `; ${r.tasksSuspended} outra(s) ligação(ões) suspensa(s)` : ""}.`
                  : r.notice
                    ? "Oposição registrada com aviso na empresa; o número geral não foi suprimido."
                    : "Oposição registrada. A tarefa não tinha telefone: registre a supressão pelo número em Configurações.",
              );
              await navigate("Tarefas");
            },
            "Registrar oposição",
          ),
        ),
      );
    if (writable() && t.status === "open" && !t.blocked?.length)
      box.append(
        details(
          "Registrar resultado",
          makeForm(
            [
              select("Resultado", "outcome", [["done", "Feito"], ["no_answer", "Não atendeu"], ["not_reached", "Não falei com a pessoa"], ["wrong_contact", "Contato errado"]]),
              {
                group: "Respostas da conversa (opcional)",
                collapsed: true,
                fields: [
                  select("Compra de usina ou trading?", "buyingChannel", [["", "Não perguntado"], ["usina", "Usina"], ["trading", "Trading"], ["ambos", "Ambos"]]),
                  select("Spot ou contrato?", "modality", [["", "Não perguntado"], ["spot", "Spot"], ["contrato", "Contrato"], ["ambos", "Ambos"]]),
                  input("Consumo mensal (t)", "monthlyVolumeT", "number", "", false),
                ],
              },
              input("Nota", "note", "textarea", "", false),
            ],
            async (v) => {
              const answers = {};
              if (v.buyingChannel) answers.buyingChannel = v.buyingChannel;
              if (v.modality) answers.modality = v.modality;
              if (v.monthlyVolumeT) answers.monthlyVolumeT = Number(v.monthlyVolumeT);
              await api(`/api/tasks/${t.id}/complete`, "POST", { outcome: v.outcome, note: v.note || undefined, answers });
              notice("Tarefa registrada.");
              await navigate("Tarefas");
            },
            "Registrar",
          ),
        ),
      );
    return box;
  };
  node.append(panel(`Para fazer (${open.length})`, open.length ? rows(open, card) : text("p", "Nenhuma tarefa para hoje.", "empty")));
  if (blocked.length) node.append(details(`Bloqueadas (${blocked.length}) — aguardam a condição indicada`, rows(blocked, card)));
  if (suspended.length) node.append(details(`Suspensas (${suspended.length}) — não voltam sozinhas`, rows(suspended, card)));
  return node;
}

// ---------- Internacional (P3-T11): lista mensal por país, análise, seleção e empresas no exterior ----------
const NOTICE_R142 = "O dado confirma exportação do Brasil para o país; não comprova compra por nenhuma empresa específica.";
const tradeLabels = {
  purchase_identified: "compra identificada",
  no_record: "nenhum registro no período",
  data_unavailable: "dados indisponíveis",
  not_declared: "sem declaração do país à fonte",
  pending: "em atualização",
};
const tl = (v) => tradeLabels[v] || (v ? v : "lista ainda não gerada");
const usd = (v) => (v == null ? "—" : `US$ ${Math.round(v).toLocaleString("pt-BR")}`);
const kg = (v) => (v == null ? "—" : `${Math.round(v).toLocaleString("pt-BR")} kg`);
const conditionLabels = { imports_from_brazil: "Importa do Brasil", buys_commodity: "Compra a commodity", consumes_as_input: "Consome como insumo" };

// Radar Internacional: lista básica de países importadores → resumo curto do país → commodity → busca de empresas.
const commodityNames = (list) => (list?.length ? list.map((c) => c.name || c.hs6).join(" · ") : "—");
const periodText = (p) => (!p ? "período indisponível" : p.from === p.to ? p.to : `${p.from} a ${p.to}`);
function importerSource(src, title) {
  if (src.state !== "purchase_identified")
    return text("small", `${title}: ${src.label}${src.period ? ` (${periodText(src.period)})` : ""}${src.staleSince ? ` · não atualizado em ${src.staleSince}` : ""}`);
  return text("small", `${title} · ${periodText(src.period)} · ${commodityNames(src.commodities)}${src.hs6Count > src.commodities.length ? ` e mais ${src.hs6Count - src.commodities.length}` : ""}${src.staleSince ? ` · não atualizado em ${src.staleSince}` : ""}`);
}

async function internacionalView(query = "", all = false) {
  const node = section("Radar Internacional", "Escolha o país e a commodity; depois encontre as empresas compradoras e os responsáveis por compras.");
  node.setAttribute("data-screen", "internacional");
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (!all) params.set("purchase", "1");
  const [d, searches, hist] = await Promise.all([api(`/api/radar/importers?${params}`), api("/api/foreign-searches"), api("/api/country-analyses")]);
  // Trabalho em andamento primeiro: buscas de empresas já autorizadas.
  const open = searches.items.filter((x) => x.status === "open");
  if (searches.items.length)
    node.append(
      panel(
        open.length ? `Continuar buscas de empresas (${open.length} aberta(s))` : "Buscas de empresas",
        rows(searches.items, (x) =>
          el(
            "div",
            { class: "row" },
            el("div", {}, text("strong", `${x.country} · ${x.commodity}`), text("small", `autorizada em ${fmtDate(x.authorized_at).slice(0, 10)} · ${x.candidates} empresa(s) · ${x.sources} fonte(s) consultada(s)`)),
            text("span", x.status === "open" ? "Aberta" : "Encerrada", x.status === "open" ? "tag ok" : "tag"),
            button("Abrir", () => showForeignSearch(x.id)),
          ),
        ),
      ),
    );
  const search = el("input", { type: "search", name: "q", "aria-label": "Buscar país", placeholder: "Buscar país (ex.: Alemanha)", value: query });
  const showAll = el("input", { type: "checkbox", name: "all", "aria-label": "Mostrar também países sem compra identificada" });
  showAll.checked = all;
  const form = el("form", { class: "toolbar", role: "search" }, search, el("label", { class: "check" }, showAll, "incluir países sem compra identificada"), el("button", { type: "submit" }, "Buscar"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    safe(async () => showScreen(await internacionalView(search.value.trim(), showAll.checked)));
  });
  const shown = d.items.slice(0, 80);
  node.append(
    panel(
      `Países importadores do Brasil (${d.items.length})`,
      text("p", d.notice, "notice-fixed"),
      form,
      rows(shown, (c) =>
        el(
          "div",
          { class: "row" },
          el(
            "div",
            {},
            text("strong", `${c.name} (${c.iso3})`),
            importerSource(c.sources.mdic, "MDIC — exportações do Brasil (FOB)"),
            importerSource(c.sources.comtrade, "Comtrade — importações declaradas, origem Brasil (CIF)"),
          ),
          button("Escolher", async () => {
            const a = await api("/api/country-analyses", "POST", { iso3: c.iso3 });
            await showAnalysis(a.id, a);
          }),
        ),
      ),
      d.items.length > shown.length ? text("p", `Mostrando ${shown.length} de ${d.items.length}. Refine a busca.`, "muted") : null,
    ),
  );
  node.append(
    details(
      "Fontes e atualização",
      el(
        "div",
        { class: "rows" },
        text("p", `Fontes: MDIC/Comex Stat (exportações do Brasil, FOB, janela de ${d.periodMonths} meses) e UN Comtrade (importações declaradas pelo país, origem Brasil, último ano declarado) — lado a lado, nunca somadas.${d.latestMonthly ? ` Última rotina mensal: ${d.latestMonthly}.` : ""}`, "muted"),
        d.pendingSummaries
          ? el(
              "p",
              { class: "muted" },
              `${d.pendingSummaries} resumo(s) em preparação (a lista já está publicada; o cron diário completa). `,
              admin()
                ? button("Preparar agora", async () => {
                    const r = await api("/api/radar/importers/summaries/rebuild", "POST", {});
                    notice(`${r.built} resumo(s) preparados; faltam ${r.remaining}.`);
                    showScreen(await internacionalView(query, all));
                  })
                : null,
            )
          : null,
        button("Abrir a lista mensal completa", () => navigate("Lista mensal")),
      ),
    ),
    details(
      "Análises, seleções e campanhas registradas",
      rows(hist.items, (a) =>
        el(
          "div",
          { class: "row" },
          el("div", {}, text("strong", `${a.name_pt} · ${a.period_months} meses`), text("small", `${a.created_at.slice(0, 10)} · ${a.selections} seleção(ões) · ${a.campaigns} campanha(s), ${a.active_campaigns} ativa(s)`)),
          button("Abrir", () => showAnalysis(a.id)),
        ),
      ),
    ),
  );
  if (d.pendingSummaries) node.querySelector("details").open = true;
  return node;
}

function sourceCard(src, extra) {
  return el(
    "div",
    { class: "stat source" },
    text("strong", src.title),
    text("span", src.lagging || src.label, src.state === "purchase_identified" ? "tag" : "tag warn"),
    src.note ? text("small", src.note) : null,
    text("small", `Versão ${src.versionId || "—"}${extra ? ` · ${extra}` : ""}`),
  );
}

function summaryCard(s, title) {
  if (!s) return el("div", { class: "stat source" }, text("strong", title), text("span", "lista ainda não gerada", "tag warn"));
  return el(
    "div",
    { class: "stat source" },
    text("strong", title),
    text("span", s.label, s.state === "purchase_identified" ? "tag" : "tag warn"),
    text("small", `${periodText(s.period)}${s.brazilUsd != null && s.state === "purchase_identified" ? ` · origem Brasil ${usd(s.brazilUsd)}` : ""}`),
    s.commodities.length ? text("small", commodityNames(s.commodities)) : null,
    text("small", s.source),
  );
}

async function showAnalysis(id, preloaded) {
  const a = preloaded || (await api(`/api/country-analyses/${id}`));
  const node = section(
    `${a.country.name_pt} · resumo`,
    `${a.summary.purchaseIdentified ? "Há importações de commodities agrícolas do Brasil identificadas." : "Nenhuma importação agrícola do Brasil identificada nas fontes."} Período de ${a.periodMonths} meses${a.reused ? " · análise já registrada, reaproveitada (mesma lista)" : ""}${a.reproduced ? "" : " · a lista usada não confere mais: gere nova análise"}`,
  );
  node.setAttribute("data-screen", "internacional");
  // Onde a pessoa está no fluxo: país → commodity → busca de empresas.
  node.append(
    el("div", { class: "toolbar" }, button("Voltar aos países", () => navigate("Radar Internacional"))),
    el("ol", { class: "flow", "aria-label": "Etapas" }, el("li", {}, `País: ${a.country.name_pt}`), el("li", { "aria-current": "step" }, text("strong", "Escolher commodity")), el("li", {}, "Buscar empresas")),
    text("p", a.notice, "notice-fixed"),
  );
  node.append(
    el(
      "div",
      { class: "stats" },
      summaryCard(a.summary.mdic, "MDIC — exportações do Brasil para o país (FOB)"),
      summaryCard(a.summary.comtrade, "Comtrade — importações declaradas pelo país, origem Brasil (CIF)"),
    ),
  );
  const chosen = new Map();
  const count = text("span", "Nenhuma commodity marcada.", "muted");
  const boxes = [];
  const sync = () => {
    for (const b of boxes) b.el.checked = chosen.has(b.hs6);
    count.textContent = chosen.size ? `${chosen.size} commodity(ies) marcada(s): ${[...chosen.keys()].join(", ")}` : "Nenhuma commodity marcada.";
  };
  const pick = (r) => {
    if (!(r.purchaseIdentified && approver())) return null;
    const box = el("input", { type: "checkbox", "aria-label": `Selecionar ${r.hs6}` });
    boxes.push({ el: box, hs6: r.hs6 });
    box.checked = chosen.has(r.hs6);
    box.addEventListener("change", () => {
      box.checked ? chosen.set(r.hs6, r) : chosen.delete(r.hs6);
      sync();
    });
    return box;
  };
  // Commodities com compra identificada, da maior para a menor (MDIC, depois Comtrade origem Brasil).
  const value = (r) => r.mdic?.fobUsd ?? 0;
  const ctValue = (r) => r.comtrade?.latest?.brazilUsd ?? 0;
  const bought = a.rows.filter((r) => r.purchaseIdentified && (value(r) > 0 || ctValue(r) > 0)).sort((x, y) => value(y) - value(x) || ctValue(y) - ctValue(x));
  const top = bought.slice(0, 15);
  node.append(
    panel(
      "Commodities com compra do Brasil identificada",
      text("p", approver() ? "Marque as commodities que a EAG quer oferecer neste país. Valores do período; o dado do país não prova que uma empresa específica importa." : "Valores do período; o dado do país não prova que uma empresa específica importa.", "muted"),
      top.length
        ? el(
            "div",
            { class: "pick-list" },
            ...top.map((r) =>
              el(
                approver() ? "label" : "div",
                {},
                pick(r) || el("span"),
                el("span", {}, text("strong", `${r.name || "sem nome"}`), " ", text("span", r.hs6, "muted"), r.catalog.confirmed.length ? el("span", {}, " ", text("span", "no catálogo EAG", "tag ok")) : null),
                text("span", r.mdic ? usd(r.mdic.fobUsd) : r.comtrade?.latest ? usd(r.comtrade.latest.brazilUsd) : "—", "num"),
                text(
                  "small",
                  `MDIC: ${r.mdic ? `${usd(r.mdic.fobUsd)} FOB, última ocorrência ${r.mdic.lastOccurrence}` : "—"} · Comtrade: ${r.comtrade?.latest ? `${r.comtrade.latest.year}, Brasil ${usd(r.comtrade.latest.brazilUsd)}` : "—"}${r.catalog.confirmed.length ? ` · catálogo EAG: ${r.catalog.confirmed.map((c) => c.variant).join(", ")}` : ""}`,
                ),
              ),
            ),
          )
        : text("p", "Nenhuma commodity com valor de origem Brasil no período.", "empty"),
      bought.length > top.length ? text("p", `Mostrando as ${top.length} de maior valor entre ${bought.length}. As demais estão na tabela completa.`, "muted") : null,
    ),
  );
  // Tabela completa só sob demanda (sem relatório extenso por padrão).
  const table = el("table", { class: "trade" });
  table.append(el("thead", {}, el("tr", {}, ...["", "SH6", "Produto", "Compras declaradas pelo país (CIF, anual)", "Exportações do Brasil (FOB, mensal)", "Catálogo EAG"].map((h) => el("th", { scope: "col" }, h)))));
  const body = el("tbody");
  for (const r of a.rows) {
    const ct = r.comtrade?.latest;
    const md = r.mdic;
    body.append(
      el(
        "tr",
        {},
        el("td", {}, pick(r)),
        el("td", {}, r.hs6),
        el("td", {}, r.name || "—"),
        el("td", {}, ct ? `${ct.year}: todas as origens ${usd(ct.worldUsd)}; Brasil ${usd(ct.brazilUsd)}; parte do Brasil ${ct.brazilShare == null ? `desconhecida (${ct.shareNote})` : `${(ct.brazilShare * 100).toFixed(1)}%`}${ct.basis === "CIF" ? "" : " (base declarada, não CIF)"}` : "—"),
        el("td", {}, md ? `${usd(md.fobUsd)} · ${kg(md.netKg)} · última ocorrência ${md.lastOccurrence}${md.qtyInconsistent ? " · quantidade estatística inconsistente na fonte" : ""}` : "—"),
        el("td", {}, r.catalog.confirmed.length ? `No catálogo EAG: ${r.catalog.confirmed.map((c) => c.variant).join(", ")}` : r.catalog.pending.length ? "código pendente" : "—"),
      ),
    );
  }
  table.append(body);
  node.append(
    details(`Tabela completa (${a.rows.length} subposições; fontes: versões ${a.sources.mdic.versionId || "—"} e ${a.sources.comtrade.versionId || "—"})`, el("div", {}, el("div", { class: "stats" }, sourceCard(a.sources.comtrade, a.sources.comtrade.years.length ? `anos guardados: ${a.sources.comtrade.years.join(", ")}` : null), sourceCard(a.sources.mdic, a.sources.mdic.window ? `de ${a.sources.mdic.window.from} a ${a.sources.mdic.window.to}` : null)), el("div", { class: "table-wrap" }, table))),
  );
  if (approver()) {
    const choose = button("Escolher commodity", async () => {
      if (!chosen.size) return notice("Marque ao menos uma commodity com compra identificada.", true);
      const fields = [];
      for (const r of chosen.values()) {
        const guess = r.catalog.confirmed[0]?.productId;
        fields.push({ r, p: select(`Produto para ${r.hs6} (${r.name || "sem nome"})`, `product-${r.hs6}`, state.products.map((x) => [x.id, x.variant_name]), guess), l: input(`Nome da commodity (${r.hs6})`, `label-${r.hs6}`, "text", r.name || "") });
      }
      const out = el("div");
      const f = makeForm(
        fields.flatMap((x) => [x.p, x.l]),
        async () => {
          // Linhas com o mesmo produto viram um item só (uma campanha por commodity).
          const items = new Map();
          for (const x of fields) {
            const productId = x.p.control.value;
            const it = items.get(productId) || items.set(productId, { productId, label: x.l.control.value, hs6: [] }).get(productId);
            it.hs6.push(x.r.hs6);
          }
          const r = await api(`/api/country-analyses/${a.id}/selections`, "POST", { items: [...items.values()] });
          notice(`Seleção registrada: ${r.campaigns.length} campanha(s) em rascunho${r.campaigns.some((c) => c.needsCommercialValidation) ? "; há commodity aguardando validação comercial" : ""}.`);
          // Próximo passo: autorizar a busca de empresas (pequenas e médias; consumidoras e processadoras primeiro).
          out.replaceChildren(
            ...r.campaigns.map((c) =>
              el(
                "div",
                { class: "row" },
                el("div", {}, text("strong", c.label), text("small", "Busca de pequenas e médias empresas importadoras; consumidoras finais, fábricas e processadoras primeiro; traders à parte.")),
                button("Autorizar busca de empresas", async () => {
                  const x = await api(`/api/campaigns/${c.id}/foreign-search`, "POST", { confirm: true });
                  await showForeignSearch(x.id, x);
                }, true),
              ),
            ),
          );
        },
        "Registrar seleção",
      );
      node.querySelector(".chosen-panel")?.remove();
      const box = panel("Commodity escolhida", text("p", "Confira o produto do catálogo de cada linha. Linhas com o mesmo produto viram uma campanha só, em rascunho.", "muted"), f, out);
      box.classList.add("chosen-panel");
      node.append(box);
      f.scrollIntoView({ block: "nearest" });
    }, true);
    // Ação fixa no rodapé: mostra o que está marcado e leva ao próximo passo.
    node.insertBefore(el("div", { class: "sticky-action" }, count, choose), node.lastElementChild);
  }
  showScreen(node);
}

const BUYER_TAG = { confirmed_importer: "tag", confirmed_buyer: "tag", potential: "tag warn" };
function evidenceLine(e) {
  return el(
    "li",
    {},
    `${e.type} — ${e.reference}`,
    e.factDate ? ` · fato em ${e.factDate.slice(0, 10)}` : " · data do fato não informada",
    ` · consultado em ${e.consultedAt.slice(0, 10)}`,
    e.validation !== "valid" ? ` · ${e.validation === "pending" ? "não validada" : e.validation}` : "",
    e.sourceUrl ? el("span", {}, " · ", el("a", { href: e.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, "fonte")) : "",
  );
}
function companyResult(c) {
  const contacts = c.contacts.filter((k) => k.verified);
  // Resumo compacto: quem é, por que pode comprar, porte (com incerteza), contato, etapa, pendência e próxima ação.
  const why = c.activity ? c.activity.text : c.profile ? c.profile.label : "atividade não registrada";
  const size = c.size ? `${c.size.label} (${c.size.basis})` : "porte desconhecido";
  const contact = contacts.length ? `${contacts.length} contato(s) com fonte${contacts.some((k) => k.emailValidation === "valid") ? ", e-mail validado" : ", e-mail a validar"}` : "sem contato com fonte";
  const nextStep = c.pending[0] || (c.ficha.ok ? "Preparar ficha (envio só após aprovação individual)." : c.ficha.reason);
  const secondary = [
    writable() && state.searchId && c.triage
      ? button(c.triage.priority === "secondary" ? "Tornar prioridade principal" : "Marcar prioridade secundária", async () => {
          const secondaryNow = c.triage.priority !== "secondary";
          const reason = secondaryNow ? prompt("Motivo da prioridade secundária:") : null;
          if (secondaryNow && !reason) return;
          await api(`/api/foreign-searches/${state.searchId}/candidates/${c.id}`, "PATCH", { action: "priority", priority: secondaryNow ? "secondary" : "primary", reason });
          await showForeignSearch(state.searchId);
        })
      : null,
    writable() && state.searchId && c.triage
      ? button("Registrar ponto a verificar", async () => {
          const topic = prompt("Ponto a verificar (ex.: autonomia de compras):");
          if (!topic) return;
          await api(`/api/foreign-searches/${state.searchId}/candidates/${c.id}/checks`, "POST", { topic });
          await showForeignSearch(state.searchId);
        })
      : null,
    writable()
      ? button("Conferir identidade (GLEIF)", async () => {
          // Identidade jurídica (nome legal, registro, LEI): não é evidência de compra.
          const r = await api(`/api/companies/${c.id}/gleif`);
          notice(r.matches.length ? `GLEIF — ${c.name}: ${r.matches.map((g) => `${g.legalName} · ${g.registeredAs || "registro não informado"} · ${g.city || "—"} · LEI ${g.lei} (${g.status})`).join(" | ")}` : `GLEIF — ${c.name}: nenhum registro. ${r.note}`);
        })
      : null,
    writable() && state.searchId && c.triage
      ? button("Descartar desta busca", async () => {
          const reason = prompt("Motivo do descarte nesta busca (vale só para esta empresa e este produto):");
          if (!reason) return;
          await api(`/api/foreign-searches/${state.searchId}/candidates/${c.id}`, "PATCH", { action: "dismiss", reason });
          await showForeignSearch(state.searchId);
        })
      : null,
  ];
  return el(
    "div",
    { class: "row" },
    el(
      "div",
      {},
      text("strong", c.name),
      el("div", { class: "tags" }, text("span", c.buyerStatusLabel, BUYER_TAG[c.buyerStatus] || "tag"), c.triage?.priority === "secondary" ? text("span", "prioridade secundária", "tag warn") : null),
      text("small", `${why} · ${size} · ${contact}`),
      text("small", `Próximo passo: ${nextStep}`),
    ),
    button("Abrir empresa", () => openCompanyPanel(c.id, c.name), true),
    moreMenu("Mais ações", ...secondary),
    details(
      "Detalhes, evidências e pessoas",
      el(
        "div",
        { class: "rows" },
        c.triage?.priority === "secondary" && c.triage.priorityReason ? text("small", `Prioridade secundária: ${c.triage.priorityReason}`) : null,
        c.checks?.length ? el("div", {}, text("small", "Pontos a verificar:"), el("ul", {}, ...c.checks.map((k) => el("li", {}, `${k.status === "open" ? "aberto" : k.status === "confirmed" ? "confirmado" : "descartado"}: ${k.topic}${k.note ? ` — ${k.note}` : ""}${k.resolution ? ` → ${k.resolution}` : ""} `, k.sourceUrl ? el("a", { href: k.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, "fonte") : null)))) : null,
        text("small", `Porte: ${c.size ? `${c.size.label} — ${c.size.basis}, ${c.size.reference} (fonte: ${c.size.source || "sem fonte"})` : "desconhecido — pendência pesquisável"} · Atividade: ${c.activity ? `${c.activity.text} (fonte: ${c.activity.source})` : "não registrada"} · Perfil: ${c.profile ? `${c.profile.label}, ${c.profile.icpLabel}` : "não registrado"}`),
        c.website ? el("small", {}, "Site: ", el("a", { href: c.website, target: "_blank", rel: "noopener noreferrer" }, c.website)) : text("small", "Site: não registrado"),
        c.importEvidence.length
          ? el("div", {}, text("small", "Evidência de importação/compra (da própria empresa):"), el("ul", {}, ...c.importEvidence.map(evidenceLine)))
          : c.indications.length
            ? el("div", {}, text("small", "Indícios (não confirmam — potencial compradora a validar):"), el("ul", {}, ...c.indications.map(evidenceLine)))
            : text("small", "Sem evidência nem indício de compra registrado."),
        text("small", contacts.length ? `Decisores/contatos com fonte: ${contacts.map((k) => `${k.name}${k.jobTitle ? ` (${k.jobTitle})` : ""} — ${k.source}${k.emailValidation === "valid" ? ", e-mail validado" : ", e-mail não validado"}`).join("; ")}` : "Decisores/contatos com fonte: nenhum"),
        c.pending.length ? el("div", {}, text("small", "Pendências:"), el("ul", {}, ...c.pending.map((p) => el("li", {}, p)))) : null,
        text("small", `Encontrada em: ${c.foundBy.source}${c.foundBy.at ? ` (${c.foundBy.at.slice(0, 10)})` : ""} · Ficha: ${c.ficha.ok ? "pode ser preparada; envio só após aprovação individual" : c.ficha.reason}`),
        details("Validação assistida (links para você abrir)", el("ul", {}, ...c.validationLinks.map((l) => el("li", {}, el("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, l.label))))),
        writable() ? details("Registrar sinal ou prova de importação", importEvidenceForm(c)) : null,
        details("Pessoas de compras", peoplePanel(c.id)),
      ),
    ),
  );
}

// Pessoas de compras (dois radares): fontes permitidas (Impressum, QSA), pesquisa assistida e registro manual com fonte.
// Carrega sob demanda; a pesquisa só consulta fontes quando a pessoa pede e reaproveita o que ainda está no prazo.
function peoplePanel(companyId) {
  const box = el("div", {}, text("small", "Carregando…"));
  const load = async () => {
    const v = await api(`/api/companies/${companyId}/people`);
    const r = v.research;
    box.replaceChildren(
      text("small", v.notice),
      text("small", `Identificadas: ${v.counts.identified} · aceitas: ${v.counts.acceptedRelevant} · cargo verificado: ${v.counts.titleVerified} · decisor confirmado: ${v.counts.decidersConfirmed} · aprovadas para abordagem: ${v.counts.approvedRecipients} · e-mails validados: ${v.counts.emailsValidated}`),
      v.channels.length
        ? el(
            "div",
            {},
            text("small", "Canais gerais da empresa (não são pessoas; servem para identificar o responsável):"),
            el("ul", {}, ...v.channels.map((ch) => el("li", {}, `${ch.email}${ch.phone ? ` · ${ch.phone}` : ""} — ${ch.approval}; e-mail ${ch.emailValidation === "valid" ? "validado" : "não validado"} `, el("a", { href: ch.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, "fonte")))),
          )
        : null,
      writable() && state.searchCampaignId && v.channels.length
        ? button("Preparar ficha de identificação do responsável", async () => {
            const language = prompt("Idioma do texto (de, en ou pt-BR):", "de");
            if (!language) return;
            const r = await api("/api/fichas", "POST", { companyId, campaignId: state.searchCampaignId, purpose: "identify_buyer", language, recipients: v.channels.map((ch) => ch.contactId) });
            notice(`Ficha de identificação criada (rascunho). Revisor: ${r.reviewOk ? "sem pendências" : r.findings.map((f) => f.detail).join(" · ")}. Nada é enviado sem a sua aprovação individual.`);
          })
        : null,
      !v.adherence.ok ? text("small", v.adherence.reason) : null,
      r ? text("small", `Última pesquisa: ${r.at.slice(0, 10)} (${r.requests} consultas) · ${r.sources.map((s) => `${s.kind}: ${s.status}${s.note ? ` — ${s.note}` : ""}`).join(" · ")}${r.stale ? " · prazo vencido, pode pesquisar de novo" : ` · nova pesquisa após ${r.refreshAfter.slice(0, 10)}`}`) : text("small", "Ainda não pesquisada."),
      writable() && v.adherence.ok && (!r || r.stale)
        ? button("Pesquisar pessoas nas fontes permitidas", async () => {
            const x = await api(`/api/companies/${companyId}/people/research`, "POST", {});
            notice(x.skipped ? x.reason : `${x.added} pessoa(s) nova(s) — a validar.`);
            await load();
          })
        : null,
      ...v.people.map((p) =>
        el(
          "div",
          { class: "row" },
          el(
            "div",
            {},
            text("strong", `${p.name}${p.title ? ` — ${p.title}` : ""}`),
            // Estados independentes: aceitar não confirma compra; confirmar compra não aprova abordagem (R18.3).
            text("span", p.states.relevance, p.status === "accepted" ? "tag" : "tag warn"),
            text("span", p.states.purchase, p.states.purchase === "decisor de compras confirmado" ? "tag" : "tag warn"),
            text("span", p.states.approval, p.states.approval === "destinatário aprovado para abordagem" ? "tag" : "tag warn"),
            p.states.title === "cargo verificado" ? text("span", "cargo verificado", "tag") : null,
            p.stale ? text("span", "fonte vencida — reconferir", "tag warn") : null,
            text("small", `Por que: ${p.relevance}`),
            p.purchaseEvidence ? el("small", {}, `Indício de responsabilidade de compra (não confirma): ${p.purchaseEvidence.note} · `, el("a", { href: p.purchaseEvidence.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, "fonte")) : null,
            el("small", {}, `Fonte: ${p.source.label} (verificado em ${p.source.verifiedAt.slice(0, 10)}) · `, el("a", { href: p.source.url, target: "_blank", rel: "noopener noreferrer" }, "abrir fonte")),
            p.email ? text("small", `E-mail: ${p.email.value} — ${p.email.note} Validação: ${p.email.validation === "valid" ? "validado" : "não validado"}.`) : text("small", "E-mail: não encontrado na fonte (não deduzir do domínio)."),
            p.phone ? text("small", `Telefone: ${p.phone.value} — ${p.phone.note}`) : null,
            p.dismissReason ? text("small", `Descartada: ${p.dismissReason}`) : null,
          ),
          writable() && p.status === "to_validate"
            ? el(
                "div",
                { class: "toolbar" },
                button("Aceitar como contato", async () => {
                  const x = await api(`/api/companies/${companyId}/people/${p.id}/accept`, "POST", {});
                  notice(`Contato criado${x.emailCopied ? " com o e-mail pessoal publicado (validação pendente)" : " sem e-mail"}. Verifique cargo e poder de compra antes da ficha.`);
                  await load();
                }),
                button("Descartar", async () => {
                  const reason = prompt("Motivo do descarte (ex.: não atua em compras, saiu da empresa):");
                  if (!reason) return;
                  await api(`/api/companies/${companyId}/people/${p.id}/dismiss`, "POST", { reason });
                  await load();
                }),
              )
            : null,
        ),
      ),
      details("Pesquisa assistida (você abre e registra o que confirmar)", el("ul", {}, ...v.assisted.map((l) => el("li", {}, el("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, l.label))))),
      writable() ? details("Registrar pessoa encontrada (com fonte)", personForm(companyId, load)) : null,
      writable() ? details("Registrar canal geral publicado (info@, kontakt@)", channelForm(companyId, load)) : null,
    );
  };
  load().catch((e) => box.replaceChildren(text("small", e.message)));
  return box;
}
function channelForm(companyId, done) {
  const f = (name, label, type = "text") => el("label", {}, label, el("input", { name, type }));
  const form = el("form", {}, f("email", "E-mail publicado", "email"), f("phone", "Telefone publicado (opcional)"), f("sourceUrl", "URL onde está publicado", "url"), f("timezone", "Fuso da empresa (ex.: Europe/Berlin)"), el("button", { type: "submit" }, "Registrar canal"));
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    for (const k of Object.keys(d)) if (!d[k]) delete d[k];
    await api(`/api/companies/${companyId}/channels`, "POST", d);
    form.reset();
    await done();
  });
  return form;
}
function personForm(companyId, done) {
  const f = (name, label, type = "text") => el("label", {}, label, el("input", { name, type }));
  const form = el(
    "form",
    {},
    f("name", "Nome"),
    f("title", "Cargo (como aparece na fonte)"),
    el("label", {}, "Fonte", el("select", { name: "sourceKind" }, el("option", { value: "company_site" }, "Site da empresa"), el("option", { value: "linkedin_manual" }, "LinkedIn (consulta manual)"), el("option", { value: "directory" }, "Diretório profissional"), el("option", { value: "manual" }, "Outra fonte"))),
    f("sourceUrl", "URL da fonte", "url"),
    f("email", "E-mail publicado (opcional)", "email"),
    f("emailSourceUrl", "URL onde o e-mail aparece", "url"),
    el("button", { type: "submit" }, "Registrar"),
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    for (const k of Object.keys(d)) if (!d[k]) delete d[k];
    await api(`/api/companies/${companyId}/people`, "POST", d);
    form.reset();
    await done();
  });
  return form;
}

// Descoberta por fontes gratuitas (OpenStreetMap, registros oficiais) e decisão da pessoa sobre cada candidato.
const DISC_SIZE = { micro: "Micro/MEI", small: "Pequena", medium: "Média", medium_plus: "Média-mais" };
function candidateRow(c, chosen) {
  const box = c.status === "new" && writable() ? el("input", { type: "checkbox", "aria-label": `Selecionar ${c.name}` }) : null;
  box?.addEventListener("change", () => (box.checked ? chosen.add(c.id) : chosen.delete(c.id)));
  return el(
    "div",
    { class: "row" },
    box,
    el(
      "div",
      {},
      text("strong", `${c.name}${c.city ? ` · ${c.city}` : ""}`),
      text("span", c.status === "new" ? "empresa encontrada" : c.status === "accepted" ? "aceita na busca" : "descartada", c.status === "dismissed" ? "tag warn" : "tag"),
      c.possibleDuplicate ? text("span", "possível duplicata — confira", "tag warn") : null,
      c.importSignal ? text("span", c.importSignal.status === "valid" ? `EORI ${c.importSignal.eori} ativo — sinal de importação` : c.importSignal.status === "not_valid" ? "EORI não encontrado com o SIRET da sede" : "EORI não conferido", c.importSignal.status === "valid" ? "tag" : "tag warn") : text("span", "importação não verificada", "tag warn"),
      text("small", `Fonte: ${c.sourceLabel} · atividade: ${c.activity ? c.activity.label : "—"} · porte: ${c.size ? `${DISC_SIZE[c.size.band]} (${c.size.source})` : "não informado na fonte"}${c.registry ? ` · ${c.registry.type} ${c.registry.id}` : ""}`),
      el("small", {}, c.website ? el("a", { href: c.website, target: "_blank", rel: "noopener noreferrer" }, "site") : "sem site na fonte", " · ", el("a", { href: c.recordUrl, target: "_blank", rel: "noopener noreferrer" }, "registro na fonte")),
      c.validationNote ? text("small", `Validação (${c.validatedAt ? c.validatedAt.slice(0, 10) : "—"}): ${c.validationNote}`) : c.source === "de_coffee_assoc" && c.status === "new" ? text("small", "Perfil ainda não validado.") : null,
      c.importStatement ? text("small", `Autodeclaração da empresa (diretório, ${c.validatedAt ? c.validatedAt.slice(0, 10) : "—"}): "${c.importStatement}" — origem ${c.mentionsBrazil ? "menciona o Brasil (não comprovada)" : "Brasil não mencionada"}`) : null,
      // Evidência de contatos (aviso legal do site), sem aceite nem autorização de envio.
      c.contactEvidence
        ? text("small", `Aviso legal (${c.contactEvidence.checkedAt.slice(0, 10)}${c.contactEvidence.stale ? ", vencido" : ""}): ${c.contactEvidence.people.length ? c.contactEvidence.people.map((p) => `${p.name} (${p.title})`).join("; ") + " — representantes legais, a validar" : "sem nome publicado"}${c.contactEvidence.generalEmail ? ` · e-mail ${c.contactEvidence.generalEmail.scope === "personal" ? "pessoal" : "geral"}: ${c.contactEvidence.generalEmail.value}` : ""}`)
        : null,
      c.dismissReason ? text("small", `Descartada: ${c.dismissReason}`) : null,
    ),
  );
}

async function discoveryPanel(x) {
  const d = await api(`/api/foreign-searches/${x.id}/discovery`);
  const wrap = el("div");
  const nace = input("Atividades NACE das consumidoras/processadoras (NN.NN, separadas por vírgula)", "nace", "text", d.proposal ? d.proposal.processors.nace.join(", ") : "", false);
  const naceT = input("Atividades NACE dos traders/atacadistas", "naceTraders", "text", d.proposal ? d.proposal.traders.nace.join(", ") : "", false);
  const parse = (v) => v.split(/[,\s]+/).map((z) => z.trim()).filter(Boolean);
  // OpenStreetMap: o servidor público recusa conexões da Cloudflare, então a consulta montada pelo Compass roda no
  // navegador e só os campos necessários voltam para o servidor (tratados pelo mesmo código).
  const KEEP = ["name", "operator", "brand", "craft", "industrial", "product", "man_made", "amenity", "shop", "addr:city", "website", "contact:website"];
  async function overpassInBrowser() {
    if (!d.osmQuery) throw new Error("Sem consulta do OpenStreetMap para esta commodity.");
    let r;
    try {
      r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(d.osmQuery)}` });
    } catch {
      throw new Error("OpenStreetMap sem resposta a partir do navegador; tente de novo em alguns minutos.");
    }
    if (!r.ok) throw new Error(`OpenStreetMap respondeu ${r.status} (servidor público sobrecarregado); tente de novo em alguns minutos.`);
    const j = await r.json();
    // Só o que pode virar candidato (com nome; ponto de venda sem produção fica fora), no máximo 300 por vez (limite de 64 KB).
    const useful = (j.elements || []).filter((e) => {
      const t = e.tags || {};
      return (t.name || t.operator || t.brand) && !((t.amenity === "cafe" || t.shop) && !t.craft && !t.industrial && t.man_made !== "works");
    });
    const elements = useful.slice(0, 300).map((e) => ({ type: e.type, id: e.id, tags: Object.fromEntries(Object.entries(e.tags || {}).filter(([k]) => KEEP.includes(k)).map(([k, v]) => [k, String(v).slice(0, 160)])) }));
    return { elements, totalElements: useful.length };
  }
  const runBtn = (label, body) =>
    button(label, async () => {
      if (body.source === "osm") body = { ...body, overpass: await overpassInBrowser() };
      const r = await api(`/api/foreign-searches/${x.id}/discover`, "POST", body);
      notice(`${r.found} empresa(s) encontrada(s)${r.truncated ? ` (lidas ${r.found} de ${r.totalInSource} na fonte)` : ""}. Nada entrou no cadastro: aceite ou descarte cada uma.`);
      await showForeignSearch(x.id);
    }, true);
  const avail = d.sources.filter((s) => s.available);
  const unavailable = d.sources.filter((s) => !s.available);
  if (x.status === "open" && writable())
    wrap.append(
      text("p", d.proposal ? `Proposta para ${d.proposal.commodity} (${d.mapVersion}): ${d.proposal.processors.label}; traders: ${d.proposal.traders.label}. Confira e ajuste antes de rodar.` : "Sem proposta de atividades para esta commodity: informe os códigos NACE.", "muted"),
      el("div", { class: "form-grid" }, nace.node, naceT.node),
      el(
        "div",
        { class: "toolbar" },
        ...avail.map((s) => runBtn(`Gerar candidatos: ${s.label}`, { source: s.key, role: "processor", nace: parse(nace.control.value).length ? parse(nace.control.value) : undefined })),
        ...avail.filter((s) => ["fr_registry", "no_registry"].includes(s.key)).map((s) => runBtn(`Gerar traders: ${s.label}`, { source: s.key, role: "trader", nace: parse(naceT.control.value).length ? parse(naceT.control.value) : undefined })),
        d.counts.awaitingValidation
          ? button(`Validar próximos 20 perfis (${d.counts.awaitingValidation} aguardando)`, async () => {
              const r = await api(`/api/foreign-searches/${x.id}/discovery/validate`, "POST", { limit: 20 });
              notice(`${r.checked} perfil(is) conferido(s): ${r.calls} consulta(s), ${r.reusedFromCache} do cache${r.failed ? `, ${r.failed} falha(s) — tente de novo` : ""}.`, r.failed > 0);
              await showForeignSearch(x.id);
            }, true)
          : null,
      ),
      unavailable.length ? text("small", `Fora da cobertura deste país: ${unavailable.map((s) => s.label).join("; ")}.`) : null,
    );
  wrap.append(
    text("p", d.notice, "muted"),
    text("p", `Encontradas: ${d.counts.found} · relevantes após validação: ${d.counts.relevant} · aguardando validação: ${d.counts.awaitingValidation} · descartadas automaticamente (fora do país ou não compradoras): ${d.counts.autoDismissed} · com declaração própria de importação: ${d.counts.withImportStatement} · EORI ativo: ${d.counts.withEori} · aceitas: ${d.counts.accepted}`),
  );
  for (const [title, list] of [["Consumidoras finais, fábricas e processadoras encontradas", d.processors], ["Traders e distribuidores encontrados (prioridade secundária)", d.traders]]) {
    if (!list.length) continue;
    const chosen = new Set();
    const reason = input("Motivo do descarte", "reason", "text", "", false);
    const actions =
      x.status === "open" && writable() && list.some((c) => c.status === "new")
        ? el(
            "div",
            {},
            el(
              "div",
              { class: "toolbar" },
              button("Aceitar selecionadas", async () => {
                if (!chosen.size) return notice("Marque ao menos uma empresa.", true);
                const r = await api(`/api/foreign-searches/${x.id}/discovery/accept`, "POST", { ids: [...chosen] });
                const bad = r.results.filter((z) => !z.ok);
                notice(`${r.accepted} aceita(s) como empresa encontrada.${bad.length ? ` ${bad.length} não aceita(s): ${bad.map((z) => z.reason).join(" | ")}` : ""}`, bad.length > 0);
                await showForeignSearch(x.id);
              }, true),
              button("Pesquisar contatos das candidatas (aviso legal, lote de 25)", async () => {
                const r = await api(`/api/foreign-searches/${x.id}/discovery/contacts`, "POST", { limit: 25 });
                notice(`${r.checked} site(s) lido(s), ${r.reusedFromCache} reaproveitado(s), ${r.withPeople} com representante; faltam ${r.remaining}. Evidência — não é aceite nem autorização de envio.`);
                await showForeignSearch(x.id);
              }),
              button("Descartar selecionadas", async () => {
                if (!chosen.size) return notice("Marque ao menos uma empresa.", true);
                if (!reason.control.value.trim()) return notice("Informe o motivo do descarte.", true);
                await api(`/api/foreign-searches/${x.id}/discovery/dismiss`, "POST", { ids: [...chosen], reason: reason.control.value.trim() });
                await showForeignSearch(x.id);
              }),
            ),
            reason.node,
          )
        : null;
    const pending = list.filter((c) => c.status === "new");
    const decided = list.filter((c) => c.status !== "new");
    wrap.append(
      el(
        "div",
        {},
        text("h3", `${title} (${list.length})`),
        actions,
        rows(pending.slice(0, 150), (c) => candidateRow(c, chosen)),
        pending.length > 150 ? text("p", `Mostrando 150 de ${pending.length} aguardando decisão.`, "muted") : null,
        decided.length ? details(`Já decididas (${decided.length})`, rows(decided, (c) => candidateRow(c, chosen))) : null,
      ),
    );
  }
  return panel("Descobrir empresas (fontes gratuitas)", wrap);
}


// Validação assistida: o que a pessoa achou vira evidência da própria empresa. Indício → "potencial importadora";
// documento conferido de importação do Brasil → "importadora confirmada". Dado do país nunca entra aqui.
function importEvidenceForm(c) {
  const today = new Date().toISOString().slice(0, 10);
  return makeForm(
    [
      select("Tipo", "kind", [["signal", "Indício (site da empresa, associação de importadores, notícia, registro de embarque visto)"], ["proof", "Documento da empresa conferido (fatura, registro aduaneiro, conhecimento de embarque)"]]),
      select("O que mostra", "supports", [["imports", "Importa (origem ou produto não informados)"], ["imports_from_brazil", "Importa a commodity do Brasil"], ["buys_commodity", "Compra a commodity (origem a confirmar)"]]),
      select("Tipo de documento (só para prova)", "docType", [["customs_record", "Registro aduaneiro"], ["bill_of_lading", "Conhecimento de embarque"], ["commercial_document", "Documento comercial (fatura, contrato)"], ["company_document", "Documento publicado pela empresa"]]),
      input("O que diz (referência)", "reference", "textarea"),
      input("URL da fonte", "sourceUrl", "url", "", false),
      input("Data do fato (AAAA-MM-DD)", "factDate", "text", "", false),
    ],
    async (v) => {
      const proof = v.kind === "proof";
      const ev = await api(`/api/companies/${c.id}/evidence`, "POST", {
        category: proof ? "business" : "commercial_signal",
        evidenceType: proof ? v.docType : "import_signal",
        reference: v.reference, sourceUrl: v.sourceUrl || undefined, factDate: v.factDate || undefined, consultedAt: today,
        validationStatus: proof ? "valid" : "pending",
        productId: proof ? state.searchProductId : undefined, market: proof ? "international" : undefined,
        supports: [v.supports],
      });
      // Prova conferida de importação do Brasil ou de compra confirma a condição da empresa (R12.10); "importa" genérico nunca confirma.
      if (proof && v.supports !== "imports") await api(`/api/companies/${c.id}/conditions/${state.searchProductId}/${v.supports}`, "PUT", { status: "confirmed", evidenceId: ev.id });
      notice(proof && v.supports === "imports_from_brazil" ? "Importação do Brasil confirmada por documento da empresa." : "Sinal registrado: a empresa passa a potencial compradora, a validar.");
      await showForeignSearch(state.searchId);
    },
    "Registrar",
  );
}

// Revisão para decisão (2026-09-30): decisões pendentes e candidatas mais promissoras, montadas do que já está gravado.
// Só leitura: nada é aceito, aprovado, ativado ou enviado por esta tela.
async function showDecisionReview(searchId) {
  const r = await api(`/api/foreign-searches/${searchId}/review`);
  const d = r.decisions;
  const node = section("Revisão para decisão", `Busca ${r.search.country} · SH6 ${r.search.hs6.join(", ")}${r.search.campaign ? ` · campanha ${r.search.campaign.name} (${r.search.campaign.status})` : ""}`);
  node.setAttribute("data-screen", "internacional");
  const table = (head, rows) => el("div", { class: "table-wrap" }, el("table", {}, el("thead", {}, el("tr", {}, ...head.map((h) => el("th", {}, h)))), el("tbody", {}, ...rows.map((cells) => el("tr", {}, ...cells.map((c) => el("td", {}, c ?? "—")))))));
  const pre = (s) => el("pre", { class: "message" }, s);
  const link = (l) => el("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, l.label);
  // Estado de cada decisão em texto; verde só quando a própria resposta do servidor diz aprovado/confirmado/configurado.
  const done = (s) => /aprovad|confirmad|configurad/i.test(String(s || "")) && !/pendente|não /i.test(String(s || ""));
  const tagFor = (s) => text("span", s || "proposta", done(s) ? "tag ok" : "tag warn");
  const decision = (n, title, status, ...body) => el("details", {}, el("summary", {}, text("span", String(n), "n"), text("strong", title), tagFor(status)), el("div", {}, ...body));
  const decisions = [
    decision(
      1,
      `Validação comercial (${d.commercialValidation.rule})`,
      d.commercialValidation.status,
      text("p", "Frase a confirmar:"),
      pre(d.commercialValidation.phrase),
      text("small", `Por que é pedida: ${d.commercialValidation.why}`),
      text("small", `O que autoriza: ${d.commercialValidation.authorizes}`),
      el("div", {}, text("small", "Já cumprido:"), el("ul", {}, ...d.commercialValidation.met.map((m) => el("li", {}, m)))),
      el("div", {}, text("small", "Continua pendente depois dela:"), el("ul", {}, ...d.commercialValidation.stillPending.map((m) => el("li", {}, m)))),
    ),
    decision(
      2,
      "Referência de porte",
      d.sizeReference.status || "proposta",
      text("p", d.sizeReference.current),
      text("small", d.sizeReference.proposal),
      table(["Categoria", "Efetivo (UTA)", "Faturamento", "Balanço"], d.sizeReference.table.map((z) => [z.category, z.staff, z.turnover, z.balance])),
      text("small", `Empresas de grupo: ${d.sizeReference.groups}`),
      d.sizeReference.headcount ? text("small", d.sizeReference.headcount) : null,
      d.sizeReference.source ? text("small", `Fonte: ${d.sizeReference.source}`) : null,
      text("small", d.sizeReference.estimatedVsProven),
    ),
    decision(3, "Regra R14.8", d.r148.status, pre(d.r148.current), d.r148.proposed ? el("div", {}, text("small", "Proposta:"), pre(d.r148.proposed)) : null),
    decision(
      4,
      "Textos da abordagem",
      d.texts.status,
      text("small", `Destinatário: ${d.texts.recipient}. Sequência: ${d.texts.steps.map((z) => `passo ${z.step} no dia ${z.day}`).join(", ")}.`),
      d.texts.address ? el("div", { class: d.texts.address.confirmedByRogerio ? "callout" : "callout warn" }, text("p", `Endereço no rodapé: ${d.texts.address.value || "não configurado"} — ${d.texts.address.confirmedByRogerio ? "confirmado por Rogério" : d.texts.address.pending} Fonte: ${d.texts.address.source}`)) : null,
      d.texts.followUpSubject ? text("small", d.texts.followUpSubject) : null,
      d.texts.stops ? text("small", d.texts.stops) : null,
      ...d.texts.steps.map((z) => details(`Passo ${z.step} — dia ${z.day}: ${z.de.subject}`, table(["Alemão (enviado)", "Português (referência)"], [[z.de.subject, z.pt.subject], [pre(z.de.body), pre(z.pt.body)]]))),
    ),
    decision(5, "Verificador de e-mail (Snov)", r.snov.configured ? "configurado" : "pendente", text("small", r.snov.note), el("ol", {}, ...r.snov.steps.map((q) => el("li", {}, q)))),
  ];
  const pendingCount = decisions.filter((x) => x.querySelector("summary .tag.warn")).length;
  node.append(
    el("div", { class: "toolbar" }, button("Voltar à busca", () => showForeignSearch(searchId))),
    text("p", r.notice, "notice-fixed"),
    panel(`Decisões (${pendingCount ? `${pendingCount} aguardando você` : "todas registradas"})`, text("p", "Abra cada item para ver a proposta completa, a fonte e o que ela autoriza. Nada aqui é aprovado automaticamente.", "muted"), el("div", { class: "decision-list" }, ...decisions)),
  );
  const top = panel(
    `Candidatas mais promissoras (${r.top10.length} de ${r.counts.consumers} consumidoras; ${r.counts.traders} traders à parte)`,
    text("p", "Aceitar é decisão sua, na lista de descoberta da busca. Esta tela não aceita nenhuma candidata.", "muted"),
    !r.top10.length ? text("p", "Nenhuma consumidora final ou processadora com sinal próprio de compra ainda. Valide as empresas encontradas na busca.", "empty") :
    rows(r.top10, (c) =>
      el(
        "div",
        { class: "row" },
        el(
          "div",
          {},
          text("strong", c.name),
          el("div", { class: "tags" }, text("span", c.recommendation, /^Aceitar/.test(c.recommendation) ? "tag ok" : "tag"), c.size.band ? text("span", `${c.size.band} (${c.size.kind})`, "tag") : text("span", "porte a confirmar", "tag warn")),
          text("small", `${c.city ? `${c.city} · ` : ""}${c.activity.typeLabel ? `${c.activity.typeLabel} — ${c.activity.evidence}` : c.activity.summary}`),
          text("small", `Compra/consumo: ${[c.purchaseEvidence.consumption ? `"${c.purchaseEvidence.consumption.text}"` : null, c.purchaseEvidence.importStatement ? `autodeclara importação (${c.purchaseEvidence.importStatement.brazil})` : null].filter(Boolean).join(" · ") || "sem frase própria"}`),
          text("small", `Contato: ${c.contact.technicalState}${c.contact.people.length ? ` · ${c.contact.people.map((q) => `${q.name} (${q.title})`).join("; ")}` : ""}${c.contact.generalEmail ? ` · ${c.contact.generalEmail}` : ""}`),
        ),
        c.profileUrl ? el("a", { href: c.profileUrl, target: "_blank", rel: "noopener noreferrer", class: "button-link" }, "Perfil na fonte") : null,
        details(`Por que e o que falta (${c.pending.length})`, el("div", {}, text("p", c.rationale), el("ul", {}, ...c.pending.map((q) => el("li", {}, q))))),
      ),
    ),
  );
  node.append(top);
  node.append(
    details(
      `Classificação a revisar — prestadora × processadora que compra (${r.reclassify.length})`,
      el(
        "div",
        { class: "rows" },
        r.reclassify.length
          ? table(["Empresa", "Atividade investigada", "Evidência", "Grupo"], r.reclassify.map((c) => [c.name, c.activity.typeLabel, el("span", {}, c.activity.evidence || "—", " ", c.activity.sourceUrl ? link({ url: c.activity.sourceUrl, label: "fonte" }) : ""), c.group ? `${c.group.level}: ${c.group.note}` : "—"]))
          : text("small", "Nenhuma."),
        r.restoreSuggestions.length ? el("div", {}, text("strong", "Descartes automáticos a reconsiderar (texto próprio indica compra):"), table(["Empresa", "Motivo do descarte", "Evidência"], r.restoreSuggestions.map((c) => [c.name, c.dismissReason, c.purchaseEvidence.consumption?.text || c.activity.evidence || "—"]))) : null,
        r.dismissedInvestigated.length ? el("div", {}, text("small", "Descartadas com atividade investigada:"), el("ul", {}, ...r.dismissedInvestigated.map((c) => el("li", {}, `${c.name}: ${c.activity.typeLabel}${c.group ? ` · grupo (${c.group.level})` : ""}`)))) : null,
      ),
    ),
    details(
      `Sites inacessíveis à Cloudflare (${r.unreachable.length}) — estado técnico, não ausência de empresa ou contato`,
      el("div", { class: "rows" }, ...(r.unreachable.length ? r.unreachable.map((u) => details(`${u.name}${u.city ? ` · ${u.city}` : ""} (${u.httpStatus ? `HTTP ${u.httpStatus}` : "sem resposta"}, ${(u.checkedAt || "").slice(0, 10)})`, el("ul", {}, ...u.assisted.map((l) => el("li", {}, link(l)))))) : [text("small", "Nenhum.")])),
    ),
  );
  showScreen(node);
}

async function showForeignSearch(id, preloaded) {
  const x = preloaded || (await api(`/api/foreign-searches/${id}`));
  state.searchId = x.id;
  state.searchProductId = x.commodity.productId;
  state.searchCampaignId = x.campaign.id;
  const node = section(`${x.country.name_pt} · ${x.commodity.label || x.commodity.name}`, `Busca de empresas compradoras (SH6 ${x.commodity.hs6.join(", ")}) · porte-alvo: ${x.target.sizesLabel.join(" e ")} · ${x.status === "open" ? "aberta" : `encerrada em ${x.closedAt.slice(0, 10)}`}`);
  node.setAttribute("data-screen", "internacional");
  node.append(
    el(
      "div",
      { class: "toolbar" },
      button("Voltar ao Radar", () => navigate("Radar Internacional")),
      button("Revisão para decisão", () => showDecisionReview(x.id), true),
      writable()
        ? moreMenu(
            "Mais ações",
            button("Pesquisar pessoas de compras (lote de 5 empresas aderentes)", async () => {
              const r = await api(`/api/foreign-searches/${x.id}/people/research`, "POST", {});
              notice(`${r.researched} empresa(s) pesquisada(s), ${r.added} pessoa(s) a validar; faltam ${r.remaining}. Veja "Pessoas de compras" em cada empresa.`);
            }),
          )
        : null,
    ),
    text("p", x.notice, "notice-fixed"),
  );
  if (x.humanSteps.length) node.append(panel("O que ainda depende de você", el("ul", {}, ...x.humanSteps.map((h) => el("li", {}, h)))));
  const m = x.metrics;
  const totalCandidates = x.groups.consumers.length + x.groups.toConfirm.length + x.groups.traders.length + x.groups.unverified.length;
  const metricsBox = details(
    "Cobertura, custo e rendimento da busca",
    el(
      "div",
      { class: "grid" },
      el("div", { class: "stat" }, text("h3", "Cobertura"), text("p", `${m.coverage.sourcesConsulted} fonte(s) consultada(s), ${m.coverage.sourcesWithResults} com resultado`), text("p", m.coverage.note, "muted")),
      el("div", { class: "stat" }, text("h3", "Custo"), text("p", `${m.cost.apiCalls} chamada(s) · ${usd(m.cost.costUsd)} · ${m.cost.minutes} min registrados · ${m.cost.elapsedHours} h desde a autorização`), text("p", m.cost.validCandidates ? `Por candidata válida (${m.cost.validCandidates}): ${usd(m.cost.costPerValidUsd)} e ${m.cost.secondsPerValid} s de consulta` : "Ainda sem candidata válida (com sinal próprio).")),
      el(
        "div",
        { class: "stat" },
        text("h3", "Rendimento"),
        text("p", `${m.yield.found} encontrada(s) pelas fontes gratuitas (${m.yield.foundPending} aguardando decisão, ${m.yield.foundDismissed} descartada(s)) · ${m.yield.candidates} na busca: ${m.yield.consumers} consumidora(s)/processadora(s), ${m.yield.traders} trader(s) · ${m.yield.inTargetSize} no porte-alvo`),
        text("p", `${m.yield.withImportSignal} candidata(s) importadora(s) (evidência ou sinal próprio) · ${m.yield.unverified} com importação não verificada · ${m.yield.withOwnEvidence} com evidência própria`),
        text("p", `${m.yield.confirmedImporters} importadora(s) confirmada(s) · ${m.yield.confirmedBuyers} compradora(s) confirmada(s) · ${m.yield.potentialBuyers} potencial(is) a validar · ${m.yield.withVerifiedDecisionMaker} com decisor com fonte · ${m.yield.eligibleForFicha} apta(s) a ficha`),
      ),
    ),
  );
  const discovery = details(totalCandidates ? "Descobrir mais empresas (fontes gratuitas)" : "Descobrir empresas (fontes gratuitas)", await discoveryPanel(x));
  if (!totalCandidates) discovery.open = true;
  const groups = [
    ["Importadoras — consumidoras finais, fábricas e processadoras", x.groups.consumers],
    ["Importadoras — perfil a confirmar", x.groups.toConfirm],
    ["Importadoras — traders e distribuidores (prioridade secundária)", x.groups.traders],
  ];
  // Só grupos com empresas ocupam espaço; os vazios viram uma linha.
  for (const [title, list] of groups) if (list.length) node.append(panel(`${title} (${list.length})`, rows(list, companyResult)));
  const emptyGroups = groups.filter(([, list]) => !list.length).map(([title]) => title.replace(/^Importadoras — /, ""));
  if (emptyGroups.length) node.append(text("p", `Sem empresas importadoras ainda em: ${emptyGroups.join("; ")}.`, "muted"));
  // Sem sinal próprio de importação a empresa não é candidata importadora: fica recolhida, aguardando validação.
  const unverified = details(`Importação não verificada — usam a commodity, sem sinal próprio de importação (${x.groups.unverified.length})`, rows(x.groups.unverified, companyResult));
  if (x.groups.unverified.length && !groups.some(([, list]) => list.length)) unverified.open = true;
  node.append(unverified);
  node.append(discovery, metricsBox);
  // Descartadas nesta busca (empresa/produto): ficam visíveis com motivo, data e opção de voltar.
  if (x.dismissed?.length)
    node.append(
      details(
        `Descartadas nesta busca (${x.dismissed.length})`,
        el("ul", {}, ...x.dismissed.map((c) => el("li", {}, `${c.name} — ${c.triage.dismissReason} (${(c.triage.decidedAt || "").slice(0, 10)}) `, writable() && x.status === "open" ? button("Voltar para a busca", async () => { await api(`/api/foreign-searches/${x.id}/candidates/${c.id}`, "PATCH", { action: "restore" }); await showForeignSearch(x.id); }) : null))),
      ),
    );
  const byGroup = new Map();
  for (const l of x.researchPlan.links) (byGroup.get(l.group) || byGroup.set(l.group, []).get(l.group)).push(l);
  node.append(
    details(
      "Roteiro de pesquisa (links montados, abertos só por você)",
      el("div", {}, text("p", x.researchPlan.note, "muted"), ...[...byGroup].map(([g, ls]) => el("div", {}, text("strong", g), el("ul", {}, ...ls.map((l) => el("li", {}, el("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, l.label))))))),
    ),
    details(
      `Fontes consultadas (${x.sources.length})`,
      rows(x.sources, (s) => el("div", { class: "row" }, el("div", {}, text("strong", s.label), text("small", `${s.kind} · ${s.results} resultado(s) · ${s.minutes ?? 0} min · ${s.apiCalls} chamada(s) · ${usd(s.costUsd)}${s.query ? ` · consulta: ${s.query}` : ""}${s.note ? ` · ${s.note}` : ""}`)))),
    ),
  );
  if (x.status === "open" && writable()) {
    const kinds = [["web_research", "Pesquisa na web"], ["public_directory", "Diretório público"], ["official_registry", "Registro oficial de empresas"], ["company_website", "Site da empresa"], ["trade_fair", "Feira/associação"], ["paid_database", "Base paga (exige decisão)"], ["adapter", "Adaptador automático"]];
    node.append(
      details(
        "Registrar fonte consultada (mesmo sem resultado)",
        makeForm(
          [input("Fonte", "sourceLabel"), select("Tipo", "sourceKind", kinds), input("Consulta usada", "queryText", "text", "", false), input("Resultados úteis", "resultCount", "number", "0", false), input("Minutos gastos", "minutes", "number", "", false), input("Chamadas de API", "apiCalls", "number", "0", false), input("Custo (US$)", "costUsd", "number", "0", false), input("Referência da decisão (base paga)", "decisionRef", "text", "", false), input("Observação", "note", "text", "", false)],
          async (v) => {
            await api(`/api/foreign-searches/${x.id}/sources`, "POST", {
              sourceLabel: v.sourceLabel, sourceKind: v.sourceKind, queryText: v.queryText || undefined, resultCount: v.resultCount || 0, minutes: v.minutes || undefined,
              apiCalls: v.apiCalls || 0, costUsd: v.costUsd || 0, decisionRef: v.decisionRef || undefined, note: v.note || undefined,
            });
            await showForeignSearch(x.id);
          },
          "Registrar fonte",
        ),
      ),
      details(
        "Registrar empresa encontrada",
        makeForm(
          [
            input("Razão social", "legalName"),
            input("Registro (número)", "registrationId", "text", "", false),
            input("Tipo de registro (ex.: HRB, CRN, EIN)", "registrationIdType", "text", "", false),
            input("Onde foi encontrada (fonte)", "sourceLabel"),
            input("URL da fonte", "sourceUrl", "url", "", false),
            select("Fonte registrada nesta busca", "sourceId", [["", "—"], ...x.sources.map((s) => [s.id, s.label])]),
            input("Site da empresa", "website", "url", "", false),
            input("Atividade (o que a empresa faz)", "activityText", "text", "", false),
            input("Fonte da atividade", "activitySource", "text", "", false),
            select("Nome parecido com outra empresa do país", "confirmDistinct", [["false", "Conferir antes"], ["true", "Já conferi: é outra empresa"]]),
          ],
          async (v) => {
            await api(`/api/foreign-searches/${x.id}/candidates`, "POST", {
              legalName: v.legalName, registrationId: v.registrationId || undefined, registrationIdType: v.registrationIdType || undefined, sourceLabel: v.sourceLabel, sourceUrl: v.sourceUrl || undefined,
              sourceId: v.sourceId || undefined, website: v.website || undefined, activityText: v.activityText || undefined, activitySource: v.activitySource || undefined, confirmDistinct: v.confirmDistinct === "true",
            });
            notice("Empresa registrada como potencial compradora a validar. Porte, perfil, evidências e decisores ficam na página da empresa.");
            await showForeignSearch(x.id);
          },
          "Registrar empresa",
        ),
      ),
    );
  }
  if (x.status === "open" && approver())
    node.append(details("Encerrar a busca", makeForm([input("Observação de encerramento", "note", "textarea")], async (v) => showForeignSearch((await api(`/api/foreign-searches/${x.id}/close`, "POST", { note: v.note })).id), "Encerrar")));
  showScreen(node);
}

async function listaMensalView() {
  const d = await api("/api/trade-list/versions");
  const node = section("Lista mensal", "Rotina mensal das compras por país (Comtrade) e das exportações do Brasil (MDIC). País que falha mantém a versão anterior.");
  node.append(
    kv([
      ["Chamadas à Comtrade no último dia registrado", d.comtradeBudget ? `${d.comtradeBudget.used} em ${d.comtradeBudget.day}` : "nenhuma"],
    ]),
    rows(d.items, (v) => {
      const count = (source, state) => v.states.filter((x) => x.source === source && x.state === state).reduce((t, x) => t + x.n, 0);
      return el(
        "div",
        { class: "row" },
        el(
          "div",
          {},
          text("strong", `${v.id}${v.kind === "manual" ? ` (manual, ${v.iso3})` : ""}`),
          text(
            "small",
            `Comtrade: ${count("comtrade", "purchase_identified")} com compra, ${count("comtrade", "not_declared")} sem declaração, ${count("comtrade", "data_unavailable")} indisponíveis · MDIC: ${count("mdic", "purchase_identified")} com compra, ${count("mdic", "no_record")} sem registro, ${count("mdic", "data_unavailable")} indisponíveis · jobs ${Object.entries(v.jobs).map(([k, n]) => `${k} ${n}`).join(", ")}`,
          ),
          v.comtrade_blocked ? text("small", `Comtrade parada: ${v.comtrade_blocked === "no_key" ? "chave não configurada" : "chave recusada"}.`, "error") : null,
          v.note ? text("small", v.note) : null,
        ),
        text("span", v.status === "running" ? "Em andamento" : v.status === "complete" ? "Completa" : v.status === "partial" ? "Parcial" : "Falhou", "tag"),
        admin() && v.status === "running" && v.comtrade_blocked
          ? button("Retomar Comtrade", async () => {
              await api(`/api/trade-list/versions/${v.id}/resume`, "POST", {});
              await navigate("Lista mensal");
            })
          : null,
      );
    }),
  );
  if (admin())
    node.append(
      details(
        "Rodar a rotina do mês agora",
        makeForm([input("Motivo (mínimo 10 caracteres)", "reason", "textarea")], async (x) => {
          const r = await api("/api/trade-list/run", "POST", { reason: x.reason });
          notice(`Rotina ${r.versionId}: ${r.resumed ? "retomada" : r.status === "running" ? "iniciada" : r.status}.`);
          await navigate("Lista mensal");
        }, "Rodar"),
      ),
      details(
        "Atualizar um país (1 por dia)",
        makeForm([input("País (ISO-3, ex.: DEU)", "iso3"), input("Motivo (mínimo 10 caracteres)", "reason", "textarea")], async (x) => {
          const r = await api(`/api/trade-list/refresh/${encodeURIComponent(x.iso3.trim().toUpperCase())}`, "POST", { reason: x.reason });
          notice(`Atualização ${r.versionId} iniciada.`);
          await navigate("Lista mensal");
        }, "Atualizar país"),
      ),
    );
  return node;
}

// Empresa no exterior: condições R12.10 com evidência e porte com fonte.
function internationalPanels(id, data) {
  if (data.company.country_code === "BR") return [];
  const nodes = [];
  const byProduct = new Map();
  for (const c of data.conditions || []) (byProduct.get(c.product_id) || byProduct.set(c.product_id, []).get(c.product_id)).push(c);
  for (const [productId, list] of byProduct) {
    const pname = state.products.find((p) => p.id === productId)?.variant_name || productId;
    nodes.push(
      panel(
        `Condições R12.10 · ${pname}`,
        text("p", "Cada condição só é confirmada por evidência da própria empresa que diga o que sustenta. Dado do país nunca confirma.", "muted"),
        rows(list, (c) =>
          el("div", { class: "row" }, el("div", {}, text("strong", conditionLabels[c.condition]), text("small", c.evidence_id ? `Evidência ${c.evidence_id.slice(0, 8)}` : c.note || "Sem evidência")), text("span", c.status === "confirmed" ? "Confirmada" : c.status === "not_found" ? "Não encontrada" : "Pendente", "tag")),
        ),
        writable()
          ? details(
              "Registrar condição",
              makeForm(
                [
                  select("Condição", "condition", Object.entries(conditionLabels)),
                  select("Estado", "status", [["confirmed", "Confirmada"], ["not_found", "Não encontrada"], ["pending", "Pendente"]]),
                  select("Evidência (da empresa, validada)", "evidenceId", [["", "Nenhuma"], ...data.evidence.filter((e) => e.category !== "market").map((e) => [e.id, `${e.evidence_type} · ${e.reference}`])]),
                  input("Nota (onde procurou, se não encontrada)", "note", "textarea", "", false),
                ],
                async (v) => {
                  await api(`/api/companies/${id}/conditions/${productId}/${v.condition}`, "PUT", { status: v.status, evidenceId: v.evidenceId || undefined, note: v.note || undefined });
                  notice("Condição registrada.");
                  await showCompany(id);
                },
                "Registrar",
              ),
            )
          : null,
      ),
    );
  }
  nodes.push(
    panel(
      "Porte no exterior",
      kv([["Faixa", { micro: "Micro/MEI", small: "Pequena", medium: "Média", medium_plus: "Média-mais", giant: "Gigante" }[data.company.size_class ?? data.company.size_band] || "Não informado"], ["Fonte", data.company.size_source], ["Conferido em", data.company.size_checked_at]]),
      approver()
        ? details(
            "Registrar porte",
            makeForm(
              [select("Faixa", "sizeBand", [["micro", "Micro/MEI (< 10 pessoas)"], ["small", "Pequena (10–49)"], ["medium", "Média (50–249)"], ["medium_plus", "Média-mais (250+)"], ["giant", "Gigante do setor"]]), input("Fonte do porte", "source")],
              async (v) => {
                await api(`/api/companies/${id}/size`, "PATCH", v);
                notice("Porte registrado; ICP refeito.");
                await showCompany(id);
              },
              "Registrar porte",
            ),
          )
        : null,
    ),
  );
  return nodes;
}

// ===== Rodadas de descoberta e qualificação (fluxo geral; configuração por rodada) =====
const ROUND_STATUS = {
  qualified_purchase: ["Uso e compra comprovados", "ok"],
  qualified_use: ["Uso comprovado", "ok"],
  discovery: ["Descoberta", ""],
  exception: ["Exceção", "warn"],
  separated: ["Revenda/trader (separada)", ""],
  outside: ["Fora do raio", ""],
};
const LEVEL_TAG = { supported: ["Suportado", "ok"], partial: ["Parcial", "warn"], unsupported: ["Sem suporte", "bad"] };
const INTAKE_LABEL = { automatic: "descoberta automática", import: "importação", assisted: "pesquisa assistida", legacy: "formato antigo" };
const DECISION_LABEL = { accept: "Aceita para cadastro", include: "Exceção incluída", reject: "Recusada", defer: "Adiada" };
const PROOF_LABEL = { proved: "comprovado", indication: "indício", none: "sem evidência" };
const tag = (label, cls = "") => text("span", label, `tag ${cls}`.trim());

// Limitações da rodada em linguagem de uso. O texto técnico do servidor continua disponível na expansão.
function plainArea(area) {
  const src = /^fonte (.+)$/.exec(area);
  if (src) return sourceName(src[1]);
  const seg = /^segmentos × (.+)$/.exec(area);
  if (seg) return `Segmentos em ${sourceName(seg[1])}`;
  return { geografia: "Localização e área", "proximidade do limite": "Perto do limite do raio", identificador: "Identificação das empresas", "descoberta automática": "Busca automática", "cadastro oficial": "Dados cadastrais oficiais", "prova de uso e compra": "Prova de uso e compra", "triagem de sanções": "Triagem de sanções" }[area] ?? area;
}
function plainMessage(x) {
  const src = /^fonte (.+)$/.exec(x.area);
  if (src) return x.level === "unsupported" ? `Não será usada: ${x.message.replace(/^[^:]*:\s*/, "")}` : SOURCE_PLAIN[src[1]]?.[1] ?? x.message;
  const seg = /^segmentos × (.+)$/.exec(x.area);
  if (seg) {
    if (x.level === "unsupported") return `Nenhum segmento escolhido: ${sourceName(seg[1])} não sabe o que procurar.`;
    if (x.level === "partial") return `Alguns segmentos não têm regra de busca nesta fonte; eles ficam só com arquivo e pesquisa manual.`;
    return `Todos os segmentos têm regra de busca nesta fonte.`;
  }
  const M = {
    geografia: { supported: "A área é calculada pelos municípios oficiais a partir da cidade de origem e do raio.", partial: "Sem base de municípios deste país: a distância só é calculada quando a candidata tem coordenada da unidade.", unsupported: "Sem localização confirmada da cidade de origem neste país: a área e as distâncias não são calculadas." },
    identificador: { supported: "Empresas identificadas pelo CNPJ (unidade e matriz).", partial: "Sem regra de identificador para este país: duplicidades precisam de conferência." },
    "descoberta automática": { partial: "Há busca automática; o resultado é indício e precisa de conferência.", unsupported: "Sem busca automática utilizável: candidatas só por arquivo ou pesquisa manual." },
    "cadastro oficial": { supported: "Situação, atividade e endereço vêm da Receita Federal.", unsupported: "Sem fonte cadastral neste país: situação e endereço ficam pendentes." },
    "prova de uso e compra": { partial: "Uso e compra só são comprovados por fonte da própria empresa ou registro oficial; o resto é indício." },
    "triagem de sanções": { partial: "A triagem de sanções é feita depois do cadastro; o que depende dela continua bloqueado até ela existir e estar válida." },
    "proximidade do limite": { supported: "Empresas perto do limite do raio pedem conferência da localização; ninguém é excluído por isso." },
  };
  return M[x.area]?.[x.level] ?? x.message;
}

function roundConfigTemplate() {
  return {
    id: "nova-rodada",
    commodity: { code: "", label: "", segments: {} },
    buyer: { roles: ["final_consumer", "processor"], separate: ["reseller", "trader"] },
    origin: { country: "BR", region: "", municipality: "" },
    radius: { value: 150, unit: "km", method: "haversine" },
    nearLimit: { fraction: 0.1 },
    priorities: { size: [], segments: [] },
    // Fontes escolhidas no passo 3 conforme os segmentos; a Receita entra por padrão no Brasil.
    sources: [{ id: "br-cnpj-ws", kind: "registry", countries: ["BR"], rateLimitPerMinute: 3, maxAgeDays: 30 }],
    evidence: { confirming: ["own_source", "official_record"] },
    locale: { language: "pt-BR", timezone: "America/Sao_Paulo" },
    compliance: { scope: "br_email_automatic" },
  };
}

// Commodities da lista única do catálogo (GET /api/catalog → commodities): nenhuma lista paralela no painel.
const commodityName = (code) => (state.commodities ?? []).find((c) => c.code === code)?.label ?? code;
function catalogCommodities() {
  return (state.commodities ?? []).map((c) => ({ code: c.code, label: c.label, aliases: c.aliases, products: state.products.filter((p) => p.commodity === c.code && p.active !== 0) }));
}
const UF_NAMES = { AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins" };
// Nomes de uso das fontes; o identificador técnico fica nos detalhes.
const SOURCE_PLAIN = {
  "br-cnpj-ws": ["Receita Federal (consulta por CNPJ)", "Completa situação, atividade, porte e endereço de quem já tem CNPJ. Não procura empresas pelo nome."],
  "osm-overpass": ["Mapa colaborativo (OpenStreetMap)", "Procura estabelecimentos mapeados dentro do raio. Cobertura irregular; quase nunca traz CNPJ."],
  "mapa-sipeagro": ["Registros do MAPA (arquivo público)", "Estabelecimentos registrados no Ministério da Agricultura, por atividade. CNPJ incompleto; não prova uso nem compra."],
  "import-file": ["Arquivo de candidatas", "Lista própria em CSV ou JSON, com a fonte de cada linha."],
  assisted: ["Pesquisa manual com fonte", "Você registra cada empresa com o endereço da página que comprova."],
  casadosdados: ["Casa dos Dados (serviço pago)", "Não é usada sem autorização de despesa."],
  "company-site": ["Site da própria empresa", "CNPJ e e-mail geral publicados no site, respeitando o robots.txt."],
  "abic-certificados": ["Torrefadoras certificadas (ABIC)", "Lista pública de produtos certificados: nome do industrializador e estado da fábrica. Sem CNPJ nem município."],
  osm: ["Mapa colaborativo (OpenStreetMap)", "Procura estabelecimentos mapeados dentro do raio."],
  abic: ["Torrefadoras certificadas (ABIC)", "Nome do industrializador e estado da fábrica."],
};
const sourceName = (id) => SOURCE_PLAIN[id]?.[0] ?? id;
async function roundCatalogData() {
  return (state.roundCatalog ??= await api("/api/round-catalog"));
}
async function countriesData() {
  // A tabela de países é a dos importadores (Brasil fica de fora por ser o exportador); a origem pode ser o Brasil.
  if (!state.countries) {
    const list = (await api("/api/countries")).items.filter((c) => c.iso2);
    state.countries = list.some((c) => c.iso2 === "BR") ? list : [{ iso2: "BR", iso3: "BRA", name_pt: "Brasil", name_en: "Brazil" }, ...list];
  }
  return state.countries;
}
const slugKey = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

// Variedade com efeito na qualificação (aceitação da variedade fica pendente): vem do produto escolhido, nunca de um
// padrão. "não GMO" antes de "GMO" para não confundir.
const varietyOf = (p) => (!p ? undefined : /n[ãa]o[- ]?gmo/i.test(p.variant_name) ? "não GMO" : /\bgmo\b/i.test(p.variant_name) ? "GMO" : undefined);
// Dados calculáveis da rodada, a partir do país (só para rodada nova; a edição mantém o que já está registrado).
const localeFor = (iso) => (iso === "BR" ? { language: "pt-BR", timezone: "America/Sao_Paulo" } : { language: state.countries?.find((x) => x.iso2 === iso)?.default_language ?? "en", timezone: "UTC" });
const scopeFor = (iso) => `${String(iso).toLowerCase()}_email_automatic`;
// Fontes calculadas pelos segmentos: Receita no Brasil; mapa colaborativo e registros do MAPA só se algum segmento tem a
// regra. Na edição, nenhuma fonte já registrada é retirada sozinha (só se acrescenta a que um segmento novo pede).
function sourcesFor(iso, segments, existing) {
  const segs = Object.values(segments ?? {});
  const need = [];
  if (iso === "BR") need.push({ id: "br-cnpj-ws", kind: "registry", countries: ["BR"], rateLimitPerMinute: 3, maxAgeDays: 30 });
  if (segs.some((g) => g.discovery?.osm)) need.push({ id: "osm-overpass", kind: "discovery" });
  if (iso === "BR" && segs.some((g) => g.discovery?.sipeagro)) need.push({ id: "mapa-sipeagro", kind: "discovery" });
  if (!existing) return need;
  return [...existing, ...need.filter((n) => !existing.some((e) => e.id === n.id))];
}

// Configuração da rodada em 4 passos (criação e edição usam o mesmo percurso): commodity → local e raio → segmentos →
// revisar. Só o indispensável aparece; o que é calculável é preenchido internamente e o que já estava registrado é
// preservado (campos fora da tela nunca são apagados). Ajustes opcionais ficam na própria rodada, fora deste percurso.
function roundForm(initial, roundName, onSubmit, label) {
  const editing = !!roundName;
  const c = structuredClone(initial);
  const commodities = catalogCommodities();
  const form = el("form", { class: "wizard round-form", novalidate: "" });
  const error = el("p", { class: "error", hidden: "" });
  const fail = (msg) => {
    error.textContent = msg;
    error.hidden = false;
    error.scrollIntoView({ block: "nearest" });
    return false;
  };
  // Segmentos escolhidos (com as regras de busca que já tiverem).
  let segments = structuredClone(c.commodity?.segments ?? {});

  // ---------- Passo 1: commodity (seleção pesquisável do catálogo) e produto, só se houver mais de um compatível ----------
  const known = commodities.find((x) => x.code === c.commodity?.code);
  const commodity = comboBox({ label: "Commodity", name: "commodity", placeholder: "Digite para buscar (ex.: café, milho, farelo)", load: commodityItems, required: true });
  if (known) commodity.set({ id: known.code, label: known.label }, true);
  const commNote = el("p", { class: "form-hint", "aria-live": "polite" });
  const productBox = el("div", { class: "form-grid" });
  let code = known?.code ?? "";
  let productId = c.commodity?.productId ?? "";
  const legacyCode = c.commodity?.code && !known ? c.commodity.code : null;
  const renderProduct = () => {
    const list = commodities.find((x) => x.code === code)?.products ?? [];
    if (!list.some((p) => p.id === productId)) productId = list.length === 1 ? list[0].id : "";
    productBox.replaceChildren();
    if (list.length > 1) {
      const sel = select("Produto", "configProductId", [["", "Escolha o produto"], ...list.map((p) => [p.id, p.display_name ?? p.variant_name])], productId);
      sel.control.addEventListener("change", () => (productId = sel.control.value));
      productBox.append(sel.node);
    }
    const p = list.find((x) => x.id === productId);
    commNote.textContent = legacyCode && !code
      ? `A configuração registrada tem a commodity "${legacyCode}", que não corresponde ao catálogo. Escolha a commodity do catálogo para poder cadastrar empresas.`
      : !code
        ? ""
        : !list.length
          ? "Sem produto no catálogo para esta commodity: cadastre-o no Catálogo antes de cadastrar empresas."
          : list.length === 1
            ? `Produto: ${p.display_name ?? p.variant_name}${p.identity_status !== "confirmed" ? " (identidade pendente: pesquisa sim, ficha só depois da confirmação)" : ""}.`
            : p
              ? `O cadastro usará ${p.variant_name}${varietyOf(p) ? `; a aceitação de ${varietyOf(p)} fica como pendência a confirmar com cada empresa` : ""}.`
              : "Escolha o produto: há mais de uma variedade desta commodity no catálogo.";
  };
  commodity.onChange((it) => {
    const prev = code;
    code = it?.id ?? "";
    if (prev !== code) {
      // Trocar de commodity não leva produto nem segmentos sugeridos da anterior (ex.: ração do milho numa rodada de café).
      const presets = state.roundCatalog?.segmentPresets?.[prev] ?? {};
      const removed = Object.keys(segments).filter((k) => k in presets);
      segments = Object.fromEntries(Object.entries(segments).filter(([k]) => !(k in presets)));
      productId = "";
      if (removed.length) notice(`Segmentos de ${commodityName(prev)} retirados; escolha os de ${commodityName(code) || "nova commodity"} no passo 3.`);
    }
    renderProduct();
  });
  renderProduct();
  const step1 = el("fieldset", { class: "group" }, el("legend", {}, "Commodity"), el("div", { class: "form-grid" }, commodity.node), productBox, commNote);

  // ---------- Passo 2: local e raio ----------
  const o = c.origin ?? {};
  const country = comboBox({ label: "País", name: "country", placeholder: "Digite para buscar (ex.: Brasil, Argentina)", load: countryItems(false), required: true });
  const regionSel = select("Estado", "region", [["", "Escolha o estado"], ...Object.entries(UF_NAMES).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([k, v]) => [k, `${v} (${k})`])], String(o.region ?? "").toUpperCase());
  const regionTxt = input("Estado ou região", "regionText", "text", o.country !== "BR" ? o.region ?? "" : "", false);
  const cityCombo = comboBox({ label: "Cidade", name: "municipality", placeholder: "Digite o nome da cidade", load: cityItems(() => regionSel.control.value), remote: true, minChars: 0 });
  const city = { node: cityCombo.node, control: cityCombo.control };
  const cityFree = input("Cidade", "municipalityFree", "text", o.country !== "BR" ? o.municipality ?? "" : "", false);
  const cityStatus = el("p", { class: "form-hint", "aria-live": "polite" });
  const radius = input("Raio", "radius", "number", c.radius?.value ?? 150);
  radius.control.min = "1";
  const unit = select("Unidade", "unit", [["km", "km"], ["mi", "milhas"]], c.radius?.unit ?? "km");
  const abroadNote = el("div", { class: "callout warn", hidden: "" });
  let iso = o.country ?? "BR";
  let picked = o.country === "BR" && o.municipalityCode ? { code: String(o.municipalityCode), name: o.municipality, uf: String(o.region ?? "").toUpperCase() } : null;
  if (picked) cityCombo.set({ id: picked.code, label: picked.name, uf: picked.uf }, true);
  else if (o.country === "BR" && o.municipality) cityCombo.control.value = o.municipality;
  const keepCoord = typeof o.lat === "number" && typeof o.lon === "number" ? { lat: o.lat, lon: o.lon, label: o.label, country: o.country, municipality: o.municipality ?? "" } : null;
  const cityText = () => (iso === "BR" ? cityCombo.control.value : cityFree.control.value);
  const updateCityStatus = () => {
    if (iso !== "BR") return cityStatus.replaceChildren();
    if (picked && picked.uf === regionSel.control.value) cityStatus.replaceChildren(tag(`${picked.name}/${picked.uf}`, "ok"), " base oficial do IBGE");
    else cityStatus.textContent = regionSel.control.value ? "Digite e escolha a cidade na lista." : "Escolha o estado e depois a cidade.";
  };
  cityCombo.onChange((it) => {
    picked = it ? { code: it.id, name: it.label, uf: it.uf } : null;
    updateCityStatus();
  });
  const showCountry = () => {
    const br = iso === "BR";
    regionSel.node.hidden = !br;
    regionTxt.node.hidden = br;
    cityCombo.node.hidden = !br;
    cityFree.node.hidden = br;
    abroadNote.hidden = br || !iso;
    if (!br && iso) {
      const still = keepCoord && keepCoord.country === iso && (cityFree.control.value || "") === keepCoord.municipality;
      abroadNote.replaceChildren(
        text("strong", "Fora do Brasil. "),
        still ? "A localização registrada na versão anterior é mantida enquanto país e cidade não mudarem." : "O Compass ainda não localiza cidades pelo nome fora do Brasil: a rodada pode ser salva, mas área, busca no mapa e distâncias ficam indisponíveis.",
      );
    }
    updateCityStatus();
  };
  regionSel.control.addEventListener("change", () => {
    picked = null;
    cityCombo.clear();
    updateCityStatus();
  });
  cityFree.control.addEventListener("input", () => showCountry());
  country.onChange((it) => {
    iso = it?.id ?? null;
    picked = null;
    if (iso === "BR") cityCombo.clear();
    showCountry();
  });
  safe(async () => {
    const list = await countriesData();
    const cur = list.find((x) => x.iso2 === iso);
    if (cur) country.set({ id: cur.iso2, label: cur.name_pt }, true);
    showCountry();
  });
  const step2 = el("fieldset", { class: "group" }, el("legend", {}, "Local e raio"), el("div", { class: "form-grid" }, country.node, regionSel.node, regionTxt.node, el("div", { class: "city-field" }, city.node, cityStatus), cityFree.node, radius.node, unit.node), abroadNote);

  // ---------- Passo 3: segmentos compradores (as fontes são calculadas por eles) ----------
  const segBox = el("div", { class: "seg-box" });
  const renderStep3 = () => {
    const cat = state.roundCatalog;
    if (!cat) return segBox.replaceChildren(text("p", "Carregando…", "muted"));
    const presets = cat.segmentPresets[code] ?? {};
    const all = { ...presets, ...segments };
    const ruleText = (seg) => (seg.discovery?.osm || seg.discovery?.sipeagro ? `busca automática${seg.discovery?.osm ? " no mapa colaborativo" : ""}${seg.discovery?.sipeagro ? `${seg.discovery?.osm ? " e" : ""} nos registros do MAPA` : ""}` : "sem busca automática: arquivo e pesquisa manual");
    const custom = input("Nome do segmento", "customSegment", "text", "", false);
    const addBox = el("details", { class: "inline-add" }, el("summary", {}, "Adicionar outro segmento"), el("div", { class: "toolbar" }, custom.node, button("Adicionar", () => {
      const lbl = custom.control.value.trim();
      if (!lbl) throw new Error("Escreva o nome do segmento.");
      segments = { ...segments, [slugKey(lbl) || "segmento"]: { label: lbl } };
      renderStep3();
    })));
    const srcs = sourcesFor(iso, segments, editing ? c.sources ?? [] : null);
    segBox.replaceChildren(...[
      text("h3", `Quem compra ${commodityName(code)}?`),
      Object.keys(all).length
        ? el("div", { class: "pick-list" }, ...Object.entries(all).map(([k, seg]) => el("label", {}, el("input", { type: "checkbox", ...(k in segments ? { checked: "" } : {}), onchange: (e) => { if (e.target.checked) segments = { ...segments, [k]: segments[k] ?? presets[k] }; else { const { [k]: _, ...rest } = segments; segments = rest; } renderStep3(); } }), el("span", {}, text("strong", seg.label ?? k), text("small", ruleText(seg))))))
        : null,
      !Object.keys(presets).length ? el("div", { class: "callout warn" }, text("p", `O Compass não tem segmentos sugeridos para ${commodityName(code) || "esta commodity"}; nenhum de outra commodity é aplicado. Adicione quem compra (ex.: torrefação); sem regra de busca, as empresas entram por arquivo ou pesquisa manual.`)) : null,
      !Object.keys(segments).length ? el("div", { class: "callout warn" }, text("p", "Escolha ao menos um segmento para a busca automática ter o que procurar.")) : null,
      addBox,
      text("p", `Fontes: ${srcs.map((x) => sourceName(x.id)).join(", ") || "só arquivo e pesquisa manual"}. Arquivo e pesquisa manual com fonte ficam sempre disponíveis.`, "form-hint"),
    ].filter(Boolean));
  };
  const step3 = el("fieldset", { class: "group" }, el("legend", {}, "Segmentos compradores"), segBox);

  // ---------- Passo 4: revisar ----------
  const nameIn = input("Nome da rodada", "name", "text", roundName ?? "");
  let nameTouched = editing;
  nameIn.control.addEventListener("input", () => (nameTouched = true));
  const review = el("div", { class: "review-grid", "aria-live": "polite" });
  const step4 = el("fieldset", { class: "group" }, el("legend", {}, "Revisar"), editing ? null : el("div", { class: "form-grid" }, nameIn.node), review);
  const steps = [step1, step2, step3, step4];
  const names = ["Commodity", "Local e raio", "Segmentos", "Revisar"];
  const stepList = el("ol", { class: "wizard-steps", "aria-label": "Passos da configuração" }, ...names.map((l, i) => el("li", {}, text("span", String(i + 1), "n"), text("span", l))));
  const back = el("button", { type: "button" }, "Voltar");
  const next = el("button", { type: "button", class: "primary" }, "Continuar");
  const submit = el("button", { type: "submit", class: "primary" }, label);
  let cur = 0;
  const buildConfig = () => {
    const num = (x) => (x === "" || x == null ? undefined : Number(String(x).replace(",", ".")));
    const p = state.products.find((x) => x.id === productId);
    const origin = { country: iso };
    if (iso === "BR") {
      origin.region = regionSel.control.value;
      origin.municipality = picked?.name ?? cityText().trim();
      if (picked) origin.municipalityCode = picked.code;
    } else {
      if (regionTxt.control.value.trim()) origin.region = regionTxt.control.value.trim();
      if (cityText().trim()) origin.municipality = cityText().trim();
      if (keepCoord && keepCoord.country === iso && (cityText().trim() || "") === keepCoord.municipality) Object.assign(origin, { lat: keepCoord.lat, lon: keepCoord.lon, ...(keepCoord.label ? { label: keepCoord.label } : {}) });
    }
    const sameCommodity = code === c.commodity?.code;
    // Mantém tudo o que já está registrado (especificação, regras, comprador, prioridades, evidência, faixa perto do limite,
    // idioma, fuso, compliance, fase da pesquisa); só muda o que esta tela controla.
    const out = {
      ...c,
      commodity: {
        ...(sameCommodity ? c.commodity : { nameHints: [], restrictionHints: [] }),
        code,
        label: sameCommodity && c.commodity?.label ? c.commodity.label : commodityName(code),
        productId: productId || undefined,
        variety: sameCommodity && c.commodity?.variety && (!p || !varietyOf(p) || varietyOf(p) === c.commodity.variety) ? c.commodity.variety : varietyOf(p),
        segments,
      },
      sources: sourcesFor(iso, segments, editing ? c.sources ?? [] : null),
      origin,
      radius: { ...(c.radius ?? {}), value: num(radius.control.value), unit: unit.control.value, method: c.radius?.method ?? "haversine" },
      locale: editing && c.locale?.language && c.locale?.timezone ? c.locale : localeFor(iso),
      compliance: editing && c.compliance?.scope ? c.compliance : { ...(c.compliance ?? {}), scope: scopeFor(iso) },
    };
    if (!sameCommodity) delete out.commodity.spec;
    if (out.commodity.variety === undefined) delete out.commodity.variety;
    if (!editing) {
      const slug = (nameIn.control.value || "rodada").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      out.id = slug || "rodada";
    }
    return out;
  };
  const autoName = () => {
    const p = state.products.find((x) => x.id === productId);
    const where = iso === "BR" ? `${picked?.name ?? cityText().trim()}/${regionSel.control.value}` : [cityText().trim(), state.countries?.find((x) => x.iso2 === iso)?.name_pt].filter(Boolean).join(", ");
    return `${commodityName(code)}${varietyOf(p) ? ` ${varietyOf(p)}` : ""} — ${where}, ${radius.control.value} ${unit.control.value === "mi" ? "mi" : "km"}`;
  };
  // Validação de cada passo (no Brasil, a cidade precisa existir na base oficial no estado escolhido).
  const validate = async (i) => {
    if (i === 0) {
      await commodity.resolve();
      if (!code) return fail("Escolha a commodity na lista.");
      if (!productId) return fail(commodities.find((x) => x.code === code)?.products.length ? "Escolha o produto." : "Sem produto no catálogo para esta commodity: cadastre-o no Catálogo antes.");
    }
    if (i === 1) {
      await country.resolve();
      if (!iso) return fail("Escolha o país na lista.");
      if (!(Number(radius.control.value) > 0)) return fail("Informe o raio.");
      if (iso === "BR") {
        if (!regionSel.control.value) return fail("Escolha o estado.");
        const q = cityText().trim();
        if (!q) return fail("Escolha a cidade.");
        if (!picked || normKey(picked.name) !== normKey(q) || picked.uf !== regionSel.control.value) {
          const res = await api(`/api/geo/municipalities?uf=${regionSel.control.value}&q=${encodeURIComponent(q)}`);
          const exact = res.items.filter((m) => normKey(m.name) === normKey(q));
          if (exact.length !== 1) return fail(`"${q}" não foi encontrada em ${UF_NAMES[regionSel.control.value]}. Escolha a cidade na lista.`);
          picked = exact[0];
          cityCombo.set({ id: picked.code, label: picked.name, uf: picked.uf }, true);
          updateCityStatus();
        }
      }
    }
    if (i === 3 && !editing && !nameIn.control.value.trim()) return fail("Dê um nome à rodada.");
    return true;
  };
  const renderReview = () => {
    if (!editing && !nameTouched) nameIn.control.value = autoName();
    const v = buildConfig();
    const prod = state.products.find((p) => p.id === v.commodity.productId);
    const where = v.origin.country === "BR" ? `${v.origin.municipality}/${v.origin.region}` : [v.origin.municipality, v.origin.region, state.countries?.find((x) => x.iso2 === v.origin.country)?.name_pt ?? v.origin.country].filter(Boolean).join(", ");
    const segs = Object.values(v.commodity.segments ?? {});
    const box = (title, pairs) => el("div", {}, text("h3", title), el("dl", {}, ...pairs.flatMap(([k, x]) => [text("dt", k), text("dd", x)])));
    const warns = [];
    if (!segs.length) warns.push("Sem segmento escolhido: a busca automática não terá o que procurar.");
    if (v.origin.country !== "BR" && typeof v.origin.lat !== "number") warns.push("Fora do Brasil sem localização confirmada: área e distâncias não serão calculadas.");
    review.replaceChildren(
      box("Objetivo", [["Commodity", commodityName(v.commodity.code)], ["Produto", prod?.variant_name ?? "—"], ["Origem", where], ["Raio", `${v.radius.value} ${v.radius.unit === "mi" ? "milhas" : "km"}`], ["Segmentos", segs.map((s) => s.label).join(", ") || "nenhum"]]),
      el("div", {}, text("h3", "Depois de salvar"), text("p", "Salvar não executa nem faz contato. Na rodada: conferir as limitações, registrar ciência, trazer candidatas e executar.", "muted"), ...warns.map((w) => text("p", w, "warn-text"))),
    );
  };
  const show = (i) => {
    cur = i;
    steps.forEach((s, k) => (s.hidden = k !== i));
    submit.hidden = i !== 3;
    next.hidden = i === 3;
    back.disabled = i === 0;
    [...stepList.children].forEach((li, k) => {
      li.className = k === i ? "current" : k < i ? "before" : "";
      li.setAttribute("aria-current", k === i ? "step" : "false");
    });
    if (i === 2) safe(async () => (await roundCatalogData(), renderStep3()));
    if (i === 3) renderReview();
  };
  next.addEventListener("click", () =>
    safe(async () => {
      next.disabled = true;
      try {
        error.hidden = true;
        if (await validate(cur)) show(cur + 1);
      } finally {
        next.disabled = false;
      }
    }),
  );
  back.addEventListener("click", () => show(Math.max(0, cur - 1)));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (cur < 3) return next.click();
    submit.disabled = true;
    error.hidden = true;
    try {
      for (const k of [0, 1, 2, 3]) if (!(await validate(k))) return show(k);
      await onSubmit(editing ? roundName : nameIn.control.value.trim(), buildConfig());
    } catch (err) {
      fail(err.message);
    } finally {
      submit.disabled = false;
    }
  });
  safe(roundCatalogData);
  form.append(stepList, ...steps, error, el("div", { class: "wizard-nav" }, back, next, submit));
  show(0);
  return form;
}

// Ajustes opcionais de uma rodada existente, fora do percurso principal: cada um grava uma revisão nova da configuração
// (a ciência das limitações precisa ser registrada de novo), sem tocar no resto do que está registrado.
function roundAdjust(r, title, hint, fields, apply) {
  return details(
    title,
    makeForm([{ group: title, hint, fields }], async (v) => {
      const config = apply(structuredClone(r.config), v);
      await api(`/api/rounds/${r.id}`, "PUT", { expectedRevision: r.revision, config });
      notice("Configuração salva (nova revisão). Registre ciência das limitações de novo antes de executar.");
      await showRound(r.id);
    }, "Salvar"),
  );
}

async function rodadasView() {
  const node = section("Rodadas", "Descoberta e qualificação configuradas por rodada: commodity, origem, raio, fontes e critérios. Nada aqui faz contato ou libera envio.");
  const list = (await api("/api/rounds")).items;
  const where = (o) => (o?.municipality ? `${o.municipality}/${o.region ?? ""}` : o?.label ?? (typeof o?.lat === "number" ? "coordenada registrada" : "sem localização"));
  node.append(
    panel(
      "Rodadas",
      rows(list, (r) =>
        el(
          "div",
          { class: "row" },
          el("div", {}, text("strong", r.name), text("small", `${commodityName(r.commodity) ?? "—"}${r.variety ? ` ${r.variety}` : ""} · ${where(r.origin)} · ${r.radius?.value} ${r.radius?.unit} · ${r.lastRun ? `${r.lastRun.total} estabelecimentos, ${r.lastRun.review} para revisar` : "ainda não executada"}`)),
          tag(r.status === "draft" ? "Rascunho" : r.status === "closed" ? "Encerrada" : "Ativa", r.status === "active" ? "ok" : ""),
          button("Abrir", () => showRound(r.id)),
        ),
      ),
    ),
  );
  if (writable())
    node.append(
      (() => {
        const box = details(
          "Nova rodada",
          roundForm(roundConfigTemplate(), "", async (name, config) => {
              const r = await api("/api/rounds", "POST", { name, config });
              notice("Rodada criada. Confira a área e as limitações antes de executar.");
              await showRound(r.id);
            }, "Criar rodada"),
        );
        box.classList.add("wizard-box");
        if (state.openWizard) {
          box.open = true;
          state.openWizard = false;
          setTimeout(() => box.scrollIntoView({ block: "start" }), 0);
        }
        return box;
      })(),
    );
  return node;
}

function downloadFile(name, content, type) {
  const link = el("a", { href: URL.createObjectURL(new Blob([content], { type })), download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Envia linhas em partes de até ~48 KB (limite de 64 KB por requisição), repetindo o cabeçalho em cada parte.
async function postInParts(path, lines, header, makeBody) {
  const totals = { added: 0, duplicates: 0, received: 0, errors: [], skipped: null };
  let part = [], size = 0;
  const flush = async () => {
    if (!part.length) return;
    const r = await api(path, "POST", makeBody([header, ...part].join("\n")));
    totals.added += r.added;
    totals.duplicates += r.duplicates;
    totals.received += r.received;
    totals.errors.push(...(r.errors ?? []));
    if (r.skipped) totals.skipped = Object.fromEntries(Object.entries(r.skipped).map(([k, v]) => [k, (totals.skipped?.[k] ?? 0) + v]));
    part = [];
    size = 0;
  };
  for (const l of lines) {
    if (size + l.length > 48000) await flush();
    part.push(l);
    size += l.length + 1;
  }
  await flush();
  return totals;
}

const normKey = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function showRound(id) {
  const r = await api(`/api/rounds/${id}`);
  const base = `/api/rounds/${id}`;
  const o = r.config.origin ?? {};
  const node = section(r.name, `${commodityName(r.config.commodity?.code)}${r.config.commodity?.variety ? ` ${r.config.commodity.variety}` : ""} · origem ${o.municipality ? `${o.municipality}${o.region ? `/${o.region}` : ""}` : o.label ?? "sem localização"} (${o.country}) · raio ${r.config.radius?.value} ${r.config.radius?.unit === "mi" ? "milhas" : "km"}`);
  const pf = r.preflight;
  node.dataset.step = "0";
  state.ctxRound = { id, name: r.name };
  // 1. Limitações antes da execução, em linguagem de uso; o texto técnico completo fica na expansão.
  const lvlN = (l) => pf.items.filter((x) => x.level === l).length;
  const notCovered = pf.items.filter((x) => x.level !== "supported");
  const limPanel = panel(
      "Antes de executar: limitações desta configuração",
      el("div", { class: pf.overall === "supported" ? "callout" : "callout warn" }, text("p", pf.overall === "supported" ? "Tudo coberto por esta configuração." : `${lvlN("supported")} coberto(s), ${lvlN("partial")} parcial(is), ${lvlN("unsupported")} sem suporte. O que é parcial ou sem suporte não é tratado como completo: registre ciência antes de executar.`)),
      notCovered.filter((x) => x.level === "unsupported").length ? rows(notCovered.filter((x) => x.level === "unsupported"), (x) => el("div", { class: "row" }, el("div", {}, text("strong", plainArea(x.area)), text("small", plainMessage(x))), tag(...LEVEL_TAG[x.level]))) : null,
      notCovered.some((x) => x.level === "partial") ? text("p", `Parciais: ${notCovered.filter((x) => x.level === "partial").map((x) => plainArea(x.area)).join(", ")}.`, "muted") : null,
      details("Ver detalhes das limitações", el("div", {}, rows(notCovered, (x) => el("div", { class: "row" }, el("div", {}, text("strong", plainArea(x.area)), text("small", plainMessage(x))), tag(...LEVEL_TAG[x.level]))), details(`Texto técnico dos ${pf.items.length} itens`, rows(pf.items, (x) => el("div", { class: "row" }, el("div", {}, text("strong", x.area), text("small", x.message)), tag(...LEVEL_TAG[x.level])))))),
      r.acknowledged
        ? text("small", String(r.acknowledged.by).startsWith("policy:") ? `Ciência coberta pela política de pesquisa de rotina (${r.acknowledged.by.replace("policy:", "")}) em ${fmtDate(r.acknowledged.at)} (revisão ${r.revision}); automação autorizada, não clique.` : `Ciência registrada por ${r.acknowledged.by} em ${fmtDate(r.acknowledged.at)} (revisão ${r.revision}).`, "muted")
        : writable() && pf.requiresAcknowledgement
          ? button("Registrar ciência das limitações", async () => {
              await api(`${base}/preflight-ack`, "POST", { revision: r.revision });
              notice("Ciência registrada.");
              await showRound(id);
            }, true)
          : null,
  );
  node.append(limPanel);

  // 2. Área calculada
  const areaBody = el("div", {}, text("p", "Calculando a área…", "muted"));
  const areaPanel = panel("Área da rodada", areaBody);
  node.append(areaPanel);
  const areaSummary = text("strong", "calculando…");
  api(`${base}/area`)
    .then((a) => {
      areaSummary.textContent = `${a.summary.municipalities} municípios (${a.summary.regions.join(", ") || "—"})`;
      areaBody.replaceChildren(
        text("p", `${a.summary.municipalities} municípios (${a.summary.regions.join(", ") || "—"}) até ${r.config.radius?.value} ${r.config.radius?.unit === "mi" ? "milhas" : "km"} de ${o.municipality ?? "origem"}${a.dataset ? ", pela base oficial do IBGE" : ""}. Perto do limite: ${a.criterion}.`),
        details(
          "Ver detalhes e municípios",
          el(
            "div",
            {},
            kv([
              ["Base", a.dataset ? "Municípios oficiais do IBGE" : "sem base de municípios: a distância só sai pela coordenada da unidade"],
              ["Raio", `${a.radiusKm} km`],
              ["Perto do limite", a.criterion],
              ["Municípios", `${a.summary.municipalities} (inteiros ${a.summary.full}, parciais ${a.summary.partial}, a conferir ${a.summary.review})`],
              ["UFs", a.summary.regions.join(", ") || "—"],
            ]),
            el("div", { class: "rows" }, ...a.municipalities.map((m) => el("div", { class: "row" }, el("div", {}, text("strong", `${m.name}/${m.region}`), text("small", `centroide ${m.centroidKm} km (estimativa) · alcance ${m.minKm}–${m.maxKm} km`)), m.review ? tag("conferir", "warn") : tag(m.coverage === "full" ? "inteiro" : "parcial")))),
            a.dataset ? text("small", `Base técnica: ${a.dataset}. Distância por haversine a partir do centroide do município de origem.`, "muted") : null,
          ),
        ),
      );
    })
    .catch((e) => {
      areaSummary.textContent = "indisponível";
      areaBody.replaceChildren(el("div", { class: "callout warn" }, text("p", e.message)));
    });

  // 3. Candidatas: automática, importação e pesquisa assistida
  const counts = r.candidates.length ? r.candidates.map((c) => `${INTAKE_LABEL[c.intake] ?? c.intake} · ${sourceName(c.source_id)}: ${c.n}`) : ["Nenhuma candidata ainda."];
  const cand = panel("Candidatas", el("ul", {}, ...counts.map((x) => text("li", x))));
  if (writable()) {
    const osmSegs = Object.values(r.config.commodity?.segments ?? {}).filter((g) => g.discovery?.osm);
    if ((r.config.sources ?? []).some((x) => x.id === "osm-overpass") && !osmSegs.length)
      cand.append(el("div", { class: "callout warn" }, text("p", "A busca no mapa colaborativo está escolhida, mas nenhum segmento tem regra para ela. Edite a configuração (Fontes e limites) ou traga candidatas por arquivo ou pesquisa manual.")));
    if ((r.config.sources ?? []).some((x) => x.id === "osm-overpass") && osmSegs.length)
      cand.append(
        el(
          "div",
          { class: "toolbar" },
          button("Buscar no mapa colaborativo (OpenStreetMap)", async () => {
            const q = await api(`${base}/osm-query`);
            // O servidor público do OSM recusa a Cloudflare: a consulta sai deste navegador.
            const res = await fetch(q.endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(q.query)}` });
            if (!res.ok) throw new Error(`O OpenStreetMap respondeu ${res.status}. Nada foi gravado; tente mais tarde.`);
            const data = await res.json();
            const els = (data.elements ?? []).map((e) => ({ type: e.type, id: e.id, lat: e.lat, lon: e.lon, center: e.center, tags: e.tags }));
            let added = 0, dup = 0, part = [];
            const send = async () => {
              if (!part.length) return;
              const x = await api(`${base}/candidates`, "POST", { intake: "automatic", source: "osm-overpass", elements: part });
              added += x.added;
              dup += x.duplicates;
              part = [];
            };
            for (const e of els) {
              if (JSON.stringify(part).length + JSON.stringify(e).length > 45000) await send();
              part.push(e);
            }
            await send();
            notice(`OpenStreetMap: ${els.length} objetos lidos; ${added} candidatas novas, ${dup} já existentes. Entram como indício, provisórias até conciliar.`);
            await showRound(id);
          }),
          text("small", "A busca no mapa é feita a partir deste navegador.", "muted"),
        ),
      );
    const file = el("input", { type: "file", accept: ".csv,.json,.txt", "aria-label": "Arquivo para importar" });
    const kind = select("Formato do arquivo", "kind", [["mapa-sipeagro", "MAPA SIPEAGRO (CSV oficial)"], ["csv", "Candidatas em CSV"], ["json", "Candidatas em JSON"]], "csv");
    cand.append(
      el(
        "div",
        { class: "toolbar" },
        kind.node,
        el("label", {}, "Arquivo", file),
        button("Importar", async () => {
          const f = file.files?.[0];
          if (!f) throw new Error("Escolha um arquivo.");
          const content = await f.text();
          let t;
          if (kind.control.value === "json") {
            const items = JSON.parse(content);
            t = { added: 0, duplicates: 0, errors: [] };
            for (let i = 0; i < items.length; i += 50) {
              const x = await api(`${base}/candidates`, "POST", { intake: "import", source: "import-file", format: "json", text: JSON.stringify(items.slice(i, i + 50)), label: f.name });
              t.added += x.added;
              t.duplicates += x.duplicates;
              t.errors.push(...x.errors);
            }
          } else {
            const [header, ...lines] = content.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
            let keep = lines;
            if (kind.control.value === "mapa-sipeagro") {
              // Só as linhas dos municípios da área seguem para o servidor (que confere de novo).
              const a = await api(`${base}/area`);
              const inArea = new Set(a.municipalities.map((m) => `${m.region}|${normKey(m.name)}`));
              keep = lines.filter((l) => {
                const p = l.split(";");
                return inArea.has(`${p[0]}|${normKey(p[1])}`);
              });
            }
            t = await postInParts(`${base}/candidates`, keep, header, (txt) =>
              kind.control.value === "mapa-sipeagro" ? { intake: "import", source: "mapa-sipeagro", text: txt } : { intake: "import", source: "import-file", format: "csv", text: txt, label: f.name },
            );
          }
          notice(`Importação: ${t.added} novas, ${t.duplicates} já existentes${t.skipped ? `; deixadas de fora: ${Object.entries(t.skipped).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}${t.errors.length ? `; avisos: ${t.errors.slice(0, 3).join(" ")}` : ""}.`);
          await showRound(id);
        }),
      ),
    );
    cand.append(
      details(
        "Pesquisa assistida: registrar candidata com fonte",
        makeForm(
          [
            input("Nome", "name"),
            input("CNPJ / identificador", "registrationId", "text", "", false),
            input("Município", "municipality", "text", "", false),
            input("UF", "region", "text", "", false),
            input("Segmento (código da configuração)", "segment", "text", "", false),
            input("Fonte (URL)", "sourceUrl", "url"),
            select("O que a fonte mostra", "kind", [["", "Só a existência"], ["operation", "Operação"], ["commodity_use", "Uso da commodity"], ["purchase", "Compra de terceiros"], ["resale", "Revenda"], ["restriction", "Restrição"]], ""),
            select("Tipo da fonte", "strength", [["own_source", "Fonte própria da empresa"], ["official_record", "Registro oficial"], ["press", "Imprensa"], ["directory", "Diretório"], ["search_summary", "Resumo de busca"]], "own_source"),
            input("Trecho que comprova", "quote", "textarea", "", false),
          ],
          async (v) => {
            await api(`${base}/candidates`, "POST", { intake: "assisted", candidate: { name: v.name, registrationId: v.registrationId, municipality: v.municipality, region: v.region, segment: v.segment, sourceUrl: v.sourceUrl, evidence: v.kind ? { kind: v.kind, strength: v.strength, quote: v.quote } : undefined } });
            notice("Candidata registrada.");
            await showRound(id);
          },
          "Registrar candidata",
        ),
      ),
    );
    cand.append(
      el(
        "div",
        { class: "toolbar" },
        button("Executar rodada", async () => {
          const s = await api(`${base}/run`, "POST", {});
          notice(`Rodada executada: ${s.total} estabelecimentos (novos ${s.counters.created}, alterados ${s.counters.updated}, sem mudança ${s.counters.unchanged}); ${s.review} para revisar${s.deferred ? `; ${s.deferred} consulta(s) adiada(s) por limite de requisições (interno ou da fonte): execute de novo em 1 a 2 minutos` : ""}${s.lookups?.failed ? `; ${s.lookups.failed} consulta(s) com falha` : ""}.`);
          await showRound(id);
        }, true),
      ),
    );
  }
  node.append(cand);

  // 4. Resultados, revisão e decisão em lote
  const results = r.results;
  const filter = select("Mostrar", "filter", [["review", "Exceções e conferências"], ["all", "Todos"], ["undecided", "Sem decisão"], ["registered", "Cadastrados"]], state.roundFilter ?? "review");
  const listBody = el("div", {});
  const selected = new Set();
  const render = () => {
    const v = (state.roundFilter = filter.control.value);
    const items = results.filter((x) => v === "all" || (v === "review" && x.needsReview) || (v === "undecided" && !x.decision) || (v === "registered" && x.registration));
    selected.clear();
    listBody.replaceChildren(
      rows(items, (x) => {
        const [stLabel, stCls] = ROUND_STATUS[x.status] ?? [x.status, ""];
        const box = el("input", { type: "checkbox", "aria-label": `Selecionar ${x.names[0]}`, onchange: (e) => (e.target.checked ? selected.add(x.key) : selected.delete(x.key)) });
        const a = x.assessment;
        const info = [
          `${x.registrationId ?? "sem identificador (provisória)"} · ${x.municipality ?? "município não informado"} · ${x.distance?.label ?? "distância desconhecida"}`,
          `Operação: ${PROOF_LABEL[a.operation.status] ?? a.operation.status} · uso: ${PROOF_LABEL[a.commodityUse.status] ?? a.commodityUse.status} · compra de terceiros: ${PROOF_LABEL[a.purchase.status] ?? a.purchase.status}${a.restriction.status !== "none_found" ? ` · restrição: ${a.restriction.status}` : ""}`,
          `Entrada: ${(x.intake ?? []).map((i) => INTAKE_LABEL[i] ?? i).join(", ") || "—"}${x.conciliatedFrom?.length ? ` · conciliada com ${x.conciliatedFrom.length} candidata(s) provisória(s)` : ""}`,
          x.status === "exception" ? `Exceção: ${x.reasons.join("; ")}` : null,
          x.checks?.length ? `Conferir: ${x.checks.join("; ")}` : null,
          x.decision ? `Decisão: ${DECISION_LABEL[x.decision.decision]} por ${x.decision.decided_by} em ${fmtDate(x.decision.decided_at)}${x.decision.note ? ` (${x.decision.note})` : ""}` : null,
          x.registration ? `Cadastro (${x.registration.outcome}): ${x.registration.label}${x.registration.decision ? ` — decisão ${DECISION_LABEL[x.registration.decision.value] ?? x.registration.decision.value} de ${x.registration.decision.decidedBy ?? "?"} em ${x.registration.decision.decidedAt ? fmtDate(x.registration.decision.decidedAt) : "?"}` : ""}. ${x.registration.operationText}` : null,
          x.screening ? `Triagem de sanções: ${x.screening.status}, ${x.screening.matches} ocorrência(s); válida até ${x.screening.validUntil ? fmtDate(x.screening.validUntil) : "não calculado"}${x.screening.valid ? "" : " (vencida ou incompleta)"}` : null,
          x.closure?.conflicts.length ? `Conflitos de fonte: ${x.closure.conflicts.length}` : null,
          x.closure?.contact.length ? `Para contato futuro: ${x.closure.contact.length} item(ns)` : null,
        ].filter(Boolean);
        const cl = x.closure;
        const list = (title, items, fmt) => details(`${title} (${items.length})`, items.length ? el("ul", {}, ...items.map((i) => text("li", fmt(i)))) : text("p", "Nenhum.", "muted"));
        const closureBox = cl
          ? details(
              `Fechamento: pesquisa pública ${cl.publicResearch === "closed" ? "encerrada" : "aberta"} · qualificação comercial ${cl.commercialQualification === "complete" ? "completa" : "incompleta"}`,
              el("div", {}, list("Verificado", cl.verified, (i) => i.text), list("Conflitos de fonte", cl.conflicts, (i) => `${i.text}${i.sources.length ? ` — ${i.sources.join(", ")}` : ""}`), list("Desconhecido", cl.unknown, (i) => `${i.text} (${PROOF_LABEL[i.level] ?? i.level})`), list("Para contato futuro", cl.contact, (i) => i.text)),
            )
          : null;
        return el(
          "div",
          { class: "row" },
          el("div", { class: "round-lines" }, el("label", { class: "round-pick" }, writable() ? box : null, text("strong", x.names.join(" / "))), ...info.map((l) => text("small", l)), closureBox, details("Pendências", el("ul", {}, ...x.pending.map((p) => text("li", p))))),
          tag(stLabel, stCls),
          x.checks?.length ? tag("conferir", "warn") : null,
        );
      }),
    );
  };
  filter.control.addEventListener("change", render);
  render();
  const withCl = results.filter((x) => x.closure);
  const phaseLine = withCl.length
    ? el("div", { class: "callout" }, text("p", `Pesquisa pública: ${withCl[0].closure.publicResearch === "closed" ? "encerrada" : "aberta"}. Qualificação comercial incompleta em ${withCl.filter((x) => x.closure.commercialQualification !== "complete").length} de ${withCl.length}: encerrar a pesquisa pública não conclui a qualificação nem promove a empresa. Pendências para contato futuro: ${withCl.reduce((n, x) => n + x.closure.contact.length, 0)}.`))
    : null;
  const lk = r.lastRun?.lookups;
  const lookupLine = lk ? text("small", `Consultas cadastrais na última execução: ${lk.fetched} feitas, ${lk.cached} reaproveitadas, ${lk.deferred} adiadas (limite de consultas por minuto; executar de novo retoma sem duplicar), ${lk.failed} com falha, ${lk.not_found} não encontradas, ${lk.unavailable} sem fonte, ${lk.not_applicable} sem identificador.`, "muted") : null;
  const resPanel = panel(
    "Resultados",
    phaseLine,
    lookupLine,
    text("small", r.lastRun ? `Última execução ${fmtDate(r.lastRunAt)}: ${r.lastRun.total} estabelecimentos, ${r.lastRun.exceptions} exceções, ${r.lastRun.review} para revisar.` : "Rodada ainda não executada.", "muted"),
    filter.node,
    listBody,
  );
  if (writable()) {
    const decision = select("Decisão para os selecionados", "decision", [["accept", "Aceitar para cadastro"], ["include", "Incluir exceção na descoberta"], ["defer", "Adiar"], ["reject", "Recusar"]], "accept");
    const note = input("Observação", "note", "text", "", false);
    resPanel.append(
      el(
        "div",
        { class: "toolbar part-conferir" },
        decision.node,
        note.node,
        button("Registrar decisão em lote", async () => {
          if (!selected.size) throw new Error("Selecione ao menos um estabelecimento.");
          const out = await api(`${base}/decisions`, "POST", { decisions: [...selected].map((key) => ({ key, decision: decision.control.value, note: note.control.value || undefined })) });
          const refused = out.outcomes.filter((x) => !x.ok);
          notice(`${out.outcomes.length - refused.length} decisão(ões) registrada(s) por ${out.decidedBy} em ${fmtDate(out.decidedAt)}.${refused.length ? ` Não registradas: ${refused.map((x) => `${x.key} (${x.reason})`).join("; ")}.` : ""}`, refused.length > 0);
          await showRound(id);
        }),
      ),
    );
    // Produto acompanha a configuração da rodada: só produtos da mesma commodity; definido na configuração, fica fixo.
    const allowed = state.products.filter((p) => p.commodity === r.config.commodity?.code);
    const fixed = allowed.find((p) => p.id === r.config.commodity?.productId);
    const prod = select("Produto", "productId", fixed ? [[fixed.id, fixed.variant_name]] : [["", "Escolha o produto"], ...allowed.map((p) => [p.id, p.variant_name])], fixed?.id ?? "");
    if (fixed) prod.control.disabled = true;
    const mode = select("Cadastro", "mode", [["discovery", "Descoberta (sem aprovação individual; sem exceções nem recusadas)"], ["accept", "Só as aceitas"]], "discovery");
    const screen = el("input", { type: "checkbox", name: "screening" });
    const authRef = input("Referência da autorização (opcional)", "authorizationRef", "text", "", false);
    if (!allowed.length)
      resPanel.append(el("div", { class: "callout warn part-cadastrar-msg" }, text("p", `A commodity desta rodada (${r.config.commodity?.code ?? "—"}) não corresponde a nenhum produto do catálogo. Edite a configuração e escolha a commodity e o produto do catálogo antes de cadastrar.`)));
    else resPanel.append(
      el(
        "div",
        { class: "toolbar part-cadastrar" },
        prod.node,
        mode.node,
        el("details", { class: "inline-add" }, el("summary", {}, "Citar autorização (opcional)"), authRef.node),
        el("label", {}, screen, " Rodar a triagem de sanções logo após o cadastro"),
        button("Cadastrar no Compass", async () => {
          if (!prod.control.value) throw new Error("Escolha o produto do catálogo desta rodada.");
          // O servidor cadastra em partes; repete até não restar nenhuma.
          const out = { items: [], mode: mode.control.value };
          for (let round = 0; round < 100; round++) {
            const part = await api(`${base}/register`, "POST", { mode: mode.control.value, productId: prod.control.value, screening: screen.checked }, authRef.control.value.trim() ? { "x-compass-authorization-ref": encodeURIComponent(authRef.control.value.trim()) } : {});
            out.items.push(...part.items.filter((x) => x.outcome !== "skipped" || round === 0));
            notice(`Cadastrando… ${out.items.filter((x) => x.outcome === "created").length} criada(s) até agora.`);
            if (!part.remaining) break;
          }
          const n = (k) => out.items.filter((x) => x.outcome === k).length;
          notice(`Cadastro (${out.mode === "accept" ? "só as aceitas" : "descoberta"}): ${n("created")} criada(s), ${n("already_exists")} já existiam, ${n("skipped")} já cadastrada(s) por esta rodada, ${n("failed")} falha(s). Nenhum contato, ficha ou envio foi criado.`, n("failed") > 0);
          await showRound(id);
        }),
      ),
    );
  }
  resPanel.append(
    el(
      "div",
      { class: "toolbar part-exportar" },
      button("Exportar (JSON)", async () => downloadFile(`rodada-${r.config.id}.json`, JSON.stringify(await api(`${base}/export`), null, 1), "application/json")),
      button("Relatório (markdown)", async () => downloadFile(`relatorio-${r.config.id}.md`, (await api(`${base}/export`)).report, "text/markdown")),
    ),
  );
  const notes = r.annotations ?? [];
  const notePanel = panel(
    "Anotações complementares",
    text("small", "Registro novo, com a data em que foi gravado; não altera cadastros, decisões nem o histórico.", "muted"),
    rows(notes, (n) => el("div", { class: "row" }, el("div", { class: "round-lines" }, text("strong", fmtDate(n.annotatedAt)), text("small", n.text), text("small", `Registrada por ${n.authenticatedIdentity} (identidade autenticada; não prova ação humana); canal ${n.operation?.channel ?? "não declarado"}; executor ${n.operation?.executor ?? "não declarado"}${n.refersTo?.requestIds?.length ? `; operações: ${n.refersTo.requestIds.join(", ")}` : ""}${n.authorization?.reference ? `; autorização citada: ${[n.authorization.reference, n.authorization.grantedBy, n.authorization.grantedAt].filter(Boolean).join(", ")}` : ""}`)))),
  );
  if (writable())
    notePanel.append(details("Nova anotação", makeForm([input("Texto", "text", "textarea"), input("Operações referidas (ids de requisição, separados por vírgula)", "requestIds", "text", "", false), input("Autorização citada: referência", "authRef", "text", "", false), input("Autorização citada: responsável", "authBy", "text", "", false), input("Autorização citada: data", "authAt", "text", "", false)], async (v) => {
      await api(`${base}/annotations`, "POST", { text: v.text, refersTo: { requestIds: v.requestIds ? v.requestIds.split(",").map((x) => x.trim()).filter(Boolean) : [] }, authorization: v.authRef || v.authBy || v.authAt ? { reference: v.authRef || null, grantedBy: v.authBy || null, grantedAt: v.authAt || null } : null });
      notice("Anotação registrada.");
      await showRound(id);
    }, "Registrar anotação")));
  node.append(resPanel, notePanel);
  const editBox =
    writable() && r.status !== "closed"
      ? details(
          "Editar configuração",
          roundForm(r.config, r.name, async (name, config) => {
            await api(base, "PUT", { expectedRevision: r.revision, config });
            notice("Configuração salva. As limitações foram recalculadas: registre ciência de novo antes de executar.");
            await showRound(id);
          }, "Salvar configuração"),
        )
      : null;
  // Organização da tela: resumo (objetivo, commodity, área, etapa, resultados, pendências e próxima ação) e as seções
  // Configuração → Buscar/importar → Conferir → Cadastrar, com anotações e detalhes técnicos à parte. Só apresentação:
  // os mesmos formulários, as mesmas confirmações e os mesmos bloqueios do servidor.
  const cfgC = r.config.commodity ?? {};
  const prodCfg = state.products.find((p) => p.id === cfgC.productId);
  const inCatalog = state.products.some((p) => p.commodity === cfgC.code);
  const segs = Object.values(cfgC.segments ?? {});
  const ack = !pf.requiresAcknowledgement || r.acknowledged;
  const registeredN = results.filter((x) => x.registration).length;
  const candN = r.candidates.reduce((n, c) => n + c.n, 0);
  const where = o.municipality ? `${o.municipality}${o.region ? `/${o.region}` : ""}` : o.label ?? (typeof o.lat === "number" ? "coordenada registrada" : "origem sem localização");
  const stage = !ack ? "config" : !r.lastRun ? "buscar" : r.lastRun.review > 0 && registeredN === 0 ? "conferir" : "cadastrar";
  const SECTIONS = [
    ["config", "1. Configuração"],
    ["buscar", "2. Buscar/importar candidatas"],
    ["conferir", "3. Conferir resultados"],
    ["cadastrar", "4. Cadastrar"],
    ["detalhes", "Anotações e detalhes técnicos"],
  ];
  const pend = [];
  if (!inCatalog) pend.push(`Commodity "${cfgC.code}" sem correspondência no catálogo: escolha a commodity e o produto na configuração antes de cadastrar.`);
  else if (!prodCfg) pend.push("Produto do catálogo não definido na configuração: será pedido no cadastro.");
  if (!segs.length) pend.push("Nenhum segmento comprador escolhido: a busca automática não tem o que procurar.");
  if (!ack) pend.push("Registrar ciência das limitações antes de executar.");
  if (r.lastRun?.lookups?.deferred) pend.push(`${r.lastRun.lookups.deferred} consulta(s) adiada(s) pelo limite por minuto: executar de novo retoma sem duplicar.`);
  if (r.lastRun?.review) pend.push(`${r.lastRun.review} estabelecimento(s) para conferir (exceções ou perto do limite).`);
  if (o.country !== "BR" && typeof o.lat !== "number") pend.push("Fora do Brasil sem localização confirmada: área e distâncias não são calculadas.");
  const NEXT = {
    config: ack ? "Revisar a configuração" : "Conferir limitações e registrar ciência",
    buscar: candN ? "Executar a rodada" : "Trazer candidatas",
    conferir: "Conferir resultados",
    cadastrar: registeredN ? "Ver cadastro e exportar" : "Cadastrar no Compass",
  };
  const panels = {};
  const tabBar = el("div", { class: "tabs round-tabs", role: "tablist", "aria-label": "Etapas da rodada" });
  const go = (k) => {
    state.roundTab = { id, tab: k, stage };
    for (const b of tabBar.children) b.setAttribute("aria-selected", b.dataset.tab === k ? "true" : "false");
    for (const [key, p] of Object.entries(panels)) p.hidden = key !== k;
  };
  const item = (k, v, extra) => el("div", {}, text("span", k, "k"), v instanceof Node ? v : text("strong", v), extra ? text("small", extra) : null);
  const summary = el(
    "div",
    { class: "company-summary round-summary" },
    item("Objetivo", `Compradores de ${commodityName(cfgC.code)}${cfgC.variety ? ` ${cfgC.variety}` : ""} até ${r.config.radius?.value} ${r.config.radius?.unit === "mi" ? "milhas" : "km"} de ${where}`, prodCfg ? `Produto: ${prodCfg.variant_name}` : inCatalog ? "Produto a definir" : "Commodity fora do catálogo"),
    item("Área", areaSummary, segs.length ? `Segmentos: ${segs.map((g) => g.label).join(", ")}` : "Sem segmentos escolhidos"),
    item("Etapa atual", SECTIONS.find(([k]) => k === stage)[1].replace(/^\d\. /, ""), r.status === "closed" ? "rodada encerrada" : r.status === "draft" ? "rascunho" : `ativa · revisão ${r.revision}`),
    item("Resultados", r.lastRun ? `${r.lastRun.total} estabelecimento(s)` : candN ? `${candN} candidata(s), não executada` : "Ainda sem candidatas", r.lastRun ? `${r.lastRun.review} para conferir · ${registeredN} cadastrado(s)` : null),
    el("div", { class: "next" }, el("p", {}, text("strong", "Pendências: "), pend.length ? "" : "nenhuma."), pend.length ? el("ul", {}, ...pend.map((x) => text("li", x))) : null, button(`Próxima ação: ${NEXT[stage]}`, () => go(stage), true)),
  );
  // Seção Cadastrar: barra de cadastro e exportação saem do painel de resultados.
  const moved = [...resPanel.querySelectorAll(":scope > .part-cadastrar-msg, :scope > .part-cadastrar, :scope > .part-exportar")];
  const cadPanel = panel("Cadastrar no Compass", text("p", "Cadastrar em descoberta não é qualificação comercial nem libera contato. Exceções e recusadas ficam de fora; a triagem de sanções pode rodar logo após o cadastro.", "muted"), text("p", `${registeredN} estabelecimento(s) já cadastrado(s) por esta rodada.`), ...moved);
  // Detalhes técnicos: identificadores, fontes e configuração completa.
  const techPanel = panel(
    "Detalhes técnicos",
    kv([
      ["Rodada", id],
      ["Configuração", `${r.config.id} · revisão ${r.revision}`],
      ["Commodity (código)", `${cfgC.code}${cfgC.productId ? ` · produto ${cfgC.productId}` : ""}`],
      ["Origem", [o.country, o.region, o.municipality, o.municipalityCode ? `IBGE ${o.municipalityCode}` : null].filter(Boolean).join(" · ")],
      ["Fontes", (r.config.sources ?? []).map((x) => x.id).join(", ") || "nenhuma"],
    ]),
    details("Fontes configuradas", rows(r.config.sources ?? [], (x) => el("div", { class: "row" }, el("div", {}, text("strong", `${sourceName(x.id)} (${x.id})`), text("small", [r.sources[x.id]?.label, x.rateLimitPerMinute ? `${x.rateLimitPerMinute}/min` : null, x.maxAgeDays ? `reaproveita até ${x.maxAgeDays} dias` : null].filter(Boolean).join(" · ")))))),
    details("Configuração completa (JSON)", el("pre", { class: "message" }, JSON.stringify(r.config, null, 2))),
  );
  const canEdit = writable() && r.status !== "closed";
  const nl = r.config.nearLimit ?? { fraction: 0.1 };
  const adjNear = canEdit ? roundAdjust(r, "Ajustar a faixa perto do limite", "Empresas nessa faixa pedem conferência da localização; ninguém é excluído por isso.", [
    select("Critério", "nearKind", [["fraction", "Proporcional ao raio (%)"], ["distance", "Margem fixa (na unidade do raio)"]], nl.distance != null ? "distance" : "fraction"),
    input("Valor (% do raio ou margem)", "nearValue", "number", nl.distance ?? Math.round((nl.fraction ?? 0.1) * 100)),
  ], (cfg, v) => ({ ...cfg, nearLimit: v.nearKind === "fraction" ? { fraction: Number(v.nearValue) / 100 } : { distance: Number(v.nearValue) } })) : null;
  const adjResearch = canEdit ? roundAdjust(r, "Fase da pesquisa pública", "Encerrada: nenhuma confirmação campo a campo; o que seguir desconhecido vira pendência de contato futuro. Encerrar não conclui a qualificação comercial.", [
    select("Pesquisa pública", "researchPhase", [["open", "Aberta"], ["closed", "Encerrada"]], r.config.research?.publicPhase ?? "open"),
  ], (cfg, v) => ({ ...cfg, research: { ...(cfg.research ?? {}), publicPhase: v.researchPhase } })) : null;
  const adjLocale = canEdit ? roundAdjust(r, "Idioma, fuso e escopo de compliance", "Calculados pelo país na criação. O escopo de compliance indica qual validação T11 vale para a rodada; mudar aqui não valida nem libera nada.", [
    input("Idioma", "language", "text", r.config.locale?.language ?? ""),
    input("Fuso", "timezone", "text", r.config.locale?.timezone ?? ""),
    input("Escopo de compliance", "scope", "text", r.config.compliance?.scope ?? ""),
  ], (cfg, v) => ({ ...cfg, locale: { language: v.language.trim(), timezone: v.timezone.trim() }, compliance: { ...(cfg.compliance ?? {}), scope: v.scope.trim() } })) : null;
  const techJson = (() => {
    const t = input("Configuração técnica (JSON)", "technical", "textarea", JSON.stringify({ spec: cfgC.spec, nameHints: cfgC.nameHints ?? [], restrictionHints: cfgC.restrictionHints ?? [], segments: cfgC.segments ?? {}, sources: r.config.sources ?? [], buyer: r.config.buyer, priorities: r.config.priorities, evidence: r.config.evidence }, null, 2), false);
    t.control.rows = 16;
    t.control.maxLength = 20000;
    return t;
  })();
  const adjTech = canEdit ? roundAdjust(r, "Editar a configuração técnica (JSON)", "Especificação, indícios por nome, regras de busca por segmento, limites das fontes, comprador, prioridades e evidência.", [techJson], (cfg, v) => {
    let x;
    try { x = JSON.parse(v.technical); } catch { throw new Error("O texto não é um JSON válido."); }
    return { ...cfg, commodity: { ...cfg.commodity, spec: x.spec, nameHints: x.nameHints ?? [], restrictionHints: x.restrictionHints ?? [], segments: x.segments ?? {} }, sources: x.sources ?? [], buyer: x.buyer ?? cfg.buyer, priorities: x.priorities ?? cfg.priorities, evidence: x.evidence ?? cfg.evidence };
  }) : null;
  const nextBtn = (k, lbl) => el("div", { class: "toolbar section-next" }, button(`Próximo: ${lbl}`, () => go(k)));
  panels.config = el("div", { class: "tab-panel", role: "tabpanel" }, limPanel, areaPanel, editBox, adjNear, ack ? nextBtn("buscar", "buscar ou importar candidatas") : null);
  panels.buscar = el("div", { class: "tab-panel", role: "tabpanel" }, cand, r.lastRun ? nextBtn("conferir", "conferir resultados") : null);
  panels.conferir = el("div", { class: "tab-panel", role: "tabpanel" }, resPanel, adjResearch, r.lastRun ? nextBtn("cadastrar", "cadastrar") : null);
  panels.cadastrar = el("div", { class: "tab-panel", role: "tabpanel" }, cadPanel);
  techPanel.append(...[adjLocale, adjTech].filter(Boolean));
  panels.detalhes = el("div", { class: "tab-panel", role: "tabpanel" }, notePanel, techPanel);
  for (const [k, l] of SECTIONS) tabBar.append(el("button", { type: "button", role: "tab", "data-tab": k, onclick: () => go(k) }, l));
  const head = node.querySelector(".page-head");
  node.replaceChildren(head, summary, tabBar, ...Object.values(panels));
  go(state.roundTab?.id === id && state.roundTab.stage === stage ? state.roundTab.tab : stage);
  showScreen(node, "Rodadas", r.name);
}

// ===== Seleção pesquisável (combobox) compartilhada: commodities, países e cidades (2026-10-20).
// Abre ao clicar, filtra enquanto digita (sem diferença de maiúsculas e acentos), funciona por teclado (setas, Enter,
// Esc) e por toque/mouse; um nome completo com correspondência única é reconhecido sem seleção invisível. O valor
// guardado é o identificador interno (nunca exibido). Falha ao carregar mostra erro com "Tentar de novo".
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
let comboSeq = 0;
// opts: { label, name, placeholder, load: async (q) => [{ id, label, hint?, aliases? }], minChars = 0, value: { id, label }, required }
function comboBox(opts) {
  const id = `cb-${++comboSeq}`;
  const input = el("input", { type: "text", id, name: `${opts.name}Text`, role: "combobox", "aria-autocomplete": "list", "aria-expanded": "false", "aria-controls": `${id}-list`, autocomplete: "off", placeholder: opts.placeholder ?? "Digite para buscar", ...(opts.required ? { required: "" } : {}) });
  const hidden = el("input", { type: "hidden", name: opts.name });
  const list = el("ul", { class: "combo-list", role: "listbox", id: `${id}-list`, hidden: "" });
  const status = el("p", { class: "combo-status", "aria-live": "polite" });
  const wrap = el("div", { class: "combo" }, el("label", { for: id }, opts.label), el("div", { class: "combo-field" }, input, list), hidden, status);
  let items = [], shown = [], active = -1, selected = null, loadError = null, loadedFor = null;
  const listeners = [];
  const emit = () => listeners.forEach((f) => f(selected));
  const pick = (it, silent = false) => {
    selected = it;
    hidden.value = it?.id ?? "";
    if (it) input.value = it.label;
    status.textContent = "";
    close();
    if (!silent) emit();
  };
  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };
  const render = () => {
    list.replaceChildren();
    if (loadError) {
      list.append(el("li", { class: "combo-error", role: "option", "aria-disabled": "true" }, text("span", loadError), el("button", { type: "button", class: "link-btn", onmousedown: (e) => e.preventDefault(), onclick: () => refresh(true) }, "Tentar de novo")));
    } else if (!shown.length) list.append(el("li", { class: "combo-empty", role: "option", "aria-disabled": "true" }, input.value.trim().length < (opts.minChars ?? 0) ? `Digite ao menos ${opts.minChars} letras` : "Nenhuma opção com esse nome"));
    shown.forEach((it, i) =>
      list.append(
        el(
          "li",
          { id: `${id}-o${i}`, role: "option", class: i === active ? "active" : "", "aria-selected": selected?.id === it.id ? "true" : "false", onmousedown: (e) => e.preventDefault(), onclick: () => pick(it) },
          text("span", it.label),
          it.hint ? text("small", it.hint) : null,
        ),
      ),
    );
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", `${id}-o${active}`);
      list.children[active]?.scrollIntoView({ block: "nearest" });
    }
  };
  const filter = () => {
    const q = fold(input.value);
    const hits = items.filter((it) => !q || fold(it.label).includes(q) || (it.aliases ?? []).some((a) => fold(a).includes(q)));
    hits.sort((a, b) => (fold(a.label).startsWith(q) ? 0 : 1) - (fold(b.label).startsWith(q) ? 0 : 1) || a.label.localeCompare(b.label, "pt-BR"));
    // Lista local inteira (rolagem interna); só a remota (cidades) vem limitada pelo servidor.
    shown = opts.remote ? hits.slice(0, 200) : hits;
    active = shown.length ? 0 : -1;
  };
  let timer;
  const refresh = async (force = false) => {
    const q = input.value.trim();
    if (q.length < (opts.minChars ?? 0)) {
      items = [];
      shown = [];
      loadError = null;
      return render();
    }
    const key = opts.remote ? q : "*";
    if (force || loadedFor !== key) {
      try {
        loadError = null;
        items = await opts.load(q);
        loadedFor = key;
      } catch (e) {
        loadError = `Não foi possível carregar a lista (${e.message}).`;
        items = [];
      }
    }
    filter();
    render();
  };
  // Nome completo digitado com correspondência única (nome ou apelido): reconhecido sem precisar clicar na opção.
  const exact = () => {
    const q = fold(input.value);
    if (!q) return null;
    const m = items.filter((it) => fold(it.label) === q || (it.aliases ?? []).some((a) => fold(a) === q));
    return m.length === 1 ? m[0] : null;
  };
  input.addEventListener("focus", () => safe(() => refresh()));
  input.addEventListener("click", () => safe(() => refresh()));
  input.addEventListener("input", () => {
    if (selected && fold(selected.label) !== fold(input.value)) {
      selected = null;
      hidden.value = "";
      emit();
    }
    clearTimeout(timer);
    timer = setTimeout(() => safe(() => refresh()), opts.remote ? 200 : 0);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (list.hidden) return safe(() => refresh());
      if (!shown.length) return;
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
      render();
    } else if (e.key === "Enter") {
      if (!list.hidden && active >= 0 && shown[active]) {
        e.preventDefault();
        pick(shown[active]);
      } else if (!selected) {
        const m = exact();
        if (m) (e.preventDefault(), pick(m));
      }
    } else if (e.key === "Escape") close();
  });
  input.addEventListener("blur", () => {
    setTimeout(() => {
      close();
      if (!selected) {
        const m = exact();
        if (m) pick(m);
        else if (input.value.trim()) status.textContent = "Escolha uma opção da lista.";
      }
    }, 120);
  });
  return {
    node: wrap,
    control: input,
    get value() {
      return selected?.id ?? "";
    },
    get item() {
      return selected;
    },
    // Resolve o texto digitado (nome completo com correspondência única) antes de validar o formulário.
    async resolve() {
      if (selected) return selected;
      if (!items.length || opts.remote) await refresh(true).catch(() => {});
      close();
      const m = exact();
      if (m) pick(m);
      return selected;
    },
    set(it, silent = true) {
      pick(it, silent);
    },
    clear() {
      selected = null;
      hidden.value = "";
      input.value = "";
      items = opts.remote ? [] : items;
      loadedFor = opts.remote ? null : loadedFor;
    },
    onChange(f) {
      listeners.push(f);
    },
    reload() {
      loadedFor = null;
    },
  };
}
// Listas comuns (uma só fonte cada): commodities do catálogo, países da base e cidades oficiais do IBGE.
const commodityItems = async () => (state.commodities ?? []).map((c) => ({ id: c.code, label: c.label, aliases: c.aliases, hint: c.identityPending ? "identidade do produto pendente: pesquisa sim, ficha só depois da confirmação" : null }));
const countryItems = (excludeBR = false) => async () => (await countriesData()).filter((c) => !(excludeBR && c.iso2 === "BR")).map((c) => ({ id: c.iso2, iso3: c.iso3, label: c.name_pt, aliases: [c.name_en] }));
const cityItems = (ufOf) => async (q) => {
  const uf = ufOf();
  if (!uf) throw new Error("escolha o estado primeiro");
  return (await api(`/api/geo/municipalities?uf=${uf}&q=${encodeURIComponent(q)}`)).items.map((m) => ({ id: m.code, label: m.name, uf: m.uf, hint: m.uf }));
};

// ===== Prospecção automática (2026-10-20): componentes compartilhados pelo Radar Nacional, Radar Internacional e Rodadas.
// A pessoa informa produto, mercado, local e alcance; o servidor executa o resto em segundo plano (com a política de
// pesquisa vigente) e a tela só acompanha. Nada aqui faz contato, aprova ficha ou envia mensagem.
const JOB_STATUS = {
  queued: ["Na fila", ""],
  running: ["Em andamento", "ok"],
  waiting: ["Aguardando", ""],
  needs_decision: ["Precisa de decisão", "warn"],
  paused: ["Pausada", ""],
  cancelled: ["Cancelada", ""],
  done: ["Concluída", "ok"],
  failed: ["Falhou", "bad"],
};
const STEP_STATE = { done: ["concluída", "ok"], partial: ["parcial", "warn"], pending: ["pendente", "warn"], skipped: ["sem itens", ""], waiting: ["aguardando", ""], decision: ["decisão", "warn"], failed: ["falhou", "bad"], todo: ["a fazer", ""] };
const WAITING_TEXT = { rate_limit: "aguardando o limite por minuto da Receita; retoma sozinha", source_retry: "fonte indisponível; nova tentativa automática", browser_osm: "a busca no mapa precisa deste navegador", sites: "lendo os sites das empresas" };
const jobActive = (j) => ["queued", "running", "waiting"].includes(j.status);

// Formulário mínimo. market: "national" | "international" | null (pergunta).
function prospectStart(fixedMarket = null) {
  const commodities = catalogCommodities();
  const box = el("section", { class: "panel prospect-start" }, text("h2", "Iniciar prospecção"));
  const form = el("form", { class: "prospect-form", novalidate: "" });
  const error = el("p", { class: "error", hidden: "" });
  const comm = comboBox({ label: "Commodity", name: "commodity", placeholder: "Digite para buscar (ex.: café, milho, farelo)", load: commodityItems, required: true });
  const prodBox = el("div", { class: "prospect-product" });
  let code = "", productId = "";
  const renderProduct = () => {
    const list = commodities.find((x) => x.code === code)?.products ?? [];
    if (!list.some((p) => p.id === productId)) productId = list.length === 1 ? list[0].id : "";
    prodBox.replaceChildren();
    if (list.length > 1) {
      const sel = select("Produto", "productId", [["", "Escolha"], ...list.map((p) => [p.id, p.display_name ?? p.variant_name])], productId);
      sel.control.addEventListener("change", () => ((productId = sel.control.value), coverage()));
      prodBox.append(sel.node);
    } else if (list.length === 1) prodBox.append(text("p", `Produto: ${list[0].display_name ?? list[0].variant_name}${list[0].identity_status !== "confirmed" ? " · identidade pendente (pesquisa sim; ficha só depois da confirmação)" : ""}`, "form-hint"));
  };
  comm.onChange((it) => {
    code = it?.id ?? "";
    productId = "";
    renderProduct();
    coverage();
  });
  let market = fixedMarket ?? "national";
  const marketSel = fixedMarket ? null : select("Mercado", "market", [["national", "Nacional"], ["international", "Internacional"]], market);
  // Nacional: estado, cidade (base oficial) e raio.
  const region = select("Estado", "region", [["", "Escolha"], ...Object.entries(UF_NAMES).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([k, v]) => [k, `${v} (${k})`])], "");
  const city = comboBox({ label: "Cidade", name: "municipality", placeholder: "Digite o nome da cidade", load: cityItems(() => region.control.value), remote: true });
  const radius = input("Raio (km)", "radius", "number", 150);
  radius.control.min = "1";
  region.control.addEventListener("change", () => city.clear());
  city.onChange(() => coverage());
  const natBox = el("div", { class: "form-grid" }, region.node, city.node, radius.node);
  // Internacional: país (todos os países da base; a cobertura das fontes aparece abaixo, sem esconder país).
  const country = comboBox({ label: "País", name: "country", placeholder: "Digite para buscar (ex.: Argentina, Alemanha)", load: countryItems(true), required: true });
  country.onChange(() => coverage());
  const intlBox = el("div", { class: "form-grid" }, country.node, text("p", "Os indicadores oficiais de compra por país orientam a escolha (Radar Internacional → Indicadores por país); dado de comércio não prova que uma empresa importa do Brasil.", "form-hint"));
  const cov = el("div", { class: "prospect-coverage", "aria-live": "polite" });
  let covSeq = 0;
  // Cobertura da pesquisa para a escolha atual: o que cada fonte cobre, o que fica pendente. Não esconde país nem produto.
  const coverage = () => {
    const seq = ++covSeq;
    const pid = productId || commodities.find((x) => x.code === code)?.products?.[0]?.id;
    if (!pid || (market === "international" && !country.item)) return cov.replaceChildren();
    safe(async () => {
      const q = market === "international" ? `market=international&productId=${pid}&iso2=${country.item.id}` : `market=national&productId=${pid}`;
      const r = await api(`/api/prospect/coverage?${q}`);
      if (seq !== covSeq) return;
      cov.replaceChildren(
        text("strong", "Cobertura desta pesquisa"),
        el("ul", { class: "coverage-list" }, ...r.items.map((x) => el("li", {}, tag(x.available ? "coberta" : "sem cobertura", x.available ? "ok" : "warn"), text("span", x.label), x.note ? text("small", x.note) : null))),
        r.partial ? text("p", r.partialNote, "form-hint") : null,
      );
    });
  };
  const showMarket = () => {
    natBox.hidden = market !== "national";
    intlBox.hidden = market !== "international";
    coverage();
  };
  marketSel?.control.addEventListener("change", () => ((market = marketSel.control.value), showMarket()));
  // Perfil e política: resumo curto, com ajuste fora do percurso.
  const ctxLine = el("div", { class: "prospect-context" }, text("p", "Carregando perfil e política…", "muted"));
  safe(async () => {
    const [pr, po] = await Promise.all([api("/api/prospect/profile"), api("/api/prospect/policy")]);
    const p = pr.current.profile;
    const order = (p.sizes?.order ?? []).map((x) => ({ medium: "médias", small: "pequenas", large: "grandes com canal", micro: "micro", unknown: "porte desconhecido" })[x] ?? x).slice(0, 3).join(" > ");
    ctxLine.replaceChildren(
      el("p", {}, text("strong", "Perfil comprador: "), `${(p.roles?.priority ?? []).map((r) => p.roles.labels?.[r] ?? r).join(", ")}; ${order}; distribuidor e trader à parte. `, el("button", { type: "button", class: "link-btn", onclick: () => navigate("Prospecção automática") }, "Ajustar")),
      po.current
        ? el("p", {}, text("strong", "Autorização: "), `política de pesquisa de rotina v${po.current.version} — descoberta, consulta cadastral, triagem e cadastro em descoberta, sem contato.`)
        : el("div", { class: "callout warn" }, text("p", "Sem política de pesquisa de rotina: a prospecção começa, mas para em \"precisa de decisão\" até a política ser concedida (Configurações → Prospecção automática)."), approver() ? button("Ver a política", () => navigate("Prospecção automática")) : null),
    );
  });
  const submit = el("button", { type: "submit", class: "primary" }, "Iniciar prospecção");
  form.append(el("div", { class: "form-grid" }, comm.node, prodBox, marketSel?.node ?? null), natBox, intlBox, cov, ctxLine, error, el("div", { class: "toolbar" }, submit));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    safe(async () => {
      error.hidden = true;
      const fail = (m) => ((error.textContent = m), (error.hidden = false));
      await comm.resolve();
      if (!code) return fail("Escolha a commodity na lista.");
      if (!productId) return fail("Escolha o produto.");
      const body = { market, productId };
      if (market === "national") {
        if (!region.control.value) return fail("Escolha o estado.");
        const c = await city.resolve();
        if (!c) return fail("Escolha a cidade na lista (base oficial do IBGE).");
        if (!(Number(radius.control.value) > 0)) return fail("Informe o raio.");
        Object.assign(body, { location: { region: c.uf, municipality: c.label, municipalityCode: c.id }, radius: { value: Number(radius.control.value), unit: "km" } });
      } else {
        const c = await country.resolve();
        if (!c) return fail("Escolha o país na lista.");
        Object.assign(body, { location: { iso3: c.iso3 } });
      }
      submit.disabled = true;
      try {
        const job = await api("/api/prospect/jobs", "POST", body);
        notice("Prospecção iniciada. Ela segue no servidor mesmo com esta aba fechada.");
        await showJob(job.id);
      } finally {
        submit.disabled = false;
      }
    });
  });
  showMarket();
  box.append(form);
  return box;
}

function jobProgress(j) {
  const done = j.steps.filter((s) => ["done", "partial", "skipped", "pending"].includes(s.state)).length;
  return el("div", { class: "job-progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(j.steps.length), "aria-valuenow": String(done), "aria-label": `Etapas concluídas: ${done} de ${j.steps.length}` }, el("span", { style: `width:${Math.round((done / j.steps.length) * 100)}%` }));
}
async function prospectList(market) {
  const d = await api("/api/prospect/jobs");
  const items = d.items.filter((j) => !market || j.market === market);
  const box = panel("Prospecções");
  box.append(
    items.length
      ? rows(items, (j) =>
          el(
            "div",
            { class: "row" },
            el("div", {}, text("strong", j.name), text("small", `${j.market === "national" ? "Nacional" : "Internacional"} · ${j.stepLabel}${j.waitingFor ? ` · ${WAITING_TEXT[j.waitingFor] ?? j.waitingFor}` : ""}${j.summary ? ` · ${j.summary.registered} cadastrada(s), ${j.summary.exceptions} exceção(ões)` : ""} · ${fmtDate(j.updatedAt)}`), jobProgress(j)),
            tag(...(JOB_STATUS[j.status] ?? [j.status, ""])),
            button("Abrir", () => showJob(j.id)),
          ),
        )
      : text("p", "Nenhuma prospecção ainda.", "empty"),
  );
  return box;
}

// Prospecção aberta: andamento, resultados, fila de exceções, conclusão e próxima ação. Atualiza sozinha enquanto roda.
let jobTimer = null;
async function showJob(id) {
  clearTimeout(jobTimer);
  const j = await api(`/api/prospect/jobs/${id}`);
  const node = section(j.name, `${j.market === "national" ? "Prospecção nacional" : "Prospecção internacional"} · iniciada em ${fmtDate(j.createdAt)}`);
  node.dataset.step = "0";
  const [st, cls] = JOB_STATUS[j.status] ?? [j.status, ""];
  const s = j.summary;
  const item = (k, v, extra) => el("div", {}, text("span", k, "k"), v instanceof Node ? v : text("strong", v), extra ? text("small", extra) : null);
  const head = el(
    "div",
    { class: "company-summary round-summary" },
    item("Andamento", el("span", {}, tag(st, cls), " ", j.stepLabel), j.waitingFor ? WAITING_TEXT[j.waitingFor] ?? j.waitingFor : jobActive(j) ? "segue no servidor, mesmo com esta aba fechada" : null),
    item("Candidatas encontradas", s ? String(s.candidates) : "—", s?.establishments != null ? `${s.establishments} estabelecimento(s) após deduplicação` : null),
    item("Empresas cadastradas", s ? String(s.registered) : "—", "em descoberta: não é qualificação comercial"),
    item("Pendências para análise", s ? String(s.exceptions) : "—", s?.pendingLookups ? `${s.pendingLookups} consulta(s) adiada(s)` : null),
    el("div", { class: "next" }, el("p", {}, text("strong", "Próxima ação: "), j.decision ? j.decision.message : s ? s.nextAction : jobActive(j) ? "Aguardar: a prospecção avança sozinha." : "—"), jobProgress(j)),
  );
  node.append(head);
  // Decisão pendente: o que falta e como seguir.
  if (j.decision) {
    const dec = el("div", { class: "callout warn" }, el("p", {}, text("strong", "Decisão necessária. "), j.decision.message));
    if (j.decision.items?.length) dec.append(el("ul", {}, ...j.decision.items.map((x) => text("li", x))));
    if (j.decision.kind === "authorization" && approver()) dec.append(button("Ver a política de pesquisa", () => navigate("Prospecção automática")));
    if (writable()) dec.append(button("Retomar depois de resolver", async () => (await api(`/api/prospect/jobs/${id}/resume`, "POST", {}), await showJob(id)), true));
    node.append(dec);
  }
  // Dependência do navegador (mapa colaborativo recusa o servidor): feita aqui, automaticamente, e dita como tal.
  if (j.waitingFor === "browser_osm" && writable() && j.roundId) {
    const bw = el("div", { class: "callout" }, el("p", {}, text("strong", "Busca no mapa por este navegador. "), "O servidor público do mapa colaborativo recusa o servidor do Compass; esta etapa é feita pelo navegador enquanto a prospecção está aberta. O restante segue no servidor."));
    bw.append(el("div", { class: "toolbar" }, button("Seguir sem a busca no mapa", async () => (await api(`/api/prospect/jobs/${id}/skip-browser`, "POST", {}), await showJob(id)))));
    node.append(bw);
    if (!state.browserOsmDone?.[id]) {
      (state.browserOsmDone ??= {})[id] = true;
      safe(async () => {
        const q = await api(`/api/rounds/${j.roundId}/osm-query`);
        const res = await fetch(q.endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(q.query)}` });
        if (!res.ok) throw new Error(`O mapa colaborativo respondeu ${res.status} também pelo navegador. Tente mais tarde ou siga sem a busca no mapa.`);
        const data = await res.json();
        const els = (data.elements ?? []).map((e) => ({ type: e.type, id: e.id, lat: e.lat, lon: e.lon, center: e.center, tags: e.tags }));
        await api(`/api/prospect/jobs/${id}/browser-osm`, "POST", { elements: els, final: true });
        notice(`Busca no mapa feita por este navegador: ${els.length} objetos enviados; a prospecção segue no servidor.`);
        await showJob(id);
      });
    }
  }
  // Resultados: cadastradas com prioridade e evidência; fila de exceções.
  if (s) {
    const tbl = (cols, list, row) => el("div", { class: "table-wrap" }, el("table", { class: "trade" }, el("thead", {}, el("tr", {}, ...cols.map((c) => el("th", { scope: "col" }, c)))), el("tbody", {}, ...list.map(row))));
    const PROOF = { proved: "comprovado", indication: "indício", none: "sem evidência" };
    const SIZE = { medium: "média", small: "pequena", large: "grande", micro: "micro", unknown: "desconhecido" };
    node.append(
      panel(
        `Empresas cadastradas em descoberta (${s.registered})`,
        text("p", s.notCommercial, "muted"),
        s.ranked.length
          ? tbl(["Prioridade", "Empresa", "Decisor", s.market === "national" ? "Local e distância" : "Situação", "Porte", "Evidência", "Canal", "Sanções"], s.ranked, (x, i) =>
              el("tr", {}, text("td", String(i + 1)), el("td", {}, x.companyId ? el("button", { type: "button", class: "link-btn", onclick: () => showCompany(x.companyId) }, x.name) : x.name), el("td", { class: "dec-cell", "data-company": x.companyId ?? "" }, "…"), text("td", s.market === "national" ? [x.municipality, x.distance].filter(Boolean).join(" · ") || "—" : x.status), text("td", SIZE[x.size] ?? x.size), text("td", s.market === "national" ? `operação ${PROOF[x.operation] ?? "—"} · uso ${PROOF[x.use] ?? "—"} · compra ${PROOF[x.purchase] ?? "—"}` : `${x.ownEvidence} própria(s)`), text("td", x.channel ? "geral publicado" : x.note ?? "—"), text("td", x.screening ?? "—")),
            )
          : text("p", "Nenhuma empresa cadastrada nesta prospecção.", "empty"),
      ),
      panel(
        "Fontes consultadas",
        s.partial ? el("div", { class: "callout warn" }, text("p", s.partialNote)) : text("p", "Todas as fontes previstas responderam.", "muted"),
        el("ul", { class: "coverage-list" }, ...Object.entries(s.coverage ?? s.sources ?? {}).map(([k, v]) => el("li", {}, tag(typeof v === "string" ? v : { ok: "consultada", empty: "sem resultado nesta consulta", unavailable: "indisponível", partial: "parcial", not_applicable: "não se aplica" }[v.status] ?? v.status, typeof v === "string" ? "" : v.status === "ok" ? "ok" : v.status === "not_applicable" ? "" : "warn"), text("span", sourceName(k)), typeof v === "string" ? null : text("small", v.note ?? "")))),
      ),
      s.toIdentify?.length
        ? panel(
            `Compradores prováveis a identificar (${s.toIdentify.length})`,
            text("p", "Torrefadoras com produto certificado pela ABIC nos estados da área. A lista pública não traz CNPJ nem município: sem CNPJ, nenhuma é cadastrada e a distância fica desconhecida.", "muted"),
            el("ul", { class: "plain-list compact-list" }, ...s.toIdentify.map((x) => text("li", `${x.name}${x.region ? ` (${x.region})` : ""}`))),
          )
        : null,
      panel(
        `Pendências para análise (${s.exceptions})`,
        s.queue.length
          ? el("div", {}, el("ul", { class: "plain-list" }, ...s.queue.map((q) => text("li", `${q.name}: ${(q.reasons ?? [q.reason]).filter(Boolean).join("; ")}`))), el("div", { class: "toolbar" }, s.roundId ? button("Revisar na rodada", () => ((state.roundTab = null), showRound(s.roundId))) : null, s.searchId ? button("Revisar na busca do país", () => showForeignSearch(s.searchId)) : null))
          : text("p", "Nenhuma exceção: tudo o que cumpriu as regras foi cadastrado.", "empty"),
      ),
    );
  }
  // Decisores das empresas cadastradas (só leitura; mesma visibilidade do cadastro).
  safe(async () => {
    const ids = [...node.querySelectorAll(".dec-cell")].map((td) => td.dataset.company).filter(Boolean);
    if (!ids.length) return;
    const d = (await api(`/api/companies/decisors?ids=${ids.join(",")}`)).items;
    for (const td of node.querySelectorAll(".dec-cell")) {
      const x = d[td.dataset.company];
      td.textContent = x?.summary ? `${x.summary.name ?? "nome não informado"} (${x.summary.title ?? x.summary.roleLabel}) · ${x.summary.status}` : "Decisor ainda não identificado";
    }
  });
  // Registro das etapas (rastreabilidade) e controles.
  const controls = el("div", { class: "toolbar" });
  if (writable()) {
    if (jobActive(j)) controls.append(button("Pausar", async () => (await api(`/api/prospect/jobs/${id}/pause`, "POST", {}), await showJob(id))));
    if (["paused", "waiting"].includes(j.status)) controls.append(button("Retomar agora", async () => (await api(`/api/prospect/jobs/${id}/resume`, "POST", {}), await showJob(id)), true));
    if (!["done", "cancelled", "failed"].includes(j.status)) controls.append(button("Cancelar", async () => (await api(`/api/prospect/jobs/${id}/cancel`, "POST", {}), await showJob(id))));
    if (j.roundId) controls.append(button("Abrir a rodada", () => showRound(j.roundId)));
  }
  node.append(
    panel(
      "Etapas",
      el("ol", { class: "job-steps" }, ...j.steps.map((x) => el("li", { class: x.key === j.step && jobActive(j) ? "current" : "" }, text("span", x.label), tag(...(STEP_STATE[x.state] ?? [x.state, ""]))))),
      details(`Registro das etapas (${j.events.length})`, el("ul", { class: "plain-list" }, ...j.events.map((e) => text("li", `${fmtDate(e.at)} · ${e.stepLabel} · ${STEP_STATE[e.outcome]?.[0] ?? e.outcome}: ${e.message}`)))),
      controls,
    ),
  );
  showScreen(node, "Prospecção", j.name);
  if (jobActive(j) && j.waitingFor !== "browser_osm")
    jobTimer = setTimeout(() => {
      if (document.visibilityState === "visible" && document.querySelector(".page-head h1")?.textContent === j.name) safe(() => showJob(id));
    }, 4000);
}

// Hub de prospecção em cada contexto: formulário + prospecções; o modo manual fica em "Recursos complementares".
async function prospectHub(title, subtitle, market, manual, manualTitle) {
  const node = section(title, subtitle);
  node.append(prospectStart(market), await prospectList(market));
  if (manual) {
    const m = await manual();
    m.querySelector(":scope > .page-head")?.remove();
    node.append(el("details", { class: "complementary" }, el("summary", {}, manualTitle), m));
  }
  return node;
}
async function prospectView() {
  return prospectHub("Prospecção", "Escolha o produto, o mercado e o local; o Compass faz a pesquisa e o cadastro em descoberta em segundo plano.", null, null);
}

// Configurações → Prospecção automática: perfil comprador (versionado) e política de pesquisa de rotina.
async function prospectSettingsView() {
  const [pr, po] = await Promise.all([api("/api/prospect/profile"), api("/api/prospect/policy")]);
  const node = section("Prospecção automática", "Perfil comprador usado como padrão e autorização persistente para a pesquisa de rotina. Contato, fichas, campanhas, canais e envios ficam fora.");
  const p = pr.current.profile;
  const prof = panel(`Perfil comprador${pr.current.version ? ` v${pr.current.version}` : " (padrão, ainda não registrado)"}`);
  prof.append(
    kv([
      ["Perfis compradores", (p.roles?.priority ?? []).map((r) => p.roles.labels?.[r] ?? r).join(", ")],
      ["Separados", (p.roles?.separate ?? []).map((r) => p.roles.labels?.[r] ?? r).join(", ")],
      ["Porte", (p.sizes?.order ?? []).join(" > ") + (p.sizes?.largeRequiresChannel ? " (grande só com canal adequado)" : "")],
      ["Evidência que confirma", (p.evidence?.confirming ?? []).join(", ")],
      ["Fontes nacionais", (p.sources?.national ?? []).map(sourceName).join(", ")],
      ["Fontes internacionais", (p.sources?.international ?? []).join(", ")],
    ]),
    el("ul", { class: "plain-list" }, ...(p.distinctions ?? []).map((x) => text("li", x))),
  );
  if (approver()) {
    const json = input("Perfil (JSON)", "profile", "textarea", JSON.stringify(p, null, 2));
    json.control.rows = 18;
    json.control.maxLength = 20000;
    prof.append(details("Ajustar o perfil (nova versão)", makeForm([json, input("Motivo da alteração", "reason")], async (v) => {
      let x;
      try { x = JSON.parse(v.profile); } catch { throw new Error("O perfil não é um JSON válido."); }
      await api("/api/prospect/profile", "POST", { profile: x, reason: v.reason, expectedVersion: pr.current.version });
      notice("Perfil salvo como nova versão.");
      await navigate("Prospecção automática");
    }, "Salvar nova versão")));
  }
  if (pr.history.length) prof.append(details("Versões anteriores", el("ul", { class: "plain-list" }, ...pr.history.map((h) => text("li", `v${h.version} · ${fmtDate(h.created_at)} · ${h.created_by}: ${h.reason}`)))));
  const t = po.template;
  const pol = panel(po.current ? `Política de pesquisa de rotina v${po.current.version}` : "Política de pesquisa de rotina: não concedida");
  pol.append(
    po.current ? text("p", `Concedida por ${po.current.grantedBy} em ${fmtDate(po.current.grantedAt)}. Referência: ${po.current.reference}`) : el("div", { class: "callout warn" }, text("p", "Sem política, cada prospecção para em \"precisa de decisão\" antes de pesquisar.")),
    kv([
      ["Cobre", t.covers.join("; ")],
      ["Não cobre", t.excludes.join("; ")],
      ["Raio máximo sem nova decisão", `${(po.current?.policy ?? t).maxRadiusKm} km`],
      ["Limitações aceitas uma vez", Object.keys(t.acceptedLimitations).map((k) => plainArea(k)).join(", ")],
    ]),
    text("p", "Limitação nova, raio maior, fonte paga, fusão de empresas parecidas e exceções continuam pedindo decisão. A seleção de commodity e a busca no exterior pela política dependem da emenda da R12.7 (docs/implementation/EMENDA-PROSPECCAO-AUTOMATICA.md).", "muted"),
  );
  if (approver()) {
    const conf = el("input", { type: "checkbox", name: "confirm" });
    if (!po.current)
      pol.append(details("Conceder a política", makeForm([input("Referência da decisão (onde e quando foi decidida)", "reference"), input("Raio máximo (km)", "maxRadiusKm", "number", t.maxRadiusKm), { node: el("label", { class: "check" }, conf, " Confirmo a autorização da pesquisa de rotina nestes termos") }], async (v) => {
        if (!conf.checked) throw new Error("Confirme a autorização.");
        await api("/api/prospect/policy", "POST", { confirm: true, reference: v.reference, maxRadiusKm: Number(v.maxRadiusKm) });
        notice("Política concedida.");
        await navigate("Prospecção automática");
      }, "Conceder")));
    else
      pol.append(details("Revogar a política", makeForm([input("Motivo", "reason")], async (v) => {
        await api("/api/prospect/policy/revoke", "POST", { reason: v.reason });
        notice("Política revogada: as prospecções param antes de pesquisar.");
        await navigate("Prospecção automática");
      }, "Revogar")));
  }
  if (po.history.length) pol.append(details("Histórico da política", el("ul", { class: "plain-list" }, ...po.history.map((h) => text("li", `v${h.version} · concedida em ${fmtDate(h.granted_at)} por ${h.granted_by}${h.revoked_at ? ` · revogada em ${fmtDate(h.revoked_at)}: ${h.revoke_reason}` : ""}`)))));
  node.append(prof, pol);
  return node;
}

const views = {
  Início: home,
  "Radar Nacional": () => prospectHub("Radar Nacional", "Compradores perto da cidade do fornecedor: escolha o produto, a cidade e o raio e inicie a prospecção.", "national", radarView, "Recursos complementares: busca por campanha (Casa dos Dados, serviço pago) e mapa"),
  "Radar Internacional": () => prospectHub("Radar Internacional", "Compradores no exterior: escolha o produto e o país e inicie a prospecção. Os indicadores oficiais por país orientam a escolha.", "international", () => internacionalView(), "Indicadores por país, análises, buscas e lista mensal"),
  Rodadas: () => prospectHub("Rodadas", "Cada prospecção nacional cria e executa uma rodada sozinha. A configuração manual continua disponível abaixo.", "national", rodadasView, "Rodadas: lista, configuração manual, importação e pesquisa assistida"),
  Prospecção: prospectView,
  "Prospecção automática": prospectSettingsView,
  Empresas: companiesView,
  Abordagem: () => abordagemView("Fichas"),
  Configurações: settingsView,
  "Compliance e auditoria": complianceView,
  Fichas: () => abordagemView("Fichas"),
  Envios: () => abordagemView("Envios"),
  Tarefas: () => abordagemView("Tarefas"),
  Campanhas: campaignView,
  "Lista mensal": listaMensalView,
  Catálogo: catalogView,
  "Setores e CNAE": sectorsView,
  Parâmetros: parametersView,
  Supressão: suppressionView,
  Pausas: pausesView,
  Hoje: home,
  Radar: () => views["Radar Nacional"](),
  Internacional: () => views["Radar Internacional"](),
};
async function start() {
  try {
    const [session, catalog] = await Promise.all([
      api("/api/session"),
      api("/api/catalog"),
    ]);
    state.actor = session.actor;
    state.products = catalog.products;
    state.commodities = catalog.commodities;
    $("session").textContent =
      `${session.actor.display_name} · ${session.environment === "local" ? "Ambiente local" : "Produção"}`;
    $("navigation").replaceChildren(
      ...NAV_GROUPS.map(([group, items]) =>
        el(
          "div",
          { class: "nav-group" },
          group ? text("span", group, "nav-label") : null,
          ...items.map(([v, ic]) => el("button", { type: "button", "data-view": v, onclick: () => navigate(v) }, icon(ic), text("span", navLabel(v)))),
        ),
      ),
    );
    await navigate("Início");
  } catch (e) {
    $("session").textContent = "Acesso indisponível";
    $("content").replaceChildren(
      section(
        "Acesso necessário",
        "Autentique-se e confira a configuração da operação.",
      ),
      text("p", e.message, "error"),
      button("Tentar novamente", start),
    );
    $("content").setAttribute("aria-busy", "false");
  }
}
$("menu").addEventListener("click", () => {
  const open = !$("app").classList.contains("nav-open");
  $("app").classList.toggle("nav-open", open);
  $("menu").setAttribute("aria-expanded", String(open));
  if (open) $("navigation").querySelector("button")?.focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("app").classList.contains("nav-open")) closeMenu();
});
$("refresh").addEventListener("click", () =>
  safe(() => (state.actor ? navigate() : start())),
);
start();
