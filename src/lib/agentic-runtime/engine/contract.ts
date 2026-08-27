/**
 * THE ARCHITECTURAL SPINE OF THE KIT.
 *
 * Every decision in this file was paid for by an audit of the existing
 * estate (2026-07-31). The rationale is recorded inline because each rule
 * exists to prevent a specific failure that already happened somewhere.
 *
 * ── The rule that matters most ────────────────────────────────────────────
 *
 * AN ENGINE CANNOT MUTATE. It returns PROPOSALS. The runtime decides whether
 * a proposal may execute (autonomy: grants x operation risk x pre-approval)
 * and, if so, dispatches it through the Operation Gateway.
 *
 * This is structural, not stylistic. In the audited estate, agent engines ran
 * in-process inside their vertical's server actions with direct, unrestricted
 * Prisma access. They were "safe" only because the code happened not to write.
 * The permission model (role scopes, hire `grants[]`, grant tokens) was pure
 * decoration: every scope was `:read`, every hire held `grants: []`, and no
 * vertical exposed an endpoint that consumed a grant token. Nothing enforced
 * anything.
 *
 * Retrofitting authorisation onto code that already holds full database access
 * is far harder than never granting it. So the engine type below simply has no
 * way to express a write. An engine returns data; the runtime performs effects.
 *
 * ── The second rule: one metered model call ───────────────────────────────
 *
 * Deterministic TypeScript computes every number. The model is called ONCE and
 * only to narrate figures that already exist. It never sees raw rows and never
 * does arithmetic.
 *
 * This comes from the only three engines in the estate that do real work
 * (orderv8's bookkeeper/inventory/supplier and propv8's rent bookkeeper). It
 * keeps results reproducible, auditable and cheap, and it means a model outage
 * degrades an engine to "correct numbers, no prose" rather than to nothing.
 *
 * ── The third rule: the call is metered ───────────────────────────────────
 *
 * Model calls go through the Forge gateway carrying `instanceId`, so spend
 * meters against the hire and appears in burn-by-hire. Six verticals were found
 * calling OpenAI/Anthropic directly on a shared key — unmetered, unpooled,
 * untraced. The runtime owns the model call so a vertical cannot opt out of
 * metering by accident.
 */

import type { TenantRef } from "../tenant/identity";

/**
 * A proposed change to the world. Engines return these; they never apply them.
 *
 * `operationId` refers to an operation in the registry (see ../operations).
 * The registry — not this proposal — declares the operation's risk and input
 * schema, so an engine cannot self-describe its way past a policy gate by
 * claiming its own mutation is low risk.
 */
export type OperationProposal = {
  /** Registry operation id, e.g. "billing.late_penalty.apply". */
  readonly operationId: string;
  /**
   * Operation input. Validated against the registry's schema for
   * `operationId` before dispatch — never trusted as shaped.
   */
  readonly input: Readonly<Record<string, unknown>>;
  /**
   * Why the engine is proposing this, in plain language, for the human who
   * may have to approve it. Required: an approval UI that cannot say why is
   * an approval UI nobody should trust.
   */
  readonly reason: string;
  /**
   * Optional stable key for idempotency across re-runs. Two runs that reach
   * the same conclusion about the same subject should produce the same key,
   * so a retried run does not double-apply.
   */
  readonly idempotencyKey?: string;
};

/**
 * What an engine returns. ONE definition — the audited estate had four
 * copies, two of which disagreed on whether `recommendation` was optional,
 * because each repo redeclared it locally instead of importing it.
 *
 * `recommendation` is optional: an engine that computed figures but whose
 * narrating model call failed still returns a valid, useful result.
 */
export type AgentResolution = {
  /** Did the engine complete its work? False on refusal (see below). */
  readonly executed: boolean;
  /** The narrated summary, when a model call succeeded. */
  readonly recommendation?: string;
  /** Machine-readable record of what happened, for audit and UI. */
  readonly actionsTaken: readonly string[];
  /** Changes the engine believes should happen. Applied by the runtime, not here. */
  readonly proposals?: readonly OperationProposal[];
};

/**
 * Why an engine declined to run. Every one of these is a FAIL-CLOSED path:
 * the engine returns `executed: false` and records no outcome, rather than
 * proceeding on a weaker footing.
 */
export type RefusalReason =
  /** The hire could not be found, or belongs to another tenant. */
  | "hire_not_found"
  /** The hire's budget/allowance is exhausted. */
  | "budget_exhausted"
  /** Required configuration is absent. Absence must never mean "allow". */
  | "not_configured";

/**
 * The context the runtime hands an engine. Deliberately gives NO database
 * handle and NO gateway client — the engine receives already-fetched,
 * already-scoped data via its own figures function, and returns proposals.
 *
 * If you find yourself wanting to add a Prisma client here, that is the
 * failure this design exists to prevent.
 */
export type EngineContext = {
  readonly tenant: TenantRef;
  readonly instanceId: string;
  /** Per-tenant tuning, resolved from the customization system-of-record. */
  readonly tuning: Readonly<Record<string, unknown>>;
  /**
   * Narrate already-computed figures. The ONLY model access an engine has.
   * Returns null when the model is unavailable or the budget is exhausted —
   * the engine must still return its figures.
   */
  readonly narrate: (prompt: string, maxTokens?: number) => Promise<string | null>;
};

/**
 * An engine: pure-ish work over a tenant's data, returning a resolution.
 *
 * The deterministic half should be exported separately by each engine so it
 * can be reused (e.g. to seed chat context) without spending a model call or
 * recording an outcome — a pattern proven in orderv8.
 */
export type Engine = (ctx: EngineContext) => Promise<AgentResolution>;

/** Construct a refusal. Kept as a helper so every engine refuses identically. */
export function refuse(reason: RefusalReason, detail?: string): AgentResolution {
  // The spread — rather than `recommendation: detail` — is what makes this
  // compatible with `exactOptionalPropertyTypes`. Assigning a possibly-
  // undefined value to an optional field means "present, but undefined",
  // which is a different thing from absent, and the distinction matters for a
  // field a UI branches on. Omit it instead.
  return {
    executed: false,
    ...(detail ? { recommendation: detail } : {}),
    actionsTaken: [`REFUSED:${reason}`],
  };
}
