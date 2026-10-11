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
import {
  validateIngressHost,
  browserTenantSlugFromHostname,
  safeNextPath,
  isTrustedServiceV8Hostname,
} from "@/lib/tenant-host";

export const dynamic = "force-dynamic";

function displayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => `${w[0]?.toUpperCase() || ""}${w.slice(1)}`)
    .join(" ") || "Your organization";
}

export async function GET(req: NextRequest) {
  const hostCheck = validateIngressHost(
    req.headers.get("host"),
    req.headers.get("x-forwarded-host")
  );
  if (!hostCheck.valid) {
    return NextResponse.json({ error: hostCheck.error }, { status: hostCheck.status || 400 });
  }

  const tenantSlug = browserTenantSlugFromHostname(req.headers.get("host") || "");
  const nextPath = safeNextPath(req.nextUrl.searchParams.get("next"));

  const tenantHeader = tenantSlug
    ? `<h1>Welcome to ${displayName(tenantSlug)}</h1><p class="tenant-host">${tenantSlug}.support.servicev8.com</p>`
    : `<h1>Sign In to SupportV8</h1>`;

  const workspaceInput = tenantSlug
    ? `<input type="hidden" name="workspace" value="${tenantSlug}" />`
    : `<div class="form-group">
        <label for="panel-login-workspace">Workspace</label>
        <input id="panel-login-workspace" name="workspace" type="text" autocomplete="organization" placeholder="e.g. acme" required />
       </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Sign In - SupportV8</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <div class="login-card">
    ${tenantHeader}
    <form method="POST" action="/login?next=${encodeURIComponent(nextPath)}" class="support-form">
      ${workspaceInput}
      <div class="form-group">
        <label for="tenant-login-email">Email</label>
        <input id="tenant-login-email" name="email" type="email" autocomplete="email" placeholder="name@company.com" required />
      </div>
      <div class="form-group">
        <label for="tenant-login-password">Password</label>
        <input id="tenant-login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
      </div>
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  const hostCheck = validateIngressHost(
    req.headers.get("host"),
    req.headers.get("x-forwarded-host")
  );
  if (!hostCheck.valid) {
    return NextResponse.json({ error: hostCheck.error }, { status: hostCheck.status || 400 });
  }

  // Validate Origin if present
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (!isTrustedServiceV8Hostname(originHost)) {
        return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
    }
  }

  const contentType = req.headers.get("content-type") || "";
  const nextParam = safeNextPath(req.nextUrl.searchParams.get("next"));

  let email = "";
  let password = "";
  let tenantSlug = browserTenantSlugFromHostname(req.headers.get("host") || "") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    email = params.get("email") || "";
    password = params.get("password") || "";
    if (!tenantSlug) tenantSlug = params.get("workspace") || params.get("tenantSlug") || "";
  } else {
    try {
      const body = await req.json();
      email = body.email || "";
      password = body.password || "";
      if (!tenantSlug) tenantSlug = body.workspace || body.tenantSlug || "";
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Missing email or password" }, { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();
  let user: any;
  let keycloakAccessToken: string | undefined;
  let keycloakRefreshToken: string | undefined;
  let refreshExpiresIn: number | undefined;
  let tokenExpiresAt: number | undefined;

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
    const role = mapRealmRolesToSupportRole(supportRolesFromClaims(keycloak.decodedClaims || {}));
    if (!role) {
      return NextResponse.json(
        { success: false, error: "A SupportV8 role is required for this workspace." },
        { status: 403 }
      );
    }
    const operatorDisplayName = supportOperatorDisplayName(keycloak.decodedClaims || {}, resolvedTenantSlug);
    user = {
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
    user.name
  );
  if (refreshExpiresIn) {
    session.expiresAt = Date.now() + Math.min(refreshExpiresIn, 8 * 60 * 60) * 1000;
  }

  const redirectDest = safeNextPath(nextParam);
  const isFormPost = contentType.includes("application/x-www-form-urlencoded");

  const response = isFormPost
    ? NextResponse.redirect(new URL(redirectDest, req.url), 302)
    : NextResponse.json({
        success: true,
        message: `Successfully authenticated as ${user.name}`,
        session,
        redirectUrl: redirectDest,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantSlug: user.tenantSlug,
          role: user.role,
        },
      });

  const cookieToken = keycloakAccessToken || session.token;
  response.cookies.set("sv8_access_token", cookieToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, Math.floor(((tokenExpiresAt || Date.now() + 8 * 60 * 60 * 1000) - Date.now()) / 1000)),
  });

  if (keycloakRefreshToken) {
    response.cookies.set("sv8_refresh_token", keycloakRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: Math.max(60, Math.min(refreshExpiresIn || 8 * 60 * 60, 8 * 60 * 60)),
    });
  }

  return response;
}
