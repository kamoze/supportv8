/**
 * supportV8 Voice Integration Types
 * Based on GrowthV8 Voice Architecture & ServiceV8 Standards
 */

export type VoiceProvider = "vapi" | "retell" | "twilio" | "bland";
export type VoiceServiceMode = "customer" | "official";
export type VoiceVerificationLevel = "anonymous" | "phone_match" | "otp_verified" | "authenticated";

export interface VoicePhoneConfig {
  id: string;
  tenantId: string;
  phoneNumber: string;
  provider: VoiceProvider;
  serviceMode: VoiceServiceMode;
  agentName: string;
  voiceId: string;
  systemPrompt: string;
  minVerificationLevel: VoiceVerificationLevel;
  isActive: boolean;
  lastCallAt?: string;
}

export interface VoiceSession {
  id: string;
  tenantId: string;
  provider: VoiceProvider;
  providerCallRef: string;
  callerNumber: string;
  callerName?: string;
  customerTier: "standard" | "pro" | "enterprise";
  verificationLevel: VoiceVerificationLevel;
  status: "ringing" | "in_progress" | "completed" | "transferred" | "failed";
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  sentiment: "positive" | "neutral" | "frustrated" | "urgent";
  transcript: Array<{ role: "assistant" | "user" | "system"; text: string; timestamp: string }>;
  derivedIssueId?: string;
  linkedProblemId?: string;
  toolsInvoked: Array<{ tool: string; input: Record<string, unknown>; output: Record<string, unknown>; latencyMs: number }>;
}

export interface VoiceContextTokenPayload {
  sessionId: string;
  tenantId: string;
  callerNumber: string;
  verificationLevel: VoiceVerificationLevel;
  allowedCapabilities: string[];
  expiresAt: number;
}
