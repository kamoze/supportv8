import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/auth-service";
import {
  mapRealmRolesToSupportRole,
  refreshKeycloakAccessToken,
  supportOperatorDisplayName,
  supportRolesFromClaims,
} from "@/lib/auth/keycloak";
import { tenantSlugFromId } from "@/lib/auth/request-tenant";

const MAX_BROWSER_SESSION_SECONDS = 8 * 60 * 60;

function setAccessCookie(response: NextResponse, token: string, maxAge: number) {
  response.cookies.set("sv8_access_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, maxAge),
  });
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("sv8_refresh_token")?.value;

  if (refreshToken) {
    const refreshed = await refreshKeycloakAccessToken(refreshToken);
    if (!refreshed.ok || !refreshed.accessToken || !refreshed.decodedClaims) {
      return NextResponse.json({ success: false, error: "Session renewal failed." }, { status: 401 });
    }
    const tenantId = refreshed.decodedClaims.tenant_id;
    if (typeof tenantId !== "string") {
      return NextResponse.json({ success: false, error: "Session tenant is invalid." }, { status: 403 });
    }
    const tenantSlug = tenantSlugFromId(tenantId);
    const roles = supportRolesFromClaims(refreshed.decodedClaims);
    const role = mapRealmRolesToSupportRole(roles);
    if (!role) {
      return NextResponse.json({ success: false, error: "A SupportV8 role is required." }, { status: 403 });
    }
    const email = String(refreshed.decodedClaims.preferred_username || "operator@support.servicev8.com");
    const name = supportOperatorDisplayName(refreshed.decodedClaims, tenantSlug);
    const session = AuthService.createSession(tenantSlug, email, role, name);
    const browserSeconds = Math.min(refreshed.refreshExpiresIn || MAX_BROWSER_SESSION_SECONDS, MAX_BROWSER_SESSION_SECONDS);
    session.expiresAt = Date.now() + browserSeconds * 1000;
    const response = NextResponse.json({ success: true, session });
    setAccessCookie(response, refreshed.accessToken, refreshed.expiresIn || 5 * 60);
    if (refreshed.refreshToken) {
      response.cookies.set("sv8_refresh_token", refreshed.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth",
        maxAge: browserSeconds,
      });
    }
    return response;
  }

  return NextResponse.json({ success: false, error: "No renewable session is available." }, { status: 401 });
}
