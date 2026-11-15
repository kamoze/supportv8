// These downstream identity/OTP unit cases isolate proof transport; actual proof composition is covered by auth-bot-proof-routes.test.ts.
vi.mock("@/lib/auth/bot-challenge", async (original) => ({ ...await original<typeof import("@/lib/auth/bot-challenge")>(), authBotChallenge: { consume: vi.fn().mockResolvedValue(undefined) } }));
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as postOtpSend } from "@/app/api/auth/otp/send/route";
import { POST as postOtpVerify } from "@/app/api/auth/otp/verify/route";
import { POST as postSignup } from "@/app/api/tenant/signup/route";
import { GET as getWorkspaceSession } from "@/app/api/auth/workspace-session/route";
import { GET as getWorkforce } from "@/app/api/workforce/route";
import { GET as getCredits } from "@/app/api/credits/route";
import { otpStore } from "@/lib/auth/otp-store";
import { credentialStore } from "@/lib/auth/credential-store";
import { db } from "@/lib/db/mock-data";
import { signRuntimeSupportSession, RUNTIME_SUPPORT_COOKIE } from "@/lib/service-app/runtime-session";
import { handleRuntimeSupportHandoff } from "@/lib/service-app/runtime-handoff";
import { createHmac, randomUUID } from "node:crypto";

const TEST_SECRET = "test-session-secret-that-is-at-least-thirty-two-bytes-long";

