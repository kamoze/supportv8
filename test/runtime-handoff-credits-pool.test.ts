import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/service-app/runtime-session", () => ({
  authorizeRuntimeSupportRequest: auth,
  readRuntimeSupportCookie: (r: Request) =>
    r.headers.get("cookie")?.includes("__Host-sv8_runtime_support=") ? "present" : null,
}));

import { GET as getCredits, POST as postCredits } from "@/app/api/credits/route";
import { GET as getMarketplace, POST as postMarketplace } from "@/app/api/marketplace/route";
import { GET as getWorkspaceSession } from "@/app/api/auth/workspace-session/route";
import { marketplaceService } from "@/lib/services/marketplace-service";

describe("Runtime Handoff Common Pool Credits", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 0 credits when runtime handoff session has no enabled plan, and reflects plan credits once enabled or selected", async () => {
    const accountId = `acct_pool_${Date.now()}`;
    const tenantDomain = `rt-support-${Date.now()}`;
    const workspaceId = `tenant_rt_${"a".repeat(48)}`;

    auth.mockResolvedValue({
      access: { email: "operator@example.test" },
      session: {
        workspaceId,
        tenantDomain,
        accountId,
        sub: "user-test-1",
      },
      role: "support:manage",
    });

    // Test GET /api/credits without an enabled plan -> strictly 0
    const creditsReq = new NextRequest(`https://${tenantDomain}.support.servicev8.com/api/credits`, {
      headers: {
        cookie: "__Host-sv8_runtime_support=test",
        host: `${tenantDomain}.support.servicev8.com`,
      },
    });
    const creditsRes = await getCredits(creditsReq);
    const creditsData = await creditsRes.json();

    expect(creditsData.success).toBe(true);
    expect(creditsData.data.credits).toBe(0);

    // Test GET /api/marketplace without an enabled plan -> strictly 0
    const marketReq = new NextRequest(`https://${tenantDomain}.support.servicev8.com/api/marketplace`, {
      headers: {
        cookie: "__Host-sv8_runtime_support=test",
        host: `${tenantDomain}.support.servicev8.com`,
      },
    });
    const marketRes = await getMarketplace(marketReq);
    const marketData = await marketRes.json();

    expect(marketData.success).toBe(true);
    expect(marketData.data.credits).toBe(0);

    // Now enable/purchase a plan (e.g. Starter tier -> 5000 credits)
    marketplaceService.enablePlanForAccount(accountId, "plan_starter");

    const creditsResAfter = await getCredits(creditsReq);
    const creditsDataAfter = await creditsResAfter.json();
    expect(creditsDataAfter.data.credits).toBe(5000);

    const marketResAfter = await getMarketplace(marketReq);
    const marketDataAfter = await marketResAfter.json();
    expect(marketDataAfter.data.credits).toBe(5000);

    const starterPlan = marketDataAfter.data.plans.find((p: any) => p.id === "plan_starter");
    expect(starterPlan).toBeDefined();
    expect(starterPlan.isCurrent).toBe(true);
    expect(starterPlan.badge).toBe("CURRENT PLAN");

    // Session endpoint also returns inherited pool info
    const sessionReq = new NextRequest(`https://${tenantDomain}.support.servicev8.com/api/auth/workspace-session`, {
      headers: {
        cookie: "__Host-sv8_runtime_support=test",
        host: `${tenantDomain}.support.servicev8.com`,
      },
    });
    const sessionRes = await getWorkspaceSession(sessionReq);
    const sessionData = await sessionRes.json();
    expect(sessionData.success).toBe(true);
    expect(sessionData.session.accountId).toBe(accountId);
    expect(sessionData.session.credits).toBe(5000);
    expect(sessionData.session.plan).toBe("plan_starter");
  });

  it("shares credit pool between multiple workspaces deployed under the same account", async () => {
    const accountId = `acct_shared_${Date.now()}`;
    const domainA = `rt-ws-a-${Date.now()}`;
    const domainB = `rt-ws-b-${Date.now()}`;
    const wsA = `tenant_rt_${"1".repeat(48)}`;
    const wsB = `tenant_rt_${"2".repeat(48)}`;

    marketplaceService.enablePlanForAccount(accountId, "plan_starter");

    // Set auth to workspace A
    auth.mockResolvedValue({
      access: { email: "lead-a@example.test" },
      session: { workspaceId: wsA, tenantDomain: domainA, accountId, sub: "user-a" },
      role: "support:manage",
    });

    // Workspace A deducts 300 credits
    const deductReq = new NextRequest(`https://${domainA}.support.servicev8.com/api/credits`, {
      method: "POST",
      headers: {
        cookie: "__Host-sv8_runtime_support=test",
        host: `${domainA}.support.servicev8.com`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "deduct", amount: 300, reason: "Model completion in ws A" }),
    });
    const deductRes = await postCredits(deductReq);
    const deductData = await deductRes.json();
    expect(deductData.success).toBe(true);
    expect(deductData.data.remaining).toBe(4700);

    // Switch auth to workspace B under SAME account
    auth.mockResolvedValue({
      access: { email: "lead-b@example.test" },
      session: { workspaceId: wsB, tenantDomain: domainB, accountId, sub: "user-b" },
      role: "support:manage",
    });

    // Workspace B checks balance -> reflects the deduction in shared pool
    const checkReqB = new NextRequest(`https://${domainB}.support.servicev8.com/api/credits`, {
      headers: {
        cookie: "__Host-sv8_runtime_support=test",
        host: `${domainB}.support.servicev8.com`,
      },
    });
    const checkResB = await getCredits(checkReqB);
    const checkDataB = await checkResB.json();
    expect(checkDataB.success).toBe(true);
    expect(checkDataB.data.credits).toBe(4700);

    // Also marketplace endpoint on workspace B reflects shared pool
    const marketReqB = new NextRequest(`https://${domainB}.support.servicev8.com/api/marketplace`, {
      headers: {
        cookie: "__Host-sv8_runtime_support=test",
        host: `${domainB}.support.servicev8.com`,
      },
    });
    const marketResB = await getMarketplace(marketReqB);
    const marketDataB = await marketResB.json();
    expect(marketDataB.success).toBe(true);
    expect(marketDataB.data.credits).toBe(4700);
  });

  it("keeps non-runtime customer tenants isolated at 0 credits initially", () => {
    const customerTenant = `clean-customer-${Date.now()}`;
    expect(marketplaceService.getCredits(customerTenant)).toBe(0);
    expect(marketplaceService.getCredits("default")).toBe(0);
  });

  it("allows environment variable override of common pool credits", async () => {
    vi.stubEnv("SUPPORTV8_COMMON_POOL_CREDITS", "7500");
    const accountId = `acct_override_${Date.now()}`;
    const domain = `rt-override-${Date.now()}`;
    const ws = `tenant_rt_${"9".repeat(48)}`;

    auth.mockResolvedValue({
      access: { email: "user@example.test" },
      session: { workspaceId: ws, tenantDomain: domain, accountId, sub: "user-override" },
      role: "support:manage",
    });

    const req = new NextRequest(`https://${domain}.support.servicev8.com/api/credits`, {
      headers: { cookie: "__Host-sv8_runtime_support=test", host: `${domain}.support.servicev8.com` },
    });
    const res = await getCredits(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.credits).toBe(7500);
  });

  it("syncs account pool with Forge Gateway when configured and returns available credits", async () => {
    const accountId = `acct_forge_${Date.now()}`;
    const domain = `rt-forge-${Date.now()}`;
    const ws = `tenant_rt_${"8".repeat(48)}`;

    auth.mockResolvedValue({
      access: { email: "forge-user@example.test" },
      session: { workspaceId: ws, tenantDomain: domain, accountId, sub: "user-forge" },
      role: "support:manage",
    });

    vi.stubEnv("FORGE_GATEWAY_URL", "https://forge.test");
    vi.stubEnv("FORGE_GATEWAY_TOKEN", "test-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subscription: { status: "active", tier: "growth" },
        credits: { available: 8200, serviceActive: true },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest(`https://${domain}.support.servicev8.com/api/credits`, {
      headers: { cookie: "__Host-sv8_runtime_support=test", host: `${domain}.support.servicev8.com` },
    });
    const res = await getCredits(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.credits).toBe(8200);

    vi.unstubAllGlobals();
  });

  it("derives credit balance from active plan tier during Forge Gateway sync, and zeros out on inactive subscription", async () => {
    const accountId = `acct_tier_sync_${Date.now()}`;
    const domain = `rt-tier-sync-${Date.now()}`;
    const ws = `tenant_rt_${"6".repeat(48)}`;

    auth.mockResolvedValue({
      access: { email: "growth-user@example.test" },
      session: { workspaceId: ws, tenantDomain: domain, accountId, sub: "user-growth" },
      role: "support:manage",
    });

    vi.stubEnv("FORGE_GATEWAY_URL", "https://forge.test");
    vi.stubEnv("FORGE_GATEWAY_TOKEN", "test-token");

    // 1. Sync with active "growth" tier without an explicit credits.available -> should derive 27,500
    let fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subscription: { status: "active", tier: "growth" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest(`https://${domain}.support.servicev8.com/api/credits`, {
      headers: { cookie: "__Host-sv8_runtime_support=test", host: `${domain}.support.servicev8.com` },
    });
    let res = await getCredits(req);
    let data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.credits).toBe(27500);

    // 2. Subscription becomes inactive -> balance drops to 0
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subscription: { status: "inactive" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    res = await getCredits(req);
    data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.credits).toBe(0);

    vi.unstubAllGlobals();
  });

  it("fails soft when Forge Gateway is unreachable and falls back to account's enabled plan or 0", async () => {
    const accountId = `acct_forge_down_${Date.now()}`;
    const domain = `rt-forge-down-${Date.now()}`;
    const ws = `tenant_rt_${"7".repeat(48)}`;

    marketplaceService.enablePlanForAccount(accountId, "plan_starter");

    auth.mockResolvedValue({
      access: { email: "user@example.test" },
      session: { workspaceId: ws, tenantDomain: domain, accountId, sub: "user-failsoft" },
      role: "support:manage",
    });

    vi.stubEnv("FORGE_GATEWAY_URL", "https://forge.test");
    vi.stubEnv("FORGE_GATEWAY_TOKEN", "test-token");

    const fetchMock = vi.fn().mockRejectedValue(new Error("Network connection refused"));
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest(`https://${domain}.support.servicev8.com/api/credits`, {
      headers: { cookie: "__Host-sv8_runtime_support=test", host: `${domain}.support.servicev8.com` },
    });
    const res = await getCredits(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.credits).toBe(5000);

    vi.unstubAllGlobals();
  });

  it("links both tenant domain and native workspace ID to the shared account pool", () => {
    const accountId = `acct_dual_${Date.now()}`;
    const domain = `rt-dual-${Date.now()}`;
    const workspaceId = `tenant_rt_${"d".repeat(48)}`;

    marketplaceService.registerRuntimeTenant(domain, accountId, workspaceId);

    expect(marketplaceService.isRuntimeTenant(domain)).toBe(true);
    expect(marketplaceService.isRuntimeTenant(workspaceId)).toBe(true);
    expect(marketplaceService.getCredits(domain)).toBe(0);
    expect(marketplaceService.getCredits(workspaceId)).toBe(0);

    marketplaceService.enablePlanForAccount(accountId, "plan_starter");
    expect(marketplaceService.getCredits(domain)).toBe(5000);
    expect(marketplaceService.getCredits(workspaceId)).toBe(5000);

    marketplaceService.deductCredits(400, "deduct via domain", domain);
    expect(marketplaceService.getCredits(domain)).toBe(4600);
    expect(marketplaceService.getCredits(workspaceId)).toBe(4600);

    marketplaceService.addCredits(100, "topup via workspaceId", workspaceId);
    expect(marketplaceService.getCredits(domain)).toBe(4700);
    expect(marketplaceService.getCredits(workspaceId)).toBe(4700);
  });

  it("inherits credit balance and plan directly from runtime handoff OperationalSupportAccess projection", async () => {
    const poolAccountId = `acct_inherited_${Date.now()}`;
    const domain = `rt-inherit-${Date.now()}`;
    const ws = `tenant_rt_${"e".repeat(48)}`;

    auth.mockResolvedValue({
      access: {
        email: "runtime-lead@example.test",
        domain,
        planId: "plan_scale",
        poolAccountId,
        credits: 38500,
      },
      session: {
        workspaceId: ws,
        tenantDomain: domain,
        accountId: "acct_member_local",
        sub: "user-inherited",
      },
      role: "support:manage",
    });

    // 1. Session endpoint automatically inherits credits and plan
    const sessionReq = new NextRequest(`https://${domain}.support.servicev8.com/api/auth/workspace-session`, {
      headers: {
        cookie: "__Host-sv8_runtime_support=test",
        host: `${domain}.support.servicev8.com`,
      },
    });
    const sessionRes = await getWorkspaceSession(sessionReq);
    const sessionData = await sessionRes.json();

    expect(sessionData.success).toBe(true);
    expect(sessionData.session.accountId).toBe(poolAccountId);
    expect(sessionData.session.credits).toBe(38500);
    expect(sessionData.session.plan).toBe("plan_scale");

    // 2. Credits endpoint reflects the inherited 38,500
    const creditsReq = new NextRequest(`https://${domain}.support.servicev8.com/api/credits`, {
      headers: {
        cookie: "__Host-sv8_runtime_support=test",
        host: `${domain}.support.servicev8.com`,
      },
    });
    const creditsRes = await getCredits(creditsReq);
    const creditsData = await creditsRes.json();

    expect(creditsData.success).toBe(true);
    expect(creditsData.data.credits).toBe(38500);

    // 3. Marketplace endpoint reflects inherited credits and marks plan_scale as isCurrent: true
    const marketReq = new NextRequest(`https://${domain}.support.servicev8.com/api/marketplace`, {
      headers: {
        cookie: "__Host-sv8_runtime_support=test",
        host: `${domain}.support.servicev8.com`,
      },
    });
    const marketRes = await getMarketplace(marketReq);
    const marketData = await marketRes.json();

    expect(marketData.success).toBe(true);
    expect(marketData.data.credits).toBe(38500);

    const scalePlan = marketData.data.plans.find((p: any) => p.id === "plan_scale");
    expect(scalePlan).toBeDefined();
    expect(scalePlan.isCurrent).toBe(true);
    expect(scalePlan.badge).toBe("CURRENT PLAN");
  });

  it("in standalone mode without runtime handoff, credits are derived from the active plan", async () => {
    const domain = `standalone-tenant-${Date.now()}`;

    // 1. Initial standalone state has no current plan and 0 credits
    expect(marketplaceService.getCredits(domain)).toBe(0);

    // 2. Selecting a plan in standalone mode grants that plan's credits
    marketplaceService.selectPlan("plan_starter", domain);
    expect(marketplaceService.getCredits(domain)).toBe(5000);

    const plans = marketplaceService.getPlans(domain);
    const starter = plans.find((p) => p.id === "plan_starter");
    expect(starter?.isCurrent).toBe(true);
  });
});
