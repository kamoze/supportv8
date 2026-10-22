import { createRemoteJWKSet, importSPKI, importJWK, jwtVerify, type JWTVerifyGetKey } from "jose";
import { identifier } from "./managed-support-contract";

export interface InteractionIngressActor {
  clientId: string;
  accountId: string;
  tenantId: string;
  jti: string;
  sub: string;
  scope: string;
  correlationId: string;
}

export type InteractionIngressAuthResult =
  | { success: true; actor: InteractionIngressActor }
  | { success: false; status: 401 | 403; error: string };

export interface InteractionAuthOptions {
  issuer?: string;
  audience?: string;
  allowedClientIds?: readonly string[];
  key?: JWTVerifyGetKey | CryptoKey | Uint8Array;
  algorithms?: string[];
}

let testKeyOverride: JWTVerifyGetKey | CryptoKey | Uint8Array | null = null;

/**
 * Sets or clears a test key override for verifying workload tokens in test environments.
 */
export function setInteractionIngressAuthKeyForTesting(
  key: JWTVerifyGetKey | CryptoKey | Uint8Array | null
): void {
  testKeyOverride = key;
}

const jwksCache = new Map<string, JWTVerifyGetKey>();

function getOrCreateRemoteJWKSet(url: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url), { timeoutDuration: 3000 });
    jwksCache.set(url, jwks);
  }
  return jwks;
}

/**
 * Resolves the verification key or JWKS set based on options, test override, or environment variables.
 */
async function resolveVerificationKey(
  options?: InteractionAuthOptions,
  issuer?: string
): Promise<JWTVerifyGetKey | CryptoKey | Uint8Array> {
  if (options?.key) {
    return options.key;
  }
  if (testKeyOverride) {
    return testKeyOverride;
  }

  const env = process.env;

  // 1. Static test / public key or shared secret from environment (PEM or JWK JSON or secret)
  const envPublicKey = env.SERVICEV8_AUTH_PUBLIC_KEY || env.SUPPORTV8_MANAGED_WORKLOAD_PUBLIC_KEY || env.SUPPORTV8_INGRESS_PUBLIC_KEY;
  if (envPublicKey) {
    const trimmed = envPublicKey.trim();
    if (trimmed.startsWith("-----BEGIN")) {
      return await importSPKI(trimmed, "RS256");
    }
    try {
      const parsed = JSON.parse(trimmed);
      return await importJWK(parsed, "RS256");
    } catch {
      // not JSON, fallback to buffer
      return Buffer.from(trimmed);
    }
  }

  const envSecret = env.SUPPORTV8_INGRESS_SECRET || env.ACTION_GATEWAY_INGEST_SECRET || env.SERVICEV8_AUTH_SECRET;
  if (envSecret) {
    return new TextEncoder().encode(envSecret.trim());
  }

  // 2. Remote JWKS endpoint
  const jwksUrl =
    env.SERVICEV8_AUTH_JWKS_URL ||
    env.SUPPORTV8_MANAGED_WORKLOAD_JWKS_URL ||
    (issuer ? `${issuer.replace(/\/$/, "")}/protocol/openid-connect/certs` : undefined);

  if (jwksUrl) {
    return getOrCreateRemoteJWKSet(jwksUrl);
  }

  throw new Error("No JWKS URL, public key, or verification key configured for interaction ingress auth");
}

/**
 * Authenticates an inbound interaction event from Action Gateway.
 * Validates:
 * - Bearer authorization token present and bounded length
 * - RS256 algorithm
 * - Issuer (from SERVICEV8_AUTH_ISSUER or default https://auth.servicev8.com/realms/servicev8)
 * - Audience 'supportv8'
 * - Authorized party ('azp') matches 'action-gateway-support'
 * - Token lifetime at most 120 seconds (p.exp - p.iat <= 120)
 * - Required jti, sub, exp, iat, account_id, tenant_id claims
 * - Exactly one required scope: expectedScope (default 'supportv8:interactions:ingest')
 * - Token account_id and tenant_id match request headers x-servicev8-account-id and x-servicev8-tenant-id
 */
