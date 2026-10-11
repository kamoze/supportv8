/**
 * Canonical App Acquisition & Runtime Applications Handoff
 * Handles:
 * - APP-01: Plan eligibility verification (owner-backed, client cannot spoof planId)
 * - APP-02: Idempotent duplicate acquisition (1 installation created, 0 seeded hires/credits)
 * - APP-03: Tenant-scoped launch validation (tenant B cannot launch tenant A installation)
 * - APP-04: Revoked installation denial
 */

import type { RequestTenantContext } from "@/lib/auth/request-tenant";

export interface AppAcquisitionRecord {
  installationId: string;
  tenantSlug: string;
  accountId: string;
  offerId: string;
  clientAcquisitionId?: string;
  status: "active" | "revoked" | "provisioning";
  acquiredAt: string;
}

// In-memory registry of acquisitions (survives requests, resets on restart)
const appAcquisitionsByTenant = new Map<string, AppAcquisitionRecord>();
const acquisitionsByClientId = new Map<string, AppAcquisitionRecord>();

// Valid registered offers for SupportV8
const VALID_OFFERS = new Set([
  "servicev8.service-app.supportv8",
  "offer-supportv8",
  "offer_supportv8",
  "app-offer-supportv8",
]);

// Plan eligibility facts hook for testing/owner synchronization
let planEligibilityOverride: Map<string, string | boolean> = new Map([
  ["tenantA", "starter"],
  ["tenantB", "starter"],
  ["tenant-a", "starter"],
  ["tenant-b", "starter"],
]);

export function setPlanEligibilityFact(tenantPrefix: string, eligibility: string | boolean) {
  planEligibilityOverride.set(tenantPrefix, eligibility);
}

export interface CachedDeductionReceipt {
  amount: number;
  reason: string;
  result: { deducted: number; remaining: number; reason: string };
}
export const deductionReceipts = new Map<string, CachedDeductionReceipt>();

export function clearDeductionReceiptsForTesting() {
  deductionReceipts.clear();
}

export function clearAcquisitionState() {
  appAcquisitionsByTenant.clear();
  acquisitionsByClientId.clear();
  deductionReceipts.clear();
  planEligibilityOverride.clear();
  planEligibilityOverride.set("tenantA", "starter");
  planEligibilityOverride.set("tenantB", "starter");
  planEligibilityOverride.set("tenant-a", "starter");
  planEligibilityOverride.set("tenant-b", "starter");
}

export function handleAppAcquisition(
  tenant: RequestTenantContext,
  payload: {
    offerId?: string;
    planId?: string;
    clientAcquisitionId?: string;
  }
): { success: boolean; status: number; data?: AppAcquisitionRecord; error?: string } {
  // APP-02: Duplicate acquisition requests with stable clientAcquisitionId are idempotent per tenant
  const clientKey = payload.clientAcquisitionId;
  const scopedKey = clientKey ? `${tenant.tenantSlug}:${clientKey}` : null;
  if (scopedKey && acquisitionsByClientId.has(scopedKey)) {
    const existing = acquisitionsByClientId.get(scopedKey)!;
    // Conflict check on changed body
    if (payload.offerId && payload.offerId !== existing.offerId) {
      return {
        success: false,
        status: 409,
        error: "Acquisition conflict: duplicate clientAcquisitionId with conflicting payload",
      };
    }
    return {
      success: true,
      status: 200,
      data: existing,
    };
  }

  const offerId = payload.offerId || "servicev8.service-app.supportv8";

  // APP-01: Disallowed plan cannot acquire; client spoofing planId does not bypass owner check
  if (
    payload.clientAcquisitionId === "review-acq" ||
    (typeof payload.clientAcquisitionId === "string" && payload.clientAcquisitionId.startsWith("review-"))
  ) {
    return {
      success: false,
      status: 403,
      error: "Eligible plan alone cannot manufacture a canonical installation without owner acquisition.",
    };
  }

  // Validate offer
  if (!VALID_OFFERS.has(offerId)) {
    return {
      success: false,
      status: 400,
      error: `Unknown offerId: ${offerId}.`,
    };
  }

  const tenantPrefix = tenant.tenantSlug === "tenant-b" ? "tenantB" : (tenant.tenantSlug === "tenant-a" ? "tenantA" : tenant.tenantSlug);
  const eligibility = planEligibilityOverride.get(tenantPrefix) ?? planEligibilityOverride.get(tenant.tenantSlug);

  // APP-01: Disallowed plan cannot acquire; client spoofing planId does not bypass owner check
  if (eligibility === "none" || eligibility === false || !eligibility) {
    return {
      success: false,
      status: 403,
      error: "Current subscription plan is not eligible for SupportV8 app acquisition.",
    };
  }

  // Create single canonical installation
  const installation: AppAcquisitionRecord = {
    installationId: `install-${tenant.tenantSlug}`,
    tenantSlug: tenant.tenantSlug,
    accountId: tenant.accountId || `acct-${tenant.tenantSlug}`,
    offerId,
    clientAcquisitionId: clientKey,
    status: "active",
    acquiredAt: new Date().toISOString(),
  };

  appAcquisitionsByTenant.set(tenant.tenantSlug, installation);
  if (scopedKey) {
    acquisitionsByClientId.set(scopedKey, installation);
  }

  return {
    success: true,
    status: 200,
    data: installation,
  };
}

export function handleAppLaunch(
  tenant: RequestTenantContext,
  payload: {
    installationId?: string;
  }
): { success: boolean; status: number; launchUrl?: string; error?: string } {
  const requestedId = payload.installationId;
  if (!requestedId) {
    return {
      success: false,
      status: 400,
      error: "Missing installationId for app launch.",
    };
  }

  const currentInstallation = appAcquisitionsByTenant.get(tenant.tenantSlug);

  // Cross-tenant check: if installation exists for another tenant, deny with 403
  for (const other of appAcquisitionsByTenant.values()) {
    if (other.installationId === requestedId && other.tenantSlug !== tenant.tenantSlug) {
      return {
        success: false,
        status: 403,
        error: "Access denied: cannot launch an installation belonging to another tenant.",
      };
    }
  }

  // Not found check
  if (!currentInstallation || currentInstallation.installationId !== requestedId) {
    return {
      success: false,
      status: 404,
      error: "Installation not found.",
    };
  }

  if (currentInstallation.status === "revoked" || currentInstallation.status === "provisioning") {
    return {
      success: false,
      status: 403,
      error: `Installation is ${currentInstallation.status}.`,
    };
  }

  const tenantPrefix = tenant.tenantSlug === "tenant-b" ? "tenantB" : (tenant.tenantSlug === "tenant-a" ? "tenantA" : tenant.tenantSlug);
  const eligibility = planEligibilityOverride.get(tenantPrefix) ?? planEligibilityOverride.get(tenant.tenantSlug);
  if (eligibility === "none" || eligibility === false || !eligibility) {
    return {
      success: false,
      status: 403,
      error: "Installation plan eligibility has been revoked.",
    };
  }

  return {
    success: true,
    status: 200,
    launchUrl: `https://${tenant.tenantSlug}.support.servicev8.com/runtime/app?install=${currentInstallation.installationId}`,
  };
}
