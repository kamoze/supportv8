/**
 * supportV8 Issue Intelligence Service
 * Basis: EP05 (SV8-040 to SV8-045)
 */

import { db } from "../db/mock-data";
import type { Issue, SourceType, SentimentClass } from "../types";
import { triageEngine } from "./triage-engine";

export class IssueService {
  public getAll(filters?: {
    sentiment?: SentimentClass;
    category?: string;
    source?: SourceType;
    problemId?: string;
    search?: string;
    tenant?: string;
  }): Issue[] {
    const tenantSlug = (filters?.tenant || "acme").toLowerCase().trim();
    const tenantData = db.getTenantData(tenantSlug);
    let result = [...tenantData.issues];

    if (filters?.sentiment) {
      result = result.filter((i) => i.sentiment === filters.sentiment);
    }
    if (filters?.category) {
      result = result.filter((i) => i.category === filters.category);
    }
    if (filters?.source) {
      result = result.filter((i) => i.source === filters.source);
    }
    if (filters?.problemId) {
      result = result.filter((i) => i.problemId === filters.problemId);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (i) =>
          i.summary.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.externalId.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }

  public getById(id: string, tenantSlug?: string): Issue | undefined {
    if (tenantSlug) {
      return db.getTenantData(tenantSlug).issues.find((i) => i.id === id);
    }
    const seeded = db.issues.find((i) => i.id === id);
    if (seeded) return seeded;
    for (const issues of (db as any).dynamicTenantIssues?.values?.() || []) {
      const match = issues.find((i: Issue) => i.id === id);
      if (match) return match;
    }
    return undefined;
  }

  public createFromInteraction(params: {
    source: SourceType;
    externalId: string;
    customerRef: string;
    customerName: string;
    customerTier: "standard" | "pro" | "enterprise";
    text: string;
    product?: string;
    version?: string;
    tenant?: string;
  }): Issue {
    const triage = triageEngine.classify(params.text, params.customerTier);
    const id = `ISS-${1000 + db.issues.length + 1}`;
    const timestamp = new Date().toISOString();
    const tenantSlug = (params.tenant || "acme").toLowerCase().trim();

    let sourceUrl = `https://support.acme.com/agent/tickets/${params.externalId}`;
    if (params.source === "zendesk") {
      sourceUrl = `https://acme.zendesk.com/agent/tickets/${params.externalId.replace(/\D/g, "") || "884250"}`;
    } else if (params.source === "intercom") {
      sourceUrl = `https://app.intercom.com/a/apps/acme/conversations/${params.externalId.replace(/\D/g, "") || "554200"}`;
    } else if (params.source === "twilio_voice") {
      sourceUrl = `https://console.twilio.com/voice/calls/${params.externalId}`;
    }

    const newIssue: Issue = {
      id,
      tenantId: `tenant_${tenantSlug.replace(/[^a-z0-9-]/g, "_")}`,
      source: params.source,
      externalId: params.externalId,
      sourceUrl,
      customerRef: params.customerRef,
      customerName: params.customerName,
      customerTier: params.customerTier,
      summary: params.text.slice(0, 120),
      category: triage.category,
      product: params.product || "Core Platform",
      version: params.version || "4.18.2",
      sentiment: triage.sentiment,
      sentimentScore: triage.sentimentScore,
      sentimentTrajectory: triage.sentimentTrajectory,
      priority: triage.priority,
      confidence: triage.confidence,
      businessImpact: triage.businessImpact,
      sourceStatus: "open",
      resolutionRiskScore: triage.resolutionRiskScore,
      recommendedAction: triage.rationale,
      tags: [triage.category, `sent:${triage.sentiment}`, `tier:${params.customerTier}`],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    db.addIssue(newIssue, tenantSlug);
    return newIssue;
  }

  public updateIssue(id: string, partial: Partial<Issue>, tenantSlug?: string): Issue | undefined {
    const issue = this.getById(id, tenantSlug);
    if (!issue) return undefined;
    Object.assign(issue, { ...partial, updatedAt: new Date().toISOString() });
    return issue;
  }
}

export const issueService = new IssueService();
