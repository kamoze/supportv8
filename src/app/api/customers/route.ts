import { NextRequest, NextResponse } from "next/server";
import { resolveRequestTenant, RequestAuthError, type RequestTenantContext } from "@/lib/auth/request-tenant";
import { customerService } from "@/lib/services/customer-service";
import type { CustomerCreateInput, CustomerSourceSystem, CustomerTier } from "@/lib/types";

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
    throw new RequestAuthError("Insufficient permissions to access customer directory.", 403);
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    requireCustomerAccess(tenant);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const sourceSystem = searchParams.get("source") || searchParams.get("sourceSystem") || undefined;
    const tier = searchParams.get("tier") || undefined;
    const limit = searchParams.get("limit") ? Math.min(500, Math.max(1, Number(searchParams.get("limit")))) : 100;
    const offset = searchParams.get("offset") ? Math.max(0, Number(searchParams.get("offset"))) : 0;

    const customers = await customerService.listCustomers(tenant.tenantId, {
      search,
      sourceSystem,
      tier,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (err: unknown) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load customers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    requireCustomerAccess(tenant);

    const body = await req.json();

    // Check if this is an inline sync dispatch
    if (body.action === "sync") {
      const sourceSystem = body.sourceSystem || "all";
      const result = await customerService.syncFromTargetSystems(tenant.tenantId, { sourceSystem });
      return NextResponse.json({
        success: true,
        message: `Synced ${result.createdCount} new and updated ${result.updatedCount} customers from ${sourceSystem}`,
        data: result,
      });
    }

    const { name, companyName, email, phone, customerTier, sourceSystem, externalCustomerRef, metadata } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Customer name is required" }, { status: 400 });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ success: false, error: "A valid customer email address is required" }, { status: 400 });
    }

    const input: CustomerCreateInput = {
      name: name.trim(),
      companyName: typeof companyName === "string" ? companyName.trim() : "",
      email: email.trim(),
      phone: typeof phone === "string" ? phone.trim() : "",
      customerTier: (customerTier as CustomerTier) || "standard",
      sourceSystem: (sourceSystem as CustomerSourceSystem) || "local",
      externalCustomerRef: typeof externalCustomerRef === "string" ? externalCustomerRef.trim() : undefined,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    };

    const customer = await customerService.createCustomer(tenant.tenantId, input);

    return NextResponse.json(
      {
        success: true,
        message: `Customer ${customer.name} created successfully`,
        data: customer,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to process customer request" },
      { status: 400 }
    );
  }
}
