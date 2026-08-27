/**
 * supportV8 Marketplace, Governance & Member Types
 */

export interface MarketplaceConnector {
  id: string;
  name: string;
  category: "helpdesk" | "crm" | "telephony" | "commerce" | "devops" | "knowledge" | "storage";
  icon: string;
  description: string;
  tier: "included" | "pro" | "enterprise";
  isSubscribed: boolean;
  status: "active" | "available" | "configuring";
  syncFrequencyMinutes: number;
  eventsPerDay: number;
  endpointUrl?: string;
  configFields: Array<{
    key: string;
    label: string;
    type: "text" | "password" | "url";
    placeholder?: string;
    value?: string;
  }>;
}

export interface MarketplaceWorkforceItem {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  level: "ai_employee" | "ai_intern";
  priceMonthly: number;
  skills: string[];
  isHired: boolean;
  description: string;
  rating: number;
  hiredCount: number;
}

export interface MarketplacePlan {
  id: string;
  name: string;
  badge?: string;
  priceMonthly: number;
  priceAnnual: number;
  isCurrent: boolean;
  features: string[];
  slaCommitment: string;
  computeUnits: string;
  aiEmployeeSeats: number;
}

export interface TenantMember {
  id: string;
  name: string;
  email: string;
  role: "Owner / CX Director" | "CX Operations Lead" | "Tier 2 Escalation Agent" | "Security & Compliance Auditor";
  status: "active" | "invited" | "disabled";
  twoFactorEnabled: boolean;
  lastActive: string;
  avatarUrl: string;
}

export interface TenantSettingConfig {
  tenantId: string;
  workspaceName: string;
  workspaceSlug: string;
  operatingMode: "observe" | "copilot" | "autonomous";
  keycloakRealm: string;
  postgresRlsEnabled: boolean;
  redisTtlSeconds: number;
  webhookUrl: string;
  apiKey: string;
  dataRetentionDays: number;
  autoEscalateFrustrated: boolean;
  requireApprovalForBroadcast: boolean;

  // BYOM (Bring Your Own Model) Settings
  byomProvider: "anthropic" | "openai" | "google" | "groq" | "custom_ollama";
  byomModel: string;
  byomCustomEndpoint?: string;
  byomApiKey: string;
  byomTemperature: number;
  byomMaxTokens: number;

  // Vector Embedding Settings
  embeddingProvider: "openai" | "voyage" | "cohere" | "fastembed_local" | "custom_vector_endpoint";
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingSimilarityMetric: "cosine" | "inner_product" | "euclidean_l2";
  embeddingApiKey: string;
  embeddingChunkSize: number;
  embeddingChunkOverlap: number;

  // ForgeGW (Action Gateway) Settings
  forgeGwEndpoint: string;
  forgeGwApiKey: string;
  forgeGwRateLimitRpm: number;
  forgeGwTimeoutMs: number;
  forgeGwEnforceIdempotency: boolean;
  forgeGwMtlsEnabled: boolean;
}

export interface ComplianceAuditReport {
  id: string;
  generatedAt: string;
  period: string;
  totalInteractions: number;
  autonomousResolved: number;
  humanEscalations: number;
  hallucinationDriftScore: number;
  policyViolations: number;
  costSavedEstimatedUsd: number;
  slaAttainmentPct: number;
}

export interface TenantAuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  actorType: "ai_employee" | "human_admin" | "system_automation";
  actorAvatar?: string;
  operation: string;
  category: "action_gateway" | "auth_security" | "knowledge_graph" | "autonomy_policy" | "voice_telephony" | "membership" | "marketplace";
  targetEntityId: string;
  targetEntityType: "ticket" | "customer" | "user" | "article" | "connector" | "policy" | "voice_call";
  riskLevel: "read" | "low" | "medium" | "high" | "critical";
  status: "executed" | "awaiting_approval" | "approved" | "blocked" | "failed";
  confidence?: number;
  durationMs: number;
  ipAddress: string;
  sha256Hash: string;
  idempotencyKey: string;
  reasoning: string;
  metadata: Record<string, unknown>;
}
