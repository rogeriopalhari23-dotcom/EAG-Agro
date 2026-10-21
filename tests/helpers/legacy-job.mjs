// Pesquisa internacional "antiga": criada como antes da regra de destinos com evidência (2026-10-21), para exercitar os
// caminhos do motor que continuam valendo para pesquisas existentes (espera de indicadores, classificação na análise,
// evidência ausente). O servidor recusa criar uma combinação dessas pela rota; só o teste a cria assim.
import { createJob } from "../../src/prospect/engine.js";

export async function legacyJob(env, body) {
  const actor = await env.DB.prepare("SELECT id,tenant_id,email,display_name,role FROM users WHERE email='admin@local.eag'").first();
  const request = new Request("http://localhost/api/prospect/jobs", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify(body) });
  return createJob(request, env, actor, "rid-legado", { allowUnverifiedDestination: true });
}
