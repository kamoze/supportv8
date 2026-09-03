import { NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { staffPresence } from "@/lib/chat/staff-presence";

export async function POST(request: Request) {
  // Logout still clears cookies if presence is unavailable; its lease expires.
  try { await staffPresence.remove(await resolveRequestTenant(request, { requireAuthentication: true })); } catch { /* expires within 90s */ }
  const response = NextResponse.json({ success: true });
  for (const [name, path] of [
    ["sv8_access_token", "/"],
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
