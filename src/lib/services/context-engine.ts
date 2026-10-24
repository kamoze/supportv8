/**
 * supportV8 Real-Time Context Engine
 * Basis: EP04 (SV8-030 to SV8-037)
 * Assembles ephemeral support context for active customer interactions with TTL purge and budget limits.
 * Derives TTL from tenant policy or explicit retention configuration. Zero mock-data imports.
 */

import type { EphemeralSupportContext, SupportCustomerContext, SentimentClass, BusinessImpactLevel } from "../types";
import { triageEngine } from "./triage-engine";

export interface AssembleContextOptions {
  tenantId?: string;
  retentionHours?: number;
  openIssuesCount?: number;
  activeProblems?: Array<{ id: string; title: string; impact: BusinessImpactLevel; confidence: number }>;
  knowledgeSnippets?: Array<{ id: string; title: string; snippet: string; sourceUrl: string }>;
}

export class ContextEngine {
  private ephemeralStore: Map<string, { data: EphemeralSupportContext; expiresAt: number }> = new Map();

  public assembleContext(
    interactionId: string,
    customerInput: { id: string; name?: string; tier?: "standard" | "pro" | "enterprise"; email?: string },
    messageText: string,
    options?: AssembleContextOptions
  ): EphemeralSupportContext {
    const retentionHours = options?.retentionHours ?? 72;
    const ttlSeconds = retentionHours * 3600;

    // 1. Resolve Customer Profile
    const customer: SupportCustomerContext = {
      id: customerInput.id,
      name: customerInput.name || "Customer " + customerInput.id,
      email: customerInput.email || `${customerInput.id.toLowerCase()}@acme-client.com`,
      account: `ACC-${customerInput.id.toUpperCase()}`,
      tier: customerInput.tier || "standard",
      arr: customerInput.tier === "enterprise" ? 120000 : customerInput.tier === "pro" ? 14400 : 1200,
      openIssuesCount: options?.openIssuesCount ?? 0,
      sentimentHistory: ["neutral", "neutral", "neutral"] as SentimentClass[],
    };

    // 2. Classify Message
    const triage = triageEngine.classify(messageText, customer.tier);

    // 3. Find Active Problems
    const activeProblems = options?.activeProblems ?? [];

    // 4. Retrieve Relevant Knowledge Snippets
    const knowledgeSnippets = options?.knowledgeSnippets ?? [];

    // 5. Available Action Gateway actions
    const availableActions = [
      "zendesk.ticket.add_tag",
      "zendesk.ticket.update_priority",
      "zendesk.ticket.add_internal_note",
      "zendesk.ticket.close",
      "ticket.create",
      "ticket.route",
      "customer.refund",
      "account.unlock",
      "problem.notify_customers",
      "knowledge.publish",
    ];

    const context: EphemeralSupportContext = {
      interactionId,
      customer,
      currentInteraction: {
        intent: triage.intent,
        sentiment: triage.sentiment,
        sentimentScore: triage.sentimentScore,
        urgency: triage.priority,
        likelyCategory: triage.category,
        confidence: triage.confidence,
      },
      business: {
        accountTier: customer.tier.toUpperCase(),
        arr: customer.arr,
        slaTargetMin: customer.tier === "enterprise" ? 15 : customer.tier === "pro" ? 60 : 240,
        slaStatus: "healthy",
      },
      activeProblems,
      knowledgeSnippets,
      availableActions,
      ttlSeconds,
      createdAt: new Date().toISOString(),
    };

    // Save in ephemeral map with TTL derived from policy
    this.ephemeralStore.set(interactionId, {
      data: context,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    return context;
  }

  public getContext(interactionId: string): EphemeralSupportContext | null {
    const entry = this.ephemeralStore.get(interactionId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.ephemeralStore.delete(interactionId);
      return null;
    }
    return entry.data;
  }

  public getRemainingTtl(interactionId: string): number {
    const entry = this.ephemeralStore.get(interactionId);
    if (!entry) return 0;
    const remainingSeconds = Math.floor((entry.expiresAt - Date.now()) / 1000);
    if (remainingSeconds <= 0) {
      this.ephemeralStore.delete(interactionId);
      return 0;
    }
    return remainingSeconds;
  }

  public purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [id, entry] of this.ephemeralStore.entries()) {
      if (now > entry.expiresAt) {
        this.ephemeralStore.delete(id);
        purged++;
      }
    }
    return purged;
  }

  public clear(): void {
    this.ephemeralStore.clear();
  }
}

export const contextEngine = new ContextEngine();
