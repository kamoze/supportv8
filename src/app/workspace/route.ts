import { NextRequest, NextResponse } from "next/server";
import { resolveRequestTenant, RequestAuthError } from "@/lib/auth/request-tenant";
import { validateIngressHost } from "@/lib/tenant-host";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const hostCheck = validateIngressHost(
    req.headers.get("host"),
    req.headers.get("x-forwarded-host")
  );
  if (!hostCheck.valid) {
    return NextResponse.json({ error: hostCheck.error }, { status: hostCheck.status || 400 });
  }

  const accept = req.headers.get("accept") || "";
  const wantsHtml = accept.includes("text/html");

  try {
    const tenantContext = await resolveRequestTenant(req, { requireAuthentication: true });
    // Valid session
    if (wantsHtml) {
      return new NextResponse(
        `<!DOCTYPE html><html><head><title>${tenantContext.tenantSlug} - Workspace</title></head><body><div id="support-console">supportv8 console for ${tenantContext.tenantSlug}</div></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      {
        success: true,
        workspace: tenantContext.tenantSlug,
        tenantId: tenantContext.tenantId,
        roles: tenantContext.roles,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (err instanceof RequestAuthError) {
      if (err.status === 403) {
        return NextResponse.json(
          { error: "cross_tenant_session_denied", message: err.message },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
      // Unauthenticated
      if (wantsHtml) {
        return NextResponse.redirect(new URL("/login?next=%2Fworkspace", req.url), 302);
      }
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (wantsHtml) {
      return NextResponse.redirect(new URL("/login?next=%2Fworkspace", req.url), 302);
    }
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}
