import {
  ApiException,
  response,
  fail,
  bodyJson,
  assertSameOrigin,
  str,
  securityHeaders,
  page,
  requireRole,
  WRITE_ROLES,
} from "./http.js";
import { getActor } from "./auth.js";
import { statement as s, parameters, product, commit, auditStatement, now } from "./store.js";
import { complementCompany } from "./relations.js";
import * as companies from "./companies.js";
import * as operations from "./operations.js";
import * as catalog from "./catalog.js";
import * as sectors from "./sectors.js";
import * as search from "./search.js";
import * as profiles from "./profiles.js";
import * as compliance from "./compliance.js";
import * as emailValidation from "./email-validation.js";
import * as fichas from "./fichas.js";
import { handleUnsubscribe } from "./unsubscribe.js";
import { handleBridge } from "./bridge.js";
import * as sanctions from "./sanctions.js";
import * as changes from "./changes.js";
import * as erasure from "./erasure.js";
import * as retention from "./retention.js";
import * as sending from "./sending.js";
import * as inbound from "./inbound.js";
import * as tasks from "./tasks.js";
import * as openclaw from "./openclaw.js";
import * as channels from "./channels.js";
import * as tradeList from "./trade-list.js";
import * as importers from "./importers.js";
import * as countryAnalysis from "./country-analysis.js";
import * as selections from "./selections.js";
import * as foreign from "./foreign-companies.js";
import * as foreignSearch from "./foreign-search.js";
import * as discovery from "./discovery.js";
import * as people from "./people.js";
import * as decisionReview from "./decision-review.js";
import * as integrations from "./integrations.js";
import * as rounds from "./rounds.js";
import * as prospect from "./prospect/engine.js";
import { readProvenance } from "./provenance.js";
import { handleQueue, handlers as queueHandlers } from "./queue.js";
import { mapInfo, mapTiles } from "./map-tiles.js";
import { geocodeUnitRoute } from "./geocoding.js";
import { definitionsView } from "./parameter-registry.js";
import { recalculate, qualify } from "./scores.js";
import { linkContactProduct } from "./contact-products.js";
// Não exportar: o workerd trata toda exportação nomeada do módulo principal como entrypoint (falha no wrangler dev).
const VERSION = "0.3.1-review.2";
// internalActor: identidade já resolvida, só para chamadas internas (motor da prospecção e cadastro pela rodada); nunca
// vem de fora. Sem ela, a identidade sai do Cloudflare Access como sempre.
async function route(request, env, rid, internalActor = null) {
  const u = new URL(request.url),
    path = u.pathname,
    method = request.method;
  // Descadastro público: fora da autenticação e da checagem de origem (o provedor de e-mail faz o POST).
  const unsub = path.match(/^\/u\/([^/]+)$/);
  if (unsub) return handleUnsubscribe(request, env, unsub[1]);
  if (!path.startsWith("/api/")) {
    if (!["GET", "HEAD"].includes(method))
      fail(405, "method_not_allowed", "Método não permitido.");
    if (!env.ASSETS) fail(503, "assets_unavailable", "Interface indisponível.");
    return env.ASSETS.fetch(request);
  }
  if (path === "/api/health" && method === "GET")
    return response({ status: "ok", service: "eag-compass", version: VERSION });
  // Ponte de e-mail: identidade própria (token de serviço do Access + assinatura HMAC), só nestas rotas.
  if (path.startsWith("/api/bridge/")) return handleBridge(request, env, path, rid);
  const actor = internalActor ? { id: internalActor.id, tenant_id: internalActor.tenant_id, email: internalActor.email, display_name: internalActor.display_name, role: internalActor.role } : await getActor(request, env);
  // Procedência declarada (canal, executor, autorização): registrada com a operação; nunca prova ação humana.
  actor.provenance = readProvenance(request);
  if (!internalActor) assertSameOrigin(request);
  if (path === "/api/session" && method === "GET")
    return response({
      actor,
      environment: env.ENVIRONMENT,
      version: VERSION,
      // Só na prévia local (tests/preview-server.mjs): commit e início do processo, para conferir a instância servida.
      ...(env.PREVIEW_BUILD ? { preview: env.PREVIEW_BUILD } : {}),
      capabilities: {
        sending: false,
        automatedSearch: false,
        sanctionsImport: false,
      },
    });
  // Mapa de fundo (somente leitura, autenticado): manifesto e leitura por faixa do recorte no R2 privado.
  if (path === "/api/mapa" && method === "GET") return mapInfo(env);
  if (path === "/api/mapa/brasil.pmtiles" && ["GET", "HEAD"].includes(method)) return mapTiles(request, env);
  if (path === "/api/dashboard" && method === "GET") {
    // Registros de teste interno (nome começando por "TESTE") ficam fora das contagens de prospects e são informados à parte.
    const [pipeline, exceptions, prospects, tests] = await env.DB.batch([
      s(
        env,
        "SELECT pipeline_status,COUNT(*) total FROM companies WHERE tenant_id=? GROUP BY pipeline_status",
        actor.tenant_id,
      ),
      s(
        env,
        "SELECT exception_status,COUNT(*) total FROM companies WHERE tenant_id=? AND exception_status IS NOT NULL GROUP BY exception_status",
        actor.tenant_id,
      ),
      s(env, "SELECT pipeline_status,COUNT(*) total FROM companies WHERE tenant_id=? AND upper(legal_name) NOT LIKE 'TESTE%' GROUP BY pipeline_status", actor.tenant_id),
      s(env, "SELECT COUNT(*) total FROM companies WHERE tenant_id=? AND upper(legal_name) LIKE 'TESTE%'", actor.tenant_id),
    ]);
    return response({
      pipeline: Object.fromEntries(
        pipeline.results.map((r) => [r.pipeline_status, r.total]),
      ),
      exceptions: Object.fromEntries(
        exceptions.results.map((r) => [r.exception_status, r.total]),
      ),
      // Contagem de prospects sem os registros de teste interno; o total acima continua igual ao de antes.
      prospectPipeline: Object.fromEntries(prospects.results.map((r) => [r.pipeline_status, r.total])),
      internalTests: { total: tests.results[0]?.total ?? 0, rule: "nome começando por TESTE" },
      generatedAt: new Date().toISOString(),
      sendingEnabled: false,
      // G1: lembrete da revisão anual da retenção A1 (só informa; nada expira).
      retentionReview: await retention.retentionReviewStatus(env, actor.tenant_id),
    });
  }
  // Validação T11 por escopo (só e-mail automático no Brasil nesta rota): registro só do Administrador, com evidências.
  if (path === "/api/compliance/t11") {
    if (method === "GET") return response(await compliance.listValidations(env, actor, u.searchParams.get("scope")));
    if (method === "POST") return response(await compliance.recordValidation(request, env, actor, rid), 201);
  }
  if (path === "/api/retention" && method === "GET") return response(await retention.retentionOverview(env, actor));
  if (path === "/api/retention/reviews" && method === "POST") return response(await retention.addRetentionReview(request, env, actor, rid), 201);
  if (path === "/api/companies/decisors" && method === "GET") return response(await companies.decisorsOf(request, env, actor));
  if (path === "/api/companies") {
    if (method === "GET")
      return response(await companies.listCompanies(request, env, actor));
    if (method === "POST")
      return response(
        await companies.createCompany(request, env, actor, rid),
        201,
      );
  }
  const cm = path.match(
    /^\/api\/companies\/([^/]+)(?:\/(evidence|contacts|contact-verifications|demand|risk-observations|approvals|scores\/recalculate|qualify))?$/,
  );
  if (cm) {
    const [, id, action] = cm;
    if (!action && method === "GET")
      return response(await companies.getCompany(request, env, actor, id));
    const handlers = {
      evidence: companies.addEvidence,
      contacts: companies.addContact,
      "contact-verifications": companies.verifyContact,
      "risk-observations": companies.addRisk,
      approvals: companies.createApproval,
    };
    if (handlers[action] && method === "POST")
      return response(
        await handlers[action](request, env, actor, rid, id),
        201,
      );
    if (action === "demand" && method === "PUT")
      return response(await companies.saveDemand(request, env, actor, rid, id));
    if (
      ["scores/recalculate", "qualify"].includes(action) &&
      method === "POST"
    ) {
      const input = await bodyJson(request);
      return response(
        await (action === "qualify" ? qualify : recalculate)(
          env,
          actor,
          rid,
          id,
          str(input.demandId, "demanda", 80),
        ),
      );
    }
  }
  if (path === "/api/catalog" && method === "POST")
    return response(await catalog.createProduct(request, env, actor, rid), 201);
  const cat = path.match(
    /^\/api\/catalog\/([^/]+)(?:\/(codes|characteristics)(?:\/([^/]+))?)?$/,
  );
  if (path === "/api/catalog" && method === "GET")
    return response(await catalog.catalog(env, actor));
  if (cat) {
    const [, id, sub, subId] = cat;
    if (!sub && method === "GET")
      return response(await catalog.catalog(env, actor, id));
    if (!sub && method === "PATCH")
      return response(await catalog.updateProduct(request, env, actor, rid, id));
    if (sub === "codes" && !subId && method === "POST")
      return response(await catalog.addCode(request, env, actor, rid, id), 201);
    if (sub === "codes" && subId && method === "PATCH")
      return response(
        await catalog.updateCode(request, env, actor, rid, id, subId),
      );
    if (sub === "codes" && subId && method === "DELETE")
      return response(
        await catalog.removeCode(request, env, actor, rid, id, subId),
      );
    if (sub === "characteristics" && !subId && method === "POST")
      return response(
        await catalog.addCharacteristic(request, env, actor, rid, id),
        201,
      );
    if (sub === "characteristics" && subId && method === "PATCH")
      return response(
        await catalog.updateCharacteristic(request, env, actor, rid, id, subId),
      );
  }
  // Prospecção automática: perfil comprador versionado, política de pesquisa de rotina e execução em segundo plano.
  if (path === "/api/prospect/profile" && method === "GET") return response(await prospect.getProfile(env, actor));
  if (path === "/api/prospect/profile" && method === "POST") return response(await prospect.saveProfile(request, env, actor, rid), 201);
  if (path === "/api/prospect/policy/prepare" && method === "POST") return response(await prospect.preparePolicyRoute(request, env, actor));
  if (path === "/api/prospect/policy" && method === "GET") return response(await prospect.getPolicy(env, actor));
  if (path === "/api/prospect/policy" && method === "POST") return response(await prospect.grantPolicy(request, env, actor, rid), 201);
  if (path === "/api/prospect/policy/revoke" && method === "POST") return response(await prospect.revokePolicy(request, env, actor, rid));
  if (path === "/api/prospect/coverage" && method === "GET") return response(await prospect.coverage(request, env, actor));
  if (path === "/api/prospect/destinations" && method === "POST") return response(await prospect.destinationsRoute(request, env, actor, rid, {}));
  if (path === "/api/prospect/characteristic" && method === "POST") return response(await prospect.answerCharacteristic(request, env, actor, rid));
  if (path === "/api/prospect/auto" && method === "POST") return response(await prospect.autoStart(request, env, actor, rid), 201);
  if (path === "/api/prospect/connectors" && method === "GET") return response(await prospect.connectors(request, env, actor));
  if (path === "/api/sources/applicable" && method === "POST") return response(await prospect.applicableRoute(request, env, actor));
  if (path === "/api/prospect/jobs" && method === "GET") return response(await prospect.listJobs(env, actor));
  if (path === "/api/prospect/jobs" && method === "POST") return response(await prospect.createJob(request, env, actor, rid), 201);
  const pjb = path.match(/^\/api\/prospect\/jobs\/([0-9a-f-]{36})(?:\/(pause|resume|cancel|skip-browser|browser-osm|run|act))?$/);
  if (pjb) {
    const [, jid, op] = pjb;
    if (!op && method === "GET") return response(await prospect.getJob(env, actor, jid));
    if (op === "browser-osm" && method === "POST") return response(await prospect.browserOsm(request, env, actor, rid, jid, internalCaller(env, rid)));
    if (op === "act" && method === "POST") return response(await prospect.actOnJob(request, env, actor, rid, jid, internalCaller(env, rid)));
    // Executar agora (diagnóstico): o mesmo ciclo do cron, para quem não quer esperar o próximo minuto.
    if (op === "run" && method === "POST") {
      requireRole(actor, WRITE_ROLES);
      await prospect.runJob(env, jid, { call: internalCaller(env, rid) });
      return response(await prospect.getJob(env, actor, jid));
    }
    if (op && method === "POST") return response(await prospect.controlJob(request, env, actor, rid, jid, op));
  }
  // Rodadas de descoberta e qualificação (fluxo geral, configurado por rodada).
  if (path === "/api/rounds" && method === "GET") return response(await rounds.listRounds(env, actor));
  if (path === "/api/rounds" && method === "POST") return response(await rounds.createRound(request, env, actor, rid), 201);
  if (path === "/api/round-catalog" && method === "GET") return response(rounds.roundCatalog());
  if (path === "/api/geo/regions" && method === "GET") return response(await rounds.geoRegions(request, env));
  if (path === "/api/geo/municipalities" && method === "GET") return response(await rounds.geoMunicipalities(request, env));
  const rnd = path.match(/^\/api\/rounds\/([0-9a-f-]{36})(?:\/(area|osm-query|preflight-ack|candidates|run|decisions|register|export|annotations|existing))?$/);
  if (rnd) {
    const [, rid2, sub] = rnd;
    if (!sub && method === "GET") return response(await rounds.getRound(env, actor, rid2));
    if (!sub && method === "PUT") return response(await rounds.updateRoundConfig(request, env, actor, rid, rid2));
    if (sub === "area" && method === "GET") return response(await rounds.getArea(env, actor, rid2));
    if (sub === "existing" && method === "GET") return response(await rounds.existingForRound(env, actor, rid2));
    if (sub === "osm-query" && method === "GET") return response(await rounds.osmQuery(env, actor, rid2));
    if (sub === "export" && method === "GET") return response(await rounds.exportRound(env, actor, rid2));
    if (sub === "preflight-ack" && method === "POST") return response(await rounds.acknowledgePreflight(request, env, actor, rid, rid2));
    if (sub === "candidates" && method === "POST") return response(await rounds.addCandidates(request, env, actor, rid, rid2), 201);
    if (sub === "run" && method === "POST") return response(await rounds.executeRound(request, env, actor, rid, rid2));
    if (sub === "decisions" && method === "POST") return response(await rounds.decide(request, env, actor, rid, rid2), 201);
    if (sub === "annotations" && method === "POST") return response(await rounds.annotateRound(request, env, actor, rid, rid2), 201);
    if (sub === "register" && method === "POST") {
      // Cadastro pelas rotas existentes, com a identidade e a origem desta requisição (mesmas regras do cadastro manual).
      const dispatch = async (p, m, body) => {
        const headers = new Headers(request.headers);
        headers.set("content-type", "application/json");
        headers.delete("content-length");
        try {
          const res = await route(new Request(new URL(p, request.url), { method: m, headers, body: JSON.stringify(body) }), env, rid, actor);
          return { status: res.status, data: await res.json() };
        } catch (e) {
          if (e instanceof ApiException) return { status: e.status, data: { error: { code: e.code, message: e.message, details: e.details } } };
          throw e;
        }
      };
      return response(await rounds.registerFromRound(request, env, actor, rid, rid2, dispatch));
    }
  }
  if (path === "/api/searches") {
    if (method === "POST")
      return response(await search.startSearch(request, env, actor, rid), 201);
    if (method === "GET") {
      const campaignId = str(u.searchParams.get("campaignId"), "campanha", 80);
      const rows = await s(
        env,
        "SELECT id,version,status,radius_km,candidates_count,api_calls,coverage_note,created_at,finished_at FROM searches WHERE tenant_id=? AND campaign_id=? ORDER BY version DESC",
        actor.tenant_id,
        campaignId,
      ).all();
      return response({ items: rows.results });
    }
  }
  const sr = path.match(/^\/api\/searches\/([^/]+)(?:\/(candidates|resume))?$/);
  if (sr) {
    const [, id, action] = sr;
    if (!action && method === "GET") return response(await search.getSearch(env, actor, id));
    if (action === "candidates" && method === "GET")
      return response(await search.listCandidates(request, env, actor, id));
    if (action === "resume" && method === "POST")
      return response(await search.resumeSearch(request, env, actor, rid, id));
  }
  if (path === "/api/openclaw/imports" && method === "POST") return response(await openclaw.startImport(request, env, actor, rid), 201);
  const oc = path.match(/^\/api\/openclaw\/imports\/([^/]+)(?:\/(suppressions|close-suppressions|contacts))?$/);
  if (oc) {
    const [, id, action] = oc;
    if (!action && method === "GET") return response(await openclaw.report(env, actor, id));
    if (action === "suppressions" && method === "POST") return response(await openclaw.importSuppressions(request, env, actor, rid, id));
    if (action === "close-suppressions" && method === "POST") return response(await openclaw.closeSuppressions(request, env, actor, rid, id));
    if (action === "contacts" && method === "POST") return response(await openclaw.importContacts(request, env, actor, rid, id));
  }
  if (path === "/api/openclaw/transfers" && method === "POST") return response(await openclaw.confirmTransfer(request, env, actor, rid));
  if (path === "/api/country-analyses" && method === "GET") return response(await countryAnalysis.listAnalyses(env, actor));
  if (path === "/api/country-analyses" && method === "POST") return response(await countryAnalysis.createAnalysis(request, env, actor, rid), 201);
  const can = path.match(/^\/api\/country-analyses\/([^/]+)(?:\/(selections))?$/);
  if (can && !can[2] && method === "GET") return response(await countryAnalysis.getAnalysis(env, actor, can[1]));
  if (can && can[2] && method === "POST") return response(await selections.selectCommodities(request, env, actor, rid, can[1]), 201);
  if (can && can[2] && method === "GET") return response(await selections.listSelections(env, actor, can[1]));
  if (path === "/api/integrations" && method === "GET") return response(await integrations.status(env, actor));
  if (path === "/api/integrations/mailbox/reach" && method === "POST") return response(await integrations.reachMailbox(request, env, actor, rid));
  if (path === "/api/integrations/discovery/reach" && method === "POST") return response(await integrations.reachDiscovery(request, env, actor, rid));
  if (path === "/api/integrations/suppression/check" && method === "POST") return response(await integrations.checkSuppression(request, env, actor, rid));
  if (path === "/api/integrations/comtrade/check" && method === "POST") return response(await integrations.checkComtrade(request, env, actor, rid));
  if (path === "/api/integrations/mailbox/check" && method === "POST") return response(await integrations.checkMailbox(request, env, actor, rid));
  if (path === "/api/foreign-companies" && method === "POST") return response(await foreign.createForeignCompany(request, env, actor, rid), 201);
  const fcc = path.match(/^\/api\/companies\/([^/]+)\/conditions\/([^/]+)\/([a-z_]+)$/);
  if (fcc && method === "PUT") return response(await foreign.setCondition(request, env, actor, rid, fcc[1], fcc[2], fcc[3]));
  const fcs = path.match(/^\/api\/companies\/([^/]+)\/size$/);
  if (fcs && method === "PATCH") return response(await foreign.setSize(request, env, actor, rid, fcs[1]));
  const fcb = path.match(/^\/api\/companies\/([^/]+)\/basics$/);
  if (fcb && method === "PATCH") return response(await foreign.setBasics(request, env, actor, rid, fcb[1]));
  // Radar Internacional: busca de empresas por campanha (autorização, fontes, candidatos, resultado).
  const fsa = path.match(/^\/api\/campaigns\/([^/]+)\/foreign-search(es)?$/);
  if (fsa && !fsa[2] && method === "POST") return response(await foreignSearch.authorizeSearch(request, env, actor, rid, fsa[1]), 201);
  if (fsa && fsa[2] && method === "GET") return response(await foreignSearch.listSearches(env, actor, fsa[1]));
  if (path === "/api/foreign-searches" && method === "GET") return response(await foreignSearch.listAllSearches(env, actor));
  // Descoberta por fontes gratuitas e validação assistida (Radar Internacional).
  // Revisão para decisão (só leitura) e investigação/devolução de candidatas (nunca aceita nem envia).
  const frv = path.match(/^\/api\/foreign-searches\/([^/]+)\/review$/);
  if (frv && method === "GET") return response(await decisionReview.getReview(env, actor, frv[1]));
  const frs = path.match(/^\/api\/foreign-searches\/([^/]+)\/discovery\/restore$/);
  if (frs && method === "POST") return response(await decisionReview.restoreCandidates(request, env, actor, rid, frs[1]));
  const fin = path.match(/^\/api\/foreign-searches\/([^/]+)\/discovery\/([0-9a-f-]{36})$/);
  if (fin && method === "PATCH") return response(await decisionReview.investigateCandidate(request, env, actor, rid, fin[1], fin[2]));
  const fsd = path.match(/^\/api\/foreign-searches\/([^/]+)\/(discovery|discover|discovery\/accept|discovery\/dismiss|discovery\/validate|discovery\/contacts)$/);
  if (fsd && fsd[2] === "discovery" && method === "GET") return response(await discovery.getDiscovery(env, actor, fsd[1]));
  if (fsd && fsd[2] === "discover" && method === "POST") return response(await discovery.discover(request, env, actor, rid, fsd[1]), 201);
  if (fsd && fsd[2] === "discovery/accept" && method === "POST") return response(await discovery.accept(request, env, actor, rid, fsd[1]));
  if (fsd && fsd[2] === "discovery/dismiss" && method === "POST") return response(await discovery.dismiss(request, env, actor, rid, fsd[1]));
  if (fsd && fsd[2] === "discovery/validate" && method === "POST") return response(await discovery.validateCandidates(request, env, actor, rid, fsd[1]));
  if (fsd && fsd[2] === "discovery/contacts" && method === "POST") return response(await discovery.researchCandidateContacts(request, env, actor, rid, fsd[1]));
  // Pessoas de compras (dois radares): pesquisa em fontes permitidas, aceite, descarte e registro manual.
  const ppl = path.match(/^\/api\/companies\/([^/]+)\/people(?:\/(research)|\/([^/]+)\/(accept|dismiss))?$/);
  if (ppl && !ppl[2] && !ppl[3] && method === "GET") return response(await people.listPeople(env, actor, ppl[1]));
  if (ppl && !ppl[2] && !ppl[3] && method === "POST") return response(await people.addPerson(request, env, actor, rid, ppl[1]), 201);
  if (ppl && ppl[2] === "research" && method === "POST") return response(await people.researchCompany(request, env, actor, rid, ppl[1]));
  if (ppl && ppl[4] === "accept" && method === "POST") return response(await people.acceptPerson(request, env, actor, rid, ppl[1], ppl[3]), 201);
  if (ppl && ppl[4] === "dismiss" && method === "POST") return response(await people.dismissPerson(request, env, actor, rid, ppl[1], ppl[3]));
  const ppe = path.match(/^\/api\/companies\/([^/]+)\/people\/([^/]+)$/);
  if (ppe && ppe[2] !== "research" && method === "PATCH") return response(await people.setPurchaseEvidence(request, env, actor, rid, ppe[1], ppe[2]));
  // Empresa já cadastrada encontrada de novo (importação de lote, outra commodity): acrescenta a relação com o produto,
  // a unidade e as evidências que faltam, sem duplicar nem substituir; mesmas rotas e regras do cadastro manual.
  const rel = path.match(/^\/api\/companies\/([^/]+)\/relations$/);
  if (rel && method === "POST") {
    requireRole(actor, WRITE_ROLES);
    const i = await bodyJson(request);
    const p = await product(env, actor.tenant_id, str(i.productId, "produto", 80));
    const dispatch = async (pp, m, body) => {
      const headers = new Headers(request.headers);
      headers.set("content-type", "application/json");
      headers.delete("content-length");
      try {
        const res = await route(new Request(new URL(pp, request.url), { method: m, headers, body: JSON.stringify(body) }), env, rid, actor);
        return { status: res.status, data: await res.json() };
      } catch (e) {
        if (e instanceof ApiException) return { status: e.status, data: { error: { code: e.code, message: e.message, details: e.details } } };
        throw e;
      }
    };
    const out = await complementCompany(env, actor.tenant_id, dispatch, { companyId: rel[1], productId: p.id, unit: i.unit ?? null, evidence: Array.isArray(i.evidence) ? i.evidence.slice(0, 50) : [], channels: Array.isArray(i.channels) ? i.channels.slice(0, 10) : [], profile: i.profile ?? null, at: now() });
    if (!out.ok) fail(404, "company_not_found", out.reason);
    await commit(env, [auditStatement(env, actor, rid, "company.relation_complemented", "company", rel[1], { productId: p.id, unit: out.unit, evidence: out.evidence, profile: out.profile })]);
    return response(out);
  }
  const ctp = path.match(/^\/api\/contacts\/([^/]+)\/products$/);
  if (ctp && method === "POST") return response(await linkContactProduct(request, env, actor, rid, ctp[1]), 201);
  const chn = path.match(/^\/api\/companies\/([^/]+)\/channels$/);
  if (chn && method === "POST") return response(await people.addChannel(request, env, actor, rid, chn[1]), 201);
  const fsp = path.match(/^\/api\/foreign-searches\/([^/]+)\/people\/research$/);
  if (fsp && method === "POST") return response(await people.researchSearchBatch(request, env, actor, rid, fsp[1]));
  const cgl = path.match(/^\/api\/companies\/([^/]+)\/gleif$/);
  if (cgl && method === "GET") return response(await discovery.companyGleif(env, actor, cgl[1]));
  // Triagem da empresa nesta busca (empresa/produto): prioridade, descarte com motivo e pontos a verificar.
  const fst = path.match(/^\/api\/foreign-searches\/([^/]+)\/candidates\/([^/]+)(?:\/checks(?:\/([^/]+))?)?$/);
  if (fst && !path.includes("/checks") && method === "PATCH") return response(await foreignSearch.triageCandidate(request, env, actor, rid, fst[1], fst[2]));
  if (fst && path.endsWith("/checks") && method === "POST") return response(await foreignSearch.addCheck(request, env, actor, rid, fst[1], fst[2]), 201);
  if (fst && fst[3] && method === "PATCH") return response(await foreignSearch.resolveCheck(request, env, actor, rid, fst[1], fst[2], fst[3]));
  const fsx = path.match(/^\/api\/foreign-searches\/([^/]+)(?:\/(sources|candidates|close))?$/);
  if (fsx && !fsx[2] && method === "GET") return response(await foreignSearch.getSearch(env, actor, fsx[1]));
  if (fsx && fsx[2] === "sources" && method === "POST") return response(await foreignSearch.recordSource(request, env, actor, rid, fsx[1]), 201);
  if (fsx && fsx[2] === "candidates" && method === "POST") return response(await foreignSearch.addCandidate(request, env, actor, rid, fsx[1]), 201);
  if (fsx && fsx[2] === "close" && method === "POST") return response(await foreignSearch.closeSearch(request, env, actor, rid, fsx[1]));
  if (path === "/api/commercial-validations" && method === "POST") return response(await selections.recordValidation(request, env, actor, rid), 201);
  if (path === "/api/countries" && method === "GET") return response(await tradeList.listCountries(request, env));
  if (path === "/api/radar/importers" && method === "GET") return response(await importers.listImporters(request, env, actor));
  if (path === "/api/radar/importers/summaries/rebuild" && method === "POST") return response(await importers.rebuildSummariesRoute(request, env, actor, rid));
  if (path === "/api/trade-list/versions" && method === "GET") return response(await tradeList.listVersions(env));
  if (path === "/api/trade-list/run" && method === "POST") return response(await tradeList.runNow(request, env, actor, rid), 202);
  const tlr = path.match(/^\/api\/trade-list\/refresh\/([A-Za-z]{3})$/);
  if (tlr && method === "POST") return response(await tradeList.manualRefresh(request, env, actor, rid, tlr[1]), 202);
  const tlv = path.match(/^\/api\/trade-list\/versions\/([A-Za-z0-9-]+)\/resume$/);
  if (tlv && method === "POST") return response(await tradeList.resumeVersion(request, env, actor, rid, tlv[1]));
  if (path === "/api/channels" && method === "GET") return response(await channels.listChannels(env, actor));
  const chs = path.match(/^\/api\/channels\/([a-z]+)\/state$/);
  if (chs && method === "POST") return response(await channels.setChannelState(request, env, actor, rid, chs[1]));
  if (path === "/api/tasks" && method === "GET") return response(await tasks.listTasks(request, env, actor));
  if (path === "/api/tasks/reply-review" && method === "GET") return response(await erasure.replyTasksForReview(env, actor));
  const tli = path.match(/^\/api\/tasks\/([^/]+)\/link-inbound$/);
  if (tli && method === "POST") return response(await erasure.linkTaskToInbound(request, env, actor, rid, tli[1]));
  const te = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (te && te[1] !== "reply-review" && method === "PATCH") return response(await tasks.updateTask(request, env, actor, rid, te[1]));
  const th = path.match(/^\/api\/tasks\/([^/]+)\/history$/);
  if (th && method === "GET") return response(await tasks.taskHistory(env, actor, th[1]));
  const tk = path.match(/^\/api\/tasks\/([^/]+)\/complete$/);
  if (tk && method === "POST") return response(await tasks.completeTask(request, env, actor, rid, tk[1]));
  const l0 = path.match(/^\/api\/companies\/([^/]+)\/level0$/);
  if (l0 && method === "POST") return response(await tasks.createLevel0(request, env, actor, rid, l0[1]), 201);
  if (path === "/api/meetings" && method === "POST") return response(await tasks.recordMeeting(request, env, actor, rid), 201);
  const tl = path.match(/^\/api\/companies\/([^/]+)\/timeline$/);
  if (tl && method === "GET") return response(await tasks.timeline(env, actor, tl[1]));
  if (path === "/api/dashboard/funnel" && method === "GET") return response(await tasks.funnel(env, actor));
  if (path === "/api/sending/today" && method === "GET") return response(await sending.today(env, actor));
  if (path === "/api/inbound" && method === "GET") {
    const { limit, offset } = page(request);
    const rows = await s(
      env,
      "SELECT i.id,i.classification,i.correlation,i.company_id,i.commodity,i.received_at,c.legal_name FROM inbound_messages i LEFT JOIN companies c ON c.id=i.company_id WHERE i.tenant_id=? ORDER BY i.received_at DESC,i.rowid DESC LIMIT ? OFFSET ?",
      actor.tenant_id, limit + 1, offset,
    ).all();
    return response({ items: rows.results.slice(0, limit), nextOffset: rows.results.length > limit ? offset + limit : null });
  }
  const res = path.match(/^\/api\/sending\/outbox\/([^/]+)\/resolve$/);
  if (res && method === "POST") return response(await sending.resolveIndeterminate(request, env, actor, rid, res[1]));
  if (path === "/api/fichas") {
    if (method === "POST") return response(await fichas.createFicha(request, env, actor, rid), 201);
    if (method === "GET") {
      const { limit, offset } = page(request);
      const status = u.searchParams.get("status");
      const rows = await s(
        env,
        `SELECT f.id,f.company_id,f.campaign_id,f.status,f.current_version,f.updated_at,c.legal_name FROM fichas f JOIN companies c ON c.id=f.company_id WHERE f.tenant_id=?${status ? " AND f.status=?" : ""} ORDER BY f.updated_at DESC LIMIT ? OFFSET ?`,
        ...[actor.tenant_id, ...(status ? [status] : []), limit + 1, offset],
      ).all();
      return response({ items: rows.results.slice(0, limit), nextOffset: rows.results.length > limit ? offset + limit : null });
    }
  }
  const fm = path.match(/^\/api\/fichas\/([^/]+)(?:\/(versions|approve|defer|discard))?$/);
  if (fm) {
    const [, id, action] = fm;
    if (!action && method === "GET") return response(await fichas.getFicha(env, actor, id));
    if (action === "versions" && method === "POST") return response(await fichas.newVersion(request, env, actor, rid, id), 201);
    if (action === "approve" && method === "POST") return response(await fichas.approve(request, env, actor, rid, id));
    if (action === "defer" && method === "POST") return response(await fichas.setStatus(request, env, actor, rid, id, "deferred"));
    if (action === "discard" && method === "POST") return response(await fichas.setStatus(request, env, actor, rid, id, "discarded"));
  }
  if (path === "/api/sanctions/sources" && method === "POST")
    return response(await sanctions.addSource(request, env, actor, rid), 201);
  if (path === "/api/sanctions/sources" && method === "GET")
    return response(await sanctions.listSources(env));
  const sa = path.match(/^\/api\/sanctions\/sources\/([^/]+)$/);
  if (sa && method === "PATCH")
    return response(await sanctions.setSourceActive(request, env, actor, rid, sa[1]));
  const sv = path.match(/^\/api\/sanctions\/sources\/([^/]+)\/versions$/);
  if (sv && method === "POST") return response(await sanctions.startVersion(request, env, actor, rid, sv[1]), 201);
  const se = path.match(/^\/api\/sanctions\/versions\/([^/]+)\/(entries|finish)$/);
  if (se && method === "POST")
    return response(await (se[2] === "entries" ? sanctions.addEntries : sanctions.finishVersion)(request, env, actor, rid, se[1]));
  const scr = path.match(/^\/api\/companies\/([^/]+)\/screening$/);
  if (scr) {
    if (method === "POST") return response(await sanctions.screenCompany(request, env, actor, rid, scr[1]), 201);
    if (method === "GET") return response(await sanctions.screeningView(env, actor, scr[1]));
  }
  const smd = path.match(/^\/api\/screening-matches\/([^/]+)\/decisions$/);
  if (smd && method === "POST") return response(await sanctions.decideMatch(request, env, actor, rid, smd[1]), 201);
  const prof = path.match(/^\/api\/companies\/([^/]+)\/profiles$/);
  if (prof) {
    if (method === "GET") return response({ items: await profiles.listProfiles(env, actor, prof[1]) });
    if (method === "POST")
      return response(await profiles.upsertProfile(request, env, actor, rid, prof[1]));
  }
  const profId = path.match(/^\/api\/profiles\/([^/]+)$/);
  if (profId && method === "PATCH")
    return response(await profiles.changeProfile(request, env, actor, rid, profId[1]));
  const val = path.match(/^\/api\/contacts\/([^/]+)\/validate-email$/);
  if (val && method === "POST")
    return response(await emailValidation.validateContact(request, env, actor, rid, val[1]));
  const valCo = path.match(/^\/api\/companies\/([^/]+)\/validate-emails$/);
  if (valCo && method === "POST")
    return response(await emailValidation.validateCompanyContacts(request, env, actor, rid, valCo[1]));
  const disc = path.match(/^\/api\/companies\/([^/]+)\/discard$/);
  if (disc && method === "POST") return response(await changes.discardCompany(request, env, actor, rid, disc[1]));
  if (path === "/api/erasures/reapply" && method === "POST") return response(await erasure.reapplyErasures(request, env, actor, rid));
  const inbPurge = path.match(/^\/api\/inbound\/([^/]+)\/purge-content$/);
  if (inbPurge && method === "POST") return response(await erasure.purgeInboundContent(request, env, actor, rid, inbPurge[1]));
  const erp = path.match(/^\/api\/contacts\/([^/]+)\/erasure-phones$/);
  if (erp && method === "GET") return response(await erasure.erasurePhones(env, actor, erp[1]));
  const dpd = path.match(/^\/api\/contacts\/([^/]+)\/delete-personal-data$/);
  if (dpd && method === "POST") return response(await changes.deletePersonalData(request, env, actor, rid, dpd[1]));
  const contact = path.match(/^\/api\/contacts\/([^/]+)$/);
  if (contact && method === "PATCH")
    return response(await companies.updateContact(request, env, actor, rid, contact[1]));
  const geo = path.match(/^\/api\/units\/([^/]+)\/geocode$/);
  if (geo && method === "POST")
    return response(await geocodeUnitRoute(request, env, actor, rid, geo[1]));
  if (path === "/api/sectors") {
    if (method === "GET") return response(await sectors.listSectors(env, actor));
    if (method === "POST")
      return response(await sectors.addSectorCnae(request, env, actor, rid), 201);
  }
  const sec = path.match(/^\/api\/sectors\/([a-z0-9_]+)\/(\d{7})$/);
  if (sec && method === "DELETE")
    return response(
      await sectors.removeSectorCnae(request, env, actor, rid, sec[1], sec[2]),
    );
  if (path === "/api/parameters" && method === "GET") {
    const current = await parameters(env, actor.tenant_id);
    return response({ parameters: current, definitions: definitionsView(current) });
  }
  const pm = path.match(/^\/api\/parameters\/([a-z_]+)$/);
  if (pm && method === "PUT")
    return response(
      await operations.setParameter(request, env, actor, rid, pm[1]),
    );
  if (path === "/api/campaigns") {
    if (method === "GET")
      return response(
        await operations.listRecords(request, env, actor, "campaigns"),
      );
    if (method === "POST")
      return response(
        await operations.createCampaign(request, env, actor, rid),
        201,
      );
  }
  const camp = path.match(
    /^\/api\/campaigns\/([^/]+)(?:\/(activate|declarations|icp)(?:\/([^/]+)\/(revoke))?)?$/,
  );
  if (camp) {
    const [, id, action, declId, sub] = camp;
    if (action === "declarations" && declId && sub === "revoke" && method === "POST")
      return response(
        await operations.revokeDeclaration(request, env, actor, rid, id, declId),
      );
    if (declId) fail(404, "route_not_found", "Rota não encontrada.");
    if (action === "declarations" && method === "GET")
      return response(await operations.listDeclarations(env, actor, id));
    if (action === "icp" && method === "PUT")
      return response(await operations.updateIcp(request, env, actor, rid, id));
    if (!action && method === "GET")
      return response(await operations.getCampaign(env, actor, id));
    if (!action && method === "PATCH")
      return response(
        await operations.changeCampaign(request, env, actor, rid, id),
      );
    if (action === "activate" && method === "POST")
      return response(
        await operations.changeCampaign(request, env, actor, rid, id, true),
      );
    if (action === "declarations" && method === "POST")
      return response(
        await operations.addDeclaration(request, env, actor, rid, id),
        201,
      );
  }
  if (path === "/api/suppression") {
    if (method === "GET")
      return response(await operations.listSuppression(request, env, actor));
    if (method === "POST")
      return response(await operations.suppress(request, env, actor, rid));
  }
  // Remoção administrativa de supressão (R9.2) e histórico das remoções (SUPRESSAO-RETENCAO, 2026-10-01).
  if (path === "/api/suppression/removals" && method === "GET") return response(await operations.listSuppressionRemovals(request, env, actor));
  const supRemove = path.match(/^\/api\/suppression\/([^/]+)\/remove$/);
  if (supRemove && method === "POST") return response(await operations.removeSuppression(request, env, actor, rid, supRemove[1]));
  if (path === "/api/pauses") {
    if (method === "GET")
      return response(
        await operations.listRecords(request, env, actor, "pauses"),
      );
    if (method === "POST")
      return response(
        await operations.createPause(request, env, actor, rid),
        201,
      );
  }
  const pause = path.match(/^\/api\/pauses\/([^/]+)\/resume$/);
  if (pause && method === "POST")
    return response(
      await operations.resumePause(request, env, actor, rid, pause[1]),
    );
  if (path === "/api/audit" && method === "GET") {
    const { limit, offset } = page(request),
      entity = u.searchParams.get("entityId"),
      args = [actor.tenant_id],
      where = ["tenant_id=?"];
    if (entity) {
      where.push("entity_id=?");
      args.push(str(entity, "entidade", 80));
    }
    const rows = await s(
      env,
      `SELECT * FROM audit_log WHERE ${where.join(" AND ")} ORDER BY occurred_at DESC,rowid DESC LIMIT ? OFFSET ?`,
      ...args,
      limit + 1,
      offset,
    ).all();
    return response({
      events: rows.results.slice(0, limit),
      nextOffset: rows.results.length > limit ? offset + limit : null,
    });
  }
  fail(404, "route_not_found", "Rota não encontrada.");
}
export default {
  async fetch(request, env) {
    const rid = crypto.randomUUID();
    let result;
    try {
      result = await route(request, env, rid);
    } catch (error) {
      if (error instanceof ApiException)
        result = response(
          {
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
            requestId: rid,
          },
          error.status,
        );
      else {
        console.error("request_failed", { requestId: rid, name: error?.name ?? null, message: String(error?.message ?? "").slice(0, 200) });
        result = response(
          {
            error: {
              code: "internal_error",
              message:
                "Erro interno. Informe o código da requisição ao suporte.",
            },
            requestId: rid,
          },
          500,
        );
      }
    }
    const headers = new Headers(result.headers);
    // Cabeçalhos de segurança padrão; uma resposta com política própria mais restrita (ex.: /u/*) a mantém.
    for (const [key, value] of Object.entries(securityHeaders))
      if (!headers.has(key)) headers.set(key, value);
    headers.set("x-request-id", rid);
    if (new URL(request.url).protocol === "https:")
      headers.set("strict-transport-security", "max-age=31536000");
    return new Response(result.body, { status: result.status, headers });
  },
  async queue(batch, env) {
    await handleQueue(batch, env, { handlers: { ...queueHandlers, prospect_job: (e, body) => prospect.runJob(e, body.jobId, { call: internalCaller(e, crypto.randomUUID()) }) } });
  },
  // Cron só é configurado quando os adaptadores forem liberados (portão humano em scripts/validate-deploy.mjs).
  async scheduled(controller, env) {
    const tenant = env.DEFAULT_TENANT_ID;
    if (controller.cron === "*/5 * * * *") {
      // Prospecções devidas (espera por limite de fonte vencida ou mensagem da fila perdida): retoma sem duplicar.
      await prospect.tick(env, tenant, { call: internalCaller(env, crypto.randomUUID()) }).catch((e) => console.error("prospect_tick_failed", { message: String(e?.message ?? "").slice(0, 120) }));
      // Respostas primeiro: uma resposta recém-chegada pausa antes do próximo envio.
      // Com a ponte (SEND_TRANSPORT=bridge), leitura e envio acontecem pelas rotas /api/bridge/*; o cron não fala com a caixa.
      if (env.SEND_TRANSPORT !== "bridge") {
        await inbound.poll(env, tenant).catch((e) => console.error("inbound_poll_failed", { kind: e?.kind ?? null }));
        await sending.tick(env, tenant);
      }
    }
    else if (controller.cron === "17 2 * * *") {
      await sending.evaluateRamp(env, tenant);
      // Lista mensal: começa no dia configurado, retoma a versão em andamento e varre jobs devidos (P3-T5).
      await tradeList.daily(env, tenant).catch((e) => console.error("trade_list_daily_failed", { code: e?.code ?? e?.details?.code ?? null }));
    }
    else console.error("scheduled_unknown_cron", { cron: controller.cron });
  },
};

// Chamada interna às rotas do Compass com uma identidade já resolvida (motor da prospecção). Mesmas validações, bloqueios
// e auditoria do uso pelo painel; o canal declarado vem nos cabeçalhos (automation).
export function internalCaller(env, rid) {
  return async (actor, path, method = "GET", body, headers = {}) => {
    const req = new Request(new URL(path, "https://compass.internal"), {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
    });
    try {
      const res = await route(req, env, rid, actor);
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 200) }; }
      return { status: res.status, data };
    } catch (e) {
      if (e instanceof ApiException) return { status: e.status, data: { error: { code: e.code, message: e.message, details: e.details } } };
      throw e;
    }
  };
}
