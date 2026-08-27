/**
 * supportV8 Voice Interaction Service
 * Manages voice phone configurations, live telephony sessions,
 * real-time function calling, and post-call issue derivation.
 */

import { signVoiceContextToken } from "./context-token";
import { deriveAllowedVoiceTools, SUPPORT_VOICE_CAPABILITIES, verificationMeets } from "./capability-manifest";
import type { VoicePhoneConfig, VoiceSession, VoiceVerificationLevel } from "./types";
import { db } from "../db/mock-data";
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
    voiceId: "jennifer-neural-v2",
    systemPrompt: "You are Alex, an enterprise support AI for Acme Cloud. Answer questions concisely, check status outages, and resolve issues or escalate smoothly.",
    minVerificationLevel: "phone_match",
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
    voiceId: "marcus-telephony-v1",
    systemPrompt: "You are Maya, Incident Support Voice Assistant for Acme Enterprise customers.",
    minVerificationLevel: "otp_verified",
    isActive: true,
    lastCallAt: "18 mins ago",
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
