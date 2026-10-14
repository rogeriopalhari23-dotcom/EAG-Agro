// Saudação pelo horário (A-ID8, 2026-10-14) pela ponte real falando com o Worker real (D1 em memória), SMTP e IMAP falsos:
// às 10:00 do destinatário sai a variante aprovada "Bom dia", às 14:00 o texto principal "Boa tarde". O hash que a ponte
// confere e devolve é o do texto que saiu; nenhum dos dois para o remetente. Destinatário só interno de teste.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../../src/worker.js";
import { setup } from "../../tests/helpers/db.mjs";
import { compassClient } from "../src/compass.js";
import { openJournal } from "../src/journal.js";
import { runCycle } from "../src/cycle.js";

const KEY = Buffer.alloc(32, 9).toString("base64");
const INTERNAL = "rogeriopalhari23@gmail.com";
const todaySP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function fakeSmtp() {
  const raws = [];
  return { raws, async send(raw, envelope) { raws.push({ raw: raw.toString(), envelope }); return { kind: "accepted", code: 250, text: "250 OK queued" }; } };
}
function fakeImap() {
  const sent = [];
  return {
    sent, async fetchNew(cursor) { return cursor.uidValidity ? { uidValidity: 7, messages: [], highestUid: cursor.lastUid } : { uidValidity: 7, messages: [], highestUid: 0, baseline: true }; },
    async appendSent(raw) { sent.push(raw.toString()); },
    async sentHasMessageId(id) { return sent.some((r) => r.includes(`Message-ID: ${id}`)); },
  };
}
const qp = (raw) => Buffer.from(raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8");

async function ready(ctx) {
  const { api, env, DB } = ctx;
  Object.assign(env, {
    EAG_POSTAL_ADDRESS: "Rua Exemplo, 100 — Sertãozinho/SP", EAG_POSTAL_ADDRESS_CONFIRMED: "Rua Exemplo, 100 — Sertãozinho/SP",
    PUBLIC_BASE_URL: "https://compass.exemplo", UNSUB_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
    MAILBOX_USER: "rogeriopalhari@eagagro.com", SENDER_NAME: "EAG Agro - Brasil", INTERNAL_TEST_RECIPIENTS: INTERNAL,
    BRIDGE_HMAC_KEY: KEY, SEND_TRANSPORT: "bridge",
  });
  const put = (key, scope, value) => api(`/api/parameters/${key}`, "PUT", { scope, value, reason: "Parâmetro do teste da saudação" });
  await put("send_timezone", "national", "America/Sao_Paulo");
  await put("send_window", "national", { start: "00:00", end: "23:59", weekdays: [1, 2, 3, 4, 5, 6, 7] });
  await put("sanctions_max_age_hours", "global", 24);
  await put("email_validation_max_age_days", "email", 30);
  DB.raw.exec("UPDATE channels SET state='internal_test' WHERE channel='email'");
  for (const sid of ["source-ofac-sdn", "source-cgu-ceis", "source-cgu-cnep"]) {
    const v = await api(`/api/sanctions/sources/${sid}/versions`, "POST", { contentHash: createHash("sha256").update(sid).digest("hex"), recordCount: 1, downloadedAt: new Date().toISOString() });
    await api(`/api/sanctions/versions/${v.data.id}/entries`, "POST", { entries: [{ primaryName: "Sem Relação Nenhuma" }] });
    await api(`/api/sanctions/versions/${v.data.id}/finish`, "POST", {});
  }
  const camp = await api("/api/campaigns", "POST", {
    productId: "product-03", market: "national", name: "Milho teste", originCity: "Indiara", originUf: "GO", radiusKm: 300,
    icp: { userSectors: ["ração"], sizeTarget: "medium", region: "GO", decisionRole: "Compras", influencerRole: "Suprimentos" },
  });
  await api(`/api/campaigns/${camp.data.id}/activate`, "POST", { expectedVersion: 1 });
  const co = await api("/api/companies", "POST", { legalName: "Moinho Teste Ltda.", tradeName: "Moinho Teste", countryCode: "BR", registrationId: "11222333000181", registrationIdType: "CNPJ", sourceLabel: "teste" });
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-03", profileClass: "possible_final_consumer", basis: "site" });
  const p = (await api(`/api/companies/${co.data.id}/profiles`)).data.items[0];
  if (p.icp_status === "pending_size") await api(`/api/profiles/${p.id}`, "PATCH", { expectedRevision: p.revision, sizeCallGoal: true });
  await api(`/api/companies/${co.data.id}/screening`, "POST", {});
  const ch = await api(`/api/companies/${co.data.id}/channels`, "POST", { email: INTERNAL, sourceUrl: "https://moinho.com.br/contato", timezone: "America/Sao_Paulo" });
  const contactId = ch.data.contactId;
  DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at=? WHERE id=?").run(new Date(Date.now() - 86400000).toISOString(), contactId);
  const c = await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: camp.data.id, purpose: "identify_buyer", recipients: [contactId] });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  const f = (await api(`/api/fichas/${c.data.id}`)).data;
  const x = f.toApprove.find((a) => a.channel === "email");
  const ok = await api(`/api/fichas/${c.data.id}/approve`, "POST", { versionNo: 1, contactId, channel: "email", messagesSha256: x.messagesSha256, startDate: todaySP() });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  DB.raw.exec("DELETE FROM reply_reader_state");
}

for (const [hhmm, greeting, variant] of [["10:00", "Bom dia, tudo bem?", "am"], ["14:00", "Boa tarde, tudo bem?", null]]) {
  test(`Ponte às ${hhmm} do destinatário: sai "${greeting}", hash conferido nos dois lados, remetente não para`, async (t) => {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    t.mock.timers.enable({ apis: ["Date"], now: Date.parse(`${day}T${hhmm}:00-03:00`) });
    const ctx = setup();
    t.after(ctx.close);
    await ready(ctx);
    const compass = compassClient({ baseUrl: "http://localhost", hmacKey: KEY, fetchImpl: (url, init) => worker.fetch(new Request(url, init), ctx.env) });
    const journal = openJournal(join(mkdtempSync(join(tmpdir(), "ponte-saudacao-")), "journal.sqlite"));
    const d = { compass, journal, smtp: fakeSmtp(), imap: fakeImap(), log: () => {}, version: "teste", copyAllow: [] };
    const r = await runCycle(d);
    assert.equal(r.sent, true, JSON.stringify(r));
    assert.equal(d.smtp.raws.length, 1);
    const body = qp(d.smtp.raws[0].raw);
    assert.ok(body.includes(greeting), "saudação conforme o horário");
    assert.ok(!body.includes(variant ? "Boa tarde, tudo bem?" : "Bom dia, tudo bem?"), "só uma saudação no e-mail");
    const o = ctx.DB.raw.prepare("SELECT status,greeting_variant FROM send_outbox WHERE step_no=1").get();
    assert.deepEqual({ ...o }, { status: "accepted", greeting_variant: variant });
    const st = ctx.DB.raw.prepare("SELECT stopped_at FROM sender_state").get();
    assert.equal(st?.stopped_at ?? null, null, "texto aprovado: nenhuma parada por divergência de hash");
    assert.equal(ctx.DB.raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='bridge.hash_mismatch'").get().n, 0);
  });
}
