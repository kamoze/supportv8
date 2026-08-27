/**
 * The operation registry: the typed contract for every mutation an agent may
 * propose.
 *
 * ── Why a registry and not hand-registered routes ─────────────────────────
 *
 * The Operation Gateway today is a closed list of 28 literal route
 * registrations in Go. estatev8 maps 27 operation ids to it; exactly TWO
 * exist server-side. The other 25 — every `billing.*`, `notification.*`,
 * `inspection.*` — have no handler anywhere in the estate. Its agents defer
 * mutations to operations that do not exist, and nothing notices, because
 * nothing checks a declared id against a registered one.
 *
 * A registry makes that mismatch impossible to ship: an operation that is not
 * registered cannot be proposed, and one that is registered has exactly one
 * declared risk, scope and input schema.
 *
 * ── Why the registry owns risk, not the caller ────────────────────────────
 *
 * Risk is declared here, once, by the platform. An engine proposing a mutation
 * cannot state its own risk level — otherwise "may I do this unattended?"
 * would be answered by the party that wants the answer to be yes.
 *
 * ── Why this replaces agenticos/operations.json ───────────────────────────
 *
 * That file was the right idea, hand-maintained. In estatev8 it declared 23
 * operations while the code hardcoded 27, and only 5 intersected — an 80%
 * drift nobody noticed in 75 days, because a JSON file beside the code is not
 * a contract, it is a comment. The registry is code, so drift is a type error;
 * the manifest becomes a generated OUTPUT of it.
 */

/**
 * BLAST RADIUS — how much a mistake costs.
 *
 * ── Why exactly these five values ─────────────────────────────────────────
 *
 * Because the Go Operation Gateway already declares them, and the gateway is
 * the server that actually enforces dispatch. From
 * `servicev8/services/gateway/registry.go`:
 *
 *     RiskRead     side-effect-free read
 *     RiskLow      mutates tenant state that is trivially reversible
 *     RiskMedium   mutates tenant state with a defined compensation
 *     RiskHigh     mutates entitlement/lifecycle state, or starts workflows
 *                  that are expensive to unwind
 *     RiskCritical moves money or grants spendable balance
 *
 * This kit previously declared a DIFFERENT three-value type here —
 * `safe_execute | approval_required | never_autonomous` — for the same
 * concept. That was the mistake, and it is precisely the mistake this repo
 * exists to stop: two vocabularies for one concept is how the audited estate
 * ended up with four incompatible `AgentResolution` copies and three autonomy
 * vocabularies. A vertical reading `medium` off `GET /api/operations` and
 * writing `approval_required` into its registry is a translation layer, and a
 * translation layer between a client and the server that enforces it drifts.
 *
 * So: blast radius is the GATEWAY's, and the kit adopts its exact spelling.
 * A registry entry here can now be diffed literally against the gateway's
 * introspection endpoint.
 *
 * ── What blast radius is NOT ──────────────────────────────────────────────
 *
 * It is not an autonomy decision. "May this run unattended?" is a per-tenant,
 * per-hire POLICY over this scale — see `../autonomy/policy.ts`. The old
 * `safe_execute` / `approval_required` / `never_autonomous` values answered
 * that question inside the risk type, which meant the platform's objective
 * classification and a tenant's configurable appetite were the same field and
 * neither could move without the other.
 */
export type OperationRisk =
  /** Side-effect-free read. */
  | "read"
  /** Mutates tenant state that is trivially reversible. */
  | "low"
  /** Mutates tenant state with a defined compensation. */
  | "medium"
  /** Mutates entitlement/lifecycle state, or starts work that is expensive to unwind. */
  | "high"
  /**
   * Moves money or grants spendable balance.
   *
   * NOTE for anyone reading the autonomy layer: `critical` is the class that
   * inherits the old `never_autonomous` rule. No tenant threshold and no
   * standing pre-approval can auto-execute one. See `../autonomy/evaluate.ts`.
   */
  | "critical";

/**
 * Every blast-radius value, in ascending order of cost. Exported so a caller
 * (an approval UI, a policy editor) can render the scale without hardcoding
 * it, and so `../autonomy/policy.ts` has ONE ordering to compare against.
 */
export const OPERATION_RISKS: readonly OperationRisk[] = Object.freeze([
  "read",
  "low",
  "medium",
  "high",
  "critical",
] as const);

/**
 * Is this an OperationRisk? Used wherever a risk arrives as data (a registry
 * built from JSON, a gateway introspection response) rather than as a literal.
 *
 * Fail-closed by construction: an unrecognised value is `false`, and every
 * caller treats `false` as "deny", never as "assume low".
 */
export function isOperationRisk(value: unknown): value is OperationRisk {
  return typeof value === "string" && (OPERATION_RISKS as readonly string[]).includes(value);
}

/** A validator for an operation's input. Returns an error string, or null when valid. */
export type InputValidator = (input: Readonly<Record<string, unknown>>) => string | null;

export type OperationDefinition = {
  /** Stable dotted id, e.g. "rent.reminder.send". Also the gateway route key. */
  readonly id: string;
  /** Human-readable, shown in approval UIs. */
  readonly summary: string;
  /** Which vertical owns it. */
  readonly vertical: string;
  readonly risk: OperationRisk;
  /** Scope a hire must hold to propose it, e.g. "rent:write". */
  readonly requiredScope: string;
  /**
   * Validates the proposal's input before dispatch. Required — an operation
   * without validation is an untyped payload, which the estate's own vertical
   * manifests already list as an excluded unsafe option.
   */
  readonly validate: InputValidator;
  /** Audit event emitted on execution, e.g. "rent.reminder.sent". */
  readonly auditEvent: string;
};

export class DuplicateOperation extends Error {}
export class UnknownOperation extends Error {}

/**
 * An immutable registry, built once at startup.
 *
 * Construction validates the whole set, so a malformed operation fails at boot
 * rather than at the moment an agent first proposes it — which would be during
 * a customer's workflow, at the worst possible time.
 */
export class OperationRegistry {
  private readonly byId: ReadonlyMap<string, OperationDefinition>;

  constructor(definitions: readonly OperationDefinition[]) {
    const map = new Map<string, OperationDefinition>();
    for (const def of definitions) {
      const id = def.id?.trim();
      if (!id) throw new DuplicateOperation("operation with empty id");
      if (map.has(id)) throw new DuplicateOperation(`duplicate operation id: ${id}`);
      if (!def.requiredScope?.trim()) {
        // An operation with no scope would be proposable by any hire that
        // holds any grant — silently the widest permission in the system.
        throw new DuplicateOperation(`operation ${id} declares no requiredScope`);
      }
      if (typeof def.validate !== "function") {
        throw new DuplicateOperation(`operation ${id} declares no input validator`);
      }
      if (!isOperationRisk(def.risk)) {
        // Mirrors the Go registry's own `validRisks` check. An unclassified
        // operation would reach the autonomy layer with a risk the policy
        // cannot rank; that denies at dispatch time — during a customer's
        // workflow — when it should stop the process at boot.
        throw new DuplicateOperation(
          `operation ${id} declares risk ${JSON.stringify(def.risk)}, which is not a known blast-radius class`,
        );
      }
      map.set(id, def);
    }
    this.byId = map;
  }

  /** Look up an operation. Throws rather than returning undefined: an unknown
   *  operation must never fall through to a permissive default. */
  get(id: string): OperationDefinition {
    const def = this.byId.get(id);
    if (!def) throw new UnknownOperation(`operation not registered: ${id}`);
    return def;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  list(): readonly OperationDefinition[] {
    return [...this.byId.values()];
  }
}
