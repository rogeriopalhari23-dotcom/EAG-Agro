import { fail } from "./http.js";

// Registro tipado dos parâmetros editáveis (R7.1). Nenhum valor padrão mora aqui:
// parâmetro sem vigência aprovada continua ausente e a funcionalidade que depende dele bloqueia (R7.1.1).
const pct = (min = 0) => ({ type: "number", min, max: 100 });
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFINITIONS = {
  confidence_min: { scopes: /^global$/, ...pct(), label: "Confidence mínimo", requiredBy: "gate de qualificação" },
  potential_min: { scopes: /^global$/, ...pct(), label: "Potential mínimo", requiredBy: "gate de qualificação" },
  completeness_min: { scopes: /^global$/, ...pct(), label: "Completude mínima", requiredBy: "gate de qualificação" },
  risk_coverage_min: { scopes: /^global$/, ...pct(), label: "Cobertura mínima de risco", requiredBy: "gate de qualificação" },
  risk_high: { scopes: /^global$/, ...pct(), label: "Risco alto a partir de", requiredBy: "gate de qualificação" },
  sanctions_max_age_hours: { scopes: /^global$/, type: "integer", min: 1, max: 720, label: "Validade da triagem de sanções (h)", requiredBy: "gate e pré-envio" },
  volume_min: {
    scopes: /^[a-z][a-z0-9_]*:(national|international)(:[A-Za-z0-9_-]{1,60})?$/,
    scopeHint: "commodity:national|international[:fornecedor]",
    type: "number",
    min: 0.000001,
    max: 1e12,
    label: "Volume mínimo (MT)",
    requiredBy: "Potential (R4.3)",
  },
  radius_allowed_km: { scopes: /^national$/, type: "radius_list", label: "Raios permitidos (km)", requiredBy: "Radar nacional" },
  radius_default_km: { scopes: /^national$/, type: "integer", min: 1, max: 1500, label: "Raio inicial (km)", requiredBy: "Radar nacional" },
  send_daily_ramp: { scopes: /^email$/, type: "ramp", label: "Rampa diária de envio", requiredBy: "envio" },
  send_interval_minutes: { scopes: /^email$/, type: "interval", label: "Intervalo entre envios (min)", requiredBy: "envio" },
  send_stop_hard_bounce_pct: { scopes: /^email$/, type: "number", min: 0.1, max: 100, label: "Parada por hard bounce (%/semana)", requiredBy: "envio" },
  send_step_up_max_hard_bounce_pct: { scopes: /^email$/, type: "number", min: 0, max: 100, label: "Subida de degrau: hard bounce abaixo de (%)", requiredBy: "envio" },
  send_window: { scopes: /^(national|international)$/, type: "window", label: "Janela de envio no fuso do destinatário", requiredBy: "envio" },
  send_timezone: { scopes: /^national$/, type: "timezone", label: "Fuso do mercado nacional", requiredBy: "envio nacional" },
  email_validation_max_age_days: { scopes: /^email$/, type: "integer", min: 1, max: 365, label: "Validade da validação de e-mail (dias)", requiredBy: "pré-envio (R19.2 item 11)" },
  campaign_review_days: { scopes: /^global$/, type: "integer", min: 1, max: 3650, label: "Revisão de campanha (dias)", requiredBy: "campanhas" },
  period_default_months: { scopes: /^international$/, type: "integer", min: 1, max: 60, label: "Período padrão da análise de país (meses)", requiredBy: "lista internacional (D1)" },
  country_list_refresh_day: { scopes: /^international$/, type: "integer", min: 1, max: 28, label: "Dia da atualização mensal da lista", requiredBy: "lista internacional" },
  agri_classification: { scopes: /^international$/, type: "classification", label: "Commodities agrícolas (capítulos SH, versão)", requiredBy: "lista internacional (D2)" },
  trade_list_mdic_years: { scopes: /^international$/, type: "integer", min: 1, max: 5, label: "Anos do arquivo do MDIC na lista", requiredBy: "lista internacional" },
  trade_list_comtrade_years: { scopes: /^international$/, type: "integer", min: 1, max: 5, label: "Anos declarados da Comtrade na lista", requiredBy: "lista internacional" },
  comtrade_calls_per_day: { scopes: /^international$/, type: "integer", min: 1, max: 100000, label: "Chamadas à Comtrade por dia (teto)", requiredBy: "lista internacional" },
  trade_list_retention_versions: { scopes: /^international$/, type: "integer", min: 1, max: 24, label: "Versões da lista guardadas", requiredBy: "lista internacional" },
  international_enabled: { scopes: /^international$/, type: "release", label: "Internacional liberado (T12)", requiredBy: "aprovação de fichas internacionais" },
  templates_en_approved: { scopes: /^pv-en-\d+\.\d+\.\d+$/, scopeHint: "pv-en-<versão>", type: "release", label: "Tradução em inglês aprovada por Rogério", requiredBy: "fichas em inglês (PV12)" },
};

function numberIn(v, d, integer = false) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < d.min || v > d.max || (integer && !Number.isInteger(v)))
    fail(422, "invalid_parameter_value", `Valor fora do intervalo ${d.min}–${d.max}.`);
  return v;
}

function ascendingIntegers(v, { min, max, maxLength }) {
  if (!Array.isArray(v) || v.length < 1 || v.length > maxLength)
    fail(422, "invalid_parameter_value", `Informe de 1 a ${maxLength} valores.`);
  v.forEach((x, i) => {
    if (!Number.isInteger(x) || x < min || x > max || (i && x <= v[i - 1]))
      fail(422, "invalid_parameter_value", "Use inteiros positivos em ordem crescente, sem repetição.");
  });
  return v;
}

