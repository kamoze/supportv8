import { NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { accountMembers, AccountError } from "@/lib/auth/account-members";
import { accountError, requireSameOrigin } from "@/lib/auth/account-error";

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestTenant(request, { requireAuthentication: true });
    const first = Number(new URL(request.url).searchParams.get("first") || 0);
    if (!Number.isSafeInteger(first) || first < 0 || first > 100_000) throw new AccountError("Invalid page.");
    return NextResponse.json({ success: true, ...await accountMembers.list(ctx, first) });
  } catch (error) { return accountError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const ctx = await resolveRequestTenant(request, { requireAuthentication: true });
    const body = await request.json();
    if (body.action === "resend_invite") {
      if (typeof body.memberId !== "string" || !body.memberId) throw new AccountError("Member ID is required.");
      await accountMembers.resendInvite(ctx, body.memberId);
      return NextResponse.json({ success: true, invitationSent: true });
    }
    return NextResponse.json({ success: true, ...await accountMembers.invite(ctx, body) }, { status: 201 });
  } catch (error) { return accountError(error); }
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    const ctx = await resolveRequestTenant(request, { requireAuthentication: true });
    const { memberId, updates } = await request.json();
    if (typeof memberId !== "string" || !memberId || !updates || typeof updates !== "object") throw new AccountError("Member ID and updates are required.");
    return NextResponse.json({ success: true, member: await accountMembers.update(ctx, memberId, updates) });
  } catch (error) { return accountError(error); }
}
