/**
 * supportV8 Voice Interaction Service
 * Manages voice phone configurations, live telephony sessions,
 * real-time function calling, and remote-to-local agent matching.
 * References GrowthV8 Vapi & Twilio provisioning architecture.
 */

import { signVoiceContextToken } from "./context-token";
import { deriveAllowedVoiceTools, SUPPORT_VOICE_CAPABILITIES, verificationMeets } from "./capability-manifest";
import type {
  VoicePhoneConfig,
  VoiceSession,
  VoiceVerificationLevel,
  VoiceProvisioningRequest,
  VoiceProvisioningResult,
  VoicePermissionScope,
} from "./types";
import { db } from "../db/mock-data";
import { workforceManager } from "../workforce";
import { globalActionGateway } from "../runtime/action-gateway-client";
import { kv8RetrievalEngine } from "../rag/retrieval";

export const INITIAL_PHONE_CONFIGS: VoicePhoneConfig[] = [
  {
    id: "phone_01",
    tenantId: "tenant_default",
    phoneNumber: "+1 (800) 555-0199",
    provider: "vapi",
    serviceMode: "customer",
    agentName: "Alex — Support Voice AI",
    employeeId: "emp_support_lead",
    employeeName: "Alex — Support Intelligence Lead",
    remoteAgentId: "asst_vapi_alex_prod_9941a8",
    remotePhoneNumberId: "phone_vapi_us_88412",
    voiceId: "jennifer-neural-v2",
    systemPrompt: "You are Alex, an enterprise support AI for Acme Cloud. Answer questions concisely, check status outages, and resolve issues or escalate smoothly.",
    firstMessage: "Thank you for calling Acme Enterprise Support. I am Alex. How can I assist with your infrastructure today?",
    minVerificationLevel: "phone_match",
    permissionScopes: [
      "support.problem.status",
      "support.ticket.lookup",
      "support.ticket.create",
      "knowledge.rag.search",
    ],
    webhookUrl: "https://api.supportv8.io/api/voice/webhook",
    syncStatus: "synced",
    lastSyncedAt: "2026-08-27T22:00:00.000Z",
    isActive: true,
    lastCallAt: "4 mins ago",
  },
  {
    id: "phone_02",
    tenantId: "tenant_default",
    phoneNumber: "+1 (888) 420-7711",
    provider: "twilio",
    serviceMode: "official",
    agentName: "Maya — Incident Voice Bot",
    employeeId: "emp_incident_analyst",
    employeeName: "Maya — Incident & Business Impact Analyst",
    remoteAgentId: "flow_tw_maya_inc_8820f1",
    remotePhoneNumberId: "PN_twilio_sip_19842",
    voiceId: "marcus-telephony-v1",
    systemPrompt: "You are Maya, Incident Support Voice Assistant for Acme Enterprise customers. Track live incident status and broadcast updates.",
    firstMessage: "Acme Incident Hotline. I am Maya, monitoring active systemic outages and priority escalations.",
    minVerificationLevel: "otp_verified",
    permissionScopes: [
      "support.problem.status",
      "support.ticket.create",
      "comms.broadcast",
    ],
    webhookUrl: "https://api.supportv8.io/api/voice/webhook",
    syncStatus: "synced",
    lastSyncedAt: "2026-08-27T22:15:00.000Z",
    isActive: true,
    lastCallAt: "18 mins ago",
  },
  {
    id: "phone_03",
    tenantId: "tenant_default",
    phoneNumber: "+1 (800) 772-9100",
    provider: "vapi",
    serviceMode: "customer",
    agentName: "Sophia — Frontline Conversational Agent",
    employeeId: "emp_voice_specialist",
    employeeName: "Sophia — Frontline Voice & Conversational Lead",
    remoteAgentId: "asst_vapi_sophia_live_4412c9",
    remotePhoneNumberId: "phone_vapi_tollfree_6621",
    voiceId: "sophia-conversational-v3",
    systemPrompt: "You are Sophia, frontline conversational support specialist. Triage inbound callers, perform account unlocks, verify caller PINs, and issue refunds within authorized limits.",
    firstMessage: "Hi there! I am Sophia from Acme Cloud Support. How can I help you today?",
    minVerificationLevel: "phone_match",
    permissionScopes: [
      "support.problem.status",
      "support.ticket.lookup",
      "support.ticket.create",
      "support.account.unlock_request",
      "knowledge.rag.search",
      "orderv8.refund",
    ],
    webhookUrl: "https://api.supportv8.io/api/voice/webhook",
    syncStatus: "synced",
    lastSyncedAt: "2026-08-27T22:30:00.000Z",
    isActive: true,
    lastCallAt: "35 mins ago",
  },
];

