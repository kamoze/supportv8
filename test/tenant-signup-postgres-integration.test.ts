import { afterAll, describe, expect, it } from "vitest";
import { PostgresClient } from "../src/lib/db/pg-client";
import {
  PostgresTenantReservationBackend,
  TenantSignupRegistry,
} from "../src/lib/auth/tenant-signup-registry";

const enabled = process.env.SUPPORTV8_RUN_DATABASE_INTEGRATION === "true";
const firstClient = new PostgresClient();
const secondClient = new PostgresClient();

describe.runIf(enabled)("PostgreSQL tenant signup reservation integration", () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  const tenantId = `tenant_signup_${suffix}`;
  const tenantSlug = `signup-${suffix.replace(/_/g, "-")}`;
  const first = new TenantSignupRegistry(new PostgresTenantReservationBackend(firstClient));
  const second = new TenantSignupRegistry(new PostgresTenantReservationBackend(secondClient));

  afterAll(async () => {
    await first.release(tenantId).catch(() => undefined);
    await Promise.all([firstClient.close(), secondClient.close()]);
  });

  it("allows only one winner across concurrent application instances", async () => {
    const input = {
      tenantId,
      tenantSlug,
      name: "Signup Integration Probe",
      operatingMode: "copilot",
    };
    const results = await Promise.all([first.reserve(input), second.reserve(input)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
