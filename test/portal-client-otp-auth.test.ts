import { describe, it, expect } from "vitest";
import { signClientToken, verifyClientToken } from "@/lib/auth/client-token";
import { POST as sendOtpHandler } from "@/app/api/portal/auth/otp/send/route";
import { POST as verifyOtpHandler } from "@/app/api/portal/auth/otp/verify/route";
import { GET as meHandler } from "@/app/api/portal/auth/me/route";
import { NextRequest } from "next/server";
import { otpStore } from "@/lib/auth/otp-store";

describe("Client OTP Auth Subsystem", () => {
  const tenantSlug = "acme";
  const email = "client@example.com";

  it("signs and verifies client session tokens with HMAC integrity", () => {
    const payload = {
      email,
      tenantSlug,
      customerId: "cust_12345",
      name: "Sarah Client",
      company: "Acme Client Corp",
    };

    const token = signClientToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const verified = verifyClientToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe(email);
    expect(verified?.tenantSlug).toBe(tenantSlug);
    expect(verified?.customerId).toBe("cust_12345");
  });

  it("rejects tampered client tokens", () => {
    const token = signClientToken({ email, tenantSlug, customerId: "c1" });
    const tampered = token.slice(0, -4) + "abcd";
    expect(verifyClientToken(tampered)).toBeNull();
  });

  it("rejects expired client tokens", () => {
    const token = signClientToken({
      email,
      tenantSlug,
      customerId: "c1",
      exp: Math.floor(Date.now() / 1000) - 60, // expired 1 minute ago
    });
    expect(verifyClientToken(token)).toBeNull();
  });

  it("handles POST /api/portal/auth/otp/send successfully", async () => {
    const req = new NextRequest("http://localhost:3000/api/portal/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ email, tenantSlug }),
    });

    const res = await sendOtpHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.email).toBe(email);
    expect(body.debugCode).toBeDefined();
  });

  it("handles POST /api/portal/auth/otp/send validation errors", async () => {
    const req = new NextRequest("http://localhost:3000/api/portal/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ email: "invalid-email", tenantSlug }),
    });

    const res = await sendOtpHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("handles POST /api/portal/auth/otp/verify and issues client token", async () => {
    // 1. Issue code
    const code = await otpStore.issue("client-access", email, tenantSlug);

    // 2. Verify code
    const req = new NextRequest("http://localhost:3000/api/portal/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email, code, tenantSlug }),
    });

    const res = await verifyOtpHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.clientToken).toBeDefined();
    expect(body.customer.email).toBe(email);
  });

  it("handles POST /api/portal/auth/otp/verify with invalid code", async () => {
    const req = new NextRequest("http://localhost:3000/api/portal/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email, code: "000000", tenantSlug }),
    });

    const res = await verifyOtpHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("validates client session with GET /api/portal/auth/me using Bearer header", async () => {
    const token = signClientToken({ email, tenantSlug, customerId: "c1", name: "Sarah Client" });
    const req = new NextRequest("http://localhost:3000/api/portal/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await meHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.customer.email).toBe(email);
  });

  it("validates client session with GET /api/portal/auth/me using cookie", async () => {
    const token = signClientToken({ email, tenantSlug, customerId: "c1", name: "Sarah Client" });
    const req = new NextRequest("http://localhost:3000/api/portal/auth/me", {
      headers: { Cookie: `sv8_client_token=${token}` },
    });

    const res = await meHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.customer.email).toBe(email);
  });

  it("returns 401 on GET /api/portal/auth/me when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/portal/auth/me");
    const res = await meHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });
});
