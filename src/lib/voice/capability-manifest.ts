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
