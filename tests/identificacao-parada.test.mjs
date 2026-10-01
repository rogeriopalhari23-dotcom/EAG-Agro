import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { pilot, transport, at, DAY } from "./helpers/pilot.mjs";
import { tick } from "../src/sending.js";
import { processMessage } from "../src/inbound.js";
import { SIGNATURE } from "../src/templates/assinatura.js";

// A ficha de identificação usa a mesma fila, as mesmas verificações de envio e a mesma parada por resposta,
// descadastro e pausa das demais fichas (R19.2, R20.1, R21).
async function identification(ctx) {
  const { api, DB } = ctx;
  const base = await pilot(ctx); // campanha ativa, sanções, janela e fuso prontos
  const co = await api("/api/companies", "POST", { legalName: "Torrefação Serra Azul Ltda.", countryCode: "BR", registrationId: "22333444000155", registrationIdType: "CNPJ", sourceLabel: "teste" });
  DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,size_code,source_label,consulted_at) VALUES ('u-sa','eag-internal',?,'22333444000155','05','t','2026-09-23')").run(co.data.id);
  await api(`/api/companies/${co.data.id}/profiles`, "POST", { productId: "product-06", profileClass: "possible_final_consumer", basis: "CNAE" });
  await api(`/api/companies/${co.data.id}/screening`, "POST", {});
  const ch = (await api(`/api/companies/${co.data.id}/channels`, "POST", { email: "contato@serraazul.com.br", sourceUrl: "https://serraazul.com.br/contato", timezone: "America/Sao_Paulo" })).data.contactId;
  DB.raw.prepare("UPDATE contacts SET email_validation='valid',email_validated_at='2099-01-01T12:00:00.000Z' WHERE id=?").run(ch);
  ctx.env.INTERNAL_TEST_RECIPIENTS = `${ctx.env.INTERNAL_TEST_RECIPIENTS},contato@serraazul.com.br`;
  const { id } = (await api("/api/fichas", "POST", { companyId: co.data.id, campaignId: base.campaignId, purpose: "identify_buyer", recipients: [ch] })).data;
  const f = (await api(`/api/fichas/${id}`)).data;
  const x = f.toApprove.find((a) => a.contactId === ch);
  const ok = await api(`/api/fichas/${id}/approve`, "POST", { versionNo: f.version.no, contactId: ch, channel: "email", messagesSha256: x.messagesSha256, startDate: DAY });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  return { fichaId: id, channel: ch };
}
const enc = (s) => new TextEncoder().encode(s);
let uid = 500;

test("Identificação: resposta ao primeiro e-mail para o acompanhamento do dia 4 (mesma parada das outras fichas)", async (t) => {
  const ctx = setup();
  t.after(ctx.close);
  // Assinatura de teste conferida (a real depende da importação e da conferência de Rogério).
  const saved = { status: SIGNATURE.status, html: SIGNATURE.html };
  Object.assign(SIGNATURE, { status: "confirmed", html: '<table id="assinatura-teste"><tr><td>Rogerio Palhari</td></tr></table>' });
  t.after(() => Object.assign(SIGNATURE, saved));
  const { fichaId } = await identification(ctx);
  const tr = transport();
  for (let h = 10; h < 16; h++) await tick(ctx.env, "eag-internal", { transport: tr, now: at(h) });
  const rows = () => ctx.DB.raw.prepare("SELECT step_no,status,block_reason FROM send_outbox WHERE ficha_id=? ORDER BY step_no").all(fichaId);
  const first = rows().find((r) => r.step_no === 1);
  assert.equal(first.status, "accepted", JSON.stringify(rows()));
  const sent = tr.sent.find((m) => m.to === "contato@serraazul.com.br");
  assert.match(sent.subject, /^Responsável pela compra de /);
  assert.ok(!("In-Reply-To" in sent.headers), "envio não encadeia; por isso o acompanhamento não usa Re:");
  assert.equal(sent.html.split('<table id="assinatura-teste">').length, 2, "HTML congelado com a assinatura uma vez vai no envio");
  const raw = `From: Recepção <contato@serraazul.com.br>\r\nTo: rogeriopalhari@eagagro.com\r\nSubject: Re: ${sent.subject}\r\nMessage-ID: <r1@serraazul.com.br>\r\nIn-Reply-To: ${sent.headers["Message-ID"]}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nQuem compra é a Joana, compras@serraazul.com.br.\r\n`;
  await processMessage(ctx.env, "eag-internal", { mailbox: "INBOX", uidValidity: 7, uid: ++uid, bytes: enc(raw) }, at(16));
  const second = rows().find((r) => r.step_no === 2);
  assert.deepEqual([second.status, second.block_reason], ["cancelled", "reply_human"], "resposta cancela o acompanhamento (R20.1)");
  // Nenhum envio posterior ao contato que respondeu.
  const before = tr.sent.length;
  await tick(ctx.env, "eag-internal", { transport: tr, now: at(10, 0, "2099-01-09") });
  assert.equal(tr.sent.filter((m) => m.to === "contato@serraazul.com.br").length, 1);
  assert.ok(tr.sent.length >= before);
});
