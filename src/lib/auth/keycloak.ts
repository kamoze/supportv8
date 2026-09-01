/**
 * SupportV8 Keycloak OIDC Direct Access Grant (ROPC) & Admin Integration
 * Aligned with ServiceV8 Keycloak Standard (servicev8-symphony/forge, growthv8, & knowledgev8)
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export class KeycloakUserExists extends Error {
  constructor(email: string) {
    super(`An account with this email already exists: ${email}`);
    this.name = "KeycloakUserExists";
  }
}

export class KeycloakIdentityMayExistError extends Error {
  readonly identityMayExist = true;

  constructor(message: string) {
    super(message);
    this.name = "KeycloakIdentityMayExistError";
  }
}

export type VerifyPasswordResult = {
  ok: true;
  accessToken?: string;
  decodedClaims?: Record<string, any>;
} | {
  ok: false;
  reason: string;
};

export type DemoAccessTokenResult = {
  ok: true;
  accessToken: string;
  expiresIn: number;
  decodedClaims: VerifiedSupportToken;
} | {
  ok: false;
  reason: string;
};

const KEYCLOAK_FETCH_TIMEOUT_MS = 1_500;
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export interface KeycloakAuthConfig {
  adminBaseUrl?: string;
  realm?: string;
  clientId?: string;
  adminClientId?: string;
  adminClientSecret?: string;
}

export function getKeycloakConfig(): KeycloakAuthConfig {
  const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
  const adminBaseUrl =
    process.env.KEYCLOAK_ADMIN_BASE_URL ||
    process.env.SERVICEV8_OIDC_ISSUER ||
    (isTestEnv ? undefined : "https://keycloak.servicev8.com");

  return {
    adminBaseUrl: adminBaseUrl ? adminBaseUrl.replace(/\/$/, "") : undefined,
    realm: process.env.SUPPORTV8_OIDC_REALM || "supportv8",
    clientId: process.env.SUPPORTV8_OIDC_CLIENT_ID || "supportv8-app",
    adminClientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || "supportv8-admin-sa",
    adminClientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
  };
}

export type VerifiedSupportToken = JWTPayload & {
  tenant_id?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  azp?: string;
};

/** Verify signature, issuer, expiry, and the client that received the token. */
export async function verifySupportAccessToken(token: string): Promise<VerifiedSupportToken> {
  const cfg = getKeycloakConfig();
  const baseUrl = cfg.adminBaseUrl?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Keycloak issuer is not configured");

  const issuer = `${baseUrl}/realms/${cfg.realm}`;
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
    jwksByIssuer.set(issuer, jwks);
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
  });

  const expectedClient = cfg.clientId || "supportv8-app";
  const allowedClients = new Set([
    expectedClient,
    "supportv8-demo-acme",
    "supportv8-demo-meridian",
  ]);
  const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  const authorizedParty = typeof payload.azp === "string" ? payload.azp : "";
  if (!allowedClients.has(authorizedParty) && !audiences.some((audience) => allowedClients.has(audience))) {
    throw new Error("Access token was not issued to SupportV8");
  }

  return payload as VerifiedSupportToken;
}

/**
 * Issue a short-lived service-account token for one of the two public demo
 * workspaces. The client secret never reaches the browser, and the returned
 * token is still signed and verified by the SupportV8 Keycloak realm.
 */
