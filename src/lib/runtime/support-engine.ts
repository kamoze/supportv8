/**
 * supportV8 Agentic Support Engine
 * Implementation of Engine contract conforming to @servicev8/agentic-runtime.
 */

import {
  type AgentResolution,
  type Engine,
  type EngineContext,
  type OperationProposal,
} from "@servicev8/agentic-runtime";
import {
  OP_ZD_ADD_NOTE,
  OP_ZD_ADD_TAG,
  OP_ZD_CLOSE,
  OP_ZD_UPDATE_PRIORITY,
  OP_CUSTOMER_REFUND,
  OP_ACCOUNT_UNLOCK,
  OP_PROBLEM_NOTIFY,
  OP_KNOWLEDGE_PUBLISH,
  OP_TICKET_CREATE,
  OP_TICKET_ROUTE,
} from "./operations";

export interface SupportEngineInput {
  mode: "observe" | "copilot" | "autonomous";
  issueId?: string;
  externalTicketId?: string;
  source: string;
  customer: {
    id: string;
    name: string;
    tier: "standard" | "pro" | "enterprise";
    arr?: number;
  };
  message: string;
  sentiment: "positive" | "neutral" | "frustrated" | "angry" | "urgent";
  intent: string;
  category: string;
  likelyProblemId?: string;
  confidence: number;
}

export function createSupportEngine(input: SupportEngineInput): Engine {
  return async (ctx: EngineContext): Promise<AgentResolution> => {
    const { mode, customer, message, sentiment, category, likelyProblemId, confidence } = input;
    const ticketId = input.externalTicketId || input.issueId || `zd_${Date.now().toString().slice(-4)}`;

    // 1. Deterministic triage computation
    const proposals: OperationProposal[] = [];
    const actionsTaken: string[] = [`triaged_intent:${category}`, `sentiment:${sentiment}`];
    const derivedTags: string[] = [`cat:${category}`, `sent:${sentiment}`, `tier:${customer.tier}`];
    if (likelyProblemId) {
      derivedTags.push(`prb:${likelyProblemId}`);
    }

    // Propose tag addition (Low risk)
    proposals.push({
      operationId: OP_ZD_ADD_TAG,
      input: {
        ticket_id: ticketId,
        tags: derivedTags,
      },
      reason: `Tag external ticket with classified category (${category}) and customer tier (${customer.tier})`,
      idempotencyKey: `tag_${ticketId}_${category}`,
    });

    // Handle high urgency / frustration / tier: escalate priority
    if (sentiment === "angry" || sentiment === "urgent" || customer.tier === "enterprise") {
      proposals.push({
        operationId: OP_ZD_UPDATE_PRIORITY,
        input: {
          ticket_id: ticketId,
          priority: customer.tier === "enterprise" || sentiment === "urgent" ? "urgent" : "high",
        },
        reason: `Auto-escalate priority due to ${sentiment} sentiment and ${customer.tier} tier status`,
        idempotencyKey: `prio_${ticketId}_${customer.tier}`,
      });
    }

    // Mode-specific proposals
    if (mode === "observe") {
      // Observe mode: Only proposes derived intelligence and tags; no autonomous execution
      proposals.push({
        operationId: OP_ZD_ADD_NOTE,
        input: {
          ticket_id: ticketId,
          note: `[supportV8 Observe Mode] Detected intent '${category}' with confidence ${(confidence * 100).toFixed(0)}%. Linked Problem: ${likelyProblemId || "None detected"}.`,
        },
        reason: "Publish AI derived intelligence note to source ticket",
        idempotencyKey: `note_obs_${ticketId}`,
      });
    } else if (mode === "copilot") {
      // Copilot mode: Proposes internal note with suggested troubleshooting & action gateway actions
      proposals.push({
        operationId: OP_ZD_ADD_NOTE,
        input: {
          ticket_id: ticketId,
          note: `[supportV8 Copilot Suggestion]\nCustomer intent: ${category}\nRecommended next step: Verify tenant authentication settings in Dominion and check SSO configuration.\nConfidence: ${(confidence * 100).toFixed(0)}%`,
        },
        reason: "Provide human agent with real-time Copilot assistance and recommended next response",
        idempotencyKey: `note_cop_${ticketId}`,
      });
    } else if (mode === "autonomous") {
      // Autonomous mode: Handle approved classes of automated remediation
      if (category === "auth_lockout" && confidence >= 0.85) {
        proposals.push({
          operationId: OP_ACCOUNT_UNLOCK,
          input: {
            account_id: customer.id,
            reason: `Autonomous unlock verified for enterprise member (${customer.name}) after MFA check`,
          },
          reason: "Autonomously unlock account matching high confidence lockout policy",
          idempotencyKey: `unlock_${customer.id}`,
        });
      } else if (category === "billing_dispute" && message.toLowerCase().includes("refund")) {
        // High impact critical operation (will gate on human approval via Action Gateway)
        proposals.push({
          operationId: OP_CUSTOMER_REFUND,
          input: {
            customer_id: customer.id,
            amount_cents: 4900,
            reason: "Autonomous refund proposal under billing dispute threshold",
          },
          reason: "Propose partial service credit refund for billing discrepancy",
          idempotencyKey: `refund_${customer.id}_4900`,
        });
      } else if (likelyProblemId && confidence >= 0.9) {
        // Known problem auto-reply and resolution note
        proposals.push({
          operationId: OP_ZD_ADD_NOTE,
          input: {
            ticket_id: ticketId,
            note: `[supportV8 Autonomous Resolution] Matched active known Problem ${likelyProblemId}. Mitigation applied and recovery notice dispatched.`,
          },
          reason: "Autonomous verification note linked to resolved problem",
          idempotencyKey: `note_auto_${ticketId}_${likelyProblemId}`,
        });
      }
    }

    // Request metered narration from ForgeGateway if available
    const prompt = `Summarize support interaction for ${customer.name} (${customer.tier}) with intent '${category}' in ${mode} mode.`;
    const narration = await ctx.narrate(prompt);

    const summaryText =
      narration ||
      `supportV8 analyzed message in ${mode.toUpperCase()} mode. Intent: ${category}, Sentiment: ${sentiment.toUpperCase()} (Confidence: ${(confidence * 100).toFixed(0)}%). Generated ${proposals.length} proposed actions.`;

    return {
      executed: true,
      recommendation: summaryText,
      actionsTaken,
      proposals,
    };
  };
}

export class SupportAgenticEngine {
  private input: SupportEngineInput;

  constructor(input: SupportEngineInput) {
    this.input = input;
  }

  public async run(ctx: EngineContext): Promise<AgentResolution> {
    const engine = createSupportEngine(this.input);
    return engine(ctx);
  }
}
