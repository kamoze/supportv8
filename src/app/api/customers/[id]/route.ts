import { NextRequest, NextResponse } from "next/server";
import { resolveRequestTenant, RequestAuthError, type RequestTenantContext } from "@/lib/auth/request-tenant";
import { customerService } from "@/lib/services/customer-service";
import type { CustomerSourceSystem, CustomerTier, CustomerUpdateInput } from "@/lib/types";

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
    throw new RequestAuthError("Insufficient permissions to access customer directory.", 403);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    requireCustomerAccess(tenant);

    const customer = await customerService.getCustomerById(tenant.tenantId, id);
    if (!customer) {
      return NextResponse.json({ success: false, error: `Customer ${id} not found` }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: customer });
  } catch (err: unknown) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to retrieve customer" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    requireCustomerAccess(tenant);

    const body = await req.json();
    const { name, companyName, email, phone, customerTier, sourceSystem, externalCustomerRef, metadata } = body;

    const updates: CustomerUpdateInput = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (companyName !== undefined) updates.companyName = String(companyName).trim();
    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return NextResponse.json({ success: false, error: "A valid email address is required" }, { status: 400 });
      }
      updates.email = cleanEmail;
    }
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (customerTier !== undefined) updates.customerTier = customerTier as CustomerTier;
    if (sourceSystem !== undefined) updates.sourceSystem = sourceSystem as CustomerSourceSystem;
    if (externalCustomerRef !== undefined) updates.externalCustomerRef = String(externalCustomerRef).trim();
    if (metadata !== undefined && typeof metadata === "object") updates.metadata = metadata;

    const updated = await customerService.updateCustomer(tenant.tenantId, id, updates);

    return NextResponse.json({
      success: true,
      message: `Customer ${updated.name} updated successfully`,
      data: updated,
    });
  } catch (err: unknown) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update customer" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    requireCustomerAccess(tenant);

    const deleted = await customerService.deleteCustomer(tenant.tenantId, id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: `Customer ${id} not found` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Customer ${id} deleted successfully`,
    });
  } catch (err: unknown) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to delete customer" },
      { status: 400 }
    );
  }
}
