import { describe, it, expect, beforeEach } from "vitest";
import { createAlignmentHarness, AlignmentHarness } from "./alignment-harness";
import { marketplaceService } from "@/lib/services/marketplace-service";
import {
  signRuntimeEmployeeToken,
  setRuntimeActorGrant,
  setRuntimeRecordOutage,
  clearRuntimeRecordsStateForTesting,
  getRuntimeRecordAuditLogs,
  RUNTIME_EMPLOYEE_PROFILES,
} from "@/lib/platform/runtime-records";

describe("RUNTIME-API-01 to RUNTIME-API-06: Runtime Employee Record API Access", () => {
  let harness: AlignmentHarness;

  beforeEach(async () => {
    clearRuntimeRecordsStateForTesting();
    harness = await createAlignmentHarness();
  });

  it("RUNTIME-API-01: Each of Arthur, Vivian, and Sophia requests app records; returns actor-specific field projections", async () => {
    // 1. Arthur reads tickets (technical / triage capability)
    const arthurRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
    });
    expect(arthurRes.status).toBe(200);
    expect(arthurRes.body.success).toBe(true);
    const arthurTickets = arthurRes.body.tickets as Array<Record<string, unknown>>;
    expect(arthurTickets.length).toBeGreaterThan(0);
    const arthurFirst = arthurTickets[0]!;
    expect(arthurFirst.id).toBeDefined();
    expect(arthurFirst.ticketRef).toBeDefined();
    expect(arthurFirst.status).toBeDefined();
    expect(arthurFirst.priority).toBeDefined();
    expect(arthurFirst.summary).toBeDefined();

    // 2. Sophia reads tickets (customer success capability)
    const sophiaRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeSophiaA",
    });
    expect(sophiaRes.status).toBe(200);
    expect(sophiaRes.body.success).toBe(true);
    const sophiaTickets = sophiaRes.body.tickets as Array<Record<string, unknown>>;
    expect(sophiaTickets.length).toBeGreaterThan(0);
    const sophiaFirst = sophiaTickets[0]!;
    expect(sophiaFirst.id).toBeDefined();
    expect(sophiaFirst.ticketRef).toBeDefined();
    expect(sophiaFirst.customerName).toBeDefined();
    expect(sophiaFirst.customerRef).toBeDefined();
    expect(sophiaFirst.summary).toBeDefined();

    // 3. Vivian reads records (operational metrics & status capability; no customer personal data)
    const vivianRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeVivianA",
    });
    expect(vivianRes.status).toBe(200);
    expect(vivianRes.body.success).toBe(true);
    const vivianTickets = vivianRes.body.tickets as Array<Record<string, unknown>>;
    expect(vivianTickets.length).toBeGreaterThan(0);
    const vivianFirst = vivianTickets[0]!;
    expect(vivianFirst.id).toBeDefined();
    expect(vivianFirst.ticketRef).toBeDefined();
    expect(vivianFirst.status).toBeDefined();
    // Vivian's projection deliberately strips customer personal data (customerName, customerRef)
    expect(vivianFirst.customerName).toBeUndefined();
    expect(vivianFirst.customerRef).toBeUndefined();
  });

  it("RUNTIME-API-02: Foreign tenant, wrong audience/purpose, missing scope, expired token or forged actor -> denied", async () => {
    // 1. Foreign tenant: Arthur for Tenant B attempting to read Tenant A
    const foreignRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurB",
      host: "tenant-a.support.servicev8.com", // trying to access Tenant A
    });
    expect([401, 403]).toContain(foreignRes.status);
    expect(foreignRes.body.success).toBe(false);

    // 2. Wrong audience
    const wrongAudToken = signRuntimeEmployeeToken({
      actorId: "runtime-arthur",
      employeeName: "Arthur",
      tenantDomain: "tenant-a",
      aud: "wrong-service-v8",
    });
    const wrongAudRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
      headers: { authorization: `Bearer ${wrongAudToken}` },
    });
    expect([401, 403]).toContain(wrongAudRes.status);

    // 3. Wrong purpose (e.g. command token presented on read API)
    const wrongPurposeToken = signRuntimeEmployeeToken({
      actorId: "runtime-arthur",
      employeeName: "Arthur",
      tenantDomain: "tenant-a",
      purpose: "cross_app_command" as any,
    });
    const wrongPurposeRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
      headers: { authorization: `Bearer ${wrongPurposeToken}` },
    });
    expect([401, 403]).toContain(wrongPurposeRes.status);

    // 4. Missing required scope/capability
    const missingScopeToken = signRuntimeEmployeeToken({
      actorId: "runtime-arthur",
      employeeName: "Arthur",
      tenantDomain: "tenant-a",
      capabilities: ["support:unrelated.scope"],
    });
    const missingScopeRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
      headers: { authorization: `Bearer ${missingScopeToken}` },
    });
    expect(missingScopeRes.status).toBe(403);

    // 5. Expired token
    const expiredToken = signRuntimeEmployeeToken({
      actorId: "runtime-arthur",
      employeeName: "Arthur",
      tenantDomain: "tenant-a",
      exp: Math.floor(Date.now() / 1000) - 60, // expired 1 minute ago
    });
    const expiredRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    expect(expiredRes.status).toBe(401);

    // 6. Forged actor: claims Sophia in header, but token belongs to Arthur
    const forgedRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
      headers: {
        "x-runtime-employee": "Sophia", // header forgery
      },
    });
    expect([401, 403]).toContain(forgedRes.status);
  });

  it("RUNTIME-API-03: Permitted read succeeds without adding Runtime actor to the app employee roster", async () => {
    // Before read: check workforce roster
    const beforeCatalog = marketplaceService.getWorkforceCatalog("tenant-a");
    const beforeHires = beforeCatalog.filter((w) => w.isHired);
    expect(beforeHires.length).toBe(0);

    // Authorized Runtime read by Sophia
    const res = await harness.request("runtimeRecordRead", {
      actor: "runtimeSophiaA",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // After read: app workforce roster remains completely unchanged
    const afterCatalog = marketplaceService.getWorkforceCatalog("tenant-a");
    const afterHires = afterCatalog.filter((w) => w.isHired);
    expect(afterHires.length).toBe(0);

    // Arthur, Vivian, and Sophia must NOT appear as hired app employees
    for (const name of ["Arthur", "Vivian", "Sophia"]) {
      expect(afterHires.some((h) => h.name.includes(name))).toBe(false);
    }
  });

  it("RUNTIME-API-04: Read credentials cannot mutate domain records or access prohibited private fields", async () => {
    // 1. Attempt mutation (POST) with read token
    const mutationRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
      body: {
        method: "POST",
        data: {
          customerName: "Attacker",
          summary: "Attempt unauthorized ticket write via read token",
          priority: "urgent",
        },
      },
    });
    expect(mutationRes.status).toBe(403);
    expect(mutationRes.body.success).toBe(false);

    // 2. Prohibited private fields check: sensitive internal fields are never projected
    const readRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeSophiaA",
    });
    expect(readRes.status).toBe(200);
    const tickets = readRes.body.tickets as Array<Record<string, unknown>>;
    for (const ticket of tickets) {
      expect(ticket.internalNotes).toBeUndefined();
      expect(ticket.customerSsn).toBeUndefined();
      expect(ticket.rawTranscript).toBeUndefined();
      expect(ticket.billingSecret).toBeUndefined();
    }
  });

  it("RUNTIME-API-05: Entitlement or actor permission revocation denies subsequent requests", async () => {
    // Initial read succeeds
    const res1 = await harness.request("runtimeRecordRead", {
      actor: "runtimeSophiaA",
    });
    expect(res1.status).toBe(200);

    // Revoke tenant entitlement at owner
    await harness.owners.change("tenantA.entitlement", "revoked");

    // Next request must fail closed (403)
    const res2 = await harness.request("runtimeRecordRead", {
      actor: "runtimeSophiaA",
    });
    expect(res2.status).toBe(403);

    // Restore entitlement, but revoke Sophia's specific actor grant
    await harness.owners.change("tenantA.entitlement", "active");
    setRuntimeActorGrant("runtime-sophia", "revoked");

    const res3 = await harness.request("runtimeRecordRead", {
      actor: "runtimeSophiaA",
    });
    expect(res3.status).toBe(403);
  });

  it("RUNTIME-API-06: Validates audit correlation and explicit unavailable-state handling", async () => {
    // 1. Perform allowed read
    const okRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
    });
    expect(okRes.status).toBe(200);

    // 2. Perform denied read (revoked grant)
    setRuntimeActorGrant("runtime-arthur", "revoked");
    const deniedRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
    });
    expect(deniedRes.status).toBe(403);

    // Verify audit logs contain both allow and deny decisions with tenant & actor correlation
    const logs = getRuntimeRecordAuditLogs();
    expect(logs.length).toBeGreaterThanOrEqual(2);

    const allowLog = logs.find((l) => l.actorId === "runtime-arthur" && l.decision === "allow");
    expect(allowLog).toBeDefined();
    expect(allowLog?.tenantId).toBe("tenant-a");

    const denyLog = logs.find((l) => l.actorId === "runtime-arthur" && l.decision === "deny");
    expect(denyLog).toBeDefined();
    expect(denyLog?.tenantId).toBe("tenant-a");

    // 3. Outage handling: simulate owner / ticket service outage
    setRuntimeActorGrant("runtime-arthur", "active");
    setRuntimeRecordOutage(true);

    const outageRes = await harness.request("runtimeRecordRead", {
      actor: "runtimeArthurA",
    });
    // Must return explicit 503 unavailable, NOT fabricated records
    expect(outageRes.status).toBe(503);
    expect(outageRes.body.error).toBe("ticket service unavailable");
  });
});
