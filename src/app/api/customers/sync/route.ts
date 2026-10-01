import { NextRequest, NextResponse } from "next/server";
import { resolveRequestTenant, RequestAuthError, type RequestTenantContext } from "@/lib/auth/request-tenant";
import { customerService } from "@/lib/services/customer-service";

export const dynamic = "force-dynamic";

function requireCustomerAccess(tenant: RequestTenantContext) {
  if (process.env.NODE_ENV !== "production" && !tenant.authenticated) return;
  const allowed = [
    "support_superadmin",
    "support_cx_lead",
    "support_operator",
    "support_observer",
    "support_contractor_lead",
    "support_contractor",
    "support_technician",
    "support_demo_operator",
  ];
  if (!tenant.roles.some((r) => allowed.includes(r))) {
    throw new RequestAuthError("Insufficient permissions to sync customer directory.", 403);
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    requireCustomerAccess(tenant);

    const body = await req.json().catch(() => ({}));
    const sourceSystem = body.sourceSystem || "all";

    const validSources = ["all", "stripe", "zendesk", "intercom", "orderv8", "shopify"];
    if (!validSources.includes(sourceSystem)) {
      return NextResponse.json(
        { success: false, error: `Invalid sourceSystem: ${sourceSystem}. Must be one of: ${validSources.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await customerService.syncFromTargetSystems(tenant.tenantId, { sourceSystem });

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${result.createdCount} new and ${result.updatedCount} existing customer records from ${sourceSystem.toUpperCase()}.`,
      data: result,
    });
  } catch (err: unknown) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Customer sync failed" },
      { status: 500 }
    );
  }
}
