import { NextRequest, NextResponse } from "next/server";
import { marketplaceService } from "@/lib/services/marketplace-service";

export async function GET() {
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
