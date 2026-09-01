import { describe, expect, it } from "vitest";
import {
  InMemoryTenantReservationBackend,
  TenantSignupRegistry,
} from "../src/lib/auth/tenant-signup-registry";

describe("tenant signup registry", () => {
  it("atomically allows only one reservation for a workspace", async () => {
    const registry = new TenantSignupRegistry(new InMemoryTenantReservationBackend());
    const reservation = {
      tenantId: "tenant_unique_workspace",
      tenantSlug: "unique-workspace",
      name: "Unique Workspace",
      operatingMode: "copilot",
    };

    const results = await Promise.all([
      registry.reserve(reservation),
      registry.reserve({ ...reservation, name: "Attacker Rename" }),
    ]);

    expect(results.sort()).toEqual([false, true]);
  });

  it("releases a failed reservation so a legitimate retry can proceed", async () => {
    const registry = new TenantSignupRegistry(new InMemoryTenantReservationBackend());
    const reservation = {
      tenantId: "tenant_retry_workspace",
      tenantSlug: "retry-workspace",
      name: "Retry Workspace",
      operatingMode: "copilot",
    };

    await expect(registry.reserve(reservation)).resolves.toBe(true);
    await registry.release(reservation.tenantId);
    await expect(registry.reserve(reservation)).resolves.toBe(true);
  });
});
