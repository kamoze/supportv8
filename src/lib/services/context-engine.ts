/**
 * supportV8 Real-Time Context Engine
 * Basis: EP04 (SV8-030 to SV8-037)
 * Assembles ephemeral support context for active customer interactions with TTL purge and budget limits.
 */

import { db } from "../db/mock-data";
import type { EphemeralSupportContext, SupportCustomerContext, SentimentClass } from "../types";
import { triageEngine } from "./triage-engine";

export class ContextEngine {
  private ephemeralStore: Map<string, { data: EphemeralSupportContext; expiresAt: number }> = new Map();

  public assembleContext(
    interactionId: string,
    customerInput: { id: string; name?: string; tier?: "standard" | "pro" | "enterprise"; email?: string },
    messageText: string
  ): EphemeralSupportContext {
    // 1. Resolve Customer Profile
    const customer: SupportCustomerContext = {
      id: customerInput.id,
      name: customerInput.name || "Customer " + customerInput.id,
      email: customerInput.email || `${customerInput.id.toLowerCase()}@acme-client.com`,
      account: `ACC-${customerInput.id.toUpperCase()}`,
      tier: customerInput.tier || "standard",
      arr: customerInput.tier === "enterprise" ? 120000 : customerInput.tier === "pro" ? 14400 : 1200,
      openIssuesCount: db.issues.filter((i) => i.customerRef === customerInput.id && i.sourceStatus === "open").length,
      sentimentHistory: ["neutral", "neutral", "frustrated"] as SentimentClass[],
    };

    // 2. Classify Message
    const triage = triageEngine.classify(messageText, customer.tier);

    // 3. Find Active Problems
    const activeProblems = db.problems
      .filter((p) => p.status !== "resolved")
      .map((p) => ({
        id: p.id,
        title: p.title,
        impact: p.impact,
        confidence: p.confidence,
      }));

    // 4. Retrieve Relevant Knowledge Snippets
    const knowledgeSnippets = db.articles
      .filter((a) => a.status === "active")
      .slice(0, 2)
      .map((a) => ({
        id: a.id,
        title: a.title,
        snippet: a.summary,
        sourceUrl: a.url,
      }));

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
      ttlSeconds: db.policy.retentionRawContextHours * 3600,
      createdAt: new Date().toISOString(),
    };

    // Save in ephemeral map with TTL
    this.ephemeralStore.set(interactionId, {
      data: context,
      expiresAt: Date.now() + 3600 * 1000,
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
}

export const contextEngine = new ContextEngine();
