export async function sendMessagingEmailReply(input: {
  accountId: string; tenantId: string; conversationId: string; content: string; idempotencyKey: string; fetcher?: typeof fetch;
}): Promise<{ id: string; executionId: string; status: string; replayed?: boolean }> {
  const baseUrl = process.env.MESSAGING_SERVICE_URL?.trim();
  const issuer = process.env.SERVICEV8_OIDC_ISSUER?.trim();
  const clientId = process.env.SUPPORTV8_EMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.SUPPORTV8_EMAIL_CLIENT_SECRET?.trim();
  const installationId = process.env.SUPPORTV8_MESSAGING_INSTALLATION_ID?.trim();
  const grantRef = process.env.SUPPORTV8_MESSAGING_GRANT_REF?.trim();
  if (!baseUrl || !issuer || !clientId || !clientSecret || !installationId || !grantRef) throw new Error("Messaging email service is not configured");
  if (!/^tenant_[a-z0-9_]{1,56}$/.test(input.tenantId) || !input.accountId.trim()) throw new Error("Invalid Messaging tenant envelope");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.conversationId)) throw new Error("Invalid Messaging conversation");
  if (!input.content.trim() || input.content.length > 20_000 || !input.idempotencyKey.trim()) throw new Error("Invalid Messaging email reply");
  const endpoint = new URL(`/v1/conversations/${encodeURIComponent(input.conversationId)}/reply`, baseUrl);
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1" && !endpoint.hostname.endsWith(".svc.cluster.local")) throw new Error("Messaging email service must use HTTPS or an in-cluster service address");
  const tokenResponse = await (input.fetcher ?? fetch)(`${issuer.replace(/\/$/, "")}/protocol/openid-connect/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, audience: "servicev8-messaging servicev8-registry", scope: "messaging:message:send registry:memberships:read" }),
    signal: AbortSignal.timeout(5_000), redirect: "error", cache: "no-store",
  });
  const tokenBody = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!tokenResponse.ok || typeof tokenBody.access_token !== "string" || !tokenBody.access_token) throw new Error("Messaging workload authentication failed");
  const response = await (input.fetcher ?? fetch)(endpoint.toString(), {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${tokenBody.access_token}`, "content-type": "application/json", "x-servicev8-account-id": input.accountId, "x-servicev8-tenant-id": input.tenantId, "x-servicev8-installation-id": installationId, "x-servicev8-grant-ref": grantRef, "idempotency-key": input.idempotencyKey },
    body: JSON.stringify({ content: input.content.trim() }),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof result.id !== "string" || typeof result.executionId !== "string" || typeof result.status !== "string") throw new Error(`Messaging email reply failed (${response.status})`);
  return result as { id: string; executionId: string; status: string; replayed?: boolean };
}
