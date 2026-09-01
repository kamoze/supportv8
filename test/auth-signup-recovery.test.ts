import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as handleSignup } from "../src/app/api/tenant/signup/route";
import { POST as handleLogin } from "../src/app/api/auth/login/route";
import { POST as handleRecovery } from "../src/app/api/auth/password/recover/route";
import { POST as sendSignupOtp } from "../src/app/api/auth/otp/send/route";
import { POST as verifySignupOtp } from "../src/app/api/auth/otp/verify/route";
import { credentialStore } from "../src/lib/auth/credential-store";
import { db } from "../src/lib/db/mock-data";
import { NextRequest } from "next/server";

async function getSignupVerificationReceipt(email: string, tenantSlug: string): Promise<string> {
  const sendRes = await sendSignupOtp(
    new NextRequest("http://localhost:3000/api/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ email, tenantSlug, companyName: "QA Workspace" }),
    })
  );
  expect(sendRes.status).toBe(200);
  const { debugCode } = await sendRes.json();

  const verifyRes = await verifySignupOtp(
    new NextRequest("http://localhost:3000/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email, tenantSlug, code: debugCode }),
    })
  );
  expect(verifyRes.status).toBe(200);
  const { verificationReceipt } = await verifyRes.json();
  return verificationReceipt;
}

