/**
 * SupportV8 Keycloak OIDC Direct Access Grant (ROPC) & Admin Integration
 * Aligned with ServiceV8 Keycloak Standard (servicev8-symphony/forge, growthv8, & knowledgev8)
 */

export class KeycloakUserExists extends Error {
  constructor(email: string) {
    super(`An account with this email already exists: ${email}`);
    this.name = "KeycloakUserExists";
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

const KEYCLOAK_FETCH_TIMEOUT_MS = 8_000;

export interface KeycloakAuthConfig {
  adminBaseUrl?: string;
  realm?: string;
  clientId?: string;
  adminClientId?: string;
  adminClientSecret?: string;
}

export function getKeycloakConfig(): KeycloakAuthConfig {
  return {
    adminBaseUrl:
      process.env.KEYCLOAK_ADMIN_BASE_URL ||
      process.env.SERVICEV8_OIDC_ISSUER ||
      (process.env.NODE_ENV === "production"
        ? "http://keycloak.default.svc.cluster.local:8080"
        : "http://localhost:8080"),
    realm: process.env.SUPPORTV8_OIDC_REALM || "supportv8",
    clientId: process.env.SUPPORTV8_OIDC_CLIENT_ID || "supportv8-app",
    adminClientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || "supportv8-admin-sa",
    adminClientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
  };
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
    organizationName?: string;
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
      organization_name: options.organizationName ? [options.organizationName] : undefined,
    },
    credentials: [
      {
        type: "password",
        value: password,
        temporary: false,
      },
    ],
  };

  const res = await fetch(`${baseUrl}/admin/realms/${cfg.realm}/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(userPayload),
    cache: "no-store",
    signal: AbortSignal.timeout(KEYCLOAK_FETCH_TIMEOUT_MS),
  });

  if (res.status === 409) {
    throw new KeycloakUserExists(cleanEmail);
  }

  if (!res.ok && res.status !== 201) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Failed to create Keycloak user (${res.status}): ${errorBody}`);
  }

  // Location header contains the created user URL: .../users/{id}
  const location = res.headers.get("location");
  const id = location ? location.split("/").pop() || cleanEmail : cleanEmail;
  return { id };
}

/**
 * Map Keycloak realm roles into SupportV8 application roles
 */
export function mapRealmRolesToSupportRole(
  realmRoles: string[] = []
): "superadmin" | "cx_lead" | "operator" | "contractor_lead" | "technician" | "observer" {
  if (realmRoles.includes("support_superadmin") || realmRoles.includes("admin")) return "superadmin";
  if (realmRoles.includes("support_cx_lead") || realmRoles.includes("cx_lead")) return "cx_lead";
  if (realmRoles.includes("support_contractor_lead")) return "contractor_lead";
  if (realmRoles.includes("support_technician")) return "technician";
  if (realmRoles.includes("support_operator") || realmRoles.includes("operator")) return "operator";
  if (realmRoles.includes("support_observer") || realmRoles.includes("viewer")) return "observer";
  return "operator";
}
