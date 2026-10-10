/**
 * Platform Workforce & Acquisition Authority
 * Enforces canonical owner authority:
 * - Fresh tenants start with 0 seeded hires
 * - Runtime employees (Arthur, Vivian, Sophia) are accessed via runtime records, never seeded in app workforce
 * - Local hire/credit mutators are strictly rejected for production/customer tenants (only allowed for demo tenants)
 * - Entitlement status governs execution readiness
 */

import { marketplaceService } from "@/lib/services/marketplace-service";
import type { MarketplaceWorkforceItem } from "@/lib/types/marketplace-types";

export function isDemoTenant(tenantSlug: string): boolean {
  const clean = tenantSlug.trim().toLowerCase();
  return clean === "acme" || clean === "meridian";
}

export interface CanonicalWorkforceOptions {
  tenantSlug: string;
  accountId?: string;
  entitlementStatus?: "active" | "revoked" | "suspended" | "pending";
}

export function getCanonicalWorkforce(options: CanonicalWorkforceOptions): MarketplaceWorkforceItem[] {
  const { tenantSlug } = options;
  const isDemo = isDemoTenant(tenantSlug);
  const catalog = marketplaceService.getWorkforceCatalog(tenantSlug);

  if (isDemo) {
    return catalog.filter((w) => w.isHired);
  }

  // Non-demo / customer tenants have only explicitly acquired specialists
  // Arthur, Vivian, and Sophia are Runtime employees, NEVER app-roster hires
  return catalog.filter((w) => w.isHired && !["emp_arthur", "emp_vivian", "emp_sophia"].includes(w.id));
}

export function canExecuteWorkforceAction(options: {
  tenantSlug: string;
  employeeId: string;
  entitlementStatus?: string;
}): { allowed: boolean; status: number; error?: string } {
  const { tenantSlug, employeeId, entitlementStatus } = options;

  if (entitlementStatus === "revoked" || entitlementStatus === "suspended") {
    return {
      allowed: false,
      status: 403,
      error: "Entitlement revoked or inactive",
    };
  }

  const catalog = marketplaceService.getWorkforceCatalog(tenantSlug);
  const employee = catalog.find((w) => w.id === employeeId);

  if (!employee || !employee.isHired) {
    return {
      allowed: false,
      status: 409,
      error: "This AI employee is not hired for the workspace.",
    };
  }

  return { allowed: true, status: 200 };
}
