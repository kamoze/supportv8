import { NextResponse } from "next/server";
import { accountError, requireSameOrigin } from "@/lib/auth/account-error";
import { AccountError, requireAccountManager } from "@/lib/auth/account-members";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { portalRepository, PortalRevisionConflictError } from "@/lib/db/portal-repository";
import { parsePortalConfig, PortalConfigError } from "@/lib/portal/config";

function portalAdminError(error: unknown) {
  if (error instanceof PortalConfigError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  if (error instanceof PortalRevisionConflictError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return accountError(error);
}

function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new AccountError("A valid portal revision is required.");
  }
  return Number(value);
}

export async function GET(request: Request) {
  try {
    const tenant = await resolveRequestTenant(request, { requireAuthentication: true });
    requireAccountManager(tenant);
    return NextResponse.json({ success: true, ...(await portalRepository.getDraft(tenant.tenantId, tenant.tenantSlug)) });
  } catch (error) {
    return portalAdminError(error);
  }
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    const tenant = await resolveRequestTenant(request, { requireAuthentication: true });
    requireAccountManager(tenant);
    const body = await request.json().catch(() => ({}));
    const saved = await portalRepository.saveDraft({
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      actorId: tenant.userId!,
      expectedRevision: revision(body.expectedRevision),
      config: parsePortalConfig(body.config),
    });
    return NextResponse.json({ success: true, ...saved });
  } catch (error) {
    return portalAdminError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const tenant = await resolveRequestTenant(request, { requireAuthentication: true });
    requireAccountManager(tenant);
    const body = await request.json().catch(() => ({}));
    if (body.action !== "publish") throw new AccountError("Unsupported portal action.");
    const published = await portalRepository.publish({
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      actorId: tenant.userId!,
      expectedRevision: revision(body.expectedRevision),
    });
    return NextResponse.json({ success: true, ...published });
  } catch (error) {
    return portalAdminError(error);
  }
}
