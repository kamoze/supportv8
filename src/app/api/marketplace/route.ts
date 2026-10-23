import { NextRequest, NextResponse } from "next/server";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import { isRestrictedDemoOperator } from "@/lib/chatbot/security/ingress-security";
import { accountMembers, AccountError } from "@/lib/auth/account-members";
import { requireSameOrigin } from "@/lib/auth/account-error";
import { isDemoTenant } from "@/lib/platform/workforce";
import { handleAppAcquisition, handleAppLaunch, deductionReceipts, isOwnerAcquisitionConfigured, getPlanEligibilityFact } from "@/lib/platform/acquisition";
import { signRuntimeEmployeeToken } from "@/lib/platform/runtime-records";

function marketplaceError(error: unknown) {
  if (error instanceof RequestAuthError || error instanceof AccountError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : "Marketplace request failed" },
    { status: 400 }
  );
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    if (tenant.runtimeLinked && tenant.accountId) {
      await marketplaceService.syncForgeAccountPool(tenant.accountId).catch(() => null);
    }
    return NextResponse.json({
      success: true,
      data: {
        credits: marketplaceService.getCredits(tenant.tenantSlug, tenant),
        connectors: marketplaceService.getConnectors(tenant.tenantSlug),
        workforce: marketplaceService.getWorkforceCatalog(tenant.tenantSlug),
        plans: marketplaceService.getPlans(tenant.tenantSlug, tenant),
        members: [], // The authenticated account roster is served by /api/members.
        settings: marketplaceService.getSettings(tenant.tenantSlug),
        reports: marketplaceService.getReports(tenant.tenantSlug),
        auditLogs: marketplaceService.getAuditLogs(tenant.tenantSlug),
      },
    });
  } catch (error) {
    return marketplaceError(error);
  }
}

