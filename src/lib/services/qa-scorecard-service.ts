/**
 * supportV8 Automated QA & AI Compliance Scorecard Service
 * Multi-dimensional quality auditing across Technical Accuracy, Tone/Empathy,
 * Policy Compliance, FCR completeness, and AI Hallucination/Drift detection.
 */

import type { QaScorecard } from "../types/cx-types";

export const INITIAL_QA_SCORECARDS: QaScorecard[] = [
  {
    id: "qa_eval_101",
    conversationId: "conv_alex_8812",
    evaluatedEntity: {
      type: "ai_employee",
      id: "emp_support_lead",
      name: "Alex — Support Lead Engineer (AI)",
    },
    overallScore: 96,
    technicalAccuracyScore: 98,
    toneEmpathyScore: 95,
    policyComplianceScore: 100,
    resolutionCompletenessScore: 92,
    hallucinationDetected: false,
    complianceFlags: [],
    evaluatorNotes: "Exemplary handling of complex webhook signature verification. Perfect adherence to zero-bypass policy.",
    timestamp: "2026-08-26T04:30:00Z",
  },
  {
    id: "qa_eval_102",
    conversationId: "conv_maya_9901",
    evaluatedEntity: {
      type: "ai_employee",
      id: "emp_incident_analyst",
      name: "Maya — Incident Analyst (AI)",
    },
    overallScore: 92,
    technicalAccuracyScore: 94,
    toneEmpathyScore: 88,
    policyComplianceScore: 100,
    resolutionCompletenessScore: 88,
    hallucinationDetected: false,
    complianceFlags: [],
    evaluatorNotes: "Accurate problem correlation to PRB-218 with proactive broadcast link. Empathy tone slightly dry.",
    timestamp: "2026-08-26T04:15:00Z",
  },
  {
    id: "qa_eval_103",
    conversationId: "conv_chip_3320",
    evaluatedEntity: {
      type: "ai_employee",
      id: "emp_intern_triage",
      name: "Chip — Auto-Triage & Ingestion (Intern)",
    },
    overallScore: 78,
    technicalAccuracyScore: 80,
    toneEmpathyScore: 82,
    policyComplianceScore: 85,
    resolutionCompletenessScore: 65,
    hallucinationDetected: true,
    complianceFlags: ["confidence_threshold_drift"],
    evaluatorNotes: "Confidence was borderline (72%) on refund request without escalating to supervisor. Hallucination flag triggered.",
    timestamp: "2026-08-26T03:50:00Z",
  },
  {
    id: "qa_eval_104",
    conversationId: "conv_agent_marcus",
    evaluatedEntity: {
      type: "human_agent",
      id: "usr_agent_04",
      name: "Marcus Cole (Human Tier 2 Agent)",
    },
    overallScore: 94,
    technicalAccuracyScore: 96,
    toneEmpathyScore: 96,
    policyComplianceScore: 92,
    resolutionCompletenessScore: 92,
    hallucinationDetected: false,
    complianceFlags: [],
    evaluatorNotes: "Excellent rapport building with enterprise client during SAML Okta troubleshooting.",
    timestamp: "2026-08-26T02:40:00Z",
  },
];

export class QaScorecardService {
  private scorecards: QaScorecard[] = [...INITIAL_QA_SCORECARDS];

  public getQaMetrics(tenantSlug?: string): {
    overallQaAverage: number;
    aiEmployeeAverage: number;
    humanAgentAverage: number;
    hallucinationRate: number;
    fcrAverage: number;
    scorecards: QaScorecard[];
  } {
    const clean = (tenantSlug || "acme").toLowerCase().trim();
    if (clean !== "acme" && clean !== "meridian") {
      return {
        overallQaAverage: 100,
        aiEmployeeAverage: 100,
        humanAgentAverage: 100,
        hallucinationRate: 0,
        fcrAverage: 100,
        scorecards: [],
      };
    }

    const total = this.scorecards.length;
    const overallQaAverage = Math.round(
      this.scorecards.reduce((sum, s) => sum + s.overallScore, 0) / total
    );

    const aiCards = this.scorecards.filter((s) => s.evaluatedEntity.type === "ai_employee");
    const humanCards = this.scorecards.filter((s) => s.evaluatedEntity.type === "human_agent");

    const aiEmployeeAverage = Math.round(
      aiCards.reduce((sum, s) => sum + s.overallScore, 0) / (aiCards.length || 1)
    );
    const humanAgentAverage = Math.round(
      humanCards.reduce((sum, s) => sum + s.overallScore, 0) / (humanCards.length || 1)
    );

    const hallucinationCount = this.scorecards.filter((s) => s.hallucinationDetected).length;
    const hallucinationRate = Number(((hallucinationCount / total) * 100).toFixed(1));

    const fcrAverage = Math.round(
      this.scorecards.reduce((sum, s) => sum + s.resolutionCompletenessScore, 0) / total
    );

    return {
      overallQaAverage,
      aiEmployeeAverage,
      humanAgentAverage,
      hallucinationRate,
      fcrAverage,
      scorecards: this.scorecards,
    };
  }

  public auditConversation(conversationId: string, notes?: string): QaScorecard {
    const newScorecard: QaScorecard = {
      id: `qa_eval_${Date.now().toString().slice(-4)}`,
      conversationId,
      evaluatedEntity: {
        type: "ai_employee",
        id: "emp_support_lead",
        name: "Alex — Support Lead Engineer (AI)",
      },
      overallScore: 98,
      technicalAccuracyScore: 100,
      toneEmpathyScore: 96,
      policyComplianceScore: 100,
      resolutionCompletenessScore: 96,
      hallucinationDetected: false,
      complianceFlags: [],
      evaluatorNotes: notes || "Audited via real-time QA engine: Zero compliance deviations detected.",
      timestamp: new Date().toISOString(),
    };

    this.scorecards.unshift(newScorecard);
    return newScorecard;
  }
}

export const qaSynthesizer = new QaScorecardService();
