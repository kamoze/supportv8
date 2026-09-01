import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // Extract tenant from subdomain: <tenant>.support.servicev8.com or <tenant>.support.servicev8.internal
  let tenantDomain = "tenant_default";
  if (hostname.includes(".support.servicev8.com") || hostname.includes(".support.servicev8.internal") || hostname.includes(".support.")) {
    const parts = hostname.split(".support.");
    const sub = parts[0]?.toLowerCase().trim();
    if (sub && sub !== "support" && sub !== "www" && sub !== "localhost") {
      tenantDomain = sub;
    }
  }

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
