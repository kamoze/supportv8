/**
 * AUTONOMY POLICY — a tenant's appetite, expressed OVER blast radius.
 *
 * ── Why this is a policy and not a fourth enum ────────────────────────────
 *
 * The kit used to answer "may this run unattended?" inside the operation's
 * risk value (`safe_execute | approval_required | never_autonomous`). Two
 * things were wrong with that.
 *
 * First, it was a second vocabulary for a concept the Operation Gateway
 * already owns. The gateway declares `read|low|medium|high|critical` — an
 * objective, platform-owned blast radius — and the kit declared its own
 * three-value scale for the same operations. The audit found three competing
 * autonomy vocabularies and four incompatible `AgentResolution` copies in this
 * estate; every one of them started as a local re-spelling of something a
 * shared layer already named.
 *
 * Second, and worse, it hardcoded the answer. `approval_required` meant "every
 * tenant, everywhere, must approve this" — a platform engineer's opinion
 * compiled into a shared library. The master PRD is explicit that
 *
 *   > autonomy defaults are tenant-configurable and must be auditable
 *
 * and a `switch` statement is neither. A tenant that trusts its bookkeeper to
 * raise maintenance tickets unattended, and one that wants every ticket seen
 * by a human first, are both correct — about the SAME operation with the SAME
 * blast radius.
 *
 * So blast radius stays the platform's (objective, in the registry, mirrored
 * from the gateway) and autonomy becomes DATA: a threshold on that scale,
 * stored per tenant per hire, carrying its own provenance.
 *
 * ── Where a tenant stores one ─────────────────────────────────────────────
 *
 * In the gateway's customization system-of-record — the same store the
 * `getEffectiveTuning` read already reaches, under its own governance scope
 * (`scope: "autonomy:policy"`), NOT under the engine's tuning scope. See
 * `./resolve.ts` for the read, and the comment there for why the separation is
 * load-bearing: the SoR's accept/activate/rollback flow is what makes the
 * threshold auditable and reversible, and keeping it out of `ctx.tuning` is
 * what stops an engine from reading — or a vertical from editing — the gate
 * that governs it.
 */

import { isOperationRisk, type OperationRisk } from "../operations/registry";

/**
 * The highest blast radius a hire may execute WITHOUT a human.
 *
 * Note what is missing: `critical`. That absence is deliberate and it is the
 * type-level survivor of the old `never_autonomous` rule — an operation that
 * moves money or grants spendable balance cannot be auto-executed by setting a
 * dial, because there is no dial position that says so. `evaluateAutonomy`
 * enforces the same thing at runtime for policies that arrive as JSON, where
 * the type is not present to help.
 */
export type AutonomyThreshold = "none" | "read" | "low" | "medium" | "high";

/** Every threshold, ascending. `none` first — the fail-closed end of the scale. */
export const AUTONOMY_THRESHOLDS: readonly AutonomyThreshold[] = Object.freeze([
  "none",
  "read",
  "low",
  "medium",
  "high",
] as const);

/**
 * One tenant's (or one hire's) autonomy configuration.
 *
 * Everything except the threshold exists so a decision made months ago can be
 * explained: "who set this, when, and which revision of the policy was in
 * force when the agent acted?". The runtime copies these fields onto every
 * audit record it writes for an autonomy decision.
 */
export type AutonomyPolicy = {
  /**
   * Risk levels at or below this may auto-execute, given the scope.
   * `none` means propose-only: everything escalates to a human.
   */
  readonly autoExecuteMaxRisk: AutonomyThreshold;
  /**
   * Where this value came from, e.g.
   * `"gateway:customizations/propv8/rent-bookkeeper/autonomy:policy"`, or
   * `"default:deny-all"`. Required — an unattributable autonomy setting is
   * exactly the thing an incident review cannot use.
   */
  readonly source: string;
  /** The customization revision in force, when the SoR reported one. */
  readonly version?: string;
  readonly updatedAt?: string;
  /** The human who last moved the dial, when the SoR reported one. */
  readonly updatedBy?: string;
};