export async function issueKeycloakDemoAccessToken(
  tenantSlug: "acme" | "meridian",
  configOverride?: Partial<KeycloakAuthConfig>
): Promise<DemoAccessTokenResult> {
  const cfg = { ...getKeycloakConfig(), ...configOverride };
  const baseUrl = cfg.adminBaseUrl?.replace(/\/$/, "");
  const clientSecret = process.env.SUPPORTV8_DEMO_CLIENT_SECRET?.trim();
  if (!baseUrl || !clientSecret) {
    return { ok: false, reason: "demo_identity_not_configured" };
  }

  const clientId = `supportv8-demo-${tenantSlug}`;
  try {
    const response = await fetch(`${baseUrl}/realms/${cfg.realm}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.access_token !== "string") {
      return { ok: false, reason: `demo_identity_error_${response.status}` };
    }

    const decodedClaims = await verifySupportAccessToken(data.access_token);
    const expectedTenant = `tenant_${tenantSlug}`;
    if (
      decodedClaims.tenant_id !== expectedTenant ||
      !supportRolesFromClaims(decodedClaims, clientId).includes("support_demo_operator")
    ) {
      return { ok: false, reason: "demo_identity_claim_mismatch" };
    }

    return {
      ok: true,
      accessToken: data.access_token,
      expiresIn: Math.min(30 * 60, Math.max(60, Number(data.expires_in) || 5 * 60)),
      decodedClaims,
    };
  } catch {
    return { ok: false, reason: "demo_identity_unreachable" };
  }
}

/**
 * Verifies user credentials via Keycloak Direct Access Grant (ROPC)
 */
export async function verifyKeycloakPassword(
  email: string,
  password: string,
  configOverride?: Partial<KeycloakAuthConfig>
): Promise<VerifyPasswordResult> {
  const cfg = { ...getKeycloakConfig(), ...configOverride };
  const baseUrl = cfg.adminBaseUrl?.replace(/\/$/, "");
  if (!baseUrl) {
    return { ok: false, reason: "keycloak_not_configured" };
  }

  try {
    const res = await fetch(`${baseUrl}/realms/${cfg.realm}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: cfg.clientId || "supportv8-app",
        username: email,
        password,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      let decodedClaims: Record<string, any> | undefined;
      if (data.access_token) {
        try {
          const parts = data.access_token.split(".");
          if (parts.length === 3) {
            decodedClaims = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
          }
        } catch (_) {}
      }
      return { ok: true, accessToken: data.access_token, decodedClaims };
    }
    if (res.status === 401) return { ok: false, reason: "invalid_credentials" };
    return { ok: false, reason: `keycloak_error_${res.status}` };
  } catch (err) {
    return { ok: false, reason: `keycloak_unreachable: ${(err as Error).message}` };
  }
}

/**
 * Retrieve admin service-account token using client credentials
 */
export async function getAdminToken(configOverride?: Partial<KeycloakAuthConfig>): Promise<string> {
  const cfg = { ...getKeycloakConfig(), ...configOverride };
  const baseUrl = cfg.adminBaseUrl?.replace(/\/$/, "");
  if (!baseUrl || !cfg.adminClientId || !cfg.adminClientSecret) {
    throw new Error("Keycloak admin credentials not configured");
  }

  const res = await fetch(`${baseUrl}/realms/${cfg.realm}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.adminClientId,
      client_secret: cfg.adminClientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Keycloak admin token failed: ${data.error_description || res.status}`);
  }
  return data.access_token;
}

/**
 * Creates a user via Keycloak Admin REST API
 */
