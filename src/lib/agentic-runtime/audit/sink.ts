/**
 * Where audit records go.
 *
 * The kit does not own a database, so it does not own audit STORAGE — a
 * vertical hands the runtime a sink that writes to its own `AgentActivity`
 * table. What the kit owns is the guarantee that a record is PRODUCED for
 * every decision, in the governance doc's shape.
 *
 * ── Why a sink may never break a run ──────────────────────────────────────
 *
 * `emit` failures are swallowed (and reported to `onSinkError`). This is
 * deliberate and is the one place the kit is NOT fail-closed, because the
 * alternative is worse: an audit table that is briefly unavailable would
 * otherwise abort in-flight agent runs, some of which have already dispatched
 * an operation. That converts a logging outage into a half-applied mutation.
 *
 * The runtime therefore also returns every record it emitted in its result,
 * so a caller that needs a durable guarantee can re-persist them itself.
 */

import type { AgentActivityRecord } from "./record";

export type AuditSink = {
  emit(record: AgentActivityRecord): void | Promise<void>;
};

/** Test/dev sink that keeps records in memory. */
export class InMemoryAuditSink implements AuditSink {
  readonly records: AgentActivityRecord[] = [];

  emit(record: AgentActivityRecord): void {
    this.records.push(record);
  }

  /** Records whose status matches, e.g. `withStatus("REJECTED")`. */
  withStatus(status: AgentActivityRecord["status"]): AgentActivityRecord[] {
    return this.records.filter((record) => record.status === status);
  }

  clear(): void {
    this.records.length = 0;
  }
}

/** Fallback sink. Structured, single-line, no secrets (metadata is pre-redacted). */
export const consoleAuditSink: AuditSink = {
  emit(record: AgentActivityRecord): void {
    console.info("[agentic-audit]", JSON.stringify(record));
  },
};

/**
 * Emit without letting a sink failure escape. Returns whether it landed, so
 * the caller can count losses rather than assume success.
 */
export async function safeEmit(
  sink: AuditSink,
  record: AgentActivityRecord,
  onSinkError?: (error: unknown, record: AgentActivityRecord) => void,
): Promise<boolean> {
  try {
    await sink.emit(record);
    return true;
  } catch (error) {
    if (onSinkError) {
      try {
        onSinkError(error, record);
      } catch {
        // An error handler that itself throws must not take the run down.
      }
    } else {
      console.error("[agentic-audit] sink failed", error);
    }
    return false;
  }
}
