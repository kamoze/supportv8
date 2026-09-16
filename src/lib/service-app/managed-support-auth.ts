import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import {
  identifier,
  type SupportActor,
  type SupportOperation,
} from "./managed-support-contract";
export type ManagedSupportAuthenticator = (
  request: Request,
  operation: SupportOperation,
) => Promise<SupportActor | null>;
export function createManagedSupportAuthenticator(input: {
  issuer: string;
  allowedClientIds: readonly string[];
  allowedDataClientIds?: readonly string[];
  key: JWTVerifyGetKey | CryptoKey | Uint8Array;
}): ManagedSupportAuthenticator {
  return async (request, operation) => {
    try {
      const header = request.headers.get("authorization") ?? "";
      if (!header.startsWith("Bearer ") || header.length > 16400) return null;
      const { payload: p } = await jwtVerify(header.slice(7), input.key, {
        issuer: input.issuer,
        audience: "supportv8",
        algorithms: ["RS256"],
        requiredClaims: ["sub", "azp", "iat", "exp", "jti"],
        maxTokenAge: "5m",
        clockTolerance: 0,
      });
      identifier(p.sub);
      identifier(p.jti);
      if (
        typeof p.azp !== "string" ||
        !input.allowedClientIds.includes(p.azp) ||
        typeof p.iat !== "number" ||
        typeof p.exp !== "number" ||
        p.exp <= p.iat ||
        p.exp - p.iat > 300
      )
        return null;
      const scopes = {
        "connection.lifecycle": "supportv8:managed:lifecycle",
        "connection.verify": "supportv8:managed:connect",
        "connection.readiness": "supportv8:managed:readiness",
        support_output_access: "supportv8:output:authorize",
        support_ticket_lookup: "supportv8:tickets:read",
      };
      if (p.scope !== scopes[operation]) return null;
      const data =
        operation === "support_ticket_lookup" ||
        operation === "support_output_access";
      if (
        data &&
        (p.exp - p.iat > 120 ||
          !(input.allowedDataClientIds ?? input.allowedClientIds).includes(
            p.azp,
          ))
      )
        return null;
      const actor: SupportActor = {
        clientId: p.azp,
        ...(p.account_id === undefined
          ? {}
          : { accountId: identifier(p.account_id) }),
        ...(p.tenant_id === undefined
          ? {}
          : { tenantId: identifier(p.tenant_id) }),
        correlationId: identifier(p.correlation_id ?? p.jti),
      };
      return actor;
    } catch {
      return null;
    }
  };
}
export function managedSupportAuthenticatorFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ManagedSupportAuthenticator | undefined {
  const issuer = env.SUPPORTV8_MANAGED_WORKLOAD_ISSUER?.trim(),
    clients = env.SUPPORTV8_MANAGED_WORKLOAD_CLIENT_IDS?.split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  if (!issuer || !clients?.length) return undefined;
  try {
    return createManagedSupportAuthenticator({
      issuer,
      allowedClientIds: clients,
      allowedDataClientIds: (env.SUPPORTV8_MANAGED_DATA_CLIENT_IDS ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      key: createRemoteJWKSet(
        new URL(
          env.SUPPORTV8_MANAGED_WORKLOAD_JWKS_URL ??
            `${issuer.replace(/\/$/, "")}/protocol/openid-connect/certs`,
        ),
        { timeoutDuration: 3000 },
      ),
    });
  } catch {
    return undefined;
  }
}
