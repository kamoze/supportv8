/**
 * Reading a tenant's autonomy policy from the system-of-record.
 *
 * ── Why this is a SEPARATE read from `ctx.tuning` ─────────────────────────
 *
 * Both land in the same store — the gateway's customization system-of-record,
 * reached through `OperationGateway.getEffectiveTuning`. They are still two
 * reads, under two scopes, and the runtime hands the engine only one of them.
 *
 *   tuning            scope `tuning:default`. BEHAVIOUR. Grace days, tone,
 *                     thresholds the engine reasons with. The engine reads it.
 *                     A vertical's admin screen edits it freely.
 *   autonomy policy   scope `autonomy:policy`. GOVERNANCE. How much blast
 *                     radius may land unattended. The engine never sees it and
 *                     cannot influence it.
 *
 * The separation is load-bearing. `runtime.ts` already states that tuning
 * "never grants a scope and never appears in the autonomy decision", and that
 * has to stay true even though the autonomy threshold is now also tenant
 * configuration. If the dial lived in `ctx.tuning`, an engine could read the
 * gate that governs it, and — more importantly — anything with permission to
 * edit an engine's behaviour config would inherit permission to widen the
 * gate. Those are different permissions and they belong to different people.
 *
 * The SoR is the right home for the same reason it is the right home for
 * tuning: its accept/activate/rollback flow gives the threshold a revision, an
 * author and a reversal path, which is what "tenant-configurable AND auditable"
 * actually requires. A threshold in an environment variable is configurable
 * and not auditable; one in this repo is auditable and not configurable.
 */

import type { OperationGateway } from "../gateway/operation-gateway";
import type { TenantRef } from "../tenant/identity";
import { DENY_ALL_AUTONOMY, parseAutonomyPolicy, type AutonomyPolicy } from "./policy";

/** The governance scope. A constant so no vertical spells it differently. */
export const AUTONOMY_POLICY_SCOPE = "autonomy:policy";

export type AutonomyPolicyRequest = {
  readonly tenant: TenantRef;
  readonly vertical: string;
  /** Which hire's policy, e.g. `"rent-bookkeeper"`. */
  readonly moduleKey: string;
  /** Defaults to {@link AUTONOMY_POLICY_SCOPE}. */
  readonly scope?: string;
};

export type ResolvedAutonomyPolicy = {
  readonly policy: AutonomyPolicy;
  /**
   * How the policy was arrived at. The caller MUST be able to tell these
   * apart: `unconfigured` is a normal tenant, `unreadable` is a tenant who
   * configured something we could not parse, and both currently deny — but
   * only one of them is fine.
   */
  readonly origin: "configured" | "unconfigured" | "unreadable";
};

/**
 * Resolve the effective autonomy policy, falling back to
 * {@link DENY_ALL_AUTONOMY} on every failure.
 *
 * Never throws and never widens. A gateway that is unreachable, a row that is
 * missing, and a row that names a threshold we will not honour all produce
 * "nothing auto-executes" — they simply produce different `origin` values, so
 * the audit trail can say which happened.
 */
export async function resolveAutonomyPolicy(
  operations: OperationGateway,
  request: AutonomyPolicyRequest,
): Promise<ResolvedAutonomyPolicy> {
  const scope = request.scope ?? AUTONOMY_POLICY_SCOPE;
  const payload = await operations.getEffectiveTuning({
    tenant: request.tenant,
    vertical: request.vertical,
    moduleKey: request.moduleKey,
    scope,
  });

  if (!payload) {
    return { policy: DENY_ALL_AUTONOMY, origin: "unconfigured" };
  }

  // The SoR answers either a merged config object or a row wrapping one in
  // `config` — the same two shapes `runtime.ts#unwrapTuning` handles.
  const config =
    payload.config && typeof payload.config === "object" && !Array.isArray(payload.config)
      ? (payload.config as Record<string, unknown>)
      : payload;

  const source = `gateway:customizations/${request.vertical}/${request.moduleKey}/${scope}`;
  const policy = parseAutonomyPolicy(withRowProvenance(config, payload), source);
  if (!policy) {
    return { policy: DENY_ALL_AUTONOMY, origin: "unreadable" };
  }
  return { policy, origin: "configured" };
}

/**
 * Carry the ROW's provenance (version/author/timestamp) onto the config object
 * before parsing, so a policy stored as a bare `{autonomy: {...}}` still
 * reports which revision was in force. The config's own values win — a policy
 * that states its own provenance is more specific than the row's.
 */
function withRowProvenance(
  config: Record<string, unknown>,
  row: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(typeof row.version === "string" || typeof row.version === "number"
      ? { version: String(row.version) }
      : {}),
    ...(typeof row.updated_at === "string" ? { updated_at: row.updated_at } : {}),
    ...(typeof row.updated_by === "string" ? { updated_by: row.updated_by } : {}),
    ...config,
  };
}
