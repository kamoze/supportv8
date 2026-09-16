import type { ManagedSupportRegistrationJob } from "./managed-support-registration";

const MAX_RESPONSE_BYTES = 32 * 1024;
function configuredUrl(
  raw: string | undefined,
  kind: "token" | "gateway",
): URL {
  if (!raw) throw new Error(`managed_support_${kind}_unconfigured`);
  const url = new URL(raw);
  const internal =
    kind === "gateway" &&
    url.protocol === "http:" &&
    ["action-gateway", "action-gateway.default.svc.cluster.local"].includes(
      url.hostname,
    );
  if (
    (url.protocol !== "https:" && !internal) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (kind === "gateway" && url.pathname !== "/")
  )
    throw new Error(`managed_support_${kind}_unconfigured`);
  return url;
}

export async function boundedManagedSupportJson(
  response: Response,
): Promise<Record<string, unknown>> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_RESPONSE_BYTES)
    throw new Error("managed_support_response_too_large");
  if (!response.body) return {};
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("managed_support_response_too_large");
    }
    chunks.push(value);
  }
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) as Record<
    string,
    unknown
  >;
}

async function systemToken(scope: string): Promise<string> {
  const url = configuredUrl(process.env.SUPPORT_MANAGED_TOKEN_URL, "token"),
    clientId = process.env.SUPPORT_MANAGED_CLIENT_ID,
    secret = process.env.SUPPORT_MANAGED_CLIENT_SECRET;
  if (!clientId || !secret)
    throw new Error("managed_support_oauth_unconfigured");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: secret,
      scope,
    }),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("managed_support_oauth_unavailable");
  const body = await boundedManagedSupportJson(response);
  if (typeof body.access_token !== "string" || body.access_token.length < 1)
    throw new Error("managed_support_oauth_invalid");
  return body.access_token;
}

export async function callManagedSupportGateway(
  kind: "connect" | "readiness" | "disable",
  job: ManagedSupportRegistrationJob,
  connectionId?: string,
  observedGeneration?: number,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const base = configuredUrl(process.env.ACTION_GATEWAY_URL, "gateway");
  const token = await systemToken(
    kind === "disable"
      ? "action:support:lifecycle"
      : kind === "connect"
        ? "action:support:connect"
        : "action:support:readiness",
  );
  const target = {
    accountId: job.accountId,
    tenantId: job.registryTenantId,
    verticalId: job.verticalId,
    installationId: job.installationId,
    workspaceId: job.workspaceId,
  };
  const response = await fetch(
    new URL(
      kind === "disable"
        ? "/v1/support/managed/disable"
        : kind === "connect"
          ? "/v1/support/managed/connect"
          : "/v1/support/managed/readiness",
      base,
    ),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(
        kind === "disable"
          ? { target, connectionId, observedGeneration }
          : kind === "connect"
            ? { target }
            : { target, connectionId },
      ),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );
  return {
    status: response.status,
    body: await boundedManagedSupportJson(response),
  };
}
