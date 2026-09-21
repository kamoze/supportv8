import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { verticalHandoff } from "@/lib/verticals/handoff";
import { verticalClients } from "@/lib/verticals/vertical-clients";
import { GET as getCredits, POST as postCredits } from "@/app/api/credits/route";
import { GET as getHandoff, POST as postHandoff } from "@/app/api/handoff/route";

describe("Cross-Vertical Source Handoff & Bound Apps Shared Credit Pool", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("binds servicev8-runtime and all declared apps to the shared credit pool on runtime source handoff", () => {
    const accountId = `acct_rt_${Date.now()}`;
    const workspaceId = `tenant_rt_${"e".repeat(48)}`;
    const tenantDomain = `rt-source-${Date.now()}`;

    const reg = marketplaceService.registerSourceHandoff({
      sourceVertical: "servicev8-runtime",
      targetVertical: "supportv8",
      accountId,
      workspaceId,
      tenantSlug: tenantDomain,
      boundApps: ["orderv8", "carev8"],
      planId: "plan_starter", // 5,000 credits
    });

    expect(reg.accountId).toBe(accountId);
    expect(reg.sharedCredits).toBe(5000);
    expect(reg.boundApps).toContain("servicev8-runtime");
    expect(reg.boundApps).toContain("supportv8");
    expect(reg.boundApps).toContain("orderv8");
    expect(reg.boundApps).toContain("carev8");

    // Every bound app resolves to the same 5,000 credit pool
    expect(marketplaceService.getCredits(tenantDomain)).toBe(5000);
    expect(marketplaceService.getCredits(workspaceId)).toBe(5000);
    expect(marketplaceService.getCredits("orderv8")).toBe(5000);
    expect(marketplaceService.getCredits("carev8")).toBe(5000);
    expect(marketplaceService.getCredits("servicev8-runtime")).toBe(5000);
    expect(marketplaceService.getCredits("supportv8")).toBe(5000);
  });

  it("binds vertical apps to the shared credit pool on vertical source handoff (e.g. from orderv8)", () => {
    const accountId = `acct_order_${Date.now()}`;
    const tenantDomain = `order-ws-${Date.now()}`;

    // Create a source handoff token from orderv8 to supportv8
    const { token, payload } = verticalHandoff.createHandoffToken({
      sourceVertical: "orderv8",
      targetVertical: "supportv8",
      tenantId: tenantDomain,
      accountId,
      boundApps: ["orderv8", "supportv8", "propv8"],
      planId: "plan_growth", // 27,500 credits
      customerRef: "CUST-9901",
      summary: "High-value enterprise order handoff",
    });

    expect(token).toBeDefined();
    expect(payload.sourceVertical).toBe("orderv8");

    // All bound apps now share the 27,500 credit pool
    expect(marketplaceService.getCredits(tenantDomain)).toBe(27500);
    expect(marketplaceService.getCredits("orderv8")).toBe(27500);
    expect(marketplaceService.getCredits("supportv8")).toBe(27500);
    expect(marketplaceService.getCredits("propv8")).toBe(27500);
  });

  it("shares credit deductions across all bound apps in real time", async () => {
    const accountId = `acct_shared_deduct_${Date.now()}`;
    const tenantDomain = `cross-app-${Date.now()}`;

    marketplaceService.registerSourceHandoff({
      sourceVertical: "servicev8-runtime",
      targetVertical: "supportv8",
      accountId,
      tenantSlug: tenantDomain,
      boundApps: ["orderv8", "carev8", "dominion"],
      planId: "plan_starter", // 5,000 credits
    });

    // 1. orderv8 performs an action and deducts 500 credits
    const orderDeduction = marketplaceService.deductCredits(500, "Order fulfillment inference", "orderv8");
    expect(orderDeduction.deducted).toBe(500);
    expect(orderDeduction.remaining).toBe(4500);

    // 2. supportv8 immediately observes the deducted balance
    expect(marketplaceService.getCredits("supportv8")).toBe(4500);
    expect(marketplaceService.getCredits(tenantDomain)).toBe(4500);

    // 3. carev8 executes a cross-vertical dispatch costing 300 credits
    const careResult = await verticalClients.dispatch({
      vertical: "carev8",
      operation: "appointment.list",
      payload: { patientId: "PAT-7712" },
      accountId,
      creditsCost: 300,
    });
    expect(careResult.success).toBe(true);
    expect(careResult.creditsRemaining).toBe(4200);

    // 4. dominion and servicev8-runtime reflect 4,200 remaining credits
    expect(marketplaceService.getCredits("dominion")).toBe(4200);
    expect(marketplaceService.getCredits("servicev8-runtime")).toBe(4200);
    expect(marketplaceService.getCredits("orderv8")).toBe(4200);
  });

  it("shares top-ups and plan upgrades across all bound apps", () => {
    const accountId = `acct_topup_${Date.now()}`;
    const tenantDomain = `topup-ws-${Date.now()}`;

    marketplaceService.registerSourceHandoff({
      sourceVertical: "growthv8",
      targetVertical: "supportv8",
      accountId,
      tenantSlug: tenantDomain,
      boundApps: ["growthv8", "workerv8"],
      planId: "plan_starter", // 5,000 credits
    });

    expect(marketplaceService.getCredits("growthv8")).toBe(5000);
    expect(marketplaceService.getCredits("workerv8")).toBe(5000);

    // Add 1,200 credits via supportv8
    marketplaceService.addCredits(1200, "Enterprise top-up", "supportv8", { accountId });

    expect(marketplaceService.getCredits("growthv8")).toBe(6200);
    expect(marketplaceService.getCredits("workerv8")).toBe(6200);
    expect(marketplaceService.getCredits(tenantDomain)).toBe(6200);

    // Upgrade plan to Growth (27,500 allowance)
    marketplaceService.selectPlan("plan_growth", tenantDomain, { accountId });

    expect(marketplaceService.getCredits("growthv8")).toBe(27500);
    expect(marketplaceService.getCredits("workerv8")).toBe(27500);
    expect(marketplaceService.getCredits("supportv8")).toBe(27500);
  });

  it("starts at 0 credits when source handoff has no enabled plan, until plan is purchased or enabled", () => {
    const accountId = `acct_zero_plan_${Date.now()}`;
    const tenantDomain = `zero-plan-${Date.now()}`;

    marketplaceService.registerSourceHandoff({
      sourceVertical: "carev8",
      targetVertical: "supportv8",
      accountId,
      tenantSlug: tenantDomain,
      boundApps: ["carev8", "orderv8"],
      // no planId supplied
    });

    // Zero-credit baseline
    expect(marketplaceService.getCredits(tenantDomain)).toBe(0);
    expect(marketplaceService.getCredits("carev8")).toBe(0);
    expect(marketplaceService.getCredits("orderv8")).toBe(0);
    expect(marketplaceService.getCredits("supportv8")).toBe(0);

    // Once a plan is enabled for the account
    marketplaceService.enablePlanForAccount(accountId, "plan_starter");

    expect(marketplaceService.getCredits(tenantDomain)).toBe(5000);
    expect(marketplaceService.getCredits("carev8")).toBe(5000);
    expect(marketplaceService.getCredits("orderv8")).toBe(5000);
    expect(marketplaceService.getCredits("supportv8")).toBe(5000);
  });

  it("isolates bound apps of different accounts from each other", () => {
    const acctA = `acct_iso_a_${Date.now()}`;
    const acctB = `acct_iso_b_${Date.now()}`;
    const domainA = `ws-iso-a-${Date.now()}`;
    const domainB = `ws-iso-b-${Date.now()}`;

    marketplaceService.registerSourceHandoff({
      sourceVertical: "orderv8",
      targetVertical: "supportv8",
      accountId: acctA,
      tenantSlug: domainA,
      planId: "plan_starter", // 5,000
    });

    marketplaceService.registerSourceHandoff({
      sourceVertical: "carev8",
      targetVertical: "supportv8",
      accountId: acctB,
      tenantSlug: domainB,
      planId: "plan_growth", // 27,500
    });

    expect(marketplaceService.getCredits(domainA)).toBe(5000);
    expect(marketplaceService.getCredits(domainB)).toBe(27500);

    // Deduct 1,000 from account A
    marketplaceService.deductCredits(1000, "Account A usage", domainA, { accountId: acctA });

    expect(marketplaceService.getCredits(domainA)).toBe(4000);
    expect(marketplaceService.getCredits(domainB)).toBe(27500); // unaffected
  });

  it("handles source handoffs via HTTP /api/handoff POST and GET routes", async () => {
    const accountId = `acct_api_${Date.now()}`;
    const tenantDomain = `api-handoff-${Date.now()}`;

    // 1. POST /api/handoff creating a handoff token
    const createReq = new NextRequest("https://support.servicev8.internal/api/handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceVertical: "orderv8",
        targetVertical: "supportv8",
        tenantId: tenantDomain,
        accountId,
        boundApps: ["orderv8", "dominion"],
        planId: "plan_starter",
        summary: "Order assistance required",
      }),
    });
    const createRes = await postHandoff(createReq);
    const createData = await createRes.json();

    expect(createData.success).toBe(true);
    expect(createData.sharedCredits).toBe(5000);
    const token = createData.data.token;
    expect(token).toBeDefined();

    // 2. GET /api/handoff?token=... accepts the handoff and verifies shared credit pool
    const getReq = new NextRequest(`https://support.servicev8.internal/api/handoff?token=${token}`);
    const getRes = await getHandoff(getReq);
    const getData = await getRes.json();

    expect(getData.success).toBe(true);
    expect(getData.sharedCredits).toBe(5000);
    expect(getData.boundApps).toContain("orderv8");
    expect(getData.boundApps).toContain("dominion");

    // 3. GET /api/handoff?accountId=... inspects bound apps and pool balance
    const checkReq = new NextRequest(`https://support.servicev8.internal/api/handoff?accountId=${accountId}`);
    const checkRes = await getHandoff(checkReq);
    const checkData = await checkRes.json();

    expect(checkData.success).toBe(true);
    expect(checkData.data.sharedCredits).toBe(5000);
    expect(checkData.data.boundApps).toContain("orderv8");
  });

  it("handles credit checks and deductions through /api/credits when authenticated with source vertical headers", async () => {
    const accountId = `acct_hdr_${Date.now()}`;
    const tenantDomain = `hdr-tenant-${Date.now()}`;

    // Register handoff with Starter plan
    marketplaceService.registerSourceHandoff({
      sourceVertical: "carev8",
      targetVertical: "supportv8",
      accountId,
      tenantSlug: tenantDomain,
      boundApps: ["carev8", "propv8"],
      planId: "plan_starter", // 5,000
    });

    // GET /api/credits with source handoff headers
    const req = new NextRequest(`https://${tenantDomain}.support.servicev8.com/api/credits`, {
      headers: {
        "x-servicev8-source": "carev8",
        "x-servicev8-account-id": accountId,
        "x-servicev8-bound-app": "propv8",
        host: `${tenantDomain}.support.servicev8.com`,
      },
    });
    const res = await getCredits(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.data.credits).toBe(5000);

    // POST /api/credits to deduct from the shared pool
    const deductReq = new NextRequest(`https://${tenantDomain}.support.servicev8.com/api/credits`, {
      method: "POST",
      headers: {
        "x-servicev8-source": "carev8",
        "x-servicev8-account-id": accountId,
        "x-servicev8-bound-app": "propv8",
        host: `${tenantDomain}.support.servicev8.com`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "deduct", amount: 750, reason: "Care telehealth session" }),
    });
    const deductRes = await postCredits(deductReq);
    const deductData = await deductRes.json();

    expect(deductData.success).toBe(true);
    expect(deductData.data.remaining).toBe(4250);

    // Both carev8 and propv8 and the domain reflect 4,250
    expect(marketplaceService.getCredits(tenantDomain)).toBe(4250);
    expect(marketplaceService.getCredits("carev8")).toBe(4250);
    expect(marketplaceService.getCredits("propv8")).toBe(4250);
  });
});
