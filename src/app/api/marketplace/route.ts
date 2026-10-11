import { NextRequest, NextResponse } from "next/server";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import { isRestrictedDemoOperator } from "@/lib/chatbot/security/ingress-security";
import { accountMembers, AccountError } from "@/lib/auth/account-members";
import { requireSameOrigin } from "@/lib/auth/account-error";
import { isDemoTenant } from "@/lib/platform/workforce";
import { handleAppAcquisition, handleAppLaunch, deductionReceipts, isOwnerAcquisitionConfigured } from "@/lib/platform/acquisition";

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
      const isOwnerConfigured = Boolean(
        process.env.MARKETPLACE_URL ||
        process.env.SERVICEV8_MARKETPLACE_URL ||
        body.ownerReceipt ||
        body.receiptId ||
        isOwnerAcquisitionConfigured(tenant.tenantSlug)
      );
      if (!isOwnerConfigured) {
        return NextResponse.json(
          { success: false, error: "Canonical Marketplace acquisition owner is unavailable." },
          { status: 503 }
        );
      }
      const result = handleAppAcquisition(tenant, body);
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