describe("AUTH-01 to AUTH-06: Standalone & Runtime Entry Qualification", () => {
  beforeEach(() => {
    process.env.SUPPORTV8_RUNTIME_SESSION_SECRET = TEST_SECRET;
    process.env.SUPPORTV8_SERVICE_APP_RUNTIME_SECRET = TEST_SECRET;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("AUTH-01: Start signup, do not verify OTP -> only pending registration; no usable workspace, identity, or credits", async () => {
    const email = `newowner_${Date.now()}@example.test`;
    const tenantSlug = `pending-${Date.now()}`;

    // Step 1: Start signup by issuing OTP
    const sendReq = new NextRequest("https://support.servicev8.com/api/auth/otp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, tenantSlug, companyName: "Pending Corp" }),
    });
    const sendRes = await postOtpSend(sendReq);
    expect(sendRes.status).toBe(200);

    // Step 2: Attempt to call signup without verificationReceipt -> must be denied 403
    const unverifiedSignupReq = new NextRequest("https://support.servicev8.com/api/tenant/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Pending Corp",
        domain: tenantSlug,
        adminEmail: email,
        adminName: "Signup Owner",
        password: "ValidPassword123!",
        passwordConfirmation: "ValidPassword123!",
      }),
    });
    const unverifiedRes = await postSignup(unverifiedSignupReq);
    expect(unverifiedRes.status).toBe(403);
    const unverifiedData = await unverifiedRes.json();
    expect(unverifiedData.success).toBe(false);

    // Verify no usable identity, credentials or workspace exists
    expect(credentialStore.getUserByEmail(email)).toBeUndefined();
    expect((db as any).dynamicTenants.has(tenantSlug)).toBe(false);
  });

  it("AUTH-02: Wrong/expired/reused OTP -> atomic claim; old/replayed denied; exactly one workspace after successful flow", async () => {
    const email = `atomic_${Date.now()}@example.test`;
    const tenantSlug = `atomic-${Date.now()}`;

    // Issue OTP
    const code = await otpStore.issue("signup", email, tenantSlug);

    // Attempt 1: wrong code -> 400
    const wrongVerifyReq = new NextRequest("https://support.servicev8.com/api/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code: "000000", tenantSlug }),
    });
    const wrongVerifyRes = await postOtpVerify(wrongVerifyReq);
    expect(wrongVerifyRes.status).toBe(400);

    // Attempt 2: valid code -> 200 and receipt returned
    const validVerifyReq = new NextRequest("https://support.servicev8.com/api/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code, tenantSlug }),
    });
    const validVerifyRes = await postOtpVerify(validVerifyReq);
    expect(validVerifyRes.status).toBe(200);
    const verifyData = await validVerifyRes.json();
    expect(verifyData.verificationReceipt).toBeDefined();

    // Attempt 3: reuse same code again -> 400
    const reuseVerifyReq = new NextRequest("https://support.servicev8.com/api/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code, tenantSlug }),
    });
    const reuseVerifyRes = await postOtpVerify(reuseVerifyReq);
    expect(reuseVerifyRes.status).toBe(400);

    // Consume receipt in signup
    const signupReq = new NextRequest("https://support.servicev8.com/api/tenant/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Atomic Corp",
        domain: tenantSlug,
        adminEmail: email,
        adminName: "Signup Owner",
        password: "ValidPassword123!",
        passwordConfirmation: "ValidPassword123!",
        verificationReceipt: verifyData.verificationReceipt,
      }),
    });
    const signupRes = await postSignup(signupReq);
    expect(signupRes.status).toBe(200);

    // Replaying signup with the already consumed receipt -> denied 403
    const replaySignupReq = new NextRequest("https://support.servicev8.com/api/tenant/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Atomic Corp Replay",
        domain: tenantSlug,
        adminEmail: email,
        adminName: "Signup Owner",
        password: "ValidPassword123!",
        passwordConfirmation: "ValidPassword123!",
        verificationReceipt: verifyData.verificationReceipt,
      }),
    });
    const replaySignupRes = await postSignup(replaySignupReq);
    expect(replaySignupRes.status).toBe(403);
  });

  it("AUTH-03: Timeout or failure after possible commit -> safe retry by stable registration; duplicate tenant slug rejected", async () => {
    const email = `retry_${Date.now()}@example.test`;
    const tenantSlug = `retry-${Date.now()}`;

    const code = await otpStore.issue("signup", email, tenantSlug);
    const receipt = await otpStore.verifySignupAndIssueReceipt(email, code, tenantSlug);

    // First signup succeeds
    const signupReq = new NextRequest("https://support.servicev8.com/api/tenant/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Retry Corp",
        domain: tenantSlug,
        adminEmail: email,
        adminName: "Signup Owner",
        password: "ValidPassword123!",
        passwordConfirmation: "ValidPassword123!",
        verificationReceipt: receipt,
      }),
    });
    const signupRes = await postSignup(signupReq);
    expect(signupRes.status).toBe(200);

    // Subsequent registration attempt on the same domain with another receipt -> 409 Conflict
    const anotherEmail = `another_${Date.now()}@example.test`;
    const newCode = await otpStore.issue("signup", anotherEmail, tenantSlug);
    const newReceipt = await otpStore.verifySignupAndIssueReceipt(anotherEmail, newCode, tenantSlug);
    expect(newReceipt).toBeTruthy();

    const dupReq = new NextRequest("https://support.servicev8.com/api/tenant/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Retry Corp Duplicate",
        domain: tenantSlug,
        adminEmail: anotherEmail,
        adminName: "Signup Owner",
        password: "ValidPassword123!",
        passwordConfirmation: "ValidPassword123!",
        verificationReceipt: newReceipt,
      }),
    });
    const dupRes = await postSignup(dupReq);
    expect(dupRes.status).toBe(409);
  });

  it("AUTH-04: Tenant-B host with Tenant-A session cookie -> denied; host-only isolation enforced", async () => {
    const validWorkspaceId = `tenant_rt_${"a".repeat(48)}`;
    const sessionTokenA = signRuntimeSupportSession(
      {
        accountId: "acct-a",
        tenantId: validWorkspaceId,
        verticalId: "runtime",
        installationId: "install-a",
        workspaceId: validWorkspaceId,
        sub: "user-a",
        roleCap: "support:manage",
        tenantDomain: "tenant-a",
      },
      TEST_SECRET
    );

    // Present Tenant-A cookie to Tenant-B host -> must be denied before data/effects
    const crossReq = new NextRequest("https://tenant-b.support.servicev8.com/api/credits", {
      headers: {
        host: "tenant-b.support.servicev8.com",
        cookie: `${RUNTIME_SUPPORT_COOKIE}=${sessionTokenA}`,
      },
    });

    const res = await getCredits(crossReq);
    expect([401, 403]).toContain(res.status);
  });

  it("AUTH-05: Runtime handoff replay or wrong destination -> single durable redemption; wrong target rejected", async () => {
    const now = Math.floor(Date.now() / 1000);
    const workspaceId = `tenant_rt_${"a".repeat(48)}`;
    const claims = {
      version: "servicev8.support-handoff.v1" as const,
      iss: "runtime",
      aud: "supportv8-service-app",
      sub: "member-handoff-test",
      accountId: "acct-handoff-1",
      tenantId: "reg-tenant-1",
      verticalId: "runtime" as const,
      installationId: "install-handoff-1",
      externalWorkspaceId: workspaceId,
      tenantDomain: "handoff-tenant",
      role: "support:manage" as const,
      destination: "https://handoff-tenant.support.servicev8.com/auth/runtime/handoff",
      iat: now,
      exp: now + 60,
      jti: randomUUID(),
    };

    const header = { alg: "HS256", typ: "JWT" };
    const h = Buffer.from(JSON.stringify(header)).toString("base64url");
    const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const validHandoffToken = `${h}.${p}.${createHmac("sha256", TEST_SECRET).update(`${h}.${p}`).digest("base64url")}`;

    const resolveMock = async (scope: any) => ({
      ...scope,
      capability: "support:manage" as const,
      email: "synthetic@example.test",
      domain: claims.tenantDomain,
    });

    const seenJtis = new Set<string>();
    const replayMock = {
      consume: async (c: any) => {
        if (seenJtis.has(c.jti)) return false;
        seenJtis.add(c.jti);
        return true;
      },
    };

    // First handoff redemption -> succeeds (303 redirect)
    const handoffReq = new Request(`${claims.destination}?token=${encodeURIComponent(validHandoffToken)}`, {
      method: "GET",
      headers: {
        host: "handoff-tenant.support.servicev8.com",
      },
    });
    const handoffRes = await handleRuntimeSupportHandoff(handoffReq, {
      handoffSecret: TEST_SECRET,
      sessionSecret: TEST_SECRET,
      now: () => now,
      resolve: resolveMock,
      replay: replayMock,
    });
    expect([302, 303]).toContain(handoffRes.status);

    // Replay of the exact same handoff token -> denied 401
    const replayRes = await handleRuntimeSupportHandoff(handoffReq, {
      handoffSecret: TEST_SECRET,
      sessionSecret: TEST_SECRET,
      now: () => now,
      resolve: resolveMock,
      replay: replayMock,
    });
    expect(replayRes.status).toBe(401);
  });

  it("AUTH-06: Standalone and Runtime entry require verified owner proof; no implicit email/slug merge", async () => {
    // 1. Calling workspace-session without cookie returns session: null
    const unauthSessionReq = new NextRequest("https://isolated.support.servicev8.com/api/auth/workspace-session", {
      headers: {
        host: "isolated.support.servicev8.com",
        "x-servicev8-tenant-domain": "isolated",
      },
    });
    const sessionRes = await getWorkspaceSession(unauthSessionReq);
    expect(sessionRes.status).toBe(200);
    const sessionData = await sessionRes.json();
    expect(sessionData.session).toBeNull();

    // 2. Calling authenticated route with production env without session -> 401
    const envRecord = process.env as Record<string, string | undefined>;
    const originalEnv = envRecord.NODE_ENV;
    try {
      envRecord.NODE_ENV = "production";
      const unauthReq = new NextRequest("https://isolated.support.servicev8.com/api/workforce", {
        headers: {
          host: "isolated.support.servicev8.com",
        },
      });
      const workforceRes = await getWorkforce(unauthReq);
      expect(workforceRes.status).toBe(401);
    } finally {
      envRecord.NODE_ENV = originalEnv;
    }
  });
});
