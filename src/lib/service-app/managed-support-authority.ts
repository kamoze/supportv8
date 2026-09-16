import { pgClient, type PostgresClient } from "../db/pg-client";
import {
  boundedJson,
  record,
  type SupportActor,
  type SupportTarget,
  type SupportOperation,
} from "./managed-support-contract";
type Env = Readonly<Record<string, string | undefined>>;
type Dependencies = {
  env?: Env;
  request?: typeof fetch;
  client?: PostgresClient;
  get?: (url: URL) => Promise<unknown>;
  local?: (target: SupportTarget) => Promise<boolean>;
  verifyGrant?: (
    target: SupportTarget,
    actor: SupportActor,
  ) => Promise<boolean>;
  now?: () => number;
};
/** Registry proves lifecycle/consumer identity. The capability owner separately proves current assignment. */
export class ManagedSupportAuthority {
  private readonly env: Env;
  private readonly request: typeof fetch;
  private readonly client: PostgresClient;
  constructor(private readonly deps: Dependencies = {}) {
    this.env = deps.env ?? process.env;
    this.request = deps.request ?? fetch;
    this.client = deps.client ?? pgClient;
  }
  private origin(): URL {
    const url = new URL(this.env.REGISTRY_URL ?? "https://registry.invalid");
    if (
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          [
            "servicev8-registry",
            "servicev8-registry.default.svc.cluster.local",
          ].includes(url.hostname)
        )) ||
      url.pathname !== "/" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw Error();
    return url;
  }
  private async token(audience: string, scope: string): Promise<string> {
    const endpoint = this.env.SUPPORTV8_MANAGED_TOKEN_URL,
      clientId = this.env.SUPPORTV8_MANAGED_CLIENT_ID,
      secret = this.env.SUPPORTV8_MANAGED_CLIENT_SECRET;
    if (!endpoint || !clientId || !secret) throw Error("authority_unavailable");
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      throw Error();
    const response = await this.request(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: secret,
        audience,
        scope,
      }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = record(await boundedJson(response));
    if (
      !response.ok ||
      typeof body.access_token !== "string" ||
      body.token_type !== "Bearer" ||
      typeof body.expires_in !== "number" ||
      body.expires_in < 1 ||
      body.expires_in > 300
    )
      throw Error();
    return body.access_token;
  }
  private async get(url: URL): Promise<unknown> {
    if (this.deps.get) return this.deps.get(url);
    if (!this.env.REGISTRY_URL) throw Error();
    const scope = url.pathname.endsWith("/support-context")
      ? "registry:support-context:read"
      : url.pathname === "/v1/employee-consumer-bindings"
        ? "registry:employees:read"
        : "registry:installations:read";
    const response = await this.request(url, {
      headers: {
        authorization: `Bearer ${await this.token("servicev8-registry", scope)}`,
        accept: "application/json",
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw Error();
    return boundedJson(response, 65536);
  }
  private async rows(
    target: SupportTarget,
    installationId: string,
  ): Promise<Record<string, unknown>[]> {
    const url = new URL("/v1/projections/installations", this.origin());
    for (const [key, value] of Object.entries({
      accountId: target.accountId,
      tenantId: target.tenantId,
      installationId,
    }))
      url.searchParams.set(key, value);
    const value = record(await this.get(url));
    if (!Array.isArray(value.installations)) throw Error();
    return value.installations.map(record);
  }
  private active(row: Record<string, unknown>): boolean {
    return (
      row.entitlementStatus === "active" &&
      row.installationState === "active" &&
      (row.expiresAt === undefined ||
        (typeof row.expiresAt === "string" &&
          Date.parse(row.expiresAt) > (this.deps.now ?? Date.now)()))
    );
  }
  private async local(target: SupportTarget): Promise<boolean> {
    if (this.deps.local) return this.deps.local(target);
    return this.client.withWorkspaceProvisioningSession(
      {
        tenantId: target.workspaceId,
        accountId: target.accountId,
        registryTenantId: target.tenantId,
      },
      async (db) =>
        (
          await db.query(
            `SELECT w.installation_id FROM supportv8.runtime_support_workspaces w JOIN supportv8.tenants t ON t.id=w.native_tenant_id AND t.domain=w.native_domain AND t.servicev8_account_id=w.account_id WHERE w.installation_id=$1 AND w.account_id=$2 AND w.registry_tenant_id=$3 AND w.vertical_id='runtime' AND w.native_tenant_id=$4 AND w.state='workspace_created' AND w.deleted_at IS NULL`,
            [
              target.installationId,
              target.accountId,
              target.tenantId,
              target.workspaceId,
            ],
          )
        ).length === 1,
    );
  }
  async lifecycle(target: SupportTarget): Promise<Record<string, unknown>> {
    const rows = await this.client.withWorkspaceProvisioningSession(
      {
        tenantId: target.workspaceId,
        accountId: target.accountId,
        registryTenantId: target.tenantId,
      },
      (db) =>
        db.query<{
          state: string;
          deleted_at: unknown;
          desired_state: string;
          observed_generation: number;
        }>(
          `SELECT w.state,w.deleted_at,j.desired_state,j.observed_generation FROM supportv8.runtime_support_workspaces w JOIN supportv8.managed_support_registration_jobs j ON j.installation_id=w.installation_id AND j.account_id=w.account_id AND j.registry_tenant_id=w.registry_tenant_id AND j.vertical_id=w.vertical_id AND j.native_workspace_id=w.native_tenant_id WHERE w.installation_id=$1 AND w.account_id=$2 AND w.registry_tenant_id=$3 AND w.vertical_id='runtime' AND w.native_tenant_id=$4`,
          [
            target.installationId,
            target.accountId,
            target.tenantId,
            target.workspaceId,
          ],
        ),
    );
    if (rows.length !== 1) throw Error("lifecycle_authority_unavailable");
    const row = rows[0]!;
    if (row.state === "tombstoned" && row.deleted_at != null) {
      if (
        row.desired_state !== "permanently_revoked" ||
        !Number.isSafeInteger(row.observed_generation) ||
        row.observed_generation < 1
      )
        throw Error("lifecycle_observation_pending");
      return {
        ok: true,
        target,
        decision: "permanently_revoked",
        observedGeneration: row.observed_generation,
        reasonCode: "workspace_tombstoned",
      };
    }
    if (row.desired_state !== "active" || row.observed_generation !== 0)
      throw Error("lifecycle_identity_conflict");
    const active = await this.verify(target);
    return {
      ok: true,
      target,
      decision: active ? "active" : "temporarily_unavailable",
      observedGeneration: 0,
      reasonCode: active ? "workspace_active" : "authority_unavailable",
    };
  }
  async verify(
    target: SupportTarget,
    operation: SupportOperation = "connection.readiness",
  ): Promise<boolean> {
    try {
      const rows = await this.rows(target, target.installationId);
      if (rows.length !== 1) return false;
      const p = rows[0]!;
      const b = record(p.serviceAppBinding);
      if (
        p.accountId !== target.accountId ||
        p.tenantId !== target.tenantId ||
        p.verticalId !== target.verticalId ||
        p.installationId !== target.installationId ||
        p.productKind !== "service_app" ||
        p.productId !== "servicev8.service-app.supportv8" ||
        p.productVersion !== "1.0.0" ||
        !(operation === "connection.verify"
          ? p.entitlementStatus === "active" &&
            ["provisioning", "configuration_required", "active"].includes(
              String(p.installationState),
            ) &&
            (p.expiresAt === undefined ||
              (typeof p.expiresAt === "string" &&
                Date.parse(p.expiresAt) > (this.deps.now ?? Date.now)()))
          : this.active(p) &&
            record(p.serviceAppReadiness).state === "ready") ||
        record(p.serviceAppPlanAccess).state !== "included" ||
        b.schemaVersion !== "servicev8.service-app-binding.v1" ||
        b.appKey !== "supportv8" ||
        b.externalWorkspaceId !== target.workspaceId ||
        b.poolAccountId !== target.accountId ||
        b.provisioningState !== "provisioned" ||
        b.poolBindingState !== "verified"
      )
        return false;
      return await this.local(target);
    } catch {
      return false;
    }
  }
  async authorize(
    target: SupportTarget,
    actor: SupportActor,
  ): Promise<boolean> {
    try {
      const grant = actor.grant;
      if (
        !grant ||
        actor.accountId !== target.accountId ||
        actor.tenantId !== target.tenantId ||
        actor.actorId !== grant.employeeId ||
        grant.destinationInstallationId !== target.installationId ||
        grant.workspaceId !== target.workspaceId
      )
        return false;
      const rows = await this.rows(target, grant.employeeInstallationId);
      if (rows.length !== 1) return false;
      const p = rows[0]!;
      if (
        p.accountId !== target.accountId ||
        p.tenantId !== target.tenantId ||
        p.installationId !== grant.employeeInstallationId ||
        p.entitlementId !== grant.employeeEntitlementId ||
        p.hireId !== grant.employeeId ||
        p.productKind !== "ai_employee" ||
        p.productId !== "servicev8.ai-support-agent" ||
        p.verticalId !== "runtime" ||
        !this.active(p) ||
        !Array.isArray(p.missingCapabilities) ||
        p.missingCapabilities.length !== 0
      )
        return false;
      const url = new URL("/v1/employee-consumer-bindings", this.origin());
      for (const [key, value] of Object.entries({
        accountId: target.accountId,
        tenantId: target.tenantId,
        identitySubject: grant.principalId,
        consumerAppId: "supportv8",
        installationId: grant.employeeInstallationId,
      }))
        url.searchParams.set(key, value);
      const value = record(await this.get(url));
      if (!Array.isArray(value.bindings) || value.bindings.length !== 1)
        return false;
      const b = record(value.bindings[0]);
      if (
        b.accountId !== target.accountId ||
        b.tenantId !== target.tenantId ||
        b.consumerAppId !== "supportv8" ||
        b.ownerAppId !== "runtime" ||
        b.canonicalInstallationId !== grant.employeeInstallationId ||
        b.canonicalEntitlementId !== grant.employeeEntitlementId ||
        b.canonicalHireId !== grant.employeeId ||
        b.productId !== "servicev8.ai-support-agent" ||
        b.state !== "consumer_bound"
      )
        return false;
      // An enabled consumer is not a per-tool grant. Missing owner verifier always denies.
      if (this.deps.verifyGrant)
        return await this.deps.verifyGrant(target, actor);
      const grantUrl = new URL(
        `/v1/installations/${encodeURIComponent(grant.employeeInstallationId)}/support-context`,
        this.origin(),
      );
      grantUrl.searchParams.set("accountId", target.accountId);
      grantUrl.searchParams.set("tenantId", target.tenantId);
      const proof = record(await this.get(grantUrl)),
        policy = record(proof.policy);
      return (
        proof.active === true &&
        policy.schemaVersion === "servicev8.support-grant.v1" &&
        policy.accountId === target.accountId &&
        policy.tenantId === target.tenantId &&
        policy.installationId === grant.employeeInstallationId &&
        policy.employeeId === grant.employeeId &&
        policy.employeeEntitlementId === grant.employeeEntitlementId &&
        policy.principalId === grant.principalId &&
        policy.connectionId === grant.connectionId &&
        policy.destinationInstallationId === target.installationId &&
        policy.workspaceId === target.workspaceId &&
        policy.capability === "support_ticket_lookup" &&
        policy.state === "active" &&
        policy.generation === grant.generation
      );
    } catch {
      return false;
    }
  }
}
export class ManagedSupportTicketReader {
  constructor(private readonly client: PostgresClient = pgClient) {}
  async lookup(target: SupportTarget, reference: string) {
    return this.client.withTenantSession(target.workspaceId, async (db) => {
      const rows = await db.query<{
        external_id: string;
        source_status: string;
        priority: string;
      }>(
        `SELECT external_id,source_status,priority FROM supportv8.issues WHERE tenant_id=$1 AND external_id=$2 LIMIT 2`,
        [target.workspaceId, reference],
      );
      // Native sources can reuse external references. Never choose an ambiguous ticket.
      return rows.length === 1
        ? {
            ticketRef: rows[0]!.external_id,
            status: rows[0]!.source_status,
            priority: rows[0]!.priority,
          }
        : null;
    });
  }
}
