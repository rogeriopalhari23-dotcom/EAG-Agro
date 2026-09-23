const TEST_TODAY = new Date().toISOString().slice(0, 10);
const TEST_PREVIOUS_DAY = new Date(Date.now()-86400000).toISOString().slice(0, 10);
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { setup, create, demand, field } from "./helpers/db.mjs";
import { isSuppressed } from "../src/operations.js";
function check(name, fn) {
  test(name, async (t) => {
    const ctx = setup();
    t.after(ctx.close);
    await fn(ctx);
  });
}
check("Headers forjados não autenticam produção", async ({ env }) => {
  env.ENVIRONMENT = "production";
  env.ACCESS_TEAM_DOMAIN = "https://example.cloudflareaccess.com";
  env.ACCESS_AUD = "example-audience";
  const r = await worker.fetch(
    new Request("https://eag.example/api/session", {
      headers: {
        "cf-access-authenticated-user-email": "admin@local.eag",
        "oai-authenticated-user-id": "admin",
        "x-eag-role": "admin",
      },
    }),
    env,
  );
  assert.equal(r.status, 401);
});
check("Modo local não funciona em endereço público", async ({ env }) => {
  const r = await worker.fetch(
    new Request("https://example.com/api/session"),
    env,
  );
  assert.equal(r.status, 503);
});
check("Identidade local fixa ignora cabeçalho de função", async ({ api }) => {
  const r = await api("/api/session", "GET", undefined, {
    "x-eag-role": "seller_analyst",
    "x-eag-user": "attacker@example.com",
  });
  assert.equal(r.data.actor.id, "system-admin");
});
check("CSRF: origem estrangeira bloqueada", async ({ api }) =>
  assert.equal(
    (
      await api(
        "/api/companies",
        "POST",
        {},
        { origin: "https://attacker.example" },
      )
    ).status,
    403,
  ),
);
check(
  "JSON primitivo e campos com tipo errado produzem 422",
  async ({ api }) => {
    assert.equal((await api("/api/companies", "POST", null)).status, 422);
    assert.equal(
      (
        await api("/api/companies", "POST", {
          legalName: 3,
          countryCode: "BR",
          sourceLabel: "x",
        })
      ).status,
      422,
    );
  },
);
check("Corpo maior que 64 KB bloqueado", async ({ api }) =>
  assert.equal(
    (await api("/api/companies", "POST", { legalName: "x".repeat(70000) }))
      .status,
    413,
  ),
);
check(
  "Catálogo contém 28 produtos, CSO pendente e nenhum NCM inventado",
  async ({ api, DB }) => {
    const r = await api("/api/catalog");
    assert.equal(r.data.products.length, 28);
    assert.equal(r.data.products.at(-1).identity_status, "pending");
    assert.equal(
      DB.raw.prepare("SELECT COUNT(*) n FROM product_codes").get().n,
      0,
    );
  },
);
check(
  "Cadastro gera auditoria sem copiar razão social",
  async ({ api, DB }) => {
    const id = await create(api);
    assert.ok(id);
    const row = DB.raw
      .prepare("SELECT * FROM audit_log WHERE action='company.created'")
      .get();
    assert.equal(row.entity_id, id);
    assert.equal(row.new_value_json, "{}");
  },
);
check("Paginação expõe total e próxima página", async ({ api }) => {
  await create(api);
  await api("/api/companies", "POST", {
    legalName: "Empresa B",
    countryCode: "BR",
    sourceLabel: "Fonte",
  });
  const r = await api("/api/companies?limit=1");
  assert.equal(r.data.total, 2);
  assert.equal(r.data.companies.length, 1);
  assert.equal(r.data.nextOffset, 1);
  assert.equal((await api("/api/companies?limit=-1")).status, 422);
});
check("Um campo confirmado não produz completude 100%", async ({ api }) => {
  const id = await create(api);
  const r = await api(
    `/api/companies/${id}/demand`,
    "PUT",
    demand([field("product", "Milho")]),
  );
  assert.equal(r.status, 200);
  assert.equal(r.data.completeness.score, 6.67);
  assert.equal(r.data.completeness.applicableRequired, 15);
});
check(
  "Edição mantém ID, preserva campos e aumenta versão",
  async ({ api, DB }) => {
    const cid = await create(api),
      path = `/api/companies/${cid}/demand`;
    const first = await api(path, "PUT", demand([field("product", "Milho")]));
    const next = await api(path, "PUT", {
      ...demand([field("packaging", "Granel")]),
      id: first.data.id,
      expectedVersion: 1,
    });
    assert.equal(next.status, 200);
    assert.equal(next.data.id, first.data.id);
    assert.equal(next.data.version, 2);
    assert.equal(next.data.completeness.confirmed, 2);
    assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM demands").get().n, 1);
  },
);
check(
  "Edição concorrente da demanda não sobrescreve dados",
  async ({ api }) => {
    const cid = await create(api),
      path = `/api/companies/${cid}/demand`;
    const first = await api(path, "PUT", demand());
    const body = {
      ...demand([field("packaging", "Granel")]),
      id: first.data.id,
      expectedVersion: 1,
    };
    assert.equal((await api(path, "PUT", body)).status, 200);
    assert.equal((await api(path, "PUT", body)).status, 409);
  },
);
check(
  "Confirmação vazia, sem fonte ou numérico string é rejeitada",
  async ({ api }) => {
    const cid = await create(api),
      path = `/api/companies/${cid}/demand`;
    for (const f of [
      field("product", ""),
      { key: "product", status: "confirmed", value: "Milho" },
      field("volume_per_operation", "200"),
      field("operations_per_year", "12"),
      { key: "product", status: "not_applicable", reason: "Teste" },
    ])
      assert.equal((await api(path, "PUT", demand([f]))).status, 422);
  },
);
check("Produto pendente não é ativado em demanda", async ({ api }) => {
  const cid = await create(api);
  assert.equal(
    (
      await api(`/api/companies/${cid}/demand`, "PUT", {
        ...demand(),
        productId: "product-28",
      })
    ).status,
    422,
  );
});
check(
  "Mesma commodity pode ter demandas em mercados diferentes",
  async ({ api, DB }) => {
    const cid = await create(api),
      path = `/api/companies/${cid}/demand`;
    assert.equal((await api(path, "PUT", demand())).status, 200);
    assert.equal(
      (await api(path, "PUT", { ...demand(), market: "international" })).status,
      200,
    );
    assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM demands").get().n, 2);
  },
);
check("Valor não confirmado não entra nos scores", async ({ api }) => {
  const cid = await create(api);
  const d = await api(
    `/api/companies/${cid}/demand`,
    "PUT",
    demand([
      { key: "operations_per_year", value: 12, status: "not_confirmed" },
    ]),
  );
  const r = await api(`/api/companies/${cid}/scores/recalculate`, "POST", {
    demandId: d.data.id,
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.potential.scoreMin, 0);
  assert.equal(r.data.potential.coverage, 0);
  assert.ok(r.data.gate.pending.includes("sanctions"));
});
check(
  "Exceção abaixo do mínimo não é inferida sem mínimo nacional",
  async ({ api }) => {
    const cid = await create(api);
    const d = await api(
      `/api/companies/${cid}/demand`,
      "PUT",
      demand([field("volume_per_operation", { amount: 1, unit: "MT" })]),
    );
    const r = await api(`/api/companies/${cid}/scores/recalculate`, "POST", {
      demandId: d.data.id,
    });
    assert.equal(r.data.potential.belowMinimum, null);
  },
);
check("Gate não qualifica sem triagem de sanções", async ({ api }) => {
  const cid = await create(api);
  const d = await api(`/api/companies/${cid}/demand`, "PUT", demand());
  const r = await api(`/api/companies/${cid}/qualify`, "POST", {
    demandId: d.data.id,
  });
  assert.equal(r.status, 409);
  assert.ok(r.data.error.details.pending.includes("sanctions"));
});
check(
  "Risco de empresa inexistente e severidade string são recusados",
  async ({ api }) => {
    const payload = {
      component: "credit",
      severity: 0,
      sourceReference: "Teste",
      observedAt: TEST_PREVIOUS_DAY,
    };
    assert.equal(
      (
        await api(
          "/api/companies/inexistente/risk-observations",
          "POST",
          payload,
        )
      ).status,
      404,
    );
    const cid = await create(api);
    assert.equal(
      (
        await api(`/api/companies/${cid}/risk-observations`, "POST", {
          ...payload,
          severity: "0",
        })
      ).status,
      422,
    );
  },
);
check(
  "Isolamento: não escreve empresa de outro tenant",
  async ({ api, DB }) => {
    DB.raw.exec(
      "INSERT INTO tenants(id,name) VALUES ('other','Outro'); INSERT INTO companies(id,tenant_id,legal_name,country_code,source_label,created_by) VALUES ('foreign','other','Foreign','BR','Test','test')",
    );
    assert.equal(
      (
        await api("/api/companies/foreign/risk-observations", "POST", {
          component: "credit",
          severity: 0,
          sourceReference: "Teste",
          observedAt: TEST_PREVIOUS_DAY,
        })
      ).status,
      404,
    );
    assert.throws(
      () =>
        DB.raw.exec(
          "INSERT INTO risk_observations(id,tenant_id,company_id,component,severity,source_reference,observed_at,recorded_by) VALUES ('bad','eag-internal','foreign','credit',0,'x','2026-09-22','x')",
        ),
      /tenant_reference_mismatch/,
    );
  },
);
check(
  "Contatos cifrados no banco e legíveis só com chave correta",
  async ({ api, DB, env }) => {
    const cid = await create(api);
    assert.equal(
      (
        await api(`/api/companies/${cid}/contacts`, "POST", {
          fullName: "Pessoa Teste",
          email: "pessoa@example.test",
          sourceLabel: "Teste",
        })
      ).status,
      201,
    );
    assert.ok(
      !JSON.stringify(DB.raw.prepare("SELECT * FROM contacts").get()).includes(
        "pessoa@example.test",
      ),
    );
    const detail = await api(`/api/companies/${cid}`);
    assert.equal(detail.data.contacts[0].email, "pessoa@example.test");
    env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    assert.equal((await api(`/api/companies/${cid}`)).status, 503);
  },
);
check(
  "Falha de auditoria reverte a operação junto com os dados",
  async ({ api, DB }) => {
    DB.raw.exec(
      "CREATE TRIGGER test_audit_failure BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'forced'); END",
    );
    assert.equal(
      (
        await api("/api/companies", "POST", {
          legalName: "Falha",
          countryCode: "BR",
          sourceLabel: "Teste",
        })
      ).status,
      500,
    );
    assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM companies").get().n, 0);
  },
);
check("Auditoria é append-only", async ({ api, DB }) => {
  await create(api);
  assert.throws(() => DB.raw.exec("DELETE FROM audit_log"), /append-only/);
});
check(
  "Vendedor não altera parâmetros nem aprova exceção",
  async ({ api, env, DB }) => {
    DB.raw.exec(
      "INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('seller','eag-internal','seller@example.test','Vendedor','seller_analyst')",
    );
    env.LOCAL_USER_EMAIL = "seller@example.test";
    assert.equal(
      (
        await api("/api/parameters/confidence_min", "PUT", {
          scope: "global",
          value: 50,
          reason: "Revisão",
        })
      ).status,
      403,
    );
    const cid = await create(api);
    assert.equal(
      (await api(`/api/companies/${cid}/approvals`, "POST", {})).status,
      403,
    );
  },
);
check(
  "Admin altera parâmetros com vigência e histórico",
  async ({ api, DB }) => {
    assert.equal(
      (
        await api("/api/parameters/volume_min", "PUT", {
          scope: "corn:national",
          value: 100,
          reason: "Mínimo de teste aprovado",
        })
      ).status,
      200,
    );
    const r = await api("/api/parameters");
    assert.equal(r.data.parameters["volume_min:corn:national"], 100);
    assert.equal(r.data.parameters["volume_min:sugar"], undefined);
    assert.equal(r.data.parameters["volume_min:sugar:international"], 500);
    assert.ok(
      DB.raw
        .prepare("SELECT id FROM audit_log WHERE action='parameter.changed'")
        .get(),
    );
  },
);
check(
  "Supressão normalizada e idempotente não guarda identificador em claro",
  async ({ api, DB, env }) => {
    const b = {
      channel: "email",
      value: " Pessoa@Example.test ",
      reason: "opt_out",
    };
    const a = await api("/api/suppression", "POST", b),
      r = await api("/api/suppression", "POST", {
        ...b,
        value: "pessoa@example.test",
      });
    assert.equal(a.data.created, true);
    assert.equal(r.data.created, false);
    assert.equal(a.data.id, r.data.id);
    assert.equal(
      await isSuppressed(env, "eag-internal", "email", "pessoa@example.test"),
      true,
    );
    assert.ok(
      !JSON.stringify(
        DB.raw.prepare("SELECT * FROM suppression_entries").all(),
      ).includes("example.test"),
    );
    assert.ok(
      !JSON.stringify(DB.raw.prepare("SELECT * FROM audit_log").all()).includes(
        "example.test",
      ),
    );
  },
);
check(
  "Supressão falha sem chave em vez de criar hash fraco",
  async ({ api, env }) => {
    delete env.SUPPRESSION_HMAC_KEY;
    assert.equal(
      (
        await api("/api/suppression", "POST", {
          channel: "email",
          value: "p@example.test",
          reason: "opt_out",
        })
      ).status,
      503,
    );
  },
);
check(
  "Pausa exige referência existente e só retoma uma vez",
  async ({ api }) => {
    assert.equal(
      (
        await api("/api/pauses", "POST", {
          scope: "company",
          scopeRef: "none",
          reason: "Pedido do cliente",
        })
      ).status,
      404,
    );
    const p = await api("/api/pauses", "POST", {
      scope: "operation",
      reason: "Manutenção programada",
    });
    assert.equal(p.status, 201);
    assert.equal(
      (
        await api(`/api/pauses/${p.data.id}/resume`, "POST", {
          reason: "Manutenção concluída",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api(`/api/pauses/${p.data.id}/resume`, "POST", {
          reason: "Manutenção concluída",
        })
      ).status,
      409,
    );
  },
);
check(
  "Fila desconhecida é devolvida para retry, nunca confirmada",
  async () => {
    let ack = 0,
      retry = 0;
    await worker.queue({
      messages: [
        {
          body: { type: "unknown" },
          ack() {
            ack++;
          },
          retry() {
            retry++;
          },
        },
      ],
    });
    assert.equal(ack, 0);
    assert.equal(retry, 1);
  },
);
async function readyCompany(ctx) {
  const { api, DB } = ctx,
    cid = await create(api),
    path = `/api/companies/${cid}`;
  await api("/api/parameters/volume_min", "PUT", {
    scope: "corn:national",
    value: 100,
    reason: "Fixture de teste",
  });
  await api("/api/parameters/sanctions_max_age_hours", "PUT", {
    scope: "global",
    value: 24,
    reason: "Política exclusiva do teste",
  });
  const fs = [
    field("product", "Milho"),
    field("specification", "Confirmada"),
    field("packaging", "Granel"),
    field("volume_per_operation", { amount: 250, unit: "MT" }),
    field("operations_per_year", 12),
    field("destination_country", "BR"),
    field("delivery_location", "Unidade de teste"),
    field("incoterm", "FOB"),
    field("required_date", "2026-10-01"),
    field("modality", "Contrato"),
    field("payment_method", "Transferência"),
    field("payment_term", "À vista"),
    field("payment_guarantee", "Bancária"),
    field("decision_maker", "Decisor de teste"),
    field("compliance_restrictions", "Sem restrições declaradas"),
    field("buyer_profile", "trader_distributor"),
    field("company_registry_status", "verified_active"),
    field("delivery_condition", "Entrega confirmada"),
  ];
  const d = await api(path + "/demand", "PUT", demand(fs));
  assert.equal(d.status, 200);
  const did = d.data.id;
  assert.equal(
    (
      await api(path + "/evidence", "POST", {
        category: "business",
        evidenceType: "company_document",
        reference: "Prova de teste",
        productId: "product-03",
        market: "national",
        validationStatus: "valid",
        factDate: TEST_PREVIOUS_DAY,
        consultedAt: TEST_PREVIOUS_DAY,
      })
    ).status,
    201,
  );
  const ct = await api(path + "/contacts", "POST", {
    fullName: "Decisor de teste",
    sourceLabel: "Teste",
  });
  for (const type of ["identity", "decision_authority"])
    assert.equal(
      (
        await api(path + "/contact-verifications", "POST", {
          contactId: ct.data.id,
          demandId: did,
          type,
          status: "confirmed",
          method: "Documento",
          sourceReference: "Teste",
        })
      ).status,
      201,
    );
  for (const component of [
    "registration",
    "credit",
    "payment",
    "reputation",
    "logistics",
  ])
    await api(path + "/risk-observations", "POST", {
      component,
      severity: 5,
      sourceReference: "Teste",
      observedAt: TEST_PREVIOUS_DAY,
    });
  const now = new Date().toISOString(),
    versions = {};
  for (const source of DB.raw
    .prepare("SELECT id FROM sanction_sources")
    .all()) {
    const vid = crypto.randomUUID();
    versions[source.id] = vid;
    DB.raw
      .prepare(
        "INSERT INTO sanction_list_versions(id,source_id,content_hash,downloaded_at,import_status,record_count) VALUES (?,?,?,?,'imported',1)",
      )
      .run(vid, source.id, vid, now);
  }
  DB.raw
    .prepare(
      "INSERT INTO screening_runs(id,tenant_id,company_id,initiated_by,initiated_at,completed_at,status,query_json,source_versions_json) VALUES ('screen','eag-internal',?,'system-admin',?,?,'completed',?,?)",
    )
    .run(
      cid,
      now,
      now,
      JSON.stringify({
        registrationId: null,
        countryCode: "BR",
        legalName: "Empresa Teste",
      }),
      JSON.stringify(versions),
    );
  return { cid, did, path, ct: ct.data.id };
}
check(
  "Gate completo qualifica trader sem exigir comprador final genérico",
  async (ctx) => {
    const r = await readyCompany(ctx);
    const q = await ctx.api(r.path + "/qualify", "POST", { demandId: r.did });
    assert.equal(q.status, 200);
    assert.equal(q.data.qualified, true);
  },
);
check("Nova evidência invalida qualificação anterior", async (ctx) => {
  const r = await readyCompany(ctx);
  await ctx.api(r.path + "/qualify", "POST", { demandId: r.did });
  await ctx.api(r.path + "/risk-observations", "POST", {
    component: "credit",
    severity: 20,
    sourceReference: "Novo risco",
    observedAt: TEST_TODAY,
  });
  assert.equal(
    ctx.DB.raw
      .prepare("SELECT pipeline_status FROM companies WHERE id=?")
      .get(r.cid).pipeline_status,
    "qualifying",
  );
});
check("Autoridade revogada deixa de pontuar e impede gate", async (ctx) => {
  const r = await readyCompany(ctx);
  await ctx.api(r.path + "/contact-verifications", "POST", {
    contactId: r.ct,
    demandId: r.did,
    type: "decision_authority",
    status: "rejected",
    method: "Nova verificação",
    sourceReference: "Teste",
  });
  const q = await ctx.api(r.path + "/qualify", "POST", { demandId: r.did });
  assert.equal(q.status, 409);
  assert.ok(q.data.error.details.pending.includes("decision_maker"));
});
check("Aprovação rejeitada posteriormente deixa de valer", async (ctx) => {
  const r = await readyCompany(ctx);
  for (const component of [
    "registration",
    "credit",
    "payment",
    "reputation",
    "logistics",
  ])
    await ctx.api(r.path + "/risk-observations", "POST", {
      component,
      severity: 20,
      sourceReference: "Novo risco",
      observedAt: TEST_TODAY,
    });
  await ctx.api(r.path + "/approvals", "POST", {
    demandId: r.did,
    approvalType: "risk_mitigation",
    status: "approved",
    reason: "Controle de teste",
  });
  let q = await ctx.api(r.path + "/scores/recalculate", "POST", {
    demandId: r.did,
  });
  assert.equal(q.data.gate.checks.risk_mitigation, true);
  await ctx.api(r.path + "/approvals", "POST", {
    demandId: r.did,
    approvalType: "risk_mitigation",
    status: "rejected",
    reason: "Controle rejeitado",
  });
  q = await ctx.api(r.path + "/qualify", "POST", { demandId: r.did });
  assert.ok(q.data.error.details.pending.includes("risk_mitigation"));
});
check("Aprovação não sobrevive a mudança nos dados de risco", async (ctx) => {
  const r = await readyCompany(ctx);
  for (const component of [
    "registration",
    "credit",
    "payment",
    "reputation",
    "logistics",
  ])
    await ctx.api(r.path + "/risk-observations", "POST", {
      component,
      severity: 20,
      sourceReference: "Novo risco",
      observedAt: TEST_TODAY,
    });
  await ctx.api(r.path + "/approvals", "POST", {
    demandId: r.did,
    approvalType: "risk_mitigation",
    status: "approved",
    reason: "Controle de teste",
  });
  await ctx.api(r.path + "/risk-observations", "POST", {
    component: "credit",
    severity: 20,
    sourceReference: "Mudou informação",
    observedAt: TEST_TODAY,
  });
  const q = await ctx.api(r.path + "/qualify", "POST", { demandId: r.did });
  assert.ok(q.data.error.details.pending.includes("risk_mitigation"));
});
check(
  "Evidência de outra commodity e outro mercado não pontua",
  async (ctx) => {
    const r = await readyCompany(ctx);
    ctx.DB.raw
      .prepare(
        "UPDATE evidence SET product_id='product-01',market='international'",
      )
      .run();
    const q = await ctx.api(r.path + "/scores/recalculate", "POST", {
      demandId: r.did,
    });
    assert.equal(q.data.confidence.components.purchaseEvidence, 0);
    assert.equal(q.data.gate.checks.business_evidence, false);
  },
);
check("Empresa bloqueada não retorna a qualificada", async (ctx) => {
  const r = await readyCompany(ctx);
  ctx.DB.raw
    .prepare("UPDATE companies SET pipeline_status='blocked' WHERE id=?")
    .run(r.cid);
  const q = await ctx.api(r.path + "/qualify", "POST", { demandId: r.did });
  assert.equal(q.status, 409);
  assert.equal(q.data.error.code, "company_blocked");
});
check("Nova versão de sanções invalida a triagem antiga", async (ctx) => {
  const r = await readyCompany(ctx);
  ctx.DB.raw
    .prepare(
      "INSERT INTO sanction_list_versions(id,source_id,content_hash,downloaded_at,import_status) VALUES ('new-list','source-ofac-sdn','new-hash',?,'imported')",
    )
    .run(new Date().toISOString());
  const q = await ctx.api(r.path + "/qualify", "POST", { demandId: r.did });
  assert.equal(q.status, 409);
  assert.ok(q.data.error.details.pending.includes("sanctions"));
});
check(
  "Revogação entre leitura e commit impede qualificação concorrente",
  async (ctx) => {
    const r = await readyCompany(ctx);
    const batch = ctx.DB.batch.bind(ctx.DB);
    let intercepted = false;
    ctx.DB.batch = async (statements) => {
      if (
        !intercepted &&
        statements.some((s) =>
          s.sql.includes("SET pipeline_status='qualified'"),
        )
      ) {
        intercepted = true;
        const revoke = await ctx.api(r.path + "/approvals", "POST", {
          demandId: r.did,
          approvalType: "risk_mitigation",
          status: "rejected",
          reason: "Decisão concorrente de teste",
        });
        assert.equal(revoke.status, 201);
      }
      return batch(statements);
    };
    const result = await ctx.api(r.path + "/qualify", "POST", {
      demandId: r.did,
    });
    assert.ok(intercepted);
    assert.equal(result.status, 409);
    assert.equal(result.data.error.code, "edit_conflict");
    assert.notEqual(
      ctx.DB.raw
        .prepare("SELECT pipeline_status FROM companies WHERE id=?")
        .get(r.cid).pipeline_status,
      "qualified",
    );
  },
);
check(
  "CNPJ com formatação diferente não duplica empresa e trava no banco",
  async ({ api, DB }) => {
    const data = {
      countryCode: "BR",
      sourceLabel: "Teste",
      registrationIdType: "cnpj",
    };
    assert.equal(
      (
        await api("/api/companies", "POST", {
          ...data,
          legalName: "Empresa A",
          registrationId: "12.345.678/0001-90",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await api("/api/companies", "POST", {
          ...data,
          legalName: "Empresa B",
          registrationId: "12345678000190",
        })
      ).status,
      409,
    );
    assert.throws(
      () =>
        DB.raw
          .prepare(
            "INSERT INTO companies(id,tenant_id,legal_name,country_code,registration_id,registration_id_type,source_label,created_by) VALUES ('duplicate','eag-internal','Empresa C','BR','12.345.678/0001-90','CNPJ','Teste','system-admin')",
          )
          .run(),
      /company_identifier_duplicate/,
    );
  },
);
check(
  "Datas inválidas ou futuras em sanções não liberam o gate",
  async (ctx) => {
    const r = await readyCompany(ctx);
    for (const value of ["invalid-date", "2099-01-01T00:00:00.000Z"]) {
      ctx.DB.raw.prepare("UPDATE screening_runs SET completed_at=?").run(value);
      const result = await ctx.api(r.path + "/qualify", "POST", {
        demandId: r.did,
      });
      assert.equal(result.status, 409);
      assert.ok(result.data.error.details.pending.includes("sanctions"));
    }
  },
);
check(
  "JSON corrompido na triagem fica pendente em vez de liberar ou falhar com 500",
  async (ctx) => {
    const r = await readyCompany(ctx);
    ctx.DB.raw.prepare("UPDATE screening_runs SET query_json='null'").run();
    const result = await ctx.api(r.path + "/qualify", "POST", {
      demandId: r.did,
    });
    assert.equal(result.status, 409);
    assert.equal(
      result.data.error.details.screening.reason,
      "screening_invalid",
    );
  },
);
check("Rascunho numérico permanece salvo, mas não pontua", async ({ api }) => {
  const cid = await create(api),
    base = `/api/companies/${cid}`;
  const result = await api(
    base + "/demand",
    "PUT",
    demand([
      {
        key: "volume_per_operation",
        status: "not_confirmed",
        value: { amount: 250, unit: "MT" },
      },
      { key: "operations_per_year", status: "not_confirmed", value: 12 },
    ]),
  );
  assert.equal(result.status, 200);
  const saved = await api(base);
  assert.equal(
    JSON.parse(
      saved.data.demandFields[result.data.id].find(
        (f) => f.field_key === "operations_per_year",
      ).value_json,
    ),
    12,
  );
  const scores = await api(base + "/scores/recalculate", "POST", {
    demandId: result.data.id,
  });
  assert.equal(scores.data.potential.scoreMin, 0);
});
check(
  "Página de 100 demandas respeita o limite de parâmetros do D1",
  async ({ api, DB }) => {
    const cid = await create(api);
    for (let n = 0; n < 100; n++) {
      DB.raw
        .prepare(
          "INSERT INTO demands(id,tenant_id,company_id,commodity,market,created_by) VALUES (?,'eag-internal',?,?,'international','system-admin')",
        )
        .run("d" + n, cid, "legacy_" + n);
      DB.raw
        .prepare(
          "INSERT INTO demand_fields(id,tenant_id,demand_id,field_key,field_status,value_json,source_reference,updated_by) VALUES (?,'eag-internal',?,'product','confirmed','\"Produto\"','Documento','system-admin')",
        )
        .run("f" + n, "d" + n);
    }
    const prepare = DB.prepare.bind(DB);
    DB.prepare = (sql) => {
      const statement = prepare(sql),
        bind = statement.bind;
      statement.bind = function (...args) {
        assert.ok(args.length <= 100, "Limite de bind do D1");
        return bind.apply(this, args);
      };
      return statement;
    };
    const result = await api(`/api/companies/${cid}?limit=100`);
    assert.equal(result.status, 200);
    assert.equal(result.data.demands.length, 100);
    assert.equal(Object.keys(result.data.demandFields).length, 100);
    assert.equal(result.data.demandFields.d99[0].value_json, '"Produto"');
  },
);
check(
  "Recálculo idêntico não multiplica scores nem auditorias",
  async ({ api, DB }) => {
    const cid = await create(api),
      base = `/api/companies/${cid}`,
      d = await api(
        base + "/demand",
        "PUT",
        demand([field("product", "Milho")]),
      );
    assert.equal(
      (await api(base + "/scores/recalculate", "POST", { demandId: d.data.id }))
        .data.scoresReused,
      false,
    );
    assert.equal(
      (await api(base + "/scores/recalculate", "POST", { demandId: d.data.id }))
        .data.scoresReused,
      true,
    );
    assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM scores").get().n, 3);
    assert.equal(
      DB.raw
        .prepare(
          "SELECT COUNT(*) n FROM audit_log WHERE action='scores.calculated'",
        )
        .get().n,
      1,
    );
  },
);
