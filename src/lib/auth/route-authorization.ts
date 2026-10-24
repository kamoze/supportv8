import { NextResponse } from "next/server";
import {
  RequestAuthError,
  resolveRequestTenant,
  type RequestTenantContext,
} from "./request-tenant";

export const MVP_READ_ROLES = [
  "support_observer",
  "support_operator",
  "support_cx_lead",
  "support_superadmin",
] as const;

export const MVP_MANAGE_ROLES = [
  "support_operator",
  "support_cx_lead",
  "support_superadmin",
] as const;

function hasPermittedRole(
  roles: string[] | undefined,
  permitted: readonly string[]
): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((role) => permitted.includes(role));
}

export async function authorizeMvpRead(
  request: Request
): Promise<RequestTenantContext> {
  const context = await resolveRequestTenant(request, {
    requireAuthentication: true,
  });

  if (context.authenticated && !hasPermittedRole(context.roles, MVP_READ_ROLES)) {
    throw new RequestAuthError("Forbidden", 403);
  }

  return context;
}

export async function authorizeMvpManage(
  request: Request
): Promise<RequestTenantContext> {
  const context = await resolveRequestTenant(request, {
    requireAuthentication: true,
  });

  if (
    context.authenticated &&
    !hasPermittedRole(context.roles, MVP_MANAGE_ROLES)
  ) {
    throw new RequestAuthError("Forbidden", 403);
  }

  return context;
}

export function requestAuthResponse(error: unknown): NextResponse | undefined {
  if (error instanceof RequestAuthError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status }
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    ((error as { status: unknown }).status === 401 ||
      (error as { status: unknown }).status === 403)
  ) {
    const status = (error as { status: 401 | 403 }).status;
    const message =
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : status === 403
        ? "Forbidden"
        : "Unauthorized";

    return NextResponse.json({ success: false, error: message }, { status });
  }

  return undefined;
}
