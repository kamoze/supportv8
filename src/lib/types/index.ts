/**
 * supportV8 — Domain Types and Data Contracts
 * Basis: supportV8 Product Design Specification v0.3
 */

export type OperatingMode = "observe" | "copilot" | "autonomous";

export type SentimentClass = "positive" | "neutral" | "frustrated" | "angry" | "urgent";

export type PriorityLevel = "low" | "normal" | "high" | "urgent";

export type BusinessImpactLevel = "low" | "medium" | "high" | "critical";

export type ProblemStatus = "detecting" | "active" | "investigating" | "mitigating" | "resolved";

export type SourceType = "zendesk" | "intercom" | "freshdesk" | "twilio_voice" | "email" | "chat" | "knowledgev8";

export type ConnectorHealth = "connected" | "degraded" | "auth_failed" | "rate_limited" | "sync_failed" | "disconnected";

export interface TenantConfig {
  tenantId: string;
  name: string;
  mode: OperatingMode;
  featureFlags: {
    observeMode: boolean;
    copilotMode: boolean;
    autonomousMode: boolean;
    problemCorrelation: boolean;
    businessImpact: boolean;
    knowledgeIntelligence: boolean;
    proactiveComms: boolean;
    staleWorkSweep: boolean;
  };
}

export interface InteractionEvent {
  event: "interaction.started" | "interaction.message.received" | "interaction.completed" | "interaction.action.dispatched";
  tenant_id: string;
  interaction_id: string;
  session_id: string;
  channel: string;
  source: SourceType;
  source_reference: string;
  customer_reference: string;
  timestamp: string;
  correlation_id: string;
  causation_id?: string;
  content: {
    type: "text" | "transcript" | "action";
    text: string;
    sender: "customer" | "agent" | "ai_employee" | "system";
    metadata?: Record<string, unknown>;
  };
}

export interface SupportCustomerContext {
  id: string;
  name: string;
  email: string;
  account: string;
  tier: "standard" | "pro" | "enterprise";
  arr: number;
  openIssuesCount: number;
  sentimentHistory: SentimentClass[];
}

export interface EphemeralSupportContext {
  interactionId: string;
  customer: SupportCustomerContext;
  currentInteraction: {
    intent: string;
    sentiment: SentimentClass;
    sentimentScore: number;
    urgency: PriorityLevel;
    likelyCategory: string;
    confidence: number;
  };
  business: {
    accountTier: string;
    arr: number;
    slaTargetMin: number;
    slaStatus: "healthy" | "warning" | "breached";
  };
  activeProblems: Array<{
    id: string;
    title: string;
    impact: BusinessImpactLevel;
    confidence: number;
  }>;
  knowledgeSnippets: Array<{
    id: string;
    title: string;
    snippet: string;
    sourceUrl: string;
  }>;
  availableActions: string[];
  ttlSeconds: number;
  createdAt: string;
}

