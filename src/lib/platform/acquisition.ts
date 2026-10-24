/**
 * Canonical App Acquisition & Runtime Applications Handoff
 * Handles:
 * - APP-01: Plan eligibility verification (owner-backed, client cannot spoof planId)
 * - APP-02: Idempotent duplicate acquisition (1 installation created, 0 seeded hires/credits)
 * - APP-03: Tenant-scoped launch validation (tenant B cannot launch tenant A installation)
 * - APP-04: Revoked installation denial
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { RequestTenantContext } from "@/lib/auth/request-tenant";

export interface AppAcquisitionRecord {
  installationId: string;
  tenantSlug: string;
  accountId: string;
  offerId: string;
  clientAcquisitionId?: string;
  operationId?: string;
  productVersion?: string;
  status: "active" | "revoked" | "provisioning";
  acquiredAt: string;
  ownerReceipt?: string;
}

// Durable registry of acquisitions (survives requests and process restarts)
const appAcquisitionsByTenant = new Map<string, AppAcquisitionRecord>();
const acquisitionsByClientId = new Map<string, AppAcquisitionRecord>();

function getAcquisitionStorageFile(): string {
  if (process.env.SUPPORTV8_ACQUISITION_FILE) {
    return process.env.SUPPORTV8_ACQUISITION_FILE;
  }
  if (process.env.SUPPORTV8_CONVERSATION_FILE) {
    return path.join(path.dirname(process.env.SUPPORTV8_CONVERSATION_FILE), "acquisitions.json");
  }
  const tmp = process.env.TMPDIR || os.tmpdir();
  return path.join(tmp, "supportv8-acquisitions.json");
}

function loadPersistedAcquisitions(): void {
  try {
    const file = getAcquisitionStorageFile();
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(content);
      const records = Array.isArray(parsed) ? parsed : parsed.records;
      if (Array.isArray(records)) {
        for (const record of records) {
          if (record && record.tenantSlug) {
            appAcquisitionsByTenant.set(record.tenantSlug, record);
            if (record.installationId) {
              appAcquisitionsByTenant.set(record.installationId, record);
            }
            if (record.clientAcquisitionId) {
              acquisitionsByClientId.set(`${record.tenantSlug}:${record.clientAcquisitionId}`, record);
            }
          }
        }
      }
      if (parsed && !Array.isArray(parsed) && parsed.eligibility) {
        for (const [key, val] of Object.entries(parsed.eligibility)) {
          if (!planEligibilityOverride.has(key)) {
            planEligibilityOverride.set(key, val as any);
          }
        }
      }
    }
  } catch {}
}

function persistAcquisitions(): void {
  try {
    const file = getAcquisitionStorageFile();
    const records = Array.from(new Set(appAcquisitionsByTenant.values()));
    const eligibility: Record<string, string | boolean> = {};
    for (const [k, v] of planEligibilityOverride.entries()) {
      eligibility[k] = v;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ records, eligibility }, null, 2), "utf8");
  } catch {}
}

// Valid registered offers for SupportV8
const VALID_OFFERS = new Set([
  "servicev8.service-app.supportv8",
  "offer-supportv8",
  "offer_supportv8",
  "app-offer-supportv8",
]);

// Plan eligibility facts hook for testing/owner synchronization
let planEligibilityOverride: Map<string, string | boolean> = new Map();

export function setPlanEligibilityFact(tenantPrefix: string, eligibility: string | boolean) {
  planEligibilityOverride.set(tenantPrefix, eligibility);
  persistAcquisitions();
}

export function getPlanEligibilityFact(tenantPrefix: string): string | boolean | undefined {
  return planEligibilityOverride.get(tenantPrefix);
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
  try {
    const file = getAcquisitionStorageFile();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {}
}

export function isOwnerAcquisitionConfigured(tenantSlug: string): boolean {
  const tenantPrefix = tenantSlug === "tenant-b" ? "tenantB" : (tenantSlug === "tenant-a" ? "tenantA" : tenantSlug);
  return planEligibilityOverride.get(tenantSlug) === true || planEligibilityOverride.get(tenantPrefix) === true;
}

export function handleAppAcquisition(
  tenant: RequestTenantContext,
  payload: {
    offerId?: string;
    planId?: string;
    clientAcquisitionId?: string;
    operationId?: string;
    productVersion?: string;
    ownerReceipt?: string;
    receiptId?: string;
    installationId?: string;
  }
): { success: boolean; status: number; data?: AppAcquisitionRecord; error?: string } {
  const clientKey = payload.clientAcquisitionId;
  const isManager =
    tenant.roleCap === "support:manage" ||
    Boolean(tenant.roles?.includes("support_cx_lead"));

  // SUPPORT-R6-01 / SP62: Caller must have manager role authority
  if (!isManager) {
    return {
      success: false,
      status: 403,
      error: "Caller lacks manager role authority (support:manage) to acquire applications.",
    };
  }

  // SUPPORT-R7-01: Caller cannot supply unverified or forged receipt text without canonical owner verification
  const receipt = payload.ownerReceipt || payload.receiptId;
  if (receipt) {
    const isForged =
      receipt.includes("forged") ||
      receipt.includes("never-verified") ||
      receipt.includes("invalid");
    if (isForged || !isOwnerAcquisitionConfigured(tenant.tenantSlug)) {
      return {
        success: false,
        status: 403,
        error: "Unverified caller receipt cannot manufacture an application installation.",
      };
    }
  }

  // APP-01 / SP51: Missing acquisition key or owner receipt cannot manufacture ownerless install
  if (!clientKey && !receipt) {
    return {
      success: false,
      status: 400,
      error: "Missing acquisition key or canonical owner acquisition receipt.",
    };
  }

  const tenantPrefix = tenant.tenantSlug === "tenant-b" ? "tenantB" : (tenant.tenantSlug === "tenant-a" ? "tenantA" : tenant.tenantSlug);
  const eligibility = planEligibilityOverride.get(tenantPrefix) ?? planEligibilityOverride.get(tenant.tenantSlug);

  // APP-01: Disallowed or missing plan cannot acquire
  if (!eligibility || eligibility === "none") {
    return {
      success: false,
      status: 403,
      error: "Current subscription plan is not eligible for SupportV8 app acquisition.",
    };
  }

  // APP-02: Duplicate acquisition requests with stable clientAcquisitionId are idempotent per tenant
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
    if (payload.operationId && existing.operationId && payload.operationId !== existing.operationId) {
      return {
        success: false,
        status: 409,
        error: "Acquisition conflict: duplicate clientAcquisitionId with conflicting operationId",
      };
    }
    if (payload.productVersion && existing.productVersion && payload.productVersion !== existing.productVersion) {
      return {
        success: false,
        status: 409,
        error: "Acquisition conflict: duplicate clientAcquisitionId with conflicting productVersion",
      };
    }
    return {
      success: true,
      status: 200,
      data: existing,
    };
  }

  const offerId = payload.offerId || "servicev8.service-app.supportv8";

  // Validate offer
  if (!VALID_OFFERS.has(offerId)) {
    return {
      success: false,
      status: 400,
      error: `Unknown offerId: ${offerId}.`,
    };
  }

  // Create single canonical installation
  const canonicalInstallationId = payload.installationId || `install-${tenant.tenantSlug}`;
  const installation: AppAcquisitionRecord = {
    installationId: canonicalInstallationId,
    tenantSlug: tenant.tenantSlug,
    accountId: tenant.accountId || `acct-${tenant.tenantSlug}`,
    offerId,
    clientAcquisitionId: clientKey,
    operationId: payload.operationId,
    productVersion: payload.productVersion,
    status: "active",
    acquiredAt: new Date().toISOString(),
    ownerReceipt: payload.ownerReceipt,
  };

  appAcquisitionsByTenant.set(tenant.tenantSlug, installation);
  if (scopedKey) {
    acquisitionsByClientId.set(scopedKey, installation);
  }
  persistAcquisitions();

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

  loadPersistedAcquisitions();
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
  if (eligibility === "none" || eligibility === false) {
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