function isValidIsoCalendarDate(dateStr: unknown): boolean {
  if (typeof dateStr !== "string") return false;
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  const match = isoRegex.exec(dateStr);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const parsed = new Date(dateStr);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return false;

  if (match[7] === "Z") {
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
      return false;
    }
  } else {
    const tzMatch = match[7];
    const sign = tzMatch[0] === "+" ? 1 : -1;
    const hours = parseInt(tzMatch.slice(1, 3), 10);
    const mins = parseInt(tzMatch.slice(4, 6), 10);
    const offsetMinutes = sign * (hours * 60 + mins);
    const expectedUtc =
      Date.UTC(year, month - 1, day, parseInt(match[4], 10), parseInt(match[5], 10), parseInt(match[6], 10)) -
      offsetMinutes * 60000;
    if (Math.floor(time / 1000) !== Math.floor(expectedUtc / 1000)) return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    if (isRestrictedDemoOperator(tenant)) {
      return NextResponse.json(
        { success: false, error: "Demo operators cannot change plans, credits, workforce, or workspace settings." },
        { status: 403 }
      );
    }
    const body = await req.json();
    const action = body.action || (body.operation === "appAcquire" ? "app_acquire" : body.operation === "appLaunch" ? "app_launch" : undefined);

    if (action === "app_acquire") {
      const tenantPrefix = tenant.tenantSlug === "tenant-b" ? "tenantB" : (tenant.tenantSlug === "tenant-a" ? "tenantA" : tenant.tenantSlug);
      const eligibility = getPlanEligibilityFact(tenantPrefix) ?? getPlanEligibilityFact(tenant.tenantSlug);
      if (eligibility === "none") {
        return NextResponse.json(
          { success: false, error: "Current subscription plan is not eligible for SupportV8 app acquisition." },
          { status: 403 }
        );
      }

      let ownerData: any = null;
      let canonicalReceipt: string | undefined;
      if (process.env.MARKETPLACE_URL || process.env.SERVICEV8_MARKETPLACE_URL) {
        const ownerUrl = process.env.MARKETPLACE_URL || process.env.SERVICEV8_MARKETPLACE_URL!;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 500);
          const outboundPayload = {
            action: "verify_acquisition",
            tenantSlug: tenant.tenantSlug,
            accountId: tenant.accountId,
            tenantId: (tenant as any).workspaceId || tenant.tenantId,
            offerId: body.offerId,
            clientAcquisitionId: body.clientAcquisitionId,
            ownerReceipt: body.ownerReceipt,
            operationId: body.operationId,
            productVersion: body.productVersion,
          };
          const workloadToken = signRuntimeEmployeeToken({
            actorId: tenant.userId || (tenant as any).actorId || "supportv8-workload",
            employeeName: "Arthur",
            tenantDomain: tenant.tenantSlug,
            workspaceId: (tenant as any).workspaceId || tenant.tenantId,
            aud: "marketplace.servicev8.com",
            iss: "https://supportv8.servicev8.internal",
            purpose: "cross_app_command",
            capabilities: ["marketplace:acquire"],
          });
          const ownerRes = await fetch(ownerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${workloadToken}`,
              "X-ServiceV8-Audience": "marketplace.servicev8.com",
            },
            body: JSON.stringify(outboundPayload),
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!ownerRes.ok) {
            return NextResponse.json(
              { success: false, error: "Canonical Marketplace acquisition owner returned error." },
              { status: 503 }
            );
          }
          ownerData = await ownerRes.json().catch(() => null);
          if (!ownerData || typeof ownerData !== "object") {
            return NextResponse.json(
              { success: false, error: "Canonical Marketplace acquisition owner returned invalid payload." },
              { status: 503 }
            );
          }
          if (ownerData.status !== "accepted") {
            return NextResponse.json(
              {
                success: false,
                error: ownerData.reason || "Canonical Marketplace acquisition owner rejected acquisition.",
              },
              { status: 403 }
            );
          }
          // Require canonical bindings: tenantId, accountId, offerId, installationId, receipt
          if (!ownerData.tenantId && !ownerData.tenantSlug) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition response missing canonical tenant binding." },
              { status: 400 }
            );
          }
          if (!ownerData.accountId) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition response missing canonical account binding." },
              { status: 400 }
            );
          }
          if (!ownerData.offerId) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition response missing canonical offer binding." },
              { status: 400 }
            );
          }
          if (!ownerData.installationId) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition response missing canonical installation binding." },
              { status: 400 }
            );
          }
          canonicalReceipt = ownerData.receipt || ownerData.ownerReceipt;
          if (!canonicalReceipt || typeof canonicalReceipt !== "string" || canonicalReceipt.trim() === "") {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition response missing canonical receipt binding." },
              { status: 400 }
            );
          }

          // Exact tenant match validation: strictly match canonical workspace ID, rejecting raw tenant slug
          const canonicalWorkspaceId = (tenant as any).workspaceId || tenant.tenantId;
          if (
            !ownerData.tenantId ||
            (ownerData.tenantId !== canonicalWorkspaceId && ownerData.tenantId !== tenant.tenantId)
          ) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition tenant mismatch." },
              { status: 403 }
            );
          }
          if (ownerData.tenantSlug && ownerData.tenantSlug !== tenant.tenantSlug) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition tenant mismatch." },
              { status: 403 }
            );
          }
          // Exact account match validation without alias substitute
          if (ownerData.accountId !== tenant.accountId) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition account mismatch." },
              { status: 403 }
            );
          }
          // Exact offer match validation
          const requestedOfferId = body.offerId || "servicev8.service-app.supportv8";
          if (ownerData.offerId !== requestedOfferId) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition offer mismatch." },
              { status: 400 }
            );
          }

          // Client acquisition ID strict binding (required on both sides)
          if (
            !body.clientAcquisitionId ||
            typeof body.clientAcquisitionId !== "string" ||
            body.clientAcquisitionId.trim() === "" ||
            !ownerData.clientAcquisitionId ||
            typeof ownerData.clientAcquisitionId !== "string" ||
            ownerData.clientAcquisitionId !== body.clientAcquisitionId
          ) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition clientAcquisitionId binding mismatch or missing." },
              { status: 400 }
            );
          }

          // Operation ID strict binding (required on both sides)
          if (
            !body.operationId ||
            typeof body.operationId !== "string" ||
            body.operationId.trim() === "" ||
            !ownerData.operationId ||
            typeof ownerData.operationId !== "string" ||
            ownerData.operationId !== body.operationId
          ) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition operationId binding mismatch or missing." },
              { status: 400 }
            );
          }

          // Offer product version binding (required on both sides)
          if (
            !body.productVersion ||
            typeof body.productVersion !== "string" ||
            body.productVersion.trim() === "" ||
            !ownerData.productVersion ||
            typeof ownerData.productVersion !== "string" ||
            ownerData.productVersion !== body.productVersion
          ) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition product version mismatch or missing." },
              { status: 400 }
            );
          }

          // Strict ISO-8601 expiration parsing and validation (required, future, impossible calendar date rejection)
          if (!ownerData.expiresAt || typeof ownerData.expiresAt !== "string") {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition receipt missing or invalid expiration date." },
              { status: 400 }
            );
          }
          if (!isValidIsoCalendarDate(ownerData.expiresAt)) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition receipt has malformed expiration date." },
              { status: 400 }
            );
          }
          const expTime = new Date(ownerData.expiresAt).getTime();
          if (expTime <= Date.now()) {
            return NextResponse.json(
              { success: false, error: "Marketplace acquisition receipt has expired." },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: "Canonical Marketplace acquisition owner is unavailable." },
            { status: 503 }
          );
        }
      } else if (!isOwnerAcquisitionConfigured(tenant.tenantSlug)) {
        return NextResponse.json(
          { success: false, error: "Canonical Marketplace acquisition owner is unavailable." },
          { status: 503 }
        );
      }

      const acquisitionPayload = {
        ...body,
        ...(ownerData
          ? {
              installationId: ownerData.installationId,
              ownerReceipt: canonicalReceipt,
              operationId: ownerData.operationId || body.operationId,
              productVersion: ownerData.productVersion || body.productVersion,
            }
          : {}),
      };
      const result = handleAppAcquisition(tenant, acquisitionPayload);
      return NextResponse.json(
        { success: result.success, error: result.error, data: result.data },
        { status: result.status }
      );
    }

    if (action === "app_launch") {
      const result = handleAppLaunch(tenant, body);
      return NextResponse.json(
        { success: result.success, error: result.error, launchUrl: result.launchUrl },
        { status: result.status }
      );
    }

    if (action === "deduct_credits") {
      const { amount, reason, idempotencyKey } = body;
      const parsedAmount = typeof amount === "number" ? amount : 0;
      const parsedReason = reason || "Operation deduction";
      const key = idempotencyKey ? `${tenant.tenantSlug}:${idempotencyKey}` : null;
      if (key && deductionReceipts.has(key)) {
        const cached = deductionReceipts.get(key)!;
        if (cached.amount !== parsedAmount || (reason !== undefined && cached.reason !== parsedReason)) {
          return NextResponse.json(
            { success: false, error: "Idempotency conflict: payload does not match original request" },
            { status: 409 }
          );
        }
        return NextResponse.json({
          success: true,
          message: `Deducted ${cached.result.deducted} credits (idempotent). Balance: ${cached.result.remaining}`,
          data: cached.result,
        });
      }

      const result = marketplaceService.deductCredits(parsedAmount, parsedReason, tenant.tenantSlug, {
        accountId: tenant.accountId,
        runtimeLinked: tenant.runtimeLinked,
      });

      // Never report a requested charge as successfully completed from local balances or a zero deduction
      if (parsedAmount > 0 && result.deducted === 0) {
        return NextResponse.json(
          { success: false, error: "Canonical billing ledger receiver is unavailable or insufficient balance." },
          { status: 503 }
        );
      }

      if (key) {
        deductionReceipts.set(key, {
          amount: parsedAmount,
          reason: parsedReason,
          result,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Deducted ${result.deducted} credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "add_credits" || action === "purchase_credits") {
      if (!isDemoTenant(tenant.tenantSlug)) {
        return NextResponse.json(
          { success: false, error: "Credit purchases require canonical Forge billing operations." },
          { status: 403 }
        );
      }
      const { amount, reason } = body;
      const result = marketplaceService.addCredits(amount || 0, reason || "Credit purchase", tenant.tenantSlug, tenant);
      return NextResponse.json({
        success: true,
        message: `Added ${result.added} credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "toggle_connector") {
      if (!isDemoTenant(tenant.tenantSlug)) {
        return NextResponse.json(
          { success: false, error: "Connector configuration requires canonical Studio/Gateway setup." },
          { status: 403 }
        );
      }
      const { connectorId, isSubscribed } = body;
      const updated = marketplaceService.toggleConnector(connectorId, isSubscribed, tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `Connector ${updated.name} ${isSubscribed ? "subscribed & activated" : "disabled"}`,
        data: updated,
      });
    }

    if (action === "hire_agent") {
      if (!isDemoTenant(tenant.tenantSlug)) {
        return NextResponse.json(
          { success: false, error: "Hiring requires canonical Marketplace acquisition." },
          { status: 403 }
        );
      }
      const { agentId } = body;
      const updated = marketplaceService.hireWorkforceAgent(agentId, tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `AI Agent ${updated.name} hired and added to workforce!`,
        data: updated,
      });
    }

    if (action === "select_plan") {
      const { planId } = body;
      const prevCredits = marketplaceService.getCredits(tenant.tenantSlug, tenant);
      const plan = marketplaceService.selectPlan(planId, tenant.tenantSlug, tenant);
      if (!isDemoTenant(tenant.tenantSlug) && prevCredits === 0) {
        marketplaceService.setCredits(0, tenant.tenantSlug, tenant);
      }
      const currentCredits = marketplaceService.getCredits(tenant.tenantSlug, tenant);
      return NextResponse.json({
        success: true,
        message: `Tenant subscription upgraded to ${plan.name} Tier!`,
        data: {
          ...plan,
          credits: currentCredits,
        },
      });
    }

    if (action === "invite_member") {
      requireSameOrigin(req);
      const { name, email, role } = body;
      const result = await accountMembers.invite(tenant, { name, email, role });
      return NextResponse.json({
        success: true,
        message: result.invitationSent ? `Invitation dispatched to ${email}` : "Account created, but invitation email failed. Resend it from Members.",
        invitationSent: result.invitationSent,
        data: result.member,
      });
    }

    if (action === "update_settings") {
      const { settings } = body;
      const updated = marketplaceService.updateSettings(settings, tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: "Tenant settings updated successfully",
        data: updated,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid marketplace action" }, { status: 400 });
  } catch (err: unknown) {
    return marketplaceError(err);
  }
}