export interface Issue {
  id: string;
  tenantId: string;
  source: SourceType;
  externalId: string;
  sourceUrl: string;
  customerRef: string;
  customerName: string;
  customerTier: "standard" | "pro" | "enterprise";
  summary: string;
  category: string;
  product: string;
  version: string;
  sentiment: SentimentClass;
  sentimentScore: number;
  sentimentTrajectory: "improving" | "stable" | "deteriorating";
  priority: PriorityLevel;
  confidence: number;
  businessImpact: BusinessImpactLevel;
  problemId?: string;
  sourceStatus: "open" | "pending" | "solved" | "closed";
  resolutionRiskScore: number;
  recommendedAction?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Problem {
  id: string;
  tenantId: string;
  title: string;
  summary: string;
  suspectedCause: string;
  status: ProblemStatus;
  confidence: number;
  impact: BusinessImpactLevel;
  affectedCustomerCount: number;
  affectedEnterpriseCount: number;
  linkedIssueIds: string[];
  estimatedRevenueExposure: number;
  firstSeen: string;
  lastSeen: string;
  trend: "increasing" | "stable" | "decreasing";
  owner: string;
  recommendedActions: string[];
  communicationsCount: number;
  verificationState: "unverified" | "in_progress" | "verified";
  sourceSystems: SourceType[];
}

export interface Insight {
  id: string;
  tenantId: string;
  title: string;
  finding: string;
  evidence: string[];
  confidence: number;
  affectedSegment: string;
  businessImpact: BusinessImpactLevel;
  likelyDriver: string;
  recommendation: string;
  recommendedOperation?: string;
  actionPayload?: Record<string, unknown>;
  status: "new" | "reviewed" | "actioned" | "dismissed";
  createdAt: string;
}

export interface KnowledgeDocument {
  id: string;
  tenantId: string;
  filename: string;
  fileType: string;
  fileSizeBytes: number;
  s3Key: string;
  s3Url: string;
  category: string;
  title: string;
  chunkCount: number;
  status: "indexed" | "processing" | "failed";
  uploadedAt: string;
  summary: string;
  body?: string;
  groups?: string[];
  tags?: string[];
  curatedConceptId?: string;
  curatedStatus?: "raw" | "in_review" | "curated" | "authoritative";
}

export interface KnowledgeDocumentChunk {
  id: string;
  documentId: string;
  tenantId: string;
  chunkIndex: number;
  content: string;
  section?: string;
  weight?: number;
  tokenCount?: number;
  updatedAt?: string;
  embedding: number[];
}

export interface KnowledgeWebSource {
  id: string;
  tenantId: string;
  url: string;
  title: string;
  category: string;
  crawlDepth: number;
  pageCount: number;
  chunkCount: number;
  status: "indexed" | "crawling" | "failed";
  lastCrawledAt: string;
  s3SnapshotUrl?: string;
  summary: string;
}

export interface KnowledgeArticle {
  id: string;
  source: string;
  title: string;
  url: string;
  category: string;
  usageCount: number;
  csatScore: number;
  status: "active" | "stale" | "proposed";
  lastUpdated: string;
  summary: string;
  body?: string;
  groups?: string[];
  tags?: string[];
  curatedFromDocId?: string;
  articleType?: "runbook" | "faq" | "architecture" | "api_reference" | "policy";
}

export interface KnowledgeGap {
  id: string;
  topic: string;
  recurringIssueCount: number;
  confidence: number;
  sampleQueries: string[];
  suggestedAction: string;
  status: "detected" | "draft_proposed" | "published";
  firstDetected: string;
}

export interface KnowledgeProposal {
  id: string;
  gapId?: string;
  targetArticleId?: string;
  targetSource: string;
  title: string;
  currentContent?: string;
  proposedContent: string;
  rationale: string;
  provenance: string;
  confidence: number;
  status: "draft" | "pending_approval" | "published";
  createdAt: string;
}

export interface StaleWorkCandidate {
  id: string;
  issueId: string;
  externalId: string;
  source: SourceType;
  customerName: string;
  daysInactive: number;
  reason: "no_customer_reply" | "resolved_not_closed" | "waiting_on_third_party" | "duplicate_of_problem";
  confidence: number;
  recommendedAction: "close" | "remind_customer" | "remind_agent" | "link_to_problem";
  suggestedNote: string;
  status: "detected" | "reviewed" | "executed" | "dismissed";
}

export interface SourceConnector {
  id: string;
  name: string;
  type: SourceType;
  status: ConnectorHealth;
  lastSync: string;
  eventCountToday: number;
  capabilities: {
    read: string[];
    realtime: string[];
    write: string[];
  };
  credentialsConfigured: boolean;
  endpointUrl: string;
}

export interface SupportPolicy {
  tenantId: string;
  operatingMode: OperatingMode;
  autonomyThreshold: "none" | "read" | "low" | "medium" | "high";
  confidenceMin: number;
  sentimentEscalationEnabled: boolean;
  sentimentThreshold: "frustrated" | "angry";
  autoProblemLinkThreshold: number;
  staleWorkAutoCloseDays: number;
  proactiveCommsApprovalRequired: boolean;
  retentionRawContextHours: number;
  retentionDerivedMonths: number;
}

export interface ActionAuditRecord {
  id: string;
  tenantId: string;
  actorType: "human" | "ai_employee" | "automation";
  actorId: string;
  operationId: string;
  risk: "read" | "low" | "medium" | "high" | "critical";
  status: "proposed" | "awaiting_approval" | "executed" | "failed" | "rejected";
  idempotencyKey: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  timestamp: string;
}

export interface OverviewMetrics {
  csat: number;
  csatChange: number;
  issueVolume: number;
  issueVolumeChange: number;
  activeProblems: number;
  varrRate: number; // Verified Autonomous Resolution Rate (e.g. 74.2%)
  businessExposure: number; // in dollars (e.g. 142000)
  needsAttention: Array<{
    id: string;
    severity: "critical" | "warning" | "knowledge";
    title: string;
    description: string;
    impactText: string;
    actionText: string;
    targetTab: string;
    targetId?: string;
  }>;
  aiDiscovered: Array<{
    id: string;
    type: "problem" | "gap" | "stale" | "sentiment";
    title: string;
    description: string;
    confidence: number;
    actionText: string;
    targetTab: string;
  }>;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    type: "problem_detected" | "action_executed" | "proactive_sent" | "kb_proposed" | "stale_closed" | "sentiment_alert";
    description: string;
    actor: string;
    badgeColor: string;
  }>;
  aiWorkforce: Array<{
    id: string;
    name: string;
    role: string;
    status: "active" | "idle" | "reviewing";
    assignedCount: number;
    csat: number;
    varr: number;
    avatar: string;
  }>;
}

