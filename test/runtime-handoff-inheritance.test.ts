import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  verifyRuntimeSupportHandoffToken,
  type RuntimeSupportHandoffClaims,
} from "@/lib/service-app/runtime-handoff-claims";
import { handleRuntimeSupportHandoff } from "@/lib/service-app/runtime-handoff";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { GET as getWorkspaceSession } from "@/app/api/auth/workspace-session/route";
import { GET as getMarketplace } from "@/app/api/marketplace/route";
import { GET as getCredits, POST as postCredits } from "@/app/api/credits/route";
import { NextRequest } from "next/server";

const secret = "handoff-secret-that-is-at-least-thirty-two-bytes";
const sessionSecret = "session-secret-that-is-at-least-thirty-two-bytes";
const now = 1_800_000_000;

function createTestJwt(
  claims: Record<string, unknown>,
  testSecret = secret
): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const s = createHmac("sha256", testSecret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}

describe("SupportV8 Runtime Handoff Credits Pool & Plan Inheritance", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifyRuntimeSupportHandoffToken accepts known optional claims (planId, credits, poolAccountId, boundApps) and rejects unknown fields", () => {
    const workspaceId = `tenant_rt_${"b".repeat(48)}`;
    const baseClaims: RuntimeSupportHandoffClaims = {
      version: "servicev8.support-handoff.v1",
      iss: "runtime",
      aud: "supportv8-service-app",
      sub: "member-tok-1",
      accountId: "acct-tok-1",
      tenantId: "registry-tok-1",
      verticalId: "runtime",
      installationId: "install-tok-1",
      externalWorkspaceId: workspaceId,
      tenantDomain: "synth-token-domain",
      role: "support:manage",
      destination: "https://synth-token-domain.support.servicev8.com/auth/runtime/handoff",
      iat: now - 2,
      exp: now + 50,
      jti: randomUUID(),
    };

    // 1. Valid token with optional fields
    const enrichedClaims = {
      ...baseClaims,
      planId: "plan_scale",
      credits: 45000,
      poolAccountId: "acct_pool_parent",
      boundApps: ["servicev8-runtime", "runtime", "supportv8", "orderv8"],
    };
    const token = createTestJwt(enrichedClaims);
    const verified = verifyRuntimeSupportHandoffToken(token, secret, now);
    expect(verified).not.toBeNull();
    expect(verified?.planId).toBe("plan_scale");
    expect(verified?.credits).toBe(45000);
    expect(verified?.poolAccountId).toBe("acct_pool_parent");
    expect(verified?.boundApps).toEqual(["servicev8-runtime", "runtime", "supportv8", "orderv8"]);

    // 2. Rejects token with unknown arbitrary field
    const invalidExtraToken = createTestJwt({
      ...baseClaims,
      extraUnknownField: "not-allowed",
    });
    expect(verifyRuntimeSupportHandoffToken(invalidExtraToken, secret, now)).toBeNull();

    // 3. Rejects token with negative credits
    const negativeCreditsToken = createTestJwt({
      ...baseClaims,
      credits: -500,
    });
    expect(verifyRuntimeSupportHandoffToken(negativeCreditsToken, secret, now)).toBeNull();
  });

  it("inherits credit pool, balance, and plan during handleRuntimeSupportHandoff admission", async () => {
    const workspaceId = `tenant_rt_${"c".repeat(48)}`;
    const domain = `synth-handoff-${Date.now()}`;
    const poolAccountId = `acct_pool_${Date.now()}`;
    const memberId = `member_${Date.now()}`;

    const tokenClaims: RuntimeSupportHandoffClaims = {
      version: "servicev8.support-handoff.v1",
      iss: "runtime",
      aud: "supportv8-service-app",
      sub: memberId,
      accountId: "acct-sub-1",
      tenantId: "registry-sub-1",
      verticalId: "runtime",
      installationId: "install-sub-1",
      externalWorkspaceId: workspaceId,
      tenantDomain: domain,
      role: "support:manage",
      destination: `https://${domain}.support.servicev8.com/auth/runtime/handoff`,
      iat: now - 1,
      exp: now + 50,
      jti: randomUUID(),
      planId: "plan_starter",
      credits: 4800,
      poolAccountId,
    };

    const accessProjection = {
      accountId: tokenClaims.accountId,
      tenantId: tokenClaims.tenantId,
      verticalId: "runtime" as const,
      installationId: tokenClaims.installationId,
      workspaceId,
      subject: memberId,
      capability: "support:manage" as const,
      email: "lead@acme.runtime",
      domain,
      planId: "plan_starter",
      poolAccountId,
      credits: 4800,
    };

    const token = createTestJwt(tokenClaims);
    const req = new Request(`https://${domain}.support.servicev8.com/auth/runtime/handoff?token=${encodeURIComponent(token)}`, {
      headers: { host: `${domain}.support.servicev8.com` },
    });

    const response = await handleRuntimeSupportHandoff(req, {
      handoffSecret: secret,
      sessionSecret,
      now: () => now,
      replay: { consume: vi.fn(async () => true) },
      resolve: vi.fn(async () => accessProjection),
    });

    // 1. Must redirect to cockpit with cookie
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?view=cockpit&handoff=runtime");
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toMatch(/^__Host-sv8_runtime_support=/);

    // 2. Shared credit pool and plan are immediately inherited in marketplaceService
    expect(marketplaceService.getCredits(domain)).toBe(4800);
    expect(marketplaceService.getCredits(workspaceId)).toBe(4800);
    expect(marketplaceService.getCredits("servicev8-runtime", { accountId: poolAccountId })).toBe(4800);
    expect(marketplaceService.getCredits("supportv8", { accountId: poolAccountId })).toBe(4800);
    expect(marketplaceService.getAccountPlan(poolAccountId)).toBe("plan_starter");

    // 3. Bound apps are properly registered
    const boundApps = marketplaceService.getBoundApps(poolAccountId);
    expect(boundApps).toContain("servicev8-runtime");
    expect(boundApps).toContain("runtime");
    expect(boundApps).toContain("supportv8");

    // 4. marketplaceService.getPlans returns active plan marked with isCurrent: true
    const plans = marketplaceService.getPlans(domain, { accountId: poolAccountId });
    const starterPlan = plans.find((p) => p.id === "plan_starter");
    expect(starterPlan).toBeDefined();
    expect(starterPlan?.isCurrent).toBe(true);
    expect(starterPlan?.badge).toBe("CURRENT PLAN");
  });

  it("preserves zero-credits baseline when handoff has no plan and no credits", async () => {
    const workspaceId = `tenant_rt_${"f".repeat(48)}`;
    const domain = `synth-zero-${Date.now()}`;
    const poolAccountId = `acct_zero_${Date.now()}`;

    const tokenClaims: RuntimeSupportHandoffClaims = {
      version: "servicev8.support-handoff.v1",
      iss: "runtime",
      aud: "supportv8-service-app",
      sub: "member-zero",
      accountId: "acct-zero-raw",
      tenantId: "registry-zero",
      verticalId: "runtime",
      installationId: "install-zero",
      externalWorkspaceId: workspaceId,
      tenantDomain: domain,
      role: "support:manage",
      destination: `https://${domain}.support.servicev8.com/auth/runtime/handoff`,
      iat: now - 1,
      exp: now + 50,
      jti: randomUUID(),
      poolAccountId,
      // No planId, no credits
    };

    const token = createTestJwt(tokenClaims);
    const req = new Request(`https://${domain}.support.servicev8.com/auth/runtime/handoff?token=${encodeURIComponent(token)}`, {
      headers: { host: `${domain}.support.servicev8.com` },
    });

    const response = await handleRuntimeSupportHandoff(req, {
      handoffSecret: secret,
      sessionSecret,
      now: () => now,
      replay: { consume: vi.fn(async () => true) },
      resolve: vi.fn(async () => ({
        accountId: tokenClaims.accountId,
        tenantId: tokenClaims.tenantId,
        verticalId: "runtime" as const,
        installationId: tokenClaims.installationId,
        workspaceId,
        subject: "member-zero",
        capability: "support:manage" as const,
        email: "zero@example.test",
        domain,
        poolAccountId,
      })),
    });

    expect(response.status).toBe(303);
    // Zero credit baseline: unconfigured account must NOT receive default or trial credits
    expect(marketplaceService.getCredits(domain)).toBe(0);
    expect(marketplaceService.getCredits(workspaceId)).toBe(0);
    expect(marketplaceService.getCredits("supportv8", { accountId: poolAccountId })).toBe(0);
  });
});
