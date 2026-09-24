import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  browserTenantSlugFromHostname,
  isTrustedServiceV8Hostname,
} from "@/lib/tenant-host";

const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEMO_MUTATION_PATHS = new Set([
  "/api/auth/demo",
  "/api/auth/logout",
  "/auth/runtime/logout",
  "/api/chat",
  "/api/chat/draft",
  "/api/chat/message",
  "/api/chat/session",
  "/api/leads/demo-access",
]);

/**
 * This is a deny-only edge check. Route handlers still verify the JWT
 * signature and tenant claims before granting access. A forged token can only
 * avoid this early denial; it cannot gain access to a protected route.
 */
function tokenHasDemoOperatorRole(token: string | undefined): boolean {
  if (!token) return false;

  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return false;
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as {
      realm_access?: { roles?: unknown };
      resource_access?: Record<string, { roles?: unknown }>;
    };
    const realmRoles = claims.realm_access?.roles;
    if (
      Array.isArray(realmRoles) &&
      realmRoles.includes("support_demo_operator")
    ) {
      return true;
    }

    return Object.values(claims.resource_access || {}).some(
      (access) =>
        Array.isArray(access?.roles) &&
        access.roles.includes("support_demo_operator"),
    );
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : undefined;
  const hasRuntimeSession = request.cookies.has("__Host-sv8_runtime_support");
  // Deny-only migration boundary: these native mutations already revalidate the
  // handoff through resolveRequestTenant. Older global/demo stores cannot write
  // on behalf of a linked workspace until their tenant storage is integrated.
  const scopedRuntimeMutations = new Set([
    "/api/issues", "/api/presence", "/api/auth/profile", "/api/auth/logout",
    "/api/members", "/api/groups",
    "/api/chat", "/api/chat/session", "/api/chat/message", "/api/chat/draft", "/api/chat/stream",
    "/api/knowledge", "/api/knowledge/chunks", "/api/knowledge/curate",
    "/api/knowledge/upload", "/api/knowledge/s3-source", "/api/knowledge/crawl", "/api/knowledge/query",
    "/api/marketplace",
  ]);
  if (hasRuntimeSession && !SAFE_HTTP_METHODS.has(request.method) && url.pathname.startsWith("/api/")
    && !url.pathname.startsWith("/api/runtime/") && !scopedRuntimeMutations.has(url.pathname)) {
    return NextResponse.json({success:false,error:"This operation is not connected to this workspace's tenant storage."},{status:403});
  }
  const presentedAccessToken =
    bearer || request.cookies.get("sv8_access_token")?.value;

  if (
    !SAFE_HTTP_METHODS.has(request.method) &&
    !hasRuntimeSession &&
    tokenHasDemoOperatorRole(presentedAccessToken) &&
    !DEMO_MUTATION_PATHS.has(url.pathname)
  ) {
    return NextResponse.json(
      { error: "Demo operators cannot change shared workspace data" },
      { status: 403 },
    );
  }

  // Public chat intake is only accepted on an exact ServiceV8 tenant or root
  // hostname. This prevents a forged Host such as tenant.support.attacker.tld
  // from becoming trusted tenant context.
  if (
    url.pathname.startsWith("/api/chat/") &&
    !isTrustedServiceV8Hostname(hostname)
  ) {
    return NextResponse.json(
      { error: "Unknown SupportV8 host" },
      { status: 421 },
    );
  }

  const hostedTenant = browserTenantSlugFromHostname(hostname);
  const inboundTenant = (request.headers.get("x-servicev8-tenant-domain") || url.searchParams.get("tenant") || "").trim().toLowerCase();
  const validInboundTenant = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(inboundTenant) && !["www", "support", "localhost"].includes(inboundTenant) ? inboundTenant : null;
  const tenantDomain = hostedTenant || validInboundTenant || "tenant_default";

  // Overwrite, rather than trust, any inbound tenant header. Route handlers use
  // this request header as the public-host tenant boundary.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-servicev8-tenant-domain", tenantDomain);
  requestHeaders.delete("x-tenant-id");
  requestHeaders.delete("x-tenant-slug");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-servicev8-tenant-domain", tenantDomain);
  response.headers.set("x-servicev8-vertical", "supportv8");
  if (["/accept-invite", "/signup"].includes(url.pathname)) {
    response.headers.set(
      "Content-Security-Policy",
      "connect-src 'self'; form-action 'self'; frame-src 'none'; base-uri 'self'; frame-ancestors 'self'",
    );
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
