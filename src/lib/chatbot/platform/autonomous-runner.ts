import type { ChatStreamType, PriorityLevel } from "@/lib/types";
import { enqueueSupportTriage, enqueueStaleWorkSweep, enqueueProactiveBroadcast } from "@/lib/temporal/client";
import { ForgeSymphonyClient, DominionClient, GrowthV8Client } from "@/lib/services/interservice-client";
import { AGENT_REGISTRY } from "./agent-platform";

export class AutonomousRunner {
  /**
   * Dispatches an autonomous AI Employee objective through the Temporal workflow spine
   */
  static async runAiEmployee(params: {
    agentId: string;
    tenantId: string;
    stream: ChatStreamType;
    objective: string;
    customerEmail?: string;
    priority?: PriorityLevel;
  }) {
    const agent = AGENT_REGISTRY.find((a) => a.id === params.agentId);

    // Enqueue durable triage and execution workflow in Temporal
    const triageRes = await enqueueSupportTriage({
      tenantId: params.tenantId,
      sessionId: `auto_${Date.now()}`,
      stream: params.stream,
      customerName: agent?.name || "AI Employee",
      customerEmail: params.customerEmail || "employee@servicev8.com",
      query: params.objective,
      priority: params.priority || "high",
    });

    // Synchronize telemetry with Dominion
    await DominionClient.emitTelemetry({
      tenantId: params.tenantId,
      event: "ai_employee.objective_dispatched",
      metrics: {
        agentId: params.agentId,
        workflowId: triageRes.workflowId,
        stream: params.stream,
      },
    });

    return {
      success: true,
      agentId: params.agentId,
      agentName: agent?.name,
      workflowId: triageRes.workflowId,
      triageStatus: triageRes.triageStatus,
      assignedTarget: triageRes.assignedTarget,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Executes AI Intern triage, tag clustering, and draft preparation for human supervisor sign-off
   */
  static async runAiIntern(params: {
    tenantId: string;
    ticketId: string;
    ticketTitle: string;
    ticketBody: string;
  }) {
    const lower = `${params.ticketTitle} ${params.ticketBody}`.toLowerCase();
    const suggestedTags: string[] = [];

    if (lower.includes("saml") || lower.includes("okta") || lower.includes("sso")) {
      suggestedTags.push("auth_sso", "security_tier2");
    }
    if (lower.includes("checkout") || lower.includes("stripe") || lower.includes("payment")) {
      suggestedTags.push("checkout_billing", "high_priority");
    }
    if (lower.includes("contractor") || lower.includes("gate") || lower.includes("lockbox")) {
      suggestedTags.push("vendor_site_access");
    }
    if (suggestedTags.length === 0) {
      suggestedTags.push("general_support", "needs_classification");
    }

    const proposedDraft = `Hello! I have reviewed ticket #${params.ticketId} regarding "${params.ticketTitle}". Our team is verifying the details and will provide resolution steps shortly.`;

    return {
      success: true,
      agentRole: "ai_intern",
      ticketId: params.ticketId,
      suggestedTags,
      isDuplicateCandidate: lower.includes("duplicate") || lower.includes("already filed"),
      proposedDraft,
      requiresHumanSignoff: true,
    };
  }

  /**
   * Triggers a Background Agent durable sweep via Temporal
   */
  static async runBackgroundAgent(params: {
    sweepType: "stale_work" | "problem_correlation" | "rag_vector_sync";
    tenantId: string;
  }) {
    if (params.sweepType === "stale_work") {
      const sweepRes = await enqueueStaleWorkSweep({
        tenantId: params.tenantId,
        staleThresholdHours: 24,
        autoCloseDays: 7,
      });
      return {
        success: true,
        sweepType: params.sweepType,
        workflowId: sweepRes.workflowId,
        sweptCount: sweepRes.sweptCount,
        escalatedCount: sweepRes.escalatedCount,
      };
    }

    if (params.sweepType === "problem_correlation") {
      const broadcastRes = await enqueueProactiveBroadcast({
        tenantId: params.tenantId,
        problemId: `PRB-${Date.now().toString().slice(-4)}`,
        affectedAccountsCount: 14,
        subject: "Proactive cluster health check and correlation sweep",
        body: "Proactive correlation sweep initiated across all customer streams.",
      });
      return {
        success: true,
        sweepType: params.sweepType,
        broadcastId: broadcastRes.broadcastId,
      };
    }

    return {
      success: true,
      sweepType: params.sweepType,
      status: "synced_vector_embeddings",
    };
  }
}
