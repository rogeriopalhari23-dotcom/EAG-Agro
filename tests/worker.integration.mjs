import test from "node:test";
import assert from "node:assert/strict";
import { runtime } from "./helpers/runtime.mjs";
import { readFile } from "node:fs/promises";
test(
  "workerd + D1: migrações reais, cadastro, edição, criptografia e gate",
  { timeout: 30000 },
  async (t) => {
    const r = await runtime();
    t.after(r.close);
    await r.migrate();
    assert.equal((await r.call("/api/catalog")).data.products.length, 28);
    const company = await r.call("/api/companies", "POST", {
      legalName: "Runtime Test",
      countryCode: "BR",
      sourceLabel: "Teste local",
    });
    assert.equal(company.status, 201);
    const base = `/api/companies/${company.data.id}`;
    const first = await r.call(base + "/demand", "PUT", {
      productId: "product-03",
      market: "national",
      fields: [
        {
          key: "product",
          status: "confirmed",
          value: "Milho",
          sourceReference: "Documento de teste",
        },
      ],
    });
    assert.equal(first.status, 200);
    const edit = await r.call(base + "/demand", "PUT", {
      id: first.data.id,
      expectedVersion: 1,
      productId: "product-03",
      market: "national",
      fields: [
        {
          key: "packaging",
          status: "confirmed",
          value: "Granel",
          sourceReference: "Documento de teste",
        },
      ],
    });
    assert.equal(edit.status, 200);
    assert.equal(edit.data.completeness.confirmed, 2);
    assert.equal(
      (
        await r.call(base + "/contacts", "POST", {
          fullName: "Teste",
          email: "pessoa@example.test",
          sourceLabel: "Teste",
        })
      ).status,
      201,
    );
    assert.equal(
      (await r.call(base)).data.contacts[0].email,
      "pessoa@example.test",
    );
    assert.equal(
      (
        await r.call(base + "/scores/recalculate", "POST", {
          demandId: first.data.id,
        })
      ).status,
      200,
    );
    const gate = await r.call(base + "/qualify", "POST", {
      demandId: first.data.id,
    });
    assert.equal(gate.status, 409);
    assert.ok(gate.data.error.details.pending.includes("sanctions"));
    const fk = await r.sql("PRAGMA foreign_key_check;");
    assert.equal(fk[0].results.length, 0);
  },
);
test(
  "workerd + D1: migração com demanda e filhos legados preservados",
  { timeout: 30000 },
  async (t) => {
    const r = await runtime();
    t.after(r.close);
    for (const f of ["0001_initial.sql", "0002_seed_configuration.sql"])
      await r.sql(
        await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"),
      );
    await r.sql(
      `INSERT INTO companies(id,tenant_id,legal_name,country_code,source_label,created_by) VALUES ('legacy','eag-internal','Legado','BR','doc','system-admin'); INSERT INTO demands(id,tenant_id,company_id,commodity,created_by) VALUES ('old','eag-internal','legacy','sugar','system-admin'); INSERT INTO demand_fields(id,tenant_id,demand_id,field_key,field_status,value_json,source_reference,updated_by) VALUES ('field','eag-internal','old','product','confirmed','"Açúcar"','Documento','system-admin');`,
    );
    for (const f of [
      "0003_v2_fundacao.sql",
      "0004_seed_catalogo.sql",
      "0005_seed_parametros_v2.sql",
    ])
      await r.sql(
        await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"),
      );
    const data = await r.sql(
      "SELECT id,market FROM demands; SELECT demand_id FROM demand_fields; PRAGMA foreign_key_check;",
    );
    assert.equal(data[0].results[0].id, "old");
    assert.equal(data[0].results[0].market, "international");
    assert.equal(data[1].results[0].demand_id, "old");
    assert.equal(data[2].results.length, 0);
  },
);
