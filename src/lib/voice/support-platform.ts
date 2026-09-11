import { createHmac, randomUUID } from "node:crypto";

export const SOPHIA_PRODUCT_ID = "servicev8.ai-support-agent";
export const SUPPORT_VERTICAL_ID = "supportv8";

export type SupportPlatformEnvironment = Readonly<{
  oidcIssuer: string;
  clientId: string;
  clientSecret: string;
  registryUrl: string;
  marketplaceUrl: string;
  marketplaceHandoffSecret: string;
  studioUrl: string;
  studioHandoffSecret: string;
}>;

export type SophiaLaunch = Readonly<{
  kind: "marketplace" | "studio";
  url: string;
  accountId: string;
  registryTenantId: string;
  installationId?: string;
  hireId?: string;
}>;

type RegistryTenant = {
  id?: unknown;
  accountId?: unknown;
  slug?: unknown;
  status?: unknown;
};

type RegistryInstallation = {
  accountId?: unknown;
  tenantId?: unknown;
  verticalId?: unknown;
  productId?: unknown;
  entitlementStatus?: unknown;
  installationId?: unknown;
  hireId?: unknown;
};

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is not configured`);
  return normalized;
}

function baseUrl(name: string, value: string): string {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${name} is invalid`);
  }
  return parsed.toString().replace(/\/$/, "");
}

export function supportPlatformEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): SupportPlatformEnvironment {
  return {
    oidcIssuer: baseUrl("SERVICEV8_OIDC_ISSUER", required("SERVICEV8_OIDC_ISSUER", source.SERVICEV8_OIDC_ISSUER)),
    clientId: required("SUPPORTV8_PLATFORM_CLIENT_ID", source.SUPPORTV8_PLATFORM_CLIENT_ID),
    clientSecret: required("SUPPORTV8_PLATFORM_CLIENT_SECRET", source.SUPPORTV8_PLATFORM_CLIENT_SECRET),
    registryUrl: baseUrl("REGISTRY_URL", required("REGISTRY_URL", source.REGISTRY_URL)),
    marketplaceUrl: baseUrl("MARKETPLACE_URL", required("MARKETPLACE_URL", source.MARKETPLACE_URL)),
    marketplaceHandoffSecret: required("MARKETPLACE_HANDOFF_SECRET", source.MARKETPLACE_HANDOFF_SECRET),
    studioUrl: baseUrl("STUDIO_URL", required("STUDIO_URL", source.STUDIO_URL)),
    studioHandoffSecret: required("STUDIO_HANDOFF_SECRET", source.STUDIO_HANDOFF_SECRET),
  };
}

