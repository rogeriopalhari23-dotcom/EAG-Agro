// Política revogada (a revogação prevalece sobre a política preparada a partir da autorização escrita): o caminho
// "sem política vigente" continua existindo e é exercitado assim nos testes.
export function revokedPolicy(DB) {
  DB.raw.prepare("INSERT INTO research_policies(id,tenant_id,version,policy_json,reference,granted_by,granted_at,revoked_by,revoked_at,revoke_reason) VALUES ('pol-revogada','eag-internal',1,'{}','Teste (fictício)','system-admin','2026-10-01T00:00:00Z','system-admin','2026-10-02T00:00:00Z','Revogada no teste (fictício)')").run();
}
