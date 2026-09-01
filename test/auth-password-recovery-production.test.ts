import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  enforceIssueRateLimit: vi.fn(),
  issue: vi.fn(),
  revoke: vi.fn(),
  verify: vi.fn(),
  findKeycloakUserByEmail: vi.fn(),
  resetKeycloakPassword: vi.fn(),
  dispatchOtpEmail: vi.fn(),
}));

vi.mock("@/lib/auth/otp-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/otp-store")>();
  return {
    ...actual,
    otpStore: {
      enforceIssueRateLimit: mocks.enforceIssueRateLimit,
      issue: mocks.issue,
      revoke: mocks.revoke,
      verify: mocks.verify,
    },
  };
});

vi.mock("@/lib/auth/keycloak", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/keycloak")>();
  return {
    ...actual,
    findKeycloakUserByEmail: mocks.findKeycloakUserByEmail,
    resetKeycloakPassword: mocks.resetKeycloakPassword,
  };
});

vi.mock("@/lib/services/resend-service", () => ({
  ResendService: { dispatchOtpEmail: mocks.dispatchOtpEmail },
}));

import { POST } from "../src/app/api/auth/password/recover/route";

function recoveryRequest(body: Record<string, unknown>) {
  return new NextRequest("https://alpha.support.servicev8.com/api/auth/password/recover", {
    method: "POST",
    headers: { "x-real-ip": "192.0.2.10" },
    body: JSON.stringify({ email: "admin@example.com", tenantSlug: "alpha", ...body }),
  });
}

describe("production password recovery", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.enforceIssueRateLimit.mockResolvedValue(undefined);
    mocks.findKeycloakUserByEmail.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      attributes: { tenant_id: ["tenant_alpha"] },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("limits before lookup and sends a tenant-bound code for an existing account", async () => {
    mocks.issue.mockResolvedValue("123456");
    mocks.dispatchOtpEmail.mockResolvedValue({ success: true, resendEmailId: "email-1" });

    const response = await POST(recoveryRequest({ action: "send_otp" }));
    expect(response.status).toBe(200);
    expect(mocks.enforceIssueRateLimit.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.findKeycloakUserByEmail.mock.invocationCallOrder[0]);
    expect(mocks.issue).toHaveBeenCalledWith(
      "password-recovery",
      "admin@example.com",
      "alpha"
    );
  });

  it("verifies against the authoritative tenant and resets Keycloak", async () => {
    mocks.verify.mockResolvedValue(true);
    mocks.resetKeycloakPassword.mockResolvedValue(undefined);

    const response = await POST(recoveryRequest({
      action: "reset_password",
      code: "123456",
      newPassword: "NewStrongPassword#2026",
    }));
    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith(
      "password-recovery",
      "admin@example.com",
      "123456",
      "alpha"
    );
    expect(mocks.resetKeycloakPassword).toHaveBeenCalledWith(
      "admin@example.com",
      "NewStrongPassword#2026"
    );
  });

  it("returns a generic service failure if Keycloak reset fails after OTP consumption", async () => {
    mocks.verify.mockResolvedValue(true);
    mocks.resetKeycloakPassword.mockRejectedValue(new Error("internal idp detail"));

    const response = await POST(recoveryRequest({
      action: "reset_password",
      code: "123456",
      newPassword: "NewStrongPassword#2026",
    }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Password recovery service is temporarily unavailable. Please try again.",
    });
  });
});
