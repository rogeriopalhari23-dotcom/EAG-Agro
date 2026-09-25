// Cenário do piloto nacional pronto para envio: parâmetros, listas de sanções, campanha ativa, empresa no ICP,
// decisor com e-mail validado, ficha aprovada para começar em DAY. Usado pelos testes de envio e de respostas.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const DAY = "2099-01-05"; // segunda-feira
export const at = (h, m = 0, day = DAY) =>
  new Date(`${day}T${String(h + 3).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`).toISOString(); // hora de São Paulo
export function transport(result = { kind: "accepted" }) {
  const sent = [];
  return { sent, send: async (m) => (sent.push(m), typeof result === "function" ? result(m) : result) };
}

export async function pilot(ctx, { email = "compras@valeverde.com.br", internal = true, validated = true, cnpj = "11222333000181", legalName = "Doces Vale Verde Ltda.", productId = "product-06", reuseCampaign } = {}) {
  const { api, env, DB } = ctx;
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP",
    PUBLIC_BASE_URL: "https://compass.exemplo",
    UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
    MAILBOX_USER: "rogeriopalhari@eagagro.com",
    INTERNAL_TEST_RECIPIENTS: [env.INTERNAL_TEST_RECIPIENTS, internal ? email : "outro@eagagro.com"].filter(Boolean).join(","),
  });
  let campaignId = reuseCampaign;
  if (!campaignId) {
    const put = (key, scope, value) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Parâmetro do teste" });
    await put("send_timezone", "national", "America/Sao_Paulo");
    await put("send_window", "national", { start: "09:00", end: "17:00", weekdays: [1, 2, 3, 4, 5] });
    await put("sanctions_max_age_hours", "global", 24);
    DB.raw.exec("UPDATE channels SET state='internal_test' WHERE channel='email'");
    for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
      const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt: new Date().toISOString() });
      await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Sem Relação Nenhuma" }] });
      await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
    }
    const camp = await api("/api/campaigns", "POST", {
      productId, market: "national", name: `Campanha ${productId}`, originCity: "Sertãozinho", originUf: "SP",
      icp: { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" },
    });
    await api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
    campaignId = camp.data.id;
  }
  const co = await api("/api/companies", "POST", { legalName, countryCode: "BR", registrationId: cnpj, registrationIdType: "CNPJ", sourceLabel: "teste" });
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES (?,'eag-internal',?,?,'05','t','2026-09-23')").run(`u-${cnpj}`, co.data.id, cnpj);
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId, profileClass: "possible_final_consumer", basis: "CNAE" });
  await api(`/api/companies/${co.data.id}/screening`, "POST", {});
  const dm = (await api(`/api/companies/${co.data.id}/contacts`, "POST", { fullName: "Maria Souza", email, prospectRole: "decision_maker", sourceLabel: "site", timezone: "America/Sao_Paulo" })).data.id;
  if (validated) DB.raw.prepare("UPDATE contacts SET email_validation='valid' WHERE id=?").run(dm);
  const { id } = (await api("/api/fichas", "POST", { companyId: co.data.id, campaignId, recipients: [dm] })).data;
  const f = (await api(`/api/fichas/${id}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  const ok = await api(`/api/fichas/${id}/approve`, "POST", { versionNo: 1, contactId: dm, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  return { fichaId: id, companyId: co.data.id, campaignId, dm, f };
}
