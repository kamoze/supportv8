/**
 * Marketplace enablement and subscription verification for Declarative Scenarios.
 *
 * Enforces that a scenario cannot be enabled or executed unless the tenant holds
 * an active subscription / hire for the required AI employee role.
 */

import type { DeclarativeScenario } from "./schema";

export class EmployeeNotSubscribedError extends Error {
  constructor(
    public readonly scenarioId: string,
    public readonly requiredRole: string,
    public readonly tenantDomain: string,
  ) {
    super(
      `Scenario '${scenarioId}' cannot be enabled: required employee role '${requiredRole}' is not subscribed for tenant '${tenantDomain}'. Please hire and subscribe '${requiredRole}' in Workforce Marketplace first.`,
    );
    this.name = "EmployeeNotSubscribedError";
  }
}

export type ScenarioEnablementCheck = {
  canEnable: boolean;
  scenarioId: string;
  requiredRole: string;
  tenantDomain: string;
  error?: string;
};

/**
 * Normalizes an employee role string for subscription matching.
 * E.g. "Barnaby (Inventory Lead)" -> ["barnaby", "inventory lead", "inventory_lead"]
 */
export function normalizeRoleKeys(role: string): string[] {
  const clean = role.toLowerCase().trim();
  const withoutParens = clean.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const slug = withoutParens.replace(/[\s-]+/g, "_");
  const words = clean.split(/[\s()_-]+/).filter(Boolean);

  const keys = new Set<string>([clean, withoutParens, slug, ...words]);
  return Array.from(keys);
}

/**
 * Checks whether a tenant's active subscriptions satisfy the scenario's required role.
 */
export function isEmployeeSubscribed(
  requiredRole: string,
  subscribedRoles: readonly string[],
): boolean {
  if (subscribedRoles.length === 0) return false;
  const targetKeys = normalizeRoleKeys(requiredRole);

  for (const sub of subscribedRoles) {
    const subKeys = normalizeRoleKeys(sub);
    const hasMatch = targetKeys.some((k) => subKeys.includes(k));
    if (hasMatch) return true;
  }

  return false;
}

/**
 * Verifies if a scenario can be enabled for a tenant based on active employee subscriptions.
 */
export function verifyScenarioEnablement(
  scenario: DeclarativeScenario,
  tenantDomain: string,
  subscribedEmployeeRoles: readonly string[],
): ScenarioEnablementCheck {
  const isSubscribed = isEmployeeSubscribed(scenario.requiredRole, subscribedEmployeeRoles);

  if (!isSubscribed) {
    const error = `Scenario '${scenario.id}' cannot be enabled: required employee role '${scenario.requiredRole}' is not subscribed for tenant '${tenantDomain}'. Please hire and subscribe '${scenario.requiredRole}' in Workforce Marketplace first.`;
    return {
      canEnable: false,
      scenarioId: scenario.id,
      requiredRole: scenario.requiredRole,
      tenantDomain,
      error,
    };
  }

  return {
    canEnable: true,
    scenarioId: scenario.id,
    requiredRole: scenario.requiredRole,
    tenantDomain,
  };
}

/**
 * Asserts that a scenario can be enabled. Throws EmployeeNotSubscribedError if required role is missing.
 */
export function assertScenarioEnablement(
  scenario: DeclarativeScenario,
  tenantDomain: string,
  subscribedEmployeeRoles: readonly string[],
): void {
  const check = verifyScenarioEnablement(scenario, tenantDomain, subscribedEmployeeRoles);
  if (!check.canEnable) {
    throw new EmployeeNotSubscribedError(scenario.id, scenario.requiredRole, tenantDomain);
  }
}
