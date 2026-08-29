import { describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "../src/lib/auth-service";

describe("SupportV8 AuthService & Zero-Trust Session Management", () => {
  beforeEach(() => {
    AuthService.clearSession();
  });

  it("should create a valid operator session with cryptographic token and expiry", () => {
    const session = AuthService.createSession("acme", "operator@acme.com", "operator");
    expect(session.tenantSlug).toBe("acme");
    expect(session.email).toBe("operator@acme.com");
    expect(session.token).toMatch(/^sv8_tk_acme_\d+_[a-z0-9]+$/);
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should authenticate demo sandbox operators for acme and meridian", () => {
    const acmeSess = AuthService.authenticateDemo("acme");
    expect(acmeSess.tenantSlug).toBe("acme");
    expect(acmeSess.email).toBe("admin@acme.com");
    expect(acmeSess.role).toBe("cx_lead");

    const meridianSess = AuthService.authenticateDemo("meridian");
    expect(meridianSess.tenantSlug).toBe("meridian");
    expect(meridianSess.email).toBe("dispatch@meridian.com");
    expect(meridianSess.role).toBe("contractor_lead");
  });

  it("should clear session securely on logout", () => {
    AuthService.createSession("meridian", "tech@meridian.com");
    expect(AuthService.getActiveSession()).toBeDefined();

    AuthService.clearSession();
    expect(AuthService.getActiveSession()).toBeNull();
  });
});
