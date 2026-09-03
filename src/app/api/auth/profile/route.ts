import { NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { accountMembers } from "@/lib/auth/account-members";
import { accountError, requireSameOrigin } from "@/lib/auth/account-error";

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestTenant(request, { requireAuthentication: true });
    return NextResponse.json({ success: true, profile: await accountMembers.profile(ctx) });
  } catch (error) { return accountError(error); }
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    const ctx = await resolveRequestTenant(request, { requireAuthentication: true });
    const { firstName, nickname } = await request.json();
    return NextResponse.json({ success: true, profile: await accountMembers.profile(ctx, { firstName, nickname }) });
  } catch (error) { return accountError(error); }
}
