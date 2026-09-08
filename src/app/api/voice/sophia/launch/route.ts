import { NextRequest, NextResponse } from "next/server";

import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import { pgClient } from "@/lib/db/pg-client";
import {
  resolveSophiaLaunch,
  supportPlatformEnvironment,
} from "@/lib/voice/support-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenant = await resolveRequestTenant(request, { requireAuthentication: true });
    if (!tenant.userId) throw new RequestAuthError("Operator authentication is required");

    const launch = await resolveSophiaLaunch({
      env: supportPlatformEnvironment(),
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      identitySubject: tenant.userId,
    });

    const linked = await pgClient.withTenantSession(tenant.tenantId, (db) =>
      db.query<{ id: string }>(
        `UPDATE supportv8.tenants
         SET servicev8_account_id = $2, updated_at = now()
         WHERE id = $1
           AND domain = $3
           AND (servicev8_account_id IS NULL OR servicev8_account_id = $2)
         RETURNING id`,
        [tenant.tenantId, launch.accountId, tenant.tenantSlug],
      ),
    );
    if (linked.length !== 1) {
      return errorResponse("The SupportV8 workspace could not be linked to its platform account", 409);
    }

    const response = NextResponse.redirect(launch.url, { status: 302 });
    response.headers.set("cache-control", "no-store");
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof RequestAuthError) return errorResponse(error.message, error.status);
    return errorResponse("Sophia is temporarily unavailable. Please try again.", 503);
  }
}
