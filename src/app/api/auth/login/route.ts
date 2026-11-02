import { nativeLoginAuthority } from "@/lib/auth/native-login-authority";
import { NextRequest, NextResponse } from "next/server";
import { credentialStore } from "@/lib/auth/credential-store";
import { AuthService } from "@/lib/auth-service";
import {
  mapRealmRolesToSupportRole,
  supportOperatorDisplayName,
  supportRolesFromClaims,
  verifyKeycloakPassword,
} from "@/lib/auth/keycloak";
import { authBotChallenge, authJson, botProofFailure } from "@/lib/auth/bot-challenge";
import { BotProofError } from "@/lib/auth/bot-transaction";

async function authenticate(req: NextRequest) {
  try {
    const body = await authJson(req);
    const { email, password, tenantSlug } = body;

    if (typeof email !== "string" || !email || email.length > 254 || typeof password !== "string" || !password || password.length > 256 || typeof tenantSlug !== "string") {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const registered = await authBotChallenge.consume(req, "signin", body);

    const cleanEmail = email.trim().toLowerCase();
    let user;
    let keycloakAccessToken: string | undefined;
    let keycloakRefreshToken: string | undefined;
    let refreshExpiresIn: number | undefined;
    let tokenExpiresAt: number | undefined;

    // Keycloak verifies identity; fresh Registry membership and the persisted native binding authorize this workspace.
    // The process-local credential store is only a test/development adapter.
    if (process.env.NODE_ENV === "production") {
      const keycloak = await verifyKeycloakPassword(cleanEmail, password);
      if (!keycloak.ok || !keycloak.accessToken) {
        return NextResponse.json(
          { success: false, error: "Identity provider authentication failed." },
          { status: 401 }
        );
      }

      const current = await nativeLoginAuthority.current(registered, keycloak.decodedClaims, req);
      const resolvedTenantSlug = current.slug;

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
      keycloakRefreshToken = keycloak.refreshToken;
      refreshExpiresIn = keycloak.refreshExpiresIn;
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
    if (refreshExpiresIn) {
      session.expiresAt = Date.now() + Math.min(refreshExpiresIn, 8 * 60 * 60) * 1000;
    }

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
    if (keycloakRefreshToken) {
      response.cookies.set("sv8_refresh_token", keycloakRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api/auth",
        maxAge: Math.max(60, Math.min(refreshExpiresIn || 8 * 60 * 60, 8 * 60 * 60)),
      });
    }
    return response;
  } catch (err: unknown) {
    if (err instanceof BotProofError) return botProofFailure(err);
    return NextResponse.json(
      { success: false, error: "Authentication service is temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const response = await authenticate(req);
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}
