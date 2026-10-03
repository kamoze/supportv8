import { NextRequest, NextResponse } from "next/server";
import { otpStore, OtpStoreUnavailableError } from "@/lib/auth/otp-store";
import { signClientToken } from "@/lib/auth/client-token";
import { customerService } from "@/lib/services/customer-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code, tenantSlug } = body || {};

    if (!email || !code || !tenantSlug) {
      return NextResponse.json(
        {
          success: false,
          error: "Email address, workspace, and 6-digit verification code are required.",
        },
        { status: 400 }
      );
    }

    const cleanEmail = email.toString().trim().toLowerCase();
    const cleanCode = code.toString().trim();
    const cleanTenantSlug = tenantSlug.toString().trim().toLowerCase();

    if (!/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json(
        { success: false, error: "Verification code must be exactly 6 digits." },
        { status: 400 }
      );
    }

    const isValid = await otpStore.verify(
      "client-access",
      cleanEmail,
      cleanCode,
      cleanTenantSlug
    );

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired verification code. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // Lookup customer in repository, or create a default client profile
    let customer = await customerService.getCustomerByEmail(cleanTenantSlug, cleanEmail);
    if (!customer) {
      try {
        customer = await customerService.createCustomer(cleanTenantSlug, {
          name: cleanEmail.split("@")[0],
          email: cleanEmail,
          companyName: "",
          sourceSystem: "local",
          customerTier: "standard",
        });
      } catch {
        // Fallback in case of mock/isolated mode
        customer = {
          id: `cust_${Math.random().toString(36).slice(2, 11)}`,
          tenantId: cleanTenantSlug,
          name: cleanEmail.split("@")[0],
          companyName: "",
          email: cleanEmail,
          phone: "",
          customerTier: "standard",
          sourceSystem: "local",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const clientToken = signClientToken({
      email: cleanEmail,
      tenantSlug: cleanTenantSlug,
      customerId: customer.id,
      name: customer.name,
      company: customer.companyName,
      companyName: customer.companyName,
    });

    const response = NextResponse.json({
      success: true,
      clientToken,
      customer,
    });

    response.cookies.set("sv8_client_token", clientToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err: unknown) {
    const status = err instanceof OtpStoreUnavailableError ? err.status : 500;
    const message =
      err instanceof OtpStoreUnavailableError
        ? err.message
        : "Verification service is temporarily unavailable. Please try again.";

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
