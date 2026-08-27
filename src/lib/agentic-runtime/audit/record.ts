/**
 * The audit record every agent action produces.
 *
 * Shape and status vocabulary come from the governance doc
 * (`servicev8/docs/agenticos/audit-and-autonomy-governance.md`, "Agent
 * activity shape" and "Status language"), which states the rule this module
 * exists to make mechanical:
 *
 *   > Every agent action must produce an audit record. This includes: user-
 *   > requested command, autonomous workflow step, failed delivery, approval
 *   > request, approval decision, rejected action...
 *
 * The failure this prevents is specific and common: audit that only fires on
 * SUCCESS. A trail that records what the agent did, but not what it was
 * stopped from doing, cannot answer the only question anyone asks after an
 * incident — "did it try?". Denials and approval requests are therefore
 * first-class records here, not log lines.
 *
 * Field names are snake_case on purpose: they match the governance doc and
 * the `AgentActivity` persistence shape verticals will store them in, so a
 * vertical can insert a record without a rename layer that could drift.
 */

/**
 * Governance doc "Status language". Kept verbatim — the doc explicitly says
 * the UI may group these into simpler states but "audit should retain the
 * precise status", so this type must not be narrowed for presentation.
 */
export type AuditStatus =
  | "INFO"
  | "DRAFTED"
  | "NEEDS_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED"
  | "RETRYING";

/** Who acted. An autonomous step and a human-requested one must be tellable apart. */
export type AuditActorType = "user" | "agent" | "system";

/** A reference to the thing an action touched, when one is known. */
export type AffectedEntity = {
  readonly type: string;
  readonly id: string;
};

export type AgentActivityRecord = {
  readonly tenant_id: string;
  readonly vertical_id: string;
  /** The hired instance (`role × vertical × tenant`) that acted. */
  readonly agent_id: string;
  readonly actor_type: AuditActorType;
  /** The operation id for a proposal record, or the runtime step for a run record. */
  readonly tool: string;
  /** What was asked for — the command that started this run. */
  readonly command: string;
  readonly status: AuditStatus;
  /** One line a human can read in a feed without opening the detail. */
  readonly title: string;
  /** The reason, in full. For a denial this is the gate's own wording. */
  readonly detail: string;
  readonly affected_entity?: AffectedEntity;
  /** Always passed through `redactMetadata` before it lands here. */
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly created_at: string;
  /** Approval relationship, when this record is part of an approval flow. */
  readonly approval?: {
    readonly required: boolean;
    /** Set when a standing pre-approval, not a fresh human decision, allowed this. */
    readonly preApproved?: boolean;
  };
  /** Execution relationship, when this record describes a dispatch. */
  readonly execution?: {
    readonly dispatched: boolean;
    readonly operationId: string;
    readonly idempotencyKey?: string;
    readonly executionId?: string;
  };
};

/**
 * Keys whose VALUES must never be stored. The governance doc: "Metadata must
 * redact secrets, PINs, tokens, access links, and raw sensitive messages.
 * Store presence flags and redacted summaries instead."
 *
 * Matched loosely (substring, case-insensitive) because the estate spells
 * these a dozen ways — `grantToken`, `grant_token`, `GATEWAY_TOKEN`,
 * `apiKey`, `api_key`. An over-broad redaction costs a debugging detail; an
 * under-broad one writes a live credential into an audit table that, by
 * design, is retained and shipped off-box.
 */
const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|passphrase|\bpin\b|api[-_ ]?key|apikey|authorization|auth[-_ ]?header|credential|access[-_ ]?link|magic[-_ ]?link|cookie|session[-_ ]?id|private[-_ ]?key)/i;

/** Long free text is summarised, not stored — "raw sensitive messages" per the doc. */
const MAX_STRING_LENGTH = 512;
const MAX_DEPTH = 6;

/**
 * Redact a metadata object for storage.
 *
 * A sensitive key is replaced with a PRESENCE FLAG (`<key>_present: true`)
 * rather than dropped, because "was a grant token minted for this run?" is a
 * genuine audit question and the answer must not require the value.
 */
export function redactMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
  if (!metadata) return Object.freeze({});
  return redactRecord(metadata, 0);
}

function redactRecord(
  record: Readonly<Record<string, unknown>>,
  depth: number,
): Readonly<Record<string, unknown>> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      // Presence flag only. Note `value != null` — a key present but null is
      // "absent" for the purposes of "did we have a token?".
      output[`${key}_present`] = value !== undefined && value !== null && value !== "";
      continue;
    }
    output[key] = redactValue(value, depth + 1);
  }
  return Object.freeze(output);
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[truncated:depth]";
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated:${value.length}]`
      : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return redactRecord(value as Record<string, unknown>, depth);
  }
  // Primitives (number/boolean/null/undefined) pass through unchanged.
  return value;
}

export type NewAuditRecord = Omit<AgentActivityRecord, "created_at" | "metadata"> & {
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly created_at?: string;
};

/** Build a record with its metadata redacted and its timestamp stamped. */
export function buildAuditRecord(input: NewAuditRecord): AgentActivityRecord {
  const { metadata, created_at, ...rest } = input;
  return Object.freeze({
    ...rest,
    metadata: redactMetadata(metadata),
    created_at: created_at ?? new Date().toISOString(),
  });
}