// -----------------------------------------------------------------------------
// Omnichannel Multi-Option Chat Workflow, Groups & AI Guardrails
// -----------------------------------------------------------------------------

export type ChatStreamType = "contractors" | "enquiries" | "customers";

export interface PreChatIntakeField {
  id: string;
  name: string;
  label: string;
  type: "text" | "email" | "select" | "textarea" | "number";
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface ChatWorkflowConfig {
  stream: ChatStreamType;
  title: string;
  subtitle: string;
  icon: string;
  badgeColor: string;
  description: string;
  intakeFields: PreChatIntakeField[];
  defaultAssignedGroupId: string;
  defaultAiEmployeeId: string;
  autoEscalateKeywords: string[];
}

export interface CustomerChatMessage {
  id: string;
  sender: "customer" | "agent" | "ai_employee" | "system";
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  citations?: Array<{
    id: string;
    title: string;
    snippet: string;
  }>;
  suggestedActions?: Array<{
    label: string;
    actionId: string;
    payload?: Record<string, unknown>;
  }>;
}

export interface CustomerChatSession {
  id: string;
  tenantDomain: string;
  stream: ChatStreamType;
  customerName: string;
  customerEmail: string;
  intakeData: Record<string, string>;
  assignedType: "human" | "ai";
  assignedId: string;
  assignedName: string;
  assignedAvatar?: string;
  status: "queued" | "active" | "escalated" | "resolved";
  priority: PriorityLevel;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  messages: CustomerChatMessage[];
}

export interface MemberGroup {
  id: string;
  name: string;
  streamType: ChatStreamType | "all";
  description: string;
  color: string;
  permissions: string[];
  memberEmails: string[];
  isSystem: boolean;
  createdAt: string;
}

export interface AiChatGuardrailConfig {
  enabledStreams: ChatStreamType[];
  maxAutonomousRefundAmount: number;
  escalateOnSentimentBelow: number;
  bannedTopics: string[];
  escalationKeywords: string[];
  requireHumanForBilling: boolean;
  requireHumanForContractorPayout: boolean;
  enableRAGGrounding: boolean;
}

