import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import { verifyAccessToken } from "../src/auth.js";
const pair = await generateKeyPair("RS256"),
  jwk = await exportJWK(pair.publicKey);
jwk.kid = "test-key";
const keys = createLocalJWKSet({ keys: [jwk] });
const config = {
  issuer: "https://example.cloudflareaccess.com",
  audience: "eag-audience",
};
async function token(overrides = {}) {
  const claims = {
    email: "TEST@example.test",
    sub: "user1",
    iss: config.issuer,
    aud: config.audience,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(pair.privateKey);
}
test("JWT válido valida assinatura, emissor, público e validade", async () =>
  assert.equal(
    await verifyAccessToken(await token(), config, keys),
    "test@example.test",
  ));
for (const [name, claims] of [
  ["expirado", { exp: 1 }],
  ["emissão futura", { iat: Math.floor(Date.now() / 1000) + 3600 }],
  ["emissor errado", { iss: "https://attacker.example" }],
  ["audience errado", { aud: "other" }],
  ["sem exp", { exp: undefined }],
  ["sem email", { email: undefined }],
  ["sem subject", { sub: undefined }],
])
  test(`JWT ${name} rejeitado`, async () =>
    assert.rejects(verifyAccessToken(await token(claims), config, keys)));
test("JWT com assinatura de outra chave é rejeitado", async () => {
  const other = await generateKeyPair("RS256");
  const bad = await new SignJWT({ email: "a@b.test", sub: "x" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(other.privateKey);
  await assert.rejects(verifyAccessToken(bad, config, keys));
});
