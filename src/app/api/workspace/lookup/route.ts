import { workspaceDiscoveryLimiter } from "@/lib/auth/workspace-discovery-limit";
import { discoverWorkspace } from "@/lib/auth/workspace-discovery";
import { authJson } from "@/lib/auth/bot-challenge";
import { NextRequest, NextResponse } from "next/server";
import {
  validateIngressHost,
  isTrustedServiceV8Hostname,
} from "@/lib/tenant-host";
import {
  WorkspaceLookupError,
} from "@/lib/tenant-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const hostCheck = validateIngressHost(
    req.headers.get("host"),
    req.headers.get("x-forwarded-host")
  );
  if (!hostCheck.valid) {
    return NextResponse.json({ error: hostCheck.error }, { status: hostCheck.status || 400 });
  }

  const url = new URL(req.url);
  const rawSlug = url.searchParams.get("workspace") || url.searchParams.get("slug");
  if (!rawSlug || rawSlug.length > 63 || url.searchParams.size !== 1 || !["workspace", "slug"].includes([...url.searchParams.keys()][0])) {
    return NextResponse.json({ error: "missing_workspace_slug" }, { status: 400 });
  }

  const acceptHeader = req.headers.get("accept") || "";
  const wantsHtml = acceptHeader.includes("text/html");

  try {
    await workspaceDiscoveryLimiter.enforce(rawSlug);
    const tenant = await discoverWorkspace(rawSlug);
    if (!tenant) {
      if (wantsHtml) {
        return new NextResponse(
          `<!DOCTYPE html><html><head><title>Workspace Not Found</title></head><body><h1>Workspace not found</h1><p>Requested workspace: <code>${encodeURIComponent(rawSlug)}</code> does not exist.</p></body></html>`,
          { status: 404, headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { success: false, error: "workspace_not_found", message: `Workspace '${rawSlug}' not found.` },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (wantsHtml) {
      const res = NextResponse.redirect(tenant.url, 302);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    return NextResponse.json(
      {
        success: true,
        slug: tenant.slug,
        name: tenant.name,
        redirectUrl: tenant.url,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (err instanceof WorkspaceLookupError) {
      if (wantsHtml) {
        const heading = err.code === "workspace_owner_verification_required" ? "Workspace owner verification required" : err.status === 503 ? "Temporarily unavailable" : "Error";
        return new NextResponse(
          `<!DOCTYPE html><html><head><title>${heading}</title></head><body><h1>${heading}</h1><p>${err.message}</p></body></html>`,
          { status: err.status, headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { success: false, error: err.code, message: err.message },
        { status: err.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (wantsHtml) {
      return new NextResponse(
        `<!DOCTYPE html><html><head><title>Temporarily Unavailable</title></head><body><h1>Temporarily unavailable</h1></body></html>`,
        { status: 503, headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { success: false, error: "workspace_lookup_unavailable", message: "Temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(req: NextRequest) {
  const hostCheck = validateIngressHost(
    req.headers.get("host"),
    req.headers.get("x-forwarded-host")
  );
  if (!hostCheck.valid) {
    return NextResponse.json({ error: hostCheck.error }, { status: hostCheck.status || 400 });
  }

  // Validate Origin if present
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (!isTrustedServiceV8Hostname(originHost)) {
        return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
    }
  }

  let body: any;
  try {
    body = await authJson(req);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawSlug = body.workspace || body.slug;
  if (!rawSlug || typeof rawSlug !== "string" || rawSlug.length > 63 || Object.keys(body).length !== 1 || !["workspace", "slug"].includes(Object.keys(body)[0])) {
    return NextResponse.json({ error: "missing_workspace_slug" }, { status: 400 });
  }

  try {
    await workspaceDiscoveryLimiter.enforce(rawSlug);
    const tenant = await discoverWorkspace(rawSlug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "workspace_not_found", message: `Workspace '${rawSlug}' not found.` },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        slug: tenant.slug,
        name: tenant.name,
        redirectUrl: tenant.url,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (err instanceof WorkspaceLookupError) {
      return NextResponse.json(
        { success: false, error: err.code, message: err.message },
        { status: err.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { success: false, error: "workspace_lookup_unavailable", message: "Temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
