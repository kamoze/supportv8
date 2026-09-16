import { describe, expect, it, vi } from "vitest";
import {
  reconcileManagedSupportRegistration,
  type ManagedSupportRegistrationJob,
} from "@/lib/service-app/managed-support-registration";
import { SUPPORT_MANIFEST } from "@/lib/service-app/managed-support-contract";

const job: ManagedSupportRegistrationJob = {
  installationId: "support-install",
  acquisitionId: "acq-support",
  accountId: "account-a",
  registryTenantId: "tenant-a",
  verticalId: "runtime",
  workspaceId: "tenant_support_a",
  state: "pending",
  attemptCount: 0,
};

describe("managed Support registration reconciliation", () => {
  it("persists exact connect then readiness without employee authority", async () => {
    const update = vi.fn(),
      call = vi.fn(async (kind: "connect" | "readiness") =>
        kind === "connect"
          ? {
              status: 200,
              body: {
                connectionId: "11111111-1111-8111-8111-111111111111",
                manifest: SUPPORT_MANIFEST,
              },
            }
          : {
              status: 200,
              body: {
                status: "connected",
                connectionId: "11111111-1111-8111-8111-111111111111",
                manifest: SUPPORT_MANIFEST,
              },
            },
      );
    await reconcileManagedSupportRegistration(job, {
      call,
      update,
      connectionId: () => "11111111-1111-8111-8111-111111111111",
      now: () => 1,
    });
    expect(call).toHaveBeenNthCalledWith(
      1,
      "connect",
      expect.objectContaining({ installationId: job.installationId }),
    );
    expect(call).toHaveBeenNthCalledWith(
      2,
      "readiness",
      expect.objectContaining({ installationId: job.installationId }),
      "11111111-1111-8111-8111-111111111111",
    );
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "ready",
        connectionId: "11111111-1111-8111-8111-111111111111",
      }),
    );
  });
  it("keeps binding delay, suspension and unavailable plans retryable", async () => {
    for (const status of [403, 503]) {
      const update = vi.fn();
      await reconcileManagedSupportRegistration(job, {
        call: async () => ({ status, body: {} }),
        update,
        connectionId: () => "11111111-1111-8111-8111-111111111111",
        now: () => 1000,
        random: () => 0,
      });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "pending",
          nextAttemptAt: expect.any(String),
        }),
      );
    }
  });
  it("marks identity or manifest drift as conflict without retry overwrite", async () => {
    const update = vi.fn();
    await reconcileManagedSupportRegistration(job, {
      call: async () => ({
        status: 200,
        body: { connectionId: "wrong", manifest: {} },
      }),
      update,
      connectionId: () => "11111111-1111-8111-8111-111111111111",
      now: () => 1,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ state: "conflict" }),
    );
  });
  it("does not mark malformed readiness success ready", async () => {
    const update = vi.fn();
    let calls = 0;
    await reconcileManagedSupportRegistration(job, {
      call: async () =>
        ++calls === 1
          ? {
              status: 200,
              body: {
                connectionId: "11111111-1111-8111-8111-111111111111",
                manifest: SUPPORT_MANIFEST,
              },
            }
          : { status: 200, body: { status: "connected" } },
      update,
      connectionId: () => "11111111-1111-8111-8111-111111111111",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "conflict",
        lastErrorCode: "readiness_identity_drift",
      }),
    );
  });
});
