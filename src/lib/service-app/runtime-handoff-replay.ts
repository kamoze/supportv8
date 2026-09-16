import { createHash } from "node:crypto";
import { pgClient, type PostgresClient } from "@/lib/db/pg-client";
import type { RuntimeSupportHandoffClaims } from "./runtime-handoff-claims";
export type RuntimeHandoffReplayStore = {
  consume: (claims: RuntimeSupportHandoffClaims) => Promise<boolean>;
};
export class PostgresRuntimeHandoffReplayStore
  implements RuntimeHandoffReplayStore
{
  constructor(private readonly client: PostgresClient = pgClient) {}
  async consume(c: RuntimeSupportHandoffClaims): Promise<boolean> {
    try {
      return await this.client.withWorkspaceProvisioningSession(
        {
          tenantId: c.externalWorkspaceId,
          accountId: c.accountId,
          registryTenantId: c.tenantId,
        },
        async (db) => {
          await db.query(
            `DELETE FROM supportv8.runtime_support_handoff_uses WHERE ctid IN (SELECT ctid FROM supportv8.runtime_support_handoff_uses WHERE native_workspace_id=$1 AND account_id=$2 AND registry_tenant_id=$3 AND expires_at<now() LIMIT 100)`,
            [c.externalWorkspaceId, c.accountId, c.tenantId],
          );
          const hash = createHash("sha256")
            .update(`${c.iss}\0${c.jti}`)
            .digest("hex");
          const rows = await db.query<{ jti_hash: string }>(
            `INSERT INTO supportv8.runtime_support_handoff_uses(jti_hash,issuer,account_id,registry_tenant_id,native_workspace_id,expires_at) VALUES($1,$2,$3,$4,$5,to_timestamp($6)) ON CONFLICT DO NOTHING RETURNING jti_hash`,
            [
              hash,
              c.iss,
              c.accountId,
              c.tenantId,
              c.externalWorkspaceId,
              c.exp,
            ],
          );
          return rows.length === 1;
        },
      );
    } catch {
      return false;
    }
  }
}
export const runtimeHandoffReplayStore =
  new PostgresRuntimeHandoffReplayStore();
