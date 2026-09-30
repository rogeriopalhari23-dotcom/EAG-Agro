// Assinatura real (sem a assinatura de teste dos helpers): logo original em HTTPS, sem marcador, e só conferida por Rogério.
import test from "node:test";
import assert from "node:assert/strict";
import { SIGNATURE, LOGO_PLACEHOLDER, signatureReady, emailParts } from "../src/templates/assinatura.js";

test("Assinatura oficial: logo original por HTTPS estável, sem marcador, aguardando conferência visual antes de liberar", () => {
  assert.ok(!SIGNATURE.html.includes(LOGO_PLACEHOLDER));
  assert.equal(SIGNATURE.html.match(/<img src="https:\/\/eag-assinatura\.rogeriopalhari23\.workers\.dev\/assinatura\/logo-eag-agro\.png"/g).length, 1);
  assert.ok(!/\bblob:/.test(SIGNATURE.html));
  assert.match(SIGNATURE.html, /width="128"\s+height="128"/, "mesma proporção quadrada do original");
  assert.equal(SIGNATURE.status, "imported_pending_visual");
  assert.equal(signatureReady(), false, "sem a conferência visual de Rogério nada é aprovável");
  const { body, html } = emailParts("Guten Tag,\n\nText.", ["Adresse", "abmelden: https://x/u/t"]);
  assert.equal(html.split(SIGNATURE.html).length, 2);
  assert.equal(body.split("Rogerio Palhari\nBroker | EAG AGRO").length, 2);
  assert.ok(html.indexOf("https://x/u/t") > html.indexOf(SIGNATURE.html) + SIGNATURE.html.length, "descadastro no rodapé separado");
});
