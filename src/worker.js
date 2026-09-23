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
import { handleQueue } from "./queue.js";
import { geocodeUnitRoute } from "./geocoding.js";
import { definitionsView } from "./parameter-registry.js";
import { recalculate, qualify } from "./scores.js";
export const VERSION = "0.3.1-review.2";
async function route(request, env, rid) {
  const u = new URL(request.url),
    path = u.pathname,
    method = request.method;
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
    for (const [key, value] of Object.entries(securityHeaders))
      headers.set(key, value);
    headers.set("x-request-id", rid);
    if (new URL(request.url).protocol === "https:")
      headers.set("strict-transport-security", "max-age=31536000");
    return new Response(result.body, { status: result.status, headers });
  },
  async queue(batch, env) {
    await handleQueue(batch, env);
  },
  async scheduled() {
    throw new Error(
      "Scheduled adapter unavailable; no cron must be configured.",
    );
  },
};
