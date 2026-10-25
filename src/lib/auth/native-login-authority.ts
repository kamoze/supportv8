import type { TenantWorkspaceRecord } from "../tenant-resolver";
import { boundedJson } from "../tasksv8/http";
import { createRegistryReader, discoverWorkspace } from "./workspace-discovery";
import { BotProofError } from "./bot-transaction";
import { withinBotDeadline } from "./bot-gateway";
import { resolveNativeWorkspaceBinding, isNativeWorkspaceId } from "./native-workspace-binding";

type Claims = Record<string, unknown>;
type Dependencies = {
  canonicalIssuer: () => string | undefined;
  workspace: (slug: string) => Promise<TenantWorkspaceRecord | null>;
  membership: (workspace: TenantWorkspaceRecord, subject: string, signal: AbortSignal) => Promise<unknown>;
  native: (workspace: TenantWorkspaceRecord) => Promise<string | null>;
};
const denied = () => new BotProofError(403, "This identity does not have current access to this workspace.");
const unmapped = () => new BotProofError(503, "This workspace identity mapping is not ready for sign-in.");
/** Read-only compatibility boundary. Never derive canonical authority from a slug. */
export function createNativeLoginAuthority(deps: Dependencies) {
  return async (registered: TenantWorkspaceRecord | null | undefined, claims: Claims | undefined, request: Request): Promise<TenantWorkspaceRecord & { nativeTenantId: string }> => {
    // Registry membership keys contain a subject, not an issuer+subject tuple.
    // Only the explicitly configured shared human issuer can supply that subject.
    const canonicalIssuer = deps.canonicalIssuer();
    try {
      const issuer = new URL(canonicalIssuer ?? "");
      if (issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.search || issuer.hash || canonicalIssuer !== canonicalIssuer?.trim()) throw unmapped();
    } catch { throw unmapped(); }
    if (!claims || claims.iss !== canonicalIssuer) throw denied();
    if (!registered || !registered.accountId || !claims || typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 192
      || claims.tenant_id !== registered.id || claims.account_id !== registered.accountId) throw denied();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8000)]);
    const current = await withinBotDeadline(deps.workspace(registered.slug), signal);
    if (!current || current.status !== "active" || current.id !== registered.id || current.accountId !== registered.accountId || current.slug !== registered.slug || current.url !== registered.url) throw denied();
    const value = await withinBotDeadline(deps.membership(current, claims.sub, signal), signal);
    const member = value as Record<string, unknown> | null;
    if (!member || member.accountId !== current.accountId || member.tenantId !== current.id || member.identitySubject !== claims.sub || member.status !== "active" || typeof member.role !== "string" || !member.role) throw denied();
    const nativeTenantId = await withinBotDeadline(deps.native(current), signal);
    if (!isNativeWorkspaceId(nativeTenantId)) throw unmapped();
    signal.throwIfAborted(); return { ...current, nativeTenantId };
  };
}
export const nativeLoginAuthority = { current: createNativeLoginAuthority({
  canonicalIssuer: () => process.env.SERVICEV8_OIDC_ISSUER,
  workspace: discoverWorkspace,
  membership: async (workspace, subject, signal) => {
    const response = await createRegistryReader()(`/v1/tenants/${encodeURIComponent(workspace.id)}/memberships/${encodeURIComponent(subject)}`, { accountId: workspace.accountId! }, signal);
    if (response.status === 404) { void response.body?.cancel().catch(() => {}); return null; }
    if (response.status !== 200 || response.redirected) { void response.body?.cancel().catch(() => {}); throw new BotProofError(503, "Workspace authority is temporarily unavailable."); }
    return boundedJson(response, 16_384, signal);
  },
  native: resolveNativeWorkspaceBinding,
}) };
