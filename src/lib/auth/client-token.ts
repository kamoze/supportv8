import { createHmac, timingSafeEqual } from "node:crypto";

export interface ClientTokenPayload {
  email: string;
  tenantSlug: string;
  customerId: string;
  name?: string;
  company?: string;
  companyName?: string;
  iat?: number;
  exp?: number;
}

const DEFAULT_SECRET = "supportv8_client_auth_secret_key_fixed_signing_salt_2026";
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getSecret(): string {
  const secret =
    process.env.CLIENT_AUTH_SECRET ||
    process.env.SUPPORTV8_CLIENT_AUTH_SECRET ||
    process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[ClientToken] Production warning: Using default client auth secret. Set CLIENT_AUTH_SECRET.");
    }
    return DEFAULT_SECRET;
  }

  return secret;
}

/**
 * Signs a client session token with HMAC SHA-256 integrity and 30-day default expiry.
 */
export function signClientToken(payload: ClientTokenPayload): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");

  const fullPayload: ClientTokenPayload = {
    ...payload,
    email: payload.email.trim().toLowerCase(),
    tenantSlug: payload.tenantSlug.trim().toLowerCase(),
    customerId: payload.customerId,
    iat: payload.iat ?? now,
    exp: payload.exp ?? (now + TOKEN_TTL_SECONDS),
  };
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");

  const signature = createHmac("sha256", getSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies a client session token with HMAC SHA-256 integrity, expiry, and optional tenant scoping.
 */
export function verifyClientToken(
  token: string,
  expectedTenantSlug?: string
): ClientTokenPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  if (!h || !p || !s) return null;

  const expectedSig = createHmac("sha256", getSecret())
    .update(`${h}.${p}`)
    .digest("base64url");

  const actualBuf = Buffer.from(s, "base64url");
  const expectedBuf = Buffer.from(expectedSig, "base64url");

  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    if (!header || header.alg !== "HS256") return null;

    const payload: ClientTokenPayload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return null;
    if (!payload.email || typeof payload.email !== "string") return null;
    if (!payload.tenantSlug || typeof payload.tenantSlug !== "string") return null;
    if (!payload.customerId || typeof payload.customerId !== "string") return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) {
      return null;
    }

    if (
      expectedTenantSlug &&
      payload.tenantSlug.toLowerCase() !== expectedTenantSlug.trim().toLowerCase()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts client session token from Authorization header (Bearer) or request cookies.
 */
export function extractClientToken(req: {
  headers?: { get(name: string): string | null };
  cookies?: { get(name: string): { value: string } | undefined };
}): string | null {
  const authHeader = req.headers?.get ? req.headers.get("authorization") : null;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  if (req.cookies && typeof req.cookies.get === "function") {
    const c1 = req.cookies.get("sv8_client_token")?.value;
    if (c1) return c1;
    const c2 = req.cookies.get("supportv8_client_token")?.value;
    if (c2) return c2;
  }

  const cookieHeader = req.headers?.get ? req.headers.get("cookie") : null;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)(?:sv8_client_token|supportv8_client_token)=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1].trim());
    }
  }

  return null;
}