export const INITIAL_VOICE_SESSIONS: VoiceSession[] = [
  {
    id: "vcall_101",
    tenantId: "tenant_default",
    provider: "vapi",
    providerCallRef: "call_vapi_9941a8",
    callerNumber: "+1 (415) 890-1234",
    callerName: "Marcus Vance",
    customerTier: "enterprise",
    verificationLevel: "authenticated",
    status: "completed",
    startedAt: "2026-08-26T04:45:00.000Z",
    endedAt: "2026-08-26T04:47:30.000Z",
    durationSeconds: 150,
    sentiment: "frustrated",
    transcript: [
      { role: "assistant", text: "Thank you for calling Acme Support. I'm Alex. How can I help you today?", timestamp: "00:02" },
      { role: "user", text: "Our engineering team cannot log in through Okta SSO right now. Is SAML down?", timestamp: "00:08" },
      { role: "assistant", text: "Let me check our active system status for SAML SSO.", timestamp: "00:12" },
      { role: "system", text: "[Tool Call: support.problem.status(service: 'Okta SAML 2.0') -> Active Incident PRB-219]", timestamp: "00:13" },
      { role: "assistant", text: "Yes Marcus, our operations team is currently mitigating an active incident (PRB-219) regarding Okta SAML 2.0 assertion validation. A fix is being deployed within 20 minutes.", timestamp: "00:18" },
      { role: "user", text: "Thank you for the fast confirmation. I will let the team know.", timestamp: "00:24" },
    ],
    derivedIssueId: "iss_4",
    linkedProblemId: "PRB-219",
    toolsInvoked: [
      {
        tool: "support.problem.status",
        input: { service: "Okta SAML 2.0" },
        output: { status: "mitigating", problemId: "PRB-219", etaMinutes: 20 },
        latencyMs: 140,
      },
    ],
  },
];

export class VoiceService {
  private phoneConfigs: VoicePhoneConfig[] = [...INITIAL_PHONE_CONFIGS];
  private sessions: VoiceSession[] = [...INITIAL_VOICE_SESSIONS];

  public getPhoneConfigs(tenantId: string): VoicePhoneConfig[] {
    return this.phoneConfigs.filter((p) => p.tenantId === tenantId);
  }

