// Temporal infrastructure configuration for supportV8 (Reference: GrowthV8 infra arch)
// When TEMPORAL_ADDRESS is unset (local dev, CI, or before worker deploy),
// workflows degrade gracefully to synchronous inline execution with zero external dependency.

export const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || "";
export const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || "default";
export const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || "supportv8-spine";

// Live environment check so unit tests and local dev run predictably
export function isTemporalEnabled(): boolean {
  return (process.env.TEMPORAL_ADDRESS || "") !== "";
}