describe("SupportV8 Auth: Role Persona Removal, Password Recovery & Sign Up Registration", () => {
  beforeEach(() => {
    // Clean slate for test tenant if needed
  });

  it("1. Sign Up should register new tenant admin in credentialStore and allow immediate login with chosen password", async () => {
    const uniqueSlug = `qa-tenant-${Date.now()}`;
    const adminEmail = `admin@${uniqueSlug}.com`;
    const chosenPassword = "MyCustomPassword#2026!";
    const verificationReceipt = await getSignupVerificationReceipt(adminEmail, uniqueSlug);

    // Step 1: Sign up tenant
    const signupReq = new NextRequest("http://localhost:3000/api/tenant/signup", {
      method: "POST",
      body: JSON.stringify({
        name: "QA Logistics Inc",
        domain: uniqueSlug,
        adminName: "QA Lead",
        adminEmail,
        verificationReceipt,
        password: chosenPassword,
        initialMode: "autonomous",
        primaryStream: "customers",
      }),
    });

    const signupRes = await handleSignup(signupReq);
    expect(signupRes.status).toBe(200);
    const signupData = await signupRes.json();
    expect(signupData.success).toBe(true);
    expect(signupData.tenant.mode).toBe("copilot");
    expect(signupData.operatingMode).toBe("copilot");

    // Verify user is in credential store with role mapped on backend
    const userInStore = credentialStore.getUserByEmail(adminEmail);
    expect(userInStore).toBeDefined();
    expect(userInStore?.tenantSlug).toBe(uniqueSlug);
    expect(userInStore?.role).toBe("cx_lead");
    expect(userInStore?.name).toBe("QA Lead");

    // Step 2: Login with the chosen password
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: adminEmail,
        password: chosenPassword,
        tenantSlug: uniqueSlug,
      }),
    });

    const loginRes = await handleLogin(loginReq);
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.session.role).toBe("cx_lead");
    expect(loginData.user.role).toBe("cx_lead");
    expect(loginData.user.tenantSlug).toBe(uniqueSlug);
  });

  it("2. Sign Up should reject login if wrong password is provided", async () => {
    const uniqueSlug = `qa-secure-${Date.now()}`;
    const adminEmail = `lead@${uniqueSlug}.com`;
    const verificationReceipt = await getSignupVerificationReceipt(adminEmail, uniqueSlug);

    await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify({
          name: "QA Secure Co",
          domain: uniqueSlug,
          adminName: "Secure Admin",
          adminEmail,
          verificationReceipt,
          password: "CorrectPassword#1",
        }),
      })
    );

    const badLoginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: adminEmail,
        password: "WrongPassword#999",
        tenantSlug: uniqueSlug,
      }),
    });

    const loginRes = await handleLogin(badLoginReq);
    expect(loginRes.status).toBe(401);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(false);
  });

  it("rejects missing, cross-workspace, and replayed signup verification receipts", async () => {
    const uniqueSlug = `qa-receipt-${Date.now()}`;
    const adminEmail = `admin@${uniqueSlug}.com`;
    const signupBody = {
      name: "Receipt Security Inc",
      domain: uniqueSlug,
      adminName: "Receipt Admin",
      adminEmail,
      password: "ReceiptPassword#2026!",
    };

    const missingReceipt = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify(signupBody),
      })
    );
    expect(missingReceipt.status).toBe(403);

    const verificationReceipt = await getSignupVerificationReceipt(adminEmail, uniqueSlug);
    const wrongWorkspace = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify({
          ...signupBody,
          domain: `${uniqueSlug}-other`,
          verificationReceipt,
        }),
      })
    );
    expect(wrongWorkspace.status).toBe(403);

    const verifiedSignup = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify({ ...signupBody, verificationReceipt }),
      })
    );
    expect(verifiedSignup.status).toBe(200);

    const replay = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify({ ...signupBody, verificationReceipt }),
      })
    );
    expect(replay.status).toBe(403);
  });

  it("rejects a verified attacker trying to claim an existing workspace slug", async () => {
    const tenantSlug = `qa-takeover-${Date.now()}`;
    const ownerEmail = `owner@${tenantSlug}.com`;
    const attackerEmail = `attacker@${tenantSlug}.com`;
    const ownerReceipt = await getSignupVerificationReceipt(ownerEmail, tenantSlug);

    const ownerSignup = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify({
          name: "Protected Workspace",
          domain: tenantSlug,
          adminName: "Original Owner",
          adminEmail: ownerEmail,
          password: "OwnerPassword#2026!",
          verificationReceipt: ownerReceipt,
        }),
      })
    );
    expect(ownerSignup.status).toBe(200);

    const attackerReceipt = await getSignupVerificationReceipt(attackerEmail, tenantSlug);
    const takeover = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify({
          name: "Attacker Rename",
          domain: tenantSlug,
          adminName: "Attacker",
          adminEmail: attackerEmail,
          password: "AttackerPassword#2026!",
          verificationReceipt: attackerReceipt,
        }),
      })
    );

    expect(takeover.status).toBe(409);
    expect(credentialStore.getUserByEmail(attackerEmail, tenantSlug)).toBeUndefined();
    expect(db.getTenantData(tenantSlug).tenant.name).toBe("Protected Workspace");
  });

  it("rejects weak passwords before consuming the signup verification receipt", async () => {
    const tenantSlug = `qa-password-${Date.now()}`;
    const adminEmail = `admin@${tenantSlug}.com`;
    const verificationReceipt = await getSignupVerificationReceipt(adminEmail, tenantSlug);
    const baseBody = {
      name: "Password Policy Inc",
      domain: tenantSlug,
      adminName: "Password Admin",
      adminEmail,
      verificationReceipt,
    };

    const weak = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify({ ...baseBody, password: "short" }),
      })
    );
    expect(weak.status).toBe(400);

    const retry = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify({ ...baseBody, password: "StrongPassword#2026" }),
      })
    );
    expect(retry.status).toBe(200);
  });

  it("checks production identity configuration before consuming verification", async () => {
    const tenantSlug = `qa-idp-preflight-${Date.now()}`;
    const adminEmail = `admin@${tenantSlug}.com`;
    const verificationReceipt = await getSignupVerificationReceipt(adminEmail, tenantSlug);
    const body = {
      name: "Identity Preflight Inc",
      domain: tenantSlug,
      adminName: "Identity Admin",
      adminEmail,
      verificationReceipt,
      password: "StrongPassword#2026",
    };

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KEYCLOAK_ADMIN_BASE_URL", "");
    vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_ID", "");
    vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", "");
    const unavailable = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify(body),
      })
    );
    expect(unavailable.status).toBe(503);
    vi.unstubAllEnvs();

    const retry = await handleSignup(
      new NextRequest("http://localhost:3000/api/tenant/signup", {
        method: "POST",
        body: JSON.stringify(body),
      })
    );
    expect(retry.status).toBe(200);
  });

  it("does not reveal whether a password-recovery account exists", async () => {
    const response = await handleRecovery(
      new NextRequest("http://localhost:3000/api/auth/password/recover", {
        method: "POST",
        headers: { "x-real-ip": `192.0.2.${Math.floor(Math.random() * 200) + 1}` },
        body: JSON.stringify({
          action: "send_otp",
          email: `missing-${Date.now()}@example.com`,
          tenantSlug: "unknown-workspace",
        }),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("3. Password recovery: Step 1 should issue OTP code for registered user", async () => {
    const uniqueSlug = `qa-recover-${Date.now()}`;
    const adminEmail = `operator@${uniqueSlug}.com`;

    // Register user
    credentialStore.registerUser({
      email: adminEmail,
      password: "InitialPassword#123",
      name: "Recovery Operator",
      tenantSlug: uniqueSlug,
      role: "operator",
    });

    // Request recovery OTP
    const otpReq = new NextRequest("http://localhost:3000/api/auth/password/recover", {
      method: "POST",
      body: JSON.stringify({
        action: "send_otp",
        email: adminEmail,
        tenantSlug: uniqueSlug,
      }),
    });

    const otpRes = await handleRecovery(otpReq);
    expect(otpRes.status).toBe(200);
    const otpData = await otpRes.json();
    expect(otpData.success).toBe(true);
    expect(otpData.debugCode).toBeDefined();
    expect(otpData.debugCode.length).toBe(6);
  });

  it("4. Password recovery: Step 2 should reset password with valid OTP and enable sign in with new password", async () => {
    const uniqueSlug = `qa-reset-${Date.now()}`;
    const adminEmail = `staff@${uniqueSlug}.com`;
    const initialPass = "OldPassword#123";
    const newPass = "NewStrongPassword#2026!";

    // Register user
    credentialStore.registerUser({
      email: adminEmail,
      password: initialPass,
      name: "Staff Member",
      tenantSlug: uniqueSlug,
      role: "operator",
    });

    // Step 1: Send OTP
    const otpReq = new NextRequest("http://localhost:3000/api/auth/password/recover", {
      method: "POST",
      body: JSON.stringify({
        action: "send_otp",
        email: adminEmail,
        tenantSlug: uniqueSlug,
      }),
    });
    const otpRes = await handleRecovery(otpReq);
    const otpData = await otpRes.json();
    const code = otpData.debugCode;

    // Step 2: Reset password
    const resetReq = new NextRequest("http://localhost:3000/api/auth/password/recover", {
      method: "POST",
      body: JSON.stringify({
        action: "reset_password",
        email: adminEmail,
        code,
        newPassword: newPass,
      }),
    });

    const resetRes = await handleRecovery(resetReq);
    expect(resetRes.status).toBe(200);
    const resetData = await resetRes.json();
    expect(resetData.success).toBe(true);

    // Step 3: Login with new password
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: adminEmail,
        password: newPass,
        tenantSlug: uniqueSlug,
      }),
    });
    const loginRes = await handleLogin(loginReq);
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.session.email).toBe(adminEmail);
  });

  it("5. Password recovery: should reject invalid OTP code", async () => {
    const resetReq = new NextRequest("http://localhost:3000/api/auth/password/recover", {
      method: "POST",
      body: JSON.stringify({
        action: "reset_password",
        email: "nonexistent@company.com",
        code: "000000",
        newPassword: "SomeNewPassword#1",
      }),
    });

    const resetRes = await handleRecovery(resetReq);
    expect(resetRes.status).toBe(400);
    const resetData = await resetRes.json();
    expect(resetData.success).toBe(false);
  });

  it("6. Strict Credential Verification: should strictly reject generic fallback passwords ('admin', 'password', 'supportv8')", async () => {
    const fallbackAttempts = ["admin", "password", "supportv8", "123456"];

    for (const badPass of fallbackAttempts) {
      const res = await credentialStore.authenticate("admin@acme.com", badPass, "acme");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Incorrect password. Please try again.");
    }
  });
});
