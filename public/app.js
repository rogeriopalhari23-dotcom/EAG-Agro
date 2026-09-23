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
          "Buscas automáticas, fichas comerciais e envio de mensagens aguardam implementação e validação.",
        ),
        text("p", "Nenhuma mensagem é enviada por esta versão.", "muted"),
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
        ),
      ),
    ),
  );
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
            input("Fonte do contato", "sourceLabel"),
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
async function catalogView() {
  const node = section(
    "Catálogo",
    "28 itens do portfólio documentado. Identidade pendente bloqueia uso; características da amostra não viram promessa de oferta.",
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
          text("small", p.group_name + " · " + p.source_ref),
        ),
        text(
          "span",
          p.identity_status === "confirmed" ? "Identificado" : "Pendente",
          "tag",
        ),
      ),
    ),
  );
  return node;
}
async function parametersView() {
  const d = await api("/api/parameters"),
    node = section(
      "Parâmetros",
      "Valores versionados. Mínimos nacionais não definidos continuam desconhecidos.",
    );
  node.append(
    rows(Object.entries(d.parameters), ([k, v]) =>
      el(
        "div",
        { class: "row" },
        text("strong", k),
        text("span", JSON.stringify(v), "tag"),
      ),
    ),
  );
  if (state.actor.role === "admin")
    node.append(
      details(
        "Alterar parâmetro",
        makeForm(
          [
            select("Parâmetro", "key", [
              "volume_min",
              "confidence_min",
              "potential_min",
              "completeness_min",
              "risk_coverage_min",
              "sanctions_max_age_hours",
            ]),
            input("Escopo — global ou commodity:mercado", "scope"),
            input(
              "Valor numérico (volume em MT; sanções em horas)",
              "value",
              "number",
            ),
            input("Motivo da decisão", "reason", "textarea"),
          ],
          async (v) => {
            await api(`/api/parameters/${v.key}`, "PUT", {
              scope: v.scope,
              value: Number(v.value),
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
const views = {
  Hoje: home,
  Empresas: companiesView,
  Campanhas: campaignView,
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
