import { describe, it, expect } from "vitest";
import { marketplaceService } from "../src/lib/services/marketplace-service";

describe("Marketplace & Governance Suite", () => {
  it("starts a customer tenant with no plan, credits, subscriptions, hires, or members", () => {
    const tenant = `clean-market-${Date.now()}`;
    expect(marketplaceService.getCredits(tenant)).toBe(0);
    expect(marketplaceService.getPlans(tenant).some((plan) => plan.isCurrent)).toBe(false);
    expect(marketplaceService.getConnectors(tenant).some((connector) => connector.isSubscribed)).toBe(false);
    expect(marketplaceService.getWorkforceCatalog(tenant).some((employee) => employee.isHired)).toBe(false);
    expect(marketplaceService.getMembers(tenant)).toEqual([]);
  });

  it("keeps marketplace mutations isolated to one tenant", () => {
    const alpha = `market-alpha-${Date.now()}`;
    const beta = `market-beta-${Date.now()}`;
    marketplaceService.addCredits(500, "test", alpha);
    marketplaceService.hireWorkforceAgent("emp_support_lead", alpha);
    marketplaceService.selectPlan("plan_growth", alpha);

    expect(marketplaceService.getCredits(alpha)).toBe(500);
    expect(marketplaceService.getCredits(beta)).toBe(0);
    expect(marketplaceService.getWorkforceCatalog(beta).some((employee) => employee.isHired)).toBe(false);
    expect(marketplaceService.getPlans(beta).some((plan) => plan.isCurrent)).toBe(false);
  });

  it("should list all available connectors and support 1-click subscription", () => {
    const connectors = marketplaceService.getConnectors();
    expect(connectors.length).toBeGreaterThanOrEqual(8);

    const zendesk = connectors.find((c) => c.id === "conn_zendesk");
    expect(zendesk).toBeDefined();
    expect(zendesk?.isSubscribed).toBe(true);

    const salesforce = marketplaceService.toggleConnector("conn_salesforce", true);
    expect(salesforce.isSubscribed).toBe(true);
    expect(salesforce.status).toBe("active");
  });

  it("should allow hiring specialized AI Employees & Interns", () => {
    const workforce = marketplaceService.getWorkforceCatalog();
    expect(workforce.length).toBeGreaterThanOrEqual(6);

    const eleanor = workforce.find((w) => w.id === "emp_compliance_officer");
    expect(eleanor).toBeDefined();

    const hired = marketplaceService.hireWorkforceAgent("emp_compliance_officer");
    expect(hired.isHired).toBe(true);
    expect(hired.avatarUrl).toContain("beaver-eleanor.jpg");
  });

  it("should switch subscription tiers between Trial, Starter, Growth, Scale, and Enterprise", () => {
    const plans = marketplaceService.getPlans();
    expect(plans.length).toBe(5);

    const growth = marketplaceService.selectPlan("plan_growth");
    expect(growth.isCurrent).toBe(true);
    expect(growth.aiEmployeeSeats).toBe(4);

    const allPlans = marketplaceService.getPlans();
    const starter = allPlans.find((p) => p.id === "plan_starter");
    expect(starter?.isCurrent).toBe(false);
  });

  it("should invite and register tenant team members with RBAC roles", () => {
    const newMember = marketplaceService.inviteMember(
      "Jordan Miller",
      "jordan.m@acme.com",
      "CX Operations Lead"
    );

    expect(newMember.id).toBeDefined();
    expect(newMember.email).toBe("jordan.m@acme.com");
    expect(newMember.status).toBe("invited");

    const members = marketplaceService.getMembers();
    expect(members.some((m) => m.email === "jordan.m@acme.com")).toBe(true);
  });

  it("should update tenant governance infrastructure settings", () => {
    const updated = marketplaceService.updateSettings({
      workspaceName: "Acme Global Scale",
      dataRetentionDays: 180,
    });

    expect(updated.workspaceName).toBe("Acme Global Scale");
    expect(updated.dataRetentionDays).toBe(180);
    expect(updated.postgresRlsEnabled).toBe(true);
  });
});