/**
 * The default when no policy is configured, and the value every fail-closed
 * path falls back to. Nothing auto-executes; everything a granted hire
 * proposes becomes an approval request.
 *
 * Absence must never mean allow — an unconfigured tenant is a normal state,
 * and the correct behaviour for one is "propose, don't act".
 */
export const DENY_ALL_AUTONOMY: AutonomyPolicy = Object.freeze({
  autoExecuteMaxRisk: "none",
  source: "default:deny-all",
});

/** Rank of a blast-radius class. Higher is costlier. */
const RISK_RANK: Readonly<Record<OperationRisk, number>> = Object.freeze({
  read: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
});

/**
 * Rank a risk, or `null` when it is not a risk at all.
 *
 * Returning `null` rather than a number is the point: there is no numeric
 * value an unknown risk could take that would be safe to compare, so callers
 * are forced to branch on "unrankable" and deny.
 */
export function rankRisk(risk: unknown): number | null {
  return isOperationRisk(risk) ? RISK_RANK[risk] : null;
}

/**
 * Rank a threshold on the same scale. `none` sits BELOW `read`, so no risk
 * class is ever `<=` it.
 */
export function rankThreshold(threshold: AutonomyThreshold): number {
  if (threshold === "none") return -1;
  return RISK_RANK[threshold];
}

/** Is this a threshold the policy layer will honour? */
export function isAutonomyThreshold(value: unknown): value is AutonomyThreshold {
  return typeof value === "string" && (AUTONOMY_THRESHOLDS as readonly string[]).includes(value);
}

/**
 * Build a policy from whatever the customization system-of-record returned.
 *
 * Returns `null` — never a permissive default — when the payload is missing,
 * malformed, or names a threshold this layer will not honour. `null` is the
 * caller's cue to fall back to {@link DENY_ALL_AUTONOMY} AND to say loudly
 * that it did, because "the tenant configured something we could not read" and
 * "the tenant configured nothing" must not look identical in an audit trail.
 *
 * A payload naming `critical` is rejected rather than clamped. Clamping would
 * silently honour most of a policy whose author plainly misunderstood it, and
 * the one thing they got wrong is the one thing that moves money.
 */
export function parseAutonomyPolicy(payload: unknown, source: string): AutonomyPolicy | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;

  // Accept both the nested shape a customization row uses
  // (`{autonomy: {auto_execute_max_risk: …}}`) and the flat one.
  const autonomy =
    record.autonomy && typeof record.autonomy === "object" && !Array.isArray(record.autonomy)
      ? (record.autonomy as Record<string, unknown>)
      : record;

  const raw = autonomy.auto_execute_max_risk ?? autonomy.autoExecuteMaxRisk;
  if (!isAutonomyThreshold(raw)) return null;

  const trimmedSource = source.trim();
  if (!trimmedSource) return null;

  return Object.freeze({
    autoExecuteMaxRisk: raw,
    source: trimmedSource,
    ...optionalString("version", autonomy.version ?? record.version),
    ...optionalString("updatedAt", autonomy.updated_at ?? record.updated_at),
    ...optionalString("updatedBy", autonomy.updated_by ?? record.updated_by),
  });
}

/**
 * The policy fields an audit record carries. Kept as one function so every
 * record describes a policy identically and a reviewer can grep for one shape.
 */
export function describeAutonomyPolicy(policy: AutonomyPolicy): Readonly<Record<string, unknown>> {
  return Object.freeze({
    autoExecuteMaxRisk: policy.autoExecuteMaxRisk,
    source: policy.source,
    ...(policy.version ? { version: policy.version } : {}),
    ...(policy.updatedAt ? { updatedAt: policy.updatedAt } : {}),
    ...(policy.updatedBy ? { updatedBy: policy.updatedBy } : {}),
  });
}

/**
 * Spread-or-omit, because `exactOptionalPropertyTypes` is on: assigning a
 * possibly-undefined value to an optional field means "present, but
 * undefined", which is a different thing from absent.
 */
function optionalString<K extends string>(key: K, value: unknown): Partial<Record<K, string>> {
  return typeof value === "string" && value.trim() !== ""
    ? ({ [key]: value } as Record<K, string>)
    : {};
}
