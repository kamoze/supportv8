import { NextRequest, NextResponse } from "next/server";
import { credentialStore } from "@/lib/auth/credential-store";
import { AuthService } from "@/lib/auth-service";
import { ResendService } from "@/lib/services/resend-service";

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
      const user = credentialStore.getUserByEmail(cleanEmail);
      if (!user) {
        return NextResponse.json(
          { success: false, error: `Account with email '${cleanEmail}' was not found. Please verify your address or sign up.` },
          { status: 404 }
        );
      }

      // Check tenant domain match if tenantSlug was provided
      if (tenantSlug) {
        const cleanTenant = tenantSlug.toLowerCase().trim();
        if (user.role !== "superadmin" && user.tenantSlug.toLowerCase() !== cleanTenant) {
          return NextResponse.json(
            {
              success: false,
              error: `Cross-tenant recovery rejected: Account ${cleanEmail} belongs to workspace '${user.tenantSlug}', not '${cleanTenant}'.`,
            },
            { status: 403 }
          );
        }
      }

      const otp = AuthService.issueOtp(cleanEmail);

      // Dispatch OTP email via Resend
      const emailResult = await ResendService.dispatchOtpEmail({
        email: cleanEmail,
        code: otp,
        companyName: user.name || "Customer Workspace",
        tenantSlug: user.tenantSlug,
      });

      return NextResponse.json({
        success: true,
        message: `A 6-digit recovery code has been sent to ${cleanEmail}.`,
        debugCode: process.env.NODE_ENV !== "production" ? otp : undefined,
        emailDispatched: emailResult,
      });
    }

    // ACTION 2: Reset Password with Verified OTP Code
    if (action === "reset_password") {
      if (!code || code.trim().length !== 6) {
        return NextResponse.json(
          { success: false, error: "Please provide the valid 6-digit verification code sent to your email." },
          { status: 400 }
        );
      }

      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: "New password must be at least 6 characters in length." },
          { status: 400 }
        );
      }

      const isValidOtp = AuthService.verifyOtp(cleanEmail, code.trim());
      if (!isValidOtp) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired recovery code. Please request a new code." },
          { status: 400 }
        );
      }

      const resetResult = credentialStore.resetPassword(cleanEmail, newPassword);
      if (!resetResult.success) {
        return NextResponse.json(
          { success: false, error: resetResult.error || "Failed to update password." },
          { status: 400 }
        );
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
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Password recovery failed." },
      { status: 500 }
    );
  }
}
