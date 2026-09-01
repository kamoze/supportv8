import { NextRequest, NextResponse } from "next/server";
import { credentialStore } from "@/lib/auth/credential-store";
import { AuthService } from "@/lib/auth-service";
import { verifyKeycloakPassword } from "@/lib/auth/keycloak";
import { tenantIdFromSlug } from "@/lib/auth/request-tenant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, tenantSlug } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const authResult = await credentialStore.authenticate(email, password, tenantSlug);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Invalid credentials." },
        { status: 401 }
      );
    }

    const user = authResult.user;
    let keycloakAccessToken: string | undefined;
    let tokenExpiresAt: number | undefined;

    // Production operator sessions are always backed by a signed Keycloak
    // access token. A matching local password record is not an authorization
    // boundary and cannot select a database tenant.
    if (process.env.NODE_ENV === "production") {
      const keycloak = await verifyKeycloakPassword(email, password);
      if (!keycloak.ok || !keycloak.accessToken) {
        return NextResponse.json(
          { success: false, error: "Identity provider authentication failed." },
          { status: 401 }
        );
      }

      const claimTenant =
        keycloak.decodedClaims?.tenant_id ||
        keycloak.decodedClaims?.attributes?.tenant_id?.[0];
      if (claimTenant !== tenantIdFromSlug(user.tenantSlug)) {
        return NextResponse.json(
          { success: false, error: "Authenticated tenant claim does not match this workspace." },
          { status: 403 }
        );
      }
      keycloakAccessToken = keycloak.accessToken;
      tokenExpiresAt = Number(keycloak.decodedClaims?.exp || 0) * 1000 || undefined;
    }

    const session = AuthService.createSession(
      user.tenantSlug,
      user.email,
      user.role
    );

    const response = NextResponse.json({
      success: true,
      message: `Successfully authenticated as ${user.name}`,
      session,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantSlug: user.tenantSlug,
        role: user.role,
      },
    });
    if (keycloakAccessToken) {
      response.cookies.set("sv8_access_token", keycloakAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: Math.max(60, Math.floor(((tokenExpiresAt || Date.now() + 8 * 60 * 60 * 1000) - Date.now()) / 1000)),
      });
    }
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Authentication error" },
      { status: 500 }
    );
  }
}
