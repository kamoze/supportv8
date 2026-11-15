import { createServer } from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyKeycloakPassword } from "../src/lib/auth/keycloak";
afterEach(() => vi.unstubAllEnvs());
it("verifies password-grant tokens cryptographically before exposing subject or canonical claims", async () => {
 const keys = await generateKeyPair("RS256"), foreign = await generateKeyPair("RS256"), jwk = await exportJWK(keys.publicKey); let token = "";
 const server = createServer((req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(req.url?.endsWith("/certs") ? { keys: [{ ...jwk, kid: "fixture-key", alg: "RS256" }] } : { access_token: token, expires_in: 120 })); });
 await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
 const address = server.address(); if (!address || typeof address === "string") throw Error();
 const base = `http://127.0.0.1:${address.port}`, issuer = `${base}/realms/supportv8`;
 vi.stubEnv("KEYCLOAK_ADMIN_BASE_URL", base); vi.stubEnv("SUPPORTV8_OIDC_REALM", "supportv8"); vi.stubEnv("SUPPORTV8_OIDC_CLIENT_ID", "supportv8-app");
 const jwt = (key: CryptoKey, aud = "supportv8-app", azp: string | undefined = aud, preferred_username = "human@example.test") => new SignJWT({ tenant_id: "tenant_alpha", account_id: "canonical-account", azp, preferred_username }).setProtectedHeader({ alg: "RS256", kid: "fixture-key" }).setIssuer(issuer).setAudience(aud).setSubject("verified-human").setIssuedAt().setExpirationTime("2m").sign(key);
 try {
  token = await jwt(keys.privateKey); expect(await verifyKeycloakPassword("person@example.test", "synthetic-password")).toMatchObject({ ok: true, decodedClaims: { sub: "verified-human", tenant_id: "tenant_alpha", account_id: "canonical-account" } });
  token = await jwt(foreign.privateKey); expect((await verifyKeycloakPassword("person@example.test", "synthetic-password")).ok).toBe(false);
  token = await jwt(keys.privateKey, "foreign-app"); expect((await verifyKeycloakPassword("person@example.test", "synthetic-password")).ok).toBe(false);
  for (const client of ["supportv8-demo-acme", "supportv8-demo-meridian", "foreign-app"]) {
   token = await jwt(keys.privateKey, "supportv8-app", client); expect((await verifyKeycloakPassword("person@example.test", "synthetic-password")).ok).toBe(false);
  }
  token = await jwt(keys.privateKey, "supportv8-app", "supportv8-app", "service-account-supportv8-app"); expect((await verifyKeycloakPassword("person@example.test", "synthetic-password")).ok).toBe(false);
 } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
