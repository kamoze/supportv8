import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const effects = vi.hoisted(() => ({ issue: vi.fn(), rate: vi.fn(), email: vi.fn(), credential: vi.fn() }));
vi.mock("@/lib/auth/otp-store", async (original) => ({
  ...await original<typeof import("../src/lib/auth/otp-store")>(),
  otpStore: { issue: effects.issue, enforceIssueRateLimit: effects.rate, revoke: vi.fn() },
}));
vi.mock("@/lib/services/resend-service", () => ({ ResendService: { dispatchOtpEmail: effects.email } }));
vi.mock("@/lib/auth/keycloak", async (original) => ({
  ...await original<typeof import("../src/lib/auth/keycloak")>(), verifyKeycloakPassword: effects.credential,
}));
import { POST as sendOtp } from "../src/app/api/auth/otp/send/route";
import { POST as login } from "../src/app/api/auth/login/route";
import { GET as loginPage, POST as loginForm } from "../src/app/login/route";
import { middleware } from "../src/middleware";

function request(path: string, body: unknown) {
  return new NextRequest(`https://alpha.support.servicev8.com${path}`, {
    method: "POST", headers: { host: "alpha.support.servicev8.com", origin: "https://alpha.support.servicev8.com", "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
describe("interactive auth requires server bot proof before effects", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    effects.issue.mockResolvedValue("123456"); effects.email.mockResolvedValue({ success: true });
    effects.credential.mockResolvedValue({ ok: false });
  });
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
  it("does not issue or send signup OTP without a one-use challenge transaction", async () => {
    const response = await sendOtp(request("/api/auth/otp/send", { email: "lead@example.com", tenantSlug: "alpha", companyName: "Alpha" }));
    expect(response.status).toBe(400);
    expect(effects.issue).not.toHaveBeenCalled(); expect(effects.email).not.toHaveBeenCalled();
  });
  it("does not verify credentials without a one-use challenge transaction", async () => {
    const response = await login(request("/api/auth/login", { email: "lead@example.com", tenantSlug: "alpha", password: "correct horse battery staple" }));
    expect(response.status).toBe(400);
    expect(effects.credential).not.toHaveBeenCalled();
  });
  it("also gates the existing /login form POST before credentials", async () => {
    const req = new NextRequest("https://alpha.support.servicev8.com/login", { method: "POST", headers: { host: "alpha.support.servicev8.com", origin: "https://alpha.support.servicev8.com", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email: "lead@example.com", password: "correct horse battery staple", workspace: "alpha" }) });
    expect((await loginForm(req)).status).toBe(400); expect(effects.credential).not.toHaveBeenCalled();
  });
  it("uses the native signin view without a middleware redirect loop", async () => {
    const res = await loginPage(new NextRequest("https://support.servicev8.com/login", { headers: { host: "support.servicev8.com" } }));
    expect(res.status).toBe(302); expect(res.headers.get("location")).toBe("https://support.servicev8.com/?signin=1");
    const tenant = middleware(new NextRequest("https://alpha.support.servicev8.com/?signin=1", { headers: { host: "alpha.support.servicev8.com" } }));
    expect(tenant.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

import { authBotChallenge, AuthBotChallengeService } from "../src/lib/auth/bot-challenge";
import { POST as challengeRoute } from "../src/app/api/auth/challenge/route";
import { BotTransactionStore } from "../src/lib/auth/bot-transaction";
import { InMemoryOtpBackend } from "../src/lib/auth/otp-store";
import { createNativeLoginAuthority, nativeLoginAuthority } from "../src/lib/auth/native-login-authority";
import { createGatewayBotVerifier } from "../src/lib/auth/bot-gateway";

describe("mounted browser challenge through both credential POST paths", () => {
  let membershipActive = true;
  let ownerCalls: Array<{ url: string; body: unknown }>;
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production"); ownerCalls = []; membershipActive = true;
    const service = new AuthBotChallengeService({
      siteKey: "synthetic-widget-public-key", store: new BotTransactionStore(new InMemoryOtpBackend()),
      workspace: async () => ({ id: "tenant_alpha", accountId: "account-alpha", slug: "alpha", name: "Alpha Inc", status: "active", url: "https://alpha.support.servicev8.com/" }),
      verify: createGatewayBotVerifier({ gatewayUrl: "https://gateway.example.test", tokenUrl: "https://identity.example.test/token", clientId: "registered-support-bot", readSecret: async () => "synthetic-client-secret", request: (async (url, init) => {
        ownerCalls.push({ url: String(url), body: init?.body });
        return String(url).endsWith("/token") ? Response.json({ access_token: "synthetic-token", token_type: "Bearer", expires_in: 120 }) : Response.json({ schemaVersion: 1, success: true });
      }) as typeof fetch }),
    });
    vi.spyOn(authBotChallenge, "start").mockImplementation(service.start.bind(service));
    vi.spyOn(authBotChallenge, "consume").mockImplementation(service.consume.bind(service));
    vi.spyOn(nativeLoginAuthority, "current").mockImplementation(createNativeLoginAuthority({ canonicalIssuer: () => "https://identity.example.test/realms/servicev8",
      workspace: async () => ({ id: "tenant_alpha", accountId: "account-alpha", slug: "alpha", name: "Alpha Inc", status: "active", url: "https://alpha.support.servicev8.com/" }),
      membership: async (workspace, subject) => ({ accountId: workspace.accountId, tenantId: workspace.id, identitySubject: subject, status: membershipActive ? "active" : "revoked", role: "member" }), native: async () => true,
    }));
    effects.credential.mockResolvedValue({ ok: true, accessToken: "synthetic-access", refreshToken: "synthetic-refresh", expiresIn: 120, refreshExpiresIn: 3600, decodedClaims: { iss: "https://identity.example.test/realms/servicev8", sub: "native-user", tenant_id: "tenant_alpha", account_id: "account-alpha", realm_access: { roles: ["support_operator"] }, exp: Math.floor(Date.now()/1000)+120 } });
    effects.issue.mockResolvedValue("123456"); effects.email.mockResolvedValue({ success: true }); effects.rate.mockResolvedValue(undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs(); });
  async function proof(action = "signin", hostname = "alpha.support.servicev8.com") {
    const response = await challengeRoute(new NextRequest(`https://${hostname}/api/auth/challenge`, { method: "POST", headers: { host: hostname, origin: `https://${hostname}`, "content-type": "application/json" }, body: JSON.stringify({ action, email: "lead@example.com", tenantSlug: "alpha" }) }));
    expect(response.status).toBe(200);
    const body = await response.json();
    return { cookie: response.headers.get("set-cookie")!.split(";", 1)[0], body: { email: "lead@example.com", tenantSlug: "alpha", password: "correct horse battery staple", challengeId: body.challengeId, botToken: "controlled-provider-token" } };
  }
  it("verifies strict Gateway proof before credentials, preserves form return path/cookies and denies replay on either endpoint", async () => {
    for (const form of [false, true]) {
      const issued = await proof(), path = form ? "/login?next=%2Fworkspace" : "/api/auth/login";
      const req = () => new NextRequest(`https://alpha.support.servicev8.com${path}`, { method: "POST", headers: { host: "alpha.support.servicev8.com", origin: "https://alpha.support.servicev8.com", cookie: issued.cookie, "content-type": form ? "application/x-www-form-urlencoded" : "application/json" }, body: form ? new URLSearchParams(issued.body) : JSON.stringify(issued.body) });
      const handler = form ? loginForm : login, response = await handler(req());
      expect(response.status).toBe(form ? 302 : 200); expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.getSetCookie().join(";")).toContain("sv8_access_token=synthetic-access");
      if (form) expect(response.headers.get("location")).toBe("https://alpha.support.servicev8.com/workspace");
      expect(JSON.parse(String(ownerCalls.at(-1)!.body))).toEqual({ schemaVersion: 1, token: "controlled-provider-token", hostname: "alpha.support.servicev8.com", action: "signin", cdata: issued.body.challengeId });
      const count = effects.credential.mock.calls.length;
      expect((await handler(req())).status).toBe(400); expect(effects.credential).toHaveBeenCalledTimes(count);
    }
  });
  it("rechecks current membership after credential verification and issues no session after revocation", async () => {
    const issued = await proof();
    effects.credential.mockImplementationOnce(async () => { membershipActive = false; return { ok: true, accessToken: "synthetic-access", decodedClaims: { iss: "https://identity.example.test/realms/servicev8", sub: "native-user", tenant_id: "tenant_alpha", account_id: "account-alpha", realm_access: { roles: ["support_operator"] } } }; });
    const req = request("/api/auth/login", issued.body); req.headers.set("cookie", issued.cookie);
    const denied = await login(req); expect(denied.status).toBe(403); expect(denied.headers.get("set-cookie")).toBeNull();
    expect(effects.credential).toHaveBeenCalledTimes(1);
  });
  it("requires matching proof before signup email and never accepts a tenant challenge on the global credential endpoint", async () => {
    const issued = await proof("signup", "support.servicev8.com");
    const response = await sendOtp(new NextRequest("https://support.servicev8.com/api/auth/otp/send", { method: "POST", headers: { host: "support.servicev8.com", origin: "https://support.servicev8.com", cookie: issued.cookie, "content-type": "application/json" }, body: JSON.stringify({ ...issued.body, companyName: "Alpha Inc" }) }));
    expect(response.status).toBe(200); expect(effects.email).toHaveBeenCalledTimes(1);
    const signin = await proof();
    const denied = await login(new NextRequest("https://support.servicev8.com/api/auth/login", { method: "POST", headers: { host: "support.servicev8.com", origin: "https://support.servicev8.com", cookie: signin.cookie, "content-type": "application/json" }, body: JSON.stringify(signin.body) }));
    expect(denied.status).toBe(403); expect(effects.credential).not.toHaveBeenCalled();
  });
});
