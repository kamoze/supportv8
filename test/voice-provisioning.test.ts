import { describe, it, expect } from "vitest";
import { voiceService } from "../src/lib/voice/voice-service";

describe("Voice Telephony Bot Provisioning & Remote-to-Local Agent Matching (GrowthV8 Architecture)", () => {
  it("should provision a Vapi voice bot matched to a local AI Employee", async () => {
    const result = await voiceService.provisionVoiceAgent({
      tenantId: "tenant_default",
      employeeId: "emp_voice_specialist",
      provider: "vapi",
      phoneNumber: "+1 (800) 882-9900",
      phoneMode: "vapi_managed",
      voiceId: "sophia-neural-v2",
      systemPrompt: "You are Sophia, frontline conversational support specialist for Acme Cloud.",
      firstMessage: "Hi there! I am Sophia from Acme Support. How can I help you today?",
      minVerificationLevel: "phone_match",
      permissionScopes: [
        "support.problem.status",
        "support.ticket.lookup",
        "support.ticket.create",
        "support.account.unlock_request",
        "knowledge.rag.search",
        "orderv8.refund",
      ],
    });

    expect(result.success).toBe(true);
    expect(result.remoteAgentId).toContain("asst_vapi_voice_specialist");
    expect(result.config?.phoneNumber).toBe("+1 (800) 882-9900");
    expect(result.config?.provider).toBe("vapi");
    expect(result.config?.employeeId).toBe("emp_voice_specialist");
    expect(result.matchedLocalEmployee?.name).toContain("Sophia");
    expect(result.config?.permissionScopes).toHaveLength(6);
    expect(result.config?.syncStatus).toBe("synced");
  });

  it("should provision a Twilio voice bot matched to Maya Incident Analyst", async () => {
    const result = await voiceService.provisionVoiceAgent({
      tenantId: "tenant_default",
      employeeId: "emp_incident_analyst",
      provider: "twilio",
      phoneNumber: "+1 (888) 991-0022",
      phoneMode: "twilio_sip",
      voiceId: "maya-telephony-v2",
      systemPrompt: "You are Maya, Incident Support Voice Assistant for Acme Enterprise customers.",
      firstMessage: "Acme Incident Hotline. I am Maya, monitoring active systemic outages.",
      minVerificationLevel: "otp_verified",
      permissionScopes: [
        "support.problem.status",
        "support.ticket.create",
        "comms.broadcast",
      ],
    });

    expect(result.success).toBe(true);
    expect(result.remoteAgentId).toContain("flow_tw_incident_analyst");
    expect(result.config?.provider).toBe("twilio");
    expect(result.config?.employeeId).toBe("emp_incident_analyst");
    expect(result.matchedLocalEmployee?.name).toContain("Maya");
  });

  it("should re-sync remote voice agent with local AI employee", async () => {
    const configs = voiceService.getPhoneConfigs("tenant_default");
    expect(configs.length).toBeGreaterThan(0);
    const target = configs[0];

    const syncRes = await voiceService.syncVoiceAgent(target.id);
    expect(syncRes.success).toBe(true);
    expect(syncRes.message).toContain("Re-synchronized remote");
    expect(syncRes.config?.syncStatus).toBe("synced");
    expect(syncRes.config?.lastSyncedAt).toBeDefined();
  });

  it("should update granted permission scopes on an active voice connection", () => {
    const configs = voiceService.getPhoneConfigs("tenant_default");
    const target = configs[0];

    const updateRes = voiceService.updatePermissions(target.id, [
      "support.problem.status",
      "knowledge.rag.search",
    ]);

    expect(updateRes.success).toBe(true);
    expect(updateRes.config?.permissionScopes).toEqual([
      "support.problem.status",
      "knowledge.rag.search",
    ]);
  });

  it("should execute authorized voice tools during a live phone session", async () => {
    const startRes = await voiceService.startSession({
      tenantId: "tenant_default",
      provider: "vapi",
      callerNumber: "+1 (415) 890-1234",
      callerName: "Marcus Vance",
      verificationLevel: "authenticated",
      customerTier: "enterprise",
    });

    expect(startRes.session.id).toBeDefined();
    expect(startRes.contextToken).toBeDefined();
    expect(startRes.allowedTools.length).toBeGreaterThan(0);

    // Execute authorized tool: support.problem.status
    const toolExec = await voiceService.executeVoiceTool({
      sessionId: startRes.session.id,
      toolName: "support.problem.status",
      input: { service: "Okta SAML 2.0" },
    });

    expect(toolExec.success).toBe(true);
    expect(toolExec.data.activeIncidentCount).toBeDefined();

    // Execute refund tool
    const refundExec = await voiceService.executeVoiceTool({
      sessionId: startRes.session.id,
      toolName: "orderv8.refund",
      input: { amountUsd: 250.0 },
    });

    expect(refundExec.success).toBe(true);
    expect(refundExec.data.refundIssued).toBe(true);
    expect(refundExec.data.amountUsd).toBe(250.0);
  });

  it("should update full voice agent configuration parameters", () => {
    const configs = voiceService.getPhoneConfigs("tenant_default");
    const target = configs[0];

    const updateRes = voiceService.updateVoiceAgent(target.id, {
      agentName: "Sophia — Senior Voice Director",
      phoneNumber: "+1 (800) 999-1122",
      serviceMode: "official",
      systemPrompt: "Updated conversational guardrails for enterprise VIP queue.",
      isActive: false,
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.config?.agentName).toBe("Sophia — Senior Voice Director");
    expect(updateRes.config?.phoneNumber).toBe("+1 (800) 999-1122");
    expect(updateRes.config?.serviceMode).toBe("official");
    expect(updateRes.config?.systemPrompt).toContain("enterprise VIP queue");
    expect(updateRes.config?.isActive).toBe(false);
  });

  it("should delete a voice agent connection and remove it from active lines", () => {
    // Provision a temporary agent to delete
    const tempConfigId = "cfg_voice_to_delete";
    const configsBefore = voiceService.getPhoneConfigs("tenant_default");
    const initialCount = configsBefore.length;

    const deleteRes = voiceService.deleteVoiceAgent(configsBefore[0].id);
    expect(deleteRes.success).toBe(true);
    expect(deleteRes.message).toContain("deleted and disconnected");

    const configsAfter = voiceService.getPhoneConfigs("tenant_default");
    expect(configsAfter.length).toBe(initialCount - 1);
  });
});
