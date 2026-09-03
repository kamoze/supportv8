import { NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { requireAccountManager } from "@/lib/auth/account-members";
import { accountError } from "@/lib/auth/account-error";
import { staffPresence } from "@/lib/chat/staff-presence";

// Legacy browser-only groups never governed permissions. Do not expose their
// seeded membership or accept local group changes as authoritative RBAC.
export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestTenant(request, { requireAuthentication: true });
    requireAccountManager(ctx);
    return NextResponse.json({ success: true, groups: [], staff: await staffPresence.list(ctx.tenantId) });
  } catch (error) { return accountError(error); }
}
export async function POST(request: Request) {
  try {
    const ctx = await resolveRequestTenant(request, { requireAuthentication: true });
    requireAccountManager(ctx);
    return NextResponse.json({ success: false, error: "Use Members to manage account roles. Custom routing groups are not configured." }, { status: 409 });
  } catch (error) { return accountError(error); }
}
export const PUT = POST;
