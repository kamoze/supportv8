import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AuthService } from "../src/lib/auth-service";

describe("SupportV8 AuthService & Zero-Trust Session Management", () => {
  beforeEach(() => {
    AuthService.clearSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should create a valid operator session with cryptographic token and expiry", () => {
    const session = AuthService.createSession("acme", "operator@acme.com", "operator");
    expect(session.tenantSlug).toBe("acme");
    expect(session.email).toBe("operator@acme.com");
    expect(session.token).toMatch(/^sv8_tk_acme_\d+_[a-z0-9]+$/);
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it("only accepts a server-authenticated demo session", async () => {
    const session = AuthService.createSession("acme", "demo@acme.support.servicev8.com", "operator");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, session }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ));

    const result = await AuthService.authenticateDemo("acme");
    expect(result.success).toBe(true);
    expect(result.session?.tenantSlug).toBe("acme");
    expect(result.session?.email).toBe("demo@acme.support.servicev8.com");
    expect(result.session?.role).toBe("operator");
  });

  it("should clear session securely on logout", () => {
    AuthService.createSession("meridian", "tech@meridian.com");
    expect(AuthService.getActiveSession()).toBeDefined();

    AuthService.clearSession();
    expect(AuthService.getActiveSession()).toBeNull();
  });
});
