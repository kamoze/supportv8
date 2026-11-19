import type { OperatingMode, SupportPolicy } from "@/lib/types";

/** The modes the policy engine stores (supportv8.tenant_policies.mode). */
export type TenantOperatingMode = "observe" | "copilot" | "autonomous";
const MODES: readonly string[] = ["observe", "copilot", "autonomous"];

/**
 * The tenant's stored AI operating mode, or null when the tenant has not set
 * one (or it could not be read). Never invents a mode: the UI shows "Not set".
 */
export function tenantOperatingMode(
  policy: Pick<SupportPolicy, "operatingMode" | "operatingModeConfigured"> | null | undefined,
): TenantOperatingMode | null {
  if (!policy || policy.operatingModeConfigured === false) return null;
  return MODES.includes(policy.operatingMode) ? (policy.operatingMode as TenantOperatingMode) : null;
}

export function operatingModeLabel(mode: OperatingMode | null): string {
  if (!mode) return "Not set";
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

/** Only CX leads and administrators may change the tenant policy (the API enforces it too). */
export function canChangeOperatingMode(role: string | null | undefined): boolean {
  return role === "cx_lead" || role === "superadmin";
}
