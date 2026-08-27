/**
 * supportV8 CX Manager Domain Types
 * Core contracts for the 6-Pillar CX Operations Engine:
 * 1. SLA Engine & Real-Time Breach Predictor
 * 2. 360° Customer Health Score & Churn Risk Radar
 * 3. Automated QA & AI Compliance Scorecards
 * 4. VoC / CSAT Driver Analytics & CES Breakdown
 * 5. Omnichannel Live Queue Load Balancer & Skill Routing
 * 6. AI Shift Handoff & Morning Standup Digest
 */

export interface SlaPolicyRule {
  tier: "enterprise" | "pro" | "standard";
  firstResponseTimeMinutes: number;
  nextResponseTimeMinutes: number;
  resolutionTimeMinutes: number;
}

export interface TicketSlaStatus {
  ticketId: string;
  externalId: string;
  customerName: string;
  tier: "enterprise" | "pro" | "standard";
  channel: "zendesk" | "intercom" | "voice" | "email";
  status: "open" | "in_progress" | "pending_customer" | "resolved";
  assignedAgent: string;
  targetResponseMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  riskLevel: "healthy" | "at_risk" | "breached";
  predictedBreachMinutes?: number;
  suggestedAction: string;
}

export interface VipChurnAlert {
  id: string;
  accountId: string;
  accountName: string;
  tier: "enterprise" | "pro" | "standard";
  frustratedInteractions48h: number;
  triggerReason: string;
  arrExposure: number;
  detectedAt: string;
  status: "active" | "acknowledged" | "resolved";
}

export interface AccountHealthProfile {
  accountId: string;
  accountName: string;
  tier: "enterprise" | "pro" | "standard";
  healthScore: number; // 0 - 100
  riskLevel: "healthy" | "concerning" | "critical_at_risk";
  arrExposure: number;
  lifetimeTicketVolume: number;
  openIssuesCount: number;
  sentimentTrajectory: "improving" | "stable" | "declining";
  avgSentimentScore: number;
  csatAverage: number;
  lastIncidentImpacted?: string;
  churnProbability: number; // 0.0 - 1.0
  primaryFrustrationDriver?: string;
  assignedCsm: string;
  recentFrustratedCount48h: number;
}

export interface QaScorecard {
  id: string;
  conversationId: string;
  evaluatedEntity: {
    type: "ai_employee" | "human_agent";
    id: string;
    name: string;
  };
  overallScore: number; // 0 - 100
  technicalAccuracyScore: number;
  toneEmpathyScore: number;
  policyComplianceScore: number;
  resolutionCompletenessScore: number; // FCR
  hallucinationDetected: boolean;
  complianceFlags: string[];
  evaluatorNotes: string;
  timestamp: string;
}

export interface CsatDistribution {
  score: 1 | 2 | 3 | 4 | 5;
  count: number;
  percentage: number;
}

export interface TopDelightKbArticle {
  articleId: string;
  title: string;
  category: string;
  csatBoost: number;
  resolutionCount: number;
}

export interface VocDriverCluster {
  id: string;
  category: "negative_discontent" | "positive_delight";
  topic: string;
  percentageShare: number;
  ticketCount: number;
  sentimentImpact: string;
  topQuote: string;
  suggestedOperationalFix: string;
}

export interface ChannelLoadMeter {
  channel: "email" | "live_chat" | "voice" | "slack";
  name: string;
  activeConversations: number;
  maxCapacity: number;
  loadPercentage: number;
  status: "optimal" | "elevated" | "congested";
  avgWaitTimeSeconds: number;
}

export interface SkillRoutingRule {
  id: string;
  intentCategory: string;
  assignedAgentOrRole: string;
  fallbackAgentOrRole: string;
  priorityWeight: number;
  skillRequired: string;
  active: boolean;
}

export interface ShiftHandoffDigest {
  id: string;
  shiftName: string;
  generatedAt: string;
  executiveSummary: string;
  keyMetrics: {
    varrRate: number;
    totalTicketsResolved: number;
    hoursSaved: number;
    openCriticalProblems: number;
    atRiskSlaTickets: number;
    vipWaitingCount: number;
  };
  ongoingProblems: Array<{ id: string; title: string; eta: string; impact: string }>;
  vipAtRiskAccounts: Array<{ accountName: string; arr: number; reason: string }>;
  topOvernightPainPoints: Array<{ rank: number; topic: string; count: number; sentiment: string }>;
  staleTicketsSwept: number;
  recommendedFocusAreas: string[];
}