  public getSessions(tenantId: string): VoiceSession[] {
    return [...this.sessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public getPhoneConfigById(configId: string): VoicePhoneConfig | undefined {
    return this.phoneConfigs.find((p) => p.id === configId);
  }

  /**
   * Provision a voice bot connection via Vapi or Twilio API,
   * matching remote agent to the local AI Employee.
   */
  public async provisionVoiceAgent(request: VoiceProvisioningRequest): Promise<VoiceProvisioningResult> {
    const {
      tenantId,
      employeeId,
      provider,
      phoneNumber,
      phoneMode = "vapi_managed",
      voiceId = "jennifer-neural-v2",
      systemPrompt,
      firstMessage,
      minVerificationLevel = "phone_match",
      permissionScopes = [
        "support.problem.status",
        "support.ticket.lookup",
        "support.ticket.create",
        "knowledge.rag.search",
      ],
    } = request;

    // 1. Resolve Local AI Employee
    const localEmployee = workforceManager.getById(employeeId);
    const employeeName = localEmployee?.name || "AI Employee";

    // 2. Generate Remote Agent Matching ID based on Provider
    const remoteAgentId =
      provider === "vapi"
        ? `asst_vapi_${employeeId.replace("emp_", "")}_${Date.now().toString(36)}`
        : `flow_tw_${employeeId.replace("emp_", "")}_${Date.now().toString(36)}`;

    const remotePhoneNumberId =
      provider === "vapi"
        ? `phone_vapi_${Math.random().toString(36).slice(2, 8)}`
        : `PN_twilio_sip_${Math.random().toString(36).slice(2, 8)}`;

    const configId = `phone_${Date.now().toString(36)}`;
    const effectivePrompt =
      systemPrompt ||
      `You are ${localEmployee?.name || "Support AI"}, representing Acme Enterprise Support. Handle customer inquiries with pgvector knowledge grounding and tool executions.`;
    const effectiveFirstMessage =
      firstMessage ||
      `Hello! Thank you for calling Acme Support. I am ${localEmployee?.name?.split("—")[0]?.trim() || "your AI Assistant"}. How can I assist you today?`;

    const newConfig: VoicePhoneConfig = {
      id: configId,
      tenantId,
      phoneNumber,
      provider,
      serviceMode: "customer",
      agentName: `${localEmployee?.name?.split("—")[0]?.trim() || "AI"} Voice Agent`,
      employeeId,
      employeeName,
      remoteAgentId,
      remotePhoneNumberId,
      voiceId,
      systemPrompt: effectivePrompt,
      firstMessage: effectiveFirstMessage,
      minVerificationLevel,
      permissionScopes,
      webhookUrl: "https://api.supportv8.io/api/voice/webhook",
      syncStatus: "synced",
      lastSyncedAt: new Date().toISOString(),
      isActive: true,
      lastCallAt: "Just now",
    };

    // Remove any existing config with the same phone number for this tenant
    this.phoneConfigs = this.phoneConfigs.filter((p) => p.phoneNumber !== phoneNumber);
    this.phoneConfigs.unshift(newConfig);

    return {
      success: true,
      message: `Voice Bot successfully provisioned via ${provider.toUpperCase()} API and matched to local employee ${employeeName} (Remote ID: ${remoteAgentId}).`,
      config: newConfig,
      remoteAgentId,
      remotePhoneNumberId,
      matchedLocalEmployee: {
        id: employeeId,
        name: employeeName,
        role: localEmployee?.role || "Support AI",
      },
    };
  }

  /**
   * Re-sync remote provider configuration with local AI employee state
   */
  public async syncVoiceAgent(configId: string): Promise<{ success: boolean; message: string; config?: VoicePhoneConfig }> {
    const config = this.getPhoneConfigById(configId);
    if (!config) {
      return { success: false, message: `Voice config '${configId}' not found.` };
    }

    config.syncStatus = "synced";
    config.lastSyncedAt = new Date().toISOString();

    return {
      success: true,
      message: `Re-synchronized remote ${config.provider.toUpperCase()} agent (${config.remoteAgentId}) with local employee (${config.employeeName}).`,
      config,
    };
  }

  /**
   * Update granted permission scopes on provisioned voice bot
   */
  public updatePermissions(configId: string, scopes: VoicePermissionScope[]): { success: boolean; config?: VoicePhoneConfig } {
    const config = this.getPhoneConfigById(configId);
    if (!config) return { success: false };

    config.permissionScopes = scopes;
    config.lastSyncedAt = new Date().toISOString();
    return { success: true, config };
  }

  /**
   * Update full voice agent configuration
   */
  public updateVoiceAgent(
    configId: string,
    updates: Partial<VoicePhoneConfig>
  ): { success: boolean; message: string; config?: VoicePhoneConfig } {
    const config = this.getPhoneConfigById(configId);
    if (!config) {
      return { success: false, message: `Voice config '${configId}' not found.` };
    }

    if (updates.employeeId && updates.employeeId !== config.employeeId) {
      const localEmployee = workforceManager.getById(updates.employeeId);
      config.employeeId = updates.employeeId;
      config.employeeName = localEmployee?.name || updates.employeeName || config.employeeName;
    }

    if (updates.phoneNumber !== undefined) config.phoneNumber = updates.phoneNumber;
    if (updates.provider !== undefined) config.provider = updates.provider;
    if (updates.serviceMode !== undefined) config.serviceMode = updates.serviceMode;
    if (updates.agentName !== undefined) config.agentName = updates.agentName;
    if (updates.voiceId !== undefined) config.voiceId = updates.voiceId;
    if (updates.systemPrompt !== undefined) config.systemPrompt = updates.systemPrompt;
    if (updates.firstMessage !== undefined) config.firstMessage = updates.firstMessage;
    if (updates.minVerificationLevel !== undefined) config.minVerificationLevel = updates.minVerificationLevel;
    if (updates.permissionScopes !== undefined) config.permissionScopes = updates.permissionScopes;
    if (updates.isActive !== undefined) config.isActive = updates.isActive;

    config.syncStatus = "synced";
    config.lastSyncedAt = new Date().toISOString();

    return {
      success: true,
      message: `Voice Agent '${config.agentName}' (${config.phoneNumber}) updated successfully.`,
      config,
    };
  }

  /**
   * Delete / un-provision a voice agent
   */
  public deleteVoiceAgent(configId: string): { success: boolean; message: string } {
    const initialLen = this.phoneConfigs.length;
    this.phoneConfigs = this.phoneConfigs.filter((p) => p.id !== configId);
    if (this.phoneConfigs.length === initialLen) {
      return { success: false, message: `Voice config '${configId}' not found.` };
    }

    return {
      success: true,
      message: `Voice Agent '${configId}' deleted and disconnected from telephony carrier.`,
    };
  }

  public async startSession(params: {
    tenantId: string;
    provider: "vapi" | "retell" | "twilio" | "bland";
    callerNumber: string;
    callerName?: string;
    verificationLevel?: VoiceVerificationLevel;
    customerTier?: "standard" | "pro" | "enterprise";
  }): Promise<{ session: VoiceSession; contextToken: string; allowedTools: string[] }> {
    const {
      tenantId,
      provider,
      callerNumber,
      callerName = "Caller " + callerNumber.slice(-4),
      verificationLevel = "phone_match",
      customerTier = "enterprise",
    } = params;

    const allowedTools = deriveAllowedVoiceTools(verificationLevel).map((t) => t.name);
    const sessionId = `vcall_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const session: VoiceSession = {
      id: sessionId,
      tenantId,
      provider,
      providerCallRef: `call_${provider}_${Date.now()}`,
      callerNumber,
      callerName,
      customerTier,
      verificationLevel,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      sentiment: "neutral",
      transcript: [
        {
          role: "assistant",
          text: `Hello ${callerName}, thank you for calling Acme Cloud Support. How can I assist you today?`,
          timestamp: "00:01",
        },
      ],
      toolsInvoked: [],
    };

    const token = signVoiceContextToken({
      sessionId,
      tenantId,
      callerNumber,
      verificationLevel,
      allowedCapabilities: allowedTools,
      expiresAt: Date.now() + 3600 * 1000,
    });

    this.sessions.unshift(session);
    return { session, contextToken: token, allowedTools };
  }

  public async executeVoiceTool(params: {
    sessionId: string;
    toolName: string;
    input: Record<string, unknown>;
  }): Promise<{ success: boolean; data: Record<string, unknown>; latencyMs: number }> {
    const start = Date.now();
    const { sessionId, toolName, input } = params;
    const session = this.sessions.find((s) => s.id === sessionId);
    const cap = SUPPORT_VOICE_CAPABILITIES[toolName];

    if (!cap) throw new Error(`Unknown voice tool '${toolName}'`);

    let output: Record<string, unknown> = {};

    if (toolName === "support.problem.status") {
      const activeProblems = db.problems.filter((p) => p.status !== "resolved");
      output = {
        activeIncidentCount: activeProblems.length,
        incidents: activeProblems.map((p) => ({
          id: p.id,
          title: p.title,
          impact: p.impact,
          status: p.status,
        })),
      };
    } else if (toolName === "support.ticket.lookup") {
      const issues = db.issues.slice(0, 3);
      output = {
        foundCount: issues.length,
        tickets: issues.map((i) => ({ id: i.externalId, summary: i.summary, sentiment: i.sentiment })),
      };
    } else if (toolName === "support.ticket.create") {
      const ticketId = `ZD-${Math.floor(100000 + Math.random() * 900000)}`;
      output = {
        created: true,
        ticketId,
        message: `Support ticket ${ticketId} created and assigned to triage queue.`,
      };
    } else if (toolName === "support.account.unlock_request") {
      output = {
        unlocked: true,
        message: "Account MFA lockout successfully cleared. You may now log in.",
      };
    } else if (toolName === "knowledge.rag.search") {
      output = {
        resultsCount: 2,
        documents: [
          { title: "Okta SAML SSO Configuration Guide", section: "Assertion Validation", score: 0.94 },
          { title: "PostgreSQL Connection Pooling Guide", section: "PgBouncer Resiliency", score: 0.89 },
        ],
      };
    } else if (toolName === "orderv8.refund") {
      output = {
        refundIssued: true,
        amountUsd: input.amountUsd || 150.0,
        status: "processed",
        reference: "ref_orderv8_" + Date.now().toString(36),
      };
    }

    const latencyMs = Date.now() - start;

    if (session) {
      session.toolsInvoked.push({
        tool: toolName,
        input,
        output,
        latencyMs,
      });
      session.transcript.push({
        role: "system",
        text: `[Tool Executed: ${toolName} in ${latencyMs}ms]`,
        timestamp: "00:15",
      });
    }

    return { success: true, data: output, latencyMs };
  }
}

export const voiceService = new VoiceService();
