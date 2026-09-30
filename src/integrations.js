// Estado das integrações para o admin (sem valores de segredo) e conferência da caixa sem envio.
// Serve para Rogério e para a verificação depois de cada `wrangler secret put`: só diz se está configurado.
import { bodyJson, fail, requireRole } from "./http.js";
import { statement as s, commit, auditStatement, parameters } from "./store.js";
import { imapClient } from "./adapters/imap.js";
import { AdapterError } from "./adapters/errors.js";
import { identifierHash } from "./crypto.js";
import { isSuppressed } from "./operations.js";
import * as comtrade from "./adapters/comtrade.js";

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
      // Diagnóstico sem expor valor: tamanho, bordas e formato (sem regra oficial de formato; validação só por chamada real).
      comtradeKeyShape: has(env.COMTRADE_KEY) ? { length: env.COMTRADE_KEY.length, edgesWhitespace: env.COMTRADE_KEY !== env.COMTRADE_KEY.trim(), hex: /^[0-9a-f]+$/i.test(env.COMTRADE_KEY.trim()) } : null,
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

// Alcance a partir do Worker (rede da Cloudflare), sem login: abre TLS, lê só a saudação e fecha.
async function greet(host, port, bye, deps) {
  const { connect } = deps.sockets ?? (await import("cloudflare:sockets"));
  const socket = connect({ hostname: host, port }, { secureTransport: "on", allowHalfOpen: false });
  let stage = "open";
  const reader = socket.readable.getReader();
  try {
    // Etapa 1: conexão TCP + TLS (erros de rede/bloqueio aparecem aqui); etapa 2: saudação do servidor.
    const opened = await Promise.race([socket.opened, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout ao abrir")), 10000))]);
    stage = "greeting";
    const first = await Promise.race([reader.read(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout na saudação")), 10000))]);
    if (first.done) return { ok: false, stage, error: "conexão fechada sem saudação", remote: opened?.remoteAddress ?? null };
    const line = new TextDecoder().decode(first.value || new Uint8Array()).split("\r\n")[0].slice(0, 80);
    const w = socket.writable.getWriter();
    await w.write(new TextEncoder().encode(bye)).catch(() => {});
    return { ok: /^(\* OK|220)/.test(line), greeting: line, remote: opened?.remoteAddress ?? null };
  } catch (e) {
    return { ok: false, stage, error: String(e?.message || e).slice(0, 120) };
  } finally {
    try {
      await socket.close();
    } catch {}
  }
}

export async function reachMailbox(request, env, actor, rid, deps = {}) {
  requireRole(actor, ADMIN);
  await bodyJson(request);
  const imap = await greet(env.IMAP_HOST || "imap.hostinger.com", Number(env.IMAP_PORT || 993), "a1 LOGOUT\r\n", deps);
  const smtp = await greet(env.SMTP_HOST || "smtp.hostinger.com", Number(env.SMTP_PORT || 465), "QUIT\r\n", deps);
  await commit(env, [auditStatement(env, actor, rid, "integration.mailbox_reached", "integration", "mailbox", { imap: imap.ok, smtp: smtp.ok })]);
  return { imap, smtp };
}

// Chamada real mínima à Comtrade com a configuração de produção (T12). Nunca devolve nem registra a chave:
// só códigos HTTP, mensagem do gateway (com a chave mascarada), metadados da consulta e o formato do valor.
// Em 401 compara formas de envio e endpoints para separar autenticação de endpoint/parâmetros/produto.
const COMTRADE_PROBE = { reporterCode: "276", period: "2024", partnerCode: "76", flowCode: "M", cmdCode: "090111", partner2Code: "0", customsCode: "C00", motCode: "0", includeDesc: "true" };

export async function checkComtrade(request, env, actor, rid, deps = {}) {
  requireRole(actor, ADMIN);
  const input = (await bodyJson(request)) || {};
  const f = deps.fetch || fetch;
  if (input.cmdCount !== undefined) return probeComtradeSize(env, actor, rid, f, input.cmdCount);
  const base = env.COMTRADE_BASE || "https://comtradeapi.un.org";
  const raw = env.COMTRADE_KEY || "";
  const key = raw.trim();
  // Mascara o valor inteiro e qualquer trecho testado (o gateway pode ecoar o que recebeu).
  const secrets = [key, ...key.split(/[\s,;:"'=]+/).filter((p) => p.length >= 16)].filter(Boolean).sort((a, b) => b.length - a.length);
  const mask = (t) => secrets.reduce((acc, x) => acc.split(x).join("***"), String(t));
  const qs = new URLSearchParams(COMTRADE_PROBE).toString();
  async function call(label, path, { header, query } = {}) {
    const url = `${base}${path}?${qs}${query ? `&subscription-key=${encodeURIComponent(query)}` : ""}`;
    try {
      const r = await f(url, { headers: header ? { "Ocp-Apim-Subscription-Key": header } : {}, signal: AbortSignal.timeout(30000) });
      const text = await r.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {}
      const out = { label, endpoint: path, status: r.status };
      if (r.ok && body && Array.isArray(body.data)) {
        out.count = body.data.length;
        out.records = body.data.slice(0, 3).map((x) => ({
          refYear: x.refYear, period: x.period, reporter: `${x.reporterCode} ${x.reporterDesc ?? ""}`.trim(), partner: `${x.partnerCode} ${x.partnerDesc ?? ""}`.trim(),
          flow: `${x.flowCode} ${x.flowDesc ?? ""}`.trim(), cmd: `${x.cmdCode} ${x.cmdDesc ?? ""}`.trim().slice(0, 80), cifvalue: x.cifvalue ?? null, primaryValue: x.primaryValue ?? null, netWgt: x.netWgt ?? null,
        }));
        if (body.error) out.apiError = mask(body.error).slice(0, 200);
      } else out.message = mask(body?.message ?? body?.error ?? text).slice(0, 300);
      return out;
    } catch (e) {
      return { label, endpoint: path, status: null, message: mask(e?.message || e).slice(0, 200) };
    }
  }
  const nonAlnum = [...new Set(raw.replace(/[A-Za-z0-9]/g, ""))];
  const shape = {
    length: raw.length, trimmedLength: key.length, edgesWhitespace: raw !== key, internalWhitespace: /\s/.test(key),
    lowerHex: (key.match(/[0-9a-f]/g) || []).length, upper: (key.match(/[A-Z]/g) || []).length, otherLower: (key.match(/[g-z]/g) || []).length,
    symbols: nonAlnum.map((c) => (/\s/.test(c) ? `espaço(${c.charCodeAt(0)})` : c)),
  };
  const query = { endpoint: "/data/v1/get/C/A/HS", ...COMTRADE_PROBE, meaning: "Alemanha (276) importando do Brasil (76), café não torrado (090111), 2024, anual, HS" };
  const calls = [];
  if (!key) return { configured: false, shape, query, calls };
  calls.push(await call("chave no cabeçalho (forma usada pelo Compass)", "/data/v1/get/C/A/HS", { header: key }));
  if (calls[0].status === 401 || calls[0].status === 403) {
    calls.push(await call("chave na query subscription-key", "/data/v1/get/C/A/HS", { query: key }));
    calls.push(await call("sem chave (mensagem de referência do gateway)", "/data/v1/get/C/A/HS"));
    calls.push(await call("endpoint público sem chave (confere parâmetros)", "/public/v1/preview/C/A/HS"));
    // Valor com separadores (ex.: rótulo colado junto): testa só o maior trecho alfanumérico, sem devolvê-lo.
    const parts = key.split(/[\s,;:"'=]+/).filter((p) => p.length >= 16);
    if (parts.length > 1 || (parts.length === 1 && parts[0] !== key)) {
      const longest = parts.sort((a, b) => b.length - a.length)[0];
      const r = await call("maior trecho alfanumérico do valor, no cabeçalho", "/data/v1/get/C/A/HS", { header: longest });
      r.segmentLength = longest.length;
      calls.push(r);
    }
  }
  await commit(env, [auditStatement(env, actor, rid, "integration.comtrade_checked", "integration", "comtrade", { statuses: calls.map((c) => c.status) })]);
  return { configured: true, base, shape, query, calls };
}

// Mede o limite de tamanho da consulta: a mesma forma de fetchImports (Alemanha, mundo + Brasil, 3 últimos anos
// declarados) com os n primeiros códigos SH6 aprovados. Uma chamada com chave; devolve só código e tamanho da URL.
async function probeComtradeSize(env, actor, rid, f, cmdCount) {
  const n = Number(cmdCount);
  if (!Number.isInteger(n) || n < 1 || n > 1000) fail(422, "invalid_cmd_count", "cmdCount deve ser inteiro entre 1 e 1000.");
  const key = (env.COMTRADE_KEY || "").trim();
  if (!key) fail(422, "comtrade_not_configured", "COMTRADE_KEY não configurada.");
  const base = env.COMTRADE_BASE || "https://comtradeapi.un.org";
  const p = await parameters(env, actor.tenant_id);
  const cls = p["agri_classification:international"];
  if (!cls?.chapters) fail(409, "classification_missing", "Classificação agrícola (D2) não aprovada.");
  const { codes } = await comtrade.loadHsBlocks(base, cls.chapters, f, 1);
  const years = (await comtrade.availableYears(base, 276, f)).slice(-3);
  const q = new URLSearchParams({ reporterCode: "276", period: years.join(","), partnerCode: "0,76", flowCode: "M", cmdCode: codes.slice(0, n).join(","), partner2Code: "0", customsCode: "C00", motCode: "0", includeDesc: "false" });
  const url = `${base}/data/v1/get/C/A/HS?${q}`;
  let status = null, count = null, message = null;
  try {
    const r = await f(url, { headers: { "Ocp-Apim-Subscription-Key": key }, signal: AbortSignal.timeout(60000) });
    status = r.status;
    const text = await r.text();
    try {
      const b = JSON.parse(text);
      count = Array.isArray(b?.data) ? b.data.length : null;
      message = count === null ? String(b?.message ?? b?.error ?? "").split(key).join("***").slice(0, 200) : null;
    } catch {
      message = text.split(key).join("***").slice(0, 200);
    }
  } catch (e) {
    message = String(e?.message || e).slice(0, 200);
  }
  await commit(env, [auditStatement(env, actor, rid, "integration.comtrade_size_probed", "integration", "comtrade", { cmdCount: n, urlLength: url.length, status })]);
  return { cmdCount: Math.min(n, codes.length), totalCodes: codes.length, years, urlLength: url.length, status, count, message };
}

// Alcance das fontes gratuitas de descoberta a partir do Worker (IPs da Cloudflare): uma consulta mínima em cada,
// sem gravar candidatos. Só código HTTP, tempo e quantidade de itens.
export async function reachDiscovery(request, env, actor, rid, deps = {}) {
  requireRole(actor, ADMIN);
  await bodyJson(request);
  const f = deps.fetch || fetch;
  const probe = async (name, fn) => {
    const t = Date.now();
    try {
      const r = await fn();
      return { name, ok: r.status === 200, ms: Date.now() - t, ...r };
    } catch (e) {
      return { name, ok: false, ms: Date.now() - t, error: String(e?.message || e).slice(0, 160) };
    }
  };
  const results = [
    await probe("OpenStreetMap (Overpass)", async () => {
      const r = await f("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "EAG-Compass/0.3" }, body: `data=${encodeURIComponent('[out:json][timeout:25];area["ISO3166-1"="DE"][admin_level=2]->.a;nwr["craft"="coffee_roaster"](area.a);out ids 5;')}`, signal: AbortSignal.timeout(60000) });
      const d = r.ok ? await r.json() : null;
      return { status: r.status, items: d?.elements?.length ?? null };
    }),
    await probe("Registro da França", async () => {
      const r = await f("https://recherche-entreprises.api.gouv.fr/search?activite_principale=10.83Z&etat_administratif=A&per_page=1", { headers: { "User-Agent": "EAG-Compass/0.3" }, signal: AbortSignal.timeout(30000) });
      const d = r.ok ? await r.json() : null;
      return { status: r.status, items: d?.total_results ?? null };
    }),
    await probe("EORI (Comissão Europeia)", async () => {
      const r = await f("https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/validation", { method: "POST", headers: { "content-type": "text/xml; charset=utf-8", SOAPAction: "" }, body: '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ev="http://eori.ws.eos.dds.s/"><soapenv:Header/><soapenv:Body><ev:validateEORI><ev:eori>FR31847482200208</ev:eori></ev:validateEORI></soapenv:Body></soapenv:Envelope>', signal: AbortSignal.timeout(30000) });
      return { status: r.status, items: (await r.text()).includes("<status>0</status>") ? 1 : 0 };
    }),
    await probe("Registro da Noruega", async () => {
      const r = await f("https://data.brreg.no/enhetsregisteret/api/enheter?naeringskode=10.830&size=1", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      const d = r.ok ? await r.json() : null;
      return { status: r.status, items: d?.page?.totalElements ?? null };
    }),
    await probe("Deutscher Kaffeeverband (Kaffeekontakte)", async () => {
      const r = await f("https://www.kaffeeverband.de/de/kaffeekontakte/?s=Rohkaffee", { headers: { "User-Agent": "EAG-Compass/0.3 (+uso interno EAG Agro; consulta pontual)" }, signal: AbortSignal.timeout(30000) });
      const h = r.ok ? await r.text() : "";
      return { status: r.status, items: (h.match(/<li data-zip=/g) || []).length };
    }),
    // Pessoas de compras: QSA pela BrasilAPI (torrefação real em Franca/SP) e um Impressum real de torrefação alemã.
    await probe("BrasilAPI CNPJ (QSA)", async () => {
      const r = await f("https://brasilapi.com.br/api/cnpj/v1/20975738000181", { headers: { Accept: "application/json", "User-Agent": "EAG-Compass/0.3 (+uso interno EAG Agro)" }, signal: AbortSignal.timeout(30000) });
      const d = r.ok ? await r.json() : null;
      return { status: r.status, items: d?.qsa?.length ?? null };
    }),
    await probe("Impressum (site de empresa alemã)", async () => {
      const r = await f("https://www.24grad.net/impressum/", { headers: { "User-Agent": "EAG-Compass/0.3 (+uso interno EAG Agro)", Accept: "text/html" }, signal: AbortSignal.timeout(30000) });
      const h = r.ok ? await r.text() : "";
      return { status: r.status, items: /vertreten durch/i.test(h) ? 1 : 0 };
    }),
    await probe("GLEIF", async () => {
      const r = await f("https://api.gleif.org/api/v1/lei-records?filter[fulltext]=Rösterei&filter[entity.legalAddress.country]=DE&page[size]=1", { headers: { Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(30000) });
      const d = r.ok ? await r.json() : null;
      return { status: r.status, items: d?.meta?.pagination?.total ?? null };
    }),
  ];
  await commit(env, [auditStatement(env, actor, rid, "integration.discovery_reached", "integration", "discovery", { ok: results.map((r) => r.ok) })]);
  return { results };
}

// POST /api/integrations/suppression/check — diagnóstico interno, só leitura (2026-09-29): a chave HMAC carrega, o hash é
// estável e a consulta à lista de supressão roda. Usa um endereço reservado (.invalid, RFC 2606) que nunca recebe mensagem;
// não grava na lista nem mostra hash ou chave.
export async function checkSuppression(request, env, actor, rid) {
  requireRole(actor, ADMIN);
  const i = await bodyJson(request);
  // Teste interno: só endereços da lista interna (INTERNAL_TEST_RECIPIENTS); devolve se cada um está suprimido e se o hash
  // de algum alias coincide com o do primeiro endereço da lista (não deve — "+alias" é outro identificador). Sem hashes.
  if (Array.isArray(i.internalEmails)) {
    const allowed = String(env.INTERNAL_TEST_RECIPIENTS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
    const list = i.internalEmails.map((x) => String(x).trim().toLowerCase());
    if (!list.length || list.length > 10 || list.some((x) => !allowed.includes(x))) fail(422, "not_internal", "Só endereços da lista de teste interno.");
    const main = await identifierHash(env, actor.tenant_id, "email", allowed[0]);
    const result = [];
    for (const e of list)
      result.push({ email: e, suppressed: await isSuppressed(env, actor.tenant_id, "email", e), sameHashAsMain: e !== allowed[0] && (await identifierHash(env, actor.tenant_id, "email", e)) === main });
    await commit(env, [auditStatement(env, actor, rid, "integration.suppression_checked", "integration", "suppression", { internalEmails: list.length })]);
    return { main: allowed[0], result };
  }
  const probe = "verificacao-interna@eag-compass.invalid";
  const out = { keyLoaded: false, stableHash: false, lookupOk: false, probeSuppressed: null, entries: null, error: null };
  try {
    const [a, b] = [await identifierHash(env, actor.tenant_id, "email", probe), await identifierHash(env, actor.tenant_id, "email", probe.toUpperCase())];
    out.keyLoaded = true;
    out.stableHash = a === b && /^[0-9a-f]{64}$/.test(a);
    out.probeSuppressed = await isSuppressed(env, actor.tenant_id, "email", probe);
    out.entries = (await s(env, "SELECT COUNT(*) n FROM suppression_entries WHERE tenant_id=?", actor.tenant_id).first()).n;
    out.lookupOk = true;
  } catch (e) {
    out.error = String(e?.message || e).slice(0, 160);
  }
  await commit(env, [auditStatement(env, actor, rid, "integration.suppression_checked", "integration", "suppression", { keyLoaded: out.keyLoaded, lookupOk: out.lookupOk })]);
  return out;
}
