/**
 * supportV8 Voice Integration Types
 * Based on GrowthV8 Voice Architecture & ServiceV8 Standards
 * Implements remote-to-local agent matching, permissions scoping, and API provisioning.
 */

export type VoiceProvider = "vapi" | "retell" | "twilio" | "bland";
export type VoiceServiceMode = "customer" | "official";
export type VoiceVerificationLevel = "anonymous" | "phone_match" | "otp_verified" | "authenticated";

export type VoicePermissionScope =
  | "support.problem.status"
  | "support.ticket.lookup"
  | "support.ticket.create"
  | "support.account.unlock_request"
  | "knowledge.rag.search"
  | "orderv8.refund"
  | "comms.broadcast";

export interface VoicePhoneConfig {
  id: string;
  tenantId: string;
  phoneNumber: string;
  provider: VoiceProvider;
  serviceMode: VoiceServiceMode;
  agentName: string;
  employeeId: string;
  employeeName?: string;
  remoteAgentId: string;
  remotePhoneNumberId?: string;
  voiceId: string;
  systemPrompt: string;
  firstMessage?: string;
  minVerificationLevel: VoiceVerificationLevel;
  permissionScopes: VoicePermissionScope[];
  webhookUrl?: string;
  syncStatus: "synced" | "pending" | "failed";
  lastSyncedAt?: string;
  isActive: boolean;
  lastCallAt?: string;
}

export interface VoiceProvisioningRequest {
  tenantId: string;
  employeeId: string;
  provider: VoiceProvider;
  phoneNumber: string;
  phoneMode?: "vapi_managed" | "vapi_existing" | "twilio_sip";
  voiceId?: string;
  systemPrompt?: string;
  firstMessage?: string;
  minVerificationLevel?: VoiceVerificationLevel;
  permissionScopes?: VoicePermissionScope[];
}

export interface VoiceProvisioningResult {
  success: boolean;
  message: string;
  config?: VoicePhoneConfig;
  remoteAgentId?: string;
  remotePhoneNumberId?: string;
  matchedLocalEmployee?: {
    id: string;
    name: string;
    role: string;
  };
  error?: string;
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
