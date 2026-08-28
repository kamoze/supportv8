/**
 * supportV8 Voice Capability Manifest & Tool Derivation
 * Directly based on GrowthV8 Voice Architecture (src/voice/capability-manifest.ts).
 */

import type { VoiceVerificationLevel } from "./types";

export interface VoiceCapabilityDefinition {
  version: number;
  mode: "synchronous" | "asynchronous";
  timeoutMs: number;
  requiresIdentityLevel: VoiceVerificationLevel;
  description: string;
  parameters: Record<string, unknown>;
}

export const VERIFICATION_RANK: Record<VoiceVerificationLevel, number> = {
  anonymous: 0,
  phone_match: 1,
  otp_verified: 2,
  authenticated: 3,
};

export const SUPPORT_VOICE_CAPABILITIES: Record<string, VoiceCapabilityDefinition> = {
  "support.ticket.lookup": {
    version: 1,
    mode: "synchronous",
    timeoutMs: 1200,
    requiresIdentityLevel: "phone_match",
    description: "Look up open customer support tickets by phone number or ticket ID",
    parameters: {
      type: "object",
      properties: {
        ticketId: { type: "string", description: "Optional specific ticket ID (e.g. ZD-884233)" },
      },
    },
  },
  "support.problem.status": {
    version: 1,
    mode: "synchronous",
    timeoutMs: 1000,
    requiresIdentityLevel: "anonymous",
    description: "Check active systemic outages and incident status (e.g. Checkout 504, SAML SSO)",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service or topic name to query status for" },
      },
    },
  },
  "support.ticket.create": {
    version: 1,
    mode: "synchronous",
    timeoutMs: 1500,
    requiresIdentityLevel: "phone_match",
    description: "Create a new support incident or escalation ticket",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Detailed description of customer issue" },
        urgency: { type: "string", enum: ["normal", "high", "urgent"] },
      },
      required: ["summary"],
    },
  },
  "support.ticket.escalate": {
    version: 1,
    mode: "synchronous",
    timeoutMs: 1200,
    requiresIdentityLevel: "phone_match",
    description: "Escalate existing ticket to human Tier 2 support agent or engineering on-call",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Reason for escalation" },
      },
      required: ["reason"],
    },
  },
  "support.account.unlock_request": {
    version: 1,
    mode: "synchronous",
    timeoutMs: 1500,
    requiresIdentityLevel: "otp_verified",
    description: "Trigger secure account unlock after identity OTP verification",
    parameters: {
      type: "object",
      properties: {
        otpCode: { type: "string", description: "6-digit identity OTP verification code" },
      },
      required: ["otpCode"],
    },
  },
  "knowledge.rag.search": {
    version: 1,
    mode: "synchronous",
    timeoutMs: 1200,
    requiresIdentityLevel: "anonymous",
    description: "Semantic pgvector retrieval across indexed enterprise support articles and runbooks",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query or troubleshooting symptom" },
      },
      required: ["query"],
    },
  },
  "orderv8.refund": {
    version: 1,
    mode: "synchronous",
    timeoutMs: 2000,
    requiresIdentityLevel: "authenticated",
    description: "Autonomous refund execution for disputed charges under authorized financial thresholds",
    parameters: {
      type: "object",
      properties: {
        amountUsd: { type: "number", description: "Refund amount in USD" },
        reason: { type: "string", description: "Reason for refund" },
      },
      required: ["amountUsd"],
    },
  },
  "comms.broadcast": {
    version: 1,
    mode: "synchronous",
    timeoutMs: 1500,
    requiresIdentityLevel: "otp_verified",
    description: "Broadcast proactive incident notification to affected customers",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email / SMS subject line" },
        body: { type: "string", description: "Incident notification body text" },
      },
      required: ["subject", "body"],
    },
  },
};

export function verificationMeets(actual: VoiceVerificationLevel, required: VoiceVerificationLevel): boolean {
  return VERIFICATION_RANK[actual] >= VERIFICATION_RANK[required];
}

export function deriveAllowedVoiceTools(callerLevel: VoiceVerificationLevel): Array<{
  name: string;
  definition: VoiceCapabilityDefinition;
}> {
  return Object.entries(SUPPORT_VOICE_CAPABILITIES)
    .filter(([_, cap]) => verificationMeets(callerLevel, cap.requiresIdentityLevel))
    .map(([name, definition]) => ({ name, definition }));
}
