/**
 * Autonomy: may this proposal execute without a human?
 *
 * The decision is the intersection of four things, per the product decision of
 * 2026-07-31 ("a blend based on the agent's permissions — if pre-approved"),
 * the governance doc's requirement that autonomy be "visible, bounded,
 * reversible, and auditable", and the master PRD's requirement that "autonomy
 * defaults are tenant-configurable and must be auditable":
 *
 *   1. the HIRE's grants   — what this employee may touch at all
 *   2. the OPERATION's risk — its BLAST RADIUS, declared by the registry in the
 *                             Operation Gateway's own vocabulary, never by the
 *                             caller
 *   3. the TENANT's policy  — a threshold on that same scale, stored per
 *                             tenant/hire, saying how much blast radius may
 *                             land unattended
 *   4. PRE-APPROVAL state   — a human's standing decision for one operation
 *
 * ── What changed, and why ─────────────────────────────────────────────────
 *
 * This function used to `switch` on a kit-local risk enum whose values were
 * autonomy verdicts (`safe_execute` / `approval_required` / `never_autonomous`).
 * That collapsed two different things into one field:
 *
 *   · blast radius        objective, platform-owned, identical for every tenant
 *   · autonomy appetite   subjective, tenant-owned, configurable, auditable
 *
 * With them collapsed, a tenant could not raise or lower its own bar without a
 * platform code change, and the kit carried a second spelling of a scale the
 * Go gateway already publishes. Now (3) is data — see `./policy.ts` — and this
 * function is a comparison, not an opinion.
 *
 * ── Every safety property from before, and where it now lives ─────────────
 *
 *   fail closed everywhere         → every branch below returns denied or
 *                                    needs_approval; `execute` is reached only
 *                                    by two explicit, positive conditions
 *   scope checked BEFORE risk      → gate 1, unchanged
 *   unknown/unparseable risk denies→ gate 2, `rankRisk` returns null
 *   `never_autonomous` survives    → gate 3. The rule was "some actions always
 *                                    need a human, and pre-approval must not
 *                                    unlock them". It is now attached to the
 *                                    gateway's own top class, `critical`
 *                                    ("moves money or grants spendable
 *                                    balance") — which is exactly what the old
 *                                    comment named ("legal escalation,
 *                                    irreversible financial penalties"). It is
 *                                    enforced twice: `AutonomyThreshold` has no
 *                                    `critical` member, so no policy can be
 *                                    written that permits one; and gate 3 runs
 *                                    BEFORE the threshold and pre-approval
 *                                    gates, so a policy that arrives as JSON
 *                                    claiming otherwise cannot reach them.
 */

import type { OperationProposal } from "../engine/contract";
import type { OperationRisk } from "../operations/registry";
import { rankRisk, rankThreshold, type AutonomyPolicy } from "./policy";

/**
 * Why a proposal was allowed to execute. Recorded on the audit record, because
 * "the tenant's dial permitted this" and "a human standing-approved this
 * specific operation" are different answers to "who said it could?".
 */
export type AutonomyBasis = "threshold" | "pre_approval";

/** What the runtime decided to do with a proposal, and why. */
export type AutonomyDecision =
  | { readonly outcome: "execute"; readonly reason: string; readonly basis: AutonomyBasis }
  | { readonly outcome: "needs_approval"; readonly reason: string }
  | { readonly outcome: "denied"; readonly reason: string };

export type AutonomyInput = {
  /** Scopes granted to this hire. Empty means the employee may do nothing. */
  readonly grants: readonly string[];
  /**
   * Blast radius the REGISTRY declares for this operation, in the Operation
   * Gateway's vocabulary. Never taken from the proposal.
   */
  readonly risk: OperationRisk;
  /** Scope the registry says this operation requires. */
  readonly requiredScope: string;
  /**
   * The tenant's (or this hire's) autonomy threshold. Fail closed: callers
   * that could not read one must pass `DENY_ALL_AUTONOMY`, not omit it.
   */
  readonly policy: AutonomyPolicy;
  /**
   * Operation ids a human has pre-approved for this hire — a standing
   * decision, e.g. "this bookkeeper may raise arrears tickets unattended".
   */
  readonly preApproved: readonly string[];
  readonly proposal: OperationProposal;
};

