import { NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { requireAccountIdentity } from "@/lib/auth/account-members";
import { staffPresence } from "@/lib/chat/staff-presence";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { accountError, requireSameOrigin } from "@/lib/auth/account-error";

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestTenant(request, { requireAuthentication: true });
    requireAccountIdentity(ctx);
    const staff = await staffPresence.list(ctx.tenantId);
    const employees = marketplaceService.getWorkforceCatalog(ctx.tenantSlug)
      .filter(employee => employee.isHired && employee.level === "ai_employee")
      .map(employee => ({ id: employee.id, name: employee.name, kind: "ai", role: employee.role }));
    return NextResponse.json({ success: true, staff, employees });
  } catch (error) { return accountError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const ctx = await resolveRequestTenant(request, { requireAuthentication: true });
    await staffPresence.heartbeat(ctx);
    return NextResponse.json({ success: true });
  } catch (error) { return accountError(error); }
}
