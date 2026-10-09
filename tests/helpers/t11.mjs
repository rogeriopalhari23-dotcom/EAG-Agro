// Validação T11 de teste (só no banco em memória dos testes): para testes de envio/aprovação cujo assunto não é a trava
// T11 do e-mail (decisão de 2026-10-09). A trava em si é testada em tests/t11-email-trava.test.mjs.
import { randomUUID } from "node:crypto";
export function t11Fixture(DB, scope = "br_email_automatic", decision = "validated", decidedOn = new Date().toISOString().slice(0, 10)) {
  DB.raw
    .prepare("INSERT INTO compliance_validations(id,tenant_id,gate,scope,decision,responsible,decided_on,basis,recorded_by,request_id) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(randomUUID(), "eag-internal", "t11", scope, decision, "Fixture de teste", decidedOn, "Validação de teste (fixture), sem efeito fora do teste", "test", "test");
}