/**
 * Evaluate a proposal. FAIL-CLOSED at every branch: anything unrecognised,
 * missing or ambiguous denies or escalates — it never executes.
 *
 * Order matters and is asserted by the tests:
 *
 *   1. scope       — "this employee may not touch tickets at all" is a stronger
 *                    and simpler statement than "this ticket operation is
 *                    risky", and a denial should name the strongest true reason
 *   2. risk known  — an unrankable risk is not a low one
 *   3. critical    — before the dial and before pre-approval, so neither can
 *                    reach it
 *   4. threshold   — the tenant's configured appetite
 *   5. pre-approval— a human's standing decision, which may lift a single
 *                    operation above the dial but never above gate 3
 */
export function evaluateAutonomy(input: AutonomyInput): AutonomyDecision {
  const { grants, risk, requiredScope, policy, preApproved, proposal } = input;

  // ── 1. Does the hire hold the scope at all? ───────────────────────────────
  //
  // An employee with no grants can do nothing. That is the correct default and
  // the current live state of every hire in the estate: `grants: []`. The kit
  // must make an ungranted employee harmless, not accidentally omnipotent.
  //
  // This is also, today, the ONLY place `ticket:write` is actually enforced:
  // the Go gateway's ScopeMiddleware defaults to `audit` mode (compute the
  // decision, log it, allow the request) because no credential in production
  // carries operation scopes yet. So this gate is not belt-and-braces — it is
  // the belt.
  if (!grants.includes(requiredScope)) {
    return {
      outcome: "denied",
      reason: `hire lacks required scope "${requiredScope}" for ${proposal.operationId}`,
    };
  }

  // ── 2. Is the blast radius one we can rank? ───────────────────────────────
  //
  // An unrecognised risk means the registry and this layer disagree about the
  // vocabulary — the exact drift the shared spelling exists to prevent. Deny:
  // an unknown risk is not a low one.
  const riskRank = rankRisk(risk);
  if (riskRank === null) {
    return {
      outcome: "denied",
      reason: `unknown blast-radius classification ${JSON.stringify(risk)} for ${proposal.operationId}`,
    };
  }

  // ── 3. `critical` always needs a human ────────────────────────────────────
  //
  // This is the old `never_autonomous` rule, re-homed onto the gateway's own
  // top class. It runs before the threshold and before the pre-approval list
  // for a reason: a standing approval is precisely the thing people forget
  // they granted, and a policy row is precisely the thing that gets copied
  // between tenants without being re-read.
  if (risk === "critical") {
    return {
      outcome: "needs_approval",
      reason:
        `${proposal.operationId} is classified critical (moves money or grants spendable balance) — ` +
        "no autonomy threshold and no standing pre-approval can execute it unattended",
    };
  }

  // ── 4. Is it within the tenant's configured appetite? ─────────────────────
  const threshold = rankThreshold(policy.autoExecuteMaxRisk);
  if (riskRank <= threshold) {
    return {
      outcome: "execute",
      basis: "threshold",
      reason:
        `${proposal.operationId} is ${risk} risk, at or below this tenant's ` +
        `auto-execute threshold of ${policy.autoExecuteMaxRisk} (${policy.source})`,
    };
  }

  // ── 5. Has a human standing-approved this exact operation? ────────────────
  //
  // The "if pre-approved" half of the decision. It lifts ONE operation id above
  // the dial — it does not raise the dial, and gate 3 has already removed the
  // only class it must never reach.
  if (preApproved.includes(proposal.operationId)) {
    return {
      outcome: "execute",
      basis: "pre_approval",
      reason:
        `${proposal.operationId} is ${risk} risk, above this tenant's threshold of ` +
        `${policy.autoExecuteMaxRisk}, but is pre-approved for this hire`,
    };
  }

  return {
    outcome: "needs_approval",
    reason:
      `${proposal.operationId} is ${risk} risk, above this tenant's auto-execute threshold of ` +
      `${policy.autoExecuteMaxRisk} (${policy.source}), and is not pre-approved for this hire`,
  };
}
