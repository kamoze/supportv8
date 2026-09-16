import { createHash } from "node:crypto";
import {
  boundedJson,
  exact,
  identifier,
  parseTarget,
  ticketRef,
  type SupportTarget,
} from "./managed-support-contract";
export type SourceMode = "lookup" | "output";
export type SourceSelector = {
  accountId: string;
  tenantId: string;
  digest: string;
  invocationId?: string;
  disclosureId?: string;
};
export type SupportSourceProof = Record<string, unknown> & {
  accountId: string;
  tenantId: string;
  subject: string;
  originatingClientId: string;
  employeeInstallationId: string;
  employeeId: string;
  employeeEntitlementId: string;
  destinationInstallationId: string;
  workspaceId: string;
  connectionId: string;
  channelGeneration: number;
  expiresAt: number;
  digest: string;
};
const common = [
  "schemaVersion",
  "source",
  "originatingClientId",
  "purpose",
  "accountId",
  "tenantId",
  "subject",
  "threadId",
  "turnId",
  "employeeInstallationId",
  "employeeId",
  "employeeEntitlementId",
  "connectionId",
  "destinationInstallationId",
  "workspaceId",
  "channel",
  "channelGeneration",
  "expiresAt",
];
const hex = /^[a-f0-9]{64}$/;
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function canonicalSupportJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map(canonicalSupportJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            canonicalSupportJson((value as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  throw new TypeError("invalid_source_context");
}
export function supportProofConnectionId(target: SupportTarget): string {
  const bytes = createHash("sha256")
    .update(
      JSON.stringify([
        "managed-support-v1",
        target.accountId,
        target.tenantId,
        target.verticalId,
        target.installationId,
        target.workspaceId,
      ]),
    )
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 15) | 128;
  bytes[8] = (bytes[8]! & 63) | 128;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function supportSourceDigest(context: Record<string, unknown>): string {
  return createHash("sha256")
    .update(
      String(context.schemaVersion) + "\0" + canonicalSupportJson(context),
    )
    .digest("hex");
}
export function parseSourceSelector(
  value: unknown,
  mode: SourceMode,
): SourceSelector {
  const id = mode === "lookup" ? "invocationId" : "disclosureId";
  const row = exact(value, ["accountId", "tenantId", id, "digest"]);
  identifier(row.accountId);
  identifier(row.tenantId);
  if (
    typeof row[id] !== "string" ||
    !uuid.test(row[id] as string) ||
    (row[id] as string)[14] !== "4" ||
    typeof row.digest !== "string" ||
    !hex.test(row.digest)
  )
    throw new TypeError("invalid_source_selector");
  return row as SourceSelector;
}
export function parseSupportSourceProof(
  value: unknown,
  mode: SourceMode,
  now = Date.now(),
): SupportSourceProof {
  const extra =
    mode === "lookup"
      ? ["invocationId", "authority", "capability", "parameters"]
      : ["disclosureId", "invocationId", "invocationDigest", "resultDigest"];
  const row = exact(value, [...common, ...extra, "digest"]);
  const schema =
    mode === "lookup"
      ? "servicev8.support-invocation.v1"
      : "servicev8.support-disclosure.v1";
  if (
    row.schemaVersion !== schema ||
    row.source !== "runtime" ||
    row.channel !== "runtime_chat" ||
    !Number.isSafeInteger(row.channelGeneration) ||
    (row.channelGeneration as number) < 1 ||
    !Number.isSafeInteger(row.expiresAt) ||
    (row.expiresAt as number) <= now ||
    (row.expiresAt as number) > now + 120000
  )
    throw new TypeError("invalid_source_context");
  for (const key of [
    "originatingClientId",
    "accountId",
    "tenantId",
    "subject",
    "employeeInstallationId",
    "employeeId",
    "employeeEntitlementId",
    "destinationInstallationId",
  ])
    identifier(row[key]);
  for (const key of [
    "threadId",
    "turnId",
    "connectionId",
    "invocationId",
    ...(mode === "output" ? ["disclosureId"] : []),
  ])
    if (typeof row[key] !== "string" || !uuid.test(row[key] as string))
      throw new TypeError("invalid_source_context");
  if (
    (row.connectionId as string)[14] !== "8" ||
    (row.invocationId as string)[14] !== "4" ||
    (mode === "output" && (row.disclosureId as string)[14] !== "4")
  )
    throw new TypeError("invalid_source_context");
  parseTarget({
    accountId: row.accountId,
    tenantId: row.tenantId,
    verticalId: "runtime",
    installationId: row.destinationInstallationId,
    workspaceId: row.workspaceId,
  });
  if (mode === "lookup") {
    if (
      row.authority !== "human_session" ||
      row.purpose !== "staff_ticket_read" ||
      row.capability !== "support_ticket_lookup"
    )
      throw new TypeError("invalid_source_context");
    ticketRef(exact(row.parameters, ["ticketReference"]).ticketReference);
  } else {
    if (!["initial_delivery", "history_replay"].includes(String(row.purpose)))
      throw new TypeError("invalid_source_context");
    for (const key of ["invocationDigest", "resultDigest"])
      if (typeof row[key] !== "string" || !hex.test(row[key] as string))
        throw new TypeError("invalid_source_context");
  }
  const { digest, ...context } = row;
  if (
    typeof digest !== "string" ||
    !hex.test(digest) ||
    supportSourceDigest(context) !== digest
  )
    throw new TypeError("source_digest_mismatch");
  if (
    row.connectionId !==
    supportProofConnectionId(supportProofTarget(row as SupportSourceProof))
  )
    throw new TypeError("source_connection_mismatch");
  return row as SupportSourceProof;
}
export function supportProofTarget(proof: SupportSourceProof): SupportTarget {
  return {
    accountId: proof.accountId,
    tenantId: proof.tenantId,
    verticalId: "runtime",
    installationId: proof.destinationInstallationId,
    workspaceId: proof.workspaceId,
  };
}
export function exactConfiguredSupportPolicy(
  value: unknown,
  proof: SupportSourceProof,
): boolean {
  try {
    const response = exact(value, ["configured", "dataReady", "policy"]);
    if (response.configured !== true || response.dataReady !== false)
      return false;
    const p = exact(response.policy, [
      "schemaVersion",
      "accountId",
      "tenantId",
      "installationId",
      "employeeId",
      "employeeEntitlementId",
      "connectionId",
      "destinationInstallationId",
      "workspaceId",
      "capability",
      "generation",
      "channels",
    ]);
    if (
      p.schemaVersion !== "servicev8.support-grant.v2" ||
      p.capability !== "support_ticket_lookup" ||
      !Number.isSafeInteger(p.generation) ||
      (p.generation as number) < 1 ||
      p.installationId !== proof.employeeInstallationId
    )
      return false;
    for (const key of [
      "accountId",
      "tenantId",
      "employeeId",
      "employeeEntitlementId",
      "connectionId",
      "destinationInstallationId",
      "workspaceId",
    ])
      if (p[key] !== proof[key]) return false;
    const ch = exact(exact(p.channels, ["runtime_chat"]).runtime_chat, [
      "state",
      "generation",
      "authority",
    ]);
    const a = exact(ch.authority, ["kind", "audience", "permission"]);
    return (
      ch.state === "active" &&
      ch.generation === proof.channelGeneration &&
      a.kind === "human_session" &&
      a.audience === "tenant_staff" &&
      a.permission === "support.tickets.read"
    );
  } catch {
    return false;
  }
}
export type SourceAuthorityConfig = {
  runtimeUrl?: string;
  registryUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  registryTokenUrl?: string;
  registryClientId?: string;
  registryClientSecret?: string;
  allowedOriginatingClientIds: readonly string[];
  request?: typeof fetch;
  now?: () => number;
};
function origin(
  raw: string | undefined,
  kind: "runtime" | "registry" | "token",
): URL {
  if (!raw) throw Error("source_authority_unconfigured");
  const url = new URL(raw);
  const hosts =
    kind === "runtime"
      ? [
          "servicev8-runtime",
          "servicev8-runtime.default.svc.cluster.local",
        ]
      : kind === "registry"
        ? [
            "registry-service",
            "registry-service.default.svc.cluster.local",
            "servicev8-registry",
            "servicev8-registry.default.svc.cluster.local",
          ]
        : [];
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && hosts.includes(url.hostname) && (kind !== "runtime" || url.port === "3000"))) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    (kind !== "token" && url.pathname !== "/")
  )
    throw Error("source_authority_unconfigured");
  return url;
}
export class ManagedSupportSourceAuthority {
  private request: typeof fetch;
  constructor(private config: SourceAuthorityConfig) {
    this.request = config.request ?? fetch;
  }
  private async token(audience: string, scope: string): Promise<string> {
    const registry = audience === "servicev8-registry";
    const tokenUrl = registry
        ? this.config.registryTokenUrl
        : this.config.tokenUrl,
      clientId = registry ? this.config.registryClientId : this.config.clientId,
      clientSecret = registry
        ? this.config.registryClientSecret
        : this.config.clientSecret;
    if (!clientId || !clientSecret)
      throw Error("source_authority_unconfigured");
    const response = await this.request(origin(tokenUrl, "token"), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        audience,
        scope,
      }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = (await boundedJson(response, 16384)) as Record<
      string,
      unknown
    >;
    if (
      !response.ok ||
      !body ||
      typeof body.access_token !== "string" ||
      !body.access_token ||
      body.token_type !== "Bearer" ||
      !Number.isSafeInteger(body.expires_in) ||
      (body.expires_in as number) < 1 ||
      (body.expires_in as number) > 120
    )
      throw Error("source_authority_unavailable");
    return body.access_token;
  }
  async verify(
    mode: SourceMode,
    selector: SourceSelector,
  ): Promise<SupportSourceProof | null> {
    try {
      parseSourceSelector(selector, mode);
      const disclosure = mode === "output";
      const token = await this.token(
        "servicev8-agentic-runtime",
        disclosure
          ? "runtime:support-disclosure:verify"
          : "runtime:support-invocation:verify",
      );
      const response = await this.request(
        new URL(
          disclosure
            ? "/internal/support-disclosures/verify"
            : "/internal/support-invocations/verify",
          origin(this.config.runtimeUrl, "runtime"),
        ),
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(selector),
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        return null;
      }
      const field = disclosure ? "disclosure" : "invocation";
      const body = exact(await boundedJson(response, 16384), ["ok", field]);
      if (body.ok !== true) return null;
      const proof = parseSupportSourceProof(
        body[field],
        mode,
        (this.config.now ?? Date.now)(),
      );
      for (const [key, value] of Object.entries(selector))
        if (proof[key] !== value) return null;
      if (
        !this.config.allowedOriginatingClientIds.includes(
          proof.originatingClientId,
        )
      )
        return null;
      const url = new URL(
        `/v1/installations/${encodeURIComponent(proof.employeeInstallationId)}/support-context/configured`,
        origin(this.config.registryUrl, "registry"),
      );
      url.searchParams.set("accountId", proof.accountId);
      url.searchParams.set("tenantId", proof.tenantId);
      url.searchParams.set("channel", "runtime_chat");
      const current = await this.request(url, {
        headers: {
          authorization: `Bearer ${await this.token("servicev8-registry", "registry:support-context:read")}`,
          accept: "application/json",
        },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!current.ok) {
        await current.body?.cancel();
        return null;
      }
      if (
        !exactConfiguredSupportPolicy(
          await boundedJson(current, 16384),
          proof,
        ) ||
        proof.expiresAt <= (this.config.now ?? Date.now)()
      )
        return null;
      return proof;
    } catch {
      return null;
    }
  }
}

export function managedSupportSourceAuthorityFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
  request: typeof fetch = fetch,
  now?: () => number,
) {
  return new ManagedSupportSourceAuthority({
    runtimeUrl: env.SUPPORT_RUNTIME_URL,
    registryUrl: env.REGISTRY_URL,
    registryTokenUrl: env.SUPPORTV8_MANAGED_TOKEN_URL,
    registryClientId: env.SUPPORTV8_MANAGED_CLIENT_ID,
    registryClientSecret: env.SUPPORTV8_MANAGED_CLIENT_SECRET,
    tokenUrl: env.SUPPORTV8_SOURCE_TOKEN_URL,
    clientId: env.SUPPORTV8_SOURCE_CLIENT_ID,
    clientSecret: env.SUPPORTV8_SOURCE_CLIENT_SECRET,
    allowedOriginatingClientIds: (
      env.SUPPORTV8_RUNTIME_INVOCATION_CLIENT_IDS ?? ""
    )
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    request,
    now,
  });
}
