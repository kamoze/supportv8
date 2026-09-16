import { createHmac, timingSafeEqual } from "node:crypto";
import {
  resolveOperationalSupportAccess,
  type OperationalSupportAccess,
  type SupportRuntimeScope,
} from "./runtime-access";
import type { RuntimeSupportRole } from "./runtime-handoff-claims";

export const RUNTIME_SUPPORT_COOKIE = "__Host-sv8_runtime_support";
export const RUNTIME_SUPPORT_SESSION_TTL = 8 * 60 * 60;
export type RuntimeSupportSession = Omit<SupportRuntimeScope, "subject"> & {
  sub: string;
  version: "servicev8.support-session.v1";
  aud: "supportv8-runtime-session";
  roleCap: RuntimeSupportRole;
  tenantDomain: string;
  iat: number;
  exp: number;
};
const fields = [
  "version",
  "aud",
  "sub",
  "accountId",
  "tenantId",
  "verticalId",
  "installationId",
  "workspaceId",
  "roleCap",
  "tenantDomain",
  "iat",
  "exp",
];
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const slug = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
function key(secret?: string) {
  return secret && Buffer.byteLength(secret) >= 32 ? secret : null;
}
export function intersectSupportRoles(
  ...roles: string[]
): RuntimeSupportRole | null {
  const order: RuntimeSupportRole[] = ["support:read", "support:manage"],
    levels = roles.map((r) => order.indexOf(r as RuntimeSupportRole));
  return levels.length && !levels.some((x) => x < 0)
    ? order[Math.min(...levels)]!
    : null;
}
export function signRuntimeSupportSession(
  input: Omit<RuntimeSupportSession, "version" | "aud" | "iat" | "exp">,
  secret: string | undefined,
  now = Math.floor(Date.now() / 1000),
  ttl = RUNTIME_SUPPORT_SESSION_TTL,
): string | null {
  const k = key(secret);
  if (
    !k ||
    !Number.isSafeInteger(now) ||
    !Number.isInteger(ttl) ||
    ttl < 1 ||
    ttl > RUNTIME_SUPPORT_SESSION_TTL
  )
    return null;
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    p = Buffer.from(
      JSON.stringify({
        version: "servicev8.support-session.v1",
        aud: "supportv8-runtime-session",
        ...input,
        iat: now,
        exp: now + ttl,
      }),
    ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", k).update(`${h}.${p}`).digest("base64url")}`;
}
export function verifyRuntimeSupportSession(
  token: unknown,
  secret: string | undefined,
  host: string,
  now = Math.floor(Date.now() / 1000),
): RuntimeSupportSession | null {
  const k = key(secret);
  if (
    typeof token !== "string" ||
    token.length > 8192 ||
    !k ||
    !slug.test(host.split(".")[0] ?? "")
  )
    return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p)))
    return null;
  try {
    const [h, p, s] = parts as [string, string, string];
    if (
      Buffer.from(h, "base64url").toString("base64url") !== h ||
      Buffer.from(p, "base64url").toString("base64url") !== p ||
      Buffer.from(s, "base64url").toString("base64url") !== s
    )
      return null;
    const header: unknown = JSON.parse(Buffer.from(h, "base64url").toString()),
      body: unknown = JSON.parse(Buffer.from(p, "base64url").toString());
    const expected = createHmac("sha256", k).update(`${h}.${p}`).digest(),
      actual = Buffer.from(s, "base64url");
    if (
      !object(header) ||
      Object.keys(header).length !== 2 ||
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected) ||
      !object(body) ||
      Object.keys(body).length !== fields.length ||
      !fields.every((f) => Object.hasOwn(body, f))
    )
      return null;
    const scope = {
      accountId: body.accountId,
      tenantId: body.tenantId,
      verticalId: body.verticalId,
      installationId: body.installationId,
      workspaceId: body.workspaceId,
      subject: body.sub,
    };
    if (
      body.version !== "servicev8.support-session.v1" ||
      body.aud !== "supportv8-runtime-session" ||
      typeof body.roleCap !== "string" ||
      !(["support:read", "support:manage"] as string[]).includes(
        body.roleCap,
      ) ||
      typeof body.tenantDomain !== "string" ||
      !slug.test(body.tenantDomain) ||
      host !== `${body.tenantDomain}.support.servicev8.com` ||
      typeof body.iat !== "number" ||
      typeof body.exp !== "number" ||
      !Number.isSafeInteger(body.iat) ||
      !Number.isSafeInteger(body.exp) ||
      body.iat > now ||
      body.exp <= now ||
      body.exp - body.iat > RUNTIME_SUPPORT_SESSION_TTL
    )
      return null;
    const parsed = awaitParseScope(scope);
    return parsed ? (body as RuntimeSupportSession) : null;
  } catch {
    return null;
  }
}
function awaitParseScope(value: unknown): SupportRuntimeScope | null {
  if (!object(value) || value.verticalId !== "runtime") return null;
  const v = value as Record<string, unknown>;
  if (
    ![v.accountId, v.tenantId, v.installationId, v.subject].every(
      (x) => typeof x === "string" && /^[A-Za-z0-9_:@.-]{1,192}$/.test(x),
    ) ||
    typeof v.workspaceId !== "string" ||
    !/^tenant_rt_[a-f0-9]{48}$/.test(v.workspaceId)
  )
    return null;
  return value as SupportRuntimeScope;
}
export function runtimeSupportCookie(
  value: string,
  maxAge = RUNTIME_SUPPORT_SESSION_TTL,
) {
  return `${RUNTIME_SUPPORT_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
export function trustedRuntimeTenantHost(request: Request): string | null {
  const raw = request.headers.get("host");
  if (
    !raw ||
    raw.includes(",") ||
    raw.includes(":") ||
    raw.includes("/") ||
    raw.includes("@")
  )
    return null;
  const host = raw.toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.support\.servicev8\.com$/.test(
    host,
  )
    ? host
    : null;
}
export function readRuntimeSupportCookie(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(`${RUNTIME_SUPPORT_COOKIE}=`));
  if (values.length !== 1) return null;
  const value = values[0]!.slice(RUNTIME_SUPPORT_COOKIE.length + 1);
  return value && value.length <= 8192 ? value : null;
}
export async function authorizeRuntimeSupportRequest(
  request: Request,
  deps: {
    secret?: string;
    resolve?: (
      scope: SupportRuntimeScope,
    ) => Promise<OperationalSupportAccess | null>;
    now?: () => number;
  } = {},
): Promise<{
  session: RuntimeSupportSession;
  access: OperationalSupportAccess;
  role: RuntimeSupportRole;
} | null> {
  const host = trustedRuntimeTenantHost(request);
  if (!host) return null;
  const token = readRuntimeSupportCookie(request);
  if (!token) return null;
  const now = deps.now?.() ?? Math.floor(Date.now() / 1000),
    session = verifyRuntimeSupportSession(
      token,
      deps.secret ?? process.env.SUPPORTV8_RUNTIME_SESSION_SECRET,
      host,
      now,
    );
  if (!session) return null;
  const scope: SupportRuntimeScope = {
    accountId: session.accountId,
    tenantId: session.tenantId,
    verticalId: "runtime",
    installationId: session.installationId,
    workspaceId: session.workspaceId,
    subject: session.sub,
  };
  const access = await (deps.resolve ?? resolveOperationalSupportAccess)(scope);
  if (
    !access ||
    session.exp <= (deps.now?.() ?? Math.floor(Date.now() / 1000)) ||
    access.domain !== session.tenantDomain
  )
    return null;
  const role = intersectSupportRoles(session.roleCap, access.capability);
  return role ? { session, access, role } : null;
}
