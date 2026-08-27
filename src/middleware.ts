import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // Extract tenant from subdomain (e.g. acme.support.servicev8.internal) or header
  let tenantDomain = "tenant_default";
  const customHeader = request.headers.get("x-tenant-id");
  if (customHeader) {
    tenantDomain = customHeader;
  } else if (hostname.includes(".support.")) {
    tenantDomain = hostname.split(".")[0];
  }

  const response = NextResponse.next();
  response.headers.set("x-servicev8-tenant-domain", tenantDomain);
  response.headers.set("x-servicev8-vertical", "supportv8");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
