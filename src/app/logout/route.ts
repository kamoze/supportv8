import { NextRequest, NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { staffPresence } from "@/lib/chat/staff-presence";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const tenantContext = await resolveRequestTenant(req, { requireAuthentication: true });
    await staffPresence.remove(tenantContext).catch(() => {});
  } catch {}

  const response = NextResponse.redirect(new URL("/", req.url), 303);
  for (const [name, path] of [
    ["sv8_access_token", "/"],
    ["__Host-sv8_runtime_support", "/"],
    ["sv8_refresh_token", "/api/auth"],
  ] as const) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path,
      maxAge: 0,
    });
  }
  return response;
}

export async function GET(req: NextRequest) {
  return POST(req);
}