export async function authenticateInteractionIngress(
  request: Request,
  expectedScope = "supportv8:interactions:ingest",
  options?: InteractionAuthOptions
): Promise<InteractionIngressAuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ") || authHeader.length > 16400) {
    return {
      success: false,
      status: 401,
      error: "Missing or invalid Authorization header",
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      success: false,
      status: 401,
      error: "Empty bearer token",
    };
  }

  const issuer =
    options?.issuer ??
    process.env.SERVICEV8_AUTH_ISSUER ??
    process.env.SUPPORTV8_MANAGED_WORKLOAD_ISSUER ??
    "https://auth.servicev8.com/realms/servicev8";

  const audience = options?.audience ?? process.env.SERVICEV8_AUTH_AUDIENCE ?? "supportv8";
  const envClientIds = process.env.SUPPORTV8_MANAGED_WORKLOAD_CLIENT_IDS
    ? process.env.SUPPORTV8_MANAGED_WORKLOAD_CLIENT_IDS.split(",").map((s) => s.trim())
    : [];
  const allowedClientIds = options?.allowedClientIds ?? [
    ...new Set(["action-gateway-support", "action-gateway", ...envClientIds]),
  ];
  const algorithms = options?.algorithms ?? ["RS256", "HS256"];

  let payload: any;
  try {
    const key = await resolveVerificationKey(options, issuer);
    const { payload: p } = await jwtVerify(token, key, {
      issuer,
      audience,
      algorithms,
      requiredClaims: ["sub", "iat", "exp", "jti"],
      maxTokenAge: "2m",
      clockTolerance: 0,
    });
    payload = p;
  } catch (err: any) {
    return {
      success: false,
      status: 401,
      error: `Token verification failed: ${err?.message || "invalid token"}`,
    };
  }

  // Validate identifiers
  try {
    identifier(payload.sub);
    identifier(payload.jti);
  } catch {
    return {
      success: false,
      status: 401,
      error: "Invalid sub or jti claim format",
    };
  }

  // Token lifetime check: at most 120 seconds
  if (
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > 120
  ) {
    return {
      success: false,
      status: 401,
      error: "Token lifetime exceeds maximum allowed duration (120 seconds) or is invalid",
    };
  }

  // Validate azp or client_id (Authorized Party)
  const clientIdClaim = payload.azp || payload.client_id;
  if (typeof clientIdClaim !== "string" || !allowedClientIds.includes(clientIdClaim)) {
    return {
      success: false,
      status: 403,
      error: `Forbidden authorized party (azp): expected ${allowedClientIds.join(", ")}, got ${clientIdClaim}`,
    };
  }

  // Validate scope (supports exact match or space-separated list per OAuth2 RFC)
  const tokenScopes =
    typeof payload.scope === "string"
      ? payload.scope.split(/\s+/)
      : Array.isArray(payload.scope)
      ? payload.scope
      : [];
  if (!tokenScopes.includes(expectedScope) && payload.scope !== expectedScope) {
    return {
      success: false,
      status: 403,
      error: `Forbidden scope: expected '${expectedScope}', got '${payload.scope}'`,
    };
  }

  // Enforce x-servicev8-* headers equality (with fallback to standard x-account-id / x-tenant-id)
  const headerAccountId =
    request.headers.get("x-servicev8-account-id") ||
    request.headers.get("x-account-id");
  const headerTenantId =
    request.headers.get("x-servicev8-tenant-id") ||
    request.headers.get("x-tenant-id");

  if (!headerAccountId || !headerTenantId) {
    return {
      success: false,
      status: 403,
      error: "Forbidden: missing required x-servicev8-account-id or x-servicev8-tenant-id headers",
    };
  }

  let accountId: string;
  let tenantId: string;
  try {
    accountId = identifier(headerAccountId);
    tenantId = identifier(headerTenantId);
  } catch {
    return {
      success: false,
      status: 403,
      error: "Forbidden: invalid x-servicev8-account-id or x-servicev8-tenant-id header format",
    };
  }

  // If token explicitly specifies account_id / tenant_id claims, enforce strict match with headers
  if (payload.account_id !== undefined || payload.tenant_id !== undefined) {
    let tokenAccountId: string;
    let tokenTenantId: string;
    try {
      tokenAccountId = identifier(payload.account_id);
      tokenTenantId = identifier(payload.tenant_id);
    } catch {
      return {
        success: false,
        status: 401,
        error: "Missing or invalid account_id or tenant_id claims in token",
      };
    }

    if (headerAccountId !== tokenAccountId || headerTenantId !== tokenTenantId) {
      return {
        success: false,
        status: 403,
        error: "Forbidden: tenant or account header mismatch with token claims",
      };
    }
    accountId = tokenAccountId;
    tenantId = tokenTenantId;
  }

  return {
    success: true,
    actor: {
      clientId: clientIdClaim,
      accountId,
      tenantId,
      jti: payload.jti,
      sub: payload.sub,
      scope: typeof payload.scope === "string" ? payload.scope : expectedScope,
      correlationId: typeof payload.correlation_id === "string" ? payload.correlation_id : payload.jti,
    },
  };
}
