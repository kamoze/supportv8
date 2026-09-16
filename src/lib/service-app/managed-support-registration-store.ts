import { Pool, type QueryResultRow } from "pg";
import type { ManagedSupportRegistrationJob } from "./managed-support-registration";

type JobRow = QueryResultRow & {
  installation_id: string;
  acquisition_id: string;
  account_id: string;
  registry_tenant_id: string;
  vertical_id: "runtime";
  native_workspace_id: string;
  state: ManagedSupportRegistrationJob["state"];
  attempt_count: number;
  connection_id: string | null;
};
export type RegistrationUpdate = {
  state: ManagedSupportRegistrationJob["state"];
  connectionId?: string;
  lastErrorCode?: string;
  nextAttemptAt?: string;
};

export class ManagedSupportRegistrationStore {
  private readonly pool: Pool;
  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error("DATABASE_URL is required");
    this.pool = new Pool({
      connectionString,
      max: 4,
      allowExitOnIdle: process.env.NODE_ENV === "test",
    });
  }
  async claim(
    workerId: string,
    limit = 8,
  ): Promise<ManagedSupportRegistrationJob[]> {
    const { rows } = await this.pool.query<JobRow>(
      "SELECT * FROM supportv8.claim_managed_support_registration_jobs($1,$2)",
      [workerId, limit],
    );
    return rows.map((row) => ({
      installationId: row.installation_id,
      acquisitionId: row.acquisition_id,
      accountId: row.account_id,
      registryTenantId: row.registry_tenant_id,
      verticalId: row.vertical_id,
      workspaceId: row.native_workspace_id,
      state: row.state,
      attemptCount: row.attempt_count,
      ...(row.connection_id ? { connectionId: row.connection_id } : {}),
    }));
  }
  async finish(
    workerId: string,
    installationId: string,
    value: RegistrationUpdate,
  ): Promise<void> {
    await this.pool.query(
      "SELECT supportv8.finish_managed_support_registration_job($1,$2,$3,$4,$5,$6)",
      [
        workerId,
        installationId,
        value.state,
        value.connectionId ?? null,
        value.lastErrorCode ?? null,
        value.nextAttemptAt ?? null,
      ],
    );
  }
  async close() {
    await this.pool.end();
  }
}
