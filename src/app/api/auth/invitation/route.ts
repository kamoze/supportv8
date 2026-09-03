import { NextResponse } from "next/server";
import { accountError, requireSameOrigin } from "@/lib/auth/account-error";
import { accountMembers, AccountError } from "@/lib/auth/account-members";
import { browserTenantSlugFromHostname } from "@/lib/tenant-host";
import { tenantIdFromSlug } from "@/lib/auth/request-tenant";

// No GET handler: previews and email scanners cannot consume or activate links.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const slug = browserTenantSlugFromHostname(request.headers.get("host") || new URL(request.url).host);
    if (!slug) throw new AccountError("Open the invitation on your workspace’s SupportV8 address.", 403);
    const raw = await request.text();
    if (raw.length > 4096) throw new AccountError("Invalid account setup request.", 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new AccountError("Invalid account setup request."); }
    if (!body || typeof body.token !== "string" || body.token.length > 129) throw new AccountError("Invalid invitation.");
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const result = await accountMembers.acceptInvitation(tenantIdFromSlug(slug), body.token, body.password, ip);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return accountError(error); }
}
