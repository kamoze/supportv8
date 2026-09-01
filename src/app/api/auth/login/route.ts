import { NextRequest, NextResponse } from "next/server";
import { credentialStore } from "@/lib/auth/credential-store";
import { AuthService } from "@/lib/auth-service";
import {
  mapRealmRolesToSupportRole,
  supportOperatorDisplayName,
  supportRolesFromClaims,
  verifyKeycloakPassword,
} from "@/lib/auth/keycloak";
import { tenantIdFromSlug, tenantSlugFromId } from "@/lib/auth/request-tenant";

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

    const cleanEmail = email.trim().toLowerCase();
    let user;
    let keycloakAccessToken: string | undefined;
    let tokenExpiresAt: number | undefined;

    // Production identity and tenant membership come directly from Keycloak.
    // The process-local credential store is only a test/development adapter.
    if (process.env.NODE_ENV === "production") {
      const keycloak = await verifyKeycloakPassword(cleanEmail, password);
      if (!keycloak.ok || !keycloak.accessToken) {
        return NextResponse.json(
          { success: false, error: "Identity provider authentication failed." },
          { status: 401 }
        );
      }

      const claimTenant =
        keycloak.decodedClaims?.tenant_id ||
        keycloak.decodedClaims?.attributes?.tenant_id?.[0];
      if (typeof claimTenant !== "string") {
        return NextResponse.json(
          { success: false, error: "Identity provider tenant claim is missing or invalid." },
          { status: 403 }
        );
      }

      let resolvedTenantSlug: string;
      try {
        resolvedTenantSlug = tenantSlugFromId(claimTenant);
      } catch {
        return NextResponse.json(
          { success: false, error: "Identity provider tenant claim is missing or invalid." },
          { status: 403 }
        );
      }
      if (
        tenantSlug &&
        tenantSlug.trim().toLowerCase() !== "global" &&
        claimTenant !== tenantIdFromSlug(tenantSlug)
      ) {
        return NextResponse.json(
          { success: false, error: "Authenticated tenant claim does not match this workspace." },
          { status: 403 }
        );
      }

      const role = mapRealmRolesToSupportRole(
        supportRolesFromClaims(keycloak.decodedClaims || {})
      );
      if (!role) {
        return NextResponse.json(
          { success: false, error: "A SupportV8 role is required for this workspace." },
          { status: 403 }
        );
      }
      const operatorDisplayName = supportOperatorDisplayName(
        keycloak.decodedClaims || {},
        resolvedTenantSlug,
      );
      const localMetadata = credentialStore.getUserByEmail(cleanEmail, resolvedTenantSlug);
      user =
        localMetadata?.tenantSlug === resolvedTenantSlug
          ? { ...localMetadata, name: operatorDisplayName, role }
          : {
              id: String(keycloak.decodedClaims?.sub || cleanEmail),
              email: cleanEmail,
              name: operatorDisplayName,
              tenantSlug: resolvedTenantSlug,
              role,
            };
      keycloakAccessToken = keycloak.accessToken;
      tokenExpiresAt = Number(keycloak.decodedClaims?.exp || 0) * 1000 || undefined;
    } else {
      const authResult = await credentialStore.authenticate(cleanEmail, password, tenantSlug);
      if (!authResult.success || !authResult.user) {
        return NextResponse.json(
          { success: false, error: authResult.error || "Invalid credentials." },
          { status: 401 }
        );
      }
      user = authResult.user;
    }

    const session = AuthService.createSession(
      user.tenantSlug,
      user.email,
      user.role,
      user.name,
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
      { success: false, error: "Authentication service is temporarily unavailable." },
      { status: 500 }
    );
  }
}
