/**
 * Growth Loop Configuration.
 *
 * Reads environment variables for both halves of the closed-loop growth
 * attribution engine:
 * 1. Inbound lead intake from GrowthV8 (`inboundToken`).
 * 2. Outbound conversion outcome emissions to GrowthV8 (`growthv8Url` + `outcomeToken`).
 *
 * All values default to empty string, and each half soft-skips when unconfigured
 * to guarantee zero-crash execution.
 */

export interface GrowthLoopConfig {
  /** Inbound bearer token for verifying leads posted from GrowthV8. */
  inboundToken: string;
  /** In-cluster base URL of GrowthV8 (no trailing slash). */
  growthv8Url: string;
  /** Outbound API token minted in GrowthV8 with scope `growth:write`. */
  outcomeToken: string;
}

export function growthConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
  options: { verticalPrefix?: string } = {}
): GrowthLoopConfig {
  const prefix = options.verticalPrefix ? options.verticalPrefix.toUpperCase().replace(/-/g, "_") : "SERVICEV8";

  // Inbound token: checks vertical-specific env then generic fallback
  const inboundToken =
    env[`${prefix}_GROWTH_INBOUND_TOKEN`] ||
    env.ORDER_V8_GROWTH_INBOUND_TOKEN ||
    env.SERVICEV8_GROWTH_INBOUND_TOKEN ||
    env.GROWTH_INBOUND_TOKEN ||
    "";

  // Outbound URL: strips trailing slash if provided
  const rawUrl = env.GROWTHV8_URL || env.GROWTH_API_URL || "";
  const growthv8Url = rawUrl.replace(/\/+$/, "");

  // Outbound token
  const outcomeToken =
    env[`${prefix}_GROWTH_OUTCOME_TOKEN`] ||
    env.GROWTHV8_OUTCOME_TOKEN ||
    env.GROWTH_OUTCOME_TOKEN ||
    "";

  return {
    inboundToken,
    growthv8Url,
    outcomeToken,
  };
}
