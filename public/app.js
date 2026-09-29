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
  const form = el("form"),
    grid = el("div", { class: "form-grid" });
  for (const f of fields) grid.append(f.node);
  const error = el("p", { class: "error", hidden: "" }),
    submit = el("button", { type: "submit", class: "primary" }, label);
  form.append(grid, error, el("div", { class: "toolbar" }, submit));
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
function section(title, subtitle) {
  return el(
    "div",
    {},
    text("div", "EAG / INTELIGÊNCIA COMERCIAL", "eyebrow"),
    text("h1", title),
    text("p", subtitle, "muted"),
  );
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
      p.variant_name +
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
async function api(path, method = "GET", body) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
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
  for (const b of $("navigation").children)
    b.setAttribute("aria-current", b.textContent === view ? "page" : "false");
  try {
    const content = await views[view]();
    if (generation !== state.generation) return;
    $("content").replaceChildren(content);
    $("breadcrumb").textContent = `EAG / ${view.toUpperCase()}`;
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
async function home() {
  const d = await api("/api/dashboard"),
    p = d.pipeline,
    total = Object.values(p).reduce((a, b) => a + b, 0),
    n = p.qualifying || 0;
  const node = section(
    "Hoje",
    "Acompanhe as empresas e os dados que precisam de confirmação.",
  );
  node.append(
    el(
      "div",
      { class: "hero" },
      text("span", n, "big-number"),
      el(
        "div",
        {},
        text("h2", "EMPRESAS EM QUALIFICAÇÃO"),
        text(
          "p",
          "Complete evidências, demanda e validações antes de qualificar.",
          "muted",
        ),
        button("Revisar empresas", () => navigate("Empresas"), true),
      ),
    ),
    el(
      "div",
      { class: "stats" },
      ...[
        ["Cadastradas", total],
        ["Com evidência", p.prospected || 0],
        ["Qualificadas", p.qualified || 0],
      ].map(([label, value]) =>
        el(
          "div",
          { class: "stat" },
          text("strong", value),
          text("span", label),
        ),
      ),
    ),
    el(
      "div",
      { class: "grid" },
      panel(
        "Próximas decisões",
        text(
          "p",
          "Confira produto, mercado e fonte de cada demanda. Dados ausentes continuam pendentes.",
        ),
        button("Consultar catálogo", () => navigate("Catálogo")),
      ),
      panel(
        "Operação assistida",
        text(
          "p",
          "Radar, fichas, envios, tarefas e a lista internacional estão prontos; o envio externo só começa depois do teste interno (T1) e da liberação por escrito de Rogério.",
        ),
        text("p", "Nenhuma mensagem sai com o canal em planejamento ou teste interno para quem não está na lista interna.", "muted"),
      ),
    ),
  );
  return node;
}
async function companiesView() {
  const d = await api(
      `/api/companies?limit=25&offset=${state.offset}&q=${encodeURIComponent(state.search)}`,
    ),
    node = section(
      "Empresas",
      `${d.total} empresas cadastradas. Fontes e confirmações ficam no histórico de cada empresa.`,
    );
  const search = input(
    "Buscar empresa ou registro",
    "q",
    "search",
    state.search,
    false,
  );
  node.append(
    makeForm(
      [search],
      async (v) => {
        state.search = v.q;
        state.offset = 0;
        await navigate("Empresas");
      },
      "Buscar",
    ),
  );
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
  node.append(
    rows(d.companies, (c) =>
      el(
        "div",
        { class: "row" },
        el(
          "div",
          {},
          text("strong", c.legal_name),
          text(
            "small",
            `${c.country_code} · ${c.commodity || "Demanda pendente"} · ${c.market === "national" ? "Nacional" : c.market === "international" ? "Internacional" : "Mercado pendente"}`,
          ),
        ),
        text(
          "span",
          statusLabels[c.pipeline_status] || c.pipeline_status,
          "tag",
        ),
        button("Abrir", () => showCompany(c.id)),
      ),
    ),
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
async function exportCompanies() {
  let offset = 0,
    items = [];
  do {
    const d = await api(
      `/api/companies?limit=100&offset=${offset}&q=${encodeURIComponent(state.search)}`,
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
    text(
      "p",
      "Marque como confirmado somente com valor e fonte. Campos omitidos permanecem pendentes.",
      "muted",
    ),
  );
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
    const row = el(
      "div",
      { class: "demand-field" },
      edit.node,
      status.node,
      unit?.node || text("span", ""),
      source.node,
    );
    form.append(row);
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
async function showCompany(id, offset = 0) {
  const generation = ++state.generation;
  $("content").replaceChildren(text("p", "Carregando empresa…"));
  const data = await api(`/api/companies/${id}?limit=50&offset=${offset}`);
  if (generation !== state.generation) return;
  const c = data.company,
    node = section(
      c.legal_name,
      `${c.country_code} · ${statusLabels[c.pipeline_status]} · Fonte: ${c.source_label}`,
    );
  node.append(button("Voltar às empresas", () => navigate("Empresas")));
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
        makeForm(
          [
            select("Categoria", "category", [
              ["business", "Prova de compra"],
              ["market", "Mercado agregado"],
              ["commercial_signal", "Sinal comercial"],
            ]),
            select("Tipo de evidência", "evidenceType", [
              "company_document",
              "public_nominal_record",
              "commercial_document",
              "customs_record",
              "bill_of_lading",
              "market_aggregate",
              "commercial_signal",
            ]),
            productSelect(),
            marketSelect("national"),
            input("Referência do documento", "reference"),
            input("URL da fonte", "sourceUrl", "url", "", false),
            input("Data do fato", "factDate", "date", "", false),
            input(
              "Data da consulta",
              "consultedAt",
              "date",
              new Date().toISOString().slice(0, 10),
            ),
            select("Validação", "validationStatus", [
              ["pending", "Pendente"],
              ["valid", "Validada"],
              ["invalid", "Inválida"],
              ["conflicting", "Conflitante"],
            ]),
          ],
          async (v) => {
            await api(`/api/companies/${id}/evidence`, "POST", v);
            await showCompany(id);
          },
          "Registrar evidência",
        ),
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
            input("Nome", "fullName"),
            input("Cargo", "jobTitle", "text", "", false),
            input("E-mail", "email", "email", "", false),
            input("Telefone", "phone", "text", "", false),
            input("LinkedIn", "linkedinUrl", "url", "", false),
            select("Papel na prospecção", "prospectRole", ["decision_maker", "influencer", "provisional_decision_maker", "other"].map((k) => [k, lbl(k)])),
            input("Fuso confirmado do contato (ex.: America/Sao_Paulo) — sem ele o envio espera", "timezone", "text", "", false),
            input("Fonte do contato (ex.: LinkedIn, site)", "sourceLabel"),
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
  $("content").replaceChildren(node);
  $("content").focus({ preventScroll: true });
}
const originLabels = {
  SITE: "Site",
  SOLICITACAO: "Solicitação",
  PORTFOLIO: "Portfólio",
};
const admin = () => state.actor?.role === "admin";
async function reloadProducts() {
  state.products = (await api("/api/catalog")).products;
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
          "tag",
        ),
        button("Detalhes", () => showProduct(p.id)),
      ),
    ),
  );
  if (admin())
    node.append(
      details(
        "Cadastrar produto",
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
  $("content").replaceChildren(node);
  $("content").focus({ preventScroll: true });
}
async function parametersView() {
  const d = await api("/api/parameters"),
    node = section(
      "Parâmetros",
      "Valores versionados. Parâmetro sem valor aprovado fica pendente e bloqueia a função que depende dele.",
    );
  node.append(
    rows(d.definitions, (def) => {
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
          text("small", `${def.key} · escopo ${def.scope} · usado em ${def.requiredBy}`),
          ...configured.map(([scope, value]) =>
            text("small", `${scope}: ${JSON.stringify(value)}`),
          ),
        ),
        text("span", configured.length ? "Com valor" : "Pendente", "tag"),
      );
    }),
  );
  if (state.actor.role === "admin")
    node.append(
      details(
        "Alterar parâmetro",
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
  const d = await api(
      `/api/campaigns?limit=50&offset=${state.listOffsets.Campanhas || 0}`,
    ),
    node = section(
      "Campanhas",
      "Campanhas organizam produto, mercado e cliente ideal. Ativar não inicia busca nem envio nesta versão.",
    );
  node.append(
    rows(d.items, (c) =>
      el(
        "div",
        { class: "row" },
        el(
          "div",
          {},
          text("strong", c.name),
          text(
            "small",
            `${c.market === "national" ? c.origin_city + "/" + c.origin_uf + " · " + c.radius_km + " km" : c.country_code} · v${c.version}`,
          ),
        ),
        text("span", statusLabels[c.status], "tag"),
        button("Detalhes", () => showCampaign(c.id)),
        approver() && c.status !== "active"
          ? button("Ativar", async () => {
              const r = await api(`/api/campaigns/${c.id}/activate`, "POST", {
                expectedVersion: c.version,
              });
              notice(
                r.campaign.status === "waiting"
                  ? "Campanha em espera: duas commodities já estão ativas neste mercado."
                  : "Campanha ativada.",
              );
              await navigate("Campanhas");
            })
          : null,
        c.status === "active" && writable()
          ? button("Pausar", async () => {
              await api(`/api/campaigns/${c.id}`, "PATCH", {
                expectedVersion: c.version,
                status: "paused",
              });
              await navigate("Campanhas");
            })
          : null,
      ),
    ),
  );
  listPager(node, d, "Campanhas");
  if (writable())
    node.append(
      details(
        "Criar campanha",
        makeForm(
          [
            input("Nome", "name"),
            productSelect(),
            marketSelect("national"),
            input("Cidade de origem nacional", "originCity", "text", "", false),
            input("UF nacional", "originUf", "text", "", false),
            select("Raio nacional", "radiusKm", [
              5,
              ...Array.from({ length: 15 }, (_, i) => (i + 1) * 100),
            ]),
            input(
              "País internacional (código de 2 letras)",
              "countryCode",
              "text",
              "",
              false,
            ),
            input("Setores usuários, separados por vírgula", "userSectors"),
            select("Porte alvo", "sizeTarget", [
              ["small_plus", "Pequeno ou maior"],
              ["medium", "Médio"],
              ["medium_plus", "Médio ou maior"],
            ]),
            input("Região do cliente ideal", "region"),
            input("Cargo decisor", "decisionRole"),
            input("Cargo influenciador", "influencerRole"),
            input("Dores de suprimento", "supplyPains", "textarea", "", false),
          ],
          async (v) => {
            await api("/api/campaigns", "POST", {
              ...v,
              radiusKm: Number(v.radiusKm),
              icp: {
                userSectors: v.userSectors
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                sizeTarget: v.sizeTarget,
                region: v.region,
                decisionRole: v.decisionRole,
                influencerRole: v.influencerRole,
                supplyPains: v.supplyPains,
              },
            });
            notice("Campanha criada como rascunho.");
            await navigate("Campanhas");
          },
          "Criar campanha",
        ),
      ),
    );
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
  $("content").replaceChildren(node);
  $("content").focus({ preventScroll: true });
}
async function suppressionView() {
  const node = section(
    "Supressão",
    "Registre pedidos de não contato. O identificador fica protegido por HMAC; esta versão não remove supressões.",
  );
  if (writable())
    node.append(
      makeForm(
        [
          select("Canal", "channel", [
            ["email", "E-mail"],
            ["phone", "Telefone"],
            ["linkedin", "LinkedIn"],
          ]),
          input("E-mail, telefone internacional ou URL do perfil", "value"),
          select("Motivo", "reason", [
            ["opt_out", "Pedido de descadastro"],
            ["manual_request", "Pedido recebido manualmente"],
            ["hard_bounce", "Falha definitiva de entrega"],
            ["legacy_import", "Registro legado"],
          ]),
        ],
        async (v) => {
          const r = await api("/api/suppression", "POST", v);
          notice(
            r.created
              ? "Supressão registrada."
              : "Identificador já estava suprimido.",
          );
          await navigate("Supressão");
        },
        "Registrar supressão",
      ),
    );
  if (state.actor.role === "admin") {
    const d = await api(
      `/api/suppression?limit=50&offset=${state.listOffsets["Supressão"] || 0}`,
    );
    node.append(
      rows(d.items, (r) =>
        el(
          "div",
          { class: "row" },
          text("strong", r.identifier_hash),
          text("span", r.channel + " · " + r.reason, "tag"),
        ),
      ),
    );
    listPager(node, d, "Supressão");
  }
  return node;
}
async function pausesView() {
  const d = await api(
      `/api/pauses?limit=50&offset=${state.listOffsets.Pausas || 0}`,
    ),
    node = section(
      "Pausas",
      "Registro de pausas por escopo. A integração com o agendador será feita antes de habilitar envios.",
    );
  node.append(
    rows(d.items, (p) =>
      el(
        "div",
        { class: "row" },
        el(
          "div",
          {},
          text("strong", p.scope + " · " + (p.scope_ref || "Toda operação")),
          text("small", p.reason),
        ),
        text("span", p.resumed_at ? "Retomada" : "Em pausa", "tag"),
        !p.resumed_at && writable()
          ? button("Retomar", async () => {
              const reason = window.prompt("Motivo da retomada:");
              if (!reason) return;
              await api(`/api/pauses/${p.id}/resume`, "POST", { reason });
              await navigate("Pausas");
            })
          : null,
      ),
    ),
  );
  listPager(node, d, "Pausas");
  if (writable())
    node.append(
      details(
        "Registrar pausa",
        makeForm(
          [
            select(
              "Escopo",
              "scope",
              approver()
                ? ["operation", "company", "campaign", "commodity"]
                : ["company", "campaign", "commodity"],
            ),
            input(
              "Identificador do escopo (vazio para operação)",
              "scopeRef",
              "text",
              "",
              false,
            ),
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
  out_giant: "Gigante",
  out_small: "Micro/MEI",
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
            ? button("Qualificar porte na ligação", async () => {
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
async function radarView() {
  const node = section("Radar", "Compradores por raio a partir da cidade do fornecedor. Centro do município é estimativa; fonte parcial nunca vira “nenhuma empresa”.");
  const [campaigns, params, sectors] = await Promise.all([campaignsOf("national"), api("/api/parameters"), api("/api/sectors")]);
  const active = campaigns.filter((c) => c.status === "active");
  if (!active.length) node.append(text("p", "Nenhuma campanha nacional ativa. Ative uma campanha para buscar.", "empty"));
  const radii = params.parameters["radius_allowed_km:national"] || [];
  for (const c of active) {
    const box = panel(`${c.name} · ${c.origin_city}/${c.origin_uf}`);
    const list = await api(`/api/searches?campaignId=${c.id}`);
    box.append(
      rows(list.items, (s) =>
        el(
          "div",
          { class: "row" },
          el("div", {}, text("strong", `Versão ${s.version} · ${s.radius_km} km`), text("small", `${s.candidates_count} candidatos · ${s.api_calls} consultas${s.coverage_note ? " · " + s.coverage_note : ""}`)),
          text("span", lbl(s.status), "tag"),
          button("Ver candidatos", () => showSearch(s.id)),
        ),
      ),
    );
    if (writable())
      box.append(
        makeForm(
          [select("Raio (km)", "radiusKm", radii.map((r) => [String(r), `${r} km`]), String(c.radius_km))],
          async (v) => {
            const r = await api("/api/searches", "POST", { campaignId: c.id, radiusKm: Number(v.radiusKm) });
            notice(r.reused ? "Busca de hoje já existe para estes parâmetros." : `Busca iniciada em ${r.partitions} consulta(s).`);
            await navigate("Radar");
          },
          "Buscar",
        ),
      );
    node.append(box);
  }
  node.append(
    panel(
      "Setores usuários → CNAE",
      text("p", "Setor sem CNAE aprovado bloqueia a busca. Cadastre a subclasse com a fonte da CONCLA/IBGE.", "muted"),
      rows(sectors.items, (x) => el("div", { class: "row" }, el("div", {}, text("strong", `${x.sector_key} · ${x.cnae_code}`), text("small", `${x.label} · ${x.source}`)))),
    ),
  );
  if (admin())
    node.append(
      details(
        "Cadastrar setor → CNAE",
        makeForm(
          [input("Setor usuário (como no ICP)", "sector"), input("CNAE (subclasse, 7 dígitos)", "cnaeCode"), input("Descrição da subclasse", "label"), input("Fonte (URL)", "source")],
          async (v) => {
            await api("/api/sectors", "POST", v);
            notice("Associação registrada.");
            await navigate("Radar");
          },
          "Cadastrar",
        ),
      ),
    );
  return node;
}

async function showSearch(id, order = "icp", offset = 0) {
  const [d, c] = await Promise.all([api(`/api/searches/${id}`), api(`/api/searches/${id}/candidates?order=${order}&limit=50&offset=${offset}`)]);
  const s = d.search;
  const node = section(`Busca v${s.version} · ${s.radius_km} km`, `${lbl(s.status)} · ${s.candidates_count} candidatos · ${s.api_calls} consultas`);
  node.append(button("Voltar ao Radar", () => navigate("Radar")));
  if (s.coverage_note) node.append(text("p", s.coverage_note, "error"));
  if (["partial", "failed"].includes(s.status) && approver())
    node.append(button("Tentar de novo", async () => {
      await api(`/api/searches/${id}/resume`, "POST", {});
      notice("Consultas com falha voltaram para a fila.");
      await showSearch(id, order);
    }));
  node.append(
    el(
      "div",
      { class: "toolbar" },
      button("Ordenar por ICP", () => showSearch(id, "icp")),
      button("Ordenar por distância", () => showSearch(id, "distance")),
    ),
    rows(c.items, (x) =>
      el(
        "div",
        { class: "row" },
        el(
          "div",
          {},
          text("strong", x.trade_name || x.legal_name),
          text("small", `${x.municipality_name || "—"}/${x.uf || "—"} · ${x.distance_km == null ? "distância desconhecida" : `${x.distance_km.toFixed(1)} km`} (${lbl(x.distance_basis)}) · porte ${x.size_label || "não informado"}`),
        ),
        text("span", `${lbl(x.icp_status)}${x.icp_provisional ? " (provisório)" : ""} · ${lbl(x.inside_radius)}`, "tag"),
        button("Empresa", () => showCompany(x.company_id)),
      ),
    ),
  );
  if (c.nextOffset != null) node.append(button("Próxima página", () => showSearch(id, order, c.nextOffset)));
  $("content").replaceChildren(node);
  $("content").focus({ preventScroll: true });
}

// Fichas: aprovação por destinatário e canal, com o hash do que está na tela.
async function fichasView() {
  const d = await api("/api/fichas?limit=100");
  const node = section("Fichas", "Textos congelados por versão. Aprovar vale para o destinatário e o canal mostrados; qualquer mudança exige nova versão.");
  node.append(
    rows(d.items, (f) =>
      el("div", { class: "row" }, el("div", {}, text("strong", f.legal_name), text("small", `Versão ${f.current_version} · atualizada em ${f.updated_at}`)), text("span", lbl(f.status), "tag"), button("Abrir", () => showFicha(f.id))),
    ),
  );
  return node;
}

async function showFicha(id) {
  const d = await api(`/api/fichas/${id}`);
  const v = d.version;
  const company = await api(`/api/companies/${d.ficha.company_id}`);
  const who = (cid) => {
    const c = company.contacts.find((x) => x.id === cid);
    const r = v.snapshot.recipients.find((x) => x.contactId === cid);
    return `${c?.fullName || cid.slice(0, 8)} (${lbl(r?.role)}${r?.targetFlag ? ", cargo fora do alvo" : ""})`;
  };
  const node = section(`Ficha · ${company.company.legal_name} · versão ${v.no}`, `${lbl(d.ficha.status)} · skill ${v.skill.slice(0, 8)}… · modelos ${v.templates}`);
  node.append(button("Voltar às fichas", () => navigate("Fichas")));
  const bad = v.findings.filter((x) => !x.ok);
  node.append(
    panel(
      "Revisor PV",
      bad.length ? rows(bad, (x) => el("div", { class: "row" }, text("strong", x.id), text("span", x.detail, "error"))) : text("p", "Sem violações.", "success"),
      v.snapshot.fichaNote ? text("p", v.snapshot.fichaNote, "muted") : null,
    ),
  );
  for (const g of d.toApprove) {
    const msgs = d.messages.filter((m) => m.contactId === g.contactId && m.channel === g.channel);
    const approved = d.approvals.find((a) => a.contact_id === g.contactId && a.channel === g.channel);
    const box = panel(`${g.channel === "email" ? "E-mail" : g.channel === "call" ? "Ligações" : "LinkedIn"} · ${who(g.contactId)}`);
    for (const m of msgs)
      box.append(details(`Dia ${m.day} · passo ${m.step}${m.subject ? " · " + m.subject : ""}`, el("pre", { class: "message" }, m.body)));
    if (approved) box.append(text("p", `${approved.status === "approved" ? "Aprovado" : "Aprovação invalidada"} por ${approved.approved_by} em ${approved.approved_at}`, "tag"));
    else if (approver() && v.reviewOk)
      box.append(
        makeForm(
          [input("Início da cadência (segunda-feira, AAAA-MM-DD)", "startDate", "date", "", false)],
          async (x) => {
            await api(`/api/fichas/${id}/approve`, "POST", { versionNo: v.no, contactId: g.contactId, channel: g.channel, messagesSha256: g.messagesSha256, startDate: x.startDate || undefined });
            notice("Aprovado.");
            await showFicha(id);
          },
          "Aprovar este destinatário neste canal",
        ),
      );
    node.append(box);
  }
  if (d.outbox.length)
    node.append(panel("Envios desta ficha", rows(d.outbox, (o) => el("div", { class: "row" }, text("strong", `Passo ${o.step_no} · ${o.planned_date}`), text("span", `${lbl(o.status)}${o.block_reason ? " · " + o.block_reason : ""}`, "tag")))));
  if (writable() && !["discarded"].includes(d.ficha.status))
    node.append(
      el(
        "div",
        { class: "toolbar" },
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
      ),
    );
  $("content").replaceChildren(node);
  $("content").focus({ preventScroll: true });
}

// Envios: rampa, teto, próximo horário, fila e bloqueios; respostas recebidas.
async function enviosView() {
  const [t, inbound] = await Promise.all([api("/api/sending/today"), api("/api/inbound?limit=30")]);
  const node = section("Envios", "Um e-mail por vez, no horário comercial do destinatário. Indeterminado só volta com decisão registrada.");
  node.append(
    kv([
      ["Canal de e-mail", lbl(t.channel)],
      ["Degrau da rampa", `${t.rampStep + 1}`],
      ["Enviados hoje / teto", `${t.sentToday} / ${t.dailyCap ?? "sem parâmetro"}`],
      ["Próximo envio a partir de", t.nextSendAt || "agora, dentro da janela"],
      ["Parada automática", t.stopped ? `${t.stopped.reason} (${t.stopped.at})` : "Não"],
    ]),
  );
  node.append(
    panel(
      "Fila",
      rows(t.queue, (o) =>
        el(
          "div",
          { class: "row" },
          el("div", {}, text("strong", o.legal_name), text("small", `Passo ${o.step_no} · ${o.planned_date}${o.block_reason ? " · motivo: " + o.block_reason : ""}`)),
          text("span", lbl(o.status), "tag"),
          o.status === "indeterminate" && admin()
            ? button("Resolver", async () => {
                const outcome = prompt('Resultado conferido na caixa: digite "sent" (saiu), "not_sent" (não saiu) ou "cancel".');
                if (!["sent", "not_sent", "cancel"].includes(outcome)) return;
                const reason = prompt("Evidência (ex.: conferido na pasta Enviados):");
                if (!reason) return;
                await api(`/api/sending/outbox/${o.id}/resolve`, "POST", { outcome, reason });
                await navigate("Envios");
              })
            : null,
        ),
      ),
    ),
    panel(
      "Respostas recebidas",
      rows(inbound.items, (m) => el("div", { class: "row" }, el("div", {}, text("strong", m.legal_name || "Remetente sem empresa ligada"), text("small", `${m.received_at} · ${m.correlation}`)), text("span", m.classification, "tag"))),
    ),
  );
  return node;
}

// Tarefas: roteiros da skill, bloqueios e as três perguntas da Level 2.
async function tarefasView() {
  const d = await api(`/api/tasks?until=${new Date().toISOString().slice(0, 10)}&limit=100`);
  const node = section("Tarefas", "Respostas e confirmações primeiro; ligações começam pelos leads mais fracos. Tarefa bloqueada não é concluída.");
  node.append(
    rows(d.items, (t) => {
      const box = el(
        "div",
        { class: "row task" },
        el("div", {}, text("strong", `${t.legal_name} · ${t.kind}`), text("small", `Vence em ${t.due_date}${t.blocked?.length ? " · bloqueada: " + t.blocked.join(", ") : ""}`)),
      );
      if (t.script) box.append(details("Roteiro", el("pre", { class: "message" }, t.script)));
      if (writable() && !t.blocked?.length)
        box.append(
          details(
            "Registrar resultado",
            makeForm(
              [
                select("Resultado", "outcome", [["done", "Feito"], ["no_answer", "Não atendeu"], ["not_reached", "Não falei com a pessoa"], ["wrong_contact", "Contato errado"]]),
                select("Compra de usina ou trading?", "buyingChannel", [["", "Não perguntado"], ["usina", "Usina"], ["trading", "Trading"], ["ambos", "Ambos"]]),
                select("Spot ou contrato?", "modality", [["", "Não perguntado"], ["spot", "Spot"], ["contrato", "Contrato"], ["ambos", "Ambos"]]),
                input("Consumo mensal (t)", "monthlyVolumeT", "number", "", false),
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
    }),
  );
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
  const node = section("Radar Internacional", "Lista básica de países importadores de commodities agrícolas do Brasil, lida da lista mensal já guardada. Nenhuma consulta externa ao abrir.");
  node.setAttribute("data-screen", "internacional");
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (!all) params.set("purchase", "1");
  const d = await api(`/api/radar/importers?${params}`);
  node.append(text("p", d.notice, "notice-fixed"));
  const search = el("input", { type: "search", name: "q", "aria-label": "Buscar país", placeholder: "Buscar país (ex.: Alemanha)", value: query });
  const showAll = el("input", { type: "checkbox", name: "all", "aria-label": "Mostrar também países sem compra identificada" });
  showAll.checked = all;
  const form = el("form", { class: "toolbar", role: "search" }, search, el("label", {}, showAll, " incluir países sem compra identificada"), el("button", { type: "submit" }, "Buscar"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    safe(async () => $("content").replaceChildren(await internacionalView(search.value.trim(), showAll.checked)));
  });
  node.append(
    form,
    text("p", `Fontes: MDIC/Comex Stat (exportações do Brasil, FOB, janela de ${d.periodMonths} meses) e UN Comtrade (importações declaradas pelo país, origem Brasil, último ano declarado) — lado a lado, nunca somadas.${d.latestMonthly ? ` Última rotina mensal: ${d.latestMonthly}.` : ""}`, "muted"),
  );
  if (d.pendingSummaries)
    node.append(
      el(
        "p",
        { class: "muted" },
        `${d.pendingSummaries} resumo(s) em preparação (a lista já está publicada; o cron diário completa). `,
        admin()
          ? button("Preparar agora", async () => {
              const r = await api("/api/radar/importers/summaries/rebuild", "POST", {});
              notice(`${r.built} resumo(s) preparados; faltam ${r.remaining}.`);
              $("content").replaceChildren(await internacionalView(query, all));
            })
          : null,
      ),
    );
  const shown = d.items.slice(0, 80);
  node.append(
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
  );
  if (d.items.length > shown.length) node.append(text("p", `Mostrando ${shown.length} de ${d.items.length}. Refine a busca.`, "muted"));
  const searches = await api("/api/foreign-searches");
  if (searches.items.length)
    node.append(
      panel(
        "Buscas de empresas",
        rows(searches.items, (x) =>
          el(
            "div",
            { class: "row" },
            el("div", {}, text("strong", `${x.country} · ${x.commodity}`), text("small", `${x.status === "open" ? "Aberta" : "Encerrada"} · autorizada em ${x.authorized_at.slice(0, 10)} · ${x.candidates} empresa(s) · ${x.sources} fonte(s) consultada(s)`)),
            button("Abrir", () => showForeignSearch(x.id)),
          ),
        ),
      ),
    );
  const hist = await api("/api/country-analyses");
  node.append(
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
  node.append(text("p", a.notice, "notice-fixed"), button("Voltar aos países", () => navigate("Internacional")));
  node.append(
    el(
      "div",
      { class: "stats" },
      summaryCard(a.summary.mdic, "MDIC — exportações do Brasil para o país (FOB)"),
      summaryCard(a.summary.comtrade, "Comtrade — importações declaradas pelo país, origem Brasil (CIF)"),
    ),
  );
  const chosen = new Map();
  const pick = (r) => {
    if (!(r.purchaseIdentified && approver())) return null;
    const box = el("input", { type: "checkbox", "aria-label": `Selecionar ${r.hs6}` });
    box.checked = chosen.has(r.hs6);
    box.addEventListener("change", () => (box.checked ? chosen.set(r.hs6, r) : chosen.delete(r.hs6)));
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
      top.length
        ? el(
            "div",
            { class: "rows" },
            ...top.map((r) =>
              el(
                "div",
                { class: "row" },
                pick(r),
                el(
                  "div",
                  {},
                  text("strong", `${r.hs6} · ${r.name || "sem nome"}`),
                  text(
                    "small",
                    `MDIC: ${r.mdic ? `${usd(r.mdic.fobUsd)} FOB, última ocorrência ${r.mdic.lastOccurrence}` : "—"} · Comtrade: ${r.comtrade?.latest ? `${r.comtrade.latest.year}, Brasil ${usd(r.comtrade.latest.brazilUsd)}` : "—"}${r.catalog.confirmed.length ? ` · catálogo EAG: ${r.catalog.confirmed.map((c) => c.variant).join(", ")}` : ""}`,
                  ),
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
      node.append(panel("Commodity escolhida", f, out));
      f.scrollIntoView({ block: "nearest" });
    }, true);
    node.append(el("div", { class: "toolbar" }, choose));
  }
  $("content").replaceChildren(node);
  $("content").focus({ preventScroll: true });
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
  return el(
    "div",
    { class: "row" },
    el(
      "div",
      {},
      text("strong", c.name),
      text("span", c.buyerStatusLabel, BUYER_TAG[c.buyerStatus]),
      c.triage?.priority === "secondary" ? text("span", `prioridade secundária${c.triage.priorityReason ? ` — ${c.triage.priorityReason}` : ""}`, "tag warn") : null,
      c.checks?.length ? el("div", {}, text("small", "Pontos a verificar:"), el("ul", {}, ...c.checks.map((k) => el("li", {}, `${k.status === "open" ? "aberto" : k.status === "confirmed" ? "confirmado" : "descartado"}: ${k.topic}${k.note ? ` — ${k.note}` : ""}${k.resolution ? ` → ${k.resolution}` : ""} `, k.sourceUrl ? el("a", { href: k.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, "fonte") : null)))) : null,
      text("small", `Porte: ${c.size ? `${c.size.label} (fonte: ${c.size.source || "sem fonte"})` : "não informado"} · Atividade: ${c.activity ? `${c.activity.text} (fonte: ${c.activity.source})` : "não registrada"} · Perfil: ${c.profile ? `${c.profile.label}, ${c.profile.icpLabel}` : "não registrado"}`),
      c.website ? el("small", {}, "Site: ", el("a", { href: c.website, target: "_blank", rel: "noopener noreferrer" }, c.website)) : text("small", "Site: não registrado"),
      c.importEvidence.length
        ? el("div", {}, text("small", "Evidência de importação/compra (da própria empresa):"), el("ul", {}, ...c.importEvidence.map(evidenceLine)))
        : c.indications.length
          ? el("div", {}, text("small", "Indícios (não confirmam — potencial compradora a validar):"), el("ul", {}, ...c.indications.map(evidenceLine)))
          : text("small", "Sem evidência nem indício de compra registrado."),
      text("small", contacts.length ? `Decisores/contatos com fonte: ${contacts.map((k) => `${k.name}${k.jobTitle ? ` (${k.jobTitle})` : ""} — ${k.source}${k.emailValidation === "valid" ? ", e-mail validado" : ", e-mail não validado"}`).join("; ")}` : "Decisores/contatos com fonte: nenhum"),
      c.pending.length ? el("div", {}, text("small", "Pendências:"), el("ul", {}, ...c.pending.map((p) => el("li", {}, p)))) : null,
      text("small", `Encontrada em: ${c.foundBy.source}${c.foundBy.at ? ` (${c.foundBy.at.slice(0, 10)})` : ""} · Ficha: ${c.ficha.ok ? "pode ser preparada; envio só após aprovação individual" : c.ficha.reason}`),
    ),
    el(
      "div",
      { class: "toolbar" },
      button("Abrir empresa", () => showCompany(c.id)),
      writable() && state.searchId && c.triage
        ? button(c.triage.priority === "secondary" ? "Tornar prioridade principal" : "Marcar prioridade secundária", async () => {
            const secondary = c.triage.priority !== "secondary";
            const reason = secondary ? prompt("Motivo da prioridade secundária:") : null;
            if (secondary && !reason) return;
            await api(`/api/foreign-searches/${state.searchId}/candidates/${c.id}`, "PATCH", { action: "priority", priority: secondary ? "secondary" : "primary", reason });
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
      writable() && state.searchId && c.triage
        ? button("Descartar desta busca", async () => {
            const reason = prompt("Motivo do descarte nesta busca (vale só para esta empresa e este produto):");
            if (!reason) return;
            await api(`/api/foreign-searches/${state.searchId}/candidates/${c.id}`, "PATCH", { action: "dismiss", reason });
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
    ),
    details("Validação assistida (links para você abrir)", el("ul", {}, ...c.validationLinks.map((l) => el("li", {}, el("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, l.label))))),
    writable() ? details("Registrar sinal ou prova de importação", importEvidenceForm(c)) : null,
    details("Pessoas de compras", peoplePanel(c.id)),
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
      text("small", `Identificadas: ${v.counts.identified} · cargo verificado: ${v.counts.titleVerified} · decisor confirmado: ${v.counts.decidersConfirmed} · e-mails validados: ${v.counts.emailsValidated}`),
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
            text("span", p.state, p.state === "decisor de compras confirmado" ? "tag" : "tag warn"),
            p.stale ? text("span", "fonte vencida — reconferir", "tag warn") : null,
            text("small", `Por que: ${p.relevance}`),
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
    );
  };
  load().catch((e) => box.replaceChildren(text("small", e.message)));
  return box;
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
      c.importStatement ? text("small", `Declaração da própria empresa: "${c.importStatement}"`) : null,
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

async function showForeignSearch(id, preloaded) {
  const x = preloaded || (await api(`/api/foreign-searches/${id}`));
  state.searchId = x.id;
  state.searchProductId = x.commodity.productId;
  const node = section(`${x.country.name_pt} · ${x.commodity.label || x.commodity.name}`, `Busca de empresas compradoras (SH6 ${x.commodity.hs6.join(", ")}) · porte-alvo: ${x.target.sizesLabel.join(" e ")} · ${x.status === "open" ? "aberta" : `encerrada em ${x.closedAt.slice(0, 10)}`}`);
  node.setAttribute("data-screen", "internacional");
  node.append(text("p", x.notice, "notice-fixed"), button("Voltar ao Radar", () => navigate("Internacional")));
  if (writable())
    node.append(
      button("Pesquisar pessoas de compras (lote de 5 empresas aderentes)", async () => {
        const r = await api(`/api/foreign-searches/${x.id}/people/research`, "POST", {});
        notice(`${r.researched} empresa(s) pesquisada(s), ${r.added} pessoa(s) a validar; faltam ${r.remaining}. Veja "Pessoas de compras" em cada empresa.`);
      }),
    );
  const m = x.metrics;
  node.append(
    el(
      "div",
      { class: "stats" },
      el("div", { class: "stat" }, text("strong", "Cobertura"), text("p", `${m.coverage.sourcesConsulted} fonte(s) consultada(s), ${m.coverage.sourcesWithResults} com resultado`), text("p", m.coverage.note)),
      el("div", { class: "stat" }, text("strong", "Custo"), text("p", `${m.cost.apiCalls} chamada(s) · ${usd(m.cost.costUsd)} · ${m.cost.minutes} min registrados · ${m.cost.elapsedHours} h desde a autorização`), text("p", m.cost.validCandidates ? `Por candidata válida (${m.cost.validCandidates}): ${usd(m.cost.costPerValidUsd)} e ${m.cost.secondsPerValid} s de consulta` : "Ainda sem candidata válida (com sinal próprio).")),
      el(
        "div",
        { class: "stat" },
        text("strong", "Rendimento"),
        text("p", `${m.yield.found} encontrada(s) pelas fontes gratuitas (${m.yield.foundPending} aguardando decisão, ${m.yield.foundDismissed} descartada(s)) · ${m.yield.candidates} na busca: ${m.yield.consumers} consumidora(s)/processadora(s), ${m.yield.traders} trader(s) · ${m.yield.inTargetSize} no porte-alvo`),
        text("p", `${m.yield.withImportSignal} candidata(s) importadora(s) (evidência ou sinal próprio) · ${m.yield.unverified} com importação não verificada · ${m.yield.withOwnEvidence} com evidência própria`),
        text("p", `${m.yield.confirmedImporters} importadora(s) confirmada(s) · ${m.yield.confirmedBuyers} compradora(s) confirmada(s) · ${m.yield.potentialBuyers} potencial(is) a validar · ${m.yield.withVerifiedDecisionMaker} com decisor com fonte · ${m.yield.eligibleForFicha} apta(s) a ficha`),
      ),
    ),
  );
  node.append(await discoveryPanel(x));
  node.append(panel("O que ainda depende de você", el("ul", {}, ...x.humanSteps.map((h) => el("li", {}, h)))));
  const groups = [
    ["Importadoras — consumidoras finais, fábricas e processadoras", x.groups.consumers],
    ["Importadoras — perfil a confirmar", x.groups.toConfirm],
    ["Importadoras — traders e distribuidores (prioridade secundária)", x.groups.traders],
  ];
  for (const [title, list] of groups) node.append(panel(`${title} (${list.length})`, rows(list, companyResult)));
  // Sem sinal próprio de importação a empresa não é candidata importadora: fica recolhida, aguardando validação.
  node.append(details(`Importação não verificada — usam a commodity, sem sinal próprio de importação (${x.groups.unverified.length})`, rows(x.groups.unverified, companyResult)));
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
  $("content").replaceChildren(node);
  $("content").focus({ preventScroll: true });
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

const views = {
  Hoje: home,
  Empresas: companiesView,
  Campanhas: campaignView,
  Radar: radarView,
  Fichas: fichasView,
  Envios: enviosView,
  Tarefas: tarefasView,
  Internacional: () => internacionalView(),
  "Lista mensal": listaMensalView,
  Catálogo: catalogView,
  Parâmetros: parametersView,
  Supressão: suppressionView,
  Pausas: pausesView,
};
async function start() {
  try {
    const [session, catalog] = await Promise.all([
      api("/api/session"),
      api("/api/catalog"),
    ]);
    state.actor = session.actor;
    state.products = catalog.products;
    $("session").textContent =
      `${session.actor.display_name} · ${session.environment === "local" ? "Ambiente local" : "Produção"}`;
    $("navigation").replaceChildren(
      ...Object.keys(views).map((v) => button(v, () => navigate(v))),
    );
    await navigate("Hoje");
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
$("refresh").addEventListener("click", () =>
  safe(() => (state.actor ? navigate() : start())),
);
start();
