import { NextRequest, NextResponse } from "next/server";
import { extractClientToken, verifyClientToken } from "@/lib/auth/client-token";
import { customerService } from "@/lib/services/customer-service";

export async function GET(req: NextRequest) {
  const token = extractClientToken(req);

  if (!token) {
    return NextResponse.json(
      { success: false, authenticated: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const payload = verifyClientToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, authenticated: false, error: "Invalid or expired session token" },
      { status: 401 }
    );
  }

  // Lookup existing customer profile or construct from session claims
  let customer = await customerService.getCustomerByEmail(payload.tenantSlug, payload.email);
  if (!customer) {
    customer = {
      id: payload.customerId,
      tenantId: payload.tenantSlug,
      name: payload.name || payload.email.split("@")[0],
      companyName: payload.company || payload.companyName || "",
      email: payload.email,
      phone: "",
      customerTier: "standard",
      sourceSystem: "local",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    customer,
  });
}
