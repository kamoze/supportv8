import { NextRequest, NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import {
  listScenarioConfigs,
  saveScenarioConfig,
  startScenarioRun,
  getScenarioConfig,
  CANONICAL_WORKFORCE_AGENT_IDS,
} from "@/lib/platform/scenarios";

import { marketplaceService } from "@/lib/services/marketplace-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(request);
    const configs = listScenarioConfigs(tenant.tenantSlug);
    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(request);
    const body = await request.json();
    const { action } = body;

    if (action === "save") {
      const participants = (Array.isArray(body.participants) ? body.participants : []).map((p: any) =>
        typeof p === "string" ? { employeeId: p, role: "operator" } : p
      );
      const saved = saveScenarioConfig({
        id: body.id,
        tenantSlug: tenant.tenantSlug,
        scenarioId: body.scenarioId,
        name: body.name,
        participants,
        parameters: body.parameters || body.rules || {},
        tags: body.tags,
      });
      return NextResponse.json({ success: true, data: saved });
    }

    if (action === "run") {
      const config = getScenarioConfig(tenant.tenantSlug, body.configId);
      if (config) {
        const unverifiedParticipants = config.participants.filter(
          (p) =>
            !CANONICAL_WORKFORCE_AGENT_IDS.has(p.employeeId) ||
            !marketplaceService.isAgentHired(p.employeeId, tenant.tenantSlug)
        );
        if (unverifiedParticipants.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Participants not verified or hired for tenant: ${unverifiedParticipants.map((p) => p.employeeId).join(", ")}`,
            },
            { status: 403 }
          );
        }
      }

      const hiredEmployees = marketplaceService
        .getWorkforceCatalog(tenant.tenantSlug)
        .filter((employee) => employee.isHired)
        .map((employee) => employee.id);
      const runResult = startScenarioRun({
        tenantSlug: tenant.tenantSlug,
        configId: body.configId,
        activeHires: hiredEmployees,
        idempotencyKey: body.idempotencyKey,
      });
      return NextResponse.json(
        { success: runResult.success, data: runResult.run, error: runResult.error },
        { status: runResult.status }
      );
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    if (msg.includes("Cross-tenant") || msg.includes("denied")) {
      return NextResponse.json({ success: false, error: msg }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
