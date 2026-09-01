import { NextRequest, NextResponse } from "next/server";
import {
  otpStore,
  OtpRateLimitError,
  OtpStoreUnavailableError,
} from "@/lib/auth/otp-store";
import { ResendService } from "@/lib/services/resend-service";

function clientIp(req: NextRequest): string | undefined {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    undefined;
}

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

    const cleanTenantSlug = (tenantSlug || "").trim().toLowerCase();
    if (!cleanTenantSlug) {
      return NextResponse.json(
        { success: false, error: "Workspace subdomain is required." },
        { status: 400 }
      );
    }

    await otpStore.enforceIssueRateLimit(
      "signup",
      cleanEmail,
      cleanTenantSlug,
      clientIp(req)
    );

    // 1. Issue an expiring code bound to this email and workspace.
    const code = await otpStore.issue("signup", cleanEmail, cleanTenantSlug);

    // 2. Dispatch real email via Resend
    const emailResult = await ResendService.dispatchOtpEmail({
      email: cleanEmail,
      code,
      companyName: companyName?.trim(),
      tenantSlug: cleanTenantSlug,
    });

    if (!emailResult.success) {
      await otpStore.revoke("signup", cleanEmail, cleanTenantSlug);
      return NextResponse.json(
        { success: false, error: "Verification email could not be delivered. Please try again." },
        { status: 502 }
      );
    }

    console.info("[supportV8 Auth] Signup OTP dispatched");

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}.`,
      email: cleanEmail,
      emailDispatched: emailResult,
      // Debug code for test environments:
      debugCode: process.env.NODE_ENV === "test" ? code : undefined,
    });
  } catch (err: unknown) {
    const status =
      err instanceof OtpStoreUnavailableError || err instanceof OtpRateLimitError
        ? err.status
        : 500;
    const message =
      err instanceof OtpStoreUnavailableError || err instanceof OtpRateLimitError
        ? err.message
        : "Verification service is temporarily unavailable. Please try again.";
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
