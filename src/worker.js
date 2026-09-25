import {
  ApiException,
  response,
  fail,
  bodyJson,
  assertSameOrigin,
  str,
  securityHeaders,
  page,
} from "./http.js";
import { getActor } from "./auth.js";
import { statement as s, parameters } from "./store.js";
import * as companies from "./companies.js";
import * as operations from "./operations.js";
import * as catalog from "./catalog.js";
import * as sectors from "./sectors.js";
import * as search from "./search.js";
import * as profiles from "./profiles.js";
import * as emailValidation from "./email-validation.js";
import * as fichas from "./fichas.js";
import { handleUnsubscribe } from "./unsubscribe.js";
import * as sanctions from "./sanctions.js";
import * as changes from "./changes.js";
import * as sending from "./sending.js";
import * as inbound from "./inbound.js";
import * as tasks from "./tasks.js";
import * as openclaw from "./openclaw.js";
import * as channels from "./channels.js";
import * as tradeList from "./trade-list.js";
import * as countryAnalysis from "./country-analysis.js";
import * as selections from "./selections.js";
import * as foreign from "./foreign-companies.js";
import * as integrations from "./integrations.js";
import { handleQueue } from "./queue.js";
import { geocodeUnitRoute } from "./geocoding.js";
import { definitionsView } from "./parameter-registry.js";
import { recalculate, qualify } from "./scores.js";
export const VERSION = "0.3.1-review.2";
async function route(request, env, rid) {
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
  const actor = await getActor(request, env);
  assertSameOrigin(request);
  if (path === "/api/session" && method === "GET")
    return response({
      actor,
      environment: env.ENVIRONMENT,
      version: VERSION,
      capabilities: {
        sending: false,
        automatedSearch: false,
        sanctionsImport: false,
      },
    });
  if (path === "/api/dashboard" && method === "GET") {
    const [pipeline, exceptions] = await env.DB.batch([
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
    ]);
    return response({
      pipeline: Object.fromEntries(
        pipeline.results.map((r) => [r.pipeline_status, r.total]),
      ),
      exceptions: Object.fromEntries(
        exceptions.results.map((r) => [r.exception_status, r.total]),
      ),
      generatedAt: new Date().toISOString(),
      sendingEnabled: false,
    });
  }
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
  if (path === "/api/integrations/mailbox/check" && method === "POST") return response(await integrations.checkMailbox(request, env, actor, rid));
  if (path === "/api/foreign-companies" && method === "POST") return response(await foreign.createForeignCompany(request, env, actor, rid), 201);
  const fcc = path.match(/^\/api\/companies\/([^/]+)\/conditions\/([^/]+)\/([a-z_]+)$/);
  if (fcc && method === "PUT") return response(await foreign.setCondition(request, env, actor, rid, fcc[1], fcc[2], fcc[3]));
  const fcs = path.match(/^\/api\/companies\/([^/]+)\/size$/);
  if (fcs && method === "PATCH") return response(await foreign.setSize(request, env, actor, rid, fcs[1]));
  if (path === "/api/commercial-validations" && method === "POST") return response(await selections.recordValidation(request, env, actor, rid), 201);
  if (path === "/api/countries" && method === "GET") return response(await tradeList.listCountries(request, env));
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
        console.error("request_failed", { requestId: rid });
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
    await handleQueue(batch, env);
  },
  // Cron só é configurado quando os adaptadores forem liberados (portão humano em scripts/validate-deploy.mjs).
  async scheduled(controller, env) {
    const tenant = env.DEFAULT_TENANT_ID;
    if (controller.cron === "*/5 * * * *") {
      // Respostas primeiro: uma resposta recém-chegada pausa antes do próximo envio.
      await inbound.poll(env, tenant).catch((e) => console.error("inbound_poll_failed", { kind: e?.kind ?? null }));
      await sending.tick(env, tenant);
    }
    else if (controller.cron === "17 2 * * *") {
      await sending.evaluateRamp(env, tenant);
      // Lista mensal: começa no dia configurado, retoma a versão em andamento e varre jobs devidos (P3-T5).
      await tradeList.daily(env, tenant).catch((e) => console.error("trade_list_daily_failed", { code: e?.code ?? e?.details?.code ?? null }));
    }
    else console.error("scheduled_unknown_cron", { cron: controller.cron });
  },
};
