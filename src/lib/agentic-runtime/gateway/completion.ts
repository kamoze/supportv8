/**
 * Pure helpers for reading a Forge-gateway completion response.
 *
 * Lifted unchanged from `orderv8/src/workforce-kit/completion.ts` (which was
 * itself extracted from orderv8's Bookkeeper engine) — no tenant, vertical or
 * Prisma dependency, so every engine and the runtime read a completion the
 * same way. Reimplementing these per vertical is how "is the budget
 * exhausted?" ends up answered three different ways.
 */

/**
 * Does this response report an exhausted/paused budget rather than a real
 * completion? The gateway signals this several ways depending on where the
 * stop happened, so all of them are checked. Any caller metering a completion
 * on a hire must check this BEFORE treating the response as a reply — a
 * budget notice parsed as prose is a hire that appears to work while spending
 * nothing and producing nonsense.
 */
export function isBudgetExhausted(completion: Record<string, unknown>): boolean {
  if (completion.paused === true) return true;
  const state =
    readStringPath(completion, ["budgetState", "state"]) ??
    readStringPath(completion, ["budget", "state"]);
  if (state && /exhaust|paused/i.test(state)) return true;
  const error = completion.error;
  if (typeof error === "string" && /budget|exhaust|insufficient/i.test(error)) return true;
  return false;
}

/** Pull the model's reply text out of a completion response. */
export function extractNarrative(completion: Record<string, unknown>): string {
  const text = completion.text;
  if (typeof text === "string" && text.trim()) return text;
  const content =
    readStringPath(completion, ["response", "content"]) ?? readStringPath(completion, ["content"]);
  if (content) return content;
  return "Task complete.";
}

/** Credits the gateway says this call burned, for the outcome record. 0 when unstated. */
export function extractCreditsUsed(completion: Record<string, unknown>): number {
  if (typeof completion.creditsUsed === "number" && Number.isFinite(completion.creditsUsed)) {
    return completion.creditsUsed;
  }
  const usage = completion.usage as Record<string, unknown> | undefined;
  const usageCredits = usage?.creditsUsed ?? usage?.totalCredits;
  if (typeof usageCredits === "number" && Number.isFinite(usageCredits)) return usageCredits;
  return 0;
}

function readStringPath(
  record: Record<string, unknown> | null | undefined,
  path: string[],
): string | null {
  const value = readPath(record, path);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readPath(record: Record<string, unknown> | null | undefined, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
