import { NextRequest, NextResponse } from "next/server";
import { otpStore, OtpStoreUnavailableError } from "@/lib/auth/otp-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code, tenantSlug } = body;

    if (!email || !code || !tenantSlug) {
      return NextResponse.json(
        { success: false, error: "Email address, workspace, and 6-digit verification code are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();
    const cleanTenantSlug = tenantSlug.toString().trim().toLowerCase();

    if (!/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json(
        { success: false, error: "Verification code must be exactly 6 digits." },
        { status: 400 }
      );
    }

    const verificationReceipt = await otpStore.verifySignupAndIssueReceipt(
      cleanEmail,
      cleanCode,
      cleanTenantSlug
    );

    if (!verificationReceipt) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired verification code. Please request a new code." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      email: cleanEmail,
      message: "Email address verified successfully.",
      verificationReceipt,
    });
  } catch (err: unknown) {
    const status = err instanceof OtpStoreUnavailableError ? err.status : 500;
    const message =
      err instanceof OtpStoreUnavailableError
        ? err.message
        : "Verification service is temporarily unavailable. Please try again.";
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
