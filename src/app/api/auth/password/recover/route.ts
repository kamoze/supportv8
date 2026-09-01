import { NextRequest, NextResponse } from "next/server";
import { credentialStore } from "@/lib/auth/credential-store";
import {
  otpStore,
  OtpRateLimitError,
  OtpStoreUnavailableError,
} from "@/lib/auth/otp-store";
import { ResendService } from "@/lib/services/resend-service";
import { findKeycloakUserByEmail, resetKeycloakPassword } from "@/lib/auth/keycloak";
import { tenantSlugFromId } from "@/lib/auth/request-tenant";
import { passwordPolicyError } from "@/lib/auth/password-policy";

function clientIp(req: NextRequest): string | undefined {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, code, newPassword, tenantSlug } = body;

    const cleanEmail = (email || "").toLowerCase().trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid registered email address is required." },
        { status: 400 }
      );
    }

    // ACTION 1: Send Password Reset Verification Code (OTP)
    if (action === "send_otp") {
      const requestedTenant = String(tenantSlug || "").trim().toLowerCase();
      await otpStore.enforceIssueRateLimit(
        "password-recovery",
        cleanEmail,
        requestedTenant,
        clientIp(req)
      );

      let user: { tenantSlug: string; name: string; role?: string } | undefined;
      if (process.env.NODE_ENV === "production") {
        const keycloakUser = await findKeycloakUserByEmail(cleanEmail);
        const tenantId = keycloakUser?.attributes?.tenant_id?.[0];
        if (keycloakUser && tenantId) {
          user = {
            tenantSlug: tenantSlugFromId(tenantId),
            name:
              [keycloakUser.firstName, keycloakUser.lastName].filter(Boolean).join(" ") ||
              keycloakUser.email ||
              cleanEmail,
          };
        }
      } else {
        user = credentialStore.getUserByEmail(cleanEmail, tenantSlug);
      }
      if (!user) {
        return NextResponse.json(
          {
            success: true,
            message: "If that account exists, a 6-digit recovery code will be sent.",
          },
          { status: 200 }
        );
      }

      // Check tenant domain match if tenantSlug was provided
      if (tenantSlug) {
        const cleanTenant = tenantSlug.toLowerCase().trim();
        if (cleanTenant !== "global" && user.role !== "superadmin" && user.tenantSlug.toLowerCase() !== cleanTenant) {
          return NextResponse.json({
            success: true,
            message: "If that account exists, a 6-digit recovery code will be sent.",
          });
        }
      }

      const otp = await otpStore.issue("password-recovery", cleanEmail, user.tenantSlug);

      // Dispatch OTP email via Resend
      const emailResult = await ResendService.dispatchOtpEmail({
        email: cleanEmail,
        code: otp,
        companyName: user.name || "Customer Workspace",
        tenantSlug: user.tenantSlug,
      });

      if (!emailResult.success) {
        await otpStore.revoke("password-recovery", cleanEmail, user.tenantSlug);
        console.warn("[supportV8 Auth] Password recovery email dispatch failed");
      }

      return NextResponse.json({
        success: true,
        message: "If that account exists, a 6-digit recovery code will be sent.",
        debugCode: process.env.NODE_ENV === "test" ? otp : undefined,
        emailDispatched: emailResult,
      });
    }

    // ACTION 2: Reset Password with Verified OTP Code
    if (action === "reset_password") {
      const cleanCode = String(code || "").trim();
      if (!/^\d{6}$/.test(cleanCode)) {
        return NextResponse.json(
          { success: false, error: "Please provide the valid 6-digit verification code sent to your email." },
          { status: 400 }
        );
      }

      const passwordError = passwordPolicyError(newPassword);
      if (passwordError) {
        return NextResponse.json(
          { success: false, error: passwordError },
          { status: 400 }
        );
      }

      let recoveryTenantSlug: string | undefined;
      if (process.env.NODE_ENV === "production") {
        const keycloakUser = await findKeycloakUserByEmail(cleanEmail);
        const tenantId = keycloakUser?.attributes?.tenant_id?.[0];
        recoveryTenantSlug = tenantId ? tenantSlugFromId(tenantId) : undefined;
      } else {
        recoveryTenantSlug = credentialStore.getUserByEmail(cleanEmail, tenantSlug)?.tenantSlug;
      }
      if (!recoveryTenantSlug) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired recovery code. Please request a new code." },
          { status: 400 }
        );
      }

      if (
        tenantSlug &&
        tenantSlug.trim().toLowerCase() !== "global" &&
        tenantSlug.trim().toLowerCase() !== recoveryTenantSlug
      ) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired recovery code. Please request a new code." },
          { status: 400 }
        );
      }

      const isValidOtp = await otpStore.verify(
        "password-recovery",
        cleanEmail,
        cleanCode,
        recoveryTenantSlug
      );
      if (!isValidOtp) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired recovery code. Please request a new code." },
          { status: 400 }
        );
      }

      if (process.env.NODE_ENV === "production") {
        await resetKeycloakPassword(cleanEmail, newPassword);
        credentialStore.resetPassword(cleanEmail, newPassword, recoveryTenantSlug);
      } else {
        const resetResult = credentialStore.resetPassword(cleanEmail, newPassword, tenantSlug);
        if (!resetResult.success) {
          return NextResponse.json(
            { success: false, error: resetResult.error || "Failed to update password." },
            { status: 400 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: `Password successfully updated for ${cleanEmail}. You can now sign in with your new password.`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Supported actions: 'send_otp', 'reset_password'." },
      { status: 400 }
    );
  } catch (err: unknown) {
    const status =
      err instanceof OtpStoreUnavailableError || err instanceof OtpRateLimitError
        ? err.status
        : 500;
    const message =
      err instanceof OtpStoreUnavailableError || err instanceof OtpRateLimitError
        ? err.message
        : "Password recovery service is temporarily unavailable. Please try again.";
    return NextResponse.json(
      { success: false, error: message },
      {
        status,
        headers:
          err instanceof OtpRateLimitError
            ? { "Retry-After": String(err.retryAfterSeconds) }
            : undefined,
      }
    );
  }
}
