import type { TenantWorkspaceRecord } from "../tenant-resolver";
import { pgClient } from "../db/pg-client";
import { boundedJson } from "../tasksv8/http";
import { createRegistryReader, discoverWorkspace } from "./workspace-discovery";
import { BotProofError } from "./bot-transaction";
import { withinBotDeadline } from "./bot-gateway";
import { tenantSlugFromId } from "./request-tenant";

type Claims = Record<string, unknown>;
type Dependencies = {
  workspace: (slug: string) => Promise<TenantWorkspaceRecord | null>;
  membership: (workspace: TenantWorkspaceRecord, subject: string, signal: AbortSignal) => Promise<unknown>;
  native: (workspace: TenantWorkspaceRecord) => Promise<boolean>;
};
const denied = () => new BotProofError(403, "This identity does not have current access to this workspace.");
const unmapped = () => new BotProofError(503, "This workspace identity mapping is not ready for sign-in.");
/** Read-only compatibility boundary. Never derive canonical authority from a slug. */
export function createNativeLoginAuthority(deps: Dependencies) {
  return async (registered: TenantWorkspaceRecord | null | undefined, claims: Claims | undefined, request: Request): Promise<TenantWorkspaceRecord> => {
    if (!registered || !registered.accountId || !claims || typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 192
      || claims.tenant_id !== registered.id || claims.account_id !== registered.accountId) throw denied();
    // Downstream native routes still use the legacy native ID representation.
    // Admit only an actual persisted canonical identity that already matches it.
    // Opaque canonical IDs require an explicit migration across login/refresh/API.
    try { if (tenantSlugFromId(registered.id) !== registered.slug) throw unmapped(); } catch { throw unmapped(); }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8000)]);
    const current = await withinBotDeadline(deps.workspace(registered.slug), signal);
    if (!current || current.status !== "active" || current.id !== registered.id || current.accountId !== registered.accountId || current.slug !== registered.slug || current.url !== registered.url) throw denied();
    const value = await withinBotDeadline(deps.membership(current, claims.sub, signal), signal);
    const member = value as Record<string, unknown> | null;
    if (!member || member.accountId !== current.accountId || member.tenantId !== current.id || member.identitySubject !== claims.sub || member.status !== "active" || typeof member.role !== "string" || !member.role) throw denied();
    if (!await withinBotDeadline(deps.native(current), signal)) throw unmapped();
    signal.throwIfAborted(); return current;
  };
}
export const nativeLoginAuthority = { current: createNativeLoginAuthority({
  workspace: discoverWorkspace,
  membership: async (workspace, subject, signal) => {
    const response = await createRegistryReader()(`/v1/tenants/${encodeURIComponent(workspace.id)}/memberships/${encodeURIComponent(subject)}`, { accountId: workspace.accountId! }, signal);
    if (response.status === 404) { void response.body?.cancel().catch(() => {}); return null; }
    if (response.status !== 200 || response.redirected) { void response.body?.cancel().catch(() => {}); throw new BotProofError(503, "Workspace authority is temporarily unavailable."); }
    return boundedJson(response, 16_384, signal);
  },
  native: async workspace => pgClient.withTenantSession(workspace.id, async session => {
    const rows = await session.query(`SELECT id FROM supportv8.tenants WHERE id=$1 AND domain=$2 AND servicev8_account_id=$3`, [workspace.id, workspace.slug, workspace.accountId]);
    return rows.length === 1;
  }),
}) };
