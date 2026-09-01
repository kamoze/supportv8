import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  browserTenantSlugFromHostname,
  isTrustedServiceV8Hostname,
} from "@/lib/tenant-host";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // Public chat intake is only accepted on an exact ServiceV8 tenant or root
  // hostname. This prevents a forged Host such as tenant.support.attacker.tld
  // from becoming trusted tenant context.
  if (url.pathname.startsWith("/api/chat/") && !isTrustedServiceV8Hostname(hostname)) {
    return NextResponse.json({ error: "Unknown SupportV8 host" }, { status: 421 });
  }

  const tenantDomain = browserTenantSlugFromHostname(hostname) || "tenant_default";

  // Overwrite, rather than trust, any inbound tenant header. Route handlers use
  // this request header as the public-host tenant boundary.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-servicev8-tenant-domain", tenantDomain);
  requestHeaders.delete("x-tenant-id");
  requestHeaders.delete("x-tenant-slug");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-servicev8-tenant-domain", tenantDomain);
  response.headers.set("x-servicev8-vertical", "supportv8");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
