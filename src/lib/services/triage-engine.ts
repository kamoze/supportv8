/**
 * supportV8 Triage, Sentiment & Confidence Engine
 * Basis: EP06 (SV8-050 to SV8-056)
 */

import type {
  SentimentClass,
  PriorityLevel,
  BusinessImpactLevel,
  Issue,
} from "../types";

export interface TriageResult {
  intent: string;
  category: string;
  sentiment: SentimentClass;
  sentimentScore: number;
  sentimentTrajectory: "improving" | "stable" | "deteriorating";
  priority: PriorityLevel;
  confidence: number;
  businessImpact: BusinessImpactLevel;
  resolutionRiskScore: number;
  routingRecommendation: "observe" | "copilot" | "autonomous" | "human_escalation" | "approval_required";
  rationale: string;
}

export class TriageEngine {
  public classify(text: string, customerTier: "standard" | "pro" | "enterprise" = "standard"): TriageResult {
    const lower = text.toLowerCase();

    // 1. Intent & Category Classification
    let intent = "general_inquiry";
    let category = "general";
    let baseConfidence = 0.88;

    if (lower.includes("payment") || lower.includes("checkout") || lower.includes("credit card") || lower.includes("freeze") || lower.includes("504")) {
      intent = "checkout_failure";
      category = "checkout_failure";
      baseConfidence = 0.95;
    } else if (lower.includes("sso") || lower.includes("saml") || lower.includes("okta") || lower.includes("lockout") || lower.includes("login")) {
      intent = "auth_sso";
      category = "auth_sso";
      baseConfidence = 0.93;
    } else if (lower.includes("mfa") || lower.includes("2fa") || lower.includes("sms code") || lower.includes("yubikey") || lower.includes("fido2")) {
      intent = "mfa_sms";
      category = "mfa_sms";
      baseConfidence = 0.91;
    } else if (lower.includes("refund") || lower.includes("overcharge") || lower.includes("invoice") || lower.includes("billing")) {
      intent = "billing_dispute";
      category = "billing_dispute";
      baseConfidence = 0.89;
    } else if (lower.includes("api") || lower.includes("webhook") || lower.includes("rate limit") || lower.includes("timeout")) {
      intent = "api_error";
      category = "developer_platform";
      baseConfidence = 0.94;
    }

    // 2. Sentiment Classification
    let sentiment: SentimentClass = "neutral";
    let sentimentScore = 0.0;
    let trajectory: "improving" | "stable" | "deteriorating" = "stable";

    const angryKeywords = ["terrible", "unacceptable", "furious", "broken", "cancel my subscription", "lawyer", "refund now", "ridiculous", "freezes", "locked out"];
    const frustratedKeywords = ["slow", "failing", "error", "waiting", "again", "keeps happening", "cannot", "stuck", "annoying"];
    const positiveKeywords = ["thanks", "thank you", "great", "awesome", "fixed", "appreciate", "helpful", "good"];
    const urgentKeywords = ["urgent", "emergency", "asap", "down", "production", "immediately", "outage"];

    const isUrgent = urgentKeywords.some((w) => lower.includes(w));
    const isAngry = angryKeywords.some((w) => lower.includes(w));
    const isFrustrated = frustratedKeywords.some((w) => lower.includes(w));
    const isPositive = positiveKeywords.some((w) => lower.includes(w));

    if (isUrgent) {
      sentiment = "urgent";
      sentimentScore = -0.9;
      trajectory = "deteriorating";
    } else if (isAngry) {
      sentiment = "angry";
      sentimentScore = -0.85;
      trajectory = "deteriorating";
    } else if (isFrustrated) {
      sentiment = "frustrated";
      sentimentScore = -0.55;
      trajectory = "stable";
    } else if (isPositive) {
      sentiment = "positive";
      sentimentScore = 0.8;
      trajectory = "improving";
    }

    // 3. Priority Recommendation
    let priority: PriorityLevel = "normal";
    if (sentiment === "urgent" || sentiment === "angry" || customerTier === "enterprise") {
      priority = customerTier === "enterprise" || sentiment === "urgent" ? "urgent" : "high";
    } else if (sentiment === "frustrated" || customerTier === "pro") {
      priority = "high";
    }

    // 4. Business Impact Estimation
    let businessImpact: BusinessImpactLevel = "low";
    if (category === "checkout_failure" || (customerTier === "enterprise" && sentiment === "urgent")) {
      businessImpact = "critical";
    } else if (category === "auth_sso" || customerTier === "enterprise") {
      businessImpact = "high";
    } else if (category === "billing_dispute" || customerTier === "pro") {
      businessImpact = "medium";
    }

    // 5. Resolution Risk Score (0.00 to 1.00)
    // Combines sentiment negativity, tier criticality, category severity, and confidence uncertainty
    const tierWeight = customerTier === "enterprise" ? 0.35 : customerTier === "pro" ? 0.2 : 0.05;
    const sentimentWeight = sentiment === "urgent" ? 0.35 : sentiment === "angry" ? 0.3 : sentiment === "frustrated" ? 0.15 : 0.0;
    const severityWeight = businessImpact === "critical" ? 0.3 : businessImpact === "high" ? 0.2 : 0.05;
    const confidenceRisk = (1 - baseConfidence) * 0.5;

    const resolutionRiskScore = Math.min(1.0, Math.max(0.05, +(tierWeight + sentimentWeight + severityWeight + confidenceRisk).toFixed(2)));

    // 6. Routing Policy Evaluator
    let routingRecommendation: "observe" | "copilot" | "autonomous" | "human_escalation" | "approval_required" = "copilot";
    if (resolutionRiskScore > 0.8 || (customerTier === "enterprise" && sentiment === "urgent")) {
      routingRecommendation = "human_escalation";
    } else if (category === "billing_dispute" && lower.includes("refund")) {
      routingRecommendation = "approval_required";
    } else if (baseConfidence >= 0.85 && resolutionRiskScore <= 0.4) {
      routingRecommendation = "autonomous";
    } else {
      routingRecommendation = "copilot";
    }

    return {
      intent,
      category,
      sentiment,
      sentimentScore,
      sentimentTrajectory: trajectory,
      priority,
      confidence: baseConfidence,
      businessImpact,
      resolutionRiskScore,
      routingRecommendation,
      rationale: `Classified as ${category} with ${sentiment.toUpperCase()} sentiment. Calculated Resolution Risk Score: ${resolutionRiskScore}. Recommended Mode: ${routingRecommendation}.`,
    };
  }
}

export const triageEngine = new TriageEngine();
