import { createHash } from "node:crypto";
import { pgClient, type PostgresClient } from "@/lib/db/pg-client";

export type RuntimeSupportWorkspaceInput = {
  accountId: string;
  registryTenantId: string;
  installationId: string;
  operationId: string;
  tenantDomain: string;
  subject: string;
  verticalId: "runtime";
  companyDisplayName?: string;
};

export type RuntimeSupportWorkspace = {
  status: "workspace_created";
  workspaceId: string;
  domain: string;
};

export class WorkspaceReservationConflictError extends Error {
  constructor() { super("runtime_support_workspace_scope_conflict"); this.name = "WorkspaceReservationConflictError"; }
}
export class InvalidWorkspaceReservationInputError extends Error {
  constructor() { super("invalid_runtime_support_workspace_input"); this.name = "InvalidWorkspaceReservationInputError"; }
}

const required = ["accountId", "registryTenantId", "installationId", "operationId", "tenantDomain", "subject", "verticalId"] as const;
const allowed = new Set<string>([...required, "companyDisplayName"]);
const limits: Record<string, number> = { accountId: 128, registryTenantId: 128, installationId: 128, operationId: 128, tenantDomain: 128, subject: 255, companyDisplayName: 255 };

export function validateRuntimeSupportWorkspaceInput(value: unknown): RuntimeSupportWorkspaceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InvalidWorkspaceReservationInputError();
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !allowed.has(key)) || required.some((key) => !(key in input))) throw new InvalidWorkspaceReservationInputError();
  if (input.verticalId !== "runtime") throw new InvalidWorkspaceReservationInputError();
  for (const [key, max] of Object.entries(limits)) {
    const candidate = input[key];
    if (candidate === undefined && key === "companyDisplayName") continue;
    if (typeof candidate !== "string" || candidate.length < 1 || candidate.length > max || candidate.trim() !== candidate || /[\u0000-\u001f\u007f]/.test(candidate)) throw new InvalidWorkspaceReservationInputError();
  }
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,126}[a-z0-9])?$/.test(String(input.tenantDomain))) throw new InvalidWorkspaceReservationInputError();
  return input as RuntimeSupportWorkspaceInput;
}

function nativeWorkspaceId(input: RuntimeSupportWorkspaceInput): string {
  const digest = createHash("sha256").update(`${input.accountId}\0${input.registryTenantId}\0${input.installationId}`).digest("hex");
  return `tenant_rt_${digest.slice(0, 48)}`;
}

type Row = { native_tenant_id: string; native_domain: string; state: string };
async function ensureRegistrationJob(db:{query:(sql:string,params?:unknown[])=>Promise<unknown>},input:RuntimeSupportWorkspaceInput,workspaceId:string){await db.query(`INSERT INTO supportv8.managed_support_registration_jobs
  (installation_id,acquisition_id,account_id,registry_tenant_id,vertical_id,native_workspace_id)
  VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(installation_id) DO NOTHING`,[input.installationId,input.operationId,input.accountId,input.registryTenantId,input.verticalId,workspaceId]);}

export class RuntimeSupportWorkspaceStore {
  constructor(private readonly client: PostgresClient = pgClient) {}

  async acquire(raw: unknown): Promise<RuntimeSupportWorkspace> {
    const input = validateRuntimeSupportWorkspaceInput(raw);
    const workspaceId = nativeWorkspaceId(input);
    try {
      return await this.client.withWorkspaceProvisioningSession({ tenantId: workspaceId, accountId: input.accountId, registryTenantId: input.registryTenantId }, async (db) => {
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [input.installationId]);
        const rows = await db.query<Row>(`INSERT INTO supportv8.runtime_support_workspaces
          (installation_id, operation_id, account_id, registry_tenant_id, vertical_id, tenant_domain, subject, company_display_name, native_tenant_id, native_domain, state)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$6,'reserved')
          ON CONFLICT (installation_id) DO UPDATE SET installation_id=EXCLUDED.installation_id
          WHERE runtime_support_workspaces.operation_id=EXCLUDED.operation_id
            AND runtime_support_workspaces.account_id=EXCLUDED.account_id
            AND runtime_support_workspaces.registry_tenant_id=EXCLUDED.registry_tenant_id
            AND runtime_support_workspaces.vertical_id=EXCLUDED.vertical_id
            AND runtime_support_workspaces.tenant_domain=EXCLUDED.tenant_domain
            AND runtime_support_workspaces.subject=EXCLUDED.subject
            AND runtime_support_workspaces.company_display_name IS NOT DISTINCT FROM EXCLUDED.company_display_name
            AND runtime_support_workspaces.native_tenant_id=EXCLUDED.native_tenant_id
            AND runtime_support_workspaces.deleted_at IS NULL
          RETURNING native_tenant_id,native_domain,state`, [input.installationId,input.operationId,input.accountId,input.registryTenantId,input.verticalId,input.tenantDomain,input.subject,input.companyDisplayName ?? null,workspaceId]);
        const reserved = rows[0];
        if (!reserved) throw new WorkspaceReservationConflictError();
        if (reserved.state === "workspace_created") {
          const owner = (await db.query<{id:string;domain:string;servicev8_account_id:string|null}>(
            `SELECT id,domain,servicev8_account_id FROM supportv8.tenants WHERE id=$1`, [reserved.native_tenant_id]
          ))[0];
          if (!owner || owner.domain !== reserved.native_domain || owner.servicev8_account_id !== input.accountId) throw new WorkspaceReservationConflictError();
          await ensureRegistrationJob(db,input,reserved.native_tenant_id);
          return { status: "workspace_created", workspaceId: reserved.native_tenant_id, domain: reserved.native_domain };
        }
        const inserted = await db.query<{id:string}>(`INSERT INTO supportv8.tenants(id,domain,name,operating_mode,servicev8_account_id)
          VALUES($1,$2,$3,'autonomous',$4) ON CONFLICT DO NOTHING RETURNING id`, [workspaceId,input.tenantDomain,input.companyDisplayName ?? input.tenantDomain,input.accountId]);
        if (inserted.length !== 1) throw new WorkspaceReservationConflictError();
        const completed = (await db.query<Row>(`UPDATE supportv8.runtime_support_workspaces SET state='workspace_created',updated_at=now()
          WHERE installation_id=$1 AND state='reserved' RETURNING native_tenant_id,native_domain,state`, [input.installationId]))[0];
        if (!completed) throw new WorkspaceReservationConflictError();
        await ensureRegistrationJob(db,input,completed.native_tenant_id);
        return { status: "workspace_created", workspaceId: completed.native_tenant_id, domain: completed.native_domain };
      });
    } catch (error) {
      if (error instanceof InvalidWorkspaceReservationInputError || error instanceof WorkspaceReservationConflictError) throw error;
      if (["23505", "23514", "42501"].includes((error as {code?:string}).code ?? "")) throw new WorkspaceReservationConflictError();
      throw error;
    }
  }
}

export const runtimeSupportWorkspaceStore = new RuntimeSupportWorkspaceStore();
