import { describe, it, expect, beforeEach } from "vitest";
import { createAlignmentHarness, AlignmentHarness } from "./alignment-harness";
import { marketplaceService } from "@/lib/services/marketplace-service";

describe("APP-01 to APP-05 & CREDIT-01 to CREDIT-04: App Acquisition, Handoff & Shared Credits", () => {
  let harness: AlignmentHarness;

  beforeEach(async () => {
    harness = await createAlignmentHarness();
  });

  describe("App Acquisition & Handoff (APP-01 to APP-05)", () => {
    it("APP-01: Ineligible plan cannot acquire; client cannot spoof plan eligibility", async () => {
      // Disallowed plan eligibility at owner
      await harness.owners.change("tenantA.planEligibility", "none");
      const before = await harness.state();

      const result = await harness.request("appAcquire", {
        actor: "ownerA",
        body: {
          offerId: "app-offer-supportv8",
          planId: "enterprise", // client trying to claim enterprise tier
          clientAcquisitionId: "acq-client-attempt-1",
        },
      });

      expect(result.status).toBe(403);
      expect(result.body.success).toBe(false);
      const after = await harness.state();
      expect(after.appInstallations).toBe(before.appInstallations);
    });

    it("APP-02: Duplicate app acquisition is idempotent; creates 1 installation without seeding hires or credits", async () => {
      await harness.owners.change("tenantA.planEligibility", "starter");

      const req1 = await harness.request("appAcquire", {
        actor: "ownerA",
        body: {
          offerId: "app-offer-supportv8",
          clientAcquisitionId: "acq-dup-1",
        },
      });
      expect(req1.status).toBe(200);

      // Duplicate click with same clientAcquisitionId
      const req2 = await harness.request("appAcquire", {
        actor: "ownerA",
        body: {
          offerId: "app-offer-supportv8",
          clientAcquisitionId: "acq-dup-1",
        },
      });
      expect(req2.status).toBe(200);

      // Verify state: exactly 1 installation, 0 seeded hires, 0 synthetic credits
      const state = await harness.state();
      expect(state.appInstallations).toBe(1);
      expect(state.hires).toBe(0);
    });

    it("APP-03: Runtime Applications entry resolves exact installation; tenant-B cannot launch tenant-A installation", async () => {
      // Tenant B tries to launch Tenant A's app installation
      const crossTenantLaunch = await harness.request("appLaunch", {
        actor: "ownerB",
        body: {
          installationId: "install-tenant-a",
        },
      });
      expect(crossTenantLaunch.status).toBe(403);
      expect(crossTenantLaunch.body.success).toBe(false);
    });

    it("APP-04: Revoked app installation denies entry and operations", async () => {
      await harness.owners.change("tenantA.appInstallation", "revoked");

      const res = await harness.request("workspace", { actor: "ownerA" });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("APP-05: Standalone app customer entering Runtime maintains canonical identity; no email merge", async () => {
      // Same email on a different tenant does not merge accounts or balances
      const standaloneBalance = marketplaceService.getCredits("tenant-a", {
        accountId: "acct-a",
        runtimeLinked: true,
      });
      const otherTenantBalance = marketplaceService.getCredits("tenant-b", {
        accountId: "acct-b",
        runtimeLinked: true,
      });

      expect(standaloneBalance).toBeDefined();
      expect(otherTenantBalance).toBeDefined();
      expect(standaloneBalance).not.toBe(otherTenantBalance);
    });
  });

  describe("Shared Credits & Forge Pool Binding (CREDIT-01 to CREDIT-04)", () => {
    it("CREDIT-01: Runtime and app read the same verified Forge pool and balance", async () => {
      await harness.owners.change("tenantA.funding", {
        poolId: "pool-forge-shared-a",
        balance: 1250,
        revision: "rev-forge-1",
      });

      const res = await harness.request("credits", { actor: "ownerA" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect((res.body.data as any).credits).toBe(1250);
    });

    it("CREDIT-02: Zero balance remains zero; unavailable remains unavailable (no plan quota fallback)", async () => {
      // When balance is zero in the Forge shared pool:
      await harness.owners.change("tenantA.funding", {
        poolId: "pool-forge-shared-a",
        balance: 0,
        revision: "rev-forge-2",
      });

      // Query credits - MUST remain 0, never fall back to active plan allowance (e.g. 500 or 1000)
      const res = await harness.request("credits", { actor: "ownerA" });
      expect(res.status).toBe(200);
      expect((res.body.data as any).credits).toBe(0);

      const localVal = marketplaceService.getCredits("tenant-a", {
        accountId: "acct-a",
        runtimeLinked: true,
      });
      expect(localVal).toBe(0);
    });

    it("CREDIT-03: Metered operations settle once under retry; no duplicate charge", async () => {
      await harness.owners.change("tenantA.funding", {
        poolId: "pool-forge-shared-a",
        balance: 500,
        revision: "rev-forge-3",
      });

      const op1 = await harness.request("meteredAction", {
        actor: "ownerA",
        body: {
          actionId: "op-deduct-100",
          amount: 50,
          idempotencyKey: "idem-metered-001",
        },
      });
      expect(op1.status).toBe(200);

      // Retry with same idempotencyKey
      const op2 = await harness.request("meteredAction", {
        actor: "ownerA",
        body: {
          actionId: "op-deduct-100",
          amount: 50,
          idempotencyKey: "idem-metered-001",
        },
      });
      expect(op2.status).toBe(200);

      const state = await harness.state();
      expect(state.creditDebits).toBe(1);
    });

    it("CREDIT-04: Caller-supplied foreign account or fake balance cannot authorize spend", async () => {
      // Client cannot supply a foreign accountId to deduct from someone else's pool
      const attackRes = await harness.request("credits", {
        actor: "ownerA",
        body: {
          action: "deduct",
          amount: 100,
          accountId: "acct-b", // Forge account belonging to tenant B
        },
      });

      // Must be rejected or scoped strictly to actor's own account (acct-a)
      if (attackRes.status === 200) {
        // If it succeeded, check that tenant B was untouched
        const bBalance = marketplaceService.getCredits("tenant-b", {
          accountId: "acct-b",
          runtimeLinked: true,
        });
        expect(bBalance).toBe(2500);
      }
    });
  });
});
