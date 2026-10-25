import { requiresWorkspaceOwnerVerification } from "./workspace-owner-verification";
import { pgClient } from "../db/pg-client";
import type { TenantWorkspaceRecord } from "../tenant-resolver";

export const isNativeWorkspaceId = (value: unknown): value is string =>
  typeof value === "string" && /^tenant_[a-z0-9_]{1,56}$/.test(value);

/** Current canonical authority is checked by the caller before this local read.
 * The runtime cannot insert/assign bindings or rewrite tenant identifiers. */
export async function resolveNativeWorkspaceBinding(workspace: TenantWorkspaceRecord): Promise<string | null> {
  if (!workspace.accountId || requiresWorkspaceOwnerVerification({slug:workspace.slug,nativeTenantId:workspace.id})) return null;
  const rows = await pgClient.withSystemSession(async session => {
    await session.query("SELECT set_config('app.current_registry_tenant_id',$1,true),set_config('app.current_account_id',$2,true)", [workspace.id, workspace.accountId]);
    return session.query<{native_tenant_id: string}>(`SELECT native_tenant_id FROM supportv8.workspace_identity_bindings
      WHERE registry_tenant_id=$1 AND account_id=$2 AND slug=$3 AND origin=$4 AND state='active'`,
    [workspace.id, workspace.accountId, workspace.slug, new URL(workspace.url).origin]);
  });
  if (rows.length !== 1 || !isNativeWorkspaceId(rows[0].native_tenant_id)) return null;
  const nativeId = rows[0].native_tenant_id;
  if (requiresWorkspaceOwnerVerification({nativeTenantId:nativeId})) return null;
  const native = await pgClient.withTenantSession(nativeId, session => session.query(`SELECT id FROM supportv8.tenants
    WHERE id=$1 AND domain=$2 AND servicev8_account_id=$3`, [nativeId, workspace.slug, workspace.accountId]));
  return native.length === 1 ? nativeId : null;
}
