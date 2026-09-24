import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";

// Matriz de permissões dos quatro perfis (Constituição/Spec: admin, gerente comercial, vendedor/analista, leitor).
// Usuários criados só no banco de teste; em produção só existe o admin de Rogério até ele informar os outros e-mails.
const ROLES = { admin: "system-admin", commercial_manager: "u-gerente", seller_analyst: "u-vendedor", auditor_viewer: "u-leitor" };
const ALLOWED = {
  read: ["admin", "commercial_manager", "seller_analyst", "auditor_viewer"],
  write: ["admin", "commercial_manager", "seller_analyst"],
  approve: ["admin", "commercial_manager"],
  admin: ["admin"],
};

async function world() {
  const ctx = setup();
  ctx.DB.raw.exec(`
    INSERT INTO users(id,tenant_id,email,display_name,role) VALUES
      ('u-gerente','eag-internal','gerente@teste.invalid','Gerente (teste)','commercial_manager'),
      ('u-vendedor','eag-internal','vendedor@teste.invalid','Vendedor (teste)','seller_analyst'),
      ('u-leitor','eag-internal','leitor@teste.invalid','Leitor (teste)','auditor_viewer');
  `);
  const emails = { admin: "admin@local.eag", commercial_manager: "gerente@teste.invalid", seller_analyst: "vendedor@teste.invalid", auditor_viewer: "leitor@teste.invalid" };
  const as = (role) => {
    ctx.env.LOCAL_USER_EMAIL = emails[role];
    return ctx.api;
  };
  return { ctx, as };
}

// Cada ação: [nível, descrição, (api) => resposta]. Status 401/403 = negado pelo perfil; qualquer outro = passou da checagem de perfil.
const ACTIONS = [
  ["read", "listar empresas", (api) => api("/api/companies")],
  ["read", "ver parâmetros", (api) => api("/api/parameters")],
  ["read", "ver fila de envios", (api) => api("/api/sending/today")],
  ["write", "cadastrar empresa", (api) => api("/api/companies", "POST", { legalName: `Empresa ${Math.random()}`, countryCode: "BR", sourceLabel: "teste" })],
  ["approve", "decidir exceção de trader (aprovador)", (api) => api("/api/sanctions/sources/source-ofac-sdn/versions", "POST", {})],
  ["admin", "alterar parâmetro", (api) => api("/api/parameters/campaign_review_days", "PUT", { scope: "global", value: 90, reason: "teste de perfil" })],
  ["admin", "mudar estado do canal de e-mail", (api) => api("/api/channels/email/state", "POST", { state: "internal_test" })],
  ["admin", "rodar a lista mensal", (api) => api("/api/trade-list/run", "POST", { reason: "teste de perfil do Compass" })],
  ["admin", "resolver envio indeterminado", (api) => api("/api/sending/outbox/inexistente/resolve", "POST", { outcome: "cancel", reason: "teste de perfil do Compass" })],
];

test("Perfis: matriz de leitura, escrita e ações administrativas", async () => {
  const { ctx, as } = await world();
  try {
    const results = [];
    for (const [level, label, call] of ACTIONS) {
      // A importação de sanções é só do admin; o nível "approve" acima usa uma rota de admin para conferir que gerente também é barrado.
      const allowed = label.startsWith("decidir") ? ALLOWED.admin : ALLOWED[level];
      for (const role of Object.keys(ROLES)) {
        const r = await call(as(role));
        const denied = r.status === 401 || r.status === 403;
        results.push(`${label} / ${role}: ${denied ? "negado" : "permitido"}`);
        assert.equal(!denied, allowed.includes(role), `${label} para ${role} (status ${r.status})`);
      }
    }
    assert.equal(results.length, ACTIONS.length * 4);
  } finally {
    ctx.close();
  }
});

test("Perfis: aprovar e ativar é de admin e gerente; vendedor e leitor não", async () => {
  const { ctx, as } = await world();
  try {
    for (const [key, value] of [["radius_allowed_km", [5]], ["radius_default_km", 5]])
      await as("admin")(`/api/parameters/${key}`, "PUT", { scope: "national", value, reason: "teste" });
    const icp = { userSectors: ["balas"], sizeTarget: "medium", region: "SP", decisionRole: "Compras", influencerRole: "Qualidade" };
    for (const [role, expected] of [["seller_analyst", 403], ["auditor_viewer", 403], ["commercial_manager", 200]]) {
      const c = await as("admin")("/api/campaigns", "POST", { productId: "product-06", market: "national", name: `Açúcar ${role}`, originCity: "Sertãozinho", originUf: "SP", icp });
      const r = await as(role)(`/api/campaigns/${c.data.id}/activate`, "POST", { expectedVersion: 1 });
      assert.equal(r.status, expected, role);
    }
  } finally {
    ctx.close();
  }
});

test("Perfis: usuário inativo e e-mail desconhecido não entram", async () => {
  const { ctx, as } = await world();
  try {
    ctx.DB.raw.exec("UPDATE users SET status='inactive' WHERE id='u-vendedor'");
    assert.equal((await as("seller_analyst")("/api/session")).status, 403);
    ctx.env.LOCAL_USER_EMAIL = "ninguem@teste.invalid";
    assert.equal((await ctx.api("/api/session")).status, 403);
  } finally {
    ctx.close();
  }
});
