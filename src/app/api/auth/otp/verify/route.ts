import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/auth-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: "Email address and 6-digit verification code are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();

    if (cleanCode.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Verification code must be exactly 6 digits." },
        { status: 400 }
      );
    }

    const isValid = AuthService.verifyOtp(cleanEmail, cleanCode);

    if (!isValid) {
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
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to verify code" },
      { status: 500 }
    );
  }
}
