import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/auth-service";
import {
  DemoRateLimitError,
  DemoRateLimitUnavailableError,
  demoRateLimiter,
  requestClientIdentity,
} from "@/lib/auth/demo-rate-limit";
import {
  issueKeycloakDemoAccessToken,
  mapRealmRolesToSupportRole,
  supportRolesFromClaims,
} from "@/lib/auth/keycloak";

const DEMO_TENANTS = new Set(["acme", "meridian"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantSlug = String(body.tenantSlug || "").trim().toLowerCase();
    if (!DEMO_TENANTS.has(tenantSlug)) {
      return NextResponse.json(
        { success: false, error: "Demo access is not available for this workspace." },
        { status: 400 }
      );
    }

    await demoRateLimiter.enforce({
      action: "access",
      tenantId: `tenant_${tenantSlug}`,
      clientIdentity: requestClientIdentity(request),
      perMinute: 5,
      perHour: 20,
    });

    const tokenResult = await issueKeycloakDemoAccessToken(tenantSlug as "acme" | "meridian");
    if (!tokenResult.ok) {
      return NextResponse.json(
        { success: false, error: "Demo identity is temporarily unavailable." },
        { status: 503 }
      );
    }

    const roles = supportRolesFromClaims(
      tokenResult.decodedClaims,
      `supportv8-demo-${tenantSlug}`
    );
    const role = mapRealmRolesToSupportRole(roles);
    if (!role || !roles.includes("support_demo_operator")) {
      return NextResponse.json(
        { success: false, error: "Demo identity is missing its restricted operator role." },
        { status: 403 }
      );
    }

    const email = `demo@${tenantSlug}.support.servicev8.com`;
    const demoOperatorName = tenantSlug === "acme" ? "Acme Demo Operator" : "Meridian Demo Operator";
    const session = AuthService.createSession(tenantSlug, email, role, demoOperatorName);
    session.expiresAt = Date.now() + tokenResult.expiresIn * 1000;

    const response = NextResponse.json({
      success: true,
      session,
      user: {
        email,
        name: demoOperatorName,
        tenantSlug,
        role,
        demo: true,
      },
    });
    response.cookies.set("sv8_access_token", tokenResult.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: tokenResult.expiresIn,
    });
    return response;
  } catch (error) {
    if (error instanceof DemoRateLimitError || error instanceof DemoRateLimitUnavailableError) {
      const headers = error instanceof DemoRateLimitError
        ? { "Retry-After": String(error.retryAfterSeconds) }
        : undefined;
      return NextResponse.json(
        { success: false, error: error.message },
        {
          status: error.status,
          ...(headers ? { headers } : {}),
        }
      );
    }
    return NextResponse.json(
      { success: false, error: "Demo authentication is temporarily unavailable." },
      { status: 503 }
    );
  }
}
