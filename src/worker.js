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
  const cat = path.match(/^\/api\/catalog(?:\/([^/]+))?$/);
  if (cat && method === "GET")
    return response(await operations.catalog(env, actor, cat[1]));
  if (path === "/api/parameters" && method === "GET")
    return response({ parameters: await parameters(env, actor.tenant_id) });
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
    /^\/api\/campaigns\/([^/]+)(?:\/(activate|declarations))?$/,
  );
  if (camp) {
    const [, id, action] = camp;
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
  async queue(batch) {
    for (const message of batch.messages) message.retry();
  },
  async scheduled() {
    throw new Error(
      "Scheduled adapter unavailable; no cron must be configured.",
    );
  },
};
