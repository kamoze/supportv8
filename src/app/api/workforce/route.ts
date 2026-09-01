import { NextRequest, NextResponse } from "next/server";
import { workforceManager } from "@/lib/workforce";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import { isRestrictedDemoOperator } from "@/lib/chatbot/security/ingress-security";

export async function GET(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    const hiredIds = new Set(
      marketplaceService.getWorkforceCatalog(tenant.tenantSlug)
        .filter((member) => member.isHired)
        .map((member) => member.id)
    );
    const members = workforceManager.getAll().filter((member) => hiredIds.has(member.id));
    return NextResponse.json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "Unable to load workforce" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    if (isRestrictedDemoOperator(tenant)) {
      return NextResponse.json(
        { success: false, error: "Demo operators cannot change the shared AI workforce." },
        { status: 403 }
      );
    }
    const { action, memberId, task, employeeId, issueDescription } = await req.json();

    if (action === "hire") {
      const hired = marketplaceService.hireWorkforceAgent(employeeId || memberId, tenant.tenantSlug);
      const member = workforceManager.getById(hired.id);
      return NextResponse.json({ success: true, message: `${hired.name} hired for this workspace.`, data: member });
    }

    if (action === "assign_work") {
      const targetId = memberId || employeeId;
      const isHired = marketplaceService.getWorkforceCatalog(tenant.tenantSlug)
        .some((member) => member.id === targetId && member.isHired);
      if (!isHired) {
        return NextResponse.json({ success: false, error: "This AI employee is not hired for the workspace." }, { status: 409 });
      }
      const result = workforceManager.assignWork(targetId, issueDescription || task);
      return NextResponse.json({ success: result.success, message: result.message, supervisor: result.supervisor });
    }

    if (action === "delegate") {
      const result = workforceManager.delegateTask(memberId, task);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Workforce action failed" },
      { status: 400 }
    );
  }
}
