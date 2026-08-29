import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/auth-service";
import { ResendService } from "@/lib/services/resend-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, companyName, tenantSlug } = body;

    if (!email || !email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { success: false, error: "A valid administrator email address is required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Issue expiring 6-digit OTP code in auth service
    const code = AuthService.issueOtp(cleanEmail);

    // 2. Dispatch real email via Resend
    const emailResult = await ResendService.dispatchOtpEmail({
      email: cleanEmail,
      code,
      companyName: companyName?.trim(),
      tenantSlug: tenantSlug?.trim()?.toLowerCase(),
    });

    console.log(`[supportV8 Auth] OTP verification issued for ${cleanEmail} (code: ${code})`);

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}.`,
      email: cleanEmail,
      emailDispatched: emailResult,
      // Debug code for test environments:
      debugCode: process.env.NODE_ENV !== "production" ? code : undefined,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to issue verification code" },
      { status: 500 }
    );
  }
}
