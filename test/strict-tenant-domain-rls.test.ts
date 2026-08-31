import { describe, it, expect } from "vitest";
import { credentialStore } from "@/lib/auth/credential-store";
import { issueService } from "@/lib/services/issue-service";
import { problemService } from "@/lib/services/problem-service";
import { insightsService } from "@/lib/services/insights-service";
import { db } from "@/lib/db/mock-data";

describe("Strict Tenant Domain Isolation & Row-Level Security (RLS)", () => {
  describe("1. Strict Tenant Authentication & Cross-Domain Boundary Checks", () => {
    it("should REJECT cross-tenant login attempts (acme-movers account logging into acme domain)", async () => {
      const email = "admin@acme-movers.com";
      const pass = "SupportV8#2026!Secure";
      const targetTenant = "acme"; // Attempting to login to acme workspace

      const result = await credentialStore.authenticate(email, pass, targetTenant);

      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toContain("Cross-tenant access denied");
      expect(result.error).toContain("acme-movers");
      expect(result.error).toContain("acme");
      expect(result.error).toContain("Row-Level Security");
    });

    it("should REJECT meridian contractor account logging into acme domain", async () => {
      const email = "dispatch@meridian.com";
      const pass = "SupportV8#2026!Secure";
      const targetTenant = "acme";

      const result = await credentialStore.authenticate(email, pass, targetTenant);

      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toContain("Cross-tenant access denied");
    });

    it("should ALLOW same-tenant login for acme-movers admin to acme-movers domain", async () => {
      const email = "admin@acme-movers.com";
      const pass = "SupportV8#2026!Secure";
      const targetTenant = "acme-movers";

      const result = await credentialStore.authenticate(email, pass, targetTenant);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.tenantSlug).toBe("acme-movers");
      expect(result.user?.email).toBe("admin@acme-movers.com");
    });

    it("should ALLOW same-tenant login for acme operator to acme domain", async () => {
      const email = "david.kim@acme.com";
      const pass = "SupportV8#2026!Secure";
      const targetTenant = "acme";

      const result = await credentialStore.authenticate(email, pass, targetTenant);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.tenantSlug).toBe("acme");
    });
  });

  describe("2. Row-Level Security (RLS) on Tenant Data Services", () => {
    it("should isolate issues between tenants (acme vs acme-movers vs meridian)", () => {
      const acmeIssues = issueService.getAll({ tenant: "acme" });
      const meridianIssues = issueService.getAll({ tenant: "meridian" });
      const acmeMoversIssues = issueService.getAll({ tenant: "acme-movers" });

      // Acme issues should be present and contain non-contractor issues
      expect(acmeIssues.length).toBeGreaterThan(0);
      acmeIssues.forEach((i) => {
        expect(i.category?.includes("contractor") && i.tags?.includes("contractor")).toBe(false);
      });

      // Meridian issues should only be contractor/logistics issues
      expect(meridianIssues.length).toBeGreaterThan(0);
      meridianIssues.forEach((i) => {
        const isContractor = i.category?.includes("contractor") || i.tags?.includes("contractor") || i.entityType === "contractor";
        expect(isContractor).toBe(true);
      });

      // Acme Movers dynamic tenant should start with isolated/empty dataset
      expect(acmeMoversIssues.length).toBe(0);
    });

    it("should isolate problems between tenants", () => {
      const acmeProblems = problemService.getAll("acme");
      const acmeMoversProblems = problemService.getAll("acme-movers");

      expect(acmeProblems.length).toBeGreaterThan(0);
      expect(acmeMoversProblems.length).toBe(0);
    });

    it("should isolate actionable insights between tenants", () => {
      const acmeInsights = insightsService.getAll("acme");
      const acmeMoversInsights = insightsService.getAll("acme-movers");

      expect(acmeInsights.length).toBeGreaterThan(0);
      expect(acmeMoversInsights.length).toBe(0);
    });

    it("should dynamically isolate newly added issues to their specific tenant", () => {
      const newMoversIssue: any = {
        id: "ISS-MOVERS-001",
        tenantId: "tenant_acme-movers",
        source: "zendesk",
        externalId: "MOV-9001",
        customerRef: "CUST-9001",
        customerName: "Moving Customer",
        customerTier: "pro",
        summary: "Truck dispatch delayed by 2 hours",
        sentiment: "neutral",
        status: "open",
        priority: "medium",
        tags: ["moving", "dispatch"],
        createdAt: new Date().toISOString(),
      };

      db.addIssue(newMoversIssue, "acme-movers");

      const acmeMoversData = issueService.getAll({ tenant: "acme-movers" });
      const acmeData = issueService.getAll({ tenant: "acme" });

      expect(acmeMoversData.map((i) => i.id)).toContain("ISS-MOVERS-001");
      // Must not leak into default acme tenant
      expect(acmeData.map((i) => i.id)).not.toContain("ISS-MOVERS-001");
    });
  });
});
