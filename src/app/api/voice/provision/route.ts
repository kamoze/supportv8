import { NextRequest, NextResponse } from "next/server";
import { voiceService } from "@/lib/voice/voice-service";
import type { VoiceProvisioningRequest, VoicePermissionScope } from "@/lib/voice/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") || "tenant_default";
    const configs = voiceService.getPhoneConfigs(tenantId);
    return NextResponse.json({
      success: true,
      count: configs.length,
      data: configs,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load voice configs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, tenantId = "tenant_default", configId } = body;

    // 1. Provision New Voice Agent Connection via API
    if (action === "provision") {
      const provisioningReq: VoiceProvisioningRequest = {
        tenantId,
        employeeId: body.employeeId,
        provider: body.provider || "vapi",
        phoneNumber: body.phoneNumber,
        phoneMode: body.phoneMode,
        voiceId: body.voiceId,
        systemPrompt: body.systemPrompt,
        firstMessage: body.firstMessage,
        minVerificationLevel: body.minVerificationLevel,
        permissionScopes: body.permissionScopes as VoicePermissionScope[],
      };

      if (!provisioningReq.employeeId) {
        return NextResponse.json(
          { success: false, error: "employeeId is required to match remote voice agent with local AI employee" },
          { status: 400 }
        );
      }
      if (!provisioningReq.phoneNumber) {
        return NextResponse.json(
          { success: false, error: "phoneNumber is required for voice telephony binding" },
          { status: 400 }
        );
      }

      const result = await voiceService.provisionVoiceAgent(provisioningReq);
      return NextResponse.json(result);
    }

    // 2. Re-Sync Remote Provider Configuration
    if (action === "sync") {
      if (!configId) {
        return NextResponse.json({ success: false, error: "configId is required" }, { status: 400 });
      }
      const result = await voiceService.syncVoiceAgent(configId);
      return NextResponse.json(result);
    }

    // 3. Update Permissions Scope
    if (action === "update_permissions") {
      if (!configId || !Array.isArray(body.permissionScopes)) {
        return NextResponse.json({ success: false, error: "configId and permissionScopes array required" }, { status: 400 });
      }
      const result = voiceService.updatePermissions(configId, body.permissionScopes as VoicePermissionScope[]);
      return NextResponse.json({
        success: result.success,
        message: "Voice bot permission scopes updated successfully.",
        config: result.config,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Voice provisioning request failed" },
      { status: 500 }
    );
  }
}