function jwt(claims: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function jsonResponse<T>(response: Response, purpose: string): Promise<T> {
  if (!response.ok) throw new Error(`${purpose} failed`);
  return await response.json() as T;
}

async function workloadToken(env: SupportPlatformEnvironment): Promise<string> {
  const response = await fetch(`${env.oidcIssuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.clientId,
      client_secret: env.clientSecret,
      audience: "servicev8-registry",
    }),
    cache: "no-store",
  });
  const body = await jsonResponse<{ access_token?: unknown }>(response, "Platform authentication");
  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new Error("Platform authentication returned no access token");
  }
  return body.access_token;
}

async function registryGet<T>(url: URL, token: string, purpose: string): Promise<T> {
  return jsonResponse<T>(await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
  }), purpose);
}

export async function resolveSophiaLaunch(input: {
  env: SupportPlatformEnvironment;
  tenantId: string;
  tenantSlug: string;
  identitySubject: string;
  nowSeconds?: number;
  nonce?: string;
}): Promise<SophiaLaunch> {
  const token = await workloadToken(input.env);
  const tenantUrl = new URL(`/v1/tenants/by-slug/${encodeURIComponent(input.tenantSlug)}`, `${input.env.registryUrl}/`);
  const tenant = await registryGet<RegistryTenant>(tenantUrl, token, "Registry tenant lookup");
  if (
    typeof tenant.id !== "string" ||
    !tenant.id ||
    tenant.slug !== input.tenantSlug ||
    tenant.status !== "active" ||
    typeof tenant.accountId !== "string" ||
    !tenant.accountId
  ) {
    throw new Error("Registry tenant does not match the SupportV8 workspace");
  }
  const registryTenantId = tenant.id;

  const membershipUrl = new URL(
    `/v1/tenants/${encodeURIComponent(registryTenantId)}/memberships/${encodeURIComponent(input.identitySubject)}`,
    `${input.env.registryUrl}/`,
  );
  membershipUrl.searchParams.set("accountId", tenant.accountId);
  const membership = await registryGet<Record<string, unknown>>(membershipUrl, token, "Registry membership lookup");
  if (
    membership.tenantId !== registryTenantId ||
    membership.accountId !== tenant.accountId ||
    membership.identitySubject !== input.identitySubject ||
    membership.status !== "active"
  ) {
    throw new Error("Registry membership does not match the signed-in operator");
  }

  const projectionsUrl = new URL("/v1/projections/installations", `${input.env.registryUrl}/`);
  projectionsUrl.searchParams.set("accountId", tenant.accountId);
  projectionsUrl.searchParams.set("tenantId", registryTenantId);
  projectionsUrl.searchParams.set("verticalId", SUPPORT_VERTICAL_ID);
  const projection = await registryGet<{ installations?: unknown }>(projectionsUrl, token, "Registry installation lookup");
  const installations = Array.isArray(projection.installations) ? projection.installations as RegistryInstallation[] : [];
  const matches = installations.filter((candidate) =>
    candidate.accountId === tenant.accountId &&
    candidate.tenantId === registryTenantId &&
    candidate.verticalId === SUPPORT_VERTICAL_ID &&
    candidate.productId === SOPHIA_PRODUCT_ID &&
    candidate.entitlementStatus === "active" &&
    typeof candidate.installationId === "string" && candidate.installationId &&
    typeof candidate.hireId === "string" && candidate.hireId,
  );
  if (matches.length > 1) throw new Error("Registry returned multiple active Sophia hires");

  const iat = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const jti = input.nonce ?? randomUUID();
  const exact = matches[0];
  if (exact) {
    const handoff = jwt({
      tenantId: registryTenantId,
      tenantDomain: input.tenantSlug,
      vertical: SUPPORT_VERTICAL_ID,
      identitySubject: input.identitySubject,
      iss: SUPPORT_VERTICAL_ID,
      aud: "studio-handoff",
      accountId: tenant.accountId,
      next: `/?manage=${encodeURIComponent(exact.hireId as string)}#employee-workspace`,
      iat,
      exp: iat + 60,
      jti,
    }, input.env.studioHandoffSecret);
    const destination = new URL("/auth/handoff", `${input.env.studioUrl}/`);
    destination.searchParams.set("token", handoff);
    return {
      kind: "studio",
      url: destination.toString(),
      accountId: tenant.accountId,
      registryTenantId,
      installationId: exact.installationId as string,
      hireId: exact.hireId as string,
    };
  }

  const handoff = jwt({
    iss: SUPPORT_VERTICAL_ID,
    aud: "marketplacev8-handoff",
    sub: input.identitySubject,
    identitySubject: input.identitySubject,
    accountId: tenant.accountId,
    tenantId: registryTenantId,
    tenantDomain: input.tenantSlug,
    verticalId: SUPPORT_VERTICAL_ID,
    origin: SUPPORT_VERTICAL_ID,
    returnPath: "/",
    iat,
    exp: iat + 60,
    jti,
  }, input.env.marketplaceHandoffSecret);
  const destination = new URL("/auth/handoff", `${input.env.marketplaceUrl}/`);
  destination.searchParams.set("token", handoff);
  return {
    kind: "marketplace",
    url: destination.toString(),
    accountId: tenant.accountId,
    registryTenantId,
  };
}
