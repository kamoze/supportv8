export async function verifySupportEmailTenantAccount(input: { tenantId: string; accountId: string; fetcher?: typeof fetch }): Promise<void> {
  const issuer = process.env.SERVICEV8_OIDC_ISSUER?.trim();
  const clientId = process.env.SUPPORTV8_EMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.SUPPORTV8_EMAIL_CLIENT_SECRET?.trim();
  const registryUrl = process.env.REGISTRY_URL?.trim();
  if (!issuer || !clientId || !clientSecret || !registryUrl) throw new Error("Support email tenant verification is not configured");
  const request = input.fetcher ?? fetch;
  const tokenResponse = await request(`${issuer.replace(/\/$/, "")}/protocol/openid-connect/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, redirect: "error", signal: AbortSignal.timeout(5_000), cache: "no-store",
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, audience: "servicev8-registry", scope: "registry:memberships:read" }),
  });
  const token = await tokenResponse.json().catch(() => null) as { access_token?: unknown } | null;
  if (!tokenResponse.ok || typeof token?.access_token !== "string" || !token.access_token) throw new Error("Support email tenant verification failed");
  const target = new URL(`/v1/tenants/${encodeURIComponent(input.tenantId)}`, `${registryUrl.replace(/\/+$/, "")}/`);
  target.searchParams.set("accountId", input.accountId);
  const response = await request(target, { headers: { authorization: `Bearer ${token.access_token}`, accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(5_000), cache: "no-store" });
  const tenant = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || tenant?.id !== input.tenantId || tenant.accountId !== input.accountId || tenant.status !== "active") throw new Error("Support email tenant account is not active");
}
