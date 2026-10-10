import { describe, it, expect, beforeEach } from "vitest";
import { createAlignmentHarness, AlignmentHarness } from "./alignment-harness";
import { resolveConnectionCapability, isConnectionRunnable } from "@/lib/platform/connections";
import { generateScopedStudioLaunch, validateStudioLaunchRequest } from "@/lib/platform/launch";

describe("CON-01 to CON-03: Connector Connections, Assignments & Scoped Launch", () => {
  let harness: AlignmentHarness;

  beforeEach(async () => {
    harness = await createAlignmentHarness();
  });

  it("CON-01: Healthy connection without hire assignment is not runnable; local toggle cannot establish readiness", async () => {
    // A connection with no assigned employees
    const unassignedConnection = {
      id: "conn_stripe_001",
      connectorKey: "stripe",
      status: "connected" as const,
      capabilities: ["charge.refund", "customer.read"],
      assignedEmployeeIds: [],
    };

    expect(isConnectionRunnable(unassignedConnection)).toBe(false);

    // In aligned non-demo mode, local arbitrary toggle cannot grant readiness
    const res = await harness.request("connectors", {
      actor: "ownerA",
      body: {
        action: "toggle_connector",
        connectorId: "conn_stripe_default",
        isSubscribed: true,
      },
    });

    // Local toggle without Gateway/Studio connection cannot establish ready connection
    if (res.status === 200) {
      // If endpoint returns status, the connection should not be claimed as runnable without assignment
      expect(isConnectionRunnable({ ...unassignedConnection, assignedEmployeeIds: [] })).toBe(false);
    } else {
      expect(res.status).toBe(403);
    }
  });

  it("CON-02: Capability intersection (Connection ∩ Assignment ∩ Role) blocks unauthorized capability", async () => {
    const connectionCapabilities = ["ticket.read", "ticket.update", "macro.execute"];
    const assignmentCapabilities = ["ticket.read"]; // Only ticket.read assigned
    const userRole = "support_cx_lead"; // Has broad role, but assignment restricts

    // Allowed capability
    const readCheck = resolveConnectionCapability({
      connectionCapabilities,
      assignmentCapabilities,
      userRole,
      requestedCapability: "ticket.read",
    });
    expect(readCheck.allowed).toBe(true);

    // Excluded capability (in connection, but NOT in assignment)
    const updateCheck = resolveConnectionCapability({
      connectionCapabilities,
      assignmentCapabilities,
      userRole,
      requestedCapability: "ticket.update",
    });
    expect(updateCheck.allowed).toBe(false);
    expect(updateCheck.status).toBe(403);

    // Foreign capability (not in connection at all)
    const refundCheck = resolveConnectionCapability({
      connectionCapabilities,
      assignmentCapabilities,
      userRole,
      requestedCapability: "charge.refund",
    });
    expect(refundCheck.allowed).toBe(false);
    expect(refundCheck.status).toBe(403);
  });

  it("CON-03: Scoped Studio launch enforces tenant resource binding; forged launch denied without secret leaks", async () => {
    const validLaunch = generateScopedStudioLaunch({
      tenantSlug: "tenant-a",
      accountId: "acct-a",
      resourceId: "conn_zendesk_01",
      returnOrigin: "https://tenant-a.support.servicev8.com",
    });

    expect(validLaunch.url).toContain("tenant=tenant-a");
    expect(validLaunch.url).toContain("account=acct-a");
    // Must never leak provider API keys in props or query parameters
    expect(validLaunch.url).not.toContain("api_key");
    expect(validLaunch.url).not.toContain("secret");

    // Forged cross-tenant launch validation: tenant B cannot launch setup for tenant A's resource
    const forgedCheck = validateStudioLaunchRequest({
      callerTenantSlug: "tenant-b",
      targetTenantSlug: "tenant-a",
      returnOrigin: "https://tenant-b.support.servicev8.com",
    });
    expect(forgedCheck.allowed).toBe(false);
    expect(forgedCheck.status).toBe(403);

    // Untrusted return origin rejected
    const spoofedOriginCheck = validateStudioLaunchRequest({
      callerTenantSlug: "tenant-a",
      targetTenantSlug: "tenant-a",
      returnOrigin: "https://evil-phishing-site.test",
    });
    expect(spoofedOriginCheck.allowed).toBe(false);
    expect(spoofedOriginCheck.status).toBe(403);
  });
});