export function validTimezone(tz) {
  if (typeof tz !== "string" || !tz.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Valida o valor e as relações com parâmetros vigentes (current = mapa "chave:escopo" → valor).
export function validateParameter(key, scope, value, current = {}) {
  const d = DEFINITIONS[key];
  if (!d) fail(422, "parameter_not_editable", "Parâmetro não editável nesta versão.");
  if (!d.scopes.test(scope))
    fail(422, "invalid_scope", `Escopo inválido. Use: ${d.scopeHint || d.scopes.source.replace(/[\^$]/g, "")}.`);
  switch (d.type) {
    case "number":
      return numberIn(value, d);
    case "integer": {
      numberIn(value, d, true);
      if (key === "radius_default_km") {
        const allowed = current["radius_allowed_km:national"];
        if (!Array.isArray(allowed) || !allowed.includes(value))
          fail(422, "invalid_parameter_value", "O raio inicial precisa estar na lista de raios permitidos.");
      }
      return value;
    }
    case "radius_list": {
      ascendingIntegers(value, { min: 1, max: 1500, maxLength: 30 });
      const def = current["radius_default_km:national"];
      if (def !== undefined && !value.includes(def))
        fail(422, "invalid_parameter_value", "A lista precisa manter o raio inicial vigente.");
      return value;
    }
    case "ramp":
      return ascendingIntegers(value, { min: 1, max: 500, maxLength: 12 });
    case "interval": {
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== "max,min")
        fail(422, "invalid_parameter_value", "Informe {min, max} em minutos.");
      numberIn(value.min, { min: 1, max: 240 }, true);
      numberIn(value.max, { min: 1, max: 240 }, true);
      if (value.min > value.max) fail(422, "invalid_parameter_value", "O mínimo não pode passar do máximo.");
      return value;
    }
    case "window": {
      if (!value || typeof value !== "object" || Array.isArray(value))
        fail(422, "invalid_parameter_value", 'Informe {"start":"09:00","end":"17:00","weekdays":[1,2,3,4,5]}.');
      if (!HHMM.test(value.start) || !HHMM.test(value.end) || value.start >= value.end)
        fail(422, "invalid_parameter_value", "Horários HH:MM com início antes do fim.");
      ascendingIntegers(value.weekdays, { min: 1, max: 7, maxLength: 7 });
      return { start: value.start, end: value.end, weekdays: value.weekdays };
    }
    case "classification": {
      if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.version !== "string" || !/^[a-z0-9@._-]{3,60}$/i.test(value.version))
        fail(422, "invalid_parameter_value", 'Informe {"version":"sh-01-24@AAAA-MM-DD","chapters":["01",…],"excluded":["03"]}.');
      const ch = (list, max) => {
        if (!Array.isArray(list) || list.length > max || list.some((c, i) => !/^\d{2}$/.test(c) || c === "00" || (i && c <= list[i - 1])))
          fail(422, "invalid_parameter_value", "Capítulos com dois dígitos, em ordem crescente, sem repetição.");
        return list;
      };
      const chapters = ch(value.chapters, 97), excluded = ch(value.excluded ?? [], 97);
      if (!chapters.length) fail(422, "invalid_parameter_value", "Informe ao menos um capítulo.");
      if (excluded.some((c) => chapters.includes(c))) fail(422, "invalid_parameter_value", "Capítulo excluído não pode estar na lista.");
      return { version: value.version, chapters, excluded };
    }
    case "release": {
      if (!value || typeof value !== "object" || typeof value.enabled !== "boolean")
        fail(422, "invalid_parameter_value", 'Informe {"enabled":true,"evidenceRef":"docs/…#…"}.');
      if (value.enabled && !/^docs\/[\w./-]+\.md#[\w-]+$/.test(value.evidenceRef ?? ""))
        fail(422, "evidence_required", "Liberar exige a referência ao registro de validação (docs/…#…).");
      return value.enabled ? { enabled: true, evidenceRef: value.evidenceRef } : { enabled: false };
    }
    case "timezone":
      if (!validTimezone(value)) fail(422, "invalid_parameter_value", "Fuso IANA inválido, ex.: America/Sao_Paulo.");
      return value;
  }
  throw new Error("tipo de parâmetro sem validador: " + d.type);
}

// Cruzamento entre dois parâmetros de envio: subir degrau exige limite abaixo da parada.
export function crossCheck(key, scope, value, current) {
  if (key === "send_step_up_max_hard_bounce_pct") {
    const stop = current[`send_stop_hard_bounce_pct:${scope}`];
    if (stop !== undefined && value >= stop)
      fail(422, "invalid_parameter_value", "O limite para subir de degrau precisa ficar abaixo do limite de parada.");
  }
  if (key === "send_stop_hard_bounce_pct") {
    const step = current[`send_step_up_max_hard_bounce_pct:${scope}`];
    if (step !== undefined && value <= step)
      fail(422, "invalid_parameter_value", "O limite de parada precisa ficar acima do limite para subir de degrau.");
  }
}

export function definitionsView(current) {
  return Object.entries(DEFINITIONS).map(([key, d]) => ({
    key,
    label: d.label,
    type: d.type,
    scope: d.scopeHint || d.scopes.source.replace(/[\^$]/g, ""),
    requiredBy: d.requiredBy,
    configuredScopes: Object.keys(current)
      .filter((k) => k.startsWith(key + ":"))
      .map((k) => k.slice(key.length + 1)),
  }));
}
