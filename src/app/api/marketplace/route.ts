import { NextRequest, NextResponse } from "next/server";
import { marketplaceService } from "@/lib/services/marketplace-service";

export async function GET(req?: NextRequest) {
  const searchParams = req?.url ? new URL(req.url).searchParams : undefined;
  const tenant = searchParams?.get("tenant") || req?.headers?.get("x-tenant-slug") || req?.headers?.get("x-tenant-id") || "acme";
  const clean = tenant.toLowerCase().trim();

  if (clean !== "acme" && clean !== "meridian" && clean !== "default") {
    const connectors = marketplaceService.getConnectors().map((c) => ({
      ...c,
      isSubscribed: false,
      status: "available" as const,
    }));
    const workforce = marketplaceService.getWorkforceCatalog().map((w) => ({
      ...w,
      isHired: false,
      hiredCount: 0,
    }));
    const plans = marketplaceService.getPlans();
    const settings = {
      ...marketplaceService.getSettings(),
      tenantId: `tenant_${clean}`,
    };

    return NextResponse.json({
      success: true,
      data: {
        credits: 1000,
        connectors,
        workforce,
        plans,
        members: [],
        settings,
        reports: [],
        auditLogs: [],
      },
    });
  }

  const credits = marketplaceService.getCredits();
  const connectors = marketplaceService.getConnectors();
  const workforce = marketplaceService.getWorkforceCatalog();
  const plans = marketplaceService.getPlans();
  const members = marketplaceService.getMembers();
  const settings = marketplaceService.getSettings();
  const reports = marketplaceService.getReports();
  const auditLogs = marketplaceService.getAuditLogs();

  return NextResponse.json({
    success: true,
    data: {
      credits,
      connectors,
      workforce,
      plans,
      members,
      settings,
      reports,
      auditLogs,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "deduct_credits") {
      const { amount, reason } = body;
      const result = marketplaceService.deductCredits(amount || 0, reason || "Operation deduction");
      return NextResponse.json({
        success: true,
        message: `Deducted ${result.deducted} credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "add_credits" || action === "purchase_credits") {
      const { amount, reason } = body;
      const result = marketplaceService.addCredits(amount || 0, reason || "Credit purchase");
      return NextResponse.json({
        success: true,
        message: `Added ${result.added} credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "toggle_connector") {
      const { connectorId, isSubscribed } = body;
      const updated = marketplaceService.toggleConnector(connectorId, isSubscribed);
      return NextResponse.json({
        success: true,
        message: `Connector ${updated.name} ${isSubscribed ? "subscribed & activated" : "disabled"}`,
        data: updated,
      });
    }

    if (action === "hire_agent") {
      const { agentId } = body;
      const updated = marketplaceService.hireWorkforceAgent(agentId);
      return NextResponse.json({
        success: true,
        message: `AI Agent ${updated.name} hired and added to workforce!`,
        data: updated,
      });
    }

    if (action === "select_plan") {
      const { planId } = body;
      const plan = marketplaceService.selectPlan(planId);
      return NextResponse.json({
        success: true,
        message: `Tenant subscription upgraded to ${plan.name} Tier!`,
        data: plan,
      });
    }

    if (action === "invite_member") {
      const { name, email, role } = body;
      const member = marketplaceService.inviteMember(name, email, role);
      return NextResponse.json({
        success: true,
        message: `Invitation dispatched to ${email}`,
        data: member,
      });
    }

    if (action === "update_settings") {
      const { settings } = body;
      const updated = marketplaceService.updateSettings(settings);
      return NextResponse.json({
        success: true,
        message: "Tenant settings updated successfully",
        data: updated,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid marketplace action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Marketplace action failed" },
      { status: 400 }
    );
  }
}
