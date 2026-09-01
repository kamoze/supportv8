import { NextRequest, NextResponse } from "next/server";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";

function marketplaceError(error: unknown) {
  if (error instanceof RequestAuthError) {
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
    return NextResponse.json({
      success: true,
      data: {
        credits: marketplaceService.getCredits(tenant.tenantSlug),
        connectors: marketplaceService.getConnectors(tenant.tenantSlug),
        workforce: marketplaceService.getWorkforceCatalog(tenant.tenantSlug),
        plans: marketplaceService.getPlans(tenant.tenantSlug),
        members: marketplaceService.getMembers(tenant.tenantSlug),
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
    const body = await req.json();
    const { action } = body;

    if (action === "deduct_credits") {
      const { amount, reason } = body;
      const result = marketplaceService.deductCredits(amount || 0, reason || "Operation deduction", tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `Deducted ${result.deducted} credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "add_credits" || action === "purchase_credits") {
      const { amount, reason } = body;
      const result = marketplaceService.addCredits(amount || 0, reason || "Credit purchase", tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `Added ${result.added} credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "toggle_connector") {
      const { connectorId, isSubscribed } = body;
      const updated = marketplaceService.toggleConnector(connectorId, isSubscribed, tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `Connector ${updated.name} ${isSubscribed ? "subscribed & activated" : "disabled"}`,
        data: updated,
      });
    }

    if (action === "hire_agent") {
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
      const plan = marketplaceService.selectPlan(planId, tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `Tenant subscription upgraded to ${plan.name} Tier!`,
        data: plan,
      });
    }

    if (action === "invite_member") {
      const { name, email, role } = body;
      const member = marketplaceService.inviteMember(name, email, role, tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `Invitation dispatched to ${email}`,
        data: member,
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
