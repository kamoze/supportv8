import { createHmac, timingSafeEqual } from "node:crypto";

export const RUNTIME_SUPPORT_HANDOFF_VERSION =
  "servicev8.support-handoff.v1" as const;
export const RUNTIME_SUPPORT_HANDOFF_AUDIENCE =
  "supportv8-service-app" as const;
export type RuntimeSupportRole = "support:read" | "support:manage";
export type RuntimeSupportHandoffClaims = {
  version: typeof RUNTIME_SUPPORT_HANDOFF_VERSION;
  iss: "runtime";
  aud: typeof RUNTIME_SUPPORT_HANDOFF_AUDIENCE;
  sub: string;
  accountId: string;
  tenantId: string;
  verticalId: "runtime";
  installationId: string;
  externalWorkspaceId: string;
  tenantDomain: string;
  role: RuntimeSupportRole;
  destination: string;
  iat: number;
  exp: number;
  jti: string;
};
const fields = [
  "version",
  "iss",
  "aud",
  "sub",
  "accountId",
  "tenantId",
  "verticalId",
  "installationId",
  "externalWorkspaceId",
  "tenantDomain",
  "role",
  "destination",
  "iat",
  "exp",
  "jti",
];
const ref = /^[A-Za-z0-9_:@.-]{1,192}$/;
const reference = (v: unknown): v is string =>
  typeof v === "string" && ref.test(v);
const native = /^tenant_rt_[a-f0-9]{48}$/;
const slug = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const canonical = (part: string) => {
  const bytes = Buffer.from(part, "base64url");
  return bytes.toString("base64url") === part ? bytes : null;
};
export function supportDestination(domain: string) {
  return `https://${domain}.support.servicev8.com/auth/runtime/handoff`;
}
export function verifyRuntimeSupportHandoffToken(
  token: unknown,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): RuntimeSupportHandoffClaims | null {
  if (
    typeof token !== "string" ||
    token.length < 1 ||
    token.length > 8192 ||
    !secret ||
    Buffer.byteLength(secret) < 32 ||
    !Number.isSafeInteger(nowSeconds)
  )
    return null;
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    parts.some((p) => !p || !/^[A-Za-z0-9_-]+$/.test(p))
  )
    return null;
  try {
    const [h, p, s] = parts as [string, string, string],
      hb = canonical(h),
      pb = canonical(p),
      sb = canonical(s);
    if (!hb || !pb || !sb) return null;
    const header: unknown = JSON.parse(hb.toString("utf8")),
      body: unknown = JSON.parse(pb.toString("utf8"));
    if (
      !object(header) ||
      Object.keys(header).length !== 2 ||
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      !object(body) ||
      Object.keys(body).length !== fields.length ||
      !fields.every((k) => Object.hasOwn(body, k))
    )
      return null;
    const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
    if (sb.length !== expected.length || !timingSafeEqual(sb, expected))
      return null;
    if (
      body.version !== RUNTIME_SUPPORT_HANDOFF_VERSION ||
      body.iss !== "runtime" ||
      body.aud !== RUNTIME_SUPPORT_HANDOFF_AUDIENCE ||
      body.verticalId !== "runtime" ||
      !reference(body.sub) ||
      !reference(body.accountId) ||
      !reference(body.tenantId) ||
      !reference(body.installationId) ||
      typeof body.externalWorkspaceId !== "string" ||
      !native.test(body.externalWorkspaceId) ||
      typeof body.tenantDomain !== "string" ||
      !slug.test(body.tenantDomain) ||
      !(["support:read", "support:manage"] as unknown[]).includes(body.role) ||
      body.destination !== supportDestination(String(body.tenantDomain)) ||
      typeof body.iat !== "number" ||
      !Number.isSafeInteger(body.iat) ||
      body.iat < 0 ||
      body.iat > nowSeconds ||
      typeof body.exp !== "number" ||
      !Number.isSafeInteger(body.exp) ||
      body.exp <= nowSeconds ||
      body.exp <= body.iat ||
      body.exp - body.iat > 60 ||
      typeof body.jti !== "string" ||
      !uuid.test(body.jti)
    )
      return null;
    return body as RuntimeSupportHandoffClaims;
  } catch {
    return null;
  }
}
