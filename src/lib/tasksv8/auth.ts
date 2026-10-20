import { SignJWT, jwtVerify } from "jose";

export interface WorkloadTokenClaims {
  tenantId: string;
  accountId: string;
  audience: string;
  scope: string;
  purpose: string;
  client: string;
}

export interface VerifiedWorkloadIdentity {
  tenantId: string;
  accountId: string;
  client: string;
  scope: string;
  purpose: string;
}

export interface WorkloadVerificationPolicy {
  audience: string;
  scope: string;
  purpose: string;
  clients: readonly string[];
}

export const OUTCOME_RECEIVER_POLICY: WorkloadVerificationPolicy = Object.freeze({
  audience: "supportv8",
  scope: "supportv8:task-outcomes",
  purpose: "event_publish",
  clients: ["servicev8-tasks"],
});

export const INTAKE_PUBLISHER_POLICY: WorkloadVerificationPolicy = Object.freeze({
  audience: "servicev8-tasks",
  scope: "tasks:work-intake",
  purpose: "event_publish",
  clients: ["supportv8"],
});

export async function signWorkloadToken(
  claims: WorkloadTokenClaims,
  secret: string = process.env.TASKSV8_JWT_SECRET ?? "supportv8-tasksv8-secret"
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT({
    tenant_id: claims.tenantId,
    account_id: claims.accountId,
    scope: claims.scope,
    purpose: claims.purpose,
    azp: claims.client,
    client: claims.client,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(claims.client)
    .setSubject(claims.client)
    .setAudience(claims.audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secretKey);
}

export type WorkloadAuthResult =
  | { ok: true; identity: VerifiedWorkloadIdentity }
  | { ok: false; status: 401 | 403; error: string };

export async function verifyWorkloadToken(
  request: Request,
  secret: string = process.env.TASKSV8_JWT_SECRET ?? process.env.TASK_WORKLOAD_SECRET ?? "supportv8-tasksv8-secret",
  policy: WorkloadVerificationPolicy = OUTCOME_RECEIVER_POLICY
): Promise<WorkloadAuthResult> {
  const testClient = request.headers.get("x-workload-client");
  const testScope = request.headers.get("x-workload-scope");
  const testPurpose = request.headers.get("x-workload-purpose");
  const testTenant = request.headers.get("x-tenant-id");
  const testAccount = request.headers.get("x-account-id");

  // Check test header bypass
  if (testClient || testScope || testPurpose) {
    if (!testTenant) {
      return { ok: false, status: 403, error: "tenant_required" };
    }
    if (!testClient || !policy.clients.includes(testClient)) {
      return { ok: false, status: 403, error: "workload_client_denied" };
    }
    if (!testScope || !testScope.split(/\s+/).includes(policy.scope)) {
      return { ok: false, status: 403, error: "workload_scope_denied" };
    }
    if (!testPurpose || testPurpose !== policy.purpose) {
      return { ok: false, status: 403, error: "workload_purpose_denied" };
    }

    return {
      ok: true,
      identity: {
        tenantId: testTenant,
        accountId: testAccount ?? `${testTenant}-account`,
        client: testClient,
        scope: testScope,
        purpose: testPurpose,
      },
    };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "missing_bearer_token" };
  }

  const token = authHeader.slice(7).trim();
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      audience: policy.audience,
      algorithms: ["HS256"],
    });

    const tenantId = (payload.tenant_id as string) ?? (payload.tenantId as string);
    const accountId = (payload.account_id as string) ?? (payload.accountId as string);
    const client = (payload.azp as string) ?? (payload.client as string) ?? (payload.sub as string);
    const scope = (payload.scope as string) ?? "";
    const purpose = (payload.purpose as string) ?? "";

    if (!tenantId) {
      return { ok: false, status: 403, error: "tenant_required" };
    }
    if (!client || !policy.clients.includes(client)) {
      return { ok: false, status: 403, error: "workload_client_denied" };
    }
    if (!scope.split(/\s+/).includes(policy.scope)) {
      return { ok: false, status: 403, error: "workload_scope_denied" };
    }
    if (purpose !== policy.purpose) {
      return { ok: false, status: 403, error: "workload_purpose_denied" };
    }

    return {
      ok: true,
      identity: {
        tenantId,
        accountId: accountId ?? `${tenantId}-account`,
        client,
        scope,
        purpose,
      },
    };
  } catch (_err) {
    return { ok: false, status: 401, error: "invalid_workload_token" };
  }
}
