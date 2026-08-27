import { describe, it, expect } from "vitest";
import { signVoiceContextToken, verifyVoiceContextToken } from "@/lib/voice/context-token";
import {
  deriveAllowedVoiceTools,
  verificationMeets,
  SUPPORT_VOICE_CAPABILITIES,
} from "@/lib/voice/capability-manifest";
import { voiceService } from "@/lib/voice/voice-service";

describe("supportV8 Voice Telephony & AI Integration (GrowthV8 Architecture)", () => {
  it("generates and cryptographically verifies HMAC-signed voice context tokens", () => {
    const payload = {
      sessionId: "vcall_test_882",
      tenantId: "tenant_default",
      callerNumber: "+1 (415) 890-1234",
      verificationLevel: "authenticated" as const,
      allowedCapabilities: ["support.ticket.lookup", "support.problem.status"],
      expiresAt: Date.now() + 60000,
    };

    const token = signVoiceContextToken(payload);
    expect(token).toBeDefined();
    expect(token.includes(".")).toBe(true);

    const verified = verifyVoiceContextToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sessionId).toBe("vcall_test_882");
    expect(verified?.verificationLevel).toBe("authenticated");
  });

  it("enforces identity verification gates in voice capability manifest", () => {
    expect(verificationMeets("authenticated", "phone_match")).toBe(true);
    expect(verificationMeets("anonymous", "authenticated")).toBe(false);

    // Anonymous caller only gets public tools
    const anonTools = deriveAllowedVoiceTools("anonymous");
    expect(anonTools.some((t) => t.name === "support.problem.status")).toBe(true);
    expect(anonTools.some((t) => t.name === "support.account.unlock_request")).toBe(false);

    // Authenticated caller gets all tools
    const authTools = deriveAllowedVoiceTools("authenticated");
    expect(authTools.length).toBe(Object.keys(SUPPORT_VOICE_CAPABILITIES).length);
  });

  it("initiates inbound voice sessions and executes low-latency voice tools", async () => {
    const { session, contextToken, allowedTools } = await voiceService.startSession({
      tenantId: "tenant_default",
      provider: "vapi",
      callerNumber: "+1 (415) 999-0011",
      callerName: "Sarah Connor",
      verificationLevel: "authenticated",
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe("in_progress");
    expect(contextToken).toBeDefined();
    expect(allowedTools.length).toBeGreaterThan(0);

    const toolResult = await voiceService.executeVoiceTool({
      sessionId: session.id,
      toolName: "support.problem.status",
      input: { service: "Payment Gateway" },
    });

    expect(toolResult.success).toBe(true);
    expect(toolResult.latencyMs).toBeLessThan(1000);
    expect(toolResult.data.activeIncidentCount).toBeGreaterThanOrEqual(1);

    const updatedSession = voiceService.getSessions("tenant_default").find((s) => s.id === session.id);
    expect(updatedSession?.toolsInvoked.length).toBe(1);
    expect(updatedSession?.transcript.some((t) => t.role === "system")).toBe(true);
  });
});
