import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  consumeSignupReceipt: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
  createKeycloakUser: vi.fn(),
}));

vi.mock("@/lib/auth/otp-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/otp-store")>();
  return { ...actual, otpStore: { consumeSignupReceipt: mocks.consumeSignupReceipt } };
});

vi.mock("@/lib/auth/tenant-signup-registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/tenant-signup-registry")>();
  return {
    ...actual,
    tenantSignupRegistry: { reserve: mocks.reserve, release: mocks.release },
  };
});

vi.mock("@/lib/auth/keycloak", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/keycloak")>();
  return { ...actual, createKeycloakUser: mocks.createKeycloakUser };
});

import { POST } from "../src/app/api/tenant/signup/route";

function request() {
  return new NextRequest("https://support.servicev8.com/api/tenant/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Failure Probe",
      domain: `failure-probe-${Date.now()}`,
      adminName: "Failure Admin",
      adminEmail: `failure-${Date.now()}@example.com`,
      verificationReceipt: "receipt",
      password: "StrongPassword#2026",
    }),
  });
}

describe("production signup failure reconciliation", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KEYCLOAK_ADMIN_BASE_URL", "https://id.example");
    vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_ID", "admin-client");
    vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", "secret");
    mocks.consumeSignupReceipt.mockResolvedValue(true);
    mocks.reserve.mockResolvedValue(true);
    mocks.release.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("retains the tenant reservation when the identity may exist", async () => {
    mocks.createKeycloakUser.mockRejectedValue(
      Object.assign(new Error("unknown outcome"), { identityMayExist: true })
    );

    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("releases the tenant reservation after a definitive provisioning failure", async () => {
    mocks.createKeycloakUser.mockRejectedValue(new Error("role missing; identity deleted"));

    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
