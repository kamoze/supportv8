import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { canonicalSupportNavigation, filterNavigationForRole } from "@/lib/platform/navigation";
import { NextRequest } from "next/server";
import { POST as postMarketplace } from "@/app/api/marketplace/route";
import * as runtimeSession from "@/lib/service-app/runtime-session";

describe("NAV-01 & NAV-02: Common Shell & Route Permissions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("NAV-01: Common menu groups and items conform to canonical ServiceV8 specification", () => {
    // 1. Verify navigation groups order: Workforce, Governance, Marketplace, Settings
    const titles = canonicalSupportNavigation.map((s) => s.title);
    expect(titles).toContain("Workforce");
    expect(titles).toContain("Governance");
    expect(titles).toContain("Marketplace");
    expect(titles).toContain("Settings");

    const workforceIndex = titles.indexOf("Workforce");
    const governanceIndex = titles.indexOf("Governance");
    const marketplaceIndex = titles.indexOf("Marketplace");
    const settingsIndex = titles.indexOf("Settings");

    expect(workforceIndex).toBeLessThan(governanceIndex);
    expect(governanceIndex).toBeLessThan(marketplaceIndex);
    expect(marketplaceIndex).toBeLessThan(settingsIndex);

    // 2. Workforce contains Workforce, AgenticOS Chat, Workflows
    const workforceSection = canonicalSupportNavigation.find((s) => s.title === "Workforce")!;
    const workforceLabels = workforceSection.items.map((i) => i.label);
    expect(workforceLabels).toContain("Workforce");
    expect(workforceLabels).toContain("AgenticOS Chat");
    expect(workforceLabels).toContain("Workflows");

    // 3. Governance contains separate Audits and Logs
    const governanceSection = canonicalSupportNavigation.find((s) => s.title === "Governance")!;
    const governanceLabels = governanceSection.items.map((i) => i.label);
    expect(governanceLabels).toContain("Audits");
    expect(governanceLabels).toContain("Logs");

    // 4. Marketplace contains Browse Marketplace, Installed Products, Connectors
    const marketplaceSection = canonicalSupportNavigation.find((s) => s.title === "Marketplace")!;
    const marketplaceLabels = marketplaceSection.items.map((i) => i.label);
    expect(marketplaceLabels).toContain("Browse Marketplace");
    expect(marketplaceLabels).toContain("Installed Products");
    expect(marketplaceLabels).toContain("Connectors");

    // 5. Settings contains Company Details, User Management, API Keys, Plans and Credits
    const settingsSection = canonicalSupportNavigation.find((s) => s.title === "Settings")!;
    const settingsLabels = settingsSection.items.map((i) => i.label);
    expect(settingsLabels).toContain("Company Details");
    expect(settingsLabels).toContain("User Management");
    expect(settingsLabels).toContain("API Keys");
    expect(settingsLabels).toContain("Plans and Credits");

    // 6. Invariant: Every label across all sections must be <= 2 content words (excluding conjunctions)
    for (const section of canonicalSupportNavigation) {
      for (const item of section.items) {
        const words = item.label.trim().split(/\s+/).filter((w) => w !== "and" && w !== "&");
        expect(words.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("NAV-01 (role-protection): Direct mutation routes enforce role authorization server-side", async () => {
    const validWorkspaceId = `tenant_rt_${"b".repeat(48)}`;

    // Spy on authorizeRuntimeSupportRequest to return a verified read-only viewer session
    vi.spyOn(runtimeSession, "authorizeRuntimeSupportRequest").mockResolvedValue({
      session: {
        accountId: "acct-viewer",
        tenantId: "reg-viewer",
        verticalId: "runtime",
        installationId: "install-viewer",
        workspaceId: validWorkspaceId,
        sub: "user-viewer",
        roleCap: "support:read",
        tenantDomain: "viewer-tenant",
        version: "servicev8.support-session.v1",
        aud: "supportv8-runtime-session",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      role: "support:read",
      access: {
        accountId: "acct-viewer",
        tenantId: "reg-viewer",
        verticalId: "runtime",
        installationId: "install-viewer",
        workspaceId: validWorkspaceId,
        subject: "user-viewer",
        capability: "support:read",
        email: "viewer@viewer-tenant.test",
        domain: "viewer-tenant",
      },
    });

    // Read-only viewer attempts mutation on settings via POST /api/marketplace -> denied 403
    const mutateReq = new NextRequest("https://viewer-tenant.support.servicev8.com/api/marketplace", {
      method: "POST",
      headers: {
        host: "viewer-tenant.support.servicev8.com",
        cookie: `${runtimeSession.RUNTIME_SUPPORT_COOKIE}=mock-viewer-session`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "select_plan", planId: "plan_scale" }),
    });

    const res = await postMarketplace(mutateReq);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("read only");
  });

  it("NAV-02: Role filtering and portal isolation hides administrative items from viewers/observers", () => {
    const viewerNav = filterNavigationForRole(canonicalSupportNavigation, "support:read");
    const settingsSection = viewerNav.find((s) => s.title === "Settings");
    expect(settingsSection).toBeDefined();

    // Viewers cannot manage users or API keys in navigation
    const labels = settingsSection!.items.map((i) => i.label);
    expect(labels).not.toContain("API Keys");
  });
});
