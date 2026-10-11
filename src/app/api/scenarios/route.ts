import { NextRequest, NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import {
  listScenarioConfigs,
  saveScenarioConfig,
  startScenarioRun,
  getScenarioConfig,
  CANONICAL_WORKFORCE_AGENT_IDS,
  isScenarioAcquiredForTenant,
  getAcquiredScenarioForTenant,
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
      if (!config) {
        return NextResponse.json(
          { success: false, error: "Access denied to requested scenario config." },
          { status: 403 }
        );
      }

      // Catalog scenario check: unacquired scenario or scenario lacking dispatch authority cannot run
      if (!isScenarioAcquiredForTenant(tenant.tenantSlug, config.scenarioId)) {
        return NextResponse.json(
          {
            success: false,
            error: `Scenario '${config.scenarioId}' is not acquired for tenant '${tenant.tenantSlug}' or lacks workflow dispatch authority.`,
          },
          { status: 403 }
        );
      }

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

      const hiredEmployees = marketplaceService
        .getWorkforceCatalog(tenant.tenantSlug)
        .filter((employee) => employee.isHired)
        .map((employee) => employee.id);
      const acquired = getAcquiredScenarioForTenant(tenant.tenantSlug, config.scenarioId);
      let executionStatus: "running" | "unavailable" | "failed" = "running";
      let failureReason: string | undefined;

      // Contact execution owner dispatcher if configured
      if (acquired?.dispatcherId) {
        try {
          const dispatchUrl =
            process.env.WORKFLOW_DISPATCH_URL ||
            `https://dispatch.servicev8.internal/api/v1/scenarios/${config.scenarioId}/dispatch`;
          const res = await fetch(dispatchUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-ServiceV8-Tenant": tenant.tenantSlug,
              "X-ServiceV8-Dispatcher": acquired.dispatcherId,
            },
            body: JSON.stringify({
              scenarioId: config.scenarioId,
              configId: body.configId,
              revision: config.revision,
              participants: config.participants,
              assignedConnectors: acquired.assignedConnectors,
              idempotencyKey: body.idempotencyKey,
            }),
          });
          if (!res.ok) {
            executionStatus = "unavailable";
            failureReason = `Execution owner rejected dispatch (${res.status})`;
          }
        } catch (err: any) {
          executionStatus = "unavailable";
          failureReason = err?.message || "Execution owner unavailable";
        }
      }

      const runResult = startScenarioRun({
        tenantSlug: tenant.tenantSlug,
        configId: body.configId,
        activeHires: hiredEmployees,
        idempotencyKey: body.idempotencyKey,
        requireAcquisition: true,
        executionStatus,
        failureReason,
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