export async function createKeycloakUser(
  email: string,
  password: string,
  options: {
    firstName?: string;
    lastName?: string;
    tenantId?: string;
    roles?: string[];
  } = {},
  configOverride?: Partial<KeycloakAuthConfig>
): Promise<{ id: string }> {
  const cfg = { ...getKeycloakConfig(), ...configOverride };
  const baseUrl = cfg.adminBaseUrl?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Keycloak adminBaseUrl not configured");

  const token = await getAdminToken(cfg);
  const cleanEmail = email.toLowerCase().trim();

  const userPayload = {
    username: cleanEmail,
    email: cleanEmail,
    firstName: options.firstName,
    lastName: options.lastName,
    enabled: true,
    emailVerified: true,
    attributes: {
      tenant_id: options.tenantId ? [options.tenantId] : undefined,
    },
    credentials: [
      {
        type: "password",
        value: password,
        temporary: false,
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/admin/realms/${cfg.realm}/users`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(userPayload),
      cache: "no-store",
      signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
    });
  } catch {
    // The request may have committed before the response was lost.
    throw new KeycloakIdentityMayExistError("Keycloak user creation outcome is unknown");
  }

  let id = cleanEmail;

  if (res.status === 409) {
    throw new KeycloakUserExists(cleanEmail);
  }

  if (!res.ok && res.status !== 201) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Failed to create Keycloak user (${res.status}): ${errorBody}`);
  }

  // Location header contains the created user URL: .../users/{id}
  const location = res.headers.get("location");
  if (location) {
    id = location.split("/").pop() || cleanEmail;
  }

  if (id === cleanEmail) {
    throw new KeycloakIdentityMayExistError(
      "Keycloak created a user without returning its identifier"
    );
  }

  const requestedRoles = [...new Set(options.roles || [])];
  try {
    if (requestedRoles.length === 0) {
      throw new Error("At least one SupportV8 role is required");
    }
    for (const roleName of requestedRoles) {
      if (!/^support_[a-z0-9_]+$/.test(roleName)) {
        throw new Error(`Invalid SupportV8 role requested: ${roleName}`);
      }
      const roleResponse = await fetch(
        `${baseUrl}/admin/realms/${cfg.realm}/roles/${encodeURIComponent(roleName)}`,
        {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
        }
      );
      if (!roleResponse.ok) {
        throw new Error(`Keycloak role lookup failed for ${roleName} (${roleResponse.status})`);
      }
      const role = await roleResponse.json();
      const mappingResponse = await fetch(
        `${baseUrl}/admin/realms/${cfg.realm}/users/${encodeURIComponent(id)}/role-mappings/realm`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify([role]),
          cache: "no-store",
          signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
        }
      );
      if (!mappingResponse.ok && mappingResponse.status !== 204) {
        throw new Error(`Keycloak role assignment failed for ${roleName} (${mappingResponse.status})`);
      }
    }
  } catch (error) {
    // Avoid leaving a roleless identity with an authoritative tenant claim.
    let identityRemoved = false;
    try {
      const deleteResponse = await fetch(
        `${baseUrl}/admin/realms/${cfg.realm}/users/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
        }
      );
      identityRemoved = deleteResponse.ok || deleteResponse.status === 404;
    } catch {
      identityRemoved = false;
    }
    if (!identityRemoved) {
      throw new KeycloakIdentityMayExistError(
        "Keycloak user cleanup could not be confirmed"
      );
    }
    throw error;
  }

  return { id };
}

export interface KeycloakAdminUser {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, string[]>;
}

/** Look up one exact user through the trusted Keycloak Admin API. */
export async function findKeycloakUserByEmail(
  email: string,
  configOverride?: Partial<KeycloakAuthConfig>
): Promise<KeycloakAdminUser | undefined> {
  const cfg = { ...getKeycloakConfig(), ...configOverride };
  const baseUrl = cfg.adminBaseUrl?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Keycloak adminBaseUrl not configured");

  const token = await getAdminToken(cfg);
  const cleanEmail = email.trim().toLowerCase();
  const response = await fetch(
    `${baseUrl}/admin/realms/${cfg.realm}/users?email=${encodeURIComponent(cleanEmail)}&exact=true`,
    {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    throw new Error(`Keycloak user lookup failed (${response.status})`);
  }

  const users = (await response.json()) as KeycloakAdminUser[];
  return users.find((user) => (user.email || user.username || "").trim().toLowerCase() === cleanEmail);
}

/** Reset a verified account's password in the production identity authority. */
export async function resetKeycloakPassword(
  email: string,
  newPassword: string,
  configOverride?: Partial<KeycloakAuthConfig>
): Promise<void> {
  const cfg = { ...getKeycloakConfig(), ...configOverride };
  const baseUrl = cfg.adminBaseUrl?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Keycloak adminBaseUrl not configured");

  const user = await findKeycloakUserByEmail(email, cfg);
  if (!user?.id) throw new Error("Keycloak user was not found");
  const token = await getAdminToken(cfg);
  const response = await fetch(
    `${baseUrl}/admin/realms/${cfg.realm}/users/${encodeURIComponent(user.id)}/reset-password`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type: "password", value: newPassword, temporary: false }),
      cache: "no-store",
      signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    throw new Error(`Keycloak password reset failed (${response.status})`);
  }
}

/**
 * Map Keycloak realm roles into SupportV8 application roles
 */
export function mapRealmRolesToSupportRole(
  realmRoles: string[] = []
): "superadmin" | "cx_lead" | "operator" | "contractor_lead" | "technician" | "observer" | null {
  if (realmRoles.includes("support_superadmin")) return "superadmin";
  if (realmRoles.includes("support_cx_lead")) return "cx_lead";
  if (realmRoles.includes("support_contractor_lead")) return "contractor_lead";
  if (realmRoles.includes("support_technician")) return "technician";
  if (realmRoles.includes("support_operator")) return "operator";
  if (realmRoles.includes("support_demo_operator")) return "operator";
  if (realmRoles.includes("support_observer")) return "observer";
  return null;
}

export function supportRolesFromClaims(
  claims: Pick<VerifiedSupportToken, "realm_access" | "resource_access">,
  clientId = getKeycloakConfig().clientId || "supportv8-app"
): string[] {
  return [
    ...(claims.resource_access?.[clientId]?.roles || []),
    ...(claims.realm_access?.roles || []),
  ].filter((role, index, roles) => role.startsWith("support_") && roles.indexOf(role) === index);
}
